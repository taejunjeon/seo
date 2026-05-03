# Agent Function Development — 기능 개발 우선순위 (2026-05-03)

정본 link: harness/common/HARNESS_GUIDELINES.md · harness/common/AUTONOMY_POLICY.md · harness/common/REPORTING_TEMPLATE.md (본 문서는 project-local roadmap, 정본 fork 아님)

상위 인사이트: [[!aiosagent]] (AIOS = Harness × Agent × LOOP-closure)
참조: [[!menu]] (메뉴 카탈로그) · [[agentprd]] (PRD v0.1) · [[harness/!harness|Harness 5 핵심]] · [[harness/coffee-data/AUTONOMY_POLICY|Lane 분류]] · [[!coffeedata]] (sprint 19~22 evidence)

본 문서 성격: **기능 개발 우선순위 + 개발 detail**. 어떤 기능을 어떤 순서로, 어떤 module 단위로, 어떤 가드 안에서 개발할지 정본.

## 0. 결론 (10초)

**진행 완료 (2026-05-03 KST)**:
- ✅ Sprint 23 — cross-codex lessons consolidation (Green Lane, commit `de8f9c2`)
- ✅ Sprint 23.1 — bootstrap + preflight + audit 보강 (Green Lane, commit `cdda94c`)
- ✅ Sprint 23.2 — TikTok/AIBIO LESSONS 신규 + biocom cross-cutting (Green Lane, commit `da108c0`)
- ✅ Sprint 23.3 — pre-commit hook + fork detect 보강 (Yellow Lane Z-1, commit `4e19b0f`)

**다음 우선순위** (sprint 24 ~ 26 + 보류 항목):

| P | sprint | 기능 | Lane | 비용 | 가치 |
|---|---|---|---|---|---|
| **P1** | 24 | AEO/GEO score 자동 산출 | Yellow + Red (외부 API 호출) | 3-5일 | 운영 frontend 핵심 score 자동, 매주 컨텐츠 결정 가속 |
| **P2** | 26 | 신규 site 자동 launch (template) | Yellow | 5-7일 | 신규 사업 진입 1주 → 1일 |
| **P3 (R&D)** | 25 | self-diagnostic (메타-LOOP) | Yellow → Red 점진 | 1-2 sprint+ | agent 자체 진화 |
| **P-보류 (Yellow)** | Y1-B / Y1-C | session 자동 read / git hook 강화 | Red (TJ env config 변경) | 1일 | lesson 016 재발 위험 5% 까지 |
| **P-보류 (Red)** | Y3 | codex base prompt 변경 | Red (TJ codex CLI config) | TJ 영역 | cross-codex 일관성 |

본 문서 작성 자신감 **90%**.

## 1. P0 — Sprint 23: cross-codex lessons consolidation

### 1.1 무엇을 만드는가

| 항목 | 산출물 |
|---|---|
| `harness/cross-site-lessons/INDEX.md` | 전 site (Coffee/biocom/TikTok/AIBIO) 의 lesson 통합 index |
| 각 site 의 `LESSONS.md` 표준 schema | id / type (observation / candidate_rule / resolved) / observation / source / application / confidence / owner — 통일 |
| `harness/scripts/lessons-lint.py` | lint script — 누락 필드 검출, 형식 위반 detect, 중복 lesson 자동 link |
| migration commit | 기존 `harness/coffee-data/LESSONS.md` 15개 + biocom/TikTok 의 흩어진 lesson 후보 (datacheckplan / tiktokroasplan 의 "결론" 섹션) 표준 schema 로 마이그 |

### 1.2 왜

| 현상 | 영향 |
|---|---|
| Coffee 의 lesson 15개 (coffee-lesson-001~015) 가 biocom/TikTok codex 에 자동 전파 안 됨 | 같은 design 미스 반복 (예: backend 가드 사전 review 부재 — coffee-lesson-014 가 biocom 에서도 발생 가능) |
| LESSONS.md schema 가 site 별 다름 | cross-site grep 어려움, lint 불가 |
| lesson 누적 추적 부재 | 어느 sprint 에서 어떤 lesson 발견됐는지 commit history 만 |

### 1.3 어떻게

| step | 작업 | 파일 |
|---|---|---|
| 1 | `harness/cross-site-lessons/INDEX.md` 신규 — 4 site lesson 모음 | 신규 |
| 2 | LESSONS schema 정의 (markdown table 표준) | 신규 |
| 3 | `lessons-lint.py` — id 중복 / 누락 필드 / link 깨짐 검사 | 신규 (~150줄) |
| 4 | coffee-lesson-001~015 schema 검증 + INDEX 등록 | `harness/coffee-data/LESSONS.md` 갱신 |
| 5 | biocom/TikTok/AIBIO 의 lesson 후보 추출 (기존 plan 문서 의 "결론" / "lesson" / "유의" 섹션) | grep + manual curation |

### 1.4 가드 / Lane

- **Yellow Lane** (sprint 1회 승인 후 자율) — 문서 + lint script 만, runtime 영향 0
- 외부 send 0, backend 변경 0, GTM publish 0
- rollback: git revert 1 commit

**자신감 92%** — 미관측: biocom/TikTok lesson 후보의 정확한 위치 (sprint 진입 시 grep 으로 확인).

## 2. P1 — Sprint 24: AEO/GEO 자동 산출

### 2.1 무엇을 만드는가

| 모듈 | 역할 | 위치 |
|---|---|---|
| `aeoScoreCollector.ts` | AEO sub-항목 5개 자동 수집 (schema.org 마크업 / Q&A 형식 / 인용 친화 컨텐츠 / 답변 직접성 / 페이지 속도) | backend/src/ |
| `geoScoreCollector.ts` | GEO sub-항목 5개 자동 수집 (Naver Cue 인용 / Google AI Overview 인용 / Perplexity 인용 / ChatGPT search 인용 / 메타 description) | backend/src/ |
| `seo-score-cron.ts` | 매일 09:00 자동 갱신 + DB 저장 | backend/scripts/ |
| `seo_score_log` 테이블 | 점수 일별 누적 — 변동 추적 | SQLite schema 추가 |
| `/api/seo/score/{site}` | 최근 30일 점수 + sub-항목 detail | backend route 추가 |
| frontend `/seo` 갱신 | 현재 manual 발화 → 자동 갱신 + history graph | frontend (existing 페이지 갱신) |
| 점수 변동 alert | 5점 이상 하락 시 솔루션 패키지 자동 trigger | backend module |

### 2.2 왜

| 현상 | 영향 |
|---|---|
| 현재 AEO 48 / GEO 68 점수 가 어떻게 산출되는지 backend 추적 안 됨 (manual 발화) | 운영자 신뢰 부족 |
| LLM 시대의 새 채널 (AEO/GEO) 측정 부재 | 다음 채널 진입 결정 못 함 |
| 점수 변동 시 원인 분해 부재 | 어떤 컨텐츠가 빠졌는지 모름 |

### 2.3 어떻게

| step | 작업 | 의존성 |
|---|---|---|
| 1 | AEO/GEO sub-항목 5+5 정의 + 산출 algorithm | external SEO/AEO research, GA4 + GSC API |
| 2 | backend collector module 작성 | 1 |
| 3 | SQLite schema 추가 (`seo_score_log`) + ensure pattern | sprint 22 의 `coffeeNpaySendLog` schema 패턴 재사용 |
| 4 | route + cron | 2, 3 |
| 5 | frontend `/seo` 갱신 — 현재 score → API 응답 기반 | 4 |
| 6 | alert 자동 (변동 시 솔루션 패키지) | 5, sprint 23 의 lessons-to-rules pipeline |

### 2.4 가드 / Lane

- **Yellow Lane** (sprint 1회 승인) — 단 외부 API 호출 (Naver Cue / Google AI Overview 검사 등) 의 RL 검증 필요
- backend deploy 필요 (sprint 17 / 19.4 / 19.7 / 19.8 패턴)
- alert trigger 는 Red Lane (외부 발신은 Red, 단순 dashboard 갱신은 Yellow)

**자신감 75%** — 미관측: 외부 LLM 인용 추적 API 의 정확도 (Perplexity / ChatGPT search 의 인용 흔적 자동 수집 가능 여부 — 일부 manual fallback 가능성). 본 sprint 진입 시 실제 API 가능성 확인 → 자신감 갱신.

## 3. P2 — Sprint 26: 신규 site 자동 launch

### 3.1 무엇을 만드는가

| 모듈 | 역할 |
|---|---|
| `harness/site-template/` | 신규 site 의 template (AUTONOMY_POLICY / LESSONS / runbook / publish decision 문서 / monitoring template / cron run.sh skeleton) |
| `harness/site-template/init-new-site.sh <site_name>` | 신규 site 추가 시 1 명령으로 template fork + site 별 식별자 치환 + 신규 sprint 표 row 자동 생성 |
| `backend/src/<site>NpayIntentLog.ts` template | dispatcher / intent log / production_mode 가드 패턴 자동 생성 |
| 신규 site 진입 wizard | TJ 가 site 정보 (name / pixel id / GTM container / domain) 입력 시 init-new-site.sh 자동 호출 |

### 3.2 왜

| 현상 | 영향 |
|---|---|
| Coffee NPay sprint 19~22 = 1주+ 의 패턴 재발견 시간 | 신규 site 마다 같은 시간 |
| 패턴 fork 부재 | lesson coffee-lesson-008 의 "biocom 도 적용 가능" 명시 단 자동 fork 인프라 0 |
| 신규 사업 진입 시 sprint 패턴 처음부터 design | 1주 → 1일 단축 가능 |

### 3.3 어떻게

| step | 작업 | 의존성 |
|---|---|---|
| 1 | Coffee 의 sprint 19~22 패턴 추출 (variable vs constant 분리) | sprint 23 의 cross-codex consolidation 후 |
| 2 | `harness/site-template/` 디렉토리 + 표준 파일 set | 1 |
| 3 | `init-new-site.sh` script — template fork + site_name / pixel_id / gtm_container 변수 치환 | 2 |
| 4 | backend module template — `coffeeNpayIntentLog.ts` 의 일반화 (`<site>NpayIntentLog.ts`) | 3 |
| 5 | 신규 site 진입 시 sprint 첫 row 자동 생성 (다음 할일 표) | 4 |

### 3.4 가드 / Lane

- **Yellow Lane** (sprint 1회 승인 후 자율) — template 만 생성, 실제 신규 site 진입은 별도 Red Lane
- 운영 영향 0 (template 만)

**자신감 85%** — 미관측: 신규 site 의 funnel-capi v3 또는 다른 attribution 인프라 차이 (각 site 별 재검증 필요).

## 4. P3 (R&D) — Sprint 25: self-diagnostic (메타-LOOP)

### 4.1 무엇을 만드는가

| 모듈 | 역할 |
|---|---|
| `backend/src/agentLoopMetrics.ts` | sprint cycle time / lesson 누적률 / 자신감 % 정확도 / Yellow Lane 자율 비율 자동 계산 |
| `backend/scripts/agent-self-retrospective.ts` | 매주 자동 회고 보고서 yaml 생성 (전 sprint 의 가속 / 회귀 / lesson 새로 등장 / agent 의 자기 평가) |
| `agent_loop_metrics_log` 테이블 | sprint 별 metrics 누적 |
| 다음 sprint design trigger | 매 sprint design 단계에서 자동 trigger — "지난 5 sprint 의 평균 cycle time = N. 본 sprint 가 그보다 길면 alert" |

### 4.2 왜

| 현상 | 영향 |
|---|---|
| agent 의 자기 평가 부재 | sprint 가 늘어지는지 모름 |
| LOOP 의 닫힘 정도 측정 안 됨 | 개선 방향 모름 |
| 다음 sprint 의 design 단계에 lesson 적용 자동 trigger 없음 | sprint 14 (publish-targeting design 가드 review) 같은 미스 재발 |

### 4.3 어떻게

| step | 작업 | 의존성 |
|---|---|---|
| 1 | sprint 별 metrics 정의 (cycle time = first commit ~ last commit, lesson 새 row 수, 자신감 % 사후 평가 등) | sprint 23 schema 재사용 |
| 2 | git log 분석 + LESSONS.md diff 분석 + commit message 분석 module | 1 |
| 3 | 회고 yaml 자동 생성 (`backend/scripts/agent-self-retrospective.ts`) | 2 |
| 4 | 다음 sprint design 단계 trigger — "이전 sprint metrics 보고 + 적용 lesson check" | 3 |

### 4.4 가드 / Lane

- **Yellow Lane → Red Lane (점진)** — read-only metrics 수집은 Yellow, 다음 sprint 의 design 자동 차단 trigger 는 Red (실험적)
- R&D — 패턴 정의 자체가 새 영역

**자신감 60%** — 미관측: agent self-evaluation 의 정확도 / cycle time 의 의미 정의 / lesson 적용 여부 자동 판정 가능성. 1년+ 단위 R&D, 단계적 진입.

## 5. 개발 로드맵 (총 4 sprint)

```
sprint 23 (P0) — cross-codex consolidation        — 1-2일
   ↓
sprint 24 (P1) — AEO/GEO 자동 산출                 — 3-5일
   ↓
sprint 26 (P2) — 신규 site 자동 launch              — 5-7일
   ↓
sprint 25 (P3, R&D) — self-diagnostic              — 1-2 sprint 단위
```

순서 의존성:
- sprint 23 → 24 (lesson schema 통일 후 score 변동 alert 가 lesson 자동 등록)
- sprint 23 → 26 (site-template 의 LESSONS.md schema 가 sprint 23 의 표준 사용)
- sprint 24 → 25 (self-diagnostic 의 metrics 가 score 자동 갱신 의존)

## 6. 비개발 영역 (외부 의존 / 인간 결정)

기능 개발 외 작업:

| 영역 | 분류 | 담당 |
|---|---|---|
| AEO/GEO 의 LLM 인용 추적 외부 API key 발급 | 외부 의존 | TJ |
| 신규 사업 진입 결정 (sprint 26 trigger) | 인간 결정 | TJ |
| Red Lane 작업 명시 승인 (publish / 외부 send / env 영구 변경) | 인간 결정 | TJ |
| sprint 24 의 alert 임계 결정 (5점 하락 = trigger? 10점?) | 인간 결정 + agent 시뮬레이션 | TJ + Codex |
| 기존 site 의 lesson 추출 (datacheckplan / tiktokroasplan 안의 lesson 후보) | manual curation | Codex (사람 review) |

## 7. 본 codex 가 즉시 시작 가능한 것

| 옵션 | 시간 | 자신감 |
|---|---|---|
| **즉시 sprint 23 진입** (cross-codex consolidation) | 1-2일 | 92% |
| sprint 24 design 문서 만 사전 작성 (구현 0) | 0.5일 | 90% (sprint 22 의 A-6 design 패턴 재사용) |
| sprint 25 design 문서 만 사전 작성 (구현 0) | 0.5일 | 75% (R&D 영역, design 자체가 학습) |
| sprint 26 design 문서 만 사전 작성 (구현 0) | 0.5일 | 85% |

본 codex 추천: **TJ 가 sprint 23 진입 승인 시 즉시 시작**. sprint 24 / 25 / 26 의 design 문서는 sprint 진입 직전에 작성 (sprint 22 의 A-6 패턴). 23 만 즉시 진입.

## 8. 비개발 — 운영 routine (자동 진행)

| 작업 | 담당 |
|---|---|
| Coffee A-5 monitoring cron 매일 09:00 | 자동 (sprint 21) |
| 2026-05-05 (KST) 3일 조기 게이트 평가 | TJ 결정 |
| biocom / TikTok / AIBIO 의 다른 codex 진행 | 그쪽 codex |

## 9. 본 문서의 자기 정의

본 문서는 **agent 가 다음 어떤 기능을 만들지** 의 정본. [[!menu]] 의 메뉴 카탈로그가 "현재" 라면, 본 문서는 "다음 사이클의 기능". [[!aiosagent]] 의 인사이트가 "왜" 라면, 본 문서는 "어떻게".

매 sprint 진입 시 본 문서 의 우선순위 표 갱신. 신규 lesson 적용 시 본 문서 도 자동 update (sprint 25 의 self-diagnostic 가 trigger).

자세한 sprint 진입: [[!coffeedata#다음 할일]] · 운영 frontend 카탈로그: [[!menu]] · 미래 운영체계: [[!aiosagent]].
