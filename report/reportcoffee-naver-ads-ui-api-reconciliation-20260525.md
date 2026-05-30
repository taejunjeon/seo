# reportcoffee Naver Ads UI/API reconciliation 20260525

작성 시각: 2026-05-25 10:20 KST
Hermes XLSX 보정: 2026-05-25 17:46 KST
담당: Codex
문서 성격: 더클린커피 Naver 광고비 UI/API 불일치 원인 재조사

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - report/reportcoffee-naver-ads-customer-2424664-readonly-20260525.md
  lane: Green
  allowed_actions:
    - Naver Search Ad API read-only result review
    - user-provided Naver Ads UI screenshot review
    - Hermes GitHub result/XLSX read-only review
    - official Naver API documentation review
    - local JSON/Markdown report output
  forbidden_actions:
    - Naver Ads state change
    - Naver Ads cache write
    - operating_db_write
    - Slack send
    - platform conversion send
    - GTM publish
    - raw secret output
  source_window_freshness_confidence:
    source: "Naver Search Ad API customer 2424664 + TJ screenshot + Hermes XLSX export + official Naver Performance DA API docs"
    window: "2026-05-18 - 2026-05-24 KST"
    freshness: "2026-05-25 17:46 KST"
    confidence: "high for weekly discrepancy cause and weekly reconciled spend, low for MTD/rolling30 display until export/API source attached"
```

## 사람 말 요약

TJ님 지적이 맞다. 이전 API 집계는 더클린커피 네이버 광고비를 과소 계산했다.

원인은 검색광고와 디스플레이 광고가 같은 화면에는 같이 보이지만, 우리가 호출한 `Naver Search Ad API`는 검색광고 쪽 캠페인만 읽었기 때문이다. 화면의 큰 비용은 `디스플레이 광고`에 있는 `[ADVoost] 쇼핑` 캠페인이다. 대시보드 카드에서는 350,097원으로 보였고, Hermes가 전체 캠페인 화면에서 받은 XLSX 원본과 화면 row는 350,098원으로 확인됐다.

따라서 2026-05-18 - 2026-05-24 주간 Naver 광고비는 API-only 440원이 아니라, 검색광고 440원 + ADVoost 디스플레이 350,098원 = 350,538원으로 봐야 한다. 1원 차이는 대시보드 카드와 다운로드 원본의 반올림 또는 집계 표시 차이로 보고, 보고서 원장에는 재현 가능한 XLSX 값을 우선한다.

## 왜 틀렸는가

이전 조회는 customer `2424664`의 `GET /ncc/campaigns`와 `/stats`를 읽었다.

이 경로는 네이버 검색광고 API다. 응답에 포함된 캠페인은 `cmp-a001-...` 형태의 검색광고 캠페인 8개였다.

하지만 TJ님 화면의 전체 캠페인에는 아래 두 묶음이 같이 있다.

- 검색광고: 브랜드검색, 쇼핑검색, 파워링크
- 디스플레이 광고: `[ADVoost] 쇼핑`, `[카탈로그]`

누락된 핵심 row는 `[ADVoost] 쇼핑`이다.

## 숫자 대조

### UI 전체

- 기간: 2026-05-18 - 2026-05-24
- 총 노출수: 26,239
- 총 클릭수: 374
- 총 전환수: 204
- 평균 CPC: 937원

### 검색광고 API에서 읽힌 값

- 노출수: 936
- 클릭수: 180
- 광고비: 440원

구성:

- `00.브랜드키워드`: 노출 688 / 클릭 8 / 광고비 440원
- `더클린커피 자사몰 브검`: 노출 248 / 클릭 172 / 광고비 0원

### UI/XLSX에서 확인된 디스플레이 광고

- 캠페인: `[ADVoost] 쇼핑`
- UI campaign id: `1261102`
- 노출수: 25,303
- 클릭수: 194
- 평균 CPC: 1,805원
- 대시보드 카드 총비용: 350,097원
- 전체 캠페인 row/XLSX 총비용: 350,098원
- 총 전환수: 55
- 총 전환매출액: 3,463,700원

### 맞춰본 주간 광고비

검색광고 API 광고비 440원 + Hermes XLSX ADVoost 광고비 350,098원 = 350,538원.

이 값은 UI 하단 전체 평균 CPC 937원과도 방향이 맞다. 350,538원 / 374클릭 = 약 937원이다.

## 공식 API 기준

Naver Search Ad API는 `api.searchad.naver.com` 경로의 검색광고 API다.

Naver Performance DA API는 별도 문서와 별도 경로가 있다. 공식 문서에는 이 API가 NAVER Performance DA를 관리하는 REST API이며, 캠페인/광고그룹/소재 성과를 조회하는 performance endpoint가 따로 있다. 또한 beta API이고 공식 파트너만 접근 권한을 요청할 수 있다고 되어 있다.

즉 `[ADVoost] 쇼핑`은 Search Ad API가 아니라 Performance DA 또는 UI export 쪽 source가 필요하다.

참조:

- Naver Search Ad API: https://naver.github.io/searchad-apidoc/
- Naver Performance DA API Getting Started: https://naver-ad-api.github.io/developers/en/docs/intro
- Naver Performance DA Performance API: https://naver-ad-api.github.io/developers/en/api/performance

## 보고서 반영 규칙

기존 표현:

> Naver: customer 2424664 API 기준 주간 광고비 440원

수정 표현:

> Naver: 주간 350,538원 확인. 검색광고 API 440원 + Hermes XLSX에서 확인된 ADVoost 디스플레이 350,098원. 월간은 디스플레이 API/export 연결 전까지 HOLD.

Slack no-send에는 같은 기간일 때만 아래처럼 넣는다.

- weekly Naver spend: 350,538원
- source: `search_ads_api + hermes_xlsx_display_advoost`
- status: `included_with_warning`
- warning: `ADVoost display spend is not covered by Naver Search Ad API; display export source attached for 2026-05-18 - 2026-05-24 only`

월초-기준일/최근 30일에는 검색광고 API 값만 넣으면 또 과소 계산된다. 따라서 MTD/rolling30은 `display source pending`으로 유지한다.

현재 `reportcoffee-sales-summary-no-send-20260524`의 주간 window는 2026-05-17 - 2026-05-23이다. Hermes XLSX는 2026-05-18 - 2026-05-24이므로 기존 no-send 합계에는 아직 직접 반영하지 않는다. 같은 기간으로 재생성하거나, Hermes에 2026-05-17 - 2026-05-23 원본을 다시 받으면 반영 가능하다.

## 다음 확인

1. Naver Performance DA API 접근 가능 여부 확인
   - 이유: `[ADVoost] 쇼핑`은 검색광고 API에 안 들어온다.
   - 필요한 정보: ad account number, manager account number, OAuth/Naver Login app 접근.

2. 당장 자동화 전에는 UI 다운로드 사용
   - 이유: 화면에 다운로드 버튼이 있으므로 weekly/monthly export로 ADVoost 비용을 보강할 수 있다.
   - 방식: 다운로드 CSV/XLSX를 report source로 적재하거나, no-send JSON 옆에 첨부 source로 둔다.

3. reportcoffee no-send JSON 수정
   - 이유: 주간 Naver 광고비 440원은 틀린 값이다.
   - 방식: 같은 기간 기준으로 주간은 350,538원으로 보정하고, 월간은 display source pending을 표시한다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
Naver Ads state change: 0
Raw secret output in report: 0
Remaining blocker: display_advoost_monthly_source_pending + existing_no_send_window_mismatch
```
