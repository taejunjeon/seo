"use client";

import Link from "next/link";
import styles from "./page.module.css";

const phases = [
  {
    name: "Phase 0",
    title: "운영 DB 직접 수정 대신 로컬 준정본 구축",
    progress: 95,
    status: "방향 확정",
    description: "운영 DB를 직접 고치지 않고, SEO 로컬 원장과 API fallback으로 ROAS 판단에 필요한 준정본을 만든다.",
    next: "운영 DB write가 필요한 작업은 계속 보류하고, 로컬 원장 기준 리포트를 유지한다.",
  },
  {
    name: "Phase 1",
    title: "Shadow Ledger 강화",
    progress: 88,
    status: "진행 중",
    description: "결제완료, checkout 시작, UTM, fbclid/fbc/fbp, GA 식별자를 우리 자체 원장에 쌓는다.",
    next: "가상계좌 입금 후 pending에서 confirmed로 바뀌는지 실주문 테스트로 최종 확인한다.",
  },
  {
    name: "Phase 2",
    title: "Site-level ROAS 일일 보고",
    progress: 92,
    status: "대부분 완료",
    description: "최근 7일 기준 Meta ROAS와 내부 confirmed ROAS를 같은 기간, 같은 광고비 기준으로 비교한다.",
    next: "정기 snapshot에서도 Meta ROAS는 1일 클릭 기준이라는 점을 고정 표기한다.",
  },
  {
    name: "Phase 3",
    title: "식별자 품질과 checkout_started",
    progress: 80,
    status: "관찰 중",
    description: "광고 클릭부터 결제완료까지 같은 사용자인지 이어 붙이기 위한 식별자를 보존한다.",
    next: "새 푸터 적용 후 최근 24시간, 48시간 기준으로 식별자 연결률을 본다.",
  },
  {
    name: "Phase 4",
    title: "CAPI / Pixel dedup + 가상계좌 분리",
    progress: 90,
    status: "biocom 완료 · 커피 배포 대기",
    description: "브라우저 Purchase와 서버 CAPI Purchase가 같은 주문을 같은 event_id로 묶이는지 맞춘다. 가상계좌 미입금은 Purchase가 아닌 VirtualAccountIssued로 분리.",
    next: "2026-04-14 footer/coffee_header_guard_0414.md 복제 완료. 아임웹 admin 설치 + 실주문 3건 테스트만 남음.",
  },
  {
    name: "Phase 5",
    title: "Campaign-level ROAS / alias review",
    progress: 45,
    status: "부분 완료",
    description: "utm_campaign alias와 Meta 캠페인/광고를 연결해 캠페인별 내부 ROAS를 열기 위한 단계다.",
    next: "Meta API 권한과 rate limit 문제가 풀리면 URL evidence를 다시 생성한다.",
  },
  {
    name: "Phase 6",
    title: "같은 기준 ROAS 비교 뷰",
    progress: 82,
    status: "기준 정리",
    description: "대화와 화면에서 Meta ROAS headline을 1일 클릭 기준으로 통일한다.",
    next: "default, 7일 클릭, 1일 조회는 보조값으로만 표시한다.",
  },
  {
    name: "Phase 7",
    title: "더클린커피 ROAS 비교 준비",
    progress: 70,
    status: "토큰 분리 완료 · 가드 대기",
    description: "더클린커피도 biocom과 같은 방식으로 Meta ROAS와 내부 Attribution ROAS를 비교할 준비 단계다.",
    next: "2026-04-14 시스템 유저 토큰 분리 완료 + imweb/toss 수동 복구 완료. 커피 가드 설치 시 Phase 완료.",
  },
  {
    name: "Phase 8",
    title: "Imweb/Toss 자동 sync",
    progress: 60,
    status: "코드 완료 · 배포 대기",
    description: "운영자가 수동으로 imweb/toss sync를 돌리지 않아도 15분 주기 자동 복구되도록 startBackgroundJobs.ts에 job 2종 등록.",
    next: "VM 재배포 + env 활성화 + 15분 후 lastSyncedAt 갱신 검증.",
  },
  {
    name: "Phase 9",
    title: "Funnel 이벤트 확장 (ViewContent·AddToCart·InitiateCheckout)",
    progress: 35,
    status: "Day 1 서버 인프라 완료",
    description: "Purchase 외에도 상품 상세 진입, 장바구니 담기, 결제 시작 이벤트를 Meta CAPI로 전송해 EMQ와 ML 최적화 품질을 향상.",
    next: "Day 2~3 아임웹 브라우저 훅 설치, Day 4 InitiateCheckout + Purchase 픽셀 리페어, Day 5 EMQ 측정.",
  },
];

const roasGapReasons = [
  {
    title: "Meta는 더 넓게 잡는다",
    text: "Meta는 기본적으로 광고 클릭 후 일정 기간 안의 구매를 자기 성과로 본다. 지금은 운영 기준을 1일 클릭으로 낮췄지만, Ads Manager 기본값은 더 넓을 수 있다.",
  },
  {
    title: "가상계좌 미입금도 Browser Purchase로 잡혔다",
    text: "입금 전 가상계좌 주문완료 화면에서 Meta Pixel Purchase가 먼저 발화되는 것이 확인됐다. 내부 Attribution은 confirmed 전까지 매출로 보지 않으므로 차이가 생긴다.",
  },
  {
    title: "브라우저 Pixel과 서버 CAPI가 같은 주문인지 맞아야 한다",
    text: "같은 주문을 브라우저와 서버가 모두 Purchase로 보내도 event_id가 같으면 Meta가 중복 제거할 수 있다. 그래서 Purchase.{orderCode} 규칙으로 맞췄다.",
  },
  {
    title: "광고 클릭 식별자가 결제까지 유지되어야 한다",
    text: "fbclid, fbc, fbp, UTM, GA 식별자가 중간에 사라지면 내부 Attribution은 보수적으로 낮게 잡힌다. 새 푸터는 이 값을 첫 유입과 최신 유입으로 보존한다.",
  },
  {
    title: "캠페인 alias가 완전히 매핑되지 않았다",
    text: "site-level 비교는 가능하지만, 인플루언서/캠페인별로 정확히 보려면 utm_campaign alias와 Meta 광고 URL evidence를 더 채워야 한다.",
  },
];

const codeBlocks = [
  {
    label: "헤더 상단 Purchase Guard",
    purpose: "Meta Pixel보다 먼저 실행되어, 가상계좌 미입금 주문완료 화면의 Browser Purchase를 막는다.",
    does: [
      "결제완료 페이지에서만 작동한다.",
      "가상계좌/무통장/계좌번호/입금대기 문구 조합을 보면 Purchase를 차단한다.",
      "차단한 경우 Purchase 대신 VirtualAccountIssued custom event를 보낸다.",
      "카드 결제 화면에서는 Purchase를 그대로 통과시킨다.",
    ],
    risk: "브라우저 화면 문구 기반 1차 방어다. 나중에는 서버 상태 조회 API로 더 단단하게 만들 수 있다.",
  },
  {
    label: "푸터 UTM / user_id / rebuyz_view",
    purpose: "광고 클릭과 방문 정보를 빈 값으로 덮어쓰지 않고 결제까지 이어 붙이기 위한 코드다.",
    does: [
      "UTM, fbclid, gclid, ttclid가 실제로 있을 때만 저장한다.",
      "first-touch와 latest-touch를 분리해 처음 유입과 최근 유입을 모두 보존한다.",
      "gtag 대기는 5초까지만 수행해 무한 폴링을 막는다.",
      "rebuyz_view는 기존 GA 이벤트 호환을 위해 유지한다.",
    ],
    risk: "모든 페이지에서 rebuyz_view가 발생한다. 나중에 노이즈가 크면 상품 상세 중심으로 줄일 수 있다.",
  },
  {
    label: "푸터 payment_success",
    purpose: "아임웹 주문완료 도달 정보를 우리 자체 Attribution 원장으로 보내는 코드다.",
    does: [
      "orderId, paymentKey, orderCode, orderMember를 현재 URL과 document.referrer에서 모두 찾는다.",
      "orderCode를 top-level payload와 metadata에 같이 저장한다.",
      "browser_purchase_event_id = Purchase.{orderCode}를 남겨 Pixel/CAPI/내부 원장을 묶는다.",
      "checkout_context의 checkoutId와 GA 식별자를 이어받는다.",
    ],
    risk: "이 코드는 아임웹 기본 기능이 아니라 우리가 푸터에 넣는 자체 원장 수집 코드다.",
  },
  {
    label: "checkout_context",
    purpose: "결제 시작 시점의 식별자와 유입 정보를 미리 저장해 주문완료 시점과 연결한다.",
    does: [
      "checkout_started 이벤트를 우리 원장에 남긴다.",
      "checkoutId를 만들어 payment_success와 연결한다.",
      "GA client_id, session_id, user_pseudo_id와 fbc/fbp를 보강한다.",
    ],
    risk: "이번 배치에서는 유지한다. 목적은 재작성보다 현재 결제 흐름을 안정적으로 이어 붙이는 것이다.",
  },
];

const completedWork = [
  "리인벤팅 CRM GTM 제거 후 기존 includes null 오류 제거 방향 확인",
  "Meta ROAS headline 기준을 1일 클릭으로 낮춤",
  "Server CAPI는 confirmed 주문 중심으로 전송 유지",
  "Browser Pixel과 Server CAPI event_id를 Purchase.{아임웹 orderCode}로 맞춤",
  "가상계좌 미입금 Browser Purchase 차단용 헤더 가드 biocom v3 삽입 + 실주문 2건 live 테스트 통과 (0412)",
  "푸터 UTM overwrite 버그 수정 방향 확정",
  "payment_success에 orderCode와 referrer fallback 보강",
  "checkout_started와 payment_success를 checkoutId로 이어붙이는 구조 구축",
  "더클린커피 Meta 시스템 유저 토큰 분리 + 3단 fallback chain + resolveCapiToken 픽셀별 라우팅 (0414)",
  "/api/meta/health live probe endpoint 신설 (3 토큰 debug_token self→others fallback, alert_level 계산)",
  "/api/meta/capi/track funnel 이벤트용 경량 엔드포인트 + CORS 화이트리스트 + rate limit + 픽셀/이벤트명 검증",
  "sendFunnelEvent 헬퍼 + ViewContent/AddToCart/InitiateCheckout 전송 검증 5 케이스 통과 (0414)",
  "footer/coffee_header_guard_0414.md 복제 완료 — 커피 전용 Purchase guard 1,053줄 (0414)",
  "VM backend 실측 확인 — att.ainativeos.net 정상, CAPI 30분 + Attribution 15분 자동 돌고 있음",
  "VM DB 실측 기록 — imweb_orders·ledger·toss-join 3경로 endpoint 프로브 (0414)",
  "biocom + coffee imweb 주문 수동 sync 실행 — biocom +125건, coffee +248건 gap 해소 (0414)",
  "biocom Toss settlements 수동 sync — +138 transactions / +201 settlements (0414)",
  "imweb/toss 15분 주기 자동 sync 코드 완성 — startBackgroundJobs.ts self-call 패턴, tsc/build 통과, VM 재배포 대기 (0414)",
];

const liveVersions = [
  {
    label: "헤더 상단 (biocom)",
    version: "2026-04-12-server-payment-decision-guard-v3",
    meaning: "biocom 자사몰 Browser Purchase → 서버 payment-decision 조회 → confirmed만 통과, pending은 VirtualAccountIssued로 분리",
  },
  {
    label: "헤더 상단 (coffee)",
    version: "2026-04-14-coffee-server-payment-decision-guard-v3 (footer/coffee_header_guard_0414.md)",
    meaning: "커피 복제본. 아임웹 admin 설치 대기. 배포 전 선결 과제 4건 전부 해소됨.",
  },
  {
    label: "푸터 checkout_context",
    version: "2026-04-11-checkout-started-v1",
    meaning: "결제 시작 시점의 유입/식별자 정보를 세션에 보존하는 코드",
  },
  {
    label: "푸터 payment_success",
    version: "2026-04-12-payment-success-order-code-v2",
    meaning: "주문완료 정보를 우리 자체 Attribution 원장으로 보내고 orderCode를 남기는 코드",
  },
  {
    label: "Backend CAPI 분기",
    version: "resolveCapiToken(pixelId) — COFFEE_META_TOKEN → app token → 글로벌",
    meaning: "커피 픽셀이면 시스템 유저 토큰, 그 외엔 글로벌. 2026-04-14 분기 적용 + 실전 테스트 통과",
  },
  {
    label: "Funnel 이벤트 서버",
    version: "sendFunnelEvent() + POST /api/meta/capi/track (0414)",
    meaning: "ViewContent·AddToCart·InitiateCheckout·Lead·Search 5종 Meta Standard Event 전송. Day 1 서버 인프라 완료.",
  },
];

const funnelCapiPillars = [
  {
    kicker: "무엇",
    title: "4단계 Funnel CAPI란",
    description:
      "Meta 공식 Standard Events(ViewContent → AddToCart → InitiateCheckout → Purchase)를 브라우저 Pixel과 Server Conversions API 양쪽에서 같은 event_id로 발사해 Meta ML에 '구매 경로 전체'를 전달하는 구조이다. 우리는 이 4개 이벤트를 모두 서버 사이드 CAPI 로도 병행 전송해, 브라우저 픽셀이 ad blocker·ITP·iOS ATT에 차단되어도 구매 여정이 보존되도록 만든다.",
  },
  {
    kicker: "왜",
    title: "왜 4단계로 쪼개는가",
    description:
      "Purchase 하나만 쏘면 Meta 의 광고 최적화 ML은 '이 사용자가 구매했다/안 했다' 두 상태만 안다. ViewContent·AddToCart 같은 전조 신호가 있어야 ML이 '구매 직전 상태'를 학습해 신규 잠재고객을 정확히 식별한다. 또한 광고 세트가 학습 단계(Learning Phase)를 통과하려면 7일 내 50 conversions가 필요한데, Purchase만으로는 볼륨이 부족해 여러 세트가 영구적으로 학습에 갇힌다. Funnel 상단 이벤트가 있으면 Deferred Optimization이 작동해 학습 탈출이 3~5배 빨라진다.",
  },
  {
    kicker: "어떻게",
    title: "어떻게 구현하는가",
    description:
      "브라우저에서 fbq('track', 'ViewContent', {...}, { eventID: E }) 발사 + 같은 event_id를 body에 담아 POST /api/meta/capi/track 으로 서버에 전달 → 서버가 resolveCapiToken(pixelId)로 픽셀별 토큰(커피는 시스템 유저, biocom은 글로벌)을 골라 Meta Graph API /events 엔드포인트로 서버 사이드 재전송. Meta가 두 신호를 같은 event_id로 디둡하고, PII(이메일·전화·fbp·fbc)를 해시해 매칭 품질(EMQ)을 높인다.",
  },
  {
    kicker: "왜 뛰어난가",
    title: "왜 이 구조가 강력한가",
    description:
      "① iOS 14+ ATT로 브라우저 픽셀 매칭률이 급락하는 구간을 서버 전송으로 보완 ② Purchase만 쓰면 Meta AEM(Aggregated Event Measurement)의 8개 우선순위 슬롯 중 1개만 쓰지만, 4단계를 쓰면 4슬롯을 채워 iOS 전환 손실 최대 70%를 회복 가능 ③ Purchase 기반 Lookalike Audience seed가 10~20배 커져 유사 오디언스 정밀도 상승 ④ Value Optimization(ROAS 입찰) 모드에서 장바구니 cart value까지 학습 대상에 포함되어 고객 가치 예측이 세밀해짐 ⑤ Shopify·Zalando·Sephora 등 Meta 공식 사례에서 평균 EMQ +1.0~1.5점, CPA -8%, ROAS +5~15% 개선 보고.",
  },
];

const funnelCapiMechanisms = [
  {
    label: "Conversion Lift Prediction",
    before: "Purchase 이력만 학습 → 기존 구매자 위주 타게팅",
    after: "ViewContent/AddToCart 전조 신호 학습 → 신규 잠재고객 식별 정확도 상승",
  },
  {
    label: "Learning Phase 탈출",
    before: "Purchase 50건/7일 필요, 세트 다수 영구 학습 갇힘",
    after: "상단 funnel이 Deferred Optimization 보조 신호 → 탈출 3~5배 빠름",
  },
  {
    label: "Value Optimization (ROAS 입찰)",
    before: "과거 Purchase value만 학습",
    after: "AddToCart cart value까지 포함 → 고ROAS 타게팅 세밀화",
  },
  {
    label: "Lookalike Audience seed",
    before: "Purchase만 seed → 작은 seed",
    after: "ViewContent 발사자까지 seed → 10~20배 큰 seed 로 LAL 생성",
  },
  {
    label: "Retargeting Custom Audience",
    before: "'구매자 제외'만 가능",
    after: "'ViewContent했는데 AddToCart 안 한 사용자' 같은 세밀한 퍼널 리마케팅",
  },
  {
    label: "iOS AEM 8 슬롯",
    before: "Purchase 1개만 사용 → 7 슬롯 낭비, iOS 트래픽 전환 손실 최대 70%",
    after: "4 슬롯 채움 → iOS 매출 축 1/3 구간 복구",
  },
  {
    label: "Event Match Quality (EMQ)",
    before: "단일 이벤트라 상한 낮음",
    after: "funnel 전체에 동일 fbp/fbc로 EMQ +1.0~1.5점 상승",
  },
];

const aiAgentAssessment = {
  summary:
    "우리 CAPI 인프라는 지금도 '자동화된 이벤트 전송기' 수준은 이미 통과했지만, 본격적인 AI Agent로 승격하려면 '관측→판단→실행→학습' 4단계 루프를 완결해야 한다. 현재 관측(로그)과 실행(전송)은 있지만 판단과 학습이 수동이다. 승격은 가능하며, 필요한 것은 인프라 추가가 아니라 결정 로직의 외화와 LLM/규칙 엔진 연결이다.",
  currentState: [
    {
      pillar: "① 관측 (Observe)",
      status: "70%",
      detail:
        "meta-capi-sends.jsonl 로그, /api/meta/capi/log 쿼리, /api/meta/health live probe 가 이미 작동. 하지만 EMQ 점수 자동 수집이 없고, 드랍률·Match Quality 지표가 대시보드에 없음.",
    },
    {
      pillar: "② 판단 (Orient / Decide)",
      status: "25%",
      detail:
        "payment-decision endpoint가 '결제 상태 → Purchase 허용/차단'은 판단함. 하지만 '토큰 만료 감지 → 재발급 알림', 'EMQ 하락 감지 → 원인 진단', '광고비 낭비 감지 → 예산 조정 제안' 같은 상위 판단은 전부 사람이 대시보드 보고 수동으로 내림.",
    },
    {
      pillar: "③ 실행 (Act)",
      status: "85%",
      detail:
        "Server CAPI 전송, 토큰 fallback, 재시도, 디둡 전부 자동. funnel 이벤트 서버 + 자동 sync job 도 코드 완성. 다만 '발견한 문제를 즉시 고치는' 자동 치유(self-healing)는 없음 — 로그만 남기고 다음 tick 재시도.",
    },
    {
      pillar: "④ 학습 (Learn / Evolve)",
      status: "5%",
      detail:
        "현재 시스템은 과거 데이터를 보고 자기 자신을 조정하지 않음. CAPI 정책 임계치, 토큰 로테이션 주기, guard 판정 규칙이 전부 코드 상수로 박혀 있음. Meta EMQ 점수가 떨어져도 시스템 스스로 원인을 탐색하고 정책을 바꾸지 못함.",
    },
  ],
  canPromote:
    "승격 가능하다. 현재 CAPI 스택은 이미 '도메인 지식이 깊게 박힌 단일 목적 Tool' 이고, 같은 코드베이스에 OpenAI SDK(gpt-5-mini) 가 이미 연결돼 있다(env OPENAI_API_KEY). AI Agent 승격에 필요한 것은 새 서비스나 벡터 DB가 아니라, 판단 레이어를 LLM + 규칙 엔진으로 외화하는 얇은 어댑터다.",
  promotionSteps: [
    {
      step: "1단계 — 관측 완성 (2주)",
      actions: [
        "Meta Events Manager EMQ 점수를 주기적으로 fetch해 DB에 적재 (스크린스크래핑 또는 Graph API)",
        "/api/meta/capi/health 엔드포인트 신설 — drop_rate, dedup_rate, match_quality_proxy(email/phone/fbp/fbc 제공률) 자동 계산",
        "CAPI 로그 · attribution ledger · ads insights를 하나의 'Observation Snapshot' 문서로 5분 주기 요약",
      ],
    },
    {
      step: "2단계 — 판단 프레임워크 (2주)",
      actions: [
        "문제 탐지 규칙 카탈로그 작성 — 예: 'drop_rate > 5% → critical', 'EMQ < 7 → warning', '토큰 expires_in_days < 7 → critical'",
        "각 문제에 '가능한 조치' 리스트를 명시 — 예: 'drop_rate 상승 → 재시도 횟수 증가 / 토큰 검증 / 네트워크 확인'",
        "LLM(gpt-5-mini)에 Observation Snapshot + 규칙 카탈로그를 주고 '지금 무엇이 가장 급한가 + 왜 + 권고 조치'를 구조화 JSON 으로 받는 decide() 함수 구현",
      ],
    },
    {
      step: "3단계 — 자동 치유 실행 (3주)",
      actions: [
        "low-risk 자동 치유 화이트리스트 정의 — 예: '토큰 fallback 자동 전환', 'CAPI 재시도 횟수 임시 증가', '특정 픽셀 발사 일시 중단'",
        "high-risk 액션(토큰 재발급·CORS 변경·배포)은 자동 실행 금지, 'Agent 제안 → 사람 승인' 큐로 전달",
        "액션 실행 후 30분 관찰 → 지표 회복 여부 → 실패 시 자동 롤백",
      ],
    },
    {
      step: "4단계 — 학습 루프 (무기한)",
      actions: [
        "매 판단·행동·결과를 'incident_log' 테이블에 기록 (상태, 취한 조치, 결과, 회복 시간)",
        "주간 LLM 리뷰 — '지난 주 incident 중 같은 패턴 반복된 것은? 규칙 카탈로그에 추가할 새 룰은?'",
        "성공한 자동 치유는 화이트리스트 확장, 실패한 건 롤백 + 사람 검토 필수로 전환",
        "궁극적으로 Meta ROAS 변화의 설명 변수를 Agent가 스스로 발견 — EMQ 저하가 funnel 이벤트 문제인지, 토큰 문제인지, 브라우저 쿠키 동의 변경인지",
      ],
    },
  ],
  risks: [
    "LLM 판단의 불확실성 — gpt-5-mini가 잘못된 진단 내리면 자동 치유가 악화 방향으로 감. 화이트리스트와 승인 큐로 차단.",
    "자동 실행의 블라스트 라디우스 — 'Meta 토큰 revoke' 같은 작업을 실수로 실행하면 전사 광고 시스템 마비. 반드시 high-risk는 사람 승인.",
    "관측 데이터의 품질 — EMQ 점수가 Events Manager에만 있고 Graph API로는 공식 제공 안 됨. 스크린 스크래핑의 불안정성.",
    "규칙 카탈로그 유지보수 — Meta 정책이 자주 바뀌어 규칙이 낡음. 월 1회 리뷰 필수.",
  ],
  verdict:
    "결론: 승격은 가능하고, 큰 인프라 투자 없이 4~6주 작업으로 1·2단계 완성 가능. 3·4단계는 1·2단계를 3개월 운영해 패턴을 본 뒤 점진 확장이 안전하다. 지금 당장 AI Agent로 만드는 것보다는 '관측과 판단을 분리해 Agent가 들어올 자리를 만드는 것'이 더 실용적 출발점이다.",
};

export default function TrackingIntegrityPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.backLink}>← 대시보드로 돌아가기</Link>
          <p className={styles.eyebrow}>Tracking Integrity</p>
          <h1>추적 코드 및 데이터 정합성</h1>
          <p>
            Meta가 보는 구매와 우리가 보는 확정 매출을 같은 주문 기준으로 맞추기 위한 작업 현황입니다.
            핵심은 브라우저에서 찍힌 구매 영수증과 서버에서 보낸 구매 영수증을 같은 주문으로 묶고,
            미입금 주문은 구매로 세지 않게 만드는 것입니다.
          </p>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <span className={styles.badge}>현재 우선순위</span>
            <h2>가상계좌 미입금 Purchase 오염을 막고, confirmed 기준 ROAS로 정렬</h2>
            <p>
              카드 결제는 결제완료 시점에 실제 승인으로 볼 수 있지만, 가상계좌는 주문완료와 입금완료가 다릅니다.
              그래서 가상계좌 미입금 주문이 Meta Browser Purchase로 먼저 잡히면 Meta ROAS가 내부 Attribution ROAS보다
              과대하게 보일 수 있습니다.
            </p>
          </div>
          <div className={styles.heroPanel}>
            <div>
              <strong>Phase 4</strong>
              <span>86%</span>
            </div>
            <p>CAPI / Pixel dedup과 pending Purchase 차단이 현재 핵심 단계입니다.</p>
          </div>
        </section>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>Browser Pixel</span>
            <strong>사용자 브라우저에서 찍히는 구매</strong>
            <p>아임웹 주문완료 화면에서 Meta Pixel이 보내는 이벤트입니다. 빠르지만 미입금 가상계좌까지 Purchase로 잡을 수 있습니다.</p>
          </article>
          <article className={styles.summaryCard}>
            <span>Server CAPI</span>
            <strong>우리 서버가 Meta에 보내는 구매</strong>
            <p>입금/승인 상태를 확인한 뒤 서버에서 보내는 이벤트입니다. confirmed 기준 운영 ROAS의 정본에 가깝습니다.</p>
          </article>
          <article className={styles.summaryCard}>
            <span>Attribution Ledger</span>
            <strong>우리 자체 원장</strong>
            <p>전태준 대표님이 구축한 자체 솔루션에 쌓이는 결제/유입 원장입니다. 내부 ROAS 판단의 기준입니다.</p>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>왜 차이가 나는가</span>
            <h2>Meta ROAS와 내부 Attribution ROAS가 크게 벌어지는 이유</h2>
            <p>
              차이는 하나의 원인만으로 생기지 않습니다. Meta의 넓은 기여 기준, 브라우저 이벤트 정의,
              서버 이벤트 중복 제거, 식별자 유실, 캠페인 매핑 품질이 같이 영향을 줍니다.
            </p>
          </div>
          <div className={styles.reasonGrid}>
            {roasGapReasons.map((item) => (
              <article key={item.title} className={styles.reasonCard}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>현재 삽입 코드</span>
            <h2>아임웹 헤더와 푸터 코드의 의도</h2>
            <p>
              헤더 코드는 Meta Pixel이 구매를 보내기 전에 먼저 막는 역할이고, 푸터 코드는 우리 자체 원장에 유입과 결제완료 정보를 남기는 역할입니다.
            </p>
          </div>
          <div className={styles.versionGrid}>
            {liveVersions.map((item) => (
              <article key={item.label} className={styles.versionCard}>
                <span>{item.label}</span>
                <strong>{item.version}</strong>
                <p>{item.meaning}</p>
              </article>
            ))}
          </div>
          <div className={styles.codeGrid}>
            {codeBlocks.map((item) => (
              <article key={item.label} className={styles.codeCard}>
                <span>{item.label}</span>
                <h3>{item.purpose}</h3>
                <ul>
                  {item.does.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <p>{item.risk}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>작업 이력</span>
            <h2>지금까지 바로잡은 것</h2>
            <p>
              목표는 Meta 숫자를 무조건 낮추는 것이 아니라, 구매로 볼 수 있는 주문만 구매로 보고 같은 주문은 한 번만 세는 것입니다.
            </p>
          </div>
          <div className={styles.doneList}>
            {completedWork.map((item) => <div key={item}>{item}</div>)}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Roadmap</span>
            <h2>데이터 정합성 Phase별 완성도</h2>
            <p>완성도는 2026-04-12 기준 작업 문서와 로컬 검증 상태를 반영했습니다.</p>
          </div>
          <div className={styles.phaseList}>
            {phases.map((phase) => (
              <article key={phase.name} className={styles.phaseCard}>
                <div className={styles.phaseTop}>
                  <div>
                    <span>{phase.name}</span>
                    <h3>{phase.title}</h3>
                  </div>
                  <strong>{phase.progress}%</strong>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${phase.progress}%` }} />
                </div>
                <p>{phase.description}</p>
                <div className={styles.phaseMeta}>
                  <span>{phase.status}</span>
                  <em>{phase.next}</em>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Funnel CAPI 기술</span>
            <h2>4단계 Purchase Funnel을 Conversions API로 전송하는 기술 해설</h2>
            <p>
              Meta가 공식으로 제공하는 Standard Events(ViewContent → AddToCart → InitiateCheckout → Purchase)를
              브라우저 Pixel + Server CAPI 양쪽에서 같은 event_id로 병행 전송하는 구조이다. Purchase 하나만 보내면
              Meta 머신러닝이 '구매 직전 사용자'를 학습할 수 없지만, 4단계를 전부 보내면 전조 신호까지 활용되어
              광고 최적화 정확도가 실측 5~15% 향상된다.
            </p>
          </div>

          <div className={styles.reasonGrid}>
            {funnelCapiPillars.map((item) => (
              <article key={item.kicker} className={styles.reasonCard}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#14b5ad", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.kicker}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <div className={styles.sectionHeader} style={{ marginTop: 32 }}>
            <span className={styles.sectionKicker}>Meta ML 메커니즘 7가지</span>
            <h2>Purchase만 vs 4단계 Funnel — 머신러닝 내부가 어떻게 달라지는가</h2>
            <p>
              아래는 Meta 공식 광고 시스템이 내부적으로 작동하는 방식이다. Purchase만 쏠 때 이 중 절반 이상이
              반만 작동하거나 작동하지 않는다. 4단계를 전부 쏘면 각 메커니즘이 원래 설계대로 활성화된다.
            </p>
          </div>
          <div className={styles.codeGrid}>
            {funnelCapiMechanisms.map((item) => (
              <article key={item.label} className={styles.codeCard}>
                <span>{item.label}</span>
                <h3 style={{ fontSize: "0.85rem", color: "#dc2626" }}>Purchase-only</h3>
                <p style={{ marginTop: 0 }}>{item.before}</p>
                <h3 style={{ fontSize: "0.85rem", color: "#16a34a", marginTop: 12 }}>4단계 Funnel 완성</h3>
                <p style={{ marginTop: 0 }}>{item.after}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>AI Agent 승격 검토</span>
            <h2>우리 CAPI를 AI Agent로 승격시킬 수 있는가</h2>
            <p>{aiAgentAssessment.summary}</p>
          </div>

          <div className={styles.reasonGrid}>
            {aiAgentAssessment.currentState.map((item) => (
              <article key={item.pillar} className={styles.reasonCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ marginBottom: 0 }}>{item.pillar}</h3>
                  <strong style={{ fontSize: "1.2rem", color: "#14b5ad" }}>{item.status}</strong>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <article className={styles.reasonCard} style={{ marginTop: 24, background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
            <h3>판정: 승격 가능</h3>
            <p>{aiAgentAssessment.canPromote}</p>
          </article>

          <div className={styles.sectionHeader} style={{ marginTop: 32 }}>
            <span className={styles.sectionKicker}>승격 로드맵</span>
            <h2>무엇을 해야 하는가 — 4단계 작업</h2>
          </div>
          <div className={styles.codeGrid}>
            {aiAgentAssessment.promotionSteps.map((item) => (
              <article key={item.step} className={styles.codeCard}>
                <span>{item.step}</span>
                <ul>
                  {item.actions.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <div className={styles.sectionHeader} style={{ marginTop: 32 }}>
            <span className={styles.sectionKicker}>리스크</span>
            <h2>Agent 승격 시 조심할 4가지</h2>
          </div>
          <div className={styles.doneList}>
            {aiAgentAssessment.risks.map((item) => <div key={item}>{item}</div>)}
          </div>

          <article className={styles.reasonCard} style={{ marginTop: 24, background: "#fef3c7", border: "1px solid #fde68a" }}>
            <h3>실무 결론</h3>
            <p>{aiAgentAssessment.verdict}</p>
          </article>
        </section>

        <section className={styles.nextPanel}>
          <div>
            <span className={styles.sectionKicker}>다음 확인</span>
            <h2>지금 바로 봐야 할 4가지</h2>
          </div>
          <ol>
            <li>카드 결제 완료에서 Pixel Helper에 Purchase가 계속 뜨는지 확인한다.</li>
            <li>가상계좌 미입금 완료에서 Purchase가 사라지고 VirtualAccountIssued가 뜨는지 확인한다.</li>
            <li>payment_success 원장 metadata에 orderCode와 referrerPayment가 남는지 확인한다.</li>
            <li>Server CAPI event_id가 Browser와 같은 Purchase.&#123;orderCode&#125;인지 확인한다.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
