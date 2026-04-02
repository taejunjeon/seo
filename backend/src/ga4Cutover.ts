export type Ga4EvidenceType = "fact" | "inference";

export type Ga4GtmAction =
  | "유지"
  | "pause"
  | "unpause"
  | "rename"
  | "신규 생성"
  | "제거 후보";

export type Ga4GtmWorkItem = {
  tagName: string;
  currentState: string;
  currentDestination: string;
  action: Ga4GtmAction;
  reason: string;
  expectedEvent: string;
  validation: string[];
};

export type Ga4PayloadFieldSpec = {
  fieldName:
    | "transaction_id"
    | "value"
    | "currency"
    | "items"
    | "shipping"
    | "tax"
    | "coupon"
    | "payment_type";
  sourceExists: string;
  measuredStatus: string;
  action: string;
};

export type Ga4ItemsValidationPlan = {
  sourceVariable: string;
  expectedSchema: string[];
  previewChecks: string[];
  dataLayerChecks: string[];
  debugViewChecks: string[];
  missingCauses: string[];
  shapeFixes: string[];
};

export type Ga4HurdlersCanonicalSpec = {
  eventLabel: string;
  currentSender: string;
  targetSender: string;
  currentEventName: string;
  targetEventName: string;
  requiredParams: string[];
  relatedVariables: string[];
  validation: string[];
};

export type Ga4AddPaymentInfoSpec = {
  generalDecision: string[];
  npayDecision: string[];
  paymentTypeValues: string[];
  notPurchaseRule: string[];
  debugViewExample: string[];
};

export type Ga4NpayValidationPlan = {
  hardReason: string[];
  currentSignals: string[];
  retestTiming: string[];
  expectedFiredTags: string[];
  expectedDebugView: string[];
  finalDbBackstop: string[];
};

export type Ga4ReconciliationPlan = {
  tableAssumptions: string[];
  splitPolicy: string[];
  comparisonPoints: string[];
  pseudoSql: string[];
};

export type Ga4MaterialRequests = {
  required: string[];
  reference: string[];
};

export type Ga4RolloutPhase = {
  day: "Day 0" | "Day 1" | "Day 3";
  purpose: string;
  actions: string[];
};

export type Ga4Risk = {
  type: Ga4EvidenceType;
  item: string;
};

export type Ga4CutoverPlan = {
  generatedAt: string;
  canonical: {
    canonicalContainerId: "GTM-W2Z6PHN";
    canonicalPropertyName: "[G4] biocom.kr";
    canonicalPropertyId: "304759974";
    canonicalMeasurementId: "G-WJFXN5E2Q1";
    supportContainerId: "GTM-W7VXS4D8";
    deprecatedMeasurementId: "G-8GZ48B1S59";
  };
  tenSecondSummary: string[];
  latestStatus: Array<{
    type: Ga4EvidenceType;
    label: string;
    detail: string;
  }>;
  canonicalDeclaration: string[];
  gtmWorkSpec: Ga4GtmWorkItem[];
  pageViewExecutionPlan: {
    canonicalSender: string;
    pauseGa4Pixel2When: string[];
    googleTagDecision: string[];
    removeDirectGtagWhen: string[];
    previewHealthy: string[];
    debugViewHealthy: string[];
  };
  purchasePayloadSpec: Ga4PayloadFieldSpec[];
  itemsValidationPlan: Ga4ItemsValidationPlan;
  hurdlersCanonicalSpec: Ga4HurdlersCanonicalSpec[];
  addPaymentInfoSpec: Ga4AddPaymentInfoSpec;
  npayValidationPlan: Ga4NpayValidationPlan;
  reconciliationPlan: Ga4ReconciliationPlan;
  materialRequests: Ga4MaterialRequests;
  rollout: Ga4RolloutPhase[];
  risks: Ga4Risk[];
  unresolvedConstraints: string[];
};

const gtmWorkSpec: Ga4GtmWorkItem[] = [
  {
    tagName: "GA4_픽셀",
    currentState: "활성 / All Pages / send_page_view=true",
    currentDestination: "G-WJFXN5E2Q1",
    action: "유지",
    reason: "정본 page_view sender는 이 태그다.",
    expectedEvent: "page_view",
    validation: ["Preview에서 page_view sender 1개", "DebugView에서 G-W page_view만 증가"],
  },
  {
    tagName: "GA4_픽셀2",
    currentState: "활성 / All Pages / send_page_view=true",
    currentDestination: "G-8GZ48B1S59",
    action: "pause",
    reason: "legacy G-8 page_view 중복 축이다.",
    expectedEvent: "중지 후 page_view는 GA4_픽셀만 남아야 함",
    validation: ["Preview에서 미발화", "legacy G-8 page_view flatline 확인"],
  },
  {
    tagName: "[new]Google 태그",
    currentState: "동시 발화 확인",
    currentDestination: "W2 내부 Google tag layer",
    action: "rename",
    reason: "삭제가 아니라 autonomous page_view off 여부를 확인하고 shell 역할만 남겨야 한다.",
    expectedEvent: "정본 이벤트 sender가 아니라 기술적 base shell",
    validation: ["send_page_view off 또는 동등 설정 확인", "GA4 autonomous page_view 미발화 확인"],
  },
  {
    tagName: "GA4_회원가입",
    currentState: "활성",
    currentDestination: "G-WJFXN5E2Q1 / sign_up",
    action: "유지",
    reason: "회원가입 canonical sender다.",
    expectedEvent: "sign_up",
    validation: ["회원가입 완료당 sign_up 1회", "HURDLERS 회원가입 완료와 중복 없음"],
  },
  {
    tagName: "GA4_구매전환_Npay",
    currentState: "일시중지",
    currentDestination: "G-WJFXN5E2Q1 / purchase",
    action: "pause",
    reason: "paused 유지 후 제거 후보다. NPay purchase 정본 sender로 쓰지 않는다.",
    expectedEvent: "유지되지 않아도 됨",
    validation: ["NPay 회귀 후 제거 여부 확정"],
  },
  {
    tagName: "GA4_구매전환_Npay 2",
    currentState: "활성",
    currentDestination: "G-8GZ48B1S59 / purchase",
    action: "제거 후보",
    reason: "legacy G-8 NPay purchase 축이다.",
    expectedEvent: "최종 제거 대상",
    validation: ["NPay 보조 이벤트 및 DB 대조 후 제거"],
  },
  {
    tagName: "GA4_구매전환_홈피구매",
    currentState: "일시중지",
    currentDestination: "G-WJFXN5E2Q1 / purchase",
    action: "pause",
    reason: "paused 유지 후 제거 후보다. 일반 구매 canonical sender는 HURDLERS 구매다.",
    expectedEvent: "유지되지 않아도 됨",
    validation: ["HURDLERS 구매로 purchase가 안정적으로 보이는지 확인"],
  },
  {
    tagName: "GA4_장바구니 담기",
    currentState: "일시중지",
    currentDestination: "G-WJFXN5E2Q1 / add_to_cart",
    action: "pause",
    reason: "paused 유지 후 제거 후보다. 장바구니 canonical sender는 HURDLERS 장바구니 담기다.",
    expectedEvent: "유지되지 않아도 됨",
    validation: ["HURDLERS 장바구니 담기만 남아도 add_to_cart 유지 확인"],
  },
  {
    tagName: "GA4_장바구니 담기2",
    currentState: "활성",
    currentDestination: "G-8GZ48B1S59 / add_to_cart",
    action: "제거 후보",
    reason: "legacy G-8 add_to_cart 축이다.",
    expectedEvent: "최종 제거 대상",
    validation: ["Preview에서 미발화", "legacy G-8 add_to_cart 미증가"],
  },
  {
    tagName: "GA4_주문완료_요소공개",
    currentState: "상태 미상 / test",
    currentDestination: "G-WJFXN5E2Q1 / test",
    action: "pause",
    reason: "즉시 중지 가능 태그다.",
    expectedEvent: "없음",
    validation: ["운영 firing 중지"],
  },
  {
    tagName: "GA4_주문완료_요소공개2",
    currentState: "상태 미상 / test",
    currentDestination: "G-8GZ48B1S59 / test",
    action: "pause",
    reason: "즉시 중지 가능 태그다.",
    expectedEvent: "없음",
    validation: ["운영 firing 중지"],
  },
  {
    tagName: "HURDLERS [이벤트전송] 상세페이지 조회",
    currentState: "DebugView view_item 확인",
    currentDestination: "G-WJFXN5E2Q1",
    action: "유지",
    reason: "상세페이지 조회 canonical sender다.",
    expectedEvent: "view_item",
    validation: ["Preview fired", "DebugView view_item", "items/value completeness 확인"],
  },
  {
    tagName: "HURDLERS [이벤트전송] 장바구니 담기",
    currentState: "DebugView add_to_cart 확인",
    currentDestination: "G-WJFXN5E2Q1",
    action: "유지",
    reason: "장바구니 담기 canonical sender다.",
    expectedEvent: "add_to_cart",
    validation: ["Preview fired", "DebugView add_to_cart"],
  },
  {
    tagName: "HURDLERS [이벤트전송] 주문서작성",
    currentState: "DebugView begin_checkout 확인",
    currentDestination: "G-WJFXN5E2Q1",
    action: "유지",
    reason: "주문서작성 canonical sender다.",
    expectedEvent: "begin_checkout",
    validation: ["dataLayer h_begin_checkout 확인", "DebugView begin_checkout"],
  },
  {
    tagName: "HURDLERS [이벤트전송] 구매",
    currentState: "eventName purchase 수정 후 DebugView purchase 확인",
    currentDestination: "G-WJFXN5E2Q1",
    action: "유지",
    reason: "일반 구매 canonical sender다.",
    expectedEvent: "purchase",
    validation: ["DebugView purchase", "transaction_id/value/currency 확인", "items 보강 확인"],
  },
  {
    tagName: "HURDLERS [이벤트전송] 네이버페이 구매",
    currentState: "NPay 보조 이벤트 후보",
    currentDestination: "G-WJFXN5E2Q1",
    action: "rename",
    reason: "purchase 정본이 아니라 add_payment_info 또는 npay_click 계열 보조 이벤트로 재정의해야 한다.",
    expectedEvent: "npay_click 또는 보조 add_payment_info",
    validation: ["버튼 클릭 시 fired", "purchase와 혼동되지 않음", "DB 대조로 최종 완료 확인"],
  },
  {
    tagName: "HURDLERS [이벤트전송] 회원가입 완료",
    currentState: "sign_up 후보 / 중복 가능",
    currentDestination: "G-WJFXN5E2Q1",
    action: "제거 후보",
    reason: "회원가입 canonical sender는 GA4_회원가입이다.",
    expectedEvent: "최종 sender 역할 제거",
    validation: ["GA4_회원가입만 sign_up 발화", "trigger/변수만 참고"],
  },
];

const purchasePayloadSpec: Ga4PayloadFieldSpec[] = [
  {
    fieldName: "transaction_id",
    sourceExists: "있음 / HURDLERS - GA4 Transaction_id = hurdlers_ga4.transaction_id",
    measuredStatus: "DebugView 실측 확인됨",
    action: "유지. order_number와 1:1 매핑 검증",
  },
  {
    fieldName: "value",
    sourceExists: "있음 / HURDLERS - GA4 Value = hurdlers_ga4.value",
    measuredStatus: "DebugView 실측 확인됨",
    action: "유지. DB amount와 대조",
  },
  {
    fieldName: "currency",
    sourceExists: "불명확 / source variable 직접 확인은 없음",
    measuredStatus: "DebugView KRW 확인됨",
    action: "KRW 고정 전달 또는 dataLayer currency 추가",
  },
  {
    fieldName: "items",
    sourceExists: "있음 / HURDLERS - GA4 상품정보 = hurdlers_ga4.items",
    measuredStatus: "DebugView 실측 확인 미완료",
    action: "Preview, dataLayer, DebugView로 배열 shape 확인 후 보강",
  },
  {
    fieldName: "shipping",
    sourceExists: "있음 / HURDLERS - GA4 shipping = hurdlers_ga4.shipping",
    measuredStatus: "DebugView 실측 미확인",
    action: "thank-you payload에서 값 존재 여부 확인 후 전송",
  },
  {
    fieldName: "tax",
    sourceExists: "불명확 또는 미구현",
    measuredStatus: "DebugView 실측 미확인",
    action: "세금 분리 불가 시 0 또는 미전송 정책 문서화",
  },
  {
    fieldName: "coupon",
    sourceExists: "불명확 또는 미구현",
    measuredStatus: "DebugView 실측 미확인",
    action: "쿠폰 코드/명 dataLayer source 있으면 연결, 없으면 미전송",
  },
  {
    fieldName: "payment_type",
    sourceExists: "불명확 또는 미구현",
    measuredStatus: "DebugView 실측 미확인",
    action: "general / npay 최소 표준화",
  },
];

const itemsValidationPlan: Ga4ItemsValidationPlan = {
  sourceVariable: "HURDLERS - GA4 상품정보 = dataLayer variable hurdlers_ga4.items",
  expectedSchema: [
    "item_id",
    "item_name",
    "price",
    "quantity",
    "item_brand",
    "item_variant",
  ],
  previewChecks: [
    "GTM Preview에서 HURDLERS [이벤트전송] 구매 fired 시 items param이 배열로 보이는지 확인",
    "stringified JSON이 아니라 object array인지 확인",
  ],
  dataLayerChecks: [
    "purchase 직전 dataLayer에서 hurdlers_ga4.items 존재 여부 확인",
    "배열 길이, key 이름, 숫자형 price/quantity 확인",
  ],
  debugViewChecks: [
    "purchase 이벤트 상세에서 items 섹션 노출 여부 확인",
    "item_id, item_name, price, quantity가 최소한 1개 아이템에 표시되는지 확인",
  ],
  missingCauses: [
    "hurdlers_ga4.items가 undefined 또는 빈 배열일 수 있음",
    "GTM 변수가 객체 배열이 아니라 문자열로 넘어갈 수 있음",
    "GA4 tag parameter mapping에서 items 키가 누락되었을 수 있음",
    "배열 내부 key 이름이 GA4 권장 schema와 달라 DebugView에서 무시될 수 있음",
  ],
  shapeFixes: [
    "items를 [{ item_id, item_name, price, quantity, item_brand, item_variant }] 형태로 보정",
    "price와 quantity는 number로 강제",
    "비어 있는 optional key는 제거",
    "단일 상품도 배열로 감싸서 전달",
  ],
};

const hurdlersCanonicalSpec: Ga4HurdlersCanonicalSpec[] = [
  {
    eventLabel: "상세페이지 조회 -> view_item",
    currentSender: "HURDLERS [이벤트전송] 상세페이지 조회",
    targetSender: "HURDLERS [이벤트전송] 상세페이지 조회",
    currentEventName: "view_item",
    targetEventName: "view_item",
    requiredParams: ["item_id", "item_name", "currency", "value", "items"],
    relatedVariables: ["hurdlers_ga4.items", "hurdlers_ga4.value"],
    validation: ["Preview fired", "DebugView view_item", "items/value shape 확인"],
  },
  {
    eventLabel: "장바구니 담기 -> add_to_cart",
    currentSender: "HURDLERS [이벤트전송] 장바구니 담기",
    targetSender: "HURDLERS [이벤트전송] 장바구니 담기",
    currentEventName: "add_to_cart",
    targetEventName: "add_to_cart",
    requiredParams: ["item_id", "item_name", "currency", "value", "items"],
    relatedVariables: ["hurdlers_ga4.items", "hurdlers_ga4.value"],
    validation: ["Preview fired", "DebugView add_to_cart"],
  },
  {
    eventLabel: "장바구니 보기 -> view_cart",
    currentSender: "HURDLERS [이벤트전송] 장바구니 보기",
    targetSender: "HURDLERS [이벤트전송] 장바구니 보기",
    currentEventName: "미확정 또는 custom",
    targetEventName: "view_cart",
    requiredParams: ["currency", "value", "items"],
    relatedVariables: ["hurdlers_ga4.items", "hurdlers_ga4.value"],
    validation: ["Preview fired", "DebugView view_cart"],
  },
  {
    eventLabel: "주문서작성 -> begin_checkout",
    currentSender: "HURDLERS [이벤트전송] 주문서작성",
    targetSender: "HURDLERS [이벤트전송] 주문서작성",
    currentEventName: "begin_checkout / upstream dataLayer=h_begin_checkout",
    targetEventName: "begin_checkout",
    requiredParams: ["currency", "value", "coupon", "items"],
    relatedVariables: ["h_begin_checkout", "hurdlers_ga4.items", "hurdlers_ga4.value"],
    validation: ["dataLayer h_begin_checkout 확인", "DebugView begin_checkout"],
  },
  {
    eventLabel: "구매 -> purchase",
    currentSender: "HURDLERS [이벤트전송] 구매",
    targetSender: "HURDLERS [이벤트전송] 구매",
    currentEventName: "purchase",
    targetEventName: "purchase",
    requiredParams: ["transaction_id", "value", "currency", "items", "shipping"],
    relatedVariables: [
      "hurdlers_ga4.transaction_id",
      "hurdlers_ga4.value",
      "hurdlers_ga4.items",
      "hurdlers_ga4.shipping",
    ],
    validation: ["DebugView purchase", "transaction_id/value/currency 확인", "items 확인"],
  },
  {
    eventLabel: "회원가입 완료 -> sign_up",
    currentSender: "HURDLERS [이벤트전송] 회원가입 완료",
    targetSender: "GA4_회원가입",
    currentEventName: "custom 또는 sign_up 후보",
    targetEventName: "sign_up",
    requiredParams: ["method"],
    relatedVariables: ["회원가입 완료 trigger/변수"],
    validation: ["GA4_회원가입만 sign_up 발화", "중복 제거 확인"],
  },
];

const plan: Ga4CutoverPlan = {
  generatedAt: new Date().toISOString(),
  canonical: {
    canonicalContainerId: "GTM-W2Z6PHN",
    canonicalPropertyName: "[G4] biocom.kr",
    canonicalPropertyId: "304759974",
    canonicalMeasurementId: "G-WJFXN5E2Q1",
    supportContainerId: "GTM-W7VXS4D8",
    deprecatedMeasurementId: "G-8GZ48B1S59",
  },
  tenSecondSummary: [
    "정본은 W2 / [G4] biocom.kr / 304759974 / G-WJFXN5E2Q1이다.",
    "일반 구매는 HURDLERS [이벤트전송] 구매를 그대로 canonical sender로 쓴다.",
    "네이버페이는 purchase 정본이 아니라 npay_click 또는 보조 add_payment_info로 다룬다.",
    "이번 문서는 GTM 작업자가 그대로 따라할 수 있는 실행 사양서다.",
  ],
  latestStatus: [
    {
      type: "fact",
      label: "일반 purchase 검증",
      detail: "DebugView에서 page_view, view_item, add_to_cart, begin_checkout, purchase가 확인됐다.",
    },
    {
      type: "fact",
      label: "purchase 핵심 파라미터",
      detail: "transaction_id=202603298840444, value=260000, currency=KRW가 확인됐다.",
    },
    {
      type: "fact",
      label: "items source",
      detail: "HURDLERS - GA4 상품정보 source는 hurdlers_ga4.items로 확인됐다.",
    },
    {
      type: "fact",
      label: "items 검증 상태",
      detail: "items는 source variable은 존재하지만 DebugView 실측 확인은 아직 미완료다.",
    },
    {
      type: "fact",
      label: "NPay 제약",
      detail: "NPay는 pay.naver.com / orders.pay.naver.com 구조상 W2 GTM으로 최종 완료를 직접 추적하기 어렵다.",
    },
    {
      type: "inference",
      label: "NPay 정본 정의",
      detail: "NPay는 purchase 정본이 아니라 버튼 클릭/진입 기반 보조 추적 + 주문 DB 대조가 맞다.",
    },
  ],
  canonicalDeclaration: [
    "정본 컨테이너 = GTM-W2Z6PHN",
    "정본 속성 = [G4] biocom.kr",
    "정본 property ID = 304759974",
    "정본 measurement ID = G-WJFXN5E2Q1",
    "일반 구매 canonical sender = HURDLERS [이벤트전송] 구매",
    "상세페이지 조회 canonical sender = HURDLERS [이벤트전송] 상세페이지 조회",
    "장바구니 담기 canonical sender = HURDLERS [이벤트전송] 장바구니 담기",
    "주문서작성 canonical sender = HURDLERS [이벤트전송] 주문서작성",
    "회원가입 canonical sender = GA4_회원가입",
    "W7 = CRM 보조 컨테이너",
    "G-8 = legacy 제거 대상",
  ],
  gtmWorkSpec,
  pageViewExecutionPlan: {
    canonicalSender: "GA4_픽셀",
    pauseGa4Pixel2When: [
      "W2 Preview에서 page_view sender가 GA4_픽셀 하나로 보일 때",
      "DebugView에서 G-W page_view만 증가하는 것이 확인될 때",
    ],
    googleTagDecision: [
      "[new]Google 태그는 삭제보다 shell 역할 유지 여부를 먼저 본다.",
      "autonomous page_view를 보내면 off하고, canonical sender 역할은 GA4_픽셀에만 남긴다.",
    ],
    removeDirectGtagWhen: [
      "GA4_픽셀 단독으로 page_view, view_item, add_to_cart, begin_checkout, purchase가 안정적으로 보인 뒤",
      "legacy G-8 stream이 더 이상 증가하지 않는 것을 확인한 뒤",
    ],
    previewHealthy: [
      "page_view fired tag = GA4_픽셀 1개",
      "GA4_픽셀2 미발화",
      "[new]Google 태그가 autonomous page_view sender로 동작하지 않음",
    ],
    debugViewHealthy: [
      "G-W property에서 page_view 1회",
      "G-8 쪽 신규 page_view 없음",
      "이후 funnel 이벤트도 G-W 축에서만 이어짐",
    ],
  },
  purchasePayloadSpec,
  itemsValidationPlan,
  hurdlersCanonicalSpec,
  addPaymentInfoSpec: {
    generalDecision: [
      "일반 결제에는 별도 add_payment_info를 둔다.",
      "결제수단 선택 완료 후 최종 submit 직전에 1회 발화한다.",
    ],
    npayDecision: [
      "NPay 버튼 클릭은 purchase로 보내지 않는다.",
      "NPay는 npay_click custom event 또는 보조 add_payment_info로 정의한다.",
      "이번 사양서에서는 purchase와의 혼동을 피하기 위해 npay_click을 우선 권장한다.",
    ],
    paymentTypeValues: ["card", "bank", "vbank", "npay", "unknown"],
    notPurchaseRule: [
      "최종 매출 인정은 purchase 또는 DB paid order로만 본다.",
      "npay_click/add_payment_info는 결제 의도 신호이지 매출 완료 신호가 아니다.",
    ],
    debugViewExample: [
      "일반 결제 정상 예시: begin_checkout -> add_payment_info -> purchase",
      "NPay 정상 예시: begin_checkout -> npay_click, 최종 완료는 DB 대조로 확인",
    ],
  },
  npayValidationPlan: {
    hardReason: [
      "NPay 완료는 외부 도메인에서 이뤄져 W2 GTM이 thank-you 구간을 직접 못 볼 수 있다.",
      "따라서 W2만으로 purchase 완료를 확정하면 오판 위험이 있다.",
    ],
    currentSignals: [
      "NPay 버튼 클릭/진입 시그널",
      "begin_checkout upstream 시그널",
      "주문 DB paid order",
    ],
    retestTiming: [
      "Day 3 after W2 정리",
      "GA4_구매전환_Npay 2 제거 직전",
    ],
    expectedFiredTags: [
      "HURDLERS [이벤트전송] 주문서작성",
      "npay_click 또는 보조 add_payment_info",
    ],
    expectedDebugView: [
      "begin_checkout",
      "npay_click 또는 add_payment_info",
      "purchase는 없을 수 있음",
    ],
    finalDbBackstop: [
      "DB에서 NPay paid order count 확인",
      "DB order_number와 GA4 intent 이벤트 시점을 비교",
    ],
  },
  reconciliationPlan: {
    tableAssumptions: [
      "주문 원장은 tb_iamweb_users 또는 동등 테이블",
      "order_number, order_date, payment_complete_time, payment_method, pg_name, final_order_amount 사용 가능 가정",
    ],
    splitPolicy: [
      "일반 구매와 NPay를 payment_method / pg_name으로 분리",
      "GA4는 general purchase와 NPay intent를 별도로 본다.",
    ],
    comparisonPoints: [
      "GA4 purchase count vs DB paid order count",
      "GA4 revenue vs DB amount",
      "source / medium / campaign은 GA4 purchase 또는 click 신호에서만 확인",
      "NPay는 DB paid order가 최종 truth",
    ],
    pseudoSql: [
      "WITH db_orders AS (",
      "  SELECT",
      "    order_number,",
      "    COALESCE(payment_complete_time, order_date) AS paid_at,",
      "    COALESCE(payment_method, pg_name, 'unknown') AS pay_method,",
      "    SUM(final_order_amount) AS amount",
      "  FROM tb_iamweb_users",
      "  WHERE cancellation_reason IS NULL",
      "    AND return_reason IS NULL",
      "    AND order_number IS NOT NULL",
      "  GROUP BY 1,2,3",
      "),",
      "ga4_purchase AS (",
      "  SELECT",
      "    transaction_id AS order_number,",
      "    MIN(event_timestamp) AS ga4_paid_at,",
      "    SUM(value) AS ga4_amount,",
      "    ANY_VALUE(source) AS source,",
      "    ANY_VALUE(medium) AS medium,",
      "    ANY_VALUE(campaign) AS campaign",
      "  FROM ga4_purchase_export",
      "  GROUP BY 1",
      ")",
      "SELECT",
      "  d.order_number,",
      "  d.paid_at,",
      "  d.pay_method,",
      "  d.amount AS db_amount,",
      "  g.ga4_paid_at,",
      "  g.ga4_amount,",
      "  g.source,",
      "  g.medium,",
      "  g.campaign",
      "FROM db_orders d",
      "LEFT JOIN ga4_purchase g USING (order_number);",
    ],
  },
  materialRequests: {
    required: [
      "일반 purchase DebugView expanded payload 캡처 1장(items 노출 여부 포함)",
      "NPay 테스트 1건의 order_number와 테스트 시각",
      "W2 Preview에서 [new]Google 태그 설정 화면 캡처(send_page_view/autonomous firing 여부 확인용)",
    ],
    reference: [
      "direct gtag G-8가 실제로 제거된 후 CMS 헤드 코드 캡처",
      "W7 벤더 export 또는 core analytics 미발화 확인 자료",
    ],
  },
  rollout: [
    {
      day: "Day 0",
      purpose: "정본 sender와 legacy 정리 대상 확정",
      actions: [
        "GA4_픽셀 유지 선언",
        "HURDLERS 상세/장바구니/주문서작성/구매 canonical sender 고정",
        "GA4_회원가입 canonical sender 고정",
        "NPay purchase 정본 폐기, npay_click 보조 신호로 정의",
      ],
    },
    {
      day: "Day 1",
      purpose: "page_view 중복과 즉시 중지 태그 정리",
      actions: [
        "GA4_픽셀2 pause",
        "GA4_주문완료_요소공개 2종 pause",
        "[new]Google 태그 autonomous page_view off 확인",
        "GA4_구매전환_홈피구매 / GA4_장바구니 담기 paused 유지",
      ],
    },
    {
      day: "Day 3",
      purpose: "items 확인 및 NPay 보조 검증",
      actions: [
        "general purchase items payload 확인",
        "NPay npay_click 또는 보조 add_payment_info fired 확인",
        "direct gtag G-8 제거",
        "DB 대조 1차 수행",
      ],
    },
  ],
  risks: [
    {
      type: "fact",
      item: "items는 source variable이 있지만 DebugView 실측 확인이 아직 미완료다.",
    },
    {
      type: "fact",
      item: "NPay 최종 완료는 W2 GTM으로 직접 보기 어렵다.",
    },
    {
      type: "inference",
      item: "[new]Google 태그가 autonomous firing을 계속하면 page_view 중복이 남을 수 있다.",
    },
    {
      type: "inference",
      item: "direct gtag G-8 제거 전까지 legacy stream 오염이 계속될 수 있다.",
    },
  ],
  unresolvedConstraints: [
    "실제 GTM UI 클릭, publish, rollback은 Codex가 직접 수행할 수 없다.",
    "NPay 테스트 주문은 운영 권한과 실결제 동선이 필요하다.",
    "W7 export는 외부 벤더 권한이 필요하다.",
  ],
};

export const getGa4CutoverPlan = (): Ga4CutoverPlan => ({
  ...plan,
  generatedAt: new Date().toISOString(),
});
