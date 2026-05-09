# Path B Production publish readiness 보강

작성 시각: 2026-05-09 02:24 KST
요청 유형: Red/Yellow readiness document
Project: biocom Path B bridge
대상: GTM `GTM-W2Z6PHN` Path B order bridge tag
Mode: readiness only / Production publish HOLD

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
  lane: Green readiness writing; Red approval required for publish
  allowed_actions:
    - publish readiness documentation
    - trigger scope review
    - rollback and monitoring plan
  forbidden_actions:
    - GTM Production publish
    - GTM submit/create_version
    - Imweb production save
    - platform send
    - conversion upload
  source_window_freshness_confidence:
    source: "gpt0508-7 renamed Preview tag + gpt0508-8 click bridge Preview + gpt0508-9 reliability input"
    window: "2026-05-09 01:28-02:24 KST"
    freshness: "2026-05-09 02:24 KST"
    confidence: 0.84
```

## 한 줄 결론

Production publish는 아직 HOLD다. readiness 문서만 보강했고, publish 버튼을 누르거나 workspace submit/create_version은 하지 않았다.

## 왜 아직 publish가 아닌가

Path B no-send Preview는 100% PASS다.

하지만 운영 publish는 전체 사용자 tracking에 영향을 준다. publish 전에는 아래가 더 닫혀야 한다.

1. hash-only storage canary 승인 여부.
2. 실제 운영 저장 row의 raw/platform send 0.
3. trigger scope가 결제완료 화면에만 제한되는지.
4. rollback version이 준비됐는지.
5. 1h/24h monitoring 담당과 기준이 명확한지.

## Publish 후보 태그 원칙

이름 원칙:

- 과거 협력사명 사용 금지.
- 새 이름은 `AGENT_OS` 계열로 통일.
- event 이름도 `agent_os_path_b_*` 계열로 통일.

예상 태그명:

```text
AGENT_OS_path_b_order_bridge_hash_preview_no_send_20260509
```

운영 publish 전 이름에서 `preview`를 뺄지 여부는 별도 결정한다.

## Trigger scope

허용:

- Page URL contains `/shop_payment_complete`
- 또는 검증된 주문완료 dataLayer event only

금지:

- All Pages
- 상품상세 전체
- NPay 구매하기 버튼 클릭
- 기존 GA4/Google Ads 구매 전환 trigger 재사용
- 기존 live tag pause/delete/edit

## Payload guard

운영 publish 후보라도 아래는 금지다.

- raw email/phone/order/member_code storage.
- raw request body storage.
- raw debug logging.
- value/currency/payment key 저장.
- GA4/Google Ads/Meta/TikTok/Naver send.

허용되는 response 확인:

- hash present boolean.
- hash prefix only.
- `would_store`는 canary 승인 여부에 따라 제한.
- `would_send=false` 고정.
- `platform_send_count=0` 고정.

## Rollback

Production publish가 별도 승인될 경우 rollback은 아래 둘 중 하나여야 한다.

1. GTM version rollback:
   - 직전 live version으로 되돌린다.
   - rollback 후 Tag Assistant에서 Path B tag 미발화 확인.

2. Tag trigger pause 또는 kill switch:
   - 기존 태그 삭제가 아니라 trigger 차단 또는 flag OFF.
   - 기존 구매 태그는 건드리지 않는다.

## Monitoring

1h immediate:

- Path B endpoint 2xx/4xx/5xx.
- PM2 restart.
- raw pattern grep.
- platform send count.
- row_count if storage canary approved.

24h:

- order_no_hash fill rate.
- identity hash fill rate.
- click/session fill rate.
- duplicate dedupe count.
- ambiguous rate.
- NPay return 여부.

## Readiness score

| 항목 | 판정 |
|---|---|
| no-send Preview | PASS |
| real checkout identity evidence | PASS |
| click bridge evidence | PASS_CONTROLLED |
| reliability input | PASS |
| storage canary | HOLD |
| trigger scope final | HOLD |
| rollback final | HOLD |
| production publish | HOLD |

## 현재 판정

Production publish readiness: HOLD_NEEDS_CANARY_AND_SCOPE_FINAL.

Auditor verdict: PASS_READINESS_DOC_ONLY__PUBLISH_HOLD
