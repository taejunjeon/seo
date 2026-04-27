# AIBIO 컨택 관리 대시보드 구현 보고서

작성 시각: 2026-04-27 KST
작성자: Claude Code
정본 설계: [[contactdashboard]]
연결 문서: [[!imwebplan]]
범위: Phase1-Sprint1 (접수함/우선순위) + Phase1-Sprint2 (컨택 로그) + Phase1-Sprint4 (감사로그) MVP

---

## 1. 결론

설계 문서 [[contactdashboard]] 기준으로 백엔드 3개 테이블 + 9개 API + 프론트 1개 route를 구현해 로컬에서 동작 확인했음. 컨택 이벤트 저장 시 리드 상태가 자동 전환되고(예: `contact_attempted` → `contacted`), summary KPI도 즉시 갱신되는 흐름까지 end-to-end 통과.

운영 배포 전 남은 일: Sprint3 (CRM 예약/방문/결제 join), Sprint5 운영 KPI 리포트 화면, RBAC role/permission 시스템(현재는 토큰 단일).

---

## 2. 확인 가능한 링크

| 용도 | 링크 |
|---|---|
| 메인 대시보드 | http://localhost:7010/aibio-native/admin/contacts |
| 기존 admin (비교용) | http://localhost:7010/aibio-native/admin |
| 첫 실험 랜딩 | http://localhost:7010/shop_view?idx=25 |
| 자체 폼 | http://localhost:7010/aibio-native |
| API: enums | http://localhost:7020/api/aibio/contact-dashboard/enums |
| API: summary | http://localhost:7020/api/aibio/contact-dashboard/summary?rangeDays=30 |
| API: leads | http://localhost:7020/api/aibio/contact-dashboard/leads?limit=50 |

운영자 사용 흐름:
1. 우상단에 본인 이름을 `상담원 ID`로 입력 (`localStorage` 저장)
2. 원문 연락처 조회/이벤트 기록은 `관리자 토큰` 입력 후 (`sessionStorage` 저장)
3. 좌측 요약 카드를 클릭해 bucket으로 필터
4. 리드 카드 클릭 → 우측 drawer (모바일은 bottom sheet)
5. 빠른 액션 버튼으로 폼 채우기 → "컨택 기록 저장"

---

## 3. 추가/변경 파일

### 백엔드

| 파일 | 변경 |
|---|---|
| `backend/src/aibioContactDashboardLedger.ts` | **신규**. 3개 테이블 init + 9개 함수(이벤트 기록/리스트/감사로그/summary/lead detail). enum 7종 + 한국어 라벨. 우선순위 점수 계산. SLA 30분/2시간 기준. |
| `backend/src/routes/aibio.ts` | 9개 endpoint 추가 (`/api/aibio/contact-dashboard/*`) + import 추가 |

새 테이블:
- `aibio_contact_events` (append-only 컨택/반응 로그)
- `aibio_contact_tasks` (재연락 큐, 자동 생성: nextAction + nextActionAt 있으면 task)
- `aibio_contact_audit_log` (PII 조회/이벤트 기록 감사)

기존 `aibio_native_leads` 테이블은 그대로 활용 (status, assigned_to, reservation_at 컬럼 재사용).

### 프론트엔드

| 파일 | 변경 |
|---|---|
| `frontend/src/app/aibio-native/admin/contacts/page.tsx` | **신규**. server component wrapper |
| `frontend/src/app/aibio-native/admin/contacts/ContactDashboard.tsx` | **신규**. 클라이언트 컴포넌트 1개 안에 SummaryCards/Filter/LeadList/Drawer/EventComposer/Timeline/Tasks 구현 |

### 신규 문서

| 파일 | 변경 |
|---|---|
| `imweb/contactdashboard-implementation.md` | 본 보고서 |

---

## 4. API 엔드포인트

| Method | Endpoint | PII | 인증 |
|---|---|---|---|
| GET | `/api/aibio/contact-dashboard/enums` | 없음 | 공개 |
| GET | `/api/aibio/contact-dashboard/summary?rangeDays=N` | 없음 | 공개 |
| GET | `/api/aibio/contact-dashboard/leads?status=&bucket=&search=&limit=&offset=&reveal=true` | 마스킹 (기본) / **원문 일괄** (`reveal=true` + 토큰) | 공개 / 토큰 시 audit log `reveal_lead_list` |
| GET | `/api/aibio/contact-dashboard/leads/:leadId?reveal=true` | 마스킹 (기본) / **원문** (`reveal=true` + 토큰) + 이벤트/태스크 | 공개 / 토큰 시 audit log `reveal_lead_detail` |
| GET | `/api/aibio/contact-dashboard/leads/:leadId/contact` | **원문 단건** | `x-admin-token` 필수, audit log `view_contact` |
| GET | `/api/aibio/contact-dashboard/leads/:leadId/timeline` | 없음 | 공개 |
| POST | `/api/aibio/contact-dashboard/leads/:leadId/events` | 없음 | `x-admin-token` (또는 NODE_ENV !== production), audit log 자동 |
| GET | `/api/aibio/contact-dashboard/tasks?ownerId=&status=&leadId=` | 없음 | 공개 |
| GET | `/api/aibio/contact-dashboard/audit-log?leadId=&limit=` | 없음 | `x-admin-token` 필수 |

### 최고 관리자 (admin token) reveal 흐름

1. 프론트가 `x-admin-token` 헤더와 함께 `?reveal=true`로 list/detail 호출
2. 백엔드 `allowAibioNativeAdminWrite(req)` 통과 시 `customerName`/`customerPhone` 원문 포함해 응답 (`revealed: true`)
3. 동시에 `recordAuditLog`가 `reveal_lead_list` 또는 `reveal_lead_detail` row 기록 (operator/IP/UA 포함)
4. 토큰 검증 실패 시 403 (`reveal_forbidden`) - 마스킹 모드로 자동 폴백 안 됨, 프론트는 토큰 없으면 `reveal=true` 자체를 보내지 않음

검증 규칙:
- `outcome=reserved` → `reservationAt` 필수 (없으면 422)
- `outcome=invalid` → `excludedReason` 필수 (없으면 422)
- `operatorId`, `channel`, `direction`, `outcome` 누락 시 422
- `note` 1,000자 이하

---

## 5. 상태 자동 전환 규칙

컨택 이벤트 저장 시 outcome에 따라 리드 상태가 자동 전환됨 (단 `paid`/`visited`는 그대로 유지):

| outcome | 리드 상태 변경 |
|---|---|
| `connected` | `contacted` |
| `reserved` | `reserved` (+ reservation_at도 갱신) |
| `rejected`/`wrong_number`/`invalid` | `invalid_duplicate` |
| `requested_callback` | `contact_attempted` |
| `no_answer`/`busy` (시도 1회 이상) | `contact_attempted` |
| 기타 | 변경 없음 |

`nextAction` + `nextActionAt`이 있으면 `aibio_contact_tasks`에 task가 자동 생성됨.

---

## 6. 화면 구성

### 데스크톱 1366×900
- 상단 요약: 6개 bucket 카드 (신규/오늘 연락/부재/예약/방문/SLA 초과) + KPI 2개 (24h 첫 컨택률·예약/방문 전환율, 총 리드/컨택)
- 필터 바: 상태·기간·검색
- 리드 리스트: 상태 pill, 유입, 마스킹 이름/번호, 상담 목적, 컨택 횟수, 다음 액션, 우선 처리 플래그
- 우측 drawer (540px): 기본 정보, 원문 연락처 조회 버튼, 빠른 액션 6개, 상세 폼, 타임라인, 예정 할 일

### 모바일 390×844
- 카드 2열 그리드
- Drawer가 bottom sheet (90vh, border-radius 14px)
- 폼 1열로 자동 변환

---

## 7. 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` (frontend) | EXIT 0 ✓ |
| `npx tsc --noEmit` (backend) | EXIT 0 ✓ |
| `npm run build` (backend, frontend) | 둘 다 성공 |
| launchctl 재기동 | `com.biocom.seo-frontend-local` + `com.biocom.seo-backend-local` 자동 respawn |
| HTTP 200 | `/aibio-native/admin/contacts` ✓ |
| API smoke | enums/summary/leads 모두 정상 응답 ✓ |
| Playwright 캡처 | desktop top + desktop drawer + mobile top + mobile drawer 4장 정상 |
| End-to-end 컨택 이벤트 저장 | `phone/outbound/connected` 저장 → 리드 상태 `contact_attempted` → `contacted` 자동 전환 + timeline 1건 표시 + summary `events: 1, operators: 1`로 즉시 갱신 ✓ |

스크린샷: `/tmp/aibio-ux-shots/contacts-desktop.png`, `contacts-desktop-detail.png`, `contacts-mobile-top.png`, `contacts-mobile-drawer.png`

### 검증 못한 부분

- 100건 이상 리드 부하 테스트 (현재 sqlite에 2건만 있음)
- 멀티 상담원 동시 접근 시 락 동작
- 모바일 실기기 키보드 + bottom sheet 인터랙션

---

## 8. 설계 대비 진행 상태

| Phase | 항목 | 진행 |
|---|---|---|
| Phase1-Sprint1 | summary, lead list, 우선순위 점수, SLA bucket | 완료 |
| Phase1-Sprint2 | contact_events, POST API, timeline UI, 빠른 액션 6개 | 완료 |
| Phase1-Sprint3 | CRM 예약/방문/결제 join | **미착수** (개발팀 CRM 연동 필요) |
| Phase1-Sprint4 | audit log, RBAC, raw contact API | **부분** (audit log + 토큰 가드 완료, role 기반 RBAC는 미구현) |
| Phase1-Sprint5 | 광고별 quality report | **미착수** |

---

## 9. TJ 승인 대기 항목

설계 문서 11번에 정의된 항목들:

| 승인 항목 | 현재 구현값 | TJ 결정 필요 |
|---|---|---|
| 고객 반응 enum 9개 | `interested`/`needs_price`/`needs_schedule`/`skeptical`/`no_budget`/`no_time`/`wants_visit`/`not_interested`/`no_response` | 너무 많지 않은지 |
| 첫 컨택 SLA | 코드상 30분/2시간 하드코딩 | 운영 기준 확정 후 환경변수로 |
| 원문 연락처 권한 | 토큰 1개로 모두 통과 | 상담원/팀장 role 분리 시점 |
| 컨택 로그 수정 | 수정 불가, 정정 이벤트 추가 패턴 | 그대로 유지 가능 여부 |
| export 권한 | export endpoint 미구현 | 누구에게 허용할지 확정 후 추가 |

---

## 10. 다음 액션

| 우선순위 | 담당 | 할일 |
|---|---|---|
| 1 | TJ | `AIBIO_NATIVE_ADMIN_TOKEN` 운영 secret 확정 후 `.env`/secret manager에 저장 |
| 2 | TJ | 9가지 고객 반응 enum 검토 후 축소/유지 결정 |
| 3 | Codex | 개발팀 CRM `customer_id`/예약/방문/결제 read API 연동 (Sprint3) |
| 4 | Claude Code | 광고/CRM attribution 화면(Sprint5)을 admin 안에 별도 탭으로 추가 |
| 5 | TJ + Codex | 첫 컨택 SLA(현재 30분/2시간) 환경변수 분리, 영업시간 처리 룰 추가 |
| 6 | Claude Code | 모바일 bottom sheet에서 빠른 액션 button 영역을 폼 위로 sticky 처리 (현재는 일반 스크롤) |
