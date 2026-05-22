# 더클린커피 구독 Intent GTM Preview 후보

작성 시각: 2026-05-22 13:23 KST
기준일: 2026-05-22
문서 성격: 더클린커피 정기구독 신청 intent를 GTM Preview에서 no-send로 검증하기 위한 태그/트리거 후보
Lane: Green design artifact / Yellow needed for GTM Preview execution / Red needed for GTM Production publish

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
    - harness/coffee-data/LIVE_TAG_INVENTORY.md
  required_context_docs:
    - data/coffee-live-tracking-inventory-20260501.md
    - imweb/!coderule-thecleancoffee.md
    - project/coffee-subscribe-intent-nosend-design-20260522.md
    - project/coffee-subscribe-intent-gtm-vs-footer-review-20260522.md
  lane: Green
  allowed_actions:
    - GTM Preview tag/trigger candidate writing
    - no-send Custom HTML candidate writing
    - local syntax validation
    - documentation
  forbidden_actions:
    - GTM workspace create/update without separate approval
    - GTM Submit/Create version/Production publish
    - Imweb save/publish
    - Meta browser event send
    - Meta CAPI enable/send
    - GA4/Google Ads/Naver production send
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: TJ님 Chrome observation + live HTML 조건 기록 + local no-send fixture + Coffee live tracking inventory
    window: 2026-05-22 11:58-13:23 KST
    freshness: same-day observation; live inventory snapshot is 2026-05-01 and marked stale for actual Preview execution
    confidence: 0.9 for tag/trigger candidate; 0.72 for actual GTM Preview until live inventory is refreshed
```

## 10초 요약

정기구독 신청은 GTM Preview에서 먼저 no-send로 확인하는 편이 맞다.

이 후보는 실제 Meta/GA4/Google Ads 전송을 만들지 않는다. GTM Custom HTML 태그가 `/subscription` 페이지에서 클릭 listener를 설치하고, 실제 정기구독 신청 버튼을 누를 때만 `dataLayer`에 `coffee_subscribe_intent_preview`를 남긴다.

GTM Preview 실행은 Yellow Lane이다. fresh workspace에서 Preview만 열고, Submit/Create version/Publish는 하지 않는다.

## 현재 결론

지금 만들 후보는 운영 전환 태그가 아니다.

목적은 아래 질문 하나를 검증하는 것이다.

> 옵션 드롭다운이나 장바구니가 아니라, 실제 `정기구독 신청` 버튼 클릭만 안정적으로 분리되는가?

검증이 통과하면 그 다음에 운영 반영 경로를 고른다. 운영 반영은 GTM Production publish 또는 Imweb 저장이 필요하므로 Red Lane이다.

## 태그 후보

### Tag 1 — listener installer

태그 이름:

```text
AGENTOS - [no-send] coffee_subscribe_intent_preview_listener
```

태그 타입:

```text
Custom HTML
```

붙여넣을 코드:

```text
scripts/coffee-subscribe-intent-gtm-preview-tag.html
```

GTM 설정:

```text
Support document.write: unchecked
Tag firing options: Once per page
Consent settings: no additional consent required for Preview, because no external send occurs
```

태그가 하는 일:

- `/subscription` 페이지에서 click listener를 설치한다.
- 실제 신청 버튼 조건을 만족할 때만 `window.dataLayer.push(...)`를 실행한다.
- `window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_LAST__`에 마지막 payload를 남긴다.
- `window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__`에 preview history를 남긴다.
- `fbq`, `gtag`, `fetch`, `sendBeacon`, `Image`, `facebook.com/tr`, `att.ainativeos.net`를 호출하지 않는다.

### Optional Tag 2 — Preview logger

기본 후보에는 넣지 않는다.

Tag Assistant의 dataLayer event만으로 관측이 불편하면 아래를 추가할 수 있다.

```text
AGENTOS - [debug only] coffee_subscribe_intent_preview_logger
```

트리거:

```text
Custom Event = coffee_subscribe_intent_preview
```

동작:

```js
console.info('[coffee-subscribe-intent-gtm-preview] dataLayer observed', {{DLV - eventID}});
```

주의: logger 태그도 Preview 전용이다. 운영 publish 전에는 제거하거나 debug-only 상태로 남겨야 한다.

## 트리거 후보

### Trigger A — DOM Ready installer

트리거 이름:

```text
DOM Ready - Coffee subscription pages - Preview only
```

트리거 타입:

```text
DOM Ready
```

조건:

```text
Page Hostname equals thecleancoffee.com
Page Path matches RegEx ^/subscription/?$
```

선택 이유:

- listener 설치는 페이지 로드 후 한 번이면 충분하다.
- 클릭 target이 span/icon처럼 버튼 내부 자식 노드여도 Custom HTML 안의 `closest(...)`가 실제 버튼을 찾는다.
- GTM의 Click trigger만 쓰는 방식보다 오탐/누락을 줄인다.

### Trigger B — Custom Event observer

선택 사항이다.

트리거 이름:

```text
Custom Event - coffee_subscribe_intent_preview - Preview observe only
```

트리거 타입:

```text
Custom Event
```

Event name:

```text
coffee_subscribe_intent_preview
```

용도:

- Optional logger 태그에만 연결한다.
- 이 트리거를 Meta/GA4/Google Ads 태그에 연결하지 않는다.

## 버튼 판정 조건

신청 intent로 인정하려면 모두 만족해야 한다.

```text
path = /subscription or /subscription/
closest action element = a, button, [role="button"]
data-bs-is-regularly-prod = true
data-bs-content = purchase
data-bs-payment-button-type = imweb_payment
class contains im-regularly
text contains "정기구독 신청" or text exactly "정기구독"
```

제외해야 하는 클릭:

- 옵션 드롭다운 `중량 (필수)`, `분쇄도 (필수)`
- 일반 상품의 `구매하기`
- 정기구독 상품의 `장바구니`
- 모바일 옵션 패널을 여는 버튼
- `/thecleancoffee/?idx=75` 일반 상품 페이지 클릭

## Preview payload 후보

`dataLayer`에 남는 값은 아래 형태다.

```js
{
  event: 'coffee_subscribe_intent_preview',
  eventName: 'SubscribeIntentPreview',
  eventID: 'SubscribeIntentPreview.{hash}',
  noSend: true,
  noFbq: true,
  noPixelRequest: true,
  noNetwork: true,
  gtmPreviewOnly: true,
  snippetVersion: '2026-05-22-coffee-subscribe-intent-gtm-preview-v1',
  pagePath: '/subscription/',
  customData: {
    intent_type: 'subscription_application',
    currency: 'KRW',
    value: 18900,
    value_status: 'present',
    value_selector: 'main text:총 상품금액',
    product_idx: '74',
    product_code_present: true,
    product_code_hash: '{8-char-hash}',
    product_type: 'normal',
    where: 'shop_view',
    payment_button_type: 'imweb_payment',
    is_regularly_prod: true,
    button_text_class: 'subscribe_apply',
    element_class_hash: '{8-char-hash}',
    subscription_path: true
  }
}
```

원문으로 남기지 않는 값:

- raw product code
- order code/order no/payment key
- member id
- phone/email
- raw click id
- funnel session id

## GTM Preview 실행 전 조건

Preview 실행은 Yellow Lane이다.

실행 전 체크:

1. Default Workspace를 쓰지 않는다.
2. live latest 기준 fresh workspace를 만든다.
3. workspace capacity preflight를 확인한다.
4. workspace JSON backup 정책을 정한다.
5. live version unchanged를 확인할 수 있어야 한다.
6. `data/coffee-live-tracking-inventory-20260501.md`가 7일 이상 stale이므로 Preview 직전에 현재 console marker를 다시 확인한다.

## 승인된 Preview 실행 체크리스트

승인 시각: 2026-05-22 KST
승인 범위: GTM Preview 실행만 허용. Submit/Create version/Production publish는 제외.

실행 전 API/문서 체크:

1. 대상 컨테이너가 더클린커피 `GTM-5M33GC4`인지 확인한다.
2. live version before를 기록한다.
3. 기존 workspace 수와 Default Workspace 사용 여부를 기록한다.
4. fresh workspace 이름은 `codex_coffee_subscribe_intent_preview_<run_id>` 형식으로 만든다.
5. Preview 전용 trigger/tag만 만든다.
6. trigger는 `/subscription` path에만 제한하고, tag 내부도 `/subscription` path guard를 가진다.
7. quick preview `compilerError=null`을 확인한다.
8. Preview smoke는 실제 결제/장바구니 이동 없이 synthetic button click으로 먼저 수행한다.
9. smoke 후 workspace backup JSON을 저장하고 workspace를 삭제한다.
10. live version after가 before와 같은지 확인한다.

자동화 성공 기준:

1. workspace는 Default Workspace가 아니다.
2. quick preview 환경 auth code가 발급된다.
3. `/subscription/?idx=74`에서 listener marker가 설치된다.
4. synthetic 정기구독 신청 버튼 클릭 1회당 `coffee_subscribe_intent_preview` 1건이 dataLayer에 생긴다.
5. 1.5초 이내 rapid double click은 1건으로 dedupe된다.
6. synthetic dropdown/option click은 dataLayer event를 만들지 않는다.
7. 일반 상품 path에서는 같은 button 조건을 만들어도 event가 생기지 않는다.
8. click 이후 Meta/GA4/Google Ads/Naver/VM Cloud attribution 네트워크 전송 delta가 0이다.
9. cleanup 후 Preview workspace가 삭제되고 live version은 바뀌지 않는다.

자동화 중단 기준:

1. workspace 생성/quick preview가 Submit/Create version/Publish를 요구한다.
2. quick preview compiler error가 생긴다.
3. `/subscription` 외 path에서 event가 생긴다.
4. option/dropdown click에서 event가 생긴다.
5. synthetic click 이후 `facebook.com/tr`, `google-analytics.com/g/collect`, `googleadservices`, `wcs.naver`, `att.ainativeos.net` 신규 전송이 감지된다.
6. cleanup 실패 또는 live version 변경이 감지된다.

금지:

- Submit
- Create version
- Production publish
- Meta/GA4/Google Ads/Naver 태그 연결
- Imweb 저장
- VM Cloud write flag 변경

## Preview 테스트 절차

대상 URL:

```text
https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1
```

확인 콘솔:

```js
window.dataLayer.filter(function (item) {
  return item && item.event === 'coffee_subscribe_intent_preview';
});
```

```js
window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__ || [];
```

네트워크 추가 전송 확인:

```js
performance.getEntriesByType('resource')
  .filter(function (entry) {
    return /facebook\.com\/tr|att\.ainativeos\.net|google-analytics\.com\/g\/collect|googleadservices|pay\.naver|wcs\.naver/.test(entry.name);
  })
  .map(function (entry) { return entry.name; });
```

주의: 페이지 로드 자체의 기존 PageView/ViewContent/Naver script 요청은 있을 수 있다. 테스트는 `정기구독 신청` 클릭 전후 delta를 비교한다.

## 성공 기준

1. `/subscription/?idx=74` 페이지 로드 시 listener tag가 1회 firing된다.
2. 옵션 드롭다운 클릭 시 `coffee_subscribe_intent_preview` 0건이다.
3. 정기구독 장바구니 클릭 시 0건이다.
4. 모바일 옵션 열기 버튼 클릭 시 0건이다.
5. PC `정기구독 신청` 최종 버튼 클릭 시 1건이다.
6. 모바일 최종 `정기구독` 버튼 클릭 시 1건이다.
7. 같은 버튼 rapid double click은 1.5초 안에 1건으로 dedupe된다.
8. payload `value`는 읽히면 `18900`, 못 읽히면 `null + value_status=missing`이다.
9. raw product code/session id/phone/email이 payload에 없다.
10. Preview 종료 후 GTM live version이 바뀌지 않는다.

## 중단 기준

아래 중 하나면 Preview를 멈춘다.

- 옵션 드롭다운에서 preview event가 생긴다.
- 일반 상품 페이지에서 preview event가 생긴다.
- `fbq`, `gtag`, Meta CAPI, Google Ads, Naver 전송이 새로 생긴다.
- GTM이 Submit/Create version/Publish를 요구하는 단계로 넘어간다.
- Default Workspace에서 작업 중임이 확인된다.
- live version이 바뀐다.

## 작성 후 로컬 검증

이번 문서와 태그 후보 작성 후 로컬에서 확인한 결과다.

실행한 검증:

```bash
node - <<'NODE'
// scripts/coffee-subscribe-intent-gtm-preview-tag.html 안의 <script> 본문 syntax check
NODE

node --check scripts/coffee-subscribe-intent-nosend-snippet.js
node scripts/coffee-subscribe-intent-nosend-smoke.mjs
python3 scripts/validate_wiki_links.py project/coffee-subscribe-intent-gtm-preview-candidate-20260522.md
python3 scripts/harness-preflight-check.py --strict
git diff --check -- scripts/coffee-subscribe-intent-gtm-preview-tag.html project/coffee-subscribe-intent-gtm-preview-candidate-20260522.md
```

결과:

- GTM Custom HTML 내부 스크립트 syntax check: PASS
- 기존 구독 no-send fixture: 9/9 PASS
- 새 GTM Preview 태그 후보 최소 Playwright smoke: 3/3 PASS
- wiki link validation: PASS
- harness preflight strict: PASS
- diff check: PASS
- 새 GTM HTML 후보에서 `fbq`, `gtag`, `fetch`, `sendBeacon`, `Image`, Meta/GA4/Google Ads/Naver 전송 호출 패턴: 0건
- 새 GTM HTML 후보에서 SQL/DB write 패턴: 0건

## GTM Preview 실행 결과

실행 시각: 2026-05-22 KST
승인 범위: TJ님 승인으로 GTM Preview만 실행. Submit/Create version/Production publish 없음.

### 1차 실행: HOLD

- 결과 파일: `data/coffee-subscribe-intent-gtm-preview-result-20260522T051358Z.json`
- workspace: `accounts/4703003246/containers/13158774/workspaces/170`
- verdict: `HOLD_GTM_PREVIEW_REVIEW_REQUIRED`
- 원인: public id는 Coffee `GTM-5M33GC4`로 테스트했지만 numeric container id `13158774`는 Biocom 컨테이너였다.
- 영향: workspace는 삭제됐고 live version은 unchanged였다.
- 후속 조치: `data/project/gtm-ga4-full-inventory-20260517.json` 기준 Coffee numeric container id `91608400`을 확인하고, script에 public id mismatch guard를 추가했다.

### 2차 실행: PASS

- 결과 파일: `data/coffee-subscribe-intent-gtm-preview-result-20260522T051604Z.json`
- backup 파일: `data/coffee-subscribe-intent-gtm-preview-workspace-backup-20260522T051604Z.json`
- container: `GTM-5M33GC4` / `accounts/4703003246/containers/91608400`
- live version before/after: `21` / `AGENTSOS GA4 begin_checkout rename - 2026-05-18`
- live version unchanged: `true`
- workspace: `codex_coffee_subscribe_intent_preview_20260522T051604Z` / id `27`
- quick preview: compiler error `null`, environment id `90`
- workspace change count: 2 (preview tag 1 + preview trigger 1)
- merge conflict count: 0
- cleanup: workspace deleted, still open after cleanup `false`
- verdict: `PASS_GTM_PREVIEW_NO_SEND_CLEANED`

Smoke 결과:

1. `/subscription/?idx=74` synthetic 정기구독 신청 click: PASS
   - listener installed: `2026-05-22-coffee-subscribe-intent-gtm-preview-v1`
   - dataLayer event delta: 1
   - history delta: 1
   - external measurement delta after click: 0
2. `/subscription/?idx=74` synthetic option/dropdown click: PASS
   - dataLayer event delta: 0
   - external measurement delta after click: 0
3. `/thecleancoffee/?idx=75` 일반 상품 path valid-shape synthetic click: PASS
   - listener installed: `null`
   - dataLayer event delta: 0
   - external measurement delta after click: 0

해석:

- GTM Preview 기준 구독 intent no-send listener는 Coffee subscription path에서만 동작한다.
- 옵션/드롭다운류 클릭은 event로 잡히지 않았다.
- 일반 상품 path에서는 같은 형태의 버튼을 만들어도 event가 생기지 않았다.
- Preview click 이후 Meta/GA4/Google Ads/Naver/VM Cloud attribution 신규 전송은 관측되지 않았다.
- 다만 synthetic click은 실제 Imweb 정기구독 버튼 클릭을 대체한 1차 smoke다. 운영 publish 전에는 Tag Assistant UI에서 실제 버튼 1회 클릭으로 같은 결과를 한 번 더 확인해야 한다.

## 운영 반영 판단

Preview가 통과해도 운영 반영은 자동이 아니다.

운영 반영 선택지는 두 개다.

1. GTM Production publish
   - 장점: version rollback이 쉽고 Tag Assistant로 추적하기 좋다.
   - 단점: 사이트 전체 tracking layer 변경이므로 Red Lane이다.

2. Imweb footer 통합
   - 장점: 기존 Coffee footer attribution 코드와 한 파일에서 관리된다.
   - 단점: 전체 custom code 저장이 필요하고 rollback 범위가 크다.

현재 추천은 GTM Preview로 조건을 먼저 검증한 뒤, 운영 반영은 GTM publish와 Imweb footer 중 하나만 선택하는 것이다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_subscribe_intent_gtm_preview_executed
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
Numbers current: N/A
Notes:
- GTM Preview 실행은 수행했고 2차 실행에서 `PASS_GTM_PREVIEW_NO_SEND_CLEANED`를 받았다.
- Preview workspace는 cleanup됐고 GTM live version은 unchanged다.
- 실제 Imweb UI 버튼 클릭은 아직 Tag Assistant 수동 확인이 필요하다. synthetic smoke는 DOM 조건/경로 guard/no-send를 검증한 단계다.
```
