export const normalizePhoneDigits = (value: unknown): string => {
  if (typeof value !== "string") return "";
  let digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("82") && digits.length >= 11 && digits.length <= 12) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
};

export const normalizeOrderIdBase = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/(?:-|_)(?:p|pay)\d+$/i, "");
};
