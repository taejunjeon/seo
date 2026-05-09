# Retous/Imweb legacy tag audit

작성 시각: 2026-05-08 20:17 KST
대상: biocom GTM Retous/Imweb/memberCode legacy 변수·태그
Status: read_only_inventory_no_cleanup
Do not use for: GTM tag pause/delete, GTM Production publish, raw email/member_code/order storage, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
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
    - data/biocom-live-tracking-inventory-20260501.md
    - gdn/path-c-wrapper-preview-result-20260508.md
    - gdn/path-c-member-code-source-discovery-20260508.md
  lane: Green read-only inventory
  allowed_actions:
    - GTM API read-only variable/tag inventory
    - risk classification
    - deprecate candidate documentation
  forbidden_actions:
    - GTM Production publish
    - GTM tag pause/delete
    - GTM variable/tag edit
    - Imweb body/footer edit
    - raw email/member_code/order/payment/value storage
    - GA4/Meta/Google Ads/TikTok/Naver send
  source_window_freshness_confidence:
    source: "GTM Default Workspace read-only inventory + Path C source discovery + TJ Tag Assistant 200/201/203 evidence"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:17 KST"
    confidence: 0.86
```

## 10초 결론

Retous/Imweb 쪽에 `memberCode`를 기대한 흔적은 있다. 하지만 2026-05-08 현재 GTM/브라우저에서 실제 usable `member_code` 값은 보이지 않는다.

따라서 지금 할 일은 대량 정리가 아니라 **keep / deprecate_candidate / pii_risk / unknown 분류**다. 실제 pause/delete는 하지 않는다. 특히 `HURDLERS user_id`, `email_*`, `phone_*`, `UPDE_*`는 attribution bridge로 재사용하지 않는다.

## Read-only inventory 요약

근거 파일: `data/path-bridge-fallback-inventory-20260508.json`

| 항목 | 값 |
|---|---:|
| GTM workspace | Default Workspace `147` |
| 변수 총수 | 60 |
| 태그 총수 | 59 |
| 관련 후보 항목 | 71 |
| Retous/Imweb/session 계열 | 39 |
| Path C member_code 후보지만 현재 empty | 9 |
| raw PII 금지 후보 | 15 |
| order/payment hash-only 후보 | 2 |

Path C source discovery 요약:

| 항목 | 값 |
|---|---|
| source discovery verdict | `hold_no_client_member_code_source_found` |
| checked at | 2026-05-08 20:06:25 KST |
| page probe member candidate present | 0 |
| TJ Tag Assistant 200/201/203 memberCode 계열 | empty/undefined |

## 분류 기준

| 분류 | 의미 | 지금 액션 |
|---|---|---|
| `keep` | 현재 구매/조회/세션 흐름에 쓰일 수 있어 그대로 둔다 | 수정 없음 |
| `deprecate_candidate` | 기대한 source가 비어 있고 목적이 불명확해 추후 정리 후보 | pause/delete 없음, 근거 누적 |
| `pii_risk` | 이메일/전화/user_id 계열이라 attribution bridge 재사용 금지 | raw 사용 금지, 별도 승인 없이는 유지 관찰만 |
| `unknown` | 정의만으로 영향 판단 부족 | live firing/의존 태그 추가 조사 |

## 변수 audit

| 변수 | 읽는 위치 | 분류 | 판단 |
|---|---|---|---|
| `JS - Imweb Data Layer` | `__bs_imweb` | keep | device/session object로 사용 가능. 현재 memberCode 없음 |
| `Retous - [맞춤] memberCode` | `JS - Imweb Data Layer` | deprecate_candidate | 기대 source는 있으나 200/201/203과 page probe에서 empty |
| `Retous - [변수] memberCode` | `hurdlers_ga4.member_code` | deprecate_candidate | 정의는 있으나 현재 empty |
| `RETOUS - [변수] member_code` | `member_code` | deprecate_candidate | dataLayer member_code가 현재 empty |
| `memberCode` | `member_code` | deprecate_candidate | Path C 후보였으나 현재 값 없음 |
| `Retous - [맞춤] utmSource/utmMedium/utmCampaign/utmContent/utmTerm` | `JS - Imweb Data Layer` | keep | UTM/session 계열. member bridge 아님 |
| `HURDLERS - [맞춤 JS] user_id` | `.email-info` | pii_risk | 이메일형 값 관측. attribution bridge 사용 금지 |
| `email_buy`, `email_reg` | 주문/가입 이메일 입력 후보 | pii_risk | raw/HMAC 모두 별도 승인 전 사용 금지 |
| `phone_buy`, `phone_reg` | 주문/가입 전화 입력 후보 | pii_risk | raw/HMAC 모두 별도 승인 전 사용 금지 |
| `UPDE_buy_em_pn`, `UPDE_reg_em_pn` | email/phone user-provided data | pii_risk | 기존 태그 영향 관찰만. bridge 재사용 금지 |
| `JS - Purchase Transaction ID (fallback chain)` | order_no fallback | unknown | Path B hash-only 설계 후보. raw 저장 금지 |

## 태그 audit

| 태그 | 분류 | 판단 |
|---|---|---|
| `HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` | pii_risk + member candidate | 기존 NPay intent/데이터레이어 흐름. Path C source로 쓰지 않음 |
| `HURDLERS - [이벤트전송] 네이버페이 구매` | pii_risk | 2026-05-08 수동 확인에서 NPay 결제완료 전 발화. 전환 의미 재분리 필요 |
| `GA4_구매전환_Npay` | keep with risk note | 결제완료 전 `conversion`에서 발화 확인. 정리/수정은 별도 승인 필요 |
| `TechSol - [GAds]NPAY구매 51163` | keep with risk note | Google Ads 전환 추적이 NPay 클릭 흐름에서 발화. 정리/수정은 Red/Yellow 승인 대상 |
| `User_id` | pii_risk | 이메일형 user_id 후보. bridge로 재사용 금지 |
| `HURDLERS - [이벤트전송] 구매` | keep with review | 일반 purchase 태그. 영향 커서 정리 대상 아님 |
| `HURDLERS - [데이터레이어] 구매` | keep with review | 구매 데이터레이어. Path B 설계 시 raw order/value 금지 필요 |

## 현재 쓸 수 없는 source

아래는 현재 Path C source로 쓰지 않는다.

```text
dataLayer.member_code
dataLayer.hurdlers_ga4.member_code
localStorage.__bs_imweb.memberCode
sessionStorage.__bs_imweb_session.memberCode
window.imweb.user.member_code
window.hurdlers_ga4.member_code
Retous - [맞춤] memberCode
Retous - [변수] memberCode
RETOUS - [변수] member_code
memberCode
HURDLERS user_id
email_buy / email_reg
phone_buy / phone_reg
```

이 중 memberCode 계열은 “값이 없어서 HOLD”이고, email/phone/user_id 계열은 “위험해서 별도 승인 전 금지”다.

## 정리 가능성 판단

### 지금 정리하면 안 되는 것

- 전체 Retous/Hurdlers 태그 대량 pause/delete.
- 기존 NPay/GA4/Google Ads/ChannelTalk purchase 관련 태그 수정.
- `User_id` 태그 삭제.
- `UPDE_*` 변수 삭제.

이유: 기존 태그 의존성과 플랫폼 전송 영향이 크고, 이번 작업은 read-only inventory다.

### 추후 정리 후보

- 현재 empty인 memberCode 계열 변수.
- 현재 사용처가 없는 Retous memberCode 변환 변수.
- Path C source로 오해될 수 있는 stale 문구.

정리 전 필요 조건:

1. tag/variable dependency map.
2. live firing count.
3. 영향을 받는 GA4/Google Ads/ChannelTalk/Retous 태그 목록.
4. rollback plan.
5. fresh GTM workspace Preview.
6. Production publish 별도 승인.

## 결론

Retous/Imweb legacy layer에는 `memberCode`를 기대한 흔적은 있지만, 현재 Path C를 살릴 source는 아니다.

```text
memberCode 계열: deprecate_candidate, 단 즉시 삭제 금지
Imweb session/UTM 계열: keep
email/phone/user_id 계열: pii_risk, bridge 재사용 금지
NPay/Google Ads/GA4 purchase 태그: 영향 큼, 별도 승인 전 수정 금지
```

## 다음 할일

1. Path C는 browser source가 생기기 전까지 HOLD한다.
2. Path B order-confirm beacon을 hash-only로 설계한다.
3. GTM 정리는 dependency map이 준비된 뒤 별도 cleanup 승인안으로 분리한다.
