# Meta alias 검토 운영 방식 검토

작성 시각: 2026-04-11 KST

## 결론

TJ님이 제안한 방식은 가능하다.

단기적으로는 Meta 광고관리자에서 광고 레벨 CSV를 export한 뒤 `utm_campaign` alias 키워드로 찾는 방식이 가장 빠르다. 모든 광고를 하나씩 클릭하는 방식보다 훨씬 낫다.

장기적으로는 광고 링크에 `alias`, `campaign_id`, `adset_id`, `ad_id`를 같이 남기고, 주문 원장에도 그대로 보존되게 만드는 방향이 맞다. 이렇게 되면 지금처럼 사람이 광고명과 URL을 보고 수동 매핑하는 작업이 크게 줄어든다.

## 지금 문제

현재 내부 주문 원장에는 이런 값이 남는다.

```text
utm_campaign=meta_biocom_yeonddle_igg
```

반면 Meta 광고 데이터에는 이런 값이 남는다.

```text
campaign_id=120242626179290396
campaign_name=공동구매 인플루언서 파트너 광고 모음_3 (260323)
adset_name=인플루언서 공동구매 파트너 광고
ad_name=[연뜰살뜰x음과검] 2차공구 - 사본 - 사본
```

두 데이터의 키가 다르기 때문에 캠페인별 Attribution ROAS가 바로 붙지 않는다. 그래서 `utm_campaign alias -> Meta campaign_id`를 검토해야 한다.

## 단기 방식: 광고 레벨 CSV export

### 가능 여부

가능하다.

가장 좋은 단기 절차는 아래 방식이다.

1. Meta 광고관리자를 연다.
2. 계정과 기간을 현재 분석 기간에 맞춘다.
3. 보기 레벨을 `광고` 레벨로 둔다.
4. 컬럼에 아래 항목을 추가한다.
5. CSV 또는 Excel로 export한다.
6. 파일에서 `yeonddle`, `songyuul08`, `hyunseo`, `proteinstory` 같은 alias 핵심 키워드로 검색한다.
7. 검색으로 확정되는 항목만 먼저 yes/no 처리한다.
8. 검색되지 않는 항목만 광고관리자에서 하나씩 클릭해 확인한다.

### 추가할 컬럼

- `campaign ID`
- `campaign name`
- `ad set ID`
- `ad set name`
- `ad ID`
- `ad name`
- `website URL`
- `URL parameters`
- `amount spent`
- `purchases`
- `purchase conversion value`

Meta 화면 언어에 따라 명칭은 조금 다를 수 있다. 핵심은 광고 ID 계층과 랜딩 URL, URL 파라미터, 구매 성과를 한 줄에 같이 보는 것이다.

### Meta 한국어 화면에서 찾을 컬럼명

영문 컬럼명과 Meta 한국어 화면 컬럼명이 완전히 일치하지 않을 수 있다. 다음 export에서는 아래 이름을 우선 찾는다.

- `캠페인 ID`
- `캠페인 이름`
- `광고 세트 ID`
- `광고 세트 이름`
- `광고 ID`
- `광고 이름`
- `웹사이트 URL`
- `URL 매개변수` 또는 `URL 파라미터`
- `지출 금액`
- `구매`
- `구매 전환값`
- `구매 ROAS`

컬럼 검색창에서 정확히 안 나오면 `URL`, `매개변수`, `파라미터`, `웹사이트`, `ID`로 검색한다.

현재 제공된 CSV에는 `광고 이름`, `광고 세트 이름`, `지출 금액`, `구매`, `결과 값`, `구매 ROAS`는 있었지만 `캠페인 ID`, `캠페인 이름`, `광고 ID`, `웹사이트 URL`, `URL 매개변수`가 없었다. 따라서 이번 파일은 광고명 기반 1차 검토에는 충분하지만, URL 파라미터까지 본 최종 확정 자료로는 부족하다.

## 왜 CSV 방식이 빠른가

현재 alias 검토는 “이 alias가 어느 Meta 캠페인에서 왔는가”를 찾는 작업이다.

광고관리자 화면에서 모든 광고를 클릭하면 시간이 많이 든다. 반대로 광고 레벨 export를 하면 한 파일 안에서 검색할 수 있다.

예를 들어 CSV에서 `yeonddle`을 검색했을 때 아래처럼 나오면 강한 증거다.

```text
campaign_id=120242626179290396
campaign_name=공동구매 인플루언서 파트너 광고 모음_3 (260323)
ad_name=[연뜰살뜰x음과검] 2차공구 - 사본 - 사본
url_parameters=utm_campaign=meta_biocom_yeonddle_igg
```

이 경우 `/ads`의 alias review에서 `meta_biocom_yeonddle_igg -> 120242626179290396`는 yes 후보가 된다.

반대로 CSV에서 키워드가 전혀 안 나오면, 그 alias는 API audit에 잡히지 않았거나 광고 소재 URL이 비어 있거나 운영자가 다른 이름으로 태그를 넣었을 가능성이 있다. 이때만 광고를 클릭해서 상세 확인하면 된다.

## yes/no 판단 기준

### yes

아래 중 하나 이상이 명확하면 yes가 가능하다.

- URL parameters에 동일한 `utm_campaign` 값이 있다.
- website URL에 동일한 `utm_campaign` 값이 있다.
- 광고명 또는 광고세트명에 alias 핵심 단어가 직접 있다.
- 인플루언서명, 제품군, 운영 기간이 주문 alias와 일치한다.

### no

아래에 해당하면 no가 맞다.

- 제품군이 다르다.
- 인플루언서 또는 소재명이 다르다.
- 운영 기간이 맞지 않는다.
- campaign family만 비슷하고 alias 직접 증거가 없다.
- URL 파라미터와 광고명 어디에도 연결 단서가 없다.

### pending

애매하면 pending으로 둔다.

잘못 yes를 누르면 캠페인별 매출이 잘못 붙는다. pending은 단지 캠페인별 ROAS 반영이 늦어지는 문제지만, 잘못된 yes는 ROAS 판단 자체를 오염시킨다.

## 현재 로컬 코드 기준 가능 여부

현재 로컬 코드도 단기 검토를 지원할 수 있는 기반은 있다.

`backend/scripts/export-meta-campaign-alias-audit.ts`는 Meta API에서 아래 항목을 수집한다.

- `campaign_id`
- `campaign_name`
- `adset_id`
- `adset_name`
- `ad_id`
- `ad_name`
- `url_tags`
- `creative.link_url`
- `spend`
- `actions`
- `action_values`

즉 광고관리자 CSV가 아니어도, API audit 파일을 더 정리하면 비슷한 검토용 CSV를 우리 쪽에서 만들 수 있다.

다만 지금 당장 운영상 가장 빠른 방법은 Meta 광고관리자 export다. 이유는 Meta 화면에서 보이는 최신 광고명, URL 파라미터, 성과 컬럼을 한 번에 내려받아 사람이 검색하기 쉽기 때문이다.

## 단기 실행안

우선순위는 confirmed revenue가 큰 alias부터 본다.

1. `meta_biocom_yeonddle_igg`
2. `meta_biocom_proteinstory_igg`
3. `meta_biocom_iggspring`
4. `meta_biocom_mingzzinginstatoon_igg`
5. `meta_biocom_allhormon_miraclemorningstory`
6. `meta_biocom_sikdanstory_igg`
7. `meta_biocom_iggunboxing_igg`
8. `meta_biocom_iggacidset_2026`
9. `meta_biocom_hyunseo01_igg`
10. `meta_biocom_kimteamjang_supplements`

검색 키워드는 alias 전체보다 핵심 slug로 찾는 것이 좋다.

- `yeonddle`
- `연뜰`
- `songyuul08`
- `송율`
- `hyunseo`
- `현서`
- `proteinstory`
- `단백질스토리`
- `mingzzing`
- `밍찡`
- `miraclemorningstory`
- `미라클모닝스토리`
- `sikdanstory`
- `식단스토리`
- `unboxing`
- `언박싱`
- `kimteamjang`
- `김팀장`
- `acidset`
- `iggspring`

## CSV 검토 후 기록해야 하는 값

검토 결과는 단순히 yes/no만 남기면 부족하다. 나중에 왜 그렇게 판단했는지 추적 가능해야 한다.

각 alias마다 최소한 아래를 남기는 것이 좋다.

- `aliasKey`
- `selected_campaign_id`
- `selected_campaign_name`
- `evidence_type`: `url_parameter`, `website_url`, `ad_name`, `adset_name`, `manual_screen`
- `evidence_text`
- `reviewed_by`
- `reviewed_at`
- `notes`

현재 seed 파일인 `data/meta_campaign_aliases.biocom.json`에는 `selected_campaign_id`, `review_status`, `manual_verified` 흐름이 있다. 다음 단계에서는 위 증빙 필드를 더해도 좋다.

## 장기 방식: 주문까지 direct ID 저장

장기적으로는 alias 검토 자체를 줄여야 한다.

다음 광고부터 랜딩 URL에 아래 값을 넣는다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_content={{ad.id}}
utm_term={{adset.id}}
campaign_alias=meta_biocom_yeonddle_igg
meta_campaign_id={{campaign.id}}
meta_adset_id={{adset.id}}
meta_ad_id={{ad.id}}
```

Meta 동적 파라미터 사용이 가능한 경우 위처럼 넣는다. 핵심은 사람이 만든 alias와 Meta의 실제 ID를 동시에 남기는 것이다.

주문 원장에는 최소 아래 값을 보존해야 한다.

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `campaign_alias`
- `meta_campaign_id`
- `meta_adset_id`
- `meta_ad_id`
- `fbclid`
- `fbc`
- `fbp`

이렇게 되면 캠페인별 매핑은 사람이 `yes/no`를 누르는 방식이 아니라 `meta_campaign_id` direct match로 끝난다.

## 광고명/광고세트명 운영 규칙

광고 URL 파라미터가 누락될 수 있으므로 이름 규칙도 필요하다.

인플루언서별 ROAS가 중요하면 최소한 광고세트명 또는 광고명에 slug를 강제 포함해야 한다.

예시:

```text
adset_name = igg__yeonddle__202604
ad_name = igg__yeonddle__story01__202604
```

더 좋은 구조는 인플루언서 단위로 adset을 분리하는 것이다. 가장 깔끔한 구조는 인플루언서 단위로 campaign 자체를 분리하는 것이다.

단, campaign을 너무 많이 쪼개면 학습량과 운영 복잡도가 늘 수 있다. 그래서 현실적인 기준은 아래와 같다.

- 예산과 주문량이 큰 인플루언서: campaign 분리 검토
- 중간 규모 인플루언서: adset 분리
- 테스트 소재: ad name과 URL parameter만 엄격히 관리

## 왜 campaign-level만으로는 부족한가

현재 구조는 campaign-level 매핑에는 어느 정도 쓸 수 있다.

예를 들어 `meta_biocom_yeonddle_igg`가 `공동구매 인플루언서 파트너 광고 모음_3` 캠페인 안에 있다는 것까지는 찾을 수 있다.

하지만 같은 campaign 안에 여러 인플루언서가 섞여 있으면 influencer-level 성과 판단은 어렵다. 캠페인 전체 광고비는 알 수 있지만, 특정 인플루언서 소재에 실제로 얼마를 썼고 얼마를 벌었는지 분리하기 어렵기 때문이다.

따라서 인플루언서별 ROAS가 중요하면 구조를 이렇게 바꿔야 한다.

- 주문에는 `campaign_alias`와 Meta ID를 모두 저장한다.
- 광고 URL에는 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`를 넣는다.
- 광고세트명 또는 광고명에는 인플루언서 slug를 강제한다.
- 가능하면 인플루언서별 adset을 분리한다.

## 현재 단계에서의 권장안

지금 당장은 새 시스템을 만들기보다 CSV export로 상위 alias를 빠르게 확정하는 것이 맞다.

권장 순서:

1. Meta 광고관리자에서 광고 레벨 CSV를 export한다.
2. 상위 alias 키워드로 검색한다.
3. URL parameter 또는 광고명 증거가 있는 것만 yes 처리한다.
4. 애매한 alias는 pending으로 둔다.
5. verified alias가 쌓이면 campaign-level Attribution ROAS를 연다.
6. 다음 광고 세팅부터 direct ID URL parameter 규칙을 적용한다.

이 방식이면 단기적으로는 수동 검토 시간을 줄이고, 장기적으로는 alias 검토 의존도를 줄일 수 있다.

## 2026-04-11 1차 CSV 검토 결과

검토 파일:

```text
meta/바이오컴_임시-광고-2026.-4.-4.-~-2026.-4.-10..csv
```

범위:

- 보고 시작: `2026-04-04`
- 보고 종료: `2026-04-10`
- 광고 세트: `인플루언서 공동구매 파트너 광고`
- 광고 row: 16개
- CSV 기여 설정: `클릭 후 7일 또는 조회 후 1일`

주의:

- 이 CSV의 성과 지표는 Meta 기본 기여 설정인 `7일 클릭 + 1일 조회` 기준이다.
- 현재 우리 운영 기준으로 정한 Meta ROAS headline은 `1일 클릭`이다.
- 따라서 이번 CSV의 구매/ROAS는 alias 검토 참고용이지, 운영 headline ROAS로 쓰면 안 된다.
- 이 CSV에는 URL 파라미터와 광고 ID가 없어서 `광고명 증거`까지만 확인 가능하다.
- CSV에 `구매` 컬럼명이 중복되어 있다. ROAS와 맞는 구매값은 뒤쪽 `결과 값` 컬럼이었다.

### 전체 요약

| 그룹 | 광고 수 | active 광고 수 | 지출 | 구매 | 결과 값 | CSV ROAS |
|---|---:|---:|---:|---:|---:|---:|
| 연뜰살뜰 | 6 | 3 | ₩2,677,282 | 31 | ₩9,247,159 | 3.45x |
| 송율 | 5 | 5 | ₩2,286,275 | 84 | ₩24,566,600 | 10.75x |
| 현서 | 1 | 0 | ₩280,997 | 5 | ₩2,105,000 | 7.49x |
| 지년툰 | 1 | 1 | ₩165,505 | 2 | ₩704,000 | 4.25x |
| Hoox | 2 | 0 | ₩0 | 0 | ₩0 | 0.00x |
| 캥맨 | 1 | 0 | ₩0 | 0 | ₩0 | 0.00x |
| 합계 | 16 | 9 | ₩5,410,059 | 122 | ₩36,622,759 | 6.77x |

### alias 판정

`meta_biocom_yeonddle_igg`

- 판정: yes 가능성이 높다.
- 근거: 같은 광고 세트 안에 `[연뜰살뜰x음과검] mast검사 스토리1`, `[연뜰살뜰x음과검] mast검사 스토리2`, `[연뜰살뜰x음과검] 2차공구`, `[연뜰살뜰 8차] 음과검 종대사`가 있다.
- 제한: URL 파라미터가 없으므로 최종 yes 전에는 `utm_campaign=meta_biocom_yeonddle_igg` 또는 이에 준하는 URL 증거를 한 번 더 확인하는 것이 안전하다.

`meta_biocom_hyunseo01_igg`

- 판정: yes 가능성이 높다.
- 근거: `[현서쓰고그리다x음과검] 04.01-05` 광고가 같은 광고 세트에 있고, 기존 API audit에서도 `writeanddraw_hyunseo` 신호가 있었다.
- 제한: URL 파라미터가 없으므로 최종 yes 전에는 `hyunseo` 또는 `meta_biocom_hyunseo01_igg`가 URL/파라미터에 있는지 확인해야 한다.

`meta_biocom_songyuul08`

- 판정: yes 후보로 새로 볼 만하다.
- 근거: `[송율x음과검]`, `[송율x음과검2]`, `[송율x음과검3]`, `[송율x음과검4]`, `[송율x바이오컴]` 광고가 같은 광고 세트에 있고, 최근 7일 지출과 구매가 가장 크다.
- 제한: 현재 상위 seed 파일에는 `meta_biocom_songyuul08`이 없고 audit 원장에는 존재한다. 이 alias는 seed 후보에 추가 검토하는 것이 맞다.

`meta_biocom_proteinstory_igg`

- 판정: 이번 CSV만으로는 보류.
- 근거: `proteinstory` 또는 `단백질스토리`가 광고명에 보이지 않는다.
- 다음 확인: 같은 기간 전체 캠페인/전체 광고 레벨 CSV에서 `proteinstory`, `단백질스토리`를 검색해야 한다.

`meta_biocom_mingzzinginstatoon_igg`

- 판정: 이번 CSV만으로는 보류.
- 근거: `mingzzing`, `밍찡`, `인스타툰`이 광고명에 보이지 않는다.
- 다음 확인: 전체 광고 CSV 또는 Meta API audit에서 해당 광고명/URL 파라미터를 확인해야 한다.

`meta_biocom_iggspring`

- 판정: 이번 CSV만으로는 보류.
- 근거: `spring`, `봄`, `봄맞이`, `iggspring` 단서가 광고명에 보이지 않는다.
- 다음 확인: 음식물 과민증 검사 전체 캠페인 CSV에서 `봄`, `spring`, `iggspring` 검색이 필요하다.

`meta_biocom_iggacidset_2026`

- 판정: 이번 CSV만으로는 보류.
- 근거: `acidset`, `유기산`, `대사검사` 단서가 광고명에 직접 보이지 않는다. 일부 광고명에 `종대사`가 있긴 하지만 alias 확정 근거로는 부족하다.
- 다음 확인: URL 파라미터나 랜딩 URL에 `acidset`이 있는지 확인해야 한다.

`meta_biocom_kimteamjang_supplements`

- 판정: 이번 CSV 대상이 아니다.
- 근거: 이번 파일은 `인플루언서 공동구매 파트너 광고` 광고 세트이고, 김팀장 영양제 광고 세트가 아니다.
- 다음 확인: `[바이오컴] 건강기능식품 - 클린, 풍성, 바이오` campaign 또는 김팀장 광고 세트에서 별도 CSV export가 필요하다.

## 다음 요청할 CSV

이번 파일은 좋은 1차 자료지만 최종 매핑에는 컬럼이 부족하다. 다음 export는 아래 조건으로 받으면 된다.

1. 기간: `2026-04-04 ~ 2026-04-10`
2. 레벨: `광고`
3. 범위: 특정 광고 세트가 아니라 가능하면 후보 campaign 전체
4. 필수 컬럼: `캠페인 ID`, `캠페인 이름`, `광고 세트 ID`, `광고 세트 이름`, `광고 ID`, `광고 이름`, `웹사이트 URL`, `URL 매개변수`, `지출 금액`, `구매`, `구매 전환값`, `구매 ROAS`
5. 우선 필요한 campaign: `공동구매 인플루언서 파트너 광고 모음_3`, `호르몬 검사 바이럴 소재 캠페인_0811`, `건강기능식품 - 클린, 풍성, 바이오`

이 다음 CSV에서 URL 파라미터까지 들어오면 `yeonddle`, `hyunseo`, `songyuul08`은 빠르게 yes 처리할 수 있고, `proteinstory`, `mingzzing`, `iggspring`, `acidset`, `kimteamjang`은 별도 evidence로 분리할 수 있다.

## 2026-04-11 2차 CSV 검토 결과

검토 파일:

```text
/Users/vibetj/Downloads/바이오컴_임시-광고-2026.-4.-4.-~-2026.-4.-10. (1).csv
```

이번 파일에는 1차 CSV에 없던 ID 컬럼이 추가되었다.

- `캠페인 이름`: `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- `캠페인 ID`: `120242626179290396`
- `광고 세트 이름`: `인플루언서 공동구매 파트너 광고`
- `광고 세트 ID`: `120242626179270396`
- `광고 ID`: 광고 row별로 존재
- `url_tags`: 컬럼은 있으나 16개 row 모두 빈 값

### 이번 CSV로 새로 확인된 점

1. 연뜰살뜰, 현서, 송율 광고가 모두 같은 campaign/adset 안에 있다.
2. 따라서 campaign-level alias 매핑 후보는 `120242626179290396`으로 강하게 확인된다.
3. 하지만 `url_tags` 값이 전부 비어 있어 URL 파라미터 직접 증거는 아직 없다.
4. 즉 이번 파일은 campaign-level 검토에는 충분히 도움이 되지만, influencer-level 정확한 광고비 배분까지 해결하지는 못한다.

### 주요 광고 ID

| 광고명 | 광고 ID | 상태 | 지출 | 결과 | 결과 값 | 결과 ROAS |
|---|---:|---|---:|---:|---:|---:|
| `[연뜰살뜰x음과검] mast검사 스토리2 - 사본` | `120242626208390396` | active | ₩23,202 | 1 | ₩7,847 | 0.34x |
| `[연뜰살뜰x음과검] mast검사 스토리1 - 사본` | `120242626208410396` | active | ₩253,179 | 8 | ₩3,186,866 | 12.59x |
| `[연뜰살뜰x음과검] 2차공구 - 사본 - 사본` | `120242626208430396` | active | ₩2,400,901 | 22 | ₩6,052,446 | 2.52x |
| `[현서쓰고그리다x음과검] 04.01-05` | `120243162846260396` | inactive | ₩280,997 | 5 | ₩2,105,000 | 7.49x |
| `[송율x음과검2] 04.08-15` | `120243537994930396` | active | ₩19,420 | 2 | ₩468,000 | 24.10x |
| `[송율x음과검4] 04.08-04.15` | `120243537994940396` | active | ₩358,468 | 15 | ₩4,728,200 | 13.19x |
| `[송율x음과검] 04.08-04.15` | `120243537994960396` | active | ₩1,824,014 | 65 | ₩18,401,400 | 10.09x |
| `[송율x바이오컴] 04.08-04.15` | `120243539487070396` | active | ₩83,974 | 2 | ₩969,000 | 11.54x |

주의:

- Meta CSV에 `구매` 컬럼명이 중복되어 있고, 일부 inactive 광고에 `지출=0`인데 구매 관련 컬럼이 남아 있는 row가 있다.
- 그래서 이번 표는 `결과`, `결과 값`, `결과 ROAS`처럼 서로 일관되는 컬럼을 기준으로 정리했다.
- 이 지표도 Meta의 `7일 클릭 + 1일 조회` 기준이다. 운영 headline인 `1일 클릭` 기준 ROAS와는 다를 수 있다.

### 2차 CSV 기준 alias 판정 업데이트

`meta_biocom_yeonddle_igg`

- 판정: campaign-level yes 가능성이 매우 높다.
- target campaign ID: `120242626179290396`
- target adset ID: `120242626179270396`
- 근거: 같은 campaign/adset 안에 연뜰살뜰 광고가 여러 개 있고, 실제 지출과 결과가 있다.
- 제한: `url_tags`가 비어 있어 `utm_campaign=meta_biocom_yeonddle_igg` 직접 증거는 없다.

`meta_biocom_hyunseo01_igg`

- 판정: campaign-level yes 가능성이 매우 높다.
- target campaign ID: `120242626179290396`
- target adset ID: `120242626179270396`
- target ad ID: `120243162846260396`
- 근거: `[현서쓰고그리다x음과검] 04.01-05` 광고가 확인된다.
- 제한: `url_tags`가 비어 있어 `utm_campaign=meta_biocom_hyunseo01_igg` 직접 증거는 없다.

`meta_biocom_songyuul08`

- 판정: campaign-level yes 후보로 추가해야 한다.
- target campaign ID: `120242626179290396`
- target adset ID: `120242626179270396`
- 근거: 송율 광고 5개가 같은 campaign/adset 안에 있고 최근 7일 성과 비중이 크다.
- 메모: 현재 seed 파일 상위 목록에는 없지만 `data/meta_campaign_alias_audit.biocom.json`에는 `utmCampaign=meta_biocom_songyuul08`이 존재한다. seed 후보에 추가하는 것이 맞다.

`meta_biocom_proteinstory_igg`

- 판정: 보류 유지.
- 근거: 이번 campaign/adset CSV에도 `proteinstory` 또는 `단백질스토리` 광고명이 없다.
- 다음 확인: 다른 campaign/adset 또는 전체 광고 CSV에서 검색해야 한다.

`meta_biocom_mingzzinginstatoon_igg`

- 판정: 보류 유지.
- 근거: 이번 CSV에는 `mingzzing`, `밍찡`, `인스타툰` 광고명이 없다.

`meta_biocom_iggspring`

- 판정: 보류 유지.
- 근거: 이번 CSV에는 `spring`, `봄`, `봄맞이` 단서가 없다.

`meta_biocom_iggacidset_2026`

- 판정: 보류 유지.
- 근거: 이번 CSV에는 `acidset`, `유기산`, `대사검사` 단서가 직접 없다.

`meta_biocom_kimteamjang_supplements`

- 판정: 이번 CSV 대상 아님.
- 근거: 김팀장 영양제 광고는 `건강기능식품 - 클린, 풍성, 바이오` campaign 쪽에서 봐야 한다.

### 현재 결론

이번 CSV로 `공동구매 인플루언서 파트너 광고 모음_3 (260323)` campaign ID는 확정적으로 확인됐다.

따라서 캠페인 레벨에서는 아래 매핑을 우선 검토할 수 있다.

- `meta_biocom_yeonddle_igg -> 120242626179290396`
- `meta_biocom_hyunseo01_igg -> 120242626179290396`
- `meta_biocom_songyuul08 -> 120242626179290396`

다만 `url_tags`가 전부 비어 있으므로, 이 매핑은 “해당 campaign 안에 같은 인플루언서 광고가 있다”는 광고명 기반 확정이다. 주문 URL에 실제 `utm_campaign`이 어떻게 붙었는지까지 입증하려면 광고 상세의 랜딩 URL 또는 URL 매개변수가 필요하다.

## 2026-04-11 3차 CSV/XLSX 검토 결과

검토 파일:

```text
/Users/vibetj/Downloads/바이오컴_임시-광고-2026.-4.-4.-~-2026.-4.-10. (2).csv
/Users/vibetj/Downloads/바이오컴_임시-광고-2026.-4.-4.-~-2026.-4.-10..xlsx
```

### CSV와 XLSX 중 무엇이 더 좋은가

분석 기준으로는 CSV가 더 좋다.

이유:

- CSV는 `캠페인 ID`, `광고 세트 ID`, `광고 ID`가 문자열로 보존된다.
- XLSX는 Meta ID가 긴 숫자로 저장되어 `1.2024262620838e+17`처럼 읽히며, 프로그램이나 엑셀에서 정밀도가 깨질 수 있다.
- 이번 작업은 ID 매핑 정확도가 중요하므로 ID가 깨질 수 있는 XLSX보다 CSV를 기준 파일로 쓰는 것이 안전하다.

사람이 화면에서 눈으로 훑거나 필터를 걸 때는 XLSX가 편할 수 있다. 하지만 최종 매핑, 코드 파싱, seed 반영 기준은 CSV가 맞다.

### 3차 파일에서 추가된 컬럼

2차 CSV보다 아래 성과 컬럼이 추가되었다.

- `장바구니에 담기당 비용`
- `장바구니에 담기 전환값`
- `장바구니에 담기`
- `구매당 비용`
- `랜딩 페이지 조회당 비용`
- `CPM`
- `고유 링크 클릭당 비용`
- `결과당 비용`
- `행동 유형당 비용 구매`

그러나 여전히 없는 값:

- 실제 `웹사이트 URL`
- 실제 랜딩 URL 문자열
- `utm_campaign`이 들어간 URL 매개변수 값
- `utm_content`, `utm_term`, `fbclid` 같은 실제 URL 파라미터 문자열

현재 파일에 있는 URL 관련 컬럼은 아래뿐이다.

- `웹사이트 랜딩 페이지 조회수`: URL이 아니라 조회수 숫자다.
- `url_tags`: 컬럼은 있지만 16개 row 모두 빈 값이다.

따라서 3차 파일도 URL 직접 증거는 제공하지 않는다.

### 3차 파일 기준 성과 요약

Meta CSV 기준은 여전히 `클릭 후 7일 또는 조회 후 1일`이다. 운영 headline인 `클릭 1일`과 다르므로 성과 수치는 참고용이다.

| 그룹 | 광고 수 | active 광고 수 | 지출 | 결과 | 결과 값 | ROAS | 장바구니 | 랜딩 페이지 조회 | 고유 링크 클릭 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 연뜰살뜰 | 6 | 3 | ₩2,677,282 | 31 | ₩9,247,159 | 3.45x | 20 | 2,110 | 2,372 |
| 송율 | 5 | 5 | ₩2,286,275 | 84 | ₩24,566,600 | 10.75x | 42 | 4,175 | 4,231 |
| 현서 | 1 | 0 | ₩280,997 | 5 | ₩2,105,000 | 7.49x | 3 | 65 | 85 |
| 지년툰 | 1 | 1 | ₩165,505 | 2 | ₩704,000 | 4.25x | 0 | 42 | 60 |
| Hoox | 2 | 0 | ₩0 | 0 | ₩0 | 0.00x | 0 | 0 | 0 |
| 캥맨 | 1 | 0 | ₩0 | 0 | ₩0 | 0.00x | 0 | 0 | 0 |

### 중복 컬럼 주의

Meta export에는 같은 이름의 컬럼이 중복으로 들어온다.

- `구매 전환값`이 2번 등장한다.
- `구매`가 2번 등장한다.

일부 뒤쪽 `구매 전환값`, `구매` 컬럼은 값이 비정상적으로 커서 ROAS와 맞지 않는다.

예:

```text
[연뜰살뜰x음과검] 2차공구
지출 = 2,400,901
앞쪽 구매 전환값 = 6,052,446
결과 값 = 6,052,446
결과 ROAS = 2.520906
뒤쪽 구매 전환값 = 700,679,263
```

따라서 이번 파일에서는 `결과`, `결과 값`, `결과 ROAS`, 앞쪽 `구매 전환값`을 기준으로 해석해야 한다.

### alias 판정 변화

3차 파일은 성과 보조 컬럼이 늘었지만 URL 증거는 추가되지 않았다. 따라서 alias 판정은 2차 CSV와 동일하다.

- `meta_biocom_yeonddle_igg`: campaign-level yes 가능성 매우 높음.
- `meta_biocom_hyunseo01_igg`: campaign-level yes 가능성 매우 높음.
- `meta_biocom_songyuul08`: campaign-level yes 후보로 seed 추가 검토 필요.
- `meta_biocom_proteinstory_igg`: 보류.
- `meta_biocom_mingzzinginstatoon_igg`: 보류.
- `meta_biocom_iggspring`: 보류.
- `meta_biocom_iggacidset_2026`: 보류.
- `meta_biocom_kimteamjang_supplements`: 이번 campaign/adset 대상 아님.

### 다음 확인 포인트

지금 더 export할 때 필요한 것은 성과 컬럼이 아니라 실제 URL 문자열이다.

Meta 광고관리자에서 컬럼으로 안 나오면, 광고 상세 화면에서 각 광고의 아래 값을 직접 확인해야 한다.

- `웹사이트 URL`
- `URL 매개변수`
- 광고 미리보기에서 실제 클릭 URL

특히 먼저 확인할 광고:

- `120242626208430396`: `[연뜰살뜰x음과검] 2차공구 - 사본 - 사본`
- `120243162846260396`: `[현서쓰고그리다x음과검] 04.01-05`
- `120243537994960396`: `[송율x음과검] 04.08-04.15`

이 3개에서 실제 URL 또는 URL 매개변수만 확인되면 `yeonddle`, `hyunseo`, `songyuul08`의 매핑 근거가 더 단단해진다.

## 2026-04-11 4차 수동 URL 확인 결과

TJ님이 Meta 광고 상세에서 직접 확인한 소스 URL과 웹사이트 URL을 반영했다.

이번 확인은 중요하다. 이전 CSV들은 광고명과 campaign/adset ID까지만 확인됐고, `url_tags`는 비어 있었다. 이번에는 실제 광고 상세의 URL에 `utm_campaign`이 들어간 것이 확인됐으므로, 아래 3개 alias는 campaign-level 매핑을 manual verified로 올릴 수 있다.

### 연뜰살뜰 2차공구

대상 광고:

- 광고명: `[연뜰살뜰x음과검] 2차공구 - 사본 - 사본`
- 광고 ID: `120242626208430396`
- campaign ID: `120242626179290396`
- adset ID: `120242626179270396`

확인 URL:

```text
https://biocom.kr/igg_store/?idx=85&utm_source=meta_biocom_yeonddle_igg&utm_medium=meta_biocom_yeonddle_igg&utm_campaign=meta_biocom_yeonddle_igg&utm_content=meta_biocom_yeonddle_igg
```

판정:

- `meta_biocom_yeonddle_igg -> 120242626179290396` manual verified 가능.
- 근거는 광고명과 URL의 `utm_campaign`이 모두 일치한다는 점이다.

### 현서

대상 광고:

- 광고명: `[현서쓰고그리다x음과검] 04.01-05`
- 광고 ID: `120243162846260396`
- campaign ID: `120242626179290396`
- adset ID: `120242626179270396`

확인 URL:

```text
https://biocom.kr/hyunseo1?utm_source=meta_biocom_hyunseo01_igg&utm_medium=meta_biocom_hyunseo01_igg&utm_campaign=meta_biocom_hyunseo01_igg&utm_content=meta_biocom_hyunseo01_igg
```

판정:

- `meta_biocom_hyunseo01_igg -> 120242626179290396` manual verified 가능.
- 근거는 광고명과 URL의 `utm_campaign`이 모두 일치한다는 점이다.

### 송율

대상 광고:

- 광고명: `[송율x바이오컴] 04.08-04.15`
- 광고 ID: `120243539487070396`
- campaign ID: `120242626179290396`
- adset ID: `120242626179270396`

확인 URL:

```text
https://biocom.kr/songyuul08?utm_source=meta_biocom_songyuul08&utm_medium=meta_biocom_songyuul08&utm_campaign=meta_biocom_songyuul08&utm_content=meta_biocom_songyuul08
```

판정:

- `meta_biocom_songyuul08 -> 120242626179290396` manual verified 가능.
- 기존 audit 파일의 `confirmed 0건, pending 9건`은 최신 상태가 아니다.
- `data/meta_campaign_alias_audit.biocom.json`은 `2026-04-08T16:34:01Z` 생성본이다. 한국 시간으로는 `2026-04-09 01:34:01 KST` 생성된 스냅샷이다.
- 최신 로컬 `attribution_ledger + imweb_orders` 기준으로는 송율 `payment_success`가 confirmed 29건, pending 1건, canceled 1건이다.
- 남은 pending 1건은 `pay_type=virtual`, `pg_type=tosspayments`인 가상계좌 주문이다.
- 기존 pending 9건의 금액 합계 `2,378,500원`은 최신 원장에서 `2026-04-08 KST` 송율 confirmed 카드 주문 9건의 합계와 일치한다. 즉 당시에는 상태 확정 정보가 아직 붙지 않아 pending으로 보였고, 이후 아임웹 주문 상태 동기화로 카드 confirmed로 바뀐 것으로 보는 것이 맞다.
- 따라서 campaign 매핑은 확인됐고, 현재 confirmed 매출 기반 ROAS 판단에는 `pending 9건`이 아니라 `pending 1건`만 보수적으로 제외하면 된다.

현재 남은 pending 주문:

- 주문번호: `202604094440004`
- 결제금액: `268,200원`
- 결제완료 페이지 수집시각: `2026-04-09 18:31:28 KST`
- 결제수단: `virtual` / Toss Payments, 즉 가상계좌
- 확정되지 않은 이유: 아임웹 주문 캐시에서 `complete_time=0`이고, 원장 metadata에도 `status=DONE`, `paymentStatus=confirmed`가 없다. Toss 로컬 거래/정산 테이블에서도 해당 `payment_key` 또는 주문번호 매칭 행이 없어 입금 확정 근거가 아직 없다.

### URL 매개변수 필드에 대한 해석

각 광고에서 `URL 매개변수=key1=value1&key2=value2`로 보였다고 전달됐다.

이 값은 실제 운영 UTM으로 보기는 어렵다. 중요한 값은 별도 URL 매개변수 필드가 아니라, 소스 URL/웹사이트 URL 안에 이미 들어있는 아래 UTM이다.

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`

즉 이번 판정은 `url_tags` 컬럼이나 `URL 매개변수` 필드가 아니라, 실제 소스 URL/웹사이트 URL에 들어간 `utm_campaign` 값을 근거로 한다.

### seed 반영 결론

아래 3개는 `data/meta_campaign_aliases.biocom.json`에서 `manual_verified`로 반영한다.

- `meta_biocom_yeonddle_igg`
- `meta_biocom_hyunseo01_igg`
- `meta_biocom_songyuul08`

아직 보류:

- `meta_biocom_proteinstory_igg`
- `meta_biocom_mingzzinginstatoon_igg`
- `meta_biocom_iggspring`
- `meta_biocom_iggacidset_2026`
- `meta_biocom_kimteamjang_supplements`
