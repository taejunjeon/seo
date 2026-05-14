# gpt0514-4 결과 보고 — 네이버 evidence 전체 집계와 URL 표준화 canary

작성 시각: 2026-05-14 03:00 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - docs/agent-harness/growth-data-harness-v0.md
  lane: Yellow approved VM Cloud backend deploy + Green/conditional Naver Ads URL canary audit
  allowed_actions:
    - VM Cloud backend file deploy/restart within approved scope
    - 운영DB read-only only
    - VM Cloud SQLite read-only only
    - Naver Search Ad API read-only current URL audit
    - canary approval/runbook documentation
  forbidden_actions:
    - 운영DB write
    - VM Cloud schema migration
    - Google Ads/GA4/Meta/TikTok/Naver conversion send/upload
    - GTM publish
    - Imweb footer/header change
    - Naver Ads platform claim merge into internal confirmed revenue
  source_window_freshness_confidence:
    source: "VM Cloud attribution_ledger aggregate endpoint, /total monthly API, Naver Search Ad API read-only, official Search Ad API spec"
    window: "biocom 2026-05 KST month window, URL audit 2026-05-14 02:55 KST"
    freshness: "VM Cloud post-snapshot 2026-05-14 02:59 KST"
    confidence: 0.91
```

## 이번에 가능해진 것

네이버 유입 후보를 화면이 읽을 수 있는 전체 집계로 분리할 수 있게 됐다. 기존처럼 제한된 item slice 숫자 144건을 보지 않고, VM Cloud 고객 유입 장부 전체 기준으로 paid_naver, naver_brandsearch, organic_naver_candidate, naver_referrer_or_utm_only를 같은 기준에서 본다.

## 실제 숫자

- source: VM Cloud `attribution_ledger` aggregate endpoint.
- site/window: `biocom`, 2026-05-01~2026-06-01 KST.
- 전체 행: 23,882건.
- 네이버 흔적 있음: 690건.
- paid_naver: 352건.
- naver_brandsearch: 326건.
- organic_naver_candidate: 0건.
- naver_referrer_or_utm_only: 12건.
- `budgetRoasIncluded=false`, `rawIdentifierOutput=false`, `aggregateOnly=true`.

## 배포 결과

VM Cloud backend에는 반영됐다.

- `GET /api/attribution/ledger/naver-evidence-aggregate`: 200.
- `GET /api/total/monthly-channel-summary?site=biocom&month=2026-05`: 200.
- `GET /health`: 200.
- `seo-backend`: PM2 online.
- remote backup: `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0514-4-20260513T173652Z`.

VM Cloud public frontend route는 아직 별도다. `https://biocom.ainativeos.net/total`은 2026-05-14 02:52 KST 확인 시 404였다. 즉, VM Cloud backend API 반영은 끝났지만, VM Cloud frontend route 노출은 별도 frontend deploy/router 작업이 남아 있다. 여기서 `운영DB`는 개발팀 관장 Supabase/Postgres만 뜻하므로 frontend/backend 배포 문맥에는 쓰지 않는다.

## URL canary 판단

네이버 검색광고 API로 현재 URL 구조는 읽었다. 하지만 공식 Search Ad API spec 기준 광고 소재 수정 PUT은 `userLock`, `inspect` 필드만 허용한다. 랜딩 URL을 API로 직접 바꾸는 안전한 update 경로는 확인되지 않았다. 그래서 실제 canary URL 변경은 UI에서 1개 광고그룹만 수동 적용하는 방식이 현재 안전하다.

추천 canary 후보는 `바이오컴_파워링크_영양중금속검사 / 01_메인키워드_PC`다. 현재 PC/MO landing에는 `idx`만 있고 UTM이 없다. 표준 UTM은 아래처럼 붙인다.

```text
utm_source=naver
utm_medium=cpc
utm_campaign=바이오컴_파워링크_영양중금속검사
utm_content=01_메인키워드_PC
utm_term={keyword}
```

## biocom.kr 직접 유입 판단

`biocom.kr`을 직접 입력하거나 북마크로 들어온 사람은 현재 확정 direct 채널로 분리하지 않는다. 브라우저가 referrer를 보내지 않으면 광고/검색/추천 근거가 없으므로 unknown 쪽에 남긴다.

2026년 5월 바이오컴 기준으로는 `self_or_internal_referrer_only`가 71건 / 20,914,719원이다. 이는 내부 도메인 이동 흔적만 남은 매출이다. 직접 입력/북마크를 확정 매출 채널로 올린 것이 아니라, “외부 유입 보존 필요” blocker로 보고 있다.

## 하지 않은 것

- 운영DB write 0.
- VM Cloud SQLite schema migration 0.
- Google Ads/GA4/Meta/TikTok/Naver send/upload 0.
- GTM publish 0.
- Imweb footer/header change 0.
- 네이버 후보 매출을 budget ROAS에 자동 포함 0.
- Naver Ads URL 실제 변경 0. API update 경로가 안전하지 않아 UI canary runbook으로 전환했다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0514-4/01-vm-cloud-backend-deploy-and-validation.md` — VM Cloud backend 반영과 숫자 검증 근거.
2. `gptconfirm/gpt0514-4/02-naver-url-current-vs-standard-canary.md` — 현재 UTM과 표준 UTM 차이, canary 적용 방법.
3. `gptconfirm/gpt0514-4/03-next-actions-and-rollback.md` — 다음 실행 순서와 rollback.

텔레그램 발송은 하지 않았다. 사용자 skip 유지로 결과보고 문서에만 기록한다.
