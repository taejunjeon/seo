# report0221-back3 — feedback3 반영: KR 운영 점수 정렬 + Strict/Broad 인용 매칭(백엔드)

작성일: 2026-02-21  
범위: `report0221-feedback3.md` 피드백 반영한 **백엔드 추가 개발** + 사용 방법/결과 문서화  
전제: 목표 시장은 한국/한국어(기본값 hl=ko, gl=kr). 프론트는 이번 범위에서 제외.

---

## 0) 결론(요약)

피드백3에서 지적한 “KR 고정 환경에서 Google AIO(SerpAPI)와 KPI가 충돌할 수 있음 / 점수 산식과 멀티 프로바이더 UI 어긋남 / cited 도메인 매칭 경계”를 아래처럼 **백엔드 레벨에서 우선 해결**했소.

1) **AEO(20점) 산식 정렬**: KR 운영 점수에서 Google AIO를 **점수 산식에서 제외(참고용)**하도록 변경  
2) **비용/현실성 반영**: `/api/aeo/score`는 OpenAI/Perplexity가 있으면 **SerpAPI를 기본 호출하지 않도록** 변경(필요 시에만 fallback)  
3) **Strict vs Broad 인용 인정(2단계)**: `/api/ai/citation`에 `matchMode`를 추가해,
   - Strict(기본): `*.biocom.kr` hostname 매칭(브랜드 KPI용)
   - Broad(디버그): redirect/canonical 추적까지 포함(현상 파악용)
   을 동시에 비교 가능하게 함

---

## 1) feedback3 핵심 요구(내가 반영한 항목)

### 1-1. 리스크 1) KR 고정(hl=ko/gl=kr) vs Google AIO의 구조적 충돌

- 반영: AEO 점수 산식에서 Google AIO를 **기본 제외(참고 표시)**로 정렬함.
- 추가 반영: AEO 점수 API 호출 시 SerpAPI 비용을 줄이기 위해, 기본 측정 provider를 OpenAI/Perplexity 중심으로 전환함.

### 1-2. 리스크 2) 점수 산식과 멀티 프로바이더 UI/표시가 어긋날 수 있음

- 반영: AEO breakdown detail에 **“산식(점수 기준 provider)”**을 명시하고,
  “점수 기준 지표”와 “전체(참고) 지표”를 함께 노출함.

### 1-3. 리스크 3) cited 판정(도메인 매칭 규칙)이 KPI를 흔듦

- 반영: Strict/Broad 2단계로 분리.
  - Strict는 기존처럼 hostname으로만 매칭(안정적인 KPI)
  - Broad는 redirect/canonical까지 따라가서 “사실상 biocom으로 귀결”되는 링크도 잡아 **디버깅 신호**를 강화

---

## 2) 반영된 개발 내용(코드)

### 2-1. AEO 점수(“AI 답변 인용 빈도 20점”) 산식 정렬

- 변경 요지
  - **점수 산식**: `ChatGPT(Search) + Perplexity` 합산을 기본으로 사용
  - `Google AIO`는 “참고”로만 표시(점수 산식에서 제외)
  - 단, OpenAI/Perplexity가 하나도 없으면(설정/실패) 예외적으로 available provider로 계산

- 코드
  - `backend/src/scoring.ts:120` 부근(“AI 인용 빈도 20점” breakdown)
    - `scoringProviders = providers - google_ai_overview` 로 계산
    - detail에 `산식: ... (Google AIO는 참고)` 문구 + “전체(참고)” 수치 추가

### 2-2. `/api/aeo/score`의 provider 선택을 “KR 운영 관점”으로 변경(비용/현실성)

- 변경 요지
  - OpenAI/Perplexity 키가 있으면 기본 측정에서 SerpAPI(Google AIO)를 호출하지 않음
  - OpenAI/Perplexity 측정이 전부 실패해 결과가 비어버린 경우에만, SerpAPI로 **fallback 1회** 시도

- 코드
  - `backend/src/server.ts:1220` 부근(“AI 답변 인용 빈도” 측정 구간)

### 2-3. Strict vs Broad 인용 매칭(디버그용)

- 변경 요지
  - `/api/ai/citation`에 `matchMode=strict|broad|both` 추가
  - `broad|both`일 때:
    - 각 sample에 `matchedReferencesBroad`(Strict + Broad 추가 매칭) 및 `citedBroad`를 추가
    - 각 provider에 `citedQueriesBroad`, `citedReferencesBroad`, `citationRateBroad`를 추가
    - top-level에 `broad.citationRateOverallBroad` 등 요약 추가
    - 응답에 `verdictBroad` 추가(Strict verdict와 비교)

- 코드
  - `backend/src/server.ts:170` 부근의 `GET /api/ai/citation`
  - Broad 매칭 로직(redirect/canonical 추적): `backend/src/urlMatch.ts`

---

## 3) 사용 방법(운영/디버그)

### 3-1. Strict(기본 KPI)만 보기

- 호출(예)
  - `GET /api/ai/citation?sampleSize=5`
  - `GET /api/ai/citation?queries=프로바이오틱스%20효능&sampleSize=1`

- 해석
  - `matchedReferences`가 Strict 매칭 결과
  - `verdict`가 Strict 기준(노출 0 / 인용 0 / 인용됨)

### 3-2. Broad(디버그)까지 같이 보기

- 호출(예)
  - `GET /api/ai/citation?queries=프로바이오틱스%20효능&sampleSize=1&matchMode=both`

- 해석
  - `matchedReferencesBroad`: Strict + Broad(redirect/canonical 추적) 결과
  - `verdictBroad`: Broad 기준 판정(Strict와 다를 수 있음)

---

## 4) 검증(내가 수행)

1) 타입체크
- `npm --prefix backend run typecheck` 통과

2) Broad match 핵심 동작 확인(redirect/canonical)
- `resolveUrlForBroadMatch("https://httpbin.org/redirect-to?url=https://example.com")`로 redirect-follow 확인
- `resolveUrlForBroadMatch("https://en.wikipedia.org/wiki/Probiotics")`로 canonical 추출 확인

---

## 5) 미해결 이슈 / 추가 결정 필요(남은 리스크)

1) “최종 점수 정책”의 문서 1장 고정(필수)
- 현재는 **KR 운영 기준에서 Google AIO 제외**로 정렬했지만,
  - 가중치(예: ChatGPT 50% + Perplexity 50%)
  - 평균 vs 최대값 vs “최근 N회 중 상위” 등
  최종 KPI 정책은 문서로 1장 고정이 필요함(프론트 표기 문구까지).

2) Google AIO의 포지셔닝(참고/벤치마크) 확정
- KR 고정 지표에서 제외는 했지만,
  - “벤치마크용으로 hl=en/gl=us로만 측정할지”
  - “아예 측정/표시를 뺄지”
  의사결정이 필요함(비용/운영 기준 포함).

3) Broad match의 운영 비용/속도
- Broad는 네트워크 요청(redirect/canonical 추적)이 들어가므로,
  - 기본은 Strict 유지(현재 설계)
  - Broad는 디버그/API에서만 on-demand(현재 설계)
  - 필요 시 “최대 링크 수/샘플 수 상한”을 더 강하게 걸어야 함

4) cited 인정 도메인 스펙 합의(Strict/Broad 모두)
- 지금은 기본이 `*.biocom.kr`이지만, 실전에서 아래 합의가 필요함:
  - shortlink 도메인을 “Broad에서만” 인정할지
  - CDN/별도 결제/랜딩 도메인을 인정할지
  - `www/m/utm` 등 정규화 규칙을 어디까지 할지

5) 측정 예산(호출 정책)
- 하루 몇 회 허용인지(관리자 전용 vs 사내 전원 vs 외부 사용자)
- sampleSize(5/10/20)와 refresh 제한 정책

---

## 6) 다음 액션(추천)

1) “AI 인용도 20점” 산식/표시 문구를 1장으로 확정(TJ님 의사결정 필요)  
2) Google AIO는 KR 운영 KPI에서 제외 유지 + (필요 시) 벤치마크 모드만 별도 엔드포인트로 분리  
3) Broad match는 디버그에서만 유지하되, 운영 상한(최대 URL 수, 타임아웃, 동시성)을 더 타이트하게 조정

