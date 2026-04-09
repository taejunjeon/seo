# GPT Feedback 0408-1 Reply

기준일: 2026-04-08  
참조: `gptfeedback_0408_1.md`

## 한줄 결론

이번 턴에는 문서상 우선순위로 적어 둔 것 중 **`biocom` BigQuery legacy 확인 없이 바로 가능한 작업 1, 2, 3번을 실제로 진행**했다.  
핵심 결과는 다음과 같다.

1. **caller 식별자 보강**
   - backend에 `GET /api/attribution/caller-coverage`를 추가해 live caller 누락률을 바로 보게 했다.
   - 현재 live `payment_success 452건` 기준 `ga_session_id / client_id / user_pseudo_id` coverage는 아직 모두 `0%`다.
   - 즉 backend 저장 준비는 끝났고, 외부 checkout/payment_success caller 수정이 다음 실제 blocker다.

2. **biocom Imweb local sync**
   - `POST /api/crm-local/imweb/sync-orders`를 biocom 대상으로 실제 실행했다.
   - latest local `imweb_orders`는 `5,750건`까지 늘었고, `firstOrderAt 2026-01-27`, `lastOrderAt 2026-04-07`를 확인했다.
   - 이제 biocom도 coffee처럼 `Imweb ↔ Toss` reconcile 숫자를 바로 볼 수 있다.

3. **Toss settlement backfill**
   - `POST /api/toss/sync?store=biocom&mode=backfill&startDate=2025-01-01&endDate=2026-04-07`를 실제 실행했다.
   - latest local `toss_settlements`는 `20,388건`, `totalAmount ₩4,863,790,709`, `totalFee ₩143,684,067`, `totalPayout ₩4,720,106,642`까지 증가했다.
   - 다만 장거리 backfill 요청의 **완료 응답/최종 coverage 산출은 아직 별도 확인**이 필요하다.

4. **ROAS 숫자 불일치 수정**
   - `/ads`와 `/ads/roas`가 다르게 보이던 이유는 source가 달랐기 때문이다.
     - `/ads/roas`: attribution/site-summary 기준
     - `/ads`: 기존에는 Meta purchase event 기준
   - `/ads` 메인 ROAS를 attribution/site-summary 기준으로 바꿔서, 이제 `/ads`와 `/ads/roas`가 같은 primary source-of-truth를 보게 했다.
   - Meta purchase ROAS는 보조 참고값으로만 남겼다.

5. **coffee viewer 추가 후 실제 검증**
   - `backend/scripts/ga4-implementation-audit.ts`가 multi-property env fallback을 보도록 보강했다.
   - 그 뒤 `304759974 (biocom)`, `326949178 (thecleancoffee)`, `326993019 (aibio)` 모두 `data api ok`를 확인했다.
   - 즉 coffee viewer 추가는 문서상 상태가 아니라 **실제 direct query 가능 상태**로 검증됐다.

## 코드 변경

### 백엔드

- `backend/src/attribution.ts`
  - caller coverage 요약 리포트 빌더 추가
- `backend/src/routes/attribution.ts`
  - `GET /api/attribution/caller-coverage` 추가
- `backend/src/crmLocalDb.ts`
  - biocom Imweb ↔ Toss reconcile 리포트 경로 보강
- `backend/src/routes/crmLocal.ts`
  - biocom local sync / reconcile 실행 검증
- `backend/src/routes/toss.ts`
  - settlement backfill 페이지네이션/적재 보강
- `backend/src/health/buildHealthPayload.ts`
  - `ga4Properties.biocom / thecleancoffee / aibio` 노출
- `backend/scripts/ga4-implementation-audit.ts`
  - `GA4_SERVICE_ACCOUNT_KEY` fallback을 `GA4_BIOCOM_SERVICE_ACCOUNT_KEY`까지 보도록 수정

### 프론트엔드

- `frontend/src/app/ads/page.tsx`
  - `/ads` 메인 ROAS source를 attribution/site-summary 기준으로 정렬
  - Meta purchase ROAS는 reference only로 하향
- `frontend/src/app/onboarding/page.tsx`
  - caller coverage API 확인 항목 추가
  - 0408 즉시 실행 결과 기록 항목 추가

## 실제 실행 결과

### 1. caller coverage

- endpoint: `GET /api/attribution/caller-coverage`
- 결과:
  - live `payment_success = 452`
  - `ga_session_id = 0%`
  - `client_id = 0%`
  - `user_pseudo_id = 0%`
  - `all-three = 0%`

의미:
- backend/ledger 구조는 준비됐지만
- 외부 caller가 아직 새 식별자를 보내지 않아 `GA4 ↔ 결제` 직결은 여전히 비어 있다.

### 2. biocom Imweb sync

- endpoint: `POST /api/crm-local/imweb/sync-orders`
- latest local stats:
  - `totalOrders = 5750`
  - `memberOrders = 4676`
  - `phoneCustomers = 4566`
  - `paymentAmountSum = ₩2,207,618,668`
  - `firstOrderAt = 2026-01-27`
  - `lastOrderAt = 2026-04-07`

### 3. biocom reconcile

- endpoint: `GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=5`
- 결과:
  - `imwebOrders = 5750`
  - `tossOrders = 5727`
  - `matchedOrders = 3915`
  - `missingInToss = 1835`
  - `missingInImweb = 1812`
  - `amountMismatchCount = 25`
  - `coverageRate = 68.09%`

해석:
- biocom도 이제 reconcile 숫자를 daily routine에 넣을 수 있다.
- 다만 `missingInToss` 상단은 같은 날 최근 주문이 많아 PG 반영 지연이 일부 섞인 것으로 보인다.

### 4. settlement backfill

- endpoint: `POST /api/toss/sync?store=biocom&mode=backfill&startDate=2025-01-01&endDate=2026-04-07`
- latest local stats:
  - `toss_settlements = 20,388`
  - `totalAmount = ₩4,863,790,709`
  - `totalFee = ₩143,684,067`
  - `totalPayout = ₩4,720,106,642`

해석:
- 순매출 기준을 닫기 위한 정산 원장은 크게 확장됐다.
- 하지만 장거리 backfill의 완료 응답/최종 coverage를 문서상으로 완전히 닫으려면 한 번 더 확인이 필요하다.

### 5. GA4 property access

- script: `npx tsx scripts/ga4-implementation-audit.ts --property 304759974 --property 326949178 --property 326993019`
- 결과:
  - `304759974`: `OK`
  - `326949178`: `OK`
  - `326993019`: `OK`

해석:
- coffee viewer 추가 이후 커피 property direct query는 더 이상 blocker가 아니다.
- `biocom` BigQuery legacy export 확인은 별도 이슈지만, GA4 Data API direct access 자체는 3개 property 모두 열린 상태다.

## 검증

- backend: `npx tsc --noEmit` 통과
- backend tests: `node --import tsx --test tests/attribution.test.ts tests/ads.test.ts tests/crm-local-imweb-order.test.ts` 통과
- frontend: `npx tsc --noEmit` 통과
- runtime:
  - `http://localhost:7021/api/attribution/caller-coverage`
  - `http://localhost:7021/api/crm-local/imweb/order-stats?site=biocom`
  - `http://localhost:7021/api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=5`
  - `http://localhost:7021/api/toss/local-stats`
  - `npx tsx scripts/ga4-implementation-audit.ts --property ...`

## 미해결 이슈

1. **caller 식별자 실유입**
   - live row는 쌓이지만 `ga_session_id / client_id / user_pseudo_id`가 아직 0%다.
   - 외부 checkout/payment_success caller 수정이 필요하다.

2. **biocom Imweb 과거 히스토리**
   - latest local `imweb_orders` 시작점이 `2026-01-27`이라 그 이전 주문 범위는 추가 확인이 필요하다.

3. **settlement backfill 완료 응답**
   - 적재는 크게 진행됐지만, 장거리 backfill 요청이 언제/어떻게 끝나는지와 최종 coverage 계산은 다시 점검해야 한다.

4. **biocom BigQuery legacy**
   - `hurdlers-naver-pay` raw export 상태와 조회 권한은 아직 허들러스 확인 대기다.
   - 다만 이건 coffee/aibio와 direct GA4 access 진행을 막는 blocker는 아니다.

## 다음 우선순위

1. 외부 checkout/payment_success caller에 `ga_session_id`, `client_id`, `user_pseudo_id` 실제 전송 붙이기
2. biocom Imweb sync의 과거 범위 누락 원인 확인
3. settlement backfill 완료 응답/coverage 최종 산출
4. 허들러스에 `hurdlers-naver-pay` dataset/권한 확인 요청
5. P3 첫 operational live 대상 1개 고정 후 실제 발송 실행
