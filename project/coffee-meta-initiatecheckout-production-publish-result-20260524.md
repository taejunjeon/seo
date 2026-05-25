# 더클린커피 Meta InitiateCheckout 운영 게시 결과

작성 시각: 2026-05-24 16:47 KST
최종 업데이트: 2026-05-25 06:12 KST
기준일: 2026-05-24
문서 성격: Red-approved GTM Production publish 결과 보고
Lane: Red approved / executed

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
    - project/coffee-meta-initiatecheckout-production-approval-20260524.md
    - project/coffee-meta-initiatecheckout-gtm-preview-create-result-20260524.md
    - GA4/gtm-thecleancoffee.md
  lane: Red approved
  allowed_actions:
    - GTM fresh workspace create
    - GTM Custom HTML production tag create
    - GTM DOM Ready trigger create
    - GTM quick_preview
    - GTM create_version
    - GTM Production publish
    - same-tag hotfix update after runtime smoke
    - GTM API read-only postcheck
    - documentation_update
  forbidden_actions:
    - Meta Purchase event send
    - Meta CAPI enable/send
    - GA4 Measurement Protocol send
    - Google Ads conversion upload
    - Naver/TikTok platform send
    - production DB or VM Cloud SQLite write
    - backend deploy/restart
  source_window_freshness_confidence:
    source: GTM API publish response + GTM API read-only postcheck + TJ님 browser smoke console + Meta Pixel Helper
    window: 2026-05-24 16:37~2026-05-25 06:12 KST
    freshness: same-turn
    confidence: 0.94
```

## 10초 요약

더클린커피 일반 주문서 `/shop_payment/`에서 빠져 있던 Meta `InitiateCheckout`을 GTM 운영 태그로 추가했다. 기존 GA4 `begin_checkout`, 정기구독 `/subscription/`의 기존 Meta 이벤트, 구매완료 `Purchase` guard는 건드리지 않았다. 2026-05-25 05:57 KST 실제 주문서 smoke에서 `missing_value` 안전 차단이 확인되어 같은 태그에 주문금액 렌더링 재시도 guard를 추가했고, 2026-05-25 06:12 KST 재-smoke에서 Meta Pixel Helper와 콘솔 모두 PASS를 확인했다. 최종 live version은 `24`이며, 목표 tag/trigger는 각각 1건만 유지된다.

## 승인과 범위

TJ님 승인 문구:

```text
승인합니다. 더클린커피 GTM-5M33GC4에 일반 주문서 /shop_payment/ 전용 Meta browser InitiateCheckout 운영 태그를 fresh workspace에서 만들고 Preview 후 Production publish까지 진행하세요.
```

해석한 운영 범위:

- 대상 container: `GTM-5M33GC4`
- 대상 화면: 일반 주문서 `/shop_payment/`
- 이벤트: Meta browser `InitiateCheckout`
- 제외: `/subscription/`, `/shop_payment_complete`, `/shop_order_done`, `Purchase`, Meta CAPI, GA4/Google Ads/Naver/TikTok 전송, DB write

## 실행 결과

- dry-run result: `PASS_DRY_RUN_READY`
- production publish result: `PASS_PRODUCTION_PUBLISH`
- post-publish read-only result: `PASS_READONLY_POST_PUBLISH`
- live version before: `21` / `AGENTSOS GA4 begin_checkout rename - 2026-05-18`
- first live version after: `22` / `Coffee Meta InitiateCheckout shop_payment - 20260524T073809Z`
- subscription guard live version after: `23` / `Coffee Meta InitiateCheckout shop_payment subscription guard - 20260524T074633Z`
- value retry hotfix live version after: `24` / `Coffee Meta InitiateCheckout shop_payment value retry guard - 20260524T210252Z`
- first workspace: id `31` / `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T073809Z`
- guard workspace: id `32` / `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T074633Z`
- value retry workspace: id `33` / `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T210252Z`
- workspace after publish: `false`
- tag: id `99` / `AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment`
- trigger: id `98` / `AGENTSOS - [DOM Ready] shop_payment order only`
- quick preview compiler error: `false`
- live target tag count: `1`
- live target trigger count: `1`
- live 구성 수 after publish: tags `34` / triggers `25` / variables `13`
- workspace after publish: Default Workspace 1개만 남음
- final guard: `subscription_checkout_excluded` + `waiting_value` 확인됨

## 2026-05-25 runtime smoke 반영

TJ님이 2026-05-25 05:57 KST에 실제 일반 상품 주문서로 진입해 브라우저 콘솔을 확인했다. 결과는 `status=blocked`, `reason=missing_value`, `snippetVersion=2026-05-24-coffee-meta-initiatecheckout-shop-payment-v2-subscription-exclusion`이었다.

해석:

- 태그는 실행됐다.
- `/shop_payment/` 조건도 통과했다.
- 하지만 더클린커피 주문서의 React DOM이 늦게 렌더링되어, `DOM Ready` 시점에는 `총 주문금액` 텍스트를 아직 못 읽었다.
- 안전 guard 때문에 Meta `InitiateCheckout` 전송은 막혔다.

조치:

- 같은 tag id `99`의 HTML만 업데이트했다.
- `valueRetryMs=[0,100,250,500,1000,2000,3500,5000,8000]`를 추가해 최대 8초 동안 주문금액 렌더링을 기다린다.
- 재시도 중에는 `window.__THECLEANCOFFEE_META_INITIATECHECKOUT_LAST__`에 `status=waiting`, `reason=waiting_value`를 남긴다.
- 최종 실패 시에는 `rootPresent`, `rootHasTotalLabel`, `bodyHasTotalLabel` 진단값을 남긴다.

## 2026-05-25 v24 browser smoke PASS

TJ님이 GTM Tag Assistant 연결 상태에서 작업공간 업데이트 후 실제 일반 상품 주문서로 진입해 v24를 재검증했다.

확인 결과:

- Meta Pixel Helper: `InitiateCheckout` 활성
- value: `33900`
- currency: `KRW`
- content_type: `product`
- checkout_id_present: `true`
- order_code_present: `true`
- order_no_present: `true`
- value_status: `present`
- value_selector: `#oms-shop-payment text:total_order_price`
- eventID: `InitiateCheckout.f4c64d08`
- console status: `sent`

판정:

- 일반 주문서 `/shop_payment/` Meta browser `InitiateCheckout` 운영 발화는 PASS다.
- v23의 `missing_value`는 v24 value retry로 해결됐다.
- eventID는 hash 형식이라 raw order code를 노출하지 않는다.

## 운영 태그 동작

태그는 아래 조건을 모두 만족해야 Meta browser `InitiateCheckout`을 보낸다.

1. path가 `/shop_payment` 또는 `/shop_payment/`다.
2. query 또는 checkout context에 `order_code`, `order_no`, `checkoutId` 중 하나가 있다.
3. 주문서 본문이 정기구독 checkout이 아니다.
4. 주문 요약의 `총 주문금액` 또는 fallback selector에서 value를 읽는다. 값이 아직 없으면 최대 8초까지 재시도한다.
5. `fbq`가 로드되어 있다.
6. 같은 sessionStorage dedupe key로 이미 보낸 이벤트가 아니다.

전송 payload는 `value`, `currency=KRW`, `content_type=product`, 존재 여부 boolean, snippet version을 담는다. eventID는 raw order code가 아니라 hash 형식이다.

## 하지 않은 것

- Meta `Purchase` 이벤트를 만들지 않았다.
- Meta CAPI를 켜거나 보내지 않았다.
- GA4 Measurement Protocol을 보내지 않았다.
- Google Ads conversion upload를 하지 않았다.
- Naver/TikTok 전송을 하지 않았다.
- 운영DB 또는 VM Cloud SQLite에 write하지 않았다.
- backend deploy/restart를 하지 않았다.

## Evidence

- dry-run JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-dry-run-20260524T073751Z.json`
- prepublish backup JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-prepublish-backup-20260524T073809Z.json`
- publish JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T073809Z.json`
- subscription guard dry-run JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-dry-run-20260524T074559Z.json`
- subscription guard publish JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T074633Z.json`
- final post-publish read-only JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-postpublish-readonly-20260524T074650Z.json`
- value retry dry-run JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-dry-run-20260524T210228Z.json`
- value retry publish JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T210252Z.json`
- value retry post-publish dry-run JSON: `data/project/coffee-meta-initiatecheckout-gtm-production-dry-run-20260524T210340Z.json`
- publish script: `backend/scripts/coffee-meta-initiatecheckout-gtm-production-publish.ts`

## 남은 확인

일반 주문서 `/shop_payment/`의 실제 Meta Pixel Helper smoke는 PASS다. 남은 확인은 중복과 제외 guard다.

확인 기준:

1. `/subscription/`: 기존 native `InitiateCheckout` 외 추가 중복 없음.
2. `/shop_payment_complete`: 이 태그 발화 없음.
3. `PurchaseDecisionUnknown`, `PurchaseBlocked`, `VirtualAccountIssued`, `Purchase` guard 변화 없음.
