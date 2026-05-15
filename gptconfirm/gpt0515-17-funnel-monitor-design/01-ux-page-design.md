# 01. UX Page Design

작성 시각: 2026-05-15 KST

## 화면의 질문

오늘 전환 신호가 어디서 새고 있는가?

이 질문에 30초 안에 답해야 한다.

## 첫 화면 구조

### 1. 상단 판단 바

목적: 사용자가 화면을 열자마자 조치 필요 여부를 알게 한다.

표시:

- 상태 배지: `정상`, `주의`, `긴급`
- 가장 큰 누락 지점 1개
- 지금 할 일 1개
- 기준 시각
- source freshness

예시 문구:

```text
주의: 결제완료는 들어오지만 Browser Purchase가 약합니다.
지금 할 일: 완료 URL에서 payment-decision 200과 Meta Purchase 네트워크를 확인하세요.
기준: 2026-05-15 14:30 KST · source: VM Cloud attribution_ledger + Meta CAPI send log
```

### 2. 기간/사이트 컨트롤

컨트롤:

- 사이트 탭: `바이오컴`, `더클린커피`
- 기간: `오늘`, `어제`, `최근 7일`, `최근 14일`, `최근 30일`, `사용자 지정`
- 집계 단위: `일별`, `주별`
- 결제수단 필터: `전체`, `카드`, `NPay`, `가상계좌/무통장`, `기타`
- 유입 필터: `전체`, `Meta`, `Google`, `Naver`, `Organic`, `Direct`, `UTM 있음`, `UTM 없음`

사용자 베네핏:

- 당일 장애와 주간 추세를 같은 화면에서 전환한다.
- 사이트와 결제수단이 섞여 결론이 흐려지는 것을 막는다.

### 3. 핵심 KPI 카드 6개

카드는 6개까지만 둔다.

1. `VM Cloud에 들어온 주문 신호`
   - 의미: 우리 서버가 받은 주문/결제 관련 row
   - source: VM Cloud SQLite `attribution_ledger`

2. `결제 시작`
   - 의미: 사용자가 결제 페이지까지 간 수
   - source: `payment_page_seen`, `checkout_started`, `InitiateCheckout`

3. `실제 결제완료`
   - 의미: confirmed purchase 후보
   - source priority: VM Cloud confirmed -> Toss/Imweb direct -> 운영DB cross-check

4. `Meta CAPI 전송 성공`
   - 의미: 서버에서 Meta로 보낸 구매 이벤트 중 `events_received=1`
   - source: Meta CAPI send log

5. `Browser Pixel Purchase`
   - 의미: 브라우저에서 `facebook.com/tr ev=Purchase`가 보인 수
   - source: browser network observation / VM diagnostic if captured

6. `매칭 안 된 결제흐름`
   - 의미: 결제 시작이나 완료 힌트는 있으나 confirmed/source match가 안 된 건
   - source: VM Cloud unmatched classifier

각 카드 하단에는 `예산 판단에 사용 가능 / 참고용 / 조치 필요` 배지를 둔다.

### 4. 퍼널 차트

메인 차트는 funnel 형태다.

단계:

1. `유입`
   - UTM/referrer/click id가 잡힌 landing
2. `상품/장바구니 행동`
   - ViewContent/AddToCart
3. `결제 시작`
   - InitiateCheckout/payment_page_seen
4. `결제수단 선택`
   - AddPaymentInfo/payment_method_selected
5. `실제 결제완료`
   - payment_success confirmed
6. `Meta CAPI 성공`
   - events_received=1
7. `Browser Purchase`
   - ev=Purchase observed

표현:

- 각 단계의 count
- 전 단계 대비 전환율
- 전일/전주 대비 변화
- 장애 배지
- 클릭하면 상세 원인 패널 열림

### 5. 일별/주별 추세

퍼널 아래에 같은 지표를 일별/주별 라인으로 보여준다.

필수 라인:

- 결제 시작
- 실제 결제완료
- Meta CAPI 성공
- Browser Purchase
- 매칭 안 된 흐름

사용자 베네핏:

- 특정 날만 터진 장애인지, 구조적으로 계속 새는지 본다.
- Meta UI 지연과 실제 수집 장애를 분리한다.

### 6. 유입/UTM Breakdown

목적: “어떤 유입에서 주문이 시작됐는지”와 “어떤 유입이 끊겼는지”를 보여준다.

그룹:

- Meta UTM
- Google UTM/click id
- Naver UTM/NaPm/n_*
- Organic Naver
- Organic Google
- Direct / biocom.kr 직접 입력
- UTM 없음
- 내부/셀프 referrer

각 row:

- 유입명
- landing count
- 결제 시작 count
- 결제완료 count
- Meta CAPI 성공 count
- 매칭 안 된 count
- 다음 조치

예시 다음 조치:

```text
Naver paid 후보는 보이나 결제완료 연결이 약합니다. destination URL UTM canary를 먼저 확인하세요.
```

### 7. 매칭 안 된 것 Drilldown

목적: unknown을 “그냥 모름”이 아니라 고칠 수 있는 blocker로 보여준다.

사유:

- 결제 페이지 artifact
- payment-decision timeout/canceled
- 실제 결제완료지만 CAPI send 없음
- VM Cloud에는 있으나 운영DB sync 대기
- 운영DB에는 있으나 VM Cloud payment_success 없음
- UTM/referrer 없음
- click id 없음
- NPay click만 있고 actual 없음
- 가상계좌/무통장 미입금
- value mismatch
- duplicate event id

각 사유 표시:

- 건수
- 금액
- 대표 증거
- 신뢰도
- 지금 할 일
- 예산 판단 포함 여부

### 8. 전환 API 생존 상태

별도 섹션으로 둔다.

질문:

```text
서버가 Meta에 구매 이벤트를 보내는 통로가 살아 있는가?
```

표시:

- 최근 CAPI send 시각
- 최근 1시간 / 오늘 / 7일 send count
- success count
- failed count
- `events_received=1` count
- error code 분포
- duplicate 차단 count
- no-send 사유 분포

판정:

- `정상`: 결제완료 대비 CAPI 성공률 95% 이상
- `주의`: 80-95% 또는 최근 1시간 send 없음
- `긴급`: 80% 미만, 최근 결제완료 있는데 CAPI 0, error 증가

### 9. 원본 증거 펼쳐보기

기본 접힘.

노출 가능:

- safe_ref
- touchpoint
- source
- status
- amount bucket
- event presence
- UTM presence
- click id presence
- payment key presence

노출 금지:

- raw order code
- raw payment key
- raw click id
- email/phone/member code
