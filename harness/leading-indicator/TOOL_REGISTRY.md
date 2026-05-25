# Leading Indicator Tool Registry

작성 시각: 2026-05-25 19:15 KST
기준일: 2026-05-25
문서 성격: 선행지표 에이전트 도구 사용 안내서 초안
Lane: Green documentation
운영 영향: 운영DB 변경 없음 / VM Cloud 배포 없음 / 외부 플랫폼 전송 없음

## 10초 요약

이 문서는 선행지표 에이전트가 사용할 수 있는 도구 12개를 정리한다.
목적은 "어떤 도구가 읽기만 하는지, 어떤 도구는 승인 후에만 써야 하는지, 어떤 도구는 자동 실행하면 안 되는지"를 한눈에 보이게 하는 것이다.

1차 원칙은 간단하다.
선행지표 에이전트는 읽고, 계산하고, 보고한다.
운영 설정 변경, 외부 플랫폼 전송, 배포는 하지 않는다.

## 안전 등급

| 등급 | 쉬운 뜻 | 자동 실행 가능 여부 |
|---|---|---|
| Green | 읽기/문서/로컬 계산만 수행 | 가능 |
| Yellow | 제한된 운영 환경에 영향을 줄 수 있음 | TJ님 승인 후 가능 |
| Red | 외부 계정, 광고비, 운영 설정, 운영DB에 직접 영향 | 자동 실행 금지 |

## 결과 기록 공통 양식

모든 도구 결과는 아래 항목을 남긴다.

| 항목 | 뜻 |
|---|---|
| source | 어떤 데이터/문서/화면을 봤는가 |
| window | 어떤 기간을 봤는가 |
| freshness | 데이터가 얼마나 최신인가 |
| site | biocom, thecleancoffee 등 대상 사이트 |
| confidence | 결과 신뢰도 |
| allowed_actions | 이번 실행에서 허용된 행동 |
| forbidden_actions | 이번 실행에서 금지된 행동 |
| blocker_category | 실패했을 때 원인 분류 |

## 도구 목록 12개

### 1. VM Cloud 선행지표 읽기

- tool_id: `vm_cloud_leading_indicator_read`
- 쉬운 이름: VM Cloud에서 구매 전 행동 집계 읽기
- 안전 등급: Green
- 허용: live aggregate 조회, 최근 7일/28일 비교, source freshness 기록
- 금지: VM Cloud 배포, DB 수정, 캐시 강제 재작성
- 결과: 방문자/구매자/이탈자 집계, 체류시간, 스크롤, 결제 시작 후 이탈
- 실패 시 원인: `source_freshness_gap`, `api_unavailable`, `data_missing`

### 2. GA4 BigQuery 행동 데이터 읽기

- tool_id: `ga4_bigquery_behavior_read`
- 쉬운 이름: GA4 BigQuery에서 구매 전 행동 테이블 읽기
- 안전 등급: Green
- 허용: read-only SQL, table inventory, 최근 daily table 확인
- 금지: table copy, dataset 생성, table 삭제/수정, GA4 Link 변경
- 결과: page_view, scroll, begin_checkout, purchase 전후 행동 요약
- 실패 시 원인: `permission_denied`, `source_freshness_gap`, `query_error`

### 3. 내부 결제완료 원장 읽기

- tool_id: `internal_confirmed_order_read`
- 쉬운 이름: 실제 결제완료 주문 수와 매출 읽기
- 안전 등급: Green
- 허용: read-only 조회, 집계, 기준선 계산
- 금지: 운영DB insert/update/delete, 주문 상태 변경
- 결과: 결제완료 주문 수, 매출, 객단가, 결제수단별 기준선
- 실패 시 원인: `permission_denied`, `source_unavailable`, `filter_mismatch`

### 4. 채널/광고 유입 증거 읽기

- tool_id: `channel_evidence_read`
- 쉬운 이름: 광고 클릭과 유입 증거 읽기
- 안전 등급: Green
- 허용: UTM, gclid, fbclid, NaPm 등 존재 여부 집계
- 금지: raw identifier 출력, 플랫폼 전송, 쿠키/태그 운영 변경
- 결과: 채널별 session 수, 유입 증거 coverage
- 실패 시 원인: `pii_risk`, `source_missing`, `join_key_gap`

### 5. GTM 내보내기 읽기

- tool_id: `gtm_export_read`
- 쉬운 이름: GTM 설정을 읽어 중간 이벤트 수집 여부 확인
- 안전 등급: Green
- 허용: export JSON 읽기, trigger/tag 존재 여부 확인
- 금지: GTM Preview 생성, Workspace 수정, Production publish
- 결과: 수집 이벤트 후보, 누락 태그, 위험 태그
- 실패 시 원인: `workspace_unavailable`, `permission_denied`, `export_missing`

### 6. 로컬 dry-run 스크립트 실행

- tool_id: `local_leading_indicator_dry_run`
- 쉬운 이름: 로컬에서 가짜 전송 없이 계산만 실행
- 안전 등급: Green
- 허용: 로컬 파일/캐시 읽기, JSON/Markdown 결과 생성
- 금지: 운영DB write, 외부 API send, deploy
- 결과: cohort, behavior metric, leading signal, 품질 판정
- 실패 시 원인: `technical_failure`, `schema_error`, `source_missing`

### 7. 품질 판정 실행

- tool_id: `leading_indicator_eval_run`
- 쉬운 이름: 추천 후보를 써도 되는지 검사
- 안전 등급: Green
- 허용: 데이터 최신성, 비교 집단 크기, 구매 후 행동 혼입 여부, 실행 가능성 검사
- 금지: 추천 후보 자동 승인, 운영 반영
- 결과: PASS, PASS_WITH_NOTES, HOLD, FAIL
- 실패 시 원인: `cohort_too_small`, `source_freshness_gap`, `not_actionable`

### 8. 실행 기록 생성

- tool_id: `run_packet_write_local`
- 쉬운 이름: 실행 결과를 로컬 JSON/Markdown으로 남기기
- 안전 등급: Green
- 허용: `data/project/`, `project/`에 로컬 결과 파일 생성
- 금지: 운영DB write, 외부 업로드, 자동 commit
- 결과: 기계용 실행 기록, 사람용 보고서
- 실패 시 원인: `file_write_error`, `schema_error`

### 9. 정적 HTML 보고서 생성

- tool_id: `static_frontend_report_write`
- 쉬운 이름: 사람이 보는 정적 HTML 보고서 만들기
- 안전 등급: Green
- 허용: `report/` 아래 정적 HTML 생성/수정
- 금지: 서버 배포, 운영 라우트 전환, 외부 전송
- 결과: KPI 카드, 도표, OKR, 다음 할 일
- 실패 시 원인: `render_error`, `layout_risk`, `accessibility_gap`

### 10. Telegram 알림 초안 생성

- tool_id: `telegram_summary_draft`
- 쉬운 이름: Telegram에 보낼 메시지 초안 만들기
- 안전 등급: Green
- 허용: 메시지 문안 생성, 보류 원인과 다음 확인 명령 작성
- 금지: 실제 Telegram 발송
- 결과: 알림 제목, 핵심 숫자, HOLD 원인, 다음 확인점
- 실패 시 원인: `message_too_technical`, `missing_next_action`

### 11. Telegram 실제 발송

- tool_id: `telegram_send`
- 쉬운 이름: Telegram에 실제 메시지 보내기
- 안전 등급: Yellow
- 허용: TJ님이 승인한 범위의 상태 알림 발송
- 금지: raw identifier 포함, 외부 플랫폼 전환값 전송, 광고 계정 변경
- 결과: 발송 성공/실패 로그
- 실패 시 원인: `approval_required`, `token_missing`, `send_failed`

### 12. 배포/외부 전송 계열

- tool_id: `deploy_or_platform_send`
- 쉬운 이름: 서버 반영 또는 광고/분석 플랫폼 전송
- 안전 등급: Red
- 허용: 승인 문서 작성 전까지 없음
- 금지: 자동 실행, 운영DB write, GTM publish, GA4/Meta/Google Ads/TikTok/Naver send/upload
- 결과: 이번 Green Lane에서는 항상 HOLD
- 실패 시 원인: `approval_required`

## 추천 기본 실행 순서

1. VM Cloud 또는 GA4 BigQuery에서 행동 집계를 읽는다.
2. 내부 결제완료 원장 기준선을 읽는다.
3. 채널/광고 유입 증거를 붙인다.
4. 로컬 dry-run으로 비교 집단과 행동 숫자를 만든다.
5. 품질 판정 기준을 통과한 신호만 추천 후보로 올린다.
6. 실행 기록과 HTML/Markdown 보고서를 남긴다.
7. Telegram은 초안까지만 만들고, 실제 발송은 승인 범위를 확인한다.

## 금지선

- 광고 플랫폼 전송 자동 실행 금지
- GTM Production publish 금지
- GA4 BigQuery Link 변경 금지
- 운영DB write 금지
- raw customer/order/payment/ad-click identifier 출력 금지
- 미니 디지털 트윈 결과로 자동 예산 변경 금지

## 현재 상태

- 도구 목록 12개: 작성 완료
- Green/Yellow/Red 구분: 작성 완료
- 실제 자동 실행 연결: 없음
- 운영 변경: 없음
- 추천 자신감: 84%
