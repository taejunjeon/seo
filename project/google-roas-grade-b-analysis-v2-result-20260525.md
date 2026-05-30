# Google ROAS Grade B / 분석 알고리즘 v2 결과

작성 시각: 2026-05-25 22:36 KST
기준일: 2026-05-25
문서 성격: 결과보고서

```yaml
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - frontrule.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: "Green read-only + Yellow report deploy"
  allowed_actions:
    - VM Cloud SQLite read-only
    - Google Ads API read-only
    - frontend/backend report code deploy
    - PM2 frontend/backend restart for report visibility
  forbidden_actions:
    - Google Ads upload/send
    - GTM publish
    - 운영DB write
    - VM Cloud bridge ledger write
  source_window_freshness_confidence:
    source: "VM Cloud SQLite + Google Ads API + 운영DB read-only via existing API"
    window: "last_7d + analysis_v2_since_2026-05-25 06:30 KST"
    freshness: "live API at 2026-05-25 22:24~22:35 KST"
    confidence: "high for click capture; medium for order-level bridge until write is not enabled"
```

## 10초 요약

Grade B는 구매가 가짜라는 뜻이 아니다. 같은 주문일 가능성은 있지만, 자동으로 장부에 쓰거나 Google Ads에 보내기에는 시간 간격이나 click id 증거가 부족하다는 뜻이다.

최근 7일 NPay bridge 후보 17건 중 현재 증거만으로 B를 A로 올릴 수 있는 건은 0건이다. Google click id가 있는 B급 1건은 수동 검토 후보지만, 결제까지 12.5분이 걸려 자동 A급이나 Google Ads 전송 후보로 올리지 않는다.

Google Ads URL 추적 파라미터 보강은 현재 보류가 맞다. 24시간 smoke는 지났고, 실제 클릭 단계에서는 click id와 campaign id가 들어오고 있다. 병목은 URL이 아니라 결제완료 주문까지 직접 이어지는 bridge다.

## 확인한 숫자

- 분석 알고리즘 v2 기준점: 2026-05-25 06:30 KST
- 광고 클릭 직후 URL: 539건 중 Google click id 398건, gad_campaignid 391건
- 클릭 의도 저장: 427건 중 Google click id 427건, gad_campaignid 423건
- 구매하기 진입: 46건 중 Google click id 1건
- 결제 화면 체류: 139건 중 Google click id 3건
- 결제완료 신호 전체: 21건 중 Google click id 0건
- 실제 결제완료 주문 직접 보존: 27건 중 Google click id 0건
- NPay 클릭-주문 후보: 12건 중 Google click id 8건

## B급 판단

최근 7일 NPay actual 주문 20건 중 내부 bridge 후보는 17건이다.

- A급: 11건
- B급: 6건
- 애매한 후보: 3건
- B에서 A로 즉시 올릴 수 있는 후보: 0건
- B급 중 Google click id가 있는 후보: 1건
- Google Ads 전송 후보: 0건
- 운영DB write: 0건
- VM Cloud bridge write: 0건

Google click id가 있는 B급 1건은 주문 생성과 금액은 맞지만, NPay 클릭 후 결제완료까지 12.5분이 걸렸다. A급 기준은 2분 이내라서 중간에 다른 행동이 끼었을 가능성을 남긴다.

## 2026-05-25 23:04 KST 추가 재조사

이번 재조사는 B급 6건을 “A로 올릴 수 있나”가 아니라 “왜 아직 A가 아닌지”를 더 쉽게 나누기 위한 것이다. raw 주문번호, 결제번호, click id는 문서에 남기지 않는다.

### B급 6건을 더 쪼갠 결과

- B1: Google click id는 있다. 상품명, 주문 생성 시각, 금액도 맞다. 다만 NPay 클릭 후 결제완료까지 12.5분이 걸렸다. A급 자동 기준은 2분 이내라서, 중간에 다른 행동이 끼었을 가능성을 남긴다. 이 건은 수동 검토 후보이지 Google Ads 전송 후보가 아니다.
- B2, B3: 주문 생성 시각과 상품명은 맞지만 결제 금액이 상품가/배송비/수량 조합으로 딱 떨어지지 않는다. Google click id도 없다. 내부 후보로는 볼 수 있지만 A급이나 Google Ads 전송 후보는 아니다.
- B4: 금액과 상품명은 맞고 주문 생성 시각도 가깝지만 3.0분으로 A급 2분 기준을 살짝 넘는다. Google click id도 없다. 내부 분석 후보로만 유지한다.
- B5, B6: 주문 생성 시각과 상품명은 맞지만 결제 금액이 단일 상품가와 맞지 않는다. 3개 묶음이나 옵션 조합일 가능성은 있지만, 현재 원장에서는 그 조합을 확정할 수 없다. Google click id도 없다.

정리하면, B급 6건 중 즉시 A로 올릴 수 있는 건은 0건이다. Google click id가 있는 건은 1건뿐이고, 그 1건도 결제까지 걸린 시간이 길어 자동 확정하지 않는다.

### 결제완료 단계 click id 유실 지점

분석 알고리즘 v2 기준점 이후 원자료를 UTC 기준으로 다시 보면, Google click id가 있는 checkout 흐름은 4개 checkout_id다.

- 1개 checkout_id: 결제완료까지 갔고, payment_success에도 Google click id가 보존됐다.
- 3개 checkout_id: 구매하기/결제 화면에는 Google click id가 있었지만, 아직 같은 checkout_id의 payment_success가 없다. 즉 “결제완료에서 사라졌다”기보다 “결제완료까지 도달한 기록이 아직 없다”로 보는 것이 더 정확하다.
- 같은 checkout_id 안에서 `payment_page_seen에는 Google click id가 있었는데 payment_success에서 사라진` 케이스는 현재 0건이다.

따라서 현재 가장 좁혀진 병목은 두 가지다.

1. 대부분 주문은 애초에 checkout 단계에서 Google click id가 없는 흐름으로 들어온다.
2. Google click id가 있는 checkout 흐름은 아직 표본이 적고, 결제완료까지 이어진 표본이 1건뿐이다.

### API 집계 주의점

보고서 API의 `analysis_v2` window는 KST 기준점 문자열을 사용한다. 반면 VM Cloud SQLite의 `logged_at`은 대부분 UTC `Z` 문자열이다. SQLite에서 이 둘을 문자열로 비교하면 2026-05-25 새벽 KST에 들어온 일부 row가 집계에서 빠질 수 있다.

이 문제 때문에 화면 숫자는 “추세 확인용”으로 보고, 결론은 UTC로 재계산한 원자료 기준을 함께 봐야 한다. 로컬 코드에는 SQLite 비교용 시간 경계를 UTC `Z` 문자열로 바꾸는 보정을 반영했다. VM Cloud 운영 배포 전까지는 원자료 재계산 숫자를 우선 근거로 본다.

## 2026-05-25 23:20 KST 추가 재조사 — B급 금액 불일치

재조회 시점에 B급은 6건에서 7건으로 늘었다. 새 NPay 주문이 추가로 들어왔기 때문이다. 따라서 기존 6건만 고정해서 보지 않고 현재 B급 7건 전체를 다시 봤다.

핵심 결론은 단순하다. 금액이 이상한 것이 아니라, NPay 클릭 신호에 상품 가격이 비어 있거나 0으로 들어와서 매칭기가 금액 비교를 못 하고 있었다.

- B1: 뉴로마스터 3+1 세트다. 운영DB line item에는 117,000원이 정확히 있다. click intent 쪽 상품 가격이 0이라 금액 비교가 실패했다. Google click id는 없다.
- B2: 바이오밸런스 1개 할인가 39,000원이다. 금액은 맞고 Google click id도 있다. 다만 결제까지 12.5분이 걸려 자동 A급은 아니다.
- B3: 리셋데이 2개 할인가 55,600원이다. 운영DB line item에는 55,600원이 정확히 있다. click intent 쪽 상품 가격이 0이라 금액 비교가 실패했다. Google click id는 없다.
- B4: 당당케어 2개 세트 116,000원이다. 운영DB line item에는 116,000원이 정확히 있다. click intent 쪽 상품 가격이 0이라 금액 비교가 실패했다. Google click id는 없다.
- B5: 메타드림 1개 36,900원이다. 금액은 맞지만 결제까지 3.0분이 걸려 2분 기준을 넘었다. Google click id는 없다.
- B6: 바이오밸런스 3+1 세트 117,000원이다. 운영DB line item에는 117,000원이 정확히 있다. click intent 쪽 상품 가격이 0이라 금액 비교가 실패했다. Google click id는 없다.
- B7: 풍성밸런스 3+1 세트 117,000원이다. 운영DB line item에는 117,000원이 정확히 있다. click intent 쪽 상품 가격이 0이라 금액 비교가 실패했다. Google click id는 없다.

따라서 “금액 불일치”라는 표현은 지금 상태에서는 부정확하다. 더 정확한 표현은 “NPay 클릭 신호의 상품 가격 증거 부족”이다. 내부 bridge 점수는 개선할 수 있지만, Google click id가 없는 건은 Google Ads 전송 후보가 될 수 없다.

## Google ROAS 갭을 줄이는 큰 순서

지금처럼 한 주문씩만 보면 너무 국소적이다. 갭이 큰 이유는 실제로 여러 문제가 겹쳐 있을 가능성이 높다. 아래 순서대로 닫아야 한다.

### 1단계. Google이 구매로 세는 신호를 실제 구매와 분리한다

Google Ads가 말하는 구매완료가 진짜 결제완료인지 먼저 확인해야 한다. NPay 클릭, 결제 시작, 장바구니, GA4 import, 실제 결제완료가 섞여 있으면 Google ROAS는 크게 부풀 수 있다.

성공 기준은 Google Ads 전환액을 `실제 결제완료로 볼 수 있는 값`, `결제 전 행동일 가능성이 있는 값`, `정체를 더 봐야 하는 값`으로 나누는 것이다.

### 2단계. 내부 실제 매출 기준을 고정한다

예산 판단에는 Google Ads가 주장하는 매출이 아니라 내부 confirmed 주문을 써야 한다. NPay 실제 결제완료는 매출에 포함하고, NPay 클릭이나 결제 시작은 매출로 보지 않는다.

성공 기준은 내부 confirmed ROAS가 날짜별, 캠페인별로 흔들리지 않고 같은 숫자로 반복 조회되는 것이다.

### 3단계. Google click id가 주문까지 살아남는 길을 늘린다

클릭 직후에는 gclid/gbraid/gad_campaignid가 잘 잡힌다. 지금 병목은 결제완료 주문까지 직접 이어지는 표본이 너무 적다는 것이다.

성공 기준은 `광고 클릭 → 구매하기 → 결제 화면 → 결제완료`를 같은 checkout_id 또는 주문번호로 따라갔을 때, Google click id가 남는 confirmed 주문이 꾸준히 생기는 것이다.

### 4단계. NPay 외부 결제 bridge를 내부 분석용과 Google Ads 전송용으로 분리한다

NPay는 외부 결제 화면에서 끝나므로 내부 주문번호와 클릭 신호를 이어 붙이는 bridge가 필요하다. 다만 내부 분석용 bridge와 Google Ads에 다시 보내는 후보는 기준이 달라야 한다.

성공 기준은 내부 bridge A급은 늘리되, Google Ads 전송 후보는 direct click id가 있는 주문만 남기는 것이다.

### 5단계. Google Ads에 실제 결제완료만 알려주는 새 통로를 준비한다

기존 Google Ads Primary 전환은 바로 건드리지 않는다. 대신 실제 결제완료 confirmed 주문만 보내는 no-send 후보 생성기를 먼저 만든다.

성공 기준은 7일 동안 중복 0건, 취소/환불 제외, value > 0, click id 직접 보존, 전송 후보와 차단 후보가 주문별로 설명되는 것이다. 이 조건 전에는 Google Ads upload를 실행하지 않는다.

## Google Ads URL 추적 파라미터 보강 판단

현재는 전체 Google Ads URL suffix나 tracking template을 바로 바꿀 필요가 없다.

이유는 단순하다. 실제 클릭 원장에는 Google click id와 gad_campaignid가 들어온다. 따라서 지금 문제는 광고 URL에서 값이 붙지 않는 문제가 아니라, 결제완료 주문에 그 값이 직접 남지 않는 문제다.

다시 열 조건은 특정 캠페인에서 gad_campaignid가 반복적으로 빠지는 증거가 나올 때다. 그때도 계정 전체 일괄 변경보다 캠페인 단위 제한 보강이 우선이다.

## 반영한 화면

- 보고서: https://biocom.ainativeos.net/ads/google-roas-report
- B급이 왜 A급이 아닌지 쉬운 문장으로 표시했다.
- NPay bridge 후보 17건, A급 11건, B급 6건, A 승격 0건을 같은 화면에서 표시했다.
- 2026-05-25 06:30 KST 이후 유실 지점 숫자를 따로 표시했다.
- Google Ads URL 추적 파라미터 보강은 `현재 보류`로 표시했다.

## 하지 않은 것

- Google Ads upload/send: 0건
- Google Ads Primary 전환 변경: 0건
- GTM publish: 0건
- 운영DB write: 0건
- VM Cloud bridge ledger write: 0건
- raw click id 또는 주문 식별자 노출: 하지 않음

## 다음 할일

1. Codex: NPay B급 6건을 주문 흐름별로 더 좁힌다. 목적은 A로 올리는 것이 아니라, 왜 보류인지 사람 눈으로 납득 가능한 근거를 남기는 것이다.
2. Codex: 결제완료 신호 전체 21건 중 click id 0건인 이유를 payment_success payload와 checkout_context 복원 경로로 나눠 확인한다.
3. TJ님: Google Ads URL suffix 변경은 현재 누르지 않는다. 특정 캠페인에서 campaign id 누락이 재현될 때만 제한 보강안을 다시 본다.
