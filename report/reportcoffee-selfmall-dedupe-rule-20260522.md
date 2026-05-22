# reportcoffee selfmall dedupe rule 20260522

작성 시각: 2026-05-22 00:25 KST
문서 성격: 더클린커피 자사몰 매출 중복 제거 규칙 v0.2
상위 문서: [[!report]], [[reportcoffee]], [[reportcoffee-dry-run-20260521]]

```yaml
harness_preflight:
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_api
    - read_only_operational_db_aggregate
    - local_report_artifact
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud public APIs + 운영DB aggregate SELECT
    window: 2026-05-15 - 2026-05-21, 2026-04-22 - 2026-05-21
    freshness: 2026-05-22 00:25 KST
    confidence: medium_high for monthly, medium for weekly until NPay weekly endpoint exists
```

## 사람 말 결론

더클린커피 자사몰 매출은 `siteConfirmedRevenue` 하나로 잡으면 안 된다. 그 값은 광고/유입 장부에서 confirmed로 잡힌 후보라서 결제수단별 매출 원장과 역할이 다르다.

이번 규칙은 자사몰을 결제수단 기준으로 다시 잡는다. Toss/card/가상계좌 계열은 운영DB `tb_sales_toss store='coffee'`, NPay는 VM Cloud NPay actual을 쓴다. PlayAuto `아임웹-C`는 주문과 상품 확인용이고 금액은 0이라 매출 금액 source로 쓰지 않는다.

## 규칙 v0.2

1. 자사몰 금액 source는 `Toss + NPay actual`이다.
2. `siteConfirmedRevenue`는 진단값이다. Toss/NPay와 더하지 않는다.
3. PlayAuto `아임웹-C`는 주문/상품/배송 상태 cross-check다. `pay_amt=0`이라 금액으로 쓰지 않는다.
4. 주간은 NPay actual 주간 API가 아직 없으므로 “Toss 확인분 + NPay pending”으로 표시한다.
5. 월간은 NPay actual 30d가 있으므로 `Toss 30d + NPay actual 30d`를 included with warning으로 쓴다.

## 근거

### 주간

기준: 2026-05-15 - 2026-05-21 KST

- PlayAuto `아임웹-C`: 281행 / 399개 / 금액 0원 / 최신 2026-05-20.
- Toss `store=coffee`: 152건 / 9,611,622원 / 최신 2026-05-21.
- PlayAuto와 Toss order base bridge: Toss 152건 중 141건 매칭, 금액 기준 9,240,291원 / 9,611,622원 = 96.14%.
- NPay actual 주간 금액: public summary가 30d만 주므로 pending.

주간 자사몰은 지금 기준 `최소 확인분 9,611,622원 + NPay pending`이다.

### 월간

기준: 2026-04-22 - 2026-05-21 KST

- PlayAuto `아임웹-C`: 1,165행 / 1,398개 / 금액 0원 / 최신 2026-05-20.
- Toss `store=coffee`: 551건 / 31,444,064원 / 최신 2026-05-21.
- PlayAuto와 Toss order base bridge: Toss 551건 중 539건 매칭, 금액 기준 31,072,733원 / 31,444,064원 = 98.82%.
- NPay actual 30d: 304건 / 15,538,800원 / 최신 주문 2026-05-21.

월간 자사몰 included 후보:

```text
Toss 31,444,064원 + NPay actual 15,538,800원 = 46,982,864원
```

`siteConfirmedRevenue` 30d 32,661,233원은 이 값보다 낮다. 따라서 매출 분모로는 `Toss + NPay actual`을 쓰고, `siteConfirmedRevenue`는 광고/유입 장부 진단값으로만 둔다.

## 수정된 dry-run 해석

### 주간

```text
자사몰 최소 확인분 9,611,622원 + 스마트스토어 2,297,220원 = 11,908,842원
Meta 광고비 1,952,104원 / 11,908,842원 = 16.39%
```

이 16.39%는 최소 매출 기준이다. NPay 주간 금액과 쿠팡 금액이 붙으면 낮아질 수 있다.

### 월간

```text
자사몰 46,982,864원 + 스마트스토어 8,844,270원 = 55,827,134원
Meta 광고비 3,966,919원 / 55,827,134원 = 7.11%
```

월간은 이전 dry-run의 9.56%보다 7.11%가 더 맞는 후보에 가깝다. 이유는 NPay actual을 자사몰 매출에 합류시켰기 때문이다.

## 자동화 주의

`/api/crm-local/imweb/toss-reconcile`은 aggregate coverage를 보기에 좋지만, response 안에 raw sample field가 있다. Slack/보고서 자동화는 이 endpoint를 그대로 쓰지 말고 aggregate-only wrapper를 만들어야 한다.

## 다음 할일

1. Codex가 NPay weekly 집계 경로를 만든다.
   무엇을: VM Cloud NPay actual을 7일 window로 읽는 read-only endpoint 또는 aggregate query를 만든다.
   왜: 주간 자사몰 매출에서 NPay가 pending이면 매출 대비 광고비가 과대 표시된다.
   성공 기준: 주간 NPay amount/count/freshness가 raw 주문번호 없이 나온다.
   승인 필요: endpoint 구현/배포 전까지는 Green 조사만.
   추천 점수/자신감: 84%.

2. Codex가 aggregate-only Toss reconcile wrapper를 설계한다.
   무엇을: raw sample 없는 coverage/count/amount endpoint 또는 로컬 report script를 만든다.
   왜: 현재 reconcile API는 샘플에 raw 식별자가 들어 있어 Slack 자동 보고에 직접 쓰면 안 된다.
   성공 기준: raw 식별자 0, coverage와 unmatched amount만 출력.
   승인 필요: 로컬 script는 없음, VM 배포는 별도 승인.
   추천 점수/자신감: 88%.
