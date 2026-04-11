# metaroas3-2 작업 결과

작성일: 2026-04-10

## 결론

이번 작업의 핵심 결론은 다음과 같다.

- CAPI `auto_sync`에서 같은 주문이 서로 다른 `event_id`로 전송된 직접 원인은 `loggedAt` 우선 event_id 생성식과 자체 솔루션 결제완료 원장 중복 row 조합이다.
- 실제 결제는 Toss 기준 단일 결제로 보이며, 위험 후보 3그룹 모두 같은 `paymentKey`, 같은 `approvedAt`인데 자체 솔루션 원장의 `loggedAt`만 달랐다.
- 앞으로의 CAPI 운영 전송은 `approvedAt`을 event_id timestamp 기준으로 우선 사용하도록 바꿨고, 이미 운영 성공 전송된 `paymentKey + eventName` 또는 `orderIdBase + eventName`은 재전송하지 않도록 guard를 추가했다.
- `payment_success` 식별자 유입률은 아직 낮다. 현재 조회 기준 all-three coverage는 18.46%다. 이번 변경으로 `client_id`가 있으면 `user_pseudo_id` fallback을 남기고, 결제완료 스니펫에서 Meta 브라우저 식별자 `_fbc`, `_fbp`도 같이 보내도록 보강했다.
- alias 상위 5개는 검토했지만 `manual_verified = 0` 상태를 유지했다. 아직 사람 검토 전 자동 매핑을 열면 캠페인별 Attribution ROAS가 잘못 붙을 수 있다.

## 1. CAPI dedup 후보 3그룹 원인 확인

현재 API 기준:

- `/api/meta/capi/log?limit=500`
- total: `692`
- success: `692`
- failure: `0`
- operational: `691`
- manual: `0`
- test: `1`
- unique event_id: `429`
- duplicate event_id rows: `263`
- duplicate order+event groups: `173`
- retry-like groups: `170`
- multi-event-id duplicate-risk groups: `3`

multi-event-id duplicate-risk 3그룹:

- `202604083892378 / Purchase`
- count: `6`
- uniqueEventIds: `2`
- paymentKey: `iw_bi20260408102731qpmS8`
- approvedAt: `2026-04-08T10:27:59+09:00`
- loggedAt: `2026-04-08T02:43:32.705Z`, `2026-04-08T01:28:03.662Z`
- 판정: 같은 결제인데 원장 row의 `loggedAt`이 달라져 event_id가 2개로 갈라짐.

- `202604066709345 / Purchase`
- count: `4`
- uniqueEventIds: `2`
- paymentKey: `iw_bi20260406152116vpqO2`
- approvedAt: `2026-04-06T15:22:00+09:00`
- loggedAt: `2026-04-06T06:21:38.125Z`, `2026-04-06T07:33:45.233Z`
- 판정: 같은 결제인데 원장 row의 `loggedAt`이 달라져 event_id가 2개로 갈라짐.

- `202604023345485 / Purchase`
- count: `2`
- uniqueEventIds: `2`
- paymentKey: `iw_bi20260402141745wHud5`
- approvedAt: `2026-04-02T14:18:06+09:00`
- loggedAt: `2026-04-02T05:26:10.547Z`, `2026-04-02T05:18:09.417Z`
- 판정: 같은 결제인데 원장 row의 `loggedAt`이 달라져 event_id가 2개로 갈라짐.

코드상 원인:

- 기존 CAPI event_id 생성식은 `input.loggedAt || input.approvedAt || ledgerEntry.loggedAt || ledgerEntry.approvedAt` 순서였다.
- `auto_sync`는 자체 솔루션 원장 row를 읽고 Toss 승인 정보도 붙이지만, event_id 생성 시 `loggedAt`이 `approvedAt`보다 우선이었다.
- 그래서 같은 Toss 결제 1건이라도 자체 솔루션 원장에 결제완료 row가 2개 있으면 `loggedAt`이 달라지고, 그 결과 `event_id`가 갈라졌다.
- 기존 skip guard는 `successfulEventIds.has(prepared.eventId)`만 봤기 때문에 같은 주문/이벤트가 다른 event_id로 바뀌면 막지 못했다.

적용한 수정:

- `backend/src/metaCapi.ts`
- CAPI event_id 생성 기준을 `approvedAt || ledgerEntry.approvedAt || loggedAt || ledgerEntry.loggedAt` 순서로 변경했다.
- `fbc`를 `fbclid`에서 합성할 때도 같은 event time 기준을 사용하도록 맞췄다.
- 운영 `auto_sync` 성공 로그만 대상으로 성공 이력 index를 만든다.
- `paymentKey + eventName`을 1순위 dedup key로 사용한다.
- `paymentKey`가 없으면 `orderIdBase + eventName`을 사용한다. 예: `202604083892378-P1`은 `202604083892378`로 정규화한다.
- 이미 성공한 운영 `auto_sync` 주문/이벤트는 `duplicate_order_event_success`로 skip한다.
- 테스트 전송 코드가 들어간 호출은 이 운영 dedup guard에서 제외했다. 테스트 이벤트까지 막으면 Meta Events Manager 검증이 불편해지기 때문이다.

주의:

- 이 변경은 과거 CAPI 로그를 삭제하거나 되돌리는 처리가 아니다.
- 기존 로그의 duplicate 수치는 그대로 남는다.
- 효과는 다음 `auto_sync` 운영 전송부터 확인해야 한다.

## 2. payment_success 식별자 유입률 보강

현재 조회 기준:

- API: `/api/attribution/caller-coverage`
- payment_success total: `677`
- withGaSessionId: `129`, `19.05%`
- withClientId: `126`, `18.61%`
- withUserPseudoId: `126`, `18.61%`
- withAllThree: `125`, `18.46%`

해석:

- 이전에 말한 17.86%보다 조금 올라왔지만, 여전히 낮다.
- 특히 `ga_session_id`가 없는 건이 많아 all-three coverage가 크게 제한된다.
- `client_id`와 `user_pseudo_id`는 GA4 웹 기준으로 같은 값을 쓸 수 있는 경우가 많으므로, `client_id`가 있는데 `user_pseudo_id`만 비어 있는 케이스는 fallback으로 메우는 게 낫다.

적용한 수정:

- `backend/src/attribution.ts`
- 결제완료 payload 정규화 시 `user_pseudo_id`가 없고 `client_id`가 있으면 `userPseudoId = clientId`로 저장한다.
- fallback을 쓴 경우 metadata에 `userPseudoIdStrategy: client_id_fallback`을 남긴다.
- top-level 또는 metadata의 `fbc`, `fbp` 값을 자체 솔루션 원장 metadata에 보존하도록 했다.

- `backend/src/imwebAttributionSnippet.ts`
- 결제완료 스니펫이 브라우저 쿠키 `_fbc`, `_fbp`를 읽어 payload와 metadata에 같이 보내도록 했다.
- 기존 `fbclid`, `gclid`, `ttclid`, GA session/client id 수집 로직은 유지했다.

주의:

- 이 변경만으로 과거 원장 row의 coverage가 자동으로 크게 오르지는 않는다.
- 아임웹에 반영된 결제완료 스니펫이 실제 운영 트래픽에서 실행되어 새 row가 들어와야 개선 폭을 확인할 수 있다.
- 다음 확인은 24시간 이상 운영 데이터가 쌓인 뒤 `/api/attribution/caller-coverage`에서 다시 보는 게 맞다.

## 3. alias 상위 5개 수동 검토

현재 요약:

- API: `/api/ads/campaign-alias-review?site=biocom`
- totalAliases: `18`
- pendingReview: `18`
- manualVerified: `0`
- rejectedAll: `0`

상위 5개 검토 결과:

- `meta_biocom_yeonddle_igg`
- confirmedOrders: `12`
- confirmedRevenue: `4,215,250`
- 후보: `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- 판정: 인플루언서 공동구매 계열 가능성이 높지만, ad sample에 연뜰살뜰/현서/송율 등이 섞여 있어 alias와 직접 1:1 확정은 아직 어렵다. manual_verified로 올리지 않음.

- `meta_biocom_proteinstory_igg`
- confirmedOrders: `7`
- confirmedRevenue: `2,211,200`
- 후보: `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- 판정: 공동구매 계열 가능성은 높지만 후보 ad sample에서 proteinstory 직접 신호가 약하다. manual_verified로 올리지 않음.

- `meta_biocom_iggspring`
- confirmedOrders: `4`
- confirmedRevenue: `1,471,200`
- 후보: `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)`, `[바이오컴] 음식물 과민증 검사 전환캠페인(10/14~)`, `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- 판정: 가장 애매하다. `igg` family만으로 음식물과민증 상시 캠페인과 공동구매 캠페인을 분리하기 어렵다. manual_verified로 올리면 안 됨.

- `meta_biocom_mingzzinginstatoon_igg`
- confirmedOrders: `4`
- confirmedRevenue: `980,000`
- 후보: `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- 판정: 인플루언서 공동구매 계열 가능성은 높지만 alias와 ad name 직접 매칭 증거가 부족하다. manual_verified로 올리지 않음.

- `meta_biocom_allhormon_miraclemorningstory`
- confirmedOrders: `2`
- confirmedRevenue: `870,200`
- 후보: `[바이오컴] 호르몬 검사 바이럴 소재 캠페인_0811`
- 근거: ad sample에 `260323_미라클모닝스토리`가 있어 상위 5개 중 가장 강한 후보.
- 판정: 강한 후보지만 아직 수동 확정 플래그는 올리지 않았다. 캠페인별 ROAS에 반영하려면 운영자가 이 alias를 해당 campaign으로 `manual_verified` 처리해도 되는지 확인하는 단계가 필요하다.

운영 판단:

- 지금은 자동 매핑 금지 유지가 맞다.
- `manual_verified = 0` 상태에서 campaign Attribution ROAS를 운영 판단값으로 쓰면 위험하다.
- 우선순위는 `allhormon_miraclemorningstory`부터 사람 검토로 확정하고, 그 다음 `iggspring`은 반드시 landing URL/ad name을 더 봐서 분리해야 한다.

## 4. 검증 결과

실행한 검증:

- `cd backend && npm run typecheck`
- 결과: 성공

- `cd backend && npx tsx --test tests/attribution.test.ts`
- 결과: 성공
- 총 21개 테스트 통과

추가한 테스트:

- `approvedAt`이 같고 `loggedAt`만 다른 경우 CAPI event_id가 같아지는지 확인
- `paymentKey + eventName` success key가 우선되고, `orderId-P1/P2` suffix가 base orderId로 정규화되는지 확인
- `client_id`가 있을 때 `user_pseudo_id` fallback과 `fbc/fbp` metadata 보존이 되는지 확인

서버 상태:

- 백엔드 7020 재시작 완료
- 현재 listen PID: `80575`
- 접속 경로: `http://localhost:7020`
- `/api/attribution/caller-coverage` 정상 응답 확인
- `/api/meta/capi/log` 정상 응답 확인

백업:

- `backend/src/metaCapi.ts.bak_20260410_metaroas3_2_dedup_guard`
- `backend/src/attribution.ts.bak_20260410_metaroas3_2_identity_fallback`
- `backend/src/imwebAttributionSnippet.ts.bak_20260410_metaroas3_2_fbc_fbp`
- `backend/tests/attribution.test.ts.bak_20260410_metaroas3_2_tests`

## 5. 남은 작업

- CAPI dedup guard가 실제 운영에서 skip하는지 다음 `auto_sync` 이후 확인해야 한다.
- 기존 duplicate CAPI 로그는 그대로 남아 있으므로, 대시보드에서는 “과거 로그 기준”과 “수정 이후 신규 로그 기준”을 분리해서 봐야 한다.
- 아임웹 결제완료 스니펫 변경분이 실제 운영 설정에 반영되어야 식별자 유입률 개선이 보인다.
- `ga_session_id` 유입률은 아직 낮으므로, `gtag('get', ..., 'session_id')`, GA measurement cookie, dataLayer 중 어느 경로가 실제 결제완료 페이지에서 가장 자주 실패하는지 추가 관찰이 필요하다.
- alias 매핑은 자동 승격하지 않았다. 캠페인별 Attribution ROAS를 열기 전에 최소 상위 alias부터 운영자가 `manual_verified` 처리해야 한다.
