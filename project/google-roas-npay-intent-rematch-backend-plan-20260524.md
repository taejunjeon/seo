# Google ROAS NPay intent rematch backend plan 2026-05-24

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - data/!data_inventory.md
    - project/google-roas-report-baseline-card-deploy-and-clickid-bottleneck-20260524.md
  lane: Yellow
  allowed_actions:
    - read-only diagnosis
    - dry-run matching
    - backend approval packet
    - local test design
  forbidden_actions:
    - production DB write without approval
    - VM Cloud SQLite match write without approval
    - Google Ads upload/send
    - GTM production publish
  source_window_freshness_confidence:
    source: VM Cloud SQLite + operational PostgreSQL read-only
    window: 2026-05-24 13:35-14:10 KST test window
    freshness: VM Cloud sync fresh, operational DB row not yet present at 14:04 KST
    confidence: B+
```

## 한 줄 결론

Google click id는 NPay 버튼 클릭 단계까지 살아 있다. 지금 막히는 곳은 `NPay 실제 결제완료 주문`이 늦게 들어온 뒤 `npay_intent_log`의 pending row를 자동으로 다시 묶어 주는 backend 작업이 없다는 점이다.

## 실제 관측

TJ님 2026-05-24 13:40 Google 광고 클릭, 13:53 NPay 결제완료 테스트:

```text
site_landing: gclid + campaign id 있음
paid_click_intent: gclid + campaign id 있음
npay_intent_log: gclid + gbraid 있음, product_idx=97, price=39,000
VM Cloud imweb_orders: channel_order_no=2026052431047480 row 있음
운영DB tb_iamweb_users: 아직 row 없음
npay_intent_log.match_status: pending
```

수동 완료값으로 dry-run하면:

```text
strong_match: 1
amount_match_type: final_exact
clicked_purchased_candidate: 1
```

즉 matching logic 자체는 가능하다. 다만 운영 반영 경로가 read-only dry-run에 머물러 있고, 자동 match write가 없다.

## 왜 중요한가

현재 Google ROAS 화면의 click id 보존률은 `실제 결제완료 주문` 기준이다. NPay intent가 click id를 들고 있어도, 결제완료 주문번호와 자동으로 묶이지 않으면 화면에서는 계속 `VM evidence 없음`처럼 보인다.

이 상태에서 Google Ads upload를 열면 안 된다. 주문과 click id가 직접 연결됐다는 증거가 DB에 남아야 한다.

## 보강 방향

### 1. pending NPay intent rematch job

주문 sync 이후 일정 주기로 최근 pending NPay intent를 다시 본다.

대상:

```text
npay_intent_log.match_status = pending
captured_at >= now - 48h
gclid/gbraid/wbraid 중 하나 있음
```

매칭 source:

```text
1순위: 운영DB tb_iamweb_users PAYMENT_COMPLETE + channelOrderNo/order_number
2순위: VM Cloud imweb_orders NPay row + complete_time/imweb_status가 확인된 row
3순위: manual/dry-run은 운영 반영 금지, 진단용만 사용
```

write 대상:

```text
npay_intent_log.match_status = matched
npay_intent_log.matched_order_no = 내부 order_no 또는 channel_order_no
npay_intent_log.matched_order_amount = 주문 금액
npay_intent_log.matched_payment_method = npay_actual
npay_intent_log.matched_at = now
npay_intent_log.match_confidence = 점수
npay_intent_log.match_reason = final_exact/channel_order_no/time_window 등
```

### 2. strict guard

자동 matched로 승격하는 조건은 좁게 둔다.

```text
amount exact 또는 배송비/할인 보정 후 exact
intent captured_at <= paid_at
paid_at - captured_at <= 24h
같은 제품명 또는 product_idx가 맞거나, 단일 후보만 존재
취소/환불 아님
payment_status = PAYMENT_COMPLETE
```

### 3. Google Ads upload와 분리

이 rematch는 Google Ads에 전송하지 않는다. 먼저 화면과 no-send 후보 생성기에서만 쓴다.

```text
upload_candidate = false
send_candidate = false
external_platform_send = 0
```

Google Ads 전송 후보는 다음 조건까지 충족한 뒤 별도 승인한다.

```text
confirmed order
value > 0
cancel/refund 없음
gclid/gbraid/wbraid 직접 evidence 있음
중복 방지 order id 있음
Google Ads 전용 전환 action 준비됨
TJ님 Red Lane 승인
```

## 구현 승인안

승인 시 Codex가 할 작업:

1. `npayRoasDryRun`의 matching 결과를 재사용하는 `npayIntentRematch` 모듈을 만든다.
2. 먼저 `dryRun=true` endpoint 또는 script로 최근 48h pending row가 몇 건 matched 될지 보여준다.
3. 그 다음 `apply=true`는 승인 후에만 열고, matched row만 VM Cloud SQLite에 쓴다.
4. Google ROAS 화면에는 `NPay intent matched evidence`와 `운영DB sync 대기`를 분리 표시한다.

성공 기준:

```text
오늘 테스트 주문 2026052431047480이 운영DB PAYMENT_COMPLETE로 들어온 뒤,
npay_intent_log matched_order_no가 채워지고,
Google click id 보존률 카드에서 해당 주문이 direct evidence로 1건 올라간다.
```

실패 시 해석:

```text
운영DB에 주문이 끝까지 안 들어오면 Imweb/NPay 주문 sync 병목
운영DB에는 들어오는데 matched가 안 되면 matcher 조건 문제
matched는 되는데 화면에 안 나오면 Google ROAS 화면/API evidence index 문제
```

## 2026-05-24 로컬 구현 결과

이제 운영 반영 전에 볼 수 있는 재매칭 미리보기 기능이 생겼다. 이 기능은 DB를 고치지 않고, Google Ads에도 아무것도 보내지 않는다. “이 NPay 결제완료 주문은 어떤 광고 클릭과 붙일 수 있는가”만 보여준다.

구현 위치:

```text
backend/src/npayRoasDryRun.ts
backend/src/routes/attribution.ts
backend/scripts/npay-intent-rematch-dry-run.ts
```

새 로컬/API 사용법:

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/npay-intent-rematch-dry-run.ts \
  --start=2026-05-24T04:30:00.000Z \
  --end=2026-05-24T05:10:00.000Z \
  --sqlite-path=/tmp/seo-vm-crm-20260524T0505.sqlite3 \
  --order-number=202605242646467,2026052431047480 \
  --redact-click-ids \
  --limit=10
```

API:

```text
GET /api/attribution/npay-intent-rematch-dry-run
```

검증 결과:

```text
source: VM Cloud SQLite copy + 운영DB read-only
window: 2026-05-24 13:30~14:10 KST
order: 202605242646467 / channel_order_no 2026052431047480
pending strong match: 1
Google click id present: yes, gclid + gbraid
amount: final_exact, 39,000원
grade: B
reason: 결제완료와 intent 간격이 약 12.5분이라 자동 apply 후보(A급)는 아니고 수동 검토 후 write 승인 후보
write/send/upload: 0
confidence: high for match existence, medium for automatic apply because Grade B
```

해석:

TJ님 테스트 NPay 주문은 클릭 ID가 사라진 것이 아니다. `npay_intent_log`에는 남아 있고, 운영DB 주문과도 dry-run으로 붙는다. 다만 현재는 이 결과를 VM Cloud SQLite에 `matched`로 저장하는 작업을 아직 하지 않았다. 그래서 Google click id 보존률 카드에는 아직 직접 evidence로 반영되지 않는다.

다음 결정:

```text
Green: 더 많은 최근 NPay 주문을 dry-run으로 돌려 자동/수동 후보를 나눈다.
Yellow: VM Cloud backend 배포 후 endpoint를 운영에서 조회한다.
Red: npay_intent_log match_status를 실제로 업데이트하는 write/apply는 별도 승인 전 금지한다.
```
