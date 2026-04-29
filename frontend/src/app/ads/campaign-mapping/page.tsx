"use client";

/* eslint-disable react/no-unescaped-entities */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import GlobalNav from "@/components/common/GlobalNav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type AliasReviewCandidate = {
  campaignId: string;
  campaignName: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  activeAdsets: number;
  activeAds: number;
  landingUrlExamples: string[];
  adsetSamples: string[];
  adSamples: string[];
  selected: boolean;
  rejected: boolean;
};

type AliasReviewItem = {
  aliasKey: string;
  site: string;
  status: string;
  confidence: string;
  familyHint: string;
  reviewReason: string;
  validFrom: string | null;
  validTo: string | null;
  reviewedAt: string | null;
  selectedCampaignId: string | null;
  selectedCampaignName: string | null;
  rejectedCampaignIds: string[];
  evidence: {
    confirmedOrders: number;
    confirmedRevenue: number;
    pendingOrders: number;
    pendingRevenue: number;
    canceledOrders: number;
    canceledRevenue: number;
    totalOrders: number;
    totalRevenue: number;
  };
  candidates: AliasReviewCandidate[];
};

type AliasReviewResponse = {
  ok: boolean;
  site: string;
  generated_at: string;
  summary: {
    totalAliases: number;
    pendingReview: number;
    manualVerified: number;
    rejectedAll: number;
  };
  items: AliasReviewItem[];
  error?: string;
};

type CandidateScore = {
  score: number;
  label: string;
  color: string;
  bg: string;
  reasons: string[];
};

const fmtKRW = (value: number) => `₩${Math.round(value).toLocaleString("ko-KR")}`;
const fmtNum = (value: number) => value.toLocaleString("ko-KR");

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const summarizeAliasReviewItems = (items: AliasReviewItem[]) => ({
  totalAliases: items.length,
  pendingReview: items.filter((item) => item.status === "needs_manual_review").length,
  manualVerified: items.filter((item) => item.status === "manual_verified").length,
  rejectedAll: items.filter((item) => item.status === "rejected_all_candidates").length,
});

const evidenceLadder = [
  {
    rank: "1",
    title: "주문에 campaign id가 직접 있음",
    strength: "가장 강함",
    body: "주문에 Meta campaign id가 직접 남으면 사람이 만든 추적 이름보다 우선합니다.",
  },
  {
    rank: "2",
    title: "주문에 adset id가 있음",
    strength: "강함",
    body: "주문에 adset id가 남아 있고 Meta evidence에서 부모 campaign을 찾을 수 있으면 캠페인 매핑이 가능합니다.",
  },
  {
    rank: "3",
    title: "광고 URL에 내부 추적 이름이 직접 있음",
    strength: "강함",
    body: "광고 URL 또는 URL 파라미터에 같은 내부 추적 이름이 있으면 해당 광고의 campaign으로 매핑합니다.",
  },
  {
    rank: "4",
    title: "광고명, 상품군, 랜딩이 비슷함",
    strength: "보조 증거",
    body: "직접 ID가 없을 때만 보조로 봅니다. 상품군이 맞아도 특정 캠페인 성과로 바로 붙이면 위험합니다.",
  },
  {
    rank: "5",
    title: "상품만 맞음",
    strength: "약함",
    body: "IGG 상품을 샀다는 사실은 상품군 분류에는 좋지만 Meta 캠페인 귀속 증거로는 부족합니다.",
  },
];

const proposals = [
  {
    aliasKey: "meta_biocom_cellcleanerreel_igg",
    displayName: "cellcleanerreel로 들어온 음식물 과민증 검사 주문",
    trackingDescription: "광고 링크에 붙어 주문 원장에 남은 내부 추적값입니다. 사람에게 보이는 캠페인명이 아니라, 시스템이 유입을 구분하려고 저장한 별명입니다.",
    verdict: "캠페인 매핑",
    target: "120213362391690396",
    targetName: "[바이오컴] 음식물 과민증 검사 전환캠페인(10/14~)",
    confidence: 93,
    impact: "4건 / 1,060,200원",
    tone: "strong",
    plainSummary: "이 내부 추적값은 이름만 보면 건강기능식품처럼 보일 수 있지만, 실제 주문에 남은 adset id가 음식물 과민증 캠페인 하위로 연결됩니다.",
    proof: [
      "확정 주문 4건 모두 utm_term 값이 120213362391830396입니다.",
      "Meta URL evidence에서 이 adset id는 120213362391690396 캠페인의 하위입니다.",
      "랜딩도 4건 모두 IGG 상품 페이지라 음식물 과민증 흐름과 맞습니다.",
      "현재 ads 페이지 후보에 뜨는 건강기능식품/공동구매 후보는 직접 adset 증거보다 약합니다.",
    ],
    nextAction: "2026-04-28 기준 음식물 과민증 검사 전환캠페인으로 임시 분류했습니다. TJ님이 추후 한 번 더 컨펌하면 최종 운영 확정으로 봅니다.",
  },
  {
    aliasKey: "inpork_biocom_igg",
    displayName: "인포크 또는 외부 인플루언서 경유로 보이는 음식물 과민증 주문",
    trackingDescription: "이 값도 주문 원장에 남은 내부 추적값입니다. 다만 Meta 광고 ID가 같이 남아 있지 않아 특정 Meta 캠페인 매출로 붙이면 위험합니다.",
    verdict: "Meta 캠페인 미매핑",
    target: "non_meta_influencer_igg",
    targetName: "비Meta 또는 외부 인플루언서 IGG 유입",
    confidence: 88,
    impact: "7건 / 1,969,500원",
    tone: "caution",
    plainSummary: "상품과 랜딩은 IGG가 맞지만, Meta campaign/adset id가 없습니다. 캠페인 ROAS에 억지로 붙이면 정확도가 떨어집니다.",
    proof: [
      "확정 주문 7건 모두 IGG 상품 페이지 랜딩이고 음식물 과민증 상품입니다.",
      "하지만 내부 추적값이 meta로 시작하지 않고 adset id도 비어 있습니다.",
      "현재 후보 campaign이 0개라 Meta campaign 귀속 근거가 없습니다.",
      "상품군 분석에는 IGG로 쓰되, Meta 캠페인 ROAS에는 넣지 않는 편이 안전합니다.",
    ],
    nextAction: "Meta 추적 이름 seed에 억지 매핑하지 말고 non-meta IGG 또는 quarantine bucket으로 분리합니다.",
  },
];

const workflowSteps = [
  {
    title: "1. 주문에 남은 식별자부터 본다",
    body: "주문 원장에 campaign id나 adset id가 있으면 그 값이 가장 강한 증거입니다. 광고명이나 상품명 추정보다 우선합니다.",
  },
  {
    title: "2. Meta evidence로 부모 캠페인을 찾는다",
    body: "adset id가 있으면 Meta evidence 파일에서 부모 campaign id를 찾습니다. 이 단계가 닫히면 사람이 눈으로 찍는 작업이 줄어듭니다.",
  },
  {
    title: "3. 매핑하면 ROAS에 들어가고, 제외하면 별도 bucket으로 간다",
    body: "yes는 해당 캠페인 매출로 들어갑니다. no 또는 비Meta 분리는 캠페인 ROAS를 부풀리지 않기 위한 안전장치입니다.",
  },
  {
    title: "4. 반영 후 총액 중복을 확인한다",
    body: "매핑 후에는 캠페인별 attributed revenue 합계와 사이트 confirmed revenue가 맞는지 확인해야 합니다.",
  },
];

const rootFixSummary = [
  {
    title: "광고 URL에 ID를 심는다",
    result: "신규 유입 1차 해결",
    body: "utm_campaign 이름만 쓰지 말고 Meta campaign id, adset id, ad id를 같이 붙입니다. 이름은 바뀔 수 있지만 숫자 ID는 매핑 키로 안정적입니다.",
  },
  {
    title: "랜딩에서 주문까지 보존한다",
    result: "체크아웃 유실 방지",
    body: "랜딩 URL에 들어온 값은 첫 방문 쿠키, 세션, 결제 완료 이벤트, 내부 주문 원장까지 복사되어야 합니다. URL에만 있으면 PG나 재방문에서 끊깁니다.",
  },
  {
    title: "모르면 보내지 않는다",
    result: "ROAS 과대계상 방지",
    body: "campaign id 또는 adset id로 확인되지 않는 주문은 Meta 캠페인 매출로 억지 귀속하지 않고 quarantine이나 non-meta bucket으로 분리합니다.",
  },
];

const trackingTemplateRows = [
  {
    key: "utm_source",
    value: "meta",
    reason: "GA4와 내부 원장에서 Meta 유입을 고정 식별합니다.",
  },
  {
    key: "utm_medium",
    value: "paid_social",
    reason: "유료 소셜 채널을 organic social, referral과 분리합니다.",
  },
  {
    key: "utm_campaign",
    value: "{{campaign.id}}",
    reason: "사람이 읽는 캠페인명 대신 안정적인 campaign id를 1차 매핑 키로 씁니다.",
  },
  {
    key: "utm_term",
    value: "{{adset.id}}",
    reason: "campaign id가 빠져도 adset의 부모 캠페인을 찾아 복구할 수 있습니다.",
  },
  {
    key: "utm_content",
    value: "{{ad.id}}",
    reason: "같은 캠페인 안에서 어떤 소재가 만든 주문인지 분해할 수 있습니다.",
  },
  {
    key: "campaign_alias",
    value: "meta_biocom_igg_202604",
    reason: "사람이 운영 중 빠르게 읽기 위한 별칭입니다. 단, 숫자 ID보다 우선하면 안 됩니다.",
  },
  {
    key: "meta_campaign_id",
    value: "{{campaign.id}}",
    reason: "GA4 표준 UTM이 바뀌어도 내부 매핑용 원본 ID를 별도 보존합니다.",
  },
  {
    key: "meta_adset_id",
    value: "{{adset.id}}",
    reason: "현재 cellcleanerreel 같은 케이스를 자동 복구하는 핵심 키입니다.",
  },
  {
    key: "meta_ad_id",
    value: "{{ad.id}}",
    reason: "소재 단위 소재명 변경, 복제 광고, A/B 테스트를 추적합니다.",
  },
];

const rootFixStages = [
  {
    period: "1일",
    title: "활성 광고 URL 파라미터 표준화",
    body: "모든 신규/활성 Meta 광고의 URL Parameters 필드에 위 템플릿을 넣습니다. 적용 전 광고관리자 미리보기에서 {{campaign.id}} 치환 여부를 확인합니다.",
  },
  {
    period: "3일",
    title: "아임웹 헤더/푸터 수집 보강",
    body: "랜딩 시 utm, fbclid, fbc, fbp, meta_* 값을 first touch와 latest touch로 저장하고 checkout_started와 payment_success에 같이 싣습니다.",
  },
  {
    period: "1주",
    title: "백엔드 매핑 우선순위 고정",
    body: "meta_campaign_id 직접값, meta_adset_id의 부모 캠페인, campaign_alias seed, quarantine 순서로만 귀속합니다. 상품명 추정은 ROAS 귀속 근거에서 제외합니다.",
  },
  {
    period: "상시",
    title: "광고 API 감사와 누락 알림",
    body: "활성 광고 중 필수 파라미터가 빠진 소재를 매일 점검하고 이 페이지에 누락률을 표시합니다. 수동 yes/no는 과거 주문 처리용으로만 남깁니다.",
  },
];

const rootFixFailureModes = [
  "랜딩 URL에 UTM이 있어도 결제 페이지로 이동하면서 query string이 사라질 수 있습니다.",
  "가상계좌, PG, 네이버페이, 재방문 구매는 최초 광고 클릭 정보가 결제 완료 URL에 없을 수 있습니다.",
  "캠페인명 기반 UTM은 캠페인 복제나 이름 변경 뒤에 사람이 해석하기 어려워집니다.",
  "광고 소재별 URL 설정이 섞이면 같은 campaign_alias가 여러 campaign id로 퍼질 수 있습니다.",
];

const getCandidateScore = (item: AliasReviewItem, candidate: AliasReviewCandidate): CandidateScore => {
  const reasons: string[] = [];
  let score = 30;

  const aliasInUrl = candidate.landingUrlExamples.some((url) => url.includes(item.aliasKey));
  if (aliasInUrl) {
    reasons.push("광고 랜딩 URL에 이 내부 추적 이름이 직접 들어 있습니다.");
    score += 30;
  } else if (candidate.landingUrlExamples.length > 0) {
    reasons.push("캠페인 안에 UTM이 설정된 랜딩 URL이 있습니다.");
    score += 15;
  } else {
    reasons.push("URL 직접 증거는 아직 없습니다.");
  }

  const nonRejected = item.candidates.filter((row) => !row.rejected);
  if (nonRejected.length === 1 && !candidate.rejected) {
    reasons.push("거절되지 않은 후보가 이 캠페인 하나뿐입니다.");
    score += 20;
  }

  if (candidate.activeAds > 0) {
    reasons.push(`현재 활성 광고 ${candidate.activeAds}개가 있습니다.`);
    score += 10;
  } else {
    reasons.push("현재 활성 광고가 없어 과거 캠페인일 수 있습니다.");
    score -= 10;
  }

  const totalSpend = item.candidates.reduce((sum, row) => sum + row.spend, 0);
  if (totalSpend > 0 && candidate.spend > 0) {
    const spendShare = candidate.spend / totalSpend;
    if (spendShare > 0.8) {
      reasons.push(`후보 중 집행비 비중이 ${Math.round(spendShare * 100)}%로 압도적입니다.`);
      score += 15;
    } else if (spendShare > 0.5) {
      reasons.push(`후보 중 집행비 비중이 ${Math.round(spendShare * 100)}%로 가장 큽니다.`);
      score += 5;
    }
  }

  const aliasKeyword = item.aliasKey
    .replace(/^meta_biocom_/, "")
    .replace(/^inpork_biocom_/, "")
    .replace(/_igg$/, "")
    .toLowerCase();
  const adNameMatch = candidate.adSamples.some((ad) => ad.toLowerCase().includes(aliasKeyword));
  if (adNameMatch) {
    reasons.push("광고명에 내부 추적 이름의 핵심 단어가 들어 있습니다.");
    score += 15;
  }

  const boundedScore = Math.min(95, Math.max(10, score));
  if (boundedScore >= 80) return { score: boundedScore, label: "높음", color: "#047857", bg: "#d1fae5", reasons };
  if (boundedScore >= 60) return { score: boundedScore, label: "보통", color: "#b45309", bg: "#fef3c7", reasons };
  return { score: boundedScore, label: "낮음", color: "#b91c1c", bg: "#fee2e2", reasons };
};

const getStatusLabel = (status: string) => {
  if (status === "needs_manual_review") return "검토 필요";
  if (status === "manual_verified") return "확정";
  if (status === "rejected_all_candidates") return "전부 제외";
  return status;
};

const getConfidenceLabel = (confidence: string) => {
  if (confidence === "auto_url_match") return "URL 자동 매칭";
  if (confidence === "auto_spend_heuristic") return "집행비 기반 자동";
  if (confidence === "manual_verified") return "수동 확정";
  return confidence || "-";
};

const getReadableTrackingName = (aliasKey: string) => {
  if (aliasKey === "meta_biocom_cellcleanerreel_igg") return "cellcleanerreel로 들어온 음식물 과민증 검사 주문";
  if (aliasKey === "inpork_biocom_igg") return "인포크 또는 외부 인플루언서 경유로 보이는 음식물 과민증 주문";
  return "아직 사람이 읽는 이름이 없는 내부 추적값";
};

export default function CampaignMappingPage() {
  const [review, setReview] = useState<AliasReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAlias, setExpandedAlias] = useState<string | null>("meta_biocom_cellcleanerreel_igg");
  const [showResolved, setShowResolved] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ads/campaign-alias-review?site=biocom`, { cache: "no-store" });
      const data = await response.json() as AliasReviewResponse;
      if (!data.ok) {
        setReview(null);
        setError(data.error ?? "campaign alias review API 응답이 올바르지 않습니다.");
        return;
      }
      setReview(data);
    } catch {
      setReview(null);
      setError("campaign alias review API를 불러오지 못했습니다. 백엔드 7020 상태를 확인해야 합니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const handleDecision = async (aliasKey: string, campaignId: string, decision: "yes" | "no") => {
    const actionKey = `${aliasKey}:${campaignId}:${decision}`;
    setActionLoading(actionKey);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ads/campaign-alias-review/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: "biocom",
          aliasKey,
          campaignId,
          decision,
        }),
      });
      const data = await response.json() as { ok: boolean; item?: AliasReviewItem; error?: string };
      if (!data.ok || !data.item) {
        setError(data.error ?? "결정 저장에 실패했습니다.");
        return;
      }
      setReview((current) => {
        if (!current) return current;
        const items = current.items
          .map((item) => item.aliasKey === data.item!.aliasKey ? data.item! : item)
          .sort((a, b) => (
            Number(a.status !== "needs_manual_review") - Number(b.status !== "needs_manual_review")
            || b.evidence.confirmedRevenue - a.evidence.confirmedRevenue
            || a.aliasKey.localeCompare(b.aliasKey)
          ));
        return { ...current, summary: summarizeAliasReviewItems(items), items };
      });
    } catch {
      setError("결정 저장 요청이 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingItems = (review?.items ?? []).filter((item) => item.status === "needs_manual_review");
  const resolvedItems = (review?.items ?? []).filter((item) => item.status !== "needs_manual_review");
  const progress = review?.summary.totalAliases
    ? Math.round((review.summary.manualVerified / review.summary.totalAliases) * 100)
    : 0;

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 56px" }}>
          <header style={{
            padding: "26px 28px",
            borderRadius: 24,
            background: "linear-gradient(135deg, #082f49 0%, #115e59 48%, #f59e0b 145%)",
            color: "#ecfeff",
            boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
            marginBottom: 20,
          }}>
            <Link href="/ads" style={{ color: "#bfdbfe", fontSize: "0.78rem", fontWeight: 800, textDecoration: "none" }}>
              ads 대시보드로 돌아가기
            </Link>
            <div style={{ maxWidth: 760, marginTop: 10 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 900, letterSpacing: "0.08em", color: "#99f6e4", marginBottom: 8 }}>
                BIOCOM META ROAS CONTROL
              </div>
              <h1 style={{ margin: "0 0 10px", fontSize: "2rem", lineHeight: 1.16, fontWeight: 950 }}>
                캠페인 매핑은 "이 주문 매출을 어느 Meta 캠페인에 붙일지" 결정하는 작업입니다.
              </h1>
              <p style={{ margin: 0, color: "#dbeafe", fontSize: "0.95rem", lineHeight: 1.75 }}>
                내부 원장에는 광고 링크에서 넘어온 추적 이름이 남고, Meta 광고비 표에는 숫자 campaign id가 남습니다.
                둘을 정확히 연결해야 캠페인별 내부 ROAS가 보입니다. 잘못 붙이면 ROAS가 부풀고, 안 붙이면 미매핑 매출로 남습니다.
              </p>
            </div>
          </header>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              ["전체 추적 이름", review ? fmtNum(review.summary.totalAliases) : "-"],
              ["검토 필요", review ? fmtNum(review.summary.pendingReview) : "-"],
              ["수동 확정", review ? fmtNum(review.summary.manualVerified) : "-"],
              ["확정률", review ? `${progress}%` : "-"],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "16px 18px", borderRadius: 18, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)" }}>
                <div style={{ color: "#64748b", fontSize: "0.73rem", fontWeight: 800 }}>{label}</div>
                <div style={{ marginTop: 5, color: "#0f172a", fontSize: "1.3rem", fontWeight: 950 }}>{value}</div>
              </div>
            ))}
          </section>

          <section style={{ padding: 22, borderRadius: 22, background: "#fff", border: "1px solid #e2e8f0", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 950 }}>재분류 제안</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.84rem", lineHeight: 1.65 }}>
                  여기서는 주문 원장에 남은 내부 추적값을 사람이 읽을 수 있는 이름으로 풀어서 설명합니다.
                  핵심은 "상품군이 맞다"와 "Meta 캠페인에 귀속한다"를 분리하는 것입니다.
                </p>
              </div>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfeff", color: "#0f766e", fontSize: "0.72rem", fontWeight: 900 }}>
                기준: 2026-04-25 로컬 원장
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {proposals.map((proposal) => {
                const isStrong = proposal.tone === "strong";
                return (
                  <article key={proposal.aliasKey} style={{
                    borderRadius: 18,
                    padding: 18,
                    background: isStrong ? "linear-gradient(180deg, #ecfdf5, #fff)" : "linear-gradient(180deg, #fffbeb, #fff)",
                    border: `1px solid ${isStrong ? "#a7f3d0" : "#fde68a"}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 850 }}>사람이 읽는 이름</div>
                        <h3 style={{ margin: "4px 0 0", fontSize: "1rem", fontWeight: 950, wordBreak: "keep-all" }}>{proposal.displayName}</h3>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ padding: "5px 10px", borderRadius: 999, background: isStrong ? "#047857" : "#b45309", color: "#fff", fontSize: "0.72rem", fontWeight: 950 }}>
                          {proposal.confidence}% 자신감
                        </div>
                        <div style={{ marginTop: 6, color: "#64748b", fontSize: "0.72rem", fontWeight: 800 }}>{proposal.impact}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(148, 163, 184, 0.28)" }}>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 850 }}>원본 내부 추적값</div>
                      <code style={{ display: "block", marginTop: 4, color: "#0f172a", fontSize: "0.78rem", fontWeight: 900, wordBreak: "break-all" }}>{proposal.aliasKey}</code>
                      <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.74rem", lineHeight: 1.55 }}>{proposal.trackingDescription}</p>
                    </div>
                    <div style={{ marginTop: 14, padding: 13, borderRadius: 14, background: "#fff", border: "1px solid rgba(148, 163, 184, 0.25)" }}>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 850 }}>판정</div>
                      <div style={{ marginTop: 4, fontSize: "0.95rem", fontWeight: 950, color: isStrong ? "#047857" : "#92400e" }}>{proposal.verdict}</div>
                      <div style={{ marginTop: 4, color: "#334155", fontSize: "0.78rem", lineHeight: 1.6 }}>
                        대상: <strong>{proposal.targetName}</strong>
                        <span style={{ display: "block", marginTop: 2, color: "#64748b" }}>원본 ID 또는 분류 bucket: <code>{proposal.target}</code></span>
                      </div>
                    </div>
                    <p style={{ margin: "13px 0 0", color: "#334155", fontSize: "0.84rem", lineHeight: 1.7 }}>{proposal.plainSummary}</p>
                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      {proposal.proof.map((proof) => (
                        <div key={proof} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#475569", fontSize: "0.78rem", lineHeight: 1.55 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: isStrong ? "#10b981" : "#f59e0b", marginTop: 7, flex: "0 0 auto" }} />
                          <span>{proof}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: isStrong ? "#d1fae5" : "#fef3c7", color: isStrong ? "#065f46" : "#92400e", fontSize: "0.78rem", lineHeight: 1.6, fontWeight: 800 }}>
                      다음 액션: {proposal.nextAction}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 20 }}>
            <div style={{ padding: 22, borderRadius: 22, background: "#0f172a", color: "#e2e8f0" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#fff", fontWeight: 950 }}>매핑을 쉽게 이해하면</h2>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", lineHeight: 1.75, fontSize: "0.84rem" }}>
                주문 장부에는 "손님이 어떤 링크를 타고 왔는지"가 남습니다. Meta 광고비 장부에는 "어느 캠페인이 얼마를 썼는지"가 남습니다.
                캠페인 매핑은 이 두 장부를 연결해서 "이 캠페인은 얼마를 쓰고 실제 확정매출을 얼마 만들었는가"를 계산하는 작업입니다.
              </p>
              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                {workflowSteps.map((step) => (
                  <div key={step.title} style={{ padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <strong style={{ color: "#fff", fontSize: "0.82rem" }}>{step.title}</strong>
                    <div style={{ marginTop: 5, color: "#cbd5e1", fontSize: "0.76rem", lineHeight: 1.6 }}>{step.body}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 22, borderRadius: 22, background: "#fff", border: "1px solid #e2e8f0" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 950 }}>증거 우선순위</h2>
              <p style={{ margin: "6px 0 14px", color: "#64748b", fontSize: "0.82rem", lineHeight: 1.65 }}>
                아래로 내려갈수록 사람이 추정하는 비중이 커집니다. ROAS 판단에는 1-3번 증거를 우선해야 합니다.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {evidenceLadder.map((item) => (
                  <div key={item.rank} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: "#0f766e", color: "#fff", display: "grid", placeItems: "center", fontWeight: 950 }}>{item.rank}</div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.82rem", color: "#0f172a" }}>{item.title}</strong>
                      <span style={{ display: "block", marginTop: 3, color: "#64748b", fontSize: "0.74rem", lineHeight: 1.55 }}>{item.body}</span>
                    </div>
                    <span style={{ padding: "5px 9px", borderRadius: 999, background: item.rank === "5" ? "#fee2e2" : item.rank === "4" ? "#fef3c7" : "#dcfce7", color: item.rank === "5" ? "#991b1b" : item.rank === "4" ? "#92400e" : "#166534", fontSize: "0.68rem", fontWeight: 900 }}>
                      {item.strength}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={{ padding: 22, borderRadius: 22, background: "#fff", border: "1px solid #e2e8f0", marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "stretch" }}>
              <div style={{ padding: 20, borderRadius: 20, background: "linear-gradient(135deg, #052e16 0%, #0f766e 62%, #f59e0b 145%)", color: "#ecfeff" }}>
                <div style={{ color: "#99f6e4", fontSize: "0.72rem", fontWeight: 950, letterSpacing: "0.08em", marginBottom: 9 }}>
                  ROOT FIX IDEA
                </div>
                <h2 style={{ margin: 0, fontSize: "1.35rem", lineHeight: 1.25, fontWeight: 950 }}>
                  근본 해결안: 캠페인 이름을 추정하지 말고, Meta ID를 주문까지 끌고 갑니다.
                </h2>
                <p style={{ margin: "11px 0 0", color: "#dbeafe", fontSize: "0.86rem", lineHeight: 1.75 }}>
                  결론은 "UTM으로 상당 부분 해결 가능"입니다. 다만 UTM을 GA4 보기용 이름표로만 쓰면 반쪽입니다.
                  광고 소재 URL에 Meta campaign/adset/ad ID를 심고, 아임웹 랜딩에서 결제 완료 주문 원장까지 보존해야 수동 매핑 문제가 구조적으로 줄어듭니다.
                </p>
                <div style={{ marginTop: 15, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
                  {[
                    ["UTM만 추가", "부분 해결", "랜딩 세션까지만 보이면 결제에서 끊길 수 있음"],
                    ["UTM + Meta ID", "강한 해결", "adset id로 부모 campaign을 자동 복구 가능"],
                    ["ID + 주문 원장", "근본 해결", "ROAS 계산이 수동 추적 이름에서 deterministic 매핑으로 전환"],
                  ].map(([label, grade, body]) => (
                    <div key={label} style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)" }}>
                      <div style={{ color: "#ccfbf1", fontSize: "0.7rem", fontWeight: 900 }}>{label}</div>
                      <div style={{ marginTop: 5, color: "#fff", fontSize: "0.94rem", fontWeight: 950 }}>{grade}</div>
                      <div style={{ marginTop: 5, color: "#dbeafe", fontSize: "0.72rem", lineHeight: 1.5 }}>{body}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {rootFixSummary.map((item) => (
                  <div key={item.title} style={{ padding: 15, borderRadius: 18, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>{item.title}</strong>
                      <span style={{ padding: "4px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: "0.68rem", fontWeight: 950 }}>
                        {item.result}
                      </span>
                    </div>
                    <p style={{ margin: "7px 0 0", color: "#475569", fontSize: "0.77rem", lineHeight: 1.6 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              <div style={{ padding: 18, borderRadius: 20, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 950 }}>추천 광고 URL 파라미터 템플릿</h3>
                    <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: "0.78rem", lineHeight: 1.55 }}>
                      Meta 광고관리자 URL Parameters 필드에 넣을 기준입니다. 동적 치환값은 적용 전 광고관리자 미리보기와 테스트 클릭으로 확인해야 합니다.
                    </p>
                  </div>
                  <span style={{ padding: "5px 9px", borderRadius: 999, background: "#e0f2fe", color: "#0369a1", fontSize: "0.68rem", fontWeight: 950 }}>
                    신규 광고 필수
                  </span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {trackingTemplateRows.map((row) => (
                    <div key={row.key} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "center", padding: 10, borderRadius: 14, background: "#fff", border: "1px solid #e2e8f0" }}>
                      <code style={{ color: "#0f766e", fontSize: "0.74rem", fontWeight: 950, wordBreak: "break-all" }}>{row.key}</code>
                      <code style={{ color: "#0f172a", fontSize: "0.74rem", fontWeight: 900, wordBreak: "break-all" }}>{row.value}</code>
                      <span style={{ color: "#64748b", fontSize: "0.72rem", lineHeight: 1.5 }}>{row.reason}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#ecfeff", border: "1px solid #bae6fd", color: "#155e75", fontSize: "0.76rem", lineHeight: 1.65, fontWeight: 800 }}>
                  권장 저장 원칙: utm_campaign은 보고서 호환용으로 두고, 내부 매핑은 meta_campaign_id, meta_adset_id, meta_ad_id를 우선합니다.
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ padding: 18, borderRadius: 20, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 950, color: "#9a3412" }}>랜딩 URL만으로는 부족한 이유</h3>
                  <div style={{ marginTop: 11, display: "grid", gap: 8 }}>
                    {rootFixFailureModes.map((body) => (
                      <div key={body} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#7c2d12", fontSize: "0.76rem", lineHeight: 1.55 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", marginTop: 7, flex: "0 0 auto" }} />
                        <span>{body}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: 18, borderRadius: 20, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 950, color: "#166534" }}>이렇게 바뀌면 줄어드는 일</h3>
                  <p style={{ margin: "9px 0 0", color: "#166534", fontSize: "0.78rem", lineHeight: 1.65 }}>
                    cellcleanerreel처럼 이름이 헷갈리는 내부 추적값은 meta_adset_id로 부모 campaign을 자동 복구합니다.
                    inpork처럼 Meta ID가 없는 주문은 처음부터 non-meta로 분리되어 Meta ROAS를 부풀리지 않습니다.
                    앞으로 yes/no 검토는 신규 주문이 아니라 과거 누락 주문 정리용으로만 남게 됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, padding: 18, borderRadius: 20, background: "#0f172a", color: "#e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: "1.04rem", fontWeight: 950 }}>실행 로드맵</h3>
                  <p style={{ margin: "5px 0 0", color: "#cbd5e1", fontSize: "0.78rem", lineHeight: 1.55 }}>
                    수동 매핑을 없애려면 광고 설정, 아임웹 스크립트, 백엔드 귀속 로직, 감사 화면이 같이 움직여야 합니다.
                  </p>
                </div>
                <span style={{ padding: "5px 9px", borderRadius: 999, background: "rgba(45, 212, 191, 0.16)", color: "#99f6e4", fontSize: "0.68rem", fontWeight: 950 }}>
                  제안 우선순위 높음
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
                {rootFixStages.map((stage) => (
                  <div key={stage.title} style={{ padding: 13, borderRadius: 16, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ color: "#fbbf24", fontSize: "0.72rem", fontWeight: 950 }}>{stage.period}</div>
                    <strong style={{ display: "block", marginTop: 5, color: "#fff", fontSize: "0.84rem" }}>{stage.title}</strong>
                    <p style={{ margin: "6px 0 0", color: "#cbd5e1", fontSize: "0.74rem", lineHeight: 1.55 }}>{stage.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={{ padding: 22, borderRadius: 22, background: "#fff", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 950 }}>라이브 추적 이름 검토</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.84rem", lineHeight: 1.65 }}>
                  백엔드 audit API에서 가져온 실제 검토 목록입니다. yes는 해당 캠페인에 매출을 붙이고, no는 그 후보를 제외합니다.
                  내부 추적 이름은 광고 링크에서 주문 원장으로 넘어온 값이며, 원본값은 검증을 위해 함께 표시합니다.
                  단, 위의 cellcleanerreel처럼 정답 후보가 API 후보에 없을 때는 seed를 직접 보강해야 합니다.
                </p>
              </div>
              <button type="button" onClick={() => void loadReview()} style={{
                padding: "9px 13px",
                borderRadius: 12,
                border: "1px solid #0f766e",
                background: "#fff",
                color: "#0f766e",
                fontSize: "0.76rem",
                fontWeight: 900,
                cursor: "pointer",
              }}>
                새로고침
              </button>
            </div>

            {review?.generated_at && (
              <div style={{ marginBottom: 14, padding: "11px 13px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.76rem", lineHeight: 1.6 }}>
                audit 생성 시각: <strong style={{ color: "#0f172a" }}>{formatDateTime(review.generated_at)}</strong>.
                이 값은 API 스냅샷 기준입니다. 로컬 원장 최신 수치와 다를 수 있으므로 최종 결정 전 원장 수치도 같이 봅니다.
              </div>
            )}

            {error && (
              <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 14, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "0.8rem", fontWeight: 800 }}>
                {error}
              </div>
            )}

            {loading ? (
              <div style={{ padding: 34, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 16 }}>불러오는 중입니다.</div>
            ) : pendingItems.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {pendingItems.map((item) => {
                  const isOpen = expandedAlias === item.aliasKey;
                  const periodLabel = item.validFrom
                    ? `${item.validFrom} - ${review?.generated_at ? review.generated_at.slice(0, 10) : "현재"}`
                    : `- ${review?.generated_at ? review.generated_at.slice(0, 10) : "현재"}`;
                  return (
                    <article key={item.aliasKey} style={{ borderRadius: 18, border: "1px solid #fbbf24", background: "#fffbeb", overflow: "hidden" }}>
                      <button type="button" onClick={() => setExpandedAlias(isOpen ? null : item.aliasKey)} style={{
                        width: "100%",
                        border: 0,
                        background: "transparent",
                        padding: "16px 18px",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 14,
                        textAlign: "left",
                      }}>
                        <div>
                          <div style={{ color: "#92400e", fontSize: "0.72rem", fontWeight: 950 }}>{getStatusLabel(item.status)} · 후보 {item.candidates.length}개</div>
                          <h3 style={{ margin: "4px 0 0", color: "#0f172a", fontSize: "1rem", fontWeight: 950, wordBreak: "keep-all" }}>{getReadableTrackingName(item.aliasKey)}</h3>
                          <div style={{ marginTop: 5, color: "#64748b", fontSize: "0.72rem", lineHeight: 1.55 }}>
                            원본 내부 추적값: <code style={{ color: "#0f172a", fontWeight: 850, wordBreak: "break-all" }}>{item.aliasKey}</code>
                          </div>
                          <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: "0.76rem", lineHeight: 1.55 }}>{item.reviewReason || "검토 사유가 기록되지 않았습니다."}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "#047857", fontSize: "0.9rem", fontWeight: 950 }}>{fmtKRW(item.evidence.confirmedRevenue)}</div>
                          <div style={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 800 }}>{fmtNum(item.evidence.confirmedOrders)}건 · {periodLabel}</div>
                        </div>
                      </button>

                      {isOpen && (
                        <div style={{ padding: "0 18px 18px", borderTop: "1px solid #fde68a" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 14 }}>
                            {[
                              ["확정 매출", fmtKRW(item.evidence.confirmedRevenue)],
                              ["확정 주문", `${fmtNum(item.evidence.confirmedOrders)}건`],
                              ["pending", `${fmtNum(item.evidence.pendingOrders)}건 / ${fmtKRW(item.evidence.pendingRevenue)}`],
                              ["취소", `${fmtNum(item.evidence.canceledOrders)}건 / ${fmtKRW(item.evidence.canceledRevenue)}`],
                            ].map(([label, value]) => (
                              <div key={label} style={{ padding: 12, borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9" }}>
                                <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: 850 }}>{label}</div>
                                <div style={{ marginTop: 4, color: "#0f172a", fontWeight: 950 }}>{value}</div>
                              </div>
                            ))}
                          </div>

                          {item.candidates.length === 0 ? (
                            <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "0.8rem", lineHeight: 1.6, fontWeight: 800 }}>
                              Meta 후보가 없습니다. 이 경우에는 삭제된 광고, 비Meta 유입, 또는 UTM 규칙 누락 가능성이 큽니다. 캠페인 ROAS에 강제로 붙이지 않는 편이 안전합니다.
                            </div>
                          ) : (
                            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                              {item.candidates.map((candidate) => {
                                const score = getCandidateScore(item, candidate);
                                const actionPrefix = `${item.aliasKey}:${candidate.campaignId}:`;
                                const metaRoas = candidate.spend > 0 && candidate.purchaseValue > 0 ? candidate.purchaseValue / candidate.spend : null;
                                return (
                                  <div key={candidate.campaignId} style={{
                                    padding: 14,
                                    borderRadius: 16,
                                    background: candidate.selected ? "#ecfdf5" : candidate.rejected ? "#f8fafc" : "#fff",
                                    border: candidate.selected ? "2px solid #10b981" : candidate.rejected ? "1px solid #e2e8f0" : "1px solid #bfdbfe",
                                    opacity: candidate.rejected ? 0.62 : 1,
                                  }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start" }}>
                                      <div>
                                        <div style={{ fontSize: "0.86rem", color: "#0f172a", fontWeight: 950 }}>{candidate.campaignName}</div>
                                        <div style={{ marginTop: 3, color: "#64748b", fontSize: "0.72rem" }}>{candidate.campaignId}</div>
                                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                          {[
                                            ["집행", fmtKRW(candidate.spend)],
                                            ["Meta 구매값", fmtKRW(candidate.purchaseValue)],
                                            ["Meta ROAS", metaRoas == null ? "-" : `${metaRoas.toFixed(2)}x`],
                                            ["활성 광고", `${candidate.activeAds}개`],
                                          ].map(([label, value]) => (
                                            <span key={label} style={{ padding: "4px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontSize: "0.7rem", fontWeight: 850 }}>
                                              {label} <strong style={{ color: "#0f172a" }}>{value}</strong>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div style={{ display: "grid", gap: 7, justifyItems: "end" }}>
                                        <span style={{ padding: "5px 9px", borderRadius: 999, background: score.bg, color: score.color, fontSize: "0.72rem", fontWeight: 950 }}>
                                          후보 점수 {score.score}% {score.label}
                                        </span>
                                        <div style={{ display: "flex", gap: 6 }}>
                                          <button type="button" disabled={Boolean(actionLoading)} onClick={() => void handleDecision(item.aliasKey, candidate.campaignId, "yes")} style={{
                                            padding: "7px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #10b981",
                                            background: candidate.selected ? "#10b981" : "#fff",
                                            color: candidate.selected ? "#fff" : "#047857",
                                            fontSize: "0.72rem",
                                            fontWeight: 950,
                                            cursor: actionLoading ? "not-allowed" : "pointer",
                                          }}>
                                            {actionLoading === `${actionPrefix}yes` ? "저장 중" : "yes"}
                                          </button>
                                          <button type="button" disabled={Boolean(actionLoading)} onClick={() => void handleDecision(item.aliasKey, candidate.campaignId, "no")} style={{
                                            padding: "7px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #ef4444",
                                            background: candidate.rejected ? "#ef4444" : "#fff",
                                            color: candidate.rejected ? "#fff" : "#b91c1c",
                                            fontSize: "0.72rem",
                                            fontWeight: 950,
                                            cursor: actionLoading ? "not-allowed" : "pointer",
                                          }}>
                                            {actionLoading === `${actionPrefix}no` ? "저장 중" : "no"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                      <div style={{ color: "#0f766e", fontSize: "0.72rem", fontWeight: 950, marginBottom: 6 }}>왜 이 점수인가</div>
                                      <div style={{ display: "grid", gap: 5 }}>
                                        {score.reasons.map((reason) => (
                                          <div key={reason} style={{ display: "flex", gap: 8, color: "#475569", fontSize: "0.74rem", lineHeight: 1.5 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: score.color, marginTop: 7, flex: "0 0 auto" }} />
                                            <span>{reason}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {(candidate.adsetSamples.length > 0 || candidate.adSamples.length > 0 || candidate.landingUrlExamples.length > 0) && (
                                      <details style={{ marginTop: 10 }}>
                                        <summary style={{ cursor: "pointer", color: "#2563eb", fontSize: "0.74rem", fontWeight: 900 }}>광고세트, 광고명, URL 증거 보기</summary>
                                        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                                          <EvidenceBox title="광고세트" rows={candidate.adsetSamples} />
                                          <EvidenceBox title="광고명" rows={candidate.adSamples} />
                                          <div style={{ gridColumn: "1 / -1" }}>
                                            <EvidenceBox title="랜딩 URL" rows={candidate.landingUrlExamples} />
                                          </div>
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 24, borderRadius: 16, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", fontSize: "0.85rem", fontWeight: 900 }}>
                검토 필요 추적 이름이 없습니다. 다만 stale audit 여부는 별도로 확인해야 합니다.
              </div>
            )}

            {resolvedItems.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <button type="button" onClick={() => setShowResolved((value) => !value)} style={{
                  border: 0,
                  background: "transparent",
                  color: "#475569",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 950,
                  padding: "8px 0",
                }}>
                  {showResolved ? "확정 완료 접기" : `확정 완료 ${resolvedItems.length}건 보기`}
                </button>
                {showResolved && (
                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                          {["내부 추적값", "매칭 캠페인", "매출", "주문", "방법"].map((head) => (
                            <th key={head} style={{ padding: "9px 10px", textAlign: head === "매출" || head === "주문" ? "right" : "left", color: "#64748b" }}>{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resolvedItems.map((item) => (
                          <tr key={item.aliasKey} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px", color: "#0f172a", fontWeight: 850 }}>
                              {getReadableTrackingName(item.aliasKey)}
                              <div style={{ marginTop: 3, color: "#64748b", fontSize: "0.68rem", wordBreak: "break-all" }}>{item.aliasKey}</div>
                            </td>
                            <td style={{ padding: "10px", color: "#475569" }}>{item.selectedCampaignName ?? (item.status === "rejected_all_candidates" ? "전부 제외" : "-")}</td>
                            <td style={{ padding: "10px", textAlign: "right", color: "#047857", fontWeight: 850 }}>{fmtKRW(item.evidence.confirmedRevenue)}</td>
                            <td style={{ padding: "10px", textAlign: "right" }}>{fmtNum(item.evidence.confirmedOrders)}건</td>
                            <td style={{ padding: "10px", color: "#64748b" }}>{getConfidenceLabel(item.confidence)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function EvidenceBox({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <div style={{ color: "#64748b", fontSize: "0.68rem", fontWeight: 950, marginBottom: 6 }}>{title}</div>
      {rows.length > 0 ? (
        <div style={{ display: "grid", gap: 5 }}>
          {rows.map((row, index) => (
            <div key={`${title}-${index}`} style={{ color: "#334155", fontSize: "0.7rem", lineHeight: 1.55, wordBreak: "break-all" }}>{row}</div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#94a3b8", fontSize: "0.72rem" }}>증거 없음</div>
      )}
    </div>
  );
}
