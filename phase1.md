# Phase 1 (MVP) 바이브코딩 결과

작성일: 2026-02-11
기준 문서: `biocom_seo_dashboard_prd.docx` (Phase 1 - MVP)

## 1) 요청 범위
"Next.js 프로젝트 초기화부터 GSC API 연동까지"를 즉시 실행 가능한 코드로 구현.

구현 범위:
- Next.js 프론트엔드 초기화 및 MVP 대시보드 화면 구현
- Node.js(Express) 백엔드 API 구축
- Google Search Console API 인증 + 데이터 조회(`sites.list`, `searchanalytics.query`)
- 프론트 <-> 백엔드 연결
- 환경변수 템플릿 제공
- 포트 사용 가능 여부 점검

## 2) 포트 점검 결과
점검 시각: 2026-02-11

- `7000`: 사용 중 (macOS `ControlCenter` 프로세스가 LISTEN)
- `7001`: 사용 가능 (LISTEN 프로세스 없음)

결론:
- 백엔드 `7001` 사용 가능
- 프론트 `7000`은 현재 충돌 발생. 코드 기본값은 요청대로 `7000`으로 맞췄지만, 실제 실행 전 점유 프로세스 해제 또는 포트 변경 필요

## 3) 생성/수정된 주요 파일

### 루트
- `package.json`: 프론트/백엔드 실행 보조 스크립트 추가
- `.gitignore`: 빌드/의존성/로컬 env 파일 ignore
- `phase1.md`: 본 문서

### 프론트엔드 (`frontend`)
- `frontend/package.json`: dev/start 포트를 `7000`으로 고정
- `frontend/.env.local.example`: `NEXT_PUBLIC_API_BASE_URL` 샘플
- `frontend/src/app/page.tsx`: GSC 조회 폼 + KPI 카드 + 테이블 UI
- `frontend/src/app/page.module.css`: 반응형 대시보드 스타일
- `frontend/src/app/layout.tsx`: 메타데이터/폰트 설정
- `frontend/src/app/globals.css`: 전역 배경/타이포그래피 스타일

### 백엔드 (`backend`)
- `backend/package.json`: dev/build/start/typecheck 스크립트 구성
- `backend/tsconfig.json`: TS 빌드 설정
- `backend/.env.example`: 환경변수 템플릿
- `backend/src/env.ts`: 환경변수 검증(zod)
- `backend/src/gsc.ts`: GSC 인증 및 API 호출 로직
- `backend/src/server.ts`: HTTP API 라우트/검증/오류 처리

## 4) 구현 상세

### 4.1 프론트
핵심 기능:
- 기본 조회 기간: 최근 28일 (어제까지)
- 입력 폼: `siteUrl`, `startDate`, `endDate`, `rowLimit`
- API 호출: `POST /api/gsc/query`
- 표시 데이터:
  - 합계 클릭수, 노출수
  - 평균 CTR, 평균 노출순위
  - 상위 행 테이블(page/query/device + metrics)
- 백엔드 상태 배지: `GET /health` 결과를 `checking/ok/error`로 표시

### 4.2 백엔드
핵심 API:
- `GET /health`: 서버 상태 확인
- `GET /api/gsc/sites`: 접근 가능한 Search Console 속성 목록
- `POST /api/gsc/query`: Search Analytics 조회

요청 바디(`POST /api/gsc/query`) 예시:
```json
{
  "siteUrl": "sc-domain:biocom.kr",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "dimensions": ["page", "query", "device"],
  "rowLimit": 50,
  "startRow": 0,
  "type": "web"
}
```

검증/안전장치:
- 날짜 포맷 강제: `YYYY-MM-DD`
- `startDate <= endDate` 검증
- `rowLimit` 범위 제한: 1~25000
- 인증키 누락/형식 오류 시 명확한 메시지 반환

인증 방식(둘 중 하나):
- `GOOGLE_APPLICATION_CREDENTIALS` (키 파일 경로)
- `GSC_SERVICE_ACCOUNT_KEY` (JSON 원문 1줄)

## 5) 실행 방법

### 5.1 환경변수 설정
1. 백엔드:
- `backend/.env.example` 참고해 `backend/.env` 생성
- 최소 필요값:
  - `PORT=7001`
  - `FRONTEND_ORIGIN=http://localhost:7000`
  - `GSC_SITE_URL=sc-domain:biocom.kr`
  - `GOOGLE_APPLICATION_CREDENTIALS=...` 또는 `GSC_SERVICE_ACCOUNT_KEY=...`

2. 프론트:
- `frontend/.env.local.example` 참고해 `frontend/.env.local` 생성
- 값: `NEXT_PUBLIC_API_BASE_URL=http://localhost:7001`

### 5.2 서버 실행
터미널 1:
```bash
npm run dev:backend
```

터미널 2:
```bash
npm run dev:frontend
```

포트 충돌 시(현재 7000 점유 중):
- 프론트를 임시로 다른 포트로 실행하거나(`frontend/package.json` dev 스크립트 수정)
- `backend/.env`의 `FRONTEND_ORIGIN`도 같은 포트로 맞출 것

## 6) 검증 결과
실행 검증:
- `backend`: `npm run typecheck` 통과
- `backend`: `npm run build` 통과
- `backend`: `GET /health` 응답 정상
- `frontend`: `npm run lint` 통과
- `frontend`: `npm run build` 통과

실 API 검증 한계:
- 실제 GSC 조회는 서비스 계정/권한 미설정 상태에서 `Missing Google auth credentials`가 정상적으로 반환됨
- 즉, 코드 레벨 연동은 완료되었고 운영 자격증명 연결만 남은 상태

## 7) 미해결 이슈 (상세)

### 이슈 A: 프론트 7000 포트 충돌
현상:
- `next dev --port 7000` 실행 시 `EADDRINUSE`
원인:
- macOS `ControlCenter`가 `7000` 점유
영향:
- 프론트 개발 서버 즉시 기동 불가
대응:
- 포트 변경(예: 7010) + CORS origin 동기화
- 또는 7000 점유 프로세스 해제 후 재시도

### 이슈 B: GSC 서비스 계정 권한 미연결
현상:
- `GET /api/gsc/sites`, `POST /api/gsc/query`가 인증 누락 오류 반환
원인:
- 실제 인증키 미주입 / Search Console 속성 권한 미부여
영향:
- 실데이터 조회 불가
대응:
- GCP Service Account 키 주입
- Search Console 속성에 서비스 계정 이메일 Viewer 권한 부여

### 이슈 C: 데이터 저장 파이프라인 미구현
현상:
- 현재는 조회 API + 화면 표시까지만 구현
원인:
- PRD Phase 1의 Cron + DB 적재(Supabase) 단계는 후속
영향:
- 히스토리 누적/비교/자동 집계 불가
대응:
- 다음 단계에서 `cron endpoint + DB schema + upsert` 구현 필요

### 이슈 D: 운영보안/배포 설정 미완
현상:
- 로컬 개발 기준만 구성
영향:
- 배포 시 비밀키 관리, Rate Limit, 로깅 정책 부재
대응:
- Vercel/서버 환경변수 Vault 적용, API 보호 및 에러 모니터링 추가

## 8) 다음 개발 계획 (상세)

### Step 1. GSC 실연결 완료 (우선순위 최상)
- Service Account 키 연결
- Search Console 권한 부여
- `GET /api/gsc/sites`로 속성 탐색 확인
- `POST /api/gsc/query`로 샘플 데이터 반환 확인

완료 기준:
- `sc-domain:biocom.kr` 대상 row 데이터 1건 이상 수신

### Step 2. Phase 1 PRD 요구의 데이터 수집 파이프라인
- DB(Supabase) 테이블 설계
  - 예: `gsc_daily_metrics`
- 수집 API를 cron 트리거 가능 형태로 분리
  - 예: `/api/cron/gsc`
- 날짜/차원 단위 upsert 로직 구현

완료 기준:
- 하루 1회 자동 수집 + 누적 저장 + 중복 방지

### Step 3. PageSpeed API 연동 (Phase 1 범위)
- API Key 기반 클라이언트 추가
- 모바일/데스크톱 각각 수집
- Core Web Vitals + Lighthouse 점수 저장

완료 기준:
- `pagespeed_weekly` 테이블 기준 주간 데이터 누적

### Step 4. MVP 대시보드 확장
- 오버뷰 KPI 카드(기간 비교)
- 칼럼 상세 드릴다운
- 정렬/필터/검색(페이지, 쿼리, 기기)

완료 기준:
- PRD 2주차 UI 항목의 핵심 흐름 동작

### Step 5. 배포/운영 안정화
- 프론트/백 분리 배포 또는 통합 배포 정책 결정
- 환경변수/시크릿 관리 체계 확정
- 에러 모니터링 및 기본 경보 설정

완료 기준:
- 배포 URL에서 실데이터 조회 + 장애 시 원인 추적 가능

## 9) 빠른 체크리스트
- [ ] `backend/.env` 실제 값 입력
- [ ] 서비스 계정 이메일 Search Console Viewer 권한 부여
- [ ] `npm run dev:backend` 실행
- [ ] `npm run dev:frontend` 실행 (7000 충돌 시 포트 조정)
- [ ] 대시보드에서 Query 실행 후 데이터 확인

