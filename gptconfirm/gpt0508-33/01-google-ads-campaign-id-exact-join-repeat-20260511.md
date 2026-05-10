# Google Ads campaign_id exact/strong join 반복 (gpt0508-33)

작성 시각: 2026-05-10 21:45:30 KST
Lane: Green read-only / dry-run / 로컬 산출물

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - frontrule.md
  required_context_docs:
    - gptconfirm/gpt0508-32/00-result-report.md
    - gdn/google-ads-campaign-id-coverage-extension-20260511.md
    - data/google-ads-campaign-id-join-candidates-20260510.json
    - data/path-b-order-bridge-paid-click-join-dry-run-20260510.json
    - data/path-b-real-paid-click-actual-order-preview-result-20260510.json
    - data/confirmed-purchase-builder-same-window-input-20260510.json
  lane: Green
  allowed_actions:
    - VM dashboard read-only status/dashboard 조회
    - BigQuery archive+daily union read-only 재계산
    - 로컬 JSON/Markdown 산출물 작성
    - campaign_id exact/strong join 반복 실행
    - ConfirmedPurchasePrep blocker breakdown 분석
    - gptconfirm/gpt0508-33 패키징
    - scoped commit/push
    - 기존 텔레그램 완료 메시지 발송
  forbidden_actions:
    - Google Ads confirmed_purchase upload
    - Google Ads conversion action 변경
    - GA4/Meta/TikTok/Naver 신규 전송
    - Meta CAPI actual Test Events 호출
    - GTM Production publish
    - frontend 구현 착수
    - 운영DB write
    - VM write/restart/deploy
    - send_candidate=true
    - actual_send_candidate=true
    - NPay click/count/add_payment_info 를 purchase로 승격
    - raw email/phone/member_code/order/payment 저장 또는 logging
    - time-window-only attribution을 예산 판단에 사용
  source_window_freshness_confidence:
    source: data/google-ads-campaign-id-join-candidates-20260510.json + Path B order bridge dry-run + Path B real paid-click evidence + paid_click_intent ledger artifacts
    window: Google Ads click_view 2026-04-11~2026-05-10 KST · Path B order bridge 1d/7d/30d ending 2026-05-09 · ConfirmedPurchasePrep 2026-04-11~2026-05-10 KST
    freshness: 2026-05-10 21:45:30 KST 생성. join-candidates 18:41 KST · path-b dry-run 09:08 KST · path-b real evidence 01:35 KST · ConfirmedPurchasePrep 18:35 KST
    confidence: 0.92
```

## 5줄 결론

1. campaign_id exact/strong join을 4 evidence(gclid+click_view, Path B order bridge, Path B real evidence, paid_click_intent same-order)로 반복했다.
2. 새 budget-usable match는 0건이다. 기존 31건과 missing 2,121건이 그대로다.
3. matched revenue ₩761만, exact match rate 1.44%로 직전 대비 변동 없다.
4. UTM hint·time-window-only는 금지 유지. send_candidate/actual_send_candidate 모두 false.
5. HOLD reducer로 missing 2,121건의 blocker를 5개로 더 세분화했고, 다음 액션은 ConfirmedPurchasePrep 입력 갱신 시 같은 join 반복이다.

## 1. 왜 다시 돌렸는가

gpt0508-32에서 campaign_id missing 2,121건 HOLD가 남았다. exact/strong evidence를 다시 모아 새 budget-usable row가 생겼는지 확인하고, 안 생겼으면 HOLD 사유를 더 잘게 분류해야 한다. Google Ads upload/send/conversion action 변경은 본 sprint에서도 금지다.

## 2. 입력 산출물

| 입력 | 경로 | 역할 |
|---|---|---|
| campaign_id 후보 | `data/google-ads-campaign-id-join-candidates-20260510.json` | confirmed 2,152건 + 31 매칭 |
| Path B order bridge dry-run | `data/path-b-order-bridge-paid-click-join-dry-run-20260510.json` | 1d/7d/30d exact session click rows |
| Path B real paid-click evidence | `data/path-b-real-paid-click-actual-order-preview-result-20260510.json` | 실제 Google ad click → order-complete bridge |
| paid_click_intent ledger | `data/paid-click-intent-ledger-canary-early-audit-20260508.json` 등 | same-order exact bridge 후보 |
| ConfirmedPurchasePrep same-window 입력 | `data/confirmed-purchase-builder-same-window-input-20260510.json` | 입력 freshness 점검 |

## 3. evidence 별 결과

### 3.1 gclid exact + Google Ads click_view

| 항목 | 값 |
|---|---|
| matched_orders | 31 |
| new_budget_usable_matches | 0 |
| click_view 윈도우 | 30일 |
| 비고 | unique_gclid 31, click_view matched_gclids 31. 같은 30일 윈도우에서 새 gclid row 없음. |

### 3.2 gbraid · wbraid exact

ConfirmedPurchasePrep order-level click_id_type 분포에 gbraid/wbraid row 없음. 새 매칭 0.

### 3.3 Path B order bridge exact click id

| lookback | time_window_click_rows | exact_session_click_rows |
|---|---|---|
| 1d | 1,267 | 0 |
| 7d | 2,169 | 0 |
| 30d | 2,169 | 0 |

`client_id` / `ga_session_id` / `local_session_id_hash` 셋 다 ledger에 동일 키로 묶이는 click row가 없다. budget-usable 0.

### 3.4 Path B real paid-click evidence

real Google ad click → order-complete page bridge는 PASS이지만 `virtual_account_deposit_done=false`, `confirmed_paid_purchase=false`. ledger도 `would_store=false`. 예산 ROAS row 0.

### 3.5 paid_click_intent same-order exact

confirmed payment와 같은 order로 묶이는 exact row 0. time-window-only 후보 2건은 금지 유지(send_candidate 승격 안 함).

### 3.6 UTM campaign hint (금지 — diagnostic only)

missing 2,121건 중 UTM 보유 1,081건. 분포는 `naverbrandsearch_*` 157, `meta_*` 다수, `topbanner_*` 59, `newmember_coupon` 29. google 채널을 명시한 UTM은 0건. campaign_id 확정 불가.

### 3.7 time-window-only (금지)

광고 클릭과 주문 시간이 가까운 row만으로 campaign_id에 붙이는 행위는 본 sprint도 금지. row 0.

## 4. 결과 요약

| 지표 | 값 | gpt0508-32 대비 |
|---|---|---|
| campaign_id_matched_count | 31 | 0 |
| campaign_id_missing_count | 2,121 | 0 |
| exact_match_rate | 0.0144 | 0 |
| matched_revenue (KRW) | ₩761만 | 0 |
| upload_candidate_count | 0 | 0 |
| send_candidate | false | unchanged |
| actual_send_candidate | false | unchanged |
| budget_decision | `HOLD_except_exact_click_id_floor_rows` | unchanged |

## 5. HOLD reducer 세분화

| blocker | 영향 | budget 사용 | 다음 Green 액션 |
|---|---|---|---|
| order-level gclid/gbraid/wbraid 부재 | 2,121 (missing 100%) | 금지 | 다음 same-window 입력 갱신 시 click_view exact join 반복 |
| Path B exact session click 부재 | 1d/7d/30d 모두 0 | 금지 | controlled traffic preview ledger 누적 시 재호출 (현재 would_store=false) |
| paid_click_intent ↔ confirmed payment same-order exact 부재 | 0 매칭 | 금지 | order_no_hash / hashed identity bridge 정렬 재검토 |
| UTM hint만 존재 | 1,081건 | 금지 | diagnostic only 유지 |
| time-window-only 후보 | 2건 | 금지 | exact 없으면 영구 금지 |

## 6. 검증 / 금지 재확인

- read-only / no-send / no-deploy / no-publish.
- send_candidate=false, actual_send_candidate=false, upload_candidate_count=0.
- Google Ads conversion action 변경 없음.
- GA4 purchase event를 actual purchase로 승격 안 함.
- NPay click/count/add_payment_info를 purchase로 승격 안 함.
- raw email/phone/member_code/order/payment 저장/로깅 없음.
- time-window-only attribution은 예산 판단에 사용 안 함.

## 7. Verdict

`HOLD_BUDGET_DECISION_NO_NEW_BUDGET_USABLE_MATCH_GREEN_HOLD_REDUCER_DETAILED`

산출 JSON: `data/google-ads-campaign-id-exact-join-repeat-20260511.json`
