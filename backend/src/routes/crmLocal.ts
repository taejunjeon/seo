/**
 * CRM 로컬 실험 API
 *
 * 운영 DB는 읽기만, 실험 데이터는 로컬 SQLite에 저장.
 * revenue API 프록시 대신 직접 관리.
 */

import express, { type Request, type Response } from "express";
import {
  createAssignment,
  createExperiment,
  getCrmDb,
  getDbStats,
  getExperiment,
  getExperimentResults,
  getImwebMemberByPhone,
  getImwebMemberConsentStats,
  getImwebOrderStats,
  getImwebTossReconcileReport,
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
  type ImwebMemberRow,
  type ImwebOrderRow,
} from "../crmLocalDb";
import { env } from "../env";
import { isDatabaseConfigured, queryPg } from "../postgres";

export const createCrmLocalRouter = () => {
  const router = express.Router();
  const readParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] ?? "" : value ?? "");

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

      // 운영 DB에서 이 고객들의 주문 조회 (전화번호 정규화 매칭)
      const placeholders = customerKeys.map((_, i) => `$${i + 1}`).join(",");
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
            left(trim(coalesce(payment_complete_time::text, order_date::text, '')), 10),
            ''
          ) AS order_date
        FROM tb_iamweb_users
        WHERE regexp_replace(coalesce(customer_number::text, ''), '[^0-9]', '', 'g') IN (${placeholders})
          AND coalesce(order_number::text, '') != ''
        ORDER BY order_date DESC`,
        customerKeys,
      );

      let synced = 0;
      for (const row of result.rows) {
        if (!row.order_number || !row.normalized_phone) continue;
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

  return router;
};
