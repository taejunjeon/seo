# gpt0515-20 Browser Purchase Diagnostic + CAPI Status

작성 시각: 2026-05-15 16:38 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/report/text-report-template.md
    - docurule.md
  required_context_docs:
    - gptconfirm/gpt0515-19-header-guard-v31-1-code
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only query
    - VM Cloud Meta CAPI send log read-only query
    - diagnostic plan writing
    - gptconfirm package writing
  forbidden_actions:
    - Meta operating Purchase send
    - bulk backfill
    - unguarded browser Purchase fallback
    - VM Cloud deploy/restart
    - 운영DB write/import
    - GTM publish
    - raw order/payment/member/click id output
  source_window_freshness_confidence:
    source: "VM Cloud attribution_ledger + VM Cloud meta-capi-sends.jsonl"
    window: "2026-05-15 12:37-16:37 KST recent 4h"
    site: "biocom"
    freshness: "checked 2026-05-15 16:37:48 KST"
    confidence: "high for CAPI accepted status, medium for Meta UI display timing"
```

## 결론

판정: **CAPI_SENT_SUCCESS_BROWSER_PURCHASE_AUXILIARY**

방금 카드 결제완료로 추적한 11,900원 건은 VM Cloud 결제완료 장부에서 `confirmed`로 닫혔고, Meta CAPI 자동 전송이 `Purchase` 1건을 보냈으며 Meta 응답은 `events_received=1`이었다. 따라서 지금은 같은 주문에 Browser Purchase를 추가로 쏘는 진단을 바로 할 필요가 낮고, Browser Purchase 미표시는 보조 문제로 분리하는 것이 맞다.

## 10초 요약

- VM Cloud 결제완료 장부에서 최신 11,900원 카드 결제 건은 `safe_e551374302`로 확인됐다.
- Meta CAPI 전송 로그에서 같은 건은 2026-05-15 16:28:08 KST에 `auto_sync`로 전송됐고 `events_received=1`을 받았다.
- 최근 4시간 CAPI `Purchase`는 44건 전송, 44건 수신 성공, 실패 0건이다.
- Browser Purchase가 Network/Pixel Helper에서 안 보이는 문제는 남아 있지만, 오늘 밤 매출 누락 복구의 주 경로는 서버 CAPI로 살아 있다.

## 완료한 것

| 항목 | 결과 | 근거 | 데이터 위치 |
|---|---|---|---|
| 최신 결제완료 row 확인 | 완료 | `safe_e551374302`, `payment_status=confirmed`, `payment_success` | VM Cloud SQLite `attribution_ledger` |
| Meta CAPI 전송 여부 확인 | 완료 | `auto_sync`, HTTP 200, `events_received=1` | VM Cloud `meta-capi-sends.jsonl` |
| 최근 4시간 CAPI 상태 확인 | 완료 | 44건 중 44건 수신 성공 | VM Cloud CAPI send log |
| Browser Purchase diagnostic 필요성 판단 | 완료 | CAPI 성공이므로 즉시 실행 비추천 | 본 패키지 |

## 하지 않은 것

| 항목 | 이유 |
|---|---|
| Meta Browser Purchase console send | 같은 주문은 이미 CAPI 성공이라 중복 위험이 있다 |
| Meta 운영 Purchase 추가 send | 이번 범위는 read-only 판정이다 |
| VM Cloud deploy/restart | 승인 범위 밖이고 필요하지 않았다 |
| 운영DB write/import | 금지선 유지 |
| GTM publish / Imweb 코드 추가 저장 | 금지선 유지 |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | VM Cloud SQLite `attribution_ledger`, VM Cloud `meta-capi-sends.jsonl` |
| window | 최근 4시간, 2026-05-15 12:37-16:37 KST |
| freshness | 2026-05-15 16:37:48 KST read-only 확인 |
| site | biocom |
| confidence | CAPI 성공 판정 high, Meta UI 반영 시간 medium |

## 검증 결과

| 검증 | 결과 | 비고 |
|---|---|---|
| 최신 카드 결제건 CAPI match | PASS | safe_ref 기준 1건 match |
| CAPI response | PASS | HTTP 200, `events_received=1` |
| 최근 4시간 CAPI 실패 | PASS | failed/non-1 = 0 |
| raw identifier 출력 | PASS | 문서에는 safe_ref만 기록 |
| 외부 추가 전송 | PASS | 이번 작업에서 send 0 |

## 현재 영향

- Meta가 서버 구매 신호를 받을 수 있는 경로는 살아 있다.
- Browser Purchase는 여전히 보조 진단 대상이다. 다만 같은 주문에 Browser Purchase를 추가로 보내면 중복 위험이 생긴다.
- Meta Events Manager UI는 표시 지연, 필터, 데이터 공유 제한 때문에 CAPI 성공 직후 화면에 바로 보이지 않을 수 있다.

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| Browser Purchase가 계속 안 보임 | 브라우저와 서버 dedup 품질 확인이 늦어진다 | 다음 실제 결제에서 Guard latency와 cache hit를 별도 모니터링 |
| Meta UI 표시 지연 | 화면상 Purchase가 늦게 보일 수 있다 | CAPI log의 `events_received=1`을 1차 근거로 보고, UI는 20-60분 후 재확인 |
| 같은 주문에 추가 Browser diagnostic 실행 | 중복 Purchase 위험 | 지금은 실행하지 않음 |

## 확인하면 좋은 문서

1. `01-capi-status.md` — 방금 결제건이 서버 CAPI로 Meta에 들어갔는지 숫자로 확인할 문서다.
2. `02-browser-purchase-diagnostic-plan.md` — 그래도 Browser Purchase를 따로 시험해야 할 때 어떤 조건에서만 해야 하는지 정리했다.
3. `03-decision-matrix.md` — CAPI 성공/실패와 Browser 성공/실패 조합별 다음 행동을 정리했다.

## 다음 할일

### Codex가 할 일

1. CAPI 모니터링을 계속 읽기 전용으로 확인한다.
- Codex 추천: 진행 추천
- 추천 방향에 대한 자신감: 92%
- Lane: Green
- 의존성: 독립 진행 가능
- 무엇을 하는가: VM Cloud CAPI send log에서 최근 `Purchase` 성공률, `events_received=1`, duplicate 여부를 계속 확인한다.
- 왜 하는가: Browser Purchase가 아직 불안정해도 서버 구매 신호가 안정적으로 들어가면 Meta 구매 누락 리스크가 크게 줄기 때문이다.
- 어떻게 하는가: VM Cloud `meta-capi-sends.jsonl`과 `attribution_ledger`를 read-only로 대조한다.
- 성공 기준: 최근 결제완료 row가 CAPI `auto_sync`로 전송되고 `events_received=1`을 유지한다.
- 실패 시 해석/대응: CAPI match가 끊기면 단건 backfill이 아니라 CAPI candidate gate부터 다시 본다.
- 승인 필요: NO

2. Browser Purchase는 다음 실제 결제에서 관찰만 한다.
- Codex 추천: 조건부 진행
- 추천 방향에 대한 자신감: 75%
- Lane: Green 관찰 / Red 전송
- 의존성: 다음 실제 카드 결제 또는 TJ님 테스트가 있어야 한다.
- 무엇을 하는가: Network/Pixel Helper에서 `ev=Purchase`가 보이는지 확인하되, 같은 주문에 추가 Purchase를 쏘지는 않는다.
- 왜 하는가: 현재 매출 복구는 CAPI가 해냈고, Browser Purchase를 무리하게 추가하면 중복 위험이 있기 때문이다.
- 어떻게 하는가: 완료 페이지에서 Network와 sessionStorage guard cache를 확인한다.
- 성공 기준: Browser `Purchase`가 보이거나, 보이지 않아도 CAPI가 성공하면 운영 누락은 없음으로 분리한다.
- 실패 시 해석/대응: Browser만 실패하면 Header Guard/Pixel wrapper 문제로 분리하고, 서버 CAPI는 유지한다.
- 승인 필요: 관찰은 NO, 실제 Browser Purchase diagnostic send는 YES

### TJ님이 할 일

1. 지금 같은 주문에 console Purchase diagnostic은 실행하지 않는다.
- Codex 추천: 진행 비추천
- 추천 방향에 대한 자신감: 90%
- Lane: Red
- 의존성: 이미 CAPI가 성공한 같은 결제건이라 중복 위험이 있다.
- 무엇을 하는가: 같은 11,900원 주문에 브라우저 콘솔로 `Purchase`를 추가 전송하지 않는다.
- 왜 하는가: Meta가 이미 CAPI로 받은 주문에 Browser Purchase까지 새로 들어가면 중복 또는 데이터 해석 혼선이 생길 수 있다.
- 어떻게 하는가: Meta UI 확인은 20-60분 뒤로 미루고, 현재는 CAPI 로그를 신뢰한다.
- 성공 기준: Meta CAPI 로그 기준 `events_received=1` 유지, 추가 전송 0.
- 실패 시 해석/대응: Meta UI가 계속 0으로 보이면 UI 필터/데이터 공유 제한/표시 지연을 먼저 확인한다.
- Codex가 대신 못 하는 이유: Meta UI 화면은 TJ님 계정 브라우저 권한과 표시 필터 영향을 받는다.
- 승인 필요: 추가 Browser Purchase send를 하려면 별도 Red 승인 필요
