import { NextResponse } from "next/server";
import { notifyOwnerByEmail } from "@/lib/notify-owner";
import { sendLeadWebhook } from "@/lib/send-webhook";
import { parseStepSubmit, type LeadPayload } from "@/lib/schema";
import { buildStepWebhookPayload } from "@/lib/webhook-payload";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseStepSubmit(body);

    if (!parsed.success) {
      const message =
        parsed.error.errors[0]?.message ?? "Ugyldige formulardata";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const input = parsed.data;
    const payload = buildStepWebhookPayload(input);

    const webhook = await sendLeadWebhook(payload);

    if (!webhook.ok) {
      console.error(
        `[Webhook] Step ${input.step} failed:`,
        webhook.status,
        webhook.body
      );
      if (input.step === 4) {
        return NextResponse.json(
          { error: "Kunne ikke sende henvendelsen. Prøv igen om lidt." },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        step: input.step,
        webhookSent: false,
      });
    }

    if (input.step === 4) {
      const { step: _s, ...lead } = input;
      const emailed = await notifyOwnerByEmail(lead as LeadPayload);
      if (!emailed) {
        console.warn("[Submit] Owner email failed on step 4");
      }
    }

    return NextResponse.json({
      success: true,
      step: input.step,
      webhookSent: true,
      event: payload.event,
    });
  } catch (error) {
    console.error("[Submit]", error);
    return NextResponse.json(
      { error: "Noget gik galt. Prøv igen." },
      { status: 500 }
    );
  }
}
