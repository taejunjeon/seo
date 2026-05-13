# Coffee Actual Status Monitor

작성 시각: 2026-05-13 13:05 KST  
Lane: Green read-only script and evidence. Cron registration is Yellow approval-only.

## 목표

더클린커피 actual source가 live summary API에 붙은 뒤, status blank와 status sync lag를 매번 같은 형식으로 추적한다. 이 monitor는 운영DB write, VM Cloud write, 외부 전송, cron 등록을 하지 않는다.

## 구현

추가 파일:

- `backend/scripts/coffee-actual-status-monitor.ts`

실행 예:

```bash
cd backend
npx tsx scripts/coffee-actual-status-monitor.ts --output=../data/project/coffee-actual-status-monitor-script-20260513.json
```

읽는 source:

- live summary API: `https://att.ainativeos.net/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24`
- VM Cloud SQLite: `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders`

출력 top-level shape:

```json
{
  "site": "thecleancoffee",
  "checked_at_kst": "2026-05-13 12:56:38",
  "actual_count": 317,
  "actual_amount": 15547500,
  "status_blank_count": 28,
  "status_blank_amount": 1848000,
  "cancel_excluded_count": 31,
  "cancel_excluded_amount": 1796400,
  "max_order_time": "2026-05-13T02:38:12.000Z",
  "max_synced_at": "2026-05-13 03:44:57",
  "max_status_synced_at": "2026-05-12 04:11:07",
  "status_sync_lag_hours": 23.76,
  "no_send": true,
  "no_write": true
}
```

## 최신 판정

Coffee actual은 계속 사용할 수 있다. 단, `included_with_warning`으로 유지해야 한다.

- actual 후보: 317건 / 15,547,500원.
- confirmed status only: 289건 / 13,699,500원.
- status blank: 28건 / 1,848,000원.
- cancel/return/exchange excluded: 31건 / 1,796,400원.
- warnings: `ga4_guard_not_actual_source`, `status_blank_rows_included_with_warning`, `status_sync_stale_over_6h`.

## 왜 blank인가

`status blank`는 VM Cloud SQLite `imweb_orders.imweb_status`가 빈 상태다. 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`의 결제 상태 blank가 아니다. 로컬DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` 기준도 아니다.

이번 blank 28건은 모두 `imweb_status_synced_at` marker가 없었다. VM Cloud SQLite `imweb_orders.synced_at`은 `2026-05-13 03:44:57`까지 진행됐지만, VM Cloud SQLite `imweb_orders.imweb_status_synced_at`은 `2026-05-12 04:11:07`에서 멈춰 있었다. 원인은 결제 실패가 아니라 status 보강 sync lag다.

## Cron 승인안

추천: 진행 추천, 자신감 88%.

무엇을 하는가:

- VM Cloud에 `/home/biocomkr_sns/seo/coffee-status-monitoring/run.sh`를 만들고 하루 1회 또는 6시간 1회 read-only monitor를 돌린다.

왜 하는가:

- status blank가 계속 늘면 coffee actual이 “포함하되 주의 필요”에서 “일부 pending”으로 정책 변경될 수 있다.

성공 기준:

- 매 실행마다 JSON이 저장되고, status blank count/amount와 status sync lag가 보인다.
- no_send=true, no_write=true가 유지된다.

Hard fail:

- raw email/phone/member_code/order/payment/click_id 노출.
- VM Cloud schema migration/write.
- 외부 platform send/upload.

실제 cron 등록은 이번 sprint에서 하지 않았다. TJ님 승인 후 Yellow로 실행한다.
