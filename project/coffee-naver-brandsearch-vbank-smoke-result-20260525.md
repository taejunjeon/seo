# 더클린커피 네이버 브랜드검색 가상계좌 smoke 결과

작성 시각: 2026-05-25 06:26 KST  
기준일: 2026-05-25  
문서 성격: read-only smoke 결과 / Attribution evidence 확인  
Site: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - data/!data_inventory.md
    - project/!traffic-attribution-current-state-guide-20260521.md
  lane: Green
  allowed_actions:
    - browser_console_observation
    - VM_Cloud_public_API_read_only
    - local_SQLite_read_only_freshness_check
    - documentation
  forbidden_actions:
    - GA4_Meta_Google_Naver_platform_send
    - GTM_publish
    - Imweb_code_edit
    - VM_Cloud_deploy_or_restart
    - operational_DB_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      primary: VM Cloud attribution_ledger API
      browser_cross_check: TJ님 Chrome console storage observation
      fallback_rejected: local SQLite stale copy
    window: 2026-05-25 06:15-06:30 KST
    freshness: same-session / same-turn
    confidence: high for attribution_ledger and browser storage, low for local SQLite fallback
```

## 10초 요약

네이버 브랜드검색에서 더클린커피로 들어온 뒤 가상계좌 미입금 주문까지 만든 흐름은 브라우저 저장소와 VM Cloud 주문 단계 원장에 남았다.

VM Cloud 원장은 같은 15분 window에서 `checkout_started` 1건과 `payment_success` 1건을 `naver_brandsearch` 후보로 분류했다. 이 값은 네이버 예산 ROAS에 바로 넣는 구매 매출이 아니라, 주문까지 이어진 유입 evidence다.

가상계좌 주문은 `pending`으로 잡혔고, 브라우저 Purchase는 차단됐다. 다만 Pixel Helper에는 `PurchaseDecisionUnknown`으로 보였으므로, 가상계좌 미입금은 장기적으로 `VirtualAccountIssued` 같은 더 명확한 분기명으로 개선하는 것이 좋다.

## 확인한 사실

### 1. 브라우저 저장소

- 최초 랜딩 referrer: `search.naver.com`
- 최초 랜딩 URL에는 `utm_source=naver_brand_search`, `utm_medium=naver_brand_search`, `utm_content=home_pc`, `NaPm` marker가 있었다.
- 주문완료 페이지에서도 `last_touch`가 `naver_brand_search`를 유지했다.
- 주문완료 페이지에서도 `session_touch`가 네이버 브랜드검색 랜딩 경로를 유지했다.

판정: 브라우저 단계 유입 보존은 PASS.

### 2. VM Cloud 주문 단계 원장

조회 API:

```text
GET https://att.ainativeos.net/api/attribution/ledger
source=thecleancoffee_imweb
startAt=2026-05-24T21:15:00.000Z
endAt=2026-05-24T21:30:00.000Z
```

결과:

- window total entries: 3건
- `checkout_started`: 1건
- `payment_success`: 2건
- pending payment_success revenue: 67,800원
- confirmed revenue: 0원
- 이번 smoke 주문과 매칭되는 row: `checkout_started` 1건, `payment_success` 1건
- 해당 row들의 metadata에는 `naver_brand_search` evidence가 있었다.

판정: 주문 단계 attribution evidence는 PASS.

### 3. Naver evidence aggregate

조회 API:

```text
GET https://att.ainativeos.net/api/attribution/ledger/naver-evidence-aggregate
source=thecleancoffee_imweb
startAt=2026-05-24T21:15:00.000Z
endAt=2026-05-24T21:30:00.000Z
```

결과:

- rowsTotal: 3건
- naverAny: 2건
- `naver_brandsearch`: 2건
- `paid_naver`: 0건
- `organic_naver_candidate`: 0건
- 세부 row: `checkout_started` 1건, `payment_success` 1건
- aggregate contract는 raw identifier를 반환하지 않았다.

판정: 네이버 브랜드검색 후보 분류는 PASS. 예산 ROAS에는 reference only.

### 4. 가상계좌 미입금 분기

조회 API:

```text
GET https://att.ainativeos.net/api/attribution/payment-decision
site=thecleancoffee
store=thecleancoffee
```

결과:

- decision status: `pending`
- browserAction: `block_purchase_virtual_account`
- confidence: `high`
- matchedBy: `ledger_order_id`
- reason: `fast_ledger_pending_status`
- fastPath source: VM Cloud SQLite `attribution_ledger`
- matchedRows: 1
- 운영DB 조회는 fast ledger 판단으로 skip

판정: 미입금 가상계좌를 Meta Purchase로 보내지 않는 guard는 PASS.

## 엇갈린 점

`site-landing/summary?site=thecleancoffee&windowHours=1`은 조회 시점 1시간 안에서 Naver row를 보여주지 않았다. 반면 주문 단계 원장과 브라우저 저장소에는 Naver evidence가 남았다.

현재 해석은 둘 중 하나다.

1. 첫 랜딩 자체가 site landing ledger에 별도로 남지 않았고, checkout/payment payload metadata에만 보존됐다.
2. summary endpoint의 현재 분류/집계 범위가 이번 Naver brandsearch landing을 반영하지 못했다.

이 이슈는 매출 판단 blocker는 아니다. 그러나 “첫 유입 랜딩 원장”까지 완전히 닫으려면 별도 Green 조사 대상이다.

## Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| primary source | VM Cloud `attribution_ledger` public read-only API |
| browser cross-check | TJ님 Chrome console storage observation |
| rejected fallback | local SQLite `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` |
| window | 2026-05-25 06:15-06:30 KST |
| site | thecleancoffee |
| freshness | same-session / same-turn |
| confidence | high for browser + attribution ledger, medium for landing-ledger completeness |

## 하지 않은 것

- GTM publish: 0건
- Imweb code edit: 0건
- VM Cloud deploy/restart: 0건
- 운영DB write: 0건
- GA4/Meta/Google Ads/TikTok/Naver 전송: 0건
- raw order/payment/member/email/phone/click identifier output: 0건

## 다음 할일

### Auto Green

1. VM Cloud 첫 랜딩 원장 gap을 별도 read-only로 조사한다.
   - 목적: `site_landing_ledger`에 네이버 브랜드검색 최초 랜딩이 왜 안 보였는지 확인한다.
   - 방법: public API가 부족하면 SSH 접근 blocker를 먼저 해소한 뒤 SQLite read-only aggregate만 조회한다.
   - 성공 기준: `site_landing_ledger` row 존재 / 미존재 / summary classifier gap 중 하나로 분리한다.
   - 승인 필요: NO.

2. 가상계좌 미입금 Meta 이벤트명을 개선 설계한다.
   - 목적: 현재 Pixel Helper에서 `PurchaseDecisionUnknown`으로 보이는 pending vbank를 더 명확히 `VirtualAccountIssued` 계열로 분리한다.
   - 방법: no-send snippet/decision branch 설계를 먼저 만들고, 실제 Imweb/GTM 반영은 별도 승인으로 둔다.
   - 성공 기준: 미입금 가상계좌가 Purchase가 아니라 pending/virtual-account intent로 설명된다.
   - 승인 필요: 설계 NO, 운영 반영 YES.

### Approval Needed

현재 이 smoke 결과만으로 바로 필요한 승인 작업은 없다.

