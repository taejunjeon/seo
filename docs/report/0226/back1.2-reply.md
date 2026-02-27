# feedback0226back1.2 작업 결과 (2026-02-26)

TJ님, `feedback0226back1.2.md` 요구사항(실데이터/샘플데이터 출처 태깅)을 반영했습니다.  
대상 3개 GA4 API 응답에 최상위 `_meta`를 추가하여 **live(실 GA4 조회)** vs **fallback(GA4 미연결/미설정)** 를 프론트에서 구분할 수 있게 했습니다.

---

## 1) 변경된 파일 / 변경 요약

### `backend/src/ga4.ts`
- `DataSourceMeta` 타입을 추가(export)했습니다.
  - `type: "live" | "fallback"`
  - `propertyId?: string` (live일 때만)
  - `queriedAt: string` (ISO, UTC `Z`)
  - `period: { startDate; endDate }`
  - `notice?: string` (fallback 안내 메시지)
- GA4 client 생성 로직을 **서비스 계정 키 필수**로 변경했습니다.
  - 기존: `GA4_SERVICE_ACCOUNT_KEY`가 없으면 ADC(Application Default Credentials)로 fallback
  - 변경: `GA4_SERVICE_ACCOUNT_KEY`가 없으면 `Error("GA4_SERVICE_ACCOUNT_KEY is not configured")` 발생
  - 이유: credential 제거 시 google-auth-library가 ADC 로딩 과정에서 프로세스를 종료시키는 케이스가 있어,
    API가 안정적으로 fallback 응답을 반환하도록 “명시적 미연결”로 처리했습니다.

### `backend/src/server.ts`
- 공통 유틸 추가:
  - `makeLiveMeta(period)`, `makeFallbackMeta(period)`
  - `isGa4CredentialError(message)` (인증 실패/credential 미설정/invalid JSON/permission 계열을 fallback으로 분류)
- 아래 엔드포인트 응답 최상위에 `_meta` 추가:
  - `GET /api/ga4/ai-traffic`
  - `GET /api/ga4/ai-traffic/user-type`
  - `GET /api/ga4/top-sources`
- GA4 미연결(미설정/credential 제거/인증 실패) 시:
  - 기존 0값 구조는 유지
  - `_meta.type = "fallback"`
  - `_meta.notice = "GA4 미연결. 실제 데이터가 아닙니다."` 추가

---

## 2) 응답 형태 (요구사항 준수)

### Live(정상 연결)
- 공통:
  - `_meta.type = "live"`
  - `_meta.propertyId = "properties/<GA4_PROPERTY_ID>"`
  - `_meta.queriedAt` = 호출 시각 ISO(UTC)
  - `_meta.period` = 실제 조회 기간

### Fallback(GA4 미연결/미설정)
- 공통:
  - `_meta.type = "fallback"`
  - `_meta.notice = "GA4 미연결. 실제 데이터가 아닙니다."`
  - 기존 응답 구조(예: `totals/bySource/byLandingPage`, `summary/bySourceAndType`, `rows`)는 유지하고 최상위 `_meta`만 추가

---

## 3) 확인(요구사항의 완료 후 확인 1~3)

로컬에서 서버를 임시 포트로 띄워 확인했습니다.

### 확인 1) `/api/ga4/ai-traffic` 호출 시 `_meta.type="live"`
- 호출:
  - `curl "http://localhost:7021/api/ga4/ai-traffic?startDate=2026-01-27&endDate=2026-02-26&limit=1"`
- 결과(예):
  - `_meta.type: "live"`
  - `_meta.propertyId: "properties/304759974"`

### 확인 2) GA4 credential 제거(환경변수 `GA4_SERVICE_ACCOUNT_KEY=''`) 시 `_meta.type="fallback"`
- 동일 기간 기준으로 3개 API 모두 fallback 확인:
  - `/api/ga4/ai-traffic`
  - `/api/ga4/ai-traffic/user-type`
  - `/api/ga4/top-sources`
- 결과(예):
  - `_meta.type: "fallback"`
  - `_meta.notice: "GA4 미연결. 실제 데이터가 아닙니다."`

### 확인 3) `_meta.queriedAt`이 호출 시각인지
- `new Date().toISOString()` 기반으로 매 요청 시각이 들어가는 것을 확인했습니다.
  - 예: `2026-02-26T03:12:46.421Z`

---

## 4) 테스트/타입체크

```bash
npm --prefix backend run typecheck
cd backend && node --import tsx --test tests/*.test.ts
```
- 결과: pass

---

## 5) 참고(동작 변경 포인트)

- `backend/src/ga4.ts`에서 ADC fallback을 제거했기 때문에,
  **GA4 조회는 `GA4_SERVICE_ACCOUNT_KEY`가 설정된 경우만 live**로 동작합니다.
  (미설정/무효화 시 API는 fallback 구조 + `_meta.type="fallback"`으로 응답)

