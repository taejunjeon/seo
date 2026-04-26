import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(__dirname, "..", "data");
const CONTENT_STORE_PATH = path.join(DATA_DIR, "aibio-native-content.json");
const ACCESS_STORE_PATH = path.join(DATA_DIR, "aibio-native-access.json");
export const AIBIO_NATIVE_ASSET_DIR = path.join(DATA_DIR, "aibio-native-assets");

export const AIBIO_NATIVE_CONTENT_VERSION = "2026-04-26.aibio-native-content.v1";

export type AibioNativeOfferPoint = {
  label: string;
  title: string;
  body: string;
};

export type AibioNativeFlowStep = {
  step: string;
  title: string;
  body: string;
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
  offerPoints: AibioNativeOfferPoint[];
  flow: AibioNativeFlowStep[];
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

export type AibioAdminAccessStore = {
  version: string;
  updatedAt: string;
  updatedBy: string;
  operators: AibioAdminOperator[];
};

type ContentStore = {
  version: string;
  pages: Record<string, AibioNativePageContent>;
};

const nowIso = () => new Date().toISOString();

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

const DEFAULT_ACCESS: AibioAdminAccessStore = {
  version: AIBIO_NATIVE_CONTENT_VERSION,
  updatedAt: "2026-04-26T06:00:00.000Z",
  updatedBy: "system",
  operators: [
    { id: "owner-tj", name: "TJ", email: "owner@aibio.local", role: "owner", active: true },
    { id: "manager-team", name: "상담팀", email: "manager@aibio.local", role: "manager", active: true },
    { id: "designer-team", name: "디자인/콘텐츠", email: "designer@aibio.local", role: "designer", active: true },
  ],
};

const normalizeText = (value: unknown, fallback: string, max = 2000) => {
  const text = typeof value === "string" ? value.trim().slice(0, max) : "";
  return text || fallback;
};

const normalizeStatus = (value: unknown): AibioNativePageContent["status"] =>
  value === "published" || value === "review" || value === "draft" ? value : "draft";

const normalizeImageUrl = (value: unknown, fallback: string) => {
  const text = normalizeText(value, fallback, 2048);
  if (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("/api/aibio/assets/")) {
    return text;
  }
  return fallback;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const normalizeOfferPoints = (value: unknown, fallback: AibioNativeOfferPoint[]) => {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.slice(0, 6).map((row, index) => {
    const record = asRecord(row);
    const source = fallback[index] ?? fallback[0];
    return {
      label: normalizeText(record.label, source.label, 40),
      title: normalizeText(record.title, source.title, 120),
      body: normalizeText(record.body, source.body, 500),
    };
  });
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeFlow = (value: unknown, fallback: AibioNativeFlowStep[]) => {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.slice(0, 8).map((row, index) => {
    const record = asRecord(row);
    const source = fallback[index] ?? fallback[0];
    return {
      step: normalizeText(record.step, source.step, 12),
      title: normalizeText(record.title, source.title, 80),
      body: normalizeText(record.body, source.body, 400),
    };
  });
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeStrip = (value: unknown, fallback: Array<{ label: string; value: string }>) => {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.slice(0, 4).map((row, index) => {
    const record = asRecord(row);
    const source = fallback[index] ?? fallback[0];
    return {
      label: normalizeText(record.label, source.label, 40),
      value: normalizeText(record.value, source.value, 80),
    };
  });
  return normalized.length > 0 ? normalized : fallback;
};

export function sanitizeAibioPageContent(input: unknown, previous = DEFAULT_SHOP_VIEW_25_CONTENT): AibioNativePageContent {
  const raw = asRecord(input);
  const hero = asRecord(raw.hero);
  const program = asRecord(raw.program);
  const proof = asRecord(raw.proof);
  const form = asRecord(raw.form);

  return {
    slug: previous.slug,
    route: previous.route,
    status: normalizeStatus(raw.status),
    updatedAt: nowIso(),
    updatedBy: normalizeText(raw.updatedBy, "aibio-native-admin", 80),
    hero: {
      eyebrow: normalizeText(hero.eyebrow, previous.hero.eyebrow, 80),
      title: normalizeText(hero.title, previous.hero.title, 160),
      body: normalizeText(hero.body, previous.hero.body, 800),
      primaryCta: normalizeText(hero.primaryCta, previous.hero.primaryCta, 40),
      secondaryCta: normalizeText(hero.secondaryCta, previous.hero.secondaryCta, 40),
      imageUrl: normalizeImageUrl(hero.imageUrl, previous.hero.imageUrl),
    },
    strip: normalizeStrip(raw.strip, previous.strip),
    program: {
      eyebrow: normalizeText(program.eyebrow, previous.program.eyebrow, 80),
      title: normalizeText(program.title, previous.program.title, 160),
      body: normalizeText(program.body, previous.program.body, 900),
      imageUrl: normalizeImageUrl(program.imageUrl, previous.program.imageUrl),
    },
    offerPoints: normalizeOfferPoints(raw.offerPoints, previous.offerPoints),
    flow: normalizeFlow(raw.flow, previous.flow),
    proof: {
      eyebrow: normalizeText(proof.eyebrow, previous.proof.eyebrow, 80),
      title: normalizeText(proof.title, previous.proof.title, 160),
      body: normalizeText(proof.body, previous.proof.body, 900),
      imageUrl: normalizeImageUrl(proof.imageUrl, previous.proof.imageUrl),
    },
    form: {
      eyebrow: normalizeText(form.eyebrow, previous.form.eyebrow, 80),
      title: normalizeText(form.title, previous.form.title, 160),
      description: normalizeText(form.description, previous.form.description, 900),
      submitLabel: normalizeText(form.submitLabel, previous.form.submitLabel, 60),
    },
  };
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function getAibioPageContent(slug: string) {
  const store = await readJsonFile<ContentStore>(CONTENT_STORE_PATH, {
    version: AIBIO_NATIVE_CONTENT_VERSION,
    pages: {},
  });
  return store.pages[slug] ?? DEFAULT_SHOP_VIEW_25_CONTENT;
}

export async function saveAibioPageContent(slug: string, input: unknown) {
  const store = await readJsonFile<ContentStore>(CONTENT_STORE_PATH, {
    version: AIBIO_NATIVE_CONTENT_VERSION,
    pages: {},
  });
  const previous = store.pages[slug] ?? DEFAULT_SHOP_VIEW_25_CONTENT;
  const content = sanitizeAibioPageContent(input, previous);
  const nextStore: ContentStore = {
    version: AIBIO_NATIVE_CONTENT_VERSION,
    pages: {
      ...store.pages,
      [slug]: content,
    },
  };
  await writeJsonFile(CONTENT_STORE_PATH, nextStore);
  return content;
}

export async function getAibioAdminAccess() {
  return readJsonFile<AibioAdminAccessStore>(ACCESS_STORE_PATH, DEFAULT_ACCESS);
}

export async function saveAibioAdminAccess(input: unknown, updatedBy: string) {
  const raw = asRecord(input);
  const operatorsInput = Array.isArray(raw.operators) ? raw.operators : [];
  const operators = operatorsInput.slice(0, 30).map((operator) => {
    const record = asRecord(operator);
    const role = ["owner", "manager", "marketer", "designer", "viewer"].includes(String(record.role))
      ? String(record.role) as AibioAdminRole
      : "viewer";
    return {
      id: normalizeText(record.id, randomUUID(), 80),
      name: normalizeText(record.name, "이름 없음", 80),
      email: normalizeText(record.email, "", 160),
      role,
      active: record.active !== false,
    };
  }).filter((operator) => operator.email || operator.name !== "이름 없음");

  const next: AibioAdminAccessStore = {
    version: AIBIO_NATIVE_CONTENT_VERSION,
    updatedAt: nowIso(),
    updatedBy,
    operators: operators.length > 0 ? operators : DEFAULT_ACCESS.operators,
  };
  await writeJsonFile(ACCESS_STORE_PATH, next);
  return next;
}

export function safeAssetFilename(originalName: string, mimeType: string) {
  const extensionFromName = path.extname(originalName).toLowerCase();
  const extension = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extensionFromName)
    ? extensionFromName
    : mimeType === "image/png"
      ? ".png"
      : mimeType === "image/webp"
        ? ".webp"
        : ".jpg";
  return `${Date.now()}-${randomUUID()}${extension}`;
}

export function resolveAibioAssetPath(filename: string) {
  const basename = path.basename(filename);
  if (basename !== filename) return null;
  return path.join(AIBIO_NATIVE_ASSET_DIR, basename);
}
