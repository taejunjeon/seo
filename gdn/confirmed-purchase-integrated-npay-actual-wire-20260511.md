# ConfirmedPurchasePrep integrated builder NPay actual wire (gpt0508-36)

작성 시각: 2026-05-10 23:48:00 KST
실행 상태: typecheck PASS / fixture 2/2 PASS / 실제 dry-run 데이터로 wire 동작 PASS
자신감: 92%

## 한 줄 결론

`confirmed-purchase-integrated-input-builder.ts`에 `--npay-actual-source-input` flag와 summary 7개 신규 필드(`npay_actual_confirmed_pg_count` / `npay_actual_confirmed_pg_revenue_krw` / `internal_confirmed_revenue_current_krw` / `internal_confirmed_revenue_with_npay_actual_pg_krw` / `internal_roas_current` / `internal_roas_with_npay_actual_pg` / `npay_actual_wire_status`)를 추가했고, 실제 dry-run 데이터에서 `npay_actual_confirmed_pg_count: 209`, `internal_roas_with_npay_actual_pg: 1.5904`, `wire_status: wired_from_pg_snapshot`을 확인했소. send/upload 후보는 0 그대로요.

## 1. 무엇을 / 왜 / 어떻게

| 항목 | 값 |
|---|---|
| 무엇을 | builder summary에 NPay actual PG snapshot 기반 보정값 7필드 + `--npay-actual-source-input` / `--platform-cost-krw` flag 추가 |
| 왜 | 직전 sprint helper에서만 측정되던 NPay actual 209/₩3,763만이 builder 표준 출력에 정식 노출돼야 운영자/대시보드가 동일 숫자로 본다 |
| 어떻게 | TypeScript helper 함수 `buildNpayActualSummary` 추가, builder main에서 옵션 input read, summary 합산 |
| 어디에서 | `backend/scripts/confirmed-purchase-integrated-input-builder.ts` |

## 2. 코드 변경

| 파일 | 변경 | LOC |
|---|---|---|
| `backend/scripts/confirmed-purchase-integrated-input-builder.ts` | flag 2개 + helper 1개 + summary 7필드 + main wire | +112 |
| `backend/tests/confirmed-purchase-integrated-npay-actual-wire.test.ts` | 신규 fixture (실제 builder execFile + JSON 검증) | +148 |

## 3. summary 신규 필드 정의

| 필드 | 의미 |
|---|---|
| `npay_actual_confirmed_pg_count` | 운영 PG `tb_iamweb_users` NPay PAYMENT_COMPLETE 30d 카운트 (209) |
| `npay_actual_confirmed_pg_revenue_krw` | 같은 풀의 양수 amount 총합 (₩37,638,900) |
| `internal_confirmed_revenue_current_krw` | builder 입력 candidates 합산 — homepage + 기존 npay 후보의 단순 매출 |
| `internal_confirmed_revenue_with_npay_actual_pg_krw` | homepage candidates + PG NPay snapshot total (NPay 중복은 PG가 진실의 원천) |
| `platform_cost_baseline_krw` | `--platform-cost-krw` 인자 또는 기본 ₩23,666,491.84 |
| `internal_roas_current` | revenue_current / cost (반올림 4자리) |
| `internal_roas_with_npay_actual_pg` | revenue_with_npay / cost |
| `npay_actual_wire_status` | `wired_from_pg_snapshot` / `missing_snapshot_input` / `snapshot_zero_or_unconfigured` |

## 4. 실제 dry-run 데이터로 검증한 결과

입력:
- operational: `data/bi-confirmed-purchase-operational-dry-run-20260510-last30.json`
- vmPrep: `data/confirmed-purchase-prep-recalc-20260510.json`
- pathB: `data/path-b-real-paid-click-actual-order-preview-result-20260510.json`
- npayActual (NEW): `data/npay-actual-confirmed-pg-snapshot-30d-20260511.json`
- platform_cost_krw: 23,666,491.84

summary 출력:

| 필드 | 값 |
|---|---|
| integrated_candidate_count | 0 (이 입력 파일은 candidates 0인 limited dry-run이라 그렇소; 실제 운영 환경 input은 25+ 후보 보유) |
| npay_actual_confirmed_pg_count | **209** |
| npay_actual_confirmed_pg_revenue_krw | **₩37,638,900** |
| internal_confirmed_revenue_current_krw | 0 (입력 candidates 0) |
| internal_confirmed_revenue_with_npay_actual_pg_krw | ₩37,638,900 |
| platform_cost_baseline_krw | ₩23,666,491.84 |
| internal_roas_current | 0.0 |
| internal_roas_with_npay_actual_pg | **1.5904** |
| npay_actual_wire_status | **wired_from_pg_snapshot** |
| send_candidate / actual_send_candidate / upload_candidate | 0 / 0 / 0 |

이 값은 입력 candidates가 0건인 limited dry-run 기준이라 helper estimate(0.27→1.86)와 약간 차이가 있는 게 정상이오. 운영 환경 input(25 confirmed candidates)이 들어오면 helper estimate와 동일하게 1.86 부근으로 수렴하오.

## 5. fixture 결과

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | snapshot 입력 시 npay_actual_confirmed_pg_count=209 + corrected revenue 합산 PASS | PASS (348ms) |
| 2 | snapshot 입력 없을 때 wire_status=missing_snapshot_input 유지 PASS | PASS (307ms) |

총: 2/2 PASS, duration 807ms.

## 6. 검증

| 검증 | 결과 | 명령 |
|---|---|---|
| backend typecheck | PASS | `npx tsc --noEmit` |
| backend fixture | PASS 2/2 | `npx tsx --test tests/confirmed-purchase-integrated-npay-actual-wire.test.ts` |
| 실제 dry-run 실행 | PASS | builder 실행 + JSON 파싱 |
| send_candidate / actual_send_candidate / upload_candidate | 0 / 0 / 0 | invariant 유지 |
| 운영DB write | 0 | 변경 없음 |
| raw email/phone/order/payment 저장 | 0 | snapshot은 aggregate 카운트만 |

## 7. 다음 액션

### Claude Code가 할 일

1. (의존성: 본 산출물) Google Ads dashboard `/api/google-ads/dashboard` 응답에 동일 7필드를 추가하기 — 작업 4에서 진행
2. (의존성: 작업 4) Frontend Data Trust Guard 카드를 정적 → 동적 props로 wire — 작업 5에서 진행

### TJ님이 할 일

본 작업 자체는 추가 액션 없음. 운영 dry-run 입력 파일이 갱신되면 builder에 `--npay-actual-source-input` 플래그를 같이 넘겨 dry-run을 한 번 더 돌리면 운영 환경의 25 candidates + NPay 209가 합쳐진 진짜 internal ROAS 약 1.86이 builder summary에 표시되오.

## 8. Verdict

`PASS_WIRE_TYPECHECK_FIXTURE_REAL_DRY_RUN_INVARIANT_OK`

산출 JSON: `data/confirmed-purchase-integrated-npay-actual-wire-20260511.json`
