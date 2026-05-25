# Naver 브랜드검색 주문 정본 cross-check 결과

작성 시각: 2026-05-25 22:47 KST
기준일: 2026-05-25
문서 성격: 운영DB/Imweb 주문 정본 read-only cross-check 결과
상위 문서: [[naver-brandsearch-roas-preview-result-20260525]], [[naver-brandsearch-manual-cost-source-policy-20260525]]
산출 JSON: `data/project/naver-brandsearch-order-source-crosscheck-20260525.json`
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
    - gdn/attribution-data-source-decision-guide-20260511.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  required_context_docs:
    - project/naver-brandsearch-roas-preview-result-20260525.md
    - report/reportbiocom.md
    - report/reportcoffee.md
  lane: Green
  allowed_actions:
    - operating DB read-only aggregate query
    - VM Cloud SQLite read-only aggregate query
    - local no-send reader script creation
    - local JSON result generation
    - documentation update
  forbidden_actions:
    - operating DB write
    - VM Cloud SQLite write
    - backend deploy/restart
    - Naver Ads setting change
    - Naver conversion send/upload
    - GA4/Meta/Google/TikTok platform send
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: 운영DB public.tb_iamweb_users aggregate + VM Cloud imweb_orders aggregate + VM Cloud brandsearch marker aggregate
    window: biocom 2026-05-22..2026-05-25 KST, thecleancoffee 2026-05-11..2026-05-25 KST
    freshness: queried 2026-05-25 22:46 KST, operating DB max source date 2026-05-25, VM Cloud attribution max 2026-05-25T13:43:11Z, coffee imweb max order_time 2026-05-25T13:32:47Z
    confidence: medium_high for biocom order source, medium for thecleancoffee NPay primary candidate due status blank rows and brandsearch attribution bridge gap
```

## 10초 요약

브랜드검색 비용과 결제완료 marker를 주문 정본과 같은 기간으로 다시 대조했다.

결론은 `브랜드검색 marker ROAS`와 `주문 정본 같은-window 총매출 ROAS`를 반드시 분리해야 한다. marker ROAS는 브랜드검색 유입 증거가 붙은 결제완료 참고값이고, 주문 정본 총매출은 같은 기간 사이트 전체 결제완료 sanity check다.

## 실행한 reader

파일:

```text
backend/scripts/naver-brandsearch-order-source-crosscheck.ts
```

실행:

```bash
cd backend
npx tsx scripts/naver-brandsearch-order-source-crosscheck.ts \
  --output=../data/project/naver-brandsearch-order-source-crosscheck-20260525.json
```

mode:

```text
read_only_no_send_no_write
```

## 결과

| site | window | 브랜드검색 비용 | 브랜드검색 landing | 브랜드검색 marker 결제완료 | marker ROAS | 주문 정본 같은-window | 주문 정본 참고 ROAS |
|---|---|---:|---:|---:|---:|---:|---:|
| biocom | 2026-05-22..2026-05-25 | 205,336원 | 132 | 18건 / 4,786,416원 | 23.31 | 199건 / 47,306,484원 | 230.39 |
| thecleancoffee | 2026-05-11..2026-05-25 | 770,005원 | 15 | 11건 / 352,564원 | 0.46 | NPay 230건 / 12,830,000원 | 16.66 |

## 주문 정본 source

### biocom

주문 정본은 운영DB PostgreSQL `public.tb_iamweb_users`를 read-only로 집계했다.

필터:

```text
payment_status=PAYMENT_COMPLETE
cancellation_reason/return_reason blank
amount > 0
order_number 기준 주문 단위 dedupe
```

결과:

| 항목 | 값 |
|---|---:|
| 전체 결제완료 주문 | 199건 / 47,306,484원 |
| NPay 결제완료 주문 | 9건 / 1,355,600원 |
| NPay 외 결제완료 주문 | 190건 / 45,950,884원 |
| source freshness | max source date 2026-05-25 |

### thecleancoffee

주문 정본 후보는 VM Cloud SQLite `imweb_orders(site='thecleancoffee')`를 read-only로 집계했다.

필터:

```text
payment_amount 또는 total_price > 0
취소/반품/교환/환불 status 제외
status blank는 미결제 단정하지 않고 included_with_warning
```

결과:

| 항목 | 값 |
|---|---:|
| 전체 Imweb positive 주문 | 780건 / 45,621,317원 |
| NPay primary candidate | 230건 / 12,830,000원 |
| status blank included_with_warning | 6건 / 481,122원 |
| source freshness | max order_time 2026-05-25T13:32:47Z, max synced_at 2026-05-25 13:39:43 |

## 해석

### biocom

브랜드검색 marker 매출 4,786,416원은 같은 기간 운영DB 전체 결제완료 매출 47,306,484원 안에 들어갈 수 있는 크기다.

따라서 marker 금액이 주문 정본 총액을 초과하는 문제는 없다. 다만 marker ROAS 23.31은 `브랜드검색 유입 marker 기준 참고 ROAS`이고, 운영DB 전체 주문 정본 참고 ROAS 230.39는 사이트 전체 같은-window sanity check다. 둘을 예산 판단값으로 섞으면 안 된다.

### thecleancoffee

브랜드검색 marker 매출 352,564원은 같은 기간 NPay 주문 정본 후보 12,830,000원보다 훨씬 작다.

이는 더클린커피 브랜드검색 landing capture가 최근에 열린 영향과, 주문 정본과 브랜드검색 유입을 같은 주문 단위로 연결하는 bridge가 아직 약한 영향이 섞여 있다. 현재 예산 판단에는 marker ROAS 0.46을 보수 참고값으로 두고, NPay 전체 12,830,000원은 브랜드검색 상한이 아니라 주문 정본 sanity check로만 본다.

## 주문 단위 bridge preview 후속

cross-check는 같은 기간 전체 주문 정본 총액 안에 marker 금액이 들어가는지 보는 sanity check였다. 그 다음 단계로 주문 단위 bridge preview를 실행했고, 상세 결과는 [[naver-brandsearch-order-bridge-preview-result-20260525]]에 둔다.

| site | marker 결제완료 | 주문 정본 exact bridge | 남은 gap | 예산 판단 위치 |
|---|---:|---:|---:|---|
| biocom | 18건 / 4,786,416원 | 13건 / 3,364,432원 | ambiguous 2건, no_bridge 3건 | exact bridge ROAS 16.39를 보수값으로 사용, 5건 원인 분해 필요 |
| thecleancoffee | 11건 / 352,564원 | 11건 / 352,564원 | 0건 | marker ROAS와 exact bridge ROAS가 모두 0.46으로 일치 |

## 하지 않은 것

- 운영DB write 0건.
- VM Cloud SQLite write 0건.
- backend deploy/restart 0건.
- Naver Ads 설정 변경 0건.
- Naver conversion send/upload 0건.
- GA4/Meta/Google/TikTok platform send 0건.
- GTM publish 0건.
- raw 주문/결제/고객/클릭 식별자 출력 0건.

## 다음 할일

### Auto Green

1. 브랜드검색 ROAS preview 문서와 site report에 cross-check 결과를 연결한다.
   - 의존성: 완료.
   - 성공 기준: marker ROAS와 주문 정본 sanity check가 분리되어 표시된다.
   - 승인 필요: NO.

2. 바이오컴 unresolved bridge 5건을 분해한다.
   - 무엇: `site_landing_ledger -> attribution_ledger payment_success -> 운영DB 주문 정본` 연결 실패/모호 row를 원인별로 나눈다.
   - 왜: 주문 단위 bridge preview 결과 바이오컴은 exact 13건 외 5건이 남았다.
   - 성공 기준: unresolved 5건이 source mapping gap, sync lag, duplicate amount/date 후보 등으로 분류된다.
   - 승인 필요: NO, read-only/no-send.

### Approval Needed

1. 리포트 API에 주문 정본 cross-check reader를 붙이는 배포.
   - 무엇: 로컬 실행 스크립트가 아니라 대시보드/API에서 cross-check 결과를 읽게 한다.
   - 왜: 매번 수동 실행하지 않고 브랜드검색 라인이 자동 갱신되게 하려면 필요하다.
   - 승인 필요: YES, backend deploy/restart 가능성이 있다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Lane: Green
Reader execution: PASS
No-send: YES
No-write: YES
No-deploy: YES
No-publish: YES
Source confidence: medium_high for biocom, medium for thecleancoffee
Notes:
- thecleancoffee status blank 6건 / 481,122원은 included_with_warning.
- 주문 정본 같은-window 총액은 브랜드검색 exact attribution 값이 아니다.
```
