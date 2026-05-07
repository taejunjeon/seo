# Coffee NPay 과거 매칭 종결안

작성 시각: 2026-05-07 12:28 KST
승인 시각: 2026-05-07 14:58 KST
상태: closed / TJ approved
Owner: coffee-data / attribution
Supersedes: none
Next document: [[!coffeedata]]
Do not use for: GA4/Meta/TikTok/Google Ads 실제 전송 승인, Naver API production 신청 승인, GTM publish 승인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  lane: Green read-only closure decision draft
  allowed_actions:
    - historical matching evidence review
    - closure recommendation
    - confirmation document creation
    - no-send/no-write audit
  forbidden_actions:
    - GA4 Measurement Protocol send
    - Meta CAPI send
    - TikTok/Google/Naver platform send
    - 운영 DB/ledger write
    - VM schema migration
    - GTM publish
  source_window_freshness_confidence:
    source: "Imweb v2 API + GA4 BigQuery + PlayAuto cross-check reports"
    window: "2026-04-23~2026-04-29 KST"
    freshness: "historical read-only report fixed at 2026-05-01 16:41 KST"
    confidence: 0.92
```

## 10초 요약

Coffee NPay 과거 매칭 Sprint는 자동 복구 전송을 열지 않고 종결한다.

이유는 간단하다. 실제 NPay 주문 원장 60건과 GA4 NPay형 purchase 58건은 금액 총액은 비슷하지만, GA4 transaction_id가 실제 주문번호가 아니라 `NPAY - ...` synthetic 값이라 주문 단위 확정 매칭이 약하다.

따라서 과거분은 `분석 완료 / 전송 금지 / 미래 intent 장부로 이관`으로 닫고, Naver API는 종결 필수 조건이 아니라 선택 보강으로 둔다.

## 종결 결정

TJ님 결정은 **YES: Phase2 과거 매칭 종결**이다.

승인 문구:

```text
YES: Coffee NPay 2026-04-23~2026-04-29 과거 매칭 Sprint를 자동 복구 전송 없이 종결합니다.
GA4/Meta/TikTok/Google Ads로 과거 purchase를 보내지 않고, NPay future intent 장부와 A-6 no-send dry-run으로 다음 단계를 진행합니다.
Naver API cross-check는 Phase2 종결 조건에서 제외하고 선택 보강으로 둡니다.
```

## 무엇을 닫는가

이 문서는 아래 질문을 닫는다.

1. GA4의 NPay형 purchase 58건이 실제 NPay 결제완료 주문과 1:1로 믿을 수 있게 맞는가.
2. Imweb actual NPay 60건 중 GA4에 없다고 보고 과거 purchase를 자동 복구해도 되는가.
3. ambiguous 29건을 기존 데이터만으로 더 줄일 수 있는가.
4. Naver API 확인이 없으면 이 Sprint를 닫을 수 없는가.

결론은 아래다.

| 질문 | 결론 |
|---|---|
| GA4 NPay형 58건과 actual 60건이 1:1로 닫히는가 | 아니다. one-to-one assigned는 42건이다 |
| unassigned actual 18건을 자동 복구 전송할 수 있는가 | 아니다. 18건 모두 전송 금지 라벨로 분리됐다 |
| ambiguous 29건을 기존 데이터만으로 축소할 수 있는가 | 아니다. 29건 모두 `can_reduce_without_new_data=N`이다 |
| Naver API가 Phase2 종결 필수인가 | 아니다. 선택 보강이다 |

## 근거 숫자

Source: [[coffee-imweb-operational-readonly-20260501]], [[coffee-npay-unassigned-ga4-guard-20260501]]

Window: 2026-04-23~2026-04-29 KST

Freshness: 2026-05-01 16:41 KST read-only report 기준

Confidence: 92%

| 항목 | 값 | 해석 |
|---|---:|---|
| Imweb NPay actual | 60건, 2,462,300원 | 실제 NPay 결제완료 주문 primary |
| GA4 NPay pattern | 58건, 2,359,300원 | GA4에 purchase로 들어온 NPay형 synthetic transaction |
| one-to-one assigned | 42건 | 보수 기준에서 분석 배정 가능 |
| one-to-one unassigned actual | 18건 | 자동 전송 후보 아님 |
| one-to-one unassigned GA4 | 16건 | 실제 주문 자동 배정 불안정 |
| unassigned actual order/channel guard | 36/36 robust_absent | 실제 주문번호와 NPay 외부 주문번호가 GA4 raw에 직접 없음 |

감사용 원문 숫자:

```text
60건, 2,462,300원
58건, 2,359,300원
assigned 42건, unassigned actual 18건, unassigned GA4 16건
`expected_synthetic_gap` 8 / `stop_historical_recovery` 6 / `manual_review_only` 3 / `needs_naver_api_crosscheck` 1
```

## unassigned actual 18건 처리

18건은 자동 복구 대상이 아니다. 이미 다음 네 라벨로 분리됐다.

| 라벨 | 건수 | 의미 | 처리 |
|---|---:|---|---|
| `expected_synthetic_gap` | 8 | GA4 synthetic 구조 때문에 생긴 자연 gap 가능성이 큼 | 과거 자동 복구 금지 |
| `stop_historical_recovery` | 6 | 금액/시간/상품 근거가 약해 복구하면 오탐 위험 | 과거 복구 중단 |
| `manual_review_only` | 3 | 사람이 보면 참고 가능하지만 자동 판단은 위험 | 수동 참고만 |
| `needs_naver_api_crosscheck` | 1 | Naver API가 있으면 보강 가능 | 선택 보강 |

## ambiguous 29건 처리

ambiguous 29건도 기존 데이터만으로 자동 축소할 수 없다.

| 라벨 | 건수 | 처리 |
|---|---:|---|
| `expected_synthetic_gap` | 19 | 미래 intent 장부로 이관 |
| `needs_naver_api_crosscheck` | 5 | 선택 보강 |
| `stop_historical_recovery` | 3 | 과거 복구 중단 |
| `manual_review_only` | 2 | 수동 참고만 |

핵심 판단:

```text
can_reduce_without_new_data = N, 29/29
```

즉 Naver API 또는 future intent 같은 새 증거 없이는 이 ambiguous를 더 줄이면 오탐 위험이 커진다.

## 100% 종결 기준

이 Sprint를 100%로 닫는 기준은 아래 5개다.

| 기준 | 현재 상태 | 판정 |
|---|---|---|
| 실제 NPay 주문 primary source 확정 | Imweb v2 API `type=npay` 60건 확인 | PASS |
| GA4 NPay형 purchase와 actual order 매칭 분류 | assigned/unassigned/ambiguous 분리 | PASS |
| BigQuery robust guard | order/channel 36개 모두 robust_absent 확인 | PASS |
| 과거 자동 전송 여부 결정 | 전송 금지 승인 | PASS |
| 미래 해법으로 이관 | Phase3 NPay intent live 이후 A-5/A-6 진행 중 | PASS |

이 Sprint는 아래처럼 닫는다.

```text
상태: 100% / 100%
결론: 과거분 자동 복구 전송 금지. 미래 intent 장부로 이관.
```

## Naver API 판단

Naver API는 있으면 좋지만, 이 Sprint의 100% 종결 조건은 아니다.

이유:

1. Imweb v2 API에서 actual NPay order 60건과 `channel_order_no` 60/60이 이미 확인됐다.
2. Naver API가 필요한 후보는 unassigned actual 18건 중 1건, ambiguous 29건 중 5건 수준이다.
3. 과거 GA4 transaction_id가 actual order key가 아니라서 Naver API를 붙여도 전체 자동 복구가 열리지는 않는다.

추천:

```text
Naver API 확인은 Parked / Optional로 둔다.
Phase2 종결을 막지 않는다.
```

## 금지선

이 승인으로도 아래는 금지다.

- Coffee GA4 Measurement Protocol purchase 전송
- Meta CAPI purchase 전송
- TikTok Events API 전송
- Google Ads conversion 전송
- 운영 DB/ledger write
- VM schema migration
- GTM publish
- Naver API production 신청/credential 변경

## 다음 단계

Phase2를 닫으면 실제 다음은 Phase3/Phase4다.

1. Phase3: NPay future intent 수집 A-5 monitoring closure.
2. Phase4: A-6 ledger join dry-run 재실행.
3. Phase4: A-6 backend no-send 배포 승인안 작성.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Project: coffee-data
Phase: Coffee NPay historical matching closure
Lane: Green
Mode: read-only closure recommendation

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Source:
- Imweb v2 API
- GA4 BigQuery analytics_326949178
- PlayAuto cross-check

Window:
- 2026-04-23~2026-04-29 KST

Notes:
- 과거분 자동 purchase 복구는 금지.
- Naver API는 선택 보강.
- future intent/A-6 no-send로 이관.
```
