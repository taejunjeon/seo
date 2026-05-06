# paid_click_intent GTM Preview 승인안

작성 시각: 2026-05-06 09:35 KST
대상: biocom Google click id 보존률 개선
문서 성격: Yellow Lane 승인안. 이 문서는 실행 전 체크리스트이며, GTM Production publish나 광고 플랫폼 전송을 승인하지 않는다.
Status: approved for Preview only / precheck passed
Supersedes: 없음
Next document: paid_click_intent GTM Preview 결과 보고서
Do not use for: GTM Production publish, Google Ads 전환 액션 생성/변경, conversion upload, GA4/Meta/Google Ads 전송, backend 운영 deploy

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  required_context_docs:
    - gdn/google-click-id-preservation-plan-20260505.md
    - gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md
    - data/google-click-id-preservation-diagnostics-20260505.md
    - data/confirmed-purchase-no-send-route-sample-20260506.md
  lane: Yellow
  allowed_after_tj_approval:
    - GTM fresh workspace Preview
    - 테스트 URL에서 browser storage 확인
    - no-send receiver preview 확인
  still_forbidden:
    - GTM Production publish
    - Default Workspace 147 저장/제출/게시
    - backend 운영 deploy
    - GA4/Meta/Google Ads 전환 전송
    - Google Ads conversion action 생성/변경
    - 운영 DB write
  source_window_freshness_confidence:
    source: "운영 DB confirmed order 623건 + Attribution VM snapshot + GA4 BigQuery guard + no-send route sample"
    window: "2026-04-27~2026-05-05"
    freshness: "imweb_operational fresh, source lag 6.5h at 2026-05-06 09:23 KST"
    site: "biocom"
    confidence: 0.9
```

## 10초 결론

지금 필요한 승인은 `GTM Preview로만 Google click id가 살아남는지 확인해도 되는가`이다.
승인하더라도 실제 사이트에 게시하지 않고, Google Ads/GA4/Meta로 전환을 보내지 않는다.
성공 기준은 테스트 랜딩 URL의 `gclid/gbraid/wbraid`가 브라우저 storage에 저장되고, 결제 시작/NPay intent/no-send receiver preview까지 같은 값으로 이어지는 것이다.

2026-05-06 09:54 KST 기준 로컬 backend에는 `POST /api/attribution/paid-click-intent/no-send` preview route가 준비됐다.
이 route는 저장하지 않고, 전송하지 않고, 플랫폼으로 보내지 않는다.

2026-05-06 14:56 KST에 Codex가 실행 전 precheck를 추가로 완료했다.
GTM API read-only 기준 현재 biocom GTM live latest version은 `141 / pause_aw308433248_upde_20260505`다.
따라서 Preview는 v140이 아니라 현재 live v141 기준 fresh workspace에서만 시작해야 한다.
로컬 backend 7020의 CORS preflight는 `Origin: https://biocom.kr`에 대해 `204`와 `Access-Control-Allow-Origin: https://biocom.kr`를 반환했다.
다만 실제 Tag Assistant 브라우저 환경에서는 mixed content, local endpoint 접근, 브라우저 보안 정책 문제가 별도로 발생할 수 있으므로, Preview 시작 직후 console/network에서 receiver 접근성을 다시 확인한다.

## 왜 하는가

운영 confirmed purchase no-send dry-run 결과, 2026-04-27~2026-05-05 결제완료 주문 623건 중 Google click id가 남은 주문은 5건이다.
전체 보존률은 0.8%다.
이 상태에서 Google Ads에 실제 결제완료 주문을 보내도 Google이 어느 광고 클릭의 구매인지 매칭하기 어렵다.

따라서 전송보다 먼저 해야 할 일은 랜딩 시점의 광고 클릭 ID를 보존하는 것이다.

## TJ님이 승인하는 것

아래 한 가지만 승인한다.

```text
YES: biocom GTM fresh workspace에서 paid_click_intent v1 Preview 검증을 진행한다.
```

이 승인은 아래를 포함하지 않는다.

- GTM Production publish
- 기존 Google Ads 전환 액션 변경
- 새 Google Ads 전환 액션 생성
- conversion upload
- GA4/Meta/Google Ads purchase 전송
- backend 운영 deploy
- 운영 DB write

## 작업 공간 원칙

Preview 전에 현재 GTM live latest version을 read-only로 다시 확인한다.
이전 문서에는 live v140 기준으로 적혀 있었지만, AW-308 pause 이후 live version이 바뀌었을 수 있으므로 숫자를 고정하지 않는다.

반드시 현재 live latest version 기준 새 workspace를 만든다.
`Default Workspace 147`은 오래된 NPay intent 작업 충돌이 남아 있으므로 저장, 제출, 게시하지 않는다.

권장 workspace 이름:

```text
codex_paid_click_intent_preview_20260506
```

## Preview 설계

### 테스트 URL

아래처럼 가짜 Google click id를 붙인 테스트 URL을 사용한다.

```text
https://biocom.kr/?gclid=TEST_GCLID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506
```

gbraid/wbraid도 별도 테스트한다.

```text
https://biocom.kr/?gbraid=TEST_GBRAID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506
https://biocom.kr/?wbraid=TEST_WBRAID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506
```

### 브라우저 저장 키

Preview에서는 아래 목적의 storage만 확인한다.
실제 키 이름은 구현 시 한 번 더 확정한다.

- `bi_paid_click_intent_v1`
- `bi_google_click_id`
- `bi_google_click_captured_at`

저장할 값:

- `gclid`
- `gbraid`
- `wbraid`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `landing_url`
- `referrer`
- `captured_at`
- `ga_session_id` 또는 local session id

### no-send receiver preview

Preview 단계에서 네트워크 요청이 발생하더라도 반드시 no-send endpoint만 사용한다.
`paid_click_intent`는 결제완료 주문 후보가 아니므로 `confirmed_purchase/no-send`와 섞지 않는다.

```text
POST /api/attribution/paid-click-intent/no-send
```

응답에는 아래 guardrail이 있어야 한다.

```json
{
  "dryRun": true,
  "wouldStore": false,
  "wouldSend": false,
  "noSendVerified": true,
  "noWriteVerified": true,
  "noPlatformSendVerified": true
}
```

현재 backend v1 응답은 기존 route 호환을 위해 `dryRun`, `wouldStore`, `wouldSend`, `noSendVerified` 같은 camelCase guard field를 포함한다.
ontology canonical target은 snake_case다.
2026-05-06 14:55 KST 기준 backend는 기존 camelCase를 유지하면서 `dry_run`, `would_store`, `would_send`, `no_send_verified`, `no_write_verified`, `no_platform_send_verified` alias와 공통 `guard` 객체를 함께 반환한다.
Preview only 단계에서는 기존 v1 camelCase와 새 snake_case를 모두 인정한다.
field alignment 상세는 [[../ontology/backend-attribution-field-alignment-plan-20260506]]를 따른다.

### 테스트 click id live 차단 규칙

Preview에서 `TEST_GCLID_20260506`, `TEST_GBRAID_20260506`, `TEST_WBRAID_20260506` 같은 가짜 click id를 쓰는 것은 허용한다.
다만 이 값은 live 후보가 되면 안 된다.

규칙:

- `TEST_`, `DEBUG_`, `PREVIEW_` prefix가 붙은 `gclid/gbraid/wbraid`는 live 후보에서 무조건 reject한다.
- no-send 응답에는 `test_click_id=true`, `block_reasons`에는 `test_click_id_rejected_for_live`를 표시한다.
- Preview 후 브라우저 `localStorage`, `sessionStorage`, 관련 cookie를 삭제한다.

## 성공 기준

- 테스트 랜딩 URL에서 `gclid`, `gbraid`, `wbraid`가 각각 storage에 저장된다.
- 페이지 이동 후에도 같은 click id가 유지된다.
- 일반 결제 시작 또는 NPay intent 시점 payload에 같은 click id가 들어간다.
- `POST /api/attribution/paid-click-intent/no-send` preview에서 `has_google_click_id=true`가 나온다.
- 테스트 click id는 `test_click_id=true`로 표시되고 live 후보에서는 차단된다.
- Tag Assistant Preview에서 새 태그가 Preview에서만 동작한다.
- GA4/Meta/Google Ads 전환 전송은 0건이다.

## 실패 기준

- click id가 landing 이후 사라진다.
- NPay intent payload에 click id가 들어가지 않는다.
- no-send receiver가 아닌 GA4/Meta/Google Ads endpoint로 전송된다.
- GTM workspace가 Default Workspace 147이다.
- Preview가 아니라 Submit/Publish가 시도된다.
- `confirmed_purchase/no-send` endpoint에 paid click intent payload를 섞어 보낸다.

## 롤백

Preview만 했으면 운영 롤백은 없다.
workspace 변경안은 제출하지 않고 폐기한다.
테스트 후 브라우저 storage와 cookie를 삭제한다.

## 로컬 route smoke 결과

로컬 임시 backend 포트 `7099`에서 no-send preview를 확인했다.

| 케이스 | 결과 | 해석 |
|---|---|---|
| `gclid=TEST_GCLID_20260506` | `ok=true`, `has_google_click_id=true`, `test_click_id=true`, `wouldStore=false`, `wouldSend=false` | Preview용 click id는 인식하지만 live 후보에서는 차단 |
| Google click id 없음 | `ok=false`, `block_reasons=missing_google_click_id` | click id 보존 실패를 명확히 표시 |
| `value` 포함 | `ok=false`, `rejectedField=value` | purchase/결제값이 paid click intent에 섞이는 것을 차단 |

2026-05-06 14:55 KST 재검증에서는 아래도 함께 통과했다.

- 기존 camelCase: `dryRun`, `wouldStore`, `wouldSend`, `noSendVerified`
- 새 snake_case: `dry_run`, `would_store`, `would_send`, `no_send_verified`
- 공통 guard: `guard.block_reasons`, `guard.actual_send_candidate=false`, `guard.no_platform_send_verified=true`
- paid click intent 정상/누락/결제값 reject 케이스
- confirmed purchase 정상/NPay click 차단/canceled canonical reason 케이스

검증 명령:

```bash
PORT=7099 BACKGROUND_JOBS_ENABLED=false npx tsx src/server.ts
curl -s -X POST http://localhost:7099/api/attribution/paid-click-intent/no-send \
  -H 'Content-Type: application/json' \
  --data '{"site":"biocom","capture_stage":"landing","gclid":"TEST_GCLID_20260506","utm_source":"google","utm_medium":"cpc","utm_campaign":"codex_preview_20260506","landing_url":"https://biocom.kr/?gclid=TEST_GCLID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506","client_id":"cid.preview","ga_session_id":"12345"}'
```

## 다음 단계

Preview 결과가 성공하면 다음 문서를 별도로 만든다.

1. `paid_click_intent` backend receiver no-write contract
2. 제한된 테스트 환경 backend deploy 승인안
3. GTM Production publish 승인안

각 단계는 별도 Yellow/Red 승인 없이는 진행하지 않는다.

## Auditor verdict

Auditor verdict: READY_FOR_TJ_DECISION
No-send verified in plan: YES
No-write verified in plan: YES
No-deploy verified in plan: YES
No-publish verified in plan: YES
No-platform-send verified in plan: YES

Recommendation: YES, Preview only.
Confidence: 90%.
