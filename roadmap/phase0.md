# Phase 0 — 운영 기준선 고정

> **최종 업데이트**: 2026-04-18
> **기준 로드맵**: `roadmap/roadmap0415.md` (§2026-04-18 보정)
> **담당**: Codex (백엔드/계약) + Claude Code (화면 언어/copy) + TJ님 (매출/전환 기준 승인)
> **상태**: 설계 초안 완료 + **Confirmed 항목은 C안 v1 stop-line 확정** → TJ님 stop-line 문장 승인 대기 → freshness/source-of-truth만 남음

> **2026-04-18 업데이트**: Conversion Dictionary v1의 `confirmed` 정의는 별도 워크스트림 `roadmap/confirmed_stopline.md`로 분리해 `business_confirmed` / `paid fast signal` 2원화로 v1 stop-line 확정. 이 Phase에서 남은 Dictionary 작업은 `pending / canceled / refunded / VirtualAccountIssued` 정의 확정과 freshness·source-of-truth 표 고정.

## 왜 필요한가

에이전트와 운영 화면이 같은 정의로 숫자를 판단하려면, "비교 가능한 숫자인지"를 먼저 말할 수 있는 기준선이 있어야 하오. 기준선이 없으면 AI가 아무리 잘 설명해도 잘못된 의사결정을 강화하오.

핵심 산출물 4가지:

1. **Conversion Dictionary v1** — `paid`, `confirmed`, `pending`, `canceled`, `refunded`, `VirtualAccountIssued` 정의
2. **상태 매핑표** — Imweb/Toss/Ledger/CAPI/GA4/Pixel × 6개 상태 매트릭스, 사이트별 primary/secondary 표기
3. **Freshness 판정 규칙** — 7개 소스 × `실시간 추정/잠정/확정/stale` 4단계
4. **Backend contract 설계** — `/api/integrity/{health, dictionary, source-of-truth, summary}` 4개 엔드포인트

## 작업 분담

| 담당 | 할 일 | 상태 |
|---|---|---|
| Codex | Conversion Dictionary 초안, 상태 매핑표, freshness 판정 규칙, backend contract 설계 | 완료 — `roadmap/phase0_codex_draft.md` |
| TJ님 | `confirmed` 기준, 환불/배송비/VAT 반영 기준, 운영에서 보는 매출 기준 승인 | 대기 |
| Claude Code | 사람이 읽는 용어집, 운영 화면 문구, tooltip/empty state copy 작성 | 대기 |

## Codex 산출물 요약

전체 본문은 `roadmap/phase0_codex_draft.md` 참고. 주요 설계 결정은 다음과 같소.

- 운영 `confirmed`의 primary source는 `imweb_orders.imweb_status = 'PURCHASE_CONFIRMATION'`로 둠. 현재 ledger의 `payment_status='confirmed'`는 PG 승인에 가까워 secondary로 분리함.
- `paid`는 Toss transaction/settlement 기준 PG 승인만 포착하고, 기본 ROAS 분자에 포함하지 않음 (`paidRevenue` 별도 버킷).
- `VirtualAccountIssued`는 pending의 하위 상태로 두고 `block_purchase_virtual_account` 정책과 연결함.
- CAPI Purchase는 `touchpoint=payment_success` + `captureMode=live` + `paymentStatus=confirmed` + no-successful-log 조건만 자동 전송 (`backend/src/metaCapi.ts:254`).
- `aibio`의 Toss 경로는 현재 `tossConfig` store enum이 `biocom|coffee`뿐이라 `n/a`로 표기. Toss store 추가는 TJ 승인 필요.
- Backend contract는 4개 endpoint로 고정: `GET /api/integrity/health`, `/dictionary`, `/source-of-truth?site=`, `/summary?site=&from=&to=`. 정합성 점수는 `freshness(0.30) + definitionCoverage(0.20) + revenueReconciliation(0.25) + eventCompleteness(0.15) + identityCoverage(0.10)` 가중 평균.
- Freshness는 7개 source 모두 4단계 정의 (GA4, Meta Insights, Meta CAPI log, Imweb Orders local, Toss Settlements local, Attribution Ledger, CRM Local DB). stale 판정은 `roadmap0415.md:266-270`의 incident taxonomy로 매핑.
- 운영 판단은 VM DB 기준, 로컬 Mac SQLite는 개발/검증 mirror로만 해석함.

## TJ님 승인 필요 항목

- [ ] 운영 `confirmed` 기준을 Imweb `PURCHASE_CONFIRMATION`으로 확정할지 Toss PG 승인으로 둘지
- [ ] `paid`를 ROAS에서 제외하고 `paidRevenue/provisionalRevenue`로만 둘지
- [ ] 환불/부분환불을 gross ROAS에서 분리 표시하고 net ROAS에서 차감할지
- [ ] 배송비/VAT를 `payment_amount`에서 제외할지 포함할지
- [ ] CAPI Purchase 전송 기준을 `confirmed only`로 잠글지 PG paid도 허용할지
- [ ] aibio의 Toss source-of-truth를 `n/a`로 유지할지 별도 Toss store/env를 추가할지

## 검증 결과

- Codex draft의 file:line 인용 스팟 체크 3건 모두 일치 (`backend/src/attribution.ts:17`, `backend/src/routes/crmLocal.ts:501`, `backend/src/attributionLedgerDb.ts:45`).
- 코드 변경 없음 → tsc/테스트 재실행 불필요.
- frontend/ 수정 없음.
- 미해결: aibio ledger row 실존성, GA4 `transaction_id`와 Imweb `order_no` 매칭성, VM DB vs local DB 차이 검증 쿼리는 Phase 1 이후로 이관.

## 완료 기준

- [x] Conversion Dictionary v1 초안 작성 (`phase0_codex_draft.md` §1)
- [x] 상태 매핑표 작성 (§2)
- [x] Freshness 판정 규칙 작성 (§3)
- [x] Backend contract 설계 작성 (§4)
- [ ] TJ님 매출/전환 기준 승인
- [ ] Claude Code가 사람이 읽는 용어집/화면 문구 작성
- [ ] 어떤 숫자가 왜 다른지 판단하기 전에 "비교 가능한 숫자인지"를 먼저 말할 수 있는 상태

---

# Archive — P0 이전본 (구조 고정 · 데이터 계약, 2026-04-03 완료)

> 아래는 roadmap0415 이전의 원래 Phase 0 (CRM customer_key/이벤트 명세/운영 화면 IA)이오. 완료된 산출물이라 역사적 맥락으로만 보존하오.

> **최종 업데이트**: 2026-04-03
> **담당**: Codex (백엔드/설계) + Claude Code (프론트/UXUI)

## 왜 필요한가

식별키/이벤트/리드/정책 온톨로지가 없으면 이후 모든 실험과 에이전트가 반쪽짜리다.

### 사용자 베네핏

- **대표(TJ)**: CRM 운영자 화면 구조가 확정되어, 앞으로 만들어질 모든 화면이 어디에 어떤 형태로 들어가는지 한눈에 파악 가능
- **운영팀**: `/crm`에 들어가면 후속 관리/실험/알림톡/결제 귀속이 한 곳에 정리되어, 업무별로 다른 도구를 찾아다닐 필요 없음
- **개발팀**: customer_key 규칙과 이벤트 명세가 고정되어, 이후 개발에서 "이 고객이 저 고객과 같은 사람인지" 혼란 없음
- **AI/데이터 운영팀**: lead, customer, claim, policy를 같은 이름으로 부르기 시작해 에이전트가 헛소리할 여지를 줄임

---

## 스프린트별 완성도

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| P0-S1 | customer_key 규칙 · 이벤트 명세서 · DB 스키마 초안 | Codex (백엔드/설계) | 100% |
| P0-S2 | CRM 운영자 화면 IA · 와이어프레임 | Claude Code (프론트/UXUI) | 100% |
| P0-S3 | lead/콘텐츠/정책 온톨로지 · agent-readiness 계약 | Codex (백엔드/설계) | 100% |

> **Claude Code**: P0-S2 완료. `/crm` 4탭 구조(후속 관리/실험 운영/알림톡 발송/결제 귀속), 실험 생성 폼, 전환 동기화 버튼, 알림톡 준비 상태 UI 모두 구현.
> **Codex 추가 반영**: `GET /api/crm/phase0-blueprint`에 `lead_id`, `lead_magnet_id`, `problem_cluster`, `consent_status`, `claim_review_status`, `agent_run_log` 계열 설계 응답 추가.

---

## 상세 내용

### 기간

2026-03-30 ~ 2026-04-03

### 목표

- 실험/식별/전환 이벤트 스키마 고정
- 운영 첫 주문형 시나리오를 `체크아웃 이탈`로 확정
- 상담형 시나리오를 `상담 완료 후 영양제 후속`과 `부재/변경 고객 리콜` 두 축으로 병행 정의
- 기존 Revenue API와 충돌 없는 방식으로 CRM 레이어 설계

---

### P0-S1: customer_key 규칙 · 이벤트 명세서 · DB 스키마 초안

**담당**: Codex (백엔드/설계)

작업 범위:
- `revenue` 주문/매출 데이터와 연결되는 `customer_key` 규칙 설계
- `tb_consultation_records.customer_contact` 정규화 규칙 설계
- 실험 이벤트 명세서 작성
- 신규 테이블/인덱스/배치 흐름 설계
- Meta/Kakao 연동에 필요한 필수 필드 정의
- 상담 상태 표준화 사전 설계
- 상담사 가치 분석에 필요한 join key 설계
- CRM 운영자 화면 정보구조 정의
- 실험 생성/대상자 확인/성과 조회 화면 acceptance criteria 정의
- Meta 유입 랜딩/체크아웃 UX 계측 포인트 정의

2026-03-29 실제 개발 반영:
- `revenue backend`의 `GET /api/crm/phase0-blueprint`를 실데이터 기반 계약 API로 확장
- 포함 항목: `customer_key draft`, 상담 연락처 정규화 규칙 + 실제 스냅샷, 상담 상태 표준화 사전, ChannelTalk event blueprint, Meta/Kakao 필수 필드 계약 등
- 로컬 검증 결과:
  - 상담 데이터 `113건`
  - 상태 분포 `완료 106 / 부재 4 / 시간변경 3`
  - 상담 연락처 숫자 정규화 가능 비율 `100%`
  - 상담 연락처 기준 유료 주문 매칭률 `77.9%`
- 회귀 검증: `test_crm_phase0.py` 추가, `pytest` 기준 `4 passed`

#### customer_key 초안

원칙:
- `customer_key`는 내부 원장의 기준 키
- 외부 채널 키(`memberId`, `ga_client_id`, `meta_click_id`)는 alias 또는 projection
- `전화번호/이메일 원문`을 그대로 키로 쓰지 않고, preview 단계에서는 정규화 후 해시를 사용
- Phase 1 승인 후에는 `crm_identity_map`에 저장되는 불변 surrogate key로 승격

현재 preview 규칙:
- 1순위: `normalized_phone`
- 2순위: `normalized_email`
- key 예시: `ck_<sha256 앞 24자리>`

#### 이벤트 사전 1차 범위

- `product_view`
- `add_to_cart`
- `checkout_started`
- `checkout_abandoned`
- `message_sent`
- `message_clicked`
- `purchase`
- `refund_completed`

---

### P0-S2: CRM 운영자 화면 IA · 와이어프레임

**담당**: Claude Code (프론트/UXUI)

#### 무엇을 하는가

현재 프론트에 흩어진 3개 화면(`/`, `/callprice`, `/crm`)의 정보구조(IA)를 통합하고, 아직 없는 실험 운영/코호트/알림톡 발송 화면의 구조를 설계하였다.

#### 목표 IA 구조

```
/                          ← SEO 대시보드 (기존 유지)
/callprice                 ← 상담사 가치 분석 (기존 유지, UXUI 보강)
/crm                       ← CRM 관리 허브 (확장)
  ├─ 후속 관리 대상           ← 현재 구현 (candidates API)
  ├─ 상담 현황 요약           ← consultation/summary + managers 연결
  ├─ 알림톡 발송              ← P3-S4에서 구현
  ├─ 실험 목록/상세           ← P1-S2에서 구현
  └─ 코호트 뷰               ← P4-S2에서 구현
```

#### 핵심 파일

| 파일 | 용도 |
|------|------|
| `frontend/src/app/crm/page.tsx` | CRM 허브 메인 — 탭 구조 추가 |
| `frontend/src/app/crm/page.module.css` | CRM 스타일 |
| `frontend/src/types/consultation.ts` | consultation API 타입 |
| `frontend/src/hooks/useConsultationData.ts` | consultation 데이터 훅 |
| `frontend/src/app/callprice/page.tsx` | 상담사 가치 |
| `frontend/src/constants/pageData.ts` | 네비게이션 |

---

### P0-S3: lead/콘텐츠/정책 온톨로지 · agent-readiness 계약

**담당**: Codex (백엔드/설계)

왜 지금 필요한가:
- 에이전트를 나중에 붙이더라도, 지금 `lead`, `customer`, `claim`, `policy`를 같은 이름으로 부르기 시작해야 한다
- 프리-구매 리드 데이터를 주문 스키마에 억지로 끼워 넣지 않으려면 `lead_id`를 먼저 분리해야 한다

2026-03-31 실제 개발 반영:
- `GET /api/crm/phase0-blueprint` 응답에 아래 항목 추가
  - `lead_ontology`
  - `phase1_lead_ledger`
  - `lead_magnet_mvp`
  - `content_claim_registry`
  - `agent_readiness`
- 포함 원칙:
  - `lead_id != customer_key`
  - 리드 마그넷은 별도 시스템이 아니라 기존 experiment/ledger 위에 얹는다
  - 에이전트는 `single read-only -> draft -> limited execution -> multi-agent` 순으로 간다
- 검증: `test_crm_phase0.py` 확장, `pytest -q` 결과 `7 passed`

실무 판단:
- GraphRAG/그래프 DB는 아직 이르다
- 지금 필요한 것은 `business ontology + registry + run log`다

---

## 완료 기준

- [x] `customer_key` 생성 규칙 확정
- [x] 첫 주문형 실험 use case 확정
- [x] 상담형 실험 후보 2개 정의 완료
- [x] DB 변경안 승인 요청 준비 완료
- [x] CRM 운영자 화면 IA 통합 완료

---

## 산출물

- 이벤트 사전
- DB 스키마 초안
- 화면 플로우 초안
- 구현 우선순위 문서
