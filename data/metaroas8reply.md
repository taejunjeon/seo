# metaroas8 개발 결과

## 최상단 메모: `tb_sales_toss`와 checkout_started 작업 범위

`tb_sales_toss` 최신화가 막혀 있다는 말은 “정확도를 영원히 75%로 묶는다”는 뜻이 아니다. 운영 Postgres의 `tb_sales_toss`를 직접 고치지 못해도, SEO 로컬 코드에서 Toss direct API fallback과 local shadow ledger를 더 강하게 만들면 site-level Attribution ROAS 정확도는 충분히 올릴 수 있다.

현재 75%로 본 이유는 `tb_sales_toss` 하나 때문만이 아니다. 더 정확히는 아래 3개가 남아 있기 때문이다.

- `checkout_started=0`이라 결제 전 식별자 앵커가 없다.
- CAPI 파일 lock 이후 새 운영 auto_sync 로그가 아직 충분히 쌓이지 않아 dedup 안정화 효과를 후속 검증해야 한다.
- 운영 정본과 로컬 준정본을 매일 비교하는 일일 snapshot이 아직 고정되지 않았다.

따라서 수정된 판단은 이렇다.

- `tb_sales_toss`가 막혀 있어도 SEO 로컬 코드로 site-level ROAS 정확도를 85-90%까지 올리는 것은 가능하다고 본다.
- 단, 로컬 shadow ledger가 운영 정본을 대체하려면 Toss direct fallback 결과, Imweb local cache, local confirmed/pending/canceled snapshot, Meta spend/date axis가 매일 같은 기준으로 저장되어야 한다.
- campaign-level ROAS는 별개다. 이건 `tb_sales_toss`보다 `checkout_started`, alias manual verification, campaign ID/UTM 매핑이 더 큰 병목이다.

`checkout_started` 작업 범위도 분리한다.

제가 할 수 있는 것:

- `checkout_started`용 스니펫 코드 작성
- 기존 `payment_success` 푸터코드에 `checkoutId` 저장/전달 로직 추가
- `data/footercode0408.md` 또는 `backend/src/imwebAttributionSnippet.ts`에 새 버전 코드 반영
- 로컬 백엔드 `POST /api/attribution/checkout-context` 수집 테스트
- `checkout_started -> payment_success` 조인 리포트 코드 작성
- 적용 후 `/api/attribution/caller-coverage`로 수집률 검증

TJ님 또는 아임웹 접근 권한자가 해야 하는 것:

- 실제 `biocom.kr` 아임웹 관리자에서 푸터 코드 교체/추가
- 실제 주문서/결제 시작 페이지 URL 패턴 확인
- 적용 후 운영 사이트에서 장바구니/주문서/결제완료 플로우 1회 테스트

GA4 관리자에서 꼭 해야 하는 작업은 아니다. 이번 목표는 GA4 이벤트를 새로 만드는 게 아니라, 우리 Attribution ledger에 결제 전 식별자 앵커를 쌓는 것이다. GA4 `begin_checkout` 이벤트까지 같이 보내면 보조적으로 좋지만, 지금 ROAS 정합성 개선의 필수 작업은 아임웹 푸터코드 쪽이다.

## 바이오컴 재구매율/LTV-CAC 기준 광고 운영 판단

`/biocom-ltv-cac` 페이지를 신설해 AI CRM 카드에 추가했다. 참고한 데이터는 `/callprice`, `/cohort`, `/api/callprice/*`, `/api/ads/site-summary?date_preset=last_7d`, `/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d`다.

핵심 수치:

- 상담/코호트 기준 기간: 2025-04-01 - 2026-03-27
- 90일 성숙 상담 고객: 2,923명
- 90일 구매 전환 고객: 775명, 전환율 26.5%
- 90일 상담 고객 평균 매출: 94,338원
- 90일 미상담 비교군 평균 매출: 11,071원
- 90일 고객당 상담 효과 추정 매출: 83,267원
- 90일 영양제 전환 고객: 725명, 전환율 24.8%
- 영양제 구매자 중 상담 당일 구매: 42.6%
- 영양제 구매자 중 상담 당일-3일 내 구매: 64.0%
- 상담 완료군 영양제 후속 매출: 892명, 2,024건, 223,724,790원
- 상담 완료군 영양제 고객당 매출 proxy: 약 250,813원
- 상담 완료군 영양제 고객당 주문수 proxy: 약 2.27회
- 1년 2회 이상 영양제 구매율: 43.8%, 단 1년 성숙 영양제 시작 고객이 16명뿐이라 headline으로 쓰면 안 됨
- 6개월 일반 영양제 구매 후 정기구독 전환율: 전체 9.9%
- 6개월 정기구독 전환율 상담군 vs 미상담군: 8.2% vs 3.1%, 상담군 2.60x
- 최근 7일 biocom 광고비: 27,136,569원
- 최근 7일 Attribution confirmed revenue: 27,717,940원
- 최근 7일 Attribution confirmed ROAS: 1.02x
- 최근 7일 Attribution confirmed+pending ROAS: 1.05x
- 최근 7일 Meta purchase value: 130,139,887원
- 최근 7일 Meta purchase ROAS: 4.80x
- site-wide confirmed revenue 잠정 ceiling: 95,414,743원, ceiling ROAS 3.52x
- Attribution confirmed 주문당 광고비 proxy: 약 274,107원
- Meta purchase 이벤트당 광고비 proxy: 약 51,689원

광고 운영 판단:

- 광고를 전체 중단하는 것은 비추천이다. 90일 상담 후 구매 전환 26.5%, 영양제 전환 24.8%, 상담 완료군 영양제 고객당 매출 약 25.1만원, 정기구독 전환 lift가 확인되어 1차 구매 이후 LTV 여지가 있다.
- 전체 예산을 공격적으로 증액하는 것도 아직 비추천이다. 최근 7일 Attribution confirmed ROAS가 1.02x라 1차 confirmed 매출 기준으로는 거의 손익분기이고, 마진/원가를 감안하면 무리한 증액 근거가 약하다.
- Meta purchase ROAS 4.80x는 플랫폼 참고값으로만 본다. Meta가 내부 confirmed revenue보다 훨씬 넓게 잡고 있고, 아직 campaign alias `manual_verified=0`이라 캠페인별 Attribution ROAS 판단은 막혀 있다.
- 현재 최선의 운영안은 “현 예산 유지 + 성과가 확인되는 소재/랜딩/상담 연계 캠페인만 10-15% 이내 소폭 증액 테스트 + Attribution/랜딩/상담 후속 신호가 약한 캠페인은 감액 후보”다.
- 즉 결론은 `광고 계속 진행`, `전체 증액 보류`, `선별 유지/소폭 증액`, `Meta 단독 기준 증액 금지`다.

## 상단 결론: Meta ROAS와 Attribution ROAS 차이는 이제 어디까지 설명 가능한가

부분적으로는 설명 가능하다. 현재 기준으로 “Meta가 왜 더 높게 보이는가”의 큰 구조는 꽤 명확하다. 다만 캠페인별 원인까지 확정하려면 alias 수동 검토와 최신 sync 이후 재검증이 더 필요하다.

2026-04-11 01시대 KST에 확인한 `biocom` 최근 7일 기준은 다음과 같다.

- 기준 기간: 2026-04-04 - 2026-04-10
- 광고비: 27,136,569원
- Attribution confirmed revenue: 27,717,940원
- Attribution pending revenue: 645,700원
- Attribution confirmed+pending revenue: 28,363,640원
- Meta purchase value: 130,139,887원
- Attribution confirmed ROAS: 1.02x
- Attribution confirmed+pending ROAS: 1.05x
- Meta purchase ROAS: 4.80x
- site-wide confirmed revenue ceiling: 95,414,743원, best-case ceiling ROAS 3.52x

해석은 다음과 같다.

- Meta purchase ROAS의 분자는 PG 확정 매출이 아니라 Meta가 자기 광고에 귀속한 purchase value다. 따라서 운영 원장 confirmed ROAS와 1:1로 같아질 수 없다.
- 최근 7일에서도 Meta 4.80x와 Attribution confirmed 1.02x 차이가 크다. 30일 rollout bias만으로 설명하기 어렵고, Meta의 더 넓은 attribution window, view/click 귀속, Pixel/CAPI 수집 범위, 내부 원장/식별자 누락이 같이 섞여 있다고 보는 게 맞다.
- 다만 CAPI에서 “같은 주문+이벤트가 서로 다른 event_id로 여러 번 전송되는” 고위험 중복은 현재 최근 운영 로그 기준 0건이다. 즉 지금 보이는 큰 ROAS 차이의 1순위 원인을 multi-event-id CAPI 중복으로 단정하기는 어렵다.
- 대신 최근 운영 CAPI 로그에는 같은 event_id가 3회씩 반복된 `same_event_id_retry_like` 중복이 37그룹, 111행 있다. 방향은 우리 솔루션/backend에서 Meta CAPI로 보낸 반복 전송이다. Meta는 같은 event_id dedup을 해야 하지만, 운영 로그가 3회씩 2xx 성공으로 남는 것은 추적 노이즈이므로 새 중복이 더 생기지 않게 막아야 한다.
- 내부 Attribution 쪽 식별자 품질은 아직 낮다. `payment_success` all-three coverage는 604건 중 120건, 19.87%이고 `checkout_started`는 0건이다. site-level confirmed revenue 자체보다 캠페인/광고 소재 단위 Attribution 해석에 더 큰 제약이다.
- campaign-level ROAS는 아직 확정하면 안 된다. alias mapping은 여전히 `manual_verified=0` 상태이므로, 사이트 전체 7일 판단은 가능하지만 캠페인별 승패 판단은 보류가 맞다.

## 현재 ROAS 정확도 추정

여기서 말하는 정확도는 “진짜 비즈니스 실적에 가까운가”가 아니라 “현재 운영 의사결정에 그대로 써도 되는가” 기준이다.

| 지표                                                   | 현재 추정 정확도 |    자신감 | 이유                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | --------: | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attribution confirmed ROAS, site-level 최근 7일         |       75% |   7/10 | 최근 24시간/post-fix `payment_success` 식별자는 100%까지 개선됐고, Toss direct fallback으로 confirmed 승격도 일부 된다. 다만 아직 `checkout_started`가 0이고, CAPI 파일 lock 이후 새 로그 재검증과 로컬 일일 snapshot 고정이 남아 있어 완성 정본은 아니다. `tb_sales_toss`가 막힌 점은 병목이지만, SEO 로컬 코드로 상당 부분 우회 가능하다.       |
| Attribution confirmed+pending ROAS, site-level 최근 7일 |       70% | 6.5/10 | confirmed만 볼 때보다 결제 진행 중 주문을 포함해 보수성을 낮춘다. 하지만 pending 중 실제 입금/취소가 갈릴 수 있어 메인값보다 보조값으로 보는 게 맞다.                                                                                                                                               |
| Meta purchase ROAS, site-level 최근 7일                 |       55% |   6/10 | Ads Manager parity 기준으로 API spend/purchase value는 잘 읽히지만, 분자가 PG 확정 매출이 아니라 Meta가 광고에 귀속한 value다. 같은 event_id 반복 전송 로그도 있었고, Meta attribution window/view-through 영향이 섞여 실제 내부 매출 효율보다 높게 보일 가능성이 크다. 플랫폼 참고값으로는 쓸 수 있지만 운영 실력값으로는 과신하면 안 된다. |
| Attribution campaign-level ROAS                      |       20% |   8/10 | alias manual_verified가 0이고 `(unmapped)` 문제가 남아 있다. 캠페인별로 어떤 광고가 실제 매출을 냈는지 판단하기엔 아직 부정확하다.                                                                                                                                                    |
| Meta campaign-level ROAS                             |       50% |   6/10 | Meta 내부 캠페인 귀속 기준으로는 볼 수 있지만, 내부 confirmed revenue와 직접 맞는 숫자가 아니다. 최적화 참고로는 가능하지만 내부 수익성 판단에는 보수적으로 써야 한다.                                                                                                                                    |

현재 결론:

- 운영 메인으로는 `Attribution confirmed ROAS`를 쓰는 게 맞다. 정확도는 약 75%, 자신감은 7/10 정도다.
- 단, 이 75%는 `tb_sales_toss`가 막혀서 더 못 올라간다는 뜻이 아니다. `checkout_started`, local daily snapshot, Toss direct fallback 검증이 고정되면 site-level은 85-90%까지 올릴 수 있다고 본다.
- 운영 보조로는 `Attribution confirmed+pending ROAS`를 같이 본다. 정확도는 약 70%, 자신감은 6.5/10 정도다.
- Meta purchase ROAS는 플랫폼 참고값이다. 정확도는 약 55%, 자신감은 6/10 정도다.
- 캠페인별 ROAS는 아직 Attribution/Meta 모두 운영 의사결정 headline으로 쓰면 안 된다.

정확도를 올리려면:

- `checkout_started`를 SEO local ledger에 붙인다. 결제 전 단계의 `ga_session_id`, `client_id`, `user_pseudo_id`, `_fbc`, `_fbp`, landing/referrer를 먼저 잡아야 campaign-level Attribution이 열린다.
- `payment_success`와 `checkout_started`를 `checkoutId`, `orderId`, `customerKey`, `clientId` 기준으로 조인하는 로컬 리포트를 만든다.
- 최근 24시간/post-fix/snippetVersion별 caller coverage를 매일 저장한다. 누적 19.87%는 과거 누락분이 섞인 지표라 단독 운영 기준으로 쓰면 안 된다.
- CAPI 파일 lock 이후 새 auto_sync 로그에서 `same_event_id_retry_like`와 `multiEventIdGroups`가 다시 생기는지 확인한다.
- site-summary와 daily의 날짜/광고비 축을 계속 같은 기간으로 고정한다.
- local confirmed/pending/canceled snapshot을 매일 남긴다. Toss direct fallback으로 승격한 행은 `toss_direct_api_fallback`으로 따로 표시해 정본과 보조 경로를 구분한다.
- campaign alias 상위 5개만 수동 검토하고, `manual_verified` seed가 생기기 전까지 자동 매핑은 계속 금지한다.
- 운영 DB를 수정하지 않는 범위에서는 SEO local shadow ledger를 준정본으로 보고, 운영 Postgres 값은 읽기 전용 비교 대상으로만 둔다.

## post-fix 뜻

`post-fix`는 제품 기능명이 아니라 문서에서 쓰던 작업용 표현이다. “수정 또는 cutover 이후 구간”이라는 뜻이다.

이번 CAPI 문맥에서는 주로 `2026-04-10T00:00:00.000Z` 이후 로그를 뜻한다. 한국 시간으로는 `2026-04-10 09:00:00 KST` 이후다. 이 기준은 과거 rollout/fix 전 로그와 새 로그를 섞지 않기 위해 임시로 둔 경계선이다.

주의할 점은 `post-fix`가 항상 같은 뜻은 아니라는 것이다. 문서마다 어떤 fix 이후인지가 다를 수 있으므로, 앞으로는 `post-fix`라고만 쓰지 말고 `CAPI dedup fix 이후`, `Toss direct fallback 이후`, `payment caller fix 이후`처럼 구체적으로 적는 게 맞다.

## 개발 반영 성공

`backend/src/metaCapi.ts`에 CAPI auto sync 중복 방지 보강을 넣었다.

- 운영 `auto_sync`가 이미 실행 중이면 같은 프로세스에서 두 번째 sync는 실행하지 않고 `sync_already_running`으로 skipped 처리한다.
- 로컬에 `tsx watch src/server.ts`가 여러 개 떠 있는 상태가 확인되어, 같은 머신의 다중 프로세스도 막도록 `backend/logs/meta-capi-sync.lock` 파일 lock을 추가했다.
- 후보를 고른 뒤 바로 Meta에 보내기 전에 성공 로그를 한 번 더 읽는다. 다른 sync가 방금 같은 event_id 또는 같은 orderId/paymentKey+eventName을 성공 처리했으면 전송하지 않는다.
- sync 결과에 `skippedAlreadySent`, `skippedSyncAlreadyRunning` 카운터를 추가했다. 이제 “이미 성공 전송한 건이라 건너뜀”과 “동시 실행이라 건너뜀”을 구분해서 볼 수 있다.
- lock 파일이 남아 있을 때 영구 차단되지 않도록 45분 이상 지난 lock은 stale lock으로 보고 제거 후 재시도한다.
- test event code가 있는 테스트 전송은 운영 dedup/lock 대상에서 제외했다. 테스트 이벤트는 운영 전송과 섞이지 않아야 하기 때문이다.

`backend/tests/attribution.test.ts`에는 `sync_already_running` 결과가 skipped guard로 노출되는 테스트를 추가했다.

## 현재 읽기 전용 검증 결과

CAPI 최근 운영 로그 조회 결과:

- 조회 기준: `since=2026-04-10T00:00:00.000Z`, KST 기준 2026-04-10 09:00 이후
- total: 111
- success: 111
- failure: 0
- unique event_id: 37
- duplicate event_id groups: 37
- duplicate order-event groups: 37
- retry-like groups: 37
- retry-like rows: 111
- multiEventId groups: 0
- multiEventId rows: 0

샘플은 `202604100435440`, `202604100485707`, `202604100617213` 등이며 각각 같은 event_id 1개가 3회씩 전송된 형태다. 이건 “Meta가 우리에게 3번 보낸 것”이 아니라 “우리 쪽 CAPI auto_sync가 Meta로 3번 보낸 것”이다.

추가 확인 중 `2026-04-10T16:21:04Z` 이후에도 `202604115118967` 주문이 3회 전송된 로그가 있었다. 이 시점에는 메모리 lock만 들어간 직후였고, 실제 로컬 프로세스 상태를 보니 `tsx watch src/server.ts`가 4개, `src/server.ts` 자식 프로세스가 3개 떠 있었다. 그래서 메모리 lock만으로는 부족하다고 판단했고, 같은 파일에서 파일 lock까지 추가했다.

파일 lock 추가 후 임시 lock 파일을 만들어 `syncMetaConversionsFromLedger({ limit: 1 })`를 직접 호출한 결과는 다음과 같았다. 이 검증은 Meta CAPI 네트워크 전송을 만들지 않았다.

```json
{
  "sent": 0,
  "skipped": 1,
  "failed": 0,
  "skippedSyncAlreadyRunning": 1,
  "reason": "sync_already_running"
}
```

파일 lock 추가 이후 기준인 `2026-04-10T16:28:00Z` 이후 로그 조회에서는 아직 새 운영 CAPI 로그가 0건이다. 따라서 파일 lock의 실제 운영 중복 억제 효과는 다음 auto_sync 이후 재확인해야 한다.

로컬 Attribution 원장 조회 결과:

- 전체 ledger row: 707
- `biocom_imweb` live `payment_success`: 604
- confirmed: 424
- pending: 173
- canceled: 7
- Toss direct fallback 표시 row: 42
- Toss direct fallback confirmed row: 39
- 마지막 direct fallback 시각: `2026-04-10T16:22:42.926Z`, KST로 `2026-04-11 01:22:42.926`

caller coverage 조회 결과:

- `payment_success` total: 604
- all-three coverage: 120건, 19.87%
- `checkout_started` total: 0

## `checkout_started=0`의 뜻

`checkout_started`는 사용자가 결제완료를 하기 전, 장바구니/주문서/체크아웃 단계에 진입했을 때 남기는 선행 이벤트다. 지금 `checkout_started=0`이라는 말은 “결제 완료 전 단계의 원장 row가 아직 하나도 없다”는 뜻이다.

왜 중요한가:

- `payment_success`는 결제가 끝난 뒤의 이벤트라 PG/아임웹 결제창 이동, 리다이렉트, 브라우저 보안 정책 때문에 GA/Meta 식별자가 유실될 수 있다.
- `checkout_started`가 있으면 결제 전 같은 사용자/주문 흐름에서 `ga_session_id`, `client_id`, `user_pseudo_id`, `_fbc`, `_fbp`, landing/referrer를 먼저 잡아둘 수 있다.
- 결제완료 페이지에서 일부 값이 빠져도, 선행 checkout row와 `orderId`, `checkoutId`, `customerKey`, `clientId` 같은 키로 보강할 여지가 생긴다.
- 캠페인/광고 소재 단위 Attribution ROAS를 열려면 purchase 시점만 보는 것보다 checkout 진입 시점의 식별자가 훨씬 중요하다. 구매 직후 값만 있으면 “어느 광고에서 시작했는지”를 놓칠 수 있다.

다만 현재 최신 `payment_success` 식별자 자체는 나쁘지 않다. 문제는 누적 지표가 과거 누락분 때문에 낮게 보인다는 점이다.

2026-04-11 01:35:02 KST에 로컬 원장을 직접 계산한 결과:

- 누적 `payment_success`: 604건 중 all-three 120건, 19.87%
- 최근 24시간 기준: 2026-04-10 01:35:02 KST 이후 47건 중 all-three 47건, 100%
- post-fix 기준: 2026-04-10 09:00:00 KST 이후 38건 중 all-three 38건, 100%
- 누적 `checkout_started`: 0건

snippetVersion별 `payment_success` 식별자 품질:

| 범위 | snippetVersion | 총 row | ga_session_id | client_id | user_pseudo_id | all-three |
|---|---:|---:|---:|---:|---:|---:|
| 누적 | `(none)` | 479 | 0 / 479 (0%) | 0 / 479 (0%) | 0 / 479 (0%) | 0 / 479 (0%) |
| 누적 | `2026-04-08-fetchfix` | 125 | 124 / 125 (99.20%) | 120 / 125 (96.00%) | 120 / 125 (96.00%) | 120 / 125 (96.00%) |
| 최근 24시간 | `2026-04-08-fetchfix` | 47 | 47 / 47 (100%) | 47 / 47 (100%) | 47 / 47 (100%) | 47 / 47 (100%) |
| post-fix 이후 | `2026-04-08-fetchfix` | 38 | 38 / 38 (100%) | 38 / 38 (100%) | 38 / 38 (100%) | 38 / 38 (100%) |

결론: `payment_success` 최신 스니펫 품질은 개선됐다. 지금 1순위는 `payment_success` 자체를 더 고치는 것이 아니라 `checkout_started`를 새로 수집해서 결제 전 식별자 앵커를 만드는 것이다. 운영 DB를 수정하지 않고 우리 쪽에서 할 수 있는 다음 작업은 `checkout_started` 수집 endpoint/snippet 흐름을 SEO local ledger에 먼저 붙이고, 그 다음 `payment_success`와 조인되는지 확인하는 것이다.

## `checkout_started` 만드는 방법

현재 백엔드에는 이미 수집 endpoint가 있다.

```text
POST /api/attribution/checkout-context
```

이 endpoint는 내부에서 `buildLedgerEntry("checkout_started", ...)`를 호출하고 SEO local Attribution ledger에 row를 쌓는다. 운영 DB를 수정하지 않는다. 백엔드 validation 기준은 `checkoutId`, `customerKey`, `landing`, `gaSessionId` 중 하나 이상이 있으면 된다.

구현 목표:

- 사용자가 장바구니/주문서/체크아웃 단계에 진입했을 때 `checkout_started`를 1회 보낸다.
- 이때 결제 전 단계의 `ga_session_id`, `client_id`, `user_pseudo_id`, `_fbc`, `_fbp`, landing/referrer, UTM을 먼저 저장한다.
- 같은 사용자가 결제완료까지 가면 `payment_success` row와 이어붙일 수 있게 `checkoutId`를 sessionStorage에 저장하고 payment_success payload에도 같이 보낸다.

권장 트리거:

- 1순위: 아임웹 주문서/결제 시작 페이지 진입 시점
- 2순위: 장바구니에서 “주문하기/결제하기” 버튼 클릭 시점
- 3순위: 결제수단 선택 직전 페이지 진입 시점

트리거 URL은 실제 아임웹 URL을 보고 확정해야 한다. 임시 휴리스틱은 아래처럼 잡을 수 있다.

```text
URL에 shop_cart, shop_order, shop_payment, order_form, checkout 중 하나가 포함되면 후보
단, shop_payment_complete, shop_order_done 같은 결제완료 URL은 제외
```

payload 초안:

```json
{
  "touchpoint": "checkout_started",
  "captureMode": "live",
  "source": "biocom_imweb",
  "checkoutId": "chk_20260411_xxxxx",
  "customerKey": "가능하면 회원번호/전화번호 hash 전 원문이 아니라 normalize 가능한 값",
  "clientObservedAt": "2026-04-11T01:40:00.000+09:00",
  "landing": "현재 페이지 URL",
  "referrer": "document.referrer",
  "ga_session_id": "GA session id",
  "client_id": "GA client id",
  "user_pseudo_id": "없으면 client_id fallback",
  "utm_source": "utm_source",
  "utm_medium": "utm_medium",
  "utm_campaign": "utm_campaign",
  "utm_content": "utm_content",
  "utm_term": "utm_term",
  "gclid": "gclid",
  "fbclid": "fbclid",
  "ttclid": "ttclid",
  "metadata": {
    "snippetVersion": "2026-04-11-checkout-started-v1",
    "ga_measurement_ids": ["G-WJFXN5E2Q1", "G-8GZ48B1S59"],
    "fbc": "_fbc cookie value",
    "fbp": "_fbp cookie value",
    "checkoutTrigger": "pageview_or_button_click",
    "checkoutUrl": "현재 페이지 URL",
    "initial_referrer": "최초 referrer",
    "original_referrer": "최초 referrer",
    "user_pseudo_id_strategy": "client_id_fallback 또는 explicit_value"
  }
}
```

스니펫 로직 초안:

```js
(function () {
  var endpoint = "https://att.ainativeos.net/api/attribution/checkout-context";
  var version = "2026-04-11-checkout-started-v1";

  function isCheckoutCandidate() {
    var href = location.href;
    if (/shop_payment_complete|shop_order_done/i.test(href)) return false;
    return /shop_cart|shop_order|shop_payment|order_form|checkout/i.test(href);
  }

  function getCheckoutId() {
    var key = "ainos_checkout_id";
    var existing = sessionStorage.getItem(key);
    if (existing) return existing;
    var created = "chk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(key, created);
    return created;
  }

  function alreadySent(checkoutId) {
    var key = "ainos_checkout_started_sent_" + checkoutId;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
    return false;
  }

  function sendCheckoutStarted(identity) {
    var checkoutId = getCheckoutId();
    if (alreadySent(checkoutId)) return;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify({
        touchpoint: "checkout_started",
        captureMode: "live",
        source: "biocom_imweb",
        checkoutId: checkoutId,
        clientObservedAt: new Date().toISOString(),
        landing: location.href,
        referrer: document.referrer || "",
        ga_session_id: identity.gaSessionId || "",
        client_id: identity.clientId || "",
        user_pseudo_id: identity.userPseudoId || identity.clientId || "",
        utm_source: identity.utmSource || "",
        utm_medium: identity.utmMedium || "",
        utm_campaign: identity.utmCampaign || "",
        utm_content: identity.utmContent || "",
        utm_term: identity.utmTerm || "",
        gclid: identity.gclid || "",
        fbclid: identity.fbclid || "",
        ttclid: identity.ttclid || "",
        metadata: {
          snippetVersion: version,
          fbc: identity.fbc || "",
          fbp: identity.fbp || "",
          checkoutTrigger: "pageview",
          checkoutUrl: location.href,
          user_pseudo_id_strategy: identity.userPseudoId ? "explicit_value" : "client_id_fallback"
        }
      })
    });
  }

  if (!isCheckoutCandidate()) return;

  // 실제 적용 시에는 기존 payment_success 스니펫의 gaSessionId/clientId/UTM/fbc/fbp 추출 함수를 재사용한다.
  sendCheckoutStarted(window.__ainosIdentity || {});
})();
```

주의점:

- 위 코드는 구조 설명용 초안이다. 실제 배포 코드는 기존 `payment_success` 스니펫의 `gaSessionId`, `clientId`, UTM, `_fbc`, `_fbp` 추출 함수를 재사용해야 한다.
- `checkoutId`는 `payment_success` payload에도 추가해야 한다. 그래야 `checkout_started -> payment_success`를 안정적으로 이어붙일 수 있다.
- 한 페이지에서 여러 번 발화하지 않도록 sessionStorage dedupe key를 둔다.
- 결제완료 URL에서는 `checkout_started`를 보내면 안 된다. 그 시점은 이미 `payment_success` 영역이다.
- 개인정보 원문을 새로 늘리지 않는다. customerKey는 기존 원장 기준과 맞는 값만 사용하고, 불필요한 이름/이메일 원문은 넣지 않는다.

검증 기준:

- 적용 후 24시간 내 `GET /api/attribution/caller-coverage?source=biocom_imweb`에서 `checkout_started.total > 0`이어야 한다.
- `checkout_started` 최근 24시간 all-three coverage 목표는 70% 이상으로 둔다.
- `payment_success`의 `checkoutId` 포함률도 같이 봐야 한다.
- 이후 로컬 리포트에서 `checkoutId`, `clientId`, `customerKey`, `orderId` 순으로 `checkout_started`와 `payment_success` 조인율을 계산한다.

## 일부 해결 또는 아직 판정 보류

CAPI 중복 방지 코드는 넣었지만, 이미 생긴 111행과 메모리 lock 직후 생긴 `202604115118967` 3행은 과거/전환 중 로그다. 파일 lock까지 추가된 이후 새 guard가 실제 운영 중복을 줄였는지는 다음 `auto_sync` 이후 같은 조회를 다시 해야 한다.

이번 guard는 같은 Node 프로세스 안에서는 메모리 lock으로, 같은 머신 다중 프로세스에서는 lock 파일로 막는다. 다만 여러 서버나 컨테이너가 동시에 돌면 로컬 파일 lock은 공유되지 않는다. 그 경우에는 SQLite/DB 기반 send-once table 또는 분산 lock이 필요하다.

현재 로컬에는 백엔드 watch 프로세스가 여러 개 떠 있다. 포트 7020은 하나만 listen 중이지만 background job은 여러 프로세스에서 돌 수 있으므로, 운영 검증 전에는 backend dev 서버를 1개만 남기고 정리하는 게 안전하다.

Meta ROAS와 Attribution ROAS의 차이는 site-level에서는 설명 가능성이 높아졌지만, 캠페인별로는 아직 어렵다. alias manual verify가 0이고 `checkout_started`도 없어서 campaign-level Attribution ROAS를 운영 판단값으로 쓰면 안 된다.

The Clean Coffee Meta API는 이번 조회에서도 토큰 만료로 막힌다. 에러는 “Session has expired on Thursday, 09-Apr-26 23:00:00 PDT”다. 새 토큰 반영 여부는 별도 재확인이 필요하다.

## 실행한 검증

- `cd backend && npm run typecheck`: 통과
- `cd backend && npx tsx --test tests/attribution.test.ts`: 23개 테스트 통과
- `git diff --check -- backend/src/metaCapi.ts backend/tests/attribution.test.ts`: 통과
- 임시 `backend/logs/meta-capi-sync.lock` 생성 후 `syncMetaConversionsFromLedger({ limit: 1 })` 직접 호출: `sync_already_running` skip 확인, lock 파일 제거 확인
- `GET /api/meta/capi/log`: 읽기 전용 조회 완료
- `GET /api/ads/site-summary?date_preset=last_7d`: 읽기 전용 조회 완료
- `GET /api/ads/roas/daily?account_id=act_3138805896402376&date_preset=last_7d`: 읽기 전용 조회 완료
- `POST /api/meta/capi/sync`는 실행하지 않았다. 실제 Meta CAPI 이벤트가 전송될 수 있어서 운영 외부 전송을 만들지 않기 위해서다.

## 다음 액션

1. 다음 CAPI `auto_sync` 이후 아래 조건으로 다시 확인한다. 새 로그에서 `same_event_id_retry_like`와 `multiEventIdGroups`가 늘지 않아야 한다.

```text
GET /api/meta/capi/log?scope=recent_operational&since=<이번 수정 이후 UTC 시각>&include_dedup_candidates=1&dedup_candidate_classification=all
```

2. 최근 7일 운영 표기는 계속 3줄로 고정한다.

```text
운영 메인: Attribution confirmed ROAS
운영 보조: Attribution confirmed+pending ROAS
플랫폼 참고: Meta purchase ROAS
```

3. 식별자 품질은 `payment_success` 누적 19.87%만 보면 안 된다. 최근 24시간과 post-fix 이후 `2026-04-08-fetchfix` row는 all-three 100%다. 현재 더 큰 병목은 `checkout_started=0`이라 결제 전 식별자 앵커가 없다는 점이다.

4. campaign-level ROAS는 alias 상위 5개를 수동 검토하고 `manual_verified`가 생기기 전까지 운영 판단값으로 쓰지 않는다.

5. revenue `tb_sales_toss` 생산자 sync는 여전히 정본 복구의 핵심이다. SEO 로컬 direct fallback은 준정본 보강 경로이고, 운영 정본 교체가 아니다.
