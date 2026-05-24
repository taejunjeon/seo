"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type DatePreset = "last_7d" | "last_30d";

type GoogleCampaignMatchHealth = {
  windowDays: number;
  generatedAt: string;
  source: string;
  mode: "no_send_read_only";
  baseline: {
    candidateStartedAtKst: string;
    effectiveForRoasRecalculation: boolean;
    effectiveFromKst: string | null;
    policy: string;
  };
  siteLanding: {
    rows: number;
    googleClickIdRows: number;
    gadCampaignIdRows: number;
    gadSourceRows: number;
    utmBlankGoogleClickIdRows: number;
    utmPresentGoogleClickIdRows: number;
    currentCampaignIdCoverageRate: number | null;
    potentialCoverageRateAfterAllowlist: number | null;
    latestAt: string | null;
  };
  paidClickIntent: {
    rows: number;
    googleClickIdRows: number;
    gadCampaignIdRows: number;
    gadSourceRows: number;
    utmBlankGoogleClickIdRows: number;
    utmPresentGoogleClickIdRows: number;
    currentCampaignIdCoverageRate: number | null;
    potentialCoverageRateAfterAllowlist: number | null;
    latestAt: string | null;
  };
  attributionLedger: {
    rows: number;
    gadCampaignIdRows: number;
    googleClickIdEvidenceRows: number;
    confirmedPaymentSuccessRows: number;
    confirmedRowsWithGadCampaignId: number;
    latestAt: string | null;
  };
  confidenceThresholds: {
    exactClickViewPct: number;
    gadCampaignIdWithClickIdPct: number;
    gadCampaignIdSessionOnlyPct: number;
    utmOnlyPct: number;
    unmappedPct: number;
  };
  topCampaignIds: Array<{
    campaignId: string;
    campaignName: string | null;
    rows: number;
    confirmedRows: number;
    matchedToDashboardCampaign: boolean;
  }>;
  healthSplit?: {
    roasAttribution: {
      source: "site_landing_ledger_and_attribution_ledger";
      status: "usable_for_budget_review" | "collecting" | "blocked";
      rows: number;
      googleClickIdRows: number;
      gadCampaignIdRows: number;
      currentCampaignIdCoverageRate: number | null;
      latestAt: string | null;
      interpretation: string;
    };
    paidClickIntentTag: {
      source: "paid_click_intent_ledger";
      status: "monitoring" | "needs_exact_click_diagnosis" | "collecting" | "blocked";
      rows: number;
      googleClickIdRows: number;
      gadCampaignIdRows: number;
      currentCampaignIdCoverageRate: number | null;
      latestAt: string | null;
      interpretation: string;
    };
    orderAttribution: {
      source: "attribution_ledger";
      status: "usable_for_order_join" | "collecting" | "blocked";
      rows: number;
      googleClickIdEvidenceRows: number;
      confirmedPaymentSuccessRows: number;
      confirmedRowsWithGadCampaignId: number;
      latestAt: string | null;
      interpretation: string;
    };
  };
  summary: {
    status:
      | "needs_allowlist_deploy"
      | "allowlist_deployed_waiting_new_click"
      | "campaign_id_collecting"
      | "no_google_click_id_rows"
      | "table_unavailable";
    mappedRows: number;
    unmappedRows: number;
    recoverableRowsAfterAllowlist: number;
    uploadCandidateCount: 0;
    interpretation: string;
  };
  caveats: string[];
};

type GoogleAdsDashboardResponse = {
  ok: boolean;
  fetchedAt: string;
  customerId: string;
  datePreset: DatePreset;
  dateRangeLiteral: string;
  summary: {
    cost: number;
    conversionValue: number;
    allConversionValue: number;
    viewThroughConversions: number;
    roas: number | null;
  };
  internal?: {
    summary: {
      confirmedOrders: number;
      confirmedRevenue: number;
      platformCost: number;
      platformConversionValue: number;
      platformRoas: number | null;
      internalConfirmedRoas: number | null;
      roasGap: number | null;
      platformMinusConfirmedRevenue: number;
      campaignIdCoverage: number | null;
      unknownCampaignOrders: number;
    };
  };
  npayActualCorrection?: {
    windowDays: number;
    npayActualConfirmedPgCount: number;
    npayActualConfirmedPgRevenueKrw: number;
    internalConfirmedRoasCurrent: number | null;
    internalConfirmedRoasWithNpayActualPg: number | null;
    googleAdsBudgetFloorNpayExactCount: number;
    uploadCandidateCount: 0;
    npayActualWireStatus: string;
  };
  clickIdHealth?: {
    windowDays: number;
    generatedAt: string;
    source: string;
    mode: "no_send_read_only";
    orderCount: number;
    totalValueKrw: number;
    withGoogleClickId: number;
    missingGoogleClickId: number;
    preservationRate: number | null;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    clickIdBreakdown: {
      gclid: number;
      gbraid: number;
      wbraid: number;
    };
    paymentMethodBreakdown: Array<{
      paymentMethod: "homepage" | "npay" | "unknown";
      orders: number;
      withGoogleClickId: number;
      missingGoogleClickId: number;
      preservationRate: number | null;
    }>;
    blockReasonCounts: {
      readOnlyPhase: number;
      approvalRequired: number;
      missingGoogleClickId: number;
      missingAttributionVmEvidence: number;
    };
  };
  googleCampaignMatchHealth?: GoogleCampaignMatchHealth;
  conversionActionSegments?: {
    summary: {
      primaryConversionValue: number;
      allConversionValue: number;
      platformMinusInternalConfirmed: number;
      primaryKnownNpayConversionValue: number;
      primaryKnownNpayShareOfPlatform: number | null;
      allConversionValueMinusInternalConfirmed: number;
      knownNpayAllOnlyConversionValue?: number;
      nonPurchasePrimaryConversionValue?: number;
      gapAfterRemovingKnownNpayPrimary?: number;
    };
    actions: Array<{
      conversionActionId: string | null;
      conversionActionName: string;
      conversions: number;
      conversionValue: number;
      allConversions: number;
      allConversionValue: number;
      viewThroughConversions: number;
      status: string;
      category: string;
      primaryForGoal: boolean;
      countingType: string;
      classification: string;
      riskFlags: string[];
      campaignCount: number;
      shareOfPlatformConversionValue: number | null;
    }>;
    gapDrivers: Array<{
      key: string;
      label: string;
      value: number;
      shareOfPlatformConversionValue: number | null;
      confidence: "high" | "medium-high" | "medium";
      evidence: string;
      nextAction: string;
    }>;
  };
};

type Snapshot = {
  preset: DatePreset;
  label: string;
  response: GoogleAdsDashboardResponse | null;
  error: string | null;
};

const fallbackSnapshots: Record<DatePreset, {
  label: string;
  platformRoas: number;
  internalRoas: number;
  internalWithNpayRoas: number;
  platformValue: number;
  internalRevenue: number;
  npayRevenue: number;
  cost: number;
  source: string;
  clickIdHealth: {
    generatedAt: string;
    orderCount: number;
    withGoogleClickId: number;
    missingGoogleClickId: number;
    preservationRate: number;
    uploadCandidateCount: 0;
    source: string;
    blockReasonCounts: {
      missingAttributionVmEvidence: number;
    };
    paymentMethodBreakdown: Array<{
      paymentMethod: "homepage" | "npay" | "unknown";
      orders: number;
      withGoogleClickId: number;
      missingGoogleClickId: number;
      preservationRate: number;
    }>;
    clickIdBreakdown: {
      gclid: number;
      gbraid: number;
      wbraid: number;
    };
  };
}> = {
  last_7d: {
    label: "최근 7일",
    platformRoas: 10.04,
    internalRoas: 0.37,
    internalWithNpayRoas: 2.58,
    platformValue: 35268162,
    internalRevenue: 1285627,
    npayRevenue: 7771000,
    cost: 3512212,
    source: "VM Cloud live API snapshot, 2026-05-24 00:59 KST",
    clickIdHealth: {
      generatedAt: "2026-05-23T13:55:31.117Z",
      orderCount: 464,
      withGoogleClickId: 5,
      missingGoogleClickId: 459,
      preservationRate: 0.0108,
      uploadCandidateCount: 0,
      source: "VM Cloud public dashboard API snapshot",
      blockReasonCounts: {
        missingAttributionVmEvidence: 107,
      },
      paymentMethodBreakdown: [
        { paymentMethod: "homepage", orders: 439, withGoogleClickId: 5, missingGoogleClickId: 434, preservationRate: 0.0114 },
        { paymentMethod: "npay", orders: 25, withGoogleClickId: 0, missingGoogleClickId: 25, preservationRate: 0 },
      ],
      clickIdBreakdown: { gclid: 5, gbraid: 2, wbraid: 0 },
    },
  },
  last_30d: {
    label: "최근 30일",
    platformRoas: 9.94,
    internalRoas: 0.28,
    internalWithNpayRoas: 2.22,
    platformValue: 211426031,
    internalRevenue: 5899827,
    npayRevenue: 41297700,
    cost: 21265019,
    source: "VM Cloud live API snapshot, 2026-05-23 22:55 KST",
    clickIdHealth: {
      generatedAt: "2026-05-23T13:55:54.559Z",
      orderCount: 2244,
      withGoogleClickId: 16,
      missingGoogleClickId: 2228,
      preservationRate: 0.0071,
      uploadCandidateCount: 0,
      source: "VM Cloud public dashboard API snapshot",
      blockReasonCounts: {
        missingAttributionVmEvidence: 592,
      },
      paymentMethodBreakdown: [
        { paymentMethod: "homepage", orders: 2079, withGoogleClickId: 16, missingGoogleClickId: 2063, preservationRate: 0.0077 },
        { paymentMethod: "npay", orders: 165, withGoogleClickId: 0, missingGoogleClickId: 165, preservationRate: 0 },
      ],
      clickIdBreakdown: { gclid: 16, gbraid: 11, wbraid: 1 },
    },
  },
};

const fallbackCampaignMatchHealth: Record<DatePreset, GoogleCampaignMatchHealth> = {
  last_7d: {
    windowDays: 7,
    generatedAt: "2026-05-20 23:00 KST",
    source: "VM Cloud SQLite read-only snapshot",
    mode: "no_send_read_only",
    baseline: {
      candidateStartedAtKst: "2026-05-20 23:00 KST",
      effectiveForRoasRecalculation: false,
      effectiveFromKst: null,
      policy: "오늘 작업일은 후보 기준점입니다. 신규 유입에서 gad_campaignid 보존이 확인된 뒤 ROAS 재계산 기준점으로 승격합니다.",
    },
    siteLanding: {
      rows: 13160,
      googleClickIdRows: 10364,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 434,
      utmPresentGoogleClickIdRows: 9930,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0419,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    paidClickIntent: {
      rows: 10952,
      googleClickIdRows: 10839,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 377,
      utmPresentGoogleClickIdRows: 10575,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0348,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    attributionLedger: {
      rows: 4367,
      gadCampaignIdRows: 107,
      googleClickIdEvidenceRows: 4314,
      confirmedPaymentSuccessRows: 371,
      confirmedRowsWithGadCampaignId: 2,
      latestAt: "2026-05-20T13:53:54.707Z",
    },
    confidenceThresholds: {
      exactClickViewPct: 95,
      gadCampaignIdWithClickIdPct: 85,
      gadCampaignIdSessionOnlyPct: 70,
      utmOnlyPct: 50,
      unmappedPct: 0,
    },
    topCampaignIds: [
      { campaignId: "23249701426", campaignName: null, rows: 72, confirmedRows: 0, matchedToDashboardCampaign: false },
      { campaignId: "23844227518", campaignName: null, rows: 12, confirmedRows: 0, matchedToDashboardCampaign: false },
      { campaignId: "21808018766", campaignName: null, rows: 8, confirmedRows: 0, matchedToDashboardCampaign: false },
      { campaignId: "14629255429", campaignName: null, rows: 6, confirmedRows: 1, matchedToDashboardCampaign: false },
      { campaignId: "22018178854", campaignName: null, rows: 4, confirmedRows: 1, matchedToDashboardCampaign: false },
    ],
    summary: {
      status: "allowlist_deployed_waiting_new_click",
      mappedRows: 0,
      unmappedRows: 811,
      recoverableRowsAfterAllowlist: 811,
      uploadCandidateCount: 0,
      interpretation: "gad_campaignid allowlist는 배포됐습니다. 신규 Google 클릭 row가 쌓인 뒤 매칭률을 다시 확인해야 합니다.",
    },
    caveats: [
      "gad_campaignid는 캠페인 ID 힌트이며 Google Ads upload 후보가 아닙니다.",
      "오늘 작업일은 후보 기준점이며 post-deploy smoke 후 기준점으로 승격합니다.",
    ],
  },
  last_30d: {
    windowDays: 30,
    generatedAt: "2026-05-20 23:00 KST",
    source: "VM Cloud SQLite read-only snapshot",
    mode: "no_send_read_only",
    baseline: {
      candidateStartedAtKst: "2026-05-20 23:00 KST",
      effectiveForRoasRecalculation: false,
      effectiveFromKst: null,
      policy: "오늘 작업일은 후보 기준점입니다. 신규 유입에서 gad_campaignid 보존이 확인된 뒤 ROAS 재계산 기준점으로 승격합니다.",
    },
    siteLanding: {
      rows: 15920,
      googleClickIdRows: 12427,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 586,
      utmPresentGoogleClickIdRows: 11844,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0472,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    paidClickIntent: {
      rows: 17171,
      googleClickIdRows: 17040,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 826,
      utmPresentGoogleClickIdRows: 16345,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0485,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    attributionLedger: {
      rows: 30943,
      gadCampaignIdRows: 572,
      googleClickIdEvidenceRows: 8471,
      confirmedPaymentSuccessRows: 1743,
      confirmedRowsWithGadCampaignId: 15,
      latestAt: "2026-05-20T13:53:54.707Z",
    },
    confidenceThresholds: {
      exactClickViewPct: 95,
      gadCampaignIdWithClickIdPct: 85,
      gadCampaignIdSessionOnlyPct: 70,
      utmOnlyPct: 50,
      unmappedPct: 0,
    },
    topCampaignIds: [],
    summary: {
      status: "allowlist_deployed_waiting_new_click",
      mappedRows: 0,
      unmappedRows: 1412,
      recoverableRowsAfterAllowlist: 1412,
      uploadCandidateCount: 0,
      interpretation: "gad_campaignid allowlist는 배포됐습니다. 신규 Google 클릭 row가 쌓인 뒤 매칭률을 다시 확인해야 합니다.",
    },
    caveats: [
      "gad_campaignid는 캠페인 ID 힌트이며 Google Ads upload 후보가 아닙니다.",
      "오늘 작업일은 후보 기준점이며 post-deploy smoke 후 기준점으로 승격합니다.",
    ],
  },
};

const phasePlan = [
  {
    phase: "Phase 1",
    sprint: "Sprint 1",
    title: "신규 Google 클릭 row가 어떤 파라미터를 들고 들어오는지 확인",
    status: "클릭 단계 수집 확인",
    progress: 86,
    tone: "warn",
    why: "이 일은 Google 광고 클릭이 실제로 어떤 증거를 남기는지 보는 단계입니다. gclid/gbraid/wbraid는 Google Ads에 다시 붙일 수 있는 클릭 식별자이고, gad_campaignid는 어느 캠페인에서 온 클릭인지 나누는 번호입니다. 둘이 같은 row에 남아야 캠페인별 내부 ROAS를 믿고 쪼갤 수 있습니다.",
    cadence: "배포나 실제 광고 클릭 후 T+30분, T+2시간, T+24시간에만 재조회합니다. 계속 감시하려는 것이 아니라 `클릭 URL 파라미터가 들어오나`, `그 값이 결제 단계까지 이어지나`, `캠페인 ID가 Google Ads 캠페인 목록과 맞나`를 순서대로 판정하기 위해서입니다.",
    steps: [
      "고객 유입 장부(site_landing_ledger)에서 실제 랜딩 URL에 gclid/gbraid/wbraid와 gad_campaignid/gad_source가 함께 남는지 셉니다. 이것은 광고 클릭이 사이트 첫 진입에서 보존되는지 보는 지표입니다.",
      "유료 클릭 의도 장부(paid_click_intent_ledger)에서 같은 파라미터가 allowed query로 저장되는지 봅니다. 이것은 GTM/아임웹 태그가 클릭 직후 파라미터를 놓치지 않는지 보는 지표입니다.",
      "결제완료 장부(attribution_ledger payment_success confirmed)에서 같은 캠페인 ID가 주문까지 남는지 봅니다. 이것은 예산 판단용 ROAS에 쓸 수 있는 주문 단계 증거입니다.",
      "Google Ads 캠페인 목록과 gad_campaignid를 대조해 `번호는 있는데 캠페인명을 못 찾는 row`를 분리합니다. 이름이 안 붙는 row는 예산 증액 근거가 아니라 매핑 보강 대상입니다.",
    ],
    success: "클릭 단계에서는 신규 Google click id row의 85% 이상이 gad_campaignid를 함께 가져오고, 주문 단계에서는 confirmed payment_success row에도 같은 증거가 남아야 합니다. 클릭 단계만 통과하면 수집은 성공이지만 ROAS 전송 후보는 아닙니다.",
    currentResult: "2026-05-23 23:02 KST read-only 확인: 5월 21일 21:15 이후 고객 유입 장부는 Google click id 2,857건 중 gad_campaignid 2,751건(96.29%), 유료 클릭 의도 장부는 2,927건 중 2,901건(99.11%)입니다. 클릭 단계 수집은 정상으로 봅니다.",
    nextDecision: "다음 병목은 주문 단계입니다. 같은 기간 결제완료 129건 중 주문 기준 click id 보존은 0건이라, Google Ads upload 후보는 계속 0건으로 두고 payment_success exact evidence 연결을 먼저 보강해야 합니다.",
    owner: "Codex",
    evidence: "VM Cloud SQLite read-only + /api/google-ads/dashboard · raw click id/order id 미출력",
  },
  {
    phase: "Phase 1",
    sprint: "Sprint 2",
    title: "Google Ads 최종 URL 설정에서 캠페인 ID가 안 붙는 원인 좁히기",
    status: "조사 완료",
    progress: 70,
    tone: "normal",
    why: "운영 원장에는 Google click id가 들어오는데 gad_campaignid가 없으므로, 수집기 문제가 아니라 Google Ads URL 옵션에 campaign id 삽입이 없는지 확인해야 합니다.",
    cadence: "최종 URL audit은 설정이 바뀔 때 1회, 그 뒤 신규 클릭 smoke 1회만 다시 합니다.",
    steps: [
      "Google Ads API final URL audit에서 final URL suffix, tracking template, manual UTM 존재 여부를 확인합니다.",
      "현재 캠페인/광고/asset group URL에 Google click id 계열과 campaign id 계열 파라미터가 들어가는지 분리합니다.",
      "보강이 필요하면 Google Ads UI에서 final URL suffix 또는 tracking template에 campaign id ValueTrack을 추가하는 승인안을 작성합니다.",
    ],
    success: "Google Ads URL 옵션에서 campaign id 삽입 위치가 확인되고, 운영 적용 전 테스트 URL에서 campaign id가 실제 값으로 치환됩니다.",
    currentResult: "finalUrlSuffixRows 0건, trackingTemplateRows 0건, googleClickParamRows 0건입니다. Google click id는 자동 태깅으로 들어오지만 campaign id는 별도 삽입이 필요해 보입니다.",
    nextDecision: "24시간 신규 클릭에서도 gad_campaignid 0건이면 `gad_campaignid={campaignid}` 계열 URL suffix 보강을 승인 요청합니다.",
    owner: "Codex + TJ님",
    evidence: "/api/google-ads/final-url-audit?customer_id=2149990943",
  },
  {
    phase: "Phase 2",
    sprint: "Sprint 1",
    title: "campaign id coverage와 unknown campaign order를 줄이는 dry-run",
    status: "1차 완료",
    progress: 55,
    tone: "warn",
    why: "현재 내부 결제 주문 일부는 campaign id나 UTM 힌트가 있지만 Google Ads 캠페인 목록과 정확히 붙지 않아, 캠페인별 증액 판단에 바로 쓰기 어렵습니다.",
    cadence: "last_7d는 신규 클릭 확인 시점마다, last_30d는 하루 1회만 재조회합니다. 목적은 화면 숫자 감시가 아니라 매칭 규칙 개선 전후 차이 확인입니다.",
    steps: [
      "last_7d 내부 주문의 campaignIdCoverage, unknownCampaignOrders, internalOnlyCampaigns를 뽑습니다.",
      "unknown 묶음을 UTM 예시, campaign id 예시, confirmed revenue 기준으로 나눠 사람이 검토할 우선순위를 정합니다.",
      "Google Ads 활성 캠페인 목록과 붙는 항목만 캠페인별 ROAS 후보로 승격하고, UTM만 있는 항목은 진단용으로 남깁니다.",
    ],
    success: "unknownCampaignOrders가 줄고, confirmed revenue가 있는 캠페인의 85% 이상이 Google campaign id 또는 검증된 UTM evidence로 설명됩니다.",
    currentResult: "last_7d live 기준 campaignIdCoverage 58%, matchedCampaignOrders 1건, unknownCampaignOrders 10건입니다. unknown confirmed revenue는 약 104만원입니다.",
    nextDecision: "gad_campaignid 신규 수집이 열리면 같은 dry-run을 재실행해 58%가 올라가는지 봅니다.",
    owner: "Codex",
    evidence: "/api/google-ads/dashboard?date_preset=last_7d",
  },
  {
    phase: "Phase 2",
    sprint: "Sprint 2",
    title: "실제 결제완료 주문만 no-send 후보로 재계산",
    status: "재실행 완료",
    progress: 40,
    tone: "hold",
    why: "Google Ads에 보낼 수 있는 구매 신호는 실제 결제완료 주문이어야 하고, 클릭 ID와 중복 방지 키가 있어야 합니다. 전송 전 후보 품질을 외부 영향 없이 고정합니다.",
    cadence: "click id 보존 개선 후 1회 재실행합니다. 보존률이 10% 미만이면 매일 반복하지 않고 유실 지점 수정을 먼저 합니다.",
    steps: [
      "운영 결제완료 dry-run 후보를 Google Ads offline conversion payload preview로 변환합니다.",
      "missing_google_click_id, missing_attribution_vm_evidence, already_in_ga4, NPay intent ambiguity를 block reason으로 분리합니다.",
      "send_candidate는 승인 전 0건으로 유지하고, 후보 품질만 측정합니다.",
    ],
    success: "click id 보존률이 95%에 가까워지고, missing_google_click_id가 큰 폭으로 줄며, structurally eligible 후보가 생깁니다.",
    currentResult: "2026-05-21 no-send 재실행: 결제완료 후보 623건, click id 보존 5건, missing_google_click_id 618건, send_candidate 0건입니다.",
    nextDecision: "URL/receiver 보강으로 신규 클릭-주문 연결이 개선된 뒤 다시 실행합니다.",
    owner: "Codex",
    evidence: "data/google-ads-confirmed-purchase-candidate-prep-20260521.json",
  },
] as const;

const keyResults = [
  {
    id: "KR1",
    title: "광고 클릭 ID가 주문까지 보존된다",
    targetPct: 95,
    currentPct: 75,
    status: "운영화 판단 전",
    owner: "TJ + Codex",
    actionPlan: "신규 클릭 row 확인, 유실 지점 진단, receiver 보존 정책 정리를 순서대로 끝냅니다.",
    conditions: [
      "랜딩 시점: gclid, gbraid, wbraid 중 하나가 raw URL과 구조화 필드에 남아야 합니다.",
      "중간 이동: checkout_start와 payment_success 사이에서 click id가 세션/first-party evidence로 이어져야 합니다.",
      "주문 연결: 결제완료 order_code 또는 channel_order_no와 click evidence가 같은 원장 row로 묶여야 합니다.",
      "품질 기준: 최근 7일 결제완료 주문 기준 보존률 95%에 근접하고 중복 저장이 없어야 합니다.",
    ],
    why: "광고 클릭 ID가 주문 완료 시점까지 남아야 Google 광고비와 실제 결제완료 주문을 같은 고객 여정으로 묶을 수 있습니다. 24h canary로 유실, 중복, 서버 부담을 먼저 확인해야 잘못된 클릭 증거를 정식 원장에 쌓지 않습니다.",
    evidence: "2026-05-21 실클릭 canary: site_landing/attribution 보존 PASS, paid_click_intent exact row MISS",
    tone: "normal",
  },
  {
    id: "KR2",
    title: "Google ROAS gap을 원인별로 설명한다",
    targetPct: 85,
    currentPct: 68,
    status: "보고서 화면화",
    owner: "Codex",
    actionPlan: "last_7d는 클릭 smoke 때, last_30d는 하루 1회만 재조회하고 gap 원인을 platform value, 내부 confirmed, NPay actual, campaign coverage로 나눕니다.",
    conditions: [
      "예산 판단값: 내부 confirmed ROAS와 NPay actual 보정값이 같은 화면에 표시되어야 합니다.",
      "참고값: Google platform ROAS는 플랫폼 주장값으로 별도 표시되어야 합니다.",
      "캠페인 판단: campaign id coverage와 unknownCampaignOrders가 함께 보여야 합니다.",
      "운영 기준: gap이 왜 생겼는지 NPay, click id, campaign id, GA4 누락 중 어디인지 설명되어야 합니다.",
    ],
    why: "Google Ads ROAS가 높아 보이는 이유가 실제 광고 효율인지, NPay 전환값 과대계상인지, 내부 매출 누락인지 분리해야 예산 증액 판단을 할 수 있습니다. 원인을 나누지 않으면 ROAS 숫자는 커도 어느 캠페인을 키울지 결정할 수 없습니다.",
    evidence: "최근 7일 Google platform ROAS 7.93x, 내부 confirmed ROAS 0.27x, campaignIdCoverage 58%",
    tone: "normal",
  },
  {
    id: "KR3",
    title: "실제 결제완료 전환 후보가 no-send로 검증된다",
    targetPct: 60,
    currentPct: 35,
    status: "A급 후보 확인",
    owner: "Codex",
    actionPlan: "NPay A급 match 13건을 영구 exact evidence snapshot으로 고정하고, 그 뒤 observed conversion payload preview로 넘어갑니다.",
    conditions: [
      "후보 정의: 홈페이지와 NPay 실제 결제완료 주문만 포함해야 합니다.",
      "연결 근거: 각 후보에 gclid/gbraid/wbraid 또는 Google Ads가 인정할 click id가 있어야 합니다.",
      "중복 방지: order_id, 결제완료 시각, 금액 기반 dedupe key가 안정적이어야 합니다.",
      "영구 evidence: matcher version, 기준 window, GA4 guard status, block reason이 append-only snapshot에 남아야 합니다.",
      "전송 전제: conversion action 생성, upload 승인, consent 정책 확인 전 send_candidate는 0건이어야 합니다.",
    ],
    why: "실제 결제완료 주문만 Google Ads에 보낼 후보로 삼으려면 주문마다 click id, 주문 연결, GA4 중복 방지 근거가 있어야 합니다. A급 후보가 생겼더라도 영구 장부에 고정되기 전에는 운영 기준 전환으로 쓰면 안 됩니다.",
    evidence: "2026-05-23 matcher: A급 13건, GA4 present 0 / robust_absent 26, 영구 snapshot 0건",
    tone: "warn",
  },
  {
    id: "KR4",
    title: "Google Ads 전환 변경은 승인 전 0건으로 막힌다",
    targetPct: 100,
    currentPct: 100,
    status: "금지선 유지",
    owner: "TJ + Codex",
    actionPlan: "BI confirmed_purchase 병행 관측, upload dry-run, Google Ads UI 승인 전까지 실제 전송과 Primary 변경을 하지 않습니다.",
    conditions: [
      "플랫폼 영향 0: Google Ads conversion upload는 실행하지 않습니다.",
      "입찰 학습 영향 0: Primary 전환 설정을 바꾸지 않습니다.",
      "운영 데이터 영향 0: 운영DB write/import 없이 read-only와 로컬 문서화만 합니다.",
      "승인 조건: 7일 이상 안정 관측, click id 보존률 개선, 후보 dedupe 검증, TJ님 명시 승인까지 필요합니다.",
    ],
    why: "conversion upload와 Primary 전환 변경은 Google 자동입찰 학습과 운영 화면 숫자를 직접 바꿉니다. 검증 전 실행하면 Google이 실제 구매가 아니라 오염된 NPay 클릭/결제시작 신호를 좋은 고객으로 학습할 수 있어, 승인 전 0건 유지가 손실 방지 장치입니다.",
    evidence: "GDN harness: upload candidate 0건 유지",
    tone: "hold",
  },
] as const;

const evidenceRows = [
  {
    decision: "예산 판단값",
    use: "내부 confirmed ROAS를 우선 본다",
    source: "VM Cloud attribution ledger + 운영DB NPay actual snapshot",
    caveat: "NPay 실제 결제완료는 포함하지만, NPay 클릭과 결제 시작 count는 구매가 아니다.",
  },
  {
    decision: "참고값",
    use: "Google platform ROAS는 단독 증액 근거로 쓰지 않는다",
    source: "Google Ads API customer 2149990943",
    caveat: "최근 데이터에서도 primary known NPay value가 platform value의 거의 전부를 차지한다.",
  },
  {
    decision: "전송 후보",
    use: "현재 upload 후보는 0건으로 둔다",
    source: "confirmed_purchase no-send prep + GDN harness rules",
    caveat: "Google Ads conversion upload, 전환 액션 변경, 캠페인 예산 변경은 모두 TJ님 명시 승인 전 금지다.",
  },
  {
    decision: "캠페인별 판단",
    use: "campaign id coverage가 닫힌 행만 안전하게 본다",
    source: "Google Ads campaign metrics + 내부 order evidence",
    caveat: "UTM hint만으로 캠페인별 ROAS를 확정하지 않는다.",
  },
];

const confirmationRequests = [
  {
    title: "Google Ads URL 추적 파라미터 보강 승인",
    status: "24시간 smoke 후 판단",
    owner: "TJ님",
    when: "2026-05-21 23:55 KST까지 신규 Google 클릭에서도 gad_campaignid가 0건이면 필요합니다.",
    why: "현재 backend는 gad_campaignid를 받을 준비가 됐지만, Google Ads URL 설정에서 campaign id를 붙이지 않으면 운영 원장에 저장할 값이 없습니다.",
    screen: "Google Ads UI > 계정 또는 캠페인 URL 옵션 > 최종 URL suffix 또는 추적 템플릿",
    effect: "`gad_campaignid={campaignid}` 또는 동등한 campaign id ValueTrack 파라미터를 붙여 신규 클릭부터 캠페인 번호를 남깁니다. Google 안내상 추적 템플릿 변경은 광고 게재 반영까지 24~48시간이 걸릴 수 있습니다.",
    success: "신규 클릭 row에서 gclid/gbraid/wbraid와 gad_campaignid가 함께 보존됩니다.",
    fallback: "테스트 URL에서 치환이 안 되면 account level이 아니라 campaign/ad group level로 범위를 좁혀 적용합니다.",
  },
  {
    title: "ROAS 재계산 기준점 승격 컨펌",
    status: "증거 확인 후",
    owner: "TJ님 + Codex",
    when: "gad_campaignid 신규 보존이 확인되고 최소 24시간 동안 중복/5xx/메모리 문제가 없을 때입니다.",
    why: "오늘 작업일은 후보 기준점입니다. 실제로 추적이 가능해진 시점부터만 이후 ROAS를 비교해야 전후 효과가 섞이지 않습니다.",
    screen: "/ads/google-roas-report의 캠페인 ID 매칭률 카드와 VM Cloud read-only row evidence",
    effect: "그 시각 이후 주문부터 campaign id 기반 내부 ROAS 재계산 대상으로 삼습니다.",
    success: "effectiveFromKst가 채워지고, campaignIdCoverage가 신규 주문에서 상승합니다.",
    fallback: "신규 주문 표본이 부족하면 클릭 row 기준으로 먼저 기준점을 열고 주문 표본은 7일 관측합니다.",
  },
  {
    title: "Google Ads 실제 전환 전송 승인 보류",
    status: "아직 승인 대상 아님",
    owner: "TJ님",
    when: "click id 보존률이 충분히 올라가고 no-send prep에서 structurally eligible 후보가 생긴 뒤입니다.",
    why: "현재 no-send 재실행 결과는 결제완료 후보 623건 중 click id 보존 5건뿐이라, 지금 전송하면 대부분의 실제 주문을 Google Ads가 받을 수 없습니다.",
    screen: "향후 conversion action 설정 화면과 upload dry-run 결과 문서",
    effect: "승인 전까지 Google Ads 학습값과 운영 전환값은 바꾸지 않습니다.",
    success: "send_candidate는 계속 0건이고, 후보 품질만 개선됩니다.",
    fallback: "보존률 개선 전에는 전송 설계보다 유실 지점 수정이 우선입니다.",
  },
] as const;

const activeReadOnlyWork = [
  {
    title: "신규 클릭 row 재조회",
    items: [
      "T+2시간과 T+24시간에만 VM Cloud read-only SQL과 dashboard API를 재조회합니다.",
      "목적은 단순 모니터링이 아니라 `gad_campaignid=0` 문제가 Google Ads URL 설정 문제인지 확정하는 것입니다.",
      "성공 기준은 신규 Google 클릭 1건 이상에서 click id와 campaign id가 동시에 남는 것입니다.",
    ],
  },
  {
    title: "unknown campaign order dry-run",
    items: [
      "이미 1차 실행했고, last_7d 기준 campaignIdCoverage 58%, unknownCampaignOrders 10건을 확인했습니다.",
      "다음 재실행은 gad_campaignid 신규 수집이 확인된 뒤 1회만 합니다.",
      "목표는 unknown 주문의 매출 우선순위를 보고, 85% 이상 신뢰 가능한 캠페인 연결만 ROAS 후보로 올리는 것입니다.",
    ],
  },
  {
    title: "confirmed_purchase no-send 재실행",
    items: [
      "오늘 재실행 결과는 623건 중 click id 5건, send_candidate 0건입니다.",
      "다음 재실행은 click id 보존 구조가 개선된 뒤 진행합니다.",
      "목표는 missing_google_click_id 618건을 줄여, 실제 결제완료 주문을 Google Ads가 받을 수 있는 후보로 만드는 것입니다.",
    ],
  },
] as const;

const exactEvidenceReadiness = {
  checkedAtKst: "2026-05-23 21:50 KST",
  source: "VM Cloud SQLite read-only matcher + 운영DB 주문 read-only + GA4 BigQuery robust guard",
  window: "2026-05-16부터 2026-05-23까지",
  statusLabel: "영구 반영 전",
  statusTone: "hold",
  plainDecision:
    "실제 NPay 결제완료 주문과 Google 클릭 의도가 붙는 강한 후보는 생겼습니다. 하지만 아직 내부 장부에 영구 evidence로 고정하지 않았기 때문에 Google Ads 전송이나 Primary 전환 판단에는 쓰지 않습니다.",
  npayIntentRows: 340,
  npayConfirmedOrders: 25,
  strongMatch: 19,
  gradeAMatch: 13,
  gradeBMatch: 6,
  ambiguous: 6,
  clickedNoPurchase: 296,
  gradeAAmountKrw: 1956900,
  ga4CheckedIds: 26,
  ga4Present: 0,
  ga4RobustAbsent: 26,
  permanentSnapshotRows: 0,
  uploadCandidateCount: 0,
  nextAction:
    "다음 단계는 A급 13건만 append-only exact evidence snapshot으로 남기는 것입니다. 이 작업은 VM Cloud schema/write라 TJ님 승인 전 실행하지 않습니다.",
  interpretationSteps: [
    {
      label: "클릭",
      state: "Google 클릭은 들어오고 있음",
      detail: "clicked no purchase 296건 중 다수는 gclid+fbp 조합입니다. 클릭 유입 자체는 존재합니다.",
    },
    {
      label: "결제 완료",
      state: "NPay 실제 결제완료 주문이 있음",
      detail: "7일 기준 NPay 실제 결제완료 주문 25건이 확인됐습니다. NPay actual은 실제 매출로 포함해야 합니다.",
    },
    {
      label: "주문 연결",
      state: "A급 exact 후보 13건",
      detail: "임시 matcher 기준으로 강한 후보 13건, 금액 1,956,900원이 잡혔습니다. B급 6건과 ambiguous 6건은 보류합니다.",
    },
    {
      label: "중복 방지",
      state: "GA4 중복 흔적 없음",
      detail: "주문 ID 후보 26개를 GA4 raw에서 조회했고 present 0, robust_absent 26입니다.",
    },
    {
      label: "운영 반영",
      state: "아직 장부 고정 전",
      detail: "영구 snapshot row는 0건입니다. 승인 전 Google Ads upload 후보도 0건으로 유지합니다.",
    },
  ],
} as const;

const postPatchClickIdHealth = {
  checkedAtKst: "2026-05-24 13:09 KST",
  patchStartedAtKst: "2026-05-21 21:15 KST",
  source: "VM Cloud SQLite + 운영DB tb_iamweb_users read-only",
  confidence: "클릭 row 수집은 높음, payment_success confirmed 직접 보존은 0건입니다. same GA session 후보는 upload 후보가 아니라 진단용으로만 봅니다.",
  clickStage: {
    siteLanding: {
      label: "고객 유입 장부",
      googleClickIdRows: 2865,
      gadCampaignIdRows: 2759,
      gadSourceRows: 2759,
      gclidRows: 2863,
      gbraidRows: 152,
      wbraidRows: 2,
      coverageRate: 0.9630,
      why: "광고 클릭 직후 URL 파라미터가 사이트 첫 진입에서 사라지지 않는지 확인합니다.",
    },
    paidClickIntent: {
      label: "유료 클릭 의도 장부",
      googleClickIdRows: 2935,
      gadCampaignIdRows: 2909,
      gadSourceRows: 2909,
      gclidRows: 2933,
      gbraidRows: 1,
      wbraidRows: 1,
      coverageRate: 0.9911,
      why: "GTM/아임웹 태그가 클릭 직후 허용 파라미터를 저장했는지 확인합니다.",
    },
    attributionLedger: {
      label: "결제완료 장부",
      googleClickIdEvidenceRows: 0,
      gadCampaignIdRows: 0,
      confirmedPaymentSuccessRows: 141,
      confirmedRowsWithGadCampaignId: 0,
      why: "실제 결제완료 신호에 click id가 직접 남는지 확인합니다. 여기서 0이면 Google Ads upload 후보가 아닙니다.",
    },
  },
  orderStage: {
    orderCount: 141,
    totalValueKrw: null,
    withGoogleClickId: 0,
    missingGoogleClickId: 141,
    preservationRate: 0,
    priorSameGaSessionRows: 1,
    strictSameSessionAndClientRows: 0,
    invalidAfterSameClientRows: 1,
    uploadCandidateCount: 0,
    clickIdBreakdown: { gclid: 0, gbraid: 0, wbraid: 0 },
    evidenceCounts: {
      ledgerEvidence: 107,
      intentEvidence: 0,
      missingAttributionVmEvidence: 34,
    },
    paymentMethodBreakdown: [
      { paymentMethod: "homepage" as const, orders: 138, withGoogleClickId: 0, preservationRate: 0 },
      { paymentMethod: "npay" as const, orders: 3, withGoogleClickId: 0, preservationRate: 0 },
    ],
  },
  evidenceGrades: [
    {
      grade: "A",
      label: "직접 보존",
      count: 0,
      description: "confirmed 결제완료 row에 gclid/gbraid/wbraid가 직접 남은 경우입니다. Google Ads upload 가능 후보의 최소 출발점입니다.",
      upload: "가능 후보",
    },
    {
      grade: "B",
      label: "같은 GA 세션 + 같은 client id",
      count: 0,
      description: "결제 전 click과 결제완료가 같은 GA 세션과 client id로 동시에 붙은 경우입니다. 내부 분석용 강한 후보지만 upload는 보류합니다.",
      upload: "보류",
    },
    {
      grade: "C",
      label: "같은 GA 세션만 일치",
      count: 1,
      description: "결제 1.3분 전 같은 GA 세션에서 gclid가 보인 경우입니다. client id 엄격 일치가 없어 원인 진단용으로만 씁니다.",
      upload: "불가",
    },
  ],
  decision:
    "5월 21일 밤 보강 이후 클릭 단계는 정상화됐지만, confirmed 결제완료 직접 보존률은 아직 0%입니다. 같은 GA 세션 후보 1건은 원인 진단에는 쓰되 Google Ads upload 후보로 승격하지 않습니다.",
} as const;

const googlePurchaseClaimAudit = {
  checkedAtKst: "2026-05-24 KST",
  googleAdsAction: {
    actionId: "7130249515",
    actionName: "구매완료",
    simpleName: "Google Ads 주장 구매",
    primaryMeaning: "Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호",
    sendTo: "AW-304339096/r0vuCKvy-8caEJixj5EB",
    type: "WEBPAGE / WEBPAGE_ONCLICK",
    category: "PURCHASE",
  },
  siteEvidence: [
    {
      label: "아임웹 live HTML",
      finding:
        "상품 상세 페이지 HTML에 `GOOGLE_ADWORDS_TRACE.setUseNpayCount(true, ...)`가 있고, 이 값이 Google Ads `구매완료` send_to 라벨과 일치합니다.",
    },
    {
      label: "GTM live v145",
      finding:
        "GTM live에는 `r0vu...` Primary 라벨 태그가 아니라, NPay 링크 클릭용 `TechSol - [GAds]NPAY구매` Secondary 태그와 NPay/GA4 관련 태그가 보입니다.",
    },
    {
      label: "운영 원장",
      finding:
        "2026-05-21 21:15 KST 보강 이후 confirmed 결제완료 114건 중 Google click id가 직접 남은 주문은 0건입니다.",
    },
  ],
  decision:
    "`구매완료`라는 이름만 보고 실제 구매로 읽으면 안 됩니다. 현재 보고서에서는 Google Ads 주장 구매로 분리하고, 내부 실제 결제완료와 따로 비교합니다.",
  confirmedOnlyPlan:
    "기존 `구매완료` Primary는 바로 건드리지 않고, 실제 결제완료 주문만 후보로 세는 no-send dry-run 통로를 계속 준비합니다.",
} as const;

const fallbackConversionActionSegments: Record<DatePreset, NonNullable<GoogleAdsDashboardResponse["conversionActionSegments"]>> = {
  last_7d: {
    summary: {
      primaryConversionValue: 35268162.06,
      allConversionValue: 70877550.13,
      platformMinusInternalConfirmed: 35268162.06,
      primaryKnownNpayConversionValue: 35268160.06,
      primaryKnownNpayShareOfPlatform: 1,
      allConversionValueMinusInternalConfirmed: 70877550.13,
      knownNpayAllOnlyConversionValue: 35601091.99,
      nonPurchasePrimaryConversionValue: 2,
      gapAfterRemovingKnownNpayPrimary: 2,
    },
    actions: [
      {
        conversionActionId: "7130249515",
        conversionActionName: "구매완료",
        conversions: 228.45,
        conversionValue: 35268160.06,
        allConversions: 229.45,
        allConversionValue: 35513160.06,
        viewThroughConversions: 1,
        status: "ENABLED",
        category: "PURCHASE",
        primaryForGoal: true,
        countingType: "MANY_PER_CLICK",
        classification: "primary_known_npay",
        riskFlags: ["known_npay_label", "primary_bid_signal_is_npay"],
        campaignCount: 4,
        shareOfPlatformConversionValue: 1,
      },
      {
        conversionActionId: "995043268",
        conversionActionName: "[G4] biocom.kr (web) sign_up",
        conversions: 2,
        conversionValue: 2,
        allConversions: 3,
        allConversionValue: 3,
        viewThroughConversions: 0,
        status: "ENABLED",
        category: "SIGNUP",
        primaryForGoal: true,
        countingType: "UNKNOWN",
        classification: "non_revenue_action",
        riskFlags: ["non_revenue_primary_value"],
        campaignCount: 2,
        shareOfPlatformConversionValue: 0,
      },
    ],
    gapDrivers: [],
  },
  last_30d: {
    summary: {
      primaryConversionValue: 219547012.62,
      allConversionValue: 423132609.16,
      platformMinusInternalConfirmed: 218218012.62,
      primaryKnownNpayConversionValue: 219546992.2,
      primaryKnownNpayShareOfPlatform: 1,
      allConversionValueMinusInternalConfirmed: 421803609.16,
      knownNpayAllOnlyConversionValue: 203541536.49,
      nonPurchasePrimaryConversionValue: 20.42,
      gapAfterRemovingKnownNpayPrimary: -1328979.58,
    },
    actions: [
      {
        conversionActionId: "7130249515",
        conversionActionName: "구매완료",
        conversions: 2105.34,
        conversionValue: 219546992.2,
        allConversions: 2119.34,
        allConversionValue: 222397999.2,
        viewThroughConversions: 15,
        status: "ENABLED",
        category: "PURCHASE",
        primaryForGoal: true,
        countingType: "UNKNOWN",
        classification: "primary_known_npay",
        riskFlags: ["known_npay_label", "primary_bid_signal_is_npay"],
        campaignCount: 6,
        shareOfPlatformConversionValue: 1,
      },
      {
        conversionActionId: "7564830949",
        conversionActionName: "TechSol - NPAY구매 50739",
        conversions: 0,
        conversionValue: 0,
        allConversions: 1942.93,
        allConversionValue: 200690529.49,
        viewThroughConversions: 0,
        status: "ENABLED",
        category: "PURCHASE",
        primaryForGoal: false,
        countingType: "UNKNOWN",
        classification: "secondary_known_npay",
        riskFlags: ["known_npay_label", "all_conversions_only_value"],
        campaignCount: 6,
        shareOfPlatformConversionValue: 0,
      },
    ],
    gapDrivers: [],
  },
};

const formatKrw = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value);
  const eok = Math.floor(rounded / 100000000);
  const man = Math.floor((rounded % 100000000) / 10000);
  if (eok > 0 && man > 0) return `₩${eok}억 ${man.toLocaleString("ko-KR")}만`;
  if (eok > 0) return `₩${eok}억`;
  if (man > 0) return `₩${man.toLocaleString("ko-KR")}만`;
  return `₩${rounded.toLocaleString("ko-KR")}`;
};

const formatRoas = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}x` : "-";

const formatPct = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "-";

const formatRatePct = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "-";

const formatCount = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("ko-KR") : "-";

const paymentMethodLabel = (value: "homepage" | "npay" | "unknown") => {
  if (value === "homepage") return "자사몰";
  if (value === "npay") return "NPay";
  return "미분류";
};

const conversionClassificationLabel = (value: string) => {
  if (value === "primary_known_npay") return "Primary NPay 의심";
  if (value === "secondary_known_npay") return "Secondary NPay";
  if (value === "primary_purchase") return "Primary 구매";
  if (value === "secondary_purchase") return "Secondary 구매";
  if (value === "non_revenue_action") return "비매출 행동";
  if (value === "other_primary") return "기타 Primary";
  return "기타 Secondary";
};

const riskFlagLabel = (value: string) => {
  if (value === "known_npay_label") return "NPay label";
  if (value === "primary_bid_signal_is_npay") return "입찰 학습 신호";
  if (value === "all_conversions_only_value") return "All conv. 전용";
  if (value === "non_revenue_primary_value") return "비매출 Primary";
  return value;
};

const campaignMatchStatusLabel = (status: GoogleCampaignMatchHealth["summary"]["status"]) => {
  if (status === "campaign_id_collecting") return "수집 확인";
  if (status === "allowlist_deployed_waiting_new_click") return "신규 row 대기";
  if (status === "needs_allowlist_deploy") return "배포 필요";
  if (status === "no_google_click_id_rows") return "표본 없음";
  return "원장 없음";
};

const campaignMatchStatusClass = (status: GoogleCampaignMatchHealth["summary"]["status"]) => {
  if (status === "campaign_id_collecting") return styles.status;
  if (status === "allowlist_deployed_waiting_new_click") return `${styles.status} ${styles.statusWarn}`;
  if (status === "needs_allowlist_deploy") return `${styles.status} ${styles.statusWarn}`;
  return `${styles.status} ${styles.statusHold}`;
};

const roleStatusClass = (status: string) => {
  if (status === "usable_for_budget_review" || status === "usable_for_order_join" || status === "monitoring") {
    return styles.status;
  }
  if (status === "collecting" || status === "needs_exact_click_diagnosis") {
    return `${styles.status} ${styles.statusWarn}`;
  }
  return `${styles.status} ${styles.statusHold}`;
};

const roleStatusLabel = (status: string) => {
  if (status === "usable_for_budget_review") return "예산 판단 가능";
  if (status === "usable_for_order_join") return "주문 연결 가능";
  if (status === "monitoring") return "태그 관찰 정상";
  if (status === "needs_exact_click_diagnosis") return "exact-click 진단 필요";
  if (status === "collecting") return "더 쌓는 중";
  return "사용 보류";
};

const campaignHealthSplitCards = (health: GoogleCampaignMatchHealth) => {
  const roasAttribution = health.healthSplit?.roasAttribution ?? {
    source: "site_landing_ledger_and_attribution_ledger" as const,
    status: health.siteLanding.gadCampaignIdRows > 0 ? "usable_for_budget_review" as const : "collecting" as const,
    rows: health.siteLanding.rows,
    googleClickIdRows: health.siteLanding.googleClickIdRows,
    gadCampaignIdRows: health.siteLanding.gadCampaignIdRows,
    currentCampaignIdCoverageRate: health.siteLanding.currentCampaignIdCoverageRate,
    latestAt: health.siteLanding.latestAt,
    interpretation:
      "예산 판단용 내부 ROAS는 고객 유입 원장과 주문 원장을 우선 기준으로 봅니다. paid-click-intent 태그 원장과 섞지 않습니다.",
  };
  const orderAttribution = health.healthSplit?.orderAttribution ?? {
    source: "attribution_ledger" as const,
    status: health.attributionLedger.confirmedRowsWithGadCampaignId > 0 ? "usable_for_order_join" as const : "collecting" as const,
    rows: health.attributionLedger.rows,
    googleClickIdEvidenceRows: health.attributionLedger.googleClickIdEvidenceRows,
    confirmedPaymentSuccessRows: health.attributionLedger.confirmedPaymentSuccessRows,
    confirmedRowsWithGadCampaignId: health.attributionLedger.confirmedRowsWithGadCampaignId,
    latestAt: health.attributionLedger.latestAt,
    interpretation:
      "결제완료 주문까지 이어진 evidence입니다. 플랫폼 전송 후보가 아니라 내부 ROAS 재계산의 주문 연결 근거입니다.",
  };
  const paidClickIntentTag = health.healthSplit?.paidClickIntentTag ?? {
    source: "paid_click_intent_ledger" as const,
    status: health.paidClickIntent.gadCampaignIdRows < health.siteLanding.gadCampaignIdRows
      ? "needs_exact_click_diagnosis" as const
      : "monitoring" as const,
    rows: health.paidClickIntent.rows,
    googleClickIdRows: health.paidClickIntent.googleClickIdRows,
    gadCampaignIdRows: health.paidClickIntent.gadCampaignIdRows,
    currentCampaignIdCoverageRate: health.paidClickIntent.currentCampaignIdCoverageRate,
    latestAt: health.paidClickIntent.latestAt,
    interpretation:
      "GTM paid-click-intent 태그가 최소 click evidence를 남기는지 보는 보조 헬스입니다. 예산 판단용 ROAS 정본으로 쓰지 않습니다.",
  };

  return [
    {
      key: "roas",
      title: "예산 판단용 헬스",
      subtitle: "고객 유입 원장 + 주문 원장",
      status: roasAttribution.status,
      rate: roasAttribution.currentCampaignIdCoverageRate,
      primary: roasAttribution.gadCampaignIdRows,
      secondary: roasAttribution.googleClickIdRows,
      primaryLabel: "campaign id 보존",
      secondaryLabel: "Google click id",
      latestAt: roasAttribution.latestAt,
      interpretation: roasAttribution.interpretation,
      source: roasAttribution.source,
    },
    {
      key: "order",
      title: "주문 연결 헬스",
      subtitle: "결제완료 기준 attribution",
      status: orderAttribution.status,
      rate: orderAttribution.confirmedPaymentSuccessRows > 0
        ? orderAttribution.confirmedRowsWithGadCampaignId / orderAttribution.confirmedPaymentSuccessRows
        : null,
      primary: orderAttribution.confirmedRowsWithGadCampaignId,
      secondary: orderAttribution.confirmedPaymentSuccessRows,
      primaryLabel: "결제완료 campaign id",
      secondaryLabel: "결제완료 row",
      latestAt: orderAttribution.latestAt,
      interpretation: orderAttribution.interpretation,
      source: orderAttribution.source,
    },
    {
      key: "tag",
      title: "태그 진단용 헬스",
      subtitle: "paid_click_intent_ledger",
      status: paidClickIntentTag.status,
      rate: paidClickIntentTag.currentCampaignIdCoverageRate,
      primary: paidClickIntentTag.gadCampaignIdRows,
      secondary: paidClickIntentTag.googleClickIdRows,
      primaryLabel: "campaign id 보존",
      secondaryLabel: "Google click id",
      latestAt: paidClickIntentTag.latestAt,
      interpretation: paidClickIntentTag.interpretation,
      source: paidClickIntentTag.source,
    },
  ];
};

const formatFetchedAt = (value: string | undefined) => {
  if (!value) return "문서 기준";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const shouldUseCampaignMatchFallback = (health: GoogleCampaignMatchHealth | undefined) => {
  if (!health) return true;
  const isLocalApi = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");
  const totalLedgerRows =
    health.siteLanding.rows
    + health.paidClickIntent.rows
    + health.attributionLedger.rows;
  return isLocalApi && totalLedgerRows === 0;
};

function makeSnapshot(preset: DatePreset, response: GoogleAdsDashboardResponse | null, error: string | null): Snapshot {
  return {
    preset,
    label: preset === "last_7d" ? "최근 7일" : "최근 30일",
    response,
    error,
  };
}

const shouldUseClickIdHealthFallback = (health?: GoogleAdsDashboardResponse["clickIdHealth"]) => {
  if (!health) return true;
  const isLocalBackend = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");

  /*
    Local backend can have the operational order denominator without the VM Cloud
    SQLite evidence rows. In that case it returns a false 0% card while the public
    VM Cloud dashboard has current evidence. Use the verified VM Cloud snapshot
    only for that local evidence-gap shape.
  */
  return Boolean(
    isLocalBackend
      && health.orderCount > 0
      && health.withGoogleClickId === 0
      && health.blockReasonCounts.missingAttributionVmEvidence >= health.orderCount,
  );
};

function snapshotMetrics(snapshot: Snapshot) {
  const fallback = fallbackSnapshots[snapshot.preset];
  const response = snapshot.response;
  const googleCampaignMatchHealth = shouldUseCampaignMatchFallback(response?.googleCampaignMatchHealth)
    ? fallbackCampaignMatchHealth[snapshot.preset]
    : response?.googleCampaignMatchHealth ?? fallbackCampaignMatchHealth[snapshot.preset];
  const useClickIdFallback = shouldUseClickIdHealthFallback(response?.clickIdHealth);
  return {
    label: snapshot.label,
    fetchedAt: response?.fetchedAt,
    platformRoas: response?.summary.roas ?? fallback.platformRoas,
    internalRoas: response?.internal?.summary.internalConfirmedRoas ?? fallback.internalRoas,
    internalWithNpayRoas: response?.npayActualCorrection?.internalConfirmedRoasWithNpayActualPg ?? fallback.internalWithNpayRoas,
    cost: response?.summary.cost ?? fallback.cost,
    platformValue: response?.summary.conversionValue ?? fallback.platformValue,
    internalRevenue: response?.internal?.summary.confirmedRevenue ?? fallback.internalRevenue,
    npayRevenue: response?.npayActualCorrection?.npayActualConfirmedPgRevenueKrw ?? fallback.npayRevenue,
    npayCount: response?.npayActualCorrection?.npayActualConfirmedPgCount,
    uploadCandidateCount: response?.npayActualCorrection?.uploadCandidateCount ?? 0,
    nPayShare: response?.conversionActionSegments?.summary.primaryKnownNpayShareOfPlatform ?? 1,
    conversionActionSegments: response?.conversionActionSegments ?? fallbackConversionActionSegments[snapshot.preset],
    campaignCoverage: response?.internal?.summary.campaignIdCoverage,
    unknownCampaignOrders: response?.internal?.summary.unknownCampaignOrders,
    source: response ? "VM Cloud live API" : fallback.source,
    clickIdHealth: response?.clickIdHealth && !useClickIdFallback
      ? {
          generatedAt: response.clickIdHealth.generatedAt,
          orderCount: response.clickIdHealth.orderCount,
          withGoogleClickId: response.clickIdHealth.withGoogleClickId,
          missingGoogleClickId: response.clickIdHealth.missingGoogleClickId,
          preservationRate: response.clickIdHealth.preservationRate ?? 0,
          uploadCandidateCount: response.clickIdHealth.uploadCandidateCount,
          source: "VM Cloud live API",
          blockReasonCounts: {
            missingAttributionVmEvidence: response.clickIdHealth.blockReasonCounts.missingAttributionVmEvidence,
          },
          paymentMethodBreakdown: response.clickIdHealth.paymentMethodBreakdown.map((row) => ({
            paymentMethod: row.paymentMethod,
            orders: row.orders,
            withGoogleClickId: row.withGoogleClickId,
            missingGoogleClickId: row.missingGoogleClickId,
            preservationRate: row.preservationRate ?? 0,
          })),
          clickIdBreakdown: response.clickIdHealth.clickIdBreakdown,
        }
      : fallback.clickIdHealth,
    googleCampaignMatchHealth,
    error: snapshot.error,
  };
}

export default function GoogleRoasProjectReportPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([
    makeSnapshot("last_7d", null, null),
    makeSnapshot("last_30d", null, null),
  ]);
  const [loading, setLoading] = useState(true);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    const presets: DatePreset[] = ["last_7d", "last_30d"];
    const next = await Promise.all(presets.map(async (preset) => {
      try {
        const response = await fetch(`${API_BASE}/api/google-ads/dashboard?date_preset=${preset}`, { cache: "no-store" });
        const data = await response.json() as GoogleAdsDashboardResponse | { ok?: false; error?: unknown };
        if (!response.ok || !data.ok) {
          throw new Error(JSON.stringify("error" in data ? data.error : data).slice(0, 240));
        }
        return makeSnapshot(preset, data, null);
      } catch (error) {
        return makeSnapshot(preset, null, error instanceof Error ? error.message : "load_failed");
      }
    }));
    setSnapshots(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const metrics = useMemo(() => snapshots.map(snapshotMetrics), [snapshots]);
  const last7 = metrics[0];
  const last30 = metrics[1];
  const maxRoas = Math.max(10, last7.platformRoas, last30.platformRoas, last7.internalWithNpayRoas, last30.internalWithNpayRoas);
  const currentGap = last30.platformRoas - last30.internalWithNpayRoas;
  const exactEvidenceStatusClass = exactEvidenceReadiness.statusTone === "hold"
    ? `${styles.status} ${styles.statusHold}`
    : styles.status;
  const conversionSummary7d = last7.conversionActionSegments.summary;
  const conversionSummary30d = last30.conversionActionSegments.summary;
  const conversionActions7d = last7.conversionActionSegments.actions.slice(0, 6);
  const last7InternalActualRevenue = last7.internalRevenue + last7.npayRevenue;
  const postPatchClickIdCard = {
    label: "5/21 21:15 이후",
    clickIdHealth: {
      generatedAt: postPatchClickIdHealth.checkedAtKst,
      orderCount: postPatchClickIdHealth.orderStage.orderCount,
      withGoogleClickId: postPatchClickIdHealth.orderStage.withGoogleClickId,
      missingGoogleClickId: postPatchClickIdHealth.orderStage.missingGoogleClickId,
      preservationRate: postPatchClickIdHealth.orderStage.preservationRate,
      uploadCandidateCount: postPatchClickIdHealth.orderStage.uploadCandidateCount,
      source: postPatchClickIdHealth.source,
      blockReasonCounts: {
        missingAttributionVmEvidence: postPatchClickIdHealth.orderStage.evidenceCounts.missingAttributionVmEvidence,
      },
      paymentMethodBreakdown: postPatchClickIdHealth.orderStage.paymentMethodBreakdown.map((row) => ({
        paymentMethod: row.paymentMethod,
        orders: row.orders,
        withGoogleClickId: row.withGoogleClickId,
        missingGoogleClickId: row.orders - row.withGoogleClickId,
        preservationRate: row.preservationRate,
      })),
      clickIdBreakdown: postPatchClickIdHealth.orderStage.clickIdBreakdown,
    },
  };
  const clickIdHealthCards = [postPatchClickIdCard, last7, last30];

  return (
    <div className={styles.page}>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.main}>
        <div className={styles.topRow}>
          <div>
            <Link href="/ads/google" className={styles.backLink}>Google Ads 성과 화면으로 돌아가기</Link>
            <p className={styles.eyebrow}>Google ROAS 정합성 프로젝트</p>
            <h1 className={styles.title}>Google Ads 숫자를 실제 결제완료 매출 기준으로 다시 읽습니다</h1>
            <p className={styles.lead}>
              이 화면의 질문은 하나입니다. Google Ads가 보여주는 ROAS를 예산 판단에 그대로 써도 되는가.
              답은 아직 아니오입니다. 플랫폼 주장값, 내부 confirmed 매출, NPay actual 보정, 전송 금지선을 분리해서 봅니다.
            </p>
          </div>
          <div className={styles.actions}>
            <Link href="/ads/google" className={styles.actionLink}>실시간 성과 보기</Link>
            <Link href="/ads/roas" className={styles.actionLink}>ROAS 대시보드</Link>
            <button className={`${styles.refreshButton} ${styles.primaryAction}`} onClick={() => void loadSnapshots()} disabled={loading}>
              {loading ? "조회 중" : "현재값 다시 조회"}
            </button>
          </div>
        </div>

        <section className={styles.decisionBand}>
          <div>
            <p className={styles.decisionLabel}>현재 운영 판단</p>
            <h2>Google Ads ROAS는 아직 참고값입니다. 예산 판단은 내부 결제완료 매출을 기준으로 봅니다.</h2>
            <p>
              Google Ads가 보여주는 큰 ROAS에는 기존 NPay `구매완료` 전환값이 많이 섞여 있습니다.
              NPay 실제 결제완료 매출은 내부 매출에 포함해야 하지만, NPay 클릭이나 결제 시작 count를 구매완료로 보면 안 됩니다.
              지금은 내부 confirmed 매출, NPay actual, click id 보존, exact evidence를 분리해서 판단합니다.
            </p>
          </div>
          <div className={styles.decisionAside}>
            <div className={styles.guardPill}>
              <strong>지금 결론</strong>
              <span>증액 판단은 보류하고, 내부 confirmed + NPay actual ROAS를 기준으로 봅니다.</span>
            </div>
            <div className={styles.guardPill}>
              <strong>진전된 부분</strong>
              <span>A급 exact 후보 13건과 GA4 중복 guard 통과를 확인했습니다. 다음은 영구 evidence 반영입니다.</span>
            </div>
          </div>
        </section>

        <section className={styles.kpiGrid} aria-label="핵심 KPI">
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>최근 7일 Google ROAS</div>
            <div className={styles.kpiValue}>{formatRoas(last7.platformRoas)}</div>
            <div className={styles.kpiSub}>플랫폼 주장값. 내부 confirmed ROAS는 {formatRoas(last7.internalRoas)}입니다.</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>최근 7일 내부 ROAS, NPay actual 포함</div>
            <div className={`${styles.kpiValue} ${styles.good}`}>{formatRoas(last7.internalWithNpayRoas)}</div>
            <div className={styles.kpiSub}>실제 NPay 결제완료 {last7.npayCount ? `${last7.npayCount}건` : ""} {formatKrw(last7.npayRevenue)} 합류 후.</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>최근 30일 gap</div>
            <div className={`${styles.kpiValue} ${currentGap > 4 ? styles.warn : styles.good}`}>{currentGap.toFixed(2)}p</div>
            <div className={styles.kpiSub}>Google {formatRoas(last30.platformRoas)} vs 내부+NPay {formatRoas(last30.internalWithNpayRoas)}.</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Google Ads upload 후보</div>
            <div className={`${styles.kpiValue} ${styles.danger}`}>{last30.uploadCandidateCount}건</div>
            <div className={styles.kpiSub}>명시 승인 전 conversion upload, 전환 액션 변경, 예산 변경은 하지 않습니다.</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.truthSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>“구매완료”라는 이름을 실제 구매와 분리해서 봅니다</h2>
              <p>
                Google Ads 화면의 `구매완료`는 광고 플랫폼이 구매라고 세는 값입니다.
                내부 주문 장부에서 돈이 실제로 결제완료됐다는 뜻과 같지 않아서, 여기서는 이름을 바꿔 읽습니다.
              </p>
            </div>
            <span className={styles.metaText}>source: Google Ads API + GTM live + 아임웹 live HTML · 기준 {googlePurchaseClaimAudit.checkedAtKst}</span>
          </div>

          <div className={styles.truthSplitGrid}>
            <article className={styles.truthCard}>
              <span>Google Ads 주장 구매</span>
              <strong>{formatKrw(conversionSummary7d.primaryConversionValue)}</strong>
              <p>
                최근 7일 Google Ads가 `구매완료`라고 부른 전환값입니다.
                이 값은 예산 판단용 정답이 아니라, 플랫폼이 주장하는 구매 금액으로 따로 둡니다.
              </p>
            </article>
            <article className={styles.truthCard}>
              <span>내부 실제 결제완료</span>
              <strong>{formatKrw(last7InternalActualRevenue)}</strong>
              <p>
                내부 confirmed 매출에 NPay actual 결제완료 보정값을 합쳐 보는 값입니다.
                예산을 실제 매출 기준으로 볼 때 우선 참고할 쪽입니다.
              </p>
            </article>
            <article className={styles.truthCard}>
              <span>Google 증거 있는 실제 결제완료</span>
              <strong className={styles.danger}>
                {formatCount(postPatchClickIdHealth.orderStage.withGoogleClickId)} / {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건
              </strong>
              <p>
                5월 21일 밤 보강 이후 실제 결제완료 주문에 gclid/gbraid/wbraid가 직접 남은 건수입니다.
                0건이므로 Google Ads upload 후보도 0건으로 유지합니다.
              </p>
            </article>
            <article className={styles.truthCard}>
              <span>실제 구매 전환 통로</span>
              <strong>준비 중 · no-send</strong>
              <p>
                기존 Primary를 바로 바꾸지 않고, 실제 결제완료 주문만 따로 모으는 전환 통로를 dry-run으로 준비합니다.
                전송과 Primary 변경은 별도 승인 전까지 하지 않습니다.
              </p>
            </article>
          </div>

          <div className={styles.truthEvidenceBox}>
            <strong>{googlePurchaseClaimAudit.googleAdsAction.actionName} 액션을 지금 이렇게 읽습니다</strong>
            <p>
              Google Ads action {googlePurchaseClaimAudit.googleAdsAction.actionId}는 {googlePurchaseClaimAudit.googleAdsAction.primaryMeaning}입니다.
              send_to 라벨은 {googlePurchaseClaimAudit.googleAdsAction.sendTo}이고, 아임웹 live HTML의 NPay count 코드와 일치합니다.
            </p>
            <div className={styles.truthEvidenceGrid}>
              {googlePurchaseClaimAudit.siteEvidence.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <p>{item.finding}</p>
                </div>
              ))}
            </div>
            <em>{googlePurchaseClaimAudit.decision}</em>
          </div>
        </section>

        <section className={`${styles.section} ${styles.conversionActionSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Google이 무엇을 구매로 세는지 먼저 분해</h2>
              <p>
                Primary 전환은 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호입니다.
                여기서 실제 결제완료가 아닌 NPay 클릭/count 성격이 섞이면 Google ROAS가 내부 매출보다 크게 부풀 수 있습니다.
              </p>
            </div>
            <span className={styles.metaText}>source: Google Ads API live · 기준 {formatFetchedAt(last7.fetchedAt)}</span>
          </div>

          <div className={styles.conversionSummaryGrid}>
            <div className={styles.conversionSummaryCard}>
              <span>최근 7일 Google 주장 구매값</span>
              <strong>{formatKrw(conversionSummary7d.primaryConversionValue)}</strong>
              <p>
                그중 known NPay label 전환값이 {formatKrw(conversionSummary7d.primaryKnownNpayConversionValue)}입니다.
                비중은 {formatPct(conversionSummary7d.primaryKnownNpayShareOfPlatform)}입니다.
              </p>
            </div>
            <div className={styles.conversionSummaryCard}>
              <span>최근 7일 내부 confirmed와의 차이</span>
              <strong className={styles.danger}>{formatKrw(conversionSummary7d.platformMinusInternalConfirmed)}</strong>
              <p>
                같은 기간 실제 결제완료 원장으로 검증된 매출과 Google 주장값의 차이입니다.
                이 차이를 줄이려면 전환 액션 오염과 click id 유실을 따로 봐야 합니다.
              </p>
            </div>
            <div className={styles.conversionSummaryCard}>
              <span>최근 30일 Google 주장 구매값</span>
              <strong>{formatKrw(conversionSummary30d.primaryConversionValue)}</strong>
              <p>
                30일 기준으로도 known NPay label 비중은 {formatPct(conversionSummary30d.primaryKnownNpayShareOfPlatform)}입니다.
                즉 구조적 오염 가능성이 7일 일시 현상으로 보이지 않습니다.
              </p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>전환 액션</th>
                  <th>입찰 사용</th>
                  <th>전환값</th>
                  <th>All conv. 값</th>
                  <th>위험 해석</th>
                </tr>
              </thead>
              <tbody>
                {conversionActions7d.map((action) => (
                  <tr key={`${action.conversionActionId}-${action.conversionActionName}`}>
                    <td>
                      <strong className={styles.conversionActionName}>{action.conversionActionName}</strong>
                      <span>action id {action.conversionActionId ?? "unknown"} · {action.category}</span>
                    </td>
                    <td>
                      <strong>{action.primaryForGoal ? "Primary" : "Secondary"}</strong>
                      <span>{conversionClassificationLabel(action.classification)}</span>
                    </td>
                    <td>
                      <strong>{formatKrw(action.conversionValue)}</strong>
                      <span>{formatCount(action.conversions)} conv.</span>
                    </td>
                    <td>
                      <strong>{formatKrw(action.allConversionValue)}</strong>
                      <span>{formatCount(action.allConversions)} all conv.</span>
                    </td>
                    <td>
                      <div className={styles.riskBadgeList}>
                        {(action.riskFlags.length ? action.riskFlags : ["risk_not_flagged"]).map((flag) => (
                          <span key={flag} className={styles.riskBadge}>{riskFlagLabel(flag)}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.postPatchDecision}>
            현재 가장 큰 갭 원인은 Google Ads의 `구매완료` Primary 전환값 대부분이 known NPay label에서 발생한다는 점입니다.
            NPay 실제 결제완료는 매출로 포함해야 하지만, NPay 클릭/count를 구매완료로 학습시키면 예산 판단 ROAS가 부풀 수 있습니다.
          </p>
        </section>

        <section className={`${styles.section} ${styles.exactEvidenceSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>실제 주문으로 이어진 Google 클릭 증거</h2>
              <p>
                exact evidence는 광고 클릭과 실제 결제완료 주문이 주문 단위로 붙는 증거입니다.
                Google Ads에 실제 구매만 알려주려면 이 증거가 먼저 내부 장부에 고정되어야 합니다.
              </p>
            </div>
            <span className={styles.metaText}>
              source: {exactEvidenceReadiness.source} · 기준 {exactEvidenceReadiness.checkedAtKst}
            </span>
          </div>
          <div className={styles.exactEvidenceGrid}>
            <article className={styles.exactDecisionCard}>
              <div className={styles.requestTop}>
                <span className={exactEvidenceStatusClass}>{exactEvidenceReadiness.statusLabel}</span>
                <span>{exactEvidenceReadiness.window}</span>
              </div>
              <h3>강한 후보는 생겼지만 아직 Google Ads로 보내지 않습니다.</h3>
              <p>{exactEvidenceReadiness.plainDecision}</p>
              <div className={styles.exactMetricGrid}>
                <div>
                  <span>A급 후보</span>
                  <strong>{formatCount(exactEvidenceReadiness.gradeAMatch)}건</strong>
                  <em>{formatKrw(exactEvidenceReadiness.gradeAAmountKrw)}</em>
                </div>
                <div>
                  <span>GA4 중복 발견</span>
                  <strong>{formatCount(exactEvidenceReadiness.ga4Present)}건</strong>
                  <em>present</em>
                </div>
                <div>
                  <span>GA4 중복 없음</span>
                  <strong>{formatCount(exactEvidenceReadiness.ga4RobustAbsent)}개 ID</strong>
                  <em>robust_absent</em>
                </div>
                <div>
                  <span>Google Ads 전송 후보</span>
                  <strong>{formatCount(exactEvidenceReadiness.uploadCandidateCount)}건</strong>
                  <em>승인 전 0 유지</em>
                </div>
              </div>
              <div className={styles.exactNextBox}>
                <strong>다음 액션</strong>
                <span>{exactEvidenceReadiness.nextAction}</span>
              </div>
            </article>
            <article className={styles.exactDetailCard}>
              <h3>왜 “거의 다 된 것”이 아니라 “영구 반영 전”인가</h3>
              <div className={styles.exactFlow}>
                {exactEvidenceReadiness.interpretationSteps.map((step, index) => (
                  <div key={step.label} className={styles.exactFlowStep}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.label}: {step.state}</strong>
                      <p>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
          <div className={styles.exactSummaryRow}>
            <div>
              <span>NPay click intent</span>
              <strong>{formatCount(exactEvidenceReadiness.npayIntentRows)}건</strong>
            </div>
            <div>
              <span>NPay 실제 결제완료</span>
              <strong>{formatCount(exactEvidenceReadiness.npayConfirmedOrders)}건</strong>
            </div>
            <div>
              <span>strong match</span>
              <strong>{formatCount(exactEvidenceReadiness.strongMatch)}건</strong>
            </div>
            <div>
              <span>B급 보류</span>
              <strong>{formatCount(exactEvidenceReadiness.gradeBMatch)}건</strong>
            </div>
            <div>
              <span>ambiguous 보류</span>
              <strong>{formatCount(exactEvidenceReadiness.ambiguous)}건</strong>
            </div>
            <div>
              <span>영구 snapshot</span>
              <strong>{formatCount(exactEvidenceReadiness.permanentSnapshotRows)}건</strong>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.clickHealthSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Google click id 보존률</h2>
              <p>실제 결제완료 주문에 gclid, gbraid, wbraid 중 하나가 남아야 Google Ads에 안전하게 다시 연결할 수 있습니다.</p>
            </div>
            <span className={styles.metaText}>
              source: {last30.clickIdHealth.source} · 기준 {formatFetchedAt(last30.clickIdHealth.generatedAt)}
            </span>
          </div>
          <div className={styles.clickBaselineBanner}>
            <div>
              <span>click id 알고리즘 업데이트 기준일</span>
              <strong>{postPatchClickIdHealth.patchStartedAtKst}</strong>
              <p>
                이 시각에 아임웹 헤더/푸터의 Google click id 보존 로직을 교체했습니다.
                최근 7일/30일 숫자는 보강 전 주문이 섞이므로, 개선 여부는 이 기준일 이후 주문만 따로 봐야 합니다.
              </p>
            </div>
            <div>
              <span>보강 이후 실제 결제완료 주문</span>
              <strong>{formatRatePct(postPatchClickIdHealth.orderStage.preservationRate)}</strong>
              <p>
                {formatCount(postPatchClickIdHealth.orderStage.withGoogleClickId)} / {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건만
                Google click id가 직접 남았습니다. upload 후보는 {formatCount(postPatchClickIdHealth.orderStage.uploadCandidateCount)}건입니다.
              </p>
            </div>
          </div>
          <div className={styles.healthGrid}>
            {clickIdHealthCards.map((item) => (
              <article key={item.label} className={styles.healthCard}>
                <div className={styles.healthTop}>
                  <div>
                    <span className={styles.healthLabel}>{item.label}</span>
                    <strong className={item.clickIdHealth.preservationRate < 0.1 ? styles.danger : styles.good}>
                      {formatRatePct(item.clickIdHealth.preservationRate)}
                    </strong>
                  </div>
                  <span className={`${styles.status} ${item.clickIdHealth.uploadCandidateCount === 0 ? styles.statusHold : styles.statusWarn}`}>
                    upload 후보 {item.clickIdHealth.uploadCandidateCount}건
                  </span>
                </div>
                <p className={styles.healthSummary}>
                  결제완료 {formatCount(item.clickIdHealth.orderCount)}건 중 Google click id 보존 {formatCount(item.clickIdHealth.withGoogleClickId)}건,
                  미보존 {formatCount(item.clickIdHealth.missingGoogleClickId)}건입니다.
                </p>
                <div className={styles.healthStats}>
                  <div>
                    <span>gclid</span>
                    <strong>{formatCount(item.clickIdHealth.clickIdBreakdown.gclid)}</strong>
                  </div>
                  <div>
                    <span>gbraid</span>
                    <strong>{formatCount(item.clickIdHealth.clickIdBreakdown.gbraid)}</strong>
                  </div>
                  <div>
                    <span>wbraid</span>
                    <strong>{formatCount(item.clickIdHealth.clickIdBreakdown.wbraid)}</strong>
                  </div>
                  <div>
                    <span>VM evidence 없음</span>
                    <strong>{formatCount(item.clickIdHealth.blockReasonCounts.missingAttributionVmEvidence)}</strong>
                  </div>
                </div>
                <div className={styles.methodRows}>
                  {item.clickIdHealth.paymentMethodBreakdown.map((row) => (
                    <div key={`${item.label}-${row.paymentMethod}`} className={styles.methodRow}>
                      <span>{paymentMethodLabel(row.paymentMethod)}</span>
                      <strong>{formatRatePct(row.preservationRate)}</strong>
                      <em>{formatCount(row.withGoogleClickId)} / {formatCount(row.orders)}건</em>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <article className={styles.postPatchHealthCard}>
            <div className={styles.postPatchHeader}>
              <div>
                <span>별도 기준점 재계산</span>
                <h3>5월 21일 밤 아임웹 헤더/푸터 보강 이후</h3>
                <p>
                  기준점은 {postPatchClickIdHealth.patchStartedAtKst}입니다. 최근 7일 카드는 보강 전/후가 섞이므로,
                  여기서는 보강 이후 결제완료 주문만 따로 잘라 click id 보존률을 봅니다.
                </p>
              </div>
              <em>{postPatchClickIdHealth.checkedAtKst} · {postPatchClickIdHealth.source}</em>
            </div>

            <div className={styles.postPatchGrid}>
              <div className={styles.postPatchMetric}>
                <span>직접 보존률</span>
                <strong className={styles.danger}>{formatRatePct(postPatchClickIdHealth.orderStage.preservationRate)}</strong>
                <p>
                  confirmed 결제완료 신호 {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건 중 gclid/gbraid/wbraid가 직접 남은 건은
                  {" "}{formatCount(postPatchClickIdHealth.orderStage.withGoogleClickId)}건입니다.
                </p>
              </div>
              <div className={styles.postPatchMetric}>
                <span>진단용 세션 bridge</span>
                <strong className={styles.warn}>{formatCount(postPatchClickIdHealth.orderStage.priorSameGaSessionRows)}건</strong>
                <p>
                  같은 GA 세션에서 결제 직전 gclid가 보인 후보입니다.
                  client id까지 일치한 후보는 {formatCount(postPatchClickIdHealth.orderStage.strictSameSessionAndClientRows)}건이라 upload 후보는 아닙니다.
                </p>
              </div>
              <div className={styles.postPatchMetric}>
                <span>Google Ads upload 후보</span>
                <strong className={styles.danger}>{formatCount(postPatchClickIdHealth.orderStage.uploadCandidateCount)}건</strong>
                <p>
                  same-session, same-client, time-window 후보는 Google Ads에 보내지 않습니다.
                  직접 click id가 있는 confirmed 주문만 후보로 올립니다.
                </p>
              </div>
            </div>

            <div className={styles.postPatchDetailGrid}>
              {[
                postPatchClickIdHealth.clickStage.siteLanding,
                postPatchClickIdHealth.clickStage.paidClickIntent,
              ].map((stage) => (
                <div key={stage.label}>
                  <strong>{stage.label}</strong>
                  <p>{stage.why}</p>
                  <dl>
                    <div><dt>gclid</dt><dd>{formatCount(stage.gclidRows)}</dd></div>
                    <div><dt>gbraid</dt><dd>{formatCount(stage.gbraidRows)}</dd></div>
                    <div><dt>wbraid</dt><dd>{formatCount(stage.wbraidRows)}</dd></div>
                    <div><dt>gad_source</dt><dd>{formatCount(stage.gadSourceRows)}</dd></div>
                  </dl>
                </div>
              ))}
              <div>
                <strong>{postPatchClickIdHealth.clickStage.attributionLedger.label}</strong>
                <p>{postPatchClickIdHealth.clickStage.attributionLedger.why}</p>
                <dl>
                  <div><dt>click 증거</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.googleClickIdEvidenceRows)}</dd></div>
                  <div><dt>campaign ID</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.gadCampaignIdRows)}</dd></div>
                  <div><dt>결제완료</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.confirmedPaymentSuccessRows)}</dd></div>
                  <div><dt>주문+campaign</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.confirmedRowsWithGadCampaignId)}</dd></div>
                </dl>
              </div>
            </div>

            <div className={styles.postPatchOrderRows}>
              <div>
                <span>클릭 URL 파라미터</span>
                <strong>{formatRatePct(postPatchClickIdHealth.clickStage.siteLanding.coverageRate)}</strong>
                <em>
                  고객 유입 장부 {formatCount(postPatchClickIdHealth.clickStage.siteLanding.googleClickIdRows)}건 중
                  campaign id {formatCount(postPatchClickIdHealth.clickStage.siteLanding.gadCampaignIdRows)}건
                </em>
              </div>
              <div>
                <span>태그 저장 파라미터</span>
                <strong>{formatRatePct(postPatchClickIdHealth.clickStage.paidClickIntent.coverageRate)}</strong>
                <em>
                  유료 클릭 의도 장부 {formatCount(postPatchClickIdHealth.clickStage.paidClickIntent.googleClickIdRows)}건 중
                  campaign id {formatCount(postPatchClickIdHealth.clickStage.paidClickIntent.gadCampaignIdRows)}건
                </em>
              </div>
              <div>
                <span>결제 후 click 오인 방지</span>
                <strong>{formatCount(postPatchClickIdHealth.orderStage.invalidAfterSameClientRows)}건 제외</strong>
                <em>결제 이후 click은 confirmed 주문 근거로 쓰지 않습니다.</em>
              </div>
              {postPatchClickIdHealth.orderStage.paymentMethodBreakdown.map((row) => (
                <div key={`post-patch-${row.paymentMethod}`}>
                  <span>{paymentMethodLabel(row.paymentMethod)}</span>
                  <strong>{formatRatePct(row.preservationRate)}</strong>
                  <em>{formatCount(row.withGoogleClickId)} / {formatCount(row.orders)}건</em>
                </div>
              ))}
              <div>
                <span>VM evidence 없음</span>
                <strong>{formatCount(postPatchClickIdHealth.orderStage.evidenceCounts.missingAttributionVmEvidence)}건</strong>
                <em>confirmed 결제완료 {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건 중 결제완료 ledger/intent exact 증거가 없는 주문</em>
              </div>
            </div>

            <div className={styles.evidenceGradeGrid}>
              {postPatchClickIdHealth.evidenceGrades.map((grade) => (
                <div key={grade.grade} className={styles.evidenceGradeCard}>
                  <span>{grade.grade}등급 · {grade.label}</span>
                  <strong>{formatCount(grade.count)}건</strong>
                  <p>{grade.description}</p>
                  <em>Google Ads upload: {grade.upload}</em>
                </div>
              ))}
            </div>

            <p className={styles.postPatchDecision}>{postPatchClickIdHealth.decision}</p>
          </article>
          <p className={styles.healthNote}>
            보존률이 10% 미만이면 Google Ads upload를 열기보다 landing, checkout, payment_success 사이에서 click id가 사라지는 지점을 먼저 고치는 것이 맞습니다.
          </p>
        </section>

        <section className={`${styles.section} ${styles.campaignMatchSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Google 캠페인 ID 매칭률</h2>
              <p>
                gad_campaignid는 Google 광고가 붙여주는 캠페인 번호입니다. UTM이 없어도 이 번호와 click id가 함께 남으면 내부 ROAS를 캠페인 단위로 더 정확히 나눌 수 있습니다.
                이 화면은 ROAS 산정 헬스와 GTM 태그 진단 헬스를 분리해서 봅니다.
              </p>
            </div>
            <span className={styles.metaText}>
              기준 후보일: {last30.googleCampaignMatchHealth.baseline.candidateStartedAtKst} · upload 후보 {last30.googleCampaignMatchHealth.summary.uploadCandidateCount}건
            </span>
          </div>
          <div className={styles.healthStandardGrid}>
            {campaignHealthSplitCards(last7.googleCampaignMatchHealth).map((card) => (
              <article key={card.key} className={styles.healthStandardCard}>
                <div className={styles.healthTop}>
                  <div>
                    <span className={styles.healthLabel}>{card.subtitle}</span>
                    <strong>{card.title}</strong>
                  </div>
                  <span className={roleStatusClass(card.status)}>{roleStatusLabel(card.status)}</span>
                </div>
                <p>{card.interpretation}</p>
                <div className={styles.healthStats}>
                  <div>
                    <span>{card.primaryLabel}</span>
                    <strong>{formatCount(card.primary)}</strong>
                  </div>
                  <div>
                    <span>{card.secondaryLabel}</span>
                    <strong>{formatCount(card.secondary)}</strong>
                  </div>
                  <div>
                    <span>매칭률</span>
                    <strong>{formatRatePct(card.rate)}</strong>
                  </div>
                </div>
                <em>source: {card.source} · latest {formatFetchedAt(card.latestAt ?? undefined)}</em>
              </article>
            ))}
          </div>
          <div className={styles.probeNote}>
            <strong>2026-05-21 실클릭 canary 해석</strong>
            <span>
              주문 202605214186402는 고객 유입 원장과 주문 원장에 gclid, gbraid, gad_campaignid가 남았습니다.
              반면 paid-click-intent exact row는 누락되어 이 원장은 ROAS 정본이 아니라 태그 진단 대상으로 분리합니다.
            </span>
          </div>
          <div className={styles.campaignMatchGrid}>
            {[last7, last30].map((item) => {
              const health = item.googleCampaignMatchHealth;
              return (
                <article key={`${item.label}-campaign-match`} className={styles.campaignMatchCard}>
                  <div className={styles.healthTop}>
                    <div>
                      <span className={styles.healthLabel}>{item.label}</span>
                      <strong className={health.baseline.effectiveForRoasRecalculation ? styles.good : styles.warn}>
                        {formatRatePct(health.siteLanding.currentCampaignIdCoverageRate)}
                      </strong>
                    </div>
                    <span className={campaignMatchStatusClass(health.summary.status)}>
                      {campaignMatchStatusLabel(health.summary.status)}
                    </span>
                  </div>
                  <p className={styles.healthSummary}>{health.summary.interpretation}</p>
                  <div className={styles.healthStats}>
                    <div>
                      <span>유입 click id</span>
                      <strong>{formatCount(health.siteLanding.googleClickIdRows)}</strong>
                    </div>
                    <div>
                      <span>캠페인 ID 보존</span>
                      <strong>{formatCount(health.siteLanding.gadCampaignIdRows)}</strong>
                    </div>
                    <div>
                      <span>미맵핑 후보</span>
                      <strong>{formatCount(health.summary.unmappedRows)}</strong>
                    </div>
                    <div>
                      <span>보강 후 잠재</span>
                      <strong>{formatRatePct(health.siteLanding.potentialCoverageRateAfterAllowlist)}</strong>
                    </div>
                  </div>
                  <div className={styles.baselineBox}>
                    <strong>{health.baseline.effectiveForRoasRecalculation ? "ROAS 재계산 기준점 사용 가능" : "ROAS 재계산 기준 후보"}</strong>
                    <p>{health.baseline.policy}</p>
                    <em>effective from: {health.baseline.effectiveFromKst ?? "신규 row 확인 전"}</em>
                  </div>
                </article>
              );
            })}
          </div>
          <div className={styles.campaignTableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>캠페인 ID</th>
                  <th>매칭율%</th>
                  <th>근거</th>
                  <th>원장 rows</th>
                  <th>결제완료 rows</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {(last7.googleCampaignMatchHealth.topCampaignIds.length > 0
                  ? last7.googleCampaignMatchHealth.topCampaignIds
                  : [
                      {
                        campaignId: "미맵핑",
                        campaignName: "gad_campaignid 미보존 click id 묶음",
                        rows: last7.googleCampaignMatchHealth.summary.unmappedRows,
                        confirmedRows: 0,
                        matchedToDashboardCampaign: false,
                      },
                    ]).map((row) => (
                    <tr key={row.campaignId}>
                      <td>
                        <strong>{row.campaignName ?? row.campaignId}</strong>
                        <span>{row.campaignId}</span>
                      </td>
                      <td>
                        <strong>{row.matchedToDashboardCampaign ? `${last7.googleCampaignMatchHealth.confidenceThresholds.gadCampaignIdWithClickIdPct}%+` : "0~70%"}</strong>
                      </td>
                      <td>{row.matchedToDashboardCampaign ? "gad_campaignid + Google Ads campaign 목록" : "캠페인 ID 보존/Google Ads 목록 확인 필요"}</td>
                      <td>{formatCount(row.rows)}</td>
                      <td>{formatCount(row.confirmedRows)}</td>
                      <td>
                        <span className={row.matchedToDashboardCampaign ? styles.good : styles.warn}>
                          {row.matchedToDashboardCampaign ? "내부 ROAS 보조 사용" : "미맵핑/진단"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className={styles.healthNote}>
            오늘 작업일은 기준점 후보로만 기록합니다. 배포 후 신규 Google 클릭에서 gad_campaignid가 보존되는 것이 확인되면 그 시점부터 캠페인별 ROAS 재계산 기준으로 승격합니다.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>KR과 연결 액션플랜</h2>
              <p>KR은 Key Result, 즉 이번 프로젝트가 실제로 성공했다고 말할 수 있는 측정 결과입니다. 현재%는 문서 기준 진행률과 화면 구현 상태를 함께 반영했습니다.</p>
            </div>
            <span className={styles.metaText}>plan source: gdn/!gdnplan_new + 2026-05-23 exact evidence guard, 화면 갱신: {formatFetchedAt(last30.fetchedAt)}</span>
          </div>
          <div className={styles.krGrid}>
            {keyResults.map((item) => (
              <article key={item.id} className={styles.krCard}>
                <div className={styles.krTop}>
                  <span className={`${styles.status} ${item.tone === "warn" ? styles.statusWarn : item.tone === "hold" ? styles.statusHold : ""}`}>
                    {item.id} · {item.status}
                  </span>
                  <span className={styles.krOwner}>{item.owner}</span>
                </div>
                <h3>{item.title}</h3>
                <div className={styles.krMetricRow}>
                  <div>
                    <span>현재</span>
                    <strong>{item.currentPct}%</strong>
                  </div>
                  <div>
                    <span>목표</span>
                    <strong>{item.targetPct}%</strong>
                  </div>
                </div>
                <div className={styles.progressTrack} aria-label={`${item.id} current progress`}>
                  <div className={`${styles.progressFill} ${item.tone === "warn" ? styles.progressFillWarn : item.tone === "hold" ? styles.progressFillHold : ""}`} style={{ width: `${Math.min(100, item.currentPct)}%` }} />
                </div>
                <div className={styles.krAction}>
                  <strong>연결 액션플랜</strong>
                  <p>{item.actionPlan}</p>
                </div>
                <div className={styles.krConditions}>
                  <strong>목표 달성 조건</strong>
                  <ul>
                    {item.conditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.krWhy}>
                  <strong>왜 하는가</strong>
                  <p>{item.why}</p>
                </div>
                <p className={styles.krEvidence}>{item.evidence}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>플랫폼 ROAS와 내부 ROAS를 같은 눈금으로 비교</h2>
              <p>막대는 ROAS 크기만 비교합니다. 예산 판단에는 파란 막대가 아니라 초록 막대와 보정 후 값을 우선합니다.</p>
            </div>
            <span className={styles.metaText}>source: VM Cloud live API, fallback: gdn 정본 문서</span>
          </div>
          <div className={styles.twoColumn}>
            <div className={styles.compareList}>
              {[last7, last30].map((item) => (
                <div key={item.label} className={styles.compareItem}>
                  <div className={styles.compareTop}>
                    <strong>{item.label} Google platform ROAS</strong>
                    <span>{formatRoas(item.platformRoas)}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${Math.min(100, (item.platformRoas / maxRoas) * 100)}%` }} />
                  </div>
                  <p>전환값 {formatKrw(item.platformValue)} / 광고비 {formatKrw(item.cost)}. Google Ads가 주장하는 참고값입니다.</p>
                </div>
              ))}
              {[last7, last30].map((item) => (
                <div key={`${item.label}-internal`} className={styles.compareItem}>
                  <div className={styles.compareTop}>
                    <strong>{item.label} 내부 confirmed + NPay actual ROAS</strong>
                    <span className={styles.good}>{formatRoas(item.internalWithNpayRoas)}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={`${styles.barFill} ${styles.barFillInternal}`} style={{ width: `${Math.min(100, (item.internalWithNpayRoas / maxRoas) * 100)}%` }} />
                  </div>
                  <p>내부 confirmed {formatKrw(item.internalRevenue)} + NPay actual {formatKrw(item.npayRevenue)}. 예산 판단 후보입니다.</p>
                </div>
              ))}
            </div>
            <div className={styles.findingCard}>
              <strong>현재 Google ROAS 정합성 상태</strong>
              <p>
                최근 live API 기준으로도 Primary known NPay 전환값 비중은 {formatPct(last30.nPayShare)}입니다.
                즉 Google Ads가 잡은 큰 전환값 대부분은 실제 결제완료 원장으로 검증된 매출과 아직 분리해서 봐야 합니다.
              </p>
              <p>
                NPay actual을 내부 매출에 합류시키면 최근 30일 내부 ROAS는 {formatRoas(last30.internalRoas)}에서 {formatRoas(last30.internalWithNpayRoas)}로 올라갑니다.
                그래도 Google platform ROAS {formatRoas(last30.platformRoas)}와는 아직 차이가 큽니다.
              </p>
              <p>
                campaign id coverage는 {formatPct(last30.campaignCoverage)}이고 미확인 주문은 {last30.unknownCampaignOrders ?? "-"}건입니다.
                캠페인별 증액은 이 커버리지가 더 닫힌 뒤 판단하는 편이 안전합니다.
              </p>
              <p>
                다만 진전도 있습니다. NPay 실제 결제완료 중 A급 exact 후보 {exactEvidenceReadiness.gradeAMatch}건을 찾았고,
                GA4 중복 guard도 {exactEvidenceReadiness.ga4CheckedIds}개 ID 모두 중복 없음으로 통과했습니다.
                남은 병목은 이 결과를 영구 evidence snapshot으로 고정하는 것입니다.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Phase 기준 다음 할일</h2>
              <p>기술 위험 구분표가 아니라 실제 실행 순서로 재배치했습니다. 한 Phase 안의 Sprint는 위에서 아래 순서로 진행합니다.</p>
            </div>
            <span className={styles.metaText}>문서 기준: 2026-05-07, live KPI 보강: {formatFetchedAt(last30.fetchedAt)}</span>
          </div>
          <div className={styles.phasePlan}>
            {phasePlan.map((item) => (
              <div key={`${item.phase}-${item.sprint}`} className={styles.phaseCard}>
                <div className={styles.phaseMeta}>
                  <span className={`${styles.status} ${item.tone === "warn" ? styles.statusWarn : item.tone === "hold" ? styles.statusHold : ""}`}>
                    {item.phase} · {item.sprint} · {item.status}
                  </span>
                  <span>{item.owner}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.why}</p>
                <div className={styles.cadenceBox}>
                  <strong>조회 주기</strong>
                  <span>{item.cadence}</span>
                </div>
                <ol className={styles.phaseSteps}>
                  {item.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className={styles.phaseResultGrid}>
                  <div>
                    <strong>성공 기준</strong>
                    <span>{item.success}</span>
                  </div>
                  <div>
                    <strong>현재 결과</strong>
                    <span>{item.currentResult}</span>
                  </div>
                  <div>
                    <strong>다음 판단</strong>
                    <span>{item.nextDecision}</span>
                  </div>
                </div>
                <p className={styles.phaseEvidence}>{item.evidence}</p>
                <div className={styles.progressTrack}>
                  <div className={`${styles.progressFill} ${item.tone === "warn" ? styles.progressFillWarn : item.tone === "hold" ? styles.progressFillHold : ""}`} style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>정합성 판단 기준</h2>
              <p>숫자는 출처와 용도를 같이 봐야 합니다. 아래 기준은 GDN harness와 attribution source guide를 화면 문구로 옮긴 것입니다.</p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>판단 항목</th>
                  <th>운영에서 쓰는 방식</th>
                  <th>출처</th>
                  <th>주의점</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map((row) => (
                  <tr key={row.decision}>
                    <td><strong>{row.decision}</strong></td>
                    <td>{row.use}</td>
                    <td>{row.source}</td>
                    <td>{row.caveat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>원본 근거</h2>
              <p>운영자가 봐야 하는 핵심 근거만 남겼습니다. 원본 ID와 기술명은 검증용으로만 표시합니다.</p>
            </div>
          </div>
          <div className={styles.evidenceGrid}>
            <div className={styles.evidenceCard}>
              <strong>정본 계획 문서</strong>
              <p>Google Ads ROAS 정합성 작업의 실제 개발 순서와 금지선을 정의합니다.</p>
              <code>gdn/!gdnplan_new.md</code>
            </div>
            <div className={styles.evidenceCard}>
              <strong>데이터 source 결정 가이드</strong>
              <p>주문/결제 정본과 광고 클릭 evidence를 분리해서 보라는 기준입니다.</p>
              <code>gdn/attribution-data-source-decision-guide-20260511.md</code>
            </div>
            <div className={styles.evidenceCard}>
              <strong>현재 live 조회 API</strong>
              <p>Google Ads API와 내부 원장 값을 같은 화면에서 읽습니다. 쓰기나 전송은 없습니다.</p>
              <code>/api/google-ads/dashboard?date_preset=last_7d,last_30d</code>
            </div>
            <div className={styles.evidenceCard}>
              <strong>exact evidence 설계안</strong>
              <p>NPay matcher 결과를 영구 evidence로 고정하는 다음 단계 설계입니다. 실행은 승인 전 보류합니다.</p>
              <code>project/google-roas-npay-exact-evidence-design-20260523.md</code>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Codex가 승인 없이 계속 진행할 read-only 작업</h2>
              <p>외부 계정, 운영 DB, Google Ads 학습값을 바꾸지 않는 범위에서만 진행합니다. 반복 조회는 목적과 종료 조건이 있을 때만 합니다.</p>
            </div>
          </div>
          <div className={styles.actionGrid}>
            {activeReadOnlyWork.map((card) => (
              <div key={card.title} className={styles.actionCard}>
                <span className={styles.status}>자동 진행</span>
                <h3>{card.title}</h3>
                <ul>
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>컨펌 요청사항</h2>
              <p>아래는 지금 당장 누르는 버튼이 아니라, 앞 단계 성공/실패 조건이 확인되면 TJ님에게 요청할 결정입니다.</p>
            </div>
          </div>
          <div className={styles.requestGrid}>
            {confirmationRequests.map((request) => (
              <article key={request.title} className={styles.requestCard}>
                <div className={styles.requestTop}>
                  <span className={`${styles.status} ${styles.statusWarn}`}>{request.status}</span>
                  <span>{request.owner}</span>
                </div>
                <h3>{request.title}</h3>
                <dl>
                  <div>
                    <dt>언제</dt>
                    <dd>{request.when}</dd>
                  </div>
                  <div>
                    <dt>왜</dt>
                    <dd>{request.why}</dd>
                  </div>
                  <div>
                    <dt>어느 화면</dt>
                    <dd>{request.screen}</dd>
                  </div>
                  <div>
                    <dt>바꾸면 생기는 효과</dt>
                    <dd>{request.effect}</dd>
                  </div>
                  <div>
                    <dt>성공 기준</dt>
                    <dd>{request.success}</dd>
                  </div>
                  <div>
                    <dt>실패 시 확인점</dt>
                    <dd>{request.fallback}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <p className={styles.footerNote}>
          Source / window / freshness / confidence: primary source는 Google Ads API customer 2149990943와 VM Cloud attribution ledger입니다.
          live KPI window는 Google Ads `LAST_7_DAYS`, `LAST_30_DAYS`이고 기준 시각은 {formatFetchedAt(last30.fetchedAt)}입니다.
          문서 근거는 `gdn/!gdnplan_new.md`, `harness/gdn/RULES.md`, `project/google-ads-confirmed-primary-npay-check-20260523.md`, `project/google-roas-npay-exact-evidence-design-20260523.md`이며 confidence는 0.88-0.93 범위입니다.
          {last7.error || last30.error ? ` 일부 live 조회 실패 시 문서 fallback을 표시했습니다: ${last7.error ?? last30.error}` : ""}
        </p>
      </main>
    </div>
  );
}
