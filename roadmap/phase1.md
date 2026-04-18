# Phase 1 메모

기준일: 2026-04-11
최종 업데이트: 2026-04-18

## 2026-04-18 업데이트 — Confirmed Stop-line 워크스트림 편입

Meta CAPI Purchase 기준 논쟁이 **C안(Official=business_confirmed / Fast Signal=paid + Refund 보정)**으로 v1 stop-line 확정됐다. 실행 Sprint 3개(`/ads` Official/Fast 분리 / CANCEL 서브카테고리 분리 / Meta CAPI Refund + GA4 MP Refund)가 Phase 1로 편입됐다.

- 워크스트림 상세: `roadmap/confirmed_stopline.md` §C-Sprint 2~4
- 근거: `data/confirmedreport.md` v4, `confirmedfeedback.md`
- 새 우선순위: `identity coverage 개선(현재 ~50%) > campaign mapping > confirmed 정의 고도화` (feedback 자신감 95%)
- 실측: biocom 카드 p50 42h / p90 91h, coffee 카드 p50 36h / p90 66h, ≤72h 도달률 77~91%

## Source Of Truth

이 문서는 `왜 Phase 1이 필요한가`를 설명하는 메모다.
진행률, 실측 숫자, owner, blocker는 [roadmap0327.md](/Users/vibetj/coding/seo/roadmap/roadmap0327.md) Phase 1 섹션을 source of truth로 본다. ROAS/Meta 정합성 판단은 [data/roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md)를 source로 본다.

- last verified: `2026-04-11`
- owner:
  - `P1-S1`, `P1-S1A`, `P1-S1B`: Codex
  - `P1-S2`: Claude Code
- next action: `새 푸터 checkout/payment_success 24시간 관찰 + GA4 (not set) BigQuery/hourly compare 진단 고정 + CAPI/Pixel 주문 단위 dedup 확인 + 더클린커피 token/sync 복구 + P3 첫 operational live + 운영 DB cutover`
- blocked by: `GA4 (not set) historical row 원인 미분리`, `장거리 settlement backfill 완료 기록`, `더클린커피 Meta token 만료와 local order/PG cache stale`, `운영 DB cutover`

## 페르소나 베네핏 카드

- **대표(TJ):** 이 phase가 닫히면 CRM 메시지가 실제 순매출을 만들었는지 감이 아니라 실험 장부와 결제 원장으로 판단할 수 있다.
- **운영팀:** `/crm`에서 실험 상태와 결제 귀속 blocker를 함께 보고, 오늘 개발팀에 무엇을 요청해야 하는지 바로 고를 수 있다.
- **개발팀:** `payment_success row + payment_status sync + confirmedRevenue`가 같은 체인으로 닫혀야 운영 숫자를 믿을 수 있다는 점이 분명해진다.
- **아직 안 되는 것:** live row와 DebugView가 닫히기 전까지 `(not set)=PG 직결`은 확정하지 않는다.

## 상단 10초 요약

Phase 1의 목적은 `누구에게 메시지를 보냈고`, `그 사람이 실제로 샀는지`, `결제 과정에서 신호가 어디서 끊기는지`를 같은 장부로 묶는 것이다.
`P1-S1 실험 장부`와 `P1-S2 운영자 화면`은 로컬 검증 기준으로 닫혔다.
**`P1-S1A 결제 블랙박스`는 0411 기준 `status-aware ledger`, biocom fetchfix live 검증, 새 푸터 `checkout_started` 수집 시작까지 반영되었다.** live/replay/smoke뿐 아니라 `pending/confirmed/canceled`, `confirmedRevenue`, caller 식별자 누락률을 함께 본다.
특히 **`WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문을 `pending`으로 남기고 `confirmedRevenue`에서는 제외하는 것**은 현재 최우선 운영 기준 중 하나다.
다음 행동은 신규 장부 추가보다 `새 푸터 이후 checkout/payment_success 연결률 관찰 + CAPI/Pixel dedup 확인 + GA4 (not set) 진단 루프 고정 + 더클린커피 token/sync 복구 + 일일 정합성 체크 + 운영 cutover`다.

## 현재 상황 (0408-0411 업데이트)

**P1-S1A의 핵심 병목이었던 live row 적재와 status-aware ledger 승격이 모두 해결되었다.**

- `GET /api/attribution/ledger` latest local 기준 attribution 원장은 총 `575건`이다.
- capture mode는 `live 566 / replay 5 / smoke 4`다.
- `payment_success`만 보면 `live 560 / replay 5 / smoke 3`이다.
- payment status는 `pending 320 / confirmed 244 / canceled 4`다.
- status별 금액은 `confirmed ₩57,475,165 / pending ₩589,024,047 / canceled ₩813,088`이다.
- 여기서 `pending`은 메인 매출이 아니라 대기분이다. 특히 `WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문은 raw ledger에 남기되, 메인 ROAS/광고/CAPI/CRM 매출에서는 제외하는 것이 현재 최우선 운영 기준 중 하나다.
- source 기준으로는 `biocom_imweb 491`, `thecleancoffee_imweb 62`, `aibio_imweb 6`이 main 흐름이고, test 성격 row도 소수 섞여 있다.
- `POST /api/attribution/sync-status/toss?dryRun=true`가 있어 pending row를 Toss 상태와 매일 대조할 수 있다.
- `GET /api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30` 기준 GA4 `(not set)` 구매는 `896건`, 매출은 `₩148,523,642`다.
- `biocom.kr` fetch-fix footer publish 후 실제 가상계좌 주문 `202604081311774`가 `2026-04-08T12:48:06.138Z`에 `pending`으로 적재됐고, `snippetVersion=2026-04-08-fetchfix`, `ga_session_id=1775652461`까지 확인했다.
- `thecleancoffee.com`도 `snippetVersion=2026-04-08-coffee-fetchfix-v2` 기준 실제 가상계좌 주문 `202604080749309`가 `2026-04-08T14:53:44.262Z`에 `pending`으로 적재됐고, `ga_session_id=1775659560`, `client_id/user_pseudo_id=497266722.1774972211`까지 확인했다.
- `GET /api/attribution/caller-coverage?touchpoint=payment_success` 기준 현재 all-source live `560건` 중 `ga_session_id 12건`, `client_id 9건`, `user_pseudo_id 9건`, all-three `8건 (1.43%)`이다.
- `GET /api/attribution/caller-coverage?source=biocom_imweb` 기준 현재 biocom live `payment_success 491건` 중 `ga_session_id 11건`, `client_id 7건`, `user_pseudo_id 7건`, all-three `7건 (1.43%)`이다.
- `GET /api/attribution/caller-coverage?source=thecleancoffee_imweb` 기준 coffee live `payment_success 62건` 중 `ga_session_id 1건`, `client_id 2건`, `user_pseudo_id 2건`, all-three `1건 (1.61%)`이다.
- public `https://att.ainativeos.net/api/attribution/caller-coverage`도 이제 `200`으로 열려 있고, 최신 backend dedupe 정책이 실제 운영 프로세스에 반영됐다.
- `aibio.ai`는 이제 구 payment_success caller 정리가 아니라 `form_submit` 원장 기준으로 보는 것이 맞다. `snippetVersion=2026-04-08-formfetchfix-v5` 기준 live `6건`이 적재됐고, `2026-04-08 23:22:56 / 23:23:26 KST` 30초 간격 재제출도 둘 다 `201` 저장이 확인됐다.
- 가상계좌 주문의 운영 해석도 명확해졌다. receiver 적재 시점에는 `pending`으로 남고, 이후 `POST /api/attribution/sync-status/toss`로 Toss 상태를 대조해 `confirmed/canceled`로 승격한다. 따라서 "입금 전 주문"과 "입금 완료 주문"을 같은 원장에서 구분할 수 있다.
- `(not set)` 문제도 이제 "결제완료 footer가 식별자를 전혀 못 보낸다" 단계는 지났다. recent biocom/coffee payment_success와 AIBIO form_submit live row에서 `ga_session_id / client_id / user_pseudo_id` 유입이 시작됐고, 2026-04-11 새 푸터로 biocom `checkout_started`도 들어오기 시작했다. 다음 진단은 `historical row + 새 푸터 이후 live row + BigQuery raw export`를 분리해서 읽는 쪽으로 옮겨갔다.
- `POST /api/crm-local/imweb/sync-orders`를 biocom 대상으로 실제 실행해 latest local `imweb_orders 5750건`, `firstOrderAt 2026-01-27`, `lastOrderAt 2026-04-07`까지 확인했다.
- `GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90` 기준 총 coverage는 `74.02%`이며, age bucket은 `0-1일 45.77% / 2-7일 65.74% / 8-30일 76.67% / 31일 이상 76.71%`다.
- `POST /api/toss/sync?store=biocom&mode=backfill&startDate=2025-01-01&endDate=2026-04-07` 실행 후 latest local `toss_settlements`는 `20,388건`까지 증가했다. 추가로 `/api/toss/sync` 응답에 `runId / startedAt / finishedAt / pagesRead / rowsAdded / done` completion signal이 들어가도록 보강했다. 다만 장거리 backfill의 완료 응답/최종 coverage 산출은 아직 별도 확인이 필요하다.
- biocom payment success 페이지에서 관찰됐던 GTM custom script 오류(`gtm.js?id=GTM-W7VXS4D8 ... includes`)는 2026-04-11 리인벤팅 CRM 코드 제거 후 사라졌다. live HTML/Headless Chrome 검증에서 `GTM-W7VXS4D8` 호출과 `Cannot read properties of null (reading 'includes')` 오류가 재현되지 않는다.

남은 것:
- coffee KPI 재산출과 대시보드 반영. 단, 2026-04-11 기준 coffee Meta token 만료, confirmed 0건, Imweb/Toss local cache stale 때문에 ROAS 비교 전 token/sync 복구가 먼저다.
- 운영 DB cutover
- `ledger / sync-status / toss-join / crm-phase1`를 같은 날짜 범위로 보는 일일 대사 루틴 고정
- `GA4 (not set)`을 BigQuery raw export / hourly compare / caller coverage로 다시 좁히는 운영 진단 루틴 고정
- settlement backfill 장거리 완료 기록과 최종 coverage 산출 확정
- CAPI/Pixel 주문 단위 dedup 확인과 더클린커피 token/sync 복구

## 문서 목적

이 문서는 Phase 1의 현재 상태, 남은 blocker, 다음 행동을 TJ님과 개발팀이 같은 언어로 이해하도록 정리한다.

- 이 문서의 주 독자: `대표(TJ)`, `운영팀`, `개발팀`
- 이 문서를 읽고 바로 할 행동: `오늘의 confirmedRevenue와 pending 대기분을 같은 기준으로 읽는다`

## 이 단계가 하는 일

이 단계는 `메시지 실험 장부`, `결제 블랙박스`, `운영자 화면`을 한 묶음으로 만든다.

- 실험 장부: 누가 holdout/control/treatment에 들어갔는지 적는다.
- 결제 블랙박스: checkout과 payment success를 기록하고 토스 승인과 붙여 본다.
- 운영자 화면: 위 두 장부를 `/crm`에서 바로 읽게 만든다.

## 왜 필요한가

이 단계가 없으면 CRM 메시지가 실제 추가 매출을 만들었는지 알 수 없다.

- 메시지를 보낸 기록만 있고 매출 연결이 없으면 실험이 과대평가된다.
- `(not set)` 원인을 모르면 광고와 CRM 성과 해석이 흔들린다.
- 운영 화면이 없으면 장부가 있어도 사람이 판단을 못 한다.

즉, Phase 1은 `숫자를 믿어도 되는 상태`를 만드는 단계다.

## 빠른 이동

- [스프린트 한눈 요약](#스프린트-한눈-요약)
- [현재 상태](#현재-상태)
- [P1-S1 실험 장부](#p1-s1-실험-장부)
- [P1-S1A 결제 블랙박스](#p1-s1a-결제-블랙박스)
- [P1-S2 운영자 화면](#p1-s2-운영자-화면)
- [다음 액션](#다음-액션)
- [개발 부록](#개발-부록)

## 스프린트 한눈 요약

`우리 기준`은 `TJ님 + Codex가 로컬 검증 모드까지 닫은 정도`다.
`운영 기준`은 `개발팀이 실제 고객 사이트, 운영 DB, 운영 배포까지 닫은 정도`다.

| Sprint | 무엇을 하는가 | 우리 기준 | 운영 기준 | 지금 확인된 것 | 가장 큰 병목 | 바로 다음 행동 |
| --- | --- | --- | --- | --- | --- | --- |
| [P1-S1](#p1-s1-실험-장부) | 메시지 실험 장부를 만든다 | `100%` | `70%` | 로컬 SQLite 장부와 주문 동기화가 실제 응답으로 돈다 | 운영 DB cutover와 운영 재검증이 남았다 | handoff 패키지로 운영 cutover를 넘긴다 |
| [P1-S1A](#p1-s1a-결제-블랙박스) | `(not set)` 원인을 검증할 블랙박스를 만든다 | `100%` | `35%` | receiver, SQLite ledger, 토스 조인 진단, `live/replay/smoke`, `pending/confirmed/canceled`, status sync route까지 끝났다 | 운영 cutover와 일일 대사 루틴이 아직 고정되지 않았다 | `ledger / sync-status / toss-join / crm-phase1`를 매일 같은 범위로 본다 |
| [P1-S2](#p1-s2-운영자-화면) | 운영자가 실험과 귀속 상태를 보는 화면을 만든다 | `100%` | `70%` | `/crm`에서 실험 생성, 전환 동기화, KPI 표, variant 비교 차트가 뜬다 | 운영 배포와 실사이트 사용자 피드백이 남았다 | 지금 화면을 기준 화면으로 고정하고 운영 handoff를 만든다 |

## 현재 상태

### 확인된 것

- `/crm` 페이지가 `7010`에서 실제로 열린다.
- `/api/crm-local/experiments`가 `7020`에서 실제로 응답한다.
- `crm-local` 실험 장부는 `실험 2건`, `배정 9건`, `전환 7건`을 보유하고 있다.
- `/crm` 실험 운영 탭에서 실험 생성 폼, 전환 동기화 버튼, KPI 표, variant 비교 차트가 모두 동작한다.
- `/crm` 결제 귀속 탭에서 ledger summary, 토스 조인율, GA4 `(not set)` 매출, 일자 비교표를 같이 본다.
- attribution 원장은 SQLite `attribution_ledger`로 승격됐고, **`live 562 / replay 5 / smoke 4`** 상태다.
- `/crm` 결제 귀속 탭에서 `confirmedRevenue / pendingRevenue / canceledRevenue`를 같이 본다.
- `POST /api/attribution/sync-status/toss`가 있어 pending row를 Toss 상태와 대조한다.
- `P1-S1B` hard gate 실행 코드가 추가돼 consent, claim review, quiet hours, cooldown, suppression을 코드로 평가할 수 있다.

### 아직 안 된 것

- ~~실제 고객 사이트에서 `checkout-context`와 `payment-success`를 아직 호출하지 않는다.~~ → **payment-success ✅ 완료 (0402)**. 2026-04-11 새 푸터 이후 biocom `checkout_started`도 수집 시작.
- 운영 DB에 실험 원장 테이블과 attribution ledger cutover는 아직 없다.
- 운영 배포 환경에서 같은 흐름을 다시 검증한 기록은 아직 없다.
- 커피 Toss backfill은 과거 범위로는 가능해졌지만, ROAS 비교에 필요한 최신 Imweb/Toss local sync와 pending status sync가 아직 부족하다.
- live row와 Toss 상태 동기화가 일자 범위별로 안정적으로 맞는지에 대한 운영 기록은 아직 부족하다.

### 지금 막힌 이유

- ~~실제 고객 사이트 결제 완료 진입점이 이 workspace 밖에 있다.~~ → **해결됨**
- 운영 DB 수정은 현재 개발팀만 할 수 있다.
- 커피 live/orderId 기준 조회와 과거 local backfill은 가능해졌지만, 2026-04-11 기준 coffee Meta token 만료와 local cache stale 때문에 최신 ROAS/LTR 재산출은 아직 전이다.
- 최근 pending sample은 `sync-status` preview에서 다수 unmatched라, 운영 DB 타이밍 차이를 보는 루틴이 필요하다.

### 현재 주체

- `TJ님 + Claude Code`: live receiver 운영, `/crm` 운영 화면, 아임웹 푸터 코드 관리
- `Codex`: 백엔드 로직, referrer 파싱, 필터링 API, 진단 장치
- 개발팀: 운영 DB 반영, 운영 배포

## 산출물

### 1. 실험 장부

무엇을 만들었는가:

- 실험 정의 장부
- 고객 배정 장부
- 구매/환불/순매출 결과 장부

우리 프로젝트에 주는 도움:

- 메시지 실험을 `보냈다`가 아니라 `실제로 얼마를 만들었다`로 판단할 수 있다.
- holdout/control/treatment 비교가 가능해진다.

### 2. 결제 블랙박스

무엇을 만들었는가:

- checkout 시작 수신점
- payment success 수신점
- 토스 승인과 붙여 보는 조인 진단
- GA4 `(not set)`과 같은 날짜에 나란히 보는 비교표

우리 프로젝트에 주는 도움:

- `(not set)`이 PG 문제인지 계측 누락인지 감이 아니라 기록으로 본다.
- P7 실험 uplift 해석 전에 전환 원장 신뢰도를 먼저 확인할 수 있다.

### 3. 운영자 화면

무엇을 만들었는가:

- `/crm` 안의 `실험 운영`, `결제 귀속` 중심 화면
- blocker 카드, KPI 카드, 실험 표, 배정 표, variant 비교 차트

우리 프로젝트에 주는 도움:

- 운영자가 지금 무엇이 막혔는지 바로 본다.
- 실험 숫자와 결제 귀속 진단을 한 화면에서 이어서 본다.

## P1-S1 실험 장부

### 결론

`P1-S1`은 우리 기준으로 완료다.
지금 남은 것은 구현이 아니라 운영 반영이다.

### 무엇을 하는가

이 스프린트는 `누가 어느 실험군에 들어갔고, 나중에 무엇을 샀는지`를 한 장부로 묶는다.

비유하면 `시험지를 나눠주고, 답안지를 걷고, 채점표까지 만드는 단계`다.

### 확인된 것

- 로컬 SQLite 기반 실험 장부가 실제 API로 동작한다.
- `GET /api/crm-local/stats` 기준 `실험 2건`, `배정 9건`, `전환 7건`이 적재되어 있다.
- 이전 shadow 검증에서는 `120명` 배정, `78건` conversion 적재까지 확인했다.
- 실험 생성, 배정, 주문 기반 conversion sync, variant 결과 조회가 모두 닫혔다.

### 아직 안 된 것

- 운영 DB에 같은 스키마를 아직 올리지 못했다.
- 운영 배포 환경에서 같은 실험을 다시 돌린 기록은 아직 없다.

### 지금 막힌 이유

- 현재 정책상 운영 DB 스키마 수정은 개발팀만 가능하다.

### 다음 행동

1. shadow 검증 결과를 운영 handoff 문서로 넘긴다.
2. 운영 DB에 CRM 원장 4개 테이블을 만든다.
3. 운영 환경에서 실험 1건을 다시 생성해 같은 흐름을 확인한다.

## P1-S1A 결제 블랙박스

### 결론

**`P1-S1A`는 우리 기준으로 완료다 (0406).**
live row + UTM 추적, Toss 키 반영, local backfill, SQLite ledger 승격, `payment_status`, status sync route까지 반영되었다. 2026-04-11 기준으로는 새 푸터 `checkout_started` 수집도 시작됐다. 남은 것은 coffee token/sync 복구 후 KPI 재산출, `GA4 (not set)` 진단 루틴 고정, CAPI/Pixel dedup 확인, 운영 대사 루틴 고정이다.

### 무엇을 하는가

이 스프린트는 결제 과정의 앞뒤를 기록한다.

- checkout을 시작한 순간을 남긴다.
- payment success가 온 순간을 남긴다.
- 그 기록을 토스 승인과 GA4 `(not set)` 날짜와 붙여 본다.

비유하면 `결제 플로우에 블랙박스와 게이트 통과 기록기를 다는 일`이다.

### 확인된 것 (0408 late update)

- `POST /api/attribution/checkout-context`가 있다.
- `POST /api/attribution/payment-success`가 있고 live row가 누적 `560건`이다.
- `GET /api/attribution/ledger`, `GET /api/attribution/toss-join`, `POST /api/attribution/sync-status/toss`가 있다.
- `GET /api/attribution/ledger?source=thecleancoffee_imweb&captureMode=live`로 커피 전용 live row 필터 가능하다.
- `GET /api/crm-phase1/ops`가 GA4 `(not set)`, 토스 승인, receiver row를 한 응답으로 묶어 준다.
- `GET /api/attribution/ledger` 기준 capture mode 분포는 **`live 566 / replay 5 / smoke 4`**다.
- payment status는 `pending 320 / confirmed 244 / canceled 4`이다.
- `GET /api/attribution/caller-coverage`가 있어 live caller의 `ga_session_id / client_id / user_pseudo_id` 누락률을 바로 본다.
- public `att.ainativeos.net`에서도 `GET /api/attribution/caller-coverage`가 `200`으로 열리고, 최신 dedupe 정책이 배포 반영됐다.
- `/crm` 결제 귀속 탭에서 `confirmedRevenue / pendingRevenue / canceledRevenue`를 같이 본다.
- replay 기준 토스 조인은 `5/5`로 붙었다.
- `aibio.ai`는 `form_submit` 원장 기준 live `6건`, 최신 `snippetVersion=2026-04-08-formfetchfix-v5`까지 검증됐다.
- `thecleancoffee.com`는 `snippetVersion=2026-04-08-coffee-fetchfix-v2`로 교체 완료됐고, 실제 가상계좌 주문 `202604080749309`에서 3종 식별자 all-three row가 처음 적재됐다.

### 아직 안 된 것

- ~~실제 고객 사이트에서 들어온 live payment success row도 아직 없다.~~ → **✅ 560건 달성**
- ~~더클린커피 payment_success caller parity가 아직 안 닫혔다.~~ → **✅ fetch-fix v2 live 검증 완료**
- ~~checkout-context(V2)는 아직 미연결~~ → 2026-04-11 새 푸터 이후 `checkout_started` 수집 시작. 이제는 실제 운영 24시간 연결률 관찰이 필요하다.
- 커피 Toss 키 반영 완료 + `store=coffee` orderId/paymentKey 크로스 검증 성공.
- coffee KPI 재산출과 운영 문서 반영은 아직 남아 있다. 단, coffee Meta token 만료와 Imweb/Toss local cache 최신성 문제를 먼저 풀어야 ROAS 비교가 의미 있다.
- `GA4 (not set)` historical row를 BigQuery raw export / hourly compare까지 묶어 원인 분해한 운영 로그는 아직 부족하다.

### 지금 막힌 이유

- ~~실제 checkout/payment success 코드가 이 workspace 밖에 있다.~~ → **해결됨 (아임웹 푸터 코드)**
- 커피 key 자체는 확보했지만, ROAS 비교 관점에서는 아직 끝난 상태가 아니다. Meta coffee token은 만료 오류가 나고, coffee Imweb/Toss local cache가 최신 구간을 충분히 설명하지 못한다.
- 최근 pending sample 기준 Toss 매칭이 바로 닫히지 않는 구간이 있어, status sync preview를 일일 점검 루틴으로 묶어야 한다.

### 다음 행동

1. **새 푸터 이후 24시간 관찰** → `checkout_started -> payment_success`가 `checkout_id`, `fbclid/fbc/fbp`, `ga_session_id/client_id/user_pseudo_id`로 이어지는지 본다.
2. **CAPI/Pixel dedup 확인** → 최근 주문 샘플에서 Meta Purchase가 주문 1건당 몇 번 들어갔는지, Pixel과 CAPI가 같은 `event_id`를 공유하는지 확인한다.
3. **커피 ROAS 비교 준비** → coffee Meta token 재발급, Imweb/Toss local sync 최신화, pending status sync 후 biocom과 같은 방식으로 비교한다.
4. **GA4 `(not set)` 진단 루프 고정** → `BigQuery raw export + hourly compare + caller coverage + crm-phase1/ops`를 같은 날짜 범위로 읽는다.
5. **일일 정합성 체크 루틴 고정** → `ledger / sync-status / toss-join / crm-phase1 / roasphase`를 같은 범위로 매일 본다.
6. 운영 DB에 attribution ledger cutover.

## P1-S2 운영자 화면

### 결론

`P1-S2`는 우리 기준으로 완료다.
이제 화면 자체를 더 만드는 일보다 운영에 전달하고 실제 사용자 피드백을 받는 일이 남았다.

### 무엇을 하는가

이 스프린트는 실험 장부와 결제 블랙박스를 운영자가 읽을 수 있는 화면으로 바꾼다.

비유하면 `관제실 모니터`다.

- 어느 실험이 있는지
- 지금 무엇이 막혔는지
- variant별 숫자가 어떻게 다른지
- `(not set)` 검증이 어디까지 왔는지

이걸 한 화면에서 본다.

### 확인된 것

- `/crm`이 `7010`에서 `HTTP 200`으로 열린다.
- `실험 운영` 탭에서 실험 생성 폼이 동작한다.
- 같은 탭에서 전환 동기화 버튼과 KPI 표가 동작한다.
- 같은 탭에 variant 비교 차트를 추가해 매출과 구매율을 동시에 본다.
- 선택된 실험이 없을 때 첫 실험을 자동으로 선택하도록 보강했다.
- 새 실험 생성 후 바로 그 실험 상세로 진입하도록 보강했다.
- `결제 귀속` 탭에서 blocker 카드, ledger summary, 토스 조인율, GA4 `(not set)` 비교표가 뜬다.

### 아직 안 된 것

- 운영 배포 환경에서 이 화면을 기준 화면으로 굳히는 절차가 남았다.
- 실제 운영 사용자가 이 화면으로 daily review를 돌린 기록은 아직 없다.

### 지금 막힌 이유

- 화면 구현 자체는 막히지 않았다.
- 남은 것은 운영 cutover와 실제 사용자 피드백 수집이다.

### 다음 행동

1. 지금 `/crm` 화면을 Phase 1 기준 화면으로 문서에 고정한다.
2. 운영 handoff 문서에 접속 경로와 검증 순서를 넣는다.
3. 실제 고객 사이트 receiver 연결 후 `결제 귀속` 탭에서 live row를 다시 확인한다.

## 다음 액션

### 지금 당장

1. ~~실제 고객 사이트 checkout 시작 시점을 찾는다.~~ → payment-success는 ✅ 완료
2. ~~실제 payment success 진입점에 receiver 호출을 넣는다.~~ → ✅ 완료 (0402)
3. ~~live row 1건 이상을 목표로 다시 검증한다.~~ → ✅ **560건 달성**

### 이번 주 (0411 기준)

1. **새 푸터 이후 24시간 관찰** → `checkout_started`, `payment_success`, `checkout_id`, `fbclid/fbc/fbp`, GA 3종 식별자 연결률 확인
2. **CAPI/Pixel dedup 확인** → Events Manager에서 최근 주문 샘플 기준 Purchase 이벤트 수와 `event_id` 공유 여부 확인
3. **GA4 `(not set)` 원인 좁히기** → `BigQuery raw export`, `hourly compare`, `caller coverage`, `crm-phase1/ops`를 같은 날짜 범위로 대조
4. **더클린커피 ROAS 비교 준비** → coffee Meta token 재발급, Imweb/Toss local sync 최신화, pending status sync
5. **일일 정합성 체크 루틴 고정** → `GET /api/attribution/ledger`, `GET /api/attribution/caller-coverage` 또는 동등 진단, `POST /api/attribution/sync-status/toss?dryRun=true`, `GET /api/attribution/toss-join`, `GET /api/crm-phase1/ops`, [roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md)
6. **settlement coverage 마감** → 장거리 backfill 완료 응답과 최종 coverage 수치 확정
7. **P3 첫 operational live 실행** → 세그먼트 1개 고정 후 실제 발송/전환 추적 시작

### Toss API 연동 완료 (0401)

- **바이오컴 + 커피 키 반영 완료 (0406)**: `store=biocom|coffee` 기준 orderId 상세 조회 실검증 성공, coffee local backfill `5,043건` 적재
- `GET /v1/transactions` — 일별 거래 건수/금액/카드사/상태 조회 가능
- `GET /v1/settlements` — 정산 금액/PG 수수료/실 정산금 조회 가능
- `GET /v1/payments/orders/{orderId}` — 아임웹 orderId로 결제 상세 조회 가능
- MID: `iw_biocomo8tx` (바이오컴), `iw_thecleaz5j` (더클린커피)
- `env.ts`에 biocom/coffee explicit Toss env alias 지원 추가
- `/health`에서 `toss: { ready: true }` 확인
- 상세 문서: `/Users/vibetj/coding/seo/tossapi.md`

활용 계획:
- P1-S1A 결제 귀속 탭에서 Toss 실시간 데이터 연결 (기존 replay → live 전환)
- orderId로 아임웹 주문과 Toss 결제 1:1 매칭 → 토스 조인율 100% 목표
- 정산 데이터로 PG 수수료 실비 산출 → 순이익 계산 정확도 향상

### Toss API 백엔드 라우트 구현 (0401)

`backend/src/routes/toss.ts` 신규 생성. 4개 엔드포인트:

| API | 용도 | 테스트 결과 |
|-----|------|-----------|
| `GET /api/toss/transactions` | 일별 거래내역 | ✅ 3/25~31 100건 조회 |
| `GET /api/toss/settlements` | 정산내역 (매출/수수료/정산금) | ✅ 건별 3.63% 수수료 확인 |
| `GET /api/toss/payments/orders/{orderId}` | orderId로 결제 상세 | ✅ 아임웹 주문번호로 1:1 매칭 |
| `GET /api/toss/daily-summary` | 일별 요약 (매출/수수료/카드/가상계좌) | ✅ 일별 집계 정상 |

실측 데이터:
- 3/25~26 정산: 100건, 매출 ₩23,588,584, 수수료 ₩803,959 (3.41%), 정산 ₩22,784,625
- orderId `202603287152117-P1` → 카드 신용, ₩725,000, 2026-03-28 승인

P1-S1A A단계(Toss API 기반) 완료:
- 토스 조인: Toss API에서 직접 orderId 매칭 → receiver 불필요
- PG 수수료: 건별 실비 확인 가능 → 원가/이익 분석 정확도 향상
- 가상계좌: method + amount로 미입금 건 식별 가능
- 일별 추이: daily-summary로 매출/수수료 트렌드 확인

### 운영 승인 후

1. 운영 DB에 CRM 실험 장부 테이블을 반영한다.
2. 로컬 SQLite attribution ledger와 같은 스키마를 운영 DB에 cutover한다.
3. 운영 환경에서 실험 1건과 payment success 1건을 다시 검증한다.

## 개발 부록

### 이번 턴에 실제로 밀어 올린 것

- `/crm` 실험 운영 탭에 variant 비교 차트를 추가했다.
- 선택된 실험이 없을 때 첫 실험을 자동 선택하게 했다.
- 새 실험 생성 후 바로 상세를 보도록 보강했다.
- 문서 기준을 `실제 응답값` 기준으로 다시 고쳤다.

### 구현 위치

- 실험 장부 DB/API: `/Users/vibetj/coding/seo/backend/src/crmLocalDb.ts`, `/Users/vibetj/coding/seo/backend/src/routes/crmLocal.ts`
- 결제 원장/토스 조인: `/Users/vibetj/coding/seo/backend/src/attribution.ts`
- Phase 1 진단 집계: `/Users/vibetj/coding/seo/backend/src/crmPhase1.ts`
- `/crm` 화면: `/Users/vibetj/coding/seo/frontend/src/app/crm/page.tsx`

### 최근 검증 (0408-0411 update)

- TypeScript attribution 타입 체크: 에러 0건
- `GET /api/attribution/ledger` 기준 `total 575`, `live 566 / replay 5 / smoke 4`
- 같은 응답에서 `payment_status = pending 320 / confirmed 244 / canceled 4`
- 같은 응답에서 `confirmedRevenue ₩57,475,165 / pendingRevenue ₩589,024,047 / canceledRevenue ₩813,088`
- `POST /api/attribution/sync-status/toss?dryRun=true&limit=20` -> recent pending sample `20건` preview, `matched 0 / updated 0 / unmatched 20`
- biocom live caller 검증 -> `orderId 202604081311774`, `payment_status=pending`, `snippetVersion=2026-04-08-fetchfix`, `ga_session_id=1775652461`
- coffee live caller 검증 -> `orderId 202604080749309`, `payment_status=pending`, `snippetVersion=2026-04-08-coffee-fetchfix-v2`, `ga_session_id=1775659560`
- raw ledger source check -> `biocom_imweb live payment_success 491건 중 all-three 7건`, `thecleancoffee_imweb live payment_success 62건 중 all-three 1건`, `aibio_imweb live form_submit 6건`
- live HTML check -> `biocom.kr`는 fetch-fix caller 반영, `aibio.ai`는 form-submit v5 반영, `thecleancoffee.com`도 fetch-fix v2 반영
- public backend route check -> `https://att.ainativeos.net/api/attribution/caller-coverage` `200`, AIBIO 30초 간격 재제출 2건 모두 `201` 저장
- `GET /api/crm-local/imweb/order-stats?site=biocom` -> latest local `imweb_orders 5750건`, `firstOrderAt 2026-01-27`, `lastSyncedAt 2026-04-07 16:39:41`
- `GET /api/toss/local-stats` -> latest local `toss_settlements 20,388건`, `totalPayout ₩4,720,106,642`
- `GET /api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30` -> GA4 `(not set)` 매출 `₩148,523,642` 확인
- same-day status preview check -> `POST /api/attribution/sync-status/toss?dryRun=true&limit=5` 기준 최신 coffee/biocom pending 주문은 아직 `unmatched`, 즉 pending/confirmed 구분은 되지만 즉시 승격되진 않음
- biocom payment page console check -> 0408에는 `GTM-W7VXS4D8` custom script `includes` 오류가 관찰됐지만, 0411 리인벤팅 CRM 코드 제거 후 live HTML/Headless Chrome 검증에서 W7 호출과 기존 오류가 사라졌다

### 해석 주의

- `P1-S1`은 실험 배선이 닫혔는지 보는 수치다.
- `P1-S1A`는 아직 원인 확정 단계가 아니다.
- `P1-S2`는 화면 구현 완료와 운영 반영 완료를 구분해서 봐야 한다.
