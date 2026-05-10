# Path B order_bridge 1h canary post-audit (gpt0508-36)

작성 시각: 2026-05-11 00:05:00 KST
실행 상태: **CANARY_COMPLETE_NO_TRAFFIC** — 안전선 PASS / row 0건 누적
자신감: 95% (snapshot 직접 확인 + .env 원복 직접 확인)

## 한 줄 결론

승인된 1시간 canary를 끝까지 돌렸고, **raw 저장 0 / platform send 0 / write_flag_on 자동 복귀**까지 모든 안전선이 통과했소. 다만 1시간 동안 Path B endpoint로 들어오는 ledger write 요청이 **0건**이라 row_count는 4 그대로요. verdict는 `NO_TRAFFIC`이며, 다음에는 주간 트래픽 시간대 또는 controlled traffic injection으로 다시 1h 돌리면 누적이 시작되오.

## Verdict 정의

| verdict | 조건 |
|---|---|
| CANARY_COMPLETE_PASS | row_count 증가 ≥ 1 + raw_stored 0 + platform_send 0 |
| CANARY_COMPLETE_FAIL | raw_stored > 0 또는 platform_send > 0 |
| **CANARY_COMPLETE_NO_TRAFFIC (이번 sprint)** | row_count 증가 0 + raw_stored 0 + platform_send 0 + .env 자동 원복 PASS |
| ACCESS_BLOCKED | VM SSH 접근 불가 |

## 1. 타임라인 (KST)

| 시각 | 이벤트 |
|---|---|
| 23:03:03 | canary 시작 — `ORDER_BRIDGE_WRITE_ENABLED=true` + `CANARY_UNTIL=2026-05-10T15:03:03Z` + pm2 restart |
| 23:43:30 | mid 40분 — row 4 / write_flag_on true |
| 23:56:23 | mid 53분 — row 4 (변화 없음) |
| 24:03:03 | backend 코드 cutoff (`canary_window_closed` reject 시작) |
| 24:03:56 | VM nohup 스케줄러 .env 원복 시작 |
| 24:04:03 | pm2 restart 후 write_flag_on false 확인 |
| 24:04:21 | Claude Code post-audit fetch 완료 |

## 2. 스냅샷 비교

| 시점 | row_count | raw_stored | platform_send | write_flag_on |
|---|---|---|---|---|
| 시작 (23:03) | 4 | 0 | 0 | true |
| 중간 (23:56) | 4 | 0 | 0 | true |
| 원복 직전 (24:03:56) | 4 | 0 | 0 | true |
| 원복 직후 (24:04:03) | 4 | 0 | 0 | **false** |
| 최종 audit (24:04:21) | 4 | 0 | 0 | false |

delta:
- row_count Δ = **0** (1h 동안 신규 ledger write 0건)
- raw_stored Δ = 0
- platform_send Δ = 0
- write_flag_on : true → false (자동 복귀 OK)

## 3. 환경변수 원복 확인

| 키 | 값 |
|---|---|
| `ORDER_BRIDGE_WRITE_ENABLED` | **false** (복귀 PASS) |
| `ORDER_BRIDGE_WRITE_CANARY_UNTIL` | empty (복귀 PASS) |
| `ORDER_BRIDGE_WRITE_MAX_ROWS` | 200 |
| `ORDER_BRIDGE_PLATFORM_SEND_ENABLED` | false |
| `ORDER_BRIDGE_RAW_BODY_LOGGING` | false |
| `ORDER_BRIDGE_RETENTION_DAYS` | 90 |
| `ORDER_BRIDGE_IDENTITY_HASH_SECRET` | set |

## 4. NO_TRAFFIC 원인 후보

1. **야간 트래픽 0건**: 23:03~24:03 KST는 결제 트래픽이 매우 낮은 시간대. 결제완료 자체가 0건이었을 가능성이 가장 큼.
2. **dedupe 거부**: 결제완료 endpoint가 호출됐어도 `buildDedupeKey` 충돌로 신규 row 생성 안 함. (현재 ledger 4건 중 `unique_order_no_hash`도 4라 dedupe 충돌 가능성은 낮음.)
3. **Path B no-send endpoint 미호출**: funnel-capi v3 또는 frontend가 결제완료 시점에 Path B endpoint를 호출하지 않았을 가능성. 본 sprint는 endpoint 호출 로그까지 들어가지 않음.

## 5. 안전선 PASS 근거

- backend 코드의 `ORDER_BRIDGE_WRITE_CANARY_UNTIL` 자동 cutoff가 24:03:03 KST에 정확히 발동 (이중 안전망)
- VM nohup 스케줄러(PID 555001)가 sleep 3570 후 정상 동작 — `.env` 원복 + pm2 restart + post snapshot 저장
- raw 저장 0 / platform send 0 invariant 1h 내내 유지
- write_flag_on 자동 복귀 PASS

## 6. NPay rail Stage 2(schema canary) 영향

- ledger row 누적이 0이라 channel_order_no_hash 매칭 효과를 검증할 baseline이 없소.
- Stage 2 schema canary는 row가 ≥ 1 누적된 후 진입하는 게 합리적.
- 따라서 본 sprint도 Stage 2는 **STILL_PENDING** 유지.

## 7. 다음 액션

### TJ님이 할 일

1. **주간 트래픽 시간대(KST 11~12시 또는 19~20시) 1h canary 재실행** (가장 우선)
   - Claude Code 추천: 진행 추천 / 자신감 88%
   - Lane: Yellow (이미 승인된 invariant 재사용)
   - 무엇을: VM SSH 1줄 → `ORDER_BRIDGE_WRITE_ENABLED=true` + `CANARY_UNTIL=<+1h ISO>` + pm2 restart + nohup 자동 원복 스케줄러
   - 명령어 예시는 `gdn/path-b-order-bridge-1h-canary-result-20260511.md` 5절에 박혀 있음
   - 성공 기준: row_count 증가 ≥ 1, raw 0, send 0
   - 실패 시 해석: row 증가했는데 raw>0 또는 send>0이면 즉시 rollback
   - Claude Code 대체 가능 여부: NO (VM toggle 자격증명 부재)

2. **(선택) Tag Assistant 또는 GTM Preview로 테스트 결제 1건 controlled injection**
   - Lane: Yellow
   - 효과: 야간이라도 ledger row 1건 누적 가능
   - Claude Code 대체 가능 여부: NO (브라우저 UI 액션)

### Claude Code가 할 일

1. **(독립 가능) 백엔드 access log read-only로 결제완료 시점 Path B endpoint 호출 수 확인**
   - 추천: 진행 추천 / 자신감 78%
   - Lane: Green (VM SSH read-only 가능)
   - 무엇을: `pm2 logs seo-backend` 또는 backend log 파일에서 `POST /api/attribution/order-bridge/identity-hmac/no-send` 호출 수와 dedupe rejection 비율 조회
   - 의존성: 본 sprint 또는 다음 sprint 시점 자유 진입 가능
   - 다른 에이전트 검증: 불필요

2. **(의존성: TJ 작업 1번 PASS) ledger lookup wire** — gpt0508-35 후속 patch 그대로 wire 가능

## 8. Verdict

`CANARY_COMPLETE_NO_TRAFFIC`

산출 JSON: `data/path-b-order-bridge-canary-post-audit-20260511.json`
