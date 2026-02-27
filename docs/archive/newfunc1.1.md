# newfunc 1.1 — 백엔드 고도화 진행 내역 + 추가로 필요한 데이터 정리

작성일: 2026-02-12  
대상 문서: `newfunc.md`, `biocom_seo_dashboard_prd.docx`

## 1) 이번 턴에서 진행한 백엔드 구현(가능한 범위)

### 1.1 칼럼별 스코어(기존 "placeholder" 제거)

기존 `GET /api/gsc/columns`는 아래 3개 점수가 고정값(placeholder)이라 실데이터 의미가 약했습니다.
- 기술 성능(tech) 20%
- 사용자 체류(engage) 25%
- AEO/GEO(aeo) 15%

이번에 아래처럼 **실데이터 기반으로 가능한 부분을 최대한 대체**했습니다.

- 검색 성과(search, 40%):
  - `position`, `ctr`, `clicks`를 조합해 0~40점 산출(상대 정규화 포함)
- 기술 성능(tech, 20%):
  - PageSpeed 측정 결과(캐시/DB)에 있는 경우에만 점수 반영
  - 없으면 0점(=측정 필요가 명확히 드러나도록)
- 사용자 체류(engage, 25%):
  - GA4가 활성화된 경우 `pagePath` 매칭으로 체류/이탈/스크롤 기반 점수 산출
  - GA4 미활성화/권한 문제 시 0점(=데이터 필요가 명확히 드러나도록)
- AEO/GEO(aeo, 15%):
  - (page, query) 기준으로 **Q&A형 검색어 노출 비중**을 계산해 점수화(근사치)

### 1.2 GA4 Engagement에 "스크롤" 근사치 추가

GA4 표준 리포트에서 "스크롤 깊이 평균"은 기본 제공 지표가 제한적이라, 다음 근사치를 추가했습니다.
- 페이지별 `scroll` 이벤트 카운트를 조회한 뒤
- `scrollDepth = (scroll 이벤트 수 / sessions) * 100` 형태로 **스크롤 완료율(%)**로 노출

> 주의: GA4 Enhanced Measurement의 scroll 이벤트가 켜져 있어야 의미가 있습니다(없으면 0으로 표시).

### 1.3 GA4 Funnel의 추정 단계를 실데이터로 대체(가능한 범위)

기존 퍼널의 “2페이지 이상 탐색” 단계는 고정 비율로 추정했는데,
이를 GA4의 `engagedSessions`(참여 세션)로 대체하고,
메트릭 조회가 실패하는 환경에서는 기존 추정 로직으로 fallback 되도록 했습니다.

### 1.4 PageSpeed 캐시 키 안정화(중복 방지)

PageSpeed 결과 캐시 키가 URL 문자열에 민감해 동일 페이지가 다른 문자열로 중복 저장될 수 있어,
URL 정규화(해시 제거/트레일링 슬래시 제거) 후 캐시하도록 개선했습니다.

### 1.5 Supabase(DB) 연결 훅 추가 + 일부 데이터 적재 지원

다음이 가능해졌습니다.
- Supabase 환경변수 인식(서버에서 service role key 사용)
- `/api/pagespeed/run` 실행 시 `pagespeed_weekly` 테이블에 insert 시도(실패해도 측정 결과는 반환)
- `/api/pagespeed/results` 호출 시 DB에서 최신 결과를 가져와 인메모리 캐시를 워밍업(칼럼 스코어 tech에 사용)
- `POST /api/cron/gsc/daily` 추가:
  - 특정 날짜(기본: 3일 전)의 GSC 데이터를 (page, query, device, country)로 가져와
  - `/healthinfo/` 경로만 필터링해 `gsc_daily_metrics`에 upsert
  - `CRON_SECRET`이 설정돼 있으면 `x-cron-secret`(또는 `?secret=`)으로 보호

## 2) 지금 당장 구현이 “불가능/위험”해서 보류된 것들(추가 데이터 필요)

`newfunc.md`의 핵심은 “왜 샀는지 / 어떻게 사는지”를 답하는 인사이트 엔진인데, 아래 데이터가 없으면 AI가 추측하게 되어 위험합니다.

### 2.1 전환(구매/검사 예약/상담) 데이터

필요한 정보(결정/데이터):
- 전환이 어디에서 발생하는지: `온라인 결제(사이트 내)` vs `상담/전화/카톡 후 오프라인`
- 전환 식별자 설계: 개인정보 없이도 가능한 `order_id/booking_id` 형태(해시/난수)
- 전환 이벤트 정의(검사/영양제 각각 3개 권장)
  - 예: `reservation_start`, `reservation_complete`, `consult_submit`
  - 예: `add_to_cart`, `begin_checkout`, `purchase`
- 전환을 서버에서 기록할지(권장) / GA4로만 볼지
- 전환 이벤트에 붙일 공통 속성(필수)
  - `page_path`, `referrer`, `utm_source/medium/campaign`, `variant(A/B)`, `content_id`(칼럼 id) 등

### 2.2 “칼럼 → 제품/검사” 연결 클릭 이벤트

필요한 정보(결정/데이터):
- 제품/검사 소개 페이지 URL 목록(또는 패턴)
- 칼럼 내 CTA 위치 정의(상단/중단/하단/사이드 등)
- 이벤트 파라미터(최소)
  - `cta_type`(button/banner/text), `cta_position`, `destination_url`, `content_id`

### 2.3 고객 목소리(설문/상담 요약/후기/문의) 데이터

필요한 정보(결정/데이터):
- “구매 직후 1문장 설문” 운영 여부 및 수집 경로(웹 폼/카톡/CRM)
- 설문 문항/선택지 확정(예: 구매 이유, 구매 전 불안)
- 저장 위치(예: Supabase 테이블) + 익명화 정책(PII 금지)

### 2.4 A/B 테스트(실험 실행) 데이터/정책

필요한 정보(결정):
- 실험 실행 방식: `코드에서 직접 분기` vs `외부 도구`
- SEO 안전 가이드 준수 방식(클로킹 방지, canonical/robots 등)
- GA4에 `variant` 속성으로 실험 결과 측정 방식

### 2.5 (선택) GEO: AI 인용 모니터링

필요한 정보(결정/데이터):
- 모니터링 대상 키워드 리스트(핵심 20~50개)
- 어떤 AI/검색 도구를 대상으로 할지(예: Perplexity/ChatGPT 등) + 사용 가능 API 키
- “인용/언급” 판정 기준(도메인 언급, URL 직접 인용, 브랜드 언급 등)

## 3) Supabase 테이블/스키마 관련(적용 필요)

현재 코드는 아래 테이블이 Supabase에 존재한다는 전제로 동작합니다.
- `gsc_daily_metrics` (cron upsert 대상)
- `pagespeed_weekly` (PageSpeed 결과 insert 대상)

필요 스키마는 PRD(`biocom_seo_dashboard_prd.docx`)의 SQL을 기준으로 생성해야 합니다.
편의를 위해 동일 스키마를 `backend/supabase/schema.sql`로 정리해 두었습니다.
스키마가 준비되지 않으면, API는 동작하되 DB 적재는 에러로 fallback 됩니다.
