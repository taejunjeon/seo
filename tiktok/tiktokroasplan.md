# TikTok ROAS 정합성 프로젝트 로드맵

작성 시각: 2026-04-23 21:30 KST
기준일: 2026-04-23
버전: v3.10-historical-close-future-v2-standard (이전본: `tiktok/tiktokroasplan.md.bak_20260423_historical_close_future_v2`)

## 2026-04-23 official historical conclusion

이번 프로젝트의 구간 기준을 여기서 고정한다.

**과거 구간은 exact event-level attribution 복원을 목표로 하지 않는다.** 기존 v1이 TikTok Pixel 이벤트를 서버 원장에 쓰지 않았고, TikTok Ads API/CSV도 구매별 `event_id/order_code`를 제공하지 않기 때문이다. 따라서 과거는 business-level validation으로만 닫는다.

**미래 구간은 v2 event log 배포 이후부터 정확도 높은 정합성 기준으로 운영한다.** v2 이후에는 `event_id / order_code / order_no / payment_code / decision` 단위로 TikTok Purchase 흐름을 내부 원장에 남긴다. 예산 판단의 정본도 이 시점 이후 7일/14일 데이터를 기준으로 삼는다.

### 과거 데이터 3등급 종료 기준

| 등급 | 정의 | 현재 결론 | 후속 처리 |
|---|---|---|---|
| 1. 확정 취소/미입금 | 내부 Attribution 원장과 운영 주문 DB에서 미입금 자동취소 또는 취소로 닫힌 주문 | guard 전 TikTok 후보는 운영 원장 write 후 confirmed 0원, pending 0원, canceled 50건 / 552,263,900원이다. 이 중 48건은 2026-04-23에 `canceled/vbank_expired`로 보정 완료했다 | 종료. 더 파지 않는다 |
| 2. 실제 주문 존재 확인 | GA4/운영 주문 DB/Attribution 원장에서 실제 주문 존재는 확인되지만 TikTok Ads 구매와 exact 연결은 안 되는 주문 | 2026-04-18 ~ 2026-04-22 GA4 TikTok-ish purchase 중 운영 주문 DB 매칭 30건이 있었다. 상태는 `PAYMENT_COMPLETE` 28건 / 9,404,586원, `PAYMENT_OVERDUE` 1건 / 39,000원, `REFUND_COMPLETE` 1건 / 1,367,050원이다 | “실제 주문 존재”로만 기록. TikTok Ads 성과로 단정하지 않는다 |
| 3. 연결 불가 잔여분 | TikTok Ads가 구매를 주장하지만 내부 주문과 event-level로 붙일 수 없는 부분 | guard 전 구매 321건 / 구매값 910,630,888원, post-guard 초기 5일 구매 12건 / 구매값 3,456,232원은 order_code 단위 역분해가 불가능하다 | `unknown`으로 닫고 추가 수사 중단 |

### 판단 원칙

제1원칙 질문은 “과거 주문을 더 파면 앞으로 예산 판단이 실질적으로 더 좋아지는가?”다.

현재 답은 **대부분 아니다**. 과거 exact 복원은 구조적으로 불가능하고, 앞으로의 정확도는 v2 이벤트 로그 배포 이후 데이터 품질로 결정된다. 따라서 지금 중요한 일은 과거를 완벽하게 수사하는 것이 아니라, 다음 7일~14일 데이터를 신뢰 가능하게 만드는 것이다.

공식 문장:

> 과거 주문은 exact 매칭 복원을 목표로 하지 않는다. 다만 취소/확정/실주문 존재 여부 수준의 부분 검산까지만 하고, 이후 판단은 v2 이벤트 로그 배포 후 데이터로 한다.

### 지금 액션

1. 과거 구간 official conclusion은 이 섹션으로 고정한다.
2. v2 이벤트 로그를 운영 VM에 배포하고, 아임웹 Guard를 v2로 교체한다. 이 작업은 운영 DB 새 테이블/헤더 코드 변경이므로 TJ 승인 후 진행한다.
3. 배포 직후에는 카드/가상계좌 실결제 전에 `POST -> DB insert -> GET readback -> browser CORS -> live source v1 제거/v2 단일 삽입`까지 먼저 확인한다.
4. 7일/14일 동안 TikTok Ads 구매, `tiktok_pixel_events`, 운영 VM Attribution `payment_success`, 운영 PostgreSQL 주문 상태를 같이 본다.
5. 예산 판단은 이 7일/14일 데이터로 재확정한다.

Codex 판단:

- 과거 구간을 3등급으로 닫는 판단 자신감: **95%**.
- v2 배포 후 7일/14일 관찰을 다음 의사결정 기준으로 삼는 판단 자신감: **92%**.
- 남은 핵심 리스크: 운영 배포 전이므로 `tiktok_pixel_events`는 아직 운영 VM에 없다. v2 배포가 늦어질수록 post-guard 데이터도 계속 exact 연결 불가 상태로 쌓인다.

## 2026-04-23 v2 rollout gate 강화

`tiktok/gptfeedback_0423_1.md` 기준으로, 헤더 교체 승인 조건을 더 엄격하게 고정한다.

### 교체 승인 조건

아래 7개가 모두 맞아야 아임웹 Header Code를 v2로 교체한다.

| 체크 | 기준 |
|---|---|
| backend 배포 | 운영 VM backend 배포 완료 |
| health | `GET /health`가 `status: "ok"` 또는 동등한 정상 응답 |
| event endpoint | `POST /api/attribution/tiktok-pixel-event`가 2xx |
| DB insert | `tiktok_pixel_events`에 실제 row 저장 |
| GET readback | `GET /api/attribution/tiktok-pixel-events?...`에서 방금 row 확인 |
| browser CORS | `biocom.kr` 브라우저에서 cross-origin POST 성공 |
| live source 교체 확인 | live source에서 `2026-04-17...v1`은 0회, `2026-04-23...v2-event-log`는 1회 |

중요: **2xx만으로는 승인하지 않는다.** 실제 write와 readback이 같이 확인돼야 한다.

### 새 smoke script

- 경로: [tiktok-pixel-event-smoke.ts](/Users/vibetj/coding/seo/backend/scripts/tiktok-pixel-event-smoke.ts)
- 목적: `GET /health`, `OPTIONS` preflight, `POST /api/attribution/tiktok-pixel-event`, `GET /api/attribution/tiktok-pixel-events?orderCode=...`, `Access-Control-Allow-Origin`을 한 번에 확인
- 예시 실행:

```bash
cd /Users/vibetj/coding/seo/backend
node --import tsx scripts/tiktok-pixel-event-smoke.ts --baseUrl https://att.ainativeos.net --origin https://biocom.kr
```

이 스크립트는 backend readiness 확인용이다. **실제 브라우저 콘솔 fetch와 live source 문자열 검증은 별도로 해야 한다.**

### 로그 해석 규칙

`tiktok_pixel_events`는 event log 테이블이라서 row 수를 그대로 구매 수로 읽으면 안 된다.

- 카드 1건도 `purchase_intercepted -> decision_received -> released_confirmed_purchase`처럼 3 row가 생길 수 있다.
- 가상계좌 pending 1건도 `purchase_intercepted -> decision_received -> blocked_pending_purchase -> sent_replacement_place_an_order`처럼 4 row가 생길 수 있다.

따라서 구매 수와 최종 상태는 **`eventId/orderCode/orderNo/paymentCode` 기준으로 묶고 마지막 stage를 본다.**

### 첫 1~2일 모니터링 우선순위

- `released_confirmed_purchase`
- `blocked_pending_purchase`
- `sent_replacement_place_an_order`
- `released_unknown_purchase`
- `missing_lookup_keys`
- `request_error`

`released_unknown_purchase`가 많이 나오면 현재 v2는 “정확한 guard”가 아니라 “로그가 달린 fail-open”에 가까운 상태로 해석해야 한다.

## 2026-04-23 기존 삽입 코드/CAPI/원장 공백 재점검

TJ 질문: “원래 TikTok 관련 코드가 헤더/푸터에 들어가 있지 않았나, CAPI가 안 되어 있었나, 내부 원장에 왜 자료가 없는가?”

결론부터 말하면, **TikTok Pixel과 TikTok Purchase Guard는 운영 사이트에 들어가 있었다. 하지만 TikTok Events API/CAPI와 TikTok 이벤트 단위 내부 원장은 아직 운영에 없었다.** 그래서 TikTok Ads Manager나 Pixel Helper에는 구매/대체 이벤트가 보일 수 있지만, 내부 Attribution 원장에는 “TikTok Pixel Purchase가 실제로 언제 허용/차단됐는지”가 주문 단위로 남지 않았다.

현재 운영 사이트 HTML 직접 확인 결과:

| 항목 | 현재 운영 확인 | 의미 |
|---|---|---|
| Meta server payment decision guard | 있음. `[biocom-server-payment-decision-guard]` 코드 확인 | Meta Purchase 차단/허용 판단용 헤더 코드 |
| TikTok Purchase Guard | 있음. `2026-04-17.tiktok-purchase-guard-enforce.v1` 확인 | TikTok `Purchase`를 가로채서 pending 가상계좌는 막고 `PlaceAnOrder`로 대체 |
| TikTok Pixel | 있음. `TIKTOK_PIXEL.init('D5G8FTBC77UAODHQ0KOG')` 확인 | 아임웹 마케팅 탭 자동 주입 TikTok 브라우저 픽셀 |
| Attribution footer | 있음. `/api/attribution/checkout-context`, `/api/attribution/payment-success` 전송 확인 | 결제 페이지 도달/결제완료 페이지 도달을 내부 원장에 기록 |
| Funnel CAPI mirror | 있음. `2026-04-15-biocom-funnel-capi-v3` 확인 | Meta 퍼널 이벤트 mirror 코드 |
| Funnel server CAPI | 꺼짐. `enableServerCapi: false` 확인 | 현재 라이브 로그의 `[funnel-capi]`는 Meta용이며, 서버 전송은 비활성 |
| TikTok Events API/CAPI | 없음 | TikTok 서버 이벤트 전송 경로 없음 |
| TikTok event-level ledger | 운영 없음. `https://att.ainativeos.net/api/attribution/tiktok-pixel-events`는 `not_found` | 새로 개발한 `tiktok_pixel_events`는 아직 운영 VM 배포 전 |

혼동 지점:

- 운영 콘솔의 `[funnel-capi]`는 **Meta Pixel/fbq용**이다. TikTok CAPI가 아니다.
- TikTok Pixel은 브라우저에서 직접 TikTok으로 보내는 코드다. 이것만으로는 우리 내부 DB에 TikTok 이벤트 상세가 저장되지 않는다.
- 기존 Attribution 원장은 `checkout_started`와 `payment_success`만 받는다. 즉 “TikTok Pixel Purchase fired” 자체를 수집하지 않았다.
- 기존 내부 TikTok ROAS 판정은 `payment_success` row 안의 `ttclid`, TikTok UTM, TikTok referrer/landing 문자열을 보고 사후 분류했다. 결제완료 시점에 그 값이 사라지거나 다른 채널 값으로 덮이면 TikTok purchase로 잡히지 않는다.

운영 원장 상태 재확인:

- 운영 VM Attribution 원장 `source=biocom_imweb`는 살아 있다. 2026-04-23 13:52 KST 조회 기준 전체 3,549건, `checkout_started` 2,131건, `payment_success` 1,418건이 있다.
- 2026-04-18 ~ 2026-04-22 기간에도 운영 VM 원장에는 `payment_success` 251건, `checkout_started` 672건이 있다. 즉 “원장 자체가 비어 있음”이 아니다.
- 같은 기간 TikTok ROAS 비교 로직이 찾은 TikTok `payment_success`는 0건이다. 이유는 원장이 TikTok Pixel 이벤트를 직접 기록하지 않았고, `payment_success` row 안에서도 TikTok 근거가 남지 않았기 때문이다.
- 로컬에는 `POST /api/attribution/tiktok-pixel-event`와 `tiktok_pixel_events` 개발이 끝나 있다. 하지만 운영 VM에는 아직 이 route가 배포되지 않았다.

v2 배포 후 과거 주문 복원 가능 범위:

- **완전 복원 불가**: v2 배포 전 TikTok Guard v1은 `purchase_intercepted`, `decision_received`, `blocked_pending_purchase`, `released_confirmed_purchase`를 브라우저 콘솔과 사용자 브라우저 `sessionStorage`에만 남겼다. 서버 영구 원장에 append하지 않았기 때문에, 과거 모든 주문의 TikTok Pixel 이벤트 흐름을 event_id/order_code 단위로 나중에 재생성할 수 없다.
- **부분 검산 가능**: 기존 운영 VM Attribution 원장의 `payment_success`, `checkout_started`, GA4 `purchase.transactionId`, TikTok Ads 집계 리포트, 운영 PostgreSQL `tb_iamweb_users`, Toss/Imweb 상태를 대조해 “실제 주문/취소/확정 여부”와 “TikTok 근거가 남아 있는 주문 후보”는 확인할 수 있다.
- **정확히 안 되는 것**: TikTok Ads Manager가 주장한 과거 구매 12건 또는 guard 전 구매 321건이 각각 어떤 `order_code`였는지, 그리고 그때 Guard가 `released`했는지 `blocked`했는지는 기존 자료만으로 확정할 수 없다. TikTok 플랫폼 export/API가 이벤트 단위 `event_id`를 주지 않고, 기존 v1도 서버에 이벤트 로그를 쓰지 않았기 때문이다.
- **v2의 역할**: 과거를 복원하는 도구가 아니라, 배포 이후 발생하는 주문부터 TikTok Pixel 이벤트 흐름을 내부 원장에 남기는 방지책이다.

현재 가장 정확한 표현:

> “기존 헤더/푸터 코드는 있었다. 다만 TikTok CAPI와 TikTok 이벤트 단위 내부 로그는 없었다. 그래서 TikTok이 플랫폼에서 구매를 주장해도, 우리 내부 원장은 기존 `payment_success` 귀속 근거로만 TikTok 여부를 판단했고, Pixel Purchase 자체의 event_id/order_code 로그는 남기지 못했다.”

따라서 다음 병목은 새 코드 배포다. 운영 VM에 `tiktok_pixel_events` 테이블과 endpoint를 배포하고, 아임웹 헤더의 TikTok Guard를 `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`로 교체해야 앞으로의 TikTok 구매 1건마다 `purchase_intercepted → decision_received → released_confirmed_purchase/block_pending` 흐름이 내부 원장에 남는다.

## 2026-04-23 추가 개발 결과

이번 업데이트의 결론은 두 가지다.

1. **캠페인별 TikTok 주장 ROAS는 현재 볼 수 있다.**
   - 위치: 로컬 프론트 `http://localhost:7010/ads/tiktok`의 **캠페인별 TikTok 주장 ROAS** 표.
   - 데이터 위치: 로컬 SQLite `backend/data/crm.sqlite3`의 `tiktok_ads_daily` 또는 `tiktok_ads_campaign_range`.
   - 의미: TikTok Ads/API가 캠페인에 귀속한 구매값 / 광고비다. 내부 확정매출 ROAS가 아니다.
   - 구현: 기간 합계 export가 없으면 일자별 campaign 테이블을 캠페인 단위로 합산하도록 `backend/src/tiktokRoasComparison.ts`를 보강했다.

2. **정확한 주문 단위 매칭은 앞으로의 이벤트 로그부터 가능하게 개발했다.**
   - 새 수신 endpoint: `POST /api/attribution/tiktok-pixel-event`.
   - 새 테이블: `tiktok_pixel_events`.
   - 데이터 위치: 배포 환경의 `CRM_LOCAL_DB_PATH#tiktok_pixel_events`. 운영 배포 시에는 **운영 VM SQLite** `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3#tiktok_pixel_events`가 된다. 로컬 개발 중에는 **내 맥북 로컬** `backend/data/crm.sqlite3#tiktok_pixel_events`다.
   - Guard 후보 코드: `tiktok/tiktok_purchase_guard_enforce_v1.js` 버전 `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`.
   - 수집 내용: `purchase_intercepted`, `decision_received`, `released_confirmed_purchase`, `blocked_pending_purchase`, `sent_replacement_place_an_order`, event_id, order_code, order_no, payment_code, decision status/branch/reason, ttclid, UTM, URL.
   - 한계: TikTok Business API의 캠페인 리포트는 집계 데이터라서 과거 12건 구매를 event_id/order_code 단위로 역분해하지 못한다. 이번 개발은 **앞으로 발생하는 이벤트**를 내부 원장에 남기는 보강이다.

### 현재 캠페인별 TikTok 주장 ROAS

기준: `2026-04-18 ~ 2026-04-22`, TikTok Business API/processed daily campaign 데이터. 이 표는 플랫폼 주장값이며, 같은 기간 운영 VM TikTok `payment_success` confirmed는 0건이다.

| 캠페인 | 광고비 | TikTok 구매수 | TikTok 구매값 | TikTok 주장 ROAS |
|---|---:|---:|---:|---:|
| 음과검 스마트+ 캠페인 | 2,398,503원 | 1 | 471,200원 | 0.20 |
| 종합대사기능 분석 스마트+캠페인 | 1,429,055원 | 5 | 921,952원 | 0.65 |
| 건강기능식품 스마트+캠페인 | 511,939원 | 4 | 1,173,580원 | 2.29 |
| 영양중금속분석 스마트+ 캠페인 | 500,217원 | 2 | 889,500원 | 1.78 |
| 호르몬 검사 캠페인 | 0원 | 0 | 0원 | - |

참고 14일 조회(`2026-04-09 ~ 2026-04-22`) 기준 플랫폼 주장 ROAS는 영양중금속분석 2.45, 건강기능식품 2.45, 종합대사 0.89, 음과검 0.66이다. 단, 이 역시 TikTok 주장값이다.

### 결제 페이지 17건 해석

2026-04-18 ~ 2026-04-22 운영 VM Attribution 원장 read-only 재점검 결과:

- TikTok `checkout_started`: 17건 / 고유 `order_no` 17개 / 고유 `order_code` 17개 / `ttclid` 17건.
- 같은 17개 `order_no`를 운영 PostgreSQL `public.tb_iamweb_users`에서 조회했을 때 매칭 0건.
- 같은 기간 운영 PostgreSQL 자체에는 주문 327건이 있었다. 즉 아임웹 주문 DB 전체 sync가 끊긴 것은 아니다.
- 해석: 이 17건은 “가상계좌 미입금 후 자동취소된 주문 17건”으로 보기 어렵다. 결제 페이지까지 도달했지만 최종 주문 DB에 남는 주문으로 성립하지 않았거나, 아임웹의 임시 order_no가 최종 주문번호와 달라졌을 가능성이 더 크다.
- 남은 가능성: 현재 Attribution 원장은 checkout 단계와 TikTok 플랫폼 구매 이벤트 사이의 event_id/order_code 단위 연결고리가 없다. 그래서 기존 데이터만으로는 TikTok 구매 12건이 이 17건 중 무엇인지 확정할 수 없다.

이번 v2 이벤트 로그의 목적이 바로 이 빈칸을 막는 것이다. 앞으로는 TikTok Purchase Guard가 본 order_code/order_no/payment_code와 서버 decision을 `tiktok_pixel_events`에 남기므로, “결제페이지 도달 → Purchase 허용/차단 → 실제 주문 DB 상태” 흐름을 주문 단위로 볼 수 있다.

### GA4 추가 교차검증

2026-04-23 13:45 KST에 GA4 바이오컴 property `304759974`, 운영 VM Attribution 원장, 운영 PostgreSQL `public.tb_iamweb_users`를 같이 대조했다. 기준 기간은 `2026-04-18 ~ 2026-04-22`다.

결론:

- **“TikTok Attribution 원장 기준 payment_success 0건”은 맞다.**
- 그러나 **“TikTok 관련 실제 주문이 아예 없다”는 표현은 현재 기준으로는 너무 강하다.**
- GA4의 `sessionSource/sessionMedium/sessionCampaignName`에 `tiktok`이 들어간 `purchase` 중 정상 주문번호 transaction_id는 운영 주문 DB에서 30건 매칭됐다.
- 이 30건의 운영 주문 상태는 `PAYMENT_COMPLETE` 28건 / 9,404,586원, `PAYMENT_OVERDUE` 1건 / 39,000원, `REFUND_COMPLETE` 1건 / 1,367,050원이다.
- 같은 30건 중 운영 VM Attribution 원장 `payment_success`에는 27건이 있었고, 26건 confirmed / 1건 canceled였다. 누락 3건은 NPay 계열로 보이며 기존 NPay return 누락 이슈와 연결된다.

중요한 해석:

1. GA4 세션 소스 기준 TikTok 구매와 TikTok Ads Manager의 구매 12건은 같은 것이 아니다. GA4는 사이트 세션 귀속이고, TikTok Ads Manager는 TikTok 자체 어트리뷰션 윈도우 귀속이다.
2. GA4 TikTok-ish purchase는 TikTok Ads API 구매 12건보다 훨씬 많고 금액도 크다. 따라서 GA4만으로 “TikTok Ads가 만든 구매”라고 단정하면 안 된다.
3. 운영 Attribution 원장에서는 이 GA4 TikTok-ish 주문 상당수가 Meta/Naver/Google/direct 등 다른 landing/UTM으로 남아 있다. 즉 채널 귀속 기준이 서로 다르다.
4. Attribution 원장 TikTok checkout 17건은 GA4 `purchase.transactionId`와도 0건 매칭, 운영 주문 DB와도 0건 매칭이었다. 이 17건은 여전히 “결제 페이지 도달 후 최종 주문으로 성립하지 않은 후보”로 보는 것이 맞다.

따라서 현재 문장 추천:

- 부정확: “TikTok으로 인한 실제 주문은 0건이다.”
- 정확: “내부 Attribution 원장 기준 TikTok payment_success는 0건이다. 다만 GA4 세션 소스 기준 TikTok-ish purchase는 운영 주문 DB에 실제 매칭되는 건이 있으므로, TikTok Ads 구매 12건과 내부 확정주문을 event_id/order_code 단위로 연결하는 v2 이벤트 로그가 필요하다.”

### 이번 개발 검증

- `npm --prefix backend run typecheck` 통과.
- `cd backend && node --import tsx --test tests/attribution.test.ts` 통과, 31개 테스트.
- `npm --prefix backend run build` 통과.
- `npm --prefix frontend run lint -- src/app/ads/tiktok/page.tsx` 통과.
- `node --check tiktok/tiktok_purchase_guard_enforce_v1.js` 통과.
- `buildTikTokRoasComparison('2026-04-18','2026-04-22')` 직접 호출 결과 캠페인별 row 5건과 플랫폼 ROAS가 반환됨을 확인했다.
- 임시 SQLite로 `tiktok_pixel_events` insert/list smoke 확인. `purchase_intercepted` 1건 write/list/summary 정상.
- 로컬 서버 `http://localhost:7020/api/attribution/tiktok-pixel-events?limit=1` 응답 정상. 현재 로컬 이벤트 로그 0건.
- 로컬 서버 `http://localhost:7020/api/ads/tiktok/roas-comparison?start_date=2026-04-18&end_date=2026-04-22` 응답에서 캠페인 row 5건 반환 확인.

운영 반영 전 주의: `tiktok_pixel_events`는 새 DB 테이블이다. 운영 VM 배포와 아임웹 헤더 코드 교체는 DB 스키마/운영 코드 변경이므로 TJ 승인 후 진행한다.

## 원장 위치 기준

앞으로 이 문서에서 “원장” 또는 “DB”를 말할 때는 반드시 아래처럼 위치를 같이 쓴다.

| 이름 | 위치 | 무엇을 담는가 | 이번 프로젝트에서 쓰는 방식 |
|---|---|---|---|
| TikTok ROAS용 Attribution 원장 | **운영 VM** `https://att.ainativeos.net/api/attribution/ledger` | 결제완료 페이지에서 들어온 `payment_success`, 광고 유입값, `ttclid`, 결제 상태, 금액 | `/ads/tiktok`과 `backend/src/tiktokRoasComparison.ts`가 read-only로 조회하는 내부 ROAS 기준 원장 |
| 운영 아임웹 주문 DB `tb_iamweb_users` | **운영 PostgreSQL** `public.tb_iamweb_users` | 아임웹 주문번호, 상품 라인, 결제수단, 주문상태, 취소사유, 금액 | 가상계좌가 24시간 후 `PAYMENT_OVERDUE` 자동취소됐는지 확인하는 정본 |
| 로컬 SQLite `backend/data/crm.sqlite3` | **내 맥북 로컬** | TikTok Ads CSV/API 캐시, 로컬 Imweb/Toss 스냅샷, 개발용 분석 테이블 | Ads CSV/API 적재와 화면 개발용 캐시. 운영 최신 주문 상태 정본으로 쓰지 않음 |
| Toss direct API | **외부 Toss Payments API** | paymentKey/orderId 기준 PG 결제 상태 | 실시간 결제 판정 보조. 가상계좌 만료 후에도 `pending`처럼 보일 수 있어 Imweb overdue 보조 판정이 필요 |

정리하면, **TikTok ROAS용 Attribution 원장은 로컬이 아니라 운영 VM 원장이다.** 로컬 서버는 그 원장을 읽어 화면과 분석을 만드는 클라이언트 역할을 한다. 로컬 SQLite는 TikTok Ads 데이터와 개발용 캐시이며, 이번 49건 pending 이슈의 상태 정본은 아니다.

## 다음 할일

1. **[승인 필요] TikTok 이벤트 단위 로깅을 운영 VM에 배포하고 아임웹 Guard 코드를 v2로 교체한다.**
   - 왜 하는가: TikTok Business API는 캠페인/일자 집계만 제공해서 “TikTok이 말한 구매 12건”을 우리 order_code로 역추적할 수 없다. 앞으로는 Guard가 Purchase를 가로챌 때 내부 `tiktok_pixel_events`에 event_id/order_code/order_no/payment_code/decision을 남겨야 정확히 대조할 수 있다.
   - 어떻게 하는가: 운영 VM 백업 → backend 배포 → `POST /api/attribution/tiktok-pixel-event` smoke test → 아임웹 헤더에서 Guard v2 코드로 교체 → 카드/가상계좌 각 1건으로 `released_confirmed_purchase`, `blocked_pending_purchase`, `sent_replacement_place_an_order`가 쌓이는지 확인한다.
   - 원장/DB 위치: 배포 후 새 이벤트 원장은 **운영 VM SQLite** `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3#tiktok_pixel_events`다. 로컬 개발 중 생성되는 테이블은 판단 정본이 아니다.
   - 진행 상태: 로컬 개발/테스트 완료. 운영 배포와 아임웹 코드 교체는 DB 스키마/운영 코드 변경이므로 TJ 승인 필요.
   - Codex 진행 추천/자신감: **92%**. 코드와 테스트는 통과했다. 운영 리스크는 새 테이블 생성과 헤더 코드 교체이므로 백업/스모크 테스트 조건부로 진행하는 것이 맞다.
   - 관련 위치: [[#2026-04-23 추가 개발 결과]].

2. **[즉시 사용] `/ads/tiktok`에서 캠페인별 TikTok 주장 ROAS를 본다.**
   - 왜 하는가: 캠페인별로 TikTok이 어떤 소재/캠페인을 좋게 보고 있는지는 현재도 확인 가능하다. 다만 이 값은 내부 확정매출 ROAS가 아니라 TikTok 플랫폼 주장 ROAS다.
   - 어떻게 하는가: `http://localhost:7010/ads/tiktok`에서 기간을 `2026-04-18 ~ 2026-04-22` 또는 최근 14일로 두고 **캠페인별 TikTok 주장 ROAS** 표를 본다. 기간 합계 export가 없어도 백엔드가 `tiktok_ads_daily`를 캠페인 단위로 합산한다.
   - 원장/DB 위치: 광고 데이터는 **로컬 SQLite** `backend/data/crm.sqlite3#tiktok_ads_daily`와 `#tiktok_ads_campaign_range` 캐시다. 내부 확정매출 비교는 **운영 VM Attribution 원장**을 read-only로 조회한다.
   - 진행 상태: 구현 완료. `2026-04-18 ~ 2026-04-22` 기준 캠페인별 row 5건 반환 확인.
   - Codex 진행 추천/자신감: **96%**. 캠페인별 플랫폼 주장값 확인에는 충분하다. 예산 증액 판단에는 내부 확정 주문 매칭이 아직 부족하다.
   - 관련 위치: [[#현재 캠페인별 TikTok 주장 ROAS]].

3. **[반복 필요] Guard 이후 기간을 7일·14일 단위로 다시 수집한다.**
   - 왜 하는가: guard 전 오염은 정리됐다. 이제 중요한 질문은 “2026-04-17 이후 TikTok Purchase가 실제 결제 확정과 맞는가”다.
   - 어떻게 하는가: TikTok Business API를 재수집하고, 운영 VM Attribution 원장 confirmed/pending/canceled와 조인한다. v2 이벤트 로그가 운영에 들어간 뒤부터는 `tiktok_pixel_events`까지 같이 조인한다.
   - 원장/DB 위치: TikTok Business API는 외부 광고 데이터, 운영 VM Attribution 원장은 내부 결제 이벤트 데이터, 운영 PostgreSQL은 주문 상태 검산 데이터다. 로컬 SQLite는 API/CSV 캐시다.
   - 진행 상태: 1차로 `2026-04-18 ~ 2026-04-22` 수집 완료. API 24행, 광고비 4,839,714원, TikTok 구매 12건, 구매값 3,456,232원, 플랫폼 ROAS 0.71414다. 같은 기간 운영 VM TikTok payment_success는 0건이다.
   - Codex 진행 추천/자신감: **88%**. 수집 파이프라인은 작동한다. 표본 기간이 짧아서 최소 2026-04-24 이후와 2026-05-01 이후 재조회가 필요하다.
   - 관련 위치: [[#Phase3-Sprint4]].

4. **[판단 대기] TikTok 예산 판단은 post-guard 데이터와 v2 이벤트 로그를 한 번 더 본 뒤 고정한다.**
   - 왜 하는가: guard 전 플랫폼 ROAS 32.11은 내부 confirmed 기준 0.00으로 과대였다. Guard 이후에도 플랫폼 구매와 내부 원장이 0으로 갈라지는지, 아니면 단순 로그 누락인지 분리해야 한다.
   - 어떻게 하는가: guard 전 기간은 “오염 확정”으로 닫고, guard 후 기간은 platform purchase value, internal confirmed, internal canceled, `tiktok_pixel_events` decision 결과를 비교한다. 이 값이 계속 벌어지면 예산 증액 보류 또는 축소 근거가 된다.
   - 원장/DB 위치: 예산 판단의 내부 기준은 운영 VM Attribution 원장과 운영 PostgreSQL이다. TikTok Ads API는 광고 플랫폼 주장값으로만 쓴다.
   - 진행 상태: guard 전 pending write는 완료됐다. post-guard 5일치 기준 플랫폼은 구매 12건을 주장하지만 내부 TikTok payment_success는 0건이다.
   - Codex 진행 추천/자신감: **84%**. guard 전 판단 자료는 충분하다. guard 후 판단은 자료가 5일치뿐이고 event-level 로그가 아직 운영 배포 전이라 한 번 더 봐야 한다.
   - 관련 위치: [[#Phase2-Sprint3]]와 [[#Phase3-Sprint4]].

## 이번 1~4 운영 진행 결과

2026-04-23 12:26 KST 기준 Codex가 조건부 승인 범위 안에서 처리한 결과다. **운영 VM Attribution 원장 write를 완료했다.**

1. 운영 pending write:
   - TJ 승인 범위: 운영 VM 배포 → dry-run 결과 확인 → 백업/롤백 확인 → 실제 write.
   - write 전 운영 ROAS API 기준 남은 TikTok pending은 49건이 아니라 48건이었다. 1건은 이미 별도 sync로 `canceled`가 된 것으로 보인다.
   - 넓은 전체 write dry-run은 `updatedRows=133`까지 잡혔다. 승인 범위를 넘으므로 중단하고 `orderIds` 제한 필터를 추가했다.
   - 제한 dry-run: `totalCandidates=48`, `matchedRows=48`, `updatedRows=48`, `writtenRows=0`, `imwebOverdueRows=48`, skipped 0.
   - 실제 write: `totalCandidates=48`, `matchedRows=48`, `updatedRows=48`, `writtenRows=48`, skipped 0.
   - post-write 확인: 같은 48개 orderId dry-run 재실행 시 `totalCandidates=0`. 운영 DB 직접 조회도 48/48 `canceled`, 남은 pending 0.

2. 백업과 롤백:
   - write 직전 DB 백업: `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_48_write_20260423_032231.bak`.
   - 배포 전 DB 백업: `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_overdue_sync_20260423_030921.bak`.
   - 배포 전 dist 백업: `/home/biocomkr_sns/seo/shared/deploy-backups/20260423_030921/backend-dist.prev.tgz`.
   - 운영 health: `https://att.ainativeos.net/health` = `ok`, background jobs enabled.

3. Imweb overdue sync:
   - 구현 파일: `backend/src/routes/attribution.ts`, `backend/tests/attribution.test.ts`.
   - 운영 배포 완료. `orderIds` 필터를 추가해 승인받은 48건만 write할 수 있게 했다.
   - 상태 선택 우선순위도 수정했다. Toss direct가 `pending`이어도 Imweb `PAYMENT_OVERDUE`가 있으면 `canceled/vbank_expired`가 이긴다.
   - 검증: backend typecheck 통과, attribution test 29개 통과, backend build 통과.

4. post-guard API 수집:
   - 원천: TikTok Business API `report/integrated/get`.
   - 저장 위치: 로컬 `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260418_20260422.json`, `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260418_20260422.csv`, `data/ads_csv/tiktok/processed/20260418_20260422_daily_campaign.csv`.
   - 수집 결과: 24행, 광고비 4,839,714원, 구매 12건, 구매값 3,456,232원, 플랫폼 ROAS 0.71414.
   - 내부 조인 결과: 같은 기간 운영 VM TikTok payment_success는 0건이다. 이는 “확정매출 0” 판단의 1차 근거지만, post-guard 기간이 짧아 며칠 더 누적 관찰이 필요하다.

## 10초 요약

- 이 로드맵의 목표는 TikTok이 보고한 구매값이 실제 확정매출인지 검증하고, 앞으로의 TikTok 예산 판단을 숫자로 할 수 있게 만드는 것이다.
- 결론은 명확하다. 2026-03-19 ~ 2026-04-17 TikTok 플랫폼 ROAS는 32.11이지만, 내부 confirmed 기준 ROAS는 0.00이다.
- API와 데이터 확보는 거의 끝났다. pending 상위 20건은 Codex가 운영 VM `payment-decision` endpoint로 read-only 직접 확인했고, 20건 모두 Toss 기준 `pending`이었다.
- 바이오컴 가상계좌 주문은 주문 후 24시간 이내 미입금이면 취소되는 것으로 확인됐다. 따라서 24시간을 넘긴 `WAITING_FOR_DEPOSIT` 주문은 후속 입금 가능성이 아니라 `vbank_expired` 후보로 봐야 한다.
- 2026-04-22 14:16 KST 재확인 결과, TikTok pending 49건은 전부 24시간 초과이며 운영 `tb_iamweb_users` 기준 49건 모두 `VIRTUAL / PAYMENT_OVERDUE / 입금기간 마감으로 인한 자동 취소`였다.
- 중요한 맥락은 “자동취소를 못 받은 것”이라기보다 “아임웹 주문 DB에는 자동취소가 있는데, 당시 TikTok ROAS용 Attribution 원장에는 그 상태를 반영하는 sync가 없었다”는 점이다.
- 2026-04-23 12:24 KST 기준 남아 있던 48건을 운영 VM Attribution 원장에 `canceled/vbank_expired`로 반영했다. 이후 guard 전 기간 TikTok pending은 0건이다.
- 2026-04-18 ~ 2026-04-22 post-guard API 1차 수집 결과, TikTok은 구매 12건 / 구매값 3,456,232원을 보고하지만 운영 VM TikTok payment_success는 0건이다. Guard 이후에도 플랫폼 숫자와 내부 원장 차이를 계속 봐야 한다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | API 데이터 확보와 자동 수집 | Codex | 95% / 80% | [[#Phase0-Sprint1]] |
| Phase1 | [[#Phase1-Sprint2]] | TikTok 구매 이벤트 오염 제거 | TJ + Codex + Claude Code | 100% / 100% | [[#Phase1-Sprint2]] |
| Phase2 | [[#Phase2-Sprint3]] | 플랫폼 ROAS vs 내부 ROAS gap 확정 | TJ + Codex | 96% / 93% | [[#Phase2-Sprint3]] |
| Phase3 | [[#Phase3-Sprint4]] | Post-Guard 기간 재검증 | Codex + TJ | 65% / 40% | [[#Phase3-Sprint4]] |
| Phase4 | [[#Phase4-Sprint5]] | Source Precision 정리 | Codex + TJ | 82% / 65% | [[#Phase4-Sprint5]] |
| Phase5 | [[#Phase5-Sprint6]] | TikTok Events API 도입 여부 결정 | TJ + Codex + Claude Code | 20% / 0% | [[#Phase5-Sprint6]] |

## 고등학생 비유

이 프로젝트는 광고 회사가 보낸 성적표와 실제 통장 입금 내역을 맞춰보는 일이다. TikTok은 "9.1억 팔았다"고 말하지만, 우리 통장 기준으로 확정 입금된 TikTok 매출은 아직 0원이다.

## 문서 목적

이 문서는 TikTok ROAS 숫자가 왜 크게 달랐고, 어디까지 고쳤으며, 다음에 누가 무엇을 해야 하는지 대표와 개발팀이 같은 언어로 이해하도록 정리한다.

## 지표 체계

- 회사 북극성: 바이오컴 실제 확정매출. Toss `DONE` 상태만 확정 매출로 본다.
- 팀 핵심 지표: 채널별 확정매출 기반 ROAS.
- TikTok 플랫폼 ROAS: TikTok Ads Manager가 보고한 구매값 / TikTok 광고비.
- 내부 confirmed ROAS: 내부 Attribution 원장과 결제 상태가 confirmed인 매출 / TikTok 광고비.
- 내부 potential ROAS: 내부 confirmed + pending 매출 / TikTok 광고비.
- ROAS gap: TikTok 플랫폼 구매값 - 내부 confirmed 매출. 보조로 pending 포함 gap도 본다.

## 핵심 숫자

| 기준 | 매출 | 광고비 | ROAS |
|---|---:|---:|---:|
| TikTok 플랫폼 주장 | 910,630,888원 | 28,363,230원 | 32.11 |
| 내부 confirmed 기준 | 0원 | 28,363,230원 | 0.00 |
| 내부 confirmed + pending 현재 기준 | 0원 | 28,363,230원 | 0.00 |
| 내부 canceled 판정 주문 | 552,263,900원 | 28,363,230원 | 매출 제외 |

사실:
- 2026-03-19 ~ 2026-04-17 Business API dry-run은 147행을 반환했다.
- 같은 기간 API 비용 28,363,230원, 구매수 321건은 기존 CSV와 일치한다.
- 구매값은 `complete_payment * value_per_complete_payment`로 910,630,888원까지 복원된다. 기존 CSV 구매값 910,630,953원과 65원 차이다.
- 운영 VM 원장 기준 TikTok payment_success는 50행이다. 2026-04-23 write 이후 confirmed 0건 / 0원, pending 0건 / 0원, canceled 50건 / 552,263,900원이다.
- pending 상위 20건은 합계 536,729,000원으로 과거 pending 금액의 약 97.4%였다. 2026-04-22 12:53 KST read-only 확인 결과 20건 모두 Toss 직접 API 기준 `pending`이었다.
- 바이오컴 가상계좌 입금기한은 24시간으로 확인됐다. `payment_time/order_time + 24시간`이 지난 미입금 주문은 ROAS상 확정매출이 아니라 `vbank_expired` 후보로 분리한다.
- 2026-04-22 14:16 KST 기준 TikTok pending 49건 중 24시간 미만은 0건이었다. 49건 전부 48시간도 넘겼고, 운영 DB에서는 전부 `PAYMENT_OVERDUE` 자동취소 상태였다.
- 2026-04-23 12:24 KST 기준 남아 있던 48건은 운영 VM Attribution 원장에 `canceled/vbank_expired`로 write 완료했다. write 후 guard 전 기간 TikTok pending은 0건이다.

현재 판단:
- TikTok 데이터 수집 자체는 믿을 수 있다.
- 문제는 TikTok이 구매로 본 신호가 실제 확정매출인지다.
- pending 상위 20건과 남아 있던 전체 48건은 현재 확정매출이 아니다. 24시간 입금기한을 넘긴 건은 `vbank_expired`로 원장에 반영했다. 남은 일은 guard 이후 데이터가 같은 방식으로 깨끗해지는지 재검증하는 것이다.

## 핵심 원칙

1. 주문 생성은 구매가 아니다. Toss `DONE`만 확정매출이다.
2. 가상계좌 미입금은 TikTok `Purchase`가 아니라 `PlaceAnOrder`로 낮춘다.
3. 바이오컴 가상계좌는 주문 후 24시간 이내 미입금이면 취소된다. 24시간 경과 미입금은 매출 후보가 아니라 `vbank_expired` 후보로 본다.
4. API는 자동화 수단이다. 숫자 판단 기준을 대신하지 않는다.
5. Events API는 웹 이벤트가 부족하다는 것이 숫자로 확인될 때만 검토한다.
6. pending fate와 source precision을 닫기 전에는 TikTok 플랫폼 ROAS를 예산 증액 근거로 쓰지 않는다.

## Phase별 계획

### Phase 0

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 데이터 확보와 API 자동화

- 목표: TikTok Ads Manager 숫자를 수동 CSV가 아니라 Business API로 반복 조회한다.
- 왜 지금 해야 하는가: 수동 CSV는 사람이 매번 내려받아야 한다. API가 열렸으므로 같은 기준의 일자별 데이터를 반복해서 받을 수 있다.
- 산출물: Business API access token, advertiser ID, API JSON/CSV 저장 스크립트, `tiktok_ads_daily` 적재용 CSV.
- 완료 기준: API 결과가 기존 CSV와 비용, 구매수, 구매값 기준으로 맞고, 로컬 SQLite `tiktok_ads_daily`에 안전하게 들어간다.
- 다음 Phase에 주는 가치: 플랫폼 숫자 수집 문제를 닫고, 실제 gap 원인 분해에 집중할 수 있다.

#### Phase0-Sprint1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: API 데이터 확보와 자동 수집
**상태**: 우리 기준 95% / 운영 기준 80%

**무엇을 하는가**

TikTok Business API에서 캠페인별 일자 데이터를 가져와 JSON/CSV로 저장한다. 같은 데이터를 기존 `tiktok_ads_daily` 적재 경로가 읽을 수 있는 형태로도 만든다.

**왜 필요한가**

CSV를 수동으로 받으면 날짜 범위와 컬럼이 바뀔 수 있다. API로 고정하면 post-guard 기간과 과거 기간을 같은 규칙으로 비교할 수 있다.

**산출물**

- API 저장 스크립트: `backend/scripts/tiktok-business-report-dry-run.ts`
- API 원본 산출물: `data/ads_csv/tiktok/api/`
- processed CSV: `data/ads_csv/tiktok/processed/20260418_20260421_daily_campaign.csv`
- 로컬 적재 결과: `tiktok_ads_daily` 적재 경로 준비, 2026-04-18 ~ 2026-04-22 processed CSV 생성

**우리 프로젝트에 주는 도움**

이제 TikTok Ads 숫자를 사람이 내려받지 않아도 된다. 다음에는 "데이터가 있느냐"가 아니라 "그 데이터가 실제 매출과 맞느냐"를 볼 수 있다.

##### 역할 구분

- TJ: 운영 DB write나 운영 배포 승인. TikTok Ads Manager 화면의 attribution window 설정 확인.
- Codex: Business API 조회, JSON/CSV 저장, 로컬 SQLite upsert, API 대조 리포트.
- Claude Code: `/ads/tiktok` 화면에서 API source 표시와 문구 정리.

##### 실행 단계

1. [Codex] Business API token 교환과 advertiser list 조회 — `(주)바이오컴_adv` / `7593201373714595856` 확인. 완료.
2. [Codex] 2026-03-19 ~ 2026-04-17 API dry-run — 147행, 비용 28,363,230원, 구매수 321건, 구매값 910,630,888원 확인. 완료.
3. [Codex] API 결과 저장 스크립트 작성 — JSON/CSV 저장과 `--write-processed-daily` 옵션 추가. 완료.
4. [Codex] 2026-04-18 ~ 2026-04-22 post-guard API 수집 — 24행, 비용 4,839,714원, 구매수 12건, 구매값 3,456,232원 확인. 완료.
5. [Codex] processed CSV 생성과 로컬 적재 경로 검증 — `data/ads_csv/tiktok/processed/20260418_20260422_daily_campaign.csv` 생성. 완료.
6. [Codex] API JSON/CSV와 기존 Ads Manager CSV 합계 자동 비교 리포트 추가. 의존성: 병렬가능. 기존 API 산출물과 CSV 파일만 있으면 진행 가능.
7. [TJ] 운영 반영 승인 — 이유: 운영 DB write와 화면 운영 반영은 사업/운영 승인 필요.

### Phase 1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 구매 이벤트 오염 제거

- 목표: 가상계좌 미입금이 TikTok `Purchase`로 들어가지 않게 한다.
- 왜 지금 해야 하는가: 구매 이벤트가 오염되면 TikTok이 잘못된 신호로 최적화한다.
- 산출물: TikTok Purchase Guard, 결제 판정 API, 운영 검증 로그.
- 완료 기준: 카드 결제는 `Purchase`, 가상계좌 미입금은 `PlaceAnOrder`로 분기된다.
- 다음 Phase에 주는 가치: guard 이후 데이터는 과거보다 깨끗한 기준선이 된다.

#### Phase1-Sprint2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok 구매 이벤트 오염 제거
**상태**: 우리 기준 100% / 운영 기준 100%

**무엇을 하는가**

아임웹 결제완료 페이지에서 TikTok `Purchase`를 무조건 보내던 구조를 결제 상태별로 나눴다. 카드 결제 확정은 `Purchase`를 유지하고, 가상계좌 미입금은 `Purchase`를 차단한 뒤 `PlaceAnOrder`로 보낸다.

**왜 필요한가**

입금 전 가상계좌 주문을 구매로 세면 TikTok 플랫폼 ROAS가 실제보다 커진다. 예산 판단과 자동 입찰이 허수 숫자를 보고 움직인다.

**산출물**

- TikTok Browser Purchase Guard: `tiktok/tiktok_purchase_guard_enforce_v1.js`
- 결제 판정 API: `/api/attribution/payment-decision`
- 운영 검증: 가상계좌 1건 `PlaceAnOrder`, 카드 1건 `Purchase`

**우리 프로젝트에 주는 도움**

2026-04-17 이후 TikTok 구매 이벤트는 입금 상태를 반영한다. 과거 오염 규모는 post-guard 데이터와 비교해 역산할 수 있다.

##### 역할 구분

- TJ: 운영 헤더 적용, 실결제 테스트, Pixel Helper 확인.
- Codex: 결제 판정 API와 fail-open 안전장치 설계.
- Claude Code: Guard 스크립트와 아임웹 삽입 코드 정리.

### Phase 2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS와 내부 ROAS gap 확정

- 목표: TikTok ROAS 32.11이 실제로 얼마나 과대인지 숫자로 확정한다.
- 왜 지금 해야 하는가: API와 CSV가 맞았으므로 이제 비즈니스 판단을 내려야 한다.
- 산출물: confirmed 기준 gap, pending 포함 gap, pending top 20 audit, gap waterfall.
- 완료 기준: pending 49건의 fate를 분류하고, 플랫폼 구매값 910.6M이 내부 매출로 얼마나 설명되는지 말할 수 있다.
- 다음 Phase에 주는 가치: post-guard 개선 효과와 Events API 필요 여부를 판단할 수 있다.

#### Phase2-Sprint3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS vs 내부 ROAS gap 확정
**상태**: 우리 기준 96% / 운영 기준 93%

**무엇을 하는가**

TikTok 플랫폼 구매값과 내부 확정매출을 같은 기간으로 맞춘다. pending을 모두 인정한 최대 잠재 ROAS와 confirmed만 인정한 보수 ROAS를 분리한다.

**왜 필요한가**

현재 TikTok은 9.1억 구매값을 보고하지만 내부 confirmed는 0원이다. 이 차이가 가상계좌 미입금 때문인지, source 오귀속 때문인지, 실제 입금 지연 때문인지 나눠야 한다.

**산출물**

- `/ads/tiktok` ROAS 비교 화면
- `daily_comparison` 30행
- pending 상위 20건 audit
- ROAS Gap Waterfall 초안

**우리 프로젝트에 주는 도움**

TikTok 예산을 증액, 유지, 축소할지 감이 아니라 숫자로 판단할 수 있다.

##### 역할 구분

- TJ: pending 주문 확인 결과를 운영 판단에 반영. 필요 시 아임웹/Toss 관리자 화면 스크린샷 확보.
- Codex: 운영 VM 원장 read-only 조회, Toss direct read-only 확인, gap 계산, waterfall 화면, pending fate 데이터 구조.
- Claude Code: 대표 보고용 문구와 waterfall UX 정리.

##### 실행 단계

1. [Codex] 운영 VM 원장 read-only 조회 — 2026-03-19 ~ 2026-04-17 TikTok payment_success 50행 확인. 완료.
2. [Codex] confirmed/pending/canceled 집계 — write 전 confirmed 0원, pending 551,095,900원, canceled 750,000원 확인. write 후 confirmed 0원, pending 0원, canceled 552,263,900원 확인. 완료.
3. [Codex] `/ads/tiktok`에 ROAS Gap Waterfall 초안 추가 — 플랫폼 구매값, confirmed, pending, 설명 안 된 gap, high/low source 값 표시. 완료.
4. [Codex] pending audit row에 `fate` 필드 추가 — 기본값은 `still_pending`, 수동 확인 후 확정값으로 바꿀 수 있게 준비. 완료.
5. [Codex] pending 상위 20건 직접 확인 가능성 분석 — 상위 20건 모두 `orderId`와 `paymentKey` 보유. 운영 VM `payment-decision` endpoint가 Toss direct read-only 조회 가능. 완료.
6. [Codex] pending 상위 20건 Toss direct read-only 확인 — 20건 / 536,729,000원 모두 `pending`, `matchedBy=toss_direct_payment_key`, `browserAction=block_purchase_virtual_account`. 완료.
7. [TJ] 운영 원장 write 반영 승인 여부 결정 — 2026-04-23 조건부 승인 완료. 범위는 운영 배포, dry-run 확인, 백업/롤백 확인, 실제 write다.
8. [Codex] 승인 범위 안에서 현재 남아 있던 48건을 `vbank_expired/canceled`로 write — dry-run 48/48 확인 후 실제 write 48건 완료. 2026-04-22에는 49건이었지만 write 직전 1건은 이미 `canceled`가 되어 남은 후보가 48건이었다.
9. [Codex + Claude Code] gap waterfall을 대표 보고용 수치로 고정. 의존성: 부분병렬. guard 전 수치는 고정 가능하고, guard 후 수치는 7일/14일 재수집 후 확정한다.

### Phase 3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Post-Guard 기간 재검증

- 목표: 2026-04-17 guard 이후 TikTok 플랫폼 구매값이 실제로 깨끗해졌는지 확인한다.
- 왜 지금 해야 하는가: 과거 대부분은 guard 이전이다. 우리가 고친 효과는 guard 이후를 따로 봐야 한다.
- 산출물: guard 전후 일자별 비교, post-guard ROAS, pending 비율 변화.
- 완료 기준: guard 이후 플랫폼 구매값, internal confirmed/pending, `PlaceAnOrder` 증가 여부를 같은 기간으로 설명한다.
- 다음 Phase에 주는 가치: Events API가 필요한지, 웹 이벤트만으로 충분한지 판단한다.

#### Phase3-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Post-Guard 기간 재검증
**상태**: 우리 기준 55% / 운영 기준 35%

**무엇을 하는가**

2026-04-18 이후 TikTok API와 운영 VM 원장을 같은 날짜로 맞춘다. guard 전과 guard 후를 분리해 platform ROAS와 internal ROAS의 gap이 줄었는지 본다.

**왜 필요한가**

guard가 잘 동작해도 TikTok 플랫폼 숫자가 실제로 정상화됐는지 확인해야 한다. 실제 운영 효과는 post-guard 기간에서만 판단할 수 있다.

**산출물**

- API 산출물: `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260418_20260421.{json,csv}`
- processed CSV: `data/ads_csv/tiktok/processed/20260418_20260421_daily_campaign.csv`
- `daily_comparison` post-guard 4일 결과

**우리 프로젝트에 주는 도움**

guard 적용이 실제로 TikTok 플랫폼 구매값을 낮추고 pending 오염을 줄였는지 알 수 있다.

##### 역할 구분

- TJ: 2026-04-18 이후 TikTok Events Manager에서 Purchase/PlaceAnOrder 추세 확인. 로그인 필요.
- Codex: API 수집, 로컬 적재, 운영 VM read-only 조인, 일자별 gap 계산.
- Claude Code: guard 전후 화면 비교 UX와 설명 문구 정리.

##### 실행 단계

1. [Codex] 2026-04-18 ~ 2026-04-22 API 수집 — 24행, 비용 4,839,714원, 구매수 12건, 구매값 3,456,232원 확인. 완료.
2. [Codex] processed CSV 생성 후 로컬 적재 경로 검증 — `20260418_20260422_daily_campaign.csv` 생성. 완료.
3. [Codex] 운영 VM read-only 조인 — post-guard 5일 기준 confirmed 0원, pending 0원, platform purchase value 3,456,232원 확인. 완료.
4. [Codex] 2026-04-18 ~ 2026-04-24 API 수집. 의존성: 선행필수. 2026-04-24가 지나야 정확한 기간 조회 가능.
5. [Codex] 2026-04-18 ~ 2026-05-01 API 수집. 의존성: 선행필수. 2026-05-01이 지나야 정확한 기간 조회 가능.
6. [TJ] Events Manager에서 post-guard Purchase 감소와 PlaceAnOrder 증가 확인 — 이유: 로그인 필요한 외부 dashboard 확인.
7. [Codex + Claude Code] guard 전후 비교 카드를 `/ads/tiktok`에 고정. 의존성: 부분병렬. 현재 4일 데이터로 초안 가능, 최종 판단은 4번/5번 기간이 필요하다.

### Phase 4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Source Precision 정리

- 목표: TikTok 귀속 주문이 진짜 TikTok에서 온 것인지 근거 강도별로 나눈다.
- 왜 지금 해야 하는가: TikTok을 무조건 나쁘게 보거나 무조건 믿는 것은 둘 다 위험하다.
- 산출물: high/medium/low source tier, high-confidence ROAS, broad ROAS, low 제외 후보.
- 완료 기준: official 기준과 broad 기준을 나눠 예산 판단에 쓸 수 있다.
- 다음 Phase에 주는 가치: Events API나 예산 판단이 source 오귀속에 흔들리지 않는다.

#### Phase4-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Source Precision 정리
**상태**: 우리 기준 75% / 운영 기준 60%

**무엇을 하는가**

TikTok 귀속 근거를 high, medium, low로 나눈다. `ttclid` 직접 근거는 high, UTM 근거는 medium, referrer/metadata만 있는 넓은 기준은 low로 본다.

**왜 필요한가**

같은 TikTok 후보라도 신뢰도가 다르다. high 근거와 low 근거를 섞으면 "TikTok이 전혀 안 된다"와 "귀속 기준이 넓다"를 구분할 수 없다.

**산출물**

- source reason summary
- source precision summary
- `/ads/tiktok` ROAS Gap Waterfall의 high/low 금액
- pending 상위 20건 source tier 표시

**우리 프로젝트에 주는 도움**

예산 판단을 broad 기준과 conservative 기준으로 나눌 수 있다. 진짜 TikTok 클릭 근거가 있는 주문만 따로 볼 수 있다.

##### 역할 구분

- TJ: high pending 주문 중 실제 입금/미입금 상태 확인.
- Codex: source tier 집계, waterfall 수치, pending audit 구조.
- Claude Code: source tier 설명 문구와 표 가독성 개선.

##### 실행 단계

1. [Codex] source reason 코드화 — `ttclid_direct`, `ttclid_url`, `utm_source_tiktok`, `metadata_url_tiktok` 등. 완료.
2. [Codex] source precision summary 추가 — high 49건 / 552,242,000원, medium 0건 / 0원, low 1건 / 21,900원 확인. 완료.
3. [Codex] `/ads/tiktok`에 high/low 금액을 waterfall로 표시. 완료.
4. [TJ] high pending 상위 주문 실제 상태 확인 — 이유: 운영 주문 화면과 결제 관리자 확인 필요.
5. [Codex] high-confidence ROAS와 broad ROAS를 별도 지표로 고정. 의존성: 부분병렬. source tier는 준비됐고 fate 확인 결과가 있으면 official 기준을 닫을 수 있다.
6. [Claude Code] low source 제외 후보 UI 정리. 의존성: 병렬가능. 현재 API 응답만으로 초안 가능.

### Phase 5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok Events API 도입 여부 결정

- 목표: 서버에서 TikTok Events API를 보낼지 말지 결정한다.
- 왜 지금 해야 하는가: 지금 바로 붙이면 중복 Purchase와 dedup 실패가 생길 수 있다. 판단은 Phase 2~4가 닫힌 뒤 해야 한다.
- 산출물: Events API 도입 조건표, event_id dedup 규칙, 보류/진행 결정.
- 완료 기준: 웹 이벤트만으로 부족한지 숫자로 확인하고, 서버 이벤트 중복 위험을 제거한다.
- 다음 Phase에 주는 가치: 서버 이벤트를 붙이더라도 오염을 다시 만들지 않는다.

#### Phase5-Sprint6

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok Events API 도입 여부 결정
**상태**: 우리 기준 20% / 운영 기준 0%

**무엇을 하는가**

TikTok Events API를 붙일 조건을 숫자로 판단한다. 가상계좌 후속 입금 시 서버 `Purchase`가 필요한지, 웹 `Purchase`와 같은 `event_id`로 중복 제거가 가능한지 본다.

**왜 필요한가**

Events API를 성급하게 붙이면 같은 주문을 두 번 구매로 세는 사고가 난다. 지금은 오염 제거와 gap 분해가 먼저다.

**산출물**

- Events API 도입 조건 3개
- 서버/웹 `event_id` dedup 규칙
- 진행 또는 보류 결정 기록

**우리 프로젝트에 주는 도움**

서버 이벤트를 붙여야 할 때도 안전하게 붙일 수 있다. 반대로 필요 없으면 개발 범위를 줄일 수 있다.

##### 역할 구분

- TJ: Events API 토큰 발급 승인과 최종 도입 판단.
- Codex: 서버 이벤트 계약, dedup 로직, 회귀 테스트.
- Claude Code: 웹/서버 이벤트 상태 화면과 운영 문구.

##### 실행 단계

1. [Codex] Phase 2~4 결과 확인 — confirmed 손실, pending fate, source precision을 숫자로 닫는다. 의존성: 선행필수. Events API 판단의 전제다.
2. [Codex] 서버 Purchase가 필요한 주문 유형 정의 — 예: 가상계좌 후속 입금. 의존성: 부분병렬. 초안은 가능하지만 fate 결과가 필요하다.
3. [Codex + Claude Code] 웹/서버 `event_id` dedup 규칙 설계 — `Purchase_{order_code}` 계열과 현재 관측값 비교. 의존성: 병렬가능.
4. [TJ] Events API 토큰 발급 승인 — 이유: 신규 외부 credential 발급과 운영 리스크 승인 필요.
5. [Codex] 서버 Events API 구현은 4번 승인 후 진행. 의존성: 선행필수.

## 승인 필요 항목

- [x] 운영 헤더 TikTok Guard enforce 적용.
- [x] TikTok Business API read-only access token 로컬 저장.
- [x] 로컬 SQLite `tiktok_ads_daily` 기존 스키마에 API 산출물 upsert.
- [x] pending 상위 20건 Toss direct read-only 현재 상태 확인.
- [x] pending 상위 20건 운영 원장 write 반영 승인.
- [x] pending 49건 전체 fate 확장 확인 및 현재 남은 48건 운영 write.
- [ ] 2026-04-24 이후 post-guard 1차 확장 조회.
- [ ] `/ads/tiktok` 변경 운영 반영 승인.
- [ ] TikTok Events API 토큰 발급. Phase 5 진입 시점에만 판단한다.

## Pending 상위 20건 확인 가능성 분석

결론: Codex가 확인할 수 있다. 2026-04-22에는 read-only 확인까지 했고, 2026-04-23 TJ 조건부 승인 후 현재 남아 있던 48건은 운영 원장에 write까지 완료했다.

2026-04-22 12:53 KST에 운영 VM Attribution 원장과 운영 VM `payment-decision` endpoint를 사용해 pending 상위 20건을 직접 확인했다. 상위 20건은 모두 `orderId`와 `paymentKey`가 있었고, Toss direct read-only 조회에서 20건 모두 `pending`으로 응답했다. 매칭 방식은 전부 `toss_direct_payment_key`였고, 정책상 browser action은 `block_purchase_virtual_account`다.

이번 확인 결과:

| 항목 | 결과 |
|---|---:|
| 확인 대상 | pending 상위 20건 |
| 금액 합계 | 536,729,000원 |
| pending 49건 금액 대비 비중 | 약 97.4% |
| Toss direct `confirmed` | 0건 |
| Toss direct `pending` | 20건 |
| Toss direct `canceled` 또는 `expired` | 0건 |

할 수 있는 것:

- [Codex] 운영 VM 원장에서 pending 상위 주문을 뽑는다.
- [Codex] paymentKey 기준 Toss direct read-only 조회로 현재 결제 상태를 확인한다.
- [Codex] `/ads/tiktok` 화면과 문서에 현재 상태를 반영한다.

승인 없이 하지 않는 것:

- production Attribution 원장에 status/fate를 추가 write 반영하지 않는다.
- Toss나 아임웹 주문 상태를 변경하지 않는다.
- 운영 배포나 스키마 변경을 하지 않는다.

남은 한계:

- 2026-04-22 확인은 "Toss direct 상태가 아직 pending"이라는 뜻이었다. 바이오컴 가상계좌는 24시간 이내 미입금 시 취소되므로, 주문 후 24시간이 지난 pending은 후속 입금 가능성보다 `vbank_expired`로 봤다.
- 2026-04-23 write 직전에는 49건 중 1건이 이미 `canceled`가 되어 있었고, 남은 48건만 제한 write했다.
- 대표 보고용 official 숫자는 guard 전 기간에 대해 확정 가능하다. guard 후 기간은 7일/14일 단위로 더 쌓아야 한다.

## 현재 병목

1. **post-write 관찰 필요**: TikTok pending 48건 write는 끝났다. 이제 같은 유형의 Imweb `PAYMENT_OVERDUE`가 새로 생겼을 때 15분 주기 status sync가 자동으로 원장에 반영하는지 봐야 한다.
2. **post-guard 기간 부족**: 2026-04-18 ~ 2026-04-22 5일은 수집했지만, 2026-04-24와 2026-05-01 비교는 아직 날짜가 지나지 않았다.
3. **source precision 기준 미확정**: high 기준을 official로 볼지, broad 기준을 보조로 볼지 결정해야 한다.
4. **운영 예산 판단 보류**: guard 전 confirmed ROAS는 0이고 pending도 canceled로 닫혔다. 예산 증액 근거는 약하다. 다만 최종 축소/유지 판단은 guard 후 7일/14일 데이터를 보고 고정한다.

## 다음 액션

- 지금 당장:
  - [Codex] API 산출물과 기존 CSV 합계 비교 리포트 자동화.
  - [Codex] 2026-04-23 write 결과를 `/ads/tiktok`에서 재확인하고, pending 0 / canceled 50 표시가 유지되는지 본다.
  - [Codex] status sync 자동 주기에서 새 Imweb `PAYMENT_OVERDUE`가 들어왔을 때 `canceled/vbank_expired`로 승격되는지 다음 overdue 발생 시 확인한다.
  - [TJ] `/ads/tiktok` 운영 화면이 최신 backend 결과를 제대로 표시하는지 확인한다.
- 이번 주:
  - [Codex] 2026-04-18 ~ 2026-04-24 API 재수집. 날짜가 지난 뒤 실행.
  - [Codex + Claude Code] `/ads/tiktok`에 guard 전후 비교 카드 보강.
  - [TJ] TikTok Ads Manager attribution window 화면 설정 확인.
- 운영 승인 후:
  - [TJ] `/ads/tiktok` 운영 반영 승인.
  - [Codex] API source를 정식 적재 흐름으로 고정.
  - [TJ + Codex] Events API는 Phase 2~4 결과를 보고 진행/보류 결정.

## 이번 로컬 검증

| 항목 | 결과 |
|---|---|
| Business API 인증 | 성공. access token은 `backend/.env`에 저장, 문서에는 미기록 |
| advertiser list | `(주)바이오컴_adv` = `7593201373714595856`, `바이오컴0109` = `7593240809332555793` |
| 2026-03-19 ~ 2026-04-17 API | 147행, 비용 28,363,230원, 구매수 321건, 구매값 복원 910,630,888원 |
| CSV 대비 API 차이 | 비용 0원, 클릭 0, 구매수 0, 노출 -23, 구매값 -65원 |
| 2026-04-18 ~ 2026-04-22 API | 24행, 비용 4,839,714원, 구매수 12건, 구매값 3,456,232원 |
| 로컬 SQLite | `tiktok_ads_daily` 적재 경로 준비, post-guard processed CSV 생성 |
| post-guard daily comparison | 5일, 플랫폼 ROAS 0.71414, 운영 confirmed/pending 0원 |
| source precision | high 49건 / 552,242,000원, medium 0건 / 0원, low 1건 / 21,900원 |
| pending top 20 direct check | 20건 / 536,729,000원, Toss direct `pending` 20건, confirmed 0건 |
| 운영 VM 제한 dry-run | 48건 후보, 48건 `imweb_overdue_order_id -> canceled`, write 0 |
| 운영 VM 실제 write | 48건 후보, 48건 write, skipped 0 |
| 운영 VM post-write 확인 | 같은 48개 orderId dry-run `totalCandidates=0`, ROAS API pending 0 / canceled 50 |
| Backend typecheck | `npm --prefix backend run typecheck` 통과 |
| Frontend typecheck | `npx tsc --noEmit` 통과 |

## 2026-04-23 운영 write 결과

TJ 조건부 승인에 따라 운영 VM Attribution 원장에 남아 있던 TikTok pending을 제한 write했다.

조건부 승인 범위:

1. 운영 VM 배포
2. 운영 VM dry-run 결과 확인
3. 백업/롤백 경로 확인
4. 실제 write

중요한 범위 통제:

- 2026-04-22 재점검 시점에는 pending이 49건이었다.
- 2026-04-23 write 직전 운영 ROAS API에서는 pending이 48건이었다. 1건은 이미 별도 sync로 `canceled`가 된 것으로 보인다.
- 전체 dry-run은 `updatedRows=133`까지 잡혔다. 이대로 쓰면 승인 범위를 넘으므로 중단했다.
- `orderIds` 필터를 추가해 현재 남아 있던 48건만 대상으로 제한했다.

백업과 롤백:

| 항목 | 위치 |
|---|---|
| write 직전 DB 백업 | `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_48_write_20260423_032231.bak` |
| 배포 전 DB 백업 | `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_overdue_sync_20260423_030921.bak` |
| 배포 전 dist 백업 | `/home/biocomkr_sns/seo/shared/deploy-backups/20260423_030921/backend-dist.prev.tgz` |
| 운영 DB 위치 | `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3` |

검증 결과:

| 단계 | 결과 |
|---|---:|
| 제한 dry-run `totalCandidates` | 48 |
| 제한 dry-run `matchedRows` | 48 |
| 제한 dry-run `updatedRows` | 48 |
| 제한 dry-run `writtenRows` | 0 |
| 실제 write `writtenRows` | 48 |
| post-write 같은 orderIds dry-run `totalCandidates` | 0 |
| 운영 DB 직접 조회 | 48/48 `canceled`, 남은 `pending` 0 |
| ROAS API guard 전 pending | 0건 / 0원 |
| ROAS API guard 전 canceled | 50건 / 552,263,900원 |

해석:

- 이번 write는 Toss나 아임웹 주문 상태를 바꾼 것이 아니다.
- 이미 운영 아임웹 주문 DB에서 `PAYMENT_OVERDUE` 자동취소였던 주문을, TikTok ROAS용 Attribution 원장에 뒤늦게 반영한 것이다.
- 따라서 내부 potential ROAS를 부풀리던 5.51억 pending은 더 이상 “입금될 수 있는 매출 후보”가 아니다.
- guard 전 기간의 내부 confirmed ROAS는 0.00으로 유지된다.

운영 배포 주의사항:

- 첫 배포 때 scp 대상 파일명이 겹쳐 PM2가 잠시 restart loop에 들어갔다.
- 즉시 full `backend/dist`를 다시 업로드해 복구했고, health는 `ok`로 확인했다.
- 이 사고 중에는 production DB write를 하지 않았다. 데이터 write는 health 복구, dry-run, 백업 확인 이후에만 실행했다.

## 2026-04-22 pending sync 재점검

TJ 확인값인 “가상계좌 24시간 미입금 시 취소”를 기준으로 TikTok pending 49건을 다시 점검했다.

먼저 장부 이름을 쉽게 풀면 다음과 같다.

| 장부 | 무엇을 담는가 | 이번 이슈에서 한 역할 |
|---|---|---|
| Attribution 원장 | 우리 코드가 결제완료 페이지에서 받은 `payment_success` 이벤트 기록. 광고 유입, `ttclid`, 결제 상태, 금액을 담는다 | TikTok에서 온 주문 후보 49건을 찾는 출발점 |
| Toss direct/API | PG사가 아는 결제 상태. 카드면 `DONE`, 가상계좌 미입금이면 대개 `WAITING_FOR_DEPOSIT` 계열로 보인다 | 브라우저 `Purchase`를 보낼지 막을지 판단하는 실시간 안전장치 |
| `tb_iamweb_users` | 운영 PostgreSQL에 있는 아임웹 주문/상품 라인 원장. 이름은 users지만 실제로는 주문번호, 상품, 결제수단, 주문상태, 취소사유를 담는 운영 주문 DB다 | 가상계좌가 24시간 후 자동취소됐는지 확인하는 정본 |

이번 상황을 한 문장으로 말하면 이렇다.

**아임웹 운영 주문 DB는 이미 “자동취소 완료”를 알고 있었지만, 당시 TikTok ROAS용 Attribution 원장은 그 값을 status/fate로 반영하지 못하고 있었다.**

즉 receiver가 죽어서 주문을 못 받은 문제가 아니다. 결제완료 이벤트는 들어왔고, 운영 DB도 살아 있다. 문제는 `PAYMENT_OVERDUE` 자동취소 상태를 Attribution 원장에 승격시키는 sync 단계가 아직 없었다는 점이다.

| 항목 | 결과 |
|---|---:|
| TikTok pending rows | 49 |
| pending 금액 | 551,095,900원 |
| 24시간 미만 pending | 0건 / 0원 |
| 24~48시간 pending | 0건 / 0원 |
| 48시간 초과 pending | 49건 / 551,095,900원 |
| pending loggedAt 범위 | 2026-04-02 01:31 KST ~ 2026-04-16 23:02 KST |
| Toss direct decision | 49건 모두 `pending / block_purchase_virtual_account` |
| 운영 `tb_iamweb_users` 매칭 | 49/49 |
| 운영 주문 상태 | 49건 모두 `VIRTUAL / PAYMENT_OVERDUE / 입금기간 마감으로 인한 자동 취소` |

해석:

- TikTok pending 49건은 현재 24시간 미만 대기 주문이 아니다.
- 운영 receiver는 끊기지 않았다. 2026-04-22 14:05 KST 조회 기준 `biocom_imweb` 최신 `payment_success`는 2026-04-22 14:05 KST였다.
- 운영 health도 background job enabled, Attribution status sync enabled, 15분 주기다.
- 운영 VM의 기존 `/api/attribution/sync-status/toss?dryRun=true&limit=500` 결과는 `updatedRows=42`, `skippedPendingRows=103`, `skippedNoMatchRows=147`이었다. 즉 운영 sync endpoint는 살아 있지만, 당시 운영 배포본은 Toss 중심이라 Imweb `PAYMENT_OVERDUE`를 ledger `canceled/vbank_expired`로 쓰는 단계가 없었다.
- 로컬 코드에는 Imweb overdue 기반 status sync를 추가했다. 2026-04-23에는 이 코드를 운영 VM에 배포했고, 운영 VM dry-run 확인 후 TJ 조건부 승인 범위 안에서 현재 남아 있던 48건을 write 완료했다.

## 개발 부록

### 관련 코드·문서 위치

- `backend/scripts/tiktok-business-report-dry-run.ts` — TikTok Business API read-only report JSON/CSV 저장 스크립트.
- `data/ads_csv/tiktok/api/` — Business API dry-run 산출물.
- `data/ads_csv/tiktok/processed/20260418_20260422_daily_campaign.csv` — 최신 daily 적재 경로용 post-guard API 변환 CSV.
- `backend/src/tiktokRoasComparison.ts` — TikTok Ads 로컬 테이블 upsert, 운영 VM 원장 조회, source precision 집계, gap 계산.
- `frontend/src/app/ads/tiktok/page.tsx` — TikTok ROAS 화면, ROAS Gap Waterfall, pending audit.
- `tiktok/tiktok_business_api_setup.md` — TikTok Business API 설정 런북.
- `tiktok/tiktok_purchase_guard_enforce_v1.js` — 운영 적용 TikTok Purchase Guard.

### 데이터 소스별 역할·한계

| 데이터 | 역할 | 한계 |
|---|---|---|
| TikTok Business API | 광고비, 구매수, 구매값 복원, 일자별 캠페인 데이터 | 캠페인명 차원을 직접 지원하지 않아 기존 CSV/DB 매핑을 붙인다 |
| TikTok Ads CSV | API 검증 기준과 과거 수동 백업 | 수동 export라 컬럼과 기간 실수가 생길 수 있다 |
| 운영 VM Attribution 원장 | TikTok 후보 주문과 source reason 확인 | 결제완료 페이지 미도달 주문은 누락될 수 있다 |
| Toss/아임웹 주문 | 확정 입금과 주문 상태 판단 | 광고 유입 정보가 직접 들어있지 않다 |
| Pixel Helper/Events Manager | guard 이후 이벤트 수신 확인 | 로그인 화면이라 TJ 확인이 필요하다 |

### Source Precision 기준

| tier | 기준 | 현재 값 |
|---|---|---:|
| high | `ttclid_direct`, `ttclid_url`, `metadata_ttclid_url` | 49건 / 552,242,000원 |
| medium | TikTok UTM 근거만 있음 | 0건 / 0원 |
| low | referrer, landing, metadata URL 텍스트 근거 | 1건 / 21,900원 |

### 버전 기록

- **v3.10-historical-close-future-v2-standard** (2026-04-23 14:48 KST): 과거 구간을 exact event-level attribution 복원 대상에서 제외하고, business-level validation 3등급으로 닫는 official conclusion을 최상단에 고정. 미래 판단 기준은 v2 이벤트 로그 배포 이후 7일/14일 데이터로 전환.
- **v3.9-inserted-code-capi-gap-check** (2026-04-23 13:52 KST): 운영 HTML 직접 확인 기준으로 TikTok Guard v1/TikTok Pixel/Meta funnel CAPI mirror 존재, TikTok Events API와 TikTok event-level ledger 부재를 정리. v2 배포 전 과거 주문 exact 복원 불가와 부분 검산 가능 범위를 명시.
- **v3.8-event-level-logging-campaign-roas** (2026-04-23 13:28 KST): `POST /api/attribution/tiktok-pixel-event`, `tiktok_pixel_events`, Guard v2 event log 후보, 캠페인별 TikTok 주장 ROAS 합산 구현 결과를 문서 최상단에 반영.
- **v3.7-operational-48-write** (2026-04-23 12:26 KST): TJ 조건부 승인 범위에 따라 운영 VM 배포, DB/dist 백업, 제한 dry-run, 실제 write, post-write 검증 완료. write 직전 pending은 49건이 아니라 48건이었고, 48/48건을 `canceled/vbank_expired`로 반영했다. 운영 ROAS API 기준 guard 전 TikTok pending은 0건, canceled는 50건 / 552,263,900원이다.
- **v3.6-1to4-local-impl** (2026-04-23 11:57 KST): 최상단 1~4 진행 상태 업데이트. Imweb `PAYMENT_OVERDUE` 보조 sync 로컬 구현·dry-run, `/ads/tiktok` pending fate 요약, 2026-04-18 ~ 2026-04-22 TikTok Business API post-guard 수집 결과 기록. 운영 VM 원장 write는 아직 미실행으로 명시.
- **v3.5-ledger-location-confidence** (2026-04-23 11:42 KST): 최상단에 원장 위치 기준 추가. TikTok ROAS용 Attribution 원장은 운영 VM이고, 로컬 SQLite는 Ads/API 캐시임을 명시. 다음 할일 4개에 Codex 진행 추천/자신감 %, 자료 충분성, 추가 확인 사항을 추가.
- **v3.4-next-actions-context** (2026-04-23 11:38 KST): 최상단에 다음 할일 4개를 추가. `tb_iamweb_users`가 운영 아임웹 주문/상품 라인 원장이라는 설명과, 자동취소 상태가 아임웹 DB에는 있었지만 Attribution 원장 sync에 반영되지 않았다는 맥락을 쉬운 말로 보강.
- **v3.3-pending-sync-recheck** (2026-04-22 14:16 KST): TikTok pending 49건 재점검. 49건 모두 24시간 초과, 운영 `tb_iamweb_users` 기준 `VIRTUAL / PAYMENT_OVERDUE / 입금기간 마감으로 인한 자동 취소` 확인. `/ads/tiktok` pending audit은 24시간 초과 pending을 `expired_unpaid`로 표시하도록 로컬 코드 보정.
- **v3.2-vbank-expiry-24h** (2026-04-22 14:00 KST): 바이오컴 가상계좌 주문은 주문 후 24시간 이내 미입금 시 취소된다는 TJ 확인값을 반영. 24시간 경과 pending은 `vbank_expired` 후보로 분리하는 원칙을 추가.
- **v3.1-pending-top20-direct-check** (2026-04-22 12:53 KST): pending 상위 20건 확인 가능성 분석 추가. Codex가 운영 VM `payment-decision` endpoint로 paymentKey 기반 Toss direct read-only 확인 가능함을 검증했고, 상위 20건 / 536,729,000원 모두 현재 `pending`임을 기록.
- **v3.0-phase-roadmap** (2026-04-22 12:18 KST): `gptfeedback_0422_1` 반영. Phase 0~5 로드맵으로 재구성. API → `tiktok_ads_daily` 적재 초안, 2026-04-18 ~ 2026-04-21 post-guard API 수집, source precision summary, ROAS Gap Waterfall, pending audit fate 필드 반영.
- **v2.11-business-api** (2026-04-22 00:36 KST): TikTok Business API 승인 후 OAuth `auth_code` 교환 성공, `backend/.env`에 read-only access token과 advertiser ID 저장. Reporting API 2026-03-19 ~ 2026-04-17 캠페인×일자 147행 dry-run 성공.
- **v2.10-daily-join** (2026-04-19 09:27 KST): `tiktok_ads_daily`와 운영 VM Attribution 원장을 KST 날짜 기준으로 조인하는 `daily_comparison` API 응답 추가.
- **v2.9-daily** (2026-04-18 14:53 KST): 2026-03-19 ~ 2026-04-17 일별 CSV 수령·분석·적재 반영.
- **v2.8** (2026-04-18 13:33 KST): API 승인 전 Custom report + scheduled export 경로 고정, pending 상위 20건 audit API/프론트 추가.
- **v1 ~ v2.7**: Guard dry-run/enforce, CSV intake, 운영 VM 원장 read-only 조회, `/ads/tiktok` 초기 화면 구축.
