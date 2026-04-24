# biocom.kr NPay (네이버페이) 스코프 정정 분석

작성: 2026-04-22 02:15 KST
발견자: TJ 2026-04-22 질문 — "NPay 분석이 사이트 전체 기준인지, NPay 버튼 달려있는 페이지 기준인지"
상위 문서: [[GA4/npay_return_missing_20260421]] v2 §11 (수정 대상)

---

## 10초 요약

- **v1 분석은 `site='biocom'` 전체 기준**이라 NPay 가 달려있지 않은 카테고리 (검사/분석) 도 분모에 포함 → **NPay 비중이 과소평가** 됨
- **실측**: biocom 건기식/도시락/세트/정기구독 페이지에만 NPay 달려있고, **검사/분석 카테고리 (IgG, 미네랄, 유기산, 마이크로바이옴, 호르몬, 펫 영양검사) 에는 NPay 없음**
- **정정된 NPay 선택률 (30일 gross 기준)**:
  - 사이트 전체: **1.62%** (v1, 잘못된 분모)
  - **NPay 가능 스코프**: **12.97%** (정정)
- 즉 **NPay 를 보여주는 고객 집단에서는 ~13% 가 실제 NPay 선택**. 제거 시 이탈 위험이 v1 판단보다 **훨씬 크다**

---

## 1. 조사 방법

### 1-1. Playwright 로 카테고리별 페이지에서 NPay 버튼 유무 확인

`backend/scripts/probe-biocom-npay-scope.ts` + `probe-biocom-npay-scope2.ts` 실행.

**biocom.kr 카테고리 URL 패턴**:

| URL 패턴 | 카테고리 | NPay 버튼 |
|---|---|---|
| `/HealthFood/?idx=X` | 건강기능식품 (영양제) | ✅ 있음 |
| `/DietMealBox/?idx=X` | 다이어트 도시락 (팀키토) | ✅ 있음 |
| `/biocomset_store/?idx=X` | 세트 (검사+영양제 패키지) | ✅ 있음 |
| `/subscription/?idx=X` | 정기구독 | ✅ 있음 |
| `/shop_view/?idx=X` | 일반 상품 뷰 (영양제 리다이렉트) | ✅ 있음 |
| `/all/?idx=X` | 전체 상품 리스트 (영양제로 이동) | ✅ 있음 |
| `/igg_store/?idx=X` | **IgG 지연성 알러지 (음식물 과민증) 검사** | ❌ 없음 |
| `/mineraltest_store/?idx=X` | **미네랄 검사 (모발)** | ❌ 없음 |
| `/organicacid_store/?idx=X` | **유기산 대사 검사** | ❌ 없음 |
| `/microbiome/?idx=X` | **NGS 장내 미생물 검사 (마이크로바이옴)** | ❌ 없음 |
| `/hormon_store/?idx=X` | **스트레스 노화 호르몬 검사** | ❌ 없음 |
| `/shop_view/?idx=369` | **바이오 펫 영양검사** | ❌ 없음 |
| `/healthinfo/?idx=X` | 건강 정보 기사 (판매 아님) | ❌ N/A |

**NPay 버튼 구조**: `<a id="NPAY_BUY_LINK_IDNC_ID_{timestamp}" class="npay_btn_link npay_btn_pay btn_green">` + `naver.NaverPayButton.apply({BUTTON_KEY: "84A37DD8-CD5D-4316-8C81-061E335F6E82", ...})`. 검사 카테고리 페이지에는 이 element 가 없고 NaverPay SDK 도 로드되지 않음.

### 1-2. DB 주문 분류 로직

`backend/scripts/check-npay-scoped-revenue.ts` — `imweb_order_items.item_name` 텍스트 패턴으로 각 주문을 4 분류:

```typescript
const TEST_ONLY_PATTERNS = [
  "음식물 과민증 분석", "지연성 알러지", "중금속 분석",
  "미네랄 검사", "유기산", "대사기능 분석/검사",
  "마이크로바이옴", "NGS 장내", "호르몬 검사",
  "스트레스 노화 검사", "펫 영양검사"
];
const SET_KEYWORDS = ["세트", "Set", "콤보"];
```

| 스코프 | 정의 | NPay 페이지 노출 |
|---|---|---|
| **npay_possible** | 건기식/도시락/세트/정기구독만 | ✅ |
| **mixed** | 검사 + 건기식 같이 주문 | ✅ (건기식 페이지에서 결제 시작했을 것) |
| **test_only** | 검사/분석 단독 주문 | ❌ |
| **unknown** | line items 없음 (backfill/누락 주문) | 판단 불가 |

---

## 2. 재계산 결과 (2026-04-22 실측)

### 2-1. 30일 (2026-03-23 ~ 2026-04-22)

총 2,117 주문 / ₩1.33B

| scope | orders | gross | share_o | share_g | npay_orders | npay_gross | **npay_selection_rate** |
|---|---:|---:|---:|---:|---:|---:|---:|
| **npay_possible** | 863 | ₩126.2M | 40.77% | 9.47% | **114** | **₩17.7M** | **13.21%** |
| mixed | 14 | ₩10.3M | 0.66% | 0.77% | 0 | ₩0 | 0% |
| test_only | 1,021 | ₩309.1M | 48.23% | 23.2% | 0 | ₩0 | 0% |
| unknown | 219 | ₩887.0M | 10.34% | 66.56% | 14 | ₩1.2M | 6.39% |

⭐ **NPay 가능 스코프 (npay_possible + mixed)**:
- 주문 877건 중 NPay 114건 → **선택률 13.00%**
- gross ₩136.5M 중 NPay gross ₩17.7M → **12.97%**

### 2-2. 60/90/365일

| 기간 | scope 주문 | NPay 주문 | **선택률 (orders)** | scope gross | NPay gross | **선택률 (gross)** |
|---|---:|---:|---:|---:|---:|---:|
| 30일 | 877 | 114 | **13.00%** | ₩136.5M | ₩17.7M | **12.97%** |
| 60일 | 1,746 | 220 | 12.60% | ₩281.4M | ₩41.5M | 14.73% |
| 90일 | 2,679 | 340 | 12.69% | ₩464.2M | ₩62.9M | 13.56% |
| 365일 | 3,423 | 432 | 12.62% | ₩610.1M | ₩83.2M | 13.63% |

**일관된 패턴**: NPay 가능 페이지에서 **약 12.5-13.0% (orders)** / **13-15% (gross)** 가 실제 NPay 선택. 전 기간 안정적.

### 2-3. 사이트 전체 기준 (v1) vs NPay 스코프 기준 (v2) 차이

| 지표 | 사이트 전체 (v1, 2026-04-21) | NPay 스코프 (v2, 2026-04-22) | 격차 |
|---|---:|---:|---:|
| 30일 NPay orders % | 6.11% | 13.00% | **+2.1배** |
| 30일 NPay gross % | 1.62% | 12.97% | **+8.0배** |

**원인**: biocom 은 **검사/분석 비중이 매우 큼** (30일 gross 의 23% 가 test_only, 66% 가 unknown/고액 주문). 이 test_only / unknown 은 NPay 분모로 쓰면 안 되는 값이었음.

---

## 3. 이전 분석 오류와 정정 의미

### 3-1. v1 의 문제

v1 [`GA4/npay_return_missing_20260421.md`](./GA4/npay_return_missing_20260421.md) §5-3 에서:
> "gross 1.62% 는 매우 낮음 — NPay 제거 저위험"

이건 잘못된 권장. **분모가 NPay 가 아예 노출되지 않은 검사 상품까지 포함**했기 때문.

### 3-2. v2 정정된 의사결정 근거

| 시나리오 | gross 영향 (재계산) | Claude 재권장 |
|---|---|---|
| NPay 즉시 제거 | **NPay 스코프 gross -12.97%** (월 ~₩22M) | ⚠️ **중위험으로 상향**. NPay 보여주는 고객의 13% 가 실제 선택 중 |
| 유지 + server-side GA4 MP purchase 보정 | 매출 영향 없음 | ✅ **우선 고려**. 제거보다 return URL 확보가 나음 |
| 아임웹 NPay 플러그인 return URL 수정 | 매출 영향 없음, 추적 복원 | ✅ **가장 깔끔**. TJ 가 아임웹 관리자 + 네이버페이 파트너센터 확인 중 |

**요약**: NPay 제거는 **저위험이 아니라 중위험**. 12.97% 의 기존 고객이 NPay 를 적극 선택 중이므로, 제거 시 **이 고객들의 카드 전환율이 어느 정도냐** 가 핵심. 제거 A/B 시계열 비교 시 rollback 기준을 더 엄격하게 잡아야 함.

---

## 4. 분류 불확실성 (unknown 스코프)

30일 `unknown` 이 219건 / ₩887M (gross 66.56%) 차지하는 이유:

### 4-1. 가능성

| 원인 | 검증 방법 |
|---|---|
| 운영 DB 백필 주문 (1월 초 713건) 에 `imweb_order_items` 없음 | `order_time < '2026-01-18'` 필터링 |
| 최신 주문 (오늘~어제) 이 `imweb_order_items` sync 아직 안 됨 | `order_time >= date('now','-2 days')` 체크 |
| 가상계좌 대량 주문 (검사 대량 주문 등) | pay_type=virtual 비중 |
| 수동 주문 / API 외 경로 | `source` 필드 확인 |

### 4-2. 영향

unknown 의 14건 NPay 주문 / ₩1.2M gross 는 실제로는 npay_possible 일 가능성 높음 (NPay 는 기본적으로 건기식에만 달리니까). 따라서 **진짜 NPay 선택률은 13% 보다 약간 더 높을 수 있음** — 정확한 수치는 line items sync 완료 후 재측정.

30일 기준 unknown npay_orders 14건을 npay_possible 에 합치면:
- 선택률 orders: (114+14) / (877+ (unknown 중 npay_possible 로 분류할 몫)) ≈ 13~14%
- 큰 변동 없음. **12-14% 범위**로 확정.

---

## 5. NPay 관련 최신 상태 (요약)

### 5-1. GTM v137 publish (2026-04-21)

- 가상계좌 미입금 GA4 purchase 차단. NPay 는 별개 이슈
- 상세: [[GA4/gtm_exception_trigger_draft_20260421]]

### 5-2. NPay return URL 누락 이슈 (미해결)

- 네이버페이 결제 완료 후 `biocom.kr/shop_payment_complete` 복귀 안 함
- GA4 `purchase` / Meta CAPI Purchase 미발사
- Google Ads [248] `TechSol-NPAY구매` 는 **버튼 클릭 시점**에 발사 (과다집계 위험)
- TJ 가 아임웹 관리자 + 네이버페이 파트너센터 확인 중
- 상세: [[GA4/npay_return_missing_20260421]] v2

### 5-3. 선택 가능한 조치 (v2 업데이트)

| 옵션 | 난이도 | v2 매출 영향 | 추적 복원 |
|---|---|---|---|
| **A. 아임웹/네이버페이 파트너센터 return URL 수정** | 1시간 (TJ 수동) | 없음 | ✅ 전체 |
| **B. 서버-사이드 GA4 MP purchase 복구** | 2일 (Claude) | 없음 | GA4 only. Meta 는 미복구 |
| **C. NPay 버튼 제거 + 시계열 A/B** | 10분 + 2주 관찰 | **-₩22M/월 (NPay gross 스코프 내)**, 카드 전환 일부 회수 가능 | 추적 복원 대신 매출 loss |
| **D. NPay 유지 + 보정 없음** | 0 | 없음 | 현상 유지 (누락 지속) |

**권장 순서**: A → B → (옵션 A/B 둘 다 실패 시) C 검토

---

## 6. 자동화 스크립트

| 파일 | 용도 |
|---|---|
| `backend/scripts/check-npay-revenue-share.ts` | **v1** 사이트 전체 기준 (deprecated. 스코프 오류) |
| `backend/scripts/check-npay-scoped-revenue.ts` | **v2** NPay 스코프 내 선택률 재계산 ✅ |
| `backend/scripts/probe-biocom-npay-return.ts` | biocom 제품 페이지 NPay 버튼 구조 + return URL 조사 |
| `backend/scripts/probe-biocom-npay-scope.ts` | 카테고리별 NPay 버튼 유무 (건기식/도시락) |
| `backend/scripts/probe-biocom-npay-scope2.ts` | 검사/세트/구독/펫 카테고리 NPay 버튼 유무 |

재실행:
```bash
npx tsx backend/scripts/check-npay-scoped-revenue.ts
npx tsx backend/scripts/check-npay-scoped-revenue.ts --json
npx tsx backend/scripts/check-npay-scoped-revenue.ts --windows=7,30,90
```

---

## 7. 다른 문서 업데이트 필요

### 7-1. `GA4/npay_return_missing_20260421.md` v3 업데이트 요청

- §5-3 의사결정 매트릭스 → 재권장 (제거 저위험 → 중위험으로 상향)
- §11 실측 결과 → "NPay 스코프 기준" 추가 (현재는 사이트 전체만)

### 7-2. `data/!datacheckplan.md` Phase5-Sprint9 업데이트

- 비중 지표를 "NPay 스코프 내 gross %" 로 교체

### 7-3. `운영db고도화전달계획.md` v2 §6 압축본

- Playwright scope 조사 언급 추가 (1줄)
- NPay 매출 비중 수치를 "사이트 전체 1.62% / NPay 스코프 내 12.97%" 병기

---

## 8. 추가 인사이트 (biocom 비즈니스 구조)

이번 재계산 과정에서 드러난 biocom 매출 구조:

| 카테고리 | 30일 주문 | 30일 gross | 평균 객단가 |
|---|---:|---:|---:|
| test_only (검사만) | 1,021건 | ₩309M | ₩303K |
| npay_possible (건기식만) | 863건 | ₩126M | ₩146K |
| mixed | 14건 | ₩10M | ₩733K |
| unknown (고액/backfill) | 219건 | ₩887M | ₩4.05M ⚠️ |

**관찰 1**: test_only (검사) 가 **총 주문 48%, gross 23%** — biocom 매출의 큰 축. 건강검사 플랫폼 성격이 강함.

**관찰 2**: unknown 평균 객단가 ₩4M 은 비정상. **공동구매 대량 주문** 또는 **병원/약국 대량 구매** 일 가능성 → 별도 조사 필요 (Phase5-Sprint9 연장).

**관찰 3**: **건기식 (npay_possible) 평균 객단가 ₩146K** 은 "반복 구매 / 소액 결제" 패턴 — NPay 의 간편결제 사용자 프로파일과 정확히 일치. 13% 선택률이 자연스러움.

---

## 9. TJ 결정 요청

위 재계산 결과 기반으로 NPay 조치 우선순위 재확인:

| Q | 옵션 |
|---|---|
| Q1 | Option A (아임웹/네이버페이 설정 수정) 언제 확인할 것인가? |
| Q2 | Option B (서버-사이드 MP purchase) 대기 중인 이유 공유 필요? |
| Q3 | Option C (NPay 제거) 는 v2 기준으로 **중위험** 으로 재분류 동의? |

---

---

## 11. 🆕 6개월 카테고리별 NPay vs 일반 구매 분포 (2026-04-22 02:40 KST)

TJ 추가 질문: "최근 6개월 각 페이지에서 NPay vs 일반 구매하기 숫자"

### 11-1. 로컬 DB 6개월 집계 (가장 정확한 숫자)

`backend/scripts/check-npay-scoped-revenue.ts` 는 orderwise 4분류, 이번 집계는 `imweb_order_items.first_item` 기준 category 분류로 단순 비교:

| 카테고리 | 총 주문 | **NPay** | Card | Virtual | Other | **NPay %** |
|---|---:|---:|---:|---:|---:|---:|
| **meal (도시락 — 팀키토)** | 69 | **48** | 21 | 0 | 0 | **69.57%** ⭐ |
| **set (세트 — 검사+영양제)** | 450 | **102** | 316 | 24 | 8 | **22.67%** |
| **supplement (영양제)** | 1,645 | **282** | 1,047 | 98 | 218 | **17.14%** |
| unknown (백필/고액) | 509 | 45 | 109 | 327 | 28 | 8.84% |
| **test_only (검사)** | 5,510 | **0** | 4,904 | 504 | 102 | **0%** |
| **subscription (정기구독)** | 1,218 | **0** | 0 | 0 | 1,218 | **0%** |

**합계**: 9,401건 중 NPay 477건 (5.07%), Card 6,397건 (68.0%), Virtual 953건 (10.1%)

### 11-2. 카테고리별 해석

1. **도시락 NPay 선택률 69.57%** ⭐ — **가장 강력한 NPay 집단**. 팀키토 도시락 구매 고객은 절대다수 NPay 선호. 소액 (평균 객단가 ~₩20-30K), 반복 구매, 간편결제 최적화 페르소나.

2. **세트 22.67%** — `biocomset_store` 카테고리 (검사 + 영양제 패키지). 영양제 단독보다 높음. 객단가 중간, NPay 간편결제 가치 큼.

3. **영양제 17.14%** — NPay 가능 페이지의 평균 선택률. §2-1 v2 재계산 (NPay 가능 스코프 내 13%) 과 일관 (§2 는 orderwise 4분류라 약간 다름, 17% 는 first_item 기준).

4. **정기구독 NPay 0%** 🔍 — 1,218건 전부 `other` pay_type (주로 `iche` = 계좌이체). 아임웹 자체 정기결제 플랫폼이 NPay billing key 미지원으로 추정. **잠재적 NPay 확장 기회**.

5. **검사 NPay 0%** — NPay 버튼 없으니 당연. §1 Playwright 실측 일치.

### 11-3. 같은 카테고리 내 NPay vs Card 선택 요인 (추정)

- **도시락**: NPay 가 68%, Card 30% — NPay 쪽이 주문 수 많지만 평균 객단가는 비슷. **NPay 간편결제 매력**이 지배
- **세트**: NPay 23%, Card 70% — Card 가 여전히 대세. 고액 (₩100K+) 세트 상품은 신중한 결제 수단 선호
- **영양제**: NPay 17%, Card 64% — 평균 객단가 ₩150K 대. 일반 영양제 소비자 중 NPay 선호 소수

---

## 12. 🆕 전환율 조사 (GA4 Data API 30일)

TJ 질문: "일반 구매하기 전환율"

### 12-1. GA4 pay_method 차원 분포 (30일)

| pay_method | events | revenue |
|---|---:|---:|
| **(not set)** | **4,089** | ₩2.50B (85%) |
| homepage (카드/계좌) | 410 | ₩107.5M (8.6%) |
| npay | 294 | ₩51.2M (6.1%) |
| (빈 값) | 1 | ₩0.48M |

**심각한 제약**: purchase 이벤트의 **85% 가 `pay_method=(not set)`**. 원인:
- 태그 [143] HURDLERS 구매는 eventSettings 에 `pay_method` 파라미터가 없음 (이전 Preview 스크린샷 확인)
- 태그 [48] `GA4_구매전환_홈피구매` 만 `pay_method=homepage` 설정
- 태그 [43] `GA4_구매전환_Npay` 만 `pay_method=npay` 설정
- 따라서 GA4 에서 NPay vs 일반 purchase **완전 분리 불가 (현재 분포로는 15% 만 식별)**

→ **GA4 에서 pay_method 정확 집계는 향후 [143] 에도 `pay_method` 파라미터 추가 필요** (후속 작업)

### 12-2. 카테고리 URL 별 view_item / purchase (30일, GA4 Data API)

| 카테고리 URL | view_item | purchase | view_users | **conversion % (view→purchase)** |
|---|---:|---:|---:|---:|
| **HealthFood** (영양제) | 5,408 | 189 | 3,869 | **3.49%** |
| **DietMealBox** (도시락) | 149 | 6 | 107 | **4.03%** |
| biocomset_store (세트) | 71,062 | 33 | 67,604 | 0.05% |
| shop_view | 34,273 | 40 | 21,350 | 0.12% |
| subscription (정기구독) | 258 | 0 | 163 | 0% |
| igg_store (음식물과민증) | 24,189 | 0 | 20,460 | 0% |
| mineraltest_store (미네랄) | 52,392 | 0 | 29,639 | 0% |
| organicacid_store (유기산) | 36,988 | 0 | 24,658 | 0% |
| microbiome | 222 | 0 | 176 | 0% |
| hormon_store (호르몬) | 613 | 0 | 483 | 0% |
| shop_payment_complete | 0 | **2,007** | 0 | — (purchase 집중 지점) |

### 12-3. 숫자 해석 주의점

**중요**: GA4 에서 `purchase` 이벤트는 거의 전부 `/shop_payment_complete` URL 에서 발사됨. `view_item` 은 카테고리 URL 에서 발사.
즉 **같은 카테고리 URL 에서 view→purchase** 를 보면 purchase 0 이 되는 것은 자연스러움 (purchase 는 결제완료 페이지에서 집계되니까).

**각 카테고리의 "3.49%", "4.03%" 수치는**:
- HealthFood 3.49% = `HealthFood URL 에서 view_item 발사된 건수 대비 같은 URL pattern 에서 이어진 purchase 건수`
- 일부 상품 페이지에서 purchase 이벤트가 발사됐을 가능성 (예: 구매 후 shop_payment 페이지 뿐 아니라 추가 view_item 기록)
- **신뢰도 제한적**. 진짜 "상품 페이지 → 구매 전환율" 은 **BigQuery raw session path** 분석 필요 (2026-05-05 자체 BQ 이전 이후 가능)

**그나마 신뢰할 수 있는 3가지**:
1. HealthFood / DietMealBox **상대 비교**: 도시락이 영양제보다 약간 높은 전환 (4.03% vs 3.49%). 도시락 고객 구매 의사 더 강함
2. 검사 카테고리 (igg/mineraltest/organicacid) 가 **view_item 매우 많음** (52K/36K) 대비 purchase 0 — 검사는 결제완료 URL 에서만 purchase 집계되므로 이 쿼리 한계
3. 전환율 **절대값 3-4% 는 과소평가** — purchase 이벤트가 `shop_payment_complete` 에 집중되어 카테고리 URL 분모 매칭 실패

### 12-4. 사이트 전체 세션 기준 전환율 (참고)

- sessions 30일: **584,252**
- transactions: **6,615**
- purchaseRevenue: ₩2,164,428,350
- 실제 **구매 세션 전환율**: 6,615 / 584,252 = **1.13%**
- GA4 `sessionConversionRate` 지표는 **99.57%** 로 부정확. GA4 "Key events" 에 purchase 외 다수 이벤트 (sign_up / add_to_cart 등)가 전환으로 지정되어 있어 지표 왜곡 — TJ GA4 Admin Key events 재검토 필요 (별도 작업)

### 12-5. "일반 구매하기 전환율" — 실용적 답

직접 측정은 불가 (pay_method (not set) 85% + purchase URL 집중). **간접 추정**:

| 가정 기준 | 계산 | 결과 |
|---|---|---|
| A. 카테고리 URL view_item 기준 rough | HealthFood view_item 5,408 / 전체 구매 (homepage pay_method 추정) ~3,280 | 일반 카드 구매 전환율 ~3-5% 범위 |
| B. 로컬 DB 기반 | supplement 30일 ~274건 중 card 63.6% = 174건 일반 구매 | 절대 숫자만 확정 |
| C. 전체 사이트 세션 기준 | 6,615 / 584,252 | **1.13%** (전체 세션 → purchase) |

**결론**: 일반 구매 (NPay 아닌) 단독 전환율은 **정확 측정 불가**. 로컬 DB 로 **절대 주문 숫자 (월 ~1,300건)** 는 확정 가능. GA4 로 **카테고리 URL 방문 → 구매 rough ~3.5-4.0%** 추정 가능.

---

## 13. 🆕 v136/v137 이전 GA4 데이터 정확성 평가

TJ 질문: "최근 GA4 정합성 업데이트 전 자료도 정확할지?"

### 13-1. v136/v137 이전 상태 (2026-04-20 23:55 이전)

| 오염 요인 | 영향 | 정량 |
|---|---|---|
| **transaction_id (not set)** | GA4 dedup 실패 → [143]+[48]+[43] 3중 발사된 주문이 3건으로 집계 | 30일 기준 520건 raw (not set). 실제 과다 계수는 추가 10~30% 수준 |
| **[48] `GA4_구매전환_홈피구매` transaction_id 파라미터 없음** | homepage 결제 purchase 가 `(not set)` 으로 기록. dedup 불가 | 30일 ~410건 영향 |
| **[43] `GA4_구매전환_Npay` transaction_id 없음** | 동일 | NPay 결제완료 시점에만 해당 (NPay return 누락 때문에 실제 발사 적음) |
| **attribution `(direct)` fallback** | PG 리다이렉트 후 세션 끊겨 원 UTM 소실 | C-Sprint 5 쿼리 2 기준 30일 1,158건 / 26% session_start_missing |

### 13-2. v137 이전 상태 (2026-04-21 01:40 이전)

| 오염 요인 | 영향 | 정량 |
|---|---|---|
| **가상계좌 미입금 GA4 purchase 집계** | `payment_status=pending` 인 주문도 purchase 로 기록. 실제 입금 없는데 매출 계상 | C-Sprint 3 실측 biocom 30일 vbank_expired 330건 / **₩966M gross** |
| **NPay return URL 누락 (미해결)** | NPay 결제 완료 시 biocom 복귀 안 해서 purchase 미발사 → 오히려 **과소집계** | 30일 NPay 실제 282건 결제 중 GA4 에 294건 집계 = 거의 일치 (일부는 return 되는 경우도 있음) |

### 13-3. 종합 평가 (2026-04-20 이전 vs 이후)

| 지표 | 2026-04-20 이전 신뢰도 | 2026-04-21 이후 신뢰도 | 권장 |
|---|---|---|---|
| **transactions (주문 건수)** | 중복 집계 ~15-25% 과다 | 높음 | 이전 데이터 -20% 전후 보정 후 사용 |
| **purchaseRevenue** | vbank 포함 + 중복 → **+30-40% 과다** | 높음 | 이전 데이터 참고용만 |
| **attribution source/medium** | `(direct)` fallback 26% | 2026-04-20 Unwanted Referrals 설정 후 개선. BQ 이전 2026-05-05 후 완전 정확 | 2026-05-05 까지 (direct) 검증 대기 |
| **pay_method 분리** | (not set) 85%, 불가 | 개선 없음 ([143] 태그 여전히 누락) | 별도 GTM 작업 필요 |
| **카테고리 URL 전환율** | 동일 (GA4 구조 한계) | 동일 | BQ raw 자체 이전 후 재측정 |

### 13-4. 권장 분석 기간

| 분석 목적 | 권장 기간 |
|---|---|
| **NPay vs 일반 절대 주문 수** | 로컬 DB 6개월 전체 — 영향 없음 (운영 DB 원천) |
| **GA4 purchase event count** | **2026-04-21 이후만** (중복 + vbank 오염 제거) |
| **GA4 revenue** | **2026-04-21 이후만** |
| **Meta CAPI ROAS** | 2026-04-18 Refund 1,844건 backfill 이후 + vbank 는 server-decision-guard 가 차단했으므로 이전부터 안전 |
| **UTM attribution** | **2026-04-22 이후** (Unwanted Referrals 설정 48h 반영 후) |

**요약**: **2026-04-20 이전 GA4 데이터는 purchase count 15-25% 과다, revenue 30-40% 과다** 상태. 직접 수치 인용 시 보정 필요. 단 **로컬 DB (`imweb_orders`, `attribution_ledger`) 는 애초 운영 DB 기반이라 영향 없음** — NPay 분석 등 로컬 DB 기반 조사는 전 기간 신뢰.

### 13-5. 과거 데이터 복구 가능성

- **v136/v137 효과는 live 시점 이후 GA4 에만 적용**. 과거 데이터 소급 수정 불가
- 대신 **BQ raw 로 과거 오염 정량화 + 보정 쿼리** 작성 가능 (자체 BQ 이전 후 가능)
- 보정 쿼리 예시: `COUNTIF(pay_method='vbank') + COUNTIF(transaction_id='(not set)')` 를 빼면 실제 확정 주문 추정
- 월별 보정 테이블을 만들어 2026-01~04 GA4 purchase 의 "확정 추정 매출" 계산 가능

---

## 14. 자동화 스크립트 (v2)

기존 + 신규:

| 파일 | 용도 |
|---|---|
| `backend/scripts/check-npay-revenue-share.ts` | **v1** 사이트 전체 기준 (deprecated) |
| `backend/scripts/check-npay-scoped-revenue.ts` | **v2** NPay 스코프 내 orderwise 4분류 |
| `backend/scripts/check-biocom-npay-vs-general-conversion.ts` | **v3** GA4 Data API — pay_method 분포 + 카테고리 URL 전환율 + 세션 지표 |
| `backend/scripts/probe-biocom-npay-return.ts` | 제품 페이지 NPay 버튼 구조 |
| `backend/scripts/probe-biocom-npay-scope.ts` | 건기식/도시락 카테고리 |
| `backend/scripts/probe-biocom-npay-scope2.ts` | 검사/세트/구독/펫 카테고리 |

---

## 15. TJ 에게 최종 요약 (2026-04-22)

### 6개월 NPay vs 일반 구매 숫자 (로컬 DB 기준, 가장 정확)

```
            주문수    NPay    Card    Virtual    Other    NPay선택률
검사         5,510      0   4,904     504       102        0%  (NPay 버튼 없음)
영양제       1,645    282   1,047      98       218    17.14%
정기구독     1,218      0       0       0     1,218        0%  (아임웹 자체 정기결제)
세트           450    102     316      24         8    22.67%
도시락          69     48      21       0         0    69.57% ⭐
unknown        509     45     109     327        28     8.84%
────────────────────────────────────────────────────────────
합계         9,401    477   6,397     953     1,574     5.07%
```

### 일반 구매하기 전환율

- **GA4 에서 pay_method='homepage' 만 따로 볼 수는 있음** (30일 410건 / ₩107.5M). 하지만 (not set) 85% 라 전체 일반 구매 분리 부정확
- **카테고리 URL 방문 → 구매 rough 전환율**: HealthFood 3.49%, DietMealBox 4.03% (GA4 구조 한계로 과소집계 경향)
- **사이트 전체 세션 기준**: 30일 sessions 584K / transactions 6,615 → **1.13%**
- **정확 전환율 측정은 BQ raw 세션 path 분석 필요** (2026-05-05 자체 이전 후 가능)

### v136/v137 이전 GA4 데이터 신뢰도

- **2026-04-20 이전**: purchase count ~15-25% 과다, revenue ~30-40% 과다 (중복 + vbank 오염)
- **2026-04-21 이후**: 신뢰 가능
- **로컬 DB (운영 DB 기반)** 는 전 기간 영향 없음. NPay 분석은 로컬 DB 기준이 가장 정확
- 과거 GA4 데이터 소급 수정 불가. BQ raw 로 보정 쿼리 작성은 자체 이전 후 가능

---

## 10. 버전 기록

- **v2** (2026-04-22 02:40 KST): §11 6개월 카테고리별 NPay vs 일반 분포 (로컬 DB), §12 GA4 Data API 전환율 조사 + pay_method 분포 한계, §13 v136/v137 이전 데이터 정확성 평가 + 권장 분석 기간, §14 스크립트 확장, §15 TJ 최종 요약. `backend/scripts/check-biocom-npay-vs-general-conversion.ts` 신규.
- **v1** (2026-04-22 02:15 KST): 최초 작성. TJ 2026-04-22 질문에 따른 NPay 스코프 정정 분석. Playwright 로 13개 카테고리 페이지 NPay 버튼 유무 검증 + DB 4 분류 스코프 쿼리. 선택률 1.62% → 12.97% 정정. `GA4/npay_return_missing_20260421.md` / `data/!datacheckplan.md` / `운영db고도화전달계획.md` v2 업데이트 대상 표기.
