# /total 월 매출 판단 화면 운영 메모

작성 시각: 2026-05-13 23:40 KST
상태: active working note
Owner: Codex
대상 화면: `http://localhost:7010/total`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - data/!bigquery_new.md
  lane: Green
  allowed_actions:
    - frontend 로딩 UI 개선
    - /total source warning 문구 정정
    - BigQuery read-only postcheck
    - 로컬 문서 작성
  forbidden_actions:
    - 운영DB write
    - VM Cloud deploy/restart
    - Google Ads upload/send
    - GA4/Meta/TikTok/Naver 전송
    - GTM publish
  source_window_freshness_confidence:
    source: "로컬 backend read-only sourceFreshness + biocom BigQuery postcheck"
    window: "2026-05-13 23:01~23:03 KST"
    freshness: "본 문서 작성 직전 직접 실행"
    site: "biocom"
    confidence: 0.9
```

## 10초 요약

`/total` 화면은 운영자가 이번 달 매출을 광고 예산 판단에 쓸 수 있는지 보는 화면이다.
이번 점검에서 데이터 로딩 중에는 단계형 진행률을 보여주도록 바꿨다.
또 화면의 `GA4 BigQuery 원본 — 연결 끊김 · biocom_ga4_bigquery_raw_permission_denied` 문구는 현재 사실과 맞지 않아 원인을 정리하고, 로컬 백엔드 연결까지 전환했다.

현재 결론은 이렇다.
GA4 BigQuery 자체는 끊긴 것이 아니다.
로컬 backend `sourceFreshness`는 이제 신규 biocom GA4 export dataset `project-dadba7dd-0229-4ff6-81c.analytics_304759974`를 current source로 보고, 과거 hurdlers export 복사본 `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`을 archive source로 함께 표시한다.
coverage는 `events_20240909~events_20260506` archive + `events_20260507~events_20260512` current로 끊김 없이 이어지고, `/total` 로컬 API도 이 live freshness 결과를 받아 `ga4_bigquery_biocom=fresh`로 표시한다.
단, GA4는 유입 교차검증 source이지 실제 결제완료 매출 정본이 아니므로 `/total` 예산 판단 매출에 더하지 않는다.
이후 승인에 따라 VM Cloud 운영 backend에도 sourceFreshness 전환을 배포했고, 공개 API에서 `fresh`를 확인했다.
화면 상단에는 `바이오컴 / 더클린커피` 탭을 추가했다. 더클린커피 탭은 아직 월별 채널 분석이 아니라, 기존 correction line의 최근 30일 actual 참고 화면이다.
따라서 바이오컴 탭의 첫 화면에서는 기존 `참고용 매출 (예산 판단 제외) ₩1,555만` 카드를 제거한다. 이 금액은 바이오컴 매출이 아니라 더클린커피 correction line 15,547,500원에서 온 값이므로, 사이트를 분리한 뒤에도 바이오컴 첫 화면에 남아 있으면 cross-site 매출처럼 오해된다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint        | 무엇을 하는가                                      | 왜 하는가                                                               | 어떻게 진행하는가                                                          | 지금 상태    | 현재 진척률 % | 100% 조건                                                     | 다음 단계 / 담당                            | 승인 필요 여부                        | Source 문서                                          |
| -------: | ------------------- | -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- | -------: | ----------------------------------------------------------- | ------------------------------------- | ------------------------------- | -------------------------------------------------- |
|       P0 | [[#Phase1-Sprint1]] | `/total` 로딩 중 진행률을 보여준다                      | 사용자가 10~15초 동안 멈춘 화면으로 오해하지 않게 한다                                   | 프론트에 단계형 진행률과 현재 조회 단계를 추가한다                                       | 로컬 코드 반영 |      90% | 로컬 화면에서 진행률이 올라가고 데이터 도착 후 카드가 정상 표시된다                      | Codex: typecheck/browser smoke        | NO, Green                       | `frontend/src/app/total/page.tsx`                  |
|       P1 | [[#Phase1-Sprint2]] | GA4 BigQuery 경고 문구를 현재 상태로 정정한다              | 권한 없음과 source 전환 미완료는 다른 문제다                                        | `/total`이 live `sourceFreshness` 결과를 받아 표시한다                       | 로컬 PASS  |     100% | 화면 경고가 `permission_denied`를 쓰지 않고, fresh면 경고에서 빠진다          | Codex: 운영 반영 승인안 작성                   | NO, Green local / YES if deploy | `backend/src/routes/total.ts`                      |
|       P2 | [[#Phase2-Sprint1]] | biocom GA4 freshness source를 신규 export로 전환한다 | 최신 `events_20260512`가 있는데 옛 허들러스 `events_20260506`을 보면 stale 오판이 난다 | current export + historical backfill segment를 하나의 coverage로 표시한다   | 운영 PASS  |     100% | `/total`과 sourceFreshness가 신규 daily export를 기준으로 fresh 표시한다 | Codex: 24h freshness 관찰               | 완료                              | [[../data/!bigquery_new]]                          |
|       P3 | [[#Phase2-Sprint2]] | 바이오컴/더클린커피 탭을 만든다                            | 한 화면에서 두 사이트를 클릭해 비교하되, source 의미를 섞지 않게 한다                         | biocom API 응답의 coffee correction line을 별도 탭으로 렌더링한다                | 로컬 PASS  |      90% | 탭 클릭 가능, coffee 탭에서 500 API 호출 없음, 참고용 actual line 표시       | Codex: 운영 frontend deploy 승인안 필요 시 작성 | NO, Green local / YES if deploy | `frontend/src/app/total/page.tsx`                  |
|       P4 | [[#Phase2-Sprint3]] | 바이오컴 미분류 매출을 더 구체화한다                         | `어디서 왔는지 모르는 매출`이 크지만 현재 원인이 3개 큰 덩어리라 실행 지시가 부족하다                  | unknown reason을 수집 누락/채널 증거 없음/구독 재결제별로 더 세분화하고 next evidence를 붙인다 | 설계 완료    |      70% | 화면에서 “왜 모르는지”와 “무엇을 고치면 줄어드는지”가 원인별로 보인다                    | Codex: backend aggregate patch        | NO, Green local                 | `backend/scripts/monthly-evidence-join-dry-run.ts` |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. `/total` 로딩 UI 로컬 검증
- 무엇을 하는가: `http://localhost:7010/total`에서 조회 버튼을 눌렀을 때 진행률 막대가 0~100%로 움직이는지 확인한다.
- 왜 하는가: 지금 화면은 운영DB와 VM Cloud 조회가 오래 걸릴 때 사용자가 장애로 오해할 수 있다.
- 어떻게 하는가: frontend typecheck 또는 build를 실행하고, 가능하면 브라우저에서 `/total`을 다시 열어 로딩 상태를 본다.
- 성공 기준: 진행률 숫자, 막대, 단계명이 보이고 데이터 도착 후 기존 카드가 정상 표시된다.
- 실패 시 다음 확인점: CSS module class 누락, Next build error, API 응답 지연/500.
- 승인 필요 여부: NO, Green.
- 산출물: `frontend/src/app/total/page.tsx`, `frontend/src/app/total/page.module.css`.
- 진척률에 미치는 영향: `/total` UX 90% -> 95%.
- 의존성: 독립 실행 가능.

#### A2. GA4 BigQuery 경고 문구 smoke
- 무엇을 하는가: `/api/total/monthly-channel-summary` 응답의 `ga4_bigquery_biocom`이 live source freshness 결과를 받는지 확인한다.
- 왜 하는가: `permission_denied`는 과거 blocker라 현재 사용자 판단을 흐린다.
- 어떻게 하는가: backend typecheck 후 local API를 curl로 확인한다.
- 성공 기준: status는 `fresh`, latest는 `2026-05-12T23:59:57+09:00`, fallback reason은 `null`이다.
- 실패 시 다음 확인점: local backend가 옛 프로세스인지, dist가 아닌 tsx dev가 실행 중인지 확인한다.
- 승인 필요 여부: NO, Green.
- 산출물: `backend/src/routes/total.ts`.
- 진척률에 미치는 영향: `/total` 데이터 신뢰도 표현 85% -> 100%.
- 의존성: 독립 실행 가능.

### Approval Needed

#### B1. 운영 반영 시 sourceFreshness 전환 승인
- 무엇을 하는가: biocom GA4 freshness source를 신규 dataset `project-dadba7dd-0229-4ff6-81c.analytics_304759974` 기준으로 전환한다.
- 왜 하는가: 신규 dataset은 `events_20260512`까지 fresh인데, 현재 backend sourceFreshness는 옛 허들러스 원본 `events_20260506`을 보고 stale로 판단한다.
- 어떻게 하는가: 로컬에서는 `backend/src/sourceFreshness.ts`를 current export + historical backfill segment 구조로 전환했고, 운영 반영은 backend deploy/restart 승인안으로 진행한다.
- 성공 기준: `ga4_bigquery_biocom`이 신규 dataset 기준 fresh, latest table `events_20260512` 이상, purchase와 distinct transaction_id가 1:1이다.
- 실패 시 다음 확인점: 신규 GA4 Link daily export 중단, BigQuery job project 권한, dataset location mismatch.
- 승인 필요 여부: YES, Yellow. 운영 backend deploy/restart가 들어가면 TJ님 승인 필요.
- 산출물: `backend/src/sourceFreshness.ts`, sourceFreshness postcheck.
- 진척률에 미치는 영향: `/total` 데이터 신뢰도 표현 90% -> 100% local, 운영은 deploy 후 100%.
- 의존성: local smoke 후 운영 승인.

### Blocked/Parked

#### P1. GA4 raw를 예산 판단의 primary로 쓰는 일
- 무엇을 하는가: 보류한다.
- 왜 하는가: GA4 BigQuery는 유입/세션 교차검증 source이지 실제 결제완료 매출 정본이 아니다.
- 어떻게 하는가: 운영DB PostgreSQL의 결제완료/토스 정합성을 primary로 유지하고, GA4는 traffic source cross-check로만 쓴다.
- 성공 기준: `/total`의 광고 예산 판단 매출에 GA4 purchase revenue가 더해지지 않는다.
- 실패 시 다음 확인점: frontend copy와 backend contract에서 GA4 revenue 합산 여부를 검색한다.
- 승인 필요 여부: NO, 정책 유지.
- 산출물: 이 문서의 원칙.
- 진척률에 미치는 영향: 안전성 유지.
- 의존성: 없음.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase1-Sprint1

**이름**: `/total` 로딩 진행률 UI

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

- 무엇을 하는가: `/total` 화면이 데이터를 불러오는 동안 진행률 숫자, 진행 막대, 단계명을 보여준다.
- 왜 하는가: 월별 집계는 운영DB PostgreSQL과 VM Cloud 장부를 같이 읽어 10초 이상 걸릴 수 있다. 단순 문구만 있으면 사용자는 멈춘 화면으로 판단한다.
- 어떻게 하는가: frontend `useEffect`의 fetch lifecycle에 맞춰 7%에서 시작해 92%까지 점진 진행하고, 응답 성공 시 100%로 닫는다.
- 현재 진척률 %: 90%.
- %를 올리려면: browser smoke에서 실제 로딩 화면을 캡처하고 모바일 폭에서도 텍스트가 겹치지 않는지 확인한다.
- 완료한 것: 로컬 코드에 단계형 진행률 추가.
- 남은 것: build/typecheck/browser smoke.
- 산출물: `frontend/src/app/total/page.tsx`, `frontend/src/app/total/page.module.css`.

### Phase1-Sprint2

**이름**: GA4 BigQuery 경고 문구 현재화

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

- 무엇을 하는가: `/total`의 `GA4 BigQuery 원본` 경고가 과거 권한 문제로 보이지 않게 정정한다.
- 왜 하는가: `permission_denied`는 “권한이 없어서 못 읽는다”는 뜻인데, 2026-05-13 23:02 KST read-only postcheck에서는 신규 export dataset이 정상 조회된다.
- 어떻게 하는가: `/total` route가 static `ga4_bigquery_raw` row 대신 live `sourceFreshness`의 `ga4_bigquery_biocom` row를 받게 한다.
- 현재 진척률 %: 100%.
- %를 올리려면: 운영 backend 배포 승인 후 운영 화면에서도 동일하게 확인한다.
- 완료한 것: backend route 연결, local API smoke.
- 남은 것: 운영 반영 승인 여부 판단.
- 산출물: `backend/src/routes/total.ts`.

### Phase2-Sprint1

**이름**: biocom GA4 sourceFreshness 신규 export 전환

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

- 무엇을 하는가: backend source freshness의 biocom BigQuery source를 신규 GA4 export dataset으로 전환하고, historical backfill과 이어서 표시한다.
- 왜 하는가: 신규 dataset `project-dadba7dd-0229-4ff6-81c.analytics_304759974`는 `events_20260512`까지 살아 있지만, 현재 sourceFreshness는 옛 허들러스 원본 `hurdlers-naver-pay.analytics_304759974.events_20260506`을 보고 stale로 나온다.
- 어떻게 하는가: `backend/src/sourceFreshness.ts`의 `ga4_bigquery_biocom`을 current export로 바꾸고, `analytics_304759974_hurdlers_backfill`을 archive segment로 추가한다.
- 현재 진척률 %: 95%.
- %를 올리려면: 운영 backend deploy/restart 승인 후 production API에서 같은 결과를 확인한다.
- 완료한 것: read-only postcheck, local patch, backend typecheck, `/api/source-freshness` smoke, `/api/total/monthly-channel-summary` smoke.
- 남은 것: 운영 반영 승인안과 deploy/restart 여부 판단.
- 산출물: `backend/src/sourceFreshness.ts`, `backend/src/routes/total.ts`, `data/biocom-bigquery-link-postcheck-20260513-total-doc-check.md`.

### Phase2-Sprint2

**이름**: 바이오컴 / 더클린커피 사이트 탭

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

- 무엇을 하는가: `/total` 상단에 `바이오컴 / 더클린커피` 탭을 추가한다.
- 왜 하는가: TJ님이 같은 화면에서 두 사이트를 클릭해 볼 수 있어야 하지만, 더클린커피를 바이오컴 월별 채널 분석과 같은 계약으로 오해하면 안 된다.
- 어떻게 하는가: frontend state로 탭을 전환한다. fetch는 기존 `site=biocom`을 유지하고, 더클린커피 탭은 응답의 `correction_lines.items[site=thecleancoffee]`만 사용한다.
- 현재 진척률 %: 92%.
- %를 올리려면: 운영 frontend deploy 승인 후 `https://biocom.ainativeos.net`에서도 탭 클릭을 확인한다.
- 완료한 것: 로컬 탭 UI, 더클린커피 참고 화면, Playwright click smoke, 바이오컴 탭의 cross-site 참고 매출 카드 제거.
- 남은 것: 운영 frontend 반영 여부 판단.
- 산출물: `frontend/src/app/total/page.tsx`, `frontend/src/app/total/page.module.css`, `gdn/total-site-tabs-coffee-reference-20260513.md`.

#### `참고용 매출 ₩1,555만`의 출처와 처리

- 출처: `data/project/total-correction-line-contract-20260513.json`의 `source_line_items.coffee_site_summary_30d.amount_krw = 15,547,500`.
- source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders`, site `thecleancoffee`.
- 상태: `included_with_warning`.
- 의미: 더클린커피 최근 30일 NPay actual correction line.
- 바이오컴 예산 ROAS 포함 여부: `included_in_budget_roas=false`.
- 처리: 더클린커피를 별도 탭으로 뺐으므로 바이오컴 첫 화면의 `참고용 매출 (예산 판단 제외)` 카드에서는 제거한다. 더클린커피 탭에서만 보여준다.

### Phase2-Sprint3

**이름**: 바이오컴 unknown revenue drilldown v0.3 + 네이버 자연검색 근거 분리

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

- 무엇을 하는가: 바이오컴의 `어디서 왔는지 모르는 매출`을 운영자가 고칠 수 있는 blocker 단위로 쪼개고, 네이버 자연검색 가능성은 주문 단위/세션 단위/aggregate 단위로 분리한다.
- 왜 하는가: unknown이 큰 숫자로만 보이면 광고 예산 조정이나 추적 보강 액션이 나오지 않는다. 특히 네이버 referrer가 보여도 `NaPm` 같은 유료 표식이 있으면 자연검색으로 잡으면 안 된다.
- 어떻게 하는가: 로컬 backend dry-run이 운영DB 월별 결제완료 spine, VM Cloud `attribution_ledger`, 로컬DB 보조 캐시를 read-only로 대조해 aggregate만 반환한다. 화면은 `unknown_reason_details`, `naver_organic_evidence`, `subscription_acquisition_summary`를 사람 말로 보여준다.
- 현재 진척률 %: 90%.
- %를 올리려면: 운영 frontend/backend 배포 승인 후 live `/total`에서 같은 contract가 보이는지 확인한다.
- 완료한 것: backend contract v0.5 구현, frontend table 표시, backend typecheck PASS, frontend build PASS, local API smoke PASS.
- 남은 것: 운영 배포는 하지 않았다. Search Advisor 실제 query/page export 연동과 구독 최초 획득 archive lookup은 다음 Green/Yellow 작업이다.
- 산출물: `backend/scripts/monthly-evidence-join-dry-run.ts`, `backend/src/routes/total.ts`, `frontend/src/app/total/page.tsx`, `gptconfirm/gpt0514-1/`.

#### 현재 unknown 숫자

source: 로컬 backend `/api/total/monthly-channel-summary?site=biocom&month=2026-05&mode=dry_run`
window: 2026-05-01 <= KST < 2026-06-01
freshness: 2026-05-14 KST local smoke
confidence: B+; 운영DB 월별 결제완료 spine + VM Cloud 유입 evidence 대조, no write/no send

- 전체 actual spine: 941건 / 204,006,680원.
- 분류된 매출: 431건 / 80,373,978원.
- unknown total: 510건 / 123,632,702원.
- `payment_success_order_key_normalize_failed`: 334건 / 89,337,146원.
- `self_or_internal_referrer_only`: 71건 / 20,914,719원.
- `utm_present_but_invalid_rule`: 75건 / 11,386,862원.
- `acquisition_archive_lookup_needed`: 26건 / 1,000,875원.
- `checkout_started_but_payment_success_missing`: 4건 / 993,100원.

#### 네이버 자연검색 판정

- VM Cloud `attribution_ledger`에서 2026년 5월 네이버 referrer aggregate는 175건이다.
- 그중 검색 referrer 144건은 모두 `NaPm` 또는 브랜드검색 표식이 있어 자연검색 매출로 분류하지 않았다.
- 유료 표식 없는 네이버 비검색 referrer는 2건이지만 검색 referrer가 아니므로 예산 판단 매출에서 제외했다.
- Naver Search Advisor는 검색어/페이지/day aggregate 근거로만 사용한다. 주문 단위 매출 정본도, 자동 채널 배정 source도 아니다.

#### 구독/정기결제 판정

- 2회차 이후 구독/정기결제는 유입 분석 대상에서 빼고 `subscription_recurring` 매출로 분리했다: 125건 / 5,441,500원.
- 첫 구독 시작 주문 중 과거 유입 archive lookup이 필요한 건은 26건 / 1,000,875원이다.
- 회원 raw 값은 출력하지 않고 내부 join 가능 여부만 aggregate로 본다.

#### backend contract v0.5

```json
{
  "unknown_reason_details": [
    {
      "rootReason": "vm_payment_success_missing",
      "detail": "payment_success_order_key_normalize_failed",
      "orders": 334,
      "revenue": 89337146,
      "nextEvidenceNeeded": "VM Cloud attribution_ledger payment_success coverage",
      "recommendedFix": "server-side payment_success capture 또는 order id normalize rule 점검",
      "confidence": "C"
    }
  ],
  "naver_organic_evidence": [
    {
      "label": "naver_search_referrer_paid_marker_excluded",
      "orders": 144,
      "revenue": null,
      "useForBudgetRoas": "no"
    }
  ],
  "subscription_acquisition_summary": {
    "renewable_order_count": 125,
    "renewable_revenue": 5441500,
    "archive_lookup_needed": 26,
    "archive_lookup_needed_revenue": 1000875
  }
}
```

주의:

- raw order id, payment key, email, phone, member_code는 절대 응답에 싣지 않는다.
- 금액/건수 aggregate만 화면에 표시한다.
- GA4 purchase revenue로 unknown을 채우지 않는다. GA4는 교차검증 source일 뿐 actual 매출 source가 아니다.

## 근거

### 2026-05-13 직접 확인

- 신규 biocom GA4 export dataset: `project-dadba7dd-0229-4ff6-81c.analytics_304759974`
- 최신 daily table: `events_20260512`
- rows: 49,111
- purchase: 64
- distinct transaction_id: 64
- max event time: 2026-05-12 23:59:57 KST
- 판정: `new_export_daily_table_available`
- source: BigQuery read-only postcheck
- confidence: A-

### sourceFreshness 전환 후 local smoke

- source: backend local `/api/source-freshness`
- `ga4_bigquery_biocom.status`: `fresh`
- current table: `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_20260512`
- latest event: `2026-05-12T23:59:57+09:00`
- ageHours: 23.3
- archive segment: `analytics_304759974_hurdlers_backfill.events_20240909~events_20260506`, 605 tables
- current segment: `analytics_304759974.events_20260507~events_20260512`, 6 tables
- boundary: contiguous
- local `/total` source_freshness: `ga4_bigquery_biocom=fresh`, confidence `A`, fallback reason `null`

## 금지선

- GA4 BigQuery는 actual 매출 정본이 아니다.
- `/total` 예산 판단 매출에는 GA4 purchase revenue를 더하지 않는다.
- 운영DB write, BigQuery write/copy/delete, GA4 Link 변경, 광고 플랫폼 전송, GTM publish는 하지 않았다.

## 2026-05-14 네이버 광고 UTM/NaPm 추적 감사

### 10초 요약

네이버 유입은 `/total`에서 자연검색과 광고가 섞일 위험이 있다.
이번 감사에서는 네이버 검색 referrer를 바로 자연검색 매출로 올리지 않고, `NaPm`, 브랜드검색, `n_*` 파라미터를 먼저 분리하는 기준을 만들었다.
결론은 “네이버 광고 흔적은 실제로 잡히고 있지만, 아직 예산 ROAS에 바로 넣을 단계는 아니다”이다.

### source/window/freshness/confidence

- 실제 매출 정본: 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`, 2026년 5월 KST, local backend dry-run, confidence B+.
- 채널 evidence: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `attribution_ledger`와 `site_landing_ledger`, 2026년 5월 KST, 2026-05-14 01:28 KST read-only SSH query, confidence B.
- 광고 플랫폼 참고값: 로컬DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`의 `naver_ads_daily`, 2026-05-06~2026-05-12 cache, confidence B-.
- GA4 교차검증: BigQuery `analytics_304759974_hurdlers_backfill` + `analytics_304759974`, last_7d/14d/30d ending 2026-05-12, confidence A- for traffic only.

### VM Cloud attribution_ledger 전체 aggregate

`/api/attribution/ledger` item 응답에서 보던 네이버 검색 referrer 144건은 제한된 slice 기준이다.
VM Cloud SQLite 전체 aggregate에서는 더 많은 네이버 evidence가 보인다.

| touchpoint | total | naver_any | search_referrer | NaPm | brandsearch | n_* | bridge key present |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| checkout_started | 2,199 | 629 | 476 | 488 | 229 | 15 | 1,790 |
| marketing_intent | 20,827 | 225 | 0 | 6 | 0 | 219 | 0 |
| payment_success | 854 | 216 | 157 | 158 | 100 | 8 | 854 |

### 분류 rule v1 결과

source: VM Cloud SQLite `attribution_ledger`, 2026년 5월 KST.

- paid_naver payment_success: 59건. `NaPm`, `n_*`, paid UTM 계열.
- naver_brandsearch payment_success: 100건. `brandsearch`, `naverbrandsearch` 계열.
- organic_naver_candidate payment_success: 39건. 네이버 검색 referrer는 있으나 paid marker가 없는 후보.
- naver_referrer_or_utm_only payment_success: 17건. 네이버 흔적은 있으나 확정 분류 불가.

중요:

- 위 숫자는 채널 evidence이며 예산 판단용 내부 confirmed ROAS 분자로 자동 포함하지 않는다.
- order/payment bridge가 닫히고 운영DB actual spine과 안전하게 join되는 별도 correction/reference line이 필요하다.

### UTM 판정불가 개선

backend dry-run에 `utmInvalidAudit`를 추가했고 `/total` API는 `evidence.utm_invalid_audit`를 반환한다.
frontend unknown drilldown에는 UTM 규칙 후보를 보여준다.

상위 후보:

- `topbanner_mo`: 9건 / 2,278,179원, 아직 unknown UTM.
- `kakao / plus`: 7건 / 1,868,783원, kakao reference 후보.
- `newmember_coupon`: 6건 / 1,652,500원, 아직 unknown UTM.
- `kakao / brand-message`: 26건 / 1,310,992원, kakao reference 후보.
- `youtube_biocom_dangdangcare_badhabit`: 11건 / 844,731원, Google/YouTube reference 후보.

또 `heavymetal` 안의 `meta`처럼 단어 일부가 광고 플랫폼으로 오판되는 문제를 줄이도록 token 기준 UTM family matching을 넣었다.

### 네이버 광고 URL 표준화 필요

광고 URL에는 최소 아래 파라미터를 표준으로 붙이는 것이 맞다.

```text
utm_source=naver
utm_medium=cpc 또는 brandsearch
utm_campaign=<campaign_type>_<campaign_id>
utm_content=<adgroup_or_creative>
utm_term=<keyword>
```

성공 기준:

- 신규 네이버 클릭이 VM Cloud `site_landing_ledger`에 UTM/NaPm과 함께 남는다.
- checkout/payment 단계의 VM Cloud `attribution_ledger`에도 같은 first-touch가 남는다.
- `/total`은 paid_naver / brandsearch / organic_naver_candidate / unknown_naver_like를 섞지 않는다.

### 다음 할일

#### Codex

1. `/total` 운영 반영 전 local browser smoke를 진행한다. 성공 기준은 UTM 후보 표가 unknown drilldown에서 보이고 예산 판단 제외 문구가 보이는 것이다. 승인 필요 여부: Green 로컬 없음, 운영 배포는 Yellow. 의존성: 로컬 서버. 추천 점수/자신감 91%.
2. VM Cloud 전체 aggregate 기반 Naver evidence endpoint 설계를 한다. 이유는 item slice 144건과 전체 aggregate 숫자가 달라 혼동이 생기기 때문이다. 성공 기준은 raw id 없이 class/touchpoint/count만 반환하는 contract다. 승인 필요 여부: 설계 없음, 운영 배포는 Yellow. 의존성: 없음. 추천 점수/자신감 87%.

#### TJ님

1. 네이버 광고 destination URL 표준화 승인 여부를 결정한다. 실제로 누를 화면은 Naver Ads 광고그룹/소재 URL 설정 화면이다. 바꾸는 설정은 랜딩 URL query string의 UTM 규칙이다. 바꾸면 네이버 paid/brandsearch/organic 분리가 안정되고, 안 바꾸면 unknown UTM과 mixed campaign hint가 계속 남는다. Codex가 대신 못 하는 이유는 실제 광고 계정 설정 변경이 외부 운영 변경이기 때문이다. 승인 필요 여부: YES, Yellow. 추천 점수/자신감 86%.

## 2026-05-14 gpt0514-3 — Naver evidence aggregate endpoint와 URL canary

### 10초 요약

네이버 유입 후보는 `/api/attribution/ledger` 제한 item slice 숫자와 VM Cloud 전체 aggregate 숫자를 섞으면 안 된다. 이번 작업에서 `/total`이 aggregate-only Naver evidence contract를 받을 수 있게 로컬 구현했고, 운영 반영 전에는 fallback 숫자를 “제한 item 기준”이라고 명확히 표시한다.

### source/window/freshness/confidence

- 실제 매출 정본: 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`, 2026년 5월 KST, local backend dry-run, confidence B+.
- 채널 evidence: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `attribution_ledger`와 `site_landing_ledger`, 2026년 5월 KST, 2026-05-14 02:03 KST read-only SSH query, confidence B.
- 로컬 endpoint smoke: 로컬DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`, response shape only, confidence A for shape only.

### 무엇을 바꿨는가

- backend에 `GET /api/attribution/ledger/naver-evidence-aggregate`를 추가했다.
- monthly evidence dry-run은 새 endpoint가 없으면 `limited_item_slice_fallback`으로 내려가되, warning을 남긴다.
- `/total` frontend는 Naver aggregate를 paid_naver / naver_brandsearch / organic_naver_candidate / naver_referrer_or_utm_only로 나눠 보여준다.
- `powerlink`, `shoppingsearch` UTM은 네이버 paid 후보로 분류할 수 있게 보강했다.

### 현재 기준 숫자

VM Cloud SQLite `attribution_ledger`, source `biocom_imweb`, capture_mode `live`, touchpoint `payment_success`, 2026년 5월 KST:

- 네이버 흔적: 216건.
- NaPm: 158건.
- 브랜드검색: 100건.
- `n_*`: 8건.
- 분류 후보: paid_naver 59건, naver_brandsearch 100건, organic_naver_candidate 39건, naver_referrer_or_utm_only 17건.
- 예산 ROAS 포함 여부: false. 모두 참고용 evidence다.

### 144 vs 216 혼선의 결론

- 144: 기존 `/api/attribution/ledger` item response에서 보던 제한 slice 숫자다.
- 216: VM Cloud SQLite 전체 `payment_success` aggregate 기준이다.
- 운영에 새 endpoint를 배포하면 `/total`은 216 기준 aggregate를 직접 받아 혼선을 줄일 수 있다.

### biocom.kr 직접 입력 유입 구분 여부

VM Cloud `site_landing_ledger`는 landing-level에서 direct/self_internal을 구분한다.

- 2026년 5월 window total: 2,930 rows.
- `channel_classified=direct`: 23 rows.
- no referrer + no UTM + no click id strict direct candidate: 7 rows.
- `channel_classified=self_internal`: 373 rows.

단, 이것은 아직 order-level confirmed revenue channel이 아니다. 운영DB 결제완료 spine과 VM Cloud `attribution_ledger payment_success` bridge가 닫히기 전에는 `biocom.kr 직접 입력 매출`로 예산 판단에 올리지 않는다.

### 네이버 URL canary

전체 광고 URL을 바꾸지 않고 1개 캠페인 또는 1개 광고그룹만 canary로 바꾼다.

성공 기준:

- 신규 클릭이 VM Cloud `site_landing_ledger`에 UTM/NaPm으로 남는다.
- checkout/payment 단계의 VM Cloud `attribution_ledger`에도 같은 first touch가 남는다.
- `/total`에서 paid_naver 또는 naver_brandsearch reference로 분리된다.
- budget ROAS에는 자동 포함하지 않는다.

실제 광고 URL 변경은 TJ님 승인 전 금지다.
