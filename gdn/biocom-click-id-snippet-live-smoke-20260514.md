---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - gdn/google-ads-click-id-capture-root-cause-20260514.md
    - gdn/google-ads-click-id-capture-yellow-a-result-20260514.md
    - gdn/google-ads-confirmed-purchase-no-send-quality-20260514.md
    - data/project/google-ads-confirmed-purchase-no-send-quality-20260514.json
  lane: Green read-only live smoke validation
  allowed_actions:
    - VM Cloud SQLite aggregate read-only query
    - VM Cloud health read-only check
    - local code read
    - documentation output
  forbidden_actions:
    - Google Ads upload/send
    - Google Ads conversion action mutate
    - BI confirmed_purchase_offline primary change
    - existing purchase primary modification
    - TechSol modification/deletion
    - campaign or budget mutate
    - operational DB write/import
    - schema migration
    - GTM Production publish
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite attribution_ledger aggregate, VM Cloud health endpoint, local backend code
    window: snippetVersion=2026-05-14-biocom-payment-success-click-id-v4-3 rows observed at 2026-05-14T03:43:05.162Z..2026-05-14T03:44:01.403Z
    freshness: checked_at=2026-05-14T03:54:12.152Z
    confidence: 0.92
---

# Biocom click id snippet live smoke

## 판정

**A. LIVE_SMOKE_PASS_READY_FOR_24H_MONITOR**

이번 v4.3 아임웹 payment-success snippet은 VM Cloud backend에 실제로 들어왔고, 테스트 무통장/미입금 주문은 `pending`으로 남아 confirmed_purchase 후보에서 제외된다. Google Ads, Meta, TikTok, GA4, GTM, 운영DB write/import는 실행하지 않았다.

## 10초 요약

- 수신 여부: `snippetVersion=2026-05-14-biocom-payment-success-click-id-v4-3` payment_success row가 VM Cloud SQLite `attribution_ledger`에 2건 저장됐다.
- 후보 제외 여부: 2건 모두 `payment_status=pending`이고 `confirmed`는 0건이라 BI confirmed_purchase 후보 필터에 들어가지 않는다.
- click id 보존: top-level `gclid`는 1건 보존, metadata `has_gclid/has_gbraid/has_wbraid`는 각 1건 이상 보존됐다.
- 주의점: `gbraid/wbraid` 실제 값은 이번 VM Cloud row에서는 metadata 값으로 보존되지 않았고, presence boolean만 남았다. backend 수신/guard에는 문제 없지만 24h monitor에서 값 보존 여부를 별도 추적해야 한다.

## 확인한 숫자

기준: VM Cloud SQLite `data/crm.sqlite3`, `attribution_ledger`, `touchpoint=payment_success`, `snippetVersion=2026-05-14-biocom-payment-success-click-id-v4-3`.

- row count: 2
- logged_at: 2026-05-14T03:43:05.162Z ~ 2026-05-14T03:44:01.403Z
- capture mode: live 2
- source: biocom_imweb 2
- payment status: pending 2, confirmed 0
- request method/path: POST `/api/attribution/payment-success` 2
- OPTIONS `/api/attribution/payment-success`: 204
- VM Cloud health: ok
- PM2 `seo-backend`: online

Click id presence aggregate:

- top-level `gclid` present: 1
- metadata `google_click_id_present`: 1
- metadata `has_gclid`: 1
- metadata `has_gbraid`: 1
- metadata `has_wbraid`: 1
- metadata `click_id_restore_source` key present: 2
- `click_id_restore_source=checkout_context` exact value: 0
- `click_id_restore_source` non-empty other value: 2
- metadata `gbraid` actual value present: 0
- metadata `wbraid` actual value present: 0

## 후보 제외 guard

무통장 미입금 row가 confirmed_purchase 후보에 들어가지 않는 이유는 두 겹이다.

1. VM Cloud attribution ledger에는 이번 v4.3 row가 `pending`으로 저장됐다.
2. BI confirmed_purchase dry-run builder는 VM Cloud `attribution_ledger`에서 `touchpoint='payment_success'`, `payment_status='confirmed'`, `source='biocom_imweb'`만 읽는다.

근거 코드:

- [backend/scripts/bi-confirmed-purchase-operational-dry-run.ts](/Users/vibetj/coding/seo/backend/scripts/bi-confirmed-purchase-operational-dry-run.ts:244): 운영DB `public.tb_iamweb_users`를 read-only로 읽고 결제 완료 시각/상태 기반 주문 spine을 만든다.
- [backend/scripts/bi-confirmed-purchase-operational-dry-run.ts](/Users/vibetj/coding/seo/backend/scripts/bi-confirmed-purchase-operational-dry-run.ts:369): VM Cloud ledger는 `payment_status='confirmed'`와 `source='biocom_imweb'`만 후보 evidence로 인덱싱한다.
- [backend/src/routes/attribution.ts](/Users/vibetj/coding/seo/backend/src/routes/attribution.ts:684): no-send preview는 `payment_complete` 또는 `confirmed_order` stage만 허용한다.
- [backend/src/routes/attribution.ts](/Users/vibetj/coding/seo/backend/src/routes/attribution.ts:1238): GA4/Meta/Google Ads platform payload preview는 모두 blocked이며 `send_candidate=false`다.

## gbraid/wbraid metadata-only 설계 판단

VM Cloud `attribution_ledger`에는 `gclid` column은 있지만 `gbraid/wbraid` column은 없다. 그래서 `gbraid/wbraid`는 metadata 또는 URL text에서만 읽을 수 있다.

현재 backend builder는 metadata에 실제 `gbraid/wbraid` 값이 있으면 읽을 수 있다. 다만 이번 live row에서는 `has_gbraid/has_wbraid` boolean은 보존됐지만 실제 값은 보존되지 않았다. 따라서 이번 smoke의 판정은 “backend 수신과 미입금 guard는 PASS, 값 보존은 24h monitor에서 추가 확인”이다.

근거 코드:

- [backend/src/attribution.ts](/Users/vibetj/coding/seo/backend/src/attribution.ts:445): 기존 metadata를 보존한 뒤 enriched metadata를 만든다.
- [backend/src/attribution.ts](/Users/vibetj/coding/seo/backend/src/attribution.ts:522): top-level click id column은 현재 `gclid/fbclid/ttclid`만 정규화한다.
- [backend/scripts/bi-confirmed-purchase-operational-dry-run.ts](/Users/vibetj/coding/seo/backend/scripts/bi-confirmed-purchase-operational-dry-run.ts:571): builder는 `gbraid/wbraid`를 metadata 또는 URL text에서도 추출한다.

## 0 유지 확인

- Google Ads upload/send: 0
- Google Ads conversion action mutate: 0
- BI confirmed_purchase_offline primary change: 0
- 기존 구매완료 primary modified: 0
- TechSol modified/deleted: 0
- campaign/budget mutate: 0
- 운영DB write/import: 0
- schema migration: 0
- GTM Production publish: 0
- raw identifier leak: 0

## 한계

- Codex가 새 브라우저 주문을 만들지는 않았다. 브라우저 POST 201은 TJ님 테스트 결과를 기준으로 하고, VM Cloud ledger aggregate로 실제 저장을 검증했다.
- 기존 purchase/Meta/TikTok/GA4 console error 증가 여부는 Codex가 브라우저에서 재현하지 않았다. 대신 VM Cloud health와 PM2 상태를 확인했고, 이번 검증에서 platform send path를 실행하지 않았다.
- `click_id_restore_source` key는 2건 보존됐고 값도 비어 있지 않았지만, 값이 `checkout_context`로 저장되지는 않았다. 브라우저 context와 payload 저장값 사이 mapping은 24h monitor 또는 snippet payload 개선 후보로 남긴다.

## 다음 판단

24시간 read-only monitor로 전환한다. monitor는 신규 실제 결제 완료 row에서 `payment_status=confirmed`, top-level `gclid`, metadata `gbraid/wbraid` 실제 값, `has_*` boolean, upload candidate exclusion, external send 0을 분리해서 봐야 한다.

상세 aggregate JSON: [data/project/biocom-click-id-snippet-live-smoke-20260514.json](/Users/vibetj/coding/seo/data/project/biocom-click-id-snippet-live-smoke-20260514.json)
