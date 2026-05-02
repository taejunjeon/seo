# Biocom NPay Recovery GA4 MP Approval Draft (2026-05-02)

작성 시각: 2026-05-02 17:55 KST
site: `biocom`
phase: `approval_draft`
mode: `approved_limited_send_completed` / `no_write` / `no_publish` / `no_deploy`
window_kst: `2026-04-25 01:04:09 KST` ~ `2026-05-02 01:04:09 KST`
Primary source: VM SQLite `npay_intent_log`, operational Postgres `public.tb_iamweb_users`
BigQuery guard: TJ님 manual console result, 5/5 `robust_absent`
Confidence: 82%

## 10초 요약

이 문서는 전송 실행안이 아니라 TJ님 승인 판단용 draft로 작성됐다. 2026-05-02 18:04 KST에 TJ님 승인에 따라 추천 1건 `202604309992065`만 GA4 MP 제한 테스트로 전송했다.

수동 BigQuery robust guard 결과 A급 production 후보 5건이 모두 `robust_absent`로 확인됐다. 실제 전송은 승인 전 금지였고, 승인 후 1건만 실행했다.

결과 문서는 `data/biocom-npay-ga4-mp-limited-test-result-20260502.md`다.

## 결정 요청

| 선택지 | 의미 | Codex 추천 |
|---|---|---|
| YES: 1건 제한 테스트 | `202604309992065` 1건만 GA4 MP purchase로 수동 전송 | 추천 |
| NO: 전송 보류 | approval draft만 보존하고 실제 전송하지 않음 | 보수안 |

추천 답변:

```text
YES: biocom order_number=202604309992065 1건만 GA4 MP purchase 제한 테스트.
Meta/TikTok/Google Ads 전송은 금지.
GTM publish, backend deploy, DB write, NPay click은 금지.
```

## !coffeedata 참조 반영

`data/!coffeedata.md` 업데이트에서 참고할 점은 아래 2개다.

1. 더클린커피는 BigQuery-first guard와 `robust_absent` 판정을 no-send 상태에서 먼저 닫는다.
2. `robust_absent`가 있어도 실제 전송과 운영 변경은 approval gate 뒤에만 진행한다.

따라서 바이오컴도 같은 원칙을 적용한다. 커피 쪽 dispatcher v2.1, live publish, imweb_order_code capture 결과는 이번 바이오컴 GA4 MP 제한 테스트에 섞지 않는다.

## 후보 전체

| 우선 | order_number | channel_order_no | value | paid_at_kst | age@17:55 | 72h | score | gap | amount | client_id | ga_session_id | guard | 추천 |
|---:|---|---|---:|---|---:|---|---:|---:|---|---|---|---|---|
| 1 | `202604309992065` | `2026043040116970` | 35000 | 2026-04-30 12:41:30 | 53.2h | YES | 80 | 28 | `final_exact` | `118292165.1777520272` | `1777520272` | `robust_absent` | 1차 추천 |
| 2 | `202605011540306` | `2026050158972710` | 496000 | 2026-05-01 09:16:46 | 32.6h | YES | 80 | 28 | `final_exact` | `985413772.1774220691` | `1777594221` | `robust_absent` | 1건 성공 후 |
| 3 | `202604303307399` | `2026043034982320` | 496000 | 2026-04-30 09:19:10 | 56.6h | YES | 70 | 18 | `final_exact` | `901508731.1765852144` | `1777508260` | `robust_absent` | 1건 성공 후 |
| 4 | `202604285552452` | `2026042867285600` | 496000 | 2026-04-28 08:27:09 | 105.5h | NO | 70 | 18 | `final_exact` | `806449930.1777331701` | `1777331701` | `robust_absent` | 보류 |
| 5 | `202604280487104` | `2026042865542930` | 35000 | 2026-04-28 06:13:24 | 107.7h | NO | 80 | 28 | `final_exact` | `695356435.1777324290` | `1777324290` | `robust_absent` | 보류 |

`202604285552452`와 `202604280487104`는 GA4 MP timestamp 72시간 제약 리스크가 크므로 이번 제한 테스트 후보에서 제외한다.

## 추천 1건

### `202604309992065`

추천 이유:

1. value가 35,000원이라 테스트 실패 시 리포트 왜곡 부담이 작다.
2. paid_at 기준 약 53.2시간으로 72시간 안이다.
3. score 80, score_gap 28, time_gap 0.7분이다.
4. client_id와 ga_session_id가 모두 있다.
5. order_number와 channel_order_no 모두 BigQuery manual guard에서 `robust_absent`다.

## Payload Preview

### 추천 1건 JSON

```json
{
  "platform": "GA4_MP",
  "event_name": "purchase",
  "client_id": "118292165.1777520272",
  "timestamp_micros": "1777520490000000",
  "events": [
    {
      "name": "purchase",
      "params": {
        "transaction_id": "202604309992065",
        "channel_order_no": "2026043040116970",
        "event_id": "NPayRecoveredPurchase_202604309992065",
        "value": 35000,
        "currency": "KRW",
        "session_id": 1777520272,
        "payment_method": "NAVERPAY_ORDER",
        "recovery_source": "npay_recovery_dry_run",
        "recovery_version": "v0",
        "dispatch_dedupe_key": "npay_recovery_ga4_purchase:biocom:202604309992065"
      }
    }
  ],
  "send_candidate": true,
  "approval_required": true
}
```

### 후보별 Preview

| order_number | transaction_id | channel_order_no | value | currency | client_id | ga_session_id | event_id | product_subtotal | delivery | discount | final_payment |
|---|---|---|---:|---|---|---|---|---:|---:|---:|---:|
| `202604280487104` | `202604280487104` | `2026042865542930` | 35000 | KRW | `695356435.1777324290` | `1777324290` | `NPayRecoveredPurchase_202604280487104` | 35000 | 0 | 0 | 35000 |
| `202604285552452` | `202604285552452` | `2026042867285600` | 496000 | KRW | `806449930.1777331701` | `1777331701` | `NPayRecoveredPurchase_202604285552452` | 496000 | 0 | 0 | 496000 |
| `202604303307399` | `202604303307399` | `2026043034982320` | 496000 | KRW | `901508731.1765852144` | `1777508260` | `NPayRecoveredPurchase_202604303307399` | 496000 | 0 | 0 | 496000 |
| `202604309992065` | `202604309992065` | `2026043040116970` | 35000 | KRW | `118292165.1777520272` | `1777520272` | `NPayRecoveredPurchase_202604309992065` | 35000 | 0 | 0 | 35000 |
| `202605011540306` | `202605011540306` | `2026050158972710` | 496000 | KRW | `985413772.1774220691` | `1777594221` | `NPayRecoveredPurchase_202605011540306` | 496000 | 0 | 0 | 496000 |

모든 후보는 `final_exact`다. 배송비와 할인 보정은 없다.

## 제외 후보

| 후보 | 제외 이유 |
|---|---|
| `202604280487104` | 72시간 초과 |
| `202604285552452` | 72시간 초과, value 496,000원 |
| `202604303307399` | value 496,000원. 1건 성공 후 검토 |
| `202605011540306` | value 496,000원. 1건 성공 후 검토 |

## 리스크

| 리스크 | 설명 |
|---|---|
| rollback 한계 | GA4에 들어간 event는 표준 리포트에서 즉시 깔끔하게 삭제하기 어렵다 |
| 중복 위험 | manual guard는 robust_absent지만 export 지연이나 다른 property/stream 누락 가능성은 0이 아니다 |
| attribution 품질 | client_id/ga_session_id가 있어도 late send는 세션 귀속 품질이 떨어질 수 있다 |
| 72시간 제한 | 오래된 후보 2건은 GA4 MP timestamp 제약에 걸릴 수 있다 |
| 광고 플랫폼 오염 | Meta/TikTok/Google Ads로 같이 보내면 학습 오염 위험이 크다 |

## 전송 후 검증 계획

승인 후 1건을 보낸 경우에만 아래를 확인한다.

| 확인 항목 | 기대값 |
|---|---|
| `ecommerce.transaction_id` | `202604309992065` |
| `event_params.channel_order_no` | `2026043040116970` |
| `event_params.event_id` | `NPayRecoveredPurchase_202604309992065` |
| `event_name` | `purchase` |
| value/currency | `35000` / `KRW` |
| client_id | `118292165.1777520272` |
| ga_session_id | `1777520272` |

## 승인 전 금지

| 항목 | 상태 |
|---|---|
| GA4 Measurement Protocol 전송 | 금지 |
| Meta CAPI 전송 | 금지 |
| TikTok Events API 전송 | 금지 |
| Google Ads conversion 전송 | 금지 |
| 운영 DB write | 금지 |
| `match_status` 업데이트 | 금지 |
| GTM publish | 금지 |
| backend deploy | 금지 |
| Imweb header/footer 수정 | 금지 |
| NPay 버튼 클릭 | 금지 |

## 요청 문구

TJ님은 아래 둘 중 하나로 답하면 된다.

```text
YES: biocom order_number=202604309992065 1건만 GA4 MP purchase 제한 테스트.
Meta/TikTok/Google Ads 전송은 금지.
GTM publish, backend deploy, DB write, NPay click은 금지.
```

```text
NO: 오늘은 전송하지 않고 approval draft만 보존.
```
