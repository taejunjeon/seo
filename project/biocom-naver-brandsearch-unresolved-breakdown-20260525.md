# Biocom Naver brandsearch unresolved breakdown 20260525

작성 시각: 2026-05-25 23:58 KST
기준일: 2026-05-25
문서 성격: 바이오컴 네이버 브랜드검색 주문 연결 미해결 row read-only 분해 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - docurule.md
    - project/naver-brandsearch-order-bridge-preview-result-20260525.md
    - project/naver-brandsearch-manual-cost-source-policy-20260525.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only query
    - operating DB PostgreSQL read-only query
    - one-way hash comparison
    - local JSON/Markdown output
  forbidden_actions:
    - operating_db_write
    - vm_cloud_sqlite_write
    - backend_deploy_or_restart
    - naver_ads_state_change
    - platform_conversion_send
    - raw_order_payment_customer_click_identifier_output
  source_window_freshness_confidence:
    source: "VM Cloud attribution_ledger/site_landing_ledger + 운영DB public.tb_iamweb_users"
    window: "biocom 2026-05-22~2026-05-25 KST"
    freshness: "VM Cloud attribution max 2026-05-25T14:40:16Z, 운영DB source date max 2026-05-25"
    confidence: "medium for reason buckets, low for final promotion until raw-free key rule is tightened"
```

## 10초 요약

바이오컴 브랜드검색 주문 연결 gap은 기존 5건에서 현재 재조회 기준 6건으로 늘었다. 원인은 운영 반영 문제가 아니라 source freshness가 올라오면서 새 marker 1건이 추가 관측된 것이다.

현재 예산 판단에는 브랜드검색 marker ROAS를 쓰지 않고, 주문 정본과 직접 일치한 exact ROAS만 보수 후보로 둔다. 다음 작업은 6건을 `주문키 불일치`, `금액·날짜 중복`, `날짜 window 차이`로 나누어 하나씩 줄이는 것이다.

## 확인 결과

- site: biocom
- window: 2026-05-22~2026-05-25 KST
- marker source: VM Cloud 결제완료 marker 중 브랜드검색 evidence가 붙은 row
- order source: 운영DB `public.tb_iamweb_users` 결제완료 주문
- raw 주문번호, 결제키, 고객키, 클릭 식별자 출력: 0건

| 항목 | 값 |
|---|---:|
| 브랜드검색 marker | 19건 |
| marker 금액 | 5,257,616원 |
| 주문 정본 직접 일치 | 13건 |
| 주문 정본 직접 일치 금액 | 3,364,432원 |
| 현재 미해결 | 6건 |
| 운영DB 같은 window 결제완료 주문 | 199건 |
| 운영DB 같은 window 결제완료 금액 | 47,306,484원 |

## 미해결 원인 분해

| 원인 | 건수 | 쉬운 의미 | 다음 조치 |
|---|---:|---|---|
| 주문키 후보는 있는데 운영DB 주문번호와 직접 일치하지 않음 | 3 | 유입 세션 evidence는 있지만 주문 정본 key 형식 또는 저장 위치가 맞지 않는다 | raw 값을 출력하지 않고 hash 비교 규칙과 주문키 후보 추출 위치를 보강 |
| 같은 날짜·같은 금액 후보가 여러 개라 자동 확정 불가 | 2 | 동일 금액 주문이 많아 금액/날짜만으로 어느 주문인지 확정할 수 없다 | 주문키, session, 결제수단, landing evidence를 추가로 대조 |
| 같은 금액 후보가 가까운 날짜에만 존재 | 1 | 새로 잡힌 후보이며 주문일과 marker일이 정확히 맞지 않는다 | sync 지연, timezone, 결제완료일 기준 차이를 먼저 분리 |

## 기존 5건과 현재 6건 차이

이전 preview의 바이오컴 freshness는 `2026-05-25T14:04:42Z`였다. 이번 분해 스크립트의 freshness는 `2026-05-25T14:40:16Z`다.

그 사이 브랜드검색 marker가 18건에서 19건으로 늘었다. 그래서 “unresolved 5건”은 당시 snapshot 기준이고, 현재 같은 window 재조회 기준으로는 “unresolved 6건”이 맞다.

## 예산 판단값

지금 예산 판단에 올릴 값은 아래 둘 중 `주문 정본 직접 일치`다.

- 유입 흔적 기준 ROAS: marker row 전체 기준이라 미해결 6건이 섞인다.
- 주문 정본 직접 일치 ROAS: 운영DB 주문 정본과 주문키가 맞은 row만 쓰므로 보수적이다.

현재 바이오컴 브랜드검색은 `주문 정본 직접 일치 ROAS 16.39배`를 보수 후보로 두고, marker 기준 25배대 값은 참고값으로만 둔다.

## 산출물

- JSON: `data/project/biocom-naver-brandsearch-unresolved-breakdown-20260525.json`
- 실행 스크립트: `backend/scripts/biocom-naver-brandsearch-unresolved-breakdown.ts`

## 금지선

- 운영DB write: 0
- VM Cloud SQLite write: 0
- backend deploy/restart: 0
- Naver Ads 광고 상태 변경: 0
- 전환 전송/upload: 0
- raw 식별자 출력: 0

## 다음 할일

### Auto Green

1. 바이오컴 6건의 주문키 불일치 원인을 raw-free hash 비교로 좁힌다.
   - 담당: Codex
   - 이유: 주문 정본 exact 매출을 높여 브랜드검색 ROAS를 예산 판단값으로 승격하기 위해서다.
   - 방법: 운영DB/VM Cloud read-only 재조회, 주문키 후보 위치별 hash count 비교, 금액·날짜 중복 row 분리.
   - 성공 기준: 6건이 `확정`, `제외`, `보류` 중 하나로 재분류된다.
   - 실패 시 확인점: 주문키 저장 형식 차이, 결제완료일 기준 차이, sync lag.
   - 승인 필요 여부: NO.

2. 네이버 ROAS 화면 API 연결 승인안에 이 결과를 warning source로 연결한다.
   - 담당: Codex
   - 이유: 화면에서 marker ROAS와 exact ROAS를 섞지 않기 위해서다.
   - 방법: API 응답에 `brandsearch.unresolved_reason_counts` 필드를 설계한다.
   - 성공 기준: frontend가 “biocom 6건 보강 필요”를 자동으로 표시할 수 있다.
   - 승인 필요 여부: 문서 작성은 NO, 실제 backend deploy는 YES.
