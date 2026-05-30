# Google Ads 주문별 진단 endpoint 및 1일 ROAS 확인

작성 시각: 2026-05-24 KST
문서 성격: read-only / no-send / no-write

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions:
    - local_backend_code_change
    - local_api_smoke
    - google_ads_api_read_only
    - local_report_write
  forbidden_actions:
    - google_ads_conversion_upload
    - google_ads_conversion_action_change
    - google_ads_primary_goal_change
    - operational_db_write
    - vm_cloud_sqlite_write
    - deploy_or_restart
    - gtm_publish
  source_window_freshness_confidence:
    source: local backend API + Google Ads API read-only
    window: last_1d / last_7d
    freshness: local operational DB sync is stale for order diagnostics; Google Ads API last_1d is live read-only
    confidence: medium for local order diagnostics, high for Google Ads 1일 platform metrics
```

## 한 줄 결론

Google Ads의 1일 주장 ROAS는 조회 가능하다. 다만 Google Ads API는 “구매완료 21건”이라는 숫자와 금액만 주고, 그 21건이 어떤 아임웹 주문번호인지 직접 주지 않는다. 주문번호까지 보려면 우리 내부 결제완료 주문과 Google click id가 같은 row에 붙어 있어야 한다.

## 추가한 endpoint

로컬 백엔드에 주문별 진단 endpoint를 추가했다.

```text
GET /api/google-ads/click-id-health/orders?window=last_1d&only=all&limit=200
GET /api/google-ads/click-id-health/orders?window=last_7d&only=with_click_id&limit=50
```

응답은 주문번호와 Google click id를 그대로 보여준다. 지금은 진단 속도를 우선해서 그대로 노출하고, 외부 배포 전에는 접근 제한이나 암호화/마스킹을 붙여야 한다.

## endpoint가 보여주는 것

- 주문번호
- 네이버페이 채널 주문번호
- 결제완료 시각
- 결제수단
- 주문금액
- gclid
- gbraid
- wbraid
- evidence source: payment_success ledger, npay intent, both, none
- block reasons
- sendCandidateCount: 항상 0

## 로컬 smoke 결과

### last_1d 주문별 진단

```text
orderCount: 61
returnedCount: 5
withGoogleClickId: 0
missingGoogleClickId: 61
sendCandidateCount: 0
rawOrderIdInResponse: true
rawClickIdInResponse: true
```

주의: 현재 로컬 backend가 보는 운영DB freshness는 stale이다. source max payment_complete_time이 2026-05-23 17:30:01 KST로 잡혔고 sync lag가 537분이다. 따라서 이 endpoint는 기능 검증은 통과했지만, 운영 판단은 VM Cloud 배포 후 live DB 기준으로 다시 봐야 한다.

### last_7d with_click_id 주문별 진단

```text
local orderCount: 464
local withGoogleClickId: 0
returnedCount: 0
```

주의: VM Cloud public dashboard의 live aggregate는 최근 7일 466건 중 direct evidence 5건이다. 로컬은 VM Cloud SQLite/운영DB freshness 차이 때문에 0건으로 보인다. 즉 “코드는 작동하지만 로컬 데이터가 최신 운영 상태와 다르다”로 해석한다.

## Google Ads 1일 주장 ROAS

`/api/google-ads/dashboard?date_preset=last_1d`를 추가로 열어 확인했다.

```text
dateRangeLiteral: YESTERDAY
cost: 398,078원
conversions: 21
conversionValue: 4,050,200원
ROAS: 10.17x
```

전환 액션별로 보면 핵심은 아래다.

```text
구매완료 / action id 7130249515 / Primary / PURCHASE
conversions: 21
conversionValue: 4,050,200원
classification: primary_known_npay
risk: primary_bid_signal_is_npay
```

Secondary 쪽에는 `TechSol - NPAY구매 50739`가 all conversions 23건, all conversion value 4,724,200원으로 보인다.

## 주문번호까지 확인 가능한가

현재 Google Ads API만으로는 불가능하다. Google Ads는 “구매완료 21건, 4,050,200원”처럼 광고 플랫폼 안의 전환 집계만 준다. 아임웹 주문번호를 직접 주지 않는다.

주문번호까지 확인하려면 아래 연결이 필요하다.

1. 실제 결제완료 주문번호가 있다.
2. 그 주문 row에 gclid/gbraid/wbraid가 남아 있다.
3. 그 click id가 Google Ads 클릭에서 온 것이다.
4. 그러면 “이 주문번호는 Google 광고 클릭 증거가 있다”라고 내부에서 말할 수 있다.

지금은 1일 로컬 기준에서 2번이 0건이다. 그래서 Google Ads가 말하는 21건을 내부 주문번호 21개로 바로 펼칠 수 없다.

## 다음 판단

주문별 endpoint 자체는 로컬에서 작동한다. 다음 단계는 VM Cloud에 같은 read-only endpoint를 배포해 live aggregate에서 보이던 direct evidence 5건이 실제 어떤 주문번호인지 확인하는 것이다. 이 배포는 운영 API 노출 변경이므로 TJ님 승인 후 진행한다.
