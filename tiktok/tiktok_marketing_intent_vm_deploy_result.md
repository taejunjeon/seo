# TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke 결과

작성 시각: 2026-05-03 00:15 KST
대상 서버: TJ 관리 Attribution VM `att.ainativeos.net` (`34.64.104.94`)
저장 DB: TJ 관리 Attribution VM SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3#attribution_ledger`
운영DB 영향: 없음. 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` write 없음
GTM container: `accounts/4703003246/containers/13158774`

## Auditor verdict

**PASS**

VM receiver 배포와 VM smoke는 통과했다. GTM은 Production publish 없이 Preview용 workspace/tag/trigger 생성, `quick_preview` compile, TJ님 브라우저 Tag Assistant fired, Attribution VM ledger 저장까지 통과했다.

추가로 2026-05-03 00:10~00:11 KST 같은 브라우저 카드 결제 테스트도 기능상 통과했다. TikTok 테스트 클릭 흔적이 `marketing_intent`로 저장됐고, 같은 Chrome 브라우저의 `checkout_started`, `payment_success`, TikTok Pixel event log까지 같은 `ttclid=codex_gtm_card_20260503_001` / `gaSessionId=1777733386` 흐름으로 이어졌다.

단, `payment_success.metadata.firstTouch.touchpoint`는 `marketing_intent`가 아니라 `checkout_started`로 저장됐다. 실패라기보다 현재 매칭 로직이 주문번호, checkout id, GA session, client id가 모두 맞는 더 가까운 `checkout_started`를 우선 선택하기 때문이다.

더 중요한 점은 `payment_success` top-level에도 `ttclid`와 `utm_source=tiktok`이 남았다는 것이다. 그래서 `/ads/tiktok` 로컬 API 기준 이 주문은 단순 firstTouch 후보가 아니라 **strict TikTok pending 11,900원**으로 잡힌다. status sync 후 `confirmed`로 승격되면 내부 strict TikTok confirmed 1건 / 11,900원이 되는 구조다.

브라우저 DevTools Network 필터에서는 `marketing-intent`가 보이지 않았지만, VM 로그와 SQLite 원장에는 같은 시각 `POST /api/attribution/marketing-intent` 201과 `ttclid=codex_gtm_20260502` row가 확인됐다. 따라서 Network 미노출은 요청 실패가 아니라 DevTools 기록/필터 타이밍 이슈로 판단한다.

## Lane classification

| 항목 | Lane | 결과 |
|---|---|---|
| VM receiver deploy | Yellow | 완료 |
| VM smoke / reject smoke / CORS preflight | Yellow | 완료 |
| GTM Preview workspace/tag 생성 | Yellow | 완료 |
| GTM `quick_preview` compile | Yellow | 완료 |
| GTM browser Preview fired 확인 | Yellow | 완료 |
| 같은 브라우저 카드 결제 테스트 | Yellow | 별도 승인 후 완료. 기능상 통과, firstTouch source는 `checkout_started` |
| GTM Production publish | Red | 하지 않음 |
| TikTok Events API / GA4 / Meta / Google send | Red | 하지 않음 |

## What changed

| 구분 | 변경 |
|---|---|
| VM backend | `/api/attribution/marketing-intent` receiver 관련 backend 파일을 TJ 관리 Attribution VM에 반영 |
| VM CORS reject | bad-origin smoke가 500이 아니라 403 `origin_not_allowed`로 떨어지도록 공통 error handler 정리 |
| GTM workspace | `codex_tiktok_marketing_intent_preview_20260502143924` 생성 |
| GTM tag | `SEO - TikTok Marketing Intent - v1 (Preview)` tag 생성 |
| GTM triggers | `ttclid`, TikTok UTM, TikTok referrer Page View trigger 3개 생성 |
| 문서 | 결과 문서와 프로젝트 문서 업데이트 |

VM 백업 위치:

```text
/home/biocomkr_sns/seo/shared/deploy-backups/20260502_2319_marketing_intent
```

GTM 생성 결과:

| 항목 | 값 |
|---|---|
| workspace | `codex_tiktok_marketing_intent_preview_20260502143924` |
| workspace id | `151` |
| tag | `SEO - TikTok Marketing Intent - v1 (Preview)` |
| tag id | `259` |
| trigger ids | `256`, `257`, `258` |
| quick_preview | `compilerError=false` |
| live version | `139 / npay_intent_only_live_20260427` |
| workspace changes | 4개 added, merge conflict 없음 |

## What was not changed

| 금지 항목 | 결과 |
|---|---|
| GTM Production publish | 하지 않음 |
| TikTok Events API | 사용하지 않음 |
| GA4 전환 전송 | 하지 않음 |
| Meta 전환 전송 | 하지 않음 |
| Google Ads 전환 전송 | 하지 않음 |
| firstTouch strict confirmed 승격 | 하지 않음 |
| `payment_success` top-level attribution 덮어쓰기 | 하지 않음 |
| 개발팀 관리 운영DB PostgreSQL write | 하지 않음 |
| 같은 브라우저 카드 결제 테스트 | 별도 승인 후 완료. Production publish 없이 진행 |

## Smoke result

### VM deploy

| 검증 | 결과 |
|---|---|
| PM2 app | `seo-backend` online |
| `/health` | 200 OK |
| VM typecheck/build | 통과 |
| `node --check` | 통과 |
| CORS preflight | 204, `Access-Control-Allow-Origin: https://biocom.kr`, `Access-Control-Allow-Credentials: true` |

### Receiver smoke matrix

| 케이스 | 결과 | 해석 |
|---|---|---|
| valid | HTTP 201 | `touchpoint=marketing_intent` 저장 |
| duplicate | HTTP 200 | 같은 `ttclid` 재전송 시 `duplicate_marketing_intent` skip |
| no-evidence | HTTP 200 | TikTok 근거 없는 payload는 `no_tiktok_intent_evidence` skip |
| PII | HTTP 400 | `metadata.email` 포함 payload는 `marketing_intent_pii_rejected` |
| bad-origin | HTTP 403 | `https://evil.example` origin은 `origin_not_allowed` |
| bad-site | HTTP 403 | `site=coffee`는 `site_not_allowed` |
| bad-source 추가 확인 | HTTP 403 | `source=vm_smoke`는 `source_not_allowed` |

최종 ledger 확인:

| 항목 | 값 |
|---|---|
| entry id | `849db18f10ec955044b00b8b3aa1aacc9a99703592a2e0b5831f7ce52eab5dda` |
| logged_at | `2026-05-02T14:41:51.646Z` |
| touchpoint | `marketing_intent` |
| source | `biocom_imweb` |
| ttclid | `vm_smoke_20260502_1442_final` |
| utm_campaign | `vm_smoke_final` |
| dedupe tier | `ttclid` |
| strict evidence | `landing_ttclid`, `landing_utm_source_tiktok`, `referrer_tiktok`, `ttclid`, `utm_source_tiktok` |

Smoke row cleanup:

| 항목 | 결과 |
|---|---|
| 의도치 않은 smoke row | `utm_campaign=no_tiktok`가 `tiktok` 문자열을 포함해 TikTok UTM 근거로 저장됨 |
| 조치 | 해당 1행 삭제 |
| 삭제 확인 | SQLite `changes() = 1` |
| 남은 smoke row | 2건. `vm_smoke` marker가 있어 실제 주문과 분리 가능 |

## GTM Preview result

완료:

| 항목 | 결과 |
|---|---|
| Preview workspace 생성 | 완료 |
| Custom HTML tag 생성 | 완료 |
| Page View trigger 3개 생성 | 완료 |
| `quick_preview` compile | `compilerError=false` |
| Production publish | 하지 않음 |

미완료:

| 항목 | 이유 |
|---|---|
| 브라우저 DevTools Network 필터 표시 | `marketing-intent` 필터에 요청이 표시되지 않음. VM 로그/원장으로 201 저장을 대체 확인 |

추가 확인 결과:

| 항목 | 결과 |
|---|---|
| Tag Assistant fired | `SEO - TikTok Marketing Intent - v1 (Preview)` 맞춤 HTML 1회 실행 |
| VM access log | `OPTIONS /api/attribution/marketing-intent` 204 후 `POST /api/attribution/marketing-intent` 201 |
| VM ledger row | `touchpoint=marketing_intent`, `ttclid=codex_gtm_20260502` 저장 |
| 저장 시각 | `2026-05-02T14:50:35.095Z` |
| entry id | `0786d941ddce1e0378306f12c0c601ab8e40d28595dba93eba3ab4f7df8d4c21` |
| referrer | `https://tagassistant.google.com/` |
| GA session id | `1777733386` |
| `_ttp` | 수집됨 |

TJ님이 확인할 테스트 URL:

```text
https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=codex_gtm_test&ttclid=codex_gtm_20260502
```

### TJ님 브라우저 확인 체크리스트

이번 확인은 “구매가 잡히는지”가 아니라 **TikTok 광고 클릭 흔적이 내부 Attribution VM 원장에 저장되는지** 보는 테스트다.

따라서 TikTok Pixel Helper에서 Purchase를 찾는 테스트가 아니다. 이 단계에서는 결제도 하지 않고, TikTok/GA4/Meta/Google로 전환을 보내지도 않는다.

#### 1. GTM Preview에서 확인할 것

| 화면 | 무엇을 봐야 하나 | 통과 기준 | 실패면 무슨 뜻인가 |
|---|---|---|---|
| GTM workspace | workspace `codex_tiktok_marketing_intent_preview_20260502143924` 또는 workspace id `151` | 이 workspace에서 Preview 실행 | 다른 workspace를 보면 tag가 안 보일 수 있음 |
| Preview 연결 화면 | 테스트 URL이 `biocom.kr`이고 URL 안에 `ttclid=codex_gtm_20260502`가 있음 | Tag Assistant가 연결됨 | Preview 연결 실패 또는 다른 URL 접속 |
| Tags Fired | `SEO - TikTok Marketing Intent - v1 (Preview)` | Fired 목록에 있음 | trigger 조건이 안 맞거나 Preview workspace가 다름 |
| Tags Not Fired | 위 tag가 여기에만 있음 | 실패 | `ttclid`/TikTok UTM/referrer 조건을 못 읽은 것 |

여기서 Fired가 됐다는 뜻은 “브라우저에서 내부 수집 스크립트가 실행됐다”는 뜻이다. 아직 VM 저장 성공까지 의미하지는 않는다.

#### 2. 브라우저 Network에서 확인할 것

Chrome 개발자도구 Network 탭에서 `marketing-intent`로 검색한다.

| 확인 항목 | 통과 기준 | 뜻 |
|---|---|---|
| 요청 URL | `https://att.ainativeos.net/api/attribution/marketing-intent` | GTM tag가 Attribution VM receiver로 보냈음 |
| Method | `POST` | 실제 저장 요청 |
| Status | `201` 또는 `200` | `201`은 새 row 저장, `200`은 이미 저장된 duplicate라서 정상 skip |
| Payload `site` | `biocom` | 다른 사이트 데이터가 섞이지 않음 |
| Payload `source` | `biocom_imweb` | receiver allowlist 통과 가능한 source |
| Payload `ttclid` | `codex_gtm_20260502` | 테스트 클릭 intent 식별자 |
| Payload에 PII | email/phone/name/address 계열 값이 없어야 함 | PII가 있으면 receiver가 400으로 거절해야 정상 |

실패별 해석:

| Network 결과 | 해석 | 다음 조치 |
|---|---|---|
| 요청 자체가 없음 | tag는 fired 됐지만 JS가 중간에 멈췄거나 브라우저 확장/차단 영향 | Console error 확인 |
| 400 `marketing_intent_pii_rejected` | payload에 email/phone/name/address 계열 값이 들어감 | GTM tag payload에서 해당 값 제거 |
| 403 `origin_not_allowed` | 요청 origin이 biocom 허용 목록이 아님 | Preview URL 또는 origin 확인 |
| 403 `site_not_allowed` | `site` 값이 `biocom`이 아님 | GTM tag payload 확인 |
| 403 `source_not_allowed` | `source` 값이 `biocom_imweb`이 아님 | GTM tag payload 확인 |
| 5xx | VM receiver 장애 가능성 | Production publish 금지, Codex가 VM 로그 확인 |

#### 3. Attribution VM 원장에서 확인할 것

Network가 201 또는 duplicate 200이면, Codex가 TJ 관리 Attribution VM SQLite에서 아래 값을 조회한다.

DB 위치:

```text
/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3#attribution_ledger
```

통과 기준:

| 원장 필드 | 기대값 | 사람이 이해할 의미 |
|---|---|---|
| `touchpoint` | `marketing_intent` | 구매가 아니라 “광고 클릭 흔적”으로 저장됨 |
| `ttclid` | `codex_gtm_20260502` | 이번 Preview 테스트 row를 찾을 수 있음 |
| `source` | `biocom_imweb` | Biocom 아임웹에서 온 내부 수집 row |
| `utm_source` | `tiktok` | TikTok 광고 클릭 근거 |
| `utm_campaign` | `codex_gtm_test` | 이번 테스트 캠페인 marker |
| `metadata_json.intentChannel` | `tiktok` | TikTok intent로 분류됨 |
| `metadata_json.marketingIntentDedupe.tier` | `ttclid` | 가장 강한 클릭 식별자인 ttclid 기준 dedupe |
| `order_id`, `payment_key` | 비어 있음 | 정상. 이 단계는 결제 테스트가 아니라 클릭 intent 테스트임 |

여기까지 통과해야 “GTM Preview가 TikTok 클릭 intent를 내부 Attribution VM에 저장할 수 있다”고 말할 수 있다.

#### 4. 이번 단계에서 보면 안 되는 것

| 보면 안 되는 변화 | 이유 |
|---|---|
| TikTok Purchase 이벤트 추가 전송 | 이번 테스트는 전환 전송이 아니라 내부 intent 저장 |
| GA4/Meta/Google Ads 전환 전송 | 금지 범위 |
| 운영DB PostgreSQL write | 금지 범위 |
| `/ads/tiktok` strict confirmed 증가 | 아직 구매 검증이 아니므로 증가하면 오히려 이상 |
| `payment_success` top-level source 변경 | firstTouch 후보가 기존 attribution을 덮으면 안 됨 |

성공 기준:

| 위치 | 기대값 |
|---|---|
| GTM Preview | `SEO - TikTok Marketing Intent - v1 (Preview)` fired. 통과 |
| Browser Network | DevTools 필터에는 미표시. VM 로그에서 POST 201 확인 |
| TJ 관리 Attribution VM SQLite | `touchpoint=marketing_intent`, `ttclid=codex_gtm_20260502` row. 통과 |

## Same-browser card payment result

목적은 “TikTok 광고 클릭 intent가 같은 브라우저의 실제 카드 결제완료 후보까지 이어지는가”를 확인하는 것이었다.

결론은 **기능상 통과**다. 결제 직후 status는 아직 pending이지만, attribution 기준으로는 `payment_success` top-level에 TikTok `ttclid`와 UTM이 보존되어 strict TikTok pending으로 잡혔다.

### 테스트 식별자

| 항목 | 값 |
|---|---|
| 테스트 URL marker | `utm_campaign=codex_gtm_card_test` |
| 테스트 클릭 ID | `ttclid=codex_gtm_card_20260503_001` |
| 주문코드 | `o20260502c0c1ce5d28e95` |
| 주문번호 | `202605035698347` |
| 결제코드 | `pa202605021e7c194894bf2` |
| 결제키 | `iw_bi202605030010599Ht77` |
| 금액 | `11,900 KRW` |
| 기준 시각 | 2026-05-03 00:10~00:11 KST |

### Attribution VM ledger

데이터 위치: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`

| 흐름 | 저장 시각(UTC) | 결과 |
|---|---|---|
| `marketing_intent` | `2026-05-02T15:10:02.977Z` | `ttclid=codex_gtm_card_20260503_001`, `utm_source=tiktok`, `utm_campaign=codex_gtm_card_test` 저장 |
| `checkout_started` | `2026-05-02T15:10:43.205Z` | 같은 `ttclid`, 같은 `gaSessionId=1777733386`, 주문번호 `202605035698347` 저장 |
| `payment_success` | `2026-05-02T15:11:27.208Z` | 같은 `ttclid`, 같은 `gaSessionId`, `metadata.tiktokFirstTouchCandidate=true` 저장 |

중요한 해석:

- `payment_success.metadata.firstTouch.touchpoint=checkout_started`
- `payment_success.metadata.firstTouch.ttclid=codex_gtm_card_20260503_001`
- `payment_success.metadata.firstTouchMatch.source=checkout_started`
- `matchedBy=checkout_id, order_id, order_id_base, ga_session_id, client_id, user_pseudo_id`
- `matchScore=480`

즉, “마케팅 intent row 자체가 firstTouch source로 선택됐다”는 좁은 기준은 미달이다. 하지만 `checkout_started`가 이미 TikTok `ttclid`를 보존했고 주문 식별자까지 갖고 있어서, 결제완료에는 더 강한 후보로 붙었다. 이 상태는 ROAS 후보 관찰 목적에는 더 안전하다.

또한 `payment_success` 자체가 `utmSource=tiktok`, `utmCampaign=codex_gtm_card_test`, `ttclid=codex_gtm_card_20260503_001`를 갖고 있다. 그래서 `/ads/tiktok` 계산에서는 firstTouch 후보가 아니라 strict TikTok payment_success로 분류된다. 단, 결제 직후 원장 status가 `pending`이라 현재는 `strict pending`이다.

### TikTok pixel event log

데이터 위치: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_pixel_events`

| 항목 | 결과 |
|---|---|
| 총 row | 3 |
| `purchase_intercepted` | 확인 |
| `decision_received` | `confirmed / allow_purchase` |
| `released_confirmed_purchase` | 확인 |
| Pixel 처리 의미 | 서버 판정이 결제완료라 TikTok Purchase를 차단하지 않고 통과시킴 |

### 결제 판정 API

Read-only API:

```text
GET https://att.ainativeos.net/api/attribution/payment-decision?site=biocom&store=biocom&order_code=o20260502c0c1ce5d28e95&order_id=202605035698347-P1&order_no=202605035698347&payment_code=pa202605021e7c194894bf2&payment_key=iw_bi202605030010599Ht77
```

결과:

| 항목 | 값 |
|---|---|
| status | `confirmed` |
| browserAction | `allow_purchase` |
| confidence | `high` |
| matchedBy | `toss_direct_payment_key` |
| reason | `toss_direct_api_status` |

Status sync dry-run:

| 항목 | 값 |
|---|---|
| endpoint | `POST /api/attribution/sync-status/toss?dryRun=true` |
| orderIds | `202605035698347` |
| dryRun | `true` |
| previousStatus | `pending` |
| nextStatus | `confirmed` |
| matchType | `direct_payment_key` |
| action | `updated` preview |
| writtenRows | `0` |
| approvedAt | `2026-05-02T15:11:24.000Z` |

주의:

`payment_success.paymentStatus`는 조회 시점에 아직 `pending`이었다. VM health 기준 `attributionStatusSync.intervalMs=900000`, 즉 15분 주기 자동 sync 구조라서 결제 직후에는 pending으로 보일 수 있다. dry-run은 이 주문이 confirmed 승격 대상임을 보여줬지만, 실제 write는 하지 않았다.

### `/ads/tiktok` local API check

데이터 위치:

- 화면/API: 로컬 개발 서버 `http://localhost:7020/api/ads/tiktok/roas-comparison?start_date=2026-05-03&end_date=2026-05-03`
- 광고비 캐시: 로컬 개발 DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3#tiktok_ads_daily`
- 주문 원장: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`

| 항목 | 결과 |
|---|---|
| 내부 strict confirmed | 0원 |
| 내부 strict pending | 11,900원 |
| firstTouch candidate | 0원 |
| strictOverlapRows | 1 |
| 해석 | 이 주문은 firstTouch 후보 전용이 아니라 strict TikTok pending으로 분류됨 |
| 주의 | 2026-05-03 TikTok Ads 일자 데이터는 아직 없어 플랫폼 비용/구매값은 0으로 보임 |

## Next action

| 우선순위 | 담당 | 액션 | 왜 하는가 | 어떻게 하는가 | 자신감 |
|---:|---|---|---|---|---:|
| 1 | Codex | 자동 status sync 후 원장 재조회 | dry-run은 confirmed 승격 가능을 확인했지만 실제 write는 자동 배치가 해야 한다 | 15분 배치 이후 `orderId=202605035698347`를 read-only ledger API로 다시 확인 | 88% |
| 2 | Codex | `/ads/tiktok` firstTouch 후보 화면 반영 확인 | 결제완료 후보가 strict confirmed와 섞이지 않는지 확인한다 | 로컬 화면과 API에서 firstTouch candidate 영역만 증가하는지 본다 | 84% |
| 3 | TJ | GTM Production publish 여부 별도 판단 | 운영 전체 트래픽 영향이 있어 Red Lane으로 분리해야 한다 | VM/Preview/카드 테스트 결과 보고서 기준으로 publish 승인 여부 결정 | 72% |

## Remaining risk

| 리스크 | 설명 | 대응 |
|---|---|---|
| DevTools Network 미표시 | 실제 POST 201과 ledger row는 확인됐지만 브라우저 Network 필터에는 표시되지 않았다 | 다음 테스트는 DevTools를 먼저 열고 Preserve log ON 후 새 `ttclid`로 재접속하면 화면에서도 확인 가능 |
| `tagFiringOption` 미적용 | GTM API가 `oncePerPage`를 받지 않아 tag에는 별도 firing option이 없다 | Custom HTML 내부 localStorage dedupe와 backend dedupe가 중복 저장을 막는다 |
| VTA는 여전히 미관측 | 조회 기반 구매는 클릭 URL/referrer가 없다 | platform-only assisted로 유지 |
| smoke row 존재 | TJ VM SQLite에 smoke marker row 2건이 남아 있다 | `vm_smoke` marker로 필터 가능. 필요 시 삭제 가능 |
| live traffic 영향 | receiver endpoint는 배포되어 live 요청을 받을 수 있다 | guard가 TikTok 근거/PII/origin/site/source를 재검증한다 |
