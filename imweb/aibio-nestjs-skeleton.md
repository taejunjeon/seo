# AIBIO NestJS Skeleton 적용 범위

작성 시각: 2026-04-26 23:55 KST
기준일: 2026-04-26
대상: AIBIO 자체 홈페이지, 리드/예약 원장, 관리자, 결제, 전환 추적 API
작성 목적: AIBIO를 전사 통합 플랫폼의 첫 모듈로 볼 경우 NestJS를 어디까지 적용할지 정하고, 현재 Express 7020 기능을 언제까지 유지할지 고정한다.
문서 작성 규칙: `docurule.md` v4 기준. 실행 단계는 `무엇/왜/어떻게/산출물/검증/담당`을 모두 적고, TJ 승인 요청은 추천안·대안·자신감·YES/NO 답변 형식으로 제시한다.

## 10초 요약

NestJS skeleton은 만들 수 있다. 다만 지금 바로 Express 7020을 전부 NestJS로 바꾸면 리드 원장 실운영화가 늦어진다. 추천은 `기존 Express는 리드/관리자 MVP 유지`, `신규 인증/RBAC/감사로그/결제는 NestJS-first`다. 이렇게 하면 2~3일 뒤 팀 리뷰와 자체 리드 원장 검증은 계속 진행하면서, 전사 통합 백엔드의 골격도 같이 준비할 수 있다.

## 결론

추천안 A를 기준으로 진행한다.

| 구분 | 판단 | 이유 | 자신감 |
|---|---|---|---:|
| 기존 Express 7020 전체 유지 | 단기 유지 | 현재 AIBIO native lead, admin, content, form export 분석이 이미 붙어 있고 테스트도 있다. | 86% |
| NestJS 신규 skeleton 병행 | 권장 | 인증, 권한, 감사로그, 결제, OpenAPI 계약은 NestJS 구조가 장기 운영에 맞다. | 82% |
| 즉시 전체 이관 | 비권장 | 팀 리뷰 전 리드/관리자 기능을 흔들면 30일 병행 운영 준비가 늦어진다. | 88% |
| Next.js API Routes 확대 | 비권장 | 권한 체크, 결제 승인, webhook, 감사로그가 분산되기 쉽다. | 84% |

TJ님이 YES/NO로 답해야 하는 질문은 하나다.

| 질문 | Codex 추천 | TJ님 답변 형식 |
|---|---|---|
| AIBIO를 전사 플랫폼 첫 모듈로 보고 NestJS skeleton을 병행할까? | YES. 단, 현재 Express 리드 원장은 유지하고 신규 RBAC/결제부터 NestJS 후보로 둔다. | `YES: NestJS skeleton 병행` 또는 `NO: AIBIO는 Express MVP 우선` |

## 지금 만들 범위

이번 문서의 skeleton은 `코드 생성 전 설계 골격`이다. NestJS 프로젝트를 바로 만들 수도 있지만, 지금은 DB 스키마 변경과 패키지 구조 변경 없이 문서로 경계를 먼저 닫는다.

| 범위 | 지금 할 일 | 지금 하지 않을 일 |
|---|---|---|
| 모듈 경계 | 어떤 API를 어떤 module로 묶을지 정한다. | Express route 전체를 삭제하지 않는다. |
| 권한 구조 | 역할, 권한, guard 적용 지점을 정한다. | 실제 운영 계정 DB를 만들지 않는다. |
| 결제 구조 | Toss checkout/confirm/webhook 책임을 정한다. | AIBIO 실결제 API key를 커밋하지 않는다. |
| 이관 순서 | Express 유지 범위와 NestJS 신규 후보를 분리한다. | 팀 리뷰 전 운영 배포를 바꾸지 않는다. |

## 권장 백엔드 배치

```text
Next.js 7010
  ├─ AIBIO 공개 홈페이지
  ├─ /shop_view?idx=25 첫 실험 랜딩
  ├─ 관리자 화면 /aibio-native/admin/*
  └─ API 호출 client

Express 7020
  ├─ 현재 AIBIO native lead/admin/content/form 분석 API 유지
  ├─ 기존 SEO/CRM/Toss 조회/Attribution API 유지
  └─ 팀 리뷰와 로컬 검증이 끝날 때까지 안정판 역할

NestJS 신규 API
  ├─ Auth/RBAC/Audit
  ├─ AIBIO lead/reservation/payment 신규 계약
  ├─ Toss checkout/confirm/webhook
  ├─ Attribution/Reports
  └─ 추후 biocom/thecleancoffee까지 확장
```

## NestJS Module Boundary

| Module | 무엇을 담당하는가 | 왜 필요한가 | 첫 산출물 |
|---|---|---|---|
| `CoreModule` | config, logger, health, CORS, rate limit, request id | 모든 API의 공통 품질을 맞춘다. | `/health`, global error filter |
| `AuthModule` | 관리자 로그인, JWT/session, 임시 token bridge | `AIBIO_NATIVE_ADMIN_TOKEN`을 장기 운영 auth로 바꾸기 위한 입구다. | login/session 계약 |
| `UsersModule` | 운영자 계정, 활성 여부, 프로필 | 상담원, 디자이너, 마케터를 사용자 단위로 관리한다. | operator CRUD |
| `RbacModule` | 역할/권한, `@Roles`, `@SiteAccess` guard | 원문 연락처, 결제, 콘텐츠 편집 권한을 분리한다. | role policy map |
| `AuditModule` | 원문 연락처 조회, 상태 변경, 콘텐츠 수정, 결제 조작 로그 | 개인정보와 결제 action은 누가 했는지 남겨야 한다. | audit log schema |
| `AibioLeadsModule` | 자체 상담폼 저장, 리드 상태, 담당자/메모, funnel | Phase3의 핵심 원장이다. | lead controller/service |
| `AibioReservationsModule` | 예약일, 방문일, 노쇼, 방문완료 | 리드가 실제 방문까지 갔는지 본다. | reservation 상태 모델 |
| `AibioContentModule` | 랜딩 문구, CTA, 이미지, 상세페이지 편집 | 디자이너/개발자가 코드 없이 페이지를 고친다. | content page API |
| `AibioFormsModule` | 아임웹 입력폼 export 분석, dry-run import | 30일 병행 운영의 누락/중복 기준을 만든다. | form export parser |
| `PaymentsModule` | Toss checkout, confirm, cancel, webhook, reconcile | 결제와 매출 귀속을 자체로 닫는다. | `TossPaymentsService` |
| `AttributionModule` | UTM, fbclid, gclid, `_fbc`, `_fbp`, `_ga`, referrer | 광고 클릭부터 리드/결제까지 이어 붙인다. | attribution event API |
| `ReportsModule` | 주간 funnel, 유입/랜딩/상태/결제 report | 광고비 의사결정용 화면을 만든다. | weekly funnel report |
| `IntegrationsModule` | Imweb, Meta CAPI, GA4, ChannelTalk, Kakao, Aligo | 외부 도구를 한곳에서 관리한다. | integration clients |

## 권장 폴더 Skeleton

NestJS를 코드로 만들 때는 아래 중 하나를 고른다. 현 저장소 구조에서는 `backend-nest/`가 가장 덜 위험하다.

```text
backend-nest/
  src/
    main.ts
    app.module.ts
    common/
      decorators/
        public.decorator.ts
        roles.decorator.ts
        site-access.decorator.ts
      filters/
        api-error.filter.ts
      guards/
        auth.guard.ts
        roles.guard.ts
        site-access.guard.ts
      interceptors/
        request-id.interceptor.ts
      pipes/
        zod-validation.pipe.ts
    config/
      env.schema.ts
      app.config.ts
    core/
      health.controller.ts
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
    users/
      users.module.ts
    rbac/
      rbac.module.ts
      policies.ts
    audit/
      audit.module.ts
    aibio/
      leads/
      reservations/
      content/
      forms/
    payments/
      toss/
    attribution/
    reports/
    integrations/
      imweb/
      meta/
      ga4/
      channeltalk/
      kakao/
      aligo/
```

## API 분류표

Source: 2026-04-26 23:55 KST `backend/src/routes/aibio.ts`, `backend/src/routes/toss.ts`, `backend/src/routes/attribution.ts` route scan.

| 현재 API | 현재 역할 | 단기 처리 | NestJS 목표 Module |
|---|---|---|---|
| `GET /api/aibio/content/:slug` | 랜딩 콘텐츠 조회 | Express 유지 | `AibioContentModule` |
| `PATCH /api/aibio/admin/content/:slug` | 랜딩 콘텐츠 수정 | Express 유지, token 보호 | `AibioContentModule` + `AuditModule` |
| `GET /api/aibio/admin/access` | 운영자 권한 명부 조회 | Express 유지 | `UsersModule` + `RbacModule` |
| `PUT /api/aibio/admin/access` | 운영자 권한 명부 저장 | Express 유지, token 보호 | `UsersModule` + `RbacModule` + `AuditModule` |
| `POST /api/aibio/admin/form-export/analyze` | 아임웹 입력폼 엑셀 분석 | Express 유지 | `AibioFormsModule` |
| `POST /api/aibio/admin/assets` | 이미지 업로드 | Express 유지 | `AibioContentModule` |
| `GET /api/aibio/assets/:filename` | 업로드 이미지 제공 | Express 유지 | `AibioContentModule` |
| `POST /api/aibio/native-leads` | 자체 상담폼 저장 | Express 유지, 팀 리뷰 핵심 | `AibioLeadsModule` |
| `GET /api/aibio/native-leads` | 운영자 리드 목록 | Express 유지 | `AibioLeadsModule` |
| `GET /api/aibio/native-leads/funnel` | 주간 funnel | Express 유지 | `ReportsModule` |
| `GET /api/aibio/native-leads/fallback-comparison` | 아임웹 병행 대조 | Express 유지 | `ReportsModule` + `AibioFormsModule` |
| `PATCH /api/aibio/native-leads/:leadId/status` | 상태/담당자/메모/예약일/방문일 변경 | Express 유지, token 보호 | `AibioLeadsModule` + `AuditModule` |
| `GET /api/aibio/native-leads/:leadId/contact` | 원문 연락처 조회 | Express 유지, token 보호 | `AibioLeadsModule` + `AuditModule` |
| `GET /api/aibio/ad-crm-attribution` | 광고-CRM 귀속 조회 | Express 유지 | `AttributionModule` + `ReportsModule` |
| `GET /api/aibio/stats` | AIBIO 통계 | Express 유지 | `ReportsModule` |
| `POST /api/aibio/sync-customers` | AIBIO 고객 sync | Express 유지 | `IntegrationsModule` |
| `POST /api/aibio/sync-payments` | AIBIO 결제 sync | Express 유지 | `IntegrationsModule` + `PaymentsModule` |
| `POST /api/aibio/sync-all` | AIBIO 전체 sync | Express 유지 | `IntegrationsModule` |
| `GET /api/aibio/tier-distribution` | 고객 등급 분포 | Express 유지 | `ReportsModule` |
| `GET /api/toss/transactions` | Toss 거래 조회 | Express 유지 | `PaymentsModule` read adapter |
| `GET /api/toss/settlements` | Toss 정산 조회 | Express 유지 | `PaymentsModule` read adapter |
| `GET /api/toss/payments/orders/:orderId` | Toss order 조회 | Express 유지 | `PaymentsModule` read adapter |
| `GET /api/toss/daily-summary` | Toss 일별 요약 | Express 유지 | `PaymentsModule` read adapter |
| `POST /api/toss/sync` | Toss sync | Express 유지 | `PaymentsModule` reconcile |
| `GET /api/toss/local-stats` | local Toss 통계 | Express 유지 | `ReportsModule` |
| `POST /api/attribution/form-submit` | 폼 제출 귀속 | Express 유지 | `AttributionModule` |
| `POST /api/attribution/checkout-context` | 결제 전 귀속 context | Express 유지 | `AttributionModule` |
| `POST /api/attribution/payment-success` | 결제 성공 귀속 | Express 유지 | `AttributionModule` |
| `GET /api/attribution/ledger` | attribution ledger 조회 | Express 유지 | `AttributionModule` |

## NestJS-first로 새로 만들 API

아래는 기존 Express에 없거나, 운영 보안상 NestJS에서 새로 시작하는 편이 낫다.

| 신규 API | 왜 NestJS-first인가 | 담당 Module |
|---|---|---|
| `POST /api/auth/login` | token 입력식 관리자 보호를 정식 로그인으로 바꾼다. | `AuthModule` |
| `POST /api/auth/logout` | 관리자 세션 종료가 필요하다. | `AuthModule` |
| `GET /api/me` | 현재 사용자와 사이트 권한을 UI가 알아야 한다. | `AuthModule` + `UsersModule` |
| `GET /api/admin/users` | 운영자 계정 목록을 파일이 아니라 DB로 관리한다. | `UsersModule` |
| `PATCH /api/admin/users/:id/roles` | owner만 역할을 바꾼다. | `UsersModule` + `RbacModule` + `AuditModule` |
| `GET /api/audit/logs` | 원문 연락처 조회/상태 변경/콘텐츠 수정 이력을 본다. | `AuditModule` |
| `POST /api/payments/toss/orders` | 결제 전 주문 초안을 만든다. | `PaymentsModule` |
| `POST /api/payments/toss/confirm` | Toss 승인 전 금액과 orderId를 서버에서 검증한다. | `PaymentsModule` |
| `POST /api/payments/toss/webhook` | 결제 상태 변경을 서버가 받는다. | `PaymentsModule` |
| `POST /api/payments/toss/cancel` | 취소/환불은 권한과 감사로그가 필요하다. | `PaymentsModule` + `AuditModule` |
| `GET /api/reports/aibio/weekly-funnel` | 리드, 예약, 방문, 결제 funnel을 주간 기준으로 본다. | `ReportsModule` |

## 데이터 모델 Skeleton

DB 스키마 변경은 TJ님 사전 승인 대상이다. 아래는 승인 전 설계 초안이다.

| 테이블 | 핵심 필드 | 목적 |
|---|---|---|
| `sites` | `id`, `site_key`, `name`, `status` | `aibio`, 추후 `biocom`, `thecleancoffee` 분리 |
| `users` | `id`, `email`, `name`, `status`, `last_login_at` | 운영자 계정 |
| `site_memberships` | `site_id`, `user_id`, `role` | 사이트별 권한 |
| `role_permissions` | `role`, `permission` | 권한표 버전 관리 |
| `audit_logs` | `actor_id`, `site_key`, `action`, `resource_type`, `resource_id`, `ip`, `created_at` | 민감 action 기록 |
| `aibio_leads` | `id`, `site_key`, `name_encrypted`, `phone_encrypted`, `phone_hash`, `status`, `landing_path`, `created_at` | 자체 리드 원장 |
| `aibio_lead_status_logs` | `lead_id`, `from_status`, `to_status`, `actor_id`, `memo`, `created_at` | 상태 변경 이력 |
| `aibio_reservations` | `lead_id`, `reservation_at`, `visit_at`, `no_show_reason` | 예약/방문/노쇼 |
| `aibio_content_pages` | `slug`, `version`, `content_json`, `updated_by` | 상세페이지 편집 |
| `aibio_assets` | `id`, `filename`, `mime_type`, `size`, `uploaded_by` | 이미지 업로드 |
| `aibio_form_exports` | `source_file_hash`, `row_count`, `field_map_json`, `analyzed_at` | 아임웹 입력폼 대조 |
| `orders` | `id`, `site_key`, `lead_id`, `order_no`, `amount`, `status` | 체험권/예약금 주문 |
| `payments` | `id`, `order_id`, `provider`, `payment_key`, `amount`, `status` | Toss 결제 |
| `payment_events` | `payment_id`, `event_type`, `payload_hash`, `received_at` | webhook/reconcile |
| `attribution_events` | `site_key`, `lead_id`, `order_id`, `utm_json`, `click_ids_json`, `client_ids_json`, `created_at` | 광고/유입 귀속 |

## 권한 Matrix

권한명은 code에서 영어로 두고, 화면에는 한국어 설명을 붙인다.

| 권한 | owner | manager | marketer | designer | viewer |
|---|---:|---:|---:|---:|---:|
| 리드 목록 보기 | 허용 | 허용 | 허용 | 금지 | 허용 |
| 원문 연락처 조회 | 허용 | 허용 | 금지 | 금지 | 금지 |
| 리드 상태 변경 | 허용 | 허용 | 금지 | 금지 | 금지 |
| 담당자/메모 수정 | 허용 | 허용 | 금지 | 금지 | 금지 |
| 주간 funnel 보기 | 허용 | 허용 | 허용 | 금지 | 허용 |
| 상세페이지 편집 | 허용 | 조건부 | 금지 | 허용 | 금지 |
| 이미지 업로드 | 허용 | 조건부 | 금지 | 허용 | 금지 |
| 입력폼 export 분석 | 허용 | 허용 | 허용 | 금지 | 금지 |
| 결제 조회 | 허용 | 허용 | 금지 | 금지 | 금지 |
| 결제 취소/환불 | 허용 | 조건부 | 금지 | 금지 | 금지 |
| 운영자 권한 변경 | 허용 | 금지 | 금지 | 금지 | 금지 |
| 감사로그 조회 | 허용 | 조건부 | 금지 | 금지 | 금지 |

## API 응답 계약

NestJS로 신규 API를 만들 때는 성공/실패 응답을 고정한다. 프론트는 이 계약만 보고 에러를 처리한다.

```json
{
  "ok": true,
  "version": "2026-04-26",
  "generatedAt": "2026-04-26T14:55:00.000Z",
  "data": {}
}
```

```json
{
  "ok": false,
  "generatedAt": "2026-04-26T14:55:00.000Z",
  "error": {
    "code": "AIBIO_CONTACT_FORBIDDEN",
    "message": "원문 연락처를 볼 권한이 없습니다.",
    "details": {},
    "requestId": "req_..."
  }
}
```

## 실행 단계

| 순서 | 담당 | 무엇 | 왜 | 어떻게 | 산출물 | 검증 |
|---:|---|---|---|---|---|---|
| 1 | Codex | NestJS 적용 범위 문서화 | 팀 리뷰 전 프레임워크 논쟁으로 개발이 멈추지 않게 한다. | 현재 Express route를 module별로 분류한다. | 이 문서 | 모든 API가 유지/이관/신규 중 하나로 분류된다. |
| 2 | Codex | Express 유지 범위 고정 | Phase3 리드 원장 실운영이 늦어지면 안 된다. | AIBIO native lead/admin/content/form API를 단기 유지로 표시한다. | API 분류표 | 팀 리뷰에 필요한 API가 Express 유지로 남아 있다. |
| 3 | TJ | NestJS 병행 여부 승인 | 전사 플랫폼으로 볼지 AIBIO 단독 MVP로 볼지에 따라 개발비가 달라진다. | `YES: NestJS skeleton 병행` 또는 `NO: AIBIO는 Express MVP 우선`으로 답한다. | 방향 결정 | `!imwebplan.md`에 승인 결과가 기록된다. |
| 4 | Codex | 승인 후 코드 skeleton 생성 | 새 결제/RBAC를 넣을 위치가 필요하다. | `backend-nest/` 또는 `apps/api-nest/` 중 하나로 NestJS 최소 앱을 만든다. | health/config/rbac stub | `npm test` 또는 `npm run build` 통과 |
| 5 | Codex | `.env.example` 항목 분리 | secret 누락과 이름 혼선을 줄인다. | `AIBIO_*`, `TOSS_*`, `AUTH_*` env 이름표를 만든다. | env naming table | secret 값이 커밋되지 않는다. |
| 6 | Claude Code | Admin UI 권한 표시 검토 | 화면에서 역할 차이를 이해해야 한다. | 역할별 버튼 노출/비활성 문구를 검토한다. | UI 리뷰 메모 | viewer가 원문 연락처를 볼 수 없어야 한다. |

## 이관 순서

| 단계 | 내용 | 운영 영향 |
|---:|---|---|
| 0 | 현재 Express AIBIO MVP 유지 | 없음 |
| 1 | NestJS skeleton만 추가: health, config, error filter, guard stub | 없음 |
| 2 | Auth/RBAC/Audit 먼저 구현 | 관리자 token 방식에서 정식 로그인으로 이동 준비 |
| 3 | AIBIO content/forms/leads를 read-only adapter로 mirror | 데이터 쓰기 영향 없음 |
| 4 | Toss AIBIO checkout/confirm/webhook을 NestJS에 신규 구현 | 체험권/예약금 테스트 결제 가능 |
| 5 | 30일 병행 운영과 팀 리뷰 후 lead write API 이관 판단 | 운영 리드 원장 영향 있음, 별도 승인 필요 |

## 지금 부족한 데이터

| 부족한 데이터 | 왜 필요한가 | 누가 확보하나 |
|---|---|---|
| AIBIO Toss MID/API key 발급 여부 | 결제 module을 실제로 만들 수 있는지 결정한다. | TJ |
| 운영자 실제 명단과 역할 | RBAC seed를 만든다. | TJ + 팀 |
| 원문 연락처 암호화 방식 결정 | 운영 DB 저장 시 보안 기준이 필요하다. | Codex 제안 후 TJ 승인 |
| 운영 DB 선택 | SQLite/local file에서 운영 DB로 갈 때 migration 방식이 달라진다. | TJ + Codex |
| 팀 리뷰 피드백 | 상담원/디자이너가 실제로 쓸 수 있는지 확인한다. | TJ + 팀 |

## 데이터 정확성 기록

| 항목 | Source | 기준 시각 | Window | Site | Freshness | Confidence |
|---|---|---|---|---|---|---|
| 프론트 포트 7010 | `AGENTS.md` | 2026-04-26 확인 | 현재 설정 | all | 높음 | 높음 |
| 백엔드 포트 7020 | `AGENTS.md` | 2026-04-26 확인 | 현재 설정 | all | 높음 | 높음 |
| AIBIO native route 목록 | `backend/src/routes/aibio.ts` route scan | 2026-04-26 23:55 KST | 로컬 코드 기준 | aibio | 높음 | 높음 |
| Toss route 목록 | `backend/src/routes/toss.ts` route scan | 2026-04-26 23:55 KST | 로컬 코드 기준 | biocom/coffee 중심 | 높음 | 높음 |
| Attribution route 목록 | `backend/src/routes/attribution.ts` route scan | 2026-04-26 23:55 KST | 로컬 코드 기준 | all | 높음 | 높음 |
| AIBIO Toss store 미등록 | `backend/src/tossConfig.ts` | 2026-04-26 23:55 KST | 로컬 코드 기준 | aibio | 높음 | 높음 |
| NestJS 권장 판단 | 현재 코드 구조와 개발팀 의견 | 2026-04-26 23:55 KST | 설계 판단 | all | 중간 | 82% |
