# reportcoffee VM Cloud NPay weekly actual 20260522

작성 시각: 2026-05-22 01:21 KST
기준일: 2026-05-21
문서 성격: 더클린커피 NPay 주간 actual read-only 결과
담당: Codex
관련 문서: [[reportcoffee]], [[reportcoffee-okr-action-plan-20260522]]

## 10초 요약

VM Cloud에는 적재하지 않았다. 이번 작업은 VM Cloud SQLite를 읽기 전용으로 열어 더클린커피 NPay 주간 결제완료 후보만 집계한 것이다.

2026-05-15 - 2026-05-21 KST 기준 NPay actual은 72건 / 3,693,400원이다. 취소/반품/교환 8건 / 679,800원은 제외했고, status blank 4건 / 141,600원은 미결제가 아니라 freshness warning으로 분리했다.

## 결과

- source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders`
- mode: read-only, `sqlite3 -readonly`
- site: `thecleancoffee`
- window: 2026-05-15 - 2026-05-21 KST
- actual included: 72건 / 3,693,400원
- gross before exclusion: 80건 / 4,373,200원
- excluded cancel/return/exchange: 8건 / 679,800원
- status present included: 68건 / 3,551,800원
- status blank warning: 4건 / 141,600원
- complete_time legacy: 60건 / 3,253,700원
- complete_time blank bridge pending: 12건 / 439,700원

## Freshness

- VM Cloud all-site NPay rows for thecleancoffee: 1,470건 / 64,237,400원
- max order_time: 2026-05-21T13:21:38.000Z
- max synced_at: 2026-05-21 16:11:32
- max status_synced_at: 2026-05-21 12:10:49
- confidence: medium_high_with_status_freshness_warning

## Guardrails

- VM Cloud write/import/sync: 0
- VM Cloud deploy/restart: 0
- Slack send: 0
- platform send/upload: 0
- raw identifier output: 0
- NPay click promoted to purchase: 0
- complete_time blank을 미결제로 단정: 0
