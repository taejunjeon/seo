# GA4 4차 피드백 반영 결과

## 10초 요약

최우선 가설은 이제 `property / stream split`입니다.

- 라이브 HTML에서 **직접 확인된 것**은 `G-8GZ48B1S59` + `GTM-W7VXS4D8` + `GTM-W2Z6PHN`
- TJ님이 운영 화면에서 확인한 사실상 **동시에 활성인 다른 축**은 `[G4] biocom.kr / G-WJFXN5E2Q1`
- 현재 SEO 백엔드는 `GA4_PROPERTY_ID=304759974`를 읽고 있어서, **대시보드가 보는 property**, **라이브 사이트가 직접 보내는 stream**, **운영 화면에서 활성인 legacy property**가 서로 갈라져 있을 가능성이 높음

즉 지금 문제는 단순한 이벤트 누락 하나가 아니라,
`어느 이벤트가 어느 property/stream으로 가는지 체계가 분리된 상태`로 보는 게 가장 맞습니다.

---

## 이번 턴에서 실제로 개발한 것

반복 가능한 감사 도구를 추가했습니다.

- `backend/src/utils/ga4ImplementationAudit.ts`
  - 라이브 HTML에서 measurement ID, GTM container, `user_id`, `rebuyz_utm`, `rebuyz_view`, `view_item` 주석 여부를 추출하는 유틸
- `backend/scripts/ga4-implementation-audit.ts`
  - 라이브 사이트 3개 도메인과 코드베이스를 함께 점검하는 감사 스크립트
  - `--property` 인자로 property 접근 가능 여부까지 같이 확인 가능
- `backend/tests/ga4-implementation-audit.test.ts`
  - 위 감사 로직 단위 테스트

재현 명령:

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/ga4-implementation-audit.ts --property 429378830
```

---

## 확인된 사실

### 1) 라이브 사이트 HTML에서 직접 확인된 삽입 구조

아래 3개 도메인 모두 같은 구조였습니다.

- `https://biocom.kr`
- `https://www.biocom.kr`
- `https://biocom.imweb.me`

직접 확인된 삽입:

- direct gtag: `G-8GZ48B1S59`
- GTM: `GTM-W7VXS4D8`
- GTM: `GTM-W2Z6PHN`
- body `<noscript>`에도 GTM 2개 존재
- `send_page_view: false` 같은 중복 방지 설정은 HTML에서 보이지 않음
- `allow_linker`, `_gl`, `cross_domain` 관련 힌트도 HTML에서는 보이지 않음

즉 코드로 확인 가능한 최소 사실은:
`현재 라이브 사이트는 direct gtag 1개 + GTM 2개가 동시에 들어가 있다` 입니다.

### 2) 커스텀 스크립트에서 직접 확인된 로직

라이브 HTML에서 아래를 직접 확인했습니다.

- `gtag('set', { user_id: userID })`
- `rebuyz_utm` 로컬스토리지 저장
- 단, `if (userID)` 안에서만 저장
- UTM이 없으면 `'0'` 문자열 저장
- 표준 `view_item` 전송은 주석 처리
- 대신 `gtag('event', 'rebuyz_view', ...)` 전송

즉 현재 코드 기준으로는
`표준 ecommerce product-view 체계보다 custom event 체계가 먼저 보이는 상태`입니다.

### 3) 운영 화면에서 TJ님이 추가로 확인한 사실

운영 화면 fact는 아래로 반영했습니다.

- 최근 48시간 기준 **서로 다른 2개 속성/웹 스트림이 모두 활성**
- `429378830` 속성의 웹 스트림 `7575892737`, measurement ID `G-8GZ48B1S59`
- 별도 `[G4] biocom.kr` 속성의 measurement ID `G-WJFXN5E2Q1`

이 사실 때문에 최우선 가설은 이제 `property / stream split`입니다.

추가로, 이번 턴에 제가 만든 감사 스크립트/테스트 파일을 제외한
실제 active app code 범위
`seo/frontend`, `seo/backend/src`, `revenue/frontend/apps/portal`, `revenue/backend/app`
에서는 `G-W...`, `G-8...`, 두 GTM ID, `rebuyz_view`가 직접 박힌 기존 운영 코드 흔적을 찾지 못했습니다.

즉 현재 확인된 삽입은
`저장소 안의 웹앱 코드`보다 `라이브 CMS/GTM 삽입 레이어` 쪽에 더 가깝습니다.

### 4) 현재 SEO 백엔드가 보고 있는 property

현재 SEO 백엔드 환경값은 아래입니다.

- `backend/.env`
  - `GA4_PROPERTY_ID=304759974`

그리고 실제 API 응답 메타에서도 현재 백엔드가 읽는 property는 다음으로 확인됐습니다.

- `/api/ga4/seo-conversion-diagnosis`
  - `_meta.propertyId = "properties/304759974"`

즉 현재 시점에는 최소 3개의 축이 보입니다.

1. 라이브 HTML에서 직접 보이는 stream: `G-8GZ48B1S59`
2. 운영 화면에서 최근 48시간 활성로 확인한 legacy property: `G-WJFXN5E2Q1`
3. SEO 백엔드가 실제 조회 중인 property: `304759974`

### 5) 서비스 계정 접근 가능 여부

이번 턴에 서비스 계정으로 Data API 접근까지 확인했습니다.

- `304759974`: 접근 가능
- `429378830`: `PERMISSION_DENIED`

즉 지금 SEO 백엔드는 **현재 라이브 direct gtag가 붙은 property를 읽고 있지 않을 가능성**이 매우 큽니다.

### 6) Enhanced Measurement 비교 가능 여부

코드로 직접 비교하려고 Admin API도 점검했지만 막혔습니다.

- `analyticsadmin.googleapis.com`: 현재 서비스 계정 프로젝트에서 `SERVICE_DISABLED`
- 그래서 두 property/stream의 enhanced measurement 설정 차이는 **코드로 자동 비교 불가**
- 이 항목은 운영 화면에서 직접 확인해야 함

---

## 코드 감사 표

| 위치 | 코드 종류 | 현재 ID | 위험도 | 왜 위험한가 | 바로 수정 가능 |
| --- | --- | --- | --- | --- | --- |
| 라이브 HTML `<head>` | direct gtag | `G-8GZ48B1S59` | 높음 | GTM 2개와 함께 있으면 page_view / ecommerce 이중 발화 가능성이 생김 | 예 |
| 라이브 HTML `<head>/<body>` | GTM snippet | `GTM-W7VXS4D8` | 높음 | 다른 GTM과 같이 있으면 같은 이벤트를 다른 규칙으로 중복 발화시킬 수 있음 | 부분 가능 |
| 라이브 HTML `<head>/<body>` | GTM snippet | `GTM-W2Z6PHN` | 높음 | 위와 같음 | 부분 가능 |
| 라이브 HTML custom script | identity | `gtag('set', { user_id })` | 중간 | 초기 page_view 시점과 로그인 식별 시점이 어긋나면 user/session attribution이 갈라질 수 있음 | 예 |
| 라이브 HTML custom script | UTM persistence | `rebuyz_utm` | 높음 | 비로그인 첫 방문에서는 저장이 안 되어 첫 attribution이 사라질 수 있음 | 예 |
| 라이브 HTML custom script | UTM persistence | `'0'` fallback | 높음 | null 대신 `'0'`이 source/medium 값으로 남아 오염 가능 | 예 |
| 라이브 HTML custom script | ecommerce custom event | `rebuyz_view` | 높음 | 표준 `view_item` 대신 custom event만 가면 GA4 ecommerce 기본 보고서와 퍼널이 비어 보일 수 있음 | 예 |
| 라이브 HTML custom script | ecommerce standard event | `view_item` 주석 처리 | 높음 | product-view가 표준 schema로 안 들어갈 수 있음 | 예 |
| `backend/.env` + `backend/src/routes/ga4.ts` | dashboard property config | `304759974` | 높음 | 현재 대시보드가 라이브 direct stream과 다른 property를 읽을 가능성이 큼 | 예 |

---

## 질문별 답변

### A. 현재 코드베이스 안에서 실제로 어느 GA4 measurement ID들이 살아 있는가?

사실:

- **라이브 HTML에서 직접 확인된 measurement ID는 `G-8GZ48B1S59` 하나**
- **운영 화면 fact로 현재도 활성이라고 확인된 measurement ID는 `G-WJFXN5E2Q1`**
- **현재 SEO 백엔드 query 대상은 measurement ID가 아니라 property `304759974`**

해석:

- `G-8...`는 코드로 직접 확인된 live stream
- `G-W...`는 운영 화면 fact로는 살아 있으나, 현재 저장소와 라이브 HTML에서는 source가 안 보임

### B. direct gtag와 GTM이 동시에 이벤트를 보낼 가능성이 있는가?

예. 높습니다.

사실:

- direct gtag 존재
- GTM 2개 존재
- `send_page_view: false` 미발견

추론:

- direct gtag는 기본 `config`만으로도 `page_view`를 보낼 수 있음
- GTM 내부에 GA4 태그가 있으면 page_view/ecommerce 중복 가능

단, GTM 내부 태그 구성을 코드로 본 것은 아니므로
`실제 몇 번 중복되는지`는 운영 GTM 화면 확인이 필요합니다.

### C. `view_item` 표준 이벤트가 실제로 발화되는가, 아니면 `rebuyz_view`만 보내는가?

코드로 직접 확인된 범위에서는
`view_item`은 주석 처리,
`rebuyz_view`만 활성입니다.

즉 현재 accessible 코드 기준 답은:
`표준 view_item은 미확인, rebuyz_view만 확인`
입니다.

### D. `rebuyz_view`가 GTM이나 서버 코드에서 `view_item`으로 변환되는가?

현재 저장소와 라이브 HTML에서는 **변환 코드 미발견**입니다.

즉 코드 기준 답은:
`미확인`

가능성은 남아 있습니다.

- GTM 내부 태그/변수/트리거
- CMS 숨김 스크립트
- server-side tagging

하지만 지금 가진 코드만으로는 확인할 수 없습니다.

### E. UTM 저장 로직이 비로그인 첫 방문 attribution을 잃게 만들 가능성이 있는가?

예. 매우 높습니다.

이유:

- `rebuyz_utm` 저장이 `if (userID)` 안에 있음
- 즉 로그인/식별 전 첫 방문은 UTM이 저장되지 않을 수 있음

그래서 첫 방문 유입이
후속 결제 시점에 사라지거나 `(not set)`로 밀릴 가능성이 있습니다.

### F. `'0'` 문자열 저장이 source/medium 오염을 만들 가능성이 있는가?

예.

`null`이나 미전송이어야 할 값이 `'0'`로 저장되면,
이후 후처리나 custom dimension 로직에서 `'0'`이 실제 source처럼 남을 수 있습니다.

즉 이건 단순 결측치가 아니라,
`가짜 값으로 오염될 위험`입니다.

### G. purchase 이벤트 발화가 어느 레이어에서 처리되는가?

현재 accessible 코드 기준으로는 **확정 불가**입니다.

사실:

- 라이브 HTML 공통 코드에서는 GA purchase 발화 코드를 못 찾음
- 저장소 app code에서도 purchase 발화 구현을 못 찾음
- 운영 화면 fact로는 둘 이상의 property가 활성

그래서 현재 우선순위는 다음 순서입니다.

1. GTM 내부 태그
2. CMS 주문완료 페이지/숨김 스크립트
3. 다른 삽입 스크립트
4. Measurement Protocol / server-side tagging

현재 코드 증거만 놓고 보면
`G-W...`의 현재 활성 원인도 이 레이어들 안에 있을 가능성이 높습니다.

### H. measurement ID 변경만으로도 기존 대시보드/백엔드 property 조회와 불일치가 생길 가능성이 있는가?

예. 이미 그 신호가 강합니다.

사실:

- 라이브 direct gtag: `G-8...`
- 운영 활성 legacy property: `G-W...`
- SEO 백엔드 query property: `304759974`

이 셋이 다르면 대시보드/Explore/Realtime/DebugView/보고서 숫자가 서로 다른 건 충분히 가능합니다.

---

## 이벤트별로 어느 속성으로 가는지 정리

아래 표는 `사실`과 `추론`을 분리해서 적었습니다.

| 이벤트 | `429378830 / 7575892737 / G-8GZ48B1S59` | `[G4] biocom.kr / G-WJFXN5E2Q1` | 근거 | 현재 판정 |
| --- | --- | --- | --- | --- |
| `page_view` | **확정적으로 갈 가능성 높음** | **활성 사실은 있으나 발화 레이어 불명** | 라이브 HTML에 direct `gtag('config','G-8...')` 존재, `send_page_view:false` 미발견. G-W는 운영 화면에서 최근 48시간 활성 | `G-8`은 강한 사실, `G-W`는 운영 사실 + 레이어 불명 |
| `view_item` | **표준 이벤트는 미확인**. 대신 `rebuyz_view`는 확인 | 불명 | 라이브 HTML에서 `view_item` 주석, `rebuyz_view` 활성. GTM 매핑 여부 미확인 | 표준 `view_item` 누락 가능성 높음 |
| `add_to_cart` | 불명 | 불명 | 저장소/라이브 HTML 공통 코드에서 미발견 | GTM/CMS/다른 페이지 확인 필요 |
| `begin_checkout` | 불명 | 불명 | 저장소/라이브 HTML 공통 코드에서 미발견 | GTM/CMS/다른 페이지 확인 필요 |
| `add_payment_info` | 불명 | 불명 | 저장소/라이브 HTML 공통 코드에서 미발견 | GTM/CMS/다른 페이지 확인 필요 |
| `purchase` | 불명 | 불명 | 공통 코드에서 미발견. 다만 기존 진단상 실제 purchase는 있고, legacy property도 활성 | GTM / 주문완료 페이지 / MP / server-side tagging 중 하나 가능 |

핵심은 이것입니다.

- `page_view`는 `G-8`로 직접 가는 증거가 강함
- `view_item`은 표준 이벤트가 현재 깨져 있을 가능성이 큼
- checkout/purchase 계열은 **공통 코드 바깥**에서 처리되고 있을 확률이 높음

---

## 강한 의심

### 1) 최우선: property / stream split

현재 가장 강한 가설입니다.

- direct gtag는 `G-8...`
- 운영 화면에는 `G-W...`도 최근 48시간 활성
- 대시보드 백엔드는 `304759974`를 읽음

즉 지금은
`사이트`,
`GTM`,
`운영 속성`,
`SEO 대시보드`
가 같은 계측 체계를 보고 있지 않을 수 있습니다.

### 2) `G-WJFXN5E2Q1`는 direct gtag가 아니라 GTM/CMS 쪽일 가능성이 더 높음

이유:

- 라이브 HTML에서 `G-W...` 미발견
- 저장소 active app code에서도 `G-W...` 미발견
- MP/server-side 관련 코드 흔적도 현재 repo와 라이브 HTML에서 미발견

따라서 우선순위는:

1. GTM 내부 태그
2. Imweb 숨김 스크립트 / 주문완료 페이지
3. 기타 CMS 삽입 코드
4. Measurement Protocol / server-side tagging

### 3) 표준 ecommerce 이벤트 체계가 깨져 있을 가능성

- `view_item` 주석
- `rebuyz_view`만 활성
- 기존 진단에서 `runFunnelReport purchase = 0`

이 조합은
`ecommerce 이벤트가 표준 schema로 안 맞고, property도 갈라져 있을 가능성`
과 잘 맞습니다.

---

## 코드로 확인 가능 / 운영 화면 필요

| 항목 | 상태 | 분류 | 이유 |
| --- | --- | --- | --- |
| old/new measurement ID 사용 여부 | 부분 확인 | 코드 + 운영 | `G-8...`는 라이브 HTML로 확인, `G-W...`는 운영 화면 fact로 확인 |
| duplicate page_view 가능성 | 부분 확인 | 코드 + 운영 | direct gtag + GTM 2개는 코드로 확인. 실제 GTM page_view 태그 발화 여부는 운영 GTM 필요 |
| ecommerce 이벤트 누락 여부 | 부분 확인 | 코드 + 운영 | `view_item` 주석과 `rebuyz_view` 활성은 코드로 확인. add_to_cart~purchase는 운영 확인 필요 |
| GTM 내부 태그 구성 | 미확인 | 운영 화면 필요 | GTM UI 없이는 태그/트리거/GA4 설정을 못 봄 |
| GA4 Admin cross-domain 설정 | 미확인 | 운영 화면 필요 | HTML에서 linker/_gl 안 보임. Admin 또는 GTM 설정 화면 필요 |
| 실제 PG 완료 후 purchase 발화 여부 | 미확인 | 운영 화면 필요 | DebugView/Realtime/실결제 흐름 필요 |
| property / stream mismatch 여부 | 강하게 확인 | 코드 + 운영 | 라이브 HTML `G-8`, 운영 fact `G-W`, 백엔드 `304759974`가 이미 갈라짐 |
| enhanced measurement 설정 차이 | 미확인 | 운영 화면 필요 | Admin API `SERVICE_DISABLED`, 429378830 Data API 권한 없음 |

---

## 코드 수정 필요 항목

### 빠른 봉합

1. **direct gtag와 GTM 중 한 축으로 우선 통일**
   - 최소한 direct gtag의 역할을 GTM과 분리
   - page_view 중복 가능성부터 차단

2. **표준 `view_item` 복구**
   - `rebuyz_view`만 보내지 말고 표준 `view_item`을 복구
   - 또는 GTM에서 `rebuyz_view -> view_item`을 명시 매핑

3. **UTM 저장을 로그인과 분리**
   - `userID` 없어도 최초 UTM은 저장
   - user_id는 나중에 붙여도 됨

4. **없는 UTM은 `'0'` 대신 null/미전송**

5. **SEO 백엔드의 property 설정 정리**
   - 현재 `304759974`가 왜 쓰이고 있는지 명시
   - canonical property가 정해지면 env와 대시보드 조회 대상을 일치

### 정리 수술

1. **정본 property / stream 하나로 통일**
2. **GTM 2개 운영 이유 문서화**
3. **old/new property 매핑 문서화**
4. **event naming standard 문서화**
   - `page_view`
   - `view_item`
   - `add_to_cart`
   - `begin_checkout`
   - `add_payment_info`
   - `purchase`
5. **purchase 이벤트 책임 레이어 명시**
   - GTM인지
   - CMS 완료 페이지인지
   - MP/server-side인지

---

## 운영 화면에서 확인해야 할 항목

### 1) GTM `GTM-W7VXS4D8`

- GA4 Configuration tag가 어느 measurement ID로 가는지
- GA4 Event tags 중 `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`가 있는지
- `rebuyz_view -> view_item` 매핑이 있는지

### 2) GTM `GTM-W2Z6PHN`

- 위와 동일
- 왜 별도 컨테이너가 필요한지

### 3) GA4 Admin

- `429378830 / stream 7575892737 / G-8...` 의 enhanced measurement 설정
- `[G4] biocom.kr / G-W...` 의 enhanced measurement 설정
- cross-domain domain 설정
- referral exclusion

### 4) Imweb / CMS

- head / footer script
- 주문완료 페이지 custom code
- 결제 완료 후 firing code

### 5) DebugView / Realtime

실제 1건을 끝까지 태워 아래를 확인해야 합니다.

- `page_view`
- `view_item`
- `add_to_cart`
- `begin_checkout`
- `add_payment_info`
- `purchase`
- `transaction_id`
- source/medium 변화
- 결제 완료 도메인

---

## 두 속성의 enhanced measurement 설정 차이

이번 턴 결론:
`직접 비교 미완료`

이유를 뭉뚱그리지 않고 적으면 아래와 같습니다.

1. Admin API가 현재 서비스 계정 프로젝트에서 비활성이라 코드 자동조회가 막힘
2. 현재 서비스 계정은 `429378830` property에 Data API 권한도 없음
3. 사용자께서 운영 화면에서 두 property가 활성이라고 확인해 주셨지만, enhanced measurement 토글 상태까지는 이번 턴 입력으로는 없었음

따라서 이 항목은 아래 체크리스트로 운영 화면 비교가 필요합니다.

- Page views
- Scrolls
- Outbound clicks
- Site search
- Video engagement
- File downloads
- Form interactions

---

## 정본 속성 추천안

현재 정보 기준 추천은:

`429378830 / web stream 7575892737 / G-8GZ48B1S59` 를 정본 후보 1순위로 두는 것이 맞습니다.

이유:

1. 현재 라이브 HTML에서 **직접 확인된 유일한 GA4 measurement ID**가 `G-8...`
2. `biocom.kr`, `www.biocom.kr`, `biocom.imweb.me` 3개 도메인 모두 동일
3. `G-W...`는 운영 fact로는 활성이나, source code와 라이브 HTML에서 현재 source가 안 보임

단, 조건이 있습니다.

- GTM 두 컨테이너와 CMS에서 `G-W...`가 어디서 나오는지 먼저 추적
- event parity 표를 만든 뒤
- SEO 백엔드의 property를 canonical property로 옮겨야 함

즉 실행안은 아래가 맞습니다.

1. **정본 후보를 `G-8 / 429378830 / 7575892737`로 지정**
2. **`G-W...` 유입원을 추적**
3. **2주 정도 overlap 관찰**
4. **event parity 확인 후 legacy property sunset**

지금 상태에서 `G-W...`를 정본으로 잡는 건 추천하지 않습니다.
이유는 `현재 사이트가 직접 무엇을 쏘는지`보다 `보이지 않는 어딘가에서 무엇이 살아 있는지`에 의존하게 되기 때문입니다.

---

## 가장 먼저 할 3가지

1. **GTM 2개 내부 태그를 열어 `G-W...` source를 찾는다**
   - 이게 지금 제일 중요

2. **SEO 백엔드가 읽는 property `304759974`가 무엇인지 운영에서 식별한다**
   - 현재 dashboard/property mismatch를 먼저 정리해야 함

3. **`view_item` 표준 이벤트를 복구한다**
   - `rebuyz_view`만 남겨두면 ecommerce 해석이 계속 어긋남

---

## 필요한 추가 자료

1. GTM `GTM-W7VXS4D8` 태그/트리거 export 또는 캡처
2. GTM `GTM-W2Z6PHN` 태그/트리거 export 또는 캡처
3. `G-WJFXN5E2Q1`가 달린 property의 숫자 property ID
4. 두 property의 enhanced measurement 스크린샷
5. cross-domain 설정 스크린샷
6. 주문완료 페이지 또는 PG 완료 페이지의 삽입 코드 캡처

---

## 최종 판정

이번 4차 피드백으로 가장 중요한 수준의 정리는 끝났습니다.

- `property / stream split`을 최우선 가설로 격상
- live HTML / 운영 fact / 현재 backend property mismatch를 한 화면으로 정리
- `G-W...` source 후보를 GTM/CMS 우선으로 좁힘
- event별로 어디로 갈 가능성이 높은지 표로 정리
- 정본 속성 추천안 제시

아직 남은 것은 구현보다 운영 추적입니다.

특히 아래 3개는 운영 화면 없이는 닫을 수 없습니다.

1. `G-W...`의 실제 발화 레이어
2. GTM 내부 태그 구성
3. 두 property의 enhanced measurement 차이
