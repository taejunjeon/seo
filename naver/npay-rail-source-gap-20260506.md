# NPay rail source 공백 분리

작성 시각: 2026-05-06 09:42 KST
대상: 2026년 4월 biocom NPay confirmed rail
문서 성격: Green Lane read-only 분류 문서. 운영 DB write, GA4/Meta/Google Ads 전송, GTM 변경은 하지 않는다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - naver/!npay.md
    - naver/!npayroas.md
    - total/!total.md
    - total/attribution-vm-evidence-join-contract-20260504.md
  lane: Green
  allowed_actions:
    - 운영 DB read-only 집계
    - NPay rail 공백 문서화
  forbidden_actions:
    - 운영 DB write
    - GA4 Measurement Protocol 전송
    - Meta CAPI 전송
    - Google Ads conversion upload
    - GTM publish
  source_window_freshness_confidence:
    source: "운영 Postgres dashboard.public.tb_iamweb_users + NPay intent live publish 문서"
    window: "2026-04-01~2026-04-30"
    freshness: "imweb_operational fresh, source lag 6.5h at 2026-05-06 09:23 KST"
    confidence: 0.91
```

## 10초 결론

2026년 4월 biocom NPay confirmed rail 139건 / 24,525,000원 중 126건 / 20,983,200원은 NPay intent live publish 이전 주문이다.
이 구간은 intent가 없어서 매칭 실패한 것이 아니라, 수집 자체가 아직 없던 기간이다.
따라서 `unmatched`가 아니라 `source_unavailable_before_publish`로 분리해야 한다.

## 기준

NPay intent-only live publish 시각은 2026-04-27 18:10 KST다.
이 시각 이전 NPay 주문은 버튼 클릭 intent 원장이 존재할 수 없다.
이 시각 이후 NPay 주문은 intent source로 matched/ambiguous/purchase_without_intent를 볼 수 있다.

## read-only 집계 결과

| bucket | 주문 | 매출 | 기간 |
|---|---:|---:|---|
| `source_unavailable_before_publish` | 126건 | 20,983,200원 | 2026-04-01 01:08:05 KST ~ 2026-04-27 15:57:44 KST |
| `post_publish_intent_available` | 13건 | 3,541,800원 | 2026-04-27 22:52:16 KST ~ 2026-04-30 23:04:53 KST |
| 합계 | 139건 | 24,525,000원 | 2026년 4월 NPay confirmed rail |

## 해석

- `source_unavailable_before_publish`는 NPay 실제 매출이다. 월별 confirmed net revenue에는 포함한다.
- 다만 유입 intent source가 없던 기간이므로 campaign/channel attribution confidence는 낮게 둔다.
- 이 bucket을 `unmatched`나 `organic`으로 강제 분류하면 안 된다.
- `post_publish_intent_available` 13건은 VM snapshot/intent log 기준으로 matched, ambiguous, purchase_without_intent를 재분류할 수 있다.

## channel assignment 반영 규칙

월별 channel assignment에서는 아래처럼 처리한다.

| 조건 | primary channel | reason |
|---|---|---|
| publish 이전 NPay confirmed order | `unknown_quarantine` 또는 별도 `paid_naver_unattributed` 후보 | intent source가 없어서 채널 증거가 부족함 |
| publish 이후 A급 NPay intent match | intent evidence에 따라 `paid_meta`, `paid_google`, `paid_naver`, `organic` 등 배정 | 실제 intent/click id/UTM 증거가 있음 |
| publish 이후 ambiguous | `unknown_quarantine` | 후보가 여러 개거나 금액/상품/시간 증거가 부족함 |
| publish 이후 purchase_without_intent | `unknown_quarantine` | 실제 NPay 매출은 있으나 intent 증거 없음 |

## 다음 작업

1. 2026년 4월 channel assignment v0.3에 `source_unavailable_before_publish` bucket을 추가한다.
2. post-publish 13건은 VM snapshot 기준 matched/ambiguous/purchase_without_intent로 재집계한다.
3. 2026년 5월부터는 NPay intent source가 전 기간에 존재하므로 월별 matched rate를 더 신뢰할 수 있다.

## Auditor verdict

Auditor verdict: PASS
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
