# TikTok fetch smoke 결과

작성 시각: 2026-04-23 21:57 KST
기준 페이지: `https://biocom.kr/`

## 결론

- `biocom.kr` 브라우저 콘솔에서 실행한 `fetch('https://att.ainativeos.net/api/attribution/tiktok-pixel-event', ...)` smoke는 **성공**이다.
- 운영 VM 기준으로 **CORS 허용**, **POST write 성공**, **GET readback 성공**까지 확인했다.
- 다만 현재 라이브 페이지 소스는 아직 **v2가 아니라 v1 debug=true** 상태다. 따라서 콘솔에 Guard 설치/래핑 로그가 계속 보이는 것은 정상이다.
- `froogaloop2.min.js` 오류는 **TikTok Guard와 직접 관련 없는 별도 이슈**로 본다.

## 사용자가 본 콘솔 메시지

실행 전 콘솔:

```text
[biocom-tiktok-purchase-guard] accessor_installed_TIKTOK_PIXEL
[biocom-tiktok-purchase-guard] accessor_installed_ttq
[biocom-tiktok-purchase-guard] installed
[biocom-tiktok-purchase-guard] wrapped_TIKTOK_PIXEL_init
[biocom-tiktok-purchase-guard] wrapped_TIKTOK_PIXEL_track
[funnel-capi] fbq wrapped agent=imweb version=2.0
[funnel-capi] installed 2026-04-15-biocom-funnel-capi-v3 ...
tiktok-pixel start
[biocom-tiktok-purchase-guard] wrapped_ttq_track
IMWEB_DEPLOY_STRATEGY init event dispatched
[biocom-tiktok-purchase-guard] wrapped_ttq_track
[biocom-tiktok-purchase-guard] wrapped_ttq_track
Uncaught TypeError: Cannot read properties of undefined (reading 'value')
  at froogaloop2.min.js?1577682292:1
```

fetch 실행 후:

```js
fetch('https://att.ainativeos.net/api/attribution/tiktok-pixel-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'smoke_test',
    source: 'manual_browser_test',
    eventName: 'Purchase',
    eventId: 'SmokeTest_20260423',
    orderCode: 'smoke_order_code',
    orderNo: 'smoke_order_no',
    paymentCode: 'smoke_payment_code',
    value: '1000',
    currency: 'KRW',
    url: location.href,
    referrer: document.referrer
  })
})
```

브라우저 결과:

```text
Promise fulfilled -> Response
```

## 특이사항 판정

### 1. Guard 설치/래핑 로그

판정: **특이사항 있음**

이 로그들은 최종 v2 운영본(`2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`)의 `debug: false` 상태라면 원칙적으로 보이지 않아야 한다.

실제 라이브 소스 확인 결과:

- 현재 `https://biocom.kr/` 페이지는 `2026-04-17.tiktok-purchase-guard-enforce.v1`를 로드 중
- 해당 블록의 설정은 `debug: true`

즉, 지금 보인 설치/래핑 로그는 이상 현상이 아니라 **아직 라이브 헤더가 v2로 교체되지 않았다는 신호**다.

확인 근거:

```text
Version: 2026-04-17.tiktok-purchase-guard-enforce.v1
debug: true
```

따라서 현재 상태는:

- backend 준비 완료
- browser fetch smoke 성공
- 그러나 **아임웹 Header Code는 아직 v1 debug=true**

### 2. `[funnel-capi] ...`

판정: **특이사항 아님**

이 로그는 Meta/fbq mirror 쪽 로그다. TikTok fetch smoke의 실패 원인으로 보지 않는다.

### 3. `tiktok-pixel start`

판정: **특이사항 아님**

기존 footer 코드에서 나오는 로그로 보이며, 이번 smoke 결과를 막는 증거는 없다.

### 4. `froogaloop2.min.js ... reading 'value'`

판정: **특이사항은 맞지만, TikTok Guard 직접 원인으로 보이지 않음**

라이브 페이지 소스 확인 결과:

- `https://vendor-cdn.imweb.me/js/froogaloop2.min.js?1577682292` 포함
- 페이지에 Vimeo section 2개 존재
- `data-vimeo-id="1065304531"` 사용 중

따라서 이 오류는 Imweb/Vimeo 비디오 섹션 스크립트에서 난 것으로 보이며, TikTok Guard나 `tiktok-pixel-event` fetch 경로와 직접 연결된 스택은 아니다.

현재 판단:

- TikTok event log smoke의 성공/실패 판정에는 **비차단**
- 다만 홈 비주얼 Vimeo 섹션 오류로 이어질 수 있으므로 별도 정리 대상

## 서버 검증 결과

### 1. 운영 CORS preflight

외부 확인:

```text
OPTIONS https://att.ainativeos.net/api/attribution/tiktok-pixel-event
status: 204
access-control-allow-origin: https://biocom.kr
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
access-control-allow-headers: content-type
```

판정: **정상**

### 2. 운영 readback

외부 조회:

```text
GET /api/attribution/tiktok-pixel-events?orderCode=smoke_order_code&limit=10
```

결과 핵심:

```json
{
  "ok": true,
  "summary": {
    "totalEvents": 1,
    "uniqueOrderKeys": 1,
    "countsByAction": {
      "smoke_test": 1
    }
  },
  "items": [
    {
      "siteSource": "biocom_imweb",
      "pixelSource": "manual_browser_test",
      "action": "smoke_test",
      "eventName": "Purchase",
      "eventId": "SmokeTest_20260423",
      "orderCode": "smoke_order_code",
      "orderNo": "smoke_order_no",
      "paymentCode": "smoke_payment_code",
      "value": 1000,
      "currency": "KRW",
      "url": "https://biocom.kr/",
      "requestContext": {
        "origin": "https://biocom.kr",
        "path": "/api/attribution/tiktok-pixel-event"
      }
    }
  ]
}
```

판정: **write/readback 성공**

## 최종 판단

1. 사용자가 브라우저 콘솔에서 실행한 fetch smoke는 성공했다.
2. 운영 VM `tiktok_pixel_events` 원장에 실제 row가 들어갔다.
3. `biocom.kr` -> `att.ainativeos.net` CORS는 정상이다.
4. 현재 가장 큰 특이사항은 `froogaloop` 오류가 아니라, **라이브 Header Code가 아직 v1 debug=true라는 점**이다.

## 다음 액션

1. 아임웹 Header Code에서 `2026-04-17.tiktok-purchase-guard-enforce.v1` 블록 제거
2. `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` 블록 1회만 삽입
3. 라이브 소스에서 아래 2개 확인
   - `2026-04-17.tiktok-purchase-guard-enforce.v1` -> 0회
   - `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` -> 1회
4. 그 다음 카드 결제 1건, 가상계좌 1건으로 실제 release/block 확인

## 2026-04-24 v2 가상계좌 실주문 1차 결과

주문:

- `orderCode`: `o20260424213db598bfe51`
- `orderNo`: `202604248221933`
- `paymentCode`: `pa20260424fe3871f170294`
- 결제수단: 가상계좌

결론:

- TikTok Purchase 차단은 성공했다.
- Pixel Helper에는 `Purchase`가 없고 `PlaceAnOrder`만 표시됐다.
- 결제 판정은 `pending / block_purchase_virtual_account / matchedBy=toss_direct_payment_key / confidence=high`였다.
- 다만 v2 event log 저장은 CORS preflight에서 실패했다.

브라우저 오류:

```text
Access to resource at 'https://att.ainativeos.net/api/attribution/tiktok-pixel-event'
from origin 'https://biocom.kr' has been blocked by CORS policy:
The value of the 'Access-Control-Allow-Credentials' header in the response is ''
which must be 'true' when the request's credentials mode is 'include'.
```

운영 원장 조회:

```text
GET /api/attribution/tiktok-pixel-events?orderCode=o20260424213db598bfe51&limit=20
totalEvents=0
```

해석:

- v2 Guard의 광고 오염 차단 기능은 정상이다.
- v2의 내부 event log 목적은 이 주문에서는 실패했다.
- 실패 원인은 Guard 로직이 아니라 backend CORS 응답의 `Access-Control-Allow-Credentials` 누락이다.

조치:

- 2026-04-24 23:23 KST 운영 VM backend CORS 수정 배포 완료.
- 수정 내용: `cors({ ..., credentials: true })`.
- 배포 백업: `/home/biocomkr_sns/seo/shared/deploy-backups/20260424_232257/backend-prev-before-cors-fix.tgz`.

수정 후 검증:

```text
OPTIONS /api/attribution/tiktok-pixel-event
access-control-allow-origin: https://biocom.kr
access-control-allow-credentials: true
status: 204
```

production smoke:

```text
backendReadyForHeaderSwap=true
dbInsertOk=true
readbackVisible=true
```

다음 실결제부터는 `tiktok_pixel_events`에 저장되어야 한다.

## 2026-04-24 v2 카드 실주문 결과

주문:

- `orderCode`: `o202604248409955023aa3`
- `orderNo`: `202604246007665`
- `paymentCode`: `pa2026042445c3ae7e80788`
- 금액: `11900`
- 결제수단: 카드

사용자 제공 확인:

- Meta Pixel Helper에는 `Purchase`가 표시됐다.
- TikTok Pixel Helper에도 `Purchase`가 표시됐다.
- 주문완료 URL: `https://biocom.kr/shop_payment_complete?order_code=o202604248409955023aa3&payment_code=pa2026042445c3ae7e80788&order_no=202604246007665&rk=S`

TikTok Pixel Helper 확인:

```text
pixel=biocom_tiktok_web_pixel
pixelId=D5G8FTBC77UAODHQ0KOG
event=Purchase
timestamp=2026-04-24 23:25:39
setupMethod=Imweb
content_type=product
currency=KRW
value=11900
event_id=Purchase_o202604248409955023aa3
```

운영 TikTok event log 조회:

```text
GET /api/attribution/tiktok-pixel-events?orderCode=o202604248409955023aa3&limit=20
totalEvents=3
uniqueOrderKeys=1
countsByAction:
  purchase_intercepted=1
  decision_received=1
  released_confirmed_purchase=1
```

핵심 row:

```text
action=released_confirmed_purchase
eventName=Purchase
eventId=o202604248409955023aa3
orderCode=o202604248409955023aa3
orderNo=202604246007665
paymentCode=pa2026042445c3ae7e80788
value=11900
currency=KRW
decisionStatus=confirmed
decisionBranch=allow_purchase
decisionReason=toss_direct_api_status
decisionMatchedBy=toss_direct_order_id
```

payment decision 직접 조회:

```text
status=confirmed
browserAction=allow_purchase
confidence=high
matchedBy=toss_direct_order_id
Toss status=DONE
channel=카드
approvedAt=2026-04-24T23:25:36+09:00
```

판정:

- v2 카드 주문 경로는 성공이다.
- TikTok Purchase를 막지 않고 정상 release 했다.
- v2 event log도 운영 VM 원장에 정상 저장됐다.
- 외부 TikTok Pixel Helper 기준으로도 `Purchase`가 확인됐다.
- 앞선 가상계좌 테스트에서 확인된 `Purchase` 차단 + `PlaceAnOrder` 대체와 합쳐, 핵심 release/block 양쪽 경로가 모두 검증됐다.

주의:

- 운영 Attribution `payment_success` row는 최초 수신 시점에 pending으로 남을 수 있고, Toss direct decision은 즉시 `confirmed`로 판단한다. 이는 TikTok Guard 판정 실패가 아니라 내부 Attribution status sync 타이밍 이슈다.

## 2026-04-24 v2 가상계좌 실주문 post-CORS 재검증

주문:

- `orderCode`: `o20260424e1f05530c933d`
- `orderNo`: `202604247459692`
- `paymentCode`: `pa20260424440a9976940c7`
- 금액: `11900`
- 결제수단: 가상계좌
- 입금 여부: 미입금

사용자 제공 TikTok Pixel Helper 확인:

```text
pixel=biocom_tiktok_web_pixel
pixelId=D5G8FTBC77UAODHQ0KOG
event=PlaceAnOrder
timestamp=2026-04-24 23:32:58
setupMethod=Imweb
content_type=product
currency=KRW
payment_status=pending
value=11900
original_event_name=Purchase
original_event_id=o20260424e1f05530c933d
event_id=PlaceAnOrder_PlaceAnOrder_o20260424e1f05530c933d
```

운영 TikTok event log 조회:

```text
GET /api/attribution/tiktok-pixel-events?orderCode=o20260424e1f05530c933d&limit=20
totalEvents=4
uniqueOrderKeys=1
countsByAction:
  purchase_intercepted=1
  decision_received=1
  blocked_pending_purchase=1
  sent_replacement_place_an_order=1
```

핵심 row:

```text
action=blocked_pending_purchase
eventName=Purchase
eventId=o20260424e1f05530c933d
orderCode=o20260424e1f05530c933d
orderNo=202604247459692
paymentCode=pa20260424440a9976940c7
value=11900
currency=KRW
decisionStatus=pending
decisionBranch=block_purchase_virtual_account
decisionReason=toss_direct_api_status
decisionMatchedBy=toss_direct_order_id
```

payment decision 직접 조회:

```text
status=pending
browserAction=block_purchase_virtual_account
confidence=high
matchedBy=toss_direct_order_id
Toss status=WAITING_FOR_DEPOSIT
channel=가상계좌
paymentKey=iw_bi20260424233249Wbcu8
```

판정:

- CORS 수정 이후 v2 가상계좌 경로도 성공이다.
- TikTok Pixel Helper 기준으로 `Purchase`는 보이지 않고 `PlaceAnOrder`만 보였다.
- 운영 VM `tiktok_pixel_events` 원장에도 `purchase_intercepted -> decision_received -> blocked_pending_purchase -> sent_replacement_place_an_order` 4단계가 모두 저장됐다.
- 카드 confirmed release 경로와 가상계좌 pending block/replacement 경로가 모두 실주문으로 검증됐다.

현재 결론:

- v2 Guard는 운영 기준으로 핵심 기능 검증 완료.
- confidence: 99%.
- 다음 단계는 신규 개발보다 24-48시간 모니터링이다. 모니터링 기준은 TikTok Ads 구매 증가분, `tiktok_pixel_events`의 `released_confirmed_purchase`/`blocked_pending_purchase` 비율, 아임웹/토스 주문 상태 재대조다.

## 2026-04-24 TikTok Guard 자동 모니터링 예약

등록 시각:

- 2026-04-24 23:39 KST

등록 방식:

- 로컬 Mac `launchd` LaunchAgent 2개.
- 24시간 뒤 1회, 48시간 뒤 1회 실행.
- 실행 후 각 plist는 `--selfRemovePlist`로 자동 제거한다.

예상 실행:

- 24h: 2026-04-25 23:39 KST 전후
- 48h: 2026-04-26 23:39 KST 전후

주의:

- Mac이 잠자기 상태면 정확한 초 단위 실행은 보장하지 않는다. 깨어난 뒤 실행될 수 있다.
- Codex 채팅창으로 자동 메시지를 보내는 방식은 아니다. 결과 파일 생성 + macOS 알림 + 이 문서 append 방식이다.

등록된 작업:

```text
com.biocom.tiktok-guard-monitor-24h
com.biocom.tiktok-guard-monitor-48h
```

실행 스크립트:

```text
backend/scripts/tiktok-guard-monitor.cjs
```

결과 저장 위치:

```text
tiktok/monitoring/tiktok_guard_monitor_24h_*.md
tiktok/monitoring/tiktok_guard_monitor_48h_*.md
tiktok/monitoring/tiktok_guard_monitor_24h_*.json
tiktok/monitoring/tiktok_guard_monitor_48h_*.json
```

launchd 로그:

```text
backend/logs/tiktok-guard-monitor-24h.stdout.log
backend/logs/tiktok-guard-monitor-24h.stderr.log
backend/logs/tiktok-guard-monitor-48h.stdout.log
backend/logs/tiktok-guard-monitor-48h.stderr.log
```

수동 확인 명령:

```bash
launchctl print gui/501/com.biocom.tiktok-guard-monitor-24h
launchctl print gui/501/com.biocom.tiktok-guard-monitor-48h
ls -lt tiktok/monitoring/tiktok_guard_monitor_*.md | head
```

모니터링 판정 기준:

- `released_confirmed_purchase`는 `decisionStatus=confirmed`, `decisionBranch=allow_purchase`여야 한다.
- `blocked_pending_purchase`는 `decisionStatus=pending`, `decisionBranch=block_purchase_virtual_account`여야 한다.
- `sent_replacement_place_an_order`는 같은 주문에 `blocked_pending_purchase`가 있어야 한다.
- `purchase_intercepted` 후 최종 action이 없으면 warning 처리한다.
- API health 실패 또는 confirmed가 아닌 release는 fail 처리한다.

## 2026-04-25 `/ads/tiktok` 대시보드 업데이트

목적:

- 기존 `/ads/tiktok` 화면은 TikTok Ads 플랫폼 주장값과 운영 VM Attribution `payment_success` 비교 중심이었다.
- 2026-04-24 배포된 v2 Guard의 핵심 원장인 `tiktok_pixel_events`가 화면에 없어서, 카드/가상계좌 release/block 검증 상태를 대시보드에서 바로 볼 수 없었다.

반영:

- backend `GET /api/ads/tiktok/roas-comparison` 응답에 `tiktok_event_log`를 추가했다.
- 데이터 원천은 운영 VM API `https://att.ainativeos.net/api/attribution/tiktok-pixel-events`다.
- 프론트 `http://localhost:7010/ads/tiktok` 상단 기본 기간을 `2026-04-18 ~ 2026-04-24`로 변경했다.
- 화면 상단에 **v2 Guard 운영 이벤트 원장** 섹션을 추가했다.

2026-04-25 확인 기준:

```text
fetchedEvents=13
uniqueOrderKeys=4
released_confirmed_purchase=3
blocked_pending_purchase=1
sent_replacement_place_an_order=1
released_unknown_purchase=0
request_error=0
missingFinalActionOrders=0
anomalyCount=0
warningCount=0
```

검증:

```text
npm --prefix backend run typecheck
npm --prefix frontend run lint -- src/app/ads/tiktok/page.tsx
npm --prefix frontend run build
Playwright page check: PASS
console warnings/errors: 0
```

로컬 서버 상태:

- frontend: `http://localhost:7010/ads/tiktok`
- backend: `http://localhost:7020`
- backend는 현재 `launchctl` label `com.biocom.seo-backend-local`로 실행 중.
- frontend는 현재 `launchctl` label `com.biocom.seo-frontend-local`로 실행 중.

판정:

- `/ads/tiktok`은 이제 과거 ROAS gap과 v2 이후 event-level release/block 상태를 한 화면에서 볼 수 있다.
- 현재 상태는 `v2 Guard 운영 검증 완료`로 표시된다.

## 2026-04-25 `/ads/tiktok` 4/23 비용 0원 표시 수정

질문:

- `/ads/tiktok`에서 2026-04-23 TikTok 비용이 왜 0원으로 보이는가?

원인:

- 실제 TikTok 광고비가 0원이라고 확인된 것이 아니다.
- 로컬 `tiktok_ads_daily` 일별 광고 데이터가 현재 `2026-04-22`까지만 적재되어 있다.
- 기본 화면 기간을 `2026-04-18 ~ 2026-04-24`로 늘리면서, 2026-04-23과 2026-04-24가 빈 날짜인데 `0`처럼 보였다.

현재 데이터 범위:

```text
tiktok_ads_daily.minDate=2026-03-19
tiktok_ads_daily.maxDate=2026-04-22
2026-04-23 hasAdsData=false
2026-04-24 hasAdsData=false
```

수정:

- backend 일별 row에 `hasAdsData`를 추가했다.
- frontend 일별 표에서 `hasAdsData=false`인 날짜는 비용/플랫폼 구매값/ROAS/gap을 `데이터 없음`으로 표시한다.
- 상단 설명 문구에 “비용 0원은 실제 무집행 확정값이 아니라 미수집 표시”라고 안내한다.
- `Ads 데이터 범위 2026-03-19 ~ 2026-04-22` 배지를 추가했다.

검증:

```text
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix frontend run lint -- src/app/ads/tiktok/page.tsx
npm --prefix frontend run build
Playwright /ads/tiktok check: PASS
console warnings/errors: 0
```

결론:

- 4/23 비용 0원은 광고비 0 확정이 아니라 **TikTok Ads 일별 데이터 미수집**이었다.
- 4/23 이후 광고비/구매값을 보려면 TikTok Ads API 또는 CSV를 2026-04-23 이후 구간으로 다시 수집해야 한다.

## 2026-04-25 TikTok Ads API 4/23~4/24 수집

질문:

- TikTok Ads API로 누락된 2026-04-23 ~ 2026-04-24 광고 데이터를 수집할 수 있는가?

결론:

- 가능했다.
- 2026-04-23 비용 0원 표시는 실제 0원이 아니라 미수집 표시였고, API 수집 후 로컬 대시보드에서는 4/23과 4/24가 정상 데이터로 표시된다.
- 이 숫자는 **TikTok 플랫폼 주장값**이다. 내부 확정 주문 정본은 여전히 **운영 VM Attribution 원장**과 운영 주문 DB로 봐야 한다.

실행:

```bash
cd /Users/vibetj/coding/seo/backend
node --import tsx scripts/tiktok-business-report-dry-run.ts --start-date 2026-04-23 --end-date 2026-04-24 --write-processed-daily
```

안전 조치:

```text
로컬 SQLite 백업:
backend/data/backups/crm.sqlite3.bak_20260425_214305_before_tiktok_api_collect
```

산출물:

```text
data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260423_20260424.json
data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260423_20260424.csv
data/ads_csv/tiktok/processed/20260423_20260424_daily_campaign.csv
```

TikTok Business API 수집 합계:

```text
rows=10
spend=1,350,649
impressions=503,395
clicks=11,804
conversion=5
complete_payment=5
derived_complete_payment_value=1,037,160
```

대시보드 API 반영 결과:

```text
tiktok_ads_daily.importedRows=200
tiktok_ads_daily.rows=181
tiktok_ads_daily.minDate=2026-03-19
tiktok_ads_daily.maxDate=2026-04-24
```

일자별 결과:

| 날짜 | Ads 데이터 | TikTok 비용 | TikTok 주장 구매 | TikTok 주장 구매값 | TikTok 주장 ROAS | 내부 confirmed |
|---|---:|---:|---:|---:|---:|---:|
| 2026-04-23 | 있음 | 675,919원 | 4건 | 792,160원 | 1.171975 | 0건 / 0원 |
| 2026-04-24 | 있음 | 674,730원 | 1건 | 245,000원 | 0.363108 | 0건 / 0원 |

검증:

```text
GET /api/ads/tiktok/roas-comparison?start_date=2026-04-18&end_date=2026-04-24
2026-04-23 hasAdsData=true
2026-04-24 hasAdsData=true
Playwright /ads/tiktok check: PASS
console warnings/errors: 0
```

스크린샷:

```text
tiktok/monitoring/ads_tiktok_dashboard_20260425_api_collected.png
```

판정:

- `/ads/tiktok`의 4/23 비용 0원 문제는 해결됐다.
- 2026-04-18 ~ 2026-04-24 최근 7일 기준 TikTok Ads API 플랫폼 주장값은 이제 로컬 SQLite `backend/data/crm.sqlite3#tiktok_ads_daily`에 들어가 있다.
- 다만 4/23~4/24의 TikTok 주장 구매 5건 / 1,037,160원은 아직 내부 확정매출로 인정하면 안 된다. 정확한 판단은 v2 event log, 운영 VM Attribution 원장, 운영 주문 DB를 같이 봐야 한다.


## 2026-04-25 TikTok Guard 자동 모니터링 24h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_24h_2026-04-25T14-39-51-290Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-26 TikTok Guard 자동 모니터링 48h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_48h_2026-04-26T14-39-51-903Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-26 TikTok Guard 자동 모니터링 24h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_24h_2026-04-26T14-39-52-501Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-27 TikTok Guard 자동 모니터링 24h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_24h_2026-04-27T16-54-49-258Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-28 TikTok Guard 자동 모니터링 48h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_48h_2026-04-28T16-54-48-632Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-28 TikTok Guard 자동 모니터링 24h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_24h_2026-04-28T16-54-49-797Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-29 TikTok Guard 자동 모니터링 24h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_24h_2026-04-29T19-43-47-515Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-30 TikTok Guard 자동 모니터링 48h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_48h_2026-04-30T19-43-46-511Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-04-30 TikTok Guard 자동 모니터링 24h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_24h_2026-04-30T19-43-48-205Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events


## 2026-05-01 TikTok Guard 자동 모니터링 24h

- status: WARN
- report: `tiktok/monitoring/tiktok_guard_monitor_24h_2026-05-01T19-43-48-981Z.md`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events
