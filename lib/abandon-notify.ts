import {
  loadLeadData,
  type StoredLeadData,
} from "@/lib/lead-session-storage";

const OWNER_NOTIFY_KEY_PREFIX = "suntech-landing-owner-notified-";

export type OwnerNotifyStatus = "completing" | "completed" | "abandoned";

export function ownerNotifyKey(sessionKey: number) {
  return `${OWNER_NOTIFY_KEY_PREFIX}${sessionKey}`;
}

export function getOwnerNotifyStatus(sessionKey: number): OwnerNotifyStatus | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(ownerNotifyKey(sessionKey));
  if (value === "completing" || value === "completed" || value === "abandoned") {
    return value;
  }
  return null;
}

export function setOwnerNotifyStatus(sessionKey: number, status: OwnerNotifyStatus) {
  sessionStorage.setItem(ownerNotifyKey(sessionKey), status);
}

type ContactDraft = {
  navn?: string;
  telefon?: string;
  email?: string;
};

export type PartialNotifyFormState = {
  step: number;
  draftStep1?: ContactDraft;
  step1Data?: ContactDraft;
  step2Data?: { adresse: string; postnummer: string; by: string };
  step3Data?: { type: "privat" | "erhverv"; firmanavn?: string; kwh_forbrug?: string };
  leadId: number | null;
  fbclid?: string;
  isSubmitting: boolean;
  sessionKey: number;
};

export function buildPartialNotifyPayload(state: PartialNotifyFormState) {
  const notifyKey = state.leadId ?? state.sessionKey;
  const saved = loadLeadData(notifyKey) ?? loadLeadData(state.sessionKey);

  const contact = mergeContact(state, saved);
  const address = mergeAddress(state, saved);
  const typeInfo = mergeType(state, saved);

  return {
    reason: "abandoned" as const,
    ...(state.leadId ?? saved?.leadId
      ? { leadId: state.leadId ?? saved?.leadId }
      : {}),
    ...(state.fbclid ?? saved?.fbclid ? { fbclid: state.fbclid ?? saved?.fbclid } : {}),
    ...(contact.navn ? { navn: contact.navn } : {}),
    ...(contact.telefon ? { telefon: contact.telefon } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    currentStep: state.step,
    ...(address.adresse ? { adresse: address.adresse } : {}),
    ...(address.postnummer ? { postnummer: address.postnummer } : {}),
    ...(address.by ? { by: address.by } : {}),
    ...(typeInfo.type ? { type: typeInfo.type } : {}),
    ...(typeInfo.firmanavn ? { firmanavn: typeInfo.firmanavn } : {}),
    ...(typeInfo.kwh_forbrug ? { kwh_forbrug: typeInfo.kwh_forbrug } : {}),
  };
}

function mergeContact(state: PartialNotifyFormState, saved: StoredLeadData | null) {
  return {
    navn: state.step1Data?.navn ?? state.draftStep1?.navn ?? saved?.navn,
    telefon: state.step1Data?.telefon ?? state.draftStep1?.telefon ?? saved?.telefon,
    email: state.step1Data?.email ?? state.draftStep1?.email ?? saved?.email,
  };
}

function mergeAddress(state: PartialNotifyFormState, saved: StoredLeadData | null) {
  return {
    adresse: state.step2Data?.adresse ?? saved?.adresse,
    postnummer: state.step2Data?.postnummer ?? saved?.postnummer,
    by: state.step2Data?.by ?? saved?.by,
  };
}

function mergeType(state: PartialNotifyFormState, saved: StoredLeadData | null) {
  return {
    type: state.step3Data?.type ?? saved?.type,
    firmanavn: state.step3Data?.firmanavn ?? saved?.firmanavn,
    kwh_forbrug: state.step3Data?.kwh_forbrug ?? saved?.kwh_forbrug,
  };
}

export function hasNotifiableContactData(payload: Record<string, unknown>) {
  const navn = typeof payload.navn === "string" ? payload.navn.trim() : "";
  const telefon = typeof payload.telefon === "string" ? payload.telefon.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  return navn.length >= 2 || telefon.length >= 8 || email.includes("@");
}

function shouldSkipPartialNotify(state: PartialNotifyFormState): boolean {
  if (state.step >= 5 || state.isSubmitting) return true;

  const notifyKey = state.leadId ?? state.sessionKey;
  const status = getOwnerNotifyStatus(notifyKey);
  return status === "completing" || status === "completed" || status === "abandoned";
}

/** Send partial owner email when the user closes the tab or browser. */
export function attemptPartialNotifyOnUnload(state: PartialNotifyFormState): boolean {
  if (shouldSkipPartialNotify(state)) return false;

  const notifyKey = state.leadId ?? state.sessionKey;
  const payload = buildPartialNotifyPayload(state);
  if (!hasNotifiableContactData(payload)) return false;

  if (typeof fetch === "undefined") return false;

  fetch("/api/notify-abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then(async (res) => {
      if (!res.ok) return;
      const json = (await res.json()) as { ok?: boolean };
      if (json.ok) setOwnerNotifyStatus(notifyKey, "abandoned");
    })
    .catch(() => {});

  return true;
}
