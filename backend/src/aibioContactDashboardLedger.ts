import { randomUUID } from "node:crypto";

import { getCrmDb } from "./crmLocalDb";
import {
  AIBIO_NATIVE_STATUS_LABELS,
  type AibioNativeLeadStatus,
  initAibioNativeLeadTables,
} from "./aibioNativeLeadLedger";

export const AIBIO_CONTACT_DASHBOARD_VERSION = "2026-04-27.aibio-contact-dashboard.v1";

export const CONTACT_CHANNELS = ["phone", "sms", "kakao", "channeltalk", "manual"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_DIRECTIONS = ["outbound", "inbound"] as const;
export type ContactDirection = (typeof CONTACT_DIRECTIONS)[number];

export const CONTACT_OUTCOMES = [
  "connected",
  "no_answer",
  "busy",
  "wrong_number",
  "rejected",
  "requested_callback",
  "reserved",
  "invalid",
] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

export const CONTACT_REACTIONS = [
  "interested",
  "needs_price",
  "needs_schedule",
  "skeptical",
  "no_budget",
  "no_time",
  "wants_visit",
  "not_interested",
  "no_response",
] as const;
export type ContactReaction = (typeof CONTACT_REACTIONS)[number];

export const CONTACT_TEMPERATURES = ["hot", "warm", "cold", "invalid"] as const;
export type ContactTemperature = (typeof CONTACT_TEMPERATURES)[number];

export const NEXT_ACTIONS = [
  "call_again",
  "send_kakao",
  "schedule_visit",
  "wait_customer",
  "exclude",
  "assign_manager",
] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

export const CONTACT_OUTCOME_LABELS: Record<ContactOutcome, string> = {
  connected: "연결됨",
  no_answer: "부재",
  busy: "통화중",
  wrong_number: "잘못된 번호",
  rejected: "거절",
  requested_callback: "재연락 요청",
  reserved: "예약 잡음",
  invalid: "제외",
};

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  phone: "전화",
  sms: "문자",
  kakao: "카카오",
  channeltalk: "채널톡",
  manual: "기타",
};

export const CONTACT_REACTION_LABELS: Record<ContactReaction, string> = {
  interested: "관심 있음",
  needs_price: "가격 문의",
  needs_schedule: "일정 문의",
  skeptical: "고민 중",
  no_budget: "예산 부담",
  no_time: "시간 부족",
  wants_visit: "방문 희망",
  not_interested: "관심 낮음",
  no_response: "응답 없음",
};

export const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  call_again: "재전화",
  send_kakao: "카톡 발송",
  schedule_visit: "방문 예약",
  wait_customer: "고객 응답 대기",
  exclude: "제외 처리",
  assign_manager: "관리자 배정",
};

const CHANNEL_SET = new Set<string>(CONTACT_CHANNELS);
const DIRECTION_SET = new Set<string>(CONTACT_DIRECTIONS);
const OUTCOME_SET = new Set<string>(CONTACT_OUTCOMES);
const REACTION_SET = new Set<string>(CONTACT_REACTIONS);
const TEMPERATURE_SET = new Set<string>(CONTACT_TEMPERATURES);
const NEXT_ACTION_SET = new Set<string>(NEXT_ACTIONS);

export type ContactEventInput = {
  occurredAt?: unknown;
  operatorId?: unknown;
  channel?: unknown;
  direction?: unknown;
  outcome?: unknown;
  customerReaction?: unknown;
  customerTemperature?: unknown;
  note?: unknown;
  nextAction?: unknown;
  nextActionAt?: unknown;
  reservationAt?: unknown;
  excludedReason?: unknown;
};

export type ContactEventPublic = {
  eventId: string;
  leadId: string;
  occurredAt: string;
  operatorId: string;
  channel: ContactChannel;
  channelLabel: string;
  direction: ContactDirection;
  attemptNo: number;
  outcome: ContactOutcome;
  outcomeLabel: string;
  customerReaction: ContactReaction | null;
  customerReactionLabel: string | null;
  customerTemperature: ContactTemperature | null;
  note: string;
  nextAction: NextAction | null;
  nextActionLabel: string | null;
  nextActionAt: string | null;
  reservationAt: string | null;
  excludedReason: string | null;
  createdAt: string;
};

export type ContactTaskInput = {
  ownerId?: unknown;
  taskType?: unknown;
  dueAt?: unknown;
  reason?: unknown;
};

export type ContactTaskPublic = {
  taskId: string;
  leadId: string;
  ownerId: string;
  taskType: NextAction;
  dueAt: string;
  status: "open" | "done" | "snoozed" | "canceled";
  completedAt: string | null;
  reason: string;
  createdAt: string;
};

export type ContactAuditLogPublic = {
  auditId: string;
  operatorId: string;
  action: string;
  leadId: string | null;
  targetField: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeText = (value: unknown, max = 512) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const parseIsoDate = (value: unknown) => {
  const text = normalizeText(value, 64);
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const validateEnum = <T extends string>(set: Set<string>, value: unknown, name: string, optional = false): T | null => {
  const text = normalizeText(value, 64);
  if (!text) {
    if (optional) return null;
    const error = new Error(`missing_${name}`);
    Object.assign(error, { statusCode: 422 });
    throw error;
  }
  if (!set.has(text)) {
    const error = new Error(`invalid_${name}:${text}`);
    Object.assign(error, { statusCode: 422 });
    throw error;
  }
  return text as T;
};

export function initAibioContactDashboardTables() {
  const db = initAibioNativeLeadTables();
  db.exec(`
    CREATE TABLE IF NOT EXISTS aibio_contact_events (
      event_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES aibio_native_leads(lead_id),
      occurred_at TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      direction TEXT NOT NULL,
      attempt_no INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      customer_reaction TEXT,
      customer_temperature TEXT,
      note TEXT NOT NULL DEFAULT '',
      next_action TEXT,
      next_action_at TEXT,
      reservation_at TEXT,
      excluded_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_aibio_contact_events_lead ON aibio_contact_events(lead_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_aibio_contact_events_outcome ON aibio_contact_events(outcome, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_aibio_contact_events_operator ON aibio_contact_events(operator_id, occurred_at);

    CREATE TABLE IF NOT EXISTS aibio_contact_tasks (
      task_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES aibio_native_leads(lead_id),
      owner_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      completed_at TEXT,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_aibio_contact_tasks_owner ON aibio_contact_tasks(owner_id, due_at, status);
    CREATE INDEX IF NOT EXISTS idx_aibio_contact_tasks_lead ON aibio_contact_tasks(lead_id, status);

    CREATE TABLE IF NOT EXISTS aibio_contact_audit_log (
      audit_id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      lead_id TEXT,
      target_field TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_aibio_contact_audit_lead ON aibio_contact_audit_log(lead_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_aibio_contact_audit_operator ON aibio_contact_audit_log(operator_id, created_at);
  `);
  return db;
}

type RawEventRow = {
  event_id: string;
  lead_id: string;
  occurred_at: string;
  operator_id: string;
  channel: ContactChannel;
  direction: ContactDirection;
  attempt_no: number;
  outcome: ContactOutcome;
  customer_reaction: ContactReaction | null;
  customer_temperature: ContactTemperature | null;
  note: string;
  next_action: NextAction | null;
  next_action_at: string | null;
  reservation_at: string | null;
  excluded_reason: string | null;
  created_at: string;
};

type RawTaskRow = {
  task_id: string;
  lead_id: string;
  owner_id: string;
  task_type: NextAction;
  due_at: string;
  status: "open" | "done" | "snoozed" | "canceled";
  completed_at: string | null;
  reason: string;
  created_at: string;
};

type RawAuditRow = {
  audit_id: string;
  operator_id: string;
  action: string;
  lead_id: string | null;
  target_field: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const eventToPublic = (row: RawEventRow): ContactEventPublic => ({
  eventId: row.event_id,
  leadId: row.lead_id,
  occurredAt: row.occurred_at,
  operatorId: row.operator_id,
  channel: row.channel,
  channelLabel: CONTACT_CHANNEL_LABELS[row.channel] ?? row.channel,
  direction: row.direction,
  attemptNo: row.attempt_no,
  outcome: row.outcome,
  outcomeLabel: CONTACT_OUTCOME_LABELS[row.outcome] ?? row.outcome,
  customerReaction: row.customer_reaction,
  customerReactionLabel: row.customer_reaction ? CONTACT_REACTION_LABELS[row.customer_reaction] ?? row.customer_reaction : null,
  customerTemperature: row.customer_temperature,
  note: row.note ?? "",
  nextAction: row.next_action,
  nextActionLabel: row.next_action ? NEXT_ACTION_LABELS[row.next_action] ?? row.next_action : null,
  nextActionAt: row.next_action_at,
  reservationAt: row.reservation_at,
  excludedReason: row.excluded_reason,
  createdAt: row.created_at,
});

const taskToPublic = (row: RawTaskRow): ContactTaskPublic => ({
  taskId: row.task_id,
  leadId: row.lead_id,
  ownerId: row.owner_id,
  taskType: row.task_type,
  dueAt: row.due_at,
  status: row.status,
  completedAt: row.completed_at,
  reason: row.reason ?? "",
  createdAt: row.created_at,
});

const auditToPublic = (row: RawAuditRow): ContactAuditLogPublic => ({
  auditId: row.audit_id,
  operatorId: row.operator_id,
  action: row.action,
  leadId: row.lead_id,
  targetField: row.target_field,
  ip: row.ip,
  userAgent: row.user_agent,
  createdAt: row.created_at,
});

const outcomeToLeadStatus = (
  outcome: ContactOutcome,
  attemptNo: number,
  current: AibioNativeLeadStatus,
): AibioNativeLeadStatus => {
  if (current === "paid" || current === "visited") return current;
  if (outcome === "reserved") return "reserved";
  if (outcome === "connected") return current === "reserved" ? current : "contacted";
  if (outcome === "rejected" || outcome === "wrong_number" || outcome === "invalid") return "invalid_duplicate";
  if (outcome === "requested_callback") return "contact_attempted";
  if (outcome === "no_answer" || outcome === "busy") {
    return attemptNo >= 1 ? "contact_attempted" : current;
  }
  return current;
};

export function recordContactEvent(input: ContactEventInput & { leadId: string }) {
  const db = initAibioContactDashboardTables();
  const operatorId = normalizeText(input.operatorId, 80);
  if (!operatorId) {
    const error = new Error("missing_operatorId");
    Object.assign(error, { statusCode: 422 });
    throw error;
  }
  const channel = validateEnum<ContactChannel>(CHANNEL_SET, input.channel, "channel") as ContactChannel;
  const direction = validateEnum<ContactDirection>(DIRECTION_SET, input.direction, "direction") as ContactDirection;
  const outcome = validateEnum<ContactOutcome>(OUTCOME_SET, input.outcome, "outcome") as ContactOutcome;
  const reaction = validateEnum<ContactReaction>(REACTION_SET, input.customerReaction, "customerReaction", true);
  const temperature = validateEnum<ContactTemperature>(TEMPERATURE_SET, input.customerTemperature, "customerTemperature", true);
  const nextAction = validateEnum<NextAction>(NEXT_ACTION_SET, input.nextAction, "nextAction", true);
  const note = normalizeText(input.note, 1000);
  const occurredAt = parseIsoDate(input.occurredAt) ?? new Date().toISOString();
  const nextActionAt = parseIsoDate(input.nextActionAt);
  const reservationAt = parseIsoDate(input.reservationAt);
  const excludedReason = normalizeText(input.excludedReason, 200);

  if (outcome === "reserved" && !reservationAt) {
    const error = new Error("missing_reservationAt_for_reserved");
    Object.assign(error, { statusCode: 422 });
    throw error;
  }
  if (outcome === "invalid" && !excludedReason) {
    const error = new Error("missing_excludedReason_for_invalid");
    Object.assign(error, { statusCode: 422 });
    throw error;
  }

  const lead = db
    .prepare("SELECT lead_id, status FROM aibio_native_leads WHERE lead_id = ?")
    .get(input.leadId) as { lead_id: string; status: AibioNativeLeadStatus } | undefined;
  if (!lead) {
    const error = new Error("lead_not_found");
    Object.assign(error, { statusCode: 404 });
    throw error;
  }

  const eventId = `aibio_contact_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const attemptCount = (
    db.prepare("SELECT COUNT(*) AS count FROM aibio_contact_events WHERE lead_id = ?").get(input.leadId) as { count: number }
  ).count + 1;

  const nextStatus = outcomeToLeadStatus(outcome, attemptCount, lead.status);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO aibio_contact_events (
        event_id, lead_id, occurred_at, operator_id, channel, direction, attempt_no,
        outcome, customer_reaction, customer_temperature, note, next_action,
        next_action_at, reservation_at, excluded_reason, created_at
      ) VALUES (
        @eventId, @leadId, @occurredAt, @operatorId, @channel, @direction, @attemptNo,
        @outcome, @reaction, @temperature, @note, @nextAction,
        @nextActionAt, @reservationAt, @excludedReason, @createdAt
      )
    `).run({
      eventId,
      leadId: input.leadId,
      occurredAt,
      operatorId,
      channel,
      direction,
      attemptNo: attemptCount,
      outcome,
      reaction,
      temperature,
      note,
      nextAction,
      nextActionAt,
      reservationAt,
      excludedReason: excludedReason || null,
      createdAt,
    });

    if (nextAction && nextActionAt) {
      const taskId = `aibio_task_${Date.now()}_${randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO aibio_contact_tasks (task_id, lead_id, owner_id, task_type, due_at, status, reason, created_at)
        VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
      `).run(taskId, input.leadId, operatorId, nextAction, nextActionAt, `event:${eventId}`, createdAt);
    }

    if (nextStatus !== lead.status) {
      db.prepare(`
        UPDATE aibio_native_leads
        SET status = ?, status_updated_at = ?, updated_at = ?,
            reservation_at = COALESCE(?, reservation_at)
        WHERE lead_id = ?
      `).run(nextStatus, createdAt, createdAt, reservationAt, input.leadId);
      db.prepare(`
        INSERT INTO aibio_native_lead_status_log (
          lead_id, previous_status, next_status, changed_by, memo, changed_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.leadId,
        lead.status,
        nextStatus,
        operatorId,
        `contact:${outcome}`,
        createdAt,
        JSON.stringify({ eventId, channel, direction, reaction, temperature }),
      );
    } else {
      db.prepare(`
        UPDATE aibio_native_leads SET updated_at = ? WHERE lead_id = ?
      `).run(createdAt, input.leadId);
    }
  });

  tx();
  const row = db.prepare("SELECT * FROM aibio_contact_events WHERE event_id = ?").get(eventId) as RawEventRow;
  return eventToPublic(row);
}

export function listContactEvents(leadId: string) {
  const db = initAibioContactDashboardTables();
  const rows = db
    .prepare("SELECT * FROM aibio_contact_events WHERE lead_id = ? ORDER BY occurred_at DESC, created_at DESC")
    .all(leadId) as RawEventRow[];
  return rows.map(eventToPublic);
}

export function listContactTasks(options: { ownerId?: string; status?: string; leadId?: string; limit?: number }) {
  const db = initAibioContactDashboardTables();
  const where: string[] = [];
  const params: unknown[] = [];
  const ownerId = normalizeText(options.ownerId, 80);
  if (ownerId) {
    where.push("owner_id = ?");
    params.push(ownerId);
  }
  const status = normalizeText(options.status, 32);
  if (status && ["open", "done", "snoozed", "canceled"].includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  const leadId = normalizeText(options.leadId, 200);
  if (leadId) {
    where.push("lead_id = ?");
    params.push(leadId);
  }
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM aibio_contact_tasks ${whereSql} ORDER BY due_at ASC LIMIT ?`)
    .all(...params, limit) as RawTaskRow[];
  return rows.map(taskToPublic);
}

export function recordAuditLog(input: {
  operatorId: string;
  action: string;
  leadId?: string | null;
  targetField?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = initAibioContactDashboardTables();
  const auditId = `aibio_audit_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO aibio_contact_audit_log (audit_id, operator_id, action, lead_id, target_field, ip, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditId,
    normalizeText(input.operatorId, 80) || "unknown",
    normalizeText(input.action, 64),
    input.leadId ? normalizeText(input.leadId, 200) : null,
    input.targetField ? normalizeText(input.targetField, 64) : null,
    input.ip ? normalizeText(input.ip, 64) : null,
    input.userAgent ? normalizeText(input.userAgent, 256) : null,
    createdAt,
  );
  return { auditId, createdAt };
}

export function listAuditLogs(options: { leadId?: string; limit?: number }) {
  const db = initAibioContactDashboardTables();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const where: string[] = [];
  const params: unknown[] = [];
  const leadId = normalizeText(options.leadId, 200);
  if (leadId) {
    where.push("lead_id = ?");
    params.push(leadId);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM aibio_contact_audit_log ${whereSql} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as RawAuditRow[];
  return rows.map(auditToPublic);
}

const BUSINESS_HOURS_MS = 30 * 60 * 1000;
const SLA_HARD_LIMIT_MS = 2 * 60 * 60 * 1000;

const computePriorityScore = (params: {
  status: AibioNativeLeadStatus;
  createdAt: string;
  attemptCount: number;
  lastEventOutcome: ContactOutcome | null;
  nextActionAt: string | null;
  isDuplicate: boolean;
  hasAdKey: boolean;
}) => {
  const ageMs = Date.now() - Date.parse(params.createdAt);
  let score = 0;
  if (params.status === "new") score += 100;
  if (params.status === "contact_attempted") score += 60;
  if (params.status === "contacted") score += 40;
  if (params.status === "reserved") score += 30;
  if (params.isDuplicate) score -= 80;
  if (params.attemptCount >= 3 && params.status !== "reserved" && params.status !== "visited" && params.status !== "paid") score -= 20;
  if (params.hasAdKey) score += 5;
  if (params.nextActionAt && Date.parse(params.nextActionAt) <= Date.now()) score += 50;
  if (params.status === "new" && ageMs > BUSINESS_HOURS_MS) score += 30;
  if (params.status === "new" && ageMs > SLA_HARD_LIMIT_MS) score += 60;
  return score;
};

type ContactLeadSummaryRow = {
  lead_id: string;
  source: string;
  status: AibioNativeLeadStatus;
  status_updated_at: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_hash: string;
  age_range: string;
  purpose: string;
  acquisition_channel: string;
  preferred_time: string;
  privacy_consent: number;
  marketing_consent: number;
  landing_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  fbc: string | null;
  fbp: string | null;
  ga_client_id: string | null;
  is_duplicate: number;
  duplicate_of_lead_id: string | null;
  assigned_to: string | null;
  operator_memo: string | null;
  reservation_at: string | null;
  visit_at: string | null;
  payment_amount: number | null;
  payment_at: string | null;
  created_at: string;
  updated_at: string;
};

const maskName = (name: string) => {
  const normalized = name.trim();
  if (!normalized) return "";
  if (normalized.length === 1) return "*";
  if (normalized.length === 2) return `${normalized[0]}*`;
  return `${normalized[0]}${"*".repeat(normalized.length - 2)}${normalized.at(-1)}`;
};

const maskPhone = (phone: string) => {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 7) return "****";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
};

const sourceLabel = (row: ContactLeadSummaryRow) => {
  const utm = row.utm_source?.toLowerCase() ?? "";
  if (utm.includes("instagram") || utm.includes("ig")) return "Instagram";
  if (utm.includes("facebook") || utm.includes("fb") || utm.includes("meta")) return "Meta/Facebook";
  if (utm.includes("naver")) return "Naver";
  if (utm.includes("google")) return "Google";
  if (row.fbclid || row.fbc) return "Meta 광고";
  if (row.gclid) return "Google 광고";
  if ((row.acquisition_channel || "").toLowerCase() === "referral") return "지인 소개";
  return row.utm_source || row.acquisition_channel || "직접 유입";
};

export type ContactDashboardLead = {
  leadId: string;
  status: AibioNativeLeadStatus;
  statusLabel: string;
  formSubmittedAt: string;
  statusUpdatedAt: string;
  maskedName: string;
  maskedPhone: string;
  customerName?: string;
  customerPhone?: string;
  ageRange: string;
  purpose: string;
  preferredTime: string;
  source: string;
  utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null };
  hasAdKey: boolean;
  assignedTo: string | null;
  operatorMemo: string | null;
  reservationAt: string | null;
  visitAt: string | null;
  paymentAt: string | null;
  paymentAmount: number | null;
  attemptCount: number;
  lastContactAt: string | null;
  lastContactOutcome: ContactOutcome | null;
  lastContactOutcomeLabel: string | null;
  lastCustomerReaction: ContactReaction | null;
  lastCustomerReactionLabel: string | null;
  nextAction: NextAction | null;
  nextActionAt: string | null;
  nextActionLabel: string | null;
  isDuplicate: boolean;
  priorityScore: number;
};

export type ContactDashboardLeadHashRow = {
  leadId: string;
  phoneHashSha256: string;
  createdAt: string;
  status: AibioNativeLeadStatus;
};

const buildLeadRow = (
  row: ContactLeadSummaryRow,
  eventStats: Map<string, EventAggregate>,
  reveal = false,
): ContactDashboardLead => {
  const stats = eventStats.get(row.lead_id);
  const lastOutcome = stats?.lastOutcome ?? null;
  const lastReaction = stats?.lastReaction ?? null;
  const nextAction = stats?.openNextAction ?? null;
  const nextActionAt = stats?.openNextActionAt ?? null;
  const hasAdKey = Boolean(row.fbclid || row.gclid || row.fbc || row.fbp || row.ga_client_id);
  const priorityScore = computePriorityScore({
    status: row.status,
    createdAt: row.created_at,
    attemptCount: stats?.attemptCount ?? 0,
    lastEventOutcome: lastOutcome,
    nextActionAt,
    isDuplicate: Boolean(row.is_duplicate),
    hasAdKey,
  });
  return {
    leadId: row.lead_id,
    status: row.status,
    statusLabel: AIBIO_NATIVE_STATUS_LABELS[row.status] ?? row.status,
    formSubmittedAt: row.created_at,
    statusUpdatedAt: row.status_updated_at,
    maskedName: maskName(row.customer_name),
    maskedPhone: maskPhone(row.customer_phone),
    customerName: reveal ? row.customer_name : undefined,
    customerPhone: reveal ? row.customer_phone : undefined,
    ageRange: row.age_range,
    purpose: row.purpose,
    preferredTime: row.preferred_time,
    source: sourceLabel(row),
    utm: {
      source: row.utm_source,
      medium: row.utm_medium,
      campaign: row.utm_campaign,
      content: row.utm_content,
    },
    hasAdKey,
    assignedTo: row.assigned_to,
    operatorMemo: row.operator_memo,
    reservationAt: row.reservation_at,
    visitAt: row.visit_at,
    paymentAt: row.payment_at,
    paymentAmount: row.payment_amount,
    attemptCount: stats?.attemptCount ?? 0,
    lastContactAt: stats?.lastContactAt ?? null,
    lastContactOutcome: lastOutcome,
    lastContactOutcomeLabel: lastOutcome ? CONTACT_OUTCOME_LABELS[lastOutcome] : null,
    lastCustomerReaction: lastReaction,
    lastCustomerReactionLabel: lastReaction ? CONTACT_REACTION_LABELS[lastReaction] : null,
    nextAction,
    nextActionAt,
    nextActionLabel: nextAction ? NEXT_ACTION_LABELS[nextAction] : null,
    isDuplicate: Boolean(row.is_duplicate),
    priorityScore,
  };
};

type EventAggregate = {
  attemptCount: number;
  lastContactAt: string | null;
  lastOutcome: ContactOutcome | null;
  lastReaction: ContactReaction | null;
  openNextAction: NextAction | null;
  openNextActionAt: string | null;
};

const aggregateEvents = (rows: RawEventRow[]): Map<string, EventAggregate> => {
  const result = new Map<string, EventAggregate>();
  for (const row of rows) {
    const current = result.get(row.lead_id) ?? {
      attemptCount: 0,
      lastContactAt: null,
      lastOutcome: null,
      lastReaction: null,
      openNextAction: null,
      openNextActionAt: null,
    };
    current.attemptCount += 1;
    if (!current.lastContactAt || row.occurred_at > current.lastContactAt) {
      current.lastContactAt = row.occurred_at;
      current.lastOutcome = row.outcome;
      current.lastReaction = row.customer_reaction;
    }
    if (row.next_action && row.next_action_at) {
      if (!current.openNextActionAt || row.next_action_at < current.openNextActionAt) {
        current.openNextAction = row.next_action;
        current.openNextActionAt = row.next_action_at;
      }
    }
    result.set(row.lead_id, current);
  }
  return result;
};

export function listContactDashboardLeads(options: {
  status?: string;
  assignedTo?: string;
  bucket?: string;
  search?: string;
  limit?: number;
  offset?: number;
  reveal?: boolean;
}) {
  const db = initAibioContactDashboardTables();
  const where: string[] = [];
  const params: unknown[] = [];
  const status = normalizeText(options.status, 64);
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  const assignedTo = normalizeText(options.assignedTo, 80);
  if (assignedTo === "unassigned") {
    where.push("(assigned_to IS NULL OR assigned_to = '')");
  } else if (assignedTo) {
    where.push("assigned_to = ?");
    params.push(assignedTo);
  }
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS count FROM aibio_native_leads ${whereSql}`)
    .get(...params) as { count: number };

  const rows = db
    .prepare(`
      SELECT lead_id, source, status, status_updated_at, customer_name, customer_phone,
             customer_phone_hash, age_range, purpose, acquisition_channel, preferred_time,
             privacy_consent, marketing_consent, landing_path, utm_source, utm_medium,
             utm_campaign, utm_content, fbclid, gclid, fbc, fbp, ga_client_id,
             is_duplicate, duplicate_of_lead_id, assigned_to, operator_memo,
             reservation_at, visit_at, payment_amount, payment_at, created_at, updated_at
      FROM aibio_native_leads
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset) as ContactLeadSummaryRow[];

  const eventRows =
    rows.length > 0
      ? (db
          .prepare(
            `SELECT * FROM aibio_contact_events WHERE lead_id IN (${rows.map(() => "?").join(",")}) ORDER BY occurred_at ASC`,
          )
          .all(...rows.map((r) => r.lead_id)) as RawEventRow[])
      : [];
  const eventStats = aggregateEvents(eventRows);

  const reveal = Boolean(options.reveal);
  let leads = rows.map((row) => buildLeadRow(row, eventStats, reveal));

  const search = normalizeText(options.search, 80).toLowerCase();
  if (search) {
    leads = leads.filter((lead) => {
      const haystack = [
        lead.maskedName,
        lead.maskedPhone,
        lead.customerName ?? "",
        lead.customerPhone ?? "",
        lead.purpose,
        lead.source,
        lead.utm.campaign ?? "",
        lead.utm.source ?? "",
        lead.assignedTo ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const bucket = normalizeText(options.bucket, 32);
  if (bucket) {
    leads = applyBucket(leads, bucket);
  }

  leads.sort((a, b) => b.priorityScore - a.priorityScore || a.formSubmittedAt.localeCompare(b.formSubmittedAt));

  return {
    total: totalRow.count,
    filteredTotal: leads.length,
    limit,
    offset,
    revealed: reveal,
    leads,
  };
}

const applyBucket = (leads: ContactDashboardLead[], bucket: string): ContactDashboardLead[] => {
  const now = Date.now();
  switch (bucket) {
    case "new":
      return leads.filter((lead) => lead.attemptCount === 0 && lead.status === "new");
    case "today_action":
      return leads.filter((lead) => {
        if (!lead.nextActionAt) return false;
        return Date.parse(lead.nextActionAt) <= now + 24 * 60 * 60 * 1000;
      });
    case "no_answer_2plus":
      return leads.filter((lead) => lead.attemptCount >= 2 && lead.lastContactOutcome === "no_answer");
    case "reserved":
      return leads.filter((lead) => lead.status === "reserved" || Boolean(lead.reservationAt));
    case "visited":
      return leads.filter((lead) => lead.status === "visited" || Boolean(lead.visitAt));
    case "sla_overdue":
      return leads.filter(
        (lead) =>
          lead.status === "new" &&
          lead.attemptCount === 0 &&
          now - Date.parse(lead.formSubmittedAt) > SLA_HARD_LIMIT_MS,
      );
    default:
      return leads;
  }
};

export function getContactDashboardSummary(options: { rangeDays?: number }) {
  const db = initAibioContactDashboardTables();
  const rangeDays = Math.min(Math.max(options.rangeDays ?? 7, 1), 90);
  const now = new Date();
  const since = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

  const leadRows = db
    .prepare(`
      SELECT lead_id, source, status, status_updated_at, customer_name, customer_phone,
             customer_phone_hash, age_range, purpose, acquisition_channel, preferred_time,
             privacy_consent, marketing_consent, landing_path, utm_source, utm_medium,
             utm_campaign, utm_content, fbclid, gclid, fbc, fbp, ga_client_id,
             is_duplicate, duplicate_of_lead_id, assigned_to, operator_memo,
             reservation_at, visit_at, payment_amount, payment_at, created_at, updated_at
      FROM aibio_native_leads
      WHERE created_at >= ?
    `)
    .all(since) as ContactLeadSummaryRow[];

  const eventRows = db
    .prepare("SELECT * FROM aibio_contact_events WHERE occurred_at >= ? ORDER BY occurred_at ASC")
    .all(since) as RawEventRow[];
  const stats = aggregateEvents(eventRows);

  const leads = leadRows.map((row) => buildLeadRow(row, stats));
  const total = leads.length;
  const buckets = {
    new: applyBucket(leads, "new").length,
    today_action: applyBucket(leads, "today_action").length,
    no_answer_2plus: applyBucket(leads, "no_answer_2plus").length,
    reserved: applyBucket(leads, "reserved").length,
    visited: applyBucket(leads, "visited").length,
    sla_overdue: applyBucket(leads, "sla_overdue").length,
  };

  const byStatus: Record<string, number> = {};
  for (const lead of leads) {
    byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
  }

  const firstContactDurations: number[] = [];
  const eventByLead = new Map<string, RawEventRow[]>();
  for (const row of eventRows) {
    const arr = eventByLead.get(row.lead_id) ?? [];
    arr.push(row);
    eventByLead.set(row.lead_id, arr);
  }
  let leadsWithFirstContact = 0;
  let leadsWithFirstContactWithin24h = 0;
  for (const lead of leads) {
    const events = eventByLead.get(lead.leadId) ?? [];
    if (events.length === 0) continue;
    leadsWithFirstContact += 1;
    const first = events[0];
    const elapsed = Date.parse(first.occurred_at) - Date.parse(lead.formSubmittedAt);
    if (elapsed >= 0) firstContactDurations.push(elapsed);
    if (elapsed <= 24 * 60 * 60 * 1000) leadsWithFirstContactWithin24h += 1;
  }
  firstContactDurations.sort((a, b) => a - b);
  const median = firstContactDurations.length > 0 ? firstContactDurations[Math.floor(firstContactDurations.length / 2)] : null;

  const reservedLeads = leads.filter((lead) => lead.status === "reserved" || Boolean(lead.reservationAt));
  const visitedLeads = leads.filter((lead) => lead.status === "visited" || Boolean(lead.visitAt));
  const paidLeads = leads.filter((lead) => lead.status === "paid" || Boolean(lead.paymentAt));

  return {
    version: AIBIO_CONTACT_DASHBOARD_VERSION,
    generatedAt: now.toISOString(),
    rangeDays,
    window: { startAt: since, endAt: now.toISOString() },
    totals: {
      leads: total,
      events: eventRows.length,
      operators: new Set(eventRows.map((row) => row.operator_id)).size,
    },
    buckets,
    byStatus,
    kpis: {
      firstContactRateWithin24h: total > 0 ? leadsWithFirstContactWithin24h / total : null,
      contactCoverageRate: total > 0 ? leadsWithFirstContact / total : null,
      reservedRate: total > 0 ? reservedLeads.length / total : null,
      visitedRate: reservedLeads.length > 0 ? visitedLeads.length / reservedLeads.length : null,
      paidRate: visitedLeads.length > 0 ? paidLeads.length / visitedLeads.length : null,
      medianMinutesToFirstContact: median !== null ? Math.round(median / 60000) : null,
    },
  };
}

export function getContactDashboardLead(leadId: string, options: { reveal?: boolean } = {}) {
  const db = initAibioContactDashboardTables();
  const row = db
    .prepare(`
      SELECT lead_id, source, status, status_updated_at, customer_name, customer_phone,
             customer_phone_hash, age_range, purpose, acquisition_channel, preferred_time,
             privacy_consent, marketing_consent, landing_path, utm_source, utm_medium,
             utm_campaign, utm_content, fbclid, gclid, fbc, fbp, ga_client_id,
             is_duplicate, duplicate_of_lead_id, assigned_to, operator_memo,
             reservation_at, visit_at, payment_amount, payment_at, created_at, updated_at
      FROM aibio_native_leads
      WHERE lead_id = ?
    `)
    .get(leadId) as ContactLeadSummaryRow | undefined;
  if (!row) return null;
  const events = db
    .prepare("SELECT * FROM aibio_contact_events WHERE lead_id = ? ORDER BY occurred_at ASC")
    .all(leadId) as RawEventRow[];
  const stats = aggregateEvents(events);
  const reveal = Boolean(options.reveal);
  const lead = buildLeadRow(row, stats, reveal);
  return {
    lead,
    revealed: reveal,
    events: events.map(eventToPublic).reverse(),
    tasks: listContactTasks({ leadId }),
  };
}

export function listContactDashboardLeadHashRows(options: { leadIds?: string[]; createdAtGte?: string } = {}) {
  const db = initAibioContactDashboardTables();
  const where: string[] = [];
  const params: unknown[] = [];
  const leadIds = [...new Set((options.leadIds ?? []).filter(Boolean))];
  if (leadIds.length > 0) {
    where.push(`lead_id IN (${leadIds.map(() => "?").join(",")})`);
    params.push(...leadIds);
  }
  const createdAtGte = parseIsoDate(options.createdAtGte);
  if (createdAtGte) {
    where.push("created_at >= ?");
    params.push(createdAtGte);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT lead_id, customer_phone_hash, created_at, status
    FROM aibio_native_leads
    ${whereSql}
  `).all(...params) as Array<{
    lead_id: string;
    customer_phone_hash: string;
    created_at: string;
    status: AibioNativeLeadStatus;
  }>;
  return rows.map((row): ContactDashboardLeadHashRow => ({
    leadId: row.lead_id,
    phoneHashSha256: row.customer_phone_hash,
    createdAt: row.created_at,
    status: row.status,
  }));
}

export function listContactDashboardEnums() {
  return {
    statuses: Object.entries(AIBIO_NATIVE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    channels: CONTACT_CHANNELS.map((value) => ({ value, label: CONTACT_CHANNEL_LABELS[value] })),
    directions: CONTACT_DIRECTIONS.map((value) => ({ value, label: value === "outbound" ? "발신" : "수신" })),
    outcomes: CONTACT_OUTCOMES.map((value) => ({ value, label: CONTACT_OUTCOME_LABELS[value] })),
    reactions: CONTACT_REACTIONS.map((value) => ({ value, label: CONTACT_REACTION_LABELS[value] })),
    temperatures: CONTACT_TEMPERATURES.map((value) => ({ value, label: value === "hot" ? "뜨거움" : value === "warm" ? "보통" : value === "cold" ? "차가움" : "제외" })),
    nextActions: NEXT_ACTIONS.map((value) => ({ value, label: NEXT_ACTION_LABELS[value] })),
    bucketLabels: {
      new: "신규 접수",
      today_action: "오늘 연락 필요",
      no_answer_2plus: "부재 2회 이상",
      reserved: "예약 확정",
      visited: "방문 예정/완료",
      sla_overdue: "SLA 초과",
    },
  };
}
