# NPay 결제완료 Return 누락 이슈

최초 발견: 2026-04-21 00:47 KST (GTM Preview Run 2)
작성: 2026-04-21 01:10 KST
분류: Measurement Integrity (P1) + CRM 신호 누락
상위 워크스트림: [[gtm]] · [[gptfeedback_gtm_0421_2reply]] §12

## 10초 요약

- biocom 에서 **네이버페이로 실제 결제 완료 후 biocom.kr 로 돌아오지 않음** (TJ 2026-04-21 00:47 Preview 실측)
- `shop_payment_complete` URL 미도달 → [143]/[48]/[43]/[251] 모두 발사 기회 없음 → **GA4 purchase / Meta CAPI Purchase 이벤트 미발사**
- backend `attribution_ledger` / `imweb_orders` 는 서버 webhook 으로 기록되지만 **client-side 추적은 전부 공백**
- TJ 검토 중: **NPay 버튼을 없애버리는 옵션** — 전환율 영향 비교 설계 필요

## 1. 관측 사실

### 1-1. Preview 실측 (2026-04-21 00:47 KST)

시나리오: TJ 가 GTM Preview 모드에서 `biocom.kr/HealthFood/?idx=386` (36,900원 메타드림 식물성 멜라토닌) 제품 상세페이지에 진입 → NPay 버튼 클릭 → 네이버페이 로그인 → 실제 결제 완료. 네이버페이 화면에서 플로우 종료, biocom.kr 복귀 없음.

**Pages Tagged 4/11**. biocom GTM 컨테이너는 결제 완료 후 더 이상 로드되지 않음.

**실행된 biocom 태그 (Preview 전체 기간 누적)**:

| 태그 | 실행 횟수 | 의미 |
|---|---|---|
| [118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세) | 2회 | NPay 버튼 클릭 시 DOM 중복 매칭 (기능 영향 없음) |
| [128] HURDLERS - [이벤트전송] 네이버페이 구매 | 1회 | eventName=`add_payment_info`, 결제수단 선택 signal |
| [248] TechSol - [GAds]NPAY구매 51163 | 1회 | Google Ads purchase conversion — **버튼 클릭 시점에 발사** |
| [110] HURDLERS - [데이터레이어] 초기화 | 2회 | 버튼 클릭 전후 `hurdlers_ga4: { items: undefined }` 리셋 |
| [146] 플러그인, [133] 상세페이지 DL, [157] view_item 등 | 표준 발사 | 상세페이지 조회 일반 |

**미발사 태그 (핵심)**:

| 태그 | 미발사 이유 |
|---|---|
| [143] HURDLERS - [이벤트전송] 구매 | trigger `_event equals h_purchase` — biocom 결제완료 페이지 미도달로 `h_purchase` 이벤트 발사 기회 없음 |
| [48] GA4_구매전환_홈피구매 | trigger `Page Path contains shop_payment_complete` — URL 미도달 |
| [43] GA4_구매전환_Npay | trigger `_event equals conversion` — biocom footer 의 `conversion` 이벤트 미발사 |
| [251] biocom - [데이터 준비] (Claude draft) | setupTag 매개 [154] 실행 기회 없음 |

### 1-2. Google Ads Purchase 는 Silent 하게 발사됨

TechSol 의 [248] 이 **NPay 버튼 클릭 시점** 에 `TechSol - [GAds]NPAY구매 51163` 을 발사. trigger:
- `{{Click Element}} cssSelector [id^='NPAY_BUY_LINK_IDNC_ID_']`
- `{{TechSol - Custom Javascript 30698}} > 0`

**의미**: Google Ads 의 "NPAY 구매 전환" 은 실제로는 **버튼 클릭 signal**. 실제 결제 완료가 아니라 클릭 수만 전환으로 기록되고 있음. 결제 실패/취소/미입금 케이스도 모두 전환으로 집계되는 구조일 가능성 — 별도 감사 필요.

## 2. 영향 추정

### 2-1. Client-side 채널 별

| 채널 | NPay 결제에 기록되는 것 | 기록 안 되는 것 |
|---|---|---|
| GA4 purchase 이벤트 | ❌ 없음 | 전체 |
| GA4 add_payment_info | ✅ [128] 에서 1회 | 실제 완결 여부 미반영 |
| Meta CAPI Purchase | ❌ 발사 안 됨 (footer 가 결제완료 페이지에서 쏘는 구조라면) | 전체 |
| Meta Pixel Purchase | ❌ 동일 | 전체 |
| Google Ads NPay conversion | ⚠️ 버튼 클릭 시 발사 = 클릭 수 기준 | 실제 결제 완료 여부 |
| Channel.io PurchaseComplete | ⚠️ [55] 채널톡_구매전환 trigger 확인 필요 | (확인 필요) |
| TikTok Pixel Purchase | ❌ (TikTok Purchase Guard 가 결제완료에서 쏘는 구조) | 전체 |

### 2-2. Server-side (운영 DB 는 정상)

- `attribution_ledger` — biocom backend 가 Imweb webhook / Toss sync 로 수신 (정상)
- `imweb_orders` / `imweb_order_sections` — `/v2/shop/orders` API 로 정기 sync (정상)
- `toss_transactions` — TJ의 Toss sync 로 수신 (정상)

즉 **"돈은 들어오는데 광고 리포트와 GA4 에는 안 보이는 주문"** 이 NPay 플로우로부터 발생.

### 2-3. ROAS / 데이터 정합성 관점

- `/ads` **Official ROAS**(imweb business_confirmed 기반) 는 NPay 매출도 포함 — 영향 없음
- `/ads` **Fast Signal ROAS**(paid 기반) 도 영향 없음 (동일 소스)
- **GA4 Standard 리포트의 revenue** — NPay 매출 만큼 누락
- **Meta Ads Manager 에서 보는 ROAS** — CAPI/Pixel Purchase 미발사라 NPay 기여 제외
- **Google Ads ROAS** — NPay 버튼 클릭을 purchase 로 잡고 있으므로 **과다 집계** 가능

## 3. 원인 가설 3가지

### 3-1. (가장 유력) 아임웹 NPay 플러그인의 결제 완료 UI 가 자체 완결

네이버페이 결제 완료 시 아임웹의 NPay 결제 플러그인이 **자체 완료 UI** 를 pay.naver.com 도메인 내부에서 표시하고, return URL 로 redirect 를 하지 않음. 또는 redirect 는 있지만 "확인" 버튼 클릭 의존.

### 3-2. Return URL 설정 누락

아임웹 쇼핑몰 관리자 → 결제 설정 → 네이버페이 연동 설정에서 return URL 이 `shop_payment_complete` 로 설정 안 되어 있거나 비어있음.

### 3-3. 네이버페이 결제 화면의 사용자 행동 이탈

결제 완료 후 "매장으로 돌아가기" 같은 버튼이 있지만 사용자가 누르지 않고 창을 닫음. 이 경우 일부 주문만 누락이고 일부는 정상 복귀.

## 4. 검증 단계

### 4-1. 즉시 확인 가능

| 작업 | 방법 |
|---|---|
| 아임웹 NPay 설정 확인 | 쇼핑몰 관리자 → 결제 → 네이버페이 설정 → return URL / 완료 동작 |
| biocom NPay 결제 로그 복기 | backend `imweb_orders` 에서 `pay_type='npay'` 필터링, `complete_time` 대비 GA4 raw purchase 에서 transaction_id 일치 조회 |
| NPay 주문 전환 체크 | 아임웹 관리자 주문 상세 → NPay 주문의 "결제 완료 후 이동" 설정 있는지 |

### 4-2. BigQuery 감사 쿼리 (publish 무관, 지금 실행 가능)

```sql
-- NPay 관련 GA4 이벤트 비중과 purchase 매칭 여부
WITH npay_signals AS (
  SELECT 
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') AS tx_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method') AS pay_method,
    event_name,
    event_timestamp
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 30 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
    AND event_name IN ('add_payment_info', 'purchase')
)
SELECT 
  event_name,
  pay_method,
  COUNT(*) AS events,
  COUNT(DISTINCT tx_id) AS distinct_tx
FROM npay_signals
GROUP BY event_name, pay_method
ORDER BY event_name, events DESC;
```

**기대**: `add_payment_info` with pay_method=npay 이벤트가 많지만 purchase with pay_method=npay 가 0 에 가까우면 본 이슈 정량 확증.

### 4-3. 서버-사이드 NPay 매출 규모

```sql
-- 최근 30일 pay_type='npay' 매출 규모 (biocom 로컬 DB)
SELECT 
  DATE(o.complete_time) AS d,
  COUNT(*) AS npay_orders,
  SUM(o.section_amount) AS npay_gross,
  SUM(CASE WHEN o.business_confirmed = 1 THEN o.section_amount ELSE 0 END) AS npay_confirmed
FROM imweb_orders o
WHERE o.pay_type = 'npay' 
  AND o.complete_time >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY d ORDER BY d;
```

이 결과가 전체 매출의 몇 % 인지가 **NPay 제거 의사결정의 1차 데이터**.

## 5. NPay 버튼 제거 검토 — 전환율 비교 설계

TJ 검토 중: "네이버페이 버튼을 없애버리는 것도 검토한다."

### 5-1. 제거 시 득실

| 항목 | 기대 |
|---|---|
| Client-side 추적 완전성 | ✅ NPay 누락 사라짐, 모든 결제가 `shop_payment_complete` 도달 |
| GA4 revenue 정합성 | ✅ Server-side DB 와 일치 |
| Meta CAPI Purchase 정합성 | ✅ 개선 |
| Google Ads 자동입찰 품질 | ✅ 실제 purchase 만 집계 |
| **전체 매출** | ⚠️ 감소 가능 — NPay 를 쓰던 고객 중 카드로 전환하지 않고 이탈하는 비중 만큼 |
| 고객 결제 경험 | ⚠️ NPay 선호 고객에게는 마찰 증가 |

**핵심 질문**: "NPay 로 지금 결제하는 고객 중 몇 % 가 NPay 없어지면 카드로 재결제하고, 몇 % 가 이탈하나?"

### 5-2. 비교 방법론

**옵션 A — 시계열 Before/After**

구간: 제거 전 2주 vs 제거 후 2주 동일 요일/마케팅 캘린더 보정 후 비교.

지표:
1. **전체 주문 건수** (imweb_orders row count)
2. **전체 매출** (gross / business_confirmed)
3. **결제수단별 분포**: NPay 제거 전 npay 비중 → 제거 후 card/tosspayments/vbank 어디로 흡수됐는지
4. **상세페이지 → 주문서작성 → 결제완료 funnel 전환율**:
   - `view_item` event / `begin_checkout` event / `purchase` event (GA4 raw) + imweb `paid` order count
   - 전환율 변화 = 실제 NPay 편의성 loss 측정
5. **신규 고객 vs 재구매**: NPay 에 의존하던 특정 세그먼트가 있는지

**장점**: 구현 0. 설정 변경만.
**단점**: 외부 요인 (광고비, 계절성, 상품 프로모션) 혼란 → 주요 외부 변수 동결 기간에 실행 권장.

**옵션 B — 상품 카테고리별 부분 적용**

일부 상품 or 일부 세그먼트에만 NPay 버튼 숨김. 대조군 유지.

**장점**: 외부 요인 통제.
**단점**: 아임웹 테마 수정 필요. 공정 비교는 "비슷한 카테고리/가격대" 두 그룹 선정에 의존.

**옵션 C — 세션 기반 A/B 테스트**

사용자 세션의 `clientId` 끝자리 hash 로 50/50 분할. 한쪽은 NPay 숨김.

**장점**: 통계적으로 가장 깨끗.
**단점**: 아임웹에 A/B 엔진 없음. 직접 구현 필요 (footer 스크립트 + sessionStorage).

### 5-3. 권장 순서

1. **Step 1 (즉시)**: §4-3 로컬 DB 쿼리로 NPay 매출 비중 측정 → 이게 5% 미만이면 옵션 A 시계열로 제거 실행 후 비교 (최소 리스크)
2. **Step 1 결과 비중 > 15%**: 옵션 C 개발 검토 — 매출 영향 최소화 후 통계적 비교
3. **중간 5~15%**: 옵션 A 를 빠르게 실행하고 2주 관찰, rollback 기준 미리 정의 (예: 주간 매출 10% 이상 감소 시 복귀)

### 5-4. Hold-out Dashboard 필요 지표

`/ads` 또는 `/crm` 에 별도 카드로:
- 기간별 결제수단 분포 (stack chart)
- 결제완료 도달률 (`view_item / begin_checkout / purchase`)
- NPay 세그먼트 LTV vs 카드/vbank 세그먼트 LTV
- `pay_type == 'npay'` 주문의 이탈/완결 구분

## 6. 임시 조치 (즉시 가능)

### 6-1. 서버-사이드 GA4 Measurement Protocol 로 NPay purchase 전송

Backend 에서 `imweb_orders` 에 `pay_type=npay` 주문이 새로 생길 때 `refundDispatcher.ts` 와 유사하게 **`GA4 MP purchase` 이벤트를 서버에서 전송**.

장점:
- GTM/footer 수정 없이 GA4 에 purchase 기록 복구
- `client_id` 를 local ledger 에서 얻을 수 있음 (상세페이지 view_item 시점 cid 기록)
- 이미 GA4 MP API secret 보유 (`GA4_MP_API_SECRET_BIOCOM`)

단점:
- client-side fallback 아닌 server-side 단일 경로 → cid 매칭 실패 시 session 이 분리됨
- Meta CAPI / Google Ads 는 커버 안 됨

### 6-2. 아임웹 NPay return URL 강제 수정

관리자 설정에서 return URL 을 명시적으로 `https://biocom.kr/shop_payment_complete?...` 로 지정. 아임웹 지원 필요.

## 7. 우선순위와 책임

| 액션 | 담당 | 우선순위 |
|---|---|---|
| §4-2 BigQuery 감사 쿼리 실행 | TJ | 1순위 (이번 주) |
| §4-3 로컬 DB npay 매출 비중 | Claude | 1순위 (즉시) |
| §5-3 Step 1 또는 Step 3 실행안 결정 | TJ | 2순위 (비중 측정 후) |
| §6-1 GA4 MP server-side purchase | Claude | 3순위 (NPay 유지 결정 시) |
| 아임웹 NPay 설정 확인 | TJ | 2순위 |

## 8. 관련 링크

- [[gtm|GA4/gtm.md]] — biocom GTM 전체 상태
- [[gptfeedback_gtm_0421_2reply|GA4/gptfeedback_gtm_0421_2reply.md]] §11 — Preview Run 1 관측
- [[gtm_prep_tag_draft_20260421|GA4/gtm_prep_tag_draft_20260421.md]] — prep 태그 v2 설계
- [[../roadmap/confirmed_stopline|roadmap/confirmed_stopline.md]] — C-Sprint 5 identity coverage

---

## 11. 실측 — NPay 매출 비중 (2026-04-21 01:55 KST)

`backend/scripts/check-npay-revenue-share.ts` 실행 결과:

### 11-1. 기간별 NPay 점유

| 기간 | 총 주문 | NPay 주문 | NPay orders % | 총 gross | NPay gross | **NPay gross %** |
|---|---:|---:|---:|---:|---:|---:|
| 최근 30일 (03-21~04-15) | 2,257건 | 138건 | 6.11% | ₩1.375B | ₩22.2M | **1.62%** |
| 최근 60일 (02-19~04-15) | 4,755건 | 254건 | 5.34% | ₩2.034B | ₩48.8M | 2.40% |
| 최근 90일 (01-20~04-15) | 7,544건 | 389건 | 5.16% | ₩2.807B | ₩75.6M | 2.70% |
| 최근 365일 | 8,688건 | 452건 | 5.20% | ₩3.099B | ₩87.6M | 2.82% |

### 11-2. 월별 NPay 추이

| 월 | 총 주문 | NPay 주문 | NPay % (orders) | NPay gross | NPay % (gross) |
|---|---:|---:|---:|---:|---:|
| 2026-01 | 2,517 | 116 | 4.61% | ₩23.6M | 3.60% |
| 2026-02 | 2,319 | 117 | 5.05% | ₩23.8M | 3.64% |
| 2026-03 | 2,522 | 133 | 5.27% | ₩26.4M | 2.82% |
| 2026-04 (부분) | 1,330 | 86 | 6.47% | ₩13.7M | 1.61% |

**관찰**:
- NPay 주문 비중은 꾸준히 상승 중 (4.6% → 6.5%)
- 그러나 **gross 비중은 오히려 하락** (3.6% → 1.6%) — 4월에 virtual 대형 결제 비중 증가 때문일 수 있음
- NPay 평균 객단가 약 ₩161K (소액 결제 패턴) vs 전체 평균 ₩609K

### 11-3. TJ 의사결정 근거

| 시나리오 | gross 영향 | Claude 권장 |
|---|---|---|
| NPay 즉시 제거 | 최근 30일 gross -1.62% (₩22M/월) | **✅ 저위험** — 시계열 A/B 충분 |
| 유지 + server-side GA4 MP purchase 보정 | 매출 영향 없음, 개발 ~2일 | 옵션 |
| NPay 설정 수정 (아임웹 return URL) | 매출 영향 없음, 구현 외부 의존 | 병행 가능 |

**Claude 판단**: 매출 비중 1.6~2.8% 로 **제거 저위험 구간**. 단 NPay 주문 건수 비중 6% 는 고객 편의 측면에서 체감될 수 있음 — A/B 시계열 비교로 이탈률 관찰 필요.

### 11-4. 부가 발견

- `virtual` (가상계좌) gross 비중 30일 기준 **66.90%** — 바이오컴 매출의 상당 부분이 병원/약국 대량 구매로 추정
- `card` 30일 63% (orders) vs 29% (gross) — 일반 소비자 결제 패턴
- `etc` 13% 주문 / 2% gross — 주로 쿠폰/할인 소액 결제

## 12. Phase5-Sprint9 실행 단계 다음 액션

§7 우선순위 반영:

### 12-1. 즉시 (이번 주)

- [TJ] 아임웹 NPay 관리자 설정 확인 — return URL 누락 여부 (설정 수정만으로 해결될 수도 있음)
- [TJ] BigQuery 이전 선택지 A-0/A-1/A-2 결정 (§[[bigquery_migration_plan_20260421]] §11-4 참조)

### 12-2. BigQuery 이전 완료 후 (2026-05 중순)

- [Claude] GA4 raw `add_payment_info (npay) vs purchase (npay)` 일자별 추이 쿼리 → `/ads` 대시보드 NPay 카드 신설
- [Claude] TJ 의사결정 결정에 따라 (a) server-side MP purchase 구현 or (b) NPay 제거 시 2주 비교 대시보드

## 버전 기록

- **v2** (2026-04-21 02:00 KST): §11 실측 결과 추가. NPay 30일 gross 비중 1.62% = 저위험 제거 구간 확정. 월별 추이 (orders 상승 / gross 하락). §12 BQ 이전 후 후속 액션 연결. 자동화: `backend/scripts/check-npay-revenue-share.ts`.
- **v1** (2026-04-21 01:10 KST): 최초 작성. 2026-04-21 00:47 Preview 관측 기반. NPay 제거 전환율 비교 방법론 포함.
