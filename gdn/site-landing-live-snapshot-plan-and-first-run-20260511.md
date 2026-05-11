# site-landing live snapshot 1차 실행 (gpt0508-44 작업1)

작성 시각: 2026-05-11 18:15:00 KST
실행 시점: deploy 후 약 30~35분

## 1. 이번에 가능해진 것

운영 서버의 고객 유입 장부 (site_landing_ledger) 가 시간대별로 어떻게 채워지고 있는지를 6시간 / 24시간 / 72시간 윈도우로 자동 측정하는 script 가 준비됐다. script 가 만든 1차 결과를 보면 deploy 후 30분 시점 12 건 유입이 4 채널 (paid_search / organic_search / referral / 자기도메인 self_internal) 에 고르게 분포 — 한 채널에 쏠리지 않았다.

## 2. 왜 필요했는지

"2건 들어왔다" 만으로는 운영 분포를 판단할 수 없고, 72 시간 후 한 번에 확인하면 그 사이 이상치가 생겨도 발견이 늦다. 시간 윈도우별 표준 지표 + script 형식으로 미리 박아 두면 사용자 또는 Claude Code 가 언제든 같은 양식으로 분포 측정 가능.

## 3. 어떻게 작동하는지 (비개발자용)

`backend/scripts/site-landing-live-snapshot-20260511.ts` 가 운영 조회 기능 (`summary API`) 를 호출해 결과를 받아 18 개 지표 (총 row / 채널 분포 / 광고/자연/직접/추천 비율 / hash 저장률 / 내부 테스트 의심 행 수 / 표본 부족 경고 / GTM verdict 등) 로 정리한 JSON 을 출력한다. cron / systemd timer 등록은 본 sprint 에서 하지 않음 — 별도 approval packet.

## 4. 실제로 확인된 결과 (deploy + 30분 시점, 24h 윈도우)

| 지표 | 값 |
|---|---|
| total rows | **12** |
| unique session 수 | 12 |
| source_evidence_present_rate | **1.0** |
| paid_search | 7 |
| organic_search | 2 |
| referral | 2 |
| direct / self_internal | 1 |
| unknown | 0 |
| utm_campaign top | `googleads_shopping_supplements_dangdang` 4 / `googleads_shopping_supplements_youngdays` 3 |
| 내부/테스트 의심 row | **4** (utm `1` + imweb 자동 ID `b2026051144755feeb63db` 3 — 작업 2 분리 규칙 적용 후) |
| hash_only_rate (click 있는 row 중) | 7/7 = **1.0** |
| raw click count | **0** |
| sample_too_small_warning | **true** (12 < 50) |
| gtm_verdict_provisional | **INSUFFICIENT_SAMPLE_HOLD** |

## 5. 6시간 / 24시간 / 72시간 비교

deploy 후 30분 시점이라 세 윈도우 모두 같은 12 row. 24h / 72h 가 의미 있게 갈리는 시점은 deploy + 24 시간 이후. 그때부터 윈도우별 row 차이로 "최근 6시간 트래픽" vs "전일 평균" 비교 가능.

## 6. snapshot script 사용법

```bash
ATT_API_BASE=https://att.ainativeos.net \
npx tsx backend/scripts/site-landing-live-snapshot-20260511.ts --window-hours=24 \
  > data/site-landing-live-snapshot-20260511-h24.json
```

윈도우 6 / 24 / 72 모두 실행 후 `data/` 에 저장. cron 자동화는 다음 sprint approval.

## 7. 18 개 지표 schema

| 카테고리 | 필드 |
|---|---|
| 시각 | snapshot_at_kst, window_hours |
| 양 | total_rows, unique_session_count |
| 품질 | source_evidence_present_rate, sample_too_small_warning |
| 분포 | channel_distribution, paid_search/social, organic_search/social, direct, referral, unknown, utm_campaign_distribution, source_breakdown |
| 보안 | hash_only_rate, raw_click_count, internal_or_test_traffic_count |
| verdict | gtm_verdict_provisional |
| 금지선 | invariants_held (5 필드) |

## 8. 아직 안 된 것

- 자연 트래픽 표본 부족 (12 < 50) — 24~72 시간 뒤 재실행 필요.
- cron / systemd 등록 안 함 — approval packet 별도.
- 자체 alert (예: raw click count > 0 일 때) 미구현.

## 9. 다음 액션

| Owner | Action | Claude Code 가능? | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 추천 |
|---|---|---|---:|---:|---:|---:|---|
| Claude Code | 24h 시점 (2026-05-12 18 시 KST) 같은 script 재실행 + verdict 재산출 | YES | 80 | 90 | 80 | 5 | 진행 (시간 조건) |
| Claude Code | 72h 시점 (2026-05-14 18 시 KST) snapshot + 최종 verdict | YES | 80 | 60 | 90 | 5 | 진행 (시간 조건) |
| Claude Code | cron 등록 approval packet | YES | 70 | 70 | 60 | 15 | 보류 (다음 sprint) |

산출:
- `data/site-landing-live-snapshot-20260511-h6.json`
- `data/site-landing-live-snapshot-20260511-h24.json`
- `data/site-landing-live-snapshot-20260511-h72.json`
- `data/site-landing-live-snapshot-plan-and-first-run-20260511.json` (본 plan 메타)
