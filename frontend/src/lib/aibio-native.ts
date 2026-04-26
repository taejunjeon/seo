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

export const AIBIO_NATIVE_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

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
  marketingConsent: boolean;
  landingPath?: string;
  attribution?: AibioAttributionSnapshot;
  firstTouch?: AibioAttributionSnapshot;
  lastTouch?: AibioAttributionSnapshot;
};

export type AibioLeadDraftReceipt = {
  leadId: string;
  receivedAt: string;
  nextStatus: string;
  nextStatusLabel: string;
  duplicateOfLeadId: string | null;
  attributionKeys: string[];
};

export type AibioNativeLeadStatus =
  | "new"
  | "contact_attempted"
  | "contacted"
  | "reserved"
  | "visited"
  | "paid"
  | "no_show"
  | "invalid_duplicate";

export const AIBIO_NATIVE_STATUS_LABELS: Record<AibioNativeLeadStatus, string> = {
  new: "신규",
  contact_attempted: "연락시도",
  contacted: "연락완료",
  reserved: "예약완료",
  visited: "방문완료",
  paid: "결제완료",
  no_show: "노쇼",
  invalid_duplicate: "불량/중복",
};

export type AibioNativeLead = {
  leadId: string;
  status: AibioNativeLeadStatus;
  statusLabel: string;
  statusUpdatedAt: string;
  customerNameMasked: string;
  customerPhoneMasked: string;
  phoneHashSha256: string;
  ageRange: string;
  purpose: string;
  channel: string;
  preferredTime: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  landingPath: string;
  referrer: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
  adKeys: {
    fbclid: boolean;
    gclid: boolean;
    fbc: boolean;
    fbp: boolean;
    gaClientId: boolean;
  };
  attributionKeys: string[];
  isDuplicate: boolean;
  duplicateOfLeadId: string | null;
  assignedTo: string | null;
  operatorMemo: string | null;
  reservationAt: string | null;
  visitAt: string | null;
  paymentAmount: number | null;
  paymentAt: string | null;
  createdAt: string;
  updatedAt: string;
};
