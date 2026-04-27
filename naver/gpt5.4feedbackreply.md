# GPT-5.4 NPay 피드백 검토 결과보고서

작성 시각: 2026-04-27 01:44 KST  
기준일: 2026-04-27  
검토 대상: [[gpt5.4feedback|naver/gpt5.4feedback.md]]  
연결 문서: [[!npay|naver/!npay.md]], [[npayfeedback|naver/npayfeedback.md]], [[npayfeedbackreply|naver/npayfeedbackreply.md]], [[!gdnplan|gdn/!gdnplan.md]]  
Primary source: 로컬 문서와 코드 검색 결과  
Data source: `operational_postgres.public.tb_iamweb_users` 2026-04-01 ~ 2026-04-25, `backend/src/routes/npay.ts` API 결과  
Freshness: NPay 매출 데이터 최신 결제일 2026-04-25, 문서 검토 시각 2026-04-27 01:34 KST  
Confidence: 78%

## 10초 요약

`gpt5.4feedback.md`의 핵심 방향에는 동의한다. 네이버페이 버튼 클릭은 구매가 아니라 `결제 시도`로 보고, 실제 결제 완료 주문과 매칭해서 서버에서 구매 전환을 복구해야 한다. 이미 진행된 것은 NPay 매출 영향 분석, 리턴 URL 난이도 검토, Google Ads NPay 전환 오염 확인, `/npay` 분석 화면 구축이다. 아직 안 된 것은 `npay_intent` 수집, intent 저장소, 주문 매칭, GA4/Meta/Google Ads 서버 전송, Google Ads 전환 액션 변경이다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| NPay | [[#NPay-Reply1]] | 진행된 내용 | Codex | 100% / 0% | [[#NPay-Reply1\|이동]] |
| NPay | [[#NPay-Reply2]] | 진행 안 된 내용 | Codex + TJ | 40% / 0% | [[#NPay-Reply2\|이동]] |
| NPay | [[#NPay-Reply3]] | 동의하는 내용 | Codex | 100% / 0% | [[#NPay-Reply3\|이동]] |
| NPay | [[#NPay-Reply4]] | 수정 또는 비동의 내용 | Codex | 100% / 0% | [[#NPay-Reply4\|이동]] |
| NPay | [[#NPay-Reply5]] | 추천 실행안 | TJ + Codex + Claude Code | 60% / 0% | [[#NPay-Reply5\|이동]] |

## 문서 목적

이 문서는 `gpt5.4feedback.md`의 제안 중 이미 진행된 것, 아직 진행되지 않은 것, 그대로 동의하는 것, 수정해야 하는 것을 한 장으로 정리한다.

## 이 작업이 하는 일

네이버페이 주문형 버튼 문제를 `매출 리스크`, `리턴 URL`, `광고 전환 오염`, `서버 사이드 복구` 네 가지로 나누어 본다. 그 다음 다음 실행 순서를 정한다.

## 왜 필요한가

네이버페이 주문형은 고객이 결제 후 biocom 결제완료 페이지로 돌아오지 않을 수 있다. 이 때문에 GA4/Meta/Google Ads의 브라우저 구매 태그가 빠지거나, 반대로 버튼 클릭이 구매처럼 잡히는 문제가 생긴다. 이 문제를 방치하면 ROAS가 실제 입금 장부와 달라진다.

## NPay-Reply1

**이름**: 진행된 내용

### 1. NPay 매출 영향 분석은 진행 완료

`/api/npay/order-type-impact`와 `/npay` 화면을 만들었다. AI CRM 허브 `http://localhost:7010/#ai-crm`에도 `네이버페이 주문형 분석` 카드가 연결됐다.

핵심 숫자는 다음과 같다.

| 항목 | 값 | 기준 |
|---|---:|---|
| 전체 주문 | 1,733건 | 2026-04-01 ~ 2026-04-25 |
| 전체 매출 | 385,465,559원 | 취소/환불/미입금 제외 |
| NPay 주문형 주문 | 107건 | 전체 주문의 6.17% |
| NPay 주문형 매출 | 17,905,200원 | 전체 매출의 4.65% |
| 월말 NPay 매출 추정 | 21,486,240원 | 25일 관측치를 30일로 단순 보정 |
| 기준 손실 추정 | 2,578,349원/월 | NPay 매출의 12% 이탈 가정 |

이 분석은 [[!npay|naver/!npay.md]]에 반영됐다.

### 2. 리턴 URL 직접 구현 난이도 검토는 진행 완료

아임웹 관리자에 별도 리턴 URL 설정이 없다면, 주문형 네이버페이의 `returnUrl`만 우리가 직접 바꾸는 것은 어렵다고 판단했다. 결제 요청을 만드는 주체가 우리 프론트엔드가 아니라 아임웹/네이버페이 연동부이기 때문이다.

반대로 리턴 URL 없이 서버 사이드 보정으로 전환을 복구하는 것은 가능하다. 난이도는 중간이고, 기존 `attribution_ledger`, GA4 Measurement Protocol, 아임웹 주문 원장 polling을 재사용하면 된다.

### 3. Google Ads 전환 오염 확인은 진행 완료

Google Ads API로 전환 액션별 성과를 분리했다. Primary `구매완료` action `7130249515`의 label `r0vuCKvy-8caEJixj5EB`가 아임웹 자동 NPay count 경로와 일치한다. 이 액션 하나가 Google `Conv. value` 129,954,631원을 만든 것으로 확인됐다.

즉 원문의 `버튼 클릭을 구매로 보면 안 된다`는 방향은 실제 Google Ads 데이터에서도 맞다.

### 4. 서버 사이드 복구에 쓸 기존 부품 확인은 진행 완료

다음 부품은 이미 존재한다.

| 부품 | 위치 | 판단 |
|---|---|---|
| 일반 결제 완료 수신점 | `POST /api/attribution/payment-success` | 존재 |
| GA4 Measurement Protocol refund 전송 패턴 | `backend/src/services/refundDispatcher.ts` | 재사용 가능 |
| GA4 MP secret 환경변수 | `GA4_MP_API_SECRET_BIOCOM` | 존재 |
| NPay 주문 판별 로직 | `backend/src/routes/npay.ts` | 존재 |
| NPay 매출 대시보드 | `frontend/src/app/npay/page.tsx` | 존재 |

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Reply2

**이름**: 진행 안 된 내용

### 아직 실제 구현되지 않은 것

| 항목 | 원문 제안 | 현재 상태 | 다음 주체 |
|---|---|---|---|
| NPay 클릭 intent endpoint | `/api/attribution/npay-intent` | 미구현 | Codex |
| intent 저장소 | `npay_intent_log` | 미구현 | Codex |
| GTM `[118]` sendBeacon | 클릭 시 cid/session_id 전송 | 미구현, publish 안 됨 | TJ + Claude Code |
| intent와 주문 매칭 | member/time/product 기반 매칭 | 미구현 | Codex |
| GA4 MP purchase dispatcher | 서버에서 purchase 전송 | 미구현 | Codex |
| Meta CAPI Purchase 확장 | 서버에서 Meta purchase 전송 | 미구현 | Codex |
| Google Ads confirmed conversion | 실제 구매 기반 업로드 또는 새 전환 | 미구현 | Codex + TJ |
| Google Ads NPay purchase 오염 제거 | 기존 primary/secondary 정리 | 미적용 | TJ 승인 필요 |
| NPay 실결제 테스트 | 버튼 클릭부터 주문 원장까지 확인 | 미진행 | TJ |

### 현재 가장 큰 미완료 지점

가장 큰 미완료 지점은 `클릭 시점 식별값 저장`이다. 이게 없으면 네이버페이 결제 완료 주문이 나중에 들어와도 어떤 세션, 어떤 광고 클릭, 어떤 UTM에서 출발했는지 복원하기 어렵다.

두 번째 미완료 지점은 Google Ads 설정 변경이다. 현재 Primary `구매완료`가 NPay count label로 확인됐지만, 운영 계정의 primary/secondary 변경은 입찰 신호 변경이므로 TJ 승인 없이는 적용하지 않는다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Reply3

**이름**: 동의하는 내용

### 1. 네이버페이 버튼 클릭은 구매가 아니라 결제 시도다

동의한다. 버튼 클릭은 결제 완료가 아니다. 클릭한 고객이 네이버페이 화면에서 이탈할 수도 있고, 결제를 실패할 수도 있고, 주문을 취소할 수도 있다. 따라서 버튼 클릭을 `purchase`로 보내면 전환값이 부풀 수 있다.

정의는 다음처럼 고정해야 한다.

| 이벤트 | 의미 | 구매 전환 여부 |
|---|---|---|
| `npay_click` 또는 `npay_intent` | 네이버페이 결제 시도 | 아님 |
| `purchase_confirmed` | 운영 주문 원장에서 결제 완료 확인 | 맞음 |

### 2. Option A를 먼저 확인하되 Option B를 준비한다

동의한다. 아임웹 또는 네이버페이 파트너센터에서 결제 완료 후 biocom 결제완료 페이지로 돌아오는 설정을 찾으면 가장 깔끔하다. 하지만 현재 공개 문서와 관리자 화면 기준으로는 주문형 리턴 URL을 상점 관리자가 직접 지정하는 기능을 확인하지 못했다.

그래서 Option A 확인을 기다리면서 `npay_intent` 수집 설계를 병행해야 한다.

### 3. `client_id`와 `session_id` 저장은 핵심이다

동의한다. GA4 Measurement Protocol로 purchase를 서버에서 보내도, 실제 브라우저 세션의 `client_id`와 `session_id`가 없으면 Direct 또는 별도 세션으로 잡힐 위험이 커진다.

추가로 Google Ads까지 고려하면 `gclid`, `gbraid`, `wbraid`도 같이 저장해야 한다.

### 4. webhook이 없으면 polling으로 대체하는 방향은 맞다

동의한다. 네이버페이 webhook을 직접 받을 수 없으면 아임웹 주문 API, 운영 DB `tb_iamweb_users`, 로컬 sync 원장을 polling해서 confirmed 주문을 찾아야 한다.

단, NPay 주문형은 Toss 원장에 항상 같은 방식으로 잡힌다고 단정하면 안 된다. primary는 아임웹/운영 주문 원장이고, Toss는 cross-check로 보는 게 안전하다.

### 5. Google Ads NPay 구매 태그는 정리해야 한다

동의한다. 다만 원문이 말한 `[248]`만 보면 부족하다. 더 큰 문제는 Google Ads 계정의 Primary `구매완료` action `7130249515`가 아임웹 자동 NPay count label과 연결되어 있다는 점이다.

따라서 정리 대상은 두 층이다.

1. GTM의 NPay 클릭 구매 태그
2. Google Ads 계정의 Primary purchase action

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Reply4

**이름**: 수정 또는 비동의 내용

### 1. `3~4일 작업`은 범위를 나눠야 한다

부분 동의다. `npay_intent` endpoint, 저장소, GTM beacon, 아임웹 주문 polling 매칭 dry-run까지는 3~4일이 가능하다.

하지만 GA4 purchase, Meta CAPI Purchase, Google Ads offline conversion, 중복 방지, 테스트, 운영 모니터링까지 모두 포함하면 3~4일은 빡빡하다. 운영 적용 기준으로는 5~7일, Google Ads offline conversion까지 안정화하면 7~10일로 보는 게 더 안전하다.

### 2. Meta CAPI는 GA4 client_id만으로 충분하지 않다

수정 필요하다. Meta CAPI Purchase까지 같이 복구하려면 GA4 `client_id`와 `session_id`만으로는 부족하다. 최소한 `_fbp`, `_fbc`, `fbclid`, user agent, IP 처리 정책, 이메일/전화번호 해시 가능 여부를 같이 봐야 한다.

따라서 NPay intent payload에는 GA4 값뿐 아니라 Meta와 Google Ads 값도 함께 들어가야 한다.

### 3. GA4 MP purchase가 Google Ads ROAS를 바로 고치지는 않는다

수정 필요하다. GA4에 purchase를 복구하면 GA4 리포트는 좋아진다. 하지만 Google Ads ROAS는 현재 Primary 전환 액션 오염과 별도로 연결되어 있다.

Google Ads를 고치려면 다음 중 하나가 필요하다.

1. confirmed purchase 기반 새 Google Ads 전환 태그
2. GA4 purchase import를 새 전환으로 쓰는 방식
3. `gclid/gbraid/wbraid` 기반 offline conversion upload
4. 기존 NPay count action을 Primary에서 제외

### 4. NPay intent 저장소는 별도 테이블만 답은 아니다

부분 동의다. `npay_intent_log`를 만드는 방식이 가장 명확하다. 하지만 existing `attribution_ledger`에 `sync_source=npay_intent` 또는 별도 event type으로 저장하는 방식도 가능하다.

다만 운영 안정성은 별도 테이블이 낫다. 클릭 intent는 결제 완료와 성격이 다르기 때문이다.

### 5. “30분 안쪽이면 attribution 유지”는 단정하면 안 된다

수정 필요하다. GA4 세션 timeout 기본값은 30분이지만, Measurement Protocol 이벤트가 항상 원래 세션에 붙는다고 단정하면 안 된다. 실제로는 `session_id`, 이벤트 시간, 수집 지연, GA4 처리 정책이 함께 작동한다.

문서에서는 `30분 내 전송이면 유리하다` 정도로 표현하는 게 맞다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## NPay-Reply5

**이름**: 추천 실행안

### YES/NO 판단

| 질문 | 답 | 자신감 |
|---|---|---:|
| NPay 버튼 클릭을 purchase로 계속 써도 되는가 | NO | 95% |
| `npay_intent` 수집을 설계해야 하는가 | YES | 92% |
| 바로 GTM live publish를 해도 되는가 | NO | 88% |
| Preview에서 beacon 호출만 먼저 검증해야 하는가 | YES | 90% |
| Google Ads Primary `구매완료`를 그대로 ROAS 기준으로 써도 되는가 | NO | 96% |
| 주문형 전체 제거를 지금 바로 해도 되는가 | NO | 78% |

### 추천 순서

1. Codex가 `npay_intent` 저장 설계를 작성한다. 정본은 [[!npay#NPay-Sprint5|naver/!npay.md NPay-Sprint5]]에 둔다.
2. 기본 역할상 Claude Code가 GTM `[118]` sendBeacon 초안을 맡는다.
3. 단, 이번 건은 Codex 5.5가 endpoint 계약과 저장 설계를 함께 잡았으므로 Codex 5.5가 GTM 초안까지 먼저 작성해도 된다.
4. TJ가 GTM Preview에서 NPay 버튼 클릭 시 beacon이 호출되는지만 확인한다.
5. Codex가 live publish 전 dry-run endpoint와 저장소를 붙인다.
6. Codex가 최근 NPay 주문과 intent 매칭률을 7일치로 계산한다.
7. 매칭률이 70% 이상이면 GA4 MP purchase dry-run으로 간다.
8. Google Ads는 GA4 복구와 별도로 confirmed conversion 경로를 설계한다.
9. TJ 승인 후 기존 NPay count purchase action을 Primary에서 내린다.

### 승인 요청

**추천안**: `npay_intent` 수집 endpoint와 저장소 설계를 먼저 진행한다.  
**대안 A**: 아임웹/네이버페이 return URL 답변을 기다린다. 속도는 느리지만 운영 변경은 적다.  
**대안 B**: 결제형 전환을 먼저 시도한다. 추적은 좋아질 수 있지만 건강식품/영양제 매출 손실 위험이 있다.  
**Codex 추천**: 추천안 승인.  
**자신감**: 86%.

### 왜 GTM `[118]` sendBeacon 초안은 Claude Code 담당인가

Codex가 못 해서가 아니다. 역할 경계 때문이다.

Codex는 서버, DB, 주문 매칭, 전환 전송처럼 데이터 정합성에 직접 영향을 주는 부분을 맡는다. GTM `[118]` sendBeacon은 브라우저에서 NPay 버튼 클릭을 감지하고, 쿠키와 URL 파라미터를 읽고, Preview에서 selector가 깨지지 않는지 확인하는 프론트/GTM 작업이다.

그래서 Claude Code가 초안을 맡고, Codex는 endpoint 계약과 저장 필드 기준을 제공한다. `npay_intent` 저장 설계 정본은 [[!npay#NPay-Sprint5|naver/!npay.md NPay-Sprint5]]에만 둔다. GTM live publish는 TJ 승인 전에는 하지 않는다.

### Codex 5.5가 GTM 작업까지 진행하는 안

검토 결론은 `가능하다`이다. 이번 작업은 GTM 코드만 따로 만드는 일이 아니다. 서버 수신점, 저장 필드, 중복 방지, purchase 전송 금지 조건이 모두 맞아야 한다.

그래서 Codex 5.5가 GTM `[118]` sendBeacon 초안까지 먼저 작성하면 endpoint 설계와 payload가 어긋날 가능성이 줄어든다. 다만 Codex 5.5가 맡는 범위는 초안 코드와 Preview 체크리스트까지다. live publish와 실결제 테스트는 TJ 승인 대상이다.

추천은 `Codex 5.5가 먼저 작성하고, 운영 반영 전 TJ Preview 확인 또는 Claude Code selector 리뷰를 거치는 방식`이다. 자신감은 84%다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## 역할 구분

| 주체 | 할 일 |
|---|---|
| TJ | GTM Preview/Publish 승인, Google Ads 전환 액션 변경 승인, 실결제 테스트 승인 |
| Codex | endpoint, 저장소, 매칭 dry-run, GA4/Google Ads 서버 전환 설계, 필요 시 GTM `[118]` 초안 작성 |
| Claude Code | GTM selector/모바일 Preview 리뷰, 프론트 문구, 대시보드 표시 |

## 산출물

| 산출물 | 상태 | 위치 |
|---|---|---|
| NPay 매출 영향 분석 화면 | 완료 | `http://localhost:7010/npay` |
| NPay 매출 영향 API | 완료 | `GET /api/npay/order-type-impact` |
| NPay 운영 판단 문서 | 완료 | [[!npay|naver/!npay.md]] |
| GPT-5.4 피드백 답변서 | 완료 | [[gpt5.4feedbackreply|naver/gpt5.4feedbackreply.md]] |
| NPay intent capture 설계 | 완료, 운영 미구현 | [[!npay#NPay-Sprint5\|정본]] |
| Google Ads confirmed conversion 설계 | 미완료 | 다음 작업 |

## 변경 이력

| 시각 | 내용 |
|---|---|
| 2026-04-27 01:34 KST | `gpt5.4feedback.md` 검토 결과를 진행/미진행/동의/수정 항목으로 분리해 결과보고서 작성 |
| 2026-04-27 01:40 KST | `npay_intent` 저장 설계 정본 위치와 GTM `[118]` Claude Code 담당 사유 추가 |
| 2026-04-27 01:44 KST | Codex 5.5가 GTM `[118]` 초안까지 진행하는 안의 장단점과 추천 의견 추가 |
