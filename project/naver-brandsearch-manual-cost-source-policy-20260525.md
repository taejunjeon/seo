# Naver 브랜드검색 수동 계약 비용 source policy

작성 시각: 2026-05-25 21:30 KST
기준일: 2026-05-25
문서 성격: Naver 브랜드검색 비용 원천 임시 정본 및 daily preview 결과
상위 문서: [[!report]], [[reportcoffee]], [[reportbiocom]], [[reportbiocom-source-map-20260523]]
관련 문서: [[naver-brandsearch-backfill-bizmoney-preview-result-20260525]], [[naver-brandsearch-bizmoney-cost-cache-write-approval-20260525]]
적재 결과: [[naver-brandsearch-manual-cost-cache-write-result-20260525]]
ROAS preview: [[naver-brandsearch-roas-preview-result-20260525]]
주문 정본 cross-check: [[naver-brandsearch-order-source-crosscheck-result-20260525]]
주문 단위 bridge preview: [[naver-brandsearch-order-bridge-preview-result-20260525]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - report/reportcoffee.md
    - report/reportbiocom.md
    - report/reportbiocom-source-map-20260523.md
  lane: Green
  allowed_actions:
    - manual_cost_source_documentation
    - local_no_write_cost_preview
    - canonical_report_source_update
    - approval_packet_draft
  forbidden_actions:
    - vm_cloud_schema_or_data_write
    - operating_db_write
    - naver_ads_setting_change
    - naver_conversion_send_or_upload
    - ga4_meta_google_tiktok_platform_send
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: TJ-confirmed Naver brandsearch contract amounts + local manual preview JSON
    window: confirmed first periods 2026-05-11..2026-06-09 for thecleancoffee and 2026-05-22..2026-07-20 or 2026-06-20 for biocom, preview through 2026-07-20 KST
    freshness: TJ confirmed 2026-05-25 KST, preview generated 2026-05-25 21:25 KST
    confidence: high for confirmed first contract amounts, medium for projected renewal periods
```

## 10초 요약

Naver 브랜드검색 비용은 당분간 TJ님이 확인한 계약 금액을 보고서 primary source로 쓴다.

이유는 일반 Naver daily stats가 브랜드검색 비용을 안정적으로 보여주지 못하기 때문이다. 다만 바이오컴은 Bizmoney API에서 브랜드검색 총액 2,420,000원이 조회되고, TJ님 수동 계약 총액과 일치하므로 공식 cross-check source로 승격한다. Slack·ROAS 보고의 비용 분자는 수동 계약 금액을 기간별로 배분한 cache를 우선 사용한다.

## 확정된 수동 계약 금액

| site | 기기 | 기간 | 금액 | 비고 |
|---|---|---|---:|---|
| thecleancoffee | mobile | 2026-05-11..2026-06-09 | 880,000원 | TJ님 확인 |
| thecleancoffee | PC | 2026-05-11..2026-06-09 | 660,000원 | TJ님 확인 |
| thecleancoffee | 합계 | 2026-05-11..2026-06-09 | 1,540,000원 | 보고서 primary |
| biocom | mobile | 2026-05-22..2026-07-20 | 1,760,000원 | 60일, 계약 가능 검색수 8,000 |
| biocom | PC | 2026-05-22..2026-06-20 | 660,000원 | 30일, 계약 가능 검색수 8,000 |
| biocom | 합계 | 기기별 기간 다름 | 2,420,000원 | 보고서 primary |

source:

- manual source file: `data/project/naver-brandsearch-manual-contracts-20260525.json`
- preview output: `data/project/naver-brandsearch-manual-cost-preview-20260525.json`

## 비용 배분 원칙

비용은 차감일 한 날짜에 몰아넣지 않고 계약 기간에 일할 배분한다.

이유:

1. 브랜드검색은 일정 기간 노출권 성격이 강하다.
2. 주간/월간 ROAS 보고는 매출 window와 광고비 window를 맞춰야 한다.
3. 차감일 기준으로 몰아넣으면 차감일 주간 비용만 비정상적으로 커진다.

배분 방식:

- 기간은 양끝 날짜를 모두 포함한다.
- 일별 금액은 정수 KRW로 배분한다.
- 나누어떨어지지 않는 잔여 원은 기간 앞쪽 날짜부터 1원씩 배분한다.
- 계약 1회차는 `manual_contract_confirmed`로 표시한다.
- 다음 기간은 TJ님이 갱신 정보를 주기 전까지 같은 금액/기간이 반복된다고 가정하고 `manual_contract_renewal_assumption`으로 표시한다.

## preview 결과

실행:

```bash
cd backend
npx tsx scripts/naver-brandsearch-manual-cost-preview.ts \
  --until=2026-07-20 \
  --output=../data/project/naver-brandsearch-manual-cost-preview-20260525.json
```

결과:

| 항목 | 값 |
|---|---:|
| preview window | 2026-05-11..2026-07-20 KST |
| daily rows | 262 |
| confirmed first contract total | 3,960,000원 |
| projected or partial renewal total | 2,764,673원 |
| preview total | 6,724,673원 |
| thecleancoffee preview total | 3,644,673원 |
| biocom preview total | 3,080,000원 |

주의:

- thecleancoffee preview total은 2026-05-11..2026-07-20까지의 첫 계약, 2회차 전체, 3회차 일부를 포함한다.
- biocom mobile은 첫 60일 기간만 포함한다.
- biocom PC는 첫 30일과 다음 30일이 포함된다.
- 보고서에서 특정 주간/월간을 계산할 때는 `daily_rows.date`를 window로 잘라 합산한다.

## ROAS preview 결과

수동 기간 배분 cache 적재 후 read-only/no-send reader를 실행했다. 상세는 [[naver-brandsearch-roas-preview-result-20260525]]에 둔다.

실행:

```bash
cd backend
npx tsx scripts/naver-brandsearch-roas-preview.ts \
  --until=2026-05-25 \
  --output=../data/project/naver-brandsearch-roas-preview-20260525.json
```

결과:

| site | effective window | 비용 | VM Cloud 결제완료 marker 금액 | 참고 ROAS |
|---|---|---:|---:|---:|
| biocom | 2026-05-22..2026-05-25 | 205,336원 | 4,786,416원 | 23.31 |
| thecleancoffee | 2026-05-11..2026-05-25 | 770,005원 | 352,564원 | 0.46 |

주의:

- 위 ROAS는 `VM Cloud 결제완료 marker 기준 참고값`이다.
- 예산 판단용 최종 `내부 confirmed ROAS`는 운영DB/Imweb 주문 정본과 같은 window로 cross-check한 뒤 별도 표기한다.
- 더클린커피는 고객 유입 장부의 브랜드검색 capture가 최근에 열려 과거 landing rows가 과소 집계될 수 있다.

## 주문 정본 cross-check 결과

운영DB/Imweb 주문 정본을 같은 window로 read-only 재조회했다. 상세는 [[naver-brandsearch-order-source-crosscheck-result-20260525]]에 둔다.

| site | window | 브랜드검색 marker ROAS | 주문 정본 source | 주문 정본 같은-window 총액 | 판단 |
|---|---|---:|---|---:|---|
| biocom | 2026-05-22..2026-05-25 | 23.31 | 운영DB `tb_iamweb_users PAYMENT_COMPLETE` | 199건 / 47,306,484원 | marker 금액이 같은-window 주문 정본 안에 들어가는지 확인 완료 |
| thecleancoffee | 2026-05-11..2026-05-25 | 0.46 | VM Cloud `imweb_orders(site='thecleancoffee')` NPay primary candidate | 230건 / 12,830,000원 | 브랜드검색 exact 매출이 아니라 주문 정본 sanity check로만 사용 |

주의:

- 주문 정본 같은-window 총액은 브랜드검색으로 온 주문만의 확정 매출이 아니다.
- 따라서 현재 보고서에는 `브랜드검색 marker ROAS`와 `주문 정본 sanity check`를 분리해서 표시한다.
- exact 내부 confirmed ROAS로 올리려면 주문 단위 bridge preview가 추가로 필요하다.

## 주문 단위 bridge preview 결과

브랜드검색 marker를 주문 정본과 같은 주문 단위로 붙이는 read-only/no-send preview를 실행했다. 상세는 [[naver-brandsearch-order-bridge-preview-result-20260525]]에 둔다.

| site | window | marker ROAS | exact bridge ROAS | 판단 |
|---|---|---:|---:|---|
| biocom | 2026-05-22..2026-05-25 | 23.31 | 16.39 | unresolved 5건 분해 전까지 exact bridge ROAS를 보수값으로 둔다 |
| thecleancoffee | 2026-05-11..2026-05-25 | 0.46 | 0.46 | marker 11건 모두 주문 정본 exact bridge |

## API/Bizmoney 결과의 위치

`/billing/bizmoney/histories/exhaust` preview에서 브랜드검색 2,420,000원이 확인됐다. 바이오컴은 이 값을 cross-check source로 쓴다. 다만 아래 이유로 리포트 계산 primary는 아직 수동 기간 배분 cache다.

1. 더클린커피 계정 범위가 API와 맞지 않는다.
2. 브랜드검색은 일반 캠페인 daily stats와 비용 원천이 다르다.
3. Bizmoney row는 차감일 기준이라 주간/월간 리포트에는 계약 기간 배분이 필요하다.
4. 모바일/PC 기간이 다르므로 기기별 일할 배분은 TJ님 수동 계약 금액이 더 명확하다.

따라서 API/Bizmoney는 다음처럼 둔다.

- biocom: manual total 2,420,000원과 Bizmoney API preview 2,420,000원이 일치하므로 cross-check source로 승격한다.
- biocom report 반영: 수동 기간 배분 cache 승인 후 진행한다. Bizmoney 차감일 row를 그대로 리포트 비용에 넣지 않는다.
- thecleancoffee: API 계정 mismatch가 있으므로 manual total 1,540,000원이 primary다.
- 추후 API 계정/권한이 맞춰지면 API cache를 다시 primary 후보로 올린다.

## 하지 않은 것

- VM Cloud SQLite write는 2026-05-25 22:00 KST TJ님 승인 후 별도 결과 문서 기준 완료. 결과: [[naver-brandsearch-manual-cost-cache-write-result-20260525]]
- 운영DB write 0건.
- Naver Ads 설정 변경 0건.
- 광고 플랫폼 전송 0건.
- GTM publish 0건.
- raw 주문/결제/고객/클릭 식별자 출력 0건.

## 다음 할일

### Auto Green

1. report 정본에 수동 비용 primary source를 반영한다.
   - 의존성: 완료.
   - 성공 기준: 더클린커피 `전용 계정 확인 필요` 문구가 `수동 계약 금액 primary`로 바뀐다.

2. 브랜드검색 비용 no-send reader를 리포트 preview에 연결한다.
   - 의존성: 완료.
   - 성공 기준: site/window별 비용, landing rows, VM Cloud 결제완료 marker 금액, 참고 ROAS가 JSON과 문서에 남는다.

3. Naver ROAS 프론트엔드 화면을 검증한다.
   - 의존성: 브랜드검색 비용 cache, ROAS preview, 주문 정본 cross-check, 주문 단위 bridge preview 완료.
   - 성공 기준: `/ads/naver-roas`에서 비용, marker ROAS, exact bridge ROAS, OKR, 액션플랜이 함께 표시된다.

### Approval Needed

1. VM Cloud API 또는 frontend에 브랜드검색 비용 reader를 붙이는 배포.
   - 이유: 로컬 preview가 아니라 화면/API가 자동으로 이 비용 cache를 읽게 하려면 backend route 연결이 필요하다.
   - 승인 필요: YES, backend deploy/restart 필요 시 Yellow.

## Auditor verdict

```text
Auditor verdict: PASS
Lane: Green
No-write: YES
No-send: YES
No-deploy: YES
Source confidence: high for manual first contract, medium for renewal projection
```
