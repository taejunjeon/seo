# Naver acquisitionAnalysis Green audit

작성 시각: 2026-05-21 23:04 KST
문서 성격: `backend/src/acquisitionAnalysis.ts`가 프론트에서 paid/organic 혼동을 만드는지 확인한 Green audit 및 backend deploy 승인안

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
    - project/naver-channel-classification-dry-run-20260521.md
  lane: Green
  allowed_actions:
    - frontend_code_read
    - backend_code_read
    - public_api_read_only_smoke
    - local_backend_helper_patch
    - local_test_and_typecheck
    - approval_packet_draft
  forbidden_actions:
    - backend_deploy
    - vm_cloud_write
    - operational_db_write
    - gtm_publish
    - imweb_save
    - platform_send_or_upload
  source_window_freshness_confidence:
    source: live public API + local code read
    window: biocom last_7d / acquisition-analysis frontend
    freshness: 2026-05-21 23:04 KST
    confidence: high
```

## 한 줄 결론

`/api/attribution/acquisition-summary` 화면은 Naver를 paid라고 직접 말하지 않는다. 하지만 `/api/acquisition/channel-analysis` 경로에서 `naverbrandsearch_biocom_mo_tab1_igg`가 `Meta Ads`로 잘못 들어가는 실제 혼동이 있었다.

## 확인한 화면/API

1. `frontend/src/app/acquisition-analysis/page.tsx`
   - 첫 화면은 `/api/attribution/acquisition-summary?rangeDays=...&dataSource=vm`를 호출한다.
   - Naver label은 `Naver 검색/쇼핑`이다.
   - paid ROAS로 직접 표기하지 않는다.

2. 같은 프론트의 `GA4ChannelAnalysis`
   - `/api/acquisition/channel-analysis?site=biocom&date_range=last_7d`를 호출한다.
   - GA4 source/medium 기반 channel group을 표시한다.
   - 여기에서 source 문자열 판정 오류가 발견됐다.

## live API 관측

### attribution acquisition summary

source: `https://att.ainativeos.net/api/attribution/acquisition-summary?rangeDays=7&dataSource=vm`

- status: 200
- latency: 약 11.8초
- biocom Naver row:
  - label: `Naver 검색/쇼핑`
  - count: 49
  - share: 11.0%
  - confirmed: 41
  - confirmed revenue: 12,483,237원
  - examples: `1`, `2`, `powerlink`

해석: 이 row는 Naver 전체 묶음이다. paid라고 쓰지는 않지만, examples에 `powerlink`가 같이 섞이므로 paid/organic 세부 판단에는 쓰면 안 된다.

### GA4 channel analysis

source: `https://att.ainativeos.net/api/acquisition/channel-analysis?site=biocom&date_range=last_7d&limit=50`

Naver group 안에는 다음이 섞여 있다.

- `naver / powerlink`: purchases 43, revenue 13,157,603원
- `m.search.naver.com / referral`: purchases 35, revenue 10,434,737원
- `naverbrandsearch_biocom_mo_mainhome`: purchases 29, revenue 3,878,317원
- `naver / organic`: purchases 6, revenue 1,244,490원
- `cr2.shopping.naver.com / referral`: purchases 2, revenue 719,500원

오류 row:

- `naverbrandsearch_biocom_mo_tab1_igg`가 `Meta Ads`로 분류됨
- 원인: `resolveAcquisitionChannelGroup()`이 `source.includes("ig")`를 사용했고, `igg` 안의 `ig`를 Instagram으로 오인했다.

## 로컬 보강

파일: `backend/src/acquisitionAnalysis.ts`

변경:

1. `sourceHasToken()` helper 추가
2. `naver` source는 Meta보다 먼저 Naver로 분류
3. `ig`/`fb`는 단어 token일 때만 Meta로 인정
4. `instagram`, `facebook`, `meta`는 기존처럼 Meta 유지

테스트:

파일: `backend/tests/acquisition-analysis.test.ts`

추가 fixture:

1. `naverbrandsearch_biocom_mo_tab1_igg` → `Naver`
2. `instagram` → `Meta Ads`
3. `paid_ig` → `Meta Ads`
4. 일반 `organic / organic` → `Organic`

## 검증

| 검증 | 결과 |
|---|---|
| `cd backend && npx tsx --test tests/acquisition-analysis.test.ts tests/attribution.test.ts` | PASS, 53/53 |
| `cd backend && npm run typecheck -- --pretty false` | PASS |
| live API read-only smoke | PASS, status 200 |

## 운영 반영 필요 여부

필요하다.

이유:

1. 기존 Naver dry-run 보강은 아직 로컬에만 있다.
2. live `/api/acquisition/channel-analysis`에서 실제로 Naver brandsearch row가 Meta Ads로 섞였다.
3. live `/api/ads/naver/campaign-summary`는 내부 paid_naver 매출을 evidence join 스크립트로 계산하므로, `NaPm` 단독 paid 제거 패치를 운영에 반영해야 한다.

## Backend deploy 승인안

### TJ님이 승인할 것

VM Cloud `seo-backend`에 Naver 유입 분류 보강 backend 배포를 승인한다.

### 바꾸는 설정/코드

1. `backend/src/routes/attribution.ts`
   - Naver evidence aggregate에서 `NaPm` 단독 paid 제거
   - `tr=sa/brnd/slsl/ds` 분리

2. `backend/scripts/monthly-evidence-join-dry-run.ts`
   - Naver campaign summary 내부 paid_naver 계산에도 동일 기준 반영

3. `backend/src/leadingIndicators.ts`
   - 리딩 지표 `naver_paid_or_brand`에서 `NaPm` 단독 paid/brand 제거

4. `backend/src/acquisitionAnalysis.ts`
   - `ig` substring 오인으로 Naver brandsearch가 Meta Ads에 들어가는 문제 수정

### 생기는 효과

1. Naver 오가닉/브랜드/쇼핑/파워링크 후보가 덜 섞인다.
2. 내부 paid_naver ROAS 후보 매출이 `NaPm` 단독 때문에 부풀 가능성이 줄어든다.
3. `naverbrandsearch_..._igg` row가 Meta Ads로 들어가는 잘못된 분류가 사라진다.

### 안 바꾸면 남는 문제

1. Naver 오가닉/쇼핑 후보가 paid_naver에 섞일 수 있다.
2. Naver Ads 내부 ROAS 참고값이 과대 산정될 수 있다.
3. acquisition-analysis 프론트에서 일부 Naver brandsearch가 Meta Ads로 보일 수 있다.

### 배포 후 smoke 기준

1. `pm2 list`에서 `seo-backend` online
2. restart count는 승인된 배포 증가만 허용
3. `pm2 logs seo-backend` 최근 error 없음
4. `GET /api/attribution/ledger/naver-evidence-aggregate?site=biocom&window=last_7d` 200
5. `GET /api/acquisition/channel-analysis?site=biocom&date_range=last_7d&limit=50` 200
6. `naverbrandsearch_biocom_mo_tab1_igg`가 Meta Ads가 아니라 Naver group으로 집계
7. `GET /api/ads/naver/campaign-summary?site=biocom&since=2026-05-20&until=2026-05-21` 200

### Lane

Backend deploy는 Yellow Lane이다. TJ님 승인 전 실행하지 않는다.

## 하지 않은 것

- backend deploy 0
- VM Cloud write 0
- 운영DB write 0
- GTM publish 0
- Imweb save 0
- Meta/Google/Naver/TikTok 전송 0
