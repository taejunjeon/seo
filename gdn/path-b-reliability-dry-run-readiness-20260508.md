# Path B order bridge reliability dry-run readiness

작성 시각: 2026-05-09 00:08 KST
목적: Preview evidence 또는 hash-only rows 확보 후 order bridge reliability를 dry-run으로 판단하기 위한 준비 상태 정리
Lane: Green design/readiness
Mode: no-send / no-operational-write / no-platform-send

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
  lane: Green readiness
  allowed_actions:
    - reliability dry-run 설계
    - preview evidence schema 작성
    - no-send 판단 기준 정리
  forbidden_actions:
    - operational schema migration
    - operating storage canary
    - GTM Production publish
    - Imweb production save
    - platform send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "Mode A endpoint smoke + path-b-order-bridge-reliability-dry-run-design-20260508.md"
    window: "2026-05-09 00:02-00:08 KST"
    freshness: "2026-05-09 00:08 KST"
    confidence: 0.84
```

## 10초 결론

reliability dry-run의 서버 전제는 충족됐다.
다음 입력은 실제 GTM Preview evidence다.

즉, 지금은 "계산 기준"은 준비됐고, "실제 결제완료 화면에서 잡힌 hash-only 재료"가 아직 비어 있다.

## 현재 준비된 것

- HTTPS no-send endpoint: PASS.
- synthetic hash present 검증: PASS.
- CORS: PASS.
- raw echo 0: PASS.
- raw logging 0: PASS.
- platform send 0: PASS.
- Preview evidence JSON schema: 준비됨.
- dry-run 판단 기준: 승인됨.

## 아직 필요한 입력

1. 결제완료 화면 Preview evidence.
   - `email_hash_present` 또는 `phone_hash_present`.
   - `order_no_hash_present`.
   - `client_session_present`.
   - `click_id_present`.
   - `path`, `pay_type`, `member/guest`, `npay_returned`.

2. hash-only row 또는 Preview evidence의 최소 표본.
   - homepage 결제완료 우선.
   - NPay는 thanks page 복귀 여부를 별도 필드로 분리.

## dry-run 판단 규칙

- `paid_at` 이후 click은 제외한다.
- `paid_at` 이전 click만 후보로 둔다.
- 1d / 7d / 30d lookback을 분리한다.
- last eligible click을 primary로 둔다.
- 이전 click은 assist로 둔다.
- 후보 2개 이상은 ambiguous로 표시한다.
- `send_candidate=false`를 유지한다.
- uplift는 아직 no-send 기준 가설로만 표기한다.

## confidence 기준

- A: order_no_hash + identity_hash + client/session + click_id가 모두 있고 시간 조건이 맞는다.
- B: order_no_hash + identity_hash가 있고 click 후보가 1개다.
- C: identity_hash만 있고 click 후보가 여러 개다.
- D: order_no_hash 또는 identity_hash가 없거나 thanks page 복귀가 불확실하다.

## 100%까지 남은 단계

1. GTM Preview evidence 확보.
   - Path B 기준 58% -> 약 70%.

2. reliability dry-run 입력 생성.
   - Path B 기준 70% -> 약 80%.

3. 1h hash-only canary 승인 및 운영 저장.
   - Path B 기준 80% -> 약 90%.
   - 현재 HOLD, 별도 Yellow 승인 필요.

4. confirmed purchase no-send candidate prep.
   - Path B 기준 90% -> 100%.
   - 실제 전송은 여전히 금지.

## 다음 병목

GTM Preview UI 접근이다.
Codex는 서버와 문서 준비를 끝냈지만, 실제 Google Tag Manager fresh workspace Preview는 TJ님의 브라우저/계정 세션에서 실행해야 한다.

Auditor verdict: READY_FOR_PREVIEW_INPUT
Confidence: 84%
