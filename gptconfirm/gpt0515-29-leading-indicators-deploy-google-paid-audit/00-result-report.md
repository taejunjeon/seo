harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
  project_harness_read:
    - AGENTS.md
    - frontrule.md
  required_context_docs:
    - gptconfirm/gpt0515-28-capi-report-frontend-hardening/00-result-report.md
    - capivm/meta-utm-source-bucket-audit-20260519.md
  lane: Yellow
  allowed_actions:
    - frontend leading-indicators scoped file deploy
    - VM Cloud frontend build/restart
    - read-only SQLite aggregate audit
    - live API smoke
  forbidden_actions:
    - Meta/GA4/Google/Naver/TikTok send
    - GTM publish
    - 운영DB write/import
    - VM Cloud schema migration
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud frontend build, VM Cloud SQLite aggregate read-only, live leading-indicators API
    window: rolling latest 7d and 30d for TheCleanCoffee Google paid source check
    freshness: 2026-05-20 KST runtime checks
    confidence: high for deploy result, medium_high for source mapping audit

# Leading Indicators Frontend Deploy + TheCleanCoffee Google Paid Source Audit

## 이번에 가능해진 것

- `/ai-crm/leading-indicators` 운영 화면에 페이지 롱 뷰 기준 시간 설명, 7분 기준 변화, Google 유료 표본 경고, 쉬운 용어가 반영됐다.
- 더클린커피 Google 유료 유입이 0처럼 보이는 원인을 `실제 원장 증거`와 `API 채널 계약`으로 분리했다.

## VM Cloud 배포 결과

- 배포 대상: `frontend/src/app/ai-crm/leading-indicators/page.tsx`, `dry-run.ts`, `page.module.css`
- 백업: `/home/biocomkr_sns/seo/repo/.deploy-backups/leading-indicators-frontend-20260520-034135`
- VM build: PASS
- PM2 restart: `seo-frontend` restarted, status online
- route smoke: `http://127.0.0.1:3001/ai-crm/leading-indicators` 200 OK
- public smoke: `https://biocom.ainativeos.net/ai-crm/leading-indicators` 에서 새 문구 확인
  - `페이지 롱 뷰 기준 시간`
  - `7분은 보조 기준`
  - `Google 유료`
  - `체류시간(페이지에 머문 시간)`

## 더클린커피 Google 유료 source audit

### 확인한 것

최근 7일 TheCleanCoffee `site_landing_ledger`:

- landing rows: 747
- Google click rows (`gclid/gbraid/wbraid/gad_source`): 0
- Google paid text rows (`google+cpc/paid/google_ads`): 0
- classified Google rows: 0

최근 30일 TheCleanCoffee `site_landing_ledger`:

- landing rows: 1,238
- Google click rows: 0
- Google paid text rows: 0
- classified Google rows: 0

최근 7일 live `leading-indicators` channel segment:

- direct_or_unknown: 221 sessions
- naver_paid_or_brand: 133 sessions
- meta: 105 sessions
- youtube: 71 sessions
- `google_paid`: not present

### 해석

현재 더클린커피는 Google Ads 태그가 설치되어 있더라도, VM Cloud 유입 원장에는 Google 유료 클릭 증거가 들어오지 않는다. 따라서 지금 화면의 `더클린커피 Google 유료 0`은 단순 프론트 버그라기보다 다음 두 문제가 겹친 상태다.

1. 최근 7일/30일 원장에 Google 유료 클릭 식별자 자체가 0건이다.
2. 운영 `leading-indicators` API의 채널 계약에는 아직 `google_paid`가 없다.

## 남은 조치

- `leadingIndicators.ts` API 채널 타입과 분류기에 `google_paid`를 추가해야 한다.
- Google 유료 클릭이 실제로 광고에서 들어오는데 VM에 0이라면, 랜딩 URL에 `gclid/gbraid/wbraid` 또는 UTM이 누락되는 광고/랜딩 설정을 별도로 확인해야 한다.
- 프론트의 Google 유료 카드는 현재 정적 dry-run 값과 운영 API 계약이 섞이지 않게 `API가 google_paid 지원 전` 배지를 붙이는 것이 안전하다.
