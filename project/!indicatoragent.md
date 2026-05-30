# Leading Indicator Agent Plan

작성 시각: 2026-05-17 15:45 KST
최근 업데이트: 2026-05-27 09:35 KST
기준일: 2026-05-27
문서 성격: 구매 전 선행지표 발굴 에이전트 설계 문서
대상 사이트: 바이오컴 우선, 더클린커피 확장 가능
Lane: Green documentation / read-only design / local dry-run
Mode: No-send / No-write / No-publish / No-deploy

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/!capiplan.md
    - data/!channelfunnel.md
    - project/roas.md
    - GA4/gtm.md
  lane: Green documentation and design
  allowed_actions:
    - leading indicator agent 설계
    - read-only source inventory
    - local read-only dry-run script
    - Meta standard event 조사
    - VM Cloud/GA4/GTM 데이터 연결 설계
    - no-send route proposal
  forbidden_actions:
    - Meta CAPI 운영 send
    - GA4 Measurement Protocol send
    - Google Ads conversion upload
    - TikTok/Naver send/upload
    - GTM Production publish
    - VM Cloud deploy/restart
    - 운영DB write/import
    - raw personal/order/payment/ad-click/customer identifier output
  source_window_freshness_confidence:
    source: "local docs + VM Cloud leading-indicators live aggregate endpoint + GA4 BigQuery dry-run docs + GTM export docs + TJ님 제공 KPI 설계 이미지 텍스트"
    window: "latest live refresh 기준 7d/30d, API 기준 시각 2026-05-27 09:03~09:21 KST; KPI 원칙 참고 자료 기준 2026-05-26"
    freshness: "문서 업데이트 2026-05-27 09:35 KST, VM Cloud leading-indicators live refresh 2026-05-27 09:03~09:21 KST"
    confidence: 0.90
```

## 10초 요약

이 문서의 결론은 **구매 전 선행지표를 찾는 전담 에이전트를 만드는 것이 맞다**는 것이다.
이 에이전트는 매출 같은 후행 지표를 직접 맞히는 도구가 아니라, 매출 직전에 반복적으로 나타나는 행동 패턴을 찾아 “오늘 바로 바꿀 수 있는 숫자”로 바꾸는 도구다.
첫 후보는 `Meta 유입 구매자 vs 이탈자 체류시간`, `스크롤 깊이`, `장바구니/결제 시작`, `결제수단 선택`, `회원가입 완료`, `YouTube/오가닉 유입의 행동 차이`다.
다만 체류시간과 스크롤은 Meta 표준 구매 이벤트가 아니므로, 처음에는 VM Cloud 내부 선행지표로 분석하고 Meta CAPI 운영 전송은 별도 승인 전까지 하지 않는다.

현재 P0/P1에서는 Codex가 read-only dry-run으로 source matrix, GA4 dwell/scroll, GA4↔VM Cloud safe bridge, live aggregate API까지 만들었다.
2026-05-24 최신 live refresh 기준으로 바이오컴 Meta 7일 세션은 422건이고, 그중 실제 결제완료는 204건, 결제 시작 후 구매로 닫히지 않은 세션은 213건, GA4와 내부 결제 판단 충돌은 0건이다.
구매자는 상세페이지에 머문 시간 중앙값이 49.0초, 결제 시작 후 멈춘 사람은 29.5초다.
90% 이상 스크롤 비율도 전체 방문 기준으로 구매자 50.0%, 결제 시작 후 멈춘 사람 26.8%로 차이가 유지된다.
다만 최신 API 응답은 `live_cache_miss`였으므로, precompute cache가 항상 hit 되는지는 별도 점검이 필요하다.

이번 업데이트에서 로컬 backend는 선행지표 후보를 Top 5로 점수화하는 로직을 추가했다.
점수는 “구매자와 비결제자 차이”, “모수 크기”, “수집 범위”, “사람이 실제로 개선할 수 있는 정도”, “추적 오염 리스크”를 합산한다.
쉽게 말하면 숫자가 좋아 보여도 표본이 작거나 수집이 불안정하면 낮은 점수를 주고, 실제 랜딩/콘텐츠/버튼/리뷰 위치 개선으로 바로 이어질 수 있는 지표를 위로 올린다.

2026-05-26 업데이트: KPI 운영 기준은 [KPI 설계 7가지 교훈과 선행지표 에이전트 적용 원칙](kpi-design-seven-lessons-20260526.md)을 정본 참고 자료로 둔다.
이 기준에 따라 선행지표 에이전트는 숫자만 보여주지 않고, 각 지표가 어떤 행동을 유도해야 하는지까지 설명해야 한다.
특히 모든 후보 지표는 레버지표(지금 당장 바꿀 1~2개 숫자)와 관리지표(이상이 생겼을 때 점검할 숫자)로 나누고, 지표 카드에는 공략집(무엇을 어떻게 왜 바꿀지)이 붙어야 한다.

2026-05-26 23:25 업데이트: 로컬 프론트 `/ai-crm/leading-indicators`는 KPI 원칙을 반영해 OKR 패널, 액션플랜 3개, 레버/관리/진단 역할 배지, 후보별 공략집(무엇을/어떻게/왜/성공 기준)을 표시한다.
이제 선행지표 후보 카드는 단순 순위표가 아니라 “사람이 내일 무엇을 바꿔야 하는지”를 알려주는 운영 카드에 가깝게 바뀌었다.

2026-05-27 업데이트: TJ님이 지적한 “비결제자의 주문서 진입률 92.8%”는 live API에 실제로 존재하는 값이다.
다만 이것은 넓은 의미의 전체 비결제 방문자가 아니라, 현재 `checkout_non_buyer` cohort, 즉 “결제 시작 후 구매 완료로 닫히지 않은 사람”에 가까운 분모다.
따라서 화면 문구는 `비결제자`만 쓰지 말고 `결제 시작 후 멈춤` 또는 `비결제 cohort`라고 풀어 써야 한다.
전체 방문자 기준 주문서 진입률과 결제 흐름 근처 cohort의 주문서 진입률은 반드시 분리 표시한다.

P0 산출물:

- `backend/scripts/leading-indicator-p0-dry-run.ts`
- `data/project/leading-indicator-p0-dry-run-20260517.json`
- `project/leading-indicator-p0-dry-run-20260517.md`
- `backend/scripts/ga4-dwell-scroll-join-dry-run.ts`
- `data/project/ga4-dwell-scroll-join-dry-run-20260517.json`
- `project/ga4-dwell-scroll-join-dry-run-20260517.md`
- `backend/scripts/ga4-vm-join-key-and-coffee-gap-dry-run.ts`
- `data/project/ga4-vm-join-key-and-coffee-gap-20260517.json`
- `project/ga4-vm-join-key-and-coffee-gap-20260517.md`
- `backend/scripts/ga4-vm-row-level-safe-bridge-dry-run.ts`
- `data/project/ga4-vm-row-level-safe-bridge-dry-run-20260517.json`
- `project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md`
- `data/project/coffee-ga4-middle-event-enhancement-design-20260517.json`
- `project/coffee-ga4-middle-event-enhancement-design-20260517.md`
- `data/project/coffee-channel-cohort-truth-table-20260517.json`
- `project/coffee-channel-cohort-truth-table-20260517.md`
- `data/project/biocom-key-capture-and-raw-id-plan-b-approval-20260517.json`
- `project/biocom-key-capture-and-raw-id-plan-b-approval-20260517.md`
- `data/project/coffee-ga4-middle-event-gtm-preview-approval-20260517.json`
- `project/coffee-ga4-middle-event-gtm-preview-approval-20260517.md`

2026-05-17 추가 결론:

- 더클린커피는 VM Cloud와 GA4 safe session join이 90% 이상으로 닫혀 channel별 구매자 vs 이탈자 truth table을 Green 분석으로 볼 수 있다.
- 더클린커피 channel truth table에서는 YouTube와 Meta 구매자의 p50 체류시간이 이탈자보다 길게 나와 선행지표 후보로 볼 가치가 있다.
- 더클린커피 GA4 `begin_checkout`, `add_payment_info`는 현재 0에 가까워 GTM Preview-only로 중간 이벤트를 먼저 검증해야 한다.
- 바이오컴은 구매 세션 GA4 join 29.47%, 이탈 세션 28.67%라 row-level 선행지표 판단 전 key capture 보강이 먼저다.
- raw-id Plan B는 즉시 실행하지 않는다. safe hash로 닫히지 않는 특정 safe_ref의 원인 분류가 필요할 때만 승인받아 secure evidence 내부에서 제한 실행한다.

## 2026-05-24 최신 live refresh와 OKR 진척률

source: VM Cloud `/api/attribution/leading-indicators` live aggregate endpoint.
window: 최근 7일.
freshness: 2026-05-24 00:47~00:49 KST.
confidence: 0.90.
주의: 이번 조회는 live refresh이며, 일부 응답은 `live_cache_miss`였다. 데이터 자체는 최신이지만 화면 응답 속도 안정성은 cache worker post-check가 남아 있다.

### site/channel별 최신 관측

- 바이오컴 / Meta:
  - 전체 Meta safe session: 422.
  - GA4와 연결된 세션: 418.
  - 구매 완료: 204.
  - 결제 시작 후 멈춤: 213.
  - GA4와 내부 결제 판단 충돌: 0.
  - 결제 확인 보류: 5.
  - 구매자 머문 시간 중앙값: 49.0초.
  - 결제 시작 후 멈춘 사람 머문 시간 중앙값: 29.5초.
  - 구매자 90% 스크롤: 50.0%.
  - 결제 시작 후 멈춘 사람 90% 스크롤: 26.8%.

- 더클린커피 / Meta:
  - 전체 Meta safe session: 131.
  - GA4와 연결된 세션: 130.
  - 구매 완료: 45.
  - 결제 시작 후 멈춤: 83.
  - GA4와 내부 결제 판단 충돌: 0.
  - 결제 확인 보류: 3.
  - 체류시간/스크롤 비교값: 아직 0 또는 null. 더클린커피는 중간 행동 수집 보강이 먼저다.

- 바이오컴 / Google 유료:
  - 전체 safe session: 103.
  - 구매 완료: 2.
  - 결제 시작 후 멈춤: 95.
  - 결제 확인 보류: 6.
  - 표본이 작아 구매자/비결제자 차이는 후보 관찰만 가능하다.

- 더클린커피 / Google 유료:
  - 전체 safe session: 3.
  - 구매 완료: 0.
  - 현재는 선행지표 후보를 만들 수 있는 표본이 아니다.

### OKR 진척률 업데이트

- 프로젝트 종합 진척률: 77%.
  - 이유: source inventory, cohort, 바이오컴 행동 feature, Top 5 scoring, 로컬 프론트 카드 구조는 상당 부분 닫혔다. 남은 핵심은 더클린커피 행동 공백, live cache 안정화, 운영 화면 배포, 실제 실험 공략집 연결이다.
- KR1. source inventory와 정본 분리: 94%.
  - 이유: VM Cloud, GA4, GTM, 운영DB 역할은 대부분 분리됐다. 남은 것은 회원가입/쿠폰/일부 중간 이벤트 source gap이다.
- KR2. 구매자와 이탈자 cohort 생성: 86%.
  - 이유: 바이오컴 Meta는 7일 live 기준 4 cohort가 안정적으로 나온다. 더클린커피는 cohort count는 나오지만 체류/스크롤 행동값이 부족하다.
- KR3. 체류시간/스크롤/중간 행동 feature 생성: 82%.
  - 이유: 바이오컴 Meta는 체류시간과 scroll90 차이가 나온다. 더클린커피와 회원가입/쿠폰/add_payment_info gap이 남았다.
- KR4. 선행지표 Top 5 점수화: 70%.
  - 이유: 로컬 backend 점수화 로직과 로컬 프론트 카드 구조가 구현됐다. 각 후보에 레버/관리/진단 역할과 공략집 문구가 붙었다. 남은 것은 VM 화면 배포, live API/cache 검증, 실제 실험 backlog 연결이다.
- KR5. Meta CAPI 중간 전환 전송 후보 분리: 58%.
  - 이유: Purchase와 내부 관찰 지표 분리 원칙은 있다. 운영 전송은 아직 별도 capiplan Red/Yellow 절차가 필요하다.

## 2026-05-27 live denominator 재점검

source: VM Cloud `/api/attribution/leading-indicators` live aggregate endpoint.
window: 최근 7일/30일.
freshness: 2026-05-27 09:03~09:21 KST.
confidence: 0.88.
주의: 아래 숫자는 `leadingIndicators` live API가 반환한 aggregate 값이다. Google 클릭 ID 보존율 자체는 별도 click-id preservation audit으로 확인해야 하며, 여기서는 channel별 safe session 표본 증가만 확인했다.

### “비결제자 주문서 진입 92.8%” 해석

- 바이오컴 Meta 최근 7일:
  - safe session 471.
  - 구매 완료 242.
  - 결제 시작 후 멈춤 222.
  - 결제 확인 보류 7.
  - 구매자 주문서 진입 99.2%.
  - 비결제 cohort 주문서 진입 92.8%.
- 바이오컴 Meta 최근 30일:
  - safe session 2,035.
  - 구매 완료 921.
  - 결제 시작 후 멈춤 1,033.
  - 결제 확인 보류 81.
  - 구매자 주문서 진입 98.9%.
  - 비결제 cohort 주문서 진입 92.7%.

해석:

`92.8%`는 오타가 아니라 실제 live API 값이다.
하지만 이것을 “전체 비결제 방문자의 92.8%가 주문서까지 갔다”로 읽으면 안 된다.
현재 `checkout_non_buyer`는 결제 흐름 가까이 온 세션을 강하게 포함하고 있으므로, 사람이 보는 화면에서는 “결제 시작 후 멈춤”으로 풀어 써야 한다.

### 전체 방문자 기준과 cohort 기준을 분리해야 하는 이유

- 바이오컴 전체 최근 7일:
  - safe session 1,142.
  - 구매 완료 394.
  - 결제 시작 후 멈춤 719.
  - 결제 확인 보류 29.
  - 비결제 cohort 주문서 진입 93.7%.
- 바이오컴 전체 최근 30일:
  - safe session 23,934.
  - 구매 완료 1,749.
  - 결제 시작 후 멈춤 21,945.
  - 결제 확인 보류 240.
  - 비결제 cohort 주문서 진입 15.2%.

해석:

최근 7일과 30일의 비결제 cohort 주문서 진입률이 크게 다르다.
이것은 고객 행동이 갑자기 뒤집혔다기보다, window별 cohort 구성과 분모가 달라졌다는 신호다.
따라서 API와 화면은 다음 세 값을 분리해야 한다.

1. 전체 방문 세션.
2. 주문서/결제 시작 화면까지 도달한 세션.
3. 주문서까지 갔지만 구매 완료로 닫히지 않은 세션.

### 작은 표본과 큰 표본이 같이 보였던 이유

페이지 롱 뷰 기준 시간 표의 작은 숫자는 channel-specific dry-run이다.
예를 들어 바이오컴 Google 유료만 7일로 자르면 구매자는 2명 수준까지 줄어든다.
반면 사이트별 핵심 행동값 표는 사이트 전체 또는 큰 cohort를 묶은 GA4-VM safe bridge 표라 356명/689명 같은 큰 표본이 나온다.

최신 live API 기준 바이오컴 Google 유료 표본:

- 최근 7일:
  - safe session 74.
  - 구매 완료 2.
  - 결제 시작 후 멈춤 65.
  - 결제 확인 보류 7.
- 최근 30일:
  - safe session 503.
  - 구매 완료 18.
  - 결제 시작 후 멈춤 460.
  - 결제 확인 보류 25.

해석:

Google 유료는 표본이 늘었지만, 구매자 수는 여전히 작다.
따라서 2분/3분/7분 page-long 기준은 예산 판단값이 아니라 방향 확인값으로 둔다.
Google 클릭 ID 보존율이 좋아졌는지는 이번 표본 증가만으로 단정하지 않는다.
별도 `click_id preservation` audit에서 payment_success까지 gclid/gbraid/wbraid가 이어지는지 확인한다.

## 이 에이전트가 필요한 이유

매출은 결과다.
결과는 직접 움직일 수 없다.

우리가 실제로 바꿀 수 있는 것은 아래 같은 행동이다.

- 어떤 랜딩 페이지를 보여줄지.
- 어떤 콘텐츠에서 회원가입을 유도할지.
- 장바구니까지 가는 버튼과 문구를 어떻게 바꿀지.
- 결제수단 선택 전 이탈을 어떻게 줄일지.
- Meta 광고가 어떤 사용자를 더 많이 데려오게 할지.

그래서 이 에이전트의 목적은 “매출이 왜 늘었는가”를 늦게 해석하는 것이 아니다.
목적은 **매출이 늘기 전에 먼저 움직이는 행동 지표를 찾고, 그것을 매일 관리 가능한 숫자로 만드는 것**이다.

## 후행 지표와 선행 지표

### 후행 지표

후행 지표는 이미 일어난 결과다.

예:

- 일 매출
- ROAS
- 결제완료 주문 수
- 이익
- 광고비 대비 구매 수

이 숫자들은 중요하지만, 오늘 직접 클릭해서 바꾸기는 어렵다.

### 선행 지표

선행 지표는 결과를 만드는 원인 행동이다.

예:

- Meta 유입자가 첫 30초 안에 상품 설명 영역까지 내려갔는가.
- 리뷰 랜딩 방문자가 50% 이상 스크롤했는가.
- 결제 시작 후 결제수단 선택까지 갔는가.
- 회원가입 완료 후 24시간 안에 장바구니나 상담 행동이 있었는가.
- YouTube 콘텐츠 유입자가 다른 유입보다 체류시간이 긴가.

이 숫자들은 오늘 바로 바꿀 수 있다.
그래서 대표가 볼 화면도 “어제 매출이 얼마였는가”뿐 아니라 “매출이 늘기 전 행동이 오늘 늘고 있는가”를 보여줘야 한다.

## 선행 지표를 찾는 3가지 질문

### 질문 1. 구매 직전에 반드시 일어나는 행동은 무엇인가

구매를 거꾸로 추적한다.

```text
결제완료
<- 결제수단 선택
<- 결제 시작
<- 장바구니 또는 바로구매
<- 상품/리뷰/상담 콘텐츠 몰입
<- 유입
```

이 체인에서 가장 앞단에 있으면서 직접 개선 가능한 행동을 찾는다.

바이오컴 후보:

- Meta 유입 후 50% 이상 스크롤.
- 리뷰/검사 결과 콘텐츠 90초 이상 체류.
- 장바구니 페이지 진입.
- 결제 시작.
- 결제수단 선택.

### 질문 2. 좋은 고객은 초기에 무엇을 공통적으로 했는가

좋은 고객은 단순 구매자가 아니라 반복 구매, 고액 구매, 상담 전환, 멤버십/쿠폰 활용까지 이어지는 고객이다.

찾을 패턴:

- 첫 방문에서 어떤 랜딩을 봤는가.
- 첫 방문에서 몇 초 머물렀는가.
- 첫 방문에서 몇 %까지 스크롤했는가.
- 회원가입을 했는가.
- 가입 후 몇 시간 안에 장바구니나 결제 시작을 했는가.
- Meta 광고 유입인지, 오가닉 검색인지, YouTube 콘텐츠 유입인지.

### 질문 3. 그 행동을 늘리면 결과가 비례해서 좋아지는가

선행 지표는 느낌이 아니라 검증해야 한다.

예:

- 50% 스크롤 사용자가 구매율이 높아도, 그 숫자를 늘렸을 때 구매가 늘지 않으면 핵심 선행 지표가 아니다.
- 회원가입 완료자가 구매율이 높아도, 가입만 늘리고 구매가 늘지 않으면 “좋은 선행 지표”가 아니다.
- YouTube 유입 체류시간이 길어도 결제 시작으로 안 이어지면 콘텐츠 품질 지표이지 구매 선행 지표는 아니다.

## KPI 운영 원칙 반영

참고 문서: [KPI 설계 7가지 교훈과 선행지표 에이전트 적용 원칙](kpi-design-seven-lessons-20260526.md)

이 프로젝트에서 KPI는 “숫자를 맞히는 압박 도구”가 아니라 “사람이 내일 할 행동을 바꾸는 설계도”로 본다.
따라서 선행지표 에이전트는 단순히 구매자와 비결제자의 차이를 보여주는 데서 멈추면 안 된다.
각 지표가 실제 업무 행동으로 이어지는지까지 판단해야 한다.

### 적용 규칙

- 지표를 추가하기 전에 “이 숫자를 본 사람이 내일 무엇을 하게 되는가”를 먼저 적는다.
- 매출, ROAS, 구매 수는 후행 지표로 분리하고, 체류시간, 리뷰 도달, 결제 시작, 결제수단 선택은 선행 지표 후보로 분리한다.
- Top 5에는 레버지표를 우선 배치한다. 레버지표는 지금 당장 랜딩, 콘텐츠, 버튼, 리뷰 위치, 결제 흐름을 바꿔 움직일 수 있는 숫자다.
- CAPI 성공률, GA4 join rate, 전체 PageView처럼 이상 감시에 가까운 숫자는 관리지표로 둔다.
- 모든 지표 카드에는 공략집을 붙인다. 공략집은 “무엇을, 어떻게, 왜 바꾸는지”를 고등학생도 이해할 수 있는 문장으로 적는다.
- 원인과 결과가 약한 지표는 Meta CAPI 전송 후보가 아니라 내부 관찰 지표로 유지한다.

### 프론트엔드 표시 원칙

프론트엔드 보고서는 기술명을 먼저 보여주지 않는다.
예를 들어 `dwell_seconds`라고 쓰지 않고, “상세페이지에 머문 시간”이라고 먼저 쓴 뒤 괄호로 기술명을 보조한다.

각 카드에는 다음 항목을 둔다.

- 현재 숫자.
- 구매자와 비결제자 차이.
- 왜 중요한지.
- 지금 바로 할 행동.
- 이 지표가 레버지표인지 관리지표인지.
- 데이터 신뢰도와 표본 수.

따라서 에이전트는 **상관관계 → 가설 → 실험 → 재측정** 순서로 판단해야 한다.

## 에이전트 이름과 역할

추천 이름: **Leading Indicator Agent**

한국어 이름: **구매 전 선행지표 에이전트**

역할:

1. 유입 채널별 행동을 모은다.
2. 구매자와 이탈자를 나눈다.
3. 구매 직전에 반복되는 행동을 찾는다.
4. 좋은 고객의 초기 공통 행동을 찾는다.
5. 통제 가능한 숫자만 후보로 남긴다.
6. `/conversion-funnel` 화면과 ROAS 화면에 “오늘 관리할 행동 지표”로 보낸다.

## 데이터 source 기준

### VM Cloud

역할: 1차 행동 원장이다.

주요 후보:

- 유입 row.
- 장바구니 페이지 진입.
- 결제 시작.
- 결제수단 선택.
- 결제완료.
- Meta CAPI 성공 로그.
- action queue.

강점:

- 우리 서버가 직접 받은 first-party 원장이다.
- site/pixel 기준으로 필터링할 수 있다.

주의:

- 모든 브라우저 이벤트가 아직 다 들어오지는 않는다.
- 체류시간과 스크롤은 별도 저장 경로가 필요할 수 있다.

### GA4 BigQuery

역할: 행동 품질 cross-check source다.

주요 후보:

- 평균 참여 시간.
- 스크롤 이벤트.
- 페이지 경로.
- 세션 source/medium.
- 콘텐츠별 참여.

강점:

- 체류시간, scroll, page engagement 분석에 강하다.

주의:

- GA4 purchase revenue는 실제 결제 정본이 아니다.
- 바이오컴 BigQuery 권한/연결 상태가 흔들릴 수 있다.
- GA4 user/session key와 VM Cloud safe key join은 별도 품질 점검이 필요하다.

### GTM

역할: event trigger source다.

주요 후보:

- 회원가입 완료.
- 50% 스크롤.
- 결제수단 선택.
- 장바구니/결제 시작 trigger.

주의:

- GTM Production publish는 Red Lane이다.
- GTM에서 Meta CAPI를 직접 호출하지 않는다.
- 먼저 VM Cloud no-send receiver로 저장해야 한다.

### 운영DB

역할: 결제완료 cross-check source다.

주의:

- 운영DB는 개발팀 관리 PostgreSQL이다.
- write/import 금지.
- 선행지표 분석에서는 구매 결과 라벨을 확인하는 보조 source로만 쓴다.

## 분석할 핵심 코호트

### Meta 광고 유입

질문:

- Meta 유입 구매자와 이탈자의 평균 체류시간은 얼마나 다른가.
- 구매자는 몇 %까지 스크롤하는가.
- 구매자는 장바구니 또는 결제 시작까지 얼마나 빨리 가는가.
- Meta strong evidence가 있는 구매자와 weak evidence 구매자의 행동 차이는 있는가.

필수 지표:

- landing sessions.
- 평균 체류시간.
- p50/p75/p90 체류시간.
- scroll 50/75/90 도달률.
- cart page seen.
- checkout started.
- payment info selected.
- confirmed purchase.
- CAPI sent success.

### 오가닉 검색 유입

질문:

- 네이버/구글 오가닉 유입자는 광고 유입보다 더 오래 머무는가.
- 오가닉 유입자가 어떤 페이지에서 구매로 이어지는가.
- 브랜드 검색 유입과 일반 정보성 검색 유입의 체류시간과 구매율이 다른가.

필수 지표:

- organic_naver / organic_google / direct 구분.
- landing page bucket.
- 검색어 aggregate source 가능 여부.
- scroll depth.
- checkout progression.
- confirmed purchase.

### YouTube 콘텐츠 유입

질문:

- YouTube 콘텐츠를 보고 들어온 사람은 구매 전 체류시간이 긴가.
- 바로 구매보다 회원가입/상담/재방문으로 이어지는가.
- 어떤 영상/콘텐츠 bucket이 결제 시작으로 연결되는가.

필수 지표:

- youtube / video / influencer / content UTM bucket.
- landing page.
- dwell time.
- scroll depth.
- signup.
- cart/checkout.
- 1일/7일 후 구매.

### 회원가입 코호트

질문:

- 회원가입 완료자가 구매로 이어지는 비율은 얼마인가.
- 회원가입 폼 진입 대비 완료율은 얼마인가.
- 가입 직후 이탈하는 사용자는 어느 단계에서 멈추는가.
- 가입 후 첫 24시간 행동 중 구매를 가장 잘 예고하는 행동은 무엇인가.

필수 지표:

- signup start.
- CompleteRegistration.
- signup completion rate.
- signup to cart.
- signup to checkout.
- signup to purchase within 1d/7d.

## Meta 표준 중간 전환 지표

Meta Conversions API 공식 문서 기준으로 서버 이벤트의 `event_name`은 표준 이벤트 또는 커스텀 이벤트 이름을 쓸 수 있다.
browser Pixel과 server CAPI를 중복 제거하려면 같은 행동에 대해 browser `eventID`와 server `event_id`를 맞추는 것이 중요하다.

바이오컴에서 중간 전환으로 우선 검토할 Meta 표준 이벤트:

| 이벤트 | 쉬운 뜻 | 바이오컴 후보 source | 운영 판단 |
|---|---|---|---|
| `PageView` | 페이지 조회 | 기존 FBE/native browser | 이미 기본 신호. 서버 CAPI 확장 우선순위 낮음 |
| `ViewContent` | 의미 있는 콘텐츠/상품 조회 | 상품/리뷰/검사정보 페이지 | health/wellness 제한 때문에 콘텐츠명 최소화 필요 |
| `Search` | 사이트 내부 검색 | 사이트 검색 결과 | 검색어 원문은 민감할 수 있어 bucket 처리 필요 |
| `AddToCart` | 장바구니 담기 | 장바구니 클릭 또는 `/shop_cart` 진입 | 구매 의도 강함. VM Cloud에는 페이지 진입 기준부터 가능 |
| `AddToWishlist` | 찜/관심 저장 | 현재 source 미확인 | 우선순위 낮음 |
| `InitiateCheckout` | 결제 시작 | 주문서/결제 페이지 진입 | 강한 선행지표. Purchase와 반드시 분리 |
| `AddPaymentInfo` | 결제수단 선택 | 결제수단 선택 UI | 현재 VM Cloud source gap 있음 |
| `Lead` | 상담/문의/리드 | 상담 신청, 카톡 문의 | 상담 funnel과 연결 가능 |
| `CompleteRegistration` | 회원가입 완료 | GTM 회원가입 완료 source 있음 | 첫 staged 후보로 적합 |
| `Subscribe` | 구독 시작 | 정기결제/멤버십 | 결제완료와 혼동 금지 |
| `StartTrial` | 체험 시작 | 현재 source 미확인 | 낮은 우선순위 |
| `Contact` | 연락/문의 | 카톡/문의 버튼 | Lead와 중복 정의 주의 |
| `Schedule` | 예약 | 현재 source 미확인 | 낮은 우선순위 |

Meta 표준 이벤트가 아닌 내부 선행지표:

| 내부 지표 | 쉬운 뜻 | Meta 전송 판단 |
|---|---|---|
| `Scroll50` | 페이지 50% 이상 읽음 | 표준 이벤트 아님. 먼저 VM Cloud 내부 관찰 |
| `Scroll75` | 깊은 탐색 | 내부 관찰 우선 |
| `Dwell90` | 90초 이상 체류 | 내부 관찰 우선 |
| `ReviewLandingEngaged` | 리뷰 랜딩에서 충분히 읽음 | custom event 후보지만 운영 전송은 보류 |
| `VideoContentEngaged` | YouTube/영상 유입 후 몰입 | 내부 분석 우선 |

## 에이전트가 산출할 지표

### 매일 보는 운영 지표

1. `Meta 유입 구매자 평균 체류시간`
2. `Meta 유입 이탈자 평균 체류시간`
3. `오가닉 유입 구매자 평균 체류시간`
4. `YouTube 유입 구매자 평균 체류시간`
5. `Scroll50 도달률`
6. `Scroll75 도달률`
7. `회원가입 완료율`
8. `회원가입 후 1일 내 결제 시작률`
9. `결제 시작 후 결제수단 선택률`
10. `결제수단 선택 후 결제완료율`

### 후보 매직 넘버

초기 후보:

- Meta 유입 후 60초 이상 체류.
- 리뷰 랜딩 50% 이상 스크롤.
- 상품/리뷰 페이지 2개 이상 조회.
- 회원가입 후 24시간 안에 장바구니 진입.
- 결제 시작 후 3분 안에 결제수단 선택.

에이전트는 이 후보들을 고정하지 않는다.
매일 데이터를 보고 `구매율 lift`, `모수`, `통제 가능성`, `개선 난이도` 기준으로 후보를 올리고 내린다.

## 분석 로직

### 1단계. 구매자와 이탈자를 나눈다

기준:

- 구매자: VM Cloud 또는 운영DB/Imweb/Toss 기준 confirmed purchase.
- 이탈자: 유입 또는 결제 시작은 있으나 window 내 confirmed purchase 없음.

window:

- same session.
- 24h.
- 7d.
- 30d.

### 2단계. 채널별 행동을 비교한다

채널:

- paid_meta.
- paid_google.
- paid_naver.
- organic_naver.
- organic_google.
- youtube_content.
- direct.
- referral.
- unknown.

비교:

- 평균보다 median/p75를 우선 본다.
- 체류시간은 outlier가 많기 때문이다.
- 구매율 lift는 `행동 발생 그룹 구매율 / 행동 미발생 그룹 구매율`로 본다.

### 3단계. 통제 가능한 행동만 남긴다

선행지표 후보가 되려면 아래 4개를 통과해야 한다.

1. 구매와 통계적으로 관련이 있다.
2. 충분한 모수가 있다.
3. 오늘 UI/광고/랜딩/콘텐츠로 바꿀 수 있다.
4. 늘리면 구매율도 같이 움직일 가능성이 있다.

### 4단계. 실험으로 검증한다

예:

- 리뷰 랜딩의 첫 화면 CTA를 바꿔 Scroll50 도달률을 올린다.
- 회원가입 후 쿠폰 노출을 바꿔 24시간 내 결제 시작률을 올린다.
- YouTube 유입 랜딩을 리뷰/후기 페이지로 보내 체류시간과 결제 시작률을 비교한다.

## 에이전트 구조

### Collector

하는 일:

- VM Cloud 원장에서 유입, 장바구니, 결제 시작, 결제수단 선택, 결제완료를 읽는다.
- GA4 BigQuery에서 체류시간, 스크롤, 페이지 경로를 읽는다.
- GTM export에서 어떤 이벤트 source가 있는지 확인한다.

### Cohort Builder

하는 일:

- 유입 채널별 세션을 만든다.
- 구매자/이탈자/가입자/재방문자를 나눈다.
- same session, 24h, 7d window를 만든다.

### Feature Builder

하는 일:

- 체류시간 bucket.
- 스크롤 bucket.
- 페이지 bucket.
- 회원가입 여부.
- 장바구니/결제 시작/결제수단 선택 여부.
- CAPI success 여부.

### Signal Scorer

하는 일:

- 구매율 lift를 계산한다.
- 모수 부족 신호를 제외한다.
- 채널별 차이를 계산한다.
- 추천 선행지표를 점수화한다.

추천 점수 공식 후보:

```text
score = 구매율 lift 점수
      + 모수 점수
      + 통제 가능성 점수
      + 개선 난이도 점수
      - 오염/추적 리스크 점수
```

### Experiment Recommender

하는 일:

- 오늘 바꿀 행동 1개를 추천한다.
- 필요한 화면/랜딩/광고/콘텐츠 변경을 제안한다.
- 성공 기준과 실패 시 해석을 만든다.

### Reporter

하는 일:

- `/conversion-funnel` 화면에 카드로 보낸다.
- `project/leading-indicator-weekly.md` 같은 주간 문서로 요약한다.
- Meta CAPI 후보는 Purchase와 분리해서 표시한다.

## 프론트 화면 제안

프론트엔드 개발 담당은 Claude Code다.
Codex는 이 문서와 P0 dry-run 산출물을 기준으로 data contract와 화면 요구사항만 넘긴다.

페이지 후보:

```text
/ai-crm/leading-indicators
```

첫 화면 카드:

1. 오늘 구매 전 강한 신호.
2. Meta 유입 구매자 vs 이탈자 체류시간 차이.
3. Scroll50 도달률.
4. 회원가입 완료 후 결제 시작률.
5. YouTube/오가닉 유입의 몰입도.
6. 오늘 실험 추천.

사용자가 얻는 이점:

- 매출이 떨어진 뒤 알지 않고, 구매 전 행동이 꺾이는 시점에 먼저 알 수 있다.
- 광고비를 올릴지 줄일지 ROAS만 기다리지 않아도 된다.
- 랜딩/콘텐츠/회원가입/결제 UX 중 어디를 바꿔야 하는지 보인다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase1-Sprint1]] | 선행지표 source inventory를 닫는다 | 어떤 신호가 어디에 있는지 모르면 분석이 흔들린다 | VM Cloud, GA4, GTM, 운영DB source를 지표별로 분리한다 | VM Cloud/GA4/GTM/운영DB 역할 분리 완료. 회원가입/쿠폰/일부 중간 이벤트 source gap만 남음 | 94 | source/window/freshness/confidence가 지표별로 붙음 | Codex: signup/coupon source gap closure | NO, Green | `project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md` |
| P0 | [[#Phase1-Sprint2]] | 구매자와 이탈자 cohort를 만든다 | 구매로 이어진 행동과 이탈 행동을 비교해야 선행지표가 보인다 | channel/session/safe key 기준으로 purchased vs dropped를 나눈다 | 바이오컴 Meta live 7d 4 cohort 생성 완료. 더클린커피는 count는 가능하나 행동값 수집 gap 남음 | 86 | Meta/organic/youtube별 cohort가 1d/7d로 생성됨 | Codex: 더클린커피 행동값 수집 보강 | NO, Green | `data/project/ga4-vm-row-level-safe-bridge-dry-run-20260517.json` |
| P1 | [[#Phase2-Sprint1]] | 체류시간/스크롤/회원가입 지표를 만든다 | 구매 전 몰입 행동을 숫자로 봐야 한다 | GA4/VM Cloud를 조합해 dwell/scroll/signup feature를 만든다 | 바이오컴 Meta 7d에서 체류시간과 scroll90 차이 확인. latest response는 live_cache_miss라 cache worker post-check 필요 | 82 | 각 feature의 purchase lift와 모수가 계산되고 화면이 live cache hit 기준으로 빠르게 표시됨 | Codex: cache health + coffee dwell/scroll gap | Yellow는 VM deploy 시만 필요 | `project/leading-indicator-p1-vm-deploy-result-20260519.md` |
| P1 | [[#Phase2-Sprint2]] | 선행지표 점수화와 추천을 만든다 | 지표가 많으면 무엇을 바꿔야 할지 모른다 | lift, volume, confidence, controllability, risk로 score를 만들고, 각 후보에 공략집을 붙인다 | 로컬 backend Top 5 scoring 구현 완료. 로컬 프론트에 OKR/액션플랜/레버지표 카드 구조 반영. VM 배포와 실험 backlog 연결 남음 | 70 | Top 5 leading indicators와 실험 추천이 live 화면에 표시됨 | Codex: VM deploy packet / Claude Code: experiment backlog UI | VM deploy는 Yellow | 이 문서 |
| P2 | [[#Phase3-Sprint1]] | Meta CAPI 중간 전환 후보를 분리한다 | 선행지표 중 일부는 Meta 학습 신호가 될 수 있다 | no-send receiver, Test Events, staged ON으로 분리한다 | 별도 capiplan 진행 중. Purchase와 내부 관찰 지표 분리 원칙은 있음 | 58 | Purchase 오염 없이 server source 수신 검증 | Codex/TJ | Red send 전 승인 | [[capivm/!capiplan]] |

## Phase1-Sprint1

**이름**: 선행지표 source inventory를 닫는다

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

구매 전 행동 지표가 어느 source에 있는지 정리한다.

### 왜 하는가

체류시간은 GA4에 있을 수 있고, 결제완료는 VM Cloud/운영DB에 있고, 회원가입은 GTM에 있을 수 있다.
source가 섞이면 선행지표가 아니라 추정치가 된다.

### 어떻게 하는가

1. 지표별 primary source를 정한다.
2. cross-check source를 정한다.
3. freshness와 confidence를 붙인다.
4. source gap은 `데이터 없음`, `source 다름`, `sync 지연`, `권한 부족`, `필터 불일치`로 분리한다.

### 개발 계획

완료된 것:

1. [Codex] P0 source matrix dry-run을 만들었다.
   - 무엇: 유입, 장바구니 페이지 진입, 결제 시작, 결제수단 선택, 결제완료, Meta CAPI 성공, 체류시간, Scroll50, 회원가입, YouTube source 후보를 지표별로 분리했다.
   - 왜: 어떤 숫자는 VM Cloud에 있고, 어떤 숫자는 GA4/GTM route가 필요하므로 한 source로 단정하면 분석이 흔들리기 때문이다.
   - 어떻게: VM Cloud `funnel-health` cached aggregate API와 로컬 문서 `data/!data_inventory.md`, `data/!channelfunnel.md`, `GA4/gtm.md`, `capivm/!capiplan.md`를 read-only로 대조했다.
   - 산출물: `data/project/leading-indicator-p0-dry-run-20260517.json`, `project/leading-indicator-p0-dry-run-20260517.md`
   - 검증 기준: 지표별 source/window/freshness/confidence/blocker category가 붙었다.
   - 현재 한계: 체류시간, Scroll50, CompleteRegistration, YouTube source는 아직 VM Cloud 분석 route가 닫히지 않았다.

2. [Codex] GA4 dwell/scroll source dry-run을 만들었다.
   - 무엇: 바이오컴과 더클린커피를 분리해 GA4 세션의 체류시간, Scroll50/90, 장바구니, 결제 시작, 결제수단 입력, GA4 purchase event를 source/landing bucket별로 계산했다.
   - 왜: 구매 전 몰입 행동은 VM Cloud 결제 원장만으로는 보이지 않기 때문이다. GA4는 “얼마나 오래 보고 얼마나 깊게 내려갔는지”를 보여준다.
   - 어떻게: 바이오컴 GA4 `analytics_304759974`/archive, 더클린커피 GA4 `analytics_326949178`를 BigQuery read-only로 조회하고, VM Cloud `funnel-health`의 결제완료/CAPI aggregate와 site별로만 대조했다.
   - 산출물: `backend/scripts/ga4-dwell-scroll-join-dry-run.ts`, `data/project/ga4-dwell-scroll-join-dry-run-20260517.json`, `project/ga4-dwell-scroll-join-dry-run-20260517.md`
   - 검증 기준: site/source/window/freshness/confidence가 붙었고, 운영 전송/DB write/GTM publish는 0이다.
   - 현재 한계: GA4 세션과 VM Cloud 결제 row가 아직 같은 safe session/order key로 닫히지 않아 source별 구매율로 바로 쓰지는 않는다.

3. [Codex] GA4와 VM Cloud가 같은 사람/주문 흐름으로 이어질 수 있는지 key presence audit를 만들었다.
   - 무엇: GA4 세션 키와 VM Cloud 결제완료 safe_ref가 같은 사용자 흐름으로 이어질 수 있는지 presence aggregate를 만든다.
   - 왜: 같은 모집단으로 닫혀야 “Meta 유입 구매율”, “YouTube 체류시간별 구매율” 같은 말을 안전하게 할 수 있다.
   - 어떻게: raw id를 출력하지 않고 `client_id`, `user_pseudo_id`, `ga_session_id`, `checkoutId` 같은 join key의 존재율만 집계했다.
   - 결과: 바이오컴은 결제완료 410건 중 GA4 세션 키 94.39%, 결제 전 단계 매칭 99.76%, 유입 장부 client 매칭 77.8%다. 더클린커피는 결제완료 335건 중 GA4 세션 키 99.1%, 결제 전 단계 매칭 99.7%, 유입 장부 client 매칭 80%다.
   - 산출물: `backend/scripts/ga4-vm-join-key-and-coffee-gap-dry-run.ts`, `data/project/ga4-vm-join-key-and-coffee-gap-20260517.json`, `project/ga4-vm-join-key-and-coffee-gap-20260517.md`
   - 검증 기준: raw identifier output 0, site=biocom/thecleancoffee 분리, 같은 모집단 준비도를 `needs_key_capture_improvement` / `strong_enough_for_next_row_level_dry_run`로 표시했다.
   - 현재 한계: 바이오컴은 유입 장부까지 닫히는 비율이 77.8%라 구매율/lift 계산 전에 key capture 보강이 필요하다. 더클린커피는 80%로 다음 row-level safe dry-run 진입이 가능하다.

4. [Codex] row-level safe bridge dry-run을 만들었다.
   - 무엇: VM Cloud의 구매 세션과 결제 이탈 세션을 GA4 세션 행동과 safe hash로 붙였다.
   - 왜: 같은 사람/같은 세션으로 닫혀야 “구매자는 오래 머물렀고 이탈자는 짧았다” 같은 선행지표 판단을 할 수 있기 때문이다.
   - 어떻게: VM Cloud 안에서 원문 세션 재료를 SHA-256 safe hash로 바꾸고, GA4 BigQuery에서도 같은 방식의 safe session hash를 만든 뒤 로컬에서 aggregate join만 했다.
   - 결과: 더클린커피는 confirmed purchase 326세션 중 316세션이 GA4와 연결됐다(96.93%). dropped checkout 378세션 중 357세션도 연결됐다(94.44%). 바이오컴은 strict safe hash 기준 confirmed 29.47%, dropped 28.67%라 key 보강이 먼저 필요하다.
   - 산출물: `backend/scripts/ga4-vm-row-level-safe-bridge-dry-run.ts`, `data/project/ga4-vm-row-level-safe-bridge-dry-run-20260517.json`, `project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md`
   - 검증 기준: raw identifier output 0, VM Cloud/GA4 read-only, 운영 전송/DB write/GTM publish 0.
   - 현재 한계: 바이오컴은 strict safe hash만으로 충분히 닫히지 않는다. raw id Plan B는 실행하지 않았고 승인안으로만 남겼다. gpt-5.5 pro web feedback에서도 이 결론을 유지하되, 더클린커피 `dropped_checkout`에 GA4 purchase가 일부 보이는 점은 세션 재생성/window 차이/나중 구매 가능성으로 별도 재검증하라고 권고했다.

남은 것:

1. [Codex] signup source gap을 닫는다.
   - 무엇: 회원가입 완료가 GA4/GTM/VM Cloud 중 어디에 남는지 확인한다.
   - 왜: 회원가입이 구매 전 선행지표인지 보려면 구매 후보가 아니라 중간 행동으로 저장돼야 한다.
   - 어떻게: GTM 문서/GA4 event/VM Cloud no-send route를 read-only로 대조한다.
   - 산출물: CompleteRegistration no-send route 설계.
   - 검증: signup event는 Purchase 후보 0.
   - 의존성: GTM workspace/UI 확인이 필요한 경우 TJ님 확인.

### 현재 진척률

현재 진척률: 94%.

### 100% 조건

- 모든 후보 지표에 primary/cross-check/fallback source가 있다.
- source gap이 blocker category로 닫힌다.
- raw identifier output 0.
- Claude Code가 화면화할 수 있는 field list가 있다.

### 역할 구분

- Codex: read-only inventory, dry-run, data contract 작성.
- Claude Code: 프론트엔드 화면 개발.
- TJ님: GA4/Meta/GTM UI 권한이 필요한 경우 화면 확인.

## Phase1-Sprint2

**이름**: 구매자와 이탈자 cohort를 만든다

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

같은 유입 채널 안에서 구매자와 이탈자를 나눈다.

### 왜 하는가

Meta 유입자가 오래 머물렀다는 사실만으로는 부족하다.
오래 머문 사람 중 구매자가 많았는지, 이탈자도 똑같이 오래 머물렀는지를 비교해야 한다.

### 어떻게 하는가

1. 유입 세션을 channel bucket으로 나눈다.
2. confirmed purchase가 있는 세션과 없는 세션을 나눈다.
3. 같은 기준으로 체류시간, 스크롤, 회원가입, 장바구니, 결제 시작을 비교한다.

### 개발 계획

완료된 것:

1. [Codex] 전체 funnel aggregate baseline을 만들었다.
   - 무엇: 1d/7d 기준 전체 유입, 장바구니 페이지 진입, 결제 시작, 실제 결제완료, Meta CAPI 성공을 한 번에 뽑았다.
   - 왜: 구매 전 단계가 어디서 많이 빠지는지 보려면 먼저 전체 기준선이 필요하기 때문이다.
   - 어떻게: VM Cloud `funnel-health` cached aggregate API를 순차 호출해 backend hammer 없이 산출했다.
   - 7d 기준: 전체 유입 10,720건, 장바구니 페이지 진입 29건, 결제 시작 2,250건, 실제 결제완료 388건, Meta CAPI 성공 376건.
   - 검증: source/window/freshness/confidence가 산출물에 기록됐다.

2. [Codex] source별 diagnostic baseline을 만들었다.
   - 무엇: Meta, Google, Naver, Organic, Direct, UTM 있음/없음 source filter를 각각 조회했다.
   - 왜: 어떤 채널에서 구매 전 행동이 강한지 후보를 좁히기 위해서다.
   - 어떻게: live API를 순차 호출하고, source별 전환율은 같은 모집단이 아니면 표시하지 않도록 계약을 분리했다.
   - 현재 중요한 발견: source별 `meta_capi_success`는 source filter와 직접 닫히지 않아 전환율로 쓰면 안 되고, 방향성 진단으로만 써야 한다.

3. [Codex] GA4 source/landing bucket 행동 baseline을 만들었다.
   - 무엇: Meta, Google paid, Naver, YouTube, Organic, Other별로 체류시간과 스크롤을 분리했다.
   - 왜: 구매자/이탈자 cohort를 만들기 전, 어떤 source와 landing bucket이 행동 차이를 보이는지 먼저 봐야 한다.
   - 어떻게: GA4 BigQuery session aggregate와 VM Cloud site aggregate를 같은 7일 window로 대조했다.
   - 현재 중요한 발견: 바이오컴은 Meta home_or_other 세션이 많지만 p50 dwell이 0초로 낮고, 더클린커피는 YouTube/product와 Naver paid/home_or_other 체류시간이 길다. 단, 아직 구매자/이탈자 row-level 비교는 아니다.

4. [Codex] cohort 생성을 위한 join key 준비도를 확인했다.
   - 무엇: 구매자/이탈자를 나눌 때 같은 사람/같은 세션으로 이어볼 수 있는 열쇠가 남아 있는지 확인했다.
   - 왜: 유입자와 결제자를 다른 모집단으로 세면 구매율이 아니라 숫자 나눗셈이 되기 때문이다.
   - 어떻게: VM Cloud 결제완료, 결제 시작, 결제 페이지, 유입 장부를 site별로 aggregate 조인했다.
   - 결과: 더클린커피는 row-level safe dry-run에 들어갈 수준이고, 바이오컴은 landing match 77.8%라 보강 후 계산해야 한다.

5. [Codex] 구매자/이탈자 row-level safe bridge를 실행했다.
   - 무엇: 실제 결제완료 세션과 결제 페이지 이탈 세션을 같은 GA4 행동 데이터에 붙였다.
   - 왜: 선행지표는 구매자와 이탈자의 차이를 비교해야 의미가 있기 때문이다.
   - 어떻게: 원문 ID를 문서에 쓰지 않고 VM Cloud와 GA4에서 같은 safe session hash를 생성했다.
   - 결과: 더클린커피는 구매자/이탈자 모두 94% 이상 GA4와 연결됐다. 더클린커피 구매자는 p50 체류시간 251.75초, 이탈자는 154.91초로 차이가 뚜렷하다. 바이오컴은 strict safe hash 연결률이 30%대라 raw id Plan B 또는 key capture 보강 전까지 source별 lift 계산을 보류한다.
   - 산출물: `project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md`
   - 검증 기준: raw identifier output 0, site별 분리, 구매자/이탈자 cohort 분리.
   - 주의: `dropped_checkout`은 “같은 safe session 안에서 결제완료로 닫히지 않음”이라는 뜻이다. 특히 더클린커피 dropped 후보 중 GA4 purchase가 17.65% 보이므로, 진짜 이탈로 확정하기 전 window/session rollover/나중 구매를 재검증한다.

남은 것:

1. [Codex] 더클린커피 channel별 구매자 vs 이탈자 cohort truth table을 만든다.
   - 무엇: 더클린커피의 YouTube, Meta, Naver paid, direct/unknown 유입을 구매자/이탈자로 나눈다.
   - 왜: 더클린커피는 safe bridge가 닫혔으므로 어떤 유입/랜딩이 구매를 예고하는지 바로 볼 수 있기 때문이다.
   - 어떻게: `ga4-vm-row-level-safe-bridge` 결과를 source_group/landing_bucket별로 재집계한다.
   - 산출물: coffee channel cohort truth table.
   - 검증: 채널별 purchased/dropped count, median dwell, scroll90, cart event, GA4 purchase presence가 나온다.
   - 의존성: 없음. Green Lane.

2. [Codex] 바이오컴 Meta 유입 구매자 vs 이탈자 row/session cohort dry-run을 만든다.
   - 무엇: paid_meta 세션을 구매/이탈로 나눈다.
   - 왜: Meta 광고에서 어떤 행동이 구매를 예고하는지 찾기 위해서다.
   - 어떻게: VM Cloud 유입/결제 원장과 GA4 engagement source를 safe session 기준으로 결합하되, 연결률이 낮으면 key capture 보강 또는 승인된 raw id Plan B로만 넘어간다.
   - 산출물: Meta cohort truth table.
   - 검증: purchased/dropped count, median dwell, scroll50 rate, checkout rate가 나온다.
   - 의존성: 바이오컴 strict safe hash 연결률 보강.

3. [Codex] organic/youtube cohort를 같은 방식으로 만든다.
   - 무엇: organic_naver, organic_google, youtube_content 유입을 같은 지표로 비교한다.
   - 왜: 광고만이 아니라 콘텐츠/검색의 구매 전 행동을 비교해야 한다.
   - 어떻게: UTM/referrer/page bucket 기준으로 나눈다.
   - 산출물: channel cohort comparison.
   - 검증: 채널별 sample size와 confidence가 붙는다.
   - 의존성: source classification rule.

### 현재 진척률

현재 진척률: 86%.

### 100% 조건

- Meta/organic/youtube별 purchased vs dropped 비교가 가능하다.
- 평균뿐 아니라 median/p75가 나온다.
- sample size 부족 지표는 제외된다.
- source별 CAPI 성공이 unique order 기준으로 닫히기 전에는 전환율로 표시하지 않는다.

### 역할 구분

- Codex: cohort dry-run.
- Claude Code: 프론트엔드 화면 개발.
- TJ님: YouTube UTM naming rule이 필요하면 광고/콘텐츠 URL 기준 제공.

## Phase2-Sprint1

**이름**: 체류시간/스크롤/회원가입 지표를 만든다

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

구매 전 몰입 행동을 숫자로 만든다.

### 왜 하는가

“좋은 콘텐츠 같다”는 말은 실행 지표가 아니다.
`리뷰 랜딩 50% 스크롤 도달률`, `Meta 유입 구매자 median 체류시간`, `회원가입 후 24시간 내 결제 시작률`처럼 바꿀 수 있는 숫자로 만들어야 한다.

### 어떻게 하는가

1. GA4에서 dwell/scroll 후보를 읽는다.
2. VM Cloud에서 장바구니/결제 시작/결제완료를 읽는다.
3. 회원가입 source는 GTM/GA4/VM Cloud no-send route를 분리한다.
4. 구매율 lift를 계산한다.

### 개발 계획

완료된 것:

1. [Codex] dwell/scroll feature aggregate dry-run을 만들었다.
   - 무엇: 채널별 체류시간과 스크롤 깊이를 계산한다.
   - 왜: 구매자와 이탈자의 몰입 차이를 보기 위해서다.
   - 어떻게: GA4 engagement source를 read-only로 조회하고 VM Cloud confirmed purchase/CAPI aggregate와 site별로 대조했다.
   - 산출물: `project/ga4-dwell-scroll-join-dry-run-20260517.md`
   - 검증: source/window/freshness/confidence가 붙었다. 바이오컴/더클린커피가 분리됐다.
   - 현재 한계: 같은 unique order 모집단으로 닫히지 않았으므로 source별 구매율이나 구매 lift는 아직 계산하지 않았다.

2. [Codex] row-level join key presence audit를 만들었다.
   - 무엇: GA4 세션과 VM Cloud 결제 row가 같은 흐름으로 이어질 수 있는지 확인한다.
   - 왜: 같은 주문/같은 세션 기준이 닫혀야 구매자와 이탈자의 체류시간 차이를 말할 수 있다.
   - 어떻게: raw id 없이 join key 존재율, join 가능 row 수, 미조인 이유만 집계했다.
   - 결과: 더클린커피는 GA4 purchase가 있는데 begin_checkout/add_payment_info가 0이다. 이는 checkout 부재가 아니라 GA4 중간 이벤트 계측 gap이다.
   - 산출물: `project/ga4-vm-join-key-and-coffee-gap-20260517.md`
   - 검증: site별로 분리했고, 더클린커피는 GA4 중간 이벤트 대신 VM Cloud payment_started를 결제 단계 primary로 써야 한다는 판단을 남겼다.

3. [Codex] 더클린커피 GA4 중간 이벤트 보강 설계를 작성했다.
   - 무엇: 더클린커피에 필요한 GA4 `view_cart`, `begin_checkout`, `add_payment_info` 보강 경로를 정리했다.
   - 왜: 더클린커피는 GA4 purchase는 있지만 begin_checkout/add_payment_info가 0이라, 구매 전 어떤 행동이 매출을 예고하는지 GA4만으로 볼 수 없기 때문이다.
   - 어떻게: Google 공식 GA4 recommended ecommerce event 문서와 VM Cloud safe bridge 결과를 기준으로, purchase는 건드리지 않고 중간 이벤트만 test-only로 보강하는 순서를 만들었다.
   - 산출물: `project/coffee-ga4-middle-event-enhancement-design-20260517.md`, `data/project/coffee-ga4-middle-event-enhancement-design-20260517.json`
   - 검증: GA4/Meta/Google Ads/TikTok/Naver send 0, GTM publish 0, Imweb header/footer save 0.
   - gpt-5.5 pro web feedback: `add_payment_info`는 단순 결제수단 노출이 아니라 결제정보 제출 또는 결제수단 선택이 확실히 확인된 시점으로 제한한다. 새 중간 이벤트의 value는 행동 참고값이며 실제 매출 정본처럼 표시하지 않는다.

남은 것:

1. [Codex] signup funnel feature를 설계한다.
   - 무엇: 회원가입 완료와 구매 전 행동의 관계를 계산한다.
   - 왜: 가입이 실제 구매 선행 행동인지 확인하기 위해서다.
   - 어떻게: GTM sign_up source를 VM Cloud no-send route와 연결하는 설계를 쓴다.
   - 산출물: signup funnel contract.
   - 검증: signup event는 Purchase 후보 0.
   - 의존성: no-send intermediate-event endpoint.

### 현재 진척률

현재 진척률: 82%.

### 100% 조건

- dwell/scroll/signup 지표가 채널별로 나온다.
- 구매율 lift와 모수가 같이 나온다.
- source gap이 명확히 분류된다.

### 역할 구분

- Codex: read-only 분석과 contract.
- Claude Code: 화면화.
- TJ님: GA4/GTM UI 권한 확인이 필요할 때만 지원.

## Phase2-Sprint2

**이름**: 선행지표 점수화와 실험 추천을 만든다

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

여러 후보 지표 중 오늘 바꿀 1~3개를 추천한다.

### 왜 하는가

지표가 많으면 팀이 움직이지 않는다.
선행지표는 행동으로 바뀌어야 의미가 있다.

### 어떻게 하는가

1. 구매율 lift를 계산한다.
2. 모수가 충분한지 본다.
3. 통제 가능성을 점수화한다.
4. health/wellness/추적 오염 리스크를 뺀다.
5. 다음 실험을 추천한다.

### 개발 계획

완료된 것:

1. [Codex] signal scoring formula를 로컬 backend에 구현했다.
   - 무엇: 후보 지표의 우선순위를 계산한다.
   - 왜: 대표가 “오늘 무엇을 바꿀지” 볼 수 있어야 한다.
   - 어떻게: 구매자와 비결제자 차이(lift), 표본 크기(volume), 수집 범위(confidence), 사람이 실제로 바꿀 수 있는 정도(controllability), 추적 오염 리스크(risk)를 합산한다.
   - 산출물: `backend/src/leadingIndicators.ts` Top 5 scoring 로직.
   - 검증: backend typecheck PASS, attribution test PASS, local API smoke PASS.
   - 의존성: Phase2-Sprint1 feature table.

2. [Codex] Top 5 후보에 사람이 읽을 수 있는 설명을 붙였다.
   - 무엇: `score`, `score_grade`, `score_components`, `next_action_ko`, `data_quality_note_ko`를 API 후보 필드에 추가했다.
   - 왜: 점수만 있으면 왜 1위인지 알기 어렵기 때문이다.
   - 어떻게: 각 지표별로 “왜 중요한가”, “바로 무엇을 바꿀 수 있는가”, “데이터가 얼마나 믿을 만한가”를 별도 문장으로 내려준다.
   - 검증: 로컬 smoke에서 `dwell_p50`, `scroll90_all_sessions_rate`, `begin_checkout_rate`, `review_reach_rate`, `page_view_long_rate`가 Top 5로 산출됐다.
   - 의존성: 없음.

3. [Codex] 로컬 프론트 카드 구조를 KPI 원칙에 맞게 보강했다.
   - 무엇: `/ai-crm/leading-indicators`에 프로젝트 OKR 패널, 액션플랜 3개, 레버지표/관리지표/진단지표 역할 배지, 후보별 공략집을 추가했다.
   - 왜: 선행지표는 숫자 자체보다 “그 숫자를 보면 사람이 어떤 행동을 해야 하는가”가 중요하기 때문이다.
   - 어떻게: Top 5 후보별로 무엇을 바꿀지, 어떻게 바꿀지, 왜 바꾸는지, 성공 기준을 카드 안에 표시한다.
   - 산출물: `frontend/src/app/ai-crm/leading-indicators/page.tsx`, `frontend/src/app/ai-crm/leading-indicators/page.module.css`
   - 검증: 변경 범위 targeted eslint와 local page smoke로 확인한다. 전체 frontend lint는 기존 다른 페이지 오류가 있어 별도 정리 대상이다.
   - 의존성: 없음.

남은 것:

1. [Codex] 운영 VM 화면에 KPI 카드 구조를 배포한다.
   - 무엇: 로컬에서 보강한 OKR/액션플랜/공략집 카드 구조를 `https://biocom.ainativeos.net/ai-crm/leading-indicators`에도 반영한다.
   - 왜: 실제 운영 판단은 VM 화면에서 보므로 로컬에서만 보이면 팀 운영 도구가 되지 못한다.
   - 어떻게: 프론트 build 후 VM 배포, 화면 smoke, API cache 상태 확인을 묶어 Yellow Lane 배포 패킷으로 진행한다.
   - 성공 기준: VM 화면에서 프로젝트 종합 진척률 77%, 액션플랜 3개, Top 5 공략집 카드가 보인다.
   - 의존성: 로컬 화면 최종 확인.

2. [Codex] Top 5 후보를 실제 실험 backlog와 연결한다.
   - 무엇: 각 후보 카드의 다음 행동을 “랜딩 문구 수정”, “리뷰 위치 테스트”, “결제 시작 UX 점검” 같은 실험 항목으로 연결한다.
   - 왜: 점수만 보고 끝나면 KPI가 행동을 바꾸지 못한다.
   - 어떻게: 후보 id별 experiment template을 만들고, 화면에는 “실험 만들기” 또는 “공략집 보기” 형태로 연결한다.
   - 성공 기준: Top 5 중 최소 1개가 실험 카드/문서로 이어진다.
   - 의존성: VM 화면 배포 후 권장.

### 현재 진척률

현재 진척률: 70%.

### 100% 조건

- 매일 Top 5 leading indicators가 나온다.
- 각 후보에 실험 액션과 성공 기준이 붙는다.
- ROAS/Purchase와 섞이지 않는다.

### 역할 구분

- Codex: scoring model.
- Claude Code: 화면 card와 drilldown.
- TJ님: 사업적으로 실행 가능한 실험을 선택.

## Phase3-Sprint1

**이름**: Meta CAPI로 보낼 중간 전환과 내부 관찰만 할 지표를 분리한다

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

구매 전 행동 중 Meta에 보내도 되는 신호와, VM Cloud 내부에서만 봐야 하는 신호를 나눈다.

쉽게 말하면 아래를 분리한다.

- Meta가 광고 학습에 써도 되는 행동: 회원가입 완료, 결제 시작, 장바구니, 결제수단 선택.
- 내부에서만 봐야 하는 행동: 50% 스크롤, 90초 체류, 리뷰 페이지 몰입.
- 아직 보내면 위험한 행동: 구매완료와 헷갈릴 수 있는 결제 페이지 진입, 민감한 건강 맥락이 드러나는 콘텐츠명.

### 왜 하는가

Meta 광고 성과를 높이려면 Purchase만 기다리지 말고 구매 전 신호도 학습에 줄 수 있어야 한다.
하지만 건강/웰빙 도메인에서는 아무 이벤트나 보내면 데이터 제한, 오분류, ROAS 오염 위험이 생긴다.

그래서 이 스프린트의 목표는 “많이 보내기”가 아니라 **보내도 되는 중간 전환만 안전하게 고르는 것**이다.

### 어떻게 하는가

1. VM Cloud에 no-send 중간 전환 수신 route를 둔다.
2. CompleteRegistration, AddToCart, InitiateCheckout, AddPaymentInfo를 각각 Purchase와 다른 event family로 저장한다.
3. Scroll50/Dwell90은 Meta 표준 이벤트가 아니므로 내부 선행지표로만 둔다.
4. Meta Test Events에서 1건씩 smoke할 수 있는 승인안을 만든다.
5. 운영 전송은 capiplan의 Red Lane 승인 전까지 하지 않는다.

### 개발 계획

1. [Codex] 중간 전환 event contract를 정리한다.
   - 무엇: 이벤트명, source, dedupe key, no-send flag, sensitive-field guard를 정의한다.
   - 왜: Purchase와 중간 신호가 섞이면 광고 학습과 내부 ROAS가 동시에 오염되기 때문이다.
   - 어떻게: VM Cloud ledger에는 `event_family=intermediate`, `purchase_candidate=false`를 강제하는 설계를 쓴다.
   - 산출물: intermediate event contract.
   - 검증: 중간 전환 row의 Purchase 후보 0.
   - 의존성: [[capivm/!capiplan]] Phase2-Sprint4/5.

2. [Codex] Meta Test Events staged plan을 만든다.
   - 무엇: CompleteRegistration부터 1건 test-only로 확인하는 절차를 만든다.
   - 왜: 운영 전송 전 Meta가 event_name, event_id, event_source_url, user_data를 어떻게 받는지 확인해야 한다.
   - 어떻게: 실제 운영 send 없이 Test Events code 또는 no-send dry-run으로 먼저 검증한다.
   - 산출물: test-only runbook.
   - 검증: Purchase count 증가 0, 중간 이벤트 수신만 확인.
   - 의존성: TJ님 Meta UI 확인 또는 Test Events code.

3. [Claude Code] 화면에는 “Meta로 보낼 후보”와 “내부 관찰만”을 분리해 표시한다.
   - 무엇: 한 화면에서 send 가능/보류/금지 지표를 색으로 나눈다.
   - 왜: 대표가 “이 지표는 광고 학습에 써도 되는지”를 바로 알아야 한다.
   - 어떻게: `Send 후보`, `내부 관찰`, `전송 금지` 세 그룹으로 표시한다.
   - 산출물: leading-indicators Meta send readiness panel.
   - 검증: Scroll50/Dwell90은 내부 관찰로만 보인다.
   - 의존성: backend contract.

### 현재 진척률

현재 진척률: 52%.

완료된 것:

- Purchase와 payment_page_seen을 분리하는 원칙이 capiplan에 있다.
- AddToCart / InitiateCheckout / AddPaymentInfo는 Block 4와 VM Cloud 설계 맥락이 있다.
- CompleteRegistration은 GTM source 후보로 확인 대상이 됐다.
- Scroll50/Dwell90은 Meta 표준 이벤트가 아니라 내부 선행지표 우선으로 분류했다.

남은 것:

- VM Cloud no-send intermediate receiver 정식 contract.
- CompleteRegistration source smoke.
- AddPaymentInfo source gap closure.
- Test Events runbook.
- 실제 Meta CAPI 중간 이벤트 운영 전송 승인.

### 100% 조건

- 중간 전환 4종의 source와 no-send guard가 문서/코드에서 일치한다.
- Purchase 후보 0이 자동 검증된다.
- Meta Test Events에서 1건 smoke 절차가 준비된다.
- Red 승인 전 운영 전송 0을 유지한다.

### 역할 구분

- Codex: contract, dry-run, approval packet.
- Claude Code: 화면화.
- TJ님: Meta UI Test Events 확인과 Red Lane 운영 send 승인.

## Meta CAPI 전송 판단

선행지표 중 일부는 Meta CAPI로 보낼 수 있다.
하지만 전부 보내면 안 된다.

우선순위:

1. `CompleteRegistration`
   - 회원가입 완료라 의미가 명확하다.
   - GTM source가 있다.
   - Purchase와 구분 가능하다.
2. `AddPaymentInfo`
   - 구매 직전 신호라 강하다.
   - 현재 VM Cloud source gap이 먼저 해결돼야 한다.
3. `AddToCart`
   - 구매 의도 신호다.
   - 장바구니 클릭과 페이지 진입을 구분해야 한다.
4. `InitiateCheckout`
   - 강한 신호다.
   - payment_page_seen과 섞이지 않게 해야 한다.
5. `Scroll50`
   - 표준 이벤트가 아니다.
   - 내부 분석으로 먼저 쓰고, custom event 전송은 보류한다.
6. `Dwell90`
   - 표준 이벤트가 아니다.
   - 내부 분석 우선이다.

## 다음 할일

### Auto Green

#### A1. source matrix를 만든다 — 완료

- 무엇: 선행지표별 데이터 source를 표준화한다.
- 왜: source가 닫히지 않으면 분석 신뢰도가 떨어진다.
- 어떻게: VM Cloud cached aggregate와 로컬 문서를 read-only로 대조했다.
- 산출물: `data/project/leading-indicator-p0-dry-run-20260517.json`, `project/leading-indicator-p0-dry-run-20260517.md`
- 성공 기준: 모든 지표에 primary/cross-check/fallback source가 붙는다. P0 기준 PASS.
- 실패 시 확인점: GA4 권한, VM Cloud event gap, GTM trigger 미연결은 Phase2에서 계속 확인.
- 담당: Codex.
- 승인 필요 여부: NO, Green.
- 의존성: 없음.
- 추천 점수/자신감: 96%.

#### A2. Meta 유입 구매자 vs 이탈자 dry-run을 만든다 — 부분 완료

- 무엇: Meta 유입 중 구매자와 이탈자의 체류시간/스크롤/결제 시작 차이를 계산한다.
- 왜: Meta 광고 예산을 늘릴지 줄일지 ROAS 후행값만 보면 늦다.
- 어떻게: P0에서는 VM Cloud aggregate source filter까지만 생성했다. 다음 단계에서 GA4 engagement와 safe session join을 붙인다.
- 산출물: `project/leading-indicator-p0-dry-run-20260517.md`
- 성공 기준: purchased vs dropped의 median dwell, scroll50 rate, checkout rate가 나온다. 현재는 aggregate baseline만 PASS.
- 실패 시 확인점: GA4 join key, source freshness, sample size 부족.
- 담당: Codex.
- 승인 필요 여부: NO, Green.
- 의존성: A1 source matrix.
- 추천 점수/자신감: 82%.

#### A3. 로컬 프론트 화면을 최신 상태로 확인한다 — 완료

- 무엇: 구매 전 선행지표 화면을 `/ai-crm/leading-indicators` 로컬 프론트에 구현했다.
- 왜: 대표가 dry-run 문서를 열지 않고도 구매자/이탈자, 채널, 랜딩, 캠페인 기준 선행지표를 화면에서 확인해야 하기 때문이다.
- 어떻게: live API 계약에 맞춰 화면을 만들고, precompute cache가 꺼진 상태에서는 live cache miss임을 표시하는 구조로 둔다.
- 산출물: `frontend/src/app/ai-crm/leading-indicators/page.tsx`, `frontend/src/app/ai-crm/leading-indicators/page.module.css`, `project/!indicatoragent-frontend.md`
- 성공 기준: 로컬 화면이 build 대상에 포함되고, API가 `schema_version=leading-indicators-v1` 응답을 반환한다.
- 실패 시 확인점: precompute OFF 상태의 첫 응답 지연, 바이오컴 Meta cohort 0, GA4/VM Cloud join source gap.
- 담당: Codex.
- 승인 필요 여부: NO, Green. 운영 배포는 별도 Yellow.
- 의존성: P1 live aggregate endpoint.
- 추천 점수/자신감: 90%.

### Approval Needed

#### B1. Leading Indicator precompute cache 2시간 smoke ON

- 무엇: 선행지표 API가 요청 때마다 계산하지 않도록 30분 주기 사전 계산 cache를 2시간 제한으로 켠다.
- 왜: 프론트가 live API를 직접 읽을 때 첫 응답 지연을 줄이고, 화면 기준 시각을 안정화해야 한다.
- 어떻게: `LEADING_INDICATORS_PRECOMPUTE_ENABLED=1`, `LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000`으로 제한 smoke 후 API 200, cache hit, memory/CPU/event-loop를 본다.
- 성공 기준: cache hit 500ms 이하, health 200, failed tick 0, backend restart 추가 없음, raw identifier output 0.
- 실패 시 확인점: PM2 env, precompute tick log, VM Cloud memory, endpoint query timeout.
- 담당: Codex + TJ님.
- 승인 필요 여부: Yellow. 상시 ON은 smoke 후 별도 판단.
- 의존성: `project/leading-indicator-precompute-cache-on-approval-20260519.md` 승인.
- 추천 점수/자신감: 86%.

#### B2. GTM Preview 또는 VM Cloud no-send endpoint 배포

- 무엇: 회원가입/스크롤/결제수단 선택을 VM Cloud no-send receiver로 저장하는 제한 테스트다.
- 왜: 현재 source gap이 있는 지표는 저장 경로가 없으면 분석할 수 없다.
- 어떻게: Production publish 없이 preview 또는 VM Cloud Yellow deploy로 endpoint만 확인한다.
- 성공 기준: VM Cloud에 중간 이벤트 row가 저장되고 Meta send는 0.
- 실패 시 확인점: CORS, trigger 조건, endpoint schema, raw identifier mask.
- 담당: Codex + TJ님.
- 승인 필요 여부: VM Cloud deploy는 Yellow, GTM Production publish는 Red.
- 의존성: A1 source matrix와 endpoint patch.
- 추천 점수/자신감: 78%.

### Blocked/Parked

#### C1. Scroll50 / Dwell90 운영 Meta CAPI 전송

- 무엇: Scroll50이나 Dwell90을 Meta CAPI custom event로 운영 전송하는 일이다.
- 왜 보류하는가: 두 지표는 구매와 거리가 있고, health/wellness 제한 및 오염 리스크가 있다.
- 재개 조건: 내부 분석에서 purchase lift가 충분하고, Test Events smoke와 data minimization이 PASS해야 한다.
- 담당: TJ님 승인 + Codex 실행.
- 승인 필요 여부: Red.
- 추천 점수/자신감: 지금 실행 30%, 내부 분석 90%.

## 검증 기준

이 문서는 설계 문서다.
실제 전송, publish, deploy는 하지 않는다.

문서 저장 후 검증:

```bash
python3 scripts/validate_wiki_links.py project/!indicatoragent.md
python3 scripts/harness-preflight-check.py --strict
git diff --check -- project/!indicatoragent.md
```

## 참고 source

- Meta Conversions API server event parameters: `event_name`은 표준 이벤트 또는 커스텀 이벤트 이름을 사용할 수 있고, browser/server dedup에는 `event_name`과 `event_id`가 같이 쓰인다.
- 내부 문서: [[capivm/!capiplan]]
- 내부 문서: [[data/!channelfunnel]]
- 내부 문서: [[GA4/gtm]]
