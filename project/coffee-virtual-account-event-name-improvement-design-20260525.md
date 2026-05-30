# 더클린커피 가상계좌 미입금 이벤트명 개선 설계

작성 시각: 2026-05-25 06:41 KST  
최근 업데이트: 2026-05-25 06:57 KST — Purchase Guard v3.2를 후순위 backlog로 재분류  
기준일: 2026-05-25  
문서 성격: no-send 설계 / 운영 반영 승인 전 후보  
Site: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/virtual-account-issued-v313-live-smoke-result-20260521.md
    - project/coffee-naver-brandsearch-vbank-smoke-result-20260525.md
    - project/coffee-imweb-full-paste-candidate-20260522.md
  lane: Green
  allowed_actions:
    - code_read
    - API_read_only
    - no_send_design
    - documentation
  forbidden_actions:
    - Imweb_code_edit
    - GTM_publish
    - Meta_CAPI_or_browser_new_send
    - GA4_Google_Naver_platform_send
    - VM_Cloud_deploy_or_restart
    - operational_DB_write
  source_window_freshness_confidence:
    source:
      primary: VM Cloud payment-decision API
      browser_cross_check: TJ님 Pixel Helper observation
      code_source: Imweb header top Purchase Guard v3 + backend payment-decision v4
    window: 2026-05-25 06:15-06:30 KST
    freshness: same-turn
    confidence: high for current guard safety, medium for exact browser ordering because Meta Pixel Helper timing is browser-side
```

## 10초 요약

가상계좌 미입금 주문은 실제 `Purchase`로 보내지지 않았다. 이 부분은 안전하다.

문제는 완료 직후 브라우저에서 `PurchaseDecisionUnknown`이 먼저 보일 수 있다는 점이다. 몇 초 뒤 서버 재조회는 `pending / block_purchase_virtual_account`로 정확히 닫혔다. 따라서 원인은 결제완료 페이지에서 `payment_success` 원장 저장과 Purchase Guard의 `payment-decision` 조회가 경쟁하는 타이밍 race로 보는 것이 맞다.

개선 방향은 `Unknown`을 빨리 보내지 말고, 주문/가상계좌 식별자가 있는 완료 페이지에서는 조금 더 기다린 뒤 `VirtualAccountIssued`로 낮추는 것이다. `Purchase` 허용 기준은 그대로 `confirmed`만 유지한다.

우선순위는 후순위다. 현재 guard는 미입금 가상계좌를 `Purchase`로 보내지 않는 핵심 안전 기준을 이미 지키고 있다. Purchase Guard v3.2는 정합성 필수 패치가 아니라 Pixel Helper와 리포트에서 pending 가상계좌가 더 명확히 보이게 하는 진단 품질 개선이다.

## 현재 동작

### 브라우저 측 Purchase Guard

위치:

- Imweb 헤더 상단
- `snippetVersion=2026-04-14-coffee-server-payment-decision-guard-v3`

현재 분기:

- `allow_purchase` → 원래 `Purchase` 호출 허용
- `block_purchase_virtual_account` → `VirtualAccountIssued` custom event
- `block_purchase` → `PurchaseBlocked` custom event
- 그 외 unknown → `PurchaseDecisionUnknown` custom event

현재 retry:

- `status=unknown`
- `reason=no_toss_or_ledger_match`
- 주문 식별자가 있을 때
- 900ms 후 1회 재조회

### 서버 측 payment-decision

위치:

- `GET /api/attribution/payment-decision`
- `PAYMENT_DECISION_VERSION=2026-05-21.payment-decision.fast-wait-v4`

서버 fast wait:

- 150ms
- 350ms
- 600ms
- 900ms

총 2초 정도 VM Cloud `attribution_ledger` exact match를 기다린다.

정확히 매칭되면:

- `pending` → `block_purchase_virtual_account`
- `confirmed` → `allow_purchase`
- `canceled` → `block_purchase`
- `unknown` → `hold_or_block_purchase`

## 이번 smoke에서 보인 현상

TJ님 Pixel Helper:

- 주문완료 직후 `PurchaseDecisionUnknown` 표시
- value는 주문 금액으로 표시됨
- `Purchase`는 표시되지 않음

Codex API 재조회:

- `status=pending`
- `browserAction=block_purchase_virtual_account`
- `confidence=high`
- `matchedBy=ledger_order_id`
- `reason=fast_ledger_pending_status`

해석:

1. 브라우저 Purchase guard가 먼저 decision endpoint를 호출했다.
2. 그 순간에는 payment_success 원장 row가 아직 exact match되지 않았거나, 브라우저 쪽 900ms retry 후에도 pending row가 늦게 들어왔다.
3. 그래서 Unknown custom event가 먼저 나갔다.
4. 이후 payment_success row가 저장되어 같은 주문은 서버 재조회에서 pending으로 정확히 닫혔다.

## 설계 목표

1. 미입금 가상계좌를 `Purchase`로 보내지 않는다.
2. pending 가상계좌는 `VirtualAccountIssued` 또는 같은 의미의 pending intent로 보이게 한다.
3. 확인 전 unknown을 너무 빨리 보내지 않는다.
4. 카드/간편결제 confirmed 구매는 불필요하게 오래 막지 않는다.
5. Meta/GA4/Google Ads/Naver 전송량을 늘리는 변경은 별도 승인 전 금지한다.

## 권장 설계

### 1. Unknown dispatch 지연

현재:

```text
unknown/no_toss_or_ledger_match
→ 900ms 후 1회 retry
→ 그래도 unknown이면 PurchaseDecisionUnknown 전송
```

권장:

```text
unknown/no_toss_or_ledger_match + 주문 식별자 있음
→ 900ms retry
→ 2,500ms retry
→ 5,000ms final retry
→ pending이면 VirtualAccountIssued
→ confirmed이면 Purchase 허용
→ canceled이면 PurchaseBlocked
→ 그래도 unknown이면 PurchaseDecisionUnknown
```

이 방식은 Unknown을 없애는 것이 아니라, 서버 원장이 늦게 들어오는 몇 초를 흡수한다.

### 2. Unknown/VBank diagnostic value를 0으로 낮춘다

현재 TJ님 smoke에서 `PurchaseDecisionUnknown` value가 주문 금액으로 보였다.

권장:

- `Purchase`만 실제 주문 금액 사용
- `VirtualAccountIssued`, `PurchaseDecisionUnknown`, `PurchaseBlocked`는 `value=0`
- 필요한 경우 원래 주문 금액은 `original_purchase_value` 같은 diagnostic parameter에만 둔다.

이유:

- 미입금/unknown은 매출이 아니다.
- custom event라도 value가 있으면 플랫폼 UI 해석이 혼란스러울 수 있다.

### 3. decision response의 `pending`을 브라우저가 우선 신뢰한다

브라우저는 서버가 `pending`을 반환하면 즉시 `VirtualAccountIssued`로 처리한다. 이 정책은 이미 있다. 개선은 pending이 뒤늦게 들어오는 경우를 기다리는 것이다.

### 4. 서버 wait를 무작정 늘리지는 않는다

서버 endpoint 자체 wait를 5-7초로 늘리면 모든 결제완료 페이지에서 응답이 느려질 수 있다. 먼저 브라우저의 unknown branch에만 제한적으로 추가 retry를 두는 편이 낫다.

## 구현 후보

### 후보 A. Imweb 헤더 상단 Purchase Guard v3.2

무엇을 바꾸나:

- `decisionRetryDelayMs`를 단일 값에서 배열로 바꾼다.
- unknown branch는 final retry 전까지 custom event를 보내지 않는다.
- pending/blocked/unknown custom event value를 0으로 낮춘다.

장점:

- VM Cloud 서버 배포 없이 처리 가능하다.
- 현재 문제의 직접 원인인 브라우저 race를 흡수한다.

단점:

- Imweb 헤더 상단 교체가 필요하다.
- 운영 사이트 스크립트 변경이므로 승인 필요.

권장도: 후순위 P2. 하기는 하되, Naver/Google 클릭-주문 evidence와 결제 시작 이벤트 정합성 작업보다 뒤에 둔다.

### 후보 B. VM Cloud payment-decision fast wait 확대

무엇을 바꾸나:

- `PAYMENT_DECISION_FAST_WAIT_DELAYS_MS`를 더 길게 늘린다.

장점:

- 브라우저 코드 변경 없이 서버가 늦게 들어오는 ledger를 더 기다린다.

단점:

- confirmed/card 구매까지 응답 지연이 늘 수 있다.
- 서버 배포가 필요하다.

권장도: 후순위 P3. 서버 응답 지연 영향이 있어 v3.2보다 더 보수적으로 본다.

### 후보 C. payment-success receiver가 pending virtual-account hint를 즉시 저장

무엇을 바꾸나:

- 가상계좌 완료 referrer/query hint가 있으면 `payment_success pending` row 저장 타이밍을 더 앞당긴다.

장점:

- ledger race 자체를 줄인다.

단점:

- backend receiver 변경과 배포가 필요하다.
- 현재도 최종적으로 pending row는 저장되므로 우선순위는 후보 A보다 낮다.

권장도: 후순위 P3. ledger race를 줄이는 후보지만 서버 배포가 필요하고 현재 핵심 구매 차단은 이미 PASS다.

## 운영 반영 승인안 초안

승인 이름:

```text
더클린커피 Imweb 헤더 상단 Purchase Guard v3.2 unknown retry + diagnostic value zero 반영
```

허용 작업:

- Imweb 헤더 상단 코드의 Purchase Guard block만 교체
- `PurchaseDecisionUnknown` dispatch 지연
- `VirtualAccountIssued` / `PurchaseDecisionUnknown` / `PurchaseBlocked` value 0 처리
- 테스트 주문 1건 이하 smoke

금지 작업:

- Meta Purchase 신규 전송 늘리기
- Meta CAPI enable
- GA4/Google Ads/Naver 전환 전송
- GTM publish
- VM Cloud deploy/restart
- 운영DB write
- confirmed 구매 판단 기준 완화

성공 기준:

- 가상계좌 미입금 주문에서 `Purchase` 0건
- `VirtualAccountIssued` 1건 또는 pending intent 1건
- `PurchaseDecisionUnknown` 0건 또는 final unknown일 때만 1건
- server decision은 `pending / block_purchase_virtual_account`
- 중복 custom event 없음

Hard Fail:

- 미입금 가상계좌에서 `Purchase` 발생
- 같은 주문에서 `VirtualAccountIssued`와 `PurchaseDecisionUnknown`이 둘 다 발생
- confirmed 카드 결제에서 `Purchase`가 누락되는 재현
- console/network에서 5초 이상 반복 polling이 무한 지속

Rollback:

- 현재 헤더 상단 백업본으로 되돌린다.
- VM Cloud 변경이 없으므로 서버 rollback은 필요 없다.

## 하지 않은 것

- Imweb 코드 교체: 0건
- GTM publish: 0건
- VM Cloud deploy/restart: 0건
- 운영DB write: 0건
- Meta/GA4/Google Ads/Naver send 변경: 0건

## 다음 할일

### Auto Green

1. Purchase Guard v3.2 full paste 후보를 후순위 backlog로 만든다.
   - 이유: 하기는 하되, 지금 당장 매출/광고 ROAS 정합성의 핵심 blocker는 아니다. 승인 후 TJ님이 바로 붙여 넣을 수 있는 형태로만 준비해 둔다.
   - 성공 기준: 기존 v3와 diff가 retry/value 정책에만 제한된다.
   - 의존성: Google/Naver 클릭-주문 evidence 보강과 Meta InitiateCheckout 운영 smoke 정리 이후.
   - 승인 필요: 문서 작성 NO.

### Approval Needed

1. Imweb 헤더 상단 Purchase Guard v3.2 운영 반영.
   - 이유: 브라우저 완료 직후 Unknown race를 줄인다.
   - 성공 기준: 다음 가상계좌 smoke에서 `VirtualAccountIssued`가 보이고 `PurchaseDecisionUnknown`은 final fallback에서만 보인다.
   - 의존성: full paste 후보 작성 + 헤더 상단 백업 확인 + TJ님 운영 반영 승인.
   - 승인 필요: YES, 운영 사이트 스크립트 변경.
