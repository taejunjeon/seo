# R2 capture / retention / max_rows approval options (gpt0508-39 작업7)

작성 시각: 2026-05-11 10:45:00 KST
Lane: Green packet 작성. 실제 실행 0.
자신감: 92% (옵션 1 추천), 78% (옵션 2), 65% (옵션 3)

## 한 줄 결론

R2 canary가 반복 PASS하니 “1h 수동 → 자동 정기 → 7일 always-on” 3가지 진화 옵션을 비교 가능 packet으로 박아 두오. **본 sprint·다음 sprint까지는 옵션 1(현상 유지)이 합리적**이고, 다음 sprint cross_reference wire가 PASS + paid_order_click_exact 후보 1+ 측정될 때 옵션 2 진입을 결정하면 되오.

## 옵션 비교 표

| 옵션 | 진화 단계 | Lane | row volume/week | 위험 | rollback | 추천 자신감 |
|---|---|---|---|---|---|---|
| **1. 현상 유지** | 수동 1h canary 반복 | Green | 14~140 | 0 | n/a | **92%** |
| 2. 제한 운영 | KST 11~13 2h/day 자동 + max_rows 500 | Yellow | 200~1400 | VM cron 설정 변경, 일부 row 누락 | cron 비활성 + max_rows 복귀 | 78% |
| 3. 적극 운영 | 7일 always-on + max_rows 2000 + retention 정책 | Yellow + Red 요소 | 700~3500 | 정책 변경 폭, retention rotation 필요 | 즉시 disable + max_rows 복귀 | 65% |

## 옵션 1 — 현상 유지 (현재 추천)

| 항목 | 값 |
|---|---|
| 변경 | 없음 |
| ORDER_BRIDGE_WRITE_MAX_ROWS | 200 유지 |
| 사용 시나리오 | 매 sprint 또는 TJ 결정 시점 1h canary 실행 |
| 장점 | 위험 0, rollback 자동, 코드 변경 0 |
| 위험 | row 누적 속도 느림 (1h당 2~20) |

추천 이유: cross_reference wire 검증은 옵션 1 row만으로도 가능. 다음 sprint까지는 진화 불필요.

## 옵션 2 — KST 주간 2h/day 자동 canary (다음 단계)

| 항목 | 값 |
|---|---|
| 변경 | VM cron으로 매일 KST 11:00 시작 ORDER_BRIDGE_WRITE_ENABLED=true 2h |
| ORDER_BRIDGE_WRITE_MAX_ROWS | 500 |
| 사용 시나리오 | 정기 누적, 사람 개입 없이 click_id_hash 보유 row 비율 ↑ |
| 진입 트리거 | 다음 sprint cross_reference wire PASS + paid_order_click_exact 후보 1+ 측정 시 |
| Rollback | cron 비활성 + max_rows=200 복귀 |

승인 문구:
```
[승인] gpt0508-NN R2 자동 canary 옵션 2: VM cron KST 11~13 2h/day,
ORDER_BRIDGE_WRITE_ENABLED=true 윈도우 안에서만,
ORDER_BRIDGE_WRITE_MAX_ROWS=500, retention 90일 유지,
raw/send/upload 0 유지, rollback cron 비활성 + max_rows 복귀.
```

## 옵션 3 — 7일 always-on (보류 권장)

| 항목 | 값 |
|---|---|
| 변경 | ORDER_BRIDGE_WRITE_ENABLED=true 7일 always-on |
| ORDER_BRIDGE_WRITE_MAX_ROWS | 2000 |
| retention rotation | 7/30/90일 정책 추가 필요 |
| 자동 종료 게이트 | 7일 후 토글 cron 또는 scheduled job |
| 진입 트리거 | 옵션 2 1~2주 PASS + retention 검증 통과 + dashboard freshness 라이브 확인 후 |

추천 보류 — wire가 검증되지 않은 상태에서 데이터 양 증가는 가치보다 위험이 큼.

승인 문구:
```
[승인] gpt0508-NN R2 자동 canary 옵션 3: 7일 always-on,
ORDER_BRIDGE_WRITE_MAX_ROWS=2000,
retention rotation 정책 추가,
자동 종료 게이트 7일 후 토글,
raw/send/upload 0 유지,
rollback ORDER_BRIDGE_WRITE_ENABLED=false 즉시 + max_rows 복귀.
```

## 본 sprint 외 진입 결정 트리

```
다음 sprint cross_reference wire PASS?
  YES → paid_order_click_exact 후보 1+ ?
    YES → 옵션 2 승인 packet 진입 (Yellow)
    NO → 옵션 1 유지, click_id_hash 보유 row 추가 누적 필요
  NO → 옵션 1 유지, wire 디버깅 우선
옵션 2가 1~2주 PASS + retention rotation 검증 통과?
  YES → 옵션 3 별도 승인 검토
  NO → 옵션 2 안정화 우선
```

## 본 sprint 결정

| 항목 | 값 |
|---|---|
| 본 sprint 실행 | 0 (옵션 1 유지, 작업6 단발 1h canary 만) |
| 다음 sprint 자동 진입 | 없음 — TJ 또는 Claude Code가 트리거 평가 후 결정 |

## Verdict

`OPTIONS_LOCKED_OPTION_1_RECOMMENDED_FOR_NOW`

산출 JSON: `data/r2-capture-retention-maxrows-approval-options-20260511.json`
