# Google Ads 기존 구매완료 분리 확정안 - 2026-05-26

작성 시각: 2026-05-26 17:10 KST  
문서 성격: Green Lane 실행안 확정 / Google Ads 설정 변경은 Red Lane으로 실행 보류

```yaml
harness_preflight:
  common_harness_read:
    - "harness/common/HARNESS_GUIDELINES.md"
    - "harness/common/AUTONOMY_POLICY.md"
    - "harness/common/REPORTING_TEMPLATE.md"
  project_harness_read:
    - "AGENTS.md"
    - "harness/npay-recovery/README.md"
    - "harness/npay-recovery/RULES.md"
    - "project/google-ads-npay-button-click-smoke-result-20260526.md"
    - "project/google-ads-confirmed-only-nosend-builder-20260526.md"
  lane: "Green for plan, Red for actual Google Ads setting mutation/send"
  allowed_actions:
    - "Google Ads API read-only interpretation"
    - "VM Cloud public API read-only"
    - "local markdown report write"
    - "no-send/no-write candidate classification"
  forbidden_actions:
    - "Google Ads conversion action mutation"
    - "Google Ads Primary/Secondary change"
    - "Google Ads conversion upload"
    - "GTM publish"
    - "VM Cloud SQLite write"
    - "operational DB write"
  source_window_freshness_confidence:
    source:
      - "Google Ads API via dashboard-summary"
      - "VM Cloud public google-ads dashboard-summary"
      - "VM Cloud public click-id-health/orders"
      - "TJ Chrome Network smoke capture"
    window:
      - "today: 2026-05-26 KST"
      - "last_7d: 2026-05-19 ~ 2026-05-25 KST"
      - "button smoke: 2026-05-26 00:53~00:54 KST"
    freshness: "2026-05-26 17:03~17:10 KST"
    confidence: "high for existing purchase contamination, medium-high for no-send candidate counts"
```

## 한 줄 결론

기존 Google Ads `구매완료`는 실제 결제완료가 아니라 NPay 버튼/진입 신호가 섞인 구매 신호로 확정 분리한다. 실제 구매만 Google Ads에 알려주는 통로는 `BI confirmed_purchase_offline`을 no-send로 계속 준비한다.

## TJ님 질문에 대한 답

Meta처럼 하면 되는가?

방향은 맞다. Meta는 VM 원장과 실제 결제완료 증거를 붙여서 구매 신호를 더 좁게 쓰는 방향이 맞고, Google Ads도 같은 철학으로 가야 한다.

다만 그대로 복사할 수는 없다. Google Ads는 실제 결제완료 주문을 보낼 때 Google 클릭 식별자인 `gclid`, `gbraid`, `wbraid` 중 하나가 필요하다. 그래서 Google Ads는 아래 두 조건을 같이 만족해야 한다.

1. 실제 결제완료 주문이어야 한다.
2. 그 주문에 Google 클릭 증거가 안전하게 붙어야 한다.

현재 1번은 대부분 준비됐다. 2번이 아직 약하다.

## 현재 Google Ads가 구매로 세는 값

source: VM Cloud public Google Ads API wrapper  
freshness: 2026-05-26 17:03 KST  
confidence: high

| 구간 | Google Ads 주장 구매 | Google Ads 주장 전환값 | 내부 confirmed 주문 | 내부 confirmed 매출 | 해석 |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-05-26 today | 18건 | 4,847,000원 | 0건 | 0원 | 오늘 Google은 구매가 있다고 보지만 내부 실제 결제완료는 아직 없다. |
| 최근 7일 | 211.84건 | 39,293,009원 | 4건 | 755,900원 | Google 주장 구매값과 내부 실제 구매값의 차이가 크다. |

사람 말로 보면, Google Ads가 지금 배우는 구매 신호는 실제 결제완료보다 훨씬 넓다.

## 기존 `구매완료`의 정체

Google Ads API에서 확인한 기존 전환 액션:

| 항목 | 값 |
| --- | --- |
| 이름 | 구매완료 |
| ID | 7130249515 |
| 타입 | WEBPAGE |
| 카테고리 | PURCHASE |
| 상태 | ENABLED |
| 입찰 학습 사용 | Primary |
| send_to | AW-304339096/r0vuCKvy-8caEJixj5EB |
| counting | MANY_PER_CLICK |

2026-05-26 00:53~00:54 KST NPay 버튼 클릭 smoke에서 실제 결제 없이 이 라벨 요청이 발생했다. 따라서 이 전환은 실제 결제완료 전용이 아니다.

## 확정 실행안

### Phase 1. 즉시 해석 분리

실행 상태: 완료 또는 유지  
Google Ads 설정 변경: 없음

기존 `구매완료`는 보고서와 의사결정에서 `Google Ads 주장 구매`, 더 정확히는 `NPay 버튼/진입이 섞인 구매 신호`로 본다.

예산 판단에는 이 값을 직접 쓰지 않는다. 예산 판단은 `내부 confirmed ROAS`, 즉 실제 결제완료 주문 원장 기준값을 우선한다.

### Phase 2. Google Ads 화면 설정 변경안

실행 상태: TJ님 Red 승인 전 대기  
권장 변경: 기존 `구매완료`를 실제 구매에서 분리

Google Ads 화면에서 바꿀 대상:

1. `목표 > 전환 > 요약`
2. `구매` 목표 안의 `구매완료`
3. `send_to=AW-304339096/r0vuCKvy-8caEJixj5EB`인지 확인
4. 이 전환을 `Primary`에서 `Secondary`로 낮춘다.

Secondary는 입찰 학습에는 쓰지 않고 관찰만 하는 보조 신호다. 이렇게 하면 NPay 버튼/진입이 실제 구매처럼 입찰 학습되는 문제를 줄일 수 있다.

단, 이 변경은 광고 자동입찰 학습에 영향을 준다. 그래서 바로 실행하지 않고 Red 승인으로 분리한다.

### Phase 3. 실제 결제완료 전용 통로 유지

Google Ads API에서 보이는 실제 결제완료 전용 후보:

| 항목 | 값 |
| --- | --- |
| 이름 | BI confirmed_purchase_offline |
| ID | 7609289411 |
| 타입 | UPLOAD_CLICKS |
| 카테고리 | PURCHASE |
| 상태 | ENABLED |
| 현재 최적화 | Secondary |

이 액션은 실제 결제완료 주문만 Google Ads에 알려주는 통로로 적합하다. 현재는 no-send로 유지한다.

향후 전송 조건:

1. 실제 결제완료 주문이다.
2. 금액이 내부 주문 금액과 맞다.
3. 취소/환불/미입금이 아니다.
4. `gclid`, `gbraid`, `wbraid` 중 하나만 선택된다.
5. 중복 전송 방지 key가 있다.
6. 안전한 safe_ref snapshot이 있다.
7. Google Ads upload Red 승인이 있다.

## 실제 결제완료 no-send 주문 단위 재분해

source: `/api/google-ads/click-id-health/orders?window=last_7d&only=with_click_id&limit=20`  
freshness: 2026-05-26 17:04 KST  
confidence: high for returned direct evidence rows

| 항목 | 값 |
| --- | ---: |
| 주문 단위 진단 기준 실제 결제완료 | 424건 |
| Google click id 직접 증거가 있는 주문 | 3건 |
| Google Ads upload 후보 | 0건 |
| Google Ads send 후보 | 0건 |

direct evidence 3건의 공통점:

- 모두 실제 결제완료다.
- 모두 카드 결제다.
- 모두 `payment_success_ledger`에 Google click id가 직접 남아 있다.
- NPay 결제완료 건은 아니다.
- 취소/반품 플래그는 없다.
- 전송 후보는 아니다.

차단 이유:

1. 현재 단계가 read-only/no-send다.
2. Google Ads upload 승인 없음.
3. dispatcher 닫힘.
4. 중복 방지와 취소/환불 후속 반영 장부가 아직 전송용으로 열리지 않음.

## 왜 NPay bridge 후보는 아직 Google Ads 전송 후보가 아닌가

today 기준 NPay 실제 결제완료는 1건이고, 내부 bridge 후보도 1건이다. 하지만 Google click id가 붙은 bridge 후보는 0건이다.

최근 7일 기준으로는 NPay 실제 결제완료 20건 중 내부 bridge strong 후보가 16건이다. 이 중 Google click id가 붙은 후보는 1건이지만 B급이다. B급은 내부 분석 후보이지 Google Ads 전송 후보가 아니다.

사람 말로 풀면, NPay 실제 구매는 매출로 포함해야 한다. 하지만 NPay 버튼을 누른 사람과 실제 결제완료 주문을 Google 클릭 증거까지 붙여 확정하는 단계가 아직 부족하다.

## 최종 권장

1. 기존 Google Ads `구매완료`는 실제 구매로 보지 않는다.
2. 기존 `구매완료`는 Red 승인 후 Secondary로 낮추는 것이 정석이다.
3. 실제 결제완료 전용 Google 통로는 `BI confirmed_purchase_offline`으로 준비한다.
4. 단, 지금은 전송하지 않는다. no-send 후보가 안정적으로 쌓인 뒤 제한 전송을 검토한다.

## Guardrails

```text
Google Ads conversion upload: NOT RUN
Google Ads conversion action change: NOT RUN
Google Ads Primary/Secondary change: NOT RUN
VM Cloud SQLite write: NOT RUN
operational DB write: NOT RUN
GTM publish: NOT RUN
```
