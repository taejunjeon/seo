# TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke 결과

작성 시각: 2026-05-02 23:50 KST
대상 서버: TJ 관리 Attribution VM `att.ainativeos.net` (`34.64.104.94`)
저장 DB: TJ 관리 Attribution VM SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3#attribution_ledger`
운영DB 영향: 없음. 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` write 없음
GTM container: `accounts/4703003246/containers/13158774`

## Auditor verdict

**PASS_WITH_YELLOW_REMAINING_GATE**

VM receiver 배포와 VM smoke는 통과했다. GTM은 Production publish 없이 Preview용 workspace/tag/trigger 생성과 `quick_preview` compile까지 통과했다.

다만 실제 브라우저 GTM Preview에서 `tag fired -> Network 201/200 -> ledger row` 흐름은 Codex가 로그인된 Tag Assistant 브라우저 세션을 갖고 있지 않아 미완료다. 이 단계는 TJ님 브라우저에서 Preview를 켜고 확인해야 한다.

## Lane classification

| 항목 | Lane | 결과 |
|---|---|---|
| VM receiver deploy | Yellow | 완료 |
| VM smoke / reject smoke / CORS preflight | Yellow | 완료 |
| GTM Preview workspace/tag 생성 | Yellow | 완료 |
| GTM `quick_preview` compile | Yellow | 완료 |
| GTM browser Preview fired 확인 | Yellow | 미완료. TJ 브라우저 세션 필요 |
| 같은 브라우저 카드 결제 테스트 | Yellow | 이번 sprint 범위 밖 |
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
| 같은 브라우저 카드 결제 테스트 | 이번 sprint 범위 밖 |

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
| GTM Preview tag fired 확인 | Tag Assistant Preview는 TJ님 로그인 브라우저 세션이 필요 |
| 브라우저 Network 201/200 확인 | Preview mode가 실제 브라우저에 연결되어야 함 |
| GTM-generated ledger row 확인 | 위 Network 확인 후 가능 |

TJ님이 확인할 테스트 URL:

```text
https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=codex_gtm_test&ttclid=codex_gtm_20260502
```

성공 기준:

| 위치 | 기대값 |
|---|---|
| GTM Preview | `SEO - TikTok Marketing Intent - v1 (Preview)` fired |
| Browser Network | `POST https://att.ainativeos.net/api/attribution/marketing-intent`가 201 또는 duplicate 200 |
| TJ 관리 Attribution VM SQLite | `touchpoint=marketing_intent`, `ttclid=codex_gtm_20260502` row |

## Next action

| 우선순위 | 담당 | 액션 | 왜 하는가 | 어떻게 하는가 | 자신감 |
|---:|---|---|---|---|---:|
| 1 | TJ | GTM Preview 브라우저 smoke | GTM tag가 실제 biocom.kr에서 fired 되는지 최종 확인해야 Production publish 판단이 가능하다 | GTM workspace `151`에서 Preview 실행, 테스트 URL 접속, fired/Network/ledger row 확인 | 86% |
| 2 | Codex | Preview 결과 audit | Preview에서 들어온 row가 guard/dedupe/PII 기준을 만족하는지 확인한다 | TJ가 알려준 `ttclid` 또는 시간대로 Attribution VM SQLite 조회 | 88% |
| 3 | TJ + Codex | 같은 브라우저 카드 결제 별도 승인 | 클릭 intent가 결제완료 firstTouch 후보로 연결되는지 확인한다 | Preview smoke 성공 후 별도 승인으로 카드 결제 1건 진행 | 82% |
| 4 | TJ | GTM Production publish 여부 별도 판단 | 운영 전체 트래픽 영향이 있어 Red Lane으로 분리해야 한다 | VM/Preview/카드 테스트 결과 보고서 기준으로 publish 승인 여부 결정 | 70% |

## Remaining risk

| 리스크 | 설명 | 대응 |
|---|---|---|
| GTM Preview 미완료 | workspace/tag compile만으로는 실제 fired를 보장하지 않는다 | TJ 브라우저 Preview smoke 전 Production publish 금지 |
| `tagFiringOption` 미적용 | GTM API가 `oncePerPage`를 받지 않아 tag에는 별도 firing option이 없다 | Custom HTML 내부 localStorage dedupe와 backend dedupe가 중복 저장을 막는다 |
| VTA는 여전히 미관측 | 조회 기반 구매는 클릭 URL/referrer가 없다 | platform-only assisted로 유지 |
| smoke row 존재 | TJ VM SQLite에 smoke marker row 2건이 남아 있다 | `vm_smoke` marker로 필터 가능. 필요 시 삭제 가능 |
| live traffic 영향 | receiver endpoint는 배포되어 live 요청을 받을 수 있다 | guard가 TikTok 근거/PII/origin/site/source를 재검증한다 |
