import type { LeadPayload } from "./schema";

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value.trim().toLowerCase())
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function trackLead(data: {
  navn: string;
  email: string;
  telefon: string;
  by: string;
  postnummer: string;
  type: string;
}) {
  if (typeof window === "undefined" || !window.fbq) return;

  const phone = data.telefon.replace(/\s+/g, "").replace(/^\+45/, "");
  const [firstName, ...rest] = data.navn.trim().split(" ");
  const lastName = rest.join(" ");
  const [em, ph, fn, ln, ct, zp, co] = await Promise.all([
    sha256(data.email),
    sha256(phone),
    sha256(firstName),
    sha256(lastName),
    sha256(data.by.toLowerCase()),
    sha256(data.postnummer),
    sha256("dk"),
  ]);

  window.fbq(
    "track",
    "Lead",
    {
      content_name: "Batteri Funnel",
      content_category: data.type === "erhverv" ? "Erhverv" : "Privat",
      value: 1,
      currency: "DKK",
    },
    {
      eventID: `lead_${Date.now()}`,
      em,
      ph,
      fn,
      ln,
      ct,
      zp,
      country: co,
    }
  );
}

export type TrackLeadInput = Pick<
  LeadPayload,
  "navn" | "email" | "telefon" | "by" | "postnummer" | "type"
>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
