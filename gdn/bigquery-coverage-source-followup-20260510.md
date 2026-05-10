
# BigQuery coverage source follow-up - 2026-05-10

작성 시각: 2026-05-10 19:34:00 KST
Lane: Green source investigation

## 결론
현재 funnel query가 보는 daily export dataset은 20260507~20260509 3일치뿐이다. 7/14/30일 trend를 만들려면 기존 archive dataset과 신규 daily export를 union해야 한다.

## 확인한 source
- 현재 daily export: project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*
- actual suffixes: 20260507, 20260508, 20260509
- archive: `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*`
- archive verified window: `events_20240909` ~ `events_20260506`
- archive verified rows: 24,495,738
- archive source document: [[../data/biocom-bigquery-final-delta-result-20260507]]

## 판단
- 현재 3일 daily export만으로는 7/14/30d trend proof가 아니다.
- frontend에는 coverage warning을 표시해야 한다.
- 다음 Green은 archive `<=20260506` + current daily export `>=20260507` union query 설계다.

## 금지선
- BigQuery table write 없음.
- GA4 Link 변경 없음.
- platform send 없음.
