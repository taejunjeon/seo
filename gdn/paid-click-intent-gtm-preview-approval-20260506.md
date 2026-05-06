# paid_click_intent GTM Preview 승인안

작성 시각: 2026-05-06 09:35 KST
대상: biocom Google click id 보존률 개선
문서 성격: Yellow Lane 승인안. 이 문서는 실행 전 체크리스트이며, GTM Production publish나 광고 플랫폼 전송을 승인하지 않는다.

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

반드시 새 workspace를 만든다.
`Default Workspace 147`은 오래된 NPay intent 작업 충돌이 남아 있으므로 저장, 제출, 게시하지 않는다.
새 workspace는 live v140 기준 fresh 상태에서 시작한다.

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

```text
POST /api/attribution/confirmed-purchase/no-send
```

또는 별도 `paid_click_intent` preview endpoint가 생기면 해당 endpoint를 사용하되, 응답에는 아래 guardrail이 있어야 한다.

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

## 성공 기준

- 테스트 랜딩 URL에서 `gclid`, `gbraid`, `wbraid`가 각각 storage에 저장된다.
- 페이지 이동 후에도 같은 click id가 유지된다.
- 일반 결제 시작 또는 NPay intent 시점 payload에 같은 click id가 들어간다.
- no-send receiver preview에서 `has_google_click_id=true`가 나온다.
- Tag Assistant Preview에서 새 태그가 Preview에서만 동작한다.
- GA4/Meta/Google Ads 전환 전송은 0건이다.

## 실패 기준

- click id가 landing 이후 사라진다.
- NPay intent payload에 click id가 들어가지 않는다.
- no-send receiver가 아닌 GA4/Meta/Google Ads endpoint로 전송된다.
- GTM workspace가 Default Workspace 147이다.
- Preview가 아니라 Submit/Publish가 시도된다.

## 롤백

Preview만 했으면 운영 롤백은 없다.
workspace 변경안은 제출하지 않고 폐기한다.
테스트 후 브라우저 storage는 삭제한다.

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
