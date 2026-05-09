# Path C attribution rule v2

작성 시각: 2026-05-08 17:38 KST
최종 업데이트: 2026-05-08 18:40 KST
대상: member_code_hash 매개 confirmed_purchase no-send 후보 생성
문서 성격: Green Lane attribution rule 설계. 운영 적용은 backend deploy 승인 이후.
관련 문서: [[canary-effect-meaningful-dry-run-20260508]], [[path-c-backend-deploy-approval-v2-20260508]], [[path-c-member-code-attribution-design-20260508]]
Status: direction_approved / implementation_after_backend_hold
Do not use for: actual send, conversion upload, Google Ads conversion action 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - data/!channelfunnel.md
  lane: Green attribution rule design
  allowed_actions:
    - no-send rule design
    - local script/test update after approval
    - read-only evidence review
  forbidden_actions:
    - platform send
    - production deploy
    - schema migration
  source_window_freshness_confidence:
    source: "canary-effect dry-run 18.4h ambiguity counters"
    window: "2026-05-07 23:01~2026-05-08 17:23 KST"
    freshness: "generated 2026-05-08 17:23 KST"
    confidence: 0.92
```

## 한 줄 결론

Path C는 `member_code_hash`로 주문과 click을 묶더라도 모든 prior click을 구매로 보지 않는다. **paid_at 이전 가장 최근 paid click을 primary**, 이전 click은 assist로 남기며, 후보가 많으면 ambiguous를 반드시 표시한다.

## 1. 왜 v2 rule이 필요한가

18.4h dry-run에서 주문 52건 모두 prior click 후보가 multiple이었다.

| metric | value |
|---|---:|
| orders_checked | 52 |
| orders_with_single_prior_click | 0 |
| orders_with_multiple_prior_clicks | 52 |
| median_prior_click_candidates | 329 |
| p90_prior_click_candidates | 644 |
| max_prior_click_candidates | 691 |

이는 current ledger 직접 source를 주문에 무작위로 붙이면 과대귀속이 된다는 뜻이다. `member_code_hash` bridge가 생겨도 같은 회원이 여러 광고 click을 가진 경우가 많으므로 primary/assist/ambiguous rule이 필요하다.

## 2. 기본 규칙

1. `paid_at` 이후 click은 제외한다.
2. `paid_at` 이전 click만 후보로 본다.
3. lookback은 1d / 7d / 30d를 분리 계산한다.
4. primary는 `paid_at` 이전 가장 최근 paid click이다.
5. primary 이전 click은 assist로 남긴다.
6. 후보가 2개 이상이면 `ambiguous=true`다.
7. `send_candidate=false`는 Red 승인 전까지 유지한다.

## 3. Candidate filter

필수 조건:

- same `site`
- same `member_code_hash`
- `received_at <= paid_at`
- `received_at >= paid_at - lookback`
- `status='received'` 또는 accepted equivalent
- `click_id_type in ('gclid','gbraid','wbraid')`
- `click_id_hash != ''`

제외:

- `received_at > paid_at`
- rejected/test/debug/preview traffic
- PII guard 실패 row
- raw member_code only row
- click id 없는 row

## 4. Lookback output

각 주문은 아래 카운터를 갖는다.

| field | 의미 |
|---|---|
| `path_c_1d_candidate_count` | paid_at 이전 1일 내 같은 member_code_hash paid click |
| `path_c_7d_candidate_count` | paid_at 이전 7일 내 후보 |
| `path_c_30d_candidate_count` | paid_at 이전 30일 내 후보 |
| `path_c_primary_lookback` | primary가 속한 lookback bucket |
| `path_c_assist_count` | primary 제외 후보 수 |
| `path_c_ambiguous` | 후보 2개 이상 |

## 5. Primary selection

SQL 방향:

```sql
SELECT *
FROM paid_click_intent_ledger
WHERE site = ?
  AND member_code_hash = ?
  AND received_at <= ?
  AND received_at >= ?
  AND status = 'received'
  AND click_id_hash != ''
ORDER BY received_at DESC
LIMIT 50;
```

선택:

```text
primary = rows[0]  # last eligible paid click
assist = rows[1..]
ambiguous = rows.length > 1
```

## 6. Confidence grade

| grade | 조건 | 사용 |
|---|---|---|
| A | 1d 후보 1개, click id present, no GA4 duplicate, paid_at 이전 | 가장 강한 no-send 후보 |
| B | 7d 후보 1개 또는 1d 후보 multiple 중 latest가 checkout/npay stage | 후보 가능하나 ambiguous 표시 |
| C | 30d 후보 multiple, latest click 존재 | assist 중심, upload 전 보수 검토 |
| D | 후보 0, after_paid_at only, test/reject, missing click id | 제외 |

## 7. NPay actual rule

NPay click 자체를 purchase로 세지 않는다.

- `npay_intent`는 click/intent evidence다.
- purchase 후보는 운영 PG/Imweb의 actual confirmed order만이다.
- NPay actual confirmed order가 `member_code_hash`로 click과 이어질 때만 Path C 후보가 된다.
- NPay payment start 또는 click count는 confirmed_purchase 후보가 아니다.

## 8. GA4 already-in-ga4 guard와 Google Ads duplicate guard 분리

`already_in_ga4`의 의미는 목적별로 다르다. GA4 복구 전송과 Google Ads confirmed_purchase 후보를 섞으면 안 된다.

```text
GA4 recovery candidate:
  already_in_ga4 == present -> block

Google Ads confirmed_purchase candidate:
  already_in_ga4 == present -> 참고 정보
  duplicate guard는 order_id + click_id + conversion_time 기준 별도 적용
```

운영 규칙:

- GA4 recovery 후보에서는 GA4에 이미 purchase가 있으면 block한다.
- Google Ads confirmed_purchase 후보에서는 GA4 purchase 존재가 자동 block은 아니다.
- Google Ads 중복 방지는 `order_id`, `click_id`, `conversion_time`, conversion action 기준으로 별도 판단한다.
- GA4 guard가 unknown이면 actual send 금지다. no-send 후보에는 `already_in_ga4_unknown`을 남긴다.

## 9. Counters

필수 출력:

```text
candidate_count
homepage_count
npay_actual_count
path_c_1d_match_count
path_c_7d_match_count
path_c_30d_match_count
path_c_primary_count
path_c_assist_count
after_paid_at
outside_window
ambiguous
already_in_ga4
google_ads_duplicate_guard_status
send_candidate
confidence_A/B/C/D
```

## 10. Success criteria

- first-touch가 아니라 last eligible paid click을 primary로 쓴다.
- 1d/7d/30d가 분리 출력된다.
- multiple candidate는 숨기지 않고 ambiguous로 표시한다.
- NPay click/count를 purchase로 승격하지 않는다.
- Red 승인 전 `send_candidate=0`이다.
