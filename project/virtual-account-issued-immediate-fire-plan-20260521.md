# VirtualAccountIssued 즉시 발화 설계안

작성 시각: 2026-05-21 19:26 KST
기준일: 2026-05-21
문서 성격: Meta 중간 전환 이벤트 설계안 / 운영 반영 전 승인안
Lane: Green 설계. 이 문서는 운영 코드 저장, GTM publish, Meta 전송, VM Cloud 배포를 하지 않는다.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - backend/src/routes/attribution.ts
    - gptconfirm/gpt0515-19-header-guard-v31-1-code/02-header-guard-v31-1-code.md
    - gdn/imweb-v443-full-paste-code-20260521.md
  lane: Green
  allowed_actions:
    - read-only code audit
    - design document
    - approval packet
  forbidden_actions:
    - Meta actual send
    - GTM publish
    - Imweb header/footer save
    - VM Cloud deploy/restart
    - operating_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: local repository code audit + VM Cloud read-only audit summary
    window: 2026-05-19 22:01 UTC to 2026-05-21 10:01 UTC for recent pending audit
    freshness: 2026-05-21 19:26 KST
    confidence: high for current code path, medium for Meta UI visibility
```

## 10초 요약

가상계좌 주문생성은 실제 입금 매출이 아니므로 Meta `Purchase`로 보내면 안 된다. 대신 `VirtualAccountIssued`라는 중간 전환 이벤트로 보내는 것은 맞다.

현재 Header Guard는 `payment-decision`이 `pending`을 반환하면 `VirtualAccountIssued`를 보낼 수 있다. 그러나 브라우저에서 먼저 `Purchase` 시도가 발생해야 이 분기가 실행된다. 즉 가상계좌 완료 화면에 도착했지만 브라우저 Purchase 시도가 없으면 `VirtualAccountIssued`도 안 나갈 수 있다.

따라서 다음 개선은 `Purchase` 시도에 기대지 않고, 완료 URL에서 가상계좌 발급 힌트가 보이면 `VirtualAccountIssued`를 1회 즉시 발화하는 것이다. 이 이벤트는 매출이 아니라 결제 의도 신호로만 쓴다.

## 현재 구조 판정

### 현재는 내부 confirmed를 기다리는가?

아니다. 현재 서버 판단은 아래처럼 분리되어 있다.

| 서버 판단 | 브라우저 행동 | 의미 |
|---|---|---|
| `confirmed` | `allow_purchase` | 실제 결제완료로 보고 Purchase 허용 |
| `pending` | `block_purchase_virtual_account` | Purchase는 막고 VirtualAccountIssued 발화 |
| `canceled` | `block_purchase` | Purchase 차단 |
| `unknown` | `hold_or_block_purchase` | Purchase 차단 또는 보류 |

즉 `VirtualAccountIssued`는 confirmed를 기다리는 구조는 아니다. 다만 현재는 서버가 `pending`이라고 응답해야 하고, 그 응답을 받는 흐름이 `Purchase` 시도 후에만 열린다.

### 현재 구조의 실제 병목

현재 흐름은 이렇다.

```text
완료 URL 도착
→ 브라우저 Pixel 또는 FBE가 Purchase를 시도해야 함
→ Header Guard가 Purchase를 가로챔
→ payment-decision 호출
→ 서버가 pending 반환
→ Purchase는 막고 VirtualAccountIssued 발화
```

문제는 첫 단계다. 가상계좌 미입금 주문에서 브라우저가 `Purchase`를 아예 시도하지 않으면 Header Guard가 개입할 기회가 없다. 이 경우 `VirtualAccountIssued`도 발화되지 않는다.

최근 read-only audit에서도 VM Cloud에는 `payment_success` pending row가 있었지만, `VirtualAccountIssued` 원장 row는 없었다. 현재 이 이벤트는 VM Cloud 원장에 별도로 저장되는 구조가 아니라 브라우저 Meta Pixel custom event에 의존한다.

## 설계 원칙

### 무엇을 보내는가

보낼 이벤트:

```text
Meta browser custom event: VirtualAccountIssued
```

뜻:

```text
고객이 가상계좌/무통장 계좌를 발급받을 만큼 결제 의도를 보였다.
아직 입금 매출은 아니다.
```

보내지 말아야 할 이벤트:

```text
Purchase
```

뜻:

```text
입금 확인 전 가상계좌 주문은 매출이 아니므로 Purchase 금지.
```

### 언제 보내는가

아래 조건을 모두 만족할 때만 보낸다.

1. 현재 URL이 완료 계열 URL이다.
   - `shop_payment_complete`
   - `shop_order_done`
   - `order_complete`
   - `payment_complete`
   - `payment_success`
2. 현재 URL이 단순 결제 입력 페이지가 아니다.
   - `/shop_payment/` 일반 결제 페이지에서는 보내지 않는다.
3. 페이지 또는 저장된 checkout context에서 가상계좌/무통장 힌트가 있다.
   - 페이지 텍스트에 `가상계좌`, `무통장`, `입금 계좌`, `입금기한`, `은행`, `계좌번호` 등이 있다.
   - 또는 checkout context의 결제수단이 `virtual_account` / `bank_transfer` 계열이다.
4. 같은 safe key로 이미 보낸 적이 없다.
   - `sessionStorage` dedupe로 새로고침 중복을 막는다.
5. 같은 결제건에 대해 `allow_purchase` 확정 캐시가 있으면 보내지 않는다.
   - 실제 결제완료가 확인된 경우에는 Purchase 경로가 우선이다.

### 무엇을 기준으로 중복을 막는가

raw order/payment/member id를 sessionStorage key나 eventID에 직접 넣지 않는다.

권장:

```text
eventID = VirtualAccountIssued.safe_<hash>
sessionStorage key = __biocom_vbank_issued_sent__:<safe_ref>
```

`safe_ref`는 주문/결제 식별자를 브라우저에서 직접 노출하지 않기 위한 안전 참조값이다.

## 구현 설계

### 권장 위치

가장 작은 변경은 아임웹 Header Guard v3.1.2에 넣는 것이다.

이유:

- 이미 `VirtualAccountIssued` 이름, Pixel ID, eventID, fallback 로직이 Header Guard 안에 있다.
- Footer/GTM/VM Cloud를 동시에 바꾸지 않아도 된다.
- Purchase 차단 정책과 같은 파일에서 관리되어 실수 가능성이 낮다.

건드리지 않는 대상:

- GTM Production publish
- Footer Block 1/2/3
- Block 4 fallback
- VM Cloud backend
- 운영DB

### 새 함수 역할

권장 함수:

```text
maybeFireVirtualAccountIssuedOnCompletion()
```

역할:

1. 완료 URL인지 확인한다.
2. 가상계좌 힌트가 있는지 확인한다.
3. confirmed Purchase allow cache가 있으면 중단한다.
4. dedupe key가 이미 있으면 중단한다.
5. `VirtualAccountIssued` custom event를 1회 보낸다.

### 발화 방식

1차:

```js
fbq('trackCustom', 'VirtualAccountIssued', customData, { eventID })
```

2차 fallback:

```text
1.5초 후 Network에 facebook.com/tr ev=VirtualAccountIssued + 같은 eventID가 없으면 image beacon fallback
```

이 방식은 기존 Header Guard의 custom event fallback 정책과 맞다.

### customData 권장값

Meta에는 매출처럼 보이는 값을 최소화한다.

권장:

```json
{
  "value": 0,
  "currency": "KRW",
  "payment_status": "pending",
  "payment_method": "virtual_account",
  "event_source": "header_guard",
  "event_trigger": "completion_page_virtual_account_hint",
  "is_purchase": "no",
  "is_paid": "no",
  "snippet_version": "2026-05-21-server-payment-decision-guard-v3-1-2"
}
```

주의:

- 실제 주문 금액은 Meta custom event value로 보내지 않는 편이 안전하다.
- 가상계좌 발급 금액을 분석하고 싶으면 VM Cloud 원장에 별도로 저장한다.
- Meta에서 이 custom event를 별도 전환으로 만들 때도 Purchase ROAS와 섞지 않는다.

## 현재 코드와 충돌 여부

### 기존 Purchase Guard와의 관계

기존 흐름은 유지한다.

- confirmed이면 Purchase 허용
- pending이면 Purchase 차단 후 VirtualAccountIssued
- unknown이면 PurchaseDecisionUnknown
- canceled이면 PurchaseBlocked

새 즉시 발화는 이 흐름을 대체하지 않는다. 브라우저 Purchase 시도가 없는 경우를 보완한다.

### 중복 방지

즉시 발화가 먼저 일어난 뒤 기존 Purchase Guard가 나중에 pending을 받으면, 같은 safe key에서는 두 번째 `VirtualAccountIssued`를 보내지 않아야 한다.

필수 조건:

```text
기존 trackCustom(CONFIG.vbankEventName, ...) 호출 전에도 vbank sent marker를 확인한다.
```

### Purchase 오발화 방지

`VirtualAccountIssued` 즉시 발화는 Purchase를 보내지 않는다.

검증 기준:

```text
가상계좌 미입금 완료 URL:
- ev=VirtualAccountIssued: 1
- ev=Purchase: 0
```

## 테스트 계획

### 로컬 fixture

아래 케이스를 JS fixture로 검증한다.

| 케이스 | 기대 |
|---|---|
| 완료 URL + 가상계좌 텍스트 있음 | VirtualAccountIssued 1 |
| 완료 URL + 무통장/입금 계좌 텍스트 있음 | VirtualAccountIssued 1 |
| `/shop_payment/` 일반 결제 페이지 | VirtualAccountIssued 0 |
| 완료 URL + 카드 결제완료 allow cache | VirtualAccountIssued 0, Purchase 경로 우선 |
| 완료 URL + unknown, 가상계좌 힌트 없음 | VirtualAccountIssued 0 |
| 같은 완료 URL 새로고침 | VirtualAccountIssued 중복 0 |

### 운영 Preview smoke

실제 운영 저장 전에는 Preview 또는 제한 테스트로 한 건만 확인한다.

확인 방법:

1. 가상계좌 주문생성 완료 URL에 도착한다.
2. 브라우저 Network에서 `facebook.com/tr` 필터를 건다.
3. `ev=VirtualAccountIssued` 요청이 1건인지 본다.
4. `ev=Purchase` 요청이 0건인지 본다.
5. Meta Pixel Helper에 보이지 않아도 Network가 더 강한 근거다.

## 승인안

### 승인 이름

```text
Imweb Header Guard v3.1.2 VirtualAccountIssued 즉시 발화 적용 승인
```

### 승인 후 허용할 일

- 아임웹 Header Guard의 기존 v3.1.1 script를 v3.1.2로 교체한다.
- 완료 URL에서 가상계좌 힌트 기반 `VirtualAccountIssued` 즉시 발화 로직을 추가한다.
- `Purchase`는 confirmed일 때만 유지한다.
- 가상계좌 미입금은 Purchase 0을 유지한다.

### 승인 후에도 금지할 일

- Meta Purchase 운영 수동 전송
- 가상계좌 미입금 Purchase 발화
- GTM Production publish
- Footer Block 수정
- VM Cloud deploy/restart
- 운영DB write/import
- raw order/payment/member/click id 출력

### 성공 기준

```text
가상계좌 미입금 테스트:
- facebook.com/tr ev=VirtualAccountIssued 1
- facebook.com/tr ev=Purchase 0
- 같은 safe key 새로고침 중복 0

카드 결제완료:
- Purchase 기존 흐름 유지
- VirtualAccountIssued 0

/shop_payment/ 결제 입력 페이지:
- VirtualAccountIssued 0
- Purchase 0
```

## 결론

`VirtualAccountIssued`는 내부 confirmed를 기다릴 필요가 없다. 오히려 confirmed 전에 보내야 의미가 있다.

다만 현재 구현은 브라우저 Purchase 시도에 묶여 있어, 미입금 가상계좌 완료 화면에서 아무 이벤트도 안 나갈 수 있다. 따라서 완료 URL + 가상계좌 힌트 기준으로 `VirtualAccountIssued`를 즉시 1회 보내는 v3.1.2 Header Guard 패치가 다음 단계다.

이 작업은 매출 보고를 바꾸는 작업이 아니다. 구매 직전의 강한 의도 신호를 Meta에 알려주는 작업이다.
