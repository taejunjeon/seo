const SYNTHETIC_GOOGLE_CLICK_ID_PATTERN =
  /(?:^|[_-])(TEST|SMOKE|PREVIEW|DUMMY|SAMPLE|DEBUG|CODEX|GTM)(?:[_-]|$)/i;

const SYNTHETIC_GOOGLE_CLICK_ID_PREFIX_PATTERN =
  /^(TEST|SMOKE|PREVIEW|DUMMY|SAMPLE|DEBUG|CODEX)(?:[_-]|$)/i;

export const normalizeGoogleClickId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const isLikelySyntheticGoogleClickId = (value: unknown): boolean => {
  const normalized = normalizeGoogleClickId(value);
  if (!normalized) return false;

  return (
    SYNTHETIC_GOOGLE_CLICK_ID_PATTERN.test(normalized)
    || SYNTHETIC_GOOGLE_CLICK_ID_PREFIX_PATTERN.test(normalized)
  );
};

export const sanitizeGoogleClickIdForStorage = (value: unknown): string => {
  const normalized = normalizeGoogleClickId(value);
  return isLikelySyntheticGoogleClickId(normalized) ? "" : normalized;
};

export const hasSyntheticGoogleClickId = (...values: unknown[]): boolean =>
  values.some((value) => isLikelySyntheticGoogleClickId(value));
