# Sprint 1. Coffee Actual Source Patch

작성 시각: 2026-05-13 02:25 KST
상태: live 배포 완료 / post-snapshot PASS / 로컬 대시보드 smoke PASS / 24h status monitor 수동 확인 완료
Owner: Codex
Lane: Yellow 승인 실행 완료 + Green follow-up
Do not use for: GA4/Meta/Google/TikTok/Naver 실제 전송, 운영DB write/import, GTM publish, Imweb footer/header 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - data/!coffeedata.md
  lane: Yellow approved VM Cloud backend deploy/restart completed
  allowed_actions:
    - approved backend file deploy
    - backend typecheck/build
    - seo-backend restart
    - summary API post-snapshot validation
    - Green dashboard/documentation follow-up
  forbidden_actions:
    - operational DB write/import
    - VM Cloud schema migration
    - platform send/upload
    - GTM publish
    - Imweb footer/header edit
  source_window_freshness_confidence:
    source: "VM Cloud summary API + VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders + local frontend smoke"
    window: "thecleancoffee NPay recent 30d, post-snapshot 2026-05-13 00:57 KST, latest read-only refresh 2026-05-13 10:37 KST"
    freshness: "summary API live after seo-backend restart; VM Cloud SQLite imweb_orders status sync remains stale"
    confidence: 0.91
```

## 10초 요약

더클린커피 NPay 매출은 더 이상 live summary API에서 `bridge_pending`만 보지 않는다. 승인된 배포 후 live API가 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders(site='thecleancoffee', pay_type='npay')`를 actual source 후보로 읽고, `imweb_status` blank와 stale status sync를 warning으로 같이 보여준다. 다음 행동은 이 숫자를 `/total` 전체 장부와 ROAS 판단 화면에 같은 source rule로 연결하는 것이다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase1-Sprint1]] | coffee NPay actual source를 live summary API에 붙인다 | coffee 매출이 bridge_pending에 갇히면 내부 매출과 ROAS 판단이 낮게 나온다 | reader patch, test, VM Cloud backend 배포, post-snapshot 순서로 닫는다 | 완료 | 100% | coffee actual source/status/count가 live API에 보이고 biocom regression이 없다 | 완료. Sprint 2 ROAS recompute로 연결됨 | NO, 완료 | [[../gptconfirm/gpt0508-49/00-result-report]] |
| P0 | [[#Phase1-Sprint2]] | status blank를 warning으로 운영한다 | blank status를 미결제로 단정하면 매출을 누락하고, 확정으로 숨기면 취소 반영 리스크가 생긴다 | `included_with_warning`에 포함하되 blank count/amount/freshness/root cause를 같이 표시한다 | 24h 수동 monitor 완료, 전용 cron은 미구축 | 100% | status blank 변화와 원인이 source/window/freshness와 함께 기록된다 | 다음: 전용 status monitor 스크립트/cron 승인안 | NO, Green / cron 등록은 Yellow | [[../data/project/coffee-actual-24h-monitor-20260513]] |
| P1 | [[#Phase1-Sprint3]] | coffee actual을 운영 대시보드와 전체 장부에 반영한다 | API만 바뀌고 화면/월별 장부가 안 쓰면 운영 기준이 바뀌지 않는다 | `/ads/site-landing`은 로컬 smoke 완료, `/total` contract는 source line item으로 확장한다 | `/total` contract/로컬 화면 반영 완료 | 90% | 운영자가 coffee actual, blank warning, bridge_pending, ROAS 참고 여부를 한 화면과 `/total`에서 본다 | 다음: 운영 deploy 여부 판단 | NO, Green / 배포는 별도 승인 | [[../project/sprint2]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 24h coffee actual freshness monitor
- 상태: 완료. Dedicated status blank monitor는 자동 실행 중이 아니었다. 기존 VM Cloud cron은 `/home/biocomkr_sns/seo/coffee-monitoring/run.sh` → `scripts/coffee-npay-intent-monitoring-report.ts`이며, 더클린커피 actual `imweb_status` blank 모니터가 아니다.
- 결과: 2026-05-13 10:37 KST 수동 read-only 기준 coffee actual은 318건 / 15,503,000원, status blank는 26건 / 1,663,600원이다.
- 원인: VM Cloud SQLite `imweb_orders` order sync는 `2026-05-13 01:30:03`까지 진행됐지만 `imweb_status_synced_at`은 `2026-05-12 04:11:07`에서 멈춰 있었다. 따라서 `source_freshness_gap_status_sync_lag`로 유지한다.
- 산출물: `data/project/coffee-actual-24h-monitor-20260513.json`, `gdn/coffee-actual-24h-monitor-20260513.md`.
- 다음: cron 등록은 하지 않았다. 전용 monitor script/cron이 필요하면 별도 Yellow 승인안으로 넘긴다.

#### A2. `/total` 전체 장부 adoption contract
- 무엇을 하는가: coffee actual line을 `/total` 장부에 섞어 더하지 않고 별도 source line으로 넣는 contract를 만든다.
- 왜 하는가: `included_with_warning`을 확정 매출처럼 숨기면 source confidence가 사라진다.
- 어떻게 하는가: VM Cloud summary API의 `derived.npay_revenue_30d_actual_confirmed`를 `source`, `status`, `amount_krw`, `status_blank_amount_krw`, `use_for_budget_roas` 필드로 나눠 `/total` data contract에 반영한다.
- 성공 기준: biocom 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` actual과 coffee VM Cloud SQLite `imweb_orders` actual이 서로 다른 line으로 보인다.
- 실패 시 다음 확인점: `/total` route data contract, frontend copy, source guide mismatch.
- 승인 필요 여부: NO, Green design. 실제 deploy/restart는 별도 승인.
- 산출물: Sprint 2 또는 `/total` contract 문서.
- 진척률에 미치는 영향: Phase1-Sprint3 70% -> 90%.
- 의존성: Sprint 2 correction line 확정.

### Approval Needed

현재 Sprint 1 후속 Green 작업에는 TJ님 승인이 필요 없다. VM Cloud backend 추가 배포, 외부 플랫폼 전송, Google Ads 전환 설정 변경은 별도 Yellow/Red 승인 전 실행하지 않는다.

### Blocked/Parked

#### C1. coffee GA4/Meta/Google/TikTok/Naver purchase send
- 무엇을 하는가: 외부 플랫폼에 coffee purchase를 보내는 작업.
- 왜 보류하는가: actual source patch는 매출 정본을 읽는 작업이고, 외부 전송은 숫자와 학습을 바꾸는 Red Lane이다.
- 재개 조건: no-send dry-run, already_in_ga4 guard, duplicate guard, rollback, TJ Red 승인.
- 승인 필요 여부: YES, Red.

## 현재 기준 숫자

| 항목 | post-snapshot 2026-05-13 00:57 KST | latest read-only 2026-05-13 10:37 KST |
|---|---:|---:|
| coffee actual source | `imweb_v2_vm_cloud_imweb_orders` | `imweb_v2_vm_cloud_imweb_orders` |
| coffee actual status | `included_with_warning` | `included_with_warning` |
| coffee actual count | 309 | 318 |
| coffee actual amount | 14,902,800원 | 15,503,000원 |
| coffee status blank | 14건 / 944,900원 | 26건 / 1,663,600원 |
| coffee status source | VM Cloud SQLite `imweb_orders.imweb_status` | VM Cloud SQLite `imweb_orders.imweb_status` |
| coffee root cause | status sync stale | status sync lag/source freshness gap |
| biocom actual source | 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` | 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` |
| biocom actual status | included | included |
| biocom actual count | 162 | 166 |
| biocom actual amount | 29,463,300원 | 29,642,500원 |

숫자가 309건에서 318건으로 움직인 것은 VM Cloud SQLite `imweb_orders`의 order sync가 계속 들어왔기 때문이다. 같은 시각 status sync는 `2026-05-12 04:11:07`에서 멈춰 있어 `imweb_status` blank warning은 유지된다.

## status blank가 무엇이고 왜 비어 있는가

`status blank`는 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders.imweb_status` 값이 빈 row를 뜻한다. 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`의 `payment_status` blank가 아니다. 로컬DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`의 row도 아니다.

2026-05-13 10:37 KST read-only 확인에서 blank 26건은 모두 `imweb_status_synced_at` marker가 없었다. 또한 최신 status sync 시각은 `2026-05-12 04:11:07`이고, VM Cloud SQLite `imweb_orders.synced_at`은 `2026-05-13 01:30:03`까지 진행됐다. 따라서 현재 원인은 결제 실패가 아니라 `source_freshness_gap`, 즉 주문 수집은 최신인데 status 보강 sync가 늦은 상태로 보는 것이 맞다.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase1-Sprint1

**이름**: Coffee actual source live patch

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 더클린커피 NPay 실제 결제 후보를 live summary API가 읽게 만드는 것이다.

완료한 것:
- local patch/test/commit `5359a47`.
- remote backup 생성.
- VM Cloud backend 3파일 배포.
- remote typecheck/build PASS.
- `seo-backend` restart PASS.
- post-snapshot PASS.

100% 조건:
- coffee actual source가 live API에서 `imweb_v2_vm_cloud_imweb_orders`로 보인다.
- biocom actual source가 운영DB PostgreSQL `dashboard.public.tb_iamweb_users PAYMENT_COMPLETE`로 유지된다.
- external send/upload/write/publish가 0이다.

현재 진척률: 100%.

### Phase1-Sprint2

**이름**: Status blank warning policy

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 VM Cloud SQLite `imweb_orders.imweb_status` blank를 숨기지 않고, 매출 누락도 만들지 않는 것이다.

현재 정책:
- `status blank`는 VM Cloud SQLite `imweb_orders.imweb_status`가 비어 있다는 뜻이다.
- 미결제 단정 금지.
- 취소/반품/교환이 아니고 NPay positive amount이면 `included_with_warning`에 포함한다.
- `status_blank_count`, `status_blank_amount`, `status_sync_stale_over_6h`를 같이 보여준다.

100% 조건:
- 24h monitor에서 blank row가 새 status sync 후 정상 status로 전환되거나, 계속 blank이면 stale 원인이 새 blocker로 분류된다.
- dashboard와 source guide가 같은 문구로 status blank를 설명한다.

실행 단계:
1. [Codex] 24h 후 VM Cloud SQLite `imweb_orders` aggregate를 다시 읽는다.
2. [Codex] live summary API warning이 최신 aggregate와 맞는지 비교한다.
3. [Codex] blank가 지속되면 Imweb v2 status sync job 점검 승인안을 만든다.

현재 진척률: 100%.

### Phase1-Sprint3

**이름**: Dashboard and total ledger adoption

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 API 결과를 운영자가 보는 화면과 전체 장부 기준에 연결하는 것이다.

현재 상태:
- backend API는 live PASS.
- local frontend `http://localhost:7010/ads/site-landing`은 route 200, Playwright smoke PASS, screenshot 저장 완료.
- 화면은 coffee actual, status blank, freshness warning, legacy/bridge line을 보여준다.
- `/total` 전체 장부에는 coffee `included_with_warning` line item contract를 붙였다. 로컬 API 응답과 프론트 화면은 별도 보정 라인을 보여준다.

100% 조건:
- `/ads/site-landing`과 `/total`이 coffee actual을 source/status/warning과 함께 보여준다.
- coffee actual이 biocom correction 합계에 조용히 섞이지 않는다.
- source guide와 data inventory가 같은 source rule을 가리킨다.

실행 단계:
1. [Codex] `/total` data contract에 coffee source line을 추가하는 Green 설계를 만든다.
2. [Codex] 로컬 화면과 API response shape를 fixture로 고정한다.
3. [TJ] 운영 반영이 필요하면 Yellow deploy 승인 여부만 판단한다.

현재 진척률: 90%.

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-13 00:53 KST | pre-snapshot | coffee bridge_pending, biocom included 확인 |
| 2026-05-13 00:53 KST | remote backup | `.deploy-backups/gpt0508-49-20260513T005354KST` |
| 2026-05-13 00:56 KST | remote typecheck/build | PASS |
| 2026-05-13 00:56 KST | `seo-backend` restart | online |
| 2026-05-13 00:57 KST | post-snapshot | coffee included_with_warning, biocom included |
| 2026-05-13 02:02 KST | status blank root cause | VM Cloud SQLite `imweb_orders.imweb_status` status sync lag |
| 2026-05-13 02:12 KST | local dashboard smoke | `http://localhost:7010/ads/site-landing` 200, API 200, console error 0 |
| 2026-05-13 10:37 KST | 24h manual status monitor | dedicated auto monitor 없음, coffee actual 318건 / 15,503,000원, status blank 26건 |
| 2026-05-13 10:37 KST | `/total` correction line contract | backend/frontend contract v0.1 추가, coffee는 reference line |

## Source / Window / Freshness / Confidence

| 영역 | 값 |
|---|---|
| source | VM Cloud summary API, VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders`, local frontend smoke |
| window | coffee NPay recent 30d |
| freshness | post-snapshot 2026-05-13 00:57 KST, latest read-only 2026-05-13 10:37 KST, status sync stale warning present |
| confidence | 0.92 |
