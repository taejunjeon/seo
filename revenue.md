# Revenue 프로젝트 구조 파악

기준일: 2026-03-27
출처: `roadmap0327.md`에서 분리

## 1. 최상위 구조

`/Users/vibetj/coding/revenue` 기준:

- `backend/`: 실사용 FastAPI 백엔드 Git 저장소
- `frontend/`: 실사용 Next.js 포털 Git 저장소
- `backend-main/`, `frontend-main/`: 복제본/이전 스냅샷 성격
- `analysis/`: 분석용 보조 폴더
- `project_structure.md`, `dbstatus.md`, `growth0326.md` 등: 운영 메모/분석 문서

실제 작업 기준은 `backend/`, `frontend/` 두 폴더로 보는 것이 맞다.

## 2. 백엔드 구조

- 스택: FastAPI 0.116, SQLAlchemy 2.x, asyncpg, APScheduler
- 엔트리: `backend/app/main.py`
- 주요 API:
  - 인증/유저: `app/api/auth.py`, `app/api/user.py`
  - 운영 대시보드: `app/api/dashboard.py`, `app/api/marketing.py`, `app/api/ltr.py`
  - 매출/주문: `app/api/sales.py`, `app/api/orders.py`, `app/api/coupang.py`, `app/api/naver_orders.py`, `app/api/playauto_orders.py`
  - 업로드/동기화: `app/api/upload.py`, `app/api/sales_upload.py`, `app/api/scheduler.py`
  - 알림/운영: `app/api/notifications.py`, `app/api/notification_admin.py`
  - 인플루언서/공구: `app/api/influencer_auth.py`, `app/api/influencer_manage.py`
- 작업 성격:
  - 외부 판매 채널 수집
  - 업로드 파일 파싱 및 UPSERT
  - Materialized View 기반 집계
  - 주문/매출 통합 조회

## 3. 프론트엔드 구조

- 스택: Next.js 15.3.5, React 19, pnpm workspace, Turborepo, Zustand, React Query
- 엔트리 앱: `frontend/apps/portal`
- 주요 화면:
  - `/home`
  - `/dashboard/retention`
  - `/dashboard/ltr`
  - `/dashboard/marketing`
  - `/sales`
  - `/orders/*`
  - `/influencer/*`
  - `/settings`
- 모노레포 패키지:
  - `packages/ui`
  - `packages/styles`
  - `packages/utils`
- 특징:
  - 백엔드 직접 호출 + 일부 Next API route 프록시 혼합
  - 이미 운영자용 포털 형태가 갖춰져 있음

## 4. 데이터 현실

`dbstatus.md`와 `/Users/vibetj/coding/seo/database0327.md` 기준 핵심 판단:

- 강한 영역:
  - `tb_iamweb_users` 주문 데이터
  - `tb_consultation_records` 상담 원장 8,305건
  - `ltr_customer_cohort` 코호트 데이터 30,546건
  - `tb_playauto_orders` 외부 주문/물류 데이터
  - `channeltalk_users` 사용자 스냅샷 2,198건
  - `tb_sales_*` 매출 업로드 데이터
  - 인플루언서 공구 고객 데이터
  - 일부 재고/발주 추천 데이터
- 약한 영역:
  - `tb_cs_inquiry`, `tb_cs_message`는 아직 1건 수준
  - `tb_channeltalk_users`는 비어 있고 실제 데이터는 `channeltalk_users`에 있음
  - `channeltalk_users.lastSeenAt` 최신값이 2025-02-12라 live sync 복구가 필요함
  - `tb_iamweb_users.payment_status` 값이 한글/영문/null 혼재

## 5. CRM 시나리오 우선순위 (데이터 현실 기반)

`주문형 실험 우선 + 상담형 실험 병행 준비`로 잡는 것이 현실적이다.

1. 체크아웃 이탈
2. 상품 조회 후 미구매
3. 첫 구매 후 일정 기간 미재구매
4. 상담 완료 후 7일/14일 영양제 후속
5. 상담 부재/변경 고객 리콜
6. 구독 전환 유도

추가로 ChannelTalk는 새로운 실행 채널을 처음부터 만드는 것보다 **v1 실행 채널로 재정렬**하는 편이 time-to-first-experiment 측면에서 유리하다. 다만 source table은 `tb_channeltalk_users`가 아니라 `channeltalk_users` 기준으로 보고, stale snapshot 복구를 먼저 확인해야 한다.
