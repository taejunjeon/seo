# CEO Board Slack no-send preview - 네이버 광고비 원본 확인

작성 시각: 2026-05-27 01:36 KST
기준일: 2026-05-27
문서 성격: Slack 발송 전 no-send preview
대상 채널: `sentia_ai` 후보
상태: 발송 안 함, 예약 안 함

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - report/hermes-naver-ads-ceo-board-pipeline-design-20260527.md
    - hermes/results/naver-ad-costs-teamketo-thecleancoffee-20260425-20260522.json
  lane: Green
  allowed_actions:
    - hermes_result_read
    - local_no_send_preview
    - aggregate_only_report
  forbidden_actions:
    - slack_send_or_schedule
    - naver_ads_state_change
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source: Hermes GitHub result JSON, commit 706d5fd058bccfef46c79c5fae8a4f9350093235
    window: 2026-04-25 - 2026-05-22 KST
    freshness: source generated 2026-05-27 01:22:44 KST, imported locally 2026-05-27 01:30 KST
    confidence: high for ad cost import, medium for business ROAS until internal sales join
```

## 10초 요약

Hermes가 올린 네이버 광고비 원본을 Codex가 로컬로 가져와 Slack 발송 전 문구로 만들었다.

더클린커피는 4주 합산 광고비 2,828,642원이다. 이 값은 네이버 전체 캠페인 원 집계 1,288,642원에 브랜드검색 월 정액 1,540,000원을 4주로 나눠 더한 값이다.

TEAM KETO는 4주 합산 광고비 4,009,799원이다. 별도 브랜드검색 배분은 없다.

주의해야 할 점은 ROAS다. 여기의 ROAS는 네이버가 주장하는 전환매출을 광고비로 나눈 값이다. 내부 결제완료 매출 기준 ROAS는 아직 아니다.

## Slack 메시지 초안

```text
[CEO Board] 네이버 광고비 원본 확인
기간: 2026-04-25 - 2026-05-22 KST

더클린커피: 광고비 2,828,642원, 클릭 1,555, 네이버 전환수 846, 네이버 주장 전환매출 24,515,709원, 네이버 기준 ROAS 866.70%
- 포함: 전체 캠페인 원 집계 1,288,642원 + 브랜드검색 배분 1,540,000원

TEAM KETO: 광고비 4,009,799원, 클릭 3,334, 네이버 전환수 750, 네이버 주장 전환매출 50,393,300원, 네이버 기준 ROAS 1,256.75%

주의: 위 ROAS는 네이버가 주장하는 전환매출 기준입니다. 내부 결제완료 매출 ROAS는 같은 기간 매출 원장과 조인한 뒤 별도로 계산합니다.
```

## 브랜드별 4주 합계

| 브랜드 | 광고비 | 클릭 | 네이버 전환수 | 네이버 주장 전환매출 | 네이버 기준 ROAS |
|---|---:|---:|---:|---:|---:|
| 더클린커피 | 2,828,642원 | 1,555 | 846 | 24,515,709원 | 866.70% |
| TEAM KETO | 4,009,799원 | 3,334 | 750 | 50,393,300원 | 1,256.75% |

## 더클린커피 주차별

| 주차 | 기간 | 포함 광고비 | 네이버 원 광고비 | 브랜드검색 배분 | 클릭 | 전환수 | 네이버 주장 전환매출 | ROAS |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1주차 | 2026-04-25 - 2026-05-01 | 602,890원 | 217,890원 | 385,000원 | 360 | 178 | 4,269,425원 | 708.16% |
| 2주차 | 2026-05-02 - 2026-05-08 | 737,804원 | 352,804원 | 385,000원 | 352 | 183 | 4,230,589원 | 573.40% |
| 3주차 | 2026-05-09 - 2026-05-15 | 750,226원 | 365,226원 | 385,000원 | 448 | 249 | 7,888,267원 | 1,051.45% |
| 4주차 | 2026-05-16 - 2026-05-22 | 737,722원 | 352,722원 | 385,000원 | 395 | 236 | 8,127,428원 | 1,101.69% |

## TEAM KETO 주차별

| 주차 | 기간 | 광고비 | 클릭 | 전환수 | 네이버 주장 전환매출 | ROAS |
|---|---|---:|---:|---:|---:|---:|
| 1주차 | 2026-04-25 - 2026-05-01 | 926,415원 | 820 | 165 | 11,026,900원 | 1,190.28% |
| 2주차 | 2026-05-02 - 2026-05-08 | 988,437원 | 861 | 181 | 12,957,400원 | 1,310.90% |
| 3주차 | 2026-05-09 - 2026-05-15 | 1,119,453원 | 890 | 214 | 12,441,300원 | 1,111.37% |
| 4주차 | 2026-05-16 - 2026-05-22 | 975,494원 | 763 | 190 | 13,967,700원 | 1,431.86% |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| 원격 repo | `taejunjeon/hermes-codex-repo` |
| 원격 commit | `706d5fd058bccfef46c79c5fae8a4f9350093235` |
| 원격 JSON | `results/naver-ad-costs-teamketo-thecleancoffee-20260425-20260522.json` |
| 로컬 JSON | `hermes/results/naver-ad-costs-teamketo-thecleancoffee-20260425-20260522.json` |
| window | 2026-04-25 - 2026-05-22 KST |
| source freshness | 2026-05-27 01:22:44 KST |
| confidence | 광고비 import high, 내부 매출 ROAS medium pending |

## 하지 않은 것

- Slack 발송 0건.
- Slack 예약 0건.
- 네이버 광고 계정 변경 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart 0건.
- 외부 플랫폼 send/upload 0건.

## 다음 할 일

### Codex

1. 같은 4개 주차로 더클린커피 내부 매출 원장을 맞춘다.
   - 이유: 네이버 ROAS와 내부 실제 매출 ROAS를 분리해야 한다.
   - 성공 기준: 자사몰, 스마트스토어, 쿠팡 매출이 같은 기간으로 분리된다.
   - 승인 필요 여부: read-only/no-send는 없음.

2. TEAM KETO 내부 매출 source를 확인한다.
   - 이유: 광고비는 들어왔지만 내부 매출 분자가 아직 연결되지 않았다.
   - 성공 기준: TeamKeto 매출 source가 운영DB, 쿠팡, 스마트스토어, Excel 중 어디인지 분리된다.
   - 승인 필요 여부: read-only/no-send는 없음.

### TJ님

1. 실제 `sentia_ai` Slack 발송 여부를 승인한다.
   - 이유: Slack은 외부 채널 발송이라 승인 후 진행해야 한다.
   - 성공 기준: 승인 문구 이후 Codex가 Sentia 절차로 예약 발송하고 `scheduled_message_id`를 보고한다.

