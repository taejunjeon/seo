# Google Ads 실제 결제완료 주문 단위 좁히기 - 2026-05-26

작성 시각: 2026-05-26 01:55 KST  
기준일: 2026-05-26  
문서 성격: Green Lane read-only / no-send / no-write 주문 단위 진단

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  lane: Green
  allowed_actions:
    - VM Cloud public API read-only
    - Google Ads API read-only summary interpretation
    - local markdown report write
    - no-send candidate classification
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads conversion action mutation
    - Google Ads primary goal change
    - operational DB write
    - VM Cloud SQLite write
    - deploy_or_restart
    - GTM publish
  source_window_freshness_confidence:
    source:
      - https://att.ainativeos.net/api/google-ads/click-id-health/orders
      - https://att.ainativeos.net/api/google-ads/click-id-dropoff
      - https://att.ainativeos.net/api/google-ads/dashboard-summary
    window:
      - last_7d: 2026-05-19 ~ 2026-05-25 KST
      - last_30d: 2026-04-26 ~ 2026-05-25 KST
      - rolling_24h: 2026-05-25 01:52 ~ 2026-05-26 01:52 KST
      - analysis_v2: 2026-05-25 06:30 ~ 2026-05-26 01:54 KST
    freshness: 2026-05-26 01:52~01:54 KST read-only 재조회
    confidence: high for direct order diagnostics, medium for final Google Ads send readiness until approval and duplicate guard packet are completed
```

## 10초 요약

실제 결제완료 주문 중 Google click id가 직접 붙은 주문은 최근 7일 기준 3건뿐이다. 이 3건은 모두 카드 결제이며, NPay 실제 결제완료 주문은 아직 Google Ads 전송 후보가 아니다.

Google Ads에 보낼 수 있는 후보는 여전히 0건이다. 이유는 주문이 가짜라서가 아니라, 실제 전송은 별도 승인 전 금지이고, 중복 방지와 전환 액션 연결을 아직 열지 않았기 때문이다.

## 지금 무엇을 좁혔나

이전에는 "최근 7일 실제 결제완료 410건 중 direct evidence 3건"처럼 숫자만 보였다. 이번에는 그 3건이 어떤 성격인지 주문 단위로 나눴다.

- 실제 결제완료는 맞다.
- 취소/환불은 없다.
- Google click id는 직접 붙어 있다.
- 결제수단은 모두 카드다.
- 아직 Google Ads에 보낼 후보는 아니다.

## 실제 결제완료 주문 단위 결과

source: `/api/google-ads/click-id-health/orders?window=last_7d&only=with_click_id&limit=20`  
freshness: 2026-05-26 01:52 KST  
confidence: high

| 구간 | 실제 결제완료 | Google click id 직접 보존 | 보존률 | Google Ads 전송 후보 |
|---|---:|---:|---:|---:|
| 최근 7일 | 410건 | 3건 | 0.73% | 0건 |
| 최근 30일 | 2,150건 | 16건 | 0.74% | 0건 |
| 최근 24시간 | 32건 | 0건 | 0.00% | 0건 |
| 분석 v2 기준점 이후 | 27건 | 0건 | 0.00% | 0건 |

## 최근 7일 direct evidence 3건의 성격

주문번호와 click id 원문은 문서에 쓰지 않는다. 아래는 주문번호 일부와 click id 종류만 남긴 검토표다.

| masked order | 결제수단 | 결제금액 | click id 종류 | evidence source | 취소/환불 | 현재 판단 |
|---|---|---:|---|---|---|---|
| 20260519...037917 | CARD | 245,000 | gclid + gbraid | payment_success_ledger | 없음 | 내부 검토 후보. Google Ads 전송은 아직 금지 |
| 20260520...016693 | CARD | 36,900 | gclid | payment_success_ledger | 없음 | 내부 검토 후보. Google Ads 전송은 아직 금지 |
| 20260524...353635 | CARD | 234,000 | gclid | payment_success_ledger | 없음 | 내부 검토 후보. 5월 21일 보강 이후 direct evidence 표본 |

## ready_but_not_sent 검토표

`ready_but_not_sent` 검토표는 "Google Ads에 이미 보낼 수 있다"는 뜻이 아니다.  
사람 말로는 "실제 결제완료와 광고 클릭 증거가 같이 보이는 주문을 따로 꺼내서, 왜 아직 전송하면 안 되는지 사유를 붙이는 대기표"다.

이번 3건은 실제 결제완료 주문이고 Google click id도 남아 있다. 하지만 Google Ads 전송 후보는 0건이다.

| masked order | 실제 결제 확인 | 광고 클릭 증거 | 지금 통과한 것 | 아직 막힌 것 | 현재 분류 |
|---|---|---|---|---|---|
| 20260519...037917 | 카드 결제완료, 취소/환불 없음 | gclid + gbraid | 실제 주문, 금액, click id 직접 증거 | 전송용 식별자 1개 선택 규칙, safe_ref snapshot, 중복 방지 장부 미오픈 | 검토표 row. 전송 대기 아님 |
| 20260520...016693 | 카드 결제완료, 취소/환불 없음 | gclid | 실제 주문, 금액, click id 직접 증거 | Google Ads 전송 승인 없음, dispatcher 닫힘, safe_ref snapshot 미오픈 | 검토표 row. 전송 대기 아님 |
| 20260524...353635 | 카드 결제완료, 취소/환불 없음 | gclid | 5월 21일 보강 이후 direct evidence 표본 | 단일 표본이라 안정성 부족. 7일 이상 반복 확인 필요 | 검토표 row. 전송 대기 아님 |

요약하면, 이 3건은 "광고 클릭과 실제 결제완료가 같은 주문에 같이 보인 사례"다.  
하지만 Google Ads에 실제 구매로 보내려면 `중복 전송 방지`, `취소/환불 후속 반영`, `전송용 전환 액션`, `전송 승인`이 함께 준비되어야 한다.

### 이 3건이 바로 전송 후보가 아닌 이유

1. `no-send` 단계다. Google Ads에 아직 아무것도 보내지 않는다.
2. `BI confirmed_purchase_offline` 관찰용 전환 액션은 계정에 보이지만, 이 후보를 실제 전송 대상으로 연결하지 않았다.
3. 중복 방지 기준을 전송용으로 고정하지 않았다.
4. 취소/환불 후속 반영과 재전송 방지 장부가 아직 쓰기 전 단계다.
5. raw click id를 문서/보고서에 남기지 않는 보안 기준을 유지해야 한다.

## 최근 30일 direct evidence 16건에서 배운 점

최근 30일에는 direct evidence가 16건 있다. 대부분 카드 결제이고, 1건은 명시적인 `test_*` click id라서 전송 후보에서 제외해야 한다.

사람 말로 풀면 이렇다.

- 카드 결제 경로에서는 Google click id가 결제완료까지 살아남은 사례가 있다.
- 하지만 비율이 1% 미만이라 아직 안정적이라고 볼 수 없다.
- NPay 외부 결제완료는 click id가 주문에 직접 붙지 않는다.
- 따라서 Google Ads 실제 결제완료 전용 통로는 `카드 direct evidence`와 `NPay bridge evidence`를 별도 규칙으로 나눠야 한다.

## 분석 v2 기준점 이후 병목

source: `/api/google-ads/click-id-dropoff?window=analysis_v2`  
window: 2026-05-25 06:30 ~ 2026-05-26 01:54 KST  
freshness: 2026-05-26 01:54 KST  
confidence: high for stage counts, medium for exact row-to-row cause

| 단계 | row | Google click id row | 보존률 | 해석 |
|---|---:|---:|---:|---|
| 광고 클릭 직후 URL | 1,187 | 813 | 68.49% | 클릭 직후 저장은 되고 있다 |
| 클릭 의도 저장 | 881 | 881 | 100.00% | 태그가 클릭 ID를 받는 단계는 정상 |
| 구매하기 진입 | 121 | 4 | 3.31% | 상품에서 결제 진입으로 가며 크게 줄어든다 |
| 결제 화면 체류 | 365 | 11 | 3.01% | 결제 화면에도 일부 남지만 적다 |
| 결제완료 신호 전체 | 63 | 1 | 1.59% | 완료 신호에서 더 줄어든다 |
| 실제 결제완료 주문 직접 보존 | 27 | 0 | 0.00% | 실제 주문 단위에는 붙지 않는다 |
| NPay 클릭-주문 exact 후보 | 37 | 27 | 72.97% | NPay는 클릭 의도에는 click id가 있지만 주문 exact 연결이 아직 없다 |

### 병목을 사람 말로 설명하면

광고 클릭은 잘 잡힌다. 문제는 고객이 결제를 끝낸 뒤, 그 주문번호에 "이 주문은 아까 그 Google 광고 클릭에서 왔다"는 꼬리표가 붙지 않는 것이다.

특히 NPay는 네이버 화면 밖에서 결제가 끝나기 때문에 우리 사이트의 결제완료 페이지에서 click id를 직접 되찾기 어렵다. 그래서 NPay는 실제 주문번호 bridge가 필요하다.

## NPay bridge 후보는 왜 Google Ads 전송 후보가 아닌가

최근 7일 NPay bridge 검토표에는 Google click id가 있는 후보가 1건 있다. 하지만 그 1건은 A급 자동 후보가 아니라 B급 수동 검토 후보다.

| masked order | 결제수단 | 금액 | Google click id | campaign id | 등급 | 왜 A가 아닌가 | 전송 판단 |
|---|---|---:|---|---|---|---|---|
| 20260524...646467 | NPay | 39,000 | 있음 | 22018178848 | B | NPay 클릭 후 결제완료까지 약 12.5분. A급 자동 기준인 2분을 넘음 | 전송 금지. 내부 수동 검토 후보 |

이 row는 TJ님이 2026-05-24에 진행한 테스트일 가능성도 있다. 실제 광고 전송 후보로 쓰면 학습 오염 위험이 있으므로, 현재는 `수동 검토 후보`에만 둔다.

### 이 NPay B급 1건을 Google Ads 전송 후보로 올릴 수 없는 이유

이 주문은 실제 NPay 결제완료 주문이고 Google 광고 클릭 증거도 있다. 그래서 내부 분석에는 중요하다.  
하지만 Google Ads에 "이 광고 클릭이 만든 실제 구매"라고 보내기에는 아직 한 단계 부족하다.

사람 말로 풀면 이렇다.

- NPay 버튼을 누른 시각과 결제완료 시각 사이가 약 12.5분이다.
- 자동 A급 기준은 2분 이내다. 이 기준은 중간에 다른 상품 탐색, 새 창 이동, 다른 주문 흐름이 끼는 것을 막기 위한 안전장치다.
- 현재는 "거의 맞아 보이는 내부 bridge 후보"이지, Google Ads에 돈이 걸린 학습 신호로 보내도 되는 후보는 아니다.
- 특히 TJ님 테스트 주문일 가능성이 있어, 실제 광고 학습에 섞으면 Google Ads가 잘못 배울 수 있다.

따라서 화면에는 이 row를 `내부 수동 검토 후보`로 고정하고, `Google Ads 전송 후보 아님`을 함께 표시한다.

## 최종 판정

| 구분 | 건수 | 판정 |
|---|---:|---|
| 실제 결제완료 direct evidence 검토 후보 | 3건 | 내부 검토 가능 |
| 그중 카드 결제 | 3건 | 직접 보존 사례로 유지 |
| 그중 NPay 실제 결제완료 | 0건 | NPay는 bridge 보강 필요 |
| Google Ads 전송 후보 | 0건 | 전송 금지 유지 |
| 운영DB write | 0건 | 변경 없음 |
| VM Cloud write | 0건 | 변경 없음 |

## 다음으로 닫아야 할 것

1. 카드 direct evidence 3건은 raw click id를 저장하지 않는 방식으로 safe_ref 검토표를 만들 수 있다.
2. NPay는 `NPay 클릭 의도 - 내부 주문번호 - 실제 결제완료`를 영구 evidence로 쓰기 전 no-write 검토표를 계속 확장해야 한다.
3. Google Ads 전송은 `BI confirmed_purchase_offline` 같은 관찰용 전환 액션에 바로 보내지 말고, 먼저 `ready_but_not_sent` 후보가 안정적으로 쌓이는지 봐야 한다.

## Guardrails

```text
Google Ads conversion upload: NOT RUN
Google Ads conversion action change: NOT RUN
Google Ads primary/secondary change: NOT RUN
운영DB write: NOT RUN
VM Cloud SQLite write: NOT RUN
배포/restart: NOT RUN
raw order id in report: 0
raw click id in report: 0
```
