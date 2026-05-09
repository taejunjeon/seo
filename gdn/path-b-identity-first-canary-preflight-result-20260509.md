# Path B identity-first canary preflight result

작성 시각: 2026-05-09 22:34 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  lane: approved Yellow execution
  allowed_actions:
    - VM Cloud limited delta deploy
    - schema/bootstrap smoke
    - GTM order-complete-only limited Production publish
    - 1h hash-only canary
    - cleanup and reporting
  forbidden_actions:
    - All Pages trigger
    - existing GTM tag pause/delete
    - raw email/phone/member_code/order/payment storage
    - Google Ads/GA4/Meta/TikTok/Naver new send by Path B
    - Google Ads conversion upload
    - send_candidate=true
  source_window_freshness_confidence:
    source: VM Cloud summary endpoint, GTM API, local backend tests
    window: 2026-05-09 21:10-21:17 KST
    freshness: same-session
    site: biocom
    confidence: high
```

## 한 줄 결론

VM Cloud에 row status summary가 없어서 제한 delta deploy가 필요했고, deploy와 smoke가 PASS한 뒤 order-complete-only canary를 시작했다.

## 확인한 것

- VM Cloud summary endpoint는 deploy 전 `status_counts`가 없었다.
- 로컬 source에는 `row_status` 분류와 summary 로직이 있었다.
- 제한 delta deploy 후 summary endpoint에서 `status_counts`가 확인됐다.
- flag OFF no-send smoke는 HTTP 200이었다.
- oversized body guard는 HTTP 413이었다.
- VM Cloud write flag는 canary 시작 전까지 OFF였다.
- GTM fresh workspace cleanup 후 새 workspace로 canary version을 만들었다.

## canary 시작 조건

- GTM live previous version: `142`.
- Canary version: `143`.
- Trigger: `/shop_payment_complete` only.
- All Pages trigger: 없음.
- 기존 GTM tag pause/delete/edit: 없음.
- VM Cloud write flag ON: 2026-05-09 21:17:54 KST.
- Scheduled canary until: 2026-05-09 22:17:53 KST.

## 판정

PASS. 제한 배포와 smoke 기준은 충족했고, 1h identity-first canary를 시작해도 되는 상태였다.
