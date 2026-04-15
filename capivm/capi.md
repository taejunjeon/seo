# Meta Purchase / CAPI 정합성 운영 계획

최종 업데이트: 2026-04-12 21:52 KST

## 현재 결론

자사몰 카드 결제와 자사몰 가상계좌 미입금의 핵심 정합성 작업은 1차 완료로 본다.

```text
카드 결제 confirmed:
Browser Pixel Purchase 전송 확인
event_id = Purchase.{아임웹 order_code}
서버 판정 = confirmed / allow_purchase

가상계좌 미입금 pending:
Browser Pixel Purchase 차단 확인
VirtualAccountIssued 전송 확인
서버 판정 = pending / block_purchase_virtual_account

운영 backend:
https://att.ainativeos.net -> GCP VM backend
CAPI auto-sync ON
Attribution status sync ON
노트북 backend/tunnel 의존 제거
```

이제 이 작업의 핵심 목적은 “Meta Purchase를 실제 결제 완료 기준에 가깝게 만든다”이다. 즉, Meta ROAS 과대 원인 중 하나였던 **가상계좌 미입금 주문의 Browser Purchase 오염**은 자사몰 흐름에서 1차 차단됐다.

## 기준 스냅샷

이 문서에서 말하는 “post-server-decision-guard 이후”의 기준점은 아래 테스트가 끝난 시점부터로 잡는다.

```text
스냅샷 기록 시각: 2026-04-12 21:52 KST
운영 endpoint: https://att.ainativeos.net
origin: GCP VM backend
guard: biocom-server-payment-decision-guard v3
```

마지막 확인 주문:

| 구분 | 관측 시각 KST | 관측 시각 UTC | 주문 | Meta 이벤트 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 카드 결제 confirmed | 2026-04-12 11:46:34 | 2026-04-12 02:46:34 | `o2026041258d9051379e47 / 202604127697550` | `ev=Purchase`, `eid=Purchase.o2026041258d9051379e47`, HTTP 200 | confirmed / allow_purchase |
| 가상계좌 미입금 pending | 2026-04-12 11:48:23 | 2026-04-12 02:48:23 | `o20260412cdb6664e94ccb / 202604126682764` | `ev=VirtualAccountIssued`, `eid=VirtualAccountIssued.o20260412cdb6664e94ccb`, HTTP 200 | pending / block_purchase_virtual_account |

Server CAPI 최신 확인:

| 구분 | 확인 시각 KST | 최신 CAPI 전송 시각 KST | 최신 CAPI 전송 시각 UTC | 최신 send_path | 결과 |
| --- | --- | --- | --- | --- | --- |
| `GET /api/meta/capi/log?limit=5` | 2026-04-12 21:52 | 2026-04-12 20:56:16 | 2026-04-12 11:56:16 | `auto_sync` | total 897 / success 897 / failure 0 |

운영 해석:

```text
2026-04-12 11:48 KST 이후 구간은
자사몰 카드/가상계좌 Browser Pixel 정합성 보정 이후 구간으로 분리해서 본다.
그 이전 Meta ROAS에는 가상계좌 미입금 Purchase 오염이 섞였을 가능성이 있다.
```

## 왜 필요한가

기존 문제는 단순했다.

```text
Meta Browser Pixel:
주문완료 페이지에 도착하면 가상계좌 미입금도 Purchase로 볼 수 있음

우리 Attribution ROAS:
confirmed 주문, 즉 카드 승인 또는 가상계좌 입금 확인이 끝난 주문만 매출로 봄
```

그래서 가상계좌 미입금이 Browser Purchase로 잡히면 Meta ROAS는 높아지고, 내부 Attribution ROAS와 차이가 커진다. 이 차이는 attribution window 차이와 별개로 “이벤트 정의가 다름”에서 생기는 구조적 문제다.

## 현재 적용된 방향

주문완료 페이지에서 브라우저가 결제 상태를 추측하지 않는다. 서버에 묻고, 서버가 결제 상태를 판정한다.

```text
주문완료 URL의 order_no / order_code / payment_code / paymentKey
-> https://att.ainativeos.net/api/attribution/payment-decision 조회
-> 서버가 Toss API + 로컬 Attribution 원장 기준으로 결제 상태 판정
-> confirmed면 Browser Purchase 허용
-> pending 가상계좌면 Purchase 차단 후 VirtualAccountIssued 전송
-> canceled/unknown이면 Purchase 차단 또는 보수 이벤트로 분리
```

현재 `att.ainativeos.net`는 VM에서 동작한다. 노트북이 잠자기 모드여도 endpoint와 CAPI auto-sync는 계속 돈다.

## 완료된 것

### 1. 서버 endpoint 안정화

완료:

```text
GET https://att.ainativeos.net/api/attribution/payment-decision
```

확인값:

```text
order_no=202604126682764
order_code=o20260412cdb6664e94ccb
decision.status=pending
decision.browserAction=block_purchase_virtual_account
matchedBy=toss_direct_order_id
```

운영 health:

```text
https://att.ainativeos.net/health
status=ok
backgroundJobs.capiAutoSync.enabled=true
backgroundJobs.attributionStatusSync.enabled=true
backgroundJobs.cwvAutoSync.enabled=false
```

### 2. VM active origin 전환

완료:

```text
VM: instance-20260412-035206
Zone: asia-northeast3-a
External IP: 34.64.104.94
Process: PM2 seo-backend + seo-cloudflared
Tunnel: att.ainativeos.net -> VM localhost:7020
```

로컬 노트북의 `backend:7020`, `cloudflared`, `ngrok` 프로세스는 종료 확인됐다. 따라서 현재 CAPI sync가 노트북과 VM에서 동시에 도는 상태는 아니다.

상세 배포 문서:

- [vmdeploy.md](/Users/vibetj/coding/seo/capivm/vmdeploy.md)

### 3. 자사몰 카드 결제 확인

최종 확인 주문:

```text
order_code=o2026041258d9051379e47
order_no=202604127697550
payment_code=pa2026041212316cefc7e1c
```

확인값:

```text
Meta request: ev=Purchase
Status: 200 OK
event_id: Purchase.o2026041258d9051379e47
value: 39000
currency: KRW
payment_decision_status: confirmed
payment_decision_reason: toss_direct_api_status
```

판정:

```text
카드 confirmed 주문은 Browser Purchase가 정상 발화한다.
```

### 4. 자사몰 가상계좌 미입금 확인

최종 확인 주문:

```text
order_code=o20260412cdb6664e94ccb
order_no=202604126682764
payment_code=pa20260412ae31f94d1edab
```

확인값:

```text
Meta request: ev=VirtualAccountIssued
Status: 200 OK
event_id: VirtualAccountIssued.o20260412cdb6664e94ccb
value: 35000
currency: KRW
payment_decision_status: pending
payment_decision_reason: toss_direct_api_status
original_purchase_event_id: Purchase.o20260412cdb6664e94ccb
```

판정:

```text
가상계좌 미입금 주문은 Browser Purchase로 잡히지 않고 VirtualAccountIssued로 내려간다.
```

### 5. Server CAPI 정책

현재 원칙:

```text
confirmed 주문만 Server CAPI Purchase 전송
pending 가상계좌는 Server CAPI Purchase 전송 제외
Purchase event_id = Purchase.{아임웹 order_code} 우선
```

최신 CAPI log endpoint:

```text
GET https://att.ainativeos.net/api/meta/capi/log?limit=5
```

최근 확인값:

```text
total=897
success=897
failure=0
latest send_path=auto_sync
latest timestamp=2026-04-12T11:56:16.685Z
latest timestamp KST=2026-04-12 20:56:16
```

## 아직 남은 것

### 1. 가상계좌 입금 후 confirmed 전환 테스트

아직 확인하지 않은 중요한 케이스가 있다.

```text
가상계좌 발급 직후:
pending
Browser Purchase 없음
VirtualAccountIssued 있음

실제 입금 후:
confirmed로 전환되어야 함
Server CAPI Purchase가 1회 전송되어야 함
Browser Purchase는 추가로 만들 수 없으므로 서버 CAPI가 정식 Purchase 역할을 해야 함
```

필요한 이유:

```text
지금까지는 "미입금 가상계좌가 Meta Purchase를 오염시키지 않는지"를 검증했다.
하지만 실제 입금 완료 후에는 정식 매출이므로 Attribution confirmed와 Server CAPI Purchase에 반영되어야 한다.
이 전환이 안 되면 Meta ROAS는 과대가 아니라 과소로 흔들릴 수 있다.
```

검증 대상 주문:

```text
order_code=o20260412cdb6664e94ccb
order_no=202604126682764
payment_code=pa20260412ae31f94d1edab
order_id=202604126682764-P1
현재 상태=pending / VirtualAccountIssued 확인 완료
```

검증 순서:

```text
1. TJ님이 해당 가상계좌 주문을 실제 입금 처리한다.
2. Toss 또는 아임웹에서 결제 상태가 DONE/paid/confirmed로 바뀌는지 확인한다.
3. backend의 attribution status sync가 원장을 pending에서 confirmed로 바꾸는지 확인한다.
4. CAPI auto-sync가 해당 주문을 Server Purchase로 1회 보내는지 확인한다.
5. event_id는 Purchase.o20260412cdb6664e94ccb 형태인지 확인한다.
6. 같은 주문에 서로 다른 Purchase event_id가 생기지 않는지 확인한다.
```

완료 기준:

```text
Attribution status=confirmed
Server CAPI ev=Purchase
event_id=Purchase.o20260412cdb6664e94ccb
send_path=auto_sync
response_status=200
중복 event_id 위험 없음
```

이 테스트는 TJ님이 실제 입금을 해야 시작할 수 있다. 입금 전까지는 제가 로그만 봐도 confirmed 전환을 만들 수 없다.

### 2. 네이버페이

네이버페이는 이번 자사몰 Browser Pixel guard와 별개 문제다.

테스트 결과:

```text
네이버페이 주문번호: 2026041289545040
최종 URL: https://orders.pay.naver.com/order/result/mall/2026041289545040
Pixel Helper: No Pixels found on this page
Network ev=Purchase: 없음
```

판정:

```text
네이버페이는 Browser Pixel로 해결하지 않는다.
결제 완료 후 biocom.kr 주문완료 페이지로 돌아오지 않으면 우리 헤더/푸터 코드가 실행되지 않는다.
따라서 네이버페이는 Server CAPI confirmed-only 경로로 별도 처리해야 한다.
```

다음에 할 일:

```text
1. 아임웹 주문 API 또는 로컬 주문 캐시에서 네이버페이 주문이 confirmed로 잡히는지 확인
2. 네이버페이 주문의 안정 키를 정함
3. CAPI auto-sync 대상에 네이버페이 confirmed 주문 포함
4. 가능하면 아임웹/네이버페이 설정에서 결제 완료 후 biocom.kr returnUrl 지원 여부 확인
```

지금 바로 할 필요는 낮다. 네이버페이 비중과 확인 가능한 주문 상태를 먼저 봐야 한다.

### 3. 24시간 운영 모니터링

자사몰 카드/가상계좌 단건 테스트는 통과했다. 다음은 반복 테스트가 아니라 실제 운영 로그 확인이다.

볼 것:

```text
1. 가상계좌 pending이 Server CAPI Purchase로 나가지 않는지
2. Browser Purchase가 confirmed 주문 위주로 남는지
3. VirtualAccountIssued가 필요 이상으로 많이 쌓이지 않는지
4. payment-decision unknown 비율이 높은지
5. CAPI failure가 없는지
6. 같은 order_code에 서로 다른 Purchase event_id가 생기지 않는지
```

### 4. ROAS 비교 구간 분리

2026-04-12 guard + VM 컷오버 이후 구간은 이전 구간과 분리해서 봐야 한다.

```text
pre-guard:
가상계좌 미입금 Browser Purchase 오염 가능
노트북/tunnel 운영 의존 가능

post-server-decision-guard:
자사몰 confirmed/pending 분리
VM active origin
CAPI/Attribution 자동 sync 안정화
```

앞으로 Meta ROAS와 Attribution ROAS의 차이를 다시 볼 때는 최소 24시간, 가능하면 7일을 `post-server-decision-guard` 구간으로 따로 잘라 본다.

## TJ님이 지금 할 일

지금 당장 필수로 해야 할 일은 하나만 있다.

하면 좋은 일은 아래 정도다.

```text
1. 위 가상계좌 테스트 주문을 실제 입금 처리
2. 입금 완료 시각을 기록
3. 아임웹 헤더 상단 코드가 현재 서버형 guard 최신본인지 유지
4. 추가 테스트 주문 남발하지 않기
5. 네이버페이 설정 화면에서 결제 완료 후 returnUrl/복귀 URL 설정이 있는지만 나중에 확인
6. VM 비용/인스턴스가 계속 켜져 있어도 되는지 운영 관점에서 승인
```

현재 단계에서 TJ님이 직접 할 가능성이 큰 작업은 가상계좌 입금 처리다. 이건 실제 결제 상태 전환이 필요한 테스트라서 로컬 코드만으로 대체할 수 없다.

## 내가 다음에 할 일

우선순위는 아래다.

```text
1. 가상계좌 입금 후 해당 주문이 confirmed로 전환되는지 확인
2. 전환 후 Server CAPI Purchase가 1회 전송되는지 확인
3. 24시간 운영 로그 기준으로 post-guard CAPI/Purchase 정합성 리포트 생성
4. unknown decision 비율 확인
5. 네이버페이 주문이 local imweb_orders / Attribution ledger / CAPI 후보에 어떻게 잡히는지 분석
6. data/roasphase.md에 post-server-decision-guard 구간을 반영
7. 필요하면 /ads 또는 내부 진단 화면에 decision unknown / VirtualAccountIssued 지표 추가
```

## 지금 하지 않을 것

- 가상계좌 테스트 주문 반복 생성
- 카드 테스트 주문 반복 생성
- 네이버페이를 Browser Pixel로 억지 해결
- Meta Events Manager UI에 오래 매달리기
- 운영 DB 스키마 변경
- 운영 DB 직접 수정
- `meta/metareport.md` 추가 수정
- VM backend를 Next.js로 전환

## 완료 기준

Meta Purchase 1차 정합성은 아래 기준으로 완료 처리한다.

```text
자사몰 가상계좌 미입금:
Browser Purchase 없음
VirtualAccountIssued 있음

자사몰 카드 결제:
Browser Purchase 있음
event_id = Purchase.{order_code}

Server CAPI:
confirmed만 Purchase
event_id = Purchase.{order_code}

가상계좌 입금 완료:
pending -> confirmed 전환 확인
Server CAPI Purchase 1회 전송 확인
event_id = Purchase.{order_code}

인프라:
att.ainativeos.net이 VM backend로 응답
노트북/tunnel 의존 없음
```

네이버페이는 별도 Phase로 둔다. 네이버페이가 완료되지 않았다고 해서 자사몰 카드/가상계좌 Purchase guard 완료를 미완료로 되돌리지는 않는다.

## 관련 파일

- [VM 배포 결과](/Users/vibetj/coding/seo/capivm/vmdeploy.md)
- [네이버페이 검토](/Users/vibetj/coding/seo/capivm/naverpay.md)
- [서버형 Guard v3](/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412_v3.md)
- [CAPI 3차 결과](/Users/vibetj/coding/seo/capivm/capi3reply.md)
- [CAPI 4차 결과](/Users/vibetj/coding/seo/capivm/capi4reply.md)
- [ROAS Phase](/Users/vibetj/coding/seo/data/roasphase.md)
