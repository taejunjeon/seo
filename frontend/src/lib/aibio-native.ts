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
  contact_attempted: "연락중",
  contacted: "상담완료",
  reserved: "예약확정",
  visited: "방문완료",
  paid: "결제완료",
  no_show: "노쇼",
  invalid_duplicate: "제외",
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

export type AibioNativePageContent = {
  slug: string;
  route: string;
  status: "draft" | "review" | "published";
  updatedAt: string;
  updatedBy: string;
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    imageUrl: string;
  };
  strip: Array<{ label: string; value: string }>;
  program: {
    eyebrow: string;
    title: string;
    body: string;
    imageUrl: string;
  };
  offerPoints: Array<{ label: string; title: string; body: string }>;
  flow: Array<{ step: string; title: string; body: string }>;
  proof: {
    eyebrow: string;
    title: string;
    body: string;
    imageUrl: string;
  };
  form: {
    eyebrow: string;
    title: string;
    description: string;
    submitLabel: string;
  };
};

export type AibioAdminRole = "owner" | "manager" | "marketer" | "designer" | "viewer";

export type AibioAdminOperator = {
  id: string;
  name: string;
  email: string;
  role: AibioAdminRole;
  active: boolean;
};

export const DEFAULT_SHOP_VIEW_25_CONTENT: AibioNativePageContent = {
  slug: "shop-view-25",
  route: "/shop_view?idx=25",
  status: "draft",
  updatedAt: "2026-04-26T06:00:00.000Z",
  updatedBy: "system",
  hero: {
    eyebrow: "AIBIO Recovery Lab Offer",
    title: "붓기와 식욕 리듬을 먼저 확인하는 첫방문 체험 상담",
    body: "아임웹 /shop_view?idx=25에서 유입되던 리커버리랩 체험 성격의 랜딩을 자체 폼으로 옮기는 1차 실험입니다. 상담 신청은 AIBIO 자체 리드 원장에 저장됩니다.",
    primaryCta: "첫방문 상담 신청",
    secondaryCta: "카카오 상담",
    imageUrl: "https://cdn.imweb.me/thumbnail/20250124/e96dc62d45b13.jpg",
  },
  strip: [
    { label: "핵심 CTA", value: "상담 신청" },
    { label: "저장 위치", value: "Native Lead Ledger" },
    { label: "광고키", value: "UTM · fbclid · gclid" },
  ],
  program: {
    eyebrow: "Program",
    title: "방문 전부터 상담 목적을 분명히 잡습니다.",
    body: "AIBIO 센터는 단순 상품 주문보다 상담 연결과 방문 예약이 중요합니다. 그래서 이 랜딩은 체험권 판매보다 리드 품질과 방문 가능성 기록에 초점을 둡니다.",
    imageUrl: "https://cdn.imweb.me/thumbnail/20250124/340d5a869a6b2.jpg",
  },
  offerPoints: [
    {
      label: "첫 방문",
      title: "대사 리듬 상담",
      body: "생활 패턴, 붓기, 식욕, 수면 상태를 함께 보고 방문 상담의 방향을 정합니다.",
    },
    {
      label: "센터 체험",
      title: "리커버리 장비 안내",
      body: "방문 전 상담 목적을 남기면 운영팀이 적합한 체험 순서를 안내합니다.",
    },
    {
      label: "운영 원장",
      title: "상담 상태 추적",
      body: "광고 유입부터 상담 신청, 예약, 방문 가능성까지 자체 리드 원장에 남깁니다.",
    },
  ],
  flow: [
    { step: "01", title: "신청", body: "이름, 연락처, 관심 목적을 남깁니다." },
    { step: "02", title: "상담", body: "운영팀이 연락 가능 시간에 맞춰 상담합니다." },
    { step: "03", title: "예약", body: "방문 시간과 체험 구성을 확정합니다." },
    { step: "04", title: "방문", body: "센터에서 상담 결과와 다음 단계를 기록합니다." },
  ],
  proof: {
    eyebrow: "Measurement",
    title: "이번 route의 목표는 예쁜 페이지가 아니라 리드와 유입의 연결입니다.",
    body: "제출 시점의 landing path, referrer, UTM, fbclid, gclid, _fbc, _fbp, _ga를 함께 저장합니다. 운영자는 이후 연락중, 예약확정, 방문완료, 결제완료 상태를 같은 원장에 남길 수 있습니다.",
    imageUrl: "https://cdn.imweb.me/thumbnail/20250124/1312356faa028.jpg",
  },
  form: {
    eyebrow: "First Visit Lead",
    title: "첫방문 체험 상담을 신청합니다.",
    description: "제출한 정보는 AIBIO 자체 리드 원장에 저장됩니다. 운영자는 이 기록으로 연락 상태, 예약 여부, 방문 여부를 이어서 관리합니다.",
    submitLabel: "첫방문 상담 신청 저장",
  },
};
