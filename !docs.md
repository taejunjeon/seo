# 정본 문서 인덱스

작성 시각: 2026-05-08 02:10 KST
최종 업데이트: 2026-05-08 02:10 KST
문서 성격: 정본 link 인덱스. 모든 ! 정본의 위치/역할/owner를 한 곳에서 본다.
Owner: docs / index
Do not use for: 정본 본문 자체. 본 인덱스는 link만 모아 놓는다.

## 5줄 결론

이 파일은 모든 ! 정본의 인덱스다. **새 정본을 만들면 여기에 추가**한다. 정본은 영역별 1개 원칙이며, supersede 시 `_old` 접미사로 과거화한다. 본 인덱스는 정본 본문이 아니라 메뉴이며 짧게 유지한다.

## 마스터 정본

| 정본 | 영역 | 줄수 | 최종 update | 역할 |
|---|---|---:|---|---|
| [[total/!total-current]] | 전사 attribution / 채널 매출 | ~370 | 2026-05-08 | 마스터 정본. Phase-Sprint, 다음 할일, Active Action Board, Approval Queue, Completed Ledger, Source/Window/Freshness/Confidence |
| [[total/!total_past]] | legacy phase history | ~1100 | rename됨 | 과거 phase history (참고만) |
| [[data/!datacheckplan]] | Data check plan / ROAS gap / /ads/google 정합성 | ~1250 | 2026-05-04 | 정합성 작업 큰 historical 정본 |
| [[confirm/!confirm]] | 승인 큐 인덱스 | ~70 | 2026-05-08 | TJ 승인 항목 인덱스. 본 agent가 ApprovalQueueAgent로 sync |

## 영역별 정본

### Data / BigQuery / 채널 funnel

| 정본 | 역할 | 최종 update |
|---|---|---|
| [[data/!bigquery_new]] | BigQuery 정본 (hurdlers backfill copy + 신규 GA4 Link 적재 상태) | 2026-05-08 |
| [[data/!bigquery_old]] | legacy BigQuery 메모 | rename됨 |
| [[data/!channelfunnel]] | Channel funnel quality 정본 (Meta vs Google vs Organic vs TikTok funnel + 90% scroll + NPay GA4 fire 누락 확정) | 2026-05-08 |
| [[data/!coffeedata]] | Coffee NPay intent / A-5 / A-6 정본 | 2026-05-08 |
| [[data/!coffeedata_old]] | legacy coffee data | rename됨 |
| [[data/!coffee_excel_backfill_plan]] | Coffee 엑셀 백필 정본 | - |
| [[data/!coffee_subscriber_ops]] | Coffee 정기구독 운영 매뉴얼 | - |
| [[data/!data_inventory]] | data inventory | - |

### Agent / Harness

| 정본 | 역할 | 최종 update |
|---|---|---|
| [[agent/!aiosagentplan]] | AI OS Agent v0 (6 agents) 정본 | 2026-05-08 |
| [[agent/!aiosagent]] | (sub) | - |
| [[agent/!function]] | (sub) | - |
| [[agent/!menu]] | (sub) | - |
| [[agent/!order]] | 외부 작업 order 모음 | - |
| [[harness/!harness]] | Harness 정본 | - |

### GDN / Google Ads ROAS

| 정본 | 역할 | 최종 update |
|---|---|---|
| [[gdn/!gdnplan_new]] | Google Ads ROAS 정합성 정본 (실제 개발 순서) | 2026-05-08 |
| [[gdn/!gdnplan_old]] | legacy Google Ads ROAS roadmap | rename됨 |

### TikTok / Meta / Naver / Coupang / Imweb

| 정본 | 역할 | 최종 update |
|---|---|---|
| [[tiktok/!tiktokroasplan]] | TikTok ROAS 정본 (1763줄, 매우 큰 historical) | - |
| [[capivm/!capiplan]] | Meta CAPI 정본 | 2026-05-08 |
| [[naver/!naverapi]] | Naver API 정본 | - |
| [[naver/!npay]] | NPay 정본 | - |
| [[naver/!npayroas]] | NPay ROAS 정본 | - |
| [[coupang/!coupang]] | Coupang Wing 정본 | - |
| [[imweb/!imwebplan]] | Imweb 정본 | - |
| [[coffee/!imwebcoffee_code_latest_0501]] | Coffee imweb body 코드 정본 | - |

### 운영 / VM / SEO

| 정본 | 역할 | 최종 update |
|---|---|---|
| [[vm/!vm]] | GCE VM 운영 정본 (taejun SSH 경로 등) | 2026-05-07 |
| [[seo/!seoplan]] | SEO 정본 | - |
| [[seo/!frontmenu]] | Frontend 메뉴 정본 | - |

### 기타

| 정본 | 역할 |
|---|---|
| [[aibio/!aibioroadmap]] | AIBIO 로드맵 |
| [[ontology/!ontology]] | ontology 정본 |
| [[caio/!caio]] | CAIO presentation deck |
| [[channeltalk/!channeltalk]] | Channel Talk |
| [[otherpart/!otherpart]] | 외부 협업 (그로스파트 등) |
| [[telegram/!telegram]] | Telegram alert tooling |
| [[patent/!patent]] | patent |

## 본 sprint (2026-05-07~08) 작성된 신규 정본 / 결과

| 문서 | 영역 | 비고 |
|---|---|---|
| [[total/!total-current]] | 전사 정본 update | 2026-05-08 Meta funnel CAPI 행 추가 (TJ) |
| [[gdn/!gdnplan_new]] | Google Ads ROAS 정본 신규 | 2026-05-07 본 agent 작성 |
| [[data/!bigquery_new]] | BigQuery 정본 신규 | 2026-05-08 본 agent 작성 |
| [[data/!channelfunnel]] | Channel funnel quality 정본 신규 | 2026-05-08 본 agent 작성 |
| [[gdn/paid-click-intent-minimal-ledger-canary-execution-packet-20260507]] | canary 실행 패킷 (8필드) | TJ 승인 후 deploy 완료 |
| [[gdn/paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] | canary Phase 0~2 결과 | T+0 PASS |
| [[gdn/paid-click-intent-pm2-restart-correlation-20260508]] | PM2 burst correlation | confirmed_pm2_restart_burst |
| [[gdn/backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507]] | hardening + 1.5G uplift deploy | PASS |
| [[gdn/google-roas-gap-decomposition-20260507]] | Google ROAS gap 1차 분해 | NPay 99.99% 오염 + click id 유실 |
| [[gdn/channel-funnel-quality-meta-google-organic-20260508]] | 7일 channel funnel quality 결과 | 본 channelfunnel 정본의 1차 evidence |
| [[GA4/google-tag-gateway-poc-approval-20260507]] | Google tag gateway POC 승인안 | 활성화 보류 |
| [[GA4/product-engagement-summary-poc-20260508]] | 50% scroll + visible_seconds POC | Phase 0 설계 |
| [[capivm/meta-funnel-capi-readiness-20260508]] | Meta funnel CAPI readiness | TJ가 Test Events code 전달, GTM-first 경로 |
| [[capivm/meta-funnel-capi-gtm-first-plan-20260508]] | Meta GTM-first 실행 계획 | TJ 작성 |
| [[capivm/meta-funnel-capi-test-events-payload-preview-2026-05-08]] | Meta payload preview | TJ 작성 |
| [[frontend/frontend-current-ui-audit-20260508]] | Frontend baseline audit | API JSON 캡처 |
| [[confirm/tj-pending-confirmations-20260507]] | TJ 컨펌 한 장 정리 | 9개 항목 |

## 정본 작성 규칙 (docurule.md v6 요약)

새 정본 추가 시 본 인덱스 + 정본 본문 모두에 적용:

1. 메타 (제목, 시각, 버전, owner, supersedes, do not use)
2. harness_preflight yaml block
3. 10초 결론
4. Phase-Sprint 요약표 (의존성 컬럼 포함)
5. 다음 할일 표 (의존성 / 컨펌 / 산출물)
6. 현재 기준 표
7. 실제 개발 순서 (한국어 풀 설명)
8. Active Action Board (task_state 7종 적용)
9. Approval Queue (open / future_red / parked / closed)
10. Completed Ledger (Active Board 제외 후 이동)
11. Source / Window / Freshness / Confidence 표
12. Phase 상세 anchor sections

`task_state` 7종: `auto_ready` / `time_waiting` / `approval_waiting` / `blocked_access` / `blocked_data` / `parked_red` / `completed`.

## supersede 정책

정본을 신규로 만들 때:
- 기존 정본은 `_old` 접미사로 rename (예: `!gdnplan.md` → `!gdnplan_old.md`)
- 신규는 `_new` 접미사로 시작 (예: `!gdnplan_new.md`)
- 신규가 검증되면 `_new` 떼고 단독 이름으로 (선택)
- `Supersedes:` 메타 필드에 old link 명시

## ApprovalQueueAgent / ReportAuditorAgent 와의 관계

- ApprovalQueueAgent ([[agent/approval-queue-agent-v0-20260507]]) 가 confirm/, gdn/*approval*.md, total/!total-current.md, agent/!aiosagentplan.md 를 scan해서 open/future_red/closed/unknown 분류.
- ReportAuditorAgent ([[agent/report-auditor-agent-v0-20260507]]) 가 정본 6개 (agent/!aiosagentplan, total/!total-current, GA4/gtm, gdn/!gdnplan_new, gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507) 를 audit (validate_wiki_links / harness-preflight / git diff / stale endpoint scan).
- 본 인덱스 변경 시 ReportAuditor audit 대상에 본 파일 추가 검토.

## 한 줄 결론

> 정본은 영역별 1개 원칙. 신규 정본 추가 시 본 인덱스 + supersede 정책 + docurule.md v6 형식 따른다. 본 인덱스는 메뉴, 정본 본문은 별 파일.
