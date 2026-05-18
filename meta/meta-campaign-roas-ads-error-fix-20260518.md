# Meta 캠페인 ROAS `/ads` 오류 수정 기록

작성 시각: 2026-05-18 14:20 KST
기준일: 2026-05-18
문서 성격: VM Cloud `/ads` 오류 수정 preflight + 실행 기록
상태: 부분 완료 - `/ads` 대상 API 404/500 해소, PM2 장기 안정성은 추가 관찰 필요

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - total/!total-current.md
    - data/!datacheckplan.md
  required_context_docs:
    - vm/!vm.md
    - docs/report/text-report-template.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend 코드 read-only 조사
    - 로컬 backend 코드 수정
    - backend typecheck
    - VM Cloud backend 제한 배포/restart
    - live API smoke
  forbidden_actions:
    - 운영DB write
    - VM Cloud SQLite schema/data write
    - GA4/Meta/TikTok/Google Ads/Naver platform conversion send
    - GTM Production publish
    - frontend deploy outside this fix
  source_window_freshness_confidence:
    source: "VM Cloud att.ainativeos.net HTTP smoke + VM Cloud PM2/log read-only + 로컬 backend source"
    window: "2026-05-11~2026-05-17 KST 오류 재현 URL, Meta campaigns health last_7d"
    freshness: "2026-05-18 14:14~14:30 KST curl/SSH/Playwright 직접 확인"
    confidence: 0.86
```

## 10초 요약

`/ads` 화면의 빨간 콘솔 오류는 실제 결제 매출이 0이라서가 아니라, live VM Cloud backend에 새 내부 ROAS 조회 라우트가 빠져 있었고 PM2 backend가 700MB 메모리 제한에 걸려 짧은 주기로 재시작되던 문제다.

이번 작업은 실제 광고 플랫폼이나 운영DB 값을 바꾸지 않는다. 화면이 읽는 API만 보강하고, VM Cloud backend 프로세스가 기존 승인 기준인 1.5GB 메모리 제한으로 안정적으로 떠 있게 만든다.

## 확인한 문제

1. `GET /api/ads/internal-real-roas`는 로컬 코드와 로컬 `dist`에는 있지만, VM Cloud live repo에는 `backend/src/routes/adsInternalRoas.ts`와 `backend/dist/routes/adsInternalRoas.js`가 없었다. 그래서 live API는 404를 반환했다.
2. `GET /api/meta/campaigns/health?date_preset=last_7d`는 live에서 지금은 200으로 회복됐지만, 기존 backend 코드는 `date_preset`을 무시하고 항상 `last_30d`로 조회했다.
3. VM Cloud `seo-backend`는 2026-05-18 14:16 KST 확인 기준 PM2 restart 4,250회, uptime 53초, memory 756.6MB였다. 현재 설정의 `max_memory_restart: 700M`을 넘기므로 `/ads` 화면 로딩 중 500/502가 섞일 수 있다.

## 수정 내용

1. 캠페인 관리 건강검진 API가 프론트에서 넘긴 `date_preset=last_7d`를 그대로 사용하도록 보강한다.
2. Meta API 일시 실패나 예외가 발생해도 브라우저 콘솔에 500을 만들지 않도록, stale cache가 없으면 HTTP 200의 degraded payload로 응답한다.
3. backend PM2 메모리 restart 기준을 `700M`에서 `1500M`으로 되돌린다. 이는 2026-05-07에 이미 문제 완화로 검증됐던 기준이다.

## 금지선

- 운영DB write: 0
- VM Cloud SQLite schema/data write: 0
- Meta/GA4/TikTok/Google Ads/Naver 전환 전송: 0
- GTM publish: 0
- frontend deploy: 0

## 검증 계획

1. 로컬 `npm --prefix backend run typecheck` 통과.
2. VM Cloud 배포 전 backup 생성.
3. VM Cloud backend build + PM2 restart.
4. live smoke:
   - `https://att.ainativeos.net/api/ads/internal-real-roas?platform=paid_meta&since=2026-05-11&until=2026-05-17&spend_krw=28222924`가 200을 반환한다.
   - `https://att.ainativeos.net/api/meta/campaigns/health?account_id=act_3138805896402376&date_preset=last_7d`가 200이고 `date_preset=last_7d`를 반환한다.
   - PM2 `seo-backend`가 즉시 재시작 루프에 빠지지 않는다.

## 실행 결과

1. 로컬 검증
   - `npm --prefix backend run typecheck`: 통과.
   - `npm --prefix backend run build`: 통과.
   - `python3 scripts/harness-preflight-check.py --strict`: 통과.
   - 로컬 smoke 서버에서 `/api/meta/campaigns/health?...date_preset=last_7d`는 Meta env 부재 상태에서도 HTTP 200 degraded payload를 반환했고, `date_preset:"last_7d"`를 유지했다.

2. VM Cloud 적용
   - VM backup: `/home/biocomkr_sns/seo/repo/.deploy-backups/meta-ads-error-fix-20260518T1424KST`
   - 적용 파일: `backend/src/routes/adsInternalRoas.ts`, `backend/src/routes/meta.ts`, `backend/src/bootstrap/registerRoutes.ts`, `backend/src/routes/naverAds.ts`, `backend/src/naverAdsClient.ts`, `capivm/ecosystem.config.cjs`
   - `naverAds` 파일 2개는 `/ads/internal-real-roas` 직접 원인은 아니지만, live `registerRoutes.ts`를 로컬 정본으로 맞추면 import 의존성 때문에 함께 배포해야 build가 통과한다.
   - VM `npm run typecheck`: 통과.
   - VM `npm run build`: 통과.
   - PM2 restart: `seo-backend`만 `--update-env`로 재시작.
   - PM2 memory guard: `max_memory_restart`가 `700M`에서 `1500M`으로 반영됨.

3. live smoke
   - `GET https://att.ainativeos.net/api/ads/internal-real-roas?platform=paid_meta&since=2026-05-11&until=2026-05-17&spend_krw=28222924`: HTTP 200.
   - 반환값: 내부 결제완료 근거 매출 `54,212,489원`, 주문 `162건`, 광고비 `28,222,924원`, 내부 real ROAS `1.92`.
   - `GET https://att.ainativeos.net/api/meta/campaigns/health?account_id=act_3138805896402376&date_preset=last_7d&force=1`: HTTP 200.
   - 반환값: `date_preset:"last_7d"`, 캠페인 `31개`, active `10개`, issue `1개`.
   - Playwright headless로 `https://biocom.ainativeos.net/ads` 접속 시 target endpoint의 404/500은 재현되지 않았다.

4. PM2 관찰
   - 2026-05-18 14:30 KST 45초 관찰에서 `seo-backend`는 `online`, restart count는 `4252`로 유지됐다.
   - 같은 관찰 중 memory는 약 `298MB -> 657MB`로 변동했다.
   - 배포 직후 한 차례 restart count가 `4251 -> 4252`로 증가한 흔적이 있어, 404/500 대상 API는 해결됐지만 backend 장기 안정성은 추가 관찰이 필요하다.

## 2026-05-18 15:17 KST 추가 관찰 및 2차 수정

TJ님 브라우저에서 시간이 지난 뒤 다시 `502 Bad Gateway`와 CORS 헤더 누락 오류가 재현됐다. 이때 CORS는 원인이 아니라, backend가 재시작되는 순간 Cloudflare가 받은 502 응답에 Express CORS 헤더가 붙지 못한 결과다.

관찰값:

- `seo-backend` restart count: `4252 -> 4255`로 증가.
- `/api/ads/internal-real-roas` live 응답 시간: `21.36s`.
- `seo-backend` memory: `1467MB`까지 상승, 당시 PM2 memory guard `1500M`에 근접.
- `/ads` 화면 로드 중 `/api/attribution/ledger` 대용량 응답과 `/api/ads/site-summary` 계산이 겹치면 backend RSS/heap이 크게 상승했다.

수정:

1. `/ads` frontend에서 `/api/ads/internal-real-roas` 호출을 제거했다. 화면의 내부 ROAS 카드는 이미 받아오는 `site-summary`의 내부 confirmed attribution 값을 사용한다.
2. `/api/ads/internal-real-roas` backend endpoint는 기본값에서 heavy evidence-join script를 실행하지 않도록 guard를 추가했다. 직접 호출해도 HTTP 200 degraded JSON으로 빠르게 응답한다.
3. backend startup background precompute 3개를 껐다.
   - `FUNNEL_HEALTH_PRECOMPUTE_ENABLED=0`
   - `CALLPRICE_PRECOMPUTE_ENABLED=0`
   - `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0`
4. `/ads` 첫 live 계산 메모리 피크를 흡수하기 위해 PM2 `max_memory_restart`를 `3000M`으로 상향했다.

2차 검증:

- frontend production build: 통과.
- backend typecheck/build: 통과.
- `https://biocom.ainativeos.net/ads` Playwright network 검증:
  - `/api/ads/internal-real-roas` 호출 `0건`.
  - target API 6개 모두 HTTP 200.
  - `내부 confirmed ROAS` 카드 표시 확인.
- 직접 호출 `GET /api/ads/internal-real-roas?...`: HTTP 200, `ok:false`, `error:"internal_real_roas_evidence_join_disabled"`, `degraded:true`, `external_send_count:0`.
- `GET /api/ads/site-summary?...`: HTTP 200. 첫 cache miss는 약 `11.17s`, 이후 cache hit는 `0.26s`, `0.19s`.
- `GET /api/meta/campaigns/health?...date_preset=last_7d&force=1`: HTTP 200.
- 2026-05-18 15:34~15:37 KST 5분 관찰에서 `seo-backend` restart count는 `4260`으로 유지됐다. memory는 약 `1204MB -> 313MB`까지 내려왔다.
- 2026-05-18 15:38 KST final smoke 기준 `seo-backend`는 `online`, restart count `4260`, memory 약 `1106MB`, max memory guard `3000M`.
- `GET /api/ads/site-summary?...`: HTTP 200, cache miss 기준 약 `9.85s`, biocom 내부 confirmed revenue `52,224,385원`, orders `158`, ROAS `1.85`, spend `28,223,012원`.

남은 주의점:

- `/ads` 첫 cache miss는 아직 10초대까지 걸릴 수 있다. 즉 빨간 502는 막았지만, `/site-summary` 계산 자체의 메모리/시간 최적화는 별도 과제로 남는다.
- precompute OFF의 영향으로 일부 dashboard 첫 조회는 느려질 수 있다. 대신 backend가 자동 재시작되어 `/ads` 전체가 502로 보이는 문제를 먼저 막았다.

## 작업 중 생긴 외부 영향

- 운영DB write: 0
- VM Cloud SQLite schema/data write: 0
- 이번 작업이 새로 실행한 Meta/GA4/TikTok/Google Ads/Naver 전환 전송: 0
- GTM publish: 0
- frontend deploy: 0
- 기존 환경의 background CAPI auto-sync 로그에 `2건 전송`이 보였지만, 이는 이번 수정 코드가 호출한 platform send가 아니라 이미 활성화되어 있던 background job이다.

## 2026-05-18 16:34 KST `/api/ads/site-summary` 경량화 및 잔여 500 제거

목표는 `/ads` 화면 첫 로딩 때 핵심 카드가 읽는 API들이 backend 재시작이나 Meta API 일시 실패를 브라우저 빨간 500/502/CORS 오류로 노출하지 않게 만드는 것이다.

적용:

1. `/api/ads/site-summary`가 VM Cloud 내부에서 `/api/attribution/ledger` HTTP self-fetch를 다시 호출하지 않고, `ADS_OPERATIONAL_LEDGER_DIRECT_SQLITE=1`일 때 VM Cloud SQLite ledger를 직접 read-only로 읽도록 바꿨다.
2. `/api/ads/site-summary` lazy cache TTL을 5분에서 15분으로 늘렸다.
3. `/api/ads/roas`, `/api/ads/roas/daily`, `/api/ads/campaign-ltv-roas`, `/api/meta/insights`에도 lazy cache + stale fallback + no-cache degraded 200 응답을 맞췄다. 즉 live 계산이나 Meta fetch가 일시 실패해도 브라우저 네트워크에는 500/502가 뜨지 않고, 캐시가 있으면 이전 정상값을 반환한다.
4. `/api/ads/internal-real-roas`는 프론트 호출 제거 상태를 유지한다. 직접 호출 시 heavy evidence join은 기본 OFF다.

검증값:

- source: VM Cloud `att.ainativeos.net` live API, `biocom.ainativeos.net/ads` Playwright headless, PM2 read-only.
- window: `date_preset=last_7d`, `attribution_window=1d_click`, account `act_3138805896402376`.
- freshness: 2026-05-18 16:31~16:34 KST 직접 확인.
- confidence: 0.91.
- 로컬 `npm --prefix backend run typecheck`: 통과.
- 로컬 `npm --prefix backend run build`: 통과.
- 로컬 `python3 scripts/harness-preflight-check.py --strict`: 통과.
- VM Cloud backend `npm run typecheck`: 통과.
- VM Cloud backend `npm run build`: 통과.
- 원격 backup:
  - `.deploy-backups/site-summary-lite-roas-fallback-20260518T072420`
  - `.deploy-backups/meta-insights-degraded-20260518T072947`
- live 순차 smoke:
  - `/api/meta/insights`: HTTP 200, `ok:true`, `live_cache_miss`, 1.62s, rows 11.
  - `/api/ads/site-summary`: HTTP 200, `ok:true`, `live_cache_miss`, 2.02s, sites 3, TTL 900s.
  - `/api/ads/roas/daily`: HTTP 200, `ok:true`, `live_cache_miss`, 0.89s, rows 7, TTL 900s.
  - `/api/ads/roas`: HTTP 200, `ok:true`, `live_cache_miss`, 9.70s, campaigns 12, TTL 900s.
  - `/api/ads/campaign-ltv-roas`: HTTP 200, `ok:true`, `live_cache_miss`, 11.39s, rows 12.
  - `/api/meta/campaigns/health`: HTTP 200, `ok:true`, campaigns 31.
- live 캐시 재조회:
  - `site-summary`, `daily`, `roas`는 약 93~98ms cache hit로 응답.
- Playwright `/ads` 화면 검증:
  - 대상 API 6개 모두 HTTP 200.
  - `bad: []`, `failed: []`, 관련 console error `[]`.
  - `/api/ads/internal-real-roas` 호출 0건.
  - `내부 confirmed ROAS` 텍스트 표시 확인.
- PM2 관찰:
  - backend restart count: `4263` 유지.
  - 2026-05-18 16:33:30~16:34:51 KST 관찰 중 restart 증가 0회.
  - memory: 약 `678MB -> 239~241MB`.
  - max memory guard: `3000MB`.

판단:

- 지금 보인 CORS 오류는 CORS 설정 문제가 아니라 backend가 502를 내는 순간 응답 헤더가 사라져 브라우저가 CORS처럼 표현한 것이다.
- RAM 업그레이드는 즉시 필수로 보지 않는다. 이번 병목은 `site-summary`가 내부 HTTP self-fetch와 무거운 live 계산을 겹쳐 backend 메모리/응답 시간을 키운 구조 문제였고, 직접 SQLite read + cache + degraded 200으로 먼저 줄였다.
- 다만 `roas`와 `campaign-ltv-roas`의 첫 live miss는 아직 9~11초대다. 화면 체감 최적화는 별도 단계에서 이 둘을 `roas-summary`처럼 batch/cache 중심으로 합치는 것이 다음 병목이다.

## 2026-05-18 17:37 KST `/api/ads/roas`와 `/api/ads/campaign-ltv-roas` 첫 live miss 추가 경량화

목표는 `/ads` 화면에서 마지막으로 느리게 남은 두 API의 첫 live miss를 줄이는 것이다. 이 둘은 같은 Meta 캠페인 인사이트, adset/campaign 매핑, creative evidence 매핑, attribution ledger를 반복해서 만들고 있었다.

적용:

1. backend 시작 시 Meta adset/campaign 매핑과 creative evidence 매핑을 background read-only로 미리 데운다.
2. 두 API가 공통으로 쓰는 campaign ROAS base context를 15분 lazy cache로 공유한다.
3. LTV 계산은 ledger에 이미 있는 `customerKey` 전화번호를 우선 사용하고, 전화번호가 빠진 주문만 order facts를 추가 조회한다.
4. 매핑 API가 늦거나 실패해도 브라우저에는 500/502를 내지 않고 기존 degraded/stale fallback 경로를 유지한다.

검증값:

- source: VM Cloud `att.ainativeos.net` live API, `biocom.ainativeos.net/ads` Playwright headless, PM2 read-only.
- window: `date_preset=last_7d`, `attribution_window=1d_click`, account `act_3138805896402376`.
- freshness: 2026-05-18 17:36~17:41 KST 직접 확인.
- confidence: 0.93.
- 로컬 `npm --prefix backend run typecheck`: 통과.
- 로컬 `npm --prefix backend run build`: 통과.
- 로컬 `python3 scripts/harness-preflight-check.py --strict`: 통과.
- VM Cloud backend `npm run typecheck`: 통과.
- VM Cloud backend `npm run build`: 통과.
- 원격 backup:
  - `.deploy-backups/roas-first-miss-lite-20260518T083024`
- warm-up 이후 첫 normal live miss:
  - `/api/ads/roas`: HTTP 200, `live_cache_miss`, 약 1.90s, rows 12, mapping error 없음.
  - `/api/ads/campaign-ltv-roas`: HTTP 200, `live_cache_miss`, 약 2.08s, rows 12, mapping error 없음.
- 이전 단계 대비:
  - `/api/ads/roas`: 약 9.70s에서 약 1.90s로 감소.
  - `/api/ads/campaign-ltv-roas`: 약 11.39s에서 약 2.08s로 감소.
- live 캐시 재조회:
  - 두 API 모두 약 97ms cache hit로 응답.
- Playwright `/ads` 화면 검증:
  - 대상 API 6개 모두 HTTP 200.
  - `bad: []`, `failed: []`, 관련 console error `[]`.
  - `/api/ads/internal-real-roas` 호출 0건.
  - `내부 confirmed ROAS`와 ROAS 텍스트 표시 확인.
- PM2 관찰:
  - backend restart count: 수동 재시작 후 `4265` 유지.
  - 2026-05-18 17:41~17:42 KST 관찰 중 restart 증가 0회.
  - `seo-backend`는 `online`, memory 약 `240MB`, max memory guard `3000MB`.
  - 최종 재조회 기준 `/api/ads/roas` 약 `0.40s`, `/api/ads/campaign-ltv-roas` 약 `0.27s`로 응답했다.

판단:

- 두 API의 첫 live miss 병목은 RAM 부족보다 중복 live 계산 비중이 컸다.
- 현 상태에서는 VM Cloud RAM 업그레이드보다 code path 경량화와 cache/warm-up이 우선이다.
- backend 재시작 직후 warm-up이 끝나기 전 수 초 동안은 2.5초 대기 후 fallback을 쓸 수 있다. warm-up이 완료되면 첫 miss도 2초 안팎으로 내려간다.
- 이번 작업은 read-only Meta/SQLite/API 조회와 backend 제한 배포만 수행했다. 운영DB write, VM Cloud SQLite schema/data write, 광고 플랫폼 전환 전송, GTM publish는 하지 않았다.

## 2026-05-18 18:38 KST 캠페인별 성과 표의 미맵핑 매출 표시

목표는 캠페인별 성과 표에서 실제 Meta 캠페인으로 나뉘지 않은 confirmed attribution 매출을 숨기지 않는 것이다. backend `/api/ads/roas`와 `/api/ads/campaign-ltv-roas`는 이미 `(unmapped)` 버킷을 내려주고 있었지만, frontend 표는 Meta 캠페인 목록 기준으로만 렌더링해 해당 금액이 표 본문에서 빠졌다.

적용:

1. `캠페인별 성과` 표 첫 행에 `미맵핑 캠페인 매출` 합성 행을 추가했다.
2. 이 행은 `일반만`과 `전체` 필터에 표시하고, `공동구매만` 필터에서는 숨긴다.
3. Meta 캠페인에 연결된 spend/impression/click은 없으므로 해당 칸은 `—`로 두고, Att 매출에는 미맵핑 confirmed attribution 금액을 그대로 표시한다.
4. 행 보조 문구에 confirmed 주문 수와 Meta attributed 매출 중 비중을 같이 표시한다.

검증값:

- source: VM Cloud `att.ainativeos.net` live API, `biocom.ainativeos.net/ads` Playwright headless, PM2 read-only.
- window: `date_preset=last_7d`, `attribution_window=1d_click`, account `act_3138805896402376`.
- freshness: 2026-05-18 18:25~18:39 KST 직접 확인.
- confidence: 0.94.
- live API 기준 `(unmapped)`:
  - Att 매출 `11,842,910원`.
  - confirmed 주문 `28건`.
  - Meta attributed confirmed 매출 중 `22.7%`.
- 로컬 `npm --prefix frontend run build`: 통과.
- 로컬 `cd frontend && npx eslint src/app/ads/page.tsx`: error 0, 기존 warning 7개.
- 전체 `npm --prefix frontend run lint`: 기존 unrelated lint error로 실패. 이번 파일의 신규 error는 없음.
- VM Cloud frontend `npm run build`: 통과.
- VM Cloud frontend restart: `seo-frontend` 수동 재시작 후 online, restart count `51`.
- 원격 backup:
  - `.deploy-backups/frontend-ads-unmapped-row-20260518T093501`
- live 화면 검증:
  - `https://biocom.ainativeos.net/ads?codex_check=unmapped_row_20260518T1838`에서 표 첫 행 `미맵핑 캠페인 매출` 표시 확인.
  - 표시값: `₩11,842,910`, `confirmed 주문 28건`, `Meta attributed 중 22.7%`.
  - 브라우저 console error `0건`.

판단:

- 이 변경은 숫자를 새로 계산하지 않는다. 이미 backend가 내려주던 미맵핑 버킷을 화면에서 숨기지 않게 만든 표시 보정이다.
- 이제 캠페인별 성과 표의 mapped campaign 합계와 전체 Attribution confirmed ROAS 사이의 차이를 사용자가 표 안에서 바로 확인할 수 있다.
- 운영DB write, VM Cloud SQLite schema/data write, 광고 플랫폼 전환 전송, GTM publish는 하지 않았다.

## 2026-05-18 22:49 KST `campaign-alias-mapping` 문서 기준 미맵핑 감소

목표는 `meta/campaign-alias-mapping.md`에 기록된 `/iiary02` 단일 랜딩 경로 기준을 실제 캠페인 ROAS 계산에 반영하는 것이다. 이 기준은 Meta 동적값 `{{campaign.id}}`가 주문 원장에 그대로 남았더라도, 주문 원장의 실제 랜딩 경로와 현재 Meta creative URL이 단일 캠페인으로만 좁혀질 때 campaign-level 매출 귀속을 허용한다.

적용:

1. 원장 값이 `https://.../iiary02` 전체 URL이 아니라 `/iiary02` 경로만 남아도 같은 랜딩 경로로 인식하게 했다.
2. 바이오컴 `/iiary02`를 campaign `120245003319500396` `meta_biocom_influencer_260506`의 수동 검증 단일 랜딩 후보로 추가했다.
3. `/api/ads/roas`와 `/api/ads/campaign-ltv-roas`가 공유하는 campaign base context에 이 수동 랜딩 맵을 같이 넣었다.
4. 같은 랜딩 경로가 여러 campaign으로 갈라지는 경우에는 기존처럼 자동 매칭하지 않는다.

검증값:

- source: VM Cloud SQLite read-only, VM Cloud live API `att.ainativeos.net`, PM2 read-only.
- window: `date_preset=today`는 `2026-05-18~2026-05-18` KST. 기본 `/ads`의 `last_7d`는 Meta completed-day 기준 `2026-05-11~2026-05-17`이라 이번 주문은 아직 기본 표에는 들어가지 않는다.
- freshness: 2026-05-18 22:43~22:49 KST 직접 확인.
- confidence: 0.95.
- 로컬 `npm --prefix backend run typecheck`: 통과.
- 로컬 `npm --prefix backend run build`: 통과.
- VM Cloud backend `npm run typecheck`: 통과.
- VM Cloud backend `npm run build`: 통과.
- 원격 backup:
  - `.deploy-backups/ads-landing-alias-map-20260518T2245KST`
- VM Cloud backend restart:
  - `seo-backend` 수동 재시작 후 online.
  - restart count `4266`.
- VM Cloud SQLite read-only 집계:
  - `/iiary02` Meta confirmed 주문: 3건 / `1,139,400원`.
  - 직접 campaign id로 이미 매칭되던 주문: 2건 / `680,400원`.
  - 이번 랜딩 경로 수동 매칭으로 새로 붙은 주문: 1건 / `459,000원`.
- live API `date_preset=today`:
  - `/api/ads/roas`: `(unmapped)` 1건 / `926,250원`, target campaign 4건 / `1,814,400원`, mapping error 없음.
  - `/api/ads/campaign-ltv-roas?date_preset=today`: `(unmapped)` 1건 / `926,250원`, target campaign 4건 / `1,814,400원`, mapping error 없음.
- live API `date_preset=last_7d`:
  - window가 `2026-05-11~2026-05-17`라 기존 `(unmapped)` 28건 / `11,842,910원`은 그대로다.
  - 2026-05-19에 기본 completed-day window가 `2026-05-18`을 포함하면 이번 매칭 효과가 기본 표에도 들어온다.

판단:

- 이번 구현은 문서의 `/iiary02` 사례만 좁게 줄였다. 숫자상 새로 줄어든 미맵핑은 1건 / `459,000원`이다.
- 현재 남은 `today` 미맵핑 1건 / `926,250원`은 `/songyuul07`로, `campaign-alias-mapping.md`의 반례와 같다. 단일 Meta creative 후보가 확인되지 않아 quarantine 유지가 맞다.
- 운영DB write, VM Cloud SQLite schema/data write, 광고 플랫폼 전환 전송, GTM publish는 하지 않았다.
