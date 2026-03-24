import { NextResponse } from "next/server";
import { pool, type EventType } from "@/lib/db";
import { differenceInMinutes } from "date-fns";
import { sendSlackMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

// This route is a simple "worker" that you can trigger on a schedule.
// For example, you can call it every minute using Windows Task Scheduler or a cron job.
// It will:
// 1. Load all events from the database.
// 2. For each event, calculate how far it is from now.
// 3. Decide which message (if any) should be sent to Slack.
// We DO store which reminders were sent in `notifications_sent` so that
// re-running this worker does not send duplicates.

type ReminderKind =
  | "before_3d"
  | "before_24h"
  | "before_3h"
  | "before_15m"
  | "before_10m"
  | "at_time"
  | "missed_10m"
  | "missed_1h"
  | "missed_24h";

function formatHoursLeft(diffMinutes: number) {
  // We keep this output simple and consistent with the assessment prompt.
  // Example: 90 minutes -> 1.5 hours
  const hours = diffMinutes / 60;
  const rounded = Math.round(hours * 100) / 100;
  return String(rounded);
}

function eventDateString(date: Date) {
  // Slack messages are formatted using a fixed timezone so the time
  // matches what the user sees on the website.
  //
  // The browser UI uses the user's local timezone, but the worker runs
  // on the server (Railway), so without an explicit timezone Slack time
  // can shift (common: UTC vs GMT+8).
  const timeZone = process.env.SLACK_TIMEZONE || "Asia/Singapore";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function buildReminderMessage(eventType: EventType, title: string, date: Date, diffMinutes: number) {
  const dateStr = eventDateString(date);
  const hoursLeft = formatHoursLeft(diffMinutes);
  const minutesLeft = Math.max(0, diffMinutes);
  const minutesExtra =
    minutesLeft < 60 ? ` (${minutesLeft} minutes)` : "";

  if (eventType === "deadline") {
    return `Reminder: You have a deadline on ${dateStr}. You have ${hoursLeft} hours left before deadline${minutesExtra}`;
  }
  if (eventType === "meeting") {
    return `Reminder: You have a meeting on ${dateStr}. You have ${hoursLeft} hours left before the meeting${minutesExtra}`;
  }
  return `Reminder: You have a business trip on ${dateStr}. You have ${hoursLeft} hours left before the trip${minutesExtra}`;
}

function buildUrgentMessage(eventType: EventType, title: string, date: Date) {
  const dateStr = eventDateString(date);

  if (eventType === "deadline") {
    return `Urgent Reminder: You missed the deadline for ${title} that was ended on ${dateStr}`;
  }
  if (eventType === "meeting") {
    return `Urgent Reminder: You missed the meeting on ${dateStr}`;
  }
  return `Urgent Reminder: You missed your business trip on ${dateStr}`;
}

function isWithinMinuteWindow(diffMinutes: number, targetMinutes: number, window = 3) {
  return Math.abs(diffMinutes - targetMinutes) <= window;
}

async function markIfNotSent(eventId: number, kind: ReminderKind) {
  // Insert-once semantics via UNIQUE(event_id, kind).
  // If the row already exists, it means we already sent that reminder.
  const result = await pool.query(
    `INSERT INTO notifications_sent (event_id, kind)
     VALUES ($1, $2)
     ON CONFLICT (event_id, kind) DO NOTHING
     RETURNING id`,
    [eventId, kind]
  );

  return result.rowCount === 1;
}

function buildActionBlock(eventId: number, showDoneButton: boolean) {
  if (!showDoneButton) return null;

  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Mark as done" },
        style: "primary",
        action_id: "mark_done",
        value: String(eventId),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Snooze 10m" },
        action_id: "snooze_10m",
        value: String(eventId),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Snooze 1h" },
        action_id: "snooze_1h",
        value: String(eventId),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Snooze tomorrow" },
        action_id: "snooze_tomorrow",
        value: String(eventId),
      },
    ],
  };
}

async function sendEventNotification(args: {
  eventId: number;
  title: string;
  createdBy: string;
  scheduledAt: Date;
  messageText: string;
  showDoneButton: boolean;
  scheduleLabel: "When" | "Scheduled";
}) {
  const actions = buildActionBlock(args.eventId, args.showDoneButton);
  await sendSlackMessage(args.messageText, [
    {
      type: "section",
      text: { type: "mrkdwn", text: args.messageText },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Title:*\n${args.title}` },
        {
          type: "mrkdwn",
          text: `*${args.scheduleLabel}:*\n${eventDateString(args.scheduledAt)}`,
        },
        { type: "mrkdwn", text: `*Created by:*\n${args.createdBy}` },
      ],
    },
    ...(actions ? [actions] : []),
  ]);
}

export async function GET() {
  const now = new Date();

  // Ensure auth + snooze schema exists.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snoozed_notifications (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      remind_at TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  let sentCount = 0;

  // 1) Send due snoozed reminders first.
  const dueSnoozes = await pool.query(
    `SELECT
      s.id AS snooze_id,
      e.id,
      e.title,
      e.event_type,
      e.scheduled_at,
      e.completed,
      u.username AS created_by
     FROM snoozed_notifications s
     JOIN events e ON e.id = s.event_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE s.sent_at IS NULL
       AND s.remind_at <= NOW()
       AND e.completed = FALSE
     ORDER BY s.remind_at ASC`
  );

  for (const row of dueSnoozes.rows as Array<{
    snooze_id: number;
    id: number;
    title: string;
    event_type: EventType;
    scheduled_at: Date;
    completed: boolean;
    created_by: string | null;
  }>) {
    const scheduledAt = new Date(row.scheduled_at);
    const minutesDiff = differenceInMinutes(scheduledAt, now);
    const messageText =
      minutesDiff >= 0
        ? buildReminderMessage(row.event_type, row.title, scheduledAt, minutesDiff)
        : buildUrgentMessage(row.event_type, row.title, scheduledAt);

    await sendEventNotification({
      eventId: row.id,
      title: row.title,
      createdBy: row.created_by ?? "unknown",
      scheduledAt,
      messageText,
      showDoneButton: !row.completed,
      scheduleLabel: minutesDiff >= 0 ? "When" : "Scheduled",
    });

    await pool.query(
      "UPDATE snoozed_notifications SET sent_at = NOW() WHERE id = $1",
      [row.snooze_id]
    );
    sentCount += 1;
  }

  // 2) Regular reminder pipeline.
  const result = await pool.query(
    `SELECT
      e.id,
      e.title,
      e.event_type,
      e.scheduled_at,
      e.completed,
      u.username AS created_by
     FROM events e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.completed = FALSE`
  );

  const beforeStages: Array<{ kind: ReminderKind; targetMinutes: number }> = [
    { kind: "before_3d", targetMinutes: 72 * 60 },
    { kind: "before_24h", targetMinutes: 24 * 60 },
    { kind: "before_3h", targetMinutes: 3 * 60 },
    { kind: "before_15m", targetMinutes: 15 },
    // New early reminder explicitly requested by the reviewer.
    { kind: "before_10m", targetMinutes: 10 },
    { kind: "at_time", targetMinutes: 0 },
  ];

  const missedStages: Array<{ kind: ReminderKind; targetMinutes: number }> = [
    { kind: "missed_10m", targetMinutes: -10 },
    { kind: "missed_1h", targetMinutes: -60 },
    { kind: "missed_24h", targetMinutes: -24 * 60 },
  ];

  for (const row of result.rows as Array<{
    id: number;
    title: string;
    event_type: EventType;
    scheduled_at: Date;
    completed: boolean;
    created_by: string | null;
  }>) {
    const scheduledAt = new Date(row.scheduled_at);
    const minutesDiff = differenceInMinutes(scheduledAt, now);
    const createdBy = row.created_by ?? "unknown";
    const showDoneButton = row.completed === false;

    let handled = false;

    for (const stage of beforeStages) {
      if (!isWithinMinuteWindow(minutesDiff, stage.targetMinutes)) continue;
      if (!(await markIfNotSent(row.id, stage.kind))) {
        handled = true;
        break;
      }

      await sendEventNotification({
        eventId: row.id,
        title: row.title,
        createdBy,
        scheduledAt,
        messageText: buildReminderMessage(
          row.event_type,
          row.title,
          scheduledAt,
          stage.targetMinutes === 0 ? 0 : minutesDiff
        ),
        showDoneButton,
        scheduleLabel: "When",
      });

      sentCount += 1;
      handled = true;
      break;
    }
    if (handled) continue;

    for (const stage of missedStages) {
      if (!isWithinMinuteWindow(minutesDiff, stage.targetMinutes)) continue;
      if (!(await markIfNotSent(row.id, stage.kind))) {
        handled = true;
        break;
      }

      await sendEventNotification({
        eventId: row.id,
        title: row.title,
        createdBy,
        scheduledAt,
        messageText: buildUrgentMessage(row.event_type, row.title, scheduledAt),
        showDoneButton,
        scheduleLabel: "Scheduled",
      });

      sentCount += 1;
      handled = true;
      break;
    }
  }

  return NextResponse.json({ ok: true, sentCount });
}

// Some scheduler templates call endpoints using POST.
// We support POST as an alias so cron jobs don't fail with 405.
export async function POST() {
  return GET();
}

