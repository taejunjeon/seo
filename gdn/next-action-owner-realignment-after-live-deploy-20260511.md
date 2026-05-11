# next action owner 재정렬 (gpt0508-44 작업6)

작성 시각: 2026-05-11 18:40:00 KST
**Claude Code 액션 5 / TJ 액션 3 (모두 외부 권한 필수 또는 optional)**

## 1. 이번에 가능해진 것

deploy 후 첫 live 데이터를 받은 시점에 다음 할 일이 다시 정렬됐다. **Claude Code 가 직접 할 수 있는 모든 분석/snapshot/sanity check 는 Claude Code 액션으로** 두고, TJ 액션은 **외부 권한 (GTM Container / Google Ads API) 이 반드시 필요한 항목 + UI 확인 optional** 만 남았다.

## 2. 재정렬 결과

| ID | Owner | Action | Claude Code 가능? | 종합 추천 | 추천 |
|---|---|---|---|---:|---|
| A01 | Claude Code | 24h 시점 snapshot 재실행 + verdict 정정 | YES | 86 | 진행 (시간 조건) |
| A02 | Claude Code | 72h final snapshot + verdict 확정 | YES | 80 | 진행 (시간 조건) |
| A03 | Claude Code | cron/timer 등록 approval packet | YES (packet 까지) | 65 | 보류 (24h verdict 후) |
| A04 | Claude Code | internal/test regex 보강 | YES | 60 | 진행 (수시) |
| A05 | Claude Code | paid_search 채널 보고 (표본 50+ 도달 시) | YES | 75 | 진행 (조건) |
| A06 | TJ님 | GTM Container Preview 활성화 | NO — Container admin | 65 | 대기 (verdict 정정 시) |
| A07 | TJ님 | Google Ads click_view CSV export 또는 API credentials | NO — Google 계정 권한 | 50 | 보류 |
| A08 | TJ님 | site-landing 페이지 UI 한 번 확인 | NO (UI 자체가 목적) | 50 | optional |

## 3. 점수 정의

- 데이터 충분도 / 타이밍 / 목표 영향도 / 위험도 (낮을수록 좋음) / 종합 추천 각 0~100.
- 종합 추천 = 가중 평균 (영향도 40% + 데이터 30% + 타이밍 20% + (100-위험도) 10%).

## 4. TJ 액션 분류 (모두 검토 후 남은 항목)

| TJ 액션 | Claude Code 가 먼저 할 수 있는 일 | TJ 만 가능한 일 | 못 하는 이유 | 대체 경로 |
|---|---|---|---|---|
| A06 GTM Preview 활성화 | JSON export 검토 + Custom HTML draft | GTM Web UI 진입 + Preview 활성화 | Container admin 권한, Web UI 자동 조작 불가 | TJ 가 export 주면 Claude Code 가 draft |
| A07 Ads click_view export | hash 변환 + prep table schema | OAuth2 credentials 발급, Ads UI 수동 export | Google 계정 권한 | TJ 가 CSV 주면 Claude Code 가 처리 |
| A08 UI 확인 | (Claude Code 도 curl 가능) | 본인 브라우저로 직접 시각 확인 | UI 확인 그 자체가 사람 눈으로 보는 행위 | optional, 분포 baseline 영향 X |

## 5. 변동

- 직전 sprint (gpt0508-43) 까지 TJ 액션 5 종이었던 것이 **3 종** 으로 축소.
- 모든 TJ 액션이 **외부 권한 필수 또는 UI optional** — Claude Code 가 못 하는 사유 명확.

## 6. 다음 액션 (요약)

| Owner | Action | 추천 |
|---|---|---|
| Claude Code | 24h 시점 snapshot + verdict 정정 (A01) | 진행 |
| Claude Code | 표본 50+ 도달 시 paid_search 채널 보고 (A05) | 진행 (조건) |
| TJ님 | GTM verdict 가 정정될 때만 Container 진입 (A06) | 조건부 대기 |
| TJ님 | 본인 편의에 UI 한 번 (A08) | optional |

산출 JSON: `data/next-action-owner-realignment-after-live-deploy-20260511.json`
