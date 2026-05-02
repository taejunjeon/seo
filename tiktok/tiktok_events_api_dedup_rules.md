# TikTok Events API Dedup Rules

작성 시각: 2026-05-03 KST
Lane: Green Lane documentation only
적용 대상: 바이오컴 TikTok Pixel `D5G8FTBC77UAODHQ0KOG`와 향후 TikTok Events API 검토

## 1. Short Answer

TikTok Events API production send는 현재 금지한다.

도입하려면 서버 이벤트가 browser Pixel과 같은 conversion을 뜻할 때 아래 세 가지를 맞춰야 한다.

1. 같은 TikTok Pixel/Event Source
2. 같은 event name
3. 같은 final `event_id`

바이오컴에서 가장 중요한 차이:
- TJ 관리 Attribution VM 로그: raw `eventId=o2026...`
- TikTok Pixel Helper 최종값: `event_id=Purchase_o2026...`

서버 dedup에는 raw `o...`가 아니라 Pixel Helper 최종값과 같은 `Purchase_o...`가 필요하다.

## 2. Official Rules

공식 문서:
- [TikTok Help - Event Deduplication](https://ads.tiktok.com/help/article/event-deduplication)
- [TikTok Help - Events API](https://ads.tiktok.com/help/article/events-api?lang=en)
- [TikTok Help - Standard Events](https://ads.tiktok.com/help/article/standard-events-parameters)

공식 기준 요약:
- Pixel과 Events API가 같은 conversion을 중복 보고하면 dedup이 필요하다.
- dedup을 위해 `event_id`를 Pixel과 Events API 양쪽에 공유해야 한다.
- Pixel-only 또는 Events API-only 중복은 동일 `event`와 `event_id`가 첫 이벤트로부터 48시간 내 들어오면 dedup 대상이다.
- Pixel과 Events API 간 overlap은 동일 `event`와 `event_id`가 첫 이벤트 후 5분 이후부터 48시간 내 들어오면 merge/dedup 대상이다.
- 서로 다른 event를 별도로 보낼 때는 dedup 대상이 아니다. 예: Pixel `AddToCart`, Events API `Purchase`.

## 3. 바이오컴 Current Event ID Canonicalization

### 3.1 Raw Order Code

형식:

```text
oYYYYMMDDxxxxxxxxxxxxx
```

예:

```text
o20260502c0c1ce5d28e95
```

위 값은 `order_code`이자 Guard가 intercept 시점에 보는 raw `eventId`다.

### 3.2 Browser Final Event ID

Imweb/TikTok wrapper 규칙:

```text
final_event_id = event_name + "_" + raw_event_id
```

예:

```text
Purchase_o20260502c0c1ce5d28e95
InitiateCheckout_o20260416f90b328b2394b
```

pending 가상계좌 대체 이벤트는 Guard가 이미 `PlaceAnOrder_` prefix를 붙인 params를 `TIKTOK_PIXEL.track('PlaceAnOrder')`로 다시 보내므로 최종 helper 값이 double prefix로 관측됐다.

```text
PlaceAnOrder_PlaceAnOrder_o20260424e1f05530c933d
```

### 3.3 Server Dedup Event ID Builder

production send 전 canonical builder는 아래처럼 명시되어야 한다.

```ts
function buildTiktokServerEventId(eventName: string, orderCode: string): string {
  return `${eventName}_${orderCode}`;
}
```

Purchase 기준:

```text
event = Purchase
event_id = Purchase_o20260502c0c1ce5d28e95
```

금지:

```text
event = Purchase
event_id = o20260502c0c1ce5d28e95
```

이 금지 예시는 VM raw event_id와 같지만 browser final event_id와 다르므로 dedup 실패 가능성이 높다.

## 4. Event by Event Dedup 판단

| 이벤트 | Browser final event_id | Server event_id 후보 | Dedup 판단 | Production 판단 |
| --- | --- | --- | --- | --- |
| `Purchase` | `Purchase_{order_code}` | `Purchase_{order_code}` | 가능 | Red Lane 승인 전 금지 |
| `CompletePayment` | 현재 운영은 `Purchase_{order_code}`로 관측 | 신규 server는 `Purchase_{order_code}` | legacy 호환 확인 필요 | 신규 production에는 쓰지 않음 |
| `PlaceAnOrder` | `PlaceAnOrder_PlaceAnOrder_{order_code}` 관측 | 동일하게 맞출 수는 있음 | 기술적으로 가능하나 불필요 | production send 제외 |
| `InitiateCheckout` | `InitiateCheckout_{order_code}` 과거 관측 | `InitiateCheckout_{order_code}` | 발화 안정성 확인 후 가능 | 아직 금지 |
| `AddPaymentInfo` | 미관측 | 없음 | 불가 | 금지 |

## 5. Matching Inputs

서버 이벤트를 만들려면 최소한 아래가 필요하다.

필수:
- `event_name`
- canonical `event_id`
- `order_code`
- event timestamp
- pixel/event source code: `D5G8FTBC77UAODHQ0KOG`
- `value`
- `currency`
- page URL/referrer 또는 event source context
- TikTok evidence: `ttclid`, TikTok UTM, TikTok referrer, 또는 VM firstTouch/marketing_intent 연결

권장:
- `_ttp`
- user agent
- IP address는 privacy/consent/보관 정책 검토 후
- hashed match key는 별도 승인 전에는 보류

금지:
- raw email/phone/name/address
- 주문 메모/배송 상세주소/민감정보
- TikTok evidence 없는 confirmed order
- pending/canceled/overdue order

## 6. Dedup Hard Fail Checks

아래 중 하나라도 해당하면 send_candidate는 false다.

| check | fail condition | block_reason |
| --- | --- | --- |
| 결제 상태 | `confirmed`가 아님 | `not_confirmed` |
| 가상계좌 | pending virtual account | `pending_virtual_account` |
| 취소/기한초과 | canceled, overdue, payment_overdue | `canceled_or_overdue` |
| TikTok evidence | ttclid/UTM/referrer/firstTouch 연결 없음 | `no_tiktok_evidence` |
| event_id | final browser event_id 재현 불가 | `missing_browser_event_id` |
| event name | browser event와 server event 불일치 | `event_name_mismatch` |
| pixel | pixel code 불일치 | `pixel_code_mismatch` |
| PII | payload에 raw PII 포함 | `pii_detected` |
| test code | production env에 `test_event_code` 존재 | `test_event_code_present_in_production_env` |
| duplicate | 같은 event/event_id 후보가 이미 shadow ledger에 있음 | `duplicate_shadow_candidate` |

## 7. Timing Rules

browser Pixel이 먼저 들어가는 현재 구조:
- browser `Purchase`가 결제완료 페이지에서 먼저 발화된다.
- server Events API가 나중에 같은 `Purchase`를 보내면 TikTok dedup/merge 대상이 될 수 있다.
- 공식 문서상 Pixel+Events API overlap은 첫 이벤트 후 5분 이후부터 48시간 window 조건이 있으므로, 즉시 server send가 어떤 방식으로 처리되는지는 Test Events/Diagnostics에서 확인해야 한다.

운영 해석:
- 결제 직후 server send를 붙이는 설계는 dedup timing 진단 전까지 금지한다.
- “입금 확정이 늦게 발생하는 가상계좌”를 server `Purchase`로 보내는 설계는 48시간 window와 browser pending 차단 상태를 같이 봐야 한다.
- 24시간 후 자동취소되는 pending 가상계좌는 purchase류 server event로 보내지 않는다.

## 8. Shadow Mode Dedup Fields

TJ 관리 Attribution VM shadow ledger 권장 필드:

| field | 예시 | 목적 |
| --- | --- | --- |
| `site` | `biocom` | site allowlist |
| `event_name` | `Purchase` | server 후보 event |
| `browser_event_name` | `Purchase` | browser Pixel event |
| `raw_order_code` | `o20260502...` | 주문 기준 |
| `server_event_id_candidate` | `Purchase_o20260502...` | dedup 후보 |
| `browser_event_id_observed` | `Purchase_o20260502...` | 실제 관측값 |
| `dedup_ready` | `true` | dedup 가능 여부 |
| `send_candidate` | `false` | shadow mode에서는 항상 false |
| `block_reason` | `shadow_mode_only` | 미전송 사유 |
| `payment_status` | `confirmed` | 결제 상태 |
| `tiktok_evidence_type` | `ttclid` | attribution 근거 |
| `pixel_code` | `D5G8FTBC77UAODHQ0KOG` | event source 일치 확인 |
| `pii_in_payload` | `false` | 안전성 |

## 9. Auditor Checklist

Production send 승인 전 아래를 모두 통과해야 한다.

- [ ] 최근 browser `Purchase` Pixel Helper 최종 event_id가 `Purchase_{order_code}`로 유지된다.
- [ ] VM raw event_id와 browser final event_id 차이를 코드가 명시적으로 처리한다.
- [ ] Test Events only에서 server `Purchase`가 수신된다.
- [ ] Test Events only에서 event name/id mismatch 경고가 없다.
- [ ] dedup/Diagnostics에서 double count 위험이 낮다는 증거가 있다.
- [ ] pending/canceled/no-evidence order가 shadow ledger에서 block 처리된다.
- [ ] production env에 `test_event_code`가 없다.
- [ ] send kill switch 기본값은 off다.
- [ ] 운영DB PostgreSQL write가 없다.
- [ ] GTM/Purchase Guard/firstTouch 정책 변경이 없다.
