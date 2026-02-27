# report0221-front1.1 — 프론트엔드 Phase F1 개발 결과 (가중치 산식 반영)

작성일: 2026-02-21
작성: 헤파이스토스 (코딩 에이전트)
범위: `report0221-feedbackfront1.0.md` 피드백 5가지 + `aio포함여부및가중치산식.md` 결정사항 반영
상태: **프론트 + 백엔드 타입체크 통과, 빌드 성공, 서버 기동 확인**

---

## 0) 반영한 결정사항 요약

### A. 피드백 5가지 (report0221-feedbackfront1.0.md)

| # | 피드백 | 반영 상태 | 구현 방식 |
|---|--------|-----------|-----------|
| 1 | verdict를 텍스트 파싱하지 말고 API의 구조화된 필드 사용 | ✅ 완료 | `/api/ai/citation`의 `verdict` 필드를 타입(`CitationVerdict`)으로 직접 매핑. `VERDICT_META` 상수로 UI 렌더링 |
| 2 | AI 인용도는 도메인 단위임을 UI에 표기 + 현재 URL 인용 시 배지 | ✅ 완료 | `citationNotice` 안내 문구 + `urlCitedBanner`로 현재 URL이 matchedReferences에 있을 때 강조 |
| 3 | 빠른/정밀 진단 모드 분리 (대기시간/비용 안내) | ✅ 완료 | "빠른 진단" (Crawl+AEO/GEO) vs "정밀 진단" (+PageSpeed+AI 인용도) 버튼 분리. 단계별 프로그레스 표시 |
| 4 | 표본 키워드 선택 기준 표시 | ✅ 완료 | `sampleHint`로 "최근 30일 노출 상위 기준 N개" 표시 |
| 5 | 컴포넌트 분리 (최소 4개) | ✅ 완료 | `AiCitationSection`, `ProviderCards`, `CitationSamplesTable`, `CompetitorDomainsTable` 분리 |

### B. 가중치/산식 결정 (aio포함여부및가중치산식.md)

| 결정 | 내용 | 반영 상태 |
|------|------|-----------|
| Google AIO 점수 산식 제외 | KR 운영 점수에서 제외, 참고용 벤치마크로만 표시 | ✅ 백엔드 + 프론트 반영 |
| 가중치 8:2 | ChatGPT(Search) 0.8 + Perplexity 0.2 | ✅ 백엔드 scoring.ts + 프론트 UI 반영 |
| 활성 프로바이더 재정규화 | eligible >= 3인 프로바이더만 점수에 반영 | ✅ 백엔드 반영 |
| 프론트 점수 규칙 표시 | UI에 산식과 가중치를 명시 | ✅ 프론트 반영 |

---

## 1) 구현 내용 상세

### 1-1. 새로 생성한 파일 (7개)

```
frontend/src/components/diagnosis/
├── types.ts                    # 공유 타입 + PROVIDER_META + VERDICT_META 상수
├── AiCitationSection.tsx       # 메인 컨테이너 (verdict + 가중치 안내 + URL 인용 배지)
├── ProviderCards.tsx            # 프로바이더 카드 (점수 반영 그룹 / 참고용 벤치마크 그룹 분리)
├── CitationSamplesTable.tsx     # 표본 키워드별 프로바이더 상태 테이블 (아코디언)
├── CompetitorDomainsTable.tsx   # 경쟁 출처 TOP 15 도메인 (아코디언)
├── AiCitation.module.css        # 전용 CSS 모듈
└── index.ts                     # barrel export
```

### 1-2. 수정한 파일 (3개)

**`backend/src/scoring.ts`** — 변경 내용:
- AEO "AI 답변 인용 빈도(20점)" 산식 완전 재작성:
  - `PROVIDER_WEIGHTS`: ChatGPT 0.8, Perplexity 0.2
  - `MIN_ELIGIBLE = 3`: eligible < 3인 프로바이더는 미활성 처리
  - 가중 인용률: `sum(w * citationRate) / sum(w for active)` 재정규화
  - Google AIO는 `detail` 텍스트에서 "참고" 태그 표시
  - 활성 프로바이더 없으면 `status: "estimated"` (이전: 항상 "measured")
  - detail 문자열에 가중치/활성 기준/가중 인용률 포함

**`frontend/src/app/page.tsx`** — 변경 내용:
- import 추가: `AiCitationSection`, `AiCitationApiResponse`
- state 추가: `diagCitation`, `diagCitationLoading`, `diagMode`, `diagStep`
- `handleDiagnosisTest()` 완전 재작성 (빠른/정밀 모드)
- Tab 6 UI 수정: 2개 버튼 + AI 인용도 섹션 + 로딩 표시

**`frontend/src/app/page.module.css`** — 변경 내용:
- `.cwvTestBtnDetailed`, `.diagModeHint` 추가

### 1-3. 점수 산식 (백엔드 + 프론트 동일 로직)

```
점수 대상: Google AIO 제외, ChatGPT(Search) + Perplexity만
활성 기준: eligible >= 3

가중 인용률 = sum(w_p * citationRate_p) / sum(w_p)  (활성 프로바이더만)
  - w_chatgpt = 0.8
  - w_perplexity = 0.2

AEO 점수 = min(20, round(가중 인용률 * 200))
  → 가중 인용률 10% 이상이면 20점 만점

활성 프로바이더가 0개면:
  - 점수: 0
  - status: "estimated" (측정 불완전)
```

### 1-4. 프론트 UI 구조

```
<AiCitationSection>
  ├── 헤더: "AI 답변 인용도 분석" + 프로바이더 수
  ├── 도메인 안내: "AI 인용도는 biocom.kr 전체 기준 + 산식: ChatGPT 80% + Perplexity 20%"
  ├── (조건) URL 인용 배너: "이 페이지가 AI 출처에 직접 인용됨"
  ├── verdict 카드: 노출 없음 / 인용 없음 / 인용 확인
  ├── 종합 지표: 가중 인용률, 전체 인용, 측정 시각
  │
  ├── <ProviderCards>
  │   ├── 점수 반영 (ChatGPT 80% + Perplexity 20%)
  │   │   ├── ChatGPT Search [w=80%] + eligible/cited/인용률
  │   │   └── Perplexity [w=20%] + eligible/cited/인용률
  │   └── 참고용 벤치마크
  │       └── Google AI Overview [참고용] (점선 테두리, 반투명)
  │
  ├── <CitationSamplesTable> (아코디언)
  │   └── 키워드별 프로바이더 exposure/cited + biocom 인용 여부
  │
  └── <CompetitorDomainsTable> (아코디언)
      └── 도메인별 인용 횟수 + 프로바이더 + "내 사이트" 하이라이트
```

### 1-5. 데이터 흐름

```
[정밀 진단 클릭]
    ↓
Step 1: POST /api/crawl/analyze → diagCrawlResult
    ↓
Step 2: POST /api/pagespeed/run → 서버 캐시
    ↓
Step 3: GET /api/aeo/score + GET /api/geo/score → diagAeoScore, diagGeoScore
    (↑ scoring.ts가 가중치 산식으로 AI 인용도 20점 계산)
    ↓
Step 4: GET /api/ai/citation?sampleSize=5 → diagCitation
    ↓
[렌더링: <AiCitationSection> with 점수 반영/참고용 분리]
```

---

## 2) 검증 결과

| 검증 항목 | 결과 |
|-----------|------|
| 백엔드 TypeScript typecheck | ✅ 통과 (에러 0) |
| 프론트 TypeScript typecheck | ✅ 통과 (에러 0) |
| Next.js 빌드 (`npm run build`) | ✅ 성공 ("Compiled successfully") |
| 프론트엔드 서버 (localhost:7010) | ✅ 200 OK |
| 백엔드 서버 (localhost:7020) | ✅ 200 OK |

---

## 3) 미해결 이슈

### 이슈 1: 실제 API 호출 E2E 테스트 미완

- `/api/ai/citation` 호출 시 SerpAPI/OpenAI/Perplexity 실제 쿼터 소모.
- **TJ님이 "정밀 진단" 버튼 클릭으로 수동 확인 필요.**
- 특히 확인할 것:
  - ChatGPT/Perplexity eligible이 3 이상인지 (미만이면 "미활성" 표시가 뜸)
  - Google AIO가 "참고용 벤치마크" 그룹에 올바르게 분리되는지
  - 가중 인용률이 AEO Score breakdown과 일치하는지

### 이슈 2: SerpAPI Free Plan 쿼터

- Google AIO는 점수 산식에서 빠졌지만, `/api/ai/citation`은 여전히 3개 프로바이더를 모두 호출함.
- SerpAPI 쿼터를 완전히 절약하려면 `providers=chatgpt_search,perplexity` 파라미터로 제한 필요.
- **다음 단계(Phase F3)에서 UI 프로바이더 선택 옵션 추가 검토.**

### 이슈 3: "이 페이지 인용" 판정 정확도

- 단순 문자열 비교(`link.includes(...)`)로 판정.
- Strict/Broad 매칭 분리는 `report0221-feedback3.md`의 보완점 #1과 연결.
- Broad 매칭 시 SSRF 방지 가드 필요 (보안 이슈).

### 이슈 4: 점수 정책 1장 문서 미작성

- `report0221-feedback3.md`에서 "점수 정책 1장 문서 고정"을 강력 권장.
- 산식/참고 지표/0점 분해 규칙을 1장에 정리하여 팀 공유용으로 확정 필요.
- **이 문서가 나오면 UI 문구를 최종 확정 가능.**

### 이슈 5: 메타 설명 길이 이상값 (3590자)

- 백엔드 `crawl.ts` 파싱 이슈로 추정. 프론트 이슈 아님.

---

## 4) 다음 단계

### 즉시 (TJ님 확인 필요)

1. **"정밀 진단" 클릭** → 실제 데이터 렌더링 확인
2. **점수 정책 1장 문서** 확정 (산식 + 참고 지표 + 운영 룰)

### Phase F2 (1~2일)

1. 점수 카드 링 차트 통일
2. PageSpeed 연동 검증
3. 진단 프로그레스 체크마크 UI

### Phase F3 (1~2일)

1. 감점 요인에 AI 인용도/기술 성능 항목 추가
2. 프로바이더 선택 옵션 (SerpAPI 쿼터 절약)
3. 진단 결과 내보내기 + URL 히스토리

---

## 5) 변경 파일 목록 (전체)

| 파일 | 변경 유형 |
|------|-----------|
| `backend/src/scoring.ts` | **수정** (가중치 산식 ChatGPT 0.8 + Perplexity 0.2 + 재정규화) |
| `frontend/src/components/diagnosis/types.ts` | 신규 생성 |
| `frontend/src/components/diagnosis/AiCitationSection.tsx` | 신규 생성 → **수정** (가중 인용률 표시 + 산식 안내) |
| `frontend/src/components/diagnosis/ProviderCards.tsx` | 신규 생성 → **수정** (점수 반영/참고용 분리 + 가중치 배지) |
| `frontend/src/components/diagnosis/CitationSamplesTable.tsx` | 신규 생성 |
| `frontend/src/components/diagnosis/CompetitorDomainsTable.tsx` | 신규 생성 |
| `frontend/src/components/diagnosis/AiCitation.module.css` | 신규 생성 → **수정** (providerSection/GroupTitle/배지 추가) |
| `frontend/src/components/diagnosis/index.ts` | 신규 생성 |
| `frontend/src/app/page.tsx` | 수정 (import + state + handler + UI) |
| `frontend/src/app/page.module.css` | 수정 (2개 클래스 추가) |
