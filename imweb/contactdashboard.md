# AIBIO 접수 폼 컨택 관리 대시보드 설계

작성 시각: 2026-04-27 13:35 KST
기준일: 2026-04-27
대상 사이트: AIBIO 리커버리랩 센터
연결 문서: [[!imwebplan]]
Obsidian 경로: `obsidian://open?vault=seo&file=imweb%2Fcontactdashboard`
목적: 접수된 폼을 상담원이 실제로 처리하고, 고객에게 컨택했는지와 고객 반응이 어땠는지 기록할 수 있는 운영 대시보드의 백엔드/프론트엔드 계약을 정의한다.

## 10초 요약

AIBIO 접수 폼 대시보드는 단순 고객 목록이 아니라 `광고 유입 -> 폼 제출 -> 상담원 컨택 -> 고객 반응 -> 예약 -> 방문 -> 결제`를 한 장부로 보는 운영 콘솔이다. 상담원은 각 리드마다 전화/문자/카톡/채널톡 컨택 여부, 부재/거절/관심/예약 희망 같은 고객 반응, 다음 연락 시각을 남겨야 한다. 백엔드는 원문 연락처를 보호하면서 불변 컨택 로그와 현재 처리 상태를 분리해 저장하고, Claude Code는 이 설계를 기준으로 리스트 + 상세 패널 + 타임라인 UI를 구현한다.

현재 `/aibio-native/admin`에는 상태, 담당자, 메모, 예약일, 방문일 저장까지 붙어 있다. 다음 단계는 메모 1칸에 상담 기록을 덮어쓰는 방식이 아니라, 컨택 시도와 고객 반응을 시간순 로그로 누적하는 것이다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(설계/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 접수함/우선순위 | Codex + Claude Code | 100% / 0% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 컨택/고객 반응 로그 | Codex + Claude Code | 100% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | 예약/방문/결제 연결 | Codex + 개발팀 | 80% / 0% | [[#Phase1-Sprint3\|이동]] |
| Phase1 | [[#Phase1-Sprint4]] | 개인정보/RBAC/감사로그 | Codex + TJ | 85% / 0% | [[#Phase1-Sprint4\|이동]] |
| Phase1 | [[#Phase1-Sprint5]] | 운영 KPI/리포트 | Codex + Claude Code | 75% / 0% | [[#Phase1-Sprint5\|이동]] |

## 1. 결론

대시보드의 핵심은 `리드 상태`와 `컨택 이력`을 분리하는 것이다.

`리드 상태`는 지금 이 고객이 어느 단계에 있는지 보여준다. 예를 들면 신규, 연락중, 상담완료, 예약확정, 방문완료, 결제완료, 제외다.

`컨택 이력`은 상담원이 실제로 무엇을 했고 고객이 어떻게 반응했는지를 시간순으로 남긴다. 예를 들면 2026-04-27 14:10 전화, 부재, 18:00 재연락 예약 또는 2026-04-27 15:20 카톡, 가격 문의, 내일 방문 희망 같은 기록이다.

이렇게 나누면 세 가지가 가능하다.

1. 상담원이 다음에 누구에게 무엇을 해야 하는지 바로 안다.
2. 마케팅 담당자는 어떤 광고가 실제 상담/예약/방문을 만들었는지 본다.
3. 센터장은 상담원이 접수 리드를 얼마나 빨리 처리하는지 본다.

## 2. 사용자와 운영 흐름

| 사용자 | 봐야 하는 것 | 해야 하는 것 | 권한 |
|---|---|---|---|
| 상담원 | 오늘 처리할 신규/재연락 리드 | 원문 연락처 조회, 전화/문자/카톡 결과 기록, 다음 액션 예약 | 자기 배정 리드 중심 |
| 팀장 | 미처리 리드, 상담원별 처리 현황, 예약 전환 | 담당자 재배정, 제외 승인, 리포트 확인 | 전체 리드 |
| 마케팅 담당 | 캠페인/광고별 폼 제출, 채널톡 클릭, 예약/방문 전환 | 끌 광고/유지 광고/증액 광고 판단 | 개인정보 비노출 집계 |
| 개발팀 | API 정상 수집, phone hash 매칭, 장애 여부 | 수집/연동 오류 수정 | 로그/시스템 |

기본 흐름은 아래로 고정한다.

1. 고객이 아임웹 또는 자체 랜딩에서 폼을 제출한다.
2. 백엔드는 `phone_hash`, 유입 정보, 폼 필드, Meta/GA 식별자를 저장한다.
3. 상담원 화면에는 원문 연락처 없이 마스킹된 신규 리드가 뜬다.
4. 상담원이 리드를 열고 원문 연락처를 조회하면 감사로그가 남는다.
5. 상담원이 전화/문자/카톡/채널톡 컨택 결과와 고객 반응을 기록한다.
6. 예약, 방문, 결제가 발생하면 같은 `phone_hash -> customer_id` 기준으로 연결한다.
7. 광고 대시보드는 캠페인별로 폼 제출뿐 아니라 상담 연결, 예약, 방문, 결제까지 본다.

## 3. 화면 설계

Claude Code는 `/aibio-native/admin/contacts` 또는 기존 `/aibio-native/admin` 안의 `컨택 관리` 탭으로 구현한다. 첫 구현은 별도 route가 낫다. 기존 관리자 화면을 크게 흔들지 않고 상담원 전용 워크플로를 빠르게 검증할 수 있기 때문이다.

### 상단 요약 카드

| 카드 | 정의 | 목적 |
|---|---|---|
| 신규 접수 | 아직 컨택 로그가 없는 리드 | 상담원이 가장 먼저 처리 |
| 오늘 연락 필요 | `nextActionAt`이 오늘이거나 지난 리드 | 재연락 누락 방지 |
| 부재 2회 이상 | 최근 결과가 부재이고 시도 횟수 2회 이상 | 문자/카톡 전환 후보 |
| 예약 확정 | 예약일이 있는 리드 | 방문 전 확인 |
| 방문 예정 | `reservationAt` 또는 센터 CRM 예약이 있는 리드 | 내원 관리 |
| 미처리 SLA 초과 | 접수 후 30분 또는 2시간 안에 첫 컨택이 없는 리드 | 운영 품질 경고 |

### 리스트 필드

| 컬럼 | 예시 | 비고 |
|---|---|---|
| 접수 시각 | 2026-04-27 15:07 | KST 기준 |
| 상태 | 신규, 연락중, 상담완료, 예약확정 | `lead.status` |
| 담당자 | 상담원 A | 필터/재배정 가능 |
| 유입 | Meta / Instagram / 광고 / 직접 | 원문 UTM과 폼 경로를 사람이 읽는 값으로 변환 |
| 캠페인/광고 | `meta_recoverylab_*` | 길면 줄임 |
| 상담 목적 | 체중 감량, 붓기 개선 | 다중 선택 가능 |
| 연락처 | `010-****-4505` | 리스트에는 원문 금지 |
| 최근 컨택 | 전화 부재, 1시간 전 | `contact_events` 최신 1건 |
| 고객 반응 | 가격 문의, 방문 희망, 관심 낮음 | 최신 반응 |
| 다음 액션 | 오늘 18:00 재전화 | 누락 방지 |
| CRM 연결 | 고객/예약/방문/결제 매칭 여부 | phone hash 기반 |

### 상세 패널

상세는 오른쪽 drawer 또는 모바일 bottom sheet로 연다. 표 안에서 모든 것을 편집하게 만들면 상담원이 놓치는 값이 많다.

| 탭 | 내용 | 구현 우선순위 |
|---|---|---:|
| 기본 정보 | 마스킹 이름/연락처, 나이대, 상담 목적, 신청 유형, 동의, 접수 시각 | 1 |
| 컨택 기록 | 전화/문자/카톡/채널톡 시도 이력, 결과, 고객 반응, 상담원 메모 | 1 |
| 다음 액션 | 재연락 시각, 담당자, 해야 할 일, 알림 후보 | 1 |
| 예약/방문/결제 | 자체 CRM 또는 개발팀 CRM의 예약, 방문, 사용, 결제 연결 | 2 |
| 유입/광고 | landing path, UTM, fbclid/fbc/fbp, Meta 이벤트, GA4 client id | 2 |
| 감사로그 | 원문 연락처 조회, 수정, export 이력 | 2 |

### 빠른 액션 버튼

상담원이 매번 긴 문장을 쓰지 않게 빠른 버튼을 둔다.

| 버튼 | 저장되는 결과 |
|---|---|
| 전화함 | channel `phone`, direction `outbound` |
| 문자함 | channel `sms`, direction `outbound` |
| 카톡함 | channel `kakao`, direction `outbound` |
| 채널톡 응대 | channel `channeltalk`, direction `inbound` 또는 `outbound` |
| 연결됨 | outcome `connected` |
| 부재 | outcome `no_answer` |
| 다시 연락 요청 | outcome `requested_callback`, nextAction 필수 |
| 가격 문의 | customerReaction `needs_price` |
| 방문 희망 | customerReaction `wants_visit` |
| 관심 낮음 | customerReaction `low_interest` |
| 예약 잡음 | outcome `reserved`, reservationAt 필수 |
| 제외 | outcome `invalid`, excludedReason 필수 |

## 4. 기록해야 하는 컨택/반응 값

고객에게 컨택했는지와 고객 반응은 반드시 별도 이벤트로 저장한다. 메모 1개를 계속 덮어쓰면 첫 통화 결과, 부재 시도, 재연락 약속이 사라진다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `eventId` | string | 예 | 컨택 이벤트 ID |
| `leadId` | string | 예 | 접수 리드 ID |
| `occurredAt` | datetime | 예 | 실제 컨택/기록 시각 |
| `operatorId` | string | 예 | 상담원/관리자 ID |
| `channel` | enum | 예 | `phone`, `sms`, `kakao`, `channeltalk`, `manual` |
| `direction` | enum | 예 | `outbound`, `inbound` |
| `attemptNo` | number | 자동 | 같은 리드의 컨택 시도 횟수 |
| `outcome` | enum | 예 | `connected`, `no_answer`, `busy`, `wrong_number`, `rejected`, `requested_callback`, `reserved`, `invalid` |
| `customerReaction` | enum | 권장 | `interested`, `needs_price`, `needs_schedule`, `skeptical`, `no_budget`, `no_time`, `wants_visit`, `not_interested`, `no_response` |
| `customerTemperature` | enum | 권장 | `hot`, `warm`, `cold`, `invalid` |
| `note` | text | 선택 | 상담원이 남기는 짧은 기록 |
| `nextAction` | enum | 조건부 | `call_again`, `send_kakao`, `schedule_visit`, `wait_customer`, `exclude`, `assign_manager` |
| `nextActionAt` | datetime | 조건부 | 재연락/예약/후속 조치 예정 시각 |
| `reservationAt` | datetime | 조건부 | 예약 잡은 경우 필수 |
| `createdAt` | datetime | 예 | 시스템 저장 시각 |

상태 전환 규칙은 아래처럼 둔다.

| 이벤트 조건 | 리드 상태 변경 |
|---|---|
| 신규 리드 생성 | `new` |
| 첫 컨택 시도, 아직 연결 안 됨 | `contact_attempted` |
| 연결됨, 예약은 아직 없음 | `contacted` |
| 예약 잡음 | `reserved` |
| 실제 방문 확인 | `visited` |
| 결제 확인 | `paid` |
| 3회 이상 부재 후 보류 | `contact_attempted`, nextAction 필수 |
| 잘못된 번호/중복/강한 거절 | `invalid_duplicate` 또는 `excluded` |

## 5. 백엔드 설계

초기 구현은 현재 Express 7020 API에 붙일 수 있다. 운영 이관 시에는 [[aibio-nestjs-skeleton]] 기준으로 NestJS `AibioLeadsModule`, `AuditModule`, `AttributionModule`로 옮긴다.

### 핵심 원칙

1. 리스트 API는 원문 이름/전화번호를 반환하지 않는다.
2. 원문 연락처 조회는 별도 API로 분리하고 `operatorId`, IP, userAgent를 감사로그에 남긴다.
3. 컨택 이벤트는 수정하지 않고 append-only로 쌓는다.
4. 리드의 현재 상태 요약은 최신 이벤트를 반영해 업데이트할 수 있다.
5. 광고/CRM 매칭은 원문 전화번호가 아니라 `phone_hash`를 기준으로 한다.

### 테이블 초안

#### `aibio_contact_leads`

현재 처리 상태를 빠르게 보여주는 요약 테이블이다. 이미 있는 `aibio_native_leads`를 확장하거나 view로 만들 수 있다.

| 컬럼 | 설명 |
|---|---|
| `leadId` | 자체 리드 ID |
| `sourceLeadId` | 아임웹/자체 폼/외부 수집 원본 ID |
| `formSource` | `imweb_v8_1`, `native`, `manual_import` |
| `formSubmittedAt` | 폼 제출 시각 |
| `phoneHash` | 정규화 전화번호 SHA256 |
| `maskedName` | 리스트용 마스킹 이름 |
| `maskedPhone` | 리스트용 마스킹 연락처 |
| `ageBucket` | 20대/30대 등 |
| `goals` | 상담 목적 배열 |
| `preferredContactType` | 전화/문자/카톡 등 신청 유형 |
| `sourcePath` | 랜딩 URL path |
| `utmSource`, `utmCampaign`, `utmContent` | 광고/유입 매칭 |
| `fbclid`, `fbc`, `fbp`, `gaClientId` | 측정 식별자 |
| `assignedTo` | 담당자 |
| `status` | 현재 리드 상태 |
| `priorityScore` | 처리 우선순위 |
| `lastContactedAt` | 마지막 컨택 시각 |
| `lastContactOutcome` | 마지막 결과 |
| `lastCustomerReaction` | 마지막 고객 반응 |
| `nextAction`, `nextActionAt` | 다음 행동 |
| `reservationAt`, `visitAt`, `paidAt` | CRM/센터 결과 |
| `excludedReason` | 제외 사유 |

#### `aibio_contact_events`

상담원이 남기는 컨택/반응 불변 로그다.

| 컬럼 | 설명 |
|---|---|
| `eventId` | 이벤트 ID |
| `leadId` | 리드 ID |
| `occurredAt` | 실제 컨택 시각 |
| `operatorId` | 상담원 ID |
| `channel` | phone/sms/kakao/channeltalk/manual |
| `direction` | inbound/outbound |
| `attemptNo` | 자동 계산 |
| `outcome` | 연결/부재/거절/예약 등 |
| `customerReaction` | 관심/가격문의/방문희망/거절 등 |
| `customerTemperature` | hot/warm/cold/invalid |
| `note` | 짧은 상담 메모 |
| `nextAction`, `nextActionAt` | 다음 행동 |
| `reservationAt` | 예약 잡은 시각 |
| `createdAt` | 시스템 저장 시각 |

#### `aibio_contact_tasks`

재연락 누락을 막기 위한 할 일 큐다.

| 컬럼 | 설명 |
|---|---|
| `taskId` | 할 일 ID |
| `leadId` | 리드 ID |
| `ownerId` | 담당자 |
| `taskType` | call_again/send_kakao/check_visit 등 |
| `dueAt` | 해야 하는 시각 |
| `status` | open/done/snoozed/canceled |
| `completedAt` | 완료 시각 |
| `reason` | 생성 이유 |

#### `aibio_contact_audit_log`

개인정보 조회와 민감한 수정 이력을 남긴다.

| 컬럼 | 설명 |
|---|---|
| `auditId` | 감사로그 ID |
| `operatorId` | 수행자 |
| `action` | view_contact/update_status/export/reassign |
| `leadId` | 대상 리드 |
| `targetField` | contact/status/note 등 |
| `ip` | 요청 IP |
| `userAgent` | 브라우저 |
| `createdAt` | 기록 시각 |

### API 초안

| Method | Endpoint | 용도 | PII 노출 |
|---|---|---|---|
| GET | `/api/aibio/contact-dashboard/summary?rangeDays=7` | 상단 요약 카드 | 없음 |
| GET | `/api/aibio/contact-dashboard/leads` | 리드 리스트, 필터/페이지네이션 | 마스킹만 |
| GET | `/api/aibio/contact-dashboard/leads/:leadId` | 상세 패널 기본 정보 | 마스킹만 |
| GET | `/api/aibio/contact-dashboard/leads/:leadId/contact` | 원문 연락처 조회 | 있음, 감사로그 필수 |
| GET | `/api/aibio/contact-dashboard/leads/:leadId/timeline` | 컨택/상태/CRM 타임라인 | 원문 없음 |
| POST | `/api/aibio/contact-dashboard/leads/:leadId/events` | 컨택/고객 반응 기록 | 요청 note 검증 |
| PATCH | `/api/aibio/contact-dashboard/leads/:leadId` | 담당자/상태/다음 액션 수정 | 원문 없음 |
| POST | `/api/aibio/contact-dashboard/leads/:leadId/tasks` | 재연락 할 일 생성 | 원문 없음 |
| GET | `/api/aibio/contact-dashboard/export` | 관리자용 CSV export | 권한 필요 |

### 요청 예시

```json
{
  "occurredAt": "2026-04-27T06:10:00.000Z",
  "operatorId": "staff_001",
  "channel": "phone",
  "direction": "outbound",
  "outcome": "connected",
  "customerReaction": "needs_price",
  "customerTemperature": "warm",
  "note": "가격과 소요 시간을 문의함. 카카오로 안내 자료 발송 요청.",
  "nextAction": "send_kakao",
  "nextActionAt": "2026-04-27T06:30:00.000Z"
}
```

### 검증 규칙

| 규칙 | 이유 |
|---|---|
| `operatorId`, `channel`, `outcome` 없으면 저장 거부 | 누가 무엇을 했는지 모르면 운영 로그가 아님 |
| `outcome=reserved`이면 `reservationAt` 필수 | 예약 수치 왜곡 방지 |
| `outcome=invalid`이면 `excludedReason` 필수 | 제외 기준 감사 가능 |
| `nextAction`이 있으면 `nextActionAt` 권장 | 재연락 누락 방지 |
| note는 1,000자 이하 | 민감정보 과다 입력 방지 |
| 리스트 응답에는 원문 전화번호 금지 | 개인정보 노출 최소화 |
| 원문 연락처 조회는 항상 audit log 기록 | 내부 조회 책임 추적 |

## 6. 광고/CRM 연결 설계

마케팅 관점에서는 폼 제출 수만 보면 안 된다. 광고별로 실제 상담 연결, 예약, 방문, 결제까지 이어졌는지 봐야 한다.

연결 키는 아래 순서로 둔다.

1. `form_submit.phone_hash`
2. `aibio_contact_leads.phoneHash`
3. AIBIO 센터 CRM `customer_id`
4. `reservation`, `visit`, `usage`, `payment`

즉, 원문 전화번호를 화면에 뿌리지 않아도 `phone_hash -> customer_id -> visit/reservation/usage/payment` 연결은 가능하다.

| 단계 | 데이터 | 판단 |
|---|---|---|
| 광고 유입 | Meta campaign/ad, UTM, fbc/fbp | 어떤 광고가 폼 제출을 만들었는지 |
| 폼 제출 | Lead 이벤트, form id, phone hash | 리드 생성 |
| 컨택 | contact event outcome | 실제 상담원이 처리했는지 |
| 고객 반응 | customerReaction, temperature | 리드 품질 |
| 예약 | reservationAt 또는 CRM 예약 | 방문 가능성 |
| 방문 | visit/usage | 실제 센터 도착 |
| 결제 | payment | 광고비 회수 |

채널톡 클릭은 리드로 바로 보지 않는다. `aibio_channeltalk_open`은 상담 의도 신호와 리타겟팅 신호로 본다. 이후 같은 사용자가 폼 제출하거나 예약/방문으로 이어지면 보조 전환으로 가치가 생긴다.

## 7. 현재 데이터 상태

아래 값은 2026-04-27 이전 점검 결과를 이 설계 문서에 반영한 참고값이다. 운영 판단 전에는 반드시 같은 window로 재조회해야 한다.

| 항목 | 값 |
|---|---|
| source | VM attribution ledger `https://att.ainativeos.net/api/attribution/ledger`, AIBIO Supabase |
| 기준 시각 | 2026-04-27 KST 이전 점검 |
| window | 2026-04-25 00:00 ~ 2026-04-27 23:59 KST |
| site | `aibio.ai` |
| 확인 내용 | 8.1 footer 이후 운영성 폼 제출 2건, debug/test 제외 3건, AIBIO Supabase customer match 0건 |
| freshness | 문서 작성 시점에 재조회하지 않은 이전 점검값 |
| confidence | 중간. ledger 수집은 확인됐지만 센터 CRM customer 연결은 아직 0건이라 운영 동기화 경로 확인 필요 |

## 8. Claude Code 프론트엔드 구현 지시

프론트엔드는 아래 컴포넌트 단위로 나눈다.

| 컴포넌트 | 역할 |
|---|---|
| `ContactDashboardPage` | 전체 route, query state, layout |
| `ContactSummaryCards` | 신규/오늘 연락/부재/예약/미처리 카드 |
| `LeadQueueTable` | 리드 리스트, 필터, 정렬, pagination |
| `LeadDetailDrawer` | 상세 패널 |
| `ContactEventComposer` | 컨택 결과와 고객 반응 기록 폼 |
| `ContactTimeline` | 컨택/상태/예약/방문/결제 타임라인 |
| `NextActionPanel` | 재연락 시각과 할 일 관리 |
| `AttributionBadge` | Meta/GA/UTM/채널톡 신호 요약 |
| `PiiRevealButton` | 원문 연락처 조회 버튼, 권한/감사로그 연결 |

UI 원칙은 아래로 둔다.

1. 리스트는 마스킹 정보만 보여준다.
2. 원문 연락처는 상세 패널에서 버튼을 눌러야 보인다.
3. 컨택 기록은 저장 후 수정하지 않고 타임라인에 쌓인다.
4. 상담원이 10초 안에 다음 행동을 알 수 있어야 한다.
5. 모바일에서는 리스트를 카드형으로 줄이고 상세는 bottom sheet로 연다.
6. 마케팅 담당자가 보는 모드는 개인정보 없이 집계만 보여준다.

빈 상태와 오류 상태도 만든다.

| 상태 | 문구 방향 |
|---|---|
| 리드 없음 | 선택한 조건에 접수 리드가 없습니다 |
| 권한 없음 | 이 정보는 관리자 권한이 필요합니다 |
| 원문 연락처 조회 불가 | 개인정보 조회 권한이 없습니다 |
| 데이터 지연 | CRM 연결 데이터가 아직 최신이 아닙니다 |
| 저장 실패 | 네트워크 문제로 저장하지 못했습니다. 다시 시도하세요 |

## 9. 운영 KPI

| KPI | 정의 | 목표 |
|---|---|---|
| 첫 컨택까지 걸린 시간 | 폼 제출부터 첫 contact event까지 | 영업시간 내 30분 이하 |
| 24시간 내 첫 컨택률 | 24시간 안에 첫 컨택이 기록된 리드 / 전체 리드 | 90% 이상 |
| 연결률 | outcome `connected` / 컨택 시도 리드 | 주간 추적 |
| 예약 전환율 | 예약확정 리드 / 연결 리드 | 광고별 비교 |
| 방문 전환율 | 방문완료 리드 / 예약확정 리드 | 상담 품질 판단 |
| 결제 전환율 | 결제완료 리드 / 방문완료 리드 | 센터 매출 판단 |
| 부재 2회 이상 | 컨택 시도 2회 이상이지만 연결 안 된 리드 | 매일 처리 |
| 제외율 | invalid/duplicate/rejected / 전체 리드 | 광고 품질 경고 |
| 상담원별 미처리 | 담당자별 open task 수 | 업무 배분 |

## 10. 역할 분담

| 담당 | 할 일 |
|---|---|
| TJ | 상태값, 고객 반응 enum, 상담 SLA, 개인정보 조회 권한 승인 |
| Codex | 백엔드 API, 스키마, 감사로그, phone hash 매칭, 검증 규칙 설계/구현 |
| Claude Code | 프론트엔드 route, 리스트/상세/timeline UX 구현 |
| 개발팀 CRM | customer_id, reservation, visit, usage, payment API 연결 |
| 상담원 | 실제 컨택 결과와 고객 반응 입력 |

## 11. 승인 포인트

운영 DB 스키마 변경 전 TJ 승인이 필요하다.

| 승인 항목 | 추천안 | 이유 |
|---|---|---|
| 고객 반응 enum | `interested`, `needs_price`, `needs_schedule`, `wants_visit`, `not_interested`, `no_response`부터 시작 | 너무 촘촘하면 상담원이 안 쓴다 |
| 원문 연락처 조회 권한 | 상담원은 자기 배정 리드만, 팀장은 전체 | 개인정보 노출 최소화 |
| 첫 컨택 SLA | 영업시간 내 30분, 비영업시간은 다음 영업 시작 후 30분 | 운영 현실과 광고비 효율 균형 |
| 컨택 로그 수정 | 수정 금지, 잘못 입력 시 정정 이벤트 추가 | 상담 이력 신뢰성 확보 |
| export 권한 | 팀장/owner만 허용 | 대량 개인정보 유출 방지 |

## 12. 연결 문서 반영

이 문서는 [[!imwebplan#Phase3-Sprint4]]의 `폼/예약/리드 원장`과 [[!imwebplan#Phase6-Sprint7]]의 `운영 관리자/RBAC` 사이를 잇는 상세 설계다.

`!imwebplan`에는 다음 문장으로 연결한다.

> 접수 폼 컨택 관리 대시보드는 `imweb/contactdashboard.md`를 정본으로 두며, 상담원이 고객에게 실제로 컨택했는지, 고객 반응이 어땠는지, 다음 액션이 무엇인지를 불변 로그로 남긴다.

## Phase1-Sprint1

**이름**: 접수함/우선순위

**목표**: 상담원이 오늘 처리해야 할 리드를 놓치지 않게 만든다.

**산출물**: summary API, lead list API, 필터, 우선순위 점수, 미처리 SLA 카드.

**검증**: 신규 리드와 오늘 연락 필요 리드를 원문 연락처 없이 볼 수 있다.

## Phase1-Sprint2

**이름**: 컨택/고객 반응 로그

**목표**: 고객에게 연락했는지, 고객이 어떤 반응을 보였는지 시간순으로 남긴다.

**산출물**: `aibio_contact_events`, event POST API, timeline UI, 빠른 액션 버튼.

**검증**: 전화 부재, 연결됨, 가격 문의, 방문 희망, 재연락 예약을 각각 저장하고 타임라인에서 구분해 볼 수 있다.

## Phase1-Sprint3

**이름**: 예약/방문/결제 연결

**목표**: 리드가 실제 센터 방문과 결제로 이어졌는지 본다.

**산출물**: phone hash 기반 `customer_id` 매칭, CRM 예약/방문/사용/결제 read API, attribution 리포트.

**검증**: 같은 phone hash의 폼 제출이 고객/예약/방문/결제와 연결되거나, 미연결 사유가 보인다.

## Phase1-Sprint4

**이름**: 개인정보/RBAC/감사로그

**목표**: 상담 운영에 필요한 연락처 조회는 허용하되, 누가 봤는지 추적한다.

**산출물**: raw contact API, `aibio_contact_audit_log`, 역할별 권한, export 제한.

**검증**: 리스트 API에는 원문 전화번호가 없고, 원문 조회마다 audit log가 남는다.

## Phase1-Sprint5

**이름**: 운영 KPI/리포트

**목표**: 광고비와 상담 운영이 실제 방문/결제로 이어지는지 매주 판단한다.

**산출물**: 첫 컨택 시간, 연결률, 예약률, 방문률, 결제율, 광고별 quality report.

**검증**: 캠페인별로 폼 제출 수가 같아도 상담 연결/방문/결제 품질 차이를 볼 수 있다.
