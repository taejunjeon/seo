# Imweb v4.4.3 Google click id fixture smoke 결과

작성 시각: 2026-05-21 18:18 KST
기준일: 2026-05-21
문서 성격: Green Lane 로컬 fixture smoke 결과 / Imweb 운영 반영 전 검증 근거

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - gdn/imweb-payment-success-checkout-context-v443-change-map-20260521.md
    - gdn/payment-success-checkout-context-v443-stale-click-id-guard-plan-20260521.md
  required_context_docs:
    - docurule.md
  lane: Green
  allowed_actions:
    - local fixture creation
    - local fixture execution
    - no-send/no-write result documentation
  forbidden_actions:
    - Imweb live custom-code edit
    - backend deploy
    - GTM production publish
    - VM Cloud or production DB write
    - Meta/Google/TikTok platform send
  source_window_freshness_confidence:
    source: local fixture based on TJ님 provided Imweb header/footer logic
    window: 2026-05-21 current Imweb code snapshot
    freshness: 2026-05-21 18:18 KST
    confidence: 0.95
```

## 10초 요약

v4.4.3 로컬 fixture smoke는 7개 케이스 모두 통과했다. 새 Google 광고 클릭이 `gclid+gbraid`만 가진 경우 과거 저장소의 `wbraid`가 checkout/payment payload로 섞이지 않는 것을 확인했다.

동시에 실제 `wbraid` only 클릭은 버리지 않고 보존되는지도 확인했다. 따라서 v4.4.3은 stale `wbraid` 제거와 실제 `wbraid` 보존을 동시에 만족한다.

이번 smoke는 로컬 검증이다. 운영 아임웹 헤더/푸터 코드는 아직 바꾸지 않았다.

## 만든 파일

`scripts/imweb-v443-click-id-fixture.mjs`

역할:

1. 현재 v4.4.2 계열의 독립 fallback 방식이 stale `wbraid`를 섞는지 control로 확인한다.
2. v4.4.3의 atomic Google click id 선택 규칙이 같은 상황에서 stale `wbraid`를 제거하는지 확인한다.
3. 헤더 bootstrap, 푸터 Block 1, Block 2, Block 3에 필요한 핵심 병합 규칙을 로컬 함수로 재현한다.

## 실행 명령

```bash
node scripts/imweb-v443-click-id-fixture.mjs
```

실행 결과:

```text
PASS header bootstrap: fresh gclid+gbraid must not inherit stale wbraid
PASS footer block1: last/session touch must use one Google click-id set
PASS checkout context: document referrer fresh click should outrank polluted storage
PASS payment success: v4.4.3 checkout context must block stale fallback
PASS real wbraid-only Google click must be preserved
PASS legacy checkout context remains fallback only when no fresher source exists
PASS fbclid and ttclid behavior stays independent from Google guard

7/7 fixture cases passed
```

## 검증한 케이스

### 1. 헤더 bootstrap

새 URL에 `gclid+gbraid`가 있고 이전 저장소에 stale `wbraid`가 있을 때, v4.4.3은 새 URL 묶음만 선택한다.

성공 기준:

- `gclid` 있음
- `gbraid` 있음
- `wbraid` 없음
- source는 `incoming`

결과: PASS

### 2. 푸터 Block 1

`_p1s1a_last_touch`와 `_p1s1a_session_touch`를 갱신할 때도 Google click id 3종을 한 묶음으로만 선택한다.

성공 기준:

- 새 `gclid+gbraid`가 있으면 이전 stale `wbraid`를 끌고 오지 않는다.
- `fbclid`, `ttclid` 기존 fallback은 유지된다.

결과: PASS

### 3. 푸터 Block 2 checkout_context

결제 페이지 URL에는 click id가 없고, 직전 상품 페이지 referrer에 새 `gclid+gbraid`가 있을 때 referrer 묶음을 우선 선택한다.

성공 기준:

- source는 `document_referrer`
- `gclid+gbraid` 보존
- stale `wbraid` 제거

결과: PASS

### 4. 푸터 Block 3 payment_success

v4.4.3 checkout context가 이미 깨끗하면, 주문완료 페이지에서 더 오래된 click context나 last touch로 fallback 하지 않는다.

성공 기준:

- source는 `checkout_context_v4_4_3`
- `gclid+gbraid` 보존
- stale `wbraid` 제거

결과: PASS

### 5. 실제 wbraid only 클릭 보존

새 Google 클릭 자체가 `wbraid`만 가진 경우는 버리면 안 된다.

성공 기준:

- `wbraid` 유지
- `gclid`, `gbraid` 없음
- source는 실제 click source

결과: PASS

### 6. legacy checkout fallback

새 source가 전혀 없고 legacy checkout context만 있는 경우는 기존 값을 fallback으로 유지한다.

성공 기준:

- legacy `wbraid` 유지
- source는 `legacy_checkout_context`

결과: PASS

### 7. fbclid/ttclid 영향 없음

이번 보강은 Google click id 3종의 혼합 방지다. Meta/TikTok click id fallback은 기존처럼 독립 보존한다.

성공 기준:

- `fbclid` 새 값 우선
- `ttclid` 기존 값 유지
- Google stale `wbraid` 제거

결과: PASS

## 해석

fixture 기준으로는 v4.4.3 설계가 맞다. 핵심은 `wbraid`를 단순히 지우는 것이 아니다. 실제 `wbraid` only 클릭은 보존하고, 새 `gclid+gbraid` 클릭에 과거 `wbraid`가 섞이는 경우만 차단한다.

따라서 운영 반영 시에는 헤더/푸터 4개 수정 대상에 같은 atomic Google click id 선택 규칙을 일관되게 적용해야 한다.

## 하지 않은 것

1. 아임웹 운영 custom code 수정 없음.
2. backend deploy 없음.
3. GTM publish 없음.
4. VM Cloud/운영DB write 없음.
5. Meta/Google/TikTok 전환 전송 없음.
6. 실제 광고 클릭 또는 결제 테스트 없음.

## 운영 반영 전 승인 필요 사항

승인 요청 이름: Imweb v4.4.3 운영 반영.

내가 실제로 바꿀 화면: 아임웹 사이트 설정의 헤더/푸터 custom code 영역.

바꾸는 설정 이름:

1. 헤더 코드 상단 `BI / Google Click ID Bootstrap v1`
2. 푸터 `Block 1: UTM persistence + Google click-id preservation v4.1`
3. 푸터 `Block 2: checkout_started / checkout_context v4.2`
4. 푸터 `Block 3: payment_page_seen / payment_success split v4.4.2`

바꾸면 생기는 효과: 새 Google 광고 클릭의 `gclid/gbraid`와 과거 저장소의 stale `wbraid`가 같은 주문에 섞이지 않는다.

안 바꾸면 남는 문제: 새 Google 광고 클릭 테스트에서도 `payment_success.metadata.wbraid`에 과거 테스트 값이 다시 붙을 수 있다.

승인 필요 여부: YES, Red Lane.

의존성: 이번 fixture smoke PASS가 선행 검증이다. backend 배포나 GTM publish와는 별개다.

추천 점수/자신감: 92%.

## 다음 할일

1. Codex가 아임웹에 붙여넣을 v4.4.3 패치본을 작성한다.
무엇을/왜: TJ님이 실제로 헤더/푸터에 반영할 수 있는 형태의 교체 코드를 만든다.
어떻게/어디서: 현재 제공 코드 기준으로 수정 대상 4개 블록만 v4.4.3 규칙으로 바꾸고, 나머지 블록은 그대로 둔다.
누가: Codex.
성공 기준: 기존 코드 대비 변경점이 4개 블록에만 제한되고, fixture smoke가 계속 PASS한다.
실패 시 확인점: 중복 script marker, dedupe prefix 변경 여부, legacy checkout fallback 순서.
승인 필요 여부: 패치본 작성은 NO, 운영 붙여넣기는 YES.
의존성: 없음.
추천 점수/자신감: 93%.

2. TJ님이 Imweb v4.4.3 운영 반영을 승인한다.
무엇을/왜: 실제 아임웹 결제 흐름에서 stale `wbraid` 혼입을 막는다.
어떻게/어디서: 이 대화에 `Imweb v4.4.3 운영 반영 승인`이라고 답하면 된다.
누가: TJ님 승인, Codex 반영 지원.
성공 기준: 운영 HTML에 새 version marker가 보이고, 새 Google 광고 테스트 주문에서 stale `wbraid`가 사라진다.
실패 시 확인점: 아임웹 저장/캐시 지연, header/footer 중복 코드, browser storage stale 상태.
승인 필요 여부: YES, Red Lane.
의존성: 1번 패치본 확인 후 진행 권장.
추천 점수/자신감: 90%.
