# gpt0508-6 결과 보고서 — Path B HURDLERS user_id HMAC-only Preview

작성 시각: 2026-05-09 01:24 KST
작업 시작: 2026-05-09 01:17 KST
작업 종료: 2026-05-09 01:24 KST
작업 소요: 약 7분
Project: biocom Path B bridge
Lane: Yellow approved Preview only + Green documentation
Mode: no-send / no-operational-write / no-platform-send / no-publish

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - vm/!vm.md
  lane: Yellow approved Preview only
  allowed_actions:
    - GTM fresh workspace Preview only
    - Path B no-send HMAC endpoint call
    - controlled synthetic smoke
    - read-only PM2 log check
    - documentation
    - gptconfirm packaging
  forbidden_actions:
    - GTM Production publish
    - GTM submit/create_version
    - Imweb production save
    - backend operational storage canary
    - operational schema migration
    - raw email/phone/member_code/order storage
    - raw email/phone/member_code/order logging
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - existing GTM tag pause/delete/edit
  source_window_freshness_confidence:
    source: "GTM Preview API workspace 164 + no-send endpoint response + VM PM2 read-only grep"
    window: "2026-05-09 01:17-01:24 KST"
    freshness: "2026-05-09 01:24 KST"
    confidence: 0.9
```

## 5줄 요약

1. 새 GTM Preview workspace `164`에 HURDLERS user_id HMAC-only Preview tag를 만들었다.
2. controlled smoke에서 `email_hash_present=true`, `identity_source=email`, `order_no_hash_present=true`, `client_session_present=true`, `click_id_hash_present=true`를 확인했다.
3. endpoint response는 raw 값을 echo하지 않았고, PM2 최근 로그 raw pattern match는 0이었다.
4. 기존 HURDLERS 태그 수정, GTM submit/publish, platform send, operational storage canary는 하지 않았다.
5. 실제 TJ님 로그인 브라우저의 주문완료 화면 evidence는 아직 필요하므로, Path B 전체 진척률은 약 76%에서 약 84%로 올랐다.

## 진척률 %

- 전체 Path B bridge 기준 진척률: 약 84%.
- 이번 gpt0508-6 batch 기준 진척률: 약 90%.
- 100%까지 남은 단계: 실제 로그인 브라우저 Preview에서 `email_hash_present=true` 확인, synthetic click id Preview, same-browser preservation Preview, reliability dry-run 입력 확보, hash-only canary 승인/실행 여부 판단.
- 다음 병목: Codex headless 환경이 아니라 TJ님 로그인 브라우저의 실제 주문완료 화면에서 HURDLERS user_id가 유지되는지 확인해야 한다.
- 사람이 이해할 수 있는 1문장 설명: 서버와 Preview tag는 준비됐고, 이제 실제 결제완료 화면에서 이메일형 user_id가 hash로 바뀌어 들어오는지만 확인하면 된다.

## 이번 batch 산출물

1. `01-path-b-hurdlers-user-id-preview-result-20260509.md`
2. `02-path-b-hurdlers-user-id-preview-tag-diff-20260509.md`
3. `03-path-b-synthetic-click-id-preview-checklist-20260509.md`
4. `04-path-b-same-browser-preservation-preview-checklist-20260509.md`
5. `05-path-b-raw-logging-fallback-policy-20260509.md`
6. `99-total-current-copy.md`
7. `manifest.json`

## 지금 승인해도 되는 것

- GTM Preview workspace `164`에서 실제 주문완료 화면을 다시 열어 `path_b_hurdlers_user_id_preview_result` 이벤트를 확인하는 것.
- synthetic click id Preview를 no-send로 실행하는 것.
- same-browser preservation Preview를 no-send로 실행하는 것.

## 아직 승인하면 안 되는 것

- GTM Production publish.
- Imweb production save.
- backend operational storage canary.
- operational schema migration.
- raw email/phone/member_code/order 저장.
- 운영 raw logging.
- Google Ads/GA4/Meta/TikTok/Naver 전송.
- Google Ads conversion upload.
- 기존 GTM tag pause/delete/edit.
- 실제 광고 클릭/실제 결제 테스트.

## 검증 결과

- Controlled Preview endpoint status: 200.
- `email_hash_present`: true.
- `identity_source`: email.
- `would_store`: false.
- `would_send`: false.
- `no_raw_echo_verified`: true.
- `no_platform_send_verified`: true.
- `platform_send_count`: 0.
- PM2 recent log raw pattern match: 0.
- Workspace submitted: false.
- Workspace published: false.

- Backend typecheck: PASS (`npm --prefix backend run typecheck`).
- HMAC fixture smoke: PASS, 5/5 (`npx tsx --test backend/tests/order-bridge-identity-hmac.test.ts`).
- Wiki link validation: PASS (`python3 scripts/validate_wiki_links.py ...`).
- Harness preflight: PASS (`python3 scripts/harness-preflight-check.py --strict`).
- Manifest JSON parse: PASS.
- Preview result JSON parse: PASS.
- Diff whitespace check: PASS.

## 금지선 준수

- No-send verified: YES.
- No-write verified: YES.
- No-deploy verified: YES.
- No-publish verified: YES.
- No-platform-send verified: YES.
- Existing GTM tag edit/delete/pause: NO.

## 100%까지 남은 단계

1. 실제 TJ님 로그인 브라우저 주문완료 화면에서 HURDLERS user_id HMAC Preview 결과를 캡처한다.
2. TEST click id로 `click_id_hash_present=true`를 확인한다.
3. 상품상세에서 주문완료까지 same-browser click preservation을 확인한다.
4. Preview evidence JSON을 reliability dry-run 입력으로 정리한다.
5. 운영 저장 canary는 별도 승인 전까지 HOLD로 유지한다.

## 다음 자동 Green 작업

- TJ님이 actual Preview evidence를 주면 `data/path-b-hurdlers-user-id-preview-result-20260509.json`에 실제 evidence section을 보강한다.
- synthetic click id / same-browser preservation 결과 문서를 이어서 업데이트한다.
- reliability dry-run 입력 schema를 actual evidence 기준으로 닫는다.

## 다음 Yellow/Red 승인 후보

- Yellow 후보: same-browser preservation Preview 실행.
- Yellow 후보: hash-only order_bridge 1h canary 승인안.
- Red 후보: 실제 광고 클릭/실제 결제 테스트 또는 Google Ads conversion upload. 현재는 진행 금지.

Auditor verdict: PASS_WITH_REAL_BROWSER_EVIDENCE_PENDING
