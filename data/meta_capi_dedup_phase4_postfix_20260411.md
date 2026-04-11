# Meta CAPI Dedup Phase 4 Report

작성 시각: 2026-04-11 16:21:22 KST

## 결론

- Events Manager 확인은 Meta 계정 로그인, Pixel/Dataset 접근, 2FA가 필요한 외부 화면 작업이다. Codex가 로컬에서 직접 볼 수 있는 영역은 아니다.
- Codex가 바로 할 수 있는 일은 우리 서버가 Meta로 보낸 CAPI 전송 로그와 자체 attribution ledger를 조인해서, Events Manager에서 확인할 주문 샘플을 좁히는 것이다.
- 이 리포트는 그 로컬 분석 결과다. 반복 전송은 **우리 솔루션 -> Meta CAPI** 방향의 전송 로그를 뜻한다. Meta가 우리에게 다시 보낸 로그가 아니다.

## 분석 범위

- 로그 scope: operational only
- 응답 상태: 2xx success only
- 기본 기간: 최근 3일
- since override: 2026-04-10T00:00:00+09:00
- until override: -

## 요약

| 지표 | 값 |
|---|---:|
| CAPI success rows | 204 |
| CAPI failure rows | 0 |
| unique event_id | 113 |
| duplicate event_id groups | 53 |
| duplicate event_id rows | 91 |
| unique order+event keys | 113 |
| duplicate order+event groups | 53 |
| retry-like groups, same event_id | 53 |
| retry-like rows, same event_id | 144 |
| multi-event-id risk groups | 0 |
| multi-event-id risk rows | 0 |

## 위험 후보: 같은 주문+이벤트인데 event_id가 다른 그룹

없음




## retry-like 후보: 같은 주문+이벤트+event_id 반복 그룹

| orderId | event | rows | unique event_id | first sent KST | last sent KST | event_id sample |
|---|---|---:|---:|---|---|---|
| 202604100435440 | Purchase | 3 | 1 | 2026-04-11 00:21:03 | 2026-04-11 00:21:03 | 202604100435440_Purchase_1775779856000 |
| 202604100485707 | Purchase | 3 | 1 | 2026-04-11 00:21:00 | 2026-04-11 00:21:01 | 202604100485707_Purchase_1775789327000 |
| 202604100617213 | Purchase | 3 | 1 | 2026-04-11 00:21:01 | 2026-04-11 00:21:02 | 202604100617213_Purchase_1775783566000 |
| 202604101109000 | Purchase | 3 | 1 | 2026-04-11 00:20:54 | 2026-04-11 00:20:54 | 202604101109000_Purchase_1775825751000 |
| 202604101119641 | Purchase | 3 | 1 | 2026-04-11 00:20:54 | 2026-04-11 00:20:54 | 202604101119641_Purchase_1775804865000 |
| 202604101193543 | Purchase | 3 | 1 | 2026-04-11 00:20:54 | 2026-04-11 00:20:54 | 202604101193543_Purchase_1775831661000 |
| 202604101203677 | Purchase | 3 | 1 | 2026-04-11 00:21:05 | 2026-04-11 00:21:05 | 202604101203677_Purchase_1775776689000 |
| 202604101572486 | Purchase | 3 | 1 | 2026-04-11 00:21:05 | 2026-04-11 00:21:06 | 202604101572486_Purchase_1775775410000 |
| 202604101701337 | Purchase | 3 | 1 | 2026-04-11 00:20:55 | 2026-04-11 00:20:56 | 202604101701337_Purchase_1775802871000 |
| 202604101728664 | Purchase | 3 | 1 | 2026-04-11 00:20:57 | 2026-04-11 00:20:57 | 202604101728664_Purchase_1775798634000 |
| 202604101871583 | Purchase | 3 | 1 | 2026-04-11 00:21:01 | 2026-04-11 00:21:01 | 202604101871583_Purchase_1775786393000 |
| 202604101924474 | Purchase | 3 | 1 | 2026-04-11 00:20:55 | 2026-04-11 00:20:55 | 202604101924474_Purchase_1775804248000 |
| 202604102354644 | Purchase | 3 | 1 | 2026-04-11 00:20:53 | 2026-04-11 00:20:53 | 202604102354644_Purchase_1775832368000 |
| 202604102452336 | Purchase | 3 | 1 | 2026-04-11 00:21:02 | 2026-04-11 00:21:03 | 202604102452336_Purchase_1775780048000 |
| 202604102465935 | Purchase | 3 | 1 | 2026-04-11 00:21:00 | 2026-04-11 00:21:01 | 202604102465935_Purchase_1775787754000 |
| 202604102688654 | Purchase | 3 | 1 | 2026-04-11 00:20:56 | 2026-04-11 00:20:56 | 202604102688654_Purchase_1775799327000 |
| 202604102861674 | Purchase | 3 | 1 | 2026-04-11 00:20:57 | 2026-04-11 00:20:58 | 202604102861674_Purchase_1775795784000 |
| 202604102907321 | Purchase | 3 | 1 | 2026-04-11 00:20:56 | 2026-04-11 00:20:56 | 202604102907321_Purchase_1775798908000 |
| 202604103228654 | Purchase | 3 | 1 | 2026-04-11 00:20:57 | 2026-04-11 00:20:57 | 202604103228654_Purchase_1775798549000 |
| 202604103297484 | Purchase | 3 | 1 | 2026-04-11 00:21:01 | 2026-04-11 00:21:02 | 202604103297484_Purchase_1775785739000 |


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
