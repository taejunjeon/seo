# cam03. Meta campaign alias 다음 액션

작성시각: 2026-04-11 KST

## 바로 다음에 할 일

1순위는 `data/meta_campaign_alias_audit.biocom.json`을 최신 원장 기준으로 다시 만드는 것이다.

이유:

- 현재 `data/meta_campaign_aliases.biocom.json`에는 연뜰살뜰, 현서, 송율 3개 alias를 `manual_verified`로 반영했다.
- 하지만 alias review API는 아직 오래된 `data/meta_campaign_alias_audit.biocom.json`의 evidence를 우선 읽는다.
- 이 audit 파일은 `2026-04-08T16:34:01Z`, 즉 `2026-04-09 01:34:01 KST` 생성본이다.
- 그래서 송율처럼 현재 원장에서는 `confirmed 29건 / pending 1건`인데도, review 화면에서는 오래된 `confirmed 0건 / pending 9건`이 보일 수 있다.

따라서 다음 작업은 두 갈래다.

- `audit export`를 최신 원장과 현재 분석 기간 기준으로 재생성한다.
- review API가 stale audit만 믿지 않도록, seed에 기록된 최신 수동 evidence 또는 최신 원장 집계를 함께 보여주게 한다.

## 현재 업데이트 상태

완료:

- `meta_biocom_yeonddle_igg -> 120242626179290396` manual verified
- `meta_biocom_hyunseo01_igg -> 120242626179290396` manual verified
- `meta_biocom_songyuul08 -> 120242626179290396` manual verified
- 송율 `pending 9건`은 오래된 audit 값으로 정정했다.
- 최신 로컬 원장 기준 송율 `payment_success`는 confirmed 29건, pending 1건, canceled 1건이다.
- 남은 pending 1건은 `pay_type=virtual`, `pg_type=tosspayments`인 가상계좌 주문이다.

아직 미완료:

- `data/meta_campaign_alias_audit.biocom.json` 자체는 아직 오래된 값이다.
- `meta_biocom_proteinstory_igg`, `meta_biocom_mingzzinginstatoon_igg`, `meta_biocom_iggspring`, `meta_biocom_iggacidset_2026`, `meta_biocom_kimteamjang_supplements` 등은 아직 `needs_manual_review`다.
- 최신 audit 재생성 전까지 `/ads`의 alias review 카드가 완전히 최신이라고 보면 안 된다.

## TJ님이 광고 URL을 하나씩 줄 필요가 있는가

원칙적으로는 필요 없다.

내가 더 할 수 있는 작업:

- Meta API로 광고 ID별 creative 정보를 직접 조회한다.
- 광고의 `object_story_spec`, `link_data.link`, `call_to_action.value.link`, `video_data.call_to_action.value.link`, `creative.link_url`, `url_tags`를 수집한다.
- 수집된 URL에서 `utm_campaign`을 파싱해서 `utm_campaign -> campaign_id / adset_id / ad_id` 매핑 후보를 자동 생성한다.
- URL이 API에서 안 나오는 광고만 예외 목록으로 따로 뽑는다.
- 예외 목록도 전부 수동 확인하지 않고, 지출/구매/구매전환값/Attribution 매출이 큰 순서로 상위만 확인하면 된다.

즉 앞으로의 작업 방식은 다음이 맞다.

1. Meta API 자동 수집
2. CSV ad ID와 API creative URL 조인
3. `utm_campaign` 자동 추출
4. 충돌 없는 것은 자동 후보화
5. 충돌 있거나 URL이 안 나오는 상위 건만 수동 확인

## CSV export에서 URL을 포함시킬 수 있는가

부분적으로 가능하지만, 현재 CSV만으로는 부족하다.

이번에 받은 CSV 확인 결과:

- 최신 CSV에는 `광고 ID`, `광고 세트 ID`, `캠페인 ID`, `url_tags` 컬럼이 들어 있다.
- 하지만 `url_tags`는 16개 행 모두 비어 있다.
- `웹사이트 URL` 또는 `소스 URL` 컬럼은 들어 있지 않았다.

해석:

- Meta 광고관리자에서 `URL 매개변수` 필드를 별도로 쓴 경우에는 `url_tags`로 export될 수 있다.
- 하지만 지금 바이오컴 광고는 `URL 매개변수` 필드가 아니라 실제 웹사이트 URL 안에 UTM이 박혀 있는 형태가 많다.
- 이 경우 광고 리포트 CSV의 `url_tags` 컬럼만으로는 UTM을 못 본다.
- TJ님이 화면에서 본 `소스 URL` / `웹사이트 URL`은 광고 세팅 또는 creative 쪽 값이고, 일반 성과 리포트 CSV에는 안 들어올 수 있다.

CSV에서 다시 시도해볼 수 있는 방법:

- 광고관리자에서 반드시 `광고` 레벨로 둔다.
- 컬럼 맞춤 설정에서 아래 컬럼을 찾는다.
- `광고 ID`
- `광고 세트 ID`
- `캠페인 ID`
- `광고 이름`
- `광고 세트 이름`
- `캠페인 이름`
- `웹사이트 URL`
- `소스 URL`
- `URL 매개변수`
- `url_tags`
- `목적지`
- `랜딩 페이지`

주의:

- 위 컬럼명은 Meta UI 언어/계정 상태에 따라 다르게 보일 수 있다.
- 이번 CSV처럼 `url_tags`만 추가되고 실제 `웹사이트 URL`이 빠질 수 있다.
- 그래서 CSV는 보조 수단이고, 더 안정적인 방법은 Meta API로 creative URL을 직접 읽는 것이다.

## URL이 있어야지만 확정할 수 있는가

100% 확정에는 URL이 가장 좋다. 하지만 URL이 항상 필수는 아니다.

확정 등급을 나누는 것이 맞다.

### manual_verified

다음 중 하나가 있으면 확정으로 본다.

- 광고의 실제 웹사이트 URL 또는 소스 URL 안에 `utm_campaign=alias_key`가 있다.
- Meta API creative URL에서 `utm_campaign=alias_key`가 확인된다.
- URL 매개변수 `url_tags`에 `utm_campaign=alias_key`가 있다.

이 등급은 campaign-level ROAS 표에 바로 써도 된다.

### high_confidence

URL은 없지만 아래 조건이 모두 맞으면 높은 신뢰 후보로 본다.

- 광고명, 광고세트명, 캠페인명에 인플루언서명 또는 slug가 직접 들어 있다.
- 같은 기간 같은 slug가 여러 캠페인에 중복되지 않는다.
- Attribution 원장에는 해당 `utm_campaign` 주문이 있고, Meta 쪽에는 대응되는 광고 그룹이 하나로 좁혀진다.

이 등급은 화면에 “확정 전 후보”로 보여주고, 자동 ROAS 의사결정에는 보수적으로 써야 한다.

### needs_manual_review

다음이면 수동 검토가 필요하다.

- 같은 인플루언서명이 여러 campaign/adset/ad에 걸쳐 있다.
- 광고명은 비슷하지만 URL이나 UTM 근거가 없다.
- campaign은 하나로 보이지만 광고세트 또는 광고 단위에서 여러 랜딩이 섞여 있다.
- Meta API에서도 creative URL이 안 나온다.

## 왜 URL이 중요한가

Attribution 원장은 주문에 남은 `utm_campaign`을 기준으로 매출을 묶는다.

Meta 광고관리자는 campaign/adset/ad ID를 기준으로 비용과 플랫폼 구매 전환값을 묶는다.

따라서 campaign-level Attribution ROAS를 만들려면 아래 연결고리가 필요하다.

```text
주문 utm_campaign
-> 광고 URL의 utm_campaign
-> Meta ad ID
-> Meta adset ID
-> Meta campaign ID
```

URL이 있으면 이 연결고리가 직접 증명된다.

URL이 없으면 광고명/광고세트명으로 추정해야 한다. 이 경우 사람이 보기에는 그럴듯해도, 나중에 같은 인플루언서명 또는 비슷한 광고명이 여러 캠페인에 생기면 잘못 매핑될 수 있다.

## 내가 다음에 자동화할 수 있는 구체 작업

### 1. 최신 alias audit 재생성

현재 export script는 날짜 프리셋이 하드코딩되어 있다.

문제:

- `last_7d`가 `2026-04-03 ~ 2026-04-09`로 고정돼 있다.
- 지금 분석 화면은 `2026-04-04 ~ 2026-04-10` 또는 현재 기준 최근 7일과 섞여 있다.
- 이 상태로 재실행하면 또 날짜축 mismatch가 날 수 있다.

해야 할 일:

- script에 `--start-date`, `--end-date` 옵션을 추가한다.
- Meta spend 기간과 Attribution order 기간을 같은 날짜로 맞춘다.
- 생성 결과에 `ledgerGeneratedAt`, `metaDateRange`, `ledgerDateRange`를 명시한다.

### 2. Meta creative URL 수집기 보강

현재 script는 아래 경로를 읽는다.

- `creative.object_story_spec.link_data.link`
- `creative.object_story_spec.link_data.call_to_action.value.link`
- `creative.object_story_spec.video_data.call_to_action.value.link`
- `creative.link_url`
- `ad.url_tags`

추가로 더 봐야 할 후보:

- dynamic creative의 `asset_feed_spec.link_urls`
- effective post attachment의 `unshimmed_url`
- ad creative의 `url_tags`
- ad snapshot 또는 preview에서 확인 가능한 destination URL

기대 효과:

- TJ님이 광고 하나씩 클릭해서 URL을 복사하는 작업을 크게 줄일 수 있다.
- API로 URL이 안 나오는 일부 광고만 수동 확인하면 된다.

### 3. CSV 조인용 evidence 파일 생성

CSV에는 `광고 ID`, `광고 세트 ID`, `캠페인 ID`가 있으므로, 이 값으로 API 결과와 조인할 수 있다.

생성할 파일 예시:

```text
meta/campaign-url-evidence.biocom.json
```

각 row에 넣을 값:

- campaign_id
- campaign_name
- adset_id
- adset_name
- ad_id
- ad_name
- spend
- purchases
- purchase_value
- creative_landing_url
- url_tags
- extracted_utm_campaign
- matched_alias_key
- confidence
- reason

### 4. 수동 검토를 “전부”가 아니라 “예외”로 바꾸기

수동 확인은 아래 조건에 해당하는 광고만 하면 된다.

- spend 상위인데 URL이 안 나온 광고
- Attribution 매출이 큰 alias인데 campaign 후보가 2개 이상인 경우
- 광고명과 UTM이 서로 충돌하는 경우
- 기존 manual_verified와 다른 campaign으로 연결되는 경우

## 추천 운영 방식

단기:

- 송율처럼 이미 URL 근거가 있는 3개는 manual verified 유지.
- audit 파일을 최신 원장 기준으로 재생성해서 stale evidence를 제거.
- 남은 alias는 Meta API URL 수집으로 자동 후보를 먼저 만든다.

중기:

- 광고 생성 규칙을 고정한다.
- 모든 광고 URL에는 `utm_campaign`을 반드시 넣는다.
- `utm_campaign`에는 인플루언서 slug와 상품군이 들어가야 한다.
- 가능하면 `utm_content`에는 ad ID 또는 ad slug를 넣는다.
- URL 매개변수 필드에도 동일한 UTM을 넣어 CSV `url_tags`로도 export되게 한다.

장기:

- 주문 원장에 `campaign_id`, `adset_id`, `ad_id`까지 직접 남긴다.
- 최소한 `fbclid`, `_fbc`, `_fbp`, `utm_campaign`, `utm_content`는 결제완료 시점에 안정적으로 저장한다.
- 이렇게 해야 Meta ROAS와 Attribution ROAS 차이를 campaign/adset/ad 단위로 설명할 수 있다.

## 결론

URL이 있으면 가장 깨끗하게 확정할 수 있다.

하지만 TJ님이 URL을 하나씩 제공하는 방식은 운영 방식으로는 비효율적이다. 지금부터는 Meta API로 creative URL을 최대한 자동 수집하고, CSV는 광고 ID/성과/이름을 붙이는 보조 자료로 쓰는 게 맞다.

다음 개발 액션은 `audit 날짜축 수정 + Meta creative URL 수집 보강 + campaign-url-evidence 파일 생성`이다.
