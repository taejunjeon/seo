# 0227 Security - npm audit 취약점 조치

- 작업일: 2026-02-27
- 범위: `backend/`, `frontend/`
- 목적: Sprint 4 의존성 추가/업데이트 이후 **npm audit 취약점 제거** + 재검증

---

## 1) 요약
- backend: `npm audit`에서 **2건(High 1, Low 1)** 발견 → `npm audit fix`로 조치 → **0건**
- frontend: `npm audit`에서 **2건(High 1, Moderate 1)** 발견 → `npm audit fix`로 조치 → **0건**

---

## 2) 발견된 취약점(조치 전)

### backend
- `minimatch` (High)
  - ReDoS 관련 다수(GHSA-3ppc-4f35-3m26 / GHSA-7r86-cg39-jmmj / GHSA-23c5-xmqv-rm74)
- `qs` (Low)
  - arrayLimit bypass in comma parsing DoS (GHSA-w7fw-mjwx-w883)

### frontend
- `ajv` (Moderate)
  - `$data` option 사용 시 ReDoS (GHSA-2g4f-4pwh-qvx6)
- `minimatch` (High)
  - ReDoS 관련 다수(GHSA-3ppc-4f35-3m26 / GHSA-7r86-cg39-jmmj / GHSA-23c5-xmqv-rm74)

---

## 3) 조치 내용

### 실행한 커맨드
- backend
  - `cd backend && npm audit`
  - `cd backend && npm audit fix`
  - `cd backend && npm audit` (0 vulnerabilities 확인)

- frontend
  - `cd frontend && npm audit`
  - `cd frontend && npm audit fix`
  - `cd frontend && npm audit` (0 vulnerabilities 확인)

### 결과(버전 확인)
- backend
  - `npm ls minimatch qs` 기준
    - `minimatch@9.0.9`
    - `qs@6.15.0`

- frontend
  - `npm ls minimatch ajv` 기준
    - `ajv@6.14.0`
    - `minimatch@3.1.5`, `minimatch@9.0.9` (취약 범위 밖)

---

## 4) 검증

### backend
- `npm run typecheck` (pass)
- `node --test --import tsx tests/*.test.ts` (pass)

### frontend
- `npm run lint` (0 errors / warnings only)
- `npm run build` (pass)

---

## 5) 변경 파일(잠재)
- `backend/package-lock.json` (transitive deps 업데이트)
- `frontend/package-lock.json` (transitive deps 업데이트)

## 6) 부수 조치(검증 과정에서 발견된 lint 에러 정리)
`npm audit fix` 자체는 lockfile 갱신이 핵심이지만, frontend에서 `npm run lint`를 실행했을 때 기존 코드가 ESLint 규칙에 의해 error로 잡혀 빌드/검증 흐름이 끊기는 문제가 있어 함께 정리했습니다.

- `frontend/src/components/dashboard/OptimizationChecklist.tsx`
  - localStorage 복원을 `useEffect + setState`에서 `useState initializer`로 변경(react-hooks/set-state-in-effect 회피)
- `frontend/src/components/tabs/CoreWebVitalsTab.tsx`, `frontend/src/components/tabs/KeywordAnalysisTab.tsx`
  - JSX 내 따옴표(`"`)를 `&quot;`로 이스케이프(react/no-unescaped-entities)
- `frontend/src/components/tabs/OverviewTab.tsx`
  - `Date.now()` 기반 “몇 분 전” 표기를 제거하고, API가 준 ISO 시간을 `toLocaleString("ko-KR")`로 표시(react-hooks/purity 회피)

> 주의: `npm audit fix --force`는 사용하지 않았습니다(메이저 업데이트 회피).
