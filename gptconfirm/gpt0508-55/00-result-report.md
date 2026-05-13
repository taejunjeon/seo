# gpt0508-55 Result Report

작성 시각: 2026-05-13 19:12 KST  
작성자: Codex  
Lane: Green read-only investigation and design documentation

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/sprint1.md
    - project/sprint2.md
    - project/sprint3.md
    - harness/coffee-data/README.md
    - docs/agent-harness/growth-data-harness-v0.md
  lane: Green read-only
  allowed_actions:
    - VM Cloud API read-only
    - VM Cloud SQLite aggregate via existing read-only monitor
    - GA4 BigQuery read-only query runner
    - local CSV/JSON read-only analysis
    - documentation/checkpoint update
  forbidden_actions:
    - platform send/upload
    - Google Ads conversion action mutate
    - TikTok campaign/budget change
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
    - GTM publish
  source_window_freshness_confidence:
    source: "VM Cloud SQLite imweb_orders, VM Cloud Google Ads dashboard API, GA4 BigQuery archive+daily union, local TikTok API export CSV"
    window: "coffee rolling 30d; Google Ads last_7d/last_30d; GA4 latest 7/14/30d through 2026-05-12; TikTok export 2026-05-07~2026-05-12"
    freshness: "2026-05-13 19:12 KST"
    confidence: 0.9
```

## 한 줄 결론

Sprint 1~3에서 바로 진행 가능한 Green 조사는 끝냈고, coffee는 status sync 지연 모니터링, Google Ads는 Option 3 Red 승인 필요성 유지, TikTok은 최근 6일 spend-quality 기준으로도 품질 위험 지속이라는 판단까지 문서에 반영했다.

## 완료한 것

1. Sprint 1 coffee actual status monitor를 최신 read-only로 재실행했다.
   - source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders`.
   - 결과: 315건 / 15,477,100원.
   - `status blank`: 32건 / 1,983,600원.
   - 해석: `imweb_orders.imweb_status`가 비어 있는 row이며, 결제 실패가 아니라 status 보강 sync 지연으로 분류한다.

2. Sprint 2 ROAS gap과 Google Ads Option 3 승인안 숫자를 최신화했다.
   - last_30d Google Ads 주장 ROAS: 10.2789.
   - 내부 current ROAS: 0.2924.
   - biocom NPay actual 반영 내부 예산 판단 ROAS: 2.0792.
   - 남은 gap: 8.1997p.
   - Coffee actual은 campaign/site spend mapping이 없어서 budget ROAS에는 넣지 않고 reference_only로 유지했다.

3. Sprint 3 channel funnel을 최신 GA4 7/14/30일로 다시 돌렸다.
   - last_7d/14d/30d 모두 coverage PASS.
   - paid_tiktok sessions: 10,575 / 28,806 / 152,673.
   - TikTok export 2026-05-07~2026-05-12와 GA4 paid_tiktok을 semantic join했다.
   - 최근 6일 TikTok spend 140,850원, clicks 5,754건, platform purchase 0원, GA4 paid_tiktok purchase 1건 / 225,300원.

## 하지 않은 것

- Google Ads 전환 action 변경, upload, send는 하지 않았다.
- TikTok 광고 ON/OFF, 예산, 캠페인 설정은 바꾸지 않았다.
- 운영DB write/import, VM Cloud SQLite write/schema migration은 하지 않았다.
- GTM publish, Imweb footer/header 변경은 하지 않았다.

## 검증 결과

- JSON parse PASS.
- `validate_wiki_links.py` PASS.
- `harness-preflight-check.py --strict` PASS.
- `git diff --check` PASS.
- raw identifier scan PASS. 새 evidence JSON의 service account email 필드는 `[redacted-service-account-email]`로 마스킹했다.
- code path 변경 없음. backend/frontend typecheck는 이번 문서·evidence 작업 범위에서 실행 대상이 아니다.

## 현재 영향

운영 서버 동작에는 영향이 없다. 이번 작업은 로컬 문서와 evidence JSON/Markdown 생성·갱신만 했다. 외부 플랫폼 숫자나 운영 DB 데이터는 변경하지 않았다.

## 남은 리스크

- Coffee actual은 주문 sync는 최신이지만 VM Cloud SQLite `imweb_orders.imweb_status` sync가 29.63h 늦어 `included_with_warning` 상태다.
- Google Ads Option 3은 실행하면 Red Lane이다. 승인 전에는 문서와 no-send dry-run까지만 가능하다.
- TikTok은 campaign name semantic join까지는 됐지만 GA4에 TikTok `campaign_id` exact가 없어 campaign/day exact 판단은 아직 미완성이다.

## 확인하면 좋은 문서

1. `project/sprint1.md` — coffee status blank가 왜 비어 있고 어떤 숫자로 추적 중인지 확인할 문서.
2. `project/sprint2.md` — Google Ads ROAS gap과 coffee reference_only 기준을 확인할 문서.
3. `project/sprint3.md` — TikTok funnel/spend-quality 최신 판정과 다음 exact join 조건을 확인할 문서.

## 다음 할일

### Codex가 할 일

1. Coffee status monitor cron 승인안을 분리 작성한다.
   - 왜: status blank가 계속 늘면 포함 매출 신뢰도가 낮아진다.
   - 성공 기준: daily monitor JSON에 blank count/amount/status lag가 쌓이고 raw identifier가 없다.
   - 승인 필요 여부: cron 등록은 Yellow.
   - 추천 점수/자신감: 86%.

2. Google Ads Option 3 no-send guard를 더 보강한다.
   - 왜: Red 실행 전에 upload/send 없이 후보 품질과 중복 방지를 확인해야 한다.
   - 성공 기준: 후보 수, duplicate guard, rollback 조건이 approval packet에 들어간다.
   - 승인 필요 여부: 문서와 dry-run은 Green, 실제 Google Ads 변경은 Red.
   - 추천 점수/자신감: 82%.

3. TikTok UTM `campaign_id` exact rule을 설계한다.
   - 왜: campaign name semantic join만으로는 campaign/day 예산 판단이 약하다.
   - 성공 기준: TikTok landing URL에서 GA4 BigQuery까지 campaign_id exact가 들어오는지 7일 후 검증할 수 있다.
   - 승인 필요 여부: 문서 설계는 Green, 광고 URL 변경은 Yellow/Red 별도 판단.
   - 추천 점수/자신감: 78%.

### TJ님이 할 일

1. 지금은 승인할 운영 변경이 없다. 문서 확인만 하면 된다.
   - 왜: 이번 작업은 Green read-only라 실제 설정 변경이 없었다.
   - 어디에서: 위 `확인하면 좋은 문서` 3개.
   - 성공 기준: coffee는 reference/monitor, Google Ads는 Red 승인 대기, TikTok은 exact join 필요라는 방향이 맞는지 판단.
   - Codex가 대신 못 하는 이유: 사업적 우선순위와 Red 실행 승인 여부는 TJ님 결정이다.
   - 추천 점수/자신감: 90%.
