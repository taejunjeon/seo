# Data Check Plan

작성 시각: 2026-04-17 19:05 KST
최종 업데이트: 2026-04-20 12:29 KST
기준일: 2026-04-17
문서 성격: 가변형 기준 문서
참조 고정 스냅샷: `data/datacheck0406.md`, `data/datacheck0415.md`, `운영db.md`, `capivm/capi.md`
참조 증거 저장소: `data/roasphase.md` (2026-04-12 기준 Meta ROAS / CAPI dedup / 식별자 품질 / campaign alias의 주문 단위 증거)

이 문서는 데이터 정합성 프로젝트의 현재 기준판이다.
`datacheck0406.md`와 `datacheck0415.md`는 그날의 상태를 고정해 둔 사진이고, 이 문서는 개발이 진행될 때마다 계속 바뀌는 작업 지도다.
`roasphase.md`는 ROAS 정합성 서브주제의 깊은 증거(구체 주문번호, event_id, Meta purchase 수치)를 담은 2026-04-12 기준 스냅샷이다. 이 문서의 Sprint3/4/6은 `roasphase.md`의 Phase 3/4/5/6과 주제가 이어지며, 세부 증거가 필요할 때 해당 문서를 source로 본다.

---

## 10초 요약

현재 목표는 `어떤 광고와 어떤 고객 행동이 실제 확정 매출을 만들었는지`를 시스템끼리 같은 숫자로 말하게 만드는 것이다.
Toss, Imweb, attribution ledger, Meta CAPI는 운영 판단에 쓸 만큼 올라왔지만, GA4 `(not set)`, 취소/환불 보정, sync 감사 로그는 아직 덜 닫혔다.
더클린커피 GA4 NPAY 65건은 확인했지만, 현재 네이버 커머스 API 자격 증명은 바이오컴 주문 원장만 열려 더클린커피 네이버 주문 원장 대사는 권한 확보 전까지 닫을 수 없다.
현재 전체 완성도는 **67%**로 본다. 코드와 로컬 검증 기준은 **82%**, 운영에서 매일 믿고 보는 기준은 **63%**다.

쉬운 비유로 말하면, 지금은 여러 가게의 장부를 한 권으로 맞추는 작업이다.
계산기는 생겼지만, 몇 장부는 아직 날짜가 밀려 있고, GA4 장부는 손님이 어디서 왔는지 빈칸이 많다.

---

## 문서 목적

이 문서는 데이터 정합성 프로젝트의 목적, 현재 완성도, 남은 병목, 다음 실행 순서를 TJ, Codex, Claude Code가 같은 기준으로 보게 만든다.

---

## 이 작업이 하는 일

이 작업은 `광고 클릭 -> 사이트 행동 -> 주문 생성 -> 결제 확정 -> 취소/환불 -> 재구매`를 한 줄로 이어 보는 일이다.

각 시스템의 역할은 아래처럼 나눈다.

| 시스템 | 믿는 역할 | 조심할 점 |
|---|---|---|
| Toss | 결제 완료, 취소, 정산 수수료 | 고객 식별자와 광고 유입 정보는 약함 |
| Imweb | 주문, 회원, 구매확정 보조 | `CANCEL` 금액은 가상계좌 미입금 때문에 과장될 수 있음 |
| PlayAuto | 배송 상태, 전 채널 OMS 상태, 수동 주문 | sync가 멈추면 구매확정/배송 상태가 한 번에 stale 됨 |
| GA4 | 세션, 유입, 행동 흐름 | `(not set)`과 refund 미구현 때문에 매출 정본으로 쓰면 위험 |
| Attribution Ledger | 우리 기준의 결제 관측 장부 | `pending`과 `confirmed`를 반드시 분리해야 함 |
| Meta CAPI | Meta 학습용 서버 전환 | confirmed만 보내야 하고, 실제 환불 보정은 아직 남음 |

---

## 왜 필요한가

이 작업이 끝나야 아래 판단을 감이 아니라 숫자로 할 수 있다.

- Meta 광고비를 늘릴지 줄일지
- AIBIO, 바이오컴, 더클린커피 중 어디가 진짜 돈을 만들고 있는지
- 상담, 알림톡, 쿠폰, 재구매 캠페인이 실제 추가 매출을 만들었는지
- GA4와 Meta가 말하는 ROAS가 왜 내부 매출과 다른지
- 가상계좌 미입금, 어뷰저, 환불이 광고 성과를 얼마나 오염시키는지

---

## 현재 완성도

| 기준 | 완성도 | 해석 |
|---|---:|---|
| 전체 목표 기준 | **67%** | 운영 판단은 가능하지만, GA4 `(not set)` 원인 분해, refund 반영, 더클린커피 NPAY 원장 권한이 아직 덜 닫힘 |
| 코드/로컬 검증 기준 | **82%** | 주요 API, local SQLite, attribution ledger, CAPI guard, Imweb status 라벨링, source freshness script, NPAY 진단 스크립트가 상당 부분 구현됨 |
| 운영 기준 | **63%** | 운영 DB sync 감사, 일일 대사 책임자, GA4 raw query 루틴, 대시보드 경고 배지, 더클린커피 네이버 주문 원장 권한이 부족함 |
| GA4 `(not set)` 해결 기준 | **25%** | recent row에 식별자 유입은 시작됐지만, 원인별 분해표가 아직 없음 |
| 순매출/취소 보정 기준 | **55%** | Toss 기준 취소 해석은 가능하지만 GA4/Meta refund 전송은 미구현 |

현재 완성도를 낮게 잡는 이유는 명확하다.
`데이터가 있다`와 `운영자가 매일 믿고 같은 결론을 내린다`는 다른 단계다.

---

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 원천 데이터와 진실 소스 | Codex | 92% / 80% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 공통 키와 결제 원장 | Codex | 86% / 78% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | 주문-결제-구매확정 대사 | Codex | 82% / 66% | [[#Phase2-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | 취소와 순매출 보정 | Codex + Claude Code | 62% / 38% | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | GA4 `(not set)` 원인 분해 | TJ + Codex | 38% / 18% | [[#Phase3-Sprint5\|이동]] |
| Phase3 | [[#Phase3-Sprint6]] | 캠페인 매핑과 ROAS 기준 | Codex + Claude Code | 45% / 30% | [[#Phase3-Sprint6\|이동]] |
| Phase4 | [[#Phase4-Sprint7]] | sync 감사와 stale 경고 | Codex + Claude Code | 50% / 25% | [[#Phase4-Sprint7\|이동]] |
| Phase4 | [[#Phase4-Sprint8]] | 운영 루틴과 대시보드 | TJ + Claude Code | 60% / 42% | [[#Phase4-Sprint8\|이동]] |
| Phase5 | [[#Phase5-Sprint9]] | NPay return 누락 감사 + 제거 A/B | Claude + TJ | 10% / 0% | [[#Phase5-Sprint9\|이동]] |

---

## 현재 기준 판단

### 확인된 것

- Toss는 매출과 취소 판단의 1순위다.
- Attribution ledger는 `pending`, `confirmed`, `canceled`를 나눌 수 있다.
- Meta CAPI는 confirmed 기준으로 보내는 구조가 잡혔다.
- Imweb v2 status로 `PURCHASE_CONFIRMATION`을 직접 라벨링할 수 있다.
- Imweb `CANCEL` 금액은 그대로 취소 금액으로 쓰면 안 된다.
- GA4 purchase는 우리 footer snippet이 직접 쏘는 것이 아니라 biocom GTM에서 발화된다.
- `tb_playauto_orders`는 2026-04-17 18:51 KST 확인 기준 3/13 정지 상태에서 벗어났다.
- thecleancoffee BigQuery raw export는 2026-04-19 09:41 KST 확인 기준 서비스 계정 read-only 조회가 된다.
- 네이버 커머스 API `BIOCOM_STORE_APP_ID/BIOCOM_STORE_APP_SECRET`는 OAuth SELF 토큰 발급과 주문 조회 API가 정상이다. 다만 현재 권한은 바이오컴 스토어 주문 원장 범위다.
- 더클린커피 GA4 `20260412~20260417` NPAY purchase는 65건, gross `2,630,700원`이다. 현재 네이버 커머스 API 권한으로는 이 65건을 더클린커피 네이버 주문 원장과 직접 대사할 수 없다.

### 아직 안 된 것

- GA4 `(not set)`을 원인별로 나눈 표가 없다.
- biocom BigQuery raw export의 기존 `hurdlers-naver-pay` dataset 상태가 아직 닫히지 않았다.
- GA4 refund 또는 Measurement Protocol refund 전송이 없다.
- Meta CAPI refund 보정도 없다.
- 더클린커피 네이버 커머스 API 앱 또는 판매자 권한이 없다. 현재 자격 증명으로 더클린커피 주문번호를 조회하면 `400 / 101010 / 처리권한이 없는 주문번호를 요청했습니다`가 반환된다.
- `purchase-confirm-stats`의 CANCEL 서브카테고리 분리가 대시보드까지 닫히지 않았다.
- `tb_operation_log`에는 sync 기록이 여전히 없다. `domain=restock`만 확인된다.
- 2026년 1~3월 바이오컴 공동구매 내역은 Codex가 `공동구매내역.md`에서 로컬 산출치로 정리했다. 기준값은 공동구매성 주문 `1,668건`, 주문 매출 `512,906,191원`이다. 이 값은 회사에서 별도로 뽑은 공동구매 내역과 아직 대사하지 않았다.

### 지금 가장 큰 병목

첫 번째 병목은 biocom GA4 raw event를 아직 보지 못해 `(not set)` 원인을 추측으로만 좁히는 것이다.
두 번째 병목은 더클린커피 NPAY를 닫을 네이버 판매자 권한이 아직 없다는 것이다.
세 번째 병목은 운영 DB sync가 실패해도 바로 알 수 없는 것이다.
네 번째 병목은 취소/환불이 GA4와 Meta에 뒤늦게 반영되지 않는 것이다.

---

#### Phase1-Sprint1

**이름**: 원천 데이터와 진실 소스

### 목표

각 숫자를 어느 시스템에서 믿을지 고정한다.
매출은 Toss, 주문과 회원은 Imweb, 배송과 전 채널 OMS 상태는 PlayAuto, 유입은 GA4, 서버 전환은 attribution ledger와 CAPI로 본다.

### 현재 상태

사실:
- Toss transactions와 settlements는 local SQLite에 충분히 쌓였다.
- Imweb orders와 members는 3사이트 기준으로 운영 판단이 가능한 수준까지 올라왔다.
- thecleancoffee와 aibio BigQuery raw export는 새 프로젝트에 연결됐다.
- thecleancoffee BigQuery는 GA4 화면과 로컬 서비스 계정 조회 기준이 일치한다. property ID는 `326949178`, stream ID는 `3970736456`, measurement ID는 `G-JLSBXX7300`, project ID는 `project-dadba7dd-0229-4ff6-81c`, project number는 `269220955383`, dataset은 `analytics_326949178`, 기본 위치는 `asia-northeast3`, 만든 사람은 `biocom015@gmail.com`, 작성일은 `2026-04-07`이다.
- 2026-04-19 09:41 KST read-only 확인에서 `analytics_326949178` dataset과 `events_*` 테이블 조회가 됐다. 테이블은 `events_20260407`부터 `events_20260417`까지 11개가 보였고, 최신 daily export는 `events_20260417`이다.
- thecleancoffee 최근 raw sanity check 기준 `20260412~20260417` 합계는 `total_events=14,821`, `purchase=123`, `distinct_purchase_transaction_ids=123`, `missing_user_pseudo_id=0`, 최신 이벤트 시각은 `2026-04-17 23:23:45 KST`다.
- 네이버 커머스 API는 현재 `BIOCOM_STORE_APP_ID/BIOCOM_STORE_APP_SECRET`로 OAuth SELF 토큰 발급, `last-changed-statuses`, `product-orders/query`, `orders/{orderId}/product-order-ids` 조회가 된다.
- 같은 자격 증명으로 바이오컴 네이버 주문번호는 조회되지만, 더클린커피 Imweb cache의 네이버 주문번호 샘플 5건은 모두 `400 / 101010 / 처리권한이 없는 주문번호를 요청했습니다`로 막혔다.
- biocom BigQuery raw export는 기존 `hurdlers-naver-pay` 링크 확인이 남았다.
- `tb_playauto_orders`는 0415 스냅샷 기준 정지였지만, 0417 확인 기준 `120,582행`, 최신 주문 `2026-04-16 17:54:02`, 최신 sync `2026-04-16 20:00:12`까지 복구됐다.
- `backend/scripts/check-source-freshness.ts`로 Toss, Imweb, PlayAuto, attribution ledger, thecleancoffee GA4 BigQuery 최신성 점검 스크립트를 만들었다. 2026-04-19 09:41 KST 실행 기준 운영 Toss와 PlayAuto, thecleancoffee BigQuery는 `fresh`, 로컬 Toss, Imweb, attribution ledger는 `stale`이다.

현재 판단:
- 원천 확보는 많이 좋아졌다.
- thecleancoffee는 GA4 property 접근과 BigQuery raw table sanity check가 모두 정상이다.
- 네이버 커머스 API 연결 자체는 정상이다. 다만 더클린커피 NPAY 원장 확인에는 현재 바이오컴 범위 자격 증명이 아니라 더클린커피 판매자 권한 또는 별도 앱 자격 증명이 필요하다.
- PlayAuto는 2026-04-18 자동 sync까지 재확인됐다. 다만 실패 알림과 operation log가 생겼는지는 아직 증명되지 않았다.

### 역할 구분

- TJ: biocom BigQuery legacy dataset 접근 권한과 허들러스 확인을 진행한다.
- Codex: 각 원천별 최신성 쿼리와 staleness 기준을 고정한다.
- Claude Code: 대시보드에 "어느 원천을 믿는가" 문구와 stale 배지를 붙인다.

### 실행 단계

1. [TJ] 허들러스에 `hurdlers-naver-pay` dataset 존재 여부와 최근 `events_*` 적재 여부 확인을 요청한다. 의존성: biocom GA4 raw export 판단의 선행필수.
2. [Codex] PlayAuto가 2026-04-18에도 자동 sync되는지 `MAX(synced_at)`로 재확인한다. 의존성: 병렬가능. 완료: 2026-04-19 09:41 KST 기준 `tb_playauto_orders` 최신 sync는 `2026-04-18 20:00:08 KST`다.
3. [Codex] source별 최신성 체크 쿼리를 하나의 점검 스크립트로 묶는다. 의존성: 부분병렬. 완료: `backend/scripts/check-source-freshness.ts`로 Toss, Imweb, PlayAuto, attribution ledger, thecleancoffee GA4 BigQuery 점검을 묶었다. 실행법은 `cd backend && npx tsx scripts/check-source-freshness.ts`다. biocom GA4 raw export 항목은 1번 결과가 들어온 뒤 추가한다.
4. [Claude Code] `/ads`와 `/crm`에 "데이터 기준 시각" 배지를 붙인다. 의존성: 부분병렬. 화면 자리와 문구는 먼저 만들 수 있지만, 최종 source별 배지 값과 경고 기준은 3번 점검 스크립트의 필드명이 확정된 뒤 연결한다.
5. [TJ] 더클린커피 네이버 커머스 API 앱 권한 또는 판매자 센터 API 권한을 확보한다. 의존성: 더클린커피 NPAY 원장 대사의 선행필수.
6. [Codex] 더클린커피 권한 확보 후 `backend/scripts/reconcile-coffee-ga4-naverpay.py`를 재실행해 GA4 NPAY 65건을 네이버 주문 원장과 닫는다. 의존성: 부분병렬. 스크립트와 GA4 원장 추출은 준비됐지만, 실제 네이버 원장 대사는 5번 권한이 필요하다.

### 완료 기준

- 5개 원천(Toss, Imweb, PlayAuto, GA4, attribution ledger)의 최신성이 한 화면에서 보인다.
- biocom BigQuery raw export 유지/이관 판단이 끝난다.
- PlayAuto sync가 3일 연속 정상 갱신되는지 확인된다.

### 우리 프로젝트에 주는 도움

어느 숫자를 믿어야 하는지 매번 다시 토론하지 않아도 된다.
광고비와 CRM 실험 판단의 기준 숫자가 흔들리지 않는다.

---

#### Phase1-Sprint2

**이름**: 공통 키와 결제 원장

### 목표

같은 주문과 같은 고객을 시스템마다 같은 대상으로 보게 만든다.
핵심 키는 `order_id_base`, `payment_key`, `normalized_phone`, `client_id`, `user_pseudo_id`, `ga_session_id`다.

### 현재 상태

사실:
- Attribution ledger는 `payment_status`를 가지고 있다.
- `WAITING_FOR_DEPOSIT`는 pending으로 남기고 메인 ROAS와 CAPI에서는 제외하는 방향이 잡혔다.
- recent payment_success와 form_submit row에는 GA 식별자가 일부 들어오기 시작했다.
- Meta CAPI는 confirmed 기준으로 보내는 구조가 있다.

현재 판단:
- 결제 원장은 운영 판단에 쓸 수 있다.
- 다만 GA4 raw event와 직접 붙이는 단계는 아직 약하다.

### 역할 구분

- TJ: 운영에서 `pending`을 매출로 보지 않는 기준을 승인한다.
- Codex: ledger의 공통 키 누락률과 상태 전이 결과를 매일 계산한다.
- Claude Code: `pending`, `confirmed`, `canceled`를 화면에서 혼동하지 않게 문구를 정리한다.

### 실행 단계

1. [Codex] `caller-coverage`를 site/source별로 매일 기록한다.
2. [Codex] `sync-status/toss` 결과에서 `pending -> confirmed/canceled` 전이를 요약한다.
3. [Claude Code] ROAS 카드에 `confirmed_revenue` 기준임을 명확히 표시한다.
4. [TJ] 운영자가 pending 금액을 메인 매출로 해석하지 않도록 기준을 공유한다.

### 완료 기준

- 메인 매출, ROAS, CAPI는 confirmed 기준으로만 계산된다.
- pending은 별도 KPI로만 보인다.
- GA 식별자 누락률이 날짜별로 추적된다.

### 우리 프로젝트에 주는 도움

가상계좌 미입금과 실제 결제 완료를 섞지 않는다.
Meta 학습과 내부 ROAS가 가짜 매출로 부풀지 않는다.

---

#### Phase2-Sprint3

**이름**: 주문-결제-구매확정 대사

연관 증거: `data/roasphase.md` Phase 4 (CAPI / Pixel dedup 검증) — 카드 confirmed, 가상계좌 pending 주문 단위 event_id 기록.

### 목표

주문이 실제 결제됐는지, 배송/구매확정 상태가 어디까지 갔는지 교차 확인한다.

### 현재 상태

사실:
- Imweb v2 status 라벨링으로 biocom `PURCHASE_CONFIRMATION`을 직접 읽을 수 있다.
- `datacheck0415.md` 기준 biocom 라벨링 커버리지는 94.4%였다.
- PlayAuto는 0417 확인 기준 백필이 들어왔고, 3/14 이후 `구매결정 2,457건`, `배송완료 2,361건`이 확인됐다.
- PlayAuto는 배송 상태와 전 채널 OMS 상태를 가진다.
- 더클린커피 GA4 `20260412~20260417` purchase는 123건, gross `5,588,498원`이다. 이 중 Toss confirmed와 transaction_id 기준으로 맞는 건은 51건이며 GA4 gross와 Toss confirmed/net 합계 차이는 `0원`이다.
- 같은 기간 GA4 NPAY purchase는 65건, gross `2,630,700원`이다. `backend/scripts/reconcile-coffee-ga4-naverpay.py`로 네이버 커머스 API와 대사했으나 현재 API 권한은 바이오컴 스토어 범위라 unique match는 0건이다.
- 현재 네이버 API 권한으로 조회된 `2026-04-12~2026-04-17` 결제창 주문은 63건, gross `5,273,000원`이지만 상품명/주문 접근 범위상 바이오컴 주문 원장이다. 더클린커피 GA4 NPAY 원장으로 쓰면 안 된다.
- 로컬 Imweb cache 보조 매칭은 더클린커피 NPAY prefix 후보 48건 중 금액 유일 매칭 7건, gross `245,400원`까지만 잡힌다. 이는 원장 대사가 아니라 보조 신호다.

현재 판단:
- PlayAuto가 복구되면 Imweb `PURCHASE_CONFIRMATION`은 primary가 아니라 cross-check로 쓰는 것이 맞다.
- PlayAuto가 stale이면 Imweb status를 임시 primary로 쓰되, 아임웹 경유 주문만 커버한다는 배지를 붙여야 한다.
- 더클린커피 NPAY 65건은 GA4 쪽 분모가 확정됐고, Toss 카드성 결제와 분리도 끝났다. 남은 일은 더클린커피 네이버 주문 원장 권한을 확보해 같은 기간 원장과 직접 맞추는 것이다.

### 역할 구분

- TJ: PlayAuto 복구가 revenue 팀에서 지속 운영되는지 확인한다.
- Codex: PlayAuto `구매결정`과 Imweb `PURCHASE_CONFIRMATION` delta를 계산한다.
- Claude Code: 구매확정 카드에 primary/backup 상태를 표시한다.

### 실행 단계

1. [Codex] PlayAuto와 Imweb 구매확정 비교 쿼리를 만든다.
2. [Codex] site별 delta 허용 범위를 정한다.
3. [Claude Code] `/ads` 또는 `/crm`에 구매확정 cross-check 카드를 붙인다.
4. [TJ] delta가 큰 날은 어느 원천을 기준으로 볼지 운영 판단을 확정한다.
5. [TJ] 더클린커피 네이버 커머스 API 조회 권한을 현재 개발 환경에서 사용할 수 있게 한다. 의존성: NPAY 원장 대사의 선행필수.
6. [Codex] 권한 확보 후 `backend/scripts/reconcile-coffee-ga4-naverpay.py --startSuffix=20260412 --endSuffix=20260417`로 GA4 NPAY 65건을 네이버 주문 원장과 재대사한다. 의존성: 부분병렬. GA4 NPAY 추출과 스크립트는 완료됐지만, 실제 원장 close는 5번 권한이 필요하다.

### 완료 기준

- PlayAuto 정상 시 primary=PlayAuto, backup=Imweb 규칙이 화면과 문서에 반영된다.
- PlayAuto stale 시 primary=Imweb 임시 전환과 커버리지 배지가 보인다.
- delta가 임계값을 넘으면 경고가 뜬다.
- GA4 NPAY 65건이 더클린커피 네이버 주문 원장 기준으로 matched, unmatched, canceled/refunded 후보로 나뉜다.

### 우리 프로젝트에 주는 도움

구매확정 매출과 재구매 코호트가 한 달 밀리는 일을 막는다.
운영자가 숫자의 기준 원천을 바로 알 수 있다.

---

#### Phase2-Sprint4

**이름**: 취소와 순매출 보정

### 목표

가상계좌 미입금, 실제 취소, 부분 취소, legacy 불명확 주문을 나눠서 순매출을 계산한다.

### 현재 상태

사실:
- Imweb `CANCEL` 금액은 실제 취소 금액보다 크게 과장된다.
- `datacheck0415.md` 기준 Imweb CANCEL은 약 10.6억으로 보였지만, Toss 기준 실제 취소율은 약 7.3% 수준이었다.
- 원인은 가상계좌 미입금 만료, Toss DONE but Imweb CANCEL, legacy 주문이 섞인 것이다.
- GA4 refund는 아직 구현되지 않았다.
- `capivm/capi.md` 기준 권장 방향은 A(BI 보정) 즉시, C(MP refund) 2주 내, B(GTM purchase 조건 차단) 금지다.

현재 판단:
- GA4 원본 purchase를 줄이는 방식은 하지 않는다.
- 먼저 BI/대시보드에서 net을 보정하고, 실제 결제 후 취소만 GA4/Meta refund로 보낸다.

### 역할 구분

- TJ: GA4 Measurement Protocol API secret 발급 여부를 결정한다.
- Codex: CANCEL 서브카테고리와 refund diff 배치를 구현한다.
- Claude Code: `/ads`에 gross와 net의 차이를 설명하는 UI를 붙인다.

### 실행 단계

1. [Codex] `purchase-confirm-stats`에서 CANCEL을 `actual_canceled`, `vbank_expired`, `partial_canceled`, `legacy_uncertain`으로 분리한다.
2. [Claude Code] `/ads` 카드에 Imweb 보정 net과 vbank expired를 별도 표시한다.
3. [TJ] GA4 MP API secret을 발급한다. 의존성: GA4 refund 실제 전송의 선행필수.
4. [Codex] Toss 상태 전이 diff에서 실제 refund만 GA4 Measurement Protocol로 보낸다. 의존성: 부분병렬. refund 대상 diff와 dry-run은 먼저 만들 수 있지만, GA4 MP 실제 전송은 3번 secret이 필요하다.
5. [Codex] 같은 diff에서 Meta CAPI Refund 설계를 확정한다. 의존성: 병렬가능. Meta refund 설계는 GA4 MP API secret과 독립적으로 진행할 수 있다.

### 완료 기준

- 대시보드의 순매출은 실제 취소만 반영한다.
- 가상계좌 미입금은 매출 취소가 아니라 결제 시도 후 포기로 분리된다.
- GA4와 Meta에 실제 환불이 따라간다.

### 우리 프로젝트에 주는 도움

광고 ROAS가 취소 전 gross로 부풀지 않는다.
어뷰저와 가상계좌 미입금이 매체 학습을 오염시키는 일을 줄인다.

---

#### Phase3-Sprint5

**이름**: GA4 `(not set)` 원인 분해

연관 증거: `data/roasphase.md` Phase 3 (식별자 품질 / checkout_started) — `fbclid -> _fbc`, `_fbp`, `checkout_id`, GA 3종 식별자 보존 테스트 결과와 새 푸터 운영 기록.

### 목표

GA4에서 구매 매출의 source/medium/campaign이 `(not set)`으로 잡히는 이유를 원인별로 나눈다.
목표는 `(not set)`을 0으로 만드는 것이 아니라, 어떤 몫이 구조 문제이고 어떤 몫이 태그 문제인지 잡아내는 것이다.

### 현재 상태

사실:
- `datacheck0406.md` 기준 2026-03-01~2026-03-30 GA4 `(not set)` 구매는 896건, 매출은 약 1.485억이었다.
- recent attribution ledger row에는 `ga_session_id`, `client_id`, `user_pseudo_id` 유입이 시작됐다.
- biocom GA4 purchase는 우리 footer snippet이 직접 쏘지 않는다. 실제 purchase는 biocom GTM에서 발화된다.
- biocom payment page에는 `GTM-W7VXS4D8 ... includes` 오류가 관찰됐다.
- biocom BigQuery raw export는 legacy link 확인이 아직 끝나지 않았다.

현재 판단:
- `(not set)`의 원인을 footer caller 전체 부재로 보면 틀릴 가능성이 높다.
- 지금 유력한 원인은 historical row, payment complete 페이지 세션 손실, GTM purchase 태그 품질, legacy raw export 미확인, 중복 purchase tag다.

### 원인 가설과 검증 방법

| 가설 | 확인 방법 | 닫히는 기준 |
|---|---|---|
| historical row가 대부분이다 | 2026-04-08 fetch-fix 전후로 `(not set)` 비율을 분리 | fix 이후 비율이 유의미하게 낮아짐 |
| 결제 완료 페이지에서 세션/캠페인 정보가 끊긴다 | BigQuery raw에서 `transaction_id`, `ga_session_id`, `user_pseudo_id`, `page_referrer`, `session_source`를 함께 조회 | purchase event의 session source가 비는 조건 확인 |
| GTM purchase 태그가 campaign 값을 못 싣는다 | W2/W7 Preview, DebugView, event_params 비교 | purchase payload의 source/medium/campaign 누락 위치 확인 |
| W7 custom script 오류가 payment page 태그 품질을 흔든다 | 오류 수정 전후 같은 날짜/상품군 `(not set)` 비율 비교 | 오류 제거 후 payment page console clean |
| 중복 purchase tag가 일부 blank row를 만든다 | GA4 purchaseEvents와 distinctTransactionIds 차이, raw transaction_id 중복 조회 | blank sender와 canonical sender 분리 |
| biocom raw export 부재로 원인 확인이 막힌다 | `hurdlers-naver-pay` dataset 접근 또는 새 export 연결 | raw event sanity query 가능 |

### 역할 구분

- TJ: biocom BigQuery raw dataset 접근 권한을 확보한다.
- Codex: raw query와 Data API fallback 진단 쿼리를 만든다.
- Claude Code: `(not set)` 진단 결과를 대시보드에 원인별 막대로 보여준다.

### 실행 단계

1. [TJ] `hurdlers-naver-pay`의 biocom raw export 접근 가능 여부를 확인한다. 의존성: biocom raw event 실제 조회의 선행필수.
2. [Codex] BigQuery raw query 초안을 만든다. 의존성: 부분병렬. query 초안과 파라미터 구조는 먼저 만들 수 있지만, biocom 실제 실행과 결과 해석은 1번 접근 확인이 필요하다.
   a. `transaction_id`별 purchase event
   b. 같은 `user_pseudo_id + ga_session_id`의 session_start
   c. `collected_traffic_source`와 `session_traffic_source_last_click`
   d. `page_location`, `page_referrer`, `ignore_referrer`
3. [Codex] BigQuery 접근 전 fallback으로 GA4 Data API 진단을 만든다. 의존성: 병렬가능. 1번 raw export 접근과 독립적으로 만들 수 있다.
4. [Codex] `/api/attribution/hourly-compare`, `/api/attribution/caller-coverage`, `/api/crm-phase1/ops`를 같은 날짜 범위로 묶는다.
5. [Claude Code] 원인별 비율 표를 `/ads` 또는 `/tracking-integrity`에 표시한다.
6. [TJ] 원인표를 보고 GTM 수정, BigQuery 이관, 운영 보정 중 무엇을 먼저 할지 결정한다.

### 완료 기준

- `(not set)` 매출이 원인 카테고리별로 나뉜다.
- 최소 카테고리는 `historical`, `session_lost`, `tag_payload_missing`, `duplicate_sender`, `raw_export_unknown`이다.
- 원인 합계가 전체 `(not set)` 구매의 90% 이상을 설명한다.

### 우리 프로젝트에 주는 도움

GA4가 왜 틀렸는지 감으로 말하지 않는다.
광고비 판단에서 GA4를 어디까지 참고할지 명확해진다.

---

#### Phase3-Sprint6

**이름**: 캠페인 매핑과 ROAS 기준

연관 증거: `data/roasphase.md` Phase 5 (Campaign-level ROAS / alias review), Phase 6 (같은 기준 ROAS 비교 뷰) — 연뜰살뜰/현서/송율 manual verified alias, `landingUrl=null` 광고 목록, Meta `1d_click` headline 기준 확정 근거.

### 목표

Meta 캠페인 이름, UTM, attribution ledger 주문, 내부 매출을 같은 캠페인으로 묶는다.

### 현재 상태

사실:
- `/ads`의 메인 ROAS는 Attribution 기준으로 보는 방향이 잡혔다.
- Meta confirmed attribution 주문 일부가 `(unmapped)`로 떨어진다.
- ad creative의 landingUrl만으로는 매핑이 부족하다.

현재 판단:
- 자동 fuzzy matching보다 file-based alias seed와 사람 검증이 먼저다.
- campaign_id, adset name, ad name, 운영 시작일을 같이 봐야 한다.

### 역할 구분

- TJ: 주요 캠페인 alias 후보를 사람 기준으로 승인한다.
- Codex: alias seed와 matcher를 구현한다.
- Claude Code: 캠페인별 ROAS 카드에 mapped/unmapped 비율을 표시한다.

### 실행 단계

1. [Codex] Meta campaign audit 결과에서 alias 후보를 정리한다.
2. [TJ] `manual_verified` 후보만 승인한다. 의존성: 운영 매핑 확정의 선행필수.
3. [Codex] `valid_from`, `valid_to`, `confidence`를 가진 matcher를 붙인다. 의존성: 부분병렬. matcher 구조와 테스트 fixture는 먼저 만들 수 있지만, 운영 alias 적용은 2번 승인 후보만 사용한다.
4. [Claude Code] `/ads`에 unmapped 매출과 mapped 매출을 분리 표시한다. 의존성: 부분병렬. 화면 구조는 먼저 만들 수 있지만, mapped 값은 3번 matcher 결과가 필요하다.
5. [Codex/TJ] `공동구매내역.md`의 로컬 산출치와 회사 추출본을 대사한다. 의존성: 부분병렬. Codex는 로컬 기준표와 비교 템플릿을 먼저 만들 수 있고, 최종 일치 판정은 회사 추출본 수령 뒤 가능하다. 비교 기준은 `주문번호 / 주문일 / 파트너명 또는 공구명 / 상품명 / 결제금액 / 취소 여부`다. 차이는 `비공개 URL`, `공구 단어 없는 파트너 상품명`, `쿠폰 기반`, `주문 헤더 금액`, `2026-01-01~01-07 헤더 누락` 중 하나로 분류한다.

### 완료 기준

- 최근 7일 Meta attribution 주문의 80% 이상이 campaign_id로 매핑된다.
- unmapped 주문은 별도 큐로 남는다.
- ROAS 카드는 Attribution 기준과 Meta platform 기준을 혼동하지 않는다.
- 공동구매 로컬 산출치와 회사 추출본의 주문수·매출 차이가 설명 가능해진다.

### 우리 프로젝트에 주는 도움

캠페인 예산 증감 판단이 계정 단위가 아니라 캠페인 단위로 가능해진다.

---

#### Phase4-Sprint7

**이름**: sync 감사와 stale 경고

### 목표

데이터가 언제까지 최신인지, sync가 실패했는지, 어떤 테이블이 stale인지 매일 자동으로 보이게 만든다.

### 현재 상태

사실:
- 운영 DB `tb_operation_log`는 2026-04-17 확인 기준 `domain=restock`만 있다.
- playauto/sync 관련 operation log는 0건이다.
- PlayAuto 데이터 자체는 백필됐지만, 실패 알림과 감사 로그는 아직 개선되지 않았다.

현재 판단:
- 데이터 복구와 운영 관측성 개선은 별도다.
- 지금 상태에서는 같은 문제가 다시 생겨도 사람이 직접 쿼리하기 전까지 모를 수 있다.

### 역할 구분

- TJ: revenue 팀에 sync 실패 알림과 operation log 확장을 요청한다.
- Codex: seo VM에 얇은 mirror sync log를 만든다.
- Claude Code: stale 경고 배지를 `/ads` 상단에 표시한다.

### 실행 단계

1. [TJ] revenue 팀에 `sync_playauto`, `sync_naver`, `sync_coupang`, `sync_iamweb`, `sync_toss` 로그 추가를 요청한다. 의존성: 운영 DB 감사 로그 확장의 선행필수.
2. [Codex] seo local DB에 `mirror_sync_log`를 만든다. 의존성: 병렬가능. local mirror log는 revenue 팀의 operation log 추가와 독립적으로 만들 수 있다.
3. [Codex] PlayAuto, Naver, Coupang, Toss, Imweb의 max timestamp를 읽어 staleness를 계산한다. 의존성: 병렬가능. max timestamp read-only 계산은 1번 운영 로그 확장 전에도 가능하다.
4. [Claude Code] warn/stale/down 상태를 대시보드에 표시한다. 의존성: 부분병렬. 화면 자리와 문구는 먼저 만들 수 있지만, 실제 상태 값은 3번 계산 결과가 필요하다.
5. [Codex] Slack 또는 대체 알림 경로가 생기면 실패 시 알림을 연결한다.

### 완료 기준

- sync 실패가 조용히 묻히지 않는다.
- 각 원천의 최신 데이터 시각이 화면에 표시된다.
- PlayAuto가 72시간 이상 stale이면 대시보드가 경고한다.

### 우리 프로젝트에 주는 도움

한 달 동안 데이터가 멈췄는데 아무도 모르는 상황을 막는다.

---

#### Phase4-Sprint8

**이름**: 운영 루틴과 대시보드

### 목표

데이터 정합성 확인을 개발자만 할 수 있는 쿼리가 아니라 운영자가 매일 보는 루틴으로 만든다.

### 현재 상태

사실:
- 여러 API와 문서는 존재한다.
- 하지만 매일 누가 무엇을 보고, 어떤 기준이면 이상으로 판단할지는 아직 완전히 고정되지 않았다.
- `/ads`, `/crm`, `/tracking-integrity`에 지표가 흩어져 있다.

현재 판단:
- 다음 단계는 새 원천 추가가 아니라 운영 루틴 고정이다.
- 대표와 운영자가 30초 안에 위험 지점을 볼 수 있어야 한다.

### 역할 구분

- TJ: 매일 볼 핵심 지표 5개를 승인한다.
- Codex: API 응답을 안정화하고 계산 기준을 문서화한다.
- Claude Code: 대시보드 카드와 경고 문구를 정리한다.

### 실행 단계

1. [TJ] 매일 볼 지표를 승인한다. 의존성: 운영 요약 카드의 최종 범위 확정에 선행필수.
   a. confirmed revenue
   b. pending virtual account amount
   c. actual canceled amount
   d. GA4 `(not set)` rate
   e. source staleness
2. [Codex] 위 5개 지표를 한 API 응답으로 묶는다. 의존성: 부분병렬. API 틀과 기존 5개 후보의 계산은 먼저 만들 수 있지만, 운영 고정 지표는 1번 승인 후 확정한다.
3. [Claude Code] `/ads` 상단에 데이터 정합성 요약 카드 5개를 배치한다. 의존성: 부분병렬. 카드 레이아웃은 먼저 만들 수 있지만, 최종 카드 이름과 순서는 1번 승인 결과를 따른다.
4. [TJ] 3일 동안 실제 숫자를 보고 기준을 조정한다.

### 완료 기준

- 운영자가 하루 한 번 화면만 보고 주요 데이터 위험을 판단할 수 있다.
- 쿼리 없이도 stale, pending, cancel, `(not set)` 경고를 본다.
- 이상 발생 시 다음 액션이 문구로 같이 보인다.

### 우리 프로젝트에 주는 도움

데이터 정합성이 프로젝트 문서 안에 머무르지 않고 실제 운영 판단에 들어간다.

---

#### Phase5-Sprint9

**이름**: NPay return 누락 감사 + 제거 A/B

### 목표

네이버페이 결제 완료 후 biocom.kr 로 리턴되지 않아 client-side GA4/Meta purchase 이벤트가 누락되는 구조 이슈를 정량화하고, NPay 버튼 제거 또는 server-side 보정 중 의사결정 근거 마련.

### 현재 상태

사실:
- 2026-04-21 00:47 KST GTM Preview Run 2 에서 **NPay 실제 결제 후 biocom.kr 복귀 안 함** 확인
- `shop_payment_complete` URL 미도달 → [143]/[48]/[43]/[251] 전부 발사 기회 없음
- **GA4 purchase / Meta CAPI Purchase / Meta Pixel Purchase** 이벤트 NPay 결제분에서 미발사
- **Google Ads [248] `TechSol-NPAY구매`** 는 **버튼 클릭 시점**에 발사 = 실제 결제 완료 여부 반영 안 함 (과다집계 위험)
- Backend 서버 DB (`attribution_ledger`, `imweb_orders`, `toss_transactions`) 는 정상 수신 — 매출 집계는 불가 서비스 영향 없음
- TJ 가 **NPay 버튼 제거 옵션 검토 중**

현재 판단:
- NPay 매출 비중을 모르면 제거 결정 불가. 1순위는 비중 측정.
- 서버-사이드 GA4 MP 로 purchase 복구하는 것이 유일한 실행 가능 보정책 (아임웹 설정 수정 외)
- 원본 상세 분석 문서 분리: `/Users/vibetj/coding/seo/GA4/npay_return_missing_20260421.md`

### 역할 구분

- TJ: NPay 매출 비중 확인 후 제거/유지 결정 승인. 아임웹 관리자 NPay 설정 확인.
- Claude Code: 로컬 DB 기반 NPay 매출 비중 쿼리, server-side GA4 MP purchase fallback 구현 (필요 시).
- Codex: 확장 쿼리 (Gooogle Ads [248] 실제 집계 vs 서버 DB 차이).

### 실행 단계

1. [Claude Code] **NPay 매출 비중 쿼리** 실행 — 최근 30/60/90일 `imweb_orders.pay_type='npay'` 비율, gross/confirmed 금액. 의존성: 병렬가능.
2. [TJ] BigQuery 에서 GA4 raw `add_payment_info (pay_method=npay)` vs `purchase (pay_method=npay)` 이벤트 수 비교. 의존성: 병렬가능. 쿼리는 `/Users/vibetj/coding/seo/GA4/npay_return_missing_20260421.md` §4-2 참조.
3. [TJ] 아임웹 관리자 → 결제 → NPay 설정에서 **return URL / 결제완료 동작** 확인. 의존성: 병렬가능.
4. [TJ] **1/2/3 결과 종합 후 의사결정**: (a) NPay 유지 + server-side 보정, (b) NPay 제거 + A/B 비교, (c) 아임웹 설정 수정으로 return URL 정상화 요청. 의존성: 선행필수 (위 1~3 완료).
5. [의사결정 (a)] [Claude Code] `refundDispatcher` 패턴으로 `backend/src/services/npayPurchaseDispatcher.ts` 구현. `imweb_orders.pay_type=npay` 새 주문 감지 → GA4 MP purchase 전송 + Meta CAPI Purchase 전송 (`event_id` dedup 고려). 의존성: 선행필수.
6. [의사결정 (b)] [TJ] NPay 버튼 제거 배포 → 2주 후 시계열 비교 (전체 매출 / 결제수단 분포 / 전환율 변화). 의존성: 선행필수. Rollback 기준 사전 설정 — 주간 매출 10% 이상 감소 시 복귀.

### 완료 기준

- NPay 결제 누락 비중이 정량화 (매출 대비 %)
- TJ 의사결정 (a / b / c) 결정
- 결정 방향에 따른 구현 / 배포 완료
- Publish / 제거 후 2주간 회귀 관측 지표 대시보드 제공

### 우리 프로젝트에 주는 도움

NPay 결제가 GA4 revenue 와 Meta ROAS 에서 보이지 않는 암흑을 밝히거나, 근본 제거로 데이터 정합성을 단순화. Google Ads 자동입찰이 실제 purchase 가 아닌 버튼 클릭으로 학습하는 오염도 같이 해결.

---

## GA4 not set 진단 기준

`(not set)`은 하나의 원인이 아니다.
아래 5개로 나눠서 잡아야 한다.

| 분류 | 설명 | 현재 상태 | 다음 확인 |
|---|---|---|---|
| historical | fetch-fix, CAPI guard, source guard 전 과거 row | 유력 | 2026-04-08, 2026-04-12, 2026-04-15 기준 전후 비교 |
| session lost | PG/결제완료 리다이렉트에서 세션 유입 정보가 끊김 | 유력 | BigQuery raw에서 purchase와 session_start 연결 |
| tag payload missing | GTM purchase payload가 source/medium/campaign을 못 실음 | 유력 | W2/W7 Preview와 DebugView 확인 |
| duplicate sender | 여러 purchase sender 중 하나가 빈 값으로 보냄 | 가능 | transaction_id별 sender/이벤트 중복 조회 |
| raw export unknown | biocom BigQuery raw 접근 부재로 확인이 막힘 | 확정 병목 | `hurdlers-naver-pay` 접근 또는 relink |

### GA4 not set 완료 기준

- `(not set)` 구매와 매출을 위 분류로 90% 이상 설명한다.
- fix 이후 신규 row의 `(not set)` 비율이 별도 추적된다.
- GA4 gross, attribution confirmed, Toss net의 차이를 한 화면에서 설명한다.
- GA4를 예산 판단의 primary로 쓸지, 보조지표로만 둘지 기준이 고정된다.

---

## 다음 액션

### 예약 — 2026-04-22 이후 (GA4 Unwanted Referrals 48h 대기)

2026-04-20 17:45 KST 에 biocom (`G-WJFXN5E2Q1`) + coffee (`G-JLSBXX7300`) GA4 Google 태그 구성에 **원치 않는 추천 7개 신규 추가** (`tosspayments.com` / `m.tosspayments.com` / `nicepay.co.kr` / `m.nicepay.co.kr` / `orders.pay.naver.com` / `new.kakaopay.com` / `pg.innopay.co.kr`). 기대 효과: 쿼리 2 에서 확인된 session_start_missing 1,158건(26%) — `(direct)` fallback 으로 잘못 분류된 PG 리다이렉트 세션의 원 UTM 복원. GA4 반영에 24~48h 필요.

1. [TJ] **2026-04-22 오후 이후** BQ Console 에서 아래 쿼리를 실행해 `(direct)_pct` 추이 확인. 의존성: 선행필수. GA4 반영 시간이 지난 뒤에 돌려야 의미 있다.
   ```sql
   -- 일자별 (direct) 비율 — Unwanted Referrals 설정 전후 비교
   SELECT
     event_date,
     COUNTIF(traffic_source.source = '(direct)') AS direct_events,
     COUNT(*) AS total_events,
     ROUND(100.0 * COUNTIF(traffic_source.source = '(direct)') / NULLIF(COUNT(*), 0), 1) AS direct_pct
   FROM `hurdlers-naver-pay.analytics_304759974.events_*`
   WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                           AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
     AND event_name = 'purchase'
   GROUP BY event_date
   ORDER BY event_date;
   ```
2. [TJ] 2026-04-21 이후 일자에서 `direct_pct` 가 눈에 띄게 떨어지면 성공. 하락 폭이 기대(~25%) 보다 작으면 **다른 PG 도메인(예: 카카오페이 pg-web) 이 더 있거나 footer UTM 복원 로직이 추가로 필요**.
3. [TJ] 같은 쿼리를 coffee property 에도 돌린다. `GA4_COFFEE_PROPERTY_ID=326949178` 이고 coffee raw export 가 `hurdlers-naver-pay` 밖이라면 프로젝트 경로를 coffee dataset 경로로 바꿔야 한다 (예: `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*`).
4. 결과를 `roadmap/confirmed_stopline.md` v2.3 에 기록한다.

### 지금 당장

1. [TJ] biocom BigQuery legacy raw export 접근을 허들러스에 확인한다.
2. [Codex] `purchase-confirm-stats` CANCEL 서브카테고리 설계를 작업 티켓으로 분리한다. 의존성: 병렬가능. CANCEL 설계는 1번 BigQuery 접근 확인과 독립적으로 진행할 수 있다.
3. [Claude Code] `/ads`와 `/crm`에 source freshness 결과를 붙일 화면 배지를 준비한다. 의존성: 부분병렬. 화면 구조는 먼저 만들 수 있지만, 실제 값은 `backend/scripts/check-source-freshness.ts` 결과를 따른다.
4. [TJ] 더클린커피 네이버 커머스 API 앱 권한 또는 판매자 센터 API 권한을 개발 환경에서 사용할 수 있게 한다. 의존성: GA4 NPAY 65건을 네이버 주문 원장으로 닫기 위한 선행필수.
5. [Codex] 권한 확보 후 `backend/scripts/reconcile-coffee-ga4-naverpay.py`를 재실행한다. 의존성: 부분병렬. GA4 NPAY 추출과 스크립트는 준비됐지만, 실제 네이버 원장 close는 4번 권한이 필요하다.

### 이번 주

1. [Codex] GA4 `(not set)` fallback 진단 API를 만든다.
2. [Claude Code] `/ads` 상단에 data trust 요약 카드 초안을 붙인다.
3. [TJ] GA4 MP API secret 발급 여부를 결정한다.
4. [Codex] PlayAuto와 Imweb 구매확정 delta 쿼리를 만든다. 의존성: 병렬가능. 구매확정 delta 쿼리는 3번 GA4 MP API secret과 독립적으로 진행할 수 있다.
5. [Codex/TJ] `공동구매내역.md`의 2026년 1~3월 로컬 산출치(`1,668건 / 512,906,191원`)와 회사 공동구매 추출본을 주문번호 기준으로 맞춘다. 의존성: 부분병렬. 회사 추출본이 오기 전까지 Codex는 비교 컬럼과 차이 사유 분류표를 준비할 수 있다.

### 운영 승인 후

1. [Codex] GA4 Measurement Protocol refund를 실제 환불에만 연결한다.
2. [Codex] Meta CAPI Refund 보정 설계를 같은 상태 전이 diff에 연결한다.
3. [Claude Code] mapped/unmapped campaign ROAS 화면을 운영 카드로 고정한다.

---

## 업데이트 규칙

- `datacheck0415.md`는 고정 스냅샷이므로 과거 사실을 바꾸지 않는다.
- 새 사실은 이 문서에 먼저 반영한다.
- 숫자는 반드시 `기준 시각`, `대상 사이트`, `분모`를 같이 적는다.
- 완료율은 단일 숫자보다 `우리 기준 / 운영 기준`을 우선 쓴다.
- 원인이 확정되지 않았으면 `유력`, `가능`, `미확인`으로 나눈다.
- `[TJ]` 단계 다음의 `[Codex]` 또는 `[Claude Code]` 단계는 `의존성: 선행필수`, `의존성: 병렬가능`, `의존성: 부분병렬` 중 하나를 적는다.
- 같은 문서 내 이동 링크는 Obsidian wiki 링크만 쓴다.

---

## 업데이트 이력

| 시각 | 변경 | 근거 |
|---|---|---|
| 2026-04-21 01:50 KST | **BigQuery 자체 프로젝트 이전 계획 수립**. 허들러스 `hurdlers-naver-pay.analytics_304759974` → 자체 `seo-aeo-487113.analytics_304759974`. 타이밍: 2026-05-05 (v136/v137 baseline 2주 확보 후). 방식: 신규 GA4 BigQuery Link + 과거 table 일회성 copy. 사전 작업 5개. 비용 월 $1 미만 예상. 상세: `/Users/vibetj/coding/seo/data/bigquery_migration_plan_20260421.md` | GA4 Admin API, `sourceFreshness.ts` `ga4_bigquery_biocom` 현재 미활성 상태, 허들러스 service account 권한 미부여 |
| 2026-04-21 01:40 KST | **🎉 GTM v137 publish 완료**. 가상계좌 미입금 GA4 purchase 차단. 변수 [252] `JS - vbank blocked` + 트리거 [253] Exception + 태그 [143]/[48]/[154] blockingTriggerId 연결. [251] prep v3 (dataLayer.set + server-branch guard). Preview A(카드 11,900원)/B(가상계좌 35,000원) 양쪽 통과 후 배포. C-Sprint 3 vbank_expired ₩966M 의 GA4 확장 이슈 해결 | `backend/gtm_publish.mjs` 실행 log, GTM API live 매칭 확인, `GA4/gtm_exception_trigger_draft_20260421.md` v2 |
| 2026-04-21 01:15 KST | **Phase5-Sprint9 NPay return 누락 감사 + 제거 A/B 신설**. 2026-04-21 00:47 GTM Preview Run 2 에서 NPay 실제 결제 후 biocom.kr 복귀 안 함 관측. `shop_payment_complete` 미도달로 GA4 purchase / Meta CAPI Purchase 미발사. Google Ads [248] 는 버튼 클릭 시점에 발사되어 실제 결제 미반영 과다집계 위험. 상세 분석 문서 신규 작성 | `/Users/vibetj/coding/seo/GA4/npay_return_missing_20260421.md`, GTM Preview Run 2 스크린샷 3장 |
| 2026-04-20 17:45 KST | biocom + coffee GA4 Google 태그에 **원치 않는 추천 7개 추가** (`tosspayments.com` / `m.tosspayments.com` / `nicepay.co.kr` / `m.nicepay.co.kr` / `orders.pay.naver.com` / `new.kakaopay.com` / `pg.innopay.co.kr`). biocom 은 기존 13개 포함 총 20개. 핵심 누락이었던 `tosspayments.com` 포함. GA4 반영 24~48h 후 쿼리 4/5 재실행 필요. `### 예약 — 2026-04-22 이후` 섹션에 실행 쿼리와 예상 패턴 기록 | BQ 쿼리 1/2 로 확인된 session_lost 1,158건(26%), BQ 쿼리 4 로 확인된 raw (not set)=0%, GA4 Admin UI 스크린샷 |
| 2026-04-20 12:29 KST | 바이오컴 2026년 1~3월 공동구매 로컬 산출치와 회사 추출본을 대사해야 하는 항목 추가. 로컬 기준값은 `공동구매내역.md`의 공동구매성 주문 `1,668건`, 주문 매출 `512,906,191원`이며, 회사 추출본과 주문번호 기준으로 일치 여부를 확인해야 한다 | `공동구매내역.md`, local `backend/data/crm.sqlite3` read-only 집계 |
| 2026-04-20 01:19 KST | 더클린커피 GA4 NPAY 65건 대사 시도 결과 반영. GA4 NPAY는 65건, gross `2,630,700원`으로 확정. 현재 네이버 커머스 API 자격 증명은 바이오컴 주문 원장만 조회되고 더클린커피 주문번호 샘플은 `400 / 101010 / 처리권한 없음`으로 막혀 네이버 주문 원장 대사는 권한 확보 전까지 미완료로 분리 | `backend/scripts/reconcile-coffee-ga4-naverpay.py`, BigQuery GA4 raw read-only 조회, Naver Commerce API read-only 조회, local Imweb cache read-only 조회 |
| 2026-04-19 09:41 KST | thecleancoffee BigQuery viewer 권한 반영 확인. GA4 화면의 stream/project metadata를 기준 문서에 저장하고, `ga4_bigquery_thecleancoffee`를 source freshness script에 추가. 최신 daily table은 `events_20260417`, 최근 raw `20260412~20260417` purchase는 123건, distinct transaction_id도 123건 | GA4 화면 메타데이터, BigQuery dataset/table read-only 조회, `backend/scripts/check-source-freshness.ts` 실행 |
| 2026-04-18 02:37 KST | thecleancoffee BigQuery 상태 확인. 문서 기준 새 프로젝트 연결은 유지로 보되, 현재 서비스 계정은 BigQuery dataset 조회 권한이 없어 raw `events_*` 적재 확인은 미완료. GA4 Data API는 property `326949178`에서 최근 7일 이벤트와 purchase 143건 조회 성공 | `data/bigquery0409.md`, GA4 Data API read-only 실행, BigQuery dataset get/list 403 |
| 2026-04-17 KST | `roasphase.md`를 증거 저장소로 연결. Sprint3/5/6에 roasphase Phase 3/4/5/6 교차 참조 추가. 전체 병합은 하지 않는 이유: roasphase는 2026-04-12 시점 주문 단위 증거 스냅샷이고 이 문서는 가변 기준판이라 성격이 다름. Codex 의견도 부분 흡수/분리 유지 권고 | `data/roasphase.md`, `roadmap/roadmap0415.md`의 roasphase 참조 관계 유지 |
| 2026-04-17 19:13 KST | source별 최신성 점검 스크립트 추가. Toss/Imweb/PlayAuto/attribution ledger 병렬 가능 범위를 먼저 구현하고, biocom GA4 raw export는 허들러스 확인 뒤 추가하는 것으로 분리 | `backend/scripts/check-source-freshness.ts`, 2026-04-17 19:13 KST read-only 실행 결과 |
| 2026-04-17 19:05 KST | 최초 작성. 0406 방향 문서와 0415 고정 스냅샷을 합쳐 가변형 기준 문서로 분리 | `datacheck0406.md`, `datacheck0415.md`, 2026-04-17 PlayAuto read-only 확인 |
