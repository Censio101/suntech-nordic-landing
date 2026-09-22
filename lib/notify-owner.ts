import type { AbandonNotifyInput, LeadPayload } from "./schema";

/** Censio Mailgun — fixed; only API key + recipient are env vars */
const MAILGUN_FROM = "kontakt@censio.dk";
const MAILGUN_DOMAIN = "censio.dk";
const MAILGUN_API_BASE = "https://api.eu.mailgun.net";

const EMAIL_INTRO = "Du har modtaget et nyt marketing lead:";
const EMAIL_OUTRO = "Mvh\nCensio lead system";

type LeadEmailFields = {
  navn?: string;
  telefon?: string;
  email?: string;
  adresse?: string;
  postnummer?: string;
  by?: string;
  type?: "privat" | "erhverv";
  firmanavn?: string;
  kwh_forbrug?: string;
  har_elbil?: "Ja" | "Nej";
  hasSolar?: "Ja" | "Nej";
  hasHeatPump?: "Ja" | "Nej";
};

function fieldLine(label: string, value?: string) {
  return `${label}: ${value ?? ""}`;
}

function formatAdresse(adresse?: string, postnummer?: string, by?: string) {
  const parts = [adresse, postnummer, by].filter(Boolean);
  return parts.length ? parts.join(", ") : "";
}

function formatKundetype(type?: "privat" | "erhverv", firmanavn?: string) {
  if (!type) return "";
  const typeLabel = type === "erhverv" ? "Erhverv" : "Privat";
  return type === "erhverv" && firmanavn ? `${typeLabel} (${firmanavn})` : typeLabel;
}

/** Same field list for full and partial emails — empty string when data is missing. */
export function buildLeadFieldBlock(fields: LeadEmailFields) {
  return [
    fieldLine("Navn", fields.navn),
    fieldLine("Telefon", fields.telefon),
    fieldLine("Email", fields.email),
    fieldLine("Adresse", formatAdresse(fields.adresse, fields.postnummer, fields.by)),
    fieldLine("Kundetype", formatKundetype(fields.type, fields.firmanavn)),
    fieldLine("kWh-forbrug", fields.kwh_forbrug),
    fieldLine("Elbil", fields.har_elbil),
    fieldLine("Solceller", fields.hasSolar),
    fieldLine("Varmepumpe", fields.hasHeatPump),
  ].join("\n");
}

function wrapOwnerEmailBody(body: string) {
  return `${EMAIL_INTRO}\n\n${body}\n\n${EMAIL_OUTRO}`;
}

function displayNameFromFields(fields: LeadEmailFields) {
  if (fields.navn && fields.navn.trim().length >= 2) return fields.navn.trim();
  if (fields.email) return fields.email;
  if (fields.telefon) return fields.telefon;
  return "Ukendt";
}

/** Mailgun `h:Reply-To` so the owner replies to the lead, not kontakt@censio.dk. */
function formatReplyTo(email?: string, name?: string): string | undefined {
  const trimmed = email?.trim();
  if (!trimmed || !trimmed.includes("@")) return undefined;
  const displayName = name?.trim();
  if (displayName && displayName.length >= 2) {
    return `${displayName} <${trimmed}>`;
  }
  return trimmed;
}

export function buildOwnerNotification(input: LeadPayload) {
  const title = `Nyt batteri-lead: ${input.navn}`;
  const body = buildLeadFieldBlock(input);
  return { title, content: wrapOwnerEmailBody(body) };
}

export function buildAbandonedOwnerNotification(input: AbandonNotifyInput) {
  const displayName = displayNameFromFields(input);

  const statusLine = `Ufuldstændigt lead — brugeren forlod formularen (trin ${input.currentStep} af 4).`;

  const body = `${statusLine}\n\n${buildLeadFieldBlock(input)}`;

  return {
    title: `Nyt batteri-lead: ${displayName}`,
    content: wrapOwnerEmailBody(body),
  };
}

async function sendMailgunEmail(
  subject: string,
  text: string,
  replyTo?: string
): Promise<boolean> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const to = process.env.OWNER_NOTIFICATION_EMAIL;

  if (!apiKey || !to) {
    console.warn(
      "[Notification] Mailgun skipped — set MAILGUN_API_KEY and OWNER_NOTIFICATION_EMAIL in Vercel"
    );
    return false;
  }

  const body = new URLSearchParams({
    from: `Suntech Nordic Funnel Page <${MAILGUN_FROM}>`,
    to,
    subject,
    text,
  });

  if (replyTo) {
    body.set("h:Reply-To", replyTo);
  }

  try {
    const response = await fetch(
      `${MAILGUN_API_BASE}/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Mailgun failed (${response.status}): ${detail}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Mailgun error:", error);
    return false;
  }
}

/** Sends owner notification via Mailgun when the funnel is fully completed. */
export async function notifyOwnerByEmail(input: LeadPayload): Promise<boolean> {
  const { title, content } = buildOwnerNotification(input);
  return sendMailgunEmail(title, content, formatReplyTo(input.email, input.navn));
}

/** Sends owner notification when the user leaves before completing the funnel. */
export async function notifyOwnerAbandoned(
  input: AbandonNotifyInput
): Promise<boolean> {
  const { title, content } = buildAbandonedOwnerNotification(input);
  return sendMailgunEmail(title, content, formatReplyTo(input.email, input.navn));
}
