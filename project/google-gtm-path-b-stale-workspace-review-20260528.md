# GTM Path B 오래된 workspace 검토 - 2026-05-28

작성 시각: 2026-05-28 14:08 KST
기준일: 2026-05-28
문서 성격: Green Lane read-only 조사 결과 + 승인 후 GTM Preview workspace cleanup 결과
site: biocom
대상: GTM `GTM-W2Z6PHN` workspace `167`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - gdn/path-b-canary-mode-decision-20260509.md
    - gdn/path-b-identity-first-canary-strategy-20260509.md
    - gdn/path-b-identity-first-post-canary-scorecard-20260509.md
    - gdn/path-b-real-paid-click-actual-order-preview-result-20260510.md
  required_context_docs:
    - gdn/path-b-real-paid-click-actual-order-preview-result-20260510.md
  lane: Green read-only 조사 / Yellow cleanup approved by TJ
  allowed_actions:
    - GTM workspace read-only inspection
    - GTM version history read-only inspection
    - document result
    - workspace 167 JSON backup after TJ approval
    - workspace 167 delete after TJ approval
  forbidden_actions:
    - GTM workspace delete without approval
    - GTM production publish
    - NPay login/payment
    - Google Ads/Meta/GA4/TikTok send
    - production DB write
  source_window_freshness_confidence:
    source: GTM API read-only + local project docs + VM Cloud row-level redacted check + GTM cleanup result
    window: 2026-05-09 to 2026-05-28 KST
    freshness: GTM API checked 2026-05-28 14:39 KST
    confidence: high for workspace status and old canary purpose; medium for historical business intent because based on docs
```

## 10초 요약

`AGENT_OS_path_b_controlled_traffic_preview_20260509T155435Z` workspace는 과거 `Path B` 테스트용이다. 목적은 주문완료 화면에서 주문번호, 로그인 identity, 브라우저 세션, Google click id를 원문 없이 hash로 묶을 수 있는지 확인하는 것이었다.

목적은 달성됐다. 2026-05-09에는 1시간 운영 canary가 실행 후 rollback됐고, 2026-05-10에는 실제 Google 광고 클릭 주문완료 Preview에서 click hash까지 잡혔다. 현재 남은 workspace `167`은 운영 live에 반영되지 않은 오래된 Preview 초안이다.

삭제해도 운영 사이트 동작에는 영향이 없다고 판단했고, TJ님 승인 후 JSON 백업을 남긴 뒤 삭제까지 완료했다. 현재 live version은 `146` 그대로이며, 남은 workspace는 Default Workspace 1개뿐이다.

## 이 workspace가 하려던 일

사람 말로 풀면 아래 작업이었다.

고객이 Google 광고를 클릭한 뒤 주문완료 화면까지 오면, 그 주문이 어떤 광고 클릭에서 왔는지 잇는 다리를 만들려 했다.

단, 이메일, 전화번호, 주문번호 원문을 저장하지 않고 서버가 즉시 hash로 바꿔 보관하는 방식이었다. 그래서 이름에 `hmac`, `identity_first`, `Path B`가 들어간다.

## GTM API 현재 상태

조회 시각: 2026-05-28 14:00 KST
source: GTM API read-only
confidence: high

workspace:

- id: `167`
- name: `AGENT_OS_path_b_controlled_traffic_preview_20260509T155435Z`
- description: `AGENT_OS Path B controlled traffic Preview only. No submit, no publish, no platform send.`

남아 있는 변경:

- tag `301`: `AGENT_OS_path_b_controlled_traffic_hmac_write_preview_20260509T155435Z`
- trigger `300`: `AGENT_OS_path_b_order_confirm_controlled_traffic_20260509T155435Z`

둘 다 `added` 상태다. 즉 아직 live version에 들어가지 않은 workspace draft다.

현재 live version:

- `146`: `BI NPay Bridge v1.1 production 20260528T044617Z`

## 운영 반영 여부

이 workspace `167` 자체는 운영에 게시되지 않았다.

다만 같은 Path B 계열의 별도 1시간 canary version은 운영에 잠깐 게시된 적이 있다.

- version `143`: `AGENT_OS Path B identity-first canary 20260509T121717Z`
- 설명: `Limited 1h order-complete-only canary. Roll back to prior live version after window.`
- trigger: `/shop_payment_complete` only
- All Pages trigger: 없음
- 결과 문서: 1시간 canary 후 rollback 확인

따라서 구분은 아래와 같다.

- version `143`: 과거 운영 1시간 canary로 목적 달성 후 rollback됨.
- workspace `167`: 별도 Preview/controlled traffic draft로 남아 있고 현재 운영 반영 없음.

## 목적 달성 여부

달성된 것:

- hash-only 저장 안전성 확인
- raw 저장 0 확인
- platform send 0 확인
- 1시간 order-complete-only canary 실행 후 rollback 확인
- 실제 Google 광고 클릭 주문완료 Preview에서 order hash, identity hash, client/session, click hash present 확인

달성되지 않았거나 지금은 다른 방식으로 대체된 것:

- NPay 외부 결제창 URL hash까지 묶는 것은 이 workspace의 목적이 아니었다.
- 현재는 `BI NPay Bridge v1.1`이 NPay 버튼 클릭과 bridge URL 증거를 맡는다.
- Google Ads 실제 구매 전용 전송은 별도 no-send 후보 생성기와 전송 장부가 맡는다.

## 삭제해도 되는가

판정: 삭제 완료.

이유:

1. 현재 live version이 아니다.
2. 변경이 `added` draft 2개뿐이다.
3. 과거 목적은 version `143`과 문서 결과로 이미 달성됐다.
4. 지금 Google ROAS 복구의 핵심은 `BI NPay Bridge v1.1`과 실제 구매 전용 Google 전송 후보 생성기다.
5. 남겨두면 다음 GTM 작업 때 “오래된 Path B 태그를 실수로 publish할 위험”만 남는다.

삭제 결과:

- 승인: TJ님 `workspace 167 삭제 승인`
- 백업 파일: `/Users/vibetj/coding/seo/data/gtm-workspace-167-backup-before-delete-20260528T053334Z.json`
- 삭제 결과 파일: `/Users/vibetj/coding/seo/data/gtm-preview-workspace-cleanup-20260528T053909Z.json`
- live version before: `146` / `BI NPay Bridge v1.1 production 20260528T044617Z`
- live version after: `146` / `BI NPay Bridge v1.1 production 20260528T044617Z`
- workspace count before: 2
- workspace count after: 1
- workspace `167`: deleted
- 남은 workspace: `147` Default Workspace
- verdict: `PASS_PREVIEW_WORKSPACE_CLEANUP`

삭제 전 권장 절차와 실제 결과:

1. workspace `167` JSON 백업
2. 현재 live version `146` 재확인
3. workspace `167` 삭제
4. workspace list에서 `167` 제거 확인
5. live version `146` unchanged 확인

위 5개 모두 완료됐다.

## NPay 결제완료 테스트 필요성

지금 당장 결제완료까지 가기 전에, 운영 v1.1 버튼 클릭 row가 먼저 필요하다.

현재 row-level 확인 결과:

- source filter: `gtm_npay_bridge_v1_1`
- 최근 240분 rows: 2
- environment: preview 2, live 0
- Google click id 보존: 2/2
- NPay bridge URL hash 보존: 1/2

해석:

Preview에서는 성공했다. 하지만 운영 publish 이후 아직 live 버튼 클릭 row는 없다.

따라서 결제완료 테스트 순서는 아래가 맞다.

1. 운영 상태에서 NPay 버튼만 1회 클릭한다.
2. `environment=live`, `has_google_click_id=true`, `has_npay_bridge_url_hash=true`인지 확인한다.
3. 1번이 PASS하면 결제완료 테스트를 1회 진행할 수 있다.

결제완료 테스트가 의미 있는 조건:

- Google 광고 클릭 또는 테스트용 Google click id가 있는 URL로 진입
- 같은 브라우저에서 NPay 버튼 클릭
- live row에 bridge URL hash가 저장됨
- 실제 NPay 결제 완료 후 VM Cloud에 NPay actual order가 들어옴
- no-send 후보 생성기가 이 둘을 같은 주문 후보로 묶음

결제완료 테스트를 바로 하지 않는 이유:

- 버튼 클릭 live row가 실패하면 결제까지 해도 원인 분석이 섞인다.
- 기존 Google Ads NPay 보조 전환 태그가 버튼 클릭 때 발화할 수 있으므로, 버튼 smoke와 결제 smoke를 분리해야 한다.
- 실제 결제 테스트는 Red Lane이다. 버튼 row 검증은 더 작고 빠른 선행 확인이다.

## 결론

workspace `167`은 백업 후 삭제 완료됐다. 운영 live version은 변경되지 않았다.

NPay 결제완료 테스트는 필요할 가능성이 높지만, 지금 바로 결제까지 가는 것보다 운영 NPay 버튼 클릭 row 1건을 먼저 확인해야 한다.

Auditor verdict: DELETE_RECOMMENDED_AFTER_BACKUP__PAYMENT_TEST_AFTER_LIVE_BUTTON_ROW
