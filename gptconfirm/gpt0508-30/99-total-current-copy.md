# 월별 유입 채널 매출 정합성 현재 정본

작성 시각: 2026-05-06 23:46 KST
최종 업데이트: 2026-05-10 19:34 KST
기준일: 2026-05-10
상태: active canonical
Owner: total / attribution
Supersedes: [[!total_past|기존 Phase 순서 정본]]
Next document: [[../gdn/google-ads-dashboard-route-502-diagnosis-20260510]] Google Ads dashboard 502 진단 / [[../gdn/google-ads-dashboard-route-local-fix-approval-20260510]] VM dashboard local_first 승인안 / [[../gdn/confirmed-purchase-builder-repeatable-input-20260510]] ConfirmedPurchasePrep 반복 input / [[../gdn/bigquery-coverage-source-followup-20260510]] BigQuery coverage 후속 / [[../gdn/frontend-dashboard-data-contract-20260510]] frontend F0 data contract
Do not use for: Google Ads 전환 변경, conversion upload, confirmed purchase dispatcher 운영 전송, 운영DB/ledger write 승인

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
    - VM Cloud SSH 접근 경로 검증
    - no-write receiver route 운영 배포 결과 기록
    - TEST/negative smoke 결과 기록
    - receiver-enabled GTM publish 결과 기록
    - 24h/72h read-only monitoring
  forbidden_actions:
    - Google Ads 전환 변경
    - conversion upload
    - confirmed purchase dispatcher 운영 전송
    - 승인 범위 밖 운영DB/ledger write
    - GA4/Meta/Google Ads/TikTok/Naver 전환 전송
  source_window_freshness_confidence:
    source: "기존 total/!total.md, gdn/Mode B 승인 문서, VM Cloud SSH/curl smoke, VM Cloud SQLite/PM2 read-only, 로컬 코드, Google Ads API /api/google-ads/dashboard last_30d"
    window: "2026-04-07~2026-05-06 KST Google Ads last_30d, 2026-05-04~2026-05-08 KST 실행 문서, paid_click_intent canary 2026-05-07 23:01~2026-05-08 17:23 KST"
    freshness: "Google Ads API 2026-05-07 18:12 KST read-only 조회. paid_click_intent ledger/운영DB(PostgreSQL) read-only 2026-05-08 17:23 KST. wrapper Preview 실행 결과 2026-05-08 19:04 KST + TJ 로그인 NPay 클릭 200/201/203 변수 확인 2026-05-08 19:33 KST + member_code source discovery 2026-05-08 20:06 KST + fallback bridge inventory/design 2026-05-08 20:17 KST + Path B email/phone hash-only approval/schema/Preview/canary/dependency map 2026-05-08 20:38 KST + no-send HMAC local implementation/fixture PASS 2026-05-08 23:03 KST + limited deploy/Preview final/reliability dry-run packet 2026-05-08 23:23 KST + 실제 Google 광고 클릭 기반 Path B no-send bridge PASS 2026-05-10 01:31 KST + unpaid vbank exclusion guard 2026-05-10 01:51 KST + VM Cloud biocom/thecleancoffee status sync 2026-05-10 15:12 KST + 운영DB PAYMENT_COMPLETE dry-run 2026-05-10 15:14 KST + Google Ads last_7d/last_30d read-only refresh 및 campaign_id join 2026-05-10 18:45 KST + Google Ads dashboard 502 진단/local_first 로컬 smoke 및 frontend F0 contract 2026-05-10 19:34 KST 반영. Google Ads 전환 변경/전송 없음"
    confidence: 0.95
```

## 10초 결론

이 문서가 현재 정본이다. 기존 [[!total_past]]은 작업 영역별 역사 문서로 남기고, 실제 개발 순서는 이 문서의 `Phase-Sprint 요약표`와 `다음 할일`을 따른다. `Active Action Board`는 `다음 할일`과 역할이 겹쳐 별도 섹션으로 쓰지 않는다.

2026-05-10 01:31 KST 실제 Google 광고 클릭에서 바이오컴 주문완료 화면까지 Path B no-send bridge는 PASS했다. 주문 hash, 로그인 email identity hash, client/session, click hash가 모두 잡혔다. 하지만 이번 주문은 가상계좌 미입금이므로 **실제 결제완료 구매가 아니다**. 따라서 Google Ads upload, confirmed_purchase, 내부 confirmed ROAS 후보로 쓰지 않는다. `block_reason=unpaid_vbank_controlled_evidence`, `exclude_from_upload=true`, `exclude_from_budget_roas=true`, `send_candidate=false`, `actual_send_candidate=false`를 다음 P0 guard로 고정한다. 다음 문서: [[../gdn/unpaid-vbank-controlled-evidence-exclusion-20260510]], [[../gdn/path-b-p0-next-roadmap-20260510]].

2026-05-10 15:12 KST 기준 VM Cloud status sync는 biocom/thecleancoffee 모두 1회 완료했다. biocom은 status_filled 7,755건, thecleancoffee는 2,093건이다. full order sync도 재시도했지만 current Imweb API total 기준으로는 `synced < totalCount`라서 **현재 API 목록 전체 100% 재수집 완료로 단정하지 않는다**. historical status backfill은 이번처럼 1회 작업이 맞지만, 새 주문과 상태 변화는 계속 생기므로 이후에는 15분 주문 sync 유지 + 별도 status sync background job 검토가 필요하다. 5분 변경은 지금 비추천이다.

2026-05-10 15:14 KST 운영DB `PAYMENT_COMPLETE` 기반 no-send dry-run은 결제완료 주문 4건(homepage 3 / NPay 1), 결제금액 862,000원, send_candidate 0건으로 PASS했다. 같은 시각 VM Cloud-only ConfirmedPurchasePrep 재계산은 homepage 35건, NPay actual 0건이다. 이는 VM Cloud `imweb_orders`에 primary payment status column이 없기 때문이며 NPay 실제 결제완료가 없다는 뜻이 아니다. NPay actual confirmed는 운영DB `PAYMENT_COMPLETE` 또는 관리자 confirmed source를 primary로 본다.

2026-05-10 18:45 KST Google Ads read-only 재조회와 campaign_id 조인 후보표를 추가했다. VM Google Ads status endpoint는 200으로 계정 조회가 되지만 dashboard `last_7d/last_30d` route는 502라서 이번 산출은 로컬 read-only Google Ads API script로 대체했다. Google Ads 플랫폼 ROAS=광고 플랫폼이 주장하는 값은 last_7d `11.70x`, last_30d `9.58x`다. 하지만 플랫폼 Conv. value의 거의 전부가 Primary NPay label에 묶여 있어 예산 판단값으로 쓰지 않는다. 내부 confirmed 2,152건 중 Google click id 보유 31건은 Google Ads `click_view`로 campaign_id까지 결정 조인됐고, 매칭 매출은 7,611,210원이다. 이 값은 캠페인별 internal ROAS의 하한 참고값이며, 전체 예산 판단은 campaign_id coverage 확장 전까지 HOLD다. BigQuery funnel 7/14/30d가 동일했던 원인은 현재 GA4 export daily suffix가 20260507~20260509 3일치뿐인 source coverage 문제다.

2026-05-10 19:34 KST Google Ads dashboard 502 원인을 Green으로 분리했다. VM Cloud `/api/google-ads/status`는 200이고 `last_7d` dashboard는 26.23초 200으로 회복됐지만, `last_30d`는 39.47초 후 502로 끊겼다. 로컬에서 새 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first` 모드로 실행하면 `last_7d`와 `last_30d`가 모두 약 1.2초 200이다. 따라서 원인은 Google Ads 인증이 아니라 dashboard route가 VM 공개 HTTPS 원장 endpoint를 재호출하면서 프록시 timeout 경계까지 느려지는 문제로 본다. VM backend deploy/restart는 아직 HOLD이고, 다음 승인 후보는 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first` limited deploy + PM2 restart 1회다. 프론트엔드는 아직 구현하지 않고 [[../gdn/frontend-dashboard-data-contract-20260510]]의 F0 data contract만 고정했다.

## 현재 작업 OKR / 액션플랜 / 완성도

목표는 Google/NPay ROAS 과대계상 문제를 내부 confirmed purchase 기준으로 바로잡고, 실제 구매만 Google Ads/ROAS 판단 후보가 되도록 만드는 것이다.

현재 전체 완성도는 약 **74%**다. Path B 주문완료 bridge와 NPay status guard는 많이 닫혔고, Google click id 보유 confirmed 주문 31건은 campaign_id까지 조인됐다. dashboard route 502 원인도 `local_first` fix로 좁혔다. 다만 전체 confirmed 2,152건 중 campaign_id coverage가 낮고, Google Ads upload 전 no-send 후보 검증과 Red 승인 패킷은 아직 남아 있다.

### Track A~F 현재 진척률

- Track A. ConfirmedPurchasePrep 통합 input: **89%**. 직전 gpt0508-29 86%에서 +3%.
- Track B. Google Ads campaign_id 조인/ROAS 분해: **68%**. 직전 62%에서 +6%.
- Track C. BigQuery campaign funnel quality: **66%**. 직전 63%에서 +3%.
- Track D/KR6. Meta funnel CAPI Test Events readiness: **70%**. 직전 68%에서 +2%.
- Track E. Harness/multi-agent/HOLD Reducer: **87%**. 직전 86%에서 +1%.
- Track F. Frontend/Data Trust Dashboard: **42%**. 직전 35%에서 +7%.

### KR1. Path B 주문완료 bridge를 실제 후보 원장으로 연결한다

완성도: **88%**

- 액션플랜 1: Path B 변경 whitelist commit. VM Cloud에 반영된 코드와 repo source 추적성을 맞춘다. 기여: 88% -> 90%.
- 액션플랜 2: Path B evidence를 ConfirmedPurchasePrep input에 연결. bridge row가 confirmed purchase no-send 후보 계산에 들어오게 한다. 기여: 90% -> 94%.
- 액션플랜 3: Path B reliability v2 dry-run 고도화. full_bridge, identity_only_quarantine, ambiguous, do_not_send를 분리한다. 기여: 94% -> 100%.

### KR2. NPay 실제 결제완료 주문을 누락 없이 confirmed 후보로 분리한다

완성도: **76%**

- 액션플랜 1: NPay status guard 기준 확정. `PAYMENT_COMPLETE`/admin confirmed를 primary 기준으로 고정한다. 기여: 76% -> 80%.
- 액션플랜 2: 운영DB `PAYMENT_COMPLETE` 기반 dry-run 연결. 실제 NPay 결제완료 주문이 후보로 들어오고 click-only는 차단되는지 본다. 기여: 80% -> 90%.
- 액션플랜 3: `channel_order_no`와 내부 `order_number` 매핑. NPay 외부 도메인 주문번호와 내부 주문번호를 이어준다. 기여: 90% -> 100%.

### KR3. Google Ads ROAS 판단을 platform claim에서 internal confirmed 기준으로 전환한다

완성도: **42%**

- 액션플랜 1: ConfirmedPurchasePrep no-send 후보 재계산. Path B + NPay actual confirmed + 운영DB `PAYMENT_COMPLETE` 기준으로 후보를 다시 계산한다. 기여: 42% -> 58%.
- 액션플랜 2: controlled/test/unpaid order exclusion guard 적용. 미입금 가상계좌, controlled NPay evidence, test order를 upload/ROAS 후보에서 제외한다. 기여: 58% -> 68%.
- 액션플랜 3: Google Ads confirmed_purchase Red 승인안 작성. conversion action, dedupe, rollback, 7일 병행관찰 계획을 만든다. 기여: 68% -> 80%.

### KR4. NPay click/count 오염과 실제 purchase를 분리한다

완성도: **72%**

- 액션플랜 1: `TechSol - [GAds]NPAY구매 51163` Google Ads 전환 액션 audit. Google Ads 쪽 click conversion이 ROAS를 부풀리는지 확인한다. 기여: 72% -> 82%.
- 액션플랜 2: NPay click vs actual purchase 문서 정본화. 이름에 “구매”가 들어간 태그와 실제 결제완료 주문을 명확히 분리한다. 기여: 82% -> 90%.
- 액션플랜 3: NPay actual order matching rail 구축. `npay_intent_log + channel_order_no + PAYMENT_COMPLETE` 기준 actual order matching dry-run을 만든다. 기여: 90% -> 100%.

### KR5. 하네스/에이전트가 HOLD 원인을 자동으로 줄이게 한다

완성도: **65%**

- 액션플랜 1: HOLD Reducer / GTM lifecycle actual patch. HOLD가 나오면 승인 대기로 멈추지 않고 Green follow-up을 자동 수행하게 한다. 기여: 65% -> 85%.
- 액션플랜 2: ReportAuditorAgent 검사 규칙 추가. HOLD인데 `auto_green_followups`가 없으면 WARN/FAIL 처리한다. 기여: 85% -> 95%.
- 액션플랜 3: GTM workspace lifecycle rule 적용. workspace capacity preflight, fresh workspace, cleanup, write flag 순서를 강제한다. 기여: 95% -> 100%.

### KR6. Meta funnel CAPI Test Events readiness를 실제 운영 송출 전까지 준비한다

완성도: **70%**

- 액션플랜 1: Test Events runbook을 유지한다. ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo 등 구매 전 이벤트를 test_event_code 승인 후 각 1회 이하로 검증한다. 기여: 70% -> 78%.
- 액션플랜 2: browser/server dedup 계약을 고정한다. 같은 event_id가 browser와 server에 들어가도 중복 구매로 세지지 않게 한다. 기여: 78% -> 88%.
- 액션플랜 3: 운영 송출 Red 승인 패킷을 별도로 만든다. Test Events smoke와 운영 CAPI send를 분리하고, Purchase는 계속 금지한다. 기여: 88% -> 100%.

현재 P0는 `paid_click_intent Mode B`다. 뜻은 Google 광고 클릭 ID(`gclid/gbraid/wbraid`)가 랜딩에서 저장되고 checkout/NPay intent까지 이어지는지 운영에서 검증하는 묶음이다.

TJ님은 Mode B를 조건부 YES로 승인했다. Codex는 VM Cloud 직접 계정(`biocomkr_sns`) SSH 실패를 우회해 `taejun` 계정 경유로 backend no-write receiver route를 배포했고, production TEST/negative smoke를 통과시켰다. 이어서 GTM live version `142`를 2026-05-07 00:02 KST에 publish했고 live smoke도 통과했다.

여기서 시간 기준은 두 개다. **GTM publish 기준 24h는 2026-05-08 00:02 KST에 이미 도달했고, 72h는 2026-05-10 00:02 KST다.** 별도로 **minimal paid_click_intent ledger write canary는 2026-05-07 23:01 KST에 시작했으므로, canary 24h는 2026-05-08 23:01 KST, 72h는 2026-05-10 23:01 KST다.** 과거 handoff의 `T+24h 2026-05-08 23:01 KST`는 GTM publish가 아니라 ledger canary 기준이다.

2026-05-08 17:23 KST read-only 현재 상태는 좋다. ledger row 709건, unique click id hash 428건, capture stage landing 461 / checkout_start 135 / npay_intent 113건, debug/test/preview query key row 0건, send_candidate 0건이다. 단 이것은 **수집기가 잘 작동하는지 보는 건강검진** 근거이지, Google Ads 구매 전송이나 Path C 운영 승인 근거는 아니다.

2026-05-08 20:06 KST 현재 결정은 명확하다. **24h audit은 자동 진행**, **wrapper Preview는 비로그인 안전성 PASS / 로그인 NPay 클릭 흐름 확인 / 현재 GTM member_code 후보 변수는 200·201·203 모두 empty / source 재탐색에서도 usable client-side source 없음**, **Path C backend deploy는 HOLD**, **actual send/Google Ads upload/conversion action 변경은 NO**다. 구매 매칭 개선 효과는 `member_code_hash` 또는 동등한 결정적 연결키가 생기기 전까지 계산하지 않는다.

wrapper Preview 실행 결과: GTM fresh workspace `162`에서 Preview tag `287`을 만들고 quick preview로만 실행한 뒤 workspace를 삭제했다. 공개 상품 페이지 2개에서 `TEST_GCLID_PATHC_PREVIEW_20260508`만 사용했고, 6개 payload 모두 receiver 200, raw member_code/PII/order/payment/value 0, `ledger.stored` 0이었다. 이후 TJ님 수동 Tag Assistant 캡처에서 로그인 후 NPay 구매하기 클릭과 주문/결제 창 도달은 확인됐다. 기존 `TechSol - [GAds]NPAY구매 51163`, `GA4_구매전환_Npay`, ChannelTalk 구매전환 태그가 결제완료 전에도 발화되는 것도 확인됐다. 하지만 200 `gtm.linkClick`, 201 `h_add_payment_info`, 203 `conversion` 변수 탭에서 `memberCode`, `Retous - [변수] memberCode`, `RETOUS - [변수] member_code`, `Retous - [맞춤] memberCode`는 모두 empty/undefined였다. `JS - Imweb Data Layer` object는 있었지만 공유된 구조에는 memberCode가 없고, 이메일형 `user_id`만 값이 있어 Path C source로 사용 금지다. 추가 source 재탐색에서도 `dataLayer.member_code`, `localStorage.__bs_imweb.memberCode`, `sessionStorage.__bs_imweb_session.memberCode`, `window.imweb.user.member_code`, `window.hurdlers_ga4.member_code` 등은 모두 absent였다.

2026-05-08 20:17 KST fallback 검토 결과도 보수적으로 닫았다. raw email bridge는 운영 사용 금지이고, `email_hash/HMAC` bridge는 별도 개인정보/Yellow 승인 후보로만 남긴다. 비회원과 주문 단위 매칭은 Path B `order_confirm` bridge로 분리하며, raw `order_no/payment_key/value/email/phone` 저장 없이 HMAC hash와 session/click hash만 쓰는 설계를 초안으로 잡았다. Retous/Imweb legacy memberCode 변수는 `deprecate_candidate`지만 즉시 pause/delete하지 않는다.

2026-05-08 20:38 KST에는 Path B를 더 구체화했다. raw email/phone은 장기 저장하지 않고, HTTPS backend no-send endpoint에서 transient로만 받아 즉시 normalize + HMAC-SHA256 후 폐기하는 방향이다. 저장 후보는 `email_hash`/`phone_hash`/`identity_hash_version`/`identity_source`뿐이다. `order_bridge_ledger` v2 schema, Preview/no-send HMAC smoke 계획, 1h hash-only canary 계획, Retous/Imweb dependency map을 작성했다. 이 단계도 문서/설계 Green이며, backend deploy, schema migration, GTM Production publish, platform send는 아직 하지 않았다.

2026-05-08 23:03 KST에는 Path B no-send HMAC endpoint 로컬 초안과 fixture test를 추가했다. `POST /api/attribution/order-bridge/identity-hmac/no-send`는 로컬 코드에만 추가됐고 운영 배포는 하지 않았다. 2026-05-08 23:23 KST 보강으로 route-level 16KB body size guard와 oversized 413 fixture까지 추가해 fixture smoke 5개가 PASS했다. raw echo 0, raw logging 0, no platform send 0 assertion을 통과했다. Preview tag 초안도 문서화했지만 GTM Production publish나 Imweb 저장은 하지 않았다.

2026-05-08 23:23 KST에는 Path B를 45%에서 다음 단계로 올리기 위한 Green/Yellow 준비 패킷을 작성했다. 제한 deploy 승인안은 final code diff, `ORDER_BRIDGE_IDENTITY_HASH_SECRET` 주입 방식, CORS/origin/body size/raw logging guard, post-deploy smoke, tunnel smoke 대안을 포함한다. GTM Preview final checklist는 fresh workspace, no-publish, evidence 양식, 보강 Preview tag 초안을 정리했다. reliability dry-run 설계는 1d/7d/30d lookback, last eligible click, A/B/C/D confidence, 100%까지 남은 단계를 정의했다. 실행은 아직 하지 않았고 backend deploy, operational schema migration, GTM Production publish, platform send는 계속 HOLD다.

2026-05-07 18:12 KST Google Ads API read-only 재조회 기준, Google Ads ROAS=광고 플랫폼이 주장하는 값은 last_30d `8.72x`다. 같은 window의 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값은 VM Cloud attribution ledger 기준 `0.28x`다. 예산 판단에는 플랫폼 주장값 `8.72x`를 쓰지 않고, 내부 confirmed `0.28x`와 click id 보존률을 같이 본다.

Google Ads `Conv. value` 218,196,428원 중 218,196,382원은 Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호 `구매완료` action `7130249515`의 known NPay count label `r0vuCKvy-8caEJixj5EB`에서 나온다. 따라서 다음 실행 보드는 Meta나 `/total` 화면 작업이 아니라, Google click id 보존과 confirmed purchase no-send 후보를 안정화하는 순서만 우선한다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

Phase 번호는 작업 영역 이름이고, 실제 개발 순서는 `Priority`와 표의 위아래 순서를 따른다. 한 Phase 안에는 여러 Sprint가 들어갈 수 있다.

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase4-Sprint6]] | Google 광고 클릭 ID를 주문 후보까지 보존하고, NPay/가상계좌 결제 상태를 정확히 가른다 | Google Ads에 실제 결제완료 주문만 알려주려면 클릭, 주문, 로그인 identity가 이어지고 미결제/클릭-only 주문은 막혀야 한다 | paid_click_intent 수집 -> Path B order bridge -> NPay confirmed status guard -> unpaid/test exclusion -> confirmed-only dry-run 순서로 닫는다 | 실제 Google 광고 클릭 no-send bridge PASS. VM Cloud biocom/thecleancoffee status sync 1회 완료. 운영DB PAYMENT_COMPLETE dry-run은 4건(homepage 3/NPay 1) send_candidate 0. VM Cloud-only recalc는 NPay primary status column 부재로 npay_actual 0 | 96% | confirmed 결제완료만 후보로 남고, 미입금 가상계좌·NPay click/add_payment_info·controlled evidence는 upload 후보 0건으로 막힌다 | Codex: Path B/NPay 변경 커밋, ConfirmedPurchasePrep에 운영DB primary source 연결. TJ: 추가 실제 결제/입금 테스트는 보류 추천 | NO, Green. upload는 Red HOLD | [[../gdn/path-b-real-paid-click-actual-order-preview-result-20260510]], [[../gdn/confirmed-purchase-npay-status-guard-20260510]], [[../gdn/bi-confirmed-purchase-operational-dry-run-20260510]], [[../gdn/vm-cloud-imweb-sync-status-review-20260510]] |
| P0/P1 | [[#Phase2-Sprint4]] | 내부 결제완료 매출을 유입 채널별로 한 번만 배정한다 | 광고 플랫폼 주장값과 내부 confirmed 매출을 섞으면 예산 판단이 틀어진다 | Meta/Google/TikTok/Naver/Organic/Direct/Unknown 기준을 주문 단위로 정리하고 split_required를 줄인다 | campaign mapping 1차 완료. 일부 split/exact id 확인 필요 | 70% | unknown/quarantine가 줄고, NPay는 결제수단으로만 처리되며 paid_naver로 오배정되지 않는다 | Codex: 최신 input 재측정. TJ/그로스파트: exact campaign id 필요 시 회신 | NO, read-only 우선 | [[../data/!channelfunnel]], [[../otherpart/!otherpart]] |
| P1 | [[#Phase1-Sprint1]] | 월별 주문·결제 정본 장부를 만든다 | 내부 confirmed ROAS=실제 결제완료 매출 기준값이 있어야 플랫폼 ROAS를 검증할 수 있다 | 운영DB/VM Cloud/로컬 DB를 source별로 분리하고 freshness/confidence를 남긴다 | 1차 장부 안정. 최신 Path B guard 반영 필요 | 86% | 결제수단별 confirmed/cancel/refund 기준이 통일되고 Google/Meta/TikTok/Naver별 예산 판단 기준이 분리된다 | Codex: unpaid/confirmed status guard를 input builder에 반영 | NO, Green | [[../data/!datacheckplan]], [[../gdn/unpaid-vbank-controlled-evidence-exclusion-20260510]] |
| P1/P2 | [[#Phase3-Sprint5]] | Google Ads에 실제 결제완료만 구매로 알려주는 통로를 준비한다 | 기존 Google Ads `구매완료` Primary 전환은 NPay click/count가 대부분이라 입찰 학습 신호가 왜곡된다 | no-send 후보 품질, duplicate guard, block_reason, upload dry-run을 먼저 닫고 Red 승인 전까지 전송하지 않는다 | Path B no-send bridge PASS. upload 후보 0 유지 | 65% | confirmed-only 후보가 A/B confidence로 분리되고 duplicate/미결제/테스트 주문이 모두 block된다 | Codex: confirmed-only dry-run. TJ: upload는 별도 Red 승인 전 금지 | HOLD/Red | [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]] |
| P3 | [[#Phase5-Sprint8]] | `/total` 운영 화면에서 플랫폼 주장값과 내부 confirmed 값을 분리해 보여준다 | 운영자가 Google Ads ROAS와 내부 confirmed ROAS를 같은 값처럼 읽으면 예산 판단이 틀어진다 | API/source freshness, unknown/quarantine, guard 상태를 화면에 노출한다 | F0 data contract 1차 고정, 구현 0% | 42% | 운영자가 월별 source별 매출, unknown, blocked reason, upload 후보 0/있음을 한 화면에서 본다 | Claude Code: UI 구현. Codex: 데이터 계약/검증 | 추후 Yellow | [[../gdn/frontend-dashboard-data-contract-20260510]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

요약표는 전체 순서이고, 이 섹션은 지금 바로 움직일 실행 카드다. 이전 `Active Action Board`의 역할은 이 섹션으로 흡수했다.

### Auto Green

#### A0. Google Ads dashboard route 502 fix를 승인 가능한 상태로 유지한다
- 무엇을 하는가: VM Cloud dashboard `last_30d` 502를 줄이는 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first` 제한 배포 승인안을 유지한다.
- 왜 하는가: Google Ads ROAS=광고 플랫폼이 주장하는 값과 내부 confirmed ROAS=실제 결제완료 원장 기준값을 last_7d/last_30d로 반복 비교하려면 route가 40초 timeout에 걸리지 않아야 한다.
- 어떻게 하는가: Codex는 로컬 code/typecheck/smoke를 유지하고, TJ님 승인 전까지 VM deploy/restart는 하지 않는다.
- 성공 기준: 승인 후 VM에서 `/api/google-ads/dashboard?date_preset=last_7d,last_30d`가 모두 200이고, platform send 0, raw logging 0이다.
- 실패 시 다음 확인점: PM2 env 반영 여부, VM SQLite path, attribution ledger local read error, proxy timeout.
- 승인 필요 여부: VM deploy/restart는 YES. 현재 문서/로컬 검증은 NO.
- 산출물: [[../gdn/google-ads-dashboard-route-local-fix-approval-20260510]].
- 진척률에 미치는 영향: Track B 68% -> 72%, Track F 42% -> 45%.
- 의존성: TJ님 VM limited deploy 승인.

#### A1. 운영DB PAYMENT_COMPLETE source를 ConfirmedPurchasePrep input에 연결한다
- 무엇을 하는가: NPay 실제 결제완료 주문은 운영DB `PAYMENT_COMPLETE` 또는 관리자 confirmed source 기준으로 input에 포함하고, VM Cloud lifecycle status는 보조값으로만 붙인다.
- 왜 하는가: VM Cloud-only 재계산은 NPay primary payment status column이 없어 `npay_actual=0`으로 나온다. 이 값을 그대로 쓰면 NPay 실제 매출을 누락한다.
- 어떻게 하는가: [[../gdn/bi-confirmed-purchase-operational-dry-run-20260510]]의 운영DB 결과를 primary로 두고, [[../gdn/confirmed-purchase-prep-recalc-20260510]]의 VM Cloud 후보는 Path B/Path C 보조 원장으로 붙인다.
- 성공 기준: NPay actual confirmed가 포함되고, click-only/미완료/test evidence는 upload 후보 0건이다. `send_candidate=false`, `actual_send_candidate=false`가 유지된다.
- 실패 시 다음 확인점: 운영DB 결제 상태 필드명, 관리자 confirmed source, NPay channel order mapping freshness, VM Cloud full sync partial 원인.
- 승인 필요 여부: NO, Green read-only/dry-run.
- 산출물: 운영DB primary + VM Cloud bridge 통합 dry-run input.
- 진척률에 미치는 영향: [[#Phase4-Sprint6]] 96% -> 98%.
- 의존성: 운영DB dry-run PASS, VM Cloud status sync 보조값 PASS.

#### A2. 24h/72h 수집 건강검진을 최신 상태로 갱신한다
- 무엇을 하는가: paid_click_intent 원장(기록 장부)이 계속 안정적으로 쌓였는지 갱신한다.
- 왜 하는가: 구매 개선 효과와 별개로 수집 파이프가 정상인지 봐야 다음 confirmed-only dry-run을 신뢰할 수 있다.
- 어떻게 하는가: [[../gdn/canary-capture-health-24h-20260508]] 기준으로 row/stage/guard/5xx/PM2/no-send를 다시 집계하고, 24h와 72h 기준을 분리한다.
- 성공 기준: row/stage 증가, debug/test/preview 차단, raw 저장 0, platform send 0, PM2 unexpected restart 0이 PASS/HOLD/FAIL로 정리된다.
- 실패 시 다음 확인점: VM Cloud SQLite freshness, PM2 log, cloudflared 5xx, GTM trigger scope.
- 승인 필요 여부: NO, read-only.
- 산출물: 갱신된 capture health 결과 문서.
- 진척률에 미치는 영향: [[#Phase4-Sprint6]] 운영 안정성 판단 강화.
- 의존성: 독립 실행 가능.

#### A3. 채널퍼널 정본을 Path B 결과 기준으로 갱신한다
- 무엇을 하는가: [[../data/!channelfunnel]]의 오래된 2026-05-08 Path B “설계/대기” 표현을 2026-05-10 실제 광고 클릭 no-send bridge PASS와 unpaid vbank guard 기준으로 바꾼다.
- 왜 하는가: 채널 품질 문서가 아직 Path B 이전 상태로 보이면 다음 예산/ROAS 판단이 늦어진다.
- 어떻게 하는가: Phase-Sprint 요약표와 다음 할일을 실제 개발 순서 기준으로 재작성하고, Active Action Board는 제거한다.
- 성공 기준: 채널퍼널 문서에서 Path B가 “설계 후보”가 아니라 “no-send bridge PASS, confirmed/payment guard 필요”로 읽힌다.
- 실패 시 다음 확인점: channelfunnel의 source window, BigQuery 14/30일 재조회 필요 여부.
- 승인 필요 여부: NO, Green docs.
- 산출물: [[../data/!channelfunnel]] 업데이트.
- 진척률에 미치는 영향: Phase2/Phase4 문서 정합성 상승.
- 의존성: 독립 실행 가능.

### Approval Needed

#### B1. 실제 결제완료 테스트를 오늘 추가로 할지 판단한다
- 무엇을 하는가: 카드 결제나 가상계좌 입금을 이용해 실제 `paid_at`이 있는 confirmed payment test를 할지 정한다.
- 왜 하는가: 현재 실제 광고 클릭 bridge는 PASS지만, 마지막 주문은 가상계좌 미입금이라 confirmed purchase 증거가 아니다.
- 어떻게 하는가: TJ님이 결제수단/금액/환불 가능성을 정하면 Codex가 test_order exclusion guard와 no-send 확인 절차를 먼저 다시 제시한다.
- 성공 기준: 실제 결제 테스트를 한다면 `exclude_from_upload=true`와 refund/cancel 추적 기준이 먼저 준비된다.
- 실패 시 다음 확인점: 결제 취소 가능성, 운영 주문 status 반영 지연, 기존 live purchase tag 영향.
- 승인 필요 여부: YES, TJ님 실제 결제/입금 판단.
- 산출물: confirmed payment controlled test 승인안.
- 진척률에 미치는 영향: [[#Phase4-Sprint6]] 94% -> 98% 가능.
- 의존성: A1 guard 완료 후 판단 권장.

### Blocked/Parked

#### C1. Google Ads confirmed_purchase upload는 계속 보류한다
- 무엇을 하는가: Google Ads에 실제 결제완료 주문만 구매로 보내는 실제 전송을 보류한다.
- 왜 하는가: confirmed-only guard, duplicate guard, 테스트/미결제 제외, 실제 전송 rollback이 모두 닫히기 전에는 광고 학습을 오염시킬 수 있다.
- 어떻게 하는가: send_candidate=false, actual_send_candidate=false, upload 후보 0을 유지한다.
- 성공 기준: Google Ads/GA4/Meta/TikTok/Naver 신규 전송 0건.
- 실패 시 다음 확인점: 기존 GTM live purchase tag와 새 Path B no-send tag의 scope 혼동 여부.
- 승인 필요 여부: YES, Red. 지금은 HOLD.
- 산출물: 추후 Red 승인 패킷.
- 진척률에 미치는 영향: 운영 전송 기준 0% 유지.
- 의존성: A1/A2와 confirmed-only dry-run 이후.

## 현재 기준

| 항목 | 현재 기준 |
|---|---|
| 정본 문서 | [[!total-current]] |
| 기존 문서 역할 | [[!total_past]]은 old/legacy phase history |
| 현재 P0 | paid_click_intent Mode B |
| Mode B 승인 상태 | 조건부 YES |
| Mode B 실제 실행 상태 | backend receiver route 배포, smoke, GTM publish, live smoke 통과. GTM publish 기준 24h 도달, 72h monitoring 진행 중 |
| Mode B GTM publish 기준시각 | publish 2026-05-07 00:02 KST. T+24h = 2026-05-08 00:02 KST(도달), T+72h = 2026-05-10 00:02 KST |
| minimal ledger canary 기준시각 | 운영 ledger write 시작 2026-05-07 23:01 KST. T+24h = 2026-05-08 23:01 KST, T+72h = 2026-05-10 23:01 KST |
| 24h 전에도 의미 있는 지표 | receiver 2xx/5xx, row 증가속도, capture stage 분포, TEST/PII 차단, no_platform_send, PM2 restart, RSS/event loop. 주문별 attribution uplift와 Google Ads 학습 효과는 24h+와 별도 input builder/guard 필요 |
| paid_click_intent canary 현재 상태 | 2026-05-08 17:23 KST read-only snapshot: row 709, unique click id hash 428, landing 461 / checkout_start 135 / npay_intent 113, latest 2026-05-08 17:22:44 KST, TEST/DEBUG/PREVIEW query key row 0, status received 709, send_candidate 0 |
| canary 24h 해석 | 수집 파이프 건강검진만 가능. 구매 매칭 개선 효과는 `member_code_hash` 또는 동등 deterministic bridge 전까지 HOLD |
| wrapper Preview | 2026-05-08 19:04 KST 실행. 비로그인 공개 상품 2페이지 안전성 PASS. 2026-05-08 19:21~19:33 KST 로그인 NPay 클릭 흐름 확인. 200/201/203의 current GTM memberCode 계열 변수는 empty/undefined. 2026-05-08 20:06 KST source 재탐색에서도 usable client-side source 없음. 2026-05-08 23:03~23:23 KST fallback 보강: Path B no-send HMAC endpoint 로컬 초안 + body size guard + fixture 5 PASS + 제한 deploy 승인안 + GTM Preview final checklist + reliability dry-run 설계 작성. Production publish HOLD |
| Path B 실제 광고 클릭 bridge | 2026-05-10 01:31 KST 실제 Google 광고 클릭 -> 바이오컴 주문완료 화면에서 order hash / email identity hash / client-session / click hash 모두 present. Path B no-send response 200, would_store=false, would_send=false, platform_send_count=0. 단 가상계좌 미입금이므로 confirmed paid purchase 아님. [[../gdn/path-b-real-paid-click-actual-order-preview-result-20260510]] |
| unpaid vbank exclusion | `source_order_status != confirmed` 또는 `payment_method=vbank AND paid_at missing`이면 `block_reason=unpaid_vbank_controlled_evidence`, `exclude_from_upload=true`, `exclude_from_budget_roas=true`, `send_candidate=false`, `actual_send_candidate=false`. [[../gdn/unpaid-vbank-controlled-evidence-exclusion-20260510]] |
| Path C backend deploy | HOLD. final code diff, secret 관리, TTL/cleanup, raw logging proof, migration rollback, smoke script 필요 |
| VM Cloud 접근 | 직접 `biocomkr_sns` SSH는 실패. `taejun` 경유 후 `sudo -u biocomkr_sns` 가능 |
| 운영 receiver | `POST /api/attribution/paid-click-intent/no-send` 200 확인 |
| GTM live | `142 (paid_click_intent_v1_receiver_20260506T150218Z)` |
| Meta funnel CAPI 최신 상태 | server endpoint 준비 완료, funnel 운영 송출 0건, Test Events code 수령. 2026-05-08 Green no-send payload preview 생성. 실제 Meta 호출/GTM Preview/Imweb 수정은 하지 않음. [[../capivm/meta-funnel-capi-gtm-first-plan-20260508]] |
| 캠페인 매핑 최신 입력 | `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx` |
| 그로스파트 추가 확인 | 2개 exact campaign id만 필요. [[../otherpart/!otherpart]] |
| TJ 승인 큐 | 현재 open approval 없음. [[../confirm/!confirm]] |
| 외부 전송 상태 | 0건. GA4/Meta/Google Ads/TikTok/Naver 전송 없음 |
| 운영DB/ledger write | 승인 범위 내 minimal `paid_click_intent` ledger canary write 진행 중. 2026-05-08 17:00 KST row 694건. 승인 범위 밖 write는 0건 |
| Google Ads API read-only | 2026-05-07 18:12 KST last_30d 조회 PASS. 비용 25,016,556원, `Conv. value` 218,196,428원, Google Ads ROAS 8.72x |
| Google Ads Primary 오염 | `구매완료` action `7130249515` NPay count label value 218,196,382원. 플랫폼 `Conv. value`의 사실상 100% |
| 내부 confirmed ROAS 최신 조회 | VM Cloud attribution ledger same-window 복구. Google 증거 payment_success 29건, confirmed 27건, confirmed revenue 7,063,020원, 내부 confirmed ROAS 0.28x |

## Approval Queue

현재 open approval: **wrapper Preview only 승인 완료**. Path B는 `gptconfirm/gpt0508-3` 기준으로 제한 deploy 또는 tunnel smoke + GTM Preview 실행 여부를 새로 판단할 수 있는 상태다. Production publish, actual send 관련 open approval은 **없음/HOLD**.

**현재 진행 중**: minimal `paid_click_intent` ledger write 24h canary 진행 중 (TJ 2026-05-07 22:35 KST 승인, 운영 write 시작 2026-05-07 23:01 KST). 1h canary는 PASS했고, 2026-05-08 17:00 KST read-only snapshot 기준 row 694 / unique click id hash 421 / landing 453 / checkout_start 130 / npay_intent 111 / paid-click-intent 5xx 0 / PM2 추가 restart 0 / RSS 약 240MB다. 24h 종료 예정은 2026-05-08 23:01 KST다. 결과: [[../gdn/paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] / 조기 audit: [[../gdn/paid-click-intent-ledger-canary-early-audit-20260508]] / 패킷: [[../gdn/paid-click-intent-minimal-ledger-canary-execution-packet-20260507]].

승인 큐 상세: [[../confirm/!confirm]]

## Approval History / Active Approval Scope

### Mode B: receiver route deploy → smoke → GTM publish → monitoring

상태: TJ님 조건부 YES (승인 완료). 승인 범위 안의 실행은 모두 통과. GTM publish 기준 24h는 2026-05-08 00:02 KST에 도달했고, 72h read-only monitoring은 2026-05-10 00:02 KST에 닫는다. 별도 minimal ledger canary 기준 24h는 2026-05-08 23:01 KST다.

승인 범위 (실행 결과):

- `att.ainativeos.net` backend에 `POST /api/attribution/paid-click-intent/no-send` no-write receiver route 배포 → 완료 (2026-05-06)
- TEST POST와 negative smoke 확인 → 완료 (2026-05-06)
- receiver-enabled GTM Production publish → 완료 (2026-05-07 00:02 KST · live version 142)
- live browser smoke → 완료 (2026-05-07 00:03 KST)
- GTM publish 기준 24h 모니터링 → 기준 시각 도달 (2026-05-08 00:02 KST)
- GTM publish 기준 72h 모니터링 → 진행 중 (2026-05-10 00:02 KST, read-only, 추가 승인 불필요)
- minimal ledger canary 기준 24h 모니터링 → 진행 중 (2026-05-08 23:01 KST)

계속 금지 (Approval Scope 밖):

- Google Ads 전환 변경.
- conversion upload.
- confirmed purchase dispatcher 운영 전송.
- 승인 범위 밖 운영DB/ledger write.
- GA4/Meta/Google Ads/TikTok/Naver 전환 전송.
- 광고 예산/캠페인 변경.

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-06 KST | paid_click_intent Preview/receiver 검증 | 임시 receiver에서 `gclid/gbraid/wbraid` 3종 케이스 통과 |
| 2026-05-06 KST | Google Ads landing-session click id 분석 | 최근 7일 Google Ads 증거 세션 6,879개 중 6,724개 click id 보유. 보존률 97.75% |
| 2026-05-06 KST | production receiver POST smoke | 운영 배포 전 `att.ainativeos.net` POST 404 확인. receiver route 필요성 확정 |
| 2026-05-06 KST | VM Cloud 접근 경로 복구 | 직접 `biocomkr_sns`는 실패하지만 `taejun` 경유 `sudo -u biocomkr_sns`로 repo/PM2 접근 가능 확인 |
| 2026-05-06 KST | backend no-write receiver route 운영 배포 | `seo-backend` 재시작. `POST /api/attribution/paid-click-intent/no-send` 200 확인 |
| 2026-05-06 KST | production TEST/negative smoke | TEST click id 200, click id 없음/value/order/PII/internal/oversized 차단 확인 |
| 2026-05-07 00:02 KST | GTM receiver-enabled publish | live version `142`, tag `[279]`, trigger `[278]` publish 완료 |
| 2026-05-07 00:03 KST | biocom live browser smoke | TEST gclid storage 저장, receiver 200, `would_store=false`, `would_send=false` 확인 |
| 2026-05-06 KST | 그로스파트 Meta 매핑 엑셀 반영 | 확정 1건, 분리 필요 7건, 제외 1건을 seed와 문서에 반영 |
| 2026-05-07 00:42 KST | Meta split_required 주문별 분리 규칙 작성 | ID/date/window 증거가 있는 주문만 campaign에 붙이고 alias-only는 quarantine하는 설계 작성 |
| 2026-05-07 00:42 KST | minimal paid_click_intent ledger write 승인안 초안 작성 | 저장 필드, 금지 필드, 보관기간, 승인 문구 초안 작성. 실제 write는 24h/72h 이후 |
| 2026-05-07 00:42 KST | 24h/72h 모니터링 결과 템플릿 작성 | 결과 문서 파일명, smoke 명령, rollback 기준, 판단 문구를 사전 작성 |
| 2026-05-07 00:42 KST | VM Cloud SSH 런북 보강 | 배포 전 안전 체크, 배포 후 smoke, rollback 기준을 추가 |
| 2026-05-07 00:48 KST | paid_click_intent 즉시 sanity smoke | `/health` 정상, receiver 200, `would_store=false`, `would_send=false`, `live_candidate_after_approval=false` 확인 |
| 2026-05-07 01:23 KST | paid_click_intent monitoring 수집기 작성/실행 | `backend/scripts/paid-click-intent-monitoring-collect.ts` 생성. health + 7개 positive/negative smoke 통과 |
| 2026-05-07 01:20 KST | Meta split_required dry-run 작성/실행 | 10개 수동 row 중 mapped 1, split/order-level 필요 6, precision loss 재확인 2, 제외 1 |
| 2026-05-07 01:20 KST | Google Ads confirmed_purchase 후보 prep 작성/실행 | 운영 결제완료 623건을 upload preview로 변환. click id 보유 5건, 실제 send_candidate 0 유지 |
| 2026-05-07 01:25 KST | minimal paid_click_intent ledger schema contract 작성 | 테이블 초안, 저장/금지 필드, dedupe, retention, rollback 기준 작성 |
| 2026-05-07 01:52 KST | `/total` 운영 화면 설계 초안 작성 | 내부 confirmed와 platform_reference를 분리하는 카드 구조, API 응답 초안, Claude Code 구현 기준 작성 |
| 2026-05-07 01:52 KST | 외부파트 확인 요청 정리 | 그로스파트 추가 확인은 Excel precision loss 가능성 있는 campaign id 2개로 축약 |
| 2026-05-07 01:52 KST | 승인 큐 정리 | 현재 open approval 없음. 다음 후보는 24h/72h monitoring PASS 후 minimal ledger write |
| 2026-05-07 17:41 KST | Google Ads API last_30d read-only 재조회 | 비용 25,016,556원, `Conv. value` 218,196,428원, Google Ads ROAS 8.72x. `구매완료` NPay label value 218,196,382원으로 플랫폼 분자의 사실상 100%. 내부 ROAS는 local fallback 0.08x, latestLoggedAt 2026-04-12라 예산 판단 primary 금지 |
| 2026-05-07 18:12 KST | Google Ads API x VM Cloud 원장 same-window 재대조 | 로컬 API VM source 복구. VM Cloud attribution ledger 기준 Google 증거 payment_success 29건, confirmed 27건, confirmed revenue 7,063,020원, 내부 confirmed ROAS 0.28x. Google Ads 플랫폼 ROAS 8.72x와 8.44p 차이 |
| 2026-05-07 18:33 KST | Google Ads ROAS VM Cloud 원장 조회 복구 backend 배포 | `backend/src/routes/googleAds.ts` 1파일만 VM Cloud에 반영, PM2 재시작, /health 200. dashboard 500은 VM Google Ads developer token 미설정으로 분리됨 |
| 2026-05-07 20:13 KST | ReportAuditorAgent v0 + ConfirmedPurchasePrepAgent v0 runner 연결/실행 | Phase5/Phase6 100%/100% 완료. 6개 agent 모두 Green Lane 자동 실행 가능 |
| 2026-05-07 20:36 KST | ApprovalQueue parser stale approval cleanup | open 1·unknown 2 false positive 모두 closed로 재분류. 현재 closed 6, future 5, open 0, unknown 0 |
| 2026-05-07 20:36 KST | ReportAuditor drift filter 보강 | yaml 리스트/Red Lane 분류표/access log 통계 false positive 6건 모두 제거. status pass |
| 2026-05-07 20:45 KST | Google tag gateway POC 조사/승인안 작성 | biocom·coffee 모두 AWS CloudFront(Imweb 자사몰) 위. Cloudflare wizard 즉시 적용 불가. 활성화 옵션 A(Cloudflare 도입)/B(Imweb native)/C(자체 custom) 분리. 활성화 자체는 별도 Yellow 승인 필요 |
| 2026-05-07 21:19~21:20 KST | paid_click_intent receiver 502 transient 실증 30 calls | `missing_google_click_id` 5회 중 3회 502 (3초 burst, 직전·직후 정상). PM2 max_memory_restart timing 가설 강화. `reject_oversized_body` 5/5 500은 본 evidence 120KB 페이로드 부작용 (운영 monitoring 20KB는 여전히 413 정상). 운영 receiver persistent regression 없음. minimal ledger write 승인 판단 전 SSH 권한 받아 PM2 restart 빈도 매칭 분석 필요. evidence: [[../gdn/paid-click-intent-502-transient-evidence-20260507]] |
| 2026-05-07 21:33~21:46 KST | VM Cloud SSH read-only 직접 조사 + bounded probe 110 calls | 본 agent가 `taejun@34.64.104.94` 경유 SSH로 PM2/log 직접 조회. seo-backend restart 누적 3,930회, 최근 30분 30~31초 정확 주기, heap 94.7% at 12s uptime. bounded probe 5건 502 (4.5%) 모두 PM2 restart 시각과 1~2초 매칭. **confirmed_pm2_restart_burst** 판정. 일평균 ~65분/일 5xx 위험. minimal ledger write 진입 4가지 선행 blocker 추가됨. correlation: [[../gdn/paid-click-intent-pm2-restart-correlation-20260508]] / probe: [[../gdn/paid-click-intent-bounded-probe-result-20260507]] |
| 2026-05-07 21:42 KST | backend errorHandler payload hardening 로컬 patch 작성 | `body-parser PayloadTooLargeError`(100KB 초과)가 errorHandler에서 generic 500으로 응답되던 별건 bug 발견. `isBodyParserError` 가드 추가로 status code 그대로 응답(413/400). typecheck PASS. 운영 deploy 별도 승인안: [[../gdn/backend-errorhandler-payload-hardening-approval-20260508]] |
| 2026-05-07 22:01 KST | backend errorHandler hardening + PM2 max_memory_restart 1.5G 운영 deploy | TJ "YES: PM2 1.5G + errorHandler hardening 둘 다 deploy" 승인 후 본 agent SSH 직접 실행. 백업 → scp → restart with --max-memory-restart 1500M → smoke. 결과: oversized 120KB → 413 (이전 500), PM2 restart count 3820 → 3820 (5분 동안 0회 추가, 이전 30초 주기 50회/30분에서 즉시 정지). 결과: [[../gdn/backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507]] |
| 2026-05-07 22:25 KST | minimal `paid_click_intent` ledger write 4 선행 blocker 모두 PASS 확정 | T+23min evidence: PM2 restart 22분 0회, mem 210.6 MB (13% of 1.5G), controlled probe 114 calls 5xx 0건 (이전 4.5%), backend/cloudflared error log 24분 0 라인. **4 blocker(PM2 restart 완화, errorHandler hardening, heap baseline, 5xx 비율 < 1%) 모두 PASS**. 승인안 [[../gdn/paid-click-intent-minimal-ledger-write-approval-20260507]] 진입 가능 status |
| 2026-05-07 22:35~23:05 KST | minimal `paid_click_intent` ledger write canary 실행 패킷 작성 + TJ 승인 + Phase 0/1/2 T+0 deploy/smoke 완료 | TJ "YES" 회신 후 본 agent SSH 자율 실행. backend/src/paidClickIntentLog.ts 신규 작성 + attribution.ts route flag 분기 + bootstrap. 운영 backup → scp → flag false 배포 → schema bootstrap (table + 5 indexes 생성) → flag-off smoke PASS → flag true 재배포 → 7 smoke PASS (TEST 차단, live insert 2건, dedupe 1건, PII reject, oversized 413, no_platform_send 100%). 1h canary 진행 중. 결과: [[../gdn/paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] |
| 2026-05-07 23:23~2026-05-08 00:01 KST | canary 1h 종합 판정 PASS | T+22/30/60min monitoring. row 17→34→52 (자연 traffic 145건/h 페이스 유지), dedupe 1, by_stage landing 34/npay 11/checkout 7. paid-click-intent 5xx 0건, backend error 0, PM2 0 추가 restart. mem 197→222→1024 MB (T+30~60min 800MB spike — background job 가속 추정, 1.5G threshold 67%). 24h 자동 연장 진행. **mem 추세 6h 시점 재측정 필요** |
| 2026-05-08 00:00 KST | data/!bigquery.md → _old rename + _new 정본 작성 | docurule.md v6 형식. 직접 검증 결과: biocom hurdlers-naver-pay.analytics_304759974 events_20260506 70,294 rows 정상 적재, coffee 정상, AIBIO 미연결. SA `seo-656@seo-aeo-487113`로 dataset Read OK + project-dadba7dd jobs.create OK. 운영 backend dist는 옛 sourceFreshness (jobProjectId 분리 미적용) → biocom freshness fail. 최신 dist deploy로 즉시 정상화 가능. 결과: [[../data/!bigquery_new]] |
| 2026-05-08 01:05 KST | Meta funnel CAPI GTM-first no-send preview | readiness 문서 확인. Test Events code는 원문 저장 없이 `TEST*****`로만 마스킹. ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo/Lead/Search 6종 payload preview 생성. GTM live v142, Default Workspace change 0/conflict 0 read-only 확인. 실제 Meta 호출, GTM Preview/Publish, Imweb header/footer 수정, 운영 CAPI 전송 0건. 결과: [[../capivm/meta-funnel-capi-gtm-first-plan-20260508]] |
| 2026-05-08 11:35 KST | paid_click_intent ledger canary T+12.5h 조기 audit | row 498 / unique 310 / landing 332 / checkout_start 87 / npay_intent 79 / 5xx 0 / PM2 추가 restart 0 / RSS 227MB / PII·TEST row 0. EARLY_PASS_CANDIDATE. 결과: [[../gdn/paid-click-intent-ledger-canary-early-audit-20260508]] |
| 2026-05-08 16:39 KST | ConfirmedPurchasePrep input builder P0-2 완료 | fixture 3종 PASS, typecheck PASS, VM Cloud SQLite dry-run candidate 467(homepage 438 / npay_actual 29), send_candidate 0, raw member_code 출력 0. Path C 매칭은 운영 member_code/hash 설계 미반영이라 0. 결과: [[../gdn/confirmed-purchase-prep-input-canary-20260508]] |
| 2026-05-08 17:00 KST | paid_click_intent ledger canary T+18h read-only 현재 상태 | VM Cloud SQLite/PM2 read-only. row 694 / unique click id hash 421 / unique ga_session_id 398 / unique client_id 313 / landing 453 / checkout_start 130 / npay_intent 111 / TEST·DEBUG·PREVIEW 0 / status received 694 / latest 2026-05-08 17:00:09 KST. PM2 restart_time 3823 유지, RSS 약 240MB, event loop p95 1.24ms, paid-click-intent 5xx tail count 0. |
| 2026-05-08 17:23 KST | canary effect meaningful dry-run | 운영DB(PostgreSQL) 새 input + live ledger 직접 source를 동일 window로 재생성. PG positive 52 orders(homepage 48 / NPay actual 4, value 12,095,895 KRW), ledger row 709(unique click hash 428, checkout_start 135, npay_intent 113). ledger에는 `member_code_hash`/`order_number`가 없고 PG 주문에는 `client_id`/`ga_session_id`가 없어 order-level effect는 HOLD. 결과: [[../gdn/canary-effect-meaningful-dry-run-20260508]] |
| 2026-05-08 17:38 KST | Path C v2 Green 문서 패킷 작성 | 24h capture health audit packet, backend deploy 승인안 v2, wrapper Preview 승인안, attribution rule v2 작성. 24h 재실행은 capture health 전용이며 confirmed_purchase uplift는 deterministic bridge 전까지 HOLD. 결과: [[../gdn/canary-capture-health-24h-20260508]], [[../gdn/path-c-backend-deploy-approval-v2-20260508]], [[../gdn/path-c-member-code-wrapper-preview-approval-20260508]], [[../gdn/path-c-attribution-rule-v2-20260508]] |
| 2026-05-08 19:21~20:06 KST | TJ 로그인 NPay 클릭 수동 확인 + member_code source 재탐색 | 결제는 하지 않고 NPay 주문/결제 창 도달까지만 확인. 기존 Google Ads/GA4/ChannelTalk NPay 태그가 결제완료 전 발화되는 점 재확인. GTM Default Workspace `147`에서 후보 변수 정의는 확인했지만 200/201/203 값은 empty였다. 추가 source 재탐색에서도 usable client-side source 없음. 결과: [[../gdn/path-c-wrapper-preview-result-20260508]], [[../gdn/path-c-member-code-source-discovery-20260508]] |
| 2026-05-08 20:38 KST | Path B email/phone hash-only fallback 패킷 작성 | Path C source 부재를 반영해 Path B를 회원/비회원 주문 bridge 우선 후보로 승격. raw email/phone은 HTTPS no-send backend에서 transient 처리만 허용하고 저장은 HMAC hash만 허용하는 승인안, schema v2, Preview/no-send HMAC smoke, 1h canary plan, GTM dependency map 작성. 실행은 하지 않음. 결과: [[../gdn/path-b-email-phone-hash-bridge-approval-20260508]], [[../gdn/guest-order-attribution-ledger-design-v2-20260508]], [[../gdn/path-b-email-phone-preview-plan-20260508]], [[../gdn/path-b-order-bridge-canary-plan-20260508]], [[../gdn/gtm-retous-imweb-dependency-map-20260508]] |
| 2026-05-08 23:03 KST | Path B no-send HMAC endpoint 로컬 구현 + Preview tag 초안 | `POST /api/attribution/order-bridge/identity-hmac/no-send` 로컬 초안, email/phone normalize, HMAC, raw echo 0, raw logging 0, no platform send 0 fixture test 작성. 2026-05-08 23:23 KST route-level body 16KB guard와 oversized 413 test까지 보강. `npm --prefix backend run typecheck` PASS, `node --import tsx --test tests/order-bridge-identity-hmac.test.ts` 5 PASS. 운영 deploy/GTM publish 없음. 결과: [[../gdn/path-b-no-send-hmac-local-implementation-20260508]], [[../gdn/path-b-preview-tag-draft-20260508]] |
| 2026-05-08 23:23 KST | Path B 45% → 100% 준비 패킷 작성 | 제한 deploy 승인안, GTM Preview final checklist, order_bridge reliability dry-run 설계 작성. final code diff, secret 주입, CORS/origin/body size/raw logging guard, post-deploy smoke, tunnel smoke 가능성, 100%까지 남은 단계를 정리. backend deploy/schema migration/GTM Production publish/platform send 없음. 결과: [[../gdn/path-b-limited-deploy-approval-20260508]], [[../gdn/path-b-gtm-preview-final-checklist-20260508]], [[../gdn/path-b-order-bridge-reliability-dry-run-design-20260508]] |
| 2026-05-10 01:31 KST | Path B 실제 Google 광고 클릭 주문완료 no-send bridge PASS | 실제 광고 클릭에서 바이오컴 주문완료 화면까지 도달했고 order hash / email identity hash / client-session / click hash가 모두 present. Path B no-send response 200, would_store=false, would_send=false, platform_send_count=0. 가상계좌 미입금이므로 confirmed paid purchase와 Google Ads upload 후보는 아님. 결과: [[../gdn/path-b-real-paid-click-actual-order-preview-result-20260510]] |
| 2026-05-10 01:51 KST | unpaid vbank controlled evidence exclusion guard 작성 | `source_order_status != confirmed` 또는 `payment_method=vbank AND paid_at missing`이면 `block_reason=unpaid_vbank_controlled_evidence`, upload/ROAS 제외, send_candidate=false를 고정. 내일 P0는 builder-level guard 연결. 결과: [[../gdn/unpaid-vbank-controlled-evidence-exclusion-20260510]], [[../gdn/path-b-p0-next-roadmap-20260510]] |
| 2026-05-08 KST | 더클린커피 네이버페이 API 경로 영구 폐기 결정 | 네이버페이 운영팀(이민영) 공식 답변: 더클린커피(`np_cnexi899940`)는 아임웹 호스팅사 제휴 가맹점이라 자체 네이버페이 API 연동/라이센스 발급 구조적 불가. 통합매니저 위임으로도 풀리지 않음. 자사몰 독립몰 신축은 ROI 안 맞음(매출 갭 4% 수준 vs 신축 비용 막대). 더클린커피 NPay 매출은 정본 경로(NPay intent dispatcher v2.1 + Imweb actual order + GTM intent log)로 닫음. 04-23~29 윈도우 기준 Imweb NPay actual 60건 / 2,462,300원 중 42건 / 70% deterministic 매칭 확보. 바이오컴 자사몰 NPay도 동일 정본 경로로 매칭(7일 419 intent / 34 confirmed 중 strong match 10건, 2026-05-05 snapshot에서 30 confirmed / 20 strong match로 개선). 영향: P0 Mode B와 P1 ledger write 의존도 0이라 무영향. [[../data/!coffeedata.md]] Parked 표 / [[../data/!datacheckplan.md]] Phase1·Phase2 액션 / [[../naverapi]] 모두 정본 갱신 완료. 결과: [[../naver/coffee-naverpay-hosting-impact-report-20260508]] |

## Parked / Later

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| Google Ads conversion action 변경 | 자동입찰 학습과 Google Ads 숫자를 바꾸는 Red Lane | BI confirmed_purchase 후보와 click id 보존률이 충분해지고 별도 승인 |
| conversion upload | Google Ads 전환값이 바뀌는 Red Lane | no-send 후보, 중복 guard, click id fill-rate, rollback 문서 PASS |
| GA4/Meta/Google Ads 실제 purchase 전송 | 플랫폼 전환값을 바꾸는 Red Lane | platform별 payload 승인안과 Events/BigQuery 중복 guard PASS |
| Meta funnel CAPI Test Events smoke / GTM Preview wiring | Test Events code가 있어도 실제 Meta 호출과 GTM workspace 수정은 Yellow Lane. 지금 요청 범위는 Green | TJ님이 `test_event_code 필수`, `Production publish 금지`, `6종 각 1회 이하`, `cleanup 조건`을 포함해 Yellow 승인 |
| 운영DB/ledger write | 데이터 원장을 바꾸는 Red Lane | minimal ledger write 승인안에서 저장 필드, 보관기간, 삭제/마스킹 기준 승인 |
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
| Google Ads API x VM 원장 read-only 재대조 | local `GET /api/google-ads/dashboard?date_preset=last_30d` + VM Cloud `crm.sqlite3#attribution_ledger` | 2026-04-07~2026-05-06 KST | 2026-05-07 18:12 KST 조회 성공. Google Ads API fresh, 내부 원장은 VM Cloud same-window source. latestWindowLoggedAt 2026-05-06T14:59:06.844Z | 0.90 |
| AI OS Agent v0 6종 | [[../agent/!aiosagentplan]] + `backend/scripts/aios-agent-runner.ts` | 2026-05-07 KST | PaidClickIntentMonitor / CoffeeData / CampaignMapping / ApprovalQueue / ReportAuditor / ConfirmedPurchasePrep 모두 v0 구현·실행 완료 | 0.88 |
| Google tag gateway POC | [[../GA4/google-tag-gateway-poc-approval-20260507]] | 2026-05-07 KST | 공식 문서 fetch + biocom/coffee CDN read-only 조사. 활성화는 Yellow 승인 후 | 0.85 |
| Meta funnel CAPI GTM-first preview | [[../capivm/meta-funnel-capi-gtm-first-plan-20260508]] + [[../capivm/meta-funnel-capi-test-events-payload-preview-2026-05-08]] | 2026-05-08 KST | Test Events code 수령 확인. 원문은 저장하지 않고 마스킹. no-send payload preview 6종 생성. GTM live v142 / Default Workspace change 0 / conflict 0 read-only 확인. 실제 Meta 호출·GTM Preview·Imweb 수정 없음 | 0.89 |
| paid_click_intent canary T+18 현재 상태 | VM Cloud `crm.sqlite3#paid_click_intent_ledger` read-only SELECT + canary effect dry-run | 2026-05-07 23:01~2026-05-08 17:23 KST | 2026-05-08 17:23 KST 직접 조회. row 709, latest 2026-05-08 17:22:44 KST, status received 709, send_candidate 0, direct order-level effect HOLD | 0.93 |
| ConfirmedPurchasePrep input builder P0-2 | `backend/scripts/confirmed-purchase-prep-input-builder.ts`, [[../gdn/confirmed-purchase-prep-input-canary-20260508]], `data/confirmed-purchase-prep-input-canary-20260508.json` | 2026-05-07~2026-05-08 KST | 2026-05-08 16:39 KST 생성. fixture 3종 PASS, typecheck PASS, candidate 467, send_candidate 0, raw member_code 출력 0 | 0.90 |
| Canary effect meaningful dry-run | `backend/scripts/canary-effect-meaningful-dry-run.ts`, [[../gdn/canary-effect-meaningful-dry-run-20260508]], `data/canary-effect-meaningful-dry-run-20260508.json` | 2026-05-07 23:01~2026-05-08 17:23 KST | 운영DB(PostgreSQL) input은 생성됐지만 live ledger 직접 source는 deterministic 결합키 부재로 effect/uplift 비교 불가. prior click 후보 median 329 / p90 644 | 0.93 |
| 기존 Phase history | [[!total_past]] | 2026-05-04~2026-05-06 누적 | legacy. 실제 실행 순서는 이 문서가 우선 | 0.80 |

## 상세 Sprint 설명

#### Phase4-Sprint6

**이름**: paid_click_intent 수집 개선

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 Google 광고 클릭 ID가 랜딩에서 사라지지 않고 checkout/NPay intent/confirmed purchase 후보까지 이어지게 만드는 것이다. Google Ads confirmed purchase를 만들려면 먼저 `gclid/gbraid/wbraid`가 주문 후보에 남아야 한다.

**현재 진척률**: 전체 기준 96% / Google Ads 실제 전송 기준 0%.

**무엇을 하는가**
- Google 광고 클릭에서 들어온 `gclid/gbraid/wbraid`를 랜딩, checkout, 주문완료 후보까지 보존한다.
- 주문완료 화면에서 order hash, 로그인 identity hash, client/session, click hash가 잡히는지 확인한다.
- NPay 실제 결제완료 주문은 운영DB/admin confirmed source 기준으로 포함하고, `complete_time`/`imweb_status` blank만으로 제외하지 않는다.
- 실제 결제완료가 아닌 주문이나 click-only 신호는 evidence로만 남기고 upload/ROAS 후보에서 제외한다.

**왜 하는가**
- Google Ads ROAS=광고 플랫폼이 주장하는 값은 현재 NPay click/count의 영향을 크게 받는다.
- 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값과 연결하려면 클릭 ID와 주문 후보가 안전하게 이어져야 한다.
- 미입금 가상계좌 주문을 구매로 쓰면 Google Ads 학습과 내부 예산 판단이 동시에 오염된다.

**어떻게 하는가**
1. [Codex] VM Cloud `paid_click_intent_ledger` 수집 건강검진을 24h/72h 기준으로 닫는다.
2. [Codex] Path B order bridge에서 order/email identity/client-session/click hash를 no-send로 검증한다.
3. [Codex] NPay `PAYMENT_COMPLETE`/admin confirmed guard를 ConfirmedPurchasePrep input builder에 연결한다. `complete_time`/`imweb_status` blank는 단독 차단하지 않는다.
4. [Codex] `payment_status != confirmed`, `payment_method=vbank AND paid_at missing`, NPay click/add_payment_info-only를 block rule로 연결한다.
5. [Codex] ConfirmedPurchasePrep / Google Ads upload builder dry-run에서 `send_candidate=false`, `actual_send_candidate=false`, upload 후보 0을 확인한다.
6. [TJ] 실제 결제완료 테스트가 필요하면 별도 승인 후 진행한다. Google Ads upload는 계속 Red HOLD다.

**100% 조건**
- confirmed 결제완료 주문만 구매 후보로 남는다.
- NPay actual confirmed는 운영DB/admin confirmed 기준으로 포함되고, VM Cloud lifecycle blank 때문에 누락되지 않는다.
- 미입금 가상계좌 주문은 `block_reason=unpaid_vbank_controlled_evidence`, `exclude_from_upload=true`, `exclude_from_budget_roas=true`로 막힌다.
- NPay click/count/payment_start/add_payment_info는 purchase로 승격하지 않는다.
- order hash, identity hash, client/session, click hash가 no-send/dry-run evidence에 남는다.
- Google Ads/GA4/Meta/TikTok/Naver 신규 전송은 0건이다.
- Google Ads upload 후보는 Red 승인 전까지 0건이다.
- 결과가 [[#Phase-Sprint 요약표 — 실제 개발 순서 기준]]와 [[#다음 할일 — Auto Green / Approval Needed / Blocked-Parked]]에 같은 진척률로 반영된다.

### Phase4-Sprint6 모니터링 기준시각

이 Sprint에는 **두 개의 시간 기준**이 있다.

1. **Mode B GTM publish 기준**: GTM live version `142` publish 시각은 2026-05-07 00:02 KST다. 이 기준의 T+24h는 2026-05-08 00:02 KST이고 이미 도달했다. T+72h는 2026-05-10 00:02 KST다.
2. **minimal ledger canary 기준**: VM Cloud SQLite `paid_click_intent_ledger` write 시작 시각은 2026-05-07 23:01 KST다. 이 기준의 T+24h는 2026-05-08 23:01 KST다. T+72h는 2026-05-10 23:01 KST다.

24h 전에도 의미 있는 데이터는 모을 수 있다. 다만 지표의 의미가 다르다.

- **조기 판단 가능**: receiver 2xx/5xx, cloudflared 5xx, PM2 restart, RSS/event loop, ledger row 증가속도, `landing/checkout_start/npay_intent` stage 분포, TEST/DEBUG/PREVIEW 차단, PII/value/order/payment 저장 0, no_platform_send 0.
- **24h+ 또는 별도 input 필요**: Google Ads confirmed purchase uplift, 주문별 click id fill-rate 개선, NPay actual attribution, Path C member_code uplift, Google Ads 학습 효과, conversion upload 판단.

2026-05-08 17:23 KST 현재 read-only snapshot:

- canary 경과: ledger write 시작 후 약 18h.
- VM Cloud SQLite `paid_click_intent_ledger`: row 709 / unique click id hash 428 / unique ga_session_id 407 / unique client_id 318.
- stage: landing 461 / checkout_start 135 / npay_intent 113.
- 최신 수신: 2026-05-08 17:22:44 KST.
- guard: TEST/DEBUG/PREVIEW query key row 0, status received 709, send_candidate 0.
- 운영DB(PostgreSQL) 기반 새 input: positive 52 orders(homepage 48 / NPay actual 4), confirmed value 12,095,895 KRW, raw member_code 출력 0.
- effect 판단: live ledger 직접 source는 capture health에는 의미가 있으나, `member_code_hash`/`order_number` 결합키가 없어 confirmed_purchase uplift 비교에는 아직 의미가 없다.
- backend: PM2 `seo-backend` restart_time 3823 유지, pid 439031 유지, RSS 약 240MB, event loop p95 1.24ms.

완료한 것:

- Google Ads 랜딩 세션에는 click id가 대부분 남아 있음을 BigQuery로 확인했다. 최근 7일 기준 6,879개 중 6,724개, 97.75%다.
- 운영 결제완료 주문 기준 click id가 5/623건 수준으로 낮아지는 병목을 분리했다.
- `att.ainativeos.net` backend에 no-write receiver route를 배포했다.
- TEST/negative smoke를 통과했다.
- GTM live version `142`를 publish했다.
- biocom live browser smoke를 통과했다.
- minimal `paid_click_intent` ledger canary 1h PASS 후 24h canary가 진행 중이다.
- P0-2 ConfirmedPurchasePrep input builder 작성/검증을 완료했다. 2026-05-08 16:39 KST 기준 candidate 467건, send_candidate 0, raw member_code 출력 0이다.
- 2026-05-07 18:12 KST Google Ads API x VM Cloud 원장 same-window 재대조에서 플랫폼 ROAS 8.72x, 내부 confirmed ROAS 0.28x, Primary NPay label 분자 사실상 100%를 다시 확인했다.
- 2026-05-10 01:31 KST 실제 Google 광고 클릭에서 주문완료 화면까지 Path B no-send bridge가 PASS했다. order hash, email identity hash, client/session, click hash가 모두 잡혔고 platform send는 0건이다.
- 같은 주문은 가상계좌 미입금이므로 결제완료 구매가 아니며, evidence로만 보관하고 upload/ROAS 후보에서 제외해야 한다.
- 2026-05-10 13:29 KST NPay actual confirmed guard fixture가 PASS했다. `PAYMENT_COMPLETE`/admin confirmed source가 있으면 VM Cloud `complete_time`/`imweb_status` blank만으로 차단하지 않는다. NPay click/add_payment_info-only, pending, controlled evidence는 excluded order로 분리된다.
- 2026-05-10 15:12 KST VM Cloud biocom/thecleancoffee status sync를 1회 완료했다. full order sync는 endpoint 성공이지만 current API total 대비 `synced < totalCount`라 P1 diagnostic으로 분리한다.
- 2026-05-10 15:14 KST 운영DB `PAYMENT_COMPLETE` dry-run에서 결제완료 주문 4건(homepage 3/NPay 1), value 862,000원, send_candidate 0건을 확인했다.

남은 것:

- paid_click_intent 24h/72h 수집 건강검진을 최신 기준으로 갱신한다.
- 운영DB `PAYMENT_COMPLETE` 결과와 VM Cloud bridge row를 같은 ConfirmedPurchasePrep dry-run input으로 묶는다.
- unpaid vbank exclusion guard를 ConfirmedPurchasePrep / Google Ads upload builder dry-run에 연결한다.
- guard PASS 후에도 바로 Google Ads 전송으로 가지 않는다. 먼저 confirmed_purchase input freshness, GA4 already-in-ga4 guard, order-level click id fill-rate를 분리 재측정한다.
- Path C는 Yellow 승인 HOLD다. `member_code`는 직접 PII가 아니더라도 내부 주문/회원 데이터와 결합하면 pseudonymous identifier다. 승인안 v2는 raw 저장 금지, `member_code_hash = HMAC-SHA256(member_code, server_secret)`, wrapper Preview 증거, last eligible paid click 기준을 포함해야 한다.

금지선:

- Google Ads 전환 변경과 conversion upload 금지.
- GA4/Meta/Google Ads/TikTok/Naver 전송 금지.
- 승인 범위 밖 운영DB/ledger write 금지.
- Path C raw member_code 운영 저장 금지. 필요하면 별도 Yellow/Red 승인 후보로 분리.

#### Phase2-Sprint4

**이름**: 채널 배정과 캠페인 매핑

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

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

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

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

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 Google Ads, Meta, GA4가 주장하는 플랫폼 전환값과 내부 confirmed 매출을 섞지 않는 것이다.

완료한 것:

- Google Ads `구매완료` primary가 NPay count/click 계열 value를 크게 만들고 있음을 분리했다.
- Meta 캠페인 mapping에서 강제 배정 위험을 줄였다.
- ontology-lite로 `PlatformConversionClaim != InternalConfirmedRevenue` 원칙을 고정했다.

남은 것:

- Google Ads BI confirmed_purchase 실행안은 click id 보존률 개선 후 재검토.
- 플랫폼 전송 전 no-send guard와 중복 방지 결과를 다시 확인.
- VM Cloud attribution ledger source gap은 해소했다. 남은 병목은 click id 저장률을 올려 confirmed_purchase no-send 후보를 충분히 만드는 것이다.

#### Phase5-Sprint8

**이름**: `/total` 운영 화면

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 운영자가 월별 전체 매출, 채널별 내부 confirmed ROAS, 플랫폼 참고 ROAS, unknown/quarantine를 한 화면에서 보는 것이다.

현재는 design_ready다. 이유는 구현 전 화면에 들어갈 숫자 의미와 금지 문구를 먼저 고정했기 때문이다.

설계 문서: [[total-frontend-current-design-20260507]]

재개 조건:

- Mode B 24h/72h 모니터링 결과.
- minimal paid_click_intent ledger write 여부 결정.
- Phase2 channel assignment rule 안정화.
