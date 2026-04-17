# TikTok Purchase Guard Dry-run 적용 메모

작성일: 2026-04-16

대상 코드: `tiktok/tiktok_purchase_guard_dry_run.js`

## 목적

가상계좌 미입금 주문 생성 시점에 TikTok `Purchase`가 발화되는지 감시하고, 기존 결제 상태 판정 API로 `confirmed / pending / canceled / unknown`을 확인한다.

현재 코드는 `dry-run`이다. TikTok 이벤트를 차단하거나 바꾸지 않는다.

## 현재 동작

| 항목 | 동작 |
|---|---|
| `TIKTOK_PIXEL.track('Purchase', ...)` | 원래 호출을 즉시 통과시킨 뒤 비동기로 결제 상태 조회 |
| `ttq.track('Purchase', ...)` | 원래 호출을 즉시 통과시킨 뒤 비동기로 결제 상태 조회 |
| 결제 상태 조회 | `https://att.ainativeos.net/api/attribution/payment-decision` |
| 저장 위치 | `window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.state.decisions` |
| 세션 보관 | `sessionStorage.__biocom_tiktok_purchase_guard_decisions__` |
| 콘솔 로그 | `[biocom-tiktok-purchase-guard]` prefix |

## dry-run 확인 방법

1. 아임웹 헤더 상단 또는 TikTok 픽셀보다 먼저 실행되는 위치에 `tiktok_purchase_guard_dry_run.js` 내용을 임시 삽입한다.
2. 카드 결제 1건을 만든다.
3. Chrome console에서 아래를 확인한다.

```js
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.getDecisions()
```

4. 카드 결제는 아래처럼 보여야 한다.

| 필드 | 기대값 |
|---|---|
| `status` | `confirmed` |
| `browserAction` | `allow_purchase` |
| `matchedBy` | `toss_direct_order_id` 또는 원장 매칭값 |

5. 가상계좌 미입금 주문 1건을 만든다.
6. 가상계좌 미입금은 아래처럼 보여야 한다.

| 필드 | 기대값 |
|---|---|
| `status` | `pending` |
| `browserAction` | `block_purchase_virtual_account` |
| `matchedBy` | `toss_direct_order_id` 또는 원장 매칭값 |

## enforce 전환 조건

`tiktok_purchase_guard_dry_run.js` 안의 아래 값은 아직 바꾸지 않는다.

```js
enforcePurchaseDecision: false
```

아래 4개 조건을 통과한 뒤에만 `true` 전환을 검토한다.

| 조건 | 기준 |
|---|---|
| 카드 결제 | TikTok `Purchase` 유지 |
| 가상계좌 미입금 | `pending / block_purchase_virtual_account` 판정 확인 |
| 같은 주문 재진입 | 중복 `Purchase`가 늘지 않음 |
| Events Manager | 카드 구매는 `Purchase`, 가상계좌 미입금은 `Purchase` 제외 가능 |

## 로딩 속도 의견

헤더/푸터 코드가 길어지면 로딩이 느려질 수 있다. 다만 영향은 "파일 길이" 자체보다 아래 요인이 더 크다.

| 요인 | 영향 |
|---|---|
| 동기 네트워크 호출 | 가장 위험. 렌더링과 결제 이벤트를 직접 지연시킬 수 있음 |
| 큰 inline script 파싱 | 모바일에서 누적되면 초기 렌더링 지연 가능 |
| 모든 페이지에서 무거운 DOM scan 반복 | 상품/결제와 무관한 페이지까지 비용 발생 |
| console log 과다 | dry-run 중에는 허용, 운영 enforce 후에는 줄여야 함 |
| 외부 script를 동기 로드 | 렌더링 차단 가능 |

이번 dry-run 코드는 약 15KB이고, 핵심 결제 판정은 `Purchase`가 발생한 뒤 비동기로 조회한다. `dry-run` 상태에서는 원래 TikTok `Purchase` 호출을 먼저 통과시키므로 구매 이벤트 발화 자체를 느리게 만들 가능성은 낮다.

그래도 운영 적용 시에는 아래 원칙을 지킨다.

1. 헤더에는 "초기 래핑에 필요한 최소 코드"만 둔다.
2. `fetch`는 절대 동기화하지 않는다.
3. 일반 상품/콘텐츠 페이지에서는 결제 상태 API를 호출하지 않는다.
4. `Purchase` 호출이 발생했을 때만 `/api/attribution/payment-decision`을 호출한다.
5. dry-run이 끝나면 `debug` 로그를 줄인다.
6. 최종 배포 전 가능하면 minify해서 5KB 안팎으로 줄인다.

## 배치 위치 의견

TikTok `Purchase`를 놓치지 않으려면 Guard는 TikTok/아임웹 구매 이벤트보다 먼저 로드되어야 한다. 따라서 최종 enforce 코드는 헤더 상단이 안전하다.

다만 헤더가 너무 길어지는 문제를 줄이려면 아래 구조가 좋다.

| 위치 | 내용 |
|---|---|
| 헤더 상단 | 짧은 wrapper/bootstrap만 배치 |
| 푸터 또는 외부 파일 | 진단 UI, 긴 helper, 운영 리포트용 부가 코드 |

현재 dry-run 파일은 검증용이라 읽기 쉽게 작성되어 길다. 운영 enforce로 갈 때는 같은 로직을 축약하고 로그를 줄인 버전을 별도로 만드는 편이 맞다.

## 롤백 기준

아래 중 하나라도 보이면 즉시 제거한다.

- 카드 결제 `Purchase`가 TikTok Pixel Helper에서 사라짐
- 결제완료 페이지에서 JS error 발생
- `payment-decision` 요청이 반복 폭증함
- 같은 주문번호의 `Purchase`가 중복 증가함
- 결제완료 페이지 체감 로딩이 명확히 느려짐
