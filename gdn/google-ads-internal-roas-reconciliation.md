# Google Ads 내부 ROAS 대조 결과

작성 시각: 2026-04-25 13:12 KST
최근 업데이트: 2026-04-25 21:55 KST
기준일: 2026-04-25
분석 기간: 2026-03-26 ~ 2026-04-24 KST
문서 성격: 결과보고서

## 10초 요약

Google Ads API live 기준 최근 30일 플랫폼 ROAS는 `5.07x`다.
하지만 운영 attribution 원장에서 Google 유입 `payment_success` confirmed만 보면 내부 ROAS는 `0.30x`다.
전환 액션별 segment를 열어보니, 차이의 1순위 원인은 Primary `구매완료` action이다. 이 action은 이름과 달리 아임웹 자동 NPay count label `r0vuCKvy-8caEJixj5EB`와 연결되어 있고, 이 하나가 Google `Conv. value` `129,954,631원`을 만든다.

## 판단 요약표

| 항목 | 값 | 원천 | confidence |
|---|---:|---|---|
| Google Ads 광고비 | 25,610,287원 | Google Ads API live | high |
| Google Ads 전환값 | 129,954,697원 | Google Ads API live | high |
| Google Ads 모든 전환값 | 214,724,902원 | Google Ads API live | high |
| Google Ads 플랫폼 ROAS | 5.07x | Google Ads API live | high |
| 내부 confirmed 매출 | 7,582,720원 | operational VM attribution ledger | medium-high |
| 내부 confirmed ROAS | 0.30x | operational VM attribution ledger + Google Ads cost | medium-high |
| ROAS 차이 | -4.77x | 내부 ROAS - 플랫폼 ROAS | medium-high |
| 금액 차이 | 122,371,977원 | 플랫폼 전환값 - 내부 confirmed 매출 | medium-high |
| Primary NPay label 전환값 | 129,954,631원 | Google Ads `segments.conversion_action` | high |
| All conv. NPay 보조 전환값 | 84,688,777원 | Google Ads `segments.conversion_action` | high |
| Google 유입 주문 | 31건 | operational VM attribution ledger | medium-high |
| confirmed 주문 | 29건 | operational VM attribution ledger | medium-high |
| pending 주문 | 1건 / 0원 | operational VM attribution ledger | medium |
| canceled 주문 | 1건 / 39,000원 | operational VM attribution ledger | medium |
| 캠페인 ID 커버리지 | 94% | 주문 31건 중 unknown 2건 | medium |

## 원천과 기준

primary source는 Google Ads API live와 운영 attribution 원장이다.
Google Ads API는 운영 계정 `214-999-0943`의 `campaign metrics`, `daily metrics`, `conversion_action`을 읽는다.
운영 원장은 `https://att.ainativeos.net/api/attribution/ledger`의 `source=biocom_imweb`를 읽는다.

기준 시각은 2026-04-25 21:52 KST다.
Google Ads API `fetchedAt`은 `2026-04-25T12:52:34.040Z`다.
운영 원장 `latestLoggedAt`은 `2026-04-24T14:46:09.748Z`, 즉 2026-04-24 23:46 KST다.

## 어떻게 계산했는가

내부 ROAS 분자는 운영 attribution 원장의 Google 유입 `payment_success` 중 `paymentStatus=confirmed` 금액만 쓴다.
Google 유입 판단은 `gclid`, `gbraid`, `wbraid`, `gad_campaignid`, `utm_source=google`, Google 계열 landing/referrer 증거가 있는 경우로 잡았다.
주문 중복은 `paymentKey`, `orderId`, `orderIdBase` 후보로 묶었다.
금액은 metadata의 `totalAmount`, `amount`, `paymentAmount`, `referrerPayment.amount`, URL `amount` 후보에서 양수 값을 사용했다.

내부 ROAS 분모는 같은 기간 Google Ads API campaign cost 합계다.
따라서 이 내부 ROAS는 전체 사업 매출 ROAS가 아니라, 운영 attribution 원장에서 Google 유입 증거가 잡힌 confirmed 매출 기준 ROAS다.

## 캠페인 대조 결과

현재 Google Ads API campaign metrics에 비용이 잡힌 캠페인은 4개다.
그중 내부 원장 campaign ID와 직접 매칭된 것은 `[SA]바이오컴 검사권` 1개다.

| campaign_id | 캠페인 | Google 비용 | Google 전환값 | Google ROAS | 내부 confirmed | 내부 ROAS | 상태 |
|---|---|---:|---:|---:|---:|---:|---|
| 22018174474 | [PM]건기식 실적최대화 | 9,338,574원 | 54,032,949원 | 5.79x | 0원 | 0.00x | platform_only |
| 21807994952 | [PM]검사권 실적최대화 | 7,414,474원 | 37,150,505원 | 5.01x | 0원 | 0.00x | platform_only |
| 23171999678 | [PM] 이벤트 | 7,318,823원 | 34,175,129원 | 4.67x | 0원 | 0.00x | platform_only |
| 14629255429 | [SA]바이오컴 검사권 | 1,538,416원 | 4,596,115원 | 2.99x | 1,318,500원 | 0.86x | matched |

내부 원장에는 campaign ID가 있으나 현재 Google Ads cost row에는 없는 캠페인이 있다.
이 그룹은 historical, removed, paused, 또는 landing URL에 남은 과거 캠페인 ID일 수 있다.

| campaign_id | confirmed | 주문 | UTM 예시 |
|---|---:|---:|---|
| 21804566601 | 3,919,900원 | 11건 | googleads_image_IgGtest_1, googleads_shopping_test_iggtest, googleads_testPM_mineral_url |
| 21808018766 | 1,786,000원 | 5건 | googleads_performancemax_assetgroup_organicacid, googleads_image_IgGtest_1 |
| unknown | 254,910원 | 2건 | p1s1a_verify |
| 22023872618 | 132,810원 | 4건 | googleads_supplements_PM_neuro, googleads_shopping_supplements_neuromaster |
| 23166837345 | 96,800원 | 2건 | googleads_eventPM_metadream_launching |
| 22018178854 | 36,900원 | 1건 | googleads_biocom_PM_metadream |
| 23172054173 | 36,900원 | 1건 | googleads_eventPM_metadream_launching |

## 현재 해석

이 결과만으로 Google Ads 매체가 무조건 나쁘다고 결론내리면 안 된다.
하지만 Google Ads ROAS 숫자는 현재 운영 판단에 그대로 쓰면 안 된다.
이유는 플랫폼 전환값의 거의 전부가 confirmed purchase가 아니라 NPay count label에서 나오기 때문이다.

운영 판단에서는 플랫폼 ROAS `5.07x`를 예산 증액 근거로 쓰면 안 된다.
내부 confirmed 기준으로는 같은 기간 `0.30x`라서, 실제 확정매출과 플랫폼 전환값 사이의 설명되지 않은 차이가 너무 크다.

## 전환 액션별 분해

Google Ads API `segments.conversion_action`으로 전환 액션별 성과를 분리했다.
결론은 명확하다.

`구매완료` action이 Google ROAS 분자를 거의 전부 만든다.
그런데 이 action의 label은 `r0vuCKvy-8caEJixj5EB`이고, `footer/biocomimwebcode.md`에 기록된 아임웹 자동 NPay count 코드와 일치한다.

```html
GOOGLE_ADWORDS_TRACE.setUseNpayCount(true,"AW-304339096/r0vuCKvy-8caEJixj5EB");
```

| action_id | 전환 액션 | Primary | category | Conv. | Conv. value | All conv. | All conv. value | label | 판단 |
|---|---|---|---|---:|---:|---:|---:|---|---|
| 7130249515 | 구매완료 | Y | PURCHASE | 1,032.99 | 129,954,631원 | 1,044.99 | 132,885,327원 | r0vuCKvy-8caEJixj5EB | Primary NPay label. 현재 ROAS 분자 거의 전부 |
| 995043268 | [G4] biocom.kr (web) sign_up | Y | SIGNUP | 66.12 | 66원 | 66.12 | 66원 | 없음 | Primary지만 매출 영향은 미미 |
| 7564830949 | TechSol - NPAY구매 50739 | N | PURCHASE | 0 | 0원 | 775.99 | 81,758,081원 | 3yjICOXRmJccEJixj5EB | Secondary NPay. All conv. value만 부풀림 |
| 981888190 | biocom-316804 (web) page_view_long | N | DEFAULT | 0 | 0원 | 814.29 | 81,428원 | 없음 | 보조 행동값 |
| 827160382 | 바이오컴 장바구니에 추가 | Y | ADD_TO_CART | 0 | 0원 | 946.26 | 0원 | QuHkCL7utYoDEJixj5EB | 조회 후 전환 57건의 주 원천 |

핵심 수식은 아래다.

| 항목 | 값 |
|---|---:|
| Google Conv. value | 129,954,697원 |
| Primary NPay label `구매완료` Conv. value | 129,954,631원 |
| NPay label 제거 후 남는 Google Conv. value | 66원 |
| 내부 confirmed 매출 | 7,582,720원 |
| Google - 내부 차이 | 122,371,977원 |
| NPay primary 제거 후 잔차 | -7,582,654원 |

즉 현재 Google ROAS gap은 복잡한 view-through 문제가 먼저가 아니다.
Primary purchase로 잡힌 `구매완료` action 자체가 NPay count label이라는 점이 먼저다.

## 조치안

### 1. 즉시 운영 기준

Google Ads 플랫폼 ROAS는 당분간 예산 증액 근거로 쓰지 않는다.
`/ads/google`의 내부 confirmed ROAS를 운영 기준으로 본다.
Google `All conv. value`는 더더욱 운영 ROAS로 쓰지 않는다. `TechSol - NPAY구매 50739`가 All conv. value에만 `81,758,081원`을 추가로 만들기 때문이다.

### 2. Google Ads 설정 변경 후보

설정 변경은 read-only 권한 밖이므로 TJ 승인 전에는 실행하지 않는다.
승인 후 해야 할 일은 아래 순서다.

1. Google Ads UI에서 `구매완료` action `7130249515`의 `send_to=AW-304339096/r0vuCKvy-8caEJixj5EB`를 확인한다.
2. 이 action이 아임웹 NPay count가 맞으면 account-default purchase primary에서 제외하거나 Secondary로 낮춘다.
3. `TechSol - NPAY구매 50739`는 이미 Secondary지만 All conv. value 오염 후보로 계속 감시한다.
4. confirmed 주문 기반 purchase 전환을 새로 만든다.
5. 취소/환불은 conversion adjustment 또는 내부 ROAS 보정으로 처리한다.

### 3. 새 purchase 전환 경로

후보는 둘이다.

첫 번째는 client-side purchase다.
`/shop_payment_complete`에 도달한 카드/가상계좌 완료 주문만 Google Ads purchase로 보낸다.
장점은 단순하다.
단점은 NPay return 누락 때문에 NPay confirmed 매출이 빠진다.

두 번째는 server-side offline conversion import다.
운영 원장 confirmed 주문에서 `gclid`, `gbraid`, `wbraid`, 주문번호, 결제금액을 사용해 Google Ads에 업로드한다.
장점은 NPay return 누락과 취소/환불 보정까지 구조적으로 다룰 수 있다.
단점은 mutation 권한과 운영 승인, 중복 방지 설계가 필요하다.

## 남은 작업

1. TJ가 Google Ads UI에서 `구매완료` action `7130249515`의 label과 Primary 설정을 확인한다.
2. TJ가 이 action을 purchase primary에서 내릴지 승인한다.
3. Codex가 confirmed 주문 기반 Google Ads 전환 경로를 설계한다.
4. 최신 GTM live snapshot을 다시 떠서 NPay 클릭 전환과 purchase 중복 상태를 확인한다.
5. gap `122,371,977원`의 잔여 원인을 날짜 기준, pending/취소, NPay return 누락, campaign mapping으로 분해한다.

## 구현 위치

- Backend: `backend/src/routes/googleAds.ts`
- Backend env: `backend/src/env.ts`
- Frontend: `frontend/src/app/ads/google/page.tsx`
- 화면: `http://localhost:7011/ads/google`
- API: `http://localhost:7020/api/google-ads/dashboard?date_preset=last_30d`

## 업데이트 이력

| 시각 | 변경 | 근거 |
|---|---|---|
| 2026-04-25 13:12 KST | 최초 작성. Google Ads API live 성과와 운영 attribution 원장 confirmed 매출을 같은 기간으로 대조 | `/api/google-ads/dashboard`, operational VM attribution ledger `biocom_imweb`, Playwright 화면 확인 |
| 2026-04-25 21:55 KST | 전환 액션별 segment 결과 추가. Primary `구매완료` action이 아임웹 NPay count label `r0vu...`와 일치하고 Google `Conv. value` 거의 전부를 만드는 것으로 확인 | Google Ads API `segments.conversion_action`, `footer/biocomimwebcode.md`, `/ads/google` 전환 액션별 gap 분해 |
