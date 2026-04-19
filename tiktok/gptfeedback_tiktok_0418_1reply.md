# 2026-04-19 추가 개발 요약

TJ님 요청으로 원문 피드백의 남은 개발 항목 중 Codex가 처리 가능한 부분을 추가 구현했다.

- 완료: `tiktok_ads_daily`와 운영 VM Attribution 원장을 KST 날짜 기준으로 조인하는 `daily_comparison` API 응답 추가
- 완료: `/ads/tiktok`에 일별 ROAS 추세 라인 차트 추가
- 완료: `confirmed 기준` / `confirmed+pending 기준` 전환 버튼 추가
- 완료: 날짜별 spend, 플랫폼 구매값, 플랫폼 ROAS, 운영 기준 매출, 운영 ROAS, gap 표 추가
- 확인: 2026-03-19 ~ 2026-04-17 일별 비교 30행 생성
- 확인: Guard 전 29일 플랫폼 ROAS 33.156487, 운영 potential ROAS 20.065652
- 확인: Guard 적용일 2026-04-17 플랫폼 구매값 0원, 운영 pending 0원
- 보류 유지: scheduled export 실제 활성화, attribution window 화면값 검증, pending 상위 20건 fate 확정, TikTok Business API 실조회는 계정/UI/토큰 또는 운영 화면 확인이 필요해 Codex 단독 완료 불가

검증:

- `backend npm run typecheck` 통과
- `frontend npx eslint src/app/ads/tiktok/page.tsx` 통과
- API 확인: `daily_comparison.rows=30`, `daily_comparison.summary.platformRoas=32.106038`, `daily_comparison.summary.potentialRoas=19.429942`
- 브라우저 확인: `일별 ROAS 추세`, `confirmed+pending 기준`, `Guard 전 29일`, Recharts SVG 렌더링 확인

---

# GPT Feedback 반영 결과 보고서

작성 시각: 2026-04-18 13:33 KST
원문: `tiktok/gptfeedback_tiktok_0418_1.md`
대상 화면: `http://localhost:7010/ads/tiktok`

## 결론

원문 피드백의 핵심인 "API 승인은 blocker가 아니며, 일자별 export 계약과 source/pending 검증을 먼저 해야 한다"는 방향을 코드와 문서에 반영했다.

이번 반영으로 `/ads/tiktok`은 기존 플랫폼 ROAS vs 운영 VM gap에 더해 다음을 보여준다.

- `tiktok_ads_daily` 적재 상태
- 일별 TikTok 플랫폼 ROAS vs 운영 confirmed/pending ROAS 추세
- TikTok 귀속 source 분류 사유별 주문수/금액
- pending 상위 20건 audit
- 각 pending 표본의 precision tier(high/medium/low)

## 구현 성공

| 원문 요구 | 반영 결과 | 위치 |
|---|---|---|
| API 승인을 주 경로/blocker로 두지 말 것 | Custom report + scheduled export를 API 승인 전 주 경로로 문서화 | `tiktok/tiktokroasplan.md`, `tiktok/tiktok_business_api_setup.md`, `data/ads_csv/tiktok/README.md` |
| 일자별 Custom report 포맷 고정 | `Date`, `Campaign ID`, `Campaign name`, `Cost`, `Purchase count/value`, `CTA/EVTA/VTA`, ROAS 지표 계약 추가 | `data/ads_csv/tiktok/README.md` |
| scheduled export 경로 명시 | API 승인 전 반자동 수집 경로로 scheduled export를 명시 | `data/ads_csv/tiktok/README.md`, `tiktok/tiktok_business_api_setup.md` |
| `tiktok_ads_daily` 테이블 만들기 | 로컬 SQLite에 `tiktok_ads_daily` 스키마 생성 및 일별 CSV 147행 적재 | `backend/src/tiktokRoasComparison.ts`, `backend/data/crm.sqlite3` |
| 일자별 ROAS 계산 | `tiktok_ads_daily`와 운영 VM 원장을 날짜별로 조인해 `daily_comparison` 30행 반환 | `backend/src/tiktokRoasComparison.ts` |
| pending 포함/제외 토글 | `/ads/tiktok`에서 confirmed 기준과 confirmed+pending 기준을 전환 | `frontend/src/app/ads/tiktok/page.tsx` |
| Guard 전후 일별 추세 | 일별 ROAS 라인 차트와 날짜별 gap 표 추가 | `frontend/src/app/ads/tiktok/page.tsx` |
| attribution window 계약 고정 | 기본 기준 Click 7일 / View 1일, 화면 설정이 다르면 수동 기록하도록 문서화 | `data/ads_csv/tiktok/README.md`, `tiktok/tiktokroasplan.md` |
| metric dictionary 고정 | 표준 컬럼과 한/영 export alias를 정리 | `data/ads_csv/tiktok/README.md` |
| source 분류 정밀도 점검 | `ttclid_direct`, `ttclid_url`, `utm_source_tiktok`, `referrer_tiktok`, `metadata_url_tiktok` 등 사유 코드화 | `backend/src/tiktokRoasComparison.ts`, `frontend/src/app/ads/tiktok/page.tsx` |
| pending 상위 주문 20건 수동 감정 준비 | API가 pending 금액순 Top 20을 반환하고 프론트에 표시 | `backend/src/tiktokRoasComparison.ts`, `frontend/src/app/ads/tiktok/page.tsx` |
| Events API는 아직 붙이지 말 것 | Phase2 조건부 유지. 서버 이벤트 추가 금지와 event_id/dedup 계약을 문서화 | `tiktok/tiktokroasplan.md` |
| API 승인 전 체크리스트 준비 | API 승인 전 체크리스트와 read-only Reporting 런북 보강 | `tiktok/tiktok_business_api_setup.md` |
| 결과를 프로젝트 관리 문서에 반영 | 로드맵 v2.8로 업데이트 | `tiktok/tiktokroasplan.md` |

## 확인된 수치

| 항목 | 값 |
|---|---:|
| TikTok Ads 플랫폼 구매값 | 910,630,953원 |
| TikTok Ads 플랫폼 ROAS | 32.106 |
| 운영 VM TikTok confirmed | 0건 / 0원 |
| 운영 VM TikTok pending | 49건 / 551,095,900원 |
| 운영 VM TikTok canceled | 1건 / 750,000원 |
| source reason 종류 | 7종 |
| pending audit 행 | 20행 |
| 최상위 pending 표본 | `202604052259913` / 260,100,000원 / high tier |
| `tiktok_ads_daily` 적재 행 | 147행 |
| `daily_comparison` 일별 행 | 30행 |
| 일별 플랫폼 ROAS | 32.106038 |
| 일별 potential ROAS | 19.429942 |
| Guard 전 potential ROAS | 20.065652 |

## 구현 실패 또는 보류

| 원문 요구 | 상태 | 이유 |
|---|---|---|
| scheduled export 실제 활성화 | TJ 작업 필요 | Ads Manager UI에서 계정 권한을 가진 사용자가 설정해야 한다. Codex는 현재 계정 UI 조작 권한이 없다 |
| attribution window 화면값 검증 | TJ 작업 필요 | 현재 export에는 attribution window 컬럼이 없다. Ads Manager 화면 설정 캡처 또는 재export가 필요하다 |
| 구매값 910,630,953원의 최종 확정 | 부분 보류 | 한국어 export의 중복 `총 구매 수(모든 채널)` 헤더 중 하나를 구매값으로 추정했다. Ads Manager 화면의 purchase value metric과 대조해야 대표 보고용 확정값이 된다 |
| pending 상위 20건의 실제 fate 확정 | TJ 작업 필요 | API는 표본을 뽑았지만, 실제 미입금 유지/후속 입금/취소/오분류 여부는 아임웹/Toss 운영 화면 확인이 필요하다 |
| TikTok Business API 실조회 | 보류 | developer app이 Pending이고 read-only access token, advertiser ID가 로컬에 없다. 다만 Phase 1 blocker는 아니다 |
| TikTok Events API 구현 | 의도적으로 미실행 | 원문 피드백대로 지금은 정의/귀속/창구 정렬이 우선이다. dedup 계약 전 서버 Purchase를 추가하면 오염을 증폭할 수 있다 |
| 전체 프론트 lint 통과 | 실패 | 기존 다른 화면의 `react/no-unescaped-entities`, `react-hooks/set-state-in-effect` 등 62건 때문에 실패. 이번 `/ads/tiktok` 변경 파일 lint는 통과 |

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `backend/src/tiktokRoasComparison.ts` | `tiktok_ads_daily` 스키마 생성, 일별 운영 원장 조인, `daily_comparison`, source reason summary, pending audit Top 20 API 응답 추가 |
| `frontend/src/app/ads/tiktok/page.tsx` | source 분류 사유 표, 일자별 ROAS 추세, confirmed/pending 토글, 날짜별 gap 표, pending 상위 20건 audit 표 추가 |
| `data/ads_csv/tiktok/README.md` | 일자별 Custom report 계약, metric dictionary, scheduled export 운영 규칙 추가 |
| `tiktok/tiktok_business_api_setup.md` | API 승인 전 체크리스트와 API 비blocker 판단 보강 |
| `tiktok/tiktokroasplan.md` | v2.8 업데이트, 병목/다음 액션/검증/Events API 전 계약 보강 |
| `tiktok/tiktok_ads_export_20260319_20260417_analysis.md` | source 분류와 pending audit 결과 추가 |

## 검증 결과

| 검증 | 결과 |
|---|---|
| `backend npm run typecheck` | 통과 |
| `frontend npx eslint src/app/ads/tiktok/page.tsx` | 통과 |
| API curl | 통과. `dailyRows=147`, `dailyComparisonRows=30`, `sourceReasons=7`, `pendingAuditRows=20` 확인 |
| SQLite 확인 | `tiktok_ads_campaign_range`, `tiktok_ads_daily` 테이블 존재. `tiktok_ads_daily` 147행 |
| Playwright + 시스템 Chrome | 통과. `/ads/tiktok`에서 일별 ROAS 추세, confirmed+pending 토글, Recharts SVG, source/audit 섹션 렌더링 확인 |
| `frontend npm run lint` | 실패. 기존 다른 화면 lint 이슈 62건. 이번 변경 파일 문제 아님 |

## 다음 입력 필요

1. Ads Manager attribution window 화면 설정값 캡처 또는 수동 기록
2. scheduled export 활성화 여부
3. pending 상위 20건 중 금액 큰 주문의 아임웹/Toss 상태 확인
4. API 경로를 계속 진행할 경우 read-only access token과 advertiser ID

## 후속 업데이트 — 2026-04-18 14:53 KST

TJ님이 `Tiktok Ads_date_주바이오컴_adv_20260319-20260417.csv`를 추가 제공해 일자별 export 미수령 상태가 해소됐다.

| 항목 | 결과 |
|---|---|
| 원본 보관 | `data/ads_csv/tiktok/raw/20260319_20260417_daily_ad_report.csv` |
| 일별 구조 | `일별 + 캠페인 + 광고그룹 + 광고` 단위. 실제 날짜 행 285개, 총계 행 1개 |
| 표준 처리 | `processed/20260319_20260417_daily_ad.csv`, `processed/20260319_20260417_daily_campaign.csv`, `processed/20260319_20260417_daily_campaign_summary.json` 생성 |
| 합계 검증 | 비용 28,363,230원, 구매수 321건, 구매값 910,630,953원, ROAS 32.106038. 기존 기간 합계 XLSX와 일치 |
| DB 적재 | `tiktok_ads_daily` 147행. minDate 2026-03-19, maxDate 2026-04-17 |
| API 확인 | `daily.rows=147`, `daily.importedRows=147` |
| 프론트 확인 | `/ads/tiktok`에서 `tiktok_ads_daily`, `현재 행은 147개`, `이번 호출 upsert는 147행` 노출 확인 |

2026-04-19 추가 개발에서 `일별 ROAS 계산`, 운영 confirmed/pending 날짜별 조인, `/ads/tiktok` 일별 시계열, pending 포함/제외 토글까지 완료했다. 남은 것은 Ads Manager/scheduled export/운영 주문 화면처럼 Codex가 직접 접근할 수 없는 외부 확인 작업이다.
