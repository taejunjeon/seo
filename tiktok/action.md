# TikTok 성과 측정 개선 액션

작성일: 2026-04-16

## 한 줄 결론

가장 중요한 1순위는 **가상계좌 미입금 주문이 TikTok `Purchase`로 잡히는 오염을 먼저 제거하는 것**이다.

TikTok 광고비/ROAS CSV 또는 API를 붙이기 전에 `Purchase`의 의미를 "실제 결제 확정"에 가깝게 만들어야 한다. 지금 상태에서 광고비를 연결해도, 미입금 가상계좌 주문이 구매로 들어가면 TikTok ROAS가 구조적으로 과대 계산될 수 있다.

## 현재 확인된 상태

| 항목 | 상태 |
|---|---|
| Pixel ID | `D5G8FTBC77UAODHQ0KOG` |
| Pixel Helper | `PageView`, `ViewContent`, `Purchase` 확인 |
| Events Manager 테스트 이벤트 | 같은 브라우저 기준 `InitiateCheckout`, `Purchase` 수신 확인 |
| 내부 원장 TikTok 분류 | `ttclid`, TikTok referrer/UTM 기준 분류 가능 |
| 최근 바이오컴 TikTok 원장 샘플 | 최근 30일 기준 TikTok 귀속 1건, `pending` 1건, confirmed 매출 0원, pending 매출 21,900원 |
| TikTok Ads 지출/플랫폼 구매값 | 백엔드 미연동. 현재 Att ROAS vs TikTok ROAS 숫자 비교 불가 |

## 우선순위

### P0. TikTok Purchase 오염 제거

목표: 가상계좌 미입금 주문 생성은 `Purchase`가 아니라 주문 생성/보류 이벤트로 분리하고, 카드 결제 및 실제 입금 확정만 `Purchase`로 남긴다.

왜 먼저 하는가:

- TikTok 웹 픽셀은 `shop_payment_complete` 진입 시점에 `Purchase`를 발화한다.
- 가상계좌는 이 시점이 실제 입금 완료가 아니라 "주문 생성"일 수 있다.
- 따라서 지금 `Purchase`를 그대로 두면 TikTok Ads Manager의 구매수와 ROAS가 실제 매출보다 높아질 수 있다.
- 기존 `/api/attribution/payment-decision`은 이미 `confirmed`, `pending`, `canceled` 판정을 반환한다. 병목은 판정 API가 아니라 TikTok 픽셀 `Purchase`를 안전하게 통제하는 것이다.

실행 순서:

1. TikTok Browser Purchase Guard를 `dry-run`으로 만든다.
2. `TIKTOK_PIXEL.track('Purchase', ...)`와 가능하면 `ttq.track('Purchase', ...)` 호출을 감시한다.
3. 주문번호와 결제번호를 뽑아 `/api/attribution/payment-decision`으로 판정한다.
4. `confirmed / allow_purchase`이면 원래 `Purchase`를 그대로 통과시킨다.
5. `pending / block_purchase_virtual_account`이면 아직 차단하지 않고 콘솔/로그에만 남긴다.
6. 카드 1건, 가상계좌 미입금 1건으로 dry-run 판정이 맞는지 확인한다.
7. dry-run 검증 후 테스트 enforce에서 pending 가상계좌의 `Purchase`만 차단한다.
8. pending 대체 이벤트는 `PlaceAnOrder`를 우선 후보로 테스트하고, TikTok Events Manager 수신이 불안정하면 custom event 후보를 별도 검토한다.

완료 기준:

| 케이스 | 기대 결과 |
|---|---|
| 카드 결제 confirmed | TikTok `Purchase` 유지 |
| 가상계좌 주문 생성 pending | TikTok `Purchase` 차단, `PlaceAnOrder` 또는 별도 보류 이벤트로 분리 |
| 같은 주문번호 재진입 | 같은 `event_id` 규칙 유지, 중복 `Purchase` 없음 |
| Events Manager 테스트 | 카드 구매는 `Purchase`, 가상계좌 미입금은 `Purchase` 미수신 |

담당:

| 담당 | 할 일 |
|---|---|
| 에이전트 | Guard 초안 작성, dry-run 로그 설계, rollback 기준 작성 |
| TJ님 | 운영 헤더 적용 승인, 카드/가상계좌 테스트 주문, Events Manager 확인 |

주의:

- 운영 헤더에 실제 enforce 적용 전 TJ님 승인이 필요하다.
- TikTok Events API를 먼저 붙이지 않는다. 웹 `Purchase`가 이미 발화되는 상태라 서버 이벤트를 추가하면 중복 전환과 dedup 실패 리스크가 커진다.

## P1. TikTok Ads Manager 지출/구매값 적재

목표: `/ads/tiktok`에서 Att ROAS와 TikTok Ads ROAS를 같은 기간으로 비교할 수 있게 한다.

왜 P0 다음인가:

- ROAS 계산에는 광고비가 필요하다.
- 하지만 P0 없이 광고비만 붙이면 잘못된 `Purchase` 기준으로 플랫폼 ROAS를 비교하게 된다.

필요 데이터:

| 데이터 | 필요 컬럼 |
|---|---|
| TikTok 캠페인 CSV | 날짜, 캠페인 ID, 캠페인명, spend, impressions, clicks, conversions, purchase value |
| 내부 attribution 원장 | order_code, paymentStatus, confirmedRevenue, pendingRevenue, channel, ttclid/utm/referrer |
| 매칭 기준 | 날짜 범위, 캠페인 UTM, ttclid 가능 여부, 주문 상태 |

실행 순서:

1. TJ님이 TikTok Ads Manager에서 동일 기간 캠페인 CSV를 export한다.
2. 에이전트가 CSV 적재 위치와 스키마를 고정한다.
3. `/ads/tiktok`에 spend, TikTok platform purchase value, TikTok platform ROAS를 표시한다.
4. 내부 원장 기준 confirmed 매출로 Att ROAS를 계산한다.
5. `pending 포함`, `pending 제외` 두 버전을 분리해서 차이를 보여준다.

완료 기준:

| 지표 | 계산식 |
|---|---|
| Att ROAS | TikTok 귀속 confirmed 매출 / TikTok spend |
| Potential Att ROAS | TikTok 귀속 confirmed + pending 매출 / TikTok spend |
| TikTok Ads ROAS | TikTok Ads Manager purchase value / TikTok spend |
| ROAS Gap | TikTok Ads ROAS - Att ROAS |

## P2. TikTok Events API는 조건부로만 진행

Events API는 "이벤트가 안 들어와서" 붙이는 것이 아니라, 아래 조건이 확인될 때만 진행한다.

진행 조건:

- P0 Guard 이후에도 TikTok 인앱 브라우저나 리다이렉트 구간에서 구매 손실이 크다.
- 실제 가상계좌 입금 완료 후 `Purchase`를 서버에서 보내야 할 필요가 있다.
- 웹 `Purchase`와 서버 `Purchase`의 `event_id` dedup 규칙을 동일하게 만들 수 있다.

금지:

- 웹 `Purchase`가 살아 있는 상태에서 같은 주문의 서버 `Purchase`를 무작정 추가 전송하지 않는다.
- Meta CAPI 코드를 TikTok Events API로 혼용하지 않는다. 모듈, 로그, 환경변수를 분리한다.

## P3. 퍼널 이벤트 품질 정리

P0/P1 이후에 진행한다.

확인할 것:

- `ViewContent`가 상품페이지에서 2회 잡히는 중복 원인 확인
- `AddToCart` 수신 여부 확인
- `InitiateCheckout`이 Pixel Helper와 Events Manager에서 같은 단계로 보이는지 확인
- 상품 `content_id`, `content_name`, `value`, `currency` 형식 통일
- event_id 규칙 통일: `Purchase_{order_code}` 또는 `Purchase.{order_code}` 중 최종 규칙 하나로 고정

## 운영 판단 기준

| 질문 | 판단 |
|---|---|
| 지금 바로 TikTok Events API를 붙일까? | 아니오. P0 Guard가 먼저다 |
| 지금 TikTok 광고성과 비교가 가능한가? | 일부만 가능. 내부 TikTok pending/confirmed 전환은 가능하지만 ROAS 숫자 비교는 광고비 미연동 때문에 불가 |
| 가장 먼저 봐야 할 화면은? | `/ads/tiktok`과 TikTok Events Manager 테스트 이벤트 |
| TJ님이 바로 할 일은? | TikTok Ads Manager 캠페인 CSV export 준비, 운영 헤더 enforce 전 승인, 카드/가상계좌 테스트 |
| 에이전트가 바로 할 일은? | TikTok Browser Purchase Guard dry-run 초안 작성 |

## 다음 액션

1. 에이전트: TikTok Browser Purchase Guard `enforce` 후보를 작성하고 로컬 분기 테스트를 통과시킨다.
2. TJ님: `dry-run v3` 상태에서 카드 결제 1건도 `allow_purchase`로 잡히는지 확인한다.
3. TJ님 승인 후: 운영 헤더에서 pending 가상계좌 `Purchase` 차단을 테스트 enforce로 진행한다.
4. 에이전트: CSV가 생기면 `/ads/tiktok`에 TikTok spend와 platform ROAS를 연결한다.

## 2026-04-17 dry-run v1 결과와 v2 조치

TJ님이 가상계좌 미입금 주문을 생성해 확인한 결과, Meta Purchase Guard는 정상적으로 `pending / block_purchase_virtual_account`를 반환했고 Meta `Purchase`는 `VirtualAccountIssued`로 낮아졌다.

하지만 TikTok Pixel Helper에서는 여전히 `Purchase`가 발생했고, v1 dry-run의 `getDecisions()`는 빈 배열이었다. 즉 결제 상태 판정 API 문제가 아니라 TikTok wrapper가 `Purchase` 호출을 감지하지 못한 문제다.

확인 주문:

| 항목 | 값 |
|---|---|
| order_code | `o20260416f773f401e36ab` |
| order_no | `202604179651292` |
| payment_code | `pa202604162a03f0c0461f2` |
| 서버 판정 | `pending / block_purchase_virtual_account` |
| matchedBy | `toss_direct_order_id` |

조치:

- `tiktok/imwebcode.md`를 v2로 갱신했다.
- v2는 scan 시간을 10초에서 90초로 늘렸다.
- `TIKTOK_PIXEL.track`뿐 아니라 `TIKTOK_PIXEL.init`도 감싼다.
- TikTok SDK가 늦게 로드되거나 `ttq.track`이 재할당되어도 반복 scan으로 다시 wrap한다.
- 아직 dry-run이며 TikTok `Purchase`를 차단하지 않는다.

## 2026-04-17 dry-run v2 결과와 v3 조치

v2는 운영 사이트에 정상 삽입됐다. 로그상 `installed 2026-04-17...v2`, `wrapped_TIKTOK_PIXEL_init`, `wrapped_TIKTOK_PIXEL_track`, `wrapped_ttq_track`가 확인됐다.

그런데 Pixel Helper에는 여전히 TikTok `Purchase`가 보였고, `purchase_seen` 로그가 없었다. 이 단계는 dry-run이므로 `Purchase`가 보이는 것 자체는 정상이다. 문제는 `purchase_seen`이 없다는 점이다.

원인:

- v2는 50ms polling으로 `TIKTOK_PIXEL`을 감싸는 구조다.
- 아임웹 결제완료 페이지에서는 `TIKTOK_PIXEL` 생성 직후 `init`과 `Purchase` 호출이 매우 빠르게 이어진다.
- polling이 그 짧은 구간을 놓치면, wrap은 나중에 붙지만 이미 `Purchase`는 지나간다.

조치:

- `tiktok/imwebcode.md`를 v3로 갱신했다.
- `tiktok/tiktok_purchase_guard_dry_run_v3.js`를 추가했다.
- v3는 `window.TIKTOK_PIXEL`과 `window.ttq`에 setter/accessor를 먼저 설치한다.
- 따라서 아임웹 스크립트가 `TIKTOK_PIXEL`을 만드는 순간 바로 wrapper를 붙인다.
- v3도 아직 dry-run이다. 목표는 `purchase_seen`과 `dry_run_observed_purchase`가 찍히는지 확인하는 것이다.

## 2026-04-17 dry-run v3 결과와 enforce 후보

v3는 가상계좌 미입금 주문에서 TikTok `Purchase` 호출을 정상 감지했다.

확인 주문:

| 항목 | 값 |
|---|---|
| order_code | `o20260416468f86bc166d8` |
| order_no | `202604171284269` |
| payment_code | `pa2026041647d45f38b315f` |
| Pixel Helper | `Pageview`, `Purchase` 표시 |
| dry-run 로그 | `purchase_seen`, `dry_run_observed_purchase` 확인 |
| 서버 판정 | `pending / block_purchase_virtual_account` |
| matchedBy | `toss_direct_order_id` |

판단:

- v3 코드 교체는 정상이다.
- `window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.state.accessors`가 `{ TIKTOK_PIXEL: true, ttq: true }`로 확인됐다.
- `window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.state.wrappers`가 `{ tiktokPixelTrack: true, tiktokPixelInit: true, ttqTrack: true }`로 확인됐다.
- `getDecisions()`에 1건이 기록됐다.
- Pixel Helper에 `Purchase`가 보이는 것은 아직 dry-run이기 때문에 정상이다.

enforce 후보:

- 파일: `tiktok/tiktok_purchase_guard_enforce_v1.js`
- pending 가상계좌 `block_purchase_virtual_account`는 원래 TikTok `Purchase`를 호출하지 않는다.
- pending 가상계좌는 대체 이벤트 후보 `PlaceAnOrder`를 보낸다.
- confirmed `allow_purchase`는 결제 판정 후 원래 TikTok `Purchase`를 통과시킨다.
- 판정 실패, 네트워크 오류, 키 누락 등 unknown은 `allowOnUnknown=true`로 fail-open 처리한다. 실제 카드 구매 손실을 막기 위한 안전장치다.

로컬 분기 테스트:

| 케이스 | 기대 이벤트 | 결과 |
|---|---|---|
| pending virtual account | `PlaceAnOrder`만 전송 | 통과 |
| confirmed card | `Purchase` 전송 | 통과 |
| unknown fail-open | `Purchase` 전송 | 통과 |

남은 확인:

- 운영 enforce 적용 전, `dry-run v3` 상태에서 카드 결제 1건의 `dry_run_observed_purchase`가 `confirmed / allow_purchase`로 찍히는지 확인한다.
- 카드 confirmed 확인 후 `tiktok/imwebcode_enforce_candidate.md`의 코드를 헤더에 교체 적용한다.
- enforce 적용 후 가상계좌 미입금 주문에서 TikTok Pixel Helper에 `Purchase`가 사라지고 `PlaceAnOrder`만 보이는지 확인한다.
