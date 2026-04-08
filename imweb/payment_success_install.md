# Imweb Payment Success Caller Install

목적: 아임웹 `shop_payment_complete` 진입 시 `payment_success` payload에 `ga_session_id`, `client_id`, `user_pseudo_id`를 함께 실어 `seo/backend`의 attribution ledger로 보낸다.

## 적용 파일

- 바이오컴용 정본 스니펫: `imweb/biocom_payment_success_caller.html`
- 생성 유틸: `backend/scripts/render-imweb-attribution-snippet.ts`
- 렌더 함수: `backend/src/imwebAttributionSnippet.ts`

## 아임웹 적용 위치

1. 아임웹 관리자 → 사이트 관리 → SEO/헤더 설정이 아니라, `푸터 코드` 또는 결제완료 페이지에서 항상 실행되는 하단 공통 코드 영역에 넣는다.
2. 현재 바이오컴 정본 endpoint는 `https://att.ainativeos.net/api/attribution/payment-success`다. [biocom_payment_success_caller.html](/Users/vibetj/coding/seo/imweb/biocom_payment_success_caller.html)에 이 값이 그대로 들어 있는지 확인한다.
3. 현재 바이오컴 기준 measurement id는 `G-WJFXN5E2Q1`, fallback/legacy 확인용으로 `G-8GZ48B1S59`도 같이 넣어 두었다.
4. `biocom.kr` 라이브 HTML에는 이미 기존 푸터/커스텀 코드(`gtag('set', { user_id })`, `rebuyz_utm`, `rebuyz_view`, `shop_payment_complete`/`shop_order_done` 조건문)가 있으므로, 새 스니펫은 빈 화면에 새로 넣는 개념이 아니라 **기존 푸터 코드에 병합 후 publish**하는 작업으로 이해해야 한다.

## endpoint 판단

- `att.ainativeos.net`는 roadmap/phase3/aibio 문서에 적힌 Cloudflare named tunnel 고정 주소와 일치한다.
- `2026-04-08` 확인 기준 `https://att.ainativeos.net/api/attribution/ledger?limit=1`은 `200` 응답을 돌려주므로, 바이오컴 payment-success caller 용도에서는 **ngrok 없이 운영 가능**하다고 본다.
- 현재 `.env`의 `ngrok` 주소도 같은 ledger summary를 돌려주지만, 이건 **임시 우회/장애 대응용**으로만 보는 편이 맞다. 정본 endpoint는 `att.ainativeos.net`다.
- 따라서 바이오컴 푸터 코드에는 `ngrok`를 기본값으로 넣지 않는다. `att.ainativeos.net` 장애 시에만 임시 교체 대상으로 검토한다.

## 왜 이렇게 읽는가

- `ga_session_id`: `dataLayer` → `gtag('get', ..., 'session_id')` → `_ga_<measurement>` cookie 순으로 읽는다.
- `client_id`: `dataLayer` → `gtag('get', ..., 'client_id')` → `_ga` cookie 순으로 읽는다.
- `user_pseudo_id`: 브라우저에서 공식적으로 별도 노출되지 않는 경우가 많으므로 `dataLayer`에 있으면 그 값을 쓰고, 없으면 web GA 브라우저 식별자인 `client_id`를 fallback으로 쓴다.
- 임의 랜덤값 생성은 금지다. 랜덤 `user_pseudo_id`를 만들면 GA4/Toss/ledger를 같은 브라우저 축으로 묶을 수 없고, 오히려 조인을 더 깨뜨린다.

## 검증 순서

1. 브라우저에서 결제완료 페이지 URL에 `?__seo_attribution_debug=1`을 붙여 콘솔 로그를 본다.
2. Network 탭에서 `https://att.ainativeos.net/api/attribution/payment-success`로 `POST` 또는 beacon 전송이 실제로 나가는지 본다.
3. public fixed host와 최신 로컬 backend를 나눠서 확인한다.

```bash
curl -s 'https://att.ainativeos.net/api/attribution/ledger?source=biocom_imweb&captureMode=live&limit=5'
curl -s http://localhost:7020/api/attribution/caller-coverage?source=biocom_imweb
```

- `2026-04-08` 확인 기준 public `att.ainativeos.net`는 `ledger`는 열리지만 `caller-coverage`는 아직 `404`였다.
- 그래서 coverage 퍼센트 확인은 **최신 소스를 띄운 로컬 backend**에서 보는 편이 안전하다. 로컬 `7020`이 예전 프로세스면 먼저 최신 소스로 재시작해야 한다.

## 현재 남은 것

- 저장소 안에는 실제 아임웹 관리자 원본이 없어서, 이번 턴에서는 "수동 삽입용 정본 스니펫"과 고정 endpoint 정리까지 닫았다.
- 라이브 `biocom.kr`에는 기존 푸터/커스텀 코드가 이미 있으나, 새 `ga_session_id / client_id / user_pseudo_id` attribution 스니펫은 아직 publish되지 않은 상태다.
- `checkout-context`는 begin_checkout 실제 삽입 지점이 저장소에 없으므로 이번 턴 범위에서 미완료다.
