import { NextResponse } from "next/server";
import crypto from "crypto";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const signingSecret = process.env.SLACK_SIGNING_SECRET;

function hmacSha256Hex(secret: string, base: string) {
  return crypto.createHmac("sha256", secret).update(base).digest("hex");
}

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // If lengths differ, comparison is always false.
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function verifySlackRequest(request: Request, rawBody: string) {
  if (!signingSecret) return false;

  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");

  if (!signature || !timestamp) return false;

  // Replay protection: reject requests older than 5 minutes.
  const ts = Number(timestamp);
  const now = Date.now();
  if (!Number.isFinite(ts) || Math.abs(now - ts * 1000) > 5 * 60 * 1000) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hash = hmacSha256Hex(signingSecret, baseString);
  const expectedSignature = `v0=${hash}`;

  return timingSafeEqual(expectedSignature, signature);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const signatureHeader = request.headers.get("x-slack-signature");
  const timestampHeader = request.headers.get("x-slack-request-timestamp");

  const ok = await verifySlackRequest(request, rawBody);
  if (!ok) {
    console.log("[Slack Actions] signature verification failed", {
      hasSigningSecret: Boolean(signingSecret),
      hasSignatureHeader: Boolean(signatureHeader),
      hasTimestampHeader: Boolean(timestampHeader),
    });
    return NextResponse.json(
      { ok: false, error: "Invalid Slack signature" },
      { status: 401 }
    );
  }

  // Slack sends: content-type application/x-www-form-urlencoded
  // and includes a `payload` field which is a JSON string.
  const form = new URLSearchParams(rawBody);
  const payloadRaw = form.get("payload");
  if (!payloadRaw) {
    return NextResponse.json({ ok: false, error: "Missing payload" }, { status: 400 });
  }

  const payload = JSON.parse(payloadRaw) as {
    actions?: Array<{ action_id: string; value: string }>;
  };

  const action = payload.actions?.[0];
  if (!action) {
    console.log("[Slack Actions] Missing action in payload", payload);
    return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 });
  }

  const eventId = Number(action.value);
  if (!Number.isInteger(eventId)) {
    console.log("[Slack Actions] Invalid event id", { value: action.value });
    return NextResponse.json({ ok: false, error: "Invalid event id" }, { status: 400 });
  }

  if (action.action_id === "mark_done") {
    const updateRes = await pool.query(
      "UPDATE events SET completed = TRUE WHERE id = $1",
      [eventId]
    );
    console.log("[Slack Actions] Mark done result", {
      eventId,
      updatedRows: updateRes.rowCount,
    });

    return NextResponse.json({
      ok: true,
      text: "Marked as done.",
      response_type: "ephemeral",
    });
  }

  if (
    action.action_id === "snooze_10m" ||
    action.action_id === "snooze_1h" ||
    action.action_id === "snooze_tomorrow"
  ) {
    // Keep this migration here so the action endpoint works even if
    // `db/init.sql` has not been re-run yet in production.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS snoozed_notifications (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        remind_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const minutesToAdd =
      action.action_id === "snooze_10m"
        ? 10
        : action.action_id === "snooze_1h"
          ? 60
          : 24 * 60;
    const remindAt = new Date(Date.now() + minutesToAdd * 60 * 1000);

    await pool.query(
      "INSERT INTO snoozed_notifications (event_id, remind_at) VALUES ($1, $2)",
      [eventId, remindAt]
    );

    const humanLabel =
      action.action_id === "snooze_10m"
        ? "10 minutes"
        : action.action_id === "snooze_1h"
          ? "1 hour"
          : "tomorrow";

    return NextResponse.json({
      ok: true,
      text: `Snoozed. I will remind you again in ${humanLabel}.`,
      response_type: "ephemeral",
    });
  }

  console.log("[Slack Actions] Unknown action_id", action.action_id);
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

