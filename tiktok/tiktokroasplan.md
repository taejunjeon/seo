# TikTok ROAS 정합성 프로젝트 로드맵

작성 시각: 2026-04-18 12:14 KST
기준일: 2026-04-18
버전: v2.7 (운영 VM 전체 기간 ROAS gap API 및 프론트 업데이트 반영. 이전본: `tiktok/tiktokroasplan.md.bak_20260418_vm_frontend_update`)

## 10초 요약

- 이 로드맵의 목표는 TikTok 광고가 실제 확정 매출을 얼마나 만들었는지 숫자로 확인하는 것이다.
- 가장 큰 1번 오염(가상계좌 미입금이 구매로 잡히던 문제)은 2026-04-17 운영 적용으로 끝났다.
- 지금 남은 병목은 TikTok Ads Manager가 주장하는 광고비·구매값을 내부 장부와 같은 기간으로 맞대보는 일이다.
- 2026-03-19 ~ 2026-04-17 TikTok 과거 XLSX 기준 플랫폼 구매값은 **910,630,953원**, 플랫폼 ROAS는 **32.106**이다.
- 같은 기간 운영 VM 원장 read-only 조회 결과 TikTok 귀속 confirmed는 **0건 / 0원**, pending은 **49건 / 551,095,900원**, canceled는 **1건 / 750,000원**이다.
- `/ads/tiktok`은 새 API `GET /api/ads/tiktok/roas-comparison`을 통해 로컬 TikTok Ads 테이블과 운영 VM gap을 보여주도록 업데이트했다.

## 고등학생 비유

이 일은 쉽게 말해 **가게 매출 장부와 광고 대행사 청구서·성과 리포트가 서로 맞는지 맞춰보는 일**이다. 지금까지는 손님이 주문서만 써도 "팔렸다"고 세던 것을, **실제로 돈이 입금된 건만** 매출로 세도록 고쳤다. 다음 단계는 광고 대행사(TikTok)가 "우리가 이만큼 팔리게 했다"고 보고한 숫자와 실제 입금 매출을 나란히 놓고 맞춰보는 것이다.

## Phase-Sprint 요약표

| Phase  | Sprint              | 이름                       | 담당                  | 상태(우리/운영)   | 상세                      |
| ------ | ------------------- | ------------------------ | ------------------- | ----------- | ----------------------- |
| Phase1 | [[#Phase1-Sprint1]] | TikTok 구매 이벤트 오염 제거      | TJ + Codex + Claude | 100% / 100% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | TikTok 광고비·구매값 연결        | TJ + Codex + Claude | 75% / 60%   | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | 과거 TikTok ROAS 재검증       | Codex + TJ          | 85% / 70%   | [[#Phase1-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | TikTok Events API 조건부 도입 | 조건부                 | 대기          | [[#Phase2-Sprint4\|이동]] |
| Phase2 | [[#Phase2-Sprint5]] | 퍼널 이벤트 품질 정리             | Codex + Claude      | 대기          | [[#Phase2-Sprint5\|이동]] |

## 문서 목적

이 문서는 TikTok 광고 성과 측정이 왜 부정확했고, 어디까지 고쳤으며, 다음에 무엇을 이어서 해야 하는지 **대표·개발팀·운영자가 같은 언어로** 이해하도록 정리한다.

## 지표 체계

- 회사 북극성: 바이오컴 실제 확정매출 (Toss `DONE` 기준)
- 팀 핵심 지표: 채널별 확정매출 기반 ROAS
- 진단 지표
  - 내부 Att ROAS = 내부 확정 매출 / TikTok 광고비
  - TikTok 플랫폼 ROAS = TikTok Ads Manager 구매값 / TikTok 광고비
  - ROAS Gap = 플랫폼 ROAS - 내부 Att ROAS
  - pending/confirmed 비율 (결제 블랙박스 진단)

## 핵심 원칙

1. "주문 생성 = 구매"가 아니다. **Toss `DONE` 상태만 확정 매출**로 센다.
2. 브라우저 이벤트(웹 `Purchase`)와 서버 이벤트(Events API)를 **중복 발송하지 않는다**.
3. TikTok Events API는 "안 들어와서" 붙이는 게 아니라 **웹이 부족한 것이 숫자로 확인됐을 때만** 붙인다.
4. 광고비 데이터가 없으면 ROAS 비교는 하지 않는다. 전환 품질만 본다.

---

## Phase별 계획

### Phase 1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**TikTok ROAS 숫자를 믿을 수 있게 만들기**

- 목표: TikTok 광고가 실제 확정 매출을 얼마나 만들었는지 **숫자로** 보여준다.
- 왜 지금 해야 하는가: TikTok Ads Manager 숫자가 과거 가상계좌 미입금 주문을 구매로 잡고 있었을 가능성이 크다. 이 상태에서 예산을 늘리거나 줄이면 **잘못된 근거**로 결정하게 된다.
- 산출물: 깨끗한 Purchase 이벤트, `/ads/tiktok` 광고비·ROAS 비교 화면, 과거 기간 재검증 리포트
- 완료 기준: TikTok Ads Manager 과거 CSV와 내부 확정매출을 같은 기간으로 비교해 gap을 수치로 설명할 수 있다.
- 다음 Phase에 주는 가치: Phase 2(이벤트 품질 개선 / Events API 도입)의 실제 필요성을 **추측이 아닌 숫자**로 판단할 수 있다.

---

#### Phase1-Sprint1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok 구매 이벤트 오염 제거
**상태**: 우리 기준 100% / 운영 기준 100% (2026-04-17 enforce v1 검증 통과)

**무엇을 하는가**

아임웹 결제완료 페이지에서 TikTok 픽셀이 **무조건** `Purchase`로 보내던 것을, 실제 결제 확정 여부에 따라 분기한다. 카드 결제 확정(Toss `DONE`)은 `Purchase`를 유지하고, 가상계좌 미입금(Toss `WAITING_FOR_DEPOSIT`)은 `Purchase`를 차단하고 `PlaceAnOrder`로 대체한다.

**왜 필요한가**

가상계좌 미입금 주문도 `Purchase`로 TikTok에 보내고 있었다. 그 결과 TikTok Ads Manager의 구매수와 구매값이 실제 매출보다 부풀려진다. 이 상태에서는 예산 최적화가 **허상 숫자** 기준으로 돌아간다.

**고등학생 비유**

"계산대에서 장바구니를 든 순간 '구매 완료'로 카운트하던 것을, **실제로 카드가 승인된 순간에만** '구매 완료'로 카운트하도록 고쳤다." 가상계좌는 "외상 주문서"에 가깝다. 입금 전에는 매출이 아니다.

**산출물**

- TikTok Browser Purchase Guard (`tiktok/tiktok_purchase_guard_enforce_v1.js`)
- 결제 판정 API `/api/attribution/payment-decision`
- 아임웹 헤더 삽입용 설치 코드 (`tiktok/imwebcode.md`)
- 운영 검증 로그 (카드 1건 `allow_purchase`, 가상계좌 1건 `block_purchase_virtual_account`)

**역할 구분**

- TJ: 운영 헤더 enforce 적용 승인, 카드/가상계좌 실결제 테스트, Pixel Helper 수신 확인
- Codex: `payment-decision` API 로직, Guard wrapper 구조 설계, fail-open 안전장치
- Claude Code: Guard 스크립트 본체(v1 → v3 → enforce), 설치 코드 문서, 로그 포맷

**진행 기록 요약** (상세는 개발 부록 §A)

- dry-run v1: TikTok wrapper가 `Purchase` 호출을 감지 못함 → v2로 조치
- dry-run v2: 50ms polling이 초기 호출을 놓침 → v3로 조치
- dry-run v3: setter/accessor를 먼저 설치해 `Purchase` 호출 감지 성공
- enforce v1: 가상계좌 `PlaceAnOrder`로 낮춤, 카드 `Purchase` 유지 검증 완료

**우리 프로젝트에 주는 도움**

앞으로 수집되는 TikTok Ads 숫자는 **오염 없는 상태**를 기준선으로 삼을 수 있다. Sprint 2에서 TikTok Ads CSV를 붙일 때, guard 전후 기간을 비교해 **과거 오염 규모를 역산**할 근거가 생긴다.

> Sprint 1은 완료 상태다. `debug=false` 로그 축소와 `fbevents.js` 중복 경고 점검은 이 Sprint의 완료 기준과 무관한 후속 작업이므로 문서 하단 `## 다음 액션`으로 이동했다.

---

#### Phase1-Sprint2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok 광고비·구매값 연결
**상태**: 우리 기준 75% / 운영 기준 60%

**무엇을 하는가**

`/ads/tiktok` 화면에서 두 개의 ROAS를 같은 기간으로 나란히 보여준다.

- **내부 Att ROAS**: 내부 장부 확정 매출 / TikTok 광고비
- **TikTok 플랫폼 ROAS**: TikTok Ads Manager가 보고한 구매값 / TikTok 광고비

두 값의 차이(gap)와 pending 포함/제외 버전을 분리해서 표시한다.

**왜 필요한가**

Sprint 1로 "깨끗한 구매 이벤트"는 만들었지만, **비교 대상(TikTok이 주장하는 ROAS)**이 없으면 플랫폼 ROAS가 맞았는지 검증할 수 없다. 현재는 캠페인 기간 합계 export를 로컬 테이블과 화면에 연결했고, 남은 일은 일자별 데이터와 API 자동화다.

**고등학생 비유**

"우리 가게 매출 장부(확정 입금)와 광고 대행사가 보낸 청구서·성과 리포트를 **나란히 놓고** 맞춰 본다." 둘이 같으면 광고 대행사 말이 맞았다는 뜻이고, 다르면 어느 쪽이 틀렸는지 꼬집어낼 수 있다.

**산출물**

- TikTok Ads 기간 합계 로컬 적재 테이블 (`tiktok_ads_campaign_range`)
- `/api/ads/tiktok/roas-comparison` 집계 API
- `/ads/tiktok`의 광고비·플랫폼 구매값·플랫폼 ROAS·운영 VM gap 화면
- Att ROAS vs TikTok ROAS vs pending-포함 ROAS 3단 비교 표
- 캠페인별 gap 요약

**역할 구분**

- TJ: TikTok Ads Manager 캠페인 CSV export (우선순위는 아래 "다음 데이터 요청" 참조), export 기간 결정
- Codex: CSV 적재 위치·스키마 고정, 기간·캠페인 매칭 로직, ROAS 계산 API, `/ads/tiktok` 프론트 최신화
- Claude Code: pending 포함/제외 토글 UX와 일자별 재export 이후 시계열 보강

**완료 기준**

| 지표 | 계산식 |
|---|---|
| Att ROAS | TikTok 귀속 확정 매출 / TikTok 광고비 |
| Potential Att ROAS | TikTok 귀속 (확정 + pending) 매출 / TikTok 광고비 |
| TikTok 플랫폼 ROAS | TikTok Ads Manager 구매값 / TikTok 광고비 |
| ROAS Gap | 플랫폼 ROAS - Att ROAS |

**우리 프로젝트에 주는 도움**

TikTok 예산을 유지·증액·축소할지 **감이 아니라 숫자**로 결정할 수 있다. Meta 등 다른 채널과 같은 방식의 ROAS 판정을 TikTok에도 적용 가능해진다.

**다음 데이터 요청 (TJ)**

남은 CSV export 우선순위:

1. 2026-03-19 ~ 2026-04-17 일자별 재export
2. Guard 적용 전후 비교용 2026-04-16 ~ 2026-04-18 일자별 export
3. 2026-04-18 이후 enforce 적용 후 운영 기간 export

필수 컬럼: 날짜, 캠페인 ID, 캠페인명, 광고비, 클릭, 노출, 전환수, 구매 전환값, ROAS, 어트리뷰션 윈도우(또는 보고 기준)

1차 수령 파일은 2026-04-01 ~ 2026-04-18 캠페인 XLSX였고, 비용·노출·클릭·전환수는 포함됐지만 `date`, 구매 전환값, 어트리뷰션 윈도우가 없었다. 따라서 다음 export는 Custom report에서 **Date dimension과 구매값 계열 metric**을 반드시 포함한다.

**Codex 접근 가능성 확인 (2026-04-18)**

- 공식 Ads Manager 문서 기준으로 Reporting 탭에서 Custom Report를 만들고, Dimensions/Metrics와 기간을 고른 뒤 `Run & Export`로 XLSX 또는 CSV를 받을 수 있다. 근거: https://ads.tiktok.com/business/en-US/blog/how-to-view-campaign-performance-tiktok-ads-manager
- 공식 API for Business 문서 기준으로 Marketing API는 TikTok Ads Manager 데이터를 프로그램으로 조회할 수 있고, 맞춤/자동 리포트를 한 endpoint로 만들 수 있다. 근거: https://ads.tiktok.com/help/article/marketing-api?lang=en
- 공개 TikTok Business API v1.3 Postman 컬렉션 기준 synchronous report endpoint는 `GET https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`이며, `Access-Token` 헤더와 `advertiser_id`, `report_type`, `data_level`, `dimensions`, `metrics`, `start_date`, `end_date`가 필요하다. 근거: https://www.postman.com/tiktok/tiktok-api-for-business/request/7d5ufux/run-a-synchronous-report
- 어트리뷰션 윈도우는 현재 계획대로 TikTok 기본값(Click 7일 / View 1일)을 유지한다. TikTok Attribution Manager 안내도 Pixel/Web Event API 광고주 기본값을 7-day click / 1-day view로 설명한다. 근거: https://ads.tiktok.com/business/ms/blog/flexible-attribution-windows-campaign-measurement
- 로컬 저장소와 `.env` 후보에는 `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`, Business API app credential이 없다. 수동 XLSX는 로컬 테이블에 적재했지만, Business API 자동 수집은 아직 연결하지 않았다.
- 결론: **지금 즉시 가능한 최단 경로는 TJ의 CSV export**다. API 자동 수집은 가능하지만, TJ가 TikTok Business API developer app 권한, read-only access token, advertiser ID를 준비해야 Codex가 dry-run 조회 스크립트를 만들 수 있다.
- 보안 원칙: access token은 저장소에 커밋하지 않는다. 운영 DB/운영 VM 데이터는 read-only로만 조회한다. 이번 로컬 테이블 생성은 TJ 요청에 따라 `backend/data/crm.sqlite3`에 한정했다.

**TikTok Ads 1차 export 분석 (2026-04-18 05:30 KST)**

- 원본 XLSX: `data/ads_csv/tiktok/raw/20260401_20260418_campaign_report.xlsx`
- 분석 문서: `tiktok/tiktok_ads_export_20260401_20260418_analysis.md`
- 처리 파일: `data/ads_csv/tiktok/processed/20260401_20260418_campaign_summary.csv`, `data/ads_csv/tiktok/processed/20260401_20260418_campaign_summary.json`
- 파일 구조 특이점: XLSX 내부 dimension이 `A1`로 저장되어 일반 reader가 첫 셀만 볼 수 있다. 실제 행은 캠페인 6행 + 합계 1행이며 `openpyxl`에서는 `ws.reset_dimensions()` 후 읽어야 한다.
- 기간 합계: 비용 16,277,105원, 순 비용 16,148,559원, 노출 7,763,802, 목적지 클릭 242,884, 전환수 184, 전환 시간별 전환 194
- 비용 상위 캠페인: `음과검 스마트+ 캠페인` 8,258,613원, `종합대사기능 분석 스마트+캠페인` 4,595,661원, `영양중금속분석 스마트+ 캠페인` 1,712,213원, `건강기능식품 스마트+캠페인` 1,710,618원
- 한계: `date` 없음, 구매 전환값 없음, 어트리뷰션 윈도우 없음, 구매 ROAS 계열 컬럼이 모두 0. 이번 파일은 **광고비 분모 보조 자료**로만 사용하고 ROAS gap 판정에는 쓰지 않는다.
- 다음 요청: `Date`, `Campaign ID`, `Campaign name`, `Cost`, `Impressions`, `Destination clicks`, `Conversions`, `Purchase`, `Purchase value`, `Purchase ROAS`가 들어간 Custom report export. 구매값 metric 이름이 다르면 `Website purchase value`, `Total purchase value`, `Value per Purchase`, `Complete payment value` 중 가능한 값을 포함한다.

**TikTok Ads 2차 과거 export 분석 (2026-04-18 11:29 KST)**

- 원본 XLSX: `data/ads_csv/tiktok/raw/20260319_20260417_campaign_report.xlsx`
- 분석 문서: `tiktok/tiktok_ads_export_20260319_20260417_analysis.md`
- 처리 파일: `data/ads_csv/tiktok/processed/20260319_20260417_campaign_summary.csv`, `data/ads_csv/tiktok/processed/20260319_20260417_campaign_summary.json`
- 기간 합계: 비용 28,363,230원, 순 비용 28,363,230원, 노출 13,262,333, 목적지 클릭 365,991, 전환수 321, 총 구매수 321
- 구매값: 한국어 export에서 `총 구매 수(모든 채널)` 헤더가 2번 나온다. 첫 번째는 구매수, 두 번째는 `구매당 금액 * 구매수`와 맞아 구매값으로 추정해 `all_channels_purchase_value_inferred`로 표준화했다.
- TikTok 플랫폼 추정 구매값: 910,630,953원
- TikTok 플랫폼 추정 ROAS: 32.106 (`910,630,953 / 28,363,230`)
- Ads Manager 총합 ROAS 참고: `CTA 구매 ROAS(웹사이트)` 31.26, `VTA 구매 ROAS(웹사이트)` 0.49
- 로컬 스냅샷 예비 비교: `backend/data/crm.sqlite3`의 Attribution 원장은 `2026-03-29T10:26:32Z ~ 2026-04-12T04:13:40Z`까지만 있어 전체 기간을 덮지 못하지만, 이 범위의 TikTok payment_success는 confirmed 0원, pending 48건 551,074,000원, canceled 1건 750,000원이다. 플랫폼 추정 구매값과 confirmed gap은 910,630,953원이다.
- 운영 VM 전체 기간 비교: `https://att.ainativeos.net/api/attribution/ledger`를 `source=biocom_imweb`, `limit=10000`, `2026-03-19 ~ 2026-04-17`로 read-only 조회했다. 전체 원장 2,516행 중 TikTok payment_success는 50행이고 confirmed 0건/0원, pending 49건/551,095,900원, canceled 1건/750,000원이다.
- 로컬 테이블/API: `backend/data/crm.sqlite3`에 `tiktok_ads_campaign_range`를 생성했고, 처리 CSV 2개 기간 12행을 upsert했다. `GET /api/ads/tiktok/roas-comparison?start_date=2026-03-19&end_date=2026-04-17`에서 TikTok Ads 기간 합계와 운영 VM gap을 함께 반환한다.
- 프론트: `/ads/tiktok`은 위 API를 호출해 TikTok 광고비 28,363,230원, 플랫폼 구매값 910,630,953원, 플랫폼 ROAS 32.106, 운영 confirmed 0원, pending 551,095,900원을 표시한다.
- 한계: `date` 없음, 어트리뷰션 윈도우 없음. 캠페인 기간 합계 기준 L3 검증은 가능하지만, 일자별 `tiktok_ads_daily` 적재와 Guard 전후 일 단위 비교는 불가

**실행 단계**

1. [Codex 완료] CSV 적재 경로·명명 규약 고정 — `data/ads_csv/tiktok/README.md`
2. [Codex 완료] 1차 XLSX 원본 보관 및 변환 — `raw/20260401_20260418_campaign_report.xlsx`, `processed/20260401_20260418_campaign_summary.csv`, `processed/20260401_20260418_campaign_summary.json`
3. [Codex 완료] TikTok Business API 설정 런북 작성 — `tiktok/tiktok_business_api_setup.md`
4. [Codex 완료] 2차 과거 XLSX 원본 보관 및 변환 — `raw/20260319_20260417_campaign_report.xlsx`, `processed/20260319_20260417_campaign_summary.csv`, `processed/20260319_20260417_campaign_summary.json`
5. [Codex 완료] 운영 VM 원장 read-only 직접 조회 — `2026-03-19 ~ 2026-04-17`, `limit=10000`, TikTok payment_success 50행 확인
6. [Codex 완료] 로컬 기간 합계 테이블 생성 — `backend/data/crm.sqlite3`의 `tiktok_ads_campaign_range`, 현재 2개 기간 12행
7. [Codex 완료] 집계 API 추가 — `GET /api/ads/tiktok/roas-comparison?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
8. [Codex 완료] `/ads/tiktok` 프론트 최신화 — 플랫폼 ROAS, 운영 VM confirmed/pending/canceled, confirmed gap, 캠페인별 표 표시
9. [TJ] 일자별 재export CSV/XLSX를 `data/ads_csv/tiktok/` 경로에 업로드하거나 API 접근값을 저장소 밖 안전한 방식으로 제공
10. [Codex] 일자별 파일 수령 후 `tiktok_ads_daily` 테이블 분리 생성 여부 재검토 — 현재 기간 합계 테이블과 섞지 않는다
11. [Codex] 일자별 내부 장부 조인 쿼리 3종 작성
12. [Codex/Claude Code] pending 포함/제외 토글과 일자별 시계열 차트 보강
13. [TJ] 로컬에서 검증 — TikTok Ads Manager 웹 화면 숫자와 `/ads/tiktok` 숫자가 기간·캠페인 단위로 일치하는지 확인
14. [TJ] 운영 배포 승인 — gap의 절대·상대 편차가 "설명 가능한 범위"인지 판단

---

#### Phase1-Sprint3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 과거 TikTok ROAS 재검증
**상태**: 우리 기준 85% / 운영 기준 70%

**무엇을 하는가**

Sprint 1 Guard 적용 **전** 기간에 대해, 내부 장부(Attribution + Toss)로 재구성한 확정 매출과 TikTok Ads Manager가 보고한 구매값을 비교해 **과거 ROAS의 과대/과소 여부**를 판정한다.

**왜 필요한가**

Guard가 돌기 시작한 2026-04-17 이후는 깨끗해지지만, 그 전에 집행한 광고 예산이 **정말 효과가 있었는지**는 여전히 의심 상태다. 재검증이 없으면 "예전에 TikTok이 ROAS 5 찍었다"는 숫자를 계속 근거로 써야 한다.

**고등학생 비유**

"작년 성적표에 가채점으로 매긴 수학 점수가 실제 답안지와 맞는지 **다시 채점해 본다.**" 가채점(광고 플랫폼 주장)과 실제 답안(입금 장부)이 다르면, 올해 공부 전략을 바꿀 수 있다.

**산출물**

- 캠페인 × 일자 단위 재검증 리포트 (L3~L4 레벨)
- 과대 가능 금액 표: `플랫폼 구매값 - 내부 확정매출`
- pending 오염 후보 합계 (Guard 전 `Purchase`로 잘못 발화됐을 가능성 금액)

**역할 구분**

- TJ: TikTok Ads Manager 과거 CSV export (최대 가능 기간), 결제 매체 혼동 사례 확인
- Codex: Attribution + Toss 조인 쿼리, 캠페인/일자 집계, 판정 기준 자동화
- Claude Code: 재검증 리포트 문서 작성, 비교 표·차트 정리

**검증 가능 레벨**

| 레벨 | 필요한 데이터 | 산출물 |
|---|---|---|
| L1 | Attribution 원장 + Toss | TikTok 귀속 확정/pending/취소 건수·금액 |
| L2 | L1 + TikTok 광고비 CSV | 내부 Att ROAS |
| L3 | L2 + TikTok 플랫폼 구매값 | 플랫폼 ROAS vs 내부 ROAS gap |
| L4 | L3 + 캠페인 매핑 | 캠페인별 gap, 예산 이동 판단 |

**판정 기준 요약**

| 상황 | 해석 |
|---|---|
| 플랫폼 구매값 > 내부 확정매출, 내부 pending 큼 | 가상계좌 오염 과대 가능성 |
| 플랫폼 구매값 ≈ 내부 확정매출 | 플랫폼 ROAS 대체로 맞음 |
| 플랫폼 구매값 < 내부 확정매출 | 웹 이벤트 손실 또는 어트리뷰션 윈도우 차이 |
| GA4 purchase 높고 Toss confirmed 낮음 | GA4도 pending을 purchase로 잡았을 가능성 |

**현재 확인된 사실**

- TikTok Ads 2차 과거 export (`2026-03-19 ~ 2026-04-17`): 플랫폼 기준 구매수 321건, 추정 구매값 910,630,953원, 추정 ROAS 32.106.
- 운영 VM 원장 직접 조회 (`/api/attribution/ledger`, `source=biocom_imweb`, `limit=10000`, 2026-04-18 12:14 KST): 전체 원장 2,516행, TikTok payment_success 50행.
- 운영 VM TikTok 귀속 결제상태: confirmed 0건 / 0원, pending 49건 / 551,095,900원, canceled 1건 / 750,000원.
- gap: 플랫폼 구매값 - confirmed = 910,630,953원. 플랫폼 구매값 - confirmed - pending = 359,535,053원.
- ROAS: confirmed ROAS 0, confirmed + pending potential ROAS 19.430. TikTok 플랫폼 ROAS 32.106과 큰 차이가 난다.
- 판단: 과거 TikTok 웹 `Purchase`는 실제 확정 매출보다 크게 잡혔을 가능성이 매우 크다. 특히 확정매출은 0원인데 플랫폼 구매값이 9.1억원으로 잡혔다는 점이 핵심이다.
- 주의: 이번 검증은 캠페인 기간 합계 기준이다. 일자별 `Date` 컬럼이 없어 Guard 전후 일 단위 추세와 일자별 캠페인 매칭은 아직 불가능하다.

**우리 프로젝트에 주는 도움**

TikTok에 그동안 태웠던 광고비의 실제 효율을 **뒤늦게라도** 숫자로 말할 수 있다. 다음 분기 예산 배분 회의에서 "근거 없음"을 "확정매출 기준 ROAS X"로 바꿀 수 있다.

**실행 단계**

1. [Codex 완료] TikTok Ads 과거 기간 XLSX 분석 — 플랫폼 구매값 910,630,953원, ROAS 32.106 산출
2. [Codex 완료] 기준 데이터 소스를 **운영 VM 장부**로 고정 — `operational_vm_ledger`, 로컬 스냅샷은 참고용으로 격하
3. [Codex 완료] TikTok 유입 주문 추출 — `ttclid`, TikTok referrer, TikTok UTM, metadata URL 기준
4. [Codex 완료] 결제상태별 집계 — confirmed 0원, pending 551,095,900원, canceled 750,000원
5. [Codex 완료] CSV vs 운영 VM gap API 작성 — `platformMinusConfirmed`, `platformMinusConfirmedAndPending`, `confirmedRoas`, `potentialRoas`
6. [Codex 완료] `/ads/tiktok`에 재검증 결과 표시
7. [Codex 완료] 분석 문서 보강 — `tiktok/tiktok_ads_export_20260319_20260417_analysis.md`
8. [TJ] 리포트 검토 — 과대 가능 금액 910,630,953원과 pending 오염 후보 551,095,900원 확인
9. [TJ] 일자별 재export/API 접근값 제공 시 L4 재검증으로 확장 — 캠페인 × 일자 단위 gap, Guard 전후 추세
10. [TJ] 다음 분기 TikTok 예산 배분 회의에 리포트 제출

---

### Phase 2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**TikTok 이벤트 품질 개선**

- 목표: Phase 1이 끝난 뒤, 이벤트 자체의 품질(Events API 필요 여부, 퍼널 이벤트 중복/누락)을 개선한다.
- 왜 지금이 아닌가: 숫자 기준이 만들어지기 전에 Events API를 붙이면 **중복 전환**과 dedup 실패 리스크가 더 커진다.
- 산출물: TikTok 퍼널(ViewContent → AddToCart → InitiateCheckout → Purchase)이 Pixel Helper와 Events Manager에서 **동일하게** 보이는 상태, `event_id` 규칙 한 가지 고정
- 완료 기준: 중복 이벤트 0건, 누락 이벤트 0건, dedup 일관
- 다음 Phase에 주는 가치: 이후 채널 확장·자동 입찰 전략이 이벤트 신호를 신뢰할 수 있게 된다

---

#### Phase2-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok Events API 조건부 도입
**상태**: 대기 (진행 조건 미충족)

**무엇을 하는가**

TikTok Events API(서버 → TikTok 전송)를 붙일지 말지 **결정한다.** 아래 세 조건이 모두 충족되면 진행, 아니면 보류한다.

**진행 조건**

1. Sprint 1 Guard 이후에도 TikTok 인앱 브라우저/리다이렉트 구간에서 구매 손실이 크다고 **숫자로** 확인됨
2. 가상계좌 입금 완료 시점에 서버에서 `Purchase`를 쏴야 할 실제 필요가 확인됨
3. 웹 `Purchase`와 서버 `Purchase`의 `event_id` dedup 규칙을 동일하게 만들 수 있음

**고등학생 비유**

"계산대 카메라만으로 매출 집계가 부족한 게 **숫자로 확인됐을 때**, 비로소 창고 쪽에 보조 카메라를 단다." 먼저 달면 같은 손님을 두 번 세는 사고가 생긴다.

**금지 사항**

- 웹 `Purchase`가 살아 있는 상태에서 같은 주문의 서버 `Purchase`를 무작정 추가 전송 금지
- Meta CAPI 코드를 TikTok Events API로 혼용 금지 (모듈·로그·환경변수 분리)

**역할 구분**

- TJ: 진행 조건 충족 판정(Phase 1 숫자 본 후), Events API 토큰 발급 승인
- Codex: `event_id` dedup 규칙 설계, 서버 송신 엔드포인트, 중복 전환 회귀 테스트
- Claude Code: 모니터링 화면(웹/서버 이벤트 쌍 매칭율)

---

#### Phase2-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 퍼널 이벤트 품질 정리
**상태**: 대기

**무엇을 하는가**

`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`의 발화 위치·파라미터를 통일하고 중복·누락을 제거한다.

**확인 항목**

- `ViewContent`가 상품 페이지에서 2회 잡히는 중복 원인
- `AddToCart` 수신 여부
- `InitiateCheckout`이 Pixel Helper와 Events Manager에서 같은 단계로 보이는지
- `content_id`, `content_name`, `value`, `currency` 형식 통일
- `event_id` 규칙: `Purchase_{order_code}` vs `Purchase.{order_code}` 중 하나로 고정

**역할 구분**

- TJ: 실제 상품 페이지 왕복 테스트
- Codex: 이벤트 파라미터 표준 스키마, dedup 규칙 확정
- Claude Code: 아임웹 헤더 코드 정리, 이벤트 발화 위치 문서화

---

## 승인 필요 항목

- [x] 운영 헤더 TikTok Guard enforce 적용 (2026-04-17 TJ 승인 완료)
- [x] TikTok Ads Manager 캠페인 1차 XLSX export 수령 (2026-04-18)
- [x] TikTok Ads Manager 과거 2차 XLSX export 수령 (2026-04-18)
- [x] 로컬 SQLite 기간 합계 테이블 생성 및 CSV upsert (2026-04-18 TJ 요청 범위)
- [ ] TikTok Ads Manager 재export — `Date`와 구매 전환값 포함
- [ ] TikTok Business API read-only 접근값(access token, advertiser ID) 사용 승인 — API 경로 선택 시에만
- [ ] Events API 토큰 발급 (Phase 2 진입 시점에만)

## 현재 병목

1. **TikTok Ads Manager 일자 데이터 미확보** — 2차 XLSX로 캠페인 기간 합계 구매값은 확보. 일자별 Guard 전후 비교와 `tiktok_ads_daily` 적재에는 `Date`가 필요
2. **TikTok Business API 자동화 미연결** — developer app은 Pending 상태이고, read-only access token과 advertiser ID가 없어 Codex 단독 자동 수집은 아직 불가
3. **운영 배포 판단** — 로컬 `/ads/tiktok` 화면은 최신화했지만 운영 반영 여부는 TJ 검토 후 결정

## 다음 액션

- 완료 (Codex): 로컬 enforce 후보 코드 `debug=false` 반영 (`tiktok/tiktok_purchase_guard_enforce_v1.js`, `tiktok/imwebcode_enforce_candidate.md`). 운영 아임웹 헤더 반영은 TJ가 코드 교체 여부를 결정
- 완료 (Codex): TikTok Ads CSV 수령 경로와 필수 컬럼 문서화 (`data/ads_csv/tiktok/README.md`)
- 완료 (Codex): TikTok Ads Manager CSV export와 Business API Reporting 접근 가능성 확인. 현재 Codex 단독으로는 Ads Manager 계정 데이터 다운로드 불가
- 완료 (Codex): 2026-04-01 ~ 2026-04-18 TikTok 캠페인 XLSX 원본 이동·분석·CSV/JSON 변환. 결론은 비용 데이터로만 사용 가능, ROAS 검증에는 재export 필요
- 완료 (Codex): TikTok Business API 설정 런북 작성 (`tiktok/tiktok_business_api_setup.md`)
- 완료 (Codex): 2026-03-19 ~ 2026-04-17 TikTok 과거 XLSX 원본 복사·분석·CSV/JSON 변환. 플랫폼 추정 구매값 910,630,953원, 추정 ROAS 32.106 기록
- 완료 (Codex): 운영 VM `/api/attribution/ledger`를 read-only로 조회해 2026-03-19 ~ 2026-04-17 TikTok payment_success 50행과 confirmed/pending/canceled 금액 확정
- 완료 (Codex): 로컬 `tiktok_ads_campaign_range` 테이블 생성 및 2개 기간 12행 upsert
- 완료 (Codex): `/api/ads/tiktok/roas-comparison` API 추가
- 완료 (Codex): `/ads/tiktok` 프론트 최신화 — 플랫폼 구매값, 운영 VM confirmed/pending, gap, 캠페인별 ROAS 표시
- 후속 (Codex): 재export 파일 또는 API read-only 접근값이 들어오면 dry-run 파서/조회 스크립트부터 작성. 일자별 데이터는 새 `tiktok_ads_daily` 테이블로 분리하는 쪽을 우선 검토
- 후속: `fbevents.js` 중복 경고 별도 이슈로 분리
- 이번 주 (TJ): 가능하면 TikTok Ads Manager에서 2026-03-19 ~ 2026-04-17 일자별 재export. `Date`, `Campaign ID`, `Campaign name`, `Cost`, `Purchase count`, `Purchase value`, `CTA/VTA Purchase ROAS`를 포함. API 경로를 택하면 TikTok Business API read-only access token과 advertiser ID 준비
- CSV 수령 후 (Codex + Claude Code): `/ads/tiktok`에 일자별 시계열과 pending 포함/제외 토글 추가
- 운영 승인 후 (TJ): Phase 2 진입 여부 재평가 (Phase 1 숫자 기준)

---

## 이번 로컬 검증 (2026-04-18)

| 항목 | 결과 |
|---|---|
| 운영 VM 원장 조회 | 성공. `source=biocom_imweb`, `limit=10000`, `2026-03-19 ~ 2026-04-17`에서 2,516행 수신 |
| TikTok 운영 VM 필터 | TikTok payment_success 50행. confirmed 0원, pending 551,095,900원, canceled 750,000원 |
| 로컬 테이블 | `tiktok_ads_campaign_range` 생성 및 12행 upsert. `2026-03-19 ~ 2026-04-17` 6행 / 구매값 910,630,953원 |
| API | `GET /api/ads/tiktok/roas-comparison?start_date=2026-03-19&end_date=2026-04-17` 성공 |
| 프론트 | `http://localhost:7010/ads/tiktok` HTTP 200 확인 |
| 브라우저 렌더링 | Playwright + 시스템 Chrome으로 핵심 문구와 `₩28,363,230`, `₩910,630,953`, `32.11x`, `₩551,095,900` 렌더링 확인. 스크린샷: `/tmp/ads-tiktok-roas.png` |
| 백엔드 서버 유지 | `app.listen()` 서버 참조 보관 후 `PORT=7099`, `BACKGROUND_JOBS_ENABLED=0` 조건에서 listen 유지 확인 |
| Backend typecheck | `npm run typecheck` 통과 |
| Targeted frontend lint | `npx eslint src/app/ads/tiktok/page.tsx` 통과 |
| Frontend 전체 lint | 실패. 기존 다른 화면의 `react/no-unescaped-entities`, `react-hooks/set-state-in-effect`, unused warning 등 62건. 이번 `/ads/tiktok` 변경 파일 문제는 없음 |

---

## 개발 부록

### §A. Sprint 1 진행 타임라인 (2026-04-17)

| 단계 | 주문 코드 | Toss 상태 | Guard 판정 | Pixel Helper | 비고 |
|---|---|---|---|---|---|
| dry-run v1 | - | - | `getDecisions()` 빈 배열 | Purchase 발생 | wrapper 미부착 |
| dry-run v2 (scan 90s) | `o20260416f773f401e36ab` | WAITING_FOR_DEPOSIT | pending / block_purchase_virtual_account | Purchase 발생 | 50ms polling이 초기 호출 놓침 |
| dry-run v3 (setter/accessor) | `o20260416468f86bc166d8` | WAITING_FOR_DEPOSIT | pending / block_purchase_virtual_account | Pageview, Purchase (dry-run 정상) | wrap 감지 성공 |
| enforce v1 가상계좌 | `o2026041768352d7d5c0be` | WAITING_FOR_DEPOSIT | pending / block_purchase_virtual_account | Pageview, **PlaceAnOrder** (Purchase 차단) | matchedBy=toss_direct_order_id |
| enforce v1 카드 | `o20260417e5f96821a15d7` | DONE (approvedAt 2026-04-17T17:21:36+09:00) | confirmed / allow_purchase | Pageview, Purchase 유지 | Meta Pixel Helper도 Purchase active, value=35000 KRW |

### §B. Guard 상태 확인 디버그 객체

```
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.state.accessors
  // { TIKTOK_PIXEL: true, ttq: true }
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.state.wrappers
  // { tiktokPixelTrack: true, tiktokPixelInit: true, ttqTrack: true }
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.getDecisions()
  // enforce 이후 주문별 판정 기록
```

### §C. 관련 코드·문서 위치

- `tiktok/tiktok_purchase_guard_enforce_v1.js` — 운영 적용 본체
- `tiktok/imwebcode.md` — 아임웹 헤더 설치 코드 (v3)
- `tiktok/imwebcode_enforce_candidate.md` — enforce 교체용 설치 코드
- `backend` `/api/attribution/payment-decision` — 결제 판정 API
- `frontend` `/ads/tiktok` — Sprint 2 작업 대상 화면
- `data/ads_csv/tiktok/README.md` — TikTok Ads CSV 수령 경로·필수 컬럼·검증 규칙
- `tiktok/tiktok_ads_export_20260401_20260418_analysis.md` — 1차 TikTok Ads XLSX 분석 결과
- `tiktok/tiktok_ads_export_20260319_20260417_analysis.md` — 2차 TikTok Ads 과거 XLSX 분석 결과
- `tiktok/tiktok_business_api_setup.md` — TikTok Business API read-only Reporting 설정 런북
- `backend/src/tiktokRoasComparison.ts` — TikTok Ads 로컬 테이블 upsert, 운영 VM 원장 조회, gap 계산
- `backend/src/routes/ads.ts` — `/api/ads/tiktok/roas-comparison` 라우트
- `backend/src/server.ts` — background job 비활성화 상태에서도 listen server 참조 유지
- `frontend/src/app/ads/tiktok/page.tsx` — TikTok ROAS 정합성 화면
- `backend/data/crm.sqlite3` — 로컬 Attribution 스냅샷 및 `tiktok_ads_campaign_range` TikTok Ads 기간 합계 캐시 테이블
- `tiktok/tiktok0329_claude1.md` — 초기 진단 보조 문서 (참고용)

### §D. 데이터 소스별 역할·한계

| 데이터 | 역할 | 한계 |
|---|---|---|
| 내부 Attribution 원장 | TikTok 유입 주문 후보 추출, paymentStatus 분리 | 결제완료 페이지 미도달 주문 누락 가능 |
| Toss 결제 | 확정매출 판정 기준(`DONE`) | 광고 유입 정보 없음 — 조인 필요 |
| 아임웹 주문 | `order_no`, 금액, 시각 | 광고 유입/클릭 ID 없음 |
| GA4 | source/medium/campaign, `transaction_id` | 결제완료 페이지 기준 pending 혼입 가능. Toss 조인 필수 |
| TikTok Ads CSV/API | spend, conversions, purchase value, ROAS | 2차 XLSX로 2026-03-19 ~ 2026-04-17 캠페인 기간 합계 구매값·ROAS 확보. 일자별 데이터와 어트리뷰션 윈도우는 없음 |

---

## 버전 기록

- **v2.7** (2026-04-18 12:14 KST): 운영 VM `/api/attribution/ledger` read-only 전체 기간 비교 반영. 2026-03-19 ~ 2026-04-17 TikTok payment_success 50행, confirmed 0원, pending 551,095,900원, canceled 750,000원 확정. 로컬 `tiktok_ads_campaign_range` 테이블 생성, `/api/ads/tiktok/roas-comparison` API 추가, `/ads/tiktok` 프론트 최신화, background job 비활성화 상태의 7020 listen 유지 보완 기록.
- **v2.6** (2026-04-18 11:29 KST): TikTok Ads 2차 과거 XLSX 분석 반영. 2026-03-19 ~ 2026-04-17 총 비용 28,363,230원, 구매수 321건, 추정 구매값 910,630,953원, 추정 ROAS 32.106 기록. 한국어 export의 중복 `총 구매 수(모든 채널)` 헤더 이슈와 `all_channels_purchase_value_inferred` 표준화 기록. 로컬 스냅샷 예비 비교에서 confirmed 0원, pending 551,074,000원 확인. 다음 액션을 운영 VM 원장 전체 기준 Toss `DONE/pending` gap 계산으로 갱신.
- **v2.5** (2026-04-18 05:35 KST): TikTok Ads 1차 XLSX 원본 이동·분석·CSV/JSON 변환 반영. 총 비용 16,277,105원 등 기간 합계 기록, `date`·구매값·어트리뷰션 윈도우 누락으로 ROAS 검증에는 재export 필요하다고 판정. TikTok Business API 설정 런북(`tiktok/tiktok_business_api_setup.md`)과 1차 export 분석 문서(`tiktok/tiktok_ads_export_20260401_20260418_analysis.md`) 추가.
- **v2.4** (2026-04-18 05:15 KST): TikTok Ads Manager CSV export와 Business API Reporting 접근 가능성 확인 반영. Codex 단독 다운로드 불가, API 경로의 필요값(access token, advertiser ID, 권한)과 수동 CSV 최단 경로를 Sprint 2·3 실행 단계에 반영.
- **v2.3** (2026-04-17 18:50 KST): Codex 즉시 실행분 반영. enforce 후보 코드 `debug=false` 로컬 반영, TikTok Ads CSV intake README 추가, 운영 VM 원격 조회의 최신 200건 제한을 과거 재검증 병목으로 명시.
- **v2.2** (2026-04-17 18:46 KST): Sprint 1의 "남은 후속" 섹션 제거(100% 완료 Sprint에는 잔여 작업 섹션 금지 규칙 — docurule §5-4). Sprint 2·3에 **실행 단계** 섹션 신설 — 담당 태그(`[TJ]/[Codex]/[Claude Code]`) 붙은 시간 순서 번호 리스트(docurule §3-6C).
- **v2.1** (2026-04-17 18:45 KST): Obsidian이 GitHub 스타일 `#소문자-하이픈` 앵커와 `<a id>` 태그를 인식하지 못해 Obsidian wiki 링크 (`[[#헤딩이름]]`) 형식으로 교체. 헤딩을 단순화(`Phase1-Sprint1`만 남김)해서 링크 타겟과 매치.
- **v2** (2026-04-17 18:00 KST): docurule.md v2 규칙 적용. P0~P3 → Phase1-Sprint1 ~ Phase2-Sprint5로 재구성. 요약표·앵커·역할 구분 추가. enforce v1 운영 검증 반영.
- **v1** (2026-04-16 ~ 2026-04-17): `tiktok/action.md` 기반 초본 + dry-run v1/v2/v3 + enforce v1 검증 기록.

백업: `tiktok/tiktokroasplan.md.bak_20260417_docurule_v2_rewrite`
