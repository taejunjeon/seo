# 네이버 성과 디스플레이 2026년 4월 Hermes 원본 검증 결과

작성 시각: 2026-05-26 17:50 KST  
기준일: 2026-05-26  
문서 성격: Naver performance display Hermes XLSX/JSON read-only import preview

## 10초 요약

Hermes가 받은 2026년 4월 네이버 성과 디스플레이 원본은 리포트 반영에 사용할 수 있다. 단, 광고비와 전환금액의 primary source는 XLSX이고, JSON은 안전성·행 수 확인용이다. 네이버 플랫폼 전환금액은 내부 결제완료 매출이 아니므로 예산 판단 화면에서는 "네이버 주장값"으로만 표시한다. 2026-05-26 21:13 KST 추가 확인으로 더클린커피 쇼핑검색/ADVoost 랜딩은 자사몰이 아니라 `https://smartstore.naver.com/lockhart` 스마트스토어로 확인됐다.

## Harness Preflight

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read: n/a
  required_context_docs:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - hermes/README.md
    - project/hermes-naver-display-april-export-prompt-20260526.md
  lane: Green
  allowed_actions:
    - read Hermes JSON/XLSX artifacts
    - aggregate-only JSON/Markdown result generation
    - local API skeleton source update
  forbidden_actions:
    - Naver Ads state change
    - platform conversion send
    - operating DB write
    - VM Cloud write/deploy
    - GTM publish
  source_window_freshness_confidence:
    source: Hermes XLSX downloads + Hermes result JSON
    window: 2026-04-01~2026-04-30 KST
    freshness: Hermes queried_at 2026-05-26T01:03:17+09:00
    confidence: 0.92
```

## 이번에 가능해진 것

네이버 ROAS 화면에서 성과 디스플레이 광고비를 더 이상 비워두지 않아도 된다. 2026년 4월 성과 디스플레이 광고비는 더클린커피 1,171,829원, 바이오컴 12,772,245원로 표시하면 된다.

## 왜 중요한가

검색광고 API에는 성과 디스플레이가 들어오지 않는다. 그래서 검색광고 API 비용만 보면 네이버 광고비가 과소 집계되고, 전체 ROAS가 과대평가된다.

## 실제 확인된 숫자

| 구분 | 광고비 | 네이버 주장 전환금액 | 클릭수 | 네이버 주장 ROAS | 활성 캠페인 |
|---|---:|---:|---:|---:|---:|
| 더클린커피 | 1,171,829원 | 10,046,842원 | 884 | 857.36% | 1 |
| 바이오컴 | 12,772,245원 | 141,972,560원 | 5,398 | 1111.57% | 2 |
| 합계 | 13,944,074원 | 152,019,402원 | 6,282 | 1090.21% | 3 |

## 캠페인별 원본

| site | account_id | campaign | type | 광고비 | 네이버 주장 전환금액 | 클릭수 | ROAS | 상태 |
|---|---|---|---|---:|---:|---:|---:|---|
| biocom | 1887533 | ADVoost 쇼핑_바이오컴 영양제_미리바이오_250925 | ADVoost 쇼핑 | 9,853,834원 | 116,965,560원 | 3,392 | 1187.01% | ENABLED |
| biocom | 1887533 | ADVoost_DA test | 웹사이트 전환 | 2,918,411원 | 25,007,000원 | 2,006 | 856.87% | ENABLED |
| thecleancoffee | 2424664 | [ADVoost] 쇼핑 | ADVoost 쇼핑 | 1,171,829원 | 10,046,842원 | 884 | 857.36% | ENABLED / 스마트스토어 랜딩 |
| thecleancoffee | 2424664 | [카탈로그] | 카탈로그 판매 | 0원 | 0원 | 0 | 0% | ENABLED |
| biocom | 1887533 | 커피_25 추석_전환 | 웹사이트 전환 | 0원 | 0원 | 0 | 0% | PAUSED |
| biocom | 1887533 | 카탈로그 판매_바이오컴+썬화이버_미리바이오_250930 | 카탈로그 판매 | 0원 | 0원 | 0 | 0% | ENABLED |
| biocom | 1887533 | ADVoost 쇼핑_커피_록하트_251014 | ADVoost 쇼핑 | 0원 | 0원 | 0 | 0% | PAUSED |
| biocom | 1887533 | 동영상 조회#2510211651 | 동영상 조회 | 0원 | 0원 | 0 | 0% | PAUSED |
| biocom | 1887533 | 인지도 및 트래픽#2604081407 | 인지도 및 트래픽 | 0원 | 0원 | 0 | 0% | ENABLED |
| biocom | 1804337 | 밴드피드_이미지_4060 | 웹사이트 전환 | 0원 | 0원 | 0 | 0% | PAUSED |
| biocom | 1804337 | 더클린커피_0715 | 인지도 및 트래픽 | 0원 | 0원 | 0 | 0% | PAUSED |
| biocom | 1804337 | 커피_25 추석_전환 | 웹사이트 전환 | 0원 | 0원 | 0 | 0% | PAUSED |

## 검증 결과

- JSON parse: PASS
- XLSX 파일 수: 3개
- XLSX 행 수: 12건
- JSON rows: 12건
- 행 수 일치: PASS
- forbidden_actions_triggered: 0건
- blocked_access: 0건
- JSON metric completeness: partial
- XLSX metric completeness: complete

## 해석 규칙

- 예산 판단에 쓸 값: 내부 결제완료 주문 기준 매출 ÷ 광고비.
- 참고만 볼 값: 네이버 플랫폼이 주장하는 전환금액과 ROAS.
- 이번 문서는 성과 디스플레이 광고비 source를 채우는 문서다. 내부 결제완료 주문 연결은 다음 단계다.

## 남은 병목

1. 더클린커피 쇼핑검색/ADVoost는 자사몰이 아니라 스마트스토어로 연결된다. 같은 2026년 4월 window에서 스마트스토어 주문/정산 source 또는 네이버 광고 전환 리포트 source를 분자로 정해야 한다.
2. Hermes export는 수동 source다. 반복 수집 runbook 또는 API 가능성 재확인이 필요하다.
3. 바이오컴 계정 1804337은 커피 이름 캠페인이 있지만 4월 0원이다. 바이오컴 1887533과 섞어 해석하지 않는다.
4. 자사몰 VM Cloud/Imweb 주문 원장으로 더클린커피 쇼핑검색/ADVoost ROAS를 만들면 `0원`으로 과소평가된다. 반대로 네이버 주장 전환금액만 쓰면 내부 confirmed ROAS가 아니라 플랫폼 주장 ROAS다.

## 산출물

- JSON: `data/project/naver-display-april-hermes-result-20260526.json`
- 원본 JSON: `hermes/results/naver-display-april-20260401-20260430.result.json`
- 원본 XLSX: `hermes/downloads/naver-display-april-20260401-20260430-*.xlsx`
