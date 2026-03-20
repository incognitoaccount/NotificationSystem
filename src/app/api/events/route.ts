import { NextResponse } from "next/server";
import { pool, type EventType } from "@/lib/db";
import { sendSlackMessage } from "@/lib/slack";
import { requireUser } from "@/lib/auth";

// This API route handles basic CRUD operations for events.
// For this assessment we will only use:
// - GET    /api/events   -> list all events
// - POST   /api/events   -> create a new event

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // We fetch all events ordered by scheduled_at so that the UI
  // can easily group them on the Kanban board.
  const result = await pool.query(
    `SELECT
       e.id,
       e.title,
       e.description,
       e.event_type,
       e.scheduled_at,
       e.completed,
       u.username AS created_by
     FROM events e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.user_id = $1
     ORDER BY e.scheduled_at ASC`,
    [user.id]
  );

  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // We expect a small JSON payload from the frontend:
  // { title, description?, eventType, scheduledAt }
  const body = await request.json();

  const title = (body.title as string | undefined)?.trim();
  const description =
    (body.description as string | undefined)?.trim() || null;
  const eventType = body.eventType as EventType | undefined;
  const scheduledAtString = body.scheduledAt as string | undefined;

  if (!title || !eventType || !scheduledAtString) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    );
  }

  const scheduledAt = new Date(scheduledAtString);

  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json(
      { error: "Invalid scheduledAt datetime." },
      { status: 400 }
    );
  }

  const result = await pool.query(
    `INSERT INTO events (title, description, event_type, scheduled_at, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, description, event_type, scheduled_at, completed`,
    [title, description, eventType, scheduledAt, user.id]
  );

  // Send a richer confirmation message so you can immediately see
  // that Slack is configured correctly when you create an event.
  // The timed reminders are handled separately by /api/notifications/run.
  const prettyType =
    eventType === "deadline"
      ? "Deadline"
      : eventType === "meeting"
      ? "Meeting"
      : "Business Trip";

  const timeZone = process.env.SLACK_TIMEZONE || "Asia/Singapore";
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(scheduledAt);

  const insertedId = result.rows[0].id as number;

  await sendSlackMessage(
    `Saved: ${prettyType} scheduled at ${when}: ${title}`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*New ${prettyType} added to your schedule*`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Title:*\n${title}`,
          },
          {
            type: "mrkdwn",
            text: `*When:*\n${when}`,
          },
          {
            type: "mrkdwn",
            text: `*Type:*\n${prettyType}`,
          },
          {
            type: "mrkdwn",
            text: `*Created by:*\n${user.username}`,
          },
          description
            ? {
                type: "mrkdwn",
                text: `*Notes:*\n${description}`,
              }
            : {
                type: "mrkdwn",
                text: `*Notes:*\n_(none)_`,
              },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Created via *NotifyFlow* Kanban board",
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Mark as done" },
            style: "primary",
            action_id: "mark_done",
            value: String(insertedId),
          },
        ],
      },
    ]
  );

  return NextResponse.json(
    { ...result.rows[0], created_by: user.username },
    { status: 201 }
  );
}

