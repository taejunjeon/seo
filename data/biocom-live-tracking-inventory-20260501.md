# Biocom Live Tracking Inventory Snapshot (2026-05-01)

작성 시각: 2026-05-02 00:14 KST
파일 기준일: 2026-05-01
site: `biocom` (`https://www.biocom.kr`)
mode: `read_only` / `observation_only`
Primary source: live HTML `curl https://www.biocom.kr/`, blocked-network Playwright runtime on `https://www.biocom.kr/HealthFood/?idx=386`, local source snapshots `capivm/biocom_imwebcode_최신.md`, `GA4/gtm.md`, `naver/npay-intent-quality-20260430.md`, `tiktok/headercode.md`
Freshness: live HTML 2026-05-02 00:00 KST, runtime 2026-05-02 00:01 KST, GTM API snapshot 문서 2026-04-30 11:55 KST
Confidence: 88%

## 10초 요약

바이오컴 자사몰에는 이미 NPay intent, Meta Purchase Guard, TikTok Purchase Guard v2, footer attribution, funnel-capi v3가 동시에 살아 있다.

따라서 Coffee Data Harness 방식의 첫 결론은 `새 wrapper를 바로 붙이지 말고 기존 layer와 키를 재사용하는 설계로만 진행`이다. 특히 `fbq`, `ttq`, `TIKTOK_PIXEL`, `SITE_SHOP_DETAIL.confirmOrderWithCartItems` 주변은 이미 감시/가드가 걸려 있어 이중 wrap 위험이 크다.

이번 작업은 read-only inventory다. GTM publish, backend deploy, DB write, GA4/Meta/TikTok/Google Ads 전송, NPay 클릭/결제 시도는 하지 않았다.

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: biocom_live_tracking_inventory_snapshot
No GTM publish: YES
No backend deploy: YES
No DB write by Codex: YES
No custom GA4/Meta/TikTok/Google Ads send: YES
NPay click/payment attempted: NO
Live page runtime note: existing pageview/viewcontent scripts attempted network requests, known GA/Meta/TikTok/Google Ads/Naver collect endpoints were route-aborted in Playwright.
New executable send path added: NO
Files changed: this markdown snapshot only
```

## 프로젝트 구조 파악 요약

| 영역 | 역할 | 이번 작업에서 본 위치 |
|---|---|---|
| `backend/` | Express/TypeScript API, attribution/npay/tiktok/meta 로직, 로컬 SQLite | `backend/src/npayIntentLog.ts`, `backend/src/routes/attribution.ts`, `backend/src/tiktokPixelEvents.ts` |
| `frontend/` | Next.js dashboard, 7010 포트 | 이번 작업은 코드 수정 없음 |
| `data/` | 분석 리포트와 snapshot 산출물 | 본 파일과 preview design 저장 위치 |
| `harness/coffee-data/` | Coffee Data Harness 기준판 | live tag inventory 방식 차용 |
| `harness/npay-recovery/` | biocom NPay recovery 기준판 | biocom은 여기 확장이 우선 |
| `naver/` | biocom NPay intent/ROAS 문서 | GTM tag 118, dry-run, 품질 점검 |
| `GA4/` | GTM/GA4 컨테이너 상태 문서 | live version 139 근거 |
| `capivm/`, `footer/`, `tiktok/` | Imweb 삽입 코드, CAPI, TikTok guard 원본 | live header/footer layer 근거 |

## 1. Live Console Markers

관찰 방법: Playwright headless Chrome으로 상품 페이지를 열되, GA/Meta/TikTok/Google Ads/Naver collect 성격의 요청을 route abort했다. NPay 클릭은 하지 않았다.

```text
[biocom-tiktok-purchase-guard] installed {version: 2026-04-23.tiktok-purchase-guard-enforce.v2-event-log, ...}
[funnel-capi] fbq wrapped agent=imweb version=2.9.310
[funnel-capi] installed 2026-04-15-biocom-funnel-capi-v3 pixel=1283400029487161 enableServerCapi=false testEventCode=(none) sessionId=mon1j4qw6eaf9d
tiktok-pixel start
naverPayButton.js: parser-blocking cross-site script warning
[funnel-capi] inject eid ViewContent ViewContent.386.mon1j4qw6eaf9d payload=...
[funnel-capi] server skipped (disabled) ViewContent ViewContent.386.mon1j4qw6eaf9d
IMWEB_DEPLOY_STRATEGY init event dispatched
[scroll-tracking:B0012] ...
[TikTok Catalog] ViewContent 전송: 메타드림 식물성 멜라토닌 함유
```

해석:

| marker | 의미 |
|---|---|
| `biocom-tiktok-purchase-guard v2-event-log` | TikTok Purchase Guard v2가 live header에 있고 `TIKTOK_PIXEL`, `ttq`를 wrap한다 |
| `funnel-capi v3` | Meta fbq mirror/eventId injector가 live footer에 있다 |
| `enableServerCapi=false` | funnel-capi의 Meta server CAPI mirror는 꺼져 있다 |
| `ViewContent.386.<sessionId>` | 상품 상세 진입 시 funnel-capi eid가 발급된다 |
| `tiktok-pixel start` | Imweb TikTok Pixel auto/init layer가 있다 |
| `TikTok Catalog ViewContent` | 별도 TikTok catalog 보완 코드가 ViewContent를 호출한다 |
| Naver Pay parser warning | NPay 버튼은 Naver cross-site SDK가 `document.write`로 그린다 |

## 2. GTM Live Version

| 필드 | 값 |
|---|---|
| GTM container id | `GTM-W2Z6PHN` |
| runtime HTML 확인 | live HTML과 runtime scripts에서 `GTM-W2Z6PHN` 2회 확인 |
| live version no | `139` |
| live version name | `npay_intent_only_live_20260427` |
| 근거 | `GA4/gtm.md`, `naver/npay-intent-quality-20260430.md`의 2026-04-30 GTM API read-only 확인 |
| runtime 한계 | public page runtime만으로 GTM version number는 직접 노출되지 않는다 |

현재 핵심 태그 상태:

| tag | 상태 | 의미 |
|---|---|---|
| `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` | live, endpoint `/api/attribution/npay-intent`, purchase call 없음 | NPay intent-only 수집 |
| `[43] GA4_구매전환_Npay` | live, `add_payment_info` | v138 이후 버튼 클릭 purchase 아님 |
| `[48] GA4_구매전환_홈피구매` | paused | homepage duplicate purchase 차단 |
| `[143] HURDLERS - [이벤트전송] 구매` | live, canonical `purchase` | 일반 PG/홈페이지 purchase 정본 |

## 3. Imweb Header / Footer Custom Code

live HTML `curl`에서 2026-05-02 00:00 KST 기준 아래 문자열이 확인됐다.

| 위치 | layer | current marker |
|---|---|---|
| header top | Meta Purchase Guard | `2026-04-12-server-payment-decision-guard-v3`, endpoint `https://att.ainativeos.net/api/attribution/payment-decision` |
| header top | TikTok Purchase Guard | `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`, event log endpoint `https://att.ainativeos.net/api/attribution/tiktok-pixel-event` |
| header | GTM canonical | `GTM-W2Z6PHN` |
| footer | `checkout_started` | `2026-04-15-biocom-checkout-started-v1`, source `biocom_imweb`, endpoint `/api/attribution/checkout-context` |
| footer | `payment_success` | `2026-04-15-biocom-payment-success-order-code-v1`, source `biocom_imweb`, endpoint `/api/attribution/payment-success` |
| footer | funnel-capi | `2026-04-15-biocom-funnel-capi-v3`, pixel `1283400029487161`, `enableServerCapi=false` |
| body auto | Naver WCS | WCS ID `s_10d569615f0`, checkout whitelist includes `biocom.kr`, `allosta.co.kr` |
| body auto | Google Ads NPay trace | `GOOGLE_ADWORDS_TRACE.setUseNpayCount(true, "AW-304339096/r0vuCKvy-8caEJixj5EB")` |
| body auto | TikTok Pixel | Pixel ID `D5G8FTBC77UAODHQ0KOG` |

funnel-capi 핵심 코드:

| 항목 | 값 |
|---|---|
| `SESSION_KEY` | `__seo_funnel_session` |
| `MIRROR_EVENTS` | `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` |
| `Purchase` | 의도적 제외. Purchase Guard가 별도 관리 |
| eid 형식 | `<EventName>.<contentKey>.<sessionId>` 또는 Imweb이 준 eventID 재사용 |
| sent dedupe key | `funnelCapi::sent::<eventId>` |

## 4. Tracking Layer 분리

| layer | 현재 목적 | primary key | write/send 상태 | 충돌 주의 |
|---|---|---|---|---|
| NPay intent | NPay 버튼 클릭을 purchase가 아닌 intent로 저장 | `gtm_event_id`, `client_id`, `ga_session_id`, `product_idx` | live tag 118이 `/api/attribution/npay-intent`로 저장. 기존 운영 상태 | 새 preview가 같은 endpoint를 호출하면 live intent 원장 오염 |
| 일반 PG checkout | 일반 결제 진입 context 저장 | `__seo_checkout_id`, GA client/session | checkout page에서 `/checkout-context` POST | NPay 외부 redirect 구간은 비어 있음 |
| 일반 PG/payment success | 결제 완료 context 저장 | `order_code`, `order_no`, `payment_code`, `payment_key` | complete page에서 `/payment-success` POST | NPay가 biocom으로 복귀하지 않으면 작동 안 함 |
| Meta browser Pixel | Imweb/Meta browser events | Meta `eventID`, funnel-capi eid | client pixel active. 이번 런타임 요청은 route abort | fbq 이중 wrap 위험 |
| Meta Purchase Guard | pending/virtual account purchase 차단 | `Purchase.<orderCode>` | complete page에서 decision endpoint read | 상품 상세에서는 inactive |
| funnel-capi | Meta browser eventID 주입 + optional server mirror | `__seo_funnel_session`, `funnelCapi::sent::*` | `enableServerCapi=false`, server skipped | 새 eid/session 발급보다 재사용 우선 |
| TikTok browser Pixel | TikTok ViewContent/Purchase 등 | TikTok 자체 event id/options | pixel active. 이번 런타임 요청은 route abort | `ttq`/`TIKTOK_PIXEL` 이미 guard wrap됨 |
| TikTok Guard v2 | TikTok Purchase release/block + event log | `orderCode`, `orderNo`, `paymentCode`, `eventId` | event log endpoint enabled on purchase path | 새 TikTok wrapper 추가 금지 |
| Google Ads NPay trace | Imweb auto NPay conversion count | AW conversion label | live auto layer 존재 | 버튼 클릭 기반 전환 과대 가능성, GTM 계열과 중복 점검 필요 |
| Attribution ledger | internal attribution 보조 원장 | `orderCode/orderNo/paymentKey`, touchpoint | 운영 VM endpoint가 기존 코드에서 사용 | 본 작업에서 직접 호출 금지 |

## 5. Existing Wrappers

runtime product page 기준:

| 함수/객체 | 관찰 결과 |
|---|---|
| `window.fbq` | funnel-capi wrapper가 outer로 설치됨. `__FUNNEL_CAPI_V3_WRAPPED__=true`, agent `imweb`, version `2.9.310` |
| `window.fbq` Purchase Guard marker | 상품 상세에서는 `__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__=false`. Guard 코드가 payment complete page에서만 활성화되기 때문 |
| `window.gtag` | 원본 `function gtag(){dataLayer.push(arguments);}` |
| `window.ttq` | object. TikTok Guard v2가 `ttq.track` wrap 완료 |
| `window.TIKTOK_PIXEL` | object. TikTok Guard v2가 `init`, `track` wrap 완료 |
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` | thin wrapper: `function (type, backurl, params) { confirmOrderWithCartItems(type, backurl, params); }` |
| `window.confirmOrderWithCartItems` | 이번 runtime에서는 `undefined`. Coffee와 달리 page/global 노출 시점이 다를 수 있어 preview snippet은 양쪽 모두 방어적으로 봐야 함 |
| `SITE_SHOP_DETAIL.initDetail` | thin wrapper |
| `naver.NaverPayButton.apply` | Naver SDK 원본 함수 확인 |

TikTok Guard v2 runtime state:

| 항목 | 값 |
|---|---|
| version | `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` |
| endpoint | `/api/attribution/payment-decision` |
| eventLogEndpoint | `/api/attribution/tiktok-pixel-event` |
| wrappers | `tiktokPixelTrack=true`, `tiktokPixelInit=true`, `ttqTrack=true` |
| accessors | `TIKTOK_PIXEL=true`, `ttq=true` |
| debug | `false` |

## 6. Existing Session / Eid Keys

| 시스템 | key | runtime 관찰 |
|---|---|---|
| GA4 primary | `_ga`, `_ga_WJFXN5E2Q1` | cookie 존재 |
| GA4 secondary | `_ga_8GZ48B1S59` | cookie 존재. legacy/support measurement로 보임 |
| Meta | `_fbp` | cookie 존재 |
| Google Ads | `_gcl_au` | cookie 존재 |
| funnel-capi session | `__seo_funnel_session` | `mon1j4qw6eaf9d` 형식 |
| funnel-capi sent eid | `funnelCapi::sent::ViewContent.386.mon1j4qw6eaf9d` | 상품 상세 진입에서 생성 |
| Imweb | `__bs_imweb_session`, `__bs_browser_session_id`, `__bs_imweb_session_history` | sessionStorage 존재 |
| Imweb advanced trace | `ADVANCED_TRACE_CODE_view_contents_code_{...}` | product metadata 포함 |
| Channel Talk | `ch-session-129149`, `ch-veil-id` | cookie/localStorage 존재 |
| TikTok Guard | `__biocom_tiktok_purchase_guard_decisions__` | purchase path에서 rows 저장. 이번 상품 상세 런타임에서는 rows 없음 |
| NPay intent | `npay_intent_log` | server-side SQLite table. client storage key는 이번 page load에서 생성 안 됨 |

## 7. Server Send Enabled / Disabled

| 시스템 | 상태 | 근거 |
|---|---|---|
| funnel-capi Meta server CAPI | disabled | runtime marker `enableServerCapi=false`, `server skipped (disabled)` |
| Meta Purchase Guard decision lookup | enabled on payment complete | header code endpoint `/api/attribution/payment-decision`, product page에서는 inactive |
| footer checkout context | enabled on checkout pages | `isCheckoutCandidate()` 조건에서 `/checkout-context` POST |
| footer payment success | enabled on complete pages | `shop_payment_complete` / `shop_order_done` 조건에서 `/payment-success` POST |
| NPay intent collection | enabled on NPay click | GTM live v139 tag 118, endpoint `/api/attribution/npay-intent` |
| TikTok Guard event log | enabled on purchase path | v2 config `enableEventLog=true`, endpoint `/api/attribution/tiktok-pixel-event` |
| TikTok Events API server-to-TikTok | not confirmed/enabled by this layer | guard logs to internal VM API, not TikTok Events API |
| GA4 Measurement Protocol NPay dispatcher | disabled by default | existing dry-run says dispatcher candidates are blocked without approval; no live dispatcher opened |
| Google Ads conversion upload | not opened by backend | live Imweb/Google auto trace exists, backend upload not part of this inventory |

## 8. Observed Events Without Click

| step | observed | note |
|---|---|---|
| 상품 상세 진입 | Meta `ViewContent` path + funnel-capi eid | request was route-aborted in runtime test |
| 상품 상세 진입 | GA4/Google Ads page_view/config attempts | route-aborted or failed in runtime test |
| 상품 상세 진입 | TikTok Catalog `ViewContent` console marker | TikTok endpoint request route-aborted |
| NPay click | not executed | 운영 결제 흐름 영향 방지 |
| general checkout | not executed | checkout/payment endpoint 호출 방지 |
| purchase/payment success | not executed | Purchase Guard/TikTok Guard purchase branch 미실행 |

## 9. 충돌 가능성 점검

| 충돌 후보 | 판단 | 이유 |
|---|---|---|
| 새 Meta/fbq wrapper 추가 | HIGH risk | funnel-capi가 이미 outer fbq wrapper다. Purchase Guard도 complete page에서 fbq를 잡는다 |
| 새 TikTok/ttq wrapper 추가 | HIGH risk | TikTok Guard v2가 `ttq`와 `TIKTOK_PIXEL` accessor/wrapper를 이미 설치했다 |
| NPay intent 새 endpoint 호출 | HIGH risk | tag 118이 이미 live로 `/npay-intent`를 쓴다. preview에서 같은 endpoint 호출하면 운영 intent 수가 오염된다 |
| `__seo_funnel_session` 재발급 | MED risk | funnel-capi가 이미 발급하므로 새 session_uuid보다 기존 키 재사용이 맞다 |
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` 단독 wrap | MED risk | thin wrapper라 실제 호출 경로를 놓칠 수 있다. global 함수 존재 여부도 함께 검사해야 한다 |
| Google Ads NPay auto trace + GTM 계열 | MED/HIGH risk | Imweb `setUseNpayCount`가 live이고, GTM에도 NPay 관련 태그가 있다. 클릭 기반 전환 과대 가능성은 계속 분리해야 한다 |
| TikTok Guard event log와 attribution ledger | MED risk | purchase 1건이 여러 action row를 만든다. row count를 purchase count로 보면 안 된다 |

## 10. Harness 판단

현재는 신규 `harness/biocom-data`를 바로 만들기보다 `harness/npay-recovery`를 확장하는 것이 맞다.

이유:

1. biocom의 primary source는 이미 NPay Recovery Harness가 정의한 `VM npay_intent_log + 운영 주문 원장 + BigQuery guard` 구조다.
2. 이번 inventory도 NPay intent, Purchase Guard, TikTok Guard, attribution ledger 충돌 점검이 핵심이다.
3. 별도 `harness/biocom-data`는 Meta/TikTok/Google Ads/Attribution 전체 read-only inventory가 2회 이상 반복될 때 만드는 것이 낫다.

권장 확장:

| 위치 | 추가할 것 |
|---|---|
| `harness/npay-recovery/README.md` | biocom live tracking inventory preflight 링크 |
| `harness/npay-recovery/AUDITOR_CHECKLIST.md` | 새 wrapper/intent/eid 작업 전 live inventory 7일 freshness hard fail |
| `harness/npay-recovery/RULES.md` | `__seo_funnel_session`, `funnelCapi::sent::*`, TikTok Guard v2 wrapper 공존 규칙 |

이번 턴에서는 하네스 파일을 수정하지 않았다. 판단만 본 snapshot에 고정한다.
