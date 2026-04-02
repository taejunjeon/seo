# GA4 6차 피드백 반영 결과

## 10초 요약

- 이번 턴에서 컷오버 판단이 한 단계 더 좁혀졌습니다.
- 정본은 그대로 `W2(GTM-W2Z6PHN) -> [G4] biocom.kr / 304759974 / G-WJFXN5E2Q1`입니다.
- 다만 이제는 `일반 purchase sender는 HURDLERS [이벤트전송] 구매`로 사실상 확정하는 쪽으로 plan을 바꿨습니다.
- 현재 남은 가장 큰 미완료는 `NPay 1건 회귀`와 `purchase items/shipping/tax/coupon/payment_type payload 보강`입니다.

---

## 이번 턴에서 실제 개발한 것

### 1) 컷오버 plan을 6차 기준으로 재정의

- `backend/src/ga4Cutover.ts`
  - 5차 plan을 6차 요구에 맞게 다시 정렬
  - 핵심 변경:
    - 최신 DebugView 사실 반영
    - `general purchase` owner를 `HURDLERS [이벤트전송] 구매`로 확정
    - `items payload 보강 필요`를 사실로 반영
    - `[new]Google 태그`를 tag matrix와 page_view 중복 제거안에 추가
    - `canonical event ownership` 표 구조를 6차 요구 포맷으로 변경
    - `HURDLERS core event 재정의안` 별도 섹션 추가
    - `NPay 후속 검증안` 별도 섹션 추가
    - 실행 순서를 `Day 0 / Day 1 / Day 3 / Day 7`로 재편

### 2) Markdown 출력 순서를 6차 포맷으로 변경

- `backend/scripts/ga4-cutover-plan.ts`
  - 출력 순서를 아래처럼 맞췄습니다.
    1. 10초 요약
    2. 최신 사실 반영 진단
    3. 정본 구조 선언
    4. 태그 분류표
    5. canonical event ownership 표
    6. page_view 중복 제거안
    7. purchase 컷오버안
    8. add_payment_info 구현안
    9. HURDLERS core event 재정의안
    10. NPay 후속 검증안
    11. 주문 DB reconciliation 설계
    12. Day 0 / Day 1 / Day 3 / Day 7 실행 순서
    13. 최종 리스크

### 3) 테스트 갱신

- `backend/tests/ga4-cutover-plan.test.ts`
  - 최신 verified fact 반영 여부
  - `[new]Google 태그` 포함 여부
  - general purchase owner가 HURDLERS 구매로 바뀌었는지
  - `items payload 보강 필요` 문구 반영 여부
  - `Day 0 / Day 1 / Day 3 / Day 7` 순서 반영 여부

---

## 요청 사항별 결과

| 요청 항목 | 상태 | 결과 |
| --- | --- | --- |
| 1. 최신 사실 반영한 최종 정본 구조 확정 | 완료 | `W2 / 304759974 / G-WJFXN5E2Q1` 정본, `W7=CRM 보조`, `G-8=legacy 제거 대상`으로 확정했습니다. |
| 2. 태그 분류표 업데이트 | 완료 | `[new]Google 태그`와 최신 HURDLERS 상태까지 포함해 4버킷으로 다시 분류했습니다. |
| 3. canonical event ownership 표 확정 | 완료 | 요구한 컬럼(`current owner`, `target owner`, `current/target destination`, `status`, `cutover action`, `required params`, `validation`)으로 재구성했습니다. |
| 4. page_view 중복 제거안 상세화 | 완료 | `GA4_픽셀`, `GA4_픽셀2`, `[new]Google 태그`, `direct gtag G-8` 순서로 정리했고, `[new]Google 태그`는 기술적 shell로 축소하는 방향으로 결론 냈습니다. |
| 5. purchase 컷오버안 확정 | 완료 | 일반 purchase는 `HURDLERS [이벤트전송] 구매`를 canonical sender로 확정했고, `items/shipping/tax/coupon/payment_type` 보강 계획도 넣었습니다. |
| 6. add_payment_info 구현안 작성 | 완료 | 일반 결제 / NPay 발화 시점, trigger 설계, `payment_type` 값, DebugView 정상/비정상 판정을 정리했습니다. |
| 7. HURDLERS core event 재정의안 | 완료 | `상세페이지 조회`, `장바구니 담기`, `장바구니 보기`, `주문서작성`, `구매`, `회원가입 완료` 각각에 대해 재활용 여부와 sender 정리안을 표로 만들었습니다. |
| 8. NPay 후속 검증안 | 완료 | 왜 지금 보류 가능한지, 언제 다시 테스트할지, 어떤 태그와 이벤트를 봐야 하는지 체크리스트로 만들었습니다. |
| 9. 주문 DB 대조 설계 | 완료 | `order_number`, `transaction_id`, `value`, `currency`, `purchase timestamp`, `pay_method`, `source/medium/campaign` 기준 reconciliation과 pseudo-SQL을 넣었습니다. |
| 10. 결과물 형식 | 완료 | Markdown 출력기가 6차가 요구한 13개 섹션 순서대로 출력됩니다. |
| 실제 GTM UI 수정/Publish | 미구현 | Codex가 GTM UI 권한이 없어 실제 클릭 수정은 못 했습니다. plan/API/스크립트 수준까지 구현했습니다. |
| 실제 NPay 1건 회귀 테스트 | 미구현 | 운영 결제 테스트 권한이 없어 이번 턴에 직접 끝내지 못했습니다. |
| purchase items payload 실측 보강 | 미구현 | 현재 DebugView fact는 `transaction_id/value/currency`까지만 확정돼 있고, `items/shipping/tax/coupon/payment_type`는 수집 설계까지만 완료했습니다. |

---

## 이번 턴에서 바뀐 핵심 판단

### 1) general purchase는 더 이상 “후보”가 아니다

이전 턴까지는:

- `GA4_구매전환_홈피구매`
- `HURDLERS [이벤트전송] 구매`

중 어느 쪽이 최종 sender가 될지 열어둔 상태였습니다.

이번 턴부터는:

- `HURDLERS [이벤트전송] 구매 -> purchase`
- `DebugView purchase 확인`
- `transaction_id/value/currency 확인`

까지 fact가 들어왔기 때문에,
`일반 purchase 정본 sender는 HURDLERS [이벤트전송] 구매`로 고정하는 것이 맞다고 판단했습니다.

즉:

- `GA4_구매전환_홈피구매`는 `replace_then_remove`
- `HURDLERS [이벤트전송] 구매`는 `keep`

으로 바뀌었습니다.

### 2) 하지만 purchase payload는 아직 완성본이 아니다

현재 fact:

- `transaction_id` 확인됨
- `value` 확인됨
- `currency=KRW` 확인됨

현재 미완료:

- `items`
- `shipping`
- `tax`
- `coupon`
- `payment_type`

즉 `purchase 자체는 성공`했지만,
`ecommerce payload completeness`는 아직 미완료입니다.

그래서 이번 plan에서는:

- sender는 확정
- payload는 보강

으로 분리했습니다.

### 3) NPay는 지금 컷오버를 막는 blocker가 아니라 마지막 gate다

지금 상태에서 가장 중요한 것은:

- general purchase가 정본 G-W 축에서 실제로 들어온다는 fact

입니다.

따라서 NPay는:

- 컷오버 전체를 멈추는 blocker가 아니라
- `legacy NPay tag 제거 전 마지막 회귀 gate`

로 두는 게 맞다고 판단했습니다.

---

## 실제 구현된 plan에서 중요한 결정

### page_view

- canonical sender: `GA4_픽셀`
- 먼저 pause: `GA4_픽셀2`
- `[new]Google 태그`: 제거보다 `autonomous page_view off + shell 역할만 유지`
- `direct gtag G-8`: W2 DebugView 안정화 후 제거

### view_item

- canonical sender: `HURDLERS [이벤트전송] 상세페이지 조회`
- 유지 이유: 이미 DebugView `view_item`이 보임

### add_to_cart

- canonical sender: `HURDLERS [이벤트전송] 장바구니 담기`
- `GA4_장바구니 담기`, `GA4_장바구니 담기2`는 제거 후보

### begin_checkout

- canonical sender: `HURDLERS [이벤트전송] 주문서작성`
- upstream dataLayer event: `h_begin_checkout`

### purchase

- general canonical sender: `HURDLERS [이벤트전송] 구매`
- NPay canonical candidate: `HURDLERS [이벤트전송] 네이버페이 구매`
- legacy tags:
  - `GA4_구매전환_홈피구매`
  - `GA4_구매전환_Npay`
  - `GA4_구매전환_Npay 2`
  는 제거 후보

### sign_up

- canonical sender: `GA4_회원가입`
- `HURDLERS [이벤트전송] 회원가입 완료`는 trigger/변수 참고만 하고 sender는 정리

---

## 이번 턴에 못한 것과 이유

### 1) GTM UI 실수정

못한 이유:

- GTM 접근 권한 없음
- Preview / Publish / rollback은 운영 계정 권한이 필요

### 2) NPay 실제 구매 검증

못한 이유:

- 테스트 결제 동선과 운영 권한 필요
- 이번 턴에서는 문서/plan/API/스크립트 수준까지가 안전 범위

### 3) items payload 실측 확보

못한 이유:

- 현재 fact는 DebugView에서 `transaction_id/value/currency`까지만 직접 확인된 상태
- `items/shipping/tax/coupon/payment_type`는 thank-you dataLayer나 DOM 변수 접근이 추가로 필요

### 4) W7 실제 구조 확인

못한 이유:

- 벤더 컨테이너 접근 권한 없음
- 그래서 `W7은 CRM 보조만 남기고 core KPI sender는 제거`라는 정책까지만 명시 가능

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

### Markdown 출력

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/ga4-cutover-plan.ts --format md
```

결과:

- 6차 피드백이 요구한 순서대로 출력 확인

### API 응답

```bash
curl http://localhost:7020/api/ga4/cutover-plan
```

확인 포인트:

- `canonicalDeclaration` 반환
- `latestDiagnosis` 반환
- `purchase target owner = 일반 구매: HURDLERS [이벤트전송] 구매 / NPay: HURDLERS [이벤트전송] 네이버페이 구매`
- `rollout = Day 0 / Day 1 / Day 3 / Day 7`
- `unresolvedConstraints`에 NPay와 payload 보강 이슈 포함

### 서버 상태

- `http://localhost:7010 -> 200`
- `http://localhost:7020/health -> 200`

---

## 다음 바로 할 일

1. 운영자가 GTM에서 `GA4_픽셀2`부터 pause
2. `[new]Google 태그`의 autonomous page_view off 확인
3. `HURDLERS [이벤트전송] 구매` payload에 `items/shipping/tax/coupon/payment_type` 보강
4. `add_payment_info` 신규 tag 반영
5. Day 3에 NPay 1건 회귀 후 `GA4_구매전환_Npay`, `GA4_구매전환_Npay 2` 정리
