# Coffee Data Context Pack

작성 시각: 2026-05-01 15:23 KST  
상태: v0 기준판  
목적: 더클린커피 정합성 작업 전에 반드시 읽을 문서, 데이터 위치, 최신 숫자를 한 장에 고정한다  
관련 문서: [[harness/coffee-data/README|Coffee Data Harness]], [[data/!coffeedata|더클린커피 데이터 정합성 프로젝트]], [[data/!data_inventory|데이터 위치 인벤토리]]

## 10초 요약

더클린커피 작업의 primary는 질문별로 다르다.

GA4 수신 여부는 BigQuery가 primary다. NPay 실제 주문은 현재 Imweb v2 API `type=npay`가 primary다. 과거 주문/고객 원장 보강은 `data/coffee/*.xlsx` 엑셀 dry-run이 primary 후보다.

local SQLite mirror와 오래된 Toss/Imweb local source는 stale 가능성이 있어 primary로 쓰지 않는다.

## 필수 문서

| 순서 | 문서 | 왜 읽는가 |
|---:|---|---|
| 1 | [[harness/coffee-data/README|Coffee Data Harness]] | 금지선과 작업 순서 확인 |
| 2 | [[harness/coffee-data/RULES|Coffee Rules]] | primary source와 매칭 기준 확인 |
| 3 | [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]] | 종료 전 hard fail 확인 |
| 4 | [[data/!coffeedata|더클린커피 데이터 정합성 프로젝트]] | Phase/Sprint, 최신 판단, 다음 할일 확인 |
| 5 | [[data/coffee-ga4-baseline-20260501|GA4 BigQuery 기준선]] | GA4 purchase 기준선 확인 |
| 6 | [[data/coffee-imweb-operational-readonly-20260501|Imweb/GA4 NPay Read-only 리포트]] | NPay actual vs GA4 NPay형 분해 |
| 7 | [[data/coffee-npay-unassigned-ga4-guard-20260501|NPay unassigned GA4 Guard]] | 남은 actual 18건의 robust guard 결과 |
| 8 | [[data/coffee-excel-import-dry-run-20260501|엑셀 Import Dry-run]] | 2024/2025 엑셀 join 가능성 |
| 9 | [[data/coffee-dry-run-schema|Coffee Dry-run Schema]] | report row schema |
| 10 | [[data/!data_inventory|데이터 위치 인벤토리]] | 파일 경로와 stale 여부 |

## Primary Source Map

| 질문 | primary | cross-check | fallback | 주의 |
|---|---|---|---|---|
| GA4에 purchase가 있는가 | BigQuery `analytics_326949178` | GA4 UI, existing report | 없음 | table suffix/window 명시 |
| 실제 NPay 주문인가 | Imweb v2 API `type=npay` | Naver Commerce API 권한 확보 후 | PlayAuto, 엑셀 | Naver API 권한 전까지 네이버 정산 API를 정본으로 쓰지 않음 |
| non-NPay 주문인가 | `tb_sales_toss store=coffee` | Imweb v2 API, PlayAuto | 엑셀 | store/site filter 필수 |
| 과거 고객/주문 원장인가 | `data/coffee/coffee_orders_2025.xlsx`, `coffee_payments_2025.xlsx` dry-run | 2024 엑셀 | 2023 파일은 header-only | actual import 금지 |
| 광고비/ROAS인가 | Meta/TikTok API fresh token | GA4 source/medium | CSV export | token freshness 확인 전 판단 보류 |

## 최신 숫자

기준 리포트: [[data/coffee-imweb-operational-readonly-20260501|coffee-imweb-operational-readonly-20260501]]  
생성 시각: 2026-05-01 14:43:54 KST  
window: 2026-04-23 ~ 2026-04-29 KST

| 항목 | 값 | 판단 |
|---|---:|---|
| Imweb orders | 113건 / 4,699,767원 | actual order 후보 |
| Imweb NPay actual | 60건 / 2,462,300원 | NPay actual primary |
| GA4 purchases | 108건 / 4,454,524원 | GA4 수신 기준 |
| GA4 NPay pattern | 58건 / 2,359,300원 | synthetic NPay형 이벤트 |
| NPay delta | 2건 / 103,000원 | 실제 차이 존재 |
| one-to-one assigned | 42건 | 보수 기준 안정 배정 |
| one-to-one unassigned actual | 18건 / 641,300원 | 자동 전송 후보 아님 |
| one-to-one unassigned GA4 | 16건 / 608,900원 | 자동 배정 불안정 |
| unassigned actual guard | 36/36 robust_absent | order/channel id가 GA4 raw에 직접 없음 |

## 데이터 위치

| 데이터 | 경로/식별자 | 상태 |
|---|---|---|
| GA4 BigQuery | `project-dadba7dd-0229-4ff6-81c.analytics_326949178` | fresh |
| Imweb v2 API | `IMWEB_API_KEY_COFFEE` | read-only 조회 가능 |
| 2025 주문 엑셀 | `data/coffee/coffee_orders_2025.xlsx` | 실제 데이터 |
| 2025 결제 엑셀 | `data/coffee/coffee_payments_2025.xlsx` | 실제 데이터 |
| 2024 주문 엑셀 | `data/coffee/coffee_orders_2024.xlsx` | 실제 데이터 |
| 2024 결제 엑셀 | `data/coffee/coffee_payments_2024.xlsx` | 실제 데이터 |
| 2023 엑셀 | `data/coffee/coffee_orders_2023.xlsx`, `coffee_payments_2023.xlsx` | header-only |
| local Imweb mirror | local SQLite | stale 가능, primary 금지 |
| local Toss mirror | local SQLite | stale 가능, primary 금지 |

## 표준 명령

```bash
cd backend
npm exec tsx scripts/coffee-ga4-baseline.ts -- --startSuffix=20260423 --endSuffix=20260429
npm exec tsx scripts/coffee-imweb-operational-readonly.ts -- --startSuffix=20260423 --endSuffix=20260429 --maxPages=8 --delayMs=1200 --markdown
npm exec tsx scripts/coffee-ga4-robust-guard.ts -- --startSuffix=20260423 --endSuffix=20260429 --idsFile=/tmp/coffee-unassigned-npay-ids.txt --markdown
npm exec tsx scripts/coffee-excel-import-dry-run.ts -- --year=2025 --markdown
```

## 지금 남은 판단

| 판단 | 현재 상태 | 다음 행동 |
|---|---|---|
| unassigned actual 18건 | 36개 ID robust_absent | 자동 전송 금지/수동 검토/미래 intent 전환 라벨링 |
| ambiguous 29건 | low_score_gap, multiple candidates | 줄일 수 있는지 재점수화 후 과거 복구 종료 여부 판단 |
| Naver Commerce API | 권한 미확정 | TJ님 외부 계정 확인 필요 |
| future intent | 설계 전 | preview-only 설계안 작성 |

## 작업 전 질문

1. 이번 작업의 site는 `thecleancoffee`인가.
2. 이번 작업은 read-only인가.
3. primary source가 질문에 맞게 정해졌는가.
4. stale source를 primary로 쓰고 있지 않은가.
5. output에 source/window/freshness/confidence가 들어가는가.
6. 작업 종료 후 auditor verdict를 남길 수 있는가.
