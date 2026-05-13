# Total Current Copy

작성 시각: 2026-05-14 00:55 KST

## 현재 상태

- `/total` 로컬 화면은 바이오컴/더클린커피 탭을 가진다.
- 바이오컴 탭은 월별 actual spine 기준 채널 판단 화면이다.
- 더클린커피 탭은 correction line 참고 화면이다.
- 바이오컴 탭에서 더클린커피 참고용 매출 카드는 제거됐다.
- GA4 BigQuery sourceFreshness는 신규 export + historical backfill 연결 기준 fresh로 표시된다.
- 이번 sprint에서 unknown revenue drilldown v0.3이 로컬 구현됐다.
- 기본 조회 월은 Asia/Seoul 기준 현재 월로 잡힌다.

## 최신 숫자

- 바이오컴 2026년 5월 actual spine: 941건 / 204,006,680원.
- unknown: 510건 / 123,632,702원.
- 결제완료 신호 key 정규화/coverage 문제: 334건 / 89,337,146원.
- 내부 referrer만 남음: 71건 / 20,914,719원.
- UTM 규칙 판정 불가: 75건 / 11,386,862원.
- 첫 구독 유입 archive 필요: 26건 / 1,000,875원.
- checkout은 있으나 결제완료 신호 끊김: 4건 / 993,100원.
- 네이버 검색 referrer 144건은 유료 표식 때문에 자연검색 제외.

## 금지선

- GA4 purchase revenue를 actual 매출 정본으로 쓰지 않는다.
- Search Advisor를 주문 단위 매출 attribution source로 쓰지 않는다.
- 운영DB write/import, VM Cloud SQLite write/schema migration, 광고 전송, GTM publish 금지.
