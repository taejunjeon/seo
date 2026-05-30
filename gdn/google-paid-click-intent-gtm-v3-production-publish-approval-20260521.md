작성 시각: 2026-05-21 17:08 KST
기준일: 2026-05-21
문서 성격: GTM v3 운영 반영 승인안

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gdn/google-paid-click-intent-gad-campaignid-gtm-hardening-plan-20260521.md
  required_context_docs:
    - backend/scripts/paid-click-intent-gad-campaignid-gtm-publish.ts
  lane: Red
  allowed_if_approved:
    - GTM workspace 169 create_version
    - GTM workspace 169 publish
    - post-publish public gtm.js smoke
    - no-send receiver smoke
  forbidden_even_if_approved:
    - Google Ads conversion upload
    - GA4 Measurement Protocol purchase send
    - Meta CAPI manual send
    - 운영DB write
    - backend deploy
  source_window_freshness_confidence:
    source: GTM API + Preview smoke + local scripts
    window: 2026-05-21 16:48~17:08 KST
    freshness: 2026-05-21 17:08 KST
    confidence: 0.92
```

## 10초 요약

GTM v3를 운영 반영하면 실제 사이트에서 Google 광고 클릭 신호가 더 깨끗하게 남는다.

구체적으로, 새 광고 URL에 `gclid/gbraid/gad_campaignid`가 들어왔을 때 브라우저 저장소에 남아 있던 과거 테스트 `wbraid`를 섞지 않는다. 이 문제는 paid-click-intent ledger exact-click miss의 유력 원인이었고, v3 Preview에서 재현/방지 검증을 통과했다.

이 작업은 GTM Production publish라 Red Lane이다. TJ님이 명시 승인하면 Codex가 바로 publish하고 검증한다.

## 내가 실제로 누르는/바꾸는 것

- 화면/시스템: Google Tag Manager container `GTM-W2Z6PHN`.
- workspace: `169` / `codex_paid_click_intent_v3_stale_click_guard_preview_20260521T074835Z`.
- 바꾸는 태그: tag `279` / `codex_paid_click_intent_v1_receiver_no_send`.
- 연결 트리거: trigger `278` / `codex_paid_click_intent_v1_all_pages_guarded`.
- 바꾸는 내용: 기존 tag 279 Custom HTML을 v3 HTML로 publish.
- 안 바꾸는 것: trigger, storage key, receiver URL, Google Ads/GA4/Meta conversion send.

## 바꾸면 생기는 효과

1. 실제 Google 광고 클릭 URL에 새 `gclid/gbraid`가 있으면 그 값을 우선한다.
2. 저장소에 남아 있던 과거 `wbraid` 같은 다른 Google click id 타입을 섞지 않는다.
3. `gad_campaignid=14629255429` 같은 Google campaign id가 payload와 landing URL에 계속 남는다.
4. backend가 `test_click_id_rejected_for_live`로 실제 클릭을 탈락시키는 가능성을 낮춘다.

## 안 바꾸면 남는 문제

현재 운영 live는 v2다.

v2는 URL에 새 `gclid/gbraid`가 있어도 저장소의 이전 `wbraid`가 있으면 payload에 같이 실을 수 있다. 이 경우 backend guard가 과거 테스트 id를 보고 실제 클릭 후보를 탈락시킬 수 있다.

## 이미 확인한 것

- Preview workspace `169`: change 1건, merge conflict 0건.
- live container: version `144` 유지.
- Preview smoke result: `data/gtm-paid-click-intent-tag279-preview-smoke-20260521T075045Z.json`.
- stale wbraid smoke result: `data/gtm-paid-click-intent-v3-stale-wbraid-preview-smoke-20260521T075405Z.json`.
- `expectedVersionInstalled=true`.
- `gadCampaignIdInPayload=true`.
- `receiverOk=true`.
- `staleWbraidDropped=true`.
- `platformSend=false`.
- `productionPublished=false`.

## 실행 계획

1. publish 직전 live version과 workspace status를 다시 읽는다.
2. workspace `169` change가 tag `279` 1건뿐인지 확인한다.
3. tag HTML 안에 `paid_click_intent_v3_stale_click_id_guard_20260521`이 있는지 확인한다.
4. `create_version` 후 `publish`한다.
5. public `gtm.js?id=GTM-W2Z6PHN`에서 v3 문자열을 확인한다.
6. no-send receiver smoke를 1회 실행해 `receiverOk=true`, platform send 0을 확인한다.
7. 결과 JSON과 대화 보고를 남긴다.

## Rollback

문제 발생 시 이전 live version `144`로 되돌리거나, tag 279 HTML backup을 복원한다.

직전 backup 후보:

- `data/gtm-paid-click-intent-tag279-backup-20260521T074835Z.html`
- live before: version `144` / `paid_click_intent_v2_gad_campaignid_20260521`

## 승인 문구

아래처럼 답하면 Codex가 실행한다.

`GTM v3 Production publish 승인`

## 다음 할일

### TJ님이 할 일

GTM v3를 운영에 반영할지 승인한다. 승인하면 실제 사이트의 모든 방문자에게 v3 태그가 적용된다. 승인 전까지는 workspace `169` Preview draft로만 남아 있다.

### Codex가 할 일

승인되면 workspace `169`만 publish하고, public `gtm.js`와 no-send receiver smoke로 검증한다. Google Ads/GA4/Meta 전환 전송은 하지 않는다.
