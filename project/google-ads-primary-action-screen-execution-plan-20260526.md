# Google Ads 실제 구매 주 전환 화면 실행안 - 2026-05-26

작성 시각: 2026-05-26 19:38 KST  
문서 성격: Green Lane 설계안 / Google Ads 화면 설정 변경과 전환 전송은 Red Lane

```yaml
harness_preflight:
  common_harness_read:
    - "harness/common/HARNESS_GUIDELINES.md"
    - "harness/common/AUTONOMY_POLICY.md"
    - "harness/common/REPORTING_TEMPLATE.md"
  project_harness_read:
    - "AGENTS.md"
    - "data/!data_inventory.md"
    - "gdn/google-ads-confirmed-purchase-execution-approval-20260505.md"
    - "project/google-ads-existing-purchase-separation-final-plan-20260526.md"
    - "project/google-ads-npay-secondary-dual-fire-smoke-20260526.md"
    - "project/google-ads-confirmed-only-nosend-builder-20260526.md"
  lane: "Green for plan, Red for Google Ads Primary change/upload"
  allowed_actions:
    - "Google Ads screen-based execution plan"
    - "local markdown report write"
    - "no-send payload requirement design"
    - "read-only interpretation of existing Google Ads/API/docs"
  forbidden_actions:
    - "Google Ads Primary/Secondary mutation"
    - "Google Ads conversion upload"
    - "Google Ads conversion action deletion"
    - "Data Manager/MySQL/BigQuery source connection"
    - "GTM publish"
    - "production DB write"
    - "VM Cloud SQLite write"
  source_window_freshness_confidence:
    source:
      - "Google Ads UI screenshots provided by TJ"
      - "Google Ads API/read-only reports already captured in project docs"
      - "VM Cloud public dashboard-summary and click-id-health no-send report"
    window:
      - "today: 2026-05-26 KST"
      - "last_7d no-send candidate report generated 2026-05-26 19:21 KST"
    freshness: "2026-05-26 19:21~19:38 KST"
    confidence: "high for screen action separation, medium-high for first two no-send candidate value requirements"
```

## 한 줄 결론

오늘 시작할 Google Ads 주 전환은 `NPay 버튼 클릭`이 아니라 `실제 결제완료 주문만 Google에 알려주는 전환`이어야 한다. 화면에서는 `BI confirmed_purchase_offline`을 그 후보로 두고, 실제 전송은 1단계 후보 2건의 원문 주문번호, 원문 gclid, 전환시각, 중복/환불 guard가 준비된 뒤 1건 제한으로 시작한다.

## 현재 목표와 진척률

오늘 목표: Google Ads가 효과적으로 학습할 실제 구매완료 주 전환 액션을 시작할 준비를 끝낸다.

현재 진척률: 74%

진척률을 72%에서 74%로 올린 이유:

- 기존 `구매완료`는 `NPay 버튼 클릭/결제진입(보조)`로 낮췄다.
- `TechSol - NPAY구매 50739`는 삭제 완료됐다.
- 실제 결제완료 전용 후보는 `BI confirmed_purchase_offline`으로 좁혀졌다.
- 1단계 no-send payload 후보 2건이 분리됐다.
- 남은 핵심은 Google Ads 화면에서 `BI confirmed_purchase_offline`을 주 전환으로 쓸지 결정하고, 첫 전송 전에 필요한 원문값을 채우는 것이다.

## 용어를 사람 말로 정리

Primary 전환은 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호다.  
Secondary 전환은 입찰에는 안 쓰고 관찰만 하는 보조 신호다.

따라서 `Primary`에는 실제 결제완료만 들어가야 한다. 버튼 클릭, 결제창 진입, NPay 로그인창 진입은 `Secondary`로만 남겨야 한다.

## Google Ads 화면에서 확정할 상태

### 1. 기존 `NPay 버튼 클릭/결제진입(보조)`

현재 역할: Secondary 유지

의미:

- NPay 버튼을 누르거나 결제창으로 들어간 신호다.
- 실제 결제완료가 아니다.
- 광고 입찰 학습에는 쓰면 안 된다.
- 삭제하지 않아도 되지만, 예산 판단용 구매 ROAS에는 섞으면 안 된다.

화면에서 확인할 것:

1. Google Ads에서 `목표 > 전환 > 요약`으로 들어간다.
2. `구매` 목표를 펼친다.
3. `NPay 버튼 클릭/결제진입(보조)`가 있으면 연다.
4. 설정에서 `액션 최적화`가 `보조 액션`인지 확인한다.
5. `send_to=AW-304339096/r0vuCKvy-8caEJixj5EB`인 액션이면 맞다.

성공 기준:

- 이 액션이 Primary가 아니다.
- 이 액션 이름이 실제 구매완료처럼 보이지 않는다.

### 2. `TechSol - NPAY구매 50739`

현재 역할: 삭제 완료로 유지

의미:

- 같은 NPay 버튼 클릭에서 중복으로 발화됐던 보조 신호다.
- 상품가 8,900원처럼 배송비를 빼고 잡는 경우도 있어 값 기준도 맞지 않았다.
- TJ님이 삭제 완료했다.

화면에서 확인할 것:

1. `목표 > 전환 > 요약 > 구매` 안에 `TechSol - NPAY구매 50739`가 더 이상 보이지 않는지 확인한다.
2. 보이면 삭제 또는 사용중지 상태인지 확인한다.

성공 기준:

- 이 액션이 Primary에도 Secondary에도 새로 전환을 만들지 않는다.

### 3. `BI confirmed_purchase_offline`

현재 역할: 실제 구매완료 주 전환 후보

의미:

- 실제 결제완료 주문만 Google Ads에 알려주기 위한 통로다.
- Google Ads 화면에서는 `클릭에서 가져오기` 또는 `UPLOAD_CLICKS` 계열로 보인다.
- 버튼 클릭이 아니라 서버/원장 기준으로 나중에 Google Ads에 전송하는 방식이다.

화면에서 확인할 것:

1. Google Ads에서 `목표 > 전환 > 요약`으로 들어간다.
2. `구매` 목표를 펼친다.
3. `BI confirmed_purchase_offline`를 연다.
4. `설정` 탭에서 아래 값을 확인한다.

확인할 값:

- 전환 이름: `BI confirmed_purchase_offline`
- 소스: `클릭에서 가져오기`
- 액션 최적화: 현재는 보조 액션이어도 된다. 실제 시작 시 Primary로 바꾼다.
- 값: `각기 다른 값을 사용합니다`
- 카테고리: 구매
- 상태: 운영중
- 전환 추적 기간: 현재값 유지

성공 기준:

- 이 액션이 실제 구매완료 전용으로 쓰일 이름과 구조를 가진다.
- 이 액션으로 버튼 클릭/결제진입이 들어오지 않는다.

## 화면 기준 실행안

### 권장 실행안 A: 오늘 주 전환 자리만 먼저 잡는다

추천도: 85%

실행 내용:

1. `NPay 버튼 클릭/결제진입(보조)`는 Secondary로 유지한다.
2. `TechSol - NPAY구매 50739`는 삭제 상태를 유지한다.
3. `BI confirmed_purchase_offline`를 연다.
4. `액션 최적화`를 Primary로 바꾸는 화면까지 확인한다.
5. 실제 변경은 TJ님 최종 승인 후 누른다.

왜 이 방법인가:

- Google Ads가 앞으로 배워야 할 목표를 실제 구매완료로 바꿀 수 있다.
- 아직 전송 이벤트가 많지 않아도, 잘못된 버튼 신호보다 방향이 맞다.
- 단, Primary로 바꿔도 실제 이벤트가 들어오기 전까지 학습량은 적다.

주의:

- 이 변경은 광고 입찰 학습에 영향을 준다.
- 그래서 Codex가 대신 누르면 안 되고, TJ님이 화면에서 직접 승인 후 진행해야 한다.

성공 기준:

- 구매 목표 안에서 실제 구매용 Primary 후보가 `BI confirmed_purchase_offline`로 정해진다.
- 버튼 클릭/결제진입 액션은 Primary에서 빠진다.

### 권장 실행안 B: 첫 no-send 후보 2건을 실제 전송 준비값까지 닫은 뒤 Primary로 올린다

추천도: 92%

실행 내용:

1. `BI confirmed_purchase_offline`는 지금은 Secondary로 둔다.
2. 1단계 후보 2건의 원문 주문번호, 원문 gclid, 전환시각, 중복/환불 guard를 준비한다.
3. 실제 전송 dry-run payload를 만든다.
4. TJ님 승인 후 1건 제한 전송 또는 validate-first 방식으로 시작한다.
5. 그 직후 `BI confirmed_purchase_offline`을 Primary로 올린다.

왜 이 방법인가:

- Google Ads에 실제로 들어갈 첫 구매 이벤트까지 같이 준비한다.
- Primary로 올린 뒤 데이터가 0인 시간을 줄인다.
- 가장 안전한 시작안이다.

주의:

- 오늘 안에 바로 Primary 전환을 시작한다는 속도는 A보다 느릴 수 있다.
- 대신 첫 전송 품질은 더 높다.

성공 기준:

- 첫 전송 후보가 정확한 주문번호와 gclid를 가진다.
- Google Ads에 중복 없이 1건만 들어갈 준비가 된다.

### 비추천 실행안 C: 데이터 소스 연결 버튼부터 누른다

추천도: 20%

왜 비추천인가:

- 화면에 `데이터 소스 연결` 버튼이 보이지만, 지금 바로 MySQL/BigQuery/Data Manager를 연결하면 필터가 넓어질 위험이 있다.
- 우리가 원하는 것은 전체 주문 DB 연결이 아니라 `실제 결제완료 + Google click id + 중복/환불 guard 통과` 주문만 전송하는 것이다.
- 데이터 소스 연결은 나중에 Data Manager 방식으로 갈 때 따로 설계하는 것이 맞다.

성공 기준:

- 오늘은 `데이터 소스 연결`을 누르지 않는다.

## 1단계 후보 2건의 실제 전송 전 필요값

현재 no-send 후보 2건:

| 후보 | masked order | 금액 | 통화 | Google 식별자 | 현재 상태 |
| --- | --- | ---: | --- | --- | --- |
| 1 | `20260520...016693` | 36,900 | KRW | gclid | no-send 후보 |
| 2 | `20260524...353635` | 234,000 | KRW | gclid | no-send 후보 |

이 두 건은 실제 결제완료 기준과 gclid 단일 식별자 기준을 통과했다. 다만 보고서에는 원문 주문번호와 원문 gclid를 숨겼기 때문에, 실제 전송 전에는 서버 내부에서 원문값을 읽어 payload를 만들어야 한다.

### 후보 1건마다 필요한 값

1. 원문 주문번호
   - 왜 필요한가: Google Ads에 같은 주문을 두 번 보내지 않기 위한 중복 방지 키다.
   - 예: 보고서의 `20260520...016693` 같은 마스킹 값이 아니라 전체 주문번호가 필요하다.

2. 원문 gclid
   - 왜 필요한가: Google Ads가 “이 구매가 어느 광고 클릭에서 왔는지” 연결하는 핵심 식별자다.
   - 조건: gclid, gbraid, wbraid 중 정확히 하나만 선택한다.
   - 1단계 후보 2건은 gclid 단일 후보라 규칙이 단순하다.

3. 전환 시각
   - 왜 필요한가: Google Ads가 클릭 이후 구매가 언제 일어났는지 판단한다.
   - 기준: 실제 결제완료 시각을 쓴다.
   - 형식: Google Ads 업로드용 timezone 포함 형식으로 변환해야 한다.

4. 전환 금액
   - 왜 필요한가: Google Ads가 매출 기준으로 어떤 광고가 돈을 만들었는지 학습한다.
   - 후보 1: 36,900원
   - 후보 2: 234,000원
   - 조건: 내부 실제 결제금액과 일치해야 한다.

5. 통화
   - 값: `KRW`

6. Google Ads 전환 액션
   - 이름: `BI confirmed_purchase_offline`
   - ID: `7609289411`
   - 목적: 이 주문을 기존 버튼 클릭 액션이 아니라 실제 구매완료 전용 액션에 넣는다.

7. 결제 상태
   - 필요한 값: `PAYMENT_COMPLETE`
   - 왜 필요한가: 미입금 가상계좌, 결제 시작, 버튼 클릭은 실제 구매가 아니기 때문이다.

8. 취소/환불/반품 상태
   - 필요한 값: 취소 없음, 환불 없음, 반품 없음
   - 왜 필요한가: 이미 취소된 주문을 Google Ads에 매출로 보내면 ROAS가 부풀기 때문이다.

9. 중복 전송 방지 값
   - 권장: `conversion_action_id + order_no` 또는 `conversion_action_id + payment_key`
   - 왜 필요한가: 같은 주문을 여러 번 보내면 Google Ads 구매와 매출이 또 부풀기 때문이다.

10. 전송 승인 상태
    - 현재: 승인 전 / no-send
    - 실제 전송은 Red Lane이다.
    - TJ님 승인 없이 Codex가 Google Ads에 보내면 안 된다.

## 첫 전송 전 체크리스트

아래가 모두 YES여야 실제 전송을 열 수 있다.

```text
1. 실제 결제완료 주문인가? YES
2. 금액이 0보다 큰가? YES
3. 내부 실제 결제금액과 payload 금액이 일치하는가? 필요
4. 취소/환불/반품이 없는가? 필요
5. gclid/gbraid/wbraid 중 정확히 하나만 선택됐는가? 1단계 후보는 YES
6. 원문 gclid가 서버 내부에서 읽히는가? 필요
7. 전환 시각이 실제 결제완료 시각인가? 필요
8. 같은 주문을 이전에 보낸 적이 없는가? 필요
9. 전환 액션이 BI confirmed_purchase_offline인가? YES
10. TJ님이 Google Ads 전송을 승인했는가? NO
```

## 오늘의 결론

가장 빠른 실행안은 `BI confirmed_purchase_offline`을 실제 구매완료 주 전환으로 확정하는 것이다.  
가장 안전한 실행안은 1단계 후보 2건의 원문값과 중복/환불 guard를 먼저 닫고, 1건 제한 전송 준비가 끝난 뒤 Primary로 올리는 것이다.

내 추천은 B안이다.  
즉, 오늘은 화면에서 `BI confirmed_purchase_offline`을 주 전환 후보로 확정하고, 실제 클릭/주문 원문값 준비가 끝나는 즉시 Primary 전환 시작과 1건 제한 전송을 같은 스프린트로 묶는다.

## Guardrails

```text
Google Ads Primary/Secondary change: NOT RUN
Google Ads conversion upload: NOT RUN
Data source connection: NOT RUN
GTM publish: NOT RUN
VM Cloud SQLite write: NOT RUN
production DB write: NOT RUN
raw order id exposed in this document: 0
raw click id exposed in this document: 0
```
