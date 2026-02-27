# report0221-front1.2 — 프론트엔드 Phase F1.2 개발 결과

작성일: 2026-02-21
작성: 헤파이스토스 (코딩 에이전트)
범위: CSS 버그 수정 + 하위 페이지 탐색 + 진단 히스토리 + 개선 목록
상태: **프론트 + 백엔드 타입체크 통과, 빌드 성공, 서버 기동 확인**

---

## 0) 반영한 요청사항 요약

| # | 요청 | 반영 상태 | 구현 방식 |
|---|------|-----------|-----------|
| 1 | AEO Score 바 그래프가 비어 보이는 버그 | ✅ 수정 완료 | Tab 6 breakdownBarFill에 색상 클래스(Good/Warn/Poor) 추가 |
| 2 | 하위 페이지 탐색 기능 | ✅ 구현 완료 | 백엔드 `/api/crawl/subpages` + 프론트 "하위 페이지 탐색" 버튼/목록 |
| 3 | 진단 히스토리 저장/조회 | ✅ 구현 완료 | 백엔드 JSON 파일 기반 CRUD + 프론트 히스토리 패널 |
| 4 | 개선 필요 사항 목록화 | ✅ 아래 섹션 참조 |

---

## 1) 구현 내용 상세

### 1-1. CSS 버그 수정: AEO Score breakdown bar 색상 누락

**문제**: Tab 6(페이지 진단) AEO/GEO Score 상세 breakdown bar가 올바른 width를 갖지만 배경색이 투명하여 빈 막대로 보임.

**원인**: `page.tsx` Tab 6에서 `breakdownBarFill`에 색상 클래스(`breakdownBarGood`/`breakdownBarWarn`/`breakdownBarPoor`)를 적용하지 않았음. Overview 탭(Tab 1)에서는 올바르게 적용되어 있었으나 Tab 6에는 누락.

**수정**:
```jsx
// Before (Tab 6, line 3714)
<div className={styles.breakdownBarFill} style={{ width: ... }} />

// After
<div className={`${styles.breakdownBarFill} ${score/maxScore >= 0.7 ? styles.breakdownBarGood : >= 0.4 ? styles.breakdownBarWarn : styles.breakdownBarPoor}`} style={{ width: ... }} />
```

**파일**: `frontend/src/app/page.tsx` (1줄 수정)

---

### 1-2. 하위 페이지 탐색 (Sub-page Discovery)

**문제**: `https://biocom.kr/healthinfo`를 진단하면 부모 페이지만 분석됨. 실제 건강칼럼 콘텐츠는 `?bmode=view&idx=3776655` 등의 하위 페이지에 존재.

**구현**:

#### 백엔드
- `crawl.ts`에 `discoverSubpages()` 함수 추가
  - 부모 URL을 크롤링하여 동일 도메인 내 하위 페이지 링크 추출
  - 경로 하위(`/healthinfo/xxx`) 또는 쿼리 파라미터 차이(`?bmode=view&idx=...`) 모두 감지
  - 자기 자신 제외, 파일(이미지/PDF 등) 제외, 최대 50개
- `server.ts`에 `POST /api/crawl/subpages` 엔드포인트 추가

#### 프론트엔드
- "하위 페이지 탐색" 버튼 추가
- 발견된 하위 페이지 목록을 카드로 표시
- 각 하위 페이지에 URL 선택 + "진단" 원클릭 버튼
- 클릭 시 diagUrl 업데이트 → 바로 빠른 진단 실행

#### 테스트 결과
```json
POST /api/crawl/subpages { "url": "https://biocom.kr/healthinfo", "maxLinks": 10 }
→ 8개 하위 페이지 발견 (새해 건강 목표, 디메틸글리신, 리포조말 비타민C, 키토제닉 식단, SIBO, 마이크로바이옴, L-테아닌, 칼럼 오픈)
```

---

### 1-3. 진단 히스토리 (Diagnosis History)

**문제**: 진단 결과가 휘발성이어서, 브라우저를 닫으면 과거 진단 기록을 확인할 수 없음.

**구현**:

#### 백엔드
- JSON 파일 기반 영속 저장 (`backend/data/diagnosis-history.json`)
- 3개 엔드포인트:
  - `GET /api/diagnosis/history` — 전체 기록 조회 (최신순)
  - `POST /api/diagnosis/save` — 새 진단 기록 저장
  - `DELETE /api/diagnosis/history/:id` — 특정 기록 삭제
- 최대 100건 유지 (초과 시 오래된 것부터 삭제)
- 각 기록에 포함: id, url, mode, aeoScore, geoScore, crawlSummary, createdAt

#### 프론트엔드
- "진단 히스토리" 토글 버튼 추가
- 히스토리 패널: 날짜/시간, 진단 모드(빠른/정밀), URL, AEO/GEO 점수 표시
- "재진단" 버튼으로 동일 URL 동일 모드로 재실행
- 진단 완료 시 자동 저장 (별도 조작 불필요)

#### 데이터 흐름
```
[진단 실행] → Step 1~4 완료 → POST /api/diagnosis/save (비동기) → 히스토리 자동 갱신
[히스토리 열기] → GET /api/diagnosis/history → 목록 렌더링
[재진단 클릭] → diagUrl 설정 → handleDiagnosisTest 실행
```

---

## 2) 추가 개선 필요사항 목록

### 우선순위 높음

| # | 개선 항목 | 이유 |
|---|-----------|------|
| 1 | **하위 페이지 제목 정제** | 현재 하위 페이지 title이 "공지 새해 건강 목표를 설정하는 방법..." 형태로 "공지" 접두사가 포함됨. 게시판 카테고리를 제거하고 실제 제목만 표시해야 가독성 향상 |
| 2 | **하위 페이지 페이지네이션** | 현재 부모 URL의 첫 페이지에 있는 링크만 탐색. 게시판 2페이지, 3페이지의 글도 탐색하려면 페이지네이션 크롤링 필요 |
| 3 | **진단 히스토리 상세 보기** | 현재 점수만 저장. breakdown 상세(각 항목별 점수), 감점 요인, 콘텐츠 구조 등을 모두 저장하여 과거 진단을 완전히 재현할 수 있어야 함 |
| 4 | **점수 추이 차트** | 동일 URL의 히스토리 데이터를 시계열 차트(라인/바)로 표시. AEO/GEO 점수 변화를 시각적으로 추적 가능 |
| 5 | **Intent 분류 실패** | 백엔드 로그에 `[Intent GPT] 분류 실패: Unexpected end of JSON input` 반복. OpenAI API 응답 파싱 문제 — intent 분류가 동작하지 않으면 키워드 의도 분석 기능이 비활성화됨 |

### 우선순위 중간

| # | 개선 항목 | 이유 |
|---|-----------|------|
| 6 | **일괄 진단 기능** | 하위 페이지 여러 개를 한꺼번에 진단(큐 방식). 현재는 하나씩 클릭해야 함. 건강칼럼이 수십~수백 개이므로 일괄 처리 필요 |
| 7 | **진단 결과 PDF/CSV 내보내기** | 보고서를 외부 공유하거나 아카이빙할 때 필요. 특히 경영진 보고용 |
| 8 | **점수 카드 링 차트 통일** | Overview 탭과 Tab 6 점수 표시 스타일이 상이. 링 차트(도넛 차트)로 통일하면 시각적 일관성 향상 |
| 9 | **메타 설명 길이 이상값** | 이전 세션에서 발견된 이슈(3590자). crawl.ts가 실제 메타 태그가 아닌 다른 것을 파싱하고 있을 수 있음 |
| 10 | **프로바이더 선택 옵션** | AI 인용도 측정 시 Google AIO를 제외하면 SerpAPI 쿼터 절약. UI에서 측정할 프로바이더를 선택할 수 있으면 비용 관리 가능 |

### 우선순위 낮음

| # | 개선 항목 | 이유 |
|---|-----------|------|
| 11 | **DB 마이그레이션** | 현재 JSON 파일 기반 히스토리 저장. 데이터 양이 늘면 Supabase/PostgreSQL로 이전 필요 |
| 12 | **Broad URL 매칭 보안** | AI 인용도의 "이 페이지 인용" 판정이 단순 문자열 비교. SSRF 방지 가드 추가 필요 |
| 13 | **점수 정책 1장 문서** | AEO/GEO 산식, 가중치, 참고 지표, 0점 규칙을 팀 공유용으로 확정 — UI 문구 최종 확정의 전제조건 |
| 14 | **CWV 자동 측정 대상 확대** | 현재 biocom.kr 메인만 자동 측정. healthinfo 하위 주요 페이지도 자동 측정 대상에 포함 검토 |

---

## 3) 검증 결과

| 검증 항목 | 결과 |
|-----------|------|
| 백엔드 TypeScript typecheck | ✅ 통과 (에러 0) |
| 프론트 TypeScript typecheck | ✅ 통과 (에러 0) |
| Next.js 빌드 (`npm run build`) | ✅ 성공 ("Compiled successfully") |
| 프론트엔드 서버 (localhost:7010) | ✅ 200 OK |
| 백엔드 서버 (localhost:7020) | ✅ 200 OK |
| `/api/crawl/subpages` 테스트 | ✅ 8개 하위 페이지 발견 |
| `/api/diagnosis/history` 테스트 | ✅ 200 OK (빈 배열 정상 반환) |

---

## 4) 변경 파일 목록

| 파일 | 변경 유형 |
|------|-----------|
| `backend/src/crawl.ts` | **수정** (discoverSubpages 함수 추가 + 쿼리 파라미터 기반 하위 페이지 감지) |
| `backend/src/server.ts` | **수정** (3개 엔드포인트 추가: subpages, history CRUD) |
| `frontend/src/app/page.tsx` | **수정** (CSS 버그 수정 + 하위 페이지/히스토리 state/handler/UI) |
| `frontend/src/app/page.module.css` | **수정** (하위 페이지 + 히스토리 CSS 스타일 추가) |

---

## 5) 다음 단계 (Phase F2)

### 즉시 (TJ님 확인 필요)
1. **프론트 브라우저에서 기능 테스트**
   - Tab 6에서 AEO Score 바 그래프가 올바르게 채워지는지 확인
   - "하위 페이지 탐색" 클릭 → 하위 페이지 목록 → 개별 "진단" 클릭
   - "진단 히스토리" 클릭 → 과거 기록 확인 → "재진단" 클릭
2. **Intent 분류 실패 원인 확인** (OpenAI API 응답 이슈)

### 1~2일 내
1. 점수 카드 링 차트 통일
2. 히스토리 상세 저장 (breakdown 포함)
3. 점수 추이 차트

### 1주 내
1. 일괄 진단 기능 (큐 방식)
2. 진단 결과 PDF/CSV 내보내기
3. 프로바이더 선택 옵션 (SerpAPI 쿼터 절약)
