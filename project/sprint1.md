# Sprint 1. Coffee Actual Source Patch

작성 시각: 2026-05-13 01:08 KST
상태: live 배포 완료 / post-snapshot PASS
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
  lane: Yellow approved VM deploy/restart completed
  allowed_actions:
    - approved backend file deploy
    - backend typecheck/build
    - seo-backend restart
    - summary API post-snapshot validation
    - Green documentation
  forbidden_actions:
    - operational DB write/import
    - VM Cloud schema migration
    - platform send/upload
    - GTM publish
    - Imweb footer/header edit
  source_window_freshness_confidence:
    source: "VM Cloud summary API + VM Cloud SQLite imweb_orders + local tests"
    window: "thecleancoffee NPay last 30d, post-snapshot 2026-05-13 00:57 KST"
    freshness: "summary API live after seo-backend restart; status sync warning still present"
    confidence: 0.91
```

## 10초 요약

더클린커피 NPay 매출은 더 이상 live summary API에서 `bridge_pending`만 보지 않는다. 승인된 배포 후 live API가 Imweb v2 / VM Cloud `imweb_orders`를 actual source 후보로 읽고, status blank와 stale status sync를 warning으로 같이 보여준다. 다음 행동은 이 숫자를 ROAS gap 재계산과 `/total` 운영 화면 기준에 연결하는 것이다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase1-Sprint1]] | coffee NPay actual source를 live summary API에 붙인다 | coffee 매출이 bridge_pending에 갇히면 전체 내부 매출과 ROAS 판단이 낮게 나온다 | reader patch, test, VM deploy, post-snapshot 순서로 닫는다 | 완료 | 100% | coffee actual source/status/count가 live API에 보이고 biocom regression이 없다 | 완료. Sprint 2에서 ROAS gap 재계산에 연결 | NO, 완료 | [[../gptconfirm/gpt0508-49/00-result-report]] |
| P0 | [[#Phase1-Sprint2]] | status blank를 warning으로 운영한다 | blank status를 미결제로 단정하면 매출을 누락하고, 확정으로 숨기면 취소 반영 리스크가 생긴다 | `included_with_warning`과 status_blank_count/amount/freshness warning을 같이 표시한다 | 완료 | 95% | status sync가 fresh해지거나 blank row가 줄어도 정책이 유지된다 | Codex: 24h monitor 문서화 | NO, Green | [[../gptconfirm/gpt0508-49/02-source-analysis-and-dry-run]] |
| P1 | [[#Phase1-Sprint3]] | coffee actual을 운영 대시보드와 전체 장부에 반영한다 | summary API만 바뀌고 화면/월별 장부가 안 쓰면 운영 기준이 바뀌지 않는다 | `/ads/site-landing`, `/total`, ROAS recompute input에 source/status/freshness를 붙인다 | 대기 | 40% | 운영자가 coffee actual, blank warning, bridge_pending을 한 화면에서 본다 | Codex + Claude Code: UI/contract 확인 | 추후 Yellow 가능 | [[../project/sprint2]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 24h coffee actual freshness monitor
- 무엇을 하는가: live summary API에서 coffee actual count, amount, status_blank, warnings를 24시간 후 다시 본다.
- 왜 하는가: status blank 14건과 `status_sync_stale_over_6h`가 줄어드는지 확인해야 한다.
- 어떻게 하는가: `curl https://att.ainativeos.net/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24`를 저장하고 post-snapshot과 비교한다.
- 성공 기준: summary API 200, source 유지, cancel included 없음, raw identifier 노출 0.
- 실패 시 다음 확인점: Imweb status sync, `imweb_orders.imweb_status_synced_at`, reader warning logic.
- 승인 필요 여부: NO, read-only.
- 산출물: `data/project/coffee-actual-24h-monitor-YYYYMMDD.json`.
- 진척률에 미치는 영향: Phase1-Sprint2 95% -> 100%.
- 의존성: 배포 완료.

#### A2. coffee actual을 ROAS gap recompute input으로 연결
- 무엇을 하는가: Sprint 2의 internal confirmed revenue 계산에 coffee actual 309건 / 14,902,800원을 별도 line으로 둔다.
- 왜 하는가: Google Ads/Meta/GA4 플랫폼 주장값과 내부 매출값을 같은 기준으로 비교하려면 site별 actual source가 필요하다.
- 어떻게 하는가: biocom operational DB actual, coffee Imweb actual, bridge_pending, legacy complete_time을 분리한 input matrix를 만든다.
- 성공 기준: `platform_reference`와 `internal_confirmed`가 같은 문단에서 섞이지 않는다.
- 실패 시 다음 확인점: coffee included_with_warning을 확정 매출로 볼지 provisional로 볼지 표시 누락.
- 승인 필요 여부: NO, Green.
- 산출물: [[../project/sprint2]].
- 진척률에 미치는 영향: Track B/D/E 상승.
- 의존성: Sprint 1 post-snapshot PASS.

### Approval Needed

#### B1. frontend/site-landing 화면 재시작 확인
- 무엇을 하는가: `/ads/site-landing` 프론트가 live API의 새 coffee fields를 제대로 보여주는지 확인한다.
- 왜 하는가: backend는 반영됐지만 현재 로컬 7010은 HTTP timeout 상태였다.
- 어떻게 하는가: 로컬 또는 VM frontend restart 후 `http://localhost:7010/ads/site-landing` 직접 확인.
- 성공 기준: coffee actual source/status/count/status blank warning이 화면에 보인다.
- 실패 시 다음 확인점: Next route, API base URL, frontend process health.
- 승인 필요 여부: 서버 재시작이 필요하면 YES.
- 산출물: screenshot 또는 smoke result.
- 진척률에 미치는 영향: Track F Dashboard +10%.
- 의존성: backend live PASS 완료.

### Blocked/Parked

#### C1. coffee GA4/Meta/Google/TikTok/Naver purchase send
- 무엇을 하는가: 외부 플랫폼에 coffee purchase를 보내는 작업.
- 왜 보류하는가: actual source patch는 매출 정본을 읽는 작업이고, 외부 전송은 숫자를 바꾸는 Red Lane이다.
- 재개 조건: A-6 dry-run, already_in_ga4 guard, duplicate guard, TJ Red 승인.
- 승인 필요 여부: YES, Red.

## 현재 기준 숫자

| 항목 | pre-snapshot | post-snapshot |
|---|---:|---:|
| coffee actual source | unavailable | `imweb_v2_vm_cloud_imweb_orders` |
| coffee actual status | bridge_pending | included_with_warning |
| coffee actual count | 0 | 309 |
| coffee actual amount | 0원 | 14,902,800원 |
| coffee status blank | 미노출 | 14건 / 944,900원 |
| coffee bridge_pending | 79건 / 5,546,400원 | 79건 / 5,546,400원 |
| biocom actual source | operational DB PAYMENT_COMPLETE | operational DB PAYMENT_COMPLETE |
| biocom actual status | included | included |
| biocom actual count | 162 | 162 |
| biocom actual amount | 29,463,300원 | 29,463,300원 |

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase1-Sprint1

**이름**: Coffee actual source live patch

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 더클린커피 NPay 실제 결제 후보를 live summary API가 읽게 만드는 것이다.

완료한 것:
- local patch/test/commit `5359a47`.
- remote backup 생성.
- VM backend 3파일 배포.
- remote typecheck/build PASS.
- `seo-backend` restart PASS.
- post-snapshot PASS.

100% 조건:
- coffee actual source가 live API에서 `imweb_v2_vm_cloud_imweb_orders`로 보인다.
- biocom actual이 깨지지 않는다.
- external send/upload/write/publish가 0이다.

현재 진척률: 100%.

### Phase1-Sprint2

**이름**: Status blank warning policy

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 status blank를 숨기지 않고, 매출 누락도 만들지 않는 것이다.

정책:
- `status blank`는 `imweb_status`가 비어 있다는 뜻이다.
- 미결제 단정 금지.
- 취소/반품/교환이 아니고 NPay positive amount이면 `included_with_warning`에 포함한다.
- `status_blank_count`, `status_blank_amount`, `status_sync_stale_over_6h`를 같이 보여준다.

현재 진척률: 95%. 24h monitor가 끝나면 100%다.

### Phase1-Sprint3

**이름**: Dashboard and total ledger adoption

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 API 결과를 운영자가 보는 화면과 전체 장부 기준에 연결하는 것이다.

현재 상태:
- backend API는 live PASS.
- frontend source는 있으나 현재 로컬 7010 응답이 timeout이었다.
- `/total` 전체 장부에는 아직 coffee included_with_warning을 어떻게 표시할지 추가 설계가 필요하다.

현재 진척률: 40%.

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-13 00:53 KST | pre-snapshot | coffee bridge_pending, biocom included 확인 |
| 2026-05-13 00:53 KST | remote backup | `.deploy-backups/gpt0508-49-20260513T005354KST` |
| 2026-05-13 00:56 KST | remote typecheck/build | PASS |
| 2026-05-13 00:56 KST | `seo-backend` restart | online |
| 2026-05-13 00:57 KST | post-snapshot | coffee included_with_warning, biocom included |

## Source / Window / Freshness / Confidence

| 영역 | 값 |
|---|---|
| source | VM Cloud summary API, VM Cloud SQLite `imweb_orders`, local tests |
| window | coffee NPay recent 30d |
| freshness | post-snapshot 2026-05-13 00:57 KST, status sync stale warning present |
| confidence | 0.91 |
