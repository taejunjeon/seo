---
harness_preflight:
  lane: Green next plan
  allowed_actions: [document_update, read_only_monitoring_plan, approval_packet_draft]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration]
  source_window_freshness_confidence: "Option C live PASS + coffee source deep dive / 2026-05-12 22:28 KST / confidence 90%"
---

# Option C Next Wide/Deep Plan

다음은 배포 자체가 아니라 “이제 화면 숫자를 어떻게 운영 판단에 쓸 것인가”입니다. biocom은 live PASS라 다음 단계로 가도 되고, 더클린커피는 source 격리 전까지 pending을 유지해야 합니다.

## 분기 판정

| 분기 | 판정 | 다음 행동 |
|---|---|---|
| biocom live PASS | YES | dashboard 표시 확인, 24h freshness monitor, Google Ads ROAS gap 재계산 |
| coffee source ready | NO | 0/337 order_no 매칭이라 included 금지 |
| coffee pending | YES | 개발팀 site-isolated source 확인 전 bridge_pending 유지 |
| unexpected API issue | NO | rollback backup만 유지 |
| source guide conflict | PATCHED | source guide와 total current 보강 완료 |

## 다음 우선순위

1. biocom summary API를 24시간 monitor합니다. actual confirmed, legacy, bridge pending이 모두 계속 보이고 raw PII가 없는지 봅니다.
2. Google Ads ROAS=광고 플랫폼이 주장하는 값과 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값을 다시 분리 계산합니다.
3. 더클린커피는 개발팀 또는 별도 source에서 site-isolated actual order source가 나올 때까지 included 금지입니다.
4. Google Ads conversion upload는 confirmed-only guard와 exact campaign attribution이 닫히기 전까지 Red HOLD입니다.

산출 JSON: `data/option-c-next-wide-deep-plan-20260512.json`
