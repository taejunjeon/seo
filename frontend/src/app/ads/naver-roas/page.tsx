"use client";

import Link from "next/link";

import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";

type Tone = "good" | "warn" | "danger" | "info" | "neutral";
type ChannelStatus = "ready" | "partial" | "manual" | "blocked";
type OkrStatus = "done" | "on_track" | "needs_work";
type Lane = "Green" | "Yellow" | "Red";

type Kpi = {
  label: string;
  value: string;
  basis: string;
  source: string;
  caution: string;
  tone: Tone;
};

type ChannelReport = {
  channel: string;
  subtitle: string;
  status: ChannelStatus;
  statusLabel: string;
  spend: string;
  revenueBasis: string;
  decision: string;
  source: string;
  window: string;
  freshness: string;
  confidence: string;
  whyItMatters: string;
  nextAction: string;
  evidence: string[];
};

type BrandsearchSite = {
  name: string;
  statusLabel: string;
  tone: Tone;
  period: string;
  cost: string;
  marker: string;
  exact: string;
  unresolved: string;
  budgetDecision: string;
  evidence: string[];
};

type UnresolvedReason = {
  reason: string;
  rows: number;
  plainMeaning: string;
  action: string;
  impact: string;
};

type Okr = {
  keyResult: string;
  progress: number;
  status: OkrStatus;
  why: string;
  current: string;
  action: string;
  success: string;
  failure: string;
};

type ActionItem = {
  priority: "P0" | "P1" | "P2";
  owner: "Codex" | "TJ님" | "Codex + TJ님";
  lane: Lane;
  title: string;
  what: string;
  why: string;
  how: string;
  dependency: string;
  success: string;
  failure: string;
  approval: string;
  confidence: string;
};

const generatedAt = "2026-05-25 23:52 KST";

const kpis: Kpi[] = [
  {
    label: "네이버 광고 전체 목표",
    value: "3개 축",
    basis: "검색광고/쇼핑검색, 브랜드검색, 성과 디스플레이를 분리합니다.",
    source: "VM Cloud cache + 수동 계약 비용 + Hermes export",
    caution: "서로 다른 window를 한 숫자로 합산하지 않습니다.",
    tone: "info",
  },
  {
    label: "비용 source 준비도",
    value: "70%",
    basis: "검색광고는 biocom ready, 브랜드검색은 수동 cache ready, 디스플레이는 coffee Hermes 1회 확인.",
    source: "2026-05-25 문서/JSON 기준",
    caution: "성과 디스플레이는 Hermes 수동 export가 필요합니다.",
    tone: "warn",
  },
  {
    label: "내부 주문 연결 준비도",
    value: "58%",
    basis: "브랜드검색은 주문 단위 bridge가 시작됐고, 검색광고/디스플레이는 주문 단위 연결 설계가 남았습니다.",
    source: "브랜드검색 bridge preview + 현재 API 구조",
    caution: "네이버 주장 전환매출은 내부 confirmed 매출로 쓰지 않습니다.",
    tone: "warn",
  },
  {
    label: "지금 가장 큰 gap",
    value: "biocom 6건",
    basis: "브랜드검색 marker 19건 중 주문 정본과 직접 붙지 않은 row입니다.",
    source: "2026-05-25 23:52 KST 재조회",
    caution: "기존 5건에서 freshness 재조회로 1건이 추가 관측됐습니다.",
    tone: "danger",
  },
];

const channels: ChannelReport[] = [
  {
    channel: "검색광고 / 쇼핑검색",
    subtitle: "네이버 검색광고 API가 읽어주는 클릭·광고비 영역",
    status: "partial",
    statusLabel: "부분 준비",
    spend: "biocom 7,276,795원 / coffee 440원 확인",
    revenueBasis: "내부 paid_naver 매출과 같은 window로 나눠야 합니다.",
    decision: "검색광고비는 API/cache를 우선 source로 쓰되, site별 cache freshness를 먼저 보여줍니다.",
    source: "Naver Search Ad API -> VM Cloud naver_ads_daily cache",
    window: "biocom 2026-04-21~2026-05-20, coffee 2026-05-18~2026-05-24",
    freshness: "biocom cache 2026-05-22 승인 실행, coffee read-only 2026-05-25",
    confidence: "biocom high, coffee medium",
    whyItMatters: "이 비용이 빠지면 네이버 ROAS가 과대평가됩니다. 반대로 네이버 주장 전환매출을 내부 매출로 쓰면 ROAS가 부풀 수 있습니다.",
    nextAction: "화면 API에서 검색광고 cache status와 내부 confirmed 매출을 같은 window로 내려줍니다.",
    evidence: [
      "biocom 최근 30일 cache는 1,110 rows, 클릭 12,443건, 광고비 7,276,795원입니다.",
      "coffee 같은 주간 검색광고 API 광고비는 440원입니다.",
      "Naver claim conversion value는 네이버 플랫폼 주장값이라 예산 판단 매출과 분리합니다.",
    ],
  },
  {
    channel: "브랜드검색",
    subtitle: "월정액 계약 비용과 브랜드검색 UTM/NaPm 유입을 연결하는 영역",
    status: "partial",
    statusLabel: "주문 연결 보강 중",
    spend: "현재 bridge window 비용 975,341원",
    revenueBasis: "주문 정본 일치 매출 3,716,996원만 예산 판단 후보입니다.",
    decision: "브랜드검색은 별도 라인으로 유지하고, organic/paid 논쟁 대신 마지막 유입 증거와 계약 비용을 같이 보여줍니다.",
    source: "수동 계약 비용 cache + VM Cloud 유입/결제 marker + 운영DB/Imweb 주문 정본",
    window: "biocom 2026-05-22~2026-05-25, coffee 2026-05-11~2026-05-25",
    freshness: "비용 cache 2026-05-25 12:52, marker 재조회 2026-05-25 23:52",
    confidence: "medium",
    whyItMatters: "브랜드검색은 오가닉 수요를 일부 먹을 수 있지만 광고상품 계약 비용이 발생합니다. 그래서 organic으로 묶지 말고 별도 성과 라인으로 봐야 합니다.",
    nextAction: "biocom 미해결 6건을 분해하고, 다음 화면 API에 exact와 unresolved를 분리해 내려줍니다.",
    evidence: [
      "coffee는 브랜드검색 marker 11건 모두 주문 정본과 연결됐습니다.",
      "biocom은 최신 재조회 기준 marker 19건 중 13건만 주문 정본과 직접 일치합니다.",
      "combined exact ROAS는 3.81배, marker 기준 ROAS는 5.75배로 서로 다릅니다.",
    ],
  },
  {
    channel: "성과 디스플레이",
    subtitle: "ADVoost 같은 네이버 디스플레이 광고 영역",
    status: "manual",
    statusLabel: "Hermes 수동 원본 필요",
    spend: "coffee 350,098원 확인",
    revenueBasis: "현재는 네이버 주장 전환값 3,463,700원만 있고 내부 confirmed join은 미완료입니다.",
    decision: "성과 디스플레이는 공식 검색광고 API에 안 들어오므로 Hermes export를 비용 원천으로 분리합니다.",
    source: "Hermes Chrome CDP XLSX export + Naver 화면 증거",
    window: "coffee 2026-05-18~2026-05-24",
    freshness: "Hermes result 2026-05-25 17:46",
    confidence: "weekly coffee spend high, rolling/biocom display low",
    whyItMatters: "검색광고 API만 보면 coffee 네이버 광고비가 440원처럼 보이지만, 실제 같은 주간 디스플레이 광고비는 350,098원입니다.",
    nextAction: "Hermes export를 반복 가능한 수동 source로 두고, 내부 결제완료 주문 연결은 별도 preview로 설계합니다.",
    evidence: [
      "Hermes XLSX 원본에서 [ADVoost] 쇼핑 광고비 350,098원, 클릭 194건을 확인했습니다.",
      "같은 기간 검색광고 440원을 더하면 coffee 네이버 광고비는 350,538원입니다.",
      "성과 디스플레이 API 접근은 아직 partner-gated로 보고, Hermes를 manual source로 둡니다.",
    ],
  },
];

const brandsearchSites: BrandsearchSite[] = [
  {
    name: "바이오컴",
    statusLabel: "검토 필요",
    tone: "danger",
    period: "2026-05-22~2026-05-25",
    cost: "205,336원",
    marker: "19건 / 5,257,616원 / 25.61배",
    exact: "13건 / 3,364,432원 / 16.39배",
    unresolved: "6건: 주문키 불일치 3건, 금액·날짜 중복 2건, 날짜 window 후보 1건",
    budgetDecision: "예산 판단에는 exact 16.39배만 보수 후보로 사용합니다.",
    evidence: [
      "운영DB 결제완료 주문 199건, 47,306,484원과 대조했습니다.",
      "미해결 row는 모두 raw 주문/결제 식별자 없이 safe ordinal과 bucket으로만 분해했습니다.",
      "기존 5건 보고 이후 marker freshness가 2026-05-25 14:40Z까지 올라와 1건이 추가 관측됐습니다.",
    ],
  },
  {
    name: "더클린커피",
    statusLabel: "주문 정본 일치",
    tone: "good",
    period: "2026-05-11~2026-05-25",
    cost: "770,005원",
    marker: "11건 / 352,564원 / 0.46배",
    exact: "11건 / 352,564원 / 0.46배",
    unresolved: "0건",
    budgetDecision: "현재 관측된 marker 범위에서는 exact 0.46배를 그대로 보수 참고값으로 봅니다.",
    evidence: [
      "Imweb 주문 정본과 marker 주문키가 모두 일치했습니다.",
      "브랜드검색 landing capture가 최근부터 열려 과거 유입 전체를 대표하지는 않습니다.",
      "다음 계약 기간도 같은 단가로 갱신된다는 가정은 화면에서 별도 주의값으로 유지합니다.",
    ],
  },
];

const unresolvedReasons: UnresolvedReason[] = [
  {
    reason: "주문키 후보는 있는데 운영DB 주문번호와 직접 일치하지 않음",
    rows: 3,
    plainMeaning: "유입 세션 evidence는 있지만 주문 정본 key 형식이 다르거나 저장 위치가 달라 직접 연결이 막힌 상태입니다.",
    action: "raw 값을 출력하지 않고 hash 비교 규칙과 주문키 후보 추출 위치를 보강합니다.",
    impact: "예산 판단에서 제외합니다.",
  },
  {
    reason: "같은 날짜·같은 금액 후보가 여러 개라 자동 확정 불가",
    rows: 2,
    plainMeaning: "동일 금액 주문이 많아 금액/날짜만으로는 어느 주문인지 확정할 수 없습니다.",
    action: "주문키, session, 결제수단, landing 증거가 더 있는지 read-only로 좁힙니다.",
    impact: "사람 검토 전 자동 반영 금지입니다.",
  },
  {
    reason: "같은 금액 후보가 가까운 날짜에만 존재",
    rows: 1,
    plainMeaning: "기존 5건 외에 최신 재조회에서 새로 잡힌 후보입니다. 주문일과 marker일이 정확히 맞지 않습니다.",
    action: "sync 지연인지, 시간대 차이인지, 결제완료일 기준 차이인지 먼저 분리합니다.",
    impact: "확정 전까지 참고값입니다.",
  },
];

const okrs: Okr[] = [
  {
    keyResult: "KR1. 네이버 광고비 source를 광고상품별로 90% 이상 덮는다.",
    progress: 70,
    status: "needs_work",
    why: "검색광고 API만 보면 디스플레이와 브랜드검색 비용이 빠져 전체 네이버 ROAS가 왜곡됩니다.",
    current: "검색광고는 biocom ready, 브랜드검색은 수동 cache ready, coffee 디스플레이는 Hermes 1회 원본 확인입니다.",
    action: "검색광고 API, 브랜드검색 수동 cache, Hermes 디스플레이 export를 한 화면 API의 channel별 source로 묶습니다.",
    success: "각 site/window에서 광고상품별 비용 누락 여부가 화면에 표시됩니다.",
    failure: "네이버 광고비가 작게 보여 ROAS가 과대평가됩니다.",
  },
  {
    keyResult: "KR2. 내부 confirmed ROAS와 플랫폼 주장 ROAS를 100% 분리한다.",
    progress: 62,
    status: "on_track",
    why: "네이버 화면의 전환매출은 플랫폼 주장값이고, 예산 판단에는 실제 결제완료 주문 기준값이 필요합니다.",
    current: "브랜드검색은 exact/order source 분리가 됐고, 검색광고·디스플레이는 같은 window 주문 연결이 남았습니다.",
    action: "화면 API 응답에 internal_confirmed, naver_claim, reference_only 필드를 분리합니다.",
    success: "TJ님이 예산에 쓸 값과 참고만 볼 값을 한눈에 구분합니다.",
    failure: "네이버 주장 전환매출이 내부 매출처럼 섞입니다.",
  },
  {
    keyResult: "KR3. 브랜드검색 주문 연결률을 95% 이상으로 올린다.",
    progress: 83,
    status: "needs_work",
    why: "브랜드검색은 paid와 organic 성격이 섞여 있어 주문 단위 evidence가 특히 중요합니다.",
    current: "최신 재조회 기준 marker 30건 중 exact 24건, 미해결 6건입니다.",
    action: "biocom 6건을 원인별로 줄이고, 신규 row가 늘어나는지 freshness monitor를 둡니다.",
    success: "브랜드검색 exact ROAS를 내부 confirmed 후보로 승격합니다.",
    failure: "marker ROAS와 exact ROAS를 계속 따로 보여줘야 합니다.",
  },
  {
    keyResult: "KR4. 네이버 ROAS 화면을 정적 보고서에서 API 연결 화면으로 전환한다.",
    progress: 45,
    status: "needs_work",
    why: "지금은 문서/JSON 스냅샷 기반이라 날짜가 바뀌면 직접 갱신해야 합니다.",
    current: "프론트 정적 화면은 준비됐고, API 연결 승인안이 필요합니다.",
    action: "읽기 전용 API 응답 shape, 배포 전후 smoke, rollback을 승인안으로 고정합니다.",
    success: "localhost와 VM Cloud에서 같은 endpoint로 최신 네이버 ROAS 상태를 읽습니다.",
    failure: "운영자가 문서와 화면을 번갈아 확인해야 합니다.",
  },
];

const actions: ActionItem[] = [
  {
    priority: "P0",
    owner: "Codex",
    lane: "Green",
    title: "바이오컴 브랜드검색 미해결 6건을 더 좁힙니다.",
    what: "주문키 불일치 3건, 금액·날짜 중복 2건, 날짜 window 후보 1건을 각각 줄입니다.",
    why: "브랜드검색 예산 판단값을 marker 기준이 아니라 주문 정본 기준으로 올리기 위해서입니다.",
    how: "운영DB와 VM Cloud를 read-only로 다시 대조하고 raw identifier는 출력하지 않습니다.",
    dependency: "현재 바로 가능",
    success: "6건 중 확정/제외/보류 사유가 모두 하나씩 붙습니다.",
    failure: "주문키 보존 gap으로 분류하고 receiver/landing 저장 설계를 보강합니다.",
    approval: "승인 불필요",
    confidence: "92%",
  },
  {
    priority: "P1",
    owner: "Codex",
    lane: "Green",
    title: "네이버 ROAS 화면 API 연결 승인안을 확정합니다.",
    what: "화면이 읽을 summary API의 응답 구조, source 우선순위, 배포/rollback 절차를 문서화합니다.",
    why: "정적 페이지에서 멈추면 매번 수동 갱신이 필요합니다.",
    how: "검색광고 cache, 브랜드검색 수동 cache, Hermes 디스플레이 결과를 channel별 섹션으로 내려주는 API를 설계합니다.",
    dependency: "프론트 정적 구조와 병렬 가능",
    success: "승인 후 backend route 구현과 VM Cloud 배포가 바로 가능한 문서가 됩니다.",
    failure: "source window가 섞이면 API 연결을 보류하고 channel별 endpoint부터 나눕니다.",
    approval: "문서 작성은 승인 불필요, 실제 backend deploy는 Yellow 승인 필요",
    confidence: "88%",
  },
  {
    priority: "P1",
    owner: "Codex + TJ님",
    lane: "Yellow",
    title: "Hermes 성과 디스플레이 export를 반복 source로 만듭니다.",
    what: "더클린커피와 바이오컴 성과 디스플레이 광고 원본을 주간 window로 반복 수집합니다.",
    why: "성과 디스플레이는 현재 검색광고 API에 안 들어와 비용 누락이 큽니다.",
    how: "Codex가 Hermes command JSON을 만들고, Hermes가 read-only/download-only로 XLSX와 screenshot을 남깁니다.",
    dependency: "Hermes Chrome 세션/로그인 상태 필요",
    success: "각 주간 window마다 display spend 원본과 화면 증거가 남습니다.",
    failure: "로그인/2FA/권한 blocker면 TJ님이 세션만 복구하고 Codex는 결과 parser를 유지합니다.",
    approval: "read-only command는 Green/Yellow 경계, 광고 변경은 금지",
    confidence: "84%",
  },
  {
    priority: "P2",
    owner: "TJ님",
    lane: "Green",
    title: "다음 브랜드검색 계약 금액이 바뀌는지 확인합니다.",
    what: "모바일/PC별 다음 계약 기간, 금액, 계약 가능 검색수를 확인합니다.",
    why: "현재 다음 기간은 같은 금액/기간으로 갱신된다고 가정했습니다.",
    how: "네이버 광고 화면의 브랜드검색 계약 정보에서 site, 기기, 시작일, 종료일, 금액을 확인합니다.",
    dependency: "다음 계약 변경 시점",
    success: "계약 금액이 바뀌면 수동 비용 cache 갱신 승인안으로 넘깁니다.",
    failure: "금액 미확인 시 현재 가정값에 낮은 confidence 표시를 유지합니다.",
    approval: "확인만 필요",
    confidence: "72%",
  },
];

function toneClass(tone: Tone) {
  return styles[`tone_${tone}`];
}

function statusClass(status: ChannelStatus | OkrStatus) {
  if (status === "ready" || status === "done") return styles.tone_good;
  if (status === "manual" || status === "on_track") return styles.tone_info;
  if (status === "blocked") return styles.tone_danger;
  return styles.tone_warn;
}

function okrLabel(status: OkrStatus) {
  if (status === "done") return "완료";
  if (status === "on_track") return "진행 중";
  return "보강 필요";
}

export default function NaverRoasReportPage() {
  return (
    <div className={styles.page}>
      <GlobalNav activeSlug="seo" />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/ads/naver">네이버 일반 광고 화면으로 이동</Link>
            <p className={styles.eyebrow}>네이버 광고 ROAS 전체 프로젝트</p>
            <h1 className={styles.title}>네이버 광고비 전체를 빠짐없이 잡고, 실제 결제완료 주문 기준 ROAS로 나눕니다</h1>
            <p className={styles.lead}>
              이 화면은 브랜드검색만 보는 페이지가 아닙니다. <strong>검색광고/쇼핑검색</strong>,
              <strong> 브랜드검색</strong>, <strong>성과 디스플레이</strong>를 분리해
              광고비 source와 내부 결제완료 매출 기준을 같은 window로 맞추는 프로젝트 보드입니다.
            </p>
          </div>
          <nav className={styles.quickLinks} aria-label="관련 화면">
            <Link className={styles.quickLinkActive} href="/ads/naver-roas">네이버 ROAS 프로젝트</Link>
            <Link className={styles.quickLink} href="/ads/naver">검색광고 API</Link>
            <Link className={styles.quickLink} href="/total">전체 ROAS</Link>
          </nav>
        </header>

        <section className={styles.questionBand} aria-labelledby="main-question">
          <div className={styles.questionCopy}>
            <span className={styles.questionLabel}>이 화면의 질문</span>
            <h2 id="main-question">네이버 광고에서 예산 판단에 쓸 수 있는 실제 ROAS는 어느 광고상품까지 준비됐나?</h2>
            <p>
              결론은 <strong>검색광고 비용은 API/cache로 시작 가능</strong>,
              <strong> 브랜드검색은 biocom 6건 보강 필요</strong>,
              <strong> 성과 디스플레이는 Hermes 수동 원본을 반복 source로 둬야 함</strong>입니다.
              네이버 주장 전환매출은 참고값이고, 예산 판단값은 실제 결제완료 주문 기준으로 따로 계산합니다.
            </p>
          </div>
          <div className={styles.actionSummary} aria-label="현재 액션 상태">
            <StatusLine label="지금 결정" value="네이버 ROAS는 3개 광고상품을 분리해 본다" tone="info" />
            <StatusLine label="오늘의 P0" value="biocom 브랜드검색 미해결 6건 좁히기" tone="danger" />
            <StatusLine label="API 병목" value="화면 자동 갱신은 승인안 후 backend route 연결" tone="warn" />
          </div>
        </section>

        <section className={styles.kpiGrid} aria-label="핵심 KPI">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </section>

        <section className={styles.section} aria-labelledby="channel-map">
          <SectionHeader
            id="channel-map"
            title="광고상품별 source 지도"
            description="광고비 source, 매출 기준, 신뢰도, 다음 액션을 광고상품별로 분리합니다."
            meta={`기준 시각 ${generatedAt}`}
          />
          <div className={styles.channelGrid}>
            {channels.map((channel) => (
              <ChannelCard key={channel.channel} channel={channel} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="brandsearch-detail">
          <SectionHeader
            id="brandsearch-detail"
            title="브랜드검색 주문 연결"
            description="브랜드검색은 별도 광고상품 라인으로 유지합니다. 유입 흔적 기준값과 주문 정본 일치값을 섞지 않습니다."
            meta="raw 주문번호·결제키·고객키 출력 0건"
          />
          <div className={styles.brandLayout}>
            <div className={styles.siteGrid}>
              {brandsearchSites.map((site) => (
                <BrandSiteCard key={site.name} site={site} />
              ))}
            </div>
            <div className={styles.reasonPanel}>
              <h3>biocom 미해결 원인 분해</h3>
              <p>기존 5건으로 보고됐던 gap은 최신 marker 재조회에서 1건이 늘어 현재 6건입니다.</p>
              {unresolvedReasons.map((item) => (
                <ReasonRow key={item.reason} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="okr-section">
          <SectionHeader
            id="okr-section"
            title="OKR 진척률"
            description="네이버 광고 전체 ROAS가 예산 판단에 쓸 수 있는 상태인지 보는 결과 지표입니다."
          />
          <div className={styles.okrGrid}>
            {okrs.map((okr) => (
              <OkrCard key={okr.keyResult} okr={okr} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="action-plan">
          <SectionHeader
            id="action-plan"
            title="권장 작업 순서"
            description="지금 필요한 작업을 운영 영향과 승인선 기준으로 정렬했습니다."
          />
          <div className={styles.actionList}>
            {actions.map((action) => (
              <ActionCard key={action.title} action={action} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="rules">
          <SectionHeader
            id="rules"
            title="숫자 해석 규칙"
            description="네이버 ROAS에서 섞이면 안 되는 값을 화면에서 고정합니다."
          />
          <div className={styles.ruleGrid}>
            <RuleItem
              title="내부 confirmed ROAS"
              body="실제 결제완료 주문 원장 기준 매출을 광고비로 나눈 값입니다. 예산 판단 후보입니다."
            />
            <RuleItem
              title="Naver claim ROAS"
              body="네이버가 자체 attribution으로 주장하는 전환매출 기준입니다. 참고값이며 내부 매출에 더하지 않습니다."
            />
            <RuleItem
              title="브랜드검색 별도 라인"
              body="오가닉 수요를 일부 포함할 수 있어도 광고상품 비용이 있으므로 organic에 묶지 않고 별도 라인으로 봅니다."
            />
            <RuleItem
              title="Hermes 수동 source"
              body="성과 디스플레이는 Hermes가 네이버 광고주센터에서 XLSX를 read-only로 받아오는 source입니다."
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="evidence">
          <SectionHeader
            id="evidence"
            title="원본 근거 확인"
            description="개발·검증용 위치입니다. 운영 화면에는 사람 말 요약을 먼저 보여주고 원본 경로는 하단에 둡니다."
          />
          <div className={styles.evidenceList}>
            <EvidenceItem label="브랜드검색 주문 bridge preview" path="data/project/naver-brandsearch-order-bridge-preview-20260525.json" />
            <EvidenceItem label="biocom 미해결 분해 JSON" path="data/project/biocom-naver-brandsearch-unresolved-breakdown-20260525.json" />
            <EvidenceItem label="coffee 성과 디스플레이 Hermes 결과" path="report/reportcoffee-naver-display-hermes-export-result-20260525.md" />
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHeader({ id, title, description, meta }: { id: string; title: string; description: string; meta?: string }) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
      {meta ? <p className={styles.metaText}>{meta}</p> : null}
    </div>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`${styles.statusLine} ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <article className={`${styles.kpiCard} ${toneClass(kpi.tone)}`}>
      <span className={styles.kpiLabel}>{kpi.label}</span>
      <strong>{kpi.value}</strong>
      <p>{kpi.basis}</p>
      <small>{kpi.source}</small>
      <em>{kpi.caution}</em>
    </article>
  );
}

function ChannelCard({ channel }: { channel: ChannelReport }) {
  return (
    <article className={styles.channelCard}>
      <div className={styles.cardHeader}>
        <div>
          <span className={`${styles.badge} ${statusClass(channel.status)}`}>{channel.statusLabel}</span>
          <h3>{channel.channel}</h3>
          <p>{channel.subtitle}</p>
        </div>
      </div>
      <div className={styles.decisionText}>
        <span>추천 판단</span>
        <strong>{channel.decision}</strong>
        <p>{channel.whyItMatters}</p>
      </div>
      <dl className={styles.metricList}>
        <div>
          <dt>광고비</dt>
          <dd>{channel.spend}</dd>
        </div>
        <div>
          <dt>매출 기준</dt>
          <dd>{channel.revenueBasis}</dd>
        </div>
        <div>
          <dt>집계 기간</dt>
          <dd>{channel.window}</dd>
        </div>
        <div>
          <dt>신뢰도</dt>
          <dd>{channel.confidence}</dd>
        </div>
      </dl>
      <ul className={styles.evidenceBullets}>
        {channel.evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className={styles.nextStepBox}>
        <span>다음 액션</span>
        <strong>{channel.nextAction}</strong>
      </div>
      <details className={styles.details}>
        <summary>검증용 source 확인</summary>
        <p>{channel.source}</p>
        <p>{channel.freshness}</p>
      </details>
    </article>
  );
}

function BrandSiteCard({ site }: { site: BrandsearchSite }) {
  return (
    <article className={styles.siteCard}>
      <div className={styles.cardHeader}>
        <div>
          <span className={`${styles.badge} ${toneClass(site.tone)}`}>{site.statusLabel}</span>
          <h3>{site.name}</h3>
          <p>{site.period}</p>
        </div>
      </div>
      <div className={styles.decisionText}>
        <span>예산 판단</span>
        <strong>{site.budgetDecision}</strong>
      </div>
      <dl className={styles.metricList}>
        <div>
          <dt>비용</dt>
          <dd>{site.cost}</dd>
        </div>
        <div>
          <dt>유입 흔적 기준</dt>
          <dd>{site.marker}</dd>
        </div>
        <div>
          <dt>주문 정본 일치</dt>
          <dd>{site.exact}</dd>
        </div>
        <div>
          <dt>미해결</dt>
          <dd>{site.unresolved}</dd>
        </div>
      </dl>
      <ul className={styles.evidenceBullets}>
        {site.evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function ReasonRow({ item }: { item: UnresolvedReason }) {
  return (
    <article className={styles.reasonRow}>
      <div>
        <strong>{item.reason}</strong>
        <p>{item.plainMeaning}</p>
      </div>
      <span>{item.rows}건</span>
      <small>{item.action}</small>
      <em>{item.impact}</em>
    </article>
  );
}

function OkrCard({ okr }: { okr: Okr }) {
  return (
    <article className={styles.okrCard}>
      <div className={styles.okrTop}>
        <span className={`${styles.badge} ${statusClass(okr.status)}`}>{okrLabel(okr.status)}</span>
        <strong>{okr.progress}%</strong>
      </div>
      <h3>{okr.keyResult}</h3>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${okr.progress}%` }} />
      </div>
      <dl className={styles.compactDl}>
        <div>
          <dt>왜 중요한가</dt>
          <dd>{okr.why}</dd>
        </div>
        <div>
          <dt>현재 상태</dt>
          <dd>{okr.current}</dd>
        </div>
        <div>
          <dt>액션</dt>
          <dd>{okr.action}</dd>
        </div>
      </dl>
      <details className={styles.details}>
        <summary>성공/실패 해석</summary>
        <p><strong>성공:</strong> {okr.success}</p>
        <p><strong>실패:</strong> {okr.failure}</p>
      </details>
    </article>
  );
}

function ActionCard({ action }: { action: ActionItem }) {
  return (
    <article className={styles.actionCard}>
      <div className={styles.actionHead}>
        <span className={styles.priorityBadge}>{action.priority}</span>
        <span className={styles.ownerBadge}>{action.owner}</span>
        <span className={styles.laneBadge}>{action.lane}</span>
        <span className={styles.confidenceBadge}>추천 {action.confidence}</span>
      </div>
      <h3>{action.title}</h3>
      <dl className={styles.compactDl}>
        <div>
          <dt>무엇을</dt>
          <dd>{action.what}</dd>
        </div>
        <div>
          <dt>왜</dt>
          <dd>{action.why}</dd>
        </div>
        <div>
          <dt>어떻게</dt>
          <dd>{action.how}</dd>
        </div>
        <div>
          <dt>의존성</dt>
          <dd>{action.dependency}</dd>
        </div>
        <div>
          <dt>성공 기준</dt>
          <dd>{action.success}</dd>
        </div>
        <div>
          <dt>실패 시</dt>
          <dd>{action.failure}</dd>
        </div>
        <div>
          <dt>승인</dt>
          <dd>{action.approval}</dd>
        </div>
      </dl>
    </article>
  );
}

function RuleItem({ title, body }: { title: string; body: string }) {
  return (
    <article className={styles.ruleItem}>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function EvidenceItem({ label, path }: { label: string; path: string }) {
  return (
    <div className={styles.evidenceItem}>
      <span>{label}</span>
      <code>{path}</code>
    </div>
  );
}
