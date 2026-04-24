# seo 프로젝트 · 로컬 CLAUDE.md

상위 규칙은 `~/coding/CLAUDE.md`를 따르고, 이 파일은 seo 프로젝트 고유 맥락을 기록한다.

## 프로젝트 맥락

- **프론트엔드**: Next.js 16 · `frontend/` · 포트 **7010**
- **백엔드**: Express + tsx · `backend/` · 포트 **7020**
- **도메인**: 바이오컴 그룹 (바이오컴 건기식 / 더클린커피 / AIBIO 리커버리랩) CRM·광고·매출 통합 관리

## 참조 문서 (핵심)

작업 전 필요한 맥락은 아래 문서로 먼저 확인한다.

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
