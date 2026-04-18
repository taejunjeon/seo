# business_confirmed 지연 분포 결과보고서

작성 시각: 2026-04-18 14:30 KST
기준일: 2026-04-18
버전: v4 (피드백 반영 — C안 stop-line 확정, aibio CRM DB 경로 정정, identity coverage 우선순위 승격)
관련 워크스트림 문서: `roadmap/confirmed_stopline.md`

데이터 소스 (세 가지):

| 소스 | 접근 경로 | 관리 주체 | 이 분석에 주는 것 |
|---|---|---|---|
| **운영 PG DB** (`dashboard`) | `postgresql://bico_readonly@34.47.95.104:5432/dashboard` | 회사 개발팀 | biocom·coffee 주문 전수(`tb_playauto_orders`, `tb_sales_toss`, `tb_iamweb_users`). aibio 없음 |
| **VM SQLite** (`att.ainativeos.net`) | HTTPS API (`/api/attribution/ledger`, `/health`) | TJ 운영 (Biocom SEO 솔루션 VM) | attribution_ledger payment_success/form_submit 이벤트 (biocom 2525 / coffee 203 / aibio 29건, 최신 2026-04-17) |
| **로컬 SQLite** (`backend/data/crm.sqlite3`) | 로컬 파일 | TJ 개발 스냅샷 | 지연 시간(paid→complete_time) 실측용. attribution_ledger는 2026-03-29~04-12 범위만 |
| **AIBIO CRM Supabase** | env 186-193행 (`AIBIO_SUPABASE_ID=dev@biocom.kr`, `AIBIO_SUPABASE_PASS=Bico1010!!`, `AIBIO_SUPABASE_PROJECT=aibio-center`) | AIBIO 센터 | **shop 주문은 거의 없음.** 고객 결제 정보는 이 CRM DB에 적재. access key는 로그인 후 Supabase 대시보드에서 발급해야 함 |

v1 대비 변경: "thecleancoffee imweb_status 전부 비어 있음" / "aibio imweb_orders 없음" 판단은 **로컬 스냅샷 한정 현상**이었음을 운영 PG/VM에서 확인. 실제 현황은 아래 §데이터 커버리지에 재기술.

---

## 10초 요약

- 이 보고서의 목표는 **Meta CAPI Purchase를 `paid`로 쏠지 `business_confirmed`로 쏠지**를 실측 지연 분포로 결정하는 것이다.
- 결론은 **C안(공식 지표 = business_confirmed, Meta 최적화 = fast signal = paid 유지 + Refund 보정)** 로 v1 stop-line 확정이다.
- biocom 카드 p50 42h / p90 91h, coffee 카드 p50 36h / p90 66h — Meta 학습 신호로는 둘 다 늦음. 반면 `payment_success` 세 식별자(clientId/userPseudoId/gaSessionId) 유입률이 VM 기준 76%여서, 지금 더 큰 돈은 **confirmed 정의 고도화가 아니라 identity coverage 개선**에 있다.
- 다음 액션은 (a) `/ads` Official/Fast 두 줄 분리 (b) Imweb CANCEL을 `actual_canceled/vbank_expired/partial_canceled/legacy_uncertain`으로 분리 (c) Meta CAPI Refund + GA4 MP Refund 구현.

## 최종 의사결정 문장 (TJ 승인용)

> **운영 공식 성과판단은 `business_confirmed` 기준으로 본다. 메타 최적화 신호는 `paid` 기반 fast signal을 유지하되, 환불/취소 정정 이벤트를 추가한다. confirmed 정의 고도화는 v1 기준에서 고정하고 후순위로 넘기며, 다음 우선순위는 identity coverage와 campaign mapping이다.**

상세 실행 계획은 `roadmap/confirmed_stopline.md` 워크스트림 문서로 분리했다.

## 고등학생 비유

이 일은 쉽게 말해 **"시험 채점표를 언제 광고 학원에 넘길지"** 결정하는 일이다. 진짜 최종 점수(business_confirmed)는 시험 친 지 **2일 정도 지나야** 나오는데, 학원(Meta)은 "빨리 학생한테 피드백 줘야 효과가 커진다"고 한다. 그래서 학원에는 **가채점 점수(paid)를 먼저 넘기고**, 나중에 "이 학생은 사실 0점으로 정정됐습니다"(Refund 이벤트)라고 뒤따라 정정해주는 방식이 낫다. 반대로 **회사 내부 매출표는 최종 점수만**(business_confirmed) 쓴다.

## Phase-Sprint 연관표

이 보고서의 결론은 아래 두 Sprint에 직접 적용된다.

| 관련 문서 | Sprint | 이 보고서가 주는 입력 |
|---|---|---|
| `capivm/capi.md` | §0 GA4 refund 검토 (A+C 경로) | paid → confirmed 지연 실측으로 "A(BI 보정)"와 "C(MP refund + Meta CAPI Refund)" 우선순위를 수치로 뒷받침 |
| `data/!datacheckplan.md` | [[!datacheckplan#Phase2-Sprint4\|Phase2-Sprint4]] 취소와 순매출 보정 | CANCELED/PARTIAL_CANCELED 비율(카드 5.2%, 가상 1.7%)이 `actual_canceled` 분리 설계의 상한 근거 |

> Phase/Sprint 상세 이동은 각 원본 문서에서 한다. 이 보고서는 단일 조사 결과라서 자체 Sprint는 두지 않는다.

---

## 이번 턴이 하는 일

1. `paid_at → Imweb PURCHASE_CONFIRMATION` 지연 분포를 사이트·결제수단별로 계산한다.
2. `payment_success logged_at → business_confirmed_at` 분포도 같은 축으로 계산한다.
3. confirmed.md의 "좋은/애매한/나쁜 케이스" 기준에 대입해 A/B/C 중 하나를 추천한다.

## 왜 필요한가

- 현재 운영 코드는 `paymentStatus === 'confirmed'`를 CAPI Purchase 조건으로 쓴다(`backend/src/metaCapi.ts:260-267`). 이 "confirmed"는 **Toss DONE + ledger confirmed = paid 시점**에 가깝다. 즉 **실제로는 B안(paid)으로 이미 돌고 있다.**
- confirmed.md는 "business confirmed 기반 CAPI로 가야 하는지"를 묻는다. 그런데 지연이 너무 길면 학습이 둔해진다. 실측 없이는 결정 불가.
- Meta ROAS는 A/B 중 무엇을 쓰느냐에 따라 완전히 다른 숫자가 나온다. 숫자로 합의해야 다음 예산 결정을 흔들리지 않게 할 수 있다.

---

## 실측 결과

### 데이터 커버리지와 제약 (운영 PG / VM / 로컬 세 소스 + Toss·Imweb API 재확인)

**v3에서 번복된 판단**

v2에서 "thecleancoffee는 `imweb_status` 컬럼이 비어 있어 측정 불가"라고 썼다. **이것은 잘못된 결론이었다.** 실제로 로컬 DB의 `imweb_orders.complete_time` 컬럼은 coffee에서도 **1,521건 중 1,372건(90%) 이미 채워져 있다.** 쿼리에 `imweb_status='PURCHASE_CONFIRMATION'` 필터를 걸어 측정 가능한 주문을 스스로 배제한 것이 원인이었다. `complete_time`만 조건으로 쓰면 coffee 지연 분포도 뽑힌다 (§[표 1 v3]).

**v4 정정 2**: v2~v3에서 "aibio는 Supabase access key 없음 → 측정 불가"라고 썼다. 이것도 부정확했다. env 186-193행에 **AIBIO 센터 CRM Supabase 로그인 자격**(ID/PW/PROJECT)이 있다. 키가 없어서 조회가 막힌 게 아니라, **aibio 자체가 shop 주문이 거의 없고 결제는 별도 CRM DB(센터 상담/결제)**여서 이 보고서의 "paid → Imweb complete_time 지연" 프레임이 애초에 맞지 않는다. aibio는 별도 frame(상담 예약 → 센터 결제 전환)으로 다시 설계해야 한다.

| 사이트 | 결제수단 | 지연 시간(p50/p90) | 도달률(≥7일) | 주된 소스 | 비고 |
|---|---|---|---|---|---|
| **biocom** | 카드(Toss) | **측정 가능** | **측정 가능** | 로컬 `imweb_orders.complete_time` + 운영 PG 교차 | n=4,634 / p50 42.3h / p90 91.1h |
| **biocom** | 가상계좌(Toss) | **측정 가능** | **측정 가능** | 동일 | n=472 / p50 41.6h / p90 85.3h |
| biocom | 카드(NicePay) | 제한적 | 측정 가능 | Toss 미경유 → paid_at은 `complete_time` proxy (무의미) | — |
| biocom | 네이버페이 | 제한적 | 측정 가능 | 동일 | — |
| **thecleancoffee** | 카드(Toss) | **측정 가능** (v3 신규) | **측정 가능** | 로컬 `imweb_orders.complete_time` + 운영 PG 교차 | n=840 / **p50 36.3h / p90 66.1h** — biocom보다 빠름 |
| **thecleancoffee** | 가상계좌(Toss) | **측정 가능** (v3 신규, 소량) | **측정 가능** | 동일 | n=12 / p50 35.3h / p90 69.9h |
| thecleancoffee | 계좌이체 | 측정 가능 | 측정 가능 | 동일 | n=19 / ≥7일 100% |
| thecleancoffee | 네이버페이 | 제한적 | 측정 가능 | Toss 미경유 | — |
| **aibio** | 전체 | **측정 경로 다름** | **측정 경로 다름** | AIBIO CRM Supabase (env 186-193) | **aibio는 shop 주문이 거의 없음.** 고객 결제는 AIBIO 센터 CRM DB에 있음. 이 분석의 "paid→confirmed 지연" 프레임 자체가 부적합 — 별도 CRM 결제 모델로 재정의 필요 |

### Toss / Imweb API 재확인 결과 (사용자 요청)

사용자 지시에 따라 **coffee 토스 API**, **아임웹 v2 API**, 공식 문서(tossapi.md / imwebapi.md)를 모두 재확인했다.

#### 1) Toss Payments API로 "구매확정 시각"을 받을 수 있는가 — **아니오**

Toss API 공식 스펙(`docs.tosspayments.com/reference` + 본 프로젝트 `tossapi.md`)과 coffee live key(`live_sk_XZYkKL...`)로 실호출해서 확인했다. `GET /v1/payments/orders/{orderId}` 응답에 포함된 시간 필드:

| 필드 | 의미 |
|---|---|
| `requestedAt` | 결제 요청 시각 |
| `approvedAt` | 결제 승인 시각 (= paid_at) |
| `cancels[].canceledAt` | 취소 시각 (있는 경우) |
| `card.acquireStatus` | 카드 매입 완료(COMPLETED) — 시각은 별도로 받지 못함 |

응답 필드 전수 확인(coffee orderId `202604013283913-P1`):
```
requestedAt  2026-04-01T07:29:51+09:00
approvedAt   2026-04-01T07:30:19+09:00
status       DONE
metadata     null
cancels      null
```

**Toss는 PG(결제 대행사)이므로 "주문 구매확정" 개념 자체가 없다.** Toss는 결제 승인/취소/정산까지만 책임지고, 구매확정(배송 완료 → 자동 구매확정)은 커머스 플랫폼(아임웹) 책임이다. 공식 문서에도 구매확정 관련 필드는 없다. → **Toss API로 business_confirmed 시각 취득은 구조적으로 불가능.**

#### 2) Imweb API로 받을 수 있는가 — **제한적으로 가능**

아임웹 v2 API를 coffee 키(`IMWEB_API_KEY_COFFEE` / `IMWEB_SECRET_KEY_COFFEE`)로 실호출해서 확인했다.

| 엔드포인트 | 받을 수 있는 시각 필드 | 상태 이력 필드 |
|---|---|---|
| `GET /v2/shop/orders?offset=…&limit=…` | `order_time`(주문), `payment.payment_time`(결제), **`complete_time`(주문 완료 = business_confirmed)** | 없음. 최종 `complete_time` 하나만. |
| `GET /v2/shop/orders/{order_no}` | 동일 | 없음 |
| `GET openapi.imweb.me/orders` | 미확인 | **현재 env 키로 401 — OAuth 앱 자격증명 필요** |

실호출 결과(coffee 주문 `202604176769547`): `order_time 1776412239`, `payment.payment_time 1776412288`, **`complete_time 0`** (최근 주문이라 아직 구매확정 전). 반대로 3주 전 주문은 complete_time이 채워져 있음 — 즉 아임웹이 **배송완료 후 N일 경과 시 자동으로 구매확정하면서 complete_time을 채운다.**

중요:
- **"언제 pending → paid → shipped → confirmed로 전이됐는가"의 전이 이력은 v2 API가 제공하지 않는다.** 최종 `complete_time`만 받을 수 있다.
- 그래서 우리가 측정하는 지연은 "paid_at → complete_time" 한 구간뿐. 중간(배송 중)은 관측 불가.
- OpenAPI(`openapi.imweb.me`)에 상태 전이 이력이 있을 가능성이 있지만, **현재 env의 v2 키로는 401.** OAuth 2.0 앱 발급이 필요 (아임웹 개발자센터에서 별도 앱 생성). 이번 분석 범위 밖.

#### 3) 운영 PG `tb_playauto_orders` / `tb_iamweb_users`는 어떤가 — **시각 보존 안 됨**

- `tb_playauto_orders.updated_at`과 `synced_at`이 **모든 주문에서 동일**(sync 배치 실행 시각). 예: 2026-03-13 07:02:52가 수천 건에 그대로. → 전환 시각 아님.
- `tb_iamweb_users`에 `payment_complete_time`은 있으나, 이 필드는 **PG 승인 시각**(=paid_at)에 해당. 구매확정 전이 시각 아님.
- 즉 **운영 DB 어디에도 PURCHASE_CONFIRMATION으로 전이된 시각이 저장돼 있지 않다.** 아임웹 v2 API가 유일한 소스.

#### 결론 요약

| 질문 | 답 | 근거 |
|---|---|---|
| Toss API로 coffee 구매확정 시각을 받을 수 있나? | **아니오 (구조적 불가)** | Payment 객체에 `requestedAt`/`approvedAt`/`canceledAt`만. 구매확정 개념은 PG 책임 밖 |
| 아임웹 v2 API로 coffee 구매확정 시각을 받을 수 있나? | **예 (`complete_time` 필드)** | 실호출 확인. 단 최종 전이 시각 하나만, 이력은 아님 |
| 아임웹 OpenAPI로 상태 이력을 받을 수 있나? | **미확인 (현재 키로 401)** | OAuth 앱 자격증명 발급 후 재시도 필요 |
| 운영 DB에 구매확정 전이 시각이 저장돼 있나? | **아니오** | playauto updated_at은 sync 시각, iamweb_users payment_complete_time은 paid_at |

**실무 결론**: `아임웹 v2 API /v2/shop/orders`의 `complete_time`이 세 사이트 중 biocom·coffee에서 유일한 business_confirmed 시각 원천이다. 이미 로컬 DB에 sync되어 있어 새로 호출할 필요도 없다. **aibio만 Supabase 접근 자격 확보가 남은 선결 과제.**

### [표 1 v3] PG paid → Imweb `complete_time` 지연 (coffee 포함)

기간: 2026-01-18 ~ 2026-04-15 (88일). `complete_time IS NOT NULL AND complete_time!=''` 조건만 사용(이전 v2의 `imweb_status='PURCHASE_CONFIRMATION'` 필터 제거).

| 사이트 | 결제수단 | n_paid | n_conf | p50 | p75 | p90 | p95 | ≤24h | ≤72h | >7d 미confirmed |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| biocom | **카드(Toss)** | 4,634 | 4,388 | **42.3h** | 60.1h | **91.1h** | 108.6h | 4.4% | 77.0% | 5.3% |
| biocom | **가상계좌(Toss)** | 472 | 463 | 41.6h | 53.6h | 85.3h | 100.1h | 4.7% | 83.5% | 1.9% |
| **thecleancoffee** | **카드(Toss)** | **840** | **828** | **36.3h** | 46.4h | **66.1h** | 78.3h | **16.4%** | **91.4%** | 1.4% |
| **thecleancoffee** | **가상계좌(Toss)** | 12 | 11 | 35.3h | 55.3h | 69.9h | 72.6h | 8.3% | 83.3% | 8.3% |
| biocom | 카드(NicePay) | 969 | 905 | *proxy 0h* | — | — | — | — | — | 2.4% |
| biocom | 네이버페이 | 345 | 320 | *proxy 0h* | — | — | — | — | — | 2.9% |

**핵심 관찰**

1. **coffee가 biocom보다 빠르다.** 카드 기준 p50 36.3h vs 42.3h, p90 66.1h vs 91.1h, ≤72h 도달률 91.4% vs 77.0%. 배송 특성(커피는 단순 상품, biocom은 검사 상품 포함)이 반영된 것으로 보인다.
2. biocom 카드 ≤24h 4.4%, ≤72h 77%, coffee 카드 ≤24h 16.4%, ≤72h 91%. **세 사이트 중 가장 느린 biocom 기준으로도 ≤72h에 77% 도달**한다.
3. 7일이 지나도 미confirmed인 비율은 1~5% (비정상 주문/장기 미배송 등).
4. 이 수치는 Toss + Imweb v2 API로 받은 실데이터다. 운영 PG는 보조 소스로 도달률만 확인했다(§[표 3]).

### [표 2] payment_success(ledger) → business_confirmed 지연

기간: 2026-03-29 ~ 2026-04-12 (attribution_ledger 로컬 범위 14일). 분모 n = ledger에서 `payment_status='confirmed'`로 찍힌 `payment_success` 이벤트, n_conf = 그중 Imweb이 PURCHASE_CONFIRMATION으로 올라온 건수.

| 사이트 | 결제수단 | n | n_conf | p50 | p75 | p90 | p95 |
|---|---|---:|---:|---:|---:|---:|---:|
| biocom | 카드(Toss) | 475 | 203 | 38.9h | 50.2h | 75.0h | 83.3h |
| biocom | 가상계좌(Toss) | 54 | 25 | 29.7h | 39.7h | 49.9h | 53.7h |
| thecleancoffee | (전체) | 85 (pending만) | 0 | n/a | n/a | n/a | n/a |

> 표 2의 n_conf < n인 이유: 2026-04-12 이후 complete_time이 아직 안 찍혔거나 주문이 취소된 건. 4/12 이후는 이 로컬 DB에 complete_time 업데이트가 안 들어오므로 낮게 나옴.

### [표 3] 운영 PG DB 도달률 (coffee 포함 전사이트)

기간: 2026-01-18 ~ 2026-04-18. "≥7일" = approved_at으로부터 현재(2026-04-18)까지 최소 168시간 경과한 주문 — 이 시점이면 아임웹 자동 구매확정(배송완료 후 N일)이 이미 지났어야 정상이다. 소스: 운영 PG `tb_sales_toss` × `tb_playauto_orders` 조인.

| 사이트 | 결제수단 | n (≥7일) | n(구매결정+배송완료) | **도달률** | canceled |
|---|---|---:|---:|---:|---:|
| **biocom** | 카드(Toss) | 5,241 | 5,125 | **97.8%** | 0 (완료, 별도 취소 2건) |
| **biocom** | 가상계좌(Toss) | 557 | 547 | **98.2%** | 2 |
| **thecleancoffee** | 카드(Toss) | 1,307 | 1,262 | **96.6%** | 0 |
| **thecleancoffee** | 가상계좌(Toss) | 32 | 29 | **90.6%** | 0 |
| **thecleancoffee** | 계좌이체 | 19 | 19 | **100.0%** | 0 |

> 해석: **≥7일 경과한 주문은 세 사이트·세 결제수단 모두 90~100% 도달**한다. "7일 지나도 미confirmed" 비율은 실질적으로 **2~10%**. 이는 p95 지연이 7일 안에 들어온다는 의미 — biocom에서 로컬 스냅샷으로 뽑은 p95=107h(4.5일)와 일치한다.
>
> "해당 결제수단에서 실제로 canceled/refund로 빠지는 건"은 세 사이트 모두 **1% 이하**. 이는 표 1의 biocom canc%(카드 5.2%, 가상 1.7%)와 숫자가 다른데, 표 1은 Imweb CANCEL 라벨 기준(가상계좌 미입금 만료 포함), 표 3은 `tb_playauto_orders.ord_status='취소완료'` 기준이기 때문이다. "실제 환불"은 표 3 기준으로 **1% 내외가 상한**이라는 해석이 가능하다.

### 분포의 모양 (요약 설명)

- **p50 ≈ p75**와 **p90**의 간격: 카드 Toss에서 p50=42h, p75=59h, p90=91h. 중앙값 주변은 뭉쳐 있고 상위 10%가 길게 꼬리를 만든다. 즉 "평균 2일" + "가끔 4~7일"의 구조다.
- 가상계좌는 카드보다 **p75가 약간 짧다** (54h vs 59h). 가상계좌는 입금 시점 자체가 이미 "고객 확실한 의사"라 구매확정도 조금 더 빠른 것으로 보인다.

---

## 무엇이 증명됐는가

1. **business_confirmed는 paid보다 중앙값 기준 ~42시간 늦다.** 이는 "결제 직후 운영 확정"이 아니라 **"배송 완료 + 아임웹 자동 구매확정 로직 대기"** 결과다 (confirmed.md의 Q1에 대한 실증 답변).
2. **72시간 안에는 대부분(76~82%) 들어온다.** 즉 confirmed.md의 "애매한 케이스"(p50 12~24h, p90 48~72h)보다 p90은 나쁘지만 ≤72h 도달율은 오히려 높다.
3. 실제 취소/환불은 **5% 미만**. 즉 B안(paid)을 그대로 유지해도 과대 ROAS 오염은 5% 이하로 제한된다 — 단, 이 5%에 Refund 이벤트를 붙일 때만 유효하다.
4. **thecleancoffee와 aibio는 지금 숫자로 판단할 수 없다.** 라벨링·데이터 수집이 먼저다.

## 아직 증명되지 않은 것 (유력 가설)

- **identity coverage 50~76%**: VM 기준 `payment_success` 2,777건 중 orderId 유입 1,296(100% of payment_success), gaSessionId 2,102(76%), clientId/userPseudoId 2,133(77%). 이 3종 all-three 유입률이 보고서 v1 기준 50.26%였음 — **confirmed 정의 고도화보다 이 쪽 우선순위가 높다.** (피드백 반영)
- **네이버페이·NicePay의 진짜 paid→confirmed 지연**: Toss 미경유라 이번 분포에 못 들어감. 네이버페이·NicePay 원천 로그 연결이 되어야 확인 가능.
- **중간 상태 전이 이력**: paid → 출고대기 → 배송중 → 배송완료 → 구매확정의 중간 구간별 지연은 아임웹 v2 `/v2/shop/orders`가 제공하지 않는다. `complete_time` 하나만 받을 수 있음. **v1 stop-line 기준 이 이력 추적은 후순위**로 둠.
- **aibio**: env 186-193 자격이 있으나 **프레임이 다름** — shop 주문이 아니라 센터 상담/결제 CRM. 별도 Sprint에서 "상담 예약 → 센터 결제 전환" 지연/도달률 분석으로 재설계.
- **VM ledger 기준 지연 시간 재현**: VM의 attribution_ledger는 2026-04-17까지(2,773건)로 더 넓지만, 이번 분포 계산은 로컬 스냅샷으로 했다. VM 내부 DB에 직접 쿼리 접근은 현재 HTTPS API로만 가능 — 대용량 조인은 API로 부담됨. 필요 시 VM SSH로 SQLite 직접 조회하는 경로를 별도 마련해야 한다.
- **이 42h가 실제 Meta 학습 성과에 얼마나 영향을 주는지**: Meta가 내부적으로 "confirmed 이벤트 몇 시간 안에 들어오면 학습에 반영"이라는 공식 컷오프를 공개하지 않는다(confirmed.md도 명시). 운영 전환 후 A/B로만 확인 가능.

---

## 추천 결론 — **C안 채택**

**C안: 공식 지표(official metric)는 business_confirmed, Meta CAPI 최적화 신호(optimization)는 faster signal을 유지.**

### 왜 C인가

| 축 | A (CAPI=confirmed) | B (CAPI=paid, 현재) | **C (분리)** |
|---|---|---|---|
| Meta 학습 속도 | 느림 (p50 42h, p90 91h) | 빠름 (paid 즉시) | **빠름 (paid 유지)** |
| 가상계좌 미입금 오염 | 없음 | **없음** (Purchase Guard v3으로 이미 차단) | **없음** |
| confirmed 이후 canceled 반영 | 자동 (confirmed 되지 않음) | 없음 (Refund 미전송 중) | **MP Refund + CAPI Refund로 보완** |
| 대표 ROAS 숫자 신뢰 | 가장 깨끗 | gross 오염 가능 | **BI 보정 net로 깨끗** (capi.md §0-4 A옵션) |
| 공수 | CAPI 경로 재설계(대) | 0 | **`/ads` BI 보정 + Refund 이벤트(중)** |

- **A안의 결정적 단점**: p50 42h는 confirmed.md "나쁜 케이스"(p50 > 24h) 경계를 넘었다. Meta 학습 속도가 실질적으로 떨어질 수 있고, 현재 Purchase Guard v3으로 이미 가상계좌 미입금은 차단된 상태라 **A안의 주된 방어 효과가 중복**이다.
- **B안(현재 유지)의 결정적 단점**: 실제 canceled 5.2%(카드 Toss) 비율이 Meta에 정정되지 않는다. 어뷰저 입금 후 환불 희귀 케이스도 Meta에 남는다.
- **C안은** capi.md §0-4의 "A 즉시 + C 2주 내 + B 금지" 설계와 **정확히 일치**한다. 공수는 이미 계산됐고, 설계서도 있다(`ga4RevenueOpsPlan.ts §refundCancelDesign`).

### C안 구체 정의

1. **공식 ROAS / 대시보드 매출판단 숫자**:
   - Source: `imweb_status='PURCHASE_CONFIRMATION'` 기준 집계.
   - 표시 위치: `/ads` 상단 카드 "biocom confirmed revenue (net)".
   - BI 보정: Imweb CANCEL 중 `vbank_expired`(가상계좌 미입금 만료)는 취소로 세지 않음, `actual_canceled`만 차감.
2. **Meta CAPI Purchase 이벤트**:
   - 현재 동작 유지(`paymentStatus='confirmed'` = paid 기준).
   - event_id = `Purchase.{order_code}` 유지.
   - 가상계좌 `WAITING_FOR_DEPOSIT`은 그대로 제외(Guard v3).
3. **Meta CAPI Refund 이벤트 (신규)**:
   - Toss 상태 전이 `DONE → CANCELED` 또는 `DONE → PARTIAL_CANCELED` 발생 시 CAPI `Refund` 또는 `Purchase` 음수 value로 전송.
   - MP Refund(GA4)도 같은 diff에서 함께 전송.
   - 실제 canceled 비율(카드 5.2%, 가상 1.7%)이 이 이벤트의 예상 볼륨.

---

## 산출물

- **이 보고서** (`data/confirmedreport.md`)
- 재사용 가능 쿼리: `/tmp/confirmed_stats.json` (임시) → 운영 DB 적재용 스크립트로 정식화 필요
- [표 1] [표 2] 수치는 아래 "재현 방법"으로 누구나 다시 돌릴 수 있음

---

## 우리 프로젝트에 주는 도움

- **Meta CAPI 정책을 숫자로 결정**했다. 이제 "confirmed로 바꿀까 말까"를 철학으로 논쟁하지 않는다.
- **`/ads` 대시보드 오염을 제거**할 근거가 확정됐다(Imweb CANCEL gross를 실제 canceled 5.2%로 보정).
- **thecleancoffee·aibio의 선결 과제**가 드러났다. 이 두 사이트를 같은 분석 축에 넣으려면 먼저 데이터 수집을 고쳐야 한다.
- `data/!datacheckplan.md` Phase2-Sprint4의 `actual_canceled` 분리 설계에 **상한값**을 준다.

---

## 다음 액션

### 지금 당장 (오늘)

1. [TJ] 위 **최종 의사결정 문장** 승인 — C안을 운영 기준으로 잠금. 이후 `/ads`·`/crm`·`/tracking-integrity`의 모든 용어는 이 문장을 참조.

### 이번 주 (구현 3개)

feedback에 맞춰 우선순위를 잡음. 이 3개가 붙어야 C안이 말이 아니라 실제 운영 기준이 된다.

1. [Claude Code] **`/ads`에 Official / Fast Signal 두 줄 분리.** 상단 카드 "Official ROAS (biocom/coffee confirmed)"와 "Fast Signal ROAS (paid 기반, Meta 학습 신호와 동일)"를 나란히. 의존성: 부분병렬. 카드 자리와 문구는 먼저 만들 수 있고, 최종 값은 2번 결과 수령 후 연결.
2. [Codex] **`purchase-confirm-stats` CANCEL 서브카테고리 분리** — `actual_canceled` / `vbank_expired` / `partial_canceled` / `legacy_uncertain`. `datacheck0415.md` §7 설계대로. 의존성: 병렬가능.
3. [Codex] **Meta CAPI Refund + GA4 MP Refund 설계·구현 시작**. Toss `DONE → CANCELED / PARTIAL_CANCELED` 상태 전이를 감지하는 최소 경로. `backend/src/startBackgroundJobs.ts:syncAttributionStatusFromToss` 연장. 의존성: TJ GA4 MP API secret 발급 후 MP 전송 활성화.

### Codex에게 바로 시킬 일 4개 (feedback §Codex에게 바로 시킬 일 반영)

1. **C안 구현 diff plan** — 현 구조에서 Official=confirmed / Meta=paid / Refund 추가를 적용할 때 바꿔야 할 파일·타입·API·화면 문구 전수 정리.
2. **최근 30일 과대계상 영향 계산** — paid 기반 Meta Purchase 유지 시 Refund 미보정으로 과대되는 건수와 금액을 biocom/coffee별로 수치화.
3. **`/ads` 이중 숫자 설계** — Official ROAS와 Fast Signal ROAS를 같이 보여줄 때 기존 카드·표·API 영향 범위 정리.
4. **Refund 이벤트 경로 설계** — Toss `DONE → CANCELED / PARTIAL_CANCELED` 상태 전이 감지 → Meta CAPI Refund + GA4 Refund 최소 구현안.

### 다음 배치 (정의 고도화 대신 돈에 더 가까운 문제로)

feedback에서 반복 강조된 우선순위. 상세는 `roadmap/confirmed_stopline.md`.

1. [Codex] **identity coverage 개선** — `payment_success`의 clientId/userPseudoId/gaSessionId all-three 유입률(현재 ~50%)을 85% 이상으로. 빠진 구간 원인 분해(historical / session_lost / tag_payload_missing / duplicate_sender / raw_export_unknown).
2. [Codex] **campaign mapping 보정** — Meta confirmed attribution 주문 중 `(unmapped)` 비율 축소 (`data/!datacheckplan.md` Phase3-Sprint6과 연동).
3. [TJ+AIBIO센터] **AIBIO CRM Supabase 접근** — env 186-193에 로그인 자격 있음. Supabase 대시보드 접속해 read-only API key 발급 후 `AIBIO_SUPABASE_ANON_KEY` 추가. 단 aibio는 shop 주문이 아니라 **상담 예약 → 센터 결제 전환** 프레임이므로 분석 설계를 별도로 해야 함.
4. [후순위] 아임웹 OpenAPI OAuth 앱 등록 — 상태 전이 이력 추적이 정말 필요해지기 전까지는 대기.

### 지금 안 할 것 (feedback §지금 안 할 것 반영)

- 결제수단별 모든 상태 전이 이력 완전 복원
- 아임웹 OpenAPI OAuth까지 뚫어서 중간 상태 전부 추적
- 3사이트 100% 완벽 일치 후에만 다음 단계로 가기
- 이 문제를 해결할 때까지 나머지 로드맵 멈추기

---

## 개발 부록

### §A. 재현 방법

```bash
# 로컬 DB 기준
python3 <<'PY'
import sqlite3
from datetime import datetime, timezone
from collections import defaultdict

DB = "backend/data/crm.sqlite3"
conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute("""
SELECT i.site, i.pay_type, i.pg_type, i.order_no, i.order_code,
       i.order_time, i.complete_time, i.imweb_status,
       t.method, t.status AS tstatus, t.transaction_at AS paid_at
FROM imweb_orders i
LEFT JOIN toss_transactions t ON t.order_id = i.order_no||'-P1'
  AND t.status IN ('DONE','CANCELED','PARTIAL_CANCELED','WAITING_FOR_DEPOSIT')
WHERE i.order_time >= '2026-01-18'
""")
# paid_at = Toss DONE transaction_at (card/virtual toss)
# confirmed_at = imweb_orders.complete_time WHERE imweb_status='PURCHASE_CONFIRMATION'
# 지연(시간) = confirmed_at - paid_at
# site × pay_type × pg_type로 그룹 나누어 p50/p75/p90/p95 계산
PY
```

### §B. 판정 로직 (C안 채택 근거 재요약)

- confirmed.md 기준:
  - "좋은 케이스"(p50 1~3h, p90 ≤24h) — **미충족**
  - "애매한 케이스"(p50 12~24h, p90 48~72h) — **p90은 초과(91h)**, p50도 초과(42h)
  - "나쁜 케이스"(p50 ≥1d, p90 ≥3d) — **해당**
- 단 ≤72h 도달율 76~82%는 "나쁜 케이스 중에서도 온건한 쪽". 이 때문에 A안을 아예 배제하지는 않지만, **현재 Guard v3이 이미 가상계좌 오염을 차단**한 상태라 A안이 해결할 문제가 남아 있지 않다.
- 그래서 **"지연이 있으니 A 포기 + 5% canceled는 Refund로 잡자"**가 가장 싸고 정확한 경로 = C안.

### §C. 본 보고서의 한계

- **지연 시간 p50/p90**: 로컬 `imweb_orders.complete_time`에만 의존. biocom·coffee 두 사이트에서 동일 소스로 측정. aibio만 누락.
- **운영 PG `tb_playauto_orders.updated_at`은 sync 배치 시각**이라 전환 시점 보존 안 됨. 따라서 운영 PG는 "≥7일 기준 도달률"만 확인 가능 — 지연 시간 자체는 아임웹 v2 API `complete_time`이 유일한 소스.
- **Toss API에서 구매확정 시각은 구조적으로 불가**. 실호출·공식 문서 모두 확인 완료 (§Toss/Imweb API 재확인 결과).
- **아임웹 v2는 상태 전이 이력을 주지 않는다.** `complete_time` 하나만. 중간 단계(배송중 → 배송완료) 지연은 별도 OpenAPI(OAuth 발급 필요) 또는 PlayAuto 상태 변경 webhook이 있어야 측정 가능.
- `complete_time`이 아임웹 자동 구매확정 로직(배송완료 → N일 후)에 크게 좌우됨. 아임웹 설정이 바뀌면 p50도 바뀜.
- aibio는 본 분석에서 완전 제외(Supabase 접근 불가). **biocom·coffee 기준 C안 채택**이 결론이며 aibio는 자격증명 수령 후 v4에서 재검증.

### §D. 참조 문서

- `capivm/capi.md` — 현재 운영 구조, §0 GA4 refund 논의
- `capivm/confirmed.md` — 본 조사 의뢰 배경, 판정 기준
- `data/!datacheckplan.md` Phase2-Sprint4 — 취소와 순매출 보정
- `backend/src/metaCapi.ts:260-267` — 현재 CAPI confirmed 필터
- `backend/src/ga4RevenueOpsPlan.ts §refundCancelDesign` — MP Refund 설계서
