# Google NPay bridge GTM Production publish 승인안 - 2026-05-28

작성 시각: 2026-05-28 13:35 KST
기준일: 2026-05-28
문서 성격: Red Lane 승인안
site: biocom
대상: GTM `GTM-W2Z6PHN` workspace `biocom-npay-bridge-preview-20260528`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - project/google-npay-bridge-url-capture-v11-20260528.md
    - project/google-npay-bridge-gtm-preview-smoke-result-20260528.md
  required_context_docs:
    - project/google-npay-bridge-gtm-preview-smoke-result-20260528.md
  lane: Red
  allowed_actions_after_explicit_approval:
    - GTM workspace 171 submit/create_version/publish
    - one no-payment NPay button smoke after publish
    - VM Cloud row-level read-only verification
  forbidden_actions_even_after_this_publish_approval:
    - NPay login or actual payment unless separately approved
    - Google Ads conversion upload/send
    - Meta/GA4/TikTok purchase send
    - production DB write
    - auto dispatcher enable
  source_window_freshness_confidence:
    source: GTM API quick_preview + Playwright install smoke + VM Cloud row-level NPay intent read-only API
    window: 2026-05-28 13:13-13:31 KST
    freshness: checked immediately after workspace update
    confidence: high for Preview tag install and bridge URL hash capture; medium-high for production impact because publish is not executed yet
```

## 10초 요약

이번 승인은 `NPay 버튼 클릭 순간의 Google click id와 NPay 외부 결제창 증거를 같이 저장하는 GTM 태그`를 운영에 게시할지 결정하는 것이다.

게시해도 Google Ads, Meta, GA4, TikTok에 구매 전환을 보내지 않는다. 바뀌는 것은 실제 고객이 NPay 버튼을 누를 때 VM Cloud NPay intent 원장에 더 자세한 연결 증거가 저장되는 것이다.

현재 Preview smoke에서는 성공했다. 2026-05-28 13:22 KST 재클릭 row에서 Google click id와 NPay bridge URL hash가 같은 row에 함께 남았다.

## 승인하면 실제로 바뀌는 것

### 사람이 이해하는 설명

지금은 Google 광고 클릭 후 NPay 버튼을 눌러도, 실제 NPay 결제완료 주문과 광고 클릭을 붙일 증거가 자주 끊긴다.

이 태그는 고객이 NPay 버튼을 누르는 그 순간에 아래를 같이 저장한다.

- Google 광고 클릭 증거: `gclid`, `gbraid`, `wbraid` 중 존재 여부와 값
- NPay 외부 결제창 증거: NPay bridge URL hash, host, path hash
- 상품 정보: 상품 idx, 상품명, 화면에서 읽은 상품가
- 브라우저 연결 정보: client id, GA session id, UTM

이 저장값은 나중에 `실제 NPay 결제완료 주문`과 연결하기 위한 재료다. 이 태그 자체가 구매 완료라고 Google Ads에 알리는 것은 아니다.

### 기술 이름

- GTM tag: `BI - NPay Bridge Intent Capture v1.1`
- source: `gtm_npay_bridge_v1_1`
- endpoint: `https://att.ainativeos.net/api/attribution/npay-intent`
- runtime environment:
  - debug query: `debug`
  - GTM Preview: `gtm_preview`
  - normal live traffic: `live`

## 게시 대상

- GTM account: `4703003246`
- GTM container: `13158774`
- GTM public id: `GTM-W2Z6PHN`
- GTM workspace: `171`
- Workspace URL: `https://tagmanager.google.com/?hl=ko&pli=1#/container/accounts/4703003246/containers/13158774/workspaces/171`
- Tag id: `311`
- Trigger id: `310`
- 기존 v1 Preview tag id: `308`, workspace 안에서 `paused=true`
- 현재 live version: `145 (paid_click_intent_v3_stale_click_id_guard_20260521)`

## 게시 전 검증 결과

### 1. Preview row-level smoke

- 1차 클릭: 2026-05-28 13:13 KST
  - Google click id: 있음
  - NPay bridge URL hash: 없음
  - 판단: 클릭 저장은 됐지만 bridge 증거가 부족했다.
- 2차 클릭: 2026-05-28 13:22 KST
  - Google click id: 있음
  - `gclid`: 있음
  - NPay bridge URL hash: 있음
  - NPay bridge path hash: 있음
  - bridge host: `pay.naver.com`
  - product_idx: `198`
  - product_price: `35000`
  - 판단: bridge-update 보강 후 핵심 증거가 같은 row에 함께 남았다.

### 2. GTM compile / install smoke

- GTM quick_preview compiler error: 없음
- Playwright install smoke: PASS
- loaded version: `2026-05-28-biocom-npay-bridge-gtm-v1-1-production-ready`
- live version unchanged: `145`
- `Submit`, `Create version`, `Publish`: 실행 안 함

### 3. 금지선 확인

- Google Ads conversion upload: 실행 안 함
- Meta/GA4/TikTok purchase send: 실행 안 함
- 운영DB write: 실행 안 함
- NPay 로그인/결제: 실행 안 함

## 승인 요청

### TJ님이 승인하는 문장

아래 문장을 대화에 그대로 남기면 Codex가 API로 GTM Production publish를 진행할 수 있다.

```text
GTM Production publish 승인: BI NPay Bridge v1.1 운영 게시 YES
```

### 승인하면 Codex가 실행할 일

1. workspace `171`을 submit한다.
2. container version을 만든다.
3. GTM production publish를 실행한다.
4. live version id가 바뀐 것을 확인한다.
5. 실제 결제 없이 NPay 버튼 클릭 smoke 1회를 안내하거나, TJ님 클릭 후 VM Cloud row-level 조회로 확인한다.
6. row에 `source=gtm_npay_bridge_v1_1`, `environment=live`, `has_google_click_id=true`, `has_npay_bridge_url_hash=true`가 남는지 확인한다.

## TJ님이 직접 화면에서 게시할 경우

Codex가 API publish를 하지 않고 TJ님이 화면에서 직접 할 수도 있다.

1. GTM workspace URL을 연다.
2. workspace `biocom-npay-bridge-preview-20260528`인지 확인한다.
3. 변경 태그가 `BI - NPay Bridge Intent Capture v1.1`인지 확인한다.
4. `제출`을 누른다.
5. 버전 이름은 아래처럼 넣는다.

```text
biocom_npay_bridge_v1_1_production_ready_20260528
```

6. 버전 설명은 아래처럼 넣는다.

```text
NPay 버튼 클릭 시 Google click id와 NPay bridge URL hash를 VM Cloud npay-intent 원장에 저장. Google Ads/Meta/GA4/TikTok 전환 전송 없음.
```

7. 게시 후 Codex에게 “게시 완료”라고 알려준다.

## 성공 기준

운영 게시 성공은 게시 버튼 자체가 아니라 아래 조건을 모두 만족해야 한다.

1. GTM live version id가 `145`에서 새 버전으로 바뀐다.
2. 실제 결제 없이 NPay 버튼 클릭 1회 후 VM Cloud row-level에 새 row가 생긴다.
3. 새 row의 `source=gtm_npay_bridge_v1_1`이다.
4. 새 row의 `environment=live`이다.
5. 새 row의 Google click id가 있다.
6. 새 row의 NPay bridge URL hash가 있다.
7. Google Ads/Meta/GA4/TikTok 구매 전환은 전송되지 않는다.

## 중단 기준

아래 중 하나라도 발생하면 publish 또는 post-smoke를 중단한다.

- quick_preview compiler error가 발생한다.
- workspace에 예상 외 NPay/Google Ads 구매 전환 태그 변경이 섞여 있다.
- old v1 tag `308`이 unpaused 상태로 돌아가 있다.
- live version이 publish 전 이미 알 수 없는 버전으로 바뀌어 있다.
- post-smoke에서 Google Ads conversion request가 새로 발생한다.
- post-smoke에서 row가 `environment=live`로 남지 않는다.

## 롤백 방법

문제가 생기면 아래 순서로 되돌린다.

1. GTM에서 직전 live version `145`로 rollback한다.
2. 또는 새 태그 `BI - NPay Bridge Intent Capture v1.1`을 pause하고 다시 publish한다.
3. VM Cloud row-level에서 새 source row 증가가 멈췄는지 확인한다.
4. Google Ads/Meta/GA4/TikTok 전환 전송이 없었는지 네트워크/원장 기준으로 재확인한다.

## 위험과 해석

### 위험 1. 원장 row가 늘어난다

고객이 NPay 버튼을 누를 때 VM Cloud NPay intent 원장에 row가 추가된다. 이건 의도한 변화다. 광고 플랫폼 전환값을 바꾸지는 않는다.

### 위험 2. bridge host가 최종 checkout host와 다를 수 있다

Preview에서는 TJ님이 최종으로 본 URL은 `orders.pay.naver.com` 계열이었고, 저장 row는 `pay.naver.com`으로 잡혔다. 이는 중간 bridge URL을 먼저 저장한 뒤 Naver가 checkout으로 redirect했기 때문으로 해석한다. 연결 증거로는 hash/path/시간/상품/클릭 ID를 함께 본다.

### 위험 3. 실제 결제완료 자동 연결은 별도 단계다

이 태그는 버튼 클릭 evidence를 보강한다. 실제 결제완료 주문과 자동으로 연결하고 Google Ads 전송 후보로 올리는 로직은 별도 원장/후보 생성기에서 처리한다.

## 현재 판정

진행 추천: 92%

이유:

- Preview에서 핵심 증거가 잡혔다.
- 운영 게시 전 `environment=live` 표기 정리를 끝냈다.
- Google Ads/Meta/GA4/TikTok 전환 전송과 무관하다.
- 다만 GTM Production publish 자체는 사이트 전체 tracking에 영향을 주므로 Red Lane 명시 승인이 필요하다.

Auditor verdict: READY_FOR_RED_APPROVAL

## 승인 전 마지막 체크리스트

- [x] Preview row에서 Google click id 확인
- [x] Preview row에서 NPay bridge URL hash 확인
- [x] 태그 runtime environment 운영 표기 정리
- [x] quick_preview compiler error 없음
- [x] Playwright install smoke PASS
- [x] old v1 Preview tag paused
- [x] live version unchanged before approval
- [x] 승인 문서 작성
- [x] TJ님 명시 승인
- [x] GTM Production publish
- [x] post-publish no-click smoke
- [ ] VM Cloud row-level live row 확인

---

## 운영 게시 실행 결과 - 2026-05-28 13:46 KST

TJ님 승인 문장:

```text
GTM Production publish 승인: BI NPay Bridge v1.1 운영 게시 YES
```

### 게시 전 workspace 정리

게시 직전 workspace 변경 목록을 다시 확인했다. 변경은 3개였다.

- `tag_id=308`: `BI - NPay Bridge Intent Capture v1 [PREVIEW ONLY]`, `paused=true`
- `tag_id=311`: `BI - NPay Bridge Intent Capture v1.1`
- `trigger_id=310`: v1.1 All Pages trigger

`tag_id=308`은 운영에 올릴 필요가 없는 Preview 전용 비활성 태그였다. 그대로 게시해도 실행되지는 않지만 운영 컨테이너에 죽은 태그가 남으므로 삭제했다. 또한 `trigger_id=310` 이름을 운영용으로 정리했다.

정리 후 게시 대상은 아래 2개로 고정됐다.

- `tag_id=311`: `BI - NPay Bridge Intent Capture v1.1`
- `trigger_id=310`: `BI - NPay Bridge Intent Capture v1.1 - All Pages`

정리 검증:

- GTM quick_preview compiler error: 없음
- live version before publish: `145 (paid_click_intent_v3_stale_click_id_guard_20260521)`
- 정리 산출물: `data/npay-bridge-v11-gtm-production-prepublish-cleanup-20260528T044517Z.json`

### Production publish

- created version: `146`
- version name: `BI NPay Bridge v1.1 production 20260528T044617Z`
- live version after publish: `146`
- live tag present: yes
- live trigger present: yes
- publish 산출물: `data/npay-bridge-v11-gtm-production-publish-20260528T044617Z.json`

### 게시 후 no-click smoke

운영 상품 페이지를 열어 태그 로드만 확인했다. NPay 버튼 클릭, 로그인, 결제는 하지 않았다.

- page: `https://biocom.kr/shop_view/?idx=198&__seo_attribution_debug=1`
- loaded version: `2026-05-28-biocom-npay-bridge-gtm-v1-1-production-ready`
- GTM-W2Z6PHN loaded: yes
- Google Ads conversion request: 0
- VM Cloud receiver request: 0
- no-click smoke 산출물: `data/npay-bridge-v11-production-no-click-smoke-20260528T044717Z.json`

### 게시 후 남은 확인

실제 row-level 저장 확인은 NPay 버튼 클릭이 있어야 가능하다. 다만 NPay 버튼 클릭은 기존 Google Ads 보조 전환 태그도 같이 발화할 수 있으므로, 이 문서에서는 자동 클릭을 하지 않았다.

다음 row-level 확인은 아래 둘 중 하나로 진행한다.

1. 자연 유입 또는 실제 고객 클릭으로 `source=gtm_npay_bridge_v1_1`, `environment=live` row가 들어오는지 모니터링한다.
2. TJ님이 승인한 별도 controlled smoke에서 NPay 버튼만 1회 클릭하고, 결제/로그인은 하지 않은 상태로 VM Cloud row-level을 조회한다.

Auditor verdict: PUBLISHED_WITH_NO_CLICK_SMOKE_PASS
