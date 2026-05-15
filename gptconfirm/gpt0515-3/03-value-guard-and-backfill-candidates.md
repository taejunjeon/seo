# 03. Value Guard And Backfill Candidates

작성 시각: 2026-05-15 01:16 KST

## 결론

Meta Purchase 전송 앞에는 value guard가 반드시 필요하다. 실제 구매가 맞아도 금액이 틀리면 Meta ROAS가 오염된다.

이번 sprint에서는 운영 Meta send를 하지 않았다. API not found 48건은 no-send이고, 기존 Imweb confirmed 5건 후보도 최신 source freshness가 닫히기 전까지 hold다.

## value source priority

1. 운영DB `dashboard.public.tb_iamweb_users` order total.
2. 운영DB에 없고 Imweb API confirmed만 있을 때 Imweb order total.
3. VM Cloud line/item/cart value는 보조값이다.
4. 후보 금액과 source total이 다르면 no-send.
5. FREE/0원은 no-send.
6. canceled/refunded는 no-send.
7. duplicate event_id는 no-send.
8. 다중 line 주문은 line 단위가 아니라 order total 기준이다.
9. `payment_page_seen`은 어떤 경우에도 Purchase 후보가 아니다.

## guard contract

```json
{
  "candidate_type": "meta_purchase",
  "site": "biocom",
  "source_priority": [
    "operational_db_payment_complete_order_total",
    "imweb_v2_api_confirmed_order_total",
    "vm_cloud_auxiliary_value"
  ],
  "required": {
    "confirmed_payment_source": true,
    "source_total_krw_positive": true,
    "candidate_value_equals_source_total": true,
    "duplicate_event_id": false,
    "canceled_or_refunded": false,
    "payment_page_seen": false
  },
  "default_action": "no_send"
}
```

## backfill candidate status

| candidate group | current status | reason | Meta send |
|---|---|---|---|
| API not found 48 | no-send | `/shop_payment/` artifact + no payment key/value + no confirmed source | 0 |
| current pending 69 | no-send by default | same artifact pattern until completion source closes | 0 |
| prior Imweb confirmed 5 | hold | source freshness drift; latest status-list/API evidence needs refresh | 0 |
| canceled/refunded prior 1 | no-send | canceled/refunded | 0 |
| FREE/0원 rows | no-send | Purchase value must be positive actual revenue | 0 |

## value guard failure labels

- `payment_page_seen_never_purchase`
- `source_total_missing`
- `source_total_not_positive`
- `candidate_value_missing`
- `value_mismatch_blocked`
- `duplicate_event_id_blocked`
- `canceled_or_refunded_blocked`
- `free_zero_value_blocked`
- `npay_actual_path_required`
- `source_freshness_gap_hold`

## dry-run output shape

```json
{
  "site": "biocom",
  "checked_at_kst": "YYYY-MM-DD HH:mm KST",
  "candidate_count": 0,
  "candidate_amount_krw": 0,
  "blocked_count": 0,
  "blocked_amount_krw": 0,
  "blocked_by_reason": [
    {
      "reason": "payment_page_seen_never_purchase",
      "rows": 0,
      "amount_krw": 0
    }
  ],
  "no_send": true,
  "no_write": true,
  "raw_identifier_output": false
}
```

## deployment approval needed

`VALUE_GUARD_DEPLOY_APPROVAL_NEEDED`.

Codex can implement local patch and fixture without another approval. VM Cloud backend deploy/restart needs Yellow approval. Meta Purchase send remains Red and is not included.

## success criteria

- value mismatch is no-send.
- completion source missing is no-send.
- FREE/0원 is no-send.
- canceled/refunded is no-send.
- duplicate event_id is no-send.
- `payment_page_seen` is no-send.
- raw id output 0.
- no platform send during dry-run.

## failure criteria

- VM Cloud line/item value is used as primary Purchase amount.
- `/shop_payment/` row enters Meta Purchase candidate set.
- source total mismatch is allowed.
- duplicate event_id is allowed.
- canceled/refunded or 0원 row enters send candidate set.
