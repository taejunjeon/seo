# CAPI Send Status

작성 시각: 2026-05-15 15:21 KST
범위: VM Cloud Meta CAPI send log read-only aggregate
raw identifier 출력: 0

## 결론

서버 CAPI 경로는 살아 있다. 최근 6시간 `meta-capi-sends.jsonl` 기준 Purchase 45건이 모두 Meta 응답 `events_received=1`을 받았다. 따라서 Browser Purchase가 실패하더라도, confirmed 후보가 VM Cloud에서 닫히면 서버 CAPI가 Meta에 전달하는 경로는 작동 중이다.

다만 사용자가 본 브라우저 cache safe_ref(`safe_1fe5aa80`)는 `meta-capi-sends.jsonl`과 `pm2-out-0.log` recent tail에서 문자열 매칭되지 않았다. 최근 send log가 safe_ref를 저장하지 않는 형태라서, 해당 브라우저 safe_ref와 CAPI send를 1:1로 확정하지는 못했다.

## read-only aggregate

| 항목 | 값 |
|---|---:|
| checked_at UTC | 2026-05-15T06:20:05Z |
| checked_at KST | 2026-05-15 15:20 KST |
| considered tail | 1,000 rows |
| recent window | recent 6h |
| recent Purchase sends | 45 |
| `events_received=1` | 45 |
| failed/non-1 | 0 |
| test_event | 0 in last sample |

## autoSync activity

최근 VM Cloud 로그에 아래 형태의 autoSync가 계속 보였다.

- 2026-05-15 03:46 UTC: 26건 전송, 실패 0
- 2026-05-15 04:46 UTC: 2건 전송, 실패 0
- 2026-05-15 05:16 UTC: 3건 전송, 실패 0
- 2026-05-15 05:46 UTC: 1건 전송, 실패 0
- 2026-05-15 06:16 UTC: 5건 전송, 실패 0
- 2026-05-15 06:21 UTC: 1건 전송, 실패 0

## 해석

1. Meta CAPI dispatcher 자체가 멈춘 상태는 아니다.
2. Purchase candidate gate를 통과한 confirmed row는 계속 Meta에 전송되고 있다.
3. 이번 Header Guard cache 이슈는 Browser Purchase 경로의 문제로 분리해서 봐야 한다.
4. exact safe_ref 1:1 추적을 하려면 send log에 safe_ref 또는 decision-safe-ref를 남기는 보강이 필요하다.

## 다음 개선안

1. CAPI send log에 raw id가 아닌 `safe_ref`와 `decision_safe_ref`를 저장한다.
2. `/api/attribution/payment-decision` response body를 raw id 없이 aggregate debug로 남기는 옵션을 추가한다.
3. Browser Purchase와 server CAPI를 같은 safe_ref로 대조하는 monitoring endpoint를 만든다.

주의:

- 위 개선은 로그/모니터링 품질 개선이다.
- Meta 운영 Purchase 추가 send는 별도 Red 승인 전 금지다.
