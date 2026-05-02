# NPay Recovery Autonomy Policy

작성 시각: 2026-05-02 01:15 KST
상태: v0 auto-run 기준
목적: 바이오컴 NPay Recovery Harness에서 agent가 TJ님에게 묻지 않고 진행할 수 있는 read-only/dry-run 범위를 고정한다
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/RULES|Rules]], [[harness/npay-recovery/APPROVAL_GATES|Approval Gates]], [[harness/npay-recovery/VERIFY|Verify]], [[harness/npay-recovery/AUDITOR_CHECKLIST|Auditor Checklist]]

## 10초 요약

agent는 L0-L3 범위의 read-only, dry-run, payload preview, approval draft를 TJ님 승인 없이 끝까지 진행한다.

멈추는 지점은 실제 write, send, publish, deploy, live click뿐이다. 후보가 생기면 전송하지 않고 승인안까지 만든 뒤, TJ님이 YES/NO로 답할 수 있는 최종 결정 1개만 올린다.

## Autonomous Run Envelope

| Level | 작업 | TJ님 승인 | 기본 처리 |
|---|---|---|---|
| L0 | 문서 읽기, 정책 문서 수정, 리포트 작성 | 불필요 | 진행 |
| L1 | 운영 DB read-only SELECT, VM SQLite read-only SELECT, BigQuery read-only query, GTM read-only 조회 | 불필요 | 진행 |
| L2 | NPay recovery dry-run, intent/order 매칭, A/B/ambiguous 분류, BigQuery guard 반영 | 불필요 | 진행 |
| L3 | payload preview, approval draft, eval log, auditor report 작성 | 불필요 | 진행 |
| L4 | local DB actual import/apply, 운영 DB INSERT/UPDATE/DELETE, `match_status` 업데이트 | 필요 | 중지 |
| L5 | GTM workspace 생성/수정/publish, Imweb header/footer live 삽입, backend deploy, 운영 endpoint 추가/변경 | 필요 | 중지 |
| L6 | GA4 Measurement Protocol 전송 또는 debug/collect 호출 | 필요 | 중지 |
| L7 | Meta CAPI, TikTok Events API, Google Ads conversion 전송 | 필요 | 중지 |
| L8 | NPay 버튼 실클릭, 결제 시도, 자동 dispatcher 운영 전환 | 필요 | 중지 |

## 진행 원칙

1. L0-L3는 가능한 데까지 실행한다.
2. source 접근이 막히면 막힌 source만 `blocked` 또는 `unknown`으로 기록하고 다음 read-only source를 계속 확인한다.
3. `already_in_ga4=unknown` 또는 `present` 후보는 send 후보가 아니다.
4. `robust_absent`가 닫힌 A급 production 후보가 있으면 approval draft까지 작성한다.
5. 실제 전송은 하지 않는다.
6. 최종 보고에는 TJ님 결정 1개만 남긴다.

## 승인 없이 실행 가능한 명령 유형

| 유형 | 예 |
|---|---|
| 문서 검증 | `python3 scripts/validate_wiki_links.py ...` |
| dry-run | `npm exec tsx scripts/npay-roas-dry-run.ts -- --format=json` |
| BigQuery read-only guard | `npm exec tsx scripts/npay-ga4-robust-guard.ts -- --ids-file=...` |
| GTM read-only | published version 조회, tag 상태 조회 |
| 운영 DB SELECT | confirmed NPay order 조회 |
| VM SQLite read-only | `npay_intent_log` SELECT 또는 protected read API |

## 승인 전 금지

| 금지 | 이유 |
|---|---|
| NPay 버튼 클릭 | 기존 live tag 118이 VM DB write를 만들 수 있음 |
| `/api/attribution/npay-intent` 호출 | intent 원장 오염 |
| `/checkout-context`, `/payment-success`, `/payment-decision`, `/tiktok-pixel-event` 호출 | attribution ledger 또는 guard event log 오염 |
| `fetch`, `sendBeacon`, `XMLHttpRequest`가 있는 preview snippet 실행 | 외부 전송 가능 |
| `gtag(`, `fbq(`, `ttq.` 호출 | GA4/Meta/TikTok 전송 가능 |
| GTM workspace 생성/수정/publish | 운영 추적 변경 |
| Imweb header/footer 수정 | live 사이트 변경 |
| backend deploy | 운영 endpoint 변경 |

## Output Contract

auto-run 결과는 아래를 남긴다.

| 산출물 | 필수 여부 |
|---|---|
| 최신 dry-run markdown 또는 blocked report | 필수 |
| BigQuery guard 결과 또는 blocked 사유 | 필수 |
| payload preview | 후보가 있을 때 필수 |
| approval draft | A급 production + robust_absent 후보가 있을 때 필수 |
| eval log YAML | 필수 |
| auditor verdict | 필수 |

## Block 처리

아래는 실패가 아니라 read-only block으로 본다. 단, 숫자 confidence를 낮춘다.

| block | 처리 |
|---|---|
| VM SQLite SSH 접근 실패 | protected API 또는 기존 snapshot을 시도한다. 모두 실패하면 primary source blocked |
| protected API 403 | token missing으로 기록한다 |
| BigQuery 403 | `already_in_ga4=unknown`으로 유지한다 |
| GTM read-only 실패 | 기존 snapshot을 stale로 표시하고 publish 판단은 하지 않는다 |

Block이 핵심 primary source를 막으면 auditor verdict는 `FAIL_BLOCKED` 또는 `NEEDS_HUMAN_APPROVAL`이다. 이때도 write/send/publish/deploy는 하지 않는다.
