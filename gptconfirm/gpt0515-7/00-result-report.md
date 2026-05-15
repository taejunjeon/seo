# gpt0515-7 Meta Funnel Recovery Fast-Track

작성 시각: 2026-05-15 03:31 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - docs/report/text-report-template.md
  required_context_docs:
    - gptconfirm/gpt0515-6/00-result-report.md
    - gptconfirm/gpt0515-6/02-backend-guard-and-value-guard.md
  lane:
    analysis_and_packet: Green
    block4_code_draft: Green
    vm_cloud_backend_deploy: Yellow approval required
    imweb_footer_save: Yellow approval required
    meta_operational_purchase_send: Red approval required
  allowed_actions:
    - live HTML read-only
    - local deploy packet writing
    - fallback-only code draft
    - no-send/no-write documentation
  forbidden_actions:
    - Meta 운영 Purchase send
    - Purchase browser fallback in Block 4
    - 전체 Pixel 직접 삽입 운영 적용
    - Imweb header/footer save without TJ approval
    - GTM publish
    - VM Cloud backend deploy/restart without TJ approval
    - 운영DB write/import
    - VM Cloud schema migration
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: "TJ님 Network 증거 + biocom.kr live HTML + VM Cloud attribution_ledger read-only from gpt0515-6 + local backend patch state"
    window: "2026-05-15 02:00-03:31 KST"
    freshness: "2026-05-15 03:31 KST"
    site: "biocom"
    confidence: 0.86
```

## 10초 요약

판정: `A. BACKEND_GUARD_READY_FOR_YELLOW_DEPLOY` + `B. FALLBACK_BLOCK4_READY` + `C. C_PLAN_30MIN_EXPERIMENT_OPTIONAL` + `D. BROWSER_PURCHASE_TEST_ONLY_STILL_NEEDED`.

Purchase가 안 보이는 이유는 “우리가 모든 Purchase를 꺼서”가 아니다. 현재 live Header의 Purchase Guard는 완료 URL에서만 `Purchase` 시도를 가로채고, VM Cloud `payment-decision`이 `allow_purchase`라고 답할 때만 원래 Purchase를 통과시킨다. 그래서 미입금/unknown에서는 의도적으로 막는 것이 맞지만, 결제완료 매칭이 늦거나 endpoint가 unknown을 주면 실제 결제완료 Purchase도 `PurchaseDecisionUnknown`으로 내려갈 수 있다.

가장 빠른 복구안은 전체 Pixel 재삽입이 아니라 두 단계다.

1. VM Cloud backend guard/value guard를 배포해 `/shop_payment/` artifact를 서버에서 확실히 막는다.
2. Purchase는 전체 fail-open이 아니라 “완료 URL + 결제확정 판정”만 통과시키고, AddToCart/InitiateCheckout/AddPaymentInfo는 fallback-only Block 4로 살린다.

## 이번에 정리한 것

- VM Cloud backend guard 배포 승인안을 만들었다.
- AddToCart/InitiateCheckout/AddPaymentInfo fallback-only Block 4 초안을 작성했다.
- 전체 Pixel 직접 삽입 C안은 보류/2순위로 정리했다.
- Browser Purchase test-only는 preview-only로만 유지했다.
- Purchase 빠른 복구는 `payment-decision allow_purchase` 경로를 먼저 안정화하는 안으로 제안했다.

## Purchase 발화가 막히는 구조

live HTML 기준:

- Header Purchase Guard: `2026-04-12-server-payment-decision-guard-v3`.
- 동작 위치: completion URL 계열에서만 설치.
- 동작 방식: `FB_PIXEL.Purchase` 또는 `fbq('track','Purchase')`를 가로챈 뒤 `https://att.ainativeos.net/api/attribution/payment-decision` 조회.
- confirmed이면 `browserAction=allow_purchase`로 원래 Purchase 통과.
- pending이면 `VirtualAccountIssued`로 낮춤.
- unknown/canceled이면 Purchase를 보내지 않음.
- endpoint가 allow 후에도 Network에 Purchase가 없으면 image fallback으로 한 번 보강하는 코드가 이미 있다.

해석: Purchase 복구의 병목은 “browser fallback 코드가 전혀 없어서”라기보다 `payment-decision`이 실제 결제완료 주문을 빠르게 `allow_purchase`로 닫지 못하는 구간이다.

## 빠른 복구 제안

1순위는 VM Cloud backend 배포다. 현재 로컬 패치가 `/shop_payment/` 오염을 막고 value guard를 추가하므로, 이 배포가 되어야 Purchase를 좁게 열어도 매출 오염 리스크가 낮아진다.

2순위는 결제완료 URL에서 `payment-decision`이 confirmed를 더 빨리 반환하게 하는 것이다. source priority는 운영DB `PAYMENT_COMPLETE`, Imweb v2 direct confirmed, fresh VM Cloud cache 순서다. endpoint가 confirmed를 반환하면 기존 Purchase Guard가 Purchase를 통과시킨다.

3순위는 아주 좁은 fail-open이다. 단, 조건은 completion URL, order key present, value present, non-virtual-account evidence, `/shop_payment/` 아님, eventID dedupe, value guard marker가 있어야 한다. 이 안은 빠르지만 오탐 리스크가 있어 별도 승인 전 적용하지 않는다.

## 하지 않은 것

- VM Cloud deploy/restart 안 함.
- Imweb footer/header 저장 안 함.
- Meta 운영 Purchase send 안 함.
- Browser Purchase fallback 운영 적용 안 함.
- 전체 Pixel 직접 삽입 안 함.
- 운영DB write/import 안 함.
- GTM publish 안 함.

## 검증

- `python3 -m json.tool gptconfirm/gpt0515-7/manifest.json` PASS.
- `python3 -m json.tool data/current-state.json` PASS.
- `python3 scripts/validate_wiki_links.py gptconfirm/gpt0515-7/*.md gdn/current-handoff.md` PASS.
- `python3 scripts/harness-preflight-check.py --strict` PASS.
- `git diff --check` PASS.
- raw identifier scan PASS. 탐지된 긴 숫자는 Pixel ID `1283400029487161`뿐이고, raw order/payment/click/member/email/phone 값은 문서에 출력하지 않았다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0515-7/01-backend-guard-deploy-packet.md` — VM Cloud backend 배포 승인 판단용.
2. `gptconfirm/gpt0515-7/02-meta-browser-fallback-block4-code.md` — AddToCart/InitiateCheckout/AddPaymentInfo fallback-only 적용 초안.
3. `gptconfirm/gpt0515-7/04-browser-purchase-test-only.md` — Purchase를 빠르게 살리는 안전한 순서.
