# `/songyuul07` Meta 캠페인 매칭 확인 요청서

작성 시각: 2026-05-18 22:48 KST
기준일: 2026-05-18 KST
문서 성격: 그로스팀 전달용 read-only 확인 요청서
대상: 바이오컴 Meta 광고, `/songyuul07` 유입 주문 1건, 캠페인별 내부 Attribution ROAS
요청자: TJ님 / Codex
관련 문서: `meta/campaign-alias-mapping.md`, `meta/meta-utm-setup-growth-team-guide-20260504.md`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
    - docurule.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
    - meta/meta-utm-setup-growth-team-guide-20260504.md
  lane: Green
  allowed_actions:
    - 문서 작성
    - 그로스팀 read-only 확인 요청
    - Ads Manager 화면/CSV 확인 요청
  forbidden_actions:
    - Meta Ads Manager live 광고 수정
    - URL Parameters 수정
    - 광고 게시 또는 재게시
    - platform conversion send
    - production DB write
    - backend deploy
  source_window_freshness_confidence:
    source: "VM Cloud attribution ledger read-only + Meta API read-only + 로컬 백엔드 /api/ads/roas 재계산"
    window: "2026-05-18 KST today"
    freshness: "원장 latestLoggedAt 2026-05-18 22:38:10 KST, API 확인 2026-05-18 22:45:44 KST"
    confidence: 0.78
```

## 10초 요약

`/songyuul07`로 들어온 Meta 추정 주문 1건 `926,250원`이 현재 캠페인별 내부 ROAS에서 `(unmapped)`로 남아 있다.

주문에는 `fbclid`가 있고 `utm_source=meta`도 있어서 Meta 유입 가능성은 높다.
하지만 주문 URL의 `utm_campaign`, `utm_term`, `utm_content`가 실제 숫자 ID가 아니라 placeholder 상태라서, 현재 내부 시스템만으로는 어느 캠페인/광고세트/광고인지 확정할 수 없다.

그로스팀에는 광고를 수정하지 말고, Ads Manager에서 `/songyuul07`이 들어간 실제 광고의 URL과 숫자 ID만 확인해 달라고 요청한다.

## 그로스팀에 보낼 짧은 메시지

아래 문장을 그대로 보내면 된다.

```text
안녕하세요. 바이오컴 Meta ROAS 매칭 때문에 확인 요청드립니다.

2026-05-18 결제완료 주문 중 `/songyuul07` 랜딩으로 들어온 Meta 추정 주문 1건이 내부 캠페인 ROAS에서 아직 미매칭입니다.
주문에는 fbclid와 utm_source=meta가 있으나, utm_campaign={{campaign.id}}, utm_term={{adset.id}}, utm_content={{ad.id}}처럼 숫자 ID가 치환되지 않은 상태로 남아 있어 내부에서 캠페인을 확정할 수 없습니다.

광고 수정은 절대 하지 말고, Ads Manager에서 `/songyuul07`이 들어간 광고의 실제 Website URL, URL Parameters, Campaign ID, Ad set ID, Ad ID만 확인해서 회신 부탁드립니다.

가능하면 아래 항목을 CSV나 표로 부탁드립니다.

1. Campaign ID / Campaign Name
2. Ad set ID / Ad set Name
3. Ad ID / Ad Name
4. 광고 상태: active, paused, archived 중 무엇인지
5. Website URL 또는 Destination URL 전체
6. URL Parameters 전체
7. 2026-05-18 기준 집행 여부와 광고비
8. `/songyuul07`이 여러 광고나 여러 캠페인에 있으면 전부

중요: 이번 요청은 확인용입니다. URL Parameters 추가, 광고 URL 수정, 게시/재게시는 하지 말아주세요.
```

## 왜 이 확인이 필요한가

현재 내부 원장에는 아래처럼 들어왔다.

```text
주문 식별: 주문키 해시 3cd55a3732
결제완료 시각: 2026-05-18 14:04 KST
전환금액: 926,250원
랜딩 경로: /songyuul07
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
fbclid 있음
campaign_alias=meta_biocom_광고별칭
```

이 값만으로 알 수 있는 것:

- Meta 광고 클릭 가능성은 높다.
- 유입 랜딩은 `/songyuul07`이다.
- 전환금액은 내부 원장 기준 `926,250원`이다.

이 값만으로 알 수 없는 것:

- 어느 campaign ID인지 알 수 없다.
- 어느 ad set ID인지 알 수 없다.
- 어느 ad ID인지 알 수 없다.
- `campaign_alias=meta_biocom_광고별칭`은 실제 별칭이 아니라 기본 placeholder라서 매칭 근거로 쓸 수 없다.

따라서 Ads Manager에서 실제 광고 URL 또는 숫자 ID를 확인해야 한다.

## 현재 Codex 판정

현재 판정은 `D급: quarantine / 수동확인 필요`다.

판정 이유:

- `fbclid`가 있으므로 Meta 유입 흔적은 있다.
- 그러나 `fbclid`만으로는 내부에서 campaign/adset/ad를 역산할 수 없다.
- 주문 URL의 `utm_campaign`, `utm_term`, `utm_content`는 숫자 ID가 아니라 placeholder 문자열이다.
- 현재 Meta API read-only 조회에서 `/songyuul07`이 들어간 단일 creative URL 후보가 확인되지 않았다.
- 광고명에 `songyuul`로 보이는 후보가 있어도, URL 또는 숫자 ID 없이 광고명만으로 매출을 붙이면 오매칭 위험이 있다.

## Ads Manager에서 확인할 화면

그로스팀이 확인할 위치는 광고 수정 화면이 아니라 확인 화면이다.

1. Meta Ads Manager를 연다.
2. 바이오컴 광고 계정을 선택한다.
3. 날짜 범위를 `2026. 5. 18` 하루 또는 `2026. 5. 11 ~ 2026. 5. 18`로 둔다.
4. `광고` 탭으로 이동한다.
5. 검색창에서 아래 키워드를 각각 검색한다.

```text
songyuul07
songyuul
송율
```

6. 검색 결과가 있으면 해당 광고를 열어 아래 영역을 확인한다.

```text
광고 편집 화면 > Destination / 목적지 / Website URL
광고 편집 화면 > Tracking / 추적 / URL Parameters
```

7. 검색 결과가 없으면, 오늘 집행된 광고 전체를 export해서 `Website URL`, `URL Parameters`, `Ad ID`가 보이는지 확인한다.
8. export에 URL이 안 나오면, 의심 광고를 직접 열어서 URL 영역을 캡처 또는 텍스트로 복사한다.

## 반드시 회신받아야 하는 필드

아래 항목이 있어야 내부 ROAS에서 정확히 처리할 수 있다.

| 필드 | 필수 여부 | 이유 |
|---|---:|---|
| Campaign ID | 필수 | 캠페인 ROAS에 붙이는 1순위 키 |
| Campaign Name | 필수 | 사람이 검토하기 위한 이름 |
| Ad set ID | 권장 | campaign ID가 없을 때 parent campaign 역추적 가능 |
| Ad set Name | 권장 | 광고세트 단위 후보 검토 |
| Ad ID | 권장 | 광고 소재 단위 확정 근거 |
| Ad Name | 필수 | `songyuul` 후보인지 사람이 확인 |
| 광고 상태 | 필수 | 오늘 집행 중인지, 과거/중지 광고인지 구분 |
| Website URL | 필수 | `/songyuul07`이 실제 랜딩인지 확인 |
| URL Parameters | 필수 | `utm_campaign`, `utm_term`, `utm_content`, `campaign_alias` 실제 설정 확인 |
| 2026-05-18 광고비 | 권장 | 오늘 실제 집행 여부 확인 |
| 2026-05-18 결과/구매값 | 있으면 좋음 | Meta 플랫폼 주장값과 내부 매출 비교용 |

## 회신 표 양식

그로스팀이 아래 표를 채워주면 된다.

| 확인 결과 | Campaign ID | Campaign Name | Ad set ID | Ad set Name | Ad ID | Ad Name | Status | Website URL | URL Parameters | 2026-05-18 Spend | 메모 |
|---|---|---|---|---|---|---|---|---|---|---:|---|
| 단일 후보 / 복수 후보 / 없음 |  |  |  |  |  |  | active/paused/archived |  |  |  |  |

작성 예시:

```text
확인 결과: 단일 후보
Campaign ID: 120245003319500396
Campaign Name: meta_biocom_influencer_260506
Ad set ID: 1202...
Ad set Name: meta_biocom_songyuul_...
Ad ID: 1202...
Ad Name: meta_biocom_songyuul_...
Status: active
Website URL: https://biocom.kr/songyuul07
URL Parameters: utm_source=meta&utm_medium=paid_social&...
2026-05-18 Spend: 00,000원
메모: 오늘 집행 중인 광고 1개에서만 확인
```

## Codex가 매칭하는 기준

그로스팀 회신 후 내부 ROAS 반영 기준은 아래처럼 나눈다.

### A급

주문 또는 광고 URL에 숫자 ID가 있다.

```text
utm_campaign=120...
utm_term=120...
utm_content=120...
meta_campaign_id=120...
meta_adset_id=120...
meta_ad_id=120...
```

처리:

- campaign ID가 있으면 캠페인 확정 매칭한다.
- adset/ad ID가 있으면 Meta API로 parent campaign을 역추적한다.
- 광고세트/광고 단위 분석에도 쓸 수 있다.

### B급

`/songyuul07`이 현재 Meta 광고의 Website URL 또는 URL Parameters에서 단일 캠페인으로만 확인된다.

처리:

- campaign-level 매칭은 허용한다.
- 광고세트/광고 단위 확정은 보류한다.

### C급

광고명이나 광고세트명에 `songyuul`이 있지만 URL 또는 숫자 ID가 없다.

처리:

- 후보로만 둔다.
- 캠페인 ROAS에는 자동 반영하지 않는다.

### D급

`fbclid`만 있거나, placeholder만 있고, Ads Manager에서도 URL/ID가 확인되지 않는다.

처리:

- quarantine 유지.
- 내부 캠페인 ROAS에는 붙이지 않는다.

## 그로스팀이 하면 안 되는 것

이번 요청은 확인용이다.

하면 안 되는 것:

- 기존 광고 URL 수정
- URL Parameters 추가
- 광고 게시 또는 재게시
- 캠페인/광고세트/광고 ON/OFF 변경
- 예산 변경
- 새 광고 복제

이유:

- 잘 돌고 있는 소재의 URL을 수정하면 광고 재검토나 학습 영향이 생길 수 있다.
- 이번 목적은 과거 주문 1건의 캠페인 매칭 근거 확인이다.
- 수정이 필요하면 별도 승인 문서로 분리해야 한다.

## 회신 후 내부 처리

그로스팀 회신을 받으면 Codex가 아래 순서로 처리한다.

1. 회신 표에서 `/songyuul07` 후보가 0개, 1개, 여러 개인지 확인한다.
2. 숫자 campaign/adset/ad ID가 있으면 Meta API와 대조한다.
3. 단일 campaign으로 확인되면 `3cd55a3732 / 926,250원`을 해당 campaign-level ROAS에 반영한다.
4. 복수 campaign이면 매칭하지 않고 후보 목록만 남긴다.
5. URL/ID가 없고 광고명만 있으면 `C급 후보`로 남긴다.
6. 결과를 `meta/campaign-alias-mapping.md`에 반영한다.

## 성공 기준

성공은 아래 셋 중 하나로 정의한다.

1. `A급`: 숫자 ID가 확인되어 캠페인 매칭 가능
2. `B급`: `/songyuul07`이 단일 캠페인 URL로 확인되어 campaign-level 매칭 가능
3. `보류 확정`: URL/ID 근거가 없어 D급 quarantine 유지

어느 쪽이든 “모른다”가 아니라 “매칭 가능” 또는 “보류가 맞다”로 결론이 나면 성공이다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | VM Cloud attribution ledger read-only, Meta API read-only, 로컬 백엔드 `/api/ads/roas` |
| window | 2026-05-18 KST today |
| freshness | 원장 latestLoggedAt 2026-05-18 22:38:10 KST, API 확인 2026-05-18 22:45:44 KST |
| site | biocom |
| confidence | 현재 unmapped 판정 B, 최종 캠페인 매칭은 그로스팀 URL/ID 회신 전까지 HOLD |

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| No-send verified | YES |
| No-write verified | YES |
| No-deploy verified | YES |
| No-publish verified | YES |
| No-platform-send verified | YES |
