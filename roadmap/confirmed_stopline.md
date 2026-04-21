# Confirmed Stop-line 워크스트림

작성 시각: 2026-04-20 18:05 KST
기준일: 2026-04-20
버전: v2.3 (Codex 조사 완료: `(not set)` 520건 root cause = GTM purchase 태그 URL fallback 부재. TJ GTM 액션 2단계 정리.)
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
| [[#C-Sprint 4]] | Phase 1 | Meta CAPI Refund + GA4 MP Refund 구현 | TJ + Codex | **✅ 완료 (2026-04-20 13:50 KST)** — Meta Refund 1,844 / Meta Purchase(-) 1,844 / GA4 1,844 전건 전송. coffee 23건 포함. GA4 Realtime API 로 biocom 1,835 + coffee 25 양쪽 확인. |
| [[#C-Sprint 5]] | Phase 3 | identity coverage 원인 분해 | Codex | **🟡 3/5 원인 정량화 완료 (2026-04-20 15:20 KST)** — historical 60% · duplicate 13건 · field coverage 12종 확인. session_lost / raw_export_unknown 은 BigQuery 접근 대기 |
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

**이름**: Meta CAPI Refund + GA4 MP Refund (옵션 C 수정판: Purchase 음수 value 가 core. Refund custom event 는 관측 미가시 한계 확인)
**상태**: **우리 100% / 운영 100%** — biocom·unknown·coffee 전건 Meta Refund + Meta Purchase(-) + GA4 MP 모두 전송. GA4 Realtime API 로 biocom 1,835·coffee 25 육안 검증. Meta Ads Manager 캠페인 ROAS 육안 확인만 대기 (24~48h 후).

**왜 옵션 C 였고 v1.6 에서 어떻게 축소됐는가**

v1.4 에서 1,844건 Refund custom event 를 보냈지만 TJ 가 Meta Events Manager UI 개요 탭에서 `refund` 검색 시 0건이었다. 원인은 **Meta 17개 표준 이벤트 목록에 `Refund` 가 없어** custom event 로 HTTP 200 수신·집계는 되지만 UI 기본 이벤트 목록에 자동 노출되지 않는 정책 때문이다.

v1.5 결정: **옵션 C = A + B 둘 다**. 1건 refund 에 대해 Meta CAPI 2번 호출 (Refund custom + Purchase 음수).

v1.6 수정 (2026-04-20): 옵션 A 의 UI 가시화를 **포기**.
- TJ 가 Events Manager → 이벤트 추가 → 직접 만들기 → "웹사이트 및 앱 이벤트" 경로를 시도했으나, 이 다이얼로그는 **AEM(취합된 이벤트 측정) / iOS 14+ 우선순위 이벤트** 설정용이었다.
- 드롭다운이 "선택한 소스에서 사용 가능한 이벤트가 없습니다"를 반환했고, 자동 선택된 앱 `agentmarketing` 은 **Conversions API System User 앱** (CAPI 인증용)이지 앱 이벤트 소스가 아니었다.
- 즉 **Meta 는 표준이 아닌 custom event 이름을 UI 에서 별도 등록하는 경로 자체를 제공하지 않음**. 맞춤 전환(Custom Conversion) 은 기존 표준 이벤트에 조건 필터를 덧씌우는 다른 기능이며, 동일 기능 아님.

**v1.6 운영 구조**

- **Meta Ads 레벨 ROAS 차감 (core)**: `event_name="Purchase"` + `value` 음수 + `event_id=Refund-As-Purchase.{order_code}` + `custom_data.order_status=refunded` + `original_purchase_event_id` 로 1,844건 전송 완료. 24~48h 후 Meta Ads Manager 캠페인 리포트에서 ROAS 하락으로 확인.
- **Refund 관측 (건수·금액)**: Meta UI 에서 직접 보기는 불가 → **내부 `refund_dispatch_log` + `/ads` Refund 카드** 로 대체. 운영자가 필요한 수치는 여기서 전부 확인 가능.
- **GA4 정정**: MP refund 1,821건 전송, GA4 Realtime API 로 `refund: 1,835` 자체 검증.
- Refund custom event (`event_id=Refund.{order_code}`) 는 코드상 여전히 전송하지만 **Meta UI 관측용으로는 기대하지 않음** — 운영 의사결정에서 제외.

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
- [x] 옵션 C 추가 구현 — Purchase 음수 value 경로 추가 후 전건 backfill 1,844/1,844 완료 (2026-04-18 11:55 KST)
- [x] **Meta UI 에서 Refund custom event 가시화 시도 → 정책상 불가 확인** (2026-04-20 13:15 KST) — 내부 DB/GA4 로 관측 커버 확정
- [ ] [TJ] Meta Ads Manager 캠페인 리포트에서 Purchase value 가 실제로 음수 차감되는지 육안 확인 (2026-04-19~20 이후 24~48h 데이터)
- [x] **coffee GA4 MP secret 발급 + 23건 재전송 완료** (2026-04-20 13:50 KST) — measurement ID `G-JLSBXX7300`, GA4 Realtime API coffee property 에서 `refund: 25` 수신 확인
- [ ] `/ads` Fast Signal ROAS 전후 비교 — Meta Ads Manager 기준 ROAS 변화 확인

---

## C-Sprint 5
[[#Sprint 구조|▲ Sprint 표로]]

**이름**: identity coverage 50% → 85% 개선
**상태**: **우리 70% / 운영 0%** — BigQuery 쿼리 1/2/3/5 실측 완료. 5개 원인 중 4개 정량화 확정 (historical / duplicate / **session_lost / tag_payload_missing**). raw_export_unknown 만 남았고 이는 dataset 접근 자체가 답(=확보됨).

**🔥 핵심 실측 결과 (2026-04-20 BigQuery `hurdlers-naver-pay.analytics_304759974`)**

**쿼리 1 — traffic_source 분포** (최근 30일 purchase, top 50)
- `(direct)/(none)/(direct)`: **1,161건 / ₩284M** ← 최대 누락 의심 origin
- `(direct)/(none)+organic`: 341건 / ₩58M
- Meta 광고(UTM) `meta_biocom_*`: 185+85+85+84+77+... 합산 ~700건 (UTM attribution 정상)
- TikTok `tiktok_biocom_*`: ~250건 (정상)
- Naver / Google CPC: 수백 건 (정상)
- **`(not set)` 은 top 50 안에 없음** — GA4 `(not set)` 문제가 아니라 `(direct)` fallback 문제

**쿼리 2 — session_lost 검증** (30일 purchase event 4,445건)

| 지표 | 값 | 의미 |
|---|---:|---|
| total_purchase_events | 4,445 | |
| missing_ga_session_id | 0 | session 식별자 존재 |
| session_source_null | 0 | traffic_source 다 채워짐 |
| **session_start_missing** | **1,158 (26.1%)** | ★ 매칭 session_start 이벤트 없음 |
| both_missing | 0 | |

**핵심 통찰**: 쿼리 1 의 `(direct)` 1,161 ≈ 쿼리 2 의 session_start_missing 1,158 → **거의 일치**. `(direct)` 는 실제 direct 가 아니라 **"원 세션이 사라져 GA4 가 fallback 으로 direct 처리한 것"**. 즉 **session_lost 가 identity 누락의 주된 원인(전체 26%)**.

**쿼리 3 — duplicate purchase sender** (transaction_id 중복 100 샘플)
- `transaction_id = (not set)` **event_count 520건** ← ★ 별개 대형 이슈
- 나머지: 대부분 동일 `order_no` 에 2건씩 (카카오 sync 재진입 등 정상 중복)
- 해석: **GTM purchase 태그가 주문번호를 못 읽고 여전히 이벤트 발사**하는 케이스 520건. 결제완료 페이지에서 `order_no` 변수 비었을 때도 fire 하는 구조

**🔎 `(not set)` 520건 Codex root cause 조사 결과 (2026-04-20, `data/analysis/transaction_id_not_set_investigation.md`)**

- **핵심 발견**: page_location URL 에는 `order_no` 와 `order_code` 가 이미 들어 있다. 즉 **식별자 부재가 아니라 GTM purchase 태그의 transaction_id 생성/대기/fallback 로직 부재가 원인**.
- **footer final3 는 GA4 purchase 를 직접 쏘지 않음**: `capivm/capi.md:66-75` 가 "GA4 purchase 수정 지점은 footer 가 아니라 biocom GTM container" 로 명시. footer payment_success payload 에도 `transaction_id` 필드 없음 (`footer/biocom_footer_0415_final3.md:948-999`).
- **HURDLERS 플러그인 한계**: `footer/funnel_capi_0415.md:113-142` 가 `items / value / currency` 만 추출하고 `transaction_id` 는 안 제공. GA4 purchase 가 value/items 는 있으면서 transaction_id 만 `(not set)` 되는 구조 설명됨.
- **OAuth 재진입 (`__ref=/oauth`) 가설**: 주원인 아님, 증폭 조건. 현재 코드 근거로는 판정 불가 → BQ raw 에서 `page_location LIKE '%__ref=%2Foauth%'` 비율 별도 확인 필요.

**TJ GTM 액션 (우선순위)**

- **권장 A (우선)**: GTM Custom JavaScript Variable 추가 — `JS - purchase transaction_id with order_no fallback`. `{{DLV - ecommerce.transaction_id}} || {{DLV - hurdlers_ga4.transaction_id}} || URLSearchParams(location.search).get('order_no')` fallback 체인. 기존 GA4 purchase tag 의 `transaction_id` 파라미터를 이 변수로 교체.
- **권장 B (병행)**: GTM purchase trigger guard — `shop_payment_complete` 트리거에 500ms 지연 + 3~5회 retry. transaction_id 변수가 여전히 비면 purchase 발사 차단하고 debug event 만 남김. Header Purchase Guard 와 동일한 "order_no 없으면 발사 금지" 원칙.
- **보류 C**: footer 에서 `gtag('event','purchase',...)` 직접 발사 — GTM purchase 와 이중 발사 위험이 있어 A/B 로 해결 안 될 때만 비상 우회안으로 사용.

**쿼리 5 — click identifier 커버리지** (전체 4,244 purchase tx)

| 지표 | 건수 | 비율 |
|---|---:|---:|
| total_purchase_tx | 4,244 | 100% |
| has_gclid (event_params) | 274 | 6.5% |
| **has_fbclid (event_params)** | **0** | **0% (쿼리 한계)** |
| has_utm_source (event_params) | 3,900 | 91.9% |

주의: `event_params.fbclid = 0` 은 "Meta click 이 없다"가 아니라 **GTM gtag config 가 fbclid 를 custom event param 으로 쏘지 않는다**는 뜻. `collected_traffic_source.gclid` 같은 다른 경로에 있을 수 있음. 추가 쿼리로 확인 필요.

**쿼리 4 — 일자별 `(not set)` 비율 추이 (60일)**

- 2026-02-19 ~ 2026-04-19 총 58일
- **57일 중 56일 `not_set_pct = 0.0%`**
- 유일 예외: 2026-03-18 = 2건 / 2.9% (이상치, GTM 일시 장애 가능성)
- 그 외 전체 일자 `not_set_events = 0`

**반전된 결론**: GA4 raw 에 `traffic_source.source IS NULL / '' / '(not set)'` 인 purchase 는 사실상 0건. 즉 "GA4 (not set) 이 많다"는 우리 가정은 **raw 데이터 레벨에서는 틀림**. 이전 자료 `data/datacheck0406.md` 에서 언급된 "GA4 (not set) 매출 1.485억" 은 실제로는 **UI 표시상 (not set)** (source/medium 조인 실패) 이었거나 **실체는 `(direct)`** 였을 가능성 — 재확인 대상.

**3종 개념 재정의 (v2.0 이후 통일 용어)**

| 용어 | 의미 | 실측 |
|---|---|---|
| `(not set)` | GA4 리포트 UI 에서 source/medium 매칭 실패 표시. raw 에는 거의 없음 | ~0% |
| `(direct)` | GA4 raw 에 `traffic_source.source='(direct)'` 로 명시 저장. 원래 광고 유입이었어도 세션 fallback 되면 여기 | **1,161건 (26%)** |
| `ledger utm_source=''` | 로컬 attribution_ledger 에 UTM 필드가 빈 값. 2026-04-08 fetch-fix 이전 snippet 누락 | 60% (로컬 DB) |

즉 **"identity coverage 개선" 의 진짜 목표는 `(direct)` 로 잘못 분류된 Meta/Google/TikTok 광고 유입을 복원하는 것**이다. `(not set)` 자체는 raw 기준 문제가 아니었다.

**무엇을 하는가**

VM 실측 기준 `payment_success` 세 식별자(clientId / userPseudoId / gaSessionId) all-three 유입률이 50.26%. 즉 절반 주문이 "어떤 광고/세션에서 왔는지" 추적 못 함. 이게 confirmed 정의 고도화보다 ROI 훨씬 크다 (feedback §인사이트 3).

**원인 가설과 검증 (2026-04-20 실측 반영)**

| 가설 | BigQuery 필요? | 실측 결과 | 닫힘 여부 |
|---|---|---|---|
| **historical 누적** | ❌ | `logged_at < 2026-04-08` = 474/791 = **59.9%**. before_fix all-three **0.0%**, after_fix **72.6%** | **✅ 가설 확증** — 누락 대부분이 snippet fix 이전 row. 구조는 이미 해결됨 |
| **duplicate_sender** | ❌ | 같은 `order_id` 에 2~3 entry = **13개 order / extra 14 row** | **✅ 부분 확증** — 3중 전송 주문 발견 (`202604041940047` 등). 원인 재조사 필요 |
| **tag_payload_missing** | 부분 필요 | 전체 field coverage: ga_session_id 29.7%, clientId 29.2%, userPseudoId 29.2%, fbp 9.2%, fbclid 18.6% 등 12종 측정 | **🟡 1차 측정** — 어느 태그에서 누락되는지 확정은 GTM Preview (TJ) |
| session_lost | ✅ 필수 | (BigQuery raw 필요) | ❌ 대기 |
| raw_export_unknown | ✅ 필수 | (hurdlers-naver-pay dataset 접근) | ❌ 대기 |

**BigQuery 없이 지금 실행된 결과물**

- `backend/src/services/identityCoverage.ts` — 4 종 SQL 집계 (era × source, era 총합, duplicate, field coverage, 일자별 시계열)
- `backend/src/routes/identityCoverage.ts` — `GET /api/identity-coverage/summary` / `GET /api/identity-coverage/duplicate-samples`
- `/ads` Identity Coverage 카드 — historical 비중 / after_fix all-three / duplicate count / 진단 3/5 + 12종 필드 coverage 배지

**역할 구분**
- TJ: biocom BigQuery raw 접근 (`hurdlers-naver-pay` legacy dataset 또는 새 export), GTM Preview 접속 (tag_payload_missing 세부 확인)
- Codex: 원인별 비율 분해 쿼리 ✅ 구현. BigQuery 접근 확보 시 session_lost 쿼리 추가
- Claude Code: `/ads` 카드 ✅ 완료. BQ 도착 후 `/tracking-integrity` 에 원인별 막대차트 확장

**실행 단계**
1. [TJ] biocom BigQuery legacy dataset 접근 여부 확인 — 대기
2. ✅ [Codex] BigQuery 없이 가능한 3/5 원인 분해 쿼리 완료 (2026-04-20)
3. ✅ [Codex] 일자별 all-three 시계열 — `identity-coverage/summary.timeSeries`
4. ✅ [Claude Code] `/ads` identity coverage 카드 — historical/after_fix/duplicate + field coverage 배지
5. ✅ [TJ] GA4 Unwanted Referrals 8~5개 도메인 추가 (2026-04-20) — biocom/coffee 모두. 쿼리 4 48h 후 재실행 예약: `data/!datacheckplan.md` 2026-04-22+ 섹션.
6. ✅ [Codex] `(not set)` 520건 root cause 조사 완료 (2026-04-20) — `data/analysis/transaction_id_not_set_investigation.md`. 결론: GTM purchase 태그 URL fallback 부재.
7. [TJ] **GTM Custom JS Variable 추가** — `transaction_id` fallback 체인 (권장 A). biocom GTM 컨테이너에서 GA4 purchase 태그의 transaction_id 파라미터 교체.
8. [TJ] **GTM purchase trigger guard** — 500ms 지연 + 3~5회 retry (권장 B). transaction_id 여전히 비면 발사 차단.
9. [TJ+Codex] duplicate_sender 3중 전송 주문 원인 조사 + GTM Preview 감사.

**완료 기준**
- [x] BigQuery 없이 가능한 3/5 원인이 카드에 정량화됨 (2026-04-20)
- [ ] all-three 유입률이 85% 이상 (현재 after_fix 72.6%)
- [ ] 원인 5종이 전체 누락의 90% 이상을 설명 (현재 3/5 확보)
- [ ] fix 이후 신규 row의 누락률이 별도 추적됨 — 시계열 API 로 제공 중, UI 차트 확장 대기

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

- **v2.5** (2026-04-21 01:40 KST): **🎉 vbank GA4 guard publish 완료 (v137)**. C-Sprint 3 vbank_expired ₩966M 의 GA4 확장 이슈 해결. Exception Trigger `JS - vbank blocked` 변수로 `window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch` starts_with `block_` 확인 후 [143]/[48]/[154] 전부 차단. Meta/TikTok 은 이미 server-decision-guard 로 차단 중이었고, 이번에 GA4 도 동일 원칙 적용. Preview A (카드 11,900원) + B (가상계좌 35,000원) 양쪽 검증 통과. 24~48h 후 BQ 쿼리로 `pay_method=vbank` purchase events 감소 관측 예정. 근거: [[../GA4/gtm_exception_trigger_draft_20260421]] v2, [[../GA4/gtm]] v7.
- **v2.4** (2026-04-20 23:55 KST): **🎉 GTM publish 완료**. Claude 가 GTM API 로 workspace 145 → version 136 생성 → publish → live 매칭 확인 전 과정 실행. 변경 내용: 변수 [250] `JS - Purchase Transaction ID (fallback chain)` 신규 + 태그 [143] HURDLERS 구매 교체 + 태그 [48] 홈피구매 / [43] Npay 에 transaction_id 파라미터 append. 3단계 fallback (HURDLERS dataLayer → ecommerce dataLayer → URL `order_no`) 으로 `(not set)` 520건 1층 문제 해결. 추가 근본 발견: 결제완료 페이지에서 `hurdlers_ga4.transaction_id/value/items` 를 push 하는 GTM 태그가 존재하지 않아 [143] items/value 가 상시 빈 값 — 2층 문제로 별도 sprint. `data/!datacheckplan.md` §48h 쿼리 재실행 및 `data/sql/biocom_ga4_identity_coverage.sql` 쿼리 3 재집계가 publish 효과 측정 핵심. 근거: [[../GA4/gptfeedback_gtm_0420_1reply]] §11, [[../GA4/gtm]] v3.
- **v2.3** (2026-04-20 18:05 KST): **Codex `(not set)` 520건 root cause 조사 완료**. 결론: URL 에는 `order_no`/`order_code` 가 있지만 **GTM GA4 purchase 태그가 URL fallback 을 쓰지 않고 dataLayer `transaction_id` 만 기다리거나 빈 값으로 발사**. footer final3 는 GA4 purchase 를 직접 쏘지 않고 GTM 컨테이너가 발사 지점(`capivm/capi.md:66-75`), HURDLERS 플러그인은 `items/value/currency` 만 제공하고 `transaction_id` 는 안 제공. TJ GTM 액션 2단계 정리 — 권장 A: Custom JS Variable 로 `ecommerce.transaction_id || hurdlers_ga4.transaction_id || order_no` fallback 체인, 권장 B: trigger 500ms 지연 + 3~5회 retry. 보류 C: footer direct gtag (이중 발사 위험). 조사 보고서: `data/analysis/transaction_id_not_set_investigation.md`.
- **v2.2** (2026-04-20 17:45 KST): **GA4 Unwanted Referrals 설정 완료**. biocom `G-WJFXN5E2Q1` 에 기존 13개(biocom.kr / kauth.kakao.com / accounts.kakao.com / nid.naver.com / accounts.google.com / mainpay.co.kr / appleid.apple.com / pg-web-kakao.com / inicis.com / payco.com / pay.naver.com 등) 가 있었고, 이번에 TJ 가 **tosspayments.com / m.tosspayments.com / nicepay.co.kr / m.nicepay.co.kr / orders.pay.naver.com / new.kakaopay.com / pg.innopay.co.kr** 7개 추가 (총 18개). coffee `G-JLSBXX7300` 에도 동일 설정. **핵심은 `tosspayments.com` — 바이오컴 Toss 결제 후 세션 손실의 주범이 이 목록에 빠져 있었음**. GA4 반영 24~48h 대기 후 쿼리 4 재실행 + `(direct)` fallback 비율 하락 확인 예정.
- **v2.1** (2026-04-20 17:35 KST): **쿼리 4 완료 + 가설 정정**. 60일간 일자별 `(not set)` 비율 실측 결과 **57일 중 56일 0.0%, 유일 예외 2026-03-18 2건(2.9%)**. GA4 raw 기준 `(not set)` 은 사실상 존재하지 않음을 확정. 이전에 언급된 "GA4 (not set) 매출 1.485억" 은 raw 가 아니라 UI 리포트 표시였거나 `(direct)` 였음. C-Sprint 5 의 진짜 목표를 **"`(direct)` 로 fallback 된 1,161건(26%)의 원 광고 출처 복원"** 으로 재정의. 이는 GA4 Unwanted Referrals 설정(PG 도메인 8~5개 추가) + footer UTM 복원으로 대부분 해결 가능.
- **v2.0** (2026-04-20 17:15 KST): **BigQuery 실측 결과 입수 → 원인 4/5 확정**. 쿼리 1 top 50 에서 `(direct)` 1,161건 발견. 쿼리 2 에서 `session_start_missing=1,158 (26%)` → **두 수치 거의 일치**로 `(direct)` 실체가 session_lost fallback 임을 확증. 쿼리 3 에서 별개 발견: `transaction_id=(not set)` purchase 이벤트 520건 (GTM 태그가 주문번호 누락 상태로 발사). 쿼리 5: event_params 내 `has_gclid 274 / has_fbclid 0 / has_utm_source 3,900` — fbclid 0 은 GTM gtag 가 fbclid 를 custom event param 으로 안 쏜다는 뜻(`collected_traffic_source` 경로 추가 조사 필요). 쿼리 4 (일자별 not_set 추이) 아직 실행 안 됨. C-Sprint 5 우리 기준 40% → 70%.
- **v1.9** (2026-04-20 16:10 KST): **허들러스 BigQuery 접근 권한 부여 + 분석 SQL 준비 완료**. 허들러스가 `biocomkr.sns@gmail.com` 에 BigQuery Data Viewer + Job User 부여 (프로젝트 `hurdlers-naver-pay`, 데이터셋 `analytics_304759974`). 단 우리 backend service account `seo-656@seo-aeo-487113.iam.gserviceaccount.com` 에는 미부여 → 자동 쿼리 불가 상태. 지금 바로 가능한 작업으로 (1) 분석 SQL 5종을 `data/sql/biocom_ga4_identity_coverage.sql` 에 저장 (BQ Console 에서 TJ 가 직접 실행용) (2) `backend/src/sourceFreshness.ts` 에 `ga4_bigquery_biocom` source config 추가 — service account 권한 도착 시 자동 freshness 체크. TJ 남은 액션 2개: 허들러스에 service account 권한 추가 요청 + BQ Console 에서 5종 SQL 실행 후 결과 공유.
- **v1.8** (2026-04-20 15:20 KST): **C-Sprint 5 BigQuery 없이 가능한 범위 착수**. historical / duplicate_sender / tag_payload_missing 3가지를 `attribution_ledger` 만으로 정량화. 실측: historical 59.9% (474/791, before_fix all-three 0.0% → after_fix 72.6%), duplicate 13 order / 14 extra row. `backend/src/services/identityCoverage.ts` + `routes/identityCoverage.ts` 신규, `/ads` Identity Coverage 카드(4지표 + 12개 필드 배지) 추가. session_lost / raw_export_unknown 은 BigQuery `hurdlers-naver-pay` 접근 확보 후 진행.
- **v1.7** (2026-04-20 13:50 KST): **coffee GA4 MP 경로 완결**. TJ 가 thecleancoffee GA4 property (`326949178`) 에서 measurement ID `G-JLSBXX7300` 확인 + MP API secret 발급 후 `.env` 에 `GA4_MEASUREMENT_ID_COFFEE` / `GA4_MP_API_SECRET_COFFEE` 주입. backend 재시작 → GA4 debug endpoint `validationMessages:[]` 통과 → `refund_dispatch_log` 에서 `ga4_error='ga4_mp_secret_coffee_missing'` 23행 DELETE → `POST /api/refund/dispatch?mode=enforce&limit=100` → 46건 재감지 (coffee 23 + 2026-04-18 이후 신규 23) 모두 Meta Refund / Meta Purchase(-) / GA4 MP 전송 성공. GA4 Realtime 에서 coffee property `refund: 25` 실시간 검증 완료. **C-Sprint 4 우리 100% / 운영 100%**.
- **v1.6** (2026-04-20 13:30 KST): **Meta UI 등록 경로 확인 후 옵션 C 의 A 파트 포기**. TJ 가 Events Manager → 이벤트 추가 → "웹사이트 및 앱 이벤트" 다이얼로그를 열었으나 이 경로는 AEM / iOS 14+ 우선순위 이벤트 설정용이고 자동 선택된 앱 `agentmarketing` (Conversions API System User) 은 앱 이벤트 소스가 아니어서 "사용 가능한 이벤트 없음"을 반환. Meta 는 표준 17개 외 custom event 이름을 UI 에서 별도 등록하는 경로를 제공하지 않음. Refund custom event 전송 자체는 유지하되 관측은 **내부 DB + GA4 Realtime** 으로만 수행. Purchase 음수 value 1,844건이 실제 Meta Ads ROAS 차감 core. 메모리 `reference_meta_custom_event_policy.md` 추가로 재발 방지.
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
- `data/analysis/transaction_id_not_set_investigation.md` — `(not set)` 520건 Codex root cause 조사 (2026-04-20)
- `roadmap/roadmap0415.md` — Phase 0 / 1 / 3에 이 워크스트림 참조 추가
- `roadmap/phase0.md` / `roadmap/phase1.md` — 참조 링크 삽입
