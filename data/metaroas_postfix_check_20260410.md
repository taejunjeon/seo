1. 10초 요약

- 판정불가. 2026-04-10 00:00:00 UTC, 한국시간 2026-04-10 09:00:00 KST 이후 운영 CAPI 전송 로그가 아직 0건이라 dedup 수정 효과가 실제 운영 로그에 반영됐는지 판단할 수 없다.
- 단, 같은 시각 이후 biocom 결제완료 원장에는 live `payment_success`가 33건 들어와 있다. 이 33건은 모두 `pending`이고 `approvedAt`이 비어 있어, 현재 CAPI 자동 전송 후보 조건인 `paymentStatus = confirmed`를 통과하지 못한다. 즉 `post-fix dedup 후보 0건`은 “중복 위험이 사라짐”이 아니라 “아직 CAPI로 보낼 confirmed 후보가 없음”으로 해석해야 한다.
- 최근 7일 전체 로그에는 수정 전 위험 후보 `multiEventIdGroups 3그룹 / 12행`이 그대로 보이지만, 이는 post-fix 이후 로그가 아니라서 해결/미해결 판정 근거로 쓰면 안 된다.

2. 핵심 숫자

| 지표 | 값 |
|---|---:|
| post-fix total | 0 |
| post-fix success | 0 |
| post-fix multiEventIdGroups | 0 |
| post-fix multiEventIdRows | 0 |
| post-fix retryLikeGroups | 0 |
| post-fix retryLikeRows | 0 |
| post-fix biocom live payment_success 원장 | 33건, 전부 pending |
| post-fix approvedAt 보유 원장 | 0건 |
| post-fix 식별자 all-three | 33/33, 100% |
| caller coverage allThreeRate | 전체 18.82%, biocom 19.06% |
| 최신 비교 기준값 | 수정 전 최근 7일 multiEventIdGroups 3 / multiEventIdRows 12, 직전 all-three 18.46% → 현재 전체 18.82% |

3. 결론

판정불가.

post-fix 이후 운영 CAPI 전송 로그가 0건이라 완료 기준 1번인 “post-fix 이후 운영 로그가 실제로 존재”를 충족하지 못했다. 따라서 `multiEventIdGroups`가 0으로 보이는 것은 “해결”이 아니라 “검증할 CAPI 전송 로그가 없음”이다.

왜 0건인지도 확인했다. 2026-04-10 00:00:00 UTC 이후 biocom 결제완료 원장은 계속 들어오고 있지만, 조회된 post-fix 33건이 모두 `pending`이고 `approvedAt`이 비어 있다. 코드상 CAPI 자동 전송 후보는 `payment_success + live + confirmed`만 선택한다. 그래서 현재 데이터는 “수집은 됐지만 아직 결제 확정/승인시각이 보강되지 않아 CAPI 발송 후보로 올라가지 않은 상태”다. 다음 Toss/아임웹 확정 동기화 또는 auto_sync 이후 `confirmed`로 바뀐 행이 실제 CAPI로 전송되는지 확인해야 한다.

4. 남아 있는 위험

- post-fix 운영 로그 부재 → 수정 효과를 실제로 검증하지 못함 → 다음 auto_sync 이후 같은 쿼리를 다시 실행한다.
- post-fix 원장 33건이 모두 pending → CAPI 후보 자체가 아직 없음 → Toss/아임웹 확정 동기화 이후 같은 주문들이 `confirmed`로 바뀌는지 확인한다.
- 최근 7일 수정 전 위험 후보 3그룹이 남아 있음 → Meta ROAS 과대 원인의 과거 흔적이 계속 보일 수 있음 → post-fix 구간과 최근 7일 구간을 문서와 화면에서 반드시 분리해 읽는다.
- payment_success 식별자 all-three coverage가 아직 18.82% 수준 → GA4/Meta 매칭 품질이 낮아 Attribution 해석이 계속 흔들릴 수 있음 → 결제완료 caller에서 `ga_session_id`, `client_id`, `user_pseudo_id`, `_fbc`, `_fbp` 유입을 계속 올린다.

5. 증빙

호출 1:

```text
GET /api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10
```

핵심 응답:

```text
total: 0
success: 0
operational/manual/test: 0 / 0 / 0
duplicateEventIds: 0
duplicateOrderEventGroups: 0
retryLikeGroups: 0
retryLikeRows: 0
multiEventIdGroups: 0
multiEventIdRows: 0
dedupCandidateDetails: []
```

post-fix 후보가 0건인 원인:

```text
GET /api/attribution/ledger?limit=200&source=biocom_imweb&captureMode=live

기준: loggedAt >= 2026-04-10T00:00:00.000Z
postFixRows: 33
paymentStatus: pending 33 / confirmed 0 / canceled 0
approvedAtPresent: 0
snippetVersion: 2026-04-08-fetchfix 33
ga_session_id + client_id + user_pseudo_id all-three: 33 / 33
```

코드 확인:

```text
backend/src/metaCapi.ts

selectMetaCapiSyncCandidates 조건:
touchpoint === "payment_success"
captureMode === "live"
paymentStatus === "confirmed"
```

따라서 현재 `post-fix CAPI dedup 후보 0건`의 직접 원인은 “결제완료 수집이 멈춤”이 아니라 “post-fix 결제완료 행이 아직 confirmed 후보가 아님”이다. 원장 최신 행에는 `ga_session_id`, `client_id`, `user_pseudo_id`가 모두 들어오고 있어 식별자 수집은 개선 신호가 있지만, 결제 확정값 보강 전에는 CAPI 전송과 dedup 효과를 검증할 수 없다.

호출 2:

```text
GET /api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1&dedup_candidate_limit=10
```

핵심 응답:

```text
total: 691
success: 691
operational/manual/test: 691 / 0 / 0
uniqueEventIds: 428
duplicateEventIds: 263
duplicateEventIdGroups: 174
duplicateOrderEventGroups: 173
retryLikeGroups: 170
retryLikeRows: 427
multiEventIdGroups: 3
multiEventIdRows: 12
latest log: 2026-04-09T21:26:08.834Z, 한국시간 2026-04-10 06:26:08 KST
```

최근 7일의 `multiEventIdGroups` 3개는 모두 수정 전 auto_sync 흔적이다.

| orderId | rows | unique event_id | paymentKey | approvedAt | loggedAt 차이 | sendPath | 판정 |
|---|---:|---:|---|---|---|---|---|
| 202604083892378 | 6 | 2 | 동일 | 2026-04-08 10:27:59 KST | 다름 | auto_sync | 수정 전 위험 후보 |
| 202604066709345 | 4 | 2 | 동일 | 2026-04-06 15:22:00 KST | 다름 | auto_sync | 수정 전 위험 후보 |
| 202604023345485 | 2 | 2 | 동일 | 2026-04-02 14:18:06 KST | 다름 | auto_sync | 수정 전 위험 후보 |

호출 3:

```text
GET /api/attribution/caller-coverage
```

핵심 응답:

```text
payment_success total: 680
withGaSessionId: 132
withClientId: 129
withUserPseudoId: 129
withAllThree: 128
allThreeRate: 18.82%
```

참고로 biocom만 따로 보면 다음과 같다.

```text
GET /api/attribution/caller-coverage?source=biocom_imweb

payment_success total: 598
withGaSessionId: 118
withClientId: 114
withUserPseudoId: 114
withAllThree: 114
allThreeRate: 19.06%
```

호출 4:

```text
GET /api/crm-local/imweb/order-stats?site=biocom
```

핵심 응답:

```text
totalOrders: 8240
memberOrders: 6589
phoneCustomers: 6415
paymentAmountSum: 2816166680
firstOrderAt: 2026-01-07T14:24:14.000Z
lastOrderAt: 2026-04-10T13:04:44.000Z
lastOrderAt KST: 2026-04-10 22:04:44 KST
lastSyncedAt: 2026-04-10 14:22:43
```

호출 5:

```text
GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=5
```

핵심 응답:

```text
imwebOrders: 8037
tossOrders: 5839
matchedOrders: 5820
missingInToss: 2217
missingInImweb: 19
amountMismatchCount: 44
coverageRate: 72.42%
0-1일 coverageRate: 2.8%
2-7일 coverageRate: 60.37%
8-30일 coverageRate: 73.36%
31일 이상 coverageRate: 77.32%
```

보조 해석: post-fix dedup 후보가 0건이라 Toss 1:1 대조로 위험 주문을 닫을 대상은 없었다. 다만 biocom 아임웹 캐시는 최신화되어 최신 주문 구간까지 조회 가능하다.

skip guard 확인:

- 코드상 `syncMetaConversionsFromLedger`는 이미 성공한 운영 `orderId/paymentKey + eventName` 조합을 `duplicate_order_event_success`로 skip하도록 구현되어 있다.
- 하지만 post-fix 운영 auto_sync 전송 로그가 0건이고 post-fix 원장 행도 아직 `pending`이므로, 이번 실행에서는 그 guard가 실제 운영에서 skip을 발생시켰는지 확인할 로그가 없다.
- 이 항목도 다음 auto_sync 이후 확인 대상이다.

식별자 품질을 높이기 위한 구체 액션:

- 1순위: biocom 결제완료 페이지에 최신 스니펫 `2026-04-08-fetchfix`가 계속 적용되는지 모니터링한다. post-fix 샘플 33건은 모두 해당 버전이고 all-three 100%라 방향은 맞다. 다만 전체 누적 coverage는 과거 누락분 때문에 18~19%대라, 앞으로는 `snippetVersion`별 24시간 coverage를 따로 봐야 한다.
- 2순위: `checkout_started` 수집을 실제 주문 전 단계에 붙인다. 2026-04-10 시간대 비교에서 `payment_success`는 51건인데 `checkoutEntries`는 0건이다. 결제완료 페이지는 PG/아임웹 백페이지를 거친 뒤라 GA 쿠키와 dataLayer가 늦게 잡히거나 사라질 수 있으므로, 결제 버튼 클릭 또는 PG 이동 직전에 식별자를 먼저 저장해야 한다.
- 3순위: 랜딩/상품/장바구니 단계에서 `ga_session_id`, `client_id`, `user_pseudo_id`, `_fbc`, `_fbp`를 로컬 저장소에 보존하고 결제완료 페이지가 이를 재사용하게 한다. 현재 스니펫은 `_p1s1a_last_touch`, `__bs_imweb_session`, GA cookie, `gtag('get')`를 읽지만, 상위 단계에서 안정적으로 저장되지 않으면 결제완료 페이지 단독으로는 한계가 있다.
- 4순위: 결제완료 페이지에서 식별자 수집을 1회 즉시 전송이 아니라 짧은 재시도 방식으로 바꾼다. 예를 들어 최초 로드 직후, 500ms, 1500ms에 최대 2~3회 식별자를 다시 읽고 가장 완전한 값을 한 번만 `/api/attribution/payment-success`로 전송한다. 이때 주문번호 기준 dedupe marker는 유지해야 중복 원장 적재를 막을 수 있다.
- 5순위: 외부 GTM 오류를 수정한다. 이전에 확인된 `GTM-W7VXS4D8`의 null `.includes`류 오류가 결제완료 페이지에서 스크립트 흐름을 깨면, 우리 스니펫이 맞아도 식별자 회수가 불안정해진다. 개발팀은 GTM 태그 예외 처리를 넣고, 리인벤팅 CRM 외주사에는 결제완료 페이지에서 dataLayer/GA 값이 사라지지 않도록 요청해야 한다.
- 6순위: 디버그 필드를 추가한다. 각 원장 행에 `gaSessionIdSource`, `clientIdSource`, `userPseudoIdSource`, `fbcSource`, `fbpSource`를 남기면 “쿠키에서 읽었는지, gtag에서 읽었는지, 저장소 fallback인지”를 바로 구분할 수 있다. 지금처럼 aggregate coverage만 보면 어디가 막히는지 찾는 데 시간이 오래 걸린다.
- 7순위: 목표치를 분리한다. 전체 누적 coverage는 과거 누락분 때문에 천천히 오른다. 운영 판단은 최근 24시간/7일, source=biocom_imweb, snippetVersion=2026-04-08-fetchfix 기준으로 보고, 목표는 우선 all-three 70% 이상, Meta click 유입은 `_fbc`/`_fbp` 포함률 별도 70% 이상으로 잡는 게 현실적이다.

검증 명령:

```text
cd backend && npm run typecheck
```

결과:

```text
성공
```

6. 최종 제안

하루 더 로그를 기다리는 것을 추천한다.

지금 바로 운영 반영 완료로 닫으면 안 된다. post-fix 이후 운영 CAPI 전송 로그가 아직 0건이고, post-fix 원장 행은 모두 pending이라 CAPI 후보가 아니다. 다음 Toss/아임웹 확정 동기화와 auto_sync 이후 같은 CAPI log 쿼리에서 `total > 0`인 상태로 `multiEventIdGroups`와 `multiEventIdRows`가 0 또는 무시 가능한 수준인지 확인한 뒤 닫는 게 맞다.

식별자 품질은 별도 축으로 계속 진행한다. 최신 스니펫 행만 보면 개선 신호가 있으므로, 다음 작업은 결제완료 페이지 단독 보강보다 `checkout_started` 선행 수집, 랜딩/장바구니 단계 저장, 짧은 재시도 전송, `snippetVersion`별 coverage 모니터링 순서가 맞다.
