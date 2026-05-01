# Coffee funnel-capi / NPay intent beacon 발견의 Biocom 적용성 메모

생성 시각: 2026-05-01 KST
범위: 더클린커피에서 발견한 funnel-capi v3 / NPay intent beacon / 4 layer tracking flow / Imweb url query param 보존 패턴이 **biocom (바이오컴 건기식)** 에도 그대로 적용 가능한지 또는 site 간 차이가 있는지 정리
관련 문서: [[coffee-imweb-tracking-flow-analysis-20260501|coffee 4 layer 분석]] / [[coffee-npay-intent-beacon-preview-design-20260501|coffee design v0.4]] / [[coffee-npay-intent-beacon-preview-snippet-v04-20260501|coffee snippet v0.4]] / [[coffee-npay-intent-uuid-preservation-test-20260501|coffee URL 보존 검증]] / [[harness/npay-recovery/README|biocom NPay Recovery Harness]] / [[naver/!npayroas|biocom NPay ROAS 정합성 계획]]

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_to_biocom_applicability_memo
No-send / No-write / No-deploy / No-publish: YES (read-only memo)
실제 운영 변경: 0건
Coverage: coffee 발견 → biocom 적용 가능성 정찰만. biocom 측 검증은 별도 phase
```

## 10초 요약

더클린커피 imweb 헤더/푸터 4 layer (Purchase Guard v3 / checkout-started v1 / payment-success-order-code v1 / funnel-capi v3) + NPay intent beacon design v0.4 + URL query param 보존 검증 절차는 **biocom 의 imweb 사이트도 같은 imweb 인프라이고 동일한 ainativeos.net attribution backend 를 쓰고 있다면 그대로 재사용 가능**하다. 단, 실제 site 별 차이 (pixel id, GTM container, snippet version, MIRROR_EVENTS 미세 차이) 는 biocom 의 imweb 헤더/푸터 정본을 동일 형식 (`coffee/!imwebcoffee_code_latest_0501.md` 같은) 으로 정찰한 뒤 확정한다. 본 메모는 **재사용 항목과 재검증 필요 항목** 을 분리해 다음 biocom phase 의 첫 단계가 되게 한다.

## 더클린커피에서 확정한 발견 (재사용 후보)

| # | 발견 | biocom 재사용 가능성 |
|---|---|---|
| 1 | imweb 헤더/푸터에 4 layer 가 박혀 있다 (Purchase Guard / checkout-started / payment-success / funnel-capi). decisionEndpoint = `att.ainativeos.net/api/attribution/payment-decision`, server CAPI endpoint = `att.ainativeos.net/api/meta/capi/track` | **HIGH** — biocom 도 ainativeos.net attribution 인프라를 쓰면 동일 4 layer 가 깔려 있을 가능성 큼. biocom 헤더/푸터 정본 1회 정찰로 확정 |
| 2 | funnel-capi v3 가 fbq 를 wrap 해서 MIRROR_EVENTS = {ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo} 만 mirror, Purchase 는 Purchase Guard 단독 | **HIGH** — biocom 도 같은 패턴 가능성. 단 biocom 의 funnel-capi snippet version (`2026-MM-DD-biocom-funnel-capi-vX`) 과 site 식별자가 다를 것 |
| 3 | sessionId 키 = `__seo_funnel_session`. 형식 `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`. window 변수 미노출 | **HIGH** — biocom 도 동일 키 가능성. snippet 코드는 site 비종속. 단 site 별로 별도 sessionId 발급 (origin 다르므로) |
| 4 | eid 형식 = `<EventName>.<contentKey>.<sessionId>` | **HIGH** — biocom 도 동일 |
| 5 | window 노출 변수 = `window.FUNNEL_CAPI_CONFIG`, `window.__FUNNEL_CAPI_INSTALLED` | **HIGH** — biocom 도 동일 변수. 단 `FUNNEL_CAPI_CONFIG.pixelId` 가 biocom pixel 로 다름 |
| 6 | `SITE_SHOP_DETAIL.confirmOrderWithCartItems` 는 thin wrapper. 진짜 함수는 글로벌 `window.confirmOrderWithCartItems` | **HIGH** — biocom 도 imweb 이라 동일 |
| 7 | NPay click 시 imweb 이 자체 fbq InitiateCheckout 발화 → funnel-capi mirror | **MID** — imweb 표준 동작이면 biocom 도 동일. 다만 biocom 상품 / 결제 흐름이 다를 수 있어 (예: 정기구독 vs 단건) MIRROR 시점이 다를 가능성 |
| 8 | NPay 결제는 backend `checkout-started v1` 단계가 의도적으로 비어 있음 (외부 도메인 redirect) | **HIGH** — imweb + NPay 결제 구조라 biocom 도 동일 |
| 9 | preview snippet v0.4 코드 (sessionId 재사용 / intent_uuid per confirm_to_pay / 글로벌 함수 동시 wrap / 3-step metadata fallback / sessionStorage 4개 키 + console.log only) | **HIGH** — biocom 에서도 그대로 쓸 수 있는 형태. 단 site=biocom 로 변경, sessionStorage 키 prefix 도 site 별로 분리 (`coffee_*` → `biocom_*`) |
| 10 | URL Query Param 보존 검증 절차 (1단계 read-only 정찰 + 2단계 sandbox 결제 1건 + 3 위치 보존 매트릭스) | **HIGH** — biocom 도 imweb + NPay 라 동일 절차 적용 |

## biocom 적용 시 재검증 필요 항목 (site 별 차이 후보)

site 가 다르면 다음 값들은 거의 확실히 다르다. biocom 헤더/푸터 정본 정찰 후 확정.

| 항목 | 더클린커피 값 | biocom 재검증 |
|---|---|---|
| Meta Pixel ID | `1186437633687388` | biocom pixel id (`META_PIXEL_ID_BIOCOM` env 또는 정본 함께 확인) |
| GTM container ID | `GTM-5M33GC4` | biocom GTM container |
| GA4 measurement ID | `G-JLSBXX7300` | biocom 의 G-XXXX |
| funnel-capi snippet version | `2026-04-15-thecleancoffee-funnel-capi-v3` | biocom 측 snippet version |
| Purchase Guard snippet version | `2026-04-14-coffee-server-payment-decision-guard-v3` | biocom 측 |
| checkout-started snippet | `2026-04-14-coffee-checkout-started-v1` | biocom 측 |
| payment-success snippet | `2026-04-14-coffee-payment-success-order-code-v1` | biocom 측 |
| MIRROR_EVENTS 4종 (ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo) | 동일 가정 | biocom 정본 grep 으로 확정 |
| `enableServerCapi` 상태 | `false` | biocom 측 별도 확인 (이미 켰을 수 있음) |
| 정기구독 결제 흐름의 추가 layer | 더클린커피는 일반 단건 결제 + 별도 [[data/!coffee_subscriber_ops|정기구독 트랙]] | biocom 은 정기구독 비중이 다르므로 추가 layer 가능성 |
| Naver Commerce API 권한 | 호스팅사 입점 제약으로 더클린커피 발급 미정 | biocom 도 동일 제약. 단 biocom 측에는 직매장 / API 권한 협의가 더 진행됐을 수 있음 |
| Toss PG sync gap | [[data/toss_sync_gap]] 참조 | biocom 측 sync 상태 별도 확인 |

## biocom phase 1 — 헤더/푸터 정본 정찰

biocom imweb 사이트의 헤더/푸터 코드 정본을 더클린커피와 동일 형식으로 박는다. 형식 권장:

```
coffee/!imwebcoffee_code_latest_0501.md  ← 더클린커피 정본 (기존)
biocom/!imwebbiocom_code_latest_YYYYMMDD.md  ← biocom 정본 (신규, 다음 phase 에서 작성)
```

정찰 후 비교해야 할 항목:

1. 4 layer 의 line 범위와 snippet version
2. MIRROR_EVENTS 정확한 키 목록
3. Purchase Guard CONFIG 의 endpoint / pixelId
4. checkout-started CONFIG 의 measurementIds / source
5. funnel-capi CONFIG 의 pixelId / endpoint / enableServerCapi

이 5개가 같으면 더클린커피의 design v0.4 와 snippet 을 90% 그대로 재사용 가능. 다른 경우 site 별 분기 추가.

## biocom phase 2 — preview snippet 적용

더클린커피 [[coffee-npay-intent-beacon-preview-snippet-v04-20260501|snippet v0.4]] 를 biocom 에 적용할 때 변경 항목:

| snippet 안 상수 | 더클린커피 값 | biocom 변경 후보 |
|---|---|---|
| `SITE` | `"thecleancoffee"` | `"biocom"` |
| `VERSION` | `coffee_npay_intent_preview_v0.4_20260501` | `biocom_npay_intent_preview_v0.4_YYYYMMDD` |
| `BUFFER_KEY` | `coffee_npay_intent_preview` | `biocom_npay_intent_preview` |
| `INTENT_SEQ_KEY` | `__coffee_intent_seq` | `__biocom_intent_seq` |
| `INTENT_UUID_PENDING_KEY` | `__coffee_intent_uuid_pending` | `__biocom_intent_uuid_pending` |
| `SESSION_UUID_KEY` (fallback) | `__coffee_session_uuid` | `__biocom_session_uuid` |
| `WRAP_MARKER` | `__coffee_npay_v04_wrapped` | `__biocom_npay_v04_wrapped` |
| `LOG_PREFIX` | `[coffee_npay_intent_preview_v04]` | `[biocom_npay_intent_preview_v04]` |
| `FUNNEL_CAPI_SESSION_KEY` | `__seo_funnel_session` | **그대로** (funnel-capi 가 site 비종속 키 사용) |
| `FUNNEL_CAPI_SENT_PREFIX` | `funnelCapi::sent::` | **그대로** |

site 별 sessionStorage 키 분리는 한 사용자가 두 사이트를 같은 시크릿 창에서 열 가능성은 낮지만, 코드 hygiene 차원에서 필수.

## biocom phase 3 — 4 layer flow 분석 + URL 보존 검증

[[coffee-imweb-tracking-flow-analysis-20260501|coffee 4 layer 분석]] 와 [[coffee-npay-intent-uuid-preservation-test-20260501|coffee URL 보존 검증]] 절차를 biocom 정본 + biocom sandbox 결제 1건으로 재실행.

핵심 차이가 발생할 수 있는 영역:

1. biocom 의 정기구독 결제는 `confirmOrderWithCartItems` 의 `kind` 인자가 다를 수 있음 (예: `npay_subscription`, `recurring`). 우리 wrap 의 `kind === "npay"` 조건만으로는 못 잡을 가능성. biocom 정본 정찰 시 `kind` 값 종류 확인.
2. biocom 의 `enableServerCapi` 가 이미 `true` 라면 server CAPI dedup 키 (eid) 가 운영 송출에 영향. 우리 wrap 은 read 만 하므로 충돌은 없지만 dedup 키 형식 일치 확인.
3. biocom 의 Purchase Guard decisionEndpoint 응답에 다른 분기 (예: 정기구독 vbank custom event) 가 추가되어 있을 수 있음.

## 우리 NPay intent beacon 의 cross-site 가치

더클린커피에서 검증된 두 가지 가치 — (a) NPay click 자체 deterministic key + (b) 비어 있는 backend `checkout-started v1` 보강 — 는 biocom 에도 동일하게 의미가 있다.

## 추가 정찰 결과: imweb 측 raw_data 자유 텍스트 자리 (2026-05-01 KST)

[[coffee-npay-intent-uuid-preservation-test-20260501]] § 1-D 정찰 결과로 다음 두 사실이 확정됐다. **biocom 도 동일 imweb v2 API 인프라이므로 그대로 적용**.

| 사실 | coffee 출처 | biocom 적용성 |
|---|---|---|
| coffee `imweb_orders.raw_json` 5건 모두 `form: []` 비어 있음 + memo/note/custom/meta/remark 키 0건 | local SQLite | biocom 도 imweb v2 API 동일 응답 구조라 동일 결론 |
| biocom `tb_iamweb_users.raw_data` jsonb top-level / payments / sections nested keys 모두 정형. 자유 텍스트 후보 = `pickupMemo` (사용자 픽업 메모 입력 자리, 일반 결제 흐름에서 자동 박히는 query string 자리 아님) | 운영 PG | biocom 측 데이터 (이미 정찰 결과). coffee 도 동일 구조 추정 |
| `tb_playauto_orders` 에 raw_data jsonb 컬럼 없음 (정형 컬럼만). 자유 텍스트 후보 = `ship_msg` (배송 메시지, 사용자 입력 자리) | 운영 PG | biocom / coffee 양쪽 모두 PlayAuto 통합 ETL 라 동일 |

**결론 (1-D 시점)**: biocom 에서도 NPay click 시 backurl 의 query string 이 imweb 측 raw_data 에 자동 보존될 자리가 없다.

biocom phase 시작 시 1-D 정찰은 **재실행 불필요** (양쪽 동일 imweb 인프라이므로 결과 동일). 단 1-A/1-B/1-C/2-* 는 biocom site live 에서 별도 검증 필요.

## 추가 발견: (A++) imweb orderCode 트랙 (2026-05-01 22:30 KST)

[[coffee-npay-intent-uuid-preservation-test-20260501]] 1-A 결과 + Codex backend 정찰로 다음이 확정됨:

- coffee `imweb_orders.order_code` 의 실제 형식 = `o<YYYYMMDD><14자 hex>` (예 `o20260404a43a6c5512978`)
- NPay click 시점에 imweb 자체 발급 → fbq InitiateCheckout 의 `eventID` 에 박힘 (funnel-capi `reuse eid` console marker 로 확인)
- 같은 orderCode 가 backend `imweb_orders.order_code` 컬럼에 저장됨 (Codex 정찰 5건 전부 확인)

→ **(A++) imweb orderCode 트랙 — NPay click 시점에 funnel-capi sessionStorage `funnelCapi::sent::InitiateCheckout.<orderCode>.*` 에서 orderCode 추출 → ledger 와 backend `imweb_orders.order_code` 사이 deterministic join 가능**.

### biocom 적용성

| 사실 | biocom 적용성 |
|---|---|
| imweb 자체 orderCode 발급 패턴 (`o<YYYYMMDD><hex>`) | **HIGH** — biocom 도 동일 imweb 인프라. 정찰로 확정 권장 |
| funnel-capi InitiateCheckout eid 에 orderCode 박힘 | **HIGH** — biocom funnel-capi v3 도 동일 MIRROR_EVENTS / `reuse eid` 패턴 |
| backend `tb_iamweb_users.order_number` 또는 동일 컬럼 | **HIGH** — 운영 PG `tb_iamweb_users` 의 키 컬럼 (`raw_data` jsonb 의 `orderNo`, top-level `order_number`) 에 매핑 |

biocom phase 시작 시 정찰 1줄로 확정 가능:

```sql
SELECT order_number, raw_data->>'orderNo' AS raw_order_no
FROM public.tb_iamweb_users
ORDER BY id DESC
LIMIT 5;
```

`raw_data->>'orderNo'` 가 `o<YYYYMMDD><hex>` 형식이면 biocom 도 (A++) 트랙 적용 가능.

### 결과로 결정될 biocom 트랙

| coffee 결과 | biocom 적용 권장 트랙 |
|---|---|
| coffee (A++) 트랙 작동 (snippet v0.5 검증 PASS) | biocom 도 (A++) 트랙 우선. snippet site 식별자만 치환해서 검증 1회 |
| coffee (A++) 트랙 일부 작동 (특정 케이스만) | biocom 에서도 같은 케이스 분석. fallback (B) ledger 병행 |
| coffee (A++) 트랙 미작동 (drop case 다수) | (B) ledger 단독으로 양쪽 운용 |

추가로 biocom 측 가치:

- biocom 의 NPay ROAS 정합성 작업 ([[naver/!npayroas]]) 에서 unassigned NPay actual / GA4 NPay 형 매칭 어려움 보강
- biocom 의 [[harness/npay-recovery/README|NPay Recovery Harness]] 의 future intent 트랙으로 직접 편입

## 다음 단계 (biocom phase 시작 트리거)

본 메모 자체는 reference. biocom 적용을 실제로 시작할 때:

1. coffee phase 가 마감 (URL 보존 검증 결과 + 트랙 결정 (A) 또는 (B)) 에 도달하면 biocom phase 1 (정본 정찰) 로 이동
2. 그 결과로 biocom phase 2 / 3 이 자동으로 따라옴
3. biocom snippet 코드는 더클린커피 v0.4 의 fork. site 식별자만 치환하면 90% 재사용

본 메모는 시점이 변하더라도 "coffee 에서 발견한 것 중 biocom 에도 적용 가능" 이라는 mapping 표를 한 곳에 박아 두는 reference 역할.

## 외부 시스템 영향

- biocom imweb 사이트: 본 메모는 read-only. 변경 0
- 더클린커피 site: 변경 0
- GTM workspace: 변경 0
- 운영 DB / GA4 / Meta / TikTok / Google Ads: 변경 0

## 가드

- 본 메모는 미래 phase 의 출발점이다. biocom 측에 실제로 snippet 을 박거나 sandbox 결제를 진행할 때는 동일한 read-only / no-send / no-write / no-deploy / no-publish 가드를 따른다.
- biocom 측 [[harness/npay-recovery/README|NPay Recovery Harness]] 의 금지선과 본 메모를 동시에 본 뒤 진행한다.
- coffee 에서 검증된 사실 중 biocom 에 자동 옮기지 않는다 — 항상 biocom 정본 정찰로 재확인.
