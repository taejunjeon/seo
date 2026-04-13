/**
 * CRM 로컬 실험 API
 *
 * 운영 DB는 읽기만, 실험 데이터는 로컬 SQLite에 저장.
 * revenue API 프록시 대신 직접 관리.
 */

import express, { type NextFunction, type Request, type Response } from "express";
import {
  cancelScheduledSend,
  archiveCustomerGroup,
  canArchiveGroup,
  createScheduledSend,
  createAssignment,
  createExperiment,
  getCrmDb,
  getDbStats,
  getExperiment,
  getExperimentResults,
  getImwebMemberByPhone,
  getImwebMemberByMemberCode,
  getImwebMemberConsentStats,
  getImwebCouponBackfillStats,
  getImwebOrderStats,
  getImwebTossReconcileReport,
  listUnmappedImwebIssueCouponCodes,
  listRepurchaseCandidates,
  listBirthdayMembers,
  getLeadOverview,
  listAssignments,
  listExperiments,
  listExperimentsWithMeta,
  updateVariantAliases,
  listLeadProfiles,
  recordConversion,
  recordConsent,
  recordLeadEvent,
  recordMessage,
  upsertImwebMembers,
  upsertImwebOrders,
  upsertLeadProfile,
  updateExperimentStatus,
  upsertImwebCouponMasters,
  upsertImwebIssueCoupons,
  createRepurchaseAbExperiment,
  getAbSummary,
  getExperimentFunnel,
  listCustomerGroups,
  getCustomerGroup,
  getCustomerGroupStats,
  createCustomerGroup,
  deleteCustomerGroup,
  listGroupMembers,
  addGroupMembers,
  deleteGroupMembers,
  createGroupFromExperiment,
  getScheduledSend,
  listScheduledSends,
  createSavedSegment,
  listSavedSegments,
  getSavedSegment,
  deleteSavedSegment,
  listMessageLog,
  listCustomers,
  listShoppingGrades,
  queryCustomerSegment,
  listConsentChanges,
  getConsentChangeById,
  recordConsentChange,
  type CustomerGroupKind,
  type ImwebMemberRow,
  type ImwebOrderRow,
  type ImwebCouponMasterRow,
  type ImwebIssueCouponRow,
  type ScheduledSendStatus,
  type SavedSegmentRow,
} from "../crmLocalDb";
import { env } from "../env";
import { log } from "../obs";
import { isDatabaseConfigured, queryPg } from "../postgres";
import { evaluateSegment, type SegmentEvaluationOutcome, type SegmentQuery } from "../segmentDsl";

export const createCrmLocalRouter = () => {
  const router = express.Router();
  const readParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] ?? "" : value ?? "");
  const bulkUploadFile = createBulkUploadMiddleware();

  // 실험 목록 (?meta=true 시 배정/전환/메시지 집계 포함 — 로컬 SQLite만 읽음)
  router.get("/api/crm-local/experiments", (req: Request, res: Response) => {
    try {
      const withMeta = req.query.meta === "true" || req.query.meta === "1";
      const experiments = withMeta ? listExperimentsWithMeta() : listExperiments();
      res.json({ ok: true, experiments });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // variant alias 업데이트 (로컬 SQLite만 수정)
  router.patch("/api/crm-local/experiments/:key/aliases", (req: Request, res: Response) => {
    try {
      const key = readParam(req.params.key);
      const aliases = req.body?.aliases;
      if (!aliases || typeof aliases !== "object") {
        res.status(400).json({ ok: false, error: "aliases 객체가 필요하다. 예: {\"t2h_24h\": \"2시간 후 발송\"}" });
        return;
      }
      updateVariantAliases(key, aliases);
      res.json({ ok: true, experimentKey: key, aliases });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 실험 생성
  router.post("/api/crm-local/experiments", (req: Request, res: Response) => {
    try {
      const {
        experiment_key,
        name,
        description,
        channel,
        hypothesis,
        variant_weights,
        funnel_stage,
        asset_id,
        lead_magnet_id,
        conversion_window_days,
      } = req.body;
      if (!experiment_key || !name) {
        res.status(400).json({ ok: false, error: "experiment_key and name are required" });
        return;
      }
      const experiment = createExperiment({
        experiment_key,
        name,
        description,
        channel,
        hypothesis,
        variant_weights,
        funnel_stage,
        asset_id,
        lead_magnet_id,
        conversion_window_days,
      });
      res.json({ ok: true, experiment });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 실험 상세
  router.get("/api/crm-local/experiments/:key", (req: Request, res: Response) => {
    try {
      const experimentKey = readParam(req.params.key);
      const experiment = getExperiment(experimentKey);
      if (!experiment) { res.status(404).json({ ok: false, error: "Experiment not found" }); return; }
      res.json({ ok: true, experiment });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 실험 상태 변경
  router.patch("/api/crm-local/experiments/:key/status", (req: Request, res: Response) => {
    try {
      const experimentKey = readParam(req.params.key);
      const { status } = req.body;
      if (!status) { res.status(400).json({ ok: false, error: "status is required" }); return; }
      updateExperimentStatus(experimentKey, status);
      res.json({ ok: true, experiment: getExperiment(experimentKey) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 실험 결과
  router.get("/api/crm-local/experiments/:key/results", (req: Request, res: Response) => {
    try {
      res.json({ ok: true, ...getExperimentResults(readParam(req.params.key)) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 배정 목록
  router.get("/api/crm-local/experiments/:key/assignments", (req: Request, res: Response) => {
    try {
      const experimentKey = readParam(req.params.key);
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      res.json({ ok: true, ...listAssignments(experimentKey, limit, offset) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 배정 추가
  router.post("/api/crm-local/experiments/:key/assignments", (req: Request, res: Response) => {
    try {
      const experimentKey = readParam(req.params.key);
      const assignments = Array.isArray(req.body) ? req.body : [req.body];
      for (const a of assignments) {
        createAssignment({
          experiment_key: experimentKey,
          customer_key: a.customer_key,
          variant_key: a.variant_key,
          assignment_version: a.assignment_version,
          assignment_bucket: a.assignment_bucket,
          source_segment: a.source_segment,
        });
      }
      res.json({ ok: true, added: assignments.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 전환 기록
  router.post("/api/crm-local/experiments/:key/conversions", (req: Request, res: Response) => {
    try {
      const experimentKey = readParam(req.params.key);
      const conversions = Array.isArray(req.body) ? req.body : [req.body];
      for (const c of conversions) {
        recordConversion({
          experiment_key: experimentKey,
          customer_key: c.customer_key,
          order_id: c.order_id,
          conversion_type: c.conversion_type,
          revenue_amount: c.revenue_amount,
          refund_amount: c.refund_amount,
        });
      }
      res.json({ ok: true, added: conversions.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 메시지 로그
  router.post("/api/crm-local/messages", (req: Request, res: Response) => {
    try {
      recordMessage(req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // DB 통계
  router.get("/api/crm-local/stats", (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, ...getDbStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 리드 개요
  router.get("/api/crm-local/leads/overview", (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, overview: getLeadOverview() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 리드 목록
  router.get("/api/crm-local/leads", (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      res.json({ ok: true, ...listLeadProfiles(limit, offset) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 리드 프로필 upsert
  router.post("/api/crm-local/leads", (req: Request, res: Response) => {
    try {
      if (!req.body?.lead_id) {
        res.status(400).json({ ok: false, error: "lead_id is required" });
        return;
      }
      const profile = upsertLeadProfile(req.body);
      res.json({ ok: true, profile });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 리드 이벤트 기록
  router.post("/api/crm-local/leads/events", (req: Request, res: Response) => {
    try {
      if (!req.body?.lead_id || !req.body?.event_name) {
        res.status(400).json({ ok: false, error: "lead_id and event_name are required" });
        return;
      }
      const event = recordLeadEvent(req.body);
      res.json({ ok: true, event });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 리드 동의 기록
  router.post("/api/crm-local/leads/consents", (req: Request, res: Response) => {
    try {
      if (!req.body?.lead_id || !req.body?.consent_status) {
        res.status(400).json({ ok: false, error: "lead_id and consent_status are required" });
        return;
      }
      recordConsent(req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // 전환 동기화: 운영 DB 주문 데이터 → 실험 배정 고객의 전환 자동 매핑
  router.post("/api/crm-local/experiments/:key/sync-conversions", async (req: Request, res: Response) => {
    try {
      if (!isDatabaseConfigured()) {
        res.status(503).json({ ok: false, error: "운영 DB 연결이 필요합니다 (DATABASE_URL)" });
        return;
      }

      const experimentKey = readParam(req.params.key);
      const experiment = getExperiment(experimentKey);
      if (!experiment) {
        res.status(404).json({ ok: false, error: "Experiment not found" });
        return;
      }

      // 이 실험에 배정된 고객의 customer_key(= 정규화된 전화번호) 목록
      const db = getCrmDb();
      const assignments = db.prepare(
        "SELECT DISTINCT customer_key FROM crm_assignment_log WHERE experiment_key = ?",
      ).all(experimentKey) as Array<{ customer_key: string }>;

      if (assignments.length === 0) {
        res.json({ ok: true, synced: 0, message: "배정된 고객이 없습니다" });
        return;
      }

      const customerKeys = assignments.map((a) => a.customer_key);
      const parseTimestampMs = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59.999` : trimmed.replace(" ", "T");
        const ms = Date.parse(normalized);
        return Number.isFinite(ms) ? ms : null;
      };

      const sentRows = db.prepare(`
        SELECT customer_key, MIN(sent_at) AS sent_at
        FROM crm_message_log
        WHERE experiment_key = ? AND provider_status = 'success'
        GROUP BY customer_key
      `).all(experimentKey) as Array<{ customer_key: string; sent_at: string }>;

      const firstSentAtByPhone = new Map<string, number>();
      for (const row of sentRows) {
        const sentAt = parseTimestampMs(String(row.sent_at ?? ""));
        if (row.customer_key && sentAt !== null) {
          firstSentAtByPhone.set(row.customer_key, sentAt);
        }
      }

      const sentCustomerKeys = customerKeys.filter((customerKey) => firstSentAtByPhone.has(customerKey));
      if (sentCustomerKeys.length === 0) {
        res.json({ ok: true, synced: 0, totalOrders: 0, assignedCustomers: customerKeys.length });
        return;
      }

      // 운영 DB에서 이 고객들의 주문 조회 (전화번호 정규화 매칭)
      const placeholders = sentCustomerKeys.map((_, i) => `$${i + 1}`).join(",");
      const result = await queryPg<{
        normalized_phone: string;
        order_number: string;
        net_revenue: number;
        order_date: string;
      }>(
        `SELECT
          regexp_replace(coalesce(customer_number::text, ''), '[^0-9]', '', 'g') AS normalized_phone,
          coalesce(order_number::text, '') AS order_number,
          greatest(
            coalesce(nullif(final_order_amount, 0), nullif(paid_price, 0), nullif(total_price, 0), 0)
              - coalesce(total_refunded_price, 0),
            0
          ) AS net_revenue,
          coalesce(
            trim(coalesce(payment_complete_time::text, order_date::text, '')),
            ''
          ) AS order_date
        FROM tb_iamweb_users
        WHERE regexp_replace(coalesce(customer_number::text, ''), '[^0-9]', '', 'g') IN (${placeholders})
          AND coalesce(order_number::text, '') != ''
        ORDER BY order_date DESC`,
        sentCustomerKeys,
      );

      let synced = 0;
      const windowMs = experiment.conversion_window_days * 24 * 60 * 60 * 1000;
      for (const row of result.rows) {
        if (!row.order_number || !row.normalized_phone) continue;
        const sentAt = firstSentAtByPhone.get(row.normalized_phone);
        const orderAt = parseTimestampMs(String(row.order_date ?? ""));
        if (sentAt === undefined || orderAt === null) continue;
        if (orderAt < sentAt || orderAt > sentAt + windowMs) continue;
        try {
          recordConversion({
            experiment_key: experimentKey,
            customer_key: row.normalized_phone,
            order_id: row.order_number,
            conversion_type: "purchase",
            revenue_amount: Number(row.net_revenue) || 0,
            refund_amount: 0,
          });
          synced++;
        } catch {
          // UNIQUE 충돌 무시 (이미 동기화된 건)
        }
      }

      res.json({
        ok: true,
        synced,
        totalOrders: result.rows.length,
        assignedCustomers: customerKeys.length,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Sync failed" });
    }
  });

  // ── 아임웹 회원 동기화 ──

  type ImwebSiteConfig = { key: string; secret: string; site: string };

  const IMWEB_SITES: ImwebSiteConfig[] = [
    { key: env.IMWEB_API_KEY ?? "", secret: env.IMWEB_SECRET_KEY ?? "", site: "biocom" },
    { key: env.IMWEB_API_KEY_COFFEE ?? "", secret: env.IMWEB_SECRET_KEY_COFFEE ?? "", site: "thecleancoffee" },
    { key: env.IMWEB_API_KEY_LAB ?? "", secret: env.IMWEB_SECRET_KEY_LAB ?? "", site: "aibio" },
  ].filter((s) => s.key && s.secret);

  const fetchImwebToken = async (apiKey?: string, secretKey?: string) => {
    const res = await fetch("https://api.imweb.me/v2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey ?? env.IMWEB_API_KEY ?? "", secret: secretKey ?? env.IMWEB_SECRET_KEY ?? "" }),
    });
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? "";
  };

  const fetchImwebMembersPage = async (token: string, page: number, limit = 100) => {
    const res = await fetch(
      `https://api.imweb.me/v2/member/members?orderBy=jointime&offset=${page}&limit=${limit}`,
      { headers: { "Content-Type": "application/json", "access-token": token } },
    );
    const data = (await res.json()) as {
      code?: number;
      data?: {
        list?: Array<Record<string, unknown>>;
        pagenation?: { data_count?: string; total_page?: string | number };
      };
    };
    return {
      list: data.data?.list ?? [],
      totalCount: Number.parseInt(String(data.data?.pagenation?.data_count ?? "0"), 10),
      totalPage: Number.parseInt(String(data.data?.pagenation?.total_page ?? "0"), 10),
    };
  };

  const fetchImwebOrdersPage = async (token: string, page: number, limit = 50) => {
    const res = await fetch(
      `https://api.imweb.me/v2/shop/orders?offset=${page}&limit=${limit}`,
      { headers: { "Content-Type": "application/json", "access-token": token } },
    );
    const data = (await res.json()) as {
      code?: number;
      msg?: string;
      data?: {
        list?: Array<Record<string, unknown>>;
        pagenation?: { data_count?: string | number; total_page?: string | number };
      };
    };
    return {
      list: data.data?.list ?? [],
      totalCount: Number.parseInt(String(data.data?.pagenation?.data_count ?? "0"), 10),
      totalPage: Number.parseInt(String(data.data?.pagenation?.total_page ?? "0"), 10),
      error: data.msg ?? null,
    };
  };

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const fetchImwebCouponMastersPage = async (token: string, page: number, limit = 100) => {
    const res = await fetch(
      `https://api.imweb.me/v2/shop/coupons?offset=${page}&limit=${limit}`,
      { headers: { "Content-Type": "application/json", "access-token": token } },
    );
    const data = (await res.json()) as {
      code?: number;
      msg?: string;
      data?: {
        list?: Array<Record<string, unknown>>;
        pagenation?: { data_count?: string | number; total_page?: string | number };
      } | Array<Record<string, unknown>>;
    };
    const dataValue = data.data;
    const list = Array.isArray(dataValue) ? dataValue : dataValue?.list ?? [];
    const pagination = Array.isArray(dataValue) ? undefined : dataValue?.pagenation;
    return {
      list,
      totalCount: Number.parseInt(String(pagination?.data_count ?? list.length ?? "0"), 10),
      totalPage: Number.parseInt(String(pagination?.total_page ?? (list.length ? "1" : "0")), 10),
      error: data.code && data.code !== 200 ? data.msg ?? `Imweb coupon API code ${data.code}` : null,
    };
  };

  const fetchImwebIssueCoupon = async (token: string, issueCouponCode: string) => {
    const res = await fetch(
      `https://api.imweb.me/v2/shop/issue-coupons/${encodeURIComponent(issueCouponCode)}`,
      { headers: { "Content-Type": "application/json", "access-token": token } },
    );
    const data = (await res.json()) as { code?: number; msg?: string; data?: Record<string, unknown> };
    return {
      coupon: data.data ?? null,
      error: res.ok && data.code === 200 ? null : data.msg ?? `Imweb issue coupon API code ${data.code ?? res.status}`,
    };
  };

  const fetchImwebIssueCouponWithRetry = async (token: string, issueCouponCode: string) => {
    const first = await fetchImwebIssueCoupon(token, issueCouponCode);
    const error = first.error?.toUpperCase() ?? "";
    if (!error.includes("TOO MANY REQUEST") && !error.includes("429")) {
      return first;
    }
    await wait(1200);
    return fetchImwebIssueCoupon(token, issueCouponCode);
  };

  const toImwebRow = (m: Record<string, unknown>, site = "biocom"): ImwebMemberRow => ({
    member_code: String(m.member_code ?? ""),
    uid: String(m.uid ?? ""),
    name: String(m.name ?? ""),
    callnum: String(m.callnum ?? ""),
    email: String(m.email ?? ""),
    birth: String(m.birth ?? ""),
    marketing_agree_sms: String(m.marketing_agree_sms ?? "N"),
    marketing_agree_email: String(m.marketing_agree_email ?? "N"),
    third_party_agree: String(m.third_party_agree ?? "N"),
    member_grade: String(m.member_grade ?? ""),
    join_time: String(m.join_time ?? ""),
    last_login_time: String(m.last_login_time ?? ""),
    site,
  });

  const toIsoDateTime = (value: unknown) => {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return null;
    }
    return new Date(seconds * 1000).toISOString();
  };

  const toImwebOrderRow = (order: Record<string, unknown>, site = "biocom"): ImwebOrderRow => {
    const payment = (order.payment ?? {}) as Record<string, unknown>;
    const orderer = (order.orderer ?? {}) as Record<string, unknown>;
    const device = (order.device ?? {}) as Record<string, unknown>;
    const issueCouponCodes = Array.isArray(order.use_issue_coupon_codes)
      ? order.use_issue_coupon_codes.map((code) => String(code))
      : [];
    const orderNo = String(order.order_no ?? "");

    return {
      order_key: `${site}:${orderNo}`,
      site,
      order_no: orderNo,
      order_code: String(order.order_code ?? ""),
      channel_order_no: String(order.channel_order_no ?? ""),
      order_type: String(order.order_type ?? ""),
      sale_channel_idx: Number.isFinite(Number(order.sale_channel_idx)) ? Number(order.sale_channel_idx) : null,
      device_type: String(device.type ?? ""),
      order_time_unix: Number.isFinite(Number(order.order_time)) ? Number(order.order_time) : null,
      order_time: toIsoDateTime(order.order_time),
      complete_time_unix: Number.isFinite(Number(order.complete_time)) && Number(order.complete_time) > 0
        ? Number(order.complete_time)
        : null,
      complete_time: toIsoDateTime(order.complete_time),
      member_code: String(orderer.member_code ?? ""),
      orderer_name: String(orderer.name ?? ""),
      orderer_call: String(orderer.call ?? ""),
      pay_type: String(payment.pay_type ?? ""),
      pg_type: String(payment.pg_type ?? ""),
      price_currency: String(payment.price_currency ?? "KRW"),
      total_price: Number(payment.total_price ?? 0) || 0,
      payment_amount: Number(payment.payment_amount ?? 0) || 0,
      coupon_amount: Number(payment.coupon ?? 0) || 0,
      delivery_price: Number(payment.deliv_price ?? 0) || 0,
      use_issue_coupon_codes: JSON.stringify(issueCouponCodes),
      raw_json: JSON.stringify(order),
    };
  };

  const toImwebCouponMasterRow = (coupon: Record<string, unknown>, site = "biocom"): ImwebCouponMasterRow => {
    const couponCode = String(coupon.coupon_code ?? coupon.code ?? "");
    return {
      coupon_key: `${site}:${couponCode}`,
      site,
      coupon_code: couponCode,
      name: String(coupon.name ?? ""),
      status: String(coupon.status ?? ""),
      type: String(coupon.type ?? ""),
      apply_sale_price: Number(coupon.apply_sale_price ?? 0) || 0,
      apply_sale_percent: Number(coupon.apply_sale_percent ?? 0) || 0,
      type_coupon_create_count: Number(coupon.type_coupon_create_count ?? 0) || 0,
      type_coupon_use_count: Number(coupon.type_coupon_use_count ?? 0) || 0,
      raw_json: JSON.stringify(coupon),
    };
  };

  const toImwebIssueCouponRow = (
    issueCouponCode: string,
    coupon: Record<string, unknown>,
    site = "biocom",
  ): ImwebIssueCouponRow => ({
    issue_key: `${site}:${issueCouponCode}`,
    site,
    issue_coupon_code: issueCouponCode,
    coupon_code: String(coupon.coupon_code ?? ""),
    name: String(coupon.name ?? ""),
    status: String(coupon.status ?? ""),
    type: String(coupon.type ?? ""),
    coupon_issue_code: String(coupon.coupon_issue_code ?? ""),
    shop_order_code: String(coupon.shop_order_code ?? ""),
    use_date: String(coupon.use_date ?? ""),
    raw_json: JSON.stringify(coupon),
  });

  const syncOneSite = async (cfg: ImwebSiteConfig, maxPage: number) => {
    let token = await fetchImwebToken(cfg.key, cfg.secret);
    if (!token) return { site: cfg.site, synced: 0, totalCount: 0, error: "토큰 발급 실패" };

    let totalSynced = 0;
    let totalCount = 0;
    let totalPage = 0;
    let emptyStreak = 0;

    const first = await fetchImwebMembersPage(token, 0);
    if (first.totalCount > 0) totalCount = first.totalCount;
    if (first.totalPage > 0) totalPage = first.totalPage;
    if (first.list.length > 0) {
      upsertImwebMembers(first.list.map((m) => toImwebRow(m, cfg.site)));
      totalSynced += first.list.length;
    }

    for (let page = 4; page <= Math.min(maxPage, totalPage || maxPage); page++) {
      if (page % 200 === 0) {
        token = await fetchImwebToken(cfg.key, cfg.secret);
      }

      const { list: members } = await fetchImwebMembersPage(token, page);
      if (members.length === 0) {
        emptyStreak++;
        if (emptyStreak >= 5) break;
        continue;
      }
      emptyStreak = 0;
      upsertImwebMembers(members.map((m) => toImwebRow(m, cfg.site)));
      totalSynced += members.length;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { site: cfg.site, synced: totalSynced, totalCount };
  };

  const syncOneSiteOrders = async (cfg: ImwebSiteConfig, maxPage: number) => {
    const token = await fetchImwebToken(cfg.key, cfg.secret);
    if (!token) {
      return { site: cfg.site, synced: 0, totalCount: 0, totalPage: 0, error: "토큰 발급 실패" };
    }

    const first = await fetchImwebOrdersPage(token, 1);
    if (first.error && first.list.length === 0) {
      return { site: cfg.site, synced: 0, totalCount: 0, totalPage: 0, error: first.error };
    }

    let totalSynced = 0;
    let totalCount = first.totalCount;
    let totalPage = first.totalPage;
    let emptyStreak = 0;

    if (first.list.length > 0) {
      upsertImwebOrders(first.list.map((item) => toImwebOrderRow(item, cfg.site)));
      totalSynced += first.list.length;
    }

    const scanPageMax = Math.min(maxPage, Math.max((totalPage || 0) * 2 + 5, 20));
    for (let page = 2; page <= scanPageMax && totalSynced < totalCount; page++) {
      const current = await fetchImwebOrdersPage(token, page);
      if (current.list.length === 0) {
        emptyStreak++;
        if (emptyStreak >= 20 && totalSynced > 0) {
          break;
        }
        continue;
      }
      emptyStreak = 0;
      upsertImwebOrders(current.list.map((item) => toImwebOrderRow(item, cfg.site)));
      totalSynced += current.list.length;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return { site: cfg.site, synced: totalSynced, totalCount, totalPage, error: null };
  };

  const syncOneSiteCoupons = async (
    cfg: ImwebSiteConfig,
    options: { maxCouponPage: number; maxIssueCodes: number; issueBatchSize: number; issueConcurrency: number },
  ) => {
    let token = await fetchImwebToken(cfg.key, cfg.secret);
    if (!token) {
      return {
        site: cfg.site,
        couponMastersSynced: 0,
        issueCouponsSynced: 0,
        issueCouponErrors: 0,
        remainingUnmappedIssueCodes: 0,
        error: "토큰 발급 실패",
      };
    }

    let couponMastersSynced = 0;
    let totalCouponMasters = 0;
    let totalCouponMasterPages = 0;
    const firstCoupons = await fetchImwebCouponMastersPage(token, 1);
    if (firstCoupons.error && firstCoupons.list.length === 0) {
      return {
        site: cfg.site,
        couponMastersSynced: 0,
        issueCouponsSynced: 0,
        issueCouponErrors: 0,
        remainingUnmappedIssueCodes: 0,
        error: firstCoupons.error,
      };
    }

    if (firstCoupons.list.length > 0) {
      upsertImwebCouponMasters(firstCoupons.list.map((coupon) => toImwebCouponMasterRow(coupon, cfg.site)));
      couponMastersSynced += firstCoupons.list.length;
    }
    totalCouponMasters = firstCoupons.totalCount;
    totalCouponMasterPages = firstCoupons.totalPage;

    const couponPageUpperBound = Math.min(
      options.maxCouponPage,
      Math.max(totalCouponMasterPages || 1, 1),
    );
    for (let page = 2; page <= couponPageUpperBound; page++) {
      const current = await fetchImwebCouponMastersPage(token, page);
      if (current.list.length === 0) {
        continue;
      }
      upsertImwebCouponMasters(current.list.map((coupon) => toImwebCouponMasterRow(coupon, cfg.site)));
      couponMastersSynced += current.list.length;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    let issueCouponsSynced = 0;
    let issueCouponErrors = 0;
    const issueErrors: Array<{ issueCouponCode: string; error: string }> = [];

    while (issueCouponsSynced + issueCouponErrors < options.maxIssueCodes) {
      const remainingBudget = options.maxIssueCodes - issueCouponsSynced - issueCouponErrors;
      const batch = listUnmappedImwebIssueCouponCodes(
        cfg.site,
        Math.min(options.issueBatchSize, remainingBudget),
      );
      if (batch.length === 0) {
        break;
      }

      const issueCouponCodes = batch
        .map((item) => String(item.issue_coupon_code ?? ""))
        .filter((issueCouponCode) => issueCouponCode.length > 0);
      if (issueCouponCodes.length === 0) {
        break;
      }

      const mappedRows: ImwebIssueCouponRow[] = [];
      for (let index = 0; index < issueCouponCodes.length; index += options.issueConcurrency) {
        if ((issueCouponsSynced + issueCouponErrors) % 400 === 0) {
          token = (await fetchImwebToken(cfg.key, cfg.secret)) ?? token;
        }

        const currentToken = token;
        const chunk = issueCouponCodes.slice(index, index + options.issueConcurrency);
        const results = await Promise.all(
          chunk.map(async (issueCouponCode) => {
            try {
              const current = await fetchImwebIssueCouponWithRetry(currentToken, issueCouponCode);
              if (!current.coupon || current.error) {
                return {
                  issueCouponCode,
                  row: null,
                  error: current.error ?? "unknown issue coupon error",
                };
              }
              return {
                issueCouponCode,
                row: toImwebIssueCouponRow(issueCouponCode, current.coupon, cfg.site),
                error: null,
              };
            } catch (err) {
              return {
                issueCouponCode,
                row: null,
                error: err instanceof Error ? err.message : "issue coupon fetch failed",
              };
            }
          }),
        );

        for (const result of results) {
          if (result.row) {
            mappedRows.push(result.row);
            issueCouponsSynced++;
            continue;
          }
          issueCouponErrors++;
          if (issueErrors.length < 10) {
            issueErrors.push({ issueCouponCode: result.issueCouponCode, error: result.error ?? "unknown issue coupon error" });
          }
        }

        await wait(120);
      }
      upsertImwebIssueCoupons(mappedRows);
    }

    const stats = getImwebCouponBackfillStats(cfg.site);
    return {
      site: cfg.site,
      couponMastersSynced,
      totalCouponMasters,
      totalCouponMasterPages,
      issueCouponsSynced,
      issueCouponErrors,
      issueErrors,
      remainingUnmappedIssueCodes: Math.max(stats.sourceIssueCouponCodes - stats.mappedIssueCoupons, 0),
      stats,
      error: null,
    };
  };

  const inspectImwebOrderPagination = async (cfg: ImwebSiteConfig, maxPage: number) => {
    const token = await fetchImwebToken(cfg.key, cfg.secret);
    if (!token) {
      return {
        site: cfg.site,
        declaredTotalCount: 0,
        declaredTotalPage: 0,
        fetchedUniqueOrders: 0,
        coverageRate: 0,
        nonEmptyPages: [],
        emptyPages: [],
        status: "token_failed",
      };
    }

    const first = await fetchImwebOrdersPage(token, 1, 25);
    const declaredTotalCount = first.totalCount;
    const declaredTotalPage = first.totalPage;
    const pageUpperBound = Math.min(maxPage, Math.max((declaredTotalPage || 0) + 48, 120));
    const uniqueOrders = new Set<string>();
    const nonEmptyPages: number[] = [];
    const emptyPages: number[] = [];

    const absorb = (page: number, rows: Array<Record<string, unknown>>) => {
      if (rows.length === 0) {
        emptyPages.push(page);
        return;
      }
      nonEmptyPages.push(page);
      for (const row of rows) {
        const orderNo = String(row.order_no ?? "");
        if (orderNo) uniqueOrders.add(orderNo);
      }
    };

    absorb(1, first.list);

    for (let page = 2; page <= pageUpperBound; page++) {
      const current = await fetchImwebOrdersPage(token, page, 25);
      absorb(page, current.list);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    const fetchedUniqueOrders = uniqueOrders.size;
    const coverageRate = declaredTotalCount > 0 ? fetchedUniqueOrders / declaredTotalCount : 0;

    return {
      site: cfg.site,
      declaredTotalCount,
      declaredTotalPage,
      fetchedUniqueOrders,
      coverageRate,
      nonEmptyPages,
      emptyPages,
      status: fetchedUniqueOrders >= declaredTotalCount ? "complete" : "anomaly_detected",
    };
  };

  router.post("/api/crm-local/imweb/sync-members", async (req: Request, res: Response) => {
    try {
      if (IMWEB_SITES.length === 0) {
        res.status(400).json({ ok: false, error: "IMWEB API 키 미설정" });
        return;
      }

      const maxPage = typeof req.body?.maxPage === "number" ? Math.min(req.body.maxPage, 800) : 750;
      const targetSite = typeof req.body?.site === "string" ? req.body.site : null;

      const sites = targetSite ? IMWEB_SITES.filter((s) => s.site === targetSite) : IMWEB_SITES;
      const results = [];

      for (const cfg of sites) {
        const result = await syncOneSite(cfg, maxPage);
        results.push(result);
      }

      const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
      const stats = getImwebMemberConsentStats();

      res.json({
        ok: true,
        synced: totalSynced,
        sites: results,
        consentStats: stats,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Sync failed" });
    }
  });

  router.get("/api/crm-local/imweb/consent-stats", (_req: Request, res: Response) => {
    try {
      const stats = getImwebMemberConsentStats();
      res.json({ ok: true, ...stats });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Stats failed" });
    }
  });

  router.get("/api/crm-local/consent-audit", (req: Request, res: Response) => {
    try {
      const site = readParam(req.query.site as string) || undefined;
      const memberCode = readParam(req.query.memberCode as string) || undefined;
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const result = listConsentChanges({ site, memberCode, limit, offset });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "consent audit failed" });
    }
  });

  router.post("/api/crm-local/consent-audit/manual", (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const memberCode = readRequiredBodyString(body.memberCode);
      const field = readRequiredBodyString(body.field);
      const newValue = readRequiredBodyString(body.newValue);
      const note = readRequiredBodyString(body.note);
      const errors: ValidationError[] = [];

      if (!memberCode) errors.push({ field: "memberCode", code: "required", message: "memberCode 필요" });
      if (field !== "marketing_agree_sms" && field !== "marketing_agree_email") {
        errors.push({ field: "field", code: "invalid", message: "field는 marketing_agree_sms 또는 marketing_agree_email이어야 한다" });
      }
      if (newValue !== "Y" && newValue !== "N") {
        errors.push({ field: "newValue", code: "invalid", message: "newValue는 Y 또는 N이어야 한다" });
      }
      if (!note || note.length < 3) {
        errors.push({ field: "note", code: "min_length", message: "note는 3자 이상 필요" });
      }

      if (errors.length > 0) {
        sendValidationErrors(res, 400, errors);
        return;
      }

      const member = getImwebMemberByMemberCode(memberCode!);
      if (!member) {
        sendValidationErrors(res, 404, [{ field: "memberCode", code: "not_found", message: "회원을 찾을 수 없다" }]);
        return;
      }

      const id = recordConsentChange({
        site: member.site || "biocom",
        member_code: member.member_code,
        phone: member.callnum || null,
        field: field!,
        old_value: String(member[field as "marketing_agree_sms" | "marketing_agree_email"] ?? ""),
        new_value: newValue!,
        source: "admin_manual",
        note: note!,
      });
      const entry = getConsentChangeById(id);
      res.json({ ok: true, entry });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "manual consent audit failed" });
    }
  });

  router.get("/api/crm-local/imweb/consent-check", (req: Request, res: Response) => {
    try {
      const phone = readParam(req.query.phone as string);
      if (!phone) {
        res.status(400).json({ ok: false, error: "phone 파라미터 필요" });
        return;
      }
      const member = getImwebMemberByPhone(phone);
      if (!member) {
        res.json({ ok: true, found: false, phone });
        return;
      }
      res.json({
        ok: true,
        found: true,
        phone,
        name: member.name,
        marketing_agree_sms: member.marketing_agree_sms,
        marketing_agree_email: member.marketing_agree_email,
        third_party_agree: member.third_party_agree,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Check failed" });
    }
  });

  router.post("/api/crm-local/imweb/sync-orders", async (req: Request, res: Response) => {
    try {
      if (IMWEB_SITES.length === 0) {
        res.status(400).json({ ok: false, error: "IMWEB API 키 미설정" });
        return;
      }

      const maxPage = typeof req.body?.maxPage === "number" ? Math.min(req.body.maxPage, 500) : 120;
      const targetSite = typeof req.body?.site === "string" ? req.body.site : null;
      const sites = targetSite ? IMWEB_SITES.filter((site) => site.site === targetSite) : IMWEB_SITES;

      if (sites.length === 0) {
        res.status(404).json({ ok: false, error: "해당 site 설정을 찾지 못함" });
        return;
      }

      const results = [];
      for (const cfg of sites) {
        results.push(await syncOneSiteOrders(cfg, maxPage));
      }

      const totalSynced = results.reduce((sum, item) => sum + item.synced, 0);
      res.json({
        ok: true,
        synced: totalSynced,
        sites: results,
        stats: getImwebOrderStats(targetSite ?? undefined),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Order sync failed" });
    }
  });

  router.post("/api/crm-local/imweb/sync-coupons", async (req: Request, res: Response) => {
    try {
      if (IMWEB_SITES.length === 0) {
        res.status(400).json({ ok: false, error: "IMWEB API 키 미설정" });
        return;
      }

      const targetSite = typeof req.body?.site === "string" ? req.body.site : null;
      const sites = targetSite ? IMWEB_SITES.filter((site) => site.site === targetSite) : IMWEB_SITES;
      if (sites.length === 0) {
        res.status(404).json({ ok: false, error: "해당 site 설정을 찾지 못함" });
        return;
      }

      const maxCouponPage = Math.min(Math.max(Number(req.body?.maxCouponPage) || 10, 1), 100);
      const maxIssueCodes = Math.min(Math.max(Number(req.body?.maxIssueCodes) || 3000, 1), 20000);
      const issueBatchSize = Math.min(Math.max(Number(req.body?.issueBatchSize) || 200, 1), 500);
      const issueConcurrency = Math.min(Math.max(Number(req.body?.issueConcurrency) || 2, 1), 6);

      const results = [];
      for (const cfg of sites) {
        results.push(await syncOneSiteCoupons(cfg, { maxCouponPage, maxIssueCodes, issueBatchSize, issueConcurrency }));
      }

      res.json({
        ok: true,
        sites: results,
        stats: targetSite ? getImwebCouponBackfillStats(targetSite) : getImwebCouponBackfillStats(),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Coupon sync failed" });
    }
  });

  router.get("/api/crm-local/imweb/coupon-stats", (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" ? req.query.site : undefined;
      res.json({ ok: true, ...getImwebCouponBackfillStats(site) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Coupon stats failed" });
    }
  });

  router.get("/api/crm-local/imweb/order-stats", (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" ? req.query.site : undefined;
      res.json({ ok: true, ...getImwebOrderStats(site) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Order stats failed" });
    }
  });

  router.get("/api/crm-local/imweb/toss-reconcile", (req: Request, res: Response) => {
    try {
      const site = readParam(req.query.site as string | string[] | undefined);
      if (!site) {
        res.status(400).json({ ok: false, error: "site 파라미터 필요" });
        return;
      }

      const limit = Math.min(Math.max(Number(readParam(req.query.limit as string | string[] | undefined)) || 20, 1), 100);
      const lookbackDays = Math.min(Math.max(Number(readParam(req.query.lookbackDays as string | string[] | undefined)) || 90, 1), 3650);

      const report = getImwebTossReconcileReport({ site, limit, lookbackDays });
      res.json({ ok: true, report });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Imweb/Toss reconcile failed" });
    }
  });

  router.get("/api/crm-local/repurchase-candidates", (req: Request, res: Response) => {
    try {
      const site = readParam(req.query.site as string | string[] | undefined);
      if (!site) {
        res.status(400).json({ ok: false, error: "site 파라미터 필요" });
        return;
      }

      const minDaysSinceLastPurchase = Math.max(Number(readParam(req.query.minDaysSinceLastPurchase as string | string[] | undefined)) || 30, 0);
      const maxDaysSinceLastPurchase = Math.max(Number(readParam(req.query.maxDaysSinceLastPurchase as string | string[] | undefined)) || 180, 0);
      const minPurchaseCount = Math.max(Number(readParam(req.query.minPurchaseCount as string | string[] | undefined)) || 1, 1);
      const limit = Math.min(Math.max(Number(readParam(req.query.limit as string | string[] | undefined)) || 50, 1), 5000);

      if (maxDaysSinceLastPurchase < minDaysSinceLastPurchase) {
        res.status(400).json({ ok: false, error: "maxDaysSinceLastPurchase는 minDaysSinceLastPurchase 이상이어야 함" });
        return;
      }

      const candidates = listRepurchaseCandidates({
        site,
        minDaysSinceLastPurchase,
        maxDaysSinceLastPurchase,
        minPurchaseCount,
        limit,
      });

      res.json({
        ok: true,
        filters: {
          site,
          minDaysSinceLastPurchase,
          maxDaysSinceLastPurchase,
          minPurchaseCount,
          limit,
        },
        total: candidates.length,
        candidates,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Repurchase candidates failed" });
    }
  });

  router.get("/api/crm-local/birthday-members", (req: Request, res: Response) => {
    try {
      const site = readParam(req.query.site as string | string[] | undefined) ?? undefined;
      const month = Number(readParam(req.query.month as string | string[] | undefined)) || undefined;
      const members = listBirthdayMembers({ site, month, limit: 5000 });
      res.json({
        ok: true,
        month: month ?? (new Date().getMonth() + 1),
        site: site ?? "all",
        total: members.length,
        members,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Birthday query failed" });
    }
  });

  router.get("/api/crm-local/imweb/pagination-anomalies", async (req: Request, res: Response) => {
    try {
      if (IMWEB_SITES.length === 0) {
        res.status(400).json({ ok: false, error: "IMWEB API 키 미설정" });
        return;
      }

      const maxPage = typeof req.query.maxPage === "string" ? Math.min(Number(req.query.maxPage) || 130, 300) : 130;
      const targetSite = typeof req.query.site === "string" ? req.query.site : null;
      const sites = targetSite ? IMWEB_SITES.filter((site) => site.site === targetSite) : IMWEB_SITES;

      if (sites.length === 0) {
        res.status(404).json({ ok: false, error: "해당 site 설정을 찾지 못함" });
        return;
      }

      const reports = [];
      for (const cfg of sites) {
        reports.push(await inspectImwebOrderPagination(cfg, maxPage));
      }

      res.json({ ok: true, reports });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Pagination inspection failed" });
    }
  });

  /* ── A/B 테스트: 재구매 실험 생성 ── */

  router.post("/api/crm-local/experiments/repurchase-ab", (req: Request, res: Response) => {
    try {
      const { site, minDays, maxDays, minOrders, variantA, variantB, splitBy, conversionWindowDays, experimentName } = req.body;
      if (!site) { res.status(400).json({ ok: false, error: "site 필요" }); return; }
      if (!variantA || !variantB) { res.status(400).json({ ok: false, error: "variantA, variantB 필요" }); return; }

      const result = createRepurchaseAbExperiment({
        site,
        minDays: Number(minDays) || 30,
        maxDays: Number(maxDays) || 90,
        minOrders: Number(minOrders) || 1,
        variantA,
        variantB,
        splitBy: splitBy === "consent" ? "consent" : "channel",
        conversionWindowDays: Number(conversionWindowDays) || 3,
        experimentName,
      });

      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Experiment creation failed" });
    }
  });

  /* ── A/B 테스트: 결과 요약 ── */

  router.get("/api/crm-local/experiments/:key/ab-summary", (req: Request, res: Response) => {
    try {
      const experimentKey = readParam(req.params.key);
      if (!experimentKey) { res.status(400).json({ ok: false, error: "experiment key 필요" }); return; }

      const result = getAbSummary(experimentKey);
      if (!result.experiment) { res.status(404).json({ ok: false, error: "실험 없음" }); return; }

      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "AB summary failed" });
    }
  });

  /* ── 캠페인 성과 퍼널 ── */

  router.get("/api/crm-local/experiments/:key/funnel", (req: Request, res: Response) => {
    try {
      const experimentKey = readParam(req.params.key);
      if (!experimentKey) { res.status(400).json({ ok: false, error: "experiment key 필요" }); return; }
      const result = getExperimentFunnel(experimentKey);
      if (!result.experiment) { res.status(404).json({ ok: false, error: "실험 없음" }); return; }
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "funnel failed" });
    }
  });

  /* ── 예약 발송 ── */

  router.post("/api/crm-local/scheduled-sends", (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const groupId = readRequiredBodyString(body.groupId);
      const channel = readRequiredBodyString(body.channel);
      const templateCode = readOptionalBodyString(body.templateCode);
      const templateType = readOptionalBodyString(body.templateType);
      const subject = readOptionalBodyString(body.subject);
      const message = readRequiredBodyString(body.message);
      const scheduledAt = parseScheduledAt(body.scheduledAt);
      const errors: ValidationError[] = [];

      if (!groupId) {
        errors.push({ field: "groupId", code: "required", message: "groupId 필요" });
      } else if (!customerGroupExists(groupId)) {
        errors.push({ field: "groupId", code: "not_found", message: "그룹을 찾을 수 없다" });
      }
      if (channel !== "alimtalk" && channel !== "sms") {
        errors.push({ field: "channel", code: "invalid", message: "channel은 alimtalk 또는 sms여야 한다" });
      }
      if (!message) errors.push({ field: "message", code: "required", message: "message 필요" });
      if (!scheduledAt.ok) errors.push({ field: "scheduledAt", code: "invalid", message: scheduledAt.error });
      if (channel === "alimtalk" && (!templateCode || !subject)) {
        if (!templateCode) errors.push({ field: "templateCode", code: "required", message: "알림톡 예약은 templateCode가 필요하다" });
        if (!subject) errors.push({ field: "subject", code: "required", message: "알림톡 예약은 subject가 필요하다" });
      }

      if (errors.length > 0) {
        const status = errors.some((error) => error.code === "not_found") ? 404 : 400;
        sendValidationErrors(res, status, errors);
        return;
      }
      const channelForCreate = channel as "alimtalk" | "sms";
      const scheduledAtValue = scheduledAt.ok ? scheduledAt.value : "";

      const created = createScheduledSend({
        group_id: groupId!,
        channel: channelForCreate,
        template_code: templateCode,
        template_type: templateType,
        subject,
        message: message!,
        scheduled_at: scheduledAtValue,
        admin_override: readBoolean(body.adminOverride),
        test_mode: readBoolean(body.testMode),
        experiment_key: readOptionalBodyString(body.experimentKey),
        note: readOptionalBodyString(body.note),
        created_by: readOptionalBodyString(body.createdBy),
      });
      res.json({ ok: true, id: created.id, scheduledAt: scheduledAtValue });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "scheduled send create failed" });
    }
  });

  router.get("/api/crm-local/scheduled-sends", (req: Request, res: Response) => {
    try {
      const statusRaw = readParam(req.query.status as string);
      const parsedStatus = statusRaw ? parseScheduledSendStatus(statusRaw) : null;
      if (statusRaw && !parsedStatus) {
        res.status(400).json({ ok: false, error: "status 값이 올바르지 않다" });
        return;
      }
      const status = parsedStatus ?? undefined;
      const groupId = readParam(req.query.groupId as string) || undefined;
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 500));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      res.json({ ok: true, ...listScheduledSends({ status, groupId, limit, offset }) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "scheduled send list failed" });
    }
  });

  router.get("/api/crm-local/scheduled-sends/:id", (req: Request, res: Response) => {
    try {
      const id = parseNumericId(req.params.id);
      if (id === null) { res.status(400).json({ ok: false, error: "id 값이 올바르지 않다" }); return; }
      const row = getScheduledSend(id);
      if (!row) { res.status(404).json({ ok: false, error: "예약 발송을 찾을 수 없다" }); return; }
      res.json({ ok: true, scheduledSend: row });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "scheduled send get failed" });
    }
  });

  router.delete("/api/crm-local/scheduled-sends/:id", (req: Request, res: Response) => {
    try {
      const id = parseNumericId(req.params.id);
      if (id === null) { res.status(400).json({ ok: false, error: "id 값이 올바르지 않다" }); return; }
      const row = getScheduledSend(id);
      if (!row) { res.status(404).json({ ok: false, error: "예약 발송을 찾을 수 없다" }); return; }
      if (!cancelScheduledSend(id)) {
        res.status(409).json({ ok: false, error: "pending 상태에서만 취소할 수 있다" });
        return;
      }
      res.json({ ok: true, scheduledSend: getScheduledSend(id) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "scheduled send cancel failed" });
    }
  });

  /* ── 세그먼트 커스텀 빌더 ── */

  router.post("/api/crm-local/segments/evaluate", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const site = readRequiredBodyString(body.site) ?? "";
      const evaluation = await evaluateSegment(getCrmDb(), {
        site,
        query: body.query as SegmentQuery,
      });
      if (!evaluation.ok) {
        sendValidationErrors(res, 400, evaluation.errors);
        return;
      }

      logSegmentEvaluation(site, evaluation);
      res.json({
        ok: true,
        count: evaluation.result.count,
        truncated: evaluation.result.truncated,
        warnings: evaluation.result.warnings,
        preview: evaluation.result.members.slice(0, 10),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "segment evaluate failed" });
    }
  });

  router.post("/api/crm-local/segments", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const site = readRequiredBodyString(body.site) ?? "";
      const name = readRequiredBodyString(body.name);
      const errors: ValidationError[] = [];
      if (!name) {
        errors.push({ field: "name", code: "required", message: "name 필요" });
      }

      const evaluation = await evaluateSegment(getCrmDb(), {
        site,
        query: body.query as SegmentQuery,
      });
      if (!evaluation.ok || errors.length > 0) {
        if (!evaluation.ok) {
          errors.push(...evaluation.errors);
        }
        sendValidationErrors(res, 400, errors);
        return;
      }

      logSegmentEvaluation(site, evaluation);
      const segment = createSavedSegment({
        site,
        name: name!,
        description: readOptionalBodyString(body.description),
        queryJson: JSON.stringify(body.query),
        createdBy: readOptionalBodyString(body.createdBy),
        resultCount: evaluation.result.count,
      });
      log.info({
        event: "segment_create",
        id: segment.id,
        site: segment.site,
        name: segment.name,
        resultCount: evaluation.result.count,
      });
      res.json({ ok: true, segment: toSegmentApiRow(segment) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "segment create failed" });
    }
  });

  router.get("/api/crm-local/segments", (req: Request, res: Response) => {
    try {
      const site = readParam(req.query.site as string | string[] | undefined).trim();
      if (!site) {
        sendValidationErrors(res, 400, [{ field: "site", code: "required", message: "site 파라미터 필요" }]);
        return;
      }
      res.json({ ok: true, segments: listSavedSegments(site).map(toSegmentApiRow) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "segments list failed" });
    }
  });

  router.get("/api/crm-local/segments/:id", (req: Request, res: Response) => {
    try {
      const id = parseNumericId(req.params.id);
      if (id === null) {
        sendValidationErrors(res, 400, [{ field: "id", code: "invalid", message: "id 값이 올바르지 않다" }]);
        return;
      }
      const segment = getSavedSegment(id);
      if (!segment) {
        sendValidationErrors(res, 404, [{ field: "id", code: "not_found", message: "세그먼트를 찾을 수 없다" }]);
        return;
      }
      res.json({ ok: true, segment: toSegmentApiRow(segment) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "segment get failed" });
    }
  });

  router.delete("/api/crm-local/segments/:id", (req: Request, res: Response) => {
    try {
      const id = parseNumericId(req.params.id);
      if (id === null) {
        sendValidationErrors(res, 400, [{ field: "id", code: "invalid", message: "id 값이 올바르지 않다" }]);
        return;
      }
      if (!deleteSavedSegment(id)) {
        sendValidationErrors(res, 404, [{ field: "id", code: "not_found", message: "세그먼트를 찾을 수 없다" }]);
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "segment delete failed" });
    }
  });

  router.post("/api/crm-local/segments/:id/materialize", async (req: Request, res: Response) => {
    try {
      const id = parseNumericId(req.params.id);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const groupName = readRequiredBodyString(body.groupName);
      const errors: ValidationError[] = [];
      if (id === null) {
        errors.push({ field: "id", code: "invalid", message: "id 값이 올바르지 않다" });
      }
      if (!groupName) {
        errors.push({ field: "groupName", code: "required", message: "groupName 필요" });
      }
      if (errors.length > 0) {
        sendValidationErrors(res, 400, errors);
        return;
      }

      const segment = getSavedSegment(id!);
      if (!segment) {
        sendValidationErrors(res, 404, [{ field: "id", code: "not_found", message: "세그먼트를 찾을 수 없다" }]);
        return;
      }
      const query = parseSegmentQueryJson(segment.query_json);
      const evaluation = await evaluateSegment(getCrmDb(), {
        site: segment.site,
        query,
      });
      if (!evaluation.ok) {
        sendValidationErrors(res, 400, evaluation.errors);
        return;
      }

      logSegmentEvaluation(segment.site, evaluation);
      const group = createCustomerGroup({
        name: groupName!,
        description: `segment snapshot: ${segment.name}`,
        kind: "segment_snapshot",
        sourceRef: `segment:${segment.id}`,
      });
      const memberCount = addGroupMembers(group.group_id, evaluation.result.members.map((member) => ({
        phone: member.phone ?? "",
        name: member.name ?? undefined,
        member_code: member.member_code || undefined,
      })));
      const createdGroup = getCustomerGroup(group.group_id) ?? group;
      log.info({
        event: "segment_materialize",
        segmentId: segment.id,
        groupId: group.group_id,
        memberCount,
      });
      res.json({ ok: true, group: createdGroup, memberCount });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "segment materialize failed" });
    }
  });

  /* ── 고객 그룹 관리 ── */

  router.get("/api/crm-local/groups", (req: Request, res: Response) => {
    try {
      const kind = parseCustomerGroupKind(readParam(req.query.kind as string | string[] | undefined));
      if (!kind) {
        res.status(400).json({ ok: false, error: "kind 값이 올바르지 않다" });
        return;
      }
      const includeArchived = readBoolean(req.query.includeArchived);
      res.json({ ok: true, groups: listCustomerGroups({ kind, includeArchived }) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "groups list failed" });
    }
  });

  router.get("/api/crm-local/groups/stats", (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, counts: getCustomerGroupStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "groups stats failed" });
    }
  });

  router.post("/api/crm-local/groups", (req: Request, res: Response) => {
    try {
      const { name, description, kind, sourceRef } = req.body;
      if (!name) { res.status(400).json({ ok: false, error: "name 필요" }); return; }
      const parsedKind = kind === undefined || kind === null || kind === ""
        ? "manual"
        : parseCustomerGroupKind(String(kind));
      if (!parsedKind || parsedKind === "all") {
        res.status(400).json({ ok: false, error: "kind 값이 올바르지 않다" });
        return;
      }
      const group = createCustomerGroup({
        name,
        description,
        kind: parsedKind,
        sourceRef: readOptionalBodyString(sourceRef),
      });
      res.json({ ok: true, group });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "group create failed" });
    }
  });

  router.post("/api/crm-local/groups/:id/archive", (req: Request, res: Response) => {
    try {
      const groupId = readParam(req.params.id);
      const group = getCustomerGroup(groupId);
      if (!group) {
        res.status(404).json({ ok: false, error: "그룹을 찾을 수 없다" });
        return;
      }
      const archiveCheck = canArchiveGroup(groupId);
      if (!archiveCheck.canArchive) {
        res.status(409).json({ ok: false, reason: archiveCheck.reason });
        return;
      }
      archiveCustomerGroup(groupId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "group archive failed" });
    }
  });

  router.delete("/api/crm-local/groups/:id", (req: Request, res: Response) => {
    try {
      const groupId = readParam(req.params.id);
      const archiveCheck = canArchiveGroup(groupId);
      if (!archiveCheck.canArchive) {
        res.status(409).json({ ok: false, reason: archiveCheck.reason });
        return;
      }
      deleteCustomerGroup(groupId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "group delete failed" });
    }
  });

  router.get("/api/crm-local/groups/:id/members", (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 500;
      const offset = Number(req.query.offset) || 0;
      res.json({ ok: true, ...listGroupMembers(readParam(req.params.id), limit, offset) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "members list failed" });
    }
  });

  router.post("/api/crm-local/groups/:id/members", (req: Request, res: Response) => {
    try {
      const { members } = req.body;
      if (!Array.isArray(members)) { res.status(400).json({ ok: false, error: "members 배열 필요" }); return; }
      const added = addGroupMembers(readParam(req.params.id), members);
      res.json({ ok: true, added });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "members add failed" });
    }
  });

  router.post(
    "/api/crm-local/groups/:id/members/bulk-upload",
    (req: Request, res: Response, next: NextFunction) => {
      bulkUploadFile(req, res, (err?: unknown) => {
        if (err) {
          const uploadError = err as { code?: string; message?: string };
          const error = uploadError.code === "LIMIT_FILE_SIZE"
            ? "파일 크기는 5MB 이하만 가능하다"
            : uploadError.message ?? "파일 업로드 실패";
          res.status(400).json({ ok: false, error });
          return;
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      try {
        const groupId = readParam(req.params.id);
        if (!customerGroupExists(groupId)) {
          res.status(404).json({ ok: false, error: "그룹을 찾을 수 없다" });
          return;
        }

        const file = (req as RequestWithMemoryFile).file;
        if (!file) {
          res.status(400).json({ ok: false, error: "file 필드가 필요하다" });
          return;
        }
        if (!isSupportedUploadFile(file.originalname, file.mimetype)) {
          res.status(400).json({ ok: false, error: UNSUPPORTED_UPLOAD_FILE_MESSAGE });
          return;
        }

        const parsed = parseBulkUploadFile(file);
        if (parsed.rows.length > 10000) {
          res.status(400).json({ ok: false, error: "행 수 초과" });
          return;
        }

        const mapping = detectBulkUploadHeaders(parsed.headers);
        if (!mapping.phone) {
          res.status(400).json({ ok: false, error: "전화번호 열을 찾을 수 없다" });
          return;
        }

        const errors: Array<{ row_index: number; reason: string }> = [];
        const members: Array<{ phone: string; name?: string; member_code?: string; consent_sms?: boolean | null }> = [];
        let skippedInvalidPhone = 0;

        for (const row of parsed.rows) {
          const phone = normalizeUploadPhone(row.values[mapping.phone]);
          if (!phone) {
            skippedInvalidPhone++;
            if (errors.length < 100) {
              errors.push({ row_index: row.rowIndex, reason: "유효하지 않은 전화번호" });
            }
            continue;
          }

          const name = mapping.name ? readOptionalBodyString(row.values[mapping.name]) : null;
          const memberCode = mapping.member_code ? readOptionalBodyString(row.values[mapping.member_code]) : null;
          const consentSms = mapping.consent_sms ? normalizeConsentSms(row.values[mapping.consent_sms]) : undefined;
          const member: { phone: string; name?: string; member_code?: string; consent_sms?: boolean | null } = {
            phone,
            name: name ?? undefined,
            member_code: memberCode ?? undefined,
          };
          if (consentSms !== undefined) {
            member.consent_sms = consentSms === "Y";
          }
          members.push(member);
        }

        const added = addGroupMembers(groupId, members);
        const skippedDuplicate = Math.max(members.length - added, 0);
        // eslint-disable-next-line no-console
        console.log("[crm-local bulk-upload]", {
          groupId,
          filename: file.originalname,
          size: file.size,
          rowCount: parsed.rows.length,
        });

        res.json({
          ok: true,
          total_rows: parsed.rows.length,
          added,
          skipped_duplicate: skippedDuplicate,
          skipped_invalid_phone: skippedInvalidPhone,
          errors,
        });
      } catch (err) {
        res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "bulk upload failed" });
      }
    },
  );

  router.post("/api/crm-local/groups/:id/members/from-experiment", (req: Request, res: Response) => {
    try {
      const { experimentKey, variantKey } = req.body;
      if (!experimentKey || !variantKey) { res.status(400).json({ ok: false, error: "experimentKey, variantKey 필요" }); return; }
      const group = createGroupFromExperiment(experimentKey, variantKey, req.body.groupName ?? `실험-${variantKey}`);
      res.json({ ok: true, group });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "from-experiment failed" });
    }
  });

  router.delete("/api/crm-local/groups/:id/members", (req: Request, res: Response) => {
    try {
      const { phones } = req.body;
      if (!Array.isArray(phones)) { res.status(400).json({ ok: false, error: "phones 배열 필요" }); return; }
      const deleted = deleteGroupMembers(readParam(req.params.id), phones);
      res.json({ ok: true, deleted });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "members delete failed" });
    }
  });

  /* ── 메시지 이력 ── */

  router.get("/api/crm-local/message-log", (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      const channel = readParam(req.query.channel as string) || undefined;
      res.json({ ok: true, ...listMessageLog({ limit, offset, channel }) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "message-log failed" });
    }
  });

  /* ── Phase 2: 고객 목록 / 등급 / 세그먼트 ── */

  router.get("/api/crm-local/customers", (req: Request, res: Response) => {
    try {
      const site = readParam(req.query.site as string);
      if (!site) { res.status(400).json({ ok: false, error: "site is required" }); return; }
      const search = readParam(req.query.search as string) || undefined;
      const grade = readParam(req.query.grade as string) || undefined;
      const consentSms = req.query.consentSms === "true" ? true : req.query.consentSms === "false" ? false : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const result = listCustomers({ site, search, grade, consentSms, limit, offset });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "customers list failed" });
    }
  });

  router.get("/api/crm-local/grades", (req: Request, res: Response) => {
    try {
      const site = readParam(req.query.site as string);
      if (!site) { res.status(400).json({ ok: false, error: "site is required" }); return; }
      const grades = listShoppingGrades(site);
      res.json({ ok: true, grades });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "grades list failed" });
    }
  });

  router.post("/api/crm-local/customers/segment-query", (req: Request, res: Response) => {
    try {
      const { site, segment, params } = req.body ?? {};
      if (!site || !segment) { res.status(400).json({ ok: false, error: "site and segment are required" }); return; }
      const result = queryCustomerSegment({ site, segment, params });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "segment query failed" });
    }
  });

  return router;
};

type SegmentApiRow = Omit<SavedSegmentRow, "query_json"> & {
  query: SegmentQuery;
};

function toSegmentApiRow(row: SavedSegmentRow): SegmentApiRow {
  const { query_json: _queryJson, ...rest } = row;
  return {
    ...rest,
    query: parseSegmentQueryJson(row.query_json),
  };
}

function parseSegmentQueryJson(queryJson: string): SegmentQuery {
  return JSON.parse(queryJson) as SegmentQuery;
}

function logSegmentEvaluation(
  site: string,
  evaluation: Extract<SegmentEvaluationOutcome, { ok: true }>,
) {
  log.info({
    event: "segment_evaluate",
    site,
    clauseCount: evaluation.clauseCount,
    resultCount: evaluation.result.count,
    truncated: evaluation.result.truncated,
    durationMs: evaluation.durationMs,
  });
}

type RequestWithMemoryFile = Request & {
  file?: UploadedMemoryFile;
};

type UploadedMemoryFile = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

type UploadMiddleware = (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
) => void;

type MulterFactory = {
  (options: {
    storage: unknown;
    limits: { fileSize: number };
    fileFilter: (
      req: Request,
      file: { originalname: string; mimetype?: string },
      cb: (error: Error | null, acceptFile?: boolean) => void,
    ) => void;
  }): { single: (fieldName: string) => UploadMiddleware };
  memoryStorage: () => unknown;
};

type XlsxModule = {
  read: (buffer: Buffer, options: { type: "buffer" }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (
      sheet: unknown,
      options: { header: 1; defval: string; raw: false },
    ) => unknown[][];
  };
};

type ParsedUploadRow = {
  rowIndex: number;
  values: Record<string, unknown>;
};

type ParsedUploadFile = {
  headers: string[];
  rows: ParsedUploadRow[];
};

const BULK_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const UNSUPPORTED_UPLOAD_FILE_MESSAGE = "지원하지 않는 파일 형식입니다. .xlsx, .xls, .csv만 업로드할 수 있다.";
const SCHEDULED_SEND_STATUSES: ScheduledSendStatus[] = ["pending", "running", "success", "partial", "fail", "canceled"];
const PHONE_HEADER_ALIASES = ["전화번호", "휴대폰", "연락처", "phone", "tel", "mobile"];
const NAME_HEADER_ALIASES = ["이름", "고객명", "성함", "name"];
const MEMBER_CODE_HEADER_ALIASES = ["고객번호", "회원번호", "member_code", "memberCode"];
const CONSENT_SMS_HEADER_ALIASES = ["SMS동의", "문자수신동의", "sms_consent"];

function createBulkUploadMiddleware(): UploadMiddleware {
  const multer = loadMulter();
  if (multer) {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: BULK_UPLOAD_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!isSupportedUploadFile(file.originalname, file.mimetype)) {
          cb(new Error(UNSUPPORTED_UPLOAD_FILE_MESSAGE));
          return;
        }
        cb(null, true);
      },
    });
    return upload.single("file");
  }

  return fallbackMemoryUpload;
}

function loadMulter(): MulterFactory | null {
  try {
    return require("multer") as MulterFactory;
  } catch {
    return null;
  }
}

function loadXlsx(): XlsxModule | null {
  try {
    return require("xlsx") as XlsxModule;
  } catch {
    return null;
  }
}

const fallbackMemoryUpload: UploadMiddleware = (req, _res, next) => {
  const contentType = String(req.headers["content-type"] ?? "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    next(new Error("multipart/form-data 요청이 필요하다"));
    return;
  }
  const boundary = boundaryMatch[1] ?? boundaryMatch[2];
  const chunks: Buffer[] = [];
  let totalSize = 0;
  let tooLarge = false;

  req.on("data", (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > BULK_UPLOAD_MAX_BYTES) {
      tooLarge = true;
      return;
    }
    chunks.push(chunk);
  });
  req.on("error", (error) => next(error));
  req.on("end", () => {
    if (tooLarge) {
      next(Object.assign(new Error("파일 크기는 5MB 이하만 가능하다"), { code: "LIMIT_FILE_SIZE" }));
      return;
    }
    const file = parseMultipartMemoryFile(Buffer.concat(chunks, totalSize), boundary, "file");
    if (!file) {
      next(new Error("file 필드가 필요하다"));
      return;
    }
    if (!isSupportedUploadFile(file.originalname, file.mimetype)) {
      next(new Error(UNSUPPORTED_UPLOAD_FILE_MESSAGE));
      return;
    }
    (req as RequestWithMemoryFile).file = file;
    next();
  });
};

function parseMultipartMemoryFile(body: Buffer, boundary: string, fieldName: string): UploadedMemoryFile | null {
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf(delimiter, cursor);
    if (start < 0) break;
    let partStart = start + delimiter.length;
    if (body.subarray(partStart, partStart + 2).toString("utf8") === "--") break;
    if (body.subarray(partStart, partStart + 2).toString("utf8") === "\r\n") partStart += 2;
    const next = body.indexOf(delimiter, partStart);
    if (next < 0) break;

    let part = body.subarray(partStart, next);
    if (part.subarray(part.length - 2).toString("utf8") === "\r\n") {
      part = part.subarray(0, part.length - 2);
    }
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd >= 0) {
      const headers = parseMultipartHeaders(part.subarray(0, headerEnd).toString("utf8"));
      const disposition = headers["content-disposition"] ?? "";
      const name = disposition.match(/name="([^"]+)"/)?.[1] ?? "";
      const filename = disposition.match(/filename="([^"]*)"/)?.[1] ?? "";
      if (name === fieldName && filename) {
        const buffer = part.subarray(headerEnd + 4);
        return {
          originalname: filename,
          mimetype: headers["content-type"],
          size: buffer.length,
          buffer,
        };
      }
    }
    cursor = next;
  }
  return null;
}

function parseMultipartHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of raw.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  return headers;
}

function isSupportedUploadFile(filename: string, mimetype?: string) {
  const extension = getUploadExtension(filename);
  if (!["xlsx", "xls", "csv"].includes(extension)) return false;
  if (!mimetype || mimetype === "application/octet-stream") return true;
  return [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
    "text/plain",
  ].includes(mimetype);
}

function parseBulkUploadFile(file: UploadedMemoryFile): ParsedUploadFile {
  const extension = getUploadExtension(file.originalname);
  const xlsx = loadXlsx();
  if (xlsx) {
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    const table = sheet
      ? xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false })
      : [];
    return tableToParsedRows(table);
  }
  if (extension === "csv") {
    return tableToParsedRows(parseCsvTable(file.buffer));
  }
  throw new Error("xlsx dependency가 설치되어 있지 않아 엑셀 파일을 파싱할 수 없다");
}

function tableToParsedRows(table: unknown[][]): ParsedUploadFile {
  const headers = (table[0] ?? []).map((header) => String(header ?? "").trim());
  const rows: ParsedUploadRow[] = [];
  for (let index = 1; index < table.length; index++) {
    const rawRow = table[index] ?? [];
    if (!rawRow.some((cell) => String(cell ?? "").trim() !== "")) continue;
    const values: Record<string, unknown> = {};
    headers.forEach((header, headerIndex) => {
      if (!header) return;
      values[header] = rawRow[headerIndex] ?? "";
    });
    rows.push({ rowIndex: index + 1, values });
  }
  return { headers, rows };
}

function parseCsvTable(buffer: Buffer): string[][] {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index++;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value.trim() !== "") || rows.length === 0) rows.push(row);
  return rows;
}

function detectBulkUploadHeaders(headers: string[]) {
  return {
    phone: findHeader(headers, PHONE_HEADER_ALIASES),
    name: findHeader(headers, NAME_HEADER_ALIASES),
    member_code: findHeader(headers, MEMBER_CODE_HEADER_ALIASES),
    consent_sms: findHeader(headers, CONSENT_SMS_HEADER_ALIASES),
  };
}

function findHeader(headers: string[], aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  return headers.find((header) => normalizedAliases.has(normalizeHeader(header))) ?? null;
}

function normalizeHeader(value: string) {
  return value.replace(/[\s_-]+/g, "").toLowerCase();
}

function normalizeUploadPhone(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/[^0-9]/g, "");
  if (raw.startsWith("+82") || digits.startsWith("82")) {
    digits = `0${digits.slice(2)}`;
  }
  if (!digits.startsWith("01")) return null;
  if (digits.length !== 10 && digits.length !== 11) return null;
  return digits;
}

function normalizeConsentSms(value: unknown): "Y" | "N" | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (["y", "yes", "1", "true", "동의"].includes(normalized)) return "Y";
  if (["n", "no", "0", "false", "미동의"].includes(normalized)) return "N";
  return undefined;
}

function getUploadExtension(filename: string) {
  const last = filename.toLowerCase().split(".").pop();
  return last ?? "";
}

function customerGroupExists(groupId: string) {
  if (!groupId) return false;
  const row = getCrmDb().prepare("SELECT 1 FROM crm_customer_groups WHERE group_id = ?").get(groupId);
  return Boolean(row);
}

type ValidationError = {
  field: string;
  code: string;
  message: string;
};

function sendValidationErrors(res: Response, status: number, errors: ValidationError[]) {
  res.status(status).json({
    ok: false,
    error: errors[0]?.message ?? "validation failed",
    errors,
  });
}

function parseCustomerGroupKind(value: string | string[] | undefined): CustomerGroupKind | "all" | null {
  const raw = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const normalized = raw.trim() || "manual";
  if (
    normalized === "manual"
    || normalized === "repurchase_temp"
    || normalized === "experiment_snapshot"
    || normalized === "segment_snapshot"
    || normalized === "all"
  ) {
    return normalized;
  }
  return null;
}

function readRequiredBodyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function readOptionalBodyString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return readRequiredBodyString(String(value));
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseScheduledAt(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "scheduledAt 필요" };
  }
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return { ok: false, error: "scheduledAt은 ISO8601 형식이어야 한다" };
  }
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    return { ok: false, error: "scheduledAt 값이 올바르지 않다" };
  }
  if (ms < Date.now() - 60_000) {
    return { ok: false, error: "scheduledAt은 현재 시각보다 60초 이상 과거일 수 없다" };
  }
  return { ok: true, value: new Date(ms).toISOString() };
}

function parseScheduledSendStatus(value: string): ScheduledSendStatus | null {
  return SCHEDULED_SEND_STATUSES.includes(value as ScheduledSendStatus)
    ? value as ScheduledSendStatus
    : null;
}

function parseNumericId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
