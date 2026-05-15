# 02. Bridge value guard

작성 시각: 2026-05-15 00:55 KST

## 결론

5건 bridge 후보는 아직 backfill 승인 대상으로 올리면 안 된다. Imweb direct evidence의 금액이 스냅샷마다 흔들렸고, 최신 status-list 재조회도 오류가 났다.

먼저 value guard를 코드/스크립트 레벨에서 강제해야 한다.

## 왜 필요한가

이미 10건 수동 backfill 중 2건에서 value mismatch가 있었다.

- sent value 합계: 239,800원
- 운영DB actual 합계: 811,200원
- 차이: 571,400원

이 상황에서 추가 backfill을 하면 Meta ROAS가 잘못 학습될 수 있다.

## value source priority

1. 운영DB `dashboard.public.tb_iamweb_users` order total
2. 운영DB가 없고 Imweb API confirmed만 있을 때 Imweb order total
3. VM Cloud line/item value는 보조값
4. candidate value와 source total이 다르면 no-send
5. FREE/0원은 no-send
6. canceled/refunded는 no-send
7. duplicate event_id는 no-send
8. 다중 line 주문은 line 합계가 아니라 order total 기준

## dry-run 판단

| 대상 | 결과 | 판단 |
|---|---:|---|
| 기존 수동 backfill 10건 | 8건 pass, 2건 value mismatch | guard가 있었다면 2건 no-send |
| API not found 48건 | send candidate 0 | no-send |
| Imweb confirmed 후보 5건 | 1,555,621원 vs 1,566,621원 snapshot drift | hold |
| canceled/refunded 1건 | 234,000원 | no-send |

## 5건 bridge 후보 상태

| 항목 | 상태 |
|---|---|
| 운영DB status | latest exact closed 아님 |
| Imweb API status | 22:30 KST evidence에서는 confirmed candidate |
| latest status-list recheck | errors 발생, confirmed 0으로 흔들림 |
| VM Cloud cache status | status blank |
| amount/value | snapshot drift 있음 |
| refund/cancel | 재확인 필요 |
| duplicate event_id | 추가 dry-run 필요 |
| NPay/FREE | 재확인 필요 |
| 현재 판정 | `value_guard_blocked` + `source_freshness_gap` |

## 필요한 패치

`Meta Purchase value guard`를 backfill/manual send path 앞에 둔다.

필수 gate:

1. `source_total_krw`와 `candidate_value_krw`를 비교한다.
2. 불일치하면 no-send + `value_mismatch_blocked`.
3. 다중 line 주문은 운영DB/Imweb order total만 사용한다.
4. `metaCapiAutoSendAllowed=false` bridge row는 수동 승인 없이는 전송하지 않는다.
5. response/report에는 raw order/payment/click id를 출력하지 않는다.

## 승인 필요 여부

`E. VALUE_GUARD_DEPLOY_APPROVAL_NEEDED`.

코드 패치와 fixture는 Green으로 작성 가능하다. VM Cloud 배포/restart는 Yellow 승인 필요다. Meta send는 별도 Red 승인 전 금지다.
