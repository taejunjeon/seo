작성 시각: 2026-05-25 15:04 KST
기준일: 2026-05-25
문서 성격: VM Cloud read-only 확인 + 비용 join preview + 과거 오분류 backfill dry-run 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - project/biocom-brandsearch-last-touch-classifier-vm-deploy-result-20260525.md
    - project/okr-naver-brandsearch-roas-capi-progress-20260525.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only query
    - cost join preview
    - historical misclassification dry-run
    - result documentation
  forbidden_actions:
    - production DB write
    - VM Cloud SQLite update/backfill apply
    - Naver Ads setting change
    - external platform send/upload
    - GTM publish
  source_window_freshness_confidence:
    site: biocom
    primary_source: VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
    smoke_window: 2026-05-25 14:45-15:00 KST
    cost_window: 2026-05-18..2026-05-24 KST
    backfill_dry_run_window: 2026-05-11..2026-05-25 KST
    freshness: live ledger fresh for tracking, naver_ads_daily cached through 2026-05-24
    confidence: 0.86
```

## 10초 요약

TJ님이 2026-05-25 14:52 KST쯤 아이폰 에어에서 만든 네이버 브랜드검색 유입과 NPay 구매 버튼 클릭은 VM Cloud 보조 원장에 남았다. 고객 유입 장부는 `naver_brandsearch`로 분류했고, NPay 의도 장부에는 도시락 상품의 NPay 버튼 클릭이 잡혔다.

다만 브랜드검색 비용 join은 아직 예산 판단용 ROAS까지 닫히지 않았다. 네이버 광고 일별 장부에는 브랜드검색 노출/클릭/플랫폼 주장 전환값은 있지만, 비용 컬럼이 0으로 들어와 있어 실제 브랜드검색 비용 원천을 별도로 연결해야 한다.

## 확인한 것

### 1. 아이폰 에어 네이버 브랜드검색 smoke

- source: VM Cloud SQLite `site_landing_ledger`, `attribution_ledger`, `npay_intent_log`
- window: 2026-05-25 14:45-15:00 KST
- site: biocom
- freshness: 실시간 수집 장부
- confidence: 86%

확인 결과:

- 14:50 KST대에 고객 유입 장부가 `naver_brandsearch`로 분류됐다.
- `source_breakdown`은 `naverbrandsearch_biocom_mo_mainhome`으로 들어왔다.
- 같은 구간 NPay 의도 장부에 `팀키토 오리지널 도시락 8종 골라담기` 상품의 `.npay_btn_pay` 클릭이 1건 기록됐다.
- 해당 NPay 의도 row는 `client_id_present=1`, `ga_session_id_present=1`, `gclid_present=0`, `fbclid_present=0`이다.

주의:

- 14:52 KST 근처 attribution 장부에는 `payment_success` 이벤트도 1건 있다. 이것은 결제완료 화면 이벤트 기록이지, 운영DB/정산 기준 구매 확정 정본으로 단정하면 안 된다.
- 현재 `imweb_orders`는 최신 주문 상태가 2026-05-08 주문권까지로 보이며, 2026-05-25 주문 상태 대조에는 freshness gap이 있다.

## Naver 브랜드검색 비용 join preview

### 현재 연결 가능한 값

source: VM Cloud SQLite `naver_ads_daily`

`naver_ads_daily`에는 네이버 브랜드검색 캠페인이 있다.

- site: `biocom`
- active campaign type: `BRAND_SEARCH`
- active campaign name: `브랜드검색01_바이오컴`
- 최신 일자: 2026-05-24
- latest cached_at: 2026-05-24 22:20:34

2026-05-18..2026-05-24 KST preview:

| KST date | Naver Ads clicks | Naver Ads cost | Naver Ads claimed conv count | Naver Ads claimed conv value | VM checkout_started rows | VM confirmed payment_success rows |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-24 | 69 | 0 | 23 | 2,264,681 | 13 | 6 |
| 2026-05-23 | 73 | 0 | 12 | 1,532,367 | 11 | 4 |
| 2026-05-22 | 89 | 0 | 23 | 1,677,939 | 15 | 6 |
| 2026-05-21 | 0 | 0 | 0 | 0 | 11 | 0 |
| 2026-05-20 | 0 | 0 | 3 | 0 | 10 | 0 |
| 2026-05-19 | 0 | 0 | 2 | 245,001 | 12 | 0 |
| 2026-05-18 | 0 | 0 | 0 | 0 | 17 | 0 |

해석:

- 네이버 광고 플랫폼 주장값은 이미 들어온다.
- 내부 유입/결제 단계 evidence도 들어온다.
- 하지만 비용이 0이라 `브랜드검색 비용 대비 내부 confirmed 매출` 계산은 아직 불가하다.

### join 설계

1. 비용 source
   - 현재 후보: `naver_ads_daily.sales_amt_krw`
   - 문제: `BRAND_SEARCH`에서 0으로 저장됨.
   - 보강 후보: 네이버 광고 API 원본 필드 확인, 브랜드검색 월정액/계약 비용 별도 입력 장부, 또는 네이버 광고 관리자 비용 export.

2. 클릭 source
   - 현재 후보: `naver_ads_daily.clk_cnt`
   - 내부 후보: `site_landing_ledger.channel_classified='naver_brandsearch'`
   - 주의: `site_landing_ledger` 과거 row는 2026-05-25 classifier 배포 전 오분류가 있어 backfill 필요.

3. 매출 source
   - 예산 판단용 primary: 운영DB/주문 정본의 실제 구매 확정/취소 반영 매출.
   - 보조 evidence: VM Cloud `attribution_ledger`의 `payment_success`.
   - 금지 proxy: NPay 버튼 클릭만 구매완료로 세지 않는다.

4. same-window 기준
   - KST date 기준으로 `naver_ads_daily.date`와 내부 유입/결제/주문 확정일을 분리해 본다.
   - 보고에는 `Naver Ads claimed ROAS=광고 플랫폼 주장값`과 `internal confirmed ROAS=주문 정본 기준값`을 분리한다.

## 과거 오분류 row backfill dry-run

source: VM Cloud SQLite `site_landing_ledger`

window: 2026-05-11..2026-05-25 KST

조건:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `source_breakdown` 중 하나에 `naverbrandsearch` marker가 있음.
- 현재 `channel_classified <> 'naver_brandsearch'`.
- 실제 UPDATE는 실행하지 않음.

dry-run 결과:

| site | current channel | source breakdown | click id type | rows to change |
|---|---|---|---|---:|
| biocom | self_internal | biocom.kr | none | 259 |
| biocom | organic_search | m.search.naver.com | none | 47 |
| biocom | organic_search | search.naver.com | none | 21 |
| biocom | direct | empty | none | 12 |
| biocom | paid_search | google.com | gclid hash | 5 |
| biocom | organic_search | orders.pay.naver.com | none | 3 |
| biocom | organic_search | pay.naver.com | none | 1 |
| biocom | organic_search | shopping.naver.com | none | 1 |
| biocom | referral | accounts.kakao.com | none | 1 |

합계: 350 rows.

해석:

- 2026-05-25 배포 전에는 네이버 브랜드검색 UTM marker가 남아 있어도 내부 이동, Naver referrer, stale Google click id 때문에 다른 채널로 분류된 row가 있었다.
- 특히 `paid_search/google.com/gclid hash` 5건은 TJ님이 지적한 "이전 touch Google click id가 마지막 Naver 브랜드검색보다 우선되는 문제" 후보와 직접 맞다.
- backfill apply는 운영성 write이므로 별도 승인 전에는 하지 않는다.

## 하지 않은 것

- VM Cloud SQLite UPDATE 0건.
- 운영DB write 0건.
- 네이버 광고 설정 변경 0건.
- 외부 플랫폼 전송/upload 0건.
- GTM publish 0건.
- raw order/payment/click/member/email/phone 출력 0건.

## 병렬 에이전트 사용 여부

병렬 에이전트는 사용하지 않았다.

이유:

- 이번 작업은 같은 VM Cloud SQLite 안에서 같은 시간창을 맞춰 봐야 하는 정합성 확인이다.
- 여러 에이전트가 각자 다른 window/source를 잡으면 "없음", "source 다름", "sync 지연"이 섞일 위험이 더 크다.
- 대신 병렬 shell 쿼리로 스키마, 비용 preview, backfill dry-run을 동시에 조회했다.

## 다음 행동

1. Auto Green — backfill apply 승인안 작성
   - 무엇: 350 rows를 `naver_brandsearch`로 바꿀 경우 영향과 rollback 계획을 문서화한다.
   - 왜: 비용 join에서 과거 내부 유입 수가 0 또는 낮게 보이는 문제를 제거한다.
   - 성공 기준: dry-run SQL, backup path, apply SQL, rollback SQL, post-check SQL이 한 문서에 있다.
   - 승인: 문서 작성은 NO, apply는 YES.

2. Auto Green — 브랜드검색 비용 source gap 조사
   - 무엇: `BRAND_SEARCH` 비용이 0으로 들어오는 이유를 네이버 광고 API/현재 sync 코드 기준으로 분리한다.
   - 왜: 비용이 없으면 ROAS가 아니라 클릭/전환수 비교만 가능하다.
   - 성공 기준: `sales_amt_krw=0`이 API 원본 한계인지, sync bug인지, 월정액 별도 비용인지 분리한다.
   - 승인: NO, read-only.

3. Yellow — backfill apply
   - 무엇: 승인 후 VM Cloud 고객 유입 장부의 과거 오분류 row를 수정한다.
   - 왜: 2026-05-11 이후 네이버 브랜드검색 유입과 주문 후보를 같은 기준으로 볼 수 있게 한다.
   - 성공 기준: 변경 전 backup, apply row count 350, post-check에서 동일 조건 잔여 0, daily landing count 재계산.
   - 승인: YES, VM Cloud SQLite write.
