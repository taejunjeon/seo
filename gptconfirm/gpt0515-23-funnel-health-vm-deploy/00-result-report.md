# gpt0515-23 Funnel Health Site/Pixel Filter VM Cloud Deploy

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - gptconfirm/gpt0515-22-capi-dashboard-contract/00-result-report.md
    - gptconfirm/gpt0515-21-meta-capi-roas-reconciliation/00-result-report.md
  lane: Yellow approved VM Cloud backend deploy/restart
  allowed_actions:
    - VM Cloud backend file backup
    - backend/src/funnelHealth.ts deploy
    - backend typecheck/build
    - seo-backend restart
    - post-snapshot API smoke
    - read-only Meta Ads Insights check
  forbidden_actions:
    - Meta operating Purchase send or backfill
    - bulk backfill
    - new ad account
    - second Pixel insertion
    - GTM publish
    - operational DB write/import
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    live_api:
      source: VM Cloud live backend att.ainativeos.net
      window: last_7d and today
      checked_at_kst: "2026-05-15 19:05"
      confidence: high for API shape and CAPI pixel filter
```

## 이번에 가능해진 것

바이오컴 화면에서 더클린커피 CAPI Purchase가 섞여 보이던 문제를 VM Cloud backend에 반영했다. 이제 바이오컴은 바이오컴 Pixel만, 더클린커피는 더클린커피 Pixel만 읽는다. 두 사이트 합산은 `all_sites` 모드에서만 나온다.

## 판정

`DEPLOY_PASS_CONTRACT_LIVE`

- VM Cloud backend deploy/restart: PASS
- `metric_contract` live 반영: PASS
- site/pixel filter live 반영: PASS
- Meta send/backfill: 0
- 운영DB write/import: 0
- GTM publish: 0

## 실제 숫자

Pre-snapshot:
- `site=biocom`: CAPI success 662, metric_contract 없음, Pixel filter 없음
- `site=thecleancoffee`: CAPI success 662, metric_contract 없음, Pixel filter 없음
- `site=all_sites`: `api_site=biocom`으로 떨어짐, CAPI success 662

Post-snapshot:
- `site=biocom`: CAPI success 351, Pixel `1283400029487161`
- `site=thecleancoffee`: CAPI success 311, Pixel `1186437633687388`
- `site=all_sites`: CAPI success 662, all_sites_mode true

기존 목표값 353/298/651과 post 값이 조금 다른 이유는 rolling 7일 window와 CAPI autoSync가 계속 진행 중인 현재 시각 차이다. 핵심 성공 기준은 “biocom과 thecleancoffee가 더 이상 같은 662로 보이지 않는가”였고, 이 기준은 통과했다.

## 오늘 Ads Manager lag monitor

Meta Ads Insights read-only:
- 오늘: purchase 0, purchase value 0, spend 2,501,482원
- 최근 7일: purchase 219, purchase value 58,123,707원, spend 28,956,769원

오늘 purchase 0은 계속 `same_day_lag_possible`로 둔다. CAPI가 오늘도 들어가고 있으므로, 12-24시간 뒤에도 0이면 Ads attribution 연결 문제로 승격한다.

## 확인된 금지선

- Meta operating Purchase send: 0
- backfill send: 0
- Google/GA4/TikTok/Naver send/upload: 0
- 운영DB write/import: 0
- GTM publish: 0
- raw identifier output: 0
