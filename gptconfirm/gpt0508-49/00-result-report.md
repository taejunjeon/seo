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
    - harness/coffee-data/AUDITOR_CHECKLIST.md
    - harness/npay-recovery/README.md
  lane: Yellow approved VM deploy/restart completed + Green docs/planning
  allowed_actions:
    - local backend code patch
    - fixture/test/typecheck
    - VM Cloud SQLite read-only query
    - source guide/data inventory/total current update
    - gptconfirm packaging
    - scoped commit/push
    - approved VM backend deploy/restart for the 3 scoped files
  forbidden_actions:
    - VM backend deploy/restart outside approved scope
    - operational DB write/import
    - VM Cloud schema migration
    - cron registration/change
    - GTM publish
    - Imweb footer/header edit
    - GA4/Meta/TikTok/Google Ads/Naver send/upload
    - secret/raw email/phone/member_code/order/payment/click_id output
  source_window_freshness_confidence:
    source: VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders + live summary API + local/remote backend validation
    window: thecleancoffee NPay last 30 days, post-snapshot checked 2026-05-13 00:57 KST, latest read-only checked 2026-05-13 10:37 KST
    freshness: live coffee post-snapshot=309/14902800, latest read-only=318/15503000, status_blank=26/1663600, warnings include status_sync_stale_over_6h
    confidence: 0.92
```

## 한 줄 결론

- 결론: 더클린커피 NPay 매출을 `bridge_pending`에서 live actual included 후보로 올리는 VM backend 배포/restart까지 PASS했다. 롤백 조건은 발생하지 않았고, ROAS gap 재계산, 24h status monitor 수동 확인, `/total` correction line contract까지 Green 범위에서 진행했다.
- Project: gpt0508-49 Codex Coffee Imweb Actual Source Patch Sprint
- Lane: Yellow 승인 범위 배포 완료, Green 후속 문서/계획 진행
- Mode: approved deploy / read-only validation / no-send / no-write
- Auditor verdict: `LIVE_DEPLOY_PASS_NO_ROLLBACK`
- 현재 판정: coffee actual source는 `imweb_v2_vm_cloud_imweb_orders`로 live summary API에 포함됐다. status blank 때문에 `included_with_warning`으로 표시하고, `/total`에서는 `included_in_budget_roas=false` reference line으로 분리한다.
- 자신감: 92%
- 기준 시각: 2026-05-13 10:47 KST

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| 더클린커피 actual reader | 완료 + VM 배포 | `backend/src/npayActualConfirmedPgReader.ts` | 로컬 코드 / VM backend |
| summary API response shape | 완료 + VM 배포 | `backend/src/routes/attribution.ts`, `backend/src/siteLandingLedger.ts` | 로컬 코드 / VM backend |
| fixture/test | 완료 | targeted test 16/16 PASS | 로컬 테스트 DB |
| VM Cloud dry-run | 완료 | 최근 30일 coffee NPay 재계산 | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders` |
| pre-snapshot/remote backup | 완료 | `data/gpt0508-49-live-snapshots/`, `.deploy-backups/gpt0508-49-20260513T005354KST` | live API / VM repo |
| approved VM deploy/restart | 완료 | remote typecheck/build PASS, `seo-backend` restart online | VM backend |
| post-snapshot | 완료 | coffee/biocom summary API PASS, `/health` 200 | live API |
| source rule 문서화 | 완료 | data inventory, source guide, coffee current, total current | 로컬 문서 |
| dashboard 상태 확인/고도화 | 완료 | `http://localhost:7010/ads/site-landing` 200, Playwright smoke PASS | 로컬 프론트/백엔드, live backend API |
| ROAS gap recompute | 완료 | last_7d/last_30d read-only 재계산 | VM Cloud Google Ads dashboard API, VM Cloud SQLite coffee aggregate |
| 24h status monitor | 완료 | dedicated cron 없음, 수동 read-only monitor PASS | VM Cloud cron/read-only SQLite |
| `/total` correction line | 완료 | API contract v0.2 + frontend 보정 라인 섹션 | 로컬 backend/frontend |

## 실제 숫자

live post-snapshot 기준 더클린커피 최근 30일 NPay actual confirmed는 `included_with_warning` 309건 / 14,902,800원이다. source는 `imweb_v2_vm_cloud_imweb_orders`다. 2026-05-13 10:37 KST latest read-only 기준은 318건 / 15,503,000원이고 status blank는 26건 / 1,663,600원이다. warnings에는 `ga4_guard_not_actual_source`, `status_blank_rows_included_with_warning`, `status_sync_stale_over_6h`가 들어 있다.

배포 전에는 coffee actual이 `bridge_pending`이었고 bridge pending은 79건 / 5,546,400원이었다. 배포 후에는 actual candidate가 포함됐고 bridge pending diagnostic은 그대로 유지된다. biocom actual confirmed는 166건 / 29,642,500원으로 기존 운영DB PostgreSQL `dashboard.public.tb_iamweb_users PAYMENT_COMPLETE` source와 `included` 상태를 유지했다.

`status blank`는 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders.imweb_status`가 비어 있다는 뜻이다. 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`의 결제 상태 blank가 아니다. 이번 확인에서 blank row 26건은 모두 `imweb_status_synced_at` marker가 없고, order sync는 `2026-05-13 01:30:03`까지 진행됐지만 status sync는 `2026-05-12 04:11:07`에 멈춰 있어 원인은 `source_freshness_gap/status sync lag`다.

전용 24h coffee actual status monitor는 자동으로 돌고 있지 않았다. VM Cloud cron의 `/home/biocomkr_sns/seo/coffee-monitoring/run.sh`는 기존 NPay intent 모니터라 더클린커피 actual `imweb_status` blank 모니터가 아니다. Cron 등록/변경은 하지 않았다.

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| rollback | 실패 조건이 없었음 | 실패 시에만 YES |
| 운영DB write/import | 범위 밖이고 금지 | YES |
| 외부 플랫폼 send/upload | GA4/광고 전환값 변경 방지 | YES |
| GTM publish / Imweb footer 변경 | 범위 밖이고 금지 | YES |
| 운영 프론트 배포 | 로컬 화면은 고도화/검증했지만 운영 프론트 deploy는 이번 승인 범위 밖 | 필요 시 YES |

## 검증 결과

| 검증 | 결과 | 명령/방법 | 비고 |
|---|---|---|---|
| backend typecheck | PASS | `cd backend && npm run typecheck` | 2026-05-13 |
| remote backend typecheck/build | PASS | VM backend `npm run typecheck && npm run build` | 배포 전 remote에서 실행 |
| targeted backend tests | PASS | `npx tsx --test tests/npay-actual-confirmed-pg-reader.test.ts tests/site-landing-npay-actual-source.test.ts tests/site-landing-summary-api.test.ts` | 16/16 PASS |
| live summary API | PASS | coffee/biocom post-snapshot | summary API 200 |
| live health | PASS | `https://att.ainativeos.net/health` | `/api/health`는 route_not_found |
| VM Cloud dry-run | PASS | read-only SQLite aggregate | no raw order id output |
| source guide consistency | PASS | data inventory/source guide/total current update | GA4 guard-only 명시 |
| AGENTS.md requested rules | PASS | file check | 이미 반영됨 |
| JSON parse | PASS | manifest/current-state/dry-run JSON parse |  |
| wiki links | PASS | `scripts/validate_wiki_links.py` 대상 문서 실행 |  |
| harness preflight strict | PASS | `python3 scripts/harness-preflight-check.py --strict` |  |
| diff whitespace | PASS | `git diff --check` |  |
| raw identifier scan | PASS | gptconfirm/data handoff context scan | campaign id는 raw order/payment/click id가 아님 |
| frontend typecheck | PASS | `cd frontend && npx tsc --noEmit` |  |
| page-scoped eslint | PASS | `cd frontend && npx eslint src/app/ads/site-landing/page.tsx` | repo-wide lint는 기존 unrelated issue로 FAIL |
| local dashboard smoke | PASS | Playwright `http://localhost:7010/ads/site-landing` | API 200, console error 0 |
| `/total` correction line test | PASS | `npx tsx --test tests/total-correction-lines.test.ts ...` | coffee line `included_in_budget_roas=false` |
| `/total` local smoke | PASS | `http://localhost:7010/total`, `http://localhost:7020/api/total/monthly-channel-summary...` | API v0.2, screenshot 저장 |

## 대시보드 상태

프론트 대시보드는 백엔드 설계만 있는 상태가 아니다. 로컬 확인 주소는 `http://localhost:7010/ads/site-landing`이고, 현재 화면은 live API를 기본으로 읽는다. coffee/biocom site selector, 24h/72h/168h window selector, actual/legacy/bridge/status blank/warning card를 보여준다. 화면 smoke는 Playwright로 PASS했고 screenshot은 `data/project/site-landing-dashboard-20260513.png`에 저장했다.

`/total` 로컬 화면도 있다. 주소는 `http://localhost:7010/total`이며, 로컬 backend `http://localhost:7020/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run`에서 contract `total-monthly-channel-summary-v0.2`와 `correction_lines`를 읽는다. 커피 line은 318건 / 15,503,000원, status blank 26건 / 1,663,600원, `included_in_budget_roas=false`로 보인다. screenshot은 `data/project/total-correction-lines-20260513.png`다.

TJ님 브라우저 콘솔의 Ton/Tron/Ethereum/Polkadot 로그는 지갑 확장 프로그램 noise다. 실제 장애 원인은 로컬 backend 7020의 오래된 프로세스가 `/api/attribution/site-landing/summary`를 404로 돌려주던 것이었다. backend를 재기동한 뒤 summary API 200으로 복구됐다.

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| No-send verified | YES |
| No-write verified | YES |
| Approved deploy scoped | YES |
| No-publish verified | YES |
| No-platform-send verified | YES |

## 확인하면 좋은 문서

1. `gptconfirm/gpt0508-49/01-implementation-and-validation.md` — 어떤 파일이 바뀌었고 어떤 테스트/remote build로 막았는지 확인한다.
2. `gptconfirm/gpt0508-49/02-source-analysis-and-dry-run.md` — 더클린커피 source와 status blank 의미를 확인한다.
3. `gptconfirm/gpt0508-49/03-next-actions-and-approval.md` — 실제 배포 결과, backup 위치, rollback 조건을 확인한다.

## 다음 할일

### Codex가 할 일

1. 전용 coffee status monitor 스크립트/cron 판단
- Codex 추천: script 먼저, cron은 승인 후
- 추천 이유: 현재 dedicated monitor는 없고 수동 확인만 완료됐다. 자동화하려면 VM Cloud cron 변경이므로 승인 게이트가 필요하다.
- 추천 방향에 대한 자신감: 88%
- Lane: script는 Green, cron 등록은 Yellow
- 무엇을 하는가: summary API + VM Cloud SQLite aggregate를 같은 JSON shape로 출력하는 monitor script를 만들고, cron 등록 여부는 별도 승인안으로 판단한다.
- 성공 기준: status blank count/amount, max_status_synced_at, raw identifier 0, send/write 0이 매 실행 저장된다.
- 실패 시 해석/대응: status sync가 계속 멈추면 Imweb v2 status sync job 점검 승인안으로 넘긴다.
- 승인 필요: script는 NO, cron 등록은 YES.

2. `/total` 운영 반영 판단
- Codex 추천: 로컬 확인 후 Yellow 승인 판단
- 추천 이유: 로컬 backend/frontend는 PASS했지만 운영 backend/frontend 배포는 별도 영향이 있다.
- 추천 방향에 대한 자신감: 86%
- Lane: 운영 deploy/restart는 Yellow
- 무엇을 하는가: `correction_lines` v0.1을 운영 `/total`에 반영할지 결정한다.
- 성공 기준: coffee line이 `included_in_budget_roas=false`로 보이고 biocom 예산 ROAS 합계에 자동 가산되지 않는다.
- 실패 시 해석/대응: API contract mismatch면 운영 배포 전 로컬 route schema만 보정한다.
- 승인 필요: YES, 운영 deploy/restart가 필요할 때만.

### TJ님이 할 일

1. 로컬 프론트 대시보드 확인
- Codex 추천: 조건부 진행 추천
- 추천 이유: backend API는 PASS했지만 실제 사람이 보는 화면이 이 필드를 표시하는지는 별도 확인이 필요하다.
- 추천 방향에 대한 자신감: 80%
- Lane: Green if local read-only only, Yellow if operating frontend deploy/restart is needed.
- 무엇을 하는가: `http://localhost:7010/ads/site-landing`에서 actual/legacy/bridge/warnings가 보이는지 확인한다.
- 왜 필요한가: backend는 숫자를 내려주지만, 화면이 warnings를 숨기면 status blank 리스크가 사용자에게 전달되지 않는다.
- 성공 기준: coffee actual source/status/count/amount/warnings가 사람이 읽을 수 있게 표시된다.
- Codex가 대신 못 하는 이유: 로컬 자동 smoke는 이미 했다. TJ님 브라우저에서 보이는지 최종 육안 확인은 사용자 환경 확인이라 TJ님 액션이 필요하다.

텔레그램 발송은 사용자 skip 유지로 실행하지 않았다.
