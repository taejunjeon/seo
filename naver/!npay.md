# 네이버페이 주문형 결제형 전환 검토

작성 시각: 2026-04-27 11:21 KST
업데이트: 2026-04-30 11:55 KST
기준일: 2026-04-26
데이터 기준: 2026-04-01 ~ 2026-04-25 결제 완료 원장
Primary source: `operational_postgres.public.tb_iamweb_users`
Cross-check: `backend/data/crm.sqlite3.imweb_orders` 2026-04-01 ~ 2026-04-15 NPay 101건 / 16,542,800원, 2026-04-15 이후 stale
Freshness: primary 최신 결제일 2026-04-25, NPay 최신 결제일 2026-04-25
Confidence: 62%

## 10초 요약

현재 결론은 `네이버페이 주문형을 바로 전체 제거하지 않는다`이다. 2026년 4월 1일부터 4월 25일까지 NPay 주문형은 107건, 17,905,200원이고 전체 매출의 4.65%다. 결제형으로 바꾸면 월 기준 약 2,578,349원, 전체 매출 약 0.56% 손실을 기준 추정으로 본다.

2026년 4월 27일 18:18 KST 기준, `NPay intent-only live publish`를 완료했다. 최종 live version은 `139`, 이름은 `npay_intent_only_live_20260427`이다. 운영 VM backend는 dedupe 보강본으로 재배포되어 있고, GTM tag 118은 `environment=live`, `debug_mode=false`로 버튼 클릭 intent만 저장한다. 18:16 KST live smoke에서 최신 intent 1건이 `environment=live`, `ga_session_id=1777281391`, `product_idx=423`으로 저장됐다. GA4 purchase, Meta CAPI Purchase, Google Ads 구매 전환, NPay 주문형 설정, purchase dispatcher는 변경하지 않았다.

2026년 4월 30일 11:50 KST 기준 수집 품질은 통과다. live publish 이후 live intent는 251건이고, 최근 24시간 92건의 `client_id`, `ga_session_id`, `product_idx` 채움률은 모두 100%다. rollback 조건은 없다. 다만 실제 주문 매칭률은 아직 보지 않았으므로 purchase dispatcher는 계속 보류한다.

승인/실행 문서: [[npay-intent-live-publish-approval-20260427|NPay Intent-Only Live Publish 승인안]]

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| NPay | [[#NPay-Sprint1]] | 주문형 매출 현황 | Codex | 100% / 0% | [[#NPay-Sprint1]] |
| NPay | [[#NPay-Sprint2]] | 결제형 전환 판단 | Codex + TJ | 80% / 0% | [[#NPay-Sprint2]] |
| NPay | [[#NPay-Sprint3]] | 검증 설계 | Codex + 개발팀 | 60% / 0% | [[#NPay-Sprint3]] |
| NPay | [[#NPay-Sprint4]] | 리턴 URL 직접 구현 검토 | Codex | 100% / 0% | [[#NPay-Sprint4]] |
| NPay | [[#NPay-Sprint5]] | npay_intent 저장 설계 | Codex + Claude Code | 100% / 0% | [[#NPay-Sprint5]] |
| NPay | [[#NPay-Sprint6]] | intent API와 GTM live 반영 | Codex + TJ | 100% / 100% | [[#NPay-Sprint6]] |
| NPay | [[#NPay-Sprint7]] | live 수집 품질 점검 | Codex | 100% / 100% | [[#NPay-Sprint7]] |

## 문서 목적

이 문서는 아임웹 네이버페이 `주문형`을 끄고 `결제형`으로 바꿀 때 매출이 얼마나 흔들릴지, 지금 바로 바꿔도 되는지, 다음에 무엇을 확인해야 하는지 정리한다.

## 이 작업이 하는 일

주문 원장에서 실제 NPay 주문 수, NPay 매출, NPay가 많이 쓰이는 상품을 확인한다. 그 다음 버튼 위치를 바꿨을 때 생길 수 있는 매출 손실을 추정한다.

## 왜 필요한가

Google Ads ROAS 정합성 문제는 `결제 완료 후 우리 사이트로 돌아오는 신호`가 약하면 계속 생긴다. 결제형은 추적 통제를 강화할 수 있지만, 주문형 버튼을 없애면 네이버페이 즉시구매 고객 일부가 이탈할 수 있다.

## 핵심 숫자

| 항목 | 값 | 의미 |
|---|---:|---|
| 전체 주문 | 1,733건 | 2026-04-01 ~ 2026-04-25 |
| 전체 매출 | 385,465,559원 | 취소/환불/미입금 제외 |
| NPay 주문형 주문 | 107건 | 전체 주문의 6.17% |
| NPay 주문형 매출 | 17,905,200원 | 전체 매출의 4.65% |
| 전체 평균 주문금액 | 222,427원 | 주문 기준 |
| NPay 평균 주문금액 | 167,338원 | 주문 기준 |
| 4월 월말 NPay 매출 추정 | 21,486,240원 | 25일 관측치를 30일로 단순 보정 |
| 기준 손실 추정 | 2,578,349원/월 | NPay 매출의 12% 이탈 가정 |
| 전체 매출 영향 | 0.56% | 월말 전체 매출 추정 대비 |

## NPay-Sprint1

**이름**: 주문형 매출 현황

### 확인된 것

2026년 4월 현재 NPay 주문형은 전체 매출의 핵심 축은 아니다. 전체 매출 385,465,559원 중 NPay는 17,905,200원이다.

다만 상품군별 위험은 다르다.

| 카테고리 | 전체 매출 | NPay 매출 | NPay 매출 비중 | 판단 |
|---|---:|---:|---:|---|
| 검사권/분석서비스 | 338,923,065원 | 10,138,000원 | 2.99% | NPay 의존 낮음 |
| 건강식품/영양제 | 43,304,692원 | 7,330,800원 | 16.93% | NPay 의존 높음 |
| 팀키토/도시락 | 987,626원 | 436,400원 | 44.19% | 표본 작음, 참고만 |
| 기타 | 2,250,176원 | 0원 | 0.00% | 영향 낮음 |

검사권은 매출 규모가 크지만 NPay 의존도가 낮다. 그래서 현재 검사권 상세페이지에 네이버페이 버튼이 없어도 매출이 나오는 현상은 데이터와 크게 충돌하지 않는다.

반대로 건강식품/영양제는 NPay 비중이 높다. 이쪽은 주문형 버튼이 모바일 즉시결제 역할을 하고 있을 가능성이 높다.

### NPay 주요 상품

| 순위 | 상품 | 주문 | 배분 매출 |
|---:|---|---:|---:|
| 1 | 종합 대사기능&음식물 과민증 검사 Set | 17건 | 10,138,000원 |
| 2 | 뉴로마스터 60정 (1개월분) | 37건 | 2,125,247원 |
| 3 | 바이오밸런스 90정 (1개월분) | 19건 | 1,187,647원 |
| 4 | 혈당관리엔 당당케어 (120정) | 11건 | 736,800원 |
| 5 | 클린밸런스 120정 (1개월분) | 8건 | 644,130원 |
| 6 | 메타드림 식물성 멜라토닌 함유 | 12건 | 574,867원 |

주의: `tb_iamweb_users`는 주문-상품 행 원장이다. 상품별 매출은 한 주문에 여러 상품이 있을 때 주문금액을 상품 수로 균등 배분했다. 정확한 상품별 결제금액이 아니라 상품 믹스 판단용이다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Sprint2

**이름**: 결제형 전환 판단

### 주문형과 결제형의 차이

`주문형`은 상품 상세페이지에 초록색 NPay 구매 버튼이 밖으로 나와 있는 방식이다. 고객은 우리 사이트 장바구니나 주문서를 깊게 거치지 않고 네이버페이 결제로 바로 넘어간다. 장점은 빠르다는 것이다. 단점은 우리 사이트의 checkout, 결제 완료, 리턴 흐름을 촘촘히 잡기 어렵다는 것이다.

`결제형`은 고객이 먼저 우리 사이트의 `구매하기`를 누르고, 우리 주문서 안에서 결제수단으로 네이버페이를 고르는 방식이다. 장점은 우리 주문서 안에서 이벤트를 더 잘 잡을 수 있다는 것이다. 단점은 한 단계가 늘어나므로 즉시결제 고객 일부가 빠질 수 있다는 것이다.

즉, 이 결정은 `추적 정확도`와 `구매 편의성`의 교환이다.

### 매출 감소 추정

현재 기준 추정은 `NPay 매출의 12% 이탈`이다.

| 시나리오 | 가정 | 월 손실 추정 | 전체 매출 영향 | 신뢰도 |
|---|---:|---:|---:|---:|
| 낮은 이탈 | NPay 이용자 5% 이탈 | 1,074,312원 | 0.23% | 54% |
| 기준 추정 | NPay 이용자 12% 이탈 | 2,578,349원 | 0.56% | 62% |
| 보수적 위험 | NPay 이용자 22% 이탈 | 4,726,973원 | 1.02% | 48% |

이 숫자는 실험 결과가 아니다. 현재 결제수단 비중, 상품군별 의존도, 외부 쇼핑몰 관찰을 합친 운영 추정이다.

### 안다르, 닥터피엘, 메디큐브 사례 해석

안다르, 닥터피엘, 메디큐브가 상품 페이지 밖에 NPay 버튼을 두는 것은 `즉시결제 편의성`이 매출에 도움이 된다고 보고 있을 가능성이 높다. 특히 모바일, 비회원, 반복구매, 저관여 상품에서는 네이버페이 버튼이 결제 마찰을 줄인다.

하지만 이 사례만으로 바이오컴도 무조건 주문형을 유지해야 한다고 확정할 수는 없다. 바이오컴은 검사권처럼 설명과 선택 과정이 긴 상품이 있고, 건강식품처럼 즉시결제가 중요한 상품도 있다. 그래서 전환은 전체 일괄 변경보다 상품군별 위험을 나눠 봐야 한다.

### 현재 결론

바로 전체 주문형을 끄는 것은 이르다. 검사권은 영향이 작아 보이지만, 건강식품/영양제는 NPay 의존도가 높다.

승인할 운영 방향은 다음이다.

1. 결제형 설계는 착수한다.
2. 주문형 전체 제거는 보류한다.
3. 가능하면 상품군별 또는 기간별 검증을 먼저 한다.
4. 전환이 강제라면 롤백 기준을 먼저 정한다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Sprint3

**이름**: 검증 설계

### 가장 파급력 있는 작업

현재 가장 파급력 있는 작업은 `주문형을 끄는 것`이 아니다. 가장 파급력 있는 작업은 `결제 완료 기준의 confirmed 주문 전환을 안정적으로 만드는 것`이다.

이유는 단순하다. 주문형을 끄면 추적은 좋아질 수 있지만 매출이 흔들릴 수 있다. 반면 confirmed 주문 전환을 만들면 주문형을 유지하더라도 Google Ads ROAS 판단을 더 정확하게 만들 수 있다.

### 실행 계획

| 순서 | 작업 | 담당 | 성공 기준 |
|---:|---|---|---|
| 1 | 결제형 설정 가능 범위 확정 | TJ + 개발팀 | 아임웹에서 결제형 전환 가능 여부 확인 |
| 2 | confirmed 주문 기반 purchase 설계 | Codex + 개발팀 | 주문번호, 결제금액, 취소 여부 기준 확정 |
| 3 | GTM/GA4/Google Ads 이벤트 설계 | Codex + 개발팀 | `checkout_start`, `payment_select_npay`, `purchase_confirmed` 구분 |
| 4 | 7~14일 검증 | TJ + Codex | NPay 주문수, NPay 매출, 전체 CVR, 건강식품 CVR 비교 |
| 5 | 전환 또는 롤백 판단 | TJ | 월 손실 1% 초과 시 롤백 또는 부분 유지 |

### 롤백 기준

아래 중 하나가 발생하면 주문형 제거를 되돌린다.

1. 전체 매출이 같은 요일 기준 1.0% 이상 하락한다.
2. 건강식품/영양제 매출이 같은 요일 기준 5.0% 이상 하락한다.
3. NPay 주문수가 3일 연속 기준선 대비 20% 이상 하락한다.
4. checkout 단계 이탈이 결제형 전환 전보다 명확히 증가한다.

### 프론트 산출물

분석 화면은 `http://localhost:7010/npay`에 만들었다. AI CRM 허브 `http://localhost:7010/#ai-crm`에도 `네이버페이 주문형 분석` 카드로 연결했다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## 월별 추세

| 월 | 전체 주문 | 전체 매출 | NPay 주문 | NPay 매출 | NPay 매출 비중 |
|---|---:|---:|---:|---:|---:|
| 2025-10 | 2,225건 | 511,169,758원 | 261건 | 64,017,900원 | 12.52% |
| 2025-11 | 2,473건 | 542,299,322원 | 64건 | 4,743,800원 | 0.87% |
| 2025-12 | 2,070건 | 439,612,812원 | 114건 | 12,425,600원 | 2.83% |
| 2026-01 | 2,967건 | 720,333,777원 | 125건 | 25,295,500원 | 3.51% |
| 2026-02 | 2,040건 | 491,664,531원 | 107건 | 20,921,600원 | 4.26% |
| 2026-03 | 2,222건 | 521,544,055원 | 118건 | 22,945,000원 | 4.40% |
| 2026-04 | 1,733건 | 385,465,559원 | 107건 | 17,905,200원 | 4.65% |

주의: 2026년 3월 이전 일부 행은 payment status가 한국어/영문으로 섞여 있다. 그래서 장기 추세보다 2026년 4월 현재월 판단의 신뢰도가 더 높다.

## NPay-Sprint4

**이름**: 리턴 URL 직접 구현 검토

검토 추가 시각: 2026-04-26 00:56 KST

### 결론

아임웹 관리자에 리턴 URL 설정이 없다면, `주문형 네이버페이의 리턴 URL만 우리가 직접 바꾸는 것`은 어렵다. 난이도는 `상`이고, 사실상 아임웹 또는 네이버페이 연동 주체가 열어줘야 한다.

반대로 `리턴 URL 없이도 매출 전환을 복구하는 서버 사이드 보정`은 가능하다. 난이도는 `중`이고, 기존 attribution ledger, GA4 Measurement Protocol, 아임웹 주문 API/운영 DB polling을 재사용하면 3~4일 작업으로 볼 수 있다.

### 왜 리턴 URL만 직접 구현하기 어려운가

네이버페이 결제형 직접 연동에서는 `returnUrl`을 결제 요청 파라미터로 넘길 수 있다. 네이버페이 개발자센터 FAQ도 결제 완료 후 가맹점이 등록한 `returnUrl + 파라미터`로 리디렉션한다고 설명한다.

하지만 현재 바이오컴이 쓰는 것은 아임웹 내장 `주문형`이다. 아임웹 가이드에서도 네이버페이 주문형은 구매 시도 시 서비스사로 이동되는 `외부 채널 주문`이라고 설명한다. 이 경우 결제 요청을 만드는 주체는 우리 프론트엔드가 아니라 아임웹/네이버페이 연동부다.

그래서 우리가 페이지에 자바스크립트를 추가해도 이미 네이버페이로 넘어가는 결제 요청의 `returnUrl` 파라미터를 안정적으로 바꾸기 어렵다. 브라우저에서 버튼 클릭을 가로채는 방식은 결제 실패, 약관/검수 위반, 모바일 브라우저 호환 문제를 만들 수 있어 운영 적용안으로 보지 않는다.

### 난이도별 선택지

| 선택지 | 구현 가능성 | 난이도 | 예상 소요 | 판단 |
|---|---|---:|---:|---|
| 아임웹 설정에서 return URL 발견 | 높음, 설정이 있으면 | 하 | 0.5일 | 최선 |
| 아임웹 고객센터/PG 상담으로 return URL 변경 요청 | 중 | 중 | 1~5영업일 | 문의 가치 있음 |
| 아임웹 주문형 버튼을 유지하면서 JS로 return URL 강제 변경 | 낮음 | 상 | 예측 불가 | 비권장 |
| 네이버페이 결제형 직접 연동을 우리가 새로 구현 | 가능 | 상 | 7~15일+심사 | 장기안 |
| NPay 클릭 intent 저장 + confirmed 주문 polling + GA4/Ads 서버 전송 | 가능 | 중 | 3~4일 | 현실적인 1순위 대체안 |

### 직접 결제형을 새로 만들 때 필요한 것

완전 직접 연동은 단순 리턴 URL 작업이 아니다. 최소한 아래가 필요하다.

1. 네이버페이 결제 예약과 승인 API 연동
2. 상품명, 상품별 금액, 과세/면세, 배송비, 배송 정책 전달
3. 주문 생성, 결제 성공, 결제 실패, 취소, 부분취소 처리
4. 아임웹 주문 원장과 네이버페이 결제 원장 중복 방지
5. 네이버페이 검수와 운영 키 발급
6. Google Ads/GA4/Meta 이벤트 중복 방지

따라서 이건 `리턴 URL 하나 만드는 일`이 아니라 `체크아웃을 일부 직접 운영하는 일`이다.

### 권장 구현안

현재 권장안은 `리턴 URL을 기다리지 않고 서버 사이드 보정을 먼저 설계`하는 것이다.

구체적으로는 NPay 버튼 클릭 시점에 `client_id`, `session_id`, `gclid/gbraid/wbraid`, 상품 정보, 현재 URL을 `npay_intent`로 저장한다. 이후 아임웹 주문 원장 또는 운영 DB에서 `NAVERPAY_ORDER` confirmed 주문을 발견하면, 가장 가까운 intent와 매칭해 GA4 Measurement Protocol과 Google Ads confirmed conversion으로 보낸다.

이 방식은 고객이 네이버페이 결제 후 사이트로 돌아오지 않아도 작동한다. 그리고 주문형 버튼을 유지할 수 있어 매출 리스크가 낮다.

### 출처

- 네이버페이 개발자센터 FAQ: `returnUrl + 가맹점 파라미터` 리디렉션 가능
- 네이버페이 개발자문서: 결제 완료 후 이동 URL은 결제 요청의 `returnUrl` 개념
- 아임웹 FAQ: 네이버페이 주문형은 서비스사로 이동되는 외부 채널 주문
- 아임웹 FAQ: 결제형은 관리자 네이버페이 설정의 결제형 설정에서 연동 값을 직접 입력

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Sprint5

**이름**: npay_intent 저장 설계

설계 추가 시각: 2026-04-27 01:40 KST

### 결론

`npay_intent`는 구매 기록이 아니다. 고객이 네이버페이 주문형 버튼을 눌러 외부 결제 화면으로 나간 `결제 시도 기록`이다.

정본 설계는 이 절에만 둔다. 다른 문서는 이 절을 링크하고, 스키마와 매칭 규칙을 중복해서 쓰지 않는다.

이 설계의 목적은 결제 완료 후 고객이 biocom 사이트로 돌아오지 않아도, 나중에 운영 주문 원장의 confirmed NPay 주문과 광고 클릭 정보를 연결하는 것이다. 즉 주문형 버튼은 유지하면서 Google Ads, GA4, Meta의 구매 전환을 실제 입금 기준에 더 가깝게 복구한다.

### 저장 위치 판단

v1은 별도 테이블 `npay_intent_log`를 만든다. `attribution_ledger`에 바로 섞지 않는다.

이유는 명확하다. `npay_intent`는 아직 돈이 들어온 기록이 아니다. 클릭 시도와 결제 완료를 같은 장부에 섞으면 ROAS 보정 과정에서 `시도`와 `구매`가 다시 섞일 위험이 있다. 이후 매칭이 안정되면 `attribution_ledger`에는 confirmed purchase만 별도 원장 행으로 적재한다.

주의: 이 문서는 설계다. 프로덕션 DB 스키마 변경은 TJ 승인 전에는 하지 않는다.

### 저장해야 할 값

| 구분 | 필드 | 설명 |
|---|---|---|
| 기본 키 | `id` | 서버가 만든 UUID |
| 중복 방지 | `intent_key` | 같은 클릭이 여러 번 전송돼도 한 건으로 보게 하는 키 |
| 사이트 | `site` | `biocom` |
| 시각 | `captured_at`, `received_at` | 브라우저 클릭 시각, 서버 수신 시각 |
| 수집 경로 | `source`, `environment` | `gtm_118`, `preview` 또는 `live` |
| GA4 | `client_id`, `ga_cookie_raw`, `ga_session_id`, `ga_session_number` | GA4 세션에 다시 붙이기 위한 값. `client_id`는 `_ga` prefix 제거값, `ga_cookie_raw`는 원본 `_ga` |
| Google Ads | `gclid`, `gbraid`, `wbraid` | Google Ads 클릭 또는 iOS 계열 클릭 식별값 |
| UTM | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | 광고·캠페인 보조 식별값 |
| Meta | `fbp`, `fbc`, `fbclid` | Meta CAPI 확장 가능성을 위한 값 |
| 페이지 | `page_location`, `page_referrer` | 어떤 페이지에서 NPay를 눌렀는지 |
| 상품 | `product_idx`, `product_name`, `product_price` | 주문 매칭 보조값 |
| 사용자 | `member_code`, `member_hash`, `phone_hash`, `email_hash` | 가능한 경우만 저장, 원문 개인정보는 저장하지 않음 |
| 브라우저 | `user_agent_hash`, `ip_hash` | 원문 user agent와 IP는 저장하지 않고 해시만 저장 |
| GTM | `button_selector`, `gtm_event_id`, `debug_mode` | Preview 검증과 중복 추적용 |
| 원문 | `raw_payload` | 필드 누락과 디버그 확인용 JSON |
| 매칭 | `match_status`, `matched_order_no`, `matched_order_amount`, `matched_payment_method`, `matched_at` | confirmed 주문과 연결된 결과 |
| 신뢰도 | `match_confidence`, `match_reason` | 왜 이 intent가 이 주문과 연결됐는지 |
| 전송 | `ga4_dispatched_at`, `meta_dispatched_at`, `google_ads_dispatched_at` | 서버 전환 전송 여부 |

### 최소 인덱스와 제약

| 항목 | 목적 |
|---|---|
| `unique(intent_key)` | 더블클릭, sendBeacon 재시도 중복 방지 |
| `(site, captured_at desc)` | 기간별 클릭 시도 조회 |
| `(site, match_status, captured_at desc)` | pending intent 매칭 작업 |
| `(client_id, ga_session_id, captured_at desc)` | GA4 세션 기준 역추적 |
| `(product_idx, captured_at desc)` | 상품 기준 주문 매칭 |
| `(matched_order_no)` where not null | 같은 주문에 intent가 여러 번 붙는지 점검 |

### 수신 API 계약

GTM `[118]`은 아래 서버 수신점으로 보낸다.

```http
POST /api/attribution/npay-intent
```

요청 본문은 아래 형태로 제한한다.

```json
{
  "site": "biocom",
  "source": "gtm_118",
  "environment": "preview",
  "captured_at": "2026-04-27T01:40:00+09:00",
  "client_id": "123456789.987654321",
  "ga_cookie_raw": "GA1.1.123456789.987654321",
  "ga_session_id": "1777221600",
  "gclid": null,
  "gbraid": null,
  "wbraid": null,
  "fbp": null,
  "fbc": null,
  "fbclid": null,
  "page_location": "https://www.biocom.kr/...",
  "page_referrer": "https://www.google.com/",
  "product_idx": "12345",
  "product_name": "메타드림 식물성 멜라토닌 함유",
  "product_price": 36900,
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "gdn",
  "debug_mode": true
}
```

서버는 `site`와 `page_location`을 허용 목록으로 검사한다. 허용 도메인은 biocom 운영 도메인으로 제한한다. 저장 전 `page_location`과 `page_referrer`는 query whitelist를 적용해 `idx`, UTM, `gclid`, `gbraid`, `wbraid`, `fbclid`만 남긴다. 문자열 길이를 제한하고, 원문 IP와 user agent는 저장하지 않고 해시 처리한다.

응답은 단순해야 한다.

```json
{
  "ok": true,
  "intent_id": "uuid",
  "deduped": false
}
```

### 주문 매칭 규칙

Primary source는 `operational_postgres.public.tb_iamweb_users`다. confirmed NPay 주문은 `payment_method`가 `NAVERPAY_ORDER`, `npay`, `naver`, `네이버` 계열이고 취소·환불·미입금이 아닌 주문으로 본다.

매칭 기본 창은 `intent captured_at 이후 0~60분`이다. 결제 완료가 늦게 들어오는 예외를 위해 운영 dry-run에서는 24시간까지 별도 후보로 보되, 자동 확정은 60분 안쪽 후보만 우선한다.

점수 규칙은 v1에서 아래처럼 둔다.

| 조건 | 점수 |
|---|---:|
| 같은 `member_code` 또는 같은 회원 해시 | +50 |
| 같은 상품 ID 또는 상품명이 강하게 일치 | +25 |
| 결제 완료가 intent 이후 15분 이내 | +20 |
| 결제 완료가 intent 이후 60분 이내 | +10 |
| 같은 `client_id`와 `ga_session_id` | +15 |
| 같은 Google Ads 클릭 식별값 또는 UTM 묶음 | +10 |

자동 매칭 기준은 75점 이상이다. 60~74점은 검토 후보로 남긴다. 후보가 둘 이상이면 `ambiguous`로 남기고 구매 전환을 보내지 않는다.

### 처리 흐름

1. 고객이 NPay 주문형 버튼을 누른다.
2. GTM `[118]` sendBeacon이 `npay_intent`를 서버로 보낸다.
3. 서버는 중복을 제거하고 `pending` 상태로 저장한다.
4. polling 작업이 운영 주문 원장에서 confirmed NPay 주문을 찾는다.
5. 매칭 점수가 충분하면 `matched`로 바꾼다.
6. 첫 운영 반영은 전송 없이 dry-run 보고서만 만든다.
7. TJ 승인 후 GA4, Meta, Google Ads confirmed conversion 전송을 순서대로 연다.

### 성공 기준

| 검증 | 성공 기준 |
|---|---|
| GTM Preview | NPay 버튼 클릭 1회가 intent 1건으로 저장된다 |
| 중복 방지 | 10초 안의 반복 클릭 또는 재전송이 구매 2건으로 번지지 않는다 |
| 주문 매칭 | 실 NPay 주문 1건이 75점 이상으로 intent와 연결된다 |
| 구매 전송 | Preview 또는 dry-run에서는 GA4/Meta/Google Ads purchase를 보내지 않는다 |
| 의미 구분 | `npay_intent`는 어떤 화면에서도 purchase로 집계하지 않는다 |

### 역할 구분

- TJ: GTM Preview와 운영 publish 승인, 실 NPay 결제 테스트 승인, Google Ads 전환 액션 변경 승인
- Codex: `npay_intent_log` 저장 설계, API 계약, 서버 검증, 주문 매칭, dry-run 보고서, GA4/Meta/Google Ads 서버 전환 설계
- Claude Code: GTM `[118]` sendBeacon 초안, 버튼 selector 안정화, 브라우저 쿠키·URL 파라미터 추출, Preview 확인 문구와 프론트 표시 정리

### 왜 GTM `[118]` sendBeacon 초안은 Claude Code 담당인가

Codex가 못 해서가 아니다. 역할 경계 때문이다.

Codex는 서버, DB, 주문 매칭, 전환 전송처럼 데이터 정합성에 직접 영향을 주는 부분을 맡는다. 반면 GTM `[118]` sendBeacon은 브라우저에서 NPay 버튼 클릭을 감지하고, 쿠키와 URL 값을 읽고, Preview에서 selector가 깨지지 않는지 확인하는 프론트/GTM 작업이다.

따라서 Claude Code가 초안을 맡는 편이 맞다. 단, 어떤 필드를 보내야 하는지와 어떤 endpoint로 보내야 하는지는 Codex의 이 설계를 기준으로 한다. Publish는 TJ 승인 전에는 하지 않는다.

### Codex 5.5가 GTM 작업까지 진행하는 안

검토 결론은 `가능하다`이다. 이번 작업은 단순 프론트 문구 작업이 아니라 `서버 수신점`, `저장 필드`, `중복 방지`, `구매 전환 전송 금지 조건`이 모두 맞아야 한다. 그래서 endpoint와 저장 설계를 맡은 Codex 5.5가 GTM `[118]` sendBeacon 초안까지 작성하면 handoff가 줄어든다.

다만 역할 경계를 없애자는 뜻은 아니다. Codex 5.5가 맡을 범위는 `초안 코드`, `전송 payload`, `Preview 테스트 체크리스트`, `live publish 전 위험 조건`까지다. 실제 GTM publish, 실결제 테스트, 운영 반영은 여전히 TJ 승인 대상이다.

| 선택지 | 장점 | 위험 | 판단 |
|---|---|---|---|
| Claude Code가 GTM 초안 작성 | 브라우저/GTM/프론트 역할 경계가 명확함 | endpoint 설계와 어긋나면 재작업 가능 | 원칙상 적합 |
| Codex 5.5가 GTM 초안 작성 | 저장소, API, 매칭 규칙과 한 번에 맞출 수 있음 | selector와 모바일 Preview 검증은 실제 화면 확인이 필요 | 이번 건은 더 빠름 |
| Codex 5.5 작성 후 Claude Code 리뷰 | 데이터 계약과 브라우저 안정성을 둘 다 확인 | 한 번 더 넘겨야 해서 느림 | 운영 반영 전 가장 안전 |

현재 추천은 Codex 5.5가 먼저 GTM `[118]` 초안을 작성하고, live publish 전에는 TJ Preview 확인 또는 Claude Code 리뷰를 거치는 방식이다. 자신감은 84%다.

### YES/NO 판단

| 질문 | 답 | 자신감 |
|---|---|---:|
| `npay_intent` 저장 설계를 진행해야 하는가 | YES | 90% |
| v1에서 별도 테이블을 써야 하는가 | YES | 82% |
| `attribution_ledger`에 클릭 intent를 바로 섞어도 되는가 | NO | 78% |
| GTM `[118]`을 바로 live publish해도 되는가 | NO | 90% |
| `npay_intent`를 purchase로 집계해도 되는가 | NO | 98% |
| Codex 5.5가 GTM `[118]` 초안까지 맡아도 되는가 | YES | 84% |

### 다음 행동

1. Codex가 승인용 migration/API dry-run 계획을 만든다.
2. Codex 5.5가 이 endpoint 계약에 맞춰 GTM `[118]` sendBeacon 초안을 먼저 만든다.
3. TJ가 GTM Preview에서 beacon 호출만 확인한다.
4. 필요하면 Claude Code가 selector와 모바일 Preview 관점에서 리뷰한다.
5. Codex가 pending intent와 confirmed NPay 주문 매칭률을 7일치로 계산한다.
6. 매칭률과 중복률이 기준을 넘으면 서버 전환 전송을 별도 승인으로 진행한다.

### 기준 정보

- Source: 이 문서의 설계, `operational_postgres.public.tb_iamweb_users`, 기존 NPay 분석 API 결과
- Window: 2026-04-01 ~ 2026-04-25 NPay 주문 현황
- Freshness: primary 최신 결제일 2026-04-25, 설계 작성 시각 2026-04-27 01:44 KST
- Confidence: 82%

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Sprint6

**이름**: intent API와 GTM live 반영

구현 추가 시각: 2026-04-27 11:21 KST

### 결론

Codex가 먼저 진행할 수 있는 선행 작업과 TJ 승인 후 live 반영까지 처리했다. 이제 서버는 네이버페이 버튼 클릭 intent를 purchase와 분리해서 저장할 수 있고, 30초 안의 같은 클릭 중복은 새 행이 아니라 `duplicate_count` 증가로 흡수한다.

운영 live publish는 2026년 4월 27일 18:10 KST에 완료했다. 최종 live version은 `139`, 이름은 `npay_intent_only_live_20260427`이다. 18:16 KST live smoke에서 최신 intent 1건이 `environment=live`, `ga_session_id=1777281391`, `product_idx=423`으로 저장됐다.

### 완료한 것

| 항목 | 파일/API | 상태 |
|---|---|---|
| intent 저장 모듈 | `backend/src/npayIntentLog.ts` | 완료 |
| 수신 API | `POST /api/attribution/npay-intent` | 완료 |
| 확인 API | `GET /api/attribution/npay-intents?limit=5` | 완료, 운영은 `NPAY_INTENT_ADMIN_TOKEN` 또는 `AIBIO_NATIVE_ADMIN_TOKEN` 필요 |
| 로컬 저장소 | `npay_intent_log` | 완료, 로컬 SQLite에만 생성 |
| 중복 방지 | `intent_key` unique + 30초 lookback + `duplicate_count` | 완료. 같은 브라우저/상품/페이지/근접 시간 중복은 새 row가 아니라 기존 row 카운트 증가 |
| 원문 개인정보 방지 | IP/user-agent hash, raw payload 민감키 제외, URL query sanitize | 완료 |
| GTM `[118]` 초안 | `naver/npay-intent-beacon-gtm118.md`, GTM tag 118 | 완료, Preview용 beacon 삽입 + `ga_session_id` 정규식 보정 + quick_preview 통과 |
| GTM Preview 실제 클릭 | TJ Chrome DevTools Network, Tag Assistant | 완료, `npay-intent` POST 1건 확인. 응답은 운영 endpoint 미배포로 404 |
| 운영 VM backend 배포 | `instance-20260412-035206`, `seo-backend` | 완료. route 반영, PM2 restart, health 200 |
| 운영 POST smoke | `POST /api/attribution/npay-intent` | 완료. smoke 1건 201 확인 후 삭제, `npay_intent_log` 총 0건 |
| TJ Preview 재클릭 | 2026-04-27 14:57 KST | 저장 성공. 단 1회 클릭이 2건으로 저장되고 `ga_session_id` 공백 |
| 30초 dedupe 운영 재배포 | 2026-04-27 15:58 KST | 완료. backup 후 PM2 `seo-backend` restart, health 200 |
| GTM session_id Preview 코드 보정 | 2026-04-27 15:56 KST | 완료. Workspace 147 tag 118 fingerprint `1777272925667`, `compilerError: false` |
| TJ Preview 재검증 | 2026-04-27 16:42 KST | 통과. 최신 1건 저장, `ga_session_id=1777275745`, `ga_session_number=15` |
| intent-only live publish | 2026-04-27 18:10 KST | 완료. Workspace 150에서 version 139 publish |
| live smoke | 2026-04-27 18:16 KST | 통과. `environment=live`, `ga_session_id=1777281391`, `product_idx=423` |

### 지금 하지 않은 것

| 항목 | 이유 |
|---|---|
| Google Ads `[248]` 변경 | 입찰 신호에 영향이 있으므로 별도 승인 대상이다. |
| GA4 MP purchase 전송 | intent는 구매가 아니라 결제 시도다. |
| Meta CAPI Purchase 전송 | 주문 매칭 dry-run 이후 별도 승인으로 연다. |
| 운영 구매 전환 전송 | intent는 구매가 아니라 클릭 의도다. 실제 주문 매칭 전에는 전환 전송하지 않는다. |

### Preview 실행 순서

| 순서 | 담당 | 무엇 | 왜 | 성공 기준 |
|---:|---|---|---|---|
| 1 | Codex | 운영 배포 전 로컬 smoke를 돌린다 | endpoint와 저장소가 깨지지 않았는지 확인한다. | 201 신규 저장, 200 중복 저장 응답 |
| 2 | Codex | GTM Default Workspace(147)의 `[118]`에 초안 코드를 붙이고 quick_preview를 통과시킨다 | live publish 없이 Preview에서 실제 버튼 selector와 쿠키 추출을 본다. | 완료. fingerprint `1777264285574`, `compilerError: false` |
| 3 | TJ | GTM Preview에서 NPay 버튼을 클릭하되 실제 결제 완료 전 단계까지만 본다 | intent 수집은 결제 완료와 무관하게 되는지 확인한다. | 완료. Network에 `npay-intent` 요청 1건, `ping`, 404 |
| 4 | Codex | 운영 VM `seo-backend`에 신규 라우트를 배포한다 | 현재 404는 코드 미배포 때문에 발생한다. 이 배포가 되어야 Preview 클릭이 DB에 저장된다. | 완료. `POST /api/attribution/npay-intent` smoke 201 |
| 5 | TJ | GTM Preview에서 NPay 버튼을 다시 1회 클릭한다 | 보강된 dedupe와 `ga_session_id` 추출이 실제 브라우저에서 맞는지 확인한다. | 완료. 16:42 KST 최신 row 1건, `ga_session_id` 값 있음 |
| 6 | Codex | 최신 intent를 보호된 조회 API로 확인한다 | 실제 저장 품질을 확인해야 live publish 승인안을 낼 수 있다. | 완료. `clientId`, `gaCookieRaw`, `gaSessionId`, `gaSessionNumber`, `productIdx`, `productName`, `duplicateCount` 확인 |
| 7 | Codex | intent-only live publish 승인안을 만든다 | Preview 검증은 통과했지만 운영 태그 변경은 별도 승인 대상이다. | 완료 |
| 8 | Codex | live v139 publish와 smoke를 진행한다 | 운영 traffic에서 intent가 쌓이는지 확인한다. | 완료. live row 1건 |
| 9 | Codex | confirmed NPay 주문 매칭 dry-run을 만든다 | live intent가 쌓인 뒤 서버사이드 dispatcher 가능성을 판단한다. | matched/ambiguous/unmatched 리포트 |

### 다음 판단

| 질문 | Codex 추천 | TJ 답변 방식 |
|---|---|---|
| GTM `[118]` intent-only live는 끝났나 | YES | live version 139 |
| 24시간 수집 품질을 볼까 | YES | client/session/product fill rate 확인 |
| Option B dispatcher를 바로 열까 | 아직 NO | intent 7일치와 NPay 주문 매칭률을 본 뒤 판단 |

### 2026-04-27 13:39 KST Preview 결과

| 항목 | 관측값 | 판단 |
|---|---|---|
| Request URL | `https://att.ainativeos.net/api/attribution/npay-intent` | GTM endpoint는 맞다 |
| Method | `POST` | 의도한 방식이다 |
| Type | `ping` | `navigator.sendBeacon`으로 전송된 정상 형태다 |
| Status | `404 Not Found` | 운영 백엔드 미배포로 판단 |
| Referrer | `https://biocom.kr/` | 허용 origin 범위다 |
| Tag Assistant | `[118]` 태그 1회 실행 | 버튼 클릭 trigger는 작동했다 |

Codex가 같은 시각 확인한 운영 상태는 다음과 같다.

| 확인 | 결과 |
|---|---|
| `GET https://att.ainativeos.net/health` | 200, `seo-backend`는 살아 있음 |
| `POST https://att.ainativeos.net/api/attribution/npay-intent` with `{}` | 404, 라우트 없음 |
| `GET https://att.ainativeos.net/api/attribution/npay-intents?limit=1` | 404, 조회 라우트도 없음 |
| 로컬 `npm --prefix backend run typecheck` | 통과 |
| 로컬 `npm --prefix backend run build` | 통과 |

다음 추천은 `운영 VM backend 배포 후 Preview 재클릭`이다. 자신감은 93%다. 이유는 GTM 발화, endpoint URL, CORS origin, 운영 health가 모두 확인됐고, 404 본문이 Express fallback `Route not found`라서 네트워크나 CORS 문제가 아니라 신규 라우트 미배포 문제로 보는 것이 가장 설명력이 높기 때문이다.

### 2026-04-27 13:47 KST 운영 배포 결과

| 항목 | 결과 |
|---|---|
| 배포 대상 | VM `instance-20260412-035206`, PM2 `seo-backend`, `att.ainativeos.net` backend |
| 백업 | `/home/biocomkr_sns/seo/backups/backend-20260427-044424-npay-intent` |
| 반영 범위 | `backend/src`, `backend/dist`, `backend/package.json`, `backend/package-lock.json`, `backend/tsconfig.json` |
| 보존 범위 | 운영 `.env`, `backend/data`, `backend/logs`, `node_modules`는 배포 tar로 덮지 않음 |
| 의존성 조치 | VM `package-lock.json`이 오래되어 `npm ci` 실패. `npm install --omit=dev --no-audit --no-fund`로 운영 의존성 동기화 |
| 로컬 lockfile | `npm --prefix backend install --package-lock-only --ignore-scripts --no-audit --no-fund`로 다음 배포 반복 문제 방지 |
| PM2 | `seo-backend` restart + save 완료 |
| health | `GET https://att.ainativeos.net/health` 200 |
| CORS preflight | `OPTIONS /api/attribution/npay-intent` 204 |
| 조회 API | `GET /api/attribution/npay-intents?limit=1` 503. 404가 아니므로 route는 반영됐고, 조회 token 미설정 상태 |
| POST smoke | `POST /api/attribution/npay-intent` 201 |
| smoke cleanup | smoke row 삭제 완료. `npay_intent_log` 총 0건, smoke 0건 |

주의: 조회 API의 503은 장애가 아니다. `NPAY_INTENT_ADMIN_TOKEN` 또는 `AIBIO_NATIVE_ADMIN_TOKEN`이 운영 `.env`에 없어서 보호 정책상 조회를 막는 상태다. TJ Preview 재클릭 후 payload 확인은 우선 VM DB read-only로 진행한다.

### 2026-04-27 14:01 KST 조회 token 설정 결과

| 항목 | 결과 |
|---|---|
| 백업 | `/home/biocomkr_sns/seo/backups/env-20260427-045931-npay-intent-token` |
| 설정 | 운영 `/home/biocomkr_sns/seo/repo/backend/.env`에 `NPAY_INTENT_ADMIN_TOKEN` 추가 |
| token 원문 | Git, 문서, 채팅에 기록하지 않음. 운영 `.env`에만 보관 |
| 검증용 식별자 | 길이 43자, sha256 prefix `b950944371c2` |
| PM2 | `seo-backend` restart + save 완료 |
| health | `GET https://att.ainativeos.net/health` 200 |
| 무토큰 조회 | `GET /api/attribution/npay-intents?limit=1` 403 |
| 토큰 조회 | `GET /api/attribution/npay-intents?limit=1` + `x-admin-token` 200 |
| 현재 intent | total 0, items `[]` |

이제 TJ Preview 재클릭 후에는 Codex가 token을 붙인 조회 API로 최신 intent를 바로 확인할 수 있다.

### 2026-04-27 14:57 KST Preview 재클릭 결과

| 항목 | 결과 | 판단 |
|---|---|---|
| 요청 수 | 2건 | TJ님은 1회 클릭했다고 보고했으므로 중복 발화로 본다 |
| 수신 시각 | 14:57:16 KST, 14:57:20 KST | 4.0초 간격 |
| 상태 | 둘 다 201 | 운영 route와 DB 저장은 정상 |
| environment | `preview` | live publish 전 검증 상태 |
| page | `https://biocom.kr/DietMealBox/?idx=423` | URL sanitize 정상 |
| product | `423`, `팀키토 저포드맵 도시락 7종 골라담기`, 8,900원 | 상품 추출 정상 |
| client_id | `395345677.1775926422` | `_ga` prefix 제거 정상 |
| ga_cookie_raw | `GA1.1.395345677.1775926422` | 원본 `_ga` 보관 정상 |
| ga_session_id | 빈 값 | 보강 필요 |
| ga_session_number | `14` | measurement cookie 일부는 읽고 있음 |
| fbp | 값 있음 | Meta 보조키 일부 확보 |
| gclid/gbraid/wbraid/UTM | 빈 값 | 직접 방문 또는 저장 위치 미확인 |
| member_code | 빈 값 | 로그인/회원 식별 미확인. 실패는 아님 |

결론: endpoint와 저장은 성공했지만 live publish 조건은 아직 충족하지 않았다. 이유는 두 가지다.

1. 같은 버튼 클릭이 4초 간격 2건으로 저장됐다. 기존 10초 bucket dedupe는 10초 경계를 넘으면 중복을 못 잡는다.
2. GA4 세션 번호는 잡혔지만 `ga_session_id`가 비어 있다. `GS2.1.s...$o...` 쿠키 포맷에서 `.` 뒤의 `s`를 허용하도록 GTM 초안을 보정해야 한다.

Codex 권장 조치:

| 조치 | 담당 | 상태 |
|---|---|---|
| 서버 dedupe를 30초 lookback으로 보강 | Codex | 로컬 수정 + 임시 DB 검증 통과 |
| GTM `getGaSessionId()` 정규식을 `(?:^|[.$])s(\\d+)`로 보강 | Codex | 문서 수정, GTM Workspace 반영 필요 |
| 보강 후 Preview 1회 재검증 | TJ + Codex | 대기 |
| live publish 판단 | TJ | 아직 NO |

로컬 검증:

| 검증 | 결과 |
|---|---|
| `npm --prefix backend run typecheck` | 통과 |
| `npm --prefix backend run build` | 통과 |
| 임시 SQLite dedupe 재현 | 14:57:16, 14:57:20 동일 payload 2회 입력 시 1건 저장 + `duplicate_count=1` |

### 2026-04-27 16:00 KST 보강 반영 결과

| 항목 | 결과 |
|---|---|
| 백엔드 dedupe key | `site`, `source`, `ga_session_id`, `page_location`, `product_idx`, `product_name`, `user_agent_hash`, `ip_hash`, `captured_at ±30초`, 그리고 `client_id` 또는 `ga_cookie_raw` fallback |
| `ga_session_id` 공백 fallback | 가능. `client_id` 또는 `_ga` 원본이 있으면 같은 브라우저/상품/페이지 중복을 흡수한다 |
| 중복 처리 방식 | 두 번째 요청은 새 row를 만들지 않고 기존 row의 `duplicate_count`만 증가 |
| 로컬 재현 테스트 | 첫 요청 201, 두 번째 요청 200 `deduped: true`, row 1건, `duplicate_count=1` |
| 분리 검증 | 다른 상품 또는 다른 `client_id`는 별도 row로 저장 |
| 운영 배포 | `/home/biocomkr_sns/seo/backups/backend-20260427-065715-npay-dedupe-sessionid` 백업 후 PM2 `seo-backend` restart |
| 운영 health | 2026-04-27 16:00 KST `GET https://att.ainativeos.net/health` 200 |
| GTM session_id 보정 | Workspace 147 tag 118 Preview 코드에 `/(?:^|[.$])s(\\d+)/` 반영 |
| GTM quick_preview | `compilerError: false`, fingerprint `1777272925667` |
| live publish | 안 함 |
| purchase 전송 | 추가 없음 |

다음 성공 기준은 명확하다. 같은 상품에서 NPay Preview 클릭 1회 후, 서버에 남는 최종 intent가 1건이어야 한다. 브라우저 구조상 두 번 호출되더라도 두 번째는 200 `deduped: true`로 처리되어야 한다. 그리고 `ga_session_id`가 빈 값이면 안 된다.

### 2026-04-27 16:42 KST Preview 재검증 결과

| 항목 | 결과 | 판단 |
|---|---|---|
| captured_at | 2026-04-27 16:42:34 KST | TJ 클릭 시각과 일치 |
| 저장 row | 최신 1건 | 통과 |
| environment | `preview` | 의도한 상태 |
| duplicate_count | 0 | 이번에는 중복 호출 없음 |
| client_id | `395345677.1775926422` | 정상 |
| ga_cookie_raw | `GA1.1.395345677.1775926422` | 정상 |
| ga_session_id | `1777275745` | 정상. 14:57 KST 공백 문제 해결 |
| ga_session_number | `15` | 정상 |
| fbp | 값 있음 | Meta 보조키 확보 |
| product_idx | `423` | 정상 |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` | 정상 |
| product_price | 8,900원 | 정상 |
| page_location | `https://biocom.kr/DietMealBox/?idx=423` | 정상 |
| page_referrer | `https://biocom.kr/supplements` | 정상 |
| member_code | 빈 값 | 로그인/회원 식별은 아직 미확인. 실패 조건은 아님 |
| match_status | `pending` | 주문 매칭 전 상태로 정상 |

네이버페이에서 `단체회원은 이용 불가합니다` 안내가 떴지만 이 검증에는 큰 문제가 아니다. 이 Sprint의 목표는 결제 성공이 아니라 버튼 클릭 시점의 intent와 GA 세션 정보를 저장하는 것이다. 결제 완료와 주문 매칭은 다음 Sprint에서 별도로 본다.

판정: Preview 성공. 다음 단계는 `intent-only live publish` 승인안 작성이다. purchase 전송은 여전히 하지 않는다.

### 2026-04-27 18:10 KST Live Publish 결과

| 항목 | 결과 |
|---|---|
| publish 방식 | Default Workspace 147을 publish하지 않고, live v138 기준 새 Workspace 150 생성 |
| 이유 | Workspace 147이 stale 상태라 [43]/[48]/[143] rollback 위험이 있었음 |
| publish workspace | `accounts/4703003246/containers/13158774/workspaces/150` |
| created version | `139`, `npay_intent_only_live_20260427` |
| live version | `139`, `npay_intent_only_live_20260427` |
| tag 43 | `add_payment_info` 유지 |
| tag 48 | paused 유지 |
| tag 118 | intent beacon live 반영 |
| quick_preview | `compilerError: false`, tagCount 57 |
| purchase 코드 | tag 118 beacon block 안에 GA4 purchase, Meta Purchase, Google Ads conversion call 없음 |

### 2026-04-27 18:16 KST Live Smoke 결과

| 항목 | 결과 | 판단 |
|---|---|---|
| 클릭 대상 | `.npay_btn_pay`, `네이버페이 구매하기` | 정상 |
| captured_at | 2026-04-27 18:16:44 KST | 정상 |
| environment | `live` | 정상 |
| duplicate_count | 0 | 정상 |
| client_id | `1759636711.1777281392` | 정상 |
| ga_session_id | `1777281391` | 정상 |
| ga_session_number | `1` | 정상 |
| product_idx | `423` | 정상 |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` | 정상 |
| product_price | 8,900원 | 정상 |
| page_location | `https://biocom.kr/DietMealBox/?idx=423` | 정상 |
| match_status | `pending` | 정상 |
| GA4 purchase | 관측 없음 | 정상 |
| Meta Purchase | 관측 없음 | 정상 |
| Google Ads | 기존 page_view/config 계열 호출만 관측 | 구매 전환 변경 없음 |

다음은 24시간 수집 품질 확인이다. 기준은 `client_id` 90% 이상, `ga_session_id` 80-90% 이상, `product_idx` 80-90% 이상, 과도한 중복 row 없음이다. 7일치가 쌓이면 NPay 주문 원장과 매칭 dry-run을 진행한다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Sprint7

**이름**: live 수집 품질 점검

품질 점검 시각: 2026-04-30 11:50 KST

상세 보고서: [[npay-intent-quality-20260430|NPay Intent 수집 품질 점검]]

### 결론

NPay intent-only live 수집은 유지한다. rollback 조건에 걸리지 않았다.

live publish 이후 251건이 들어왔고, 최근 24시간에도 92건이 들어왔다. 최근 24시간 기준 `client_id`, `ga_session_id`, `product_idx`, `product_name`은 모두 100% 채워졌다.

다만 purchase dispatcher는 아직 열지 않는다. 지금 확인한 것은 `클릭 intent가 품질 좋게 쌓이는가`이고, 아직 `실제 NPay 주문과 얼마나 정확히 붙는가`를 검증하지 않았기 때문이다.

### 기준 대비 결과

| 기준 | 목표 | live 이후 결과 | 최근 24시간 결과 | 판정 |
|---|---:|---:|---:|---|
| client_id 채움률 | 90% 이상 | 249/251, 99.2% | 92/92, 100% | 통과 |
| ga_session_id 채움률 | 80~90% 이상 | 248/251, 98.8% | 92/92, 100% | 통과 |
| product_idx 채움률 | 80~90% 이상 | 251/251, 100% | 92/92, 100% | 통과 |
| product_name 채움률 | 80~90% 이상 | 251/251, 100% | 92/92, 100% | 통과 |
| server purchase dispatch | 0건 | 0건 | 0건 | 정상 |

### 수집량

| 구간 | live row | duplicate_count 합계 | ga_session_id row | product_idx row |
|---|---:|---:|---:|---:|
| 2026-04-27 18:10 이후 전체 | 251 | 32 | 248 | 251 |
| 최초 24시간 | 111 | 22 | 108 | 111 |
| 최근 24시간 | 92 | 4 | 92 | 92 |

`duplicate_count`는 실패가 아니다. 같은 버튼 클릭성 호출이 서버 dedupe에 흡수된 횟수다. 최신 24시간은 4건으로 줄어 과도한 중복으로 보지 않는다.

### 남은 한계

| 한계 | 의미 | 다음 조치 |
|---|---|---|
| `member_code` 0건 | 회원 단위 매칭은 아직 약하다 | v1 dry-run은 client/session/product/time 중심으로 진행 |
| 같은 `product_idx`에 상품명 2개 | 긴 SEO 상품명과 짧은 상품명이 섞인다 | 주문 매칭은 `product_idx`를 1순위로 사용 |
| `match_status=pending` 254건 | 아직 주문 매칭을 열지 않았다 | 7일치가 쌓이면 dry-run |

### 다음 판단

| 질문 | Codex 추천 | 이유 |
|---|---|---|
| NPay intent-only live를 유지할까 | YES | 수집량과 필드 품질이 기준을 넘었다 |
| 지금 rollback할까 | NO | GTM 오류, purchase 오염, 결제 흐름 방해 징후가 없다 |
| 지금 purchase dispatcher를 열까 | NO | 실제 주문 매칭률을 아직 보지 않았다 |
| 다음은 무엇인가 | 7일 매칭 dry-run | 2026-05-04 18:10 KST 이후 matched/ambiguous/unmatched를 계산 |

### 기준 정보

- Source: VM SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`, table `npay_intent_log`
- Cross-check: 보호된 `GET /api/attribution/npay-intents?limit=1`, GTM API read-only live version 조회
- Window: 2026-04-27 18:10 KST ~ 2026-04-30 11:50 KST
- Freshness: 최신 intent `2026-04-30 11:27:10 KST`, 조회 시각 대비 약 23분 전
- Confidence: 88%

▲ [[#Phase-Sprint 요약표|요약표로]]

## 데이터 처리 기준

1. 취소, 환불, 미입금, 결제 준비 상태는 제외했다.
2. 주문 매출은 `order_number` 기준으로 묶고 `max(final_order_amount)`를 사용했다.
3. 상품별 매출은 주문금액을 상품 수로 균등 배분했다.
4. NPay 판별은 `payment_method`가 `NAVERPAY_ORDER`, `npay`, `naver`, `네이버` 계열인지를 기준으로 했다.
5. 이 문서의 숫자는 운영 DB read-only 조회 결과다. 프로덕션 데이터 쓰기나 스키마 변경은 하지 않았다.
