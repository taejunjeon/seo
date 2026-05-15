# gpt0515-2 Result Report

작성 시각: 2026-05-15 00:55 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Incident fast-track read-only + approval planning
  allowed_actions:
    - VM Cloud SQLite read-only journey aggregate
    - 운영DB read-only bridge interpretation
    - Imweb v2 API read-only fallback interpretation
    - Meta Test Events result reuse
    - safe_ref-only report
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
    source: "VM Cloud SQLite attribution_ledger/imweb_orders + 운영DB bridge dry-run evidence + Imweb v2 API fallback evidence + Meta CAPI test-only result"
    window: "VM Cloud logged_at >= 2026-05-14T04:00:00.000Z; Meta smoke 2026-05-15 00:22 KST"
    freshness: "2026-05-15 00:55 KST"
    confidence: 0.82
```

## 10초 요약

판정: `A. API_NOT_FOUND_CLASSIFIED_FAST_TRACK_READY` + `B. NEED_ADMIN_UI_LOOKUP_FOR_REMAINDER` + `D. BROWSER_PURCHASE_TEST_PATH_READY` + `E. VALUE_GUARD_DEPLOY_APPROVAL_NEEDED`.

API not found 48건은 대부분 결제완료 주문이 아니라, 아임웹 footer v4.3이 `/shop_payment/` 화면에서 VM Cloud `payment_success` endpoint로 보낸 checkout/payment page artifact로 분류했다. Meta server CAPI는 test-only Purchase 1건을 받았으므로 서버 통로 자체 장애는 아니다. 남은 핵심은 브라우저 Purchase test-only/dedup 확인과 value guard 보강이다.

## 실제 숫자

- Meta server CAPI test-only Purchase: 1건, HTTP 200, `events_received=1`, 운영 Purchase 즉시 증가 0.
- VM Cloud current pending aggregate: 66건, 모두 `source=biocom_imweb`, `touchpoint=payment_success`, `capture_mode=live`.
- 시작 경로: 66건 모두 footer v4.3 `payment_success` endpoint.
- request path: 66건 모두 `/api/attribution/payment-success`.
- landing pattern: 66건 모두 `/shop_payment/`.
- order key: 66건 모두 order_code/order_no/order_id present.
- payment key/value/transaction_id/order_member: 0건.
- GTM hint: 0건.
- FBE/browser pixel-only origin: 0건. 단 `fbp`는 66건 모두 존재해 Meta browser cookie evidence는 있음.
- same order key repeat: 0건.
- same session repeated: 3개 session group / 10 row.

## API not found journey 분류

API not found 48건의 현재 주 분류는 `D. checkout_or_payment_page_artifact`다.

이 row들은 결제완료 정본이 아니라 “결제 흐름 페이지에서 footer code가 만든 후보”다. order_code/order_no는 있지만 payment_key, transaction_id, amount value가 없고, 운영DB `PAYMENT_COMPLETE`, Imweb direct/status list, VM Cloud fresh status 중 하나도 닫히지 않아 Meta send 후보가 아니다.

최소 70% 조건은 충족했다. 48/48건을 no-send artifact로 분류했고, 추가로 status-list/API 오류 때문에 최신 증가분은 관리자 UI 또는 status sync 재조회가 필요하다.

## 5건 bridge 후보 상태

2026-05-14 22:30 KST direct lookup evidence에서는 Imweb confirmed candidate 5건 / 1,555,621원이 있었다. 이후 gpt0515-1 endpoint snapshot에서는 5건 / 1,566,621원으로 보였고, 최신 재조회에서는 status-list 오류 때문에 confirmed count가 0으로 흔들렸다.

따라서 5건은 `ready_for_backfill`이 아니라 `value_guard_blocked / source_freshness_gap`이다. 지금 바로 Meta backfill 승인 대상으로 올리지 않는다.

## Browser Purchase test 가능성

Browser Purchase test는 설계는 가능하지만, 운영 사이트에서 바로 발화하면 안 된다.

정답은 Meta Test Events 전용 preview-only 경로에서 browser `eventID`와 server `event_id`를 같은 값으로 묶고, 운영 Purchase count delta 0을 pre/post로 확인하는 것이다. test-only 보장이 없으면 browser Purchase는 계속 실행 금지다.

## 승인 필요한 항목

1. Value guard patch/deploy approval: wrong value 재발 방지를 위해 필요하다.
2. Browser Purchase controlled test approval: 운영 count 증가 0 조건이 닫힌 뒤 필요하다.
3. 추가 Meta backfill send: bridge/value/duplicate guard PASS 후 별도 Red 승인 필요다.

## 금지선 준수

- Meta 운영 Purchase send: 0
- Meta correction/cancel send: 0
- Pixel 전체 직접 삽입: 0
- Imweb header/footer 저장: 0
- GTM publish: 0
- backend deploy/restart: 0
- 운영DB write/import: 0
- VM Cloud schema migration: 0
- campaign/budget 변경: 0
- raw id report/chat/telegram/git output: 0

## Telegram

작업 종료 시 raw id 없는 5줄 요약 전송 완료.
