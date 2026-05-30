# Leading Indicator Run Packet Schema

작성 시각: 2026-05-25 19:15 KST
기준일: 2026-05-25
문서 성격: 선행지표 에이전트 실행 기록 양식 초안
Lane: Green documentation
운영 영향: 운영DB 변경 없음 / 배포 없음 / 외부 전송 없음

## 10초 요약

이 문서는 선행지표 에이전트가 한 번 실행될 때 무엇을 남겨야 하는지 정한다.
핵심은 실행 결과를 기계용 JSON 1개와 사람용 Markdown 보고서 1개로 항상 같이 남기는 것이다.

이 기록이 있어야 다음 실행에서 "왜 결과가 달라졌는지", "어떤 데이터를 봤는지", "외부 전송이나 운영 변경이 없었는지"를 다시 확인할 수 있다.

## 저장 위치

권장 위치:

```text
data/project/leading-indicator-agent-run-YYYYMMDD.json
project/leading-indicator-agent-run-YYYYMMDD.md
```

## 필수 필드

| 필드 | 쉬운 뜻 | 필수 여부 |
|---|---|---|
| run_id | 실행 식별자 | 필수 |
| created_at_kst | 실행 시각 | 필수 |
| agent_name | 실행한 에이전트 | 필수 |
| mode | 실행 모드 | 필수 |
| site | 대상 사이트 | 필수 |
| window | 분석 기간 | 필수 |
| context_docs | 참고한 문서 | 필수 |
| tools_used | 사용한 도구 | 필수 |
| source_freshness | 데이터 최신성 | 필수 |
| cohorts | 비교 집단 | 필수 |
| behavior_metrics | 행동 숫자 | 필수 |
| leading_signals | 추천 후보 | 필수 |
| eval_results | 품질 판정 | 필수 |
| outputs | 생성한 산출물 | 필수 |
| forbidden_actions_verified | 금지선 확인 | 필수 |
| next_actions | 다음 할 일 | 필수 |

## JSON 예시

```json
{
  "run_id": "leading-indicator-biocom-20260525-001",
  "created_at_kst": "2026-05-25 19:15 KST",
  "agent_name": "leading_indicator_agent",
  "mode": "read_only_design",
  "site": "biocom",
  "window": {
    "primary": "last_7d",
    "comparison": "last_28d"
  },
  "context_docs": [
    "ontology/!ontology.md",
    "ontology/leading-indicator-ontology-extension-20260525.md",
    "harness/leading-indicator/TOOL_REGISTRY.md",
    "harness/leading-indicator/EVAL_SUITE.md",
    "project/!indicatoragent.md"
  ],
  "tools_used": [
    {
      "tool_id": "vm_cloud_leading_indicator_read",
      "lane": "Green",
      "allowed": ["read aggregate"],
      "forbidden": ["db write", "deploy", "platform send"]
    }
  ],
  "source_freshness": {
    "source": "VM Cloud leading indicator aggregate",
    "freshness": "not_run_in_this_design_doc",
    "confidence": 0.0,
    "note": "이 파일은 설계 초안이므로 실제 조회값 없음"
  },
  "cohorts": [],
  "behavior_metrics": [],
  "leading_signals": [],
  "eval_results": [],
  "outputs": [
    "json_run_packet",
    "markdown_report"
  ],
  "forbidden_actions_verified": {
    "operating_db_write": false,
    "vm_cloud_deploy": false,
    "gtm_publish": false,
    "platform_send": false,
    "raw_identifier_output": false
  },
  "next_actions": [
    {
      "owner": "Codex",
      "lane": "Green",
      "action": "실제 read-only dry-run용 sample run packet 생성",
      "success_criteria": "source/window/freshness/confidence가 채워진 JSON과 Markdown 한 쌍 생성"
    }
  ]
}
```

## 사람용 Markdown 보고서 필수 섹션

사람용 보고서는 아래 순서를 따른다.

1. 한 줄 결론
2. 10초 요약
3. 봤던 source/window/freshness/confidence
4. 구매 전 행동 신호 요약
5. 비교 집단과 행동 숫자
6. 품질 판정
7. 추천 행동
8. 하지 않은 것
9. 금지선 확인
10. 다음 할 일

## 금지선 기록 규칙

아래 값은 항상 명시한다.

| 항목 | 기대값 |
|---|---|
| operating_db_write | false |
| vm_cloud_deploy | false |
| gtm_publish | false |
| platform_send | false |
| raw_identifier_output | false |
| auto_budget_change | false |

하나라도 true가 되려면 Green Lane이 아니다.
그 경우 실행 기록을 만들기 전에 승인 문서가 필요하다.

## 미니 디지털 트윈 연결 필드

미니 디지털 트윈 결과가 붙을 경우 아래 필드를 추가한다.
1차 원칙은 사람이 숫자를 직접 바꾸는 슬라이더가 아니라, 에이전트가 기준선을 읽고 몇 가지 시나리오를 자동 제안하는 방식이다.

```json
{
  "simulation": {
    "enabled": true,
    "mode": "ai_suggested_scenarios",
    "human_manual_slider_required": false,
    "purpose": "what_if_range_only_not_forecast_truth",
    "baseline": {
      "source": "VM Cloud landing + confirmed order source + ad spend source when available",
      "visitors_7d": 1000,
      "confirmed_orders_7d": 30,
      "purchase_conversion_rate": 0.03,
      "average_order_value_krw": 120000,
      "ad_spend_krw": 1000000,
      "source_window_freshness_confidence": {
        "source": "filled_by_run",
        "window": "filled_by_run",
        "freshness": "filled_by_run",
        "confidence": "filled_by_run"
      }
    },
    "ai_suggested_scenarios": [
      {
        "scenario_id": "baseline_hold_current",
        "label_ko": "현재 흐름 유지",
        "why_this_scenario": "다른 시나리오와 비교할 기준선이 필요하다.",
        "assumptions": {
          "visitor_change_pct": 0,
          "conversion_rate_change_pct": 0
        },
        "outputs": {
          "expected_orders": 30,
          "expected_revenue_krw": 3600000,
          "confirmed_roas": 3.6
        },
        "interpretation": "현재 흐름이 유지되는 경우의 기준선이다."
      },
      {
        "scenario_id": "checkout_friction_fix",
        "label_ko": "결제 이탈 개선",
        "why_this_scenario": "결제 시작 후 결제완료로 닫히는 비율이 낮을 때 제안한다.",
        "assumptions": {
          "checkout_to_purchase_rate_change_pp": 1
        },
        "outputs": {
          "expected_orders": "calculated_by_run",
          "expected_revenue_krw": "calculated_by_run_or_hold",
          "confirmed_roas": "calculated_by_run_or_hold"
        },
        "interpretation": "결제 UX 개선 시 주문 수가 얼마나 움직일 수 있는지 보는 시나리오다."
      }
    ],
    "limitations": [
      "예측 정답이 아니라 예상 범위 확인용",
      "AI 제안은 운영 판단 보조이며 자동 실행 명령이 아님",
      "자동 예산 변경 금지",
      "외부 플랫폼 전송 금지"
    ]
  }
}
```

매출 또는 광고비 source가 없을 때는 `expected_revenue_krw`, `confirmed_roas`를 억지로 채우지 않는다.
그 경우 `null` 또는 `HOLD until confirmed revenue and ad spend sources are attached`로 남긴다.

## 현재 상태

- 실행 기록 양식: 작성 완료
- 실제 run packet 생성: 아직 없음
- 코드 구현: 없음
- 운영 변경: 없음
- 추천 자신감: 82%
