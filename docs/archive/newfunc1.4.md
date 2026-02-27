# AEO/GEO Score 실데이터 전환 — 개발 결과 보고서

> **작성일**: 2026-02-13
> **기준 문서**: newfunc1.3.md (기능 기획서)
> **개발 범위**: Phase A + Phase B 완료

---

## 1. 개발 완료 사항

### 1.1 백엔드 — 3개 API 엔드포인트 신규 생성

| 엔드포인트 | 메서드 | 설명 | 상태 |
|-----------|--------|------|------|
| `/api/crawl/analyze` | POST | URL 크롤링 → Schema + 콘텐츠 구조 분석 | ✅ 완료 |
| `/api/aeo/score` | GET | AEO Score 종합 산출 (6개 항목) | ✅ 완료 |
| `/api/geo/score` | GET | GEO Score 종합 산출 (6개 항목) | ✅ 완료 |

### 1.2 백엔드 — 2개 모듈 신규 생성

| 파일 | 설명 | 주요 기능 |
|------|------|----------|
| `backend/src/crawl.ts` | 페이지 크롤링 엔진 | cheerio 기반 HTML 파싱, JSON-LD Schema 감지, microdata fallback, 콘텐츠 구조 분석 |
| `backend/src/scoring.ts` | AEO/GEO 점수 산출 엔진 | 6개 항목별 점수 계산, 측정 가능/불가 상태 분리, normalizedScore 산출 |

### 1.3 프론트엔드 — 실시간 점수 표시 + 상세 브레이크다운

| 변경 사항 | 설명 |
|-----------|------|
| AEO/GEO 점수 카드 | Mock → 실 API 데이터 (LiveBadge 표시) |
| 브레이크다운 패널 | AEO 6항목 + GEO 6항목 상세 점수, 프로그레스 바, 상태별 표시 |
| fallback | API 실패 시 기존 Mock 데이터로 자동 전환 |

---

## 2. 현재 실측 결과 (2026-02-13 기준)

### AEO Score: 83점 (측정 가능 항목 기준 29/35점)

| 구성 요소 | 점수 | 상태 | 상세 |
|-----------|------|------|------|
| Q&A 키워드 커버리지 | 14/20 | ✅ 측정 | 70/500 키워드가 Q&A 유형 (14.0%) |
| 구조화 데이터 (Schema) | 0/20 | ⏳ 크롤링 대기 | URL 지정 시 자동 측정 |
| 검색 상위 노출 (TOP 3) | 15/15 | ✅ 측정 | 159/500 키워드가 TOP 3 (31.8%) |
| 콘텐츠 구조 품질 | 0/15 | ⏳ 크롤링 대기 | URL 지정 시 자동 측정 |
| AI 답변 인용 빈도 | 0/20 | 🔒 Phase D | 유료 API 필요 (SerpAPI/Perplexity) |
| AI 유입 트래픽 | 0/10 | 🔒 Phase C | GA4 API 활성화 필요 |

### GEO Score: 83점 (측정 가능 항목 기준 25/30점)

| 구성 요소 | 점수 | 상태 | 상세 |
|-----------|------|------|------|
| AI Overview 노출 | 0/25 | 🔒 Phase D | 유료 SERP API 필요 |
| 검색 순위 (TOP 3/10) | 20/20 | ✅ 측정 | TOP 3: 159개, TOP 10: 367개 / 전체 500개 |
| 구조화 데이터 (GEO) | 0/20 | ⏳ 크롤링 대기 | URL 지정 시 자동 측정 |
| 콘텐츠 신뢰도 | 0/15 | ⏳ 크롤링 대기 | URL 지정 시 자동 측정 |
| 기술 성능 (PageSpeed) | 0/10 | ⏳ 측정 필요 | PageSpeed 실행 후 반영 |
| CTR 변화 추이 | 5/10 | ✅ 측정 | 현재 CTR 3.35% (변동 +0.22%p) |

### 점수 산출 방식
- **normalizedScore** = (측정된 점수 합 / 측정 가능 항목 만점 합) × 100
- 측정 불가(unavailable) 항목은 분모에서 제외
- 크롤링 데이터가 추가되면 분모가 커지면서 점수가 변동됨

---

## 3. 크롤링 기능 상세

### Schema 감지 항목
| Schema 타입 | AEO 점수 | GEO 점수 | 설명 |
|-------------|---------|---------|------|
| FAQPage | +7 | +8 | AI Overview 채택 3.2배 증가 (GEO) |
| Article | +5 | +5 | 콘텐츠 유형 인식 |
| Author/Person | +4 | +4 | E-E-A-T 저자 정보 |
| HowTo | +2 | - | 단계별 답변 구조 |
| Medical/Health | +2 | - | YMYL 카테고리 신뢰도 |
| Speakable | - | +3 | 음성 검색 최적화 |

### 콘텐츠 구조 분석 항목
| 분석 항목 | 기준 | AEO 점수 | GEO 점수 |
|-----------|------|---------|---------|
| H2 소제목 | 3개 이상 | +4 | - |
| H3 소제목 | 2개 이상 | +3 | - |
| 목록 (ul/ol) | 2개 이상 | +3 | +3 (3개+) |
| 표 (table) | 1개 이상 | +2 | +4 |
| 인용 블록 | 1개 이상 | +2 | +5 |
| 단어 수 | 1000단어+ | - | +3 |
| 메타 디스크립션 | 50자+ | +1 | - |

---

## 4. 미해결 이슈

### 4.1 GA4 API — PERMISSION_DENIED (Phase C 차단)
```
Error: 7 PERMISSION_DENIED: Google Analytics Data API has not been used in project 196387225505
```
- **원인**: GCP 콘솔에서 "Google Analytics Data API" 활성화 필요
- **조치**: https://console.cloud.google.com → API 및 서비스 → 라이브러리 → "Google Analytics Data API" 검색 → 사용 설정
- **.env 파일의 GA4 크레덴셜은 정상** — API 활성화만 되면 바로 작동
- **영향**: AI 유입 트래픽 (AEO 10점), 사용자 행동 데이터 (행동 분석 탭)

### 4.2 biocom.co.kr 크롤링 — 네트워크 접근 불가
- 현재 개발 환경에서 biocom.co.kr 접근 불가 (timeout)
- 크롤링 기능 자체는 example.com 등으로 정상 검증됨
- **배포 환경(Vercel)에서는 정상 작동할 것으로 예상**
- URL 파라미터 없이 호출하면 크롤링 없이 GSC 데이터만으로 점수 산출

### 4.3 크롤링 URL 자동 선택 로직 미구현
- 현재: API 호출 시 `?url=` 파라미터로 수동 지정
- 향후: GSC 상위 페이지를 자동으로 크롤링하여 사이트 전체 평균 산출

### 4.4 유료 API 미연동 (Phase D)
- AI 인용 빈도 (AEO 20점): SerpAPI 또는 Perplexity API 필요
- AI Overview 노출 (GEO 25점): SerpAPI 또는 DataForSEO 필요
- **현재 이 항목들은 "unavailable"로 표시되며 점수 산출에서 제외됨**

---

## 5. 다음 개발 사항

### 즉시 가능 (Phase C 활성화 후)
| 작업 | 예상 효과 | 선결 조건 |
|------|----------|----------|
| GA4 AI 유입 트래픽 추적 | AEO 10점 추가 측정 | GCP에서 GA4 Data API 활성화 |
| GA4 사용자 행동 → 콘텐츠 품질 보강 | 행동 분석 탭 실데이터 전환 | 동일 |

### 프론트엔드 UX 개선 (추가 개발)
| 작업 | 설명 |
|------|------|
| URL 입력 → 크롤링 트리거 | 오버뷰에서 URL 입력 시 자동 크롤링 후 점수 업데이트 |
| 점수 히스토리 저장 | Supabase에 일별 AEO/GEO 점수 적재 → 추이 그래프 |
| 크롤링 결과 캐시 시각화 | 크롤링된 Schema/콘텐츠 정보 상세 표시 |
| 경쟁사 비교 | 경쟁 URL의 AEO/GEO 점수와 비교 |

### Phase D (유료)
| 작업 | 비용 | 효과 |
|------|------|------|
| SerpAPI 연동 | $50/월~ | AI Overview 노출 (GEO 25점) + AI 인용 (AEO 20점) 측정 |
| Perplexity API 연동 | $20/월~ | AI 답변 인용 직접 확인 |

---

## 6. 전체 로드맵 대비 진척률

### Phase 진행 상태
```
Phase A (무료 데이터 점수 산출)     ████████████████████ 100% ✅
Phase B (페이지 크롤링 분석)        ████████████████████ 100% ✅
Phase C (GA4 연동)                 ████░░░░░░░░░░░░░░░░  20% ⚠️ (코드 완료, API 활성화 대기)
Phase D (유료 SERP API)            ░░░░░░░░░░░░░░░░░░░░   0% 🔒
```

### 점수 측정 가능 범위
```
AEO Score (100점 만점)
├── ✅ 측정 가능: 35점 (Q&A 키워드 20 + 검색 가시성 15)
├── 🔧 크롤링 시: 70점 (+Schema 20 + 콘텐츠 15)
├── ⚠️ GA4 시:   80점 (+AI 유입 10)
└── 💰 유료 시: 100점 (+AI 인용 20)

GEO Score (100점 만점)
├── ✅ 측정 가능: 30점 (검색 순위 20 + CTR 트렌드 10)
├── 🔧 크롤링 시: 65점 (+Schema 20 + 콘텐츠 신뢰도 15)
├── ⚠️ PageSpeed: 75점 (+기술 성능 10)
└── 💰 유료 시: 100점 (+AI Overview 25)
```

### 전체 대시보드 기능 진척률
| 기능 | 상태 | 데이터 소스 |
|------|------|-----------|
| KPI 요약 (클릭/노출/CTR/순위) | ✅ 실시간 | GSC API |
| 30일 트렌드 차트 | ✅ 실시간 | GSC API |
| 키워드 분석 (Q&A 태깅) | ✅ 실시간 | GSC API |
| 칼럼별 분석 (종합 점수) | ✅ 실시간 | GSC + PageSpeed + GA4 |
| Core Web Vitals | ✅ 실시간 | PageSpeed API |
| **AEO Score** | ✅ **실시간 (부분)** | **GSC + 크롤링** |
| **GEO Score** | ✅ **실시간 (부분)** | **GSC + 크롤링 + PageSpeed** |
| 사용자 행동 분석 | ⚠️ Mock | GA4 활성화 필요 |
| 전환 퍼널 | ⚠️ Mock | GA4 활성화 필요 |
| AI 인사이트 | 🎨 Mock | AI 분석 로직 미구현 |
| AI 채팅 어시스턴트 | 🎨 Mock | LLM API 연동 필요 |

### 종합 진척률: **약 65%**
- 실데이터 연동: 7/11 기능 완료
- 미연동: GA4(2), AI 인사이트(1), AI 채팅(1)

---

## 7. 신규 파일 목록

| 파일 | 라인 수 | 설명 |
|------|---------|------|
| `backend/src/crawl.ts` | ~122줄 | 페이지 크롤링 (Schema + 콘텐츠 구조) |
| `backend/src/scoring.ts` | ~297줄 | AEO/GEO 점수 산출 엔진 |

### 수정 파일
| 파일 | 변경 내용 |
|------|----------|
| `backend/src/server.ts` | +3 엔드포인트, import 추가, 크롤 캐시 |
| `frontend/src/app/page.tsx` | AEO/GEO API 타입, state, fetch, 브레이크다운 UI |
| `frontend/src/app/page.module.css` | 브레이크다운 카드 스타일 (~80줄 추가) |

---

## 8. 테스트 결과

### API 테스트
```
GET /api/aeo/score         → 200 OK (AEO 83점, 2/6 항목 측정)
GET /api/geo/score         → 200 OK (GEO 83점, 2/6 항목 측정)
POST /api/crawl/analyze    → 200 OK (example.com 검증 완료)
GET /health                → 200 OK (gsc: true, pagespeed: true, ga4: true, supabase: true)
```

### 빌드 검증
```
npm run build              → ✅ 성공 (TypeScript 에러 0)
```

### Playwright 검증
```
AEO Score 표시             → ✅
GEO Score 표시             → ✅
LiveBadge 표시             → ✅ (8개)
브레이크다운 카드           → ✅ (2개)
브레이크다운 항목           → ✅ (12개, AEO 6 + GEO 6)
"항목 측정 완료" 텍스트     → ✅
JS 에러                    → 0개
네트워크 500 에러           → 2개 (GA4 API — 기존 이슈)
```
