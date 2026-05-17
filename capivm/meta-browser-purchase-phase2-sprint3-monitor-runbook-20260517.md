작성 시각: 2026-05-17 12:47 KST
기준일: 2026-05-17
문서 성격: Phase2-Sprint3 Browser Purchase 보조 검증 runbook

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
    - capivm/!capiplan.md
    - gptconfirm/gpt0515-19-header-guard-v31-1-code/03-test-checklist.md
  lane: Green
  allowed_actions:
    - read-only VM Cloud aggregate API check
    - local monitor script execution
    - runbook/document update
  forbidden_actions:
    - Meta Purchase send/backfill
    - Browser Purchase diagnostic send
    - VM Cloud deploy/restart
    - GTM publish
    - Imweb header/footer edit
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud funnel-health API
    window: 1d / 7d selectable
    freshness: cached or live_force_refresh response metadata
    confidence: medium_high for aggregate health, medium for Browser Purchase because direct browser source is still limited
```

## 10초 요약

Phase2-Sprint3의 목적은 브라우저 Purchase를 무조건 복구하는 것이 아니다.
서버 CAPI가 구매를 정상 전송하고 있는지 먼저 보고, Browser Purchase가 비어 있으면 운영 매출 누락이 아니라 보조 신호 누락으로 분리해 판단한다.
이 runbook은 실제 Meta 이벤트를 보내지 않고 VM Cloud 집계 응답만 읽어서 그 분리를 자동으로 남긴다.

## 무엇을 확인하는가

- 실제 결제완료가 VM Cloud 원장에 몇 건 있는가.
- 그중 Server CAPI가 Meta로 성공 전송한 건수가 몇 건인가.
- Browser Purchase가 0이어도 Server CAPI가 살아 있으면 즉시 장애인지, 보조 리스크인지 분리한다.
- payment-decision 응답 지연 샘플이 있는지 확인한다.
- 결제완료는 있는데 CAPI send log가 없는 현재 큐가 남아 있는지 본다.

## 왜 필요한가

Meta Events Manager 화면에서는 Browser와 Server 이벤트가 같이 보인다.
그래서 Browser Purchase가 0이면 장애처럼 보일 수 있다.
하지만 우리 운영 판단에서는 실제 결제완료 주문이 Server CAPI로 성공 전송됐는지가 1차 기준이다.
이 둘을 섞으면 이미 Meta로 간 구매를 또 보내는 중복 위험이 생긴다.

## 어떻게 실행하는가

기본 실행:

```bash
bash scripts/meta-browser-purchase-phase2-sprint3-monitor.sh
```

7일 window 확인:

```bash
WINDOW=7d bash scripts/meta-browser-purchase-phase2-sprint3-monitor.sh
```

강제 실시간 계산 확인:

```bash
FORCE=1 bash scripts/meta-browser-purchase-phase2-sprint3-monitor.sh
```

출력 파일:

```text
data/project/meta-browser-purchase-phase2-sprint3-monitor-<timestamp>.json
```

## 결과 판정

- `PASS`: Server CAPI, Browser Purchase 보조 관찰, payment-decision 지표가 정상 범위다.
- `PASS_WITH_NOTES_BROWSER_PURCHASE_SUPPLEMENTARY_GAP`: Server CAPI는 정상인데 Browser Purchase만 0이다. 운영 매출 누락과 분리해서 본다.
- `PASS_WITH_NOTES_CURRENT_CAPI_MISSING_QUEUE`: Server CAPI는 대체로 살아 있지만 현재 window에 누락 큐가 남아 있다.
- `PASS_WITH_NOTES_NO_PAYMENT_DECISION_SAMPLE`: backend restart 이후 payment-decision 호출 샘플이 아직 없다.
- `FAIL_CAPI_MISSING_WHILE_CONFIRMED_EXISTS`: 결제완료는 있는데 Server CAPI 성공이 0이다.
- `FAIL_GUARDRAIL`: no-send/no-write/raw-output guard가 깨졌다.

## 사람이 보는 체크포인트

TJ님이 실제 결제완료를 테스트하거나 실제 주문이 생긴 직후에는 Chrome에서 아래만 보면 된다.

1. `payment-decision` 요청이 `200`이고 응답에 `allow_purchase`가 있는지 본다.
2. `facebook.com/tr` 요청 중 `ev=Purchase`가 1회 보이는지 본다.
3. `ev=Purchase`가 안 보여도 VM Cloud monitor에서 Server CAPI success가 있으면 운영 매출 누락과는 분리한다.

## 개발 계획 연결

- Phase2-Sprint3 1단계: Header Guard v3.1.1 cache/failure 정책 점검.
- Phase2-Sprint3 2단계: payment-decision latency와 CAPI 성공을 한 화면 기준으로 관찰.
- Phase2-Sprint3 3단계: 실제 결제완료 때 Browser Purchase UI를 보조로 확인.

## 금지선

- 이 스크립트는 payment-decision endpoint를 직접 호출하지 않는다.
- Meta Purchase를 보내지 않는다.
- diagnostic Purchase를 보내지 않는다.
- 운영DB를 쓰지 않는다.
- VM Cloud를 배포하거나 재시작하지 않는다.
- raw order/payment/click/member/email/phone 값을 출력하지 않는다.
