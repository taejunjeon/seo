"use client";

import Link from "next/link";

import styles from "./page.module.css";

type Tone = "strong" | "good" | "warn" | "danger" | "neutral";

type Kpi = {
  label: string;
  value: string;
  help: string;
  tone: Tone;
};

type FunnelStage = {
  stage: string;
  plainName: string;
  whatIsStored: string;
  storage: string;
  currentVerdict: string;
  gap: string;
  tone: Tone;
};

type ChannelPath = {
  channel: string;
  decision: string;
  landing: string;
  checkout: string;
  completion: string;
  confirmed: string;
  risk: string;
  test: string;
  tone: Tone;
};

type TestScenario = {
  name: string;
  why: string;
  steps: string[];
  pass: string;
  fail: string;
  owner: string;
};

type SmokeObservation = {
  label: string;
  status: string;
  source: string;
  result: string;
  next: string;
  tone: Tone;
};

const generatedAt = "2026-05-28 21:00 KST";

const kpis: Kpi[] = [
  {
    label: "지금 판단",
    value: "분리 운영",
    help: "begin_checkout은 결제 시작 이벤트로 유지하고, payment_page_seen은 운영 전환이 아닌 내부 진단 신호로 분리합니다.",
    tone: "strong",
  },
  {
    label: "Google Ads 보존",
    value: "강함",
    help: "gclid, gbraid, gad_campaignid가 착지, 결제시작, 결제완료 VM Cloud row까지 이어집니다.",
    tone: "good",
  },
  {
    label: "네이버 보존",
    value: "부분",
    help: "브랜드검색 UTM은 남지만 NaPm은 landing URL 안에만 있고 구조화 필드로 분리되지 않습니다.",
    tone: "warn",
  },
  {
    label: "Preview cleanup",
    value: "완료",
    help: "GTM Preview workspace 34는 백업 후 삭제했고, live version 24와 Default Workspace 변경 0을 확인했습니다.",
    tone: "good",
  },
];

const funnelStages: FunnelStage[] = [
  {
    stage: "01",
    plainName: "사이트 첫 유입",
    whatIsStored: "UTM, Google click id, fbclid, ttclid, referrer, landing URL",
    storage: "_p1s1a_first_touch, _p1s1a_last_touch, _p1s1a_session_touch, __thecleancoffee_click_id_context_v1",
    currentVerdict: "Google Ads와 UTM형 유입은 보존됩니다.",
    gap: "srsltid, NaPm, n_* 같은 네이버/구글 organic 세부값은 별도 필드로 정규화되지 않습니다.",
    tone: "good",
  },
  {
    stage: "02",
    plainName: "결제 시작",
    whatIsStored: "checkoutId, GA client/session, user_pseudo_id, UTM, click id, fbc/fbp",
    storage: "POST /api/attribution/checkout-context, __seo_checkout_context",
    currentVerdict: "광고 클릭 ID가 checkout_started 서버 payload와 VM Cloud row에 들어갑니다.",
    gap: "브라우저의 __seo_checkout_context snapshot은 UTM/click evidence가 비어 보일 수 있습니다. 결제 페이지 조회 자체는 Preview에서 확인했지만 운영 원장에는 아직 따로 쓰지 않습니다.",
    tone: "good",
  },
  {
    stage: "03",
    plainName: "결제 페이지 진입",
    whatIsStored: "GTM Meta InitiateCheckout는 운영 발화, payment_page_seen은 Preview dataLayer에 no-send로 확인",
    storage: "GTM live tag + GTM Preview no-send snapshot",
    currentVerdict: "결제하기 페이지 진입은 확인됐지만 운영 원장 write는 아직 하지 않습니다.",
    gap: "payment_page_seen을 운영 전환으로 보내면 begin_checkout과 중복됩니다. 필요하면 VM Cloud 5건 이하 canary write만 별도 승인합니다.",
    tone: "good",
  },
  {
    stage: "04",
    plainName: "결제완료 화면 도달",
    whatIsStored: "orderCode, orderNo/orderId, paymentKey, checkoutId, UTM, click id, fbc/fbp",
    storage: "POST /api/attribution/payment-success, attribution ledger, site_landing fan-out",
    currentVerdict: "Google Ads click id와 캠페인 힌트가 결제완료 payload까지 갑니다.",
    gap: "브라우저의 __seo_payment_success_context snapshot은 비어 보일 수 있습니다. Meta 숫자 campaign/adset/ad snapshot인 paidTouchBeforeCheckout도 아직 Coffee footer에 없습니다.",
    tone: "warn",
  },
  {
    stage: "05",
    plainName: "구매 확정 판단",
    whatIsStored: "payment decision status, browserAction, matchedBy, source",
    storage: "GET /api/attribution/payment-decision, VM Cloud attribution ledger",
    currentVerdict: "confirmed면 Purchase 허용, unknown/pending이면 PurchaseDecisionUnknown 등으로 분리됩니다.",
    gap: "이 판단은 운영DB가 아니라 VM Cloud 보조 원장 기준입니다. 실제 예산 ROAS에는 주문 정본 cross-check가 계속 필요합니다.",
    tone: "neutral",
  },
];

const channelPaths: ChannelPath[] = [
  {
    channel: "Google Ads",
    decision: "현재 가장 강하게 보존됩니다.",
    landing: "gclid, gbraid, wbraid 중 하나를 원자적으로 선택하고 gad_campaignid를 캠페인 힌트로 저장합니다.",
    checkout: "checkout_started 서버 payload와 VM Cloud row에 gclid/gbraid/gad_campaignid가 남습니다.",
    completion: "payment_success 서버 payload와 metadata에 gclid/gbraid/gad_campaignid가 다시 들어갑니다.",
    confirmed: "confirmed_purchase 후보가 되려면 실제 결제완료 주문 원장과 click id가 같은 window에서 맞아야 합니다.",
    risk: "gad_campaignid는 캠페인 힌트일 뿐 클릭 ID가 아니므로 단독 upload 후보가 아닙니다.",
    test: "광고 클릭 URL suffix 테스트에서 gclid 또는 gbraid와 gad_campaignid가 payment_success까지 남는지 확인합니다.",
    tone: "good",
  },
  {
    channel: "Naver 브랜드검색",
    decision: "UTM이 있으면 별도 브랜드검색 라인으로 볼 수 있습니다.",
    landing: "utm_source=naver_brand_search 같은 명시 UTM은 first/latest touch에 남습니다.",
    checkout: "UTM은 checkout_started payload로 이어집니다.",
    completion: "payment_success에도 UTM과 landing/referrer가 남아 브랜드검색 bridge 근거가 됩니다.",
    confirmed: "주문 정본 exact match가 붙어야 예산 판단용 브랜드검색 ROAS에 들어갑니다.",
    risk: "NaPm은 구조화 필드가 아니라 landing URL 내부 문자열로만 남습니다.",
    test: "네이버 브랜드검색 클릭 후 결제완료까지 last_touch와 payment_success metadata의 UTM을 확인합니다.",
    tone: "warn",
  },
  {
    channel: "Naver 쇼핑검색 / ADVoost",
    decision: "자사몰과 스마트스토어를 분리해야 합니다.",
    landing: "자사몰로 들어오면 referrer/UTM/NaPm 흔적을 볼 수 있지만, 스마트스토어 랜딩은 자사몰 footer가 실행되지 않습니다.",
    checkout: "자사몰 결제 페이지로 오지 않으면 checkout_started도 생기지 않습니다.",
    completion: "스마트스토어 구매는 자사몰 payment_success가 아닌 네이버 주문/정산 source가 필요합니다.",
    confirmed: "자사몰 ROAS와 섞지 말고 스마트스토어 매출 source를 별도로 붙여야 합니다.",
    risk: "ADVoost 총 ROAS를 자사몰 confirmed ROAS처럼 보면 과대평가됩니다.",
    test: "스마트스토어 랜딩 여부와 자사몰 payment_success 생성 여부를 분리해서 기록합니다.",
    tone: "danger",
  },
  {
    channel: "Meta paid / Instagram",
    decision: "기본 식별자는 남지만 캠페인 숫자 snapshot은 약합니다.",
    landing: "fbclid는 latest touch에 저장되고 fbc/fbp는 쿠키에서 checkout/payment payload로 보강됩니다.",
    checkout: "fbc/fbp는 checkout_started에 들어갑니다. GTM InitiateCheckout은 별도 browser event입니다.",
    completion: "payment_success에도 fbclid/fbc/fbp가 들어갑니다.",
    confirmed: "Purchase Guard가 confirmed 주문만 Meta Purchase로 통과시키는 구조입니다.",
    risk: "Biocom v4.4.5식 paidTouchBeforeCheckout이 없어 campaign/adset/ad 숫자 보존은 약합니다.",
    test: "Meta 광고 URL UTM 클릭 후 payment_success metadata에 fbclid/fbc/fbp와 UTM이 남는지 확인합니다.",
    tone: "warn",
  },
  {
    channel: "TikTok",
    decision: "ttclid와 UTM은 기본 보존됩니다.",
    landing: "ttclid와 UTM이 latest touch에 저장됩니다.",
    checkout: "checkout_started payload에 ttclid가 들어갑니다.",
    completion: "payment_success payload에 ttclid가 들어갑니다.",
    confirmed: "TikTok 실제 전송은 금지선입니다. 현재는 내부 evidence로만 봅니다.",
    risk: "TikTok campaign/adgroup/ad ID가 UTM으로 없으면 캠페인 단위 분해가 약합니다.",
    test: "ttclid 테스트 URL로 landing, checkout, payment_success 세 단계 보존을 확인합니다.",
    tone: "neutral",
  },
  {
    channel: "Google/Naver organic, direct",
    decision: "현재 구조화가 가장 약한 구간입니다.",
    landing: "external referrer와 landing URL은 남을 수 있지만 organic source label이 항상 명시되지는 않습니다.",
    checkout: "이전 paid UTM이 남아 있으면 organic 유입을 덮어쓰지 못할 수 있습니다.",
    completion: "payment_success는 lastTouch 중심이라 이전 paid 흔적과 섞일 수 있습니다.",
    confirmed: "예산 판단에서는 paid 근거가 약하면 organic/direct 후보로 낮춰야 합니다.",
    risk: "srsltid와 NaPm을 별도 필드로 저장하지 않으면 organic/paid 경계가 흐려집니다.",
    test: "시크릿 창에서 Google organic, Naver organic, direct를 각각 테스트해 previous paid value carry-over 여부를 확인합니다.",
    tone: "danger",
  },
];

const testScenarios: TestScenario[] = [
  {
    name: "Google Ads 클릭 ID 보존 smoke",
    why: "Google Ads 내부 confirmed ROAS를 만들려면 클릭 ID가 결제완료까지 살아야 합니다.",
    steps: [
      "시크릿 창에서 더클린커피 랜딩 URL에 gclid, gbraid, gad_campaignid, __seo_attribution_debug=1을 붙여 접속합니다.",
      "상품 상세로 이동해 구매하기를 누르고 주문서 화면으로 갑니다.",
      "주문서 화면에서 localStorage와 sessionStorage의 __thecleancoffee_click_id_context_v1을 확인합니다.",
      "가상계좌 또는 테스트 가능한 결제 흐름으로 주문완료 화면까지 갑니다.",
      "console에서 __thecleancoffee_server_payment_decision_last__와 payment_success network payload를 확인합니다.",
    ],
    pass: "checkout_started와 payment_success 양쪽에 gclid/gbraid 중 하나와 gad_campaignid가 있습니다.",
    fail: "주문서에는 있는데 결제완료에서 빠지면 checkout context 복구 경로를 수정해야 합니다.",
    owner: "Codex + TJ님",
  },
  {
    name: "네이버 브랜드검색 보존 smoke",
    why: "브랜드검색은 organic과 paid가 섞일 수 있어 마지막 유입 evidence가 필요합니다.",
    steps: [
      "네이버에서 더클린커피를 검색하고 브랜드검색 영역을 클릭합니다.",
      "랜딩 직후 console에서 _p1s1a_last_touch와 __thecleancoffee_click_id_context_v1을 확인합니다.",
      "상품 상세, 주문서, 주문완료까지 이동합니다.",
      "payment_success payload의 utm_source, utm_medium, landing, referrer를 확인합니다.",
    ],
    pass: "utm_source=naver_brand_search 계열 값이 결제완료까지 남습니다.",
    fail: "NaPm만 있고 UTM이 없으면 현재 구조에서는 브랜드검색 확정력이 낮습니다.",
    owner: "TJ님 테스트 + Codex 판독",
  },
  {
    name: "Organic carry-over 차단 smoke",
    why: "이전 paid touch가 organic 방문을 계속 잡아먹으면 ROAS가 부풀 수 있습니다.",
    steps: [
      "같은 브라우저에서 먼저 Google Ads 테스트 URL로 들어가 click context를 만듭니다.",
      "이탈 후 UTM 없는 Google organic 또는 direct URL로 다시 들어갑니다.",
      "last_touch가 이전 paid 값을 그대로 유지하는지 확인합니다.",
      "가능하면 시크릿 새 창에서도 같은 organic 테스트를 반복해 baseline을 분리합니다.",
    ],
    pass: "새 organic/direct 유입이 paid로 오인되지 않는 분류 규칙이 확인됩니다.",
    fail: "이전 gclid/UTM이 계속 남으면 organic/direct reset 또는 recency rule 설계가 필요합니다.",
    owner: "Codex + TJ님",
  },
];

const smokeObservations: SmokeObservation[] = [
  {
    label: "Coffee Google Ads 클릭 ID",
    status: "checkout/payment_success PASS",
    source: "TJ님 브라우저 콘솔 + VM Cloud attribution ledger, 최근 90분",
    result: "last_touch와 Coffee click context local/session에 google/cpc, gclid, gbraid, gad_campaignid가 남았고, VM Cloud checkout_started와 payment_success row도 같은 Google evidence를 보존했습니다.",
    next: "브라우저의 checkout_context/payment_success_context snapshot은 비어 보이므로, 표시/디버깅 gap 보강 후보로 분리합니다.",
    tone: "good",
  },
  {
    label: "Coffee 네이버 브랜드검색 결제완료",
    status: "payment_success PASS",
    source: "TJ님 브라우저 콘솔 + VM Cloud attribution ledger, 최근 90분",
    result: "가상계좌 미입금 완료 화면까지 갔고, VM Cloud payment_success row에 naver_brand_search UTM과 NaPm landing evidence가 남았습니다.",
    next: "이번 주문은 미입금이라 confirmed 구매가 아니라 pending/unknown 계열 검증으로 봅니다.",
    tone: "good",
  },
  {
    label: "Coffee payment_page_seen",
    status: "Preview PASS",
    source: "TJ님 Tag Assistant + Chrome console, 2026-05-28 KST",
    result: "결제하기 페이지에서 no-send payment_page_seen debug snapshot이 dataLayer에 남았습니다. 운영 endpoint 호출과 외부 플랫폼 전송은 없었습니다.",
    next: "운영 전환으로 보내지 않고 내부 진단 신호로만 둘지, 5건 이하 VM Cloud canary write를 별도 승인할지 판단합니다.",
    tone: "good",
  },
  {
    label: "Coffee Meta InitiateCheckout",
    status: "middle events 확인",
    source: "Meta Pixel Helper",
    result: "주문서 화면에서 InitiateCheckout과 AddPaymentInfo가 관측됐고, 결제완료 화면에서는 PurchaseDecisionUnknown이 관측됐습니다.",
    next: "Purchase Guard가 미입금 주문을 Purchase로 통과시키지 않은 상태입니다.",
    tone: "good",
  },
];

const checkoutSignalDecision = [
  {
    title: "상품상세 페이지",
    status: "payment_page_seen 없음이 정상",
    body: "상품 옵션을 고르고 구매하기 버튼을 누르는 화면입니다. 이 단계에서는 begin_checkout이나 Meta InitiateCheckout이 먼저 보일 수 있지만, 주문서 화면 도달 신호인 payment_page_seen은 아직 만들지 않는 쪽이 맞습니다.",
    evidence: "TJ님 Preview 흐름에서 상품상세 진입 시 payment_page_seen Preview는 없었고, 구매 CTA 이후 주문서에서만 Preview snapshot이 생겼습니다.",
    tone: "neutral" as Tone,
  },
  {
    title: "결제하기 페이지",
    status: "두 신호가 같이 보일 수 있음",
    body: "주문서 화면에 들어오면 기존 begin_checkout과 새 payment_page_seen Preview가 같은 페이지에서 모두 보일 수 있습니다. 이것은 오류가 아니라 역할 차이입니다.",
    evidence: "console 기준 begin_checkout dataLayer event가 먼저 보였고, 다음 event로 coffee_payment_page_seen_debug_snapshot_preview가 no-send payload를 남겼습니다.",
    tone: "good" as Tone,
  },
  {
    title: "운영 반영 판단",
    status: "중복 전환 금지",
    body: "둘 다 광고 플랫폼 전환으로 보내면 결제 시작 숫자가 중복됩니다. begin_checkout은 퍼널 이벤트로 유지하고, payment_page_seen은 내부 디버그 또는 제한 canary 후보로만 둡니다.",
    evidence: "Preview workspace cleanup 후 live version 24 유지, Default Workspace 변경 0, GTM publish 0, VM Cloud write 0, platform send 0을 확인했습니다.",
    tone: "strong" as Tone,
  },
];

const countDifferenceReasons = [
  "begin_checkout은 결제 시작 이벤트라 value/items 파싱, 주문서 작성 event, 기존 dedupe 조건의 영향을 받습니다.",
  "payment_page_seen은 주문서 화면 도달 신호라 페이지 진입, 새로고침, 로그인 후 복귀, 결제수단 변경 같은 행동을 더 넓게 잡을 수 있습니다.",
  "과거 Biocom 수치는 Imweb 코드와 VM Cloud durable row가 섞인 관측이고, Coffee의 이번 결과는 GTM Preview no-send dataLayer 관측입니다.",
  "따라서 숫자 차이는 같은 전환의 누락이 아니라 서로 다른 목적으로 설계된 신호를 다른 위치에서 센 결과입니다.",
];

function toneClass(tone: Tone) {
  return `${styles.pill} ${styles[`tone_${tone}`]}`;
}

export default function CoffeeAttributionPreservationPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/coffee">
            더클린커피 대시보드로 돌아가기
          </Link>
          <p className={styles.kicker}>Coffee Attribution Preservation</p>
          <h1>더클린커피 유입 보존 점검</h1>
          <p className={styles.lead}>
            이 화면의 질문은 “고객이 어디서 들어왔는지 결제완료와 구매 확정까지 남는가”입니다.
            최신 Imweb 코드 기준으로 유입별 보존 경로와 테스트 우선순위를 정리했습니다.
          </p>
          <div className={styles.metaLine}>
            <span>기준 시각 {generatedAt}</span>
            <span>source: imweb/code_coffee_260527.md + Preview smoke</span>
            <span>mode: read-only 분석 + no-send Preview 결과</span>
          </div>
        </div>
      </header>

      <section className={styles.kpiGrid} aria-label="핵심 판단">
        {kpis.map((item) => (
          <article className={styles.kpiCard} key={item.label}>
            <span className={toneClass(item.tone)}>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.help}</p>
          </article>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Live Smoke</p>
          <h2>방금 확인한 보존 상태</h2>
          <p>
            이 영역은 코드 추론이 아니라 실제 브라우저와 VM Cloud read-only 원장을 맞춘 결과입니다.
            raw 주문번호와 결제키는 표시하지 않습니다.
          </p>
        </div>
        <div className={styles.smokeGrid}>
          {smokeObservations.map((item) => (
            <article className={styles.smokeCard} key={item.label}>
              <div className={styles.rowTop}>
                <h3>{item.label}</h3>
                <span className={toneClass(item.tone)}>{item.status}</span>
              </div>
              <p className={styles.sourceText}>{item.source}</p>
              <div className={styles.resultGrid}>
                <div>
                  <strong>관측 결과</strong>
                  <p>{item.result}</p>
                </div>
                <div>
                  <strong>다음 확인</strong>
                  <p>{item.next}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Preview Decision</p>
          <h2>결제하기 페이지에서 두 신호가 같이 뜨는 이유</h2>
          <p>
            사람이 보는 화면 기준으로는 상품상세와 결제하기 페이지가 다릅니다. 이번 Preview는
            결제하기 페이지에서 기존 결제 시작 신호와 내부 진단 신호가 어떤 순서로 남는지 확인한 작업입니다.
          </p>
        </div>
        <div className={styles.channelGrid}>
          {checkoutSignalDecision.map((item) => (
            <article className={styles.channelCard} key={item.title}>
              <div className={styles.rowTop}>
                <h3>{item.title}</h3>
                <span className={toneClass(item.tone)}>{item.status}</span>
              </div>
              <p className={styles.why}>{item.body}</p>
              <div className={styles.testHint}>
                <strong>근거</strong>
                <p>{item.evidence}</p>
              </div>
            </article>
          ))}
        </div>
        <div className={styles.reasonBox}>
          <strong>발화 숫자가 달랐던 이유</strong>
          <ol>
            {countDifferenceReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Funnel Map</p>
          <h2>퍼널 단계별로 남는 값</h2>
          <p>
            주문 매출 정본과 광고 클릭 evidence를 섞지 않기 위해, 각 단계에서 “무엇이 남는지”와
            “아직 약한 부분”을 분리했습니다.
          </p>
        </div>
        <div className={styles.stageList}>
          {funnelStages.map((stage) => (
            <article className={styles.stageRow} key={stage.stage}>
              <div className={styles.stageNumber}>{stage.stage}</div>
              <div>
                <div className={styles.rowTop}>
                  <h3>{stage.plainName}</h3>
                  <span className={toneClass(stage.tone)}>{stage.currentVerdict}</span>
                </div>
                <dl className={styles.detailGrid}>
                  <div>
                    <dt>남는 값</dt>
                    <dd>{stage.whatIsStored}</dd>
                  </div>
                  <div>
                    <dt>저장 위치</dt>
                    <dd>{stage.storage}</dd>
                  </div>
                  <div>
                    <dt>주의점</dt>
                    <dd>{stage.gap}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Channel Decision</p>
          <h2>주요 유입별 보존 판정</h2>
          <p>
            같은 결제완료 주문이라도 Google Ads, 네이버 브랜드검색, Meta, organic은 예산 판단에 쓰는
            기준이 다릅니다. 그래서 채널마다 보존 경로와 리스크를 별도로 봅니다.
          </p>
        </div>
        <div className={styles.channelGrid}>
          {channelPaths.map((path) => (
            <article className={styles.channelCard} key={path.channel}>
              <div className={styles.rowTop}>
                <h3>{path.channel}</h3>
                <span className={toneClass(path.tone)}>{path.decision}</span>
              </div>
              <ol className={styles.pathList}>
                <li><b>착지</b>{path.landing}</li>
                <li><b>결제 시작</b>{path.checkout}</li>
                <li><b>결제완료</b>{path.completion}</li>
                <li><b>확정 판단</b>{path.confirmed}</li>
              </ol>
              <div className={styles.warningBox}>
                <strong>리스크</strong>
                <p>{path.risk}</p>
              </div>
              <div className={styles.testHint}>
                <strong>테스트</strong>
                <p>{path.test}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Smoke Plan</p>
          <h2>TJ님과 같이 진행할 테스트</h2>
          <p>
            Codex가 대신 할 수 없는 실제 브라우저 유입은 TJ님 테스트가 필요합니다. 대신 결과 판독,
            콘솔 명령, 보존 여부 판정은 Codex가 이어받을 수 있습니다.
          </p>
        </div>
        <div className={styles.testGrid}>
          {testScenarios.map((scenario) => (
            <article className={styles.testCard} key={scenario.name}>
              <div className={styles.rowTop}>
                <h3>{scenario.name}</h3>
                <span className={toneClass("neutral")}>{scenario.owner}</span>
              </div>
              <p className={styles.why}>{scenario.why}</p>
              <ol>
                {scenario.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <div className={styles.resultGrid}>
                <div>
                  <strong>성공 기준</strong>
                  <p>{scenario.pass}</p>
                </div>
                <div>
                  <strong>실패 시 해석</strong>
                  <p>{scenario.fail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Recommendation</p>
          <h2>교체보다 먼저 할 일</h2>
          <p>
            지금은 전체 footer 교체가 아니라 측정 공백을 좁히는 순서가 맞습니다.
            운영 저장이나 외부 전송 없이 먼저 확인할 수 있는 항목부터 닫습니다.
          </p>
        </div>
        <div className={styles.actionStrip}>
          <div>
            <span className={toneClass("good")}>P0</span>
            <strong>live smoke로 실제 보존 확인</strong>
            <p>Google Ads와 네이버 브랜드검색은 바로 같은 브라우저 테스트로 확인할 수 있습니다.</p>
          </div>
          <div>
            <span className={toneClass("warn")}>P1</span>
            <strong>NaPm/srsltid 구조화 보강안</strong>
            <p>후보 작성 완료. raw ci/hk/srsltid는 저장하지 않고 present/source/type 요약값만 남기는 방식입니다.</p>
          </div>
          <div>
            <span className={toneClass("good")}>P2 PASS</span>
            <strong>Google Ads 클릭 ID smoke</strong>
            <p>synthetic gclid/gbraid/gad_campaignid는 결제완료 VM Cloud row까지 남았습니다. 다음은 실제 광고 클릭 window와 confirmed 주문 원장 window를 맞추는 단계입니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
