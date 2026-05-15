# gpt0515-1 Result Report

작성 시각: 2026-05-15 00:32 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
  project_harness_read:
    - capivm/biocom-purchase-test-only-smoke-approval-20260515.md
    - capivm/biocom-imweb-api-status-fallback-dry-run-20260514.md
  lane: Mixed approved test-only smoke + Green read-only drilldown
  allowed_actions:
    - Meta Test Events Purchase send max 1 with test_event_code
    - VM Cloud read-only pending drilldown
    - 운영DB read-only cross-check
    - Imweb v2 API read-only fallback
    - safe_ref-only documentation
  forbidden_actions:
    - Meta Purchase operational send
    - browser Purchase without test-only guarantee
    - platform upload/mutate
    - 운영DB write/import
    - VM Cloud schema migration
    - GTM publish
    - Imweb header/footer save
    - raw order/payment/click/member/email/phone output
  source_window_freshness_confidence:
    source: "Meta Graph CAPI response + VM Cloud SQLite + 운영DB read-only + Imweb v2 API read-only"
    window: "Meta smoke 2026-05-15 00:22 KST; VM Cloud pending logged_at >= 2026-05-14T04:00:00.000Z"
    freshness: "2026-05-15 00:32 KST"
    confidence: 0.80
```

## 이번에 가능해진 것

Meta 구매 신호가 완전히 막힌 것이 아니라는 점을 운영 구매 수를 늘리지 않고 확인했다. 서버 CAPI test-only `Purchase` 1건은 Meta가 `events_received=1`로 받았고, 즉시 확인한 운영 `Purchase` 증가는 0이었다.

동시에 VM Cloud에 남아 있던 pending 후보가 왜 결제완료로 승격되지 않았는지도 더 좁혔다. 최신 read-only 기준 54건 중 Imweb v2 API가 결제 후보로 확인한 것은 5건 / 1,566,621원, 취소 제외는 1건 / 234,000원, API not found는 48건이다.

## 왜 중요했는가

이제 “Meta API가 끊겼다”와 “결제완료 정본으로 승격되지 않았다”를 분리해서 볼 수 있다.

서버 CAPI는 test-only 경로에서 동작한다. 하지만 아임웹 footer의 payment_success 신호만으로는 실제 결제완료라고 확정할 수 없다. 그래서 pending 전체를 Meta 구매로 보내면 안 되고, 운영DB `PAYMENT_COMPLETE` 또는 Imweb v2 API confirmed status가 닫힌 row만 bridge 후보로 다뤄야 한다.

## 실제 확인된 결과

- Meta test-only smoke: server CAPI `Purchase` 1건 전송, HTTP 200, `events_received=1`.
- 운영 Meta `Purchase` 즉시 증가: 0.
- 브라우저 `Purchase`: test-only 보장이 없어서 실행하지 않음.
- VM Cloud pending latest dry-run: 운영DB bridge 필터 후 54건.
- Imweb v2 API confirmed candidate: 5건 / 1,566,621원.
- Imweb v2 API canceled/refunded: 1건 / 234,000원.
- API not found: 48건.
- raw id 출력: 0.
- Telegram 5줄 요약: 전송 완료, raw id 0.

## 아직 안 된 것

브라우저 `Purchase`와 서버 `Purchase`의 같은 `event_id` 중복 제거는 아직 확인하지 않았다. 브라우저 발화가 Meta Test Events에만 잡힌다는 보장이 없기 때문이다.

API not found 48건은 결제완료가 아니라고 확정한 것이 아니다. 현재 source priority에서 운영DB/Imweb/API/cache 중 결제완료 정본이 닫히지 않았다는 뜻이다.

## 하지 않은 것

- Meta 운영 Purchase send: 0
- Meta campaign/ad set/budget 변경: 0
- Google Ads/GA4/TikTok/Naver send/upload: 0
- 운영DB write/import: 0
- VM Cloud schema migration: 0
- GTM publish: 0
- Imweb header/footer 저장: 0
- raw order/payment/click/member/email/phone 출력: 0

## 확인하면 좋은 문서

1. [[01-meta-purchase-test-only-smoke]] — Meta가 구매 테스트 신호를 받았는지와 운영 구매 수가 늘지 않았는지 확인하는 문서다.
2. [[02-api-not-found-drilldown]] — pending 후보가 왜 자동 전송 대상이 아닌지, 어떤 row만 bridge 후보인지 보는 문서다.
3. [[03-next-actions]] — 다음에 무엇을 승인하거나 자동 진행해야 하는지 보는 문서다.

## 다음 할일

### Codex가 할 일

1. bridge 후보 5건을 다시 확인한다.
- Codex 추천: 진행 추천
- 추천 방향에 대한 자신감: 88%
- Lane: Green dry-run, 이후 send는 Red
- 무엇을 하는가: Imweb v2 API confirmed 5건을 운영DB/VM Cloud/cache/duplicate event_id 기준으로 다시 대조한다.
- 왜 하는가: 결제완료 정본과 금액 guard가 닫힌 row만 Meta backfill 후보가 될 수 있기 때문이다.
- 어떻게 하는가: VM Cloud dry-run endpoint와 운영DB read-only, Imweb v2 status를 safe_ref 기준으로 다시 join한다.
- 성공 기준: confirmed 후보 count/amount, excluded reason, duplicate risk가 raw id 없이 닫힌다.
- 승인 필요: dry-run은 NO, Meta send는 YES Red.

2. 브라우저 Purchase test-only 경로를 설계한다.
- Codex 추천: 조건부 진행
- 추천 방향에 대한 자신감: 72%
- Lane: Green approval packet
- 무엇을 하는가: 운영 집계 증가 없이 browser `Purchase`를 Meta Test Events에만 보낼 수 있는지 설계한다.
- 왜 하는가: browser/server dedup을 확인해야 Pixel 직접 삽입 여부를 판단할 수 있기 때문이다.
- 어떻게 하는가: 아임웹 운영 저장 없이 preview/test-only 코드 경로 또는 Meta Test Events 전용 page route를 문서화한다.
- 성공 기준: 운영 `Purchase` count delta 0이 보장되는 테스트 방법이 생긴다.
- 승인 필요: 문서화는 NO, 실제 browser 발화는 YES.

### TJ님이 할 일

1. Meta Events Manager Test Events 화면을 한 번 확인한다.
- Codex 추천: 확인 추천
- 추천 방향에 대한 자신감: 70%
- Lane: 권한/UI 확인
- 무엇을 하는가: Pixel `1283400029487161`의 Test Events 탭에서 `Purchase` test event가 보이는지 확인한다.
- 왜 하는가: Codex는 API 응답으로 수신은 확인했지만, Meta UI 표시 여부는 TJ님 로그인 화면이 최종 확인점이기 때문이다.
- 어떻게 하는가: Meta Events Manager > 바이오컴 Pixel > 이벤트 테스트 탭에서 최근 `Purchase` test event를 본다.
- 성공 기준: test event가 보이고 운영 이벤트 개요 구매 수는 증가하지 않는다.
- Codex가 대신 못 하는 이유: Meta UI 로그인/권한 화면은 현재 Codex가 직접 볼 수 없다.
- 승인 필요: NO, 확인만.
