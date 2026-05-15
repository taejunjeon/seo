# Biocom API not found raw-key drilldown - 2026-05-15

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
    - capivm/biocom-imweb-api-status-fallback-dry-run-20260514.md
    - data/project/biocom-imweb-api-status-fallback-dry-run-20260514.json
    - data/project/biocom-imweb-api-status-fallback-dry-run-20260514-rows.json
  lane: Green read-only raw-key drilldown
  allowed_actions:
    - VM Cloud SQLite attribution_ledger read-only
    - VM Cloud SQLite imweb_orders read-only
    - 운영DB dashboard.public.tb_iamweb_users read-only
    - Imweb v2 API direct/status-list read-only
    - safe_ref-only report
  forbidden_actions:
    - VM Cloud SQLite write
    - 운영DB write/import
    - Meta/Google/GA4/TikTok/Naver send or upload
    - GTM publish
    - Imweb header/footer save
    - raw order/payment/click/member/email/phone output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite + 운영DB read-only + Imweb v2 API read-only"
    window: "logged_at >= 2026-05-14T04:00:00.000Z"
    freshness: "2026-05-15 00:32 KST"
    confidence: 0.78
```

## 10초 요약

VM Cloud에 pending으로 남은 바이오컴 결제완료 페이지 신호는 “Meta 주문”이 아니라, 아임웹 결제완료 페이지에서 들어온 payment_success 후보 전체다.

최신 read-only 재조회 기준으로 운영DB bridge 이후 남은 54건 중 Imweb v2 API가 결제 후보로 잡은 것은 5건 / 1,566,621원이고, 취소 1건 / 234,000원은 제외해야 한다. 나머지 48건은 API not found이며, 지금 상태에서는 Meta 전송 후보가 아니다.

## 현재 숫자

- source: VM Cloud SQLite `attribution_ledger`, VM Cloud SQLite `imweb_orders`, 운영DB `dashboard.public.tb_iamweb_users`, Imweb v2 API read-only.
- window: VM Cloud `source=biocom_imweb`, `touchpoint=payment_success`, `payment_status=pending`, `logged_at >= 2026-05-14T04:00:00.000Z`.
- latest dry-run target: 운영DB bridge 필터 후 54건.
- Imweb v2 API confirmed candidate: 5건 / 1,566,621원.
- Imweb v2 API canceled/refunded: 1건 / 234,000원.
- Imweb v2 API not found: 48건.
- VM Cloud `imweb_orders` cache hit: 6건, 모두 `imweb_status` blank.
- payment key present: 0건.

## 왜 pending이었는가

pending의 의미는 “미결제 확정”이 아니다.

이번 row들은 아임웹 footer/payment_success 코드가 결제완료 페이지 또는 결제 흐름 페이지에서 VM Cloud로 보낸 신호다. 하지만 footer 신호만으로는 운영DB `PAYMENT_COMPLETE`, Imweb v2 API confirmed status, fresh VM Cloud `imweb_orders` status 중 어느 것도 닫히지 않은 row가 많다.

즉 pending 이유는 결제 완료가 아니어서가 아니라, 현재 source priority에서 결제완료 정본으로 승격할 근거가 부족했기 때문이다.

## raw-key drilldown 결과

raw order number, order code, payment key, click id는 secure local/VM evidence 안에서만 transient로 사용했고, 문서에는 `safe_ref`만 남겼다.

- VM Cloud pending rows since cutoff: 65건.
- order key present: 65건.
- payment key present: 0건.
- Facebook click evidence: 21건.
- Google click evidence: 9건.
- TikTok click evidence: 0건.
- raw identifier output: 0.

분류:

- `abandoned_checkout_or_payment_page_artifact`: 48건. order key는 있지만 운영DB/Imweb/API/cache에서 결제완료 정본이 닫히지 않는다.
- `api_window_or_pagination_miss`: 4건. VM Cloud `imweb_orders` cache에는 흔적이 있으나 status가 blank라 status sync 또는 관리자 UI 확인이 필요하다.
- `real_order_canceled_or_refunded_excluded`: 13건. 요청 taxonomy에 없던 no-send 안전 bucket이다. 취소/환불/비양수/guard 제외 가능성이 있어 Meta 전송 금지다.

대표 safe_ref:

- artifact: `PENDING-LIVE-001`, `PENDING-LIVE-002`, `PENDING-LIVE-003`
- API/window gap: `PENDING-LIVE-021`, `PENDING-LIVE-023`
- canceled/refunded/excluded: `PENDING-LIVE-009`, `PENDING-LIVE-040`

## Meta 전송 판단

API not found 48건은 Meta send 후보가 아니다.

5건 Imweb v2 API confirmed candidate도 이번 문서만으로 자동 전송하지 않는다. 별도 bridge 승인안에서 운영DB/Imweb status, 금액, 취소/환불 guard, duplicate event_id를 다시 닫아야 한다.

## 금지선 준수

- VM Cloud write: 0
- 운영DB write/import: 0
- Meta 운영 send: 0
- Google Ads/GA4/TikTok/Naver send/upload: 0
- GTM publish: 0
- Imweb header/footer 저장: 0
- raw order/payment/click/member/email/phone 출력: 0

## 다음 판단

1. API not found 48건은 결제완료로 올리지 않는다.
2. Imweb v2 API confirmed 5건은 bridge 후보로만 둔다.
3. `api_window_or_pagination_miss` safe_ref는 status sync 또는 Imweb 관리자 UI에서만 추가 확인한다.
4. Meta backfill은 결제완료 정본과 금액 guard가 닫힌 row만 별도 승인 후 진행한다.
