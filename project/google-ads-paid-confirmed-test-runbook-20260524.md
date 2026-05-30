# Google 광고 클릭 후 paid confirmed 테스트 실행 기록지

작성 시각: 2026-05-24 12:20 KST
문서 성격: 실제 결제 테스트 준비 기록
대상: 바이오컴 Google Ads click id 보존 / 실제 결제완료 연결 검증

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
  project_harness_read:
    - imweb/!coderule.md
    - project/google-payment-success-exact-evidence-loss-readonly-20260523.md
    - project/google-ads-purchase-21-and-click-loss-green-audit-20260524.md
  lane: Red_for_payment_execution / Green_for_preparation_and_readonly_verification
  allowed_actions:
    - 테스트 절차 작성
    - 기준선 API read-only 조회
    - 테스트 후 VM Cloud/API read-only 재조회
    - 원장 비교 문서화
  forbidden_actions_without_explicit_confirmation:
    - Codex가 직접 실제 결제 수행
    - Google Ads conversion upload
    - Google Ads 전환 설정 변경
    - GTM publish
    - 운영DB 또는 VM Cloud write
    - Imweb header/footer save
  source_window_freshness_confidence:
    baseline_order_health:
      source: "/api/google-ads/click-id-health/orders?window=rolling_24h"
      freshness: "2026-05-24 12:19 KST"
      confidence: "높음"
    baseline_google_ads:
      source: "/api/google-ads/dashboard?date_preset=last_1d"
      freshness: "2026-05-24 12:19 KST"
      confidence: "높음"
```

## 한 줄 결론

이 테스트의 목적은 “Google 광고 클릭에서 실제 결제완료까지 간 주문 1건이 VM Cloud 원장에 Google click id와 함께 남는지” 확인하는 것이다.

## 예전에 했던 기록과 이번 테스트의 차이

예전 기록은 있다. 다만 이번에 필요한 테스트와 완전히 같지는 않다.

확인된 과거 기록:

- Google 광고 클릭 후 결제완료 페이지까지 간 테스트가 있었다.
- 그 테스트들은 `payment_success` 계열 row까지 Google click evidence가 보존됐다.
- 하지만 최종 주문 상태는 confirmed가 아니라 canceled/pending 성격으로 정리됐다.
- 따라서 Google Ads upload 후보나 내부 confirmed ROAS 분자로 쓰면 안 된다.

최근 7일 direct evidence 5건도 있다.

- 주문번호: `202605179351380`, `202605172235478`, `202605182747344`, `202605199037917`, `202605201016693`
- 모두 2026-05-21 밤 아임웹 보강 이전 결제완료다.
- 이것들이 TJ님의 실제 paid 테스트였는지는 문서 근거만으로는 확정하지 않는다.

이번 테스트는 아래가 다르다.

- 2026-05-21 밤 보강 이후 기준으로 한다.
- Google 광고 실제 클릭에서 시작한다.
- 가상계좌 미입금이 아니라 실제 결제완료 paid confirmed까지 닫는다.
- 주문번호 기준으로 VM Cloud `payment_success confirmed`와 Google click id 직접 보존 여부를 확인한다.

## 테스트 시작 전 기준선

조회 시각: 2026-05-24 12:19 KST

### 내부 주문 기준

Source: `/api/google-ads/click-id-health/orders?window=rolling_24h&only=all&limit=3`

| 항목 | 값 |
| --- | ---: |
| 최근 24시간 결제완료 주문 | 32건 |
| Google click id 직접 보존 주문 | 0건 |
| Google Ads upload 후보 | 0건 |

### Google Ads 주장값

Source: `/api/google-ads/dashboard?date_preset=last_1d`

| 항목 | 값 |
| --- | ---: |
| Google Ads 주장 `구매완료` | 21건 |
| Google Ads 주장 구매 금액 | 4,050,200원 |
| 전환 액션 ID | 7130249515 |
| 분류 | primary_known_npay |

## TJ님 실행 절차

### 권장 브라우저

가능하면 PC Chrome 새 시크릿 창에서 진행한다.

이유:

- 기존 biocom localStorage/cookie에 남은 오래된 click id와 섞이는 것을 줄이기 위해서다.
- 단, 시크릿 창에서 광고가 안 보이면 일반 Chrome으로 진행해도 된다. 그 경우 “일반 Chrome 진행”이라고 기록한다.

### 1. Google 광고 클릭

1. Google에서 `영양중금속검사`를 검색한다.
2. `광고` 또는 `Sponsored`로 표시된 바이오컴 광고를 클릭한다.
3. 랜딩 직후 주소창 URL을 복사한다.
4. URL에 아래 중 하나가 있는지 확인한다.
   - `gclid`
   - `gbraid`
   - `wbraid`
   - `gad_campaignid`

성공 기준:

- 랜딩 URL에 `gclid` 또는 `gbraid`가 있다.
- `gad_campaignid`도 있으면 캠페인 매칭 확인이 더 쉽다.

### 2. 구매하기 진입

1. 같은 탭에서 구매하기 버튼을 누른다.
2. `/shop_payment/` URL을 복사한다.
3. 결제수단은 가능하면 `신용카드`를 권장한다.

이유:

- 이번 목적은 NPay 자체가 아니라 Google click id가 실제 paid confirmed까지 남는지 보는 것이다.
- 카드 결제가 결제완료 판단 경로가 가장 단순하다.

### 3. 실제 결제완료

1. 실제 결제를 완료한다.
2. 최종 완료 URL을 복사한다.
3. 주문번호, 결제금액, 결제수단, 결제완료 시각을 기록한다.

성공 기준:

- 최종 URL이 `/shop_payment_complete` 또는 결제완료 계열이다.
- 주문이 미입금 pending이 아니라 실제 paid confirmed 상태가 된다.

## TJ님이 대화에 보내주면 되는 값

아래 5개만 보내면 된다.

```text
테스트 시작 시각(KST):
랜딩 URL:
/shop_payment/ URL:
최종 결제완료 URL:
결제수단/결제금액/주문번호:
```

raw gclid/gbraid/wbraid가 URL에 들어 있어도 된다. Codex는 결과 문서에는 원문을 그대로 노출하지 않고 presence/type만 남긴다.

## Codex가 테스트 후 확인할 것

1. VM Cloud `site_landing_ledger`에 해당 Google 클릭 row가 들어왔는지 확인한다.
2. VM Cloud `paid_click_intent_ledger`에 `gad_campaignid`와 click id가 들어왔는지 확인한다.
3. `/shop_payment/` 진입 시 `checkout_started` 또는 `payment_page_seen`에 click id presence가 유지됐는지 확인한다.
4. 최종 `payment_success confirmed` row에 같은 주문번호와 click id가 직접 붙었는지 확인한다.
5. Google Ads upload 후보가 여전히 0인지, 또는 no-send 후보 1건이 생겼는지 확인한다.

## 성공 / 실패 해석

### 성공

테스트 주문이 confirmed이고, 같은 주문번호의 payment_success row에 gclid/gbraid/wbraid 중 하나가 직접 남는다.

의미:

- 아임웹 현재 코드가 paid confirmed 경로에서도 click id를 보존할 수 있다.
- 자연 주문 0건 문제는 “실제 Google 클릭 주문 부족” 또는 “Google Ads의 구매완료 action 오염” 쪽 가능성이 커진다.

### 부분 성공

landing/checkout/payment_page에는 click id가 있는데 payment_success confirmed에만 없다.

의미:

- 결제완료 payload 생성 지점에서 click id 복원이 빠진 것이다.
- payment_success bridge 보강이 필요하다.

### 실패

랜딩 URL에는 click id가 있었는데 VM Cloud site_landing/paid_click_intent에도 없다.

의미:

- GTM receiver 또는 early capture 쪽 문제다.
- Google 광고 클릭 수집부터 다시 봐야 한다.

## 금지선

- 이번 테스트 결과만으로 Google Ads upload를 보내지 않는다.
- 기존 `구매완료` Primary 전환을 변경하지 않는다.
- 주문번호와 raw click id를 공개 문서에 그대로 남기지 않는다.
