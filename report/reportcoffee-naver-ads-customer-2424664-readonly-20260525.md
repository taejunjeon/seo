# reportcoffee Naver Ads customer 2424664 read-only 20260525

작성 시각: 2026-05-25 09:50 KST
담당: Codex
문서 성격: 더클린커피 Naver Ads customer 2424664 캠페인/광고비 read-only 조회

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
    - report/reportcoffee-naver-ads-customer-2424664-auth-check-20260525.md
  lane: Green
  allowed_actions:
    - Naver Ads read-only campaign list
    - Naver Ads read-only campaign stats
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
    source: "backend/.env NAVER_COFFEE_* -> Naver Search Ad API customer 2424664"
    window: "weekly 2026-05-18 - 2026-05-24, MTD 2026-05-01 - 2026-05-24, rolling30 2026-04-25 - 2026-05-24"
    freshness: "2026-05-25 09:45 KST API read"
    confidence: "high for API-reported stats, medium for true spend until Brand Search billing source is checked"
```

## 사람 말 요약

더클린커피 네이버 광고 계정 `2424664` 조회가 성공했다.

현재 계정에는 캠페인 8개가 있고, 모두 더클린커피 계정 안의 캠페인으로 볼 수 있다. 월초-기준일 기준 광고비는 3,190원, 클릭은 697회로 내려왔다.

다만 중요한 예외가 있다. `더클린커피 자사몰 브검` 캠페인은 클릭 639회와 네이버 주장 전환값 10,564,372원이 있는데 광고비 필드(`salesAmt`)는 0원이다. 브랜드검색 비용이 이 stats API 필드에 안 잡히는 구조일 수 있으므로, Slack 보고서에는 Naver 광고비를 `included_with_warning`으로 넣어야 한다.

## 실행 범위

- customer id: `2424664`
- API: Naver Search Ad API read-only
- env: `NAVER_COFFEE_ACEESS`, `NAVER_COFFEE_SECREY_KEY`, `NAVER_COFFEE_CUSTOMER_ID`
- 출력 JSON: `report/reportcoffee-naver-ads-customer-2424664-readonly-20260525.json`
- 광고 설정 변경: 0
- DB/cache write: 0
- Slack send: 0
- platform send: 0

주의: env 변수명은 현재 오타 형태다. 장기적으로는 `NAVER_COFFEE_ACCESS`, `NAVER_COFFEE_SECRET_KEY`도 함께 읽도록 코드 호환을 넣는 편이 안전하다.

## 기간별 합계

| window | 기간 | 광고비 | 클릭 | 비용 발생 캠페인 |
|---|---|---:|---:|---:|
| weekly | 2026-05-18 - 2026-05-24 | 440원 | 180 | 1 |
| MTD | 2026-05-01 - 2026-05-24 | 3,190원 | 697 | 1 |
| rolling30 | 2026-04-25 - 2026-05-24 | 4,015원 | 840 | 1 |

## 캠페인별 결과

| campaign | type | status | weekly spend | weekly clicks | MTD spend | MTD clicks | rolling30 spend | rolling30 clicks | Naver claim conv value |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 00.브랜드키워드 | SHOPPING | ELIGIBLE | 440원 | 8 | 3,190원 | 58 | 4,015원 | 73 | 2,357,300원 |
| 01.콜롬비아 원두 | SHOPPING | ELIGIBLE | 0원 | 0 | 0원 | 0 | 0원 | 0 | 0원 |
| 02.과테말라 원두 | SHOPPING | ELIGIBLE | 0원 | 0 | 0원 | 0 | 0원 | 0 | 0원 |
| 03.에티오피아 원두 | SHOPPING | ELIGIBLE | 0원 | 0 | 0원 | 0 | 0원 | 0 | 0원 |
| 04.케냐 원두 | SHOPPING | ELIGIBLE | 0원 | 0 | 0원 | 0 | 0원 | 0 | 0원 |
| 05.드립백 | SHOPPING | ELIGIBLE | 0원 | 0 | 0원 | 0 | 0원 | 0 | 0원 |
| 더클린커피 자사몰 브검 | BRAND_SEARCH | ELIGIBLE | 0원 | 172 | 0원 | 639 | 0원 | 767 | 10,564,372원 |
| 파워링크 | WEB_SITE | PAUSED | 0원 | 0 | 0원 | 0 | 0원 | 0 | 0원 |

주의: Naver claim conv value는 네이버가 주장하는 전환값이다. 내부 매출에 더하지 않는다.

## Slack 보고서 반영 판단

현재 `Naver: 0원 후보`는 더 이상 맞지 않다.

새 표현은 아래가 안전하다.

> Naver: API customer 2424664 기준 주간 광고비 440원 / 월초-기준일 3,190원 / 최근 30일 4,015원. 단, 브랜드검색은 클릭과 전환값이 있는데 비용 필드가 0원이라 true spend 확인 필요.

광고비 비중 계산에는 우선 API `salesAmt` 기준 440원, 3,190원, 4,015원을 넣을 수 있다. 하지만 브랜드검색 고정비 또는 별도 과금이 있으면 실제 광고비가 더 클 수 있으므로 `included_with_warning`으로 표시한다.

## 남은 확인

1. 브랜드검색 비용 source 확인
   - 이유: `더클린커피 자사몰 브검`은 클릭 639회인데 비용 0원으로 내려왔다.
   - 판단: `salesAmt`가 브랜드검색 계약비를 담지 않는지 확인 필요.

2. reportcoffee no-send JSON에 Naver spend 반영
   - 이유: 기존 Slack 미리보기는 Naver를 0원 후보로 봤다.
   - 방법: Naver spend source를 customer 2424664 read-only API로 바꾸고, 브랜드검색 비용 경고를 붙인다.

3. env 변수명 호환 보강
   - 이유: 현재 `ACEESS`, `SECREY_KEY` 오타형 변수명이다.
   - 방법: 코드에서 정상형/오타형을 모두 읽게 한다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
Naver Ads state change: 0
Raw secret output in report: 0
Remaining blocker: brand_search_spend_verification_gap
```
