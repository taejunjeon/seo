# Click Evidence Closure — next action decision (gpt0508-40 작업7)

작성 시각: 2026-05-11 14:10:00 KST
자신감: 75%

## 5줄 결론

1. helper layer (enricher / bridge / injector) 는 모두 PASS — 분류 5 카테고리 + dry-run 11 row 분포 (A 2 / paid_no_click 6 / unpaid 3) 까지 검증.
2. 실측 신호 (peak canary click_id_hash_present_rate) 가 빠져 있어 wire route + GTM ramp 단계는 보류.
3. 다음 sprint 의 가장 우선 분기는 작업 6 peak canary 실측 결과의 threshold (≥0.50 / 0.10~0.50 / <0.10).
4. 실측이 0.10 미만이면 wire 단계 진입 전에 footer payment-success body 캡처 보강 + funnel-capi v3 의 click_id forward 점검을 먼저.
5. 본 sprint 의 commit 은 helper + script + plan 까지. live 측정 + route wire 는 다음 sprint 의 별도 approval.

## 1. 현재 상태 종합

| 영역 | 상태 | 산출 |
|---|---|---|
| audit | MIXED — 매핑 버그 0, sprint canary 9 row paid_intent 0 매칭 | `click-evidence-capture-gap-audit-20260511` |
| enricher | PASS — fixture 5/5 | `confirmed-purchase-builder-ledger-lookup-wire-20260511` |
| bridge | PASS — fixture 4/4 | `paid-click-intent-same-session-bridge-20260511` |
| injector | PASS — fixture 6/6 | `click-view-candidates-inject-automation-20260511` |
| dry-run v2 | PASS — 11 row 3 카테고리 분포 | `builder-dry-run-v2-20260511` |
| peak canary | plan only — TJ traffic 협조 대기 | `peak-canary-click-material-rate-plan-20260511` |

## 2. 다음 sprint 분기 결정 트리

### 분기 A: click_id_hash_present_rate ≥ 0.50

→ click 캡처 흐름 자체는 정상. wire 단계 진입:
1. confirmed-purchase no-send route 를 async 로 변경 + enricher 호출 wire (작업 2 결과의 보류 사항).
2. cross_reference_evidence 의 ledger_lookup 분기를 dashboard 에 노출.
3. GTM/footer 변경 없이도 budget 신뢰 충분 → ROAS prep table 의 ledger 의존 단계로 진입.

### 분기 B: click_id_hash_present_rate 0.10~0.50

→ click 캡처 일부 손실. wire 보류 + 손실 지점 진단:
1. payment-success body 안에 `gclid` / `gbraid` 등 field 가 들어오는지 footer/biocomimwebcode.md Block 3 의 tracking.gclid mapping 검토.
2. funnel-capi v3 의 click_id forward chain 점검 (`__seo_funnel_session` ↔ `_p1s1a_last_touch` ↔ payment-success POST body).
3. 광고 트래픽이 다른 origin redirect 로 sessionStorage 손실되는지 LIVE_TAG_INVENTORY snapshot 갱신.

### 분기 C: click_id_hash_present_rate < 0.10

→ 광고 클릭이 ledger 에 거의 도달하지 않음. 더 큰 reconciliation 필요:
1. Google Ads click_view 30d snapshot 의 click 수 vs paid_click_intent_ledger 의 click 수 비교 (광고 클릭 인지율).
2. attribution endpoint (`att.ainativeos.net`) cookie/CORS 정책 점검 — checkout 단계에서 차단되는 케이스 분석.
3. 본 분기는 wire 보류 + 별도 root-cause sprint 필요.

## 3. 본 sprint 가 안전하게 commit 가능한 단위

- backend/src 의 3 신규 helper + 1 dry-run script + 1 peak canary script
- backend/tests 3 신규 fixture (총 15 test)
- data/ + gdn/ 의 7 산출 문서

## 4. 다음 액션

### Claude Code가 할 일

1. 작업 8: gptconfirm/gpt0508-40 패키지 + manifest + commit/push.
2. 본 sprint 종료 후 TJ traffic 합의 시점에 peak canary script 실행.

### TJ님이 할 일

1. 본 sprint 산출 7 문서 + 5 helper 의 lane 확인 + commit/push approval.
2. peak canary 측정 window 슬롯 (11~12 또는 19~20) 선택.

## 5. Verdict

`HELPER_LAYER_PASS_LIVE_MEASUREMENT_AWAITS_TJ_TRAFFIC`
