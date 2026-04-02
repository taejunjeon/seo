# GTM/GA4 최종 컷오버 계획서

## 10초 요약

정본은 `W2(GTM-W2Z6PHN) -> [G4] biocom.kr / property 304759974 / measurement ID G-WJFXN5E2Q1`로 통일하는 것이 맞습니다.

- `W7(GTM-W7VXS4D8)`은 **CRM 전용 보조 컨테이너**로만 남김
- `G-8GZ48B1S59` 관련 태그는 **W2 정본 체계에서는 단계적으로 제거**
- 사이트 헤드의 direct gtag `G-8...`도 **W2 canonical 태그 검증 후 제거**
- HURDLERS라는 이름만 보고 지우면 안 됨
  - core web event면 W2 정본 태그로 이관 후 유지
  - CRM 전용이면 W7에만 남김

즉 이번 컷오버의 본질은
`W2를 Biocom 소유의 단일 분석 정본으로 복구하고, W7은 벤더 CRM 보조용으로 좁히는 작업`
입니다.

---

## 이번 턴에서 실제 개발한 것

이번 턴은 문서만 쓴 것이 아니라, 컷오버 계획을 코드로 재사용 가능하게 만들었습니다.

- `backend/src/ga4Cutover.ts`
  - W2/W7/G-W/G-8 기준 컷오버 계획을 구조화한 정적 plan 유틸
  - 태그 분류표, canonical event 매핑, 벤더 정책, 실행 순서, 리스크를 코드로 고정
- `backend/src/routes/ga4.ts`
  - `GET /api/ga4/cutover-plan` 추가
  - 프론트나 운영 툴에서 동일 계획을 JSON으로 읽을 수 있게 함
- `backend/scripts/ga4-cutover-plan.ts`
  - 서버 없이도 컷오버 계획을 JSON/Markdown으로 export 가능
- `backend/tests/ga4-cutover-plan.test.ts`
  - canonical structure와 bucket 분류, core ecommerce ownership 테스트 추가

즉 이제 컷오버 계획은 문서 한 장이 아니라,
`API + 스크립트 + 테스트`로 재검증 가능한 상태입니다.

예시:

```bash
curl http://localhost:7020/api/ga4/cutover-plan
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/ga4-cutover-plan.ts --format md
```

---

## 현재 문제 구조

현재 혼선은 3겹입니다.

1. **W2 안에 이미 두 measurement ID가 공존**
   - `GA4_픽셀 -> G-WJFXN5E2Q1`
   - `GA4_픽셀2 -> G-8GZ48B1S59`
   - 둘 다 All Pages, `send_page_view=true`

2. **구매/장바구니 같은 핵심 이벤트가 G-W / G-8로 이중 계열화**
   - `GA4_구매전환_Npay` / `GA4_구매전환_Npay 2`
   - `GA4_장바구니 담기` / `GA4_장바구니 담기2`

3. **사이트 헤드에 direct gtag `G-8...` 삽입 정황**
   - W2 밖에서도 `G-8...`로 page_view가 갈 수 있음

즉 지금은 같은 이벤트가 아래 여러 경로로 갈 수 있습니다.

- W2 -> G-W
- W2 -> G-8
- direct gtag -> G-8
- W7 -> CRM/vendor 목적지

이 상태에서는
`page_view`, `purchase`, `add_to_cart`가 어느 축에서 몇 번 잡혔는지 해석이 계속 흔들립니다.

---

## 태그 분류표

### W2에서 현재 확인된 태그

| 태그 | 현재 목적지 | 현재 상태 | 분류 | 판단 |
| --- | --- | --- | --- | --- |
| `GA4_픽셀` | `G-WJFXN5E2Q1` | 활성 / All Pages / `send_page_view=true` | 유지 | W2 정본 GA4 config 후보 |
| `GA4_픽셀2` | `G-8GZ48B1S59` | 활성 / All Pages / `send_page_view=true` | 교체 후 제거 | 정본과 중복되는 page_view 축 |
| `GA4_회원가입` | `G-WJFXN5E2Q1` / `sign_up` | 활성 | 유지 | W2 정본 `sign_up` 후보 |
| `GA4_구매전환_Npay` | `G-WJFXN5E2Q1` / `purchase` | 일시중지 | 추가 확인 필요 | 정본 purchase 후보이지만 paused 상태라 trigger/params 검증 필요 |
| `GA4_구매전환_Npay 2` | `G-8GZ48B1S59` / `purchase` | 활성 | 교체 후 제거 | G-8 purchase 계열은 정본 구조에서 제거 대상 |
| `GA4_구매전환_홈피구매` | `G-WJFXN5E2Q1` / `purchase` | 일시중지 | 추가 확인 필요 | 홈페이지 구매용 canonical purchase 후보 |
| `GA4_장바구니 담기` | `G-WJFXN5E2Q1` / `add_to_cart` | 일시중지 | 추가 확인 필요 | 정본 add_to_cart 후보이나 paused 상태 |
| `GA4_장바구니 담기2` | `G-8GZ48B1S59` / `add_to_cart` | 활성 | 교체 후 제거 | G-8 add_to_cart 계열 제거 대상 |
| `GA4_주문완료_요소공개` | `G-WJFXN5E2Q1` / `test` | 상태 미상 | 즉시 중지 가능 | 운영 KPI 이벤트가 아니고 test event |
| `GA4_주문완료_요소공개2` | `G-8GZ48B1S59` / `test` | 상태 미상 | 즉시 중지 가능 | 위와 동일 |

### direct gtag / 외부 축

| 항목 | 현재 상태 | 분류 | 판단 |
| --- | --- | --- | --- |
| direct gtag `G-8GZ48B1S59` | 사이트 코드 삽입 정황 있음 | 교체 후 제거 | W2 canonical 검증 후 제거 |
| `W7(GTM-W7VXS4D8)` 전체 | 벤더 CRM 보조 컨테이너 | 추가 확인 필요 | 핵심 web analytics는 제거하고 CRM 전용만 남겨야 함 |

---

## 핵심 이벤트별 정본 태그 후보

| 이벤트 | 정본 태그 후보 | 권장 목적지 | 판단 |
| --- | --- | --- | --- |
| `page_view` | `GA4_픽셀` 단일화 | `G-WJFXN5E2Q1` | W2 base config 하나만 남김 |
| `view_item` | W2 HURDLERS `[이벤트전송] 상세페이지 조회`를 표준 `view_item`으로 재정의 | `G-WJFXN5E2Q1` | 현재 표준 `view_item`이 비어 있으므로 신규/이관 필요 |
| `add_to_cart` | `GA4_장바구니 담기` 또는 W2 HURDLERS 장바구니 태그 | `G-WJFXN5E2Q1` | G-W 버전만 남기고 G-8 버전 제거 |
| `begin_checkout` | W2 HURDLERS `[이벤트전송] 주문서작성` | `G-WJFXN5E2Q1` | 정본 핵심 이벤트로 승격 |
| `add_payment_info` | W2 신규 생성 권장 | `G-WJFXN5E2Q1` | 현재 확인된 태그 목록에는 없음 |
| `purchase` | `GA4_구매전환_Npay` + `GA4_구매전환_홈피구매`를 W2 canonical purchase 계열로 정리 | `G-WJFXN5E2Q1` | payment flow별 trigger는 달라도 목적지는 하나로 통일 |
| `sign_up` | `GA4_회원가입` | `G-WJFXN5E2Q1` | 현행 tag를 canonical 유지 |

핵심 원칙은 간단합니다.

- 이벤트명은 표준 GA4 명칭으로
- 목적지는 `G-WJFXN5E2Q1` 하나로
- firing owner는 `W2` 하나로

---

## HURDLERS 계열 태그 분리

### 1) 실질적으로 바이오컴 정본 이벤트로 봐야 하는 것

아래는 이름이 HURDLERS라도 CRM 전용으로 버리면 안 됩니다.
이건 Biocom 핵심 퍼널 이벤트입니다.

- 상세페이지 조회 -> `view_item`
- 장바구니 담기 -> `add_to_cart`
- 장바구니 보기 -> `view_cart`
- 주문서작성 -> `begin_checkout`
- 회원가입 완료 -> `sign_up`
- 구매
- 네이버페이 구매

이 계열은
`W2 소유 / G-W 목적지 / 표준 이벤트명`
으로 재정의해서 유지해야 합니다.

### 2) 리토스 CRM 전용으로 남겨도 되는 것

아래 유형은 W7에만 남겨도 됩니다.

- 리타겟팅/CRM 성과 집계 전용 커스텀 이벤트
- 상담/CRM 파이프라인 전용 이벤트
- 벤더 내부 성과 대시보드에서만 쓰는 보조 이벤트
- 핵심 웹 퍼널과 직접 연결되지 않는 진단성 태그

즉 분리 기준은 이름이 아니라 목적입니다.

- `매출 / 퍼널 / 가입 / 구매`에 직접 쓰이면 W2 정본
- `CRM 보조 운영 / 벤더 내부 대시보드`면 W7 보조

---

## 정본 구조 제안

### 최종 권장 구조

#### W2

- 유지 대상:
  - `GA4_픽셀` -> `G-WJFXN5E2Q1`
  - `GA4_회원가입`
  - W2 소유의 표준 ecommerce 이벤트 태그
    - `view_item`
    - `add_to_cart`
    - `begin_checkout`
    - `add_payment_info`
    - `purchase`

- 정리 대상:
  - `GA4_픽셀2`
  - `GA4_구매전환_Npay 2`
  - `GA4_장바구니 담기2`
  - `G-8...` 목적지의 중복 이벤트 태그
  - `test` 이벤트 태그

#### W7

- 남길 역할:
  - CRM 전용 보조 컨테이너
  - 벤더 내부 성과 보조 태그
  - Biocom 핵심 퍼널과 분리된 CRM event만

- 남기면 안 되는 역할:
  - Biocom 정본 page_view
  - Biocom 정본 ecommerce
  - Biocom 정본 purchase
  - Biocom 정본 sign_up

### direct gtag 제거 시점

direct gtag `G-8...`는 **즉시 제거가 아니라**, 아래 조건 충족 후 제거가 맞습니다.

1. W2 canonical tag 세트 구성 완료
2. GTM Preview에서 page_view / core ecommerce / purchase 1회 발화 확인
3. DebugView에서 `G-W` property만 기준선으로 검증 완료
4. 주문 DB 대조까지 1차 완료

그 다음 CMS 헤드코드에서 제거합니다.

---

## 컷오버 실행 순서

### 1) 사전 점검

- W2 현재 태그/트리거/변수 export
- W7 벤더 측 태그 목록 요청
- CMS 헤드/푸터 삽입 코드 백업
- purchase flow별 분기 확인
  - 일반 결제
  - NPay
- 현재 `transaction_id` 규칙 확인

### 2) GTM Preview 준비

- W2에 canonical workspace 생성
- `GA4_픽셀`만 정본 config로 확정
- `GA4_픽셀2`는 pause 예정 상태로 표시
- `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `sign_up` 표준 이벤트 세트 준비

### 3) 태그 중지 / 교체

#### 즉시 중지 가능

- `GA4_주문완료_요소공개`
- `GA4_주문완료_요소공개2`

#### 교체 후 제거

- `GA4_픽셀2`
- `GA4_구매전환_Npay 2`
- `GA4_장바구니 담기2`
- direct gtag `G-8...`

#### 재활성 / 재정의

- `GA4_구매전환_Npay`
- `GA4_구매전환_홈피구매`
- `GA4_장바구니 담기`
- HURDLERS core web event tags

### 4) 사이트 헤드코드 정리

- direct gtag `G-8...` 제거
- W2 container는 유지
- W7 container는 유지 가능
  - 단, core web analytics 태그는 비워진 상태여야 함

### 5) DebugView 검증

검증 기준:

- `page_view`
- `view_item`
- `add_to_cart`
- `begin_checkout`
- `add_payment_info`
- `purchase`
- `sign_up`

체크 포인트:

- 모두 `G-WJFXN5E2Q1` 기준 property로 들어오는지
- 동일 액션이 2번 안 찍히는지
- purchase에 `transaction_id`, `value`, `currency`, `items`가 들어오는지

### 6) 주문 DB / GA4 대조

최소 대조:

- 주문 건수
- `transaction_id` 유니크 건수
- 결제수단별 purchase count
- GA4 purchase vs 주문 DB order count
- GA4 revenue vs 주문 DB net/gross 기준 차이

### 7) 컷오버 후 관찰

- 3일
- 7일
- 14일

이 구간 동안 legacy `G-8`과 W7 영향이 재발하지 않는지 확인합니다.

---

## 벤더 요청사항

W7 접근 권한이 없으므로 아래 자료를 벤더에 반드시 요청해야 합니다.

1. `GTM-W7VXS4D8` 전체 태그/트리거/변수 export
2. W7에서 발화 중인 GA4 목적지 목록
   - measurement ID
   - property
   - event name
3. W7에서 `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `sign_up` 중 무엇을 쏘는지
4. `rebuyz_view -> view_item` 매핑 여부
5. W7 안에 `purchase` 또는 `transaction_id` 가공 로직이 있는지
6. W7에서 CRM 보조 이벤트만 남기고 core web analytics는 제거하겠다는 확인서
7. 컷오버 이후 W7 역할 정의 문서
   - 무엇은 남고
   - 무엇은 제거되는지

---

## 외부 대행사 컨테이너 접근권한 없음 전제의 운영 정책

### W7에 남길 역할

- CRM 전용 보조 이벤트
- 벤더 내부 성과 보조 측정
- Biocom 정본 지표와 분리된 운영용 태그

### 반드시 W2에서 소유해야 하는 데이터

- `page_view`
- `view_item`
- `add_to_cart`
- `begin_checkout`
- `add_payment_info`
- `purchase`
- `sign_up`
- `transaction_id` 기준 매출 검증

즉 매출과 퍼널에 쓰는 이벤트는
반드시 W2에서 소유해야 합니다.

### 운영 원칙

1. Biocom KPI에 쓰는 이벤트는 W2만 정본
2. W7은 보조 컨테이너
3. 벤더 접근권한이 없으면 export / 캡처 / 확인서로 통제
4. 벤더 컨테이너가 정본 KPI를 대신 보내는 구조는 금지

---

## 최종 리스크

1. **W7 내부에 아직 core web analytics가 살아 있으면 중복이 계속 남음**
2. **direct gtag를 너무 빨리 제거하면 데이터 공백이 생길 수 있음**
3. **purchase flow가 일반 결제 / NPay로 갈라져 있으면 하나만 살리고 하나를 놓칠 위험이 있음**
4. **HURDLERS 이름만 보고 삭제하면 core event가 같이 사라질 수 있음**
5. **W2 canonical tag는 맞췄는데 CMS 또는 다른 숨김 코드에서 `G-8...`가 계속 쏘면 split이 완전히 안 닫힘**

---

## 최종 권고

실행 우선순위는 아래가 맞습니다.

1. `W2 -> G-WJFXN5E2Q1` 체계를 정본으로 확정
2. `G-8...` 목적지 태그를 W2에서 먼저 정리
3. direct gtag `G-8...` 제거
4. W7은 CRM 전용만 남기고 core analytics 제거

한 줄로 정리하면:

`W2가 Biocom의 단일 정본 컨테이너, W7은 CRM 보조 컨테이너`

이 구조로 닫는 것이 맞습니다.

---

## 검증 결과

- `backend`: `npm run typecheck` 통과
- `backend`: `npx tsx --test tests/*.test.ts` `41/41` 통과
- `backend`: `npx tsx scripts/ga4-cutover-plan.ts --format md` 실행 성공
- `runtime`: `GET /api/ga4/cutover-plan` 응답 확인
  - `keep=2`
  - `replace_then_remove=4`
  - `stop_now=2`
  - `needs_review=4`
- 서버 상태
  - `http://localhost:7010 -> 200`
  - `http://localhost:7020/health -> 200`
