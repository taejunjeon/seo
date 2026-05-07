# 외부 파트 확인 요청 정본

작성 시각: 2026-05-07 01:52 KST
최신 업데이트: 2026-05-07 02:05 KST
상태: active
Owner: total / attribution
Next document: 그로스파트 회신 반영 결과 문서
Do not use for: 광고 계정 설정 변경, Meta 캠페인 수정, 운영 DB write

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - meta/campaign-mapping-split-required-dry-run-20260507.md
    - meta/campaign-mapping-split-required-order-rules-20260507.md
    - total/!total-current.md
  lane: Green 문서 정리
  allowed_actions:
    - 그로스파트 확인 요청 사항 정리
    - read-only dry-run 결과 요약
  forbidden_actions:
    - Meta Ads Manager 설정 변경
    - campaign/ad/adset 수정
    - 운영 DB write
    - 플랫폼 전송
  source_window_freshness_confidence:
    source: "그로스파트 수동 엑셀 + meta split_required dry-run"
    window: "2026-05-04~2026-05-07 KST"
    freshness: "최신 수동 엑셀 반영 완료. 일부 campaign id는 Excel 숫자형 절삭 가능성 있음"
    confidence: 0.84
```

## 10초 결론

그로스파트에 추가 확인이 필요한 자료는 **있다**. 단, 범위는 작다.

필수 확인은 2개다. 둘 다 Excel에서 campaign id가 숫자로 저장되며 뒷자리가 `000`으로 손상됐을 가능성이 있다. 이 값은 Meta 캠페인별 ROAS에 직접 영향을 주므로 Ads Manager 원본에서 campaign id를 텍스트로 다시 복사해야 한다.

TJ님이 새로 제공한 CSV `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505 (1).csv`도 확인했다. CSV row는 10개이며, 기존 문제 2개는 그대로 남아 있다. 즉 CSV 제공으로 확인 요청이 해소되지는 않았다.

## 그로스파트에 요청할 것

| 순서 | 확인 대상 | 현재 값 | 왜 확인해야 하는가 | 요청 방식 | 필요도 |
|---:|---|---|---|---|---|
| 1 | `fbclid only (/sosohantoon01, /kangman03, /shop_view/?idx=503)` | `120242626179290000` | Meta campaign id는 15~18자리 정밀 숫자다. Excel이 뒤 3자리를 `000`으로 바꿨을 가능성이 있어 단일 campaign 확정에 쓰면 위험하다 | Ads Manager에서 해당 campaign 상세 URL 또는 ID를 열고 campaign id를 텍스트로 복사해 전달 | 필수 |
| 2 | `meta_biocom_iggacidset_2026` | `120237452088280000`, `120235591897270396` | 첫 번째 후보 ID가 `000`으로 끝난다. 기존 seed에는 `120237452088280396` 형태가 있어 원본 재확인이 필요하다 | Ads Manager에서 `iggacidset_2026` 관련 campaign 후보 2개의 정확한 campaign id를 텍스트로 전달 | 필수 |

## 지금 추가 요청하지 않아도 되는 것

- `meta_biocom_kkunoping02_igg`는 campaign `120242626179290396`으로 확정 처리했다.
- `inpork_biocom_igg`는 Meta 캠페인 ROAS에서 제외하는 판단으로 충분하다.
- `split_required` 6개 alias는 그로스파트에게 당장 수동 판단을 더 요청하기보다, 주문별 `campaign/adset/ad id`, 날짜, URL Parameters export가 생기면 Codex가 read-only로 다시 나누는 것이 더 정확하다.

## CSV 확인 결과

| 항목 | 결과 |
|---|---|
| 파일 | `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505 (1).csv` |
| row 수 | 10 |
| precision loss 후보 | 2 |
| 결론 | 기존 요청 유지 |

precision loss 후보:

| 확인 대상 | CSV의 campaign id | 판단 |
|---|---|---|
| `fbclid only (/sosohantoon01, /kangman03, /shop_view/?idx=503)` | `120242626179290000` | `...000`으로 끝나므로 Ads Manager 원본 exact id 필요 |
| `meta_biocom_iggacidset_2026` | `120237452088280000`, `120235591897270396` | 첫 번째 id가 `...000`으로 끝나므로 Ads Manager 원본 exact id 필요 |

## 그로스파트 회신 형식

아래 2줄만 받으면 된다.

```text
fbclid only (/sosohantoon01, /kangman03, /shop_view/?idx=503): campaign_id=정확한_ID
meta_biocom_iggacidset_2026: 후보 campaign_id=정확한_ID_1, 정확한_ID_2
```

주의:

- Excel 셀 서식은 `텍스트`로 둔다.
- 숫자형 셀에 붙여넣으면 다시 `000`으로 손상될 수 있다.
- 가능하면 Ads Manager campaign URL도 같이 남긴다.

## 근거 문서

- [[../meta/campaign-mapping-split-required-dry-run-20260507]]
- [[../meta/campaign-mapping-split-required-order-rules-20260507]]
- [[../total/!total-current]]

## 다음 할일

1. 그로스파트가 위 2개 exact id를 회신한다.
2. Codex가 `meta-split-required-dry-run`을 다시 실행한다.
3. precision loss가 사라지면 해당 row를 `split_required` 또는 `mapped`로 재판정한다.
4. 회신이 없으면 해당 2건은 campaign ROAS에 강제 배정하지 않고 `precision_loss_review`로 유지한다.
