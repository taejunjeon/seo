작성 시각: 2026-05-28 22:00 KST
기준일: 2026-05-28
문서 성격: Google ROAS / NPay 실제 결제 연결 결과 보고

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
  required_context_docs:
    - data/!data_inventory.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend env interval update
    - VM Cloud backend restart
    - VM Cloud SQLite/API read-only verification
    - local and VM backend code deploy for no-send matching rule
  forbidden_actions:
    - Google Ads new conversion send
    - production PostgreSQL write
    - GTM publish
    - raw click id or raw personal identifier output
  source_window_freshness_confidence:
    source: VM Cloud health, VM Cloud SQLite, VM Cloud NPay dry-run API, backend PM2 log
    window: 2026-05-28 20:00-21:00 KST for TJ NPay test; backend log 2026-05-28 21:37-21:48 KST
    freshness: live after backend restart
    confidence: high
```

## 10초 요약

Imweb 주문 sync는 15분에서 5분 주기로 실제 전환됐다. VM Cloud health와 PM2 log 모두 5분 주기 실행을 확인했다.

TJ님이 2026-05-28 밤 진행한 NPay 실제 결제 35,000원은 VM Cloud 주문 원장에 들어왔고, NPay 버튼 클릭 intent와 A급으로 연결됐다. Google click id도 버튼 클릭 row에 남았다.

다만 이 주문은 아직 Google Ads로 새로 전송되지 않았다. 현재 Google Ads 전송 장부에는 과거 성공 3건과 실패 1건만 있다.

## 확인된 사실

### 1. Imweb sync 주기

- 변경 전: 900000ms, 15분
- 변경 후: 300000ms, 5분
- VM Cloud health 확인: `imwebAutoSync.intervalMs = 300000`
- PM2 log 확인:
  - 2026-05-28 21:37:37 KST: 5분 주기 활성화
  - 2026-05-28 21:38:34 KST: biocom upsert 실행
  - 2026-05-28 21:42:57 KST: biocom 다음 upsert 실행
  - 2026-05-28 21:48:00 KST: biocom 다음 upsert 실행

### 2. TJ님 NPay 결제 주문 연결

- NPay 외부 주문번호: 원문은 대화에만 있음. 보고서에는 원문 재노출하지 않음.
- VM Cloud 내부 주문번호: 원문은 대화에만 있음. 보고서에는 원문 재노출하지 않음.
- 금액: 35,000원
- 결제수단: NPay
- VM Cloud 적재 시각: 2026-05-28 21:37 KST대 sync 후 확인
- 결제완료 판단 기준: `complete_time`이 아니라 `payment.payment_time`

`complete_time`은 NPay에서 0으로 남을 수 있다. 그래서 NPay 실제 결제완료는 `payment.payment_time`을 fallback으로 사용해야 한다.

### 3. 버튼 클릭 intent 연결

보강 전에는 같은 버튼 클릭 1회가 구 태그 row와 신규 v1.1 bridge row로 동시에 잡혀 `ambiguous`가 됐다.

보강 후에는 같은 시간, 같은 상품, 같은 금액, 같은 페이지, 같은 주문 생성 시각을 가진 중복 intent를 하나로 접고, 그중 NPay bridge URL evidence가 있는 v1.1 row를 우선한다.

재조회 결과:

- confirmed NPay order: 1건
- strong match: 1건
- Grade A: 1건
- Google-like completed order: 1건
- Google click id present: 1건
- ambiguous: 0건
- purchase without intent: 0건
- 금액: 35,000원

## Google Ads 전송 여부

이번 35,000원 NPay 결제는 아직 Google Ads 전송 장부에 `sent`로 남지 않았다.

현재 VM Cloud Google Ads confirmed purchase upload ledger 요약:

- sent: 3건, 305,900원
- failed: 1건, 293,206원
- 이번 NPay 35,000원 결제와 일치하는 2026-05-28 sent row는 없음

## 왜 중요한가

이전에는 “NPay 실제 구매가 Google 광고에서 왔는지”를 확신하기 어려웠다. 이제는 최소한 이번 테스트 건에 대해 아래 4개가 한 줄로 이어졌다.

1. Google 광고 유입
2. NPay 버튼 클릭
3. NPay 외부 결제창 진입
4. 실제 NPay 결제완료 주문

이 연결이 늘어나면 Google Ads에는 버튼 클릭이 아니라 실제 결제완료만 구매 신호로 보낼 수 있다.

## 아직 안 된 것

- 이번 35,000원 주문을 Google Ads에 전송하지 않았다.
- 자동 전송 조건은 아직 열지 않았다.
- GA4 이미 수집 여부는 `unknown`이라서 Meta/GA4 중복 여부 방어는 추가 확인이 필요하다.
- product name은 VM Cloud NPay 주문 row에서 비어 있어 상품명 exact match는 못 했다. 이번 연결은 시간, 금액, 주문 생성 시각, bridge evidence, click id로 A급 판정했다.

## 다음 판단

1. Google Ads 전송을 바로 열기보다, 이번 건처럼 A급 연결된 NPay 실제 결제완료가 자동으로 계속 늘어나는지 먼저 본다.
2. `already_in_ga4_unknown`을 줄이기 위해 GA4/Google Ads 쪽 중복 여부 조회를 더 닫는다.
3. 자동 전송을 열 때는 A급 + 실제 결제완료 + value > 0 + 취소/환불 아님 + 중복 전송 장부 없음 조건으로만 제한한다.
