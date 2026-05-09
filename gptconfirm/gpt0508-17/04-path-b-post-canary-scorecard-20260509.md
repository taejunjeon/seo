# Path B post-canary scorecard

작성 시각: 2026-05-09 22:34 KST

## 한 줄 결론

Path B storage canary는 안전성 기준을 통과했지만, 전송 후보 기준은 click bridge 부재 때문에 HOLD다.

## Scorecard

- `vm_cloud_storage_deployed`: PASS.
- `schema_bootstrap_passed`: PASS.
- `flag_off_smoke_passed`: PASS.
- `controlled_write_one_row_passed`: PASS.
- `gtm_order_complete_publish_executed`: PASS.
- `gtm_live_rollback_verified`: PASS.
- `write_flag_off_cleanup_verified`: PASS.
- `raw_stored_zero`: PASS.
- `path_b_platform_send_zero`: PASS.
- `row_count_within_cap`: PASS.
- `identity_hash_fill_rate`: PASS, 2/2.
- `order_hash_fill_rate`: PASS, 2/2.
- `client_session_fill_rate`: PASS, 2/2.
- `click_hash_fill_rate`: HOLD, 0/2.
- `send_candidate_false`: PASS.
- `actual_send_candidate_false`: PASS.
- `production_publish_ready`: HOLD.
- `google_ads_upload_ready`: HOLD.

## Overall verdict

Storage canary: PASS.

Attribution send readiness: HOLD.

현재 Path B bridge 진척률:

- Preview/no-send 기준: 100%.
- VM Cloud storage canary 기준: PASS.
- Google Ads confirmed_purchase send 기준: HOLD.
- 전체 운영 반영 기준: 약 99%.
