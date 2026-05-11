# 03 양식 갱신 + 다음 액션 (gpt0508-43)

작성 시각: 2026-05-11 17:55:00 KST
범위: 작업 0 (보고서 v1.3) + 모든 작업의 다음 액션 통합

## 1. 보고서 양식 v1.3 (작업 0)

이번 sprint 부터 채팅/텍스트 완료 보고 규칙이 바뀌었다.

### 채팅 답변

- "사람이 이해하는 작업 설명" 5 필드 (이번에 가능해진 것 / 왜 필요했는지 / 어떻게 작동하는지 비개발자용 / 실제 결과 / 아직 안 된 것) 첫 섹션 필수.
- **"금지선 준수" 긴 표 / 섹션 채팅 답변 금지**. 그건 gptconfirm 문서 안에만 (본 패키지의 `01-implementation-and-validation.md` §4 참고).
- 기술어 단독 사용 금지. 첫 등장 시 "사람 말 (기술어)" 형식 1회.
- 5줄 결론 / 한 줄 결론 자연어 only 섹션 사용 금지 (v1.2 부터 폐지 유지).

### gptconfirm 문서

- 기본 5 + manifest. 최대 8.
- telegram skip note 별도 문서 X — 00 또는 03 안 한 문단 통합 (본 sprint 부터 적용).

상세: `gdn/report-template-v1-3-readable-owner-scoring-20260511.md`

## 2. 작업별 다음 액션 (owner 분리 + 추천 점수표)

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | deploy 후 72시간 live row 도착 시 source gap verdict 재산출 | YES — curl 1회 + JSON 분석 | — | 80 | 50 | 80 | 10 | 72 | 진행 (시간 조건) |
| Claude Code | site_landing_ledger row 가 일정량 (≥ 50) 도달 시 channel 분포 dashboard 카드 자동 업데이트 점검 | YES | — | 70 | 40 | 70 | 15 | 65 | 보류 (50 row 임계 도달 시) |
| TJ님 | biocom.ainativeos.net/ads/site-landing 본인 브라우저 방문 + 1~2 페이지 클릭 | NO — 사용자 본인 트래픽 | 자연 트래픽 가속화로 live verdict 빠르게 수집 가능 | 60 | 80 | 50 | 5 | 60 | 진행 (편의 시) |
| TJ님 | GTM Container 진입 + Custom HTML 임시 Preview 활성화 (gpt0508-42 작업5 packet) | NO — Web UI 자동 조작 불가, Container admin 권한 필요 | Claude Code 가 GTM Web UI 자동 조작 불가 | 70 | 60 | 90 | 30 | 65 | 조건부 진행 (72h live verdict 가 60% 미만 명확해진 후) |
| Claude Code | TJ 가 GTM Container JSON export 주면 Custom HTML 충돌 검토 + draft | YES (export 받으면) | — | 70 | 50 | 70 | 10 | 65 | 보류 (TJ export 대기) |
| TJ님 | Google Ads click_view CSV export 또는 Ads API credentials 발급 | NO — Google 계정 권한 | Web UI 자동 / OAuth2 발급 불가 | 50 | 30 | 70 | 30 | 50 | 보류 (1차 목표 live verdict 본 후) |
| TJ님 | peak canary (gpt0508-40 작업6) — 광고 클릭 1~2회 + 결제 시도 (취소 OK) | NO — 사용자 본인 트래픽 협조 | 사용자 행동 필요 | 60 | 50 | 80 | 20 | 60 | 보류 (deploy 와 별도 사안) |

## 3. Telegram skip (별도 문서 X)

TJ standing skip 정책 그대로. 본 sprint 도 텔레그램 발송 0. 본 문단 안에서만 기록.

## 4. 멀티 에이전트 활용 여부 (요청 충족)

- **활용하지 않았다**.
- 이유:
  - 본 sprint 의 작업 0~6 이 모두 같은 산출 (gptconfirm 패키지 5 문서 + REPORTING_TEMPLATE 갱신) 에 의존해 sequential 처리가 더 효율적.
  - 작업 4 (deploy) 의 중간 결과 (file size / tsc / pm2 status) 가 작업 5 (source gap) + 작업 6 (패키지) 의 입력이라 병렬 분리 시 합치는 비용이 더 큼.
  - Explore / general-purpose 서브 에이전트가 같은 backend 코드를 두 번 읽으면 컨텍스트 낭비.
- 멀티 에이전트가 의미 있었을 케이스 (이번 sprint 에는 해당 없음): Google Ads click_view API 동시 호출 / 외부 도메인 별도 audit / 여러 site 동시 측정.
