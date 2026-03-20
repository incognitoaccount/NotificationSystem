import { NextResponse } from "next/server";
import { authenticate, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const username = (body.username as string | undefined)?.trim();
  const password = body.password as string | undefined;

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const user = await authenticate(username, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  setSessionCookie(user);
  return NextResponse.json({ ok: true, user });
}

