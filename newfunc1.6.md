# Phase E: ChatGPT (OpenAI) API 연동 + 스크롤 캡처

> **작성일**: 2026-02-13
> **이전 문서**: newfunc1.5.md (Phase C 완료 + ChatGPT 연동 가이드)

---

## 1. ChatGPT API 연동 완료

### 1.1 환경 설정

| 항목 | 값 |
|------|-----|
| **모델** | GPT-5 mini (`gpt-5-mini`) |
| **API 키** | `.env`에 `OPENAI_API_KEY` 설정 완료 |
| **env.ts 확장** | `OPENAI_API_KEY` (optional), `OPENAI_MODEL` (default: `gpt-5-mini`) |

### 1.2 GPT-5 mini 모델 특성 (구현 중 발견)

| 파라미터 | GPT-4o-mini | GPT-5 mini |
|----------|-------------|------------|
| `max_tokens` | 지원 | **미지원** → `max_completion_tokens` 사용 |
| `temperature` | 0~2 지원 | **기본값(1)만 지원** |
| 응답 길이 | 보통 | **매우 긴 경향** → 프롬프트에 간결함 명시 필요 |

### 1.3 백엔드 구현

**신규 파일**: `backend/src/ai.ts`

**엔드포인트**:

| 엔드포인트 | 메서드 | 설명 | 상태 |
|------------|--------|------|------|
| `/api/ai/insights` | GET | GSC 실데이터 기반 AI 인사이트 4개 생성 | ✅ 정상 |
| `/api/ai/chat` | POST | SEO 전문 AI 채팅 응답 | ✅ 정상 |
| `/health` | GET | `openai: true` 상태 추가 | ✅ |

**AI 인사이트 생성 흐름**:
1. GSC API에서 최근 7일 KPI (클릭/노출/CTR/순위) 수집
2. GSC API에서 상위 20개 키워드 수집
3. 수집 데이터를 GPT-5 mini에 전달
4. 4개 인사이트 생성 (urgent / opportunity / trend / recommend)
5. JSON 배열로 파싱 후 프론트엔드에 전달

**AI 채팅 기능**:
- 시스템 프롬프트: biocom.kr 전문 SEO/AEO/GEO 어시스턴트
- 대화 이력(최대 20턴) 유지
- 300자 이내 간결한 답변 지시
- Zod 유효성 검증

### 1.4 프론트엔드 구현

**AI 인사이트 패널 (오버뷰 탭)**:
- Mock → 실데이터 자동 전환 (API 응답 시 LiveBadge, 실패 시 Mock fallback)
- "AI 분석 중..." 로딩 상태 표시
- 분석 시각 표시 (`generatedAt`)

**AI 채팅 패널 (플로팅)**:
- Mock → 실시간 ChatGPT 응답 전환
- 메시지 입력/전송 기능 구현 (Enter 또는 전송 버튼)
- "답변 생성 중..." 로딩 표시
- 자동 스크롤 (새 메시지 시)
- LiveBadge 적용

### 1.5 API 테스트 결과

**인사이트 API** (`GET /api/ai/insights`):
```json
{
  "insights": [
    {"priority": "urgent", "tag": "콘텐츠", "text": "멜라토닌 노출 2,052·CTR 0.24% 상위콘텐츠 즉시 개선"},
    {"priority": "opportunity", "tag": "스키마", "text": "정보성 키워드에 FAQ·스키마 추가해 CTR 개선"},
    {"priority": "trend", "tag": "브랜드", "text": "브랜드 키워드 클릭 비중 큼, 비브랜드 확장 필요"},
    {"priority": "recommend", "tag": "내링크", "text": "평균순위 6.6, 온페이지·내부링크 최적화 권장"}
  ],
  "model": "gpt-5-mini",
  "dataSource": {
    "kpi": {"totalClicks": 556, "totalImpressions": 16160, "avgCtr": 3.44, "avgPosition": 6.6},
    "topKeywords": ["바이오컴(184클릭)", "지연성 알러지 검사(29)", "음식물 과민증 검사(24)", ...]
  }
}
```

**채팅 API** (`POST /api/ai/chat`):
```
Q: "FAQ 스키마 추가하면 효과가 어떤가요?"
A: "1) 검색결과의 리치 노출(FAQ 스니펫)로 가시성·CTR 증가
    2) AI/GEO 엔진의 답변 소스 채택률 상승
    3) 의료·건강 정보는 출처·문구 검증 필수"
```

---

## 2. 스크롤 캡처 버튼 구현

### 2.1 기능 설명

네비바 우측에 📸 버튼 추가. 클릭 시 현재 활성 탭의 전체 콘텐츠를 캡처하여 PNG로 다운로드.

### 2.2 구현 사양

| 항목 | 내용 |
|------|------|
| 라이브러리 | `html2canvas` |
| 세그먼트 크기 | 2000px (CLAUDE.md 표준) |
| DPR 제한 | max 2 |
| 파일명 형식 | `BiocomAI_{탭이름}_{날짜}.png` |
| 캡처 시 처리 | sticky nav → static, chatFab 숨김 |

### 2.3 UI 위치
```
[🧠 BiocomAI] [오버뷰] [칼럼 분석] ... | [📸] [● 서버 연결됨]
```

---

## 3. 변경 파일 요약

### 백엔드

| 파일 | 변경 |
|------|------|
| `backend/package.json` | `openai` 의존성 추가 |
| `backend/src/env.ts` | `OPENAI_API_KEY`, `OPENAI_MODEL` 추가 |
| `backend/src/ai.ts` | **신규** — OpenAI 클라이언트, 인사이트 생성, 채팅 함수 |
| `backend/src/server.ts` | AI 라우트 2개 추가, health에 openai 상태 추가 |

### 프론트엔드

| 파일 | 변경 |
|------|------|
| `frontend/package.json` | `html2canvas` 의존성 추가 |
| `frontend/src/app/page.tsx` | AI 인사이트/채팅 state + useEffect + API 연동, 스크롤 캡처 함수/버튼/오버레이 |
| `frontend/src/app/page.module.css` | `.captureBtn`, `.captureBtnActive`, `.captureOverlay` 스타일 |

---

## 4. 전체 진행 상황 업데이트

### Phase 진행 상태
```
Phase A (무료 데이터 점수 산출)     ████████████████████ 100% ✅
Phase B (페이지 크롤링 분석)        ████████████████████ 100% ✅
Phase C (GA4 연동)                 ████████████████████ 100% ✅
Phase D (유료 SERP API)            ░░░░░░░░░░░░░░░░░░░░   0% 🔒
Phase E (AI 어시스턴트)            ████████████████████ 100% ✅ ← 금일 완료!
```

### 대시보드 기능 진척률 (업데이트)

| 기능 | 상태 | 데이터 소스 |
|------|------|-----------|
| KPI 요약 | ✅ 실시간 | GSC API |
| 30일 트렌드 차트 | ✅ 실시간 | GSC API |
| 키워드 분석 | ✅ 실시간 | GSC API |
| 칼럼별 분석 | ✅ 실시간 | GSC + PageSpeed + GA4 |
| Core Web Vitals | ✅ 실시간 | PageSpeed API |
| AEO Score | ✅ 실시간 | GSC + 크롤링 |
| GEO Score | ✅ 실시간 | GSC + 크롤링 + PageSpeed |
| 사용자 행동 분석 | ✅ 실시간 | GA4 API |
| 전환 퍼널 | ✅ 실시간 | GA4 API |
| **AI 인사이트** | ✅ **실시간** ← | **GPT-5 mini + GSC 실데이터** |
| **AI 채팅 어시스턴트** | ✅ **실시간** ← | **GPT-5 mini** |

### 종합 진척률: **약 95%** (이전 82% → 95%)
- 실데이터 연동: **11/11 기능 완료** (이전 9/11)
- 미구현: SERP API (유료, Phase D) — AEO AI인용(+20점), GEO AI Overview(+25점) 측정

---

## 5. 빌드 검증

| 항목 | 결과 |
|------|------|
| Frontend `npm run build` | ✅ 성공 |
| Backend `tsc --noEmit` | ✅ 성공 |
| Backend health API | ✅ `openai: true` |
| AI insights API | ✅ 4개 인사이트 생성 |
| AI chat API | ✅ 정상 응답 |

---

## 6. 서버 상태

| 서버 | 포트 | 상태 |
|------|------|------|
| 프론트엔드 | http://localhost:7010 | ✅ 실행 중 |
| 백엔드 | http://localhost:7020 | ✅ 실행 중 |

### 접속 확인
- 대시보드: http://localhost:7010
- 백엔드 API: http://localhost:7020/health
- AI 인사이트: http://localhost:7020/api/ai/insights
- AI 채팅: `POST http://localhost:7020/api/ai/chat`

---

## 7. 예상 비용 (GPT-5 mini)

| 사용 패턴 | 예상 월 비용 |
|-----------|-------------|
| 인사이트 생성 10회/일 | ~$1~3 |
| 채팅 50회/일 | ~$3~5 |
| **합계** | **~$4~8/월** |
