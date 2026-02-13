# Phase 1.2 — 다음 단계 구현 계획

> 프로젝트: biocom.kr SEO Intelligence Dashboard
> 작성일: 2026-02-11
> 기반 문서: biocom_seo_dashboard_prd.docx

---

## 1. 전체 로드맵 현황

### Phase 1-1: 인프라 + GSC 연동 (1주차) — ✅ 완료

| 작업 | 상태 | 비고 |
|------|------|------|
| GCP 프로젝트 생성 + API 활성화 | ✅ 완료 | `seo-aeo-487113` |
| Service Account 생성 + JSON 키 발급 | ✅ 완료 | `seo-656@seo-aeo-487113.iam.gserviceaccount.com` |
| GSC에 Service Account 권한 부여 | ✅ 완료 | `siteFullUser` 권한 |
| Express 백엔드 구축 (TypeScript) | ✅ 완료 | `backend/` — port 7020 |
| GSC API 연동 (`/api/gsc/query`, `/api/gsc/sites`) | ✅ 완료 | googleapis 라이브러리, Zod 유효성 검증 |
| Next.js 프론트엔드 구축 | ✅ 완료 | `frontend/` — port 3000, Next.js 16 |
| 대시보드 UI 5개 탭 프로토타입 (Mock 데이터) | ✅ 완료 | 오버뷰, 칼럼분석, 키워드분석, CWV, 사용자행동 |
| 솔루션 소개 페이지 | ✅ 완료 | 6번째 탭으로 추가 |
| GSC 검색 데이터 실시간 조회 기능 | ✅ 완료 | 오버뷰 탭 접이식 섹션 |

### Phase 1-2: PageSpeed + DB + 실데이터 연결 (2주차) — 🔧 현재 단계

| 작업 | 상태 | 우선순위 | 상세 |
|------|------|----------|------|
| PageSpeed Insights API 연동 | ☐ 미착수 | P0 | 아래 상세 참조 |
| Supabase DB 스키마 생성 | ☐ 미착수 | P0 | 3개 테이블 |
| GSC Cron Job (매일 오전 6시) | ☐ 미착수 | P0 | GSC 데이터 일별 자동 수집 |
| PageSpeed Cron Job (주 1회) | ☐ 미착수 | P1 | 월요일 오전 3시 |
| 오버뷰 KPI 카드 실데이터 연결 | ☐ 미착수 | P1 | DB에서 조회 |
| 오버뷰 추세 차트 실데이터 | ☐ 미착수 | P1 | 30일 GSC 데이터 |
| CWV 탭 실데이터 연결 | ☐ 미착수 | P1 | PageSpeed API 결과 |
| FRONTEND_ORIGIN CORS 수정 | ☐ 미착수 | P0 | localhost:3000 허용 |
| Vercel 배포 설정 | ☐ 미착수 | P2 | 환경변수 + vercel.json |

### Phase 2-1: GA4 + 키워드 분석 (3주차) — 대기

| 작업 | 상태 |
|------|------|
| GA4 Data API 연동 | ☐ 대기 |
| GA4 Cron Job (매일 오전 7시) | ☐ 대기 |
| 키워드 Q&A 자동분류 로직 | ☐ 대기 |
| Featured Snippet 추적 (searchAppearance) | ☐ 대기 |
| 칼럼 성과 스코어카드 실데이터 연결 | ☐ 대기 |
| 사용자 행동 탭 실데이터 연결 | ☐ 대기 |

### Phase 2-2: AI 모니터링 + 완성 (4주차) — 대기

| 작업 | 상태 |
|------|------|
| AI 인용 모니터링 (ChatGPT/Perplexity 자동 조회) | ☐ 대기 |
| 알림 시스템 (순위 급변, CWV 저하 감지) | ☐ 대기 |
| E-E-A-T 체크리스트 기능 | ☐ 대기 |
| 뷰저블 바로가기 링크 실제 URL 연결 | ☐ 대기 |
| AI 채팅 어시스턴트 실제 구현 | ☐ 대기 |
| 최종 QA + 운영 가이드 문서 | ☐ 대기 |

---

## 2. Phase 1.2 상세 구현 계획

### 2.1 PageSpeed Insights API 연동

**목표**: 페이지별 Performance, SEO, Accessibility 점수 + Core Web Vitals(LCP, FCP, CLS, INP, TTFB) 실측

**필요 환경변수**:
```env
PAGESPEED_API_KEY=<GCP에서 발급한 API Key>
```

**백엔드 작업**:
1. `backend/src/pagespeed.ts` 생성
   - `runPageSpeedTest(url: string, strategy: 'mobile' | 'desktop')` 함수
   - PageSpeed API v5 GET 호출
   - 응답에서 추출: `lighthouseResult.categories.{performance,seo,accessibility}.score * 100`
   - CWV 추출: `lighthouseResult.audits['largest-contentful-paint'].numericValue` 등
2. `backend/src/server.ts`에 엔드포인트 추가:
   - `POST /api/pagespeed/run` — 단건 페이지 테스트
   - `GET /api/pagespeed/latest` — DB에서 최신 결과 조회

**API 호출 예시**:
```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
  ?url=https://biocom.kr/healthinfo/probiotics-guide
  &key=${PAGESPEED_API_KEY}
  &strategy=mobile
  &category=performance
  &category=seo
  &category=accessibility
```

**제한사항**: 일일 25,000건, 분당 240건

### 2.2 Supabase DB 스키마

**3개 핵심 테이블**:

```sql
-- 1. GSC 일별 메트릭
CREATE TABLE gsc_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  page TEXT NOT NULL,
  query TEXT,
  device VARCHAR(10),
  country VARCHAR(5),
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(8,6) DEFAULT 0,
  position DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, page, query, device)
);

-- 2. PageSpeed 주간 측정
CREATE TABLE pagespeed_weekly (
  id BIGSERIAL PRIMARY KEY,
  measured_at TIMESTAMPTZ NOT NULL,
  url TEXT NOT NULL,
  strategy VARCHAR(10) NOT NULL,  -- 'mobile' | 'desktop'
  performance_score INTEGER,
  seo_score INTEGER,
  accessibility_score INTEGER,
  lcp_ms INTEGER,
  fcp_ms INTEGER,
  cls DECIMAL(6,4),
  inp_ms INTEGER,
  ttfb_ms INTEGER,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. GA4 일별 참여도 (Phase 2)
CREATE TABLE ga4_daily_engagement (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  page_path TEXT NOT NULL,
  sessions INTEGER,
  users INTEGER,
  new_users INTEGER,
  avg_engagement_time DECIMAL(8,2),
  bounce_rate DECIMAL(5,2),
  scroll_depth DECIMAL(5,2),
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, page_path)
);
```

**필요 환경변수**:
```env
NEXT_PUBLIC_SUPABASE_URL=<Supabase 프로젝트 URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase 서비스 롤 키>
```

### 2.3 Cron Job 구현

**GSC 일별 수집** (매일 오전 6시 KST):
1. GSC API로 2~3일 전 데이터 조회 (리포팅 딜레이 감안)
2. dimensions: `['page', 'query', 'device']`
3. 대상 페이지: `biocom.kr/healthinfo/*` 패턴
4. `gsc_daily_metrics` 테이블에 UPSERT

**PageSpeed 주간 측정** (매주 월요일 오전 3시):
1. 주요 칼럼 URL 10~20개 대상
2. mobile + desktop 전략 각각 측정
3. `pagespeed_weekly` 테이블에 INSERT

**구현 방식 선택지**:
- **Option A**: Vercel Cron Jobs (`vercel.json`에 cron 설정)
- **Option B**: 백엔드에 node-cron 추가
- **Option C**: Supabase Edge Functions + pg_cron

### 2.4 프론트엔드 실데이터 연결

**오버뷰 탭**:
- KPI 카드: DB에서 최근 7일 합산/평균 조회 → mock 데이터 교체
- 스파크라인: DB에서 일별 데이터 7일치 조회
- 추세 차트: DB에서 30일 일별 데이터
- KPI 변동률(Δ): 이전 7일 대비 현재 7일 비교

**CWV 탭**:
- 게이지: `pagespeed_weekly` 최신 레코드
- 페이지별 테이블: 최신 측정 결과
- 모바일/데스크톱 전략별 필터

### 2.5 CORS 수정

현재 `FRONTEND_ORIGIN=http://localhost:7010`으로 설정되어 있어 `localhost:3000`에서 CORS 에러 발생.

**수정 방안**:
- `.env`에서 `FRONTEND_ORIGIN=http://localhost:3000`으로 변경
- 또는 다중 origin 지원: 환경변수를 쉼표로 구분 (`FRONTEND_ORIGINS=http://localhost:3000,http://localhost:7010`)

---

## 3. 기술 참고사항

### 현재 기술 스택
| 계층 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | Next.js 16, TypeScript, CSS Modules | port 3000 |
| 백엔드 | Express 5, TypeScript, googleapis | port 7020 |
| 인증 | Service Account (JSON) | GSC + 향후 GA4 공유 |
| 차트 | 순수 SVG (Sparkline, ScoreGauge) | 추가 라이브러리 없음 |

### PRD vs 현재 차이점
| PRD 스택 | 현재 구현 | 비고 |
|----------|-----------|------|
| Next.js API Routes | Express 별도 백엔드 | 분리 구조 유지 |
| shadcn/ui + Tailwind | CSS Modules | 현재 방식 유지 |
| Recharts | 순수 SVG | 경량 우선 |
| Supabase | 미구축 | Phase 1.2에서 연동 |
| Vercel 배포 | 로컬 개발 | Phase 1.2에서 배포 |

### 필요한 새 환경변수 총정리
```env
# Phase 1.2 추가
PAGESPEED_API_KEY=               # GCP API Key
NEXT_PUBLIC_SUPABASE_URL=        # Supabase 프로젝트 URL
SUPABASE_SERVICE_ROLE_KEY=       # Supabase 서비스 롤 키
CRON_SECRET=                     # Cron Job 인증 토큰

# Phase 2 추가
GA4_PROPERTY_ID=                 # GA4 속성 ID
GA4_SERVICE_ACCOUNT_KEY=         # GSC와 동일 키 재사용 가능
```

---

## 4. 우선순위 실행 순서

```
1. CORS 수정 (FRONTEND_ORIGIN) ─── 5분
2. Supabase 프로젝트 생성 + DB 스키마 ─── 30분
3. PageSpeed API Key 발급 ─── 10분
4. PageSpeed API 백엔드 연동 ─── 2시간
5. GSC Cron Job (일별 자동 수집) ─── 2시간
6. PageSpeed Cron Job (주간 자동 측정) ─── 1시간
7. 오버뷰 KPI 실데이터 연결 ─── 2시간
8. CWV 탭 실데이터 연결 ─── 1시간
9. 추세 차트 실데이터 연결 ─── 1시간
10. Vercel 배포 + 환경변수 ─── 1시간
```

---

## 5. 현재 구현 상태 요약

| 항목 | 상태 | 데이터 소스 |
|------|------|-------------|
| GSC API 인증 | ✅ 실데이터 | Service Account |
| GSC 검색 데이터 조회 | ✅ 실데이터 | 실시간 API 호출 |
| 오버뷰 — AEO/GEO 점수 | 🔧 Mock | AI 분석 로직 필요 |
| 오버뷰 — AI 인사이트 | 🔧 Mock | AI 분석 로직 필요 |
| 오버뷰 — 추세 차트 | 🔧 Mock | DB 일별 데이터 필요 |
| 오버뷰 — KPI 스파크라인 | 🔧 Mock | DB 일별 데이터 필요 |
| 오버뷰 — KPI CWV 게이지 | 🔧 Mock | PageSpeed API 필요 |
| 오버뷰 — 인텐트 분석 | 🔧 Mock | AI 키워드 분류 필요 |
| 오버뷰 — 최적화 작업 | 🔧 Mock | 작업 관리 시스템 필요 |
| 칼럼별 분석 | 🔧 Mock | DB + 스코어 로직 필요 |
| 키워드 분석 | 🔧 Mock | GSC searchAppearance 필요 |
| Core Web Vitals | 🔧 Mock | PageSpeed API 필요 |
| 사용자 행동 (GA4) | 🔧 Mock | GA4 API 필요 (Phase 2) |
| SEO → 전환 퍼널 | 🔧 Mock | GA4 API 필요 (Phase 2) |
| AI 채팅 어시스턴트 | 🔧 Mock | LLM 연동 필요 (Phase 2) |
| 솔루션 소개 페이지 | ✅ 완료 | 정적 콘텐츠 |
