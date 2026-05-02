# seo 프로젝트 · 로컬 CLAUDE.md

상위 규칙은 `~/coding/CLAUDE.md`를 따르고, 이 파일은 seo 프로젝트 고유 맥락을 기록한다.

## 프로젝트 맥락

- **프론트엔드**: Next.js 16 · `frontend/` · 포트 **7010**
- **백엔드**: Express + tsx · `backend/` · 포트 **7020**
- **도메인**: 바이오컴 그룹 (바이오컴 건기식 / 더클린커피 / AIBIO 리커버리랩) CRM·광고·매출 통합 관리

## 참조 문서 (핵심)

작업 전 필요한 맥락은 아래 문서로 먼저 확인한다.

- [harness/common/HARNESS_GUIDELINES.md](./harness/common/HARNESS_GUIDELINES.md) — Growth Data/Tracking/Attribution/ROAS 작업 공통 하네스. 작업 시작 전 Green / Yellow / Red Lane 분류 기준
- [harness/common/AUTONOMY_POLICY.md](./harness/common/AUTONOMY_POLICY.md) — Green은 자율 진행, Yellow는 스프린트 1회 승인 후 자율, Red는 명시 승인 전 중단
- [harness/common/REPORTING_TEMPLATE.md](./harness/common/REPORTING_TEMPLATE.md) — Auditor verdict, source/window/freshness/confidence, 완료 보고/승인 요청 공통 형식
- [data/dbstructure.md](./data/dbstructure.md) — 전사 DB 구조 (원격 PG + AIBIO Supabase + 로컬 SQLite) · 채널 매핑 · 통합 키 전략
- [aibio/aibiodb.md](./aibio/aibiodb.md) — AIBIO Supabase 43개 테이블 스키마 덤프
- [aibio/aibio_sync_design.md](./aibio/aibio_sync_design.md) — AIBIO → 로컬 SQLite sync 설계 및 구현 진척
- [aibio/aibio_revenue_reconciliation.md](./aibio/aibio_revenue_reconciliation.md) — 대시보드 vs DB 매출 정합성 분석
- [coffee/coffeevip.md](./coffee/coffeevip.md) — 바이오컴 × 커피 통합 VIP 멤버십 전략 · 금액대 근거
- [coffee/member.md](./coffee/member.md) — 더클린커피 회원수 정합성 리포트
- [coupang/coupangapi.md](./coupang/coupangapi.md) — 쿠팡 Wing Open API 연동 가이드 (BIOCOM + TEAMKETO 계정)
- [data/!coffee_excel_backfill_plan.md](./data/!coffee_excel_backfill_plan.md) — 더클린커피 엑셀 백필 진행 정본
- [data/!coffee_subscriber_ops.md](./data/!coffee_subscriber_ops.md) — 정기구독 트랙 운영 매뉴얼 (cron / 알림톡 6종 / 이탈 방지)
- [data/toss_sync_gap.md](./data/toss_sync_gap.md) — Toss PG sync 갭 진단
- [vm/!vm.md](./vm/!vm.md) — GCE VM 운영 정본 (접속·배포·pm2·Cloudflare Tunnel)

## 프로젝트 규약

- API base URL 환경변수: `NEXT_PUBLIC_API_BASE_URL` (기본 `http://localhost:7020`)
- 로컬 DB: `backend/data/crm.sqlite3` (better-sqlite3 · 멀티 사이트 구분은 `site` 컬럼)
- 원격 PG: `DATABASE_URL` 환경변수 · `tb_iamweb_users` / `tb_playauto_orders`가 진실의 원천
- AIBIO Supabase: `AIBIO_SUPABASE_PROJECT_ID` + `AIBIO_SUPABASE_SECRET_KEY` (`.env` 195~200행)
- 쿠팡: `COUPANG_BIOCOM_*` / `COUPANG_TEAMKETO_*` (`.env` 233~240행)

## 개발 원칙 (프로젝트 로컬)

- 과거 분석은 **원격 PG 원장**(`tb_iamweb_users` 97,407건, `tb_playauto_orders` 121,747건)을 사용. 로컬 `imweb_orders`는 최근 3.5개월만 커버하므로 과거 추세 분석에 부적합.
- 금액 집계 시 환불 처리 주의: PG는 `cancellation_reason`·`return_reason` 제외, AIBIO Supabase는 음수 amount, 쿠팡은 settlement API 기준.
- phone 조인은 정규화 후(`regexp_replace(phone, '[- ]', '', 'g')`) 사용.

## Growth Data Harness Bootstrap

GA4, GTM, NPay, TikTok, Meta, Google Ads, attribution, tracking, dispatcher, ROAS 작업을 시작할 때는 아래 순서를 따른다.

1. `harness/common/HARNESS_GUIDELINES.md`를 읽는다.
2. 관련 프로젝트 하네스가 있으면 `harness/{project}/` 문서를 읽는다.
3. 작업을 Green / Yellow / Red Lane으로 먼저 분류한다.
4. Green Lane은 확인 요청 없이 audit와 scoped commit/push까지 진행한다.
5. Yellow Lane은 스프린트 단위 1회 승인 후 setup, test, cleanup, report까지 자율 진행한다.
6. Red Lane은 실행 전 멈추고 TJ님 명시 승인을 요청한다.

명시 승인 없이 절대 실행하지 않는다.

- GTM Production publish
- permanent env flag ON
- platform conversion send
- production DB write/import
- auto dispatcher production transition
- destructive migration

## 더클린커피 tracking / NPay intent 작업 규칙

더클린커피의 tracking, wrapper, intent, eid, NPay beacon, funnel-capi 관련 작업을 시작할 때는 아래 순서로 먼저 확인한다.

1. `coffee/!imwebcoffee_code_latest_0501.md` — 더클린커피 imweb 헤더/바디/푸터 코드 정본. funnel-capi v3 본체, server payment decision guard v3, checkout-started v1, payment-success-order-code v1 4 layer 의 실제 소스. MIRROR_EVENTS 목록, sessionId 키 (`__seo_funnel_session`), eid 형식, server CAPI endpoint 가 모두 이 안에 있다. 추측 전에 이 파일부터 읽는다.
2. `harness/coffee-data/README.md`
3. `harness/coffee-data/LIVE_TAG_INVENTORY.md`
4. 최신 `data/coffee-live-tracking-inventory-*.md`
5. `data/coffee-npay-intent-beacon-preview-design-20260501.md`
6. `harness/coffee-data/AUDITOR_CHECKLIST.md`

기본값은 항상 read-only / no-send / no-write / no-deploy / no-publish다.

특히 새 wrapper, 새 session/eid, 새 click hook을 설계하기 전에는 Live Tracking Inventory snapshot이 7일 이내인지 확인한다. snapshot이 없거나 stale이면 사이트 live console에서 먼저 채운다.

더클린커피에는 이미 `funnel-capi v3`가 설치되어 sessionId/eid를 발급하고 있으므로, 새 session_uuid/eid를 무조건 만들지 말고 기존 funnel-capi sessionId/eid 재사용 또는 공존 여부를 먼저 판단한다.

## 금액 표기 규칙 (프로젝트 전역)

- **K (천 단위) · M (백만 단위) 영어 접미어 사용 금지**. 한국어 환경이므로 **만·억 단위 한국어 표기**를 쓴다.
- 대시보드·문서·채팅 답변 전부 동일하게 적용.
- 변환 규칙:
  - `₩1,500,000` → `₩150만` (not `₩1.5M`)
  - `₩100,000,000` → `₩1억` (not `₩100M`)
  - `₩150,000,000` → `₩1억 5,000만` (억·만 병기)
  - `₩5,500` → `₩5,500` (만 미만은 그대로)
- 프론트 공통 포매터: `fmtKRW()` (예: `frontend/src/app/coupang/page.tsx`) 가 이미 한국어 단위로 변환. 새 섹션 작성 시 이 헬퍼 재사용.
- 예외: 영어 대시보드나 해외 공유용 산출물은 별도 규칙 (현재 해당 없음).
