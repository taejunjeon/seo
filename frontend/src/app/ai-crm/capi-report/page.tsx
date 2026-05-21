import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";

type SiteMetric = {
  site: string;
  window: "최근 24시간" | "최근 7일";
  pixelId: string;
  purchaseSuccess: number;
  strongMetaEvidence: number;
  unprovenOrNonMeta: number;
  utmPresent: number;
  utmMissing: number;
  fbcPresent: number;
  fbclidPresent: number;
  noLedgerMatch: number;
  failed: number;
  duplicate: number;
};

type KrProgress = {
  id: string;
  title: string;
  progress: number;
  plainMeaning: string;
  nextAction: string;
};

type GlossaryTerm = {
  term: string;
  plain: string;
};

type MiddleConversionEvent = {
  label: string;
  eventName: string;
  status: "dry-run 우선" | "gap 확인" | "내부 지표 우선" | "후보 보류";
  why: string;
  next: string;
};

type ScrollIntegritySummary = {
  site: string;
  ga4Sessions: number;
  rawScroll90Rate: number | null;
  assumedScroll90Rate: number | null;
  inflationPoint: number | null;
  pageViewLongRate: number | null;
  reviewReachRate: number | null;
  apiBuyerScroll90: number | null;
  apiNonBuyerScroll90: number | null;
  interpretation: string;
};

type SegmentMetric = {
  label: string;
  sessions: number;
  buyers: number;
  revenue: number;
  buyerRate: number;
  p50Dwell: number | null;
  scroll90: number | null;
  interpretation: string;
};

type SourceLandingDetail = {
  site: string;
  sourceSummary: string;
  landingSummary: string;
  sources: SegmentMetric[];
  landings: SegmentMetric[];
};

type MatchQualityParameter = {
  label: string;
  metaUi: string;
  liveCoverage: string;
  status: "정상" | "부분" | "미연동" | "보류";
  plain: string;
  next: string;
};

type BrowserCapiOption = {
  label: string;
  status: "운영 기본값" | "조건부 테스트" | "비추천";
  plain: string;
  whenUseful: string;
  risk: string;
  next: string;
};

const checkedAtKst = "2026-05-20 23:20 KST";
const freshness = "Meta Events Manager 캡처 + VM Cloud read-only 진단 기준";

const siteMetrics: SiteMetric[] = [
  {
    site: "바이오컴",
    window: "최근 24시간",
    pixelId: "1283400029487161",
    purchaseSuccess: 50,
    strongMetaEvidence: 23,
    unprovenOrNonMeta: 27,
    utmPresent: 31,
    utmMissing: 19,
    fbcPresent: 22,
    fbclidPresent: 16,
    noLedgerMatch: 0,
    failed: 0,
    duplicate: 0,
  },
  {
    site: "바이오컴",
    window: "최근 7일",
    pixelId: "1283400029487161",
    purchaseSuccess: 367,
    strongMetaEvidence: 177,
    unprovenOrNonMeta: 190,
    utmPresent: 261,
    utmMissing: 106,
    fbcPresent: 174,
    fbclidPresent: 137,
    noLedgerMatch: 0,
    failed: 0,
    duplicate: 0,
  },
  {
    site: "더클린커피",
    window: "최근 24시간",
    pixelId: "1186437633687388",
    purchaseSuccess: 16,
    strongMetaEvidence: 4,
    unprovenOrNonMeta: 12,
    utmPresent: 15,
    utmMissing: 1,
    fbcPresent: 4,
    fbclidPresent: 4,
    noLedgerMatch: 0,
    failed: 0,
    duplicate: 0,
  },
  {
    site: "더클린커피",
    window: "최근 7일",
    pixelId: "1186437633687388",
    purchaseSuccess: 203,
    strongMetaEvidence: 38,
    unprovenOrNonMeta: 165,
    utmPresent: 185,
    utmMissing: 18,
    fbcPresent: 38,
    fbclidPresent: 33,
    noLedgerMatch: 0,
    failed: 0,
    duplicate: 0,
  },
];

const krProgress: KrProgress[] = [
  {
    id: "KR1",
    title: "실제 결제완료만 Purchase 후보로 남긴다",
    progress: 96,
    plainMeaning: "결제 페이지 방문이나 미입금 주문을 구매로 세지 않게 막는 안전장치입니다.",
    nextAction: "value mismatch와 refund/cancel post-check를 반복 가능한 스크립트로 고정합니다.",
  },
  {
    id: "KR2",
    title: "Server CAPI 성공과 누락 큐를 매일 분리한다",
    progress: 92,
    plainMeaning: "실제 구매가 Meta에 갔는지, 빠진 주문이 있는지 매일 구분합니다.",
    nextAction: "5/14~5/15 legacy backlog는 전송하지 않고 보관 문구로 유지합니다.",
  },
  {
    id: "KR3",
    title: "브라우저 이벤트와 서버 이벤트를 분리해 판단한다",
    progress: 90,
    plainMeaning: "브라우저 픽셀이 약해도 서버 구매 신호가 살아 있으면 치명 장애로 보지 않습니다.",
    nextAction: "CAPI-only를 운영 기본값으로 유지하고, Browser Purchase는 같은 eventID 샘플이 확인될 때만 test-only로 검증합니다.",
  },
  {
    id: "KR4",
    title: "광고 유입 evidence 품질을 높인다",
    progress: 66,
    plainMeaning: "구매를 Meta가 만든 것인지, 다른 유입인지 구분하는 신뢰도를 높입니다.",
    nextAction: "Meta UTM/source 미매핑 bucket을 줄이고 source alias map을 보강합니다.",
  },
  {
    id: "KR5",
    title: "중간 전환 신호를 수집한다",
    progress: 80,
    plainMeaning: "구매 전 장바구니, 결제 시작, 결제수단 선택 같은 선행 신호를 봅니다.",
    nextAction: "더클린커피 begin_checkout과 AddPaymentInfo gap을 GA4/VM 기준으로 닫습니다.",
  },
  {
    id: "KR6",
    title: "운영자가 보는 대시보드 contract를 안정화한다",
    progress: 45,
    plainMeaning: "화면 숫자가 어떤 원장과 기간에서 나온 값인지 항상 표시합니다.",
    nextAction: "leading-indicators P1 API를 VM Cloud precompute cache로 운영 연결합니다.",
  },
  {
    id: "KR7",
    title: "Events Manager 검증과 환불 보정을 준비한다",
    progress: 70,
    plainMeaning: "Meta UI에서 구매 수신, 매칭 품질, 취소/환불 보정 기준을 닫습니다.",
    nextAction: "이벤트 매칭 품질 6.1/10 기준선을 만들고 email/phone/external_id는 no-send 후보율부터 확인합니다.",
  },
  {
    id: "KR8",
    title: "구매 전 선행지표를 찾는다",
    progress: 52,
    plainMeaning: "구매한 사람과 멈춘 사람의 체류시간, 스크롤, 결제 시작 행동 차이를 찾습니다.",
    nextAction: "4 cohort 구조로 구매 완료, 결제 멈춤, GA4 충돌, 보류를 분리합니다.",
  },
];

const architectureSteps = [
  {
    title: "유입과 광고 식별자 저장",
    body: "landing, fbc, fbclid, UTM, gclid를 VM Cloud 원장에 남겨 광고 evidence를 확보합니다.",
  },
  {
    title: "결제 흐름 분리",
    body: "결제 페이지는 payment_page_seen, 완료 URL은 payment_success로 나눠 구매 과발화를 막습니다.",
  },
  {
    title: "구매 확정 가드",
    body: "confirmed, value > 0, 취소/환불 아님, duplicate 0 조건을 통과한 주문만 Purchase 후보가 됩니다.",
  },
  {
    title: "Meta CAPI 전송",
    body: "서버가 Meta로 Purchase를 보내고 events_received=1, failed=0, duplicate=0을 확인합니다.",
  },
  {
    title: "운영 화면 감시",
    body: "누락 큐, source confidence, Ads Manager 지연을 분리해 다음 액션을 결정합니다.",
  },
];

const nextActionCards = [
  {
    title: "이벤트 매칭 품질 6.1/10 올리기",
    summary: "Meta가 구매자를 더 정확히 알아볼 수 있게 안전한 고객정보 이름표를 보강합니다.",
    why: "Purchase 이벤트는 회복됐지만 이벤트 매칭 품질이 낮으면 Meta가 구매를 광고 클릭과 연결하는 힘이 약합니다. Meta UI도 이메일, 전화번호, 외부 ID 추가를 권장하고 있습니다.",
    how: "운영 전송 전에 VM Cloud와 운영DB/Imweb/Toss에서 이메일·전화·안전한 external_id 후보가 얼마나 존재하는지 no-send로 계산합니다. 그 다음 해시·동의·민감정보 기준을 통과한 항목만 Test Events에서 검증합니다.",
    codexCanDo: "Codex 가능: read-only 후보율 audit, external_id 안전 설계, Test Events 승인안, frontend 보고서 반영까지 가능. 실제 고객정보 전송은 개인정보/동의 검토와 승인 전 하지 않습니다.",
    success: "Purchase의 email/phone/external_id 후보율과 예상 EMQ 개선 우선순위가 숫자로 나오고, 운영 전송 전 위험 항목이 분리된다.",
    researchScore: 92,
    designScore: 86,
  },
  {
    title: "Meta UTM/source 미매핑 줄이기",
    summary: "Meta가 만든 구매인지 아직 약한 구매 row를 줄입니다.",
    why: "CAPI Purchase는 전송되고 있지만, strong Meta evidence가 낮으면 내부 ROAS와 Ads Manager ROAS 차이를 설명하기 어렵습니다.",
    how: "VM Cloud ledger, CAPI send log, fbc/fbclid/UTM/campaign hint를 read-only로 묶어 `strong_meta_ad_evidence`, `non_meta_or_unproven_meta`, `utm_missing` bucket을 다시 나누고 source alias map 후보를 만듭니다.",
    codexCanDo: "Codex 가능: read-only audit, dry-run 분류표, source alias map 초안, backend/frontend 반영안 작성까지 가능. 광고 계정 설정 변경이나 GTM publish는 별도 승인 전 하지 않습니다.",
    success: "최근 7일 기준 미확정 bucket의 원인별 비율과 바로 보강할 alias 후보가 나온다.",
    researchScore: 94,
    designScore: 90,
  },
  {
    title: "중간 전환 CAPI 확장",
    summary: "구매 전에 어떤 행동이 좋은 신호인지 서버 원장에 남깁니다.",
    why: "Purchase만 보면 이미 늦습니다. 장바구니, 결제 시작, 결제수단 선택, 스크롤 50% 같은 선행 행동을 봐야 광고 소재와 랜딩 개선이 빨라집니다.",
    how: "기존 GA4/GTM/VM Cloud row를 먼저 대조해 이미 잡히는 이벤트와 빠지는 이벤트를 나눕니다. 이후 no-send dry-run으로 Meta CAPI에 보낼 수 있는 표준 이벤트 후보를 설계합니다.",
    codexCanDo: "Codex 가능: GA4 BigQuery read-only 확인, VM Cloud row 집계, 이벤트 contract 설계, 로컬 backend patch까지 가능. 실제 Meta CAPI 중간 이벤트 send는 승인 전 하지 않습니다.",
    success: "각 사이트별 AddToCart, InitiateCheckout, AddPaymentInfo, Scroll50 수집 가능 여부와 CAPI 확장 후보가 정리된다.",
    researchScore: 88,
    designScore: 86,
  },
  {
    title: "선행지표 API 운영 연결",
    summary: "구매자와 멈춘 사람의 행동 차이를 운영 화면에 올립니다.",
    why: "Meta 광고 유입 후 구매한 사람과 멈춘 사람의 체류시간, 스크롤 깊이, 결제 시작률 차이를 알아야 예산과 콘텐츠를 행동 기준으로 판단할 수 있습니다.",
    how: "confirmed_buyer, checkout_non_buyer, ga4_purchase_conflict, pending_payment_success 4개 cohort로 분리한 aggregate API를 precompute cache로 붙이고, 프론트는 raw key 없이 비율과 중앙값만 표시합니다.",
    codexCanDo: "Codex 가능: P1 endpoint 로컬 구현, cache smoke, VM Cloud 배포 승인안, API contract 작성까지 가능. 프론트 시각화 구현은 Claude Code handoff가 적합합니다.",
    success: "운영 화면에서 4개 cohort별 체류시간, scroll90, begin_checkout, add_payment_info 차이를 볼 수 있다.",
    researchScore: 91,
    designScore: 92,
  },
];

const glossaryTerms: GlossaryTerm[] = [
  {
    term: "CAPI",
    plain: "서버가 Meta에 구매 신호를 보내는 통로입니다. 브라우저 픽셀이 놓쳐도 서버가 대신 구매를 알려줄 수 있습니다.",
  },
  {
    term: "UTM/source mapping",
    plain: "구매가 어떤 광고 링크나 유입에서 왔는지 이름표를 붙이는 작업입니다.",
  },
  {
    term: "strong Meta evidence",
    plain: "Meta 광고 클릭 증거가 충분해서 이 구매를 Meta 유입으로 볼 가능성이 높은 주문 묶음입니다.",
  },
  {
    term: "dry-run",
    plain: "실제 외부 전송 없이 내부에서만 계산해보는 예행연습입니다.",
  },
  {
    term: "Event Match Quality",
    plain: "Meta가 서버 구매 이벤트를 실제 사람/광고 클릭과 얼마나 잘 맞출 수 있는지 보는 점수입니다.",
  },
  {
    term: "external_id",
    plain: "이메일이나 전화번호 대신 우리 시스템이 만든 안전한 고객 이름표입니다. 원문 ID를 그대로 보내면 안 됩니다.",
  },
];

const eventMatchQualitySummary = {
  score: "6.1/10",
  source: "Meta Events Manager Purchase 화면 · 2026-05-20 확인",
  liveDiagnostic: "VM Cloud read-only · 최근 24시간 표본",
  plain:
    "구매 이벤트는 회복됐지만 Meta가 구매자를 광고 클릭과 더 정확히 맞추는 고객정보 이름표는 아직 부족합니다.",
  additionalParamNote:
    "Meta UI의 ‘기타 매개변수 추가 전환’은 이메일, 전화번호, 외부 ID 같은 추가 이름표를 넣었을 때 보고 전환이 더 잡힐 수 있다는 진단입니다. 현재는 CAPI 표본/매개변수 부족으로 성과 확인이 아직 충분하지 않습니다.",
};

const browserCapiEventIdAudit = {
  checkedAt: "2026-05-21 KST",
  source: "VM Cloud /api/meta/capi/log read-only · 최근 7일 recent_operational",
  serverResult:
    "Server CAPI Purchase 503건 중 success 503건, failed 0건, eventID 중복 0건입니다. 최근 표본 500건은 모두 Purchase. 계열 eventID를 사용했습니다.",
  browserResult:
    "브라우저 Purchase는 사용자의 브라우저가 Meta로 직접 보내는 신호라 VM Cloud 로그에는 eventID가 남지 않습니다. 따라서 read-only만으로 Browser와 CAPI가 같은 eventID라고 확정할 수는 없습니다.",
  decision:
    "현재 운영 기본값은 CAPI-only입니다. Browser+CAPI 혼합은 Meta Events Manager 또는 Network 샘플에서 같은 eventID가 확인될 때만 테스트해야 합니다.",
};

const browserCapiOptions: BrowserCapiOption[] = [
  {
    label: "CAPI-only 유지",
    status: "운영 기본값",
    plain:
      "구매는 서버가 확정 결제만 Meta로 보냅니다. 브라우저 Purchase가 안 보여도 서버 구매 신호가 정상이라면 운영 학습 신호는 살아 있습니다.",
    whenUseful:
      "지금처럼 CAPI success가 높고 duplicate가 0이며, 브라우저 eventID를 아직 확정하지 못한 상황에서 가장 안전합니다.",
    risk:
      "Meta Pixel Helper에서 Browser Purchase가 안 보여 운영자가 불안할 수 있고, 브라우저 쪽 매칭/디버깅 단서는 적습니다.",
    next:
      "계속 기본값으로 둡니다. 이벤트 매칭 품질은 email/phone/external_id 후보율 no-send audit으로 개선합니다.",
  },
  {
    label: "Browser Purchase + CAPI 혼합",
    status: "조건부 테스트",
    plain:
      "브라우저와 서버가 같은 구매를 각각 보내되, 같은 eventID를 써서 Meta가 한 건으로 합치게 하는 방식입니다.",
    whenUseful:
      "Meta UI에서 Browser Purchase를 같이 확인하고 싶거나, 브라우저 신호가 매칭 품질 보강에 실제 도움이 되는지 검증할 때 씁니다.",
    risk:
      "eventID가 다르면 같은 주문이 두 번 잡힐 수 있습니다. 반대로 브라우저만 raw 주문번호를 쓰고 서버만 안전한 ID로 바꾸면 중복 제거가 깨질 수 있습니다.",
    next:
      "운영 상시 적용 전에 test-only 완료 페이지 1건에서 Network eventID와 CAPI eventID가 같은지 샘플로 확인합니다.",
  },
  {
    label: "Browser Purchase-only",
    status: "비추천",
    plain:
      "구매를 브라우저 픽셀에만 맡기는 방식입니다. 결제 완료 페이지 이탈, 차단 확장, 브라우저 timeout에 취약합니다.",
    whenUseful:
      "현재 운영 복구 전략으로는 쓸 이유가 거의 없습니다. Meta UI 디버깅용 임시 테스트 정도만 의미가 있습니다.",
    risk:
      "결제완료인데 Purchase가 안 찍히는 문제가 재발할 수 있고, 서버 confirmed/value guard를 우회해 잘못된 구매가 들어갈 수 있습니다.",
    next:
      "운영 적용하지 않습니다. 필요하면 preview/test-only에서만 검증합니다.",
  },
];

const matchQualityParameters: MatchQualityParameter[] = [
  {
    label: "IP 주소",
    metaUi: "총 이벤트의 100%",
    liveCoverage: "바이오컴 44/44 · 더클린커피 17/17",
    status: "정상",
    plain: "서버가 접속 위치 단서인 IP를 Meta user_data에 넣고 있습니다.",
    next: "유지합니다.",
  },
  {
    label: "사용자 에이전트",
    metaUi: "총 이벤트의 100%",
    liveCoverage: "바이오컴 44/44 · 더클린커피 17/17",
    status: "정상",
    plain: "브라우저와 기기 종류를 알려주는 기본 단서입니다.",
    next: "유지합니다.",
  },
  {
    label: "브라우저 ID(fbp)",
    metaUi: "총 이벤트의 100%",
    liveCoverage: "바이오컴 43/44 · 더클린커피 17/17",
    status: "정상",
    plain: "Meta 픽셀이 만든 브라우저 이름표입니다.",
    next: "누락 1건만 계속 모니터링합니다.",
  },
  {
    label: "클릭 ID(fbc)",
    metaUi: "총 이벤트의 60%",
    liveCoverage: "바이오컴 19/44 · 더클린커피 5/17",
    status: "부분",
    plain: "Meta 광고 클릭에서 이어진 이름표입니다. 광고 클릭이 아니면 없을 수 있지만, 광고 유입인데 빠지면 ROAS 연결력이 약해집니다.",
    next: "fbclid 복원과 landing row capture를 더 확인합니다.",
  },
  {
    label: "이메일 주소",
    metaUi: "추가 권장",
    liveCoverage: "Toss read-only 표본 0/44 · 0/17",
    status: "미연동",
    plain: "코드는 해시 전송 준비가 있지만 현재 운영 소스에서 값이 들어오지 않습니다.",
    next: "운영DB/Imweb/회원 원장에서 해시 후보율을 no-send로 계산합니다.",
  },
  {
    label: "전화번호",
    metaUi: "추가 권장",
    liveCoverage: "Toss read-only 표본 0/44 · 0/17",
    status: "미연동",
    plain: "코드는 해시 전송 준비가 있지만 현재 Toss 응답에는 값이 없습니다.",
    next: "동의/개인정보 기준을 먼저 세운 뒤 hashed phone 후보율을 봅니다.",
  },
  {
    label: "외부 ID(external_id)",
    metaUi: "추가 권장",
    liveCoverage: "현재 Purchase user_data 미포함",
    status: "미연동",
    plain: "우리 시스템이 만든 안전한 고객 이름표입니다. 원문 주문/회원 ID를 그대로 쓰지 않고 HMAC 같은 안전한 방식이 필요합니다.",
    next: "raw id 없는 safe external_id 설계와 no-send 후보율 audit을 진행합니다.",
  },
  {
    label: "Facebook 로그인 ID",
    metaUi: "추가 권장",
    liveCoverage: "Facebook Login 연동 없음",
    status: "보류",
    plain: "Facebook Login 사용자를 식별하는 값입니다. 현재 쇼핑몰 흐름에는 직접 연동되어 있지 않습니다.",
    next: "현재는 낮은 우선순위로 보류합니다.",
  },
];

const middleConversionEvents: MiddleConversionEvent[] = [
  {
    label: "결제 시작",
    eventName: "begin_checkout / InitiateCheckout",
    status: "dry-run 우선",
    why: "구매 직전 행동이라 선행 신호 가치가 가장 큽니다.",
    next: "GA4와 VM Cloud에서 같은 흐름으로 붙는지 먼저 확인합니다.",
  },
  {
    label: "결제수단 선택",
    eventName: "add_payment_info / AddPaymentInfo",
    status: "gap 확인",
    why: "결제 의지가 강한 지점이지만 현재 사이트별 감지 누락이 있습니다.",
    next: "더클린커피와 바이오컴을 따로 집계해 누락 원인을 나눕니다.",
  },
  {
    label: "장바구니",
    eventName: "add_to_cart / view_cart",
    status: "gap 확인",
    why: "구매 의도는 있지만 클릭 기준과 페이지 진입 기준이 섞이면 해석이 흔들립니다.",
    next: "장바구니 클릭과 장바구니 페이지 진입을 분리해 dry-run 표에 올립니다.",
  },
  {
    label: "스크롤 50% / 긴 조회",
    eventName: "scroll_50 / page_view_long",
    status: "내부 지표 우선",
    why: "관심도 신호지만 Meta 표준 구매 전환으로 바로 보내기엔 잡음이 큽니다.",
    next: "선행지표 에이전트에서 구매자와 이탈자 차이를 먼저 확인합니다.",
  },
  {
    label: "쿠폰 받기",
    eventName: "coupon_receive / Lead 후보",
    status: "후보 보류",
    why: "할인 의향 신호지만 쿠폰 발급과 실제 사용을 분리해야 합니다.",
    next: "쿠폰 받기 이벤트가 GA4/GTM에 안정적으로 찍히는지 먼저 확인합니다.",
  },
];

const scrollIntegrity: ScrollIntegritySummary[] = [
  {
    site: "바이오컴",
    ga4Sessions: 64063,
    rawScroll90Rate: 14.22,
    assumedScroll90Rate: 14.22,
    inflationPoint: 0,
    pageViewLongRate: 8.25,
    reviewReachRate: 23.5,
    apiBuyerScroll90: 51.1,
    apiNonBuyerScroll90: 30,
    interpretation:
      "GA4 원본에서는 scroll 이벤트에 90% 값이 실제로 들어옵니다. 다만 live API의 51.1%/30.0%는 Meta cohort 안에서 scroll 값을 아는 세션만 분모로 계산한 값이라 전체 방문자 scroll90 14.2%와 직접 비교하면 안 됩니다.",
  },
  {
    site: "더클린커피",
    ga4Sessions: 3904,
    rawScroll90Rate: 0,
    assumedScroll90Rate: 56.48,
    inflationPoint: 56.48,
    pageViewLongRate: 13.96,
    reviewReachRate: 26.51,
    apiBuyerScroll90: null,
    apiNonBuyerScroll90: null,
    interpretation:
      "GA4에는 scroll 이벤트가 많지만 percent_scrolled 값이 0으로 들어옵니다. 따라서 과거처럼 scroll 이벤트 자체를 90%로 간주하면 수치가 크게 부풀어집니다. 더클린커피는 VM row에 dwell/scroll metadata가 부족해 현재 API가 null로 표시하는 것이 더 안전합니다.",
  },
];

const sourceLandingDetails: SourceLandingDetail[] = [
  {
    site: "바이오컴",
    sourceSummary:
      "Meta는 최근 7일 427세션 중 186세션이 구매로 닫혀 주요 유입 중 구매율이 높습니다. 다만 direct/unknown도 572세션·162구매라, 출처 이름표가 빠진 구매를 줄여야 내부 ROAS가 더 정확해집니다.",
    landingSummary:
      "Meta cohort는 /shop_payment가 344세션으로 압도적입니다. 즉 많은 row가 상품 탐색 페이지가 아니라 결제 흐름 중간에서 잡히므로, 랜딩 성과와 결제 단계 성과를 분리해서 봐야 합니다.",
    sources: [
      {
        label: "Meta 광고 evidence",
        sessions: 427,
        buyers: 186,
        revenue: 65202742,
        buyerRate: 43.6,
        p50Dwell: 43.5,
        scroll90: 40.4,
        interpretation: "구매율과 매출 기여가 가장 크며, 선행지표 분석의 우선 대상입니다.",
      },
      {
        label: "직접/미확인",
        sessions: 572,
        buyers: 162,
        revenue: 43032179,
        buyerRate: 28.3,
        p50Dwell: 36.5,
        scroll90: 20.1,
        interpretation: "구매 규모가 커서 일부 광고 유입이 이름표 없이 섞였을 가능성을 계속 줄여야 합니다.",
      },
      {
        label: "네이버 paid/brand",
        sessions: 369,
        buyers: 23,
        revenue: 5671037,
        buyerRate: 6.2,
        p50Dwell: 38,
        scroll90: 15.2,
        interpretation: "유입은 많지만 구매율은 낮습니다. 브랜드/검색 의도 분리가 필요합니다.",
      },
      {
        label: "YouTube",
        sessions: 17,
        buyers: 8,
        revenue: 744800,
        buyerRate: 47.1,
        p50Dwell: 53,
        scroll90: 28.6,
        interpretation: "구매율은 높지만 표본이 작아 확장 판단 전 2주 이상 누적이 필요합니다.",
      },
    ],
    landings: [
      {
        label: "/shop_payment",
        sessions: 344,
        buyers: 150,
        revenue: 52741249,
        buyerRate: 43.6,
        p50Dwell: 43,
        scroll90: 40.9,
        interpretation: "결제 단계 유입이 대부분입니다. 랜딩 페이지 품질보다 결제 흐름 품질 지표로 해석해야 합니다.",
      },
      {
        label: "/shop_view",
        sessions: 35,
        buyers: 2,
        revenue: 974000,
        buyerRate: 5.7,
        p50Dwell: 46.5,
        scroll90: 25,
        interpretation: "상품상세 진입 기준 구매율은 낮습니다. 상품페이지에서 결제까지 이어지는 bridge를 따로 봐야 합니다.",
      },
      {
        label: "igg_store 등 캠페인형 path",
        sessions: 9,
        buyers: 7,
        revenue: 2216093,
        buyerRate: 77.8,
        p50Dwell: 69,
        scroll90: 100,
        interpretation: "비율은 좋지만 표본이 작습니다. landing bucket 정규화 후 같은 계열을 묶어야 합니다.",
      },
      {
        label: "홈 / 장바구니 / 로그인",
        sessions: 12,
        buyers: 0,
        revenue: 0,
        buyerRate: 0,
        p50Dwell: 105,
        scroll90: 62.5,
        interpretation: "스크롤이 높아도 구매가 없을 수 있습니다. scroll90 단독으로 구매 예측을 하면 위험합니다.",
      },
    ],
  },
  {
    site: "더클린커피",
    sourceSummary:
      "YouTube와 Meta 모두 구매율이 높지만, direct/unknown 구매도 큽니다. 더클린커피는 UTM 기타·미확정 bucket이 커서 source alias map과 GA4 join 보강이 우선입니다.",
    landingSummary:
      "/shop_view는 구매율이 높고 /shop_payment는 confirmed 구매가 0입니다. 이는 결제 페이지 진입과 실제 구매확정이 분리되어 있거나, cohort window/session bridge가 아직 약하다는 신호입니다.",
    sources: [
      {
        label: "YouTube",
        sessions: 84,
        buyers: 45,
        revenue: 3974997,
        buyerRate: 53.6,
        p50Dwell: null,
        scroll90: null,
        interpretation: "구매율이 가장 높습니다. 콘텐츠 유입의 선행지표 후보로 따로 관리할 가치가 있습니다.",
      },
      {
        label: "Meta 광고 evidence",
        sessions: 107,
        buyers: 43,
        revenue: 2514869,
        buyerRate: 40.2,
        p50Dwell: null,
        scroll90: null,
        interpretation: "구매율은 좋지만 dwell/scroll이 null입니다. VM 또는 GA4 bridge로 행동 품질을 붙여야 합니다.",
      },
      {
        label: "직접/미확인",
        sessions: 224,
        buyers: 79,
        revenue: 4886190,
        buyerRate: 35.3,
        p50Dwell: null,
        scroll90: null,
        interpretation: "매출 규모가 가장 큽니다. 광고/콘텐츠 유입이 direct로 묻히는지 audit이 필요합니다.",
      },
      {
        label: "네이버 paid/brand",
        sessions: 150,
        buyers: 34,
        revenue: 1916456,
        buyerRate: 22.7,
        p50Dwell: null,
        scroll90: null,
        interpretation: "구매율은 낮지만 표본이 있어 키워드/브랜드 검색 구분이 필요합니다.",
      },
    ],
    landings: [
      {
        label: "/shop_view",
        sessions: 61,
        buyers: 37,
        revenue: 2046252,
        buyerRate: 60.7,
        p50Dwell: null,
        scroll90: null,
        interpretation: "상품상세가 바로 구매로 이어지는 핵심 bucket입니다. 리뷰/쿠폰/구매하기 이벤트 보강 우선입니다.",
      },
      {
        label: "/shop_payment",
        sessions: 39,
        buyers: 0,
        revenue: 0,
        buyerRate: 0,
        p50Dwell: null,
        scroll90: null,
        interpretation: "결제 페이지 진입은 있으나 구매확정과 같은 safe key로 닫히지 않습니다. 결제 중단 또는 bridge 보강 대상입니다.",
      },
      {
        label: "홈",
        sessions: 5,
        buyers: 4,
        revenue: 372002,
        buyerRate: 80,
        p50Dwell: null,
        scroll90: null,
        interpretation: "표본은 작지만 구매 전환이 있습니다. 캠페인 링크가 홈으로 들어오는지 확인할 만합니다.",
      },
      {
        label: "thecleancoffee path",
        sessions: 2,
        buyers: 2,
        revenue: 96615,
        buyerRate: 100,
        p50Dwell: null,
        scroll90: null,
        interpretation: "표본이 너무 작아 참고만 봅니다.",
      },
    ],
  },
];

const fmtPct = (num: number, den: number) => {
  if (!den) return "0.0%";
  return `${((num / den) * 100).toFixed(1)}%`;
};

const fmtMaybePct = (value: number | null) => (value === null ? "관측 부족" : `${value.toFixed(1)}%`);
const fmtMaybeSeconds = (value: number | null) => (value === null ? "관측 부족" : `${value.toFixed(1)}초`);
const fmtKrw = (value: number) => `₩${value.toLocaleString("ko-KR")}`;

export default function CapiReportPage() {
  const biocom7d = siteMetrics.find((row) => row.site === "바이오컴" && row.window === "최근 7일")!;
  const coffee7d = siteMetrics.find((row) => row.site === "더클린커피" && row.window === "최근 7일")!;

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Meta CAPI 개발 보고서</p>
            <h1 className={styles.title}>
              구매 이벤트는 회복됐습니다. 이제 Meta가 구매자를 더 잘 알아보게 만들어야 합니다
            </h1>
            <p className={styles.subtitle}>
              CAPI(서버가 Meta에 구매 신호를 보내는 통로)는 정상화됐고 Purchase도 다시 잡히고 있습니다.
              다음 병목은 이벤트 매칭 품질 6.1/10입니다. 즉 Meta가 구매 이벤트를 어떤 사람과 광고 클릭에
              붙일 수 있는지, 어떤 고객정보 이름표가 아직 부족한지를 보는 단계입니다.
            </p>
          </div>
          <div className={styles.sourceBox}>
            <span className={styles.sourceLabel}>데이터 기준</span>
            <strong>{checkedAtKst}</strong>
            <span>{freshness}</span>
            <span>source: VM Cloud funnel-health · CAPI send log · capivm plan</span>
            <span>외부 전송 0 · 운영DB write 0 · raw identifier 출력 0</span>
          </div>
        </header>

        <section className={styles.questionPanel} aria-label="이 화면이 답하는 질문">
          <div className={styles.questionMain}>
            <span>이 화면의 질문</span>
            <strong>Meta가 구매 신호를 받고 있는가, 그리고 다음에 어떤 신호를 더 붙여야 하는가?</strong>
            <p>
              지금은 “구매가 갔는지”보다 “구매가 어떤 광고/행동에서 왔는지”를 더 잘 설명하는 단계입니다.
              중간 전환은 바로 보내지 않고 dry-run(실제 전송 없는 예행연습)으로 먼저 안전성을 확인합니다.
            </p>
          </div>
          <div className={styles.glossaryGrid}>
            {glossaryTerms.map((item) => (
              <div key={item.term} className={styles.glossaryItem}>
                <strong>{item.term}</strong>
                <p>{item.plain}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.decisionBand} aria-label="현재 판단">
          <div className={styles.decisionItem}>
            <span className={styles.decisionStatusGood}>정상</span>
            <strong>Server CAPI Purchase 경로 정상</strong>
            <p>
              최근 7일 바이오컴 {biocom7d.purchaseSuccess}건, 더클린커피{" "}
              {coffee7d.purchaseSuccess}건이 성공으로 집계됐고 실패/중복은 0입니다.
            </p>
          </div>
          <div className={styles.decisionItem}>
            <span className={styles.decisionStatusGood}>정상</span>
            <strong>원장과 전송 로그 join 정상</strong>
            <p>
              두 사이트 모두 최근 24시간·7일 기준 no_ledger_match가 0입니다. 즉 CAPI 숫자가
              다른 사이트와 섞이는 문제는 현재 화면 계약에서는 닫혀 있습니다.
            </p>
          </div>
          <div className={styles.decisionItem}>
            <span className={styles.decisionStatusWatch}>개선</span>
            <strong>이벤트 매칭 품질은 6.1/10</strong>
            <p>
              IP, 사용자 에이전트, fbp는 정상입니다. 다만 fbc는 부분이고 이메일·전화·external_id는 아직
              운영 전송 전이라 Meta가 권장하는 추가 매개변수 개선 여지가 큽니다.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>이벤트 매칭 품질(Event Match Quality)</h2>
            <p>
              구매가 Meta로 가는 것과, Meta가 그 구매를 “누가 어떤 광고를 보고 산 것인지” 잘 맞추는 것은
              다른 문제입니다. 현재는 구매 신호 회복 후 고객정보 이름표를 보강해야 하는 단계입니다.
            </p>
          </div>
          <div className={styles.insightGrid}>
            <article className={styles.insightCard}>
              <div className={styles.insightHead}>
                <strong>현재 점수 {eventMatchQualitySummary.score}</strong>
                <span>{eventMatchQualitySummary.source}</span>
              </div>
              <p>{eventMatchQualitySummary.plain}</p>
              <dl className={styles.compactStats}>
                <div>
                  <dt>기본 이름표</dt>
                  <dd>IP/UA/fbp 정상</dd>
                </div>
                <div>
                  <dt>광고 클릭 이름표</dt>
                  <dd>fbc 부분</dd>
                </div>
                <div>
                  <dt>고객정보 이름표</dt>
                  <dd>email/phone 미연동</dd>
                </div>
                <div>
                  <dt>외부 ID</dt>
                  <dd>설계 필요</dd>
                </div>
              </dl>
            </article>
            <article className={styles.insightCard}>
              <div className={styles.insightHead}>
                <strong>기타 매개변수 추가 전환</strong>
                <span>{eventMatchQualitySummary.liveDiagnostic}</span>
              </div>
              <p>{eventMatchQualitySummary.additionalParamNote}</p>
              <p>
                현재 backend는 이메일/전화번호가 들어오면 해시해서 보낼 준비가 있지만, 최근 표본에서는
                Toss 응답에서 이메일·전화번호가 0건으로 관측됐습니다. external_id는 아직 Purchase
                user_data에 넣지 않습니다.
              </p>
            </article>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.metricTable}>
              <thead>
                <tr>
                  <th>매개변수</th>
                  <th>Meta UI</th>
                  <th>VM Cloud 관측</th>
                  <th>상태</th>
                  <th>쉬운 해석</th>
                  <th>다음 조치</th>
                </tr>
              </thead>
              <tbody>
                {matchQualityParameters.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.metaUi}</td>
                    <td>{row.liveCoverage}</td>
                    <td>
                      <span className={styles.paramStatus}>{row.status}</span>
                    </td>
                    <td>{row.plain}</td>
                    <td>{row.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.safetyNote}>
            <strong>운영 전송 전 금지선</strong>
            <span>
              이메일, 전화번호, external_id는 매칭 품질을 올릴 수 있지만 개인정보/동의/해시 기준이 필요합니다.
              바로 운영 전송하지 않고 no-send 후보율 계산 → Test Events 검증 → 승인 후 배포 순서로 진행합니다.
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>CAPI 수집/전송 현황</h2>
            <p>사이트별 Pixel ID로 먼저 분리한 뒤 집계합니다. all-sites 합산값은 여기서 쓰지 않습니다.</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.metricTable}>
              <thead>
                <tr>
                  <th>사이트</th>
                  <th>기간</th>
                  <th>Pixel</th>
                  <th>CAPI Purchase 성공</th>
                  <th>strong Meta evidence</th>
                  <th>fbc / fbclid</th>
                  <th>비Meta/미확정</th>
                  <th>UTM 없음</th>
                  <th>failed</th>
                  <th>duplicate</th>
                </tr>
              </thead>
              <tbody>
                {siteMetrics.map((row) => (
                  <tr key={`${row.site}-${row.window}`}>
                    <td>{row.site}</td>
                    <td>{row.window}</td>
                    <td className={styles.mono}>{row.pixelId}</td>
                    <td>{row.purchaseSuccess.toLocaleString("ko-KR")}건</td>
                    <td>
                      {row.strongMetaEvidence.toLocaleString("ko-KR")}건{" "}
                      <span className={styles.subValue}>({fmtPct(row.strongMetaEvidence, row.purchaseSuccess)})</span>
                    </td>
                    <td>
                      {row.fbcPresent.toLocaleString("ko-KR")} /{" "}
                      {row.fbclidPresent.toLocaleString("ko-KR")}
                    </td>
                    <td>
                      {row.unprovenOrNonMeta.toLocaleString("ko-KR")}건{" "}
                      <span className={styles.subValue}>({fmtPct(row.unprovenOrNonMeta, row.purchaseSuccess)})</span>
                    </td>
                    <td>
                      {row.utmMissing.toLocaleString("ko-KR")}건{" "}
                      <span className={styles.subValue}>({fmtPct(row.utmMissing, row.purchaseSuccess)})</span>
                    </td>
                    <td>{row.failed}</td>
                    <td>{row.duplicate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Browser Purchase와 Server CAPI를 섞어 쓸지</h2>
            <p>
              Browser Purchase는 사용자의 브라우저가 Meta에 직접 보내는 구매 신호이고, Server CAPI는 서버가
              확정 결제만 Meta에 보내는 구매 신호입니다. 둘을 같이 쓰려면 같은 구매를 같은 eventID로 보내
              Meta가 한 건으로 합치게 해야 합니다.
            </p>
          </div>
          <div className={styles.insightGrid}>
            <article className={styles.insightCard}>
              <div className={styles.insightHead}>
                <strong>read-only audit 결과</strong>
                <span>{browserCapiEventIdAudit.checkedAt}</span>
              </div>
              <dl className={styles.compactStats}>
                <div>
                  <dt>source</dt>
                  <dd>{browserCapiEventIdAudit.source}</dd>
                </div>
                <div>
                  <dt>서버 CAPI</dt>
                  <dd>success 503 · failed 0 · duplicate 0</dd>
                </div>
                <div>
                  <dt>eventID 형태</dt>
                  <dd>Purchase. 계열</dd>
                </div>
                <div>
                  <dt>판정</dt>
                  <dd>CAPI-only 유지</dd>
                </div>
              </dl>
              <p>{browserCapiEventIdAudit.serverResult}</p>
            </article>
            <article className={styles.insightCard}>
              <div className={styles.insightHead}>
                <strong>아직 확정할 수 없는 부분</strong>
                <span>Browser eventID verification gap</span>
              </div>
              <p>{browserCapiEventIdAudit.browserResult}</p>
              <p>{browserCapiEventIdAudit.decision}</p>
              <div className={styles.safetyNote}>
                <strong>중복 제거 뜻</strong>
                <span>
                  같은 주문을 브라우저와 서버가 둘 다 보낼 때, eventID가 같으면 Meta가 “이건 같은 구매”라고
                  알아보고 한 건으로 합칩니다. eventID가 다르면 같은 주문이 두 번 잡힐 수 있습니다.
                </span>
              </div>
            </article>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.metricTable}>
              <thead>
                <tr>
                  <th>운영 방식</th>
                  <th>판정</th>
                  <th>쉬운 설명</th>
                  <th>언제 유용한가</th>
                  <th>리스크</th>
                  <th>다음 조치</th>
                </tr>
              </thead>
              <tbody>
                {browserCapiOptions.map((option) => (
                  <tr key={option.label}>
                    <td>{option.label}</td>
                    <td>
                      <span className={styles.paramStatus}>{option.status}</span>
                    </td>
                    <td>{option.plain}</td>
                    <td>{option.whenUseful}</td>
                    <td>{option.risk}</td>
                    <td>{option.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>scroll90 무결성 점검</h2>
            <p>
              scroll90은 “페이지를 90%까지 봤다”는 뜻으로 쓰고 싶지만, 수집 방식에 따라 크게 달라집니다.
              그래서 GA4 원본값과 VM Cloud 선행지표 API 값을 분리해서 봅니다.
            </p>
          </div>
          <div className={styles.insightGrid}>
            {scrollIntegrity.map((item) => (
              <article key={item.site} className={styles.insightCard}>
                <div className={styles.insightHead}>
                  <strong>{item.site}</strong>
                  <span>{item.ga4Sessions.toLocaleString("ko-KR")} GA4 세션</span>
                </div>
                <dl className={styles.compactStats}>
                  <div>
                    <dt>GA4 원본 scroll90</dt>
                    <dd>{fmtMaybePct(item.rawScroll90Rate)}</dd>
                  </div>
                  <div>
                    <dt>scroll 이벤트를 90%로 간주</dt>
                    <dd>{fmtMaybePct(item.assumedScroll90Rate)}</dd>
                  </div>
                  <div>
                    <dt>과대 가능성</dt>
                    <dd>{fmtMaybePct(item.inflationPoint)}</dd>
                  </div>
                  <div>
                    <dt>page_view_long</dt>
                    <dd>{fmtMaybePct(item.pageViewLongRate)}</dd>
                  </div>
                  <div>
                    <dt>리뷰 영역/URL 도달</dt>
                    <dd>{fmtMaybePct(item.reviewReachRate)}</dd>
                  </div>
                  <div>
                    <dt>API 구매자 vs 멈춤</dt>
                    <dd>
                      {fmtMaybePct(item.apiBuyerScroll90)} / {fmtMaybePct(item.apiNonBuyerScroll90)}
                    </dd>
                  </div>
                </dl>
                <p>{item.interpretation}</p>
              </article>
            ))}
          </div>
          <div className={styles.safetyNote}>
            <strong>분모 보강 필요</strong>
            <span>
              leadingIndicators API는 현재 scroll 값을 아는 세션만 분모로 scroll90을 계산합니다.
              화면에는 `scroll_known_sessions`, `scroll_unknown_sessions`, 전체 세션 대비 비율, 관측 세션 대비 비율,
              수집 source를 함께 내려줘야 안전합니다.
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Source / Landing Bucket Detail</h2>
            <p>
              source는 “어디서 온 유입인가”, landing bucket은 “어느 화면에서 잡힌 흐름인가”입니다.
              같은 구매라도 광고 evidence, 직접 유입, 결제 페이지 진입이 섞이면 해석이 달라집니다.
            </p>
          </div>
          <div className={styles.segmentStack}>
            {sourceLandingDetails.map((detail) => (
              <article key={detail.site} className={styles.segmentPanel}>
                <div className={styles.segmentIntro}>
                  <h3>{detail.site}</h3>
                  <p>{detail.sourceSummary}</p>
                  <p>{detail.landingSummary}</p>
                </div>
                <div className={styles.segmentColumns}>
                  <div>
                    <h4>Source Detail</h4>
                    <ul className={styles.segmentList}>
                      {detail.sources.map((segment) => (
                        <li key={segment.label}>
                          <div className={styles.segmentLine}>
                            <strong>{segment.label}</strong>
                            <span>
                              {segment.sessions.toLocaleString("ko-KR")}세션 · {segment.buyers.toLocaleString("ko-KR")}구매 ·{" "}
                              {fmtKrw(segment.revenue)} · 구매율 {segment.buyerRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className={styles.segmentMeta}>
                            <span>p50 체류 {fmtMaybeSeconds(segment.p50Dwell)}</span>
                            <span>scroll90 {fmtMaybePct(segment.scroll90)}</span>
                          </div>
                          <p>{segment.interpretation}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Landing Bucket Detail</h4>
                    <ul className={styles.segmentList}>
                      {detail.landings.map((segment) => (
                        <li key={segment.label}>
                          <div className={styles.segmentLine}>
                            <strong>{segment.label}</strong>
                            <span>
                              {segment.sessions.toLocaleString("ko-KR")}세션 · {segment.buyers.toLocaleString("ko-KR")}구매 ·{" "}
                              {fmtKrw(segment.revenue)} · 구매율 {segment.buyerRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className={styles.segmentMeta}>
                            <span>p50 체류 {fmtMaybeSeconds(segment.p50Dwell)}</span>
                            <span>scroll90 {fmtMaybePct(segment.scroll90)}</span>
                          </div>
                          <p>{segment.interpretation}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>개발 구조</h2>
            <p>구매로 세기 전까지 여러 번 막고, 확정된 구매만 Meta로 보냅니다.</p>
          </div>
          <ol className={styles.flowList}>
            {architectureSteps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNo}>{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>중간 전환 CAPI 확장 전 dry-run</h2>
            <p>
              구매 전 행동 신호를 Meta로 바로 보내지 않고, 먼저 내부에서만 계산해 후보와 위험을 나눕니다.
              바이오컴과 더클린커피는 따로 집계합니다.
            </p>
          </div>
          <div className={styles.middleGrid}>
            {middleConversionEvents.map((event) => (
              <article key={event.label} className={styles.middleCard}>
                <div className={styles.middleHead}>
                  <strong>{event.label}</strong>
                  <span>{event.status}</span>
                </div>
                <p className={styles.mono}>{event.eventName}</p>
                <dl>
                  <div>
                    <dt>왜 보는가</dt>
                    <dd>{event.why}</dd>
                  </div>
                  <div>
                    <dt>다음 확인</dt>
                    <dd>{event.next}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className={styles.safetyNote}>
            <strong>금지선</strong>
            <span>
              이 dry-run은 Meta CAPI 실제 전송 0, GA4 Measurement Protocol 전송 0, GTM publish 0,
              운영DB write 0 조건으로만 진행합니다.
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>KR 진척률</h2>
            <p>capivm 계획서 기준입니다. 숫자는 개발/검증/운영 연결을 합친 진행률입니다.</p>
          </div>
          <div className={styles.krGrid}>
            {krProgress.map((kr) => (
              <article key={kr.id} className={styles.krCard}>
                <div className={styles.krHead}>
                  <span>{kr.id}</span>
                  <strong>{kr.progress}%</strong>
                </div>
                <h3>{kr.title}</h3>
                <div className={styles.progressTrack} aria-label={`${kr.id} progress ${kr.progress}%`}>
                  <span style={{ width: `${kr.progress}%` }} />
                </div>
                <p>{kr.plainMeaning}</p>
                <small>다음 개발: {kr.nextAction}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.actionSection}>
          <div>
            <h2>바로 다음 할 일</h2>
            <p>
              아래 카드는 단순 결론이 아니라 다음 실행 순서입니다. CAPI 성공 자체는 안정화됐고,
              이제 “이 구매가 어떤 광고/유입에서 왔는가”와 “구매 전 어떤 행동이 매출을 예고하는가”를 닫아야 합니다.
            </p>
          </div>
          <div className={styles.actionGrid}>
            {nextActionCards.map((card, index) => (
              <article key={card.title} className={styles.actionCard}>
                <div className={styles.actionCardHead}>
                  <span>{index + 1}</span>
                  <strong>{card.title}</strong>
                </div>
                <p className={styles.actionSummary}>{card.summary}</p>
                <dl className={styles.actionDetails}>
                  <div>
                    <dt>왜</dt>
                    <dd>{card.why}</dd>
                  </div>
                  <div>
                    <dt>어떻게</dt>
                    <dd>{card.how}</dd>
                  </div>
                  <div>
                    <dt>Codex 가능 범위</dt>
                    <dd>{card.codexCanDo}</dd>
                  </div>
                  <div>
                    <dt>성공 기준</dt>
                    <dd>{card.success}</dd>
                  </div>
                </dl>
                <div className={styles.scoreRow} aria-label={`${card.title} scores`}>
                  <span>자료 조사 {card.researchScore}%</span>
                  <span>설계 {card.designScore}%</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.related}>
          <Link href="/ai-crm/conversion-funnel">전환 퍼널 관제 보기</Link>
          <Link href="/ai-crm/leading-indicators">선행지표 에이전트 보기</Link>
          <Link href="/#ai-crm">AI CRM 허브로 돌아가기</Link>
        </section>
      </main>
    </>
  );
}
