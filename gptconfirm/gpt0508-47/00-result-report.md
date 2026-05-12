---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Yellow approved deploy completed + Green follow-through
  allowed_actions: [approved_vm_backend_deploy_restart, read_only_validation, source_audit, report_packaging, scoped_commit_push]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration, imweb_footer_edit, coffee_actual_included_promotion]
  source_window_freshness_confidence: "live API + VM Cloud SQLite + operational DB read-only / 2026-05-12 22:28 KST / confidence 93%"
---

# gpt0508-47 Result Report

## 한 줄 결론

- 결론: NPay 매출 화면은 이제 실제 결제완료와 `complete_time` 진단값을 분리한다. biocom은 actual included, thecleancoffee는 bridge_pending 유지다.
- Project: Growth Data / Attribution / NPay Summary API
- Lane: 승인된 Yellow 배포 완료 + Green 검증/문서화
- Mode: no-send / no-write / no-publish
- Auditor verdict: PASS_WITH_NOTES
- 현재 판정: biocom live PASS, coffee pending continue
- 자신감: 93%
- 기준 시각: 2026-05-12 22:28 KST

## 사람이 이해하는 작업 설명

- 이번에 가능해진 것: 화면에서 NPay 실제 결제완료 매출과 오래된 진단값을 따로 볼 수 있게 됐다.
- 왜 필요했는지: `complete_time`이 비어 있다고 미결제가 아닌데, 기존 화면은 그 값을 실제 결제완료처럼 읽어 NPay 매출이 오래돼 보였다.
- 어떻게 작동하는지: biocom은 운영DB `PAYMENT_COMPLETE`를 actual confirmed로 붙이고, `complete_time`은 legacy diagnostic으로 남긴다.
- 실제로 확인된 결과: biocom actual confirmed는 163건 / ₩29,500,200이고, thecleancoffee는 site 격리 전까지 `bridge_pending`이다.
- 아직 안 된 것: Google Ads campaign attribution과 coffee actual included 승격은 아직 닫히지 않았다.

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| VM backend 배포/restart | 완료 | `data/option-c-live-deploy-result-20260512.json` | VM Cloud |
| post-snapshot | PASS | `data/option-c-live-post-snapshot-20260512.json` | live API |
| rollback readiness | PASS | `gdn/option-c-live-rollback-readiness-20260512.md` | VM Cloud |
| coffee source isolation | 완료 | `data/thecleancoffee-actual-source-isolation-deep-dive-20260512.json` | VM Cloud + 운영DB |
| source guide consistency | PASS_WITH_NOTES | `data/option-c-source-guide-consistency-audit-20260512.json` | 로컬 문서/코드 |

## 하지 않은 것

| 항목 | 상태 |
|---|---|
| 운영DB write | 0 |
| Google Ads/GA4/Meta/TikTok/Naver 전송 | 0 |
| GTM publish | 0 |
| cron 등록 | 0 |
| Imweb footer/header 변경 | 0 |
| thecleancoffee actual included 승격 | 0 |
| 텔레그램 발송 | skip 유지, 발송 0 |

## 검증 결과

| 검증 | 결과 |
|---|---|
| health | `https://att.ainativeos.net/health` 200 |
| PM2 | `seo-backend` online |
| biocom summary | actual included, legacy present, bridge present |
| coffee summary | actual bridge_pending, bridge present |
| raw pattern scan | email/phone/click/payment/order 노출 0 |
| backup | `.deploy-backups/gpt0508-47-20260512T2153KST` 확인 |

## 남은 리스크

- 더클린커피는 site-isolated actual source가 아직 없다. VM Cloud coffee order_no 337건이 운영DB `tb_iamweb_users`와 0건 매칭이라 included로 올리면 오염 위험이 있다.
- biocom bridge pending 61건은 주문 단위 bridge가 더 붙으면 actual confirmed와의 차이를 더 줄일 수 있다.
- Google Ads ROAS는 아직 플랫폼 주장값과 내부 confirmed 값을 분리해서 다음 계산이 필요하다.

## 확인하면 좋은 문서

1. `gdn/option-c-live-dashboard-impact-summary-20260512.md` — TJ님이 화면 숫자가 왜 바뀌었는지 바로 이해하기 위한 문서.
2. `gdn/thecleancoffee-actual-source-isolation-deep-dive-20260512.md` — 더클린커피를 왜 actual included로 올리지 않았는지 보는 근거.
3. `gdn/option-c-next-wide-deep-plan-20260512.md` — 다음 sprint에서 무엇을 먼저 해야 하는지 보는 실행 순서.

## 다음 할일

### Codex가 할 일

1. biocom NPay actual freshness monitor
- Codex 추천: 진행 추천
- 추천 이유: live 배포 직후 24시간 동안 actual/legacy/bridge가 모두 유지되는지 보면 regression을 빨리 잡을 수 있다.
- 추천 방향에 대한 자신감: 93%
- Lane: Green
- 무엇을 하는가: `https://att.ainativeos.net/api/attribution/site-landing/summary?site=biocom&windowHours=24`를 주기적으로 읽고 actual included, legacy present, bridge present, raw PII 0을 기록한다.
- 왜 하는가: 화면 숫자가 계속 예산 판단에 쓸 수 있는 상태인지 확인하기 위해서다.
- 어떻게 하는가: curl + jq read-only로 24시간 monitor 문서를 만든다.
- 어디에서 확인하나: live API와 `gdn/` monitoring report.
- 성공 기준: HTTP 200, actual status included, invariant 0.
- 실패 시 해석/대응: actual field missing 또는 5xx면 rollback readiness 문서 기준으로 원인 확인.
- 의존성: Option C live deploy PASS 완료.
- 승인 필요: NO.

2. Google Ads ROAS gap 재계산
- Codex 추천: 진행 추천
- 추천 이유: 이제 내부 NPay actual이 분리됐으므로 플랫폼 주장 ROAS와 내부 confirmed ROAS 차이를 다시 계산할 수 있다.
- 추천 방향에 대한 자신감: 88%
- Lane: Green
- 무엇을 하는가: Google Ads ROAS=광고 플랫폼이 주장하는 값과 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값을 같은 window로 재계산한다.
- 왜 하는가: 예산 판단에 쓸 값과 참고만 볼 값을 분리하기 위해서다.
- 어떻게 하는가: 기존 Google Ads dashboard/read-only script와 Option C actual summary를 결합한다.
- 어디에서 확인하나: `gdn/google-ads-*` 새 결과 문서.
- 성공 기준: platform claim, internal confirmed, NPay actual correction이 분리 표기된다.
- 실패 시 해석/대응: Google Ads API timeout이면 VM local_first route와 로컬 read-only script를 비교한다.
- 의존성: biocom Option C live PASS.
- 승인 필요: NO.

### TJ님이 할 일

1. 더클린커피 site-isolated actual source 확인
- Codex 추천: 조건부 진행
- 추천 이유: Codex가 운영DB read-only와 VM Cloud로 확인한 범위에서는 coffee actual included를 안전하게 켤 수 없다.
- 추천 방향에 대한 자신감: 78%
- Lane: Yellow
- 무엇을 하는가: 개발팀/운영 원장에서 더클린커피 actual order만 분리되는 read-only source가 있는지 확인한다.
- 왜 하는가: 없는 상태로 summary API를 included로 바꾸면 biocom과 coffee 매출이 섞일 수 있다.
- 어떻게 하는가: 개발팀에 `thecleancoffee order_no/payment_status/payment_amount/site`가 분리된 테이블 또는 view가 있는지 문의한다.
- 어디에서 확인하나: 운영DB schema/view 또는 개발팀 답변.
- 성공 기준: site filter가 있는 source에서 coffee NPay PAYMENT_COMPLETE를 주문 단위로 재현 가능.
- 실패 시 해석/대응: 계속 bridge_pending 유지.
- Codex가 대신 못 하는 이유: Codex는 현재 접근 가능한 운영DB/VM read-only 범위에서 site key 부재와 0/337 매칭까지만 확인 가능하다.
- 의존성: 개발팀 source 또는 권한 필요.
- 승인 필요: YES, 외부 팀 확인.
