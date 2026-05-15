# Meta CAPI attribution quality and Ads ROAS reconciliation

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  required_context_docs:
    - gptconfirm/gpt0515-20-browser-purchase-capi-status/00-result-report.md
  lane: Green
  allowed_actions:
    - VM Cloud read-only query
    - Meta Ads read-only API query
    - local document creation
    - no-send diagnostics
  forbidden_actions:
    - Meta 운영 Purchase 추가 send
    - 대량 backfill
    - 새 광고 계정 생성
    - 두 번째 Pixel 운영 삽입
    - GTM publish
    - VM deploy/restart
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: "VM Cloud attribution_ledger + Meta CAPI send log + Meta Ads Insights read-only"
    window: "최근 24시간, 오늘, 최근 7일"
    freshness: "2026-05-15 17:04 KST 기준 fresh"
    confidence: "medium_high"
```

## 한 줄 결론

- 결론: **Meta 서버 전환 API(CAPI)는 실제로 살아 있고 Meta가 `events_received=1`로 받고 있다.** 다만 `/total` 화면의 CAPI 숫자는 바이오컴 Pixel과 더클린커피 Pixel을 섞어 세는 버그가 있어 과대 표시된다.
- Project: SEO / Meta CAPI attribution quality
- Lane: Green read-only
- Mode: Incident analytics
- Auditor verdict: `A. CAPI_SIGNAL_HEALTHY_ADS_UI_DELAY` + `D. CAPI_MISSING_CONFIRMED_ROWS`, `E`는 보조 이슈
- 현재 판정: 새 광고 계정이나 두 번째 Pixel은 필요 없다. 먼저 대시보드 site/pixel 필터와 confirmed-but-CAPI-missing 큐를 고친다.
- 자신감: 86%
- 기준 시각: 2026-05-15 17:04 KST

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| CAPI 수신 품질 감사 | 완료 | `01-capi-attribution-quality.md` | VM Cloud CAPI send log |
| Ads Manager ROAS 대조 | 부분 완료 | `02-ads-manager-roas-reconciliation.md` | Meta Ads Insights read-only |
| /total mismatch 원인 분해 | 완료 | `03-dashboard-mismatch-analysis.md` | VM Cloud funnel-health API + send log |
| 다음 액션 정리 | 완료 | `04-next-actions.md` | gptconfirm package |

## 이번에 가능해진 것

이제 “Meta가 Purchase를 못 받는지”와 “우리 화면이 잘못 보여주는지”를 분리해서 볼 수 있다.

- 바이오컴 Pixel `1283400029487161`: 최근 24시간 CAPI Purchase 52건 전송, 52건 모두 `events_received=1`.
- 최근 7일 바이오컴 Pixel CAPI Purchase 353건 전송, 353건 모두 성공, duplicate event_id 0.
- Meta Ads Insights 최근 7일은 구매 219건 / 구매값 58,123,707원 / 광고비 28,956,747원을 반환한다. 즉 Ads 귀속 연결이 완전히 끊긴 상태는 아니다.
- 오늘 Ads Insights 구매가 0건인 것은 same-day 반영 지연 가능성이 크지만, 12-24시간 뒤에도 0이면 Ads attribution 연결 문제로 승격해야 한다.

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| Meta 운영 Purchase 추가 전송 | 이번 범위는 read-only 품질 감사 | YES |
| 대량 backfill | missing queue는 먼저 중복/금액/Pixel 확인 필요 | YES |
| 새 광고 계정/두 번째 Pixel | 현재 증거상 신호 분산 위험이 더 큼 | YES |
| VM Cloud deploy/restart | 이번 범위 밖 | YES |
| 운영DB write/import | 금지 범위 | YES |
| GTM publish | 금지 범위 | YES |

## 검증 결과

| 검증 | 결과 | 방법 | 비고 |
|---|---|---|---|
| VM Cloud CAPI log read-only | PASS | SSH read-only + JSONL aggregate | raw order/payment/click/member 출력 0 |
| Funnel-health live API | PASS | `GET /api/attribution/funnel-health` | site=biocom |
| Meta Ads Insights read-only | PARTIAL | account summary 조회 성공 | campaign/adset detail은 rate limit |
| No-send / No-write | PASS | 명령·API 범위 확인 | 외부 전송 0, 운영DB write 0 |

## 핵심 숫자

### 바이오컴 Pixel 기준 CAPI 품질

| window | CAPI Purchase | success | failed | duplicate event_id | fbp | fbc | fbclid | value/currency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 최근 24시간 | 52 | 52 | 0 | 0 | 100.0% | 36.5% | 30.8% | 100.0% |
| 최근 7일 | 353 | 353 | 0 | 0 | 98.6% | 41.9% | 33.1% | 100.0% |

### Ads Manager read-only 요약

| window | spend | purchases | purchase value | ROAS |
|---|---:|---:|---:|---:|
| 오늘 | 2,258,963원 | 0 | 0원 | 0 |
| 최근 7일 | 28,956,747원 | 219 | 58,123,707원 | 약 2.01 |

주의: Ads Manager 구매는 Meta가 광고에 귀속한 구매다. CAPI 전송 건수 전체와 1:1로 같아야 하는 값이 아니다.

## 현재 영향/서버·커밋 상태

- VM Cloud backend는 건드리지 않았다.
- Meta send/upload 0.
- 운영DB write/import 0.
- GTM publish 0.
- 커밋/푸시 없음. 문서만 로컬에 생성했다.
- 현재 CAPI 자체는 동작 중이다. 다만 `/total` 표시에는 site/pixel 필터 버그가 있어 운영 판단 전에 patch가 필요하다.

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 오늘 Ads Manager 구매 0 | 당일 ROAS가 낮아 보임 | 12-24시간 뒤 재조회. 계속 0이면 Ads attribution issue로 승격 |
| `/total` CAPI 성공 수에 더클린커피 Pixel 섞임 | 바이오컴 CAPI 성공 과대 표시 | funnel-health CAPI log site/pixel filter patch |
| confirmed-but-CAPI-missing 12건 | 일부 실제 구매가 Meta 학습에서 누락될 수 있음 | safe_ref 기준 queue 재검증 후 backfill 승인안 |
| external_id CAPI 사용 0 | event match quality 개선 여지 | hashed external_id 설계는 별도 승인/개인정보 검토 후 진행 |
| campaign/adset optimization 확인 rate limit | 캠페인별 Purchase 최적화 여부 미확인 | Meta rate limit 해소 후 재조회 또는 TJ UI 확인 |

## 확인하면 좋은 문서

1. `01-capi-attribution-quality.md` — CAPI가 Meta 학습 신호로 쓸 만한지 숫자로 판단하려면 확인.
2. `02-ads-manager-roas-reconciliation.md` — Ads Manager ROAS가 왜 CAPI 성공 건수와 다르게 보이는지 확인.
3. `03-dashboard-mismatch-analysis.md` — `/total` 화면 숫자가 왜 이상하게 보였는지와 고칠 지점을 확인.

## 다음 할일

### Codex가 할 일

1. `/total` CAPI site/pixel filter patch 설계 및 구현
- Codex 추천: 진행 추천
- 추천 이유: 현재 바이오컴 화면에 더클린커피 Pixel CAPI가 섞여 들어가 판단을 흐린다.
- 추천 방향에 대한 자신감: 92%
- Lane: Green 로컬 patch, Yellow VM deploy
- 의존성: 없음. 로컬 구현은 바로 가능하고, VM Cloud 배포만 승인 필요.
- 무엇을 하는가: `site=biocom`이면 CAPI log에서 Pixel `1283400029487161`만 세고, `site=thecleancoffee`면 Pixel `1186437633687388`만 세도록 funnel-health contract를 고친다.
- 왜 하는가: CAPI success > confirmed 같은 착시를 제거하고, ROAS 판단 화면을 믿을 수 있게 만들기 위해서다.
- 어떻게 하는가: `backend/src/funnelHealth.ts` 또는 route input 단계에서 site→pixel map을 적용하고, `/total` smoke로 24h/7d 숫자를 재확인한다.
- 어디에서 확인하나: `http://localhost:7010/total`, `https://att.ainativeos.net/api/attribution/funnel-health?...`
- 성공 기준: 바이오컴 7일 CAPI success가 651이 아니라 target Pixel 기준 353 근처로 표시된다.
- 실패 시 해석/대응: Pixel map 누락 또는 CAPI log ledger source join 누락. raw log와 API 응답을 다시 대조한다.
- 승인 필요: 로컬 구현 NO, VM Cloud 배포 YES.

2. confirmed-but-CAPI-missing 큐 12건 재검증
- Codex 추천: 진행 추천
- 추천 이유: CAPI가 살아 있어도 이 큐가 실제면 일부 구매가 Meta 학습에서 빠진다.
- 추천 방향에 대한 자신감: 88%
- Lane: Green read-only, Red backfill if needed
- 의존성: site/pixel filter patch와 병렬 가능.
- 무엇을 하는가: safe_ref 단위로 중복, payment_key 존재, Toss/Imweb confirmed, 취소/환불, value guard를 재검증한다.
- 왜 하는가: 바로 backfill해도 되는 구매와 보내면 안 되는 구매를 분리하기 위해서다.
- 어떻게 하는가: VM Cloud SQLite + Meta CAPI send log read-only로 candidate를 다시 계산한다.
- 어디에서 확인하나: VM Cloud `attribution_ledger`, `meta-capi-sends.jsonl`.
- 성공 기준: missing 12건이 `backfill_ready`, `no_send_guard`, `duplicate_or_legacy`로 분류된다.
- 실패 시 해석/대응: payment_key 없는 legacy row면 Imweb/Toss direct fallback 없이는 Red send 금지.
- 승인 필요: 분류 NO, 실제 backfill YES.

### TJ님이 할 일

1. Meta Ads UI에서 오늘 Purchase가 늦게 반영되는지 확인
- Codex 추천: 진행 추천
- 추천 이유: API상 오늘 Ads purchase가 0이라, UI 필터/반영 지연인지 확인하면 판단이 빨라진다.
- 추천 방향에 대한 자신감: 78%
- Lane: Green 확인
- 의존성: 12-24시간 후 재확인이 가장 의미 있다.
- 무엇을 하는가: Meta Ads Manager에서 오늘과 어제, 최근 7일 구매 지표를 같은 attribution setting으로 비교한다.
- 왜 하는가: CAPI는 Meta에 들어갔지만 광고 귀속 화면은 늦게 붙을 수 있다.
- 어떻게 하는가: Ads Manager > 캠페인 테이블 > 열에 `구매`, `구매 전환값`, `ROAS` 추가 > 기간 오늘/어제/최근 7일 전환.
- 어디에서 확인하나: Meta Ads Manager 계정 `act_3138805896402376`.
- 성공 기준: 최근 7일처럼 오늘/어제 구매가 지연 후 반영된다.
- 실패 시 해석/대응: 24시간 뒤에도 오늘 Purchase 0이면 Ads attribution not connecting으로 승격한다.
- Codex가 대신 못 하는 이유: campaign/adset 상세 API가 rate limit 상태라 UI 확인이 더 빠르다.
- 승인 필요: NO.
