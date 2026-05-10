# Path B wiring 최종 결정 — R2 vs GTM vs imweb footer (gpt0508-37 작업6)

작성 시각: 2026-05-11 01:30:00 KST
Lane: Green decision doc / 추가 코드 0
자신감: 92%

## 한 줄 결론

본 sprint에서 R2 wire가 PASS(typecheck + fixture 6/6, 자신감 92%)했으니, **GTM Custom HTML과 imweb footer 직접 수정은 둘 다 parked**. Claude Code는 다음 sprint들에서 R2 deploy → 1h canary → ledger lookup wire 순서로 진행하고, GTM/footer 사양은 R2가 운영에서 이상 동작할 때만 다시 꺼내겠소.

## Final priority

| Lane | 상태 | 사유 |
|---|---|---|
| **R2 (backend payment-success → order_bridge_ledger 자동 기록)** | **ACTIVE** (본 sprint 코드 PASS, deploy 대기) | imweb/GTM 변경 0, fixture 6/6 PASS, raw/send/upload invariant 보장 |
| GTM Custom HTML | **PARKED** | R2가 운영에서 LEDGER_WRITE_REJECTED 또는 ledger row 누적이 expected 대비 70% 미만일 때 재진입 |
| imweb footer 직접 수정 | **PARKED_LAST_RESORT** | GTM도 막힐 때만 — Preview 단계가 없어 위험이 가장 큼 |

## 1. R2가 PASS인데 왜 GTM/footer를 미리 안 만드는가

- R2의 fixture 6/6이 운영 invariant를 코드 단에서 강제(raw 0 / send 0 / write_flag·canary_until·dedupe·max_rows 모두 enforce). 운영에서 이상 동작이 생길 가능성 자체가 낮음.
- GTM Custom HTML은 fresh workspace + capacity preflight + Preview + Publish 절차가 필수라 제작·승인 비용이 큼.
- imweb footer 직접 수정은 Preview 없이 운영 traffic 직접 영향 — R2가 됐는데 굳이 footer로 갈 이유가 없음.
- 본 sprint 운영 철학 “데이터 생성/연결 우선, 문구·옵션 추가 회피”에 부합.

## 2. R2가 부분 작동(=`session_only_quarantine` 만 누적) 하는 게 한계인가?

아니오. session_only_quarantine 도 ledger row 누적이라는 1차 목표는 달성. budget floor 자동 승격은 본 sprint 정책상 어차피 막혀 있음. 다음 sprint identity 보강 patch(운영DB read-only로 customer_email/customer_number 보충)로 `full_bridge` 승급 가능.

## 3. GTM 재진입 트리거 (R2가 막힐 때만)

다음 중 하나라도 발생하면 GTM Custom HTML packet 작성을 시작:

1. R2 deploy 후 1h 주간 canary에서 ledger row delta가 payment-success 호출 수의 30% 미만
2. R2 응답의 `orderBridgeR2.rejected_reason`이 `buildOrderBridgeIdentityHmacMaterial_failed` 또는 `hash_secret_missing`이 빈번하게 발생
3. payment-success 핸들러 자체 호출 수가 운영 결제 대비 50% 미만 (CORS / Cloudflare Tunnel / origin 차단 의심)
4. backend deploy가 어떤 이유로 7일 이상 막힘

이 트리거에 도달하지 않으면 GTM은 그대로 parked.

## 4. imweb footer 재진입 트리거 (마지막 카드)

R2와 GTM 모두 다음 sprint들에서 막힌 게 입증된 후만 진입.

- imweb footer는 Preview 단계가 없으므로 변경 즉시 모든 결제 페이지 영향
- 실제로 R2가 PASS인 한, 결제 flow 가 backend에 도달하기만 하면 ledger 누적이 자동 — 이걸 막을 시나리오가 거의 없음
- 본 sprint에서는 footer 사양 갱신·검토 작업을 진행하지 않음

## 5. 의사결정 트리

```
R2 deploy 시도?
  YES → 1h 주간 canary
    ledger delta ≥ payment-success 호출 수 70% ?
      YES → CANARY_PASS, 다음 sprint identity 보강 + ledger lookup wire
      NO → R2 응답의 rejected_reason 분석
        rejected_reason = missing_order_key 비율 높음 → 운영DB read-only 보강
        rejected_reason = hash_secret_missing → ENV 점검
        그 외 → GTM Custom HTML packet 작성 시작
  NO (deploy 대기) → 본 sprint 그대로 stay
```

## 6. 다음 액션

### Claude Code가 할 일

본 sprint는 GTM/footer 추가 작업 없음 (parked).

다음 sprint 분기:

1. (R2 PASS 시) identity 보강 patch + ledger lookup wire — Green code
2. (R2 부분 PASS 시) GTM Custom HTML Preview packet — Yellow Preview / Red Publish
3. (R2 + GTM 모두 막힐 때) imweb footer 사양 검토 — Yellow

### TJ님이 할 일

본 결정 자체에 추가 액션 없음. R2 deploy 결정(작업 5 packet)이 우선.

## 7. Verdict

`R2_PRIMARY_GTM_PARKED_FOOTER_PARKED_LAST_RESORT`
