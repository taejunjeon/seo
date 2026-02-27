# Phase 1.1: 프론트엔드 리뷰 + 접속 가능한 대시보드 구동 + 문서화

> 작성일: 2026-02-11
> 상태: **완료**

---

## 1. 프론트엔드 리뷰 결과

### 1.1 기술 스택 현황

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.1.6 |
| UI 라이브러리 | React | 19.2.3 |
| 언어 | TypeScript | 5.x |
| 스타일링 | CSS Modules | - |
| 백엔드 | Express + tsx (dev) | 5.2.1 |
| API 유효성 검증 | Zod | 4.3.6 |
| GSC 연동 | googleapis | 171.4.0 |

### 1.2 CSS 품질 평가

- **테마**: 그린 그라디언트 (#0d6f54 → #1d8b68 → #85d4bd) 기반 자연스러운 SEO 대시보드 톤
- **글라스모피즘**: `backdrop-filter: blur(8px)` + 반투명 배경의 패널 디자인
- **반응형**: 3단계 브레이크포인트 (960px → 2열 KPI, 640px → 1열 + 축소 패딩)
- **타이포그래피**: `clamp(1.5rem, 2.8vw, 2.4rem)` 유동적 폰트 사이징
- **그림자 계층**: Hero(24px) > Panel(16px) > Metric Card(8px) 3단계 깊이감
- **판정**: 스켈레톤이 아닌 **완성도 높은 MVP 수준**

### 1.3 컴포넌트 구조

현재 `page.tsx` 단일 파일에 모든 UI 로직이 포함됨:
- Hero 섹션 (제목, 설명, 백엔드 상태 배지)
- 쿼리 폼 (siteUrl, 날짜 범위, rowLimit)
- KPI 카드 4개 (Clicks, Impressions, Avg CTR, Avg Position)
- 데이터 테이블 (7컬럼: Page, Query, Device, Clicks, Impressions, CTR, Position)

### 1.4 PRD 대비 미설치 라이브러리

| 라이브러리 | PRD 계획 | 현재 상태 | 판단 |
|------------|----------|-----------|------|
| shadcn/ui | 설치 예정 | 미설치 | Phase 2에서 설치 권장 |
| Tailwind CSS | 설치 예정 | 미설치 | shadcn/ui와 함께 도입 |
| Recharts | 차트 표시용 | 미설치 | Phase 2 차트 기능 시 도입 |

**결정**: 현재 CSS Modules 구조가 충분히 깔끔하고 기능 범위에 적합함. 멀티페이지/차트 단계에서 shadcn/ui + Tailwind 마이그레이션 권장.

---

## 2. Phase 1.1 변경 사항

### 2.1 포트 변경 (7000 → 7010/7020)

**이유**: macOS Monterey+ 에서 AirPlay Receiver가 포트 7000을 기본 점유하여 충돌 발생. SEO 프로젝트 전용 포트 대역(70xx)으로 통일.

| 서비스 | 변경 전 | 변경 후 |
|--------|---------|---------|
| 프론트엔드 | 7000 | **7010** |
| 백엔드 | 7001 | **7020** |

| 파일 | 변경 내용 |
|------|----------|
| `frontend/package.json` | `--port 7000` → `--port 7010` (dev, start) |
| `frontend/src/app/page.tsx` | 설명 텍스트 포트 및 API fallback URL 반영 |
| `backend/src/env.ts` | PORT 기본값 7020, FRONTEND_ORIGIN 기본값 `localhost:7010` |
| `backend/.env.example` | PORT=7020, FRONTEND_ORIGIN 포트 반영 |

### 2.2 환경 파일 생성

| 파일 | 내용 |
|------|------|
| `backend/.env` | PORT=7020, FRONTEND_ORIGIN=http://localhost:7010, GSC_SITE_URL=sc-domain:biocom.kr |
| `frontend/.env.local` | NEXT_PUBLIC_API_BASE_URL=http://localhost:7020 |

### 2.3 .gitignore 보강

- `backend/credentials/` 추가 (향후 서비스 계정 키 파일 보호)

### 2.4 검증 결과

| 항목 | 결과 |
|------|------|
| `curl http://localhost:7020/health` | `{"status":"ok","service":"biocom-seo-backend"}` |
| `http://localhost:7010` 접속 | HTTP 200, 대시보드 정상 렌더링 |
| CORS 헤더 | `Access-Control-Allow-Origin: http://localhost:7010` |
| Hero 섹션 | "biocom.kr SEO Intelligence Dashboard" 표시 |
| Backend status 배지 | CORS 정상 동작으로 "ok" 표시 예상 |
| KPI 카드 | 초기 0값 정상 표시 |
| 테이블 | "No data yet. Run a query." 정상 표시 |
| "Run GSC Query" 클릭 | GSC 미연결 상태에서 인증 에러 메시지 정상 표시 예상 |

---

## 3. UI 접근 방식 결정 및 근거

### 결정: 현재 CSS Modules 유지, Phase 2 시점 마이그레이션

**근거:**
1. 현재 단일 페이지 MVP에서 CSS Modules가 충분히 기능을 수행
2. 추가 의존성 없이 빌드 속도 최적화 유지
3. Phase 2에서 멀티페이지/차트 도입 시 자연스러운 전환점
4. shadcn/ui + Tailwind 마이그레이션은 새 컴포넌트 생성 시점이 최적

---

## 4. 고도화 제안 (Phase 2+)

### 4.1 컴포넌트 분리
- `HeroSection` - 제목/상태 배지
- `QueryForm` - GSC 쿼리 입력 폼
- `KpiCards` - 4개 지표 카드 그리드
- `DataTable` - 정렬/페이지네이션 테이블

### 4.2 UX 개선
- 로딩 스켈레톤 (Skeleton UI for KPI cards & table)
- 테이블 컬럼 정렬 (클릭 시 ASC/DESC)
- 다크모드 토글
- 날짜 프리셋 (최근 7일/28일/90일)
- CSV/Excel 내보내기

### 4.3 성능
- React Query 또는 SWR 도입 (캐싱, 리페칭)
- 테이블 가상화 (대규모 데이터셋)
- API 응답 캐싱 (Redis 또는 인메모리)

---

## 5. 미해결 이슈

| 이슈 | 상태 | 우선순위 |
|------|------|----------|
| GSC 서비스 계정 인증 미연결 | 미해결 | **높음** |
| 데이터 저장소 미구현 (쿼리 결과 휘발) | 미해결 | 중간 |
| PageSpeed Insights API 미연동 | 미해결 | 중간 |
| 에러 바운더리 미구현 | 미해결 | 낮음 |
| 접근성(a11y) 감사 미실시 | 미해결 | 낮음 |

---

## 6. GSC 실연결 가이드

### 6.1 GCP 프로젝트 설정

```bash
# 1. GCP Console에서 프로젝트 생성 또는 선택
# https://console.cloud.google.com/

# 2. Search Console API 활성화
# https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
```

### 6.2 서비스 계정 생성

```bash
# 1. IAM & Admin → Service Accounts → Create Service Account
# - 이름: biocom-seo-reader
# - 역할: 별도 IAM 역할 불필요 (SC 권한은 SC에서 부여)

# 2. 키 생성
# - Service Account 상세 → Keys → Add Key → Create new key → JSON
# - 다운로드된 JSON 파일을 backend/credentials/ 폴더에 저장
```

### 6.3 Search Console 권한 부여

```bash
# 1. Google Search Console 접속
# https://search.google.com/search-console

# 2. biocom.kr 속성 선택 → Settings → Users and permissions
# 3. Add user → 서비스 계정 이메일 입력 (예: biocom-seo-reader@project-id.iam.gserviceaccount.com)
# 4. Permission: Full (전체) 또는 Restricted (제한)
```

### 6.4 환경 변수 설정

```bash
# backend/.env 수정

# 방법 1: 키 파일 경로
GOOGLE_APPLICATION_CREDENTIALS=/Users/vibetj/coding/seo/backend/credentials/service-account.json

# 방법 2: JSON 인라인 (CI/CD 환경용)
# GSC_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}
```

### 6.5 연결 검증

```bash
# 백엔드 서버 재시작 후
curl -s http://localhost:7020/api/gsc/sites | python3 -m json.tool

# 정상 응답 예시:
# {
#   "sites": [
#     {
#       "siteUrl": "sc-domain:biocom.kr",
#       "permissionLevel": "siteFullUser"
#     }
#   ]
# }

# 쿼리 테스트
curl -s -X POST http://localhost:7020/api/gsc/query \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-01-01","endDate":"2026-02-01","dimensions":["query"],"rowLimit":5}' \
  | python3 -m json.tool
```

---

## 7. 다음 개발 계획

### Phase 1.2: GSC 실연결
- GCP 서비스 계정 발급 및 Search Console 권한 부여
- backend/.env에 인증 정보 설정
- 실제 데이터로 대시보드 검증

### Phase 2: 대시보드 고도화
- shadcn/ui + Tailwind CSS 마이그레이션
- Recharts 차트 컴포넌트 도입
- 컴포넌트 분리 및 구조화
- 데이터 저장 (PostgreSQL/Supabase)

### Phase 3: 자동화 및 분석
- 일일 데이터 수집 스케줄러
- PageSpeed Insights 연동
- 키워드 트렌드 분석
- 경쟁사 비교 기능

---

## 수정 파일 요약

| 파일 | 작업 | 상태 |
|------|------|------|
| `frontend/package.json` | 포트 7000→7010 | 완료 |
| `frontend/src/app/page.tsx` | 포트 번호 및 API URL 수정 | 완료 |
| `backend/src/env.ts` | PORT 기본값 7020, FRONTEND_ORIGIN 7010 | 완료 |
| `backend/.env.example` | PORT=7020, FRONTEND_ORIGIN 포트 반영 | 완료 |
| `backend/.env` | 환경 파일 생성 | 완료 |
| `frontend/.env.local` | 환경 파일 생성 | 완료 |
| `.gitignore` | backend/credentials/ 추가 | 완료 |
| `phase1.1.md` | 본 문서 | 완료 |
