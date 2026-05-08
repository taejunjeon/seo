# BigQuery 정본 (실제 개발 순서)

작성 시각: 2026-05-08 00:00 KST
최종 업데이트: 2026-05-08 00:00 KST
기준일: 2026-05-07
상태: active canonical
Owner: data / bigquery
Supersedes: [[!bigquery_old]]
Next document: 운영 backend sourceFreshness deploy 결과 또는 AIBIO BigQuery 연결 결정 문서
Do not use for: 운영 DB write, GA4 MP send, Meta CAPI send, Google Ads upload, GTM publish, BigQuery dataset 삭제, GA4 Link 강제 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/dbstructure.md
    - total/!total-current.md
    - vm/!vm.md
    - GA4/gtm.md
  lane: Green canonical doc 재정렬 (read-only)
  allowed_actions:
    - 정본 재정렬
    - SA 권한 / dataset 적재 read-only 검증
    - 운영 backend dist 상태 read-only 비교
    - 운영 freshness check 결과 분석
  forbidden_actions:
    - 운영 DB write
    - GA4 MP / Meta CAPI / Google Ads upload
    - BigQuery dataset 삭제
    - GA4 Link 변경
    - 광고 변경
  source_window_freshness_confidence:
    source: "운영 VM SSH (seo-656@seo-aeo-487113 SA, project-dadba7dd-0229-4ff6-81c job project) + bq cli + sourceFreshness.ts source-of-truth"
    window: "2026-05-07 23:55 ~ 2026-05-08 00:00 KST"
    freshness: "본 sprint에서 직접 측정"
    confidence: 0.92
```

## 10초 결론

biocom GA4 raw events는 **두 곳에 동시 존재**한다. ① `hurdlers-naver-pay.analytics_304759974` (정기 daily export, GA4 직접) ② `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` (TJ가 시작한 우리쪽 backfill copy). 두 dataset의 row_count + purchase + distinct_txn 모두 **100% 일치**. events_20260506 70,294 rows, 최근 6일 purchase 49~88 / day, transaction_id 1:1 매칭.

"허들러스 빅쿼리를 우리것으로 이전"의 실제 의미는 **백필 copy 시작**이다. daily 직접 export는 여전히 hurdlers에 있고, 우리 project로는 정기 backfill copy로 따라잡는 구조 (2026-05-04 16:35 UTC에 7일치 일괄, 2026-05-07 06:38 UTC에 3일치 일괄). T+ < 1일 안에 catch-up 완료.

운영 backend dist는 **옛 버전 (jobProjectId 분리 미적용)** 이라 `sourceFreshness.ts` 의 biocom GA4 BigQuery freshness check가 `bigquery.jobs.create permission denied` 로 fail. 최신 sourceFreshness.ts deploy + source 위치 결정 (hurdlers vs backfill) 로 즉시 해결 가능.

AIBIO (`analytics_326993019`)는 `project-dadba7dd-0229-4ff6-81c`에 dataset이 등록된 게 보이지만 (`bq ls`에 노출), 우리 SA에 query 권한이 미완 (`__TABLES__` query 시 Access Denied). 즉 GA4 Link 시작 단계, 권한 부여 후속 필요.

## Phase-Sprint 요약표

실제 실행 우선순위순.

| Priority | Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|---|
| P0 | Phase1 | [[#Phase1-Sprint1]] | 운영 backend `sourceFreshness` 최신 deploy | Codex | 100% / 0% | [[#Phase1-Sprint1\|이동]] |
| P0 | Phase1 | [[#Phase1-Sprint2]] | biocom GA4 BigQuery freshness PASS 검증 | Codex | 0% / 0% | [[#Phase1-Sprint2\|이동]] |
| P1 | Phase2 | [[#Phase2-Sprint1]] | confirmed_purchase no-send 재실행 (BigQuery guard 활용) | Codex | 60% / 0% | [[#Phase2-Sprint1\|이동]] |
| P1 | Phase2 | [[#Phase2-Sprint2]] | Channel funnel quality (Meta vs Google vs Organic) BigQuery 분석 | Codex | 0% / 0% | [[#Phase2-Sprint2\|이동]] |
| P2 | Phase3 | [[#Phase3-Sprint1]] | AIBIO BigQuery 연결 검토 | TJ + Codex | 0% / 0% | [[#Phase3-Sprint1\|이동]] |
| P2 | Phase3 | [[#Phase3-Sprint2]] | 과거 table 보존 정책 결정 | TJ | 30% / 0% | [[#Phase3-Sprint2\|이동]] |
| P3 | Phase4 | [[#Phase4-Sprint1]] | streaming export 도입 검토 | TJ + Codex | 0% / 0% | [[#Phase4-Sprint1\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 의존성 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|---|
| 0 | [[#Phase1-Sprint1]] | approval_waiting | TJ + Codex | biocom freshness source를 hurdlers vs backfill copy 중 어느 쪽으로 둘지 결정 | 두 dataset 데이터는 100% 동일하지만 운영 영향이 다름. hurdlers는 daily 자동(T+24~36h), backfill는 우리 통제(T+ <1일이지만 수동/cron 의존) | 백필 cron 일정 확인 + 옵션 A/B/C 비교 (hurdlers / backfill / dual) | TJ 결정 | [[#Phase1-Sprint1]] | YES |
| 1 | [[#Phase1-Sprint1]] | auto_ready | Codex | 운영 backend `sourceFreshness.ts` 최신 dist deploy + source 위치 코드 update | biocom GA4 freshness check가 옛 dist 때문에 jobs.create 권한 부족으로 fail. 최신 코드는 jobProjectId 분리되어 있어 deploy만 하면 정상. 0번 결정 시 source 위치 변경 patch 추가 | 백업 → patch sourceFreshness 결정 → build → scp dist/sourceFreshness.js → PM2 restart → freshness 재실행 | 0번 결정 후 | [[../backend/src/sourceFreshness.ts]] | NO (Yellow 이미 수용된 deploy 절차 안에서) |
| 2 | [[#Phase1-Sprint2]] | time_waiting | Codex | freshness check biocom PASS 확인 | 1번 deploy 후 실제 동작 검증 | `npx tsx scripts/check-source-freshness.ts --json` 운영 VM에서 실행 | 1번 PASS | 동일 script | NO |
| 3 | [[#Phase2-Sprint1]] | time_waiting | Codex | confirmed_purchase no-send candidate prep BigQuery guard 재실행 | canary 24h 후 BigQuery already_in_ga4 매칭률 변화 확인 | `npm --prefix backend run agent:confirmed-purchase-prep` (BigQuery guard 활용) | canary 24h PASS | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | NO |
| 4 | [[#Phase2-Sprint2]] | auto_ready | Codex | source_group별 funnel quality BigQuery 분석 | Google vs Meta vs Organic 결제 단계 누락이 광고 품질인지 추적 누락인지 분리 | `bq query` 7/14/30일 GA4 raw event 비교 (job project = project-dadba7dd) | BigQuery 권한 (보유) | [[../gdn/!gdnplan_new]] Phase6-Sprint1 | NO |
| 5 | [[#Phase3-Sprint1]] | blocked_data | TJ + Codex | AIBIO BigQuery 연결 여부 결정 | AIBIO는 현재 Supabase 정본. GA4 raw event를 BigQuery에서도 보려면 GA4 Link 추가 또는 별 project | TJ가 AIBIO GA4 property `326993019`의 BigQuery Link 상태 확인 + 우리 SA에 권한 부여 결정 | TJ 사업 판단 (Supabase로 충분한지 vs BigQuery 확장 필요) | [[../aibio/aibiodb]] | YES |
| 6 | [[#Phase3-Sprint2]] | approval_waiting | TJ | 과거 table 보존 정책 결정 | GA4 BigQuery 기본 retention 14개월 후 자동 삭제. 장기 보관 필요한 table은 별 project로 copy | TJ가 보관기간 기준 결정 + Codex가 backup script 작성 | TJ 비즈니스 결정 | [[!bigquery_old]] §"이관 범위 추천" | YES |
| 7 | [[#Phase4-Sprint1]] | parked_red | TJ + Codex | streaming export 도입 검토 | Real-time 분석 필요할 때 daily 외에 streaming 추가 | GA4 Admin > BigQuery Links > Streaming 활성화 | 비용 영향 + Daily만으로 충분한지 평가 | [[!bigquery_old]] §"이관 범위 추천" | YES |

## 현재 기준

| 항목 | 값 |
|---|---|
| 정본 문서 | [[!bigquery_new]] (이 파일) |
| 기존 문서 역할 | [[!bigquery_old]]는 v1.x legacy, 참고용 |
| 우리 SA | `seo-656@seo-aeo-487113.iam.gserviceaccount.com` |
| 우리 GCP project | `seo-aeo-487113` (SA 소속), `project-dadba7dd-0229-4ff6-81c` (job project), `hurdlers-naver-pay` (biocom dataset 소유) |
| 운영 backend SA key 위치 | `/home/biocomkr_sns/seo/repo/backend/.env` `GA4_BIOCOM_SERVICE_ACCOUNT_KEY` |
| biocom GA4 dataset (직접 export) | `hurdlers-naver-pay.analytics_304759974` (asia-northeast3) |
| biocom 우리쪽 backfill copy | `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` (asia-northeast3) |
| **biocom 신규 GA4 Link** | `project-dadba7dd-0229-4ff6-81c.analytics_304759974` (asia-northeast3, **2026-05-07 GA4 Admin에서 생성**, 첫 적재 대기) |
| coffee GA4 dataset | `project-dadba7dd-0229-4ff6-81c.analytics_326949178` (asia-northeast3) |
| aibio GA4 dataset | `project-dadba7dd-0229-4ff6-81c.analytics_326993019` (dataset 존재, 우리 SA query 권한 미완) |
| biocom 최신 events_ table (hurdlers 원본) | events_20260506 (last_mod 2026-05-07 00:39 UTC, 70,294 rows) |
| biocom 최신 events_ table (backfill copy) | events_20260506 (last_mod 2026-05-07 06:38 UTC, 70,294 rows — 100% 일치) |
| **biocom 신규 GA4 Link 첫 적재** | **✅ 2026-05-08 01:16 UTC 적재 시작. events_20260507 69,704 rows / purchase 63 (모두 homepage)** |
| AIBIO BigQuery query 권한 | **✅ 2026-05-08 부여됨** (events_20260507 423 rows 직접 query 확인) |
| backfill 적재 범위 | events_20260427 ~ events_20260506 (10일치) |
| backfill 적재 패턴 | 일괄 batch (2026-05-04 16:35 UTC 7일치, 2026-05-07 06:38 UTC 3일치) — daily 자동 아님 |
| 신규 GA4 Link 빈도 설정 | 매일 (스트리밍 미선택) |
| coffee 최신 events_ table | events_20260506 (last_mod 2026-05-07 01:35 UTC, 3,924 rows) |
| biocom 7일 purchase 추세 | 72 / 49 / 59 / 88 / 73 / 79 (5/1~5/6 일별, distinct_txn 1:1 매칭) |
| 운영 backend `sourceFreshness` 상태 | 옛 dist (jobProjectId 분리 미적용). biocom freshness check fail |
| 정상 동작 source | toss_local (sqlite), imweb_local (sqlite), attribution_ledger (sqlite), toss_operational (PG), playauto_operational (PG), ga4_bigquery_thecleancoffee (BigQuery) |

## 실제 개발 순서

Phase 번호는 작업 영역 history. 실제 실행은 아래 순서로.

1. **P0: 운영 backend `sourceFreshness.ts` 최신 deploy**
   - 목적: biocom GA4 freshness check 정상화 (jobProjectId 분리).
   - 본 agent 자율 가능 (errorHandler hardening 절차와 동일).
   - 효과: `check-source-freshness.ts --json` 실행 시 biocom 도 fresh로 동작.

2. **P0: biocom GA4 freshness PASS 검증**
   - 목적: 1번 deploy 검증. age < 36h, total_rows > 0.
   - 본 agent 자율.

3. **P1: confirmed_purchase no-send candidate prep 재실행 (BigQuery guard 활용)**
   - 목적: canary 24h+ paid_click_intent_ledger 후 ConfirmedPurchasePrep의 already_in_ga4 / missing_google_click_id 변화 측정.
   - 입력: BigQuery `events_*` raw + `paid_click_intent_ledger` + `imweb_orders` (운영 PG read-only).
   - 본 agent 자율.

4. **P1: Channel funnel quality BigQuery 분석**
   - 목적: source_group (paid_google / paid_meta / organic / direct / paid_tiktok) 별 sessions / engagement / view_item / add_to_cart / begin_checkout / add_payment_info / purchase rate 비교.
   - 입력: BigQuery `events_*` raw 7/14/30일.
   - 산출: gdn/channel-funnel-quality-meta-google-organic-{date}.md.
   - 본 agent 자율.

5. **P2: AIBIO BigQuery 연결 검토**
   - 현재: AIBIO GA4 property `326993019`는 BigQuery Link가 없거나 우리 SA 권한 없음.
   - AIBIO는 Supabase가 정본 (43 table). BigQuery 추가 연결이 필요한지 TJ 판단.
   - 옵션 A: GA4 Admin에서 BigQuery Link 추가 + 우리 SA 권한 부여.
   - 옵션 B: Supabase만 유지하고 BigQuery 미연결.

6. **P2: 과거 table 보존 정책 결정**
   - GA4 BigQuery 기본 14개월 retention 후 자동 삭제.
   - 장기 보존 필요한 table은 별 project (예: `seo-aeo-487113`)에 copy.
   - TJ 결정.

7. **P3: streaming export 도입 검토**
   - Daily만으로 attribution 분석은 충분 (T+24~36h 지연 수용 가능).
   - 실시간 분석 필요해지면 streaming 활성화. 비용 영향 별 검토.

## Active Action Board

| Priority | Status | Phase/Sprint | 작업 | 다음 액션 | 담당 | 컨펌 |
|---|---|---|---|---|---|---|
| P0 | auto_ready | Phase1-Sprint1 | sourceFreshness 최신 deploy | 본 agent SSH로 build → scp → restart | Codex | NO |
| P0 | time_waiting | Phase1-Sprint2 | freshness check PASS 검증 | 1번 deploy 직후 자동 실행 | Codex | NO |
| P1 | time_waiting | Phase2-Sprint1 | ConfirmedPurchasePrep 재실행 | canary 24h+ PASS 후 자동 | Codex | NO |
| P1 | auto_ready | Phase2-Sprint2 | Channel funnel quality 분석 | bq query 7/14/30일 source_group별 | Codex | NO |
| P2 | blocked_data | Phase3-Sprint1 | AIBIO BigQuery 연결 결정 | TJ 사업 판단 | TJ + Codex | YES |
| P2 | approval_waiting | Phase3-Sprint2 | 과거 table 보존 정책 | TJ 보관기간 결정 | TJ | YES |
| P3 | parked_red | Phase4-Sprint1 | streaming export 검토 | 실시간 분석 필요 시 재개 | TJ + Codex | YES |

## Approval Queue

현재 open approval: **없음**.

future approval (재개 조건 미충족):

| 항목 | 재개 조건 |
|---|---|
| AIBIO BigQuery 연결 | TJ 사업 판단 (Supabase 충분 vs BigQuery 확장) |
| 과거 table 장기 보존 | TJ 보관기간 결정 |
| streaming export | 실시간 분석 요구 발생 시 |

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-04-27 KST | BigQuery 현재 판단 v1 | hurdlers read 권한 받기 우선 결정 |
| 2026-05-05 00:46 KST | 서비스 계정 권한 재확인 | seo-656 SA에 hurdlers analytics_304759974 Data Viewer 부여됨 |
| 2026-05-05 23:14 KST | confirmed_purchase no-send dry-run | hurdlers source + project-dadba7dd job 패턴 검증. 운영 결제완료 619건 GA4 매칭 476/143 |
| 2026-05-07 23:55 KST | 본 sprint BigQuery 적재 상태 직접 검증 | biocom events_20260506 70,294 rows. coffee events_20260506 3,924 rows. AIBIO 미연결. 7일 purchase 49~88 / day, transaction_id 1:1 매칭 |
| 2026-05-08 00:05 KST | biocom 이전 (`project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`) 검증 | 10일치(events_20260427~20260506) backfill copy. row_count + purchase + distinct_txn 모두 hurdlers와 100% 일치. backfill 시각 2026-05-04 16:35 UTC + 2026-05-07 06:38 UTC 일괄. AIBIO `analytics_326993019` dataset 등장(권한 부여 미완) |
| 2026-05-08 00:35 KST | biocom 신규 GA4 BigQuery Link 적재 상태 직접 확인 | 스크린샷 evidence: 2026-05-07 GA4 Admin에서 `project-dadba7dd-0229-4ff6-81c` 위치로 새 Link 생성 (매일/스트리밍 미선택). 직접 query 결과: `analytics_304759974` 단독 dataset 미존재, events_20260507/intraday 모두 미적재. Google daily export T+24~36h 정책에 따라 5/8 새벽~오전 첫 적재 예상. 본 agent 자동 polling 모니터링 |
| 2026-05-08 10:16 KST | 새 GA4 Link 첫 적재 + TJ가 우리 SA에 BigQuery 사용자 role 부여 + 적재 정상 확인 | dataset `analytics_304759974` 등장 (last_mod 2026-05-08 01:16 UTC). events_20260507 row 69,704, purchase 63 (모두 homepage), view_item 4,101, add_payment_info 105, users 11,571. AIBIO `analytics_326993019` 도 query 가능 — events_20260507 423 rows, events_20260506 518 rows. 새 GA4 Link가 hurdlers보다 빠르게 적재. 5/7 NPay GA4 fire 0건 패턴 재확인 |

## Parked / Later

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| AIBIO BigQuery raw event 분석 | Supabase 정본으로 충분 | TJ 결정 + GA4 Admin Link 추가 |
| 과거 14개월 이전 GA4 raw 보관 | 비용/저장 정책 미결정 | TJ 비즈니스 판단 |
| streaming export | Daily 충분 | 실시간 요구 발생 |
| GA4 BigQuery 새 link 생성 (병행) | 링크 한도 도달 (TJ 화면 확인) | 현재 링크 삭제 + 재생성 별 승인 |

## Source / Window / Freshness / Confidence

| 영역 | Source | Window | Freshness | Confidence |
|---|---|---|---|---|
| biocom GA4 raw events 적재 | hurdlers-naver-pay.analytics_304759974 | 2026-05-06 daily | events_20260506 70,294 rows, last_mod 2026-05-07 00:39 UTC | 0.94 |
| coffee GA4 raw events 적재 | project-dadba7dd-0229-4ff6-81c.analytics_326949178 | 2026-05-06 daily | events_20260506 3,924 rows, last_mod 2026-05-07 01:35 UTC | 0.94 |
| biocom 7일 purchase 추세 | hurdlers-naver-pay.analytics_304759974.events_* | 2026-05-01~2026-05-06 | distinct_txn 1:1 매칭 (중복 없음) | 0.92 |
| AIBIO BigQuery 연결 상태 | (없음) | - | dataset 미존재 / 권한 없음 | 0.85 |
| 운영 backend freshness | 운영 VM SSH `npx tsx scripts/check-source-freshness.ts` | 2026-05-07 14:54 UTC | biocom error (jobs.create permission denied) | 0.93 |
| SA 권한 | bq cli `gcloud auth activate-service-account` | 2026-05-07 23:55 KST | 활성화 PASS, hurdlers dataset Read PASS, project-dadba7dd jobs.create PASS | 0.95 |

## Phase별 상세

### Phase1-Sprint1

**이름**: 운영 backend sourceFreshness 최신 deploy

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: `backend/src/sourceFreshness.ts` 최신 코드 (jobProjectId 분리 + asia-northeast3 location 명시)를 운영 VM dist에 반영. biocom GA4 freshness check 정상 동작.

본 agent 자율 진행 가능. errorHandler hardening deploy 절차와 동일:

1. backup `dist/sourceFreshness.js` + sha256.
2. local `npm --prefix backend run build`.
3. scp `dist/sourceFreshness.js` → 운영 VM.
4. PM2 restart `--update-env`.
5. `npx tsx scripts/check-source-freshness.ts --json` 으로 biocom 정상 확인.

### Phase1-Sprint2

**이름**: biocom GA4 BigQuery freshness PASS 검증

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: 1번 deploy 후 운영 VM에서 freshness check 결과가 biocom = fresh / age < 36h로 나오는지 검증.

성공 기준:
- `ga4_bigquery_biocom` status = `fresh`
- ageHours < 36
- totalRows > 60,000 (보통 daily 60K~70K rows)
- note에 `events_2026MMDD; purchase N; distinct txn N` 형식 응답

### Phase2-Sprint1

**이름**: confirmed_purchase no-send candidate prep 재실행 (BigQuery guard 활용)

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: canary 24h 후 paid_click_intent_ledger 누적 결과로 ConfirmedPurchasePrep의 already_in_ga4 매칭률 + missing_google_click_id 변화 측정.

입력:
- 운영 sqlite `paid_click_intent_ledger` (canary 24h 누적, 추정 ~3,400 rows)
- 운영 PG `tb_iamweb_users` / `tb_playauto_orders` (read-only)
- BigQuery `hurdlers-naver-pay.analytics_304759974.events_*` (purchase event raw)
- 운영 sqlite `imweb_orders` / `attribution_ledger` (read-only)

산출:
- `data/google-ads-confirmed-purchase-candidate-prep-20260508.json`
- `gdn/google-ads-confirmed-purchase-candidate-prep-20260508.md`

### Phase2-Sprint2

**이름**: Channel funnel quality (Meta vs Google vs Organic) BigQuery 분석

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: source_group별 funnel quality 비교. Google ROAS gap이 광고 품질인지 추적 누락인지 분리.

입력:
- BigQuery `hurdlers-naver-pay.analytics_304759974.events_*` (7/14/30일)
- BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*` (coffee 비교 컨텍스트)

분석 항목:
- sessions, users, avg engagement time
- view_item / add_to_cart / begin_checkout / add_payment_info / purchase rate
- 90% scroll event rate (GA4 기본은 90%만)
- internal confirmed match rate (transaction_id 1:1)
- NPay click rate

산출:
- `gdn/channel-funnel-quality-meta-google-organic-20260508.md`
- `data/channel-funnel-quality-20260508.json`

### Phase3-Sprint1

**이름**: AIBIO BigQuery 연결 검토

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: AIBIO GA4 property `326993019`의 BigQuery 연결 여부와 우리 SA 권한을 결정.

현재:
- `analytics_326993019` dataset이 hurdlers / project-dadba7dd / seo-aeo-487113 어디에도 권한 미부여 또는 미존재.
- AIBIO 정본은 Supabase (43 table).

결정 옵션:
- A. GA4 Admin에서 BigQuery Link 추가 → 우리 SA 권한 부여.
- B. Supabase만 유지, BigQuery 미연결.

조건: TJ 사업 판단.

### Phase3-Sprint2

**이름**: 과거 table 보존 정책 결정

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: GA4 BigQuery 기본 14개월 retention 후 자동 삭제 정책 대비 장기 보존 필요한 table을 별 project로 copy.

현재 retention:
- hurdlers-naver-pay.analytics_304759974: GA4 default 14개월
- project-dadba7dd.analytics_326949178: GA4 default 14개월

옵션:
- A. 12개월 시점에서 우리 project (`seo-aeo-487113`)로 copy job 자동 실행
- B. 14개월 자동 삭제 수용 (보존 무게 작음)

조건: TJ 비즈니스 판단.

### Phase4-Sprint1

**이름**: streaming export 도입 검토

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: Daily export 외에 streaming export 활성화 검토.

현재: Daily만 활성화. T+24~36h 지연.

조건:
- 실시간 attribution 또는 24h 이내 분석 요구 발생.
- 비용 영향 (streaming export 별 비용 적용).
- TJ 결정.
