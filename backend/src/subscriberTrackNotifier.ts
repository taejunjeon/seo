// 정기구독 트랙 변경 + 이탈 방지 알림톡 자동 발송
//
// 운영 흐름:
//   1. 매일 새벽 syncSubscriberTracks() 실행 → coffee_subscriber_track_log에 변경 적재
//   2. dispatchTrackPromotions() 호출 → 신규 LOG 행에 대해 진입 알림톡 발송
//   3. dispatchChurnPrevention() 호출 → churn_risk=1 고객에게 이탈 방지 메시지
//
// 운영 전 확인:
//   - 알리고에서 4종 진입 + 2종 이탈방지 = 총 6종 템플릿 등록 필요 (사전 검수 필수)
//   - 등록된 tpl_code 를 .env 에 ALIGO_TPL_CODE_* 로 저장
//   - testMode 기본 'Y' (실발송 전 dry-run)

import { sendAligo, type AligoTestSendInput } from "./aligo";
import { getCrmDb } from "./crmLocalDb";
import { env } from "./env";

// ─── 템플릿 정의 ───────────────────────────────────────
// {name} = 호명, {next} = 다음 단계까지 남은 결제 횟수, {paid12m} = 12개월 결제 횟수, {recoverDate} = 등급 회복 마감일
//
// 운영 권장: 30~80자 범위, 광고성(AD) 분류 회피, 정보성(BA)으로 등록.
// 실제 알리고 등록 시 tpl_content 를 그대로 복사 + tpl_button(웹/알림톡) 별도 추가 가능.

export type TemplateKey =
  | "TRACK_SUBSCRIBER_WELCOME"
  | "TRACK_LOYALIST_PROMOTION"
  | "TRACK_MANIAC_PROMOTION"
  | "TRACK_EVERGREEN_PROMOTION"
  | "CHURN_30_GENTLE"
  | "CHURN_60_RECOVERY";

type TemplateDef = {
  key: TemplateKey;
  name: string;
  subject: string;
  envCodeKey: string; // .env 에서 읽을 코드 키
  contentTemplate: (vars: Record<string, string>) => string;
  description: string;
};

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  TRACK_SUBSCRIBER_WELCOME: {
    key: "TRACK_SUBSCRIBER_WELCOME",
    name: "더클린커피 SUBSCRIBER 환영",
    subject: "더클린커피 정기구독 시작",
    envCodeKey: "ALIGO_TPL_COFFEE_SUBSCRIBER",
    contentTemplate: (v) =>
      `[더클린커피] ${v.name}님, 정기구독을 시작해주셔서 감사합니다.\n\n` +
      `매월 자동결제 ${v.next}회만 더 진행되면 LOYALIST로 자동 격상되어\n` +
      `리커버리랩 1일 체험권과 한정 마이크로 로트 원두를 보내드립니다.\n\n` +
      `오늘부터 더클린커피 SUBSCRIBER입니다. 한 잔 한 잔 함께 가요.`,
    description: "정기결제 1회+ 진입 시 1회 발송",
  },
  TRACK_LOYALIST_PROMOTION: {
    key: "TRACK_LOYALIST_PROMOTION",
    name: "더클린커피 LOYALIST 격상",
    subject: "LOYALIST로 격상되셨습니다",
    envCodeKey: "ALIGO_TPL_COFFEE_LOYALIST",
    contentTemplate: (v) =>
      `[더클린커피] ${v.name}님, 6회 연속 정기구독을 완성하셨습니다.\n\n` +
      `오늘부터 LOYALIST 등급입니다.\n` +
      `· 리커버리랩 AIBIO 1일 체험권 1회 (동반 1인 가능)\n` +
      `· LOYALIST 한정 마이크로 로트 원두 1회 발송\n` +
      `· 카카오톡 전용 응대 채널 활성화\n\n` +
      `다음 ${v.next}회만 더 가시면 MANIAC 환영 키트가 기다립니다.`,
    description: "정기결제 6회+ 진입 시 1회 발송",
  },
  TRACK_MANIAC_PROMOTION: {
    key: "TRACK_MANIAC_PROMOTION",
    name: "더클린커피 MANIAC 격상",
    subject: "1년 매니아가 되셨습니다",
    envCodeKey: "ALIGO_TPL_COFFEE_MANIAC",
    contentTemplate: (v) =>
      `[더클린커피] ${v.name}님, 12회 연속 정기구독 — 1년의 약속을 지켜주셨습니다.\n\n` +
      `오늘부터 MANIAC 등급입니다 (SIGNATURE 동급).\n` +
      `· 마이크로 로트 원두 + 핸드라이팅 카드 환영 키트\n` +
      `· 바리스타 1:1 화상 컨설팅 (홈브루잉 코칭, 30분)\n` +
      `· 분기 산지 테이스팅 키트\n` +
      `· 바이오컴 웰니스 라운지 초대 (동반 1인)\n\n` +
      `당신은 우리의 핵심입니다.`,
    description: "정기결제 12회+ 진입 시 1회 발송",
  },
  TRACK_EVERGREEN_PROMOTION: {
    key: "TRACK_EVERGREEN_PROMOTION",
    name: "더클린커피 EVERGREEN 등극",
    subject: "EVERGREEN 명패가 도착합니다",
    envCodeKey: "ALIGO_TPL_COFFEE_EVERGREEN",
    contentTemplate: (v) =>
      `[더클린커피] ${v.name}님, 24회 연속 정기구독 — EVERGREEN 등극을 축하드립니다.\n\n` +
      `· EVERGREEN 명패 + 영구 라운지 초대권 (등급 강등 면제)\n` +
      `· 분기 마스터 바리스타 커핑 세션 + 영양사 컨설팅\n` +
      `· 산지 다큐멘터리 키트 (생산자 영상편지 동봉)\n` +
      `· VIP 핫라인 — 직접 연결 (월 1회 이내)\n` +
      `· 빈 앰배서더 — 지인 3명 초대 권한\n\n` +
      `EVERGREEN ${v.paid12m}회. 평생 한 줄에 새깁니다.`,
    description: "정기결제 24회+ 진입 시 1회 발송",
  },
  CHURN_30_GENTLE: {
    key: "CHURN_30_GENTLE",
    name: "더클린커피 휴면 안내 (30일)",
    subject: "한 달 만에 안부 드립니다",
    envCodeKey: "ALIGO_TPL_COFFEE_CHURN_30",
    contentTemplate: (v) =>
      `[더클린커피] ${v.name}님, 한 달 동안 정기결제가 멈춰 있어요.\n\n` +
      `등급은 그대로 ${v.track}. 다음 결제일에 자동 재개되면\n` +
      `MANIAC 진입까지 ${v.next}회 남으셨습니다.\n\n` +
      `궁금한 점이나 일시 정지가 필요하시면 회신 부탁드려요.`,
    description: "직전 30일 무결제 + 트랙≠NONE 1회 발송",
  },
  CHURN_60_RECOVERY: {
    key: "CHURN_60_RECOVERY",
    name: "더클린커피 등급 회복 기회 (60일)",
    subject: "당신의 자리는 그대로입니다",
    envCodeKey: "ALIGO_TPL_COFFEE_CHURN_60",
    contentTemplate: (v) =>
      `[더클린커피] ${v.name}님, 두 달째 정기결제가 멈춰 있어요.\n\n` +
      `${v.track} 등급은 ${v.recoverDate}까지 유지됩니다.\n` +
      `그 전에 정기결제를 재개하시면 12개월 카운터가 이어집니다.\n\n` +
      `한 잔, 다시 한 잔. 천천히 가도 됩니다.`,
    description: "직전 60일 무결제 1회 발송",
  },
};

const getTemplateCode = (key: TemplateKey): string | null => {
  const envKey = TEMPLATES[key].envCodeKey as keyof typeof env;
  const v = (env as Record<string, unknown>)[envKey];
  return typeof v === "string" && v.length > 0 ? v : null;
};

const wasRecentlySent = (phone: string, templateKey: TemplateKey, days = 30): boolean => {
  const db = getCrmDb();
  const r = db
    .prepare(
      `SELECT 1 FROM coffee_notification_log
       WHERE phone_normalized = ? AND template_key = ? AND send_status IN ('sent','queued')
         AND sent_at >= datetime('now', '-' || ? || ' days')
       LIMIT 1`,
    )
    .get(phone, templateKey, days);
  return !!r;
};

const insertLog = (input: {
  phone: string;
  templateKey: TemplateKey;
  templateCode: string | null;
  trackAtSend: string | null;
  paymentsAtSend: number | null;
  receiverName: string | null;
  messagePreview: string;
  sendStatus: "queued" | "sent" | "failed" | "skipped";
  sendResponse: string;
  testMode: 0 | 1;
}): number => {
  const db = getCrmDb();
  const r = db
    .prepare(
      `INSERT INTO coffee_notification_log
       (phone_normalized, template_key, template_code, track_at_send, payments_12m_at_send,
        receiver_name, message_preview, send_status, send_response, test_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      input.phone,
      input.templateKey,
      input.templateCode,
      input.trackAtSend,
      input.paymentsAtSend,
      input.receiverName,
      input.messagePreview.slice(0, 500),
      input.sendStatus,
      input.sendResponse.slice(0, 1000),
      input.testMode,
    );
  return Number(r.lastInsertRowid ?? 0);
};

const TRACK_TO_TEMPLATE: Record<string, TemplateKey> = {
  SUBSCRIBER: "TRACK_SUBSCRIBER_WELCOME",
  LOYALIST: "TRACK_LOYALIST_PROMOTION",
  MANIAC: "TRACK_MANIAC_PROMOTION",
  EVERGREEN: "TRACK_EVERGREEN_PROMOTION",
};

const NEXT_THRESHOLD: Record<string, number> = {
  NONE: 1, // 다음 SUBSCRIBER 진입까지 1회
  SUBSCRIBER: 6, // 다음 LOYALIST까지
  LOYALIST: 12,
  MANIAC: 24,
  EVERGREEN: 0,
};

export type DispatchOptions = {
  liveMode?: boolean; // true면 testMode='N' (실발송)
  limit?: number; // 한 번에 발송할 최대 건수 (default 200)
  dryRun?: boolean; // true면 알리고 호출 안 함, log에 'skipped'
};

/**
 * 트랙 변경 (coffee_subscriber_track_log 신규 행) → 진입 알림톡 발송
 * 멱등 — 같은 phone×templateKey 30일 내 중복 차단
 */
export async function dispatchTrackPromotions(opts: DispatchOptions = {}) {
  const db = getCrmDb();
  const limit = opts.limit ?? 200;
  const testMode: "Y" | "N" = opts.liveMode ? "N" : "Y";

  // 직전 24시간 변경 + 신규 트랙 진입자
  const candidates = db
    .prepare(
      `SELECT log.phone_normalized phone, log.to_track, log.payments_12m, log.amount_12m,
              log.changed_at, mb.name name
       FROM coffee_subscriber_track_log log
       LEFT JOIN imweb_members mb
         ON mb.site = 'thecleancoffee'
        AND REPLACE(REPLACE(mb.callnum, '-', ''), ' ', '') = log.phone_normalized
       WHERE log.to_track IN ('SUBSCRIBER','LOYALIST','MANIAC','EVERGREEN')
         AND log.changed_at >= datetime('now', '-1 days')
       ORDER BY log.changed_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    phone: string;
    to_track: string;
    payments_12m: number;
    amount_12m: number;
    changed_at: string;
    name: string | null;
  }>;

  const result = { evaluated: candidates.length, sent: 0, skipped: 0, failed: 0, dispatches: [] as unknown[] };

  for (const c of candidates) {
    const tplKey = TRACK_TO_TEMPLATE[c.to_track];
    if (!tplKey) continue;

    if (wasRecentlySent(c.phone, tplKey, 30)) {
      result.skipped++;
      continue;
    }

    const tplCode = getTemplateCode(tplKey);
    const def = TEMPLATES[tplKey];
    const next = Math.max(0, NEXT_THRESHOLD[c.to_track] - c.payments_12m);
    const message = def.contentTemplate({
      name: c.name ?? "고객",
      next: String(next),
      paid12m: String(c.payments_12m),
      track: c.to_track,
    });

    if (!tplCode || opts.dryRun) {
      const reason = !tplCode ? "no_template_code" : "dry_run";
      insertLog({
        phone: c.phone,
        templateKey: tplKey,
        templateCode: tplCode,
        trackAtSend: c.to_track,
        paymentsAtSend: c.payments_12m,
        receiverName: c.name,
        messagePreview: message,
        sendStatus: "skipped",
        sendResponse: JSON.stringify({ reason }),
        testMode: 1,
      });
      result.skipped++;
      continue;
    }

    const aligoInput: AligoTestSendInput = {
      tplCode,
      receiver: c.phone,
      recvname: c.name ?? undefined,
      subject: def.subject,
      message,
      testMode,
    };
    try {
      const resp = await sendAligo(aligoInput);
      const ok = resp.ok;
      insertLog({
        phone: c.phone,
        templateKey: tplKey,
        templateCode: tplCode,
        trackAtSend: c.to_track,
        paymentsAtSend: c.payments_12m,
        receiverName: c.name,
        messagePreview: message,
        sendStatus: ok ? "sent" : "failed",
        sendResponse: JSON.stringify(resp).slice(0, 1000),
        testMode: testMode === "N" ? 0 : 1,
      });
      if (ok) result.sent++;
      else result.failed++;
    } catch (e) {
      insertLog({
        phone: c.phone,
        templateKey: tplKey,
        templateCode: tplCode,
        trackAtSend: c.to_track,
        paymentsAtSend: c.payments_12m,
        receiverName: c.name,
        messagePreview: message,
        sendStatus: "failed",
        sendResponse: e instanceof Error ? e.message : String(e),
        testMode: testMode === "N" ? 0 : 1,
      });
      result.failed++;
    }
  }
  return result;
}

/**
 * 이탈 방지 시퀀스 발송
 * 30일+ 무결제 + 트랙≠NONE → CHURN_30_GENTLE
 * 60일+ 무결제 → CHURN_60_RECOVERY (등급 회복 마감일 명시)
 */
export async function dispatchChurnPrevention(opts: DispatchOptions = {}) {
  const db = getCrmDb();
  const limit = opts.limit ?? 200;
  const testMode: "Y" | "N" = opts.liveMode ? "N" : "Y";

  // 30일~59일 무결제 (gentle)
  const candidates30 = db
    .prepare(
      `SELECT cst.phone_normalized phone, cst.current_track track, cst.total_payments_12m payments_12m,
              cst.last_payment_at, mb.name name
       FROM coffee_subscriber_track cst
       LEFT JOIN imweb_members mb ON mb.site='thecleancoffee'
         AND REPLACE(REPLACE(mb.callnum, '-', ''), ' ', '') = cst.phone_normalized
       WHERE cst.churn_risk = 1
         AND cst.current_track != 'NONE'
         AND cst.last_payment_at >= datetime('now', '-60 days')
         AND cst.last_payment_at < datetime('now', '-30 days')
       LIMIT ?`,
    )
    .all(limit) as Array<{
    phone: string;
    track: string;
    payments_12m: number;
    last_payment_at: string;
    name: string | null;
  }>;

  // 60일+ 무결제 (recovery)
  const candidates60 = db
    .prepare(
      `SELECT cst.phone_normalized phone, cst.current_track track, cst.total_payments_12m payments_12m,
              cst.last_payment_at, mb.name name
       FROM coffee_subscriber_track cst
       LEFT JOIN imweb_members mb ON mb.site='thecleancoffee'
         AND REPLACE(REPLACE(mb.callnum, '-', ''), ' ', '') = cst.phone_normalized
       WHERE cst.churn_risk = 1
         AND cst.current_track != 'NONE'
         AND cst.last_payment_at < datetime('now', '-60 days')
       LIMIT ?`,
    )
    .all(limit) as typeof candidates30;

  const result = { gentle_evaluated: candidates30.length, recovery_evaluated: candidates60.length, sent: 0, skipped: 0, failed: 0 };

  const dispatch = async (c: (typeof candidates30)[number], key: TemplateKey, vars: Record<string, string>) => {
    if (wasRecentlySent(c.phone, key, 30)) { result.skipped++; return; }
    const tplCode = getTemplateCode(key);
    const def = TEMPLATES[key];
    const message = def.contentTemplate({ name: c.name ?? "고객", track: c.track, ...vars });

    if (!tplCode || opts.dryRun) {
      insertLog({
        phone: c.phone, templateKey: key, templateCode: tplCode,
        trackAtSend: c.track, paymentsAtSend: c.payments_12m,
        receiverName: c.name, messagePreview: message,
        sendStatus: "skipped",
        sendResponse: JSON.stringify({ reason: !tplCode ? "no_template_code" : "dry_run" }),
        testMode: 1,
      });
      result.skipped++;
      return;
    }

    try {
      const resp = await sendAligo({
        tplCode, receiver: c.phone, recvname: c.name ?? undefined,
        subject: def.subject, message, testMode,
      });
      insertLog({
        phone: c.phone, templateKey: key, templateCode: tplCode,
        trackAtSend: c.track, paymentsAtSend: c.payments_12m,
        receiverName: c.name, messagePreview: message,
        sendStatus: resp.ok ? "sent" : "failed",
        sendResponse: JSON.stringify(resp).slice(0, 1000),
        testMode: testMode === "N" ? 0 : 1,
      });
      if (resp.ok) result.sent++; else result.failed++;
    } catch (e) {
      insertLog({
        phone: c.phone, templateKey: key, templateCode: tplCode,
        trackAtSend: c.track, paymentsAtSend: c.payments_12m,
        receiverName: c.name, messagePreview: message,
        sendStatus: "failed",
        sendResponse: e instanceof Error ? e.message : String(e),
        testMode: testMode === "N" ? 0 : 1,
      });
      result.failed++;
    }
  };

  for (const c of candidates30) {
    const next = Math.max(0, NEXT_THRESHOLD[c.track] - c.payments_12m);
    await dispatch(c, "CHURN_30_GENTLE", { next: String(next) });
  }
  for (const c of candidates60) {
    // 등급 회복 마감일 = 마지막 결제일 + 12개월
    const last = c.last_payment_at ? new Date(c.last_payment_at.replace(" ", "T") + "Z") : new Date();
    const recoverDate = new Date(last.getTime() + 365 * 86400 * 1000).toISOString().slice(0, 10);
    await dispatch(c, "CHURN_60_RECOVERY", { recoverDate });
  }

  return result;
}

export function getNotificationStats() {
  const db = getCrmDb();
  const byTemplate = db
    .prepare(
      `SELECT template_key, send_status, COUNT(*) cnt
       FROM coffee_notification_log GROUP BY template_key, send_status
       ORDER BY template_key, send_status`,
    )
    .all();
  const recent = db
    .prepare(
      `SELECT id, phone_normalized, template_key, send_status, test_mode, sent_at
       FROM coffee_notification_log ORDER BY sent_at DESC LIMIT 30`,
    )
    .all();
  return { byTemplate, recent };
}
