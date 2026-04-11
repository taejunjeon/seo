# gptfeedback_0409_2 reply

작성 시각: 2026-04-09 KST

## 1. 이번 턴에서 실제로 개발한 것

### A. Meta ROAS 설명 축을 코드에 고정

백엔드에서 Meta Insights 호출에 아래 기준을 공통 반영했소.

- `action_report_time=conversion`
  - 뜻: 광고를 본 날짜가 아니라 **전환이 실제로 발생한 날짜** 기준으로 일별 값을 배치하겠다는 뜻이오.
- `use_unified_attribution_setting=true`
  - 뜻: Meta Ads Manager가 쓰는 **광고세트(ad set)의 unified attribution setting** 쪽에 최대한 맞추겠다는 뜻이오.

이걸 넣은 이유는, 지금까지 내부 ROAS와 Meta ROAS가 다른 것은 구조적으로 당연하지만, 최소한 **Meta API가 Ads Manager와 같은 규칙으로 읽히고 있는지**는 맞춰야 하기 때문이오.

반영 파일:

- `/Users/vibetj/coding/seo/backend/src/routes/ads.ts`
- `/Users/vibetj/coding/seo/backend/src/routes/meta.ts`

### B. 응답 JSON에 `meta_reference` 추가

프론트가 추측해서 설명하지 않게, 백엔드 응답 자체에 아래 메타 설명을 실어 두었소.

- `mode`
  - `ads_manager_parity`면 Ads Manager parity 모드라는 뜻
- `actionReportTime`
  - 지금은 `conversion`
- `useUnifiedAttributionSetting`
  - 지금은 `true`
- `actionValueField`
  - `action_values[purchase]`
- `purchaseRoasField`
  - `purchase_roas`
- `websitePurchaseRoasField`
  - `website_purchase_roas`
- `numeratorDefinition`
  - “Meta ROAS 분자는 PG confirmed revenue가 아니라 Meta가 광고에 귀속한 conversion value”라는 설명

즉 화면 설명이 코드 바깥 메모가 아니라 **실제 API 응답 정의**를 따라가게 만들었소.

### C. `/ads` 페이지 문구 보강

기존 `/ads`는 이미 `Attribution confirmed / confirmed+pending / Meta purchase` 3줄 비교 구조가 있었소. 이번엔 여기에 공식 정의를 더 분명히 적었소.

- Meta purchase ROAS 카드 아래에
  - `action_values[purchase]`
  - `action_report_time=conversion`
  - `use_unified_attribution_setting=true`
  를 명시
- 설명 박스에
  - Meta 분자는 **플랫폼 귀속 가치**
  - Attribution 분자는 **내부 확정 매출**
  이라고 더 분명히 적었소.

반영 파일:

- `/Users/vibetj/coding/seo/frontend/src/app/ads/page.tsx`

### D. `/ads/roas` 페이지를 사실상 다시 구성

이 페이지는 기존에 “채널 ROAS + iROAS” 정도로만 보였고, Meta 정의와 Attribution 기준 차이가 직관적으로 읽히지 않았소. 그래서 아래 구조로 재구성했소.

추가/개선 내용:

- 상단에 개념 경고 박스 추가
  - Attribution ROAS
  - Meta purchase ROAS
  - iROAS
  가 서로 다른 값임을 첫 줄에 설명
- 전체 카드 4개 추가
  - 전체 confirmed ROAS
  - 전체 confirmed+pending ROAS
  - 전체 Meta purchase ROAS
  - 총 광고비
- 채널별 confirmed ROAS 표 유지
  - “Meta purchase가 아니라 confirmed attribution 기준”이라는 설명 추가
- 사이트별 카드 추가
  - 바이오컴 / 더클린커피 / AIBIO를 클릭해서 비교 가능
- 선택 사이트 상세 카드 4개 추가
  - Meta purchase
  - Attr confirmed
  - Attr confirmed+pending
  - best-case ceiling
- `Attribution ROAS 해석 메모` 박스 추가
  - confirmed / pending / Meta value 차이를 쉬운 한국어로 설명
- `Meta parity 체크` 박스 추가
  - `action_report_time`
  - `use_unified_attribution_setting`
  - `purchase_roas`
  - `website_purchase_roas`
  - `action_values[purchase]`
  를 무엇이고 왜 쓰는지 설명
- 일별 차트 2개 추가/정리
  - 광고비 + confirmed/potential 매출
  - Meta purchase / Attr confirmed / Attr confirmed+pending ROAS 비교
- 일자별 비교표 추가
  - 같은 날짜축에서 3줄 값을 같이 보게 함
- 하단 iROAS 안내 문구 보강
  - Attribution ROAS와 iROAS는 같은 개념이 아니라고 명시

반영 파일:

- `/Users/vibetj/coding/seo/frontend/src/app/ads/roas/page.tsx`

## 2. 이번 턴 결과 화면 스크린샷

저장 경로:

- `/Users/vibetj/coding/seo/data/screenshot/ads_20260409.png`
- `/Users/vibetj/coding/seo/data/screenshot/ads_roas_20260409.png`

## 3. 이번 턴에서 같이 저장한 raw 자료

피드백 문서에서 요구한 raw 비교 자료 성격에 맞춰 현재 응답 스냅샷도 저장했소.

- `/Users/vibetj/coding/seo/data/ads_site_summary_last7d_20260409.json`
- `/Users/vibetj/coding/seo/data/ads_roas_daily_biocom_last7d_20260409.json`
- `/Users/vibetj/coding/seo/data/meta_insights_biocom_last7d_20260409.json`

기존 alias audit 자료:

- `/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json`

## 4. 지금 시점 기준 핵심 숫자

### A. 바이오컴 `site-summary` 기준 last_7d

출처:
`/Users/vibetj/coding/seo/data/ads_site_summary_last7d_20260409.json`

- 광고비: `₩27,727,240`
- Attribution confirmed revenue: `₩22,141,040`
- Attribution pending revenue: `₩1,364,200`
- Attribution potential revenue: `₩23,505,240`
- Meta purchase value: `₩121,715,603`
- Attribution confirmed ROAS: `0.80x`
- Attribution confirmed+pending ROAS: `0.85x`
- Meta purchase ROAS: `4.39x`

### B. 바이오컴 `roas/daily` 합계 기준 last_7d

출처:
`/Users/vibetj/coding/seo/data/ads_roas_daily_biocom_last7d_20260409.json`

- 광고비 합계: `₩23,563,530`
- Attribution confirmed revenue: `₩22,141,040`
- Attribution pending revenue: `₩1,627,114`
- Attribution potential revenue: `₩23,768,154`
- Meta purchase value: `₩100,339,759`
- Attribution confirmed ROAS: `0.94x`
- Attribution confirmed+pending ROAS: `1.01x`
- Meta purchase ROAS: `4.26x`

## 5. 왜 `site-summary`와 `daily` 숫자가 아직 다르나

이건 **이번 턴에서 고치지 못했고, 다음 우선순위로 남긴 이슈**요.

현재 관찰된 현상:

- `site-summary`의 바이오컴 `last_7d` spend는 `₩27,727,240`
- `daily`의 합산 spend는 `₩23,563,530`

또한 `daily` 행 날짜는:

- `2026-04-03`
- `2026-04-04`
- `2026-04-05`
- `2026-04-06`
- `2026-04-07`
- `2026-04-08`
- `2026-04-09`

반면 `meta/insights` range row는 `2026-04-02 ~ 2026-04-08` 축으로 보였소.

즉 지금 가장 유력한 원인은 아래 둘 중 하나요.

1. **Meta 계정 timezone / date_preset 해석 차이**
   - 같은 `last_7d`라도 account timezone 기준으로 묶이면서 하루가 밀릴 수 있소.
2. **집계형 endpoint와 `time_increment=1` endpoint의 날짜축 차이**
   - 특히 `conversion-day` 기준을 걸었을 때 일별 행과 범위 합산행의 기간 표시가 어긋날 가능성이 있소.

정리하면:

- 이번 턴에 `Meta parity` 파라미터는 반영했소.
- 하지만 **KST 기준 headline 카드와 일별 합계가 완전히 같은 기간축으로 맞는지**는 아직 추가 확인이 필요하오.

## 6. Attribution ROAS와 iROAS는 같은가, 다른가

**다르오. 이름은 비슷하지만 측정 철학 자체가 다르오.**

### Attribution ROAS

뜻:

- 이미 발생한 주문/매출을 보고
- “이 주문이 어떤 광고에서 왔다고 보이는가”를 기준으로 귀속한 뒤
- `매출 / 광고비`를 계산한 값

즉, **관측 기반(관찰 기반) 귀속 지표**요.

예:

- `Attribution confirmed ROAS`
- `Attribution confirmed+pending ROAS`

### iROAS

뜻:

- 광고를 본 집단과 안 본 집단(또는 treatment / control)을 비교해서
- 광고가 없었다면 생기지 않았을 **증분 매출(incremental revenue)**만 남긴 뒤
- `증분 매출 / 광고비`를 계산한 값

즉, **실험 기반(증분 효과) 지표**요.

### 왜 다르냐

Attribution ROAS는 이렇게 묻는 값이오.

- “이 매출은 어느 광고에 귀속해 보이냐?”

iROAS는 이렇게 묻는 값이오.

- “광고가 없었으면 이 매출이 정말 안 생겼겠냐?”

그래서 같은 광고라도:

- Attribution ROAS는 높게 나올 수 있고
- iROAS는 낮게 나올 수 있소.

이 경우는 보통

- 광고에 귀속되긴 했지만
- 실제로는 원래 살 사람을 데려온 비중이 크다

는 뜻으로 해석하오.

즉 결론:

- **운영 대시보드 기본 효율값**은 Attribution ROAS
- **광고의 진짜 증분 효과 판단값**은 iROAS

로 분리해서 봐야 하오.

## 7. 영어 용어를 아주 직관적으로 풀면

### `purchase_roas`

Meta가 “구매로 본 전환 가치”를 광고비로 나눈 값이오.
중요한 점은 이 분자가 **우리 PG 확정 매출과 같은 뜻이 아니라는 점**이오.

### `website_purchase_roas`

웹사이트 Pixel 쪽 구매 기준 ROAS요.
즉 `purchase_roas`와 완전히 같은 필드가 아니오.

### `action_values[purchase]`

Meta가 광고에 귀속했다고 본 `purchase` 전환 가치요.
쉽게 말하면 “Meta가 자기 규칙으로 광고 덕분이라고 잡은 구매 가치 합계”에 가깝소.

### `action_report_time=conversion`

일별 표에서, 광고를 본 날짜가 아니라 **구매가 실제 발생한 날짜**에 전환을 놓겠다는 뜻이오.

### `use_unified_attribution_setting=true`

Ads Manager와 맞추기 위해, account 기본값이 아니라 **ad set의 unified attribution setting**을 따라 읽겠다는 뜻이오.

## 8. 최근 자체솔루션 attribution footer rollout이 ROAS에 미치는 영향

영향이 있소. 다만 **어느 기간을 보느냐에 따라 영향 크기가 다르오.**

- 최근 7일:
  - 이미 live caller가 많이 반영된 구간이라서 영향이 상대적으로 덜함
- 최근 30일 / 90일:
  - rollout 이전 광고비가 같이 들어오는데 attribution confirmed row는 부족할 수 있어서
  - Attribution ROAS가 더 눌려 보일 수 있소

즉 long window일수록

- Meta purchase ROAS는 높고
- Attribution confirmed ROAS는 낮아 보이는

현상이 더 커질 수 있소.

## 9. 검증 결과

실행한 검증:

- `npm --prefix /Users/vibetj/coding/seo/backend run typecheck`
- `./node_modules/.bin/tsc --noEmit -p tsconfig.json` in `/Users/vibetj/coding/seo/frontend`
- `node --import ./backend/node_modules/tsx/dist/loader.mjs --test /Users/vibetj/coding/seo/backend/tests/ads.test.ts`
- `curl http://localhost:7020/api/ads/site-summary?date_preset=last_7d`
- `curl http://localhost:7020/api/ads/roas/daily?account_id=act_3138805896402376&date_preset=last_7d`
- `curl http://localhost:7020/api/meta/insights?account_id=act_3138805896402376&date_preset=last_7d`
- `curl -I http://localhost:7010/ads`
- `curl -I http://localhost:7010/ads/roas`

서버 상태:

- frontend `7010` listen 확인
- backend `7020` listen 확인

## 10. 다음 계획

우선순위는 이렇소.

1. **`site-summary` vs `daily` spend/date mismatch 해결**
   - KST 기준 `time_range` 고정
   - `date_preset` 대비 `time_increment=1` 차이 검증
   - Meta account timezone 영향 분리

2. **BigQuery raw purchase same-day 검증**
   - Meta purchase value와 내부 confirmed revenue 차이 중
   - raw event 누락/중복이 있는지 확인

3. **campaign alias mapping 연결**
   - 지금은 headline 비교는 가능하지만
   - campaign drill-down은 여전히 `(unmapped)` 비중이 커서
   - manual review yes/no 결과를 실제 matcher에 연결해야 하오

4. **장기 구간 해석 정책 정리**
   - 최근 7일은 운영판단
   - 최근 30/90일은 rollout bias 경고
   - 이 기준을 화면/문서에 더 명확히 박을 필요가 있소

## 11. 한 줄 결론

이번 턴으로 `/ads`와 `/ads/roas`는

- Meta purchase ROAS
- Attribution confirmed ROAS
- Attribution confirmed+pending ROAS
- iROAS

를 **서로 다른 개념으로 분리해서 읽을 수 있게** 정리됐소.
다만 `site-summary`와 `daily`의 날짜축/광고비 합계 mismatch는 아직 남아 있으니, 다음 작업은 그 축 정리가 1순위요.
