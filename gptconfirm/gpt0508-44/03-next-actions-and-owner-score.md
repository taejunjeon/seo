# 03 next actions + owner 재정렬 점수표 (gpt0508-44)

작성 시각: 2026-05-11 18:50:00 KST
**Claude Code 액션 5 / TJ 액션 3 (모두 외부 권한 필수 또는 optional)**

## 1. 재정렬 결과

| ID | Owner | Action | Claude Code 가능? | 데이터 충분 | 타이밍 | 영향도 | 위험도 (↓) | 종합 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| A01 | Claude Code | 24h snapshot 재실행 + verdict 정정 | YES | 85 | 90 | 90 | 5 | 86 | 진행 (시간 조건) |
| A02 | Claude Code | 72h final snapshot + verdict 확정 | YES | 85 | 60 | 95 | 5 | 80 | 진행 (시간 조건) |
| A03 | Claude Code | snapshot cron/timer 등록 approval packet | YES (packet 까지) | 70 | 70 | 60 | 15 | 65 | 보류 (24h verdict 후) |
| A04 | Claude Code | internal/test regex 보강 (live 누적 시) | YES | 70 | 60 | 50 | 10 | 60 | 진행 (수시) |
| A05 | Claude Code | paid_search 채널 보고 (표본 50+ 도달 시) | YES | 80 | 70 | 80 | 5 | 75 | 진행 (조건) |
| A06 | TJ님 | GTM Container Preview 활성화 (verdict 정정 시) | NO — Container admin 권한 | 70 | 50 | 90 | 30 | 65 | 대기 (조건부) |
| A07 | TJ님 | Google Ads click_view CSV export 또는 API credentials | NO — Google 계정 권한 | 50 | 30 | 70 | 30 | 50 | 보류 |
| A08 | TJ님 | site-landing 페이지 UI 한 번 확인 | NO (UI 자체가 목적) | 50 | 80 | 30 | 5 | 50 | optional |

## 2. 점수 정의

각 0~100. 위험도는 낮을수록 좋음.

종합 추천 = 영향도×0.4 + 데이터×0.3 + 타이밍×0.2 + (100−위험도)×0.1.

추천 칼럼: 진행 / 조건부 진행 / 보류 / 대기 / optional.

## 3. TJ 액션 — 모두 Claude Code 가 못 하는 사유

| TJ 액션 | Claude Code 가 먼저 할 일 | TJ 만 가능 | 사유 | 대체 경로 |
|---|---|---|---|---|
| A06 GTM Preview | Container JSON export 검토 + Custom HTML draft | Container Web UI 진입 + Preview 활성화 | admin 권한 + Web UI 자동 조작 불가 | TJ export → Claude Code draft |
| A07 Ads click_view | hash 변환 + prep table schema | OAuth2 credentials 발급 또는 수동 CSV export | Google 계정 권한 | TJ CSV → Claude Code 처리 |
| A08 UI 확인 | curl 200 검증 (이미 완료) | 본인 브라우저 시각 확인 | UI 시각 확인 자체가 사람 행위 | optional, 분포 baseline 영향 X |

## 4. 변동 (gpt0508-43 대비)

- 직전 sprint TJ 액션 5 종 → 본 sprint **3 종** 으로 축소.
- 모두 외부 권한 필수 또는 optional — Claude Code 가 못 하는 사유 명확.
- snapshot / sanity check / packet / regex 보강 / 채널 보고 모두 Claude Code 영역.
