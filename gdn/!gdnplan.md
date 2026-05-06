# Google Ads ROAS 정합성 체크 및 개선 계획

작성 시각: 2026-04-23 12:12 KST
최근 업데이트: 2026-05-06 11:20 KST
기준일: 2026-04-23
버전: v1.9-campaign-signal-audit
문서 성격: 로드맵

## 10초 요약

이 문서는 Google Ads, 특히 GDN(구글 디스플레이 네트워크) 성과를 광고 관리자 숫자 그대로 믿어도 되는지 확인하고, 내부 확정매출 기준 ROAS로 맞추는 계획이다.
현재 결론은 `광고 전체를 즉시 끄기`보다는 `증액 중지 + 측정 신호 교체 + 제한적 감액 검토`가 맞다는 점이다.
2026-05-05 재조회 기준 Google Ads 최근 7일 ROAS는 `15.33x`로 보이지만, 이 값은 내부 confirmed 매출 기준 ROAS로 쓰면 안 된다.
차이의 1순위 원인은 Primary 전환 액션 `구매완료`다. 이름은 구매완료지만 실제 label은 아임웹 자동 NPay count 경로 `AW-304339096/r0vuCKvy-8caEJixj5EB`와 일치하고, 최근 7일 Google `Conv. value` `66,464,810.58원`을 만든다.
오염 구조 상세 리포트는 [[google-ads-npay-purchase-contamination-report-20260505]]에 기록했다.
유입 품질과 감액 판단은 [[google-ads-npay-quality-deep-dive-20260505]]에 기록했다.
전환 액션 변경 승인안은 [[google-ads-purchase-primary-change-approval-20260505]]에 기록했다.
실제 결제완료 주문만 Google Ads 구매로 알려주는 새 전환 통로 실행 승인안은 [[google-ads-confirmed-purchase-execution-approval-20260505]]에 분리했다.
`NPay가 나쁘다`가 아니라 `NPay 클릭/count를 구매완료로 학습시키는 것이 위험하다`는 피드백 반영 계획과 read-only leakage 분석은 [[google-ads-npay-feedback-execution-plan-20260505]]에 기록했다.
캠페인별 신호 감사와 NPay 변경 시점 확인은 [[google-ads-campaign-signal-audit-20260505]]에 기록했다.
운영 DB, Attribution VM, GA4 BigQuery를 조인한 confirmed purchase no-send 확장 결과와 파이프라인 설계는 [[google-ads-confirmed-purchase-operational-dry-run-20260505]]에 기록했다.
Google click id 보존률 개선 설계는 [[google-click-id-preservation-plan-20260505]]에 기록했다.
confirmed_purchase no-send 수신·디스패처 계약은 [[confirmed-purchase-no-send-pipeline-contract-20260505]]에 기록했다.
paid_click_intent GTM Preview 승인안은 [[paid-click-intent-gtm-preview-approval-20260506]]에 기록했다.
paid_click_intent는 결제완료 주문 후보와 섞지 않도록 별도 `POST /api/attribution/paid-click-intent/no-send` preview route로 분리했다.
Google Ads/NPay/confirmed purchase 용어 정본은 [[../ontology/!ontology|Attribution Ontology Lite]]를 따른다.
이 문서에서 Google Ads 값은 `platform_reference_roas`, 내부 장부 기준 값은 `internal_confirmed_roas`로 구분한다.
GA4 raw 기준 최근 7일 Google Ads 유입은 Meta보다 체류시간과 90% 스크롤 도달률은 높지만, NPay 클릭 비율이 `8.39%`로 Meta `0.11%`보다 훨씬 높고 홈페이지 purchase는 `4건 / 336,917원`뿐이다.
추가 leakage 분석에서는 Google Ads 최근 7일 일반 결제 시작 136세션 중 132세션이 GA4 purchase로 닫히지 않았고, NPay 클릭 577세션은 GA4 안에서 NPay형 purchase로 확인되지 않았다. 단, 이 값은 GA4 이벤트 기준이며 NPay 실제 결제완료 여부는 운영 DB/아임웹 주문 조인이 필요하다.
2026-05-05 09:32 KST 추가 확인으로, GA4/GTM NPay click-as-purchase는 `2026-04-24 23:45 KST` live v138 이후 사실상 제거됐다.
하지만 Google Ads primary `구매완료` NPay value는 v138 이후에도 매일 계속 발생해 Google Ads 쪽 신호는 아직 결제완료 기준으로 바뀌지 않았다.
다음 행동은 이 `구매완료` 액션을 바로 바꾸는 것이 아니다. 먼저 `gclid/gbraid/wbraid` 보존률을 올리고, confirmed 주문 기반의 별도 purchase 전환 payload를 no-send로 안정화한 뒤 Red Lane 승인 문서로 전환 액션 변경 여부를 결정한다.
2026-05-06 최신 no-send 재실행 기준 운영 결제완료 주문은 623건이고, Google click id가 남은 주문은 5건, 전체 보존률은 0.8%다. `imweb_operational`은 fresh로 복구됐고 source lag는 6.5시간이다.
여기서 핵심은 NPay 매출을 빼는 것이 아니다. 홈페이지 구매하기 결제완료와 NPay 실제 결제완료 주문은 모두 구매 매출에 포함해야 하고, 제외해야 하는 것은 NPay 클릭 또는 결제 시작을 구매완료로 세는 구조다.

2026-05-03에 `harness/gdn/` v0 기준판을 추가했다.
앞으로 Google Ads/GDN 작업은 [[harness/gdn/README|GDN Harness]]를 먼저 읽고, read-only/dry-run/approval gate를 분리해서 진행한다.
공통 하네스 정본은 `harness/common/HARNESS_GUIDELINES.md`, `harness/common/AUTONOMY_POLICY.md`, `harness/common/REPORTING_TEMPLATE.md`이며, 이 문서는 정본을 복사하지 않고 GDN 프로젝트 계획만 기록한다.
Codex는 Green Lane인 API 재조회, gap 분해, 승인안 작성까지 자율 진행할 수 있고, Google Ads 전환 액션 변경과 conversion upload는 Red Lane으로 멈춘다.

쉬운 비유로 말하면, Google Ads 성적표와 실제 통장 입금 장부를 한 줄씩 대조하는 일이다.
GDN은 광고를 본 뒤 나중에 산 사람도 잡을 수 있어서, 클릭해서 산 사람과 보고만 산 사람을 반드시 나눠야 한다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | 기준과 원천 고정 | Codex | 90% / 70% | [[#Phase0-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | Google Ads 전환 액션 실사 | TJ + Codex | 90% / 80% | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | GTM/GA4 구매 태그 정합성 확인 | Codex + Claude Code | 45% / 25% | [[#Phase1-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | 결제수단별 이벤트 대조 | TJ + Codex + Claude Code | 40% / 20% | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | 플랫폼 ROAS와 내부 ROAS 비교표 | Codex | 88% / 60% | [[#Phase3-Sprint5\|이동]] |
| Phase4 | [[#Phase4-Sprint6]] | 전환 오염 제거와 보정 | TJ + Codex + Claude Code | 32% / 0% | [[#Phase4-Sprint6\|이동]] |
| Phase5 | [[#Phase5-Sprint7]] | 운영 판단 룰 고정 | TJ + Codex | 25% / 10% | [[#Phase5-Sprint7\|이동]] |

## 문서 목적

이 문서는 Google Ads ROAS가 실제 확정매출과 얼마나 맞는지 확인하고, GDN 예산 판단에 쓸 운영 기준을 고정한다.

## 이 작업이 하는 일

이 작업은 `Google Ads 광고 노출/클릭 -> 사이트 방문 -> 주문 생성 -> 결제 확정 -> 취소/환불`을 한 줄로 이어 본다.
광고 관리자가 말하는 전환값과 내부 원장이 말하는 확정매출을 같은 날짜, 같은 캠페인, 같은 주문 기준으로 맞춘다.

## 왜 필요한가

Google Ads는 전환값이 있어야 ROAS 입찰과 전환가치 최적화가 의미 있다.
하지만 구매 버튼 클릭, 가상계좌 미입금, NPay 결제완료 리턴 누락, 중복 purchase 태그가 섞이면 Google Ads가 실제 매출이 아닌 신호로 학습한다.
GDN은 조회 후 전환(view-through conversion)도 중요한 보조 신호라서, 클릭 기반 ROAS와 조회 기반 보조성과를 분리하지 않으면 예산 판단이 흔들린다.

## 프로젝트 구조 파악 결과

| 위치 | 역할 | 이번 문서에서 쓰는 방식 |
|---|---|---|
| `backend/` | Express + TypeScript API, GA4 Data API, GTM audit, attribution 원장 조회 | Google Ads/GDN 대조 스크립트와 내부 confirmed 매출 계산 후보 |
| `frontend/` | Next.js 대시보드, 로컬 포트 7010 | `/ads/google`에 Google Ads API live 광고성과 화면과 CSV fallback 추가 |
| `data/` | 정합성 계획, ROAS 증거, CSV/JSON 산출물 | 내부 매출 기준과 과거 ROAS 증거 참조 |
| `GA4/` | GTM/GA4 검증 문서, NPay 누락과 purchase 오염 추적 | Google Ads 구매 태그가 물려 있는 GA4 이벤트 품질 근거 |
| `tiktok/` | TikTok ROAS 정합성 로드맵 | 플랫폼 ROAS와 내부 confirmed ROAS를 분리하는 선례 |
| `gtmaudit/` | GTM API snapshot JSON | Google Ads 태그와 전환 라벨 정적 점검 근거 |
| `footer/` | 아임웹 삽입 코드와 자동 마케팅 코드 기록 | Google Ads 자동 NPay trace와 GTM 경로 중복 확인 |
| `harness/gdn/` | Google Ads/GDN ROAS 하네스 기준판 | Green/Yellow/Red Lane, no-send/no-write, 승인 게이트, auditor 기준 |

## 현재 상태

### 운영 판단 메모

2026-04-25 23:34 KST 기준 결론은 `광고 전체 OFF`가 아니다.
지금 바로 해야 할 일은 `증액 중지`, `Google ROAS 신뢰 중지`, `오염된 Primary 전환 교체`, `예산 방어선 설정`이다.

광고를 바로 꺼야 한다고 단정하기에는 아직 이르다.
이유는 현재 데이터가 `광고 자체가 매출을 못 만든다`를 증명한 것이 아니라, `Google Ads가 학습하고 보고하는 구매 신호가 실제 입금 장부와 다르다`를 증명했기 때문이다.
즉 매체 성과 문제와 측정 문제를 분리해야 한다.

#### 지금 충분히 확인된 것

| 판단 | 결론 | 근거 | confidence |
|---|---|---|---|
| Google Ads ROAS를 그대로 믿어도 되는가 | 아니다 | 플랫폼 ROAS `5.07x`, 내부 confirmed ROAS `0.30x` | high |
| 차이의 1순위 원인이 무엇인가 | Primary `구매완료` NPay label | `구매완료` action `7130249515` label `r0vu...`가 아임웹 NPay count와 일치, `Conv. value` `129,954,631원` 생성 | high |
| `All conv. value`를 운영 판단에 써도 되는가 | 쓰면 안 된다 | Secondary `TechSol - NPAY구매 50739`가 `All conv. value` `81,758,081원` 추가 | high |
| 현재 자동입찰 학습 신호가 좋은가 | 나쁘다 | 실제 confirmed purchase가 아니라 NPay count/클릭성 신호가 purchase로 들어갈 가능성이 큼 | high |
| 내부 confirmed 기준으로 증액 가능한가 | 아니다 | 최근 30일 내부 confirmed ROAS `0.30x` | medium-high |
| GA4/GTM NPay 클릭 구매 오염은 언제 줄었는가 | `2026-04-24 23:45 KST` v138 이후 | BigQuery raw에서 `2026-04-25`부터 NPay purchase-like가 0으로 떨어짐 | high |
| Google Ads도 결제완료 기준으로 바뀌었는가 | 아니다 | v138 이후에도 primary `구매완료` NPay value가 매일 발생 | high |

#### 아직 부족한 것

| 부족한 데이터 | 왜 중요한가 | 다음 확인 |
|---|---|---|
| 광고 자체의 증분 효과 | 측정 신호가 틀렸다고 광고 매출이 0이라는 뜻은 아니다 | campaign holdout 또는 예산 제한 후 매출/유입 변화 관찰 |
| 주문 단위 Google conversion 매칭 | Google 전환 1,032건이 실제 어떤 주문/클릭인지 아직 직접 묶이지 않았다 | gclid/gbraid/wbraid, transaction_id, order_id 기준 조인 |
| current campaign과 내부 campaign ID mismatch | 내부 원장에는 과거 또는 다른 계정으로 보이는 campaign ID가 많다 | landing URL, UTM, campaign lookup, 과거 export 대조 |
| NPay 실제 결제 비중과 누락 구조 | NPay가 매출에 작게라도 기여하면 단순 제거가 위험할 수 있다 | NPay 비중, return URL, server-side 보정 검토 |
| 전환 교체 후 학습 회복 기간 | 전환 액션을 바꾸면 Google 자동입찰 학습이 흔들릴 수 있다 | 7~14일 관찰 계획 |

#### 운영 결론

1. Google Ads 전체 OFF는 아직 이르다.
2. Google Ads 증액은 즉시 중지한다.
3. Google Ads 화면의 `ROAS`, `Conv. value`, `All conv. value`는 예산 증액 근거로 쓰지 않는다.
4. 검색 의도가 강한 캠페인, 예를 들면 브랜드/검사권 검색 캠페인은 바로 끄지 말고 낮은 위험으로 관찰한다.
5. PMax/GDN/PM 계열은 내부 confirmed 매출과 직접 매칭되지 않으므로 증액 금지다. 현금 소진이 부담이면 임시로 30~50% 감액 또는 7일 pause test를 검토한다.
6. 전환 신호를 고치기 전까지 Google 자동입찰은 실제 구매자를 학습한다고 보기 어렵다.
7. `검색 의도 캠페인`은 트래픽 캠페인이라는 뜻이 아니다. 사용자가 검색어로 이미 의도를 드러낸 Search 캠페인이라는 뜻이며, PM/PMax와 분리해 소액 cap으로 봐야 한다.

#### 사람이 이해하는 설명

Google Ads에는 `전환 액션`이라는 채점 항목이 있다.
예를 들어 `구매완료`, `회원가입`, `장바구니`, `NPay구매` 같은 항목이다.

그중 `Primary`는 Google Ads가 성적표와 자동입찰 학습에 쓰는 핵심 점수다.
Primary로 잡힌 액션은 Google이 "이 사람이 진짜 목표 행동을 했다"고 보고, 비슷한 사람에게 더 많은 광고비를 쓰도록 학습한다.

`Secondary`는 참고용이다.
보고서의 `All conversions`에는 보일 수 있지만, 기본 입찰 학습의 핵심 목표로는 쓰지 않는다.

현재 문제는 `구매완료`라는 이름의 Primary 액션이 실제 입금 완료 장부가 아니라 아임웹 NPay count label과 연결되어 있다는 점이다.
쉬운 말로 하면, Google에게 "통장 입금 완료"를 가르쳐야 하는데 지금은 "NPay 쪽 구매 신호가 찍힘"을 통장 입금처럼 가르친 상태다.

`구매완료 action 7130249515를 purchase primary에서 내린다`는 말은 이 뜻이다.
Google에게 "이 신호를 더 이상 진짜 구매 성적표와 자동입찰 학습의 중심으로 쓰지 말라"고 바꾸는 것이다.
삭제한다는 뜻이 아니다.
필요하면 참고용으로 남기되, 예산을 늘리는 근거와 자동입찰 학습 목표에서 빼는 것이다.

`confirmed 주문 기반 purchase 전환을 새로 만든다`는 말은 이 뜻이다.
우리 내부 장부에서 실제 결제 완료가 확인된 주문만 Google Ads에 구매로 알려주는 새 통로를 만든다.
주문번호, 결제금액, 결제시각, 가능하면 `gclid/gbraid/wbraid` 같은 광고 클릭 식별자를 붙여서 보낸다.
그러면 Google은 버튼 클릭이나 NPay count가 아니라 실제 돈이 들어온 주문을 학습한다.

2026-05-05 11:40 KST 기준 이 실행 승인안은 [[google-ads-confirmed-purchase-execution-approval-20260505]]로 분리했다.
이 문서에서는 `offline conversion import`라는 기술어를 먼저 쓰지 않고, `Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 전환 통로`로 설명한다.
Data Manager API는 Google 공식 문서상 신규 offline conversion workflow 권장 경로라 장기 1순위 후보로 두고, 기존 Google Ads API `ConversionUploadService`는 fallback 후보로 둔다.

#### 추천 운영안

| 선택지 | 지금 판단 | 이유 |
|---|---|---|
| 광고 전체 OFF | 보류 | 측정 신호 오염은 확정이지만 광고 자체의 증분 효과는 아직 미확정 |
| 증액 | 금지 | 현재 ROAS 분자가 오염되어 증액 근거가 없다 |
| 유지 | 제한적 허용 | 검색 의도가 강한 캠페인은 즉시 중단보다 관찰이 안전 |
| 20~30% 감액 | 조건부 검토 | PMax/GDN이 현금 소진 부담이면 임시 방어선으로 가능 |
| 전환 액션 교체 | 1순위 | 현재 자동입찰 학습 신호를 고쳐야 이후 판단이 가능 |
| confirmed purchase 전환 신설 | 1순위 | 실제 입금 장부와 Google 학습 신호를 맞추는 핵심 조치 |

#### 7일 계획

1. Day 0: Google Ads UI에서 `구매완료` action `7130249515`의 label, Primary 여부, 계정 기본 목표 포함 여부를 확인한다.
2. Day 0: 증액을 중지하고, Google Ads ROAS 기반 의사결정을 중단한다.
3. Day 1: 최신 GTM live snapshot을 떠서 `r0vu...`, `3yj...`가 어디서 발사되는지 다시 확인한다.
4. Day 1~2: confirmed purchase 전환 경로를 결정한다. 후보는 `shop_payment_complete` client-side 전환 또는 server-side offline conversion import다.
5. Day 2~3: 새 전환을 병렬로 붙이고, 기존 NPay count 전환은 Primary에서 제외할 변경안을 확정한다.
6. Day 3~7: Google Ads 플랫폼 전환값, 내부 confirmed 매출, NPay 주문, campaign ID 매칭률을 매일 본다.
7. Day 7: 내부 confirmed ROAS와 매출 추이를 보고 유지, 감액, 중단을 다시 결정한다.

### 2026-05-05 캠페인별 신호 감사 결과

자세한 근거는 [[google-ads-campaign-signal-audit-20260505]]에 있다.

최근 14일 Google Ads `Conv. value`는 `123,495,273원`이고, primary NPay label value는 `123,495,262원`이다.
즉 플랫폼 ROAS 분자는 사실상 전부 `구매완료` NPay label에서 나온다.

| 캠페인 | 상태 | 채널 | 입찰 | 최근 14일 비용 | 최근 14일 Conv. value | primary NPay 비중 | 운영 판단 |
|---|---|---|---|---:|---:|---:|---|
| `[PM]검사권 실적최대화` | ENABLED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 3,418,001원 | 53,158,638원 | 100% | 감액 또는 7일 pause test 후보 |
| `[PM]건기식 실적최대화` | ENABLED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 4,184,674원 | 41,669,299원 | 100% | 감액 또는 7일 pause test 후보 |
| `[PM] 이벤트` | PAUSED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 2,820,144원 | 27,338,330원 | 100% | 재개 금지 후보 |
| `[SA]바이오컴 검사권` | ENABLED | SEARCH | MAXIMIZE_CONVERSIONS | 693,721원 | 1,329,006원 | 100% | 소액 cap 유지 후 주문 조인 |

`[SA]바이오컴 검사권`을 검색 의도 캠페인이라고 부르는 이유는 `SEARCH` 채널이기 때문이다.
검색 의도 캠페인은 "전환 없이 트래픽만 받는 캠페인"이 아니다.
사용자가 먼저 관련 키워드를 검색했고, 광고는 그 수요를 받는 구조다.
그래서 PM/PMax처럼 즉시 같은 비율로 끄기보다 검색어, 랜딩, 내부 confirmed order 조인을 먼저 봐야 한다.

#### Google Ads confirmed purchase 설계 판단

공식 Google Ads 기준상 primary 전환은 `Conversions` 보고와 입찰에 쓰일 수 있다.
따라서 기존 `구매완료` NPay label을 그대로 primary로 두는 것은 위험하다.

권장 설계는 아래 순서다.

1. 새 Google Ads confirmed purchase conversion action을 만든다.
2. 처음에는 Secondary 또는 observation으로 받는다.
3. Imweb/Toss/NPay confirmed order 기준으로만 value를 만든다.
4. 랜딩 또는 체크아웃 시점에 `gclid`, `gbraid`, `wbraid`를 저장한다.
5. Data Manager API 또는 Google Ads API offline conversion import를 no-send dry-run으로 먼저 검증한다.
6. 검증 후 기존 `구매완료` action `7130249515`를 Secondary로 낮춘다.

체류시간/스크롤 같은 engagement는 Google Ads purchase primary로 쓰지 않는다.
이 값은 매출이 아니라 관심도이므로, GA4 audience, secondary micro-conversion, 내부 `ProductEngagementSummary` 분석 장부로만 시작한다.

### 2026-05-05 실행 승인 문서 분리 결과

자세한 승인안은 [[google-ads-confirmed-purchase-execution-approval-20260505]]에 있다.

핵심은 아래다.

| 항목 | 결론 |
|---|---|
| 새 정본 구매 신호 | `BI confirmed_purchase` 후보 |
| 포함할 매출 | 홈페이지 구매하기 결제완료, NPay 실제 결제완료 주문 |
| 제외할 신호 | NPay 클릭, NPay 결제 시작, add_payment_info만 있는 row |
| 장기 권장 경로 | Google Data Manager API |
| fallback 경로 | Google Ads API `ConversionUploadService` |
| 사전 검증 | `backend/scripts/google-ads-confirmed-purchase-dry-run.ts`, `data/google-ads-confirmed-purchase-dry-run-20260505-local.json`, `send_candidate=N` 기본값 |
| 실제 실행 | Red Lane. TJ님 명시 승인 전 금지 |

로컬 no-send dry-run 1차 결과는 참고용이다.
로컬 attribution ledger는 `2026-04-12 13:13 KST`까지라 최신 정본이 아니다.
다만 529건 중 Google click id가 붙은 후보는 13건뿐이어서, 실제 실행 전 랜딩/체크아웃 시점 `gclid/gbraid/wbraid` 보존률이 핵심 병목임을 확인했다.

### 2026-05-05 NPay 피드백 반영 계획

자세한 계획과 read-only 산출물은 [[google-ads-npay-feedback-execution-plan-20260505]]에 있다.

핵심 표현을 아래처럼 고정한다.

```text
틀린 표현: NPay가 나쁘다.
맞는 표현: NPay 클릭/count를 구매완료로 학습시키는 것이 위험하다.
맞는 운영 기준: NPay 실제 결제완료 주문은 구매 매출에 포함하고, NPay 클릭/결제 시작은 purchase에서 제외한다.
```

이번에 진행한 Green Lane 작업은 두 가지다.

1. `/ads/google` 화면에 `NPay 해석 기준` 설명 카드를 추가했다.
2. GA4 BigQuery read-only 스크립트에 leakage 버킷을 추가했다.
3. `POST /api/attribution/engagement-intent` 로컬 no-write route를 추가했다. 이 route는 체류시간/스크롤을 내부 분석 preview로만 받고, `wouldStore=false`로 응답한다.

최근 7일 GA4 BigQuery 기준으로 Google Ads 유입은 아래처럼 보인다.

| 항목 | Google Ads | Meta | 해석 |
|---|---:|---:|---|
| 세션 | 6,879 | 23,544 | Google sample 충분 |
| 평균 체류 | 36.41초 | 14.67초 | Google 유입이 무조건 저품질이라는 증거는 아님 |
| 90% 스크롤 | 1,744 / 25.35% | 3,049 / 12.95% | Google 유입은 깊게 읽는 비율이 높음 |
| 일반 결제 시작 | 136 / 1.98% | 337 / 1.43% | 결제 단계 진입도 Google이 낮지 않음 |
| 결제 시작 후 GA4 purchase 없음 | 132 / 97.06% | 139 / 41.25% | Google은 결제 시작 후 완료 추적 또는 실제 완료 전환이 크게 약함 |
| NPay 클릭 | 577 / 8.39% | 26 / 0.11% | Google은 NPay 쪽으로 많이 새는 구조 |
| 홈페이지 purchase | 4건 / 336,917원 | 199건 / 60,799,430원 | Google의 자사몰 완료는 적지만 0은 아님 |

주의:

- 위 표의 `NPay 클릭 후 GA4 NPay형 purchase 없음`은 GA4 이벤트 기준이다.
- NPay 실제 결제완료는 운영 DB/아임웹 confirmed 주문과 조인해야 확정된다.
- 따라서 다음 단계는 `운영 DB + TJ 관리 Attribution VM + GA4 BigQuery` 주문 단위 no-send 조인이다.

다음 개발 순서:

1. `backend/scripts/bi-confirmed-purchase-operational-dry-run.ts`로 운영 source 조인형 no-send dry-run을 확장했다. 2026-04-27~2026-05-05 주문 623건, NPay 실제 결제완료 37건, 실제 전송 후보 0건으로 산출됐다.
2. `backend/scripts/google-click-id-preservation-diagnostics.ts`로 Google click id 보존률을 진단했다. 운영 결제완료 주문 623건 중 `gclid/gbraid/wbraid`가 붙은 주문은 5건, 전체 보존률은 0.8%다. 주문 evidence 기준 Google 후보는 10건이고 이 중 5건에 click id가 남았다.
3. `POST /api/attribution/confirmed-purchase/no-send` local preview route와 [[confirmed-purchase-no-send-pipeline-contract-20260505]]를 만들었다. 홈페이지 결제완료와 NPay 실제 결제완료만 purchase 후보로 받고, NPay click/count/payment start는 차단한다.
4. `backend/scripts/confirmed-purchase-no-send-route-sample.ts`로 운영 주문 20건과 NPay click control 1건을 route에 넣어 no-send/no-write/no-platform-send를 확인했다. 산출물은 [[../data/confirmed-purchase-no-send-route-sample-20260506]]이다.
5. 다음은 [[paid-click-intent-gtm-preview-approval-20260506]] 기준 GTM Preview 실행 여부 판단이다. 목표는 랜딩/체크아웃 시점 `gclid/gbraid/wbraid`가 storage와 `POST /api/attribution/paid-click-intent/no-send`까지 이어지는지 보는 것이다. 이 단계도 실제 platform send는 0건이어야 한다.
6. Preview에서는 `TEST_`, `DEBUG_`, `PREVIEW_` prefix click id를 사용할 수 있지만, live 후보에서는 항상 차단한다. 테스트 후 browser storage와 cookie를 삭제한다.
7. 위 2~6번이 통과한 뒤에만 Google Ads confirmed purchase Red Lane 실행 여부를 다시 판단한다.

### NPay 문서 검토 결과

검토 문서:

- `naver/npayfeedback.md`
- `naver/npayfeedbackreply.md`

결론은 두 문서가 현재 문제 해결에 직접 도움이 된다는 것이다.
다만 두 문서는 GA4 Measurement Protocol 중심이고, 지금 Google Ads 문제는 `Primary 전환 액션 오염`이 같이 얽혀 있다.
따라서 문서의 서버-사이드 추적 설계를 그대로 쓰되, Google Ads 쪽에는 별도 confirmed conversion 설계가 추가로 필요하다.

#### 공개 문서 조사 결과

2026-04-25 23:50 KST 기준 공개 문서로 확인한 결론은 다음과 같다.

| 항목 | 확인 결과 | 근거 | 판단 |
|---|---|---|---|
| 네이버페이 직접 연동 | `returnUrl`을 결제창 호출 파라미터로 줄 수 있다 | 네이버페이 개발자센터 FAQ와 결제형 독립몰 연동 개발 가이드 | 확정 |
| 네이버페이 return 동작 | 결제 완료 후 가맹점이 등록한 `returnUrl`과 파라미터로 리디렉션한다 | https://developers.pay.naver.com/support/faq, https://campaign-cdn.pstatic.net/filemanager/static/naverpay_guide/pdf/18_%EB%8F%85%EB%A6%BD%EB%AA%B0%20%EA%B2%B0%EC%A0%9C%ED%98%95%20%EC%97%B0%EB%8F%99%20%EA%B0%9C%EB%B0%9C%EA%B0%80%EC%9D%B4%EB%93%9C_713.pdf | 확정 |
| 아임웹 공개 개발자문서 | 주문 조회 API에서 `type=npay`, `pay_type=npay`, `status=PAY_COMPLETE`, `payment_amount`는 조회 가능하다 | https://old-developers.imweb.me/orders/get | 확정 |
| 아임웹 관리자 return URL 설정 | 공개 개발자문서/가이드 검색으로는 상점 관리자가 네이버페이 결제 완료 후 return URL을 임의 지정하는 항목을 찾지 못했다 | 아임웹 개발자센터와 고객 가이드 검색 | 미확정 |

이 차이가 중요하다.
네이버페이를 직접 붙인 독립몰이라면 `returnUrl`로 결제 완료 후 biocom.kr에 돌아오게 만들 수 있다.
하지만 바이오컴은 아임웹 내장 네이버페이 흐름을 쓰고 있으므로, 그 `returnUrl`을 아임웹이 내부에서 고정하거나 숨겨 두었을 가능성이 있다.
따라서 공개 문서만 보고 `아임웹에서 설정 가능하다`고 단정하면 안 된다.

운영 판단은 `관리자 UI 확인은 계속하되, 설계 착수는 미루지 않는다`이다.
리턴 설정이 나중에 발견되면 좋은 보정책이지만, 지금 Google Ads ROAS 문제를 푸는 핵심은 NPay 클릭 시점의 attribution intent를 저장하고 confirmed 주문과 맞추는 것이다.

#### 도움이 되는 지점

| 내용 | 현재 문제에 주는 도움 | 판단 |
|---|---|---|
| NPay는 결제 후 biocom.kr로 돌아오지 않을 수 있음 | client-side purchase 누락의 원인을 설명한다 | 유효 |
| 서버가 GA4 Measurement Protocol로 purchase를 보낼 수 있음 | NPay confirmed 매출을 GA4에 복구할 수 있다 | 유효 |
| `client_id`와 `session_id`를 NPay 클릭 시점에 저장해야 함 | UTM/광고 attribution을 유지하는 핵심이다 | 매우 중요 |
| webhook이 없으면 Toss/아임웹 polling으로 대체 가능 | 현재 seo 인프라에서 구현 가능한 경로다 | 유효 |
| Option A: return URL 설정 수정 | 성공하면 가장 깔끔하다 | 최우선 확인 |
| Option B: 서버-사이드 intent capture + dispatcher | Option A 실패 시 실행 가능한 3~4일 구현안 | 실행 가능 |

#### 한계

`npayfeedback.md`는 일반론이라 그대로 구현 문서로 쓰기에는 부족하다.
실제 seo 환경에서는 NPay 결제 완료 webhook을 직접 받지 못할 수 있으므로, `npayfeedbackreply.md`처럼 Toss/아임웹 polling 대체 경로가 필요하다.

또한 GA4 Measurement Protocol을 붙인다고 Google Ads ROAS가 바로 고쳐지는 것은 아니다.
GA4에는 purchase를 복구할 수 있지만, Google Ads의 현재 Primary `구매완료` action `7130249515`가 NPay count label로 잡혀 있는 문제는 별도 조치가 필요하다.

#### Option A와 Option B

| 선택지 | 의미 | 장점 | 한계 | 우선순위 |
|---|---|---|---|---|
| Option A | 아임웹/네이버페이 설정에서 결제 완료 후 biocom.kr return을 정상화 | 성공하면 GA4, Meta Pixel, TikTok Pixel, Google Ads client-side 태그가 모두 정상화될 가능성 | 관리자 UI에 해당 설정이 있어야 함 | 1순위 |
| Option B | NPay 클릭 시 cid/session_id를 저장하고, 결제 confirmed 후 서버가 GA4/Meta에 purchase 전송 | return이 안 돼도 서버에서 매출 복구 가능 | Google Ads offline conversion은 별도 설계 필요. intent-order 매칭 실패 위험 있음 | 2순위 |
| 병행 최소 작업 | NPay intent capture만 먼저 붙여 cid/session_id 수집 시작 | Option A 성공/실패와 무관하게 나중에 증거가 된다 | GTM publish 승인 필요 | 1.5순위 |

#### 현재 가장 파급력 있는 작업

현재 가장 파급력 있는 작업은 **NPay return 가능 여부 확인 + NPay intent capture 설계 확정**이다.

이유는 세 가지다.

1. NPay return이 해결되면 GA4, Meta, TikTok, Google Ads client-side 구매 추적이 한 번에 좋아질 수 있다.
2. return이 불가능해도 intent capture를 붙이면 server-side GA4/Meta 복구와 Google Ads confirmed conversion 설계의 공통 기반이 생긴다.
3. 지금 Google Ads ROAS 오염의 핵심 label이 NPay count 경로이므로, NPay를 먼저 닫아야 전환 액션을 안전하게 교체할 수 있다.

즉 다음 작업은 `광고를 끄는 것`이 아니라 `Google이 배울 진짜 구매 신호를 만드는 것`이다.
그 첫 단추가 NPay 클릭 시점의 `client_id`, `session_id`, `gclid/gbraid/wbraid`, landing URL, product/order candidate 저장이다.

#### 구체 실행 순서

1. [TJ/Grok] 아임웹 관리자와 네이버페이 파트너센터에서 결제 완료 후 return URL 또는 완료 후 이동 설정이 있는지 확인한다. Grok 검색은 보조 증거로만 쓴다.
2. [TJ] 설정이 있으면 return URL을 biocom 결제완료 페이지로 맞추고 NPay 1건을 테스트한다.
3. [Codex/Claude Code] 설정 확인을 기다리는 동안 `POST /api/attribution/npay-intent` endpoint와 GTM [118] sendBeacon draft 설계를 시작한다.
4. [Codex] intent row와 아임웹/Toss confirmed 주문을 매칭하는 dry-run을 만든다.
5. [Codex/Claude Code] GA4 MP purchase와 Meta CAPI purchase dispatcher를 dry-run으로 붙인다.
6. [Codex] Google Ads는 별도 단계로 confirmed 주문 기반 offline conversion 또는 새 purchase tag를 설계한다.

### 현재 접근 권한 상태

2026-04-23 12:12 KST 기준으로 접근 권한은 세 시스템이 서로 다르다.

| 시스템 | 현재 접근 상태 | 내가 직접 할 수 있는 것 | 아직 못 하는 것 |
|---|---|---|---|
| GA4 | 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`로 GA4 Data API 조회 가능 | `purchase`, `transaction_id`, `pay_method`, revenue 같은 집계 리포트 조회 | GA4 Admin UI를 사람처럼 클릭해서 설정을 바꾸는 일. BigQuery raw는 property/dataset별 권한에 따라 다름 |
| GTM | 서비스 계정으로 GTM API 접근 가능. 2026-04-23 실행 결과 계정 `바이오컴(최종)`과 컨테이너 `GTM-W2Z6PHN`, `GTM-5M33GC4`, `GTM-T8FLZNT` 조회 가능 | 태그, 트리거, 변수, 컨테이너 live version 확인. 2026-04-23 확인 기준 biocom live version은 `137` | GTM UI 자체를 사람이 보듯 클릭하는 일. `user_permissions.list`는 현재 scope 부족으로 실패해 정확한 역할명(관리자/사용자/publish 권한)을 API로 재확인하지 못함 |
| Google Ads | 2026-04-23 12:24 KST TJ가 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`를 읽기 전용 사용자로 추가했다고 보고. 2026-04-25 00:02 KST `SEO-AEO` project owner는 `biocomkr.sns@gmail.com`로 확인했고 Google Ads API 사용 설정 완료. 2026-04-25 00:12 KST API Center에서 developer token과 `테스트 계정 액세스` 상태 확인. 2026-04-25 11:06 KST access level이 `탐색기 액세스`로 변경되어 운영 계정 `214-999-0943`의 `customer`, `conversion_action`, campaign metrics 조회 성공 | Google Ads API로 고객 정보, 전환 액션, 캠페인 성과, `segments.conversion_action` 성과를 직접 읽을 수 있음. 2026-04-25 21:52 KST backend `/api/google-ads/dashboard`가 전환 액션별 gap driver를 반환함 | Google Ads 설정 변경은 read-only 권한 밖이라 직접 변경하지 않았다. `구매완료` primary 유지 여부, confirmed purchase 전환 신설, NPay label secondary 전환은 TJ 승인과 Google Ads UI/API mutation 권한이 필요하다 |

정리하면, **GTM과 GA4는 현재 Codex가 API로 읽을 수 있다.**
Google Ads도 2026-04-25 11:06 KST 기준 **탐색기 액세스로 read-only 조회가 가능해졌다.**
`customer`, `conversion_action`, campaign metrics 쿼리가 모두 200 OK로 통과했다.
2026-04-25 21:52 KST 기준 `/ads/google`은 Google Ads 플랫폼 ROAS, 운영 attribution 원장 confirmed ROAS, 전환 액션별 gap driver를 같은 화면에서 대조한다.
따라서 이제 병목은 API 권한이나 화면 연결이 아니라, 잘못된 Primary 전환 액션을 운영에서 바꾸는 승인과 confirmed 주문 기반 전환 경로를 만드는 일이다.

### 확인된 것

- 바이오컴 GTM은 `GTM-W2Z6PHN`, Google Ads 계정은 `AW-304339096`, GA4 정본은 `G-WJFXN5E2Q1`로 본다.
- 2026-04-23 실행 결과 GTM API는 계정 `4703003246 / 바이오컴(최종)`과 컨테이너 3개를 조회했다. live version 확인 스크립트는 biocom `GTM-W2Z6PHN`의 published version을 `137 (vbank_exception_trigger_2026-04-21)`로 반환했다.
- `gtmaudit/gtm-audit-2026-04-16.json` 기준 바이오컴 컨테이너에는 Google Ads 전환 태그 `[248] TechSol - [GAds]NPAY구매 51163`가 있다.
- 이 태그는 `conversionId=304339096`, `conversionLabel=3yjICOXRmJccEJixj5EB`, `currencyCode=KRW`, `conversionValue={{TechSol - Custom Javascript 30698}}`, `orderId={{TechSol - Custom Javascript 65481}}`를 보낸다.
- 같은 snapshot에서 이 태그의 trigger `[249] TechSol - NPAY구매 61620`은 NPay 버튼 클릭과 장바구니/상품 금액 조건으로 발사된다.
- `footer/biocomimwebcode.md`에는 아임웹 자동 Google Ads NPay trace `AW-304339096/r0vuCKvy-8caEJixj5EB`도 있다. 즉 NPay Google Ads 전환 경로가 GTM과 아임웹 자동 코드로 나뉘어 있다.
- 2026-04-25 Google Ads API 확인 결과 `conversion_action` read가 가능하다. 운영 purchase 계열 중 `구매완료`는 `ENABLED`, `WEBPAGE`, `PURCHASE`, `primary_for_goal=true`, `send_to=AW-304339096/r0vuCKvy-8caEJixj5EB`, 7일 click/view-through window로 확인됐다.
- 같은 확인에서 `TechSol - NPAY구매 50739`는 `ENABLED`, `WEBPAGE`, `PURCHASE`, `primary_for_goal=false`, `send_to=AW-304339096/3yjICOXRmJccEJixj5EB`, 90일 click / 1일 view-through window로 확인됐다. GTM snapshot의 NPay label과 일치한다.
- 2026-04-25 Google Ads API `LAST_30_DAYS` campaign metrics 조회도 성공했다. 2026-04-25 21:52 KST `/api/google-ads/dashboard` 기준 합계는 비용 `25,610,287원`, 노출 `3,537,582`, 클릭 `75,602`, 전환 `1,099.111328`, 전환값 `129,954,697원`, 모든 전환값 `214,724,902원`, 조회 후 전환 `70`, 플랫폼 ROAS `5.07x`다. source는 Google Ads API, window는 `LAST_30_DAYS`, site는 biocom, freshness는 API live, confidence는 high다. Google Ads 전환값은 당일 지연/보정으로 분 단위 변동될 수 있다.
- 2026-04-25 21:52 KST 운영 attribution 원장 `biocom_imweb` 기준 같은 기간 `2026-03-26~2026-04-24 KST`의 Google 유입 `payment_success`는 31건이다. 이 중 confirmed 29건 `7,582,720원`, pending 1건 `0원`, canceled 1건 `39,000원`이다. 내부 confirmed ROAS는 `0.30x`, Google 플랫폼 ROAS와의 차이는 `-4.77x`, 플랫폼 전환값과 내부 confirmed 매출의 차이는 `122,371,977원`이다. source는 `operational_vm_ledger`, latestLoggedAt은 `2026-04-24 23:46 KST`, confidence는 medium-high다.
- 전환 액션별 segment 결과, `구매완료` action `7130249515`가 Primary이고 `PURCHASE`이며 label은 `r0vuCKvy-8caEJixj5EB`다. 이 label은 `footer/biocomimwebcode.md`의 아임웹 자동 NPay count `GOOGLE_ADWORDS_TRACE.setUseNpayCount(true,"AW-304339096/r0vuCKvy-8caEJixj5EB")`와 일치한다. 이 액션 하나가 `Conv. value` `129,954,631원`, 전환 `1,032.99`를 만들었다. source는 Google Ads API `segments.conversion_action`, confidence는 high다.
- `TechSol - NPAY구매 50739` action `7564830949`는 Secondary라 Google `Conv. value`에는 `0원`이지만, `All conv. value`에는 `81,758,081원`, 모든 전환 `775.99`가 잡힌다. 즉 Google Ads 화면에서 `모든 전환값`을 보면 NPay 오염이 한 번 더 커진다.
- 조회 후 전환 70건 중 57건은 `바이오컴 장바구니에 추가` 쪽이며 전환값은 `0원`이다. 구매 계열 조회 후 전환은 13건이다. 따라서 현재 핵심 gap은 view-through가 아니라 Primary NPay purchase label이다.
- 캠페인 ID 커버리지는 주문 기준 `94%`다. 단, 현재 Google Ads API campaign report에 잡힌 active/spend 캠페인과 내부 원장 캠페인 ID가 대부분 다르다. 내부 confirmed 매출이 큰 campaign ID는 `21804566601` `3,919,900원`, `21808018766` `1,786,000원`이고, 현재 campaign metrics에는 비용 row가 없다. 그래서 캠페인 단위 ROAS는 historical/removed campaign metadata 조회가 필요하다.
- 2026-04-25 13:09 KST `/ads/google` 화면은 Google Ads API live와 내부 confirmed 대조를 기본값으로 표시하고, CSV 업로드는 수동 대조용 fallback으로 남겼다. 백엔드 endpoint는 `/api/google-ads/status`, `/api/google-ads/dashboard`다.
- `GA4/GA4검증.md` 기준 2026-04-21 잔여 오염은 NPay 클릭 시점 발사 5건 `966,800원`, HURDLERS + 홈피구매 중복 6건 `1,941,324원`, 총 `2,908,124원`으로 분해됐다.
- 더클린커피 GTM `GTM-5M33GC4`는 Google Ads 태그 `AW-10965703590`와 리마케팅, 회원가입, 카톡채널 전환은 있으나 2026-04-16 snapshot 기준 구매용 Google Ads 전환 태그는 보이지 않는다.
- Data Check 기준 메인 매출과 ROAS는 `confirmed` 기준이어야 한다. `pending`, 가상계좌 미입금, 취소/환불은 별도 보정해야 한다.

### 아직 안 된 것

- Google Ads 전환 액션 목록과 전환 액션별 성과 segment는 API와 `/ads/google` 화면에서 읽힌다. 다음은 Google Ads 설정 변경 승인과 confirmed purchase 전환 경로 설계다.
- `/ads/google`은 live API endpoint와 내부 confirmed ROAS 대조를 완료했다. CSV 임시 분석은 API 장애 또는 수동 export 대조용으로 유지한다.
- 2026-04-21 v137 publish 이후 최신 GTM API snapshot이 없다. `gtmaudit/gtm-audit-2026-04-16.json`은 v135 기준이므로 최신 정본으로 쓰면 안 된다.
- Google Ads 캠페인 리포트와 내부 원장은 같은 기간, campaign ID 기준으로 1차 대조됐다. 다만 내부 원장 campaign ID 상당수가 현재 Google Ads campaign metrics 및 같은 고객 계정의 campaign lookup에 없는 ID라 다른 계정/과거 URL 파라미터 가능성이 남았다.
- GDN 조회 후 전환이 운영 판단 ROAS에 포함되는지, 보조 지표로만 둘지 아직 결정되지 않았다.
- 취소/환불을 Google Ads conversion adjustment로 보낼지 결정되지 않았다.

### 지금 막힌 이유

첫 번째 병목은 Google Ads 플랫폼 전환값 `129,954,697원`의 거의 전부가 Primary NPay label `r0vuCKvy-8caEJixj5EB`에서 나온다는 점이다.
이 label은 아임웹 자동 NPay count 경로이므로 confirmed purchase로 보기 어렵다.
두 번째 병목은 `TechSol - NPAY구매 50739`가 Secondary로 `All conv. value` `81,758,081원`을 추가로 만들고 있다는 점이다.
세 번째 병목은 NPay가 결제 완료 후 biocom.kr로 돌아오지 않는 구조라서, 클릭 시점 전환과 실제 결제 완료 전환이 섞일 수 있다는 점이다.

### 현재 주체

- TJ: Google Ads UI 확인, 관리자 승인, GTM publish, 실결제 테스트, Google Ads API 권한 승인.
- Codex: 로컬 파일과 API 기반 대조, 내부 원장 조인 설계, Google Ads API/CSV 리포트 파서 설계.
- Claude Code: GTM 태그 정리 초안, `/ads` 화면 문구와 정합성 카드, GA4 DebugView/Preview 검증 보조.

## 산출물

- Google Ads 전환 액션 장부: 전환 이름, ID/label, primary 여부, 전환값, 집계 방식, 전환 기간, view-through 포함 여부.
- GDN ROAS 비교표: Google Ads 플랫폼 ROAS, click-only ROAS, view-through 보조성과, 내부 confirmed ROAS.
- Google Ads 광고성과 화면: `/ads/google`에서 Google Ads API live로 비용, 전환수, 전환값, ROAS, 전환 액션 후보, 내부 confirmed 매출, 내부 ROAS, 미매칭 campaign ID를 표시하고 CSV 업로드는 수동 대조용으로 사용한다.
- 구매 이벤트 블랙박스: 카드, 가상계좌, NPay, 무료 주문, 취소/환불별 이벤트 발사 결과.
- 개선안 승인 패키지: NPay 클릭 전환 제거/변경, 중복 purchase 태그 제거, transaction_id와 dynamic value 검증, conversion adjustment 도입 여부.
- 운영 판단 룰: 예산 증액/유지/감액에 어떤 ROAS를 쓰는지 고정한 문서와 화면 문구.
- GDN Harness 기준판: [[harness/gdn/README|README]], [[harness/gdn/CONTEXT_PACK|CONTEXT_PACK]], [[harness/gdn/RULES|RULES]], [[harness/gdn/VERIFY|VERIFY]], [[harness/gdn/APPROVAL_GATES|APPROVAL_GATES]], [[harness/gdn/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]], [[harness/gdn/EVAL_LOG_SCHEMA|EVAL_LOG_SCHEMA]], [[harness/gdn/LESSONS|LESSONS]].

## 참고한 내부 문서

- [[!tiktokroasplan|tiktok/tiktokroasplan.md]]: 플랫폼 ROAS와 내부 confirmed ROAS를 분리한 선례.
- [[!datacheckplan|data/!datacheckplan.md]]: Toss, Imweb, GA4, Attribution ledger의 역할 기준.
- [[GA4검증|GA4/GA4검증.md]]: v136/v137 이후 GA4 purchase 오염 감소와 잔여 이상치 분해.
- [[npay_return_missing_20260421|GA4/npay_return_missing_20260421.md]]: NPay 결제 완료 후 자사몰 리턴 누락과 Google Ads 클릭 전환 위험.
- [[googleadstictok|capivm/googleadstictok.md]]: 기존 Google Ads/TikTok 정합성 계획과 GTM audit 결과.
- [[biocomimwebcode|footer/biocomimwebcode.md]]: 아임웹 자동 Google Ads NPay trace와 삽입 코드 위치.
- [[google-ads-internal-roas-reconciliation|gdn/google-ads-internal-roas-reconciliation.md]]: 2026-04-25 기준 Google Ads API live와 운영 attribution 원장 confirmed 매출 대조 결과.
- [[harness/gdn/README|GDN Harness]]: Google Ads/GDN ROAS 작업의 read-only, dry-run, 승인 게이트, auditor 기준판.

## 공식 근거

- [Google Ads 전환값 설명](https://support.google.com/google-ads/answer/13064207): 전환값은 ROAS 입찰과 전환가치 최적화의 기준이다.
- [Google Ads 전환 추적 데이터 이해](https://support.google.com/google-ads/answer/6270625): `Conv. value / cost`는 전환값을 광고비로 나눈 ROI 지표다.
- [거래별 전환값 추적](https://support.google.com/google-ads/answer/6095947): 구매처럼 주문마다 금액이 다른 액션은 dynamic value가 필요하다.
- [transaction_id로 중복 전환 줄이기](https://support.google.com/google-ads/answer/6386790): 같은 전환 액션과 같은 transaction_id의 두 번째 전환은 중복으로 처리된다.
- [GA4 전환을 Google Ads로 가져오기](https://support.google.com/google-ads/answer/2375435): Google Ads는 클릭 날짜 기준, GA4는 전환 날짜 기준으로 볼 수 있고 import 지연이 최대 24시간 생길 수 있다.
- [Google Ads 전환 조정](https://support.google.com/google-ads/answer/7686447): 취소/반품은 retraction 또는 restatement로 전환 수와 전환값을 조정할 수 있다.
- [Display 조회 후 전환](https://support.google.com/google-ads/answer/16542520): GDN은 광고를 봤지만 클릭하지 않은 사용자의 후속 전환을 별도 지표로 본다.
- [Google Ads API 서비스 계정 절차](https://developers.google.com/google-ads/api/docs/oauth/service-accounts): 서비스 계정을 Google Ads 사용자로 추가해야 API 접근이 가능하다.
- [Google Ads API OAuth 개요](https://developers.google.com/google-ads/api/docs/oauth/overview): Google Ads API 호출에는 OAuth 2.0 자격증명 외에 developer token도 필요하다.
- [Google Ads API v22 release notes](https://developers.google.com/google-ads/api/docs/release-notes): 2026-04-23 기준 최신 API 판단은 v22 문서를 기준으로 검토한다.

## Phase별 계획

### Phase 0

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 기준과 원천 고정

- 목표: Google Ads ROAS를 어떤 숫자와 비교할지 고정한다.
- 왜 지금 해야 하는가: 기준이 없으면 Google Ads ROAS, GA4 revenue, 내부 confirmed revenue가 서로 다른 말을 해도 무엇이 맞는지 판단할 수 없다.
- 산출물: ROAS 정의표, 원천별 신뢰 역할, GDN view-through 분리 원칙.
- 완료 기준: 문서와 `/ads/google` 화면에서 Google Ads 플랫폼 ROAS와 내부 confirmed ROAS를 다른 지표로 표시한다.
- 다음 Phase에 주는 가치: 전환 액션 실사와 태그 검증에서 무엇을 찾아야 하는지 명확해진다.

#### Phase0-Sprint1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 기준과 원천 고정
**상태**: 우리 기준 90% / 운영 기준 70%

**무엇을 하는가**

Google Ads ROAS의 분자와 내부 ROAS의 분자를 분리한다.
Google Ads 플랫폼 ROAS는 Google Ads가 귀속한 `Conv. value / cost`이고, 내부 ROAS는 Attribution ledger와 운영 주문 DB에서 confirmed로 닫힌 매출을 광고비로 나눈 값이다.

**왜 필요한가**

GDN은 클릭 없이 광고를 본 뒤 산 사람도 조회 후 전환으로 잡을 수 있다.
이 값은 보조성과로 중요하지만, 내부 확정매출과 같은 의미로 섞으면 예산 판단이 과장될 수 있다.

**산출물**

- ROAS 정의표
- Google Ads vs GA4 vs 내부 원장 차이표
- GDN click-only / view-through 분리 기준

**우리 프로젝트에 주는 도움**

Google Ads를 끌지 말지 논의할 때, 광고 플랫폼 숫자와 실제 통장 기준 숫자를 섞지 않는다.

##### 역할 구분

- TJ: GDN 예산 판단에 view-through 전환을 어느 수준까지 참고할지 승인.
- Codex: ROAS 정의표와 내부 confirmed 기준 계산식 작성.
- Claude Code: `/ads` 화면 문구와 툴팁 초안.

##### 실행 단계

1. [Codex] Google Ads ROAS 정의를 `platform_roas`, `click_confirmed_roas`, `view_through_assist`, `internal_confirmed_roas`로 분리한다. 의존성: 병렬가능.
2. [Codex] 내부 원장 기준은 `confirmed`만 메인 매출로 쓰고 `pending`, `vbank_expired`, `canceled`, `FREE`는 보조 분류로 둔다. 의존성: 병렬가능.
3. [TJ] GDN view-through 전환을 예산 증액 근거로 단독 사용하지 않는 원칙을 승인한다. 의존성: 선행필수. 이유: 광고 운영 기준 결정이다.
4. [Claude Code] `/ads` 또는 문서 카드에 "Google Ads 숫자는 플랫폼 귀속, 내부 숫자는 확정매출" 문구를 넣는다. 의존성: 부분병렬.

### Phase 1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 전환 액션과 태그 실사

- 목표: Google Ads에서 실제 ROAS에 쓰이는 전환 액션과 GTM/아임웹에서 발사되는 태그를 모두 찾는다.
- 왜 지금 해야 하는가: 같은 `AW-304339096` 안에 NPay 클릭 전환, 회원가입, 리마케팅, 임시 장바구니 태그가 함께 있다.
- 산출물: 전환 액션 장부, 최신 GTM live audit, 아임웹 자동 코드 점검표.
- 완료 기준: 어떤 label이 purchase이고 어떤 label이 보조 이벤트인지 1줄로 말할 수 있다.
- 다음 Phase에 주는 가치: 결제수단별 테스트에서 어떤 요청을 정상/오염으로 볼지 정할 수 있다.

#### Phase1-Sprint2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Google Ads 전환 액션 실사
**상태**: 우리 기준 90% / 운영 기준 80%

**무엇을 하는가**

Google Ads UI 또는 API에서 전환 액션 목록을 가져온다.
구매, NPay, 회원가입, 리마케팅, 임시 테스트 태그를 분리한다.

**왜 필요한가**

Google Ads ROAS는 primary 전환 액션과 전환값 설정에 크게 좌우된다.
NPay 버튼 클릭 전환이 primary purchase로 들어가 있으면, 실제 결제 완료가 아니라 클릭 의도만 보고 ROAS가 올라갈 수 있다.

**산출물**

- 전환 액션 장부
- primary/secondary 전환 구분표
- 구매 전환 label별 위험도

**우리 프로젝트에 주는 도움**

Google Ads가 어떤 신호로 학습하는지 알 수 있다.
이게 닫혀야 GDN 예산을 올려도 되는지 판단할 수 있다.

##### 역할 구분

- TJ: Google Ads 관리자 화면 접근, 전환 액션 목록 export 또는 API 권한 승인.
- Codex: export 파싱, label별 GTM/아임웹 코드 매칭, 위험도 분류.
- Claude Code: 전환 액션 장부 화면 또는 문서 표 정리.

##### 실행 단계

1. [Codex] 현재 로컬 증거에서 `AW-304339096`, `AW-10965703590`, `conversionLabel` 후보를 표로 정리한다. 의존성: 병렬가능.
2. [Codex] Google Ads API `conversion_action`과 `segments.conversion_action`을 조회한다. 완료: `구매완료`, `TechSol - NPAY구매 50739`, page_view_long, sign_up, 장바구니 성과가 API로 분리됐다.
3. [Codex] API 결과를 `gtmaudit`와 `footer` 기록에 매칭해 "실제 발사 경로"를 붙인다. 완료: `구매완료` label `r0vu...`는 아임웹 자동 NPay count, `TechSol - NPAY구매 50739` label `3yj...`는 GTM NPay 클릭 태그와 매칭됐다.
4. [TJ] Google Ads UI에서 `구매완료` 액션을 Primary로 계속 둘지, Secondary로 낮출지 승인한다. 의존성: 선행필수. 이유: Google Ads 입찰 신호 변경이다.
5. [Codex/Claude Code] confirmed purchase 전환 신설 또는 offline conversion import 설계를 작성한다. 의존성: 4번 이후 선행필수.

#### Phase1-Sprint3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: GTM/GA4 구매 태그 정합성 확인
**상태**: 우리 기준 45% / 운영 기준 25%

**무엇을 하는가**

GTM과 아임웹 자동 삽입 코드에서 purchase 관련 태그가 몇 개 있고, 언제 발사되는지 확인한다.
GA4에서 이미 확인된 중복 purchase 구조가 Google Ads에도 영향을 주는지 본다.

**왜 필요한가**

GA4 v137 이후에도 NPay 클릭 발사와 HURDLERS + 홈피구매 중복은 남아 있다.
Google Ads 태그 `[248]`도 NPay 클릭 trigger를 쓰므로 같은 오염이 Google Ads ROAS로 들어갈 수 있다.

**산출물**

- 최신 GTM live audit
- purchase sender 중복표
- NPay 클릭 전환 위험 리포트

**우리 프로젝트에 주는 도움**

태그가 왜 틀렸는지 추측하지 않는다.
어떤 태그를 끄거나 바꿔야 하는지 승인 가능한 형태로 나온다.

##### 역할 구분

- TJ: GTM publish 승인과 Google Tag Manager 관리자 권한 확인.
- Codex: GTM API snapshot 재생성, JSON 정적 분석, 기존 GA4 검증 결과와 연결.
- Claude Code: GTM Preview, DebugView, 태그 변경 초안.

##### 실행 단계

1. [Codex] `cd backend && npx tsx scripts/gtm-audit.ts`로 최신 GTM snapshot을 만든다. 의존성: 병렬가능. 단, 현재 service account 권한이 살아 있어야 한다.
2. [Codex] 최신 snapshot에서 `awct`, `googtag`, `gaawe eventName=purchase`, NPay click trigger를 전수 추출한다. 의존성: 1번 선행필수.
3. [Claude Code] GA4 잔여 이상치 14건 분해 결과를 GTM 태그 ID와 연결한다. 의존성: 병렬가능.
4. [TJ] GTM publish가 필요한 변경은 승인한다. 의존성: 선행필수. 이유: 운영 태그 변경은 live 사이트 추적에 직접 영향이 있다.
5. [Codex] 변경 전/후 비교표를 만든다. `v135 snapshot`, `v137 기록`, 최신 snapshot을 분리해서 날짜를 붙인다. 의존성: 1번 선행필수.

### Phase 2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 결제수단별 이벤트 대조

- 목표: 카드, 가상계좌, NPay, 무료 주문, 취소/환불이 Google Ads/GA4/내부 원장에서 어떻게 보이는지 확인한다.
- 왜 지금 해야 하는가: 전환 액션만 봐서는 실제 결제 완료와 맞는지 알 수 없다.
- 산출물: 결제수단별 이벤트 블랙박스, 주문번호별 대조표.
- 완료 기준: 카드 confirmed는 구매 1회, 가상계좌 미입금은 구매 0회, NPay는 실제 결제 기준 전환만 허용이라는 판단을 주문번호로 증명한다.
- 다음 Phase에 주는 가치: 플랫폼 리포트와 내부 원장 비교에서 gap 원인을 분류할 수 있다.

#### Phase2-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 결제수단별 이벤트 대조
**상태**: 우리 기준 40% / 운영 기준 20%

**무엇을 하는가**

실제 결제 플로우에서 Google Ads 요청, GA4 purchase, 내부 주문 상태를 같은 주문번호로 맞춘다.

**왜 필요한가**

TikTok에서 확인했듯이 주문 생성이나 입금 전 가상계좌를 구매로 보면 플랫폼 ROAS가 크게 부풀 수 있다.
Google Ads도 같은 구조가 있으면 GDN 자동입찰이 가짜 구매를 학습한다.

**산출물**

- 카드 결제 검증 로그
- 가상계좌 미입금 검증 로그
- NPay 클릭/결제완료 분리 로그
- FREE/내부 테스트 주문 제외 기준

**우리 프로젝트에 주는 도움**

전환 오염을 태그 이름이 아니라 주문 단위 증거로 닫는다.

##### 역할 구분

- TJ: 실결제 테스트, NPay/가상계좌 테스트 승인. 이유: 실제 결제와 외부 계정 작업은 사람만 할 수 있다.
- Codex: 운영 DB read-only 대조, Attribution ledger 조회, 요청 로그 정리.
- Claude Code: Playwright/Preview 캡처, DebugView 확인, 화면 문구 정리.

##### 실행 단계

1. [Codex] 로그인 없이 가능한 페이지에서 Google Ads 요청 패턴을 Playwright로 다시 캡처한다. 의존성: 병렬가능.
2. [TJ] 바이오컴 카드 결제 테스트 주문 1건을 만든다. 의존성: 선행필수. 이유: 실결제 발생.
3. [Codex+Claude Code] 카드 주문의 Google Ads conversion request, GA4 purchase, 운영 DB `PAYMENT_COMPLETE`, Attribution ledger `confirmed`를 대조한다. 의존성: 2번 선행필수.
4. [TJ] 바이오컴 가상계좌 미입금 테스트 주문 1건을 만든다. 의존성: 선행필수. 이유: 실결제 플로우와 미입금 상태 생성.
5. [Codex+Claude Code] 가상계좌 미입금에서 Google Ads purchase가 나가는지 확인한다. 나가면 오염 후보로 기록한다. 의존성: 4번 선행필수.
6. [TJ] NPay 테스트 또는 기존 NPay 주문 샘플 확인을 승인한다. 의존성: 선행필수. 이유: NPay 외부 결제와 관리자 확인.
7. [Codex] NPay 주문은 `pay_type=npay`, GA4 `purchase`, Google Ads NPay conversion label, 내부 주문번호를 맞춘다. 의존성: 부분병렬.
8. [Claude Code] 검증 결과를 주문번호 마스킹 표로 정리한다. 의존성: 3/5/7번 이후 선행필수.

### Phase 3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS와 내부 ROAS 비교

- 목표: Google Ads/GDN 리포트와 내부 확정매출 ROAS를 같은 기간으로 비교한다.
- 왜 지금 해야 하는가: 태그 오염을 확인해도 실제 광고비 판단은 캠페인별 숫자로 해야 한다.
- 산출물: GDN ROAS 비교표, gap waterfall, 캠페인별 조치 의견.
- 완료 기준: Google Ads platform ROAS와 internal confirmed ROAS 차이를 전환액션, 날짜 기준, view-through, pending/취소, NPay, 중복 태그로 분해한다.
- 다음 Phase에 주는 가치: 무엇을 고치면 ROAS가 얼마나 바뀌는지 보인다.

#### Phase3-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS와 내부 ROAS 비교표
**상태**: 우리 기준 80% / 운영 기준 55%

**무엇을 하는가**

Google Ads 캠페인 리포트와 내부 확정매출을 날짜와 캠페인 기준으로 조인한다.
GDN은 click conversion과 view-through conversion을 분리해서 본다.

**왜 필요한가**

광고 관리자의 ROAS가 높아도, 그 매출이 실제 확정매출인지, 조회 후 전환인지, 중복 태그인지 모르면 예산을 올릴 수 없다.

**산출물**

- Google Ads API live import endpoint
- 캠페인별 ROAS gap table
- GDN view-through assist table

**우리 프로젝트에 주는 도움**

GDN 예산을 감으로 판단하지 않고, 내부 confirmed 기준으로 조정할 수 있다.

##### 역할 구분

- TJ: Google Ads 캠페인 리포트 export 또는 API 권한 승인.
- Codex: 리포트 파서, 내부 원장 조인, gap 계산.
- Claude Code: `/ads` GDN 카드와 표 UI.

##### 실행 단계

1. [Codex] Google Ads API live import endpoint를 만든다. 완료: `/api/google-ads/dashboard`가 customer, conversion_action, campaign metrics, daily metrics를 읽는다.
2. [Codex] CSV/API 파서를 만든다. 완료: `/ads/google`에 CSV fallback과 live API 표시가 함께 있다.
3. [Codex] 내부 Attribution ledger에서 `gclid`, `utm_source=google`, `gad_campaignid`, `campaign` 후보, confirmed revenue를 같은 기간으로 집계한다. 완료: `operational_vm_ledger` `biocom_imweb` 기준 2026-03-26~2026-04-24 KST confirmed 29건 `7,582,720원` 집계.
4. [Codex] Google Ads 비용과 내부 confirmed revenue를 캠페인 단위로 조인한다. 완료: 현재 active/spend campaign 4개와 내부 원장 campaign ID를 1차 조인했다. `[SA]바이오컴 검사권`만 직접 매칭됐고, 내부 매출이 큰 historical campaign ID는 internal-only로 분리했다.
5. [Codex] gap을 `전환 액션`, `날짜 기준`, `view-through`, `NPay`, `중복 태그`, `pending/취소`, `unmapped`로 나눈다. 진행 중: 총 gap은 `122,371,977원`이고, 1순위 원인은 Primary NPay label `구매완료` `129,954,631원`으로 확인됐다.
6. [Claude Code] `/ads`에 GDN 비교표 초안을 붙인다. 완료: `/ads/google`에 Google Ads vs 내부 confirmed, 전환 액션별 gap 분해, 캠페인 ROAS 표, 내부 원장 Google 유입 미매칭 표를 표시한다.

### Phase 4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 전환 오염 제거와 보정

- 목표: Google Ads가 실제 결제 확정과 맞는 전환만 학습하게 만든다.
- 왜 지금 해야 하는가: 오염된 전환을 계속 primary로 두면 GDN 자동입찰이 잘못된 사용자와 지면을 학습한다.
- 산출물: GTM 변경안, conversion adjustment 설계, enhanced conversions 도입 판단.
- 완료 기준: purchase 전환은 dynamic value와 transaction_id를 갖고, 취소/환불은 보정 경로가 있으며, NPay 클릭 전환은 purchase로 쓰지 않는다.
- 다음 Phase에 주는 가치: 운영 판단 룰을 실제 시스템 상태에 맞춰 고정할 수 있다.

#### Phase4-Sprint6

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 전환 오염 제거와 보정
**상태**: 우리 기준 10% / 운영 기준 0%

**무엇을 하는가**

NPay 클릭 전환, 중복 purchase 태그, 가상계좌 미입금 purchase, 취소/환불 미반영을 줄인다.

**왜 필요한가**

Google Ads 공식 기준에서도 주문마다 금액이 다르면 dynamic value가 필요하고, 중복 방지에는 transaction_id가 필요하다.
취소/반품은 conversion adjustment로 조정할 수 있으므로, Google Ads ROAS가 gross 매출로만 부풀지 않게 할 수 있다.

**산출물**

- NPay 전환 변경 승인안
- 중복 purchase 태그 정리안
- transaction_id/dynamic value 검증 체크리스트
- conversion adjustment dry-run 설계
- enhanced conversions for web 적용 판단

**우리 프로젝트에 주는 도움**

Google Ads 자동입찰이 실제 매출과 더 가까운 신호로 학습한다.

##### 역할 구분

- TJ: GTM publish, Google Ads 전환 설정 변경, API/secret 발급 승인.
- Codex: conversion adjustment 설계, order_id 매칭, dry-run 파일 생성.
- Claude Code: GTM 변경 초안, Preview 검증, UI 문구.

##### 실행 단계

1. [Claude Code] NPay 클릭 전환 `[248]`과 아임웹 자동 NPay trace를 purchase에서 제외하거나 보조 전환으로 낮추는 변경안을 만든다. 의존성: Phase2 결과 선행필수.
2. [Claude Code] GA4 HURDLERS `[143]` + 홈피구매 `[48]` 중복 발사 제거안을 만든다. 의존성: 병렬가능.
3. [Codex] Google Ads purchase 전환에 `transaction_id`와 dynamic value가 안정적으로 들어가는지 주문 샘플로 검증한다. 의존성: Phase2 결과 선행필수.
4. [Codex] 취소/환불/가상계좌 만료 주문을 Google Ads conversion adjustment로 보낼 수 있는지 `order_id` 기준 dry-run을 설계한다. 의존성: 병렬가능.
5. [TJ] Google Ads 전환 액션 변경과 GTM publish를 승인한다. 의존성: 선행필수. 이유: 운영 태그와 입찰 신호 변경이다.
6. [Codex+Claude Code] 변경 후 7일 동안 Google Ads, GA4, 내부 confirmed 매출 차이를 모니터링한다. 의존성: 5번 선행필수.

### Phase 5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 운영 판단 룰 고정

- 목표: GDN 예산을 늘릴지, 유지할지, 줄일지 판단하는 기준을 고정한다.
- 왜 지금 해야 하는가: 정합성 확인이 끝나도 어떤 숫자를 의사결정에 쓸지 정하지 않으면 운영자가 다시 헷갈린다.
- 산출물: 운영 룰, 승인 기준, 대시보드 문구.
- 완료 기준: 대표와 운영자가 같은 화면에서 "이 캠페인은 내부 confirmed 기준으로 증액 가능/보류/감액"을 판단할 수 있다.
- 다음 Phase에 주는 가치: Google Ads를 Meta/TikTok/CRM과 같은 매출 기준으로 비교할 수 있다.

#### Phase5-Sprint7

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 운영 판단 룰 고정
**상태**: 우리 기준 25% / 운영 기준 10%

**무엇을 하는가**

Google Ads 플랫폼 ROAS와 내부 confirmed ROAS의 사용처를 나눈다.
GDN view-through 전환은 보조성과로 보고, 예산 증액의 단독 근거로 쓰지 않는 기준을 세운다.

**왜 필요한가**

광고 플랫폼 숫자는 입찰 최적화에는 필요하지만, 회사 손익 판단은 확정매출 기준이어야 한다.

**산출물**

- GDN 예산 판단 룰
- 캠페인 상태 배지
- 승인 체크리스트

**우리 프로젝트에 주는 도움**

Google Ads 숫자가 좋아 보여도 실제 돈이 안 들어온 캠페인을 걸러낼 수 있다.

##### 역할 구분

- TJ: 최소 ROAS, 마진, 증액/감액 기준 승인.
- Codex: 캠페인별 판정 로직과 threshold 계산.
- Claude Code: `/ads` 운영 카드와 문구.

##### 실행 단계

1. [Codex] `internal_confirmed_roas`, `platform_roas`, `view_through_assist`, `conversion_quality_score`를 계산한다. 완료: `/ads/google`에서 플랫폼 ROAS, 내부 confirmed ROAS, 전환 액션 오염 경고를 계산한다.
2. [Codex] 임시 운영 룰을 문서화한다. 완료: 2026-05-05 02:35 KST 기준 `광고 전체 OFF 보류`, `증액 금지`, `Google ROAS 신뢰 중지`, `PM/PMax 30~50% 감액 또는 7일 pause test 조건부 검토`로 갱신했다.
3. [TJ] 상품군별 최소 ROAS와 마진 기준을 제공한다. 의존성: 선행필수. 이유: 사업 판단이다.
4. [Codex] 캠페인 상태를 `증액 가능`, `관찰`, `오염 의심`, `감액 후보`로 나누는 규칙을 만든다. 의존성: 1/3번 선행필수.
5. [Claude Code] `/ads`에 Google Ads/GDN 카드와 경고 배지를 붙인다. 의존성: 부분병렬.
6. [TJ] 운영 반영을 승인한다. 의존성: 선행필수. 이유: 광고 운영 기준 변경이다.

## 우리 프로젝트에 주는 도움

이 계획이 끝나면 Google Ads ROAS가 실제 확정매출과 얼마나 맞는지 알 수 있다.
GDN은 조회 후 전환을 보조 신호로 살리되, 예산 증액은 내부 confirmed 매출 기준으로 판단할 수 있다.
NPay 클릭 전환, 중복 purchase, 가상계좌 미입금 같은 오염이 줄어 Google Ads 자동입찰도 더 나은 신호를 학습한다.

## 다음 액션

### 지금 당장

1. [TJ] Google Ads 증액을 중지한다. Google Ads ROAS와 `Conv. value`는 예산 증액 근거에서 제외한다.
2. [TJ] PM/PMax 계열 예산 방어선을 결정한다. 후보는 30~50% 감액 또는 7일 pause test다. `[SA]바이오컴 검사권`은 검색 의도 캠페인으로 분리해 소액 cap 유지 후보로 본다.
3. [TJ] [[google-ads-purchase-primary-change-approval-20260505]]를 보고 `구매완료` action `7130249515`를 purchase primary에서 내릴 준비를 승인할지 결정한다. 승인 전에는 Google Ads 설정을 바꾸지 않는다.
4. [Codex] affected campaign/bid strategy를 Google Ads API read-only로 조회한다. `구매완료` primary 변경 시 어느 캠페인 학습에 영향을 주는지 확인한다.
5. [Codex] NPay confirmed 주문과 Google Ads NPay label을 주문 단위로 대조하는 read-only 설계를 만든다. NPay 클릭이 실제 매출로 얼마나 닫히는지 확인한다.
6. [Codex] confirmed 주문 기반 Google Ads 전환 경로를 설계한다. 후보는 `shop_payment_complete` client-side purchase와 서버 기반 offline conversion import다.
7. [Codex] 아임웹 관리자와 네이버페이 파트너센터에서 NPay 결제 완료 후 return URL 또는 완료 후 이동 설정을 TJ님이 확인할 수 있도록 체크리스트를 보강한다.

### 이번 주

1. [TJ+Claude Code] 카드, 가상계좌, NPay 결제수단별 Preview/DebugView 테스트를 한다.
2. [Codex] Google Ads platform gap `122,371,977원`의 잔여 원인을 날짜 기준, pending/취소, NPay return 누락, campaign mapping으로 더 분해한다.
3. [Claude Code] NPay 클릭 전환과 HURDLERS+홈피구매 중복 제거 GTM 변경안을 작성한다.

### 운영 승인 후

1. [TJ] GTM publish와 Google Ads 전환 설정 변경을 승인한다.
2. [Codex] conversion adjustment dry-run을 운영 데이터 write 없이 검증한다.
3. [Codex+Claude Code] `/ads`에 Google Ads/GDN 정합성 카드를 붙이고 7일 관찰한다.

## 승인 포인트

- Google Ads API 권한 또는 리포트 export 승인.
- GTM publish 승인.
- Google Ads 전환 액션 primary/secondary 변경 승인.
- NPay 클릭 전환 제거 또는 보조 전환 전환 승인.
- conversion adjustment 실제 업로드 승인.

## 업데이트 이력

| 시각 | 변경 | 근거 |
|---|---|---|
| 2026-04-23 12:12 KST | 최초 작성. Google Ads/GDN ROAS 정합성 체크와 개선 계획을 별도 문서로 분리 | `tiktok/tiktokroasplan.md`, `data/!datacheckplan.md`, `GA4/GA4검증.md`, `GA4/npay_return_missing_20260421.md`, `capivm/googleadstictok.md`, Google 공식 문서 확인 |
| 2026-04-23 12:24 KST | Google Ads 접근 상태 갱신. TJ가 서비스 계정을 읽기 전용으로 추가했고, 남은 조건은 Google Ads API developer token임을 명시 | 사용자 보고, Google Ads API developer token/service account 공식 문서 |
| 2026-04-23 12:24 KST | API Center 접근 불가 원인 추가. 현재 `214-999-0943 바이오컴`은 광고 계정 관리자이지만 MCC가 아니라서 developer token 페이지가 열리지 않음을 기록 | TJ 스크린샷, Google Ads API developer token 공식 문서 |
| 2026-04-24 23:53 KST | Google Ads API 첫 호출 테스트. developer token과 서비스 계정 OAuth 토큰은 읽혔으나 GCP project `196387225505`에서 Google Ads API가 비활성화되어 `SERVICE_DISABLED` 403으로 실패 | 로컬 Node REST 호출, Google Ads API error response |
| 2026-04-25 00:02 KST | `SEO-AEO` project owner가 `biocomkr.sns@gmail.com`임을 기록. Google Ads API 사용 설정 후 재테스트에서 서비스 계정 project가 `seo-aeo-487113`로 확인됐고, 새 병목은 `DEVELOPER_TOKEN_NOT_APPROVED`로 변경됨 | TJ 스크린샷/보고, 로컬 Node REST 호출 |
| 2026-04-25 00:07 KST | `Biocom API Manager 454-088-2676` API Center에서 토큰 생성 시 이미 API access에 signed up 된 authorized customer라는 오류가 발생. 신규 토큰 생성 재시도보다 기존 token/access 상태 확인으로 전환 | TJ 스크린샷/보고 |
| 2026-04-25 00:12 KST | API Center에서 developer token 존재, access level `테스트 계정 액세스`, `기본 액세스 신청` 링크 확인. 신청 링크가 한국어 미지원 Help Center 화면으로 이동하므로 영어 폼 전환이 필요 | TJ 스크린샷/보고, Google Ads API access level 공식 문서 |
| 2026-04-25 00:17 KST | Google Ads API Token Application 입력값을 정리하고 업로드용 설계 문서 `gdn/google-ads-api-token-application-design-doc.rtf` 생성 | TJ 스크린샷/보고, Google Ads API Token Application form |
| 2026-04-25 00:35 KST | Basic Access 승인 대기 중에도 볼 수 있는 `/ads/google` 프론트 페이지 생성. CSV 업로드 파서, 캠페인/일별/전환 액션 임시 분석, API 자동화 대기열을 추가 | TJ 요청, 로컬 Next build, Playwright CSV upload smoke |
| 2026-04-25 11:06 KST | Google Ads access level이 `탐색기 액세스`로 변경된 뒤 API read 재테스트 성공. 운영 계정 `214-999-0943` customer, conversion_action, campaign metrics `LAST_30_DAYS` 조회가 모두 200 OK | 로컬 Node REST 호출, Google Ads API response |
| 2026-04-25 11:39 KST | backend `/api/google-ads/status`, `/api/google-ads/dashboard`와 frontend `/ads/google` live 연결 완료. 7011 화면에서 Google Ads API live, 비용 `25,711,864원`, ROAS `5.04x`, `구매완료`, `TechSol - NPAY구매 50739` 표시 확인 | backend/frontend build, ESLint, curl, Playwright screenshot |
| 2026-04-25 13:12 KST | `/api/google-ads/dashboard`에 운영 attribution 원장 confirmed ROAS 대조를 추가. `LAST_30_DAYS` 기준 Google 플랫폼 ROAS `5.06x`, 내부 confirmed ROAS `0.29x`, gap `-4.77x`, 플랫폼 전환값과 내부 confirmed 매출 차이 `122,464,477원` 확인. `/ads/google`에 내부 confirmed 카드와 미매칭 campaign ID 표 표시 | Google Ads API live, operational VM attribution ledger `biocom_imweb`, backend/frontend build, ESLint, curl, Playwright screenshot |
| 2026-04-25 21:55 KST | `segments.conversion_action` 성과 조회와 gap driver 추가. Primary `구매완료` action `7130249515` label `r0vuCKvy-8caEJixj5EB`가 아임웹 자동 NPay count 경로와 일치하고 `Conv. value` `129,954,631원`을 만드는 핵심 원인으로 확인. Secondary `TechSol - NPAY구매 50739`는 `All conv. value` `81,758,081원`만 만든다. `/ads/google`에 전환 액션별 gap 분해 표 추가 | Google Ads API `segments.conversion_action`, `footer/biocomimwebcode.md`, backend/frontend build, ESLint, curl, Playwright screenshot |
| 2026-04-25 23:34 KST | 운영 판단 메모 추가. 광고 전체 OFF는 보류하되, 증액 중지와 Google ROAS 신뢰 중지를 1차 운영 룰로 정리. `purchase primary에서 내린다`와 `confirmed purchase 전환 신설`의 의미를 비개발자용 설명으로 추가 | TJ 질문, 현재 Google Ads API/운영 원장 대조 결과 |
| 2026-04-25 23:43 KST | `naver/npayfeedback.md`, `naver/npayfeedbackreply.md` 검토 결과 반영. NPay return 설정 확인을 1순위, NPay intent capture를 1.5순위, 서버-사이드 GA4/Meta 복구와 Google Ads confirmed conversion 설계를 후속으로 정리 | NPay 문서 2건, GA4/NPay return 누락 기록, Google Ads 전환 액션 segment 결과 |
| 2026-04-25 23:50 KST | 아임웹/네이버페이 공개 문서 조사 결과 반영. 네이버페이 직접 연동의 `returnUrl`은 공식 확인됐지만, 아임웹 내장 네이버페이에서 상점 관리자가 return URL을 지정하는 공개 문서는 찾지 못해 NPay intent capture 설계 착수를 병행하기로 결정 | 네이버페이 개발자센터 FAQ, 네이버페이 결제형 독립몰 연동 개발 가이드, 아임웹 주문 조회 API 문서 |
| 2026-05-05 02:05 KST | Google Ads API 최근 7일/30일 재조회 결과와 [[google-ads-npay-purchase-contamination-report-20260505]] 링크 반영. `구매완료` primary NPay label이 platform conversion value 거의 전부를 만드는 상태를 최신 숫자로 갱신 | `/api/google-ads/dashboard?date_preset=last_7d`, `/api/google-ads/dashboard?date_preset=last_30d` |
| 2026-05-05 02:35 KST | [[google-ads-npay-quality-deep-dive-20260505]]와 [[google-ads-purchase-primary-change-approval-20260505]] 추가. GA4 raw 기준 Google Ads와 Meta 유입의 체류시간, 스크롤, 결제 시작, NPay 클릭을 비교하고 PM/PMax 30~50% 감액 또는 7일 pause test 권고로 갱신 | `backend/scripts/biocom-paid-channel-quality-readonly.ts`, GA4 BigQuery archive, Google Ads API read-only |
