# Google paid-click-intent gad_campaignid GTM 보강안

작성일: 2026-05-21 KST
대상: Biocom Google Ads click id 보존/캠페인 ID 매칭률
상태: 조사/설계 완료, GTM Preview PASS, Production publish 완료

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - gdn/!gdnplan_new.md
    - gdn/google-ads-campaignid-url-suffix-approval-20260521.md
    - gdn/google-ads-gad-campaignid-campaign-matching-design-20260520.md
  lane: "Green for this document; Yellow for GTM Preview workspace edit; Red for GTM Production publish"
  allowed_actions:
    - "read-only live GTM JS 확인"
    - "VM Cloud ledger read-only 확인"
    - "GTM 보강 방법 설계"
  forbidden_actions:
    - "GTM submit/create_version/publish"
    - "Google Ads conversion upload"
    - "운영DB write/import"
    - "광고 플랫폼 전송"
  source_window_freshness_confidence:
    source:
      - "live GTM JS GTM-W2Z6PHN"
      - "GA4/gtm.md"
      - "GA4/gtm-biocom.md"
      - "data/project/gtm-ga4-full-inventory-20260517.json"
      - "VM Cloud SQLite read-only aggregate"
      - "2026-05-21 TJ님 Google ad manual click URL"
    window: "최근 24h 및 2026-05-21 10:37 KST 수동 클릭"
    freshness: "2026-05-21 오전 KST"
    confidence: 0.93
```

## 한 줄 결론

`gclid/gbraid/wbraid`는 들어오고 있지만, 현재 GTM paid-click-intent 태그가 URL allowlist에서 `gad_campaignid`와 `gad_source`를 제외해 VM Cloud의 `paid_click_intent_ledger`에는 캠페인 ID가 0건으로 저장된다. GTM 태그 allowlist와 저장 갱신 조건을 고치면 캠페인 ID 매칭률을 바로 측정 가능한 상태로 올릴 수 있다.

## 현재 관측

- 라이브 GTM 태그: `tag_id=279`, 버전 문자열 `paid_click_intent_v1_20260506`
- 수신 endpoint: `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`
- 현재 sanitize allowlist:

```js
var ALLOW_QUERY = {
  gclid: true, gbraid: true, wbraid: true,
  utm_source: true, utm_medium: true, utm_campaign: true, utm_term: true, utm_content: true,
  idx: true
};
```

- 누락된 값: `gad_campaignid`, `gad_source`
- 2026-05-21 수동 클릭 URL에는 `gad_campaignid=14629255429`, `gbraid`, `gclid`가 있었다.
- VM Cloud 24h read-only aggregate 기준:
  - `site_landing_ledger`: `gad_campaignid` row 1건 확인
  - `paid_click_intent_ledger`: `gad_campaignid` row 0건

## gtm.md 기반 기존 Google 태그 충돌 점검

`GA4/gtm.md`는 인덱스 문서이고, 바이오컴 정본은 `GA4/gtm-biocom.md`다. 여기에 live inventory JSON과 public `gtm.js?id=GTM-W2Z6PHN`를 대조했다.

확인한 Google/GA4/Ads 관련 태그:

| tagId | 현재 역할 | 이번 보강과의 관계 | 판단 |
| --- | --- | --- | --- |
| `15` AW전환링커 | Google Ads click id 보존용 Conversion Linker | `gclid/gbraid/wbraid` 저장 기반이므로 건드리면 안 됨 | 수정 금지 |
| `38` GA4_픽셀 | GA4 `G-WJFXN5E2Q1` config | GA4 page/event 수집 기반 | 수정 금지 |
| `97` [new]Google 태그 | GA4 `G-8GZ48B1S59` config | 별도 GA4 계열 config. 이번 no-send와 무관 | 수정 금지 |
| `169` Google 태그 AW-304339096 | Google Ads config | Ads 전환 태그들의 기반 config | 수정 금지 |
| `17` tmp_바이오컴 장바구니 | Google Ads conversion 전송 | 외부 전환 전송 태그라 이번 click evidence와 분리 | 수정 금지 |
| `210` 구글애즈 회원가입 | Google Ads conversion 전송 | 외부 전환 전송 태그라 이번 click evidence와 분리 | 수정 금지 |
| `248` TechSol - [GAds]NPAY구매 51163 | Google Ads conversion 전송 | NPay 클릭/구매 전환 오염 리스크가 있어 이번 작업에서 건드리면 안 됨 | 수정 금지 |
| `26` tmp_구글 Ads 동적 리마케팅 잠재고객 | 제품 상세 리마케팅용 Custom HTML | remarketing audience 용도. paid-click evidence와 목적 다름 | 수정 금지 |
| `279` codex_paid_click_intent_v1_receiver_no_send | Google click id를 VM Cloud no-send receiver로 남기는 태그 | 이번 문제의 직접 원인. `gad_campaignid` allowlist가 빠져 있음 | 기존 태그 수정 |

충돌 가능성 판단:

1. `15`, `38`, `97`, `169`는 Google tag/config 계층이다. 여기에서 `gad_campaignid`를 다루는 것이 아니라 브라우저/Google 태그 기반을 제공한다. 수정하면 전체 측정에 영향을 주므로 제외한다.
2. `17`, `210`, `248`은 Google Ads conversion 전송 태그다. 이번 목적은 전환 전송이 아니라 내부 원장 매칭용 click evidence 보존이므로 건드리면 scope가 커지고 Red Lane으로 바뀐다.
3. `26`은 리마케팅 Custom HTML이다. 랜딩 evidence 저장/VM Cloud receiver와 역할이 다르다.
4. `279`만 no-send receiver로 `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`를 호출한다. `gad_campaignid` 누락이 실제로 발생하는 지점도 이 태그 안의 `ALLOW_QUERY`와 `landing_url` 저장 우선순위다.

## 기존 태그 수정 vs 신규 태그 생성 판단

결론: **신규 태그를 만들지 말고 기존 `tag_id=279`를 수정한다.**

이유:

1. 신규 태그를 만들면 기존 `279`와 새 태그가 같은 페이지뷰에서 동시에 실행될 수 있다. 둘 다 all pages 계열이면 no-send receiver POST가 2번 발생해 ledger 중복/디버그 혼선이 생긴다.
2. 기존 `279`는 이미 `STORAGE_KEY=bi_paid_click_intent_v1`, `SENT_KEY=bi_paid_click_intent_v1_sent`, receiver URL, admin/internal path guard, click id guard를 갖고 있다. 문제는 태그 구조가 아니라 allowlist와 stale landing 우선순위다.
3. 기존 태그를 수정하면 `trigger_id=278`과 dedupe 방식은 유지하면서 변경 범위를 `Custom HTML 본문`으로 제한할 수 있다.
4. Production publish 후 rollback도 단순하다. 같은 태그 `279`의 HTML을 이전 백업값으로 되돌리면 된다.

실행 방식:

- fresh GTM workspace에서 `tag_id=279`만 수정한다.
- 태그명은 운영 식별을 위해 `codex_paid_click_intent_v2_receiver_no_send`로 바꾸거나, 이름은 유지하고 HTML 내부 `VERSION`만 v2로 올린다. 기능상 필수는 `VERSION` 변경이다.
- `trigger_id=278`는 유지한다.
- `STORAGE_KEY`는 일단 `bi_paid_click_intent_v1` 유지한다. 키를 바꾸면 기존 dedupe와 세션 연결이 끊겨 전후 비교가 어려워진다.
- `SENT_KEY`도 유지하되, `landing` stage dedupe가 너무 강하게 막는지 Preview에서 확인한다. 필요하면 `VERSION` 또는 `gad_campaignid`를 dedupe key에 더하는 것은 별도 보강으로 분리한다.

## 원인

1. GTM 태그가 `location.href`를 그대로 보내지 않고 `sanitizeUrl()`로 허용된 query만 남긴다.
2. `ALLOW_QUERY`에 `gad_campaignid`/`gad_source`가 없어서 paid-click-intent payload의 `landing_url/current_url`에서 제거된다.
3. `landing_url: stored.landing_url || sanitizeUrl(location.href)` 구조라, 같은 브라우저에 과거 Google 클릭 evidence가 남아 있으면 새 광고 클릭의 랜딩 URL보다 기존 저장값이 우선될 수 있다.
4. backend는 `gad_campaignid`를 파싱할 준비가 일부 되어 있지만, GTM에서 제거된 값은 backend가 복구할 수 없다.

## GTM 보강 방법

### 1. 태그 버전 올리기

```js
var VERSION = "paid_click_intent_v2_gad_campaignid_20260521";
```

목적: VM Cloud row와 브라우저 디버그에서 새 태그가 실제로 로드됐는지 구분한다.

### 2. URL allowlist 확장

```js
var ALLOW_QUERY = {
  gclid: true, gbraid: true, wbraid: true,
  gad_source: true, gad_campaignid: true, utm_id: true,
  utm_source: true, utm_medium: true, utm_campaign: true, utm_term: true, utm_content: true,
  idx: true
};
```

목적:
- `gclid/gbraid/wbraid`: 클릭 식별자 유지
- `gad_campaignid`: Google 캠페인 ID 힌트 유지
- `gad_source`: Google Ads 유입 힌트 유지
- `utm_id`: 향후 URL suffix 표준화 시 캠페인 ID 보조 힌트로 활용

주의: `gad_campaignid`는 클릭 ID가 아니므로 단독으로 Google Ads 업로드 후보가 되면 안 된다. 업로드 후보 판단은 계속 `gclid/gbraid/wbraid` 중심이어야 한다.

### 3. 새 Google 유입이면 landing_url을 새로 덮어쓰기

```js
function hasIncomingGoogleEvidence() {
  return Boolean(
    getParam("gclid") ||
    getParam("gbraid") ||
    getParam("wbraid") ||
    getParam("gad_campaignid") ||
    getParam("gad_source")
  );
}
```

`currentEvidence()` 안에서:

```js
var incomingGoogleEvidence = hasIncomingGoogleEvidence();
var currentSanitizedUrl = sanitizeUrl(location.href);
var currentSanitizedReferrer = sanitizeUrl(document.referrer || "");

var evidence = {
  ...
  gad_campaignid: getParam("gad_campaignid") || stored.gad_campaignid || "",
  gad_source: getParam("gad_source") || stored.gad_source || "",
  landing_url: incomingGoogleEvidence ? currentSanitizedUrl : (stored.landing_url || currentSanitizedUrl),
  current_url: currentSanitizedUrl,
  referrer: incomingGoogleEvidence ? currentSanitizedReferrer : (stored.referrer || currentSanitizedReferrer),
  ...
};
```

목적: 같은 브라우저에서 과거 클릭 흔적이 남아 있어도, 새 Google 광고 클릭이 들어오면 이번 클릭의 URL을 우선한다.

### 4. 저장/전송 조건은 보수적으로 유지

현재 `sendNoSend()`는 `hasGoogleClickId(payload)`가 false면 보내지 않는다.

```js
function hasGoogleClickId(payload) {
  return Boolean(payload.gclid || payload.gbraid || payload.wbraid);
}
```

이 조건은 유지한다. `gad_campaignid`만 있는 방문을 paid-click-intent ledger에 넣으면 캠페인 힌트만 있고 클릭 식별자가 없는 row가 생겨 주문 연결 품질이 흐려진다.

### 5. backend 보조 보강

GTM이 `landing_url`에 `gad_campaignid`를 남기면 현재 backend도 `allowed_query_json`에 넣을 수 있다. 다만 방어적으로 다음을 추가하면 안전하다.

- `recordPaidClickIntent()` 호출 때 `sanitized_current_url`, `gad_campaignid`, `gad_source`도 preview에서 넘긴다.
- `backend/src/paidClickIntentLog.ts`의 `buildAllowedQueryJson()`에서 `preview.gad_campaignid || landing_url param || current_url param` 순서로 캠페인 ID를 찾는다.

이 보조 보강은 GTM Preview 전에 backend만 먼저 배포해도 외부 전송은 없다. 단, 이미 GTM에서 URL이 제거되면 이 보강만으로는 해결되지 않는다.

## 검증 순서

### Sprint 1. GTM Preview only

승인 필요: YES, GTM Preview workspace edit. Production publish 금지.

1. GTM에서 fresh workspace 생성
2. 현재 live container JSON 백업
3. `tag_id=279` paid-click-intent custom HTML만 수정
4. Preview 모드에서 아래 테스트 URL 진입

```text
https://biocom.kr/mineraltest_store/?idx=6&utm_source=googleads_testsa_mineral_sa&utm_medium=googleads_testsa_mineral_sa&utm_campaign=googleads_testSA_mineral_SA&utm_content=googleads_testSA_mineral_SA&gad_source=1&gad_campaignid=14629255429&gbraid=TEST_GBRAID_GAD_20260521&gclid=TEST_GCLID_GAD_20260521
```

성공 기준:
- 브라우저 콘솔 `window.__seo_paid_click_intent_installed`가 v2 버전
- `window.__seo_paid_click_intent_last_payload.landing_url`에 `gad_campaignid=14629255429` 포함
- `window.__seo_paid_click_intent_last_payload.gad_campaignid === "14629255429"`
- Preview 상태에서 no-send receiver가 200 또는 test click id 차단 사유를 명확히 반환

### Sprint 2. Backend receiver defense patch

승인 필요: backend 배포 승인. 외부 플랫폼 전송 없음.

성공 기준:
- `allowed_query_json`이 `gad_campaignid`를 `landing_url`, `current_url`, explicit field 중 하나에서 저장 가능
- `npm run build`
- paid-click-intent no-send endpoint local smoke 통과

### Sprint 3. Production publish

승인 필요: YES, Red Lane. GTM Production publish.

성공 기준:
- 신규 실제 Google 광고 클릭 1건 이후 5분 내 `paid_click_intent_ledger.allowed_query_json`에 `gad_campaignid` 저장
- 24h 기준 `paid_click_intent_ledger.gad_campaignid_rows > 0`
- `site_landing_ledger`와 `paid_click_intent_ledger`의 campaign id가 같은 클릭에서 일치
- `Google click id 보존률` 카드에 캠페인 ID row가 반영

중단 기준:
- no-send receiver 5xx/CORS 반복
- `paid_click_intent_ledger` duplicate spike
- raw PII, 주문번호, 결제금액이 payload에 섞임
- click id 없이 `gad_campaignid`만 있는 row가 대량 유입

## TJ님 확인 포인트

GTM Production publish 전까지는 외부 광고 플랫폼 전송이 없다. 다만 GTM 태그 publish는 전체 Biocom 페이지에 영향을 주므로 Preview 성공 후 별도 승인으로 진행한다.

## 2026-05-21 Preview workspace 수정 결과

TJ님 승인 후 기존 `tag_id=279`의 HTML을 백업하고, fresh workspace 안에서만 수정했다. Production publish는 하지 않았다.

백업/결과:

- dry-run backup: `data/gtm-paid-click-intent-tag279-backup-20260521T031354Z.json`
- apply backup JSON: `data/gtm-paid-click-intent-tag279-backup-20260521T031433Z.json`
- 기존 HTML backup: `data/gtm-paid-click-intent-tag279-backup-20260521T031433Z.html`
- 수정 HTML copy: `data/gtm-paid-click-intent-tag279-v2-20260521T031433Z.html`
- 적용 결과 JSON: `data/gtm-paid-click-intent-tag279-gad-campaignid-preview-update-20260521T031433Z.json`

GTM 변경 상태:

- workspace id: `168`
- workspace name: `codex_paid_click_intent_gad_campaignid_preview_20260521T031433Z`
- 변경 entity: 기존 `tag_id=279` 1개
- 변경 상태: `updated`
- 연결 trigger: `trigger_id=278` 유지
- blocking trigger: 없음 유지
- storage key: `bi_paid_click_intent_v1` 유지
- sent dedupe key: `bi_paid_click_intent_v1_sent` 유지
- receiver URL: `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send` 유지
- submit/create_version/publish: 0건
- 외부 광고 플랫폼 전송: 0건

수정 내용:

- `VERSION`: `paid_click_intent_v2_gad_campaignid_20260521`
- `ALLOW_QUERY`: `gad_campaignid`, `gad_source`, `utm_id` 추가
- payload: `gad_campaignid`, `gad_source`, `utm_id` 필드 추가
- 새 Google evidence가 들어오면 `landing_url`을 현재 sanitized URL로 갱신하도록 변경
- 기존 `gclid/gbraid/wbraid` 없으면 no-send POST하지 않는 guard 유지

Preview 적용 직후 검증:

- public live `gtm.js?id=GTM-W2Z6PHN`에는 당시 `paid_click_intent_v1_20260506`만 보였다. 즉 Preview 적용 직후에는 운영 페이지가 아직 미변경이었다.
- 수정 HTML 파일에는 `paid_click_intent_v2_gad_campaignid_20260521`, `gad_campaignid`, `gad_source`, `hasIncomingGoogleEvidence`가 포함되어 있다.
- `python3 scripts/harness-preflight-check.py --strict` 통과.

## 2026-05-21 Preview smoke 결과

결론: Preview smoke는 `gad_campaignid` 보존 관점에서 PASS다. 결제 테스트는 필요 없었다.

실행:

- workspace id: `168`
- quick preview environment id: `303`
- 테스트 URL: `https://biocom.kr/mineraltest_store/?idx=6&...&gad_source=1&gad_campaignid=14629255429&gbraid=TEST_...&gclid=TEST_...`
- 결과 JSON: `data/gtm-paid-click-intent-tag279-preview-smoke-20260521T032711Z.json`
- 화면 캡처: `data/gtm-paid-click-intent-tag279-preview-smoke-20260521T032711Z.png`

PASS:

- page loaded: true
- GTM loaded: true
- v2 installed: true (`paid_click_intent_v2_gad_campaignid_20260521`)
- payload present: true
- `gad_campaignid` in payload: true (`14629255429`)
- `gad_source` in payload: true (`1`)
- `gad_campaignid` in landing_url: true
- Google click id present: true
- no-send receiver reached: true
- no-send receiver ok: true

Receiver 확인:

- receiver preview `gad_campaignid`: `14629255429`
- receiver preview `gad_source`: `1`
- receiver preview `sanitized_landing_url`에 `gad_campaignid=14629255429` 포함
- block reasons: `read_only_phase`, `approval_required`, `test_click_id_rejected_for_live`
- `test_click_id=true`라 live 후보/전환 후보는 아님

주의:

- 기존 live Google tag들이 page_view 계열 Google collect URL을 만들려고 했다. 두 번째 smoke에서는 해당 Google collect/Ads/GA4 measurement 요청을 Playwright route에서 차단/204 처리했다.
- no-send receiver는 200을 반환했고, `site_landing_fanout`은 `ok=true`, `landing_id_prefix=sll-ac77309b`였다. 즉 외부 광고 플랫폼 전송은 없었지만 VM Cloud site_landing 보조 row 1건은 생겼다.
- paid-click-intent live 후보 write는 test click id라 차단됐다.

Workspace 상태:

- `168`: 현재 작업 workspace. 변경 1건, 기존 `tag_id=279` updated, conflict 0.
- `167`: 예전 `AGENT_OS_path_b_controlled_traffic_preview_20260509T155435Z` workspace. tag `301` + trigger `300` added 상태, conflict 0. 현재 작업과 직접 충돌 없음.
- `147` Default Workspace: 변경 0건, conflict 0. 그대로 두면 된다.

## 2026-05-21 Production publish 결과

TJ님 Production publish 승인 후 workspace `168`만 create version/publish 했다. workspace `167`과 Default Workspace는 publish하지 않았다.

배포 결과:

- container: `GTM-W2Z6PHN`
- published workspace id: `168`
- published tag: 기존 `tag_id=279` 1개
- trigger: 기존 `trigger_id=278` 유지
- live before: container version `142` / `paid_click_intent_v1_receiver_20260506T150218Z`
- live after: container version `144` / `paid_click_intent_v2_gad_campaignid_20260521`
- compiler error: false
- no-send receiver URL 유지: `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`
- Google Ads 전환 태그 신규 생성: 없음
- 광고 플랫폼 conversion upload/send: 없음
- backend deploy: 없음

백업/결과 파일:

- prepublish backup: `data/gtm-paid-click-intent-tag279-prepublish-backup-20260521T033252Z.json`
- publish result: `data/gtm-paid-click-intent-tag279-production-publish-20260521T033252Z.json`
- Preview smoke JSON: `data/gtm-paid-click-intent-tag279-preview-smoke-20260521T032711Z.json`
- Preview smoke PNG: `data/gtm-paid-click-intent-tag279-preview-smoke-20260521T032711Z.png`

라이브 검증:

- public live `https://www.googletagmanager.com/gtm.js?id=GTM-W2Z6PHN`에서 `paid_click_intent_v2_gad_campaignid_20260521` 확인.
- public live `gtm.js`에서 `gad_campaignid`와 `utm_id` 문자열 확인.
- live browser smoke run id: `20260521T033550Z`
- GTM loaded: true
- installed version: `paid_click_intent_v2_gad_campaignid_20260521`
- test URL의 `gad_campaignid`: `14629255429`
- payload `gad_campaignid`: `14629255429`
- payload `gad_source`: `1`
- landing URL에 `gad_campaignid` 보존: true
- Google click id 존재: true
- no-send receiver status: 200
- no-send receiver ok: true
- receiver block reasons: `read_only_phase`, `approval_required`, `test_click_id_rejected_for_live`
- Google 외부 measurement 요청은 smoke 중 7건 차단했다. 테스트 클릭 ID라 광고 플랫폼 전환 후보로 쓰이지 않는다.

Workspace 개념과 현재 판단:

- GTM Workspace는 운영에 바로 반영되는 화면이 아니라, live container를 기준으로 만든 초안/작업 브랜치다.
- 실제 사이트에서 실행되는 것은 workspace가 아니라 마지막으로 publish된 container version이다. 현재 live는 version `144`다.
- workspace `168`은 publish 후 활성 workspace 목록에서 빠졌다. publish된 변경은 workspace가 아니라 live container version `144`에 들어가 있다.
- workspace `168`을 publish해도 workspace `167`의 초안 변경은 사라지지 않았다.
- 다만 workspace `167`의 변경은 publish되지 않았으므로 운영에는 발효되지 않는다.
- workspace `167`은 이제 live version `144`보다 오래된 기준에서 만든 초안일 수 있다. 나중에 그대로 publish하면 `tag_id=279`의 최신 변경을 포함하지 않거나, merge/sync 확인 없이 과거 상태를 섞을 위험이 있다.
- Default Workspace `147`은 변경 0건이므로 깨끗한 기준점으로 남겨두는 것이 맞다.
- 운영 원칙은 `Default Workspace는 깨끗하게 유지`하고, 실제 작업은 `목적이 분명한 fresh workspace 1개`에서만 진행하는 것이다.
- 여러 workspace를 남겨두는 것 자체는 가능하지만, 오래된 workspace는 백업 후 삭제하거나 `abandoned/old preview`로 명확히 관리해야 accidental publish 리스크가 줄어든다.

Publish 후 read-only workspace 재확인:

- 확인 시각: 2026-05-21T03:41:18Z
- live container: version `144` / `paid_click_intent_v2_gad_campaignid_20260521`
- active workspace `168`: 목록에 없음. publish 완료로 live version에 반영된 상태.
- active workspace `167`: 변경 2건 유지. tag `301` added, trigger `300` added, conflict 0.
- active workspace `147` Default Workspace: 변경 0건, conflict 0.

## 2026-05-21 실제 Google 클릭 검증

TJ님이 2026-05-21 13:15~13:16 KST에 실제 Google 광고 클릭 후 가상계좌 미입금 주문까지 진행했다.

테스트 입력:

- 광고 클릭 랜딩: `/mineraltest_store/?idx=6&...&gad_campaignid=14629255429&gbraid=...&gclid=...`
- 주문서 진입: `/shop_payment/` 패턴 확인. 원문 주문 식별자는 보고서에 보관하지 않음.
- 주문완료 URL: `/shop_payment_complete` 패턴 확인. 원문 주문/결제 식별자는 보고서에 보관하지 않음.
- 주문 상태: 가상계좌 주문 생성, 미입금
- pixel id 관측: `1283400029487161`

VM Cloud read-only 결과:

- source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`
- 확인 시각: 2026-05-21T04:21~04:26Z
- window: 2026-05-21T04:10~04:25Z
- `site_landing_ledger`: TJ님 gclid prefix exact match 2건, gbraid prefix match 12건.
- `site_landing_ledger`: TJ님 랜딩 URL row에 `gad_campaignid=14629255429`, `utm_source=googleads_testsa_mineral_sa`, `utm_campaign=googleads_testSA_mineral_SA` 보존.
- `site_landing_ledger`: 주문서 진입 `/shop_payment/`와 주문완료 `/shop_payment_complete` row에도 같은 Google UTM/click-id hash가 이어짐.
- `attribution_ledger`: 동일 safe 주문 키 기준 3건 확인.
  - `payment_page_seen` 1건
  - `checkout_started` 1건
  - `payment_success` 1건
- `attribution_ledger`: `payment_success.payment_status=pending`. 가상계좌 미입금이라 confirmed purchase가 아니다.
- `attribution_ledger`: 위 3건 모두 Google `gclid`와 `utm_campaign=googleads_testSA_mineral_SA`를 보존.
- `paid_click_intent_ledger`: publish 이후 전체로는 `gad_campaignid`가 저장되기 시작했다. publish 후 기준 `landing 16건 중 13건`, `checkout_start 4건 중 4건`, `npay_intent 4건 중 3건`에 campaign id가 있다.
- `paid_click_intent_ledger`: 그러나 TJ님 이번 exact gclid/gbraid와 같은 row는 0건이었다.
- Meta CAPI send log: 동일 safe 주문 키 match 0건.
- Meta CAPI send log: 2026-05-21T04:10~04:25Z window send row 0건.

해석:

- 성공: live GTM v2 이후 실제 Google 유입에서 `gad_campaignid` 보존은 작동한다.
- 성공: TJ님 주문 여정은 VM Cloud `site_landing_ledger`와 `attribution_ledger`에 Google click id/UTM/order_no로 연결됐다.
- 성공: 가상계좌 미입금 주문은 `payment_success` URL까지 갔지만 `pending`으로 남았고, Meta CAPI Purchase로 전송되지 않았다. 이는 현재 guard 기준상 정상이다.
- 보류: TJ님 exact click은 `site_landing_ledger`에는 있으나 `paid_click_intent_ledger`에는 없다. `PAID_CLICK_INTENT_WRITE_ENABLED=true`, `PAID_CLICK_INTENT_WRITE_SAMPLE_RATE=1`이므로 단순 샘플링 누락은 아니다.
- 추정 원인: GTM `bi_paid_click_intent_v1_sent` dedupe 또는 브라우저 storage state가 특정 클릭의 paid-click minimal ledger 저장만 막고, no-send receiver의 site_landing fanout은 저장한 것으로 보인다. 이 부분은 후속으로 dedupe key/response logging을 보강해야 한다.
- 기준점 판단: Google ROAS 재계산 기준점은 `site_landing_ledger + attribution_ledger` 기준으로는 승격 가능하다. `paid_click_intent_ledger` 단독 기준점은 exact-click miss 원인 해소 전까지 보류한다.

## 다음 할일

1. Codex: paid-click-intent exact-click miss 원인을 Green Lane으로 좁힌다. 우선 GTM dedupe key, `bi_paid_click_intent_v1_sent`, backend response의 `ledger` field, site_landing fanout source를 함께 보는 no-write diagnostic을 설계한다.
2. Codex: Google ROAS report의 campaign id health에서 `site_landing_ledger`와 `paid_click_intent_ledger`를 분리 표시한다. 지금은 site landing 기준은 성공, paid click minimal ledger 기준은 부분 성공이다.
3. Codex: workspace `167`은 publish하지 않고, 백업 후 cleanup할지 별도 판단한다. Default Workspace `147`은 변경 0건 기준점으로 유지한다.
