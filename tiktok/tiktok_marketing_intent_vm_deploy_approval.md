# TikTok Marketing Intent Receiver VM Deploy 승인 요청서

정본 link: harness/common/HARNESS_GUIDELINES.md · harness/common/AUTONOMY_POLICY.md · harness/common/REPORTING_TEMPLATE.md (본 문서는 project-local 승인 요청서, 정본 fork 아님)

작성 시각: 2026-05-02 23:06 KST
승인 요청 이름: **TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke**
요청 유형: Yellow Lane 실행 승인
대상 서버: TJ 관리 Attribution VM `att.ainativeos.net`
저장 대상: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`
운영DB 영향: 없음. 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` write 없음
GTM 영향: Preview 생성/검증까지만. Production publish 없음
외부 전환 전송: 없음. TikTok Events API / GA4 / Meta / Google Ads send 없음
max duration: VM 배포/smoke 90분, GTM Preview smoke 60분
max inserts: smoke 목적 `marketing_intent` row 5건 이하
cleanup 조건: GTM Preview tag는 Production publish하지 않음. smoke key/row는 보고서에 기록하고 필요 시 삭제 또는 smoke marker 유지
Codex 진행 추천 자신감: **88%**
실행 결과 문서: `tiktok/tiktok_marketing_intent_vm_deploy_result.md`

## 2026-05-02 실행 결과 요약

Auditor verdict: **PASS_WITH_YELLOW_REMAINING_GATE**

| 항목 | 결과 |
|---|---|
| TJ 관리 Attribution VM receiver 배포 | 완료 |
| VM `/health` | 200 OK |
| VM typecheck/build/node check | 통과 |
| CORS preflight | 204, `Access-Control-Allow-Origin: https://biocom.kr`, credentials true |
| valid smoke | 201, `touchpoint=marketing_intent` 저장 |
| duplicate smoke | 200, `duplicate_marketing_intent` skip |
| no-evidence smoke | 200, `no_tiktok_intent_evidence` skip |
| PII smoke | 400, `marketing_intent_pii_rejected` |
| bad-origin smoke | 403, `origin_not_allowed` |
| bad-site smoke | 403, `site_not_allowed` |
| GTM Preview workspace/tag 생성 | 완료. workspace `151`, tag `259`, trigger `256/257/258` |
| GTM quick preview compile | `compilerError=false` |
| GTM Production publish | 하지 않음 |
| 광고 플랫폼 전환 send | 하지 않음 |
| 개발팀 관리 운영DB write | 하지 않음 |
| GTM browser Preview fired/Network 확인 | 미완료. TJ님 Tag Assistant 브라우저 세션 필요 |

남은 승인 게이트는 **GTM 브라우저 Preview smoke**다. Production publish와 같은 브라우저 카드 결제는 계속 별도 승인 대상이다.

## 한 줄 결론

이 승인은 TikTok 전체 추적을 바꾸는 승인이 아니다.

승인 대상은 **TikTok 광고 클릭 intent를 받을 VM receiver를 배포하고, GTM Preview에서 테스트 URL 1건으로 저장 여부를 확인하는 작업**이다. 이 단계가 끝나도 내부 strict confirmed 매출은 늘어나지 않는다. `marketing_intent`는 firstTouch 후보로만 저장된다.

제 판단은 **승인 권고**다. 이유는 로컬 smoke test와 receiver guard가 통과했고, 운영DB나 광고 플랫폼 전환값을 건드리지 않기 때문이다. 다만 VM 배포와 GTM Preview는 실제 환경에 영향을 줄 수 있으므로 Yellow Lane으로 별도 승인 후 진행한다.

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| receiver 로컬 구현 | 완료 | `backend/src/routes/attribution.ts` | 로컬 코드 |
| TikTok intent guard | 완료 | TikTok 근거, site, origin, PII, rate limit, dedupe guard 구현 | 로컬 코드 |
| GTM tag 초안 | 완료 | `tiktok/tiktok_marketing_intent_gtm_v1.md` | GTM 문서 초안 |
| harness report | 완료 | `tiktok/tiktok_marketing_intent_harness.md` | 문서 |
| readiness 문서 | 완료 | `tiktok/tiktok_marketing_intent_receiver_readiness.md` | 문서 |
| 로컬 smoke test | 통과 | 정상 저장, 근거 없음 skip, PII reject, origin reject, site reject, duplicate skip | 임시 SQLite `/tmp/tiktok-marketing-intent-smoke-1777726894.sqlite3` |

## 프롬프트에 있거나 시도했으나 완료하지 못한 것

| 항목 | 상태 | 못 끝낸 이유 | 다음 판단 |
|---|---|---|---|
| TJ 관리 Attribution VM 배포 | 미실행 | 실행 승인 전 | 이 승인 후 진행 |
| VM smoke test | 미실행 | VM receiver 배포가 선행 조건 | 배포 직후 진행 |
| GTM Preview tag 생성 | 미실행 | VM receiver가 먼저 살아 있어야 Network 201 확인 가능 | VM smoke 후 진행 |
| 같은 브라우저 카드 결제 1건 | 미실행 | GTM Preview와 VM 저장 확인 후 해야 의미 있음 | Preview 성공 후 TJ님과 진행 |
| GTM Production publish | 금지 | Red Lane | 이번 승인 범위 밖 |

## 무엇을 하는가

이번 승인으로 하는 일은 아래 5개다.

| 순서 | 작업 | 설명 |
|---:|---|---|
| 1 | VM receiver 배포 | TJ 관리 Attribution VM backend에 `/api/attribution/marketing-intent` route와 관련 firstTouch 코드를 반영 |
| 2 | VM health/syntax 확인 | PM2 restart 후 `/health`, `node --check`로 서버 정상 여부 확인 |
| 3 | VM smoke test | `ttclid`와 TikTok UTM이 있는 테스트 payload를 보내 `touchpoint=marketing_intent` 저장 확인 |
| 4 | GTM Preview tag 생성 | Production publish 없이 Preview workspace에서 Custom HTML tag를 만든다 |
| 5 | 테스트 URL 확인 | 테스트 URL에서 tag fired, Network 201 또는 duplicate 200, VM ledger row를 확인 |

이번 승인으로 하지 않는 일은 아래다.

| 하지 않는 일 | 이유 |
|---|---|
| GTM Production publish | 운영 전체 트래픽에 영향을 주므로 별도 Red Lane 승인 필요 |
| TikTok Events API | TikTok 전환값을 바꾸는 작업이므로 금지 |
| GA4/Meta/Google 전환 전송 | 외부 광고/분석 플랫폼 전환값을 바꾸므로 금지 |
| firstTouch를 strict confirmed로 승격 | 후보 매출을 확정 매출로 오인할 수 있음 |
| `payment_success` top-level attribution 덮어쓰기 | 기존 attribution 기준이 오염될 수 있음 |
| 개발팀 관리 운영DB write | 이번 작업은 TJ 관리 Attribution VM 보조 원장 작업 |

## Yellow Lane 제한 조건

| 항목 | 제한 |
|---|---|
| max duration | VM 배포/smoke 90분, GTM Preview smoke 60분 |
| max inserts | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`에 smoke 목적 `marketing_intent` row 5건 이하 |
| max traffic | 테스트 URL 수동 접속 중심. 전체 사이트 트래픽 대상 Production publish 없음 |
| cleanup | GTM Preview는 publish하지 않고 종료. 임시 env/window/token을 새로 만들 경우 작업 종료 전 OFF/삭제 확인 |
| smoke marker | `vm_smoke_20260502`처럼 식별 가능한 key 사용. 실제 고객 주문과 섞지 않음 |
| final report | Auditor verdict, no-send/no-write/no-publish/no-platform-send, changed files, smoke 결과, 다음 Lane 분류 포함 |

## 왜 하는가

현재 TikTok ROAS gap의 핵심은 `TikTok 플랫폼 구매값`과 `내부 strict confirmed 0원`이 계속 벌어져 있다는 점이다.

지금 내부 strict 기준은 결제완료 시점에 TikTok 직접 근거가 있어야 한다. 그런데 사용자는 TikTok 광고를 클릭한 뒤 바로 결제하지 않을 수 있다. 예를 들어 TikTok 광고를 보고 상품상세에 들어온 뒤, 다음 날 direct나 검색으로 다시 와서 구매하면 TikTok은 플랫폼 구매로 볼 수 있지만 우리 내부 원장은 TikTok 근거를 잃는다.

이번 receiver는 그 빈틈 중 **클릭 기반 재방문 후보**만 잡는다.

| 구분 | 이번 작업으로 해결 가능 | 설명 |
|---|---|---|
| TikTok 클릭 후 재방문 구매 후보 | 가능 | `ttclid`, TikTok UTM, TikTok referrer를 firstTouch 후보로 저장 |
| TikTok 조회 기반 VTA | 불가 | 클릭 흔적이 없어 내부에서 확정 관측 불가. 계속 platform-only assisted |
| 과거 TikTok Ads 구매 27건 order-level 복원 | 불가 | TikTok Ads 집계 리포트에 `event_id/order_code/order_no`가 없음 |
| 향후 7일 window firstTouch 후보 추적 | 가능 | VM 원장에 `marketing_intent`가 남으면 결제완료와 연결 가능 |

## 데이터가 충분한가

진행 판단에 필요한 자료는 충분하다.

| 판단 항목 | 상태 | 근거 |
|---|---|---|
| receiver guard 안전성 | 충분 | 로컬 smoke에서 저장/skip/reject/duplicate 통과 |
| 운영DB 영향 | 충분 | 작업 대상이 개발팀 관리 PostgreSQL이 아니라 TJ 관리 Attribution VM SQLite임 |
| GTM 범위 | 충분 | Preview 전용이고 Production publish를 금지 범위로 분리 |
| ROAS 해석 기준 | 충분 | strict confirmed / firstTouch candidate / platform-only assisted 분리 완료 |
| 남은 확인 | 있음 | 실제 VM 환경 CORS/PM2/SQLite 경로는 배포 후 smoke로 확인해야 함 |

진행 추천 자신감은 **88%**다. 더 조사할 것보다 실제 VM smoke가 다음 병목이다.

## 어떻게 하는가

### 1. 배포 전 백업

대상은 TJ 관리 Attribution VM이다.

```bash
# VM에서 실행
cd /home/biocomkr_sns/seo
mkdir -p shared/deploy-backups/$(date +%Y%m%d_%H%M%S)_marketing_intent

# dist/source/SQLite 백업 위치는 배포 직전 실제 경로 확인 후 기록
```

백업 대상:

| 대상 | 이유 |
|---|---|
| 현재 backend dist | 문제 시 즉시 이전 서버 코드로 복원 |
| 현재 backend source | diff 확인과 원복 기준 |
| 현재 SQLite `CRM_LOCAL_DB_PATH` | receiver 저장 실패/오염 시 원장 복구 기준 |

### 2. 변경 파일 반영

배포 대상 파일:

| 파일 | 역할 |
|---|---|
| `backend/src/routes/attribution.ts` | `/api/attribution/marketing-intent` receiver와 guard |
| `backend/src/attribution.ts` | `marketing_intent` touchpoint와 `payment_success.metadata_json.firstTouch` 연결 |
| `backend/src/attributionLedgerDb.ts` | SQLite 원장에 `marketing_intent` 보존 |
| `backend/src/tiktokRoasComparison.ts` | strict와 firstTouch 후보 분리 집계 |

이미 로컬에서 확인한 문서/화면 관련 파일은 VM 서버 배포 대상이 아니다.

### 3. 서버 검증

```bash
# VM에서 실행
node --check backend/dist/attribution.js
node --check backend/dist/routes/attribution.js
node --check backend/dist/tiktokRoasComparison.js
pm2 restart seo-backend --update-env
curl -fsS https://att.ainativeos.net/health
```

### 4. VM smoke test

```bash
curl -sS -X POST 'https://att.ainativeos.net/api/attribution/marketing-intent' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://biocom.kr' \
  -H 'Referer: https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=vm_smoke&ttclid=vm_smoke_20260502' \
  --data '{
    "source": "biocom_imweb",
    "site": "biocom",
    "landing": "https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=vm_smoke&ttclid=vm_smoke_20260502",
    "referrer": "https://www.tiktok.com/",
    "utmSource": "tiktok",
    "utmMedium": "paid",
    "utmCampaign": "vm_smoke",
    "ttclid": "vm_smoke_20260502",
    "captureMode": "smoke",
    "metadata": {
      "source": "biocom_imweb",
      "site": "biocom",
      "clientId": "vm-smoke-client",
      "userPseudoId": "vm-smoke-client",
      "ttp": "vm-smoke-ttp"
    }
  }'
```

성공 응답 기준:

| 항목 | 성공 기준 |
|---|---|
| HTTP | 첫 실행 201 또는 중복 실행 200 duplicate |
| touchpoint | `marketing_intent` |
| metadata.intentChannel | `tiktok` |
| metadata.marketingIntentDedupe.tier | `ttclid` |
| metadata.strictTikTokMarketingIntentReasons | 1개 이상 |

### 5. VM ledger 확인

TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`에서 확인한다.

확인할 값:

| 컬럼/필드 | 기대값 |
|---|---|
| `touchpoint` | `marketing_intent` |
| `landing` | `ttclid=vm_smoke_20260502` 포함 |
| `utm_source` 또는 metadata | `tiktok` |
| `ttclid` | `vm_smoke_20260502` |
| `metadata_json.intentChannel` | `tiktok` |

## Backend receiver guard

| Guard | 상태 | 목적 |
|---|---|---|
| TikTok 근거 재검증 | 구현 완료 | GTM trigger만 믿지 않음 |
| `ttclid` / TikTok UTM / TikTok referrer 중 하나 필요 | 구현 완료 | 일반 방문 저장 방지 |
| site allowlist | 구현 완료 | `biocom`, `biocom_imweb`만 허용 |
| Origin/Referer allowlist | 구현 완료 | `biocom.kr`, `www.biocom.kr`, `m.biocom.kr`, `biocom.imweb.me` |
| rate limit | 구현 완료 | IP 기준 60초 60건 |
| PII reject | 구현 완료 | email/phone/name/address 계열 key/value 차단 |
| URL sanitize | 구현 완료 | landing/referrer query는 `ttclid`, UTM만 보존 |
| dedupe priority | 구현 완료 | `ttclid` -> UTM campaign/content/path -> referrer host/path/date |
| top-level attribution 보호 | 구현 완료 | `payment_success`의 source/ttclid를 firstTouch로 덮지 않음 |

## GTM Preview guard

| Guard | 상태 | 목적 |
|---|---|---|
| Production publish 금지 | 이번 승인 범위에 명시 | 운영 트래픽 영향 차단 |
| Custom HTML tag Preview만 생성 | 승인 범위 | fired/Network만 확인 |
| TikTok 근거 없으면 skip | GTM 초안 반영 | 일반 방문 전송 방지 |
| GA cookie / `_ttp` retry | GTM 초안 반영 | 500ms~1500ms 재시도 |
| localStorage dedupe | GTM 초안 반영 | 24시간 중복 전송 방지 |
| 내부 endpoint POST만 수행 | GTM 초안 반영 | 광고 플랫폼 전환 전송 없음 |

## Hard Fail

아래 조건이 하나라도 발생하면 즉시 중단한다.

| Hard Fail | 중단 기준 | 조치 |
|---|---|---|
| VM `/health` 실패 | PM2 restart 후 health 실패 | 이전 dist/source 복원 |
| route 5xx 반복 | smoke 또는 기존 attribution route에서 5xx 발생 | rollback |
| TikTok 근거 없는 payload 저장 | no-evidence payload가 row로 저장 | receiver 수정 전 GTM 중단 |
| PII 저장 | email/phone/name/address 계열 값이 저장 | 즉시 rollback |
| biocom 외 origin 저장 | 허용 origin 외 요청이 저장 | allowlist 수정 전 중단 |
| 운영DB write | 개발팀 관리 PostgreSQL에 write 발생 | 즉시 중단. 승인 범위 위반 |
| GTM Production publish | Preview가 아닌 publish 발생 | 즉시 중단. 승인 범위 위반 |
| 외부 전환 send | TikTok/GA4/Meta/Google 전송 발생 | 즉시 중단. 승인 범위 위반 |
| strict confirmed 오염 | firstTouch 후보가 strict confirmed에 합산 | API/화면 rollback |
| Purchase Guard 영향 | pending 차단/confirmed 허용 동작 이상 | GTM 중단, Guard 별도 점검 |

## Success Criteria

| 단계 | 성공 기준 |
|---|---|
| VM 배포 | PM2 restart 후 `/health` 정상 |
| syntax check | `node --check` 통과 |
| VM smoke 저장 | 첫 요청 201 또는 중복 200 |
| VM ledger row | `touchpoint=marketing_intent` row 확인 |
| duplicate | 같은 `ttclid` 재전송 시 duplicate skip |
| reject | no-evidence / PII / bad origin / bad site payload가 저장되지 않음 |
| GTM Preview | tag fired, Network 201 또는 duplicate 200 |
| 범위 준수 | Production publish, Events API, GA4/Meta/Google send 없음 |
| cleanup | GTM Production publish 없음, 임시 flag/token/window 없음 또는 OFF 확인 |

## Rollback

| 상황 | 되돌리는 방법 |
|---|---|
| VM route 문제 | 배포 직전 백업한 dist/source 복원 후 `pm2 restart seo-backend --update-env` |
| SQLite 오염 | 배포 직전 SQLite 백업 기준으로 해당 smoke row 삭제 또는 DB 복원. 실제 복원 여부는 오염 범위 보고 후 판단 |
| GTM Preview 문제 | Preview 종료 또는 tag 삭제. Production publish 전이므로 운영 영향 없음 |
| `/ads/tiktok` 계산 문제 | strict/candidate 분리 로직 rollback. 외부 전송 없음 |

## 승인 범위

이 승인으로 허용되는 일:

- VM receiver 배포
- VM smoke test
- GTM Preview tag 생성
- 테스트 URL fired/Network/ledger 확인
- 문서 업데이트
- audit
- commit/push

이 승인으로 금지되는 일:

- GTM Production publish
- TikTok Events API
- GA4/Meta/Google 전환 전송
- firstTouch를 strict confirmed로 승격
- `payment_success` top-level attribution 덮어쓰기
- 개발팀 관리 운영DB PostgreSQL write

Yellow Lane 제한:

- max duration: VM 배포/smoke 90분, GTM Preview smoke 60분
- max inserts: smoke 목적 `marketing_intent` row 5건 이하
- cleanup: GTM Preview는 Production publish하지 않고 종료, 임시 flag/token/window가 생기면 OFF/삭제 확인

## 승인 문구

TJ님이 승인하려면 아래 문구 그대로 승인하면 된다.

```text
TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke sprint를 승인합니다.
승인 범위는 VM receiver 배포, VM smoke test, GTM Preview tag 생성, 테스트 URL fired/Network/ledger 확인, 문서 업데이트, audit, commit/push까지입니다.
Yellow Lane 제한은 VM 배포/smoke 90분, GTM Preview smoke 60분, smoke 목적 marketing_intent row 5건 이하입니다.
GTM Production publish, TikTok Events API, GA4/Meta/Google 전환 전송, firstTouch strict confirmed 승격, payment_success top-level attribution 덮어쓰기, 개발팀 관리 운영DB write는 금지합니다.
```

## 승인 후 다음 액션

| 순서 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 자신감 |
|---:|---|---|---|---|---:|
| 1 | Codex | VM 백업/배포 | 실제 receiver가 있어야 GTM Preview가 의미 있다 | 백업 -> 변경 반영 -> node check -> PM2 restart -> health | 88% |
| 2 | Codex | VM smoke | 실제 endpoint/SQLite/CORS 환경 확인 | smoke curl -> VM ledger row 확인 -> duplicate/reject test | 90% |
| 3 | TJ + Codex | GTM Preview | 운영 publish 전 tag fired와 Network 확인 | Preview tag 생성 -> 테스트 URL -> Network 201 -> VM row | 86% |
| 4 | TJ + Codex | 결과 보고 | Production publish 판단 전 증거 고정 | harness 형식으로 완료/미완료/리스크/다음 승인안 기록 | 88% |

## Auditor verdict

| 항목 | 판정 |
|---|---|
| 현재 판정 | Yellow Lane 승인 요청 |
| 승인 권고 | 권고 |
| 자신감 | 88% |
| 근거 | 로컬 smoke 통과, receiver guard 완료, 외부 전환 send 없음, 운영DB write 없음 |
| No-send verified | YES |
| No-write verified | YES, 운영DB write 없음. 승인 후 write 대상은 TJ 관리 Attribution VM smoke row 5건 이하 |
| No-deploy verified | 현재 YES. 승인 후 Yellow 범위 안에서 VM receiver deploy 예정 |
| No-publish verified | YES, GTM Production publish 금지 |
| No-platform-send verified | YES |
| 남은 리스크 | 실제 VM 환경에서 CORS/PM2/SQLite 경로는 배포 후 smoke로만 확인 가능 |
| 결론 | 이 승인 범위는 진행해도 된다. Red Lane 작업은 계속 금지한다 |
