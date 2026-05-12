---
harness_preflight:
  lane: Green next actions + approval boundary
  allowed_actions: [read_only_monitoring_plan, approval_packet_draft]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration]
  source_window_freshness_confidence: "Option C PASS + source audit / 2026-05-12 22:28 KST / confidence 90%"
---

# Next Actions And Approval

## Codex가 할 일

| Owner | Action | Lane | 추천 점수 | 승인 |
|---|---|---|---:|---|
| Codex | biocom summary API 24h monitor | Green | 93 | NO |
| Codex | Google Ads ROAS gap 재계산 | Green | 88 | NO |
| Codex | dashboard frontend에서 actual/legacy/bridge 표시 확인 | Green | 86 | NO |

## TJ님이 할 일

| Owner | Action | Lane | 추천 점수 | 승인 |
|---|---|---|---:|---|
| TJ님 | 더클린커피 site-isolated actual source를 개발팀에 확인 | Yellow | 78 | YES |
| TJ님 | Google Ads upload는 confirmed-only guard 전까지 보류 | Red | 95 | YES 필요, 지금은 NO 추천 |

## TJ님 확인 요청 상세

### 더클린커피 site-isolated actual source

- 내가 실제로 확인할 화면/대상: 개발팀이 관리하는 운영DB schema 또는 read-only view.
- 바꾸는 설정 이름: 없음. 지금은 확인만 합니다.
- 바꾸면 생기는 효과: site가 분리된 source가 있으면 다음 sprint에서 coffee actual included 패치 승인안을 만들 수 있습니다.
- 안 바꾸면 남는 문제: coffee summary는 계속 bridge_pending이며, 실제 결제완료 NPay 매출은 화면에서 예산 판단값으로 직접 쓰지 못합니다.
- Codex가 대신 못 하는 이유: 현재 접근 가능한 운영DB와 VM Cloud read-only 범위에서 site key 0, order_no match 0/337까지 확인했기 때문입니다. 새 source 존재 여부는 개발팀 관리 범위입니다.
- 성공 기준: `site='thecleancoffee'` 또는 동등한 store key로 NPay actual order를 주문 단위로 재현할 수 있어야 합니다.
- 실패 시 해석: 계속 bridge_pending 유지가 맞습니다.

## Red HOLD

아래는 별도 명시 승인 전 실행하지 않습니다.

- Google Ads conversion upload
- GA4/Meta/TikTok/Naver purchase send
- GTM production publish
- 운영DB write/import
- Imweb footer/header 변경
- thecleancoffee actual included promotion
