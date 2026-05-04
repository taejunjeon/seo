# `/total` 월별 채널 매출 API 계약

작성 시각: 2026-05-04 18:51 KST
기준 기간: 2026-04-01 00:00:00 ~ 2026-04-30 23:59:59 KST
대상: biocom 우선
문서 성격: Green Lane API 계약 초안. 실제 route 구현, 운영 배포, 운영 DB write, 외부 플랫폼 전송은 하지 않는다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - total/!total.md
    - total/source-inventory-20260504.md
    - total/join-key-matrix-20260504.md
    - total/monthly-spine-dry-run-contract-20260504.md
    - total/attribution-vm-evidence-join-contract-20260504.md
  lane: Green
  allowed_actions:
    - API 계약 문서 작성
    - local dry-run script 출력 구조 정리
    - frontend handoff 필드 정의
  forbidden_actions:
    - 운영 DB write/import/update
    - backend 운영 배포
    - GTM 운영 게시
    - 광고 플랫폼 전환 송출
    - 플랫폼 ROAS 값을 내부 매출에 합산
  source_window_freshness_confidence:
    source: "monthly-spine dry-run, monthly-evidence dry-run, Attribution VM read-only API, 기존 source inventory"
    window: "2026-04-01~2026-04-30 KST"
    freshness: "계약 초안. 실제 API 호출 시 source별 queried_at/latest timestamp를 응답에 포함해야 함"
    confidence: 0.86
```

## 10초 결론

`/total` 화면은 월별 실제 확정 매출을 채널별로 나눠 보여주는 화면이다.
따라서 API는 `내부 확정 매출`, `유입 증거`, `플랫폼 주장값`, `source 최신성`을 분리해서 내려줘야 한다.

가장 중요한 금지 규칙은 하나다.
Meta, TikTok, Google, Naver가 주장하는 conversion value는 `platform_reference`에만 넣고, 내부 confirmed revenue에는 절대 더하지 않는다.

## 권장 endpoint

### 1. 월별 요약

```text
GET /api/total/monthly-channel-summary
  ?site=biocom
  &month=2026-04
  &mode=dry_run
```

이 endpoint는 `/total` 첫 화면의 기준 API다.
Claude Code가 프론트엔드를 만들 때는 이 응답 하나로 상단 KPI, 채널별 표, unknown 경고, 플랫폼 gap 카드를 그린다.

### 2. 주문별 drilldown

```text
GET /api/total/monthly-order-evidence
  ?site=biocom
  &month=2026-04
  &primary_channel=unknown
  &confidence=C
  &limit=100
```

이 endpoint는 상세 확인용이다.
첫 화면에는 주문별 목록을 바로 노출하지 말고, `unknown`, `quarantine`, 특정 paid channel을 눌렀을 때만 사용한다.

## 응답 최상위 구조

```json
{
  "metadata": {},
  "monthly_spine": {},
  "evidence": {},
  "platform_reference": {},
  "source_freshness": {},
  "frontend_copy": {}
}
```

각 영역의 의미는 아래처럼 고정한다.

| 영역 | 의미 | 내부 매출 합계 반영 |
|---|---|---|
| `metadata` | site, month, timezone, queried_at, contract_version | NO |
| `monthly_spine` | 아임웹+토스+환불로 만든 돈 기준 장부 | YES |
| `evidence` | 각 주문을 어느 채널에 붙였는지와 근거 | YES, A/B만 |
| `platform_reference` | 광고 플랫폼이 주장하는 spend/value/ROAS | NO |
| `source_freshness` | 각 source의 최신성, 권한, fallback 상태 | NO |
| `frontend_copy` | 화면에 그대로 써도 되는 쉬운 설명 문구 | NO |

## `metadata`

필수 필드:

```json
{
  "contract_version": "total-monthly-channel-summary-v0.1",
  "site": "biocom",
  "month": "2026-04",
  "timezone": "Asia/Seoul",
  "date_start": "2026-04-01",
  "date_end_exclusive": "2026-05-01",
  "queried_at": "2026-05-04T09:51:00.000Z",
  "mode": "dry_run",
  "write": false,
  "send": false,
  "deploy": false
}
```

운영 화면에는 `queried_at`, `month`, `timezone`, `mode`를 숨기지 않는다.
숫자가 다르게 보일 때 가장 먼저 확인할 기준값이기 때문이다.

## `monthly_spine`

돈 기준 정본 영역이다.
광고 플랫폼 값이나 GA4 purchase value는 여기에 넣지 않는다.

필수 필드:

```json
{
  "confirmed_net_revenue_ab": 499829436,
  "review_revenue_c": 70000,
  "quarantine_revenue_d": 26481,
  "toss_only_month_boundary_revenue": 69900,
  "net_revenue_candidate_including_c": 499899436,
  "primary_sum_matches_revenue": true,
  "join_methods": []
}
```

화면 문구는 아래처럼 쓴다.

```text
이번 달 내부 확정 순매출은 A/B confidence 기준 499,829,436원입니다.
C review와 D quarantine은 최종 close 전 확인 대상으로 분리했습니다.
```

## `evidence`

채널 배정 영역이다.
`primary_channel`은 주문 매출을 한 번만 붙이는 채널이다.
`assist_channels`는 참고용이며 합계에 중복 반영하지 않는다.

필수 필드:

```json
{
  "assignment_version": "monthly-evidence-join-dry-run-v0.4",
  "totals": {
    "orders_total_ab": 2216,
    "revenue_total_ab": 499829436,
    "assigned_orders": 1198,
    "assigned_revenue": 327906361,
    "unknown_orders": 1018,
    "unknown_revenue": 171923075,
    "primary_sum_matches_revenue": true
  },
  "channel_summary": [],
  "unknown_reasons": [],
  "evidence_tier_summary": []
}
```

`channel_summary` row 계약:

```json
{
  "primary_channel": "paid_meta",
  "orders": 727,
  "revenue": 213362158,
  "confidence": {
    "A": 211597155,
    "B": 1765003
  },
  "share_of_confirmed_revenue": 0.4269,
  "display_label": "Meta 광고",
  "interpretation": "Meta click id 또는 Meta paid UTM이 내부 확정 주문과 붙은 매출"
}
```

## `platform_reference`

플랫폼 주장값 영역이다.
내부 confirmed revenue와 일부러 분리한다.

필수 규칙:

1. `reference_only=true`여야 한다.
2. `no_internal_revenue_merge=true`여야 한다.
3. `platform_conversion_value`가 있어도 `monthly_spine.confirmed_net_revenue_ab`에 더하지 않는다.
4. attribution window, action report time, queried_at, source를 반드시 같이 내려준다.

row 계약:

```json
{
  "platform": "meta",
  "internal_channel": "paid_meta",
  "internal_confirmed": {
    "orders": 727,
    "revenue": 213362158,
    "confidence_revenue": {
      "A": 211597155,
      "B": 1765003
    }
  },
  "platform_reference": {
    "status": "not_joined",
    "source": "Meta Ads Insights API",
    "spend_krw": null,
    "conversion_value_krw": null,
    "roas": null,
    "attribution_window": null,
    "action_report_time": null,
    "queried_at": null,
    "freshness": "not_queried",
    "source_window": {
      "start_date": null,
      "end_date": null,
      "latest_date": null
    },
    "source_diagnostics": null
  },
  "gap": {
    "conversion_value_minus_internal_revenue": null,
    "roas_delta": null,
    "reason": "platform_api_reference_not_connected"
  },
  "allowed_use": "platform_reference_only",
  "forbidden_use": "do_not_add_to_internal_confirmed_revenue"
}
```

화면에서는 아래처럼 설명한다.

```text
플랫폼 ROAS는 광고 플랫폼이 자기 기준으로 주장하는 참고값입니다.
내부 확정 매출 ROAS와 숫자가 다를 수 있으며, 내부 매출 합계에는 더하지 않습니다.
```

## `source_freshness`

source 최신성 영역이다.
`/total` 화면은 source가 stale이면 ROAS 판단을 보류해야 한다.

row 계약:

```json
{
  "source": "attribution_vm",
  "role": "channel_evidence_primary",
  "status": "fresh",
  "queried_at": "2026-05-04T09:51:00.000Z",
  "latest_observed_at": "2026-04-30T14:58:43.666Z",
  "row_count": 5716,
  "confidence": "A",
  "fallback": false,
  "fallback_reason": null
}
```

필수 source:

| source | 역할 |
|---|---|
| `imweb_operational` | 주문 정본 |
| `toss_operational` | 결제/취소 정본 |
| `attribution_vm` | 결제 전후 유입 증거 |
| `local_sqlite` | 개발 캐시. 최신 판단 금지 |
| `ga4_bigquery_raw` | 세션/traffic source 보강. 권한 전까지 blocked |
| `meta_ads_api` | platform_reference |
| `tiktok_ads_api` | platform_reference |
| `google_ads_api` | platform_reference |
| `naver_ads_or_npay_reference` | platform_reference |

플랫폼 reference source도 `source_freshness`에 같이 내려준다.
예를 들어 TikTok은 아래처럼 표시한다.

```json
{
  "source": "platform_tiktok",
  "role": "platform_reference",
  "status": "local_cache",
  "latest_observed_at": "2026-05-03",
  "confidence": "B",
  "summary": {
    "platform_status": "joined",
    "source": "local_sqlite_from_tiktok_xlsx",
    "source_window": {
      "startDate": "2026-04-01",
      "endDate": "2026-04-30",
      "latestDate": "2026-05-03"
    }
  }
}
```

## `frontend_copy`

프론트엔드가 숫자를 임의 해석하지 않도록 쉬운 설명 문구를 API에 같이 둔다.

```json
{
  "headline": "2026년 4월 biocom 내부 확정 순매출은 499,829,436원입니다.",
  "subtext": "이 금액은 아임웹 주문과 토스 결제/취소를 맞춘 내부 장부 기준입니다.",
  "warnings": [
    "NPay intent source가 아직 연결되지 않아 NPay 139건은 matched/unmatched 확정 전입니다.",
    "플랫폼 ROAS는 참고값이며 내부 confirmed revenue에 합산하지 않습니다."
  ]
}
```

## Claude Code handoff

Claude Code는 `/total` 화면을 구현할 때 아래 순서를 지킨다.

1. 첫 화면 상단에는 `monthly_spine.confirmed_net_revenue_ab`, `evidence.assigned_revenue`, `unknown_revenue`, `platform_reference gap 상태`, `source_freshness 경고`를 둔다.
2. `platform_reference` 숫자는 "플랫폼 참고값"이라고 라벨링한다.
3. `unknown`과 `quarantine`은 숨기지 않는다.
4. `source_freshness.status`가 `stale`, `blocked`, `fallback`이면 예산 판단 보류 문구를 표시한다.
5. 긴 전문용어는 `frontrule.md` 기준으로 풀어 쓴다.

## 구현 상태

현재 상태는 로컬 route 초안 구현 완료다.
`backend/src/routes/total.ts`가 `GET /api/total/monthly-channel-summary`를 제공한다.
이 route는 운영 DB write 없이 `monthly-spine-dry-run.ts`와 `monthly-evidence-join-dry-run.ts`를 read-only로 실행한 뒤 이 계약 형태로 감싼다.

검증한 로컬 호출:

```text
GET http://localhost:7022/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run
```

검증 요약:

| 항목 | 값 |
|---|---:|
| `ok` | `true` |
| `contract_version` | `total-monthly-channel-summary-v0.1` |
| evidence contract | `monthly-evidence-join-dry-run-v0.4` |
| A/B confirmed net revenue | 499,829,436원 |
| primary sum matches revenue | `true` |
| assigned revenue | 327,906,361원 |
| unknown revenue | 171,923,075원 |

platform reference 검증 요약:

| platform | status | spend | conversion value | ROAS | freshness |
|---|---|---:|---:|---:|---|
| Meta | `joined` | 122,193,692원 | 489,012,112원 | 4.00 | `fresh` |
| TikTok | `joined` | 25,267,682원 | 598,161,397원 | 23.67 | `local_cache` |
| Google | `joined` | 26,835,011원 | 187,242,635원 | 6.98 | `fresh` |
| Naver | `unavailable` | - | - | - | `blocked` |

주의:
TikTok은 로컬 TikTok Ads cache 기준이다.
Naver Ads source는 아직 연결되어 있지 않아 `unavailable`로 둔다.
`platform_reference.joinStatus`는 `partial_join`으로 해석한다.
플랫폼 값은 모두 `platform_reference`에만 있으며 내부 confirmed revenue에 합산하지 않는다.

TikTok freshness 확인:

| 항목 | 값 |
|---|---:|
| source | `local_sqlite_from_tiktok_xlsx` |
| table | `tiktok_ads_daily` |
| imported rows | 346 |
| usable rows | 224 |
| min date | 2026-03-19 |
| max date | 2026-05-03 |
| warning | 한국어 export의 중복 구매 헤더를 구매값으로 추정 |

따라서 `/total` 화면에서는 TikTok을 `joined`로 표시하되, 상태는 `local_cache`로 경고한다.

## 다음 할일

1. Claude Code가 [[total-frontend-handoff-20260504]] 기준으로 `/total` 프론트엔드 화면을 구현한다.
2. `/total` route를 운영 backend에 배포할지 별도 승인 판단을 한다.
3. Naver Ads source와 운영 NPay intent source가 열리면 같은 route에서 값을 재계산한다.

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 18:51 KST | 최초 작성. `/total` 월별 채널 매출 API 계약과 `platform_reference` 분리 규칙 고정 |
| 2026-05-04 19:07 KST | 로컬 `/api/total/monthly-channel-summary` route 구현 및 2026년 4월 biocom dry-run 검증 결과 추가 |
| 2026-05-04 19:18 KST | TikTok `local_cache` freshness 세부값과 [[total-frontend-handoff-20260504]] 링크 추가 |
