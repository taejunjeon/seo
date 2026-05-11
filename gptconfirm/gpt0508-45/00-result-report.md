# gpt0508-45 Claude Code Correction Sprint — 결과 보고

작성 시각: 2026-05-11 18:30:00 KST
Lane: Green correction + live backfill (read-only 운영DB + 로컬 SQLite write only)
자신감: 92%

## 1. 이번에 가능해진 것

직전 sprint (gpt0508-44) 의 internal/test 자동 분류가 false positive 4 건을 잡고 있었다는 것을 실 운영 데이터를 보고 발견 + 정정. 동시에 **더클린커피 트래픽이 같은 backend 입구로 들어와서 모두 biocom 으로 잘못 태깅되던 것** 도 발견해 사이트 자동 분기까지 함께 박았다. 그 결과 양 사이트 분포가 분리되어 보이기 시작했고, biocom 의 GTM Preview 필요 여부 verdict 가 잠정 (`PROVISIONAL`) 에서 **확정 (`GTM_PARKED`)** 으로 굳어졌다.

## 2. 왜 중요한지

- 잘못된 internal/test 분류 4 건은 카카오 알림톡 + 네이버 파워링크 **실 광고 유입**. 그대로 두면 24h verdict 도 같은 false positive 위에서 산출됨.
- 더클린커피 트래픽이 biocom 으로 잘못 태깅돼 있어 사이트별 분포가 처음부터 섞임. 두 회사 데이터를 분리해야 의미 있는 매출 join 시도 가능.
- biocom 의 `GTM_PARKED` 확정으로 TJ 의 GTM Container 액션이 **현재 trigger 없음** → archive 가능. TJ 일을 줄였음.

## 3. 실제 숫자 (정정 + backfill 후)

### biocom (24h)
| 지표 | 값 |
|---|---|
| total | **86** (50 임계 초과) |
| 채널 | paid_search 68 / self_internal 14 / organic_search 2 / paid_social 1 / direct 1 |
| source_evidence_present_rate | **1.0** |
| internal_or_test_traffic_count | **0** (정정 전 4 → 0) |
| GTM verdict | **GTM_PARKED 확정** (PROVISIONAL 떨어짐) |

### thecleancoffee (24h)
| 지표 | 값 |
|---|---|
| total | **17** (50 미만) |
| 채널 | paid_social 12 (카카오 알림톡) / organic_search 3 / self_internal 1 / referral 1 |
| source_evidence_present_rate | 1.0 |
| internal_or_test_traffic_count | 0 |
| GTM verdict | INSUFFICIENT_SAMPLE_HOLD (17 < 50) |

## 4. 아직 안 된 것

- 더클린커피의 50+ 표본 도달은 시간 더 필요 (현재 17 row).
- utm_campaign_top10 의 일부 row 에서 `source = medium = campaign` 같은 값으로 들어옴 — fan-out 파싱 audit 필요 (24h 안 #3 액션).
- site_landing ↔ 운영DB 매출 join 시도 (L2 attribution ladder 핵심) — 24h 안 #1 액션.

## 5. 다음 행동 (owner 분리 + 점수표)

24h 동안 Claude Code 가 그냥 기다리지 않고 자동 진행 추천 3 개 + 24h 시점 자동 재측정 1 개:

| Owner | Action | Claude Code 가능? | 데이터 충분 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | #1 site_landing ↔ 운영DB 매출 join 시도 (L2 ladder) | YES — read-only 운영DB query | 85 | 90 | 95 | 15 | **88** | **진행** |
| Claude Code | #2 frontend 페이지에 site 토글 추가 (≤80 LOC) | YES — 직접 deploy 가능 | 90 | 90 | 75 | 10 | **84** | **진행** |
| Claude Code | #3 utm_source/medium/campaign 동일 값 row audit (fan-out 파싱 버그 의심) | YES — read-only | 80 | 85 | 80 | 10 | **80** | **진행** |
| Claude Code | 2026-05-12 18 KST 시점 snapshot 양 site 재실행 + verdict 정정 | YES | 85 | 90 | 90 | 5 | **86** | **진행 (시간 조건)** |
| TJ님 | GTM Container Preview 활성화 | (불필요) — biocom 이 GTM_PARKED 확정 | — | — | — | — | — | **archive (액션 없음)** |
| TJ님 | Google Ads click_view CSV 또는 API credentials | NO — Google 계정 권한 | 50 | 30 | 70 | 30 | 50 | 보류 (1차 목표 안정 후) |
| TJ님 | site UI 한 번 확인 | NO (UI 자체 목적) | 50 | 80 | 30 | 5 | 50 | optional |

## 6. Track 진척률

| Track | 이전 | 현재 | Δ |
|---|---:|---:|---:|
| A Order Truth / Payment Bridge | 99 | 99 | 0 |
| B Imweb Source Capture | 90 | 92 | +2 (multi-site 정정) |
| C Imweb Attribution Builder | 95 | 96 | +1 |
| D Dashboard Decision View | 92 | 92 | 0 (frontend site 토글은 24h 안 후속) |
| E Platform Exact Attribution | 45 | 45 | 0 |
| F QA / Guard / Data Guide | 97 | 98 | +1 (false positive 정정 + fixture 보강) |
| G Site Landing Ledger | 96 | 98 | +2 (multi-site + backfill + GTM_PARKED 확정) |

## 7. 표본 안내

biocom 표본 86 > 50 → 비율 해석 의미 있게 가능. thecleancoffee 17 < 50 → 비율 해석 보류.

## 8. 검증 / 금지선 / commit 등 세부 사항

상세는 `01-correction-and-validation.md` §3 검증 + §6 금지선 invariant 표 참고. 24h 안 자동 진행 plan 은 `02-next-24h-plan-and-owner-scoring.md` 참고.

## 9. gptconfirm + Telegram + 멀티 에이전트

- **gptconfirm 문서 수: 4 + manifest** (00 + 01 + 02 + 99 total + manifest). 한도 안 (5 권장 / 8 max). 합칠 수 있는 산출 (정정 + 검증 → 01, 24h plan + owner score → 02) 통합.
- Telegram: TJ standing skip. 본 sprint 도 발송 0. 별도 문서 X.
- 멀티 에이전트: **활용 안 함**. 본 정정의 6 작업이 모두 같은 운영 SQLite 데이터를 기반으로 sequential 작성 (regex → site 분리 → backfill → snapshot → audit → plan). 병렬 분리 시 같은 DB 상태에서 race condition 발생.

## 10. commit / push

(commit 직후 본 §10 에 hash 명시)

## 11. Verdict

`SPRINT_CORRECTION_DONE_FALSE_POSITIVE_4_TO_0_SITE_MULTIPLEX_LIVE_BIOCOM_GTM_PARKED_CONFIRMED`
