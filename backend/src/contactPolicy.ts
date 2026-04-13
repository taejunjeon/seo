/**
 * 발송 정책(contact policy) 판단 — Revenue crm_contact_policy_service.py 이식
 *
 * "이 고객에게 지금 메시지를 보내도 되는가?"를 판단한다.
 * 판단 기준: 수신 동의, 문구 검토, 야간시간, 쿨다운, 빈도 제한, 최근 구매/상담, 연락처 유무
 *
 * evaluateContactPolicy는 순수 함수다. evaluateForEnforcement는 실제 발송 차단을 위해 로컬 CRM DB를 조회한다.
 */

import { getCrmDb, getImwebMemberByMemberCode, getImwebMemberByPhone } from "./crmLocalDb";

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

export type EnforcementSeverity = "hard_legal" | "hard_policy" | "soft";

export type EnforcementBlockedReason = {
  code: "LH-1" | "LH-2" | "PH-1" | "PH-2" | "SO-1" | "SO-2" | "SO-3";
  severity: EnforcementSeverity;
  message: string;
};

export type ContactPolicyEnforcementInput = {
  channel: "alimtalk" | "aligo" | "sms" | "channeltalk";
  receiver?: string | null;
  memberCode?: string | null;
  templateCode?: string | null;
  templateType?: string | null;
  body?: string | null;
  source?: string | null;
  groupId?: string | null;
  batchSize?: number | null;
  adminOverride?: boolean;
  now?: Date;
};

export type ContactPolicyEnforcementResult = {
  policyVersion: string;
  eligible: boolean;
  adminOverride: boolean;
  isAdvertising: boolean;
  blockedReasons: EnforcementBlockedReason[];
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

function isQuietHoursAt(now: Date): boolean {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const hour = new Date(kstMs).getUTCHours();
  return hour >= QUIET_HOURS.startHour || hour < QUIET_HOURS.endHour;
}

function normalizePhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (digits.startsWith("82")) return `0${digits.slice(2)}`;
  return digits;
}

function normalizeTemplateType(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function isAdvertisingMessage(input: ContactPolicyEnforcementInput): boolean {
  const type = normalizeTemplateType(input.templateType);
  if (type === "BA") return false;
  if (type === "AD") return true;
  return true;
}

function getMemberForPolicy(input: ContactPolicyEnforcementInput) {
  const memberCode = String(input.memberCode ?? "").trim();
  if (memberCode) {
    const byCode = getImwebMemberByMemberCode(memberCode);
    if (byCode) return byCode;
  }

  const phone = normalizePhone(input.receiver);
  return phone ? getImwebMemberByPhone(phone) : undefined;
}

function hasLatestSmsRefusal(input: ContactPolicyEnforcementInput): boolean {
  const phone = normalizePhone(input.receiver);
  const member = getMemberForPolicy(input);
  const memberCode = String(input.memberCode ?? member?.member_code ?? "").trim();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (memberCode) {
    conditions.push("member_code = ?");
    params.push(memberCode);
  }
  if (phone) {
    conditions.push("REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), '-', ''), ' ', ''), '+82', '0') = ?");
    params.push(phone);
  }
  if (conditions.length === 0) return false;

  const row = getCrmDb().prepare(`
    SELECT new_value
    FROM crm_consent_change_log
    WHERE field = 'marketing_agree_sms'
      AND (${conditions.join(" OR ")})
    ORDER BY datetime(changed_at) DESC, changed_at DESC, id DESC
    LIMIT 1
  `).get(...params) as { new_value: string | null } | undefined;

  return String(row?.new_value ?? "").trim().toUpperCase() === "N";
}

function hasSmsConsent(input: ContactPolicyEnforcementInput): boolean {
  const member = getMemberForPolicy(input);
  return String(member?.marketing_agree_sms ?? "").trim().toUpperCase() === "Y";
}

function getGroupConsentRatio(groupId: string | null | undefined): number | null {
  const normalized = String(groupId ?? "").trim();
  if (!normalized) return null;
  const row = getCrmDb().prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN consent_sms = 1 THEN 1 ELSE 0 END) AS consented
    FROM crm_customer_group_members
    WHERE group_id = ?
  `).get(normalized) as { total: number; consented: number | null } | undefined;

  const total = Number(row?.total) || 0;
  if (total === 0) return null;
  return (Number(row?.consented) || 0) / total;
}

function hasSuccessfulDuplicateWithin24h(input: ContactPolicyEnforcementInput): boolean {
  const phone = normalizePhone(input.receiver);
  const templateCode = String(input.templateCode ?? "").trim();
  if (!phone || !templateCode) return false;
  const row = getCrmDb().prepare(`
    SELECT 1
    FROM crm_message_log
    WHERE customer_key = ?
      AND template_code = ?
      AND provider_status = 'success'
      AND sent_at >= datetime('now', '-24 hours')
    LIMIT 1
  `).get(phone, templateCode);
  return Boolean(row);
}

function hasUnfilledTemplatePlaceholders(body: string | null | undefined): boolean {
  return /#\{[^}]+\}/.test(String(body ?? ""));
}

export function evaluateForEnforcement(input: ContactPolicyEnforcementInput): ContactPolicyEnforcementResult {
  const blockedReasons: EnforcementBlockedReason[] = [];
  const now = input.now ?? new Date();
  const adminOverride = input.adminOverride === true;
  const isAdvertising = isAdvertisingMessage(input);

  if (isAdvertising && isQuietHoursAt(now)) {
    blockedReasons.push({
      code: "LH-1",
      severity: "hard_legal",
      message: "광고성 메시지는 21시~08시 발송 금지",
    });
  }

  if (hasLatestSmsRefusal(input)) {
    blockedReasons.push({
      code: "LH-2",
      severity: "hard_legal",
      message: "수신거부 최신 이력이 있어 발송할 수 없다",
    });
  }

  if (isAdvertising && !hasSmsConsent(input)) {
    blockedReasons.push({
      code: "PH-1",
      severity: "hard_policy",
      message: "SMS 마케팅 수신 동의가 확인되지 않은 광고성 발송",
    });
  }

  const groupConsentRatio = getGroupConsentRatio(input.groupId);
  if (isAdvertising && groupConsentRatio !== null && groupConsentRatio < 0.5) {
    blockedReasons.push({
      code: "PH-2",
      severity: "hard_policy",
      message: `그룹 SMS 동의율이 ${(groupConsentRatio * 100).toFixed(1)}%로 50% 미만`,
    });
  }

  if (hasSuccessfulDuplicateWithin24h(input)) {
    blockedReasons.push({
      code: "SO-1",
      severity: "soft",
      message: "최근 24시간 내 같은 수신자에게 같은 템플릿 성공 발송 이력이 있다",
    });
  }

  if (typeof input.batchSize === "number" && input.batchSize > 1000) {
    blockedReasons.push({
      code: "SO-2",
      severity: "soft",
      message: "1000명 초과 배치 발송",
    });
  }

  if (hasUnfilledTemplatePlaceholders(input.body)) {
    blockedReasons.push({
      code: "SO-3",
      severity: "soft",
      message: "템플릿에 채워지지 않은 #{변수} 플레이스홀더가 있다",
    });
  }

  const hasHardLegal = blockedReasons.some((reason) => reason.severity === "hard_legal");
  const hasHardPolicy = blockedReasons.some((reason) => reason.severity === "hard_policy");

  return {
    policyVersion: POLICY_VERSION,
    eligible: !hasHardLegal && (!hasHardPolicy || adminOverride),
    adminOverride,
    isAdvertising,
    blockedReasons,
    evaluatedAt: now.toISOString(),
  };
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
