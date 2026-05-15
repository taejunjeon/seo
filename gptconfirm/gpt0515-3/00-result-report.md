# gpt0515-3 Result Report

작성 시각: 2026-05-15 01:16 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gptconfirm/gpt0515-2/00-result-report.md
    - gptconfirm/gpt0515-2/01-api-not-found-journey-map.md
    - gptconfirm/gpt0515-2/02-bridge-value-guard.md
    - gptconfirm/gpt0515-2/03-browser-purchase-test-only-plan.md
  lane: "Incident fast-track Green read-only + approval planning"
  allowed_actions:
    - VM Cloud SQLite read-only evidence reuse
    - 운영DB read-only interpretation
    - Imweb v2 API fallback interpretation
    - footer v4.4 design proposal
    - safe_ref-only reporting
    - approval packet writing
  forbidden_actions:
    - Meta operational Purchase send
    - Meta correction/cancel send
    - Pixel full direct insertion
    - Imweb header/footer save
    - GTM publish
    - backend deploy/restart
    - 운영DB write/import
    - VM Cloud schema migration
    - campaign/budget mutate
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite attribution_ledger/npay_intent_log read-only aggregate + gpt0515-2 evidence + existing Imweb footer/source docs"
    window: "Primary artifact window: 2026-05-14 13:00 KST 이후; logged_at >= 2026-05-14T04:00:00Z"
    freshness: "2026-05-15 01:16 KST"
    site: "biocom"
    confidence: 0.88
```

## 10초 요약

판정: `SHOP_PAYMENT_PAYMENT_SUCCESS_ARTIFACT_CONFIRMED` + `FOOTER_V4_4_EVENT_SPLIT_APPROVAL_NEEDED` + `API_NOT_FOUND_FUNNEL_NO_SEND` + `VALUE_GUARD_DEPLOY_APPROVAL_NEEDED` + `BROWSER_PURCHASE_TEST_ONLY_APPROVAL_READY`.

`/shop_payment/`는 결제완료 페이지가 아니라 결제 진행 페이지다. 그런데 footer v4.3이 이 화면을 VM Cloud의 결제완료 신호(`payment_success`)로 보내면서 실제 결제완료가 아닌 후보가 쌓였다. 따라서 footer v4.4에서는 `/shop_payment/`를 `payment_page_seen`으로 내리고, 진짜 완료 URL만 `payment_success`로 보내야 한다.

## 이번에 가능해진 것

Meta 구매 이벤트가 적게 보였던 원인을 “Meta API 고장”으로 보지 않고, 결제 단계 신호 설계 문제로 좁혔다. VM Cloud 현재 pending row는 결제완료 정본이 아니라 결제 페이지 도달 후보로 봐야 하며, 이 row들은 Meta Purchase 전송 후보가 아니다.

이 구분이 중요하다. 결제 페이지에 도달한 사람을 구매자로 보내면 Meta ROAS가 과대 계산되고, 광고 학습이 실제 구매자가 아니라 결제 페이지까지 간 사람에게 맞춰질 수 있다.

## 실제 확인된 숫자

- VM Cloud 현재 pending aggregate: 69건.
- 69/69: `source=biocom_imweb`, `touchpoint=payment_success`, `request_path=/api/attribution/payment-success`.
- 69/69: landing URL pattern이 `/shop_payment/`.
- 69/69: footer v4.3 `snippetVersion=2026-05-14-biocom-payment-success-click-id-v4-3`.
- 69/69: fbp present.
- 27/69: fbc present.
- 22/69: fbclid present.
- 13/69: GA4 client/session/user key present.
- 0/69: payment_key, transaction_id, order_member, value present.
- NPay intent same-window 48건은 있었지만, current pending row와 client/session/fbp/fbc 기준 join 0건.

Source: VM Cloud SQLite read-only aggregate. Window: 2026-05-14 13:00 KST 이후 중심, `logged_at >= 2026-05-14T04:00:00Z`. Freshness: 2026-05-15 01:16 KST. Confidence: 0.88.

## API not found 48건 결론

API not found 48건은 `payment_page_artifact_only`로 분류한다. 48/48건 모두 현재 보고 기준으로 no-send다.

이 row들은 order key는 있지만 결제완료를 증명하는 `payment_key`, `transaction_id`, `value`, 운영DB `PAYMENT_COMPLETE`, Imweb confirmed status가 닫히지 않았다. 따라서 “결제 완료 주문”이 아니라 “결제 페이지에 도달했고 footer가 결제완료 후보처럼 보낸 기록”이다.

## 현재 VM Cloud에 부족한 필드

지금 VM Cloud row만으로는 결제 페이지에서 어떤 일이 일어났는지 충분히 알 수 없다.

- payment method: 없음.
- NPay button seen/clicked flag: 해당 pending row와 join 0.
- scroll depth: 없음.
- dwell time / visible seconds: 없음.
- member/guest flag: 없음.
- payment_key / transaction_id / value: 없음.
- 완료 URL 여부: 지금은 `/shop_payment/`와 완료 URL이 같은 `payment_success` 후보로 섞인다.

이 필드는 footer v4.4와 backend contract에서 분리 수집해야 한다.

## 승인 필요한 항목

1. footer v4.4 event split 적용 승인안: `/shop_payment/`를 `payment_page_seen`으로 내리고, 완료 URL만 `payment_success`로 보낸다.
2. value guard patch/deploy 승인안: Meta Purchase 전송 전 금액 정본과 후보 금액이 다르면 no-send한다.
3. payment_page_seen data contract 승인안: 결제수단 선택, NPay 버튼, 스크롤, 체류시간 같은 진단 필드를 수집한다.
4. Browser Purchase test-only 실행 승인안: 운영 구매 count 증가 없이 browser/server dedup을 테스트한다.
5. confirmed bridge backfill Red 승인안: 실제 결제완료로 닫힌 후보만 Meta에 보낸다.

## 금지선 준수

- Meta 운영 Purchase send: 0.
- Meta correction/cancel send: 0.
- Pixel 전체 직접 삽입: 0.
- Imweb header/footer 저장: 0.
- GTM publish: 0.
- backend deploy/restart: 0.
- 운영DB write/import: 0.
- VM Cloud schema migration: 0.
- campaign/budget mutate: 0.
- raw identifier report/chat/telegram/git output: 0.

## Telegram

raw id 없는 5줄 요약 발송 완료.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0515-3/01-footer-v4-4-event-split-plan.md`
   봐야 하는 이유: TJ님이 아임웹 footer에 실제로 어떤 기준을 넣어야 하는지 가장 직접적으로 적었다.
2. `gptconfirm/gpt0515-3/02-api-not-found-funnel-journey.md`
   봐야 하는 이유: API not found 48건이 왜 Meta send 후보가 아닌지 safe_ref 기준으로 분해했다.
3. `gptconfirm/gpt0515-3/03-value-guard-and-backfill-candidates.md`
   봐야 하는 이유: 앞으로 Meta Purchase를 보낼 때 금액 오염을 막는 필수 guard다.

## 다음 할일

### Codex가 할 일

1. footer v4.4 코드 초안을 작성한다.
- Codex 추천: 진행 추천.
- 추천 방향에 대한 자신감: 94%.
- Lane: Green 초안 작성, Yellow 적용 승인 필요.
- 무엇을 하는가: 결제 페이지 도달 신호와 결제완료 신호를 분리한 footer v4.4 코드를 안전하게 작성한다.
- 왜 하는가: `/shop_payment/` artifact가 다시 `payment_success`로 쌓이지 않게 하기 위해서다.
- 어떻게 하는가: `01-footer-v4-4-event-split-plan.md`의 route guard를 코드화하고, 실제 아임웹 저장은 하지 않는다.
- 성공 기준: `/shop_payment/`는 `payment_page_seen`, 완료 URL만 `payment_success`가 되는 코드 초안이 나온다.
- 실패 시 해석/대응: 아임웹 URL 패턴이 더 있으면 completion allowlist를 넓힌다.
- 승인 필요: 코드 초안은 NO, 아임웹 적용은 YES.
- 의존성: 독립 실행 가능.

2. value guard local patch와 fixture를 만든다.
- Codex 추천: 진행 추천.
- 추천 방향에 대한 자신감: 92%.
- Lane: Green local patch, Yellow deploy 승인 필요.
- 무엇을 하는가: Meta Purchase 전송 전 금액 정본, 취소, 0원, 중복 event id를 막는 gate를 만든다.
- 왜 하는가: 실제 구매가 맞아도 금액이 틀리면 Meta ROAS를 오염시키기 때문이다.
- 어떻게 하는가: 운영DB order total 우선, 없으면 Imweb confirmed order total, 후보 금액 불일치 no-send fixture를 만든다.
- 성공 기준: value mismatch, FREE/0원, canceled/refunded, duplicate event id가 모두 no-send 처리된다.
- 실패 시 해석/대응: source total을 못 닫으면 backfill 후보가 아니라 hold로 남긴다.
- 승인 필요: 로컬 구현은 NO, VM Cloud 배포는 YES.
- 의존성: footer v4.4와 독립 병렬 가능.

### TJ님이 할 일

1. footer v4.4 아임웹 적용 여부를 승인한다.
- Codex 추천: 조건부 진행 추천.
- 추천 방향에 대한 자신감: 90%.
- Lane: Yellow.
- 무엇을 하는가: 아임웹 footer 저장 전에 `payment_page_seen`/`payment_success` 분리 기준을 승인한다.
- 왜 하는가: 현재 `/shop_payment/` artifact가 계속 쌓이면 Meta Purchase 후보 원장이 더러워진다.
- 어떻게 하는가: Codex가 만든 v4.4 초안과 `01-footer-v4-4-event-split-plan.md`를 보고, 아임웹 Header/Footer 코드 변경 승인을 준다.
- 어디에서 확인하나: 아임웹 관리자 커스텀 코드 화면과 Meta Events Manager Test Events.
- 성공 기준: `/shop_payment/`에서는 결제완료 후보가 생기지 않고, 완료 URL에서만 결제완료 후보가 생긴다.
- 실패 시 다음 확인점: 완료 URL 패턴 누락, redirect가 query를 제거하는지, 기존 FBE 이벤트와 중복되는지 확인한다.
- Codex가 대신 못 하는 이유: 실제 아임웹 운영 코드 저장은 사이트 전체 tracking에 영향이 있어 TJ님 승인/실행 범위다.
- 승인 필요: YES.
- 의존성: Codex v4.4 초안 선행 필요.
