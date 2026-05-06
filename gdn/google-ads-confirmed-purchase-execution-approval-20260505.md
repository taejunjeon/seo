# Google Ads 실제 결제완료 주문만 구매로 알려주는 새 전환 통로 실행 승인안

작성 시각: 2026-05-05 11:40 KST
요청 유형: Red Lane 실행 승인 문서
대상: biocom Google Ads account `2149990943`, Google tag `AW-304339096`
기술명: `BI confirmed_purchase` 전환, offline conversion import 또는 Data Manager API 기반 confirmed purchase 전송
관련 문서: [[!gdnplan]], [[google-ads-campaign-signal-audit-20260505]], [[google-ads-purchase-primary-change-approval-20260505]], [[google-ads-npay-quality-deep-dive-20260505]], [[../total/!total]]
현재 상태: 문서 작성과 로컬 no-send dry-run 스크립트 작성은 Green Lane으로 완료. Google Ads 설정 변경, conversion upload, GTM publish, 운영 DB write는 승인 전 금지.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  lane: Red for execution
  allowed_actions_now:
    - approval document
    - Google Ads API read-only query
    - GA4 BigQuery read-only query
    - no-send payload design
    - local JSON dry-run design
  forbidden_actions_until_explicit_approval:
    - Google Ads conversion action mutation
    - Google Ads conversion upload
    - Google Ads Data Manager event ingest
    - GTM Production publish
    - backend deploy
    - operating DB write/import
    - permanent env ON
  source_window_freshness_confidence:
    google_ads_api:
      source: "Google Ads API v22 customers/2149990943"
      output: "data/google-ads-campaign-signal-audit-20260505-last14.json"
      window: "LAST_14_DAYS"
      fetched_at: "2026-05-05 11:39 KST"
      confidence: 0.94
    ga4_bigquery:
      source: "project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*"
      output: "data/biocom-paid-channel-quality-20260505-last7.json, data/biocom-paid-channel-quality-20260505-last28.json"
      window: "2026-04-06~2026-05-03"
      freshness: "archive latest 2026-05-03"
      confidence: 0.86
```

## 10초 결론

Google Ads에 새 구매 신호가 필요하다.
지금 Google Ads의 `구매완료` Primary 전환은 이름은 구매완료지만, 실제 label은 아임웹 NPay count 경로 `AW-304339096/r0vuCKvy-8caEJixj5EB`와 일치한다.
최근 14일 Google Ads `Conv. value` `123,495,273원` 중 `123,495,262원`이 이 label에서 나왔다.

하지만 `NPay 매출을 빼자`는 뜻은 아니다.
문제는 `NPay 클릭/결제 시작`을 구매완료로 세는 것이다.
앞으로는 `홈페이지 구매하기 결제완료`와 `NPay 실제 결제완료 주문`을 둘 다 구매 매출로 포함하되, 클릭이나 결제 시작은 구매로 세지 않아야 한다.

권장 실행안은 `새 BI confirmed_purchase 전환을 만들고, 실제 결제완료 주문만 Google Ads에 알려주는 방식`이다.
처음에는 no-send dry-run과 Secondary 관찰로 시작하고, 검증 후 기존 `구매완료` action `7130249515`를 Secondary로 낮춘다.

Codex 추천은 `실행 준비 90%`, 실제 Google Ads 전환 전송/Primary 변경은 `TJ님 명시 승인 후 82%`다.

2026-05-05 11:47 KST에 로컬 개발 DB 기준 no-send dry-run 스크립트까지 만들었다.
로컬 ledger는 `2026-04-12 13:13 KST`까지라 최종 업로드 정본으로 쓰면 안 된다.
하지만 `보낼 수 있는 row`, `막히는 row`, `block_reason` 구조를 확인하는 용도로는 유효하다.

## 무엇을 하는가

이 작업은 Google Ads에게 새로운 기준을 가르치는 일이다.

현재 Google은 `NPay count label이 찍힌 이벤트`를 구매완료로 학습하고 있다.
새 기준에서는 내부 주문 장부에서 아래 조건을 만족한 주문만 Google Ads 구매로 보낸다.

```text
결제 완료 주문
+ 취소/환불 반영 전 원 주문 금액 또는 순매출 기준 명시
+ 홈페이지 결제, NPay 결제 모두 포함
+ 클릭 ID(gclid/gbraid/wbraid) 또는 향상된 전환 매칭 근거 있음
+ 중복 order_id 방지 통과
```

즉 `NPay`를 배제하는 것이 아니라, `NPay 클릭`과 `NPay 실제 결제완료`를 분리한다.

## 왜 하는가

Google Ads의 Primary 전환은 성적표와 자동입찰 학습에 쓰인다.
공식 Google Ads 도움말도 Primary 전환은 `Conversions` 컬럼에 보고되고, 해당 goal이 입찰에 쓰이면 bidding에도 사용된다고 설명한다.
Secondary 전환은 기본적으로 관찰용이며 `All conversions`에 표시된다.

현재 `구매완료` Primary 전환이 실제 결제완료가 아니라 NPay count label이면, Google 자동입찰은 실제 구매자가 아니라 `NPay count가 잘 찍히는 유입`을 좋은 유입으로 배울 수 있다.
그래서 Google Ads ROAS가 높아 보여도 내부 confirmed ROAS와 맞지 않는다.

공식 근거:

- [Google Ads Help: About primary and secondary conversion actions](https://support.google.com/google-ads/answer/11461796?hl=en)
- [Google Ads API: Manage offline conversions](https://developers.google.com/google-ads/api/docs/conversions/upload-offline)
- [Google Ads Help: Set up offline conversions using GCLID](https://support.google.com/google-ads/answer/7012522?hl=en)
- [Google Data Manager API: Send conversion events](https://developers.google.com/data-manager/api/devguides/events)

## 현재 확인된 숫자

source: Google Ads API v22, account `2149990943`
window: `LAST_14_DAYS`
fetched_at: 2026-05-05 11:39 KST
confidence: 0.94

| 항목 | 값 | 해석 |
|---|---:|---|
| Google Ads 광고비 | 11,116,542원 | 플랫폼 비용 |
| Google Ads `Conv. value` | 123,495,273원 | Google이 구매 전환값이라고 보는 값 |
| Primary NPay label value | 123,495,262원 | `구매완료` NPay count label에서 나온 값 |
| Primary NPay 비중 | 사실상 100% | Google Ads ROAS 분자가 거의 전부 오염 label |
| Google Ads platform ROAS | 11.11x | 예산 판단용 내부 ROAS로 쓰면 안 됨 |

source: GA4 BigQuery archive `analytics_304759974_hurdlers_backfill.events_*`
window: 2026-04-27~2026-05-03
freshness: archive latest 2026-05-03
confidence: 0.86

| 유입 | 세션 | 평균 체류 | 90% 스크롤 | 일반 결제 시작 | NPay 클릭 | 홈페이지 purchase |
|---|---:|---:|---:|---:|---:|---:|
| Google Ads | 6,879 | 36.41초 | 1,744 / 25.35% | 136 / 1.98% | 577 / 8.39% | 4건 / 336,917원 |
| Meta | 23,544 | 14.67초 | 3,049 / 12.95% | 337 / 1.43% | 26 / 0.11% | 199건 / 60,799,430원 |

해석:

- Google Ads 유입은 체류, 90% 스크롤, 장바구니/결제 시작 행동이 Meta보다 약하지 않다.
- 그러나 홈페이지 purchase로 닫히는 비율은 낮고, NPay 클릭 비율이 높다.
- 따라서 `Google Ads 전체 유입이 전부 저품질`이라기보다 `구매 신호가 NPay 클릭/결제시작 쪽으로 오염되어 있고, 실제 결제완료와 분리되지 않았다`가 더 정확하다.

## NPay 변경 시점

GA4/GTM 기준으로 NPay 클릭이 purchase처럼 잡히던 문제는 아래 시점에 줄었다.

```text
2026-04-24 23:45 KST
GTM live v138: ga4_purchase_duplicate_fix_20260424
tag [43] GA4_구매전환_Npay: purchase -> add_payment_info
tag [48] homepage purchase 중복 경로: paused
```

BigQuery raw에서 `2026-04-25`부터 NPay purchase-like는 0으로 떨어졌다.
`2026-04-27` 3건 / 35,700원은 잔여 edge case다.

하지만 Google Ads는 아직 바뀌지 않았다.
Google Ads primary `구매완료` NPay value는 v138 이후에도 매일 발생했다.
따라서 `GA4/GTM 오염은 대부분 닫힘`, `Google Ads Primary 오염은 아직 열림`으로 분리한다.

## 실행 후보 비교

### 후보 A. Google Data Manager API로 confirmed purchase 보내기

추천/자신감: 88%

무엇:
Google Data Manager API를 통해 실제 결제완료 주문을 Google Ads 전환 데이터로 보낸다.

왜:
Google 공식 문서가 신규 offline conversion workflow는 Data Manager API 업그레이드를 권장한다고 명시한다.
Data Manager API는 Google Ads로 offline conversion, enhanced conversions for leads, conversion events를 보낼 수 있다.

장점:

- 신규 workflow 방향과 맞다.
- 향상된 전환, offline conversion, conversion event를 한 구조로 설계하기 좋다.
- `validateOnly` 같은 검증 중심 흐름을 설계하기 좋다.

한계:

- 현재 계정/프로젝트에서 Data Manager API 권한과 partner link 설정이 되어 있는지 확인해야 한다.
- 기존 Google Ads API 클라이언트보다 초기 설정이 더 필요할 수 있다.

판단:
장기 정본 경로 1순위다.
다만 실제 ingest는 Red Lane이므로 문서/권한 확인/no-send payload 검증까지만 먼저 한다.

### 후보 B. Google Ads API `ConversionUploadService`로 offline conversion import

추천/자신감: 76%

무엇:
Google Ads API의 `ClickConversion`을 만들어 `gclid`, `gbraid`, `wbraid`, 전환 시각, 전환값, 통화, order id를 업로드한다.

왜:
기존 Google Ads API 인증이 이미 read-only로 동작하고 있어 구현 진입이 빠르다.
공식 문서도 `ClickConversion` 객체와 `ConversionUploadService`를 통한 import 흐름을 설명한다.

장점:

- 현재 repo의 Google Ads API 연결을 활용할 수 있다.
- no-send dry-run, partial failure preview, diagnostics 설계가 쉽다.

한계:

- Google 공식 문서는 신규 workflow에 Google Ads API보다 Data Manager API를 권장한다.
- user-provided data를 쓰는 enhanced conversions for leads 전제 조건과 고객 데이터 약관 확인이 필요하다.

판단:
Data Manager API 권한 확인 전까지 fallback 실행 경로로 둔다.
실제 upload는 TJ님 승인 전 금지다.

### 후보 C. Enhanced conversions 보강

추천/자신감: 65%

무엇:
이메일, 전화번호 같은 1st-party customer data를 정규화/해시해서 매칭 품질을 높인다.

왜:
NPay나 리다이렉션 흐름에서 click id가 유실될 수 있다.
해시된 user-provided data는 Google 매칭 정확도와 durability를 높일 수 있다.

장점:

- `gclid`가 없는 주문도 일부 매칭 회복 가능성이 있다.
- cross-device attribution 보정에 도움될 수 있다.

한계:

- NPay 클릭을 구매로 세는 문제를 자동으로 해결하지 않는다.
- 개인정보/동의/약관 확인이 필요하다.

판단:
confirmed purchase 전환의 보조 기능이다.
오염된 Primary purchase 교체의 본체는 아니다.

### 후보 D. 결제완료 페이지 client-side 태그만 사용

추천/자신감: 45%

무엇:
`shop_payment_complete` 같은 결제완료 페이지에서 Google Ads purchase 태그를 쏜다.

왜:
홈페이지 카드/가상계좌 결제는 빠르게 잡을 수 있다.

장점:

- 구현이 빠르다.
- Tag Assistant로 검증하기 쉽다.

한계:

- NPay가 자사몰 결제완료 페이지로 돌아오지 않으면 실제 NPay 결제완료 매출을 놓친다.
- 리다이렉션/브라우저 차단/중복 태그 문제가 남는다.

판단:
보조 신호로는 가능하지만, NPay 포함 정본 purchase 경로로는 부족하다.

## 권장 실행 순서

1. `BI confirmed_purchase` 새 전환 action을 만든다.
2. 처음에는 Secondary 또는 observation 상태로 둔다.
3. 실제 결제완료 주문만 no-send payload로 만든다.
4. `gclid`, `gbraid`, `wbraid`, `order_id`, `conversion_time`, `value`, `currency` fill rate를 본다.
5. Data Manager API와 Google Ads API 방식 중 실제 계정에서 가능한 경로를 확정한다.
6. 7일 병렬 관찰 후 기존 `구매완료` action `7130249515`를 Secondary로 낮춘다.
7. 24시간, 72시간, 7일 단위로 platform value, 내부 confirmed revenue, Google Ads spend, NPay confirmed 주문을 같이 본다.

## no-send dry-run payload 계약

no-send dry-run은 Google에 아무것도 보내지 않고, 보낼 후보만 로컬 JSON으로 만드는 단계다.

첫 output:

```text
data/google-ads-confirmed-purchase-dry-run-20260505-local.json
```

실행 명령:

```bash
cd backend
npx tsx scripts/google-ads-confirmed-purchase-dry-run.ts --start=2026-04-01 --end=2026-05-03 --json > ../data/google-ads-confirmed-purchase-dry-run-20260505-local.json
```

필수 필드:

| 필드 | 의미 | 필수 여부 |
|---|---|---|
| `site` | `biocom` | YES |
| `order_id` | 내부 주문번호 또는 아임웹 주문번호 | YES |
| `payment_key` | 결제 중복 방지 키 | YES |
| `conversion_time` | Google Ads가 받을 결제완료 시각 | YES |
| `value` | 결제완료 금액 또는 net revenue 기준 금액 | YES |
| `currency` | `KRW` | YES |
| `payment_method` | card, vbank, npay 등 | YES |
| `source_order_status` | confirmed, canceled, refunded | YES |
| `gclid` | Google click id | 있으면 high confidence |
| `gbraid` | iOS/app/web alternate click id | 있으면 high confidence |
| `wbraid` | iOS/web alternate click id | 있으면 high confidence |
| `email_sha256` | 향상된 전환 보조 매칭 | 동의/약관 확인 후 |
| `phone_sha256` | 향상된 전환 보조 매칭 | 동의/약관 확인 후 |
| `send_candidate` | 실제 전송 후보 여부 | YES |
| `block_reason` | 전송 후보 제외 이유 | 제외 row는 YES |

로컬 dry-run 결과:

| 항목 | 값 | 해석 |
|---|---:|---|
| source | `backend/data/crm.sqlite3#attribution_ledger` | 로컬 개발 DB. 최신 정본 아님 |
| source max logged_at | `2026-04-12T04:13:40.581Z` | 최근 Google Ads 판단에는 stale |
| confirmed biocom row | 529건 | 로컬 결제완료 row |
| total value | 131,005,441원 | 로컬 amount 합계 |
| Google click id row | 13건 | `gclid/gbraid/wbraid`가 있어 승인 후 후보 가능 |
| 승인 후 후보 가능 row | 13건 | 현재는 모두 `send_candidate=false` |
| `missing_google_click_id` | 516건 | 랜딩/체크아웃 시점 click id 저장이 핵심 병목 |
| duplicate order | 3건 | order/payment key 중복 방지 필요 |

해석:

- 로컬 ledger만으로도 `Google Ads에 실제 결제완료만 보내려면 click id 저장률이 병목`이라는 점이 확인된다.
- 지금 결과는 stale local fallback이므로 최종 업로드 후보가 아니다.
- 다음 no-send dry-run은 운영 DB, TJ 관리 Attribution VM, GA4 BigQuery를 read-only로 조인해야 한다.

전송 후보 조건:

```text
payment_status == confirmed
site == biocom
value > 0
conversion_time exists
order_id or payment_key exists
duplicate_guard == pass
at least one of gclid/gbraid/wbraid or approved enhanced conversion identifier exists
not already sent to Google Ads
TJ approval exists
```

block reason 예시:

| block_reason | 뜻 |
|---|---|
| `read_only_phase` | 지금은 실제 전송 단계가 아님 |
| `approval_required` | TJ님 승인 전이라 전송 금지 |
| `missing_google_click_id` | `gclid/gbraid/wbraid`가 없음 |
| `missing_order_id` | 주문 식별자가 없음 |
| `not_confirmed` | 결제완료 주문이 아님 |
| `duplicate_guard_missing` | 중복 방지 검증 전 |
| `already_sent` | 이미 Google Ads에 보낸 주문 |
| `npay_click_only` | NPay 클릭/결제시작일 뿐 결제완료가 아님 |

## 허용 범위

이 문서 작성 시점에 승인 없이 가능한 일:

- Google Ads API read-only 조회.
- GA4 BigQuery read-only 조회.
- no-send payload 스키마 설계.
- no-send dry-run script 작성.
- 로컬 JSON 산출.
- 문서 링크 검증과 typecheck.

TJ님 명시 승인 전까지 금지:

- Google Ads conversion action 생성/변경.
- Google Ads conversion upload.
- Google Data Manager API event ingest.
- 기존 `구매완료` action `7130249515` Primary/Secondary 변경.
- GTM Production publish.
- 아임웹 header/footer 변경.
- backend 운영 배포.
- 운영 DB write/import.

## Hard Fail

아래 중 하나라도 나오면 실제 실행을 중단한다.

1. 새 confirmed purchase 후보의 `gclid/gbraid/wbraid` fill rate가 너무 낮아 Google이 학습할 수 없다.
2. NPay confirmed 주문과 NPay click-only 로그를 구분하지 못한다.
3. order id 중복 방지 기준이 없다.
4. `value`가 gross인지 net인지 문서화되지 않았다.
5. 기존 `구매완료`를 Secondary로 낮추면 모든 active campaign의 구매 goal이 비어 버린다.
6. Data Manager API 또는 Google Ads API 권한이 write 범위를 요구하는데 승인 문구가 없다.

## Success Criteria

성공 기준:

1. 새 `BI confirmed_purchase` 후보 row는 실제 결제완료 주문만 포함한다.
2. 홈페이지 구매와 NPay 실제 결제완료 주문이 모두 포함된다.
3. NPay 클릭/결제시작은 purchase 후보에서 제외된다.
4. Google Ads 플랫폼 ROAS와 내부 confirmed ROAS가 문서와 화면에서 분리된다.
5. 7일 병렬 관찰 후 기존 `구매완료` NPay label이 purchase primary 중심에서 빠질 수 있다.
6. 변경 후 광고비 소진은 줄고, 내부 confirmed 매출 급락은 없다.

## Rollback

문제가 생기면 아래 순서로 되돌린다.

1. 새 `BI confirmed_purchase`를 Secondary 또는 observation 상태로 둔다.
2. Google Ads upload job을 중단한다.
3. 기존 `구매완료` action 변경을 원복할지 판단한다.
4. 변경 전후 24시간의 Google Ads API, GA4 raw, 내부 confirmed order를 대조한다.
5. PM/PMax 예산 감액 또는 pause test를 별도 유지/원복 판단한다.

## TJ님 승인 문구

실제 Google Ads 전환 생성/전송/Primary 변경을 하려면 아래처럼 명시 승인이 필요하다.

```text
YES. Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 `BI confirmed_purchase` 전환 통로 실행 준비를 승인합니다.
단, 첫 단계는 no-send dry-run과 Secondary/observation 준비까지만 허용합니다.
Google Ads conversion upload, Data Manager event ingest, 기존 `구매완료` action 7130249515 Primary 변경은 dry-run 결과 보고 후 별도 승인합니다.
```

## 승인 후 다음 액션

### Codex가 할 일

1. no-send dry-run script 작성
- 추천/자신감: 90%
- Lane: Green
- 상태: 1차 완료. 로컬 개발 DB 기준 스크립트와 JSON을 만들었다.
- 무엇을 하는가: 실제 결제완료 주문을 Google Ads 전송 후보 row로 변환하되 외부로 보내지는 않는다.
- 왜 하는가: 실제 upload 전 `보낼 수 있는 row`, `못 보내는 row`, `막힌 이유`를 주문 단위로 봐야 한다.
- 어떻게 하는가: 1차는 로컬 attribution ledger로 구조를 검증했다. 다음은 Imweb/Toss/NPay confirmed order, VM marketing_intent, GA4 BigQuery click id를 read-only 조인한다.
- 성공 기준: `send_candidate=N` 기본값과 block reason이 붙은 JSON이 생성된다.
- 승인 필요: NO.

2. Data Manager API 권한 가능성 확인
- 추천/자신감: 82%
- Lane: Green read-only / Red if ingest
- 무엇을 하는가: 현재 Google Cloud/Google Ads 연결로 Data Manager API를 쓸 수 있는지 권한과 partner link 필요 여부를 확인한다.
- 왜 하는가: Google 공식 권장 신규 경로가 Data Manager API이므로, 시작부터 legacy API만 보고 설계하면 오래 못 갈 수 있다.
- 어떻게 하는가: 공식 문서와 현재 service account/API enable 상태를 read-only로 확인한다. 실제 event ingest는 하지 않는다.
- 성공 기준: `Data Manager 가능`, `Google Ads API fallback`, `권한 필요` 중 하나로 결정된다.
- 승인 필요: 권한 확인 NO, ingest YES.

### TJ님이 할 일

1. 실제 Google Ads 변경 승인 여부 결정
- 추천/자신감: 82%
- Lane: Red
- 무엇을 하는가: 기존 `구매완료` NPay label을 계속 Primary로 둘지, 새 confirmed purchase 전환을 병렬 준비할지 승인한다.
- 왜 하는가: 현재 Google Ads ROAS 분자는 내부 confirmed 매출이 아니므로 예산 판단과 자동입찰 학습이 계속 흔들린다.
- 어떻게 하는가: 이 문서와 [[google-ads-campaign-signal-audit-20260505]]를 읽고 위 승인 문구를 명시한다.
- 성공 기준: Codex가 no-send dry-run을 먼저 만들고, 실제 Google Ads 전환 변경은 다시 별도 보고 후 진행한다.
- Codex가 대신 못 하는 이유: Google Ads 전환 생성/업로드/Primary 변경은 외부 광고 계정의 학습과 비용에 직접 영향이 있다.
- 승인 필요: YES.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

No-send verified: YES. 이 문서는 전송 설계만 작성했다.
No-write verified: YES. 운영 DB write 없음.
No-deploy verified: YES. backend deploy 없음.
No-publish verified: YES. GTM publish 없음.
No-platform-send verified: YES. Google Ads/Data Manager/GA4/Meta/TikTok 전송 없음.

Notes:

- Google Ads API와 GA4 BigQuery는 read-only로 재조회했다.
- Data Manager API는 공식 문서상 신규 offline conversion workflow 권장 경로이지만, biocom 계정에서 실제 ingest 가능 여부는 아직 확인 전이다.
- NPay 실제 결제완료 매출은 포함해야 한다. 제외해야 하는 것은 NPay 클릭/결제시작을 purchase로 세는 구조다.
