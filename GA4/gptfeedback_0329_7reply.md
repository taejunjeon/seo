# GA4 7차 피드백 반영 결과

## 10초 요약

- 7차는 전략 토론이 아니라 `GTM 작업자가 바로 따라할 수 있는 실행 사양서`로 정리하는 작업이었고, 그 형식에 맞춰 코드와 출력기를 다시 짰습니다.
- 정본 기준은 그대로 `W2 / [G4] biocom.kr / 304759974 / G-WJFXN5E2Q1`입니다.
- `일반 구매 canonical sender = HURDLERS [이벤트전송] 구매`로 유지했고, `HURDLERS [이벤트전송] 네이버페이 구매`는 purchase 정본이 아니라 `npay_click 또는 보조 add_payment_info`로 재정의했습니다.
- 결과물은 API, Markdown 스크립트, 테스트, 상세 보고서까지 모두 반영했습니다.

---

## 이번 턴에서 실제 개발한 것

### 1) 실행 사양서용 plan 구조로 전면 개편

- `backend/src/ga4Cutover.ts`
  - 기존 `전략형 plan`을 `작업자 실행 사양서형 plan`으로 다시 설계
  - 새로 넣은 핵심 구조:
    - `gtmWorkSpec`
    - `pageViewExecutionPlan`
    - `purchasePayloadSpec`
    - `itemsValidationPlan`
    - `hurdlersCanonicalSpec`
    - `addPaymentInfoSpec`
    - `npayValidationPlan`
    - `materialRequests`
    - `Day 0 / Day 1 / Day 3 rollout`

### 2) Markdown 출력 순서 7차 형식으로 변경

- `backend/scripts/ga4-cutover-plan.ts`
  - 아래 순서로 출력되도록 변경
    1. 10초 요약
    2. 최신 확정 상태
    3. 정본 구조 선언
    4. GTM 작업 사양서
    5. page_view 중복 제거 실행안
    6. purchase payload 정합성 사양
    7. items 검증/보강안
    8. HURDLERS core event 정본화 사양
    9. add_payment_info 구현/정의안
    10. NPay 후속 검증안
    11. 주문 DB reconciliation 초안
    12. 필수자료 / 참고자료
    13. Day 0 / Day 1 / Day 3 작업 순서
    14. 최종 리스크

### 3) 테스트 갱신

- `backend/tests/ga4-cutover-plan.test.ts`
  - 7차 source of truth 반영 여부 검증
  - 특히 아래를 테스트로 고정:
    - W2/G-W 정본 구조
    - GTM 작업 spec에서 `GA4_픽셀=유지`, `GA4_픽셀2=pause`
    - `[new]Google 태그=rename`
    - `HURDLERS [이벤트전송] 구매=유지`
    - `HURDLERS [이벤트전송] 네이버페이 구매=rename`
    - `items source variable 존재`
    - `NPay는 support signal`
    - `필수자료 / 참고자료` 존재

---

## 요청 사항별 결과

| 요청 항목 | 상태 | 결과 |
| --- | --- | --- |
| 1. GTM 작업 사양서 작성 | 완료 | 요구한 태그 전부 포함해 표로 작성했습니다. 각 행에 `현재 상태`, `현재 목적지`, `바꿀 액션`, `이유`, `변경 후 기대 이벤트`, `검증 방법`을 넣었습니다. |
| 2. page_view 중복 제거 실행안 | 완료 | `GA4_픽셀`을 canonical sender로 고정하고, `GA4_픽셀2 pause`, `[new]Google 태그 shell 처리`, `direct gtag G-8 제거 시점`까지 정리했습니다. |
| 3. purchase payload 정합성 사양 | 완료 | `transaction_id`, `value`, `currency`, `items`, `shipping`, `tax`, `coupon`, `payment_type`를 4열 표로 정리했습니다. |
| 4. items 검증/보강안 | 완료 | `hurdlers_ga4.items` source, expected schema, Preview/dataLayer/DebugView 검증법, items가 안 보일 원인, payload shape 보정안을 정리했습니다. |
| 5. HURDLERS core event 정본화 사양 | 완료 | `상세페이지 조회`, `장바구니 담기`, `장바구니 보기`, `주문서작성`, `구매`, `회원가입 완료`를 각각 현재/목표 sender와 event name, params, 변수, 검증법까지 표로 정리했습니다. |
| 6. add_payment_info 구현/정의안 | 완료 | 일반 결제는 별도 `add_payment_info`, NPay는 `npay_click` 우선 권장으로 정리했습니다. |
| 7. NPay 후속 검증안 | 완료 | 왜 W2에서 최종 완료를 직접 보기 어려운지, 현재 신호, 재테스트 시점, fired 태그, DebugView 기대 이벤트, DB 대조 보완 방식을 체크리스트로 작성했습니다. |
| 8. 주문 DB reconciliation 초안 | 완료 | 테이블/컬럼 가정, 일반 구매/NPay 분리, 비교 포인트, pseudo-SQL 초안을 적었습니다. |
| 9. 추가 자료 요청 | 완료 | `필수자료`와 `참고자료`로 분리했고, 이미 확보된 자료는 다시 요구하지 않도록 최소화했습니다. |
| 출력 형식 준수 | 완료 | Markdown 출력기를 7차가 요구한 섹션 순서로 맞췄습니다. |
| 실제 GTM UI 클릭 수정 | 미구현 | GTM 운영 권한이 없어 코드/사양서 수준까지 구현했습니다. |
| 실제 NPay 회귀 실행 | 미구현 | 테스트 결제 권한과 운영 동선이 필요해 직접 실행하지 못했습니다. |

---

## 이번 턴에서 고정한 핵심 판단

### 1) NPay는 purchase 정본이 아니다

7차 source of truth에서 가장 중요한 변경점은 이 부분입니다.

이번 턴에서 저는 아래로 고정했습니다.

- `일반 구매 canonical sender = HURDLERS [이벤트전송] 구매`
- `HURDLERS [이벤트전송] 네이버페이 구매 = rename`
- target role = `npay_click 또는 보조 add_payment_info`

즉 이제 NPay에 대해서는:

- `purchase`를 W2 GTM에서 직접 끝까지 보겠다고 우기지 않고
- `클릭/진입 intent 추적 + 주문 DB 대조`

로 정의하는 것이 정본입니다.

### 2) items는 “없다”가 아니라 “source는 있는데 실측이 덜 끝났다”

이번 턴에서 `items`는 다음처럼 분리해 적었습니다.

- source variable 존재:
  - `HURDLERS - GA4 상품정보 = hurdlers_ga4.items`
- 하지만 DebugView 실측은 아직 미완료

즉 지금 상태는:

- `source 없음`이 아니라
- `source 있음 / payload shape or mapping 검증 미완료`

입니다.

그래서 이번 사양서는 `items 검증/보강안`을 따로 뽑았습니다.

### 3) [new]Google 태그는 삭제보다 역할 축소가 우선

7차에서도 `무조건 삭제`가 아니라:

- autonomous page_view를 보내는지 확인
- 보낸다면 off
- 기술적 shell 역할만 남길지 판단

으로 정리했습니다.

즉 작업자 관점에서는 `삭제`보다 `설정 확인 -> shell화`가 먼저입니다.

---

## 실제 구현 파일

- [ga4Cutover.ts](/Users/vibetj/coding/seo/backend/src/ga4Cutover.ts)
- [ga4-cutover-plan.ts](/Users/vibetj/coding/seo/backend/scripts/ga4-cutover-plan.ts)
- [ga4-cutover-plan.test.ts](/Users/vibetj/coding/seo/backend/tests/ga4-cutover-plan.test.ts)
- [gptfeedback_0329_7reply.md](/Users/vibetj/coding/seo/GA4/gptfeedback_0329_7reply.md)

---

## 검증 결과

### 타입/테스트

```bash
cd /Users/vibetj/coding/seo/backend
npm run typecheck
npx tsx --test tests/*.test.ts
```

결과:

- `npm run typecheck` 통과
- `npx tsx --test tests/*.test.ts` `44/44` 통과

### Markdown 출력 확인

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/ga4-cutover-plan.ts --format md
```

결과:

- 7차 피드백이 요구한 섹션 순서로 출력 확인

### API 응답 확인

```bash
curl http://localhost:7020/api/ga4/cutover-plan
```

확인 포인트:

- `canonicalDeclaration` 반환
- `gtmWorkSpec` 반환
- `purchasePayloadSpec.items.sourceExists = hurdlers_ga4.items`
- `addPaymentInfoSpec.npayDecision = npay_click 우선`
- `materialRequests.required` 반환
- `rollout = Day 0 / Day 1 / Day 3`

### 서버 상태

- `http://localhost:7010 -> 200`
- `http://localhost:7020/health -> 200`

---

## 이번 턴에 못한 것과 이유

### 1) GTM UI 실제 수정

못한 이유:

- GTM 운영 계정 권한이 없음
- Preview / Publish / rollback은 외부 운영 행위

### 2) NPay 실테스트

못한 이유:

- pay.naver.com 흐름 테스트에는 운영 결제 권한과 실주문 동선이 필요

### 3) items DebugView 확정

못한 이유:

- 현재 문서와 fact로는 `source variable 존재`까지만 확정
- 실제 DebugView expanded payload 캡처가 추가로 필요

---

## 다음 바로 할 일

1. GTM 작업자가 `GA4_픽셀2`, `GA4_주문완료_요소공개 2종`부터 처리
2. `[new]Google 태그`의 autonomous page_view 여부 확인
3. 일반 purchase DebugView expanded payload에서 `items` 확인
4. `HURDLERS [이벤트전송] 네이버페이 구매`를 `npay_click` 보조 이벤트로 rename
5. Day 3에 NPay 테스트 1건과 DB 대조 수행
