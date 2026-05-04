# AW-308433248 UPDE 태그 pause 승인안

작성 시각: 2026-05-05 20:58 KST (상세 보강: 2026-05-05 22:20 KST)
대상: biocom.kr GTM 컨테이너 `GTM-W2Z6PHN`
문서 성격: 운영 Google Ads 계정이 아닌 `AW-308433248` 잔존 태그를 pause할지 결정하기 위한 승인안
관련 문서: [[GA4/gtm]], [[GA4/gtm-container-quality-gateway-diagnosis-20260505]], [[GA4/gtm-aw308433248-upde-pause-result-20260505]], [[docurule]]
작성 범위 Lane: Green documentation only
실행 범위 Lane: Red GTM Production publish and external platform signal change
Mode: No-send / No-write / No-deploy / No-publish / No-platform-send until TJ approval

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
  required_context_docs:
    - GA4/gtm.md
    - GA4/gtm-container-quality-gateway-diagnosis-20260505.md
  approval_required_for:
    - GTM workspace write
    - GTM quick_preview
    - GTM container version create
    - GTM production publish
    - stopping Google Ads user-provided-data events to AW-308433248
  forbidden_until_approval:
    - GTM tag update
    - GTM publish
    - Google tag gateway setup
    - Imweb header/footer edit
    - GA4/Google Ads/Meta/TikTok extra send
```

## 10초 요약

TJ님 확인 기준 현재 바이오컴 Google Ads 계정은 `AW-304339096`이다.
더클린커피와 AIBIO도 `AW-308433248`를 쓰지 않는다.
따라서 GTM의 `AW-308433248` 관련 경고는 새 Google tag를 추가해서 해결할 문제가 아니다.
오히려 운영 계정이 아닌 ID로 나갈 수 있는 잔존 태그를 멈추는 것이 맞다.

Codex 추천은 `YES: tag [200] UPDE_register, tag [204] UPDE_purchase pause 진행`이었다.
추천 자신감은 92%였다.

2026-05-05 01:16 KST 기준 TJ님 승인 후 pause를 완료했다.
실행 결과는 [[GA4/gtm-aw308433248-upde-pause-result-20260505]]에 기록했다.

## 현재 근거

Codex가 GTM API v2 read-only로 live version `140`을 확인했다.
GTM API는 태그 설정과 active 상태는 보여주지만, 실제 브라우저에서 몇 번 발화했는지의 runtime count는 제공하지 않는다.
따라서 이 문서의 “발화 가능”은 “live에 active이고 trigger 조건이 존재한다”는 뜻이다.
실제 런타임 발화까지 확인하려면 Tag Assistant/GTM Preview가 필요하며, 이는 별도 승인 전에는 실행하지 않는다.

### `[200] UPDE_register`

- 타입: `awud`
- 상태: active
- 발화 trigger: `[198] 가입하기 버튼`
- trigger 조건: `Click Text contains 가입하기` and `Page Path contains /site_join`
- conversionId: `{{Ads ID}}`
- variable `[199] Ads ID`: `308433248`
- user data variable: `[197] UPDE_reg_em_pn`
- user data fields: `phone_number={{phone_reg}}`, `email={{email_reg}}`
- conversion label: 없음
- value/currency: 없음
- transaction_id/orderId: 없음

판단:

- 회원가입 완료가 아니라 `/site_join`에서 “가입하기” 버튼 클릭 시점 신호다.
- `AW-304339096`에는 이미 `[210] 구글애즈 회원가입`이 있고, 이 태그는 `/welcome` 완료 이벤트 기준이다.
- `[200]`을 `304339096`로 단순 치환하면 완료 기준 회원가입 전환과 클릭 기준 user data 신호가 겹칠 수 있다.

### `[204] UPDE_purchase`

- 타입: `awud`
- 상태: active
- 발화 trigger: `[203] 결제하기 버튼`
- trigger 조건: `Click Classes contains css-2hoj89` and `Page Path equals /shop_payment/`
- conversionId: `{{Ads ID}}`
- variable `[199] Ads ID`: `308433248`
- user data variable: `[202] UPDE_buy_em_pn`
- user data fields: `phone_number={{phone_buy}}`, `email={{email_buy}}`
- conversion label: 없음
- value/currency: 없음
- transaction_id/orderId: 없음

판단:

- 구매 완료가 아니라 `/shop_payment/`의 “결제하기” 버튼 클릭 시점 신호다.
- value, currency, transaction_id, orderId가 없어서 confirmed purchase 정본으로 쓸 수 없다.
- `AW-304339096`에는 이미 장바구니 `[17]`, 회원가입 `[210]`, NPay 구매 `[248]`가 있고, 구매/결제 계열 태그와 중복 또는 오염 위험이 있다.

### `[199] Ads ID`

- 타입: constant variable
- 값: `308433248`
- live v140에서 이 변수를 쓰는 태그: `[200]`, `[204]` 2개
- 즉시 삭제보다는 `[200]`, `[204]` pause 후 후속 cleanup 후보로 둔다.

### `AW-304339096` 운영 계정 태그와 중복 여부

현재 `AW-304339096` 운영 계정에는 아래 active 태그가 있다.

- `[169] Google 태그 AW-304339096`: `googtag`, Initialization - All Pages
- `[15] AW전환링커`: conversion linker, All Pages
- `[17] tmp_바이오컴 장바구니`: `awct`, `conversionLabel=QuHkCL7utYoDEJixj5EB`, 장바구니 pageview
- `[210] 구글애즈 회원가입`: `awct`, `conversionLabel=A84hCP3lt4oDEJixj5EB`, `/welcome` 완료 이벤트
- `[248] TechSol - [GAds]NPAY구매 51163`: `awct`, `conversionLabel=3yjICOXRmJccEJixj5EB`, `conversionValue`, `orderId`, `currency=KRW`

중복/오염 결론:

- `[200]`은 회원가입 완료 전환 `[210]`과 목적이 겹친다.
- `[204]`는 구매 완료가 아닌 결제 버튼 클릭 신호라 구매 전환으로 승격하면 안 된다.
- `[200]`, `[204]` 모두 conversion label이 없어서 현재 `AW-304339096`의 정본 전환 액션에 직접 연결할 수 없다.
- 따라서 `308433248`를 `304339096`로 단순 치환하는 방식은 금지한다.

## 정리안

1. legacy/비정본 판단: `[200] UPDE_register`, `[204] UPDE_purchase`는 `AW-308433248`용 잔존 `awud` 태그로 본다.
2. 추천 조치: 먼저 pause한다.
3. 삭제 후보: pause 후 7~14일 동안 운영 필요성이 없고 참조가 0개가 되면 `[199]`, `[197]`, `[202]`, `[198]`, `[203]`, `[200]`, `[204]`를 후속 cleanup 후보로 둔다.
4. 재설계 후보: `AW-304339096`에 enhanced conversion 또는 user-provided data가 필요하면 새 정본 태그를 만든다. 이때 completion trigger, conversion label, value/transaction_id/orderId, consent 기준을 새로 설계한다.
5. 금지: `Ads ID=308433248`를 `304339096`로 단순 치환하지 않는다.

## 승인하면 하는 일

실행 상태: 완료.

1. live v140 기준 fresh workspace를 만든다.
2. 기존 live v140의 tag `[200]`, `[204]`, variable `[199]`, 주요 purchase tag `[43]`, `[48]`, `[118]`, `[143]`를 백업한다.
3. tag `[200] UPDE_register`를 paused 처리한다.
4. tag `[204] UPDE_purchase`를 paused 처리한다.
5. variable `[199] Ads ID`는 삭제하지 않는다.
6. quick_preview로 compiler error가 없는지 확인한다.
7. workspace status에서 변경 대상이 tag `[200]`, `[204]` 두 개뿐인지 확인한다.
8. container version을 만들고 publish한다.
9. live version에서 `[200]`, `[204]`가 paused인지 재확인한다.
10. Tag Diagnostics는 24시간 뒤에 다시 확인한다.

## 승인해도 하지 않는 일

- `Google 태그 AW-308433248`를 추가하지 않는다.
- variable `[199] Ads ID`를 `304339096`로 바꾸지 않는다.
- `[17]`, `[210]`, `[248]`의 `AW-304339096` Google Ads 태그는 건드리지 않는다.
- `[43]`, `[48]`, `[118]`, `[143]` 구매/NPay 관련 태그는 건드리지 않는다.
- Google tag gateway는 설정하지 않는다.
- 아임웹 header/footer는 수정하지 않는다.
- Meta CAPI, GA4 Measurement Protocol, TikTok Events API 전송은 하지 않는다.

## 왜 `Ads ID=304339096`로 바꾸지 않는가

이미 `AW-304339096`에는 아래 active 태그가 있다.

- `[169] Google 태그 AW-304339096`
- `[17] tmp_바이오컴 장바구니`
- `[210] 구글애즈 회원가입`
- `[248] TechSol - [GAds]NPAY구매 51163`

여기에 `[200]`, `[204]`를 `304339096`로 바꿔 붙이면 기존 Google Ads 전환과 중복되거나, 버튼 클릭 시점의 user-provided data가 의도치 않게 운영 계정에 추가 전송될 수 있다.
정확한 전환 설계 없이 이관하지 않는다.

## 성공 기준

- GTM live에서 `[200] UPDE_register`가 paused다. 완료.
- GTM live에서 `[204] UPDE_purchase`가 paused다. 완료.
- `[169]`, `[17]`, `[210]`, `[248]`는 기존 상태 그대로다.
- `[43]`, `[48]`, `[118]`, `[143]`는 기존 상태 그대로다.
- quick_preview compiler error가 없다. 완료.
- workspace change가 `[200]`, `[204]` 두 개뿐이다. 완료.
- 운영 페이지에서 `AW-304339096` 기본 태그는 계속 확인된다. live API 기준 `[169]` active 재확인 완료.
- Google Tag Diagnostics의 `Missing Google tags` 경고는 즉시가 아니라 최대 24시간 후 완화 여부를 본다.

## Hard Fail

아래 중 하나라도 발견되면 publish하지 않는다.

- workspace change가 `[200]`, `[204]` 외에 생긴다.
- Default Workspace 147을 기반으로 작업하게 된다.
- `[43]`, `[48]`, `[118]`, `[143]`가 변경된다.
- `[169]`, `[17]`, `[210]`, `[248]`가 변경된다.
- quick_preview compiler error가 난다.
- `AW-304339096` 태그가 빠진다.

## Rollback

문제 발생 시 아래 중 하나로 되돌린다.

1. publish 직전 live version으로 rollback한다.
2. 또는 백업한 tag `[200]`, `[204]` JSON으로 paused=false 상태를 복원한 별도 rollback version을 publish한다.

rollback 기준:

- Google Ads 운영 전환 수집이 급감한다.
- 회원가입/구매 관련 운영 리포트에 예상치 못한 결측이 생긴다.
- Tag Assistant에서 `AW-304339096` 기본 태그가 사라진다.

## 승인 기록

승인 전 요청 문구:

```text
YES: AW-308433248 UPDE pause 진행
```

보류 문구:

```text
NO: AW-308433248 UPDE pause 보류
```

실제 승인:

```text
pause 진행해
```

## 다음 할일

### Codex가 할 일

1. Google Tag Diagnostics를 24시간 뒤 재확인한다.
- 추천/자신감: 92%
- Lane: Green read-only
- 무엇을 하는가: `Missing Google tags` 경고가 줄었는지 확인한다.
- 왜 하는가: `[200]`, `[204]` pause가 Google tag missing 경고 원인을 실제로 줄였는지 봐야 한다.
- 어떻게 하는가: GTM/Google tag UI 또는 가능한 read-only API/화면 확인으로 경고 상태를 기록한다.
- 성공 기준: 경고 해소 또는 남은 경고 원인 분리.
- 승인 필요: NO.

2. 7~14일 뒤 cleanup 후보를 재검토한다.
- 추천/자신감: 86%
- Lane: Yellow cleanup planning
- 무엇을 하는가: `[199]`, `[197]`, `[202]`, `[198]`, `[203]` 삭제 후보 여부를 판단한다.
- 왜 하는가: pause 후 문제가 없으면 잔존 변수를 남길 이유가 줄어든다.
- 어떻게 하는가: live 참조 수와 운영 지표 변화를 확인한 뒤 삭제 승인안을 만든다.
- 성공 기준: 삭제/보존 판단 문서화.
- 승인 필요: 삭제 실행 전 YES.

### TJ님이 할 일

1. Google Ads 전환 수집 이상 여부를 24시간 동안 관찰한다.
- 추천/자신감: 88%
- Lane: Green monitoring
- 무엇을 하는가: 회원가입/장바구니/NPay 전환 수집이 예상 밖으로 꺾이지 않는지 본다.
- 왜 하는가: pause 대상은 비정본 태그지만, 실제 운영 화면에서 이상 징후를 함께 봐야 한다.
- 어떻게 하는가: Google Ads/Tag Diagnostics/Tag Assistant에서 `AW-304339096` 수집 상태를 확인한다.
- 성공 기준: `AW-304339096` 정본 전환 수집이 유지된다.
- Codex가 대신 못 하는 이유: Google Ads UI 일부는 계정 로그인/2FA와 운영자 권한이 필요할 수 있다.
