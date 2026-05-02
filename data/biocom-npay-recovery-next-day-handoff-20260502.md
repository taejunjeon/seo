# Biocom NPay Recovery Next-day Handoff (2026-05-02)

작성 시각: 2026-05-02 02:00 KST
site: `biocom`
window_kst: `2026-04-25 01:04:09 KST` ~ `2026-05-02 01:04:09 KST`
상태: GA4 MP 1건 제한 테스트 완료. BigQuery 즉시 확인은 no rows. export 지연 재조회 대기.

## 10초 요약

오늘은 VM SQLite primary dry-run과 TJ님 manual BigQuery guard를 거쳐 GA4 MP 1건 제한 테스트까지 완료했다.

전송한 주문은 `202604309992065` 1건이다. 2026-05-02 18:18 KST 즉시 BigQuery 확인은 "표시할 데이터 없음"이었다. 현재 판정은 실패가 아니라 `WAIT_EXPORT_LATENCY`다.

## 오늘 완료된 것

| 항목 | 결과 |
|---|---|
| VM SQLite `npay_intent_log` read-only 접근 | 완료 |
| 운영 Postgres confirmed NPay 주문 SELECT | 완료 |
| 7일 window dry-run | 완료 |
| live_intent_count | 419 |
| confirmed_npay_order_count | 34 |
| strong_match | 10 |
| strong_match_a | 7 |
| strong_match_b | 3 |
| ambiguous | 5 |
| purchase_without_intent | 19 |
| clicked_no_purchase | 304 |
| intent_pending | 105 |
| send_candidate | 0 |

## Manual Result 수신

BigQuery service account 권한은 여전히 막혀 있지만, TJ님이 BigQuery 콘솔에서 manual SQL을 실행했다.

manual 결과:

| 결과 | count |
|---|---|
| `present` | 0 |
| `robust_absent` | 5 |
| `unknown` | 0 |

5번째 행의 `robust_absnt`는 오타로 보고, event count 0/0 기준 `robust_absent`로 정규화했다.

## Limited Send Result

| 항목 | 결과 |
|---|---|
| order_number | `202604309992065` |
| channel_order_no | `2026043040116970` |
| event_id | `NPayRecoveredPurchase_202604309992065` |
| debug endpoint | HTTP 200, validationMessages 0 |
| collect endpoint | HTTP 204 |
| sent_at_kst | 2026-05-02 18:04 KST |

## Post-send BigQuery 확인

| 항목 | 결과 |
|---|---|
| checked_at_kst | 2026-05-02 18:18 KST |
| result | 표시할 데이터 없음 |
| current_status | `WAIT_EXPORT_LATENCY` |
| next_check | 2026-05-03 18:04 KST 이후 같은 SQL 재조회 |
| 추가 전송 | 금지 |

## 다음 첫 작업

1. 2026-05-03 18:04 KST 이후 TJ님이 `data/biocom-npay-ga4-mp-limited-test-result-20260502.md`의 SQL을 BigQuery 콘솔에서 다시 실행한다.
2. `202604309992065`, `2026043040116970`, `NPayRecoveredPurchase_202604309992065`가 보이는지 확인한다.
3. 결과를 Codex에게 붙여넣는다.

## BigQuery 결과를 받은 뒤 Codex가 할 일

| 결과 | Codex 처리 |
|---|---|
| `present` | `202604309992065`를 후속 dry-run에서 `already_in_ga4=present`로 막는다. 추가 send 후보 금지 |
| 24시간 안에 미노출 | export 지연으로 보고 재조회한다. 추가 send 후보 금지 |
| 48시간 안에도 미노출 | MP 수신 누락 또는 property/stream/API secret 문제로 보고 원인 점검. 추가 send 후보 금지 |
| 쿼리 실패/권한 없음 | `unknown`으로 두고 추가 send 후보 금지 |

이번 handoff의 BigQuery 확인은 새 후보 발굴이 아니라, 이미 승인 범위 안에서 보낸 `202604309992065` 1건의 GA4 raw export 수신 확인이다.

## A급 Production 후보 5건

| order_number | channel_order_no | value | 현재 상태 |
|---|---|---:|---|
| `202604280487104` | `2026042865542930` | 35000 | manual guard `robust_absent`, 72h 초과로 보류 |
| `202604285552452` | `2026042867285600` | 496000 | manual guard `robust_absent`, 72h 초과로 보류 |
| `202604303307399` | `2026043034982320` | 496000 | manual guard `robust_absent`, high-value라 1건 테스트 후 보류 |
| `202604309992065` | `2026043040116970` | 35000 | GA4 MP 1건 제한 테스트 완료, post-send BigQuery 수신 확인 대기 |
| `202605011540306` | `2026050158972710` | 496000 | manual guard `robust_absent`, high-value라 1건 테스트 후 보류 |

## 관련 파일

| 파일 | 역할 |
|---|---|
| `data/biocom-ga4-robust-guard-lookup-ids-20260502.txt` | 수동 조회 ID 10개 |
| `data/biocom-ga4-robust-guard-manual-run-20260502.md` | BigQuery 콘솔 SQL |
| `data/biocom-ga4-robust-guard-manual-result-20260502.md` | TJ님 manual BigQuery 결과 |
| `data/biocom-npay-recovery-ga4-mp-approval-draft-20260502.md` | GA4 MP 제한 테스트 approval draft |
| `data/biocom-npay-ga4-mp-limited-test-result-20260502.md` | GA4 MP 1건 제한 테스트 결과와 수신 확인 SQL |
| `data/biocom-npay-recovery-autorun-readonly-20260502.md` | 오늘 dry-run 결과 |
| `data/biocom-npay-recovery-eval-log-20260502.yaml` | eval log |

## 금지선

내일도 TJ님 별도 승인 전 아래 작업은 하지 않는다.

| 금지 | 상태 |
|---|---|
| GA4 Measurement Protocol 추가 전송 | 금지 |
| Meta CAPI 전송 | 금지 |
| TikTok Events API 전송 | 금지 |
| Google Ads conversion 전송 | 금지 |
| 운영 DB `INSERT/UPDATE/DELETE` | 금지 |
| `match_status` 업데이트 | 금지 |
| GTM workspace 생성/수정/publish | 금지 |
| backend deploy | 금지 |
| Imweb header/footer 수정 | 금지 |
| NPay 버튼 클릭 | 금지 |
| 결제 시도 | 금지 |

## 이어받기 순서

1. BigQuery 수신 확인 SQL을 실행한다.
2. 결과가 보이면 `already_in_ga4=present`로 후속 dry-run에서 막는다.
3. 24시간 안에 안 보이면 export 지연으로 보고 재조회한다.
4. 48시간 안에도 안 보이면 property/stream/API secret 문제를 점검한다.
5. 추가 GA4 MP, Meta/TikTok/Google Ads, DB write, GTM publish, backend deploy, Imweb 수정, NPay click은 계속 금지다.
