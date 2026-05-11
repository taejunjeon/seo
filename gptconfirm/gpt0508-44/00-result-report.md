# gpt0508-44 Claude Code Imweb Live Attribution Stabilization Sprint — 결과 보고

작성 시각: 2026-05-11 18:50:00 KST
Lane: Green snapshot + Yellow GTM verdict packet
자신감: 85%

## 1. 이번에 알게 된 것

운영 서버의 고객 유입 장부 (site_landing_ledger) 가 deploy 후 30분 시점에 **12 건 유입을 4 채널 (paid_search 7 / organic_search 2 / referral 2 / 자기도메인 1) 로 분류** 한다는 것이 확인됐다. 광고 클릭 ID 저장은 hash 모드 100% (raw 0). 광고 캠페인 이름이 `googleads_shopping_supplements_dangdang` / `youngdays` 두 개로 들어왔고, imweb 자동 transaction ID 가 utm_campaign 슬롯에 잘못 들어온 행 3 건이 internal_test 의심으로 자동 분류됐다.

## 2. 왜 중요한지

직전 sprint 까지는 "2 건 도착했다" 정도였는데, 본 sprint 에서 시간 윈도우별 (6h / 24h / 72h) **표준 지표 18 개** + **internal/test 자동 필터** + **GTM 필요 여부 숫자 결정 규칙** 까지 한꺼번에 묶었다. 이제 사용자나 Claude Code 가 언제든 같은 양식으로 분포를 측정하고 verdict 정정 가능.

## 3. 실제 숫자 (deploy + 30분, 24h 윈도우)

| 지표 | 값 |
|---|---|
| total 행 수 | 12 |
| 채널 | paid_search 7 / organic_search 2 / referral 2 / self_internal 1 |
| 광고 캠페인 (top) | googleads_shopping_supplements_dangdang 4 / youngdays 3 |
| internal/test 의심 행 | 4 (utm `1` 1 + imweb 자동 ID 3) |
| 실 고객 추정 행 | 8 |
| source_evidence_present_rate | **1.0 (100%)** |
| 광고 click_id 저장 hash : raw | 7 : 0 |
| GTM 잠정 verdict | **GTM_PARKED_PROVISIONAL** (자신감 0.6, 표본 12 < 50) |

## 4. 아직 판단 보류인 것

- 표본 12 < 50 임계 → "비율 해석은 50 건 도달 후" 사용자 안내 배너 frontend 적용.
- 24h / 72h 시점 재측정 후 GTM verdict 확정.
- 만약 24h 에서도 source_evidence_present_rate ≥ 60% + organic > 0 유지하면 `GTM_PARKED` 확정 → packet archive.
- 만약 paid_search 만 계속 증가하고 organic = 0 이면 backend fan-out 이 paid 흐름만 잡고 있을 가능성 audit.

## 5. 다음 행동 (owner 분리 + 점수표)

| Owner | Action | Claude Code 가능? | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 24h 시점 (2026-05-12 18 KST) snapshot 재실행 + verdict 정정 | YES | 85 | 90 | 90 | 5 | 86 | 진행 (시간 조건) |
| Claude Code | 72h 시점 (2026-05-14 18 KST) final snapshot + verdict 확정 | YES | 85 | 60 | 95 | 5 | 80 | 진행 (시간 조건) |
| Claude Code | 표본 50+ 도달 시 paid_search 채널 보고 (A05) | YES | 80 | 70 | 80 | 5 | 75 | 진행 (조건) |
| Claude Code | internal/test regex 보강 (live 누적 시 새 패턴) | YES | 70 | 60 | 50 | 10 | 60 | 진행 (수시) |
| Claude Code | snapshot cron/timer 등록 approval packet | YES (packet 까지) | 70 | 70 | 60 | 15 | 65 | 보류 (24h verdict 후 결정) |
| TJ님 | GTM Container Preview 활성화 — **verdict 가 CONDITIONAL/STRONGLY 로 정정될 때만** | NO — Container admin 권한 | 70 | 50 | 90 | 30 | 65 | 대기 (조건부) |
| TJ님 | Google Ads click_view CSV export 또는 API credentials | NO — Google 계정 권한 | 50 | 30 | 70 | 30 | 50 | 보류 |
| TJ님 | site-landing 페이지 UI 한 번 확인 | NO (UI 자체가 목적) | 50 | 80 | 30 | 5 | 50 | optional |

## 6. 표본 작음 안내

본 sprint 시점 12 row 는 작은 표본. 비율 (예: "광고 60% 점유") 해석은 **50 건 도달 후** 의미 있게 봐야 함. frontend 페이지에도 같은 안내 배너 자동 표시.

## 7. Track 진척률

| Track | 이전 | 현재 | Δ |
|---|---:|---:|---:|
| A Order Truth / Payment Bridge | 99 | 99 | 0 |
| B Imweb Source Capture | 88 | 90 | +2 |
| C Imweb Attribution Builder | 94 | 95 | +1 |
| D Dashboard Decision View | 90 | 92 | +2 |
| E Platform Exact Attribution | 45 | 45 | 0 |
| F QA / Guard / Data Guide | 96 | 97 | +1 |
| G Site Landing Ledger | 95 | 96 | +1 (live 측정 도구 + filter + verdict 규칙) |

## 8. gptconfirm 문서 수 + Telegram + 멀티 에이전트

- gptconfirm 문서 수: **5 (+ manifest)**. 한도 안. 합칠 수 있는 문서 (snapshot/filter/sanity/frontend → 01 통합) 그대로 합쳤음.
- Telegram: TJ standing skip 정책 유지, 본 sprint 도 발송 0. 별도 문서 X — 본 §8 한 줄 통합.
- 멀티 에이전트: **활용하지 않았다**. 본 sprint 의 7 작업이 같은 snapshot 결과를 기반으로 sequential 작성 (filter / sanity / GTM verdict / owner 재정렬 모두 1차 snapshot 의 12 row 데이터를 입력으로 받음). 병렬 분리 시 같은 데이터 재fetch 발생.

## 9. 검증 / 금지선 / commit 등 세부 사항

상세는 `01-live-snapshot-and-analysis.md` §6 (금지선 invariant 표) + §7 (검증) 참고.

## 10. commit / push

(commit 직후 본 §10 에 hash 명시)

## 11. Verdict

`SPRINT_LIVE_STABILIZATION_SNAPSHOT_OK_GTM_PARKED_PROVISIONAL_24H_RERUN_PLANNED`
