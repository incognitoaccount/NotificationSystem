import { NextResponse } from "next/server";
import { pool, type EventType } from "@/lib/db";
import { sendSlackMessage } from "@/lib/slack";

// This API route handles basic CRUD operations for events.
// For this assessment we will only use:
// - GET    /api/events   -> list all events
// - POST   /api/events   -> create a new event

export async function GET() {
  // We fetch all events ordered by scheduled_at so that the UI
  // can easily group them on the Kanban board.
  const result = await pool.query(
    "SELECT id, title, description, event_type, scheduled_at, completed, created_at, updated_at FROM events ORDER BY scheduled_at ASC"
  );

  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
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
    `INSERT INTO events (title, description, event_type, scheduled_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, description, event_type, scheduled_at, completed, created_at, updated_at`,
    [title, description, eventType, scheduledAt]
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

  const when = scheduledAt.toLocaleString();

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

  return NextResponse.json(result.rows[0], { status: 201 });
}

