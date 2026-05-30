작성 시각: 2026-05-28 22:44 KST
기준일: 2026-05-28
문서 성격: Google Ads 실제 구매 전용 후보 / NPay 1:1 bridge 재판정 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - VM Cloud API read-only query
    - no-send payload preview
    - duplicate ledger dry-run
    - deployment runbook documentation update
    - result documentation
  forbidden_actions:
    - Google Ads conversion upload
    - VM Cloud ledger write
    - production DB write/import
    - GTM publish
    - backend deploy/restart
  source_window_freshness_confidence:
    source: VM Cloud API at att.ainativeos.net
    window: 2026-05-28 20:00~21:30 KST for 35,000 KRW order, 2026-05-22~2026-05-28 KST for 7d rerun
    freshness: API fetched 2026-05-28 22:37~22:43 KST
    confidence: high for API returned counts, medium_high for Google Ads send readiness because no platform send was executed
```

## 10초 요약

이번 35,000원 NPay 주문은 내부 기준으로는 강하게 연결됐다.

- 실제 NPay 결제완료 주문 1건이다.
- NPay 버튼 클릭 row와 1:1로 붙었다.
- 버튼 클릭 row에 Google click id가 남아 있다.
- bridge URL hash도 남아 있어, 같은 버튼 클릭에서 온 주문이라고 볼 근거가 강하다.

그러나 아직 Google Ads에 보내도 되는 최종 후보는 아니다.

이유는 `NPay bridge 후보`를 Google Ads 전송 장부에 영구 기록하고, 중복 전송 방지 key를 실제 장부 기준으로 잠그는 단계가 아직 no-write 상태이기 때문이다.

## 이번 35,000원 주문 판정

### 가능한 것

이번 주문은 아래 조건을 통과했다.

| 조건 | 결과 | 의미 |
|---|---:|---|
| 실제 NPay 결제완료 | 통과 | 버튼 클릭이 아니라 실제 주문이다 |
| 버튼 클릭 row와 강한 연결 | 통과 | `strongMatch=1`, `pendingGradeA=1` |
| 주문 생성 시각 bridge exact | 통과 | 주문 생성 시각과 버튼 클릭 흐름이 맞는다 |
| Google click id 존재 | 통과 | Google Ads에서 다시 인식할 수 있는 클릭 증거가 있다 |
| NPay bridge URL hash 존재 | 통과 | 외부 NPay 결제창 진입 증거가 있다 |
| 금액 일치 | 통과 | `final_exact=1`, 35,000원 |
| ambiguous 없음 | 통과 | 후보가 여러 개로 흔들리지 않는다 |

### 아직 막는 것

| 막는 기준 | 왜 막는가 |
|---|---|
| Google Ads 전송 승인 없음 | 실제 광고 플랫폼에 전환을 보내는 일은 Red Lane이다 |
| NPay bridge 영구 장부 write 없음 | 현재는 no-write 분석 결과다. 중복 전송 방지 기준을 실제 장부에 고정해야 한다 |
| Google Ads upload 후보 count 0 | 현재 API는 안전상 NPay bridge 후보를 바로 send 후보로 올리지 않는다 |

## 중복 방어 판정

현재 직접 gclid가 붙은 홈페이지 결제완료 후보는 중복 방어 dry-run을 통과했다.

| 항목 | 값 |
|---|---:|
| 최근 24시간 직접 gclid 실제 구매 후보 | 1건 |
| 중복 key 충돌 | 0건 |
| replay 차단 확인 | 1건 |
| 장부 write 실행 | 0건 |
| Google Ads 외부 전송 | 0건 |

이번 35,000원 NPay 주문은 별도 bridge 후보로 잡힌다.

| 항목 | 값 |
|---|---:|
| NPay bridge A급 + Google click id 후보 | 1건 |
| 금액 | 35,000원 |
| 현재 Google Ads send 후보 | 0건 |
| 현재 Google Ads upload 후보 | 0건 |

해석:

직접 홈페이지 결제완료 후보의 중복 방어는 닫혔다.
NPay bridge 후보의 중복 방어는 `후보 발견`까지는 닫혔지만, `영구 bridge 장부에 ready row를 쓰고 중복 key를 잠그는 단계`가 아직 남아 있다.

## 최근 7일 NPay 결제완료 재판정

기준 window: 2026-05-22 00:00 KST ~ 2026-05-28 23:59 KST
source: VM Cloud API `npay-intent-rematch-dry-run`, `npay-roas-dry-run`
mode: no-write / no-send

| 항목 | 값 | 해석 |
|---|---:|---|
| NPay 버튼 클릭 row | 299건 | 버튼 클릭/진입 전체 |
| Google 계열 버튼 클릭 row | 223건 | URL/UTM/Google click id 기준 Google 유입 흔적 |
| Google click id 보존 버튼 클릭 row | 219건 | gclid/gbraid/wbraid 중 하나가 남은 row |
| NPay 실제 결제완료 | 43건 | NPay 전체 실제 완료 주문 |
| 강한 1:1 연결 | 22건 | 버튼 클릭 row와 주문이 강하게 연결 |
| A급 연결 | 14건 | 시간/금액/후보점수 기준이 좋은 연결 |
| B급 연결 | 8건 | 연결은 있지만 시간/금액/후보점수 중 보수적으로 남긴 연결 |
| ambiguous | 21건 | 결제완료는 있지만 후보가 흔들리는 주문 |
| purchase_without_intent | 0건 | 주문은 있는데 버튼 클릭 row가 아예 없는 경우는 없음 |
| Google 유입처럼 보이는 결제완료 | 4건 / 220,600원 | Google 흔적이 있는 NPay 결제완료 |
| 직접 Google click id까지 붙은 결제완료 | 2건 | Google Ads 전송 후보 확대 검토 대상 |
| A급 + bridge URL hash + Google click id | 1건 | 이번 35,000원 주문이 여기에 해당 |

## 결론

이번 35,000원 주문은 “Google Ads에 보낼 수 있는 후보로 올릴 가치가 있는 NPay bridge A급 후보”다.

다만 바로 전송하면 안 된다.
Google Ads에 실제 구매로 보내기 전에는 아래가 필요하다.

1. NPay bridge 후보를 영구 bridge 장부에 no-send ready row로 쓴다.
2. `전환 액션 + 주문 식별자 + click id type` 기반 중복 key를 고정한다.
3. 같은 주문이 이미 Google Ads upload ledger에 sent/failed/ready로 있는지 확인한다.
4. 취소/환불/반품 방어를 전송 직전에 다시 본다.
5. Red Lane 승인을 받은 뒤 제한 수량만 전송한다.

## 하지 않은 것

- Google Ads 전송 0건
- VM Cloud 장부 write 0건
- 운영DB write/import 0건
- GTM publish 0건
- backend deploy/restart 0건

## 다음 할일

### Auto Green

1. NPay bridge 후보용 중복 방어 설계를 문서와 코드 직전 수준으로 닫는다.
   - 산출물: `bridge_ready` row 설계, 중복 key 재료, 전송 전 차단 조건.

2. 최근 7일 A급 14건 중 Google click id가 없는 12건을 원인별로 나눈다.
   - 산출물: `Google 유입 아님`, `Google 유입이지만 click id 유실`, `후보 불명확` 분류.

### Approval Needed

1. NPay bridge 영구 장부 write smoke
   - 목적: no-send ready row를 실제 장부에 1~2건 써서 중복 방어가 실제로 동작하는지 확인.
   - 성격: VM Cloud write이므로 Yellow Lane.

2. Google Ads 제한 전송
   - 목적: 실제 결제완료 주문만 Google Ads 주 전환에 알려주기.
   - 성격: 외부 광고 플랫폼 전송이므로 Red Lane.
