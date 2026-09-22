import { z } from "zod";
import { stripPhoneDigits } from "./phone";

const telefonField = z
  .string()
  .min(1, "Telefonnummer er påkrævet")
  .transform(stripPhoneDigits)
  .refine((v) => v.length === 8, "Telefonnummer skal være 8 cifre");

const jaNej = z.enum(["Ja", "Nej"]);

const contactFields = {
  navn: z.string().min(2, "Navn skal være mindst 2 tegn"),
  telefon: telefonField,
  email: z.string().email("Ugyldig e-mailadresse"),
};

const addressFields = {
  adresse: z.string().min(3, "Adresse er påkrævet"),
  postnummer: z
    .string()
    .min(4, "Postnummer er ugyldigt")
    .max(4, "Postnummer er ugyldigt")
    .regex(/^\d{4}$/, "Postnummer skal være 4 cifre"),
  by: z.string().min(2, "By er påkrævet"),
};

const typeFields = {
  type: z.enum(["privat", "erhverv"]),
  firmanavn: z.string().optional(),
};

const consumptionFields = {
  kwh_forbrug: z
    .string()
    .min(1, "Angiv dit forbrug eller 'ved ikke'")
    .refine((v) => v === "ved ikke" || /^\d+$/.test(v.trim()), {
      message: "Angiv et tal (kWh) eller 'ved ikke'",
    }),
};

const featureFields = {
  har_elbil: jaNej,
  hasSolar: jaNej,
  hasHeatPump: jaNej,
};

function requireFirmanavnForErhverv(data: { type?: string; firmanavn?: string }) {
  if (
    data.type === "erhverv" &&
    (!data.firmanavn || data.firmanavn.trim().length === 0)
  ) {
    return false;
  }
  return true;
}

const webhookMetaFields = {
  leadId: z.number().int().positive(),
  fbclid: z.string().optional(),
};

export const step1SubmitSchema = z.object({
  step: z.literal(1),
  ...webhookMetaFields,
  ...contactFields,
});

export const step2SubmitSchema = z.object({
  step: z.literal(2),
  ...webhookMetaFields,
  ...contactFields,
  ...addressFields,
});

export const step3SubmitSchema = z
  .object({
    step: z.literal(3),
    ...webhookMetaFields,
    ...contactFields,
    ...addressFields,
    ...typeFields,
    ...consumptionFields,
  })
  .refine(requireFirmanavnForErhverv, {
    message: "Firmanavn er påkrævet for erhvervskunder",
    path: ["firmanavn"],
  });

export const step4SubmitSchema = z
  .object({
    step: z.literal(4),
    ...webhookMetaFields,
    ...contactFields,
    ...addressFields,
    ...typeFields,
    ...consumptionFields,
    ...featureFields,
  })
  .refine(requireFirmanavnForErhverv, {
    message: "Firmanavn er påkrævet for erhvervskunder",
    path: ["firmanavn"],
  });

const stepSchemas = {
  1: step1SubmitSchema,
  2: step2SubmitSchema,
  3: step3SubmitSchema,
  4: step4SubmitSchema,
} as const;

export function parseStepSubmit(body: unknown) {
  const stepValue =
    typeof body === "object" && body !== null && "step" in body
      ? (body as { step: unknown }).step
      : undefined;

  if (stepValue !== 1 && stepValue !== 2 && stepValue !== 3 && stepValue !== 4) {
    return step1SubmitSchema.safeParse(body);
  }

  return stepSchemas[stepValue].safeParse(body);
}

export type Step1Input = z.infer<typeof step1SubmitSchema>;
export type Step2Input = z.infer<typeof step2SubmitSchema>;
export type Step3Input = z.infer<typeof step3SubmitSchema>;
export type Step4Input = z.infer<typeof step4SubmitSchema>;
export type StepSubmitInput = Step1Input | Step2Input | Step3Input | Step4Input;

export type LeadPayload = Omit<Step4Input, "step">;

/** Partial lead data when the user leaves before completing. */
export const abandonNotifySchema = z
  .object({
    leadId: z.number().int().positive().optional(),
    fbclid: z.string().optional(),
    navn: z.string().optional(),
    telefon: z.string().optional(),
    email: z.string().email().optional(),
    currentStep: z.number().int().min(1).max(4),
    reason: z.literal("abandoned").optional(),
    completed: z.boolean().optional(),
    adresse: z.string().optional(),
    postnummer: z.string().optional(),
    by: z.string().optional(),
    type: z.enum(["privat", "erhverv"]).optional(),
    firmanavn: z.string().optional(),
    kwh_forbrug: z.string().optional(),
    har_elbil: jaNej.optional(),
    hasSolar: jaNej.optional(),
    hasHeatPump: jaNej.optional(),
  })
  .refine(
    (data) =>
      (data.navn && data.navn.trim().length >= 2) ||
      !!data.email ||
      (data.telefon && data.telefon.trim().length >= 8),
    { message: "Mindst navn, e-mail eller telefon er påkrævet" }
  );

export type AbandonNotifyInput = z.infer<typeof abandonNotifySchema>;
