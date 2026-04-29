"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

const CAPI_VM_BASE = "https://att.ainativeos.net";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtRoasX = (v: number | null | undefined) => (v != null ? `${v.toFixed(2)}x` : "—");

const CAPI_SNAPSHOT_KST = "2026-04-12 21:52 KST";
const CAPI_SNAPSHOT_UTC_MS = Date.UTC(2026, 3, 12, 12, 52, 0);
const CAPI_SOURCE_LABEL_FIX_KST = "2026-04-15 20:17 KST";
const CAPI_SOURCE_LABEL_REPAIR_KST = "2026-04-15 20:53 KST";
const CAPI_REPAIRED_POLLUTION_WINDOW = "2026-04-14 22:00 ~ 2026-04-15 20:17 KST (276건 SQL 교정 완료)";
const CAPI_POST_START_DATE = "2026-04-13";
const CAPI_POST_START_KST_UTC_MS = Date.UTC(2026, 3, 12, 15, 0, 0);
const CAPI_PRE_WINDOW_DAYS = 7;
const CAPI_PRE_END_DATE = "2026-04-11";
const CAPI_PRE_START_DATE = "2026-04-05";

type CapiRoasWindow = {
  start_date: string;
  end_date: string;
  spend: number;
  attrConfirmedRoas: number | null;
  metaPurchaseRoas: number | null;
  gapRatio: number | null;
  gapPct: number | null;
  orders: number;
  revenue: number;
  metaPurchaseValue: number;
};

type Props = { site: string };

const parseWindow = (data: Record<string, unknown> | null, startDate: string, endDate: string): CapiRoasWindow | null => {
  if (!data || !data.ok || !Array.isArray(data.sites)) return null;
  const row = (data.sites as Array<Record<string, unknown>>).find((s) => s.site === "biocom");
  if (!row) return null;
  const spend = Number(row.spend ?? 0);
  const attrConfirmedRoas = typeof row.roas === "number" ? (row.roas as number) : null;
  const metaPurchaseRoas = typeof row.metaPurchaseRoas === "number" ? (row.metaPurchaseRoas as number) : null;
  const gapRatio = attrConfirmedRoas != null && attrConfirmedRoas > 0 && metaPurchaseRoas != null
    ? metaPurchaseRoas / attrConfirmedRoas
    : null;
  const gapPct = attrConfirmedRoas != null && attrConfirmedRoas > 0 && metaPurchaseRoas != null
    ? (metaPurchaseRoas - attrConfirmedRoas) / attrConfirmedRoas
    : null;
  return {
    start_date: startDate,
    end_date: endDate,
    spend,
    attrConfirmedRoas,
    metaPurchaseRoas,
    gapRatio,
    gapPct,
    orders: Number(row.orders ?? 0),
    revenue: Number(row.revenue ?? 0),
    metaPurchaseValue: Number(row.metaPurchaseValue ?? 0),
  };
};

const todayKstIso = () => {
  const today = new Date();
  const kstShifted = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  return kstShifted.toISOString().slice(0, 10);
};

export default function CapiConvergenceCard({ site }: Props) {
  const [capiWindows, setCapiWindows] = useState<{ pre: CapiRoasWindow | null; post: CapiRoasWindow | null } | null>(null);
  const [capiWindowsLoading, setCapiWindowsLoading] = useState(false);
  const [capiNowMs, setCapiNowMs] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setCapiNowMs(Date.now());
    updateNow();
    const id = window.setInterval(updateNow, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (site !== "biocom") {
      setCapiWindows(null);
      return;
    }
    const todayIsoKst = todayKstIso();
    const postEndDate = todayIsoKst >= CAPI_POST_START_DATE ? todayIsoKst : CAPI_POST_START_DATE;
    const ac = new AbortController();
    setCapiWindowsLoading(true);
    const buildUrl = (start: string, end: string) =>
      `${CAPI_VM_BASE}/api/ads/site-summary?start_date=${start}&end_date=${end}&attribution_window=1d_click`;

    Promise.all([
      fetch(buildUrl(CAPI_PRE_START_DATE, CAPI_PRE_END_DATE), { signal: ac.signal }).then((r) => r.json()).catch(() => null),
      fetch(buildUrl(CAPI_POST_START_DATE, postEndDate), { signal: ac.signal }).then((r) => r.json()).catch(() => null),
    ])
      .then(([preData, postData]) => {
        setCapiWindows({
          pre: parseWindow(preData, CAPI_PRE_START_DATE, CAPI_PRE_END_DATE),
          post: parseWindow(postData, CAPI_POST_START_DATE, postEndDate),
        });
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!ac.signal.aborted) setCapiWindowsLoading(false); });
    return () => ac.abort();
  }, [site]);

  useEffect(() => {
    if (site !== "biocom") return;
    const interval = setInterval(() => {
      const todayIsoKst = todayKstIso();
      const postEndDate = todayIsoKst >= CAPI_POST_START_DATE ? todayIsoKst : CAPI_POST_START_DATE;
      const buildUrl = (start: string, end: string) =>
        `${CAPI_VM_BASE}/api/ads/site-summary?start_date=${start}&end_date=${end}&attribution_window=1d_click`;
      Promise.all([
        fetch(buildUrl(CAPI_PRE_START_DATE, CAPI_PRE_END_DATE)).then((r) => r.json()).catch(() => null),
        fetch(buildUrl(CAPI_POST_START_DATE, postEndDate)).then((r) => r.json()).catch(() => null),
      ]).then(([preData, postData]) => {
        setCapiWindows({
          pre: parseWindow(preData, CAPI_PRE_START_DATE, CAPI_PRE_END_DATE),
          post: parseWindow(postData, CAPI_POST_START_DATE, postEndDate),
        });
      }).catch(() => {});
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [site]);

  if (site !== "biocom") return null;

  const post = capiWindows?.post ?? null;
  const pre = capiWindows?.pre ?? null;
  const now = capiNowMs ?? CAPI_SNAPSHOT_UTC_MS;
  const postDaysInWindow = (() => {
    if (now < CAPI_POST_START_KST_UTC_MS) return 0;
    return Math.floor((now - CAPI_POST_START_KST_UTC_MS) / (24 * 60 * 60 * 1000)) + 1;
  })();
  const postFullDaysClosed = Math.max(0, postDaysInWindow - 1);
  const hoursSinceSnapshot = Math.max(0, Math.floor((now - CAPI_SNAPSHOT_UTC_MS) / (60 * 60 * 1000)));
  const hasMeaningfulPostSpend = post != null && post.spend > 0;
  const hasAttributionData = post != null && (post.orders > 0 || post.revenue > 0);
  const verdictTier: "insufficient" | "early_signal" | "trendable" =
    !hasMeaningfulPostSpend || !hasAttributionData ? "insufficient"
      : postFullDaysClosed < 3 ? "insufficient"
      : postFullDaysClosed < 7 ? "early_signal"
      : "trendable";
  const verdictLabel = { insufficient: "데이터 부족", early_signal: "초기 신호", trendable: "추세 판정 가능" }[verdictTier];
  const verdictColor = { insufficient: "#dc2626", early_signal: "#d97706", trendable: "#16a34a" }[verdictTier];
  const verdictBg = { insufficient: "#fef2f2", early_signal: "#fffbeb", trendable: "#f0fdf4" }[verdictTier];

  return (
    <div style={{ marginBottom: 20, padding: "18px 20px", borderRadius: 14, background: "#f8fafc", border: "1px solid #cbd5e1", lineHeight: 1.7 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>
            CAPI 최신화 스냅샷 이후 Meta vs Attribution ROAS 차이 (바이오컴)
          </strong>
          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
            스냅샷 시점: <strong style={{ color: "#0f172a" }}>{CAPI_SNAPSHOT_KST}</strong>
            {" · "}source-label SQL 교정: <strong style={{ color: "#0f172a" }}>{CAPI_SOURCE_LABEL_REPAIR_KST}</strong>
            {" · "}경과 {Math.floor(hoursSinceSnapshot / 24)}일 {hoursSinceSnapshot % 24}시간
            {" · "}POST 창 {postDaysInWindow}일차 (닫힌 일수 {postFullDaysClosed}일)
          </div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
            데이터 소스: VM <code>att.ainativeos.net</code>
            {" (로컬 노트북 백엔드는 cutover 이후 attribution sync가 꺼져 있어 VM을 직접 조회합니다)"}
            {" · "}오염 창: {CAPI_REPAIRED_POLLUTION_WINDOW}
            {" · "}footer fix: {CAPI_SOURCE_LABEL_FIX_KST}
          </div>
        </div>
        <span style={{ padding: "5px 12px", borderRadius: 999, background: verdictBg, color: verdictColor, border: `1px solid ${verdictColor}33`, fontSize: "0.72rem", fontWeight: 700 }}>
          {capiWindowsLoading ? "로딩…" : verdictLabel}
        </span>
      </div>

      <div style={{ fontSize: "0.74rem", color: "#475569", marginBottom: 12, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <strong>왜 보는가 · 한 줄 설명:</strong> 스냅샷 이전 바이오컴 자사몰은 가상계좌 미입금까지 Browser Pixel이 Purchase로 잡아서 Meta ROAS가 내부 Attribution ROAS보다 구조적으로 높았습니다.
        서버 결제 판정 가드가 붙은 뒤에는 Meta Purchase가 confirmed 기준으로 수렴해야 정상입니다. 이 카드는 <strong>SQL 교정된 VM ledger</strong>를 쓰므로 source-label 오염 창까지 복구 반영된 POST 구간으로 봅니다.
      </div>

      {capiWindowsLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>데이터 로딩 중...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>PRE (스냅샷 직전 {CAPI_PRE_WINDOW_DAYS}일)</div>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{CAPI_PRE_START_DATE} ~ {CAPI_PRE_END_DATE}</div>
            {pre ? (
              <div style={{ marginTop: 8, fontSize: "0.74rem", color: "#475569", lineHeight: 1.8 }}>
                <div>Attribution: <strong>{fmtRoasX(pre.attrConfirmedRoas)}</strong></div>
                <div>Meta Purchase: <strong>{fmtRoasX(pre.metaPurchaseRoas)}</strong></div>
                <div>차이 (Meta/Attr): <strong style={{ color: "#9a3412" }}>
                  {pre.gapRatio != null ? `${pre.gapRatio.toFixed(2)}x` : "—"}
                  {pre.gapPct != null && ` (+${(pre.gapPct * 100).toFixed(0)}%)`}
                </strong></div>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 4 }}>
                  광고비 {fmtKRW(pre.spend)} · 주문 {pre.orders}건
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8" }}>데이터 없음</div>
            )}
          </div>

          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #86efac" }}>
            <div style={{ fontSize: "0.68rem", color: "#16a34a", fontWeight: 700 }}>POST (CAPI 스냅샷 이후 · 교정 반영)</div>
            <div style={{ fontSize: "0.68rem", color: "#16a34a" }}>
              {post?.start_date ?? CAPI_POST_START_DATE} ~ {post?.end_date ?? CAPI_POST_START_DATE} (어제 자정 KST 기준 마감, 매일 페이지 로드 시 갱신)
            </div>
            {post ? (
              <div style={{ marginTop: 8, fontSize: "0.74rem", color: "#166534", lineHeight: 1.8 }}>
                <div>Attribution: <strong>{fmtRoasX(post.attrConfirmedRoas)}</strong></div>
                <div>Meta Purchase: <strong>{fmtRoasX(post.metaPurchaseRoas)}</strong></div>
                <div>차이 (Meta/Attr): <strong style={{ color: "#166534" }}>
                  {post.gapRatio != null ? `${post.gapRatio.toFixed(2)}x` : "—"}
                  {post.gapPct != null && ` (${post.gapPct >= 0 ? "+" : ""}${(post.gapPct * 100).toFixed(0)}%)`}
                </strong></div>
                <div style={{ fontSize: "0.68rem", color: "#15803d", marginTop: 4 }}>
                  광고비 {fmtKRW(post.spend)} · 주문 {post.orders}건
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8" }}>데이터 없음</div>
            )}
          </div>

          <div style={{ padding: "14px 16px", borderRadius: 10, background: verdictBg, border: `1px solid ${verdictColor}33` }}>
            <div style={{ fontSize: "0.68rem", color: verdictColor, fontWeight: 700 }}>개선 폭 및 현 판정</div>
            {pre && post && pre.gapRatio != null && post.gapRatio != null ? (
              <div style={{ marginTop: 8, fontSize: "0.74rem", color: "#1e293b", lineHeight: 1.8 }}>
                <div>
                  격차 변화:{" "}
                  <strong>
                    {pre.gapRatio.toFixed(2)}x → {post.gapRatio.toFixed(2)}x
                  </strong>
                </div>
                <div>
                  절대 변화:{" "}
                  <strong style={{ color: post.gapRatio < pre.gapRatio ? "#16a34a" : "#dc2626" }}>
                    {post.gapRatio < pre.gapRatio ? "−" : "+"}
                    {Math.abs(post.gapRatio - pre.gapRatio).toFixed(2)}x
                  </strong>
                  {" · "}
                  {pre.gapRatio > 0 && (
                    <strong style={{ color: post.gapRatio < pre.gapRatio ? "#16a34a" : "#dc2626" }}>
                      {((post.gapRatio - pre.gapRatio) / pre.gapRatio * 100).toFixed(0)}%
                    </strong>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#64748b" }}>
                격차 계산 불가 (데이터 부족)
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.74rem", color: "#334155", lineHeight: 1.8 }}>
        <strong style={{ color: "#0f172a" }}>현재 판단:</strong>{" "}
        {verdictTier === "insufficient" && !hasAttributionData && hasMeaningfulPostSpend && (
          <span>
            <span style={{ color: "#dc2626", fontWeight: 700 }}>Attribution 데이터가 아직 들어오지 않았습니다.</span>{" "}
            POST 창에 광고비는 잡혔는데 confirmed 주문이 0건입니다. 이건 (1) PG 확정 지연 또는 (2) attribution ledger 수집 지연 둘 중 하나입니다.
            먼저 <code>att.ainativeos.net/health</code>에서 <code>attributionStatusSync.enabled</code>가 true인지, 그리고 최근 CAPI 전송 로그가 쌓이는지 확인하세요.
          </span>
        )}
        {verdictTier === "insufficient" && hasAttributionData && (
          <span>
            <span style={{ color: "#dc2626", fontWeight: 700 }}>초기 신호로도 이르나 방향성은 보이기 시작합니다.</span>{" "}
            POST 창이 {postDaysInWindow}일차이고 완전히 닫힌 일수는 {postFullDaysClosed}일입니다. 오늘 데이터는 PG 확정 지연 때문에 자정까지 계속 늘어날 가능성이 크니 수치를 고정값으로 읽지 마세요.
            최소 <strong>3일 이상</strong>의 완전히 닫힌 창이 쌓여야 초기 신호 단계로 승격됩니다.
          </span>
        )}
        {verdictTier === "insufficient" && !hasMeaningfulPostSpend && (
          <span>
            <span style={{ color: "#dc2626", fontWeight: 700 }}>POST 창에 광고비가 거의 없습니다.</span>{" "}
            오늘 캠페인이 정상 집행 중인지 Ads Manager에서 확인해 주세요.
          </span>
        )}
        {verdictTier === "early_signal" && (
          <span>
            <span style={{ color: "#d97706", fontWeight: 700 }}>초기 신호 단계입니다.</span>{" "}
            POST 창에서 {postFullDaysClosed}일이 닫혔습니다. 격차가 줄어드는 방향인지는 볼 수 있지만 주말·캠페인 믹스 변동이 섞여 있어 단일 수치로 결론 내리기는 이릅니다.
            일주일(닫힌 7일)이 채워지기 전까지는 보조 지표로만 해석하고, 운영 headline은 기존 7일 confirmed 값을 그대로 씁니다.
          </span>
        )}
        {verdictTier === "trendable" && (
          <span>
            <span style={{ color: "#16a34a", fontWeight: 700 }}>7일 이상 경과, 추세 판정이 가능합니다.</span>{" "}
            POST 격차가 PRE 대비 유의미하게 줄었다면 서버 결제 판정 가드가 의도대로 작동한 것입니다. 여전히 PRE 수준이면 Meta 쪽 attribution 윈도우 또는 다른 오염 경로를 추가 진단해야 합니다.
          </span>
        )}
      </div>

      <details style={{ marginTop: 10 }} open={verdictTier === "insufficient" && hasAttributionData}>
        <summary style={{ cursor: "pointer", fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
          언제 무엇을 할지 (체크리스트)
        </summary>
        {(() => {
          const d3Date = new Date(CAPI_POST_START_KST_UTC_MS + 3 * 86400000);
          const d7Date = new Date(CAPI_POST_START_KST_UTC_MS + 7 * 86400000);
          const d14Date = new Date(CAPI_POST_START_KST_UTC_MS + 14 * 86400000);
          const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return (
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.72rem", color: "#475569", lineHeight: 1.8 }}>
              <div>
                <strong>현재 (POST {postDaysInWindow}일차, 닫힌 {postFullDaysClosed}일):</strong>{" "}
                매 아침 이 카드 + <code>att.ainativeos.net/api/meta/capi/log</code> total/success/failure 추이를 확인합니다.
                가상계좌 미입금이 실제로 차단되는지 로그에서 <code>VirtualAccountIssued</code> 이벤트가 <code>Purchase</code>보다 많이 나타나면 가드가 제대로 작동 중입니다.
                오늘 Attribution 값은 자정까지 계속 늘어날 수 있으니 고정값으로 읽지 마세요.
              </div>
              <div style={{ marginTop: 6, opacity: postFullDaysClosed >= 3 ? 0.5 : 1 }}>
                <strong>{postFullDaysClosed >= 3 ? "✅ " : ""}D+3 ({fmtD(d3Date)} 아침):</strong>{" "}
                3일치가 완전히 닫힌 상태로 쌓입니다. &quot;초기 신호&quot; 배지로 전환되면 격차 방향성을 처음으로 메모합니다.
              </div>
              <div style={{ marginTop: 6, opacity: postFullDaysClosed >= 7 ? 0.5 : 1 }}>
                <strong>{postFullDaysClosed >= 7 ? "✅ " : ""}D+7 ({fmtD(d7Date)} 아침):</strong>{" "}
                &quot;추세 판정 가능&quot; 배지로 전환됩니다. 격차가 <strong>PRE 대비 30% 이상 축소</strong>되었으면 Meta ROAS도 참고값으로 편입 검토합니다.
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>D+14 ({fmtD(d14Date)} 아침):</strong>{" "}
                2주 누적으로 격차가 PRE 대비 <strong>40% 이상</strong> 줄었고 pending 주문 비중이 5% 이하면 &quot;확정 상한선&quot;으로 승격합니다.
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>격차가 줄지 않을 경우 (D+7 판정 기준):</strong>{" "}
                (1) CAPI server_event_time / action_source 필드 sampling, (2) Meta Events Manager 이벤트 품질 점수 재확인, (3) 자사몰 외부 채널 Purchase 오염 여부 점검.
              </div>
            </div>
          );
        })()}
      </details>
    </div>
  );
}
