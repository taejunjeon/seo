# GA4 5차 피드백 반영 결과

## 10초 요약

- 5차 피드백에서 요구한 `실행 가능한 컷오버 지시서`를 `API + 스크립트 + 테스트`로 구현했습니다.
- 정본 기준은 `W2(GTM-W2Z6PHN) -> [G4] biocom.kr / property 304759974 / measurement ID G-WJFXN5E2Q1`로 고정했습니다.
- 태그 4버킷 분류, canonical event ownership, `view_item`, `add_payment_info`, `page_view`, `purchase`, `W7 정책`, `체크리스트`, `주문 원장 reconciliation`, `Day 0/1/2/7`까지 코드로 구조화했습니다.
- 다만 실제 GTM 클릭 수정, W7 export 확보, 운영 purchase 1건 DebugView 검증, Admin enhanced measurement 비교는 권한 제약 때문에 이번 턴에 직접 끝내지 못했습니다.

---

## 이번 턴에서 실제 개발한 것

### 1) 컷오버 plan 데이터 구조 확장

- `backend/src/ga4Cutover.ts`
  - 기존 요약형 plan을 5차 피드백 요구 수준으로 확장
  - 포함 내용:
    - 4버킷 태그 분류
    - canonical event ownership 표 데이터
    - `view_item` 상세 구현안
    - `add_payment_info` 상세 구현안
    - `page_view` 중복 제거안
    - `purchase` 컷오버안
    - `W7` 운영 정책
    - GTM/운영/검증 체크리스트
    - 주문 원장 reconciliation pseudo-SQL
    - `Day 0 / Day 1 / Day 2 / Day 7` 실행 순서
    - 사실 vs 추론 구분
    - 이번 턴에서 못한 항목과 제약

### 2) Markdown 출력기 업그레이드

- `backend/scripts/ga4-cutover-plan.ts`
  - 이제 5차 피드백 문서가 요구한 순서 그대로 Markdown을 뽑습니다.
  - 출력 순서:
    1. 10초 요약
    2. 현재 구조 진단
    3. 태그 분류표
    4. canonical event ownership 표
    5. `view_item` 상세 구현안
    6. `add_payment_info` 상세 구현안
    7. `page_view` 중복 제거안
    8. `purchase` 컷오버안
    9. `W7` 운영 정책
    10. GTM 작업 체크리스트
    11. DebugView / 주문DB 검증 체크리스트
    12. 최종 리스크
    13. 실제 수정 순서 `Day 0 / Day 1 / Day 2 / Day 7`

### 3) 회귀 테스트 추가

- `backend/tests/ga4-cutover-plan.test.ts`
  - 4버킷 고정 여부
  - 필수 태그 포함 여부
  - core ecommerce ownership
  - `view_item` / `add_payment_info` / reconciliation 가이드 존재 여부
  - 새 GTM 컨테이너를 제안하지 않는지
  - `W7은 CRM 보조, W2는 KPI 정본` 원칙 유지 여부

### 4) 기존 API 응답 확장

- 기존 `GET /api/ga4/cutover-plan`은 그대로 두고, 내부 plan 구조만 확장했습니다.
- 즉 프론트나 운영 도구는 같은 endpoint로 더 풍부한 실행 계획을 읽을 수 있습니다.

---

## 요청 사항별 결과

| 요청 항목 | 상태 | 결과 |
| --- | --- | --- |
| 1. 4버킷 최종 태그 분류표 | 완료 | `keep / redefine_then_keep / replace_then_remove / stop_now` 4버킷으로 강제했고, 요청한 필수 태그 17개를 모두 plan에 넣었습니다. |
| 2. canonical event ownership 표 | 완료 | `page_view`, `view_item`, `view_cart`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `sign_up`를 표 형태로 구조화했습니다. |
| 3. `view_item` 상세 구현안 | 완료 | trigger, firing 시점, payload, `rebuyz_view` 관계, HURDLERS 재활용 방안, Preview/DebugView 검증까지 넣었습니다. |
| 4. `add_payment_info` 상세 구현안 | 완료 | 일반 결제/NPay 각각의 발화 시점, payload, PG 직전 단절 분해 이유, DebugView 연결 기준까지 넣었습니다. |
| 5. `page_view` 중복 차단안 | 완료 | `먼저 끌 것 / 나중에 끌 것 / Preview 전에는 건드리면 안 되는 것`으로 나눠 정리했습니다. |
| 6. `purchase` 컷오버안 | 완료 | 일반 구매/NPay 분리, G-W 정본화, G-8 제거 순서, `transaction_id` 검증, 주문 원장 대조 방식, owner 판단까지 넣었습니다. |
| 7. `W7` 운영 정책 | 완료 | `W7은 CRM 보조, W2는 KPI 정본` 원칙과 keep/remove/evidence/validation을 명시했습니다. |
| 8. 실제 실행 체크리스트 | 완료 | GTM 작업자용, 대표/운영 확인용, DebugView/주문DB 검증용 체크리스트를 각각 구현했습니다. |
| 9. 주문 원장 reconciliation 설계 | 완료 | 키 목록, 접근 방식, pseudo-SQL을 plan에 넣었습니다. |
| 10. 결과물 형식 | 완료 | Markdown 스크립트가 5차 피드백 요구 순서 그대로 출력합니다. |
| 실제 GTM UI 수정/Publish | 미구현 | Codex가 GTM UI 접근권한이 없어서 실제 클릭 수정은 못 했습니다. 대신 클릭 직전 수준의 작업지시서를 코드로 만들었습니다. |
| 실제 CMS 헤드 `direct gtag` 제거 | 미구현 | CMS 운영 권한이 없어서 직접 제거할 수 없었습니다. 제거 순서와 안전 조건만 문서화했습니다. |
| W7 export 확보 | 미구현 | 벤더 컨테이너 접근권한이 없어 증빙 요청 항목만 정리했습니다. |
| 운영 purchase 1건 DebugView 검증 | 미구현 | 실제 결제 테스트 권한과 운영 동선이 필요해 이번 턴에 직접 끝내지 못했습니다. |
| enhanced measurement 설정 차이 비교 | 미구현 | Admin API가 `SERVICE_DISABLED` 또는 권한 부족 상태라 자동 비교가 불가능했습니다. |

---

## 실제로 구현된 핵심 결정

### 태그 분류 원칙

- `GA4_픽셀`, `GA4_회원가입`은 정본 유지
- `GA4_구매전환_Npay`, `GA4_구매전환_홈피구매`, `GA4_장바구니 담기`, HURDLERS core web event는 `재정의 후 유지`
- `GA4_픽셀2`, `GA4_구매전환_Npay 2`, `GA4_장바구니 담기2`, `direct gtag G-8`은 `교체 후 제거`
- `GA4_주문완료_요소공개`, `GA4_주문완료_요소공개2`는 `즉시 중지 가능`

### canonical ownership 원칙

- 최종 owner는 `W2`
- 최종 목적지는 `G-WJFXN5E2Q1`
- 이름이 `HURDLERS`여도 core web event면 버리지 않고, trigger/변수 재활용 후 W2 정본 이벤트로 재정의
- `W7`은 core KPI owner가 아니라 CRM 보조 컨테이너

### `view_item` 판단

- 현재 accessible 코드에서는 `rebuyz_view`만 직접 확인됐고 표준 `view_item`은 비어 있거나 불명확
- 따라서 `view_item`은 반드시 복구해야 할 우선순위 이벤트
- HURDLERS 상세페이지 조회가 usable하면 재활용하되, 최종 event name/payload는 표준 `view_item`

### `add_payment_info` 판단

- 지금 가장 비어 있는 고리
- `begin_checkout -> purchase` 사이 단절을 분해하려면 필수
- 일반 결제/NPay 모두 PG 직전 1회 발화가 맞음

### `purchase` ownership 판단

- 정본 owner는 `W2 GTM`이 가장 적합
- 이유:
  - Biocom 소유
  - Preview/Publish/rollback 가능
  - payload 통일 가능
- `direct gtag`는 통제가 약해서 부적합
- `HURDLERS`는 trigger/데이터 공급원으로는 써도 정본 owner가 되면 안 됨

---

## 이번 턴에 못한 것과 이유

### 1) GTM 운영 화면에서 실제 태그를 끄고 켜는 작업

못한 이유:

- Codex에게 GTM 컨테이너 UI 권한이 없음
- Preview / Publish / Version restore는 운영 계정 행위라 여기서 직접 수행 불가

### 2) W7 내부 실제 태그 구조 확인

못한 이유:

- W7은 외부 벤더 컨테이너라 export 접근권한이 없음
- 따라서 `무엇이 남아 있고 무엇을 제거해야 하는지`는 정책/요청 항목까지만 정리 가능

### 3) 운영 결제 1건을 직접 만들어 DebugView 검증

못한 이유:

- 실제 결제 환경 접근과 테스트 주문 동선이 필요
- 일반 결제/NPay 둘 다 운영 자금/운영 정책과 연결될 수 있어 임의 실행 불가

### 4) GA4 Admin 기반 enhanced measurement 비교

못한 이유:

- 현재 환경에서 Admin API가 `SERVICE_DISABLED` 또는 권한 부족
- 그래서 두 property/stream의 관리자 설정 차이는 코드로 자동 비교하지 못함

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

### 스크립트 출력 확인

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/ga4-cutover-plan.ts --format md
```

결과:

- 5차 피드백 요구 순서대로 Markdown 출력 확인

### API 응답 확인

```bash
curl http://localhost:7020/api/ga4/cutover-plan
```

확인 포인트:

- canonical = `W2 / 304759974 / G-WJFXN5E2Q1`
- tag count = `19`
- bucket keys = `keep / redefine_then_keep / replace_then_remove / stop_now`
- canonical events = `page_view / view_item / view_cart / add_to_cart / begin_checkout / add_payment_info / purchase / sign_up`
- unresolved constraints = 4개 반환 확인

### 서버 상태

- `http://localhost:7010 -> 200`
- `http://localhost:7020/health -> 200`

---

## 다음 바로 할 일

1. 운영자가 W2 Preview에서 `GA4_픽셀2`, `GA4_주문완료_요소공개 2종`부터 처리
2. `view_item`, `add_payment_info`, `purchase` canonical payload를 실제 GTM UI에 반영
3. 벤더에게 W7 export와 `core analytics off` 증빙 요청
4. 일반 결제 1건 / NPay 1건 테스트로 DebugView 검증
5. 주문 원장과 `transaction_id` 기준 reconciliation 실행
