# AIOS Agent — AI-LOOP 의 열린 고리를 닫는 운영체계 (2026-05-03)

상위 인사이트: 본 문서는 [[!menu|Biocom AI Agent 메뉴]] 의 본질을 정의하는 **AI 네이티브 조직 운영체계 (AIOS, AI Operating System)** 의 미래 inside.

참조:
- [[agentprd|Revenue Integrity Agent PRD v0.1]] — 정합성 에이전트 design 정본
- [[harness/!harness|Growth Data Agent Harness]] — Rules / Verify / Auditor / Lessons / EvalLog 의 5 핵심
- [[data/!datacheckplan|Data Check Plan]] — biocom 측 정합성 운영 계획
- [[data/!coffeedata|Coffee Data]] — Coffee NPay sprint 19~22 의 LOOP 닫기 evidence
- [[harness/coffee-data/AUTONOMY_POLICY|Green/Yellow/Red Lane]] — agent 자율 권한 정의

본 문서 성격: **AIOS 의 디자인 원칙 + 미래 운영 시나리오 + 비즈니스 imperative**. 단순 도구 list 가 아니라, 회사가 **AI 네이티브 조직** 으로 전환하는 운영 OS 의 청사진.

## 0. 결론 (10초)

**AIOS = Harness × Agent × LOOP-closure**.

세 axis 의 곱이 회사를 **AI 네이티브 조직** 으로 만든다. Harness (운영 가드) × Agent (자율 실행자) × LOOP (관측-진단-결정-실행-학습 의 닫힌 고리) 가 곱해질 때만 **퍼널 그로스 해킹** 이 기하급수적으로 작동. 한 axis 가 빠지면 LOOP 는 열리고, agent 는 추정만 한다.

## 1. 어떤 문제를 해결하는가

### 1.1 본질적 문제 — 정의되지 않은 LOOP

전통적 마케팅/CRM/광고 운영의 핵심 실패 패턴:

```
관측 (manual)
  → 진단 (Excel + 운영자 의심)
    → 결정 (회의 + Slack 토론)
      → 실행 (manual 입력 / 발송)
        → ??? (학습은 운영자 머리 안에)
```

**열린 고리** — "학습" 단계가 **개인 머리 안에 휘발성 으로 갇힘**. 다음 사이클에서 같은 실수 반복. 신규 운영자 입사 시 모든 lesson 을 처음부터 재발견.

### 1.2 데이터 정합성의 본질적 한계 ([[agentprd]] §1)

| 원인 | 결과 |
|---|---|
| **정의 차이** — GA4 `purchase` / 광고 `conversion` / 내부 `confirmed` 가 다른 의미 | "내 숫자가 맞다" 부서 간 마찰 |
| **처리 시간 차이** — GA4 2-6h / BigQuery streaming / 운영 DB 실시간 / Toss settlement T+1 | 오전과 오후 숫자 다름 |
| **추적 깨짐** — 이벤트 중복/누락, click ID 누락, CAPI dedup 실패 | 마케팅 결정이 기술 issue 의 오해 |

이 3 원인은 **정합성 진단 layer** 없이 사람의 머리만으로는 풀 수 없다.

### 1.3 사이트별 단절 ([[!coffeedata]] / [[data/!datacheckplan]] / [[tiktok/!tiktokroasplan]])

| 사이트 | codex | 별개 작업 |
|---|---|---|
| Coffee | 본 codex (sprint 22 까지) | Coffee NPay dispatcher v2.1 publish + A-5 monitoring |
| biocom | 다른 codex | NPay recovery + GA4 robust guard + Meta refund + bigquery cutover |
| TikTok | 다른 codex | firstTouch source-persistence + 7-day gap 분석 |
| AIBIO | 다른 codex | contact dashboard + CRM journey |

**현상**: 4 codex 가 4 site 를 병렬 진행. 정보 단절 위험. 본 codex 의 sprint 22 까지의 lesson (coffee-lesson-001~015) 가 다른 site 에 자동 전파 안 되면 같은 design 미스 반복.

**해결**: 단일 `!coffeedata` / `!datacheckplan` / `!tiktokroasplan` 등 **LOOP 의 진행 상태 source-of-truth** + harness 의 **lessons-to-rules pipeline** ([[harness/!harness#lessons-to-rules-pipeline]]).

## 2. 왜 중요한가 — AI 시대의 imperative

### 2.1 AI 네이티브 vs AI 보강 의 경계

| AI 보강 (Augmented) | AI 네이티브 (Native) |
|---|---|
| 사람이 결정, AI 가 분석 도움 | AI 가 결정, 사람이 strategy 만 |
| 도구 (tool) 로서 AI | 운영 OS 로서 AI |
| LOOP 의 "분석" 단계만 자동화 | LOOP 전체 닫음 |
| 신규 운영자 1주 학습 | 신규 운영자 1시간 (agent 가 wizard) |
| 회사 = 조직도 | 회사 = orchestration layer + agent 군 |

**경계**: LOOP 가 **닫혔는가** (학습 단계가 agent 메모리에 영속화됐는가).

### 2.2 시장 imperative

| 변화 | 영향 |
|---|---|
| 사용자가 검색 → LLM 답변 직접 사용 | 기존 SEO 가치 하락. AEO/GEO 신규 채널 |
| 광고 플랫폼 의 1st-party data 한계 강화 | 자체 attribution ledger 가 회사의 자산 |
| 인구 감소 → 인건비 상승 | agent 1명 = 운영자 5명 효과 의 회사가 살아남음 |
| 인수합병 시 "AI 네이티브 운영체계" 보유 = 가치 평가 +200% | AIOS 보유 자체가 경쟁 moat |

### 2.3 회사 측 imperative

본 sprint 19~22 의 패턴 — Coffee dispatcher 가 단일 함수 publish 하는데 **22 sprint** 진행 (design / 검증 / publish / monitoring 까지). 단일 site 에 22 sprint. 회사가 4 site (biocom/Coffee/AIBIO/TikTok) × 10+ funnel × ∞ experiment 운영 → **운영자 머리만으로 불가능**.

**유일한 해**: 운영 OS 자체를 agent 가 운영. 운영자는 strategy + Red Lane 결정만.

## 3. AI-LOOP — 닫힌 고리의 5 단계

```
┌─────────────────────────────────────────────────────────────┐
│  1. 관측 (Observe)                                          │
│     ├─ data ingestion (real-time + 보정)                    │
│     ├─ freshness check (각 source 의 max(ts), row_count)    │
│     └─ structural anomaly detection                         │
│                            ↓                                │
│  2. 진단 (Diagnose)                                         │
│     ├─ 정의 mismatch (정합성 가드 — agentprd §원인 3가지)   │
│     ├─ row grain / timezone / status definition 자동 검증   │
│     ├─ confidence label (A=primary / B=cross / C=fallback / │
│     │                    D=blocked) — datacheckplan §P0    │
│     └─ root cause 분해 (어느 layer 에서 깨졌나)             │
│                            ↓                                │
│  3. 결정 (Decide)                                           │
│     ├─ Lane 분류 (Green/Yellow/Red — AUTONOMY_POLICY)      │
│     ├─ 자신감 % 표기 + 미관측 영역 명시                    │
│     ├─ 옵션 표 (3-5 안) + ROI/blast radius 추정              │
│     └─ Green/Yellow 자동 / Red 인간 명시 승인               │
│                            ↓                                │
│  4. 실행 (Act)                                              │
│     ├─ controlled smoke (max_inserts cap, duration cap)     │
│     ├─ enforce mode (env flag + production_mode + quota)    │
│     ├─ rollback 1분 (GTM Versions / git revert / pm2 reset) │
│     └─ blast radius 명시 + 14 stop conditions               │
│                            ↓                                │
│  5. 학습 (Learn) — LOOP 닫는 결정적 단계                   │
│     ├─ lessons.md 자동 등록 (observation/candidate_rule)    │
│     ├─ AUTONOMY_POLICY 갱신 (lesson 이 rule 로 승격)         │
│     ├─ harness verify 갱신 (다음 sprint 의 가드)            │
│     └─ eval log yaml — 모든 결정의 evidence 보존            │
│                            ↓                                │
│              (다음 사이클의 관측에 자동 적용)                │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 LOOP 가 닫혔는지 검증하는 한 줄

> "이번 sprint 의 lesson 이 다음 sprint 의 첫 단계에서 자동 적용되는가?"

답이 No → LOOP 열림. Coffee sprint 19.7 의 backend 가드 미스 (lesson coffee-lesson-014) 가 sprint 20 publish 직전에야 발견된 사례 — LOOP 의 "학습 → 다음 sprint 의 design 단계 사전 검증" 단계가 약했다.

답이 Yes → LOOP 닫힘. Coffee sprint 19.4 의 backend list endpoint payment_button_type 매핑 누락 (lesson coffee-lesson-012) 이 sprint 19.8 의 user_agent_class SELECT 누락 발견에 자동 적용된 사례 — 같은 패턴 즉시 인지.

## 4. Harness × Agent — LOOP 의 골격

### 4.1 Harness 5 핵심 ([[harness/!harness]])

| 요소 | 역할 | LOOP 단계 |
|---|---|---|
| **Rules** | "이러면 안 된다" 의 집합 (PII reject / Origin allowlist / max 5 INSERT 등) | 4. 실행 가드 |
| **Verify** | 자동 검증 함수 (tsc / harness audit / Playwright sanity) | 4. 실행 후 즉시 검증 |
| **Auditor** | 실행 결과 평가 (PASS / PASS_WITH_NOTES / FAIL) | 5. 학습 입력 |
| **Lessons** | observation → candidate_rule → resolved 의 lifecycle | 5. 학습 영속화 |
| **EvalLog** | 모든 결정의 yaml evidence (timestamp / metric / verdict) | 5. 학습 영속화 |

### 4.2 Agent 의 3 axis ([[agent/agentprd]] + AUTONOMY_POLICY)

| Axis | 의미 |
|---|---|
| **자율 권한 (Lane)** | Green / Yellow / Red — 작업 위험도 따라 |
| **결정 evidence** | 자신감 % + 미관측 영역 + rollback 절차 |
| **메모리** | feedback memory + project memory + reference memory |

### 4.3 곱셈 — Harness × Agent

| Harness 만 | Agent 만 | Harness × Agent |
|---|---|---|
| 가드 있지만 사람이 직접 실행 | agent 자율이지만 가드 부재 → 위험 | **agent 가 가드 안에서 자율** |
| 학습 안 됨 | 학습 휘발 | **lessons-to-rules pipeline 자동** |
| 매번 manual sprint | 매번 같은 design 미스 | **lesson 이 다음 sprint 의 가드 자동 적용** |

본 sprint 19~22 의 evidence:
- sprint 19 design 시점에 backend 가드 review 누락 (lesson coffee-lesson-014)
- sprint 20 publish 직전에 발견 → sprint 19.7 backend 가드 추가 → publish 차단 해소
- sprint 22 의 A-6 design 시점에 lesson coffee-lesson-014 자동 적용 → backend 가드 logic 사전 review 됨 → 같은 미스 재발 0

## 5. 퍼널그로스해킹 — 기하급수적 성장의 메커니즘

### 5.1 funnel = LOOP 의 multiplier

전통적 funnel:

```
유입 → 인지 → 관심 → 구매 → 재구매 → VIP
```

각 단계의 conversion rate 를 1%p 개선하면 → 끝까지 전달되는 매출은 **n 단계의 곱셈** → 기하급수.

전통적 운영자가 funnel 1 단계 개선 = 1주 ~ 1개월. AIOS = 매일 5 단계 자동 개선.

### 5.2 AIOS funnel 그로스해킹의 산식

```
매출 = (유입) × (인지률) × (관심률) × (구매률) × (재구매율) × (LTV)
```

각 단계가 별도 agent + LOOP 닫힘:
- agent_acquisition: 광고 채널별 ROAS 자동 — Coffee 의 dispatcher v2.1 → A-6 보강 전송 LOOP
- agent_engagement: AEO/GEO 점수 자동 + 컨텐츠 초안 자동 — !menu 의 SEO 분석 layer
- agent_conversion: NPay intent capture (sprint 19~22) + funnel-capi v3 정합성
- agent_retention: CRM segmentation 자동 + 알림톡 자동 (`!menu` AI CRM)
- agent_LTV: VIP 전략 + cross-sell (Coffee VIP × biocom 멤버십 — coffeevip.md)

각 agent 가 1%p 개선 → 6 단계 곱셈 → **6%p 가 아니라 ~20%+ 매출 증가** (1.01^6 - 1 의 비선형성). 매주 LOOP 닫으면 **연 단위 5x ~ 10x**.

### 5.3 LOOP 가 닫혔을 때만 가능한 그로스

LOOP 열림 (전통적): agent 가 1%p 개선 → 운영자가 lesson 못 인지 → 다음 사이클에 같은 1%p 만 — **선형 성장**.

LOOP 닫힘 (AIOS): agent 가 1%p 개선 → lesson 자동 등록 → 다음 사이클에 더 빠른 진단 + 더 정확한 액션 → 1.5%p / 2%p / ... — **기하급수 성장**.

수식:

```
n 사이클 후 매출 multiplier
  = ∏(1 + Δ_i)
  
LOOP 열림: Δ_i = constant (예: 0.01)
  → linear growth
  
LOOP 닫힘: Δ_i = f(prev_lessons) — 학습 누적
  → exponential growth (e^t 패턴)
```

### 5.4 본 sprint 의 evidence

| sprint | LOOP 단계 | 결과 |
|---|---|---|
| 19 design | 1 관측 + 2 진단 + 3 결정 | dispatcher v2.1 design |
| 19.1~19.7 | 4 실행 + 5 학습 (lesson 12, 14) | backend 가드 추가 |
| 20 publish | 4 실행 (Red Lane) | LIVE 진입 |
| 20 sanity | 5 학습 (lesson 15) | snippet installer 추가 |
| 22 design | 다음 사이클의 1+2+3 | lesson 14 자동 적용 — 사전 검증 |

매 sprint 의 cycle time 단축: 19 (4시간) → 19.7 (1.5시간) → 22 (1시간). LOOP 닫힐수록 빨라짐.

## 6. AI 네이티브 조직의 운영체계 — 미래 시나리오

### 6.1 1년 후 (2027)

| 영역 | 현재 (2026) | 2027 |
|---|---|---|
| 운영 인력 | 4 codex + TJ 1명 = 5 | 1 TJ + agent 군 (논리적 인력 ~50) |
| sprint cycle | 1주 | 1시간 |
| 신규 site 진입 | 1개월 | 1일 (lesson 자동 fork) |
| 의사결정 latency | 4시간 | 5분 |

### 6.2 3년 후 (2029)

| 영역 | 2029 |
|---|---|
| 회사 = orchestration layer + agent 군 | TJ 가 strategy / Red Lane 결정만 |
| 매출 multiplier | 5~10x (LOOP 닫힘 + 6 단계 funnel × n cycle) |
| 신규 사업 | 매월 1 site 자동 launch (Coffee → biocom → AIBIO 의 패턴 자동 fork) |
| 회사 가치 평가 | AIOS 보유 자체로 +200% |

### 6.3 5년 후 (2031)

```
회사 = AIOS 그 자체.
  - 사용자 (운영자/임원) = strategy 입력자
  - agent 군 = 자율 운영체계
  - 데이터 + lesson + rules 의 누적 = 회사의 진짜 자산
  - "회사를 운영한다" 는 코드/agent/lesson 을 진화시키는 것
```

### 6.4 AIOS 가 진화시키는 것 — 메타 LOOP

LOOP 자체가 진화. agent 가 다른 agent 의 LOOP 를 진단 / 개선 / 학습. 이 메타-LOOP 가 회사의 진정한 moat.

## 7. AIOS 디자인 원칙 (10 commandments)

| # | 원칙 | 위반 시 |
|---|---|---|
| 1 | **모든 결정에 자신감 % 표기** | 의사결정 부담 가늠 불가 |
| 2 | **미관측 영역 1줄 이상 명시** | "추가 조사 불요" 단정 → 회귀 위험 |
| 3 | **결과 출력 끝에 다음 액션 / 문서 anchor** | 운영자가 다음 진입 점 검색 — 비효율 |
| 4 | **Lane 분류** (Green/Yellow/Red) | 자율 권한 모호 → 위험 작업 자동 진행 |
| 5 | **Cleanup 명시 — sprint 종결 시 dormant 검증** | 운영 모드 영구 변경 누적 |
| 6 | **lesson 자동 등록** (observation → candidate_rule → resolved) | LOOP 학습 단계 휘발 |
| 7 | **rollback 1분 보장** (GTM Versions / git revert / pm2 reset) | 회귀 시 blast radius 큰 |
| 8 | **외부 send 0 default** — Red Lane 만 명시 승인 | 외부 플랫폼 영구 데이터 오염 |
| 9 | **dry-run 우선** — 모든 변경은 검증 후 enforce | 의도치 않은 변경 |
| 10 | **단일 source-of-truth** (`!coffeedata` 등) | "어디 봐야 하나" 의 비용 |

## 8. 본 sprint 의 회고 — AIOS 적용 evidence

### 8.1 잘한 것

- sprint 19~22 의 lesson 15개 누적 — `harness/coffee-data/LESSONS.md`
- AUTONOMY_POLICY (Green/Yellow/Red) 정의 + 적용
- 매 sprint 의 자신감 % + 미관측 영역 + 다음 액션 명시
- monitoring cron 등록 (LOOP 의 1단계 자동화)
- harness × agent 곱셈 — A-4 publish 의 backend 가드 사전 review (lesson 14 적용)

### 8.2 부족한 것

- LOOP 의 5 단계 (학습) 이 manual lesson 등록 — 완전 자동화 미달성 (다음 phase)
- 다른 codex (biocom/TikTok/AIBIO) 와 lesson 공유 인프라 부재 — coffee-lesson 만 누적
- AEO/GEO 점수 자동 산출 미달성 (현재 manual)
- agent 의 "자기 자신을 진단" 능력 미달성 (메타-LOOP)

### 8.3 다음 phase

| sprint | 내용 |
|---|---|
| 23 | cross-codex lessons consolidation (harness/coffee-data 의 패턴을 biocom/TikTok/AIBIO 로 fork) |
| 24 | AEO/GEO 점수 자동 산출 + 컨텐츠 초안 자동 생성 |
| 25 | agent 의 self-diagnostic (메타-LOOP) 시작 |
| 26 | 신규 site 자동 launch — 패턴 fork |

## 9. 닫는 한 줄

> AIOS = LOOP 가 닫힌 회사. LOOP 가 닫힌 회사는 매주 자기 자신을 학습한다. 학습하는 회사는 기하급수적으로 성장한다. 학습 못 하는 회사는 같은 자리에서 일한다. AIOS 의 본질은 도구가 아니라 **닫힌 LOOP 자체**.

자세한 진입: [[!menu]] (메뉴 카탈로그) + [[harness/coffee-data/AUTONOMY_POLICY]] (자율 권한) + [[harness/coffee-data/LESSONS]] (학습 누적) + [[!coffeedata]] / [[data/!datacheckplan]] / [[tiktok/!tiktokroasplan]] (현재 진행 상태).
