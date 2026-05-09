# GDN Rules

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
목적: Google Ads/GDN ROAS 정합성 판단 규칙을 고정한다
관련 문서: [[harness/gdn/README|GDN Harness]], [[harness/gdn/CONTEXT_PACK|GDN Context Pack]], [[harness/gdn/APPROVAL_GATES|GDN Approval Gates]], [[harness/gdn/LESSONS|GDN Lessons]]

## 10초 요약

Google Ads 플랫폼 ROAS는 참고값이다.

운영 판단의 메인 ROAS는 내부 confirmed 매출 기준이다. `Conv. value`, `All conv. value`, view-through conversion, NPay click/count label을 섞으면 안 된다.

## 절대 기본값

| 항목 | 기본값 |
|---|---|
| Google Ads conversion upload | 금지 |
| Google Ads 전환 액션 변경 | 금지 |
| Google Ads budget/status 변경 | 금지 |
| GTM publish | 금지 |
| GA4/Meta/TikTok 전송 | 금지 |
| 운영DB write | 금지 |
| backend deploy | 금지 |
| `send_candidate` | `N` |

## ROAS 정의

| 이름 | 분자 | 분모 | 운영 판단 |
|---|---|---|---|
| Google platform ROAS | Google Ads `metrics.conversions_value` | Google Ads cost | 참고. 증액 근거로 단독 사용 금지 |
| Google all-conv ROAS | Google Ads `metrics.all_conversions_value` | Google Ads cost | 운영 판단 금지 |
| Internal confirmed ROAS | TJ 관리 Attribution VM confirmed Google 유입 매출 | Google Ads cost | 운영 메인 후보 |
| View-through ROAS | 조회 후 전환 value 또는 count | Google Ads cost | 보조 지표 |
| Click-only ROAS | click id 또는 Google UTM 근거 confirmed 매출 | Google Ads cost | GDN/PMax 판단 보조 |

## Conversion Action Classification

| 분류 | 기준 | 운영 처리 |
|---|---|---|
| `primary_confirmed_purchase` | 실제 confirmed 주문 기반, dynamic value, transaction_id 또는 order id 있음 | 목표 상태 |
| `primary_known_npay` | Primary이고 label이 `r0vu...` 또는 알려진 NPay count/click label | gap driver. 증액 근거 금지 |
| `secondary_known_npay` | Secondary이고 NPay label/name/value 경로 | All conv. value 분리 |
| `helper_action` | add_to_cart, page_view_long, sign_up 등 | purchase ROAS 분자 제외 |
| `unknown_purchase` | purchase category지만 label/value source 불명 | `unknown`, 승인 전 primary 사용 금지 |

## Known NPay Label Rule

아래 label은 confirmed purchase로 보지 않는다.

| label | 현재 의미 | 처리 |
|---|---|---|
| `r0vuCKvy-8caEJixj5EB` | 아임웹 자동 NPay count로 확인된 Primary `구매완료` label | purchase primary 신뢰 금지 |
| `3yjICOXRmJccEJixj5EB` | GTM TechSol NPay 구매 label | All conv. value 분리, confirmed 전환 후보 금지 |

전송 후보를 좁히는 새 known label은 `LESSONS.md`에 observation으로 남긴 뒤 RULES에 승격할 수 있다.
전송 후보를 넓히는 label 해석은 TJ님 승인 전 RULES에 승격하지 않는다.

## Internal Revenue Rule

내부 매출은 아래 기준으로만 본다.

1. `touchpoint=payment_success`.
2. `paymentStatus=confirmed`.
3. site/source는 `biocom_imweb`.
4. 금액은 양수 결제금액.
5. 중복 주문은 `paymentKey`, `orderId`, `orderIdBase`, `transaction_id` 후보로 묶는다.
6. pending, canceled, refund는 메인 분자에서 제외하고 별도 표기한다.

## Google Attribution Evidence Rule

Google 유입 근거는 강도별로 분리한다.

| tier | 기준 | 용도 |
|---|---|---|
| high | `gclid`, `gbraid`, `wbraid` 직접 존재 | offline conversion 후보 검토 |
| medium | `utm_source=google`, `utm_medium=cpc/paid`, `gad_campaignid` | 내부 ROAS 보조 |
| low | landing/referrer text에 google 계열 흔적 | 원인 분석 |
| unknown | campaign id만 있거나 source 불명 | 증액 판단 제외 |

Google Ads conversion upload 후보는 high tier 없이는 승인안에 올리지 않는다.

## Campaign Channel Rule

| channel | 처리 |
|---|---|
| SEARCH | 브랜드/검사권 검색은 별도 보수 관찰 |
| PERFORMANCE_MAX | 내부 confirmed 매칭 없으면 증액 금지 |
| DISPLAY | view-through와 click confirmed를 분리 |
| SHOPPING | product/order mapping 확인 전 증액 금지 |
| UNKNOWN | 비용/매출 판단 보류 |

## View-through Rule

GDN view-through는 purchase ROAS와 섞지 않는다.

1. view-through conversion은 보조 성과로 별도 표기한다.
2. 내부 confirmed ROAS 분자에는 view-through만으로 주문을 승격하지 않는다.
3. GDN 예산 판단은 click evidence와 view-through 보조성과를 따로 본다.
4. view-through가 많아도 confirmed order 매칭이 없으면 증액 근거가 아니다.

## Primary Change Rule

`구매완료` action `7130249515`를 Primary에서 내리는 것은 Red Lane이다.

승인 전에는 아래까지만 가능하다.

1. action id, label, category, primary status read-only 확인.
2. `Conv. value` gap 기여도 계산.
3. 변경 후 예상 영향 문서화.
4. 승인 요청서 작성.

실제 변경은 TJ님이 Google Ads UI 또는 mutation 권한으로 명시 승인한 뒤만 가능하다.

## Offline Conversion Candidate Rule

Google Ads confirmed purchase 전송 후보는 아래 조건을 모두 만족해야 승인안에 올라간다.

```text
payment_status == confirmed
site == biocom
order_label == production_order
amount > 0
click_id in [gclid, gbraid, wbraid] present
conversion_time known
order_id or transaction_id present
duplicate_guard == pass
already_sent_to_google_ads != present
approval_required == true
```

하나라도 실패하면 `send_candidate=N`이다.

## Conversion Adjustment Rule

취소/환불을 Google Ads conversion adjustment로 보내는 것은 Red Lane이다.

승인안에는 아래가 있어야 한다.

1. 원 전환 order id 또는 transaction id.
2. 취소/환불 금액.
3. retraction/restatement 구분.
4. Google Ads 기존 전환 존재 여부.
5. 내부 원장 취소/환불 source와 freshness.

## Block Reason

| 조건 | block_reason |
|---|---|
| read-only phase | `read_only_phase` |
| approval 없음 | `approval_required` |
| NPay known label | `known_npay_label` |
| Primary NPay label | `primary_bid_signal_is_npay` |
| click id 없음 | `missing_google_click_id` |
| order id 없음 | `missing_order_id` |
| confirmed 아님 | `not_confirmed` |
| duplicate guard 미실행 | `duplicate_guard_missing` |
| 이미 전송됨 | `already_sent` |
| GTM snapshot stale | `gtm_snapshot_stale` |
| source freshness stale | `source_stale` |
| campaign mismatch | `campaign_id_mismatch` |
| view-through only | `view_through_only` |

## Path B HOLD Reducer

GDN/Google Ads confirmed purchase 보정 작업에서 Path B 결과가 HOLD이면 바로 전송 승인 대기로 넘기지 않는다.

특히 `missing_google_click_id`, `missing_click_bridge`, `ambiguous_candidates`는 아래 Green follow-up을 먼저 수행한다.

| HOLD 원인 | 먼저 수행할 Green follow-up | 전송 판단 |
|---|---|---|
| `missing_click_bridge` | order bridge와 paid click intent ledger join dry-run, click storage/source audit, same-browser preservation 설계 | `send_candidate=N` 유지 |
| `missing_google_click_id` | URL/storage/dataLayer click source 확인, Google click id 보존 경로 점검 | Google Ads upload 후보 아님 |
| `ambiguous_candidates` | 1d/7d/30d lookback 분리, exact session match와 time-window-only 후보 분리, confidence rule 보강 | ambiguous는 `do_not_send` |
| `workspace_capacity` | GTM workspace list, old Preview workspace backup/cleanup plan, live version unchanged 확인 | Preview 재시도 전 write flag ON 금지 |

Path B `identity_only_quarantine` row는 실패가 아니다. 주문과 identity bridge는 보존하되, Google click bridge가 확인되기 전까지 전송 후보로 승격하지 않는다.

Time-window-only click 후보는 Google Ads confirmed_purchase 전송 근거로 쓰지 않는다. client id, GA session id, local session id, 또는 저장된 click id처럼 결정적 연결키가 있어야 한다.

## GTM Workspace Lifecycle Rule

GDN/Path B/Google Ads tracking 작업에서 GTM Preview를 쓰면 공통 `GTM Workspace Hygiene Rule`을 따른다.

1. Default Workspace는 사용하지 않는다.
2. 새 작업은 live latest 기준 fresh workspace에서 시작한다.
3. Preview 시작 전 workspace capacity preflight를 실행한다.
4. fresh workspace 생성 성공 전 VM Cloud write flag를 ON으로 바꾸지 않는다.
5. old Preview workspace cleanup 전 JSON backup을 남긴다.
6. cleanup 후 live version unchanged를 확인한다.
7. workspace reuse는 fresh create 실패 시 fallback으로만 검토한다.
8. submit, create_version, publish는 별도 승인 전 금지다.
9. Preview 성공은 Production publish 승인으로 해석하지 않는다.

## 운영 판단 룰

1. Google Ads 전체 OFF는 측정 오염만으로 단정하지 않는다.
2. 증액은 내부 confirmed ROAS가 닫히기 전까지 금지한다.
3. PMax/GDN은 confirmed 매칭이 약하면 감액 또는 유지 관찰 후보로 둔다.
4. 검색 의도가 강한 캠페인은 별도 보수 관찰한다.
5. 전환 신호 교체 후 최소 7~14일 학습/성과를 관찰한다.
