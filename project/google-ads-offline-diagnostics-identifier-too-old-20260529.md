작성 시각: 2026-05-29 22:02 KST
기준일: 2026-05-29
문서 성격: Google Ads 오프라인 전환 진단 알림 대응 아이디어와 실행 설계

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - project/google-ads-293206-failed-row-and-30d-batch-classification-20260529.md
    - project/google-ads-offline-conversion-diagnostics-readonly-20260527.md
    - /Users/vibetj/Downloads/오프라인 데이터 진단 알림.csv
  lane: Green Lane read-only analysis and proposal
  allowed_actions:
    - CSV read
    - local source inspection
    - documentation
    - no-send design
  forbidden_actions:
    - Google Ads conversion send
    - VM Cloud DB write
    - 운영DB write
    - deploy/restart
    - GTM publish
  source_window_freshness_confidence:
    source: Google Ads diagnostic CSV + Google Ads UI screenshot + local source code
    window: 2026-05-28 diagnostic alert
    freshness: CSV read on 2026-05-29 KST
    confidence: high for alert meaning, medium for exact affected row until VM row-level diagnostic is joined
```

## 10초 요약

이번 알림은 `Google Ads API 연결 실패`가 아니다.

의미는 더 좁다. 실제 구매로 보낸 row 중 1건이 Google Ads 입장에서 `클릭이 너무 오래된 구매`라서 보고서에 기록되지 않았다. 따라서 해결 방향은 재전송을 무작정 하는 것이 아니라, 앞으로 Google Ads에 보내기 전에 `클릭 시각이 전환 액션의 허용 기간 안인지`를 먼저 검사하는 것이다.

## CSV에서 확인한 알림

- 상태: 조치 필요
- 알림 제목: 식별자 또는 iOS URL 매개변수가 너무 오래됨
- 알림 설명: 전환의 클릭연결 기간 전에 클릭이 발생했으므로 가져온 이벤트를 기록할 수 없습니다. 최신 데이터를 가져와야 합니다.

사람 말로 풀면 이렇다.

Google Ads에 `이 주문은 예전에 발생한 Google 광고 클릭 덕분입니다`라고 보냈는데, Google Ads가 보기에 그 클릭이 너무 오래됐다. 그래서 해당 구매를 Google Ads 전환 보고서에 넣지 않았다.

## 왜 생겼을 가능성이 높은가

### 1. 전환 액션의 클릭연결 기간보다 오래된 click id를 보냈다

`BI confirmed_purchase_offline`은 실제 결제완료 주문만 Google Ads에 알려주는 전환 통로다. 이 전환은 Google Ads 설정상 클릭연결 전환 추적 기간을 가진다. 현재 로컬 코드에서는 전환 액션 목록을 조회할 때 `click_through_lookback_window_days`를 읽지만, 후보 생성 단계에서 `클릭 시각과 결제완료 시각의 차이`를 강하게 막는 필터는 충분하지 않다.

### 2. 주문에는 실제 구매가 맞지만, 붙은 Google click id가 너무 예전 값일 수 있다

우리 저장소에는 첫 유입, 최근 유입, NPay 버튼 클릭, 결제완료 후보를 이어 붙이는 여러 장부가 있다. 이 구조는 구매를 복구하는 데 유리하지만, 방어 장치가 약하면 오래된 첫 유입 gclid가 나중 구매에 붙을 수 있다.

즉 `주문은 진짜`여도 `그 주문에 붙인 광고 클릭 증거가 너무 낡은 것`이면 Google Ads가 거절한다.

### 3. HTTP 200이어도 row 하나는 실패할 수 있다

Google Ads 전환 업로드는 요청 전체가 성공해도, 안에 담긴 개별 전환 1건이 실패할 수 있다. HTTP 200은 `Google 서버가 요청을 받았다`는 뜻이지, 모든 구매 row가 보고서에 반영됐다는 뜻은 아니다.

## 바로 적용할 아이디어

### 아이디어 1. 전송 전 `클릭 나이 검사`를 넣는다

무엇을:

- 후보 row마다 `결제완료 시각 - Google click id가 잡힌 시각`을 계산한다.
- 전환 액션의 클릭연결 기간보다 오래됐으면 Google Ads에 보내지 않는다.

왜:

- Google Ads가 어차피 버릴 row를 미리 막는다.
- 진단 화면의 오류율을 낮춘다.
- 실제 구매 전환 통로의 신뢰도를 지킨다.

판정 예시:

- 결제완료 2026-05-28, click id 포착 2026-05-27: 전송 가능
- 결제완료 2026-05-28, click id 포착 2026-04-20: 전송 보류 또는 제외
- click id는 있는데 포착 시각이 없음: 전송 보류

### 아이디어 2. 오래된 클릭과 너무 최근 클릭을 다르게 처리한다

Google Ads 도움말 기준으로 너무 최근 클릭은 나중에 다시 보내면 될 수 있다. 반대로 너무 오래된 클릭은 대부분 다시 보내도 안 된다.

따라서 상태를 나눠야 한다.

- `too_recent_click`: 클릭 후 6시간 미만이라면 대기 후 재시도
- `click_too_old_for_action`: 전환 액션 기간을 넘었으면 제외
- `click_time_unknown`: click id는 있으나 클릭 시각을 모르면 보류
- `reporting_delay`: 전송은 성공했지만 Google Ads 보고서 반영 대기

### 아이디어 3. 장부에 실패 원인을 사람이 읽을 수 있게 저장한다

이미 코드에는 partial failure 저장 보강이 들어가 있다. 다음 단계는 실패 유형을 더 정규화하는 것이다.

필요 필드:

- Google Ads 실패 코드
- 사람이 읽는 실패 이유
- click id 종류: gclid / gbraid / wbraid
- click id 포착 시각
- 결제완료 시각
- click age hours
- 적용된 lookback window days
- terminal failure 여부
- retry 가능 여부

원문 주문번호와 원문 click id는 일반 응답에 내보내지 않는다.

### 아이디어 4. 로컬 보고서에 `왜 못 보냈는지` 카드를 추가한다

현재 보고서는 전송 성공/대기 중심이다. 이제 실패와 사전 차단 이유를 보여줘야 한다.

추천 카드:

- 보냄, Google Ads 반영 완료
- 보냄, 아직 Google Ads 반영 대기
- Google Ads가 거절: 클릭이 너무 오래됨
- 전송 전 차단: 클릭 시각을 모름
- 전송 전 차단: 테스트 click id
- 전송 전 차단: 중복 전송 위험

이렇게 나누면 TJ님이 `실제 구매가 없는 것인지`, `구매는 있는데 광고 클릭 증거가 약한 것인지`, `Google Ads 반영이 늦는 것인지`를 한 화면에서 구분할 수 있다.

## 293,206원 실패 row와의 관계

이 알림은 기존 293,206원 실패 row와 같은 계열일 가능성이 높다.

다만 CSV에는 주문번호나 response id가 없어서 아직 100% 같은 row라고 단정할 수는 없다. 확정하려면 VM Cloud 전송 장부에서 실패 row의 전환일, 금액, request id, failure summary를 Google Ads 진단 날짜와 맞춰야 한다.

## 실행 순서

### Auto Green

1. Google Ads 후보 생성기에 `click age dry-run`을 먼저 붙인다.
   - 실제 전송 없이 최근 30일 후보가 `전송 가능 / 너무 오래됨 / 클릭 시각 없음 / 중복`으로 몇 건씩 나뉘는지 본다.

2. 293,206원 실패 row를 같은 기준으로 재분류한다.
   - 클릭 시각이 있으면 기간 초과인지 확인한다.
   - 클릭 시각이 없으면 `click_time_unknown`으로 닫는다.

3. 로컬 보고서에 실패/차단 이유 카드를 추가한다.
   - Google Ads 화면을 새로고침하지 않아도 내부적으로 왜 보냈고 왜 못 보냈는지 보이게 한다.

### Approval Needed

1. VM Cloud backend 배포
   - click age gate를 실제 운영 후보 생성기에 반영하려면 배포가 필요하다.

2. 자동 전송 정책 변경
   - 너무 오래된 click id를 자동으로 제외하고, 너무 최근 click id는 대기 후 재시도하는 로직을 켜려면 운영 자동 전송 정책에 영향이 있다.

### Red Lane

- Google Ads에 추가 전송
- 이미 실패한 293,206원 row 재전송
- 전환 액션 설정 변경

위 작업은 TJ님 명시 승인 전 실행하지 않는다.

## 2026-05-29 구현 반영

### 기준 확정

너무 오래된 클릭 기준은 아래처럼 2단계로 본다.

1. Google click id 자체의 바깥 보관 한계: 90일
2. `BI confirmed_purchase_offline` 전환 액션의 실제 인정 기준: 30일

따라서 이번 실제 구매 전용 Google Ads 전송 통로에서는 `클릭일부터 결제완료일까지 30일 초과`를 차단 기준으로 본다. 90일은 click id가 존재할 수 있는 큰 범위이고, 실제 전환 액션이 구매로 인정하는 기준은 30일이므로 30일 기준이 먼저 적용된다.

### 로컬 코드 반영

- `backend/src/routes/googleAds.ts`
  - `/api/google-ads/confirmed-purchase/click-age-dry-run` no-send endpoint 추가
  - dry-run 분류 추가:
    - `within_action_click_window`
    - `click_too_old_for_action`
    - `too_recent_for_google_retry`
    - `click_time_unknown`
    - `conversion_time_missing_or_invalid`
    - `conversion_before_click`
    - `missing_exact_gclid`
    - `not_actual_purchase`
  - Google Ads 실패 문구 `EXPIRED_EVENT`, `click-through window`, `click occurred before`를 `failed_click_too_old_for_action`으로 우선 분류하도록 보강

### 293,206원 row 재분류

기존 293,206원 실패 row는 validate-only 결과상 `EXPIRED_EVENT` 계열이다. 사람 말로는 `주문은 실제 구매일 수 있지만, Google Ads가 인정하는 클릭 기간 30일을 넘은 광고 클릭 증거라 구매로 붙일 수 없음`이다.

따라서 이 row는 `테스트/잘못된 click id`가 아니라 `클릭 연결 기간 초과`로 재분류하는 것이 맞다. 재전송 대상이 아니라 제외/보류 대상이다.

### 검증

- `npm --prefix backend run typecheck`: 통과
- `npm --prefix backend run build`: 통과
- `python3 scripts/harness-preflight-check.py --strict`: 통과

### 아직 운영 반영 안 된 것

이번 반영은 로컬 코드 기준이다. VM Cloud live API에서 새 endpoint와 재분류가 보이려면 VM Cloud backend 배포가 필요하다. 배포는 Yellow Lane이므로 TJ님 승인 후 진행한다.

## Auditor verdict

PASS_WITH_NOTES.

이번 작업은 CSV 읽기, 코드 확인, 대응 설계 문서 작성만 수행했다. Google Ads 전송, VM Cloud write, 배포, GTM publish, 운영DB write는 하지 않았다.
