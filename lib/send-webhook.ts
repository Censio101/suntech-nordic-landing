const DEFAULT_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/XTl96fVPBYqWgZdWkfFM/webhook-trigger/2bc7750f-d3a7-4db1-a16d-00bca04a9eb3";

export async function sendLeadWebhook(
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: string }> {
  const webhookUrl = process.env.LEADS_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  return { ok: response.ok, status: response.status, body };
}
