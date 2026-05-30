# Leading Indicator Ontology Extension

작성 시각: 2026-05-25 19:15 KST
기준일: 2026-05-25
문서 성격: 기존 Attribution Ontology Lite 위에 얹는 구매 전 행동 사전 초안
Lane: Green documentation
운영 영향: 운영DB 변경 없음 / VM Cloud 배포 없음 / 외부 플랫폼 전송 없음

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - ontology/!ontology.md
    - ontology/attribution-ontology-schema-contract-20260506.md
    - project/!indicatoragent.md
    - harness/!harness.md
  lane: Green
  allowed_actions:
    - ontology extension draft
    - terminology alignment
    - schema planning
    - read-only design
  forbidden_actions:
    - 운영DB write
    - VM Cloud deploy/restart
    - GTM Preview/Production publish
    - GA4/Meta/Google Ads/TikTok/Naver send/upload
    - raw customer/order/payment/ad-click identifier output
  source_window_freshness_confidence:
    source: "ontology/!ontology.md + attribution schema contract + project/!indicatoragent.md"
    window: "2026-05-25 문서 설계 기준"
    freshness: "로컬 문서 정적 조사"
    site: "biocom 우선, thecleancoffee 확장 가능"
    confidence: 0.86
```

## 10초 요약

이 문서는 새 온톨로지를 만드는 문서가 아니다.
기존 `ontology/!ontology.md`의 결제완료, 내부 매출, 광고 클릭 증거 정본은 그대로 둔다.

여기에 구매 전 행동을 설명하는 항목 6개와 연결 규칙 9개만 얹는다.
목표는 체류시간, 스크롤, 결제 진행, 이탈 행동을 매출과 섞지 않고 선행지표로 안전하게 읽는 것이다.

## 왜 필요한가

기존 온톨로지는 아래를 잘 분리한다.

- 광고 클릭은 구매가 아니다.
- NPay 클릭과 결제 시작은 구매가 아니다.
- 실제 매출은 내부 결제완료 주문에서 나온다.
- 플랫폼이 주장하는 전환값은 내부 확정매출이 아니다.

부족한 것은 구매 전 행동이다.
예를 들어 "Meta 구매자는 상품 상세에 오래 머물렀다", "결제 시작 후 이탈자는 스크롤 깊이가 낮았다" 같은 문장을 같은 기준으로 반복 분석하려면 구매 전 행동 사전이 필요하다.

## 기존 정본 유지 원칙

| 기존 정본 | 유지 이유 | 이 확장에서 하는 일 |
|---|---|---|
| `PaymentCompleteOrder` | 실제 결제완료 주문의 정본 | 변경하지 않음 |
| `InternalConfirmedRevenue` | 예산 판단용 내부 매출 정본 | 변경하지 않음 |
| `AdClick`, `ClickIdentifier`, `ChannelEvidence` | 광고 유입 증거 정본 | 구매 전 행동 묶음과 연결만 추가 |
| `ProductEngagementSummary`, `CheckoutIntent` | 이미 있는 상품 몰입/결제 의도 요약 | 더 상세한 행동 항목의 부모 역할로 사용 |
| `GuardDecision`, `SourceFreshness` | 안전장치와 데이터 최신성 정본 | 선행지표 품질 판정에 재사용 |

## 신규 온톨로지 항목 6개

아래 6개는 모두 구매 전 행동이다.
따라서 기본 속성은 전부 아래와 같다.

```yaml
purchase: false
revenue: false
purchase_candidate: false
platform_send_candidate: false
```

### 1. EntrySession

쉬운 이름: 처음 들어온 경로

뜻:
방문자가 사이트에 들어온 첫 경로와 방문 묶음이다.
광고, 자연 검색, 직접 유입, 콘텐츠 유입을 같은 기준으로 나누기 위해 쓴다.

왜 필요한가:
같은 행동이라도 어떤 경로에서 들어왔는지에 따라 구매 가능성이 다르다.
단, 처음 들어온 경로는 구매가 아니며 매출도 아니다.

### 2. ContentEngagementSignal

쉬운 이름: 콘텐츠를 충분히 본 행동

뜻:
상품 설명, 리뷰, 검사 결과, 브랜드 콘텐츠를 얼마나 충분히 봤는지 나타내는 행동 신호다.

예시:

- 상세페이지 30초 이상 체류
- 90% 이상 스크롤
- 리뷰 영역 도달
- 특정 콘텐츠 영역 체류

왜 필요한가:
구매자는 결제 전에 콘텐츠를 충분히 보는 패턴이 있을 수 있다.
이 행동을 확인해야 랜딩/콘텐츠 개선 우선순위를 정할 수 있다.

### 3. CartIntentSignal

쉬운 이름: 장바구니 또는 바로구매 의도

뜻:
방문자가 상품을 담거나 바로구매 버튼 근처까지 간 행동이다.

예시:

- 장바구니 진입
- 바로구매 클릭
- 옵션 선택

왜 필요한가:
단순 콘텐츠 소비와 구매 의도는 다르다.
이 신호를 분리해야 콘텐츠 문제인지, 상품/가격/옵션 문제인지 볼 수 있다.

### 4. CheckoutIntentSignal

쉬운 이름: 결제를 시작한 행동

뜻:
결제 화면으로 들어갔지만 아직 결제완료가 아닌 상태다.

왜 필요한가:
결제를 시작했는데 구매로 닫히지 않으면 결제 UX, 결제수단, 신뢰 요소의 문제일 수 있다.
하지만 결제 시작은 구매가 아니다.

### 5. PaymentInfoIntentSignal

쉬운 이름: 결제수단을 선택하려는 행동

뜻:
카드, NPay, 가상계좌 같은 결제수단 선택 단계에 도달한 행동이다.

왜 필요한가:
결제수단 단계에서 이탈이 많으면 결제 안내나 NPay/카드/가상계좌별 경험을 따로 봐야 한다.
하지만 결제수단 선택도 구매완료가 아니다.

### 6. RegistrationFollowupSignal

쉬운 이름: 회원가입 후 구매 전 후속 행동

뜻:
회원가입 뒤 실제 결제완료 전에 발생한 장바구니, 상담, 쿠폰, 재방문 같은 행동이다.

왜 필요한가:
회원가입은 구매가 아니지만, 좋은 고객의 초기 행동일 수 있다.
가입 후 어떤 후속 행동이 구매로 이어지는지 따로 봐야 한다.

## 연결 규칙 9개

| 번호 | 연결 규칙 | 쉬운 뜻 | 왜 필요한가 |
|---:|---|---|---|
| 1 | Site has EntrySession | 사이트는 여러 처음 유입 경로를 가진다 | biocom과 thecleancoffee를 섞지 않기 위해 |
| 2 | EntrySession may reference ChannelEvidence | 처음 유입 경로는 광고/유입 증거와 연결될 수 있다 | 채널별 행동 차이를 보기 위해 |
| 3 | EntrySession may contain ContentEngagementSignal | 방문 안에 콘텐츠 몰입 행동이 들어갈 수 있다 | 콘텐츠 품질과 구매 가능성을 비교하기 위해 |
| 4 | EntrySession may contain CartIntentSignal | 방문 안에 장바구니/바로구매 의도가 들어갈 수 있다 | 구매 의도 단계까지 갔는지 보기 위해 |
| 5 | EntrySession may contain CheckoutIntentSignal | 방문 안에 결제 시작 행동이 들어갈 수 있다 | 결제 시작 후 이탈을 보기 위해 |
| 6 | CheckoutIntentSignal may precede PaymentInfoIntentSignal | 결제 시작 뒤 결제수단 선택 행동이 올 수 있다 | 결제수단 단계의 이탈을 분리하기 위해 |
| 7 | RegistrationFollowupSignal follows registration but precedes purchase | 회원가입 후 구매 전 행동만 다룬다 | 회원가입을 구매로 오해하지 않기 위해 |
| 8 | Leading signals are evaluated against PaymentCompleteOrder only | 선행 신호는 실제 결제완료 주문과 비교만 한다 | 선행지표가 매출을 직접 만든다고 쓰지 않기 위해 |
| 9 | Leading signals may recommend ExperimentCandidate | 선행 신호는 개선 실험 후보로 이어질 수 있다 | 지표를 실제 액션으로 연결하기 위해 |

중요:
실제 매출을 만드는 연결은 기존 정본의 `PaymentCompleteOrder -> InternalConfirmedRevenue`뿐이다.
위 9개 연결 규칙은 구매 전 행동을 설명하고 비교하기 위한 규칙이지, 구매나 매출을 확정하는 규칙이 아니다.

## 선행지표와 후행지표 경계

선행지표로 쓸 수 있는 것:

- 구매 전 체류시간
- 구매 전 스크롤 깊이
- 장바구니 진입
- 결제 시작
- 결제수단 선택 진입 전 행동
- 회원가입 후 구매 전 행동

후행지표라서 선행지표로 쓰면 안 되는 것:

- 결제완료
- 내부 확정매출
- 구매 후 thank-you page 행동
- 플랫폼이 주장한 purchase 값만 있는 이벤트
- 결제 후 발생한 리마케팅 이벤트

## 품질 판정 기준

| 판정 | 쉬운 뜻 | 사용 가능 여부 |
|---|---|---|
| PASS | 바로 사용 가능 | 추천 카드에 올릴 수 있음 |
| PASS_WITH_NOTES | 주의하고 사용 | 주의 문구와 함께 추천 가능 |
| HOLD | 보류 | 다음 확인점이 필요 |
| FAIL | 실패 | 추천 후보에서 제외 |

필수 확인:

- 데이터 최신성: source/window/freshness/confidence가 있어야 한다.
- 비교 집단 크기: 각 cohort가 최소 기준 이상이어야 한다.
- 구매 후 행동 혼입 방지: 결제 후 이벤트를 구매 전 신호로 쓰면 안 된다.
- 실행 가능성: 사람이 실제로 바꿀 수 없는 지표는 추천하지 않는다.
- 외부 전송 금지: 추천 신호를 광고 플랫폼에 자동 전송하지 않는다.

## 금지선

- 운영DB write 금지
- VM Cloud deploy/restart 금지
- GTM Preview/Production publish 금지
- GA4/Meta/Google Ads/TikTok/Naver send/upload 금지
- 원본 고객/주문/결제/광고 클릭 식별자 출력 금지
- 미니 디지털 트윈 결과를 자동 예산 조정에 사용 금지

## 다음 파일과의 관계

- `harness/leading-indicator/TOOL_REGISTRY.md`: 어떤 도구로 이 항목들을 읽는지 정의한다.
- `harness/leading-indicator/EVAL_SUITE.md`: 추천 후보를 사용해도 되는지 판정한다.
- `harness/leading-indicator/RUN_PACKET_SCHEMA.md`: 실행 결과를 항상 같은 모양으로 남긴다.
- `project/leading-indicator-mini-digital-twin-plan-20260525.md`: 선행지표를 매출 시뮬레이션으로 연결한다.

## 현재 상태

- 문서 초안: 작성 완료
- 코드 구현: 없음
- 데이터 복사/변경: 없음
- 외부 전송: 없음
- 추천 자신감: 86%
