```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - data/!channelfunnel.md
    - total/!total-current.md
  required_context_docs:
    - gdn/confirmed-purchase-prep-canary-interim-20260508.md
    - gdn/path-c-member-code-attribution-design-20260508.md
  lane: Green
  allowed_actions:
    - operational PG read-only SELECT
    - Attribution VM SQLite read-only SELECT over SSH
    - local JSON/Markdown artifact write
    - no-send dry-run analysis
  forbidden_actions:
    - production DB write/schema migration
    - backend deploy or PM2 restart
    - GTM/Imweb publish
    - GA4/Google Ads/Meta/TikTok/Naver platform send
    - Google Ads conversion action or upload
  source_window_freshness_confidence:
    source: "operational PostgreSQL public.tb_iamweb_users + live Attribution VM paid_click_intent_ledger"
    window: "2026-05-07 23:01:00 KST ~ 2026-05-08 17:23:01 KST"
    freshness: "PG max paid_at 2026-05-08T07:58:22.000Z; VM ledger max received_at 2026-05-08T08:22:44.416Z"
    confidence: 0.93
```

# Canary effect meaningful dry-run

작성 시각: 2026-05-08 17:23:01 KST

## 한 줄 결론

운영 PG 기반 새 결제완료 input은 생성됐지만, live paid_click_intent_ledger 직접 source는 현재 주문과 클릭을 1:1로 이어주는 결정적 연결키가 없어 canary 구매 매칭 개선 효과 비교에는 아직 의미가 없다.

## Window

| item | value |
| --- | --- |
| start_kst | 2026-05-07 23:01:00 KST |
| end_kst | 2026-05-08 17:23:01 KST |
| start_utc | 2026-05-07T14:01:00.000Z |
| end_utc | 2026-05-08T08:23:01.454Z |
| elapsed_hours | 18.4 |
| full_24h_reached | NO |

## 운영 PG 기반 새 dry-run input

| metric | value |
| --- | --- |
| candidate_orders_all_status | 64 |
| candidate_orders_confirmed_positive | 52 |
| homepage_count | 48 |
| npay_actual_count | 4 |
| confirmed_positive_value | 12095895 |
| member_code_present_orders | 52 |
| send_candidate | 0 |

## paid_click_intent_ledger 직접 source

| metric | value |
| --- | --- |
| ledger_rows | 709 |
| unique_click_id_hash | 428 |
| unique_client_id | 318 |
| unique_ga_session_id | 407 |
| debug_test_preview_query_key_rows | 0 |
| send_candidate | 0 |

## 직접 source 결합 가능성

| metric | value |
| --- | --- |
| deterministic_bridge_ready | NO |
| ledger_has_member_code_hash_column | NO |
| orders_with_any_prior_click | 52 |
| orders_with_single_prior_click | 0 |
| orders_with_multiple_prior_clicks | 52 |
| median_prior_click_candidates | 329 |
| p90_prior_click_candidates | 644 |
| max_prior_click_candidates | 691 |

## 해석

- 운영 PG 기반 새 input은 생성 가능하다. 결제완료 주문 base는 canary window 기준으로 갱신됐다.
- 다만 현재 live ledger schema에는 주문번호, member_code_hash, PG 주문의 client_id/ga_session_id가 없어서 order-level 효과 비교는 아직 성립하지 않는다.
- ledger 직접 source는 capture health와 click-id 보존량 측정에는 의미가 있다. confirmed purchase uplift 측정에는 P1-1/P1-2의 deterministic bridge가 필요하다.

## Guardrails

```text
No-send verified: YES
No-write verified: YES (local artifact write only)
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
Raw member_code output: 0
```

## 후보 샘플

| order_hash | method | value | conversion_time_kst | member_code_present | prior_clicks_30d | ambiguity | send_candidate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| b223bfc7bc5e429fab2feec36150cbec | homepage | 245000 | 2026-05-07 23:19:25 KST | Y | 12 | multiple | N |
| 30a6f36ef78cd62b7c2c4a8eae4512dd | homepage | 245000 | 2026-05-07 23:20:55 KST | Y | 16 | multiple | N |
| d88abb106b9723891247f25320b6bfa5 | homepage | 422523 | 2026-05-07 23:24:44 KST | Y | 18 | multiple | N |
| d9e28d6e7001bbf8dd3cebcaea9b4dbd | homepage | 106067 | 2026-05-07 23:48:53 KST | Y | 46 | multiple | N |
| 236a4e4c9a4436aa86f7c740677e6b55 | homepage | 52136 | 2026-05-08 00:01:57 KST | Y | 52 | multiple | N |
| a310e5e72267bd5320f8368fe2c06ff3 | homepage | 245000 | 2026-05-08 00:44:13 KST | Y | 62 | multiple | N |
| 189386352d794e36f60f82a8ddb2fe5b | homepage | 245000 | 2026-05-08 00:45:02 KST | Y | 64 | multiple | N |
| 3515f14b49048c34a45225a820639dfb | homepage | 245000 | 2026-05-08 00:48:11 KST | Y | 66 | multiple | N |
| c1a92a6d682fb3f9c7641cac3633b24b | homepage | 245000 | 2026-05-08 00:48:45 KST | Y | 66 | multiple | N |
| f41b675910cd5a6fb30899f7ad6abc31 | homepage | 240000 | 2026-05-08 00:56:55 KST | Y | 66 | multiple | N |
| 1ebbace2b9459102b70e8ea2c9e37c10 | npay_actual | 68400 | 2026-05-08 01:18:45 KST | Y | 74 | multiple | N |
| 8e84dc3e872b308f6fee46a124e9fa8b | homepage | 245000 | 2026-05-08 01:19:27 KST | Y | 74 | multiple | N |
| 7dda4d3dfafec37bd0e1c6df254d33c6 | homepage | 278679 | 2026-05-08 01:45:42 KST | Y | 77 | multiple | N |
| 0fa3a3e9364da2baef9ab19e4b16507a | homepage | 188000 | 2026-05-08 02:39:22 KST | Y | 107 | multiple | N |
| f615818a520b8579d0deca4503274617 | npay_actual | 116000 | 2026-05-08 03:05:58 KST | Y | 115 | multiple | N |
| c00a1f3d9d4c587ee080e8a133d28fe0 | homepage | 245000 | 2026-05-08 06:14:32 KST | Y | 189 | multiple | N |
| 6195c0708ce6014b034391f79186e1c7 | homepage | 295020 | 2026-05-08 06:30:25 KST | Y | 198 | multiple | N |
| e43d619c27c468e44f9883c9af02a2ea | homepage | 106286 | 2026-05-08 07:11:05 KST | Y | 230 | multiple | N |
| 56fe3a35d4ed37ba613ed7aa209d9c59 | homepage | 245000 | 2026-05-08 08:07:06 KST | Y | 279 | multiple | N |
| 218ee5a00f253c6b9fbff15edc4f4a63 | homepage | 99000 | 2026-05-08 08:34:13 KST | Y | 294 | multiple | N |

## 다음 판단

1. `data/!channelfunnel` Phase2-Sprint2는 `PG input 갱신 완료 / effect HOLD`로 바꾸는 것이 맞다.
2. `paid_click_intent_ledger` 직접 source는 ConfirmedPurchasePrep input이 아니라 별도 health source로 두고, order-level join은 `member_code_hash` bridge 이후 다시 측정한다.
3. 24h 도달 후 같은 스크립트를 재실행해 ledger capture health 숫자만 갱신한다. effect/uplift는 deterministic bridge 전까지 0 또는 HOLD로 표시한다.
