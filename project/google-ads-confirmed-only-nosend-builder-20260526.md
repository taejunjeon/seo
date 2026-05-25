# Google Ads 실제 결제완료 no-send 후보 생성 결과

작성 시각: 2026-05-26 01:57:00 KST
문서 성격: read-only / no-send / no-write

```yaml
harness_preflight:
  common_harness_read:
    - "harness/common/HARNESS_GUIDELINES.md"
    - "harness/common/AUTONOMY_POLICY.md"
    - "harness/common/REPORTING_TEMPLATE.md"
  project_harness_read:
    - "AGENTS.md"
    - "data/!data_inventory.md"
    - "gdn/attribution-data-source-decision-guide-20260511.md"
  lane: "Green"
  allowed_actions:
    - "public_api_read_only"
    - "local_script_write"
    - "local_json_report_write"
    - "local_markdown_report_write"
  forbidden_actions:
    - "google_ads_conversion_upload"
    - "google_ads_conversion_action_change"
    - "google_ads_primary_goal_change"
    - "operational_db_write"
    - "vm_cloud_sqlite_write"
    - "deploy_or_restart"
    - "gtm_publish"
  source_window_freshness_confidence:
    source: "VM Cloud public dashboard-summary aggregate + frontend post-patch report snapshot"
    window: "last_7d, last_30d, post_patch_20260521_2115"
    freshness: "last_7d/last_30d from live public dashboard-summary API; post_patch snapshot from current frontend report constants"
    confidence: "medium-high for aggregate counts, medium for exact loss point until order-level endpoint is added"
```

## 한 줄 결론

실제 결제완료 주문만 Google Ads에 보낼 수 있는지 다시 계산했지만, 지금 전송 후보는 0건입니다. 광고 클릭은 초반 장부에 잘 들어오지만, 결제완료 주문으로 넘어갈 때 Google click id가 거의 사라집니다.

## Google Ads에는 왜 보내는가

Google Ads가 자동입찰을 할 때 '어떤 클릭이 실제 매출을 만들었는지'를 배웁니다. 지금 Google Ads의 구매완료 숫자는 NPay 클릭/결제시작 같은 넓은 신호가 섞였을 가능성이 커서, 나중에는 내부 장부에서 실제 결제완료로 확인된 주문만 별도 전환으로 알려주는 것이 목적입니다.

현재 판단: 지금은 보내지 않습니다. Google Ads 계정에는 관찰용 offline 전환 액션이 보이지만, 실제 결제완료 주문 후보를 그 액션으로 보내는 전송 승인과 dispatcher는 열지 않았습니다.

## no-send 후보 판정

| 기준 | 실제 결제완료 | 매출 | click id 직접 보존 | 보존률 | 전송 후보 | 주요 차단 이유 |
| --- | --- | --- | --- | --- | --- | --- |
| 최근 7일 | 412 | 96,392,797 | 3 | 0.73% | 0 | read_only_phase 412, approval_required 412, google_ads_conversion_action_not_selected_or_dispatch_closed 412, conversion_upload_not_approved 412 |
| 최근 30일 | 2,173 | 504,691,775 | 16 | 0.74% | 0 | read_only_phase 2173, approval_required 2173, google_ads_conversion_action_not_selected_or_dispatch_closed 2173, conversion_upload_not_approved 2173 |
| 5월 21일 21:15 보강 이후 | 114 | n/a | 0 | 0.00% | 0 | read_only_phase 114, approval_required 114, google_ads_conversion_action_not_selected_or_dispatch_closed 114, conversion_upload_not_approved 114 |

## click id가 마지막으로 끊기는 지점

결론: 마지막으로 크게 끊기는 지점은 광고 클릭 직후가 아니라, 결제완료 주문으로 넘어가는 payment_success/order bridge 구간입니다.

| 단계 | 관측값 | 뜻 |
| --- | --- | --- |
| 광고 클릭 직후 | 5월 21일 21:15 KST 보강 이후 고객 유입 장부는 Google click id 2,865건, 그중 gad_campaignid 2,759건입니다. | 클릭 URL 파라미터 자체는 대부분 들어오고 있습니다. |
| 태그가 저장한 유료 클릭 의도 | 같은 기간 유료 클릭 의도 장부는 Google click id 2,935건, 그중 gad_campaignid 2,909건입니다. | GTM/아임웹 태그의 초기 수집도 대체로 정상입니다. |
| 실제 결제완료 | 같은 기간 confirmed payment_success 114건 중 직접 Google click id 보존은 0건입니다. live 최근 7일 dashboard-summary 기준으로 넓히면 412건 중 3건만 직접 보존입니다. | 결제완료 주문에 붙는 최종 evidence가 부족합니다. Google Ads upload 후보로 올릴 수 없습니다. |

## 왜 아직 Google Ads upload 후보가 아닌가

- `send_candidate=0`: 이 스크립트는 실제 Google Ads 전송 코드를 호출하지 않습니다.
- `read_only_phase`: 지금은 후보 판정만 합니다.
- `approval_required`: 실제 전송은 TJ님이 별도 승인해야 합니다.
- `google_ads_conversion_action_not_selected_or_dispatch_closed`: 계정에 관찰용 offline 전환 액션은 보이지만, 이 no-send 결과를 실제 전송 대상으로 연결하지 않았습니다.
- `missing_google_click_id`: 대부분의 실제 결제완료 주문에 gclid/gbraid/wbraid가 직접 남지 않았습니다.
- `exact_order_level_payload_not_exported_from_public_endpoint`: 공개 API는 aggregate라서 실제 전송 payload를 만들 주문 단위 데이터가 없습니다.

## 다음 증거

정확한 마지막 코드 경로를 닫으려면 order-level read-only 진단이 필요합니다. 공개 API는 aggregate만 주므로 raw 주문번호/click id를 노출하지 않는 safe_ref 단위 order-level diagnostic endpoint 또는 VM Cloud SQLite read-only 접근이 다음 단계입니다.

## Guardrails

```text
Google Ads conversion upload: NOT RUN
Google Ads conversion action change: NOT RUN
운영DB write: NOT RUN
VM Cloud SQLite write: NOT RUN
배포/restart: NOT RUN
raw order id 출력: 0
raw click id 출력: 0
```
