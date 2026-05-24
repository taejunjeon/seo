# 더클린커피 Meta InitiateCheckout 운영 게시 결과

작성 시각: 2026-05-24 16:47 KST
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
    source: GTM API publish response + GTM API read-only postcheck
    window: 2026-05-24 16:37~16:47 KST
    freshness: same-turn
    confidence: 0.93
```

## 10초 요약

더클린커피 일반 주문서 `/shop_payment/`에서 빠져 있던 Meta `InitiateCheckout`을 GTM 운영 태그로 추가했다. 기존 GA4 `begin_checkout`, 정기구독 `/subscription/`의 기존 Meta 이벤트, 구매완료 `Purchase` guard는 건드리지 않았다. 게시 결과 live version은 `21`에서 `23`으로 올라갔고, post-publish read-only에서 목표 tag/trigger가 각각 1건만 확인됐다. version `23`에는 정기구독 checkout 중복 방지 guard가 포함된다.

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
- final live version after: `23` / `Coffee Meta InitiateCheckout shop_payment subscription guard - 20260524T074633Z`
- first workspace: id `31` / `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T073809Z`
- guard workspace: id `32` / `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T074633Z`
- workspace after publish: `false`
- tag: id `99` / `AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment`
- trigger: id `98` / `AGENTSOS - [DOM Ready] shop_payment order only`
- quick preview compiler error: `false`
- live target tag count: `1`
- live target trigger count: `1`
- live 구성 수 after publish: tags `34` / triggers `25` / variables `13`
- workspace after publish: Default Workspace 1개만 남음
- final guard: `subscription_checkout_excluded` 확인됨

## 운영 태그 동작

태그는 아래 조건을 모두 만족해야 Meta browser `InitiateCheckout`을 보낸다.

1. path가 `/shop_payment` 또는 `/shop_payment/`다.
2. query 또는 checkout context에 `order_code`, `order_no`, `checkoutId` 중 하나가 있다.
3. 주문서 본문이 정기구독 checkout이 아니다.
4. 주문 요약의 `총 주문금액` 또는 fallback selector에서 value를 읽는다.
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
- publish script: `backend/scripts/coffee-meta-initiatecheckout-gtm-production-publish.ts`

## 남은 확인

실제 Meta Pixel Helper smoke는 아직 남아 있다. Codex는 GTM API로 live tag/trigger 존재와 guard를 확인했지만, 실제 주문서 브라우저에서 Pixel Helper에 보이는지 확인하려면 주문서 화면 진입이 필요하다.

확인 기준:

1. `/shop_payment/`: `InitiateCheckout` 1회, value/currency 있음.
2. `/subscription/`: 기존 native `InitiateCheckout` 외 추가 중복 없음.
3. `/shop_payment_complete`: 이 태그 발화 없음.
4. `PurchaseDecisionUnknown`, `PurchaseBlocked`, `VirtualAccountIssued`, `Purchase` guard 변화 없음.
