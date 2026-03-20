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
  // Keep it readable in Slack across locales.
  return date.toLocaleString();
}

function buildReminderMessage(eventType: EventType, title: string, date: Date, diffMinutes: number) {
  const dateStr = eventDateString(date);
  const hoursLeft = formatHoursLeft(diffMinutes);

  if (eventType === "deadline") {
    return `Reminder: You have a deadline on ${dateStr}. You have ${hoursLeft} hours left before deadline`;
  }
  if (eventType === "meeting") {
    return `Reminder: You have a meeting on ${dateStr}. You have ${hoursLeft} hours left before the meeting`;
  }
  return `Reminder: You have a business trip on ${dateStr}. You have ${hoursLeft} hours left before the trip`;
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

export async function GET() {
  const now = new Date();

  const result = await pool.query(
    "SELECT id, title, description, event_type, scheduled_at, completed FROM events WHERE completed = FALSE"
  );

  const rows = result.rows as {
    id: number;
    title: string;
    description: string | null;
    event_type: EventType;
    scheduled_at: Date;
    completed: boolean;
  }[];

  let sentCount = 0;

  for (const row of rows) {
    const scheduledAt = new Date(row.scheduled_at);

    const minutesDiff = differenceInMinutes(scheduledAt, now);

    const showDoneButton = row.completed === false;

    // BEFORE reminders
    if (isWithinMinuteWindow(minutesDiff, 72 * 60)) {
      if (await markIfNotSent(row.id, "before_3d")) {
        await sendSlackMessage(
          buildReminderMessage(row.event_type, row.title, scheduledAt, minutesDiff),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildReminderMessage(
                  row.event_type,
                  row.title,
                  scheduledAt,
                  minutesDiff
                ),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*When:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }

    if (isWithinMinuteWindow(minutesDiff, 24 * 60)) {
      if (await markIfNotSent(row.id, "before_24h")) {
        await sendSlackMessage(
          buildReminderMessage(row.event_type, row.title, scheduledAt, minutesDiff),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildReminderMessage(
                  row.event_type,
                  row.title,
                  scheduledAt,
                  minutesDiff
                ),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*When:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }

    if (isWithinMinuteWindow(minutesDiff, 3 * 60)) {
      if (await markIfNotSent(row.id, "before_3h")) {
        await sendSlackMessage(
          buildReminderMessage(row.event_type, row.title, scheduledAt, minutesDiff),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildReminderMessage(
                  row.event_type,
                  row.title,
                  scheduledAt,
                  minutesDiff
                ),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*When:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }

    if (isWithinMinuteWindow(minutesDiff, 15)) {
      if (await markIfNotSent(row.id, "before_15m")) {
        await sendSlackMessage(
          buildReminderMessage(row.event_type, row.title, scheduledAt, minutesDiff),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildReminderMessage(
                  row.event_type,
                  row.title,
                  scheduledAt,
                  minutesDiff
                ),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*When:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }

    // EXACT schedule time
    if (isWithinMinuteWindow(minutesDiff, 0)) {
      if (await markIfNotSent(row.id, "at_time")) {
        await sendSlackMessage(
          buildReminderMessage(row.event_type, row.title, scheduledAt, 0),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildReminderMessage(
                  row.event_type,
                  row.title,
                  scheduledAt,
                  0
                ),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*When:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }

    // MISSED follow-ups (after schedule)
    if (isWithinMinuteWindow(minutesDiff, -10)) {
      if (await markIfNotSent(row.id, "missed_10m")) {
        await sendSlackMessage(
          buildUrgentMessage(row.event_type, row.title, scheduledAt),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildUrgentMessage(row.event_type, row.title, scheduledAt),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Scheduled:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }

    if (isWithinMinuteWindow(minutesDiff, -60)) {
      if (await markIfNotSent(row.id, "missed_1h")) {
        await sendSlackMessage(
          buildUrgentMessage(row.event_type, row.title, scheduledAt),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildUrgentMessage(row.event_type, row.title, scheduledAt),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Scheduled:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }

    if (isWithinMinuteWindow(minutesDiff, -24 * 60)) {
      if (await markIfNotSent(row.id, "missed_24h")) {
        await sendSlackMessage(
          buildUrgentMessage(row.event_type, row.title, scheduledAt),
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: buildUrgentMessage(row.event_type, row.title, scheduledAt),
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Title:*\n${row.title}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Scheduled:*\n${eventDateString(scheduledAt)}`,
                },
              ],
            },
            ...(showDoneButton
              ? [
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Mark as done" },
                        style: "primary",
                        action_id: "mark_done",
                        value: String(row.id),
                      },
                    ],
                  },
                ]
              : []),
          ]
        );
        sentCount += 1;
      }
      continue;
    }
  }

  return NextResponse.json({ ok: true, sentCount });
}

// Some scheduler templates call endpoints using POST.
// We support POST as an alias so cron jobs don't fail with 405.
export async function POST() {
  return GET();
}

