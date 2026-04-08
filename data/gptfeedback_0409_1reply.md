# gptfeedback_0409_1 reply

작성 시각: 2026-04-09 KST  
작성 목적: [gptfeedback_0409_1.md](/Users/vibetj/coding/seo/data/gptfeedback_0409_1.md)에서 요청한 개발 가능 항목을 실제로 진행하고, 결과/한계/다음 계획/요청 자료를 한 번에 정리함.

## 1. 이번에 실제로 개발한 것

이번 턴에서 바로 개발한 것은 4가지요.

1. `/api/ads/site-summary`에 ROAS 비교용 분자들을 추가했소.
- 기존: `revenue`, `roas`
- 추가: `confirmedRevenue`, `confirmedOrders`, `pendingRevenue`, `pendingOrders`, `potentialRevenue`, `potentialRoas`, `metaPurchaseValue`, `metaPurchaseRoas`, `siteConfirmedRevenue`, `bestCaseCeilingRoas`

2. `/api/ads/roas/daily`에 일자별 비교 항목을 추가했소.
- 기존: `date`, `spend`, `revenue`, `roas`
- 추가: `confirmedRevenue`, `pendingRevenue`, `potentialRevenue`, `metaPurchaseValue`, `confirmedRoas`, `potentialRoas`, `metaPurchaseRoas`
- 즉, 이제 일자별로 `광고비 / Meta purchase / Attribution confirmed / Attribution pending / Potential`을 한 번에 비교할 수 있소.

3. `/ads` 프론트엔드에 해석용 UI를 추가했소.
- `Meta purchase ROAS`
- `Attribution confirmed ROAS`
- `confirmed + pending ROAS`
- `best-case ceiling`
- `(unmapped) revenue 경고`
- `일별 ROAS 비교`
- `일자별 비교표`

4. Meta alias audit export를 보강했소.
- 기존보다 더 많은 필드를 export하도록 스크립트를 확장했소.
- `campaign_id / campaign_name / adset_id / adset_name / ad_id / ad_name / effective_status / landingUrl / url_tags / extractedUrlTags / adset attributionSpec`
- 이 결과는 [meta_campaign_alias_audit.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json)에 남겼소.

추가 자료도 만들었소.
- BigQuery same-day purchase 확인용 SQL: [biocom_bigquery_purchase_sameday.sql](/Users/vibetj/coding/seo/data/biocom_bigquery_purchase_sameday.sql)

## 2. 이번에 바꾼 파일

- [backend/src/routes/ads.ts](/Users/vibetj/coding/seo/backend/src/routes/ads.ts)
- [frontend/src/app/ads/page.tsx](/Users/vibetj/coding/seo/frontend/src/app/ads/page.tsx)
- [backend/scripts/export-meta-campaign-alias-audit.ts](/Users/vibetj/coding/seo/backend/scripts/export-meta-campaign-alias-audit.ts)
- [biocom_bigquery_purchase_sameday.sql](/Users/vibetj/coding/seo/data/biocom_bigquery_purchase_sameday.sql)

백업 파일도 수정 전에 만들어 두었소.
- [backend/src/routes/ads.ts.bak_20260409_feedback](/Users/vibetj/coding/seo/backend/src/routes/ads.ts.bak_20260409_feedback)
- [frontend/src/app/ads/page.tsx.bak_20260409_feedback](/Users/vibetj/coding/seo/frontend/src/app/ads/page.tsx.bak_20260409_feedback)
- [backend/scripts/export-meta-campaign-alias-audit.ts.bak_20260409_feedback](/Users/vibetj/coding/seo/backend/scripts/export-meta-campaign-alias-audit.ts.bak_20260409_feedback)

## 3. 지금 확인된 숫자

기준: `biocom`, `last_7d`

### 3-1. 사이트 summary 기준

- 광고비: `₩27,726,230`
- Attribution confirmed revenue: `₩14,586,790`
- Attribution confirmed ROAS: `0.53x`
- Attribution pending revenue: `₩6,813,750`
- Attribution confirmed + pending revenue: `₩21,400,540`
- Attribution confirmed + pending ROAS: `0.77x`
- Meta purchase value: `₩113,305,932`
- Meta purchase ROAS: `4.09x`
- 선택 사이트 confirmed revenue 전체를 Meta에 다 몰아준 상한선: `1.76x`

### 3-2. 핵심 해석

- 현재 운영 메인값은 계속 `Attribution confirmed ROAS 0.53x`로 두는 것이 맞소.
- `0.77x`는 `pending이 나중에 confirmed로 바뀌면 어느 정도까지 올라갈 수 있는지`를 보는 보조값이오.
- `4.09x`는 Meta Ads Manager의 `purchase value / spend` 기준이므로, 운영 판단용 main ROAS가 아니라 reference only로 보는 것이 맞소.
- `1.76x`는 매우 중요하오. 선택 사이트의 confirmed revenue 전체를 Meta에 몰아줘도 `1.76x`인데, 플랫폼 값이 `4.09x`이면 현재 Meta 값은 실제 확정 매출 기준으로 과장되었을 가능성이 높다고 읽어야 하오.

## 4. 최근 footer 추가가 이 차이에 영향을 주는가

영향은 있소. 다만 **전부를 설명하진 못하오.**

영향이 있는 부분:
- 최근에 자체솔루션 footer가 추가되면서 `ga_session_id / client_id / user_pseudo_id / payment_success live row` 품질이 올라가고 있소.
- 그래서 `30일 / 90일`처럼 긴 구간에서는 과거 미수집 구간이 같이 섞여 `Attribution ROAS`가 실제보다 낮아 보이오.
- 이건 문서에서 말한 `cutover bias`, `historical under-coverage`와 같은 의미요.

영향이 있지만 전부는 아닌 부분:
- 최근 7일 `0.53x vs 4.09x` 격차는 footer 추가 시점만으로 설명되진 않소.
- 최근 7일 차이의 주원인은 이쪽이오.
- `Attribution confirmed`는 `confirmed만` 잡음
- `pending`은 메인 ROAS에서 빠짐
- Meta는 `purchase value`를 넓게 잡음
- Meta는 view/click attribution window 영향이 큼
- biocom 결제 페이지 GTM 오류와 legacy firing 가능성이 남아 있음

즉, footer 최근 추가는 **장기 구간을 낮춰 보이게 하는 큰 원인**이지만, **최근 7일의 headline gap 전체를 설명하는 단일 원인**은 아니오.

## 5. 요청 자료 답변

## Q1. 최근 7일 바이오컴 기준 Meta export에서 `campaign_id / campaign_name / adset_id / ad_id / link_url / url_tags / attribution setting`까지 뽑을 수 있는가

짧게 답하면: **대부분 가능하오.**

이번 턴에서 실제로 export 보강을 했소.
- 결과 파일: [meta_campaign_alias_audit.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json)

현재 export에 들어가는 필드:
- `campaignId`
- `campaignName`
- `adsetId`
- `adsetName`
- `adId`
- `adName`
- `status`
- `landingUrl`
- `urlTags`
- `extractedUrlTags`
- `adset attributionSpec`
- 최근 7일 `spend / clicks / impressions / purchaseValue`

중요한 설명:
- 문서에서 말한 `attribution setting`은 Meta UI에서 보이는 표현이고, API 실측에서는 이번 export에서 `adset attributionSpec`으로 확보됐소.
- 예를 들어 sample adset에서는 아래처럼 들어오오.
- `CLICK_THROUGH 7일`
- `VIEW_THROUGH 1일`

사람이 이해하기 쉬운 말로 바꾸면:
- `campaign_id`: Meta 캠페인 고유 번호
- `adset_id`: 캠페인 안 묶음의 고유 번호
- `ad_id`: 실제 광고 크리에이티브/광고 단위 번호
- `landingUrl`: 광고 클릭 후 가는 주소
- `url_tags`: 광고 관리 화면에 명시적으로 박아둔 태그 문자열
- `extractedUrlTags`: landingUrl 안 query string에서 실제로 읽어낸 `utm_*`, `fbclid` 등의 태그
- `attributionSpec`: Meta가 이 adset의 구매를 몇 일 윈도우로 귀속할지 정한 규칙

현재 확보된 export 규모:
- campaigns: `7`
- adsets: `26`
- ads: `410`
- adsWithLandingUrl: `128`
- adsWithUrlTags: `123`

주의:
- 이번 턴에 export를 다시 갱신하려고 한 번 더 실행했는데, Meta 쪽에서 `User request limit reached`가 떴소.
- 다만 기존 [meta_campaign_alias_audit.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json) 파일은 이미 생성돼 있고, 필요한 필드는 들어 있소.

## Q2. BigQuery raw purchase에서 최근 7일 `purchase events`와 `distinct transaction_id`를 날짜별로 뽑을 수 있는가

짧게 답하면: **SQL은 준비했지만, 이번 세션에서는 BigQuery 직접 실행 권한/연결이 없어서 실행 결과까지는 못 뽑았소.**

준비한 파일:
- [biocom_bigquery_purchase_sameday.sql](/Users/vibetj/coding/seo/data/biocom_bigquery_purchase_sameday.sql)

이 SQL에는 3개 쿼리가 들어 있소.
- 날짜별 `purchase event count`
- 날짜별 `distinct transaction_id`
- 빈 `transaction_id` 개수
- raw purchase value 합계
- duplicate `transaction_id` 상위 샘플
- duplicate row 상세 샘플

즉, **실행만 하면 문서에서 요청한 same-day raw purchase 대조는 바로 할 수 있게 템플릿은 만들어 두었소.**

실행이 안 된 이유:
- 이번 Codex 세션에서는 BigQuery connector/access가 붙어 있지 않았소.
- 그래서 SQL 텍스트만 만들고, 실제 `project.dataset`은 placeholder로 뒀소.

## Q3. `(unmapped)` 49건 / ₩14.6M 주문의 상위 `utm_campaign` 10개를 보낼 수 있는가

예, 보낼 수 있소. 아래가 현재 기준 상위 10개요.

| utm_campaign | confirmed 주문 | confirmed 매출 | pending 주문 | pending 매출 | 총 주문 | 총 매출 |
|---|---:|---:|---:|---:|---:|---:|
| `meta_biocom_yeonddle_igg` | 12 | ₩4,215,250 | 4 | ₩1,234,500 | 16 | ₩5,449,750 |
| `meta_biocom_proteinstory_igg` | 7 | ₩2,211,200 | 2 | ₩576,550 | 9 | ₩2,787,750 |
| `meta_biocom_iggspring` | 4 | ₩1,471,200 | 2 | ₩490,000 | 6 | ₩1,961,200 |
| `meta_biocom_mingzzinginstatoon_igg` | 4 | ₩980,000 | 0 | ₩0 | 4 | ₩980,000 |
| `meta_biocom_allhormon_miraclemorningstory` | 2 | ₩870,200 | 0 | ₩0 | 2 | ₩870,200 |
| `meta_biocom_sikdanstory_igg` | 1 | ₩750,000 | 1 | ₩245,000 | 2 | ₩995,000 |
| `meta_biocom_iggunboxing_igg` | 2 | ₩729,500 | 0 | ₩0 | 2 | ₩729,500 |
| `meta_biocom_iggacidset_2026` | 2 | ₩716,200 | 1 | ₩471,200 | 3 | ₩1,187,400 |
| `meta_biocom_hyunseo01_igg` | 1 | ₩675,000 | 0 | ₩0 | 1 | ₩675,000 |
| `meta_biocom_igevsiggblog_igg` | 2 | ₩505,000 | 0 | ₩0 | 2 | ₩505,000 |

원본은 [meta_campaign_alias_audit.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json)에 있소.

## 6. `(unmapped)`이 왜 아직 100%인가

현재 `biocom last_7d` confirmed Meta-attributed revenue `₩14,586,790`는 캠페인 표에서는 거의 전부 `(unmapped)`요.

실측:
- `/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d`
- summary attributedRevenue: `₩14,586,790`
- `(unmapped)` attributedRevenue: `₩14,586,790`
- 즉 현재는 `100% unmapped`

왜 이런가:
- attribution ledger의 `utm_campaign`은 `meta_biocom_yeonddle_igg` 같은 운영 alias요.
- Meta 캠페인 표는 실제 `campaign_id / campaign_name` 기준이오.
- 그래서 현재 direct match만으로는 연결이 안 되오.

즉 지금 상태는:
- 사이트 전체 Attribution ROAS 해석은 가능
- 캠페인 drill-down Attribution ROAS는 아직 불완전

## 7. 왜 `link_url`만으로 alias seed를 만들면 위험한가

이 부분은 중요해서 자세히 적겠소.

처음에는 `landingUrl`만 보면 alias를 붙일 수 있을 것처럼 보이지만, 실제로는 부족할 가능성이 높소.

이유 1:
- 많은 ad는 `landingUrl`이 비어 있거나, creative 구조 안에서만 간접적으로 잡히오.

이유 2:
- `landingUrl`이 같아도 adset이 다를 수 있소.
- 즉 같은 URL을 여러 adset/campaign가 공유할 수 있소.

이유 3:
- `utm_campaign` alias는 실제 Meta `campaign_name`이 아니라 운영팀이 수동으로 만든 별칭일 수 있소.
- 예: 인플루언서명, 소재명, 제품군명, 운영자 shorthand

그래서 alias seed를 만들 때는 최소한 아래 4개를 같이 봐야 하오.
- `landingUrl`
- `url_tags / extractedUrlTags`
- `adset name`
- `ad name`

여기에 가능하면 아래도 같이 봐야 더 안전하오.
- `campaign_name`
- 최근 7일 `spend / purchase value`
- 운영 시작일 / 종료일
- 실제 집행한 소재명

쉽게 말하면:
- `link_url`만 보고 붙이면 `비슷한 URL을 쓰는 다른 광고`에 잘못 붙일 수 있소.
- `adset/ad name`까지 같이 보면 `이 alias가 어떤 운영 묶음인지`를 사람이 더 정확히 판단할 수 있소.

그래서 지금 단계에서는:
- 억지 자동 매핑 금지
- file-based seed로 시작
- 사람이 `yes / no` 검토
- `manual_verified`만 실제 matcher에 연결

이 순서가 맞소.

## 8. `/ads` 화면에서 이번에 바뀐 부분

이번 턴에서 `/ads`는 사람이 ROAS 차이를 덜 오해하게 바뀌었소.

추가된 핵심:
- `Attribution confirmed ROAS`
- `confirmed + pending ROAS`
- `Meta purchase ROAS`
- `best-case ceiling`
- `(unmapped) revenue 경고`
- `일별 비교표`

이렇게 바꾼 이유:
- 이전에는 headline ROAS 하나만 보면 `0.53x`가 너무 낮아 보이고, 그 숫자가 확정 지연 때문인지 실제 효율 하락 때문인지 분리가 어려웠소.
- 이제는 `0.53x / 0.77x / 4.09x`를 같이 보므로, `확정 지연`, `플랫폼 과대귀속`, `historical under-coverage`를 구분해서 읽을 수 있소.

아직 일부러 안 넣은 것:
- 캠페인별 표에 Attribution ROAS 열을 바로 붙이지 않았소.
- 이유는 현재 `100% unmapped` 상태라서, 붙이면 대부분 `0` 또는 `(unmapped)`만 크게 보여 오해가 커지기 때문이오.
- 이건 alias review / seed 반영 후에 붙이는 것이 맞소.

## 9. 이번 검증 결과

서버 상태:
- frontend: `7010` listen 확인
- backend: `7020` listen 확인

타입 검증:
- `npm exec -- tsc --noEmit -p tsconfig.json` in `frontend` 통과
- `npm --prefix backend run typecheck` 통과

API 검증:
- `/api/ads/site-summary?date_preset=last_7d` 응답 확인
- `/api/ads/roas/daily?account_id=act_3138805896402376&date_preset=last_7d` 응답 확인
- `/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d` 응답 확인

실제 확인된 biocom last_7d 결과:
- confirmed ROAS: `0.53x`
- confirmed + pending ROAS: `0.77x`
- Meta purchase ROAS: `4.09x`
- `(unmapped)` share: `100%`

## 10. 이번에 발견한 추가 이슈

### 10-1. `/site-summary`와 `/roas/daily`의 spend 합계가 아직 다르오

현재 같은 `last_7d biocom`인데:
- site-summary spend: `₩27,726,230`
- daily summary spend: `₩23,562,520`

즉 `약 ₩4.16M` 차이가 있소.

이건 아직 unresolved요.
가능성:
- Meta `date_preset` + `time_increment` 응답 방식 차이
- 오늘 데이터 포함 방식 차이
- API level/aggregation 차이

이 부분은 바로 다음 정리 대상이오. 숫자 정의를 맞춰야 daily table과 headline card를 완전히 같은 축으로 읽을 수 있소.

### 10-2. Meta export re-run은 rate limit에 걸렸소

이번 턴에서 audit export를 한 번 더 최신화하려 했는데:
- `User request limit reached`

그래서 이번 reply에서는 기존 [meta_campaign_alias_audit.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json) 파일을 기준 자료로 사용했소.

## 11. 다음 계획

우선순위 순서대로 적겠소.

1. `site-summary`와 `daily` spend 차이 원인 정리
- 같은 기간이면 spend도 같아야 사람이 덜 헷갈리오.
- 지금은 daily 비교표 해석 전에 이 축부터 맞추는 게 우선이오.

2. alias seed manual review 진행
- `/ads` 하단 review UI에서 `yes / no`
- `manual_verified`만 matcher에 연결
- 그 뒤에 캠페인별 Attribution ROAS 열 추가

3. BigQuery raw purchase same-day 실제 실행
- [biocom_bigquery_purchase_sameday.sql](/Users/vibetj/coding/seo/data/biocom_bigquery_purchase_sameday.sql)
- 이 결과가 들어오면 `Meta purchase 과대`, `transaction_id 중복`, `(not set)` historical row 문제를 더 강하게 판단할 수 있소.

4. biocom GTM-W7VXS4D8 오류 정리
- 결제 페이지 custom script 오류가 아직 Meta purchase quality 리스크로 남아 있소.
- 이건 ROAS gap을 설명하는 직접 원인 중 하나일 가능성이 있소.

5. 장기적으로는 landing URL에 Meta 실제 ID 직접 삽입
- `meta_campaign_id / meta_adset_id / meta_ad_id`
- 이게 붙으면 alias 의존이 크게 줄고, 캠페인 drill-down 정확도가 훨씬 올라가오.

## 12. 최종 판단

이번 턴 기준 제 판단은 변함없소.

- 더 과장됐을 가능성이 높은 쪽: `Meta purchase ROAS`
- 더 보수적인 쪽: `Attribution confirmed ROAS`
- 지금 메인 운영값: `Attribution confirmed ROAS`
- 지금 가장 필요한 보조값: `confirmed + pending ROAS`
- 지금 가장 위험한 blind spot: `100% unmapped`, BigQuery raw 미검증, biocom payment page GTM 오류

즉, **“메타가 완전히 틀렸다”보다 “메타는 넓게 잡고 있고, attribution은 아직 덜 잡고 있다”가 현재 가장 정확한 표현**이오.  
하지만 운영 의사결정 기준으로 하나만 메인값으로 고르라면, 지금도 계속 **Attribution confirmed**가 덜 위험하오.
