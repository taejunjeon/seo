# GPT 피드백 #3 대응 개발 결과 (2026-03-29)

> **원본 피드백**: `GA4/gptfeedback_0329_3.md`
> **작업자**: Codex
> **작업일**: 2026-03-29

---

## 1. 요청 내용 요약

피드백 3차의 핵심은 아래였다.

1. SEO 퍼널에서 `유입보다 전환 숫자가 더 커 보이는 이유`를 버그/정의 문제로 분해할 것
2. 특히 아래 6가지를 먼저 보라는 요청
   - 세션 vs 이벤트 혼용
   - User acquisition vs Traffic acquisition 혼용
   - `/shop_view` query string 손실
   - cross-domain / PG 리다이렉트
   - landing page `(not set)`
   - `transaction_id` 품질
3. 그리고 실제 확인 순서를 제품 단위로 제시할 것

이번 턴은 이 내용을 **백엔드 진단 API + 프론트 Overview 카드**로 구현했다.

---

## 1-1. 요청 항목별 반영 상태

피드백 원문 기준으로 `무엇을 구현했는지`와 `무엇이 아직 운영 검증 대기인지`를 아래처럼 구분한다.

| 요청 항목 | 상태 | 이번 턴 결과 |
|---|---|---|
| 1. 세션과 이벤트를 섞어 보고 있을 가능성 확인 | 완료 | `sessions`, `ecommercePurchases`, `keyEvents`를 같은 진단 응답에 넣고, 왜 직접 비교하면 안 되는지 설명 카드와 체크리스트까지 반영 |
| 2. User acquisition / Traffic acquisition 혼용 가능성 확인 | 완료 | `session scope Organic Search`와 `first user scope Organic Search`를 같이 집계하고 차이를 설명하도록 구현 |
| 3. `/shop_view`에서 query string 손실 여부 확인 | 완료 | `/shop_view` pagePath와 `pagePathPlusQueryString` 변형 수를 진단에 포함, 제품 단위로 다시 보라는 체크리스트 반영 |
| 4. cross-domain / PG 리다이렉트 가능성 확인 | 부분 완료 | 진단 신호와 화면 설명은 구현했고, 실제 데이터상 `runFunnelReport purchase=0` vs `ecommercePurchases=106` 패턴도 확인했다. 다만 **GA4 관리자 화면의 domain 설정 점검**과 **실제 결제 1건 DebugView 검증**은 아직 운영 확인이 남아 있다 |
| 5. landing page `(not set)` 문제 확인 | 완료 | `notSetLandingRatio`를 진단 응답과 프론트 카드에 반영했고, 현재 실측 `15.3%` 확인 |
| 6. purchase 중복 또는 `transaction_id` 품질 확인 | 부분 완료 | `transactionId` 기준 고유 건수, purchase 이벤트 수, 중복 의심, 커버리지를 진단에 넣었다. 다만 **실주문 원장 기준 최종 reconciliation**은 아직 안 했다 |
| 7. Path exploration을 같은 세션 퍼널처럼 읽지 말라는 설명 | 완료 | 별도 진단 이슈로 추가해 `행동 흐름용`과 `전환 퍼널용`의 차이를 카드에서 설명 |
| 8. 실제 확인 순서 5단계 제시 | 완료 | Overview 카드 하단과 API 응답에 5단계 체크리스트로 고정 반영 |
| 9. 같은 범위로 다시 만들기 | 부분 완료 | 화면/응답에 권장 쿼리 구조는 적었지만, **GA4 Explore 내부에서 실제 새 표를 생성한 것까지는 아님** |
| 10. live purchase 1건 직접 태워 보기 | 미완료 | 코드와 체크리스트는 준비했지만, 실제 결제 테스트와 DebugView 운영 검증은 이번 턴 범위 밖 |
| 11. GA4 cross-domain 설정 화면 직접 점검 | 미완료 | 점검해야 할 도메인 목록은 반영했지만, 관리자 화면에서 실제 체크한 것은 아님 |
| 12. 주문번호 기준 중복 대조 | 부분 완료 | GA4 `transactionId` 기준 중복 의심은 계산했지만, revenue/주문 원장과 `order_number` 기준 최종 대조는 아직 안 함 |

### 최종 판정

- **구현 기준으로는 핵심 요청을 대부분 반영했다.**
- 특히 피드백에서 요구한 `원인 분해`, `왜 그런지 설명`, `실제 확인 순서`는 모두 API와 프론트에 들어갔다.
- 다만 아래 4개는 `구현 완료`가 아니라 **운영 검증 대기**로 보는 것이 정확하다.
  - 실제 purchase 1건 DebugView 검증
  - GA4 관리자 화면의 cross-domain 설정 점검
  - GA4 Explore 안에서 같은 scope 표 재생성
  - 주문 원장과 transaction_id/order_number 최종 reconciliation

즉 이번 턴은 `진단 레이어 구현 완료`, `운영 검증 4건 남음`으로 정리하는 것이 맞다.

## 1-2. 운영 검증별 Codex 수행 가능 여부

남아 있는 운영 검증이 `내가 바로 할 수 있는 것`인지, `운영/사람 검증이 필요한 것`인지도 아래처럼 구분한다.

| 운영 검증 항목 | Codex 수행 가능 여부 | 판단 |
|---|---|---|
| 실제 purchase 1건 DebugView 검증 | 불가 | 실제 결제 수단, 브라우저 세션, GA4 DebugView 접근, 운영 사이트 결제 플로우가 필요하다. Codex는 코드 준비와 체크리스트 제공까지는 가능하지만 **실제 구매 1건을 태워 닫는 것**은 단독 수행이 어렵다 |
| GA4 관리자 화면의 cross-domain 설정 점검 | 불가 | `Configure your domains`는 GA4 Admin UI 권한과 브라우저 접근이 필요하다. Codex는 점검해야 할 도메인 목록은 제시할 수 있지만 **관리자 화면에서 직접 체크/수정**은 못 한다 |
| GA4 Explore 안에서 같은 scope 표 재생성 | 부분 가능 | Codex는 같은 로직을 API/SQL/체크리스트로 재현할 수 있고, 어떤 dimension/metric/filter를 써야 하는지도 정리할 수 있다. 다만 **GA4 Explore UI에서 실제 표를 클릭으로 만들어 저장하는 것**은 못 한다 |
| 주문 원장과 `transaction_id/order_number` 최종 reconciliation | 가능 | `revenue` DB 또는 주문 원장 접근이 있으면 Codex가 쿼리/스크립트/API로 대조 리포트를 만들 수 있다. 이번 턴에 안 한 이유는 범위상 제외였지, 기술적으로 막혀서가 아니다 |

### 실무 해석

- `운영 검증 4건`이 전부 사람 손이 필요한 것은 아니다.
- 이 중에서 **Codex가 단독으로 닫기 어려운 것**은 2개다.
  - 실제 purchase 1건 DebugView 검증
  - GA4 관리자 화면의 cross-domain 설정 점검
- 반대로 아래 2개는 **Codex가 계속 이어서 할 수 있는 영역**이다.
  - 같은 scope 기준 표를 API/문서/재현 로직으로 더 정교하게 만드는 일
  - 주문 원장과 `transaction_id/order_number` reconciliation 자동화

즉 남은 항목을 더 정확히 말하면,
`운영 검증 4건` 중 **2건은 운영 병행 필수**, **2건은 Codex 추가 작업 가능**으로 보는 것이 맞다.

---

## 2. 개발 완료 내역

### 2-1. Backend: SEO 전환 숫자 역전 진단 API 추가

**파일**: `backend/src/ga4.ts`
**라우트**: `GET /api/ga4/seo-conversion-diagnosis`

구현 내용:

- Organic Search의 **session scope** 수치 집계
  - `sessions`
  - `entrances` (실패 시 `sessions` fallback)
  - `ecommercePurchases`
  - `keyEvents` (실패 시 `conversions` fallback)
  - `grossPurchaseRevenue`
- Organic Search의 **first user scope** 수치 집계
  - `totalUsers`
  - `ecommercePurchases`
  - `grossPurchaseRevenue`
- `/shop_view` query string 분산 진단
  - `pagePath = /shop_view`
  - `pagePathPlusQueryString = /shop_view?...`
- 기존 API 재사용 결합
  - `queryGA4DataQuality`
  - `queryGA4RealFunnel`
  - `queryGA4SourceConversion`
- `transactionId` 기준 purchase 품질 진단
  - 고유 transaction_id 개수
  - transaction_id 없는 purchase
  - 중복 purchase 의심 개수
  - 커버리지

결과적으로 이 API는 아래 7개 원인 후보를 한 번에 반환한다.

1. 세션과 이벤트 혼용
2. User acquisition / Traffic acquisition 혼용
3. `/shop_view` query string 손실
4. cross-domain / PG 세션 단절
5. landing page `(not set)`
6. `transaction_id` 품질 문제
7. Path exploration 오해 가능성

---

### 2-2. Frontend: Overview 탭에 진단 카드 추가

**파일**:
- `frontend/src/components/dashboard/SeoConversionDiagnosis.tsx`
- `frontend/src/components/dashboard/SeoConversionDiagnosis.module.css`
- `frontend/src/components/tabs/OverviewTab.tsx`

구현 내용:

- Overview 상단에 `SEO 유입보다 purchase가 더 커 보이는 이유 진단` 카드 추가
- 요약 카드 4개 표시
  - Organic Search 세션
  - Organic Search 구매
  - landing page `(not set)` 비율
  - transaction_id 커버리지
- 각 원인 후보마다 아래를 같이 노출
  - 왜 이런 현상이 생기는지
  - 지금 보이는 실제 신호
  - 바로 확인할 것
- 맨 아래에 **실제 확인 순서 5단계**를 고정 노출

즉 이제는 숫자가 이상해 보여도, 사용자가 Overview 화면에서 바로
`정의 문제인지`, `계측 문제인지`, `PG/cross-domain 문제인지`
를 한 번에 읽을 수 있다.

---

### 2-3. Test

**파일**: `backend/tests/ga4-seo-conversion-diagnosis.test.ts`

- 순수 함수 `buildGA4SeoConversionDiagnostic` 테스트 추가
- mixed-scope / not_set / funnel 단절 / transaction 이슈가 올바른 severity로 잡히는지 검증

---

## 3. 실제 API 결과

조회 기간:

- `2026-02-28 ~ 2026-03-28`

실제 호출:

- `GET /api/ga4/seo-conversion-diagnosis?startDate=2026-02-28&endDate=2026-03-28`

### 3-1. Organic Search 세션 scope

| 지표 | 값 |
|------|----|
| Sessions | 14,804 |
| Entrances | 14,804 |
| Ecommerce purchases | 106 |
| Key events | 40,889 |
| Gross purchase revenue | ₩25,002,757 |

참고:

- `entrances` metric은 현재 호출에서 `INVALID_ARGUMENT`가 나서 `sessions`로 fallback 처리함
- 이 fallback 사실은 `debug.notes`에 남김

### 3-2. Organic Search first user scope

| 지표 | 값 |
|------|----|
| Total users | 10,989 |
| Ecommerce purchases | 118 |
| Gross purchase revenue | ₩26,291,543 |

해석:

- session scope와 first user scope의 구매/매출이 이미 다르다
- 따라서 두 리포트를 직접 비교하면 “유입보다 전환이 더 크다” 같은 착시가 생길 수 있다

### 3-3. 핵심 진단 신호

| 항목 | 값 |
|------|----|
| landing page `(not set)` 비율 | 15.3% |
| runFunnelReport purchase | 0 |
| 같은 기간 실제 ecommercePurchases | 106 |
| 고유 transaction_id | 2,128 |
| purchase 이벤트 수 | 2,227 |
| 중복 purchase 의심 | 99 |
| transaction_id 커버리지 | 95.6% |

### 3-4. 생성된 이슈 7개

1. 세션과 이벤트를 섞어 보고 있을 가능성
2. User acquisition과 Traffic acquisition을 섞어 봤을 가능성
3. 상품 상세가 Page path에서 뭉개지고 있을 가능성
4. cross-domain 또는 PG 리다이렉트로 세션이 끊겼을 가능성
5. landing page `(not set)` 때문에 퍼널 분모가 줄고 있을 가능성
6. purchase 중복 또는 transaction_id 품질 문제 가능성
7. Path exploration은 같은 세션 퍼널처럼 읽으면 안 됨

---

## 4. 현재 판단

이번 결과로 아래는 꽤 강하게 말할 수 있다.

### 4-1. 단순 버그 1개로 설명되는 상태는 아님

실제로는 아래 두 층이 같이 있다.

- **정의/리포트 해석 문제**
  - sessions vs key events
  - first user vs session scope
  - page path vs page path + query string
- **실제 계측/귀속 문제**
  - `(not set)` landing 15.3%
  - `runFunnelReport purchase = 0`
  - PG 또는 cross-domain 세션 단절 가능성

### 4-2. 가장 먼저 의심할 것은 여전히 PG / cross-domain 단절

이유:

- 같은 기간 실제 `ecommercePurchases`는 106인데
- `runFunnelReport`의 purchase 단계는 0
- `(not set)` landing 비율도 15.3%

즉 `결제 완료는 잡히는데, 같은 세션 흐름으로는 이어지지 않는` 패턴이 실제로 관찰된다.

### 4-3. transaction_id는 “완전히 망가진 상태”는 아님

- 커버리지 95.6%
- 하지만 중복 의심 99건

따라서 `transaction_id`는 0점 수준은 아니지만,
주문번호 기준 대조를 계속 해야 하는 상태다.

---

## 5. 남은 확인 순서

이번 턴에서 API와 화면으로 고정한 실무 순서는 아래다.

1. Explore에서 같은 scope의 표를 다시 만든다
   - `Session default channel group = Organic Search`
   - `Landing page + query string`
   - `Sessions / Entrances / Ecommerce purchases / Key events / Total revenue`

2. `/shop_view`를 제품 단위로 쪼갠다
   - `Page path + query string`
   - 또는 `Landing page + query string`

3. DebugView 또는 Realtime으로 purchase 1건을 끝까지 태운다
   - `view_item`
   - `add_to_cart`
   - `begin_checkout`
   - `add_payment_info`
   - `purchase`
   - source/medium 변화
   - referral domain
   - transaction_id 존재 여부

4. GA4 cross-domain 설정을 점검한다
   - `biocom.kr`
   - `www.biocom.kr`
   - `biocom.imweb.me`
   - 실제 PG 완료 도메인

5. 주문번호 기준 transaction_id 유니크 건수와 GA4 purchase 수를 대조한다

---

## 6. 검증 결과

| 검증 항목 | 결과 |
|----------|------|
| Backend TypeScript 타입 체크 | 통과 |
| 신규 진단 테스트 | 통과 |
| 전체 backend 테스트 | 35/35 통과 |
| Frontend build | 통과 |
| `/api/ga4/seo-conversion-diagnosis` 실제 호출 | 성공 |
| `http://localhost:7010/` | 200 |
| `http://localhost:7020/health` | 200 |

서버 상태:

- frontend `7010` LISTEN
- backend `7020` LISTEN

---

## 7. 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/ga4.ts` | `queryGA4SeoConversionDiagnostic`, `buildGA4SeoConversionDiagnostic` 추가 |
| `backend/src/routes/ga4.ts` | `GET /api/ga4/seo-conversion-diagnosis` 추가 |
| `backend/tests/ga4-seo-conversion-diagnosis.test.ts` | 신규 테스트 추가 |
| `frontend/src/components/dashboard/SeoConversionDiagnosis.tsx` | 신규 Overview 진단 카드 |
| `frontend/src/components/dashboard/SeoConversionDiagnosis.module.css` | 카드 스타일 추가 |
| `frontend/src/components/tabs/OverviewTab.tsx` | Overview에 진단 카드 삽입 |
| `GA4/gptfeedback_0329_3reply.md` | 이 문서 신규 작성 |

---

## 8. 한 줄 결론

이번 턴으로 `SEO 유입보다 purchase가 더 많아 보이는 이유`를 더 이상 감으로 설명하지 않고,
**실제 데이터 신호 + 원인 후보 + 확인 순서**를 API와 화면에서 바로 읽을 수 있게 만들었다.
