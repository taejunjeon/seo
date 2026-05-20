작성 시각: 2026-05-20 23:18 KST
기준일: 2026-05-20
문서 성격: Google Ads 캠페인 ID 추적 보강 기준점 기록

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - data/!data_inventory.md
    - docurule.md
  lane: Green
  allowed_actions:
    - local_code_implementation
    - local_documentation_update
    - local_validation
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write
    - google_ads_conversion_upload
    - gtm_publish
    - deploy_or_restart
  source_window_freshness_confidence:
    source: local code diff + VM Cloud SQLite read-only audit
    window: 2026-05-20 implementation checkpoint
    site: biocom
    freshness: 2026-05-20 23:18 KST
    confidence: medium_high
```

# Google Ads 캠페인 ID 추적 보강 기준점

## 10초 요약

오늘 Google Ads URL의 `gad_campaignid`를 내부 원장에 남기도록 로컬 구현했다. 이 작업은 나중에 캠페인별 내부 ROAS를 다시 계산할 때 기준점 후보가 된다.

단, 기준점은 조건부다. 배포 후 신규 Google 클릭에서 `gad_campaignid`가 실제로 VM Cloud 원장에 저장되는 것이 확인되어야 한다. 확인 전에는 2026-05-20을 확정 재계산 시작일로 쓰지 않는다.

## 기준점 정의

| 항목 | 값 |
|---|---|
| 기준점 후보일 | 2026-05-20 23:00 KST |
| 확정 조건 | 배포 후 신규 Google 클릭 row에서 `gad_campaignid` 보존 확인 |
| 재계산 시작점 | 확정 조건 통과 후 `2026-05-20 23:00 KST` 또는 smoke 통과 시각 중 더 보수적인 값 |
| 재계산 대상 | Google Ads 내부 confirmed ROAS의 캠페인 ID 매칭률, 미맵핑 감소분 |
| 제외 대상 | Google Ads conversion upload, Primary/Secondary 전환 변경, Google Ads 예산 자동 변경 |

## 오늘 구현한 것

1. Google 광고 URL 보존 범위 보강
   - `gad_campaignid`
   - `gad_source`
   - 기존 `gclid/gbraid/wbraid` 유지

2. 유료 클릭 장부 보강
   - `allowed_query_json.gad_campaignid`
   - `allowed_query_json.gad_source`
   - raw click id 원문은 화면/문서에 출력하지 않음

3. Google ROAS 보고서 보강
   - `googleCampaignMatchHealth`
   - `Google 캠페인 ID 매칭률`
   - `매칭율%`
   - `미맵핑`
   - `ROAS 재계산 기준 후보`

## 기준점 승격 조건

아래가 모두 통과하면 2026-05-20 작업을 재계산 기준점으로 승격한다.

1. backend 배포 후 신규 Google 광고 클릭 1건 이상이 들어온다.
2. VM Cloud `site_landing_ledger.landing_url` 또는 `paid_click_intent_ledger.allowed_query_json`에서 `gad_campaignid`가 확인된다.
3. 같은 row 또는 같은 session에 `gclid/gbraid/wbraid` 중 하나가 있다.
4. `/api/google-ads/dashboard`의 `googleCampaignMatchHealth.summary.status`가 `campaign_id_collecting`으로 바뀐다.
5. `/ads/google-roas-report`에서 `ROAS 재계산 기준점 사용 가능` 상태가 보인다.

## 승격 전 해석

승격 전에는 다음처럼 해석한다.

- `Google click id 보존`: 일부 작동
- `Google campaign id 보존`: 배포 전 로컬 구현 완료, 운영 확인 전
- `캠페인별 내부 ROAS 재계산`: 대기
- `Google Ads upload`: 0건 유지

## Guardrails

- No-send verified: YES
- No-write verified: YES
- No-deploy verified: YES
- No-publish verified: YES
- No-platform-send verified: YES
- 운영DB write: 0
- VM Cloud write: 0
- Google Ads upload: 0
