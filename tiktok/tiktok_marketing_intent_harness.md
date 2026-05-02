# TikTok Marketing Intent Harness Report

작성 시각: 2026-05-03 00:44 KST
기준일: 2026-05-03
상태: VM receiver 배포/smoke 완료, GTM Preview browser smoke 완료, 같은 브라우저 카드 결제 기능 검증 완료, GTM Production publish 완료, 24시간 모니터링 시작
대상: Biocom TikTok ROAS 정합성 개선
저장 대상: TJ 관리 Attribution VM `att.ainativeos.net` 내부 SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`
운영DB 영향: 없음. 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` write 없음
Auditor verdict: **PASS_WITH_NOTES, Red Lane 승인 범위 내 publish 완료**
Codex 진행 추천 자신감: **91%**

## 10초 요약

이번 작업의 목적은 TikTok 전체 추적을 GTM으로 옮기는 것이 아니다.

목적은 **TikTok 광고 클릭 intent만 내부 Attribution VM에 저장**하는 것이다. 이 intent는 `strict confirmed`가 아니라 `firstTouch candidate`로만 보며, TikTok 플랫폼이 주장하는 조회 기반 구매는 계속 `platform-only assisted`로 분리한다.

현재 TJ 관리 Attribution VM receiver 배포와 VM smoke는 통과했다. GTM은 Preview용 workspace/tag/trigger 생성, `quick_preview` compile, TJ님 브라우저 Tag Assistant fired, VM POST 201, SQLite ledger row 저장까지 확인했다.

브라우저 DevTools Network 필터에는 `marketing-intent`가 보이지 않았지만, VM access log와 원장 저장이 확인됐으므로 요청은 실제 성공했다. 따라서 이 sprint의 Preview smoke는 통과로 본다.

2026-05-03 00:10~00:11 KST 같은 브라우저 카드 결제 테스트도 기능상 통과했다. 단, `payment_success.metadata.firstTouch.touchpoint`는 `marketing_intent`가 아니라 더 강한 주문 단서를 가진 `checkout_started`로 저장됐다. 이 결과는 “TikTok 클릭 흔적이 결제완료 후보에 보존된다”는 목적에는 통과지만, 기존 success wording은 `marketing_intent` 고정이 아니라 `marketing_intent 또는 TikTok 근거를 가진 checkout_started`로 조정해야 한다.

추가로 `/ads/tiktok` 로컬 API 기준 이 주문은 `payment_success` top-level에도 TikTok `ttclid`와 UTM이 남아 있어 firstTouch 후보 전용이 아니라 **strict TikTok confirmed 1건 / 11,900원**으로 분류됐다. 결제 직후에는 pending이었지만 2026-05-03 00:23 KST 재조회에서 자동 status sync가 confirmed로 반영됐다.

2026-05-03 00:36 KST에는 TJ님 승인 범위 안에서 GTM Production publish를 완료했다. live version은 `140 / tiktok_marketing_intent_v1_live_20260503`이다. publish 후 테스트 URL은 HTTP 201로 `marketing_intent`를 저장했고, 일반 direct URL은 저장 0건이었다. `/ads/tiktok` 화면도 `오늘` 기간에서 strict confirmed 11,900원, firstTouch 후보 별도, platform-only assisted 문구가 확인됐다.

## 다음 할일

| 순서 | Lane | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 데이터/DB 위치 | 컨펌 필요 | 자신감 |
|---:|---|---|---|---|---|---|---|---:|
| 1 | Green | Codex | 24시간 모니터링 결과 확인 | publish 이후 실제 운영 트래픽에서 direct 방문 오저장, Purchase Guard 이상, unknown release 증가가 없는지 봐야 한다 | 2026-05-04 00:36 KST 전후 `node backend/scripts/tiktok-guard-monitor.cjs --label gtm-publish-24h --windowHours 24 --noNotify --noAppendFetchResult` 실행 후 baseline과 비교 | TJ 관리 Attribution VM `tiktok_pixel_events`, `attribution_ledger` read-only | NO | 90% |
| 2 | Green | Codex | `released_unknown_purchase` warning 2건 원인 추적 | baseline에는 anomaly 0건이지만 unknown release가 2건 있어 반복되면 Guard fail-open 품질을 떨어뜨릴 수 있다 | 주문키 `o20260502a0a035128ba07`, `o202605021bec71044267b`의 payment decision 로그와 Attribution VM event log를 read-only로 대조 | TJ 관리 Attribution VM + 결제 판정 API read-only | NO | 78% |
| 3 | Red | TJ | 추가 GTM Production 변경 금지 유지 | publish는 완료됐지만 추가 tag 수정/새 publish는 별도 운영 영향이다 | GTM에서 다른 workspace를 publish하지 않는다. 새 tag, trigger, conversion send는 별도 승인 문서 후 진행 | GTM Production container | YES, 새 publish 때만 | 100% |

## 목적

이 harness의 목적은 TikTok 광고 클릭 intent를 안전하게 내부 원장에 저장하고, 그 값을 ROAS 판단에서 어디까지 쓸 수 있는지 분리하는 것이다.

핵심 원칙은 세 가지다.

| 원칙 | 의미 |
|---|---|
| 클릭 intent만 저장 | `ttclid`, TikTok UTM, TikTok referrer 중 하나가 있어야 저장한다 |
| 전환 전송 없음 | TikTok Events API, GA4, Meta, Google Ads로 어떤 전환도 보내지 않는다 |
| 후보와 확정 분리 | `marketing_intent`는 firstTouch 후보일 뿐 strict confirmed 매출이 아니다 |

## 데이터/DB 위치

| 구분 | 위치 | 이번 작업에서 하는 일 |
|---|---|---|
| 운영DB | 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` | 실제 주문 상태 검산용. 이번 작업에서 write 없음 |
| TJ 관리 Attribution VM | `att.ainativeos.net` 내부 SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` | `touchpoint=marketing_intent` 저장 대상 |
| 로컬 개발 DB | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | `/ads/tiktok` 로컬 화면과 TikTok Ads 캐시 확인용 |
| GTM | Biocom GTM container | `SEO - TikTok Marketing Intent - v1` live version 140 운영 중 |

## Measurement 구분

| 구분 | 쉬운 뜻 | 내부 ROAS 확정 매출로 사용 | 저장/표시 위치 | 비고 |
|---|---|---|---|---|
| strict confirmed | 결제완료 시점에 TikTok 직접 근거가 있고 주문 상태도 confirmed인 매출 | YES | TJ 관리 Attribution VM `attribution_ledger`, `/ads/tiktok` strict 영역 | 예산 증액 판단의 주 지표 |
| firstTouch candidate | 며칠 전 TikTok 클릭 흔적이 있고 이후 구매가 발생한 후보 | NO, 별도 관찰 | `payment_success.metadata_json.firstTouch`, `/ads/tiktok` 후보 영역 | 7일 window 안에서 보조 판단 |
| platform-only assisted | TikTok Ads가 주장하지만 내부 클릭/주문 근거가 붙지 않은 구매 | NO | `/ads/tiktok` gap 설명 영역 | VTA와 미분류는 여기에 둔다 |

## Lane Classification

| Lane | 허용 범위 | 이번 작업 상태 | 판단 |
|---|---|---|---|
| Green Lane | 로컬 문서/코드 검토, 로컬 임시 SQLite smoke, read-only 분석 | 완료 | 로컬 범위에서는 진행 가능 |
| Yellow Lane | VM receiver deploy + VM smoke, GTM Preview, 같은 브라우저 카드 결제 1건 | VM receiver/smoke 및 GTM Preview smoke 완료, 같은 브라우저 카드 결제 미실행 | 카드 결제는 별도 승인 필요 |
| Red Lane | GTM Production publish, TikTok Events API, GA4/Meta/Google 전환 전송, firstTouch strict 승격 | GTM Production publish만 TJ님 승인 범위 내 완료. 나머지 금지 유지 | 추가 Red 작업은 별도 승인 전 금지 |

요청 기준 재분류:

| 작업 | Lane | TJ 필요 | 이유 |
|---|---|---|---|
| VM receiver deploy + VM smoke | Yellow Lane | YES | 완료. TJ 관리 Attribution VM 배포와 smoke 통과 |
| GTM Preview | Yellow Lane | YES | 완료. Tag Assistant fired, VM POST 201, ledger row 확인 |
| 같은 브라우저 카드 결제 1건 | Yellow Lane | YES | 완료. 실제 주문 테스트 통과, firstTouch source는 `checkout_started` |
| GTM Production publish | Red Lane | YES | 완료. live version `140 / tiktok_marketing_intent_v1_live_20260503` |
| TikTok Events API / GA4/Meta/Google send | Red Lane | YES | 광고 플랫폼 전환값을 바꿀 수 있다 |

## Hard Fail Checks

아래 중 하나라도 발생하면 즉시 중단하고 rollback 또는 publish 금지로 판단한다.

| Hard Fail | 기준 | 조치 |
|---|---|---|
| 운영DB write 발생 | 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`에 write | 즉시 중단. 이번 sprint 범위 밖 |
| 승인 범위 밖 GTM Production 변경 | 이번 승인 tag 외 추가 tag/trigger/publish | 즉시 중단. 별도 Red Lane 승인 필요 |
| 광고 플랫폼 전환 전송 발생 | TikTok Events API, GA4, Meta, Google Ads send | 즉시 중단. Red Lane 위반 |
| PII 저장 | email, phone, name, address 계열 key/value 저장 | receiver reject 확인 후 배포 중단 |
| TikTok 근거 없는 row 저장 | `ttclid`, TikTok UTM, TikTok referrer 없이 저장 | receiver guard 수정 전 publish 금지 |
| biocom 외 origin 저장 | 허용 origin 외 요청 저장 | allowlist 수정 전 publish 금지 |
| `payment_success` top-level attribution 덮어쓰기 | `utmSource`, `ttclid`, source를 firstTouch로 교체 | 즉시 rollback |
| firstTouch 후보를 strict confirmed로 승격 | 후보 매출이 내부 확정 매출에 합산 | 화면/API 계산 rollback |
| VTA/미분류를 내부 confirmed로 승격 | platform-only assisted가 strict로 들어감 | 계산 로직 rollback |
| Purchase Guard 영향 | TikTok pending 차단/confirmed 허용 동작 이상 | GTM 중단. Guard는 별도 점검 |

## Success Criteria

| 단계 | 성공 기준 | 현재 상태 |
|---|---|---|
| Local smoke | 정상 저장, 근거 없음 skip, PII reject, origin reject, site reject, duplicate skip | 통과 |
| VM smoke | `https://att.ainativeos.net/api/attribution/marketing-intent`가 201 또는 duplicate 200 반환 | 통과 |
| VM ledger 확인 | TJ 관리 Attribution VM SQLite에 `touchpoint=marketing_intent` row 생성 | 통과 |
| GTM Preview | `SEO - TikTok Marketing Intent - v1` tag fired, VM POST 201, ledger row | 통과. DevTools Network에는 미표시였으나 VM 로그/원장으로 성공 확인 |
| GTM Production publish sanity | live 테스트 URL 201 또는 duplicate 200, direct URL 저장 0건, ledger row 확인 | 통과. version 140, live 테스트 URL 201, direct URL 저장 0건 |
| 같은 브라우저 카드 결제 | TikTok `marketing_intent`가 같은 브라우저 `checkout_started`와 이어지고, `payment_success` top-level 및 `metadata_json.firstTouch`에 TikTok `ttclid`가 보존됨 | 통과. `/ads/tiktok` 기준 strict confirmed 11,900원, `firstTouch.touchpoint`는 `checkout_started` |
| `/ads/tiktok` 표시 | strict confirmed / firstTouch candidate / platform-only assisted 분리 | 통과. `오늘` 선택 후 strict confirmed 11,900원 확인 |

## Changed Files

이번 Marketing Intent 작업 결과로 확인된 변경/산출물은 아래다.

| 파일 | 성격 | 내용 |
|---|---|---|
| `backend/src/routes/attribution.ts` | backend receiver | `/api/attribution/marketing-intent`, origin/site guard, PII reject, rate limit, sanitize, dedupe |
| `tiktok/tiktok_marketing_intent_gtm_v1.md` | GTM 초안 | Custom HTML tag, 500ms~1500ms cookie retry, dedupe key 우선순위, Preview 절차 |
| `tiktok/tiktok_gtm_plan.md` | 설계 문서 | GTM은 TikTok 클릭 intent만 담당하고 Guard/전환 전송은 제외한다고 정리 |
| `tiktok/tiktok_marketing_intent_receiver_readiness.md` | 배포 준비 문서 | VM 배포 전 체크리스트, smoke payload, rollback 기준 |
| `tiktok/!tiktokroasplan.md` | 프로젝트 관리 문서 | GTM/receiver 계획, 다음 할일, gap 해석 반영 |
| `tiktok/tiktok_marketing_intent_harness.md` | harness report | 이번 문서. publish 후 lane/hard fail/success 기준 정리 |
| `frontend/src/app/ads/tiktok/page.tsx` | 화면 보강 | 2026-05-03 같은 당일 strict confirmed sanity check를 위해 `오늘` quick range 추가 |
| `tiktok/monitoring/ads_tiktok_gtm_publish_20260503_today.png` | 화면 증거 | `/ads/tiktok` 오늘 기간 strict confirmed/firstTouch/platform-only 분리 확인 |

관련 구현 파일:

| 파일 | 역할 |
|---|---|
| `backend/src/attribution.ts` | `marketing_intent` touchpoint와 `payment_success.metadata_json.firstTouch` 연결 |
| `backend/src/attributionLedgerDb.ts` | SQLite 원장에 `touchpoint=marketing_intent` 보존 |
| `backend/src/tiktokRoasComparison.ts` | strict confirmed와 firstTouch 후보를 분리 집계 |
| `frontend/src/app/ads/tiktok/page.tsx` | `/ads/tiktok`에서 strict / candidate / platform-only assisted를 분리 표시 |
| `backend/tests/attribution.test.ts` | attribution receiver와 firstTouch 연결 회귀 테스트 |

## What Was Not Changed

| 항목 | 상태 |
|---|---|
| VM deploy | 완료 |
| GTM Production publish | 완료. TJ님 명시 승인 범위 안에서 version 140 publish |
| TikTok Events API | 사용하지 않음 |
| GA4/Meta/Google send | 전환 전송 없음 |
| 운영DB write | 없음 |
| 개발팀 관리 운영DB schema 변경 | 없음 |
| TikTok Purchase Guard 이동 | 없음. 아임웹 헤더 유지 |
| `payment_success` top-level attribution 덮어쓰기 | 없음 |
| firstTouch candidate를 strict confirmed로 승격 | 없음 |

## Local Smoke Result

로컬 검증은 운영 VM이 아니라 이 노트북에서 임시 source 기반 Express server로 실행했다.

| 항목 | 값 |
|---|---|
| 서버 | `localhost:17020` 임시 서버 |
| DB | `/tmp/tiktok-marketing-intent-smoke-1777726894.sqlite3` 임시 SQLite |
| 운영DB write | 없음 |
| TJ 관리 Attribution VM write | 없음 |
| 기존 `localhost:7020` | 이전 빌드라 route 404. smoke 대상에서 제외 |

| 테스트 | 기대 | 결과 |
|---|---|---|
| TikTok `ttclid` + UTM + referrer | 201 저장 | 통과 |
| TikTok 근거 없음 | 200 skip `no_tiktok_intent_evidence` | 통과 |
| email PII 포함 | 400 `marketing_intent_pii_rejected` | 통과 |
| 비허용 Origin | 403 `origin_not_allowed` | 통과 |
| site=coffee | 403 `site_not_allowed` | 통과 |
| 같은 `ttclid` 재전송 | 200 skip `duplicate_marketing_intent` | 통과 |

빌드/테스트:

| 명령 | 결과 |
|---|---|
| `npm --prefix backend run typecheck` | 통과 |
| `node --import tsx --test tests/attribution.test.ts` | 34/34 통과 |
| `npm --prefix backend run build` | 통과 |
| `node --check backend/dist/attribution.js` | 통과 |
| `node --check backend/dist/routes/attribution.js` | 통과 |
| `node --check backend/dist/tiktokRoasComparison.js` | 통과 |

## VM Smoke Result

상세 결과: `tiktok/tiktok_marketing_intent_vm_deploy_result.md`

| 테스트 | 결과 |
|---|---|
| VM backup | `/home/biocomkr_sns/seo/shared/deploy-backups/20260502_2319_marketing_intent` 생성 |
| VM `/health` | 200 OK |
| CORS preflight | 204, `Access-Control-Allow-Origin: https://biocom.kr`, credentials true |
| valid | 201 저장, `touchpoint=marketing_intent` |
| duplicate | 200 skip `duplicate_marketing_intent` |
| no-evidence | 200 skip `no_tiktok_intent_evidence` |
| PII | 400 `marketing_intent_pii_rejected` |
| bad-origin | 403 `origin_not_allowed` |
| bad-site | 403 `site_not_allowed` |
| GTM workspace/tag | workspace `151`, tag `259`, trigger `256/257/258` 생성 |
| GTM quick preview | `compilerError=false` |
| GTM browser Preview | Tag Assistant에서 `SEO - TikTok Marketing Intent - v1 (Preview)` fired |
| GTM generated VM request | `POST /api/attribution/marketing-intent` 201 |
| GTM generated ledger row | `ttclid=codex_gtm_20260502`, `touchpoint=marketing_intent` |
| 운영DB write | 없음 |
| Production publish / platform send | Preview 단계에서는 없음. 이후 별도 승인으로 GTM Production publish만 완료, platform send는 없음 |

## Same-Browser Card Payment Result

상세 결과: `tiktok/tiktok_marketing_intent_vm_deploy_result.md`

| 항목 | 값 |
|---|---|
| 기준 시각 | 2026-05-03 00:10~00:11 KST |
| 테스트 ttclid | `codex_gtm_card_20260503_001` |
| 주문코드 | `o20260502c0c1ce5d28e95` |
| 주문번호 | `202605035698347` |
| 결제코드 | `pa202605021e7c194894bf2` |
| 결제키 | `iw_bi202605030010599Ht77` |
| 금액 | `11,900 KRW` |

### 확인 결과

| 확인 | 결과 |
|---|---|
| `marketing_intent` 저장 | 통과. `touchpoint=marketing_intent`, `ttclid=codex_gtm_card_20260503_001` |
| `checkout_started` 연결 | 통과. 같은 `ttclid`, 같은 `gaSessionId=1777733386`, 주문번호 보존 |
| `payment_success` 연결 | 통과. 같은 `ttclid`, `metadata.tiktokFirstTouchCandidate=true` |
| `/ads/tiktok` 로컬 API | 통과. 2026-05-03 기준 strict confirmed 11,900원, `strictOverlapRows=1` |
| TikTok Pixel event log | 통과. `purchase_intercepted -> decision_received -> released_confirmed_purchase` |
| 서버 결제 판정 | 통과. `confirmed / allow_purchase / confidence=high / matchedBy=toss_direct_payment_key` |
| 운영DB write | 없음 |
| GTM Production publish | 카드 테스트 당시에는 없음. 이후 별도 승인으로 version 140 publish 완료 |
| TikTok Events API / GA4 / Meta / Google send | 없음 |

### Auditor note

`payment_success.metadata.firstTouch.touchpoint`는 `marketing_intent`가 아니라 `checkout_started`다.

이유는 현재 firstTouch 선택 로직이 후보 점수를 기준으로 고른다. `checkout_started`는 `checkout_id`, `order_id`, `order_id_base`, `ga_session_id`, `client_id`, `user_pseudo_id`가 모두 맞아 `marketing_intent`보다 주문 연결 근거가 강하다. 게다가 `checkout_started` 자체에 TikTok `ttclid`와 `utm_source=tiktok`이 보존되어 있으므로, ROAS 후보 관찰 목적에는 더 안전하다.

이 주문은 firstTouch 후보 전용으로만 남은 것이 아니다. `payment_success` top-level에도 `utmSource=tiktok`, `utmCampaign=codex_gtm_card_test`, `ttclid=codex_gtm_card_20260503_001`가 있어 `/ads/tiktok` strict 계산에 포함된다. 2026-05-03 00:23 KST 재조회 기준 status도 `confirmed`라 confirmed 매출에 합산된다.

Status sync dry-run도 통과했다. `POST /api/attribution/sync-status/toss?dryRun=true`로 주문번호 `202605035698347`만 확인했을 때 `previousStatus=pending`, `nextStatus=confirmed`, `matchType=direct_payment_key`, `writtenRows=0`이었다. 즉 실제 원장 write 없이 “이 주문은 confirmed 승격 대상”임을 확인했다.

이후 자동 status sync가 실제 원장에 반영했다. read-only 재조회 기준 `paymentStatus=confirmed`, `approvedAt=2026-05-02T15:11:24.000Z`다.

## Backend Receiver Guard

| Guard | 구현 상태 | 판정 |
|---|---|---|
| TikTok 근거 재검증 | 완료 | GTM trigger만 믿지 않는다 |
| `ttclid` 우선 | 완료 | 가장 강한 click evidence |
| TikTok UTM 허용 | 완료 | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`에 TikTok 포함 |
| TikTok referrer 허용 | 완료 | UTM 누락 click 후보 보조 |
| site guard | 완료 | `biocom`, `biocom_imweb`만 허용 |
| Origin/Referer allowlist | 완료 | `biocom.kr`, `www.biocom.kr`, `m.biocom.kr`, `biocom.imweb.me` |
| rate limit | 완료 | IP 기준 60초 60건 |
| PII reject | 완료 | email/phone/name/address 계열 key/value reject |
| URL sanitize | 완료 | landing/referrer query는 `ttclid`, UTM만 보존 |
| dedupe priority | 완료 | `ttclid` -> UTM campaign/content/path -> referrer host/path/date |
| top-level attribution 보호 | 완료 | firstTouch가 `payment_success` top-level source/ttclid를 덮지 않음 |

## GTM Draft Guard

| Guard | 구현 상태 | 판정 |
|---|---|---|
| Preview 우선 | 문서화 완료 | Preview 검증 후 TJ님 승인으로 Production publish 완료 |
| TikTok 근거 없으면 skip | 완료 | 브라우저에서도 1차 필터 |
| GA cookie / `_ttp` retry | 완료 | 500ms~1500ms 재시도 |
| localStorage dedupe | 완료 | 24시간 중복 방지 |
| dedupe key 우선순위 | 완료 | `ttclid` -> UTM -> referrer |
| endpoint 고정 | 완료 | `https://att.ainativeos.net/api/attribution/marketing-intent` |
| site payload | 완료 | `site=biocom` |
| 광고 전환 send 없음 | 완료 | 내부 endpoint POST만 수행 |

## Rollback

| 상황 | Rollback |
|---|---|
| GTM live 문제 | GTM live version 140에서 tag `SEO - TikTok Marketing Intent - v1` pause 또는 직전 live version 139로 rollback |
| VM receiver 문제 | 배포 전 백업본으로 dist/source 복원 후 `pm2 restart seo-backend --update-env` |
| PII/Origin/TikTok evidence guard 실패 | GTM tag pause, receiver guard 수정 후 재-smoke |
| firstTouch가 strict confirmed에 섞임 | `/ads/tiktok` 계산/API rollback, 후보와 확정 분리 재검증 |
| Purchase Guard 이상 | GTM intent tag 중단. Guard는 아임웹 헤더 코드 별도 점검 |

## 남은 승인 게이트

| Gate | Lane | 승인자 | 승인 전 확인 |
|---|---|---|---|
| VM receiver deploy | Yellow | TJ | 완료 |
| VM smoke | Yellow | Codex | 완료 |
| GTM Preview tag 생성 | Yellow | Codex | 완료 |
| 테스트 URL fired/Network/ledger 확인 | Yellow | TJ + Codex | 완료. Network 화면 미표시는 VM 로그/원장으로 대체 확인 |
| 같은 브라우저 카드 결제 1건 | Yellow | TJ | 완료. confirmed 반영까지 통과 |
| GTM Production publish | Red | TJ | 완료. version 140 live |
| TikTok Events API / GA4/Meta/Google send | Red | TJ | 이번 sprint 범위 밖 |

## Previous Sprint Approval Record

아래는 2026-05-02에 완료된 `VM Deploy + GTM Preview Smoke` 승인 기록이다. 2026-05-03 GTM Production publish는 위 Current Auditor Verdict와 Production sanity 결과를 기준으로 별도 완료 처리했다.

승인 요청서:

- `tiktok/tiktok_marketing_intent_vm_deploy_approval.md`

이름:

```text
TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke
```

허용:

- VM receiver 배포
- VM smoke test
- GTM Preview tag 생성
- 테스트 URL fired/Network/ledger 확인
- 문서 업데이트
- audit
- commit/push

금지:

- GTM Production publish
- TikTok Events API
- GA4/Meta/Google 전환 전송
- firstTouch를 strict confirmed로 승격
- `payment_success` top-level attribution 덮어쓰기

승인 문구 추천:

```text
TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke sprint를 승인합니다.
승인 범위는 VM receiver 배포, VM smoke, GTM Preview tag 생성, 테스트 URL fired/Network/ledger 확인, 문서 업데이트, audit, commit/push까지입니다.
GTM Production publish, TikTok Events API, GA4/Meta/Google 전환 전송, firstTouch strict confirmed 승격, payment_success top-level attribution 덮어쓰기는 금지합니다.
```

## Auditor Verdict Format

다음 sprint 종료 보고는 아래 형식으로 판단한다.

| 항목 | 작성 기준 |
|---|---|
| Auditor verdict | Green / Yellow / Red 중 현재 판정, 승인 권고 여부, 자신감 % |
| Lane classification | 실행한 작업별 lane, 승인 범위 위반 여부 |
| What changed | 실제 변경 파일, 배포 대상, DB write 위치 |
| What was not changed | VM 외부 영향, GTM publish, 플랫폼 전송, 운영DB write 여부 |
| Smoke result | HTTP 결과, DB row, duplicate, hard fail test |
| Next sprint approval request | 다음 단계 이름, 허용/금지, TJ 필요 액션 |

## Current Auditor Verdict

| 항목 | 판정 |
|---|---|
| Auditor verdict | **PASS_WITH_NOTES / Red Lane approved publish completed** |
| 승인 결과 | GTM Production publish는 TJ님 승인 범위 안에서 완료 |
| 자신감 | **91%** |
| 근거 | VM receiver/smoke, GTM Preview, 같은 브라우저 카드 결제, status sync confirmed 반영, live 테스트 URL 201, direct URL 저장 0건, `/ads/tiktok` 화면 확인 통과 |
| 남은 리스크 | 실제 광고 유입 고객 표본은 계속 누적 관찰 필요. baseline monitor의 `released_unknown_purchase` warning 2건은 별도 read-only 추적 필요 |
| 금지 유지 | TikTok Events API, GA4/Meta/Google send, strict 승격, top-level overwrite, 운영DB write, 추가 GTM publish |
