작성 시각: 2026-05-21 23:40 KST
기준일: 2026-05-21
문서 성격: 중간 전환 Meta CAPI 확장 no-send dry-run 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - capivm/!capiplan.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - VM Cloud aggregate API read-only
    - Meta CAPI send log aggregate read-only
    - no-send payload preview
    - document update
  forbidden_actions:
    - Meta CAPI actual send
    - Meta Test Events smoke
    - VM Cloud deploy/restart
    - GTM publish
    - Imweb header/footer edit
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source:
      - TJ provided Meta Events Manager screenshot
      - VM Cloud funnel-health API
      - VM Cloud meta-capi-sends.jsonl aggregate
      - backend route/code read
    window:
      meta_ui: "2026-05-13~2026-05-19"
      vm_cloud: "rolling 7d at 2026-05-21 23:35 KST"
      capi_log: "rolling 24h / 7d at 2026-05-21 23:37 KST"
    freshness: "2026-05-21 23:40 KST"
    confidence: "medium_high"
```

## 10초 요약

Meta 화면에는 이미 브라우저 픽셀 기준으로 `PageView`, `ViewContent`, `InitiateCheckout`, `AddToCart`, `Purchase`, `CompleteRegistration`, `AddPaymentInfo`가 보인다.
VM Cloud 서버 CAPI 운영 전송은 최근 7일 기준 `Purchase`만 369건 성공이다.
중간 전환 CAPI는 `AddToCart`와 `InitiateCheckout`이 no-send 후보로는 보이지만, 현재 원장 정의와 Meta UI 숫자가 달라 바로 켜면 과전송 위험이 있다.
따라서 다음 단계는 실제 전송이 아니라 `event별 1건 이하 Test Events smoke`와 `source narrowing`이다.

## 이번 dry-run이 한 일

구매 전 행동을 Meta에 서버 신호로 확장할 수 있는지 보되, 실제로 Meta에는 아무것도 보내지 않았다.
아래 세 가지를 나눠 봤다.

1. Meta UI에 이미 보이는 이벤트.
2. VM Cloud 서버 CAPI가 실제로 보내고 있는 이벤트.
3. VM Cloud 원장에서 no-send 후보로 만들 수 있는 이벤트.

## Meta 표준 이벤트 / 비표준 이벤트 구분

Meta Conversions API의 server event parameter 문서는 `event_name`이 표준 이벤트 또는 custom event 이름이 될 수 있고, 브라우저 이벤트와 서버 이벤트 중복 제거에는 `event_name`과 `event_id`가 같이 쓰인다고 설명한다.
따라서 아래 표는 `Meta가 기본적으로 알고 있는 표준 행동명인지`, 아니면 `우리가 따로 의미를 정해야 하는 custom 행동명인지`를 나눈 것이다.

| 이벤트 | Meta 기준 | 현재 관측 | 판단 |
|---|---|---|---|
| `PageView` | 표준 이벤트 | Meta UI 브라우저 8.3만 | 이미 브라우저에서 충분히 큼. 서버 CAPI 확장 우선순위 낮음 |
| `ViewContent` | 표준 이벤트 | Meta UI 브라우저 1.4만 | 이미 브라우저에서 큼. 중복·민감 콘텐츠 필드 위험 때문에 보류 |
| `AddToCart` | 표준 이벤트 | Meta UI 299 / VM 후보 55 | 후보. 단 VM 후보는 장바구니 페이지 진입 기준이라 클릭 기준과 다름 |
| `InitiateCheckout` | 표준 이벤트 | Meta UI 439 / VM 후보 4,194 | 후보. 단 VM 후보가 넓어서 바로 전송하면 과전송 위험 |
| `AddPaymentInfo` | 표준 이벤트 | Meta UI 26 / VM 후보 0 | Meta에는 보이나 VM source가 비어 있음. source gap |
| `Purchase` | 표준 이벤트 | Meta UI 128 / CAPI 7d 369 성공 | 이미 서버 CAPI 운영 중. confirmed Purchase만 유지 |
| `CompleteRegistration` | 표준 이벤트 | Meta UI 34, 최근 활동 없음 / VM 후보 0 | 표준이지만 현재 source/route 미정착 |
| `Lead` | 표준 이벤트 | 현재 화면에는 없음 | 쿠폰/회원가입을 Lead로 매핑할 수 있지만 별도 설계 필요 |
| `Search` | 표준 이벤트 | 현재 화면에는 없음 | 검색 행동이 안정적으로 잡힐 때만 후보 |
| `VirtualAccountIssued` | 비표준 custom event | 다른 작업 창에서 진행 중 | 구매가 아니라 가상계좌 발급/미입금 의도 신호 |
| `Scroll50`, `page_view_long` | 비표준 custom event | GA4/선행지표 쪽 후보 | Meta CAPI로 바로 보내기보다 선행지표 검증 먼저 |
| `coupon_receive` | 비표준 또는 `Lead` 매핑 후보 | 별도 후보 | 쿠폰이 리드 행동이면 `Lead`, 단순 클릭이면 custom 보류 |
| `payment_page_seen`, `checkout_started` | 내부 semantic touchpoint | VM Cloud 내부 원장 | Meta event_name으로 그대로 보내면 안 됨. 표준 이벤트로 매핑 필요 |

## 이미 발송·수신 중인 이벤트

### Meta UI 기준

TJ님이 제공한 Events Manager 화면 기준이다.

| 이벤트 | 총 이벤트 | 최근 수신 | 주된 성격 |
|---|---:|---|---|
| PageView | 8.3만 | 최근 4시간 전 | 브라우저 픽셀 |
| ViewContent | 1.4만 | 최근 6시간 전 | 브라우저 픽셀 |
| InitiateCheckout | 439 | 최근 5시간 전 | 브라우저 픽셀 또는 복수 통합 |
| AddToCart | 299 | 최근 4시간 전 | 브라우저 픽셀 또는 복수 통합 |
| Purchase | 128 | 최근 4시간 전 | 서버 CAPI 포함 가능성이 큼 |
| CompleteRegistration | 34 | 최근 활동 없음 | 브라우저 픽셀 과거 수신 |
| AddPaymentInfo | 26 | 최근 5시간 전 | 브라우저 픽셀 |

주의: Meta UI의 `여러 개` 표시는 복수 통합 가능성을 말하지만, 이 화면만으로 브라우저/서버 비율은 확정할 수 없다.

### VM Cloud CAPI send log 기준

| window | event_name | success | failed | events_received |
|---|---|---:|---:|---:|
| 24h | Purchase | 45 | 0 | 45 |
| 7d | Purchase | 369 | 0 | 369 |

현재 운영 server CAPI는 `Purchase` 중심이다.
중간 전환 event_name은 최근 7일 CAPI send log에서 보이지 않았다.

## VM Cloud no-send 후보 결과

실행:

```bash
WINDOW=7d OUT_DIR=data/project RUN_LABEL=20260521-mid-capi-dry-run bash scripts/meta-intermediate-capi-phase2-sprint5-preview.sh
```

출력:

```text
data/project/meta-intermediate-capi-phase2-sprint5-preview-20260521-mid-capi-dry-run.json
```

요약:

| 후보 이벤트 | VM Cloud 후보 수 | dry-run 상태 | 바로 켜면 안 되는 이유 |
|---|---:|---|---|
| AddToCart | 55 | preview_ready_no_send | VM 후보는 `/shop_cart` 페이지 진입 기준이다. Meta UI의 AddToCart 299와 기준이 다르다 |
| InitiateCheckout | 4,194 | preview_ready_no_send | VM 후보가 checkout/payment page_seen까지 포함해 Meta UI 439보다 훨씬 넓다 |
| AddPaymentInfo | 0 | source_gap_no_send | Meta UI에는 26건이 보이나 VM source가 아직 없음 |
| CompleteRegistration | 0 | backend_route_not_ready | VM source/route allowlist가 준비되지 않음 |
| Scroll50 | 0 | backend_route_not_ready | Meta 표준 이벤트가 아니며 custom event 정책 검토 필요 |

## 해석

`AddToCart`와 `InitiateCheckout`은 서버 CAPI 후보로 볼 수 있다.
하지만 지금 숫자 그대로 운영 전송하면 안 된다.

특히 `InitiateCheckout`은 Meta UI 439건인데 VM 후보는 4,194건이다.
이 차이는 VM Cloud 후보가 `checkout_started`, `payment_page_seen` 같은 넓은 내부 신호를 포함하기 때문이다.
따라서 이 단계는 `결제 시작으로 볼 수 있는 좁은 조건`을 다시 정해야 한다.

`AddPaymentInfo`는 반대로 Meta UI에는 26건이 있지만 VM 후보는 0이다.
즉 브라우저 픽셀은 결제수단 정보를 일부 잡지만, VM Cloud 원장은 아직 그 신호를 받지 못한다.
서버 CAPI로 보내려면 먼저 VM에 결제수단 선택 source를 남겨야 한다.

## 추천 우선순위

1. `InitiateCheckout` source narrowing
   - 무엇: VM의 넓은 4,194건 중 진짜 Meta `InitiateCheckout`으로 볼 수 있는 조건을 좁힌다.
   - 왜: 그대로 보내면 Meta UI 기존 439건보다 크게 부풀어 학습 신호가 오염될 수 있다.
   - 기준: `/shop_payment/` 진입 + checkout id + 1 session 1회 dedupe.

2. `AddToCart` 기준 확정
   - 무엇: 장바구니 클릭을 볼지, `/shop_cart` 페이지 진입을 볼지 결정한다.
   - 왜: VM 후보 55건과 Meta UI 299건이 다른 이유가 여기에 있다.
   - 기준: 아임웹/GTM을 안 건드릴 경우 `/shop_cart` 페이지 진입으로 시작한다.

3. `AddPaymentInfo` source 보강
   - 무엇: 결제수단 선택이 VM Cloud에 남게 한다.
   - 왜: Meta UI에는 26건이 보이지만 서버 CAPI 후보가 0이다.
   - 기준: payment method selected signal이 raw payment id 없이 기록되어야 한다.

4. `CompleteRegistration`, `Lead`, `Scroll50/page_view_long`
   - 무엇: 표준/비표준 이벤트를 나눠 별도 source 설계를 한다.
   - 왜: 구매 전 선행지표로는 의미가 있지만 Purchase/ROAS와 섞이면 안 된다.
   - 기준: 먼저 GA4/VM source가 안정적인지 확인한다.

## 다음 승인 전 금지선

- 운영 Meta CAPI 중간 이벤트 실제 전송 금지.
- `Purchase` 이벤트로 중간 행동을 대체 금지.
- `payment_page_seen` 같은 내부 touchpoint를 Meta event_name으로 그대로 전송 금지.
- 민감한 건강 관련 `content_name`, `product_name`, raw URL query 전송 금지.
- raw order/payment/member/click/email/phone 출력 금지.

## 결론

중간 전환 CAPI 확장은 가능성이 있다.
하지만 지금은 `server CAPI를 켜자`가 아니라 `AddToCart/InitiateCheckout을 좁은 기준으로 1건 이하 Test Events smoke 하자`가 맞다.
운영 학습에 바로 넣기에는 `InitiateCheckout` 후보 수가 너무 넓고, `AddPaymentInfo`는 VM source가 아직 비어 있다.
