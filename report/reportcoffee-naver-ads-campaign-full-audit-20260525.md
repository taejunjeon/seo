# reportcoffee Naver Ads campaign full audit 20260525

작성 시각: 2026-05-25 09:12 KST
담당: Codex
문서 성격: 더클린커피 Naver Ads API read-only 캠페인 전체 점검

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
    - report/reportcoffee.md
    - report/reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522.md
  lane: Green
  allowed_actions:
    - Naver Ads read-only campaign list
    - Naver Ads read-only campaign stats
    - Naver Ads read-only adgroup spot check
    - local markdown report output
  forbidden_actions:
    - Naver Ads state change
    - Naver Ads cache write
    - operating_db_write
    - Slack send
    - platform conversion send
    - GTM publish
    - raw secret output
  source_window_freshness_confidence:
    source: "local backend/.env BIOCOM_NAVER_ADS_* -> Naver Search Ad API read-only"
    window: "weekly 2026-05-18 - 2026-05-24, MTD 2026-05-01 - 2026-05-24, rolling30 2026-04-25 - 2026-05-24"
    freshness: "2026-05-25 09:00 KST API read"
    confidence: "high for the connected API account, low for accounts not configured in this repo"
```

## 사람 말 요약

현재 이 저장소에 연결된 Naver Ads API 계정으로는 더클린커피 캠페인이 돌아가는 증거가 없다.

쉽게 말하면, API가 읽는 광고 계정 안에는 더클린커피 이름이 들어간 캠페인 6개가 있지만 모두 멈춤 상태이고, 2026-05-01 - 2026-05-24 비용도 0원이다. 반대로 비용이 발생한 캠페인 7개는 모두 바이오컴/검사권 계열로 분류된다.

따라서 TJ님 화면에서 더클린커피 네이버 광고가 실제로 켜져 보인다면, 현재 repo에 연결된 `BIOCOM_NAVER_ADS_*` 계정이 아니라 다른 Naver Ads customer 계정이거나, 캠페인명이 더클린커피가 아닌 구조일 가능성이 높다.

## LTV / LTR 용어 정리

- LTV는 고객 생애 가치(Lifetime Value)다. 보통 매출, 마진, 순이익 중 무엇을 가치로 볼지 정해야 한다.
- LTR은 고객 생애 매출(Lifetime Revenue)이다. 비용과 마진을 빼지 않고 고객이 누적으로 만든 매출만 본다.
- 이번 더클린커피 보고서에서 먼저 붙일 값은 매출 기준이므로 `매출 LTV` 또는 더 정확히 `LTR`이라고 부를 수 있다.
- TJ님/실무 보고에는 `매출 LTV(LTR: 고객이 지금까지 만든 누적 매출)`처럼 1회 풀어서 쓰는 편이 안전하다.

## 원본 식별자 사용 원칙

재구매율 계산을 위해 원본 전화번호/회원코드/이메일을 계산 내부에서 사용하는 것은 허용으로 본다.

단, 구현 단계에서 지킬 선은 아래다.

- 계산 내부 메모리에서만 사용한다.
- 결과 파일, 로그, 화면, Slack, 외부 API에는 원본 식별자를 출력하지 않는다.
- 연결 로직이 안정화되면 저장/리포트용 key는 해시 처리한다.
- 집계 결과에는 고객 수, 재구매 고객 수, 주문 수, 매출만 남긴다.

## Naver Ads API 연결 상태

- 로컬 env 확인: `BIOCOM_NAVER_ADS_CUSTOMER_ID`, `BIOCOM_NAVER_ADS_ACESS`, `BIOCOM_NAVER_ADS_SECRET_KEY`만 확인됨.
- `COFFEE_NAVER_ADS_*`, `THECLEANCOFFEE_NAVER_ADS_*` 같은 더클린커피 전용 계정 env는 확인되지 않음.
- API read result: configured true, campaigns 37개, read failure 0.
- Naver Ads state change: 0.
- DB/cache write: 0.
- platform send: 0.

## 기간별 요약

- 주간: 2026-05-18 - 2026-05-24
- 월초-기준일: 2026-05-01 - 2026-05-24
- 최근 30일: 2026-04-25 - 2026-05-24

### 계정 전체

- 전체 캠페인: 37개
- 월초-기준일 비용 발생 캠페인: 7개
- 주간 계정 전체 광고비: 1,996,042원
- 월초-기준일 계정 전체 광고비: 5,951,960원
- 최근 30일 계정 전체 광고비: 7,343,119원

### 더클린커피 이름 후보

- 후보 캠페인: 6개
- 상태: 모두 PAUSED
- 주간 광고비: 0원
- 월초-기준일 광고비: 0원
- 최근 30일 광고비: 0원
- 주간 클릭: 0회
- 월초-기준일 클릭: 0회

## 더클린커피 후보 캠페인

| campaign | type | status | weekly spend | MTD spend | rolling30 spend | 판단 |
|---|---|---|---:|---:|---:|---|
| [쇼핑검색] 04_더클린커피 아임웹 | SHOPPING | PAUSED | 0원 | 0원 | 0원 | 후보지만 미운영 |
| [쇼핑검색] 04_더클린커피 아임웹 커피 | SHOPPING | PAUSED | 0원 | 0원 | 0원 | 후보지만 미운영 |
| [파워링크] 07-1_더클린커피_아임웹 | WEB_SITE | PAUSED | 0원 | 0원 | 0원 | 후보지만 미운영 |
| [파워링크] 07-3_더클린커피_록하트 | WEB_SITE | PAUSED | 0원 | 0원 | 0원 | 후보지만 미운영 |
| [파워링크] 더클린커피_아임웹/NXL | WEB_SITE | PAUSED | 0원 | 0원 | 0원 | 후보지만 미운영 |
| 브랜드검색03_더클린커피 | BRAND_SEARCH | PAUSED | 0원 | 0원 | 0원 | 후보지만 미운영 |

## 광고그룹 spot check

캠페인 이름만 보고 놓친 가능성을 줄이기 위해 광고그룹도 read-only로 일부 확인했다.

- `[파워링크] 07-1_더클린커피_아임웹` 아래 광고그룹 15개 확인.
- `방탄커피`, `커피타겟`, `콜롬비아수프리모`, `과테말라디카페인`, `케냐AA` 등 커피 광고그룹이 있지만 모두 PAUSED.
- `[파워링크] 07-3_더클린커피_록하트` 아래 광고그룹 6개 확인.
- `록하트_더클린커피`, `록하트_아리차`, `록하트_디카페인`, `록하트_드립백` 등 커피 광고그룹이 있지만 모두 PAUSED.

## 월초-기준일 비용 발생 캠페인

| campaign | type | status | weekly spend | weekly clicks | MTD spend | MTD clicks | Naver claim conv value | 판단 |
|---|---|---|---:|---:|---:|---:|---:|---|
| 바이오컴_파워링크_지연성검사 | WEB_SITE | ELIGIBLE | 1,241,983원 | 1,577 | 3,825,512원 | 4,109 | 56,276,397원 | 바이오컴/검사권 |
| 쇼핑검색01_바이오컴 아임웹 | SHOPPING | ELIGIBLE | 242,372원 | 162 | 735,363원 | 552 | 7,198,040원 | 바이오컴 |
| [파워링크] 04_호르몬검사_바이오컴 | WEB_SITE | ELIGIBLE | 142,523원 | 123 | 374,768원 | 322 | 1,383,505원 | 바이오컴/검사권 |
| [파워링크] 종합대사기능분석 런칭 | WEB_SITE | ELIGIBLE | 123,519원 | 100 | 365,740원 | 346 | 2,779,032원 | 바이오컴/검사권 |
| 바이오컴_파워링크_영양중금속검사 | WEB_SITE | ELIGIBLE | 95,534원 | 110 | 260,199원 | 317 | 1,606,027원 | 바이오컴/검사권 |
| 파워컨텐츠01_검사권_바이오컴 | POWER_CONTENTS | ELIGIBLE | 107,063원 | 1,253 | 238,557원 | 2,762 | 0원 | 바이오컴/검사권 |
| 바이오컴_파워링크_장내세균검사 | WEB_SITE | ELIGIBLE | 43,048원 | 61 | 151,821원 | 202 | 1,479,663원 | 바이오컴/검사권 |

주의: Naver claim conv value는 네이버가 주장하는 전환값이다. 내부 결제완료 매출에 더하지 않는다.

## 전체 캠페인 분류

| 분류 | 캠페인 수 | MTD spend | 해석 |
|---|---:|---:|---|
| 더클린커피 이름 후보 | 6 | 0원 | API 연결 계정 기준 미운영 |
| 더클린펫/바이오컴 혼합 제외 | 2 | 0원 | 커피 아님 |
| 바이오컴/검사권 제외 | 22 | 5,951,960원 | 비용 발생분 대부분 |
| 미매칭 | 7 | 0원 | 비용 없음 |

## 기존 보고 정정

기존 `Naver: 0원 확인 후보` 문구는 아래처럼 바꾸는 것이 맞다.

기존:

> Naver: 0원 확인 후보

수정:

> Naver: 현재 연결된 BIOCOM_NAVER_ADS 계정 기준 더클린커피 캠페인 6개는 모두 PAUSED/0원. TJ님 화면에서 커피 광고가 운영 중이면 별도 Naver Ads customer 계정 또는 다른 캠페인명일 가능성이 있어 계정 확인 필요.

## 다음 확인

1. TJ님이 보는 Naver Ads 화면의 customer/account가 이 repo의 `BIOCOM_NAVER_ADS_*`와 같은 계정인지 확인한다.
2. 더클린커피 광고가 운영 중인 화면에서 캠페인명 1개와 기간별 비용을 캡처한다.
3. 같은 계정이면 캠페인명이 더클린커피가 아닌 구조이므로 광고그룹/키워드/소재까지 full audit을 확장한다.
4. 다른 계정이면 `COFFEE_NAVER_ADS_*` read-only credential을 별도 env로 연결한 뒤 다시 read-only 조회한다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
Naver Ads state change: 0
Raw secret output: 0
Remaining blocker: account_scope_mismatch_possible
```
