# VM Cloud alias seed 복구 감사와 배포 계획

작성 시각: 2026-05-18 23:08 KST
실행 업데이트: 2026-05-19 00:04 KST
기준일: 2026-05-18
문서 성격: read-only 감사 결과 + Yellow Lane 배포 실행 기록

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - meta/campaign-alias-mapping.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
    - meta/meta-campaign-roas-ads-error-fix-20260518.md
  lane:
    audit: Green
    file_deploy: Yellow 승인 후 실행 완료
    runtime_path_cleanup: Yellow 승인 후 실행 완료
  allowed_actions:
    - read_only_vm_cloud_file_inventory
    - read_only_live_api_check
    - no_write_dry_run_with_local_seed_in_memory
    - documentation_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_sqlite_schema_or_data_write
    - ad_platform_send_or_upload
    - gtm_publish
    - vm_cloud_file_deploy_without_tj_approval
  source_window_freshness_confidence:
    source: VM Cloud filesystem read-only + VM Cloud SQLite read-only + live ROAS API + local tracked seed files
    window: biocom Meta last_7d 2026-05-11~2026-05-17 KST
    freshness: 2026-05-18 22:52~2026-05-19 00:04 KST 직접 확인
    confidence: 0.94
```

## 10초 요약

VM Cloud의 alias review가 0건으로 보이는 이유는 seed가 비어 있어서가 아니라, 실행 서버에 `meta_campaign_aliases.biocom.json`과 `meta_campaign_alias_audit.biocom.json` 파일이 아예 없기 때문이다.

로컬에는 seed 22개가 있고 이 중 수동 확정 14개가 있다. 이 seed를 VM Cloud의 runtime read path에 배포하면 현재 기본 window 기준 최소 1건 / `510,000원`의 미맵핑이 줄어들 가능성이 있다.

TJ님이 2026-05-18에 Phase 1 파일 복구를 승인했고, seed/audit 파일 2개를 VM Cloud runtime path에 배포했다. 배포 후 alias review는 0건에서 22건으로 복구됐고, 기본 window 미맵핑은 1건 / `510,000원` 줄었다.

이후 TJ님이 runtime data path 정리를 지시했고, Phase 2까지 실행했다. 이제 alias review와 ROAS fallback reader가 같은 repo root `data` 경로를 본다.

## 무엇이 확인됐나

### 1. live alias review는 0건이다

확인 API:

```text
GET https://att.ainativeos.net/api/ads/campaign-alias-review?site=biocom
```

결과:

```text
ok: true
totalAliases: 0
pendingReview: 0
manualVerified: 0
rejectedAll: 0
items: 0
```

해석:

- `데이터 없음`이다.
- `권한 부족`, `CORS`, `API 실패`는 아니다.
- seed가 비어 있는 것처럼 보였지만, 실제 원인은 runtime에서 읽는 파일이 VM Cloud에 없기 때문이다.

### 2. VM Cloud의 파일 위치에는 alias seed/audit 파일이 없다

VM Cloud 실행 정보:

```text
script path: /home/biocomkr_sns/seo/repo/backend/dist/server.js
exec cwd: /home/biocomkr_sns/seo/repo/backend
seo-backend: online
restart count: 4266
```

확인한 runtime 후보 경로:

```text
/home/biocomkr_sns/seo/repo/data
/home/biocomkr_sns/seo/repo/backend/data
/home/biocomkr_sns/seo/shared/backend-data
```

확인 결과:

- `/home/biocomkr_sns/seo/repo/data`에는 `coop_campaigns.biocom.json`만 있고 alias seed/audit 파일은 없다.
- `/home/biocomkr_sns/seo/repo/backend/data`는 `/home/biocomkr_sns/seo/shared/backend-data` symlink다.
- `/home/biocomkr_sns/seo/shared/backend-data`에도 alias seed/audit 파일은 없다.
- `.deploy-backups` 안에서도 `meta_campaign_alias*.biocom.json` 파일은 확인되지 않았다.

### 3. backend 코드가 읽는 경로는 두 갈래다

캠페인 alias review와 수동 alias 매칭은 아래 경로를 읽는다.

```text
/home/biocomkr_sns/seo/repo/data/meta_campaign_aliases.biocom.json
/home/biocomkr_sns/seo/repo/data/meta_campaign_alias_audit.biocom.json
```

근거:

- `backend/src/metaCampaignAliasReview.ts`
- compiled runtime 기준 `DATA_DIR = /home/biocomkr_sns/seo/repo/data`
- `/api/ads/campaign-alias-review`
- `/api/ads/roas` 내부의 `fetchManualVerifiedAliasMap`

반면 `backend/src/routes/ads.ts` 내부의 일부 local audit fallback reader는 compiled runtime 기준 아래 경로를 본다.

```text
/home/biocomkr_sns/seo/repo/backend/data/meta_campaign_alias_audit.biocom.json
```

이 경로는 symlink를 통해 `/home/biocomkr_sns/seo/shared/backend-data`를 가리킨다.

해석:

- 수동 alias seed를 ROAS 계산에 태우려면 우선 `/home/biocomkr_sns/seo/repo/data`에 seed/audit 파일이 필요하다.
- backend/data 쪽 fallback 경로는 별도 정리 대상이다. 이번 복구의 1순위는 아니다.

### 4. 로컬 seed는 살아 있다

로컬 파일:

```text
/Users/vibetj/coding/seo/data/meta_campaign_aliases.biocom.json
/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json
```

로컬 seed 상태:

```text
seed entries: 22
manual_verified: 14
split_required: 7
rejected_all_candidates: 1
```

로컬 audit 상태:

```text
generatedAt: 2026-04-11T05:31:33.717Z
range: 2026-04-04~2026-04-10
campaigns: 7
aliasCandidates: 19
```

주의:

- seed의 수동 확정값은 현재 ROAS 매칭에 의미가 있다.
- audit의 주문/매출 evidence는 오래된 스냅샷이다. UI 후보 설명에는 유용하지만 현재 window 매출 정본으로 쓰면 안 된다.

## 배포하면 얼마나 줄어드나

read-only dry-run 방식:

- VM Cloud SQLite는 read-only로 읽었다.
- 로컬 seed는 VM에 파일로 쓰지 않고, 일회성 메모리 값으로만 사용했다.
- live ROAS API의 현재 campaign 목록과 현재 기본 window를 함께 사용했다.
- 주문번호, 전화번호, payment key 같은 식별자는 출력하지 않았다.

기준:

```text
source: VM Cloud SQLite read-only + local seed in memory + live ROAS API
window: 2026-05-11~2026-05-17 KST
site: biocom
freshness: 2026-05-18 23:05 KST
confidence: 0.88 for expected reduction, 0.94 for file absence
```

현재 live 기본 window:

```text
Meta attributed confirmed orders: 158
현재 unmapped: 28건 / 11,842,910원
직접 ID hint로 이미 매칭되는 주문: 130건 / 40,381,475원
```

seed 배포 시 추가 매칭 예상:

```text
alias: meta_biocom_iggunboxing_igg
target campaign: 120235591897270396
target campaign name: [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)
expected additional mapped orders: 1건
expected additional mapped revenue: 510,000원
```

예상 영향:

- 미맵핑 캠페인 매출은 `28건 / 11,842,910원`에서 최소 `27건 / 11,332,910원`으로 줄 가능성이 높다.
- 총 Attribution confirmed 매출은 바뀌지 않는다.
- 바뀌는 것은 “어느 campaign에 귀속하느냐”다.

## 왜 더 크게 줄지 않는가

현재 `last_7d` window에서는 대부분 주문에 이미 campaign/adset/ad id가 남아 있다.

그래서 로컬 seed 14개를 모두 되살려도, 이번 window에서 추가로 잡히는 alias-only 주문은 dry-run 기준 1건이다.

하지만 seed 복구가 여전히 필요한 이유는 두 가지다.

1. `/ads`의 alias review 화면이 현재 0건으로 죽어 있어 수동 검토 흐름이 보이지 않는다.
2. 앞으로 id hint가 빠진 alias-only 주문이 들어오면 seed가 없을 때 계속 `(unmapped)`로 남는다.

## 배포 계획

### Phase 1. seed/audit 파일만 복구한다

Lane: Yellow

목표:

- `/api/ads/campaign-alias-review?site=biocom`이 로컬 seed 기준 22개 alias를 다시 보여준다.
- `/api/ads/roas?date_preset=last_7d&force=1`에서 manual seed 기반 추가 매칭이 반영된다.

실행 파일:

```text
local source:
/Users/vibetj/coding/seo/data/meta_campaign_aliases.biocom.json
/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json

VM Cloud target:
/home/biocomkr_sns/seo/repo/data/meta_campaign_aliases.biocom.json
/home/biocomkr_sns/seo/repo/data/meta_campaign_alias_audit.biocom.json
```

실행 전 precheck:

```text
sha256sum local source files
VM target file existence check
VM target backup directory create
```

백업:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/meta-alias-seed-files-20260518T2314KST
```

실행:

```text
scp data/meta_campaign_aliases.biocom.json taejun@34.64.104.94:/tmp/meta_campaign_aliases.biocom.json
scp data/meta_campaign_alias_audit.biocom.json taejun@34.64.104.94:/tmp/meta_campaign_alias_audit.biocom.json
ssh taejun@34.64.104.94
sudo -iu biocomkr_sns
cd /home/biocomkr_sns/seo/repo
mkdir -p .deploy-backups/meta-alias-seed-files-20260518T2314KST/data
test -f data/meta_campaign_aliases.biocom.json && cp data/meta_campaign_aliases.biocom.json .deploy-backups/meta-alias-seed-files-20260518T2314KST/data/
test -f data/meta_campaign_alias_audit.biocom.json && cp data/meta_campaign_alias_audit.biocom.json .deploy-backups/meta-alias-seed-files-20260518T2314KST/data/
cp /tmp/meta_campaign_aliases.biocom.json data/meta_campaign_aliases.biocom.json
cp /tmp/meta_campaign_alias_audit.biocom.json data/meta_campaign_alias_audit.biocom.json
```

서버 재시작:

- 원칙상 필요 없다.
- `loadAliasReviewItems`는 request마다 파일을 읽는다.
- `/api/ads/roas`는 lazy cache가 있으므로 검증 시 `force=1`을 쓴다.

검증:

```text
curl -fsS 'https://att.ainativeos.net/api/ads/campaign-alias-review?site=biocom'
expected:
  totalAliases: 22
  manualVerified: 14
  rejectedAll: 1

curl -fsS 'https://att.ainativeos.net/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d&force=1'
expected:
  ok: true
  mapping errors: null 또는 기존 live creative warming 메시지 없음
  unmapped 감소 예상: 최소 1건 / 510,000원
```

stop criteria:

- alias review가 22건이 아니라 0건이면 즉시 rollback.
- JSON parse error가 나오면 즉시 rollback.
- `/api/ads/roas`가 500/502 또는 degraded no-cache로 떨어지면 즉시 rollback.
- 총 Attribution confirmed revenue가 바뀌면 즉시 rollback. 이번 작업은 캠페인 배정만 바꿔야 한다.

rollback:

```text
cd /home/biocomkr_sns/seo/repo
cp .deploy-backups/meta-alias-seed-files-20260518T2314KST/data/meta_campaign_aliases.biocom.json data/meta_campaign_aliases.biocom.json
cp .deploy-backups/meta-alias-seed-files-20260518T2314KST/data/meta_campaign_alias_audit.biocom.json data/meta_campaign_alias_audit.biocom.json
```

만약 기존 파일이 없었기 때문에 backup 파일이 없다면 rollback은 배포한 두 파일을 제거하는 방식이다.

### Phase 1 실행 결과

승인:

```text
승인자: TJ님
승인 문구: VM Cloud에 alias seed 파일 2개를 올리는 것을 승인한다.
실행 시각: 2026-05-18 23:53 KST
```

배포한 파일:

```text
/home/biocomkr_sns/seo/repo/data/meta_campaign_aliases.biocom.json
bytes: 27,997
sha256: 42a416207a81d40d0a26aa1cea28eba73ddc9dcefe1996f3e254ecaa6169a4ad

/home/biocomkr_sns/seo/repo/data/meta_campaign_alias_audit.biocom.json
bytes: 709,170
sha256: e6a66fd338441337cb94e5bff283cc2ddc0841d5e8109ed39196dc5eb0174de7
```

백업:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/meta-alias-seed-files-20260518T2314KST/data/meta_campaign_aliases.biocom.json.MISSING
/home/biocomkr_sns/seo/repo/.deploy-backups/meta-alias-seed-files-20260518T2314KST/data/meta_campaign_alias_audit.biocom.json.MISSING
```

기존 파일이 없었기 때문에 원본 파일 백업 대신 missing marker를 남겼다.

live 검증:

```text
GET /api/ads/campaign-alias-review?site=biocom
HTTP 200
totalAliases: 22
manualVerified: 14
rejectedAll: 1
```

```text
GET /api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d&force=1
HTTP 200
source: live_force
window: 2026-05-11~2026-05-17 KST
mapping errors: null
unmapped after: 27건 / 11,332,910원
target campaign 120235591897270396: 25건 / 8,426,000원
total attributed revenue: 52,224,385원 unchanged
```

```text
GET /api/ads/campaign-ltv-roas?account_id=act_3138805896402376&date_preset=last_7d&force=1
HTTP 200
source: live_force
window: 2026-05-11~2026-05-17 KST
mapping errors: null
unmapped after: 27건 / 11,332,910원
target campaign 120235591897270396: 25건 / 8,426,000원
mapped attributed revenue summary: 40,891,475원
```

server 상태:

```text
seo-backend: online
restart count: 4266
backend restart: not executed
```

판단:

- Phase 1 성공.
- 실제 감소값은 dry-run 예상과 일치했다.
- 총 Attribution confirmed 매출은 변하지 않았고, 미맵핑 1건 / `510,000원`만 target campaign으로 재귀속됐다.
- backend 재시작 없이 반영됐다.

### Phase 2. runtime data path를 정리한다

Lane: Green for design, Yellow for backend deploy

문제:

- `metaCampaignAliasReview.ts`는 `/repo/data`를 읽는다.
- `ads.ts` 일부 fallback reader는 `/repo/backend/data`를 읽는다.
- VM에서는 `/repo/backend/data`가 shared backend-data symlink다.

정리안:

1. alias review seed/audit의 정본 runtime path를 `/repo/data`로 고정한다.
2. `ads.ts`의 fallback reader도 같은 helper를 쓰게 하거나, data dir 상수를 명시적으로 분리한다.
3. 이 변경은 code deploy가 필요하므로 별도 Yellow Lane으로 처리한다.

Phase 2 실행 결과:

```text
승인자: TJ님
승인 문구: runtime data path 정리해
실행 시각: 2026-05-19 00:03~00:04 KST
```

변경:

- `backend/src/metaCampaignAliasPaths.ts`를 추가했다.
- `metaCampaignAliasReview.ts`가 이 helper를 통해 seed/audit 경로를 읽게 했다.
- `routes/ads.ts`의 local audit fallback도 같은 helper를 쓰게 했다.
- `routes/ads.ts`의 다른 cache/data 경로는 건드리지 않았다.

배포:

```text
backup: /home/biocomkr_sns/seo/repo/.deploy-backups/meta-alias-data-path-20260518T2358KST
deployed files:
  /home/biocomkr_sns/seo/repo/backend/src/metaCampaignAliasPaths.ts
  /home/biocomkr_sns/seo/repo/backend/src/metaCampaignAliasReview.ts
  /home/biocomkr_sns/seo/repo/backend/src/routes/ads.ts
```

compiled runtime path:

```text
dataDir: /home/biocomkr_sns/seo/repo/data
audit: /home/biocomkr_sns/seo/repo/data/meta_campaign_alias_audit.biocom.json
seed: /home/biocomkr_sns/seo/repo/data/meta_campaign_aliases.biocom.json
```

검증:

```text
local backend typecheck: PASS
local backend build: PASS
VM Cloud backend typecheck: PASS
VM Cloud backend build: PASS
VM Cloud backend restart: executed
seo-backend restart count: 4267
seo-backend status: online
```

live smoke:

```text
GET /api/ads/campaign-alias-review?site=biocom
HTTP 200
totalAliases: 22
manualVerified: 14
rejectedAll: 1
```

```text
GET /api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d&force=1
HTTP 200
window: 2026-05-12~2026-05-18 KST
unmapped: 28건 / 12,259,160원
ad_mapping_error: The operation was aborted due to timeout; local alias audit fallback ads=410
```

해석:

- 2026-05-19 00:04 KST 기준 `last_7d` window가 `2026-05-12~2026-05-18`로 넘어갔다. 따라서 Phase 1의 `2026-05-11~2026-05-17` 숫자와 직접 비교하지 않는다.
- `local alias audit fallback ads=410`은 실패가 아니라 fallback이 repo root `data`의 audit 파일을 실제로 읽었다는 증거다.
- Meta creative API timeout은 별도 외부 API 지연 문제다. 이번 runtime path 정리 범위의 실패가 아니다.

## 하지 않은 것

- VM Cloud SQLite를 수정하지 않았다.
- 운영DB를 수정하지 않았다.
- Meta/Google/TikTok/Naver 등 광고 플랫폼에 전송하지 않았다.
- GTM publish를 하지 않았다.
- Phase 1 파일 복구 때는 backend 재시작을 하지 않았다.
- Phase 2 runtime path 정리 때는 backend 코드 배포와 재시작을 수행했다.

## Auditor verdict

PASS_WITH_NOTES.

read-only 감사로 원인을 좁힌 뒤, TJ님 승인 범위 안에서 seed/audit 파일을 복구했고 runtime data path도 정리했다. alias review 운영 흐름은 복구됐고, fallback reader도 같은 repo root `data` 경로를 본다. 남은 주석은 Meta creative API timeout이 간헐적으로 fallback을 유발한다는 점이다.
