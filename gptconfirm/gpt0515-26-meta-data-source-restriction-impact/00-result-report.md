# gpt0515-26 Meta data source restriction impact audit

작성 시각: 2026-05-16 00:53 KST

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
    - gptconfirm/gpt0515-25-ads-manager-attribution-gap
  lane: Green read-only
  allowed_actions:
    - Meta policy/document research
    - existing VM Cloud/Meta API evidence review
    - gptconfirm report writing
  forbidden_actions:
    - Meta send/backfill
    - new ad account creation
    - second Pixel insertion
    - GTM publish
    - VM Cloud deploy/restart
    - operational DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: Meta UI evidence from TJ + gpt0515-25 VM Cloud/Meta read-only reports + public Meta/industry policy docs
    window: 2026-05-15 KST issue window
    freshness: reviewed at 2026-05-16 00:53 KST
    confidence: medium
```

## 판정

**판정: DATA_SOURCE_RESTRICTION_PLAUSIBLE_BUT_NOT_PROVEN + CAPI_SIGNAL_STILL_USABLE_PROVISIONAL + NEW_ACCOUNT_SECOND_PIXEL_NOT_RECOMMENDED_NOW**

건강/웰빙 데이터 소스 제한은 오늘 Ads Manager 구매 0의 **중요한 원인 후보**입니다. 현재 영향 가능성은 **40%**로 봅니다. 다만 2026-05-15 당일 지연도 여전히 강한 후보라서, 제한이 원인이라고 단정하면 안 됩니다.

Meta 머신러닝이 계속 구매 신호를 학습할 가능성은 현재 **65%**입니다. 이유는 Server CAPI Purchase가 58건 성공했고 최근 7일 Ads Manager 구매도 존재하기 때문입니다. 반대로 Browser Purchase 0, 데이터 공유 제한 경고, 2026-05-15 Ads raw purchase 0은 모두 위험 신호입니다.

## 10초 요약

Meta가 `biocom.kr`을 건강/웰빙 서비스 제공업체로 분류했고, Events Manager에 데이터 공유 제한 경고가 떠 있습니다. 이 상태에서는 CAPI가 `events_received=1`로 받아도, Meta가 그 구매를 광고 최적화/리포팅에 온전히 쓰지 않을 수 있습니다.

하지만 지금 당장 새 광고 계정이나 두 번째 Pixel로 우회하는 것은 추천하지 않습니다. 같은 도메인과 같은 사업 카테고리를 쓰면 제한이 다시 붙을 가능성이 높고, 학습 데이터가 쪼개질 위험이 큽니다.

## 확인된 숫자

Source/window: gpt0515-25 VM Cloud + Meta Graph API read-only, site=biocom, pixel=`1283400029487161`, 2026-05-15 KST, queried 2026-05-16 00:13-00:16 KST.

- VM Cloud confirmed purchase: 62건 / 17,754,197원
- Meta strong evidence confirmed: 24건 / 9,157,467원
- Meta strong 중 CAPI sent success: 22건 / 8,689,467원
- CAPI Purchase success: 58건 / 16,963,197원
- CAPI failed: 0건
- duplicate event_id: 0건
- Ads Manager raw purchase-family key: 0

## 원인 후보 확률

- Same-day Ads Manager lag: 40%
- Data source category restriction / data sharing restriction: 40%
- Ads action/custom conversion mapping mismatch: 10%
- Campaign/adset optimization mismatch: 5%
- API/rate/filter 확인 공백: 5%

이 비율은 현재 시점의 판단입니다. Meta UI 상세 제한에서 `Purchase` 또는 lower-funnel event 제한이 명시되면 제한 원인 가능성은 70% 이상으로 올라갑니다. 반대로 2026-05-16 오전 재조회에서 2026-05-15 구매가 Ads Manager에 붙으면 제한 원인 가능성은 20% 아래로 내려갑니다.

## 하지 않은 것

- Meta send/backfill 0
- 새 광고 계정 생성 0
- 두 번째 Pixel 삽입 0
- GTM publish 0
- VM Cloud deploy/restart 0
- 운영DB write/import 0
- raw order/payment/member/click id 출력 0

## 확인하면 좋은 문서

1. [02-biocom-restriction-checklist.md](./02-biocom-restriction-checklist.md)
   TJ님이 Meta UI에서 실제로 어디를 눌러 어떤 제한이 걸렸는지 확인할 체크리스트입니다.
2. [03-ads-purchase-zero-cause-reassessment.md](./03-ads-purchase-zero-cause-reassessment.md)
   Ads Manager 구매 0을 제한/지연/매핑 문제로 나눠 재평가한 근거입니다.
3. [04-new-account-second-pixel-decision.md](./04-new-account-second-pixel-decision.md)
   새 광고 계정과 두 번째 Pixel을 지금 하지 말아야 하는 이유입니다.

## 다음 할일

### TJ님이 할 일

1. **Meta UI에서 실제 제한 상세를 확인합니다.**
   왜: 지금 가장 중요한 분기점은 “Purchase가 제한된 것인지, 단순 당일 지연인지”입니다.
   어디서: Events Manager > 데이터 세트 `바이오컴_TEMP` 또는 Pixel `1283400029487161` > 설정 또는 개요 > `데이터 공유 제한 적용됨` / `카테고리 관리` / `상세 정보 보기`.
   무엇을 볼지: 제한되는 이벤트, 제한되는 데이터 필드, 검토 요청 버튼, 카테고리 변경 가능 여부, `biocom.kr`/`biocom.imweb.me`/한글 도메인 상태.
   성공 기준: `Purchase`, `AddPaymentInfo`, `InitiateCheckout` 중 어떤 이벤트가 제한되는지 확인된다.
   실패 시 해석: UI가 애매하면 화면 캡처를 기준으로 Codex가 제한 문구를 다시 분류합니다.
   Codex가 대신 못 하는 이유: Meta UI 권한/로그인/2FA 화면은 로컬 API로 볼 수 없습니다.
   승인 필요 여부: 없음.
   의존성: 없음.
   추천 점수/자신감: 95%.

2. **2026-05-15 Ads Manager 구매가 뒤늦게 붙었는지 재확인합니다.**
   왜: 제한과 당일 지연을 분리하려면 12-24시간 뒤 같은 날짜를 다시 봐야 합니다.
   어디서: Ads Manager > 날짜 `2026. 5. 15` 단일일 > 열에 `구매`, `구매 전환값`, `구매 ROAS` 추가.
   성공 기준: 구매가 0에서 증가하면 지연 가능성이 커집니다. 계속 0이면 제한/매핑 문제로 격상합니다.
   실패 시 해석: UI도 API도 0이면 Meta support/review 요청 우선순위가 올라갑니다.
   Codex가 대신 못 하는 이유: API 재조회는 가능하지만 UI 필터/제한 경고 상세는 계정 화면 확인이 더 정확합니다.
   승인 필요 여부: 없음.
   의존성: 12-24시간 경과.
   추천 점수/자신감: 92%.

### Codex가 할 일

1. **Meta로 보내는 데이터 최소화 패치 승인안을 준비합니다.**
   왜: 건강/웰빙 제한이 걸린 상태에서는 URL, custom_data, event_source_url, 상품/검사명처럼 건강 상태를 암시할 수 있는 필드를 줄여야 합니다.
   어떻게: VM Cloud CAPI payload와 브라우저 이벤트 payload에서 민감할 수 있는 URL/query/custom field를 분리해 `필수 구매 신호`와 `제거 후보`로 나눕니다.
   성공 기준: Purchase CAPI는 유지하면서 건강 관련 암시 필드가 줄어든 승인안이 나온다.
   실패 시 확인점: Meta UI에서 제한 필드가 구체적으로 나오지 않으면 보수적으로 URL/query/custom_data 최소화부터 제안합니다.
   승인 필요 여부: 설계는 Green, 배포/코드 저장은 Yellow.
   의존성: TJ님 UI 제한 상세 확인과 병렬 가능.
   추천 점수/자신감: 88%.

2. **새 광고 계정/두 번째 Pixel은 보류하고, 기존 Pixel 복구를 먼저 모니터링합니다.**
   왜: 우회성 계정/Pixel은 같은 도메인 제한을 다시 받을 수 있고, 학습 데이터가 쪼개집니다.
   어떻게: 2026-05-16 오전 재조회에서 2026-05-15 Ads purchase가 붙는지, Events Manager 제한 상세가 무엇인지 보고 결정합니다.
   성공 기준: 기존 Pixel에서 구매 리포팅이 회복되거나, 제한 사유가 명확해진다.
   실패 시 확인점: 구매가 계속 0이고 UI가 lower-funnel 제한을 명시하면 Meta review/data minimization을 먼저 진행합니다.
   승인 필요 여부: 보류는 승인 불필요. 새 계정/Pixel은 Red 성격이라 별도 승인 필요.
   의존성: Meta UI 상세 + 다음 Ads 재조회.
   추천 점수/자신감: 90%.

## Telegram 5줄 요약

전송하지 않았습니다. 기본 알림 생략 원칙에 따라 문서에 초안만 남깁니다.

```text
gpt0515-26 판정: 제한 영향 가능성 40%, CAPI 학습 지속 가능성 65%.
CAPI는 58건 성공했지만 Ads Manager purchase key는 0이라 제한/지연 둘 다 후보입니다.
새 광고 계정/두 번째 Pixel은 지금 비추천입니다.
TJ님은 Meta UI에서 제한 이벤트/필드/검토 요청 버튼을 확인해야 합니다.
Codex는 데이터 최소화 승인안과 12-24h Ads 재조회로 이어갑니다.
```
