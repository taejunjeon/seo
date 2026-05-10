# Path B canary verdict 정정 — NO_TRAFFIC → PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW

작성 시각: 2026-05-11 00:23:00 KST
정정 사유: 사용자가 imweb 어드민 스크린샷으로 canary 윈도우 내 실주문 5건을 제시. Claude Code의 직전 NO_TRAFFIC verdict가 잘못된 추정.
자신감: 95%

## 한 줄 결론

**“canary 1h 동안 ledger row 0”의 진짜 원인은 트래픽이 없는 게 아니라, imweb 결제 flow에서 Path B no-send endpoint를 호출하는 wiring이 부재한 것**이오. 결제 5건은 모두 발생했고 `/api/attribution/payment-success`는 정상 호출됐지만, `/api/attribution/order-bridge/identity-hmac/no-send`는 본 윈도우 0건 호출이라 ledger가 누적될 수 없었소. 정정 verdict는 `PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW`.

## 1. 사용자가 보여준 결정적 증거 (imweb 어드민)

| order_no_tail | 시각 (KST) | 결제수단 | 상태 | 금액 |
|---|---|---|---|---|
| ...6214 | 23:46 | NAVERPAY_ORDER | 입금 대기 | ₩35,000 |
| ...7423 | 23:23 | 신용카드 | 배송 대기 | ₩193,000 |
| ...5292 | 23:22 | 신용카드 | 배송 대기 | ₩459,000 |
| ...6482 | 23:19 | 신용카드 | 배송 대기 | ₩102,910 |
| ...5597 | 23:06 | 신용카드 | 배송 대기 | ₩245,000 |

5건 모두 canary 윈도우(2026-05-10 23:03~24:03 KST) 내 발생.

## 2. 운영 PG는 왜 0건이었나

운영 PG `tb_iamweb_users`의 `MAX(order_date)` = **2026-05-10 15:22:15 KST** (audit 시점 PG NOW = 2026-05-11 00:15:07 KST). 즉 **PG sync가 약 9시간 지연**되어 5건이 아직 PG에 안 들어왔소. 직전 sprint 보고된 `source_lag_hours=3.1`보다 크게 늘어난 상태.

→ 본 sprint NPay 30d 측정 209건 / ₩37,638,900은 **PG sync 기준이며, imweb 자체 DB 기준은 더 클 수 있다**는 caveat을 다음 sprint dashboard 카드에 노출 권장.

## 3. VM backend access log (canary 14:03~15:03 UTC = 23:03~24:03 KST)

| endpoint | 본 윈도우 호출 수 | 누적 |
|---|---|---|
| `POST /api/attribution/payment-success` | 4건 이상 (23:25, 23:26, 24:02:27, 24:02:32 KST 직접 확인) | 정상 누적 |
| `POST /api/attribution/paid-click-intent/no-send` | (receiver) | **8,306** (전체 누적, 정상 동작) |
| **`POST /api/attribution/order-bridge/identity-hmac/no-send`** | **0** (윈도우 내) | 41 (Tag Assistant/canary 테스트 합산) |
| `order_bridge_ledger` 저장 | **0** | 4 (직전 evidence) |

## 4. 진짜 root cause

| 가능성 | 확인 |
|---|---|
| 트래픽 없음 (NO_TRAFFIC) | ❌ — imweb admin에 5건 확인 |
| payment-success endpoint 미도달 | ❌ — 본 윈도우 호출 4건+ 확인 |
| paid_click_intent receiver 미동작 | ❌ — 정상 누적 |
| **Path B endpoint 호출 자체가 0** | ✅ — 본 sprint canary 윈도우 0건 |
| backend write 분기 차단 | ❌ — write_flag_on=true 였음 |

→ **funnel-capi v3 또는 imweb footer 코드에 Path B no-send endpoint 호출 wiring이 부재 또는 비활성**.

## 5. 직전 NO_TRAFFIC 추정이 잘못된 이유

- ledger summary delta만 보고 “트래픽 0”으로 inference.
- backend access log / payment-success endpoint 호출 수 / paid_click_intent receiver 누적 / imweb admin 결제 카운트를 같이 보지 않음.
- 야간 시간대 추정에 기댄 것도 무리한 가정이었소.

다음 canary부터 적용할 검증 절차:
1. ledger summary delta
2. backend access log에서 Path B endpoint 호출 수
3. payment-success/paid_click_intent endpoint 호출 수
4. imweb admin 또는 PG fresh order count
넷 다 동시 확인 후 verdict 결정.

## 6. 정정 후 다음 액션 (3 옵션)

### R1. imweb footer/funnel-capi v3에 Path B endpoint 호출 코드 추가
- Lane: Yellow (imweb production code 변경)
- 무엇: 결제완료 시점에 hash-only payload로 Path B no-send endpoint 호출하는 코드 추가
- Claude Code 대체 가능 여부: NO
- TJ 액션: imweb 어드민 footer 수정 또는 GTM Preview 추가

### R2. VM backend payment-success → order_bridge_ledger 자동 기록 분기 (Claude Code 추천)
- Lane: Yellow code (코드 patch + fixture는 Claude Code가 가능, deploy는 TJ Yellow)
- 무엇: `payment-success` 핸들러 안에서 hashed identity material을 만들고 `recordOrderBridgeLedger` 호출
- 효과: imweb footer 변경 없이도 ledger 자동 누적 시작
- 자신감: 84%
- 의존성: payment-success 핸들러 input 구조 audit (다음 sprint 첫 작업)

### R3. controlled traffic injection
- Lane: Yellow (TJ Tag Assistant 1회)
- 무엇: 단일 테스트 결제로 ledger +1 확인
- Claude Code 대체 가능 여부: NO

추천: **R2** (backend code patch가 가장 안전하고 Claude Code가 단일 commit으로 끝낼 수 있음).

## 7. NPay snapshot caveat 추가

- 현재 PG NPay 30d count = 209
- imweb 자체 DB 기준은 sync lag(~9h)로 더 클 가능성
- 다음 sprint dashboard 카드에 `max(order_date) freshness` 라벨 추가 권장
- internal ROAS 보정값 1.86은 PG sync 기준 추정이며, imweb 기준 실제 값과 약간 차이 가능

## 7-1. 4-signal canary verdict decision tree (gpt0508-37 강화)

다음 canary부터는 **반드시 5신호를 같이 본 뒤** verdict를 결정한다. ledger row delta 단독 판정 금지.

| # | 신호 | 출처 | 의미 |
|---|---|---|---|
| 1 | **ledger delta** | `GET /api/attribution/order-bridge/ledger/summary` row_count diff | Path B 자체 누적 |
| 2 | **Path B endpoint call** | VM backend log `order-bridge/identity-hmac/no-send` POST 수 | 결제 flow가 endpoint 호출했는지 |
| 3 | **payment-success call** | VM backend log `attribution/payment-success` POST 수 | 결제완료 신호 자체 도달 여부 |
| 4 | **paid_click_intent receiver** | VM backend log `paid-click-intent` receiver 누적 | 광고 클릭 신호 정상 누적 여부 |
| 5 | **운영 fresh order count** | imweb 어드민 또는 운영DB `MAX(order_date)` + 운영DB count delta (sync lag 감안) | 실주문 발생 여부 |

### Decision tree (간단 버전)

```
신호3 == 0?
  YES → BACKEND_NOT_RECEIVING → backend health/Cloudflare Tunnel/CORS 점검
  NO → 신호5 == 0?
    YES & 신호3 > 0 → DATA_INCONSISTENT → payment-success는 받는데 imweb/운영DB에 주문 없음 (사기/스팸/로그 노이즈 의심)
    NO → 신호4 == 0?
      YES → PAID_CLICK_INTENT_BROKEN → click intent 수집 자체 부재
      NO → 신호2 == 0?
        YES → PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW (이번 sprint verdict)
        NO → 신호1 == 0?
          YES → LEDGER_WRITE_REJECTED → write_flag/canary_until/dedupe/raw_logging 등 reject 원인 점검
          NO → CANARY_COMPLETE_PASS
```

### Verdict 카테고리 명칭표

| verdict | 정의 | 다음 행동 |
|---|---|---|
| `BACKEND_NOT_RECEIVING` | payment-success 자체 0건 (운영 결제는 발생 중) | tunnel/CORS/backend health |
| `DATA_INCONSISTENT` | payment-success는 받는데 운영 주문 0건 | 봇/스팸/로그 노이즈 audit |
| `PAID_CLICK_INTENT_BROKEN` | paid_click_intent receiver 누적 멈춤 | landing intent capture 코드 점검 |
| **`PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW`** | payment-success는 받는데 order-bridge endpoint 호출 0 | **R2 backend wire (gpt0508-37 작업4)** 또는 GTM/footer fallback |
| `LEDGER_WRITE_REJECTED` | endpoint 호출됐는데 ledger 저장 0 | write_flag/canary_until/dedupe/raw_logging 점검 |
| `CANARY_COMPLETE_PASS` | 모두 정상 | 다음 sprint ledger lookup wire 진입 |
| `CANARY_COMPLETE_FAIL` | raw_stored>0 또는 platform_send>0 | 즉시 rollback + 사후 분석 |
| `NO_TRAFFIC` (사용 금지) | — | 신호 5신호 다 본 뒤에도 운영 주문이 진짜 0이면 그때 사용 |

`NO_TRAFFIC`은 단독 ledger row=0 만으로 단정하지 않는다. 신호 3·5 둘 다 0인 경우에만 합리적이고, 그조차 시간대 추정이 아니라 imweb 어드민 또는 운영DB 직접 확인 후 결정.

## 8. Verdict chain (audit trail)

| sprint | verdict | 비고 |
|---|---|---|
| gpt0508-35 작업1 (canary 시작 전) | EXECUTION_HALTED_BLOCKED_ACCESS_TJ_VM_TOGGLE_REQUIRED | VM admin 권한 부재로 STOP |
| gpt0508-35 후속 (canary 직접 실행) | execution OK | VM SSH로 직접 toggle |
| gpt0508-36 작업6 초안 | CANARY_COMPLETE_NO_TRAFFIC | **잘못된 inference** |
| **gpt0508-36 작업6 정정 (본 문서)** | **PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW** | 사용자 imweb admin 스크린샷으로 정정 |

## 9. 다음 할일

### Claude Code가 할 일

1. (다음 sprint 첫 작업) payment-success 핸들러 input 구조 audit + R2 backend wire 코드 patch + fixture
   - 추천: 진행 추천
   - 자신감: 84%
   - Lane: Green code (deploy는 별도 Yellow)
   - 의존성: 본 sprint 정정 산출물 push 후

### TJ님이 할 일

1. (선택) Tag Assistant 1회 controlled injection으로 R2 wire 검증 가속
   - 추천: 선택사항
   - 자신감: 88%

## 10. Verdict (정정)

`PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW`

산출 JSON: `data/path-b-canary-verdict-correction-20260511.json`
정정 대상: `data/path-b-order-bridge-canary-post-audit-20260511.json` (NO_TRAFFIC verdict)
