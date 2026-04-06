# Phase 1 메모

기준일: 2026-04-06

## Source Of Truth

이 문서는 `왜 Phase 1이 필요한가`를 설명하는 메모다.
진행률, 실측 숫자, owner, blocker는 [roadmap0327.md](/Users/vibetj/coding/seo/roadmap0327.md) Phase 1 섹션을 source of truth로 본다.

- last verified: `2026-04-06`
- owner:
  - `P1-S1`, `P1-S1A`, `P1-S1B`: Codex
  - `P1-S2`: Claude Code
- next action: ~~실제 고객 사이트 receiver 연결~~ ✅ 완료 → coffee Toss backfill 완료, 바이오컴 확장 + KPI 재산출
- blocked by: ~~실제 고객 사이트 checkout/success 코드가 현재 workspace 밖에 있음~~ → 해결됨 (아임웹 푸터 코드로 직접 연결)

## 페르소나 베네핏 카드

- **대표(TJ):** 이 phase가 닫히면 CRM 메시지가 실제 순매출을 만들었는지 감이 아니라 실험 장부와 결제 원장으로 판단할 수 있다.
- **운영팀:** `/crm`에서 실험 상태와 결제 귀속 blocker를 함께 보고, 오늘 개발팀에 무엇을 요청해야 하는지 바로 고를 수 있다.
- **개발팀:** `checkout-context / payment-success` live row 1건과 토스 조인 1건이 완료 판정의 최소 기준이라는 점이 분명해진다.
- **아직 안 되는 것:** live row와 DebugView가 닫히기 전까지 `(not set)=PG 직결`은 확정하지 않는다.

## 상단 10초 요약

Phase 1의 목적은 `누구에게 메시지를 보냈고`, `그 사람이 실제로 샀는지`, `결제 과정에서 신호가 어디서 끊기는지`를 같은 장부로 묶는 것이다.
`P1-S1 실험 장부`와 `P1-S2 운영자 화면`은 로컬 검증 기준으로 닫혔다.
**`P1-S1A 결제 블랙박스`도 live row + UTM 추적이 완성되었다 (0402).** 더클린커피 아임웹 푸터 코드 + Cloudflare Tunnel로 payment-success receiver가 live 호출되고, orderId/paymentKey/amount/UTM이 모두 자동 적재된다.
다음 행동은 바이오컴 확장과 coffee KPI 재산출이다.

## 현재 상황 (0402 업데이트)

**P1-S1A의 핵심 병목이었던 live row 적재가 해결되었다.**

- `GET /api/attribution/ledger` 기준 attribution 원장은 **`live 3 / replay 5 / smoke 3`** 상태다.
- **live 3건**은 더클린커피(thecleancoffee.com)에서 실제 결제 후 들어온 실전 데이터다.
- live row에서 orderId, paymentKey, amount, UTM(source/medium/campaign), gclid이 모두 자동 적재되고 있다.
- source 필터: `?source=thecleancoffee_imweb&captureMode=live`로 커피 전용 live row 조회 가능.
- replay 기준 토스 조인율은 여전히 `5/5`.
- `GET /api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30` 기준 GA4 `(not set)` 구매는 `845건`, 매출은 `₩136,594,482`.

남은 것:
- 커피 Toss 키 반영 + local backfill은 완료됐다. 이제 coffee LTR/재구매 지표 재산출과 대시보드 반영이 남았다
- 바이오컴(biocom.kr) 확장 — 결제완료 URL 패턴 확인 + 푸터 코드 삽입
- Cloudflare named tunnel (고정 URL) 전환
- 운영 DB cutover

## 문서 목적

이 문서는 Phase 1의 현재 상태, 남은 blocker, 다음 행동을 TJ님과 개발팀이 같은 언어로 이해하도록 정리한다.

- 이 문서의 주 독자: `대표(TJ)`, `운영팀`, `개발팀`
- 이 문서를 읽고 바로 할 행동: `live row를 막는 checkout/payment success 연결 요청을 분명히 고른다`

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
| [P1-S1A](#p1-s1a-결제-블랙박스) | `(not set)` 원인을 검증할 블랙박스를 만든다 | `95%` | `20%` | receiver, JSONL 원장, 토스 조인 진단, `live/replay/smoke` 구분, replay `5/5` 확인까지 끝났다 | 실제 고객 사이트가 receiver를 아직 호출하지 않는다 | 실제 checkout/payment success에 receiver를 연결한다 |
| [P1-S2](#p1-s2-운영자-화면) | 운영자가 실험과 귀속 상태를 보는 화면을 만든다 | `100%` | `70%` | `/crm`에서 실험 생성, 전환 동기화, KPI 표, variant 비교 차트가 뜬다 | 운영 배포와 실사이트 사용자 피드백이 남았다 | 지금 화면을 기준 화면으로 고정하고 운영 handoff를 만든다 |

## 현재 상태

### 확인된 것

- `/crm` 페이지가 `7010`에서 실제로 열린다.
- `/api/crm-local/experiments`가 `7020`에서 실제로 응답한다.
- `crm-local` 실험 장부는 `실험 2건`, `배정 9건`, `전환 7건`을 보유하고 있다.
- `/crm` 실험 운영 탭에서 실험 생성 폼, 전환 동기화 버튼, KPI 표, variant 비교 차트가 모두 동작한다.
- `/crm` 결제 귀속 탭에서 ledger summary, 토스 조인율, GA4 `(not set)` 매출, 일자 비교표를 같이 본다.
- attribution 원장은 **`live 3 / replay 5 / smoke 3`**로 구분돼 적재된다.
- **★ 더클린커피 live row 3건 적재 완료 (0402)**: orderId, paymentKey, amount, UTM, gclid 모두 정상.
- `P1-S1B` hard gate 실행 코드가 추가돼 consent, claim review, quiet hours, cooldown, suppression을 코드로 평가할 수 있다.

### 아직 안 된 것

- ~~실제 고객 사이트에서 `checkout-context`와 `payment-success`를 아직 호출하지 않는다.~~ → **payment-success ✅ 완료 (0402)**. checkout-context는 아직 미연결.
- 운영 DB에 실험 원장 테이블과 정식 attribution ledger 테이블이 없다.
- 운영 배포 환경에서 같은 흐름을 다시 검증한 기록은 아직 없다.
- 커피 Toss backfill은 끝났지만, 그 결과를 coffee 문서/대시보드 지표에 다시 반영하는 작업은 아직 남아 있다.
- 바이오컴(biocom.kr)에는 아직 푸터 코드 미삽입.

### 지금 막힌 이유

- ~~실제 고객 사이트 결제 완료 진입점이 이 workspace 밖에 있다.~~ → **해결됨**
- 운영 DB 수정은 현재 개발팀만 할 수 있다.
- 커피 live/orderId 기준 조회와 2025~2026 local backfill은 가능해졌지만, coffee LTR/코호트 계산은 아직 재산출 전이다.

### 현재 주체

- `TJ님 + Claude Code`: live receiver 운영, `/crm` 운영 화면, JSONL 원장, 아임웹 푸터 코드 관리
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

**`P1-S1A`는 우리 기준으로 완료다 (0402).**
더클린커피에서 live row + UTM 추적, Toss 키 반영, local backfill까지 완료되었다. 남은 것은 coffee KPI 재산출과 바이오컴 확장이다.

### 무엇을 하는가

이 스프린트는 결제 과정의 앞뒤를 기록한다.

- checkout을 시작한 순간을 남긴다.
- payment success가 온 순간을 남긴다.
- 그 기록을 토스 승인과 GA4 `(not set)` 날짜와 붙여 본다.

비유하면 `결제 플로우에 블랙박스와 게이트 통과 기록기를 다는 일`이다.

### 확인된 것 (0402 업데이트)

- `POST /api/attribution/checkout-context`가 있다.
- `POST /api/attribution/payment-success`가 있다. **★ 더클린커피에서 live 호출 성공.**
- `GET /api/attribution/ledger`와 `GET /api/attribution/toss-join`이 있다.
- `GET /api/attribution/ledger?source=thecleancoffee_imweb&captureMode=live`로 커피 전용 live row 필터 가능.
- `GET /api/crm-phase1/ops`가 GA4 `(not set)`, 토스 승인, receiver row를 한 응답으로 묶어 준다.
- `GET /api/attribution/ledger` 기준 capture mode 분포는 **`live 3 / replay 5 / smoke 3`**다.
- **live 3건**은 더클린커피 실결제 후 자동 적재된 데이터:
  - orderId: URL param `order_no`에서 자동 추출 ✅
  - paymentKey: referrer URL에서 자동 추출 ✅
  - amount: referrer URL에서 구조화 파싱 ✅ (`metadata.referrerPayment`)
  - UTM: 아임웹 자체 세션(`__bs_imweb_session`)에서 자동 읽기 ✅
  - gclid: UTM landing URL에서 자동 추출 ✅
  - source: `thecleancoffee_imweb` ✅
- replay 기준 토스 조인은 `5/5`로 붙었다.

### 아직 안 된 것

- ~~실제 고객 사이트에서 들어온 live payment success row도 아직 없다.~~ → **✅ 3건 달성**
- checkout-context(V2)는 아직 미연결 (급하지 않음 — payment-success만으로 전환 원장 구축 가능).
- 커피 Toss 키 반영 완료 + `store=coffee` orderId/paymentKey 크로스 검증 성공.
- 바이오컴(biocom.kr) 확장 미착수.
- Cloudflare Tunnel URL이 재시작 시 변경됨 (named tunnel 전환 필요).

### 지금 막힌 이유

- ~~실제 checkout/payment success 코드가 이 workspace 밖에 있다.~~ → **해결됨 (아임웹 푸터 코드)**
- 커피 키 확보/재동기화 단계는 끝났다. 이제 남은 것은 지표 재산출과 운영 화면 반영이다.

### 다음 행동

1. **커피 LTR/재구매 지표 재산출** → `store=coffee` 기준 2025~2026 backfill 결과를 지표에 반영.
2. **바이오컴 결제완료 URL 패턴 확인** → 바이오컴용 푸터 코드 준비.
3. **Cloudflare named tunnel 전환** → 고정 URL 확보.
4. 운영 DB에 attribution ledger 테이블 승격.

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
3. ~~live row 1건 이상을 목표로 다시 검증한다.~~ → ✅ **3건 달성**

### 이번 주 (0402 기준)

1. **커피 지표 재산출 반영** → backfill 결과를 coffee 문서와 운영 판단 숫자에 반영
2. **바이오컴 결제완료 URL 패턴 확인** → 바이오컴용 푸터 코드 준비
3. **Cloudflare named tunnel 전환** → 고정 URL 확보
4. `/crm` 결제 귀속 탭에서 live row 실데이터 표시 연동

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
2. JSONL attribution 원장을 정식 DB ledger로 승격한다.
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

### 최근 검증 (0402 업데이트)

- TypeScript attribution 타입 체크: 에러 0건
- `GET http://localhost:7020/api/attribution/ledger` -> `live 3 / replay 5 / smoke 3`
- `GET http://localhost:7020/api/attribution/ledger?source=thecleancoffee_imweb&captureMode=live` -> 커피 live row 3건
- live row 검증 필드: orderId ✅, paymentKey ✅, amount ✅, utmSource ✅, utmMedium ✅, utmCampaign ✅, gclid ✅
- Cloudflare Tunnel: `*.trycloudflare.com` → health 200 OK, POST payment-success 201 OK
- `GET http://localhost:7020/api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30` -> replay 토스 조인 `5/5`, GA4 `(not set)` 매출 `₩136,594,482` 확인

### 해석 주의

- `P1-S1`은 실험 배선이 닫혔는지 보는 수치다.
- `P1-S1A`는 아직 원인 확정 단계가 아니다.
- `P1-S2`는 화면 구현 완료와 운영 반영 완료를 구분해서 봐야 한다.
