# Leading Indicators VM Precompute Cache ON Plan

작성 시각: 2026-05-26 00:30 KST
Lane: Yellow deploy preparation

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - harness/coffee-data/README.md
  lane: Yellow
  allowed_actions:
    - local_code_patch
    - local_typecheck_or_lint
    - vm_deploy_packet_prepare
    - vm_read_only_precheck
  forbidden_actions:
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_schema_migration
    - gtm_publish
    - imweb_header_footer_change
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite + GA4 BigQuery safe bridge dry-run
    window: rolling latest 7d for behavior snapshot; 1d/7d/14d/30d for API cache targets
    freshness: dry-run generated 2026-05-26 00:13 KST
    confidence: medium_high for Meta/overall, medium or low for small Google/YouTube/organic buckets
```

## 이번에 가능해진 것

선행지표 화면이 매번 VM Cloud 원장을 직접 계산하지 않고, 백그라운드에서 미리 만든 요약값을 먼저 읽을 수 있게 준비했다. 쉽게 말하면 사용자가 화면을 열 때마다 창고 전체를 뒤지는 것이 아니라, 30분마다 미리 만든 재고표를 보는 방식이다.

## 현재 VM 상태

- API 자체는 정상이다.
- 하지만 현재 VM 환경변수는 `LEADING_INDICATORS_PRECOMPUTE_ENABLED=0`, `LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=0` 상태라 선행지표 precompute cache가 꺼져 있다.
- live API 응답은 `cache.cached=false`, `cache.source=live_cache_miss`로 확인됐다.
- 즉 화면은 동작하지만, 캐시가 아니라 요청 시점 계산에 의존한다.

## 로컬 변경 요약

### 1. precompute 대상 확대

기존에는 주요 Meta 조합 중심으로만 선행지표 캐시를 만들었다. 이번 로컬 변경에서는 다음 44개 조합으로 확대했다.

- 사이트: 바이오컴, 더클린커피
- 기간: 오늘, 최근 7일, 최근 14일, 최근 30일
- 구매자/비결제자 비교 채널: Meta, Google 유료, YouTube, 오가닉
- 보조 집계: 채널별 요약, Meta 랜딩 버킷별 요약

이 변경의 의미는 프론트 화면에서 Meta만 보던 구조를 넘어서 Google 유료, YouTube, 오가닉도 같은 형식으로 비교할 수 있다는 것이다.

### 2. page-long 기준 dry-run 확장

`페이지 롱 뷰`는 방문자가 오래 머문 세션을 뜻한다. 기존에는 Meta 중심으로 봤지만 이번 dry-run은 다음 조합까지 확장했다.

- 바이오컴: Meta, Google 유료, YouTube, 오가닉
- 더클린커피: Meta, Google 유료, YouTube, 오가닉

현재 7분 기준은 기본 선행지표라기보다 `초고의도 방문` 기준에 가깝다. Meta 기준으로는 2분 또는 3분 후보가 구매 예고 신호로 더 넓게 작동한다.

### 3. 프론트 안내 문구 보강

선행지표 화면에 다음 설명을 추가했다.

- 로컬 보고서와 VM 보고서 중 어떤 것을 기준으로 봐야 하는지
- row-level join이 무엇인지
- VM cache가 켜졌는지 꺼졌는지
- page-long 기준이 왜 7분 하나로 고정되면 안 되는지

## 최신 dry-run 핵심 수치

Source: VM Cloud SQLite safe session hash + GA4 BigQuery safe bridge
Window: rolling latest 7d
Freshness: 2026-05-26 00:13 KST
Confidence: medium_high for Meta, medium/low for small channel buckets

### 바이오컴

- Meta 광고: 225 safe sessions, GA4 join 78.67%, 추천 후보 2분, 현재 7분은 구매자 16.96% / 비결제자 6.15%.
- Google 유료: 11 safe sessions, GA4 join 100%, 표본 부족. 7분은 구매자 50% / 비결제자 11.11%지만 구매자 연결 표본이 2건뿐이다.
- YouTube: 11 safe sessions, GA4 join 100%, 표본 부족. 7분은 구매자 66.67% / 비결제자 50%.
- 오가닉: 3 safe sessions, 구매자 연결 표본 0건. 기준 확정 불가.

### 더클린커피

- Meta 광고: 97 safe sessions, GA4 join 83.51%, 추천 후보 2분, 현재 7분은 구매자 22.86% / 비결제자 13.04%.
- Google 유료: 4 safe sessions, 구매자 연결 표본 0건. Google 유료 추적은 별도 보강 후 다시 봐야 한다.
- YouTube: 13 safe sessions, GA4 join 92.31%, 표본 부족. 7분은 구매자 14.29% / 비결제자 0%.
- 오가닉: 0 safe sessions. 이번 window에서는 판단하지 않는다.

## VM 배포 패킷

### 배포 대상

- `backend/src/leadingIndicators.ts`
- `backend/scripts/ga4-vm-row-level-safe-bridge-dry-run.ts`
- `data/project/ga4-vm-row-level-safe-bridge-dry-run-20260525.json`
- `data/project/coffee-channel-cohort-truth-table-20260525.json`
- `data/project/biocom-meta-only-buyer-leaver-truth-table-20260525.json`
- `data/project/page-long-threshold-fit-dry-run-20260525.json`

프론트 안내 문구까지 VM에 반영하려면 아래도 같이 배포한다.

- `frontend/src/app/ai-crm/leading-indicators/page.tsx`
- `frontend/src/app/ai-crm/leading-indicators/page.module.css`
- `frontend/src/app/ai-crm/leading-indicators/dry-run.ts`

### 환경변수

첫 ON은 보수적으로 30분 주기를 권장한다.

```bash
LEADING_INDICATORS_PRECOMPUTE_ENABLED=1
LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
```

### 배포 순서

1. VM에서 현재 파일 backup.
2. backend 파일과 `data/project/*20260525.json` 스냅샷 배포.
3. backend build/typecheck.
4. `seo-backend` restart.
5. 30-60초 대기 후 첫 precompute tick 확인.
6. API smoke.
7. CPU/memory/log 10분 관찰.

### post-check

아래 호출이 모두 200이고 `cache.cached=true`, `cache.source=in_memory_precompute`이면 성공이다.

```text
/api/attribution/leading-indicators?site=biocom&window=7d&channel=meta&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=biocom&window=7d&channel=google_paid&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=biocom&window=7d&channel=youtube&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=biocom&window=7d&channel=organic&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=meta&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=google_paid&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=youtube&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=organic&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=biocom&window=7d&channel=all&dimension=channel
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=all&dimension=channel
```

목표 응답 시간은 cache hit 기준 500ms 이하다.

### rollback

문제가 생기면 먼저 cache worker만 끈다. 코드 rollback보다 안전하고 빠르다.

```bash
LEADING_INDICATORS_PRECOMPUTE_ENABLED=0
LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=0
pm2 restart seo-backend --update-env
```

build 자체가 실패했거나 응답 schema가 깨졌다면 backup 파일을 복원하고 다시 build/restart한다.

## 승인 판단

추천: VM precompute cache ON 진행.

이유:

- 외부 플랫폼 전송이 없다.
- 운영DB write가 없다.
- API 응답은 aggregate-only라 raw identifier가 노출되지 않는다.
- 현재 live cache miss 의존도를 줄여 화면 응답 안정성을 높인다.

주의:

- 첫 ON 후 10분은 CPU/memory를 본다.
- 더클린커피 Google 유료/오가닉은 표본이 작으므로 화면에서 “판정 보류”로 보여야 한다.
- VM 프론트까지 배포하지 않으면 안내 문구는 로컬에만 보인다.
