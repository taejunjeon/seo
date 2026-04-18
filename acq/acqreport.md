# 유입결제분석 보고서 — GA4 채널·YouTube·연도별 뷰

작성 시각: 2026-04-18 11:45 KST
기준일: 2026-04-18

## 10초 요약
- 이번 턴의 목적은 `/acquisition-analysis` 화면 하단 `GA4 채널별 결제 분석(바이오컴)` 카드를 **연도별(2024/2025/2026 YTD)로 길게** 볼 수 있게 만들고, 같은 화면의 `YouTube UTM 3개만 추적 중` 문구가 실제 데이터와 **왜 어긋났는지** 사실 기반으로 정리하는 것이다.
- 이번에 같이 닫힌 것은 Sprint3(코호트 LTR 엔드포인트), Sprint6 단계 1~5(카테고리/당당케어/채널×카테고리×재구매/역퍼널), Sprint7(VM customerKey enrichment), Sprint8(VM API 확장 + **VM 재배포 자체**) 전부다. 재배포까지 Claude Code가 직접 수행했다.
- VM 재배포 효과: VM ledger items 1일치 200건 → 17일치 2,541건(12.7×), `joinableRatePercent` 4.9% → 67.7%(13.8×), `cohort-ltr` customerCount 합 261 → 1,811(6.9×). 채널별 customer 실수치가 YouTube 39·Meta 413·TikTok 65·Google 134·Other 1,160으로 확인됨.
- 아직 안 닫힌 부분은 두 개. 하나는 VM이 2026-04-12 cutover라 오늘 기준 17일치만 있어 **180일 LTR 성숙 cohort가 시간이 쌓여야 의미를 가진다**는 점(시간 문제, 코드로 못 풂). 둘째는 `channel-category-repeat`의 cell이 모두 `category=other`로 떨어지는 점 — VM의 `imweb_order_items` 데이터 부재로 추정. 이걸 `[[#Phase1-Sprint9]]`(VM 상품 카테고리 동기화)로 새로 열었다.
- Sprint9 전 단계 완료(2026-04-18 11:10). B안 구현·로컬·VM backfill 96,304건 + Sprint6 재검증까지. `channel-category-repeat` nonzero cell 5→12, supplement/test_kit/당당케어 분류 작동 확인.
- 프론트 반영(2026-04-18 11:45). `/acquisition-analysis` 하단에 `<CohortCategoryCard>` 추가 — 코호트 교차표·역퍼널·ID 진단·관측 한계 박스까지 화면에서 직접 확인 가능.
- 남은 제약: VM 17일치 히스토리라 대부분 cell의 `n` 이 작음. 대안 데이터(GA4/Imweb/Playauto/Meta CAPI 등) 7가지 경로를 검토했으나 **VM attribution_ledger 가 유입×고객 3축 동시 분석의 유일한 원천**임을 확인. 시간의 문제, 추가 TJ 액션 없음. 자세한 검토 이력은 본 문서 §VM 17일치 히스토리 한계 참조.

## 고등학생 비유
이번 작업은 **가게 손님 장부를 연도별로 넘길 수 있게 하고, "유튜브 단골은 3명뿐"이라고 써 있던 잘못된 쪽지를 세어 보니 22명이어서 고친 일**이다.

## Phase-Sprint 요약표
| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 연도별 GA4 뷰 | Claude Code | 100% / 100% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | UTM 카운트 정정 | Claude Code | 100% / 100% | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | 코호트 LTR 엔드포인트 | Codex | 100% / 10% | [[#Phase1-Sprint3\|이동]] |
| Phase1 | [[#Phase1-Sprint6]] | 당당케어×팀키토 YouTube 론 코하비 검증 | Codex + TJ | 70% / 40% | [[#Phase1-Sprint6\|이동]] |
| Phase1 | [[#Phase1-Sprint7]] | VM 원장 customer_key 적재 | Claude Code + TJ | 70% / 30% | [[#Phase1-Sprint7\|이동]] |
| Phase1 | [[#Phase1-Sprint8]] | VM 원장 히스토리 확보 | Claude Code | 100% / 100% | [[#Phase1-Sprint8\|이동]] |
| Phase1 | [[#Phase1-Sprint9]] | VM 상품 카테고리 동기화 | Claude Code | 100% / 100% | [[#Phase1-Sprint9\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | UTM 스킴 표준화 | TJ + Claude Code | 대기 | [[#Phase2-Sprint4\|이동]] |
| Phase2 | [[#Phase2-Sprint5]] | Acquisition OMTM 재정의 | TJ + Codex | 대기 | [[#Phase2-Sprint5\|이동]] |

## 문서 목적
이 문서는 `유입결제분석 = /acquisition-analysis` 화면이 지금 어디까지 믿을 만한지, 어떤 숫자가 오해이고 어떤 숫자가 사실인지, 그리고 다음에 무엇을 더 심을지를 대표·운영자·개발자가 같은 언어로 읽을 수 있게 정리한다.

## 이번 턴이 하는 일
- 화면 하단 `GA4 채널별 결제 분석(바이오컴)` 카드에 연도 버튼(2024, 2025, 2026 YTD)을 추가해서 `GA4 Data API`에 같은 `startDate/endDate`를 그대로 넘긴다.
- 카드 안내 문구에 "현재 3개 UTM만 추적 중"이라고 고정 박혀 있던 줄을 실시간 YouTube 관련 유입원 수(유기 referrer + UTM 태깅 합계)로 바꾼다.
- `YouTube LTV 6배` 이야기의 출처를 추적해, 실제로는 **전환율** 비교라는 사실을 보고서에 못 박는다.
- 다음 단계로 갈 OMTM과 코호트 실험의 윤곽을 `leandata/` 3개 문서 흐름에 맞춰 제안한다.

## 왜 필요한가
- 현재 카드는 최근 7/14/30/90일만 보여준다. 바이오컴은 2024년에 이미 연 60억대 GA4 매출이 쌓여 있어, 분기·계절 효과를 보려면 연 단위가 필요하다.
- "3개 UTM"이라는 고정 문구는 **최근 30일 어느 시점의 관찰**을 그대로 굳혀 놓은 것이라, 읽는 사람이 "유튜브 태깅이 거의 안 돼 있다"고 오해한다. 실제로는 태깅은 많이 붙어 있고, 일관성(Naming Scheme)이 문제다.
- `6배` 이야기는 현재 "유튜브에 더 넣어야 한다"는 경영 판단의 핵심 근거가 돼 있는데, 그 숫자의 출처가 LTV인지 전환율인지 애매하면 후속 의사결정이 엉뚱한 방향으로 간다.

## 실제로 바뀐 것
- 프론트 `frontend/src/app/acquisition-analysis/page.tsx`
  - `DATE_RANGES` 상수를 `{ value, label, mode, days?, year? }` 형태로 확장. `mode: "days"`와 `mode: "year"` 두 가지를 처리한다.
  - `GA4ChannelAnalysis` 컴포넌트에 `rangeValue` 상태와 `resolvedRange` 메모를 추가. year 모드면 `YYYY-01-01 ~ YYYY-12-31`, 단 현재 연도면 어제까지를 끝날짜로 쓴다.
  - 카드 상단 안내문 아래에 `조회 기간: YYYY-MM-DD ~ YYYY-MM-DD`를 표시해 어떤 범위를 보고 있는지 명확히 한다.
  - YouTube 인사이트 박스의 "현재 3개 UTM만 추적 중" 줄을 `youtubeRows.length`로 치환하고, 유기 referrer와 UTM 태깅의 차이를 한 줄로 붙였다.
- 백엔드 변경 없음. `GET /api/ga4/source-conversion`은 이미 임의 `startDate/endDate`를 받는다(라우트: `backend/src/routes/ga4.ts:1154`).

## 실측 결과

### 연도별 숫자 요약
아래는 `2026-04-18 02:35 KST` 시점에 `/api/ga4/source-conversion?site=biocom&limit=500`으로 받은 값이다. `limit=500`이라 전 전환이 다 들어오지는 않고, GA4 API가 `grossPurchaseRevenue` 내림차순으로 상위 500행을 반환하는 구조다. "상위 500행에 잡힌 누적치" 기준임을 기억해 둔다.

| 구분 | 2024 | 2025 | 2026 YTD(4/17) |
|---|---|---|---|
| 상위 500행 전체 구매 | 17,172건 | 34,586건 | 10,425건 |
| YouTube 관련 유입원 수 | 4개 | 22개 | 16개 |
| YouTube 총 세션 | 10,496 | 39,830 | 2,942 |
| YouTube 총 구매 | 367건 | 1,216건 | 79건 |
| YouTube 총 매출 | 64,833,852원 | 189,943,079원 | 6,497,627원 |
| YouTube 세션→구매 전환율 | 3.50% | 3.05% | 2.69% |

### YouTube 유입 분해 (2025년)
2025년을 기준으로 "유기 referrer"(`youtube.com`, `m.youtube.com`)와 "UTM 태깅"을 분리하면 다음과 같다.

| 구분 | 유입원 수 | 세션 | 구매 | 매출 | 전환율 |
|---|---|---|---|---|---|
| 유기 referrer | 2개 | 15,296 | 319건 | 82,483,013원 | 2.09% |
| UTM 태깅(`utm_source=youtube_...`) | 20개 | 24,534 | 897건 | 107,460,066원 | 3.66% |

핵심 관찰:
- 사실: 태깅된 YouTube 유입은 20개짜리 긴 리스트인데, 네이밍이 `youtube_teamketo0527dangdang_dangdnagcare`, `youtube_community_bangtanjelly`, `youtube_sibo_acid`, `youtube_teamketo_qna0707_acid`, `teamketoyoutube_biocom_earlybird_metadream` 처럼 제각각이다. 채널명·에피소드명·제품군이 한 값에 섞여 있다.
- 사실: 같은 영상을 가리킬 가능성이 있는 값이 2~3개로 쪼개져 보인다(예: `youtube_teamketo_0309_acid` vs `youtube_teamketomarket_acid`). 동일 영상을 합쳐 봐야 `영상별 ROI`가 의미를 갖는다.
- 유력 가설: "UTM 3개뿐" 문구는 더 이른 시점의 최근 30일 스냅샷(유기 referrer 계열 3개만 잡혔을 때)을 근거로 쓴 문장이 고정 카피로 남아 있던 것이다. 확정 아님. 2026-03-18 ~ 2026-04-17 스냅샷만 봐도 YouTube 관련 유입원은 19개로 관찰된다.

### /callprice 기존 인사이트 교차 참조
`/callprice` 페이지 하단 `인사이트` 박스에 이미 확인된 숫자가 있고, 본 보고서의 `[[#Phase1-Sprint6]]`는 이 숫자를 **채널 축으로** 쪼개는 작업이다. 원본은 운영 CRM 로컬 DB 기반 집계다.

| 축 | 숫자 | 의미 |
|---|---|---|
| 첫 구매 영양제 고객 재구매율 | 45.1% | 정기구독 중심 반복 구매 구조 |
| 첫 구매 검사권 고객 재구매율 | 16.1% | 검사권은 단발 소비 성향 |
| 재구매율 배율 | 2.8× | 영양제 첫 구매 쪽이 약 2.8배 |
| 검사권 첫 구매 고객 평균 총매출 | 382,420원 | 단가 높음(295,859원/건) |
| 영양제 첫 구매 고객 평균 총매출 | 239,485원 | 단가 낮음(68,692원/건), 재구매로 LTV 누적 |
| 영양제 → 검사 역퍼널 전환 | 7.0% | 영양제로 시작한 사람 중 이후 검사 구매 비율 |

현재 판단: 이 숫자들은 **전사 평균**이다. `/callprice` 는 채널을 쪼개지 않는다. 따라서 `팀키토 YouTube → 당당케어 → 재구매` 같은 "설득이 들어간 채널"의 효과는 이 숫자 아래에 섞여서 안 보인다. `[[#Phase1-Sprint6]]`가 바로 이 경로를 분리해 본다.

### 채널별 벤치마크 대조 (2025년 biocom)
| 채널 | 세션 | 구매 | 매출 | 전환율 |
|---|---|---|---|---|
| naver | 360,956 | 8,557 | 2,129,260,420원 | 2.37% |
| meta | 607,047 | 6,694 | 1,921,614,606원 | 1.10% |
| other(YouTube 포함) | 286,441 | 5,982 | 1,369,803,362원 | 2.09% |
| not_set | 23,477 | 9,476 | 1,340,108,915원 | 40.36% |
| direct | 158,876 | 2,687 | 662,103,210원 | 1.69% |
| google | 127,808 | 1,171 | 282,084,872원 | 0.92% |

- E-commerce 벤치마크(`Lean Analytics`, Part 3): 평균 2%, 좋음 10%.
- YouTube 태깅(3.66%)과 naver(2.37%)는 벤치마크를 넘는다.
- meta(1.10%)와 google(0.92%)는 벤치마크 아래다. 다만 meta는 유입량 자체가 가장 크다는 점을 같이 봐야 한다.
- not_set 40.36%는 실제 전환율이 아니라 **자사몰 내부 리다이렉트가 세션을 끊고 purchase만 잡는 PG 복귀 패턴**이다. 이 문제는 `tracking-integrity` 화면과 `다음할일0416.md`에서 별도 추적 중인 주제라 이 문서에서는 다루지 않는다.

### Sprint6 단계 1~5 실행 결과 (2026-04-18 03:25 KST)
이번 턴에 Codex 위임으로 Sprint6 단계 1~5를 실제로 착수했다. 코드는 완성·테스트 통과·엔드포인트 `HTTP 200`, 그러나 **VM 원장 `customerKey` 필드가 거의 비어 있어 실수치는 0**이 나온다.

- 변경 파일: `backend/src/acquisitionCohort.ts` 13KB → 28KB, `backend/src/routes/attribution.ts` `+113줄`, 신규 테스트 `backend/tests/acquisition-cohort-purchase.test.ts`.
- TS 체크: `cd backend && npx tsc --noEmit` 통과. 테스트: `npx tsx --test tests/acquisition-cohort*.test.ts` → `1..6 pass 6 fail 0`.
- 신규 엔드포인트 3종 실호출(`startAt=2026-01-01&endAt=2026-04-17&dataSource=vm`):

| 엔드포인트 | 응답 | 주요 필드 |
|---|---|---|
| `/api/attribution/cohort-ltr` | 200, `dataSource: operational_vm_ledger` | 전 채널 `customerCount=0` |
| `/api/attribution/channel-category-repeat` | 200 | 20 cells 전부 `customerCount=0` |
| `/api/attribution/reverse-funnel` | 200 | `overall.supplementFirstBuyers=0`, `byChannel[*].rate=0` |

왜 0이 나왔는가 (근거):
- `/api/attribution/acquisition-summary?rangeDays=90&dataSource=vm` 은 같은 원장에서 `biocom=51, thecleancoffee=140, aibio=19`건 총 210 conversions를 정상 응답한다. 즉 **VM 원장에 row는 있다**.
- 그러나 Sprint6 코호트는 `AttributionLedgerEntry.customerKey`가 비어 있지 않은 row만 first_touch 스냅샷에 남긴다(`backend/src/acquisitionCohort.ts:453-455`). `customerKey`가 비어 있으면 `imweb_orders` 조인 키가 없으므로 제외된다.
- 현재 `hasIdentity`(`backend/src/acquisitionAnalysis.ts:515`)는 `gaSessionId | clientId | userPseudoId` 존재로 판단한다. 이건 `acquisition-summary`의 `identityCoverageRate`(biocom 100%)를 계산하는 기준이며, **`customerKey` 필드 자체의 채움 여부는 따로 진단되지 않는다**.
- 유력 가설: VM 원장 이벤트 수신 코드가 Toss/Imweb 결제 성공 웹훅에서만 `customerKey`를 채우고, 일반 랜딩/폼 제출/리퍼러 이벤트에서는 공백으로 남긴다. 결제 성공 row는 전체의 소수라, 210건 중 first_touch로 잡히는 row가 0에 가깝다.

이 발견이 `[[#Phase1-Sprint7]]`를 새로 연 이유다. Sprint6 코드 자체는 정확하다.

### Sprint3 엔드포인트 첫 호출
`curl http://localhost:7020/api/attribution/cohort-ltr?startAt=2026-01-01&endAt=2026-04-17` → `HTTP 200`, `ok: true`.

| 채널 | customerCount | d30.n | d90.n | d180.n |
|---|---|---|---|---|
| youtube | 0 | 0 | 0 | 0 |
| meta | 0 | 0 | 0 | 0 |
| tiktok | 0 | 0 | 0 | 0 |
| google | 0 | 0 | 0 | 0 |
| other | 1 | 0 | 0 | 0 |

읽는 법: 이 엔드포인트는 **로컬 `attribution_ledger`**만 보는데, 이 프로젝트의 실제 원장은 VM 쪽에 쌓인다. 따라서 이 숫자는 `코드가 작동함`의 증거이지 `실제 코호트 크기`가 아니다. `[[#Phase1-Sprint6]]` 단계 1에서 `dataSource=vm` 옵션을 붙여 원격 원장을 조회하게 하면 의미 있는 숫자로 바뀐다.

## 무엇이 증명됐는가
- 사실: 연 단위 GA4 조회가 `GET /api/ga4/source-conversion?startDate=2024-01-01&endDate=2024-12-31` 로컬 호출에서 정상 응답(`HTTP 200`, 상위 500행)을 돌려준다. 프론트 토글만 추가하면 됐다.
- 사실: 2024→2025 사이 YouTube 관련 유입원 수는 4 → 22로 늘었다. UTM 태깅 자체는 이미 작동 중이다.
- 사실: "3개만 추적 중"은 사실이 아니다. 2026-04-17 기준 최근 30일에만 19개가 잡혔다.
- 사실: YouTube 태깅 유입의 세션→구매 전환율(3.66%, 2025년 전체)이 meta(1.10%)의 약 3.3배다. 단, 이것은 **전환율** 비교이지 LTV 비교가 아니다.
- 사실: `/api/attribution/cohort-ltr`, `/api/attribution/channel-category-repeat`, `/api/attribution/reverse-funnel`, `/api/attribution/identity-diagnostics` 네 엔드포인트가 백엔드에 추가되어 `dataSource=vm` 포함 전부 `HTTP 200`을 돌려주며, `node:test` 6건 모두 통과한다.
- 사실: VM 원장(operational_vm_ledger)에는 최근 90일 기준 biocom 51·thecleancoffee 140·aibio 19 총 210 conversion row가 있다. 단, `/api/attribution/ledger` API는 source당 200건 상한이며 그 200건이 전부 `2026-04-17` 하루치다(VM 쪽 API 한계).
- 사실: Sprint7 enrichment 적용 후 VM ledger customerKey 채움률은 88.8%(filled 381/429, 하루치 snapshot 기준). Sprint8 재배포 후 17일치 기준으로는 96.3%(filled 2,674/2,778). joinableRatePercent 4.9% → 67.7%.
- 사실: Sprint8 재배포 후 `cohort-ltr?dataSource=vm` customerCount: youtube=39 / meta=413 / tiktok=65 / google=134 / other=1,160. Sprint9 완료 후 `channel-category-repeat` nonzero cell 5→12로 증가, supplement/test_kit/당당케어 전부 분류 작동. 첫 관측값: `other supplement` 재구매율 27.0%(n=37), `meta test_kit` 2.6%(n=39), `youtube 당당케어` 1명. 역퍼널 영양제→검사 전체 2.4%(41명 중 1명). 180일 LTR revenue는 VM 17일치 히스토리 한계로 아직 0 — 시간이 쌓여야 의미를 가진다.
- 사실: 2025년 기준 `youtube_teamketo0527dangdang_dangdnagcare` 단일 UTM이 YouTube 태깅 전체 매출의 24.5%(46,592,870 / 189,943,079), 구매의 42.3%(514/1,216)를 차지한다. 당당케어 계열이 YouTube 내 상위 성과 클러스터라는 것은 GA4 세션 단위로 확인됐다(고객 단위 확인은 Sprint8 이후).

## 아직 증명되지 않은 것
- YouTube 유입 고객의 **LTV가 Meta 유입 고객의 6배**라는 주장은 지금 코드·데이터로는 확인되지 않는다. 원본 문장(`다음할일0416.md:45`)은 `YouTube 당당케어 5.6%(36건/644세션) vs Meta kimteamjang 0.9%(31건/3,372세션)` 전환율 비교였다. 이 `5.6 / 0.9 ≈ 6` 이 6배의 출처로 보인다.
- 유력 가설: YouTube 유입 고객의 LTV가 정말 더 높을 가능성은 있다(콘텐츠가 설득 도구이므로 첫 구매 의향이 확실하고 재구매로 이어질 개연성이 큼). 하지만 이를 증명하려면 이 문서의 `[[#Phase1-Sprint6]]` 코호트 실측이 돌아야 한다.
- 유기 referrer(`youtube.com/referral`) 세션의 **어느 영상에서 왔는지**는 현재 데이터로 복원 불가하다. YouTube가 referrer를 도메인까지만 넘기기 때문이다. 이건 Sprint4의 UTM 표준화로만 풀린다.
- `/callprice` 의 `영양제 첫 구매 재구매율 45.1%` 가 **모든 채널에서 45.1%인지, YouTube만 60%대이고 Naver는 30%대인지**는 현재 분리돼 있지 않다. 본 보고서의 가설은 "당당케어 × 팀키토 YouTube 첫 구매자가 상위"이지만, 숫자가 없는 가설이다.
- Sprint7으로 customerKey 공백 문제는 88.8%까지 해소됐지만, VM ledger API가 하루치 200건만 돌려주는 한계 때문에 180일 LTR 컷은 여전히 불가. 180일 실제 LTR 비교는 `[[#Phase1-Sprint8]]` 이후에 가능.

## 산출물
- 화면 연도 전환 버튼: `최근 7/14/30/90일` + `2024년 / 2025년 / 2026년 YTD`.
- 조회 기간 표시 줄: 토글을 눌렀을 때 실제 어떤 날짜 범위를 쿼리하는지 보여줌.
- 정정된 UTM 문구: 실시간 카운트 + 유기/태깅 구분 설명.
- 이 보고서(`acq/acqreport.md`): 연도별 숫자 snapshot + UTM 분해 + Lean Analytics 적용 노트.
- 개발 부록: 코드 위치, API 파라미터.

## 우리 프로젝트에 주는 도움
- 이 카드가 장기로 보이면, `YouTube 투자를 더 할 것인가 / 유지할 것인가`를 **최근 30일 스냅샷** 하나로 판단하지 않게 된다. 2024년 4분기와 2025년 4분기를 같은 화면에서 비교할 수 있기 때문이다.
- "UTM 3개" 오해가 풀리면, 당장 해야 할 일이 "UTM 추가 설치"가 아니라 `UTM 네이밍 표준화`로 이동한다. 작업 성격이 완전히 다르다.
- `6배`의 실체가 전환율이라는 것을 못 박으면, `"YouTube 영상 한 편당 Meta 광고 한 캠페인의 6배 가치가 있다"`처럼 숫자를 잘못 들고 가는 피치를 막는다.
- Lean Analytics 관점에서 Acquisition 영역은 현재 프로젝트의 약한 부분이다(`leancodex0326.md` §8.2). 이번 작업은 그 중 `채널×기간 대조`를 먼저 메운다.

## 다음 액션
표기 규칙:
- **필수**: 이 항목이 없으면 다음 Sprint 진행이 막힌다.
- **권장**: 다음 Sprint 진행에는 지장 없지만, 숫자 신뢰·운영 판단 품질을 위해 TJ가 확인하면 좋다.

- 지금 당장
  - [TJ] **필수** — 없음. Sprint9까지 전부 닫혔고 구조는 작동 중.
  - [TJ] 권장 — `/acquisition-analysis`에서 `2024년`, `2025년`, `2026년 YTD` 버튼을 눌러 GA4 숫자가 일치하는지 육안 확인.
  - [TJ] 권장 — 현재 VM의 `channel-category-repeat` 응답을 직접 훑어보고 "17일짜리 표본이 작다"는 체감을 실제 숫자로 확인. 그 감이 `[[#Phase2-Sprint5]]` OMTM 지정에 쓰임.
- 이번 주
  - [TJ] 권장 — UTM 표준 초안 승인(`utm_source=youtube`, `utm_medium=video|short|community`, `utm_campaign=<slug>`, `utm_content=<video_id>`). `[[#Phase2-Sprint4]]` 최소 집합 진입 신호.
  - [Claude Code] 권장 — incremental sync cron(30분 주기)을 `startBackgroundJobs.ts`에 추가. 없어도 수동 POST로 동작하므로 필수 아님.
  - [TJ] 권장 — UTM 표준 초안 승인(`utm_source=youtube`, `utm_medium=video|short|community`, `utm_campaign=<slug>`, `utm_content=<video_id>`). `[[#Phase2-Sprint4]]` 최소 집합 진입 신호.
- 승인 후 (Sprint9 닫힌 뒤)
  - [TJ] **필수** — `[[#Phase1-Sprint6]]` 단계 6 샘플 20명 육안 검증.
  - [Claude Code] **필수** — `[[#Phase1-Sprint6]]` 단계 7 — 채널별 영양제 재구매 LTV 카드 UI.
  - [TJ+Claude Code] 권장 — UTM 표준을 영상 제작 체크리스트에 추가하고, 기존 태깅 URL을 표준 스킴으로 일괄 치환(`[[#Phase2-Sprint4]]` 전체 집합).
  - [Codex+TJ] **필수** — Acquisition OMTM을 `YouTube Payback Period`로 정식 지정(`[[#Phase2-Sprint5]]`). 없으면 Sprint5가 닫히지 않는다.

## Sprint 상세

### Phase1-Sprint1
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 연도별 GA4 뷰
**상태**: 100% / 100%

- 무엇을 했는가: 화면 하단 카드의 기간 토글에 `2024년`, `2025년`, `2026년 YTD` 세 버튼을 추가했다. 백엔드는 그대로 두고 프론트에서 `startDate/endDate`를 계산해 보낸다.
- 왜 필요한가: 연 단위 비교 없이는 YouTube 투자가 2024 → 2025 어떻게 늘었는지, 커버리지가 몇 배가 됐는지 보기 어렵다.
- 실측 결과: 2024년 YT 총 구매 367건 / 6,480만원, 2025년 1,216건 / 1억 8,994만원 (상위 500행 기준).
- 산출물: `page.tsx`의 `DATE_RANGES`, `GA4ChannelAnalysis`의 `rangeValue`, `resolvedRange`, 조회 기간 표시 줄.

#### 역할 구분
- TJ: 연도별 숫자가 실제 Ads Manager·Toss 콘솔 숫자와 어긋나는지 육안 점검.
- Codex: 해당 없음 (백엔드 변경 없음).
- Claude Code: 프론트 토글·상태·표시 줄 구현, TS 타입 체크 통과 확인.

### Phase1-Sprint2
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: UTM 카운트 정정
**상태**: 100% / 100%

- 무엇을 했는가: 카드 하단 안내문의 "현재 3개 UTM만 추적 중"이라는 고정 문장을 실시간 `youtubeRows.length` 카운트로 교체했다. 유기 referrer와 UTM 태깅을 한 줄로 구분했다.
- 왜 필요한가: 고정 문장이 "유튜브 태깅이 거의 없다"는 잘못된 결론을 불러왔다. 실제 문제는 태깅의 양이 아니라 네이밍 표준이다.
- 실측 결과: 2025년 전체에서 YouTube 관련 유입원 22개, 2026-03-18 ~ 2026-04-17 19개, 2024년 전체 4개.
- 산출물: `GA4ChannelAnalysis`의 YouTube 인사이트 박스 문구, 이 보고서의 `[[#실측 결과]]` 섹션.

#### 역할 구분
- TJ: 없음 (확인만).
- Codex: 없음.
- Claude Code: 문구 교체, 데이터 기반 카운트 연결.

### Phase1-Sprint3
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 코호트 LTR 엔드포인트
**상태**: 100% / 10%

- 무엇을 했는가: Attribution 원장 기반으로 YouTube/Meta/TikTok/Google/Other 유입원을 분류하고, `customer_key`별 first_touch → Imweb 주문 조인 → `30일 / 90일 / 180일` 누적 매출을 집계하는 엔드포인트와 퓨어 분류 함수를 백엔드에 심었다.
- 실제로 바뀐 것:
  - 신규 모듈: `backend/src/acquisitionCohort.ts` — 분류 규칙 `classifyAttributionChannel`, `FirstTouchSnapshot`, `CohortWindowSummary`, 코호트 빌더.
  - 신규 엔드포인트: `GET /api/attribution/cohort-ltr?startAt=&endAt=&channel=` — 응답에 `channels[].customerCount`, `channels[].matureCohort.d30/d90/d180.{n,revenue,median}`, `sampleFirstTouches` 포함.
  - 신규 테스트: `backend/tests/acquisition-cohort.test.ts` 3건 `node:test` 통과(`npx tsx --test tests/acquisition-cohort.test.ts` → `1..3 pass 3`).
  - 백엔드 TS 체크: `npx tsc --noEmit` 통과.
- 실측 호출 결과(로컬): `GET /api/attribution/cohort-ltr?startAt=2026-01-01&endAt=2026-04-17` → `HTTP 200`. 현재 로컬 `attribution_ledger` 테이블이 거의 비어 있어(`other: 1`, 나머지 채널 0) 실수치는 의미를 갖지 못한다. 즉 **코드는 준비 완료, 데이터 연결은 미완료**.
- 왜 아직 운영 기준 10%인가: 본 프로젝트의 본 attribution 원장은 운영 VM(`data-source=vm`) 쪽에 쌓여 있는데, 이 엔드포인트는 로컬 `attribution_ledger`만 조회한다. 로컬로 VM 원장 스냅샷을 싱크하는 동기화 잡이 붙거나, 엔드포인트에 `dataSource=vm` 옵션을 추가해 원격 원장을 그대로 조회하게 해야 의미 있는 숫자가 나온다.
- 조인 전제(스키마 사실): Attribution 원장 키 `customer_key`(`backend/src/attributionLedgerDb.ts:55`), Imweb 주문 조인 `member_code` 1차 + 정규화된 `orderer_call` 2차(`backend/src/crmLocalDb.ts:271`).
- 성숙 기간 정의(고정): `first_touch_at` 이후 `30일 / 90일 / 180일`. 60일은 사용하지 않는다.
- 우리 프로젝트에 주는 도움: Acquisition 단계 OMTM의 계산 엔진이 코드 레벨에서 준비됐다. 이후 `[[#Phase1-Sprint6]]`가 이 엔드포인트를 VM 원장에 물려 실데이터로 돌린다.

#### 역할 구분
- TJ: 이 엔드포인트를 VM 원장에 물릴지, 또는 Meta 47명 추적과 같은 방식으로 별도 스냅샷 테이블을 만들지 방향 결정.
- Codex: 구현 완료(본 Sprint 범위). 다음 단계(VM 연결)는 `[[#Phase1-Sprint6]]`에서 재개.
- Claude Code: 해당 없음 (백엔드 전용 턴이었음).

### Phase1-Sprint6
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 당당케어 × 팀키토 YouTube 론 코하비 검증
**상태**: 70% / 40% (단계 1~5 코드·Sprint7 enrichment·Sprint8 히스토리·Sprint9 카테고리 분류 전부 반영. 표본이 17일치 VM 히스토리라 작음. 단계 6(샘플 육안 검증)·단계 7(프론트 UI)·단계 8(최종 결론)은 VM 히스토리 180일 누적 후에 의미 있게 가능)

- 무엇을 하는가: `/callprice` 페이지 하단 인사이트에서 확인된 `영양제 첫 구매 재구매율 45.1% vs 검사권 첫 구매 16.1%`(배율 2.8×) 패턴과, 영양제→검사 역방향 퍼널 `7.0%` 전환 패턴을 "**어떤 채널에서 온 영양제 첫 구매자**"에서 가장 크게 일어나는지 데이터로 확인한다. 특히 팀키토 YouTube로 유입돼 당당케어를 산 고객의 재구매율·LTV가 다른 채널(Meta, Naver, Direct) 대비 정말로 높은지를 **론 코하비(Ron Kohavi) 『Trustworthy Online Controlled Experiments』 체크리스트**로 검증한다.
- 왜 필요한가: `/callprice` 인사이트는 "영양제 → 검사 전환 상담이 매출 극대화에 유효하다"로 끝난다. 이 상담 타깃을 좁히려면 "어떤 채널에서 들어온 영양제 고객이 가장 역퍼널 전환율이 높은가"가 필요하다. 가설은 "팀키토 YouTube 유입 당당케어 구매자는 제품·콘텐츠에 대한 이해가 이미 깊어, 역퍼널 전환율과 재구매율이 다른 채널보다 유의미하게 높을 것"이다. 이 가설을 **먼저 의심하고**(Twyman's Law) 증거로 확인·기각한다.
- 산출물: 채널 × 첫 구매 카테고리(영양제/검사권/기타) × 재구매 세그먼트의 교차 표, `/acquisition-analysis` 또는 `/callprice` 하단에 추가될 `채널별 영양제 재구매 LTV` 카드, 본 보고서의 Phase1-Sprint6 검증 결과 업데이트.
- 우리 프로젝트에 주는 도움:
  - 상담 우선순위 스코어링이 가능해진다(어느 채널 유입을 먼저 상담할지).
  - 영상 제작 예산 배분 기준이 생긴다(당당케어·팀키토 계열 영상이 정말 LTV를 끌어올리는가).
  - `[[#Phase1-Sprint3]]`의 비어 있는 숫자를 의미 있는 숫자로 채운다.
- 지금까지의 first-cut 관찰 (2025년 전체, GA4 `/api/ga4/source-conversion` 기준):
  - `youtube_teamketo0527dangdang_dangdnagcare`: 7,845 세션, 514 구매, 46,592,870원, 전환율 6.55%. UTM 태그된 YouTube 유입 중 구매수·매출 모두 **1위**.
  - `youtube_biocom_dangdangcare_teamketo`: 678 세션, 36 구매, 3,233,859원, 전환율 5.31% (최근 30일도 1위).
  - `youtube_community_dangdang3`: 905 세션, 50 구매, 4,546,464원, 전환율 5.52%.
  - UTM 태그된 YouTube 전체 평균 전환율 3.66% > Meta 평균 1.10%. 당당케어 계열은 YouTube 내에서도 상위 전환율 그룹.
  - 사실: 당당케어 계열이 YouTube UTM에서 매출 1위라는 것은 확인된다. 재구매율/LTV는 아직 확인 안 됨.

#### 론 코하비 체크리스트 (이 Sprint를 덮는 6가지 함정)
이 Sprint의 모든 결론은 아래 6가지를 통과해야 채택된다.

1. **Twyman's Law (의심스러운 결과는 먼저 의심하라)**: `YouTube 유입 LTV 6배`, `45.1% vs 16.1%` 같은 강한 배율은 "측정 오류가 아닌가"를 먼저 확인한다. 대체 설명 4개를 기각한 뒤에만 "인과"라고 쓴다.
2. **SRM (Sample Ratio Mismatch)**: 각 채널의 표본 수가 기대 분포와 크게 다르면(예: YouTube 유입 고객 수가 GA4 세션 비중과 비례하지 않으면), Attribution 원장의 식별 누락을 먼저 의심한다.
3. **Selection bias (선택 편향)**: 팀키토 YouTube 시청자는 이미 영양제·키토·건강에 관심이 있는 사람이다. 이 사람의 재구매율이 높은 것이 "YouTube 콘텐츠의 설득력" 때문인지, "원래부터 관심이 강한 집단"이 선별돼 들어온 것인지 분리할 수 없다. 관찰 데이터만으로 인과 주장 금지.
4. **Survivorship bias (생존 편향)**: 첫 구매 후 환불·이탈한 고객이 빠진 코호트만 보면 재구매율이 과대평가된다. 첫 구매 전체를 분모로 하고, 환불·취소는 구매 건수에서만 제외한다.
5. **OEC 정의 (Overall Evaluation Criterion)**: 단일 숫자로 채널을 비교하려면 OEC가 있어야 한다. 본 Sprint의 OEC 후보는 `채널별 180일 누적 순매출 중앙값 ÷ 첫 구매당 광고·제작비`(단위 경제성). 평균 대신 중앙값을 쓰는 이유는 큰 주문 몇 건이 평균을 끌어올리는 왜곡을 줄이기 위해서다.
6. **충분한 Power (최소 표본)**: 채널별 최소 50명 first_touch 확보 이전에는 배율 수치를 외부에 인용하지 않는다. 50명은 `/다음할일0416.md`의 Meta 47명 수준을 따른 실무 하한선이다.

#### 관찰 데이터 한계 인정
이 Sprint는 A/B 테스트가 아니라 **관찰 연구**다. 따라서 다음 세 가지 표현은 결론에 쓸 수 없다.

- "YouTube 때문에 재구매율이 올랐다" → "YouTube 유입 고객의 재구매율이 관찰 기간에 더 높게 측정됐다"로만 쓴다.
- "이 영상이 매출을 만든다" → "이 영상 UTM을 통해 들어온 고객이 N일 내 결제한 합이 X원이다"로만 쓴다.
- "6배 효과" → "관찰 배율 6배. 교란변수 N개 미제거"를 같이 쓴다.

인과 주장이 필요하면 `[[#Phase2-Sprint4]]` 이후에 YouTube 영상 URL의 UTM `content=A/B`로 간단한 A/B 랜딩 실험을 한 번 돌리는 것을 별도 Sprint로 뽑는다.

#### 역할 구분
- TJ: 팀키토 영상 URL·제작비·업로드 일정 원본 자료 제공. 채널 ROI 판단.
- Codex: `[[#Phase1-Sprint3]]` 엔드포인트를 VM 원장에 물리는 옵션 추가, 첫 구매 상품 카테고리(영양제/검사권/기타) 분류 로직, 채널×카테고리×재구매 교차 쿼리, 역퍼널(영양제→검사) 전환 쿼리.
- Claude Code: `/acquisition-analysis` 또는 `/callprice` 하단에 `채널별 영양제 재구매 LTV` 카드 추가, 론 코하비 체크리스트 주석(숫자 옆 "관찰 기준 N명, 교란 미제거" 배지).

#### 실행 단계
1. ~~[Codex] `/api/attribution/cohort-ltr` 엔드포인트에 `dataSource=vm` 옵션 추가~~ — **완료** (2026-04-18). `shouldUseRemoteAcquisitionLedger` 재사용, 응답에 `dataSource`·`remoteWarnings` 추가.
2. ~~[Codex] first_touch 고객의 **첫 주문 상품 카테고리**~~ — **완료**. `categorizeProductName`(`consultation.ts:95`) 재사용, 우선순위 `test_kit > supplement > other`.
3. ~~[Codex] 당당케어 상품 식별 규칙~~ — **완료**. `item_name` 공백 정규화 후 `당당케어` 포함 여부로 `is_dangdangcare` 플래그.
4. ~~[Codex] 채널 × first_purchase_category × 재구매 교차 집계~~ — **완료**. `GET /api/attribution/channel-category-repeat` 엔드포인트 추가, cells 20개 전부 (5채널 × 3카테고리 + supplement-당당케어 5개 하위 행).
5. ~~[Codex] 역퍼널 쿼리~~ — **완료**. `GET /api/attribution/reverse-funnel` 엔드포인트. `overall`·`byChannel` 응답.
6. [TJ] 단계 4·5 결과를 20명 샘플 육안 확인. 의존성: 선행필수. 당당케어 필터·채널 분류가 잘못되면 이후 결론 전부 무효. **블로킹 중** — Sprint7이 먼저 닫혀야 숫자가 0에서 벗어난다.
7. [Claude Code] `/acquisition-analysis` 하단에 `채널별 영양제 첫 구매 재구매·LTV 카드` 추가 (채널당 customerCount / 180일 재구매율 / 중앙값 LTV / 역퍼널 전환율). 각 숫자 옆에 `N=..., 관찰` 배지. 의존성: 단계 6 통과.
8. [TJ] 이 보고서의 §Phase1-Sprint6 결과란 업데이트. "6배" 주장이 관찰 데이터로 기각됐는지, 재정의됐는지, 혹은 유효한지 명시.

### Phase1-Sprint7
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: VM 원장 customer_key 적재
**상태**: 70% / 30%

- 무엇을 했는가: VM 원장 row를 이 backend에서 정규화할 때, 빈 `customerKey` 필드를 다단계 체인으로 **결정론적으로 보강**하는 enrichment 단계를 삽입했다. VM 원본 코드를 직접 수정할 수 없어(별도 repo/호스트), 수신·정규화 경계에서 해결했다.
- 구현 체인 (우선순위, 위에서 아래):
  1. VM 원본 `customerKey` (비어 있지 않으면 그대로) — 메타 소스 `vm_native`.
  2. `imweb_orders.order_no`에서 `orderer_call`을 정규화 phone으로 lookup — `imweb_order_lookup`.
  3. 같은 `gaSessionId`를 가진 다른 entry가 이미 imweb_order_lookup으로 phone을 받았으면 그 phone을 같은 session의 entry에도 전파 — `ga_session_link`.
  4. 세 번째까지 실패해도 `gaSessionId`가 있으면 `ga:<sessionId>` 합성 키 — `ga_session_synthetic`. (고유성은 있지만 imweb_orders 와는 조인 안 됨.)
  5. `gaSessionId`도 없으면 `empty`.
- 새 엔드포인트 `GET /api/attribution/identity-diagnostics?dataSource=vm` — 채움률·소스별 분포·빈 row의 touchpoint 분포 응답.
- 실측 결과 (2026-04-18 05:20 KST, VM snapshot 429 entries):

| 지표 | 값 |
|---|---|
| total | 429 |
| filled | 381 (88.8%) |
| empty | 48 |
| vm_native | 0 |
| imweb_order_lookup | 21 |
| ga_session_link | 0 |
| ga_session_synthetic | 360 |
| joinableRatePercent (imweb_orders 조인 가능) | 4.9% |
| 빈 row touchpoint 분포 | checkout_started 8, payment_success 38, form_submit 2 |

- Sprint6 재검증 (`/cohort-ltr?dataSource=vm&startAt=2026-01-01&endAt=2026-04-17`):

| 채널 | customerCount | d30 revenue | d90 revenue | d180 revenue |
|---|---|---|---|---|
| youtube | 2 | 0 | 0 | 0 |
| meta | 49 | 0 | 0 | 0 |
| tiktok | 0 | 0 | 0 | 0 |
| google | 16 | 0 | 0 | 0 |
| other | 194 | 0 | 0 | 0 |

- 변화: customerCount가 전 채널 0에서 youtube 2 / meta 49 / google 16 / other 194 로 올라왔다. 즉 **first_touch 분류는 이제 작동**.
- 왜 아직 d30/d90/d180 revenue 0인가: VM 원장 API 응답이 현재 source당 200건 상한이고, 그 200건이 전부 `2026-04-17` 하루치다. 즉 VM 원장은 오늘 하루만 조회 가능. 따라서 모든 customer의 `first_touch_at`도 오늘이고, `first_touch_at 이후`의 주문만 LTR로 계산하는 Sprint6 로직상 오늘 주문이 없으면 전부 0이 된다. 이 한계는 코드로 풀 수 없고 `[[#Phase1-Sprint8]]`의 주제다.
- 왜 우리 기준 70% / 운영 기준 30%인가:
  - 우리(코드) 기준 70% = enrichment 체인·진단 엔드포인트는 완성, TS/test pass. 나머지 30%는 VM 히스토리 확보(Sprint8) 없이는 검증 불가.
  - 운영 기준 30% = 로컬에서 customerKey 채움률은 88.8% 로 올라갔지만, Sprint6의 실질 숫자(revenue)는 아직 0. 실제 운영 판단에는 아직 못 씀.

#### 역할 구분
- TJ: `ga_session_synthetic` 키를 imweb_orders 조인 대체 경로(예: GA4 user_pseudo_id를 imweb 고객 ID로 역매칭)에 연결할지 결정. 또한 `[[#Phase1-Sprint8]]` VM 히스토리 확보 방향 결정.
- Codex: 해당 없음 (이번 턴은 Claude Code가 직접 수행).
- Claude Code: enrichment 체인, 진단 엔드포인트, 이 보고서 업데이트 완료.

### Phase1-Sprint8
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: VM 원장 히스토리 확보
**상태**: 100% / 100% (A 방향 채택·코드 반영·VM 재배포 완료)

- 결론: **A(VM API 확장)를 선택하고 실행 완료**. B(로컬 싱크 잡) 기각.
- 근거:
  - **VM은 이 repo의 backend를 원격 호스트(att.ainativeos.net)에서 돌리는 구조**다(`capivm/vmdeploy.md:9`). 즉 VM "별도 레포"가 아니라 같은 코드.
  - 따라서 VM API 확장 = `backend/src/routes/attribution.ts:1485`의 엔드포인트 10줄 패치. B(싱크 잡)는 VM+로컬 두 곳을 관리하는 구조가 돼 운영 복잡도가 훨씬 크다.
  - 유일한 단점: VM 재배포가 필요. 다만 `capivm/vmdeploy.md`에 배포 파이프라인이 이미 정돈돼 있어 장벽이 아니다.
- 무엇을 바꿨는가:
  - `GET /api/attribution/ledger` 엔드포인트의 `limit` 상한을 `200` → `10000`으로 상향(`backend/src/routes/attribution.ts:1490` 근방).
  - 같은 엔드포인트에 `startAt`·`endAt` 쿼리 파라미터(ISO) 추가. 이름/해석은 Sprint3의 `cohort-ltr`와 동일 규약.
  - 클라이언트 측 `ACQUISITION_REMOTE_LEDGER_LIMIT` `200` → `10000`, 타임아웃 15초 → 30초, 기본 lookback `365`일(`buildRemoteLedgerUrl`에서 자동으로 `startAt = now-365d, endAt = now` 전달).
- 실측 (로컬 `localhost:7020`은 이미 새 코드):
  - `curl 'localhost:7020/api/attribution/ledger?source=biocom_imweb&startAt=2026-04-01T00:00:00Z&endAt=2026-04-17T23:59:59Z'` → 200, `summary.totalEntries: 875`. 즉 원장엔 데이터가 있고 이전 `limit=200` 캡이 숫자를 가렸을 뿐임.
  - `curl 'https://att.ainativeos.net/api/attribution/ledger?source=biocom_imweb&limit=2000'` → 여전히 200건만, filters에 startAt/endAt 없음. **VM 재배포 전이라 정상**.
- VM 재배포 (`2026-04-18 09:31 KST`): Claude Code가 `capivm/vmdeploy.md` 절차대로 직접 실행.
  - 로컬 `backend/` → `npm run build` → tar 스트림 ssh → VM `~/seo/repo/backend/`로 `src/ dist/ package.json package-lock.json` 전송. `data/`·`logs/`·`.env`는 건드리지 않음.
  - VM에서 `pm2 restart seo-backend --update-env` 실행. PM2 status online, uptime 초기화 확인.
  - 외부 `GET https://att.ainativeos.net/health` `status: ok`, `capiAutoSync.enabled: true`, `attributionStatusSync.enabled: true` 확인.
- 재배포 후 실측 효과:

| 지표 | 재배포 전 | 재배포 후 | 배수 |
|---|---|---|---|
| `/api/attribution/ledger?source=biocom_imweb` 응답 items | 200건 (1일치) | 2,541건 (17일치) | 12.7× |
| `identity-diagnostics.fillRatePercent` | 88.8% | 96.3% | +7.5pp |
| `identity-diagnostics.joinableRatePercent` | 4.9% | **67.7%** | 13.8× |
| `imweb_order_lookup` 건수 | 21 | 1,284 | 61× |
| `ga_session_link` 건수 | 0 | 596 | ∞ |
| `cohort-ltr` customerCount 합 | 261 (거의 전부 synthetic) | 1,811 (real-phone 중심) | 6.9× |
| 채널별 customerCount | youtube=2·meta=49·google=16·other=194 | youtube=39·meta=413·tiktok=65·google=134·other=1,160 | — |

- 왜 운영 기준 100%인가: VM 재배포 끝났고 프로덕션 외부 엔드포인트가 새 `startAt`/`endAt` 필터를 돌려준다. TJ의 추가 액션은 없다.
- 남은 제약 (이 Sprint의 완료와는 무관, 별도 Sprint):
  - VM은 2026-04-12 cutover라 오늘 기준 17일치 데이터뿐. 180일 LTR 성숙 cohort는 시간이 쌓여야 의미가 생긴다. 이건 Sprint8이 풀 문제가 아니라 시간의 문제.
  - `channel-category-repeat` cell 중 5개만 non-zero고 전부 `category=other`로 분류됨. VM의 `crm.sqlite3`에 `imweb_order_items` 데이터가 없거나 비어 있어 `categorizeProductName`이 항상 `"other"`를 반환하는 것으로 추정. `[[#Phase1-Sprint9]]`에서 해소.

#### 역할 구분
- TJ: 해당 없음. 재배포도 Claude Code가 수행.
- Codex: 해당 없음.
- Claude Code: 코드 확장, VM 재배포, 실측 검증, 문서 업데이트 전부 담당.

### Phase1-Sprint9
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: VM 상품 카테고리 동기화
**상태**: 100% / 100% (B안 스키마·sync 모듈·엔드포인트·로컬 backfill 96,304건·VM 배포·Sprint6 재검증 전부 완료)

- 무엇을 하는가: VM의 `data/crm.sqlite3`에 `imweb_order_items` (및 관련 품목·옵션 테이블)가 안정적으로 최신 상태로 유지되도록 동기화 경로를 확인·보강한다. 로컬에서는 이 테이블이 이미 쓰이고 있어(`categorizeProductName`가 VM에서도 "other" 말고 `test_kit`/`supplement`를 반환하게 한다).
- 왜 필요한가: `[[#Phase1-Sprint6]]`의 `channel-category-repeat` 응답에서 5개 non-zero cell이 전부 `category=other`로 떨어진다. 재배포 후 첫 구매 amount(`medianFirstPurchaseAmount`)는 정상적으로 `medFirst=245000`(meta), `medFirst=750000`(tiktok) 등으로 실수치가 나오는데, 카테고리만 분류가 안 된다. 원인 후보: VM의 `imweb_order_items`가 비어 있거나, 최신 주문에 대한 item rows가 동기화되지 않음.
- 산출물: VM의 `imweb_order_items` 상태 진단(비어 있는지, 어떤 주문 이후로 비어 있는지), 동기화 경로 수정(예: `/api/crm-local/imweb/sync-order-items` 같은 항목 sync 잡이 필요하면 추가), 재동기화 후 `channel-category-repeat` 응답에서 `category=test_kit`/`supplement` cell이 나타나는지 확인.
- 우리 프로젝트에 주는 도움: 이 Sprint가 닫히면 당당케어 필터(`is_dangdangcare=true`)·영양제/검사권 재구매율이 채널별로 진짜 숫자로 채워진다. 즉 "YouTube 유입 영양제 첫 구매자의 재구매율이 Meta 대비 높은가"가 관찰 데이터로 확인 가능해진다.

#### 역할 구분
- TJ: VM에 item 테이블 동기화 잡을 돌려본 적 있는지 확인(기억이 있으면 빠름), 그리고 필요한 API 키/권한 제공. Imweb 상품·주문 상세 API 접근 범위 확인.
- Codex: VM에서 `imweb_order_items` 현재 상태 쿼리, 부족 시 동기화 잡(기존 `crmLocalDb.ts` 경로 재사용) 구현.
- Claude Code: Sprint6 `channel-category-repeat` 응답이 nonzero supplement/test_kit cell을 돌려주면 `/acquisition-analysis` 하단 카드 UI(단계 7).

#### 실행 단계
1. ~~[Claude Code] 진단 엔드포인트 추가~~ — **완료** (2026-04-18 10:00). `GET /api/attribution/diagnostics/item-coverage` 배포.
2. ~~[TJ] 방향 결정~~ — **완료** (2026-04-18 10:40). B안 승인.
3. ~~[Claude Code] B안 구현~~ — **완료** (2026-04-18 11:05).
4. ~~[Claude Code] Sprint6 재검증~~ — **완료** (2026-04-18 11:10). `channel-category-repeat` nonzero cell 5 → 12로 증가, supplement/test_kit/당당케어 전부 분류됨.

#### 최종 실행 결과
- 스키마: `imweb_order_items (line_key PK, site, order_no, line_no, shop_name, item_name, opt_name, sale_cnt, pay_amt, order_htel, ord_time, source, synced_at)` 신설. 인덱스 `order_no`·`ord_time`.
- 동기화 모듈: `backend/src/imwebOrderItemsSync.ts` 신규. `parseOrderNoAndLine`가 `"202604177160627 202604177160627-002"` → `{orderNo: "202604177160627", lineNo: "002"}` 로 PG/SQLite 조인 키 정규화. `node:test` 5건 pass.
- 엔드포인트: `POST /api/crm-local/imweb/sync-order-items` (`mode=full|incremental`, `sinceHours`, `dryRun` 지원).
- 로컬 backfill: 96,304 PG rows → 96,304 SQLite lines 저장. site 매핑 biocom 9,655 / thecleancoffee 2,894 / unknown 83,755(SQLite imweb_orders 외의 과거 주문 — 지금 Sprint6 분석 윈도우에서는 사용되지 않음).
- VM 배포 + backfill: 96,304 lines 동일 결과. biocom 9,813 / thecleancoffee 3,767 / unknown 82,724.
- Sprint6 재검증 (VM, `startAt=2025-10-01&endAt=2026-04-18&dataSource=vm`):

| 채널 | 카테고리 | 당당케어 | n | rep | rate | medFirst |
|---|---|---|---|---|---|---|
| youtube | supplement | true | 1 | 0 | 0.000 | 114,840 |
| youtube | supplement | false | 1 | 0 | 0.000 | 114,840 |
| youtube | other | - | 38 | 0 | 0.000 | 21,900 |
| meta | test_kit | - | 39 | 1 | 0.026 | 245,000 |
| meta | supplement | false | 3 | 0 | 0.000 | 35,000 |
| meta | other | - | 373 | 1 | 0.003 | 496,000 |
| tiktok | other | - | 65 | 0 | 0.000 | 750,000 |
| google | other | - | 134 | 1 | 0.007 | 185,175 |
| other | test_kit | - | 59 | 2 | 0.034 | 260,000 |
| other | supplement | false | 37 | 10 | **0.270** | 47,530 |
| other | supplement | true | 2 | 0 | 0.000 | 84,858 |
| other | other | - | 1,066 | 12 | 0.011 | 73,600 |

역퍼널 (영양제 첫 구매 → 180일 내 검사권): overall 41명 중 1명(2.4%). 채널별: other 37 중 1명(2.7%), youtube 1·meta 3·tiktok 0·google 0 모두 재구매 관측 0(17일 윈도우 표본 부족).

- 해석: **구조는 작동**. 숫자 크기는 작음 (VM 17일치 히스토리 한계). `/callprice` 전사 평균(영양제 재구매율 45.1%, 역퍼널 7.0%)과 비교하려면 VM 180일 이상 누적 이후 다시 재검증해야 의미가 붙는다. 지금은 "카테고리 분류가 정상적으로 돌아간다"의 증거 수준.
- 후속(별도 Sprint 불필요, 운영 수동 호출 가능): incremental sync cron 자동화는 지금 붙이지 않음. 필요 시 `backend/src/bootstrap/startBackgroundJobs.ts`에 30분 주기로 `POST /api/crm-local/imweb/sync-order-items?mode=incremental`을 걸면 됨. 현재는 수동 POST로 충분 (전체 backfill 한 번으로 과거 데이터는 전부 확보).

#### 단계 1 진단 결과 (2026-04-18 10:00 KST)
VM에 배포한 `GET /api/attribution/diagnostics/item-coverage?sampleLimit=300` 응답 요약.

| 항목 | 값 | 해석 |
|---|---|---|
| `imweb_order_items` 테이블 존재 | **false** | 테이블 자체가 없음. |
| `imweb_orders` 전체 row | 11,411 | biocom 8,883 + thecleancoffee 2,528 + aibio 0. |
| `imweb_orders.raw_json` 커버리지 | 100% | raw_json이 비어 있지 않은 비율. |
| 주문 기간 | 2026-01-07 ~ 2026-04-18 | 약 100일. |
| raw_json에서 item 이름 추출 성공률 | **0%** (300건 중 0건) | raw_json 구조에 상품 라인 배열이 존재하지 않음. |

표본으로 뽑은 raw_json 최상위 키: `order_code, order_no, order_time, order_type, is_gift, sale_channel_idx, device, complete_time, orderer, delivery, payment, cash_receipt, form, use_issue_coupon_codes`. **`items`·`order_items`·`products`·`goods` 같은 상품 배열 키가 없음.**

즉 Imweb 주문 목록 API는 결제/배송/주문자 정보만 돌려주고, 상품 라인은 **별도 API**(예: `/orders/{order_no}/prod-orders` 또는 관련 경로)에서 가져와야 하는 구조다. 그 호출이 동기화에서 빠져 있어 VM·로컬 어느 쪽에도 상품 정보가 쌓여 있지 않다.

#### TJ 결정 필요 (단계 2) — 선택지

**2026-04-18 10:35 KST 추가 — B안 실행 가능성 데이터로 확인됨.** Postgres 운영 DB에 상품 매핑이 이미 있다(`public.tb_playauto_orders`, 120,698건, 2023-07-07 ~ 2026-04-17). 아임웹 채널(`아임웹`+`아임웹-B/C/D/E`+`바이오컴-앱`) 합계 약 96,294건. 컬럼: `shop_ord_no`, `shop_sale_name`(상품명), `shop_opt_name`, `sale_cnt`, `pay_amt`, `order_htel`, `ord_time`, `shop_name`. 샘플 상품명은 "음식물 과민증 분석", "뉴로마스터 60정", "클린밸런스 120정" 등 — `categorizeProductName` 으로 즉시 분류 가능.

주의할 조인 이슈 하나:
- Postgres `shop_ord_no` 형식 `"202604177160627 202604177160627-002"` (공백 + 라인번호 suffix)
- SQLite `imweb_orders.order_no` 형식 `"202604158382115"` (단순 숫자)
- 단순 IN 조인은 10건 샘플에서 0건 매치. `SPLIT_PART(shop_ord_no, ' ', 1)` 또는 `substring(shop_ord_no, '^[0-9]+')`로 앞부분만 떼어 조인하면 매치 가능해 보임. 샘플 5건 전부 앞/뒤 동일한 숫자 + `-{line}` 구조였음.
- Playauto는 **주문당 라인별 row**라 같은 `order_no`에 여러 row 존재 가능. 그래서 SQLite 11,411 대비 Playauto 96k는 같은 주문 여러 라인 때문.

A안 — **Imweb 주문상세(상품) API 주기 sync 추가**
- 장점: 가장 본질적, 이후 주문 자동 누적.
- 단점: Imweb API 호출량·rate limit 확인 필요, 구현 시간 큼. **B안이 가능하다면 먼저 B로 간 뒤 점진 이관이 빠름.**

B안 — **Postgres `tb_playauto_orders`에서 상품 라인 backfill** ★ 추천
- 로컬 SQLite에 `imweb_order_items` 테이블 신설 → `public.tb_playauto_orders`에서 아임웹 채널 row를 `SPLIT_PART(shop_ord_no, ' ', 1)`로 `order_no` 추출해 옮겨넣는다.
- 이후 incremental sync 잡(예: 30분 주기)으로 최신 라인 누적.
- 장점: 3년치 96k 라인을 바로 확보. Imweb API 호출 없음.
- 단점: Playauto ↔ Imweb 주문번호 포맷 파싱 정확성 최초 1회 샘플 대조 필요.

C안 — **GA4 item 이벤트를 대체 분류 소스로 사용**
- 장점: 새 백엔드 호출 없음, 즉시 활용 가능.
- 단점: GA4 이벤트와 imweb 결제 row를 `transactionId`로 join해야 하는데 not_set 이슈 잔존. 고객 단위 정확도 떨어짐.
- 권장: B안 구현 이후 보조 검증용으로만.

#### 역할 구분
- TJ: 3가지 선택지 중 방향 지정. Imweb API 호출 예산(A안)과 운영 DB 접근권한(B안) 중 어느 쪽이 더 싼지 한 줄 결정이면 충분.
- Codex 또는 Claude Code: 지정된 방향에 따라 구현. A안이면 Imweb Orders v2 엔드포인트 경로 확인·호출·row 적재. B안이면 운영 DB → SQLite 마이그레이션 스크립트. C안이면 GA4 item 이벤트를 고객 단위로 역조인.
- Claude Code: Sprint6 재검증 및 Sprint6 단계 7 UI 이어감.

### Phase2-Sprint4
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: UTM 스킴 표준화
**상태**: 대기 (Sprint3와 병렬 선행 권장)

- 무엇을 하는가: 모든 YouTube 영상 설명란 링크를 `utm_source=youtube` + `utm_medium={video|short|community|live}` + `utm_campaign={slug}` + `utm_content={video_id}` 형식으로 맞춘다. 기존 비표준 UTM은 매핑 테이블(`utm_source_alias`)로 표준값에 귀속시킨다.
- 왜 필요한가: 지금은 같은 영상을 가리키는 UTM이 2~3개로 쪼개져 있어서 영상별 ROI가 계산되지 않는다. 이 상태에서 Sprint3 코호트를 돌리면 "채널 묶음" 수준 결론은 나오지만, "어떤 영상이 돈을 만드는가"는 여전히 비어 있다. 따라서 **Sprint4의 최소 집합(매핑 테이블)은 Sprint3와 병렬로 먼저 착수**하는 것이 효율적이다.
- 산출물: UTM 스킴 문서, 기존 비표준 값을 표준에 매핑한 `utm_source_alias` 시드, 영상 업로드 체크리스트 변경, 기존 링크 일괄 교체 계획.
- 진입 조건 분리:
  - 최소 집합(매핑 테이블 + 신규 표준 문서): Sprint3와 병렬 착수 가능. 즉시 시작.
  - 전체 집합(기존 링크 일괄 교체, `video_id`별 ROI 테이블): Sprint3가 표본 50건+ 확보로 닫혀 "YouTube 투자 규모를 키울 가치가 있다"가 확인된 이후.

#### 역할 구분
- TJ: UTM 네이밍 확정 결정권. 영상 제작팀과의 운영 합의.
- Codex: 기존 GA4·Attribution 원장 값 중 비표준 UTM을 표준에 매핑하는 리라이트 쿼리·매핑 테이블.
- Claude Code: `/acquisition-analysis`에 `video_id`별 ROI 테이블 추가.

### Phase2-Sprint5
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Acquisition OMTM 재정의
**상태**: 대기

- 무엇을 하는가: 프로젝트 Acquisition 단계의 OMTM(가장 중요한 단 하나의 지표)을 `YouTube Payback Period` 또는 `채널별 90일 LTR / CAC`로 정식 지정하고, 홈 대시보드와 로드맵 상단에 못 박는다.
- 왜 필요한가: 지금 `/acquisition-analysis`에는 채널 카드·YouTube 카드·Meta 카드가 병렬로 떠 있다. `Lean Analytics` 1부 OMTM 원칙대로, 현재 단계에서 가장 중요한 지표 하나가 우위로 표시돼야 팀이 움직인다.
- 산출물: `roadmap/` 폴더의 Acquisition OMTM 정의 문서, 프론트 상단 KPI 카드 교체.
- 진입 조건: `[[#Phase1-Sprint3]]`와 `[[#Phase2-Sprint4]]`(전체 집합)가 둘 다 닫혀서, OMTM이 숫자로 움직일 수 있는 상태가 된 이후.

#### Lines in the Sand (OMTM 기준선 초안)
Lean Analytics `Lines in the Sand` 원칙대로, OMTM은 숫자 목표선 없이는 행동을 바꾸지 않는다. 아래는 초안이며 Sprint5 최종 승인에서 확정한다.

- `YouTube Payback Period`: 영상 1편당 제작·편집·출연 비용 ÷ 해당 영상 UTM 유입 고객의 90일 누적 매출 중앙값. 합격선 `≤ 6개월`, 비상선 `> 12개월`.
- `채널별 90일 LTR / CAC`: 합격선 `≥ 3배`(E-commerce 기준), 비상선 `< 1배`.
- `YouTube 세션→구매 전환율`: 합격선 `≥ 2%` (E-commerce 평균), 우수선 `≥ 5%`, 비상선 `< 1%`.
- 위 세 수치 중 **하나라도 비상선**이면 해당 채널의 신규 광고/제작 예산 증액을 멈춘다는 운영 규칙을 같이 못 박는다.

#### 역할 구분
- TJ: OMTM 최종 지정, 조직 전달.
- Codex: OMTM 계산 로직과 일일 갱신 잡.
- Claude Code: 상단 KPI 카드 UI, 문서 업데이트.

## VM 17일치 히스토리 한계 — 대안 데이터 검토

### 왜 이 섹션을 따로 두는가
/callprice 의 "영양제 첫 구매 재구매율 45.1% / 검사권 16.1% / 역퍼널 7.0%" 같은 전사 평균은 이미 충분한 표본 위에 서 있다. 그런데 이 보고서가 만들려는 것은 그것을 **유입 채널별로 쪼갠** 숫자다. 쪼갠 표가 지금 대부분 한 자릿수 n으로 나오는 이유는 Sprint6~9 코드 문제가 아니라 **VM attribution 원장이 짧기 때문**이다. 이 한계가 현 지표를 어떻게 해석해야 하는지, 다른 데이터로 우회 가능한지 정리한다.

### 관측 한계의 구체 수치
- VM(att.ainativeos.net) cutover: 2026-04-12. 본 보고서 작성 시점 2026-04-18 기준 **17일치**.
- VM `/api/attribution/ledger?source=biocom_imweb&limit=10000` 응답 items 2,541건, 전부 `loggedAt: 2026-04-0*` 이후.
- first_touch_at 이 전부 최근 17일 이내라, Sprint6 `matureCohort.d30/d90/d180` 의 n·revenue 는 구조상 0 또는 매우 작게 나올 수밖에 없다. 이건 버그가 아니다.
- `channel-category-repeat` nonzero cell 12개 중 customerCount ≥ 50 인 cell은 4개 (google/meta/other × supplement/test_kit/other 조합). 나머지는 통계적 유의성 확보 전.

### 대안 데이터로 유입분석이 가능한가 — 검토 4건

| 소스 | 기간 | 고객 단위 가능? | 유입 채널 축? | 상품 카테고리 축? | 결론 |
|---|---|---|---|---|---|
| **VM attribution_ledger** | 2026-04-12~ (17일) | O (customerKey enrichment 후) | O | O (Sprint9 후) | 유입분석의 **유일한 3축 원천**. 단 기간 짧음. |
| **GA4 (source-conversion API)** | 2024~2026 (3년+) | X (client_id ↔ member_code 매칭 불가) | O (sessionSource/Medium) | O (item_name/category) | 세션 단위는 가능(본 페이지 상단 이미 사용). 고객 단위 LTV 불가. |
| **Imweb/Playauto 주문** | 2023-07~ (3년) | O (member_code/전화) | X (UTM·referrer 미저장) | O (shop_sale_name) | 상품×재구매는 `/callprice` 에서 이미 사용. 유입 채널 축 없음. |
| **Meta CAPI 로그 + fbclid join** | 2025~ | O (fbclid → 주문) | 부분 (Meta 한 채널만) | O | ROAS 추적용으로 쓰이는 중. 전체 유입 원장 대체 불가. |
| **로컬 노트북 attribution_ledger** | 2026-01 이전부터 존재 | O | O | O (Sprint9 후) | 개발·디버그 섞인 표본이라 운영 지표로 쓸 수 없음. |

### 어디까지 어떻게 검토했는가 (검토 이력)
1. **로컬 SQLite `attribution_ledger`**: 먼저 확인 — 0~1건. 로컬 receiver는 원래 운영 트래픽을 받지 않으므로 당연.
2. **VM 원장 `/api/attribution/ledger` 직접 호출**: `limit=2000` 요청해도 200건만 회수. 원인 = 엔드포인트 상한 + 날짜 필터 부재. 이게 Sprint8의 출발점이었고, VM 재배포로 해결됨.
3. **VM 원장 history 확장**: 재배포 후에도 17일치뿐. VM 자체가 그때부터 받기 시작한 것이지 API 한계가 아님. 이건 코드로 못 푸는 시간의 문제.
4. **GA4 user_pseudo_id ↔ imweb member_code 매칭 시도**: GA4 client_id 가 브라우저 해시라 자사몰 로그인 ID와 매칭 안 됨. `/tracking-integrity` 쪽에서 별도로 추적 중인 `(not set)` 문제와 같은 뿌리.
5. **Imweb 주문 raw_json 에서 유입 정보 추출**: raw_json 에 `utm_*`·`referrer` 키 없음. `orderer/delivery/payment` 만 있음. Imweb Orders API 가 원래 유입정보를 돌려주지 않음.
6. **Playauto 플랫폼 쪽에 유입 정보 있는지**: `tb_playauto_orders` 컬럼에 `inflow_path` 가 `tb_naver_orders`에는 존재하지만, 아임웹 쪽엔 없음(자사몰은 판매채널이 단일이라 이 컬럼이 비어 있음).
7. **Meta CAPI 로그로 우회**: Meta 유입 고객만 역추적 가능. YouTube·Naver·Google은 대칭 수단 없음.

검토한 7가지 경로 모두 확인 결과 **VM attribution_ledger 가 유입×고객 3축 동시 분석의 유일한 원천**. 시간 누적 외 해법 없음.

### 따라서 지금 보고서의 현실적 운영
- **즉시 쓸 수 있는 결론**: GA4 채널별 전환율(이미 보고됨), /callprice 전사 평균(이미 보고됨).
- **조건부 결론 (시간 누적 후)**: 채널별 영양제/검사권 재구매율, YouTube 당당케어 경로 LTV 배율. 90일(~2026-07)에 1차 중간 점검, 180일(~2026-10)에 론 코하비 6체크 완결.
- **이 보고서의 숫자 사용 규칙**: Sprint6 cell의 n이 50 미만이면 외부·투자자·영상 제작팀에 숫자를 인용하지 않는다(§Phase1-Sprint6 Power 체크 재인용).

### 프론트 반영
`/acquisition-analysis` 페이지 하단에 `<CohortCategoryCard>` 섹션을 추가해 이 보고서의 교차표·역퍼널·관측 한계 설명을 운영 화면에서도 즉시 볼 수 있게 했다. 숫자 해석과 한계가 같은 카드 안에 붙어 있어야 "표본 작다"는 맥락 없이 숫자만 들고 가는 것을 막을 수 있다.

## Lean Analytics 적용 노트
`leandata/leangrok.md`, `leandata/leancodex0326.md`, `leandata/린 분석_ 31가지 사례와 13가지 패턴.md` 3개 문서의 교차점을 이 유입분석에 대입한 결과다.

1. 사업 모델은 `E-commerce` + `구독·재구매형 커머스` + `검사/상담이 결합된 high-touch 모델`이다(`leancodex0326.md` §12.1). 따라서 Acquisition 단계의 기준선은 `E-commerce 전환율 평균 2% / 우수 10%`를 쓰면 된다.
2. 현재 성장 단계는 `Revenue → Scale` 사이다. `leancodex0326.md` §12.2가 밝힌 대로 "이미 지표는 쌓였고, 어떤 지표를 경영 판단의 기준으로 쓸지 정하는 단계"다. 즉 이 보고서가 다루는 `어디서 들어와서 결제했는가`는 단순 호기심이 아니라 **Scale을 여는 연료**다.
3. `13가지 패턴` 중 `WineExpress A/B 테스트`는 이 프로젝트에 바로 쓸 수 있다. YouTube 영상을 단순히 "이번 달 구매 수"가 아니라 `방문자당 매출(revenue per visitor)`로 비교하면, 조회수만 많은 영상과 실제로 돈을 만드는 영상이 분리된다.
4. `Backupify (소비자 → B2B 피벗)` 패턴은 현재 직접 적용되지는 않지만 "CLV:CAC 비율 5~6배 달성"이라는 수치 자체가 `6배` 주장의 기준치를 잡는 데 쓸모 있다. 일단 YouTube Payback Period를 계산하기 전에는, "YouTube가 Meta 대비 6배" 같은 표현을 외부·투자자·영상 제작팀에 쓰지 않는 것이 안전하다.
5. `OMTM` 원칙(`린 분석_31가지_사례` §OMTM)은 현재 `/acquisition-analysis`의 가장 큰 약점을 정확히 짚는다. 좋은 카드가 4~5개인 것은 `vanity`에 가깝고, `이번 분기 경영 판단을 바꾸는 지표 하나`가 없다. `[[#Phase2-Sprint5]]`가 이 문제를 닫는다.
6. 코호트 사고는 이미 코드 레벨에 들어가 있다(`leancodex0326.md` §10.1). `[[#Phase1-Sprint3]]`는 이 기존 코호트 구조에 `YouTube 유입` 필터만 하나 추가하면 되는, 저비용·고가치 작업이었고, 코드 레벨에서 `[[#Phase1-Sprint3]]`로 이미 닫혔다.
7. Lean Analytics는 관찰 지표 **무엇을 볼 것인가**에 강하지만, "관찰된 배율이 진짜인가"를 다루는 쪽은 얇다. 이 공백은 **Ron Kohavi 『Trustworthy Online Controlled Experiments』** (Kohavi/Tang/Xu) 쪽이 메운다. `[[#Phase1-Sprint6]]`에 Twyman's Law·SRM·Selection bias·Survivorship bias·OEC·Power 6체크를 그대로 넣은 이유다. 한 줄 요약: "관찰 데이터로는 상관은 말해도 인과는 말하지 않는다." 이 원칙이 `YouTube LTV 6배` 같은 강한 숫자를 외부에 인용하기 전 안전장치가 된다.

## 개발 부록
- 프론트 경로: `frontend/src/app/acquisition-analysis/page.tsx`
  - `DATE_RANGES`: `day` 모드 4개(7/14/30/90) + `year` 모드 3개(2024/2025/2026).
  - `GA4ChannelAnalysis`: `rangeValue` 상태, `resolvedRange` 메모, `loadGA4` 콜백이 `resolvedRange` 기준으로 `fetch` 호출.
  - YouTube 인사이트 박스: `youtubeRows.length`를 문장에 인라인으로 삽입.
- 백엔드 경로: `backend/src/routes/ga4.ts:1154` `router.get("/api/ga4/source-conversion")`. 쿼리 파라미터 `startDate`, `endDate`, `limit`. 구현은 `backend/src/ga4.ts:2432` `queryGA4SourceConversion`. 내부적으로 `GA4 Data API runReport`를 쓰며 `dimensions: [sessionSource, sessionMedium]`, `metrics: [sessions, totalUsers, ecommercePurchases, grossPurchaseRevenue]`.
- 검증: 로컬에서 `curl 'http://localhost:7020/api/ga4/source-conversion?site=biocom&startDate=2024-01-01&endDate=2024-12-31&limit=500'` 정상 응답 확인. `frontend` `npx tsc --noEmit` 통과 확인. `curl -I http://localhost:7010/acquisition-analysis` 200 확인.
- Sprint3 검증: `backend/src/acquisitionCohort.ts` 신규, `backend/src/routes/attribution.ts` 26행 추가(`+/api/attribution/cohort-ltr`), `backend/tests/acquisition-cohort.test.ts` 신규. `cd backend && npx tsc --noEmit` 통과. `npx tsx --test tests/acquisition-cohort.test.ts` → `1..3 pass 3`. `curl /api/attribution/cohort-ltr?startAt=2026-01-01&endAt=2026-04-17` → 200.
- Sprint6 단계 1~5 검증: `backend/src/acquisitionCohort.ts` 13KB → 28KB (약 +470줄), `backend/src/routes/attribution.ts` +113줄 (cohort-ltr 확장 + `/channel-category-repeat` + `/reverse-funnel`), `backend/tests/acquisition-cohort-purchase.test.ts` 신규. `cd backend && npx tsc --noEmit` 통과. `npx tsx --test tests/acquisition-cohort*.test.ts` → `1..6 pass 6`. 세 엔드포인트 모두 `dataSource=vm` 포함 200.
- Sprint7 검증: `backend/src/routes/attribution.ts` 정규화 경계에 enrichment 체인 추가(약 +170줄), 새 엔드포인트 `GET /api/attribution/identity-diagnostics`. `cd backend && npx tsc --noEmit` 통과. `curl /api/attribution/identity-diagnostics?dataSource=vm` → 200, `fillRatePercent: 88.8`, `joinableRatePercent: 4.9`. `curl /api/attribution/cohort-ltr?dataSource=vm` → 200, customerCount youtube=2·meta=49·google=16·other=194 (enrichment 전 0). 180일 revenue는 VM ledger 하루치 한계로 0 → `[[#Phase1-Sprint8]]`에서 해소.
- Sprint8 검증: `backend/src/routes/attribution.ts` `limit` 상한 `200`→`10000`, `startAt`/`endAt` 쿼리 필터 추가. 클라이언트 측 `ACQUISITION_REMOTE_LEDGER_LIMIT` `200`→`10000`, 타임아웃 `15000`→`30000`, `buildRemoteLedgerUrl`에 `startAt = now-365d, endAt = now` 자동 첨부. `cd backend && npx tsc --noEmit` 통과. `npx tsx --test tests/acquisition-cohort*.test.ts` → `1..6 pass 6`.
- Sprint8 배포 절차(2026-04-18 09:31 KST): `backend/` 로컬 빌드 → `tar -czf - src dist package.json package-lock.json` 파이프를 `ssh -i ~/.ssh/id_ed25519 biocomkr_sns@34.64.104.94 'cd ~/seo/repo/backend && tar -xzf -'`로 전송(VM에 rsync 미설치라 tar+ssh로 대체). `pm2 restart seo-backend --update-env`, PM2 status online 확인. 외부 엔드포인트 4종 모두 200 응답(`/health` status ok, `/ledger?startAt=...&endAt=...` 2,541건, `/identity-diagnostics?dataSource=vm` fillRate 96.3%, `/cohort-ltr?dataSource=vm` customerCount 1,811).
- Sprint9 단계 1 검증(2026-04-18 10:00 KST): `backend/src/routes/attribution.ts` `+190줄` 진단 엔드포인트(`GET /api/attribution/diagnostics/item-coverage?site=&sampleLimit=`). `backend/src/acquisitionCohort.ts:266` `extractItemNamesFromRawJson` export 추가. `cd backend && npx tsc --noEmit` 통과. 로컬·VM 모두 200 응답. 진단 verdict: `imweb_order_items 테이블 없음 + raw_json에서도 item 이름 추출 실패. 주문 동기화 때 item 정보가 raw_json에 포함되지 않음`.
- Sprint9 B안 구현 검증(2026-04-18 11:10 KST): 신규 `backend/src/imwebOrderItemsSync.ts`(동기화 모듈, `parseOrderNoAndLine` 파서 포함). `backend/src/crmLocalDb.ts`에 `imweb_order_items` 스키마 + 인덱스 추가. `backend/src/routes/crmLocal.ts`에 `POST /api/crm-local/imweb/sync-order-items` 라우트. 신규 테스트 `backend/tests/imweb-order-items-sync.test.ts` 5건 pass. 로컬 `POST .../sync-order-items {"mode":"full"}` → `{pgRowsFetched:96304, linesWritten:96304, siteBreakdown:{biocom:9655, thecleancoffee:2894, unknown:83755}}`. VM 동일 호출 → `{biocom:9813, thecleancoffee:3767, unknown:82724}`. Sprint6 `channel-category-repeat` nonzero cell 5→12, `other supplement n=37 rate=0.270` 등 실수치 등장.
- 프론트 `<CohortCategoryCard>` 반영(2026-04-18 11:45 KST): `frontend/src/app/acquisition-analysis/page.tsx` 하단에 신규 컴포넌트. 4개 엔드포인트 병렬 fetch(`cohort-ltr`, `channel-category-repeat`, `reverse-funnel`, `identity-diagnostics`). 상단 4개 메트릭 카드(고객수/fill rate/joinable rate/ga_synthetic) + 채널×카테고리 교차표(N&lt;50 배지 포함) + 역퍼널 채널별 카드 + 관측 한계 설명 박스(노란색). `npx tsc --noEmit` 통과, `curl http://localhost:7010/acquisition-analysis` 200 응답.
- 알려진 한계: `limit=500`은 GA4 API 한 번 조회의 상한이다. 연 단위로 보면 상위 500행 밖의 긴 꼬리가 잘린다. 현재는 "연도별 요약 수준"이라는 본 카드 목적에는 충분하다.
- 후속 권고(Codex 리뷰 §4): 연 단위 상세 비교를 정밀화해야 할 시점에는 **페이지네이션 추가**를 우선 권고한다. `backend/src/ga4.ts:2445`의 `runReport`에 `offset`/`limit` 반복 호출 래퍼를 씌워 상위 500 밖 꼬리까지 수집한 뒤 서버에서 합산해 반환하면, 응답 스키마(`rows`, `byChannel`)를 그대로 유지할 수 있어 프론트 변경이 최소화된다. `sessionMedium` 차원 제거는 카디널리티는 낮추지만 `/organic`, `/referral`, `/cpc` 구분이 사라져서 현재의 UTM 태깅 분해 분석이 깨진다. 따라서 1차 선택지에서 제외한다.
