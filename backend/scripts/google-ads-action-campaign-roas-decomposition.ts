#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

type Snapshot = {
  generatedAt?: string;
  source?: Record<string, unknown>;
  totals?: {
    cost?: number;
    conversionValue?: number;
    allConversionValue?: number;
    roas?: number | null;
    primaryNpayValue?: number;
    primaryNpayShareOfPlatformValue?: number | null;
    secondaryNpayAllValue?: number;
  };
  actions?: Array<Record<string, unknown>>;
  campaignAudit?: Array<Record<string, unknown>>;
  dailyAction?: Array<Record<string, unknown>>;
};

type IntegratedInput = {
  generated_at_kst?: string;
  source?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  candidates?: Array<{
    order_number: string;
    payment_method: string;
    value: number;
    vm_order_evidence?: {
      google_click_id_present?: boolean;
      utm_source?: string;
      utm_campaign?: string;
    };
  }>;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const str = (value: unknown) => (value == null ? "" : String(value));

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const googleAdsApiStatus = () => {
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()) return "developer_token_present_not_called";
  if (process.env.API_TOKEN_BIOCOM?.trim()) {
    return "api_token_biocom_present_but_current_readonly_script_requires_google_ads_developer_token";
  }
  return "blocked_missing_google_ads_developer_token";
};

const classifyActionRisk = (action: Record<string, unknown>) => {
  const classification = str(action.classification);
  const name = str(action.name);
  const primaryForGoal = action.primaryForGoal === true;
  if (classification === "primary_npay_count_label") {
    return {
      risk: "high",
      reason: "Google Ads Primary 전환=입찰 학습에 쓰는 핵심 구매 신호가 NPay click/count 계열 label에 묶여 있을 가능성",
      recommended_action: "confirmed_purchase 별도 전환 준비 전까지 upload/change HOLD",
    };
  }
  if (classification === "secondary_npay_click_label" || /TechSol|NPAY|NPay/i.test(name)) {
    return {
      risk: primaryForGoal ? "high" : "medium",
      reason: "NPay 버튼 클릭/intent 전환으로 보이며 실제 결제완료와 분리 필요",
      recommended_action: "read-only audit 유지, pause/delete는 별도 승인 전 금지",
    };
  }
  return {
    risk: "unknown",
    reason: "현재 snapshot만으로 confirmed purchase 여부를 단정하지 않음",
    recommended_action: "conversion action별 live API refresh 필요",
  };
};

const buildPayload = (snapshot: Snapshot, integrated: IntegratedInput, inputs: Record<string, string>) => {
  const candidates = integrated.candidates ?? [];
  const internalConfirmedRevenue = candidates.reduce((sum, candidate) => sum + num(candidate.value), 0);
  const internalGoogleAttributedRevenue = candidates
    .filter((candidate) => candidate.vm_order_evidence?.google_click_id_present)
    .reduce((sum, candidate) => sum + num(candidate.value), 0);
  const npayConfirmedRevenue = candidates
    .filter((candidate) => candidate.payment_method === "npay")
    .reduce((sum, candidate) => sum + num(candidate.value), 0);
  const homepageConfirmedRevenue = candidates
    .filter((candidate) => candidate.payment_method === "homepage")
    .reduce((sum, candidate) => sum + num(candidate.value), 0);
  const platformConversionValue = num(snapshot.totals?.conversionValue);
  const platformCost = num(snapshot.totals?.cost);
  const platformAllConversionValue = num(snapshot.totals?.allConversionValue);
  const primaryNpayValue = num(snapshot.totals?.primaryNpayValue);
  const secondaryNpayAllValue = num(snapshot.totals?.secondaryNpayAllValue);

  const actions = (snapshot.actions ?? []).map((action) => ({
    id: str(action.id),
    name: str(action.name),
    status: str(action.status),
    type: str(action.type),
    category: str(action.category),
    primary_for_goal: action.primaryForGoal === true,
    counting_type: str(action.countingType),
    send_to: action.sendTo ?? [],
    labels: action.labels ?? [],
    classification: str(action.classification),
    ...classifyActionRisk(action),
  }));

  const campaignSummary = (snapshot.campaignAudit ?? []).map((campaign) => ({
    campaign_id: str(campaign.campaignId),
    campaign_name: str(campaign.campaignName),
    status: str(campaign.status),
    channel: str(campaign.channel),
    bidding_strategy_type: str(campaign.biddingStrategyType),
    cost: round(num(campaign.cost)),
    platform_conversion_value: round(num(campaign.conversionValue)),
    platform_all_conversion_value: round(num(campaign.allConversionValue)),
    platform_roas: campaign.roas ?? null,
    primary_npay_value: round(num(campaign.primaryNpayValue)),
    primary_npay_share_of_platform_value: campaign.primaryNpayShareOfPlatformValue ?? null,
    secondary_npay_all_value: round(num(campaign.secondaryNpayAllValue)),
    affected_by_npay_primary: campaign.affectedByNpayPrimary === true,
    internal_confirmed_revenue_matched_to_campaign: 0,
    internal_match_status: "not_joined_missing_campaign_click_key",
    recommended_budget_action_from_snapshot: str(campaign.recommendedBudgetAction),
  }));

  return {
    ok: true,
    generated_at_kst: kstNow(),
    site: "biocom",
    mode: "green_read_only_google_ads_snapshot_plus_internal_confirmed",
    source_window: {
      google_ads_snapshot: snapshot.source ?? {},
      google_ads_snapshot_generated_at: snapshot.generatedAt ?? "",
      internal_confirmed_input: integrated.source ?? {},
      internal_confirmed_generated_at_kst: integrated.generated_at_kst ?? "",
      comparability: "warning_not_same_window",
    },
    source_availability: {
      google_ads_api_realtime: googleAdsApiStatus(),
      google_ads_snapshot: "available_20260505_last14_fallback",
      internal_confirmed: "available_20260510_operational_db_primary",
      vm_cloud: "supporting_evidence_only",
    },
    summary: {
      platform_cost_snapshot: round(platformCost),
      platform_conversion_value_snapshot: round(platformConversionValue),
      platform_all_conversion_value_snapshot: round(platformAllConversionValue),
      platform_roas_snapshot: platformCost > 0 ? round(platformConversionValue / platformCost, 2) : null,
      platform_all_roas_snapshot: platformCost > 0 ? round(platformAllConversionValue / platformCost, 2) : null,
      primary_npay_value_snapshot: round(primaryNpayValue),
      primary_npay_share_of_platform_value_snapshot:
        platformConversionValue > 0 ? round(primaryNpayValue / platformConversionValue, 4) : null,
      secondary_npay_all_value_snapshot: round(secondaryNpayAllValue),
      internal_confirmed_revenue_current_window: round(internalConfirmedRevenue),
      internal_confirmed_homepage_revenue_current_window: round(homepageConfirmedRevenue),
      internal_confirmed_npay_revenue_current_window: round(npayConfirmedRevenue),
      internal_google_attributed_revenue_current_window: round(internalGoogleAttributedRevenue),
      platform_minus_internal_revenue_gap_not_comparable: round(platformConversionValue - internalConfirmedRevenue),
      send_candidate: 0,
      actual_send_candidate: 0,
      google_ads_upload_count: 0,
    },
    conversion_action_summary: actions,
    campaign_summary: campaignSummary,
    gap_drivers: [
      {
        key: "primary_npay_count_label",
        severity: "high",
        value_snapshot: round(primaryNpayValue),
        evidence: "2026-05-05 LAST_14_DAYS snapshot classified almost all platform Conv. value as primary_npay_count_label.",
        next_action: "live Google Ads API token 확보 후 action/campaign refresh",
      },
      {
        key: "missing_order_level_google_click_id",
        severity: "high",
        value_snapshot: round(internalConfirmedRevenue),
        evidence: "2026-05-10 operational confirmed 4건 중 Google click id present 0건.",
        next_action: "Path B/order_bridge paid click join dry-run and confirmed_purchase no-send candidate review",
      },
      {
        key: "window_mismatch",
        severity: "medium",
        value_snapshot: 0,
        evidence: "Google Ads fallback snapshot and internal confirmed input have different windows.",
        next_action: "same-window Google Ads API or export refresh",
      },
    ],
    guards: {
      platform_send_count: 0,
      google_ads_upload_count: 0,
      raw_pii_output_count: 0,
      send_candidate: 0,
      actual_send_candidate: 0,
    },
    blockers:
      googleAdsApiStatus() === "developer_token_present_not_called"
        ? ["google_ads_api_not_called_in_this_green_snapshot_run"]
        : ["google_ads_readonly_script_env_mapping_required_for_live_refresh"],
    inputs,
  };
};

const renderMarkdown = (payload: ReturnType<typeof buildPayload>) => {
  const lines: string[] = [];
  lines.push("# Google Ads action/campaign ROAS decomposition (2026-05-10)");
  lines.push("");
  lines.push("## 5줄 요약");
  lines.push("");
  lines.push("1. 실시간 Google Ads API는 현재 read-only script env 매핑 확인이 필요해 2026-05-05 LAST_14_DAYS snapshot을 fallback으로 썼다.");
  lines.push(`2. snapshot상 Google Ads 플랫폼 주장 Conv. value는 ${payload.summary.platform_conversion_value_snapshot.toLocaleString()}원, 내부 confirmed 현재 window 매출은 ${payload.summary.internal_confirmed_revenue_current_window.toLocaleString()}원이다.`);
  lines.push("3. 두 값은 window가 달라 직접 ROAS 비교값으로 쓰지 않고, gap driver를 찾는 참고값으로만 둔다.");
  lines.push(`4. primary NPay count label snapshot value는 ${payload.summary.primary_npay_value_snapshot.toLocaleString()}원으로, 플랫폼 Conv. value의 대부분을 차지한다.`);
  lines.push("5. Google Ads upload, conversion action 변경, send_candidate=true는 계속 0/NO다.");
  lines.push("");
  lines.push("## Source Availability");
  lines.push("");
  lines.push(`- google_ads_api_realtime: ${payload.source_availability.google_ads_api_realtime}`);
  lines.push(`- google_ads_snapshot: ${payload.source_availability.google_ads_snapshot}`);
  lines.push(`- internal_confirmed: ${payload.source_availability.internal_confirmed}`);
  lines.push(`- comparability: ${payload.source_window.comparability}`);
  lines.push("");
  lines.push("## Conversion Actions");
  lines.push("");
  lines.push("| id | name | primary | classification | risk | reason |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const action of payload.conversion_action_summary) {
    lines.push(`| ${action.id} | ${action.name} | ${action.primary_for_goal} | ${action.classification} | ${action.risk} | ${action.reason} |`);
  }
  lines.push("");
  lines.push("## Campaign Snapshot");
  lines.push("");
  lines.push("| campaign | channel | cost | platform value | primary NPay value | internal join |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- |");
  for (const campaign of payload.campaign_summary.slice(0, 12)) {
    lines.push(`| ${campaign.campaign_name} | ${campaign.channel} | ${campaign.cost.toLocaleString()} | ${campaign.platform_conversion_value.toLocaleString()} | ${campaign.primary_npay_value.toLocaleString()} | ${campaign.internal_match_status} |`);
  }
  lines.push("");
  lines.push("## 이번 문서가 말하는 것 / 말하지 않는 것");
  lines.push("");
  lines.push("- 말하는 것: Google Ads 플랫폼 주장값이 어떤 action/campaign 쪽에서 부풀 가능성이 큰지.");
  lines.push("- 말하지 않는 것: 오늘 기준 정확한 Google Ads ROAS. 실시간 API token이 없어 same-window 값이 아니다.");
  lines.push("");
  lines.push("## 금지선 준수");
  lines.push("");
  lines.push("- Google Ads upload 0");
  lines.push("- conversion action 변경 0");
  lines.push("- platform send 0");
  lines.push("- send_candidate=true 0");
  return `${lines.join("\n")}\n`;
};

const main = () => {
  const snapshotPath = path.resolve(
    argValue("snapshot") ?? path.join(__dirname, "..", "..", "data", "google-ads-campaign-signal-audit-20260505-last14.json"),
  );
  const integratedPath = path.resolve(
    argValue("integrated-input") ?? path.join(__dirname, "..", "..", "data", "confirmed-purchase-integrated-input-20260510.json"),
  );
  const output = argValue("output");
  const markdownOutput = argValue("markdown-output") ?? argValue("markdownOutput");
  const payload = buildPayload(readJson<Snapshot>(snapshotPath), readJson<IntegratedInput>(integratedPath), {
    snapshot: path.relative(process.cwd(), snapshotPath),
    integrated_input: path.relative(process.cwd(), integratedPath),
  });
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(path.resolve(output), `${JSON.stringify(payload, null, 2)}\n`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
  if (markdownOutput) {
    fs.mkdirSync(path.dirname(path.resolve(markdownOutput)), { recursive: true });
    fs.writeFileSync(path.resolve(markdownOutput), renderMarkdown(payload));
  }
};

main();
