작성 시각: 2026-05-15 03:01 KST

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
    - gptconfirm/gpt0515-5/00-result-report.md
  lane:
    browser_network_audit: Green
    backend_local_patch: Green
    vm_cloud_deploy: Yellow approval required
    meta_purchase_send: Red approval required
  allowed_actions:
    - live HTML read-only check
    - VM Cloud attribution ledger read-only aggregate
    - local backend patch
    - local tests/typecheck
    - approval packet writing
  forbidden_actions:
    - Meta 운영 Purchase send
    - Imweb code save
    - GTM publish
    - VM Cloud deploy/restart without approval
    - 운영DB write/import
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: "TJ님 브라우저 Network 증거 + biocom.kr live HTML + VM Cloud attribution_ledger + 로컬 backend test"
    window: "2026-05-15 02:00-03:01 KST 중심"
    freshness: "2026-05-15 03:01 KST"
    confidence: "0.92"
```

## 10초 요약

브라우저 Pixel은 `PageView`를 Meta로 실제 전송하고 있고, `facebook.com/tr` 응답도 200이다. 따라서 Meta 이벤트 테스트 창에 안 보이는 문제는 Pixel 전체 장애가 아니라 Meta Test Events UI 표시/세션 매칭 문제로 보는 것이 맞다.

서버 쪽은 로컬 패치를 완료했다. 이제 결제 진행 페이지(`/shop_payment/`)는 별도 `payment_page_seen` 신호로 저장할 수 있고, 누군가 실수로 `/payment-success`에 보내도 서버가 구매완료로 보지 않도록 낮춘다. Meta Purchase 후보는 실제 결제완료와 value guard를 통과해야만 남는다.

## 이번에 가능해진 것

- 결제 진행 페이지와 결제완료를 서버 코드에서 분리했다.
- 결제 진행 페이지 신호는 Meta Purchase 후보가 될 수 없게 했다.
- `/payment-success`에 잘못 들어온 `/shop_payment/` 신호는 서버가 `payment_page_seen`으로 downgrade한다.
- Meta CAPI 자동 후보는 0원, 환불/취소, value guard 미통과, 결제 진행 페이지를 제외하도록 보강했다.

## 실제 확인된 결과

- 외부 브라우저: `facebook.com/tr?id=1283400029487161&ev=PageView...` 요청 `200 OK`.
- live HTML: Pixel ID `1283400029487161`, `fbq('track','PageView')`, Funnel wrapper, Footer v4.4.2 확인.
- live HTML: `FUNNEL_CAPI_CONFIG.enableServerCapi=false`. 서버 mirror는 꺼져 있고, 브라우저 Pixel은 별도로 동작한다.
- VM Cloud attribution ledger: Footer v4.4.2 row 14건 중 `payment_page_seen` semantic 12건, `payment_success` semantic 2건.
- VM Cloud attribution ledger: Footer v4.4.2 `payment_page_seen` 12건은 `/api/attribution/checkout-context`로 들어왔고, purchase candidate true는 0건.
- VM Cloud attribution ledger: Footer v4.4.2 `payment_success` 2건은 completion URL 계열이며 purchase candidate true는 0건.
- VM Cloud attribution ledger: `payment_page_seen` 12건 중 scroll/dwell metric 12건, selected payment method 9건, fbp 14건, fbc 7건, fbclid 7건.

## 판정

- `A. BROWSER_PIXEL_FUNNEL_FIRING_TEST_UI_BLIND`: PageView는 Network 200으로 확인. ViewContent/AddToCart/InitiateCheckout은 Meta UI 집계상 활성이나 Network row-level은 TJ님 브라우저 추가 캡처가 필요하다.
- `C. ADD_PAYMENT_INFO_NOT_FIRING`: 현재 Meta UI와 live code 관찰 기준으로 AddPaymentInfo는 별도 실시간 firing 근거가 부족하다.
- `E. PURCHASE_GUARD_WORKING_FOR_UNPAID`: `/shop_payment/` artifact가 v4.4.2 이후 Purchase 후보에서 빠지는 방향은 확인됐다.
- `BACKEND_GUARD_LOCAL_PATCH_PASS`: 로컬 typecheck/test 통과.

## 변경 파일

- `backend/src/attribution.ts`
- `backend/src/attributionLedgerDb.ts`
- `backend/src/routes/attribution.ts`
- `backend/src/siteLandingFanout.ts`
- `backend/src/metaCapi.ts`
- `backend/tests/attribution.test.ts`

## 검증

- `cd backend && npm run typecheck` PASS
- `cd backend && node --test --import tsx tests/attribution.test.ts` PASS, 40/40
- `python3 -m json.tool gptconfirm/gpt0515-6/manifest.json` PASS
- `python3 scripts/validate_wiki_links.py gptconfirm/gpt0515-6/*.md` PASS
- `python3 scripts/harness-preflight-check.py --strict` PASS
- `git diff --check` PASS
- raw identifier scan PASS. 문서에서 탐지된 긴 숫자는 Pixel ID `1283400029487161`뿐이고, raw order/payment/click/member/email/phone 값은 출력하지 않았다.
- Meta/Google/TikTok/Naver send 0
- 운영DB write/import 0
- VM Cloud deploy/restart 0
- GTM publish 0
- Imweb code save 0
- raw identifier report output 0

## 아직 안 된 것

- VM Cloud backend 배포는 하지 않았다. 배포는 Yellow 승인 필요.
- Meta Purchase 운영 전송은 하지 않았다. 전송은 Red 승인 필요.
- AddToCart/InitiateCheckout/AddPaymentInfo의 row-level Network 캡처는 TJ님 브라우저에서 추가 확인이 필요하다. Codex headless Playwright는 Meta browser event가 관찰되지 않아 판단 source로 쓰지 않았다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0515-6/01-browser-network-audit.md` — Meta Test Events가 안 보이는 이유와 browser/server 분리 판단.
2. `gptconfirm/gpt0515-6/02-backend-guard-and-value-guard.md` — 서버 패치가 무엇을 막는지.
3. `gptconfirm/gpt0515-6/03-next-actions-and-approval.md` — VM Cloud 배포 승인안과 Red send 금지선.
