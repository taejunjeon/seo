/**
 * 발송 정책(contact policy) 판단 — Revenue crm_contact_policy_service.py 이식
 *
 * "이 고객에게 지금 메시지를 보내도 되는가?"를 판단한다.
 * 판단 기준: 수신 동의, 문구 검토, 야간시간, 쿨다운, 빈도 제한, 최근 구매/상담, 연락처 유무
 *
 * 순수 함수 — DB를 직접 조회하지 않고, 호출하는 쪽이 고객 정보를 넘기면 결과를 반환한다.
 */

const POLICY_VERSION = "p1-s1b-v1-ts";
const TIMEZONE = "Asia/Seoul";
const QUIET_HOURS = { startHour: 21, endHour: 8 };
const COOLDOWN_HOURS: Record<string, number> = { channeltalk: 24, aligo: 24, sms: 24 };
const MAX_MESSAGES_7D: Record<string, number> = { channeltalk: 3, aligo: 2, sms: 2 };
const RECENT_PURCHASE_SUPPRESSION_DAYS = 7;
const RECENT_CONSULTATION_SUPPRESSION_DAYS = 2;
const ALLOWED_CONSENT = new Set(["opt_in", "granted", "marketing_opt_in", "subscribed"]);
const ALLOWED_CLAIM_REVIEW = new Set(["approved", "reviewed", "safe"]);
const FALLBACK: Record<string, string | null> = { channeltalk: "aligo", aligo: "sms", sms: null };

export type BlockedReason = {
  code: string;
  message: string;
  severity: "hard" | "warn";
};

export type ContactPolicyInput = {
  consentStatus?: string | null;
  claimReviewStatus?: string | null;
  recentMessageCount7d?: number | null;
  hoursSinceLastMessage?: number | null;
  daysSinceLastPurchase?: number | null;
  daysSinceLastConsultation?: number | null;
  suppressionUntil?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
};

export type ContactPolicyResult = {
  policyVersion: string;
  channel: string;
  eligible: boolean;
  adminOverride: boolean;
  blockedReasons: BlockedReason[];
  fallbackChannel: string | null;
  evaluatedAt: string;
};

function getKstHour(): number {
  const now = new Date();
  // KST = UTC+9
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).getUTCHours();
}

function isQuietHours(): boolean {
  const hour = getKstHour();
  return hour >= QUIET_HOURS.startHour || hour < QUIET_HOURS.endHour;
}

export function evaluateContactPolicy(
  candidate: ContactPolicyInput,
  channel: "channeltalk" | "aligo" | "sms",
  options?: { adminOverride?: boolean },
): ContactPolicyResult {
  const blocked: BlockedReason[] = [];
  const isAdmin = options?.adminOverride === true;

  // 1. 수신 동의 (최고관리자 override 가능)
  const consent = (candidate.consentStatus ?? "unknown").trim().toLowerCase();
  if (!ALLOWED_CONSENT.has(consent)) {
    if (isAdmin) {
      blocked.push({
        code: "consent_missing_overridden",
        message: `수신 동의 상태가 "${consent}"이지만 최고관리자 권한으로 강제 발송 허용됨`,
        severity: "warn" as BlockedReason["severity"],
      });
    } else {
      blocked.push({
        code: "consent_missing",
        message: `수신 동의 상태가 "${consent}"이라 발송할 수 없다. 필요: opt_in/granted/marketing_opt_in/subscribed`,
        severity: "hard",
      });
    }
  }

  // 2. 문구 검토 (최고관리자 override 가능)
  const claimReview = (candidate.claimReviewStatus ?? "unreviewed").trim().toLowerCase();
  if (!ALLOWED_CLAIM_REVIEW.has(claimReview)) {
    if (isAdmin) {
      blocked.push({
        code: "claim_review_missing_overridden",
        message: `문구 검토 상태가 "${claimReview}"이지만 최고관리자 권한으로 강제 발송 허용됨`,
        severity: "warn" as BlockedReason["severity"],
      });
    } else {
      blocked.push({
        code: "claim_review_missing",
        message: `문구 검토 상태가 "${claimReview}"이라 발송 문구가 확정되지 않았다`,
        severity: "hard",
      });
    }
  }

  // 3. 야간시간 (21시~08시 KST)
  if (isQuietHours()) {
    blocked.push({
      code: "quiet_hours",
      message: `현재 야간시간(${QUIET_HOURS.startHour}시~${QUIET_HOURS.endHour}시 KST)이라 발송하면 안 된다`,
      severity: "hard",
    });
  }

  // 4. 쿨다운 (같은 채널 24시간 내 재발송 금지)
  const cooldown = COOLDOWN_HOURS[channel] ?? 24;
  if (candidate.hoursSinceLastMessage != null && candidate.hoursSinceLastMessage < cooldown) {
    blocked.push({
      code: "cooldown_active",
      message: `최근 ${candidate.hoursSinceLastMessage.toFixed(1)}시간 전에 같은 채널로 보냈다. ${cooldown}시간 쿨다운 필요`,
      severity: "hard",
    });
  }

  // 5. 7일 빈도 제한
  const maxMsg = MAX_MESSAGES_7D[channel] ?? 2;
  if (candidate.recentMessageCount7d != null && candidate.recentMessageCount7d >= maxMsg) {
    blocked.push({
      code: "frequency_cap_7d",
      message: `최근 7일 메시지 ${candidate.recentMessageCount7d}건. 상한 ${maxMsg}건 초과`,
      severity: "hard",
    });
  }

  // 6. 최근 구매 suppression
  if (candidate.daysSinceLastPurchase != null && candidate.daysSinceLastPurchase < RECENT_PURCHASE_SUPPRESSION_DAYS) {
    blocked.push({
      code: "recent_purchase_suppression",
      message: `최근 구매 후 ${candidate.daysSinceLastPurchase}일. ${RECENT_PURCHASE_SUPPRESSION_DAYS}일 내 발송 금지`,
      severity: "hard",
    });
  }

  // 7. 최근 상담 suppression
  if (candidate.daysSinceLastConsultation != null && candidate.daysSinceLastConsultation < RECENT_CONSULTATION_SUPPRESSION_DAYS) {
    blocked.push({
      code: "recent_consultation_suppression",
      message: `최근 상담 후 ${candidate.daysSinceLastConsultation}일. ${RECENT_CONSULTATION_SUPPRESSION_DAYS}일 내 발송 금지`,
      severity: "hard",
    });
  }

  // 8. 연락처 확인 (알리고/SMS는 전화번호 필수)
  if ((channel === "aligo" || channel === "sms") && !candidate.customerPhone?.replace(/[^0-9]/g, "")) {
    blocked.push({
      code: "missing_phone",
      message: channel === "sms" ? "SMS는 전화번호가 필수인데 전화번호가 없다" : "알리고 알림톡은 전화번호가 필수인데 전화번호가 없다",
      severity: "hard",
    });
  }

  const hardBlocks = blocked.filter((b) => b.severity === "hard");

  return {
    policyVersion: POLICY_VERSION,
    channel,
    eligible: hardBlocks.length === 0,
    adminOverride: isAdmin,
    blockedReasons: blocked,
    fallbackChannel: FALLBACK[channel] ?? null,
    evaluatedAt: new Date().toISOString(),
  };
}

export function getContactPolicyContract() {
  return {
    version: POLICY_VERSION,
    timezone: TIMEZONE,
    quietHours: QUIET_HOURS,
    cooldownHours: COOLDOWN_HOURS,
    maxMessages7d: MAX_MESSAGES_7D,
    recentPurchaseSuppressionDays: RECENT_PURCHASE_SUPPRESSION_DAYS,
    recentConsultationSuppressionDays: RECENT_CONSULTATION_SUPPRESSION_DAYS,
    allowedConsentStatuses: [...ALLOWED_CONSENT].sort(),
    allowedClaimReviewStatuses: [...ALLOWED_CLAIM_REVIEW].sort(),
    fallback: FALLBACK,
  };
}
