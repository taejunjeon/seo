# gptfeedback_0409_3 reply

작성 시각: 2026-04-09 KST

## 0. 먼저 파악한 구조와 로드맵

### 프로젝트 구조

- 프론트엔드: `frontend/src/app/*`
  - 이번 작업 직접 대상: `/ads`, `/ads/roas`
- 백엔드: `backend/src/routes/*`
  - 이번 작업 직접 대상: `backend/src/routes/ads.ts`
- 근거 문서:
  - `roadmap/roadmap0327.md`
  - `roadmap/phase1.md`
  - `roadmap/phase5_5.md`
  - `roadmap/phase9.md`
  - `data/gptfeedback_0409_2.md`
  - `data/datacheck0406.md`
  - `data/gptfeedback_0409_2reply.md`
  - `data/attroas.md`

### 이번 이슈와 연결된 로드맵 이해

- `Phase 1`은 source-of-truth를 만드는 단계다.
  - 핵심은 `status-aware attribution ledger`, `confirmed/pending/canceled` 분리, `WAITING_FOR_DEPOSIT -> pending` 운영 기준이다.
- `Phase 5.5`는 `/ads`, `/ads/roas`를 운영 판단용 ROAS/iROAS 대시보드로 정렬하는 단계다.
  - 0408 메모에도 이미 `/ads`와 `/ads/roas`를 attribution 기준으로 맞춘다고 적혀 있다.
- `Phase 7`은 iROAS 실험 단계다.
  - 즉 지금 `/ads`, `/ads/roas`는 관측 기반 Attribution ROAS를 메인으로 읽고, 증분 판단은 P7/P5.5-S3와 분리해야 한다.
- `Phase 9`는 위 구조를 AI 피드백 루프로 엮는 단계다.
  - 그래서 지금은 숫자 과장/과소를 막는 해석 레이어를 먼저 단단히 만드는 편이 맞다.

## 1. 이번 피드백에 대한 제 판단

- 맞다. **Meta가 더 과장된 쪽**이라는 판단은 이번 자료로 더 강해졌다.
- 맞다. **30일 Attribution ROAS를 메인 headline으로 쓰는 것은 현재 단계에선 너무 거칠다.**
  - `data/attroas.md`도 이미 30일/90일은 cutover bias 때문에 실제보다 낮게 보일 수 있다고 적고 있다.
- 맞다. **best-case ceiling은 확정 ceiling이 아니라 잠정 ceiling**으로 읽어야 한다.
  - `site-summary spend`와 `daily spend`가 같은 7일 구간에서도 다르기 때문이다.
- 맞다. **campaign drill-down은 아직 alias mapping 전이라 운영 판단용으로 쓰기 이르다.**
  - `(unmapped)=100%` 구간에서는 site-level 해석까지만 안정적이다.

정리하면, 이번 피드백의 핵심은 아래 4줄로 압축된다.

- 운영 메인: 최근 7일 Attribution confirmed
- 운영 보조: confirmed+pending
- 플랫폼 참고: Meta purchase
- 해석: Meta는 더 넓게 잡고 있고, 30일 값은 rollout bias가 섞인 보수치

## 2. 이번 턴에서 실제로 반영한 코드

### A. `/ads` 기본 기간을 7일로 변경

반영 파일:

- `/Users/vibetj/coding/seo/frontend/src/app/ads/page.tsx`

변경 내용:

- 기본 `datePreset`을 `last_30d -> last_7d`로 변경
- 상단에 **운영 headline 3줄 비교 박스** 추가
  - 운영 메인: Attribution confirmed
  - 운영 보조: confirmed+pending
  - 플랫폼 참고: Meta purchase
- 문구에 아래 해석을 고정
  - `현재 30일 값은 rollout bias가 섞인 보수치`
  - `운영 기본 탭은 최근 7일`
  - `잠정 ceiling은 spend 축 mismatch가 정리되기 전까지 provisional upper bound`
- 기존 `best-case ceiling` 라벨을 `잠정 ceiling`으로 변경
- `최근 30일 광고 집행 없음` 문구를 현재 선택 기간 기준으로 동적으로 변경
- `일 평균 광고비` 계산이 고정 `/30`이던 부분을 현재 선택 기간 일수 기준으로 보정

### B. `/ads/roas` 기본 기간을 7일로 변경

반영 파일:

- `/Users/vibetj/coding/seo/frontend/src/app/ads/roas/page.tsx`

변경 내용:

- 기본 `datePreset`을 `last_30d -> last_7d`로 변경
- 첫 박스를 요청한 구조대로 재작성
  - 운영 메인: 선택 사이트의 최근 7일 Attribution confirmed
  - 운영 보조: confirmed+pending
  - 플랫폼 참고: Meta purchase
  - 해석: 30일 값은 rollout bias가 섞인 보수치, 잠정 ceiling은 provisional
- 사이트 KPI 카드의 `best-case ceiling` 라벨을 `잠정 ceiling`으로 변경
- `Attribution ROAS 해석 메모`에 기간 해석 주의 추가
  - 최근 7일/14일은 운영 메인 구간
  - 30일/90일은 rollout bias가 섞인 보수치

### C. 백엔드 `/api/ads/*` 기본 preset도 7일로 정렬

반영 파일:

- `/Users/vibetj/coding/seo/backend/src/routes/ads.ts`

변경 내용:

- `ADS_DEFAULT_DATE_PRESET = "last_7d"` 추가
- `resolveOptionalRange()` 기본 preset을 `last_7d`로 변경
- `GET /api/ads/roas`의 `date_preset` fallback도 `last_7d`로 변경

즉 이제 UI뿐 아니라 아래 API를 직접 호출해도 기본 해석이 7일 중심으로 맞는다.

- `/api/ads/site-summary`
- `/api/ads/roas`
- `/api/ads/roas/daily`

## 3. 이번 턴에서 일부러 남긴 것

이번 턴은 **해석 레이어와 기본값 정렬**에 집중했고, 아래 2개는 아직 남겨 두었다.

### 1. site-summary vs daily spend mismatch

- 이 문제는 여전히 남아 있다.
- 따라서 ceiling은 아직도 확정치가 아니라 **잠정치**다.
- 이번 턴에서는 이걸 숨기지 않고, 라벨과 설명에서 그대로 드러내는 쪽을 택했다.

### 2. campaign alias mapping / `(unmapped)=100%`

- alias seed 설계 전까지는 campaign drill-down을 운영 메인으로 쓰지 않는 것이 맞다.
- 이번 턴은 UI 문구를 그 현실에 맞게 조정했지, 매핑 로직 자체를 건드리지는 않았다.

## 4. 검증 결과

### 통과

- 백엔드 타입체크
  - `npm --prefix backend run typecheck`
- 백엔드 테스트
  - `npx tsx --test backend/tests/ads.test.ts`
  - 결과: `5/5 pass`
- 프론트 프로덕션 빌드
  - `npm --prefix frontend run build`
  - 결과: `/ads`, `/ads/roas` 포함 build 성공

### 실패했지만 이번 변경 원인은 아님

- 전체 프론트 lint
  - `npm --prefix frontend run lint`
  - 기존 저장소 전반의 누적 lint error 때문에 실패
- 변경 파일 대상 lint
  - `frontend/src/app/ads/page.tsx`
  - `frontend/src/app/ads/roas/page.tsx`
  - 이 두 파일 자체에도 기존 `react-hooks/set-state-in-effect`, `react/no-unescaped-entities` 적체가 있어 clean pass는 못 만들었다
  - 이번 턴은 그 적체를 건드리지 않고, 요청 범위인 ROAS 기본값/카피 정렬만 반영했다

## 5. 서버 상태와 접속 경로

- 프론트 `7010`: `node` listen 확인
- 백엔드 `7020`: `node` listen 확인

접속 경로:

- `http://localhost:7010/ads`
- `http://localhost:7010/ads/roas`

## 6. 최종 요약

- 이번 피드백 방향은 타당했고, 그 핵심은 **"30일 비관 headline을 기본값으로 쓰지 말고, 최근 7일 중심으로 읽어라"**였다.
- 그래서 실제 코드에서 `/ads`, `/ads/roas`, `/api/ads/*` 기본 기간을 모두 7일로 맞췄다.
- `best-case ceiling`도 `잠정 ceiling`으로 바꿔 과도한 확정 해석을 막았다.
- 남은 실질 blocker는 여전히 2개다.
  - `site-summary vs daily spend mismatch`
  - `alias mapping 전 `(unmapped)` 100%`

즉 이번 턴은 숫자를 다시 만들기보다, **지금 숫자를 덜 흔들리게 읽도록 운영 해석 레이어를 바로잡는 작업**으로 정리할 수 있소.
