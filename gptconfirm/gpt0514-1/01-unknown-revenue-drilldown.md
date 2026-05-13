# Unknown Revenue Drilldown v0.3

작성 시각: 2026-05-14 00:55 KST
site: biocom
window: 2026-05-01 <= KST < 2026-06-01
source: 운영DB 월별 결제완료 spine + VM Cloud `attribution_ledger` + 로컬DB 보조 캐시
confidence: B+

## 목적

`/total`의 “어디서 왔는지 모르는 매출”을 3개 큰 덩어리에서 운영자가 바로 고칠 수 있는 5개 blocker로 쪼갰다. 실제 매출 정본은 운영DB 결제완료 spine이고, 채널 근거는 VM Cloud 유입 장부다.

## 결과

- actual spine: 941건 / 204,006,680원.
- 분류된 매출: 431건 / 80,373,978원.
- unknown: 510건 / 123,632,702원.
- 합계 검증: `primary_sum_matches_revenue=true`.

## Blocker

| blocker | 건수 | 매출 | 다음 evidence | 추천 조치 |
|---|---:|---:|---|---|
| 결제완료 신호 key 정규화/coverage 문제 | 334 | 89,337,146원 | VM Cloud `attribution_ledger` payment_success coverage | server-side 결제완료 capture와 key 정규화 점검 |
| 내부 referrer만 남음 | 71 | 20,914,719원 | 내부 이동 전 최초 외부 referrer | 내부 redirect 전 최초 referrer/landing 보존 |
| UTM은 있으나 규칙 판정 불가 | 75 | 11,386,862원 | UTM source/medium naming rule | paid/organic 판정 가능한 UTM 표준화 |
| 첫 구독 유입 archive 필요 | 26 | 1,000,875원 | 첫 구독 시작 유입 archive | 과거 유입 장부 lookup 설계 |
| checkout은 있으나 결제완료 신호 끊김 | 4 | 993,100원 | checkout to payment_success continuity | 결제완료 서버 신호 누락 구간 점검 |

## 구독/정기결제 처리

TJ님 요청 기준으로 2회차 이후 정기결제는 최초 유입 분석 대상에서 제외하고 `subscription_recurring`으로 분리했다.

- 2회차 이후 구독 매출: 125건 / 5,441,500원.
- 첫 구독 시작 중 archive lookup 필요: 26건 / 1,000,875원.
- member key missing: 0건.

## 화면 반영

- `/total` 미분류/보류 매출 섹션에 세부 blocker table 추가.
- 각 blocker는 건수, 매출, 다음 evidence, 추천 조치를 보여준다.
- raw identifier는 응답과 화면에 싣지 않는다.
