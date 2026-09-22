import { NextResponse } from "next/server";
import { notifyOwnerAbandoned } from "@/lib/notify-owner";
import { abandonNotifySchema } from "@/lib/schema";

async function parseRequestBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

export async function POST(request: Request) {
  try {
    const body = await parseRequestBody(request);
    const parsed = abandonNotifySchema.safeParse(body);

    if (!parsed.success) {
      console.warn("[NotifyAbandon] Invalid payload:", parsed.error.flatten());
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const sent = await notifyOwnerAbandoned(parsed.data);
    if (!sent) {
      console.warn("[NotifyAbandon] Mailgun send failed");
      return NextResponse.json({ ok: false, error: "mailgun_failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[NotifyAbandon]", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
