# ROAS Summary-First OKR And Action Plan

작성 시각: 2026-05-25 21:21 KST  
기준일: 2026-05-25  
문서 성격: OKR / 액션플랜

## Objective

ROAS 보고서가 빠르고 안정적으로 열리게 만든다. 동시에 광고 플랫폼이 주장하는 숫자와 내부 confirmed 매출 기준 숫자를 분리해서, TJ님이 예산 판단에 쓸 수 있는 화면을 만든다.

쉽게 말하면, 보고서 화면이 매번 원본 장부를 뒤지는 방식이 아니라, 미리 계산해 둔 요약지를 먼저 보여주게 만드는 것이다.

## KR1. 주요 ROAS 화면은 기본 500ms급 응답을 목표로 한다

현재 진척률: 70%.

완료:

- 전환퍼널 화면은 Meta ROAS summary를 사용한다.
- TikTok 화면은 TikTok/Meta/Google 참고 카드를 summary-first로 정리했다.
- Google Ads 화면과 Google ROAS 보고서는 summary-first로 전환했다.

남은 것:

- legacy `/ads` overview.
- `/biocom-ltv-cac`.
- `/ads/roas`.

100% 조건:

- 위 3개 화면도 기본 화면에서 큰 원본 API를 직접 호출하지 않는다.
- 사용자는 먼저 캐시된 요약을 보고, 필요할 때만 "원본 진단" 버튼을 누른다.

## KR2. 원본 진단은 사용자가 버튼을 누를 때만 실행한다

현재 진척률: 55%.

완료:

- TikTok 화면은 원본 비교 API가 버튼 흐름으로 내려갔다.

남은 것:

- `/ads`, `/biocom-ltv-cac`, `/ads/roas`에도 같은 구조를 적용해야 한다.

100% 조건:

- 원본 진단 버튼에는 계산 시간, source, 기준 시각, 실패 시 문구가 보인다.
- 기본 화면 진입만으로 backend hammer가 발생하지 않는다.

## KR3. 광고 플랫폼 주장값과 내부 confirmed 값이 섞이지 않게 한다

현재 진척률: 75%.

완료:

- Google/TikTok/전환퍼널 보고서에서 "플랫폼 주장값"과 "내부 confirmed 기준"을 분리해 쓰는 방향이 잡혔다.

남은 것:

- legacy 화면에도 같은 문구와 구조를 적용해야 한다.

100% 조건:

- 각 카드에 source, window, freshness가 표시된다.
- Meta/Google/TikTok 주장 ROAS와 내부 confirmed ROAS가 같은 이름으로 섞이지 않는다.

## 다음 개발 순서

### 1. `/ads` legacy overview 정리

무엇을 하는가:

- 화면 진입 시 실행되는 여러 live API를 하나의 요약 endpoint로 묶는다.
- 화면에는 "요약 먼저"를 보여주고, 원본 진단은 버튼으로 분리한다.

왜 하는가:

- 지금 남은 화면 중 서버 부하 가능성이 가장 크다.

개발 계획:

- local에서 `ads overview summary` response shape를 만든다.
- 기존 카드가 필요로 하는 값을 요약 API에서 내려준다.
- 원본 live API 호출은 diagnostic 버튼 뒤로 이동한다.

의존성:

- 없음. Green Lane 설계/로컬 구현 가능.
- VM Cloud 배포는 Yellow Lane.

추천 점수:

- 92%.

### 2. `/biocom-ltv-cac` summary bundle 전환

무엇을 하는가:

- LTV/CAC 화면에서 site-summary, ROAS, campaign LTV 계산을 미리 계산된 묶음 요약으로 바꾼다.

왜 하는가:

- LTV/CAC는 비즈니스 판단에 중요하지만 계산 비용이 크다.

개발 계획:

- `/api/ads/biocom-ltv-cac-summary` 또는 기존 summary 확장안을 설계한다.
- 기본 화면에는 어제/최근 7일 기준 요약을 먼저 보여준다.
- 원본 재계산은 버튼으로 분리한다.

의존성:

- `/ads`와 병렬 가능.
- 단, summary field naming은 같이 맞추는 편이 좋다.

추천 점수:

- 86%.

### 3. `/ads/roas` Meta ROAS chart 캐시화

무엇을 하는가:

- Meta ROAS 카드와 일별 차트를 precompute 결과로 바꾼다.

왜 하는가:

- 이 화면은 Meta ROAS 확인용으로 계속 쓰일 가능성이 있다.

개발 계획:

- 카드 영역은 기존 `/api/ads/roas-summary`를 우선 재사용한다.
- 일별 차트는 별도 daily summary cache를 만든다.

의존성:

- `/ads`와 병렬 가능.
- daily summary cache 설계가 필요하다.

추천 점수:

- 82%.

## 운영 금지선

- 이 액션플랜은 보고 화면 안정화 작업이다.
- Meta/Google/TikTok에 새 전환 이벤트를 보내지 않는다.
- 운영DB write/import를 하지 않는다.
- GTM publish를 하지 않는다.
- raw order/payment/member/click id를 화면이나 문서에 출력하지 않는다.

