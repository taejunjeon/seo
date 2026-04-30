# NPay GA4 MP 제한 테스트 실행 결과

작성 시각: 2026-04-30 21:30 KST
대상: `202604302383065` 1건
관련 문서: [[!npayroas]], [[npay-ga4-mp-limited-test-approval]], [[npay-roas-dry-run-20260430]]
Primary source: VM SQLite snapshot `/tmp/seo-npay-roas-20260430.sqlite3`, 운영 Postgres `public.tb_iamweb_users`
Cross-check: TJ BigQuery robust query 결과 `robust_absent`
Confidence: 86%

## 10초 요약

TJ님 승인 범위대로 `202604302383065` 1건만 GA4 Measurement Protocol `purchase`로 전송했다.

전송 전 dry-run guard와 GA4 debug 검증을 통과했고, 실제 collect 응답은 HTTP `204`였다. Meta CAPI, TikTok Events API, Google Ads 전환, DB `match_status` 업데이트, 운영 endpoint 배포는 하지 않았다.

다음 확인은 BigQuery export 반영 후 `transaction_id=202604302383065`, `channel_order_no=2026043043205620`, `event_id=NPayRecoveredPurchase_202604302383065`가 잡히는지 보는 것이다.

## 실행 결과

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-04-30 21:23 KST |
| mode | `send` |
| measurement_id | `G-WJFXN5E2Q1` |
| order_number | `202604302383065` |
| channel_order_no | `2026043043205620` |
| value | 35000 |
| currency | KRW |
| event_id | `NPayRecoveredPurchase_202604302383065` |
| dispatch_dedupe_key | `npay_recovery_ga4_purchase:biocom:202604302383065` |
| debug endpoint | HTTP 200, validationMessages 0 |
| collect endpoint | HTTP 204 |
| result file | [[npay-ga4-mp-limited-test-result-20260430.json]] |

## 전송 전 가드

| 가드 | 결과 |
|---|---|
| `status=strong_match` | 통과 |
| `strong_grade=A` | 통과 |
| `order_label=production_order` | 통과 |
| `already_in_ga4=robust_absent` | 통과 |
| `client_id` 있음 | 통과 |
| `session_id`로 쓸 `ga_session_id` 있음 | 통과 |
| paid_at 72시간 이내 | 통과 |
| `--confirm-order=202604302383065` | 통과 |

## Payload 핵심

GA4 debug에서 `session_id`와 `ga_session_id`를 동시에 넣으면 중복 파라미터로 해석됐다. 최종 전송 payload는 공식 `session_id`만 사용했다. 내부 리포트의 `ga_session_id=1777527289`는 `session_id=1777527289`로 전송했다.

```json
{
  "client_id": "2007220387.1777523364",
  "timestamp_micros": 1777528259000000,
  "events": [
    {
      "name": "purchase",
      "params": {
        "transaction_id": "202604302383065",
        "channel_order_no": "2026043043205620",
        "event_id": "NPayRecoveredPurchase_202604302383065",
        "value": 35000,
        "currency": "KRW",
        "session_id": 1777527289,
        "npay_recovery_source": "server_mp_limited_test",
        "recovery_reason": "npay_return_missing",
        "dispatch_dedupe_key": "npay_recovery_ga4_purchase:biocom:202604302383065"
      }
    }
  ]
}
```

## 전송 후 상태

이 주문은 다음 dry-run부터 `already_in_ga4=present`로 넣어 중복 전송을 막는다. BigQuery export에서 아직 보이기 전이어도, 우리가 수동 전송했다는 운영 사실을 guard에 반영한다.

전송 후 dry-run 기준:

| 항목 | 값 |
|---|---:|
| live intent | 304 |
| confirmed NPay order | 11 |
| A급 strong | 6 |
| `already_in_ga4=present` | 1 |
| `already_in_ga4=robust_absent` | 4 |
| dispatcher dry-run candidate | 4 |
| 실제 추가 전송 | 0 |

## 다음 확인

1. 2026-05-01 오전 이후 BigQuery에서 `202604302383065`, `2026043043205620`, `NPayRecoveredPurchase_202604302383065`를 조회한다.
2. 결과가 있으면 `already_in_ga4=present`를 유지한다.
3. 결과가 없으면 GA4 MP 수신 지연인지, payload가 raw export에 반영되지 않은 것인지 추가 확인한다.
4. 그 전까지 같은 주문 재전송은 금지한다.

## 금지선

- DB `match_status` 업데이트 금지
- 자동 dispatcher 운영 전환 금지
- Meta CAPI 전송 금지
- TikTok Events API 전송 금지
- Google Ads 전환 전송 금지
- B급 strong 전송 금지
- ambiguous 전송 금지
- `already_in_ga4=present` 주문 재전송 금지
