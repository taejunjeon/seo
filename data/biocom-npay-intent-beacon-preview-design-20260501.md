# Biocom NPay Intent Beacon Preview Design (2026-05-01)

작성 시각: 2026-05-02 00:28 KST
파일 기준일: 2026-05-01
site: `biocom` (`https://www.biocom.kr`)
mode: `preview_only` / `no_send` / `no_write` / `no_publish`
Primary source: `data/biocom-live-tracking-inventory-20260501.md`, `data/coffee-npay-intent-beacon-preview-design-20260501.md`, `data/coffee-live-tracking-inventory-20260501.md`, `naver/npay-intent-quality-20260430.md`, `naver/!npayroas.md`, `tiktok/headercode.md`
Freshness: biocom live runtime 2026-05-02 00:01 KST, GTM API snapshot 문서 2026-04-30 11:55 KST
Confidence: 82%

## 10초 요약

Coffee에서 검증한 `imweb_order_code capture` 방식은 바이오컴에도 적용 가능성이 높다. 바이오컴도 funnel-capi v3, `__seo_funnel_session`, `funnelCapi::sent::InitiateCheckout.*` 계열 구조를 쓰고 있기 때문이다.

다만 바이오컴에는 이미 NPay intent 수집, TikTok Guard v2, Meta Purchase Guard, attribution ledger가 live로 붙어 있다. 따라서 이번 단계의 정답은 새 전송이 아니라 `no-send preview buffer`로 order code가 잡히는지만 확인하는 설계다.

이번 문서는 운영 반영용 코드가 아니다. GTM publish, backend deploy, DB write, GA4/Meta/TikTok/Google Ads 전송, NPay 실클릭은 모두 범위 밖이다.

## Auditor Verdict

```text
Auditor verdict: PASS_DESIGN_ONLY
Phase: biocom_npay_intent_beacon_preview_design
No GTM publish: YES
No backend deploy: YES
No DB write: YES
No GA4/Meta/TikTok/Google Ads send: YES
No NPay click/payment execution in this task: YES
Output type: markdown design only
```

## 1. 결론

바이오컴은 신규 `NPay intent beacon`을 바로 붙이면 안 된다. live GTM tag 118이 이미 `/api/attribution/npay-intent`를 호출하고 있고, 그 호출은 VM SQLite의 `npay_intent_log`를 바꾼다.

따라서 preview-only 단계에서는 아래 세 가지만 한다.

| 단계 | 목적 | 허용 여부 |
|---|---|---|
| live inventory | 기존 layer, wrapper, session/eid 확인 | 허용, 완료 |
| no-send preview buffer | 브라우저 메모리 또는 sessionStorage에만 capture 후보 기록 | 허용 |
| endpoint beacon | `/api/attribution/npay-intent`, `/checkout-context`, `/payment-success` 호출 | 금지 |

## 2. Tracking Layer 분리

바이오컴은 NPay, 일반 PG, TikTok, Meta를 같은 전환으로 보면 안 된다. 각 layer의 책임이 다르고, 일부는 이미 구매 차단 또는 구매 보정 역할을 하고 있다.

| layer | 현재 역할 | preview 설계에서의 취급 |
|---|---|---|
| NPay intent | 상품 상세의 네이버페이 버튼 클릭을 intent로 기록한다 | 기존 tag 118과 endpoint를 건드리지 않는다 |
| 일반 PG checkout | Imweb checkout page 진입 context를 `/checkout-context`로 저장한다 | NPay preview가 이 endpoint를 호출하지 않는다 |
| 일반 PG payment success | Imweb complete page에서 `/payment-success`로 order_code를 저장한다 | NPay preview와 분리한다 |
| Meta funnel-capi | `fbq` eventID를 주입하고 `funnelCapi::sent::*`를 남긴다 | session/eid 읽기만 한다 |
| Meta Purchase Guard | pending/가상계좌 purchase를 차단 또는 release한다 | purchase path를 건드리지 않는다 |
| TikTok Pixel | TikTok ViewContent/Purchase 등을 처리한다 | `ttq`, `TIKTOK_PIXEL` wrap 금지 |
| TikTok Guard v2 | TikTok purchase release/block와 event log를 관리한다 | preview가 event log를 만들지 않는다 |
| Google Ads/Naver auto layer | Imweb/Naver/Google 자동 추적 layer | preview가 conversion call을 만들지 않는다 |
| attribution ledger | 내부 attribution 보조 원장 | preview 단계에서 write 금지 |

운영 판단 기준:

| 질문 | primary | cross-check | fallback |
|---|---|---|---|
| NPay 버튼 intent가 있었는가 | `npay_intent_log` | GTM debug/API snapshot | browser preview buffer |
| Imweb order code가 만들어졌는가 | Imweb order/payment source | `funnelCapi::sent::InitiateCheckout.*` eid | browser preview buffer |
| 구매가 확정됐는가 | 운영 주문/결제 원장 | BigQuery GA4 purchase | VM attribution ledger |
| TikTok purchase가 정상 release됐는가 | TikTok Guard v2 event log | payment decision rows | TikTok Ads는 최종 대조용 |

## 3. Coffee 방식의 바이오컴 적용 가능성

Coffee에서 확인한 핵심은 `NPay 클릭 직후 Imweb이 InitiateCheckout eid에 order_code를 심는지`를 보는 방식이다. 바이오컴에도 같은 구조가 상당 부분 존재한다.

| Coffee에서 검증한 조건 | Biocom 관찰 결과 | 판단 |
|---|---|---|
| funnel-capi v3 존재 | `2026-04-15-biocom-funnel-capi-v3` live | 가능성 높음 |
| session key 재사용 | `__seo_funnel_session` live | 가능 |
| sent key에 eid 저장 | `funnelCapi::sent::ViewContent.386.<sessionId>` 확인 | 가능 |
| `MIRROR_EVENTS`에 InitiateCheckout 포함 | live code에 포함 | 가능 |
| NPay click wrapper 후보 | `SITE_SHOP_DETAIL.confirmOrderWithCartItems` 존재 | 가능하지만 방어적 접근 필요 |
| global confirm 함수 | 이번 상품 runtime에서는 `window.confirmOrderWithCartItems`가 `undefined` | 노출 시점 재확인 필요 |

결론: `imweb_order_code capture`는 바이오컴에서도 preview-only로 설계할 수 있다. 단, 실제 NPay 버튼 클릭은 현재 범위에서 DB write를 유발할 수 있으므로 실행하지 않는다.

## 4. Preview-Only Capture 설계

### 4-1. 관찰할 함수

preview snippet은 함수 호출을 바꾸기보다, 먼저 현재 노출 상태를 기록한다.

| 관찰 대상 | 이유 |
|---|---|
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` | 상품 상세 NPay 버튼 호출 후보 |
| `window.confirmOrderWithCartItems` | Coffee에서는 실제 order code capture에 중요한 후보였음 |
| `naver.NaverPayButton.apply` | Naver Pay button renderer 존재 확인 |
| `sessionStorage.__seo_funnel_session` | funnel-capi session 재사용 |
| `sessionStorage.funnelCapi::sent::InitiateCheckout.*` | order_code가 담길 가능성이 있는 eid 후보 |

### 4-2. capture 흐름

이 흐름은 preview-only 설계다. 운영 코드에 붙이지 않는다.

```text
1. page load 후 기존 session/eid 상태를 읽는다.
2. wrapper 후보의 존재 여부와 함수 본문 signature만 기록한다.
3. NPay click을 실행하지 않고, preview buffer에 baseline snapshot을 저장한다.
4. 별도 승인된 browser-only 테스트에서만 click 직전/직후 sessionStorage diff를 본다.
5. diff 대상은 funnelCapi::sent::InitiateCheckout.* key로 제한한다.
6. retry window는 Coffee와 동일하게 100ms, 500ms, 1500ms를 쓴다.
7. capture 결과는 sessionStorage preview buffer에만 저장한다.
8. fetch, sendBeacon, XMLHttpRequest, gtag, fbq, ttq는 호출하지 않는다.
```

### 4-3. preview buffer 필드

preview buffer 이름은 실제 운영 endpoint와 분리한다.

| field | 설명 |
|---|---|
| `site` | `biocom` |
| `mode` | `preview_only` |
| `version` | `biocom-npay-intent-preview-v0.1` |
| `captured_at_kst` | 브라우저 기준 capture 시각 |
| `intent_uuid` | preview 내부 식별자. 운영 intent id로 쓰지 않음 |
| `funnel_capi_session_id` | `__seo_funnel_session` 값 |
| `pre_sent_eids` | click 전 `funnelCapi::sent::*` 목록 |
| `post_sent_eids` | click 후 후보 목록. 현재 범위에서는 실측하지 않음 |
| `imweb_order_code` | `oYYYYMMDD...` 패턴이 잡힐 때만 채움 |
| `imweb_order_code_eid` | order code가 들어 있던 InitiateCheckout eid |
| `capture_delay_ms` | `100`, `500`, `1500` 중 capture 성공 시점 |
| `product_idx` | 상품 상세 idx |
| `product_name` | Imweb/trace에서 읽은 상품명 |
| `wrapper_state` | 함수 존재 여부와 wrapped marker |
| `network_policy` | `no_fetch_no_beacon_no_pixel_send` |
| `notes` | 예외와 미확정 사항 |

sessionStorage 후보 key:

```text
biocom_npay_intent_preview::latest
biocom_npay_intent_preview::history::<intent_uuid>
```

## 5. DB Write 금지 조건에서 가능한 검증

현재 요청의 DB write 금지 조건에서는 실제 NPay 버튼 클릭도 하지 않는 것이 맞다. biocom live GTM tag 118이 클릭 intent를 VM endpoint로 보낼 수 있기 때문이다.

| 검증 | 이번 범위 가능 여부 | 이유 |
|---|---|---|
| live HTML marker 확인 | 가능 | write 없음 |
| product page runtime inventory | 가능 | known collect endpoint를 차단하고 클릭하지 않음 |
| wrapper 존재 여부 확인 | 가능 | 읽기 전용 |
| sessionStorage baseline 확인 | 가능 | 브라우저 로컬 read-only 관찰 |
| NPay 버튼 실클릭 | 금지 | 기존 tag 118이 `/npay-intent` DB write를 만들 수 있음 |
| NPay 결제 시도 | 금지 | 운영 결제/전환 흐름 영향 |
| GTM Preview에서 tag firing 관찰 | 조건부 금지 | tag 118이 live endpoint를 호출하면 DB write 발생 |
| backend receiver dry-run | 이번 범위 금지 | deploy/write 없이 별도 로컬 설계 문서까지만 가능 |

다음 단계에서 TJ님이 명시 승인할 수 있는 최소 예외는 `NPay 버튼 1회 클릭, 결제 진행 없음, 기존 live intent write 허용`이다. 이 예외가 없으면 order_code capture의 마지막 증명은 하지 않는다.

## 6. 기존 시스템과의 충돌 점검

### 6-1. 기존 biocom NPay intent 수집

현재 상태:

| 항목 | 값 |
|---|---|
| GTM container | `GTM-W2Z6PHN` |
| live version | `139` |
| tag | `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` |
| endpoint | `/api/attribution/npay-intent` |
| 역할 | purchase가 아닌 intent-only 수집 |

충돌:

| 위험 | 판단 | preview 대응 |
|---|---|---|
| 같은 endpoint 중복 호출 | HIGH | 호출 금지 |
| 같은 `gtm_event_id` 또는 client/session 중복 생성 | MED | preview id는 별도 namespace |
| click 기반 purchase 오인 | HIGH | preview 문서와 buffer에 `intent_only` 명시 |

### 6-2. TikTok Guard v2

현재 상태:

| 항목 | 값 |
|---|---|
| version | `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` |
| wrappers | `TIKTOK_PIXEL.init`, `TIKTOK_PIXEL.track`, `ttq.track` |
| internal event log | `/api/attribution/tiktok-pixel-event` |
| purchase decision | `/api/attribution/payment-decision` |

충돌:

| 위험 | 판단 | preview 대응 |
|---|---|---|
| `ttq.track` 이중 wrap | HIGH | TikTok object 접근 금지 |
| purchase row count 오해 | MED | event log row와 purchase count 분리 |
| NPay preview가 TikTok purchase를 만들 가능성 | HIGH | TikTok call 금지 |

### 6-3. Meta funnel-capi / Purchase Guard

현재 상태:

| 항목 | 값 |
|---|---|
| Meta pixel id | `1283400029487161` |
| funnel-capi | `2026-04-15-biocom-funnel-capi-v3` |
| server CAPI mirror | `enableServerCapi=false` |
| Purchase Guard | `2026-04-12-server-payment-decision-guard-v3` |

충돌:

| 위험 | 판단 | preview 대응 |
|---|---|---|
| `fbq` 이중 wrap | HIGH | `fbq` 호출/교체 금지 |
| eventID dedupe 붕괴 | HIGH | 기존 `funnelCapi::sent::*` 읽기만 함 |
| server CAPI가 켜질 때 중복 send | MED | 이 preview는 send path가 없으므로 영향 없음 |

### 6-4. Attribution ledger

기존 ledger 계열 endpoint는 `checkout-context`, `payment-success`, `payment-decision`, `tiktok-pixel-event`, `npay-intent`로 분리돼 있다. preview design은 이 endpoint들을 호출하지 않는다.

충돌 판단:

| 위험 | 판단 | 이유 |
|---|---|---|
| ledger row 오염 | LOW if preview-only | network write가 없기 때문 |
| 향후 enforce 시 order join 중복 | MED | `imweb_order_code`, `order_no`, `payment_key`의 priority rule 필요 |
| NPay synthetic purchase와 실제 purchase 혼합 | HIGH | BigQuery/GA4에서는 NPay형 purchase를 별도 window와 source로 분리해야 함 |

## 7. Preview Test Gate

preview를 실제 브라우저에 붙이기 전 gate는 아래와 같다.

| gate | 통과 기준 |
|---|---|
| no-send scan | snippet 안에 `fetch`, `sendBeacon`, `XMLHttpRequest`, `gtag(`, `fbq(`, `ttq.` 호출이 없어야 한다 |
| wrapper read-only | 기존 함수 참조와 signature 기록만 허용한다 |
| endpoint denylist | `/npay-intent`, `/checkout-context`, `/payment-success`, `/payment-decision`, `/tiktok-pixel-event` 문자열이 send path에 없어야 한다 |
| storage namespace | `biocom_npay_intent_preview::*`만 새로 쓴다 |
| existing keys | `__seo_funnel_session`, `funnelCapi::sent::*`는 읽기만 한다 |
| rollback | preview storage 삭제만으로 원복 가능해야 한다 |

## 8. Harness 판단

이번 단계에서는 신규 `harness/biocom-data`를 만들지 않는다.

바이오컴의 이번 문제는 `NPay recovery + existing attribution guard 공존`이 핵심이다. 그래서 `harness/npay-recovery` 확장이 우선이다.

권장 확장 범위:

| 파일 | 추가할 규칙 |
|---|---|
| `harness/npay-recovery/README.md` | biocom live tracking inventory와 preview design을 preflight 문서로 링크 |
| `harness/npay-recovery/RULES.md` | NPay preview에서 existing endpoint 호출 금지, `__seo_funnel_session` 재사용, `fbq/ttq` wrap 금지 |
| `harness/npay-recovery/VERIFY.md` | no-send scan, no DB write, no GTM publish 확인 항목 추가 |
| `harness/npay-recovery/AUDITOR_CHECKLIST.md` | wrapper/eid 작업 전 7일 이내 live inventory 필요 |

`harness/biocom-data`는 아래 조건 중 하나가 생길 때 만든다.

| 조건 | 판단 |
|---|---|
| 바이오컴 전용 Meta/TikTok/Google Ads/GA4 inventory를 반복 운영해야 함 | 생성 검토 |
| NPay를 넘어 attribution ledger 전체를 정기 감사해야 함 | 생성 검토 |
| Coffee와 Biocom을 같은 template으로 site별 비교해야 함 | 생성 검토 |
| 이번처럼 NPay recovery 중심의 단발 preview 설계 | 아직 생성하지 않음 |

## 9. 다음 행동

| 순서 | 상태 | 담당 | 할 일 | 컨펌 필요 |
|---:|---|---|---|---|
| 1 | 완료 | Codex | live inventory와 preview-only 설계를 문서화 | NO |
| 2 | 대기 | TJ + Codex | `harness/npay-recovery`에 preflight 규칙을 문서로 확장 | NO, 문서만 수정 시 |
| 3 | 대기 | TJ | NPay 버튼 1회 클릭 관찰을 허용할지 결정 | YES, 기존 live intent DB write 가능성 있음 |
| 4 | 대기 | Codex | 승인 시 browser-only preview로 `imweb_order_code` capture 여부 확인 | YES |
| 5 | 대기 | TJ + Codex | endpoint beacon 또는 GTM publish 여부 결정 | YES, 운영 변경 |

이번 산출물 기준의 최종 판단은 `preview 설계 가능, live 실행 보류`다.
