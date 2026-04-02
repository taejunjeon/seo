핵심 결론부터 말씀드리면, **가능합니다. 꽤 많이 남아 있습니다.**
지금 문서 기준으로도 `P1-S1` 실험 장부와 `P1-S2` 운영 화면은 로컬 검증 기준으로 이미 닫혀 있고, 현재 진짜 병목은 `P1-S1A`에서 **실제 고객 사이트가 `checkout-context`, `payment-success`를 아직 호출하지 않는 것**입니다. 즉, 막힌 지점은 “운영 DB를 못 고쳐서”라기보다 **실제 결제 흐름 코드와 receiver를 아직 연결하지 못해서**에 더 가깝습니다. 

그리고 로드맵 문서에는 이미 **운영 DB 반영 없이도** `read-only source -> local shadow target` 방식으로 실험 원장을 계속 돌릴 수 있다고 정리돼 있습니다. 실제로 shadow 검증, 로컬 SQLite, JSONL 원장, `/crm` 화면, conversion sync 흐름까지는 다 준비돼 있습니다. 

다만 한 가지는 분명히 말씀드리겠습니다.
**이 대화에서는 제가 TJ님 로컬 PC나 private git를 직접 열어보지는 못했습니다.** 그래서 아래 판단은 업로드된 문서 기준입니다. 그래도 지금 상태만으로도 다음 액션 우선순위는 꽤 선명합니다.

## 10초 요약

* **운영 DB write 없이도 할 수 있는 일은 많습니다.** 특히 `실제 결제 코드 경로 파악`, `receiver 삽입 패치 준비`, `read-only DB 기반 shadow/backfill`, `브라우저/GA4/PG 진단`은 바로 가능합니다.
* 반대로 **로컬만으로 끝까지 못 닫는 일**은 `실제 고객 트래픽으로 live row 적재`, `운영 배포`, `정식 DB ledger 승격`입니다. 이건 여전히 운영 반영이 필요합니다. 

## 원인 3가지

### 1) 지금 병목은 DB보다 “마지막 배선”입니다

무슨 일인지: 문서상 receiver, JSONL 원장, 토스 조인 진단, `/crm` 진단 화면은 이미 있습니다.
왜 문제인지: 그런데 실제 고객 사이트가 아직 그 receiver를 호출하지 않아서 live row가 0입니다.
결과 영향: `(not set)` 원인을 추정은 할 수 있어도, 실증은 못 닫습니다.

### 2) TJ님이 가진 새 조건 때문에 로컬 작업 범위가 넓어졌습니다

무슨 일인지: 지금은 운영 DB 코드가 로컬에 있고, git 접근도 가능하고, 운영 DB 읽기도 된다고 하셨습니다.
왜 문제인지: 이 조건이면 이제 “실제 checkout 시작점, payment success 진입점이 어딘지 모른다”는 상태에서 벗어나 **코드 경로 추적과 패치 준비**를 할 수 있습니다.
결과 영향: 운영 DB write가 없어도 `integration-ready` 수준까지는 올릴 수 있습니다.
이 부분은 문서와 TJ님의 추가 설명을 합친 **제 판단**입니다.

### 3) 이미 shadow 구조가 있으니, 배포 전 검증 밀도를 더 올릴 수 있습니다

무슨 일인지: 문서에 이미 로컬 SQLite, shadow DB, JSONL ledger, conversion sync가 정리돼 있습니다.
왜 문제인지: 이걸 더 안 쓰고 바로 운영 반영만 기다리면, 배포 전에 줄일 수 있는 시행착오를 그대로 운영에 넘기게 됩니다.
결과 영향: 지금 로컬에서 더 할수록 운영 cutover 리스크가 줄어듭니다. 

## 지금 로컬에서 더 가능한 일

제가 보기엔 **우선순위 높은 일 5개**가 있습니다.
핵심은 “새 기능 추가”가 아니라 **실제 사이트 코드와 현재 Phase 1 장치를 연결할 준비를 끝내는 것**입니다. 🔧

### 1) 실제 결제 코드 경로를 먼저 지도처럼 그리기

이게 1순위입니다.
문서 기준 blocker는 “실제 고객 사이트 checkout/payment success 코드가 workspace 밖에 있다”는 점이었는데, 이제 그 코드가 로컬에 있으니 이 병목을 바로 깰 수 있습니다. 

찾아야 할 것:

* checkout 시작 함수
* PG 결제 요청 함수
* success URL 페이지 또는 callback handler
* server-side payment confirm 로직
* purchase 이벤트 발화 위치
* GA4/GTM 이벤트 발화 위치
* `orderId`, `paymentKey`, `approvedAt`가 처음/마지막으로 잡히는 지점

로컬 repo에서 먼저 찾을 문자열은 이 정도면 충분합니다.

```bash
rg -n "successUrl|payment-success|checkout-context|paymentKey|orderId|approvedAt|confirmPayment|toss|nice|begin_checkout|purchase" .
rg -n "gtag\\(|dataLayer\\.push|begin_checkout|purchase|transaction_id" .
rg -n "fbclid|gclid|ttclid|utm_|ga_session_id|landing|referrer|referer" .
```

이 작업은 **운영 DB 변경이 전혀 필요 없습니다.**

### 2) receiver 삽입 패치를 로컬에서 먼저 만들어 두기

현재 문서상 `POST /api/attribution/checkout-context`, `POST /api/attribution/payment-success`, `GET /api/attribution/ledger`, `GET /api/attribution/toss-join`, `GET /api/crm-phase1/ops`는 이미 있습니다. 즉 **받는 쪽은 거의 준비 끝**입니다. 

그래서 지금 할 일은:

* checkout 시작 시 `checkout-context` 호출
* payment success 시 `payment-success` 호출
* 실패/중복 대비 idempotency key 부여
* feature flag로 on/off 가능하게 만들기
* payload schema 고정
* local/staging env에서만 먼저 켜기

여기서 중요한 건 **운영 DB에 쓰지 않아도 된다**는 점입니다. 지금 구조는 JSONL이나 local shadow로도 충분히 검증 가능합니다. 

### 3) read-only 운영 DB를 이용한 “replay/backfill shadow”를 만들기

이건 생각보다 가치가 큽니다.

문서에는 `P1-S1` 쪽에서 이미 **read-only source -> local shadow target**이 가능하다고 적혀 있습니다. 같은 발상으로 `P1-S1A`도 일부 확장할 수 있습니다. 

구체적으로는:

* 최근 `tb_sales_toss` 승인건을 읽음
* `orderId/paymentKey/approvedAt` 기준으로 로컬 shadow ledger에 `payment_success` 후보 row를 적재
* source를 `live`가 아니라 `replay` 또는 `db_backfill`로 표시
* 조인 성공률, 누락 패턴, 시간대 분포를 먼저 봄

이 방식의 장점:

* live proof는 아니어도 **조인 plumbing**은 크게 검증 가능
* `/crm` 화면이 실제에 가까운 데이터 볼륨에서 버티는지 확인 가능
* 운영 배포 전에 어떤 필드가 더 필요한지 드러남

단점도 분명합니다:

* 원래 유입채널 복원은 안 됩니다
* `checkout-context`가 없으니 `landing`, `utm`, `ga_session_id` 같은 앞단 정보는 일부 비어 있을 수 있습니다

즉, **원인 확정용이 아니라 배선 점검용**입니다.

### 4) GA4/브라우저/PG 진단을 로컬에서 더 밀어붙이기

문서에도 `GA4 DebugView`와 실결제 브라우저 검증이 아직 안 됐다고 적혀 있습니다. 
이건 운영 DB랑 거의 무관합니다. 지금 바로 할 수 있습니다.

확인 포인트:

* `begin_checkout -> purchase`가 같은 세션에서 이어지는지
* cross-domain 설정에 실제 결제 관련 도메인이 다 들어가 있는지
* purchase 이벤트가 success page에서 나는지, server callback에서만 나는지
* success redirect 이후 source/session 귀속이 끊기는지
* `transaction_id` 중복/누락이 있는지

이건 **코드 + 브라우저 + GA4 설정** 문제라서 DB write보다 훨씬 먼저 확인해야 합니다.

### 5) 운영 cutover용 산출물을 로컬에서 완성하기

이건 덜 화려하지만 중요합니다.

지금 문서에 이미 구현 위치가 꽤 구체적으로 정리돼 있습니다. 예를 들면:

* 실험 장부 DB/API
* attribution / toss join
* phase1 진단 집계
* `/crm` 화면 위치 등이 문서에 명시돼 있습니다.

그래서 로컬에서 미리 만들어 둘 수 있는 것:

* 운영 배포용 patch diff
* feature flag 설계서
* DDL 초안과 backfill 절차
* 테스트 시나리오 문서
* rollback 기준
* “live row 1건 들어오면 무엇을 볼지” 체크리스트

이걸 미리 해두면 개발팀 handoff 품질이 훨씬 좋아집니다.

## 여전히 로컬만으로는 안 되는 것

여기는 선을 그어야 합니다.

1. **실제 고객 트래픽에서 live row 적재**

   * 문서상 현재 핵심 blocker가 바로 이것입니다. 

2. **`(not set) = PG 직결` 최종 확정**

   * 지금은 유력 가설이지 확정 사실은 아닙니다. 문서도 그렇게 적고 있습니다.

3. **운영 DB 정식 ledger 승격**

   * JSONL/local shadow로 검증은 가능해도, 운영 기준 source of truth는 결국 정식 반영이 필요합니다. 

즉, 현실적으로 보면
**로컬에서 70-80%는 더 갈 수 있지만, 마지막 20-30%는 배포와 운영 검증이 필요합니다.**

## 제 추천 실행 순서

### 지금 당장

1. 실제 고객 사이트 repo에서 checkout 시작점, success 진입점, purchase 이벤트 위치를 찾습니다.
2. receiver 호출 패치를 feature flag 형태로 만듭니다.
3. read-only DB 기반 `replay/backfill shadow` 스크립트를 만듭니다.

### 이번 주

1. local 또는 staging에서 receiver가 실제 row를 남기게 합니다.
2. `/crm` 결제 귀속 탭에 `live / replay / smoke` 구분을 넣습니다.
3. 토스 recent sample 기준 조인율, 미조인 사유, 중복률을 다시 봅니다.

### 다음 배치

1. 공개 dev URL이나 터널로 실제 결제 성공 흐름 1건을 태웁니다.
2. 그 다음 운영 반영 요청을 넣습니다.
3. 운영 반영 뒤에는 “row가 들어왔는가”보다 “조인 품질이 충분한가”를 먼저 봅니다.

## 전체적인 피드백

제가 냉정하게 보면, 현재 로드맵의 큰 방향은 맞습니다.
하지만 문서 표현이 약간 **“운영 DB 못 고치면 거의 멈춤”**처럼 읽히는 부분이 있습니다. 실제로는 그렇지 않습니다.

더 정확한 표현은 이겁니다.

* `P1-S1`은 이미 local shadow로 더 밀 수 있다. 
* `P1-S2`도 화면 자체는 거의 닫혔다. 
* **지금 진짜 병목은 P1-S1A의 마지막 1cm 연결**, 즉 실제 결제 코드와 receiver의 연결이다. 

그래서 우선순위는:

* 대시보드 더 꾸미기
* 새 분석 화면 추가
* AI 에이전트 붙이기

이런 것보다 먼저,

* 실제 checkout/success 코드 경로 파악
* receiver 패치 준비
* replay/backfill shadow
* 브라우저/GA4 진단

이 4개를 끝내는 게 맞습니다.

정리하면,
**운영 DB 수정이 없어서 못 하는 일보다, 로컬에서 지금 당장 더 할 수 있는데 아직 안 한 일이 더 많습니다.**

검토한 업로드 파일은 여기입니다: [Phase 1 메모](sandbox:/mnt/data/%EB%B6%99%EC%97%AC%EB%84%A3%EC%9D%80%20%EB%A7%88%ED%81%AC%EB%8B%A4%EC%9A%B4%281%29.md)

Q1. 실제 고객 사이트 repo에서 **checkout 시작 함수, success URL 페이지, payment confirm API, GA4 purchase 발화 코드** 4개만 보내주실 수 있나요? 그럼 제가 삽입 포인트를 거의 확정해드릴 수 있습니다.
Q2. 로컬이나 staging를 **공개 dev URL 또는 터널**로 외부에서 받을 수 있나요? 가능하면 P1-S1A는 운영 DB 수정 없이도 거의 끝까지 검증 가능합니다.
Q3. read-only DB에서 `tb_sales_toss` 말고 **checkout 세션, 주문 생성, utm/referrer, access log성 테이블**이 있는지 확인 가능할까요? 있으면 replay/backfill 품질이 크게 올라갑니다.
