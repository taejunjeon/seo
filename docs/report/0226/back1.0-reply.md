# feedback0226back1.0.md 반영 결과

- 작업일: 2026-02-26
- 작업 범위: GA4 AI traffic allowlist / 분류 라벨링 / 테스트 추가
- 변경 파일:
  - `backend/src/ga4.ts`
  - `backend/src/server.ts`
  - `backend/tests/ga4-traffic-category.test.ts`

---

## 1) allowlist 필터: CONTAINS → FULL_REGEXP (도메인 앵커링)

- GA4 Data API StringFilter의 `matchType`을 `CONTAINS`에서 `FULL_REGEXP`로 변경했습니다.
- 패턴은 “도메인 앵커링 + 서브도메인 허용” 형태로 통일했습니다.
  - 형식: `(^|.*\\.)example\\.com$`
  - 포함 예: `example.com`, `www.example.com`, `a.b.example.com`
  - 배제 예: `myexample.com`, `example.com.evil.com`

적용 위치:
- `backend/src/ga4.ts`의 `queryGA4AiTrafficDetailed()` 내부 `dimensionFilter`

---

## 2) 신규 AI 소스 추가

AI allowlist에 아래 소스를 추가했습니다.
- `you.com`
- `komo.ai`
- `phind.com`
- `meta.ai`
- `search.brave.com` (Brave AI Search)

---

## 3) bing.com 처리: 제거가 아닌 “분리 라벨링”

요구사항대로 `bing.com`은 AI allowlist에서 제거하고, 별도 카테고리로 분리했습니다.

### 3.1 타입/분류 함수
- `backend/src/ga4.ts`에 아래 타입과 분류 함수를 추가했습니다.
  - `type TrafficCategory = "ai_referral" | "search_legacy" | "organic"`
  - `categorizeTrafficSource(sessionSource: string): TrafficCategory`

분류 규칙(핵심):
- `bing.com` / `www.bing.com` / `bing` → `search_legacy`
- AI 도메인 allowlist 매칭 → `ai_referral`
- 그 외 → `organic`

### 3.2 API 응답에 category 필드 추가
- `/api/ga4/ai-traffic` 응답의 `bySource[]` row에 `category` 필드를 추가했습니다.
- `/api/ga4/top-sources` 응답의 `rows[]` row에 `category` 필드를 추가했습니다.
  - 이 엔드포인트 자체는 “필터 없이 상위 sessionSource 목록”을 유지하되,
  - 프론트에서 `category`로 필터링/라벨링 가능하도록 했습니다.

---

## 4) 테스트 코드 추가(요구 검증 항목)

추가 파일:
- `backend/tests/ga4-traffic-category.test.ts`

검증 내용:
- `"mychatgpt"`, `"mychatgpt.com"` → `ai_referral`로 분류되지 않음(거짓양성 차단)
- `"www.chatgpt.com"` → `ai_referral`로 분류됨(www 변형 포함)
- `"bing.com"`, `"www.bing.com"` → `search_legacy`로 분류됨(AI 혼재 방지)

실행 명령(로컬):
```bash
cd backend
node --import tsx --test tests/ga4-traffic-category.test.ts
```

추가 확인:
- `backend` 타입체크 `tsc --noEmit` 통과

---

## 수동 검증 방법(옵션)

백엔드 실행 후:
```bash
curl -s "http://localhost:7020/api/ga4/top-sources?refresh=1" | python3 -m json.tool
```

확인 포인트:
- `sessionSource`가 `www.chatgpt.com`인 경우 `category: "ai_referral"`
- `sessionSource`가 `bing.com`인 경우 `category: "search_legacy"`
- `sessionSource`가 `mychatgpt` 같은 값이면 `category: "organic"`

---

## 메모(프론트 반영 포인트)

- 현재 프론트는 `category` 필드를 사용하지 않지만, API 응답에는 포함됩니다.
- 필요하면 프론트 타입(`AiTrafficBySourceRow`, top-sources row)과 UI에 라벨/필터를 추가하면 즉시 활용 가능합니다.

