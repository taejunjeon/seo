export type Ga4RevenueOpsEvidenceType = "fact" | "inference";

export type Ga4RevenueOpsPhase = {
  day: "Day 0" | "Day 1" | "Day 3";
  purpose: string;
  actions: string[];
};

export type Ga4RevenueOpsRisk = {
  type: Ga4RevenueOpsEvidenceType;
  item: string;
};

export type Ga4RevenueOpsPlan = {
  generatedAt: string;
  canonical: {
    canonicalContainerId: "GTM-W2Z6PHN";
    canonicalPropertyName: "[G4] biocom.kr";
    canonicalPropertyId: "304759974";
    canonicalMeasurementId: "G-WJFXN5E2Q1";
    supportContainerId: "GTM-W7VXS4D8";
    legacyMeasurementId: "G-8GZ48B1S59";
  };
  tenSecondSummary: string[];
  roleSplit: {
    gpt: string[];
    codex: string[];
    user: string[];
  };
  latestStatus: Array<{
    type: Ga4RevenueOpsEvidenceType;
    label: string;
    detail: string;
  }>;
  revenueIntegrityCheck: {
    smokeNow: string[];
    trustWindow: string[];
    comparisonStandard: string[];
    splitPolicy: string[];
    pseudoSql: string[];
  };
  historicalBackfill: {
    ga4Ui: string[];
    measurementProtocol: string[];
    reportingPolicy: string[];
    biAlternative: string[];
    sources: string[];
  };
  virtualAccountPlan: {
    policy: string[];
    gtmPossible: string[];
    gtmHard: string[];
    backendDbNeeds: string[];
    statuses: string[];
    recommendedOrder: string[];
  };
  refundCancelDesign: {
    refundWhen: string[];
    transactionIdRule: string[];
    nonDepositDecision: string[];
    roasImpact: string[];
    reconciliationImpact: string[];
    sources: string[];
  };
  imwebMigration: {
    versionConflict: string[];
    liveHtmlToday: string[];
    versionWithDirectG8: string[];
    versionWithoutDirectG8: string[];
    preconditions: string[];
    migrateFooterLogic: string[];
    removableNow: string[];
    doNotTouchYet: string[];
    targetArchitecture: string[];
  };
  materials: {
    required: string[];
    reference: string[];
  };
  rollout: Ga4RevenueOpsPhase[];
  risks: Ga4RevenueOpsRisk[];
  unresolvedConstraints: string[];
};

const revenueIntegrityPseudoSql = [
  "WITH db_orders AS (",
  "  SELECT",
  "    DATE(COALESCE(NULLIF(TRIM(payment_complete_time), ''), NULLIF(TRIM(order_date), ''))) AS order_day,",
  "    order_number AS transaction_id,",
  "    MAX(COALESCE(final_order_amount, 0)) AS gross_revenue,",
  "    MAX(COALESCE(total_refunded_price, 0)) AS refund_amount,",
  "    CASE",
  "      WHEN MAX(NULLIF(TRIM(pg_name), '')) = 'NAVERPAY_ORDER' THEN 'npay'",
  "      WHEN MAX(NULLIF(TRIM(payment_method), '')) = 'VIRTUAL' THEN 'virtual_account'",
  "      ELSE 'general'",
  "    END AS pay_bucket,",
  "    MAX(COALESCE(cancellation_reason, '')) AS cancellation_reason",
  "  FROM tb_iamweb_users",
  "  WHERE COALESCE(NULLIF(TRIM(payment_complete_time), ''), NULLIF(TRIM(order_date), '')) IS NOT NULL",
  "  GROUP BY 1, 2",
  "),",
  "ga4_purchase AS (",
  "  SELECT",
  "    event_date AS order_day,",
  "    transaction_id,",
  "    SUM(value) AS ga_revenue,",
  "    MAX(payment_type) AS payment_type,",
  "    CASE",
  "      WHEN MAX(payment_type) = 'npay' THEN 'npay'",
  "      WHEN MAX(payment_type) = 'vbank' THEN 'virtual_account'",
  "      ELSE 'general'",
  "    END AS pay_bucket",
  "  FROM ga4_export_or_api_purchase_daily",
  "  GROUP BY 1, 2",
  ")",
  "SELECT",
  "  COALESCE(g.order_day, d.order_day) AS order_day,",
  "  COALESCE(g.pay_bucket, d.pay_bucket) AS pay_bucket,",
  "  COUNT(DISTINCT g.transaction_id) AS ga_purchase_cnt,",
  "  COUNT(DISTINCT d.transaction_id) AS db_order_cnt,",
  "  SUM(COALESCE(g.ga_revenue, 0)) AS ga_revenue,",
  "  SUM(COALESCE(d.gross_revenue - d.refund_amount, 0)) AS db_net_revenue",
  "FROM ga4_purchase g",
  "FULL OUTER JOIN db_orders d",
  "  ON g.transaction_id = d.transaction_id",
  "GROUP BY 1, 2",
  "ORDER BY 1 DESC, 2;",
];

export const getGa4RevenueOpsPlan = (): Ga4RevenueOpsPlan => ({
  generatedAt: "2026-03-29T23:30:00+09:00",
  canonical: {
    canonicalContainerId: "GTM-W2Z6PHN",
    canonicalPropertyName: "[G4] biocom.kr",
    canonicalPropertyId: "304759974",
    canonicalMeasurementId: "G-WJFXN5E2Q1",
    supportContainerId: "GTM-W7VXS4D8",
    legacyMeasurementId: "G-8GZ48B1S59",
  },
  tenSecondSummary: [
    "정본은 그대로 W2 -> [G4] biocom.kr / 304759974 / G-WJFXN5E2Q1이다.",
    "지금 바로 가능한 일은 매출 정합성 스모크 테스트, 가상계좌 상태 정의서, refund/cancel 원장 설계, 아임웹 footer 로직 이관 사양서 작성이다.",
    "운영 판단은 컷오버 직후 1건이 아니라 3~7일 누적 데이터로 해야 한다.",
    "가상계좌는 신청완료 purchase 유지 + 미입금/취소 보정이 A안이지만, GTM 단독이 아니라 backend/DB 상태 신호가 필요하다.",
    "historical cleanup은 GA4 안에서 되돌리려 하지 말고, 컷오버 날짜 전후 분리 + DB/BI 보정 리포트로 가는 것이 현실적이다.",
  ],
  roleSplit: {
    gpt: [
      "가상계좌를 purchase로 둘지, cancel 보정까지 포함할지 같은 측정 철학과 경영 판단 문구를 정리한다.",
      "ROAS 해석과 운영 커뮤니케이션 문구를 확정한다.",
    ],
    codex: [
      "정합성 체크 pseudo-SQL, backend/DB 설계, 환불·취소 원장 구조, 아임웹 코드 이관 사양서를 만든다.",
      "정적 plan JSON/Markdown, API endpoint, 테스트, 실측 근거 정리를 맡는다.",
    ],
    user: [
      "GTM/GA4/Admin/Imweb UI에서 실제 태그 수정, publish, DebugView 캡처, 주문 테스트 1건을 수행한다.",
      "가상계좌 상태 정의와 live Imweb code version 증빙 자료를 제공한다.",
    ],
  },
  latestStatus: [
    {
      type: "fact",
      label: "정본 고정",
      detail: "정본 컨테이너는 GTM-W2Z6PHN, 정본 속성은 [G4] biocom.kr / property 304759974 / measurement ID G-WJFXN5E2Q1로 유지한다.",
    },
    {
      type: "fact",
      label: "일반 구매 정본 sender",
      detail: "일반 구매 canonical sender는 HURDLERS [이벤트전송] 구매다. 이번 턴에서도 건드리지 않는다.",
    },
    {
      type: "fact",
      label: "purchase payload 실측",
      detail: "purchase DebugView에서는 transaction_id / value / currency / shipping이 확인됐다. items는 event-level source variable은 있으나 item-level price scale은 재확인이 필요하다.",
    },
    {
      type: "fact",
      label: "2026-03-29 live HTML 홈 실측",
      detail: "https://biocom.kr 와 https://www.biocom.kr 홈 HTML에는 GTM-W7VXS4D8, GTM-W2Z6PHN, AW-304339096, 그리고 gtag('set', { user_id }) / rebuyz_utm / rebuyz_view 의존 footer 로직이 보였다.",
    },
    {
      type: "fact",
      label: "2026-03-29 live HTML에서 직접 안 보인 것",
      detail: "같은 홈 HTML 실측에서는 G-8GZ48B1S59 또는 G-WJFXN5E2Q1 direct gtag config 문자열은 직접 보이지 않았다. 즉 과거 정황과 오늘 홈 view-source는 분리해서 다뤄야 한다.",
    },
    {
      type: "inference",
      label: "아임웹 코드 버전 충돌",
      detail: "과거 자료에는 direct G-8 삽입 정황이 있으나, 오늘 홈 HTML은 W2/W7 + Ads gtag + footer custom script 구조로 보인다. live Imweb code version을 먼저 확정하지 않으면 direct G-8 제거 판단을 서둘러선 안 된다.",
    },
  ],
  revenueIntegrityCheck: {
    smokeNow: [
      "지금 즉시 가능한 것은 컷오버 전후 주문 1~3건을 골라 transaction_id / value / currency / shipping / payment_type이 GA4 DebugView와 주문 DB에 같은지 보는 스모크 테스트다.",
      "이미 purchase 자체는 DebugView에서 확인됐으므로, sender가 완전히 죽어 있는 상태는 아니다.",
      "스모크 테스트는 태그가 '대체로 산다'를 확인하는 단계이지, 운영 매출 정합성을 증명하는 단계는 아니다.",
    ],
    trustWindow: [
      "운영 판단용 신뢰 구간을 3~7일로 보는 이유는 세 가지다. 첫째, 환불/취소가 당일 이후에 붙는다. 둘째, 가상계좌는 신청완료와 입금완료 사이에 시차가 있다. 셋째, NPay는 purchase 정본이 아니라 보조 신호라 DB backstop이 필요하다.",
      "즉 Day 0에는 이벤트 형식이 맞는지 보고, Day 1에는 하루치 합계를 보고, Day 3~7에는 환불·취소까지 반영한 순매출 기준으로 본다.",
    ],
    comparisonStandard: [
      "비교 기준은 'GA4 purchase gross'와 '주문 DB paid gross / refund / net'를 분리하는 것이다.",
      "GA4는 transaction_id 단위, DB는 order_number 단위로 맞춘다.",
      "당분간 일반 구매 / NPay / 가상계좌를 섞지 말고 pay_bucket별로 따로 본다.",
      "가상계좌 A안을 유지하면, GA4 purchase 수는 '신청완료' 기준이 되고 BI 순매출은 '입금완료 - 환불/취소' 기준이 된다. 둘은 정의가 다르다는 설명 문구가 같이 붙어야 한다.",
    ],
    splitPolicy: [
      "general: 일반 카드/계좌이체/기타 실결제. canonical purchase 정합성의 1차 대상이다.",
      "npay: pay.naver.com 진입은 보조 신호, 최종 완료는 DB reconciliation로 메운다.",
      "virtual_account: A안에서는 신청완료 purchase를 유지하되, cancel/non-deposit 보정을 별도 원장 또는 MP refund/cancel로 처리한다.",
    ],
    pseudoSql: revenueIntegrityPseudoSql,
  },
  historicalBackfill: {
    ga4Ui: [
      "GA4 UI 안에서 이미 쌓인 과거 event를 '수정'하는 개념은 현실적으로 없다. 잘못 들어간 과거 page_view/purchase를 UI에서 되돌려 정리하는 방식은 기대하면 안 된다.",
      "그래서 historical cleanup을 GA4 내부 정정 프로젝트로 잡지 말고, 컷오버 날짜 전후 분리 해석으로 가는 것이 맞다.",
    ],
    measurementProtocol: [
      "Measurement Protocol은 자동 수집을 대체하는 수단이 아니라 보완 수단이다.",
      "timestamp_micros를 써도 event backdate는 최대 72시간까지만 허용된다.",
      "따라서 72시간을 넘는 과거 purchase를 MP로 재주입해 GA4 원본을 정정하는 전략은 실무적으로 통하지 않는다.",
    ],
    reportingPolicy: [
      "보고서는 컷오버 날짜를 경계로 Before / After를 나눠야 한다.",
      "컷오버 전 데이터는 '구조 혼재 구간', 컷오버 후 데이터는 '정본 구간'으로 라벨링한다.",
      "성과 비교가 필요하면 GA4 원본 비교가 아니라 DB 순매출, 주문수, 환불수 기준의 보정 리포트를 함께 보여줘야 한다.",
    ],
    biAlternative: [
      "DB/BI 레이어에서 `ga4_reported_revenue`, `db_paid_revenue`, `db_refund_amount`, `db_net_revenue`, `reconciliation_gap`를 같이 보여주는 별도 리포트를 만든다.",
      "이 리포트는 historical cleanup의 대체재가 아니라, 과거 왜곡을 설명하는 보정 레이어다.",
    ],
    sources: [
      "Measurement Protocol overview: https://developers.google.com/analytics/devguides/collection/protocol/ga4",
      "Measurement Protocol send events / 72h timestamp override: https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events",
      "Measurement Protocol reference / timestamp_micros: https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference",
    ],
  },
  virtualAccountPlan: {
    policy: [
      "A안은 '신청 완료를 purchase로 유지'하고, 이후 미입금/취소/환불을 보정 이벤트나 DB 리포트로 뒤따라가는 구조다.",
      "이 구조의 장점은 신청 시점 전환율을 잃지 않는 것이다. 단점은 광고/매출 보고서에서 당일 gross가 실제 입금보다 크게 보일 수 있다는 점이다.",
    ],
    gtmPossible: [
      "신청 완료 페이지에서 purchase를 보내는 일 자체는 GTM으로 가능하다.",
      "신청 단계에서 payment_type='vbank' 또는 유사 결제수단 값을 붙이는 것도 가능하다.",
      "가상계좌 신청 직후 add_payment_info 또는 custom event를 추가로 보내는 것도 가능하다.",
    ],
    gtmHard: [
      "미입금 만료, 수동 취소, 관리자 취소, 실제 입금 완료, 부분 환불은 브라우저 GTM만으로는 놓치기 쉽다.",
      "특히 고객이 돌아오지 않는 백오피스 상태 변경은 frontend 태그만으로 신뢰 있게 잡기 어렵다.",
    ],
    backendDbNeeds: [
      "admin 또는 DB에서 최소한 order_number, payment_method, pg_name, order_status, deposit_due_at, payment_complete_time, cancellation_reason, refunded_amount, refunded_at를 읽을 수 있어야 한다.",
      "가상계좌는 신청완료 시각과 입금완료 시각을 분리 저장해야 한다.",
      "이 상태 신호가 있어야 A안의 후행 보정이 가능하다.",
    ],
    statuses: ["신청완료", "입금대기", "입금완료", "미입금만료", "취소", "환불"],
    recommendedOrder: [
      "1. 먼저 현재 주문 원장에서 가상계좌 관련 실제 상태값/컬럼을 확정한다.",
      "2. 그다음 GTM purchase payload에 payment_type='vbank'를 표준화한다.",
      "3. admin/DB에서 미입금만료·취소·환불 이벤트를 일 단위로 뽑는 원장을 만든다.",
      "4. 마지막으로 MP refund 또는 BI cancel 보정 중 어느 쪽을 쓸지 확정한다.",
    ],
  },
  refundCancelDesign: {
    refundWhen: [
      "실제로 결제가 완료된 transaction이 이후 전액 또는 부분 취소/환불된 경우에만 GA 공식 refund 이벤트를 쏜다.",
      "refund는 purchase를 덮어쓰는 게 아니라 transaction_id 기준의 보정 row로 생각해야 한다.",
    ],
    transactionIdRule: [
      "purchase와 refund는 같은 transaction_id(order_number)를 써야 한다.",
      "부분 환불이면 items 또는 amount 기준 보정이 필요하고, 최소한 refund_value는 DB와 맞아야 한다.",
    ],
    nonDepositDecision: [
      "가상계좌 미입금 취소는 엄밀히 말하면 '돈을 받았다가 돌려준 환불'이 아니라 '신청만 있었고 결제 완료는 없던 상태'에 가깝다.",
      "그래서 미입금만료를 무조건 GA refund로 처리하면 광고 ROAS 상 과잉 환불처럼 보일 수 있다.",
      "권장안은 미입금만료는 BI/DB의 cancel 보정으로 우선 처리하고, 실제 돈이 들어온 뒤 되돌린 건만 GA refund로 보내는 것이다.",
    ],
    roasImpact: [
      "refund를 쓰면 광고/GA 기준 매출은 줄어든다. 실결제 후 환불이라면 이게 맞다.",
      "반대로 미입금 취소까지 refund로 보내면 신청기반 전환을 거의 전부 환불처럼 깎아 보여 해석이 더 혼란스러워질 수 있다.",
    ],
    reconciliationImpact: [
      "DB reconciliation에서는 refund와 cancel을 분리해야 원장 설명력이 높다.",
      "추천 구조는 purchase ledger + refund ledger + cancel/non-deposit ledger 세 갈래다.",
      "이렇게 해야 GA와 DB가 왜 다르게 보이는지 설명할 수 있다.",
    ],
    sources: [
      "Measurement Protocol overview: https://developers.google.com/analytics/devguides/collection/protocol/ga4",
      "Measurement Protocol send events: https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events",
    ],
  },
  imwebMigration: {
    versionConflict: [
      "업로드된 과거 자료에는 direct G-8 삽입 정황이 있었고, 이전 분석 문서도 그 정황을 근거로 썼다.",
      "하지만 2026-03-29 홈 HTML 실측에서는 G-8 또는 G-W direct config 문자열은 직접 보이지 않았다.",
      "따라서 '어느 버전이 현재 live인지'를 먼저 확정하지 않으면 제거 순서를 잘못 잡을 위험이 있다.",
    ],
    liveHtmlToday: [
      "오늘 홈 HTML 기준으로는 W2와 W7 GTM snippet이 모두 있다.",
      "AW-304339096 direct gtag가 있다.",
      "footer custom script에서 gtag 전역 객체를 가정하고 user_id 설정, rebuyz_utm 저장, rebuyz_view 전송을 수행한다.",
      "view_item 표준 이벤트는 주석 처리돼 있고 rebuyz_view만 활성으로 보인다.",
    ],
    versionWithDirectG8: [
      "과거 운영 화면/문서/감사 결과에는 direct gtag G-8GZ48B1S59가 사이트 코드에 있었다는 정황이 있다.",
      "이 버전은 historical evidence로만 취급하고, live라고 단정하지 않는다.",
    ],
    versionWithoutDirectG8: [
      "2026-03-29 현재 홈 view-source는 G-8 / G-W direct config 없이 W2/W7 + AW + footer gtag 의존 스크립트 구조다.",
      "즉 direct G-8이 이미 빠졌거나, 다른 페이지/앱 또는 GTM 내부에서만 작동할 가능성을 열어 둬야 한다.",
    ],
    preconditions: [
      "live Imweb head/footer/custom code의 현재 버전 캡처 또는 export가 필요하다.",
      "상품상세, 주문서, 주문완료 페이지 각각에서 실제로 어떤 스크립트가 내려가는지 확인해야 한다.",
      "direct G-8이 정말 홈에만 없는 것인지, 사이트 전체에서 제거된 것인지 먼저 확인해야 한다.",
    ],
    migrateFooterLogic: [
      "user_id 설정은 footer custom script에서 직접 gtag('set') 하지 말고 dataLayer에 user_id_ready 같은 이벤트와 user_id 값을 push한다.",
      "rebuyz_utm 저장도 localStorage 직접 포맷 대신 dataLayer 또는 first-party cookie 규칙으로 정리한다.",
      "rebuyz_view는 최종적으로 표준 view_item으로 매핑하고, 필요하면 커스텀 rebuyz_view는 보조 이벤트로만 남긴다.",
      "즉 footer 의존 로직은 '직접 gtag 호출'에서 'dataLayer push -> W2 GTM 태그 발화' 구조로 옮긴다.",
    ],
    removableNow: [
      "직접 제거가 아니라 '문서상 제거 후보 분류'까지는 지금 가능하다.",
      "view_item 대신 rebuyz_view만 쓰는 설계 문제는 지금부터 W2 표준 event spec으로 정리 가능하다.",
    ],
    doNotTouchYet: [
      "HURDLERS [이벤트전송] 구매는 건드리지 않는다.",
      "direct G-8은 live version이 확정되기 전에는 무턱대고 제거하지 않는다.",
      "W7 전체를 한 번에 삭제하지 않는다. CRM 보조 컨테이너일 가능성이 크므로 역할이 남아 있는지 먼저 본다.",
    ],
    targetArchitecture: [
      "최종 목표는 W2가 단일 web analytics owner가 되고, 아임웹 custom code는 dataLayer push와 식별/UTM 보조만 남기는 구조다.",
      "W7은 CRM 전용 보조 컨테이너로 축소하거나, 필요 event만 남긴다.",
      "site code에 measurement ID를 직접 박는 방식은 제거한다.",
    ],
  },
  materials: {
    required: [
      "live Imweb code version 확정 자료: 홈/상품상세/주문서/주문완료의 head/footer/custom code 캡처 또는 export",
      "주문 원장 export 또는 DB 컬럼 확인: order_number, order_date, payment_complete_time, pg_name, payment_method, cancellation_reason, total_refunded_price",
      "가상계좌 상태 정의 자료: 신청완료/입금대기/입금완료/미입금만료/취소/환불이 실제로 어느 컬럼·값으로 저장되는지",
    ],
    reference: [
      "W7 export 전체본 또는 태그 목록 캡처",
      "purchase DebugView expanded payload 캡처(items 포함)",
      "NPay 테스트 1건의 Preview/DebugView/주문번호 대조 캡처",
    ],
  },
  rollout: [
    {
      day: "Day 0",
      purpose: "정의와 근거 고정",
      actions: [
        "W2 / 304759974 / G-WJFXN5E2Q1를 정본으로 재확인한다.",
        "live Imweb code version 증빙을 수집한다.",
        "주문 DB에서 payment_complete_time / pg_name / payment_method / cancellation_reason / total_refunded_price 존재 여부를 확정한다.",
      ],
    },
    {
      day: "Day 1",
      purpose: "스모크 테스트와 상태 모델 확정",
      actions: [
        "일반 구매 1건으로 DebugView와 주문번호를 대조한다.",
        "가상계좌 상태값을 신청완료 / 입금대기 / 입금완료 / 미입금만료 / 취소 / 환불로 표준화한다.",
        "reconciliation pseudo-SQL을 실제 테이블 명세에 맞춰 실행형 SQL로 전환한다.",
      ],
    },
    {
      day: "Day 3",
      purpose: "운영 판단 리포트화",
      actions: [
        "general / npay / virtual_account로 나눈 일별 gap 리포트를 만든다.",
        "refund ledger와 cancel/non-deposit ledger를 분리해 붙인다.",
        "cutover 전/후 구간을 분리한 매출 보고서를 공유한다.",
      ],
    },
  ],
  risks: [
    {
      type: "fact",
      item: "현재 accessible 자료만으로는 GTM UI 내부 firing rule을 직접 검증할 수 없다.",
    },
    {
      type: "fact",
      item: "2026-03-29 홈 view-source는 direct G-8을 직접 보여주지 않는다. 과거 정황만으로 지금 live라고 단정하면 안 된다.",
    },
    {
      type: "inference",
      item: "가상계좌를 purchase로 유지하면 마케팅 전환율은 올라가 보일 수 있지만, 비입금 cancel이 많으면 DB 순매출과 괴리가 커질 수 있다.",
    },
    {
      type: "inference",
      item: "refund와 cancel을 하나로 뭉개면 ROAS 해석과 재무 정합성 둘 다 설명력이 떨어진다.",
    },
  ],
  unresolvedConstraints: [
    "Codex는 GTM/GA4/Admin UI에 직접 로그인해서 태그를 켜고 끌 수 없다.",
    "live Imweb code version은 현재 홈 HTML 실측까지만 가능했고, 전체 page type별 head/footer export는 아직 없다.",
    "가상계좌 실제 상태값은 주문 원장 컬럼 확정이 끝나기 전까지 가정 단계가 섞여 있다.",
  ],
});
