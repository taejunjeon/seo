# Meta CAPI 중간 이벤트 / Purchase 누락 큐 / EMQ Canary Close

작성 시각: 2026-05-22 14:20 KST
site: biocom
pixel: 1283400029487161
mode: read-only aggregate / no-send / no-write

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/!capiplan.md
    - data/!data_inventory.md
  lane: Green read-only audit + documentation
  allowed_actions:
    - VM Cloud API read-only aggregate
    - local JSON aggregate write
    - documentation update
    - validation
  forbidden_actions:
    - Meta CAPI 운영 추가 전송
    - Meta Test Events 전송
    - GTM publish
    - Imweb header/footer 저장
    - VM Cloud deploy/restart
    - 운영DB write/import
    - raw order/payment/member/click/email/phone/event_id 출력
  source_window_freshness_confidence:
    source: "VM Cloud CAPI send log + daily missing queue monitor + Meta UI screenshot observation"
    window: "최근 1일 missing queue, 최근 운영 성공 Purchase 109건 user_data_presence"
    freshness: "2026-05-22 14:20 KST"
    confidence: 0.9
```

## 이번에 가능해진 것

Browser Pixel 중간 이벤트가 회복된 상태에서 Server CAPI 중간 이벤트를 지금 바로 켜야 하는지 판단할 수 있게 됐다.
결론은 **운영 ON 보류**다.

이유는 간단하다.

- Browser Pixel이 이미 AddToCart / InitiateCheckout / AddPaymentInfo를 상당 부분 보내고 있다.
- 같은 이벤트를 Server CAPI로도 보내려면 browser eventID와 server event_id가 맞아야 한다.
- eventID가 다르면 Meta가 중복 이벤트로 볼 수 있다.
- 따라서 Server CAPI 중간 이벤트는 지금 “운영 전송”이 아니라 “no-send preview + dedup 설계” 단계가 맞다.

## Purchase 누락 큐 close

2026-05-22 14:08 KST manual close run:

- confirmed-but-no-CAPI: 0건 / 0원
- 최근 1일 CAPI success: 70건
- 최근 1일 CAPI failure: 0건
- duplicate event_id: 0
- duplicate order event key: 0
- severity: ok
- Slack 발송: skip. 정상 상태이며 alert_only 모드이기 때문이다.
- post-check verdict: PASS

해석:

현재 window에서는 “결제완료인데 Meta CAPI 성공 기록이 없는 주문”이 없다.
다음부터는 새로 생긴 row만 current sync issue로 보면 된다.

## 이벤트 매칭 품질 canary close

최근 운영 성공 Purchase 109건의 `user_data_presence`만 집계했다.
raw 식별자 값은 보지 않고, 붙었는지 여부만 계산했다.

| field | count | rate |
| --- | ---: | ---: |
| em | 9 | 8.26% |
| ph | 74 | 67.89% |
| external_id | 74 | 67.89% |
| client_ip_address | 80 | 73.39% |
| client_user_agent | 80 | 73.39% |
| fbc | 47 | 43.12% |
| fbp | 77 | 70.64% |

추가 관측:

- success: 109
- failure: 0
- duplicate event_id: 0
- duplicate order event key: 0
- event: Purchase only
- Meta UI 기준선: 6.0/10
- Meta UI 최신 사용자 캡처: 6.3/10

판단:

- 실패와 중복이 없으므로 canary를 즉시 멈출 이유는 없다.
- 전화번호 해시와 서버용 외부 ID는 실제로 붙고 있다.
- 이메일 해시는 후보 주문이 적어 아직 점수 개선을 크게 만들기 어렵다.
- Meta UI 점수 상승은 긍정적이지만, UI 반영 지연과 표본 변화가 있으므로 canary 단독 효과라고 단정하지 않는다.

## Server CAPI 중간 이벤트 판단

지금 Server CAPI 중간 이벤트가 “필요 없음”은 아니다.
다만 현재 우선순위는 낮다.

### 지금 켜면 좋은 점

- 브라우저가 차단된 세션도 서버에서 일부 복구할 수 있다.
- Meta가 구매 전 행동을 더 많이 학습할 수 있다.
- Browser Pixel 장애가 다시 생겼을 때 fallback 경로가 된다.

### 지금 켜면 나쁜 점

- Browser와 Server의 eventID가 다르면 같은 행동이 중복 집계될 수 있다.
- `InitiateCheckout`은 이미 Browser Pixel로 잡히므로 서버 전송의 추가 이득이 제한적이다.
- 중간 이벤트 수가 과하게 늘면 퍼널 해석이 흐려질 수 있다.

### 결정

- Purchase CAPI는 계속 운영 주 경로로 유지한다.
- Browser 중간 이벤트는 현재 운영 주 경로로 둔다.
- Server 중간 이벤트는 no-send preview와 eventID bridge가 닫힌 이벤트만 staged ON 후보로 올린다.
- `InitiateCheckout` Server CAPI 운영 ON은 보류한다.
- `VirtualAccountIssued`는 Purchase가 아니라 가상계좌 주문 생성 이벤트이므로 별도 즉시 발화 경로로 다루는 것이 맞다.

## 다음 행동

1. `confirmed-but-no-CAPI` daily monitor는 cron에서 계속 돌린다.
   - 성공 기준: 누락 큐 0 또는 30분 grace 이후 Critical만 Slack 알림.

2. 이벤트 매칭 품질 canary는 biocom confirmed Purchase 범위에서 유지한다.
   - 성공 기준: failure 0, duplicate 0, ph/external_id presence 유지, Meta UI 점수 하락 없음.

3. 중간 이벤트 Server CAPI는 no-send preview만 계속한다.
   - 성공 기준: Browser 이벤트가 없는 구간, eventID bridge 가능한 구간, source gap 구간을 분리한다.

4. 아임웹 다음 변경 패키지에는 Block4 InitiateCheckout fast path를 선택 항목으로만 포함한다.
   - 성공 기준: 속도 개선보다 중복 발화 0과 eventID 일치 가능성이 먼저 닫힌다.
