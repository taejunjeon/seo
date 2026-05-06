# 월별 채널 매출 정합성 컨펌 대기열

작성 시각: 2026-05-05 23:40 KST
대상: biocom 월별 유입 채널 매출 정합성 프로젝트
문서 성격: TJ님 컨펌이 필요한 항목만 모은 승인/보류 판단 문서. 이 문서 작성 자체는 Green Lane이다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - total/!total.md
    - gdn/google-click-id-preservation-plan-20260505.md
    - gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md
    - gdn/google-ads-confirmed-purchase-operational-dry-run-20260505.md
    - naver/npay-ga4-recovery-sample-payload-approval-20260505.md
  lane: Green
  allowed_actions:
    - 승인 대기 항목 정리
    - Codex 추천안 작성
    - 데이터 충분성 평가
  forbidden_actions:
    - 운영 설정 변경
    - 광고 플랫폼 전송
    - 운영 DB write
    - GTM publish
    - backend deploy
  source_window_freshness_confidence:
    source: "total 정본 문서 + 운영 source no-send dry-run + Google click id diagnostics"
    window: "2026-04-27~2026-05-05 중심"
    freshness: "2026-05-05 read-only 검증 반영"
    site: "biocom"
    confidence: 0.87
```

## 10초 결론

현재 TJ님 결정은 실행 승인 없음이다.
방향 승인만 필요하다.
Google click id 보존 개선을 1순위로 두고, Google Ads 실제 전송, Google Ads 전환 액션 변경, 8건 GA4 복구 전송은 보류하는 것을 추천한다.
다음 승인 시점은 Codex가 [[../gdn/paid-click-intent-gtm-preview-approval-20260506|paid_click_intent GTM Preview 승인안]] 기준으로 Preview 실행 여부를 물을 때다.

## 컨펌 항목 1

**무엇을 컨펌하는가**: Google click id 보존 개선을 다음 Green/Yellow 작업의 1순위로 둔다.

**왜 필요한가**: 최신 재실행 기준 운영 결제완료 주문 623건 중 `gclid/gbraid/wbraid`가 붙은 주문이 5건뿐이다. 이 상태에서 Google Ads에 실제 결제완료 주문을 알려줘도 매칭률이 낮다.

**데이터 조사는 충분한가**: Green Lane 기준 충분하다. 운영 DB, Attribution VM snapshot, GA4 BigQuery guard, no-send dry-run으로 병목이 확인됐다.

**Codex 추천**: YES. 추천 강도 94%.

**TJ님이 지금 할 일**: 지금은 승인 버튼을 누를 필요 없다. 이후 Codex가 GTM Preview 승인안을 만들면 그때 `YES/HOLD`를 판단하면 된다.

**Codex가 다음에 할 일**: GTM에 넣을 `paid_click_intent` payload 초안과 Preview 체크리스트를 만들었다. 다음은 TJ님이 Preview 실행을 YES/HOLD로 판단하는 것이다.

## 컨펌 항목 2

**무엇을 컨펌하는가**: `confirmed_purchase` no-send 파이프라인은 실제 결제완료 주문만 후보로 삼는 기준을 채택한다.

**포함하는 것**:

- 홈페이지 결제완료 주문
- NPay 실제 결제완료 주문

**제외하는 것**:

- NPay 클릭
- NPay count
- NPay 결제 시작
- 일반 결제 시작
- AddPaymentInfo만 있는 row

**왜 필요한가**: NPay 실제 매출은 포함해야 하지만, NPay click/count를 구매완료로 학습시키면 Google Ads ROAS가 부풀고 자동입찰이 오염된다.

**데이터 조사는 충분한가**: 기준 채택에는 충분하다. 운영 source no-send dry-run에서 NPay 실제 결제완료 37건은 포함했고, click/count/payment start-only는 제외했다.

**Codex 추천**: YES. 추천 강도 96%.

**TJ님이 지금 할 일**: 별도 승인 필요 없음. 이 기준은 문서와 no-send route contract에 반영됐다.

**Codex가 다음에 할 일**: no-send receiver/dispatcher contract를 기준으로 실제 운영 후보를 계속 dry-run한다.

## 컨펌 항목 3

**무엇을 컨펌하는가**: Google Ads 실제 결제완료 주문 전송과 전환 액션 생성은 아직 승인하지 않는다.

**왜 보류하는가**: 전체 결제완료 주문 기준 Google click id 보존률이 0.8%라서 지금 전송 통로를 열어도 Google Ads 매칭률이 낮을 가능성이 크다. 또한 실제 conversion upload는 Google Ads 전환값을 바꾸는 Red Lane이다.

**데이터 조사는 충분한가**: 보류 판단에는 충분하다. 실행 승인에는 부족하다.

**Codex 추천**: HOLD. 추천 강도 93%.

**TJ님이 지금 할 일**: Google Ads UI에서 새 전환 액션을 만들거나 기존 `구매완료` Primary를 바꾸지 않는다.

**Codex가 다음에 할 일**: click id 보존률 개선 후 no-send 후보의 `gclid/gbraid/wbraid` fill rate를 다시 산출한다.

## 컨펌 항목 4

**무엇을 컨펌하는가**: NPay GA4 누락 복구 샘플 8건을 실제 전송하지 않는다.

**왜 보류하는가**: 8건은 파이프라인 검증 샘플이다. 7건은 72시간을 넘어 GA4 Measurement Protocol로 원래 세션/날짜 복구가 불확실하다.

**데이터 조사는 충분한가**: 보류 판단에는 충분하다. 실제 복구 전송 판단에는 별도 Red Lane 승인 문서가 필요하다.

**Codex 추천**: HOLD. 추천 강도 95%.

**TJ님이 지금 할 일**: 8건 실제 전송을 승인하지 않는다.

**Codex가 다음에 할 일**: 앞으로 발생하는 NPay 실제 결제완료 주문만 실시간/준실시간 후보로 만드는 쪽을 먼저 진행한다.

## 컨펌 항목 5

**무엇을 컨펌하는가**: 1차 채널 분류표를 `paid_meta`, `paid_tiktok`, `paid_google`, `paid_naver`, `owned_crm`, `organic_search`, `direct`, `unknown_quarantine` 등 현재 `!total.md` 기준으로 유지한다.

**왜 필요한가**: 채널명이 흔들리면 월별 ROAS와 예산 판단도 매번 흔들린다.

**데이터 조사는 충분한가**: 1차 운영 기준으로는 충분하다. 다만 campaign mapping과 NPay historical intent 부족 때문에 일부 unknown은 남는다.

**Codex 추천**: YES. 추천 강도 90%.

**TJ님이 지금 할 일**: 채널명을 바꾸고 싶으면 이 문서에 `NO: 바꿀 채널명`을 남기면 된다. 바꿀 필요가 없으면 별도 액션은 없다.

**Codex가 다음에 할 일**: 다음 dry-run과 `/total` API 문구를 이 채널명 기준으로 유지한다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- 현재 컨펌 대기열은 실행 요청서가 아니다.
- TJ님이 지금 바로 누를 외부 화면은 없다.
- 다음에 실제 외부 변경이 필요하면 별도 Yellow/Red 승인 문서로 분리한다.
