# Meta UTM dry-run 비Meta 제외 규칙 + B급 alias 제안 사전

작성 시각: 2026-05-23 23:53:13 KST
Site: biocom
Lane: Green, read-only/local artifact

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - data/!data_inventory.md
  required_context_docs:
    - utm/[바이오컴] UTM 관리.xlsx
    - utm/[바이오컴] UTM 관리 - Builder (자동소문자화 기능 있음).csv
    - utm/biocom-utm-mapping-candidates-20260522.csv
    - data/meta_campaign_aliases.biocom.json
    - data/meta_campaign_alias_audit.biocom.json
  lane: Green
  allowed_actions:
    - read_local_utm_files
    - read_local_backend_diagnostics_api_or_cache
    - generate_local_csv_json_md_artifacts
  forbidden_actions:
    - production_db_write
    - vm_cloud_deploy
    - meta_ads_write
    - gtm_publish
    - platform_send
  source_window_freshness_confidence:
    source: "disk_cache:/Users/vibetj/coding/seo/backend/data/runtime-cache/meta-utm-diagnostics-cache.json#meta-utm-diagnostics:act_3138805896402376:last_7d:auto + local UTM candidate CSV + local Meta alias audit"
    window: "2026-05-16~2026-05-22 KST for dry-run; audit 2026-04-04~2026-04-10"
    freshness: "2026-05-23 23:53:13 KST"
    confidence: "dry-run 분류 high for explicit UTM rows, B-grade proposal medium because audit is stale/proposal-only"
```

## 결론

현재 Meta 미매칭에서 UTM 관리 파일로 바로 할 수 있는 일은 두 가지다.

1. `googleads_*`, `newmember_coupon`, `ig/link_in_bio`처럼 Meta 광고 캠페인 매출로 붙이면 안 되는 유입을 분리한다.
2. UTM 파일과 과거 Meta URL audit에서 단일 캠페인으로만 보이는 alias를 `manual_verified`가 아니라 `B급 제안 사전`으로 보관한다.

## 비Meta 오분류 dry-run

기준 미매칭: 15건 / 5,083,000원

| bucket | orders | revenue |
| --- | --- | --- |
| no_utm_no_landing_not_matchable | 7 | 2,970,700원 |
| quarantine_or_exclude_ig_profile_link | 4 | 936,000원 |
| real_meta_placeholder_no_alias | 2 | 693,000원 |
| exclude_from_meta_coupon_by_utm_file | 1 | 446,400원 |
| exclude_from_meta_google_ads_by_utm_file | 1 | 36,900원 |

운영 반영 시 추천:

- `exclude_from_meta_google_ads_by_utm_file`: Meta 캠페인 미매칭에서 제외한다.
- `exclude_from_meta_coupon_by_utm_file`: Meta 캠페인 미매칭에서 제외한다.
- `quarantine_or_exclude_ig_profile_link`: campaign ROAS에는 붙이지 않는다. 다만 assisted/social로 볼지 완전 제외할지는 VM Cloud raw row에서 fbclid 여부를 재확인한다.
- `real_meta_placeholder_no_alias`: 진짜 Meta 흔적은 있으나 캠페인 특정 근거가 없으므로 계속 quarantine한다.
- `no_utm_no_landing_not_matchable`: UTM 파일로는 매칭할 수 없다.

## B급 alias 제안 사전

UTM 파일 기준 Meta 성격 alias unique: 721개

- 이미 수동 seed에 있는 alias: 21개
- B급 제안으로 분리한 단일 캠페인 후보: 192개
- 여러 캠페인에 걸쳐 split 유지해야 하는 후보: 27개
- 현재 audit에서 확인되지 않은 후보: 481개

이 192개는 자동 확정이 아니다. 해당 alias가 주문 원장에 실제로 들어오면 “이 캠페인일 가능성이 높다”는 후보로 띄우고, 최신 Meta API URL evidence나 그로스팀 Ads Manager export로 숫자 ID를 확인한 뒤 승급한다.

## 산출물

- `/Users/vibetj/coding/seo/utm/meta-utm-nonmeta-exclusion-dry-run-20260523.csv`
- `/Users/vibetj/coding/seo/utm/meta-utm-nonmeta-exclusion-dry-run-summary-20260523.json`
- `/Users/vibetj/coding/seo/utm/biocom-meta-bgrade-alias-proposal-dictionary-20260523.csv`
- `/Users/vibetj/coding/seo/utm/biocom-meta-bgrade-alias-proposal-summary-20260523.json`

## Auditor verdict

PASS_WITH_NOTES

- No-send: YES
- No-write to DB: YES
- No-deploy: YES
- No-publish: YES
- No-platform-send: YES
- Note: `last_30d` Meta API 강제 갱신은 rate limit에 걸렸으므로, 최신 성공 window인 last_7d dry-run과 로컬 audit 기반 B급 제안으로 한정한다.
