작성 시각: 2026-05-26 00:43 KST
기준일: 2026-05-26
문서 성격: Google Ads 기존 `구매완료`가 NPay 실제 결제완료인지 확인하는 버튼 클릭 smoke 절차

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gdn/attribution-data-source-decision-guide-20260511.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - project/google-ads-purchase-label-and-confirmed-only-path-20260524.md
    - project/google-ads-purchase-signal-decomposition-and-npay-price-design-20260525.md
  lane: Yellow
  allowed_actions:
    - live site product page open
    - Chrome DevTools Network read-only observation
    - NPay button click once
    - no payment completion
    - no order creation
    - no Google Ads setting change
  forbidden_actions:
    - NPay final payment submit
    - Google Ads conversion upload
    - Google Ads conversion action edit
    - GTM publish
    - VM Cloud or operational DB write
  source_window_freshness_confidence:
    source: "Google Ads API + live biocom product page HTML + Chrome Network observation"
    window: "button click moment only"
    freshness: "live smoke at execution time"
    confidence: "smoke PASS/FAIL based on observed conversion request"
```

## 10초 요약

이 smoke의 목적은 실제 결제 없이 `NPay 버튼 클릭만으로 Google Ads 구매완료 요청이 나가는지` 확인하는 것이다.

버튼을 누르자마자 `AW-304339096/r0vuCKvy-8caEJixj5EB` 요청이 보이면, 기존 Google Ads `구매완료`는 실제 결제완료 전용이 아니다. 반대로 버튼 클릭만으로 요청이 안 보이면, 실제 네이버페이 결제완료 단계에서만 나가는지 다음 테스트로 좁힌다.

## 지금 확인하려는 질문

Google Ads 화면의 `구매완료`가 아래 둘 중 무엇인지 확인한다.

1. `NPay 버튼/주문 시작 신호`
2. `실제 네이버페이 결제완료 신호`

최근 Google Ads API와 아임웹 live HTML 기준으로는 1번 가능성이 높다. 이 smoke는 결제 없이 그 가능성을 직접 확인하는 절차다.

## 테스트 전 준비

### 추천 시작 URL

광고 클릭 없이 먼저 아래 직접 제품 URL로 테스트한다.

```text
https://biocom.kr/all_supplements/?idx=198
```

이유:

- 실제 광고비/광고 클릭을 쓰지 않는다.
- 결제도 하지 않는다.
- 그래도 사이트 코드가 같은 `구매완료` 라벨을 보내는지 확인할 수 있다.

### Chrome DevTools 설정

1. Chrome에서 위 제품 URL을 연다.
2. DevTools를 연다.
3. `Network` 탭을 연다.
4. `Preserve log`를 켠다.
5. 필터 입력칸에 아래 중 하나를 넣는다.

```text
r0vuCKvy
```

보조 필터:

```text
pagead/conversion
```

```text
googleadservices
```

## 실행 절차

1. 제품 페이지에서 NPay 버튼이 보이는지 확인한다.
2. DevTools Network가 열린 상태에서 NPay 버튼을 한 번만 누른다.
3. 네이버페이 창이나 페이지가 열리면 결제는 하지 않는다.
4. Network에 `r0vuCKvy-8caEJixj5EB` 또는 `pagead/conversion/304339096` 요청이 생겼는지 본다.
5. 생긴 요청을 클릭해 Query String Parameters를 확인한다.

확인할 값:

```text
label = r0vuCKvy-8caEJixj5EB
value = 상품/주문 금액으로 보이는 숫자
currency 또는 currency_code = KRW
transaction_id 또는 order_no 성격의 값 존재 여부
```

## 판정 기준

### PASS-A: 버튼 클릭만으로 요청 발생

판정:

```text
기존 Google Ads 구매완료는 실제 결제완료 전용이 아니다.
```

의미:

- 실제 돈이 결제되기 전에도 구매완료 라벨 요청이 나간다.
- Google Ads ROAS가 내부 실제 매출보다 크게 보이는 핵심 원인 후보가 된다.
- 다음 작업은 기존 Primary를 바로 끄는 것이 아니라, 실제 결제완료 전용 전환 통로를 Secondary/no-send로 안정화하는 것이다.

### PASS-B: 버튼 클릭만으로 요청 없음

판정:

```text
버튼 클릭만으로는 결론이 닫히지 않는다.
```

의미:

- 실제 네이버페이 결제완료 후 NPay order callback에서만 전환 요청이 나갈 수 있다.
- 이 경우 소액 실제 결제완료 테스트 1건을 별도 승인 후 진행한다.

### FAIL: DevTools에서 확인 불가

가능 원인:

- DevTools Network 필터가 너무 좁다.
- NPay가 새 창/iframe에서 열려 원래 탭 Network에 안 남았다.
- 광고/추적 차단 확장 프로그램이 요청을 막았다.

다음 확인:

- `Preserve log` ON 여부 확인
- 필터를 비우고 `conversion`, `google`, `pagead` 순서로 넓혀 보기
- Chrome 확장 프로그램이 요청을 막는지 확인

## 절대 하지 않을 것

- 네이버페이 최종 결제 버튼을 누르지 않는다.
- 주문을 생성하지 않는다.
- Google Ads 설정을 바꾸지 않는다.
- Google Ads 전환을 업로드하지 않는다.
- VM Cloud나 운영DB에 값을 쓰지 않는다.

## 결과 기록 양식

TJ님이 smoke 후 Codex에 전달할 최소 정보:

```text
테스트 시각:
테스트 URL:
NPay 버튼 클릭 여부: yes/no
결제 진행 여부: no
Network 요청 발생 여부: yes/no
요청 URL 또는 캡처:
label 값:
value 값:
currency 값:
transaction_id/order_no 성격 값:
```

## 다음 행동

1. `PASS-A`이면 Google Ads 기존 `구매완료`를 실제 구매가 아닌 `NPay 구매 신호`로 계속 분리 표시한다.
2. `PASS-B`이면 소액 실제 NPay 결제완료 테스트 승인안을 작성한다.
3. 어느 경우든 기존 Primary 전환을 즉시 수정하지 않는다. 실제 결제완료 전용 후보 생성기와 Secondary 전환 통로를 먼저 안정화한다.
