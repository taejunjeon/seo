# TikTok Marketing Intent Harness Report

작성 시각: 2026-05-02 23:55 KST
기준일: 2026-05-02
상태: VM receiver 배포/smoke 완료, GTM Preview browser smoke 완료, GTM Production publish 전
대상: Biocom TikTok ROAS 정합성 개선
저장 대상: TJ 관리 Attribution VM `att.ainativeos.net` 내부 SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`
운영DB 영향: 없음. 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` write 없음
Auditor verdict: **PASS, Red Lane 금지 유지**
Codex 진행 추천 자신감: **88%**

## 10초 요약

이번 작업의 목적은 TikTok 전체 추적을 GTM으로 옮기는 것이 아니다.

목적은 **TikTok 광고 클릭 intent만 내부 Attribution VM에 저장**하는 것이다. 이 intent는 `strict confirmed`가 아니라 `firstTouch candidate`로만 보며, TikTok 플랫폼이 주장하는 조회 기반 구매는 계속 `platform-only assisted`로 분리한다.

현재 TJ 관리 Attribution VM receiver 배포와 VM smoke는 통과했다. GTM은 Preview용 workspace/tag/trigger 생성, `quick_preview` compile, TJ님 브라우저 Tag Assistant fired, VM POST 201, SQLite ledger row 저장까지 확인했다.

브라우저 DevTools Network 필터에는 `marketing-intent`가 보이지 않았지만, VM access log와 원장 저장이 확인됐으므로 요청은 실제 성공했다. 따라서 이 sprint의 Preview smoke는 통과로 본다. Production publish와 같은 브라우저 카드 결제는 계속 별도 승인 대상이다.

## 다음 할일

| 순서 | Lane | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 데이터/DB 위치 | 컨펌 필요 | 자신감 |
|---:|---|---|---|---|---|---|---|---:|
| 1 | Yellow | TJ + Codex | 같은 브라우저 카드 결제 1건 | 클릭 intent가 결제완료의 firstTouch 후보로 이어지는지 확인해야 한다 | Preview smoke 성공 후 별도 승인으로 카드 결제, `payment_success.metadata_json.firstTouch` 확인 | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` | YES, 별도 승인 | 82% |
| 2 | Red | TJ | GTM Production publish 판단 | 운영 전체 트래픽에 영향을 주므로 Preview/결제 검증 후 별도 승인으로 닫아야 한다 | 결과 보고서를 보고 YES/NO 결정 | GTM Production container | YES, 별도 publish 승인 | 70% |

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
| GTM | Biocom GTM container | Preview에서 TikTok intent tag 실행 예정 |

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
| Red Lane | GTM Production publish, TikTok Events API, GA4/Meta/Google 전환 전송, firstTouch strict 승격 | 미실행 | 별도 승인 전 금지 |

요청 기준 재분류:

| 작업 | Lane | TJ 필요 | 이유 |
|---|---|---|---|
| VM receiver deploy + VM smoke | Yellow Lane | YES | 완료. TJ 관리 Attribution VM 배포와 smoke 통과 |
| GTM Preview | Yellow Lane | YES | 완료. Tag Assistant fired, VM POST 201, ledger row 확인 |
| 같은 브라우저 카드 결제 1건 | Yellow Lane | YES | 실제 주문 테스트가 필요하다 |
| GTM Production publish | Red Lane | YES | 운영 전체 트래픽에 영향을 준다 |
| TikTok Events API / GA4/Meta/Google send | Red Lane | YES | 광고 플랫폼 전환값을 바꿀 수 있다 |

## Hard Fail Checks

아래 중 하나라도 발생하면 즉시 중단하고 rollback 또는 publish 금지로 판단한다.

| Hard Fail | 기준 | 조치 |
|---|---|---|
| 운영DB write 발생 | 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`에 write | 즉시 중단. 이번 sprint 범위 밖 |
| GTM Production publish 발생 | Preview가 아닌 Production publish | 즉시 중단. Red Lane 위반 |
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
| 같은 브라우저 카드 결제 | `payment_success.metadata_json.firstTouch.touchpoint=marketing_intent` 확인 | 대기 |
| `/ads/tiktok` 표시 | strict confirmed / firstTouch candidate / platform-only assisted 분리 | 로컬 구현/문구 준비 |

## Changed Files

이번 Marketing Intent 작업 결과로 확인된 변경/산출물은 아래다.

| 파일 | 성격 | 내용 |
|---|---|---|
| `backend/src/routes/attribution.ts` | backend receiver | `/api/attribution/marketing-intent`, origin/site guard, PII reject, rate limit, sanitize, dedupe |
| `tiktok/tiktok_marketing_intent_gtm_v1.md` | GTM 초안 | Custom HTML tag, 500ms~1500ms cookie retry, dedupe key 우선순위, Preview 절차 |
| `tiktok/tiktok_gtm_plan.md` | 설계 문서 | GTM은 TikTok 클릭 intent만 담당하고 Guard/전환 전송은 제외한다고 정리 |
| `tiktok/tiktok_marketing_intent_receiver_readiness.md` | 배포 준비 문서 | VM 배포 전 체크리스트, smoke payload, rollback 기준 |
| `tiktok/!tiktokroasplan.md` | 프로젝트 관리 문서 | GTM/receiver 계획, 다음 할일, gap 해석 반영 |
| `tiktok/tiktok_marketing_intent_harness.md` | harness report | 이번 문서. 승인 판단용 lane/hard fail/success 기준 정리 |

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
| GTM Production publish | 하지 않음 |
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
| Production publish / platform send | 없음 |

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
| Preview 우선 | 문서화 완료 | Production publish 금지 유지 |
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
| GTM Preview 문제 | Preview 종료 또는 tag pause. Production publish 전이므로 운영 영향 없음 |
| VM receiver 문제 | 배포 전 백업본으로 dist/source 복원 후 `pm2 restart seo-backend --update-env` |
| PII/Origin/TikTok evidence guard 실패 | GTM publish 금지, receiver guard 수정 후 재-smoke |
| firstTouch가 strict confirmed에 섞임 | `/ads/tiktok` 계산/API rollback, 후보와 확정 분리 재검증 |
| Purchase Guard 이상 | GTM intent tag 중단. Guard는 아임웹 헤더 코드 별도 점검 |

## 남은 승인 게이트

| Gate | Lane | 승인자 | 승인 전 확인 |
|---|---|---|---|
| VM receiver deploy | Yellow | TJ | 완료 |
| VM smoke | Yellow | Codex | 완료 |
| GTM Preview tag 생성 | Yellow | Codex | 완료. Production publish 아님 |
| 테스트 URL fired/Network/ledger 확인 | Yellow | TJ + Codex | 완료. Network 화면 미표시는 VM 로그/원장으로 대체 확인 |
| 같은 브라우저 카드 결제 1건 | Yellow | TJ | 이번 sprint 범위 밖. Preview 성공 후 별도 승인 |
| GTM Production publish | Red | TJ | 별도 결과 보고 후 별도 승인 |
| TikTok Events API / GA4/Meta/Google send | Red | TJ | 이번 sprint 범위 밖 |

## Next Sprint Approval Request

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
| Auditor verdict | **Yellow Lane ready / Red Lane blocked** |
| 승인 권고 | 다음 sprint `TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke`는 조건부 승인 권고 |
| 자신감 | **88%** |
| 근거 | 로컬 smoke test와 backend receiver guard가 통과했고, GTM draft guard도 문서/코드 초안에 반영됨 |
| 남은 리스크 | VM 배포와 GTM Preview는 아직 미실행. 같은 브라우저 카드 결제 표본도 아직 없음 |
| 금지 유지 | Production publish, Events API, GA4/Meta/Google send, strict 승격, top-level overwrite |
