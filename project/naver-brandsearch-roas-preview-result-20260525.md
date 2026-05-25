# Naver 브랜드검색 비용 join ROAS preview 결과

작성 시각: 2026-05-25 22:10 KST
기준일: 2026-05-25
문서 성격: VM Cloud 수동 비용 cache read-only reader + 브랜드검색 참고 ROAS preview 결과
상위 문서: [[naver-brandsearch-manual-cost-source-policy-20260525]], [[naver-brandsearch-manual-cost-cache-write-result-20260525]]
산출 JSON: `data/project/naver-brandsearch-roas-preview-20260525.json`
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
    - gdn/attribution-data-source-decision-guide-20260511.md
  required_context_docs:
    - project/naver-brandsearch-manual-cost-source-policy-20260525.md
    - project/naver-brandsearch-manual-cost-cache-write-result-20260525.md
    - report/reportbiocom.md
    - report/reportcoffee.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only aggregate query
    - local no-send reader script creation
    - local JSON preview generation
    - report documentation update
  forbidden_actions:
    - VM Cloud SQLite write
    - operating DB write
    - backend deploy/restart
    - Naver Ads setting change
    - Naver conversion send/upload
    - GA4/Meta/Google/TikTok platform send
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud naver_brandsearch_manual_cost_daily + site_landing_ledger + attribution_ledger aggregate read-only
    window: requested 2026-05-11..2026-05-25 KST, effective site windows below
    freshness: queried 2026-05-25 22:10 KST, order source cross-check queried 2026-05-25 22:46 KST, cost cache max cached_at 2026-05-25 12:52:49, landing max 2026-05-25T13:43:11Z, attribution max 2026-05-25T13:43:11Z
    confidence: medium_high for biocom cost/evidence overlap, medium for thecleancoffee landing count due recent landing capture
```

## 10초 요약

브랜드검색 비용을 리포트에 붙이는 read-only/no-send reader를 만들고 실행했다.

이제 VM Cloud의 수동 기간 배분 비용 cache를 site/window별로 읽고, 고객 유입 장부와 결제완료 marker를 같은 KST 기간에 붙여 preview할 수 있다. 단, 여기의 ROAS는 `VM Cloud 결제완료 marker 기준 참고 ROAS`이고, 운영DB/Imweb 주문 정본으로 닫은 최종 내부 confirmed ROAS는 아니다.

## 추가한 reader

파일:

```text
backend/scripts/naver-brandsearch-roas-preview.ts
```

실행:

```bash
cd backend
npx tsx scripts/naver-brandsearch-roas-preview.ts \
  --until=2026-05-25 \
  --output=../data/project/naver-brandsearch-roas-preview-20260525.json
```

mode:

```text
read_only_no_send
```

읽는 source:

- 비용: VM Cloud `naver_brandsearch_manual_cost_daily`
- 유입: VM Cloud `site_landing_ledger channel_classified='naver_brandsearch'`
- 결제완료 marker: VM Cloud `attribution_ledger touchpoint='payment_success' AND payment_status='confirmed'` 중 Naver 브랜드검색 marker 보유 aggregate

읽지 않는 것:

- raw order/payment/click/member/email/phone 값
- Naver Ads 원본 설정
- 운영DB

## preview 결과

요청 window:

```text
2026-05-11..2026-05-25 KST
```

site별 effective window:

- 바이오컴은 비용 계약이 2026-05-22부터라 `2026-05-22..2026-05-25 KST`만 계산했다.
- 더클린커피는 비용 계약이 2026-05-11부터라 `2026-05-11..2026-05-25 KST`를 계산했다.

| site | effective window | 브랜드검색 비용 | 브랜드검색 landing rows | VM Cloud 결제완료 marker rows | VM Cloud 결제완료 marker 금액 | 참고 ROAS |
|---|---|---:|---:|---:|---:|---:|
| biocom | 2026-05-22..2026-05-25 | 205,336원 | 132 | 18 | 4,786,416원 | 23.31 |
| thecleancoffee | 2026-05-11..2026-05-25 | 770,005원 | 14 | 11 | 352,564원 | 0.46 |

전체:

| 항목 | 값 |
|---|---:|
| 브랜드검색 비용 합계 | 975,341원 |
| VM Cloud 결제완료 marker 금액 합계 | 5,138,980원 |
| 브랜드검색 landing rows 합계 | 146 |

## 주문 정본 cross-check 추가 결과

운영DB/Imweb 주문 정본을 같은 window로 read-only 재조회했다. 상세는 [[naver-brandsearch-order-source-crosscheck-result-20260525]]에 둔다.

| site | effective window | 브랜드검색 marker ROAS | 주문 정본 같은-window source | 주문 정본 같은-window 총액 | 해석 |
|---|---|---:|---|---:|---|
| biocom | 2026-05-22..2026-05-25 | 23.31 | 운영DB `tb_iamweb_users PAYMENT_COMPLETE` | 199건 / 47,306,484원 | marker 매출이 주문 정본 총액 안에 들어가는지 확인하는 sanity check |
| thecleancoffee | 2026-05-11..2026-05-25 | 0.46 | VM Cloud `imweb_orders(site='thecleancoffee')` NPay primary candidate | 230건 / 12,830,000원 | 브랜드검색 exact 매출이 아니라 NPay 주문 정본 총액 sanity check |

주의:

- 주문 정본 같은-window 총액은 브랜드검색에서 온 주문만의 확정 매출이 아니다.
- 예산 판단에는 `브랜드검색 marker ROAS`를 보수 참고값으로 보고, 주문 정본 총액은 marker가 말이 되는 범위인지 확인하는 상한/분모 sanity check로만 쓴다.
- 더클린커피는 status blank 6건 / 481,122원이 `included_with_warning`이다.

## 주문 단위 bridge preview 추가 결과

주문 정본 총매출 sanity check 다음 단계로, 브랜드검색 marker를 주문 정본과 같은 주문 단위로 붙이는 read-only/no-send preview를 실행했다. 상세는 [[naver-brandsearch-order-bridge-preview-result-20260525]]에 둔다.

| site | window | marker 결제완료 | exact bridge | ambiguous | no_bridge | marker ROAS | exact bridge ROAS |
|---|---|---:|---:|---:|---:|---:|---:|
| biocom | 2026-05-22..2026-05-25 | 18건 / 4,786,416원 | 13건 / 3,364,432원 | 2건 | 3건 | 23.31 | 16.39 |
| thecleancoffee | 2026-05-11..2026-05-25 | 11건 / 352,564원 | 11건 / 352,564원 | 0건 | 0건 | 0.46 | 0.46 |

해석:

- 더클린커피는 현재 marker 범위에서는 주문 정본 bridge가 닫혔다.
- 바이오컴은 marker 18건 중 5건이 unresolved라서 exact bridge ROAS 16.39를 보수값으로 두고, marker ROAS 23.31은 참고값으로 분리한다.
- 주문키 비교는 one-way hash로 수행했고 raw 주문/결제/고객 식별자는 출력하지 않았다.

## 해석

### 바이오컴

바이오컴은 2026-05-22부터 비용과 유입/결제 marker가 같은 window에서 겹친다.

preview 기준 ROAS 23.31은 높게 보이지만, 이것은 `VM Cloud 결제완료 marker 기준 참고값`이다. 예산 판단용 최종값으로 쓰려면 운영DB 결제완료 주문 정본과 같은 기간으로 cross-check해야 한다.

### 더클린커피

더클린커피는 비용 cache는 2026-05-11부터 있지만, 고객 유입 장부에서 브랜드검색 landing capture가 최근에 열린 영향이 있다.

그래서 landing rows는 과거 유입 전체를 대표하지 않을 수 있다. 결제완료 marker 금액 352,564원과 ROAS 0.46은 `현재 잡힌 marker 기준 preview`로만 본다.

## 하지 않은 것

- VM Cloud SQLite write 0건.
- 운영DB write 0건.
- backend deploy/restart 0건.
- Naver Ads 설정 변경 0건.
- Naver conversion send/upload 0건.
- GA4/Meta/Google/TikTok platform send 0건.
- GTM publish 0건.
- raw identifier output 0건.

## 다음 할일

### Auto Green

1. 바이오컴 unresolved bridge 5건을 원인별로 분해한다.
   - 무엇: ambiguous 2건과 no_bridge 3건을 source mapping gap, sync lag, duplicate amount/date 후보 등으로 분류한다.
   - 왜: 바이오컴은 exact bridge ROAS 16.39와 marker ROAS 23.31 사이 차이가 커서 예산 판단 전에 원인 분해가 필요하다.
   - 성공 기준: 5건이 원인 bucket으로 분류된다.
   - 승인 필요: NO, read-only/no-send.

2. Slack/report no-send preview에 Naver 브랜드검색 라인을 추가한다.
   - 무엇: 광고비 섹션에서 `Naver 브랜드검색`을 파워링크/쇼핑검색과 별도 라인으로 넣는다.
   - 왜: 브랜드검색은 월정액/기간 배분 비용이라 일반 daily stats와 해석이 다르다.
   - 성공 기준: Slack no-send JSON/Markdown에 비용 source, window, confidence, ROAS caveat가 함께 표시된다.
   - 승인 필요: no-send preview는 NO, 실제 Slack send는 YES.

### Approval Needed

1. VM Cloud API/frontend에 reader를 붙이는 배포.
   - 무엇: 로컬 reader가 아니라 대시보드/API가 cache를 직접 읽도록 backend route를 연결한다.
   - 왜: 수동 실행 없이 화면/리포트가 브랜드검색 비용을 자동 반영하려면 필요하다.
   - 승인 필요: YES, backend deploy/restart 가능성이 있다.

## Auditor verdict

```text
Auditor verdict: PASS
Lane: Green
Reader execution: PASS
No-send: YES
No-write: YES
No-deploy: YES
No-publish: YES
Source confidence: medium_high for biocom, medium for thecleancoffee
```
