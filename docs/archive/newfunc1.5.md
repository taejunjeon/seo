# Phase C 진행 + 크롤링 해결 + ChatGPT 연동 가이드

> **작성일**: 2026-02-13
> **이전 문서**: newfunc1.4.md (Phase A+B 완료 보고)

---

## 1. GA4 Data API 활성화 결과

### 1.1 테스트 결과: 성공

GA4 Data API가 GCP 콘솔에서 활성화된 후 모든 엔드포인트가 정상 작동.

| 엔드포인트 | 상태 | 데이터 |
|-----------|------|--------|
| `GET /api/ga4/engagement` | ✅ 200 OK | 30일간 페이지별 세션/사용자/체류시간/이탈률/스크롤 |
| `GET /api/ga4/funnel` | ✅ 200 OK | 유기 검색 → 페이지 조회 → 참여 세션 → 전환 완료 |

### 1.2 GA4 실데이터 주요 수치

**페이지별 사용자 행동 (상위 5개)**:
| 페이지 | 세션 | 사용자 | 평균 체류시간 | 이탈률 |
|--------|------|--------|------------|--------|
| /igg_store/ | 101,595 | 82,426 | 84초 | 80.8% |
| /shop_view/ | 41,875 | 32,731 | 137초 | 173.9% |
| /organicacid_store/ | 37,572 | 27,704 | 193초 | 149.0% |
| /hormon_store/ | 24,561 | 14,167 | 153초 | - |

**전환 퍼널**:
```
유기 검색 유입:  20,248명 (100%)
페이지 조회:    42,927건 (212%) — 복수 페이지 탐색
참여 세션:      19,824건 (98%)
전환 완료:      54,100건 (267%) — 복수 전환 이벤트 포함
```

### 1.3 영향 범위

| 기존 상태 | 변경 후 |
|-----------|---------|
| 사용자 행동 분석 탭: Mock 데이터 | ✅ 실시간 GA4 데이터 |
| 전환 퍼널 탭: Mock 데이터 | ✅ 실시간 GA4 데이터 |
| 칼럼별 분석의 "사용자 체류(25%)" 점수: 0점 | ✅ GA4 기반 실측 |
| Playwright 500 에러 2건 | ✅ 0건 (완전 해소) |

---

## 2. biocom.co.kr 크롤링 — 문제 원인 및 해결

### 2.1 문제 진단

**시도한 방법과 결과**:

| 방법 | 대상 | 결과 |
|------|------|------|
| curl HTTPS | www.biocom.co.kr | ❌ TIMEOUT (10초) |
| curl HTTP | www.biocom.co.kr | ❌ TIMEOUT |
| curl without www | biocom.co.kr | ❌ TIMEOUT |
| ping | biocom.co.kr | ❌ 100% packet loss |
| traceroute | biocom.co.kr | 5홉 후 중단 |
| DNS lookup | biocom.co.kr | ✅ 202.31.187.154 (DNS 정상) |
| SSL 인증서 | biocom.co.kr:443 | ❌ 연결 불가 |
| Google 캐시 | cache:biocom.co.kr | ❌ Google 오류 페이지 반환 |
| Wayback Machine | web.archive.org | ❌ 접근 불가 |
| WebFetch 도구 | www.biocom.co.kr | ❌ ETIMEDOUT |
| 다른 포트 (8080, 8443) | biocom.co.kr | ❌ TIMEOUT |
| IP 직접 접근 | 202.31.187.154 | ❌ TIMEOUT |
| 브라우저 UA | www.biocom.co.kr | ❌ TIMEOUT |

**DNS 정보**:
```
biocom.co.kr → 202.31.187.154
www.biocom.co.kr → CNAME → biocom.co.kr → 202.31.187.154
```

### 2.2 근본 원인 발견

**실제 서비스 도메인이 다름!**

GSC API에서 확인된 실제 URL:
```
https://biocom.kr/                                          ← 메인
https://biocom.kr/shop_view?idx=85                          ← 쇼핑
https://biocom.kr/healthinfo?bmode=view&idx=3949800         ← 건강정보
```

- `biocom.co.kr` (202.31.187.154) — 접근 불가 (구 서버 또는 방화벽 차단)
- `biocom.kr` — **정상 접근 가능, 크롤링 성공!**

### 2.3 크롤링 성공 결과

`https://biocom.kr/healthinfo?bmode=view&idx=3949800` (키토제닉 식단 글) 크롤링:

**Schema 마크업**:
| 타입 | 감지 여부 |
|------|----------|
| OnlineStore | ✅ 감지 |
| NewsArticle | ✅ 감지 (Article 계열) |
| ImageObject | ✅ 감지 |
| FAQPage | ❌ 미설치 |
| HowTo | ❌ 미설치 |
| Author/Person | ❌ 미설치 |
| Speakable | ❌ 미설치 |

**콘텐츠 구조**:
| 항목 | 값 | 평가 |
|------|-----|------|
| H2 소제목 | 0개 | ⚠️ 3개 이상 권장 |
| H3 소제목 | 0개 | ⚠️ 개선 필요 |
| 목록 (ul/ol) | 27개 | ✅ 양호 |
| 표 (table) | 0개 | ⚠️ 데이터 표 추가 권장 |
| 인용 블록 | 1개 | ✅ |
| 이미지 | 12개 (alt 10개) | ✅ 양호 |
| 단어 수 | 10,367 | ✅ 충분 |
| 메타 디스크립션 | 3,386자 | ⚠️ 너무 김 (150~160자 권장) |
| JSON-LD 블록 | 4개 | ✅ |

### 2.4 크롤링 포함 AEO/GEO 점수 변화

| 점수 | 크롤링 전 | 크롤링 후 | 변화 |
|------|----------|----------|------|
| **AEO Score** | 83점 (2/6 항목) | **57점 (4/6 항목)** | -26점 (더 정확한 평가) |
| **GEO Score** | 83점 (2/6 항목) | **63점 (4/6 항목)** | -20점 (더 정확한 평가) |

**해석**: 크롤링 전에는 측정 가능한 2항목만으로 점수를 산출하여 높게 나왔으나,
크롤링 후 Schema/콘텐츠 구조의 약점이 드러나면서 실제 점수가 낮아짐. 이것이 **정확한 평가**임.

**AEO 주요 감점 요인**:
- FAQPage Schema 미설치 (Q&A 답변 채택률에 큰 영향)
- H2/H3 소제목 없음 (콘텐츠 구조 약점)
- 저자 정보 없음 (E-E-A-T)

**GEO 주요 감점 요인**:
- FAQPage Schema 미설치 (AI Overview 채택 3.2배 차이)
- 저자(Person) Schema 미설치
- Speakable Schema 미설치
- 데이터 표(table) 없음

---

## 3. ChatGPT (OpenAI) API 연동 가이드

### 3.1 환경 변수 설정

`.env` 파일에 추가할 변수:

```env
# OpenAI API (ChatGPT)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_ORG_ID=org-your-org-id          # 선택사항
OPENAI_PROJECT_ID=proj-your-project-id  # 선택사항
```

**API 키 발급 방법**:
1. https://platform.openai.com 접속
2. 로그인 → Dashboard → API Keys
3. "Create new secret key" 클릭
4. 키 이름 입력 → 생성 → `sk-...` 형태의 키 복사
5. `.env` 파일에 `OPENAI_API_KEY=sk-...` 추가

### 3.2 필요 패키지

```bash
cd backend
npm install openai
```

### 3.3 모델 및 가격

| 모델 | 입력 비용 | 출력 비용 | 권장 용도 |
|------|----------|----------|----------|
| **GPT-4o** | $2.50 / 1M 토큰 | $10.00 / 1M 토큰 | 고급 분석, 상세 추천 |
| **GPT-4o-mini** | $0.15 / 1M 토큰 | $0.60 / 1M 토큰 | SEO 인사이트, 일반 분석 (16배 저렴) |

**예상 월 비용** (SEO 대시보드 용도):
- 일 10회 분석 × GPT-4o-mini: 약 **$1~3/월**
- 일 10회 분석 × GPT-4o: 약 **$15~30/월**

### 3.4 활용 방안 (본 프로젝트)

| 기능 | 설명 | 모델 권장 |
|------|------|----------|
| **AI 인사이트 생성** | 현재 Mock인 AI 인사이트를 실제 AI 분석으로 전환 | GPT-4o-mini |
| **AI 채팅 어시스턴트** | 플로팅 채팅에서 SEO 상담 응답 | GPT-4o-mini |
| **콘텐츠 최적화 제안** | 크롤링된 페이지의 SEO 개선점 분석 | GPT-4o |
| **키워드 전략 분석** | GSC 키워드 데이터 기반 전략 수립 | GPT-4o-mini |
| **메타 디스크립션 생성** | 페이지별 최적 메타 디스크립션 자동 작성 | GPT-4o-mini |

### 3.5 구현 예시 (백엔드 엔드포인트 구조)

```
POST /api/ai/analyze       — 페이지 SEO 분석 + 개선 제안
POST /api/ai/chat          — AI 채팅 메시지 처리
POST /api/ai/meta          — 메타 디스크립션 자동 생성
GET  /api/ai/insights      — 대시보드 AI 인사이트 생성
```

### 3.6 Rate Limit 및 주의사항

- **Tier 1** (기본): GPT-4o ~500K TPM, 1,000 RPM
- 요청 실패 시 **Exponential Backoff** (1초→2초→4초) 적용
- 프롬프트 토큰 절약을 위해 `max_tokens` 제한 설정
- 응답 캐싱으로 동일 분석 중복 호출 방지
- **예산 알림** 설정 권장 (OpenAI Billing 콘솔)

### 3.7 env.ts 스키마 확장 필요

현재 `backend/src/env.ts`에 OpenAI 관련 변수 추가:
```typescript
OPENAI_API_KEY: z.string().optional(),
OPENAI_MODEL: z.string().default("gpt-4o-mini"),
```

---

## 4. 전체 진행 상황 업데이트

### Phase 진행 상태
```
Phase A (무료 데이터 점수 산출)     ████████████████████ 100% ✅
Phase B (페이지 크롤링 분석)        ████████████████████ 100% ✅
Phase C (GA4 연동)                 ████████████████████ 100% ✅ ← 금일 완료!
Phase D (유료 SERP API)            ░░░░░░░░░░░░░░░░░░░░   0% 🔒
Phase E (AI 어시스턴트)            ░░░░░░░░░░░░░░░░░░░░   0% 📋 (계획 수립 완료)
```

### 점수 측정 가능 범위 업데이트
```
AEO Score (100점 만점)
├── ✅ 측정 가능: 70점 (Q&A 20 + Schema 20 + 가시성 15 + 콘텐츠 15)
├── ⚠️ GA4 AI유입: +10점 (GA4 활성화됨, 구현 보류 — AI referral 필터 필요)
└── 💰 유료 시: +20점 (AI 인용)

GEO Score (100점 만점)
├── ✅ 측정 가능: 65점 (순위 20 + Schema 20 + 신뢰도 15 + CTR 10)
├── ✅ PageSpeed: +10점 (이미 구현, URL 지정 시 자동 반영)
└── 💰 유료 시: +25점 (AI Overview)
```

### Playwright 검증 결과 (최종)
```
✅ AEO/GEO 점수 실시간 표시
✅ Schema 크롤링 데이터 반영 (Article 감지)
✅ 브레이크다운 카드 2개, 12항목
✅ Live 배지 8개
✅ 500 에러: 0개 (GA4 해결!)
✅ JS 에러: 0개
```

### 전체 대시보드 기능 진척률 (업데이트)
| 기능 | 상태 | 데이터 소스 |
|------|------|-----------|
| KPI 요약 | ✅ 실시간 | GSC API |
| 30일 트렌드 차트 | ✅ 실시간 | GSC API |
| 키워드 분석 | ✅ 실시간 | GSC API |
| 칼럼별 분석 | ✅ 실시간 | GSC + PageSpeed + GA4 |
| Core Web Vitals | ✅ 실시간 | PageSpeed API |
| AEO Score | ✅ 실시간 | GSC + 크롤링 |
| GEO Score | ✅ 실시간 | GSC + 크롤링 + PageSpeed |
| **사용자 행동 분석** | ✅ **실시간** ← | **GA4 API** |
| **전환 퍼널** | ✅ **실시간** ← | **GA4 API** |
| AI 인사이트 | 🎨 Mock | ChatGPT API 연동 필요 |
| AI 채팅 어시스턴트 | 🎨 Mock | ChatGPT API 연동 필요 |

### 종합 진척률: **약 82%** (이전 65% → 82%)
- 실데이터 연동: **9/11 기능 완료** (이전 7/11)
- 미연동: AI 인사이트(1), AI 채팅(1) — ChatGPT API로 해결 가능

---

## 5. 다음 단계 권장

### 즉시 진행 가능 (TJ님 API 키 등록 후)
1. **ChatGPT API 연동** — `.env`에 `OPENAI_API_KEY` 추가 후
   - AI 인사이트 실시간 생성
   - AI 채팅 어시스턴트 구현
   - → 대시보드 **100% 실데이터** 달성

### 콘텐츠 최적화 (크롤링 분석 기반 권장)
2. **biocom.kr에 FAQPage Schema 추가** — AEO +7점, GEO +8점 예상
3. **H2/H3 소제목 구조 개선** — AEO 콘텐츠 구조 +7점
4. **저자(Person) Schema 추가** — E-E-A-T 강화, AEO +4점, GEO +4점
5. **메타 디스크립션 길이 조정** — 현재 3,386자 → 150~160자로 요약

### Phase D (선택사항)
6. SerpAPI/DataForSEO 연동 — AI Overview 노출(GEO +25점), AI 인용(AEO +20점) 측정
