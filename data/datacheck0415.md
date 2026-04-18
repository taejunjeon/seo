# Data Check 0415

기준일: 2026-04-15 KST
작성 목적: 2026-04-06 이후 데이터 정합성 점검을 다음 단계로 이어가기 위한 최신화 문서. 이전 문서 `datacheck0406.md`의 구조를 따르되, 그 사이에 확정된 사실과 **새로 발견한 심각한 이슈**를 반영한다.
관련 문서: `datacheck0406.md`, `운영db.md`, `capivm/vm최신화.md`, `imwebapi.md`, `tossapi.md`

---

## 0. 이 문서가 다루는 새 사실 (0406 이후 변경점)

아래 항목은 `datacheck0406.md` 시점 이후에 확정되거나 새로 드러난 것이다. 자세한 내용은 각 섹션에서 다룬다.

1. **운영 DB `tb_playauto_orders`가 2026-03-13 이후 1개월째 sync 중단**. `playauto_sync` cron이 기록상 정지. 매출 집계·코호트·ROAS 간접 지표에 영향. 상세는 `운영db.md` §1.5.
2. **`tb_teamketo_cafe24` / `tb_teamketo_smartstore`는 2025-07-25 이후 9개월째 멈춤**. 운영 DB의 staleness가 playauto에만 있는 것이 아니다.
3. **Imweb 독립 "구매 확정" 검증 경로 구축 완료**. v2 API `/v2/shop/orders?status=PURCHASE_CONFIRMATION`을 list 페이지네이션으로 돌려 biocom 주문 8,225건에 `imweb_status`를 라벨링. 플레이오토와 독립된 cross-check 소스 확보. 상세는 §3-X.
4. **Imweb `CANCEL` 집계가 실제 취소율보다 극단적으로 과장되는 현상 발견**. 원인: 가상계좌 미입금(`WAITING_FOR_DEPOSIT`) 만료가 Imweb에서 `CANCEL`로 분류되는데 `payment_amount` 필드에 "발급 예정 금액"이 그대로 남아 있음. 상세는 §6.
5. **GA4에 `refund` 이벤트가 여전히 구현 안 됨**. `ga4RevenueOpsPlan.ts`는 설계 문서일 뿐이고, 실제 footer snippet(`imwebAttributionSnippet.ts`)은 `purchase` 이벤트만 발화. 취소/환불은 GA4에 **아예 들어가지 않음**.
6. **Meta CAPI 작업이 2026-04-12에 1차 스냅샷 완료** (`capivm/capi.md`). 현재 `/ads` 페이지에는 "CAPI 최신화 이후 Attribution ROAS vs Meta ROAS 차이" 카드가 추가됨. VM 전환 논의는 `capivm/vm최신화.md`로 분리.

---

## 1. 요약 한 줄

Toss 원장과 Imweb 주문 캐시는 0406 때보다 더 넓어졌고, **Imweb의 구매확정 상태를 직접 읽는 독립 검증 경로**도 오늘(0415) 만들어졌다. 반면 운영 DB의 `tb_playauto_orders`가 1개월째 멈췄고, 이 정지는 **ROAS·코호트 수치를 조용히 왜곡하는 상태**로 남아 있다. **우리 쪽 광고 의사결정 관점의 최우선 이슈는 "Imweb CANCEL 금액 과장"과 "GA4 refund 미구현" 두 가지**다. 전자는 오늘 Toss 교차로 원인 해석 완료, 후자는 계획 문서만 있고 구현 미착수.

---

## 2. 스냅샷 숫자 (2026-04-15 KST)

### 2-1. 로컬 SQLite (`backend/data/crm.sqlite3`)

| 항목 | 값 (0415) | 0406 대비 |
| ---- | --------- | --------- |
| `crm_experiments` | 8 | = |
| `crm_assignments` | 4,635 | ↑ |
| `crm_conversions` | 264 | ↑ |
| `crm_messages` | 9 | ↑ |
| `imweb_members` (3사이트) | 83,277 | +약 50건 |
| `imweb_orders` (3사이트) | 10,299 | 0406: 약 7,700 → **+2,599** |
| `imweb_coupon_masters` | 888 | = |
| `imweb_issue_coupons` | 2,654 | = |
| `toss_transactions` | 38,384 | 0406: 37,959 → **+425** |
| `toss_settlements` | 32,022 | 0406: 20,388 → **+11,634 (settlement backfill 완료)** |

### 2-2. 운영 Postgres

| 테이블                      | 행수          | 상태                              | 0406 대비        |
| ------------------------ | ----------- | ------------------------------- | -------------- |
| `tb_iamweb_users`        | 96,581      | ✅ 정상 sync (최신 2026-04-14 16:55) | 증가             |
| `tb_naver_orders`        | 3,907       | ✅ 정상 sync (최신 2026-04-14)       | 증가             |
| `tb_coupang_orders`      | 1,196       | ✅ 정상 sync (최신 2026-04-14)       | 증가             |
| `tb_sales_toss`          | 7,766       | ✅ 정상 sync                       | =              |
| **`tb_playauto_orders`** | **115,316** | **🔴 2026-03-13 이후 정지**         | **0406 이후 정체** |
| `tb_teamketo_cafe24`     | 834         | 🔴 2025-07-25 이후 정지             | 정체             |
| `tb_teamketo_smartstore` | 11,031      | 🔴 2025-07-25 이후 정지             | 정체             |
| `tb_imweb_member`        | 0           | 🔴 빈 테이블                        | =              |

### 2-3. Imweb 독립 구매확정 검증 (오늘 새로 추가)

`/api/crm-local/imweb/purchase-confirm-stats?site=biocom` 기준 (2026-04-15 11:41 sync):

| `imweb_status` | count | amount |
| -------------- | -----:| -----:|
| **PURCHASE_CONFIRMATION** | **6,682** | **₩1,553,289,070** |
| CANCEL | 706 | ₩1,063,678,461 ⚠️ (§6 참고) |
| COMPLETE (배송완료·아직 미확정) | 405 | ₩88,118,723 |
| RETURN | 76 | ₩20,759,819 |
| STANDBY (배송준비) | 10 | ₩220,700 |
| DELIVERING | 14 | ₩784,479 |
| _null_ (라벨 미매칭, v1 legacy 추정) | 469 | ₩109,975,123 |
| **합계 (biocom)** | **8,362** | — |

**라벨링 커버리지**: 8,362 중 7,893건 라벨링 = **94.4%**. 469건은 Imweb v2 status 필터에 매칭되지 않은 legacy 주문으로 추정.

---

## 3. 소스별 현재 상태

### 3-1. GA4

0406 이후 달라진 것은 제한적이다.

- `biocom`, `thecleancoffee`, `aibio` 3 property direct Data API access는 계속 `OK`.
- `thecleancoffee` / `aibio` BigQuery raw export는 2026-04-07 연결 후 유지. `biocom`은 legacy `hurdlers-naver-pay` 링크 확인 **여전히 대기**.
- **refund 이벤트: 미구현 (이 문서의 새 이슈).** `backend/src/imwebAttributionSnippet.ts`를 grep한 결과 refund/cancel 이벤트를 발화하는 로직 없음. `ga4RevenueOpsPlan.ts`는 "어떻게 설계할 것인가"의 명세 문서일 뿐이고 footer snippet에 실장되지 않음. 따라서 GA4 purchase는 들어오지만 취소/환불은 **GA4 레벨에서 아예 잡히지 않는다**. 이는 GA4 기반 ROAS/매출을 `gross_revenue`로만 읽는 구조에 해당하며, 취소 보정은 GA4 외부(Imweb/Toss)에서 해야 함을 의미한다.
- recent biocom/coffee payment_success live row에 `ga_session_id`/`client_id`/`user_pseudo_id` 3종 유입은 0408 이후에도 유지.

### 3-2. Toss

0406 이후 크게 강화됐다.

- 로컬 `toss_transactions=38,384건`, `toss_settlements=32,022건`. settlement backfill 장거리 실행이 마무리되면서 0406 대비 약 11,600건 추가됨.
- **상태 분포 (2026-01 ~ 2026-04)**:

| 월 | DONE 건수 | DONE 금액 | CANCELED 건수 | CANCELED 금액 | PARTIAL_CANCELED | WAITING_FOR_DEPOSIT |
| -- | --------:| --------:| ------------:| ------------:| ---------------:| ------------------:|
| 2026-01 | 3,305 | ₩749,868,302 | 167 | ₩45,328,203 | 37건/₩9.5M | 226건/₩0 |
| 2026-02 | 2,314 | ₩511,854,070 | 127 | ₩32,470,750 | 14건/₩5.2M | 258건/₩0 |
| 2026-03 | 1,819 | ₩500,250,177 | 102 | ₩30,303,657 | 20건/₩4.6M | 250건/₩0 |
| 2026-04 | 308 (부분) | ₩71,652,670 | 16 | ₩4,714,025 | 5건/₩1.0M | 96건/₩0 |
| **합계** | **7,746** | **₩1,833,625,219** | **412** | **₩112,816,635** | **76건/₩20.3M** | **830건/₩0** |

- 실제 Toss 기준 취소 금액(2026-01~04): `CANCELED ₩112.8M + PARTIAL_CANCELED ₩20.3M = 약 ₩133M (₩1.33억)`
- **가상계좌 미입금 건수는 830건/₩0**. 즉 "결제 요청했으나 돈 안 들어온" 주문이 한 해 내내 약 200건/월 수준으로 일정하게 발생.

### 3-3. Imweb

0406 이후 크게 달라진 점 2가지:

1. **biocom 주문 캐시가 2026-01-27 이전까지 확장**됨. 현재 `imweb_orders (biocom)=8,362건`. 이전 5,750 → **+2,612건**. 다만 시작점은 여전히 2026-01-27이고 그 이전은 미수집.
2. **Imweb v2 status 라벨링** 처음으로 완료. `PURCHASE_CONFIRMATION=6,682건` 확인. 이는 플레이오토 `ord_status='구매결정'`과 **독립된 소스로 구매 확정을 검증할 수 있음**을 의미한다. 상세는 §3-6.

한계: Imweb legacy API 페이지네이션 불안정은 여전. coffee `data_count` 대비 실회수 낮은 문제도 해결되지 않음.

### 3-4. PlayAuto (운영 DB)

🔴 **0406 이후 상황이 악화됐다.**

- `tb_playauto_orders`: 총 115,316건. 하지만 `synced_at`과 `ord_time` 모두 **2026-03-13에 멈춤**. 1개월째 cron 실행 기록 없음.
- `revenue/backend/app/tasks/scheduler.py`에 `playauto_sync` cron은 매일 05:00으로 **등록되어 있으나 실제로 돌지 않는 상태**. 예외 로거만 찍혀 조용히 실패 중.
- 영향:
  - `tb_playauto_orders` 기반 리포트(`vw_multichannel_orders`, `vw_repurchase_*`)가 1개월 밀려 있음
  - 매일 03:00에 도는 `cohort_cache` cron은 playauto 데이터를 input으로 쓰므로 **코호트 수치가 1개월째 정체**일 가능성 높음
  - 상세는 `운영db.md` §1.5

### 3-5. Attribution Ledger

0406 이후 엔트리는 계속 쌓이는 중. 구체 수치는 `/api/attribution/ledger`로 조회. 주요 운영 원칙은 변화 없음:

- `pending`은 raw ledger에 유지하되 `confirmed_revenue`만 메인 ROAS/CAPI 기준값
- `WAITING_FOR_DEPOSIT`는 `pending`으로 남고 `confirmed` 전환은 Toss API로 일일 대사

### 3-6. 🆕 Imweb 독립 구매 확정 검증 (오늘 새로 구축)

**핵심 요지**: 플레이오토가 정지된 동안 "구매 확정" 수치를 대체할 수 있는 독립 소스를 만들었다. 방식은 Imweb v2 status 필터를 list 모드로 돌려 각 `order_no`를 `imweb_status` 컬럼에 라벨링하는 것.

**구현 요약**:

- 컬럼 추가: `imweb_orders.imweb_status TEXT`, `imweb_orders.imweb_status_synced_at TEXT`
- 신규 함수: `fetchImwebOrdersByStatus()`, `syncOneSiteOrderStatuses()` in `backend/src/routes/crmLocal.ts`
- 신규 엔드포인트:
  - `POST /api/crm-local/imweb/sync-order-statuses` → 9개 status 값을 순차 list 호출 + 429 재시도 + 트랜잭션 UPSERT
  - `GET /api/crm-local/imweb/purchase-confirm-stats?site=biocom` → 현재 분포 + 커버리지 경고
- 실측 분포는 §2-3 참조
- 라벨링 커버리지 94.4%
- 소요 시간: 약 4분 (429 재시도 포함)

**커버리지 한계 (반드시 같이 전달할 것)**:

- 이 경로는 **아임웹 경유 주문만 커버**. 바이오컴 아임웹 기준이고 쿠팡·네이버·수동 주문(전체 주문의 약 20%)은 이 경로로 커버되지 않음. 이 부분은 플레이오토가 유일한 진실 소스.
- `_null_` 469건은 Imweb v2 status 필터에 매칭되지 않은 legacy 주문. 추후 v1 호환 경로 또는 v3 OpenAPI OAuth 앱 등록으로 해결 가능.
- `imweb_status_synced_at`는 sync 시점이지 주문 상태 변경 시점이 아님. 구매확정 → 취소로 전환되는 경우는 다음 sync까지 DB에 반영되지 않음.

**운영 시나리오**:

- 플레이오토가 정상일 때: Imweb 쪽을 **독립 검증용**으로 돌린다. 플레이오토 `구매결정` vs Imweb `PURCHASE_CONFIRMATION` delta가 작으면 건강, 크면 경고.
- 플레이오토 정지 기간(현재): Imweb 쪽을 **임시 primary**로 사용. 단 커버리지가 80%라는 점을 UI에 명시해야 함.

---

## 4. 소스 간 연결 강도 (업데이트)

0406 대비 변동:

| 연결축 | 0406 | 0415 | 근거 |
| ---- | ---: | ---: | ---- |
| GA4 ↔ Toss | 58/100 | **58/100** | 변동 없음. session 유입은 시작됐으나 historical coverage 미해결. |
| Toss ↔ Attribution | 68/100 | **72/100** | settlement backfill 완료로 paymentKey 기반 join 분모 확대. |
| Toss ↔ Imweb | 64/100 | **74/100** | biocom `imweb_orders` 8,362건으로 확장 + status 라벨링으로 구매확정 대조 가능. |
| Toss ↔ PlayAuto | 91/100 | **N/A (보류)** | 플레이오토가 1개월째 정지되어 현재 join 기준 신뢰 불가. 1개월 전 스냅샷은 유효하나 현재 집계에 쓰면 안 됨. |
| Imweb ↔ Members | 74/100 | **74/100** | 변동 없음. |
| GA4 ↔ Attribution | 42/100 | **44/100** | recent row 3종 유입 지속. 여전히 historical row 비중이 커 coverage 낮음. |
| **🆕 Imweb ↔ 구매확정 (독립 검증)** | 없음 | **80/100** | 오늘 구축. 6,682건 확인. 20% 커버리지 한계 명시. |

---

## 5. 무엇을 믿어야 하는가 (업데이트)

### 5-1. 지금 매출 정본으로 가장 믿을 수 있는 것

- **Toss**가 여전히 1순위. 변동 없음.
- 단, "취소 금액" 관점에서는 **Toss만이 믿을 수 있음**. Imweb `CANCEL`은 가상계좌 미입금 만료를 포함해 과장됨 (§6 참조).

### 5-2. 지금 고객 식별로 가장 믿을 수 있는 것

- **Imweb 주문자 전화번호 + member_code** 조합으로 충분. PlayAuto는 정지 기간 동안 보조 축으로도 믿기 어려움.
- PlayAuto 복구 후에는 다시 보조 축으로 복귀 예정.

### 5-3. 🆕 지금 "구매 확정" 수치로 가장 믿을 수 있는 것

- **정상 시기**: 플레이오토 `ord_status='구매결정'` (전 채널 포함)
- **현재 (playauto 정지)**: Imweb `imweb_status='PURCHASE_CONFIRMATION'` (아임웹 경유 80%만)
- 양쪽 모두 집계 시 `CANCEL`/`RETURN`은 exclude. `_null_`은 legacy로 분리.

### 5-4. 지금 채널 귀속으로 가장 위험한 것

- 0406과 동일. `GA4 source/medium/campaign → 실제 결제`를 그대로 믿는 것.
- **추가로 위험한 것**: **Imweb CANCEL 금액을 그대로 취소 실적으로 쓰는 것**. 이는 §6 원인 해석 필수.

---

## 6. 🆕 Imweb CANCEL 금액 과장 사건

> 이 섹션은 오늘(0415) 디버깅 중 드러난 심각한 해석 오류를 남긴다. 이것을 모르면 "취소율 68%"라는 잘못된 숫자가 대시보드에 떠버린다.

### 6-1. 현상

`/api/crm-local/imweb/purchase-confirm-stats?site=biocom` 최초 결과:

- `PURCHASE_CONFIRMATION`: 6,682건 / ₩1,553,289,070
- `CANCEL`: 706건 / ₩1,063,678,461
- **취소 금액 / 확정 금액 = 약 68%** ← 비정상

### 6-2. 원인 추적

**단계 1 — 취소 주문 상위 금액 10건을 뽑아보니 어뷰저 패턴**:

| 금액 | 주문자명 | 비고 |
| ---: | -------- | ---- |
| ₩260,100,000 | 행정2팀 | 2.6억 — 어뷰저/테스트 |
| ₩180,000,000 | 임상병리연구팀 | 1.8억 |
| ₩86,700,000 | ㅈㅈ | 한글 한글자 반복 |
| ₩75,000,000 | ㅅㅅ | 같은 패턴 |
| ₩75,000,000 | 조루희대 | 무의미 이름 |
| ₩22,500,000 | **틱톡광고사기꾼꺼져** | 이름 자체가 식별자 |
| ₩14,390,000 | 바이오컴 | 내부 테스트 |
| ₩9,000,000 | ㅅㅅ | |
| ₩8,120,000 | ㄱㄱ | |
| ₩7,500,000 | ㄱ3 | |

상위 10건 합계 ₩738M = 전체 CANCEL 금액 ₩1,063M의 **69%**.

**단계 2 — Toss 교차 검증**. 위 상위 주문번호를 `toss_transactions`에서 조회:

```
order_id            status               amount
202603244366238-P1  WAITING_FOR_DEPOSIT  0
202604050025277-P1  WAITING_FOR_DEPOSIT  0
202604052259913-P1  WAITING_FOR_DEPOSIT  0
202604055235817-P1  WAITING_FOR_DEPOSIT  0
```

→ **전부 가상계좌 미입금**. `amount=0`. 실제 결제가 발생하지 않았음.

**단계 3 — Imweb CANCEL을 `pay_type`으로 분리**:

| pay_type | cnt | amount |
| -------- | --: | -----: |
| virtual (가상계좌) | 326 | ₩964,986,433 |
| card | 273 | ₩84,925,888 |
| npay (네이버페이) | 39 | ₩9,760,500 |
| etc | 60 | ₩3,270,640 |
| iche (이체) | 3 | ₩735,000 |
| free | 5 | ₩0 |

→ `virtual`만 ₩965M. 전체 CANCEL 금액의 90.7%가 가상계좌.

**단계 4 — Imweb CANCEL × Toss 상태 교차**:

| toss_status | cnt | imweb_amount | toss_amount |
| ---------- | --: | ----------: | ----------: |
| CANCELED (실제 결제 후 취소) | 290 | ₩87.5M | ₩87.5M ✅ 일치 |
| WAITING_FOR_DEPOSIT (가상계좌 만료) | 278 | ₩782.7M | ₩0 |
| DONE (토스는 성공인데 Imweb은 CANCEL) | 265 | ₩82.4M | ₩82.4M ⚠️ 이상 |
| (Toss에 없음, legacy) | 171 | ₩200.6M | — |
| PARTIAL_CANCELED | 7 | ₩1.3M | ₩0.7M |

### 6-3. 해석

**3가지 원인이 겹쳐 과장됐다**:

1. **가상계좌 미입금 만료 (₩782.7M, 74% 기여)** — 가상계좌 발급 후 고객이 입금하지 않으면 Imweb은 만료 후 `CANCEL`로 표시. 하지만 `payment_amount` 컬럼에는 "결제 예정 금액"이 그대로 남음. 실제로는 결제된 적 없는 금액이지만 `CANCEL` 집계에 잡힘. 대부분 어뷰저/테스트/스팸이 가짜 이름으로 가상계좌만 발급하고 입금 안 한 것.
2. **Toss DONE이지만 Imweb CANCEL (₩82.4M, 7.7% 기여)** — 실제 결제는 됐지만 이후 전체 취소. Toss `cancel` 배열에는 있을 가능성이 높으나 현재 로컬 `toss_transactions.status`에는 원 결제 이벤트만 `DONE`으로 저장되어 반영 안 됨. 이 265건이 **로컬 Toss sync의 버그 영역**일 수 있음.
3. **Toss에 없는 legacy 주문 (₩200.6M, 19% 기여)** — 2025년 이전 또는 다른 PG 경로. 검증 불가능.
4. 실제 결제 후 취소된 "진짜 취소" (₩87.5M, 8.2% 기여) — 이게 유일하게 "의미 있는 취소 금액".

### 6-4. 진짜 취소율

**Toss 기준 실제 취소율** (결제 후 취소가 발생한 것):

- 실제 취소 금액 (2026-01~04): `CANCELED ₩112.8M + PARTIAL_CANCELED ₩20.3M = ₩133.1M`
- 실제 결제 완료 금액 (2026-01~04 DONE): `₩1,833.6M`
- **실제 취소율 = 133.1 / 1,833.6 = 약 7.3%** ← 정상 범위

`datacheck0406.md` §P0 #2에서 이미 언급한 운영 원칙("WAITING_FOR_DEPOSIT는 pending이고 메인 매출·ROAS에 포함하지 말 것")은 유효하다. 오늘의 발견은 **그 원칙이 `imweb_status=CANCEL` 집계에도 확대 적용되어야 함**을 추가한다.

### 6-5. 조치 필요

1. **`purchase-confirm-stats` 엔드포인트를 보완**해서 `CANCEL`을 4개 서브카테고리로 분리:
   - `actual_canceled` (Toss DONE → cancel)
   - `vbank_expired` (가상계좌 미입금 만료)
   - `partial_canceled` (부분 취소)
   - `legacy_uncertain` (Toss에 매칭되는 거래 없음)
2. **ads 대시보드에 표시할 숫자는 `actual_canceled`만 사용**. `vbank_expired`는 "결제 시도 및 포기" 별도 KPI로 분리 가능.
3. **어뷰저 계정 관리 작업 별도 검토** — 대형 금액 가상계좌 주문의 이름 패턴(의미 없는 한글 반복, 무의미 부서명 등)이 특정 이벤트성으로 몰리는 건지 trend 분석. 이건 데이터 정합성보다는 fraud 탐지 영역.

---

## 7. 🆕 GA4 refund 미구현 상태

### 7-1. 현상

`/ads` 대시보드와 CAPI는 `purchase` 이벤트만 보낸다. 환불·취소는 GA4에 아예 발화되지 않음.

- 검증: `grep -rn "refund\|purchase_refund" backend/src frontend/src` 결과, 실제 이벤트를 쏘는 코드는 없음. `ga4RevenueOpsPlan.ts`는 **명세 문서**(어떻게 설계할 것인지)이지 실장 코드가 아님.
- `imwebAttributionSnippet.ts`(결제완료 페이지에 주입되는 footer caller)에는 `payment_success` 이벤트만 있고 `refund` 이벤트 발화 로직은 없음.
- 따라서 **GA4의 `/ads` 대시보드 매출은 `gross_revenue` 기준**이고 취소 반영된 `net_revenue`는 GA4 Data API/BigQuery에서 직접 계산할 수 없다.

### 7-2. 영향

- GA4 기반 광고 매체 리포트(`/ads/roas`의 `GA4 purchase ROAS`)는 취소 반영이 없음 → **실제 net ROAS보다 높게 보임**.
- Meta/Google Ads 쪽에 CAPI/OCI로 보내는 값도 취소 반영이 없으면 매체가 과대평가된 매출로 학습됨.
- 현재 운영 기준: `confirmed_revenue`는 Toss 기반 status-aware attribution ledger에서 계산되므로 이 부분만 보면 **취소 반영이 가능**. 다만 GA4-only 리포트는 여전히 `gross_revenue`.

### 7-3. 조치 우선순위

- **우선순위 P1** (이 문서의 새 액션): GA4 `refund` 이벤트를 footer snippet에 추가하거나, Measurement Protocol(MP)로 서버에서 환불을 GA4에 쏘는 파이프라인 구축.
- 설계 기준은 `ga4RevenueOpsPlan.ts` §`refundCancelDesign`에 이미 있음. 구현만 남은 상태.
- 단, "언제 refund 이벤트를 쏠 것인가"는 Toss `CANCELED` / `PARTIAL_CANCELED` 이벤트 확인 시점과 연결해야 함. 실시간 webhook이 없으므로 **일일 Toss 대사 배치 안에서 rescheduled diff로 refund를 쏘는 방식**이 현실적.
- 이 작업은 **playauto 정지 복구보다는 후순위**로 간다. 당장 급한 건 ROAS 숫자의 취소 반영이고, 그건 Toss 기반 `confirmed_revenue`로 이미 가능.

---

## 8. 소스 간 어긋남 re-check 표

0406 대비 오늘 새로 밝혀진 어긋남을 한 장으로 요약한다.

| 축 | 소스 A | 소스 B | 차이 | 원인 | 해결 방향 |
| -- | ------ | ------ | ---- | ---- | --------- |
| 취소 금액 | Imweb CANCEL ₩1,063M | Toss CANCELED+PARTIAL ₩133M | ₩930M 과장 | 가상계좌 미입금 만료 + legacy + Toss DONE but Imweb CANCEL 265건 | §6.5 서브카테고리 분리 |
| 구매 확정 | Imweb PURCHASE_CONFIRMATION ₩1,553M | 플레이오토 `구매결정` | 현재 확인 불가 | 플레이오토 1개월 정지 | 운영db.md P0 복구 + Imweb 독립 경로 유지 |
| 환불 | GA4 refund ₩0 (미구현) | Toss CANCELED ₩113M | 전부 누락 | GA4 refund 이벤트 미구현 | §7.3 refund footer 또는 MP 구현 |
| ROAS | `/ads/roas` GA4 purchase ROAS | `/ads/roas` Attribution ROAS | 0406 이후 Attribution 쪽이 더 신뢰. | 이미 `/ads`의 메인 ROAS는 Attribution으로 통일 (0406 완료) | 유지 |
| CAPI 최신화 | 2026-04-12 21:52 KST 이전 | 이후 | Meta ROAS 과소평가 → CAPI 전환 후 보정됨 | `capivm/capi.md` 기록 완료 | `/ads` 페이지 카드로 delta 표시 중 |

---

## 9. 이 문서 기준 다음 액션

### P0 (이번 주)

1. **`tb_playauto_orders` sync 복구 요청 개발팀 전달** (운영db.md §6 P0 1번). 오늘까지 전달 문서 준비 완료. 이건 우리가 할 수 있는 게 아니라 **revenue 팀에 정식 요청**해야 함.
2. **`purchase-confirm-stats` 엔드포인트에 CANCEL 서브카테고리 분리** (§6.5). 공수 약 1~2시간. Toss join으로 `actual_canceled` / `vbank_expired` / `legacy_uncertain` / `partial_canceled`.
3. **ads 대시보드에 Imweb 구매확정 카드 추가**. 아직 frontend에 붙이지 않음. playauto 정지 기간 동안 독립 검증 수치를 사용자에게 노출해야 의미가 있음. 80% 커버리지 배지 포함.

### P1 (2주 내)

4. **GA4 refund 이벤트 구현** (§7.3). Toss 일일 대사 배치 → refund diff → Measurement Protocol. `ga4RevenueOpsPlan.ts` §`refundCancelDesign`의 설계 활용.
5. **Toss "DONE but Imweb CANCEL" 265건 / ₩82M 케이스 조사**. Toss `cancel` 배열이 로컬 `toss_transactions.status`에 반영 안 되는 버그 의심. 개별 `/v1/payments/{paymentKey}` 조회로 검증.
6. **Imweb 독립 검증 경로를 백그라운드 cron에 연결**. 현재는 수동 POST 호출. `startBackgroundJobs.ts`에 일 1회 또는 6시간 주기 자동 실행.
7. **`_null_` 469건 재조사**. v1 legacy 주문으로 가정했으나, 일부는 v3 OpenAPI(OAuth)로 접근 가능할 수 있음.

### P2 (1개월 내)

8. **운영 DB `operational_mirror` 얇은 레이어 구축** (`운영db.md` §6.6). 5개 테이블을 seo VM에 cache + sync audit.
9. **어뷰저 가상계좌 주문 trend 분석**. §6.5 #3. 특정 이벤트성/광고 캠페인과 연관됐는지 확인. 이는 정합성 문제가 아니라 fraud 탐지 영역이지만 ROAS 왜곡 방지에는 관련.
10. **biocom `imweb_orders` 범위를 2026-01-27 이전까지 확대**. 0406 이후 2,612건 추가됐으나 시작 시점은 여전히 2026-01-27. 과거 주문 백필이 필요한지 판단.

---

## 10. 이 문서가 사용한 증거 경로

검증에 쓴 구체적 쿼리와 호출 경로를 남긴다. 향후 재현 가능하도록.

- **Imweb 구매확정 검증**: `POST /api/crm-local/imweb/sync-order-statuses {"site":"biocom"}` + `GET /api/crm-local/imweb/purchase-confirm-stats?site=biocom`
- **취소 원인 추적**:
  - Imweb CANCEL 시간 분포: `sqlite3 crm.sqlite3 "SELECT substr(order_time,1,7), COUNT(*), SUM(payment_amount) FROM imweb_orders WHERE imweb_status='CANCEL' GROUP BY 1"`
  - CANCEL × Toss status join: `SELECT tt.status, COUNT(*), SUM(io.payment_amount), SUM(tt.amount) FROM imweb_orders io LEFT JOIN toss_transactions tt ON tt.order_id LIKE (io.order_no || '%') WHERE io.imweb_status='CANCEL' GROUP BY tt.status`
  - CANCEL by pay_type: `SELECT pay_type, COUNT(*), SUM(payment_amount) FROM imweb_orders WHERE imweb_status='CANCEL' GROUP BY pay_type`
- **Toss 월별 상태**: `SELECT substr(transaction_at,1,7) m, status, COUNT(*), SUM(amount) FROM toss_transactions WHERE transaction_at>='2026-01-01' GROUP BY m, status`
- **운영 DB playauto 정지 확인**: `psql -c "SELECT MAX(synced_at), MAX(ord_time), COUNT(*) FROM tb_playauto_orders"` → `2026-03-13 07:06 / 2026-03-13 15:18 / 115316`
- **GA4 refund 구현 확인**: `grep -rn "refund\|purchase_refund" backend/src frontend/src` → footer snippet에 발화 로직 없음 확인

---

## 11. 이 문서의 한계

- **`_null_` 469건의 정체**가 여전히 불명확. v1 legacy 주문으로 가정했으나 직접 검증 안 함.
- **커피 사이트의 Imweb status 라벨링은 아직 안 돌림**. biocom만 수행. coffee 페이지네이션 불안정 문제 때문에 별도 검증 필요.
- **`aibio` 사이트**도 이 경로를 적용해야 하는지 우선순위 판단 필요 (CRM 주문량이 작아 우선순위 낮음).
- **플레이오토 `ord_status='구매결정'`과 Imweb `PURCHASE_CONFIRMATION`의 실제 delta** 측정은 운영 DB가 정지해서 현재 불가. 복구 후 retroactive 비교가 필요.
- **GA4 refund 구현 작업량 추정**은 이 문서에서 하지 않음. `ga4RevenueOpsPlan.ts` 설계 문서를 재검토하고 별도 작업 티켓으로 분리 필요.
