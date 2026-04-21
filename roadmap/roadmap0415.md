# AI Native Revenue OS 로드맵

기준일: 2026-04-15 KST

이 문서는 기존 `roadmap0327.md`를 "Revenue CRM/실험 로드맵"에서 "에이전트 기반 AI Native Revenue OS 로드맵"으로 재정렬한 것이다. 목표는 대시보드 확장이 아니라, 데이터 정합성, 광고 신호, CRM 실행, 실험 검증, 사람 승인, 재검증이 하나의 반복 루프로 굴러가게 만드는 것이다.

## 참조 문서

- [agent/agentprd.md](/Users/vibetj/coding/seo/agent/agentprd.md): Revenue Integrity Agent PRD. 핵심 루프는 `수집 -> 정규화 -> 매칭 -> 차이 탐지 -> 원인 진단 -> 액션 제안 -> 사람 승인 -> 재검증`.
- [roadmap/roadmap0327.md](/Users/vibetj/coding/seo/roadmap/roadmap0327.md): 기존 Revenue CRM/실험 로드맵.
- [capivm/capi.md](/Users/vibetj/coding/seo/capivm/capi.md): biocom 기준 CAPI/Purchase Guard, VM active origin, 남은 검증.
- [meta/capimeta.md](/Users/vibetj/coding/seo/meta/capimeta.md): 0414 기준 CAPI 운영, 커피 guard, funnel 이벤트 확장, CAPIG 판단.
- [crmux/crmux0412.md](/Users/vibetj/coding/seo/crmux/crmux0412.md): CRM 고객 그룹, 발송, 고객 관리 UX 고도화 계획.

## 현재 프로젝트 구조 파악

이 저장소는 단일 앱이 아니라 운영 문서, 백엔드, 프론트엔드, 추적 스크립트, 데이터 리포트가 섞인 Revenue OS 작업공간이다.

| 영역 | 주요 경로 | 현재 의미 |
|---|---|---|
| 백엔드 | `backend/src` | Express/TypeScript API. Attribution ledger, CRM local DB, Meta CAPI, Toss, Imweb, GA4, ads API, background jobs 담당 |
| 프론트엔드 | `frontend/src` | Next.js 16. `/ads`, `/crm`, `/tracking-integrity`, `/coffee`, `/cohort`, `/solution` 등 운영 화면 |
| 운영 DB | `backend/data` | SQLite 기반 CRM/attribution 로컬 운영 데이터. VM 운영 DB와 로컬 Mac DB가 독립이라는 점에 주의 |
| CAPI/VM | `capivm`, `meta`, `footer` | VM 배포, Meta CAPI, Purchase Guard, 아임웹 삽입 스크립트, 토큰/guard/runbook 문서 |
| CRM/UX | `crmux`, `crm`, `phase3` | 고객 그룹, 발송, 알림톡/SMS, 실험 UX, 화면 캡처와 개선 계획 |
| 로드맵 | `roadmap` | 기존 phase 문서와 현재 로드맵 |
| 데이터 리포트 | `data`, `coffee`, `aibio`, `GA4`, `gtmaudit` | ROAS, CAPI, GTM, 커피 가격, AIBIO 광고 관련 분석 산출물 |

빌드/실행 기준:

| 구분 | 명령 | 비고 |
|---|---|---|
| 루트 프론트 dev | `npm --prefix frontend run dev` | 포트 7010 |
| 루트 백엔드 dev | `npm --prefix backend run dev` | 포트 7020 |
| 백엔드 빌드 | `npm --prefix backend run build` | TypeScript build |
| 백엔드 타입체크 | `npm --prefix backend run typecheck` | `tsc --noEmit` |
| 프론트 빌드 | `npm --prefix frontend run build` | Next build |
| CRM 테스트 | `npm --prefix frontend run test:crm` | Playwright |

중요한 구조 판단:

- 현재 백엔드에는 `IMWEB_AUTO_SYNC_*`, `TOSS_AUTO_SYNC_*` background job 코드가 이미 들어와 있다. 단, VM env 활성화와 배포 여부가 별도 확인 대상이다.
- `roadmap0327.md`는 0414까지 누적된 실행 로그가 많아졌고, "실행 순서"와 "제품 단계"가 섞였다. 0415 문서는 우선순위와 책임 분리를 기준으로 다시 정리한다.
- 에이전트화의 선행 조건은 "정본 전환"과 "데이터 freshness"다. 숫자가 신뢰되지 않으면 AI가 설명을 잘해도 잘못된 의사결정을 강화한다.

## 0415 우선순위 판단

우선순위는 아래 원칙으로 재정렬한다.

1. **정본 전환과 freshness가 먼저다.** 커피 Purchase Guard, Imweb/Toss 자동 sync, 가상계좌 입금 후 confirmed 전환 검증이 먼저 닫혀야 한다.
2. **Agent MVP는 read-only부터 간다.** 자동 수정, 자동 예산 이동, 자동 태그 수정은 후순위다. 처음은 incident 탐지, 증거, 원인 후보, 액션 초안이다.
3. **규칙 엔진과 AI 설명 엔진을 분리한다.** 매칭, 중복, 상태 판정, threshold는 코드가 계산하고, AI는 사람에게 설명하고 티켓/보고서 초안을 만든다.
4. **CRM 실행 레이어가 있어야 루프가 닫힌다.** 진단만 있고 발송/그룹/실험 실행이 없으면 OS가 아니라 리포트다.
5. **실험과 재검증이 있어야 학습한다.** iROAS, holdout, Conversion Lift, 캠페인 성과 퍼널이 에이전트의 feedback 데이터가 된다.
6. **Google/TikTok 확장은 Meta 정합성 루프가 안정된 뒤다.** Google Ads 계정 3종 공존, TikTok 집행 여부 미확인은 사람 확인이 먼저다.

## 2026-04-17 운영 보정 — 정본 우선, loop는 얇게 병렬

2026-04-17 기준 다음 개발 우선순위는 **정본/freshness 작업 80%, 얇은 운영 loop 20%**로 둔다.

즉, `loopagent1.md`, `loopagent2.md`의 구조를 지금 전면 구현하지 않는다. `.codex/agents`, `.claude/agents`, 자동 PR, recursive fan-out은 보류한다. 대신 현재 진행 중인 정본 작업마다 `plans/*.md` 실행 기록, evidence-first 보고, 재검증 task만 얇게 병렬 적용한다.

이 판단의 이유는 단순하다. 지금 가장 큰 병목은 에이전트 수가 부족한 것이 아니라, 에이전트와 운영 화면이 믿고 쓸 **정본 전환**, **데이터 freshness**, **source-of-truth**가 아직 승인된 계약으로 잠기지 않은 것이다.

| 구분 | 2026-04-17 판단 |
|---|---|
| 최우선 | Conversion Dictionary v1 승인 패키지, freshness/source-of-truth 표 고정 |
| 다음 | CAPI/Purchase Guard/sync 정합성 검증, coffee/biocom 실주문 confirmed 검증 |
| 병렬 허용 | 복잡한 작업에만 `plans/*.md`, evidence 정리, 재검증 task 기록 |
| 보류 | 대량 에이전트 디렉터리, 자동 PR/merge, production write-back 자동화 |
| 판별 기준 | loop 도입 후 TJ님 개입 감소, evidence 품질 증가, 중요한 작업 집중도가 좋아져야 확장 |

### Conversion Dictionary v1 현재 상태

Conversion Dictionary v1은 **초안 작성은 완료**, **운영 승인과 구현 반영은 미완료** 상태다.

완료된 것:

- `roadmap/phase0_codex_draft.md`에 `paid`, `confirmed`, `pending`, `canceled`, `refunded`, `VirtualAccountIssued` 정의 초안 작성.
- Imweb, Toss, Attribution Ledger, Meta CAPI log, GA4, Browser Pixel 기준의 상태 매핑표 초안 작성.
- GA4, Meta Insights, CAPI log, Imweb, Toss, Attribution Ledger, CRM DB의 freshness 판정 규칙 초안 작성.
- `/api/integrity/health`, `/dictionary`, `/source-of-truth`, `/summary` 계열 backend contract 초안 작성.
- `roadmap/phase0.md`에 Phase 0 상태를 "설계 초안 완료 -> TJ님 승인 대기"로 정리.

아직 남은 것:

- TJ님이 운영 `confirmed` 기준을 Imweb `PURCHASE_CONFIRMATION`으로 둘지, Toss PG 승인으로 둘지 승인해야 한다.
- `paid`를 ROAS 분자에서 제외하고 `paidRevenue/provisionalRevenue`로만 둘지 승인해야 한다.
- 환불/부분환불, 배송비/VAT 포함 여부, CAPI Purchase 전송 기준을 승인해야 한다.
- 승인된 정의를 `/api/integrity/*`와 `/ads`, `/tracking-integrity` 화면 언어로 반영해야 한다.

따라서 현재 Phase 0은 "문서 초안은 있음" 단계이며, 다음 액션은 새 리서치가 아니라 **승인 패키지 압축과 계약 고정**이다.

## 2026-04-16 운영 보정 — 광고비와 Incrementality 우선순위

2026-04-16 현재 바이오컴은 CAPI/Purchase Guard 이후의 첫 clean 판단 구간이 생겼다. VM 기준 2026-04-13~15 닫힌 3일의 Attribution ROAS는 **1.90x**, Meta ROAS는 **3.06x**다. 4/14~15만 보면 격차는 약 1.34배로 내려와, 대규모 측정 실패라기보다 Meta의 넓은 매칭과 내부 Attribution의 보수적 매칭 차이가 남은 상태로 본다.

광고비 의사결정은 아래로 고정한다.

| 항목 | 판단 |
|---|---|
| 전체 광고비 | **유지**. 지금은 전체 증액/감액보다 정합성 보정과 재배분 판단력이 더 중요 |
| 증액 | Meta ROAS가 높은 캠페인만 +10~15% 제한 테스트. 48~72시간 관찰 |
| 감액 | Meta ROAS 낮고 내부 Attribution도 0인 캠페인은 -20~30% 또는 소재 교체 후보 |
| 공격적 스케일 | 보류. 내부 캠페인 Attribution이 `(unmapped)`로 몰려 있어 캠페인별 확신이 부족 |
| 비즈니스 성장성 | Attribution ROAS 1.90x는 기여이익률 53% 전후가 1차 구매 손익분기. LTV/재구매/신규고객 비중 확인 전에는 Meta ROAS 3.06x만으로 증액하면 안 됨 |

Incrementality는 **지금 당장 설계는 시작 가능**하지만, live holdout은 바로 시작하지 않는다. 이유는 세 가지다.

1. CAPI/Purchase Guard clean baseline이 아직 3일치다. 최소 닫힌 7일(2026-04-13~19, 2026-04-20 아침 확인)이 필요하다.
2. 내부 캠페인 매출 매핑이 `(unmapped)`에 몰려 있어 어떤 캠페인을 holdout 대상으로 삼을지 불명확하다.
3. 현재 가장 큰 임팩트는 예산 총량 실험보다 **측정 정합성 + 캠페인 매핑 + 제한적 재배분**이다.

따라서 Phase 5는 "설계 착수"만 앞으로 당기고, live 실험은 Phase 1의 7일 baseline과 캠페인 매핑 보정 후 실행한다.

## Phase 재정렬 요약

| 우선 | 신규 Phase | 기존 관련 Phase | 핵심 목적 | 현재 완성도 | 상태 |
|---|---|---|---|---:|---|
| 0 | 운영 기준선 고정 | P0, P1, P5.5, P9 | 정본 전환, 데이터 계약, freshness 상태 정의 | 70% | 최우선 |
| 1 | Measurement Integrity 안정화 | P5, P5.5, capivm, meta Phase 1b/1c | CAPI/Purchase Guard, sync, post-guard ROAS 구간 분리 | 68% | 최우선 |
| 2 | Revenue Integrity Agent read-only MVP | P9 신규 중심 | 숫자 불일치 incident를 자동 생성하고 증거와 액션을 제시 | 15% | 최우선 다음 |
| 3 | Signal Quality 확장 | meta Phase 3, CAPIG-style 개선 | ViewContent/AddToCart/InitiateCheckout, EMQ, dedup, CAPI health | 35% | 병렬 가능 |
| 4 | CRM Execution Loop | 기존 P3, P6, crmux0412 | 그룹, 발송, 행동 세그먼트, 캠페인 퍼널로 실행 레이어 완성 | 60% | 병렬 가능 |
| 5 | Incrementality & Experiment OS | P7, P5.5, P4 | holdout, iROAS, Conversion Lift, 실험 승패 판정 | 28% | 설계 착수, live는 Phase 1/매핑 후 |
| 6 | Multi-Platform Conversion OS | 0414 Google/TikTok 확장 계획 | Google OCI/EC, TikTok Events API, 통합 ROAS 정합성 | 10% | 계정 확인 후 |
| 7 | AI Native Operating System | P9 고도화 | 승인, 액션센터, 메모리, runbook, Slack/알림, 재검증 루프 | 10% | 지속 |
| 8 | Scale & Governance | P8, CAPIG trigger, 보안 | BigQuery/Hotjar 판단, CAPIG trigger, 권한/감사/비용 | 25% | 월간 |

## 0415 Phase별 완성도 스냅샷

완성도는 기존 세부 Phase의 단순 평균이 아니라, 이 문서의 신규 Phase가 실제 운영 루프에서 어디까지 작동하는지를 기준으로 재산정했다.

| 신규 Phase | 현재 완성도 | 근거 | 100%까지 남은 핵심 |
|---|---:|---|---|
| Phase 0. 운영 기준선 고정 | 75% | 2026-04-18 `confirmed` 정의 C안 v1 stop-line 확정(`confirmed_stopline.md`). Conversion Dictionary v1의 `paid/confirmed` 2원화 완료. freshness·source-of-truth 표 작업만 남음 | freshness 상태 정의, 사이트별 source-of-truth 표 고정, `/api/integrity/*` 계약 반영 |
| Phase 1. Measurement Integrity 안정화 | 78% | 기존 68% → **C-Sprint 2/3/4 전부 실질 완료** (2026-04-18~20). `/ads` Official/Fast 분리, CANCEL 4종 서브, Meta Purchase(-)·GA4 MP Refund 1,844/1,844 전송 완료. Meta UI Refund 등록은 정책 한계로 포기 (내부 DB/GA4 로 관측 커버). | 7일 clean baseline 확보, Events Manager dedup/EMQ 수동 확인, 캠페인 매핑 보정, coffee 입금 후 confirmed 검증, coffee GA4 MP secret 발급(소량 잔여) |
| Phase 2. Revenue Integrity Agent read-only MVP | 15% | PRD와 문제 정의는 명확하고 기존 `/ads`, `/tracking-integrity`, attribution API 자산은 있음. 하지만 전용 incident schema/API/주문 탐색기/승인 피드백 루프는 아직 없음 | `/api/integrity/*` API, incident taxonomy, evidence query, 6개 핵심 화면 MVP |
| Phase 3. Signal Quality 확장 | 45% | 기존 35% → **C-Sprint 5 BigQuery 없이 3/5 원인 정량화 완료** (2026-04-20). historical 60% 비중이 누락의 주요 원인이고 이미 구조적으로 해결됨이 실측으로 확정. `/ads` Identity Coverage 카드로 실시간 관측. session_lost / raw_export_unknown 은 BigQuery 접근 대기 | 아임웹 funnel script 카나리/확대, CAPI health, EMQ proxy, retry/backoff, event_id audit, **C-Sprint 5 잔여 2/5 (BQ 접근 후) / C-Sprint 6 (campaign mapping)** |
| Phase 4. CRM Execution Loop | 60% | 기존 P3 실행 채널, 알리고/SMS, CRM 일부 화면은 상당히 진행. 다만 crmux0412의 A/B 그룹 정보 누락, groupId 전달, 선택 멤버 발송, 고객 행동 관리가 남음 | 즉시 버그 2건 수정, 그룹 상세/선택 발송, 고객 목록/행동 세그먼트, 성과 퍼널 |
| Phase 5. Incrementality & Experiment OS | 28% | P5.5 iROAS 엔진과 ROAS 대시보드 자산은 있고, 0416 기준으로 holdout 설계 착수 조건은 갖춰짐. 다만 clean baseline 7일과 캠페인 매핑 보정 전 live 실험은 이르다 | holdout 설계 문서, 캠페인/세그먼트 후보, iROAS 운영 판정, 7일 clean baseline 이후 live |
| Phase 6. Multi-Platform Conversion OS | 10% | Google/TikTok 확장 계획과 Google Ads 계정 3종 공존 이슈는 파악됨. Google Ads API/OCI/Enhanced Conversions와 TikTok Events API는 미구현 | Google 계정 공유 의사결정, API 권한 확보, EC/OCI 설계, TikTok 집행 여부 확인 |
| Phase 7. AI Native Operating System | 10% | Agent PRD와 로드맵 구조는 생겼지만 work queue, approval gate, evidence store, notification layer는 아직 제품화 전 | Agent Registry, Action Center, Decision Log, Runbook Library, Slack/알림 승인 인터페이스 |
| Phase 8. Scale & Governance | 25% | CAPIG build-vs-buy 판단과 재검토 trigger는 잘 정리됨. BigQuery/Hotjar/권한/감사/월간 health report 자동화는 미완료 | 월간 trigger report, BigQuery 전환 판단, 권한/감사 정책, 비용/성능 dashboard |

전체 가중 평균은 단순 평균 기준 약 34%다. 단, Phase 0~1이 닫히기 전에는 뒤 Phase의 체감 완성도가 과대평가될 수 있으므로 운영 우선순위는 평균값보다 Phase 1 완료 여부를 더 중요하게 본다.

## Phase별 Sprint 분해

Sprint 번호는 전체 로드맵에서 연속으로 부여한다. 기간은 고정하지 않는다. 운영 hotfix 성격은 1~3일, 제품/UX/API 묶음은 1주 단위, 외부 계정 권한이 필요한 작업은 TJ님 확인 시점에 맞춰 조정한다.

| Sprint | Phase | 목표 | 핵심 산출물 | 주 담당 | 완료 기준 |
|---|---|---|---|---|---|
| 스프린트 1 | Phase 0. 운영 기준선 고정 | Conversion Dictionary v1 작성 | `paid/confirmed/pending/canceled/refunded/VirtualAccountIssued` 정의표, 사이트별 정본 전환 기준 | Codex + TJ님 | TJ님이 매출/전환 기준을 승인 |
| 스프린트 2 | Phase 0. 운영 기준선 고정 | Freshness/데이터 계약 고정 | GA4/Meta/Imweb/Toss/ledger/CAPI 상태를 `실시간 추정/잠정/확정/stale`로 분류하는 계약 | Codex + Claude Code | 화면과 API에서 같은 상태 언어 사용 가능 |
| 스프린트 3 | Phase 1. Measurement Integrity 안정화 | coffee guard 배포 준비 완료 | `site=thecleancoffee`, CORS, VM sync freshness, script version 체크리스트 | Codex + TJ님 | 아임웹 admin 설치 전 blocker 0개 |
| 스프린트 4 | Phase 1. Measurement Integrity 안정화 | live 결제 3종 검증 | coffee 카드, 가상계좌 미입금, 입금 후 confirmed 테스트 리포트 | TJ님 + Codex | 카드 Purchase 허용, pending 차단, confirmed CAPI 1회 |
| 스프린트 5 | Phase 1. Measurement Integrity 안정화 | biocom pending->confirmed 검증 | 기존 biocom 가상계좌 주문의 입금 후 CAPI 전송 검증 | TJ님 + Codex | `Purchase.o20260412cdb6664e94ccb` 1회 전송 확인 |
| 스프린트 6 | Phase 1. Measurement Integrity 안정화 | post-guard ROAS 운영 구간 분리 | pre/post guard ROAS 리포트, unknown decision/VirtualAccountIssued 지표 | Codex + Claude Code | `/ads` 또는 문서에서 구간 분리 판정 가능 |
| 스프린트 7 | Phase 2. Revenue Integrity Agent read-only MVP | Agent 데이터 모델 설계 | incident schema, severity, source-of-truth, evidence contract | Codex | `/api/integrity/*` 구현 전 계약 고정 |
| 스프린트 8 | Phase 2. Revenue Integrity Agent read-only MVP | Integrity health/summary API | `GET /api/integrity/health`, `summary`, 기본 정합성 점수 | Codex | biocom/coffee/AIBIO 상태 요약 반환 |
| 스프린트 9 | Phase 2. Revenue Integrity Agent read-only MVP | incident/evidence API | incidents list/detail, 샘플 주문, waterfall evidence query | Codex | 최근 7일 mismatch가 incident로 생성됨 |
| 스프린트 10 | Phase 2. Revenue Integrity Agent read-only MVP | read-only Agent UI 1차 | 홈 상태판, 이슈 상세, 주문 탐색기, 변환 사전, 진단 센터, 승인 센터 wire UI | Claude Code | 운영자가 incident와 증거를 화면에서 읽을 수 있음 |
| 스프린트 11 | Phase 2. Revenue Integrity Agent read-only MVP | feedback/revalidation 루프 | `실제 문제/정상 차이/무시` 피드백, 재검증 예약 개념 | Codex + Claude Code | read-only MVP demo 가능 |
| 스프린트 12 | Phase 3. Signal Quality 확장 | CAPI health 기반 구축 | drop rate, event_name 분포, EMQ proxy, retry/backoff, event_id audit 설계 | Codex | CAPI 품질을 raw log가 아니라 health 지표로 볼 수 있음 |
| 스프린트 13 | Phase 3. Signal Quality 확장 | biocom ViewContent/AddToCart 카나리 | 상품 1개 또는 제한 범위 funnel script, Pixel+CAPI 동일 event_id | Codex + TJ님 | 24시간 동안 오류 없이 이벤트 수신 |
| 스프린트 14 | Phase 3. Signal Quality 확장 | coffee 확장 + InitiateCheckout | coffee 공통 적용, InitiateCheckout 훅, rollback 가이드 | Codex + Claude Code + TJ님 | ViewContent/AddToCart/InitiateCheckout 수신 확인 |
| 스프린트 15 | Phase 3. Signal Quality 확장 | funnel 분석 리포트 | event volume, direct vs cart 비율, SKU x ROAS 초기 집계 | Codex | Purchase-only 구조에서 funnel 기반 분석으로 전환 |
| 스프린트 16 | Phase 4. CRM Execution Loop | 즉시 버그 2건 수정 | A/B 실험 그룹 생성 고객정보 JOIN, 발송 이동 `groupId` 전달 | Codex + Claude Code | 고객 이름/번호/동의 상태와 그룹 이동 정상 |
| 스프린트 17 | Phase 4. CRM Execution Loop | 그룹 상세/선택 발송 | 그룹 상세, 체크박스, 페이지네이션, 선택 멤버 발송 방식 | Claude Code + Codex | 선택한 멤버만 안전하게 발송 대상화 |
| 스프린트 18 | Phase 4. CRM Execution Loop | 고객 관리 기반 | 고객 목록, 검색, 그룹 사이드바, 행동 세그먼트 allowlist, 등급 연동 | Codex + Claude Code | 운영자가 고객군을 직접 만들 수 있음 |
| 스프린트 19 | Phase 4. CRM Execution Loop | 첫 operational live | 세그먼트 -> 알림톡/SMS -> 유입 -> 구매 전환 퍼널 | TJ님 + Codex + Claude Code | 실제 발송 1건과 성과 추적 완료 |
| 스프린트 20 | Phase 5. Incrementality & Experiment OS | holdout 설계 | 실험군/대조군 assignment, holdout 비율, 제외 조건 | Codex + TJ님 | TJ님이 실험 조건 승인 |
| 스프린트 21 | Phase 5. Incrementality & Experiment OS | checkout abandon 실험 live | 이탈 고객 treatment/control 발송 실험 | Codex + TJ님 | 실험이 실제 고객군에 적용됨 |
| 스프린트 22 | Phase 5. Incrementality & Experiment OS | iROAS 판정 엔진 운영화 | 증분 매출, 증분 이익, 통계적 유효성, confidence 표시 | Codex + Claude Code | 실험 승패를 iROAS로 판정 |
| 스프린트 23 | Phase 5. Incrementality & Experiment OS | 다음 가설 backlog 자동화 | 실험 결과 -> 다음 hypothesis/action candidate 생성 | Codex + Claude Code | 실패/성공 실험 모두 다음 액션으로 이어짐 |
| 스프린트 24 | Phase 6. Multi-Platform Conversion OS | Google/TikTok 선결 의사결정 | Google `AW-304339096` 공유 의도, TikTok 집행 여부, Consent Mode 상태 | TJ님 + Codex | 구현 전 계정/권한/의도 확정 |
| 스프린트 25 | Phase 6. Multi-Platform Conversion OS | Google Enhanced Conversions | gtag user_data hash snippet, 적용/미적용 판단, 설치 가이드 | Codex + Claude Code | 사이트별 EC 적용 가능 상태 |
| 스프린트 26 | Phase 6. Multi-Platform Conversion OS | Google OCI prototype | `gclid + conversion_action + value + time` 업로드 설계/초기 구현 | Codex | test upload 또는 dry-run 검증 |
| 스프린트 27 | Phase 6. Multi-Platform Conversion OS | TikTok/통합 ROAS 확장 | TikTok Events API 도입 판단, `roasphase.md` Meta/Google/TikTok 표준화 | Codex + TJ님 | 채널별 Attribution confirmed ROAS 비교 가능 |
| 스프린트 28 | Phase 7. AI Native Operating System | Agent Registry/Work Queue | 에이전트 역할, 입력/출력, 권한, task 상태 모델 | Codex | 모든 Agent task가 같은 상태 체계를 사용 |
| 스프린트 29 | Phase 7. AI Native Operating System | Evidence Store/Decision Log | 주문 샘플, 로그, 스크린샷, 승인/거절 이유 저장 구조 | Codex | incident별 증거와 결정 이력 추적 가능 |
| 스프린트 30 | Phase 7. AI Native Operating System | Action Center UX | 오늘 승인할 것, 재검증할 것, 실패한 자동 작업, 영향 금액 UI | Claude Code + Codex | 운영자가 Action Center에서 하루 업무 판단 |
| 스프린트 31 | Phase 7. AI Native Operating System | Runbook Library/Verification Harness | 토큰 회전, VM 재배포, guard 설치, CAPI 장애 대응, golden order 테스트 | Codex + Claude Code | 반복 운영 작업이 체크리스트화됨 |
| 스프린트 32 | Phase 7. AI Native Operating System | Notification Layer | Slack/알림톡/메일 중 택1, 승인 필요/장애/마일스톤 알림 | Codex + TJ님 | 알림이 문제/영향/증거/권장 액션을 포함 |
| 스프린트 33 | Phase 7. AI Native Operating System | 피드백 기반 우선순위 학습 | incident feedback을 다음 severity/우선순위에 반영 | Codex | 사람이 무시한 incident가 반복 소음이 되지 않음 |
| 스프린트 34 | Phase 8. Scale & Governance | 월간 Governance Report | CAPI 이벤트량, 광고비, EMQ, API quota, sync stale, 비용 리포트 | Codex + Claude Code | 월 1회 trigger 기반 의사결정 가능 |
| 스프린트 35 | Phase 8. Scale & Governance | BigQuery/Hotjar/Formbricks 판단 | row-level forensic 한계, UX 정성 데이터 필요성, 도입 비용 비교 | Codex + TJ님 | 도구 도입/보류가 trigger 기준으로 결정 |
| 스프린트 36 | Phase 8. Scale & Governance | CAPIG/보안/권한 재평가 | CAPIG trigger, 개인정보/쿠키 동의, 권한/감사, 비용 기준 재검토 | TJ님 + Codex | 다음 분기 scale 전략 확정 |

Sprint 실행 원칙:

- 2026-04-17 기준 실행 비중은 Phase 0~1 정본/freshness 작업 80%, 얇은 loop 운영 방식 20%로 둔다. loop는 별도 제품이 아니라 현재 작업의 계획/evidence/재검증 기록 방식으로만 병렬 적용한다.
- 스프린트 3~6은 다른 작업보다 먼저 끝내야 한다. 여기서 숫자 신뢰도가 닫히지 않으면 Agent MVP가 가짜 경고를 만들 가능성이 높다.
- 스프린트 7~11과 스프린트 16~19는 병렬 가능하다. Codex가 backend incident/CRM query를 맡고 Claude Code가 UI/UX를 맡으면 충돌이 작다.
- 스프린트 12~15는 아임웹 admin 스크립트 설치가 필요하므로 guard 설치와 같은 시간대에 겹치지 않게 운영한다.
- 스프린트 24 이후는 외부 계정 권한이 blocker다. TJ님 확인 없이는 설계까지만 진행한다.
- 스프린트 28 이후는 제품 기능보다 운영 체계다. Action Center, evidence, approval, notification이 붙어야 AI Native OS로 격상된다. 단, `.codex/agents`, `.claude/agents`, 자동 PR/recursive fan-out은 Verification Harness가 생긴 뒤 2주 비교 실험 결과가 좋을 때만 확장한다.

## Phase 0. 운영 기준선 고정

목표: 에이전트가 판단할 기준을 먼저 고정한다. 이 단계가 없으면 이후 모든 AI 설명은 멋있지만 위험하다.

2026-04-17 현재 상태:

- `roadmap/phase0_codex_draft.md` 기준으로 Conversion Dictionary v1 초안은 작성되어 있다.
- `roadmap/phase0.md` 기준으로 Phase 0은 "설계 초안 완료, TJ님 승인 대기" 상태다.
- 따라서 Codex의 다음 작업은 정의를 새로 만드는 것이 아니라, TJ님 승인 항목을 압축하고 승인된 기준을 backend/API/UI 계약으로 고정하는 것이다.

핵심 산출물:

- Conversion Dictionary v1: `paid`, `confirmed`, `pending`, `canceled`, `refunded`, `VirtualAccountIssued` 정의.
- 데이터 freshness 정책: GA4, Meta, Imweb, Toss, Attribution ledger, CAPI log가 각각 언제 `실시간 추정`, `잠정`, `확정`인지 정의.
- 사이트별 source-of-truth 표: biocom, thecleancoffee, AIBIO 각각 어떤 이벤트를 정본으로 보는지 정의.
- 로컬 DB와 VM DB 구분 규칙: 운영 판단은 VM DB 기준, 로컬 Mac DB는 개발/검증용.

| 담당          | 할 일                                                                    |
| ----------- | ---------------------------------------------------------------------- |
| Codex       | Conversion Dictionary 초안, 상태 매핑표, freshness 판정 규칙, backend contract 설계 |
| TJ님         | `confirmed` 기준, 환불/배송비/VAT 반영 기준, 운영에서 보는 매출 기준 승인                     |
| Claude Code | 사람이 읽는 용어집, 운영 화면 문구, tooltip/empty state copy 작성                      |

병렬 처리 가능:

- Codex가 상태/데이터 계약을 잡는 동안 Claude Code는 화면 언어와 운영 가이드를 작성할 수 있다.
- TJ님은 동시에 매출 기준, 환불 기준, 사이트별 우선순위를 승인하면 된다.

완료 기준:

- 어떤 숫자가 왜 다른지 판단하기 전에 "비교 가능한 숫자인지"를 먼저 말할 수 있어야 한다.
- `roadmap0415.md` 이후 모든 작업은 이 기준을 reference로 삼는다.

## Phase 1. Measurement Integrity 안정화

목표: Meta/Attribution/내부 주문 숫자의 가장 큰 오염원을 먼저 제거한다. 특히 커피 쪽 Purchase Guard와 raw sync freshness가 닫히기 전에는 Agent MVP가 계속 가짜 incident를 만들 수 있다.

최우선 작업:

1. 커피 Purchase Guard 배포 완료.
2. 커피/biocom Imweb/Toss 자동 sync VM 활성화 확인.
3. biocom 가상계좌 입금 후 `pending -> confirmed -> Server CAPI Purchase 1회` 검증.
4. post-server-decision-guard 구간을 ROAS 비교에서 분리.
5. NaverPay confirmed-only CAPI 경로를 별도 backlog로 분리.

세부 범위:

| 항목 | 현재 판단 | 우선순위 |
|---|---|---|
| biocom Purchase Guard | v3 완료, 카드/pending 단건 통과 | 유지/모니터링 |
| coffee Purchase Guard | 스크립트 복제 완료, admin 설치/실주문 테스트 필요 | P0 |
| Imweb/Toss auto sync | 코드 구현됨. VM env 활성화/배포 검증 필요 | P0 |
| 가상계좌 입금 후 confirmed | TJ님 실제 입금 필요, 이후 Codex 검증 | P0 |
| CAPI health/로그 | raw log는 있음. EMQ proxy/드랍률 endpoint 부족 | P1 |
| ROAS 비교 구간 | 2026-04-12 11:48 KST 이후 분리 필요 | P1 |

| 담당 | 할 일 |
|---|---|
| Codex | `payment-decision`의 `site=thecleancoffee` 분기 검증, CORS 검증, VM health 확인 절차, CAPI/ledger/event_id 검증 스크립트 설계, post-guard ROAS 산식 정리 |
| TJ님 | 아임웹 admin에 coffee guard 설치, biocom 가상계좌 주문 실제 입금 처리, VM env 활성화 승인, Meta Events Manager 접근/스크린샷 제공 |
| Claude Code | `/ads` 또는 `/tracking-integrity`에 "데이터 freshness / CAPI 상태 / guard 상태" 카드 UX 설계, 운영자가 이해할 수 있는 상태 문구 작성 |

병렬 에이전트 정의:

| 병렬 에이전트 | 역할 | 입력 | 출력 |
|---|---|---|---|
| Sync Freshness Agent | Imweb/Toss/ledger freshness 감시 | `imweb_orders`, `toss_settlements`, `/health` | stale incident, sync 필요 여부 |
| CAPI Integrity Agent | CAPI 성공률, dedup, event_id, failure 감시 | `/api/meta/capi/log`, attribution ledger | CAPI incident, event_id 중복 의심 |
| Guard Verification Agent | Browser Pixel Purchase 허용/차단 검증 | payment-decision, live order, network evidence | 카드/가상계좌/unknown 판정 리포트 |

완료 기준:

- coffee 카드 주문은 Purchase로 잡히고, 가상계좌 미입금은 Browser Purchase가 차단된다.
- Imweb/Toss sync가 VM에서 자동으로 갱신되고 `/health`에 enabled 상태가 표시된다.
- biocom 가상계좌 입금 완료 주문은 Server CAPI Purchase 1회만 전송된다.
- `/ads` 또는 진단 문서에서 pre-guard와 post-guard ROAS를 분리해서 읽는다.

## Phase 2. Revenue Integrity Agent read-only MVP

목표: `agentprd.md`의 Revenue Integrity Agent를 실제 제품 축으로 올린다. 첫 버전은 자동 수정이 아니라 read-only audit이다.

제품 정의:

> GA4, 광고 플랫폼, 내부 주문, Attribution ledger의 숫자를 매일 맞춰 보고, 차이가 생기면 원인 후보와 증거, 영향도, 다음 액션을 보여주는 진단 에이전트.

MVP 범위:

1. 데이터 연결 상태판.
2. Conversion Dictionary 설정/표시.
3. 날짜/사이트/채널별 정합성 점수.
4. incident 생성 엔진.
5. 주문 탐색기.
6. 이슈 상세 워터폴.
7. 액션 초안 생성.
8. 사람 승인 전까지 write-back 금지.

권장 backend surface:

| API | 용도 |
|---|---|
| `GET /api/integrity/health` | GA4, Meta, Imweb, Toss, CAPI, ledger freshness |
| `GET /api/integrity/summary?site=&from=&to=` | 정합성 점수, 영향 광고비, 영향 매출 |
| `GET /api/integrity/incidents` | 차이율 threshold 기반 incident 목록 |
| `GET /api/integrity/incidents/:id` | 원인 후보, 증거 샘플, waterfall |
| `GET /api/integrity/orders/search` | order_id, transaction_id, gclid, client_id, phone hash 검색 |
| `POST /api/integrity/incidents/:id/feedback` | 실제 문제/정상 차이/무시 피드백 |

초기 incident taxonomy:

- 정의 불일치: paid vs confirmed, pending 포함 여부, 배송비/VAT 기준 차이.
- freshness 문제: Imweb/Toss/GA4/Meta 지연.
- Purchase 중복: event_id 불일치, Browser/CAPI dedup 실패.
- Purchase 누락: payment-decision unknown, NaverPay returnUrl 미복귀, footer 미설치.
- 광고 매칭 부족: gclid/fbc/fbp/client_id 누락.
- 토큰/권한 문제: Meta token, Google Ads 계정 공유, API 권한.

| 담당 | 할 일 |
|---|---|
| Codex | matching/rule engine, incident schema, threshold 정책, evidence query, API 설계/구현, 알고리즘 검증 |
| TJ님 | MVP에서 봐야 할 사이트/채널 우선순위 승인, incident severity 기준 승인, "무시 가능한 차이" 기준 제공 |
| Claude Code | 홈 상태판, 이슈 상세, 주문 탐색기, 변환 사전, 진단 센터, 승인 센터 UX와 copy 구현 |

병렬 에이전트 정의:

| 병렬 에이전트 | 역할 |
|---|---|
| Rule Engine Agent | deterministic matching, threshold, incident 생성 |
| Evidence Agent | 샘플 주문, waterfall, 공통 패턴 추출 |
| Explanation Agent | 사람이 이해할 수 있는 원인/액션 문구 생성. Claude Code가 UX와 copy 담당 |
| Feedback Agent | 사람이 incident를 실제 문제/정상 차이/무시로 분류한 결과를 저장 |

완료 기준:

- 적어도 biocom 기준으로 최근 7일 Meta vs Attribution 차이를 incident로 만들고, 샘플 주문 증거를 보여준다.
- 커피는 freshness/토큰/guard 미완료 상태를 "성과 문제"가 아니라 "데이터 신뢰도 문제"로 분리해 보여준다.
- AI 문구가 숫자 판정을 바꾸지 않는다. 숫자 판정은 코드와 SQL/규칙이 담당한다.

## Phase 3. Signal Quality 확장

목표: Meta가 Purchase 하나만 먹는 구조를 벗어나 funnel 신호를 확장한다. 이것은 광고 최적화 품질과 에이전트 증거 품질을 동시에 올린다.

핵심 작업:

1. ViewContent 브라우저 Pixel + CAPI 병행 발사.
2. AddToCart 브라우저 Pixel + CAPI 병행 발사.
3. InitiateCheckout 병행 발사.
4. Purchase pixel repair 가능성 검토.
5. `/api/meta/capi/health` 또는 integrity health에 EMQ proxy 편입.
6. event_name별 일간 분포, drop rate, dedup 위험 표시.
7. retry/backoff, Meta Graph API version alert, event_id audit.

우선순위:

| 작업 | 이유 | 우선 |
|---|---|---|
| ViewContent/AddToCart | EMQ와 ML 최적화에 가장 큰 레버 | P0 |
| EMQ proxy health | 측정 없는 개선 방지 | P0 |
| retry/backoff | CAPIG 편익 일부를 자체 구현에 흡수 | P1 |
| InitiateCheckout | 구현 복잡도 높지만 funnel 완성 | P1 |
| SKU x ROAS | 커피 가격/상품 전략까지 연결 | P2 |

| 담당 | 할 일 |
|---|---|
| Codex | funnel CAPI endpoint 검증, event_id/dedup 정책, CAPI health endpoint, event volume 집계, retry/backoff 구현 |
| TJ님 | 아임웹 admin 접근, 특정 상품 카나리 승인, Meta Events Manager EMQ 확인, 쿠키 동의/법무 판단 |
| Claude Code | 이벤트 상태 카드, EMQ 설명 UX, 아임웹 삽입 스크립트 설치 가이드, rollback 안내 작성 |

병렬 처리 가능:

- Codex가 backend health와 event audit을 만드는 동안 Claude Code는 UX와 설치 가이드를 준비한다.
- TJ님은 아임웹/Meta Events Manager 접근권한과 카나리 상품을 정하면 된다.
- Phase 4의 CRM UX 버그 수정과 동시에 진행 가능하다. 단, 아임웹 admin에 같은 시간에 여러 스크립트를 넣는 작업은 충돌 방지를 위해 순서를 정한다.

완료 기준:

- CAPI event_name 분포가 Purchase 100%에서 ViewContent/AddToCart 포함 구조로 바뀐다.
- 24시간 drop rate가 5% 이하이고 dedup 오류 의심이 없다.
- EMQ 또는 EMQ proxy가 baseline 대비 개선되었는지 기록된다.
- 실패 시 아임웹 스크립트 삭제로 2분 내 rollback 가능해야 한다.

## Phase 4. CRM Execution Loop

목표: 진단에서 끝나지 않고 실제 고객 그룹, 발송, 실험으로 이어지는 실행 레이어를 완성한다. `crmux0412.md`의 즉시 버그와 고객 관리 기반을 우선 반영한다.

즉시 수정:

1. A/B 실험에서 그룹 생성 시 고객 정보 누락 해결.
2. 그룹에서 발송 탭 이동 시 `groupId` 전달.
3. 그룹 멤버 체크박스 선택 후 선택 멤버만 발송.
4. 그룹 상세 페이지: 기본정보, 멤버 목록, 체크박스, 페이지네이션.

이번 주 범위:

1. 고객 목록 탭: `imweb_members` 기반 검색, 그룹 사이드바, 엑셀 다운로드.
2. 고객 행동 관리: allowlist 기반 세그먼트 생성.
3. 아임웹 쇼핑 등급 연동.
4. 발송 성과 퍼널: 발송, 성공, 유입, 구매 전환율.

중요한 기술 판단:

- 전화번호 JOIN만 믿지 않는다. `member_code`를 assignment/group 경로에 보강한다.
- 동적 SQL을 허용하지 않는다. 행동 조건은 allowlist 세그먼트로 제한한다.
- 선택 멤버를 URL params로 길게 넘기지 않는다. sessionStorage 또는 서버 임시 선택을 쓴다.
- `frontend/src/app/crm/page.tsx`가 커지면 탭 단위로 분리한다.

| 담당 | 할 일 |
|---|---|
| Codex | CRM backend query, group creation join, member_code 보강, segment allowlist, 발송 대상 검증, API 테스트 |
| TJ님 | 실제 운영할 세그먼트 우선순위, 발송 승인 기준, 알림톡/SMS 문구 승인, 수신 동의 정책 확인 |
| Claude Code | CRM 탭 분리, 그룹 상세 UX, 고객 목록/행동 관리 UI, 사람이 이해하기 쉬운 발송/성과 copy |

병렬 에이전트 정의:

| 병렬 에이전트 | 역할 |
|---|---|
| Segment Agent | 재구매 지연, 생일월, 등급, 구매 횟수 등 allowlist 세그먼트 후보 생성 |
| Consent Agent | SMS/알림톡 동의, 080 수신거부, 발송 가능 여부 검증 |
| Campaign Execution Agent | 그룹 -> 발송 -> 유입 -> 구매 전환 추적 |
| UX Narrative Agent | 마케터가 이해할 수 있는 발송 문구와 화면 copy 작성 |

완료 기준:

- 실험 그룹 생성 후 고객 이름, 고객번호, SMS 동의 여부가 정상 표시된다.
- 그룹에서 발송 탭 이동 시 정확한 그룹과 선택 멤버가 유지된다.
- 첫 operational live가 가능하다. 예: 세그먼트 선택 -> 알림톡/SMS 발송 -> 유입/구매 추적.

## Phase 5. Incrementality & Experiment OS

목표: 광고/CRM 실행이 실제로 증분 매출을 만들었는지 판정한다. 이 단계에서 OS는 "보고서"에서 "학습 시스템"으로 넘어간다.

2026-04-16 판단: **지금 할 수 있는 것은 설계와 사전 계산이고, live holdout은 아직 이르다.** 바이오컴은 2026-04-13~15 clean 3일 기준 Attribution ROAS 1.90x / Meta ROAS 3.06x까지 확인했지만, 증분성 판단에는 최소 닫힌 7일 baseline과 캠페인 매핑 보정이 필요하다. 따라서 스프린트 20은 앞당겨 착수하되, 스프린트 21 live 실행은 Phase 1의 7일 baseline 이후로 둔다.

핵심 작업:

1. 체크아웃 이탈 holdout 실험.
2. Meta Conversion Lift 또는 내부 holdout 설계.
3. iROAS 계산 엔진을 운영 판단 지표로 고정.
4. 캠페인별 incremental gross profit 산출.
5. 실험 결과를 다음 segment/hypothesis에 자동 반영.

| 담당 | 할 일 |
|---|---|
| Codex | holdout assignment, iROAS 산식, 통계적 유효성 체크, 실험 결과 API, 알고리즘 검증 |
| TJ님 | 실험 윤리/비즈니스 허용 범위 승인, holdout 비율 승인, 캠페인 예산/기간 결정 |
| Claude Code | 실험 생성 UX, 결과 해석 화면, CEO/마케터용 결과 요약 copy |

병렬 처리 가능:

- Phase 4 CRM 실행 레이어가 진행되는 동안 Codex는 holdout assignment와 iROAS 산식을 준비할 수 있다.
- Claude Code는 실험 결과 화면을 dummy contract 기준으로 먼저 만들 수 있다.

완료 기준:

- 최소 1개 캠페인이 treatment/control로 나뉘고, 결과가 iROAS로 계산된다.
- "매출이 늘었다"가 아니라 "증분 이익이 늘었다"로 보고한다.
- 실험 결과가 다음 액션 후보로 다시 들어간다.

## Phase 6. Multi-Platform Conversion OS

목표: Meta 중심 정합성에서 Google/TikTok까지 확장한다. 단, 계정 구조와 집행 여부가 불명확한 상태에서 구현부터 하면 안 된다.

선결 확인:

| 항목 | TJ님 확인 필요 |
|---|---|
| Google Ads `AW-304339096` | biocom+coffee 공용 계정이 의도인지, 레거시 실수인지 |
| Google Ads API | developer token, OAuth refresh token, customer_id 제공 가능 여부 |
| TikTok Ads | 실제 집행 여부, Ads Manager 계정, Pixel ID, access token |
| Consent Mode | 아임웹 쿠키 배너/동의 상태 |

구현 순서:

1. Google Ads 계정 공존 의사결정.
2. Google Enhanced Conversions snippet 초안.
3. Google OCI 설계: `gclid + conversion_action_id + value + conversion_time`.
4. TikTok 집행 확인 후 Events API 연동 여부 결정.
5. `roasphase.md`를 Meta/Google/TikTok 공통 기준으로 확장.
6. `/ads/roas`를 플랫폼 자체 ROAS와 Attribution confirmed ROAS 비교 화면으로 확장.

| 담당 | 할 일 |
|---|---|
| Codex | Google/TikTok 서버사이드 업로드 설계, API 인증 구조, ROAS 비교 산식, 데이터 검증 |
| TJ님 | 계정 소유/공유 의도 결정, 토큰/권한 제공, 플랫폼별 도입 여부 승인 |
| Claude Code | 통합 ROAS 비교 UX, 계정 경고/설정 가이드, 사람이 이해할 수 있는 플랫폼별 차이 설명 |

완료 기준:

- Google 계정 공유 문제가 의도/오류 중 하나로 명확히 기록된다.
- 최소 Google Enhanced Conversions 또는 OCI 중 하나의 도입 판단이 완료된다.
- Meta와 Google을 같은 Attribution confirmed 기준으로 비교할 수 있다.

## Phase 7. AI Native Operating System

목표: 여러 기능을 "AI Agent가 처리 가능한 반복 업무"로 묶는다. 핵심은 하나의 거대한 에이전트가 아니라, 좁은 역할의 에이전트들이 같은 데이터 계약과 승인 체계를 공유하는 것이다.

OS 구성요소:

| 구성요소 | 설명 |
|---|---|
| Agent Registry | 어떤 에이전트가 어떤 입력/출력/권한을 갖는지 정의 |
| Work Queue | incident, action, approval, verification task를 상태 기반으로 관리 |
| Decision Log | 사람이 승인/거절/보류한 이유를 저장 |
| Evidence Store | 주문 샘플, API 응답, 로그, 스크린샷, 쿼리 결과를 추적 가능하게 저장 |
| Runbook Library | 토큰 회전, VM 재배포, guard 설치, EMQ 확인, CAPI 장애 대응 절차 |
| Approval Gate | write-back, 발송, DB 변경, 배포, 보안 변경은 사람 승인 필요 |
| Verification Harness | golden order, synthetic event, CAPI dedup, CRM 발송 flow 테스트 |
| Notification Layer | Slack/알림톡/메일 중 하나로 milestone, error, approval needed 알림 |

권장 에이전트 분해:

| 에이전트 | 주 책임 | 자동 가능 | 사람 승인 필요 |
|---|---|---|---|
| Data Freshness Agent | sync 지연, DB stale, API 실패 감지 | 감지/리포트 | 운영 env 변경 |
| Revenue Integrity Agent | GA4/Ads/Internal mismatch incident 생성 | read-only 분석 | 변환 정의 변경 |
| CAPI Quality Agent | CAPI 성공률, EMQ proxy, event_id, dedup | 감지/리포트 | guard/스크립트 배포 |
| CRM Segment Agent | allowlist 기반 세그먼트 후보 생성 | 후보 생성 | 실제 발송 |
| Experiment Agent | holdout 설계, iROAS 계산 | 계산/리포트 | 실험 시작/예산 |
| Copy/UX Agent | 운영자가 이해할 문구, 티켓 초안, 보고서 | 초안 작성 | 외부 공유/발송 |
| Ops Runbook Agent | 절차 체크리스트, 재검증 예약 | 체크리스트 | 배포/토큰/결제 테스트 |

| 담당 | 할 일 |
|---|---|
| Codex | agent data contract, work queue schema, deterministic evaluator, backend orchestration, verification harness |
| TJ님 | 승인 정책, 위험 등급, 자동화 허용 범위, 조직 운영 방식 결정 |
| Claude Code | Action Center UX, approval flow, 사람이 이해할 수 있는 runbook/copy/report 작성 |

완료 기준:

- incident가 생성되면 action candidate가 생기고, 사람이 승인하면 실행/티켓/발송/재검증 중 하나로 이어진다.
- 해결 처리 후 24시간 또는 지정 기간 뒤 자동 재검증 task가 생성된다.
- 모든 결정과 증거가 남아 다음 에이전트 판단에 재사용된다.

## Phase 8. Scale & Governance

목표: OS가 커질 때 깨지는 지점, 비용, 보안, build-vs-buy 판단을 관리한다.

월간 점검 항목:

| 항목 | 임계치 | 액션 |
|---|---|---|
| 월 CAPI 이벤트 | 10,000건 이상 | CAPIG 재검토 |
| 월 광고비 | biocom 2,000만원 이상 | CAPIG/BigQuery/OCI 우선순위 재평가 |
| Meta EMQ | 7.0 미만 | CAPI/Pixel/PII/fbp/fbc 강화 |
| CAPI bug | 분기 3건 이상 | 자체 구현 유지 비용 재평가 |
| Data API 한계 | row-level forensic 부족 | BigQuery 중심 전환 |
| UX 정성 데이터 | 세션 행동 증거 부족 | Hotjar/Formbricks/BigQuery 도입 판단 |
| 개인정보/동의 | 쿠키/PII 수집 확대 | 법무/동의 배너 확인 |

| 담당 | 할 일 |
|---|---|
| Codex | 월간 health report 자동화, 비용/성능 임계치 계산, BigQuery 전환 설계 |
| TJ님 | 비용 승인, 법무/보안 승인, 외부 도구 도입 결정 |
| Claude Code | 월간 운영 리포트, 이해관계자 공유용 executive summary |

완료 기준:

- CAPIG/BigQuery/Hotjar 같은 도구 도입이 감이 아니라 trigger 기반으로 결정된다.
- 토큰, 배포, guard, sync, incident 대응 runbook이 최신 상태로 유지된다.

## 2026-04-21 01:50 보정 — BigQuery 자체 이전 계획 수립

허들러스 프로젝트 `hurdlers-naver-pay.analytics_304759974` 에 전적으로 의존하는 biocom GA4 raw export 를 자체 프로젝트 `seo-aeo-487113` 로 이전하는 계획 문서 작성: `data/bigquery_migration_plan_20260421.md`. 권장 타이밍 **2026-05-05** (v136/v137 효과 baseline 2주 확보 후), 옵션 A (신규 GA4 BigQuery Link) + 옵션 B 과거 table 일회성 copy 혼합. 비용 월 $1 미만. 사전 작업 5개 + 병행 기간 1~2주 + Day 14 전환. Claude service account 권한 이슈 근본 해결, 백엔드 freshness 자동화, C-Sprint 5 identity coverage session_lost/raw_export_unknown 확장 가능.

---

## 2026-04-21 01:40 보정 — vbank Exception Trigger v137 publish 완료

가상계좌 미입금 GA4 purchase 차단. 변수 [252] `JS - vbank blocked` + 트리거 [253] Exception + 태그 [143]/[48]/[154] blockingTriggerId 연결 + 태그 [251] prep v3 (dataLayer.set + server-branch guard). Preview A (카드 11,900원)/B (가상계좌 35,000원) 양쪽 통과 후 `backend/gtm_publish.mjs` 로 workspace 146 → v137 → live 매칭 확인. 이전까지 Meta/TikTok 만 차단되고 GA4 는 가상계좌 미입금 주문도 purchase 로 기록되던 C-Sprint 3 `vbank_expired` ₩966M 의 GA4 확장 이슈 해결. 상세: `GA4/gtm_exception_trigger_draft_20260421.md`.

---

## 2026-04-21 보정 — NPay Return 누락 이슈 신규 발견 + Phase5-Sprint9 신설

2026-04-21 00:47 KST GTM Preview Run 2 (NPay 실제 결제 시나리오) 에서 **네이버페이 결제 완료 후 biocom.kr 로 복귀되지 않음**이 확인됐다. `shop_payment_complete` URL 미도달로 client-side GA4 / Meta CAPI / Meta Pixel / TikTok Pixel purchase 이벤트가 **전부 발사 기회를 잃는다**. Google Ads [248] `TechSol-NPAY구매` 는 **버튼 클릭 시점**에 발사되어 "NPay 구매 전환"을 실제 결제 완료가 아닌 클릭 수로 기록 중이다.

| 항목 | 2026-04-21 판단 |
|---|---|
| 즉시 영향 | NPay 결제분이 GA4 revenue / Meta ROAS 에서 누락. Google Ads 는 과다집계 위험 |
| Backend DB 영향 | 없음 — `attribution_ledger` / `imweb_orders` / `toss_transactions` 정상 수신 |
| 상세 분석 문서 | `GA4/npay_return_missing_20260421.md` (신규) |
| `data/!datacheckplan.md` | **Phase5-Sprint9 신설** (NPay return 누락 감사 + 제거 A/B, 10% / 0%) |
| `GA4/gtm.md` | v4, §연관 이슈 섹션으로 링크 |
| TJ 의사결정 옵션 | (a) NPay 유지 + server-side MP purchase 보정, (b) NPay 버튼 제거 + 시계열 A/B 비교, (c) 아임웹 관리자 설정 수정으로 return URL 정상화 |
| 1순위 감사 | biocom `imweb_orders.pay_type='npay'` 비중 쿼리 + GA4 raw `add_payment_info vs purchase (pay_method=npay)` 비교 |

Phase 1 Measurement Integrity 에 이 이슈는 새 차원의 누락 신호로 편입된다. v136 GTM publish (2026-04-20) 로 `(not set)` 520건 1층 문제는 닫혔으나, NPay return 누락은 별개 구조 이슈로 분리 관리.

---

## 2026-04-20 보정 — C-Sprint 5 BigQuery 없이 가능한 범위 착수

오후 15:20 KST 시점 추가 진행.

- `attribution_ledger` 기반 `identityCoverage` 서비스 + `/api/identity-coverage/*` 2 라우트 신규 구현
- `/ads` Identity Coverage 카드 신설 — historical 비중(59.9%) / after_fix all-three(72.6%) / duplicate order(13건) / 진단 3/5 표시
- **핵심 실측**: 식별자 누락의 60%가 2026-04-08 fetch-fix 이전 historical. **구조 문제가 아니라 과거 누적** — 이미 해결됨. 신규 row 는 72.6% 커버
- session_lost / raw_export_unknown 은 BigQuery 접근 확보 후. 나머지 3/5 원인은 카드로 관측 가능

Phase 3 Signal Quality 완성도 35% → 45% 조정.

---

## 2026-04-20 오전 — C-Sprint 4 실질 완료 + Meta UI 한계 확인

2026-04-20 13:15 KST TJ 가 Meta Events Manager 에서 Refund custom event UI 등록 경로(AEM 다이얼로그)를 시도했으나, 이 경로는 표준 17개 이벤트에 없는 이름을 일반 이벤트 목록에 가시화하는 용도가 아니었다. **Meta 는 표준 외 custom event 를 UI 에서 별도 등록하는 경로를 제공하지 않음**이 정책상 확정됐다.

영향:

- C-Sprint 4 의 실질적 core 는 **Purchase 음수 value 1,844건** 이고 이는 이미 전송 완료. 24~48h 뒤 Meta Ads Manager 캠페인 리포트에서 ROAS 하락으로 육안 확인.
- Refund 관측(건수·금액)은 `/ads` Refund 카드 + `refund_dispatch_log` DB + GA4 Realtime 으로 커버. Meta UI 경로는 포기.
- Phase 1 Measurement Integrity 완성도 재산정 — C-Sprint 4 실질 완료 반영.

상세 워크스트림: `roadmap/confirmed_stopline.md` v1.6, 메모리 `reference_meta_custom_event_policy.md`.

---

## 2026-04-18 보정 — Confirmed Stop-line 확정과 Identity Coverage 승격

2026-04-18 `data/confirmedreport.md` v4 분석과 `confirmedfeedback.md` 피드백 기준으로 아래 3가지를 운영 기준으로 잠근다. 상세 워크스트림은 별도 문서 `roadmap/confirmed_stopline.md` (신규 작성)로 분리했다.

### 1) Confirmed 정의는 C안 v1으로 stop-line

실측 결과: biocom 카드 p50 42h / p90 91h, coffee 카드 p50 36h / p90 66h. Toss API는 구매확정 시각을 구조적으로 제공하지 않고, 아임웹 v2 API는 `complete_time` 하나만 제공해 상태 이력 추적은 불가능하다. 그래서 정의를 더 깊이 파는 대신 아래 문장으로 고정한다.

> **운영 공식 성과판단은 `business_confirmed` 기준으로 본다. 메타 최적화 신호는 `paid` 기반 fast signal을 유지하되, 환불/취소 정정 이벤트를 추가한다. confirmed 정의 고도화는 v1 기준에서 고정하고 후순위로 넘기며, 다음 우선순위는 identity coverage와 campaign mapping이다.**

Phase 0 Conversion Dictionary v1은 이 문장 승인으로 **Phase 0 Confirmed 항목만 closable**. freshness와 source-of-truth 표 작업은 남아 있음.

### 2) 이번 주 구현 3개 (Phase 1로 편입)

아래 3개가 붙으면 C안이 말이 아니라 실제 운영 기준이 된다.

| 신규 Sprint | 대응 Phase | 담당 | 완료 기준 |
|---|---|---|---|
| 스프린트 6.5 `/ads` Official / Fast Signal 두 줄 분리 | Phase 0 + Phase 1 | Claude Code + Codex | 화면에 2개 ROAS가 나란히 보이고 차이 설명 툴팁 |
| 스프린트 6.6 CANCEL 서브카테고리 4종 분리 | Phase 1 | Codex | `actual_canceled / vbank_expired / partial_canceled / legacy_uncertain` 분리 반환 |
| 스프린트 6.7 Meta CAPI Refund + GA4 MP Refund | Phase 1 + 필요 시 Phase 8 | TJ + Codex | Toss `DONE → CANCELED/PARTIAL_CANCELED` 전이 시 두 채널에 Refund 전송 |

상세: `roadmap/confirmed_stopline.md` §C-Sprint 2~4.

### 3) 다음 배치 — identity coverage가 confirmed 정의 고도화를 앞섭니다

feedback의 자신감 95% 판단: 지금 가장 비싼 문제는 "정의"가 아니라 **"연결 끊김"**. VM 실측 `payment_success` 식별자 all-three 유입률이 50% 수준이라 절반 주문이 "어느 광고에서 왔는지" 추적 불가능.

| 기존 Phase | 새 우선순위 이동 |
|---|---|
| Phase 3. Signal Quality — identity coverage 원인 분해 | **P0 → 이번 달 착수** (기존 P1이었음) |
| Phase 3. Signal Quality — campaign mapping | P0 후속 (기존 P2) |
| AIBIO 센터 Supabase 접근 | 별도 트랙 — biocom/coffee 진행 블록 안 함 |
| 아임웹 OpenAPI OAuth | **후순위** (feedback §지금 안 할 것 반영) |

### 4) AIBIO 재정의

env 186-193에 AIBIO 센터 CRM Supabase 로그인 자격(`AIBIO_SUPABASE_ID/PASS/PROJECT`)이 이미 있다. aibio는 **shop 주문이 거의 없고 결제는 센터 CRM DB**에 적재되므로, 이 보고서의 "paid → complete_time 지연" 프레임이 애초에 맞지 않는다. aibio는 별도 트랙에서 "상담 예약 → 센터 결제 전환" 프레임으로 재설계한다.

### 연관 문서

- 워크스트림 상세: `roadmap/confirmed_stopline.md`
- 결과보고서: `data/confirmedreport.md` v4
- 피드백 원본: `confirmedfeedback.md`
- 정책 설계서: `capivm/capi.md` §0 (A + C + B 금지)
- CANCEL 서브카테고리 설계: `data/!datacheckplan.md` Phase2-Sprint4
- identity coverage 원인 분해: `data/!datacheckplan.md` Phase3-Sprint5

## 0417 보정 72시간 실행안

2026-04-17 기준으로 실행 순서를 보정한다. 가장 먼저 끝내야 할 작업만 적는다.

| 순서 | 작업 | 담당 | 완료 조건 |
|---|---|---|---|
| 1 | Conversion Dictionary v1 승인 패키지 압축 | Codex + TJ님 | `confirmed`, `paid`, 환불, 배송비/VAT, CAPI Purchase 기준 승인 항목이 1페이지로 정리됨 |
| 2 | Freshness/source-of-truth 표 고정 | Codex | biocom, thecleancoffee, AIBIO별 primary/secondary source와 `실시간 추정/잠정/확정/stale` 기준 확정 |
| 3 | CAPI/Purchase Guard/sync 검증 evidence 정리 | Codex + TJ님 | VM `/health`, CAPI log, Events Manager 확인, coffee/biocom pending->confirmed 검증 증거가 한 묶음으로 남음 |
| 4 | 커피 실주문 3종 테스트 | TJ님 + Codex | 카드 Purchase 허용, 가상계좌 pending 차단, 입금 후 confirmed/CAPI 1회 확인 |
| 5 | Integrity Agent 데이터 계약 초안 보정 | Codex | incident taxonomy, API contract가 승인된 Conversion Dictionary 기준으로 맞춰짐 |
| 6 | 얇은 loop 운영 방식 적용 | Codex | 복잡한 작업에만 `plans/*.md`, evidence-first 보고, 재검증 task를 남김 |
| 7 | Agent UI 와이어 6화면 | Claude Code | 데이터 계약이 흔들리지 않는 범위에서 홈, 이슈 상세, 주문 탐색기, 변환 사전, 진단 센터, 승인 센터 초안 |

## 병렬 처리 맵

같은 기간에 동시에 굴릴 수 있는 작업과 충돌 위험을 정리한다.

| 병렬 트랙 | Codex | TJ님 | Claude Code | 충돌 주의 |
|---|---|---|---|---|
| Track A. Truth Layer | payment-decision, sync, CAPI 검증 | admin 설치, 실제 입금, 권한 제공 | 상태 카드/가이드 | 아임웹 header/footer 동시 수정 금지 |
| Track B. Agent MVP | API contract, incident rules | severity/정본 기준 승인 | 6화면 UX/copy | 데이터 계약 변경 시 UI 재작업 |
| Track C. CRM Execution | group/segment backend | 발송 정책 승인 | CRM 탭/그룹 상세 UX | 발송 live는 사람 승인 전 금지 |
| Track D. Funnel Signal | CAPI health, event audit | Meta EMQ 확인, 카나리 승인 | 설치/rollback 가이드 | guard와 funnel script 설치 순서 관리 |
| Track E. Experiment OS | holdout/iROAS 설계 | 실험 허용 범위 승인 | 결과 해석 UI | CRM 실행 전 실험 시작 금지 |
| Track F. Thin Loop Ops | `plans/*.md`, evidence, 재검증 task | 승인/보류 판단 | runbook/copy 보조 | loop 구조가 정본 작업보다 앞서면 안 됨 |

## 하단 인사이트: AI Native 조직의 OS와 에이전트 루프가 되려면

이 솔루션이 진짜 AI Native 조직의 OS가 되려면 "AI가 대시보드를 요약한다" 수준을 넘어서야 한다. 필요한 것은 아래 구조다.

### 1. 모든 에이전트의 공통 언어는 Conversion Dictionary다

에이전트가 서로 다른 말을 하지 않게 하려면 `정본 전환`, `확정 매출`, `잠정 매출`, `광고 최적화 전환`, `리포트 전환`을 명확히 분리해야 한다. 이 사전이 없으면 AI가 매번 그럴듯하지만 다른 답을 낸다.

### 2. 데이터 freshness가 incident의 일부가 되어야 한다

숫자가 틀린 것과 아직 덜 들어온 것은 다르다. Agent는 mismatch를 만들기 전에 "이 숫자는 확정인가, 잠정인가, stale인가"를 먼저 표시해야 한다.

### 3. AI는 판단자가 아니라 설명자부터 시작해야 한다

계산은 규칙 엔진이 한다. AI는 원인 설명, 티켓 초안, 운영자 보고서, 승인 요청 문구를 만든다. 이 분리를 지키면 신뢰도가 올라간다.

### 4. 모든 액션은 재검증 task를 자동 생성해야 한다

guard 설치, 토큰 재발급, sync 활성화, CRM 발송, 실험 시작은 끝이 아니다. 24시간 뒤, 7일 뒤, 14일 뒤 무엇을 다시 볼지 task가 생겨야 루프가 닫힌다.

### 5. "사람 승인"은 병목이 아니라 안전장치다

DB 스키마 변경, 프로덕션 데이터 변경, 발송, 광고 업로드, 배포, 보안/토큰 변경은 사람이 승인한다. Agent는 승인에 필요한 증거와 예상 영향을 최대한 압축해서 보여준다.

### 6. 에이전트별 권한을 작게 쪼갠다

하나의 만능 Agent가 아니라 작은 Agent가 좋다. Sync Freshness Agent는 sync만 본다. CAPI Quality Agent는 event 품질만 본다. CRM Segment Agent는 발송 후보만 만든다. 권한이 작을수록 사고 반경도 작다.

### 7. Evidence Store가 있어야 조직 학습이 된다

주문 샘플, API 응답, 로그, 스크린샷, SQL 결과, 사람이 승인/거절한 이유가 저장되어야 한다. 그래야 다음 비슷한 incident에서 Agent가 이전 결정을 참고한다.

### 8. Action Center가 OS의 중심 화면이어야 한다

대시보드는 상태를 보여주지만, OS는 일을 움직인다. 중심 화면은 "오늘 승인할 것", "오늘 재검증할 것", "실패한 자동 작업", "돈에 영향 있는 incident"가 되어야 한다.

### 9. CRM과 광고 최적화는 같은 루프 안에 있어야 한다

광고 신호가 좋아지면 더 좋은 고객을 데려오고, CRM은 그 고객을 재구매/상담/발송 루프로 돌린다. 이 두 축이 분리되면 ROAS와 LTV가 따로 논다. Agent는 acquisition과 retention을 같은 customer_key 기준으로 봐야 한다.

### 10. 실험 결과가 다음 가설을 자동으로 만든다

AI Native OS의 마지막 단계는 자동 보고서가 아니라 자동 hypothesis backlog다. 예를 들어 "AddToCart는 늘었는데 Purchase가 안 늘었다"면 가격/리뷰/배송비/결제 UX 가설이 자동 생성되어야 한다.

### 11. Slack/알림은 단순 알림이 아니라 승인 인터페이스가 되어야 한다

장애 알림만 보내면 소음이 된다. 좋은 알림은 `문제`, `영향 금액`, `증거`, `권장 액션`, `승인 버튼 또는 담당자`를 같이 담는다. 현재 저장소에는 Slack 발송 구현이 명확히 보이지 않으므로, Notification Layer는 Phase 7의 명시 작업으로 둔다.

### 12. 장기적으로는 "Revenue Autopilot"이 아니라 "Revenue Control Tower"가 맞다

초기 제품 포지셔닝은 자동 운전보다 관제탑이 안전하다. Agent가 감지, 분석, 제안, 재검증을 하고, 사람은 고위험 액션을 승인한다. 신뢰가 쌓이면 저위험 액션부터 자동화 범위를 넓힌다.

## 결론

0415 이후 로드맵의 핵심은 Phase 숫자를 더 늘리는 것이 아니다. 현재 이미 많은 기능이 있다. 이제는 기능들을 하나의 운영 루프로 묶어야 한다.

가장 중요한 순서는 다음이다.

1. 정본과 freshness를 고정한다.
2. CAPI/Purchase Guard/sync 정합성을 닫는다.
3. 복잡한 작업에만 얇은 loop를 붙여 evidence와 재검증 task를 남긴다.
4. Revenue Integrity Agent를 read-only로 만든다.
5. CRM 실행과 funnel signal을 병렬로 강화한다.
6. iROAS와 holdout으로 학습 루프를 닫는다.
7. 승인, 증거, runbook, 재검증을 OS 레이어로 만든다.

이 순서로 가면 이 솔루션은 "광고/CRM 대시보드"가 아니라, AI 에이전트가 매일 매출 운영의 이상을 발견하고, 사람에게 승인 가능한 액션으로 바꾸고, 실행 후 재검증까지 돌리는 AI Native Revenue OS가 된다.

---

## 2026-04-17 추가: 광고 LTV 기반 예산 최적화 워크스트림

### 배경

캠페인별 Meta ROAS만으로는 검사 이후 발생하는 영양제·추가검사 매출(LTV)이 반영되지 않아 예산 판단이 왜곡된다.
callprice 상담 효과 데이터와 영양제 첫구매 LTV를 결합하면 캠페인별 추정 LTV ROAS를 산출할 수 있다.

### 완료 (2026-04-17)

| 항목 | 상태 |
|------|------|
| VM 배포: CAPI 퍼널 필드 (view_content/add_to_cart/initiate_checkout) | ✅ |
| /ads 퍼널 분석 UI (점수/병목/기간선택) | ✅ |
| 캠페인별 추정 LTV ROAS (callprice 기반) | ✅ |
| 알러지/음식물 통합 + 종합→유기산 합산 | ✅ |
| 영양제 첫구매 LTV API (`/api/callprice/supplement-first-ltv`) | ✅ |
| Attribution ledger 점검 (VM에 331건, Meta 48건 확인) | ✅ |
| 광고 유입 보정: 재구매율 50% 할인 적용 | ✅ |

### 진행 중 (2026-04-17~)

| 항목 | 기한 | 상세 |
|------|------|------|
| Meta 유입 건강기능식품 코호트 추적 | 4/30 | ledger 13건 + member_code → 코호트 LTV. 표본 50건+ 필요 |
| 영양중금속·호르몬 UTM 추가 | 4/18 | Meta Ads Manager에서 활성 광고 URL 수정 |
| YouTube UTM 체계화 | 4/25 | 영상 설명란·고정댓글에 체계적 UTM 태깅 |

### 대기

| 항목 | 선행 조건 |
|------|----------|
| 건강기능식품 캠페인 증액 판단 | 광고 유입 전용 LTV ROAS 산출 (코호트 50건+) |
| 아임웹 openapi OAuth 확보 | 유입분석(referrer) API 접근 필요. 현재 v2 API에 없음 |
| content_ids 추가 (상품별 Purchase 분리) | CAPI/Pixel에 SKU 파라미터 추가 → 교차 상품 어트리뷰션 분리 |
