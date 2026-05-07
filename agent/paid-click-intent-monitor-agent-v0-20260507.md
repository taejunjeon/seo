# PaidClickIntentMonitorAgent v0 계약

작성 시각: 2026-05-07 14:45 KST
상태: active design
Owner: agent / gdn / paid_click_intent
Supersedes: none
Next document: post-publish 24h/72h monitoring result
Do not use for: GTM publish 승인, Google Ads 전환 변경, conversion upload, GA4/Meta/Google Ads 전송

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - agent/aios-agent-runner-contract-20260507.md
    - agent/!aiosagentplan.md
    - gdn/paid-click-intent-post-publish-monitoring-result-template-20260507.md
  lane: Green monitoring agent design
  allowed_actions:
    - monitoring script wrapper 설계
    - positive/negative smoke 실행 계약 작성
    - 결과 Markdown/JSON 산출 계약 작성
  forbidden_actions:
    - GTM publish
    - backend 운영 deploy
    - operating DB/ledger write
    - platform send
  source_window_freshness_confidence:
    source: "backend/scripts/paid-click-intent-monitoring-collect.ts"
    window: "2026-05-07 KST"
    freshness: "script exists, production monitoring depends on Mode B/live state"
    confidence: 0.86
```

## 10초 결론

PaidClickIntentMonitorAgent는 Google 광고 클릭 ID 보존 실험의 안전 관측 agent다.

이 agent는 `gclid/gbraid/wbraid`가 서버 수신점까지 안전하게 들어오는지 확인한다. 구매 전송, Google Ads 전환 변경, DB write는 하지 않는다.

## 재사용 script

```text
backend/scripts/paid-click-intent-monitoring-collect.ts
```

현재 script가 하는 일:

- `/health` 확인
- `POST /api/attribution/paid-click-intent/no-send` positive TEST smoke
- click id 없음, value/currency, order field, PII, admin path, oversized body negative smoke
- `would_store=false`, `would_send=false`, `no_write_verified`, `no_platform_send_verified` 확인
- JSON과 Markdown 결과 생성

## 실행 모드

| 모드 | 언제 쓰나 | 의미 |
|---|---|---|
| `immediate` | 배포/게시 직후 또는 수동 확인 | 지금 endpoint와 smoke가 통과하는지 확인 |
| `24h` | 운영 publish 24시간 뒤 | receiver 안정성 1차 확인 |
| `72h` | 운영 publish 72시간 뒤 | 표본과 실패율을 보고 다음 단계 판단 |

## 권장 명령

```bash
cd backend
npx tsx scripts/paid-click-intent-monitoring-collect.ts \
  --base-url=https://att.ainativeos.net \
  --window=immediate
```

24h/72h는 `--window=24h`, `--window=72h`로 실행한다.

## 출력

| 산출물 | 기본 경로 |
|---|---|
| JSON | `data/paid-click-intent-monitoring-{window}-{YYYYMMDD}.json` |
| Markdown | `gdn/paid-click-intent-post-publish-monitoring-result-{window}-{YYYYMMDD}.md` |

## PASS 기준

1. `/health`가 2xx다.
2. positive TEST smoke가 200이다.
3. negative smoke가 기대 status로 reject된다.
4. 모든 case에서 `would_store=false`다.
5. 모든 case에서 `would_send=false`다.
6. `no_platform_send_violations=0`이다.
7. TEST/DEBUG/PREVIEW click id는 `live_candidate_after_approval=false`다.

## 실패 분류

| 실패 위치 | 예시 | 다음 확인 |
|---|---|---|
| `receiver` | POST 404, 500 | route deploy 상태 확인 |
| `CORS` | browser preflight 실패 | allowed origin 확인 |
| `payload_validation` | PII/value/order field가 통과 | validator 수정 필요 |
| `GTM` | payload가 생성되지 않음 | tag/trigger/storage 확인 |
| `storage` | click id 저장 없음 | landing URL/redirect 확인 |
| `approval_required` | publish/deploy 필요 | Red 승인 문서로 분리 |

## 금지선

- 이 agent는 GTM publish를 하지 않는다.
- 이 agent는 운영 backend deploy를 하지 않는다.
- 이 agent는 GA4/Meta/Google Ads로 전송하지 않는다.
- 이 agent는 운영 DB/ledger에 쓰지 않는다.

## 다음 구현 작업

1. `package.json` 또는 backend npm script에 안전한 wrapper 명령을 추가할지 검토한다.
2. `agent/!aiosagentplan.md`의 Phase1-Sprint1 완료 기준에 이 계약을 연결한다.
3. Mode B live 상태가 되면 24h/72h 결과 문서 생성까지 자동화한다.

