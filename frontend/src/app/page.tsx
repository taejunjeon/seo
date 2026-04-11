"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

import styles from "./page.module.css";
import type { AiCitationApiResponse } from "@/components/diagnosis";
import { LiveBadge } from "@/components/common/Badges";
import OverviewTab from "@/components/tabs/OverviewTab";
import ColumnAnalysisTab from "@/components/tabs/ColumnAnalysisTab";
import KeywordAnalysisTab from "@/components/tabs/KeywordAnalysisTab";
import { AiReportTab } from "@/components/ai-report";
import CoreWebVitalsTab from "@/components/tabs/CoreWebVitalsTab";
import UserBehaviorTab from "@/components/tabs/UserBehaviorTab";
import DiagnosisTab from "@/components/tabs/DiagnosisTab";
import SolutionIntroTab from "@/components/tabs/SolutionIntroTab";

import type {
  GscRow, GscQueryResponse, DatePreset, KeywordRangePreset, BehaviorRangePreset,
  AiInsight, IntentApiResponse, ColumnData, KeywordData, CwvPageData,
  BehaviorData, FunnelStep, KpiApiData, TrendPoint, ApiKeywordsResponse,
  ApiColumnsResponse, PageSpeedApiResult, ScoreBreakdown, AeoGeoApiResult,
  CrawlAnalysisResult, DiagnosisItem,
  OptimizationTask,
} from "@/types/page";

import {
  NAV_TABS, PRESET_DAYS,
  API_BASE_URL,
} from "@/constants/pageData";

import { setPage, resolveTabPageName } from "@/lib/channeltalk";

import {
  resolveContentUrl, isColumnLikePage, normalizeComparableUrl,
  pickRepresentativeColumnUrl,
  toDateInputValue, dateNDaysAgo, numberFormatter,
  decimalFormatter,
} from "@/utils/pageUtils";

/* ═══════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════ */
export default function Home() {
  /* 기존 state */
  const [siteUrl, setSiteUrl] = useState("sc-domain:biocom.kr");
  const [startDate, setStartDate] = useState(dateNDaysAgo(28));
  const [endDate, setEndDate] = useState(dateNDaysAgo(1));
  const [rowLimit, setRowLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GscRow[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "ok" | "error">("checking");
  const [datePreset, setDatePreset] = useState<DatePreset>("28d");

  /* 새 state */
  const [activeTab, setActiveTab] = useState(0);
  const [dataQueryOpen, setDataQueryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cwvStrategy, setCwvStrategy] = useState<"mobile" | "desktop">("mobile");
  const cwvStrategyRef = useRef(cwvStrategy);

  useEffect(() => {
    cwvStrategyRef.current = cwvStrategy;
  }, [cwvStrategy]);

  /* API 데이터 state */
  const [kpiData, setKpiData] = useState<KpiApiData | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[] | null>(null);
  const [keywordsData, setKeywordsData] = useState<KeywordData[] | null>(null);
  const [keywordsDateRange, setKeywordsDateRange] = useState<{ start: string; end: string } | null>(null);
  const [keywordRangePreset, setKeywordRangePreset] = useState<KeywordRangePreset>("7d");
  const [keywordDatePickerOpen, setKeywordDatePickerOpen] = useState(false);
  const [keywordStartInput, setKeywordStartInput] = useState(dateNDaysAgo(10));
  const [keywordEndInput, setKeywordEndInput] = useState(dateNDaysAgo(3));
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const [opportunityKeyword, setOpportunityKeyword] = useState<KeywordData | null>(null);
  const [columnsData, setColumnsData] = useState<ColumnData[] | null>(null);
  const [columnPagesData, setColumnPagesData] = useState<ColumnData[] | null>(null);
  const [columnsDateRange, setColumnsDateRange] = useState<{ start: string; end: string } | null>(null);
  const [cwvRealData, setCwvRealData] = useState<CwvPageData[] | null>(null);
  const [cwvLoading, setCwvLoading] = useState(false);
  const [pageSpeedHistory, setPageSpeedHistory] = useState<PageSpeedApiResult[] | null>(null);
  const [pageSpeedHistoryLoading, setPageSpeedHistoryLoading] = useState(false);
  const [pageSpeedHistoryError, setPageSpeedHistoryError] = useState<string | null>(null);
  const [cwvTestUrl, setCwvTestUrl] = useState("https://biocom.kr");
  const [behaviorData, setBehaviorData] = useState<BehaviorData[] | null>(null);
  const [behaviorRangePreset, setBehaviorRangePreset] = useState<BehaviorRangePreset>("30d");
  const [behaviorDatePickerOpen, setBehaviorDatePickerOpen] = useState(false);
  const [behaviorStartInput, setBehaviorStartInput] = useState(dateNDaysAgo(30));
  const [behaviorEndInput, setBehaviorEndInput] = useState(dateNDaysAgo(1));
  const [behaviorLoading, setBehaviorLoading] = useState(false);
  const [behaviorDateRange, setBehaviorDateRange] = useState<{ start: string; end: string } | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelStep[] | null>(null);

  /* AI Traffic state — Tab 0 요약 카드 + Tab 5 대시보드 모두 컴포넌트로 분리 완료.
     남은 state는 없음 (각 컴포넌트가 자체 fetch) */

  const [aeoScore, setAeoScore] = useState<AeoGeoApiResult | null>(null);
  const [geoScore, setGeoScore] = useState<AeoGeoApiResult | null>(null);
  const [aeoGeoTargetUrl, setAeoGeoTargetUrl] = useState<string | null>(null);
  const [aeoGeoScoresLoading, setAeoGeoScoresLoading] = useState(true);
  const [aeoGeoScoresProgress, setAeoGeoScoresProgress] = useState<number | null>(null);
  const aeoGeoProgressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (aeoGeoProgressTimerRef.current) {
        window.clearInterval(aeoGeoProgressTimerRef.current);
        aeoGeoProgressTimerRef.current = null;
      }
    };
  }, []);

  /* 키워드 인텐트 분석 */
  const [intentData, setIntentData] = useState<IntentApiResponse | null>(null);
  const [intentState, setIntentState] = useState<"loading" | "ready" | "error" | "empty">("loading");

  /* AI 인사이트 (ChatGPT) */
  const [aiInsights, setAiInsights] = useState<AiInsight[] | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsTime, setAiInsightsTime] = useState<string | null>(null);
  const [insightsState, setInsightsState] = useState<"loading" | "ready" | "error" | "empty">("loading");
  /* F4: _meta 캐시 배지 */
  const [insightsMeta, setInsightsMeta] = useState<{ source: string; generatedAt?: string; expiresAt?: string; ttl?: number } | null>(null);

  /* AI 채팅 (ChatGPT) */
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "안녕하세요! BiocomAI SEO 어시스턴트입니다. AEO/GEO 최적화에 대해 무엇이든 물어보세요." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  /* 스크롤 캡처 */
  const pageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [capturing, setCapturing] = useState(false);
  /* F8: AEO/GEO 독립 토글 */
  const [aeoDetailOpen, setAeoDetailOpen] = useState(false);
  const [geoDetailOpen, setGeoDetailOpen] = useState(false);
  const [openBreakdownItems, setOpenBreakdownItems] = useState<Record<string, boolean>>({});

  /* 칼럼 분석 탭 state */
  const [colRangePreset, setColRangePreset] = useState<KeywordRangePreset>("7d");
  const [colDatePickerOpen, setColDatePickerOpen] = useState(false);
  const [colStartInput, setColStartInput] = useState(dateNDaysAgo(10));
  const [colEndInput, setColEndInput] = useState(dateNDaysAgo(3));
  const [colLoading, setColLoading] = useState(false);

  /* 페이지 진단 state */
  const [diagUrl, setDiagUrl] = useState("https://biocom.kr/healthinfo");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagCrawlResult, setDiagCrawlResult] = useState<CrawlAnalysisResult | null>(null);
  const [diagAeoScore, setDiagAeoScore] = useState<AeoGeoApiResult | null>(null);
  const [diagGeoScore, setDiagGeoScore] = useState<AeoGeoApiResult | null>(null);
  const [diagCitation, setDiagCitation] = useState<AiCitationApiResponse | null>(null);
  const [diagCitationLoading, setDiagCitationLoading] = useState(false);
  const [diagMode, setDiagMode] = useState<"quick" | "detailed">("quick");
  const [diagStep, setDiagStep] = useState<string | null>(null);
  const [diagSubpages, setDiagSubpages] = useState<{ url: string; title: string }[]>([]);
  const [diagSubpagesLoading, setDiagSubpagesLoading] = useState(false);
  const [diagHistory, setDiagHistory] = useState<{
    id: string; url: string; mode: string; aeoScore: number | null; geoScore: number | null;
    crawlSummary: { schemaTypes: string[]; wordCount: number; h2Count: number; h3Count: number; hasMetaDescription: boolean } | null;
    createdAt: string;
  }[]>([]);
  const [diagHistoryOpen, setDiagHistoryOpen] = useState(false);

  /* ── AI 채팅 전송 ── */
  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatSending(true);

    try {
      // API 전송용 메시지 포맷 변환
      const apiMessages = [...chatMessages.filter((m) => m.role !== "ai" || chatMessages.indexOf(m) > 0), { role: "user" as const, text }]
        .map((m) => ({
          role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
          content: m.text,
        }));

      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error("응답 실패");
      const data = (await res.json()) as { reply: string };
      setChatMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "ai", text: "죄송합니다, 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요." }]);
    } finally {
      setChatSending(false);
    }
  }, [chatInput, chatSending, chatMessages]);

  // 채팅 메시지 추가 시 스크롤
  useEffect(() => {
    chatMessagesRef.current?.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  /* ── 스크롤 캡처 핸들러 ── */
  const handleScrollCapture = useCallback(async () => {
    const page = pageRef.current;
    const main = mainRef.current;
    // nav까지 포함하려면 page를 캡처 대상으로 사용합니다.
    const target = page ?? main;
    if (!target || capturing) return;

    setCapturing(true);

    // 캡처 준비: sticky nav → static, chatFab 숨기기
    const nav = (main?.previousElementSibling as HTMLElement | null) ?? null;
    const chatFab = document.querySelector(`.${styles.chatFab}`) as HTMLElement | null;
    const chatPanel = document.querySelector(`.${styles.chatPanel}`) as HTMLElement | null;

    const origNavPosition = nav?.style.position ?? "";
    const origNavTop = nav?.style.top ?? "";
    const origNavZIndex = nav?.style.zIndex ?? "";
    const origFabDisplay = chatFab?.style.display ?? "";
    const origPanelDisplay = chatPanel?.style.display ?? "";

    try {
      if (nav) {
        nav.style.position = "static";
        nav.style.top = "auto";
        nav.style.zIndex = "auto";
      }
      if (chatFab) chatFab.style.display = "none";
      if (chatPanel) chatPanel.style.display = "none";

      // scrollHeight, offsetHeight, getBoundingClientRect 중 가장 큰 값 사용
      const rect = target.getBoundingClientRect();
      const totalHeight = Math.max(target.scrollHeight, target.offsetHeight, Math.ceil(rect.height));
      const totalWidth = Math.max(target.scrollWidth, target.offsetWidth, Math.ceil(rect.width));
      const segmentHeight = 2000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const segmentCount = Math.ceil(totalHeight / segmentHeight);

      // 최종 캔버스 생성
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = totalWidth * dpr;
      finalCanvas.height = totalHeight * dpr;
      const ctx = finalCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context 생성 실패");

      // 세그먼트별 캡처
      for (let i = 0; i < segmentCount; i++) {
        const y = i * segmentHeight;
        const height = Math.min(segmentHeight, totalHeight - y);

        const segCanvas = await html2canvas(target, {
          y,
          height,
          width: totalWidth,
          scale: dpr,
          useCORS: true,
          logging: false,
          // 캡처용 UI 오버레이(회색 마스크)는 결과 이미지에 포함되지 않게 제외합니다.
          ignoreElements: (el) => (el as HTMLElement | null)?.classList?.contains(styles.captureOverlay) ?? false,
          // html2canvas는 DOM을 클론해서 렌더링하는데, 클론 시점에 CSS animation이 "초기 상태"로
          // 다시 시작되면(특히 delay가 있으면) 일부 섹션이 투명(=빈 화면)으로 캡처될 수 있습니다.
          // 캡처용 클론 DOM에서만 애니메이션/트랜지션을 비활성화해 항상 최종 상태로 렌더링합니다.
          onclone: (doc) => {
            const style = doc.createElement("style");
            style.textContent = `
              *, *::before, *::after {
                animation: none !important;
                transition: none !important;
              }
              .${styles.insightCard} {
                opacity: 1 !important;
                transform: none !important;
              }
              /* html2canvas는 background-clip:text를 지원하지 않아 gradient가 박스로 보임 → fallback */
              .${styles.navBrandAccent} {
                background: none !important;
                -webkit-background-clip: unset !important;
                background-clip: unset !important;
                -webkit-text-fill-color: #2dd4bf !important;
                color: #2dd4bf !important;
              }
              /* 캡처 시 overflow 강제 해제하여 하단 콘텐츠 누락 방지 */
              .${styles.page}, .${styles.main} {
                overflow: visible !important;
              }
            `;
            doc.head.appendChild(style);
          },
          windowHeight: totalHeight,
        });

        ctx.drawImage(segCanvas, 0, y * dpr, segCanvas.width, height * dpr);
      }

      // PNG 다운로드
      finalCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const tabName = NAV_TABS[activeTab] ?? "page";
        const ts = new Date().toISOString().slice(0, 10);
        a.download = `BiocomAI_${tabName}_${ts}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error("캡처 실패:", err);
    } finally {
      // 스타일 복원
      if (nav) {
        nav.style.position = origNavPosition;
        nav.style.top = origNavTop;
        nav.style.zIndex = origNavZIndex;
      }
      if (chatFab) chatFab.style.display = origFabDisplay;
      if (chatPanel) chatPanel.style.display = origPanelDisplay;
      setCapturing(false);
    }
  }, [capturing, activeTab]);

  const loadKeywords = useCallback(async (params: { days?: 7 | 30; startDate?: string; endDate?: string; signal?: AbortSignal }) => {
    setKeywordsLoading(true);
    setKeywordsError(null);

    const qs = new URLSearchParams({ limit: "50" });
    if (params.days) qs.set("days", String(params.days));
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);

    try {
      const res = await fetch(`${API_BASE_URL}/api/gsc/keywords?${qs.toString()}`, {
        signal: params.signal,
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as
        | (ApiKeywordsResponse & { startDate?: string; endDate?: string; message?: string })
        | null;

      if (!res.ok || !data) {
        throw new Error(data?.message ?? "키워드 데이터를 불러오지 못했습니다.");
      }

      const resolvedStart = data.startDate ?? params.startDate ?? "";
      const resolvedEnd = data.endDate ?? params.endDate ?? "";
      if (resolvedStart && resolvedEnd) {
        setKeywordsDateRange({ start: resolvedStart, end: resolvedEnd });
        setKeywordStartInput(resolvedStart);
        setKeywordEndInput(resolvedEnd);
      }

      if (data.keywords) {
        setKeywordsData(
          data.keywords.map((k) => ({
            query: k.query,
            clicks: k.clicks,
            impressions: k.impressions,
            ctr: k.ctr,
            position: k.position,
            isQA: k.isQA,
            featured: false,
            delta: 0,
            opportunity: k.opportunity,
          })),
        );
      }
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      setKeywordsError(e instanceof Error ? e.message : "키워드 데이터를 불러오지 못했습니다.");
    } finally {
      setKeywordsLoading(false);
    }
  }, []);

  const loadColumns = useCallback(async (params: { days?: 7 | 30; startDate?: string; endDate?: string }) => {
    setColLoading(true);
    const qs = new URLSearchParams({ limit: "60", category: "columns" });
    if (params.days) qs.set("days", String(params.days));
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);
    const mapCol = (c: { title: string; url: string; clicks: number; impressions: number; ctr: number; position: number; score: number; search: number; tech: number; engage: number; aeo: number }) => ({
      title: c.title, url: c.url, clicks: c.clicks, impressions: c.impressions, ctr: c.ctr, position: c.position, score: c.score, search: c.search, tech: c.tech, engage: c.engage, aeo: c.aeo,
    });
    try {
      const [colRes, allRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/gsc/columns?${qs.toString()}`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/gsc/columns?${new URLSearchParams({ limit: "30", ...(params.days ? { days: String(params.days) } : {}), ...(params.startDate ? { startDate: params.startDate, endDate: params.endDate! } : {}) }).toString()}`, { cache: "no-store" }),
      ]);
      const colData = await colRes.json().catch(() => null) as (ApiColumnsResponse & { startDate?: string; endDate?: string }) | null;
      const allData = await allRes.json().catch(() => null) as (ApiColumnsResponse & { startDate?: string; endDate?: string }) | null;
      if (colData?.startDate && colData?.endDate) {
        setColumnsDateRange({ start: colData.startDate, end: colData.endDate });
        setColStartInput(colData.startDate);
        setColEndInput(colData.endDate);
      }
      if (colData?.columns) setColumnPagesData(colData.columns.map(mapCol));
      if (allData?.columns) setColumnsData(allData.columns.map(mapCol));
    } catch { /* ignore */ }
    setColLoading(false);
  }, []);

  const BEHAVIOR_PRESET_DAYS: Record<Exclude<BehaviorRangePreset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };

  const loadBehavior = useCallback(async (params: { days?: number; startDate?: string; endDate?: string; signal?: AbortSignal }) => {
    setBehaviorLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (params.startDate && params.endDate) {
        qs.set("startDate", params.startDate);
        qs.set("endDate", params.endDate);
      } else if (params.days) {
        qs.set("startDate", `${params.days}daysAgo`);
        qs.set("endDate", "yesterday");
      }

      const res = await fetch(`${API_BASE_URL}/api/ga4/engagement?${qs.toString()}`, {
        signal: params.signal,
        cache: "no-store",
      });

      if (!res.ok) throw new Error();
      const d = await res.json() as { rows?: BehaviorData[]; startDate?: string; endDate?: string };

      if (d.rows && d.rows.length > 0) {
        setBehaviorData(d.rows.map((r) => ({
          page: (r as unknown as Record<string, unknown>).pagePath as string ?? r.page,
          sessions: r.sessions,
          users: r.users,
          avgTime: (r as unknown as Record<string, unknown>).avgEngagementTime as number ?? r.avgTime,
          bounceRate: r.bounceRate,
          scrollDepth: r.scrollDepth ?? 0,
          conversions: r.conversions,
        })));
      }

      // 날짜 범위 표시 업데이트
      const resolvedStart = d.startDate ?? params.startDate ?? (params.days ? dateNDaysAgo(params.days) : "");
      const resolvedEnd = d.endDate ?? params.endDate ?? dateNDaysAgo(1);
      if (resolvedStart && resolvedEnd) {
        setBehaviorDateRange({ start: resolvedStart.replace("daysAgo", "일전"), end: resolvedEnd === "yesterday" ? dateNDaysAgo(1) : resolvedEnd });
      }
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      // 실패 시 기존 데이터 유지
    } finally {
      setBehaviorLoading(false);
    }
  }, []);

  const AI_TRAFFIC_PRESET_DAYS: Record<Exclude<BehaviorRangePreset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };


  const loadPageSpeedHistory = useCallback(async (params?: { limit?: number; signal?: AbortSignal }) => {
    const limit = Math.max(1, Math.min(200, params?.limit ?? 50));
    setPageSpeedHistoryLoading(true);
    setPageSpeedHistoryError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/pagespeed/results?limit=${limit}`, {
        signal: params?.signal,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { results?: PageSpeedApiResult[]; message?: string } | null;
      if (!res.ok || !data) throw new Error(data?.message ?? "PageSpeed 측정 결과를 불러오지 못했습니다.");

      const results = data.results ?? [];
      setPageSpeedHistory(results);

      // CWV 탭 요약 표는 "페이지별 최신 1건"만 보여주기 위해 URL 기준으로 최신값만 남깁니다.
      const latestByUrl = new Map<string, PageSpeedApiResult>();
      for (const r of results) {
        if (!latestByUrl.has(r.url)) latestByUrl.set(r.url, r);
      }
      const latestResults = Array.from(latestByUrl.values());

      setCwvRealData(
        latestResults.map((r) => ({
          url: r.url,
          label: r.url.replace(/^https?:\/\//, ""),
          performance: r.performanceScore,
          seo: r.seoScore,
          accessibility: r.accessibilityScore,
          lcp: r.lcpMs,
          fcp: r.fcpMs,
          cls: r.cls,
          inp: r.inpMs ?? 0,
          ttfb: r.ttfbMs,
        })),
      );
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      setPageSpeedHistoryError(e instanceof Error ? e.message : "PageSpeed 측정 결과를 불러오지 못했습니다.");
    } finally {
      setPageSpeedHistoryLoading(false);
    }
  }, []);

  const refreshAeoGeoScores = useCallback(async (params: { targetUrl: string | null; strategy?: "mobile" | "desktop"; signal?: AbortSignal }) => {
    setAeoGeoScoresLoading(true);
    setAeoGeoScoresProgress(0);
    if (aeoGeoProgressTimerRef.current) {
      window.clearInterval(aeoGeoProgressTimerRef.current);
      aeoGeoProgressTimerRef.current = null;
    }

    const startedAt = Date.now();
    aeoGeoProgressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      // 0 -> 90% in ~5s (나머지는 실제 응답 완료 시 100%)
      const next = Math.min(90, Math.round((elapsed / 5000) * 90));
      setAeoGeoScoresProgress((prev) => {
        const cur = typeof prev === "number" && Number.isFinite(prev) ? prev : 0;
        return next > cur ? next : cur;
      });
    }, 200);

    try {
      const strategy = params.strategy ?? cwvStrategyRef.current;
      const qs = new URLSearchParams();
      if (params.targetUrl) qs.set("url", params.targetUrl);
      qs.set("strategy", strategy);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";

      const [aeoRes, geoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/aeo/score${suffix}`, { signal: params.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE_URL}/api/geo/score${suffix}`, { signal: params.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);

      if (aeoRes?.type === "AEO") setAeoScore(aeoRes as AeoGeoApiResult);
      if (geoRes?.type === "GEO") setGeoScore(geoRes as AeoGeoApiResult);
    } catch {
      // ignore
    } finally {
      if (aeoGeoProgressTimerRef.current) {
        window.clearInterval(aeoGeoProgressTimerRef.current);
        aeoGeoProgressTimerRef.current = null;
      }
      setAeoGeoScoresProgress(100);
      window.setTimeout(() => {
        setAeoGeoScoresLoading(false);
        setAeoGeoScoresProgress(null);
      }, 250);
    }
  }, []);

  /* 기존 useEffect */
  useEffect(() => {
    const controller = new AbortController();
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("fail");
        setConnectionStatus("ok");
      } catch {
        setConnectionStatus("error");
      }
    };
    void checkBackendConnection();
    return () => controller.abort();
  }, []);

  // PageSpeed 히스토리에 "대표 URL" 측정 리포트가 들어오면 GEO의 기술 점수 등을 갱신합니다.
  useEffect(() => {
    if (!aeoGeoTargetUrl) return;
    if (!pageSpeedHistory || pageSpeedHistory.length === 0) return;

    const targetKey = normalizeComparableUrl(aeoGeoTargetUrl);
    if (!targetKey) return;

    const hasTarget = pageSpeedHistory.some((r) => normalizeComparableUrl(r.url) === targetKey);
    if (!hasTarget) return;

    void refreshAeoGeoScores({ targetUrl: aeoGeoTargetUrl });
  }, [aeoGeoTargetUrl, pageSpeedHistory, refreshAeoGeoScores]);


  /* ── 키워드 기회 상세(모달) ── */
  useEffect(() => {
    if (!opportunityKeyword) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpportunityKeyword(null);
    };

    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [opportunityKeyword]);

  useEffect(() => {
    if (activeTab !== 2) setOpportunityKeyword(null);
  }, [activeTab]);

  // ChannelTalk: 탭 전환 시 setPage 호출
  useEffect(() => {
    const tabLabel = NAV_TABS[activeTab];
    if (tabLabel) setPage(resolveTabPageName(tabLabel));
  }, [activeTab]);

  /* ── 실데이터 fetch (마운트 시) ── */
  useEffect(() => {
    const ac = new AbortController();
    const sig = ac.signal;

    // KPI (7일 요약 + 스파크라인)
    fetch(`${API_BASE_URL}/api/gsc/kpi`, { signal: sig })
      .then((r) => r.json())
      .then((d: KpiApiData) => { if (d.current) setKpiData(d); })
      .catch(() => {});

    // 30일 트렌드
    fetch(`${API_BASE_URL}/api/gsc/trends?days=30`, { signal: sig })
      .then((r) => r.json())
      .then((d: { trend?: TrendPoint[] }) => { if (d.trend) setTrendData(d.trend); })
      .catch(() => {});

    // 키워드 (Q&A 자동 태깅)
    void loadKeywords({ days: 7, signal: sig });

    // 칼럼별 분석
    fetch(`${API_BASE_URL}/api/gsc/columns?limit=30`, { signal: sig })
      .then((r) => r.json())
      .then((d: ApiColumnsResponse & { startDate?: string; endDate?: string }) => {
        if (d.startDate && d.endDate) setColumnsDateRange({ start: d.startDate, end: d.endDate });
        if (d.columns) {
          setColumnsData(d.columns.map((c) => ({
            title: c.title,
            url: c.url,
            clicks: c.clicks,
            impressions: c.impressions,
            ctr: c.ctr,
            position: c.position,
            score: c.score,
            search: c.search,
            tech: c.tech,
            engage: c.engage,
            aeo: c.aeo,
          })));
        }
      })
      .catch(() => {});

	    // 칼럼(콘텐츠) 전용 조회: 전체 Top 페이지에 밀려 칼럼이 적게 노출되는 문제를 보완합니다.
	    fetch(`${API_BASE_URL}/api/gsc/columns?limit=60&category=columns`, { signal: sig })
	      .then((r) => r.json())
	      .then((d: ApiColumnsResponse & { startDate?: string; endDate?: string }) => {
	        if (d.startDate && d.endDate) setColumnsDateRange({ start: d.startDate, end: d.endDate });
	        if (d.columns) {
	          setColumnPagesData(d.columns.map((c) => ({
	            title: c.title,
	            url: c.url,
	            clicks: c.clicks,
	            impressions: c.impressions,
            ctr: c.ctr,
            position: c.position,
            score: c.score,
            search: c.search,
	            tech: c.tech,
	            engage: c.engage,
	            aeo: c.aeo,
	          })));

	          const urls = d.columns.map((c) => c.url).filter(Boolean);
	          const topUrl = pickRepresentativeColumnUrl(urls);
	          setAeoGeoTargetUrl(topUrl || null);
	          void refreshAeoGeoScores({ targetUrl: topUrl || null, signal: sig });
	        } else {
	          setAeoGeoTargetUrl(null);
	          void refreshAeoGeoScores({ targetUrl: null, signal: sig });
	        }
	      })
	      .catch(() => {
	        setAeoGeoTargetUrl(null);
	        void refreshAeoGeoScores({ targetUrl: null, signal: sig });
	      });

    // GA4 Engagement (기본 30일)
    void loadBehavior({ days: 30, signal: sig });

    // GA4 AI Traffic → Tab 0 요약 카드 + Tab 5 대시보드가 각각 자체 fetch

    // GA4 Funnel
    fetch(`${API_BASE_URL}/api/ga4/funnel`, { signal: sig })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { steps?: FunnelStep[] }) => { if (d.steps) setFunnelData(d.steps); })
      .catch(() => {});

	    // PageSpeed 측정 결과(최근 기록) 로드
	    void loadPageSpeedHistory({ signal: sig, limit: 50 });

	    // 키워드 인텐트 분석
      setIntentState("loading");
	    fetch(`${API_BASE_URL}/api/keywords/intent`, { signal: sig })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: IntentApiResponse) => {
        if (d.categories && d.categories.length > 0) {
          setIntentData(d);
          setIntentState("ready");
        } else {
          setIntentState("empty");
        }
      })
      .catch((e: unknown) => {
        if ((e as { name?: string } | null)?.name === "AbortError") return;
        setIntentState("error");
      });

    // AI 인사이트 (ChatGPT)
    setAiInsightsLoading(true);
    setInsightsState("loading");
    fetch(`${API_BASE_URL}/api/ai/insights`, { signal: sig })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { insights?: AiInsight[]; generatedAt?: string; _meta?: { source: string; generatedAt?: string; expiresAt?: string; ttl?: number } }) => {
        if (d.insights && d.insights.length > 0) {
          setAiInsights(d.insights);
          if (d.generatedAt) setAiInsightsTime(d.generatedAt);
          if (d._meta) setInsightsMeta(d._meta);
          setInsightsState("ready");
        } else {
          setInsightsState("empty");
        }
      })
      .catch((e: unknown) => {
        if ((e as { name?: string } | null)?.name === "AbortError") return;
        setInsightsState("error");
      })
      .finally(() => setAiInsightsLoading(false));

    return () => ac.abort();
  }, [loadKeywords, loadBehavior, loadPageSpeedHistory, refreshAeoGeoScores]);

  /* ── PageSpeed 수동 테스트 ── */
  const handleCwvTest = async () => {
    setCwvLoading(true);
    setPageSpeedHistoryError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pagespeed/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cwvTestUrl, strategy: cwvStrategy }),
      });
      const data = (await res.json().catch(() => null)) as (PageSpeedApiResult & { message?: string }) | null;
      if (!res.ok || !data?.url) throw new Error(data?.message ?? "PageSpeed 측정에 실패했습니다.");
      if (data.url) {
        const newEntry: CwvPageData = {
          url: data.url,
          label: data.url.replace(/^https?:\/\//, ""),
          performance: data.performanceScore,
          seo: data.seoScore,
          accessibility: data.accessibilityScore,
          lcp: data.lcpMs,
          fcp: data.fcpMs,
          cls: data.cls,
          inp: data.inpMs ?? 0,
          ttfb: data.ttfbMs,
        };
        setCwvRealData((prev) => {
          const existing = prev ?? [];
          const idx = existing.findIndex((p) => p.url === newEntry.url);
          if (idx >= 0) {
            const copy = [...existing];
            copy[idx] = newEntry;
            return copy;
          }
          return [...existing, newEntry];
        });

        // 측정 리포트 누적(최근 50건 유지)
        setPageSpeedHistory((prev) => {
          const existing = prev ?? [];
          return [data as PageSpeedApiResult, ...existing].slice(0, 50);
        });
      }
    } catch (e: unknown) {
      setPageSpeedHistoryError(e instanceof Error ? e.message : "PageSpeed 측정에 실패했습니다.");
    } finally {
      setCwvLoading(false);
    }
  };

  /* ── 페이지 진단 핸들러 (빠른/정밀 모드) ── */
  const handleDiagnosisTest = async (mode?: "quick" | "detailed") => {
    const effectiveMode = mode ?? diagMode;
    if (!diagUrl.trim()) return;
    setDiagLoading(true);
    setDiagError(null);
    setDiagCrawlResult(null);
    setDiagAeoScore(null);
    setDiagGeoScore(null);
    setDiagCitation(null);
    setDiagCitationLoading(false);
    setDiagStep(null);
    try {
      /* Step 1: 크롤 분석 */
      setDiagStep("1/4: 페이지 크롤링 중...");
      const crawlRes = await fetch(`${API_BASE_URL}/api/crawl/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: diagUrl.trim() }),
      });
      if (!crawlRes.ok) {
        const err = (await crawlRes.json().catch(() => null)) as { message?: string } | null;
        throw new Error(err?.message ?? "크롤링에 실패했습니다.");
      }
      const crawlData = (await crawlRes.json()) as CrawlAnalysisResult;
      setDiagCrawlResult(crawlData);

      /* Step 2: 정밀 모드일 때 PageSpeed 먼저 실행 */
      if (effectiveMode === "detailed") {
        setDiagStep("2/4: PageSpeed 측정 중...");
        try {
          await fetch(`${API_BASE_URL}/api/pagespeed/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: diagUrl.trim(), strategy: cwvStrategyRef.current }),
          });
        } catch {
          /* PageSpeed 실패는 무시 — GEO Score에서 0/10으로 표시됨 */
        }
      }

      /* Step 3: AEO/GEO 점수 */
      setDiagStep(effectiveMode === "detailed" ? "3/4: AEO/GEO 점수 계산 중..." : "2/2: AEO/GEO 점수 계산 중...");
      const qs = new URLSearchParams();
      qs.set("url", diagUrl.trim());
      qs.set("strategy", cwvStrategyRef.current);
      const urlParam = `?${qs.toString()}`;
      const [aeoRes, geoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/aeo/score${urlParam}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE_URL}/api/geo/score${urlParam}`).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (aeoRes?.type === "AEO") setDiagAeoScore(aeoRes as AeoGeoApiResult);
      if (geoRes?.type === "GEO") setDiagGeoScore(geoRes as AeoGeoApiResult);

      /* Step 4: 정밀 모드일 때 AI 인용도 측정 (비동기) */
      if (effectiveMode === "detailed") {
        setDiagStep("4/4: AI 인용도 분석 중...");
        setDiagCitationLoading(true);
        try {
          const citRes = await fetch(`${API_BASE_URL}/api/ai/citation?sampleSize=5`);
          if (citRes.ok) {
            const citData = (await citRes.json()) as AiCitationApiResponse;
            setDiagCitation(citData);
          }
        } catch {
          /* AI 인용도 실패는 무시 — 섹션이 미표시됨 */
        } finally {
          setDiagCitationLoading(false);
        }
      }
      /* 진단 완료 → 히스토리 자동 저장 */
      const crawlSummary = crawlData ? {
        schemaTypes: crawlData.schema.types,
        wordCount: crawlData.content.wordCount,
        h2Count: crawlData.content.h2Count,
        h3Count: crawlData.content.h3Count,
        hasMetaDescription: crawlData.content.hasMetaDescription,
      } : null;
      fetch(`${API_BASE_URL}/api/diagnosis/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: diagUrl.trim(),
          mode: effectiveMode,
          aeoScore: aeoRes?.normalizedScore ?? null,
          geoScore: geoRes?.normalizedScore ?? null,
          crawlSummary,
        }),
      }).then(() => loadDiagHistory()).catch(() => { /* 저장 실패 무시 */ });

    } catch (e) {
      setDiagError(e instanceof Error ? e.message : "진단에 실패했습니다.");
    } finally {
      setDiagLoading(false);
      setDiagStep(null);
    }
  };

  /* ── 하위 페이지 탐색 ── */
  const handleDiscoverSubpages = async () => {
    if (!diagUrl.trim()) return;
    setDiagSubpagesLoading(true);
    setDiagSubpages([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/crawl/subpages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: diagUrl.trim(), maxLinks: 30 }),
      });
      if (res.ok) {
        const data = (await res.json()) as { subpages: { url: string; title: string }[] };
        setDiagSubpages(data.subpages);
      }
    } catch { /* 실패 무시 */ }
    finally { setDiagSubpagesLoading(false); }
  };

  /* ── 진단 히스토리 로드 ── */
  const loadDiagHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/diagnosis/history`);
      if (res.ok) {
        const data = (await res.json()) as { records: typeof diagHistory };
        setDiagHistory(data.records);
      }
    } catch { /* 실패 무시 */ }
  };

  const aeoGeoTargetResolved = useMemo(() => {
    return aeoGeoTargetUrl ? resolveContentUrl(aeoGeoTargetUrl) : "";
  }, [aeoGeoTargetUrl]);

  const toggleBreakdownItem = useCallback((type: "AEO" | "GEO", name: string) => {
    const key = `${type}:${name}`;
    setOpenBreakdownItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderBreakdownExplain = (type: "AEO" | "GEO", item: ScoreBreakdown) => {
    const target = aeoGeoTargetResolved;
    const targetShort = target ? target.replace(/^https?:\/\//i, "") : "";

    const keywordWindowHint = keywordsDateRange?.start && keywordsDateRange?.end
      ? `참고: 키워드/순위는 GSC 기준 ${keywordsDateRange.start} ~ ${keywordsDateRange.end} 데이터를 사용합니다.`
      : "참고: 키워드/순위는 GSC 최신 지연(약 2~3일)을 고려해 '약 최근 7일' 구간으로 측정합니다.";

    switch (item.name) {
      case "schema":
      case "schemaGeo": {
        const scoreRules = item.name === "schema"
          ? "점수 기준: FAQPage(+7) · Article(+5) · 저자(Person)(+4) · HowTo(+2) · Medical(+2) = 최대 20점"
          : "점수 기준: FAQPage(+8) · Article(+5) · 저자(Person)(+4) · Speakable(+3) = 최대 20점";

        return (
          <>
            <p className={styles.breakdownExplainLead}>
              이 항목은 대표 URL 1개를 크롤링해서 JSON-LD(Structured Data) 존재 여부를 확인합니다. 페이지 유형(메인/목록/상품/칼럼 상세)에 따라 Article/저자 정보가 없을 수도 있어, 결과가 다르게 나올 수 있습니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>{scoreRules}</li>
              <li>현재 대표 URL: {target ? <code>{targetShort}</code> : "미지정"}</li>
              <li>칼럼 목록 페이지(예: <code>biocom.kr/healthinfo</code>)는 Article/저자 스키마가 없어도 정상입니다.</li>
              <li>칼럼 상세 페이지(예: <code>biocom.kr/healthinfo?bmode=view&amp;idx=...</code>)는 NewsArticle/Person(author) 스키마가 포함될 수 있습니다.</li>
              <li>참고: JSON-LD의 <code>@type</code>은 중첩 구조(예: author 객체)에서도 탐지되도록 개선되어, 칼럼 상세 페이지의 저자 정보도 정상 감지됩니다.</li>
              <li>{keywordWindowHint}</li>
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setDiagUrl(target);
                  setActiveTab(6);
                }}
                disabled={!target}
              >
                페이지 진단에서 확인
              </button>
            </div>
          </>
        );
      }
      case "qaKeywords": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              검색어 중 ‘질문형(Q&amp;A)’ 의도를 가진 키워드 비중을 측정합니다. (예: “~이란”, “~하는 법”, “왜”, “어떻게”, “추천” 등)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: Q&amp;A 비중(%)을 0~20점으로 환산 (20% 이상이면 만점)</li>
              <li>개선 액션: Q&amp;A형 제목/소제목 추가, 본문에 짧은 결론(1~2문장) + 근거 + FAQ 섹션 구성</li>
              <li>개선 액션: People Also Ask/관련 질문을 기준으로 “질문-답변” 구조의 단락을 늘리기</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      case "visibility": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              전체 키워드 중 TOP3에 랭크된 키워드 비중을 가시성으로 환산합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: TOP3 비중을 0~15점으로 환산 (약 30% 이상이면 만점)</li>
              <li>개선 액션: 상위 노출이 필요한 핵심 칼럼의 제목/H1, 서브토픽(H2) 정렬, 내부링크(관련 글/제품) 강화</li>
              <li>개선 액션: 검색 의도에 맞는 “정의/비교/추천/부작용/복용법” 등 섹션 보강</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      case "contentStructure": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              대표 URL의 콘텐츠 구조(H2/H3, 목록/표/인용, 메타 디스크립션 등)를 점수화합니다. 칼럼 페이지처럼 정보성 콘텐츠에서 가장 영향이 큽니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: H2(4) · H3(3) · 목록(3) · 표(2) · 인용(2) · 메타 디스크립션(1) = 최대 15점</li>
              <li>개선 액션: H2를 “문제/원인/해결/주의/FAQ” 등으로 3개 이상 구성</li>
              <li>개선 액션: 체크리스트/비교표/근거 인용 블록을 최소 1개 이상 추가</li>
              <li>개선 액션: 메타 디스크립션 50~160자 내로 요약(‘누가/무엇을/왜/어떻게’) 추가</li>
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setDiagUrl(target);
                  setActiveTab(6);
                }}
                disabled={!target}
              >
                페이지 진단으로 구조 확인
              </button>
            </div>
          </>
        );
      }
      case "aiCitation": {
        const unavailable = item.status === "unavailable";
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              표본 키워드에서 Google AI Overview가 노출될 때, AI 답변의 ‘참고 링크’에 biocom.kr이 인용되는 빈도를 측정합니다. (SerpAPI 기반)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 인용률 10% 이상이면 20점 만점(보수적 스케일)</li>
              <li>개선 액션: 칼럼 본문에 1~2문장 요약(Answer-first), 근거(연구/가이드) 인용, Author/Organization 스키마 강화</li>
              <li>개선 액션: 동일 주제의 ‘핵심 질문’들을 FAQ로 확장하고 내부링크로 묶기</li>
              {unavailable ? <li>현재 상태: SerpAPI 미설정이면 측정 불가(SERP_API_KEY 필요)</li> : null}
            </ul>
          </>
        );
      }
      case "aiTraffic": {
        const unavailable = item.status === "unavailable";
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              GA4에서 AI 추천 유입(예: chatgpt, perplexity, gemini 등)으로 들어온 세션 비중/절대량을 휴리스틱으로 점수화합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 비중(%) 또는 절대 세션 수(건) 중 더 높은 기준으로 0~10점 산정</li>
              <li>개선 액션: AI가 인용하기 쉬운 형태(정의/요약/표/FAQ)로 칼럼을 리라이팅하고 공유 가능한 랜딩 구성</li>
              <li>개선 액션: GA4에서 referral/source 분류가 깨지지 않도록 도메인/리디렉션/UTM 정리</li>
              {unavailable ? <li>현재 상태: GA4 API 미설정 또는 조회 실패(서비스 계정/속성 연결 확인 필요)</li> : null}
            </ul>
          </>
        );
      }
      case "aiOverview": {
        const unavailable = item.status === "unavailable";
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              표본 키워드에서 Google AI Overview 노출 비중을 측정합니다. (SerpAPI 기반)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 표본의 30% 이상에서 AI Overview가 나오면 25점 만점</li>
              <li>개선 액션: Q&amp;A형 커버리지 확대 + FAQ/Article/Author 스키마 적용 + 근거/출처 보강</li>
              {unavailable ? <li>현재 상태: 유료 SERP API 미설정이면 측정 불가(SERP_API_KEY 필요)</li> : null}
            </ul>
          </>
        );
      }
      case "searchRank": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              사이트 전체 키워드의 TOP3/TOP10 분포를 기반으로 GEO의 ‘검색 경쟁력’을 계산합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: TOP3 비중을 더 크게 반영(+40 가중)하고 TOP10 비중도 일부 반영(+10 가중)해 0~20점 산정</li>
              <li>개선 액션: TOP4~10 구간 키워드(‘올라갈 여지’가 큰 키워드)에 집중해 제목/본문/내부링크/스키마를 보강</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      case "contentTrust": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              대표 URL의 신뢰도 신호(근거 인용, 데이터 표, 체계적 목록, 충분한 분량)를 점수화합니다. YMYL(건강) 주제에서 특히 중요합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 인용(5) · 표(4) · 목록(3) · 1000단어+(3) = 최대 15점</li>
              <li>개선 액션: 근거 링크/출처를 인용 블록으로 분리하고, 핵심 수치/요약을 표로 정리</li>
              <li>개선 액션: 글 말미에 ‘요약/주의사항/FAQ’로 구조를 고정</li>
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setDiagUrl(target);
                  setActiveTab(6);
                }}
                disabled={!target}
              >
                페이지 진단으로 근거/구조 확인
              </button>
            </div>
          </>
        );
      }
      case "cwv": {
        const latest = (() => {
          if (!target) return null;
          const key = normalizeComparableUrl(target);
          const strategy = cwvStrategyRef.current;
          const match = (pageSpeedHistory ?? []).find((r) => normalizeComparableUrl(r.url) === key && r.strategy === strategy);
          return match ?? null;
        })();

        return (
          <>
            <p className={styles.breakdownExplainLead}>
              PageSpeed Insights의 Performance 점수를 기반으로 기술 성능을 0~10점으로 환산합니다. (예: Performance 83점 → 8/10)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: Performance 점수 / 10 → 0~10점</li>
              <li>현재 대표 URL: {target ? <code>{targetShort}</code> : "미지정"}</li>
              {latest ? (
                <li>
                  최근 측정({latest.strategy}): Performance {latest.performanceScore}점 · LCP {numberFormatter.format(latest.lcpMs)}ms · FCP {numberFormatter.format(latest.fcpMs)}ms · 측정 {new Date(latest.measuredAt).toLocaleString("ko-KR")}
                </li>
              ) : (
                <li>최근 측정 리포트가 없습니다. 아래 버튼으로 바로 측정할 수 있습니다.</li>
              )}
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setCwvTestUrl(target);
                  setActiveTab(4);
                }}
                disabled={!target}
              >
                Core Web Vitals에서 이 URL 측정
              </button>
            </div>
          </>
        );
      }
      case "ctrTrend": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              최근 7일과 이전 7일의 평균 CTR 변화를 비교해 GEO 점수에 반영합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 5점을 기준으로 CTR 변화폭(+/-)에 따라 0~10점으로 조정</li>
              <li>개선 액션: TOP 노출 페이지의 타이틀/메타 디스크립션을 ‘검색 의도+혜택’ 중심으로 개선, 구조화 데이터로 리치 결과 확보</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      default:
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              이 항목은 {type} 점수 산출의 하위 지표입니다. 현재 값과 개선 액션은 상세 로직(backend scoring)을 기준으로 표시됩니다.
            </p>
          </>
        );
    }
  };

  /* AI 인사이트 새로고침 (POST → GET 폴백) */
  const handleRefreshInsights = useCallback(() => {
    setAiInsightsLoading(true);
    setInsightsState("loading");
    fetch(`${API_BASE_URL}/api/ai/insights/refresh`, { method: "POST" })
      .catch(() => fetch(`${API_BASE_URL}/api/ai/insights`))
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { insights?: AiInsight[]; generatedAt?: string; _meta?: { source: string; generatedAt?: string; expiresAt?: string; ttl?: number } }) => {
        if (d.insights && d.insights.length > 0) {
          setAiInsights(d.insights);
          if (d.generatedAt) setAiInsightsTime(d.generatedAt);
          if (d._meta) setInsightsMeta(d._meta);
          setInsightsState("ready");
        } else {
          setInsightsState("empty");
        }
      })
      .catch(() => { setInsightsState("error"); })
      .finally(() => setAiInsightsLoading(false));
  }, []);

  /* AI 인사이트 재시도 (GET) */
  const handleRetryInsights = useCallback(() => {
    setAiInsightsLoading(true);
    setInsightsState("loading");
    fetch(`${API_BASE_URL}/api/ai/insights`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { insights?: AiInsight[]; generatedAt?: string; _meta?: { source: string; generatedAt?: string; expiresAt?: string; ttl?: number } }) => {
        if (d.insights && d.insights.length > 0) {
          setAiInsights(d.insights);
          if (d.generatedAt) setAiInsightsTime(d.generatedAt);
          if (d._meta) setInsightsMeta(d._meta);
          setInsightsState("ready");
        } else {
          setInsightsState("empty");
        }
      })
      .catch(() => { setInsightsState("error"); })
      .finally(() => setAiInsightsLoading(false));
  }, []);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setStartDate(dateNDaysAgo(PRESET_DAYS[preset]));
      setEndDate(dateNDaysAgo(1));
    }
  };

  const summary = useMemo(() => {
    return rows.reduce<{ clicks: number; impressions: number; positionTotal: number }>(
      (acc, row) => {
        acc.clicks += row.clicks ?? 0;
        acc.impressions += row.impressions ?? 0;
        acc.positionTotal += row.position ?? 0;
        return acc;
      },
      { clicks: 0, impressions: 0, positionTotal: 0 },
    );
  }, [rows]);

  const averageCtr = summary.impressions === 0 ? 0 : summary.clicks / summary.impressions;
  const averagePosition = rows.length === 0 ? 0 : summary.positionTotal / rows.length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/gsc/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: siteUrl || undefined, startDate, endDate, dimensions: ["page", "query", "device"], rowLimit, startRow: 0, type: "web" }),
      });
      const payload = (await response.json()) as GscQueryResponse & { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "검색 데이터 조회에 실패했습니다");
      setRows(payload.rows ?? []);
    } catch (submitError) {
      setRows([]);
      setError(submitError instanceof Error ? submitError.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const connectionLabel = connectionStatus === "ok" ? "서버 연결됨" : connectionStatus === "error" ? "서버 연결 실패" : "서버 확인 중...";

  /* CWV 데이터 */
  const cwvHasReal = cwvRealData !== null && cwvRealData.length > 0;
  const cwvPages = cwvHasReal ? cwvRealData : [];
  const cwvAvg = cwvPages.length > 0 ? {
    performance: Math.round(cwvPages.reduce((s, p) => s + p.performance, 0) / cwvPages.length),
    seo: Math.round(cwvPages.reduce((s, p) => s + p.seo, 0) / cwvPages.length),
    accessibility: Math.round(cwvPages.reduce((s, p) => s + p.accessibility, 0) / cwvPages.length),
  } : { performance: 0, seo: 0, accessibility: 0 };

  /* 실제 키워드/칼럼 데이터 (API 응답 또는 빈 배열) */
  const liveKeywords = keywordsData ?? [];
  const liveColumns = columnsData ?? [];
  const liveBehavior = behaviorData ?? [];
  const liveFunnel = funnelData ?? [];
  const columnOnlyPages = useMemo(() => {
    const base = columnPagesData && columnPagesData.length > 0 ? columnPagesData : liveColumns;
    return base.filter((c) => isColumnLikePage(c.url));
  }, [columnPagesData, liveColumns]);
  const otherPages = useMemo(() => liveColumns.filter((c) => !isColumnLikePage(c.url)), [liveColumns]);
  const columnKpis = useMemo(() => {
    const cols = columnOnlyPages;
    const total = cols.length;
    const clicked = cols.filter((c) => (c.clicks ?? 0) > 0).length;
    const avgScore = total > 0 ? cols.reduce((s, c) => s + (c.score ?? 0), 0) / total : 0;
    const top10 = [...cols].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
    const top10AvgCtr = top10.length > 0 ? top10.reduce((s, c) => s + (c.ctr ?? 0), 0) / top10.length : 0;
    const clickedRate = total > 0 ? (clicked / total) * 100 : 0;
    return { total, clicked, clickedRate, top10AvgCtr, avgScore };
  }, [columnOnlyPages]);

  const keywordRangeLabel = keywordRangePreset === "7d" ? "최근 7일" : keywordRangePreset === "30d" ? "최근 30일" : "기간 지정";
  const behaviorRangeLabel = behaviorRangePreset === "7d" ? "최근 7일" : behaviorRangePreset === "30d" ? "최근 30일" : behaviorRangePreset === "90d" ? "최근 90일" : "기간 지정";


  const aiOptimizationTasks = useMemo<OptimizationTask[]>(() => {
    const tasks: OptimizationTask[] = [];

    const schemaItem =
      aeoScore?.breakdown.find((b) => b.name === "schema") ??
      geoScore?.breakdown.find((b) => b.name === "schemaGeo") ??
      null;
    const schemaDetail = schemaItem?.detail ?? "";
    const schemaMeasured = schemaItem?.status === "measured";

    const hasFaq = schemaMeasured && /FAQPage\s*✅/.test(schemaDetail);
    const hasArticle = schemaMeasured && /Article\s*✅/.test(schemaDetail);
    const hasAuthor = schemaMeasured && /(저자 정보|저자).*✅/.test(schemaDetail);
    const hasSpeakable = schemaMeasured && /Speakable\s*✅/.test(schemaDetail);

    const schemaTarget = aeoGeoTargetUrl ? `대상: ${aeoGeoTargetUrl}` : "대상: (대표 페이지 URL 확인 필요)";
    const schemaHint = schemaMeasured ? `${schemaDetail}\n${schemaTarget}` : `${schemaDetail || "페이지 크롤링/측정 후 확인 가능합니다."}\n${schemaTarget}`;

    tasks.push({ id: "schema_faq", text: "FAQ 스키마 마크업 추가", done: hasFaq, detail: schemaHint });
    tasks.push({ id: "schema_article", text: "Article 스키마 마크업 추가", done: hasArticle, detail: schemaHint });
    tasks.push({ id: "schema_author", text: "저자(Person) 정보 구조화", done: hasAuthor, detail: schemaHint });
    tasks.push({ id: "schema_speakable", text: "Speakable(음성검색) 스키마 적용", done: hasSpeakable, detail: schemaHint });

    const contentItem = aeoScore?.breakdown.find((b) => b.name === "contentStructure") ?? null;
    const contentMeasured = contentItem?.status === "measured";
    const contentDetail = contentItem?.detail ?? "";
    const metaOk = contentMeasured && /메타 디스크립션\s*✅/.test(contentDetail);
    tasks.push({
      id: "meta_description",
      text: "메타 디스크립션 최적화",
      done: metaOk,
      detail: contentMeasured ? contentDetail : contentDetail || "페이지 크롤링/측정 후 확인 가능합니다.",
    });

    if (keywordsData) {
      const opportunities = keywordsData.filter((k) => k.opportunity);
      const examples = opportunities
        .slice(0, 3)
        .map((k) => `${k.query} (노출 ${numberFormatter.format(k.impressions)}, CTR ${decimalFormatter.format(k.ctr)}%)`)
        .join(" / ");
      tasks.push({
        id: "opportunity_keywords",
        text: `기회 키워드 ${opportunities.length}개 개선`,
        done: opportunities.length === 0,
        detail:
          opportunities.length > 0
            ? `기준: 노출 > 500 & CTR < 2%\n예시: ${examples}`
            : "현재 기준(노출 > 500 & CTR < 2%)에 해당하는 키워드가 없습니다.",
      });
    } else {
      tasks.push({
        id: "opportunity_keywords",
        text: "기회 키워드 탐지/개선(노출↑ CTR↓)",
        done: false,
        detail: "키워드 데이터 로드 대기 또는 GSC 연동이 필요합니다.",
      });
    }

    const historyCount = pageSpeedHistory?.length ?? 0;
    tasks.push({
      id: "pagespeed_history",
      text: "PageSpeed 측정 리포트 누적",
      done: historyCount > 0,
      detail: historyCount > 0 ? `최근 측정 ${historyCount}건` : "Core Web Vitals 탭에서 측정하면 자동 누적됩니다.",
    });

    if (cwvHasReal) {
      const avgLcp = Math.round(cwvPages.reduce((s, p) => s + p.lcp, 0) / cwvPages.length);
      const avgFcp = Math.round(cwvPages.reduce((s, p) => s + p.fcp, 0) / cwvPages.length);
      const lcpOk = avgLcp <= 2500;
      const fcpOk = avgFcp <= 1800;
      tasks.push({
        id: "cwv_lcp_fcp",
        text: "Core Web Vitals 최적화(LCP/FCP)",
        done: lcpOk && fcpOk,
        detail: `기준: ${cwvStrategy === "mobile" ? "모바일" : "데스크톱"}\n현재: Performance ${cwvAvg.performance}점, LCP ${(avgLcp / 1000).toFixed(1)}초, FCP ${(avgFcp / 1000).toFixed(1)}초`,
      });
    } else {
      tasks.push({
        id: "cwv_lcp_fcp",
        text: "Core Web Vitals 실측(PageSpeed) 실행",
        done: false,
        detail: "Core Web Vitals 탭에서 URL을 입력하고 측정하세요.",
      });
    }

    tasks.push({
      id: "ai_insights",
      text: "AI 인사이트 자동 생성/갱신",
      done: !!(aiInsights && aiInsights.length > 0),
      detail:
        aiInsights && aiInsights.length > 0
          ? `생성 시각: ${aiInsightsTime ? new Date(aiInsightsTime).toLocaleString("ko-KR") : "—"}`
          : "OPENAI_API_KEY 설정 시 자동 생성됩니다.",
    });

    return tasks;
  }, [aeoScore, geoScore, aeoGeoTargetUrl, keywordsData, pageSpeedHistory, cwvHasReal, cwvPages, cwvStrategy, cwvAvg.performance, aiInsights, aiInsightsTime]);

  const doneCount = aiOptimizationTasks.filter((t) => t.done).length;

  /* ── 페이지 진단: 감점 요인 자동 생성 ── */
  const diagnosisItems = useMemo<DiagnosisItem[]>(() => {
    if (!diagCrawlResult) return [];
    const { schema, content } = diagCrawlResult;
    const items: DiagnosisItem[] = [];

    // Schema 감점 요인
    if (!schema.hasFAQ) items.push({ category: "Schema", issue: "FAQPage 스키마 없음", priority: "urgent", recommendation: "FAQ 섹션을 추가하고 FAQPage 스키마를 적용하면 AI 검색에서 답변 소스로 선택될 확률이 높아집니다." });
    if (!schema.hasArticle) items.push({ category: "Schema", issue: "Article 스키마 없음", priority: "urgent", recommendation: "Article 또는 NewsArticle 스키마를 추가하여 콘텐츠의 제목, 작성일, 저자 정보를 구조화하세요." });
    if (!schema.hasAuthor) items.push({ category: "Schema", issue: "저자 정보(Person) 없음", priority: "important", recommendation: "저자 정보를 Person 스키마로 추가하면 E-E-A-T 신뢰도가 향상됩니다." });
    if (!schema.hasHowTo) items.push({ category: "Schema", issue: "HowTo 스키마 없음", priority: "optional", recommendation: "단계별 가이드 콘텐츠가 있다면 HowTo 스키마를 추가하여 리치 결과를 노릴 수 있습니다." });
    if (!schema.hasMedical) items.push({ category: "Schema", issue: "의료/건강 스키마 없음", priority: "important", recommendation: "MedicalWebPage 또는 HealthTopicContent 스키마를 추가하여 건강 콘텐츠 신뢰성을 강화하세요." });
    if (!schema.hasSpeakable) items.push({ category: "Schema", issue: "Speakable 스키마 없음", priority: "optional", recommendation: "Speakable 스키마를 추가하면 음성 검색(Google Assistant)에서 콘텐츠가 읽힐 수 있습니다." });

    // 콘텐츠 감점 요인
    if (content.h2Count < 3) items.push({ category: "콘텐츠", issue: `H2 제목 태그 ${content.h2Count}개 (3개 미만)`, priority: "urgent", recommendation: "H2 태그로 콘텐츠를 주제별로 분할하면 검색엔진이 구조를 이해하기 쉬워집니다. 최소 3개 이상 권장합니다." });
    if (content.h3Count === 0) items.push({ category: "콘텐츠", issue: "H3 소제목 없음", priority: "important", recommendation: "H3 태그로 세부 항목을 구분하면 콘텐츠 깊이가 향상됩니다." });
    if (content.listCount === 0) items.push({ category: "콘텐츠", issue: "목록(ul/ol) 없음", priority: "important", recommendation: "핵심 포인트를 목록으로 정리하면 AI가 정보를 추출하기 쉬워집니다." });
    if (content.tableCount === 0) items.push({ category: "콘텐츠", issue: "표(table) 없음", priority: "optional", recommendation: "비교 데이터나 수치 정보가 있다면 표로 정리하면 Featured Snippet 획득 확률이 높아집니다." });
    if (content.blockquoteCount === 0) items.push({ category: "콘텐츠", issue: "인용(blockquote) 없음", priority: "optional", recommendation: "전문가 의견이나 연구 결과를 인용하면 콘텐츠 신뢰성이 향상됩니다." });
    if (content.imgCount > 0 && content.imgWithAlt < content.imgCount) items.push({ category: "콘텐츠", issue: `이미지 alt 텍스트 누락 (${content.imgCount - content.imgWithAlt}/${content.imgCount}개)`, priority: "important", recommendation: "모든 이미지에 설명적인 alt 텍스트를 추가하세요. 접근성과 이미지 검색에 중요합니다." });
    if (!content.hasMetaDescription || content.metaDescLength < 70 || content.metaDescLength > 160) items.push({ category: "콘텐츠", issue: !content.hasMetaDescription ? "메타 설명 없음" : `메타 설명 길이 부적절 (${content.metaDescLength}자)`, priority: "urgent", recommendation: "메타 설명은 70~160자로 핵심 키워드를 포함하여 작성하세요. 검색 결과 CTR에 직접 영향을 줍니다." });
    if (content.wordCount < 1000) items.push({ category: "콘텐츠", issue: `본문 단어수 부족 (${numberFormatter.format(content.wordCount)}단어)`, priority: "important", recommendation: "건강 정보 콘텐츠는 최소 1,000단어 이상이 권장됩니다. 충분한 깊이로 주제를 다루세요." });

    // 우선순위 정렬: urgent > important > optional
    const order: Record<string, number> = { urgent: 0, important: 1, optional: 2 };
    items.sort((a, b) => order[a.priority] - order[b.priority]);
    return items;
  }, [diagCrawlResult]);

  /* KPI 실데이터 */
  const kpiClicks = kpiData?.current.clicks ?? summary.clicks ?? 0;
  const kpiCtr = kpiData ? kpiData.current.ctr * 100 : averageCtr ? averageCtr * 100 : 0;
  const kpiPosition = kpiData?.current.avgPosition ?? averagePosition ?? 0;
  const kpiSparkClicks = kpiData?.sparklines.clicks ?? [];
  const kpiSparkCtr = kpiData?.sparklines.ctr ?? [];
  const kpiSparkPosition = kpiData?.sparklines.position ?? [];

  /* ── Trend 차트 SVG 생성 ── */
  const trendSource = useMemo(() => {
    if (trendData && trendData.length > 0) {
      return trendData.map((d) => ({ clicks: d.clicks, impressions: d.impressions }));
    }
    return [];
  }, [trendData]);
  const trendIsLive = trendData !== null && trendData.length > 0;

  const trendSvg = useMemo(() => {
    if (trendSource.length === 0) return null;
    const w = 800, h = 180, padL = 45, padR = 10, padT = 10, padB = 30;
    const cw = w - padL - padR, ch = h - padT - padB;
    const maxI = Math.max(...trendSource.map((d) => d.impressions));
    const maxC = Math.max(...trendSource.map((d) => d.clicks));
    const n = trendSource.length - 1 || 1;
    const impPts = trendSource.map((d, i) => `${padL + (i / n) * cw},${padT + (1 - d.impressions / maxI) * ch}`).join(" ");
    const clkPts = trendSource.map((d, i) => `${padL + (i / n) * cw},${padT + (1 - d.clicks / maxC) * ch}`).join(" ");
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => padT + f * ch);
    const labelCount = Math.min(trendSource.length, 4);
    const labelIndices = Array.from({ length: labelCount }, (_, i) => Math.round(i * (trendSource.length - 1) / (labelCount - 1)));
    /* 그라디언트 fill용 폴리곤 포인트 (라인 아래 영역) */
    const clkAreaPts = `${padL + 0},${padT + ch} ${clkPts} ${padL + (n / n) * cw},${padT + ch}`;
    const impAreaPts = `${padL + 0},${padT + ch} ${impPts} ${padL + (n / n) * cw},${padT + ch}`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D9488" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="impGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748B" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#64748B" stopOpacity={0} />
          </linearGradient>
        </defs>
        {gridLines.map((y) => (
          <line key={y} x1={padL} y1={y} x2={w - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {labelIndices.map((idx) => (
          <text key={idx} x={padL + (idx / n) * cw} y={h - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {idx + 1}일
          </text>
        ))}
        <polygon points={impAreaPts} fill="url(#impGradient)" />
        <polyline points={impPts} fill="none" stroke="#64748B" strokeWidth="2" opacity="0.7" />
        <polygon points={clkAreaPts} fill="url(#clickGradient)" />
        <polyline points={clkPts} fill="none" stroke="#0D9488" strokeWidth="2.5" />
      </svg>
    );
  }, [trendSource]);

  return (
    <div ref={pageRef} className={styles.page}>
      {/* ════════ 네비바 ════════ */}
      <nav className={styles.topNav}>
        <div className={styles.navInner}>
          <div className={styles.navBrand} onClick={() => setActiveTab(0)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(0); }} style={{ cursor: "pointer" }}>
            <span className={styles.navBrandIcon}>🧠</span>
            <div className={styles.navBrandText}>
              <span className={styles.navBrandTitle}>Biocom <span className={styles.navBrandAccent}>AI Agent</span></span>
              <span className={styles.navBrandSub}>AEO/GEO Intelligence</span>
            </div>
          </div>
          <div className={styles.navTabs}>
            {NAV_TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                className={`${styles.navTab} ${activeTab === i ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab(i)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className={styles.navRight}>
            <button
              type="button"
              className={`${styles.captureBtn} ${capturing ? styles.captureBtnActive : ""}`}
              onClick={handleScrollCapture}
              disabled={capturing}
              title="현재 탭 전체 캡처"
            >
              📸
            </button>
            <div className={styles.statusWrap}>
              <span className={styles.statusDotWrap}>
                <span className={styles.statusDotPing} data-status={connectionStatus} />
                <span className={styles.statusDot} data-status={connectionStatus} />
              </span>
              <span className={styles.statusText}>
                {connectionStatus === "ok" ? "Connected" : connectionStatus === "error" ? "Disconnected" : "Checking..."}
              </span>
              <div className={styles.statusTooltip}>
                <div className={styles.statusTooltipRow}>
                  <span className={styles.statusTooltipLabel}>Backend</span>
                  <span className={styles.statusTooltipValue}>{API_BASE_URL}</span>
                </div>
                <div className={styles.statusTooltipRow}>
                  <span className={styles.statusTooltipLabel}>Status</span>
                  <span className={styles.statusTooltipValue}>{connectionLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main ref={mainRef} className={styles.main}>
        {/* ════════ TAB 0: 오버뷰 ════════ */}
        {activeTab === 0 && (
          <OverviewTab
            aeoScore={aeoScore} geoScore={geoScore}
            aeoGeoScoresLoading={aeoGeoScoresLoading} aeoGeoScoresProgress={aeoGeoScoresProgress}
            aeoDetailOpen={aeoDetailOpen} setAeoDetailOpen={setAeoDetailOpen}
            geoDetailOpen={geoDetailOpen} setGeoDetailOpen={setGeoDetailOpen}
            openBreakdownItems={openBreakdownItems} toggleBreakdownItem={toggleBreakdownItem}
            aeoGeoTargetResolved={aeoGeoTargetResolved}
            renderBreakdownExplain={renderBreakdownExplain}
            aiInsights={aiInsights} aiInsightsLoading={aiInsightsLoading}
            aiInsightsTime={aiInsightsTime} insightsMeta={insightsMeta}
            insightsState={insightsState}
            onRefreshInsights={handleRefreshInsights}
            onRetryInsights={handleRetryInsights}
            kpiData={kpiData}
            kpiClicks={kpiClicks} kpiCtr={kpiCtr} kpiPosition={kpiPosition}
            kpiSparkClicks={kpiSparkClicks} kpiSparkCtr={kpiSparkCtr} kpiSparkPosition={kpiSparkPosition}
            cwvAvg={cwvAvg}
            aiOptimizationTasks={aiOptimizationTasks}
            setActiveTab={setActiveTab}
            dataQueryOpen={dataQueryOpen} setDataQueryOpen={setDataQueryOpen}
            datePreset={datePreset} handlePresetChange={handlePresetChange}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            siteUrl={siteUrl} setSiteUrl={setSiteUrl}
            rowLimit={rowLimit} setRowLimit={setRowLimit}
            loading={loading} error={error} rows={rows}
            handleSubmit={handleSubmit}
          />
        )}


        {/* ════════ TAB 1: 칼럼별 분석 ════════ */}
        {activeTab === 1 && (
          <ColumnAnalysisTab
            columnsData={columnsData} columnPagesData={columnPagesData}
            colRangePreset={colRangePreset} setColRangePreset={setColRangePreset}
            colDatePickerOpen={colDatePickerOpen} setColDatePickerOpen={setColDatePickerOpen}
            colStartInput={colStartInput} setColStartInput={setColStartInput}
            colEndInput={colEndInput} setColEndInput={setColEndInput}
            columnsDateRange={columnsDateRange} colLoading={colLoading}
            columnKpis={columnKpis}
            columnOnlyPages={columnOnlyPages} otherPages={otherPages}
            loadColumns={loadColumns}
          />
        )}


        {/* ════════ TAB 2: 키워드 분석 ════════ */}
        {activeTab === 2 && (
          <KeywordAnalysisTab
            keywordsData={keywordsData} keywordsLoading={keywordsLoading}
            keywordsError={keywordsError} setKeywordsError={setKeywordsError}
            keywordRangePreset={keywordRangePreset} setKeywordRangePreset={setKeywordRangePreset}
            keywordDatePickerOpen={keywordDatePickerOpen} setKeywordDatePickerOpen={setKeywordDatePickerOpen}
            keywordStartInput={keywordStartInput} setKeywordStartInput={setKeywordStartInput}
            keywordEndInput={keywordEndInput} setKeywordEndInput={setKeywordEndInput}
            keywordsDateRange={keywordsDateRange} keywordRangeLabel={keywordRangeLabel}
            liveKeywords={liveKeywords}
            opportunityKeyword={opportunityKeyword} setOpportunityKeyword={setOpportunityKeyword}
            loadKeywords={loadKeywords}
          />
        )}


        {/* ════════ TAB 4: Core Web Vitals ════════ */}
        {activeTab === 4 && (
          <CoreWebVitalsTab
            cwvHasReal={cwvHasReal}
            cwvPages={cwvPages}
            cwvAvg={cwvAvg}
            cwvStrategy={cwvStrategy}
            setCwvStrategy={setCwvStrategy}
            cwvTestUrl={cwvTestUrl}
            setCwvTestUrl={setCwvTestUrl}
            cwvLoading={cwvLoading}
            handleCwvTest={handleCwvTest}
            pageSpeedHistory={pageSpeedHistory}
            pageSpeedHistoryLoading={pageSpeedHistoryLoading}
            pageSpeedHistoryError={pageSpeedHistoryError}
            loadPageSpeedHistory={loadPageSpeedHistory}
          />
        )}






        {/* ════════ TAB 3: AI 분석 보고서 ════════ */}
        {activeTab === 3 && (
          <AiReportTab apiBaseUrl={API_BASE_URL} />
        )}

        {/* ════════ TAB 5: 사용자 행동 ════════ */}
        {activeTab === 5 && (
          <UserBehaviorTab
            behaviorData={behaviorData} behaviorLoading={behaviorLoading}
            behaviorRangePreset={behaviorRangePreset} setBehaviorRangePreset={setBehaviorRangePreset}
            behaviorDatePickerOpen={behaviorDatePickerOpen} setBehaviorDatePickerOpen={setBehaviorDatePickerOpen}
            behaviorStartInput={behaviorStartInput} setBehaviorStartInput={setBehaviorStartInput}
            behaviorEndInput={behaviorEndInput} setBehaviorEndInput={setBehaviorEndInput}
            behaviorDateRange={behaviorDateRange} behaviorRangeLabel={behaviorRangeLabel}
            liveBehavior={liveBehavior}
            funnelData={funnelData} liveFunnel={liveFunnel} liveColumns={liveColumns}
            loadBehavior={loadBehavior}
            setDiagUrl={setDiagUrl} setActiveTab={setActiveTab}
          />
        )}


        {/* ════════ TAB 6: 페이지 진단 ════════ */}
        {activeTab === 6 && (
          <DiagnosisTab
            diagUrl={diagUrl} setDiagUrl={setDiagUrl}
            diagLoading={diagLoading} diagMode={diagMode} setDiagMode={setDiagMode}
            diagStep={diagStep} diagError={diagError}
            diagSubpages={diagSubpages} diagSubpagesLoading={diagSubpagesLoading}
            diagHistoryOpen={diagHistoryOpen} setDiagHistoryOpen={setDiagHistoryOpen}
            diagHistory={diagHistory}
            diagAeoScore={diagAeoScore} diagGeoScore={diagGeoScore}
            diagCrawlResult={diagCrawlResult}
            diagCitation={diagCitation} diagCitationLoading={diagCitationLoading}
            diagnosisItems={diagnosisItems}
            handleDiagnosisTest={handleDiagnosisTest}
            handleDiscoverSubpages={handleDiscoverSubpages}
            loadDiagHistory={loadDiagHistory}
          />
        )}

        {/* ════════ TAB 7: AI CRM 포털 ════════ */}
        {activeTab === 7 && (
          <div style={{ display: "grid", gap: 20 }}>
            {/* 바로가기 카드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { href: "/onboarding", title: "온보딩 체크사항", desc: "BigQuery·GA4·개발팀/마케팅팀 확인 항목, 요청 메모, 추후 기록", icon: "🧭" },
                { href: "/callprice", title: "상담사 가치 분석", desc: "상담사별 성과, 상담 효과 추정, 충원 시나리오 시뮬레이션", icon: "📊" },
                { href: "/cohort", title: "코호트 · 북극성 지표", desc: "성숙 기간별 전환율/매출 비교, 90일 재구매 순이익 추적", icon: "📈" },
                { href: "/biocom-ltv-cac", title: "바이오컴 재구매율 및 LTV/CAC", desc: "검사 후 영양제 전환, 재구매, 정기구독, Meta/Attribution ROAS 운영 판단", icon: "💎" },
                { href: "/crm", title: "CRM 관리 허브", desc: "후속 관리 대상, 실험 운영, 결제 귀속 진단", icon: "🎯" },
                { href: "/coffee", title: "더클린커피 CRM", desc: "재구매/LTR 분석, VIP 전략, 쿠폰 실험, 리드 마그넷", icon: "☕" },
                { href: "/coffee-pricing", title: "커피 가격 전략", desc: "원가 분석, 가격 인상/인하 판단, 경쟁사 비교, 마진 시뮬레이션", icon: "💲" },
                { href: "/coupon", title: "쿠폰 CRM 분석", desc: "쿠폰 발급/사용률, ROI 분석, 할인 최적화 전략", icon: "🎟" },
                { href: "/crm?tab=messaging", title: "알림톡 발송", desc: "카카오 알림톡 발송, 템플릿 선택, 테스트/실발송, 이력 확인", icon: "💬" },
                { href: "/ads", title: "광고 성과", desc: "Meta 광고 캠페인별 노출/클릭/비용/전환 실시간 모니터링", icon: "📊" },
                { href: "/ads/roas", title: "ROAS · iROAS", desc: "광고비 대비 매출(ROAS) + 증분 광고수익률(iROAS) 모니터링", icon: "📉" },
                { href: "/tracking-integrity", title: "추적 코드 및 데이터 정합성", desc: "아임웹 헤더·푸터 추적 코드, CAPI, Meta ROAS 차이와 보정 로드맵", icon: "🧩" },
                { href: "/ads/landing", title: "랜딩뷰 · Clarity", desc: "클릭→랜딩뷰 이탈 분석, UX 히트맵, 전환율 개선 인사이트", icon: "🔍" },
                { href: "/solution", title: "솔루션 소개", desc: "Biocom Growth AI Agent — 분석에서 실행까지 연결하는 AI CRM", icon: "🧠" },
              ].map((card) => (
                <a key={card.href} href={card.href} style={{
                  display: "flex", flexDirection: "column" as const, gap: 10,
                  padding: "24px", borderRadius: 14, textDecoration: "none",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95))",
                  border: "1px solid rgba(15,23,42,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}>
                  <span style={{ fontSize: "1.8rem" }}>{card.icon}</span>
                  <strong style={{ fontSize: "1rem", color: "var(--color-text-primary)" }}>{card.title}</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>{card.desc}</span>
                </a>
              ))}
            </div>

            {/* 안내 */}
            <div style={{
              borderLeft: "3px solid var(--color-primary)", background: "rgba(13,148,136,0.03)",
              borderRadius: "0 8px 8px 0", padding: "14px 18px",
              fontSize: "0.82rem", color: "var(--color-text-secondary)", lineHeight: 1.7,
            }}>
              <strong>AI CRM 포털</strong>: 상담사 가치 분석, 재구매 코호트, CRM 운영 관리, 알림톡 발송, ROAS/iROAS 모니터링을 한눈에 접근할 수 있는 허브입니다. 각 카드를 클릭하면 상세 화면으로 이동합니다.
              각 카드를 클릭하면 상세 화면으로 이동합니다.
            </div>
          </div>
        )}

        {/* ════════ TAB 8: 솔루션 소개 ════════ */}
        {activeTab === 8 && <SolutionIntroTab />}
      </main>

      {/* ════════ 캡처 오버레이 ════════ */}
      {capturing && (
        <div className={styles.captureOverlay}>
          <span>📸 캡처 중...</span>
        </div>
      )}

      {/* ════════ 플로팅 AI 채팅 ════════ */}
      <button type="button" className={styles.chatFab} onClick={() => setChatOpen((p) => !p)} aria-label="AI 상담 열기">💬</button>
      {chatOpen && (
        <div className={styles.chatPanel}>
          <div className={styles.chatPanelHeader}>
            <span className={styles.chatPanelTitle}>🤖 BiocomAI 어시스턴트<LiveBadge /></span>
            <button type="button" className={styles.chatClose} onClick={() => setChatOpen(false)} aria-label="채팅 닫기">✕</button>
          </div>
          <div ref={chatMessagesRef} className={styles.chatMessages}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`${styles.chatBubble} ${msg.role === "ai" ? styles.chatBubbleAi : styles.chatBubbleUser}`}>{msg.text}</div>
            ))}
            {chatSending && (
              <div className={`${styles.chatBubble} ${styles.chatBubbleAi}`}>답변 생성 중...</div>
            )}
          </div>
          <form className={styles.chatInputRow} onSubmit={(e) => { e.preventDefault(); void handleChatSend(); }}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="SEO 관련 질문을 입력하세요..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
            />
            <button type="submit" className={styles.chatSendBtn} disabled={chatSending || !chatInput.trim()}>전송</button>
          </form>
        </div>
      )}
    </div>
  );
}
