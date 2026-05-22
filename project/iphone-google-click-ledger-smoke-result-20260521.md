# iPhone Google click ledger smoke result

작성 시각: 2026-05-21 22:00 KST
기준일: 2026-05-21
문서 성격: 아이폰 Chrome Google 광고 클릭 → 주문서 → 가상계좌 미입금 완료 원장 확인 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_context_docs:
    - imweb/!coderule.md
    - project/imweb-footer-full-v445-block4-value-retry-20260521.md
  lane: Green
  allowed_actions:
    - vm_cloud_read_only_query
    - sanitized_result_documentation
  forbidden_actions:
    - production_db_write
    - vm_cloud_write
    - imweb_save
    - gtm_publish
    - platform_conversion_send
  source_window_freshness_confidence:
    source: VM Cloud SQLite /home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 + payment-decision read-only endpoint
    window: 2026-05-21 21:46:27-21:47:32 KST observed flow
    freshness: checked 2026-05-21 21:57-21:58 KST
    confidence: 0.97
```

## 10초 요약

아이폰 Chrome에서 Google 광고를 클릭한 뒤 주문서 진입과 가상계좌 미입금 완료까지 진행한 흐름은 VM Cloud 원장에 잘 남았다.

랜딩 원장, paid click intent 원장, attribution 원장 모두 Google click evidence를 보존했다. 완료 단계는 `payment_success`로 기록됐지만 결제 상태는 `pending`이고, payment-decision은 Browser `Purchase`를 차단하는 판단을 반환했다.

## 입력 요약

- 기기/브라우저: iPhone Chrome
- 검색어: 영양중금속검사
- 클릭 시각: 2026-05-21 21:47 KST
- Google campaign id: `21808018766`
- 상품 경로: `/mineraltest_store/`
- 주문번호: `2026…7642` 형태로 마스킹
- 결제 상태: 가상계좌 주문생성, 미입금

Raw `gclid`, `gbraid`, 주문 코드, 결제 코드는 문서에 남기지 않는다.

## 확인 결과

### site_landing_ledger

정확히 같은 Google click URL이 랜딩 원장에 남았다.

- observed at: 2026-05-21 21:47:15 KST
- landing_path: `/mineraltest_store/`
- utm_campaign: `googleads_testPM_mineral_url`
- click_id_type: `gclid`
- click_id_storage_mode: `hash`
- channel_classified: `paid_search`
- source_breakdown: `google.com`
- exact gclid match: yes
- exact gbraid match: yes
- gad_campaignid `21808018766`: yes
- duplicate_count: 0

### paid_click_intent_ledger

같은 클릭 evidence가 paid click intent 원장에도 남았다.

확인된 단계:

- `landing`
- `checkout_start`
- `npay_intent`

주요 값:

- platform_hint: `google_ads`
- click_id_type: `gclid`
- exact click id match: yes
- gad_campaignid `21808018766`: yes
- status: `received`
- reject_reason: empty

### attribution_ledger

주문서와 완료 단계가 attribution 원장에 연결됐다.

확인된 touchpoint:

- `checkout_started`
- `payment_page_seen`
- `payment_success`

`payment_success` row 상태:

- payment_status: `pending`
- source: `biocom_imweb`
- top-level gclid present: yes
- metadata mentions gbraid/google click: yes
- order/payment identifiers matched: yes, raw value not documented

### payment-decision

read-only payment-decision endpoint 결과:

- status: `pending`
- browserAction: `block_purchase_virtual_account`
- confidence: `high`
- matchedBy: `ledger_order_id`
- reason: `fast_ledger_pending_status`

즉 미입금 가상계좌 주문은 Browser `Purchase`로 세지 않고, `VirtualAccountIssued` 계열로 낮추는 판단이 정상이다.

## 해석

이번 모바일 테스트는 성공이다.

의미는 세 가지다.

1. iPhone Chrome Google 광고 클릭도 VM Cloud 랜딩 원장에 남는다.
2. `gclid`와 `gbraid`가 함께 있는 URL에서 현재 시스템은 `gclid`를 primary click id로 잡고, `gbraid` evidence도 metadata에 보존한다.
3. 주문서와 미입금 완료까지 Google click evidence가 이어진다. 단, 미입금 완료는 구매 매출이 아니므로 `Purchase`가 아니라 pending/block 판단이 맞다.

## 남은 확인점

- 실제 결제완료 카드/간편결제 케이스에서 confirmed일 때만 `Purchase`가 허용되는지 별도 smoke가 필요하다.
- `order_bridge_ledger`는 이번 실시간 흐름에는 최신 row가 없었다. 현재 판단에는 `site_landing_ledger`, `paid_click_intent_ledger`, `attribution_ledger`, `payment-decision`을 primary로 본다.

## Auditor verdict

PASS.

이번 아이폰 Chrome Google 광고 클릭은 랜딩, paid click intent, 주문서, 가상계좌 미입금 완료 판단까지 이어졌다. Raw click id와 주문 식별자는 문서에 남기지 않았다.
