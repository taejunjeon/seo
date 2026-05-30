작성 시각: 2026-05-26 00:58 KST
기준일: 2026-05-26
문서 성격: Google Ads 기존 `구매완료` NPay 버튼 클릭 smoke 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
  required_context_docs:
    - project/google-ads-npay-button-click-smoke-runbook-20260526.md
    - project/google-ads-purchase-signal-decomposition-and-npay-price-design-20260525.md
  lane: Yellow smoke result
  allowed_actions:
    - NPay button click observation
    - Chrome Network read-only evidence review
    - local report wording update
  forbidden_actions:
    - NPay final payment submit
    - Google Ads conversion upload
    - Google Ads conversion action edit
    - GTM publish
    - VM Cloud or operational DB write
  source_window_freshness_confidence:
    source: "TJ님 Chrome Network capture + live biocom product page"
    window: "2026-05-26 00:53~00:54 KST button-click smoke"
    freshness: "same-turn"
    confidence: "0.96"
```

## 10초 요약

NPay 버튼만 눌렀고 실제 결제는 하지 않았는데 Google Ads `구매완료` 라벨 요청이 발생했다.

따라서 기존 Google Ads `구매완료`는 실제 네이버페이 결제완료 전용 신호가 아니다. 앞으로 이 값은 `Google Ads 주장 구매`로 분리해서 보고, 예산 판단은 내부 confirmed 매출과 NPay actual 결제완료 보정값을 우선으로 봐야 한다.

## 관측된 사실

테스트 상태:

- 제품 URL: `https://biocom.kr/all_supplements/?idx=198`
- 행동: NPay 버튼 클릭
- 실제 결제: 하지 않음
- 화면 상태: 네이버 로그인/접근 오류 단계
- Google Ads 요청: 발생

발생한 요청의 주요 값:

```text
request_host = www.googleadservices.com
request_path = /pagead/conversion/304339096/
label = r0vuCKvy-8caEJixj5EB
url = https://biocom.kr/all_supplements/?idx=198
value = 35000
currency_code = KRW
event = conversion
oid_present = yes
```

주의:

- `oid` 원문은 문서에 남기지 않는다.
- 이번 요청은 실제 결제완료 후 요청이 아니라 버튼 클릭 후 네이버 로그인/접근 오류 단계에서 관측됐다.

## 결론

기존 Google Ads `구매완료`는 실제 결제완료 전용 구매 신호가 아니다.

이유:

1. 실제 결제 전에도 `구매완료` 라벨 요청이 발생했다.
2. 요청에 결제 금액처럼 보이는 `value=35000`이 들어갔다.
3. Google Ads API에서 이 라벨은 Primary 전환으로 잡혀 입찰 학습에 쓰인다.

## 영향

Google Ads ROAS가 내부 실제 매출보다 크게 보이는 핵심 원인 후보가 확인됐다.

NPay 실제 결제완료는 매출에 포함해야 한다. 하지만 NPay 버튼 클릭 또는 네이버 로그인 진입을 구매완료로 세면 안 된다.

## 하지 않은 것

- 실제 결제하지 않음
- 주문 생성하지 않음
- Google Ads 전환 업로드하지 않음
- Google Ads 전환 액션 수정하지 않음
- GTM publish 하지 않음
- VM Cloud/운영DB write 하지 않음

## 다음 판단

1. 기존 `구매완료` Primary는 바로 삭제/수정하지 않는다. Google 자동입찰 학습에 직접 영향이 있기 때문이다.
2. 로컬 보고서에서는 이 값을 `Google Ads 주장 구매`로 계속 분리한다.
3. 실제 결제완료 전용 전환 통로를 no-send 후보 생성기로 먼저 안정화한다.
4. 그 후보가 충분히 쌓이면 Google Ads 전환 액션을 정리하는 승인안을 별도로 만든다.
