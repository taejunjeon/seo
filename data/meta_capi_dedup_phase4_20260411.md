# Meta CAPI Dedup Phase 4 Report

작성 시각: 2026-04-11 16:20:54 KST

## 결론

- Events Manager 확인은 Meta 계정 로그인, Pixel/Dataset 접근, 2FA가 필요한 외부 화면 작업이다. Codex가 로컬에서 직접 볼 수 있는 영역은 아니다.
- Codex가 바로 할 수 있는 일은 우리 서버가 Meta로 보낸 CAPI 전송 로그와 자체 attribution ledger를 조인해서, Events Manager에서 확인할 주문 샘플을 좁히는 것이다.
- 이 리포트는 그 로컬 분석 결과다. 반복 전송은 **우리 솔루션 -> Meta CAPI** 방향의 전송 로그를 뜻한다. Meta가 우리에게 다시 보낸 로그가 아니다.

## 분석 범위

- 로그 scope: operational only
- 응답 상태: 2xx success only
- 기본 기간: 최근 3일
- since override: -
- until override: -

## 요약

| 지표 | 값 |
|---|---:|
| CAPI success rows | 471 |
| CAPI failure rows | 0 |
| unique event_id | 202 |
| duplicate event_id groups | 142 |
| duplicate event_id rows | 269 |
| unique order+event keys | 201 |
| duplicate order+event groups | 141 |
| retry-like groups, same event_id | 140 |
| retry-like rows, same event_id | 405 |
| multi-event-id risk groups | 1 |
| multi-event-id risk rows | 6 |

## 위험 후보: 같은 주문+이벤트인데 event_id가 다른 그룹

| orderId | event | rows | unique event_id | first sent KST | last sent KST | event_id sample |
|---|---|---:|---:|---|---|---|
| 202604083892378 | Purchase | 6 | 2 | 2026-04-09 06:30:25 | 2026-04-09 06:30:29 | 202604083892378_Purchase_1775616212705<br>202604083892378_Purchase_1775611683662 |


### 최우선 Events Manager 확인 주문

- orderId: 202604083892378
- eventName: Purchase
- row count: 6
- unique event_id: 2
- 확인 이유: 같은 주문+Purchase가 서로 다른 event_id로 전송되어 Meta dedup이 실패했을 가능성이 가장 높다.

| sent KST | event_id | status | path | paymentKey | approvedAt KST | loggedAt KST |
|---|---|---:|---|---|---|---|
| 2026-04-09 06:30:25 | 202604083892378_Purchase_1775616212705 | 200 | auto_sync | iw_bi20260408102731qpmS8 | 2026-04-08 10:27:59 | 2026-04-08 11:43:32 |
| 2026-04-09 06:30:25 | 202604083892378_Purchase_1775616212705 | 200 | auto_sync | iw_bi20260408102731qpmS8 | 2026-04-08 10:27:59 | 2026-04-08 11:43:32 |
| 2026-04-09 06:30:27 | 202604083892378_Purchase_1775616212705 | 200 | auto_sync | iw_bi20260408102731qpmS8 | 2026-04-08 10:27:59 | 2026-04-08 11:43:32 |
| 2026-04-09 06:30:27 | 202604083892378_Purchase_1775611683662 | 200 | auto_sync | iw_bi20260408102731qpmS8 | 2026-04-08 10:27:59 | 2026-04-08 10:28:03 |
| 2026-04-09 06:30:28 | 202604083892378_Purchase_1775611683662 | 200 | auto_sync | iw_bi20260408102731qpmS8 | 2026-04-08 10:27:59 | 2026-04-08 10:28:03 |
| 2026-04-09 06:30:29 | 202604083892378_Purchase_1775611683662 | 200 | auto_sync | iw_bi20260408102731qpmS8 | 2026-04-08 10:27:59 | 2026-04-08 10:28:03 |

해석:

- 이 주문은 같은 승인 시각을 가진 주문인데, event_id suffix가 두 개로 갈라졌다.
- suffix 중 하나는 결제 승인시각에 가깝고, 다른 하나는 ledger loggedAt에 가깝다.
- 따라서 이미 반영한 event_id 생성식 수정 전 로그일 가능성이 높다.


## retry-like 후보: 같은 주문+이벤트+event_id 반복 그룹

| orderId | event | rows | unique event_id | first sent KST | last sent KST | event_id sample |
|---|---|---:|---:|---|---|---|
| 202604080521582 | Purchase | 3 | 1 | 2026-04-09 06:30:32 | 2026-04-09 06:30:34 | 202604080521582_Purchase_1775607083052 |
| 202604080647899 | Purchase | 3 | 1 | 2026-04-09 06:30:22 | 2026-04-09 06:30:23 | 202604080647899_Purchase_1775622629255 |
| 202604080663354 | Purchase | 3 | 1 | 2026-04-09 06:30:17 | 2026-04-09 06:30:19 | 202604080663354_Purchase_1775632887149 |
| 202604080934454 | Purchase | 3 | 1 | 2026-04-09 06:30:17 | 2026-04-09 06:30:18 | 202604080934454_Purchase_1775634066248 |
| 202604081158249 | Purchase | 3 | 1 | 2026-04-09 06:30:30 | 2026-04-09 06:30:31 | 202604081158249_Purchase_1775608873723 |
| 202604081302070 | Purchase | 3 | 1 | 2026-04-09 06:30:31 | 2026-04-09 06:30:33 | 202604081302070_Purchase_1775607760848 |
| 202604081306921 | Purchase | 3 | 1 | 2026-04-09 06:30:14 | 2026-04-09 06:30:14 | 202604081306921_Purchase_1775639549214 |
| 202604081483354 | Purchase | 3 | 1 | 2026-04-09 06:30:18 | 2026-04-09 06:30:20 | 202604081483354_Purchase_1775630091011 |
| 202604081564456 | Purchase | 3 | 1 | 2026-04-09 06:30:29 | 2026-04-09 06:30:31 | 202604081564456_Purchase_1775609727455 |
| 202604081576544 | Purchase | 3 | 1 | 2026-04-09 06:30:24 | 2026-04-09 06:30:25 | 202604081576544_Purchase_1775618946602 |
| 202604081755377 | Purchase | 3 | 1 | 2026-04-09 06:30:13 | 2026-04-09 06:30:13 | 202604081755377_Purchase_1775641915854 |
| 202604081757270 | Purchase | 3 | 1 | 2026-04-09 06:30:23 | 2026-04-09 06:30:25 | 202604081757270_Purchase_1775620889802 |
| 202604082082451 | Purchase | 3 | 1 | 2026-04-09 06:30:11 | 2026-04-09 06:30:11 | 202604082082451_Purchase_1775646599822 |
| 202604082097593 | Purchase | 3 | 1 | 2026-04-09 06:30:12 | 2026-04-09 06:30:12 | 202604082097593_Purchase_1775644757811 |
| 202604082233552 | Purchase | 3 | 1 | 2026-04-09 06:30:20 | 2026-04-09 06:30:22 | 202604082233552_Purchase_1775625438400 |
| 202604082269722 | Purchase | 3 | 1 | 2026-04-09 06:30:25 | 2026-04-09 06:30:27 | 202604082269722_Purchase_1775616665052 |
| 202604082341660 | Purchase | 3 | 1 | 2026-04-09 06:30:33 | 2026-04-09 06:30:34 | 202604082341660_Purchase_1775606607933 |
| 202604082346447 | Purchase | 3 | 1 | 2026-04-09 06:30:23 | 2026-04-09 06:30:24 | 202604082346447_Purchase_1775621067807 |
| 202604082611328 | Purchase | 3 | 1 | 2026-04-09 06:30:08 | 2026-04-09 06:30:08 | 202604082611328_Purchase_1775658547387 |
| 202604082974765 | Purchase | 3 | 1 | 2026-04-09 06:30:16 | 2026-04-09 06:30:18 | 202604082974765_Purchase_1775634483364 |


해석:

- 같은 event_id가 2-3회 반복 전송된 그룹이다.
- 단순 재시도 또는 과거 auto_sync 반복 실행일 수 있다.
- event_id가 같아도 같은 채널 CAPI-CAPI 중복을 Meta가 항상 안전하게 줄인다고 단정하면 안 된다.
- 그래도 multi-event-id 그룹보다 위험도는 낮다. 먼저 Events Manager에서는 multi-event-id 주문을 본 뒤, retry-like 상위 주문을 샘플 확인한다.

## TJ님이 Events Manager에서 확인할 것

Meta 광고관리자 캠페인 표가 아니라 **Meta Events Manager**에서 확인해야 한다.

1. Meta Business / Events Manager로 이동한다.
2. Pixel 또는 Dataset에서 pixel_id `1283400029487161`를 찾는다.
3. 최근 이벤트 또는 Purchase 이벤트 상세에서 위 orderId/event_id를 검색한다. 검색이 안 되면 해당 sent KST 시각 전후 5분의 Purchase 이벤트를 연다.
4. 주문 1건에 Purchase가 몇 개 잡혔는지 확인한다.
5. Browser Pixel과 Server CAPI가 둘 다 있다면 event_id가 같은지 확인한다.
6. CAPI-CAPI 또는 Pixel-Pixel처럼 같은 채널 안에서 Purchase가 여러 번 잡혔는지 확인한다.
7. 확인 결과를 스크린샷으로 남긴다. 특히 event_id, event_name, action_source, event_time, dedup 상태가 보이면 좋다.

## 다음 개발 액션

- post-fix 구간에서 multi-event-id risk가 0인지 매일 snapshot으로 남긴다.
- retry-like 그룹이 계속 생기면 auto_sync 실행 이력과 lock/guard를 추가 점검한다.
- Events Manager 확인 결과 multi-event-id 주문이 실제 Meta purchase 중복으로 잡히면, orderId/paymentKey+eventName 기준 성공 전송 차단 규칙을 더 강하게 적용한다.
