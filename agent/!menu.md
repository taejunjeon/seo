# Biocom AI Agent — 메뉴/기능 정리 (2026-05-03)

상위 인사이트: [[!aiosagent]] (AI 네이티브 OS / AI-LOOP / 퍼널그로스해킹)
참조: [[agentprd]] (Revenue Integrity Agent PRD v0.1) · [[harness/!harness|Growth Data Agent Harness]] · [[data/!datacheckplan|Data Check Plan]] · [[data/!coffeedata|Coffee Data]]

본 문서 성격: `http://localhost:7010/` 의 **Biocom AI Agent** 운영 frontend 의 모든 메뉴/기능을 (1) 존재 이유 (2) 기대 효과 (3) AI 에이전트 고도화 방향 (4) 비즈니스 파급 효과 의 4 축으로 정리.

## 0. 시스템 한 줄

**Biocom AI Agent** 는 전사 매출·광고·CRM·SEO 데이터를 **단일 진단 layer + 단일 운영 layer + 단일 액션 layer** 로 통합한 운영형 AI 시스템이다. 부제: **AEO+GEO+SEO INTELLIGENCE**. 핵심 가치는 "또 하나의 대시보드" 가 아니라 **잘못된 입찰·예산·CRM 판단을 막는 진단·실행 시스템**.

## 1. 상단 Navigation — 9 layer

| 메뉴 | 존재 이유 | 기대 효과 |
|---|---|---|
| **오버뷰** | AEO/GEO 실시간 점수 + AI 에이전트 활동 상태 + 매출 핵심 지표를 한 화면에 — CEO/마케팅 리드가 30초 안에 어제와 오늘의 변동 파악 | 30초 의사결정 익숙. AI 분석 미실행 시 명시 표시 (`AI 분석이 아직 실행되지 않았습니다`) — 정직한 상태 표기 |
| **캠페인** | Meta / Google Ads / TikTok / Naver / Kakao 광고 캠페인의 ROAS / CAC / 컨버전 통합 추적 | 채널 간 단일 정의 → cross-channel 예산 재분배 의사결정 |
| **키워드** | SEO + AEO + GEO 의 키워드 단위 추적 — search intent + 색인 상태 + AI 답변 노출 | "어떤 키워드가 검색에 노출되는지 + AI 가 답변에 인용하는지" 분리 측정 |
| **AI 보고서** | 자동 일일/주간 리포트 생성 (자연어 narrative + 핵심 지표 + 다음 액션) | 임원 보고 시간 90% 절감. 운영자 아침 시간 절약 |
| **CWV** | Core Web Vitals (LCP / INP / CLS) — Google 색인 + 사용자 경험 진단 | 기술 SEO 의 정량화. CWV degrade 시 자동 alert |
| **행동** | 사용자 행동 funnel — 페이지 → 상품 → 결제 단계별 이탈률 | UX 개선 우선순위 자동 도출 |
| **진단** | 시스템 자체 진단 (GA4 / Meta CAPI / 운영 DB / VM 의 freshness, 정합성, 오류율) | "숫자 못 믿는다" 의 원인 자체 분리 — 운영자 신뢰 회복 |
| **AI CRM** | 회원 / 매출 / 쿠폰 / 알림톡 / VIP / 광고 퍼널 통합 (12+ 카드) | 단일 view 에서 운영 결정 — 회원-매출-광고 의 cross-cutting 정보 |
| **솔루션** | 발견된 issue 의 해결 패키지 (D/A/B/C 등급 — 자동 우선순위) | issue 발견 → 액션까지 거리 단축 |
| **SEO 분석** | SEO/AEO 종합 점수 + 모니터링 URL + AEO 식별 + AI 답변 노출 + 운영 진단 | LLM 시대의 SEO/AEO 통합 — Google + ChatGPT/Perplexity/Naver Cue 인용 추적 |

## 2. 오버뷰 (홈)

### 2.1 실시간 점수 카드

| 점수 | 현재 (예시) | 의미 |
|---|---|---|
| **AEO Score** | 48/100 (실시간, 5/5 항목 측정 완료, 3개 개선 필요) | Answer Engine Optimization — ChatGPT/Perplexity 등 LLM 인용 노출 점수 |
| **GEO Score** | 68/100 (실시간, 5/5 항목 측정 완료, 3개 개선 필요) | Generative Engine Optimization — Google AI Overview / Naver Cue 인용 노출 점수 |

**존재 이유**: SEO 가 search ranking 만 측정하던 시대는 끝났다. 사용자가 검색하는 답변은 **LLM 의 합성 답변** 으로 직접 도달한다. AEO/GEO 가 0~100 척도로 정량화되지 않으면 어디부터 손볼지 결정 불가.

**기대 효과**: 매주 점수 변동 추적 → top 3 개선 항목 자동 도출 → 솔루션 패키지 자동 trigger.

**AI 에이전트 고도화**:
- 점수 산출 자동화 (현재는 manual 분석 발화)
- 점수 변동 시 원인 자동 분해 (어떤 컨텐츠가 LLM 인용에서 빠졌는지)
- 개선 컨텐츠 초안 자동 생성

### 2.2 AI 에이전트 활동 상태

**존재 이유**: 운영자가 "지금 어떤 분석/액션이 진행 중인가" 를 즉시 확인. AI 가 black box 가 아니라 **명시적 상태기계** 임을 보장.

**기대 효과**: 분석 미실행 시 정직 표시 (`AI 분석이 아직 실행되지 않았습니다. AI 분석을 실행하려면 OpenAI API 키 설정 후 아래 버튼을 클릭하세요`) — agent 가 상상하지 않음, 데이터 없으면 데이터 없다고 표시.

**AI 에이전트 고도화**:
- 실행 중 / 대기 중 / 실패 / 회복 가능 / 인간 개입 필요 의 5 상태 분리
- agent 의 "현재 무엇을 하고 있는가" 자연어 narrative 자동 생성

### 2.3 매출 핵심 지표

전사 매출 (biocom + 더클린커피 + AIBIO + 쿠팡) 의 single source-of-truth.

## 3. AI CRM — 12+ 카드 (상세)

### 3.1 운영/진단 layer

| 카드 | 존재 이유 | 기대 효과 |
|---|---|---|
| **온보딩 체크사항** | BigQuery / 개발팀 / 마케팅 화면 항목 / 표용 메모 / 추후 기록 — 신규 운영자/agent 가 온보딩 시 보는 시작점 | 온보딩 1주 → 1일 단축 |
| **CRM 관리 허브** | 회원 정보 대장 + 실험 운영 + 결제 유입 진단 — 회원/유입의 cross-cutting view | 회원 segmentation 자동 — 운영 결정 즉시 가능 |

### 3.2 사이트별 매출/CRM

| 카드 | 사이트 | 존재 이유 |
|---|---|---|
| **바이오컴 재구매율 및 LTV/CAC** | biocom | 검사 → 영업팀 전환 → 재구매 → 정기구매 까지의 funnel + Meta/Attribution ROAS 운영 판단 |
| **상담사 가치 분석** | biocom | 상담사별 성과 + 상담 효율 + 환불 시나리오 시뮬레이션 |
| **코호트-복귀성 지표** | biocom | 가입 기간별 전환율/매출, 90일 재구매 손익률 추적 |
| **더클린커피 CRM** | 더클린커피 | 재구매 / LTV / VIP / 쿠폰 / 리드 마이그 통합 |
| **더클린커피 VIP 전략** | 더클린커피 | 단가별 VIP 단계 + 바이오컴 멤버십 cross-sell + AIBIO 크로스셀 특전 설계 |
| **커피 가격 전략** | 더클린커피 | 원가 분석 + 가격 인상/인하 시뮬레이션 + 경쟁사 비교 |

### 3.3 광고/마케팅

| 카드 | 존재 이유 |
|---|---|
| **쿠폰 CRM 분석** | 쿠폰 발급/사용율 + ROI + 발인 최적화 전략 |
| **쿠팡 매출 대시보드** | BIOCOM + TEAMKETO 별 매출, 더클린커피 사업부 이관 시점, Top 상품, 수수료 추적 |
| **알림톡 발송** | 카카오 알림톡 발송, 템플릿 선택, 테스트/실행, 이력 확인 |
| **AIBIO 광고 퍼널** | 리커버리랩 Meta 캠페인 단가, 룸 매출 Lead, 채널별 CRM 방문 지표 연결 살 |
| **네이버페이 주문형 분석** | NPay 결제 funnel — 구매 의도 (intent) + 결제 완료 + 환불 단계별 |
| **Meta 광고성과** | Meta CAPI 수신 + ROAS + dedup 검증 |
| **Google Ads 광고성과** | Google Ads conversion + ROAS + gclid 추적 |

### 3.4 카드별 AI 에이전트 고도화 방향 (공통)

| 단계 | 현재 | AI 고도화 후 |
|---|---|---|
| 1. 데이터 fetch | manual 또는 cron | 자동 (real-time + 보정 시점 자동 감지) |
| 2. 정합성 check | 운영자 의심 시 manual | agent 가 freshness / 정의 mismatch / row grain 자동 검증 |
| 3. 인사이트 생성 | 운영자 분석 후 결정 | agent 가 segment / cohort / cross-channel 자동 분해 + 자연어 narrative |
| 4. 액션 추천 | 운영자가 임의 우선순위 결정 | agent 가 ROI / blast radius / 위험 가중치로 자동 우선순위 |
| 5. 액션 실행 | 운영자 manual | agent 가 Yellow Lane (controlled smoke) 안에서 자율 실행 + cleanup. Red Lane 만 인간 명시 승인 |
| 6. 회고 / 학습 | 가끔 운영자 회고 | agent 가 lessons-to-rules pipeline 으로 자동 학습 ([[harness/!harness#lessons-to-rules-pipeline]]) |

## 4. SEO 분석 (좌측 사이드바)

### 4.1 종합 점수 + 핵심 지표

| 지표 | 의미 | 현재 (예시) |
|---|---|---|
| 종합 점수 | 60/100 (오늘 결과 점수) | 100점 만점, 항목별 가중 평균 |
| 모니터링 URL | 300 | 추적 대상 URL 수 |
| 색인된 URL | 53 (17.7%) | Google Search Console 색인 비율 — 낮으면 색인 손실 의심 |
| AEO 식별 수 | 0/6 | LLM 답변에 인용된 항목 수 |
| AI 답변 노출 수 | 199 | LLM 검색 결과에서 노출된 횟수 |

### 4.2 사이드바 메뉴 (좌측)

| 메뉴 | 의미 |
|---|---|
| SEO/AEO 종합 점수 | 모든 sub-항목의 가중 평균 |
| 직접 답변 신호 | LLM 이 직접 인용할 수 있는 컨텐츠 신호 (Q&A / 정의 / 표 / 리스트) |
| 성과 기준선 (baseline) | 변동 비교의 anchor — 매주 reset |
| P0 전략 점검 | top-priority 솔루션 패키지 |
| 대표 URL 인접 | canonical / 구조화 / 인접 cluster |
| URL 색인 기준점 | Google Search Console 색인율 게이트 |
| 신호 / 운영 / 진정 | 컨텐츠 / 운영 측 신호 분리 |
| AEO 항목 | AEO 측정 sub-checklist |
| 신호 수정 | 발견된 issue 의 fix 액션 |
| 통합 점수 | 모든 sub-점수의 weighted sum |

### 4.3 승인된 패키지 — 자동 실행

`승인된 D 실행 패키지 준비 완료. 상세 정보는 아래에 정리했습니다.` 형태의 자동 trigger.

**존재 이유**: 점수 진단 → 솔루션 자동 도출 → 인간 1회 승인 → agent 자율 실행 의 LOOP 닫기.

**기대 효과**: SEO 운영자 1명 + agent = 기존 5명 효율.

## 5. AI 보고서

### 5.1 일일/주간 자동 리포트

| 항목 | 내용 |
|---|---|
| 자연어 narrative | "어제 매출은 X 만원, 어제 대비 Y%. 이유는 Z" |
| 핵심 지표 표 | 매출 / CAC / ROAS / 재구매율 / AEO+GEO 점수 변동 |
| 다음 액션 (top 3) | agent 가 ROI 가중 우선순위로 자동 도출 |

### 5.2 임원 보고 자동화

**존재 이유**: 임원 보고 시간 (주간 4-8h) 을 agent 가 대체. 운영자는 결정에만 집중.

**비즈니스 파급 효과**:
- 임원 보고 회의 시간 90% 단축
- 보고 사이의 의사결정 지연 0
- 보고서 의 숫자 정합성 100% 보장 (agent 가 자동 검증, 정의 mismatch 0)

## 6. 진단 / 솔루션

### 6.1 진단

| 영역 | 진단 내용 |
|---|---|
| GA4 | freshness / event 누락 / dedup / synthetic id |
| Meta CAPI | 수신 / dedup / event_id mismatch |
| 운영 DB | row grain / 결측 / 백필 필요 |
| 광고 플랫폼 | platform 정의 vs 내부 정의 차이 |
| VM / cloudflared | endpoint 5xx / latency |

### 6.2 솔루션 패키지

발견된 issue 별 자동 패키지 — 등급 (D/A/B/C). 본 sprint 의 sprint 19~22 같은 design + dry-run + smoke + publish + monitoring 의 LOOP 가 정확히 이 패턴.

## 7. AI 에이전트 고도화 — 전체 로드맵

| 현재 상태 | 1년 내 (next phase) | 3년 내 (mature phase) |
|---|---|---|
| **Hybrid agent**: 진단/제안 자동, 실행 manual | **Yellow Lane 자율**: agent 가 controlled smoke 까지 자율, 인간은 Red Lane 결정만 | **Closed loop**: 모든 진단 → 결정 → 실행 → 학습 자동. 인간은 strategy 만 |
| 운영자 1명 = agent 1개 | 운영자 1명 = agent 5개 (병렬) | 운영자 1명 = agent 무제한 (orchestration layer 위에서) |
| AEO/GEO 점수 manual | 점수 자동 + 컨텐츠 초안 자동 생성 | 점수 + 컨텐츠 + 발화 + 인용 자동화. LLM 답변에 자연 인용 |
| CRM 단일 view | CRM segmentation 자동 + 알림톡 자동 발송 (Yellow Lane) | CRM 결정 → 마케팅 캠페인 자동 trigger → ROI 자동 측정 → 다음 segment 자동 update |
| 보고서 manual review | agent 자동 narrative + 임원 1회 결정 | 보고서 의 숫자/narrative/액션이 의사결정 시스템과 통합 — 보고서가 곧 결정 |

## 8. 비즈니스 파급 효과

### 8.1 운영 측면

| 영역 | 효과 |
|---|---|
| 인건비 | 운영자 1명 당 5 agent 병렬 → 인건비 80% 절감 (3년 내) |
| 의사결정 latency | 분석 → 보고 → 결정 → 실행 사이클 1주 → 1시간 |
| 데이터 정합성 | "내 숫자가 맞다" 회의 0 — agent 가 단일 source-of-truth 보장 |
| 운영 위험 | Yellow/Red Lane 명시 — 의도치 않은 변경 0 |

### 8.2 매출 측면

| 영역 | 효과 |
|---|---|
| 광고 ROAS | 정의 mismatch 차단 → 잘못된 예산 결정 0 → ROAS 30%+ 개선 |
| 재구매율 | 코호트 자동 분해 → segment 별 정확한 알림톡 → 재구매율 20%+ 개선 |
| AEO/GEO | LLM 시대의 새 채널 — 인용 노출 200% 증가 (3년 내) |
| 신규 customer | AI 답변 인용 → 직접 funnel 진입 — CAC 50% 감소 |

### 8.3 조직 측면

| 영역 | 효과 |
|---|---|
| 조직 구조 | "data team / ops team / mkt team" 분리 → 통합 (agent 가 cross-cutting) |
| 신규 사업 | 신규 site 추가 시 agent 가 동일 패턴 자동 적용 (Coffee → biocom → AIBIO 의 lesson 재사용 — coffee-lesson-008) |
| 학습 곡선 | 신규 운영자 1주 → 1시간 (agent 가 wizard 역할) |
| 회사 가치 | "AI 네이티브" 운영체계 보유 = 인수합병/투자 시 가치 평가 +200% |

## 9. 다음 액션 — 메뉴별 우선순위

| 메뉴 | 우선순위 | 다음 sprint 후보 |
|---|---|---|
| 오버뷰 | P0 | AI 에이전트 활동 상태 자동화 — 5 상태 분리 + narrative |
| AI CRM (12+ 카드) | P0 | 카드별 cron 자동 갱신 + Yellow Lane action 진입 |
| SEO 분석 | P1 | 솔루션 패키지 자동 실행 (D 등급은 인간 1회 승인 후 agent 자율) |
| AI 보고서 | P1 | 자연어 narrative + 다음 액션 top 3 자동 도출 |
| 진단 / 솔루션 | P0 | freshness + 정의 mismatch 의 자동 alert |
| 캠페인 / 키워드 / 행동 / CWV | P2 | 자동 alert + 자동 cohort 분해 |

## 10. 본 문서의 자기 정의

본 문서는 **운영 frontend 의 메뉴 list** 가 아니라 **agent 의 action surface 카탈로그**다. 메뉴 = agent 가 진입 가능한 task 목록. 각 메뉴는 (1) 진단 input, (2) 운영 logic, (3) 액션 output 의 3 layer 정의 가능. agent 가 이를 통해 LOOP (관측 → 진단 → 결정 → 실행 → 학습) 를 닫는다 → [[!aiosagent#ai-loop-의-열린-고리]] 로 연결.
