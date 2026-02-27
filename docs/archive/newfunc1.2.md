# newfunc 1.2 — 기능 추가 계획(구현 없음, 상세 플랜)

작성일: 2026-02-12  
기준: `newfunc.md`, `biocom_seo_dashboard_prd.docx`  
목표: “GSC 중심 대시보드” → “구매(검사/영양제)까지 연결 + 가설→실험 제안 자동화”로 확장

---

## 0) 최상위 원칙(안전/정확도)

1. **AI는 집계 데이터만** 사용(개인 단위 로그/PII 직접 투입 금지)
2. 모든 AI 출력은 **근거 숫자/표를 함께** 노출(추정이면 추정이라고 명시)
3. 건강/의료(YMYL) 특성상 **과장/단정 표현 필터**를 시스템 레벨에서 강제
4. 측정(데이터 수집) → 저장(누적) → 분석(표준 리포트) → AI(문장화/가설) 순으로 단계 진행

---

## 1) 데이터 확정 단계(가장 먼저)

### 1.1 “핵심 이벤트(Key events)” 정의(검사/영양제 각 3개)

결정 산출물
- 이벤트 목록(이름, 트리거 조건, 필수 파라미터)
- 성공 KPI(Primary) / 안전 KPI(Secondary)

권장 후보
- 검사(예약/상담)
  - `reservation_start`
  - `reservation_complete`
  - `consult_submit` (카톡/전화/문의 제출)
- 영양제(커머스)
  - `add_to_cart`
  - `begin_checkout`
  - `purchase`

### 1.2 “칼럼 → 제품/검사” 연결 정의

결정 산출물
- 제품/검사 목적지 URL 패턴(또는 목록)
- CTA 위치/유형 표준화

필수 이벤트(권장)
- `content_to_product_click`
  - `content_id`(또는 page_path)
  - `cta_position`(top/mid/bottom/side 등)
  - `cta_type`(button/banner/text)
  - `destination_url`

### 1.3 구매 방식(온라인 vs 상담/오프라인) 결정

결정 산출물
- 전환이 GA4 e-commerce로 끝나는지 여부
- 상담 후 결제/예약이 많다면 “서버 전환 기록” 설계(PII 없이)

---

## 2) 데이터 저장/파이프라인(매일/매주 자동 적재)

### 2.1 Supabase 스키마 확정 및 생성(PRD 기반)

PRD 기반 3개 테이블(최소)
- `gsc_daily_metrics` (일별 검색 성과)
- `pagespeed_weekly` (주간 성능)
- `ga4_daily_engagement` (일별 행동)

추가 테이블(신규 기능을 위해 필요)
- `conversion_events`
  - `occurred_at`, `event_name`, `page_path`, `content_id`, `source_medium`, `utm_*`, `value`(선택), `variant`(선택)
- `content_catalog`
  - `content_id`, `page_url`, `title`, `category`, `author`, `published_at`, `updated_at`
- `customer_voice`
  - `occurred_at`, `channel`(web/kakao/phone/review), `reason_code`, `fear_code`, `free_text`(옵션), `content_id`(옵션)
- `experiments`
  - `experiment_id`, `name`, `start_at`, `end_at`, `variants`, `target_pages`, `primary_metric`
- `insight_cards`
  - `generated_at`, `scope`(site/page/query), `type`, `severity`, `evidence_json`, `hypotheses_json`, `recommendations_json`, `status`(open/doing/done)

### 2.2 Cron/스케줄러(자동 수집)

구현 방식 선택
- 로컬/단일 서버: node-cron
- 배포(Vercel): Vercel Cron + 보호 토큰
- Supabase: Edge Function + pg_cron

일정(권장, PRD 준수)
- 매일 06:00 KST: GSC(2~3일 전 데이터)
- 매일 07:00 KST: GA4(전일 데이터)
- 매주 월 03:00 KST: PageSpeed(핵심 페이지 10~50개, mobile+desktop)

필수 기능
- 중복 방지 upsert 키 설계
- 청크 삽입/재시도(쿼터/네트워크 고려)
- 실패 알림(슬랙/로그)

---

## 3) 분석층(“왜/어떻게 사는지”를 숫자로 쪼개기)

### 3.1 표준 리포트 5개(고정 템플릿)

1) 유입 의도(검색어) → 전환 기여
- 검색어를 intent 그룹으로 묶고(증상/방법/비교/가격 등)
- intent 그룹별 `content_to_product_click`/전환율 비교

2) 칼럼별 “구매 여정” 기여도
- 칼럼별
  - 검색 유입(클릭/노출/CTR/순위)
  - 행동(체류/이탈/스크롤/세션)
  - 제품/검사 이동률
  - 전환율(가능할 때)

3) 선행지표(구매 직전 행동) 탐색
- 구매자 vs 비구매자 비교(가능하면)
- 차이가 큰 행동을 “선행지표 후보”로 채택

4) 기술 성능 저하가 전환에 미치는 영향
- 느린 페이지의 이탈/전환 비교
- “PageSpeed 악화 → 전환 악화” 후보 탐지

5) 재방문/비교형 구매 패턴
- 7일 내 재방문 비중
- 반복 방문 후 전환 비중

### 3.2 스코어카드(실데이터 기반)

PRD 가중치 유지 권장
- 검색 성과 40% (GSC)
- 기술 성능 20% (PageSpeed)
- 사용자 체류 25% (GA4)
- AEO/GEO 15% (Q&A/Featured Snippet/AI 인용)

실데이터가 없는 항목은 “0점 + 측정 필요”로 표시(가짜 점수 금지).

---

## 4) AI 인사이트 엔진(가설→실험 제안 자동 생성)

### 4.1 입력 데이터(LLM에 주는 형태)

원칙
- 개인 로그 금지, “집계 표”만 전달
- 표는 항상 날짜/범위/필터 조건 포함

권장 입력 묶음
- 변동 감지: 전주 대비 하락/급상승 페이지/키워드 Top N
- 근거 표: clicks/impressions/ctr/position + GA4 engagement + PageSpeed
- 전환/선행지표: CTA 클릭률, key event rate(가능할 때)

### 4.2 인사이트 카드 스펙(출력)

카드 필드(권장)
- 제목: “무슨 일이 벌어졌나”
- 근거: 숫자 3~6개(전주 대비 포함)
- 가능한 원인(가설) 3개(각각 근거 연결)
- 실험 제안 1~2개
  - 변경점(딱 1개), 대상, 성공 기준(Primary), 안전 지표(Secondary)
- 우선순위: 영향×난이도(ICE 또는 RICE)

### 4.3 안전장치(필수)

- 금지 표현 필터(의학 효능 단정/과장)
- “추정/가설” 라벨 강제
- 샘플 수/통계적 불확실성 경고(데이터 부족 시)

---

## 5) UI/제품 기능 확장(대시보드 관점)

### 5.1 탭/페이지 확장 제안

1) 오버뷰(강화)
- 인사이트 카드(실데이터 기반) + 알림 히스토리
- “오늘 해야 할 일” Top 5(우선순위 순)

2) 칼럼 분석(강화)
- 드릴다운: 해당 칼럼의
  - 상위 키워드
  - intent 분포
  - CTA 클릭 퍼널
  - PageSpeed 히스토리(주간)

3) 키워드 분석(강화)
- Q&A 분류 + Featured Snippet 노출 추적
- “노출↑ CTR↓” 개선 큐(메타/타이틀 실험 제안)

4) 전환/퍼널(신규)
- Organic → Content → Product/Reservation → Key events
- 검사/영양제 퍼널 분리

5) 실험(A/B)(신규)
- 실험 생성/상태/결과
- variant별 주요 지표 비교

6) 고객 목소리(신규)
- 구매 이유/불안 요인 요약
- 콘텐츠별 VOC 연결(가능할 때)

### 5.2 “구현 전” 체크리스트(필수)

- 이벤트가 실제로 들어오는지(GA4 DebugView/서버 로그)
- 데이터 누락/중복 없는지(DB unique key/업서트)
- 데이터 지연(GSC 2~3일) 표기
- 권한/키 누락 시 graceful fallback(지금 방식 유지)

---

## 6) 운영/배포(필수지만 후순위로 분리)

- 비밀키 관리: `.env` 커밋 금지 유지
- 크론 엔드포인트 보호: `CRON_SECRET` 필수
- 레이트리밋/캐싱: GSC/GA4/PSI 쿼터 보호
- 모니터링: 실패 알림(슬랙), 에러 로깅

---

## 7) 권장 구현 순서(현실적인 우선순위)

1. Key events 확정 + CTA 클릭 이벤트 심기(측정 기반 만들기)
2. Supabase 스키마 생성 + Cron 적재(일/주 자동 수집)
3. “표준 리포트 5개” 고정(숫자 기반 의사결정)
4. 스코어카드 전 항목 실데이터화(0점 영역 제거)
5. 변동 감지 룰(알림) → 인사이트 카드 자동 생성(룰 + LLM)
6. 실험 실행 방식 결정 및 A/B 운영 UI 추가
7. 고객 목소리(VOC) 결합(“왜”의 마지막 퍼즐)

