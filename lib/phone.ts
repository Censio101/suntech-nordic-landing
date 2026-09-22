const MAX_DK_PHONE_DIGITS = 8;

/** Digits only, max 8 (Danish mobile/local number without country code). */
export function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, MAX_DK_PHONE_DIGITS);
}

/** Display as "12 34 56 78" — space after every 2 digits. */
export function formatPhoneDisplay(value: string): string {
  const digits = stripPhoneDigits(value);
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export function normalizePhoneForWebhook(value: string): string {
  return stripPhoneDigits(value);
}

export function isValidDanishPhone(value: string): boolean {
  return stripPhoneDigits(value).length === MAX_DK_PHONE_DIGITS;
}
