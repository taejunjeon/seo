# reportcoffee Naver display Hermes export result 20260525

작성 시각: 2026-05-25 17:46 KST
담당: Codex
문서 성격: 더클린커피 네이버 디스플레이 광고비 원본 확정 보고

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
    - report/reportcoffee-naver-ads-ui-api-reconciliation-20260525.md
  lane: Green
  allowed_actions:
    - Hermes GitHub result pull/read
    - XLSX read-only parse
    - local JSON/Markdown report output
  forbidden_actions:
    - Naver Ads state change
    - ad create/edit/delete
    - budget change
    - charge/payment action
    - Slack send
    - operating_db_write
    - cache write
    - platform conversion send
    - raw secret or customer PII output
  source_window_freshness_confidence:
    source: "Hermes Chrome CDP XLSX export + Naver Search Ad API read-only reference"
    window: "2026-05-18 - 2026-05-24 KST"
    freshness: "Hermes result pushed before 2026-05-25 17:46 KST"
    confidence: "high for this weekly Naver display spend, low for MTD/rolling30 display until matching export/API source exists"
```

## 사람 말 요약

더클린커피 네이버 광고비가 작게 보였던 이유는 검색광고 API만 읽고 있었기 때문이다. 네이버 광고주센터 화면에는 검색광고와 디스플레이 광고가 같이 보이지만, 우리가 가진 공식 API는 검색광고만 가져왔다.

Hermes가 네이버 광고주센터 전체 캠페인 화면에서 XLSX 원본을 다운로드했고, `[ADVoost] 쇼핑` 광고비는 2026-05-18 - 2026-05-24 기준 350,098원으로 확인됐다. 화면 카드에 보였던 350,097원과는 1원 차이가 있는데, 다운로드 원본과 전체 캠페인 row가 350,098원으로 일치하므로 보고서에는 350,098원을 쓴다.

같은 기간의 검색광고 API 비용 440원을 더하면, 더클린커피 네이버 주간 광고비는 350,538원이다.

## 확인한 원본

- GitHub repo: `taejunjeon/hermes-codex-repo`
- Hermes commit: `536c20c naver-ads: add campaign report export result`
- 결과 JSON: `results/naver-display-export-campaign-report-20260525.result.json`
- 다운로드 원본: `downloads/naver-display-campaign-report-20260518-20260524.xlsx`
- 증거 스크린샷: `screenshots/naver-display-export-campaign-report-20260525.png`

## 네이버 디스플레이 광고 결과

- 기간: 2026-05-18 - 2026-05-24 KST
- 계정: 더클린커피 `2424664`
- 캠페인: `[ADVoost] 쇼핑`
- 캠페인 ID: `1261102`
- 노출수: 25,303
- 클릭수: 194
- 클릭률: 0.77%
- 평균 CPC: 1,805원
- 총비용: 350,098원
- 전환수: 55
- 전환매출액: 3,463,700원

## 1원 차이 처리

대시보드 카드에서는 350,097원으로 보였다. 하지만 전체 캠페인 화면 row와 다운로드 XLSX 파일은 모두 350,098원이었다.

보고서 기준은 재현 가능한 원본 파일이어야 하므로, Slack no-send와 매출 보고서에는 350,098원을 우선 반영한다. 350,097원은 “화면 카드 표시값”으로만 남긴다.

## 같은 기간 네이버 광고비

- 검색광고 API: 440원
- ADVoost 디스플레이 XLSX: 350,098원
- 합계: 350,538원

이 값은 네이버 화면 전체 클릭 374회, 평균 CPC 937원과도 맞는다. 350,538원 / 374클릭은 약 937원이다.

## 기존 no-send 파일에는 아직 반영하지 않은 이유

현재 `report/reportcoffee-sales-summary-no-send-20260524.json`의 주간 기간은 2026-05-17 - 2026-05-23이다.

Hermes가 다운로드한 XLSX는 2026-05-18 - 2026-05-24이다. 기간이 하루씩 밀려 있으므로 기존 no-send 주간 합계에 바로 더하면 안 된다. 이렇게 섞으면 매출 기간과 광고비 기간이 달라져 매출액 대비 광고비 비중이 틀어진다.

안전한 반영 방법은 두 가지다.

1. Slack no-send를 2026-05-18 - 2026-05-24 기준으로 새로 만든다.
2. Hermes에 2026-05-17 - 2026-05-23 기준 XLSX를 다시 받아 기존 no-send 파일에 붙인다.

## Track 진척률

- Track A: 81% -> 81% (+0%)
- Track B: 100% -> 100% (+0%)
- Track C: 99% -> 100% (+1%)
- Track D: 56% -> 60% (+4%)
- Track E: 100% -> 100% (+0%)
- Track F: 100% -> 100% (+0%)

## Guardrail 결과

- 네이버 광고 생성/수정: 0
- 예산 변경: 0
- 충전/결제 액션: 0
- Slack 발송: 0
- 로컬 cache write: 0
- 운영DB write: 0
- 플랫폼 전환 전송: 0
- raw secret/고객 식별자 출력: 0

## 다음 안전 액션

첫 번째 추천은 2026-05-18 - 2026-05-24 기준으로 더클린커피 no-send 보고서를 다시 생성하는 것이다. 이유는 현재 날짜가 2026-05-25이고, 전일 마감 주간 보고라면 이 기간이 더 자연스럽기 때문이다.

기존 2026-05-17 - 2026-05-23 파일을 유지해야 한다면 Hermes에 같은 기간 XLSX를 다시 요청해야 한다.
