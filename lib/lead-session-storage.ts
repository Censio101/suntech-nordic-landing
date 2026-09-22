import { stripPhoneDigits } from "./phone";

const LEAD_DATA_PREFIX = "suntech-landing-lead-data-";

/** Last saved lead fields — updated after each successful step 1–3 webhook, or step 1 draft. */
export type StoredLeadData = {
  leadId?: number;
  fbclid?: string;
  /** 0 = step 1 draft only; 1–3 = last webhook-confirmed step */
  lastCompletedStep: number;
  navn?: string;
  telefon?: string;
  email?: string;
  adresse?: string;
  postnummer?: string;
  by?: string;
  type?: "privat" | "erhverv";
  firmanavn?: string;
  kwh_forbrug?: string;
};

export function leadDataKey(sessionOrLeadId: number) {
  return `${LEAD_DATA_PREFIX}${sessionOrLeadId}`;
}

export function saveLeadData(sessionOrLeadId: number, data: StoredLeadData) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(leadDataKey(sessionOrLeadId), JSON.stringify(data));
}

export function loadLeadData(sessionOrLeadId: number): StoredLeadData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(leadDataKey(sessionOrLeadId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredLeadData;
  } catch {
    return null;
  }
}

/** Move draft storage to leadId after step 1 is submitted. */
export function migrateLeadData(fromSessionKey: number, toLeadId: number) {
  const existing =
    loadLeadData(fromSessionKey) ?? loadLeadData(toLeadId) ?? undefined;
  if (existing) {
    saveLeadData(toLeadId, { ...existing, leadId: toLeadId });
  }
  sessionStorage.removeItem(leadDataKey(fromSessionKey));
}

export function clearLeadData(sessionOrLeadId: number) {
  sessionStorage.removeItem(leadDataKey(sessionOrLeadId));
}

/** Save accumulated fields after a successful step 1–3 webhook. */
export function saveLeadDataFromWebhook(
  leadId: number,
  completedStep: 1 | 2 | 3,
  fields: Record<string, unknown>
) {
  saveLeadData(leadId, {
    leadId,
    lastCompletedStep: completedStep,
    fbclid: typeof fields.fbclid === "string" ? fields.fbclid : undefined,
    navn: typeof fields.navn === "string" ? fields.navn : undefined,
    telefon: typeof fields.telefon === "string" ? stripPhoneDigits(fields.telefon) : undefined,
    email: typeof fields.email === "string" ? fields.email : undefined,
    adresse: typeof fields.adresse === "string" ? fields.adresse : undefined,
    postnummer: typeof fields.postnummer === "string" ? fields.postnummer : undefined,
    by: typeof fields.by === "string" ? fields.by : undefined,
    type: fields.type === "privat" || fields.type === "erhverv" ? fields.type : undefined,
    firmanavn: typeof fields.firmanavn === "string" ? fields.firmanavn : undefined,
    kwh_forbrug: typeof fields.kwh_forbrug === "string" ? fields.kwh_forbrug : undefined,
  });
}

/** Save step 1 draft before the user clicks continue. */
export function saveLeadDraft(
  sessionKey: number,
  draft: { navn?: string; telefon?: string; email?: string },
  fbclid?: string
) {
  const prev = loadLeadData(sessionKey);
  saveLeadData(sessionKey, {
    ...prev,
    lastCompletedStep: 0,
    fbclid: fbclid ?? prev?.fbclid,
    navn: draft.navn ?? prev?.navn,
    telefon: draft.telefon ? stripPhoneDigits(draft.telefon) : prev?.telefon,
    email: draft.email ?? prev?.email,
  });
}
