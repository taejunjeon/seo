# 더클린커피 Imweb/GA4 source feasibility report

작성 시각: 2026-05-12 23:44 KST
상태: Green review 완료 / commit push 완료

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
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - imwebapi.md
    - data/!coffeedata.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green read-only feasibility review + checkpoint docs
  allowed_actions:
    - local code/doc inspection
    - local SQLite SELECT
    - VM Cloud SQLite SELECT
    - Imweb v2 read-only aggregate fetch
    - GA4 BigQuery read-only guard query
    - source guide patch
    - approval packet draft
    - feasibility report and approval packet drafting
  forbidden_actions:
    - operational DB write/import
    - VM Cloud write/schema migration/deploy/restart/cron change
    - GA4/Meta/TikTok/Google Ads/Naver send/upload
    - GTM publish
    - Imweb footer/header edit
    - secret or raw PII output
  source_window_freshness_confidence:
    source: "Imweb v2 API + VM Cloud SQLite imweb_orders + GA4 BigQuery analytics_326949178"
    window: "last 30 days, checked 2026-05-12 KST"
    freshness: "VM Cloud imweb_orders max_synced_at=2026-05-12 14:14:56, status max=2026-05-12 04:11:07"
    confidence: 0.90
```

## 사람이 이해하는 결론

더클린커피 NPay 매출을 화면에 실제 결제 기준으로 붙일 source는 있습니다. 운영DB `tb_iamweb_users`로는 site가 분리되지 않아 금지지만, 더클린커피 Imweb API와 VM Cloud `imweb_orders.site='thecleancoffee'`로 주문만 분리되는 source를 구축할 수 있습니다.

GA4는 결제 정본이 아닙니다. GA4 BigQuery는 주문번호가 이미 GA4에 들어갔는지 확인하는 중복 방지 guard로만 쓰고, `.env`의 GA4 Measurement Protocol secret은 실제 전송용이라 이번 작업에서 쓰지 않았습니다.

## 완료한 것

- compact 이후 루트 규칙과 하네스를 재확인했다.
- `imwebapi.md`에서 더클린커피 Imweb v2 API key/secret 경로와 `type=npay` NPay 조회 근거를 확인했다.
- `data/!coffeedata.md`와 coffee harness에서 `NPay actual order = Imweb v2 API type=npay primary`, `GA4 BigQuery = already_in_ga4 guard` 원칙을 확인했다.
- 현재 summary API가 coffee actual을 bridge_pending으로 두는 이유는 운영DB site 격리 미검증이라는 점을 코드에서 확인했다.
- VM Cloud `imweb_orders`에서 더클린커피 주문이 site별로 분리되어 있고, 최신 sync가 살아 있음을 확인했다.
- 직접 Imweb v2 `type=npay` read-only 조회로 최근 30일 337건 / ₩16,374,100을 확인했다.
- 취소 status 31건 / ₩1,796,400을 제외하면 paid non-cancel 후보는 306건 / ₩14,577,700이다. status blank 11건 / ₩619,800은 warning 또는 pending 처리 대상이다.
- GA4 BigQuery `analytics_326949178`에서 Imweb order/channel key 674개를 robust search했고 hit 0건임을 확인했다.
- source guide와 JSON 정본을 수정했고, Yellow 배포 승인안 초안을 만들었다.

## 프롬프트에 있었지만 실행하지 않은 것

- VM Cloud backend deploy/restart는 하지 않았다. live summary를 바꾸는 Yellow Lane이라 별도 승인 전 중지했다.
- GA4/Meta/TikTok/Google Ads/Naver 전송은 하지 않았다. 실제 전송은 Red Lane이다.
- 운영DB write/import, VM Cloud schema migration, cron 변경은 하지 않았다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| primary candidate | Imweb v2 API + VM Cloud `imweb_orders(site='thecleancoffee')` |
| guard | GA4 BigQuery `analytics_326949178` |
| window | last 30 days, checked 2026-05-12 KST |
| VM order freshness | `max_synced_at=2026-05-12 14:14:56` |
| VM status freshness | `max_imweb_status_synced_at=2026-05-12 04:11:07` |
| confidence | 90% |

## 주요 숫자

| 항목 | 값 |
|---|---:|
| Imweb v2 / VM Cloud coffee NPay gross | 337건 / ₩16,374,100 |
| 취소 제외 paid non-cancel 후보 | 306건 / ₩14,577,700 |
| status 확정 non-cancel | 295건 / ₩13,957,900 |
| 취소 제외 대상 | 31건 / ₩1,796,400 |
| status blank | 11건 / ₩619,800 |
| GA4 order/channel key hit | 0 / 674 |

## 금지선

- 실제 전송 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart/cron 변경 0건.
- GTM publish 0건.
- Imweb header/footer 변경 0건.
- secret/raw PII 출력 0건.

## 검증 결과

- JSON parse PASS.
- wiki link validation PASS.
- `python3 scripts/harness-preflight-check.py --strict` PASS.
- `git diff --check` PASS.
- no-send/no-write grep: 금지선 설명 문구만 match, 실행 코드 추가 없음.
- raw order id / PII pattern scan: output 0.

## 현재 영향 / 서버 · 커밋 상태

- live VM Cloud backend는 변경하지 않았다. 현재 live coffee summary는 그대로 `bridge_pending`이다.
- scoped commit/push 완료. 정확한 현재 HEAD는 `git rev-parse --short HEAD`로 확인한다.
- unrelated dirty file은 stage/commit에서 제외했다.

## 변경 파일

- `gdn/current-handoff.md`
- `data/current-state.json`
- `data/coffee-imweb-ga4-vm-source-feasibility-20260512.json`
- `gdn/coffee-imweb-ga4-vm-source-feasibility-20260512.md`
- `gdn/coffee-imweb-summary-inclusion-deploy-approval-20260512.md`
- `gdn/attribution-data-source-decision-guide-20260511.md`
- `data/attribution-data-source-decision-guide-20260511.json`
- `gptconfirm/gpt0508-48/00-result-report.md`
- `gptconfirm/gpt0508-48/manifest.json`

## 다음 할일

### Codex가 할 일

1. Green 로컬 patch
   - 무엇을: 더클린커피 summary actual reader를 VM Cloud `imweb_orders` 기반으로 추가한다.
   - 왜: live dashboard가 coffee NPay 매출을 계속 `bridge_pending`으로만 보지 않게 하기 위해서다.
   - 어떻게: `site='thecleancoffee'`, `pay_type='npay'`, `payment_amount>0`, 취소/반품/교환 제외, status blank warning을 테스트한다.
   - 의존성: 없음.
   - 승인 필요 여부: NO, 로컬 코드/test까지는 Green.
   - 성공 기준: typecheck/test PASS와 fixture PASS.
   - 실패 시 확인점: status blank 처리, ISO timestamp 비교, cancel exclusion.
   - 추천 점수/자신감: 92%.

2. Yellow deploy packet 실행 준비
   - 무엇을: 로컬 patch가 PASS하면 `gdn/coffee-imweb-summary-inclusion-deploy-approval-20260512.md` 기준으로 VM Cloud deploy/restart를 준비한다.
   - 왜: live API는 배포 전까지 바뀌지 않기 때문이다.
   - 어떻게: backup, build, restart, post-snapshot, rollback readiness 순서로 진행한다.
   - 의존성: 1번 로컬 patch/test PASS.
   - 승인 필요 여부: YES, backend deploy/restart.
   - 성공 기준: coffee actual included + no-send/no-write invariant.
   - 실패 시 확인점: API 5xx, actual field missing, cancel included, raw PII leak.
   - 추천 점수/자신감: 88%.

### TJ님이 할 일

1. live 반영 승인 여부 결정
   - 무엇을: 더클린커피 summary에 Imweb actual source를 붙이는 VM Cloud backend deploy/restart를 승인할지 결정한다.
   - 왜: 이 작업은 live API 응답을 바꾸는 Yellow Lane이다.
   - 어떻게: 승인하려면 대화창에 승인 문구를 그대로 보내면 된다. 문구는 `gdn/coffee-imweb-summary-inclusion-deploy-approval-20260512.md`에 있다.
   - 어디에서: 외부 화면 클릭 없이 이 대화에서 가능하다.
   - Codex가 대신 못 하는 이유: deploy/restart는 운영 접점이라 sprint 승인 전 실행 금지다.
   - 성공 기준: post-snapshot에서 coffee actual included가 보이고 invariant가 0으로 유지된다.
   - 실패 시 해석: 5xx 또는 wrong included면 rollback한다.
   - 추천 점수/자신감: 86%.
