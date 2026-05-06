# Attribution 용어 충돌 감사

작성 시각: 2026-05-06 12:18 KST
Status: active
Owner: total / attribution
Supersedes: none
Next document: [[!ontology]]
Do not use for: 실제 플랫폼 전송 승인, Google Ads action 변경 승인, GTM publish 승인, 운영 DB write 승인

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
    - gdn/!gdnplan.md
    - naver/!npayroas.md
    - gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md
    - gdn/google-click-id-preservation-plan-20260505.md
    - naver/npay-rail-source-gap-20260506.md
  lane: Green
  allowed_actions:
    - read-only terminology audit
    - 문서 표현 기준 정리
  forbidden_actions:
    - GTM Preview/Production publish
    - Google Ads conversion action 생성/변경
    - conversion upload
    - GA4/Meta/Google Ads/TikTok/Naver 전송
    - 운영 DB write
    - backend 운영 deploy
  source_window_freshness_confidence:
    source: "repo 문서와 backend route contract 정적 검색"
    window: "2026-05-06 KST"
    freshness: "문서 감사. 숫자는 각 원문 문서의 freshness를 따른다"
    confidence: 0.88
```

## 10초 결론

가장 큰 혼선은 `클릭`, `결제 시작`, `실제 결제완료`, `플랫폼 주장값`, `내부 확정매출`을 같은 구매처럼 읽는 데서 생긴다.
앞으로 문서와 대시보드는 [[!ontology]]의 용어를 따른다.
특히 `NPay click/count`는 구매가 아니고, `NPayActualConfirmedOrder`만 실제 결제완료 주문이다.

## 감사 범위

아래 문서와 코드에서 attribution/ROAS 관련 용어를 read-only로 검색했다.

- `total/!total.md`
- `total/attribution-vm-evidence-join-contract-20260504.md`
- `total/total-api-contract-20260504.md`
- `gdn/!gdnplan.md`
- `gdn/google-ads-confirmed-purchase-execution-approval-20260505.md`
- `gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md`
- `gdn/paid-click-intent-gtm-preview-approval-20260506.md`
- `naver/!npayroas.md`
- `naver/npay-rail-source-gap-20260506.md`
- `GA4/product-engagement-summary-contract-20260505.md`
- `backend/src/routes/attribution.ts`
- `backend/src/npayRoasDryRun.ts`

## 발견한 용어 충돌

| 우선순위 | 문제 표현 | 왜 헷갈리는가 | canonical term | 처리 |
|---:|---|---|---|---|
| 1 | `NPay purchase`, `NPay 구매` | 클릭인지 실제 NPay 결제완료 주문인지 문맥 없이는 구분되지 않는다 | `NPayClick`, `NPayPaymentStart`, `NPayActualConfirmedOrder` | must |
| 2 | `NPay count`를 `구매완료` Primary label로 학습 | Google Ads에서는 구매처럼 보이나 내부 원장 기준 결제완료가 아닐 수 있다 | `ExternalPaymentIntent`, `PlatformConversionClaim` | must |
| 3 | `Google Ads ROAS` | 플랫폼 주장값인지 내부 confirmed 기준인지 한 단어로는 구분되지 않는다 | `platform_reference_roas`, `internal_confirmed_roas` | must |
| 4 | `send_candidate=0` | 결제완료 주문이 없다는 뜻처럼 보일 수 있다 | `eligible_orders`, `actual_send_candidate`, `block_reasons` | must |
| 5 | `robust_absent` | 주문이 없다는 뜻처럼 오해될 수 있다 | `PlatformPresenceStatus.robust_absent` | must |
| 6 | `source_unavailable_before_publish`를 `unmatched`로 축약 | 수집기가 없던 기간과 진짜 미매칭을 구분하지 못한다 | `SourceFreshness.source_unavailable_before_publish` | must |
| 7 | `paid_naver_unattributed` | NPay 결제수단을 Naver Ads 유입으로 오해할 수 있다 | `npay_payment_unattributed` 또는 `unknown_quarantine + payment_method=npay` | must |
| 8 | `platform value`, `conversion value` | 내부 매출처럼 합산될 위험이 있다 | `PlatformConversionClaim`, `platform_reference_value` | must |
| 9 | `confirmed_purchase` | 후보인지 실제 전송 완료인지 헷갈릴 수 있다 | `ConfirmedPurchaseCandidate`, `PlatformDispatch` | should |
| 10 | `marketing_intent` | TikTok 중심 구현과 Google click id 보존 intent가 섞일 수 있다 | `PaidClickIntent`, `marketing_intent_v2` | should |
| 11 | `payment_method=npay` | 결제수단을 유입 채널처럼 읽을 수 있다 | `payment_method=npay` plus separate `ChannelEvidence` | must |
| 12 | `site=null` | 어느 사이트 주문인지 모르는 상태인데 외부 전송 후보처럼 보일 수 있다 | `site_unknown`, `unknown_quarantine` | must |
| 13 | `TEST_GCLID`, `PREVIEW_*` | Preview 값이 live candidate에 섞일 수 있다 | `GuardDecision.block_reason=test_click_id` | should |

## 권장 표현

### NPay

나쁜 표현:

```text
NPay 구매가 많다.
```

권장 표현:

```text
NPay 클릭/결제시작 신호와 NPay 실제 결제완료 주문을 분리한다.
NPay 실제 결제완료 주문은 내부 confirmed revenue에 포함한다.
NPay 클릭/count/payment start만 있는 row는 purchase 후보에서 제외한다.
```

### Google Ads ROAS

나쁜 표현:

```text
Google Ads ROAS가 8.56x다.
```

권장 표현:

```text
Google Ads platform_reference_roas는 8.56x이고, 내부 confirmed ROAS는 별도 값이다.
Google Ads platform_reference_roas는 예산 판단용 내부 매출이 아니다.
```

### send_candidate

나쁜 표현:

```text
send_candidate=0이라 보낼 주문이 없다.
```

권장 표현:

```text
결제완료 후보는 있으나, 현재는 read-only/no-send 단계라 actual_send_candidate=0이다.
차단 사유는 missing_google_click_id, approval_required, read_only_phase처럼 분리해서 본다.
```

### robust_absent

나쁜 표현:

```text
robust_absent라 주문이 없다.
```

권장 표현:

```text
주문은 내부 원장에 존재하지만, GA4/Meta/Google Ads 같은 플랫폼 이벤트 원장에서 robust lookup 결과 purchase가 보이지 않는다.
```

## Canonical term mapping

| 기존/흔한 표현 | 정본 용어 | 뜻 |
|---|---|---|
| NPay 클릭 구매 | `NPayClick` | NPay 버튼 클릭. 구매 아님 |
| NPay count | `NPayCount` | 아임웹/태그 계열 count 신호. 구매 아님 |
| NPay 결제 시작 | `NPayPaymentStart` | 외부 결제수단 intent. 구매 아님 |
| NPay 실제 주문 | `NPayActualConfirmedOrder` | 운영 원장에서 확인된 NPay 결제완료 주문 |
| 구매 후보 | `ConfirmedPurchaseCandidate` | 결제완료 주문에서 파생된 전송 후보 |
| 플랫폼 ROAS | `platform_reference_roas` | 광고 플랫폼이 주장하는 참고 ROAS |
| 내부 ROAS | `internal_confirmed_roas` | 내부 결제완료 원장 기준 ROAS |
| robust absent | `PlatformPresenceStatus.robust_absent` | 플랫폼 원장에 이벤트가 보이지 않음 |
| 미매칭 | `unmatched` | 수집 가능 기간인데도 매칭 실패 |
| 수집 전 공백 | `source_unavailable_before_publish` | 당시 수집기가 없어 직접 매칭 불가 |
| NPay 미귀속 | `npay_payment_unattributed` | 결제수단은 NPay지만 paid_naver 증거는 없음 |
| paid_naver | `paid_naver` | Naver Ads 증거가 있는 유입 채널 |

## 실제 수정 필요 목록

| 항목 | 필요도 | 조치 |
|---|---|---|
| 새 문서와 대시보드 문구에서 `NPay가 나쁘다` 금지 | must | `NPay 클릭/count가 구매완료로 학습되는 것이 문제`로 고정 |
| `/total`, `/ads/google`에서 Google 값을 `platform_reference`로 표시 | must | 내부 confirmed 값과 색/라벨 분리 |
| `send_candidate=0` 표시 시 차단 사유 분해 | must | eligible/payment_complete/read_only/approval/missing_click_id를 따로 표기 |
| `robust_absent` 옆 설명 추가 | should | `플랫폼 이벤트 없음, 내부 주문 없음 아님` 문구 |
| NPay pre-publish bucket 이름 | must | `paid_naver_unattributed` 금지, `npay_payment_unattributed` 권장 |
| click id test prefix guard | should | `TEST_`, `DEBUG_`, `PREVIEW_` live candidate reject |

## 감사 결론

현재 문서들은 큰 방향은 맞다.
다만 같은 단어가 결제수단, 유입 채널, 플랫폼 전환 주장, 내부 매출을 오가며 쓰일 위험이 있다.
새 문서와 API/대시보드는 [[!ontology]]의 class name과 상태명을 기본값으로 사용한다.

## 다음 할 일

1. [[!ontology]]를 기준으로 `/total` API response field naming을 점검한다.
2. `/ads/google`과 `/total` 프론트엔드 문구에 `platform_reference`와 `internal_confirmed` 분리를 반영한다.
3. Google Ads confirmed purchase dispatcher 승인안 작성 시 이 문서를 block reason 용어 기준으로 참조한다.

## 금지 확인

이 감사는 Green Lane 문서 작업이다.
GTM Preview/Publish, Google Ads action 변경, conversion upload, GA4/Meta/Google Ads/TikTok/Naver 전송, 운영 DB write, backend 운영 deploy를 하지 않았다.
