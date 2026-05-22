작성 시각: 2026-05-21 17:20 KST
기준일: 2026-05-21
문서 성격: GTM v3 운영 반영 결과보고

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gdn/google-paid-click-intent-gtm-v3-production-publish-approval-20260521.md
    - gdn/google-paid-click-intent-gad-campaignid-gtm-hardening-plan-20260521.md
  required_context_docs:
    - backend/scripts/paid-click-intent-gad-campaignid-gtm-publish.ts
  lane: Red approved by TJ
  allowed_actions_executed:
    - GTM workspace 169 create_version
    - GTM workspace 169 publish
    - public gtm.js version smoke
    - production page no-send receiver smoke with synthetic TEST click ids
  forbidden_actions_result:
    Google_Ads_conversion_upload: 0
    GA4_measurement_protocol_purchase_send: 0
    Meta_CAPI_manual_send: 0
    운영DB_write: 0
    backend_deploy: 0
  source_window_freshness_confidence:
    source: GTM API + public gtm.js + Playwright production page smoke + no-send receiver response
    window: 2026-05-21 17:15~17:20 KST
    freshness: 2026-05-21 17:20 KST
    confidence: 0.96
```

## 10초 요약

GTM v3 운영 반영이 완료됐다.

운영 live version은 `144`에서 `145`로 올라갔고, 실제 `biocom.kr` 페이지에서 v3 태그가 설치되는 것까지 확인했다. 새 Google click id와 `gad_campaignid`는 payload에 남고, 과거 저장소의 stale `wbraid`는 섞이지 않았다.

## 운영 반영 결과

- container: `GTM-W2Z6PHN`.
- workspace: `169`.
- tag: `279` / `codex_paid_click_intent_v1_receiver_no_send`.
- trigger: `278` / `codex_paid_click_intent_v1_all_pages_guarded`.
- live before: version `144` / `paid_click_intent_v2_gad_campaignid_20260521`.
- live after: version `145` / `paid_click_intent_v3_stale_click_id_guard_20260521`.
- publish compiler error: false.
- changed entity: tag `279` 1건.
- merge conflict: 0건.

## Evidence

- publish result: `data/gtm-paid-click-intent-tag279-production-publish-20260521T081507Z.json`.
- prepublish backup: `data/gtm-paid-click-intent-tag279-prepublish-backup-20260521T081507Z.json`.
- production smoke result: `data/gtm-paid-click-intent-tag279-production-smoke-20260521T081839Z.json`.
- production smoke screenshot: `data/gtm-paid-click-intent-tag279-production-smoke-20260521T081839Z.png`.

## Public GTM 확인

public `https://www.googletagmanager.com/gtm.js?id=GTM-W2Z6PHN` 확인 결과:

- 최초 publish 직후 1회는 CDN cache로 v2가 내려왔다.
- 2026-05-21 17:17 KST 재조회에서 v3 문자열 확인.
- `hasV3=true`.
- `hasV2=false`.

## 운영 페이지 smoke

실제 운영 페이지 `https://biocom.kr/mineraltest_store/`를 Playwright로 열었다.

테스트 조건:

- URL에는 synthetic `TEST_` `gclid`, `gbraid`, `gad_campaignid=14629255429`를 넣었다.
- localStorage/sessionStorage에는 과거 stale `wbraid`를 일부러 넣었다.
- Google/Meta/TikTok 등 외부 측정 요청은 route에서 204로 차단했다.
- 우리 no-send receiver만 허용했다.

검증 결과:

- `pageLoaded=true`.
- `v3Installed=true`.
- `payloadPresent=true`.
- `freshGclidPresent=true`.
- `freshGbraidPresent=true`.
- `staleWbraidDropped=true`.
- `gadCampaignIdFresh=true`.
- `receiverReached=true`.
- `receiverOk=true`.
- `noNetworkErrors=true`.
- `receiverNoPlatformSendVerified=true`.
- `testClickIdBlockedForLive=true`.

해석:

- 운영 페이지는 v3 태그를 받는다.
- 새 Google click id는 보존된다.
- 이전 저장소의 stale `wbraid`는 payload에 섞이지 않는다.
- synthetic `TEST_` click id는 live 후보에서 차단된다.
- 광고 플랫폼 전환 전송은 없다.

## 금지선

- Google Ads conversion upload: 0.
- GA4 Measurement Protocol purchase send: 0.
- Meta CAPI manual send: 0.
- 운영DB write: 0.
- backend deploy: 0.
- GTM Production publish: 1회, TJ님 명시 승인 범위.

주의:

no-send receiver smoke는 synthetic `TEST_` click id로 실행했다. live purchase 후보는 차단됐지만, site landing fanout diagnostic row는 1건 생성됐을 수 있다. 이는 승인된 no-send receiver smoke 범위 안의 진단 호출이다.

## 다음 할일

### TJ님이 할 일

다음 실제 Google 광고 클릭/주문 테스트 때 URL과 주문번호를 한 번 더 공유하면 된다. 목표는 실제 `TEST_`가 아닌 real `gclid/gbraid`에서 `paid_click_intent_ledger` 또는 `site_landing_ledger + attribution_ledger`가 정상 연결되는지 확인하는 것이다.

### Codex가 할 일

실제 클릭 row가 쌓이면 VM Cloud read-only로 `gad_campaignid`, `gclid/gbraid`, order bridge, campaign id matching이 연결됐는지 확인한다. 별도 승인 없이 가능한 Green Lane이다.
