# Google Ads TechSol OFF와 Meta NPay 실제 구매 기준 재사용 검토 - 2026-05-26

작성 시각: 2026-05-26 18:18 KST  
기준일: 2026-05-26  
문서 성격: Green Lane 검토 보고 / Google Ads 설정 변경 실행은 Red Lane

```yaml
harness_preflight:
  common_harness_read:
    - "harness/common/HARNESS_GUIDELINES.md"
    - "harness/common/AUTONOMY_POLICY.md"
    - "harness/common/REPORTING_TEMPLATE.md"
  project_harness_read:
    - "AGENTS.md"
    - "docurule.md"
    - "GA4/npay_return_missing_20260421.md"
    - "GA4/gtm-biocom.md"
    - "project/google-ads-npay-secondary-dual-fire-smoke-20260526.md"
    - "project/google-ads-existing-purchase-separation-final-plan-20260526.md"
  lane: "Green for review/documentation; Red for Google Ads action OFF, GTM publish, or Google Ads upload"
  allowed_actions:
    - "read-only local code/doc inspection"
    - "decision document write"
    - "no-send/no-write architecture recommendation"
  forbidden_actions:
    - "Google Ads conversion action mutation"
    - "Google Ads conversion upload"
    - "GTM publish"
    - "Meta CAPI send"
    - "VM Cloud SQLite write"
    - "operational DB write"
  source_window_freshness_confidence:
    source:
      - "local GTM/GA4 docs"
      - "TJ Chrome Network smoke capture"
      - "backend/src/metaCapi.ts"
      - "backend Google Ads scripts"
    window: "2026-04-21 NPay return observation through 2026-05-26 button-click smoke"
    freshness: "reviewed 2026-05-26 18:18 KST"
    confidence: "high for TechSol role; high for Meta eligibility reuse concept; medium for final Google Ads upload route until validate-only mutation/upload dry-run"
```

## 10초 요약

`TechSol - NPAY구매 50739`는 실제 네이버페이 결제완료가 아니라 NPay 버튼 클릭/결제 진입 신호다. 2026-05-26 smoke에서 같은 클릭 1회로 `TechSol`과 `NPay 버튼 클릭/결제진입(보조)`가 같이 나갔으므로 TechSol은 끄는 것이 맞다.

Meta에서 쓰는 “실제 결제완료 주문만 구매로 본다”는 기준은 Google Ads에도 재사용해야 한다. 다만 Meta 이벤트를 그대로 Google Ads에 복사할 수는 없다. Google Ads는 실제 결제완료 주문에 `gclid`, `gbraid`, `wbraid` 같은 Google 클릭 증거가 붙어야 안전하게 전송할 수 있다.

## 결론

### 1. TechSol은 끄는 방향이 맞다

`TechSol - NPAY구매 50739`는 이름은 구매지만 실제로는 NPay 버튼 클릭 신호다.

근거:

- `GA4/npay_return_missing_20260421.md`: GTM 태그 `[248] TechSol - [GAds]NPAY구매 51163`은 NPay 버튼 클릭 시점에 발화된 것으로 기록돼 있다.
- `project/google-ads-npay-secondary-dual-fire-smoke-20260526.md`: 2026-05-26 smoke에서 NPay 버튼 클릭 1회로 아래 두 요청이 같이 나갔다.
  - `TechSol - NPAY구매 50739`: 8,900원
  - `NPay 버튼 클릭/결제진입(보조)`: 11,900원

따라서 TechSol은 실제 구매완료 신호가 아니다. 둘 중 하나만 관찰용으로 남긴다면 배송비 포함 금액을 보내는 `NPay 버튼 클릭/결제진입(보조)`가 더 낫다.

### 2. Meta 기준은 재사용하되, Meta 이벤트를 그대로 Google에 복사하지는 않는다

Meta CAPI는 서버에서 실제 결제완료 원장을 읽고 아래 조건을 통과한 주문만 구매로 보낸다.

- `payment_success`
- `live`
- `confirmed`
- 금액이 0보다 큼
- 취소/환불 플래그 없음
- value guard 통과
- 중복 전송 방지

이 기준은 Google Ads에도 그대로 써야 한다. 사람 말로 풀면, “Meta가 구매로 인정한 실제 주문 후보 표를 Google Ads 구매 후보 표의 출발점으로도 쓰자”는 뜻이다.

하지만 Google Ads는 추가 조건이 있다.

- 실제 결제완료 주문이어야 한다.
- Google 클릭 증거인 `gclid`, `gbraid`, `wbraid` 중 하나가 있어야 한다.
- 같은 주문을 두 번 보내지 않도록 order id 또는 event key가 있어야 한다.
- 실제 Google Ads 전송은 별도 승인 후에만 해야 한다.

## `BI confirmed_purchase_offline`을 버리면 안 되는 이유

`BI confirmed_purchase_offline`은 브라우저에서 자동으로 발화되는 태그가 아니다. Google Ads에 실제 결제완료 주문을 서버에서 올릴 때 쓰는 목적지다.

즉 역할이 다르다.

- Meta CAPI 구매 이벤트: Meta에 실제 구매를 알려주는 서버 전송 경로
- `BI confirmed_purchase_offline`: Google Ads에 실제 구매를 알려줄 서버 전송 목적지

정답은 `BI confirmed_purchase_offline`을 버리는 것이 아니다. Meta와 같은 실제 구매 판별 기준을 사용해서 `BI confirmed_purchase_offline`으로 보낼 후보를 만드는 것이다.

## 실행안

### Step 1. TechSol 끄기

권장 실행:

1. Google Ads에서 `TechSol - NPAY구매 50739` 전환 액션을 끈다.
2. 또는 다음 GTM 정리 때 태그 `[248] TechSol - [GAds]NPAY구매 51163`를 pause/publish한다.

즉시 추천은 Google Ads 전환 액션 끄기다. GTM publish 없이도 보고서와 전환 집계에서 빠르게 분리할 수 있기 때문이다.

GTM 태그까지 끄는 것은 더 깨끗하지만, 사이트 전체 태그 publish가 필요하므로 별도 Red Lane으로 다룬다.

### Step 2. 실제 구매 후보 기준 공유

Meta CAPI가 쓰는 실제 구매 후보 조건을 공통 함수로 빼거나, Google Ads no-send 후보 생성기가 같은 조건을 참조하도록 만든다.

공통 구매 후보의 쉬운 기준:

1. 돈이 실제로 결제 완료됐다.
2. 취소/환불/미입금이 아니다.
3. 금액이 내부 주문 금액과 맞다.
4. 같은 주문을 이미 보낸 적이 없다.

Google Ads 전용 추가 기준:

1. Google 클릭 증거가 있다.
2. Google Ads 전송 목적지와 연결되어 있다.
3. no-send 검토표에서 `ready_but_not_sent`로 분류된다.

### Step 3. Google Ads actual purchase는 no-send로 계속 준비

실제 전송 전까지는 Google Ads에 아무것도 보내지 않는다.

먼저 해야 할 것은 아래 표를 계속 채우는 것이다.

- 실제 결제완료 주문 수
- Google 클릭 증거가 붙은 주문 수
- Google Ads에 보낼 수 있는 후보 수
- 보낼 수 없는 이유

## 하지 않은 것

- Google Ads 전환 액션 끄기 실행 0
- Google Ads 전환 upload 0
- Meta CAPI 신규 전송 0
- GTM publish 0
- VM Cloud SQLite write 0
- 운영DB write 0

## 현재 판정

TechSol OFF는 실행해도 되는 방향이다. 다만 실제 끄기 버튼을 누르는 작업은 Google Ads 설정 변경이므로 Red Lane이다. TJ님이 UI에서 직접 끄거나, Codex가 API validate-only를 먼저 통과시킨 뒤 별도 적용 명령으로 끄는 방식이 안전하다.

Meta NPay 실제 구매 기준은 Google Ads에도 재사용해야 한다. 단, Google Ads 전송 후보로 올리려면 Meta 기준 통과에 더해 Google 클릭 증거가 필요하다.
