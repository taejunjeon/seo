# 더클린커피 Meta InitiateCheckout 운영 반영 승인안

작성 시각: 2026-05-24 16:29 KST
기준일: 2026-05-24
문서 성격: Meta browser `InitiateCheckout` 운영 전송 / GTM Production publish 승인안
Lane: Red approval required

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - GA4/gtm-thecleancoffee.md
    - project/coffee-meta-checkout-event-gap-gtm-preview-plan-20260522.md
    - project/coffee-meta-initiatecheckout-gtm-preview-create-result-20260524.md
  lane: Red
  allowed_actions_before_approval:
    - approval_doc_write
    - read_only_gtm_check
    - no_send_preview_evidence_review
    - cleanup_preview_workspace
  forbidden_actions_before_approval:
    - GTM Submit/Create version/Production publish
    - Meta browser event production send
    - Meta CAPI enable/send
    - GA4/Google Ads/Naver/TikTok production send
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: GTM API read-only + TJ님 Tag Assistant/Pixel Helper observation + no-send Preview result
    window: 2026-05-24 13:18~16:29 KST
    freshness: same-day
    confidence: 0.9
```

## 한 줄 결론

승인 추천은 **조건부 YES**다. 더클린커피 일반 주문서 `/shop_payment/`에는 Meta `InitiateCheckout` 공백이 있고, no-send Preview에서 trigger/value/payload가 통과했다. 단, 정기구독 `/subscription/` 흐름은 이미 기존 Imweb/FBE 계열 `InitiateCheckout`이 있으므로 운영 태그는 `/shop_payment/` 일반 주문서에만 좁혀야 한다.

## 하네스 준수 분석

이번 건은 하네스 원칙을 바꿀 문제가 아니라, Codex가 하네스 원칙을 덜 밀어붙인 문제다.

근거:

1. 공통 하네스의 Execution Momentum Rule은 “안전하거나 이미 승인된 범위는 실행, 검증, 결과 문서, cleanup/report까지 간다”고 한다.
2. Yellow Lane Sprint Rule은 GTM Preview 승인 후 `setup -> 실행 -> smoke/validation -> cleanup -> cleanup 검증 -> audit -> 완료 보고`까지 중간 확인 없이 끝내라고 한다.
3. Reporting Template v1.3도 Green 작업은 1차 검증 후 추가 조사, 설계, approval packet까지 같은 sprint 안에서 끌고 가라고 한다.

따라서 no-send Preview가 `PASS_FINAL_NO_SEND`로 닫힌 직후 Codex가 자동으로 해야 했던 일은 아래였다.

- 운영 반영 승인안 작성.
- Red Lane 경계 명시.
- no-send workspace 유지/삭제 판단.
- 삭제가 맞으면 backup 후 cleanup.
- live version unchanged 검증.
- 다음 승인 문구와 성공/중단 기준 보고.

실제 Codex 행동은 Preview PASS 후 “다음은 운영 반영 판단”으로 멈췄다. 이는 승인 부족이 아니라 Execution Momentum 준수 미흡이다.

하네스 변경 제안:

- 공통 하네스 변경은 필요 없다.
- 재발 방지를 위해 project-local checklist에만 후보 규칙을 추가할 수 있다: “GTM no-send Preview PASS 후에는 운영 승인안과 Preview workspace cleanup 판단을 같은 턴에서 자동 작성한다.”
- 이 후보 규칙은 하네스의 새 예외가 아니라 기존 Yellow cleanup/report 원칙의 더클린커피용 체크리스트화다.

## 왜 필요한가

Meta Pixel 기본 설치는 `PageView`를 만들 수 있지만, `InitiateCheckout`은 결제 시작 시점에 누군가가 명시적으로 `fbq('track', 'InitiateCheckout', ...)`를 호출해야 한다.

현재 관측은 아래처럼 분리된다.

- 정기구독 상품 흐름: 기존 Imweb/FBE 또는 footer wrapper 계열 `InitiateCheckout` 1건 존재.
- 일반 주문서 `/shop_payment/`: 운영 `InitiateCheckout` 추가 발생 없음.
- no-send Preview: 주문서 화면에서 value/currency를 읽고 `coffee_meta_middle_funnel_preview` 1회 생성 성공.

운영 반영을 하지 않으면 일반 주문서 결제 시작 신호가 Meta middle funnel에서 빠진다. 이는 구매완료가 아니라 결제 시작 단계 신호라 ROAS 매출값을 직접 바꾸는 작업은 아니지만, Meta 이벤트 수와 퍼널/학습에 영향을 주므로 승인 후에만 진행한다.

## 현재 증거

### GTM live 상태

- container: `GTM-5M33GC4`
- live version: `21`
- live version name: `AGENTSOS GA4 begin_checkout rename - 2026-05-18`
- existing GA4 begin_checkout chain:
  - tag 51 `AGENTSOS - [begin_checkout] 주문서작성`
  - tag 35 `AGENTSOS - [GA4 이벤트전송] begin_checkout`
- Meta/Facebook/fbq 전용 GTM tag: 0건
- `add_payment_info` GTM tag: 0건

### no-send Preview PASS

- Preview workspace: `codex_coffee_meta_initiatecheckout_nosend_preview_20260524T042930Z`
- tag id: `96`
- trigger id: `95`
- 주문서 화면 firing: 1회
- event: `coffee_meta_middle_funnel_preview`
- eventName: `InitiateCheckout`
- noSend/noFbq/noPixelRequest: true
- value/currency: `21900` / `KRW`
- value selector: `#oms-shop-payment text:총 주문금액`
- 운영 Meta `InitiateCheckout` 추가 발생: 0건

## 승인하면 바뀌는 것

TJ님이 승인하면 GTM fresh workspace에서 운영용 Meta browser tag를 만든 뒤, 별도 최종 확인 후 Production publish한다.

실제로 바뀌는 설정:

- GTM container: `GTM-5M33GC4`
- 새 태그 후보: `AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment`
- 새 트리거 후보: `AGENTSOS - [DOM Ready] shop_payment order only`
- 발화 위치: `thecleancoffee.com/shop_payment/` 주문서 화면
- 제외 위치: `/subscription/`, `/shop_payment_complete`, `/shop_order_done`, 일반 상품 상세, 장바구니, 결제완료
- 전송 대상: Meta Pixel id `1186437633687388`
- 이벤트명: `InitiateCheckout`
- 전송 값: `value`, `currency=KRW`, eventID

효과:

- 일반 주문서 결제 시작이 Meta 표준 이벤트로 보인다.
- 정기구독 흐름의 기존 `InitiateCheckout`은 건드리지 않는다.
- 구매완료 `Purchase`와는 분리한다. 이 태그는 매출 확정 이벤트가 아니다.

안 바꾸면 남는 문제:

- 일반 주문서 `/shop_payment/` 결제 시작이 Meta에서 계속 공백으로 남는다.
- 상품상세/정기구독과 일반 주문서의 Meta middle funnel 비교가 계속 불완전하다.

## 추천 구현안

### 추천안 A — GTM 운영 태그로 좁게 반영

추천: YES, confidence 88%

이유:

- no-send Preview가 이미 GTM trigger/value 조건을 통과했다.
- Imweb footer 전체 교체보다 변경 범위가 작다.
- 문제 발생 시 GTM live version rollback이 쉽다.
- `/subscription/` 기존 native 이벤트와 분리하기 쉽다.

운영 태그 조건:

1. URL path는 `/shop_payment/`.
2. query에 `order_code` 또는 `order_no`가 있다.
3. 완료 URL은 제외한다.
4. sessionStorage dedupe로 주문서 1회만 전송한다.
5. `value`가 없으면 전송하지 않고 console/dataLayer debug만 남긴다.
6. `fbq`가 없으면 최대 5초까지 짧게 retry하고 실패 시 전송하지 않는다.
7. eventID는 raw order code가 아니라 deterministic hash 형식으로 만든다.

### 대안 B — Imweb footer browser fallback로 반영

추천: 보류, confidence 62%

이유:

- 바이오컴 방식과 철학적으로 더 비슷하다.
- 하지만 Coffee footer에는 Purchase Guard, attribution capture, funnel-capi wrapper가 이미 많아 전체 저장 리스크가 더 크다.
- 지금 문제는 GTM Preview에서 조건이 검증됐으므로 footer 전체 교체가 먼저일 필요는 없다.

## 승인 범위

TJ님이 아래 문구로 승인하면 진행 가능하다.

```text
승인합니다. 더클린커피 GTM-5M33GC4에 일반 주문서 /shop_payment/ 전용 Meta browser InitiateCheckout 운영 태그를 fresh workspace에서 만들고 Preview 후 Production publish까지 진행하세요. 단 /subscription/은 제외하고, Purchase/Google Ads/GA4/Meta CAPI/DB write는 금지합니다.
```

승인 후 허용:

- fresh GTM workspace 생성
- 운영용 Custom HTML 태그 생성
- 운영용 DOM Ready trigger 생성
- Preview 확인
- Production publish
- publish 후 live version 기록
- publish 후 Tag Assistant/Pixel Helper smoke
- 문제 발생 시 GTM rollback 승인안 또는 즉시 rollback 실행 요청

승인 후에도 금지:

- Meta `Purchase` 전송
- Meta CAPI enable/send
- GA4 Measurement Protocol send
- Google Ads conversion upload
- TikTok/Naver send
- 운영DB/VM Cloud SQLite write
- `/subscription/` 이벤트 중복 생성
- 결제완료를 `InitiateCheckout` 또는 `Purchase`로 오분류

## 성공 기준

1. GTM live version이 새 버전으로 올라간다.
2. `/shop_payment/` 주문서에서 Meta Pixel Helper에 `InitiateCheckout` 1회가 보인다.
3. value/currency가 들어간다.
4. eventID가 존재한다.
5. `/subscription/`에서는 기존 native `InitiateCheckout` 외 추가 중복이 없다.
6. `/shop_payment_complete`에서는 이 태그가 발화하지 않는다.
7. `PurchaseDecisionUnknown`, `PurchaseBlocked`, `VirtualAccountIssued`, `Purchase` guard에는 변화가 없다.

## 중단 기준

아래 중 하나면 publish 금지 또는 즉시 중단한다.

- `/subscription/`에서 새 태그가 Fired.
- `/shop_payment_complete`에서 새 태그가 Fired.
- value가 비어 있는데도 전송하려는 상태.
- Pixel Helper에서 `InitiateCheckout`이 2회 이상 생김.
- 기존 GA4 `begin_checkout` tag 35/51이 변경 대상에 섞임.
- workspace mergeConflict 발생.
- live version이 승인 전과 달라져 fresh workspace가 stale이 됨.

## Rollback

가장 단순한 rollback은 GTM 이전 live version으로 되돌리는 것이다.

rollback 조건:

- publish 후 중복 `InitiateCheckout` 2회 이상.
- subscription 중복 발생.
- 완료 페이지 발화.
- Meta Pixel Helper에서 value/currency 누락이 반복.

rollback 후 확인:

- live version rollback 완료.
- `/shop_payment/`에서 새 `InitiateCheckout` 사라짐.
- 기존 PageView/ViewContent/Purchase Guard 정상.

## Workspace id 30 처리 판단

workspace id `30`은 no-send Preview 검증용이다. 운영 publish 후보가 아니다.

판정은 **삭제**다. 2026-05-24 16:27 KST에 cleanup까지 완료했다.

이유:

1. no-send evidence는 문서와 JSON으로 남았다.
2. 운영 태그는 실제 send 코드가 필요하므로 fresh workspace에서 새로 만드는 편이 안전하다.
3. no-send workspace를 남기면 나중에 publish 후보로 오해할 수 있다.

처리 결과:

- cleanup result JSON: `data/project/coffee-meta-initiatecheckout-gtm-preview-workspace30-cleanup-20260524T072654Z.json`
- workspace before count: `2`
- workspace after count: `1`
- workspace id `30` present after cleanup: `false`
- live version before/after: `21` / `21`
- live version unchanged: `true`
- Submit/Create version/Production publish: `0건`
- platform send: `0건`
- verdict: `PASS_PREVIEW_WORKSPACE30_CLEANUP`

## 운영 반영 실행 결과

TJ님이 2026-05-24 KST에 운영 반영을 승인했고, 같은 날 fresh workspace에서 Preview 후 Production publish까지 완료했다.

결과:

- dry-run: `PASS_DRY_RUN_READY`
- dry-run JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-dry-run-20260524T073751Z.json`
- Production publish verdict: `PASS_PRODUCTION_PUBLISH`
- publish JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T073809Z.json`
- prepublish backup: `data/project/coffee-meta-initiatecheckout-gtm-production-prepublish-backup-20260524T073809Z.json`
- subscription guard publish JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T074633Z.json`
- final post-publish read-only JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-postpublish-readonly-20260524T074650Z.json`
- live version before/final after: `21` -> `23`
- created versions:
  - `22` / `Coffee Meta InitiateCheckout shop_payment - 20260524T073809Z`
  - `23` / `Coffee Meta InitiateCheckout shop_payment subscription guard - 20260524T074633Z`
- workspace: id `31` / `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T073809Z`
- guard workspace: id `32` / `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T074633Z`
- workspace present after publish: `false`
- tag: id `99` / `AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment`
- trigger: id `98` / `AGENTSOS - [DOM Ready] shop_payment order only`
- target live tag count: `1`
- target live trigger count: `1`
- live 구성 수 after publish: tags `34` / triggers `25` / variables `13`
- final guard: `subscription_checkout_excluded` 확인됨

유지된 금지선:

- Meta `Purchase` 전송 없음.
- Meta CAPI enable/send 없음.
- GA4 Measurement Protocol send 없음.
- Google Ads/Naver/TikTok 전송 없음.
- 운영DB 또는 VM Cloud SQLite write 없음.
- backend deploy/restart 없음.

## 다음 액션

1. 실제 주문서에서 Tag Assistant/Pixel Helper smoke.
2. `/subscription/` 중복 없음 확인.
3. `/shop_payment_complete` 발화 없음 확인.
4. 24h 모니터링.
