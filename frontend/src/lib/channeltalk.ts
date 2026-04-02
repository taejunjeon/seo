/**
 * ChannelTalk SDK wrapper — Plugin Key 기반 v1 연동
 *
 * - boot: Plugin Key만으로 anonymous boot
 * - setPage: 페이지/탭 전환 시 호출
 * - track: 커스텀 이벤트 전송 (래퍼만 준비, 추후 이벤트 추가)
 * - updateUser: 사용자 프로필 업데이트 (추후 memberId/memberHash 연동 시 사용)
 * - shutdown: SDK 종료
 *
 * Member Hash는 아직 활성화하지 않는다.
 * 향후 memberId + memberHash를 boot에 넘기는 구조만 준비해둔다.
 */

/* ── ChannelIO global type ── */

interface ChannelIOBootOption {
  pluginKey: string;
  memberId?: string;
  memberHash?: string;
  profile?: Record<string, unknown>;
  language?: string;
  customLauncherSelector?: string;
  hideChannelButtonOnBoot?: boolean;
}

interface ChannelIOUserUpdate {
  language?: string;
  profile?: Record<string, unknown>;
  profileOnce?: Record<string, unknown>;
  tags?: string[];
  unsubscribeEmail?: boolean;
  unsubscribeTexting?: boolean;
}

type ChannelIOCommand =
  | ["boot", ChannelIOBootOption, ((...args: unknown[]) => void)?]
  | ["shutdown"]
  | ["setPage", string]
  | ["track", string, Record<string, unknown>?]
  | ["updateUser", ChannelIOUserUpdate, ((...args: unknown[]) => void)?]
  | ["showMessenger"]
  | ["hideMessenger"];

interface ChannelIOStatic {
  (...args: ChannelIOCommand[0] extends string ? ChannelIOCommand : never[]): void;
  (command: string, ...rest: unknown[]): void;
  q?: unknown[][];
  c?: (args: unknown[]) => void;
  getInstance?: () => { q: unknown[][]; c: (args: unknown[]) => void };
  modules?: Record<string, unknown>;
  instance?: { q: unknown[][]; c: (args: unknown[]) => void };
}

declare global {
  interface Window {
    ChannelIO?: ChannelIOStatic;
  }
}

/* ── 상태 ── */

let booted = false;
let scriptLoaded = false;

/* ── 내부: SDK 스크립트 로드 ── */

function ensureChannelIOStub(): void {
  if (typeof window === "undefined") return;
  if (window.ChannelIO) return;

  const ch = function (...args: unknown[]) {
    ch.c?.(args);
  } as unknown as ChannelIOStatic;

  const instance = { q: [] as unknown[][], c: (args: unknown[]) => instance.q.push(args) };
  ch.getInstance = () => instance;
  ch.modules = {};
  ch.c = instance.c;
  ch.q = instance.q;
  ch.instance = instance;

  window.ChannelIO = ch;
}

function loadScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="channel.io/plugin/ch.js"]');
    if (existing) {
      scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.channel.io/plugin/ch.js";
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("ChannelTalk SDK script failed to load"));
    document.head.appendChild(script);
  });
}

/* ── Public API ── */

/**
 * SDK 부트. Plugin Key 필수, memberId/memberHash는 선택.
 * Member Hash가 비활성 상태이므로 memberId/memberHash 없이도 정상 동작한다.
 */
export async function boot(options: {
  pluginKey: string;
  memberId?: string;
  memberHash?: string;
  profile?: Record<string, unknown>;
  hideChannelButtonOnBoot?: boolean;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (booted) return true;
  if (!options.pluginKey) {
    console.warn("[ChannelTalk] pluginKey가 없어 boot를 건너뜁니다.");
    return false;
  }

  try {
    ensureChannelIOStub();
    await loadScript();

    const bootOption: ChannelIOBootOption = {
      pluginKey: options.pluginKey,
    };

    // 향후 memberId/memberHash 연동 포인트
    if (options.memberId) {
      bootOption.memberId = options.memberId;
      if (options.memberHash) {
        bootOption.memberHash = options.memberHash;
      }
    }

    if (options.profile) {
      bootOption.profile = options.profile;
    }

    if (options.hideChannelButtonOnBoot !== undefined) {
      bootOption.hideChannelButtonOnBoot = options.hideChannelButtonOnBoot;
    }

    window.ChannelIO?.("boot", bootOption);
    booted = true;
    return true;
  } catch (err) {
    console.error("[ChannelTalk] boot 실패:", err);
    return false;
  }
}

/** SDK 종료 및 버튼 제거 */
export function shutdown(): void {
  if (typeof window === "undefined" || !booted) return;
  try {
    window.ChannelIO?.("shutdown");
  } catch {
    // 무시 — 앱 동작에 영향 없음
  }
  booted = false;
}

/** 현재 페이지 설정 (SPA route/tab 전환 시 호출) */
export function setPage(page: string): void {
  if (typeof window === "undefined" || !booted) return;
  try {
    window.ChannelIO?.("setPage", page);
  } catch {
    // 무시
  }
}

/**
 * 커스텀 이벤트 트래킹
 *
 * 추후 사용 예시:
 *   track("product_view", { productId: "abc", category: "skincare" })
 *   track("add_to_cart", { productId: "abc", price: 35000 })
 *   track("checkout_started")
 *   track("checkout_completed", { orderId: "ord_123", amount: 70000 })
 */
export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !booted) return;
  try {
    window.ChannelIO?.("track", eventName, properties);
  } catch {
    // 무시
  }
}

/**
 * 사용자 프로필 업데이트
 *
 * 향후 memberId 기반 식별 시 사용:
 *   updateUser({ profile: { name: "홍길동", email: "hong@example.com" } })
 */
export function updateUser(
  data: ChannelIOUserUpdate,
  callback?: (...args: unknown[]) => void,
): void {
  if (typeof window === "undefined" || !booted) return;
  try {
    window.ChannelIO?.("updateUser", data, callback);
  } catch {
    // 무시
  }
}

/** 메신저 표시 */
export function showMessenger(): void {
  if (typeof window === "undefined" || !booted) return;
  try {
    window.ChannelIO?.("showMessenger");
  } catch {
    // 무시
  }
}

/** 메신저 숨기기 */
export function hideMessenger(): void {
  if (typeof window === "undefined" || !booted) return;
  try {
    window.ChannelIO?.("hideMessenger");
  } catch {
    // 무시
  }
}

/** 현재 boot 상태 확인 */
export function isBooted(): boolean {
  return booted;
}

/* ── 페이지명 매핑 ── */

const TAB_PAGE_MAP: Record<string, string> = {
  "오버뷰": "overview",
  "칼럼": "column_analysis",
  "키워드": "keyword_analysis",
  "AI 보고서": "ai_report",
  "CWV": "core_web_vitals",
  "행동": "user_behavior",
  "진단": "diagnosis",
  "AI CRM": "crm",
  "솔루션": "solution_intro",
};

const PATHNAME_PAGE_MAP: Record<string, string> = {
  "/": "home",
};

/** pathname → 페이지명 변환 */
export function resolvePageName(pathname: string): string {
  return PATHNAME_PAGE_MAP[pathname] ?? (pathname.replace(/^\//, "").replace(/\//g, "_") || "home");
}

/** 탭 이름(한글) → ChannelTalk 페이지명 변환 */
export function resolveTabPageName(tabLabel: string): string {
  return TAB_PAGE_MAP[tabLabel] ?? tabLabel;
}
