import { NextResponse } from "next/server";
import { pool, type EventType } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// This route allows updating and deleting a single event by id.

interface Params {
  params: {
    id: string;
  };
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

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
    `UPDATE events
     SET title = $1,
         description = $2,
         event_type = $3,
         scheduled_at = $4,
         completed = FALSE,
         updated_at = NOW()
     WHERE id = $5
       AND user_id = $6
     RETURNING id, title, description, event_type, scheduled_at, completed, created_at, updated_at`,
    [title, description, eventType, scheduledAt, id, user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Include creator username for the UI.
  const row = result.rows[0];
  const createdByRes = await pool.query(
    "SELECT username FROM users WHERE id = $1",
    [user.id]
  );
  const createdBy = createdByRes.rows[0]?.username ?? null;

  return NextResponse.json({ ...row, created_by: createdBy });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await pool.query(
    "DELETE FROM events WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // notifications_sent rows are removed automatically by ON DELETE CASCADE.
  return NextResponse.json({ ok: true });
}

