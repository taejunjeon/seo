# Biocom GA4 Robust Guard Manual Result (2026-05-02)

작성 시각: 2026-05-02 17:55 KST
site: `biocom`
source: TJ님 BigQuery 콘솔 수동 실행 결과
query target: `hurdlers-naver-pay.analytics_304759974`
table suffix: `20260425` ~ `20260502`
mode: `manual_read_only_guard`

## 10초 요약

TJ님이 BigQuery 콘솔에서 A급 production 후보 5건의 robust guard SQL을 수동 실행했다.

5건 모두 `order_number_events=0`, `channel_order_no_events=0`이다. 따라서 manual guard 기준 5건 모두 `robust_absent`로 판정한다.

5번째 행의 `robust_absnt`는 오타로 보며, 양쪽 event count가 0이므로 `robust_absent`로 정규화한다.

## Manual Guard Result

| order_number | channel_order_no | value | order_number_events | channel_order_no_events | manual_guard_result |
|---|---|---:|---:|---:|---|
| `202604280487104` | `2026042865542930` | 35000 | 0 | 0 | `robust_absent` |
| `202604285552452` | `2026042867285600` | 496000 | 0 | 0 | `robust_absent` |
| `202604303307399` | `2026043034982320` | 496000 | 0 | 0 | `robust_absent` |
| `202604309992065` | `2026043040116970` | 35000 | 0 | 0 | `robust_absent` |
| `202605011540306` | `2026050158972710` | 496000 | 0 | 0 | `robust_absent` |

## 판정

| 항목 | 결과 |
|---|---|
| present | 0 |
| robust_absent | 5 |
| unknown | 0 |
| approval draft 후보 | 5 |
| 실제 전송 | 0 |

## 적용 규칙

1. order_number 또는 channel_order_no 중 하나라도 events > 0이면 `present`.
2. 둘 다 events = 0이면 `robust_absent`.
3. 쿼리 실패, 테이블 없음, 권한 없음이면 `unknown`.
4. `present` 또는 `unknown`은 send 후보 금지.
5. `robust_absent`만 approval draft 후보 가능.

## 금지선

이 결과는 approval draft 작성에만 사용한다.

GA4 Measurement Protocol, Meta CAPI, TikTok Events API, Google Ads conversion 전송은 하지 않는다. 운영 DB write, `match_status` 업데이트, GTM publish, backend deploy, Imweb header/footer 수정, NPay click도 하지 않는다.
