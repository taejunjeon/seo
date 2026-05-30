작성 시각: 2026-05-26 18:21 KST
기준일: 2026-05-26
문서 성격: Meta `paidTouchBeforeCheckout` 저장 방식 검토 — GTM 대체 가능성 vs 아임웹 스니펫 보강안

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - docurule.md
    - GA4/gtm.md
    - GA4/gtm-biocom.md
    - project/meta-retained-unmapped-first-paid-touch-design-20260526.md
  lane: Green
  allowed_actions:
    - local code review
    - local fixture validation
    - GTM and Imweb implementation design
    - no-write documentation
  forbidden_actions:
    - GTM Production publish
    - GTM submit or create_version
    - Imweb footer/header production edit
    - VM Cloud deploy or restart
    - VM Cloud SQLite write
    - operating DB write
    - Meta ads mutation
    - platform conversion send
  source_window_freshness_confidence:
    source: local repository code + GTM inventory docs + Meta retained unmapped read-only report
    window: 2026-05-19~2026-05-25 KST retained unmapped diagnostic
    site: biocom
    freshness: 2026-05-26 18:21 KST local review
    confidence: high for local code/test, medium_high for GTM architecture, medium until GTM Preview
```

## 10초 요약

결론부터 말하면, `paidTouchBeforeCheckout`는 **GTM으로 상당 부분 대체 가능**하다.

다만 완전 대체보다 안전한 1차 추천은 `GTM=결제 전 유료 유입 저장`, `기존 아임웹 결제완료 스니펫=저장된 값을 payment-success payload에 동봉`하는 하이브리드 방식이다.

GTM만으로도 결제완료 전송까지 만들 수는 있지만, 이미 `backend/src/imwebAttributionSnippet.ts`에 주문번호·GA client/session·중복 방지·payment-success 전송 로직이 있어 이를 중복 구현하면 결제완료 row 중복과 주문키 누락 위험이 커진다.

## 왜 이 검토가 필요한가

남은 Meta 미매핑 15건은 결제완료 시점에 Meta 흔적은 남았지만 캠페인·광고세트·광고 숫자 ID가 결제 row까지 이어지지 않았다.

따라서 앞으로 줄여야 할 문제는 “이미 결제완료 페이지에 도착한 뒤 UTM을 찾는 것”이 아니라, **광고 클릭 직후 또는 상품/랜딩 페이지에서 숫자 ID를 먼저 저장해 두는 것**이다.

## 현재 구조

### 이미 있는 것

- 바이오컴 GTM container: `GTM-W2Z6PHN`
- GTM live version: 143
- 기존 GTM 태그 중 관련 태그:
  - `codex_paid_click_intent_v1_receiver_no_send`: 광고 클릭 보존용 Custom HTML
  - `SEO - TikTok Marketing Intent - v1`: TikTok intent 보존
  - `AGENT_OS_path_b_identity_first_hmac_write_canary_20260509T121717Z`: order bridge canary 계열
- 기존 아임웹 결제완료 스니펫:
  - 파일: `backend/src/imwebAttributionSnippet.ts`
  - 역할: `/shop_payment_complete` 또는 `/shop_order_done`에서 주문번호, GA session/client, UTM, click id를 읽고 `/api/attribution/payment-success`로 보낸다.

### 부족한 것

기존 결제완료 스니펫은 `lastTouch`와 아임웹 세션에 남아 있는 값을 최대한 읽지만, **결제 페이지로 넘어가기 전 마지막 유료 유입 스냅샷**을 별도 필드로 고정하지 않는다.

그래서 `/shop_payment/` 단계에서 URL이 깨끗해지거나 `fbclid only`만 남으면 캠페인 숫자 ID가 결제완료 row에 복구되지 않는다.

## 선택지 비교

### A안. 아임웹 스니펫만 보강

무엇을 하는가:

아임웹 footer/header 또는 기존 결제완료 스니펫에 유료 유입 저장 로직을 직접 넣는다.

장점:

- 기존 payment-success payload와 한 파일에서 관리된다.
- 주문번호·GA session/client·중복 방지 로직과 바로 연결된다.
- 서버 helper fixture와 맞추기 쉽다.

단점:

- 아임웹 production 코드 수정은 사이트 전체 사용자에게 영향을 준다.
- Preview와 rollback이 GTM보다 불편하다.
- 아임웹 페이지별 렌더링/캐시 영향이 있으면 확인이 어렵다.

판정:

가능하지만 1차 캡처 장치로는 GTM보다 운영 검증성이 낮다.

### B안. GTM만으로 완전 대체

무엇을 하는가:

GTM Custom HTML 태그 2개를 둔다.

1. 모든 랜딩/상품/콘텐츠 페이지에서 `paidTouchBeforeCheckout`를 localStorage/sessionStorage에 저장한다.
2. 결제완료 페이지에서 저장된 값을 읽어 `/api/attribution/payment-success`로 전송한다.

장점:

- 결제 전 페이지 전체에 같은 로직을 빠르게 적용할 수 있다.
- GTM Preview에서 발화 여부와 storage 값을 확인할 수 있다.
- 아임웹 코드 직접 수정 없이도 실험 설계가 가능하다.

단점:

- payment-success 전송을 기존 아임웹 스니펫과 중복 구현하게 된다.
- 주문번호 추출, dedupe key, GA cookie fallback, 아임웹 세션 fallback을 GTM 태그 안에 다시 만들어야 한다.
- 기존 스니펫과 동시에 켜지면 같은 주문의 `payment_success` row가 중복될 수 있다.
- Production publish는 Red Lane이다.

판정:

기술적으로 가능하지만 1차 추천은 아니다. 기존 결제완료 전송 로직을 살리는 편이 더 안전하다.

### C안. GTM 저장 + 아임웹 결제완료 payload 병합

무엇을 하는가:

GTM은 결제 전 페이지에서 paid touch를 저장만 한다. 기존 아임웹 결제완료 스니펫은 그 저장값을 읽어 `metadata.paidTouchBeforeCheckout`로 동봉한다.

권장 저장 키:

- `localStorage.biocom_paid_touch_before_checkout_v1`
- `sessionStorage.biocom_paid_touch_before_checkout_v1`

GTM 태그가 저장할 값:

- `capturedAt`
- `landing`, `landingPath`
- `referrer`, `referrerHost`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`
- `campaign_alias`
- `meta_site_source`, `meta_placement`
- `clickIdType`
- `clickIdHash`가 이미 안전하게 계산된 경우만 저장. raw `fbclid`는 저장 snapshot에 직접 넣지 않는 것을 권장

덮어쓰기 금지:

- `/shop_payment/`
- `/shop_payment_complete`
- `utm`이 전부 비어 있고 내부 referrer만 있는 페이지
- `campaign_alias=meta_biocom_광고별칭`만 있는 경우 기존 A/B급 값을 덮어쓰지 않음

판정:

1차 추천안이다. GTM이 가장 잘하는 “전 페이지 유입 캡처”와 기존 아임웹 스니펫이 이미 하고 있는 “결제완료 payload 전송”을 분리한다.

## 추천안

### 1차 추천: C안

GTM으로 `paidTouchBeforeCheckout` 저장 태그를 만든다. 단, 결제완료 전송은 기존 아임웹 스니펫을 유지하고, 기존 payload의 `metadata` 안에 저장된 paid touch만 추가한다.

이 방식이 좋은 이유:

1. 광고 URL을 수정하지 않으므로 Meta 머신러닝 리셋 위험이 낮다.
2. 결제 전 랜딩에서 숫자 Meta ID를 먼저 보존할 수 있다.
3. 기존 payment-success 중복 방지 로직을 유지한다.
4. GTM Preview로 storage 저장까지 먼저 검증할 수 있다.
5. 운영 반영은 GTM publish와 아임웹 footer edit 각각 승인 게이트로 나눌 수 있다.

### 2차 대안: GTM 완전 대체

기존 아임웹 결제완료 스니펫을 더 이상 유지하지 않겠다는 결정이 있으면 가능하다.

하지만 이 경우에는 다음을 새로 닫아야 한다.

- 주문번호/order_code/order_no 추출
- GA session/client fallback
- 중복 전송 방지
- `/shop_payment/`를 결제완료로 오인하지 않는 guard
- 기존 payment-success 스니펫 OFF 또는 dedupe 통합

따라서 이번 문제를 빠르게 줄이는 목적에는 과하다.

## 로컬 no-publish 초안 구현 결과

작성 파일:

- `backend/src/metaPaidTouchGtmSnippet.ts`
- `backend/scripts/render-meta-paid-touch-gtm-storage-tag.ts`
- `backend/tests/meta-paid-touch-gtm-snippet.test.ts`

이 초안은 GTM Custom HTML에 붙일 수 있는 저장 전용 태그를 렌더링한다.

동작은 아래와 같다.

1. 현재 URL이 `/shop_payment/`, `/shop_payment_complete`, `/shop_order_done`이면 저장하지 않는다.
2. URL에서 `utm_*`, `meta_*`, `campaign_alias`, `fbclid/gclid/ttclid`를 읽는다.
3. 숫자 Meta ID가 있으면 A급, 고유 alias면 B급, 랜딩/UTM 후보면 C급, placeholder 또는 약한 click-only면 D급으로 표시한다.
4. `localStorage.biocom_paid_touch_before_checkout_v1`와 `sessionStorage.biocom_paid_touch_before_checkout_v1`에 저장한다.
5. 기존 아임웹 결제완료 스니펫이 읽는 `localStorage._p1s1a_last_touch`에도 호환 필드를 저장한다.
6. 외부 전송은 없다. `fetch`, `sendBeacon`, `gtag`, `fbq`, `ttq` 호출을 넣지 않았다.
7. 다른 GTM 태그를 뜻하지 않게 깨우지 않도록 `dataLayer.push`도 넣지 않았다.
8. 호환용 `lastTouch`에도 raw click id나 가짜 click id를 새로 넣지 않는다. `fbclid` 존재 여부는 새 snapshot의 `clickIdType`에만 남긴다.

렌더 명령:

```bash
cd backend
npx tsx scripts/render-meta-paid-touch-gtm-storage-tag.ts
```

검증 명령:

```bash
cd backend
node --import tsx --test tests/meta-paid-touch-gtm-snippet.test.ts
```

### 기존 아임웹 코드를 안 바꿔도 되는가

부분적으로는 된다.

GTM 저장 태그가 `_p1s1a_last_touch`에도 `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `landing`, `referrer`를 넣기 때문에, 기존 아임웹 결제완료 스니펫은 이 값을 읽어 payment-success의 직접 UTM 필드로 보낼 수 있다.

따라서 Meta URL이 아래처럼 숫자 UTM을 정상 치환해 준다면, 기존 아임웹 코드 무변경만으로도 일부 A급 복구가 가능하다.

```text
utm_campaign=120...&utm_term=120...&utm_content=120...
```

하지만 완전하지 않다.

기존 아임웹 결제완료 스니펫은 아직 아래 필드를 읽지 않는다.

- `metadata.paidTouchBeforeCheckout`
- `meta_campaign_id`
- `meta_adset_id`
- `meta_ad_id`
- `campaign_alias`
- `meta_site_source`
- `meta_placement`
- `paidTouchBeforeCheckout.grade`
- `paidTouchBeforeCheckout.evidence`

그래서 기존 아임웹 코드를 바꾸지 않으면 “정식 paid touch snapshot”이 결제완료 row에 붙지 않는다. 즉, direct UTM 복구는 가능하지만, 보고서에서 `paidTouchBeforeCheckout`를 우선 evidence로 쓰는 구조는 완성되지 않는다.

현재 판정:

- 임시 개선: GTM 저장 태그만으로 일부 가능.
- 목표 완성: 기존 아임웹 결제완료 스니펫의 payload metadata 병합이 필요.
- 운영 추천: 먼저 GTM Preview로 storage 저장을 검증하고, 다음으로 아임웹 payload 병합을 로컬 patch + fixture로 닫는다.

## 구현 순서 초안

### Step 1. 로컬 helper 기준 확정

이미 로컬 helper는 다음 기준으로 구현한다.

- 숫자 `meta_campaign_id/meta_adset_id/meta_ad_id` 또는 숫자 UTM이면 A급
- 고유 `campaign_alias`면 B급
- 랜딩/UTM 근거만 있으면 C급
- `fbclid only` 또는 `{{campaign.id}}` placeholder면 D급 quarantine
- `/shop_payment/`는 기존 paid touch를 덮어쓰지 않음

### Step 2. GTM 저장 태그 초안

GTM Custom HTML 태그는 모든 페이지에서 실행하되, 실제 저장은 아래 조건일 때만 한다.

저장 조건:

- 현재 URL 또는 referrer에 `utm_*`, `meta_*`, `campaign_alias`, `fbclid`, `gclid`, `ttclid` 중 하나가 있다.
- 현재 path가 `/shop_payment/` 또는 `/shop_payment_complete`가 아니다.
- 기존 저장값이 A/B급이고 새 값이 D급이면 덮어쓰지 않는다.

저장만 하는 태그이므로 광고 플랫폼 전환 전송은 없다.

### Step 3. 아임웹 결제완료 스니펫 payload 병합

기존 `backend/src/imwebAttributionSnippet.ts`의 payload 생성부에서 아래를 추가한다.

```js
metadata: {
  paidTouchBeforeCheckout: readJsonStorage(window.localStorage, 'biocom_paid_touch_before_checkout_v1') ||
    readJsonStorage(window.sessionStorage, 'biocom_paid_touch_before_checkout_v1')
}
```

실제 적용 전에는 서버 helper가 payload를 다시 검증하므로, 브라우저 값만으로 A/B급을 확정하지 않는다.

### Step 4. Preview 검증

GTM Preview에서 아래를 확인한다.

1. `/iiary02?...meta_campaign_id=120...` 진입 시 storage에 A급 재료가 생긴다.
2. `/shop_payment/` 진입 시 storage가 덮어써지지 않는다.
3. `/shop_payment_complete`에서 payment-success payload metadata에 같은 값이 들어간다.
4. VM Cloud write flag를 켜지 않은 Preview 단계에서는 운영 row 증가가 없다.

## 승인 구분

### Green Lane

- 로컬 helper와 fixture 작성
- GTM/아임웹 코드 초안 문서화
- 로컬 static test
- GTM Preview 승인안 작성

### Yellow Lane

- GTM Preview only 확인
- fresh workspace 생성
- Tag Assistant에서 storage 값 확인
- publish 없는 브라우저 smoke

### Red Lane

- GTM Production publish
- 아임웹 footer/header 실제 저장
- VM Cloud deploy/restart
- 운영DB write
- Meta/GA4/Google/TikTok/Naver 전환 전송

## 현재 결론

`paidTouchBeforeCheckout`는 GTM으로 “대체 가능”하지만, 이번 목표에서는 **GTM 완전 대체보다 GTM 저장 + 기존 아임웹 payment-success 병합**이 더 낫다.

완전 대체는 결제완료 전송 로직을 중복으로 만들 위험이 있다. 반면 하이브리드는 새로 필요한 부분만 GTM에 맡기고, 이미 테스트된 결제완료 전송은 유지한다.

## 성공 기준

1. 신규 Meta 광고 유입에서 payment_success metadata에 `paidTouchBeforeCheckout`가 붙는다.
2. 숫자 Meta ID가 있으면 서버에서 A급으로 판정된다.
3. `/shop_payment/`와 `fbclid only`가 기존 A/B급 값을 덮어쓰지 않는다.
4. 캠페인 ROAS에는 A/B/승인된 C급만 반영되고 D급은 quarantine으로 남는다.
5. GTM Preview 성공을 Production publish 승인으로 해석하지 않는다.

## 하지 않은 것

- GTM Production publish: 0회
- GTM submit/create_version: 0회
- 아임웹 production 코드 수정: 0회
- VM Cloud deploy/restart: 0회
- VM Cloud SQLite write: 0건
- 운영DB write/import: 0건
- 광고 플랫폼 전송: 0건

## 다음 할일

### Auto Green

1. GTM 저장 태그 초안을 로컬 문자열 생성 코드 또는 문서 스니펫으로 만든다.
   - 무엇: `paidTouchBeforeCheckout` storage writer.
   - 왜: 아임웹 적용 전 GTM Preview에서 저장 여부를 검증하기 위해서다.
   - 성공 기준: `/shop_payment/` overwrite 방지 fixture PASS.
   - 의존성: 로컬 helper PASS.

2. 기존 아임웹 결제완료 스니펫에 storage merge 초안을 만든다.
   - 무엇: payment-success payload metadata에 `paidTouchBeforeCheckout`를 동봉하는 로컬 patch.
   - 왜: GTM 저장값이 결제완료 row까지 이어져야 캠페인 매칭에 쓸 수 있다.
   - 성공 기준: 기존 `imweb-attribution-snippet.test.ts`에 paidTouch payload fixture 추가 PASS.
   - 의존성: 1단계 또는 storage key 확정.

### Approval Needed

1. GTM Preview only 실행 승인.
   - 무엇: fresh GTM workspace에서 저장 태그를 Preview만 실행한다.
   - 왜: 실제 바이오컴 페이지에서 storage 값이 남는지 확인해야 한다.
   - 성공 기준: Tag Assistant에서 publish 없이 태그 Fired, storage 값 확인.
   - 금지: submit/create_version/publish.

2. Production 반영 승인.
   - 무엇: GTM 저장 태그 publish와 아임웹 스니펫 수정 중 어떤 조합을 적용할지 결정한다.
   - 왜: 실제 신규 주문의 Meta 미매핑을 줄이려면 운영 브라우저에서 실행돼야 한다.
   - 성공 기준: 신규 payment_success row에 `paidTouchBeforeCheckout.grade=A/B/C/D`가 붙는다.
   - 승인 전 금지: 실제 publish, 아임웹 저장, VM Cloud deploy/restart.
