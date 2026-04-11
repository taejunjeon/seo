According to a document from 2026-04-10, 이번 `metaroas2` 결과는 **꽤 잘 됐습니다.**
핵심은 3가지입니다. 첫째, 최근 7일 biocom 기준 `site-summary`, `daily`, `meta insights` raw 3종이 같은 숫자로 맞춰졌습니다. 둘째, 운영 메인값을 `Attribution confirmed ROAS 0.92x`로 두고, Meta purchase ROAS는 참고값으로만 보겠다는 기준이 더 선명해졌습니다. 셋째, dedup 문제를 “느낌”이 아니라 API 숫자로 바로 보게 만든 점이 좋습니다.【turn32file0†turn32file5】

가장 중요한 피드백 하나를 먼저 드리면, **지금 메타 화면에서 비교해야 할 열을 잘못 보면 또 헷갈립니다.**
이번에 올려주신 Meta Ads Manager 화면은 매우 유용합니다. 그런데 화면상으로 보면 `결과 ROAS`는 큰 `구매 전환값` 열과 맞는 게 아니라, 그 옆의 **`결과 값`** 열과 맞물려 움직이는 것처럼 보입니다. 실제 raw에서도 공동구매 캠페인은 spend 약 `₩5.78M`, `purchase_roas 5.71`, `purchase_value ₩33.0M`이고, 10/14 캠페인은 spend 약 `₩5.42M`, `purchase_roas 5.46`, `purchase_value ₩29.6M`입니다. 이 숫자는 당신이 보여준 Ads Manager의 `결과 ROAS`와 잘 맞습니다.【turn25file3†turn25file6】
즉, **우리 API의 비교 대상은 Meta 화면의 큰 `구매 전환값` 열이 아니라, ROAS를 실제로 구성하는 `결과 값` 계열일 가능성이 높습니다.** 이건 이번 캡처 덕분에 확인된 아주 중요한 포인트예요.

## 지금 상태에 대한 판단

지금은 이렇게 정리하면 됩니다.

* **이미 꽤 닫힌 것**
  최근 7일 biocom 기준 raw 세트가 동일합니다. spend `₩27,842,260`, confirmed revenue `₩25,551,740`, pending `₩1,358,700`, Meta purchase value `₩123,904,111`로 맞춰졌습니다. 그래서 `confirmed 0.92x`, `confirmed+pending 0.97x`, `Meta purchase 4.45x`라는 비교축은 이제 꽤 믿을 만합니다.【turn32file0†turn25file1†turn25file2】

* **여전히 남아 있는 핵심 리스크**

  1. CAPI dedup, 2) biocom payment page 품질, 3) campaign `(unmapped)`입니다. 문서도 이 세 개를 Top 3 blocker로 올렸고, 특히 최근 7일 운영 성공분에서 `같은 event_id 중복 174그룹`, `같은 orderId+eventName 중복 173그룹`인데, 그중 진짜 위험도가 높은 건 `다른 event_id로 같은 주문+이벤트가 반복된 3그룹 12건`이라고 좁혀졌습니다.【turn32file0†turn32file16】

* **운영 판단 기준**
  사이트 전체 Attribution ROAS는 써도 됩니다. 하지만 캠페인별 Attribution ROAS는 아직 금지 상태가 맞습니다. biocom `last_7d` 기준 `90건 / ₩25,551,740`가 전부 `(unmapped)`이고, alias seed는 있어도 `manual_verified = 0`이라 아직 matcher에 태우면 안 됩니다.【turn32file0†turn32file7】

## 다음에 뭐 하면 되나

우선순위는 딱 3개입니다.

### 1) dedup 원인 확정

이게 1순위입니다.
지금은 차단 로직을 넣을 타이밍이 아니라, **차단 후보 3그룹**을 직접 까봐야 합니다. 문서도 바로 차단하면 정상 재처리까지 막을 수 있어서 보류했다고 적고 있습니다.【turn32file6†turn32file7】

실행 순서는 이렇습니다.

* `재전송 차단 후보 3그룹`의 원본 로그를 뽑기
* 각 그룹마다 `orderId`, `eventName`, `event_id`, `created_at`, `source_url`, `send path(자동 sync / 수동 / 테스트)`를 확인
* 원인이

  * 자동 sync 재시작인지
  * 수동 재발송인지
  * 다른 호출 경로인지
    분리
* 그 다음에만 `orderId + eventName` 기준 운영 성공 이력 skip guard 적용 여부 결정

여기서 핵심은, **170그룹은 재시도형처럼 보이고 진짜 위험한 건 3그룹**이라는 점입니다. 그래서 범위가 충분히 좁아졌습니다.【turn32file16】

### 2) Meta 비교 기준 고정

지금부터는 팀 안에서 비교 기준을 하나로 고정해야 합니다.

* Meta UI 비교 대상: `결과 ROAS`와 그에 대응하는 `결과 값`
* 내부 비교 대상: `meta insights`의 `purchase_roas`, `website_purchase_roas`, `purchase_value`
* 헷갈리는 열: `구매 전환값`

이 기준을 안 고정하면, 같은 Ads Manager 화면을 보고도 누군가는 “메타는 80억 찍히는데 왜 API는 1.2억이냐”라고 말하게 됩니다. 지금 캡처가 보여준 건 **그 비교가 잘못된 열 비교일 가능성이 높다**는 점입니다.

### 3) payment page 품질 개선

여기도 여전히 중요합니다.
문서 기준으로 `payment_success 662건 중 all-three coverage 110건, 16.62%`입니다. 또 biocom 결제완료 페이지의 GTM custom script 오류도 아직 남아 있습니다. 즉 최근에 좋아지긴 했지만, 아직 내부 attribution을 강하게 믿을 수준은 아닙니다.【turn32file12†turn32file17】

여기서는

* GTM payment page 오류 정리
* 결제완료 caller에서 `ga_session_id`, `client_id`, `user_pseudo_id`
* 가능하면 `fbclid`, `fbc`, `fbp`
  를 더 안정적으로 받는 쪽으로 가야 합니다.

### 4) alias 수동 검토 시작

이건 4순위지만 바로 병렬로 들어갈 수는 있습니다.
`manual_verified = 0`인 상태에서 자동 반영은 금지 유지가 맞고, 대신 매출 큰 alias부터 사람이 yes/no 검토하는 게 맞습니다. audit 파일 기준 상위 alias 후보가 이미 정리돼 있으니, 상위 5개만 먼저 수동 검토하면 됩니다.【turn25file0†turn32file7】

## 지금 추가로 있으면 좋은 자료

지금 꼭 필요한 건 2개입니다.

첫째, **Meta Ads Manager에서 열 설정이 보이는 캡처 1장**입니다.
이미 날짜 범위와 계정은 확인됐습니다. 이제 아래만 보이면 충분합니다.

* attribution setting
* timezone
* column 설정 이름 또는 customize columns 화면

둘째, **dedup 차단 후보 3그룹의 원본 로그**입니다.
이건 제가 가장 보고 싶은 자료입니다.
필드만 있으면 됩니다.

* `orderId`
* `eventName`
* `event_id`
* `created_at`
* `source_url`
* `mode(operational/manual/test)`
* 가능하면 `syncRun` 또는 호출 경로

이 두 개가 있으면, 다음 단계에서
“정말 차단 로직을 넣어도 되는가”
까지 훨씬 자신 있게 판단할 수 있습니다.

## 최종 평가

이번 결과는 **좋습니다.**
이제는 “ROAS가 왜 다르지?”를 설명하는 단계에서 한 걸음 더 나아가, **어느 숫자를 메인으로 쓰고, 어떤 문제가 남았는지**가 명확해졌습니다.

제 판단은 이렇습니다.

* **지금 메인으로 써도 되는 값**: 최근 7일 Attribution confirmed `0.92x`
* **지금 참고값으로만 써야 하는 값**: Meta purchase `4.45x`
* **지금 가장 먼저 해결할 문제**: dedup 차단 후보 3그룹 원인 분석
* **지금 아직 금지해야 하는 것**: 캠페인별 Attribution ROAS 운영 판단

한 줄로 정리하면,
**지금은 새 대시보드를 더 만드는 단계가 아니라, `Meta UI 비교 기준 고정 + dedup 3그룹 원인 확정 + payment page 품질 개선`으로 숫자 신뢰도를 닫는 단계**입니다.
