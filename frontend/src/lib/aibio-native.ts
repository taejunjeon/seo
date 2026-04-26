export const AIBIO_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "fbc",
  "fbp",
  "ga_client_id",
  "landing_path",
  "referrer",
  "capturedAt",
] as const;

export type AibioAttributionKey = (typeof AIBIO_ATTRIBUTION_KEYS)[number];

export type AibioAttributionSnapshot = Partial<Record<AibioAttributionKey, string>>;

export type AibioLeadDraft = {
  name: string;
  phone: string;
  ageRange: string;
  purpose: string;
  channel: string;
  preferredTime: string;
  consent: boolean;
  landingPath?: string;
  attribution?: AibioAttributionSnapshot;
};

export type AibioLeadDraftReceipt = {
  leadId: string;
  receivedAt: string;
  nextStatus: string;
  attributionKeys: string[];
};
