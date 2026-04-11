# metaroas3 개발 결과 기록

작성일: 2026-04-10

## 결론

이번 작업의 핵심 목표였던 `Meta UI 비교 기준 고정`, `CAPI dedup 위험 후보 3그룹 원본 로그 분리`, `payment_success 식별자 품질 가시화`는 개발과 검증을 완료했다.

다만 아직 “완전 종결”은 아니다. 서버 로그 기준으로 위험 후보 3그룹이 모두 `operational / auto_sync` 경로라는 점까지 좁혔지만, Meta Events Manager에서 브라우저 Pixel 이벤트와 서버 CAPI 이벤트의 `event_id` 매칭 상태까지 확인한 것은 아니다. 따라서 지금은 재전송 차단 규칙을 바로 넣기보다, 이번에 만든 상세 진단값을 보고 `auto_sync`의 동일 주문 재처리 원인을 한 번 더 확정한 뒤 skip guard를 넣는 순서가 맞다.

## 완료

### 1. CAPI dedup 원본 로그를 API에서 직접 볼 수 있게 확장

수정 파일:

- `backend/src/metaCapi.ts`
- `backend/src/routes/meta.ts`
- `backend/tests/attribution.test.ts`

구현 내용:

- `/api/meta/capi/log`에 아래 쿼리를 추가했다.
- `include_dedup_candidates=1`: 재전송 차단 후보 상세 row 포함
- `dedup_candidate_limit`: 후보 상세 그룹 개수. 기본 3, 최대 50
- `dedup_candidate_classification`: `multiple_event_ids_duplicate_risk`, `same_event_id_retry_like`, `all`
- 기존 summary는 유지하면서, 필요할 때만 `dedupCandidateDetails`를 내려주도록 했다.
- CAPI 로그 row에 앞으로 쌓일 진단 필드를 추가했다.
- `event_source_url`
- `send_path`: `auto_sync`, `manual_api`, `test_event`, `unknown`
- `test_event_code`
- 예전 로그는 필드가 없을 수 있어서 attribution ledger의 `landing`, `referrer`, `requestContext`를 fallback으로 참조하도록 했다.
- 진단용 URL은 민감 파라미터를 마스킹한다.
- 마스킹 대상: `paymentKey`, `paymentCode`, `orderCode`, `fbclid`, `fbc`, `fbp`, `gclid`, `ttclid`
- 같은 주문+이벤트 중복을 두 종류로 분리했다.
- `same_event_id_retry_like`: 같은 주문+이벤트인데 event_id도 같음. 재시도 또는 중복 로그에 가까움.
- `multiple_event_ids_duplicate_risk`: 같은 주문+이벤트인데 event_id가 여러 개임. Meta dedup이 실패할 수 있는 진짜 차단 후보.
- 테스트/수동/운영 분류를 넣었다.
- `test_*` event_id/orderId 또는 `captureMode=test`는 test
- `captureMode=manual` 또는 `touchpoint=manual`은 manual
- 나머지는 operational

검증 결과:

- `npm run typecheck` 통과
- `node --import tsx --test tests/attribution.test.ts` 통과
- attribution 테스트 18개 전부 통과
- 새 테스트 `meta capi: dedup candidate details focus multi-event-id duplicate risk` 추가 및 통과

### 2. 실제 최근 7일 CAPI 중복 현황 재확인

검증 API:

`GET /api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1&dedup_candidate_limit=3`

결과:

- 전체 최근 7일 운영 성공 로그: 691건
- 성공: 691건
- 실패: 0건
- operational: 691건
- manual: 0건
- test: 0건
- 같은 event_id 중복: 174그룹
- 같은 orderId + eventName 중복: 173그룹
- 재시도형 중복: 170그룹, 427건
- 재전송 차단 후보: 3그룹, 12건

재전송 차단 후보 3그룹:

- `202604083892378 / Purchase`
- 총 6회 전송
- unique event_id 2개
- 모두 `sendPath=auto_sync`, `mode=operational`, HTTP 200
- source_url은 결제완료 confirm URL 계열이며 민감 파라미터는 마스킹 처리됨

- `202604066709345 / Purchase`
- 총 4회 전송
- unique event_id 2개
- 모두 `sendPath=auto_sync`, `mode=operational`, HTTP 200
- source_url은 `igg_store` 랜딩 계열이며 `fbclid`는 마스킹 처리됨

- `202604023345485 / Purchase`
- 총 2회 전송
- unique event_id 2개
- 모두 `sendPath=auto_sync`, `mode=operational`, HTTP 200
- source_url은 `HealthFood` 랜딩 계열

해석:

- 위험 후보 3그룹은 수동 재발송이나 테스트 로그가 아니다.
- 모두 운영 자동 sync 경로에서 발생했다.
- 따라서 원인 후보는 `자동 sync 재시작`, `동일 주문 재스캔`, `같은 주문을 다른 event_id로 재생성하는 로직` 쪽으로 좁혀졌다.
- `same event_id`로 반복된 170그룹은 우선 재시도형으로 분리해서 보는 것이 맞다.
- 진짜 차단 후보는 현재 기준 3그룹 12건이다.

주의:

- 이 서버 로그만으로 브라우저 Pixel과 서버 CAPI가 Meta 안에서 정상 dedup 되었는지는 확정할 수 없다.
- Events Manager에서 Pixel/CAPI 양쪽의 `event_id` 매칭과 dedup 상태를 확인해야 최종 확정 가능하다.

### 3. 광고성과 대시보드에 CAPI dedup 상세 카드 추가

수정 파일:

- `frontend/src/app/ads/page.tsx`

구현 내용:

- `/ads` 페이지의 CAPI 섹션이 최근 7일 운영 성공분만 보도록 변경했다.
- API 호출:
- `/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1&dedup_candidate_limit=3`
- 화면에서 아래 값을 바로 볼 수 있게 했다.
- 최근 7일 운영 성공 로그
- 동일 event_id 중복 그룹
- 같은 주문+이벤트 중복 그룹
- 재전송 차단 후보 그룹
- 운영/수동/테스트 분리
- 재시도형 중복 그룹
- 재전송 차단 후보 그룹
- 재전송 차단 후보 3그룹의 상세 row
- row에는 `createdAt`, `eventId`, `sendPath`, `mode`, HTTP status, redacted source_url을 표시한다.

검증 결과:

- `npm run build` 통과
- `/ads` HTTP 200 응답 확인
- 최초 작성 시점에는 Playwright가 없어 브라우저 자동화 검증을 생략했지만, 2026-04-10 추가 확인에서 Playwright를 설치하고 `/ads` headless 렌더링 검증까지 완료했다.

### 4. Meta UI 비교 기준을 문구로 고정

수정 파일:

- `backend/src/routes/meta.ts`
- `frontend/src/app/ads/page.tsx`
- `frontend/src/app/ads/roas/page.tsx`

구현 내용:

- Meta insights 호출 기준을 Ads Manager 비교에 맞추기 위해 기본 기준을 명시했다.
- `action_report_time=conversion`
- 기본은 `use_unified_attribution_setting=true`
- 커스텀 attribution window를 명시한 경우에만 `action_attribution_windows=[...]` 사용
- API 응답에 `meta_reference` 설명을 포함했다.
- Meta ROAS 분자는 PG 확정 매출이 아니라 Meta가 광고에 귀속한 conversion value라는 점을 문서화했다.
- 대시보드 문구를 수정했다.
- Meta 화면 비교 대상은 큰 `구매 전환값` 열이 아니라 `결과 ROAS`와 그에 대응하는 `결과 값` 계열로 고정
- 내부 운영 메인값은 Attribution confirmed ROAS
- Meta purchase ROAS는 플랫폼 참고값

해석:

- 앞으로 “Meta ROAS가 왜 다르냐”를 볼 때, Ads Manager의 아무 전환값 열이나 비교하면 안 된다.
- 비교 기준은 `결과 ROAS`와 그 옆의 대응 `결과 값` 계열이다.
- 내부 운영 판단은 계속 최근 7일 Attribution confirmed를 메인으로 둔다.

### 5. payment_success 식별자 품질 섹션 추가

수정 파일:

- `frontend/src/app/ads/page.tsx`

구현 내용:

- `/ads` 페이지에 `결제완료 식별자 품질` 섹션을 추가했다.
- 개발팀이 우리 프로젝트 용어를 몰라도 이해할 수 있게 아래처럼 풀어서 표현했다.
- “전태준 대표님이 구축한 자체 솔루션 원장에 쌓이는 결제완료 기록”
- `payment_success`는 자체 솔루션 원장에 적재되는 결제완료 기록이라고 설명
- 왜 중요한지 설명
- 주문은 잡혀도 `ga_session_id`, `client_id`, `user_pseudo_id`가 없으면 광고 클릭, GA4 세션, Meta CAPI 이벤트를 한 사람의 흐름으로 묶기 어렵다.
- 표시값:
- 결제완료 기록 총량
- 3개 식별자 모두 있음
- `ga_session_id` 있음
- `client_id / user_pseudo_id` 있음
- `checkout_started` 총량
- 개발 요청 기준

실제 검증값:

`GET /api/attribution/caller-coverage?limit=5`

- payment_success total: 672건
- withGaSessionId: 124건
- withClientId: 121건
- withUserPseudoId: 121건
- withAllThree: 120건
- gaSessionIdRate: 18.45%
- clientIdRate: 18.01%
- userPseudoIdRate: 18.01%
- allThreeRate: 17.86%
- checkout_started total: 0건

해석:

- 이전 문서의 662건 / 16.62%보다 소폭 개선됐다.
- 하지만 아직 17.86%라서 낮다.
- 결제완료 페이지 또는 외부 결제완료 서버 호출부에서 식별자 전달 보강이 계속 필요하다.
- `checkout_started`가 0건이므로, 결제 시작 단계부터 식별자를 이어받는 흐름은 아직 확인되지 않는다.

### 6. alias 자동 매칭은 계속 보류

검증 API:

`GET /api/ads/campaign-alias-review?site=biocom`

결과:

- totalAliases: 18
- pendingReview: 18
- manualVerified: 0
- rejectedAll: 0

상위 alias:

- `meta_biocom_yeonddle_igg`: confirmedRevenue 4,215,250원, confirmedOrders 12건, 후보 `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- `meta_biocom_proteinstory_igg`: confirmedRevenue 2,211,200원, confirmedOrders 7건, 후보 `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- `meta_biocom_iggspring`: confirmedRevenue 1,471,200원, confirmedOrders 4건, 후보 `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)`
- `meta_biocom_mingzzinginstatoon_igg`: confirmedRevenue 980,000원, confirmedOrders 4건, 후보 `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- `meta_biocom_allhormon_miraclemorningstory`: confirmedRevenue 870,200원, confirmedOrders 2건, 후보 `[바이오컴] 호르몬 검사 바이럴 소재 캠페인_0811`

해석:

- `manual_verified=0`이므로 자동 matcher에 태우면 안 된다.
- 지금은 캠페인별 Attribution ROAS 운영 판단 금지 상태를 유지하는 것이 맞다.
- 다만 매출 큰 alias부터 사람이 yes/no 검토할 수 있는 자료는 준비되어 있다.

## 부분 해결

### 1. CAPI skip guard는 아직 넣지 않았다

이유:

- 현재 `multiple_event_ids_duplicate_risk` 3그룹이 모두 `auto_sync`라는 점은 확인했다.
- 하지만 이게 정상 재처리, sync 재시작, 과거 로그 재스캔, 또는 실제 중복 전송 버그 중 무엇인지 아직 최종 판정하지 않았다.
- 바로 `orderId + eventName` 기준 차단을 넣으면 정상적인 상태 변경 재처리까지 막을 수 있다.

다음 구현 기준:

- 차단 대상은 `same_event_id_retry_like`가 아니라 `multiple_event_ids_duplicate_risk` 쪽이어야 한다.
- 운영 성공 이력이 이미 있는 `orderId + eventName` 조합에 대해서만 skip guard를 검토한다.
- 수동 테스트나 재전송 API는 별도 플래그로 우회할 수 있어야 한다.
- skip 시에도 로그는 남겨야 한다.
- 가능하면 event_id 생성 규칙을 먼저 안정화한다. 같은 주문+이벤트라면 같은 event_id가 재사용되는 편이 Meta dedup에 유리하다.

### 2. payment page 품질은 대시보드 가시화까지 완료, 실제 caller 수정은 남음

완료한 것:

- 현재 coverage를 `/ads`에서 볼 수 있게 했다.
- 개발팀이 이해하기 쉬운 문구로 풀어 썼다.

남은 것:

- 결제완료 페이지와 외부 결제완료 서버 호출에서 `ga_session_id`, `client_id`, `user_pseudo_id`를 더 안정적으로 넘겨야 한다.
- 가능하면 `fbclid`, `fbc`, `fbp`까지 함께 받아 Meta CAPI 매칭 품질을 올려야 한다.
- `checkout_started`가 0건인 이유를 확인해야 한다.

### 3. Pixel/CAPI dedup 최종 확정은 Events Manager 확인 필요

서버 로그로 확인한 것:

- CAPI 쪽 운영 성공 로그와 event_id 중복 구조
- 수동/테스트 로그가 아니라 auto_sync 경로라는 점
- 위험 후보가 3그룹으로 좁혀졌다는 점

서버 로그만으로 확인할 수 없는 것:

- 브라우저 Pixel 이벤트가 같은 `event_id`로 들어갔는지
- Meta Events Manager가 실제로 Pixel/CAPI를 dedup 처리했는지
- Ads Manager의 결과 ROAS에 특정 CAPI 중복이 얼마나 영향을 줬는지

필요한 추가 확인:

- Meta Events Manager에서 Purchase 이벤트의 Browser/Server 중복 제거 상태 확인
- 테스트 이벤트 또는 이벤트 상세에서 `event_id` 매칭 확인
- Ads Manager 열 설정 캡처에서 attribution setting, timezone, column preset 확인

## 보류 또는 추가 확인

### 1. 브라우저 자동화 검증은 추가 확인에서 완료

현재 상태:

- 최초 작성 시점에는 Playwright가 없어 `npm run build`와 `/ads` HTTP 200으로만 확인했다.
- 2026-04-10 추가 요청으로 `@playwright/test`를 설치했고, `/ads` headless 렌더링 검증까지 완료했다.

### 2. 운영 차단 규칙은 의도적으로 미적용

사유:

- 이번 요청의 핵심은 “막기”가 아니라 “분리해서 보기”였다.
- 현재는 차단 후보가 모두 auto_sync라는 점까지 좁힌 상태다.
- 다음 단계에서 sync 원인을 확정하고 guard를 넣는 것이 안전하다.

## 검증 명령과 결과

- `cd frontend && npm run build`
- 결과: 성공

- `cd backend && npm run typecheck`
- 결과: 성공

- `cd backend && node --import tsx --test tests/attribution.test.ts`
- 결과: 성공, 18개 테스트 통과

- `curl http://localhost:7010/ads`
- 결과: HTTP 200

- `GET http://localhost:7020/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1&dedup_candidate_limit=3`
- 결과: HTTP 200, 최근 7일 운영 성공 691건, 재전송 차단 후보 3그룹 12건

- `GET http://localhost:7020/api/attribution/caller-coverage?limit=5`
- 결과: HTTP 200, payment_success all-three coverage 17.86%

- `GET http://localhost:7020/api/ads/campaign-alias-review?site=biocom`
- 결과: HTTP 200, manualVerified 0

## 로컬 서버 상태

- frontend: 7010 listening
- backend: 7020 listening

## 백업 파일

- `backend/src/metaCapi.ts.bak_20260410_metaroas3_dedup_details`
- `backend/src/routes/meta.ts.bak_20260410_metaroas3_dedup_details`
- `backend/tests/attribution.test.ts.bak_20260410_metaroas3_dedup_details`
- `frontend/src/app/ads/page.tsx.bak_20260410_metaroas3_caller_coverage_section`
- `frontend/src/app/ads/roas/page.tsx.bak_20260410_metaroas3_meta_ui_reference`

## 다음 액션 제안

1. 같은 주문+이벤트의 CAPI event_id 생성 규칙을 안정화한다. 현재는 `loggedAt` 우선이라 같은 주문도 원장 row가 여러 번 들어오면 event_id가 갈라진다.
2. 운영 성공 이력이 있는 `paymentKey + eventName` 또는 `orderIdBase + eventName` 기준 skip guard를 넣는다. `paymentKey`가 있으면 `paymentKey` 우선이 더 안전하다.
3. Events Manager에서 Pixel/CAPI dedup 상태를 확인한다.
4. 결제완료 caller가 `ga_session_id`, `client_id`, `user_pseudo_id`를 항상 넘기도록 외부 결제완료 호출부를 수정한다.
5. 최신 CAPI 후보를 아임웹까지 같이 보려면 biocom 아임웹 주문 sync를 먼저 최신화한다.
6. alias 상위 5개부터 사람이 검토해서 `manual_verified`로 승격할지 결정한다.

현재 기준으로 운영 메인값은 계속 최근 7일 Attribution confirmed ROAS를 쓰고, Meta purchase ROAS는 `결과 ROAS / 결과 값` 계열과 맞춰 보는 플랫폼 참고값으로만 쓰는 것이 맞다.

## 2026-04-10 추가 확인: auto_sync event_id 원인, Playwright 설치, PG/아임웹 교차검증 판단

### 1. CAPI `auto_sync`가 같은 주문+이벤트에 서로 다른 event_id를 만드는 경로 확인

확인 결론:

- 원인은 `auto_sync`가 여러 경로에서 따로 호출된 것이 아니라, 자체 솔루션 원장에 같은 주문의 `payment_success` row가 여러 번 들어오고, CAPI event_id 생성식이 그 row의 `loggedAt`을 사용하기 때문이다.
- 현재 코드는 같은 주문이라도 `loggedAt`이 다르면 서로 다른 event_id를 만든다.
- 그래서 `successfulEventIds` skip guard는 같은 event_id 재전송만 막고, 같은 `orderId + eventName`인데 event_id가 달라진 케이스는 막지 못한다.

코드 경로:

- `backend/src/bootstrap/startBackgroundJobs.ts`
- 60초 후 `runCapiSync()` 최초 실행
- 이후 30분마다 `syncMetaConversionsFromLedger({ limit: 100 })` 실행

- `backend/src/metaCapi.ts`
- `selectMetaCapiSyncCandidates()`
- 조건: `touchpoint=payment_success`, `captureMode=live`, `paymentStatus=confirmed`
- 여기서는 같은 `orderId` 또는 같은 `paymentKey` 중복을 제거하지 않는다.

- `buildSyncInput()`
- Toss Payments에서 실제 결제 정보를 조회한다.
- 반환값에 `approvedAt: tossPayment.approvedAt || entry.approvedAt || entry.loggedAt`를 넣는다.
- 동시에 `loggedAt: entry.loggedAt`도 그대로 넣는다.

- `prepareMetaCapiSend()`
- `eventTimeSource = input.loggedAt || input.approvedAt || input.ledgerEntry?.loggedAt || input.ledgerEntry?.approvedAt`
- `eventId = ${orderId}_${eventName}_${resolveEventIdTime(eventTimeSource)}`
- 즉 Toss 승인시각 `approvedAt`이 있어도 `loggedAt`이 우선이라, 같은 주문의 원장 row가 여러 개면 event_id가 갈라진다.

실제 위험 후보 3그룹 대조:

- `202604083892378 / Purchase`
- paymentKey: `iw_bi20260408102731qpmS8`
- Toss approvedAt: `2026-04-08T10:27:59+09:00`
- Meta CAPI event_id 1: `202604083892378_Purchase_1775616212705`
- 해당 loggedAt: `2026-04-08T02:43:32.705Z`
- Meta CAPI event_id 2: `202604083892378_Purchase_1775611683662`
- 해당 loggedAt: `2026-04-08T01:28:03.662Z`
- 판정: 같은 Toss 결제 1건인데 자체 솔루션 원장 row의 loggedAt이 달라져 event_id가 2개로 갈라짐.

- `202604066709345 / Purchase`
- paymentKey: `iw_bi20260406152116vpqO2`
- Toss approvedAt: `2026-04-06T15:22:00+09:00`
- Meta CAPI event_id 1: `202604066709345_Purchase_1775456498125`
- 해당 loggedAt: `2026-04-06T06:21:38.125Z`
- Meta CAPI event_id 2: `202604066709345_Purchase_1775460825233`
- 해당 loggedAt: `2026-04-06T07:33:45.233Z`
- 판정: 같은 Toss 결제 1건인데 자체 솔루션 원장 row의 loggedAt이 달라져 event_id가 2개로 갈라짐.

- `202604023345485 / Purchase`
- paymentKey: `iw_bi20260402141745wHud5`
- Toss approvedAt: `2026-04-02T14:18:06+09:00`
- Meta CAPI event_id 1: `202604023345485_Purchase_1775107570547`
- 해당 loggedAt: `2026-04-02T05:26:10.547Z`
- Meta CAPI event_id 2: `202604023345485_Purchase_1775107089417`
- 해당 loggedAt: `2026-04-02T05:18:09.417Z`
- 판정: 같은 Toss 결제 1건인데 자체 솔루션 원장 row의 loggedAt이 달라져 event_id가 2개로 갈라짐.

중요한 해석:

- `auto_sync`의 호출 경로는 백그라운드 30분 주기 동기화다.
- 위험 후보 3그룹은 수동 발송이나 테스트 발송이 아니다.
- 직접 원인은 `loggedAt` 우선 event_id 생성식과 원장 중복 row 조합이다.
- 해결은 두 축으로 보는 것이 맞다.
- event_id 안정화: CAPI Purchase event_id는 `orderId + eventName + approvedAt` 또는 더 단순하게 `orderId + eventName` 기반으로 고정하는 편이 안전하다.
- 전송 차단: 운영 성공 이력이 있는 `orderId + eventName` 또는 `paymentKey + eventName`은 재전송하지 않는 skip guard를 추가한다.
- 단, event_id 안정화 전에 skip guard만 넣으면 과거 로그와 새 규칙이 섞이는 전환 구간이 생길 수 있으므로, 구현 시 migration/호환 기준을 명시해야 한다.

### 2. Playwright 설치 및 검증

설치 내용:

- `frontend/package.json`에 `@playwright/test` devDependency 추가
- 설치 버전: `1.59.1`
- `frontend/package-lock.json` 갱신
- 설치 전 백업:
- `frontend/package.json.bak_20260410_playwright_install`
- `frontend/package-lock.json.bak_20260410_playwright_install`

설치/검증 명령:

- `cd frontend && npm install -D @playwright/test`
- 결과: 설치 성공
- npm audit 결과: 전체 의존성 기준 4 vulnerabilities 보고됨. 2 moderate, 2 high. `--omit=dev` 기준 runtime 의존성은 moderate 1건이다. 이번 요청 범위에서는 자동 fix는 실행하지 않았다.

- `cd frontend && npx playwright install chromium`
- 결과: Chromium 설치 명령 완료

- `frontend/node_modules/.bin/playwright --version`
- 결과: `Version 1.59.1`

- Playwright headless 렌더링 검증
- 대상: `http://localhost:7010/ads`
- 결과:
- `광고 성과 대시보드`: 1개 렌더링
- `CAPI 중복 분리 진단`: 1개 렌더링
- `결제완료 식별자 품질`: 1개 렌더링
- `결과 ROAS`: 3개 렌더링
- `__redacted__`: 10개 렌더링
- 콘솔 error: 0개
- failed request: 0개

- `cd frontend && npm run build`
- 결과: 성공

### 3. Toss Payments, 아임웹 API 주문 교차검증이 이번 작업에 도움이 되는지

결론:

- 도움이 된다. 다만 이번 `event_id가 왜 갈라졌는가`의 직접 원인을 찾는 용도보다는, “같은 주문이 실제 결제 1건인지”, “금액과 결제 상태가 맞는지”, “원장 중복이 실제 복수 결제가 아닌지”를 확인하는 보조 검증으로 유용하다.
- 이번 3그룹의 직접 원인은 Toss/아임웹이 아니라 자체 솔루션 원장 중복 row + `loggedAt` 기반 event_id 생성식이다.
- 그래도 skip guard를 넣기 전에는 Toss/아임웹 교차검증을 같이 보는 것이 안전하다. 실제로 같은 주문번호에 부분취소/복수결제/재주문이 섞여 있으면 무조건 차단하면 안 되기 때문이다.

Toss Payments 직접 확인:

- `202604083892378-P1`
- status: `DONE`
- method: `카드`
- totalAmount: `245,000`
- approvedAt: `2026-04-08T10:27:59+09:00`
- paymentKey: `iw_bi20260408102731qpmS8`

- `202604066709345-P1`
- status: `DONE`
- method: `가상계좌`
- totalAmount: `485,000`
- approvedAt: `2026-04-06T15:22:00+09:00`
- paymentKey: `iw_bi20260406152116vpqO2`

- `202604023345485-P1`
- status: `DONE`
- method: `카드`
- totalAmount: `219,000`
- approvedAt: `2026-04-02T14:18:06+09:00`
- paymentKey: `iw_bi20260402141745wHud5`

해석:

- 위험 후보 3건은 모두 Toss 기준 실제 완료 결제 1건으로 확인된다.
- 따라서 같은 주문의 CAPI event_id가 2개인 것은 실제 복수 결제가 아니라 CAPI 전송/원장 처리 문제로 보는 것이 타당하다.
- 특히 `202604066709345`는 가상계좌였지만 Toss 상태가 `DONE`이므로 CAPI 전송 대상 자체는 맞다. 문제는 전송 여부가 아니라 같은 결제를 여러 event_id로 보낸 점이다.

아임웹 로컬 주문 캐시 확인:

- biocom 아임웹 로컬 주문 캐시
- totalOrders: `5,750`
- firstOrderAt: `2026-01-27T00:01:26.000Z`
- lastOrderAt: `2026-04-07T15:39:13.000Z`
- lastSyncedAt: `2026-04-07 16:39:41`

- `202604066709345`
- 아임웹 로컬 캐시에 존재
- order_time: `2026-04-06T06:19:59.000Z`
- complete_time: `2026-04-07T03:15:00.000Z`
- pay_type: `virtual`
- pg_type: `tosspayments`
- total_price: `510,000`
- payment_amount: `485,000`
- coupon_amount: `25,000`

- `202604023345485`
- 아임웹 로컬 캐시에 존재
- order_time: `2026-04-02T05:16:18.000Z`
- complete_time: `2026-04-03T04:38:29.000Z`
- pay_type: `card`
- pg_type: `tosspayments`
- total_price: `234,000`
- payment_amount: `219,000`
- coupon_amount: `15,000`

- `202604083892378`
- 아임웹 로컬 캐시에서 미조회
- 이유 후보: 현재 biocom 아임웹 로컬 캐시 최신 주문시각이 `2026-04-07T15:39:13.000Z`라서, 2026-04-08 주문은 아직 로컬 캐시에 안 들어온 상태로 보인다.

아임웹-토스 90일 대사 현황:

- API: `/api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=5`
- imwebOrders: `5,750`
- tossOrders: `5,863`
- matchedOrders: `4,256`
- missingInToss: `1,494`
- missingInImweb: `1,607`
- amountMismatchCount: `29`
- coverageRate: `74.02%`
- 2-7일 bucket coverageRate: `55.81%`
- 8-30일 bucket coverageRate: `73.93%`
- 31일 이상 bucket coverageRate: `76.76%`

운영 판단:

- Toss는 CAPI Purchase 전송 대상 여부를 판정하는 데 가장 강한 기준이다.
- 아임웹은 주문 단위, 쿠폰, 상품, 주문자 식별자 검증에 도움이 된다.
- 이번 dedup 원인 분석에서는 Toss로 “실제 결제는 1건”을 확인하는 것이 특히 유용했다.
- 아임웹은 4월 8일 주문이 아직 캐시에 없어 최신 구간 검증에는 한계가 있다. 최신 CAPI dedup 후보를 아임웹까지 같이 보려면 biocom 아임웹 주문 sync를 먼저 최신화해야 한다.
- skip guard 설계 시 추천 기준은 `paymentKey + eventName` 또는 `orderIdBase + eventName`이다. 단, 다회차 결제/부분결제 가능성을 고려해 `paymentKey`가 있으면 `paymentKey`를 우선하는 편이 안전하다.
