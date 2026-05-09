# GTM Retous/Imweb/email/phone dependency map

작성 시각: 2026-05-08 22:41 KST
대상: biocom GTM-W2Z6PHN Default Workspace
Status: read_only_dependency_map__no_cleanup
Do not use for: GTM tag pause/delete, Production publish, raw PII bridge

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
    - gdn/gtm-retous-imweb-legacy-tag-audit-20260508.md
  lane: Green GTM API read-only inventory
  allowed_actions:
    - GTM Default Workspace read-only variable/tag/trigger inventory
    - local JSON/markdown artifact creation
    - dependency classification
  forbidden_actions:
    - GTM Production publish
    - GTM tag pause/delete
    - raw email/phone/member_code storage
    - raw email/phone/member_code logging
    - backend deploy
    - operational schema migration
    - platform send
  source_window_freshness_confidence:
    source: "GTM API read-only Default Workspace definitions + TJ Tag Assistant manual 200/201/203 evidence"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 22:40 KST"
    confidence: 0.87
```

## 10초 결론

GTM에는 Retous/Imweb/memberCode 흔적이 남아 있지만, 지금 바로 정리하면 안 된다. 구매/GA4/Google Ads 태그와 얽힌 항목이 많다.

읽기 전용 inventory 기준 관련 변수 54개, 관련 태그 33개가 잡혔다. 이 중 `pii_risk`는 17개, `critical_do_not_touch`는 14개다. 대량 정리보다 dependency map을 기준으로 Preview 단위로만 손대야 한다.

## 근거 파일

- JSON: `data/gtm-retous-imweb-dependency-map-20260508.json`
- 생성 스크립트: `backend/scripts/gtm-retous-imweb-dependency-map.ts`

## 전체 숫자

| 항목 | 값 |
|---|---:|
| GTM 변수 총수 | 60 |
| GTM 태그 총수 | 59 |
| GTM 트리거 총수 | 85 |
| 관련 변수 | 54 |
| 관련 태그 | 33 |
| keep | 44 |
| critical_do_not_touch | 14 |
| pii_risk | 17 |
| deprecate_candidate | 5 |
| unknown | 7 |

GTM API는 Tag Assistant의 runtime firing count를 직접 제공하지 않는다. 실행 횟수는 TJ님 수동 evidence를 보조 근거로 쓴다.

## 절대 건드리면 안 되는 후보

구매, GA4, Google Ads, Channel 계열은 pause/delete 금지다.

주요 예:

- `GA4_구매전환_Npay`
- `GA4_구매전환_홈피구매`
- `GA4_픽셀`
- `HURDLERS - [데이터레이어] 구매`
- `HURDLERS - [데이터레이어] 네이버페이 구매 (장바구니)`
- `TechSol - [GAds]NPAY구매 51163`
- `tmp_구글 Ads 동적 리마케팅 잠재고객`

이 항목들은 매출/광고/분석 태그와 연결되어 있으므로 정리 대상이 아니다. 수정이 필요하면 별도 Preview와 rollback 문서가 있어야 한다.

## PII risk 후보

아래 항목은 raw email/phone/user_id 계열을 읽거나 전송 태그와 연결되어 있다. Path B에서 쓸 수 있더라도 raw 재사용은 금지다.

- `email_buy`: `[name='ordererEmail']` 후보.
- `email_reg`: `[type=email]` 후보.
- `phone_buy`: `[name='ordererCall']` 후보.
- `phone_reg`: `#join_callnum` 후보.
- `HURDLERS - [맞춤 JS] user_id`: `.email-info` 후보.
- `UPDE_buy_em_pn`: Google Ads user-provided data 계열.
- `UPDE_reg_em_pn`: Google Ads user-provided data 계열.
- `User_id`: `HURDLERS - [맞춤 JS] user_id`를 참조.

Path B에서는 이 값들을 직접 저장하거나 전송하지 않는다. 다만 Path B 승인 범위 안에서 server-side HMAC hash-only Preview는 별도 승인으로 허용 가능하다. 이 경우에도 backend no-send endpoint에서 transient로 받아 HMAC 후 즉시 폐기해야 한다.

## memberCode 계열 후보

아래 항목은 memberCode 흔적이 있으나 2026-05-08 Preview evidence 기준 실제 source가 비어 있었다.

- `memberCode`
- `Retous - [맞춤] memberCode`
- `RETOUS - [변수] member_code`
- `Retous - [변수] memberCode`

참조 관계:

- `memberCode`는 `GA4 장바구니 담기2`, `ga4 장바구니 이벤트`에서 참조된다.
- `Retous - [변수] memberCode`는 `HURDLERS - [이벤트전송] 구매`, `HURDLERS - [이벤트전송] 네이버페이 구매`, `HURDLERS - [이벤트전송] 상세페이지 조회`에서 참조된다.

이 항목은 deprecate candidate다. 즉시 삭제 대상이 아니라, 현재 empty인 오래된 기대 흔적으로만 표시한다.

## unknown 후보

아래 항목은 영향 판단이 부족하다.

- `Ads ID`
- `dlv_price_vlaue`
- `idx value`
- `JS - Purchase Transaction ID (fallback chain)`
- `TechSol - Custom Javascript 30698`
- `TechSol - Custom Javascript 65481`
- `USER_TIME`

특히 `JS - Purchase Transaction ID (fallback chain)`은 구매전환 태그와 연결되어 있으므로 이름이 unknown이어도 변경 금지에 가깝다.

## TJ님 수동 evidence 반영

2026-05-08 19:17 KST 전후 Tag Assistant evidence에서 200/201/203 이벤트가 확인됐다.

- 200 `gtm.linkClick`: NPay 구매하기 버튼 클릭.
- 201 `h_add_payment_info`: NPay 결제 시작 단계.
- 203 `conversion`: NPay 구매처럼 잡힌 기존 전환 이벤트.
- `memberCode`/Retous memberCode 계열은 empty/undefined였다.
- email-like user_id는 보였으나 raw bridge로 사용하면 안 된다.
- NPay 주문/결제 창까지 이동했지만 실제 결제는 하지 않았다.

## 정리 후보와 금지 후보

정리 후보:

- memberCode 계열 변수 4개는 deprecate candidate다.
- 단, GA4/HURDLERS 이벤트 태그에서 참조하므로 바로 삭제하면 안 된다.
- 삭제가 아니라 `unused after Preview proof`로 별도 sprint를 잡아야 한다.

금지 후보:

- 구매/GA4/Google Ads/Channel/UPDE/User_id 계열 태그.
- `HURDLERS - [맞춤 JS] user_id`.
- `email_buy`, `phone_buy`, `UPDE_buy_em_pn`.

## 지금 결론

Retous/Imweb legacy 정리는 지금 하지 않는다. Path B 검증에는 필요한 후보만 복사하지 말고, no-send HMAC endpoint로 raw 값을 즉시 해시화하는 별도 Preview 태그를 만들어야 한다.
