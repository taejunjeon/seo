# paid_click_intent receiver 접근 검증 결과

작성 시각: 2026-05-06 15:58 KST
대상: biocom Google click id 보존 Preview 후속
문서 성격: Yellow Lane Preview 후속 실행 결과. 운영 게시, 외부 플랫폼 전송, 운영 DB write는 하지 않았다.
Status: pass / HTTPS tunnel receiver verified
Supersedes: [[paid-click-intent-receiver-access-approval-20260506]]
Next document: GTM Production publish 승인안 또는 Google Ads landing-session click id 분석 결과
Do not use for: GTM Production publish, Google Ads 전환 액션 생성/변경, conversion upload, GA4/Meta/Google Ads 전송, backend 운영 deploy

```yaml
harness_result:
  lane: Yellow
  approved_scope: Preview only receiver access verification
  gtm_live_latest: "141 / pause_aw308433248_upde_20260505"
  workspace_used: "fresh temporary workspace only"
  default_workspace_147_used: false
  production_publish: false
  submit: false
  platform_send: false
  backend_deploy: false
  operating_db_write: false
  receiver_tunnel: "temporary cloudflared quick tunnel, closed after test"
  local_proxy: "path-limited proxy on 127.0.0.1:7091"
  cleanup: "temporary GTM workspace deleted, tunnel closed, proxy closed"
  result_confidence: 0.92
```

## 10초 결론

직전 Preview의 blocker였던 `https://biocom.kr -> http://localhost:7020` 브라우저 차단은 임시 HTTPS tunnel로 해결했다.
이번 재검증에서 `gclid`, `gbraid`, `wbraid` 세 테스트 케이스 모두 아래 조건을 통과했다.

```text
browser storage 저장: PASS
payload 생성: PASS
browser receiver reached: PASS
receiverStatus=200: PASS
receiverOk=true: PASS
receiverHasGoogleClickId=true: PASS
receiverTestClickId=true: PASS
```

따라서 `paid_click_intent v1`은 Preview 범위에서 Google click id를 랜딩 시점에 저장하고 no-send receiver까지 전달할 수 있음이 확인됐다.
아직 운영 GTM publish, 운영 DB 저장, Google Ads 전송은 하지 않았다.

## 실제 실행한 것

- 로컬 backend 7020의 `POST /api/attribution/paid-click-intent/no-send` 상태를 확인했다.
- 전체 backend를 직접 tunnel에 노출하지 않기 위해 path-limited proxy를 추가했다.
- proxy는 `/api/attribution/paid-click-intent/no-send`의 `OPTIONS`, `POST`만 허용한다.
- proxy 로컬 검증에서 CORS preflight 204와 POST 200을 확인했다.
- `cloudflared` quick tunnel로 proxy만 임시 HTTPS URL에 연결했다.
- tunnel 검증에서 CORS preflight 204와 POST 200을 확인했다.
- `PAID_CLICK_INTENT_PREVIEW_RECEIVER_URL=<temporary https tunnel>/api/attribution/paid-click-intent/no-send`로 GTM Preview 스크립트를 재실행했다.
- 테스트 종료 후 tunnel과 proxy를 닫았다.

사용한 임시 GTM object:

```text
workspaceId: 158
workspace name: codex_paid_click_intent_preview_20260506T065628Z
tagId: 276
triggerId: 275
cleanup: deleted workspace 158
```

## 테스트 결과

### gclid

- pageLoaded: true
- storageHasClickId: true
- receiverReached: true
- receiverStatus: 200
- receiverOk: true
- receiverHasGoogleClickId: true
- receiverTestClickId: true
- block_reasons: `read_only_phase`, `approval_required`, `test_click_id_rejected_for_live`

### gbraid

- pageLoaded: true
- storageHasClickId: true
- receiverReached: true
- receiverStatus: 200
- receiverOk: true
- receiverHasGoogleClickId: true
- receiverTestClickId: true
- block_reasons: `read_only_phase`, `approval_required`, `test_click_id_rejected_for_live`

### wbraid

- pageLoaded: true
- storageHasClickId: true
- receiverReached: true
- receiverStatus: 200
- receiverOk: true
- receiverHasGoogleClickId: true
- receiverTestClickId: true
- block_reasons: `read_only_phase`, `approval_required`, `test_click_id_rejected_for_live`

## 산출물

- JSON 결과: `data/paid-click-intent-gtm-preview-result-20260506T065628Z.json`
- screenshot: `data/paid-click-intent-preview-20260506T065628Z-gclid.png`
- screenshot: `data/paid-click-intent-preview-20260506T065628Z-gbraid.png`
- screenshot: `data/paid-click-intent-preview-20260506T065628Z-wbraid.png`
- Preview 실행 스크립트: `backend/scripts/paid-click-intent-gtm-preview.ts`
- 제한 proxy 스크립트: `backend/scripts/paid-click-intent-preview-proxy.ts`

## 사람이 이해해야 할 해석

이번 검증은 `Google click id를 저장하는 코드가 실제 브라우저에서 receiver까지 닿는가`를 본 것이다.
결론은 닿는다.

하지만 이것은 아직 운영 반영이 아니다.
지금까지 확인한 것은 아래다.

```text
테스트 URL click id -> browser storage -> preview payload -> no-send receiver
```

아직 확인하지 않은 것은 아래다.

```text
운영 GTM publish 후 실제 사용자 click id -> checkout/NPay intent -> 결제완료 주문 조인 -> Google Ads confirmed purchase upload
```

따라서 다음 단계는 바로 Google Ads 전송이 아니다.
먼저 운영 publish 승인안, 실패 시 롤백, 테스트 후 모니터링 기준을 문서로 분리해야 한다.

## 금지선 준수

- GTM Production publish: 하지 않음
- GTM Submit: 하지 않음
- Default Workspace 147 사용: 하지 않음
- Google Ads 전환 액션 생성/변경: 하지 않음
- conversion upload: 하지 않음
- GA4/Meta/Google Ads 전송: 하지 않음
- backend 운영 deploy: 하지 않음
- 운영 DB write: 하지 않음
- tunnel/proxy: 테스트 후 종료

## 다음 할 일

### Codex가 할 일

1. Google Ads landing-session click id 분모를 추가 분석한다.
   - 무엇: 전체 주문 기준 0.8%와 별도로 Google Ads 랜딩 세션 기준 click id 보존률을 산출한다.
   - 왜: 전체 주문에는 Meta, TikTok, Naver, Organic, Direct가 섞여 있어 Google Ads 문제의 실제 분모로는 거칠다.
   - 어떻게: GA4 BigQuery에서 `google / cpc`, `gclid`, `gbraid`, `wbraid`, Google Ads UTM 랜딩 세션을 뽑고, checkout/NPay intent/confirmed order와 연결률을 본다.

2. GTM Production publish 승인안을 만든다.
   - 무엇: `paid_click_intent v1`을 운영 GTM에 게시할지 판단할 승인 문서다.
   - 왜: Preview는 통과했지만 운영 publish는 Red/Yellow 경계다.
   - 어떻게: publish 범위, rollback 절차, 테스트 click id 차단, no-send/no-write 유지, 24h/72h 모니터링 지표를 적는다.

3. confirmed_purchase no-send dispatcher는 계속 보류한다.
   - 무엇: Google Ads conversion upload나 conversion action 변경은 아직 하지 않는다.
   - 왜: click id 보존 수집이 운영에서 쌓인 뒤 confirmed purchase 매칭률을 다시 봐야 한다.

### TJ님이 할 일

지금 당장 Google Ads 설정을 바꾸거나 전송을 승인할 필요는 없다.
다음에 확인할 문서는 Codex가 만드는 `GTM Production publish 승인안` 1개가 될 예정이다.

## Auditor verdict

Auditor verdict: PASS
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Recommendation: Google Ads 전송으로 넘어가지 말고, 운영 GTM publish 승인안과 landing-session click id 분모 분석을 먼저 진행한다.
Confidence: 92%.
