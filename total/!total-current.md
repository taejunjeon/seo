# 월별 유입 채널 매출 정합성 현재 정본

작성 시각: 2026-05-06 23:46 KST
최종 업데이트: 2026-05-07 20:55 KST
기준일: 2026-05-07
상태: active canonical
Owner: total / attribution
Supersedes: [[!total_past|기존 Phase 순서 정본]]
Next document: 24h/72h monitoring result 또는 minimal paid_click_intent ledger write 승인안 / Google tag gateway 활성화 옵션 결정
Do not use for: Google Ads 전환 변경, conversion upload, confirmed purchase dispatcher 운영 전송, 운영 DB/ledger write 승인

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
  lane: Green 문서 정본 업데이트 + Google Ads API read-only 재조회 결과 기록
  allowed_actions:
    - 실제 개발 순서 기준 정본 문서 업데이트
    - Google Ads ROAS 정합성 다음 작업만 실행 보드에 추림
    - Google Ads API read-only dashboard 조회
    - 운영 VM SSH 접근 경로 검증
    - no-write receiver route 운영 배포 결과 기록
    - TEST/negative smoke 결과 기록
    - receiver-enabled GTM publish 결과 기록
    - 24h/72h read-only monitoring
  forbidden_actions:
    - Google Ads 전환 변경
    - conversion upload
    - confirmed purchase dispatcher 운영 전송
    - 운영 DB/ledger write
    - GA4/Meta/Google Ads/TikTok/Naver 전환 전송
  source_window_freshness_confidence:
    source: "기존 total/!total.md, gdn/Mode B 승인 문서, 운영 VM SSH/curl smoke, 로컬 코드, Google Ads API /api/google-ads/dashboard last_30d"
    window: "2026-04-07~2026-05-06 KST Google Ads last_30d, 2026-05-04~2026-05-07 KST 실행 문서"
    freshness: "Google Ads API 2026-05-07 18:12 KST read-only 조회. 내부 원장은 운영 VM attribution_ledger same-window source로 복구했으며 latestWindowLoggedAt 2026-05-06T14:59:06.844Z. Google Ads 전환 변경/전송 없음"
    confidence: 0.90
```

## 10초 결론

이 문서가 현재 정본이다. 기존 [[!total_past]]은 작업 영역별 역사 문서로 남기고, 실제 개발 순서는 이 문서의 `Active Action Board`를 따른다.

현재 P0는 `paid_click_intent Mode B`다. 뜻은 Google 광고 클릭 ID(`gclid/gbraid/wbraid`)가 랜딩에서 저장되고 checkout/NPay intent까지 이어지는지 운영에서 검증하는 묶음이다.

TJ님은 Mode B를 조건부 YES로 승인했다. Codex는 운영 VM 직접 계정(`biocomkr_sns`) SSH 실패를 우회해 `taejun` 계정 경유로 backend no-write receiver route를 배포했고, production TEST/negative smoke를 통과시켰다. 이어서 GTM live version `142`를 publish했고 live smoke도 통과했다. 다음 병목은 24h/72h 모니터링이다.

2026-05-07 18:12 KST Google Ads API read-only 재조회 기준, Google Ads ROAS=광고 플랫폼이 주장하는 값은 last_30d `8.72x`다. 같은 window의 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값은 운영 VM attribution ledger 기준 `0.28x`다. 예산 판단에는 플랫폼 주장값 `8.72x`를 쓰지 않고, 내부 confirmed `0.28x`와 click id 보존률을 같이 본다.

Google Ads `Conv. value` 218,196,428원 중 218,196,382원은 Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호 `구매완료` action `7130249515`의 known NPay count label `r0vuCKvy-8caEJixj5EB`에서 나온다. 따라서 다음 실행 보드는 Meta나 `/total` 화면 작업이 아니라, Google click id 보존과 confirmed purchase no-send 후보를 안정화하는 순서만 우선한다.

## Phase-Sprint 요약표

현재 실행 우선순위순.

Phase 번호는 작업 영역 이름(history)이고 실제 실행 순서는 `Priority`를 따른다.

| Priority | Phase  | Sprint              | 이름                      | 담당                  | 상태(우리/운영) | 상세                      |
| -------- | ------ | ------------------- | ----------------------- | ------------------- | --------- | ----------------------- |
| P0       | Phase4 | [[#Phase4-Sprint6]] | paid_click_intent 수집 개선 | TJ + Codex          | 90% / 70% | [[#Phase4-Sprint6\|이동]] |
| P0/P1    | Phase2 | [[#Phase2-Sprint4]] | 채널 배정과 캠페인 매핑           | Codex               | 70% / 60% | [[#Phase2-Sprint4\|이동]] |
| P1       | Phase1 | [[#Phase1-Sprint1]] | 월별 주문·결제 정본 장부          | Codex               | 86% / 78% | [[#Phase1-Sprint1\|이동]] |
| P1/P2    | Phase3 | [[#Phase3-Sprint5]] | 플랫폼 ROAS 분리와 guard      | Codex               | 65% / 42% | [[#Phase3-Sprint5\|이동]] |
| P3       | Phase5 | [[#Phase5-Sprint8]] | `/total` 운영 화면          | Claude Code + Codex | 35% / 0%  | [[#Phase5-Sprint8\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 의존성 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | [[#Phase4-Sprint6]] | monitoring | Codex | paid_click_intent 24h/72h 모니터링을 정시에 실행한다 | live smoke는 통과했지만 실제 고객 트래픽에서 오류율, receiver 2xx, 결제 흐름 이상 여부를 봐야 한다 | `backend/scripts/paid-click-intent-monitoring-collect.ts`로 health, positive/negative smoke, no-write/no-send guard를 자동 수집한다 | Mode B publish 완료 후 시간창 필요. 24h/72h 시각 도달이 선행필수 | [[#Phase4-Sprint6]] / [[../gdn/paid-click-intent-post-publish-monitoring-result-immediate-20260507]] | NO, read-only |
| 2 | [[#Phase4-Sprint6]] | approval_candidate_after_monitoring | TJ + Codex | minimal paid_click_intent ledger write 승인 여부를 판단한다 | no-write receiver는 payload 안전성 검증일 뿐 주문 원장 fill-rate를 직접 개선하지 않는다 | 24h/72h 모니터링 PASS + **PM2 restart 5분 이상 완화** + **heap baseline 70% 미만** + **errorHandler hardening deploy** + **5xx 비율 1% 미만** 4가지 선행 blocker 해소 후 [[../gdn/paid-click-intent-minimal-ledger-write-approval-20260507]] §"선행 blocker 상세" 참조 | 1번 24h/72h PASS + PM2 안정화가 선행필수 | [[#Phase4-Sprint6]] / [[../gdn/paid-click-intent-pm2-restart-correlation-20260508]] | YES, 운영 ledger write |
| 3 | [[#Phase4-Sprint6]] | blocked_until_click_id_store | Codex | confirmed_purchase no-send 후보를 재실행한다 | 실제 결제완료 주문만 Google Ads 구매 후보로 남기고, missing click id가 줄었는지 봐야 한다 | 저장이 열리거나 충분한 receiver evidence가 쌓인 뒤 `backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts`를 no-send로 재실행한다 | 2번 승인/적용 또는 충분한 receiver evidence가 선행필수 | [[#Phase4-Sprint6]] / [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | NO, no-send |
| 4 | [[#Phase3-Sprint5]] | parked_red | TJ + Codex | Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 전환 통로를 재검토한다 | 기존 `구매완료` Primary 전환은 NPay click/count label이 분자를 거의 전부 만들고 있어 자동입찰 학습 신호로 위험하다 | no-send 후보, duplicate guard, click id fill-rate, rollback 기준이 PASS하면 [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]]를 업데이트하고 Red 승인 여부를 다시 묻는다 | 3번 no-send 재실행 PASS가 선행필수 | [[#Phase3-Sprint5]] / [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]] | YES, Google Ads 변경/전송 |

## 현재 기준

| 항목 | 현재 기준 |
|---|---|
| 정본 문서 | [[!total-current]] |
| 기존 문서 역할 | [[!total_past]]은 old/legacy phase history |
| 현재 P0 | paid_click_intent Mode B |
| Mode B 승인 상태 | 조건부 YES |
| Mode B 실제 실행 상태 | backend receiver route 배포, smoke, GTM publish, live smoke 통과. 24h/72h monitoring 대기 |
| 운영 VM 접근 | 직접 `biocomkr_sns` SSH는 실패. `taejun` 경유 후 `sudo -u biocomkr_sns` 가능 |
| 운영 receiver | `POST /api/attribution/paid-click-intent/no-send` 200 확인 |
| GTM live | `142 (paid_click_intent_v1_receiver_20260506T150218Z)` |
| Meta funnel CAPI 최신 상태 | server endpoint 준비 완료, funnel 운영 송출 0건, Test Events code 수령. 2026-05-08 Green no-send payload preview 생성. 실제 Meta 호출/GTM Preview/Imweb 수정은 하지 않음. [[../capivm/meta-funnel-capi-gtm-first-plan-20260508]] |
| 캠페인 매핑 최신 입력 | `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx` |
| 그로스파트 추가 확인 | 2개 exact campaign id만 필요. [[../otherpart/!otherpart]] |
| TJ 승인 큐 | 현재 open approval 없음. [[../confirm/!confirm]] |
| 외부 전송 상태 | 0건. GA4/Meta/Google Ads/TikTok/Naver 전송 없음 |
| 운영 DB/ledger write | 0건. 금지 유지 |
| Google Ads API read-only | 2026-05-07 18:12 KST last_30d 조회 PASS. 비용 25,016,556원, `Conv. value` 218,196,428원, Google Ads ROAS 8.72x |
| Google Ads Primary 오염 | `구매완료` action `7130249515` NPay count label value 218,196,382원. 플랫폼 `Conv. value`의 사실상 100% |
| 내부 confirmed ROAS 최신 조회 | 운영 VM attribution ledger same-window 복구. Google 증거 payment_success 29건, confirmed 27건, confirmed revenue 7,063,020원, 내부 confirmed ROAS 0.28x |

## 실제 개발 순서

Phase 번호는 과거 작업 영역을 설명하는 이름이다. 실제 개발은 아래 순서로 진행한다.

1. **P0: paid_click_intent Mode B 실행 완료 / monitoring 진행 중**
   - 목적: Google Ads 랜딩에 이미 있는 click id가 checkout/NPay intent/confirmed purchase 후보까지 끊기지 않게 만드는 선행 작업.
   - 현재: backend no-write receiver route 운영 배포, smoke, GTM publish, live smoke가 통과했다. 자동 모니터링 수집 스크립트와 immediate smoke 결과도 준비됐다. 24h/72h 정시 모니터링이 남았다.

2. **P0: Google Ads API read-only 최신값 확인 완료 / 운영 VM source gap 복구**
   - 목적: Google Ads ROAS=광고 플랫폼이 주장하는 값과 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값을 섞지 않는다.
   - 현재: Google Ads API last_30d 조회는 PASS다. 운영 VM attribution ledger same-window 조회도 복구했다. 내부 confirmed ROAS는 0.28x이고, Google Ads 플랫폼 ROAS 8.72x와 8.44p 차이다.

3. **P1: minimal paid_click_intent ledger write 승인 판단**
   - 목적: no-write receiver로 payload 안전성을 확인한 다음, 실제 저장을 최소 범위로 열어 주문 후보와 연결한다.
   - 현재: 승인안 초안과 schema contract를 작성했다. 조건은 Mode B 24h/72h 모니터링 PASS.

4. **P1: confirmed_purchase no-send 재실행**
   - 목적: NPay 실제 결제완료와 홈페이지 결제완료만 purchase 후보로 남기고, NPay click/count/payment start는 제외한다.
   - 현재: Google Ads upload preview 관점의 후보 prep을 만들었다. 운영 결제완료 623건 중 click id 보유는 5건, structurally eligible은 아직 0건이다.
   - 조건: paid_click_intent 저장 또는 충분한 receiver evidence.

5. **P2: Google Ads BI confirmed_purchase 실행안**
   - 목적: Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 구매 신호를 만든다.
   - 조건: Google click id 보존률과 no-send 후보가 충분해진 뒤 별도 Red 승인.

6. **P2: NPay rail post-publish 재분류**
   - 목적: NPay intent 수집 시작 이후 주문을 matched / ambiguous / purchase_without_intent로 나눠 monthly channel assignment에 반영한다.

7. **P3: `/total` 프론트엔드**
   - 목적: 월별 channel revenue, platform_reference, internal_confirmed, unknown/quarantine를 운영자가 볼 수 있게 만든다.
   - 조건: Google Ads/Meta source freshness와 핵심 assignment rule이 안정화된 뒤 Claude Code가 구현.

## Active Action Board

지금 움직여야 하는 것만 둔다. 완료 항목은 [[#Completed Ledger]] 에만 남긴다.

| Priority | Status | Phase/Sprint | 작업 | 왜 하는가 | 다음 액션 | 담당 | 승인 필요 | Source |
|---|---|---|---|---|---|---|---|---|
| P0 | monitoring | Phase4-Sprint6 | paid_click_intent Mode B 24h/72h | Google click id가 주문까지 사라지는 병목을 줄여야 Google Ads confirmed purchase가 가능하다 | 정시 monitoring -> PASS/FAIL -> minimal ledger write 판단 | Codex | NO, read-only monitoring | [[../gdn/paid-click-intent-gtm-production-publish-result-20260506]] |
| P1 | approval_candidate_after_monitoring | Phase4-Sprint6 | minimal paid_click_intent ledger write 판단 | no-write만으로는 주문 원장 fill-rate가 실제로 개선되지 않는다 | 24h/72h receiver validation PASS 후 승인 여부 판단 | TJ + Codex | YES, future 운영 write | [[../gdn/paid-click-intent-minimal-ledger-schema-contract-20260507]] |
| P1 | blocked_until_click_id_store | Phase4-Sprint6 | confirmed_purchase no-send 재실행 | 실제 결제완료 주문만 purchase 후보로 남겨야 Google/GA4/Meta 전송 전 중복과 누락을 볼 수 있다 | click id 저장 근거가 쌓인 뒤 `google-ads-confirmed-purchase-candidate-prep` 재실행 | Codex | NO, no-send | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] |
| P2 | parked_red | Phase3-Sprint5 | Google Ads BI confirmed_purchase | Google Ads가 NPay click/count를 구매로 학습하지 않게 바꿔야 한다 | no-send 후보와 click id 보존률이 충분할 때 Red 승인안 재검토 | TJ + Codex | YES, future Google Ads 변경/전송 | [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]] |

## Approval Queue

현재 open approval: **없음**.

**현재 진행 중**: minimal `paid_click_intent` ledger write canary 1h 진행 중 (TJ 2026-05-07 22:35 KST 승인). Phase 0/1/2 T+0 모두 PASS (table 생성, 5 indexes, row_count 2, dedupe 1, no_platform_send_verified 100%, TEST/PII/oversized 차단 정상). T+15min~T+60min 본 agent 자동 monitoring. 결과: [[../gdn/paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] / 패킷: [[../gdn/paid-click-intent-minimal-ledger-canary-execution-packet-20260507]].

승인 큐 상세: [[../confirm/!confirm]]

## Approval History / Active Approval Scope

### Mode B: receiver route deploy → smoke → GTM publish → monitoring

상태: TJ님 조건부 YES (승인 완료). 승인 범위 안의 실행은 모두 통과. 24h/72h read-only monitoring 만 남음.

승인 범위 (실행 결과):

- `att.ainativeos.net` backend에 `POST /api/attribution/paid-click-intent/no-send` no-write receiver route 배포 → 완료 (2026-05-06)
- TEST POST와 negative smoke 확인 → 완료 (2026-05-06)
- receiver-enabled GTM Production publish → 완료 (2026-05-07 00:02 KST · live version 142)
- live browser smoke → 완료 (2026-05-07 00:03 KST)
- 24h/72h 모니터링 → 진행 중 (read-only, 추가 승인 불필요)

계속 금지 (Approval Scope 밖):

- Google Ads 전환 변경.
- conversion upload.
- confirmed purchase dispatcher 운영 전송.
- 운영 DB/ledger write.
- GA4/Meta/Google Ads/TikTok/Naver 전환 전송.
- 광고 예산/캠페인 변경.

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-06 KST | paid_click_intent Preview/receiver 검증 | 임시 receiver에서 `gclid/gbraid/wbraid` 3종 케이스 통과 |
| 2026-05-06 KST | Google Ads landing-session click id 분석 | 최근 7일 Google Ads 증거 세션 6,879개 중 6,724개 click id 보유. 보존률 97.75% |
| 2026-05-06 KST | production receiver POST smoke | 운영 배포 전 `att.ainativeos.net` POST 404 확인. receiver route 필요성 확정 |
| 2026-05-06 KST | 운영 VM 접근 경로 복구 | 직접 `biocomkr_sns`는 실패하지만 `taejun` 경유 `sudo -u biocomkr_sns`로 repo/PM2 접근 가능 확인 |
| 2026-05-06 KST | backend no-write receiver route 운영 배포 | `seo-backend` 재시작. `POST /api/attribution/paid-click-intent/no-send` 200 확인 |
| 2026-05-06 KST | production TEST/negative smoke | TEST click id 200, click id 없음/value/order/PII/internal/oversized 차단 확인 |
| 2026-05-07 00:02 KST | GTM receiver-enabled publish | live version `142`, tag `[279]`, trigger `[278]` publish 완료 |
| 2026-05-07 00:03 KST | biocom live browser smoke | TEST gclid storage 저장, receiver 200, `would_store=false`, `would_send=false` 확인 |
| 2026-05-06 KST | 그로스파트 Meta 매핑 엑셀 반영 | 확정 1건, 분리 필요 7건, 제외 1건을 seed와 문서에 반영 |
| 2026-05-07 00:42 KST | Meta split_required 주문별 분리 규칙 작성 | ID/date/window 증거가 있는 주문만 campaign에 붙이고 alias-only는 quarantine하는 설계 작성 |
| 2026-05-07 00:42 KST | minimal paid_click_intent ledger write 승인안 초안 작성 | 저장 필드, 금지 필드, 보관기간, 승인 문구 초안 작성. 실제 write는 24h/72h 이후 |
| 2026-05-07 00:42 KST | 24h/72h 모니터링 결과 템플릿 작성 | 결과 문서 파일명, smoke 명령, rollback 기준, 판단 문구를 사전 작성 |
| 2026-05-07 00:42 KST | 운영 VM SSH 런북 보강 | 배포 전 안전 체크, 배포 후 smoke, rollback 기준을 추가 |
| 2026-05-07 00:48 KST | paid_click_intent 즉시 sanity smoke | `/health` 정상, receiver 200, `would_store=false`, `would_send=false`, `live_candidate_after_approval=false` 확인 |
| 2026-05-07 01:23 KST | paid_click_intent monitoring 수집기 작성/실행 | `backend/scripts/paid-click-intent-monitoring-collect.ts` 생성. health + 7개 positive/negative smoke 통과 |
| 2026-05-07 01:20 KST | Meta split_required dry-run 작성/실행 | 10개 수동 row 중 mapped 1, split/order-level 필요 6, precision loss 재확인 2, 제외 1 |
| 2026-05-07 01:20 KST | Google Ads confirmed_purchase 후보 prep 작성/실행 | 운영 결제완료 623건을 upload preview로 변환. click id 보유 5건, 실제 send_candidate 0 유지 |
| 2026-05-07 01:25 KST | minimal paid_click_intent ledger schema contract 작성 | 테이블 초안, 저장/금지 필드, dedupe, retention, rollback 기준 작성 |
| 2026-05-07 01:52 KST | `/total` 운영 화면 설계 초안 작성 | 내부 confirmed와 platform_reference를 분리하는 카드 구조, API 응답 초안, Claude Code 구현 기준 작성 |
| 2026-05-07 01:52 KST | 외부파트 확인 요청 정리 | 그로스파트 추가 확인은 Excel precision loss 가능성 있는 campaign id 2개로 축약 |
| 2026-05-07 01:52 KST | 승인 큐 정리 | 현재 open approval 없음. 다음 후보는 24h/72h monitoring PASS 후 minimal ledger write |
| 2026-05-07 17:41 KST | Google Ads API last_30d read-only 재조회 | 비용 25,016,556원, `Conv. value` 218,196,428원, Google Ads ROAS 8.72x. `구매완료` NPay label value 218,196,382원으로 플랫폼 분자의 사실상 100%. 내부 ROAS는 local fallback 0.08x, latestLoggedAt 2026-04-12라 예산 판단 primary 금지 |
| 2026-05-07 18:12 KST | Google Ads API x 운영 VM 원장 same-window 재대조 | 로컬 API VM source 복구. 운영 VM attribution ledger 기준 Google 증거 payment_success 29건, confirmed 27건, confirmed revenue 7,063,020원, 내부 confirmed ROAS 0.28x. Google Ads 플랫폼 ROAS 8.72x와 8.44p 차이 |
| 2026-05-07 18:33 KST | Google Ads ROAS 운영 VM 원장 조회 복구 backend 배포 | `backend/src/routes/googleAds.ts` 1파일만 운영 VM에 반영, PM2 재시작, /health 200. dashboard 500은 VM Google Ads developer token 미설정으로 분리됨 |
| 2026-05-07 20:13 KST | ReportAuditorAgent v0 + ConfirmedPurchasePrepAgent v0 runner 연결/실행 | Phase5/Phase6 100%/100% 완료. 6개 agent 모두 Green Lane 자동 실행 가능 |
| 2026-05-07 20:36 KST | ApprovalQueue parser stale approval cleanup | open 1·unknown 2 false positive 모두 closed로 재분류. 현재 closed 6, future 5, open 0, unknown 0 |
| 2026-05-07 20:36 KST | ReportAuditor drift filter 보강 | yaml 리스트/Red Lane 분류표/access log 통계 false positive 6건 모두 제거. status pass |
| 2026-05-07 20:45 KST | Google tag gateway POC 조사/승인안 작성 | biocom·coffee 모두 AWS CloudFront(Imweb 자사몰) 위. Cloudflare wizard 즉시 적용 불가. 활성화 옵션 A(Cloudflare 도입)/B(Imweb native)/C(자체 custom) 분리. 활성화 자체는 별도 Yellow 승인 필요 |
| 2026-05-07 21:19~21:20 KST | paid_click_intent receiver 502 transient 실증 30 calls | `missing_google_click_id` 5회 중 3회 502 (3초 burst, 직전·직후 정상). PM2 max_memory_restart timing 가설 강화. `reject_oversized_body` 5/5 500은 본 evidence 120KB 페이로드 부작용 (운영 monitoring 20KB는 여전히 413 정상). 운영 receiver persistent regression 없음. minimal ledger write 승인 판단 전 SSH 권한 받아 PM2 restart 빈도 매칭 분석 필요. evidence: [[../gdn/paid-click-intent-502-transient-evidence-20260507]] |
| 2026-05-07 21:33~21:46 KST | 운영 VM SSH read-only 직접 조사 + bounded probe 110 calls | 본 agent가 `taejun@34.64.104.94` 경유 SSH로 PM2/log 직접 조회. seo-backend restart 누적 3,930회, 최근 30분 30~31초 정확 주기, heap 94.7% at 12s uptime. bounded probe 5건 502 (4.5%) 모두 PM2 restart 시각과 1~2초 매칭. **confirmed_pm2_restart_burst** 판정. 일평균 ~65분/일 5xx 위험. minimal ledger write 진입 4가지 선행 blocker 추가됨. correlation: [[../gdn/paid-click-intent-pm2-restart-correlation-20260508]] / probe: [[../gdn/paid-click-intent-bounded-probe-result-20260507]] |
| 2026-05-07 21:42 KST | backend errorHandler payload hardening 로컬 patch 작성 | `body-parser PayloadTooLargeError`(100KB 초과)가 errorHandler에서 generic 500으로 응답되던 별건 bug 발견. `isBodyParserError` 가드 추가로 status code 그대로 응답(413/400). typecheck PASS. 운영 deploy 별도 승인안: [[../gdn/backend-errorhandler-payload-hardening-approval-20260508]] |
| 2026-05-07 22:01 KST | backend errorHandler hardening + PM2 max_memory_restart 1.5G 운영 deploy | TJ "YES: PM2 1.5G + errorHandler hardening 둘 다 deploy" 승인 후 본 agent SSH 직접 실행. 백업 → scp → restart with --max-memory-restart 1500M → smoke. 결과: oversized 120KB → 413 (이전 500), PM2 restart count 3820 → 3820 (5분 동안 0회 추가, 이전 30초 주기 50회/30분에서 즉시 정지). 결과: [[../gdn/backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507]] |
| 2026-05-07 22:25 KST | minimal `paid_click_intent` ledger write 4 선행 blocker 모두 PASS 확정 | T+23min evidence: PM2 restart 22분 0회, mem 210.6 MB (13% of 1.5G), controlled probe 114 calls 5xx 0건 (이전 4.5%), backend/cloudflared error log 24분 0 라인. **4 blocker(PM2 restart 완화, errorHandler hardening, heap baseline, 5xx 비율 < 1%) 모두 PASS**. 승인안 [[../gdn/paid-click-intent-minimal-ledger-write-approval-20260507]] 진입 가능 status |
| 2026-05-07 22:35~23:05 KST | minimal `paid_click_intent` ledger write canary 실행 패킷 작성 + TJ 승인 + Phase 0/1/2 T+0 deploy/smoke 완료 | TJ "YES" 회신 후 본 agent SSH 자율 실행. backend/src/paidClickIntentLog.ts 신규 작성 + attribution.ts route flag 분기 + bootstrap. 운영 backup → scp → flag false 배포 → schema bootstrap (table + 5 indexes 생성) → flag-off smoke PASS → flag true 재배포 → 7 smoke PASS (TEST 차단, live insert 2건, dedupe 1건, PII reject, oversized 413, no_platform_send 100%). 1h canary 진행 중. 결과: [[../gdn/paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] |
| 2026-05-07 23:23~2026-05-08 00:01 KST | canary 1h 종합 판정 PASS | T+22/30/60min monitoring. row 17→34→52 (자연 traffic 145건/h 페이스 유지), dedupe 1, by_stage landing 34/npay 11/checkout 7. paid-click-intent 5xx 0건, backend error 0, PM2 0 추가 restart. mem 197→222→1024 MB (T+30~60min 800MB spike — background job 가속 추정, 1.5G threshold 67%). 24h 자동 연장 진행. **mem 추세 6h 시점 재측정 필요** |
| 2026-05-08 00:00 KST | data/!bigquery.md → _old rename + _new 정본 작성 | docurule.md v6 형식. 직접 검증 결과: biocom hurdlers-naver-pay.analytics_304759974 events_20260506 70,294 rows 정상 적재, coffee 정상, AIBIO 미연결. SA `seo-656@seo-aeo-487113`로 dataset Read OK + project-dadba7dd jobs.create OK. 운영 backend dist는 옛 sourceFreshness (jobProjectId 분리 미적용) → biocom freshness fail. 최신 dist deploy로 즉시 정상화 가능. 결과: [[../data/!bigquery_new]] |
| 2026-05-08 01:05 KST | Meta funnel CAPI GTM-first no-send preview | readiness 문서 확인. Test Events code는 원문 저장 없이 `TEST*****`로만 마스킹. ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo/Lead/Search 6종 payload preview 생성. GTM live v142, Default Workspace change 0/conflict 0 read-only 확인. 실제 Meta 호출, GTM Preview/Publish, Imweb header/footer 수정, 운영 CAPI 전송 0건. 결과: [[../capivm/meta-funnel-capi-gtm-first-plan-20260508]] |

## Parked / Later

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| Google Ads conversion action 변경 | 자동입찰 학습과 Google Ads 숫자를 바꾸는 Red Lane | BI confirmed_purchase 후보와 click id 보존률이 충분해지고 별도 승인 |
| conversion upload | Google Ads 전환값이 바뀌는 Red Lane | no-send 후보, 중복 guard, click id fill-rate, rollback 문서 PASS |
| GA4/Meta/Google Ads 실제 purchase 전송 | 플랫폼 전환값을 바꾸는 Red Lane | platform별 payload 승인안과 Events/BigQuery 중복 guard PASS |
| Meta funnel CAPI Test Events smoke / GTM Preview wiring | Test Events code가 있어도 실제 Meta 호출과 GTM workspace 수정은 Yellow Lane. 지금 요청 범위는 Green | TJ님이 `test_event_code 필수`, `Production publish 금지`, `6종 각 1회 이하`, `cleanup 조건`을 포함해 Yellow 승인 |
| 운영 DB/ledger write | 데이터 원장을 바꾸는 Red Lane | minimal ledger write 승인안에서 저장 필드, 보관기간, 삭제/마스킹 기준 승인 |
| `/total` UI 고도화 | 현재는 source/assignment가 더 큰 병목 | Mode B와 최소 저장 설계 후 화면 수치 의미가 안정화될 때 |

## Meta 캠페인 매핑 최신 결론

Source: `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx`
확인 시각: 2026-05-04 16:10 KST
반영 시각: 2026-05-06 22:45 KST
Freshness: 그로스파트 수동 확인 최신. 일부 campaign id는 현재 stale audit에 없으므로 `audit missing`으로 표시.
Confidence: 0.86

결론:

- `meta_biocom_kkunoping02_igg`는 campaign `120242626179290396`으로 확정했다.
- `inpork_biocom_igg`는 Meta campaign ROAS에 붙이지 않는다. NPay와 마찬가지로 결제/유입 성격을 섞으면 안 된다.
- `meta_biocom_sosohantoon01_igg`, `meta_biocom_skintts1_igg`, `meta_biocom_proteinstory_igg`, `meta_biocom_iggspring`, `meta_biocom_iggacidset_2026`, `meta_biocom_mingzzinginstatoon_igg`, `meta_biocom_iggpost_igg`는 단일 campaign 자동 확정이 아니라 `split_required`다.
- `split_required`는 캠페인 ROAS에 억지로 붙이지 않는다. 다음 단계에서 주문별 adset/ad id/date/URL Parameters로 나눠야 한다.
- Excel precision loss 가능성이 있는 2건은 [[../otherpart/!otherpart]]에 그로스파트 확인 요청으로 분리했다.

상세: [[../meta/campaign-mapping-growth-confirmation-20260506]]

## Source / Window / Freshness / Confidence

| 영역 | Source | Window | Freshness | Confidence |
|---|---|---|---|---:|
| Mode B backend 실행 | [[../gdn/paid-click-intent-production-receiver-deploy-result-20260506]] | 2026-05-06 KST | 운영 backend 배포와 smoke 최신 | 0.93 |
| Mode B GTM publish | [[../gdn/paid-click-intent-gtm-production-publish-result-20260506]] | 2026-05-07 00:02 KST | live version 142 최신 | 0.92 |
| Mode B immediate monitoring | [[../gdn/paid-click-intent-post-publish-monitoring-result-immediate-20260507]] | 2026-05-07 01:23 KST | health + positive/negative smoke 통과 | 0.89 |
| SSH 접근 경로 | [[../capivm/vm-ssh-access-recovery-runbook-20260506]] | 2026-05-06 KST | `taejun` 경유 접근 확인. 직접 `biocomkr_sns`는 미복구 | 0.92 |
| Google click id 병목 | [[../gdn/google-ads-landing-clickid-analysis-20260506]] | 최근 7일 | BigQuery read-only 기준 최신 | 0.86 |
| Meta campaign mapping | [[../meta/campaign-mapping-split-required-dry-run-20260507]] | 2026-05-07 KST | 최신 수동 엑셀 기반 dry-run. 일부 ID precision loss 재확인 필요 | 0.84 |
| Google Ads candidate prep | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | 2026-05-07 KST | 기존 operational dry-run 기반 no-send prep | 0.82 |
| Google Ads API x VM 원장 read-only 재대조 | local `GET /api/google-ads/dashboard?date_preset=last_30d` + TJ 관리 Attribution VM `crm.sqlite3#attribution_ledger` | 2026-04-07~2026-05-06 KST | 2026-05-07 18:12 KST 조회 성공. Google Ads API fresh, 내부 원장은 운영 VM same-window source. latestWindowLoggedAt 2026-05-06T14:59:06.844Z | 0.90 |
| AI OS Agent v0 6종 | [[../agent/!aiosagentplan]] + `backend/scripts/aios-agent-runner.ts` | 2026-05-07 KST | PaidClickIntentMonitor / CoffeeData / CampaignMapping / ApprovalQueue / ReportAuditor / ConfirmedPurchasePrep 모두 v0 구현·실행 완료 | 0.88 |
| Google tag gateway POC | [[../GA4/google-tag-gateway-poc-approval-20260507]] | 2026-05-07 KST | 공식 문서 fetch + biocom/coffee CDN read-only 조사. 활성화는 Yellow 승인 후 | 0.85 |
| Meta funnel CAPI GTM-first preview | [[../capivm/meta-funnel-capi-gtm-first-plan-20260508]] + [[../capivm/meta-funnel-capi-test-events-payload-preview-2026-05-08]] | 2026-05-08 KST | Test Events code 수령 확인. 원문은 저장하지 않고 마스킹. no-send payload preview 6종 생성. GTM live v142 / Default Workspace change 0 / conflict 0 read-only 확인. 실제 Meta 호출·GTM Preview·Imweb 수정 없음 | 0.89 |
| 기존 Phase history | [[!total_past]] | 2026-05-04~2026-05-06 누적 | legacy. 실제 실행 순서는 이 문서가 우선 | 0.80 |

#### Phase4-Sprint6

**이름**: paid_click_intent 수집 개선

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Google 광고 클릭 ID가 랜딩에서 사라지지 않고 checkout/NPay intent/confirmed purchase 후보까지 이어지게 만드는 것이다. Google Ads confirmed purchase를 만들려면 먼저 `gclid/gbraid/wbraid`가 주문 후보에 남아야 한다.

완료한 것:

- Google Ads 랜딩 세션에는 click id가 대부분 남아 있음을 BigQuery로 확인했다. 최근 7일 기준 6,879개 중 6,724개, 97.75%다.
- 운영 결제완료 주문 기준 click id가 5/623건 수준으로 낮아지는 병목을 분리했다.
- `att.ainativeos.net` backend에 no-write receiver route를 배포했다.
- TEST/negative smoke를 통과했다.
- GTM live version `142`를 publish했다.
- biocom live browser smoke를 통과했다.
- 2026-05-07 18:12 KST Google Ads API x 운영 VM 원장 same-window 재대조에서 플랫폼 ROAS 8.72x, 내부 confirmed ROAS 0.28x, Primary NPay label 분자 사실상 100%를 다시 확인했다.

남은 것:

- publish 후 24h/72h 모니터링.
- 결과가 안정적이면 [[../gdn/paid-click-intent-minimal-ledger-write-approval-20260507]] 기준으로 minimal paid_click_intent ledger write 승인 여부 판단.

금지선:

- Google Ads 전환 변경과 conversion upload 금지.
- GA4/Meta/Google Ads/TikTok/Naver 전송 금지.
- 운영 DB/ledger write 금지.

#### Phase2-Sprint4

**이름**: 채널 배정과 캠페인 매핑

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 내부 confirmed 매출을 Meta, Google, TikTok, Naver, Organic, Direct, Unknown으로 한 번만 배정하는 것이다. 결제수단과 유입 채널을 섞지 않는 것이 핵심이다.

완료한 것:

- 그로스파트 Meta 캠페인 매핑 엑셀을 반영했다.
- 확정 alias, split_required alias, exclude alias를 분리했다.
- NPay는 결제수단이지 `paid_naver` 증거가 아니라는 원칙을 유지했다.

남은 것:

- split_required alias를 최신 주문별 adset/ad id/date/URL Parameters export로 재실행.
- Excel precision loss 후보 2건은 그로스파트 exact campaign id 회신 후 재판정.
- NPay post-publish 주문을 matched / ambiguous / purchase_without_intent로 재분류.

#### Phase1-Sprint1

**이름**: 월별 주문·결제 정본 장부

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 광고 플랫폼 값이 아니라 아임웹 주문, 토스 결제, NPay 실제 결제완료, 취소/환불 보정으로 월별 내부 확정 순매출을 만드는 것이다.

완료한 것:

- 월별 spine dry-run 계약과 join key matrix를 만들었다.
- 2026년 4월 biocom 1차 net 후보를 계산했다.
- 운영 source와 로컬 stale source를 분리했다.

남은 것:

- source freshness가 warn일 때 화면과 보고서에 provisional 표시.
- Phase2 assignment 결과와 합계 검증.

#### Phase3-Sprint5

**이름**: 플랫폼 ROAS 분리와 guard

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Google Ads, Meta, GA4가 주장하는 플랫폼 전환값과 내부 confirmed 매출을 섞지 않는 것이다.

완료한 것:

- Google Ads `구매완료` primary가 NPay count/click 계열 value를 크게 만들고 있음을 분리했다.
- Meta 캠페인 mapping에서 강제 배정 위험을 줄였다.
- ontology-lite로 `PlatformConversionClaim != InternalConfirmedRevenue` 원칙을 고정했다.

남은 것:

- Google Ads BI confirmed_purchase 실행안은 click id 보존률 개선 후 재검토.
- 플랫폼 전송 전 no-send guard와 중복 방지 결과를 다시 확인.
- 운영 VM attribution ledger source gap은 해소했다. 남은 병목은 click id 저장률을 올려 confirmed_purchase no-send 후보를 충분히 만드는 것이다.

#### Phase5-Sprint8

**이름**: `/total` 운영 화면

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 운영자가 월별 전체 매출, 채널별 내부 confirmed ROAS, 플랫폼 참고 ROAS, unknown/quarantine를 한 화면에서 보는 것이다.

현재는 design_ready다. 이유는 구현 전 화면에 들어갈 숫자 의미와 금지 문구를 먼저 고정했기 때문이다.

설계 문서: [[total-frontend-current-design-20260507]]

재개 조건:

- Mode B 24h/72h 모니터링 결과.
- minimal paid_click_intent ledger write 여부 결정.
- Phase2 channel assignment rule 안정화.
