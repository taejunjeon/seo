# gpt0508-56 Result Report

작성 시각: 2026-05-13 19:15 KST  
작성자: Codex  
Lane: Green approval/design documentation

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - docs/agent-harness/growth-data-harness-v0.md
    - project/sprint1.md
    - project/sprint3.md
  lane: Green documentation, Yellow/Red execution gated
  allowed_actions:
    - approval packet 작성
    - UTM exact rule 설계
    - project sprint 문서 갱신
    - checkpoint 갱신
  forbidden_actions:
    - cron registration before approval
    - TikTok Ads API write
    - TikTok campaign/budget change
    - platform send/upload
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
    - GTM publish
  source_window_freshness_confidence:
    source: "VM Cloud SQLite imweb_orders, VM Cloud summary API, local TikTok API export CSV, GA4 BigQuery latest funnel evidence"
    window: "coffee rolling 30d; TikTok export 2026-05-07~2026-05-12; GA4 through 2026-05-12"
    freshness: "2026-05-13 19:15 KST"
    confidence: 0.86
```

## 사람이 이해하는 작업 설명

더클린커피 매출 warning을 매일 자동으로 보게 하는 승인안을 만들었다. 더클린커피 actual은 이미 화면/API에 붙었지만, VM Cloud SQLite `imweb_orders.imweb_status` sync가 늦어 status blank가 남아 있으므로 하루 한 번 같은 monitor를 돌려야 한다.

TikTok 광고는 캠페인 이름으로만 의미상 매칭되던 상태를 exact id 매칭으로 바꾸는 URL 규칙을 설계했다. `utm_campaign`은 사람이 읽는 이름으로 두고, 실제 TikTok campaign id는 `utm_id`와 `tt_campaign_id`에 남기도록 했다.

둘 다 실행은 하지 않았다. Cron 등록은 VM Cloud crontab 변경이라 Yellow 승인 필요이고, TikTok URL parameter 변경은 광고 운영 설정 변경이라 별도 승인/작업이 필요하다.

## 완료한 것

1. Coffee actual status monitor cron 승인안 작성
   - 문서: `gdn/coffee-status-monitor-cron-approval-20260513.md`
   - JSON: `data/project/coffee-status-monitor-cron-approval-20260513.json`
   - 제안 스케줄: 매일 09:20 KST
   - 실행 순서: precheck → one-shot dry-run → crontab backup → cron 등록 → post-check → rollback 확인
   - rollback: crontab line 제거

2. TikTok campaign_id exact UTM rule 설계
   - 문서: `gdn/tiktok-campaign-id-exact-utm-rule-20260513.md`
   - JSON: `data/project/tiktok-campaign-id-exact-utm-rule-20260513.json`
   - 필수 파라미터: `utm_source=tiktok`, `utm_medium=paid_social`, `utm_campaign=<slug>`, `utm_id=<campaign_id>`, `tt_campaign_id=<campaign_id>`
   - 성공 기준: active spend campaign 7일 exact coverage 95% 이상

3. Sprint 문서 갱신
   - `project/sprint1.md`: cron 승인안을 Approval Needed에 추가
   - `project/sprint3.md`: TikTok exact UTM rule과 승인 조건 추가

## 하지 않은 것

- VM Cloud cron 등록은 하지 않았다.
- TikTok Ads Manager URL parameter는 바꾸지 않았다.
- TikTok 광고 ON/OFF, 예산, 캠페인 설정은 바꾸지 않았다.
- Google Ads/GA4/Meta/TikTok/Naver 전환 전송·upload는 하지 않았다.
- 운영DB write/import, VM Cloud SQLite write/schema migration, GTM publish는 하지 않았다.

## 검증 결과

- JSON parse PASS.
- `validate_wiki_links.py` PASS.
- `harness-preflight-check.py --strict` PASS.
- `git diff --check` PASS.
- raw identifier scan PASS.
- code path 변경 없음. backend/frontend typecheck는 이번 문서·승인안 작업 범위에서 실행 대상이 아니다.

## 현재 영향

운영 서버와 광고 계정에는 영향이 없다. 생성한 것은 승인안, 설계 문서, sprint 문서 갱신뿐이다.

## 남은 리스크

- Coffee cron은 승인 후에도 VM Cloud에 script가 존재하는지 precheck가 필요하다.
- TikTok campaign id URL parameter는 계정/광고 화면에서 지원되는 macro 또는 static URL 방식 확인이 필요하다.
- TikTok exact id가 GA4에 들어와도 GA4 purchase는 실제 결제완료 정본이 아니다. 최종 예산 판단은 내부 confirmed order와 다시 연결해야 한다.

## 확인하면 좋은 문서

1. `gdn/coffee-status-monitor-cron-approval-20260513.md` — cron을 승인하면 정확히 무엇을 실행하는지 확인할 문서.
2. `gdn/tiktok-campaign-id-exact-utm-rule-20260513.md` — TikTok URL parameter를 어떻게 넣을지 확인할 문서.
3. `project/sprint3.md` — TikTok 품질 진단에서 exact join이 왜 다음 병목인지 확인할 문서.

## 다음 할일

### Codex가 할 일

1. TJ님이 coffee cron을 승인하면 precheck부터 실행한다.
   - 성공 기준: one-shot dry-run `ok=true`, cron 1줄 등록, post-check PASS.
   - 실패 시 확인점: script 존재 여부, `tsx`, summary API/SQLite mismatch.
   - 승인 필요 여부: YES, Yellow.
   - 추천 점수/자신감: 86%.

2. TikTok URL parameter 적용 후 24h/72h/7d BigQuery 검증을 실행한다.
   - 성공 기준: active spend campaign exact coverage 95% 이상.
   - 실패 시 확인점: URL parameter template, GA4 event_params 수집, `ttclid` presence.
   - 승인 필요 여부: URL 변경은 TJ님 또는 광고 운영자 작업 필요.
   - 추천 점수/자신감: 80%.

### TJ님이 할 일

1. Coffee cron 등록 승인 여부를 결정한다.
   - 승인 문구는 `gdn/coffee-status-monitor-cron-approval-20260513.md`의 `승인 요청 문구`를 그대로 쓰면 된다.
   - Codex가 대신 못 하는 이유: crontab 실제 등록은 VM Cloud 운영 변경이라 Yellow 승인 전 실행 금지다.
   - 추천 점수/자신감: 86%.

2. TikTok Ads Manager에서 1~3개 active campaign에 URL parameter를 적용할지 결정한다.
   - 바꾸는 화면: TikTok Ads Manager → Campaign → Ad 또는 Ad group → Destination URL / URL Parameters.
   - Codex가 대신 못 하는 이유: 광고 운영 화면 설정 변경은 계정 권한/사업 판단이 필요하다.
   - 추천 점수/자신감: 80%.
