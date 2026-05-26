# Google Ads 실제 결제완료 no-send 후보 생성 결과

작성 시각: 2026-05-26 19:53:47 KST
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

Meta CAPI와 같은 실제 구매 기준을 Google Ads 주 전환 후보표의 출발점으로 재사용했습니다. Primary 전환을 준비하는 기준은 '지금 당장 보낼 주문이 있는가'가 아니라 '실제 결제완료 주문만 구매로 보는 기준이 고정됐는가'입니다.

## 오늘 목표

오늘 안에 Google Ads가 효과적으로 학습할 실제 구매완료 주 전환 액션을 시작할 준비를 끝낸다.

현재 진척률: 79%

잘못된 구매 신호 분리, 실제 구매 기준 정렬, 1단계 후보 2건의 전송 전 필요값 설계까지 닫혔습니다. 남은 핵심은 원문값을 서버 내부에서 확인하고, 첫 제한 전송 승인 여부를 결정하는 것입니다.

## 목표 달성 단계별 계획

| 순서 | 할 일 | 진척률 | 현재 상태 | 통과 기준 | 다음 액션 | Lane/담당 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 잘못된 구매 신호를 학습에서 빼기 | 88% | 기존 구매완료는 NPay 버튼/결제진입 보조 신호로 낮췄고, TechSol NPay 구매 액션은 삭제됐다고 확인했습니다. | Google Ads Primary 구매 신호에 버튼 클릭/결제진입 전환이 남지 않는다. | 24시간 뒤 Google Ads에서 삭제/보조 처리한 액션의 전환 증가가 멈췄는지 read-only로 확인합니다. | Green/Codex |
| 2 | 실제 구매완료 기준을 고정하기 | 92% | Meta CAPI와 같은 실제 구매 기준을 Google Ads 후보 생성기의 첫 관문으로 맞췄습니다. | PAYMENT_COMPLETE, 금액 있음, 취소/반품/환불 없음 주문만 실제 구매 후보가 된다. | 이 기준을 로컬/운영 보고서 문구와 no-send 후보 생성기에 계속 유지합니다. | Green/Codex |
| 3 | 첫 후보를 두 단계로 나누기 | 90% | 최근 7일 seed row 4건 중 1단계 gclid 단일 후보 2건, 2단계 식별자 선택 필요 후보 2건으로 나눴습니다. | 오늘 먼저 볼 후보와 나중에 식별자 규칙을 정할 후보가 분리된다. | 1단계 후보를 no-send payload 후보표로 따로 출력합니다. | Green/Codex |
| 4 | 첫 no-send payload 후보 만들기 | 88% | 1단계 후보 2건의 전환 전 필요값 목록과 source/실패 의미를 정리했습니다. | 전송 전 미리 볼 후보표에 전환 액션, 금액, 통화, Google 식별자 종류, 원문값 source, 중복/환불 guard, 남은 차단 조건이 표시된다. | 실제 전송 전에는 원문 주문번호, 원문 gclid, 전환 시각을 서버 내부 private preview로 확인합니다. | Green/Codex |
| 5 | Google Ads 주 전환 액션을 시작할 실행안 확정 | 76% | BI confirmed_purchase_offline을 실제 구매완료 전용 후보로 쓰는 화면 실행안과 전송 전 필요값 설계가 정리됐습니다. 데이터 소스 연결/Primary 설정/전송은 아직 실행하지 않았습니다. | Google Ads 화면에서 어떤 액션을 Primary로 두고 어떤 액션을 보조/삭제 상태로 둘지 한 번에 판단된다. | 화면 기준 실행안을 작성하고, 설정 변경이 필요한 부분만 TJ님 승인 대상으로 분리합니다. | Green/Codex |
| 6 | 실제 구매 이벤트 전송 시작 | 25% | 아직 Google Ads conversion upload는 0건입니다. no-send 후보 검토 단계입니다. | 승인 후 첫 실제 구매완료 이벤트가 Google Ads 전환 액션에 중복 없이 들어간다. | TJ님이 명시 승인하면 1건 제한 전송 또는 validate-only 성격의 사전 점검부터 진행합니다. | Red/Codex+TJ님 |

## Google Ads에는 왜 보내는가

Google Ads가 자동입찰을 할 때 '어떤 클릭이 실제 매출을 만들었는지'를 배웁니다. 지금 Google Ads의 구매완료 숫자는 NPay 클릭/결제시작 같은 넓은 신호가 섞였을 가능성이 커서, 나중에는 내부 장부에서 실제 결제완료로 확인된 주문만 별도 전환으로 알려주는 것이 목적입니다.

현재 판단: 지금은 보내지 않습니다. Google Ads 계정에는 관찰용 offline 전환 액션이 보이지만, 실제 결제완료 주문 후보를 그 액션으로 보내는 전송 승인과 dispatcher는 열지 않았습니다.

## Primary 전환 후보 기준 정리

Google Ads 주 전환으로 삼을 기준은 '지금 당장 보낼 수 있는 주문이 있는가'가 아니라 '실제 결제완료 주문만 구매로 보는 기준이 고정됐는가'입니다.

BI confirmed_purchase_offline을 Primary 전환으로 준비하거나 올리는 데 과거 전송 가능 주문이 꼭 먼저 있어야 하는 것은 아닙니다. 다만 Google Ads가 학습하려면 이후 실제 구매 이벤트가 꾸준히 들어와야 합니다.

| 항목 | 현재 판단 | 사람 말 해석 |
| --- | --- | --- |
| 실제 구매 기준 | 준비됨 | Meta CAPI와 같은 실제 구매 기준, 즉 결제완료/금액 있음/취소 없음/반품 없음/환불 없음 기준을 Google Ads 후보 생성기의 첫 관문으로 맞췄습니다. |
| Primary 준비 가능 여부 | 가능 | 첫 전송 전에도 실제 구매 전용 전환 액션을 준비할 수 있습니다. 다만 Google Ads 학습은 실제 이벤트가 들어온 뒤부터 시작됩니다. |
| 현재 seed row | 4건 | 최근 7일 주문 단위 검토표에서 Meta식 실제 구매 기준을 통과하고 Google click id가 함께 보이는 후보입니다. |
| 1단계 후보 | 2건 | 실제 결제완료이고 gclid 하나만 남아 있어, 오늘 주 전환 액션을 시작할 때 가장 먼저 검토할 단순 후보입니다. |
| 2단계 후보 | 2건 | 실제 결제완료는 맞지만 gclid와 gbraid가 같이 남아 있어, 전송 전에 식별자 선택 규칙이 필요합니다. |
| 지금의 역할 | no-send 후보표 | 이 기준은 기존 NPay 버튼/결제진입 신호를 대체할 '실제 구매완료 주 전환'의 후보 기준입니다. 전송은 계속 no-send로 검증합니다. |

아직 학습이 시작되지 않는 이유:

- Google Ads conversion upload는 아직 실행하지 않았습니다.
- 전송 dispatcher는 닫혀 있습니다.
- 중복 방지와 취소/환불 후속 확인 장부는 아직 운영 전송용으로 열지 않았습니다.
- gclid와 gbraid가 같이 남은 주문은 Google Ads 전송 시 식별자 하나를 고르는 규칙이 필요합니다.

## 1단계 no-send payload 후보

이 표는 실제 전송 payload가 아니라, 오늘 주 전환 액션을 시작하기 전에 먼저 볼 수 있는 후보 미리보기입니다. 원문 주문번호와 원문 gclid는 보고서에 출력하지 않습니다.

후보 수: 2건

| masked order | 전환 액션 후보 | 의미 | 금액 | 통화 | Google 식별자 | 식별자 값 | 남은 조건 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20260520...016693 | BI confirmed_purchase_offline | actual_confirmed_purchase | 36,900 | KRW | gclid | redacted_in_no_send_report | exact order id/order number export, exact gclid value export, conversion timestamp export, duplicate/refund follow-up guard, Google Ads upload approval |
| 20260524...353635 | BI confirmed_purchase_offline | actual_confirmed_purchase | 234,000 | KRW | gclid | redacted_in_no_send_report | exact order id/order number export, exact gclid value export, conversion timestamp export, duplicate/refund follow-up guard, Google Ads upload approval |

## 1단계 후보 2건 전송 전 원문값 점검 설계

목표: 1단계 후보 2건을 Google Ads에 보내기 직전, 원문 주문번호/gclid/전환시각/금액/중복·환불 guard가 어디서 확인되어야 하는지 닫는다.

진척률: 82%

후보 2건은 전환 액션, 금액, 통화, gclid 단일 후보까지는 정리됐습니다. 실제 전송 전에는 서버 내부 원문값 export와 중복/환불 guard가 남아 있습니다.

중요: 아래 표는 원문 주문번호나 원문 gclid를 보여주는 표가 아닙니다. 실제 값은 문서/대화에 노출하지 않고, 서버 내부 private preview 또는 전송 job 안에서만 확인해야 합니다.

### private payload preview 구현 상태

구현 완료: `GET /api/google-ads/confirmed-purchase/private-payload-preview?site=biocom&window=last_7d&limit=2`

이 endpoint는 원문 주문번호와 원문 gclid를 서버 내부에서만 확인하고, 응답에는 원문값을 내보내지 않습니다.

로컬 smoke 결과는 endpoint 200 응답과 원문 노출 차단 조건 통과입니다. 다만 로컬 backend 기준으로는 click evidence 후보가 0건입니다. VM Cloud live public diagnostic 기준으로는 최근 7일 Google click id 주문 4건 중 gclid 단일 실제 결제완료 후보 2건이 보입니다. 따라서 다음 판단은 VM Cloud backend에 같은 route를 배포한 뒤, live source에서 후보 2건이 private preview로 안전하게 나오는지 확인하는 것입니다.

불변 조건: `rawOrderIdInResponse=false`, `rawClickIdInResponse=false`, `uploadCandidateCount=0`, `sendCandidateCount=0`, `externalSendCount=0`, `operationalDbWrite=0`, `vmCloudWrite=0`.

### 후보 1: 20260520...016693

현재 준비도: 33%

안전한 보고서에 보이는 값만으로는 금액/통화/전환 액션은 닫혔지만, 원문 주문번호/gclid/전환시각/중복·환불 guard/승인은 아직 닫히지 않았습니다.

| 필요값 | 왜 필요한가 | 확인 source | 현재 상태 | 안전 표시값 | 통과 기준 | 실패 시 해석 |
| --- | --- | --- | --- | --- | --- | --- |
| 원문 주문번호 | 같은 주문을 Google Ads에 두 번 보내지 않기 위한 중복 방지 기준입니다. | VM Cloud order-level private export 또는 서버 내부 전송 job | needs_private_exact_export | 20260520...016693 | 마스킹되지 않은 주문번호가 1개만 확인되고, 전환 액션별 중복 key로 만들 수 있어야 합니다. | 주문번호가 없거나 여러 개면 같은 구매를 중복 전송할 위험이 있어 전송하면 안 됩니다. |
| 원문 gclid | Google Ads가 이 구매를 어느 광고 클릭과 연결할지 판단하는 핵심 값입니다. | payment_success_ledger raw evidence 또는 서버 내부 order-level evidence export | needs_private_exact_export | redacted_in_no_send_report | gclid 원문이 비어 있지 않고, gclid/gbraid/wbraid 중 gclid 하나만 payload에 들어가야 합니다. | gclid가 없거나 다른 Google 식별자와 동시에 들어가면 Google Ads가 구매를 잘못 연결하거나 업로드를 거부할 수 있습니다. |
| 실제 결제완료 시각 | Google Ads가 광고 클릭 이후 언제 구매가 일어났는지 계산하는 기준입니다. | 운영DB 결제완료 시각 또는 VM Cloud order-level paidAt/paymentCompleteAt | needs_private_exact_export | needs_exact_order_level_export | Asia/Seoul 기준 실제 결제완료 시각이 있고, Google Ads 업로드 형식으로 변환 가능해야 합니다. | 결제완료 시각이 없으면 버튼 클릭 시각이나 주문 생성 시각을 구매 시각으로 착각할 수 있습니다. |
| 실제 결제금액 | Google Ads가 어떤 광고가 실제 매출을 만들었는지 학습하는 금액입니다. | 운영DB 주문 금액 cross-check + VM Cloud no-send 후보 금액 | verified_by_public_safe_field | 36,900 | 금액이 0보다 크고, 내부 실제 결제금액과 일치해야 합니다. | 금액이 틀리면 Google Ads ROAS가 다시 부풀거나 줄어들어 예산 판단이 흔들립니다. |
| 통화 | 금액 36,900/234,000이 원화인지 Google Ads에 명확히 알려야 합니다. | 사이트 고정 통화 + payload hard guard | verified_by_public_safe_field | KRW | currency_code가 KRW로 고정되어야 합니다. | 통화가 빠지거나 다르면 전환값 해석이 틀어집니다. |
| 실제 결제완료 조건 | 미입금 가상계좌, NPay 버튼 클릭, 결제창 진입을 실제 구매로 보내지 않기 위한 기준입니다. | Meta CAPI compatible confirmed purchase guard + 운영DB 취소/환불/반품 상태 | needs_guard_lookup | PAYMENT_COMPLETE + value > 0 + no cancel/return/refund | PAYMENT_COMPLETE이고, 금액이 0보다 크며, 취소/환불/반품이 없어야 합니다. | 이 조건이 깨지면 버튼 클릭이나 취소 주문이 구매로 들어가 Google Ads 학습을 다시 오염시킵니다. |
| 중복 전송 방지 key | 같은 주문을 여러 번 보내 Google Ads 구매건수와 매출이 두 번 잡히는 것을 막습니다. | 전송 이력 장부 또는 no-send dispatcher ledger | needs_guard_lookup | not_opened | conversion_action_id + order_no 또는 conversion_action_id + payment_key 조합이 이전 전송 이력에 없어야 합니다. | 중복 guard가 없으면 제한 전송 1건도 여러 번 들어갈 수 있어 전송을 열면 안 됩니다. |
| Google Ads 실제 구매 전환 액션 | 버튼 클릭용 전환이 아니라 실제 구매완료 전용 전환에 보내기 위해 필요합니다. | Google Ads conversion action inventory | verified_by_public_safe_field | BI confirmed_purchase_offline | 전환 액션이 BI confirmed_purchase_offline이고, 기존 NPay 버튼/진입 라벨이 아니어야 합니다. | 잘못된 전환 액션으로 보내면 실제 구매 통로와 버튼 클릭 통로가 다시 섞입니다. |
| TJ님 실제 Google Ads 전송 승인 | 전환 업로드는 Google Ads 전환값과 입찰 학습에 영향을 주는 Red Lane 작업입니다. | 대화 내 명시 승인 + 실행 전 승인 문서 | needs_red_approval | not_approved | TJ님이 Google Ads conversion upload 1건 제한 전송을 명시 승인해야 합니다. | 승인 없이는 외부 광고 플랫폼에 구매 신호를 보내면 안 됩니다. |

아직 전송하지 않는 이유:

- 원문 주문번호를 문서에 노출하지 않고 서버 내부에서 확인해야 합니다.
- 원문 gclid를 문서에 노출하지 않고 서버 내부에서 확인해야 합니다.
- 실제 결제완료 시각과 취소/환불 후속 상태를 교차 확인해야 합니다.
- Google Ads 전송 승인과 dispatcher가 아직 닫혀 있습니다.

### 후보 2: 20260524...353635

현재 준비도: 33%

안전한 보고서에 보이는 값만으로는 금액/통화/전환 액션은 닫혔지만, 원문 주문번호/gclid/전환시각/중복·환불 guard/승인은 아직 닫히지 않았습니다.

| 필요값 | 왜 필요한가 | 확인 source | 현재 상태 | 안전 표시값 | 통과 기준 | 실패 시 해석 |
| --- | --- | --- | --- | --- | --- | --- |
| 원문 주문번호 | 같은 주문을 Google Ads에 두 번 보내지 않기 위한 중복 방지 기준입니다. | VM Cloud order-level private export 또는 서버 내부 전송 job | needs_private_exact_export | 20260524...353635 | 마스킹되지 않은 주문번호가 1개만 확인되고, 전환 액션별 중복 key로 만들 수 있어야 합니다. | 주문번호가 없거나 여러 개면 같은 구매를 중복 전송할 위험이 있어 전송하면 안 됩니다. |
| 원문 gclid | Google Ads가 이 구매를 어느 광고 클릭과 연결할지 판단하는 핵심 값입니다. | payment_success_ledger raw evidence 또는 서버 내부 order-level evidence export | needs_private_exact_export | redacted_in_no_send_report | gclid 원문이 비어 있지 않고, gclid/gbraid/wbraid 중 gclid 하나만 payload에 들어가야 합니다. | gclid가 없거나 다른 Google 식별자와 동시에 들어가면 Google Ads가 구매를 잘못 연결하거나 업로드를 거부할 수 있습니다. |
| 실제 결제완료 시각 | Google Ads가 광고 클릭 이후 언제 구매가 일어났는지 계산하는 기준입니다. | 운영DB 결제완료 시각 또는 VM Cloud order-level paidAt/paymentCompleteAt | needs_private_exact_export | needs_exact_order_level_export | Asia/Seoul 기준 실제 결제완료 시각이 있고, Google Ads 업로드 형식으로 변환 가능해야 합니다. | 결제완료 시각이 없으면 버튼 클릭 시각이나 주문 생성 시각을 구매 시각으로 착각할 수 있습니다. |
| 실제 결제금액 | Google Ads가 어떤 광고가 실제 매출을 만들었는지 학습하는 금액입니다. | 운영DB 주문 금액 cross-check + VM Cloud no-send 후보 금액 | verified_by_public_safe_field | 234,000 | 금액이 0보다 크고, 내부 실제 결제금액과 일치해야 합니다. | 금액이 틀리면 Google Ads ROAS가 다시 부풀거나 줄어들어 예산 판단이 흔들립니다. |
| 통화 | 금액 36,900/234,000이 원화인지 Google Ads에 명확히 알려야 합니다. | 사이트 고정 통화 + payload hard guard | verified_by_public_safe_field | KRW | currency_code가 KRW로 고정되어야 합니다. | 통화가 빠지거나 다르면 전환값 해석이 틀어집니다. |
| 실제 결제완료 조건 | 미입금 가상계좌, NPay 버튼 클릭, 결제창 진입을 실제 구매로 보내지 않기 위한 기준입니다. | Meta CAPI compatible confirmed purchase guard + 운영DB 취소/환불/반품 상태 | needs_guard_lookup | PAYMENT_COMPLETE + value > 0 + no cancel/return/refund | PAYMENT_COMPLETE이고, 금액이 0보다 크며, 취소/환불/반품이 없어야 합니다. | 이 조건이 깨지면 버튼 클릭이나 취소 주문이 구매로 들어가 Google Ads 학습을 다시 오염시킵니다. |
| 중복 전송 방지 key | 같은 주문을 여러 번 보내 Google Ads 구매건수와 매출이 두 번 잡히는 것을 막습니다. | 전송 이력 장부 또는 no-send dispatcher ledger | needs_guard_lookup | not_opened | conversion_action_id + order_no 또는 conversion_action_id + payment_key 조합이 이전 전송 이력에 없어야 합니다. | 중복 guard가 없으면 제한 전송 1건도 여러 번 들어갈 수 있어 전송을 열면 안 됩니다. |
| Google Ads 실제 구매 전환 액션 | 버튼 클릭용 전환이 아니라 실제 구매완료 전용 전환에 보내기 위해 필요합니다. | Google Ads conversion action inventory | verified_by_public_safe_field | BI confirmed_purchase_offline | 전환 액션이 BI confirmed_purchase_offline이고, 기존 NPay 버튼/진입 라벨이 아니어야 합니다. | 잘못된 전환 액션으로 보내면 실제 구매 통로와 버튼 클릭 통로가 다시 섞입니다. |
| TJ님 실제 Google Ads 전송 승인 | 전환 업로드는 Google Ads 전환값과 입찰 학습에 영향을 주는 Red Lane 작업입니다. | 대화 내 명시 승인 + 실행 전 승인 문서 | needs_red_approval | not_approved | TJ님이 Google Ads conversion upload 1건 제한 전송을 명시 승인해야 합니다. | 승인 없이는 외부 광고 플랫폼에 구매 신호를 보내면 안 됩니다. |

아직 전송하지 않는 이유:

- 원문 주문번호를 문서에 노출하지 않고 서버 내부에서 확인해야 합니다.
- 원문 gclid를 문서에 노출하지 않고 서버 내부에서 확인해야 합니다.
- 실제 결제완료 시각과 취소/환불 후속 상태를 교차 확인해야 합니다.
- Google Ads 전송 승인과 dispatcher가 아직 닫혀 있습니다.

다음 Green 작업:

- raw 값을 문서에 노출하지 않는 private payload preview 또는 서버 내부 validate-only 형태의 전송 전 검증표를 만든다.

다음 Red 작업:

- TJ님이 승인하면 BI confirmed_purchase_offline으로 1건 제한 Google Ads conversion upload를 실행한다.

## no-send 후보 판정

| 기준 | 실제 결제완료 | 매출 | click id 직접 보존 | 보존률 | 전송 후보 | 주요 차단 이유 |
| --- | --- | --- | --- | --- | --- | --- |
| 최근 7일 | 465 | 111,035,812 | 4 | 0.86% | 0 | read_only_phase 465, approval_required 465, google_ads_conversion_action_not_selected_or_dispatch_closed 465, conversion_upload_not_approved 465 |
| 최근 30일 | 2,226 | 519,334,790 | 17 | 0.76% | 0 | read_only_phase 2226, approval_required 2226, google_ads_conversion_action_not_selected_or_dispatch_closed 2226, conversion_upload_not_approved 2226 |
| 5월 21일 21:15 보강 이후 | 114 | n/a | 0 | 0.00% | 0 | read_only_phase 114, approval_required 114, google_ads_conversion_action_not_selected_or_dispatch_closed 114, conversion_upload_not_approved 114 |

## ready_but_not_sent 검토표

`ready_but_not_sent`는 전송 준비 완료가 아니다. Meta CAPI와 같은 실제 구매 기준을 통과한 주문 중 Google click id가 함께 보이는 주문을 따로 꺼내서, 왜 아직 Google Ads에 보내면 안 되는지 사유를 붙이는 검토표다.

검토 row: 4건 / Meta 실제 구매 기준 통과: 4건 / 실제 전송 대기: 0건 / Google Ads 전송 후보: 0건

여기서 중요한 점: 이 4건은 `Primary 전환 기준을 실제 구매완료로 잡는 데 쓸 수 있는 검토 표본`입니다. 반대로 `당장 Google Ads에 업로드해도 되는 주문 4건`이라는 뜻은 아닙니다.

2단계 분리: 1단계 단순 후보 2건 / 2단계 식별자 선택 필요 후보 2건

| 단계 | masked order | 결제 | 금액 | click id 종류 | Meta 실제 구매 기준 | 왜 이 단계인가 | 아직 못 보내는 이유 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2단계: 식별자 선택 규칙 필요 | 20260519...037917 | CARD/PAYMENT_COMPLETE | 245,000 | gclid+gbraid | 통과 | 실제 결제완료 기준은 통과했지만 gclid/gbraid 같은 Google 식별자가 둘 이상 남아, 전송 전에 어떤 하나를 쓸지 규칙을 정해야 합니다. | no_send_phase, google_ads_upload_not_approved, dispatcher_closed, permanent_safe_ref_snapshot_missing, duplicate_and_refund_followup_ledger_missing, one_google_identifier_selection_required |
| 1단계: 바로 검토할 단순 후보 | 20260520...016693 | CARD/PAYMENT_COMPLETE | 36,900 | gclid | 통과 | 실제 결제완료 기준을 통과했고 Google 식별자가 gclid 하나라, 나중에 전송 실험을 열 때 선택 규칙이 가장 단순합니다. | no_send_phase, google_ads_upload_not_approved, dispatcher_closed, permanent_safe_ref_snapshot_missing, duplicate_and_refund_followup_ledger_missing |
| 1단계: 바로 검토할 단순 후보 | 20260524...353635 | CARD/PAYMENT_COMPLETE | 234,000 | gclid | 통과 | 실제 결제완료 기준을 통과했고 Google 식별자가 gclid 하나라, 나중에 전송 실험을 열 때 선택 규칙이 가장 단순합니다. | no_send_phase, google_ads_upload_not_approved, dispatcher_closed, permanent_safe_ref_snapshot_missing, duplicate_and_refund_followup_ledger_missing |
| 2단계: 식별자 선택 규칙 필요 | 20260525...315256 | CARD/PAYMENT_COMPLETE | 240,000 | gclid+gbraid | 통과 | 실제 결제완료 기준은 통과했지만 gclid/gbraid 같은 Google 식별자가 둘 이상 남아, 전송 전에 어떤 하나를 쓸지 규칙을 정해야 합니다. | no_send_phase, google_ads_upload_not_approved, dispatcher_closed, permanent_safe_ref_snapshot_missing, duplicate_and_refund_followup_ledger_missing, one_google_identifier_selection_required |

검토표 차단 조건:

- Meta 실제 구매 기준은 출발점이며, Google Ads 전송에는 Google click id 조건이 추가로 필요
- Google Ads upload 승인 없음
- 전송 dispatcher 닫힘
- 영구 safe_ref snapshot 0건
- 중복 방지/취소/환불 후속 반영 장부 미오픈

## click id가 마지막으로 끊기는 지점

결론: 마지막으로 크게 끊기는 지점은 광고 클릭 직후가 아니라, 결제완료 주문으로 넘어가는 payment_success/order bridge 구간입니다.

| 단계 | 관측값 | 뜻 |
| --- | --- | --- |
| 광고 클릭 직후 | 5월 21일 21:15 KST 보강 이후 고객 유입 장부는 Google click id 2,865건, 그중 gad_campaignid 2,759건입니다. | 클릭 URL 파라미터 자체는 대부분 들어오고 있습니다. |
| 태그가 저장한 유료 클릭 의도 | 같은 기간 유료 클릭 의도 장부는 Google click id 2,935건, 그중 gad_campaignid 2,909건입니다. | GTM/아임웹 태그의 초기 수집도 대체로 정상입니다. |
| 실제 결제완료 | 같은 기간 confirmed payment_success 114건 중 직접 Google click id 보존은 0건입니다. live 최근 7일 dashboard-summary 기준으로 넓히면 465건 중 4건만 직접 보존입니다. | 결제완료 주문에 붙는 최종 evidence가 부족합니다. Google Ads upload 후보로 올릴 수 없습니다. |

## 왜 아직 Google Ads upload 후보가 아닌가

- `send_candidate=0`: 이 스크립트는 실제 Google Ads 전송 코드를 호출하지 않습니다.
- `read_only_phase`: 지금은 후보 판정만 합니다.
- `approval_required`: 실제 전송은 TJ님이 별도 승인해야 합니다.
- `meta_actual_purchase_criteria_not_passed`: Meta CAPI와 같은 실제 구매 기준을 통과하지 못한 주문은 Google Ads 실제 구매 후보에서 제외합니다.
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
