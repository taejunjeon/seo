# codexfeedback_0329_2 reply

기준일: 2026-03-29

이번 턴은 피드백 전체를 한 번에 다 벌리지 않고, 바로 제품 해석 사고를 줄일 수 있는 항목부터 코드로 반영했다.

1. `P4-S1` 코호트 API에서 `결제채널`과 `유입채널` 혼동을 줄이는 계약 정리
2. `north_star_proxy`에 코호트 성숙도 메타데이터 추가
3. `roadmap0327.md`에 `운영자 효율`과 `측정 신뢰` 우선순위를 분리해서 반영

## 1. 수정한 파일

### Revenue backend

- `/Users/vibetj/coding/revenue/backend/app/services/crm_cohort_service.py`
- `/Users/vibetj/coding/revenue/backend/app/api/crm.py`
- `/Users/vibetj/coding/revenue/backend/test_crm_phase1_readonly.py`

### SEO 문서

- `/Users/vibetj/coding/seo/roadmap0327.md`
- `/Users/vibetj/coding/seo/codex/codexfeedback_0329_2reply.md`

### 백업

- `/Users/vibetj/coding/revenue/backend/app/services/crm_cohort_service.py.bak_20260329_codexfeedback_2`
- `/Users/vibetj/coding/revenue/backend/app/api/crm.py.bak_20260329_codexfeedback_2`
- `/Users/vibetj/coding/revenue/backend/test_crm_phase1_readonly.py.bak_20260329_codexfeedback_2`
- `/Users/vibetj/coding/seo/roadmap0327.md.bak_20260329_codexfeedback_2`

## 2. 이번 턴 실제 개발 내용

### A. `first_purchase_channel`를 `first_payment_channel`로 정리

피드백이 맞다.
현재 값 `toss_card`, `nicepay_subscription` 등은 유입채널이 아니라 결제 레일이다.

이번 턴 변경:

- 내부 계산/응답 필드 기준 명칭을 `first_payment_channel`로 변경
- `segment_key`도 `payment_channel=...` 형태로 변경
- API 설명과 `available_filters` 의미를 `결제채널`로 정리
- 기존 호출을 깨지 않도록 `first_purchase_channel`은 **deprecated alias**로만 허용
- 두 파라미터를 동시에 넣고 값이 다르면 `400`으로 막도록 라우터에 방어 로직 추가

비유하면, 원래는 `결제수단 칸`에 `유입경로`라는 라벨이 붙어 있던 상태였다.
이번 수정은 상자의 내용물을 바꾼 게 아니라, 라벨을 실제 내용과 맞게 다시 붙인 작업이다.

### B. `north_star_proxy`에 성숙도 표기 추가

기존 `repeat_net_revenue_90d`는 최근 코호트가 섞이면 읽는 사람이 쉽게 과신할 수 있었다.

이번 턴 변경:

- 새 필터: `fully_matured_cohort_only`
- 새 summary 메타:
  - `mature_cohort_count`
  - `mature_customer_count`
  - `excluded_recent_cohort_count`
  - `excluded_recent_customer_count`
  - `north_star_proxy_is_partial`
- 각 cohort에 `maturity` 블록 추가
  - `max_mature_offset_in_response`
  - `north_star_window_months`
  - `north_star_window_is_mature`
- `north_star_proxy`는 이제 `M+1~M+3 fully matured cohort`만 기준으로 합산

즉, 기존이 “익지 않은 과일까지 같은 바구니에 담아 평균을 보는 상태”였다면, 지금은 “90일이 다 지난 과일만 북극성 계산 바구니에 넣고, 덜 익은 건 따로 표시”하는 구조다.

### C. P1 우선순위 문구 정리

`roadmap0327.md`에는 아래 구분을 위쪽에 명시했다.

- 운영자 효율 1순위: `/crm` 허브 연결
- 측정 신뢰 1순위: `P1-S1A` 실사이트 연동
- `P1-S1` 다음 단계: approval package 미세조정이 아니라 `local shadow DB + dry-run experiment 1건`

이건 코드 변경은 아니지만, 팀이 “지금 당장 더 급한 병목이 무엇인지” 헷갈리지 않게 하는 운영 문구 수정이다.

## 3. 바뀐 API 계약

### `GET /api/crm/repeat-purchase-cohorts`

이제 권장 호출은 아래다.

```text
GET /api/crm/repeat-purchase-cohorts?start_month=2025-11&end_month=2026-01&max_offset=3&first_payment_channel=toss_card&discount_used=true
```

성숙 코호트만 보고 싶으면:

```text
GET /api/crm/repeat-purchase-cohorts?start_month=2025-11&end_month=2026-01&max_offset=3&first_payment_channel=toss_card&discount_used=true&fully_matured_cohort_only=true
```

하위 호환:

- `first_purchase_channel` 요청 파라미터는 당분간 계속 받음
- 단, 새 계약 기준은 `first_payment_channel`

## 4. 검증 결과

### 자동 테스트

- `python3 -m py_compile ...` 통과
- `pytest -q /Users/vibetj/coding/revenue/backend/test_crm_phase1_readonly.py`
  - `5 passed`

### 운영 DB read-only 실측

조건:

- `start_month=2025-11`
- `end_month=2026-01`
- `max_offset=3`
- `first_payment_channel=toss_card`
- `discount_used=true`

결과:

- 기본 조회
  - `cohort_count = 3`
  - `customer_count = 2,872`
  - `mature_cohort_count = 2`
  - `mature_customer_count = 1,831`
  - `north_star_proxy_is_partial = true`
  - `repeat_net_revenue_90d = 45,134,699`
- `fully_matured_cohort_only=true`
  - `cohort_count = 2`
  - `customer_count = 1,831`
  - `north_star_proxy_is_partial = false`
  - `repeat_net_revenue_90d = 45,134,699`

이 숫자는 “최근 코호트를 그대로 섞어 보면 partial이고, 성숙 코호트만 남기면 같은 북극성 값이라도 해석 안정성이 높아진다”는 걸 보여준다.

## 5. 이번 턴에서 아직 안 닫힌 것

### `P1-S1A` live signal

피드백의 핵심 지적대로, 가장 큰 병목은 여전히 live row 부족이다.
이건 이번 턴에 문서 우선순위는 정리했지만, 실제 고객 사이트에서 아래 두 endpoint를 호출하도록 붙이지 못하면 계속 가설 단계다.

- `POST /api/attribution/checkout-context`
- `POST /api/attribution/payment-success`

즉, `P1-S1A`는 로직 부족보다 **실사이트 진입점 미연결**이 남은 상태다.

### `P1-S1` shadow experiment

이번 턴은 `P1-S1`을 shadow experiment 단계로 넘겨야 한다는 문서 정리까지 했다.
하지만 실제 `local shadow DB + deterministic assignment + mock purchase/refund` dry-run은 아직 시작하지 않았다.

### contact policy v1

피드백의 방향은 맞다.
현재 코드에는 `quiet hours`, `cooldown`, `suppression`, `consent` 메모가 일부 들어가 있지만, 아직 별도 policy endpoint나 실행 엔진은 아니다.

## 6. 결론

이번 턴은 “더 멋진 대시보드”가 아니라 “숫자를 잘못 읽지 않게 만드는 안전장치”를 넣은 작업이다.

- `P4-S1`은 이제 `결제채널`을 `유입채널`처럼 오해할 가능성을 크게 줄였다.
- `north_star_proxy`는 최근 코호트가 섞일 때 `partial` 여부를 응답에서 바로 보게 만들었다.
- `roadmap`은 `P1-S1A`가 왜 여전히 측정 신뢰 1순위인지 위쪽에 보이게 정리했다.

다음 Codex 우선순위는 문서 기준 그대로다.

1. `P1-S1` shadow experiment 1건
2. `P1-S1A` 실사이트 연결 준비용 진입점 식별
3. `contact policy v1`을 별도 계약으로 승격
