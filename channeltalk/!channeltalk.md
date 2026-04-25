# 채널톡급 자체 CRM 개발 검토

기준 시각: 2026-04-25 23:58 KST
대상: SEO 솔루션 저장소 `/Users/vibetj/coding/seo`
작성 목적: 현재 SEO/CRM 솔루션과 연계해 채널톡과 유사한 CRM 서비스를 바이브코딩 방식으로 자체 개발할 수 있는지 판단한다.

## 1. 한 줄 결론

가능하다. 다만 `채널톡 전체 복제`가 아니라, 현재 저장소가 이미 가진 데이터 원장, 실험 장부, 알림톡/SMS, 상담/주문/광고 귀속을 묶은 `자체 Revenue CRM`으로 접근해야 한다.

초기 전략은 채널톡을 즉시 제거하는 것이 아니라 다음 순서가 맞다.

1. 채널톡은 인바운드 채팅/운영 인박스로 유지한다.
2. 자체 CRM은 고객 세그먼트, 발송, 실험, 매출 귀속, 정책 게이트를 담당한다.
3. 채팅 로그와 유저 프로필을 채널톡 Open API/Webhook으로 끌어와 자체 원장에 흡수한다.
4. 자체 인박스/실시간 채팅은 운영 SLA, 개인정보, 알림, 권한 모델이 닫힌 뒤 별도 Phase로 만든다.

## 2. 프로젝트 구조 파악

### 2-1. 최상위 구조

현재 저장소는 단일 앱이 아니라 다중 업무 영역이 공존하는 workspace다.

| 경로 | 역할 |
|---|---|
| `frontend/` | Next.js CRM/SEO 대시보드. 로컬 포트 7010 |
| `backend/` | Express/TypeScript API 서버. 로컬 포트 7020 |
| `crm/`, `crmux/`, `phase3/`, `roadmap/` | CRM/발송/UX/로드맵 문서와 스크린샷 |
| `docs/` | 기능 명세, 프론트 문서, 아카이브 |
| `data/` | 광고 CSV, SQL, 분석 산출물 |
| `scripts/`, `backend/scripts/` | 백필, 동기화, 감사, 캡처 스크립트 |
| `imweb/`, `meta/`, `naver/`, `tiktok/`, `gdn/`, `coupang/` | 채널별 외부 연동 문서/산출물 |

### 2-2. 실행 구조

| 영역 | 스택 | 실행/검증 |
|---|---|---|
| 프론트 | Next.js 16, React 19, TypeScript | `npm --prefix frontend run dev`, `build`, `lint`, Playwright CRM 테스트 |
| 백엔드 | Express 5, TypeScript, SQLite/Postgres/Supabase/API clients | `npm --prefix backend run dev`, `build`, `typecheck` |
| 로컬 CRM DB | `better-sqlite3` 기반 `backend/data/crm.sqlite3` | 실험/고객/발송/주문/동의/그룹 원장 |

### 2-3. 현재 CRM 화면

`frontend/src/app/crm/page.tsx` 기준으로 이미 CRM 허브가 있다.

| 탭 | 역할 |
|---|---|
| 상담 후속 | 상담 완료/부재 후 액션 대상 |
| 실험 운영 | A/B 실험 생성, 배정, 전환 결과 |
| 알림톡 발송 | 알리고 알림톡/SMS 실행 UI |
| 결제 추적 | 유입, 결제, 토스 승인 대조 |
| 광고 성과/리드 관리 | AIBIO 광고 리드 흐름 |
| 구매 현황/재구매 관리 | 더클린커피 주문/재구매 |
| 고객 그룹/고객 목록/고객 행동 | 발송 대상, 세그먼트, 행동 조건 |
| 수신거부 처리 | 동의/수신거부 감사 |
| 사이트 비교 | 바이오컴/커피/AIBIO 비교 |

즉, 현재 솔루션은 이미 `CRM SaaS의 화면 골격`을 갖고 있다.

## 3. 현재 확보된 CRM 자산

### 3-1. 채널톡 연동

| 파일 | 현재 기능 |
|---|---|
| `frontend/src/components/common/ChannelTalkProvider.tsx` | ChannelTalk SDK 부트, 경로 변경 시 page 설정 |
| `frontend/src/lib/channeltalk.ts` | `boot`, `shutdown`, `setPage`, `track`, `updateUser`, `showMessenger`, `hideMessenger` 래퍼 |
| `backend/src/channeltalk.ts` | plugin key/access key/secret/member hash 상태 확인, member hash 생성, Open API health probe |
| `backend/src/routes/channeltalk.ts` | `/api/channeltalk/status`, `/health`, `/users-summary`, `/webhook`, `/webhooks`, contact policy API |

현재 수준은 `채널톡을 CRM 데이터 소스로 붙일 준비`까지 되어 있다. 프론트 SDK는 이벤트/프로필 업데이트 래퍼가 있고, 백엔드는 Open API credential 확인과 user-chat 기반 사용자 요약, Webhook JSONL 수신을 갖고 있다.

### 3-2. 자체 CRM 원장

`backend/src/crmLocalDb.ts`에 다음 계열의 테이블과 함수가 있다.

| 영역 | 주요 테이블/기능 |
|---|---|
| 실험 | `crm_experiments`, `crm_assignment_log`, `crm_conversion_log` |
| 발송 | `crm_message_log`, `crm_scheduled_send` |
| 고객 그룹 | `crm_customer_groups`, `crm_customer_group_members`, saved segment |
| 리드/동의 | `crm_lead_profile`, `crm_lead_event_log`, `crm_consent_log`, `crm_consent_change_log` |
| 아임웹 | `imweb_members`, `imweb_orders`, `imweb_order_items`, coupon tables |
| 결제/정산 | Toss transaction/settlement, refund dispatch log |
| 브랜드별 데이터 | AIBIO, Coffee, Coupang 계열 로컬 테이블 |

채널톡 같은 CRM에서 가장 비싼 부분은 `고객이 누구인지`, `어떤 세그먼트인지`, `무엇을 보냈는지`, `그 후 샀는지`를 같은 원장에서 보는 것이다. 이 저장소는 그 기반이 이미 있다.

### 3-3. 발송 채널

| 채널 | 현재 상태 |
|---|---|
| 알림톡 | `POST /api/aligo/send`, 템플릿 조회/생성/검수요청/이력/쿼터 |
| SMS | `POST /api/aligo/sms`, 알림톡 실패 시 SMS fallback 코드 존재 |
| 발송 정책 | `contactPolicy.ts`와 `/api/contact-policy/evaluate`, batch evaluate |
| 발송 이력 | `logs/aligo-sends.jsonl`, `crm_message_log`, `/api/crm-local/message-log` |

이 부분은 채널톡의 Marketing/Offsite 기능 중 `Kakao Notification`, `Text Message`, 성과 측정 일부를 자체화할 수 있는 근거다.

### 3-4. 상담/주문/귀속 데이터

| 영역 | 현재 상태 |
|---|---|
| 상담 | `GET /api/consultation/*` 읽기 전용 API 구현 |
| 주문 | 아임웹 주문/회원/쿠폰 sync API |
| 광고 | Meta/TikTok/Google Ads/GA4/GSC/CAPI 연동 흔적 |
| 귀속 | attribution ledger, 결제 추적, Toss reconciliation |

문서 기준으로 상담 CRM 명세는 `tb_consultation_records`, `tb_iamweb_users`, `ltr_customer_cohort`, `channeltalk_users`를 함께 보도록 설계되어 있다.

## 4. 채널톡 벤치마크

공식 자료 기준 채널톡의 핵심 제품 축은 다음과 같다.

| 축 | 채널톡 공식 기능 | 자체 개발 가능성 |
|---|---|---|
| Live Chat/Inbox | 웹 채팅, 옴니채널 응대, 프로필, 태그, 담당자 배정, 리포트 | 부분 가능. 실시간 인박스는 별도 대형 과제 |
| CRM Marketing | 세그먼트, 고객 정보, 온사이트/오프사이트 메시지, 알림톡/SMS/email, 발송-클릭-매출 측정 | 높음. 현재 원장/발송/귀속 자산과 잘 맞음 |
| Workflow | 트리거, 필터, 액션, 챗봇, 태그/담당자 자동화, 운영시간 | 중간. 룰 엔진부터 단계적 구현 가능 |
| AI Agent/문서 | FAQ 기반 자동 응답, 반복 문의 처리 | 중간. OpenAI 연동은 있으나 운영 안정성/평가 체계 필요 |
| Team Chat/Meet | 내부 메신저, 통화/영상, 녹취, 요약, 실시간 콜 지표 | 낮음. 초기 자체 개발 범위에서 제외 권장 |
| Security | member hash, MFA, activity log, 다운로드 이력 | 중간. 자체 제품화 시 RBAC/audit/log retention 필수 |
| Open API/Webhook | UserChat 목록/메시지 조회, Webhook 이벤트, SDK `track`/`updateUser` | 높음. 이미 일부 연동 코드 있음 |

판단: 우리 솔루션이 당장 이길 수 있는 곳은 `채팅 UX`가 아니라 `매출 귀속형 CRM 운영`이다. 채널톡은 범용 CX 도구이고, 이 솔루션은 이미 바이오컴/커피/AIBIO의 상담, 주문, 광고, 결제 데이터를 갖고 있다. 이 데이터 결합이 자체 CRM의 차별점이다.

## 5. 가능/불가능 구분

### 바로 가능한 것

1. 고객 세그먼트 빌더
   - 아임웹 회원/주문, 상담, 쿠폰, 광고 유입, 재구매 상태를 기준으로 그룹 생성
2. 알림톡/SMS 캠페인
   - 승인 템플릿 기반 발송, SMS fallback, 발송 로그, 쿨다운/동의/야간 발송 차단
3. 실험 기반 CRM
   - treatment/control 배정, 발송 여부, 주문 전환, 증분 매출 비교
4. 채널톡 데이터 흡수
   - UserChat 목록, 메시지, 사용자 프로필, Webhook 이벤트를 자체 원장으로 동기화
5. 운영자용 CRM 대시보드
   - `/crm` 기존 탭 확장으로 구현 가능

### 단계적으로 가능한 것

1. Workflow 룰 엔진
   - trigger/filter/action DSL을 SQLite/Postgres에 저장하고 batch/worker로 실행
2. 상담사 배정/태그 자동화
   - 채널톡 Open API를 쓰는 보조 자동화부터 시작
3. AI 상담 요약/FAQ 추천
   - 채팅 로그를 읽고 요약/태그/다음 액션 추천
4. 온사이트 개인화
   - Next.js 사이트와 ChannelTalk SDK `track` 이벤트를 자체 이벤트 원장에 동시 기록

### 초기에는 하지 말아야 할 것

1. 채널톡 인박스 전체 대체
   - 웹소켓, unread, 푸시, 파일, 관리자 권한, 모바일 앱, 장애 대응까지 필요하다.
2. 통화/영상/녹취/CTI 자체 개발
   - 비용과 운영 리스크가 크다.
3. 무검증 자동 대량 발송
   - 수신동의, 광고성 표시, 템플릿 exact-match, quiet hours, fallback 정책이 먼저다.
4. 운영 DB 스키마 변경부터 시작
   - 현재 지침상 사전 승인 필요. 초기에는 로컬/별도 CRM DB로 shadow 운영이 맞다.

## 6. 추천 아키텍처

### 6-1. 1단계 아키텍처

```text
웹/쇼핑몰/랜딩
  ├─ ChannelTalk SDK: 채팅, 사용자 식별, 이벤트 track
  ├─ 자체 tracking: GA4/CAPI/attribution ledger
  └─ 주문/상담/쿠폰/결제 이벤트

백엔드 7020
  ├─ ChannelTalk Open API/Webhook collector
  ├─ CRM segment/experiment/message APIs
  ├─ Aligo AlimTalk/SMS sender
  ├─ contact policy enforcement
  └─ attribution/revenue join

CRM DB
  ├─ users/profiles/identities
  ├─ chats/messages/events
  ├─ segments/groups
  ├─ campaigns/messages
  ├─ experiments/conversions
  └─ consent/audit/suppression

프론트 7010
  └─ /crm: 세그먼트, 실험, 메시지, 귀속, 상담 후속, 재구매 운영
```

### 6-2. 핵심 설계 원칙

1. `customer_id`는 단일 키로 강제하지 않는다.
   - `member_code`, phone hash, email hash, ChannelTalk userId/memberId, order id를 identity map으로 연결한다.
2. 발송 가능 여부는 UI가 아니라 백엔드 정책 엔진이 최종 판단한다.
3. 메시지는 항상 `campaign -> audience snapshot -> send attempt -> provider result -> conversion`으로 기록한다.
4. 채널톡 데이터는 source 중 하나일 뿐, 단일 정답으로 보지 않는다.
5. 운영 DB 쓰기 없이 시작하고, 자체 CRM DB에서 검증한 뒤 필요 시 승인받아 확장한다.

## 7. 단계별 구현안

### Phase A. 채널톡 연계 강화

목표: 채널톡을 버리지 않고, 자체 CRM 원장으로 흡수한다.

구현:

- `channeltalk_users`, `channeltalk_user_chats`, `channeltalk_messages`, `channeltalk_events` 로컬 테이블 추가
- `/api/channeltalk/sync-user-chats` 추가
- `/api/channeltalk/sync-messages?userChatId=...` 추가
- Webhook payload를 JSONL뿐 아니라 DB에 정규화 저장
- `memberId`, `memberHash`, `profile.mobileNumber`, `utm*`, `sourcePage`를 identity map에 연결

주의:

- DB 스키마 추가는 로컬 CRM DB부터 시작한다.
- 운영 DB 스키마 변경은 사전 승인 전까지 하지 않는다.

### Phase B. Revenue CRM MVP

목표: 채널톡 Marketing의 핵심을 자체 CRM 방식으로 구현한다.

구현:

- 세그먼트 조건 저장: 구매일, 구매금액, 재구매 여부, 상담 상태, 광고 소스, 동의 상태
- audience snapshot: 발송 시점의 대상자를 고정 저장
- campaign/message model: 채널, 템플릿, 목적, 실험 키, 비용, 상태
- 알림톡/SMS 배치 발송: 그룹 단위, throttle, retry, 실패 사유 집계
- 성과 join: 발송 후 N일 주문/상담/쿠폰 사용/재방문 매칭

이미 있는 기반:

- `crm_customer_groups`
- `crm_saved_segments`
- `crm_message_log`
- `crm_experiments`
- `/api/contact-policy/evaluate-batch`
- `/api/aligo/send`, `/api/aligo/sms`
- `/api/crm-local/message-log`

### Phase C. Workflow Lite

목표: 채널톡 Workflow의 핵심인 `트리거 -> 필터 -> 액션`을 CRM 운영용으로 제한 구현한다.

초기 룰 예시:

| Trigger | Filter | Action |
|---|---|---|
| 상담 완료 후 1일 | 미구매, SMS 동의, 최근 24시간 미발송 | 알림톡 후보 생성 |
| 커피 마지막 구매 후 30일 | 재구매 없음, SMS 동의 | 재구매 그룹 추가 |
| 채널톡 새 문의 | UTM source=meta, phone 있음 | 상담 후속 후보 태깅 |
| 장바구니/결제 시작 후 이탈 | 주문 없음 | 리마인드 캠페인 후보 |

초기에는 자동 발송이 아니라 `후보 생성 -> 운영자 승인 -> 발송`으로 둔다.

### Phase D. AI Assist

목표: 상담원/마케터를 대체하기보다 운영 판단을 빠르게 한다.

기능:

- 채팅/상담 요약
- 고객별 다음 액션 추천
- FAQ/문서 기반 답변 초안
- 세그먼트별 메시지 초안
- 실험 결과 해석과 다음 실험 제안

필수 조건:

- 요약 원문 링크
- hallucination 방지용 근거 표시
- 개인정보 마스킹
- 사람이 승인해야 발송되는 구조

### Phase E. 자체 인박스 검토

목표: 채널톡 의존도를 낮출지 판단한다.

자체 인박스가 필요한 조건:

- 채널톡 비용/제약이 커진다.
- 상담 데이터를 내부 정책상 외부 SaaS에 둘 수 없다.
- 외부 채팅보다 자체 workflow/AI/매출 귀속이 운영상 더 중요해진다.

그 전까지는 직접 만들지 않는 편이 낫다.

## 8. 주요 갭과 해결책

| 갭 | 현재 상태 | 해결책 |
|---|---|---|
| 고객 identity 통합 | 전화번호/member_code/ChannelTalk userId가 분리됨 | `crm_identity_map` 추가 |
| 채널톡 로그 정규화 | JSONL 수신, user summary 제한 | sync job + messages table |
| 실시간 인박스 | 없음 | 초기 제외, 채널톡 유지 |
| 배치 발송 안정성 | 단건/일부 배치 기반 | queue, throttle, retry, idempotency |
| 발송 비용/매출 측정 | 일부 가능 | campaign cost + conversion window 표준화 |
| 권한/RBAC | 대시보드 중심 | operator/admin/auditor 권한 분리 |
| 감사/컴플라이언스 | 일부 contact policy | audit log, suppression, export log 강화 |
| 다중 브랜드 | site 필드 일부 존재 | site-aware policy/campaign/segment 표준화 |

## 9. 데이터 모델 제안

초기에는 운영 DB가 아니라 `backend/data/crm.sqlite3` 또는 별도 Postgres shadow DB에서 시작한다.

```sql
crm_identity_map (
  identity_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  member_code TEXT,
  normalized_phone_hash TEXT,
  email_hash TEXT,
  channeltalk_user_id TEXT,
  channeltalk_member_id TEXT,
  created_at TEXT,
  updated_at TEXT
)

crm_campaigns (
  campaign_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  channel TEXT NOT NULL,
  template_code TEXT,
  status TEXT NOT NULL,
  experiment_key TEXT,
  created_at TEXT,
  updated_at TEXT
)

crm_audience_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  segment_id TEXT,
  total_count INTEGER NOT NULL,
  eligible_count INTEGER NOT NULL,
  created_at TEXT
)

crm_send_attempts (
  attempt_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  snapshot_id TEXT,
  identity_id TEXT,
  receiver_hash TEXT,
  channel TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  blocked_reason_json TEXT,
  sent_at TEXT,
  response_payload TEXT
)

crm_workflow_rules (
  rule_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  filter_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)
```

## 10. 바이브코딩 적합성

이 프로젝트는 바이브코딩으로 확장하기 좋다. 이유는 다음과 같다.

1. 이미 기능 단위가 작게 나뉘어 있다.
   - route, service, local DB, tab component가 분리되어 있어 작은 PR 단위로 확장 가능하다.
2. 검증 경로가 명확하다.
   - backend typecheck, frontend lint/build, Playwright CRM 테스트가 있다.
3. 운영 사고를 막는 게이트가 이미 있다.
   - contact policy, whitelist, testMode, adminOverride, message log가 있다.
4. 문서와 백업 파일이 많아 의사결정 추적이 가능하다.

단, 바이브코딩으로 하더라도 다음은 자동화보다 사람이 먼저 정해야 한다.

- 광고성/정보성 메시지 정책
- 수신동의 해석
- 운영자 권한
- 대량 발송 승인선
- 데이터 보존 기간
- 채널톡에서 자체 인박스로 넘어갈 조건

## 11. 권장 우선순위

### P0. 문서/설계 정리

- 이 문서를 기준으로 `Revenue CRM` 범위를 확정
- `채널톡 유지 + 자체 CRM 강화`를 1차 원칙으로 확정
- 개인정보/동의/발송 승인 정책 확정

### P1. 채널톡 데이터 sync

- UserChat 목록/메시지 sync
- Webhook DB 정규화
- memberId/memberHash 적용 검토

### P2. 캠페인 원장

- campaign/audience/send attempt 모델 추가
- 기존 `crm_message_log`와 호환
- 발송 비용과 conversion window 저장

### P3. 세그먼트/그룹 운영 고도화

- segment DSL을 UI에서 저장/재사용
- audience snapshot 고정
- 배치 발송 retry/idempotency

### P4. 성과 분석

- 발송 후 1일/3일/7일/14일 주문, 상담, 쿠폰, 재방문 성과 join
- treatment/control 기반 incrementality report

### P5. Workflow Lite

- 후보 생성형 자동화
- 운영자 승인 후 발송

### P6. AI Assist

- 상담/채팅 요약
- 답변 초안
- 메시지 초안
- 실험 해석

## 12. 의사결정

Go를 권장한다. 단, 제품 목표는 다음 문장으로 제한해야 한다.

> 채널톡을 대체하는 범용 상담 SaaS가 아니라, 채널톡/아임웹/알리고/광고/결제 데이터를 결합해 매출과 재구매를 만드는 자체 Revenue CRM을 만든다.

이 방향이면 현재 솔루션의 데이터 자산을 그대로 살릴 수 있다. 반대로 “채널톡과 똑같은 인박스/팀챗/통화/AI 상담 전체를 복제”로 잡으면 비용 대비 위험이 크다.

## 13. 검증 계획

| 단계 | 검증 |
|---|---|
| 구조 검증 | `npm --prefix backend run typecheck`, `npm --prefix frontend run lint` |
| API 검증 | `/api/channeltalk/health`, `/api/channeltalk/users-summary`, `/api/crm-local/message-log` |
| 발송 검증 | testMode/화이트리스트 발송, policy block 확인 |
| 데이터 검증 | source, 기준 시각, window, site, freshness, confidence 포함 |
| UI 검증 | Playwright CRM smoke/full flow |
| 운영 검증 | dry-run -> small batch -> monitored live send |

## 14. 숫자/근거 기록

| 항목 | 값 | Source | 기준 시각/문서일 | Freshness | Confidence |
|---|---:|---|---|---|---|
| 프론트 포트 | 7010 | 루트 `AGENTS.md` | 2026-04-25 확인 | 높음 | 높음 |
| 백엔드 포트 | 7020 | 루트 `AGENTS.md` | 2026-04-25 확인 | 높음 | 높음 |
| 상담 원장 건수 | 8,305 | `docs/feature/spec-consultation-crm-readonly-1.0.md` | 2026-03-27 문서 | 중간 | 중간, DB 직접 재검증 필요 |
| 상담 연락처-LTR 매칭 | 5,055 | `docs/feature/spec-consultation-crm-readonly-1.0.md` | 2026-03-27 문서 | 중간 | 중간, DB 직접 재검증 필요 |
| ChannelTalk UserChat API limit | 1-500 | ChannelTalk Developers `List of UserChats` | 2026-04-25 조회 | 높음 | 높음 |
| ChannelTalk messages API limit | 1-500 | ChannelTalk Developers `Get a UserChat's messages` | 2026-04-25 조회 | 높음 | 높음 |

## 15. 참고 자료

### 로컬 코드/문서

- `AGENTS.md`
- `frontend/package.json`
- `backend/package.json`
- `frontend/src/app/crm/page.tsx`
- `frontend/src/lib/channeltalk.ts`
- `frontend/src/components/common/ChannelTalkProvider.tsx`
- `backend/src/channeltalk.ts`
- `backend/src/routes/channeltalk.ts`
- `backend/src/routes/aligo.ts`
- `backend/src/routes/crmLocal.ts`
- `backend/src/crmLocalDb.ts`
- `backend/src/contactPolicy.ts`
- `docs/feature/spec-consultation-crm-readonly-1.0.md`
- `crm/0404/repurchase-plan.md`
- `crm/0404/sms-plan.md`
- `crmux/0410/group-messaging-plan.md`

### 공식 외부 자료

- ChannelTalk Marketing: https://channel.io/en/marketing
- ChannelTalk Workflow: https://channel.io/en/workflow
- ChannelTalk Live Chat: https://channel.io/en/user-chat
- ChannelTalk Developers - ChannelIO SDK: https://developers.channel.io/en/articles/ChannelIO-0b119290
- ChannelTalk Developers - List of UserChats: https://developers.channel.io/en/articles/List-of-UserChats-a7e8e5d1
- ChannelTalk Developers - Get UserChat messages: https://developers.channel.io/en/articles/738ccde7
- ChannelTalk Developers - Webhook events: https://developers.channel.io/docs/webhook-events
- ChannelTalk Security Settings: https://docs.channel.io/help/en/articles/Security-Settings--feb16f73
