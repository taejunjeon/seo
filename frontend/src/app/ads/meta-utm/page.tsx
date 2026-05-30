"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import GlobalNav from "@/components/common/GlobalNav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

const SITES = [
  { site: "biocom", label: "바이오컴", account_id: "act_3138805896402376" },
  { site: "aibio", label: "AIBIO 리커버리랩", account_id: "act_377604674894011" },
  { site: "thecleancoffee", label: "더클린커피", account_id: "act_654671961007474" },
] as const;

const DATE_PRESETS = [
  { value: "last_3d", label: "최근 3일" },
  { value: "last_7d", label: "최근 7일" },
  { value: "last_14d", label: "최근 14일" },
  { value: "last_30d", label: "최근 30일" },
] as const;

const PERIOD_SUMMARY_PRESETS = [
  { value: "last_3d", label: "최근 3일" },
  { value: "last_7d", label: "최근 7일" },
  { value: "last_30d", label: "최근 30일" },
] as const;

const GROWTH_CONTEXT_CARDS = [
  {
    title: "왜 확인이 필요한가",
    body: "현재 내부 매출 원장은 Meta에서 들어온 주문을 잡고 있지만, 일부 주문에는 캠페인 숫자 ID가 아니라 {{campaign.id}} 같은 치환 전 문구나 공통 광고별칭만 남아 있습니다. 이 상태에서는 매출이 어느 캠페인·광고세트·광고에서 발생했는지 확정할 수 없어 ROAS가 미맵핑으로 남습니다.",
    action: "그로스팀이 실제 광고 화면의 URL과 숫자 ID를 확인해 주면, 같은 주문 매출을 광고 구조에 안전하게 붙일 수 있습니다.",
  },
  {
    title: "어떻게 확인하면 되는가",
    body: "Meta 광고 관리자에서 캠페인 > 광고세트 > 광고 소재까지 들어간 뒤, 해당 광고의 웹사이트 URL 또는 랜딩 URL과 URL Parameters 값을 그대로 복사해 주세요. 화면에 보이는 캠페인명만으로는 부족하고, campaign_id, adset_id, ad_id 숫자 값이 같이 있어야 확정도가 올라갑니다.",
    action: "체크리스트 CSV의 빈 칸에 실제 랜딩 URL, URL Parameters 원문, 숫자 ID 3종, 확인자와 확인 시각을 채우면 됩니다.",
  },
  {
    title: "무엇을 조심해야 하는가",
    body: "이미 잘 돌아가는 광고 소재의 랜딩 URL을 바로 바꾸면 학습 상태에 영향을 줄 수 있습니다. 이번 요청의 1차 목적은 광고를 수정하는 것이 아니라, 지금 설정되어 있는 값을 읽어서 매출 매핑 근거를 보강하는 것입니다.",
    action: "운영 중 소재는 먼저 읽기 전용 확인만 하고, 실제 URL 수정은 신규 소재나 수정이 필요한 소재에 한해 별도 판단합니다.",
  },
] as const;

const GROWTH_REQUIRED_FIELDS = [
  {
    label: "실제 광고 랜딩 URL 또는 웹사이트 URL",
    detail: "고객이 광고를 눌렀을 때 도착하는 최종 주소입니다. `/songyuul07`처럼 주문 원장에 남은 경로와 같은지 확인하는 핵심 근거입니다.",
  },
  {
    label: "URL Parameters 원문",
    detail: "Meta 광고 소재에 붙어 있는 UTM 설정값입니다. `utm_campaign={{campaign.id}}`가 실제 클릭에서 숫자로 바뀌는지, `campaign_alias`가 고유값인지 확인해야 합니다.",
  },
  {
    label: "campaign_id / adset_id / ad_id 숫자 ID",
    detail: "ROAS를 캠페인·광고세트·광고 단위로 나눌 때 가장 강한 증거입니다. 숫자 ID가 주문이나 실제 클릭 URL에 남으면 A 확정 매핑으로 올릴 수 있습니다.",
  },
  {
    label: "광고명 / 광고세트명 / 캠페인명",
    detail: "숫자 ID를 사람이 읽을 수 있는 이름과 짝지어 검토하기 위한 값입니다. 이름만으로는 확정하지 않고, 숫자 ID와 함께 봅니다.",
  },
  {
    label: "현재 게재 상태와 수정 가능 여부",
    detail: "ACTIVE 또는 WITH_ISSUES 상태의 소재는 바로 URL을 바꾸지 않습니다. 먼저 읽기 전용 확인 후, 수정이 필요한지 따로 판단합니다.",
  },
  {
    label: "확인자 / 확인 시각 / 변경 여부",
    detail: "나중에 매핑을 반영할 때 누가 언제 어떤 화면에서 확인했는지 남겨야 합니다. 실제 광고 설정 변경이 있었는지도 구분합니다.",
  },
] as const;

const GROWTH_PRIORITY_CASES = [
  {
    title: "/songyuul07",
    grade: "B 준확정 · 광고세트 단위 수동 확인",
    detail: "TJ님이 캠페인 ID `120245003319500396`, 광고세트 ID `120245370784880396`를 제공했고, 현재 `/songyuul07` 유입은 `meta_biocom_influencer_260506` 캠페인의 `meta_biocom_songyuul_260512` 광고세트로 수동 확정 관리합니다.",
    action: "캠페인·광고세트 단위 예산 판단 후보로 사용합니다. 최신 주문 수, 매출, ROAS는 이 화면의 광고세트 탭 A 확정 묶음에서 확인하고, 소재별 ROAS까지 나누려면 ad_id 또는 실제 광고 URL을 추가 확인합니다.",
  },
  {
    title: "/hwajung01",
    grade: "B 준확정 · 광고세트 단위 수동 확인",
    detail: "TJ님이 캠페인 ID `120245003319500396`, 광고세트 ID `120245498758680396`를 제공했고, 현재 `/hwajung01` 유입은 `meta_biocom_influencer_260506` 캠페인의 `meta_biocom_hwajung_260514` 광고세트로 수동 확정 관리합니다.",
    action: "캠페인·광고세트 단위 매핑 후보는 반영 완료입니다. 최신 주문 수, 매출, ROAS는 이 화면의 광고세트 탭 A 확정 묶음에서 확인하고, ad_id 확인 전까지는 광고세트 단위 매출로 보는 것이 안전합니다.",
  },
  {
    title: "/iiary02",
    grade: "A 확정/B 준확정 혼합 · 캠페인 확정 + 소재 구분 확인",
    detail: "TJ님 승인 기준으로 `/iiary02` 유입은 `meta_biocom_influencer_260506` 캠페인에 붙입니다. 그로스팀 파트장 정정 기준으로 `meta_biocom_iiari_260518 - 종대사`는 종합대사기능분석(종대사) 소재이며 활성 광고는 `meta_biocom_iiari_acid_260518`입니다. 사본 아닌 `meta_biocom_iiari_260518`은 음식물과민증분석(음과검) 소재로 보고, 활성 광고는 `meta_biocom_iiari_Igg_260518`입니다.",
    action: "숫자 ID가 있는 A 확정 row는 광고세트 단위까지 해석할 수 있습니다. 다만 숫자 ID 없이 템플릿 문구만 남은 D 미맵핑 16건은 종대사/음과검 어느 쪽으로도 자동 배정하지 않고, 숫자 ID가 있는 row만 소재별 ROAS로 읽습니다.",
  },
  {
    title: "/nanabebe05",
    grade: "B 준확정 · 그로스팀 ID 확인",
    detail: "그로스팀에서 캠페인 ID `120245003319500396`, 광고세트 ID `120245143376260396`를 제공했습니다. 캠페인·광고세트 단위로는 B 준확정 확인 재료이며, 광고 단위까지 A 확정하려면 ad_id와 실제 URL Parameters가 더 필요합니다.",
    action: "UTM 관리 원장에 `/nanabebe05` 행, 실제 광고 ID, URL Parameters를 채워 재발 방지용 사전으로 만듭니다.",
  },
  {
    title: "/hangzassi01",
    grade: "B 준확정 · 그로스팀 ID 확인",
    detail: "그로스팀에서 캠페인 ID `120242626179290396`, 광고세트 ID `120242626179270396`를 제공했습니다. 이 정도면 캠페인·광고세트 단위 매핑은 준확정으로 볼 수 있지만, 광고 단위 매출까지 나누려면 ad_id가 더 필요합니다.",
    action: "광고 ID까지 받으면 ad-level A 확정으로 올리고, 광고별 ROAS 표에서도 사용할 수 있게 만듭니다.",
  },
  {
    title: "inpork_biocom_igg",
    grade: "제외 · 광고 아님",
    detail: "이 값은 Meta 광고 소재가 아니라 인스타그램 프로필 링크의 인포크 기능을 구분하려고 붙인 UTM입니다. fb/ig 유입처럼 보일 수 있지만 광고비가 붙은 Meta 캠페인 매출로 넣으면 ROAS가 왜곡됩니다.",
    action: "Meta ROAS 캠페인 매핑에서 제외하고, non_meta 또는 inpork 채널 매출로 분리합니다.",
  },
] as const;

const RECOMMENDED_META_URL_PARAMS = "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}&utm_id={{campaign.id}}&campaign_alias=meta_biocom_songyuul07_igg&meta_campaign_id={{campaign.id}}&meta_adset_id={{adset.id}}&meta_ad_id={{ad.id}}&meta_site_source={{site_source_name}}&meta_placement={{placement}}";

type MetaUtmLevel = "campaign" | "adset" | "ad";
type MetaUtmSection = "ready" | "blocked" | "unmapped";
type MetaUtmLifecycle = "spending" | "issue" | "stopped" | "no_spend" | "other";
type PeriodPreset = (typeof PERIOD_SUMMARY_PRESETS)[number]["value"];

type MetaUtmMatch = {
  rate: number;
  threshold: number;
  level: "confirmed" | "probable" | "review" | "unmapped";
  label: string;
  matchedOrders: number;
  matchedRevenue: number;
  unmappedOrders: number;
  unmappedRevenue: number;
  basis: string[];
};

type MetaUtmRow = {
  rowKey: string;
  level: MetaUtmLevel;
  section: MetaUtmSection;
  name: string;
  campaignId: string;
  campaignName: string;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  thumbnailUrl: string | null;
  status: string;
  effectiveStatus: string;
  deliveryLabel: string;
  deliveryRaw: string;
  budget: {
    amount: number | null;
    label: string;
    source: "campaign" | "adset" | "none";
  };
  metrics: {
    impressions: number;
    reach: number;
    clicks: number;
    spend: number;
    cpm: number;
    cpc: number;
    purchases: number;
    purchaseValue: number;
    costPerPurchase: number | null;
  };
  att: {
    roas: number | null;
    revenue: number;
    orders: number;
    scope: "campaign" | "exact_adset" | "exact_ad" | "none";
    calculable: boolean;
  };
  evidence: {
    hasMetaSource?: boolean;
    hasPaidMedium?: boolean;
    hasCampaignId?: boolean;
    hasAdsetId?: boolean;
    hasAdId?: boolean;
    hasCampaignMacro?: boolean;
    hasAdsetMacro?: boolean;
    hasAdMacro?: boolean;
    hasLandingUrl?: boolean;
    readyAdCount: number;
    blockedAdCount: number;
    totalAdCount: number;
    reasons: string[];
    sampleTags: string | null;
    sampleUrl: string | null;
  };
  match?: MetaUtmMatch;
};

type MetaUtmUnmappedOrderSample = {
  approvedDate: string | null;
  amount: number;
  utmSource: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  landingPath: string | null;
  reason: string;
  dryRun?: MetaUtmUnmappedDryRunDecision;
};

type MetaUtmDryRunExcludeDecision = "YES" | "NO" | "REVIEW";

type MetaUtmUnmappedDryRunDecision = {
  bucket: string;
  label: string;
  excludeFromMetaUnmapped: MetaUtmDryRunExcludeDecision;
  canCampaignMatch: "NO" | "PROPOSAL_ONLY";
  confidence: number;
  matchedUtmAlias: string;
  matchedChannelBucket: string;
  matchedManagementMemo: string;
  recommendation: string;
  evidence: string[];
};

type MetaUtmUnmappedDryRunSummary = {
  rulesVersion: string;
  mode: "dry_run_only" | "approved_exclusion_applied";
  source: string;
  original: { orders: number; revenue: number };
  excludedIfApplied: { orders: number; revenue: number };
  reviewBeforeApply: { orders: number; revenue: number };
  retainedUnmapped: { orders: number; revenue: number };
  adjustedIfApplied: { orders: number; revenue: number };
  buckets: Array<{
    bucket: string;
    label: string;
    orders: number;
    revenue: number;
    excludeFromMetaUnmapped: MetaUtmDryRunExcludeDecision;
    confidenceAvg: number;
    recommendation: string;
  }>;
  samples: MetaUtmUnmappedOrderSample[];
  limitations: string[];
};

type MetaUtmBGradeProposalRow = {
  aliasKey: string;
  proposalGrade: string;
  proposalStatus: string;
  proposedCampaignId: string;
  proposedCampaignName: string;
  sourceRow: string;
  managementMemo: string;
  landingPath: string;
  ledgerPathCandidates: string;
  utmSource: string;
  utmCampaign: string;
  utmContent: string;
  channelBucket: string;
  productFamilyHint: string;
  auditRange: string;
  confidence: number;
  whyNotAutoConfirm: string;
  nextAction: string;
};

type MetaUtmBGradeProposal = {
  ok: boolean;
  status: "loaded" | "missing" | "not_applicable" | "error";
  mode: "proposal_only_do_not_auto_confirm";
  source: {
    dictionaryPath: string | null;
    summaryPath: string | null;
    generatedAtKst: string | null;
  };
  stats: {
    uniqueMetaishAliases: number;
    alreadyInManualSeed: number;
    proposalSingleCampaign: number;
    multiCampaignKeepSplit: number;
    noCurrentAuditMatch: number;
    proposalRows: number;
    auditGeneratedAt: string | null;
    auditRange: { startDate: string; endDate: string } | null;
  };
  rows: MetaUtmBGradeProposalRow[];
  limitations: string[];
};

type MetaUtmOriginalLandingBridge = {
  ok: boolean;
  status: "loaded" | "missing" | "not_applicable" | "error";
  mode: "read_only_draft_not_roas_applied";
  source: {
    jsonPath: string | null;
    reportPath: string | null;
    generatedAtKst: string | null;
    targetPath: string | null;
    windowUtc: { start: string; end: string } | null;
    site: string | null;
  };
  ledgerGap: {
    siteLandingExactPathRows: number | null;
    metadataTextMentions: number;
    originalLandingBridgeRows: number;
    textMentionsWithoutUsableOriginalUrl: number;
  };
  totals: {
    rowsWithUtm: number;
    rowsWithFbclid: number;
    numericIdRows: number;
    templatePhraseRows: number;
    checkoutStartedRows: number;
    confirmedPaymentRows: number;
    confirmedRevenueKrw: number;
  };
  confidenceRollup: Array<{
    grade: string;
    meaning: string;
    rows: number;
    checkoutStartedRows: number;
    confirmedPaymentRows: number;
    confirmedRevenueKrw: number;
  }>;
  campaignRollup: Array<{
    campaignEvidence: string;
    rows: number;
    checkoutStartedRows: number;
    confirmedPaymentRows: number;
    confirmedRevenueKrw: number;
    topTerms: Array<{ value: string; rows: number }>;
    topContents: Array<{ value: string; rows: number }>;
  }>;
  recommendations: string[];
  limitations: string[];
};

type MetaUtmDiagnostics = {
  ok: boolean;
  account_id: string;
  date_preset: string | null;
  generated_at: string;
  source_confidence?: string;
  source_confidence_reason?: string;
  source_max_timestamp?: string | null;
  date_range?: { start_date: string; end_date: string; timezone: string } | null;
  sections: {
    ready: MetaUtmRow[];
    blocked: MetaUtmRow[];
    unmapped?: MetaUtmRow[];
  };
  rows: MetaUtmRow[];
  unmapped?: {
    orders: number;
    revenue: number;
    samples: MetaUtmUnmappedOrderSample[];
    dryRun?: MetaUtmUnmappedDryRunSummary;
  };
  unmappedDryRun?: MetaUtmUnmappedDryRunSummary;
  bgradeProposal?: MetaUtmBGradeProposal;
  originalLandingBridge?: MetaUtmOriginalLandingBridge;
  summary: {
    total?: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    ready: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    blocked: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    unmapped?: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    byLevel: Record<MetaUtmLevel, { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number }>;
    rawCounts: { campaigns: number; adsets: number; ads: number; campaignInsights: number; adsetInsights: number; adInsights: number };
  };
  diagnostics?: {
    limitations?: string[];
  };
  cache?: {
    source: string;
    cached: boolean;
    cached_at_kst: string | null;
    next_refresh_at_kst: string | null;
    stale?: boolean;
    stale_reason?: string;
  };
  error?: string;
  degraded?: boolean;
};

type MetaUtmLiveInventoryAd = {
  adId: string;
  adName: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  effectiveStatus: string;
  updatedTime: string | null;
  urlTags: string | null;
  sampleUrl: string | null;
  evidenceReasons: string[];
};

type MetaUtmLiveInventory = {
  ok: boolean;
  account_id: string;
  checked_at: string;
  source: string;
  decision_note?: string;
  summary: {
    adsetsTotal: number;
    adsTotal: number;
    onAds: number;
    offOrNotActiveAds: number;
    activeAdsets: number;
    onAdsWithAnyUtmOrMetaParam: number;
    onAdsWithoutAnyUtmOrMetaParam: number;
    onAdsStandardDynamicTemplate: number;
    onAdsStaticAliasTemplate: number;
    onAdsCdnOnly: number;
    adsetsWithOnAdsMissingTracking: number;
  };
  adsetsWithMissingTracking: Array<{
    adsetId: string;
    adsetName: string;
    campaignId: string;
    campaignName: string;
    missingAds: number;
  }>;
  missingTrackingAds: MetaUtmLiveInventoryAd[];
  staticAliasAds: MetaUtmLiveInventoryAd[];
  cdnOnlyAds: MetaUtmLiveInventoryAd[];
  limitations: string[];
  cache?: MetaUtmDiagnostics["cache"];
  error?: string;
  degraded?: boolean;
};

type PeriodRoasSummary = {
  queried_at?: string;
  date_range?: { start_date: string; end_date: string; timezone: string } | null;
  summary?: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
    metaPurchaseValue?: number;
    metaPurchaseRoas?: number | null;
    meta?: {
      spend: number;
      purchaseValue: number;
      roas: number | null;
    };
    att?: {
      spend: number;
      purchaseValue: number;
      roas: number | null;
      orders: number;
    };
  };
};

type PeriodRoasSummaryResponse = {
  ok: boolean;
  results?: Partial<Record<PeriodPreset, PeriodRoasSummary>>;
  errors?: Record<string, { error?: string; response_message?: string }>;
  cache?: {
    source: string;
    cached?: boolean;
    cached_at_kst?: string | null;
    next_refresh_at_kst?: string | null;
    stale?: boolean;
  };
};

const LEVEL_LABEL: Record<MetaUtmLevel, string> = {
  campaign: "캠페인",
  adset: "광고 세트",
  ad: "광고",
};

const LIFECYCLE_LABEL: Record<MetaUtmLifecycle, string> = {
  spending: "지출 있음",
  issue: "게재 오류·제한",
  stopped: "중단·최근 게재",
  no_spend: "최근 7일 지출 없음",
  other: "상태 확인 필요",
};

const fmtNum = (value: number) => Math.round(value).toLocaleString("ko-KR");
const fmtKRW = (value: number | null | undefined) => (
  value == null ? "—" : `₩${Math.round(value).toLocaleString("ko-KR")}`
);
const fmtRoas = (value: number | null | undefined) => (value == null ? "—" : `${value.toFixed(2)}x`);
const fmtRatio = (value: number) => `${value.toFixed(0)}%`;
const truncateMiddle = (value: string | null | undefined, maxLength = 118) => {
  if (!value) return "없음";
  if (value.length <= maxLength) return value;
  const headLength = Math.max(24, Math.floor(maxLength * 0.58));
  const tailLength = Math.max(18, maxLength - headLength - 3);
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "미확인";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const describeMetaUtmError = (message: string) => {
  const lower = message.toLowerCase();
  if (
    lower.includes("too many calls")
    || lower.includes("rate-limiting")
    || lower.includes("user request limit")
  ) {
    return {
      title: "Meta API 호출 제한으로 새 데이터를 기다리는 중입니다",
      message: "캠페인 데이터가 없다는 뜻은 아닙니다. Meta가 이 광고 계정의 API 호출을 잠시 제한해 새 결과를 못 가져온 상태입니다.",
      action: "사전계산이 한 번 성공하면 이 화면은 캐시된 결과로 바로 표시됩니다. 지금은 10~20분 뒤 새로고침하거나, 호출량이 줄어든 뒤 다시 확인하면 됩니다.",
      technical: message,
    };
  }
  return {
    title: "Meta UTM 진단 조회 실패",
    message: "새 결과를 가져오지 못했습니다. 캐시가 없으면 표가 비어 보일 수 있습니다.",
    action: "잠시 뒤 새로고침하고, 같은 문제가 반복되면 backend 로그와 Meta API 응답을 확인해야 합니다.",
    technical: message,
  };
};

const deliveryTone = (label: string) => {
  if (label.includes("활동") || label.includes("머신러닝")) return { bg: "#ecfdf5", fg: "#047857", dot: "#059669", border: "#bbf7d0" };
  if (label.includes("준비")) return { bg: "#eff6ff", fg: "#1d4ed8", dot: "#3b82f6", border: "#bfdbfe" };
  if (label.includes("오류")) return { bg: "#fef2f2", fg: "#b91c1c", dot: "#dc2626", border: "#fecaca" };
  return { bg: "#f8fafc", fg: "#475569", dot: "#94a3b8", border: "#e2e8f0" };
};

const summarize = (rows: MetaUtmRow[]) => ({
  rows: rows.length,
  spend: rows.reduce((sum, row) => sum + row.metrics.spend, 0),
  purchases: rows.reduce((sum, row) => sum + row.metrics.purchases, 0),
  attRevenue: rows.reduce((sum, row) => sum + row.att.revenue, 0),
  attOrders: rows.reduce((sum, row) => sum + row.att.orders, 0),
});

const getLevelRows = (data: MetaUtmDiagnostics | null | undefined, level: MetaUtmLevel) => (
  (data?.rows ?? []).filter((row) => row.level === level)
);

const MATCH_THRESHOLD = 85;

const estimateLegacyMatchRate = (row: MetaUtmRow) => {
  if (row.match) return row.match.rate;
  if (row.att.orders > 0) return row.level === "campaign" ? 95 : 100;
  if (row.section === "ready") return 95;
  if (row.evidence.readyAdCount > 0) return 75;
  if (row.evidence.totalAdCount > 0) return 45;
  return 0;
};

const getRowMatch = (row: MetaUtmRow): MetaUtmMatch => {
  if (row.match) return row.match;
  const rate = estimateLegacyMatchRate(row);
  return {
    rate,
    threshold: MATCH_THRESHOLD,
    level: rate >= 95 ? "confirmed" : rate >= MATCH_THRESHOLD ? "probable" : rate > 0 ? "review" : "unmapped",
    label: rate >= MATCH_THRESHOLD ? "A 확정 기준 충족" : rate >= 70 ? "B 준확정 검토" : rate > 0 ? "C 후보 검토" : "D 미맵핑",
    matchedOrders: row.att.orders,
    matchedRevenue: row.att.revenue,
    unmappedOrders: 0,
    unmappedRevenue: 0,
    basis: row.evidence.reasons.length > 0 ? row.evidence.reasons : ["이전 캐시 응답이라 매칭 근거를 보수적으로 추정"],
  };
};

const getRowSection = (row: MetaUtmRow): MetaUtmSection => {
  const rate = getRowMatch(row).rate;
  if (rate >= MATCH_THRESHOLD) return "ready";
  if (rate > 0) return "blocked";
  return "unmapped";
};

const getReportGradeLabel = (row: MetaUtmRow) => {
  const rate = getRowMatch(row).rate;
  if (rate >= MATCH_THRESHOLD) return "A 확정";
  if (rate >= 70) return "B 준확정";
  if (rate > 0) return "C 후보";
  return "D 미맵핑";
};

const formatBridgeGradeLabel = (grade: string) => {
  if (grade === "A") return "A 확정";
  if (grade === "B") return "B 준확정";
  if (grade === "C") return "C 후보";
  if (grade === "D") return "D 미맵핑";
  return `${grade} 등급`;
};

const getLevelUtmRollup = (data: MetaUtmDiagnostics | null | undefined, level: MetaUtmLevel) => {
  const rows = getLevelRows(data, level);
  const ready = rows.filter((row) => getRowSection(row) === "ready");
  const blocked = rows.filter((row) => getRowSection(row) === "blocked");
  const unmapped = rows.filter((row) => getRowSection(row) === "unmapped");
  const stats = summarize(rows);
  return {
    rows,
    ready,
    blocked,
    unmapped,
    stats,
    readyStats: summarize(ready),
    blockedStats: summarize(blocked),
    unmappedStats: summarize(unmapped),
  };
};

const isOperationalSpendRow = (row: MetaUtmRow) => row.metrics.spend > 0;
const filterOperationalAdsetRows = (rows: MetaUtmRow[]) => rows.filter(isOperationalSpendRow);

const getGrowthHandoffStats = (data: MetaUtmDiagnostics | null) => {
  const ad = getLevelUtmRollup(data, "ad");
  const adset = getLevelUtmRollup(data, "adset");
  const adsetAttentionRows = [
    ...filterOperationalAdsetRows(adset.blocked),
    ...filterOperationalAdsetRows(adset.unmapped),
  ];
  return [
    {
      label: "Meta API 광고 소재",
      value: data ? `${fmtNum(data.summary.rawCounts.ads)}개` : "조회 전",
      detail: data?.generated_at ? `read-only ${formatDateTime(data.generated_at)} 기준` : "Meta API /ads inventory",
    },
    {
      label: "최근 진단 대상 광고",
      value: data ? `${fmtNum(ad.rows.length)}개` : "조회 전",
      detail: "최근 기간 지출·게재·insights evidence 기준",
    },
    {
      label: "A 확정 광고",
      value: data ? `${fmtNum(ad.ready.length)}개` : "조회 전",
      detail: "숫자 ID/강한 URL evidence · 매칭율 85% 이상",
    },
    {
      label: "B/C/D 확인 광고세트",
      value: data ? `${fmtNum(adsetAttentionRows.length)}개` : "조회 전",
      detail: "최근 7일 지출 있는 준확정·후보·미맵핑만 확인",
    },
  ];
};

const getRowLifecycle = (row: MetaUtmRow): MetaUtmLifecycle => {
  const status = (row.effectiveStatus || row.status || "").trim().toUpperCase();
  if (row.metrics.spend <= 0) return "no_spend";
  if (["ACTIVE", "IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED"].includes(status)) return "spending";
  if (status === "WITH_ISSUES") return "issue";
  if (status.includes("PAUSED") || status.includes("DELETED") || status.includes("ARCHIVED")) return "stopped";
  if (row.deliveryLabel.includes("최근 게재") || row.deliveryLabel.includes("꺼짐")) return "stopped";
  if (row.deliveryLabel.includes("광고 오류")) return "issue";
  return "other";
};

const getOperationalDeliveryLabel = (row: MetaUtmRow) => (
  row.metrics.spend <= 0 ? LIFECYCLE_LABEL.no_spend : row.deliveryLabel
);

const getLifecycleRows = (rows: MetaUtmRow[]) => {
  const grouped: Record<MetaUtmLifecycle, MetaUtmRow[]> = {
    spending: [],
    issue: [],
    stopped: [],
    no_spend: [],
    other: [],
  };
  rows.forEach((row) => grouped[getRowLifecycle(row)].push(row));
  (Object.keys(grouped) as MetaUtmLifecycle[]).forEach((key) => {
    grouped[key].sort((a, b) => b.metrics.spend - a.metrics.spend || a.name.localeCompare(b.name));
  });
  return grouped;
};

const getAdsetAttentionRows = (data: MetaUtmDiagnostics | null | undefined) => {
  const rollup = getLevelUtmRollup(data, "adset");
  return {
    blocked: [...rollup.blocked].sort((a, b) => b.metrics.spend - a.metrics.spend || a.name.localeCompare(b.name)),
    unmapped: [...rollup.unmapped].sort((a, b) => b.metrics.spend - a.metrics.spend || a.name.localeCompare(b.name)),
  };
};

const getOperationalUnmappedRows = (rows: MetaUtmRow[]) => rows.filter((row) => row.metrics.spend > 0);

const describeAdsetUtmState = (row: MetaUtmRow) => {
  const evidence = row.evidence;
  const hasAnyUtmEvidence = Boolean(
    evidence.hasMetaSource
    || evidence.hasPaidMedium
    || evidence.hasCampaignId
    || evidence.hasAdsetId
    || evidence.hasAdId
    || evidence.hasCampaignMacro
    || evidence.hasAdsetMacro
    || evidence.hasAdMacro
    || evidence.sampleTags
    || evidence.sampleUrl
  );
  if (getRowSection(row) === "unmapped") {
    return hasAnyUtmEvidence
      ? "광고세트 자체는 찾았지만 주문/광고 URL에서 캠페인·세트·광고를 붙일 근거가 없습니다."
      : "현재 API/캐시 기준으로 하위 광고 URL, URL Parameters, 숫자 ID evidence가 모두 비어 있습니다.";
  }
  if (evidence.hasCampaignId && evidence.hasAdsetId && evidence.hasAdId) {
    return "숫자 ID evidence가 일부 있어 D 미맵핑은 아니지만, 내부 결제완료 매출과 충분히 연결되지 않았습니다.";
  }
  if (evidence.hasCampaignMacro || evidence.hasAdsetMacro || evidence.hasAdMacro) {
    return "UTM 틀은 보이지만 실제 클릭에서 숫자로 치환된 campaign/adset/ad ID 근거가 부족합니다.";
  }
  return "랜딩 또는 source 흔적은 있지만 숫자 ID와 paid medium 근거가 부족해 C 후보 또는 B 준확정 검토 대상입니다.";
};

function EvidenceFlag({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <span className={ok ? "evidenceFlag ok" : "evidenceFlag missing"}>
      {label} {ok ? "있음" : "없음"}
    </span>
  );
}

function AdsetEvidenceCard({ row, tone }: { row: MetaUtmRow; tone: "blocked" | "unmapped" }) {
  const match = getRowMatch(row);
  const evidence = row.evidence;
  return (
    <article className={`adsetEvidenceCard ${tone}`}>
      <div className="adsetEvidenceTop">
        <div>
          <strong>{row.name}</strong>
          <span>{row.campaignName}</span>
        </div>
        <b>{getReportGradeLabel(row)} · {match.rate}%</b>
      </div>
      <p>{describeAdsetUtmState(row)}</p>
      <div className="adsetEvidenceMeta">
        <span>광고세트 ID <code>{row.adsetId ?? "없음"}</code></span>
        <span>캠페인 ID <code>{row.campaignId || "없음"}</code></span>
        <span>{getOperationalDeliveryLabel(row)} · 최근 7일 지출 {fmtKRW(row.metrics.spend)} · Meta 구매값 {fmtKRW(row.metrics.purchaseValue)}</span>
      </div>
      <div className="evidenceFlagGrid">
        <EvidenceFlag ok={evidence.hasLandingUrl} label="랜딩 URL" />
        <EvidenceFlag ok={Boolean(evidence.sampleTags)} label="URL Parameters" />
        <EvidenceFlag ok={evidence.hasMetaSource} label="utm_source/meta" />
        <EvidenceFlag ok={evidence.hasPaidMedium} label="utm_medium/paid" />
        <EvidenceFlag ok={evidence.hasCampaignId || evidence.hasCampaignMacro} label="campaign 값" />
        <EvidenceFlag ok={evidence.hasAdsetId || evidence.hasAdsetMacro} label="adset 값" />
        <EvidenceFlag ok={evidence.hasAdId || evidence.hasAdMacro} label="ad 값" />
      </div>
      <div className="adsetRawEvidence">
        <span>
          하위 광고 evidence: A 확정 {fmtNum(evidence.readyAdCount)}개 · B/C 확인 {fmtNum(evidence.blockedAdCount)}개 · 전체 {fmtNum(evidence.totalAdCount)}개
        </span>
        <span>판정 근거: {match.basis.join(" · ") || evidence.reasons.join(" · ") || "근거 없음"}</span>
        <span>샘플 URL: <code title={evidence.sampleUrl ?? ""}>{truncateMiddle(evidence.sampleUrl)}</code></span>
        <span>샘플 URL Parameters: <code title={evidence.sampleTags ?? ""}>{truncateMiddle(evidence.sampleTags)}</code></span>
      </div>
    </article>
  );
}

function AdsetAttentionDetails({ data }: { data: MetaUtmDiagnostics | null }) {
  const { blocked, unmapped } = getAdsetAttentionRows(data);
  const activeBlocked = blocked.filter(isOperationalSpendRow);
  const hiddenNoSpendBlocked = blocked.filter((row) => !isOperationalSpendRow(row));
  const activeUnmapped = unmapped.filter((row) => row.metrics.spend > 0);
  const hiddenNoSpendUnmapped = unmapped.filter((row) => row.metrics.spend <= 0);
  const hiddenNoSpendTotal = hiddenNoSpendBlocked.length + hiddenNoSpendUnmapped.length;
  if (activeBlocked.length === 0 && activeUnmapped.length === 0 && hiddenNoSpendTotal === 0) return null;
  const unmappedHasAnyUtm = activeUnmapped.some((row) => (
    row.evidence.hasLandingUrl
    || row.evidence.hasMetaSource
    || row.evidence.hasPaidMedium
    || row.evidence.sampleTags
    || row.evidence.sampleUrl
  ));
  return (
    <section className="adsetAttentionPanel">
      <div className="adsetAttentionHead">
        <div>
          <h3>광고세트 B 준확정 / C 후보 / D 미맵핑 상세</h3>
          <p>
            광고세트 숫자만 보여주지 않고, 어떤 세트가 왜 B 준확정·C 후보·D 미맵핑인지 바로 볼 수 있게 풀었습니다.
            D 미맵핑은 “Meta에 광고세트가 없다”가 아니라, 현재 원장/URL evidence로 ROAS에 붙일 근거가 없다는 뜻입니다.
          </p>
        </div>
        <div>
          <strong>D 미맵핑 확인 대상 {fmtNum(activeUnmapped.length)}개 · B/C 확인 {fmtNum(activeBlocked.length)}개</strong>
          <span>
            {hiddenNoSpendTotal > 0
              ? `최근 7일 지출 0원 B/C/D ${fmtNum(hiddenNoSpendTotal)}개는 사용 안 함으로 보고 숨김`
              : unmappedHasAnyUtm
              ? "D 미맵핑 중 일부에 URL 흔적이 있으므로 원본 광고 화면 확인 필요"
              : "D 미맵핑 항목은 현재 응답 기준 URL/UTM 샘플이 모두 없음"}
          </span>
        </div>
      </div>

      <div className="adsetAttentionGrid">
        <div className="adsetAttentionColumn unmapped">
          <div className="adsetAttentionColumnTitle">
            <strong>D 미맵핑 광고세트</strong>
            <span>최근 7일 지출 있는 항목만 표시 · 숨김 {fmtNum(hiddenNoSpendUnmapped.length)}개</span>
          </div>
          {activeUnmapped.length > 0 ? (
            activeUnmapped.map((row) => <AdsetEvidenceCard key={row.rowKey} row={row} tone="unmapped" />)
          ) : (
            <div className="adsetAttentionEmpty">
              <strong>현재 확인할 D 미맵핑 광고세트 없음</strong>
              <span>최근 7일 지출이 있는 D 미맵핑 광고세트가 없습니다. 지출 0원 D 미맵핑 {fmtNum(hiddenNoSpendUnmapped.length)}개는 실제 운용하지 않는 세트로 보고 상세 목록에서 제외했습니다.</span>
            </div>
          )}
        </div>

        <div className="adsetAttentionColumn blocked">
          <div className="adsetAttentionColumnTitle">
            <strong>B 준확정 / C 후보 광고세트</strong>
            <span>최근 7일 지출 있는 항목만 표시 · 숨김 {fmtNum(hiddenNoSpendBlocked.length)}개 · 지출 {fmtKRW(activeBlocked.reduce((sum, row) => sum + row.metrics.spend, 0))}</span>
          </div>
          {activeBlocked.length > 0 ? (
            activeBlocked.map((row) => <AdsetEvidenceCard key={row.rowKey} row={row} tone="blocked" />)
          ) : (
            <div className="adsetAttentionEmpty">
              <strong>현재 확인할 B 준확정 / C 후보 광고세트 없음</strong>
              <span>최근 7일 지출이 있는 B/C 확인 광고세트가 없습니다. 지출 0원 B/C {fmtNum(hiddenNoSpendBlocked.length)}개는 실제 운용하지 않는 세트로 보고 상세 목록에서 제외했습니다.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const matchTone = (rate: number) => {
  if (rate >= MATCH_THRESHOLD) return { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0", bar: "#059669" };
  if (rate > 0) return { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa", bar: "#f97316" };
  return { bg: "#f8fafc", fg: "#64748b", border: "#e2e8f0", bar: "#94a3b8" };
};

function StatusPill({ label }: { label: string }) {
  const tone = deliveryTone(label);
  return (
    <span className="statusPill" style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
      <span className="statusDot" style={{ background: tone.dot }} />
      {label}
    </span>
  );
}

function MatchRateCell({ row }: { row: MetaUtmRow }) {
  const match = getRowMatch(row);
  const tone = matchTone(match.rate);
  return (
    <div className="matchRateCell" title={match.basis.join(" · ")}>
      <span style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
        {match.rate}%
      </span>
      <div className="matchBar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, Math.max(0, match.rate))}%`, background: tone.bar }} />
      </div>
      <small>{getReportGradeLabel(row)} · {match.label}</small>
    </div>
  );
}

function IdStack({ row }: { row: MetaUtmRow }) {
  if (row.level === "ad") {
    return (
      <div className="idStack">
        <span>캠페인 {row.campaignId || "—"}</span>
        <span>광고세트 {row.adsetId || "—"}</span>
        <strong>광고 {row.adId || "—"}</strong>
      </div>
    );
  }
  if (row.level === "adset") {
    return (
      <div className="idStack">
        <span>캠페인 {row.campaignId || "—"}</span>
        <strong>광고세트 {row.adsetId || "—"}</strong>
      </div>
    );
  }
  return <span className="monoValue">{row.campaignId || "—"}</span>;
}

function NameCell({ row }: { row: MetaUtmRow }) {
  const match = getRowMatch(row);
  const section = getRowSection(row);
  const reason = section === "ready"
    ? match.basis[0] ?? `85% 이상 매칭 ${row.evidence.readyAdCount || (row.level === "ad" ? 1 : 0)}개`
    : match.basis.slice(0, 2).join(" · ");
  return (
    <div className={`nameCell ${row.level === "ad" ? "withThumb" : ""}`}>
      {row.level === "ad" && (
        <div className="thumbBox">
          {row.thumbnailUrl ? (
            <img src={row.thumbnailUrl} alt={row.name} />
          ) : (
            <span>no image</span>
          )}
        </div>
      )}
      <div className="nameText">
        <strong>{row.name}</strong>
        <span>
          {row.level === "campaign" ? "캠페인 단위" : row.level === "adset" ? row.campaignName : `${row.campaignName} / ${row.adsetName ?? "광고세트 미확인"}`}
        </span>
        <small title={row.evidence.sampleTags ?? row.evidence.sampleUrl ?? reason}>
          {reason || "UTM evidence 미확인"}
        </small>
      </div>
    </div>
  );
}

function MetricTable({ rows, section, level }: { rows: MetaUtmRow[]; section: MetaUtmSection; level: MetaUtmLevel }) {
  const emptyText = section === "ready"
    ? `${LEVEL_LABEL[level]} 중 매칭율 85% 이상 항목이 없습니다.`
    : section === "blocked"
      ? `${LEVEL_LABEL[level]} 중 1~84% 검토 항목이 없습니다.`
      : `${LEVEL_LABEL[level]} 중 D 미맵핑 항목이 없습니다.`;

  if (rows.length === 0) {
    return <div className="emptyState">{emptyText}</div>;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th className="nameCol">{LEVEL_LABEL[level]}</th>
            <th>게재</th>
            <th>매칭율%</th>
            <th>캠페인 ID</th>
            <th>예산</th>
            <th>ROAS(att)</th>
            <th>지출금액</th>
            <th>구매(수)</th>
            <th>구매 전환 금액</th>
            <th>도달</th>
            <th>CPM</th>
            <th>CPC(전체)</th>
            <th>구매당 비용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowKey}>
              <td className="nameCol"><NameCell row={row} /></td>
              <td><StatusPill label={getOperationalDeliveryLabel(row)} /></td>
              <td><MatchRateCell row={row} /></td>
              <td><IdStack row={row} /></td>
              <td>
                <div className="metricMain">{fmtKRW(row.budget.amount)}</div>
                <div className="metricSub">{row.budget.label}</div>
              </td>
              <td>
                <div className={row.att.calculable ? "roasOk" : "roasBlocked"}>{fmtRoas(row.att.roas)}</div>
                <div className="metricSub">{row.att.calculable ? `${fmtKRW(row.att.revenue)} · ${fmtNum(row.att.orders)}건` : getRowSection(row) === "unmapped" ? "D 미맵핑" : "B/C 확인 필요"}</div>
              </td>
              <td><div className="metricMain">{fmtKRW(row.metrics.spend)}</div></td>
              <td>
                <div className="metricMain">{fmtNum(row.metrics.purchases)}</div>
                <div className="metricSub">Meta 구매</div>
              </td>
              <td>
                <div className="metricMain">{fmtKRW(row.att.revenue)}</div>
                <div className="metricSub">{row.att.orders > 0 ? `내부 원장 ${fmtNum(row.att.orders)}건` : getRowSection(row) === "unmapped" ? "D 미맵핑" : "내부 매출 없음"}</div>
              </td>
              <td><div className="metricMain">{fmtNum(row.metrics.reach)}</div></td>
              <td><div className="metricMain">{fmtKRW(row.metrics.cpm)}</div></td>
              <td><div className="metricMain">{fmtKRW(row.metrics.cpc)}</div></td>
              <td><div className="metricMain">{fmtKRW(row.metrics.costPerPurchase)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionPanel({
  title,
  tone,
  rows,
  level,
  levelSpend,
}: {
  title: string;
  tone: MetaUtmSection;
  rows: MetaUtmRow[];
  level: MetaUtmLevel;
  levelSpend: number;
}) {
  const stats = summarize(rows);
  const spendShare = levelSpend > 0 ? (stats.spend / levelSpend) * 100 : 0;
  const description = tone === "ready"
    ? "광고 구조와 매출을 85% 이상 확률로 연결할 수 있어 예산 판단에 쓸 수 있는 A 확정 묶음입니다."
    : tone === "blocked"
      ? "일부 evidence는 있지만 85%에는 못 미쳐 B 준확정 또는 C 후보로 나눠 확인해야 하는 묶음입니다."
      : "현재 기준으로 캠페인/광고세트/광고를 특정하기 어려워 ROAS에 붙이지 않는 D 미맵핑 묶음입니다.";
  return (
    <section className={`sectionPanel ${tone}`}>
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="sectionStats">
          <span>{fmtNum(stats.rows)}행</span>
          <span>{fmtKRW(stats.spend)}</span>
          <span>Meta 구매 {fmtNum(stats.purchases)}</span>
          <span>내부매출 {fmtKRW(stats.attRevenue)}</span>
          <span>{fmtRatio(spendShare)}</span>
        </div>
      </div>
      <MetricTable rows={rows} section={tone} level={level} />
    </section>
  );
}

function UnmappedOrdersPanel({ summary }: { summary?: MetaUtmDiagnostics["unmapped"] }) {
  if (!summary || summary.orders === 0) return null;
  return (
    <section className="unmappedOrdersPanel">
      <div className="sectionHeader">
        <div>
          <h2>D 미맵핑 주문 묶음</h2>
          <p>Meta 유입 결제완료 evidence는 있지만 현재 alias/ID/landing path 기준으로 단일 캠페인을 확정하지 못한 건입니다.</p>
        </div>
        <div className="sectionStats">
          <span>{fmtNum(summary.orders)}건</span>
          <span>{fmtKRW(summary.revenue)}</span>
          <span>샘플 {fmtNum(summary.samples.length)}개</span>
        </div>
      </div>
      <div className="unmappedList">
        {summary.samples.map((sample, index) => (
          <div key={`${sample.approvedDate ?? "date"}:${index}`} className="unmappedItem">
            <strong>{fmtKRW(sample.amount)}</strong>
            <span>{sample.approvedDate ?? "일자 미확인"}</span>
            <small>campaign {sample.utmCampaign} · term {sample.utmTerm} · content {sample.utmContent}</small>
            <small>source {sample.utmSource} · landing {sample.landingPath ?? "미확인"}</small>
            <em>{sample.reason}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

const DRY_RUN_DECISION_LABEL: Record<MetaUtmDryRunExcludeDecision, string> = {
  YES: "Meta D 미맵핑에서 제외 적용",
  REVIEW: "raw 원장 확인 후 결정",
  NO: "계속 D 미맵핑 보류",
};

function DryRunExclusionPanel({ summary }: { summary?: MetaUtmUnmappedDryRunSummary }) {
  if (!summary || summary.original.orders === 0) return null;
  const sampleRows = summary.samples.slice(0, 10);
  return (
    <section className="dryRunPanel">
      <div className="sectionHeader">
        <div>
          <h2>비Meta 오분류 제외 적용 현황</h2>
          <p>
            승인된 제외 원칙에 따라 현재 D 미맵핑 주문 중 Meta 광고 캠페인 매출로 보면 안 되는 값을 분리했습니다.
            YES는 집계에서 제외하고, REVIEW는 raw 원장 확인 전까지 보류로 남깁니다.
          </p>
        </div>
        <div className="sectionStats">
          <span>기존 {fmtNum(summary.original.orders)}건</span>
          <span>{fmtKRW(summary.original.revenue)}</span>
          <span>approved rule</span>
        </div>
      </div>
      <div className="dryRunImpactGrid">
        <article>
          <span>제외 적용</span>
          <strong>{fmtNum(summary.excludedIfApplied.orders)}건 · {fmtKRW(summary.excludedIfApplied.revenue)}</strong>
          <small>Google Ads, 쿠폰, 인포크처럼 Meta 광고 ROAS에 넣으면 왜곡되는 후보</small>
        </article>
        <article>
          <span>확인 후 결정</span>
          <strong>{fmtNum(summary.reviewBeforeApply.orders)}건 · {fmtKRW(summary.reviewBeforeApply.revenue)}</strong>
          <small>IG 프로필 링크 또는 fbclid only 가능성이 있어 raw 원장 확인 필요</small>
        </article>
        <article>
          <span>계속 D 미맵핑 보류</span>
          <strong>{fmtNum(summary.retainedUnmapped.orders)}건 · {fmtKRW(summary.retainedUnmapped.revenue)}</strong>
          <small>Meta placeholder 또는 UTM/랜딩 부재로 캠페인 특정 불가</small>
        </article>
        <article>
          <span>제외만 적용한 뒤</span>
          <strong>{fmtNum(summary.adjustedIfApplied.orders)}건 · {fmtKRW(summary.adjustedIfApplied.revenue)}</strong>
          <small>현재 로컬 백엔드 집계에 반영된 Meta D 미맵핑 기준</small>
        </article>
      </div>
      <div className="dryRunBucketGrid">
        {summary.buckets.map((bucket) => (
          <article key={bucket.bucket} className={`dryRunBucket ${bucket.excludeFromMetaUnmapped.toLowerCase()}`}>
            <div>
              <strong>{bucket.label}</strong>
              <span>{DRY_RUN_DECISION_LABEL[bucket.excludeFromMetaUnmapped]}</span>
            </div>
            <p>{bucket.recommendation}</p>
            <small>{fmtNum(bucket.orders)}건 · {fmtKRW(bucket.revenue)} · 신뢰도 {Math.round(bucket.confidenceAvg * 100)}%</small>
          </article>
        ))}
      </div>
      <div className="dryRunSampleList">
        {sampleRows.map((sample, index) => (
          <article key={`${sample.approvedDate ?? "date"}:${index}`}>
            <div>
              <strong>{fmtKRW(sample.amount)}</strong>
              <span>{sample.dryRun ? DRY_RUN_DECISION_LABEL[sample.dryRun.excludeFromMetaUnmapped] : "분류 대기"}</span>
            </div>
            <p>{sample.dryRun?.recommendation ?? sample.reason}</p>
            <small>source {sample.utmSource} · campaign {sample.utmCampaign} · content {sample.utmContent} · landing {sample.landingPath ?? "미확인"}</small>
          </article>
        ))}
      </div>
      <div className="dryRunFootnote">
        {summary.limitations.map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}

function BGradeProposalPanel({
  proposal,
  query,
}: {
  proposal?: MetaUtmBGradeProposal;
  query: string;
}) {
  if (!proposal || proposal.status === "not_applicable") return null;
  const normalizedQuery = query.trim().toLowerCase();
  const rows = proposal.rows
    .filter((row) => {
      if (!normalizedQuery) return true;
      return [
        row.aliasKey,
        row.proposedCampaignName,
        row.proposedCampaignId,
        row.managementMemo,
        row.landingPath,
        row.utmCampaign,
        row.productFamilyHint,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => {
      const confidenceGap = b.confidence - a.confidence;
      if (Math.abs(confidenceGap) > 0.001) return confidenceGap;
      return a.aliasKey.localeCompare(b.aliasKey);
    });
  const visibleRows = rows.slice(0, 30);
  const auditRange = proposal.stats.auditRange
    ? `${proposal.stats.auditRange.startDate}~${proposal.stats.auditRange.endDate}`
    : "audit range 미확인";

  return (
    <section className="bgradePanel">
      <div className="sectionHeader">
        <div>
          <h2>B 준확정 제안 사전</h2>
          <p>
            UTM 관리 파일, 과거 Meta URL 감사, TJ님 read-only 확인에서 단일 캠페인으로만 보이는 alias입니다.
            A 확정이 아니라, 주문에 같은 alias가 들어왔을 때 “이 캠페인 후보부터 보라”고 띄우는 준확정 검토 사전입니다.
          </p>
        </div>
        <div className="sectionStats">
          <span>{proposal.status === "loaded" ? "로딩 완료" : "준비 필요"}</span>
          <span>{fmtNum(proposal.stats.proposalRows)}개 제안</span>
          <span>{auditRange}</span>
        </div>
      </div>

      {proposal.status !== "loaded" ? (
        <div className="emptyState">{proposal.limitations[0] ?? "B 준확정 제안 사전을 아직 읽지 못했습니다."}</div>
      ) : (
        <>
          <div className="bgradeStatsGrid">
            <article>
              <span>Meta 성격 alias</span>
              <strong>{fmtNum(proposal.stats.uniqueMetaishAliases)}개</strong>
              <small>UTM 파일에서 Meta 후보로 분류된 값</small>
            </article>
            <article>
              <span>B 준확정 제안</span>
              <strong>{fmtNum(proposal.stats.proposalSingleCampaign)}개</strong>
              <small>단일 캠페인으로만 보인 검토 후보</small>
            </article>
            <article>
              <span>이미 수동 seed</span>
              <strong>{fmtNum(proposal.stats.alreadyInManualSeed)}개</strong>
              <small>이미 manual_verified 또는 split_required로 관리 중</small>
            </article>
            <article>
              <span>split 유지</span>
              <strong>{fmtNum(proposal.stats.multiCampaignKeepSplit)}개</strong>
              <small>여러 캠페인에 걸려 자동 제안 금지</small>
            </article>
            <article>
              <span>audit 미확인</span>
              <strong>{fmtNum(proposal.stats.noCurrentAuditMatch)}개</strong>
              <small>최신 Ads Manager 확인 전 후보로도 올리지 않음</small>
            </article>
          </div>
          <div className="bgradeRuleBox">
            <strong>화면에서 이 사전을 쓰는 방식</strong>
            <span>
              주문 원장에 같은 alias가 들어오면 바로 A 확정하지 않고 B 준확정 후보로만 보여줍니다.
              그 다음 최신 Meta API URL, 그로스팀 Ads Manager export, campaign/adset/ad 숫자 ID 중 하나로 확인되면 A 확정 또는 manual_verified로 승급합니다.
              API가 실제 랜딩 대신 Meta CDN 이미지만 주는 지출 광고세트도 UTM 파일의 고유 alias와 강하게 맞으면 보강 후보로만 올립니다.
            </span>
          </div>
          <div className="bgradeTableWrap">
            <table>
              <thead>
                <tr>
                  <th className="aliasCol">검토 alias</th>
                  <th>제안 캠페인</th>
                  <th>랜딩/상품 힌트</th>
                  <th>상태</th>
                  <th>다음 액션</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.aliasKey}:${row.proposedCampaignId}:${row.sourceRow}`}>
                    <td className="aliasCol">
                      <div className="bgradeAliasCell">
                        <strong>{row.aliasKey}</strong>
                        <small>UTM campaign {row.utmCampaign || "미확인"} · source row {row.sourceRow || "—"}</small>
                      </div>
                    </td>
                    <td>
                      <div className="bgradeCampaignCell">
                        <strong>{row.proposedCampaignName}</strong>
                        <small>campaign id {row.proposedCampaignId}</small>
                      </div>
                    </td>
                    <td>
                      <div className="bgradeCampaignCell">
                        <strong>{row.managementMemo || row.productFamilyHint || "운영 메모 없음"}</strong>
                        <small>{row.landingPath || row.ledgerPathCandidates || "랜딩 후보 없음"}</small>
                      </div>
                    </td>
                    <td>
                      <span className="bgradeStatus">A 확정 금지 · {Math.round(row.confidence * 100)}%</span>
                    </td>
                    <td>
                      <div className="bgradeActionCell">
                        <span>{row.nextAction || "최신 Meta URL evidence 확인 후 승급"}</span>
                        <small>{row.whyNotAutoConfirm}</small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bgradeFootnote">
            <span>{fmtNum(visibleRows.length)}개 표시 / 검색 후 {fmtNum(rows.length)}개 / 전체 {fmtNum(proposal.rows.length)}개</span>
            <span>Source: {proposal.source.dictionaryPath ?? "CSV 없음"} · {proposal.source.generatedAtKst ?? "생성 시각 미확인"}</span>
            {proposal.limitations.map((item) => <span key={item}>{item}</span>)}
          </div>
        </>
      )}
    </section>
  );
}

function OriginalLandingBridgePanel({ bridge }: { bridge?: MetaUtmOriginalLandingBridge }) {
  if (!bridge || bridge.status === "not_applicable") return null;
  const gradeRows = bridge.confidenceRollup.filter((row) => row.rows > 0);
  const campaignRows = bridge.campaignRollup.slice(0, 5);
  const targetPath = bridge.source.targetPath ?? "원본 랜딩";

  return (
    <section className="originalBridgePanel">
      <div className="sectionHeader">
        <div>
          <h2>원본 랜딩 bridge</h2>
          <p>
            고객 유입 장부에는 보이지 않지만 결제/체크아웃 원장 안에 남은 최초 랜딩 URL을 읽어,
            랜딩별 Meta 매출 근거가 사라진 것처럼 보이는 문제를 보정해서 보여줍니다. 이 패널의 A 확정 근거는
            `utm_campaign`만이 아니라 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`에 남은 숫자 ID까지 포함합니다.
          </p>
        </div>
        <div className="sectionStats">
          <span>{bridge.status === "loaded" ? "read-only bridge" : "준비 필요"}</span>
          <span>{targetPath}</span>
          <span>{bridge.source.generatedAtKst ?? "생성 시각 미확인"}</span>
        </div>
      </div>

      {bridge.status !== "loaded" ? (
        <div className="emptyState">{bridge.limitations[0] ?? "원본 랜딩 bridge 초안을 아직 읽지 못했습니다."}</div>
      ) : (
        <>
          <div className="originalBridgeNarrative">
            <article>
              <span>고객 유입 장부에서 보이는 값</span>
              <strong>{fmtNum(bridge.ledgerGap.siteLandingExactPathRows ?? 0)}건</strong>
              <small>첫 랜딩 장부만 보면 {targetPath} 유입이 없는 것처럼 보입니다.</small>
            </article>
            <article>
              <span>결제/체크아웃 원장에서 복구한 값</span>
              <strong>{fmtNum(bridge.ledgerGap.originalLandingBridgeRows)}건</strong>
              <small>아임웹 원본 랜딩 URL에 {targetPath}가 남아 있는 row입니다.</small>
            </article>
            <article>
              <span>A 확정 meta_* 숫자 ID</span>
              <strong>{fmtNum(bridge.totals.numericIdRows)}건</strong>
              <small>`utm_campaign`이 비어 있어도 `meta_campaign_id` 계열 숫자가 있으면 광고 계층 매칭 재료입니다.</small>
            </article>
            <article>
              <span>확정 결제 매출</span>
              <strong>{fmtKRW(bridge.totals.confirmedRevenueKrw)}</strong>
              <small>{fmtNum(bridge.totals.confirmedPaymentRows)}건 · 내부 결제완료 원장 기준</small>
            </article>
          </div>

          <div className="originalBridgeDecision">
            <strong>현재 판단</strong>
            <span>
              {targetPath}는 UTM이 없는 광고로 보면 안 됩니다. 원본 랜딩 bridge 기준으로는 대부분 `meta_*` 숫자 ID가 남아 있고,
              숫자로 바뀌지 않은 템플릿 문구 {fmtNum(bridge.totals.templatePhraseRows)}건만 D 미맵핑 수동확인으로 남겨야 합니다.
              최근 날짜 비교상 D 미맵핑은 과거 설정 한 번의 흔적만으로 보기 어렵기 때문에 특정 광고에 임의 배정하지 않습니다.
            </span>
          </div>

          <div className="originalBridgeEvidenceGuide">
            <article>
              <strong>A 확정으로 보는 기준</strong>
              <span>
                주문 또는 원본 랜딩 URL에 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id` 같은 숫자 ID가 남아 있으면
                캠페인·광고세트·광고 단위 매칭 재료로 봅니다.
              </span>
            </article>
            <article>
              <strong>D 미맵핑으로 격리하는 기준</strong>
              <span>
                Meta가 숫자나 실제 placement로 바꿔야 할 템플릿 문구가 그대로 남으면 자동 ROAS 배정에서 제외합니다.
                예: {"{{campaign.id}}"}, {"{{adset.id}}"}, {"{{ad.id}}"}, {"{{placement}}"}.
              </span>
            </article>
            <article>
              <strong>그로스팀 회신 반영 완료</strong>
              <span>
                정정 기준은 사본 붙었던 광고세트=종합대사기능분석(종대사)/acid, 사본 아닌 광고세트=음식물과민증분석(음과검)/Igg입니다.
                D 미맵핑 16건은 숫자 ID가 없으므로 제품 소재별로 자동 배정하지 않습니다.
              </span>
            </article>
          </div>

          <div className="originalBridgeGrid">
            <div className="originalBridgeBlock">
              <h3>등급별 근거</h3>
              <div className="originalBridgeRows">
                {gradeRows.map((row) => (
                  <article key={row.grade}>
                    <div>
                      <strong>{formatBridgeGradeLabel(row.grade)}</strong>
                      <span>{fmtNum(row.rows)}건</span>
                    </div>
                    <p>{row.meaning}</p>
                    <small>결제 {fmtNum(row.confirmedPaymentRows)}건 · {fmtKRW(row.confirmedRevenueKrw)}</small>
                  </article>
                ))}
              </div>
            </div>
            <div className="originalBridgeBlock">
              <h3>숫자 ID rollup</h3>
              <div className="originalBridgeRows">
                {campaignRows.map((row) => (
                  <article key={row.campaignEvidence}>
                    <div>
                      <strong>{row.campaignEvidence}</strong>
                      <span>{fmtNum(row.rows)}건</span>
                    </div>
                    <p>결제 {fmtNum(row.confirmedPaymentRows)}건 · {fmtKRW(row.confirmedRevenueKrw)}</p>
                    <small>
                      term {row.topTerms.map((item) => `${item.value} ${item.rows}건`).join(", ") || "없음"}
                    </small>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="originalBridgeFootnote">
            <span>
              넓은 텍스트 검색 관련 row {fmtNum(bridge.ledgerGap.metadataTextMentions)}건 중
              실제 원본 랜딩 URL로 파싱 가능한 row만 {fmtNum(bridge.ledgerGap.originalLandingBridgeRows)}건으로 사용합니다.
              차이 {fmtNum(bridge.ledgerGap.textMentionsWithoutUsableOriginalUrl)}건은 직접 재료에서 제외합니다.
            </span>
            {bridge.limitations.map((item) => <span key={item}>{item}</span>)}
          </div>
        </>
      )}
    </section>
  );
}

function PeriodRoasCards({
  data,
  loading,
  error,
}: {
  data: PeriodRoasSummaryResponse | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="periodRoasPanel">
      <div className="periodRoasHead">
        <div>
          <h2>기간별 ROAS 기준 비교</h2>
          <p>집계 기간은 KST 완료일 기준이며 오늘은 제외합니다. Meta 기준은 플랫폼이 내려주는 구매 전환값이고, ATT 기준은 내부 attribution 원장에 매칭된 결제완료 매출입니다. 예산 판단은 ATT 기준을 우선합니다.</p>
        </div>
        <div className="periodRoasStatus">
          <strong>{loading ? "조회 중" : data?.cache?.cached ? "캐시 응답" : "라이브/캐시 응답"}</strong>
          <span>{error ?? (data?.cache?.cached_at_kst ? `계산 시각 ${data.cache.cached_at_kst}` : "3일·7일·30일 통합 조회")}</span>
        </div>
      </div>
      <div className="periodRoasGrid">
        {PERIOD_SUMMARY_PRESETS.map((period) => {
          const result = data?.results?.[period.value];
          const summary = result?.summary;
          const meta = summary?.meta ?? {
            spend: summary?.spend ?? 0,
            purchaseValue: summary?.metaPurchaseValue ?? 0,
            roas: summary?.metaPurchaseRoas ?? null,
          };
          const att = summary?.att ?? {
            spend: summary?.spend ?? 0,
            purchaseValue: summary?.attributedRevenue ?? 0,
            roas: summary?.roas ?? null,
            orders: summary?.orders ?? 0,
          };
          const itemError = data?.errors?.[period.value]?.error ?? data?.errors?.[period.value]?.response_message ?? null;
          return (
            <article key={period.value} className="periodRoasCard">
              <div className="periodRoasCardTitle">
                <strong>{period.label}</strong>
                <span>{result?.date_range ? `완료일 기준 ${result.date_range.start_date}~${result.date_range.end_date}` : itemError ? "조회 실패" : "계산 대기"}</span>
              </div>
              <div className="periodSourceRow meta">
                <span>Meta 기준</span>
                <strong>{fmtRoas(meta.roas)}</strong>
                <small>구매전환값 {fmtKRW(meta.purchaseValue)} · 광고비 {fmtKRW(meta.spend)}</small>
              </div>
              <div className="periodSourceRow att">
                <span>ATT 기준</span>
                <strong>{fmtRoas(att.roas)}</strong>
                <small>내부매출 {fmtKRW(att.purchaseValue)} · 광고비 {fmtKRW(att.spend)} · {fmtNum(att.orders)}건</small>
              </div>
              {itemError && <em>{itemError}</em>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UtmCoveragePanel({ data }: { data: MetaUtmDiagnostics | null }) {
  const levelItems = (["campaign", "adset", "ad"] as const).map((item) => ({
    level: item,
    label: LEVEL_LABEL[item],
    rollup: getLevelUtmRollup(data, item),
  }));
  const unmappedLifecycleItems = (["adset", "ad"] as const).map((item) => {
    const rollup = getLevelUtmRollup(data, item);
    const spendingRows = rollup.unmapped.filter((row) => row.metrics.spend > 0);
    return {
      level: item,
      label: item === "adset" ? "D 미맵핑 광고세트" : "D 미맵핑 광고",
      rows: rollup.unmapped,
      spendingRows,
      groups: getLifecycleRows(rollup.unmapped),
    };
  });
  const bridge = data?.originalLandingBridge;
  const dryRun = data?.unmappedDryRun ?? data?.unmapped?.dryRun;
  const dateRange = data?.date_range
    ? `${data.date_range.start_date}~${data.date_range.end_date} ${data.date_range.timezone}`
    : data?.date_preset ?? "조회 전";
  const sourceText = data?.cache?.cached_at_kst
    ? `${data.cache.stale ? "지난 계산값" : "캐시"} ${data.cache.cached_at_kst}`
    : data?.generated_at
      ? `계산 ${formatDateTime(data.generated_at)}`
      : "진단 API 대기";

  return (
    <section className="utmCoveragePanel">
      <div className="utmCoverageHead">
        <div>
          <h2>Meta UTM 설정 상태: A 확정 / B 준확정 / C 후보 / D 미맵핑</h2>
          <p>
            “UTM이 달려 있다”를 단순히 URL 글자 유무로 보지 않고, 주문 매출을 캠페인·광고세트·광고에 붙일 수 있는지로 나눕니다.
            A 확정은 예산 판단 가능, B 준확정은 수동 확인 후 승급 가능, C 후보는 참고만, D 미맵핑은 캠페인 배정 금지입니다.
          </p>
        </div>
        <div className="utmCoverageSource">
          <strong>{dateRange}</strong>
          <span>{sourceText}</span>
          <span>confidence {data?.source_confidence ?? "미확인"}</span>
        </div>
      </div>

      <div className="utmCoverageGrid">
        {levelItems.map(({ level: itemLevel, label, rollup }) => {
          const total = rollup.stats.rows;
          const readyRate = total > 0 ? (rollup.ready.length / total) * 100 : 0;
          const operationalBlockedRows = itemLevel === "adset" ? filterOperationalAdsetRows(rollup.blocked) : rollup.blocked;
          const operationalUnmappedRows = itemLevel === "adset" ? getOperationalUnmappedRows(rollup.unmapped) : rollup.unmapped;
          const attentionRows = operationalBlockedRows.length + operationalUnmappedRows.length;
          const attentionRevenue = summarize([...operationalBlockedRows, ...operationalUnmappedRows]).attRevenue;
          const hiddenNoSpendRows = itemLevel === "adset"
            ? (rollup.blocked.length - operationalBlockedRows.length) + (rollup.unmapped.length - operationalUnmappedRows.length)
            : 0;
          return (
            <article key={itemLevel} className="utmCoverageCard">
              <div className="utmCoverageCardTitle">
                <strong>{label}</strong>
                <span>A 확정 {fmtRatio(readyRate)}</span>
              </div>
              <div className="utmCoverageNumbers">
                <div className="ready">
                  <span>A 확정</span>
                  <strong>{fmtNum(rollup.ready.length)}개</strong>
                  <small>내부매출 {fmtKRW(rollup.readyStats.attRevenue)} · {fmtNum(rollup.readyStats.attOrders)}건</small>
                </div>
                <div className="blocked">
                  <span>B/C 확인</span>
                  <strong>{fmtNum(operationalBlockedRows.length)}개</strong>
                  <small>
                    {hiddenNoSpendRows > 0 && itemLevel === "adset"
                      ? `최근 7일 지출 0원 제외 · B/C 원본 ${fmtNum(rollup.blocked.length)}개`
                      : "B 준확정 70~84% · C 후보 1~69%"}
                  </small>
                </div>
                <div className="unmapped">
                  <span>D 미맵핑</span>
                  <strong>{fmtNum(operationalUnmappedRows.length)}개</strong>
                  <small>
                    {hiddenNoSpendRows > 0
                      ? `확인 대상 · 지출 0원 ${fmtNum(hiddenNoSpendRows)}개 숨김`
                      : "캠페인 배정 금지 · 0%"}
                  </small>
                </div>
              </div>
              <div className="utmCoverageFoot">
                <span>진단 대상 {fmtNum(total)}개 · 광고비 {fmtKRW(rollup.stats.spend)}</span>
                <span>
                  추가 확인 {fmtNum(attentionRows)}개 · 내부매출 {fmtKRW(attentionRevenue)}
                  {hiddenNoSpendRows > 0 ? ` · 지출 0원 B/C/D ${fmtNum(hiddenNoSpendRows)}개 제외` : ""}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="utmEvidenceGrid">
        <article>
          <strong>원본 랜딩 bridge</strong>
          <span>
            {bridge?.status === "loaded"
              ? `${fmtNum(bridge.totals.rowsWithUtm)}건 UTM 복구 · ${fmtNum(bridge.totals.numericIdRows)}건 숫자 ID · ${fmtNum(bridge.totals.templatePhraseRows)}건 D 미맵핑`
              : "결제/체크아웃 원장 원본 랜딩 복구 대기"}
          </span>
          <small>결제완료 매출 {fmtKRW(bridge?.totals.confirmedRevenueKrw)} · ROAS 직접 반영 전 read-only 근거</small>
        </article>
        <article>
          <strong>비Meta 제외 후 남은 D 미맵핑</strong>
          <span>
            {dryRun
              ? `${fmtNum(dryRun.retainedUnmapped.orders)}건 · ${fmtKRW(dryRun.retainedUnmapped.revenue)}`
              : `${fmtNum(data?.unmapped?.orders ?? 0)}건 · ${fmtKRW(data?.unmapped?.revenue ?? 0)}`}
          </span>
          <small>인포크/프로필 링크/비Meta 유입은 Meta 광고 ROAS에서 제외</small>
        </article>
        <article>
          <strong>B 준확정 제안 사전</strong>
          <span>
            {data?.bgradeProposal?.status === "loaded"
              ? `${fmtNum(data.bgradeProposal.stats.proposalRows)}개 제안 · A 확정 금지`
              : "UTM 관리 파일 기반 후보 사전 대기"}
          </span>
          <small>고유 alias가 단일 캠페인으로만 보일 때 검토 후보로 띄웁니다.</small>
        </article>
      </div>

      <div className="utmRoasExplanation">
        <strong>D 미맵핑 row의 ATT ROAS가 0 또는 계산불가로 보이는 이유</strong>
        <span>
          ATT 기준은 내부 결제완료 매출을 특정 캠페인·광고세트·광고 ID에 붙인 값입니다.
          D 미맵핑은 아직 그 연결 근거가 0%라서 Meta 구매값이 있어도 내부 매출을 임의 배정하지 않습니다.
          따라서 로컬이라서 0인 것이 아니라, 안전하게 “아직 광고 구조에 붙이지 않음”으로 둔 상태입니다.
          VM Cloud에 같은 코드만 배포해도 이 값이 자동으로 살아나지는 않고, 숫자 ID/원본 랜딩 bridge를 실제 ROAS 집계에 적용하는 별도 승인 작업이 필요합니다.
        </span>
      </div>

      <AdsetAttentionDetails data={data} />

      <div className="utmLifecyclePanel">
        <div className="utmLifecycleHead">
          <h3>D 미맵핑의 운영 상태 분해</h3>
          <p>
            최근 7일 지출이 0원이면 Meta가 ACTIVE로 보여도 실제 라이브 운영으로 세지 않습니다.
            TJ님이 먼저 확인할 대상은 최근 7일 지출이 있는데 UTM/ID 매칭 근거가 0%인 항목입니다.
          </p>
        </div>
        <div className="utmCheckPriorityGrid">
          {unmappedLifecycleItems.map((item) => {
            const spend = item.spendingRows.reduce((sum, row) => sum + row.metrics.spend, 0);
            const metaValue = item.spendingRows.reduce((sum, row) => sum + row.metrics.purchaseValue, 0);
            return (
              <article key={`${item.level}:priority`}>
                <span>{item.label} 중 TJ님 확인 후보</span>
                <strong>{fmtNum(item.spendingRows.length)}개</strong>
                <small>최근 7일 지출 {fmtKRW(spend)} · Meta 구매값 {fmtKRW(metaValue)}</small>
              </article>
            );
          })}
        </div>
        <div className="utmLifecycleGrid">
          {unmappedLifecycleItems.map((item) => (
            <article key={item.level} className="utmLifecycleCard">
              <div className="utmLifecycleTitle">
                <strong>{item.label}</strong>
                <span>{fmtNum(item.rows.length)}개</span>
              </div>
              <div className="utmLifecycleCounts">
                {(["spending", "issue", "stopped", "no_spend", "other"] as const).map((bucket) => (
                  <div key={bucket} className={bucket}>
                    <span>{LIFECYCLE_LABEL[bucket]}</span>
                    <strong>{fmtNum(item.groups[bucket].length)}개</strong>
                  </div>
                ))}
              </div>
              <div className="utmLifecycleDetails">
                {(["spending", "issue", "stopped", "no_spend", "other"] as const).map((bucket) => {
                  const rows = item.groups[bucket];
                  if (rows.length === 0) return null;
                  const bucketSpend = rows.reduce((sum, row) => sum + row.metrics.spend, 0);
                  const bucketMetaValue = rows.reduce((sum, row) => sum + row.metrics.purchaseValue, 0);
                  return (
                    <details key={bucket} open={bucket === "spending" || bucket === "issue" || bucket === "stopped"}>
                      <summary>
                        {LIFECYCLE_LABEL[bucket]} {fmtNum(rows.length)}개 · 지출 {fmtKRW(bucketSpend)} · Meta 구매값 {fmtKRW(bucketMetaValue)}
                      </summary>
                      <ul>
                        {rows.map((row) => (
                          <li key={row.rowKey}>
                            <strong>{row.name}</strong>
                            <span>{getOperationalDeliveryLabel(row)} · Meta 상태 {row.effectiveStatus || row.status || "상태 미확인"} · 지출 {fmtKRW(row.metrics.spend)} · Meta 구매값 {fmtKRW(row.metrics.purchaseValue)}</span>
                            <small>
                              {row.level === "ad"
                                ? `${row.campaignName} / ${row.adsetName ?? "광고세트 미확인"} · ad_id ${row.adId ?? "없음"}`
                                : `${row.campaignName} · adset_id ${row.adsetId ?? "없음"}`}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function GrowthTeamHandoffPanel({ data }: { data: MetaUtmDiagnostics | null }) {
  const stats = getGrowthHandoffStats(data);
  const sourceTitle = data?.source_confidence ? `Source confidence ${data.source_confidence}` : "Source confidence 미확인";
  const sourceDetail = data?.date_range
    ? `${data.date_range.start_date}~${data.date_range.end_date} KST · ${data.cache?.cached_at_kst ?? formatDateTime(data.generated_at)}`
    : "진단 API 결과를 불러오면 자동 업데이트됩니다.";

  return (
    <section className="growthHandoffPanel">
      <div className="growthHandoffHead">
        <div>
          <h2>그로스팀에 무엇을 왜 확인해 달라고 요청해야 하는가</h2>
          <p>
            지금 문제는 매출이 없는 것이 아니라, 일부 Meta 유입 주문이 어느 캠페인·광고세트·광고에서 왔는지
            확정할 증거가 부족하다는 점입니다. 그로스팀에는 광고를 바로 수정해 달라고 요청하는 것이 아니라,
            현재 광고 소재에 실제로 설정된 URL과 숫자 ID를 확인해 달라고 요청해야 합니다.
          </p>
        </div>
        <div className="growthHandoffSource">
          <strong>{sourceTitle}</strong>
          <span>{sourceDetail}</span>
        </div>
      </div>

      <div className="growthHandoffStats">
        {stats.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>

      <div className="growthNarrativeGrid">
        {GROWTH_CONTEXT_CARDS.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <strong>{item.action}</strong>
          </article>
        ))}
      </div>

      <div className="growthHandoffBody">
        <div className="growthHandoffBlock">
          <h3>그로스팀이 체크리스트에 채워야 하는 값</h3>
          <p>
            아래 값은 광고 화면에서 그대로 복사해야 합니다. 사람이 보는 캠페인명만으로는 후보는 만들 수 있지만,
            예산 판단에 쓸 ROAS로 확정하려면 숫자 ID와 실제 URL evidence가 필요합니다.
          </p>
          <div className="growthFieldList">
            {GROWTH_REQUIRED_FIELDS.map((item) => (
              <article key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </div>
        <div className="growthHandoffBlock">
          <h3>신규 소재나 수정 대상 소재에 넣을 URL Parameters 표준</h3>
          <p>
            아래 형식은 앞으로 새로 만드는 소재나 어차피 수정해야 하는 소재에 적용할 기준입니다.
            `utm_campaign`, `utm_term`, `utm_content`는 Meta가 클릭 시점에 숫자 ID로 바꿔 주는 값이고,
            `campaign_alias`는 사람이 읽고 검토하기 쉬운 고유 별칭입니다.
          </p>
          <code>{RECOMMENDED_META_URL_PARAMS}</code>
          <p>
            중요한 점은 이미 학습이 안정된 광고의 URL을 일괄 수정하지 않는 것입니다.
            현재 소재는 먼저 읽기 전용으로 확인하고, 신규·복제·수정 예정 소재부터 이 형식을 적용합니다.
            `campaign_alias=meta_biocom_광고별칭`처럼 공통 placeholder가 남아 있으면 매핑 근거로 사용할 수 없습니다.
          </p>
        </div>
      </div>

      <div className="growthRankingGuide">
        <strong>매핑 등급을 이렇게 올립니다</strong>
        <span>A 확정은 숫자 campaign/adset/ad ID가 주문이나 실제 클릭 URL에 남은 경우입니다.</span>
        <span>B 준확정은 고유 alias나 그로스팀 제공 ID로 단일 캠페인·세트를 특정할 수 있는 경우입니다.</span>
        <span>C 후보는 랜딩 경로와 이름만으로 후보를 만든 상태라 자동 반영하지 않습니다.</span>
        <span>D 미맵핑은 fbclid only 또는 placeholder만 있는 상태라 수동 확인 없이 ROAS에 붙이지 않습니다.</span>
      </div>

      <div className="growthCaseGrid">
        {GROWTH_PRIORITY_CASES.map((item) => (
          <article key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.grade}</span>
            </div>
            <p>{item.detail}</p>
            <small>다음 요청: {item.action}</small>
          </article>
        ))}
      </div>

      <div className="growthHandoffFooter">
        <strong>전달 파일</strong>
        <span>
          그로스팀에는 `utm/growth-team-meta-url-checklist-20260523.csv`를 채워 달라고 전달합니다.
          근거를 더 보고 싶을 때는 `utm/biocom-utm-meta-api-url-join-20260523.csv`를 함께 확인합니다.
        </span>
      </div>
    </section>
  );
}

function LiveInventoryPanel({
  inventory,
  loading,
  error,
}: {
  inventory: MetaUtmLiveInventory | null;
  loading: boolean;
  error: string | null;
}) {
  const missingCount = inventory?.summary.onAdsWithoutAnyUtmOrMetaParam ?? 0;
  const onAds = inventory?.summary.onAds ?? 0;
  const tracked = inventory?.summary.onAdsWithAnyUtmOrMetaParam ?? 0;
  const ready = inventory && missingCount === 0;
  const title = error
    ? "OFF 제외 live UTM 점검을 아직 읽지 못했습니다"
    : !inventory
      ? "OFF 제외 live UTM 점검을 불러오는 중입니다"
      : ready
        ? "OFF 제외 운용 광고의 UTM 등록은 모두 확인됐습니다"
        : `OFF 제외 운용 광고 ${fmtNum(onAds)}개 중 ${fmtNum(missingCount)}개는 URL evidence가 비어 있습니다`;
  const detail = inventory
    ? `광고 관리자에 저장된 광고 URL/URL Parameters만 읽은 빠른 점검입니다. ROAS/지출 인사이트까지 붙인 전체 진단표와 별도로, 그로스팀 UTM 등록 완료 여부를 먼저 확인합니다.`
    : "전체 ROAS 진단 API가 무거워 stale cache로 떨어져도, 이 카드는 광고 설정값만 읽어 UTM 등록 여부를 빠르게 보여줍니다.";

  return (
    <section className={`liveInventoryPanel ${ready ? "ready" : missingCount > 0 ? "needsCheck" : ""}`}>
      <div className="liveInventoryHead">
        <div>
          <h3>{title}</h3>
          <p>{detail}</p>
        </div>
        <div className="liveInventorySource">
          <strong>{inventory ? formatDateTime(inventory.checked_at) : loading ? "조회 중" : "대기"}</strong>
          <span>{inventory?.cache?.cached ? "5분 캐시" : inventory ? "live read-only" : error ? "조회 실패" : "Meta API 대기"}</span>
        </div>
      </div>

      <div className="liveInventoryStats">
        <article>
          <span>OFF 제외 광고</span>
          <strong>{inventory ? fmtNum(onAds) : "—"}</strong>
          <small>OFF/비활성 제외 {inventory ? fmtNum(inventory.summary.offOrNotActiveAds) : "—"}개</small>
        </article>
        <article>
          <span>UTM/Meta 파라미터 있음</span>
          <strong>{inventory ? fmtNum(tracked) : "—"}</strong>
          <small>숫자 ID 동적 템플릿 {inventory ? fmtNum(inventory.summary.onAdsStandardDynamicTemplate) : "—"}개</small>
        </article>
        <article>
          <span>정적 alias UTM</span>
          <strong>{inventory ? fmtNum(inventory.summary.onAdsStaticAliasTemplate) : "—"}</strong>
          <small>B 준확정 후보 사전 재료</small>
        </article>
        <article>
          <span>URL evidence 없음</span>
          <strong>{inventory ? fmtNum(missingCount) : "—"}</strong>
          <small>{inventory ? `광고세트 ${fmtNum(inventory.summary.adsetsWithOnAdsMissingTracking)}개` : "조회 전"}</small>
        </article>
      </div>

      {error && (
        <div className="liveInventoryNotice">
          <strong>조회 실패</strong>
          <span>{error}</span>
        </div>
      )}

      {inventory && missingCount > 0 && (
        <div className="liveInventoryMissing">
          <div>
            <strong>그로스팀에 확인할 남은 항목</strong>
            <span>
              아래 광고는 Meta API 기준 광고 상태가 ACTIVE인데, 웹사이트 URL/URL Parameters에서 UTM 또는 Meta ID 파라미터를 찾지 못했습니다.
              최근 지출 여부는 전체 진단표의 지출 열과 함께 봐야 합니다.
            </span>
          </div>
          <div className="liveInventoryRows">
            {inventory.missingTrackingAds.map((ad) => (
              <article key={ad.adId}>
                <strong>{ad.adName}</strong>
                <span>{ad.adsetName || "광고세트명 없음"} · {ad.campaignName || ad.campaignId}</span>
                <small>ad_id {ad.adId} · adset_id {ad.adsetId} · 수정 {ad.updatedTime ? formatDateTime(ad.updatedTime) : "미확인"}</small>
                <small>URL Parameters: {ad.urlTags ? truncateMiddle(ad.urlTags, 140) : "없음"} · 랜딩 URL: {ad.sampleUrl ? truncateMiddle(ad.sampleUrl, 140) : "없음"}</small>
              </article>
            ))}
          </div>
        </div>
      )}

      {inventory && inventory.staticAliasAds.length > 0 && (
        <details className="liveInventoryDetails">
          <summary>정적 alias UTM으로 잡힌 운용 광고 {fmtNum(inventory.staticAliasAds.length)}개 보기</summary>
          <div className="liveInventoryRows">
            {inventory.staticAliasAds.map((ad) => (
              <article key={ad.adId}>
                <strong>{ad.adName}</strong>
                <span>{ad.adsetName || "광고세트명 없음"} · {ad.campaignName || ad.campaignId}</span>
                <small>{ad.sampleUrl ? truncateMiddle(ad.sampleUrl, 160) : truncateMiddle(ad.urlTags, 160)}</small>
              </article>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

export default function MetaUtmPage() {
  const [selectedSite, setSelectedSite] = useState<(typeof SITES)[number]>(SITES[0]);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [level, setLevel] = useState<MetaUtmLevel>("campaign");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<MetaUtmDiagnostics | null>(null);
  const [liveInventory, setLiveInventory] = useState<MetaUtmLiveInventory | null>(null);
  const [periodSummary, setPeriodSummary] = useState<PeriodRoasSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);

  const load = useCallback((force = false) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      account_id: selectedSite.account_id,
      date_preset: datePreset,
    });
    if (force) {
      params.set("force", "1");
    } else {
      params.set("prefer_stale", "1");
    }
    fetch(`${API_BASE}/api/ads/meta-utm-diagnostics?${params.toString()}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        return body as MetaUtmDiagnostics;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Meta UTM 진단 조회 실패"))
      .finally(() => setLoading(false));
  }, [datePreset, selectedSite.account_id]);

  const loadLiveInventory = useCallback((force = false) => {
    setInventoryLoading(true);
    setInventoryError(null);
    const params = new URLSearchParams({
      account_id: selectedSite.account_id,
    });
    if (force) params.set("force", "1");
    fetch(`${API_BASE}/api/ads/meta-utm-live-inventory?${params.toString()}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        return body as MetaUtmLiveInventory;
      })
      .then(setLiveInventory)
      .catch((err) => setInventoryError(err instanceof Error ? err.message : "Meta UTM live inventory 조회 실패"))
      .finally(() => setInventoryLoading(false));
  }, [selectedSite.account_id]);

  const loadPeriodSummary = useCallback((force = false) => {
    setPeriodLoading(true);
    setPeriodError(null);
    const params = new URLSearchParams({
      account_id: selectedSite.account_id,
      presets: PERIOD_SUMMARY_PRESETS.map((period) => period.value).join(","),
    });
    if (force) params.set("force", "1");
    fetch(`${API_BASE}/api/ads/roas-summary?${params.toString()}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        return body as PeriodRoasSummaryResponse;
      })
      .then(setPeriodSummary)
      .catch((err) => setPeriodError(err instanceof Error ? err.message : "기간별 ROAS 요약 조회 실패"))
      .finally(() => setPeriodLoading(false));
  }, [selectedSite.account_id]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadLiveInventory(false), 0);
    return () => window.clearTimeout(timer);
  }, [loadLiveInventory]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadPeriodSummary(false), 0);
    return () => window.clearTimeout(timer);
  }, [loadPeriodSummary]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.rows ?? [])
      .filter((row) => row.level === level)
      .filter((row) => {
        if (!normalizedQuery) return true;
        return [
          row.name,
          row.campaignName,
          row.adsetName ?? "",
          row.adName ?? "",
          row.campaignId,
          row.adsetId ?? "",
          row.adId ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      });
  }, [data?.rows, level, query]);
  const readyRows = rows.filter((row) => getRowSection(row) === "ready");
  const blockedRows = rows.filter((row) => getRowSection(row) === "blocked");
  const unmappedRows = rows.filter((row) => getRowSection(row) === "unmapped");
  const visibleBlockedRows = level === "adset" ? filterOperationalAdsetRows(blockedRows) : blockedRows;
  const visibleUnmappedRows = level === "adset" ? filterOperationalAdsetRows(unmappedRows) : unmappedRows;
  const hiddenNoSpendAttentionRows = level === "adset"
    ? (blockedRows.length - visibleBlockedRows.length) + (unmappedRows.length - visibleUnmappedRows.length)
    : 0;
  const levelSummary = data?.summary.byLevel[level] ?? { rows: 0, spend: 0, purchases: 0, attRevenue: 0, attOrders: 0 };
  const attentionSpend = [...visibleBlockedRows, ...visibleUnmappedRows].reduce((sum, row) => sum + row.metrics.spend, 0);
  const blockedSpendShare = levelSummary.spend > 0 ? attentionSpend / levelSummary.spend : 0;
  const errorInfo = error ? describeMetaUtmError(error) : null;
  const cacheStatus = error && !data
    ? "조회 제한"
    : data?.cache?.cached
    ? data.cache.stale
      ? "지난 계산값"
      : "사전계산/캐시 응답"
    : loading && data
      ? "갱신 중"
      : "라이브 조회";
  const currentDecision = error && !data
    ? "현재는 Meta API 제한으로 새 결과를 기다리는 중입니다"
    : blockedSpendShare >= 0.9
    ? "현재 예산 판단은 B/C/D 확인부터 해야 합니다"
    : "A 확정과 D 미맵핑을 나눠 볼 수 있습니다";
  const decisionDetail = error && !data
    ? "실제 광고 데이터가 없다는 뜻은 아니며, 마지막 성공 캐시가 없어 표를 비워 둔 상태입니다"
    : `${LEVEL_LABEL[level]} 기준 B/C/D 확인 지출 ${fmtKRW(attentionSpend)} · 전체 대비 ${fmtRatio(blockedSpendShare * 100)}${hiddenNoSpendAttentionRows > 0 ? ` · 지출 0원 ${fmtNum(hiddenNoSpendAttentionRows)}개 제외` : ""}`;

  return (
    <>
      <GlobalNav />
      <main className="metaUtmPage page">
        <div className="topBar">
          <div>
            <div className="eyebrow">Meta UTM 진단</div>
            <h1>매출을 어느 Meta 광고 구조에 붙일 수 있는지 계층별로 확인합니다</h1>
            <p>
              UTM이 완벽하지 않아도 Meta 숫자 ID, 광고 URL 근거, 내부 결제완료 원장 evidence를 합쳐 85% 이상이면 A 확정으로 봅니다.
              B 준확정, C 후보, D 미맵핑은 따로 모아 확인 우선순위를 정합니다.
            </p>
          </div>
          <div className="actions">
            <Link href="/ads" className="secondaryLink">ROAS 대시보드</Link>
            <Link href="/ads/campaign-mapping" className="secondaryLink">캠페인 매핑</Link>
            <button type="button" onClick={() => { load(true); loadLiveInventory(true); loadPeriodSummary(true); }} disabled={loading || inventoryLoading || periodLoading}>{loading || inventoryLoading || periodLoading ? "조회 중" : "새로고침"}</button>
          </div>
        </div>

        <div className="toolbar">
          <div className="field">
            <label>사이트</label>
            <select value={selectedSite.site} onChange={(event) => {
              const next = SITES.find((site) => site.site === event.target.value) ?? SITES[0];
              setSelectedSite(next);
            }}>
              {SITES.map((site) => <option key={site.site} value={site.site}>{site.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>기간</label>
            <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
              {DATE_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>
          </div>
          <div className="searchField">
            <label>검색</label>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, ID, 지표 검색" />
          </div>
          <div className="metaInfo">
            <span>계정 {selectedSite.account_id}</span>
            <span>기준 {formatDateTime(data?.generated_at)}</span>
            <span>{cacheStatus}</span>
          </div>
        </div>

        <PeriodRoasCards data={periodSummary} loading={periodLoading} error={periodError} />

        <LiveInventoryPanel inventory={liveInventory} loading={inventoryLoading} error={inventoryError} />

        <UtmCoveragePanel data={data} />

        <GrowthTeamHandoffPanel data={data} />

        <OriginalLandingBridgePanel bridge={data?.originalLandingBridge} />

        <BGradeProposalPanel proposal={data?.bgradeProposal} query={query} />

        <div className={`decisionBanner ${error && !data ? "needsFix" : blockedSpendShare >= 0.9 ? "needsFix" : "balanced"}`}>
          <div>
            <strong>{currentDecision}</strong>
            <span>{decisionDetail}</span>
          </div>
          <div>
            <strong>{cacheStatus}</strong>
            <span>{data?.cache?.cached_at_kst ? `계산 시각 ${data.cache.cached_at_kst}` : "첫 조회는 서버 계산 후 캐시에 저장됩니다"}</span>
          </div>
        </div>

        {errorInfo && (
          <div className="errorBox">
            <strong>{errorInfo.title}</strong>
            <span>{errorInfo.message}</span>
            <small>{errorInfo.action}</small>
            <details>
              <summary>기술 원문 보기</summary>
              <code>{errorInfo.technical}</code>
            </details>
          </div>
        )}

        <div className="summaryGrid">
          <div className="summaryItem">
            <span>현재 보는 계층</span>
            <strong>{LEVEL_LABEL[level]}</strong>
            <small>{fmtNum(levelSummary.rows)}행 · Meta raw {level === "campaign" ? fmtNum(data?.summary.rawCounts.campaignInsights ?? 0) : level === "adset" ? fmtNum(data?.summary.rawCounts.adsetInsights ?? 0) : fmtNum(data?.summary.rawCounts.adInsights ?? 0)}행</small>
          </div>
          <div className="summaryItem">
            <span>해당 계층 지출</span>
            <strong>{fmtKRW(levelSummary.spend)}</strong>
            <small>Meta Ads Insights API 기준</small>
          </div>
          <div className="summaryItem">
            <span>A 확정 지출</span>
            <strong>{fmtKRW(readyRows.reduce((sum, row) => sum + row.metrics.spend, 0))}</strong>
            <small>{fmtNum(readyRows.length)}행 · 예산 판단 가능</small>
          </div>
          <div className="summaryItem">
            <span>B/C/D 확인 지출</span>
            <strong>{fmtKRW(attentionSpend)}</strong>
            <small>비중 {fmtRatio(blockedSpendShare * 100)}{hiddenNoSpendAttentionRows > 0 ? ` · 지출 0원 ${fmtNum(hiddenNoSpendAttentionRows)}개 숨김` : ""}</small>
          </div>
          <div className="summaryItem">
            <span>내부 ATT 매출</span>
            <strong>{fmtKRW(levelSummary.attRevenue)}</strong>
            <small>{fmtNum(levelSummary.attOrders)}건 · source confidence {data?.source_confidence ?? "미확인"}</small>
          </div>
          <div className="summaryItem">
            <span>D 미맵핑 주문</span>
            <strong>{fmtNum(data?.unmapped?.orders ?? 0)}건</strong>
            <small>{fmtKRW(data?.unmapped?.revenue ?? 0)} · campaign 확정 실패</small>
          </div>
        </div>

        <div className="levelTabs">
          {(["campaign", "adset", "ad"] as const).map((item) => (
            <button key={item} type="button" className={level === item ? "active" : ""} onClick={() => setLevel(item)}>
              {LEVEL_LABEL[item]}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="loadingBox">Meta 캠페인, 광고 세트, 광고와 내부 attribution 원장을 읽는 중입니다.</div>
        ) : error && !data ? (
          <div className="loadingBox">조회 제한으로 아직 표를 채우지 못했습니다. 사전계산 캐시가 준비되면 A/B/C/D 등급이 자동으로 표시됩니다.</div>
        ) : (
          <>
            <SectionPanel title="A 확정 · 매칭율 85% 이상, ROAS 산정 가능" tone="ready" rows={readyRows} level={level} levelSpend={levelSummary.spend} />
            <SectionPanel title="B 준확정 / C 후보 · 1~84%, 확인 후 판단" tone="blocked" rows={visibleBlockedRows} level={level} levelSpend={levelSummary.spend} />
            <SectionPanel title="D 미맵핑 · ROAS 배정 금지" tone="unmapped" rows={visibleUnmappedRows} level={level} levelSpend={levelSummary.spend} />
            <DryRunExclusionPanel summary={data?.unmappedDryRun ?? data?.unmapped?.dryRun} />
            <UnmappedOrdersPanel summary={data?.unmapped} />
          </>
        )}

        <div className="notes">
          <strong>판단 기준</strong>
          <p>
            매칭율은 내부 주문 ID evidence와 광고 URL의 campaign/adset/ad ID 또는 dynamic macro를 합쳐 계산합니다.
            85% 이상이면 A 확정, 70~84%는 B 준확정, 1~69%는 C 후보, 0%는 D 미맵핑으로 분리합니다.
            캠페인 단위 ROAS는 기존 내부 attribution 계산과 같고, 광고세트/광고 단위 ROAS는 주문 원장에 해당 ID가 남은 경우 정확도가 높습니다.
            상세 표의 구매 전환 금액은 내부 attribution 원장에 해당 광고 구조로 매칭된 결제완료 매출입니다.
            Meta 원본 랜딩 bridge에서는 `utm_campaign`이 비어 있어도 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`가 숫자로 남으면 A 확정 근거로 봅니다.
            상단 Meta 기준 구매전환값은 Meta Ads Insights의 action_values[purchase]라 최근 Meta 데이터 제한 영향으로 낮거나 비어 있을 수 있습니다.
          </p>
          {data?.diagnostics?.limitations?.map((item) => <span key={item}>{item}</span>)}
          <span>Source: Meta Ads Insights API + VM Cloud attribution ledger. Window: {data?.date_range ? `${data.date_range.start_date}~${data.date_range.end_date} KST` : datePreset}. Freshness: {data?.source_max_timestamp ?? "Meta live/cache 기준"}. Confidence: {data?.source_confidence ?? "API 응답 기준"}.</span>
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f4f6f8;
          color: #1f2937;
          padding: 96px 18px 36px;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .topBar, .toolbar, .periodRoasPanel, .liveInventoryPanel, .utmCoveragePanel, .summaryGrid, .levelTabs, .sectionPanel, .unmappedOrdersPanel, .originalBridgePanel, .notes, .errorBox, .loadingBox {
          max-width: 1760px;
          margin-left: auto;
          margin-right: auto;
        }
        .topBar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 14px;
        }
        .eyebrow {
          color: #2563eb;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0;
          margin-bottom: 6px;
        }
        h1 {
          margin: 0;
          color: #111827;
          font-size: 1.42rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 0.86rem;
          line-height: 1.65;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .actions button, .secondaryLink {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          border-radius: 6px;
          padding: 9px 12px;
          font-size: 0.78rem;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }
        .actions button {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
        }
        .actions button:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .toolbar {
          display: grid;
          grid-template-columns: 180px 160px minmax(220px, 1fr) auto;
          gap: 10px;
          align-items: end;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .field, .searchField {
          display: grid;
          gap: 4px;
        }
        label {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 900;
        }
        select, input {
          height: 36px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #111827;
          padding: 0 10px;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .metaInfo {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
          color: #64748b;
          font-size: 0.72rem;
          white-space: nowrap;
        }
        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }
        .summaryItem {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 13px 14px;
          display: grid;
          gap: 5px;
        }
        .summaryItem span {
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 900;
        }
        .summaryItem strong {
          color: #111827;
          font-size: 1.08rem;
          font-variant-numeric: tabular-nums;
        }
        .summaryItem small {
          color: #94a3b8;
          font-size: 0.68rem;
          font-weight: 700;
        }
        .levelTabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          background: #e9eef5;
          border: 1px solid #d8e0ea;
          border-radius: 8px 8px 0 0;
          overflow: hidden;
        }
        .levelTabs button {
          height: 42px;
          border: 0;
          border-right: 1px solid #d8e0ea;
          background: #eef2f7;
          color: #475569;
          font-size: 0.86rem;
          font-weight: 900;
          cursor: pointer;
        }
        .levelTabs button:last-child {
          border-right: 0;
        }
        .levelTabs button.active {
          background: #fff;
          color: #2563eb;
        }
        .sectionPanel {
          background: #fff;
          border: 1px solid #d8e0ea;
          border-top: 0;
          padding: 14px;
          margin-bottom: 14px;
        }
        .sectionPanel.ready {
          border-left: 4px solid #059669;
        }
        .sectionPanel.blocked {
          border-left: 4px solid #f97316;
        }
        .sectionPanel.unmapped {
          border-left: 4px solid #64748b;
        }
        .sectionHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 12px;
        }
        h2 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          letter-spacing: 0;
        }
        .sectionHeader p {
          font-size: 0.76rem;
          margin-top: 4px;
        }
        .sectionStats {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .sectionStats span {
          padding: 5px 8px;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .tableWrap {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        table {
          width: 100%;
          min-width: 1540px;
          border-collapse: collapse;
          font-size: 0.76rem;
        }
        th {
          position: sticky;
          top: 0;
          background: #f8fafc;
          color: #334155;
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid #d8e0ea;
          font-size: 0.68rem;
          font-weight: 900;
          white-space: nowrap;
        }
        td {
          padding: 7px 10px;
          border-bottom: 1px solid #edf2f7;
          color: #334155;
          vertical-align: middle;
          font-variant-numeric: tabular-nums;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        tr:last-child td {
          border-bottom: 0;
        }
        .nameCol {
          width: 360px;
          min-width: 360px;
        }
        .nameCell {
          display: grid;
          gap: 9px;
          align-items: center;
          grid-template-columns: minmax(0, 1fr);
        }
        .nameCell.withThumb {
          grid-template-columns: auto minmax(0, 1fr);
        }
        .thumbBox {
          width: 42px;
          height: 42px;
          border-radius: 4px;
          overflow: hidden;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 0.56rem;
          text-align: center;
        }
        .thumbBox img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .nameText {
          min-width: 0;
          display: grid;
          gap: 2px;
        }
        .nameText strong {
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.78rem;
        }
        .nameText span, .nameText small, .metricSub, .idStack span {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nameText small {
          color: #9a3412;
        }
        .statusPill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid;
          border-radius: 999px;
          padding: 4px 8px;
          white-space: nowrap;
          font-size: 0.68rem;
          font-weight: 900;
        }
        .statusDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .matchRateCell {
          display: grid;
          gap: 4px;
          min-width: 92px;
        }
        .matchRateCell span {
          display: inline-flex;
          width: fit-content;
          border: 1px solid;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 0.68rem;
          font-weight: 1000;
        }
        .matchRateCell small {
          color: #64748b;
          font-size: 0.62rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .matchBar {
          width: 76px;
          height: 5px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .matchBar i {
          display: block;
          height: 100%;
          border-radius: inherit;
        }
        .idStack {
          display: grid;
          gap: 2px;
          max-width: 190px;
        }
        .idStack strong, .monoValue {
          color: #111827;
          font-size: 0.68rem;
          font-weight: 900;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .metricMain {
          color: #111827;
          font-weight: 900;
          white-space: nowrap;
        }
        .roasOk, .roasBlocked {
          font-weight: 1000;
          white-space: nowrap;
        }
        .roasOk {
          color: #047857;
        }
        .roasBlocked {
          color: #94a3b8;
        }
        .emptyState, .loadingBox, .errorBox {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 6px;
          padding: 26px 18px;
          color: #64748b;
          font-size: 0.84rem;
          text-align: center;
          font-weight: 800;
        }
        .errorBox {
          display: grid;
          gap: 5px;
          margin-bottom: 12px;
          text-align: left;
          background: #fff7ed;
          border-color: #fed7aa;
          color: #9a3412;
        }
        .errorBox small {
          color: #7c2d12;
          font-size: 0.74rem;
          line-height: 1.55;
        }
        .errorBox details {
          margin-top: 3px;
          color: #9a3412;
          font-size: 0.7rem;
        }
        .errorBox summary {
          cursor: pointer;
          font-weight: 900;
        }
        .errorBox code {
          display: block;
          margin-top: 6px;
          white-space: pre-wrap;
          word-break: break-word;
          color: #7c2d12;
        }
        .notes {
          display: grid;
          gap: 7px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
        }
        .notes strong {
          color: #111827;
          font-size: 0.82rem;
        }
        .notes p, .notes span {
          margin: 0;
          color: #64748b;
          font-size: 0.74rem;
          line-height: 1.6;
        }
        .unmappedOrdersPanel {
          background: #fff;
          border: 1px solid #d8e0ea;
          border-left: 4px solid #64748b;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .unmappedList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .unmappedItem {
          display: grid;
          gap: 3px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 9px 10px;
        }
        .unmappedItem strong {
          color: #111827;
          font-size: 0.84rem;
        }
        .unmappedItem span, .unmappedItem small {
          color: #64748b;
          font-size: 0.68rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .unmappedItem em {
          color: #9a3412;
          font-size: 0.66rem;
          font-style: normal;
          font-weight: 800;
        }
        @media (max-width: 980px) {
          .topBar, .toolbar, .periodRoasHead, .summaryGrid, .sectionHeader {
            grid-template-columns: 1fr;
          }
          .actions, .metaInfo, .periodRoasStatus, .sectionStats {
            justify-content: flex-start;
            align-items: flex-start;
            text-align: left;
          }
          .periodRoasGrid, .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .page {
            padding-left: 10px;
            padding-right: 10px;
          }
          .periodRoasGrid, .summaryGrid {
            grid-template-columns: 1fr;
          }
          .levelTabs {
            grid-template-columns: 1fr;
            border-radius: 8px;
          }
          .levelTabs button {
            border-right: 0;
            border-bottom: 1px solid #d8e0ea;
          }
          .unmappedList {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <style jsx global>{`
        .metaUtmPage .decisionBanner {
          max-width: 1760px;
          margin: 0 auto 12px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          border: 1px solid #d8e0ea;
          border-radius: 8px;
          background: #ffffff;
          padding: 12px 14px;
        }
        .metaUtmPage .decisionBanner.needsFix {
          border-color: #fed7aa;
          background: #fffaf3;
        }
        .metaUtmPage .decisionBanner.balanced {
          border-color: #bbf7d0;
          background: #f7fef9;
        }
        .metaUtmPage .decisionBanner div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .metaUtmPage .decisionBanner div:last-child {
          text-align: right;
        }
        .metaUtmPage .decisionBanner strong {
          color: #111827;
          font-size: 0.86rem;
          line-height: 1.35;
        }
        .metaUtmPage .decisionBanner span {
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 700;
          line-height: 1.45;
        }
        .metaUtmPage .periodRoasPanel {
          max-width: 1760px;
          margin: 0 auto 12px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .periodRoasHead {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
          margin-bottom: 12px;
        }
        .metaUtmPage .periodRoasHead h2 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .periodRoasHead p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.76rem;
          line-height: 1.55;
        }
        .metaUtmPage .periodRoasStatus {
          display: grid;
          gap: 3px;
          text-align: right;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .metaUtmPage .periodRoasStatus strong {
          color: #111827;
          font-size: 0.8rem;
        }
        .metaUtmPage .periodRoasGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .metaUtmPage .periodRoasCard {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 11px;
          display: grid;
          gap: 8px;
        }
        .metaUtmPage .periodRoasCardTitle {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
        }
        .metaUtmPage .periodRoasCardTitle strong {
          color: #111827;
          font-size: 0.84rem;
        }
        .metaUtmPage .periodRoasCardTitle span {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          text-align: right;
        }
        .metaUtmPage .periodSourceRow {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #fff;
          padding: 8px;
          display: grid;
          grid-template-columns: auto auto;
          gap: 3px 8px;
          align-items: baseline;
        }
        .metaUtmPage .periodSourceRow span {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .metaUtmPage .periodSourceRow strong {
          justify-self: end;
          color: #111827;
          font-size: 1rem;
          font-variant-numeric: tabular-nums;
        }
        .metaUtmPage .periodSourceRow small {
          grid-column: 1 / -1;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 700;
          line-height: 1.45;
        }
        .metaUtmPage .periodSourceRow.meta strong {
          color: #475569;
        }
        .metaUtmPage .periodSourceRow.att {
          border-color: #bbf7d0;
          background: #f7fef9;
        }
        .metaUtmPage .periodSourceRow.att strong {
          color: #047857;
        }
        .metaUtmPage .periodRoasCard em {
          color: #9a3412;
          font-size: 0.66rem;
          font-style: normal;
          font-weight: 800;
        }
        .metaUtmPage .utmCoveragePanel {
          max-width: 1760px;
          margin: 0 auto 12px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-left: 4px solid #0f766e;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .utmCoverageHead {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
          margin-bottom: 12px;
        }
        .metaUtmPage .utmCoverageHead h2 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .utmCoverageHead p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.76rem;
          line-height: 1.55;
        }
        .metaUtmPage .utmCoverageSource {
          display: grid;
          gap: 3px;
          text-align: right;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .metaUtmPage .utmCoverageSource strong {
          color: #111827;
          font-size: 0.8rem;
        }
        .metaUtmPage .utmCoverageGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .utmCoverageCard,
        .metaUtmPage .utmEvidenceGrid article {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 11px;
          display: grid;
          gap: 9px;
          align-content: start;
        }
        .metaUtmPage .utmCoverageCardTitle {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
        }
        .metaUtmPage .utmCoverageCardTitle strong,
        .metaUtmPage .utmEvidenceGrid strong {
          color: #111827;
          font-size: 0.82rem;
          line-height: 1.35;
        }
        .metaUtmPage .utmCoverageCardTitle span {
          border: 1px solid #bbf7d0;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          padding: 3px 7px;
          font-size: 0.66rem;
          font-weight: 900;
          white-space: nowrap;
        }
        .metaUtmPage .utmCoverageNumbers {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
        }
        .metaUtmPage .utmCoverageNumbers div {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
          padding: 8px;
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .metaUtmPage .utmCoverageNumbers span {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 900;
        }
        .metaUtmPage .utmCoverageNumbers strong {
          color: #111827;
          font-size: 0.92rem;
          line-height: 1.25;
          font-variant-numeric: tabular-nums;
        }
        .metaUtmPage .utmCoverageNumbers small {
          color: #64748b;
          font-size: 0.62rem;
          line-height: 1.4;
          font-weight: 700;
        }
        .metaUtmPage .utmCoverageNumbers .ready {
          border-color: #bbf7d0;
          background: #f7fef9;
        }
        .metaUtmPage .utmCoverageNumbers .ready strong {
          color: #047857;
        }
        .metaUtmPage .utmCoverageNumbers .blocked {
          border-color: #fed7aa;
          background: #fff7ed;
        }
        .metaUtmPage .utmCoverageNumbers .blocked strong {
          color: #c2410c;
        }
        .metaUtmPage .utmCoverageNumbers .unmapped strong {
          color: #64748b;
        }
        .metaUtmPage .utmCoverageFoot {
          display: grid;
          gap: 3px;
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 800;
          line-height: 1.45;
        }
        .metaUtmPage .liveInventoryPanel {
          margin-top: 12px;
          margin-bottom: 12px;
          border: 1px solid #dbe4ef;
          border-radius: 8px;
          background: #ffffff;
          padding: 14px;
          display: grid;
          gap: 12px;
        }
        .metaUtmPage .liveInventoryPanel.ready {
          border-color: #bbf7d0;
          background: #f6fef9;
        }
        .metaUtmPage .liveInventoryPanel.needsCheck {
          border-color: #fed7aa;
          background: #fffaf3;
        }
        .metaUtmPage .liveInventoryHead {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: start;
        }
        .metaUtmPage .liveInventoryHead h3 {
          margin: 0;
          color: #111827;
          font-size: 0.94rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .liveInventoryHead p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 0.74rem;
          line-height: 1.55;
          font-weight: 800;
        }
        .metaUtmPage .liveInventorySource {
          display: grid;
          gap: 3px;
          justify-items: end;
          color: #64748b;
          font-size: 0.68rem;
          line-height: 1.35;
          font-weight: 800;
        }
        .metaUtmPage .liveInventorySource strong {
          color: #111827;
          font-size: 0.78rem;
        }
        .metaUtmPage .liveInventoryStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .metaUtmPage .liveInventoryStats article,
        .metaUtmPage .liveInventoryRows article {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.84);
          padding: 10px;
          display: grid;
          gap: 4px;
        }
        .metaUtmPage .liveInventoryStats span,
        .metaUtmPage .liveInventoryRows span,
        .metaUtmPage .liveInventoryMissing span,
        .metaUtmPage .liveInventoryNotice span {
          color: #64748b;
          font-size: 0.7rem;
          line-height: 1.45;
          font-weight: 800;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .liveInventoryStats strong {
          color: #111827;
          font-size: 1rem;
          line-height: 1.25;
        }
        .metaUtmPage .liveInventoryStats small,
        .metaUtmPage .liveInventoryRows small {
          color: #64748b;
          font-size: 0.66rem;
          line-height: 1.45;
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .liveInventoryMissing,
        .metaUtmPage .liveInventoryNotice {
          border: 1px solid #fed7aa;
          border-radius: 8px;
          background: #fff7ed;
          padding: 10px;
          display: grid;
          gap: 9px;
        }
        .metaUtmPage .liveInventoryMissing strong,
        .metaUtmPage .liveInventoryNotice strong,
        .metaUtmPage .liveInventoryRows strong {
          color: #111827;
          font-size: 0.76rem;
          line-height: 1.35;
        }
        .metaUtmPage .liveInventoryRows {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .metaUtmPage .liveInventoryDetails {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 9px 10px;
        }
        .metaUtmPage .liveInventoryDetails summary {
          cursor: pointer;
          color: #334155;
          font-size: 0.72rem;
          font-weight: 900;
        }
        .metaUtmPage .liveInventoryDetails .liveInventoryRows {
          margin-top: 8px;
        }
        .metaUtmPage .utmEvidenceGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .metaUtmPage .utmEvidenceGrid article {
          background: #ffffff;
          gap: 5px;
        }
        .metaUtmPage .utmEvidenceGrid span {
          color: #334155;
          font-size: 0.74rem;
          line-height: 1.45;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .utmEvidenceGrid small {
          color: #64748b;
          font-size: 0.66rem;
          line-height: 1.45;
          font-weight: 700;
        }
        .metaUtmPage .utmRoasExplanation {
          display: grid;
          gap: 4px;
          margin-top: 10px;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          background: #fff7ed;
          padding: 10px 11px;
        }
        .metaUtmPage .utmRoasExplanation strong {
          color: #9a3412;
          font-size: 0.76rem;
          line-height: 1.35;
        }
        .metaUtmPage .utmRoasExplanation span {
          color: #7c2d12;
          font-size: 0.7rem;
          font-weight: 800;
          line-height: 1.55;
        }
        .metaUtmPage .adsetAttentionPanel {
          margin-top: 10px;
          border: 1px solid #dbe4ef;
          border-radius: 8px;
          background: #fbfdff;
          padding: 12px;
          display: grid;
          gap: 12px;
        }
        .metaUtmPage .adsetAttentionHead {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
        }
        .metaUtmPage .adsetAttentionHead h3 {
          margin: 0;
          color: #111827;
          font-size: 0.88rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .adsetAttentionHead p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 800;
          line-height: 1.55;
        }
        .metaUtmPage .adsetAttentionHead > div:last-child {
          display: grid;
          gap: 4px;
          text-align: right;
        }
        .metaUtmPage .adsetAttentionHead strong {
          color: #111827;
          font-size: 0.82rem;
          line-height: 1.35;
        }
        .metaUtmPage .adsetAttentionHead span {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.45;
        }
        .metaUtmPage .adsetAttentionGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
        }
        .metaUtmPage .adsetAttentionColumn {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
          display: grid;
          gap: 8px;
          align-content: start;
          min-width: 0;
        }
        .metaUtmPage .adsetAttentionColumn.unmapped {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .metaUtmPage .adsetAttentionColumn.blocked {
          border-color: #fed7aa;
          background: #fffaf3;
        }
        .metaUtmPage .adsetAttentionColumnTitle {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 7px;
        }
        .metaUtmPage .adsetAttentionColumnTitle strong {
          color: #111827;
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .metaUtmPage .adsetAttentionColumnTitle span {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 900;
          text-align: right;
          line-height: 1.35;
        }
        .metaUtmPage .adsetEvidenceCard {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .metaUtmPage .adsetEvidenceCard.unmapped {
          border-color: #cbd5e1;
        }
        .metaUtmPage .adsetEvidenceCard.blocked {
          border-color: #fed7aa;
        }
        .metaUtmPage .adsetAttentionEmpty {
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          padding: 12px;
          display: grid;
          gap: 5px;
        }
        .metaUtmPage .adsetAttentionEmpty strong {
          color: #334155;
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .metaUtmPage .adsetAttentionEmpty span {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.5;
        }
        .metaUtmPage .adsetEvidenceTop {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: start;
        }
        .metaUtmPage .adsetEvidenceTop div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .metaUtmPage .adsetEvidenceTop strong {
          color: #111827;
          font-size: 0.78rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .adsetEvidenceTop span {
          color: #64748b;
          font-size: 0.64rem;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .adsetEvidenceTop b {
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          padding: 3px 7px;
          font-size: 0.64rem;
          white-space: nowrap;
        }
        .metaUtmPage .adsetEvidenceCard.blocked .adsetEvidenceTop b {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #c2410c;
        }
        .metaUtmPage .adsetEvidenceCard p {
          margin: 0;
          color: #334155;
          font-size: 0.68rem;
          font-weight: 900;
          line-height: 1.5;
        }
        .metaUtmPage .adsetEvidenceMeta,
        .metaUtmPage .adsetRawEvidence {
          display: grid;
          gap: 3px;
          color: #64748b;
          font-size: 0.62rem;
          font-weight: 800;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .adsetEvidenceMeta code,
        .metaUtmPage .adsetRawEvidence code {
          color: #334155;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 1px 4px;
          font-size: 0.6rem;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .evidenceFlagGrid {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .metaUtmPage .evidenceFlag {
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          background: #f8fafc;
          color: #64748b;
          padding: 3px 7px;
          font-size: 0.6rem;
          font-weight: 900;
          line-height: 1.25;
        }
        .metaUtmPage .evidenceFlag.ok {
          border-color: #bbf7d0;
          background: #ecfdf5;
          color: #047857;
        }
        .metaUtmPage .evidenceFlag.missing {
          border-color: #e2e8f0;
          background: #f8fafc;
          color: #64748b;
        }
        .metaUtmPage .utmLifecyclePanel {
          margin-top: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 12px;
        }
        .metaUtmPage .utmLifecycleHead {
          display: grid;
          gap: 4px;
          margin-bottom: 10px;
        }
        .metaUtmPage .utmLifecycleHead h3 {
          margin: 0;
          color: #111827;
          font-size: 0.86rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .utmLifecycleHead p {
          margin: 0;
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 800;
          line-height: 1.55;
        }
        .metaUtmPage .utmCheckPriorityGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .utmCheckPriorityGrid article {
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          background: #eff6ff;
          padding: 10px 11px;
          display: grid;
          gap: 4px;
        }
        .metaUtmPage .utmCheckPriorityGrid span {
          color: #1e3a8a;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .metaUtmPage .utmCheckPriorityGrid strong {
          color: #1d4ed8;
          font-size: 1rem;
          font-variant-numeric: tabular-nums;
        }
        .metaUtmPage .utmCheckPriorityGrid small {
          color: #334155;
          font-size: 0.66rem;
          font-weight: 800;
          line-height: 1.45;
        }
        .metaUtmPage .utmLifecycleGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .metaUtmPage .utmLifecycleCard {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
          display: grid;
          gap: 9px;
          min-width: 0;
        }
        .metaUtmPage .utmLifecycleTitle {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
        }
        .metaUtmPage .utmLifecycleTitle strong {
          color: #111827;
          font-size: 0.78rem;
        }
        .metaUtmPage .utmLifecycleTitle span {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .metaUtmPage .utmLifecycleCounts {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 6px;
        }
        .metaUtmPage .utmLifecycleCounts div {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
          padding: 7px;
          display: grid;
          gap: 2px;
        }
        .metaUtmPage .utmLifecycleCounts span {
          color: #64748b;
          font-size: 0.62rem;
          font-weight: 900;
          line-height: 1.25;
        }
        .metaUtmPage .utmLifecycleCounts strong {
          color: #111827;
          font-size: 0.82rem;
          line-height: 1.25;
        }
        .metaUtmPage .utmLifecycleCounts .spending {
          border-color: #bbf7d0;
          background: #f7fef9;
        }
        .metaUtmPage .utmLifecycleCounts .spending strong {
          color: #047857;
        }
        .metaUtmPage .utmLifecycleCounts .issue {
          border-color: #fecaca;
          background: #fff5f5;
        }
        .metaUtmPage .utmLifecycleCounts .issue strong {
          color: #b91c1c;
        }
        .metaUtmPage .utmLifecycleCounts .stopped strong {
          color: #64748b;
        }
        .metaUtmPage .utmLifecycleCounts .no_spend strong {
          color: #94a3b8;
        }
        .metaUtmPage .utmLifecycleDetails {
          display: grid;
          gap: 7px;
          max-height: 430px;
          overflow: auto;
          padding-right: 2px;
        }
        .metaUtmPage .utmLifecycleDetails details {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
          padding: 7px 8px;
        }
        .metaUtmPage .utmLifecycleDetails summary {
          cursor: pointer;
          color: #334155;
          font-size: 0.68rem;
          font-weight: 900;
          line-height: 1.45;
        }
        .metaUtmPage .utmLifecycleDetails ul {
          margin: 7px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }
        .metaUtmPage .utmLifecycleDetails li {
          display: grid;
          gap: 2px;
          border-top: 1px solid #edf2f7;
          padding-top: 6px;
        }
        .metaUtmPage .utmLifecycleDetails li:first-child {
          border-top: 0;
          padding-top: 0;
        }
        .metaUtmPage .utmLifecycleDetails li strong {
          color: #111827;
          font-size: 0.68rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .utmLifecycleDetails li span,
        .metaUtmPage .utmLifecycleDetails li small {
          color: #64748b;
          font-size: 0.62rem;
          line-height: 1.4;
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .growthHandoffPanel {
          max-width: 1760px;
          margin: 0 auto 12px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-left: 4px solid #2563eb;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .growthHandoffHead {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
          margin-bottom: 12px;
        }
        .metaUtmPage .growthHandoffHead h2,
        .metaUtmPage .growthNarrativeGrid h3,
        .metaUtmPage .growthHandoffBlock h3 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .growthHandoffHead p,
        .metaUtmPage .growthNarrativeGrid p,
        .metaUtmPage .growthHandoffBlock p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.76rem;
          line-height: 1.55;
        }
        .metaUtmPage .growthHandoffSource {
          display: grid;
          gap: 3px;
          text-align: right;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .metaUtmPage .growthHandoffSource strong {
          color: #111827;
          font-size: 0.8rem;
        }
        .metaUtmPage .growthHandoffStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .growthHandoffStats article {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 11px;
          display: grid;
          gap: 4px;
        }
        .metaUtmPage .growthHandoffStats span {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .metaUtmPage .growthHandoffStats strong {
          color: #111827;
          font-size: 1.02rem;
          font-variant-numeric: tabular-nums;
        }
        .metaUtmPage .growthHandoffStats small {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 700;
          line-height: 1.4;
        }
        .metaUtmPage .growthNarrativeGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .growthNarrativeGrid article {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 12px;
          display: grid;
          gap: 7px;
          align-content: start;
        }
        .metaUtmPage .growthNarrativeGrid strong {
          color: #9a3412;
          font-size: 0.72rem;
          line-height: 1.5;
        }
        .metaUtmPage .growthHandoffBody {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .growthHandoffBlock {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 12px;
        }
        .metaUtmPage .growthFieldList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .metaUtmPage .growthFieldList article {
          border: 1px solid #edf2f7;
          border-radius: 6px;
          background: #f8fafc;
          padding: 8px 9px;
          display: grid;
          gap: 4px;
        }
        .metaUtmPage .growthFieldList strong {
          color: #111827;
          font-size: 0.7rem;
          line-height: 1.35;
        }
        .metaUtmPage .growthFieldList span {
          color: #64748b;
          font-size: 0.66rem;
          line-height: 1.5;
        }
        .metaUtmPage .growthHandoffBlock ul {
          margin: 8px 0 0;
          padding-left: 18px;
          color: #334155;
          font-size: 0.74rem;
          font-weight: 800;
          line-height: 1.75;
        }
        .metaUtmPage .growthHandoffBlock code {
          display: block;
          margin-top: 8px;
          padding: 9px 10px;
          border: 1px solid #dbeafe;
          border-radius: 6px;
          background: #eff6ff;
          color: #1e3a8a;
          font-size: 0.68rem;
          line-height: 1.55;
          white-space: normal;
          overflow-wrap: anywhere;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .metaUtmPage .growthRankingGuide {
          display: grid;
          grid-template-columns: auto repeat(4, minmax(0, 1fr));
          gap: 7px;
          align-items: stretch;
          margin-bottom: 10px;
        }
        .metaUtmPage .growthRankingGuide strong,
        .metaUtmPage .growthRankingGuide span {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 9px;
          line-height: 1.45;
        }
        .metaUtmPage .growthRankingGuide strong {
          background: #111827;
          color: #ffffff;
          font-size: 0.72rem;
          display: flex;
          align-items: center;
        }
        .metaUtmPage .growthRankingGuide span {
          background: #f8fafc;
          color: #475569;
          font-size: 0.66rem;
          font-weight: 800;
        }
        .metaUtmPage .growthCaseGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .metaUtmPage .growthCaseGrid article {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
          display: grid;
          gap: 6px;
          align-content: start;
        }
        .metaUtmPage .growthCaseGrid article div {
          display: grid;
          gap: 2px;
        }
        .metaUtmPage .growthCaseGrid strong {
          color: #111827;
          font-size: 0.78rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .growthCaseGrid span {
          width: fit-content;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 3px 7px;
          font-size: 0.66rem;
          font-weight: 900;
          line-height: 1.35;
        }
        .metaUtmPage .growthCaseGrid p {
          margin: 0;
          color: #475569;
          font-size: 0.7rem;
          line-height: 1.6;
        }
        .metaUtmPage .growthCaseGrid small {
          color: #9a3412;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.55;
        }
        .metaUtmPage .growthHandoffFooter {
          display: grid;
          gap: 4px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 8px 10px;
        }
        .metaUtmPage .growthHandoffFooter strong {
          color: #111827;
          font-size: 0.72rem;
        }
        .metaUtmPage .growthHandoffFooter span {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 800;
          overflow-wrap: anywhere;
          line-height: 1.5;
        }
        .metaUtmPage .originalBridgePanel {
          max-width: 1760px;
          margin: 0 auto 14px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-left: 4px solid #0891b2;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .originalBridgeNarrative {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .originalBridgeNarrative article,
        .metaUtmPage .originalBridgeRows article {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 11px;
          display: grid;
          gap: 5px;
          align-content: start;
        }
        .metaUtmPage .originalBridgeNarrative span,
        .metaUtmPage .originalBridgeRows span {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .metaUtmPage .originalBridgeNarrative strong {
          color: #0f172a;
          font-size: 1.05rem;
          line-height: 1.35;
          font-variant-numeric: tabular-nums;
        }
        .metaUtmPage .originalBridgeNarrative small,
        .metaUtmPage .originalBridgeRows small {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 700;
          line-height: 1.45;
        }
        .metaUtmPage .originalBridgeDecision {
          display: grid;
          gap: 4px;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          background: #f0f9ff;
          padding: 11px 12px;
          margin-bottom: 10px;
        }
        .metaUtmPage .originalBridgeDecision strong {
          color: #0c4a6e;
          font-size: 0.8rem;
        }
        .metaUtmPage .originalBridgeDecision span {
          color: #155e75;
          font-size: 0.74rem;
          font-weight: 800;
          line-height: 1.55;
        }
        .metaUtmPage .originalBridgeEvidenceGuide {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .originalBridgeEvidenceGuide article {
          border: 1px solid #e0f2fe;
          border-radius: 8px;
          background: #f8fbff;
          padding: 10px 11px;
          display: grid;
          gap: 5px;
          align-content: start;
        }
        .metaUtmPage .originalBridgeEvidenceGuide strong {
          color: #0f172a;
          font-size: 0.76rem;
          line-height: 1.35;
        }
        .metaUtmPage .originalBridgeEvidenceGuide span {
          color: #475569;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .originalBridgeGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .originalBridgeBlock {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 12px;
        }
        .metaUtmPage .originalBridgeBlock h3 {
          margin: 0 0 8px;
          color: #111827;
          font-size: 0.82rem;
        }
        .metaUtmPage .originalBridgeRows {
          display: grid;
          gap: 8px;
        }
        .metaUtmPage .originalBridgeRows article div {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
        }
        .metaUtmPage .originalBridgeRows strong {
          color: #111827;
          font-size: 0.76rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .originalBridgeRows p {
          margin: 0;
          color: #475569;
          font-size: 0.7rem;
          line-height: 1.5;
        }
        .metaUtmPage .originalBridgeFootnote {
          display: grid;
          gap: 4px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 8px 10px;
        }
        .metaUtmPage .originalBridgeFootnote span {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.5;
        }
        .metaUtmPage .dryRunPanel,
        .metaUtmPage .bgradePanel {
          max-width: 1760px;
          margin: 0 auto 14px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .dryRunPanel {
          border-left: 4px solid #0f766e;
        }
        .metaUtmPage .bgradePanel {
          border-left: 4px solid #7c3aed;
        }
        .metaUtmPage .dryRunImpactGrid,
        .metaUtmPage .bgradeStatsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metaUtmPage .bgradeStatsGrid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        .metaUtmPage .dryRunImpactGrid article,
        .metaUtmPage .bgradeStatsGrid article {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 11px;
          display: grid;
          gap: 5px;
          align-content: start;
        }
        .metaUtmPage .dryRunImpactGrid span,
        .metaUtmPage .bgradeStatsGrid span {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .metaUtmPage .dryRunImpactGrid strong,
        .metaUtmPage .bgradeStatsGrid strong {
          color: #111827;
          font-size: 0.92rem;
          line-height: 1.35;
          font-variant-numeric: tabular-nums;
        }
        .metaUtmPage .dryRunImpactGrid small,
        .metaUtmPage .bgradeStatsGrid small {
          color: #64748b;
          font-size: 0.66rem;
          line-height: 1.45;
          font-weight: 700;
        }
        .metaUtmPage .dryRunBucketGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .metaUtmPage .dryRunBucket {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
          display: grid;
          gap: 6px;
        }
        .metaUtmPage .dryRunBucket.yes {
          border-color: #bbf7d0;
          background: #f7fef9;
        }
        .metaUtmPage .dryRunBucket.review {
          border-color: #fed7aa;
          background: #fff7ed;
        }
        .metaUtmPage .dryRunBucket.no {
          border-color: #e2e8f0;
          background: #f8fafc;
        }
        .metaUtmPage .dryRunBucket div {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
        }
        .metaUtmPage .dryRunBucket strong {
          color: #111827;
          font-size: 0.76rem;
          line-height: 1.35;
        }
        .metaUtmPage .dryRunBucket span {
          color: #0f766e;
          font-size: 0.64rem;
          font-weight: 900;
          white-space: nowrap;
        }
        .metaUtmPage .dryRunBucket.review span {
          color: #c2410c;
        }
        .metaUtmPage .dryRunBucket.no span {
          color: #64748b;
        }
        .metaUtmPage .dryRunBucket p {
          margin: 0;
          color: #475569;
          font-size: 0.68rem;
          line-height: 1.55;
        }
        .metaUtmPage .dryRunBucket small {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 800;
        }
        .metaUtmPage .dryRunSampleList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .metaUtmPage .dryRunSampleList article {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
          padding: 9px 10px;
          display: grid;
          gap: 5px;
        }
        .metaUtmPage .dryRunSampleList div {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
        }
        .metaUtmPage .dryRunSampleList strong {
          color: #111827;
          font-size: 0.82rem;
        }
        .metaUtmPage .dryRunSampleList span {
          color: #0f766e;
          font-size: 0.66rem;
          font-weight: 900;
        }
        .metaUtmPage .dryRunSampleList p {
          margin: 0;
          color: #475569;
          font-size: 0.7rem;
          line-height: 1.5;
        }
        .metaUtmPage .dryRunSampleList small {
          color: #64748b;
          font-size: 0.66rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .dryRunFootnote,
        .metaUtmPage .bgradeFootnote,
        .metaUtmPage .bgradeRuleBox {
          display: grid;
          gap: 4px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 8px 10px;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .bgradeRuleBox {
          margin-bottom: 10px;
          background: #f5f3ff;
          border-color: #ddd6fe;
        }
        .metaUtmPage .bgradeRuleBox strong {
          color: #4c1d95;
          font-size: 0.74rem;
        }
        .metaUtmPage .bgradeTableWrap {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          margin-bottom: 10px;
        }
        .metaUtmPage .bgradeTableWrap table {
          min-width: 1280px;
        }
        .metaUtmPage .aliasCol {
          width: 260px;
          min-width: 260px;
        }
        .metaUtmPage .bgradeAliasCell,
        .metaUtmPage .bgradeCampaignCell,
        .metaUtmPage .bgradeActionCell {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .metaUtmPage .bgradeAliasCell strong,
        .metaUtmPage .bgradeCampaignCell strong {
          color: #111827;
          font-size: 0.74rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .bgradeAliasCell small,
        .metaUtmPage .bgradeCampaignCell small,
        .metaUtmPage .bgradeActionCell small {
          color: #64748b;
          font-size: 0.64rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .bgradeStatus {
          display: inline-flex;
          width: fit-content;
          border: 1px solid #ddd6fe;
          border-radius: 999px;
          background: #f5f3ff;
          color: #6d28d9;
          padding: 4px 8px;
          font-size: 0.66rem;
          font-weight: 900;
          white-space: nowrap;
        }
        .metaUtmPage .bgradeActionCell span {
          color: #475569;
          font-size: 0.68rem;
          line-height: 1.45;
          font-weight: 800;
        }
        .metaUtmPage .sectionPanel {
          max-width: 1760px;
          margin: 0 auto 14px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-top: 0;
          padding: 14px;
        }
        .metaUtmPage .sectionPanel.ready {
          border-left: 4px solid #059669;
        }
        .metaUtmPage .sectionPanel.blocked {
          border-left: 4px solid #f97316;
        }
        .metaUtmPage .sectionPanel.unmapped {
          border-left: 4px solid #64748b;
        }
        .metaUtmPage .sectionHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 12px;
        }
        .metaUtmPage .sectionHeader h2 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .sectionHeader p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.76rem;
          line-height: 1.55;
        }
        .metaUtmPage .sectionStats {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .metaUtmPage .sectionStats span {
          padding: 5px 8px;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .metaUtmPage .tableWrap {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
        }
        .metaUtmPage table {
          width: 100%;
          min-width: 1600px;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 0.74rem;
        }
        .metaUtmPage th,
        .metaUtmPage td {
          border-bottom: 1px solid #edf2f7;
          text-align: left;
          vertical-align: middle;
        }
        .metaUtmPage th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #f8fafc;
          color: #334155;
          padding: 8px 10px;
          font-size: 0.68rem;
          font-weight: 900;
          line-height: 1.25;
          white-space: nowrap;
        }
        .metaUtmPage td {
          padding: 7px 10px;
          color: #334155;
          font-variant-numeric: tabular-nums;
          line-height: 1.35;
        }
        .metaUtmPage tr:nth-child(even) td {
          background: #f8fafc;
        }
        .metaUtmPage tr:last-child td {
          border-bottom: 0;
        }
        .metaUtmPage .nameCol {
          width: 390px;
          min-width: 390px;
        }
        .metaUtmPage th:nth-child(2),
        .metaUtmPage td:nth-child(2) {
          width: 112px;
        }
        .metaUtmPage th:nth-child(3),
        .metaUtmPage td:nth-child(3) {
          width: 112px;
        }
        .metaUtmPage th:nth-child(4),
        .metaUtmPage td:nth-child(4) {
          width: 190px;
        }
        .metaUtmPage th:nth-child(5),
        .metaUtmPage td:nth-child(5),
        .metaUtmPage th:nth-child(6),
        .metaUtmPage td:nth-child(6),
        .metaUtmPage th:nth-child(7),
        .metaUtmPage td:nth-child(7),
        .metaUtmPage th:nth-child(12),
        .metaUtmPage td:nth-child(12) {
          width: 116px;
        }
        .metaUtmPage th:nth-child(8),
        .metaUtmPage td:nth-child(8),
        .metaUtmPage th:nth-child(9),
        .metaUtmPage td:nth-child(9),
        .metaUtmPage th:nth-child(10),
        .metaUtmPage td:nth-child(10),
        .metaUtmPage th:nth-child(11),
        .metaUtmPage td:nth-child(11) {
          width: 92px;
        }
        .metaUtmPage .nameCell {
          display: grid;
          gap: 9px;
          align-items: center;
          grid-template-columns: minmax(0, 1fr);
        }
        .metaUtmPage .nameCell.withThumb {
          grid-template-columns: auto minmax(0, 1fr);
        }
        .metaUtmPage .thumbBox {
          width: 42px;
          height: 42px;
          border-radius: 4px;
          overflow: hidden;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 0.56rem;
          text-align: center;
        }
        .metaUtmPage .thumbBox img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .metaUtmPage .nameText {
          min-width: 0;
          display: grid;
          gap: 2px;
        }
        .metaUtmPage .nameText strong {
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.78rem;
        }
        .metaUtmPage .nameText span,
        .metaUtmPage .nameText small,
        .metaUtmPage .metricSub,
        .metaUtmPage .idStack span {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .metaUtmPage .nameText small {
          color: #9a3412;
        }
        .metaUtmPage .statusPill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid;
          border-radius: 999px;
          padding: 4px 8px;
          white-space: nowrap;
          font-size: 0.68rem;
          font-weight: 900;
        }
        .metaUtmPage .statusDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .metaUtmPage .matchRateCell {
          display: grid;
          gap: 4px;
          min-width: 92px;
        }
        .metaUtmPage .matchRateCell span {
          display: inline-flex;
          width: fit-content;
          border: 1px solid;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 0.68rem;
          font-weight: 1000;
        }
        .metaUtmPage .matchRateCell small {
          color: #64748b;
          font-size: 0.62rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .metaUtmPage .matchBar {
          width: 76px;
          height: 5px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .metaUtmPage .matchBar i {
          display: block;
          height: 100%;
          border-radius: inherit;
        }
        .metaUtmPage .idStack {
          display: grid;
          gap: 2px;
          max-width: 180px;
        }
        .metaUtmPage .idStack strong,
        .metaUtmPage .monoValue {
          display: block;
          color: #111827;
          font-size: 0.68rem;
          font-weight: 900;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .metaUtmPage .metricMain,
        .metaUtmPage .roasOk,
        .metaUtmPage .roasBlocked {
          color: #111827;
          font-weight: 900;
          white-space: nowrap;
        }
        .metaUtmPage .roasOk {
          color: #047857;
        }
        .metaUtmPage .roasBlocked {
          color: #94a3b8;
        }
        .metaUtmPage .emptyState,
        .metaUtmPage .loadingBox {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 6px;
          padding: 26px 18px;
          color: #64748b;
          font-size: 0.84rem;
          text-align: center;
          font-weight: 800;
        }
        .metaUtmPage .unmappedOrdersPanel {
          max-width: 1760px;
          margin: 0 auto 14px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-left: 4px solid #64748b;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .unmappedList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .metaUtmPage .unmappedItem {
          display: grid;
          gap: 3px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 9px 10px;
        }
        .metaUtmPage .unmappedItem strong {
          color: #111827;
          font-size: 0.84rem;
        }
        .metaUtmPage .unmappedItem span,
        .metaUtmPage .unmappedItem small {
          color: #64748b;
          font-size: 0.68rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .unmappedItem em {
          color: #9a3412;
          font-size: 0.66rem;
          font-style: normal;
          font-weight: 800;
        }
        @media (max-width: 980px) {
          .metaUtmPage .decisionBanner,
          .metaUtmPage .periodRoasHead,
          .metaUtmPage .liveInventoryHead,
          .metaUtmPage .liveInventoryStats,
          .metaUtmPage .liveInventoryRows,
          .metaUtmPage .utmCoverageHead,
          .metaUtmPage .utmCoverageGrid,
          .metaUtmPage .utmEvidenceGrid,
          .metaUtmPage .adsetAttentionHead,
          .metaUtmPage .adsetAttentionGrid,
          .metaUtmPage .utmLifecycleGrid,
          .metaUtmPage .growthHandoffHead,
          .metaUtmPage .growthNarrativeGrid,
          .metaUtmPage .growthHandoffBody,
          .metaUtmPage .growthRankingGuide,
          .metaUtmPage .originalBridgeEvidenceGuide,
          .metaUtmPage .originalBridgeGrid,
          .metaUtmPage .dryRunImpactGrid,
          .metaUtmPage .dryRunBucketGrid,
          .metaUtmPage .bgradeStatsGrid,
          .metaUtmPage .sectionHeader {
            grid-template-columns: 1fr;
          }
          .metaUtmPage .decisionBanner div:last-child,
          .metaUtmPage .periodRoasStatus,
          .metaUtmPage .utmCoverageSource,
          .metaUtmPage .adsetAttentionHead > div:last-child,
          .metaUtmPage .growthHandoffSource,
          .metaUtmPage .sectionStats {
            text-align: left;
            justify-content: flex-start;
          }
          .metaUtmPage .periodRoasGrid,
          .metaUtmPage .growthHandoffStats,
          .metaUtmPage .utmCoverageNumbers,
          .metaUtmPage .utmLifecycleCounts,
          .metaUtmPage .utmCheckPriorityGrid,
          .metaUtmPage .growthFieldList,
          .metaUtmPage .growthCaseGrid,
          .metaUtmPage .originalBridgeNarrative,
          .metaUtmPage .dryRunSampleList {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .metaUtmPage .unmappedList {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .metaUtmPage .periodRoasGrid,
          .metaUtmPage .growthHandoffStats,
          .metaUtmPage .utmCoverageNumbers,
          .metaUtmPage .utmLifecycleCounts,
          .metaUtmPage .utmCheckPriorityGrid,
          .metaUtmPage .growthFieldList,
          .metaUtmPage .growthCaseGrid,
          .metaUtmPage .originalBridgeNarrative,
          .metaUtmPage .dryRunSampleList {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
