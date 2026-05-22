# Naver Ads 광고비 cache daily cron 연결 설계

작성 시각: 2026-05-22 00:50 KST
기준일: 2026-05-22
문서 성격: VM Cloud Naver Ads 광고비 cache 자동 갱신 설계 + 등록 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - docurule.md
    - data/!data_inventory.md
    - project/naver-ads-cache-source-green-audit-20260521.md
  lane: Green_for_design_Yellow_for_cron_registration
  allowed_actions:
    - design_doc
    - approval_packet_draft
    - read_only_api_smoke_reference
    - no_write_dry_run_reference
  forbidden_actions:
    - crontab_edit_without_approval
    - vm_cloud_sqlite_write_without_approval
    - naver_ads_state_change
    - ad_platform_send_or_upload
    - operational_db_write
    - secret_value_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite naver_ads_daily + Naver Search Ad API dry-run + public campaign-summary API
    window: current cache 2026-05-14~2026-05-20, proposed rolling window last_30d ending yesterday KST
    freshness: 2026-05-22 00:50 KST
    confidence: high
```

## 10초 요약

Naver ROAS 화면을 운영 지표로 쓰려면 광고비 cache가 매일 갱신돼야 한다. 현재 VM Cloud에는 2026-05-14~2026-05-20 7일치만 들어가 있어 7일 화면은 쓸 수 있지만, 기본 30일 화면은 `partial_requested_window`다.

권장 cron은 매일 07:20 KST에 최근 30일 광고비를 다시 upsert하는 방식이다. Naver Ads API 호출은 캠페인 37개 기준 37회이며, row 수는 최대 약 1,110개라 daily 운영 부담은 작다.

cron 등록 자체는 VM Cloud 자동 write이므로 Yellow Lane이다. 2026-05-22 01:18 KST에 TJ님 승인 후 crontab 등록까지 완료했다. 첫 자동 실행은 2026-05-22 07:20 KST 예정이다.

## 현재 상태

| 항목 | 값 |
|---|---|
| cache table | VM Cloud SQLite `naver_ads_daily` |
| current cache window | 2026-05-14~2026-05-20 |
| current rows | 259 |
| current spend | 2,062,804원 |
| 7일 API status | `ready` |
| default 30일 API status | `partial_requested_window` |
| cron | 등록 완료, 매일 07:20 KST |
| Naver Ads env | VM Cloud에 presence-only 확인 완료 |

## 설계 목표

1. `/ads/naver` 최근 7일 화면이 매일 전일 기준으로 최신 광고비를 갖게 한다.
2. `/api/ads/naver/campaign-summary?site=biocom` 기본 30일 조회가 `ready` 상태가 되게 한다.
3. Naver Ads 광고 상태, 입찰, 예산, 키워드는 절대 변경하지 않는다.
4. 광고 플랫폼 전송, Google/Meta/TikTok/Naver conversion upload는 하지 않는다.
5. 운영DB에는 쓰지 않는다. VM Cloud SQLite cache에만 upsert한다.

## 권장 cron 방식

### 실행 주기

- 매일 07:20 KST.
- 이유: 전일 광고비/전환 지표가 안정화될 시간을 둔다. 오전 업무 시작 전에 화면이 준비된다.

### 갱신 window

- 최근 30일 rolling window.
- 기준: `since = KST yesterday - 29 days`, `until = KST yesterday`.
- 이유: 매일 최근 7일만 갱신하면 기본 30일 화면이 시간이 지나며 부분 cache가 된다. 30일을 매일 upsert하면 default 화면과 7일 화면을 둘 다 유지할 수 있다.

### 실행 단위

현재 collector는 `--since`, `--until`, `--write`, `--max-rows`, `--json`를 지원한다. cron은 wrapper script를 두고 crontab은 wrapper만 호출하는 방식을 권장한다.

권장 wrapper 경로:

```bash
/home/biocomkr_sns/seo/repo/backend/scripts/naver-ads-daily-sync.sh
```

권장 wrapper 내용:

```bash
#!/usr/bin/env bash
set -euo pipefail

export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
export TZ=Asia/Seoul

cd /home/biocomkr_sns/seo/repo/backend

since="$(date -d '30 days ago' +%F)"
until="$(date -d 'yesterday' +%F)"

npx tsx scripts/naver-ads-collect-7d-20260513.ts \
  --write \
  --site=biocom \
  --since="$since" \
  --until="$until" \
  --max-rows=1200 \
  --json
```

권장 crontab line:

```cron
20 7 * * * /home/biocomkr_sns/seo/repo/backend/scripts/naver-ads-daily-sync.sh >> /home/biocomkr_sns/seo/logs/naver-ads-daily-sync.log 2>&1
```

## 왜 wrapper script가 낫나

crontab 안에서 `date +%F`를 직접 쓰면 `%` escaping 문제가 생긴다. wrapper script로 분리하면 crontab은 짧아지고, 실패 시 수동 재실행도 쉽다.

## 성공 기준

cron 1회 실행 후 아래가 모두 맞아야 한다.

| 검증 | 성공 기준 |
|---|---|
| collector result | `ok=true`, `mode=write`, `failed=0` |
| row guard | `rows_previewed <= 1200`, `write_blocked_reason=null` |
| public API 7일 | `cache_info.status=ready`, `last_date_in_cache=yesterday` |
| public API 30일 | `cache_info.status=ready`, `first_date_in_cache <= requested since` |
| spend | `total_spend_krw > 0` |
| pm2 | `seo-backend online`, 승인 없는 restart 증가 없음 |
| secret | log에 raw credential 없음 |

## 중단 기준

아래 중 하나라도 발생하면 cron 등록을 유지하지 않는다.

- Naver API 401/403.
- Naver API 429 또는 rate limit 반복.
- `rows_previewed > 1200`.
- campaigns failed > 0.
- public API 500.
- public API default 30일이 계속 `partial_requested_window`.
- log에 credential 원문이 찍힘.

## 승인안

스프린트 이름: `Naver Ads daily cache cron 연결`

승인하면 Codex가 실행할 일:

1. VM Cloud에 wrapper script를 추가한다.
2. wrapper를 수동 1회 실행해 `--write` 결과를 확인한다.
3. public API 7일/30일 smoke를 실행한다.
4. crontab에 매일 07:20 KST 실행을 등록한다.
5. 등록 직후 `crontab -l`로 line을 확인한다.
6. 결과 문서에 log 경로, smoke 값, rollback 방법을 남긴다.

승인해도 하지 않을 일:

- Naver Ads 계정의 광고/입찰/예산/키워드 변경.
- Google/Meta/TikTok/Naver 전환 전송.
- 운영DB write.
- GTM/Imweb 변경.
- backend 코드 배포가 필요한 추가 기능 개발.

Rollback:

1. crontab에서 `naver-ads-daily-sync.sh` line 제거.
2. wrapper script는 남기되 executable bit만 제거하거나, 백업 후 삭제.
3. 필요하면 `naver_ads_daily` row는 삭제하지 않는다. cache는 읽기 지표이므로 삭제보다 stale 표시가 안전하다.

## 승인 후 등록 결과

source: VM Cloud crontab + wrapper dry-run + public API smoke
window: wrapper dry-run 2026-04-21~2026-05-20, API default 2026-04-21~2026-05-20
freshness: 2026-05-22 01:18 KST
confidence: high

등록한 wrapper:

```bash
/home/biocomkr_sns/seo/repo/backend/scripts/naver-ads-daily-sync.sh
```

등록한 crontab:

```cron
20 7 * * * /home/biocomkr_sns/seo/repo/backend/scripts/naver-ads-daily-sync.sh >> /home/biocomkr_sns/seo/logs/naver-ads-daily-sync.log 2>&1
```

등록 전 wrapper dry-run:

| 항목 | 값 |
|---|---:|
| mode | dry_run |
| window | 2026-04-21~2026-05-20 |
| campaigns success | 37 |
| campaigns failed | 0 |
| rows previewed | 1,110 |
| rows written | 0 |
| spend | 7,276,795원 |

현재 public API:

| endpoint | status | cache status | first date | last date | rows | spend |
|---|---:|---|---|---|---:|---:|
| `/api/ads/naver/campaign-summary?site=biocom` | 200 | ready | 2026-04-21 | 2026-05-20 | 1,110 | 7,276,795원 |

주의:

- 등록 시각은 01시대라 첫 cron 실행은 아직 발생하지 않았다.
- 첫 자동 실행은 2026-05-22 07:20 KST이고, 성공하면 `last_date_in_cache`가 2026-05-21로 갱신될 가능성이 높다.
- Naver Ads 전환 upload가 아니라 광고비 cache upsert다.

## 다음 할일

### 실제 필요한 작업 순서

1. crontab 등록 후 첫 자동 실행을 확인한다.
   - 담당: Codex.
   - 이유: 수동 실행과 cron 실행은 PATH/TZ/env 차이가 날 수 있다.
   - 성공 기준: 2026-05-22 07:20 KST 이후 log에 성공 row가 있고 API `last_date_in_cache=2026-05-21`.
   - 승인 필요 여부: 등록은 완료. 확인은 read-only라 불필요.
   - 의존성: cron 등록 완료.
   - 추천 점수/자신감: 86%.

## Auditor verdict

PASS_WITH_NOTES.

cron 설계와 등록은 승인 범위 안에서 완료했다. 남은 것은 첫 자동 실행의 read-only 확인이다.
