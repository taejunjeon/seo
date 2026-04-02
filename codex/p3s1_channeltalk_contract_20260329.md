# P3-S1 ChannelTalk Contract

기준일: 2026-03-29

## 10초 결론

이번 턴의 목적은 `memberId = customer_key` 규칙을 사람이 읽어도 모호하지 않게 고정하는 것이다.  
결론은 단순하다. ChannelTalk의 기준 키는 새로 만들지 않고 `customer_key`를 그대로 쓴다.  
즉 `memberId`는 내부 기준 키의 외부 투영값이고, `memberHash`는 있으면 붙이고 없어도 v1은 진행한다.

## 왜 지금 필요한가

이 계약이 흐리면 아래가 전부 흔들린다.

- 상담/메시지/매출 연결
- 실험 장부와 ChannelTalk 이벤트 조인
- `lastSeenAt` 같은 상태값의 신뢰도 점검

즉, 이번 문서는 기능 설명이 아니라 `같은 사람을 같은 키로 부르는 규칙`을 고정하는 문서다.

## 1. 기준 키 규칙

### 결론

- source of truth: `customer_key`
- ChannelTalk `memberId`: `customer_key`
- ChannelTalk `memberHash`: secret이 있으면 붙이고, 없으면 생략

중요한 말:

- `memberId`가 기준 키가 아니다.
- 내부 원장이 기준 키이고, ChannelTalk는 그 키를 받아 쓰는 쪽이다.

## 2. boot / updateUser / track 공통 식별 필드

| SDK call | 꼭 있어야 하는 것 | 같이 넣는 것이 좋은 것 | 왜 필요한가 |
| --- | --- | --- | --- |
| `boot` | `pluginKey` | `memberId`, `memberHash`, `profile.name`, `profile.mobileNumber`, `profile.email` | 첫 진입에서 세션과 고객 키를 붙인다 |
| `updateUser` | `memberId` | `memberHash`, `profile.name`, `profile.mobileNumber`, `profile.email` | 로그인, 상담, 주문 뒤에 사용자 최신값을 덮어쓴다 |
| `track` | `event` | `properties.customer_key`, `properties.order_id`, `properties.checkout_id` | 이벤트 자체를 실험/매출 원장과 조인한다 |

실무 원칙:

- `boot`와 `updateUser`는 사람 프로필을 맞춘다.
- `track`은 행동과 조인 키를 맞춘다.

## 3. page name 규칙

| page_name | 언제 쓰는가 | 예시 경로 |
| --- | --- | --- |
| `home` | 메인 페이지 | `/` |
| `product:{product_id}` | 상품 상세 | `/products/alpha-ampoule` |
| `cart` | 장바구니 | `/cart` |
| `checkout` | 주문서/결제창 진입 | `/checkout` |
| `order_success` | 결제 완료 화면 | `/order/success` |
| `campaign:{campaign_key}` | 특정 CRM 랜딩을 강하게 구분할 때 | `/campaigns/winback-202604` |

원칙:

- 사람이 보고 이해되는 이름을 쓴다.
- path 전체를 그대로 쓰지 말고, 운영자가 읽기 쉬운 표준 이름으로 한 번 정규화한다.

## 4. event naming 규칙

| 규칙 | 이유 | 예시 |
| --- | --- | --- |
| `snake_case`만 쓴다 | 눈으로 읽기 쉽고 시스템 간 이름이 덜 흔들린다 | `checkout_started` |
| 행동 + 대상 순서로 쓴다 | 이름만 봐도 무슨 일인지 안다 | `product_view`, `add_to_cart` |
| 완료 이벤트는 완료형으로 쓴다 | 시작 신호와 완료 신호를 구분한다 | `order_paid`, `refund_completed` |

현재 표준 이벤트:

- `product_view`
- `add_to_cart`
- `checkout_started`
- `checkout_abandoned`
- `order_paid`
- `refund_completed`
- `repeat_purchase`

## 5. /crm 기준 최소 campaign 응답 shape

이 shape의 목적은 `운영자가 최소한 이 정보만 봐도 캠페인을 굴릴 수 있게 하는 것`이다.

필수 필드:

- `campaign_key`
- `channel`
- `status`
- `segment_key`
- `eligible_customer_count`
- `holdout_customer_count`
- `template_key`
- `page_name`
- `event_trigger`
- `scheduled_at`

예시:

```json
{
  "campaign_key": "crm-winback-202604",
  "channel": "channeltalk",
  "status": "draft",
  "segment_key": "winback_21_90d",
  "eligible_customer_count": 1240,
  "holdout_customer_count": 124,
  "template_key": "ct_winback_v1",
  "page_name": "campaign:crm-winback-202604",
  "event_trigger": "checkout_abandoned",
  "scheduled_at": "2026-04-02T10:00:00+09:00",
  "delivery_summary": {
    "prepared": 1240,
    "sent": 0,
    "failed": 0
  },
  "conversion_summary": {
    "purchase_count": 0,
    "net_revenue": 0
  }
}
```

## 6. stale check query 초안

목적:

- `lastSeenAt`가 오래된 사용자를 빠르게 찾는다.
- `memberId`가 진짜 `customer_key`처럼 보이는지도 같이 본다.

```sql
SELECT
    id AS member_id,
    "lastSeenAt" AS last_seen_at,
    profile_email,
    "profile_mobileNumber" AS profile_mobile_number,
    CASE
        WHEN id LIKE 'ck_%' THEN TRUE
        ELSE FALSE
    END AS member_id_looks_like_customer_key,
    CASE
        WHEN NULLIF(TRIM("lastSeenAt"), '') IS NULL THEN 'missing'
        WHEN SUBSTRING("lastSeenAt", 1, 10) < TO_CHAR(CURRENT_DATE - INTERVAL '30 day', 'YYYY-MM-DD') THEN 'stale_30d_plus'
        ELSE 'fresh'
    END AS stale_bucket
FROM tb_channeltalk_users
ORDER BY
    CASE
        WHEN NULLIF(TRIM("lastSeenAt"), '') IS NULL THEN 0
        ELSE 1
    END,
    "lastSeenAt" ASC NULLS FIRST
LIMIT 200;
```

## 7. 이번 턴에 코드로 고정한 것

- Revenue API 응답에 `contract_version = p3-s1-v1`
- `identity_principle`
- `identity_field_table`
- `page_name_rules`
- `event_naming_rules`
- `campaign_minimal_response_shape`
- `stale_check_query_draft`

즉, 이 문서 내용은 말뿐이 아니라 `/api/crm/channeltalk/contract` 응답 shape에도 같이 들어간다.
