# R2 vs GTM/footer post-canary 결정 (gpt0508-38 작업6)

작성 시각: 2026-05-11 02:12:00 KST
Lane: Green decision doc / 코드 추가 0
자신감: 90%

## 한 줄 결론

R2 deploy가 PASS이고 1h canary가 끝까지 invariant 유지(write_flag=false 자동 복귀, raw 0, send 0)하면 **GTM Custom HTML과 imweb footer는 그대로 parked**. canary 결과가 traffic 부재(`NO_TRAFFIC`/`session_only_quarantine` 다수)여도 **R2 자체는 정상**이라 fallback 진입 안 함. 진짜 fallback이 필요한 시그널은 endpoint mismatch나 stored 비율이 너무 낮거나 raw/send invariant 깨질 때만.

## 1. canary 결과별 분기

| canary verdict | 다음 결정 |
|---|---|
| `CANARY_COMPLETE_PASS` (row delta ≥ 1, raw 0, send 0) | R2 PRIMARY 유지. GTM/footer parked. 다음 sprint identity 보강 + ledger_lookup wire. |
| `CANARY_PARTIAL_SESSION_ONLY` (row 누적 OK, 대부분 session_only_quarantine) | R2 PRIMARY 유지. paid_order_click_exact 승급은 운영DB PAYMENT_COMPLETE join 으로 풀음(작업3 helper). GTM/footer parked. |
| `CANARY_NO_TRAFFIC` (payment-success 호출 거의 0) | R2 자체는 정상. 시간대 영향. GTM/footer parked. 주간 시간대(KST 11~12 또는 19~20)에 재실행 권장. |
| `CANARY_ENDPOINT_MISMATCH` (payment-success 호출은 있으나 orderBridgeR2.attempted 부족) | R2 wire 자체 점검. GTM Preview packet 작성 검토 시작. footer 는 여전히 마지막. |
| `CANARY_LEDGER_WRITE_REJECTED` (orderBridgeR2.attempted 다수, stored 0) | rejected_reason 분석 (`write_flag_disabled`, `missing_order_key`, `hash_secret_missing` 등). 보통 env 또는 데이터 누락. GTM/footer parked 유지. |
| `CANARY_FAIL` (raw>0 또는 send>0) | 즉시 rollback 후 사후 분석. fallback 진입 검토는 사후. |

## 2. R2 PRIMARY 유지 기준 (이번 sprint 이후)

다음 모두 만족하는 한 R2 유지:
- 본 sprint 1h canary 안전선 PASS (raw 0, send 0, write_flag false 복귀)
- 다음 sprint identity 보강 + ledger_lookup wire 후 budget_usable 후보가 1건이라도 늘어나는 게 dry-run으로 검증됨

## 3. GTM Custom HTML 재진입 트리거 (재확인)

다음 중 하나라도 발생하면 GTM Preview packet 작성 시작:

1. R2 deploy 후 주간 1h canary에서 **ledger row delta가 payment-success 호출 수의 30% 미만**
2. R2 응답의 `orderBridgeR2.rejected_reason`이 `buildOrderBridgeIdentityHmacMaterial_failed` 또는 `hash_secret_missing` 빈도가 50% 초과
3. payment-success 핸들러 자체 호출 수가 운영 결제 대비 50% 미만 (CORS / Cloudflare Tunnel / origin 차단 의심)
4. backend deploy가 어떤 이유로 7일 이상 막힘

이번 sprint 의 deploy + canary 까지 진행한 결과 위 트리거 미충족 → **GTM PARKED 유지**.

## 4. imweb footer 재진입 트리거 (마지막 카드)

R2와 GTM 모두 다음 sprint들에서 막힌 게 입증된 후만 진입. 본 sprint에서는 절대 진입 안 함.

## 5. 본 sprint 결론

| Lane | 상태 | 이유 |
|---|---|---|
| **R2** | **ACTIVE** (deploy + canary 완료) | invariant 모두 PASS, 운영 영향 0 |
| GTM Custom HTML | **PARKED** | R2 invariant 깨지지 않음 |
| imweb footer 직접 수정 | **PARKED_LAST_RESORT** | R2와 GTM 모두 막혀야 진입 |

## 6. 다음 액션

### Claude Code가 할 일

1. (작업 2 산출물에서) canary post-snapshot 회수 + 4-signal verdict 결정
2. (다음 sprint) identity 보강 + ledger_lookup wire (R2 ACTIVE 기준)

### TJ님이 할 일

1. (선택) 주간 시간대 1h canary 재실행 (작업 2가 NO_TRAFFIC 결과면 더 명확한 row 누적 위해)

## 7. Verdict

`R2_PRIMARY_GTM_PARKED_FOOTER_PARKED_LAST_RESORT`
