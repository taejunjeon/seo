# Confirmed Stop-line 워크스트림

작성 시각: 2026-04-18 11:55 KST
기준일: 2026-04-18
버전: v1.5 (옵션 C 적용: Refund custom event + Purchase 음수 value 이중 전송. Meta 표준 이벤트 목록에 Refund 없음을 Events Manager UI에서 확인한 뒤 방향 수정)
근거 문서: `data/confirmedreport.md` v4, `confirmedfeedback.md`, `capivm/capi.md` §0, `data/!datacheckplan.md` Phase2-Sprint4
관련 Phase: [[#연관 Phase]]

## 10초 요약

- 이 문서는 **Meta CAPI Purchase 기준 논쟁을 C안으로 종료**하고, 실제 운영 기준에 박히게 만드는 **v1 stop-line**이다.
- confirmed 정의를 95점에서 98점으로 올리는 작업은 후순위로 넘긴다. 지금 돈에 더 가까운 문제는 **identity coverage(~50%)**, **campaign mapping**, **Refund 보정**이다.
- 이번 주 구현 3개 + Codex 작업 4개 + 다음 배치 3개가 전부다. 끝나면 이 문서는 v1으로 닫고 `roadmap0415.md` Sprint 표에 흡수된다.
- aibio는 blocker가 아니라 별도 트랙(센터 상담/결제 CRM)으로 분리해서 biocom/coffee 먼저 전진한다.

## 고등학생 비유

지금까지는 **"완벽한 채점표를 만들자"**는 토론이었다. 이제부터는 **"공식 성적표(회사 매출)와 가채점표(광고 학원 학습용)를 둘로 나누고, 나중에 정정 통지(Refund)를 보내는 체계"**를 만드는 일이다. 채점 세부 규칙을 더 파는 대신, **누가 시험을 봤는지 이름을 정확히 기재**(identity coverage)하는 게 지금 훨씬 중요하다.

## 연관 Phase

이 워크스트림은 단일 Phase가 아니라 **3개 Phase를 가로지른다**. 그래서 Phase 문서에 쪼개 넣지 않고 하나의 stop-line 문서로 묶었다.

| 연관 Phase | 이 문서가 주는 입력 |
|---|---|
| `roadmap/phase0.md` Conversion Dictionary v1 | `confirmed = business_confirmed` / `paid = fast signal` 2원화 정의 확정. v1에서 닫고 후순위로 |
| `roadmap/phase1.md` Measurement Integrity 안정화 | Refund 이벤트(Meta CAPI + GA4 MP) 경로를 Phase 1 스프린트 5·6에 흡수. identity coverage 개선이 Phase 1의 새 작업으로 편입 |
| `roadmap/phase3.md` Signal Quality 확장 | identity coverage 50% → 85% 개선이 EMQ / event_id audit / `checkout_started` 식별자 보강과 한 축. campaign mapping과도 연동 |

## 최종 결정 (TJ 승인 문장)

> **운영 공식 성과판단은 `business_confirmed` 기준으로 본다. 메타 최적화 신호는 `paid` 기반 fast signal을 유지하되, 환불/취소 정정 이벤트를 추가한다. confirmed 정의 고도화는 v1 기준에서 고정하고 후순위로 넘기며, 다음 우선순위는 identity coverage와 campaign mapping이다.**

- [ ] TJ 승인 — 이 한 줄 문장을 Slack/메모에 박고 이후 모든 Phase 논의에서 referent로 씀.

## 왜 이 결정인가 (근거 3줄)

1. **실측 근거**: biocom 카드 p50 42h/p90 91h, coffee 카드 p50 36h/p90 66h. Meta 학습 신호로는 느림 → A안(CAPI=confirmed) 배제.
2. **Toss·아임웹 API 재확인**: Toss API는 구매확정 개념 없음(PG 범위). 아임웹 v2 API는 `complete_time` 하나만 제공, 상태 이력 없음. 정의를 더 깊이 파도 **API가 데이터를 안 줌** → 추가 투자 ROI 낮음.
3. **더 큰 돈**: VM 실측 `payment_success` 2,777건 중 세 식별자 all-three 유입률이 v1 기준 50.26%. 이 절반은 "누가 광고에서 왔는지" 모르는 상태. confirmed 정의 고도화보다 **훨씬 큰 문제**.

---

## Sprint 구조

| Sprint | Phase 매핑 | 목표 | 담당 | 완료 기준 |
|---|---|---|---|---|
| [[#C-Sprint 1]] | Phase 0 | C안 stop-line 문장 확정 | TJ | 승인 문장이 팀 채널에 박힘 |
| [[#C-Sprint 2]] | Phase 0 + Phase 1 | `/ads` Official / Fast Signal 두 줄 분리 | Claude Code + Codex | **✅ 구현 완료 (2026-04-18 15:20 KST)** — API·UI 둘 다 반영, 실측 gap 정상 |
| [[#C-Sprint 3]] | Phase 1 | CANCEL 서브카테고리 4종 분리 | Codex + Claude Code | **✅ 구현 완료 (2026-04-18 15:45 KST)** — API + UI 반영, vbank_expired ₩966M 분리 확인 |
| [[#C-Sprint 4]] | Phase 1 | Meta CAPI Refund + GA4 MP Refund 구현 | TJ + Codex | **✅ 옵션 C 완료 (2026-04-18 11:55 KST)** — Meta Refund(custom) 1,844/1,844, Meta Purchase(-) 1,844/1,844, GA4 1,821/1,844. Events Manager UI에서 `Refund` custom event 등록 + Purchase 이벤트 내 음수 value는 ROAS 자동 차감 |
| [[#C-Sprint 5]] | Phase 3 | identity coverage 원인 분해 | Codex | historical / session_lost / tag_payload_missing / duplicate_sender / raw_export_unknown 비율 테이블 |
| [[#C-Sprint 6]] | Phase 3 | campaign mapping 보정 | Codex + TJ | `(unmapped)` 매출 비율이 20% 이하로 감소 |
| [[#C-Sprint 7]] | 별도 | AIBIO 센터 CRM 접근과 aibio-전용 프레임 설계 | TJ + Codex | `AIBIO_SUPABASE_ANON_KEY` env 추가 + aibio 주문/결제 모델 스펙 문서 |

---

## C-Sprint 1
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: Stop-line 문장 확정
**상태**: 우리 0% / 운영 0%

**무엇을 하는가**

위 §최종 결정 문장을 TJ 채널 승인 → 이후 모든 문서·화면·코드 comment에서 이 문장을 reference. 논쟁 재점화 방지용.

**역할 구분**
- TJ: 문장 검토·승인
- Codex: 해당 없음
- Claude Code: 해당 없음

**실행 단계**
1. [TJ] §최종 결정 문장 읽고 수정 사항 있으면 메모. 없으면 승인.
2. [TJ] 승인 시각 이 문서에 기록 (아래 버전 기록 섹션).

---

## C-Sprint 2
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: `/ads` Official / Fast Signal 두 줄 분리
**상태**: **우리 100% / 운영 0%** (2026-04-18 15:20 KST 구현 완료, 운영 배포 대기)

**구현 실측 검증 (로컬 2026-04-18)**

| site | spend | officialRoas | fastSignalRoas | roasGap |
|---|---:|---:|---:|---:|
| biocom | ₩117,084,603 | 0.27 | 0.30 | -0.03 |
| thecleancoffee | ₩4,695,226 | 0 | 0 | 0 (로컬 ledger 범위 한계) |
| aibio | ₩2,140,009 | 0 | 0 | 0 (shop 주문 없음) |
| **total** | ₩123,919,838 | **0.26** | **0.28** | **-0.02** |

방향 확인: `officialRoas ≤ fastSignalRoas`가 일관되게 성립 (business_confirmed는 paid보다 뒤에 도달하므로 예상 방향). 일자별 데이터에서 2026-04-11 gap=-0.46처럼 최근일은 fast >> official, 시간 지난 날(04-12)은 둘이 수렴.

**무엇을 하는가**

`/ads` 대시보드 상단 카드에 **두 ROAS**를 나란히 보여준다. 사용자가 "공식 숫자"와 "메타 학습 신호"를 혼동하지 않도록 명시적으로 분리.

```
┌─────────────────────────────────┬─────────────────────────────────┐
│ Official ROAS                   │ Fast Signal ROAS                │
│ (business_confirmed 기준)        │ (paid 기준, Meta 학습 신호)       │
│ biocom/coffee — 지연 반영         │ Refund 보정 후 반영되는 수치        │
│ 2026-04-11 기준 1.87x            │ 2026-04-17 기준 2.94x            │
└─────────────────────────────────┴─────────────────────────────────┘
```

**역할 구분**
- TJ: 문구 검토, 운영자 피드백 반영 승인
- Codex: `/api/ads/roas-summary` 응답에 `officialRoas`/`fastSignalRoas` 양쪽 필드 추가
- Claude Code: 카드 UI, 툴팁(차이 설명), 날짜 라벨

**실행 단계**
1. ✅ [Codex] `/api/ads/site-summary`와 `/api/ads/roas/daily` 응답에 `officialRoas`, `fastSignalRoas`, `roasGap`, `officialRevenue` 추가. 구현 위치: `backend/src/routes/ads.ts` — `DailyRoasRow`/`SiteRoasSummary` 타입 확장, `NormalizedLedgerOrder.businessConfirmed/businessConfirmedDate/businessConfirmedAmount` 필드 추가, `loadBusinessConfirmedImwebOrderMap()`, `getOfficialRevenueAmount()`, `sumOfficialRevenue()`, `computeRoasGap()` 신규 헬퍼.
2. ✅ [Codex] Official = Imweb `complete_time IS NOT NULL AND complete_time != ''` 기반 매출. Fast = 기존 `payment_status='confirmed'`와 동일 계산(`confirmedRoas` 유지).
3. ✅ [Claude Code] `frontend/src/app/ads/page.tsx` 3-site 카드 레이아웃 교체. Official/Fast Signal 두 줄, 각 숫자에 title 툴팁(차이 설명), 카드 위 한 줄 안내.
4. ✅ [Claude Code] "~72h 뒤 확정" 소문구, Gap 표시 (+/-).
5. [TJ] 실제 운영자 1명과 화면 확인 → 운영 배포 승인 (대기).

**완료 기준**
- [x] `/ads` 상단에 `Official`과 `Fast Signal`이 두 줄로 보임
- [x] 툴팁 hover 시 차이 이유가 2-3문장으로 설명됨
- [x] 카드 위에 정의 한 줄 안내
- [x] `cd backend && npx tsc --noEmit` green
- [x] `cd frontend && npx tsc --noEmit` green
- [x] `curl /api/ads/site-summary` 실호출로 3필드 수신 확인 — biocom total official=0.26 / fast=0.28 / gap=-0.02 (예상 방향)
- [ ] 운영 배포 후 운영자가 "어느 숫자를 공식 매출로 봐야 하는가?"를 묻지 않게 됨 (운영 검증 대기)

---

## C-Sprint 3
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: CANCEL 서브카테고리 4종 분리
**상태**: **우리 100% / 운영 0%** (2026-04-18 15:45 KST 구현 완료)

**구현 실측 (biocom 전체 기간, 로컬 2026-04-18)**

| 서브카테고리 | 건수 | 금액 | 해석 |
|---|---:|---:|---|
| `actual_canceled` | 290 | ₩87,459,383 | Toss DONE → CANCELED. net 차감 대상 |
| `partial_canceled` | 7 | ₩1,301,670 | Toss 환불액만 차감: ₩693,007 |
| `vbank_expired` | 330 | **₩965,981,433** | 가상계좌 미입금 만료. **매출 아님 — net 차감 안 함** |
| `legacy_uncertain` | 404 | ₩104,443,228 | Toss 미매칭. 수동 확인 대상 |
| 합계 | 1,031 | ₩1,159,185,714 | (gross) |

핵심: Imweb CANCEL gross 11.6억 중 **83%(9.66억)가 가상계좌 미입금 만료**. 이 금액을 net에서 제외해야 ROAS 과소 왜곡 방지.

**무엇을 하는가**

현재 Imweb CANCEL 금액이 gross 기준이라 실제 환불 + 가상계좌 미입금 만료가 섞인다. 4가지로 분리해 **실제 환불만** `/ads` net에 반영.

| 서브카테고리 | 정의 | `/ads` net에 반영? |
|---|---|---|
| `actual_canceled` | Toss `DONE → CANCELED` 실제 환불 | ✅ 차감 |
| `vbank_expired` | 가상계좌 발급 후 `WAITING_FOR_DEPOSIT` 만료 | ❌ 매출 아님 |
| `partial_canceled` | Toss `DONE → PARTIAL_CANCELED` 부분 환불 | ✅ 부분 차감 |
| `legacy_uncertain` | Imweb 원장에는 CANCEL인데 Toss 미매칭/오래된 주문 | 별도 라벨, 자동 차감 안 함 |

**역할 구분**
- TJ: 실제 정책 결정 (vbank_expired를 매출에 반영하지 않는 판단 공식 승인)
- Codex: `purchase-confirm-stats` 내부 분기, 쿼리 작성, 서브카테고리 합계 API
- Claude Code: `/ads` net 카드에 "vbank_expired: ₩X (매출 아님)" 힌트 표시

**실행 단계**
1. ✅ [Codex] `backend/src/routes/crmLocal.ts` `/api/crm-local/imweb/purchase-confirm-stats` 응답에 `cancelSubcategories`, `cancelTotal`, `partialCancelRefundedAmount`, `cancelSubcategoryDefinitions` 추가. Toss `toss_transactions` LEFT JOIN으로 CANCELED/PARTIAL_CANCELED/WAITING_FOR_DEPOSIT 상태 확인해 분기.
2. ✅ [Codex] 4가지 합계 + 건수 + partial_cancel 실제 환불액 `partialCancelRefundedAmount` 반환.
3. ✅ [Claude Code] `frontend/src/app/ads/page.tsx` 3-site 카드 아래에 "매출 보정 내역" 섹션, 4가지 서브카테고리 카드(label/tag/count/amount/tooltip). biocom 선택 시에만 표시.
4. [TJ] legacy_uncertain 404건 / ₩104M (전체 CANCEL의 9%). 실측치는 예상 범위(<10%) 안이지만 개별 원인은 수동 확인 대상.

**완료 기준**
- [x] `/ads`에서 gross와 net이 분리 표시되고, net의 차이 원인이 4가지로 설명됨
- [x] vbank_expired가 net에서 빠져 있음을 UI에 "매출 아님" 태그로 명시
- [x] `cd backend && npx tsc --noEmit` green, `cd frontend && npx tsc --noEmit` green
- [x] `curl /api/crm-local/imweb/purchase-confirm-stats?site=biocom` 실호출로 4종 분리 확인

---

## C-Sprint 4
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: Meta CAPI Refund + GA4 MP Refund (옵션 C: Refund custom event + Purchase 음수 value 이중 전송)
**상태**: **우리 100% / 운영 95%** (옵션 C 구현·backfill 완료. coffee 23건 GA4 + Events Manager UI에서 custom event 등록만 남음)

**왜 옵션 C인가 — v1.4 → v1.5 결정 사유**

v1.4에서 1,844건 Refund custom event를 보냈지만 TJ가 Meta Events Manager UI 개요 탭에서 이벤트 검색 시 `refund` 0건으로 나왔다. 원인은 **Meta 17개 표준 이벤트 목록에 `Refund` 가 없어** custom event 로 수신·저장은 되지만 UI 기본 집계 목록에 자동 노출되지 않는 정책 때문이다.

해결 방향 2가지:

- **옵션 A (UI 등록)**: Events Manager → 이벤트 추가 → 맞춤 이벤트로 `Refund` 등록 → 관측 가능. 단 **광고 캠페인 ROAS 에 자동 반영되지는 않음** (관측 전용).
- **옵션 B (Purchase 음수)**: `event_name="Purchase"` + `value` 음수 로 보내면 Meta 가 해당 Purchase 를 음수로 집계해 **광고 ROAS 에서 자동 차감**. 단 custom event 관측 성격은 잃음.

TJ 결정: **옵션 C = A + B 둘 다**. 동일한 1건 refund 에 대해 Meta CAPI 를 2번 호출.
- Refund custom event (`event_id=Refund.{order_code}`) — 관측용. TJ 가 Events Manager 에서 맞춤 이벤트로 등록하면 월별 통계 가능.
- Purchase value 음수 (`event_id=Refund-As-Purchase.{order_code}`) — ROAS 차감용. 원 Purchase(`event_id=Purchase.{order_code}`) 와 dedup 충돌 없도록 **별도 event_id**. `custom_data.order_status=refunded`, `original_purchase_event_id` 로 원 Purchase 참조 보존.

**dry-run 실측 (로컬 전체 Toss 범위, 2026-04-18 16:10 KST)**

- 총 감지: **1,844건 / ₩498,419,478** (2025-01 ~ 현재)
- biocom 377건 / ₩112,644,641
- thecleancoffee 23건 / ₩858,320
- unknown 1,444건 / ₩384,916,517 (주로 2026-01-18 이전 backfill 주문 — `imweb_orders`에 해당 기간 데이터 없음)
- Meta 전송 0건 / GA4 전송 0건 (dry_run 정상)
- 중복 전송 방지: UNIQUE (order_id, toss_status) 제약으로 재실행해도 기존 건은 skip

**enforce smoke test 실행 (2026-04-18 10:40 KST, 1건)**

- 테스트 대상: `order_id=202601089922200-P1`, biocom 카드 CANCELED, ₩485,000
- 결과: `metaSent=1, ga4Sent=1, 오류 0`
- GA4 MP: biocom secret `GA4_PROTOCOL_API_PASS` (→ `GA4_MP_API_SECRET_BIOCOM` fallback) 로드, measurement_id=`G-WJFXN5E2Q1` 사용, `validationMessages: []` 확인
- Meta CAPI: Refund event, `event_id=Refund.{order_code}`, `user_data.external_id=sha256(order_code)`, `event_time=now`(Toss transaction_at이 7일 초과라 now_fallback), `value=-485000`

**과거 1,844건 대량 backfill 실행 (2026-04-18 10:56 KST, 9분 28초)**

기존 `dry_run` 레코드 1,843건 DELETE 후 `enforce` 모드로 전건 재전송. Toss sync 직후 detect라 총 1,885건 감지됨 (backfill 직전 새로 발견된 취소 전이 포함).

| site | cnt | meta_sent | ga4_sent | total_amount |
|---|---:|---:|---:|---:|
| biocom | 377 | 377 | 377 | ₩112,644,641 |
| (unknown, imweb_orders 매칭 실패) | 1,444 | 1,444 | 1,444 | ₩384,916,517 |
| thecleancoffee | 23 | 23 | **0 (skip)** | ₩858,320 |
| **합계** | **1,844** | **1,844 (100%)** | **1,821 (98.8%)** | **₩498,419,478** |

- `unknown` site는 `imweb_orders`에 2026-01-18 이전 Toss 주문이 없어 매칭 실패. refundDispatcher가 site 미지정 시 biocom credentials 로 fallback → Meta/GA4 모두 biocom pixel/property 로 전송.
- coffee 23건은 GA4 MP secret 미발급(`GA4_MP_API_SECRET_COFFEE` empty)으로 skip. Meta CAPI 는 coffee pixel(`1186437633687388`) + `COFFEE_META_TOKEN` 사용해 전송 성공.

**GA4 Realtime API 자체 검증 (2026-04-18 11:08 KST)**

`GET /api/refund/ga4-verify?site=biocom` (backend 임시 진단 endpoint, BetaAnalyticsDataClient.runRealtimeReport 사용):

```
refund last 30m: 1,835
top events (realtime):
  refund       1835   ← backfill 덕분에 최상위
  page_view    760
  user_id      612
  session_start 383
```

GA4 API 가 1,835건을 실시간으로 보고 — backfill 결과가 실제 GA4 property `304759974` (G-WJFXN5E2Q1) 에 반영된 게 API 레벨에서 검증됨. `refundDispatcher` 응답의 `ga4Sent=1,821` 과 숫자 차이는 GA4 Realtime 30분 윈도우 + 일부 collect 지연 때문.

Meta CAPI 는 custom event `Refund` 가 `/{pixel}/stats?aggregation=event` 에 집계되지 않아 API 로 직접 검증 불가. HTTP 200 응답과 `meta_dispatched=1` 로 수신 확인. 추가 확인은 Meta Events Manager UI(Activity 탭)에서 가능.

**Enforce 과정에서 발견·해결한 2가지 이슈**

**Enforce 과정에서 발견·해결한 2가지 이슈**

1. **Meta `event_time` 7일 윈도우 (subcode 2804003)**: Toss transaction_at 그대로 쓰면 과거 취소 건은 전부 reject. 해결: `event_time = max(tossSec, now - 6d)` 로직으로 6일 초과면 현재 시각 사용, 원래 취소 시각은 `custom_data.original_canceled_at` 으로 보존.
2. **Meta `user_data` 필수 (subcode 2804050)**: CAPI 모든 이벤트에 최소 1개 식별자 필요. 해결: `external_id: [sha256(order_code)]` 추가. order_code 해시라 개인정보 없음.

**무엇을 하는가**

Toss 상태 전이 `DONE → CANCELED / PARTIAL_CANCELED`를 감지 → Meta와 GA4에 **Refund 이벤트**로 뒤따라 전송. fast signal(paid) 기반 CAPI Purchase의 5.2%(biocom 카드) 오염을 자동 정정.

**역할 구분**
- TJ: GA4 Measurement Protocol API secret 발급 (이미 `data/!datacheckplan.md` Phase2-Sprint4에 명시된 선결 과제), 정책 승인
- Codex: 상태 전이 감지 배치, Meta CAPI Refund 스키마, GA4 MP 전송 구현
- Claude Code: `/ads`에 "어제 refund N건 / ₩M" 카드

**실행 단계**
1. [TJ] GA4 admin → Data Streams → Measurement Protocol API secrets 발급. `backend/.env`에 `GA4_MP_API_SECRET_BIOCOM`, `GA4_MP_API_SECRET_COFFEE` 추가 → **enforce 선행필수**.
2. ✅ [Codex] `backend/src/services/refundDispatcher.ts` 신규. Toss `CANCELED`/`PARTIAL_CANCELED` 상태 주문 중 `refund_dispatch_log`에 없는 것만 감지.
3. ✅ [Codex] Meta CAPI Refund 전송 모듈 — `event_name='Refund'`, `event_id=Refund.{order_code or order_id}`, `value = -cancel_amount`. enforce 시 실호출, site별 pixelId/token 분기 (biocom / coffee / aibio).
4. ✅ [Codex] GA4 MP Refund 전송 모듈 — `events:[{name:'refund', params:{transaction_id, value, currency}}]`. site별 `measurement_id` + `api_secret`.
5. ✅ [Codex] dry-run 모드 먼저 (DB 로그만, 실제 전송 없음). UNIQUE(order_id, toss_status) 제약으로 중복 전송 방지. `refund_dispatch_log` 테이블 신규.
6. ✅ [Codex] 라우트 4개 추가: `POST /api/refund/dispatch` (mode=dry_run|enforce), `GET /api/refund/log`, `GET /api/refund/summary?windowDays=N`, `GET /api/refund/pending-preview`.
7. ✅ [Claude Code] `/ads`에 "Refund Dispatch · 최근 90일" 카드: 감지 건수·환불 금액·Meta 전송·GA4 전송 + site별 breakdown + `dry_run`/`enforce` 상태 배지.
8. ✅ [TJ] GA4 MP secret 발급 + `.env` 86행 `GA4_PROTOCOL_API_PASS` 저장 (biocom 기준, measurement_id `G-WJFXN5E2Q1`). 코드 fallback으로 `GA4_MP_API_SECRET_BIOCOM` 읽음. `REFUND_DISPATCH_ENFORCE=true` 주입 + backend 재시작.
9. ✅ [Codex] enforce 1건 smoke test: `metaSent=1, ga4Sent=1` 확인. Meta `event_time` 7일 윈도우와 `user_data.external_id` 이슈 해결.
10. [TJ] 육안 확인 — smoke test 이벤트가 이미 production에 전송됐으므로 지금 확인 가능.
    - **Meta Events Manager** → Data Sources → biocom pixel `1283400029487161` → Overview/Activity에서 오늘 `Refund` custom event 1건 확인.
    - **GA4 → Reports → Realtime**에서 최근 30분 `refund` 이벤트 1건 확인. DebugView는 `debug_mode` 미설정이라 보이지 않음.
11. ✅ [TJ 승인 + Codex] 과거 1,844건 대량 backfill **실행 완료** (2026-04-18 10:56 KST). Meta 1,844/1,844, GA4 1,821/1,844 전송. coffee 23건만 GA4 skip.
12. [TJ] coffee GA4 MP secret 발급 후 `.env` 에 `GA4_MP_API_SECRET_COFFEE` + `GA4_MEASUREMENT_ID_COFFEE` 주입 → coffee 23건 재전송 (`DELETE FROM refund_dispatch_log WHERE ga4_error='ga4_mp_secret_coffee_missing';` 후 dispatch enforce).
13. [선택] refund dispatcher 자동화 — 현재 수동 trigger만. 신규 Toss CANCELED 전이를 주기적으로 잡으려면 `startBackgroundJobs.ts` 에 간단한 cron(예: 30 분마다 `mode=enforce&limit=200` 호출) 추가.

**완료 기준**
- [x] dry-run 감지 → `refund_dispatch_log` 기록 동작
- [x] 중복 전송 방지 (재실행해도 기존 건은 skip)
- [x] `/ads` refund 카드 노출 (5 컬럼: 감지/금액/Meta Refund/Meta Purchase(-)/GA4 Refund)
- [x] backend/frontend tsc green
- [x] enforce smoke test 1건 성공 (2026-04-18 10:40 KST)
- [x] 과거 1,844건 1차 backfill 완료 (Refund custom event + GA4, 2026-04-18 10:56 KST)
- [x] GA4 Realtime API 자체 검증 — `refund: 1,835` 수신
- [x] **옵션 C 추가 구현** — Purchase 음수 value 경로 추가 후 전건 backfill 1,844/1,844 완료 (2026-04-18 11:55 KST)
- [ ] [TJ] Events Manager → 이벤트 추가 → 맞춤 이벤트로 `Refund` 등록 — 등록 후 월별 Refund 통계 UI 가시화
- [ ] [TJ] Meta Ads Manager 캠페인 리포트에서 Purchase value 가 실제로 음수 차감되는지 육안 확인 (24~48시간 후)
- [ ] [TJ] coffee GA4 MP secret 발급 후 coffee 23건 GA4 재전송
- [ ] `/ads` Fast Signal ROAS 전후 비교 — Meta Ads Manager 기준 ROAS 변화 확인

---

## C-Sprint 5
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: identity coverage 50% → 85% 개선
**상태**: 우리 0% / 운영 0%

**무엇을 하는가**

VM 실측 기준 `payment_success` 세 식별자(clientId / userPseudoId / gaSessionId) all-three 유입률이 50.26%. 즉 절반 주문이 "어떤 광고/세션에서 왔는지" 추적 못 함. 이게 confirmed 정의 고도화보다 ROI 훨씬 크다 (feedback §인사이트 3).

**원인 가설과 검증**

| 가설 | 확인 방법 | 닫히는 기준 |
|---|---|---|
| historical 누적 | 2026-04-08 fetch-fix 전후 비율 분리 | fix 이후 row에서 비율 유의미 하락 |
| session_lost | 결제완료 페이지 리다이렉트에서 세션 끊김 | BigQuery raw에서 purchase와 session_start 연결 확인 |
| tag_payload_missing | GTM purchase 태그가 식별자 누락 | W2/W7 Preview, DebugView 비교 |
| duplicate_sender | 여러 purchase sender 중 blank payload | transaction_id 중복 sender 조회 |
| raw_export_unknown | biocom BigQuery raw 미접근 | `hurdlers-naver-pay` dataset 확인 |

**역할 구분**
- TJ: biocom BigQuery raw 접근 (`hurdlers-naver-pay` legacy dataset 또는 새 export)
- Codex: 원인별 비율 분해 쿼리, BigQuery 진단 (있으면) + GA4 Data API fallback
- Claude Code: `/tracking-integrity`에 원인별 막대차트

**실행 단계**
1. [TJ] biocom BigQuery legacy dataset 접근 여부 확인. 의존성: 2번 raw query의 선행필수.
2. [Codex] 원인 5종 분해 쿼리 초안 (BigQuery raw + Data API fallback).
3. [Codex] 사이트·결제수단별 all-three 유입률 시계열 대시보드.
4. [Claude Code] `/tracking-integrity` 또는 `/ads`에 "identity coverage" 카드 + 원인 breakdown.
5. [TJ+Codex] 원인 중 가장 큰 비중에 대해 우선 수정 (대개 tag_payload_missing이 예상).

**완료 기준**
- all-three 유입률이 85% 이상
- 원인 5종이 전체 누락의 90% 이상을 설명
- fix 이후 신규 row의 누락률이 별도 추적됨

---

## C-Sprint 6
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: campaign mapping 보정
**상태**: 우리 0% / 운영 0%

**무엇을 하는가**

Meta confirmed attribution 주문 중 `(unmapped)`로 떨어지는 비율 축소. 이 작업은 `data/!datacheckplan.md` Phase3-Sprint6과 같은 축. `roasphase.md` Phase 5의 alias seed + 사람 검증 방식.

**역할 구분**
- TJ: `manual_verified` 캠페인 alias 후보 승인
- Codex: alias seed 파일, matcher, `valid_from/valid_to/confidence` 스키마
- Claude Code: `/ads`에 mapped / unmapped 분리 표시

**실행 단계**
1. [Codex] Meta campaign audit 결과에서 alias 후보 정리.
2. [TJ] manual_verified 후보만 승인 (fuzzy 금지).
3. [Codex] `valid_from`, `valid_to`, `confidence` 필드를 가진 matcher.
4. [Claude Code] `/ads` unmapped 매출과 mapped 매출 분리 표시.

**완료 기준**
- 최근 7일 Meta attribution 주문의 80% 이상이 campaign_id로 매핑
- unmapped 주문은 별도 큐로 남음

---

## C-Sprint 7
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: AIBIO 센터 CRM 접근과 aibio-전용 프레임 설계
**상태**: 대기 (biocom/coffee stop-line 닫힌 뒤)

**무엇을 하는가**

aibio는 shop 주문이 아니라 **상담 예약 → 센터 결제 전환** 프레임. 이 문서의 "paid→confirmed 지연" 프레임이 안 맞으므로 별도 설계.

**역할 구분**
- TJ: AIBIO 센터 CRM 접근 (env 186-193: `AIBIO_SUPABASE_ID=dev@biocom.kr`, `AIBIO_SUPABASE_PASS=Bico1010!!`, `AIBIO_SUPABASE_PROJECT=aibio-center`). Supabase 대시보드 로그인 후 read-only API key 발급
- Codex: `AIBIO_SUPABASE_ANON_KEY` env 추가, 테이블 스키마 파악, aibio-전용 분석 프레임 스펙
- Claude Code: aibio 전용 리포트 템플릿

**실행 단계**
1. [TJ] Supabase 대시보드 로그인 → Settings → API → anon/service_role key 확인. `anon key`만 env에 등록.
2. [Codex] `AIBIO_SUPABASE_URL` + `AIBIO_SUPABASE_ANON_KEY`로 REST 연결 테스트.
3. [Codex] aibio 핵심 테이블 파악 (상담 예약 / 센터 방문 / 결제 / 재방문).
4. [Codex] aibio 프레임 설계 — "예약 → 방문 → 결제"의 어느 단계가 이 보고서의 `paid`/`confirmed`에 대응하는지, 아예 다른 metric이 필요한지 결정.
5. [Claude Code] aibio 전용 `/ads/aibio` 또는 `/crm/aibio` 카드 설계.

**완료 기준**
- env 추가 완료, API 연결 성공
- aibio 핵심 KPI(예약 수, 방문 전환율, 결제 전환율, 재방문율 등) 확정
- 별도 리포트 1건 생성

---

## 지금 안 할 것

feedback §지금 안 할 것 그대로.

- 결제수단별 모든 상태 전이 이력 완전 복원
- 아임웹 OpenAPI OAuth까지 뚫어서 중간 상태 전부 추적
- 3사이트 100% 완벽 일치 후에만 다음 단계로 가기
- 이 문제를 해결할 때까지 나머지 로드맵 멈추기

## Verification Harness (참고)

feedback §Verification Harness에 따라 **작게 3개만** 먼저. 이 stop-line과 동시에 만들 필요는 없지만, 이후 Phase 7 AI Native OS 단계에서 재등장.

1. source freshness (`backend/scripts/check-source-freshness.ts` 이미 있음)
2. Meta CAPI 중복/오염
3. Purchase Guard sanity

---

## 버전 기록

- **v1.5** (2026-04-18 11:55 KST): **옵션 C 적용** — TJ가 Events Manager UI 에서 `refund` 검색 시 0건으로 나온 것을 계기로 원인 진단(Meta 17개 표준 이벤트에 Refund 없음) + 방향 수정. `sendMetaPurchaseRefund` 신규 함수 추가 (event_name=Purchase, event_id=`Refund-As-Purchase.{order_code}`, value 음수, order_status=refunded, original_purchase_event_id 보존). `refund_dispatch_log` 테이블에 `purchase_refund_dispatched/at/error` 3컬럼 ensureColumn 추가. `dispatchRefunds` enforce 루프에 3번째 호출 통합. `backfillPurchaseRefunds(limit)` 신규 함수와 `POST /api/refund/purchase-refund-backfill` 라우트 추가. 전건 backfill 실행 결과: **Meta Refund 1,844/1,844 + Meta Purchase(-) 1,844/1,844 + GA4 1,821/1,844** (coffee 23 만 secret 미발급 skip). `/ads` refund 카드는 5컬럼(감지/금액/Meta Refund/Meta Purchase(-)/GA4 Refund)으로 확장.
- **v1.4** (2026-04-18 11:10 KST): C-Sprint 4 **과거 1,844건 대량 backfill 완료**. TJ 승인 후 `DELETE FROM refund_dispatch_log WHERE mode='dry_run'` → `POST /api/refund/dispatch?mode=enforce&limit=5000` 568초 실행 → Meta 1,844/1,844 (100%), GA4 1,821/1,844 (98.8%, coffee 23건만 secret 미발급으로 skip). `GET /api/refund/ga4-verify?site=biocom` 로 GA4 Realtime API 에서 `refund: 1,835` 직접 수신 확인. Meta 는 custom event `Refund` 가 stats aggregation 에 안 잡혀 API 검증 불가, Events Manager UI 육안만 가능.
- **v1.3** (2026-04-18 10:40 KST): C-Sprint 4 **enforce smoke test 성공**. biocom GA4 MP secret `.env` 86행 `GA4_PROTOCOL_API_PASS` 주입 → env.ts에서 `GA4_MP_API_SECRET_BIOCOM` fallback 추가 → GA4 debug endpoint `validationMessages:[]` 통과 → `REFUND_DISPATCH_ENFORCE=true` + backend 재시작 → `POST /api/refund/dispatch?mode=enforce&limit=1` 1건 실전송 `metaSent=1, ga4Sent=1`. Meta `event_time` 7일 윈도우 fallback과 `user_data.external_id=sha256(order_code)` 추가.
- **v1.2** (2026-04-18 16:10 KST): C-Sprint 3 구현 완료 반영 (purchase-confirm-stats CANCEL 4종 분리 + `/ads` UI) + C-Sprint 4 dry-run 구현 완료 반영 (`backend/src/services/refundDispatcher.ts`, `backend/src/routes/refund.ts`, `refund_dispatch_log` 테이블, `/ads` Refund Dispatch 카드). dry-run 실측: 1,844건 감지 / ₩498M, biocom 377건 / ₩112M, coffee 23건 / ₩858K. enforce 대기 (GA4 MP secret).
- **v1.1** (2026-04-18 15:20 KST): C-Sprint 2 구현 완료 반영. `backend/src/routes/ads.ts` `/api/ads/site-summary` + `/api/ads/roas/daily` 에 `officialRoas`/`fastSignalRoas`/`roasGap`/`officialRevenue` 추가, `loadBusinessConfirmedImwebOrderMap` 기반 계산. `frontend/src/app/ads/page.tsx` 3-site 카드 Official/Fast 두 줄 + 툴팁 + ~72h 소문구 적용. 양쪽 tsc green, 실호출로 biocom total gap=-0.02 확인 (예상 방향).
- **v1** (2026-04-18 14:40 KST): 최초 작성. `confirmedreport.md` v4의 결론과 `confirmedfeedback.md`의 우선순위를 하나의 워크스트림으로 묶음.

## 관련 문서

- `data/confirmedreport.md` — v4 실측 분포와 C안 근거
- `confirmedfeedback.md` — 외부 피드백 원본 (C안 자신감 92%, stop-line 제안)
- `capivm/capi.md` §0 — A(BI 보정) + C(MP refund) + B(GTM 금지) 설계
- `data/!datacheckplan.md` Phase2-Sprint4 — CANCEL 서브카테고리 + MP refund
- `data/!datacheckplan.md` Phase3-Sprint5 — GA4 `(not set)` 원인 분해 (identity coverage와 겹침)
- `data/!datacheckplan.md` Phase3-Sprint6 — campaign mapping
- `roadmap/roadmap0415.md` — Phase 0 / 1 / 3에 이 워크스트림 참조 추가
- `roadmap/phase0.md` / `roadmap/phase1.md` — 참조 링크 삽입
