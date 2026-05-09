# Path B click bridge diagnosis

작성 시각: 2026-05-10 00:11 KST

## 결론

현재 click bridge는 `HOLD`입니다. 이유는 Path B canary row 2건이 paid_click_intent row와 세션 기준으로 이어지지 않았기 때문입니다.

## 현재 점수표

- `vm_cloud_storage_deployed`: PASS.
- `schema_bootstrap_passed`: PASS.
- `identity_order_session_bridge`: PASS.
- `click_bridge_direct_present`: HOLD, 0/2.
- `paid_click_exact_session_join`: HOLD, 0/2.
- `time_window_only_rejected`: PASS.
- `send_candidate_false`: PASS.
- `actual_send_candidate_false`: PASS.
- `google_ads_upload_candidate_zero`: PASS.
- `raw_stored_zero`: PASS.
- `platform_send_zero`: PASS.

## 진단 결과

### A. paid_click_intent와 session join 가능

현재 2건 기준 NO.

- client_id match: 0.
- ga_session_id match: 0.
- local_session hash match: 0.
- 1d/7d/30d exact session click match: 0.

### B. storage key mismatch

현재 증거로는 NOT PROVEN.

- paid_click_intent tag는 `bi_paid_click_intent_v1`에 click evidence를 저장합니다.
- Path B 주문완료 tag도 `bi_paid_click_intent_v1`을 읽습니다.
- key 이름 자체는 맞습니다.

### C. checkout/order_complete storage 유실

현재는 UNVERIFIED.

canary row 2건은 주문완료 화면에서 row 저장은 됐지만, paid click에서 시작한 같은 브라우저 흐름이라는 증거가 없습니다. 따라서 storage가 유실된 것인지, 애초에 storage가 없었던 것인지는 아직 분리되지 않았습니다.

### D. 실제 paid click test 필요

아직 HOLD.

실제 광고 클릭/실제 결제 테스트는 비용과 외부 플랫폼 영향이 있으므로 바로 진행하지 않습니다. 먼저 TEST click id same-browser preservation으로 브라우저 저장과 주문완료 추출을 확인해야 합니다.

### E. 후보 과다/ambiguous

time-window-only 후보는 과다합니다.

- 1d만 봐도 각 주문 row당 799~819 unique click hash 후보가 있습니다.
- 30d는 1369~1370 unique click hash 후보입니다.
- time window만으로 붙이면 사실상 임의 attribution입니다.

## root cause 판단

가장 가능성이 높은 원인은 `missing paid-click-originated session`입니다.

현재 canary row는 주문완료 화면에서 직접 또는 일반 세션으로 생성된 row에 가깝습니다. paid_click_intent ledger에 같은 client/session/local session click이 없기 때문에 Google Ads click bridge로 승격하지 않습니다.

## 현재 row 처리

- `identity_only_quarantine` 유지.
- `send_candidate=false` 유지.
- `actual_send_candidate=false` 유지.
- Google Ads upload candidate 0 유지.

## 다음 확인

1. TEST gclid로 상품상세 진입.
2. 상품상세에서 `bi_paid_click_intent_v1` 생성 확인.
3. 같은 browser에서 checkout/order complete 이동.
4. 주문완료 Path B tag가 storage click id를 읽는지 확인.
5. platform send 0, would_send=false 확인.

이 확인 전까지 실제 전송은 계속 NO입니다.
