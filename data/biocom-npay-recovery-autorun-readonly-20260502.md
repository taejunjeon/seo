# Biocom NPay Recovery Autorun Read-only Report (2026-05-02)

작성 시각: 2026-05-02 01:50 KST
site: `biocom`
mode: `read_only` / `dry_run` / `no_send` / `no_write`
window_kst: `2026-04-25 01:04:09 KST` ~ `2026-05-02 01:04:09 KST`
Primary source: VM SQLite `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3`, table `npay_intent_log`
Order source: operational Postgres `public.tb_iamweb_users` read-only SELECT
BigQuery target: `hurdlers-naver-pay.analytics_304759974`
Freshness: VM dry-run generated 2026-05-02 01:48 KST, BigQuery guard attempted 2026-05-02 01:49 KST, GTM live read-only checked 2026-05-02 01:06 KST
Confidence: 82%

## 10초 요약

TJ님 승인 범위 안에서 VM SQLite `npay_intent_log` read-only 접근을 열고 같은 7일 window dry-run을 재실행했다.

VM primary 기준 live intent는 419건이고 confirmed NPay 주문 34건 중 A급 strong production 후보가 5건 생겼다. 하지만 BigQuery guard가 `bigquery.jobs.create` 권한 부족으로 닫히지 않아 이 5건은 모두 `already_in_ga4=unknown` 상태다.

따라서 이번 run에서도 실제 전송 후보는 0건이다. write, send, publish, deploy, NPay click은 모두 0건이다.

## Auditor Verdict

```text
Auditor verdict: NEEDS_HUMAN_APPROVAL
Phase: autorun_readonly_dry_run
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
Candidate guard verified: YES
Numbers current: YES
Unrelated dirty files excluded: YES
New executable send path added: NO
Actual network send observed: NO
Next gate: TJ님 approval. Manual BigQuery robust guard produced 5 robust_absent approval candidates.
```

## 1. 자동으로 진행한 것

| 작업 | 결과 |
|---|---|
| VM SQLite `npay_intent_log` read-only 접근 | 완료. biocom 전체 424건, window 내 live intent 419건 |
| 운영 Postgres confirmed NPay 주문 SELECT | 완료. 34건 |
| 같은 7일 window dry-run 재실행 | 완료. VM primary source 기준 |
| BigQuery robust guard 재시도 | blocked. `bigquery.jobs.create` 권한 없음 |
| candidate 분류 | 완료. A/B/ambiguous/purchase_without_intent/clicked_no_purchase 분리 |
| approval draft | 자동 guard blocked 단계에서는 생성 안 함. TJ님 manual result 수신 후 `data/biocom-npay-recovery-ga4-mp-approval-draft-20260502.md` 생성 완료 |
| eval log | 완료. `data/biocom-npay-recovery-eval-log-20260502.yaml` |

## 2. Source 상태

| source | 상태 | 근거 | confidence |
|---|---|---|---|
| VM SQLite `npay_intent_log` | OK | SSH `taejun@34.64.104.94` 후 `sudo -u biocomkr_sns` read-only SELECT 성공 | 0.9 |
| operational Postgres `tb_iamweb_users` | OK | dry-run에서 confirmed NPay orders 34건 SELECT 성공 | 0.86 |
| BigQuery raw export | blocked | `seo-aeo-487113`, `hurdlers-naver-pay` 양쪽 job project에서 `bigquery.jobs.create` 권한 없음 | 0.2 |
| GTM API | OK | published version `139`, `npay_intent_only_live_20260427` read-only 조회 성공 | 0.92 |

## 3. 최신 7일 Dry-run Summary

| metric | value |
|---|---:|
| live_intent_count | 419 |
| confirmed_npay_order_count | 34 |
| strong_match | 10 |
| strong_match_a | 7 |
| strong_match_b | 3 |
| ambiguous | 5 |
| purchase_without_intent | 19 |
| clicked_no_purchase | 304 |
| intent_pending | 105 |
| dispatcher_candidate | 0 |
| already_in_ga4 present | 1 |
| already_in_ga4 unknown | 33 |
| already_in_ga4 robust_absent | 0 |
| already_in_ga4 absent | 0 |
| test_order_blocked | 1 |

## 4. A급 Production 후보

아래 5건은 A급 production strong match지만, BigQuery guard가 `unknown`이라 send 후보가 아니다.

| order_number | channel_order_no | value | amount_match_type | score | gap | time_gap_min | identity |
|---|---|---:|---|---:|---:|---:|---|
| `202604280487104` | `2026042865542930` | 35000 | `final_exact` | 80 | 28 | 0.3 | client_id + ga_session_id |
| `202604285552452` | `2026042867285600` | 496000 | `final_exact` | 70 | 18 | 1.4 | client_id + ga_session_id |
| `202604303307399` | `2026043034982320` | 496000 | `final_exact` | 70 | 18 | 1.3 | client_id + ga_session_id |
| `202604309992065` | `2026043040116970` | 35000 | `final_exact` | 80 | 28 | 0.7 | client_id + ga_session_id |
| `202605011540306` | `2026050158972710` | 496000 | `final_exact` | 80 | 28 | 0.7 | client_id + ga_session_id |

`202604302383065`은 기존 GA4 MP 제한 테스트 주문이라 `already_in_ga4=present`로 차단했다.

`202604309594732`은 하네스 RULES의 수동 테스트 주문 예시와 일치하므로 `manual_test_order`로 차단했다.

## 5. Block Reason 분포

| block_reason | count |
|---|---:|
| `purchase_without_intent` | 19 |
| `not_a_grade_strong` | 27 |
| `already_in_ga4_unknown` | 33 |
| `ambiguous` | 5 |
| `already_in_ga4` | 1 |
| `manual_test_order` | 1 |

## 6. Identity / Amount 분포

| metric | value |
|---|---:|
| client_id_present | 15 / 34 |
| ga_session_id_present | 15 / 34 |
| amount_match_type `final_exact` | 9 |
| amount_match_type `shipping_reconciled` | 1 |
| amount_match_type `cart_contains_item` | 1 |
| amount_match_type `none` | 4 |
| amount_match_type `unknown` | 19 |

## 7. BigQuery Guard 결과

조회 대상은 confirmed NPay 주문 34건의 `order_number`와 `channel_order_no` 총 68개 ID다.

| 항목 | 결과 |
|---|---|
| query scope | `ecommerce.transaction_id`, `event_params.transaction_id`, 전체 `event_params` value, daily `events_*`, intraday `events_intraday_*` |
| project/dataset | `hurdlers-naver-pay.analytics_304759974` |
| result | blocked |
| first error | `Access Denied: Project seo-aeo-487113: User does not have bigquery.jobs.create permission in project seo-aeo-487113.` |
| retry error | `Access Denied: Project hurdlers-naver-pay: User does not have bigquery.jobs.create permission in project hurdlers-naver-pay.` |
| present | 0 |
| robust_absent | 0 |
| unknown | 68 |

판정: BigQuery guard가 닫히지 않았으므로 어떤 주문도 send 후보로 올릴 수 없다.

## 8. Payload Preview / Approval Draft

자동 BigQuery guard blocked 시점에는 approval draft를 생성하지 않았다.

2026-05-02 17:55 KST에 TJ님 manual BigQuery result가 들어온 뒤에는 A급 production 후보 5건이 모두 `robust_absent`로 정규화됐다. 이에 따라 approval draft와 payload preview를 별도 문서로 생성했다.

문서: `data/biocom-npay-recovery-ga4-mp-approval-draft-20260502.md`

주의: approval draft가 생겼지만 실제 GA4 MP, Meta CAPI, TikTok Events API, Google Ads 전송은 모두 막는다. 전송은 TJ님이 명시적으로 `YES` 승인하기 전까지 0건이다.

## 9. 실행 명령

VM dry-run:

```bash
ssh taejun@34.64.104.94 'sudo -n -u biocomkr_sns bash -lc '"'"'
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  cd /home/biocomkr_sns/seo/repo/backend
  NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
    node_modules/.bin/tsx scripts/npay-roas-dry-run.ts -- \
      --start=2026-04-25T01:04:09+09:00 \
      --end=2026-05-02T01:04:09+09:00 \
      --ga4-present=202604302383065 \
      --test-order=202604309594732 \
      --test-order-label=manual_test_order \
      --format=json
'"'"'
```

BigQuery guard:

```bash
cd backend
npm exec tsx scripts/npay-ga4-robust-guard.ts -- \
  --ids-file=/tmp/biocom-npay-lookup-ids-vm-20260502.txt \
  --start-suffix=20260425 \
  --end-suffix=20260502 \
  --output=/tmp/biocom-npay-ga4-robust-guard-vm-20260502.json
```

## 10. 금지선 확인

| 항목 | 결과 |
|---|---|
| 운영 DB write | 0 |
| local DB actual import/apply | 0 |
| `match_status` update | 0 |
| GA4 Measurement Protocol send | 0 |
| Meta CAPI send | 0 |
| TikTok Events API send | 0 |
| Google Ads conversion send | 0 |
| GTM publish/workspace 생성 | 0 |
| Imweb header/footer live 삽입 | 0 |
| backend deploy | 0 |
| 운영 endpoint 추가/변경 | 0 |
| NPay 버튼 click | 0 |
| 결제 시도 | 0 |
| wrapper 수정 | 0 |

## 11. 다음 TJ 결정

2026-05-02 17:55 KST manual guard 결과 수신 후 다음 결정은 GA4 MP 제한 테스트 승인 여부다.

`YES/NO: biocom order_number=202604309992065 1건만 GA4 MP purchase 제한 테스트를 진행할까요? Meta/TikTok/Google Ads 전송, GTM publish, backend deploy, DB write, NPay click은 계속 금지입니다.`

## 12. Manual Run Packet Note

2026-05-02 02:00 KST 기준 BigQuery permission 대기 중이며, manual run packet을 `data/biocom-ga4-robust-guard-manual-run-20260502.md`와 `data/biocom-ga4-robust-guard-lookup-ids-20260502.txt`로 별도 생성했다.

## 13. Manual Guard Result Note

2026-05-02 17:55 KST 기준 TJ님이 BigQuery 콘솔에서 manual robust guard를 실행했다.

결과: A급 production 후보 5건 모두 `order_number_events=0`, `channel_order_no_events=0`으로 `robust_absent`다. 5번째 행의 `robust_absnt`는 오타로 보고 `robust_absent`로 정규화했다.

결과 문서: `data/biocom-ga4-robust-guard-manual-result-20260502.md`

Approval draft: `data/biocom-npay-recovery-ga4-mp-approval-draft-20260502.md`

주의: manual guard 결과로 approval draft 후보는 생겼지만, 실제 GA4 MP/Meta/TikTok/Google Ads 전송은 0건이다. TJ님이 명시적으로 `YES` 승인하기 전에는 계속 전송 금지다.

## 14. Limited Send Result Note

2026-05-02 18:04 KST에 TJ님 승인 범위대로 `202604309992065` 1건만 GA4 MP purchase 제한 테스트로 전송했다.

결과: debug endpoint HTTP 200 / validationMessages 0건, collect endpoint HTTP 204.

결과 문서: `data/biocom-npay-ga4-mp-limited-test-result-20260502.md`

주의: Meta CAPI, TikTok Events API, Google Ads conversion 전송은 0건이다. 운영 DB write, `match_status` 업데이트, GTM publish, backend deploy, Imweb 수정, NPay click도 0건이다.
