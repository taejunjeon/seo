# Naver Ads 광고비 cache source Green 조사

작성 시각: 2026-05-22 00:16 KST
기준일: 2026-05-22
문서 성격: Green 조사 결과 + VM Cloud one-shot sync 실행 기록

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - docurule.md
    - project/!traffic-attribution-current-state-guide-20260521.md
  lane: Green
  allowed_actions:
    - code_audit
    - local_db_read_only
    - vm_cloud_db_read_only
    - vm_cloud_env_presence_check_without_secret_output
    - naver_search_ad_api_read_only_ping
    - naver_search_ad_api_no_write_direct_stats_read
    - collector_dry_run_code_update
    - backend_typecheck
    - approval_packet_draft
  forbidden_actions:
    - vm_cloud_sqlite_write
    - env_file_edit
    - cron_edit
    - backend_deploy
    - naver_ads_state_change
    - ad_platform_send_or_upload
    - operational_db_write
  source_window_freshness_confidence:
    source: local SQLite + VM Cloud SQLite + VM Cloud env presence + Naver Search Ad API read-only
    window: local cache 2026-05-06~2026-05-12, direct API 2026-05-14~2026-05-20
    freshness: 2026-05-22 00:16 KST
    confidence: high
```

## 10초 요약

Naver Ads 광고비 cache는 복구보다 운영 연결이 필요했다. 로컬 Mac에는 2026-05-13에 한 번 수집한 `naver_ads_daily` cache가 있었고, VM Cloud에는 테이블도 없고 Naver Ads API 환경변수도 없고 cron도 없었다.

로컬 Naver Ads API 인증은 현재도 정상이다. 2026-05-14~2026-05-20 no-write 직접 조회에서 37개 캠페인, 259개 일별 row, 광고비 2,062,804원, 클릭 3,524건이 확인됐다.

collector는 이제 기본 실행이 no-write dry-run이다. `--write`를 명시해야만 SQLite upsert가 실행되므로, 승인 전 readiness 확인과 승인 후 one-shot sync를 같은 스크립트로 안전하게 나눌 수 있다.

2026-05-22 00:33 KST에 승인된 VM Cloud one-shot sync를 실행했다. VM Cloud `naver_ads_daily`에 biocom 2026-05-14~2026-05-20 259 rows가 upsert됐고, 공개 API는 `cache_info.status=ready`, 광고비 2,062,804원, 내부 paid_naver 매출 8,002,093원, 내부 real ROAS 3.88로 응답한다.

## 조사 결론

| 판단 | 결론 |
|---|---|
| cache source를 복구해야 하나 | 부분적으로 아니다. 로컬 stale cache 복사는 운영 판단값으로 부적합하다 |
| cache source를 연결해야 하나 | 예. VM Cloud에서 최신 광고비를 읽을 수 있게 연결해야 `/ads/naver`와 Naver ROAS 판단이 의미를 갖는다 |
| 바로 운영 연결 가능한가 | 코드 기반은 있다. VM env, write 승인, sync 실행 방식, cron 주기가 아직 없다 |
| 가장 먼저 할 일 | 완료. collector 기본값을 no-write dry-run으로 바꿨고, 승인된 VM one-shot sync까지 실행했다 |

## 확인한 사실

### 1. 로컬에는 과거 cache가 있다

source: 로컬 SQLite `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`
window: 2026-05-06~2026-05-12
freshness: cache `cached_at` max 2026-05-13 13:43:51
confidence: high

| 항목 | 값 |
|---|---:|
| `naver_ads_daily` rows | 259 |
| site | biocom |
| campaigns | 37 |
| spend | 1,698,930원 |
| Naver claim convAmt | 31,501,866원 |

해석: 로컬 cache는 존재하지만 2026-05-13 수집본이다. 현재 예산 판단에 그대로 쓰기에는 source freshness gap이 크다.

### 2. VM Cloud에는 cache table이 없다

source: VM Cloud SQLite read-only
window: 현재 DB schema
freshness: 2026-05-21 23:58 KST
confidence: high

확인한 DB:

- `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`
- `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3`

두 DB 모두 `naver_ads_daily` 테이블이 없었다. 그래서 `/api/ads/naver/campaign-summary`는 500 대신 `cache_info.available=false`로 내려가게 graceful fallback만 적용된 상태다.

### 3. VM Cloud에는 Naver Ads API env가 없다

source: VM Cloud `.env` + `pm2 env 0` presence-only check
freshness: 2026-05-21 23:58 KST
confidence: high

확인 결과:

- `BIOCOM_NAVER_ADS_CUSTOMER_ID`: missing
- `BIOCOM_NAVER_ADS_ACESS`: missing
- `BIOCOM_NAVER_ADS_SECRET_KEY`: missing
- `CRM_LOCAL_DB_PATH`: missing

주의: 현재 코드가 `BIOCOM_NAVER_ADS_ACESS`라는 오타형 env를 읽는다. 운영 연결 전에는 `ACCESS`와 `ACESS`를 둘 다 읽도록 보강하거나, VM env를 현재 코드에 맞춰 `ACESS`로 넣어야 한다. 장기적으로는 양쪽 호환 코드가 더 안전하다.

### 4. VM Cloud에는 Naver Ads sync cron이 없다

source: VM Cloud crontab/find read-only
freshness: 2026-05-21 23:58 KST
confidence: high

`crontab -l`에서 Naver Ads 수집 작업은 발견되지 않았다. VM repo에는 아래 script가 있지만 자동 실행 연결은 없다.

- `backend/scripts/naver-ads-collect-7d-20260513.ts`
- `backend/scripts/naver-ads-ping-20260513.ts`
- `backend/scripts/naver-ads-url-canary-audit-20260514.ts`

### 5. 로컬 API 인증과 최신 광고비 조회는 정상이다

source: Naver Search Ad API read-only direct call
window: 2026-05-14~2026-05-20
freshness: 2026-05-21 23:59 KST
confidence: high

| 항목 | 값 |
|---|---:|
| campaigns total | 37 |
| campaigns ok | 37 |
| campaigns failed | 0 |
| daily rows observed | 259 |
| spend | 2,062,804원 |
| impressions | 156,683 |
| clicks | 3,524 |
| campaigns with spend | 7 |
| Naver claim convAmt | 26,447,934원 |

해석: source 자체는 살아 있다. 문제는 VM Cloud 운영 cache로 연결되지 않은 것이다.

### 6. collector dry-run/readiness 보강 완료

source: 로컬 코드 + Naver Search Ad API read-only + 로컬 SQLite read-only
window: 2026-05-14~2026-05-20
freshness: 2026-05-22 00:16 KST
confidence: high

변경 파일:

- `backend/src/naverAdsClient.ts`
- `backend/scripts/naver-ads-collect-7d-20260513.ts`

보강 내용:

- 기본 실행은 no-write dry-run이다.
- `--write`를 명시해야만 `bootstrapNaverAdsDailyTable()`과 `upsertNaverAdsDaily()`이 실행된다.
- `--dry-run`과 `--write`를 같이 쓰면 즉시 실패한다.
- `--site`, `--since`, `--until`, `--max-campaigns`, `--max-rows`, `--delay-ms`, `--allow-partial-write`, `--json` 옵션을 추가했다.
- `BIOCOM_NAVER_ADS_ACCESS`와 기존 오타형 `BIOCOM_NAVER_ADS_ACESS`를 모두 읽는다.
- dry-run 결과에 `rows_previewed`, `rows_written`, `write_blocked_reason`, `invariants_held`를 명시한다.

검증:

```bash
cd /Users/vibetj/coding/seo/backend
npm run typecheck
npx tsx scripts/naver-ads-collect-7d-20260513.ts --dry-run --since=2026-05-14 --until=2026-05-20 --json
node -e "const Database=require('better-sqlite3'); const db=new Database('data/crm.sqlite3',{readonly:true}); const row=db.prepare(\"SELECT COUNT(*) rows, MAX(cached_at) max_cached, MAX(date) max_date FROM naver_ads_daily WHERE site='biocom'\").get(); console.log(JSON.stringify(row)); db.close();"
```

결과:

- typecheck PASS.
- dry-run PASS: 37 campaigns, failed 0, rows_previewed 259, rows_written 0.
- 최신 7일 API 광고비 preview: 2,062,804원.
- dry-run 후 로컬 `naver_ads_daily`는 rows 259, max_cached 2026-05-13 13:43:51, max_date 2026-05-12로 유지됐다. 즉 DB write 0이 확인됐다.

## 현재 코드 경로

| 이름 | 속성 | 역할 | 현재 상태 |
|---|---|---|---|
| `backend/src/naverAdsClient.ts` | 백엔드 API client | Naver Search Ad API read-only GET 호출 | 로컬 인증 PASS, VM env missing |
| `backend/src/naverAdsLocalDb.ts` | 백엔드 SQLite helper | `naver_ads_daily` 생성/쓰기/요약 | read-only 요약은 table 없으면 empty 가능 |
| `backend/scripts/naver-ads-collect-7d-20260513.ts` | 백엔드 collector/readiness script | 캠페인 stats를 no-write로 preview하고, `--write`일 때만 `naver_ads_daily`에 upsert | 기본 dry-run. VM write는 승인 필요 |
| `/api/ads/naver/campaign-summary` | API endpoint | 광고비 cache와 내부 paid_naver evidence를 같이 보여줌 | VM에서는 cache unavailable |

## 복구/연결 옵션

### 옵션 A. 로컬 stale cache를 VM Cloud로 복사

추천도: 25%

이 방법은 빠르지만 권장하지 않는다. 2026-05-06~2026-05-12 과거 광고비만 VM에 들어가므로 최신 ROAS 판단을 오히려 헷갈리게 만든다. historical reference로만 쓴다면 가능하지만 VM SQLite write가 필요하다.

### 옵션 B. VM Cloud에 Naver Ads read-only sync를 연결

추천도: 92%

권장 경로다. VM Cloud에서 Naver Ads API를 read-only로 읽고 `naver_ads_daily`에 최신 광고비 cache를 쌓는다. 이렇게 해야 `/ads/naver`와 `/api/ads/naver/campaign-summary`가 실제 예산 판단에 쓸 수 있는 광고비를 갖는다.

필요 작업:

1. Naver Ads env를 VM Cloud에 설정한다.
2. 승인 후 one-shot sync를 실행한다.
3. `/api/ads/naver/campaign-summary`에서 `cache_info.available=true`, `last_date_in_cache=2026-05-20`, `rows_in_window>0`을 확인한다.
4. 안정 확인 후 daily cron으로 전환한다.

### 옵션 C. Naver Ads는 로컬만 유지하고 VM Cloud 화면에서는 unavailable 유지

추천도: 40%

안전하지만 목표 달성에는 부족하다. 네이버 paid/organic 분류는 개선되지만 광고비가 0으로 남아 내부 Naver ROAS를 계산할 수 없다.

## 승인 필요 작업 초안

### Yellow/Red 경계

| 작업 | Lane | 이유 |
|---|---|---|
| collector dry-run script 보강 | Green | 로컬 코드 수정과 no-write 검증만 수행 |
| VM env presence check | Green | secret 값 출력 없이 존재 여부만 확인 |
| VM `.env`에 Naver Ads credential 추가 | Red 또는 최소 Yellow+명시승인 | 외부 credential 운영 배치 |
| VM SQLite `naver_ads_daily` one-shot upsert | Yellow | VM Cloud SQLite write |
| daily cron 등록 | Yellow | 자동 운영 수집 연결 |
| Naver Ads API read-only GET | Green 또는 Yellow | read-only지만 운영 VM에서 반복 실행되면 sync 작업 범위 |
| 광고 플랫폼 설정 변경/입찰/전환 upload | Red | 이번 작업 범위 아님 |

### 권장 승인안

스프린트 이름: Naver Ads 광고비 cache VM Cloud one-shot sync

허용 작업:

- VM Cloud에 Naver Ads API read-only env를 설정한다.
- `naver_ads_daily` 테이블을 생성한다.
- biocom site에 대해 2026-05-14~2026-05-20, 최대 37개 캠페인, 최대 259 rows를 upsert한다.
- 실행 후 `/api/ads/naver/campaign-summary?site=biocom&since=2026-05-14&until=2026-05-20` smoke를 수행한다.

금지 작업:

- Naver Ads 광고 상태/입찰/키워드/예산 변경
- Google/Meta/TikTok 전환 upload
- 운영DB write
- GTM/Imweb 변경
- 259 rows 초과 write
- daily cron 등록

성공 기준:

- collector campaigns ok 37, failed 0
- `naver_ads_daily` rows 259 생성 또는 upsert
- `/api/ads/naver/campaign-summary` 200
- `cache_info.available=true`
- `cache_info.last_date_in_cache=2026-05-20`
- `totals.total_spend_krw=2,062,804` 전후
- `internal_real_roas`가 null이 아니거나, paid_naver 내부 매출 0이면 warning이 명확히 표시됨

중단 기준:

- Naver API 401/403
- Naver API 429/rate limit 반복
- rows 예상치 259에서 10% 이상 벗어남
- VM backend API 500
- secret 값 로그 노출

## Auditor verdict

PASS_WITH_NOTES.

Green 조사로 원인은 충분히 좁혔다. 남은 것은 VM Cloud env/write/cron이라는 승인 필요 영역이다. 바로 stale cache 복사로 복구하는 것은 추천하지 않고, write 없는 dry-run 보강 후 제한 one-shot sync로 운영 연결하는 것이 맞다.

## 승인 후 실행 결과: VM Cloud one-shot sync

source: VM Cloud Naver Search Ad API read-only + VM Cloud SQLite write
window: 2026-05-14~2026-05-20
freshness: 2026-05-22 00:33 KST
confidence: high

실행 범위:

- VM Cloud backend 파일 백업: `.deploy-backups/naver-ads-cache-sync-20260522T0027KST`
- 배포 파일:
  - `backend/src/routes/naverAds.ts`
  - `backend/src/naverAdsClient.ts`
  - `backend/scripts/naver-ads-collect-7d-20260513.ts`
- VM Cloud env 추가: Naver Ads credential 4개 presence-only 확인. 값은 문서와 로그에 기록하지 않음.
- VM Cloud SQLite write: `naver_ads_daily` 259 rows upsert.
- backend 재시작: `seo-backend` restart count 4313.
- cron 등록: 하지 않음.
- 광고 플랫폼 상태 변경/전환 upload: 하지 않음.
- 운영DB write: 하지 않음.

one-shot write 결과:

| 항목 | 값 |
|---|---:|
| campaigns total | 37 |
| campaigns success | 37 |
| campaigns failed | 0 |
| rows previewed | 259 |
| rows written | 259 |
| spend | 2,062,804원 |
| impressions | 156,683 |
| clicks | 3,524 |
| Naver claim convAmt | 26,447,934원 |
| Naver claim ROAS | 12.82 |

VM Cloud DB 확인:

| 항목 | 값 |
|---|---:|
| rows | 259 |
| min date | 2026-05-14 |
| max date | 2026-05-20 |
| spend | 2,062,804원 |
| clicks | 3,524 |
| impressions | 156,683 |

공개 API smoke:

| endpoint | status | cache status | rows | spend | 내부 paid_naver 매출 | 내부 real ROAS | 해석 |
|---|---:|---|---:|---:|---:|---:|---|
| `/api/ads/naver/campaign-summary?site=biocom&since=2026-05-14&until=2026-05-20` | 200 | ready | 259 | 2,062,804원 | 8,002,093원 | 3.88 | 최신 7일 기준 사용 가능 |
| `/api/ads/naver/campaign-summary?site=biocom` | 200 | partial_requested_window | 259 | 2,062,804원 | 별도 응답값 참조 | 별도 응답값 참조 | 기본 30일 요청이지만 cache는 2026-05-14부터라 부분 기간임 |

주의:

- default API window는 2026-04-21~2026-05-20이지만 현재 cache는 2026-05-14~2026-05-20만 있다. 그래서 `/api/ads/naver/campaign-summary?site=biocom`은 `partial_requested_window`로 내려간다.
- 7일 기준은 바로 사용할 수 있다. 30일 기준 판단에는 과거 기간 추가 sync가 필요하다.
- 공개 API 응답 시간이 27~34초로 길었다. 광고비 cache 문제라기보다 route 내부의 evidence join이 무겁기 때문으로 보이며, 다음 개선 후보로 분리한다.

## 2026-05-22 추가 실행: 30일 backfill + daily cron

source: VM Cloud Naver Search Ad API read-only + VM Cloud SQLite write + VM Cloud crontab
window: 2026-04-21~2026-05-20
freshness: 2026-05-22 01:22 KST
confidence: high

TJ님이 2026-05-22 01시대에 과거 30일 구간 추가 sync와 daily cron 등록을 승인했다.

완료한 것:

- VM Cloud `naver_ads_daily`에 2026-04-21~2026-05-13 851 rows 추가 upsert.
- VM Cloud 전체 cache가 2026-04-21~2026-05-20, 1,110 rows로 확장.
- default `/api/ads/naver/campaign-summary?site=biocom`이 `partial_requested_window`에서 `ready`로 변경.
- daily cron 등록: 매일 07:20 KST `/home/biocomkr_sns/seo/repo/backend/scripts/naver-ads-daily-sync.sh`.
- 로컬 화면 오류 해결을 위해 로컬 backend 7020을 no-send/no-background 모드로 재기동하고, 로컬 DB도 백업 후 같은 30일 Naver Ads cache를 upsert.

검증값:

| 대상 | cache status | rows | first date | last date | spend | internal real ROAS |
|---|---|---:|---|---|---:|---:|
| VM Cloud default API | ready | 1,110 | 2026-04-21 | 2026-05-20 | 7,276,795원 | 1.7 |
| VM Cloud 7일 API | ready | 259 | 2026-05-14 | 2026-05-20 | 2,062,804원 | 3.88 |
| 로컬 7일 API | ready | 259 | 2026-05-14 | 2026-05-20 | 2,062,804원 | 0.18 |

주의:

- 로컬 `진짜 ROAS`는 로컬 내부 evidence DB 기준이라 VM Cloud와 다를 수 있다. 운영 판단은 VM Cloud 공개 API를 기준으로 봐야 한다.
- 로컬 화면 `http://localhost:7010/ads/naver`는 fetch error 없이 표시되며, 광고비 cache 검증 용도로 사용 가능하다.
- 첫 cron 자동 실행은 2026-05-22 07:20 KST 이후 read-only로 확인해야 한다.

## 다음 할일

### 실제 필요한 작업 순서

1. 7일 기준 Naver ROAS 화면 확인
   - 담당: Codex
   - 이유: one-shot sync로 2026-05-14~2026-05-20 광고비가 채워졌으므로, 화면과 API가 같은 값을 쓰는지 확인한다.
   - 방법: `/ads/naver` 또는 `/api/ads/naver/campaign-summary?site=biocom&since=2026-05-14&until=2026-05-20`에서 spend 2,062,804원, cache status ready를 확인한다.
   - 성공 기준: 화면/API 광고비가 0이 아니고 `cache_info.status=ready`.
   - 실패 시 다음 확인점: frontend가 다른 endpoint/window를 쓰는지 확인한다.
   - 승인 필요 여부: 없음.
   - 의존성: one-shot sync 완료.
   - 추천 점수/자신감: 95%.

2. Naver 30일 판단이 필요하면 2026-04-21~2026-05-13 과거 기간 추가 sync
   - 담당: Codex 실행, TJ님 승인
   - 이유: 현재 기본 30일 API는 앞 23일 광고비가 빠진 `partial_requested_window`라 30일 ROAS가 과소 비용/과대 ROAS로 보일 수 있다.
   - 방법: 먼저 dry-run으로 rows_previewed와 spend를 확인하고, 예상 row 수를 제한한 뒤 VM Cloud SQLite에 추가 upsert한다.
   - 성공 기준: default `/api/ads/naver/campaign-summary?site=biocom`이 `ready`로 바뀌고 `first_date_in_cache <= 2026-04-21`.
   - 실패 시 다음 확인점: Naver API rate limit, 과거 데이터 조회 제한, rows 예상치 초과 여부.
   - 승인 필요 여부: VM Cloud SQLite 추가 write라 승인 필요.
   - 의존성: 1번 확인 후 진행 권장. 독립 실행도 가능.
   - 추천 점수/자신감: 82%.

3. Daily cron 연결 승인안 작성
   - 담당: Codex
   - 이유: one-shot sync는 시간이 지나면 다시 stale이 된다. 매일 전일 기준 최근 7~30일 cache를 갱신해야 화면이 운영 지표가 된다.
   - 방법: `--dry-run` smoke, `--write`, max rows guard, failure alert 기준을 포함한 cron 승인안을 만든다. cron 등록 자체는 승인 전 하지 않는다.
   - 성공 기준: 승인안에 실행 시간, window, max rows, rollback/disable 방법, smoke endpoint가 명확히 들어간다.
   - 실패 시 다음 확인점: API rate limit과 evidence join API latency를 cron 전에 분리한다.
   - 승인 필요 여부: 승인안 작성은 없음, cron 등록은 승인 필요.
   - 의존성: 1번 완료 후.
   - 추천 점수/자신감: 88%.

4. campaign-summary 응답 시간 개선 조사
   - 담당: Codex
   - 이유: smoke에서 27~34초가 걸렸다. Naver Ads cache는 살아났지만 화면 체감이 느리면 운영성이 떨어진다.
   - 방법: route 내부 `runEvidenceJoin` 실행 시간을 분리 측정하고, 필요하면 내부 paid_naver evidence summary cache 또는 optional mode를 설계한다.
   - 성공 기준: API 응답 병목이 광고비 cache인지 evidence join인지 숫자로 분리된다.
   - 실패 시 다음 확인점: monthly evidence script 쿼리 범위, SQLite index, child process startup cost.
   - 승인 필요 여부: read-only 조사와 설계는 없음. 배포가 필요하면 별도 승인.
   - 의존성: 1번과 병렬 가능.
   - 추천 점수/자신감: 78%.
