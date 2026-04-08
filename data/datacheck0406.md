# Data Check 0406

기준일: 2026-04-06 (`2026-04-08` 실행 업데이트 포함)
작성 목적: GA4, Toss, Imweb, PlayAuto 간 데이터 연관성과 현재 정합성 수준을 운영 관점에서 점검하고, 다음 액션과 신규 솔루션 필요 여부를 정리한다.
GPT 피드백 반영: `gptfeedback0406_1.md` (6건 반영 완료)
현행 구현 반영: `no1.md`, `gptfeedback_0406_2reply.md`, `gptfeedback_0408_1reply.md`, `gptfeedback_0408_2reply.md`

## 단계 요약 표 (`2026-04-08`)

> 데이터 정합성 작업은 "소스 확보 → 공통 키/장부 기준 고정 → 사이트별 대사 → 순매출 기준 확정 → 운영 루틴 고정" 순서로 본다.
> **현재 최우선 운영 기준 중 하나**: `WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문은 `payment_status=pending`으로 남기되, `confirmed_revenue`와 메인 ROAS/CAPI 기준값에서는 반드시 제외한다.

| Stage   | 단계명                | 현재 완성도 | 현재 판단 이유                                                                                                                                                                             | 다음에 할 것                                                                     |
| ------- | ------------------ | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Stage 1 | 원천 데이터 확보          |    84% | Toss/Imweb/local SQLite는 운영에 쓸 수준으로 확보됐고, BigQuery raw export도 `aibio`, `thecleancoffee`는 연결 완료됐다. coffee viewer 추가 후 `ga4-implementation-audit` 기준 `304759974 / 326949178 / 326993019` 3개 property Data API access도 모두 `OK`다. 다만 `biocom`은 기존 `hurdlers-naver-pay` 링크 상태 확인이 남아 있다. | `biocom` 기존 raw export dataset 존재 여부, 최근 `events_*` 적재, 조회 권한 가능 여부 확인      |
| Stage 2 | 공통 키와 ledger 기준 고정 |    89% | `order_id_base`, `payment_key`, `normalized_phone` 기준과 `status-aware ledger` 방향은 코드에 반영됐고, `att.ainativeos.net` 고정 endpoint도 실제 운영에 쓰고 있다. `biocom.kr`는 latest live `payment_success 491건`, all-three `7건 (1.43%)`, `thecleancoffee.com`도 `fetch-fix v2` 기준 all-three `1건 (1.61%)`, `aibio.ai`도 `form_submit v5` live `6건`과 10분 이내 재제출 적재를 확인했다. public `caller-coverage`도 `200`으로 열려 있다. 남은 핵심은 biocom GTM 오류와 `GA4 (not set)` historical row 진단 루틴 고정이다. | biocom payment page GTM 오류를 정리하고, `BigQuery raw export + hourly compare + caller coverage`를 같은 날짜 범위로 묶어 `GA4 (not set)` 원인을 분리 |
| Stage 3 | 사이트별 주문-결제 대사      |    82% | coffee는 `Imweb ↔ Toss` 직접 검증이 가능했고, `2026-04-08`에 biocom Imweb local sync도 실제로 돌려 최신 local `imweb_orders`가 `5750건`까지 늘었다. 이제 biocom도 reconcile 숫자를 age bucket으로 바로 읽을 수 있다. 다만 현재 적재 범위의 시작점이 `2026-01-27`이라 그 이전 주문 히스토리는 추가 확인이 필요하다. | biocom Imweb sync 범위가 왜 `2026-01-27`부터 시작되는지 확인하고, 필요한 경우 추가 범위/백필 전략 결정   |
| Stage 4 | 순매출/정산 기준 확정       |    71% | Toss settlement 페이지네이션과 backfill 로직은 보강됐고, `2026-04-08` 실제 backfill 실행 후 latest local `toss_settlements`가 `2942 → 20388`까지 증가했다. 추가로 `/api/toss/sync` 응답에 `run_id / started_at / finished_at / pagesRead / rowsAdded / done` completion signal을 넣었다. 다만 장거리 backfill의 최종 coverage 산출은 아직 덜 닫혔다. | `POST /api/toss/sync?mode=backfill` 장거리 실행에서도 completion signal을 확보하고 settlement coverage와 fee/payout 최종 재산출 |
| Stage 5 | 운영 루틴 및 팀 정렬       |    52% | 문서, 온보딩, 개발팀/마케팅팀/회계팀 체크사항은 정리됐고, `caller coverage`/`sync-status`/`reconcile`/`backfill`을 어떤 순서로 볼지도 구체화됐다. 하지만 허들러스/회계팀 확인과 일일 대사 루틴의 책임자 고정은 아직 남아 있다. | 허들러스에 biocom BigQuery 기존 링크 확인, 회계팀에 나이스페이 사용 범위 확인, 일일 대사 체크리스트 고정         |

### 단계별 현재 한줄 요약

- **Stage 1**: 필요한 원천 데이터는 거의 모였고, 3개 GA4 property direct access도 확인됐다. 이제 `biocom` BigQuery legacy link만 정리하면 된다.
- **Stage 2**: biocom fetch-fix, 더클린커피 fetch-fix v2, AIBIO form-submit v5까지 닫혔고, 이제 남은 건 biocom GTM 오류와 `GA4 (not set)` 진단 루틴이다.
- **Stage 3**: coffee와 biocom 모두 reconcile 숫자를 바로 볼 수 있고, 이제는 총량보다 `0-1일 / 2-7일 / 8-30일 / 31일 이상` 해석이 중요하다.
- **Stage 4**: 정산 logic과 completion signal은 들어갔고, 남은 것은 장거리 backfill의 실제 완료 기록과 coverage 최종 산출이다.

### 0408 실행 스냅샷

- caller coverage baseline: live `payment_success 452건`, `ga_session_id / client_id / user_pseudo_id = 0%`
- 고정 endpoint: `https://att.ainativeos.net/api/attribution/payment-success` 사용 가능, `ngrok`는 fallback 성격
- public route 상태: `https://att.ainativeos.net/api/attribution/ledger?limit=1`, `https://att.ainativeos.net/api/attribution/caller-coverage` 모두 `200`
- biocom fetch-fix 검증: 실제 주문 `202604081311774` 적재 이후 latest 기준 `biocom_imweb live payment_success 491건`, `ga_session_id 11건`, `client_id/user_pseudo_id 7건`, all-three `7건 (1.43%)`까지 확인했다.
- thecleancoffee fetch-fix v2 검증: 실제 주문 `202604080749309`가 `2026-04-08 23:53:44 KST`에 `pending`으로 적재됐고, `ga_session_id / client_id / user_pseudo_id` 3종이 모두 들어온 첫 live row를 확인했다.
- 라이브 홈페이지 관찰: `biocom.kr`는 최신 fetch-fix caller 반영 완료, `thecleancoffee.com`도 `payment_success fetch-fix v2` 반영 완료, `aibio.ai`는 `form_submit v5` 반영 완료
- raw ledger source check: `biocom_imweb live payment_success 491건 중 all-three 7건`, `thecleancoffee_imweb live payment_success 62건 중 all-three 1건`, `aibio_imweb live form_submit 6건`
- payment page follow-up: biocom 결제완료 페이지에서 `GTM-W7VXS4D8 ... includes` 오류가 관찰되어 GTM custom script 정리가 별도 필요
- payment_status follow-up: 최신 가상계좌 주문은 receiver 시점에 `pending`으로 들어오고, `POST /api/attribution/sync-status/toss?dryRun=true&limit=5` 시점에는 최근 5건이 아직 `unmatched`였다. 즉 미입금과 입금완료는 구분 가능하지만 status 승격은 즉시가 아닐 수 있다.
- GA4 `(not set)` clue: recent biocom/coffee payment_success와 AIBIO form_submit row에 `ga_session_id / client_id / user_pseudo_id` 유입이 시작됐다. 따라서 문제는 이제 "footer caller 전체 누락"보다 historical row, biocom GTM 오류, BigQuery raw 검증 부족 쪽으로 좁혀졌다.
- biocom Imweb local orders: `5,750건` (`firstOrderAt 2026-01-27`, `lastOrderAt 2026-04-07`)
- biocom reconcile: 총 `74.02%`, age bucket `0-1일 45.77% / 2-7일 65.74% / 8-30일 76.67% / 31일 이상 76.71%`
- Toss settlements: latest local `20,388건`, `totalPayout ₩4,720,106,642`
- GA4 direct access: `biocom / coffee / aibio = 3/3 OK`
- 가상계좌 미입금 처리: `WAITING_FOR_DEPOSIT`는 `pending`으로 남기고, `confirmed_revenue`/메인 ROAS에서는 제외하는 것이 최우선 운영 기준 중 하나
- **Stage 5**: 기술 구현보다 운영 팀 간 확인과 일일 루틴 고정이 남은 상태다.

### 바로 다음 작업

#### A. `biocom` BigQuery legacy 확인 없이 지금 바로 가능한 작업

| 우선순위 | 작업 | 왜 지금 해야 하나 |
|------|------|------|
| 0 | `WAITING_FOR_DEPOSIT` 등 가상계좌 미입금 주문이 `confirmed_revenue`와 메인 ROAS에 섞이지 않도록 일일 확인한다. | 최종 입금이 안 된 주문을 메인 매출에 섞으면 광고/CAPI/CRM 성과가 바로 과대평가된다. 이건 현재 최우선 운영 기준 중 하나다. |
| 1 | biocom payment_complete 페이지의 GTM custom script 오류를 수정한다. | 현재 결제 적재는 성공하지만 `GTM-W7VXS4D8 ... includes` 오류가 남아 있어 payment page 안정성과 태그 품질을 흔든다. |
| 2 | `GA4 (not set)` 진단 루프를 `BigQuery raw export + hourly compare + caller coverage`로 고정한다. | recent live row에는 GA 식별자가 붙기 시작했으므로 이제 historical row와 payment page 오류 구간을 분리해서 읽어야 한다. |
| 3 | biocom/coffee caller coverage를 일일 루틴으로 모니터링한다. | biocom은 all-three `1.43%`, coffee는 `1.61%`까지 올라왔지만 historical row가 많아서 일일 추적이 필요하다. |
| 4 | `utm_campaign alias -> Meta campaign_id` 수동 seed를 만든다. | 캠페인별 Attribution ROAS API는 이미 있지만, 현재는 biocom Meta confirmed attribution 주문 `49건 / ₩14.59M`이 전부 `(unmapped)`로 떨어진다. alias 매핑층이 없으면 캠페인별 ROAS가 0 또는 오매핑으로 보이게 된다. |
| 5 | `POST /api/toss/sync?mode=backfill`을 실행해 settlement coverage를 다시 채운다. | settlement page 전체를 읽도록 코드는 바뀌었지만, 장거리 backfill 완료 기록과 최종 coverage 산출은 아직 덜 닫혔다. |
| 6 | 회계팀에 `나이스페이` 사용 범위를 확인한다. | 결제 정합성 문서에서 나이스페이 역할이 확정돼야 레거시 결제 흐름과 매출 집계를 분리할 수 있다. |

#### A-1. `2026-04-08` 실행 업데이트

- **0번 GA4 property access 확인**: `backend/scripts/ga4-implementation-audit.ts`가 multi-property env fallback을 보도록 보강했고, `304759974 (biocom)`, `326949178 (thecleancoffee)`, `326993019 (aibio)` 모두 `data api ok`를 확인했다. 즉 coffee viewer 추가는 문서 상태가 아니라 실제 조회 가능 상태로 검증됐다.
- **1번 caller 식별자 보강**: baseline은 live `payment_success 452건`, `ga_session_id / client_id / user_pseudo_id` 3종 모두 **0%**였다. 이후 `biocom.kr`는 현재 `biocom_imweb live payment_success 491건 중 ga_session_id 11건 / client_id 7건 / user_pseudo_id 7건 / all-three 7건`, `thecleancoffee.com`는 `62건 중 all-three 1건`, `aibio.ai`는 `form_submit v5` 기준 live `6건`까지 올라왔다. public `att.ainativeos.net`는 이제 `ledger`, `caller-coverage` 모두 `200`이다. 남은 것은 구 caller가 아니라 `GA4 (not set)` historical row와 biocom GTM 오류 구간을 분리하는 운영 루틴이다.
- **2번 biocom Imweb sync 실행**: `POST /api/crm-local/imweb/sync-orders`를 biocom 대상으로 실행했고, latest local `imweb_orders` 기준 `5750건`, `memberOrders 4676`, `phoneCustomers 4566`, `paymentAmountSum ₩2,207,618,668`, `firstOrderAt 2026-01-27`, `lastOrderAt 2026-04-07`까지 확인했다.
- **3번 biocom reconcile 확인**: `GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=5` 기준 총 `coverageRate 74.02%`다. 다만 이 숫자는 age bucket으로 나눠 읽어야 한다. latest 기준 `0-1일 45.77% / 2-7일 65.74% / 8-30일 76.67% / 31일 이상 76.71%`다.
- **4번 Toss settlement backfill 실행**: `POST /api/toss/sync?store=biocom&mode=backfill&startDate=2025-01-01&endDate=2026-04-07`를 실행했고, latest local `toss_settlements`는 `2942 → 20388`, `totalAmount ₩437,481,862 → ₩4,863,790,709`, `totalFee ₩13,950,101 → ₩143,684,067`, `totalPayout ₩423,531,761 → ₩4,720,106,642`로 크게 증가했다. 추가로 `/api/toss/sync` 응답에는 `syncRun.runId / startedAt / finishedAt / pagesRead / rowsAdded / done` completion signal이 들어가도록 보강했다.

#### A-2. 위 1, 2, 3을 돌린 뒤 바로 보이는 미해결 이슈

- caller 식별자 실유입은 **biocom/coffee/AIBIO 기준 운영 검증 완료**다. 다만 전체 coverage 자체는 historical row 비중 때문에 아직 낮다.
- biocom payment_complete 페이지에는 `GTM-W7VXS4D8 ... includes` 오류가 남아 있어, attribution 적재 성공과 별개로 GTM custom script 정리가 필요하다.
- `GA4 (not set)` 문제는 이제 recent live caller row에서 식별자가 붙는 구간과 아닌 구간을 분리해서 읽어야 한다. 다음은 `BigQuery raw export`, `hourly compare`, `caller coverage`, `crm-phase1/ops`를 같은 날짜 범위로 묶는 운영 로그가 필요하다.
- `utm_campaign` alias 매핑도 아직 비어 있다. `2026-04-09` audit 기준 [meta_campaign_alias_audit.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json)에서 `campaigns 9 / adsets 32 / ads 591 / aliasCandidates 20`를 확보했지만, `최근 7일` Meta confirmed attribution 주문 `49건 / ₩14.59M`은 캠페인별 API에서 전부 `(unmapped)`로 떨어졌다.
- 이때 많은 ad creative에서 `landingUrl=null`이 확인됐다. 따라서 alias seed를 만들 때 **link_url만으로는 부족**하고, `adset name / ad name / 운영 시작일`까지 같이 봐서 사람이 수동 검증해야 한다. 즉 이 작업은 단순 fuzzy match가 아니라 `file-based alias seed + valid_from/valid_to + confidence=manual_verified`로 가는 게 맞다.
- 초기 review seed는 [meta_campaign_aliases.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_aliases.biocom.json)으로 만들어 두었다. 다만 이 파일은 아직 `needs_manual_review` 상태의 후보표이며, Meta campaign audit와 사람 검증을 거친 뒤에야 backend matcher에 연결해야 한다.
- biocom Imweb local cache는 생겼지만 **시작 시점이 `2026-01-27`**이다. 그 이전 biocom 주문 히스토리가 Imweb API 범위 문제인지, 페이지네이션 문제인지, 실제 운영 시작일인지 확인이 필요하다.
- biocom reconcile은 이제 총량보다 age bucket으로 읽는 편이 맞다. 최신 기준 `0-1일 45.77%`가 가장 낮고 `31일 이상 76.71%`가 상대적으로 높으므로, 최근 주문 지연과 오래된 누락을 분리해서 봐야 한다.
- Toss settlement backfill은 실제 적재는 진행됐고, 짧은 incremental 실행에서는 `syncRun.done=true` completion signal도 확인했다. 다만 **장거리 backfill 요청 종료 응답**은 아직 별도 확인이 필요하다.
- `biocom` BigQuery raw export는 여전히 **legacy 확인 대기**다. 다만 이건 coffee/aibio raw export와 3개 property direct GA4 조회가 열린 상태와는 별개 이슈라서, 현재 정합성 작업의 1, 2, 3번 진행을 막는 blocker로 보지 않는다.
- `/ads`와 `/ads/roas`의 ROAS 숫자 차이는 코드상 원인이 확인됐고, **`/ads`의 메인 ROAS를 Attribution 기준으로 통일**했다. Meta purchase ROAS는 이제 보조 참고값으로만 표기한다.

#### B. `biocom` BigQuery legacy 확인이 있어야 진행 가능한 작업

| 우선순위 | 작업 | 왜 이 확인이 선행돼야 하나 |
|------|------|------|
| 1 | 허들러스에 `hurdlers-naver-pay` raw export dataset 존재 여부와 최근 `events_*` 적재 여부를 확인한다. | 기존 raw export가 살아 있으면 삭제/이관보다 조회 권한 확보가 먼저이고, 죽어 있으면 새 프로젝트 relink를 검토해야 한다. |
| 2 | `biocomkr.sns@gmail.com` 또는 운영 계정에 BigQuery 조회 권한을 요청한다. | dataset이 실제로 살아 있어야 권한 요청도 의미가 있고, 권한을 받은 뒤에야 biocom raw event sanity query를 돌릴 수 있다. |
| 3 | `biocom`을 기존 프로젝트 유지로 갈지, 새 프로젝트 relink로 갈지 canonical 경로를 확정한다. | 이 판단이 서기 전에는 3사이트 통합 warehouse 구조와 후속 mart/dataset 전략을 고정할 수 없다. |

#### 의존 관계 트리

- 지금 바로 진행:
  - caller 식별자 보강
  - biocom Imweb local sync
  - Toss settlement backfill
  - 나이스페이 사용 범위 확인
- `biocom` legacy 확인 후 진행:
  - `hurdlers-naver-pay` dataset 상태 확인
  - BigQuery 조회 권한 확보
  - biocom canonical BigQuery 프로젝트 확정
  - 3사이트 통합 warehouse/mart 전략 확정

---

## 숫자 기준표 (피드백 #1 반영)

> 이 문서의 모든 숫자는 아래 기준으로 읽어야 한다. 같은 지표라도 기준이 다르면 숫자가 다르게 나온다.

| 기준 | 설명 | 예시 |
|------|------|------|
| `as_of` | 데이터 조회 시점 | 이 문서는 2026-04-06 시작 문서이고, 상단 단계 요약과 실행 업데이트는 2026-04-08 기준까지 포함한다. phase1.md의 attribution은 0402 스냅샷 |
| `store scope` | 대상 사이트 | `all` (3사이트) vs `biocom` vs `thecleancoffee` |
| `all-source vs filtered` | 전체 vs 필터링 | ledger 462건(전체) vs live 453건(captureMode=live) |
| `event row vs distinct order` | 이벤트 vs 고유 주문 | GA4 purchaseEvents=2,481 vs distinctTransactionIds=2,291 |
| `approval vs DONE vs settlement` | 결제 상태 | Toss approval(승인) ≠ DONE(완료) ≠ settlement(정산) |
| `observed vs confirmed` | 관찰 vs 확정 | attribution ledger 적재(observed) ≠ Toss DONE 확인(confirmed) |

### Phase 1 문서와의 숫자 차이 설명

| 항목 | Phase 1 (0402 기준) | 이 문서 (0408 기준) | 차이 이유 |
|------|-------------------|-------------------|---------|
| GA4 (not set) 매출 | 845건 / ₩136.6M | 896건 / ₩148.5M | **조회 시점 차이** — 0402 vs 0406. GA4 데이터는 지연 반영됨 |
| Attribution ledger | live 3 / replay 5 / smoke 3 | live 453 / replay 5 / smoke 4 | **시점 + source filter** — Phase 1은 초기 더클린커피 스냅샷, 이 문서는 전체(all source) |

---

## 1. 한줄 결론

- 지금 가장 필요한 것은 새 솔루션 도입이 아니라 `biocom GTM 오류 정리 + GA4 (not set) 진단 루프 고정 + 장거리 settlement completion + 일일 대사(reconciliation)`다.
- 현재 스택만으로도 `운영 의사결정`은 가능하다.
- 현재 `/ads/roas`는 **매체 운영용 directional dashboard**이며, 고객 단위 귀속·budget automation의 source of truth로 쓰기에는 아직 이르다. (피드백 #5 반영)
- 특히 약한 고리는 `GA4 ↔ 실제 결제`와 `Imweb local ↔ 전기간 Toss` 구간이다.
- **북극성 지표(90일 재구매 순매출)는 "운영용 회사 KPI"로 유효하지만, 채널별 LTV/광고별 ROAS는 "고객 단위 의사결정 KPI"이므로 층위가 다르다.** (피드백 #6 반영)

## 2. 점검 범위

- 로컬 API: `GET /health`
- 로컬 API: `GET /api/attribution/ledger`
- 로컬 API: `GET /api/attribution/toss-join`
- 로컬 API: `GET /api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30`
- 로컬 SQLite: `backend/data/crm.sqlite3`
- 운영 Postgres: `tb_sales_toss`, `tb_playauto_orders`

## 3. 현재 상태 요약

### 3-1. GA4

- `crm-phase1/ops` 기준 2026-03-01 ~ 2026-03-30에 `GA4 (not set)` 구매 `896건`, 매출 `₩148,523,642`가 잡힌다.
- 같은 응답에서 `distinctTransactionIds=2,291`, `purchaseEvents=2,481`, `duplicatePurchaseEvents=190`, `transactionCoverageRatio=92.34%`다.
- 즉 GA4는 구매 이벤트를 꽤 잡고 있지만, `source / medium / campaign` 귀속 품질은 아직 약하다.
- coffee viewer 추가 후 `GA4_PROPERTY_ID_COFFEE=326949178` direct access는 더 이상 blocker가 아니다. `ga4-implementation-audit` 기준 coffee property도 `data api ok`로 확인됐다.
- 관측성 문제도 일부 보강됐다. `/health`는 이제 `ga4Properties.biocom / thecleancoffee / aibio`를 같이 보여 주므로, 기본 `GA4_PROPERTY_ID` 누락과 multi-property 준비 상태를 분리해서 읽을 수 있다.
- `2026-04-07` 기준 BigQuery raw export는 `thecleancoffee`, `aibio` property에서 새 GCP 프로젝트 `project-dadba7dd-0229-4ff6-81c`로 `Daily export` 연결 완료다.
- 같은 날짜 기준 `biocom` property는 이미 `hurdlers-naver-pay` 프로젝트에 raw export 링크가 존재해 추가 링크 생성이 막혔다. 따라서 biocom은 `기존 dataset 존재 여부`, `최근 events_* 적재`, `조회 권한 제공 가능 여부`를 먼저 확인해야 한다.
- 즉 BigQuery는 이제 `enabled but not yet central`에서 한 단계 더 나아가 `aibio/coffee 부분 활성화 + biocom legacy link 확인 대기` 상태로 보는 것이 맞다.
- 실마리는 보인다. recent biocom/coffee payment_success와 AIBIO form_submit live row에 `ga_session_id / client_id / user_pseudo_id`가 들어오기 시작했으므로, `(not set)`은 전면적인 caller 부재가 아니라 historical row, payment page 품질, BigQuery raw 검증 부족이 겹친 결과로 좁혀졌다.
- 다음 계획은 `biocom legacy raw export 확인 -> 같은 날짜 범위 BigQuery raw query -> /api/attribution/hourly-compare -> /api/attribution/caller-coverage -> /api/crm-phase1/ops` 순서로 같은 날 데이터를 묶어 보는 것이다.

### 3-2. Toss

- 로컬 SQLite 기준 `toss_transactions=37,959건`, `distinct payment_key=34,011건`이다.
- latest local 확인 기준 `toss_settlements=20,388건`이다.
- 즉 로컬 Toss 거래 원장은 꽤 넓어졌고, 정산 원장도 크게 확장됐다. `/api/toss/sync` 응답에는 이제 `syncRun.runId / startedAt / finishedAt / pagesRead / rowsAdded / done` completion signal이 들어가므로, 운영에서는 적재 건수뿐 아니라 완료 여부까지 같이 기록해야 한다. 다만 장거리 backfill의 종료 응답과 최종 coverage 산출은 아직 별도 확인이 필요하다.
- 커피 store는 0406 기준 `4,194 결제건`, `1,371 정산건`이 local에 있다.
- backend는 now `store=biocom|coffee`를 지원하고, biocom/coffee 둘 다 실제 orderId 조회가 성공한다.

### 3-3. Imweb

- 로컬 SQLite `imweb_members`는 현재 `biocom 69,924`, `thecleancoffee 13,253`, `aibio 100`건이다.
- 로컬 SQLite `imweb_orders`는 현재 `biocom 5,750건`, `thecleancoffee 1,937건`이다.
- 즉 주문 캐시는 더 이상 `커피 쪽만 local 반영` 상태가 아니다. biocom도 local cache와 reconcile 검증이 가능한 수준까지 올라왔다.
- biocom local 주문 범위는 현재 `2026-01-27 ~ 2026-04-07`이다. 따라서 그 이전 주문 히스토리가 실제 운영 시작인지, API 범위/페이지네이션 문제인지 확인이 필요하다.
- 커피 주문 `1,937건`은 전부 `orderer_call`, `member_code`를 가지고 있어 주문 원장 자체의 필드 완전성은 좋다.
- 커피 주문 `1,937건` 중 회원 테이블과 `member_code`로 직접 붙는 건 `1,046건`으로, 주문-회원 직접 결합률은 `54.0%`다.

### 3-4. PlayAuto

- 운영 DB `tb_playauto_orders`는 `115,316행`, `93,249 distinct order`다.
- 전체 행의 `89.5%`가 `pay_amt=0`이다.
- 즉 PlayAuto는 `매출 정본`이 아니라 `상품/출고/전화번호 축`으로 보는 것이 맞다.
- 다만 Toss와 붙는 subset에서는 전화번호 계열(`order_htel` 또는 `to_htel`)이 `100%` 존재했다.
- Toss와 붙는 subset에서 `pay_amt=0` 비율도 `100%`라서, 고객 식별과 상품 분석에는 좋지만 매출 계산 기준으로는 부적합하다.
- 운영 판단상 `pay_amt=0` 자체를 지금 우선 수정할 필요는 낮다. 현재 `매출 truth = Toss`, `주문 truth = Imweb`, `보조 식별/상품/출고 = PlayAuto`로 역할을 나누면 운영 KPI는 충분히 읽힌다.
- 다만 PlayAuto에만 있고 Imweb/Toss에 없는 필드가 실제로 필요한지는 별도 inventory가 필요하다. 후보는 `수취인 전화번호`, `상품 line-item / 옵션`, `출고/배송 상태`다.
- 만약 이 필드들이 Imweb 주문 원장에도 충분히 있고 운영상 택배/출고 데이터가 지금 우선순위가 아니라면, PlayAuto는 `매출 계산 source`가 아니라 `선택적 보조 source`로 낮춰도 된다.
- 반대로 `PlayAuto에는 있는데 Imweb/Toss에는 없는 필드`가 CRM 세분화나 재구매 운영에 중요하다면, 그때만 PlayAuto 유지 범위를 명시적으로 남기면 된다. 핵심은 `pay_amt 보정`이 아니라 `필드 필요성 판정`이다.

### 3-5. Attribution Ledger

- latest local `attribution_ledger` 기준 전체 엔트리는 `575건`이다.
- 이 중 `payment_success=568`, `form_submit=6`, `checkout_started=1`, `live=566`, `replay=5`, `smoke=4`다.
- `payment_success`만 보면 `live=560`, `replay=5`, `smoke=3`이다.
- `payment_status` 분포는 `pending=320`, `confirmed=244`, `canceled=4`이다.
- status별 금액은 `pending ₩589,024,047`, `confirmed ₩57,475,165`, `canceled ₩813,088`이다.
- 여기서 `pending`에는 `WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문이 포함될 수 있다. 운영 판단상 이 금액은 **메인 매출이 아니라 잠정 대기분**으로 읽고, `confirmed_revenue`만 광고/CAPI/ROAS 기준값으로 계속 써야 한다.
- `paymentKey`가 들어 있는 엔트리는 `493건`, `orderId`가 들어 있는 엔트리는 `568건`이다.
- `gaSessionId`가 들어 있는 엔트리는 `19건`, `clientId`는 `11건`, `userPseudoId`는 `11건`이다.
- `POST /api/attribution/sync-status/toss?dryRun=true&limit=5` preview 기준 최근 pending 후보 `5건`은 모두 `unmatched`였다.
- 해석:
  - `결제 성공 로그`는 꽤 쌓였고, biocom/coffee recent row와 AIBIO form row에서는 GA 식별자 3종 유입이 실제로 시작됐다. 다만 전체 모수 대비 coverage는 아직 낮다.
  - status-aware ledger는 로컬 기준으로 닫혔지만, 최근 pending을 Toss가 바로 찾아주지 못하는 구간이 있어 `일일 대사`가 더 중요해졌다.

## 4. 소스 간 연결 강도

| 연결축 | 현재 평가 | 근거 |
|---|---:|---|
| GA4 ↔ Toss | 58/100 | 일자 단위 비교는 가능하지만 직접 join key가 아직 약하다. biocom fetch-fix, thecleancoffee fetch-fix v2, AIBIO form-submit v5로 GA 식별자 3종 유입은 시작됐지만, 전체 coverage는 아직 낮다. |
| Toss ↔ Attribution | 68/100 | 최근 `/api/attribution/toss-join` 100건 샘플은 `78%`가 `payment_key`로 붙는다. 다만 3월 전체 window로 보면 live capture가 늦게 붙어 `5%` 수준으로 보이는 구간이 있다. |
| Toss ↔ Imweb | 64/100 | 커피 local 기준 전체 커버리지는 `Imweb→Toss 33.6%`, `Toss→Imweb 15.6%`다. 다만 겹치는 기간(2025-12~2026-02)만 보면 `Imweb→Toss 50.7%`, `Toss→Imweb 62.9%`로 올라간다. 즉 핵심 문제는 조인 키보다 `기간/동기화 범위 차이`다. |
| Toss ↔ PlayAuto | 91/100 | 운영 DB 기준 전체 `81.3%` 매칭, coffee `99.6%`, biocom `79.4%`다. order id 구조는 매우 강하다. |
| Imweb ↔ Members | 74/100 | 커피 주문은 필드 완전성이 좋지만, `member_code` 직접 결합률은 `54.0%`라 회원 기반 CRM 분류에는 추가 보정이 필요하다. |
| GA4 ↔ Attribution | 42/100 | UTM 텍스트는 남고 recent biocom/AIBIO row에는 세션 키도 들어오기 시작했지만, 전체 모수 기준으로는 아직 coverage가 낮아 광고 효율을 고객 단위로 완전히 닫기 어렵다. |

## 5. 무엇을 믿어야 하는가

### 5-1. 지금 매출 정본으로 가장 믿을 수 있는 것

- `Toss`가 1순위다.
- 이유는 `order_id`, `payment_key`, `amount`, `status`, `m_id(store)`가 가장 명확하기 때문이다.
- 단, `정산 수수료`까지 포함한 순수익 관점은 local settlement가 덜 찬 상태라 보수적으로 봐야 한다.

### 5-2. 지금 고객 식별로 가장 믿을 수 있는 것

- `PlayAuto 전화번호 + Imweb 주문자 전화번호/회원코드` 조합이 가장 실무적이다.
- Toss에는 고객 식별자가 거의 없으므로, 고객 단위 LTV는 결국 `Toss 금액`을 `Imweb/PlayAuto 식별자`에 붙여야 한다.
- 단, Imweb 주문 동기화가 store별로 충분히 넓어지고 `orderer_call / member_code / 상품 옵션` 필드가 안정적으로 확보되면, PlayAuto 의존도는 `보조 축`으로 줄여도 된다.

### 5-3. 지금 채널 귀속으로 가장 위험한 것

- `GA4 source/medium/campaign → 실제 결제`를 그대로 믿는 것.
- `(not set)` 매출이 크고, recent live row에서는 연결이 생기기 시작했지만 historical row가 많아 아직은 `참고지표`에 가깝다.

## 6. 점수표

점수는 “지금 당장 운영 숫자로 써도 되는가” 기준의 주관 점수다.

| 항목 | 점수 | 해석 |
|---|---:|---|
| 매출 정합성 | 84/100 | Toss가 강하고 biocom/coffee 분기도 닫혔다. 다만 settlement coverage는 아직 약하다. |
| 고객 식별 정합성 | 72/100 | Imweb/PlayAuto에 전화번호와 회원코드는 있지만 정식 customer spine이 없다. |
| 주문-결제 조인 정합성 | 77/100 | PlayAuto↔Toss는 강하다. Imweb↔Toss는 기간 불일치가 남아 있다. |
| 마케팅 귀속 정합성 | 54/100 | GA4 `(not set)`이 크고 session-level join이 거의 없다. |
| 운영 관측성 | 78/100 | health mismatch는 남아 있지만, attribution ledger가 SQLite 테이블로 승격됐고 `payment_status`/sync route/CRM 카드가 생겼다. |
| 전체 운영 활용도 | 76/100 | 운영 판단에는 충분하다. 다만 “광고비 1원 단위 최적화”까지 가기엔 아직 이르다. |

## 7. 현재 스택으로 충분한가

### 결론

- **당장은 충분하다.**
- 새 SaaS/CDP를 급히 붙일 단계는 아니다.
- 지금의 문제는 도구 부재보다 `식별자 표준화`, `동기화 범위`, `일일 대사` 부족에 가깝다.

### 새 솔루션이 당장 필요하지 않은 이유

- Toss 결제 truth는 확보됐다.
- PlayAuto와의 주문 조인도 꽤 강하다.
- Imweb 회원/주문 축도 최소한의 CRM 연결에는 쓸 수 있다.
- attribution live 수집도 시작됐다.

### 예외적으로 고려할 만한 추가 솔루션

- `GA4 BigQuery export`
  - 목적: raw event 수준 검증, transaction_id 중복 추적, `(not set)` 원인 역추적
  - 상태: `2026-04-07` 기준 `thecleancoffee`, `aibio`는 `Daily export` 연결 완료. `biocom`은 기존 `hurdlers-naver-pay` 링크 확인 대기.
  - 판단: **프로젝트 우선순위는 여전히 뒤로 두되, export toggle은 지금부터 켜 두는 쪽이 유리** (피드백 #7 반영). 본격 분석은 P7 이후지만, 데이터는 지금부터 쌓아야 나중에 과거 분석이 가능. 현재 상태는 `partially enabled, not yet central`.
- `정식 warehouse/dbt`
  - 목적: fact table 정규화, 비개발자용 분석 재사용
  - 판단: 데이터 모델을 먼저 안정화한 뒤에 가는 것이 맞다.
- `Segment/CDP류`
  - 판단: 지금 단계에서는 과하다. 먼저 현재 스택의 식별자 품질을 올리는 편이 ROI가 높다.

## 8. 정합성을 더 높이는 방법

### P0. 바로 해야 할 것

1. `order_id_base`, `payment_key`, `normalized_phone`를 공통 표준 키로 고정한다.
   - 무엇: 주문, 결제, 고객을 각 시스템에서 같은 대상으로 인식하게 만드는 공용 키를 정하는 작업이다.
   - 어떻게: `order_id_base`는 주문번호 변형을 걷어낸 기본 주문번호로 맞추고, `payment_key`는 Toss 결제 고유키를 그대로 유지하고, `normalized_phone`는 전화번호를 숫자만 남긴 동일 형식으로 저장한다.
   - 왜: 지금은 같은 주문/같은 사람이 GA4, Toss, Imweb, PlayAuto에서 서로 다른 값처럼 보인다. 공통 키가 있어야 "어느 주문이 실제 결제됐는지", "같은 고객의 재구매인지", "같은 주문을 각 장부가 어떻게 보고 있는지"를 안정적으로 붙일 수 있다.
2. `status-aware attribution ledger` 운영 루틴을 고정한다.
   - 무엇: attribution ledger를 단순 이벤트 로그가 아니라 `확정/대기/취소` 상태를 반영하는 실제 매출 장부로 운영하는 것이다.
   - 어떻게: 로컬 SQLite 테이블 승격과 `payment_status` 필드는 이미 반영됐다. 이제는 `POST /api/attribution/sync-status/toss?dryRun=true` preview와 실제 배치 결과를 매일 확인하고, `pending -> confirmed/canceled` 전환을 운영 루틴으로 고정한다.
   - 왜: `payment_success`가 찍혔다고 곧바로 회계상 확정 매출은 아니다. 특히 `WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문을 메인 매출에 섞으면 숫자가 바로 부풀어 오른다. 따라서 `pending`은 raw ledger에 남기되, `confirmed_revenue`만 광고/CAPI/ROAS 기준값으로 써야 한다. 이건 현재 최우선 운영 기준 중 하나다.
3. `checkout_context`, `payment_success`에 `ga_session_id`, `client_id`, `user_pseudo_id`를 함께 남긴다.
   - 무엇: 웹 행동 데이터와 실제 결제 데이터를 이어 주는 식별자를 결제 체인에 남기는 것이다.
   - 어떻게: 체크아웃 시작 시점과 결제 성공 시점 payload에 `ga_session_id`, `client_id`, `user_pseudo_id`를 같이 저장하고 ledger에도 보존한다.
   - 왜: 지금은 GA4에 구매가 잡혀도 실제 Toss 결제와 사람/세션 단위로 잘 안 붙는다. 이 식별자가 있어야 `(not set)` 원인을 추적하고, "어떤 세션/광고 클릭이 실제 결제로 이어졌는가"를 직접 검증할 수 있다.
4. biocom Imweb 주문도 local cache에 넣어 `Imweb ↔ Toss`를 커피처럼 직접 검증 가능하게 만든다.
   - 무엇: biocom도 coffee와 같은 수준으로 Imweb 주문 원장을 로컬에 가지고 오자는 뜻이다.
   - 어떻게: biocom siteCode 기준으로 Imweb 주문을 local DB에 주기적으로 동기화해 Toss 결제와 직접 비교한다.
   - 왜: 지금은 커피는 `Imweb ↔ Toss` 검증이 되는데 biocom은 상대적으로 약하다. biocom 주문 캐시가 생겨야 "Toss에는 있는데 Imweb에는 없는 주문", "Imweb에는 있는데 결제 안 된 주문"을 같은 기준으로 바로 잡을 수 있다.
5. Toss settlement 페이지네이션/backfill을 끝내서 `수수료 포함 순매출` 기준을 닫는다.
   - 무엇: 단순 승인 금액이 아니라 정산 수수료까지 반영한 실제 순매출 기준을 확보하는 작업이다.
   - 어떻게: Toss settlement를 전체 페이지/전체 기간으로 끝까지 가져와 payment_key 기준으로 거래 원장과 연결한다.
   - 왜: 승인 금액만 보면 "얼마 팔았는지"는 보이지만 "얼마 남았는지"는 안 보인다. 광고비 판단, CRM 실험 가치, 상품성 판단은 결국 `수수료 포함 순매출` 기준으로 닫아야 한다.

### P0 구현 진행 상태 (`2026-04-07`)

- backend attribution 수집부는 이제 `orderIdBase`, `normalizedPhone`, `clientId`, `userPseudoId`를 ledger `metadata`에 함께 저장한다.
- `customerKey`가 비어 있어도 전화번호가 있으면 `normalizedPhone`를 fallback으로 사용해, 같은 고객이 시스템마다 다른 값으로 남는 문제를 줄였다.
- `GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=20` 엔드포인트를 추가해, biocom도 coffee처럼 local `Imweb ↔ Toss` 대사를 직접 볼 수 있게 했다.
- `/api/toss/sync`는 settlement를 `page/size` 기준으로 끝까지 가져오도록 바꿨고, settlement 조회 timeout도 늘려 long-range backfill에 맞췄다.
- `/api/toss/daily-summary`도 첫 페이지 100건이 아니라 전체 settlement page를 집계해 일별 수수료/정산 총액을 보도록 보강했다.
- 아직 남은 운영 액션은 아래와 같다.
  1. biocom payment_complete 페이지 `GTM-W7VXS4D8 ... includes` 오류를 수정
  2. `GA4 (not set)` 진단을 위해 `BigQuery raw export`, `/api/attribution/hourly-compare`, `/api/attribution/caller-coverage`, `/api/crm-phase1/ops`를 같은 날짜 범위로 같이 기록
  3. `POST /api/crm-local/imweb/sync-orders`를 biocom 대상으로 실운영 데이터에 한 번 돌려 local 주문 캐시를 실제로 채우기
  4. `POST /api/toss/sync?mode=backfill`을 실서버에서 실행해 settlement coverage가 실제로 얼마나 올라가는지 확인
  5. `confirmed_revenue`만 광고/CAPI/ROAS 기준으로 계속 쓰는지 운영 카드와 리포트 재점검

### P1. 이번 주 안에 하면 좋은 것

1. 일일 대사 리포트를 만든다.
2. 기준: `GA4 purchases`, `Toss approvals`, `attribution payment_success`, `Imweb orders`, `PlayAuto distinct order`.
3. 이 리포트는 “수치가 다르면 왜 다른지”를 보여 줘야 한다.
4. 특히 `Toss는 있는데 attribution 없음`, `GA4는 있는데 Toss 없음`, `Imweb는 있는데 Toss 없음`을 자동 표시해야 한다.
5. 최소 루틴은 아래 4개 endpoint를 같은 날짜 범위로 같이 본다.
   - `GET /api/attribution/ledger`
   - `POST /api/attribution/sync-status/toss?dryRun=true`
   - `GET /api/attribution/toss-join`
   - `GET /api/crm-phase1/ops`
6. `aibio`, `thecleancoffee` BigQuery export의 첫 `analytics_<property_id>.events_YYYYMMDD` 적재를 확인한다.
7. `biocom`은 `hurdlers-naver-pay`에서 기존 raw export dataset 존재 여부와 조회 권한 제공 가능 여부를 먼저 확인한다.
8. PlayAuto는 `pay_amt 보정`이 아니라 `Imweb/Toss로 대체 불가한 필드 목록`을 먼저 만든다.

### P2. 이번 주에 스키마 고정 (피드백 #2 반영)

> 대규모 backfill은 나중에 하더라도, **spine 테이블의 스키마와 merge rule은 이번 주에 먼저 고정**한다. P3 발송 대상, P4 코호트, P5.5 ROAS, P7 holdout 실험이 같은 사람을 같은 사람으로 보려면 이게 선행돼야 한다.

1. customer spine 테이블 **스키마**를 확정한다.
2. 추천 키: `store`, `normalized_phone`, `member_code`, `order_id_base`, `payment_key`.
3. merge rule: `normalized_phone` 기준 1차 매칭 → `member_code` 기준 보강 → 충돌 시 phone 우선.
4. 스키마 확정 후 → P0 backfill과 함께 실데이터 적재는 다음 주.

## 9. 앞으로의 운영 계획

### 1주 계획

- biocom Imweb reconcile age bucket 운영 해석 + `2026-01-27` 이전 범위 확인
- attribution status sync batch 운영 검증 + 일일 대사 루틴 고정
- biocom payment_complete GTM custom script 오류 수정
- `GA4 (not set)`을 BigQuery raw export / hourly compare / caller coverage 기준으로 다시 좁히는 운영 루틴 고정
- `client_id / user_pseudo_id` ledger 저장 규칙 정리
- Toss settlement 장거리 backfill completion 및 coverage 확정
- customer spine 스키마 확정 (merge rule 포함)
- `aibio`, `thecleancoffee` BigQuery 첫 export 적재 확인 + sanity query 준비
- `biocom` 기존 `hurdlers-naver-pay` raw export 상태 확인
- PlayAuto `pay_amt=0`는 일단 유지하되, `수취인 전화번호 / 상품 옵션 / 출고 상태`가 Imweb로 대체 가능한지 필드 inventory 작성
- **★ P3 첫 operational live 병렬 진행** (피드백 #4 반영) — 데이터 정합성 안정화만 하는 주가 아니라, 정합성 개선과 live 운영을 같이 굴려야 함. P7 첫 실험 진입이 늦어지지 않도록.

### 2주 계획

- `join_quality` 대시보드 신설
- store별 `Imweb ↔ Toss`, `Toss ↔ PlayAuto`, `GA4 ↔ attribution` 조인율을 매일 기록
- coffee KPI를 0406 backfill 기준으로 재산출

### 1개월 계획

- customer spine 기반 LTV/재구매/광고 귀속 리포트 통합
- 필요 시 그 시점에만 BigQuery export 또는 정식 warehouse를 검토

## 10. 최종 판단

- 지금은 **새 솔루션을 더 붙일 시점이 아니다.**
- 현재 스택으로도 `결제 truth`, `주문 truth`, `출고/전화번호 truth`, `최근 attribution truth`는 각각 확보되고 있다.
- 문제는 truth가 없는 것이 아니라, truth끼리 이어 주는 `공통 키`와 `정식 대사 루틴`이 약하다는 점이다.

**한 줄 최종 결론** (GPT 피드백 반영):
> "지금은 새 솔루션 도입 시점이 아니라, `공통 키 고정 + status-aware ledger 운영 + biocom/coffee fetch-fix 검증 반영 + biocom GTM 오류 정리 + GA4 (not set) 진단 루프 고정 + 일일 대사`를 먼저 끝내고, 그와 병렬로 `P3 operational live`를 시작해 P7 holdout 실험으로 넘어가는 시점이다."

---

## GPT 피드백 반영 이력

| # | 피드백 | 반영 위치 | 상태 |
|---|--------|---------|------|
| 1 | 숫자마다 `as_of / scope / filter / status` 명시 | 상단 "숫자 기준표" 신설 | ✅ |
| 2 | customer spine 스키마를 이번 주에 먼저 고정 | P2 → "이번 주에 스키마 고정" 변경 | ✅ |
| 3 | ledger DB 승격 시 `payment_status` 추가 | P0 2번 항목 보강 | ✅ |
| 4 | 1주 계획에 P3 operational live 병렬 추가 | 1주 계획에 ★ 항목 추가 | ✅ |
| 5 | `/ads/roas`는 directional dashboard 수준 명시 | 1. 한줄 결론 보강 | ✅ |
| 6 | 북극성 = 운영 KPI, 채널 LTV = 의사결정 KPI 층위 분리 | 1. 한줄 결론 보강 | ✅ |
| 7 | BigQuery export toggle은 일찍 켜두기 | 7. 새 솔루션 판단 보강 | ✅ |
| 8 | status sync / confirmed revenue / CAPI confirmed-only 후속 반영 | 3-5, 8, 9 보강 | ✅ |
- 즉, 다음 성과는 “도구 교체”가 아니라 `정규화`, `백필`, `일일 검증`, `운영 대시보드화`에서 나온다.
