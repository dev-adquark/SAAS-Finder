import { NextResponse } from "next/server";
import { isAutomatedAgent, MAX_BODY_BYTES, parseAnalyticsPayload } from "@/lib/analytics";
import { recordEvent } from "@/lib/record-event";

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "request_too_large" }, { status: 413 });
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  const parsed = parseAnalyticsPayload(raw);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });
  // Known automated agents are accepted but not stored. Storage failures are swallowed: the client
  // must never see analytics errors.
  if (isAutomatedAgent(req.headers.get("user-agent"), { emptyIsAutomated: false })) return NextResponse.json({ ok: true, stored: false }, { status: 202 });
  const stored = await recordEvent(parsed.record);
  return NextResponse.json({ ok: true, stored }, { status: 202 });
}
