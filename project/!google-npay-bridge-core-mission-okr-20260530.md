harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
  required_context_docs:
    - data/!data_inventory.md
    - docs/agent-harness/growth-data-harness-v0.md
  lane: Green for read-only analysis, local report update, and documentation. Red for Google Ads send, VM Cloud write/deploy, GTM production publish.
  allowed_actions:
    - read-only API/DB/log analysis
    - no-write/no-send candidate classification
    - local frontend report update
    - decision document update
  forbidden_actions:
    - Google Ads conversion upload without explicit approval
    - VM Cloud write/deploy without explicit approval
    - GTM production publish without explicit approval
    - production DB write/import
  source_window_freshness_confidence:
    source: VM Cloud dashboard API snapshot + VM Cloud NPay intent rematch API + Google Ads API read-only diagnosis + local report code
    window: 2026-05-28 00:00 ~ 2026-05-30 00:00 KST for latest NPay rematch; 2026-05-23 ~ 2026-05-29 KST for Google Ads confirmed purchase diagnostic
    freshness: latest successful snapshot at 2026-05-30 12:57~13:00 KST
    confidence: high for current bottleneck direction, medium-high for latest 48h counts, medium for Google Ads row-level reject reason because Google Ads does not expose the final internal filter reason

# Google/NPay Bridge Core Mission OKR - 2026-05-30

작성 시각: 2026-05-30 00:30 KST
정본 목적: 이 프로젝트의 핵심을 “보고서 표시”가 아니라 “NPay 버튼 클릭이 왜 실제 결제완료 주문과 끊기는지 해결”로 고정한다.
코드 직전 승인안: [Google/NPay Bridge v1.2 승인안](/Users/vibetj/coding/seo/project/google-npay-bridge-v12-approval-plan-20260530.md)

## 한 줄 결론

NPay 버튼 클릭과 Google click id 저장은 이미 꽤 잘 되고 있다. 진짜 병목은 네이버 외부 결제창을 지난 뒤 실제 결제완료 주문을 원래 버튼 클릭 row와 안정적으로 다시 붙이는 일이다.

## 핵심 임무

NPay 버튼 클릭이 많다. 그런데 결제완료로 연결되는 숫자가 낮고, 결제완료 주문 중 상당수가 Google/Meta/Naver/organic/direct 중 어디서 왔는지 확정되지 않는다.

따라서 이 프로젝트의 목표는 아래 네 가지다.

1. NPay 버튼 클릭이 네이버 로그인/bridge/checkout/결제완료 중 어디서 끊기는지 분리한다.
2. 실제 NPay 결제완료 주문을 버튼 클릭 row와 자동으로 붙인다.
3. 버튼 클릭 row에 있던 Google/Meta 클릭 증거가 실제 주문 근거까지 살아남게 한다.
4. Google Ads에는 버튼 클릭이 아니라 실제 결제완료 주문만 구매 신호로 보낸다.

## 현재 숫자

기준: VM Cloud live API snapshot, 2026-05-23 ~ 2026-05-29 KST.

- NPay 버튼 클릭: 400건.
- Google 흔적이 있는 NPay 버튼 클릭: 298건.
- Google 흔적 클릭 중 Google click id 보존: 294건, 약 98.7%.
- NPay bridge URL/hash가 잡힌 클릭: 111건.
- Google 흔적 bridge: 77건.
- 실제 NPay 결제완료: 39건.
- 버튼 클릭과 결제완료를 내부적으로 붙인 후보: 21건.
- A급 자동 연결 후보: 14건.
- B급 수동 검토 후보: 7건.
- 아직 애매한 후보: 18건.
- Google 증거가 있는 실제 NPay 결제완료: 4건 / 220,600원.
- 실제 Google Ads 전송 후보로 바로 볼 수 있는 NPay bridge 후보: 0건.
- 전체 실제 구매 기준 Google Ads 전송 가능 출발점: 5건 / 1,062,206원.

### 최신 48시간 재조회

기준: VM Cloud NPay intent rematch live API, 2026-05-28 00:00 ~ 2026-05-30 00:00 KST, 조회 시각 2026-05-30 12:57 KST.

- NPay 버튼 클릭: 221건.
- Google 흔적이 있는 NPay 버튼 클릭: 164건.
- Google 흔적 클릭 중 Google click id 보존: 163건, 약 99.4%.
- NPay bridge URL/hash가 잡힌 클릭: 111건.
- Google 흔적 bridge: 77건.
- 실제 NPay 결제완료: 15건.
- A급 자동 연결 후보: 3건.
- 아직 애매한 completed 후보: 12건.
- 실제 checkout/결제서까지 간 뒤 결제완료가 아직 없는 후보: 108건.
  - 아직 판단 유예: 79건.
  - 결제서 진입 후 이탈 가능 후보: 29건.
- Google 흔적 NPay 버튼 클릭의 실제 결제완료: 1건 / 35,000원.
- Meta 흔적 NPay 버튼 클릭의 실제 결제완료: 2건 / 360,900원.

중요: 12건 ambiguous는 결제가 안 된 것이 아니다. 결제완료 주문은 맞지만, 어느 NPay 버튼 클릭 row에서 시작됐는지를 안전하게 1:1로 고정할 키가 부족한 주문이다.

## Grade B 7건 중 Google 1건이 왜 A가 아닌가

B급 7건 중 1건은 Google 흔적이 있다. 하지만 이 흔적은 NPay 버튼 클릭 row 자체에 직접 붙어 있는 click id가 아니라, 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 복구한 흔적이다.

이 1건은 내부 분석에는 유용하다. 하지만 Google Ads 자동 전송 후보로 올리기에는 아직 부족하다.

이유는 두 가지다.

1. 원래 NPay intent row 자체에 click id가 직접 남아 있지 않다.
2. 주문 금액이 상품가, 배송비, 수량, 장바구니 조합으로 깔끔하게 닫히지 않는다.

쉽게 말하면 “Google에서 온 정황은 있음”과 “Google Ads에 실제 구매로 보내도 됨”은 다른 기준이다.

## 전송 가능 출발점과 장부 상태

오프라인 전환 진단 API 기준 현재 7일 창에는 다음이 보인다.

- 전송 가능 출발점: 5건 / 1,062,206원.
- 이미 전송됨 또는 반영 대기: 5건 / 804,000원.
- 테스트/잘못된 click id: 1건 / 293,206원.
- 실제 구매지만 Google click id 없음: 499건 / 117,683,021원.
- bridge 장부 필요: 2건 / 74,000원.

여기서 제일 큰 금액 병목은 “실제 구매지만 Google click id 없음”이다. 이것은 실제 매출이 없다는 뜻이 아니다. Google Ads에 광고 클릭 구매로 되돌려 보낼 직접 근거가 없다는 뜻이다.

추가 대조 결과: 현재 API의 “전송 가능 출발점” 5건은 날짜와 금액 기준으로 기존 자동 전송 장부 row와 모두 겹친다. 4건은 이미 `sent` 장부와 겹치고, 1건은 `failed` 장부와 겹친다. 따라서 이 5건을 그대로 “새로 보낼 주문 5건”으로 해석하면 안 된다. 다음 보강은 후보 생성기가 upload ledger와 같은 주문을 먼저 제거하도록 dedupe 기준을 닫는 것이다.

## 근본 병목

### 병목 1. NPay 외부 결제창 이후 주문 연결이 약하다

NPay는 자사몰 밖의 네이버 화면에서 로그인과 결제가 진행된다. 자사몰에서 NPay 버튼 클릭은 볼 수 있지만, 실제 결제완료 주문이 다시 들어왔을 때 어느 버튼 클릭에서 시작됐는지 자동 확정하려면 추가 연결고리가 필요하다.

현재 미분류 사유는 다음이 크다.

- 회원/브라우저 연결키 부족.
- 1등 후보와 2등 후보 차이가 작음.
- 같은 상품 클릭 후보가 여러 개.
- 클릭과 결제완료 시각 간격이 큼.
- 금액이 상품가/배송비/수량/장바구니 조합과 맞지 않음.

### 병목 2. Google click id가 버튼 클릭에는 있어도 결제완료 주문 근거로 충분히 승격되지 않는다

Google 흔적 NPay 버튼 클릭 298건 중 294건은 click id가 있다. 따라서 버튼 클릭 단계 저장 자체는 개선됐다. 하지만 실제 NPay 결제완료 39건 중 Google 증거가 붙은 주문은 4건뿐이다.

이 차이는 “Google 광고 유입이 전부 허수”라는 뜻이 아니다. 현재 관측상 더 큰 가능성은 다음 둘이 섞여 있다.

- 실제로 네이버 로그인/결제서 단계에서 많이 이탈한다.
- 결제는 됐지만 외부 결제 흐름 때문에 원래 버튼 클릭 row와 자동 연결되지 않는다.

### 병목 3. 금액과 상품 조합이 아직 충분히 정규화되지 않았다

NPay 버튼 클릭 금액은 상품가일 수 있고, 실제 주문금액은 배송비, 쿠폰, 수량, 장바구니, 세트상품이 섞인 금액일 수 있다. 따라서 단순히 “클릭 금액과 주문금액이 다르다”로 버리면 실제 연결 가능한 주문도 놓칠 수 있다.

## 2026-05-30 Green Lane 추가 조사 결과

### 1. NPay 미연결 completed 주문 재분류

최신 48시간 기준 미연결 completed 주문은 12건이다. 이 12건은 모두 실제 NPay 결제완료 주문이지만, 현재 증거만으로는 특정 버튼 클릭 row 하나를 확정하기 어렵다.

자동 사유별 재분류:

- 금액은 이미 맞거나 설명 가능한 주문: 6건.
- 금액이 아직 설명되지 않는 주문: 6건.
  - 상품/라인 정보 부족: 4건.
  - 세트/묶음 상품 가능성: 1건.
  - 아직 불명: 1건.
- 주문 생성시각과 bridge가 정확히 맞는 후보: 3건.
- bridge 정확 매칭이 없는 후보: 9건.
- Google click id가 있는 best intent 후보: 7건.
- NPay bridge URL/hash가 있는 best intent 후보: 8건.

사람 말로 풀면 이렇다.

1. 결제완료 주문은 있다.
2. 비슷한 버튼 클릭 후보도 있다.
3. 하지만 같은 상품을 여러 번 누르거나, 같은 상품 클릭 후보가 많거나, 회원/세션 연결키가 없어 1등 후보와 2등 후보 차이가 작다.
4. 그래서 Google Ads 전송 후보로 올리면 실제 구매가 아닌 다른 클릭에 붙일 위험이 있다.

### 2. 자동 규칙으로 더 풀 수 있는 것과 못 푸는 것

자동 규칙으로 더 풀 수 있는 영역:

- 상품가, 배송비, 쿠폰, 수량, 장바구니/세트상품 조합으로 금액 불일치 6건을 더 설명한다.
- `complete_time`보다 `order_time`을 우선해 “결제완료가 늦게 적재되어 클릭과 멀어 보이는 문제”를 줄인다.
- 상품명 긴 버전/짧은 버전 차이를 상품 idx, 옵션, 정규화 상품명으로 흡수한다.

새 연결키 없이는 못 푸는 영역:

- 회원/브라우저 연결키가 없는 주문.
- 후보가 14~25개까지 겹치는 주문.
- 1등 후보와 2등 후보 점수 차이가 작아 time-window와 상품명만으로 붙여야 하는 주문.
- NPay 외부 결제창에서 만들어진 주문번호와 자사몰 버튼 클릭 row 사이의 결정적 키가 없는 주문.

실제 이탈 가능성으로 봐야 하는 영역:

- 최신 48시간 기준 `entered_not_completed` 108건.
- 그중 29건은 결제서까지 열린 정황이 있으나 결제완료 주문이 아직 붙지 않았다.
- 이 29건이 실제 이탈인지, 결제완료 주문 연결 유실인지는 v1.2 bridge key가 들어가야 더 정확히 구분된다.

### 3. NPay bridge v1.2 코드 직전 설계

v1.2의 목표는 “광고 클릭 → NPay 버튼 클릭 → 네이버 외부 결제창 → 실제 결제완료 주문” 사이에 끊기지 않는 안전한 연결고리를 만드는 것이다.

필수 저장값:

- `npay_checkout_bridge_id_hash`: NPay 버튼 클릭 순간 생성하는 내부 연결키의 hash.
- `imweb_order_code_hash`: 아임웹/NPay 주문 생성 응답에서 주문번호가 보일 때 서버에서만 HMAC 처리한 hash.
- `channel_order_no_hash`: 네이버페이 완료 주문번호가 확보될 때 서버에서만 HMAC 처리한 hash.
- `local_session_id_hash`: 기존 브라우저 세션을 직접 노출하지 않고 해시화한 값.
- `cart_fingerprint_hash`: 상품 idx, 옵션, 수량, 상품가, 배송비, 할인/쿠폰 관측값을 묶은 장바구니 지문.
- `bridge_opened_at`, `checkout_opened_at`, `order_init_observed_at`: 클릭 이후 단계별 시각.
- `source_snapshot`: Google/Meta/Naver/direct 판단과 gclid/gbraid/wbraid 존재 여부만 저장. 원문 click id는 응답/문서/로그에 노출하지 않는다.

매칭 우선순위:

1. 주문번호 hash가 정확히 맞으면 A급.
2. checkout bridge id hash가 정확히 맞고 주문 생성시각이 가까우면 A급.
3. cart fingerprint, 금액, order_time이 함께 맞으면 A급 또는 강한 B급.
4. local session/client/GA session만 맞고 후보가 여러 개면 B급.
5. 시간과 상품명만 맞으면 ambiguous로 유지하고 전송 금지.

48시간 smoke 성공 기준:

- v1.2 intent 중 checkout bridge id hash 채움률 95% 이상.
- bridge URL/hash 채움률 56%대에서 75% 이상으로 상승.
- 실제 NPay 결제완료 strong match 15건 중 3건에서 10건 이상으로 상승.
- ambiguous 12건에서 5건 이하로 감소.
- Google Ads 전송 후보는 계속 별도 no-send preview로만 산출한다.
- raw order id, raw click id, member/email/phone/token 출력 0건.

### 4. 240,000원 Google Ads 미반영 row 진단

240,000원 row는 Google Ads API에 전송 자체는 성공했다. 장부 상태는 `sent`, HTTP 200, request id 있음, last error 없음이다.

하지만 Google Ads 리포트에는 아직 보이지 않는다.

확인한 것:

- 클릭/리포트 날짜축과 전환일 날짜축 모두에서 240,000원은 미반영.
- 같은 조회 방식에서 이미 반영된 260,000원 row는 Google Ads click view에서 exact match가 잡혔다.
- 240,000원 row의 gclid는 Google Ads click view에서 exact match가 잡히지 않았다.

현재 판정:

- 단순 지연 가능성은 아직 남아 있다.
- 다만 현재 근거상 더 큰 가능성은 Google Ads가 해당 click id를 이 계정의 광고 클릭으로 붙이지 못했거나 내부 필터에서 제외한 것이다.
- 최종 확정은 전송 후 72시간이 지나는 2026-05-31 23:46 KST 이후 한 번 더 read-only 재조회한 뒤 닫는다.

운영 판단:

- 이 row를 재전송하지 않는다.
- gclid 대신 gbraid를 보내는 확장은 별도 검증 전까지 하지 않는다.
- 같은 유형은 `click_view exact 없음`이면 자동 전송 후보가 아니라 `manual review`로 내려야 한다.

## OKR

### Objective

NPay 버튼 클릭을 실제 결제완료 주문과 안정적으로 연결하고, Google/Meta 광고 클릭 증거가 주문 근거까지 이어지게 해서 실제 구매 기준 ROAS를 만든다.

### KR1. NPay 퍼널 분해

목표: NPay 버튼 클릭 100건이 있으면 몇 건이 로그인에서 멈췄고, 몇 건이 결제서까지 갔고, 몇 건이 실제 결제완료가 됐는지 channel별로 설명한다.

현재: Google 흔적 NPay 버튼 클릭 298건, bridge 77건, 실제 결제완료 4건.

### KR2. 실제 결제완료 자동 연결률

목표: 실제 NPay 결제완료 주문의 90% 이상을 A/B/미분류 사유로 자동 설명한다.

현재: 결제완료 39건 중 classified 21건, unclassified 18건.

### KR3. 출처 유실 축소

목표: direct/unknown으로 남는 NPay 결제완료 주문을 줄이고, Google/Meta/Naver/organic/direct/unknown 사유를 주문 단위로 설명한다.

현재: Google 4건, Meta 3건, Naver 1건, direct/출처 없음 13건, 미분류 18건.

### KR4. Google Ads 전송 후보 품질

목표: Google Ads에는 실제 결제완료, 금액, 취소/환불 제외, 중복 방지, click id 근거가 모두 닫힌 주문만 보낸다.

현재: 전체 실제 구매 기준 전송 가능 출발점 5건. NPay bridge만 놓고 보면 즉시 자동 전송 후보는 0건.

## 액션플랜

### 1. NPay 버튼 클릭-결제완료 퍼널을 우선순위 1로 둔다

무엇을: 버튼 클릭, bridge_opened, checkout_opened_possible, completed, entered_not_completed를 channel별로 매일 같은 기준으로 본다.

왜: 클릭이 많은데 결제완료가 적은 이유가 광고 품질인지, NPay 로그인/결제 UX 이탈인지, 데이터 연결 유실인지 분리해야 한다.

성공 기준: Google/Meta/기타별 NPay 버튼 클릭 수, bridge 수, 결제완료 수, 전환율이 한 줄로 설명된다.

### 2. A/B/ambiguous 기준을 자동화한다

무엇을: NPay 실제 결제완료 주문마다 어떤 정보가 있고 어떤 정보가 없어서 A/B/ambiguous가 됐는지 자동 분류한다.

왜: 매번 수동으로 주문을 쪼개면 속도가 너무 느리고, 기준도 흔들린다.

성공 기준: 미분류 주문마다 `회원키 부족`, `시간 차이`, `금액 조합`, `상품명 변형`, `여러 클릭 후보` 중 최소 1개 이상의 설명이 붙는다.

### 3. bridge 저장값을 강화한다

무엇을: NPay 버튼 클릭 순간에 bridge URL, bridge host/path, 상품/수량/금액, 클릭 시각, client/session key, 광고 click id를 가능한 한 같이 저장한다.

왜: 네이버 외부 결제 완료 후 주문만 보면 원래 어떤 버튼 클릭에서 시작됐는지 알기 어렵다.

성공 기준: 실제 NPay 결제완료 주문 중 A급 또는 설명 가능한 B급 비율이 올라간다.

### 4. 금액 정규화를 강화한다

무엇을: 상품가, 배송비, 쿠폰, 수량, 장바구니, 세트상품을 분리해서 금액 불일치를 자동 분류한다.

왜: 단순 금액 불일치로 버리면 실제 같은 주문도 놓칠 수 있다.

성공 기준: 금액 불일치 주문이 `배송비`, `수량`, `장바구니/복수상품`, `쿠폰/할인`, `세트상품`, `아직 불명`으로 나뉜다.

### 5. Google Ads 전송은 마지막 단계로 둔다

무엇을: 실제 결제완료와 click id 근거가 모두 닫힌 후보만 제한적으로 자동 전송한다.

왜: 버튼 클릭을 구매로 보내면 Google Ads 학습이 다시 오염된다.

성공 기준: 전송 장부가 `ready`, `sent`, `reflected`, `failed`, `blocked`를 주문 단위로 남기고, 실패 이유가 사람이 이해할 수 있게 표시된다.

## 현재 진척률

전체 진척률: 약 63%.

- 버튼 클릭 수집: 90% 이상. Google 흔적 클릭 중 click id 보존은 약 98.7%.
- NPay bridge 저장: 68% 수준. VM Cloud backend v1.2 수집 준비는 배포와 smoke를 통과했다. 다만 GTM Production에는 아직 게시하지 않았으므로 실제 운영 유저의 v1.2 저장 효과는 다음 관측 구간에서 확인해야 한다.
- 실제 결제완료 자동 연결: 56% 수준. 최신 48시간에서 15건 중 A급 3건, ambiguous 12건까지 자동 사유가 붙었다.
- Google/Meta/기타 유입 분류: 58% 수준. 최신 48시간 completed 15건 중 Google 1건, Meta 2건은 분리됐고 12건은 연결키 부족으로 남았다.
- Google Ads 실제 구매 전송 후보 품질: 30% 수준. 전체 실제 구매 중 전송 가능 출발점은 일부 있으나, NPay bridge 쪽은 아직 후보율이 낮다.

## 다음 목표

진짜 병목은 네이버 외부 결제창을 지난 뒤 실제 결제완료 주문을 원래 버튼 클릭 row와 안정적으로 다시 붙이지 못하는 것을 해결하는 것이다.

다음 KR:

- KR1: 최신 48시간 기준 ambiguous completed 12건을 5건 이하로 줄인다.
- KR2: Google/Meta/Naver/direct/unknown 분류가 붙은 NPay 결제완료 비율을 20%대에서 70% 이상으로 올린다.
- KR3: NPay 버튼 클릭 100건당 `button_clicked`, `bridge_opened`, `checkout_opened_possible`, `completed`, `entered_not_completed`를 channel별로 매일 설명한다.
- KR4: Google Ads 전송 후보는 실제 결제완료 + Google click id + 중복방지 + 환불/취소 방어 + click view 확인까지 닫힌 주문만 산출한다.

## 금지선

- 이 문서 기준으로 Google Ads 전송을 새로 실행하지 않는다.
- VM Cloud write/deploy를 실행하지 않는다.
- GTM Production publish를 실행하지 않는다.
- 운영DB write/import를 실행하지 않는다.

위 작업은 모두 TJ님 명시 승인 후 별도 결과보고와 장부 확인을 붙여 진행한다.
