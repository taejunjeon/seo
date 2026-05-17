# AddPaymentInfo Source Gap Audit

작성 시각: 2026-05-17 14:38 KST
대상: 바이오컴 / VM Cloud / GTM / Meta 중간 전환 후보
Lane: Green read-only audit
외부 전송: 0
GTM publish: 0
VM Cloud 배포/restart: 0
운영DB write/import: 0

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/!capiplan.md
    - GA4/gtm.md
    - gtmaudit/gtm-audit-2026-05-16.json
  lane: Green read-only audit
  allowed_actions:
    - VM Cloud API read-only smoke
    - local code inspection
    - GTM export inspection
    - evidence document
  forbidden_actions:
    - Meta CAPI 운영 send
    - GTM Production publish
    - VM Cloud deploy/restart
    - 운영DB write/import
    - raw identifier report output
  source_window_freshness_confidence:
    source: "VM Cloud funnel-health cached API + local backend code + GTM export audit"
    window: "1d and 7d, site=biocom"
    freshness: "VM Cloud cache 2026-05-17 14:34 KST, GTM export file 2026-05-16"
    confidence: 0.9
```

## 한 줄 결론

AddPaymentInfo는 **현재 바이오컴에서 VM Cloud 원장에 저장되는 source가 없다**.
GTM에는 GA4/NPay 의도성 `add_payment_info`가 있지만, 이것은 VM Cloud 중간 전환 원장이나 Meta CAPI server source와 연결된 상태가 아니다.

## 무엇을 확인했나

### VM Cloud

- API: `https://att.ainativeos.net/api/attribution/funnel-health?site=biocom&window=1d`
- API: `https://att.ainativeos.net/api/attribution/funnel-health?site=biocom&window=7d`
- 기준 시각: cache `2026-05-17 14:34 KST`
- 결과:
  - `browser_funnel_health.available=false`
  - AddPaymentInfo count 1d = 0
  - AddPaymentInfo count 7d = 0

쉽게 말하면, VM Cloud는 지금 `AddPaymentInfo`라는 이름의 브라우저 퍼널 row를 읽을 준비는 되어 있지만, 실제로 들어온 row가 없다.

### 로컬 backend 코드

확인 파일:

- `backend/src/funnelHealth.ts`
- `backend/src/routes/meta.ts`
- `backend/src/metaCapi.ts`

현재 funnel-health는 VM Cloud ledger row의 `metadata.eventName` 또는 `metadata.event_name`이 `AddPaymentInfo`일 때만 결제수단 선택 단계로 센다.

별도 Meta CAPI funnel route는 `AddPaymentInfo`를 보낼 수 있게 되어 있지만, 이 route는 **서버 전송 경로**다.
따라서 바로 붙이면 중간 전환이 Meta로 실제 전송될 수 있으므로, 먼저 no-send 저장 경로가 필요하다.

### GTM

확인 파일:

- `GA4/gtm.md`
- `gtmaudit/gtm-audit-2026-05-16.json`

바이오컴 GTM에는 GA4/NPay 관련 `add_payment_info` 태그가 있다.
하지만 이것은 아래 의미에 가깝다.

- NPay 또는 결제 의도성 GA4 이벤트
- 광고 클릭-주문 연결이나 결제완료 정본이 아님
- VM Cloud ledger에 `AddPaymentInfo` 중간 전환 row를 남기는 태그가 아님
- Meta CAPI server source로 안전하게 보내는 태그가 아님

## 왜 0으로 보이나

원인은 데이터 없음이 아니라 **source gap**이다.

1. 브라우저 또는 GTM 쪽에서는 결제수단 선택 신호를 만들 수 있다.
2. 그러나 VM Cloud가 읽는 `metadata.eventName=AddPaymentInfo` 형태로 저장되지 않는다.
3. 현재 backend의 Meta funnel route는 직접 server CAPI 전송 성격이 있으므로, 운영 전송 없이 저장만 하는 안전한 중간 레이어가 필요하다.

## 판단

판정: `SOURCE_GAP_CONFIRMED`

신뢰도: 90%

AddPaymentInfo를 Meta CAPI로 확장하려면 바로 전송하지 말고 아래 순서가 맞다.

1. VM Cloud no-send 중간 이벤트 저장 endpoint를 만든다.
2. GTM 또는 아임웹 코드가 `AddPaymentInfo`를 이 endpoint로 보낸다.
3. 저장 row는 `purchase_candidate=false`, `included_in_purchase_roas=false`를 고정한다.
4. Test Events 1건 이하 smoke로 Meta server source 수신을 검증한다.
5. event별 staged ON 승인을 따로 받는다.

## 운영 영향

- Meta 운영 send 0.
- GTM publish 0.
- VM Cloud deploy/restart 0.
- 운영DB write 0.
- Purchase/ROAS 오염 0.
