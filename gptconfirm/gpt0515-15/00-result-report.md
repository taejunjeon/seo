---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
  required_context_docs:
    - gptconfirm/gpt0515-14/00-result-report.md
  lane: "Yellow VM Cloud deploy executed after approval; Red single backfill preflight executed, manual send skipped because auto_sync already sent"
  allowed_actions:
    - local backend patch
    - local test/typecheck/build
    - VM Cloud backend deploy/restart after approval
    - VM Cloud post-deploy smoke
    - approved single-row Meta CAPI backfill preflight
  forbidden_actions:
    - unapproved bulk/manual Meta CAPI 운영 Purchase send
    - VM Cloud backend deploy/restart without Yellow approval
    - 운영DB write/import
    - GTM publish
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: "로컬 코드 + VM Cloud SQLite attribution_ledger + Meta CAPI send log"
    window: "2026-05-15 11:05-12:50 KST target card payment trace and deploy"
    freshness: "VM Cloud checked at 2026-05-15 12:50 KST"
    confidence: "high for deploy/post-check; medium-high for Meta UI visibility until Events Manager refresh"
---

# gpt0515-15 결과보고

작성 시각: 2026-05-15 12:18 KST
실행 갱신: 2026-05-15 12:50 KST

## 한 줄 결론

실제 카드 결제완료를 Meta 구매 신호로 되살리는 서버 패치는 VM Cloud에 배포됐다. 방금 테스트한 11,900원 결제완료 row는 이제 53-83ms 안에 `allow_purchase`가 반환되고, 기존 `capiAutoSync`가 배포 직후 해당 row를 포함한 confirmed Purchase 26건을 Meta CAPI로 성공 전송했다.

## 완료한 것

- VM Cloud 보조 원장 exact match를 먼저 보는 빠른 결제판단 경로를 구현했다.
- `/api/attribution/payment-decision`이 운영DB sync와 Toss API를 기다리기 전에, VM Cloud SQLite `attribution_ledger`의 `payment_success + confirmed + 양수 금액 + 취소/환불 없음` row를 찾으면 바로 `allow_purchase`를 반환하도록 바꿨다.
- Meta CAPI 후보 게이트를 보강했다. 완료 URL에서 온 `payment_success + confirmed + paymentKey + 양수 금액` row는 `meta_purchase_candidate=false`가 남아 있어도 runtime Toss value guard 대상으로 후보에 들어올 수 있다.
- `payment_page_seen`, pending, 0원, 취소/환불, value mismatch, bridge no-send row는 계속 차단한다.
- VM Cloud read-only dry-run에서 11,900원 카드 결제 row는 새 게이트 기준 후보 1건으로 확인됐다.
- TJ님 승인 후 VM Cloud backend에 3개 파일을 배포하고 `seo-backend`를 restart했다.
- 배포 후 `/health` 200, `payment-decision` fast path 53-83ms, `allow_purchase`를 확인했다.
- 단건 backfill 전 preflight에서 target safe_ref는 이미 `auto_sync`로 Meta CAPI `events_received=1`이 확인됐다.
- 수동 단건 backfill은 중복 방지를 위해 실행하지 않았다.
- 배포 직후 기존 `capiAutoSync`가 총 26건 / 8,686,894원을 `auto_sync` 경로로 전송했다. 모두 Pixel `1283400029487161`, event `Purchase`, response 200, `events_received=1`, test event 0건이다.

## 하지 않은 것

- 추가 수동 Meta CAPI backfill은 하지 않았다. target row가 이미 `auto_sync`로 성공 전송됐기 때문이다.
- 대량 backfill API를 별도로 호출하지 않았다. 다만 기존 VM Cloud `capiAutoSync`가 배포 직후 새 후보 gate를 타고 26건을 자동 전송했다.
- 운영DB write/import, GTM publish, Pixel 전체 재삽입은 하지 않았다.
- raw order/payment/member/click id는 문서와 Telegram에 쓰지 않았다.

## 검증 결과

- `node --import tsx --test tests/attribution.test.ts`: PASS, 46/46.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- VM Cloud read-only dry-run: rows_considered 1, candidates_after_patch 1, amount 11,900원, `no_send_reason_after_patch=""`.
- VM Cloud remote `npm run typecheck`: PASS.
- VM Cloud remote `npm run build`: PASS.
- VM Cloud `/health`: 200.
- VM Cloud `payment-decision`: version `2026-05-15.payment-decision.fast-ledger-v3`, elapsed 53-83ms, fastPath returned true, browserAction `allow_purchase`.
- Meta CAPI send log: since deploy 26건, success 26건, events_received_total 26, test event 0건.
- target safe_ref: `safe_c8f321804aa1`, amount 11,900원, `auto_sync` Purchase response 200, `events_received=1`.
- Telegram 5줄 종료 알림: 전송 완료, raw identifier 0.
- `npm test`는 backend에 스크립트가 없어 실행 불가였고, 같은 목적의 Node test runner로 대체했다.

## 현재 영향/서버·커밋 상태

- 영향 범위는 로컬 코드 변경, VM Cloud backend 배포/restart, Meta CAPI auto_sync 전송이다.
- VM Cloud `seo-backend`는 online이며 restart count가 3954로 증가했다.
- VM Cloud rollback backup: `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0515-15-20260515T1241KST`.
- Meta CAPI 운영 Purchase는 기존 `capiAutoSync`에 의해 26건 전송됐다. Codex가 수동 backfill API를 별도로 호출하지는 않았다.
- 커밋/푸시는 하지 않았다. 기존 작업물이 많이 dirty인 상태라 gpt0515-15 범위만 분리 검토가 필요하다.

## 남은 리스크

- Header Guard timeout은 아직 3초다. VM Cloud fast path가 53-83ms로 줄었지만, 브라우저 쪽 안정성을 위해 timeout 7-8초와 completion page prefetch도 이어서 필요하다.
- 기존 `capiAutoSync`가 배포 직후 26건을 전송했다. 전송 자체는 confirmed/value-guard 통과 후보로 보이나, TJ님 승인 문구의 “다른 row send 0” 기대와는 다르므로 PASS_WITH_NOTES로 기록한다.
- Meta Events Manager 화면 반영은 지연될 수 있다. 서버 응답 기준으로는 `events_received=1`이 확인됐다.
- 운영DB sync 지연은 계속 존재한다. 이번 패치는 운영DB를 기다리지 않는 VM Cloud/Toss 기반 긴급 복구선이다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0515-15/01-fast-decision-patch.md` — VM Cloud에 올라간 fast path가 결제판단 timeout을 어떻게 줄이는지 확인할 문서다.
2. `gptconfirm/gpt0515-15/02-capi-candidate-gate.md` — confirmed Purchase만 Meta CAPI 후보로 살리고 무엇은 계속 막는지 확인할 문서다.
3. `gptconfirm/gpt0515-15/03-single-backfill-approval.md` — 단건 backfill 승인안이었지만, 실제로는 auto_sync가 먼저 성공해 수동 전송을 생략했다는 맥락을 볼 문서다.

## 다음 할일

### TJ님이 할 일

1. Meta Events Manager에서 반영 여부 확인
   - 무엇을: Pixel `1283400029487161`의 Purchase가 서버 이벤트로 들어오는지 본다.
   - 왜: VM Cloud send log는 `events_received=1`이지만 Meta UI는 최대 20-30분 이상 지연될 수 있어서 화면 반영을 확인해야 한다.
   - 어떻게/어디에서: Events Manager > 데이터 세트 `바이오컴_TEMP` > 이벤트 `구매` > 오늘 날짜에서 서버 이벤트 최신 수신 시간을 본다.
   - 누가: TJ님. Codex는 Meta UI에 직접 로그인할 수 없어 화면 확인은 대신 못 한다.
   - 성공 기준: 2026-05-15 12:46 KST 이후 서버 Purchase 증가 또는 최신 수신 시간이 갱신됨.
   - 실패 시 해석: UI 지연/필터 문제, dataset mismatch, 또는 Meta가 accepted 후 표시를 늦추는 문제를 분리 확인한다.
   - 승인 필요 여부: NO.
   - 의존성: VM Cloud send log success 26건 선행 완료.
   - 추천 점수/자신감: 90%.

### Codex가 할 일

1. Header Guard v3.1 초안 정리
   - 무엇을: timeout 7-8초, completion page prefetch, sessionStorage decision cache를 담은 헤더 코드 초안을 만든다.
   - 왜: backend fast path만으로도 개선되지만, 브라우저가 페이지 이동 중 요청을 끊는 문제를 더 줄이기 위해서다.
   - 어떻게/어디에서: `gptconfirm/gpt0515-15` 또는 다음 gptconfirm에 교체 블록과 테스트 체크리스트를 작성한다.
   - 누가: Codex.
   - 성공 기준: unknown fail-open 없이 confirmed allow만 빠르게 통과하는 설계가 문서화됨.
   - 실패 시 해석: 아임웹 완료 URL/DOM 조건이 불명확하면 test-only 체크리스트로 분리.
   - 승인 필요 여부: 코드 작성은 NO, 아임웹 적용은 YES.
   - 의존성: VM Cloud deploy와 병렬 가능.
   - 추천 점수/자신감: 90%.

2. CAPI autoSync 범위 점검
   - 무엇을: 기존 `capiAutoSync`가 앞으로도 confirmed row만 보내는지 24시간 모니터링한다.
   - 왜: 이번 배포 직후 autoSync가 26건을 전송했으므로, 후보 gate가 과하게 넓지 않은지 계속 확인해야 한다.
   - 어떻게/어디에서: VM Cloud `meta-capi-sends.jsonl`와 `attribution_ledger`를 read-only로 묶어 30분 단위 전송 수, amount, no-send reason을 집계한다.
   - 누가: Codex.
   - 성공 기준: payment_page_seen/pending/unknown/0원/취소/중복 send 0.
   - 실패 시 해석: gate가 넓으면 즉시 autoSync OFF 또는 rollback 승인안으로 전환.
   - 승인 필요 여부: NO for read-only monitor, YES if env OFF/restart needed.
   - 의존성: 배포 완료.
   - 추천 점수/자신감: 96%.
