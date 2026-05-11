# 02 GTM verdict + approval (gpt0508-44)

작성 시각: 2026-05-11 18:45:00 KST
범위: 작업 3 GTM Preview 필요 여부 verdict

## 1. 결정 규칙 (숫자 기반)

| 조건 (24h 기준) | verdict |
|---|---|
| source_evidence_present_rate ≥ 60% AND organic/direct/referral > 0 | **GTM_PARKED** |
| 30% ≤ rate < 60% | GTM_PREVIEW_CONDITIONAL_RECOMMENDED |
| rate < 30% | GTM_PREVIEW_STRONGLY_RECOMMENDED |
| total_rows < 50 | INSUFFICIENT_SAMPLE_HOLD (병행) |
| 72h 기준 organic + direct + referral 모두 0 | landing page_view 캡쳐 보강 → GTM Preview 추천 |
| paid_search 만 계속 증가 organic 0 | backend fan-out 이 paid 흐름만 잡고 있을 가능성 → audit |

## 2. 현재 잠정 verdict (deploy + 30분)

| 지표 | 값 | 임계 충족 |
|---|---|---|
| source_evidence_present_rate | 1.0 | ≥ 0.6 ✓ |
| organic + direct + referral | 5 | > 0 ✓ |
| total_rows | 12 | < 50 (병행 hold) |

→ **`GTM_PARKED_PROVISIONAL`** (자신감 0.6, 표본 부족)

## 3. 24h / 72h 분기 결정 트리

| 시점 | 시나리오 | 결정 |
|---|---|---|
| 24h | total < 50 | INSUFFICIENT_SAMPLE_HOLD 유지, 72h 까지 대기 |
| 24h | rate ≥ 60% AND organic > 0 | **GTM_PARKED 확정** → packet archive |
| 24h | rate < 60% | GTM_PREVIEW_CONDITIONAL_RECOMMENDED 로 정정 |
| 24h | paid_only growing organic = 0 | GTM_PREVIEW_RECOMMENDED_FAN_OUT_BIAS — backend audit |
| 72h | final verdict 확정 + packet archive 또는 즉시 실행 분기 | — |

## 4. imweb footer

계속 last resort (parked). GTM 도 보류이면 footer 도 보류.

## 5. approval 상태

- 본 packet 은 verdict + update 규칙만.
- **GTM Production publish 본 sprint 와 다음 sprint 모두 금지**.
- GTM Preview 활성화 (Container Workspace + Custom HTML 테스트) 는 verdict 가 `CONDITIONAL` 이상으로 정정된 시점에 별도 TJ 명시 승인.

## 6. invariants

| invariant | 결과 |
|---|---|
| gtm_production_publish | 0 |
| imweb_footer_edit | 0 |
| external_send_count | 0 |
