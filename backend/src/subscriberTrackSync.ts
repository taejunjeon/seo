// 더클린커피 정기구독 트랙 카운터 sync
// 매일 1회 실행 권장 (외부 cron 또는 backend 내부 스케줄러)
// 입력: coffee_payments_excel (정기결제·결제완료) + coffee_orders_excel (phone)
// 출력: coffee_subscriber_track (트랙 등급 + 카운터)
//      coffee_subscriber_track_log (등급 변경 이력 — 알림톡 트리거용)
import { getCrmDb } from "./crmLocalDb";

const TRACKS = {
  EVERGREEN: 24,
  MANIAC: 12,
  LOYALIST: 6,
  SUBSCRIBER: 1,
} as const;

type Track = keyof typeof TRACKS | "NONE";

function determineTrack(payments12m: number): Track {
  if (payments12m >= TRACKS.EVERGREEN) return "EVERGREEN";
  if (payments12m >= TRACKS.MANIAC) return "MANIAC";
  if (payments12m >= TRACKS.LOYALIST) return "LOYALIST";
  if (payments12m >= TRACKS.SUBSCRIBER) return "SUBSCRIBER";
  return "NONE";
}

export type SubscriberTrackSyncResult = {
  upserted: number;
  trackChanged: number;
  byTrack: Record<Track, number>;
  churnRisk: number;
  durationMs: number;
};

/**
 * 정기결제 결제내역을 스캔하여 phone별 카운터·트랙을 갱신.
 * 멱등 — 매일 호출해도 안전.
 */
export function syncSubscriberTracks(): SubscriberTrackSyncResult {
  const t0 = Date.now();
  const db = getCrmDb();

  // phone별 정기결제 카운터 집계 (lifetime + 12m)
  const rows = db
    .prepare(
      `
      WITH valid_pay AS (
        SELECT
          cpe.order_no,
          cpe.payment_at,
          cpe.amount
        FROM coffee_payments_excel cpe
        WHERE cpe.payment_status = '결제완료'
          AND cpe.payment_kind = '결제'
          AND cpe.payment_method = '정기결제'
      ),
      order_phone AS (
        SELECT DISTINCT order_no, orderer_phone_norm
        FROM coffee_orders_excel
        WHERE orderer_phone_norm != ''
      ),
      joined AS (
        SELECT
          op.orderer_phone_norm AS phone,
          vp.payment_at,
          vp.amount
        FROM valid_pay vp
        JOIN order_phone op ON op.order_no = vp.order_no
      )
      SELECT
        phone,
        COUNT(*) AS total_lifetime,
        SUM(amount) AS amount_lifetime,
        SUM(CASE WHEN payment_at >= datetime('now','-12 months') THEN 1 ELSE 0 END) AS total_12m,
        SUM(CASE WHEN payment_at >= datetime('now','-12 months') THEN amount ELSE 0 END) AS amount_12m,
        MIN(payment_at) AS first_at,
        MAX(payment_at) AS last_at
      FROM joined
      GROUP BY phone
      `,
    )
    .all() as Array<{
    phone: string;
    total_lifetime: number;
    amount_lifetime: number;
    total_12m: number;
    amount_12m: number;
    first_at: string;
    last_at: string;
  }>;

  // imweb_members 매칭으로 member_code 채우기 (옵션)
  const memberStmt = db.prepare(
    `SELECT member_code FROM imweb_members
     WHERE site = 'thecleancoffee'
       AND REPLACE(REPLACE(callnum, '-', ''), ' ', '') = ?
     LIMIT 1`,
  );

  const upsertStmt = db.prepare(`
    INSERT INTO coffee_subscriber_track (
      phone_normalized, member_code,
      total_payments_lifetime, total_payments_12m,
      total_amount_lifetime, total_amount_12m,
      first_payment_at, last_payment_at,
      current_track, previous_track, track_changed_at,
      churn_risk, last_calculated_at
    ) VALUES (
      @phone, @member_code,
      @total_lifetime, @total_12m,
      @amount_lifetime, @amount_12m,
      @first_at, @last_at,
      @current_track, NULL, @track_changed_at,
      @churn_risk, datetime('now')
    )
    ON CONFLICT(phone_normalized) DO UPDATE SET
      member_code = excluded.member_code,
      total_payments_lifetime = excluded.total_payments_lifetime,
      total_payments_12m = excluded.total_payments_12m,
      total_amount_lifetime = excluded.total_amount_lifetime,
      total_amount_12m = excluded.total_amount_12m,
      first_payment_at = excluded.first_payment_at,
      last_payment_at = excluded.last_payment_at,
      previous_track = CASE
        WHEN coffee_subscriber_track.current_track != excluded.current_track
          THEN coffee_subscriber_track.current_track
        ELSE coffee_subscriber_track.previous_track
      END,
      track_changed_at = CASE
        WHEN coffee_subscriber_track.current_track != excluded.current_track
          THEN datetime('now')
        ELSE coffee_subscriber_track.track_changed_at
      END,
      current_track = excluded.current_track,
      churn_risk = excluded.churn_risk,
      last_calculated_at = datetime('now')
  `);

  const logStmt = db.prepare(`
    INSERT INTO coffee_subscriber_track_log (phone_normalized, from_track, to_track, payments_12m, amount_12m)
    VALUES (?, ?, ?, ?, ?)
  `);

  const getCurrentStmt = db.prepare(
    `SELECT current_track FROM coffee_subscriber_track WHERE phone_normalized = ?`,
  );

  let upserted = 0;
  let trackChanged = 0;
  const byTrack: Record<Track, number> = {
    EVERGREEN: 0,
    MANIAC: 0,
    LOYALIST: 0,
    SUBSCRIBER: 0,
    NONE: 0,
  };
  let churnRisk = 0;

  const now = Date.now();
  const tx = db.transaction((items: typeof rows) => {
    for (const r of items) {
      const newTrack = determineTrack(r.total_12m);
      // 이탈 위험 = 직전 30일 결제 없음 + 트랙 != NONE
      const lastMs = r.last_at ? Date.parse(r.last_at.replace(" ", "T") + "Z") : 0;
      const churn = newTrack !== "NONE" && lastMs > 0 && now - lastMs > 30 * 86400 * 1000 ? 1 : 0;
      if (churn) churnRisk++;
      byTrack[newTrack]++;

      const memberRow = memberStmt.get(r.phone) as { member_code: string } | undefined;
      const memberCode = memberRow?.member_code ?? null;

      const before = getCurrentStmt.get(r.phone) as { current_track: Track } | undefined;
      const prevTrack = before?.current_track ?? null;

      upsertStmt.run({
        phone: r.phone,
        member_code: memberCode,
        total_lifetime: r.total_lifetime,
        total_12m: r.total_12m,
        amount_lifetime: r.amount_lifetime,
        amount_12m: r.amount_12m,
        first_at: r.first_at,
        last_at: r.last_at,
        current_track: newTrack,
        track_changed_at:
          prevTrack && prevTrack !== newTrack ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
        churn_risk: churn,
      });
      upserted++;

      if (prevTrack && prevTrack !== newTrack) {
        trackChanged++;
        logStmt.run(r.phone, prevTrack, newTrack, r.total_12m, r.amount_12m);
      } else if (!prevTrack && newTrack !== "NONE") {
        trackChanged++;
        logStmt.run(r.phone, null, newTrack, r.total_12m, r.amount_12m);
      }
    }
  });
  tx(rows);

  return {
    upserted,
    trackChanged,
    byTrack,
    churnRisk,
    durationMs: Date.now() - t0,
  };
}

export function getSubscriberTrackStats() {
  const db = getCrmDb();
  const byTrack = db
    .prepare(
      `SELECT current_track AS track, COUNT(*) AS customers, SUM(total_amount_12m) AS amount_12m
       FROM coffee_subscriber_track GROUP BY current_track ORDER BY
       CASE current_track WHEN 'EVERGREEN' THEN 1 WHEN 'MANIAC' THEN 2 WHEN 'LOYALIST' THEN 3
                          WHEN 'SUBSCRIBER' THEN 4 ELSE 5 END`,
    )
    .all();
  const churn = db
    .prepare(`SELECT COUNT(*) AS cnt FROM coffee_subscriber_track WHERE churn_risk = 1`)
    .get() as { cnt: number };
  const recentChanges = db
    .prepare(
      `SELECT phone_normalized, from_track, to_track, payments_12m, changed_at
       FROM coffee_subscriber_track_log ORDER BY changed_at DESC LIMIT 20`,
    )
    .all();
  const lastSync = db
    .prepare(`SELECT MAX(last_calculated_at) AS latest FROM coffee_subscriber_track`)
    .get() as { latest: string | null };
  return { byTrack, churnRisk: churn.cnt, recentChanges, lastSync: lastSync.latest };
}
