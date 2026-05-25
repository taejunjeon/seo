# Google NPay 주문번호 bridge 설계 - 2026-05-25

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
  required_context_docs:
    - data/!data_inventory.md
    - AGENTS.md
  lane: Green
  allowed_actions:
    - read-only source analysis
    - dry-run scoring design
    - no-send bridge design
    - documentation
  forbidden_actions:
    - DB write/apply
    - Google Ads conversion upload
    - GA4/Meta/TikTok platform send
    - GTM publish
    - production deploy
    - real payment test
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite snapshot: /tmp/seo-vm-crm-20260525T055307Z.sqlite3
      - operational_postgres.public.tb_iamweb_users via npay-roas-dry-run
    window:
      - 2026-05-23 09:00 KST ~ 2026-05-25 05:56 KST
    freshness: snapshot copied 2026-05-25 05:53 KST
    confidence: high for matching shape, medium for future production-write path until controlled deploy smoke
```

## 한 줄 결론

NPay는 결제완료 페이지가 우리 사이트 밖에 있으므로, 결제완료 URL에서 click id를 직접 회수하는 방식은 약하다. 대신 VM Cloud `imweb_orders.order_time`과 `npay_intent_log.captured_at`을 이어서 "NPay 버튼 클릭 직후 생성된 주문번호"를 bridge로 잡는 방식이 현재 가장 실용적이다.

## 사람이 이해하는 구조

현재 흐름은 아래처럼 나뉜다.

```text
Google 광고 클릭
  -> 바이오컴 상품 페이지 진입
  -> NPay 버튼 클릭
  -> 네이버 외부 결제창
  -> NPay 결제완료
  -> 나중에 주문 API/동기화로 내부 주문번호 확인
```

문제는 마지막 두 단계다. 네이버 외부 결제창에서 끝나기 때문에 바이오컴 `payment_success` 코드가 주문번호와 click id를 같이 받을 기회가 없다.

## 지금 확인된 bridge 후보

NPay 버튼 클릭 시점:

- `npay_intent_log.captured_at`
- `product_idx`
- `product_name`
- `product_price`
- `client_id`
- `ga_session_id`
- `gclid/gbraid/wbraid presence`
- `utm`

주문 동기화 시점:

- `imweb_orders.order_no`
- `imweb_orders.channel_order_no`
- `imweb_orders.order_time`
- `imweb_orders.payment_amount`
- `imweb_orders.pay_type=npay`

핵심은 `imweb_orders.order_time`이다. TJ님 테스트 주문은 아래처럼 거의 동시에 찍혔다.

| 항목 | 값 |
|---|---:|
| NPay 버튼 클릭 intent | 2026-05-24 13:40:55.904 KST |
| Imweb/NPay 주문 생성 | 2026-05-24 13:40:56.000 KST |
| 차이 | 0분 |
| 실제 결제완료 | 2026-05-24 13:53:24 KST |

따라서 결제완료 시각만 보면 12.5분 차이라 애매하지만, 주문 생성 시각을 보면 같은 행동으로 볼 근거가 강하다.

## 설계안

### Phase 1. no-write dry-run 기준

이미 구현한 방향:

1. 운영 주문에서 NPay 결제완료 주문을 읽는다.
2. 같은 주문번호 또는 NPay 주문번호로 VM Cloud `imweb_orders`를 읽는다.
3. `imweb_orders.order_time`과 `npay_intent_log.captured_at`의 차이를 계산한다.
4. 차이가 1분 이하면 `order_create_time_bridge=exact`로 표시한다.
5. 이 값은 내부 분석 신호로만 쓴다. Google Ads 전송 후보를 자동으로 열지 않는다.

### Phase 2. no-send bridge ledger 후보

실제 write 승인이 필요해지면 별도 테이블 또는 기존 `order_bridge_ledger`를 사용해 아래만 저장한다.

```text
site
order_no_hash
channel_order_no_hash
intent_id
order_created_at
intent_captured_at
order_create_gap_minutes
client_id
ga_session_id
google_click_id_type_presence
amount_match_type
bridge_confidence
platform_send_count=0
```

처음에는 원문 click id를 저장하지 않고 presence/type만 둔다. Google Ads upload 후보를 만들려면 별도 Red 승인 전까지 raw click id는 사용하지 않는다.

### Phase 3. 운영 화면 표시

Google ROAS 화면에는 아래처럼 표시한다.

```text
NPay 실제 결제완료 중 Google 클릭 연결 가능성
- 주문번호 직접 연결: 0건
- 주문 생성시각 bridge exact: N건
- 그중 Google click id 있음: N건
- Google Ads 전송 후보: 0건
```

이렇게 보여야 TJ님이 "실제 결제는 있는데 왜 Google Ads에 못 보내는지"를 직관적으로 볼 수 있다.

## 매칭 기준

| 기준 | 의미 | 내부 분석 사용 | Google Ads upload |
|---|---|---:|---:|
| order_create_time_bridge=exact | NPay 버튼 클릭과 주문 생성이 1분 이내 | yes | no |
| amount_match=final_exact | 클릭 상품가와 주문금액이 동일 | yes | no |
| product_name_match=exact | 상품명이 동일 | yes | no |
| client_id/ga_session_id present | 브라우저 단서가 있음 | yes | no |
| gclid/gbraid/wbraid present | Google 광고 클릭 단서가 있음 | yes | no |
| attribution_ledger direct payment_success | 주문번호와 click id가 결제완료 row에 직접 있음 | yes | 후보 가능 |

핵심: bridge exact는 내부 분석에는 강하지만, 결제완료 row 직접 증거가 아니므로 Google Ads upload 후보로 바로 승격하지 않는다.

## stop rule

아래 조건이면 자동 확정하지 않는다.

- 같은 주문에 exact bridge 후보가 2개 이상
- 금액이 맞지 않음
- 상품명이 안 맞음
- 주문 생성 시간이 클릭보다 5분 이상 떨어짐
- Google click id가 없음
- GA4에 이미 같은 주문번호가 purchase로 있음
- 환불/취소 주문

## 다음 구현 후보

1. `npay-roas-dry-run`에 `order_create_time_bridge` 기준을 계속 유지한다.
2. `/api/attribution/npay-intent-rematch-dry-run` 응답에 bridge exact 카운트를 노출한다.
3. 프론트 Google ROAS 보고서에는 `Google Ads 전송 후보`와 `내부 bridge 후보`를 분리 표시한다.
4. 별도 승인 전까지 `npay_intent_log.matched_order_no` write는 하지 않는다.

## 감사 판단

PASS_WITH_NOTES

- 설계와 dry-run 기준만 다뤘다.
- 실제 DB write, 플랫폼 전송, 배포는 하지 않았다.
- Google Ads upload 후보는 계속 0건으로 유지한다.
