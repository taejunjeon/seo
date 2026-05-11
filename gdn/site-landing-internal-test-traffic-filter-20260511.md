# internal / test traffic 분리 규칙 (gpt0508-44 작업2)

작성 시각: 2026-05-11 18:20:00 KST

## 1. 이번에 가능해진 것

내부 테스트 / 자동 생성 ID / TJ 검증 트래픽을 일반 고객 유입과 분리할 수 있게 됐다. 1차 snapshot 결과 12 row 중 **4 row 가 internal test 의심** 으로 분류돼 baseline 분포에서 별도 카운트.

## 2. 왜 필요했는지

운영 시점에 TJ 가 페이지 한 번 본 트래픽과 자동 ID 가 부정확하게 들어온 row 가 baseline 에 섞이면, 분포 해석이 처음부터 흐려진다. 24~72 시간 후 의미 있는 비율을 판단하기 전에 미리 필터 규칙을 정해야 분석이 일관됨.

## 3. 어떻게 작동하는지 (비개발자용)

UTM `utm_campaign` 값의 패턴을 보고 자동 tag.

| 패턴 | tag |
|---|---|
| `test*` / `debug*` / `claude*` / `staging*` 로 시작 | likely_internal_test |
| 1~3 자리 숫자만 (`1`, `12`, `99`) | likely_internal_test (UTM 오작성 의심) |
| imweb 자동 ID (`b` + 8자리 날짜 + 10~30자 hex) | likely_internal_test |
| 그 외 | likely_real_customer |

또 `/admin/*`, `/auth/*`, `/login*`, `/checkout/success*` 경로는 receiver 자체가 미수신.

## 4. 첫 적용 결과

| utm_campaign | count | tag | 이유 |
|---|---:|---|---|
| `googleads_shopping_supplements_dangdang` | 4 | likely_real_customer | google ads 실 캠페인 |
| `googleads_shopping_supplements_youngdays` | 3 | likely_real_customer | google ads 실 캠페인 |
| `b2026051144755feeb63db` | 3 | likely_internal_test | imweb 자동 ID 패턴 |
| `1` | 1 | likely_internal_test | short numeric only |

→ 8 row 가 실 고객 유입, 4 row 가 internal/test 의심.

## 5. TJ 님 브라우저 방문 정책

TJ 가 `biocom.ainativeos.net/ads/site-landing` 페이지를 본인 브라우저로 방문하더라도, 그 `self_internal` row 는 source_evidence_present_rate / channel_distribution baseline 에서 제외하고 별도 `internal_or_test_traffic_count` 에만 반영. **UI 확인용으로만 취급, 분포 판단 baseline 으로 쓰지 않는다.**

## 6. 보안

| 항목 | 결과 |
|---|---|
| raw IP 저장 / 출력 | 0 |
| raw User-Agent 저장 / 출력 | 0 |
| raw PII 응답 노출 | 0 |

## 7. 향후 보강 후보 (본 sprint scope 외)

- `user_agent family` (mobile vs desktop) 통계
- `biocomkr_sns` admin IP 범위 식별 (IP hash 비교)
- manual test timestamp window (TJ 가 특정 5분 안 사이트 방문 표시)

## 8. 다음 액션

| Owner | Action | Claude Code 가능? | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 추천 |
|---|---|---|---:|---:|---:|---:|---|
| Claude Code | imweb 자동 ID 규칙을 더 정밀화 (실 row 추가 도착 시 regex 보정) | YES | 60 | 60 | 50 | 10 | 진행 (72h 후 재평가) |
| Claude Code | user_agent family 분류 추가 | YES (raw 안 출력) | 70 | 40 | 50 | 20 | 보류 (필요시 다음 sprint) |

산출 JSON: `data/site-landing-internal-test-traffic-filter-20260511.json`
