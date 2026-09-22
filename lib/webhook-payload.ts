import type { StepSubmitInput } from "./schema";

/**
 * SunTech / GHL webhook field names — do not rename existing keys
 * (current automations map them). hasSolar and hasHeatPump are new extras.
 */
export const MANUS_WEBHOOK_FIELD_NAMES = [
  "leadId",
  "navn",
  "telefon",
  "email",
  "fbclid",
  "adresse",
  "postnummer",
  "by",
  "type",
  "firmanavn",
  "kwh_forbrug",
  "har_elbil",
  "hasSolar",
  "hasHeatPump",
  "event",
  "step",
  "completed",
  "dateCreated",
  "submittedAt",
  "source",
] as const;

function webhookTimestamps(step: StepSubmitInput["step"]) {
  return {
    dateCreated: new Date().toLocaleString("da-DK", {
      timeZone: "Europe/Copenhagen",
    }),
    submittedAt: new Date().toISOString(),
    source:
      step === 4
        ? ("suntech-battery-funnel" as const)
        : ("suntech-funnel-partial-submission" as const),
  };
}

export function buildStepWebhookPayload(input: StepSubmitInput) {
  const step = input.step;
  const { step: _step, leadId, fbclid, ...fields } = input;

  return {
    leadId,
    ...fields,
    ...(fbclid ? { fbclid } : {}),
    event: step === 1 ? "lead_created" : "lead_updated",
    step,
    completed: step === 4,
    ...webhookTimestamps(step),
  };
}
