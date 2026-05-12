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
    source: VM Cloud SQLite imweb_orders + live summary API + local/remote backend validation
    window: thecleancoffee NPay last 30 days, post-snapshot checked 2026-05-13 00:57 KST
    freshness: live coffee actual=309/14902800, status_blank=14/944900, warnings include status_sync_stale_over_6h
    confidence: 0.91
```

## 한 줄 결론

- 결론: 더클린커피 NPay 매출을 `bridge_pending`에서 live actual included 후보로 올리는 VM backend 배포/restart까지 PASS했다. 롤백 조건은 발생하지 않았고, 이제 다음 단계는 ROAS gap 재계산과 프론트 대시보드 확인이다.
- Project: gpt0508-49 Codex Coffee Imweb Actual Source Patch Sprint
- Lane: Yellow 승인 범위 배포 완료, Green 후속 문서/계획 진행
- Mode: approved deploy / read-only validation / no-send / no-write
- Auditor verdict: `LIVE_DEPLOY_PASS_NO_ROLLBACK`
- 현재 판정: coffee actual source는 `imweb_v2_vm_cloud_imweb_orders`로 live summary API에 포함됐다. status blank 때문에 `included_with_warning`으로 표시한다.
- 자신감: 91%
- 기준 시각: 2026-05-13 01:12 KST

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| 더클린커피 actual reader | 완료 + VM 배포 | `backend/src/npayActualConfirmedPgReader.ts` | 로컬 코드 / VM backend |
| summary API response shape | 완료 + VM 배포 | `backend/src/routes/attribution.ts`, `backend/src/siteLandingLedger.ts` | 로컬 코드 / VM backend |
| fixture/test | 완료 | targeted test 16/16 PASS | 로컬 테스트 DB |
| VM Cloud dry-run | 완료 | 최근 30일 coffee NPay 재계산 | VM Cloud SQLite `imweb_orders` |
| pre-snapshot/remote backup | 완료 | `data/gpt0508-49-live-snapshots/`, `.deploy-backups/gpt0508-49-20260513T005354KST` | live API / VM repo |
| approved VM deploy/restart | 완료 | remote typecheck/build PASS, `seo-backend` restart online | VM backend |
| post-snapshot | 완료 | coffee/biocom summary API PASS, `/health` 200 | live API |
| source rule 문서화 | 완료 | data inventory, source guide, coffee current, total current | 로컬 문서 |
| dashboard 상태 확인 | 완료 | 프론트 소스 존재, 현재 확실한 접속점은 live backend API | 로컬 프론트/백엔드, live backend API |

## 실제 숫자

live post-snapshot 기준 더클린커피 최근 30일 NPay actual confirmed는 `included_with_warning` 309건 / 14,902,800원이다. source는 `imweb_v2_vm_cloud_imweb_orders`다. status blank는 14건 / 944,900원이고, warnings에는 `ga4_guard_not_actual_source`, `status_blank_rows_included_with_warning`, `status_sync_stale_over_6h`가 들어 있다.

배포 전에는 coffee actual이 `bridge_pending`이었고 bridge pending은 79건 / 5,546,400원이었다. 배포 후에는 actual candidate가 포함됐고 bridge pending diagnostic은 그대로 유지된다. biocom actual confirmed는 162건 / 29,463,300원으로 기존 운영DB `PAYMENT_COMPLETE` source와 `included` 상태를 유지했다.

`status blank`는 `imweb_status`가 비어 있다는 뜻이다. 이것만으로 미결제라고 보면 안 된다. 이번 패치는 blank row를 포함하되 `status_blank_count`, `status_blank_amount`, `status_sync_stale_over_6h` warning을 같이 내려주는 정책이다.

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| rollback | 실패 조건이 없었음 | 실패 시에만 YES |
| 운영DB write/import | 범위 밖이고 금지 | YES |
| 외부 플랫폼 send/upload | GA4/광고 전환값 변경 방지 | YES |
| GTM publish / Imweb footer 변경 | 범위 밖이고 금지 | YES |
| 로컬/운영 프론트 배포 | 이번 승인 범위는 backend 3파일 배포/restart | 필요 시 YES |

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

## 대시보드 상태

프론트 대시보드 코드는 있다. 위치는 `frontend/src/app/ads/site-landing/page.tsx`이고 예상 로컬 URL은 `http://localhost:7010/ads/site-landing`이다. 현재 확실히 검증된 접속점은 live backend API `https://att.ainativeos.net/api/attribution/site-landing/summary`다.

즉 “백엔드 설계만 있다”는 상태는 아니다. 프론트 페이지 소스까지 있다. 다만 현재 실행 중인 로컬 프론트가 정상 렌더링되는지는 미확인이고, live 프론트 공개 URL도 확인되지 않았다. 원래 Claude Code로 프론트 구현/연결을 계획했던 판단은 여전히 맞다.

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

1. 24시간 coffee actual monitor
- Codex 추천: 바로 진행 추천
- 추천 이유: live 반영은 PASS지만 status sync stale warning이 남아 있어 하루 동안 count/amount/warning 변동을 확인해야 한다.
- 추천 방향에 대한 자신감: 92%
- Lane: Green
- 무엇을 하는가: `site=thecleancoffee` summary API를 read-only로 다시 확인하고 309건 / 14,902,800원 근처가 유지되는지 본다.
- 성공 기준: API 200, source 유지, status `included_with_warning`, raw identifier 노출 0, cancel/return/exchange included 0.
- 실패 시 해석/대응: count 급변은 sync freshness/취소 반영/필터 변경을 분리해 조사한다.
- 승인 필요: NO, read-only다.

2. ROAS gap recompute
- Codex 추천: 바로 진행 추천
- 추천 이유: coffee actual이 live에 붙었으므로 Google Ads 플랫폼 주장 ROAS와 내부 confirmed ROAS를 다시 분리할 수 있다.
- 추천 방향에 대한 자신감: 88%
- Lane: Green
- 무엇을 하는가: `project/sprint2.md` 기준으로 last_7d/last_30d ROAS gap에 coffee actual line item을 붙인다.
- 성공 기준: 예산 판단값과 참고값이 분리되고, GA4 revenue를 actual source로 쓰지 않는다.
- 실패 시 해석/대응: campaign_id coverage 부족이면 no-send mapping 확장으로 분리한다.
- 승인 필요: NO, read-only/dry-run이다.

### TJ님이 할 일

1. 프론트 대시보드 확인/승인 여부 결정
- Codex 추천: 조건부 진행 추천
- 추천 이유: backend API는 PASS했지만 실제 사람이 보는 화면이 이 필드를 표시하는지는 별도 확인이 필요하다.
- 추천 방향에 대한 자신감: 80%
- Lane: Yellow if deploy/restart is needed, Green if local read-only only.
- 무엇을 하는가: `frontend/src/app/ads/site-landing/page.tsx` 기준 화면에서 actual/legacy/bridge/warnings가 보이는지 확인한다.
- 왜 필요한가: backend는 숫자를 내려주지만, 화면이 warnings를 숨기면 status blank 리스크가 사용자에게 전달되지 않는다.
- 성공 기준: coffee actual source/status/count/amount/warnings가 사람이 읽을 수 있게 표시된다.
- Codex가 대신 못 하는 이유: 운영 프론트 배포나 외부 브라우저 계정 접근이 필요하면 TJ님 승인/접속권한이 필요하다. 로컬 확인은 Codex가 계속할 수 있다.

텔레그램 발송은 사용자 skip 유지로 실행하지 않았다.
