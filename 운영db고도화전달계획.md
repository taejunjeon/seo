# 운영 DB 고도화 — 개발팀 전달 계획

작성: 2026-04-22 01:15 KST
v2 업데이트: 2026-04-22 (피드백 [`운영db피드백0422.md`](./운영db피드백0422.md) 반영)
성격: 가변형 계획 문서 (개발팀 전달용 압축 블록 포함)
선행 자료:
- [`운영db.md`](./운영db.md) — 2026-04-14 read-only 조사 + P0/P1/P2 요청안 원본
- [`운영db피드백0422.md`](./운영db피드백0422.md) — v1 피드백 (범위 축소 / S4 완료 / 단기 4개)
- [`localdb.md`](./localdb.md) — seo 자체 SQLite 스키마 (참조)
- [`data/!datacheckplan.md`](./data/!datacheckplan.md) — Phase-Sprint 실행 로드맵
- [`frontend/src/app/onboarding/page.tsx`](./frontend/src/app/onboarding/page.tsx) — 운영 DB 반영 메모
- [`GA4/gtm.md`](./GA4/gtm.md) v7, [`GA4/npay_return_missing_20260421.md`](./GA4/npay_return_missing_20260421.md) — 2026-04-20~22 신규 context

---

## 10초 요약 (v2)

- **v1 범위가 너무 넓다는 피드백 수용** — 단기 6개 → **4개**, 중기 6개 → 핵심 2개 + 후속 4개, 장기 L5/L6 신중/약화
- **S4 (1월 초 주문 헤더 백필) 는 이미 seo 로컬에서 완료** (`imweb_orders` 713 rows insert, `imweb_order_items` 804 line items site 보정, 포착률 79.4% → 87.5% → 91.9%). "복구 경로 마련" 을 **완료 기록 + M1 의 근거** 로 전환
- **단기 S1/S2/S3 → 하나로 묶음** — 전부 "sync 실패가 사일런트" 라는 같은 문제. 개발팀에겐 "sync 감사 로그 + 실패 알림" 하나로 전달
- **진실 소스는 여전히 운영 DB**. seo 는 추적/보정/대시보드 레이어. Attribution Ledger 운영 DB 승격 (L5) 은 **장기 검토**, 지금 실행 No-Go
- 이 문서 §6 압축 블록을 그대로 Slack/메일에 복붙하면 됨

---

## 1. v1 → v2 주요 변경

| 구분 | v1 | v2 |
|---|---|---|
| 단기 개수 | 6개 (S1~S6) | **4개로 축약** (아래 §3) |
| S1/S2/S3 | 3개 분리 | **하나로 merge** — "sync 감사 로그 + 실패 알림" |
| S4 1월 초 백필 | 개발팀 단기 요청 | **✅ seo 로컬 완료 → 완료 기록** (v2 §2) |
| S6 NPay return URL | 개발팀 단기 요청 | **TJ/운영팀 수동, 개발팀엔 공유만** |
| M6 coffee 네이버 API | 중기 | **단기 승격** (단기4) |
| L5 Attribution Ledger 승격 | 장기 요청 | **장기 검토, 실행 No-Go** — read-only view/요약 공유 수준 |
| L6 GA4 gap view | 장기 요청 | **장기 참고** — BigQuery A-0 이전 이후 |
| TEAM KETO / tb_laplace / 중복테이블 cleanup | 장기 요청 | **전달 블록 아래로** — seo 병목 아님 |

---

## 2. S4 완료 기록 — 1월 초 주문 헤더 백필

### 2-1. 완료 내용 (2026-04-21)

- 운영 DB `tb_iamweb_users` read-only 접속 + `raw_data.jsonb` 파싱으로 2026-01-01~17 헤더 추출
- seo 로컬 `imweb_orders` 713 rows insert 완료
- `imweb_order_items` 804 line items site 보정
- **공동구매 포착률 79.4% → 87.5%** (+8.1%p)
- 아랑 4차 allowlist 반영 후 **최종 포착률 91.9%**
- 결론: 불은 이미 꺼짐. 운영 DB 는 "다음 화재 예방" 만 해주면 됨 → M1 으로 이어짐

### 2-2. 교훈

- **운영 DB 에 `site_code`, `synced_at` 컬럼이 없어서** jsonb 파싱이 강제됨
- 다음 번 같은 케이스 (API 백필 범위 초과 등) 에 대비해 **M1 컬럼 보강 단기 필요**
- 이 교훈이 단기3 `site_code` 추가 요청의 근거

---

## 3. 단기 요청 — 개발팀 (1~2주, 2026-04-29 까지)

**4개로 압축**. 각 항목은 서로 독립적이므로 개발팀이 병렬 진행 가능.

### 단기1. 🔥 sync 감사 로그 + 실패 알림 (기존 S1/S2/S3 merge)

- **하나의 문제**: sync 실패가 사일런트. 한 달째 `tb_playauto_orders` 멈춘 걸 아무도 몰랐음
- **요청**:
  - 도메인 `sync_naver, sync_playauto, sync_coupang, sync_iamweb, sync_toss` 전부 `tb_operation_log` 에 시작/종료 row 1개씩 기록 — 필드 `domain, action, status, row_delta, started_at, finished_at, error_msg`
  - 실패 시 Slack 또는 메일 알림 (자동)
  - Stuck running job 은 30분 heartbeat 기준으로 failed 처리 (→ `tb_iamweb_backfill_jobs` orphaned 잡도 같이 해결)
  - PlayAuto sync 는 2026-04-17 기준 재개됐으나 **일시적인지 항구적인지** 재확인 필요
- **우선순위**: **최상** (자신감 96%)
- **seo 효과**: `check-source-freshness.ts` 가 운영 DB `tb_operation_log` 를 먼저 보면 됨. seo 가 테이블 last row 시각 inferring 하는 로직 제거 가능

### 단기2. 🔥 가상계좌 pending 기준 통일

- **배경**: seo 는 2026-04-21 GTM v137 publish 로 가상계좌 미입금 GA4 purchase 차단 완료. `/ads` 대시보드도 `payment_status=pending` 제외 원칙
- **요청**: 운영 DB 의 `tb_iamweb_users`, `tb_sales_toss` 가 같은 원칙을 적용 중인지 확인
  - `WAITING_FOR_DEPOSIT / PAYMENT_PREPARATION / PAYMENT_OVERDUE / CANCELLED_BEFORE_DEPOSIT` 계열의 현재 저장값 공유
  - 운영 매출 리포트에서 제외하는 규칙이 있는지 확인. 없으면 추가
- **우선순위**: **최상** (자신감 94%)
- **seo 효과**: `/ads` 대시보드와 운영 DB 매출 리포트 숫자 불일치 방지

### 단기3. `tb_iamweb_users` 컬럼 보강 검토

- **요청**: `site_code` (또는 `brand`), `synced_at`, `created_at`, `updated_at` 추가
- **근거**: §2 에 기록한 1월 초 백필에서 운영 DB `raw_data.jsonb` 파싱이 강제됐음. 같은 문제 재발 방지
- **우선순위**: **높음** (자신감 93%)
- **seo 효과**: 향후 백필/대사가 JSON 파싱 없이 바로 가능

### 단기4. 더클린커피 네이버 커머스 API 자격증명 분리

- **현황** (`datacheckplan` §아직 안 된 것): biocom 자격증명으로 coffee 주문 조회 시 `400 / 101010 / 처리권한이 없는 주문번호`
- **요청**:
  - 더클린커피 판매자 계정에서 신규 앱 생성
  - 운영 DB 에 brand 별 자격증명 저장 (`tb_brand_credentials` 또는 동등)
- **우선순위**: **중상** (자신감 87%)
- **seo 효과**: coffee GA4 NPAY 65건 네이버 주문 원장 대사 자동화 가능

### 별도 공유 (개발팀 요청 아님) — NPay return URL

- **내용**: NPay 결제 완료 후 `biocom.kr/shop_payment_complete` 복귀 안 함. NPay 매출 비중 30일 gross **1.62%**
- **확인 경로**:
  - 아임웹 관리자 → 결제 설정 → 네이버페이 플러그인 → 반환 URL
  - 네이버페이 파트너센터 `admin.pay.naver.com` → 쇼핑몰 설정 → 반환 URL (버튼 키 `84A37DD8-CD5D-4316-8C81-061E335F6E82`)
- **담당**: **TJ/운영팀 수동** (로그인 권한 필요)
- **개발팀에게는**: 확인 결과 공유만

---

## 4. 중기 요청 — 개발팀 (2~4주, 2026-05-13 까지)

**M1/M2 만 진짜 중요**. M3~M6 은 후순위 (개발팀이 여유 있을 때).

### 중기1 (M1). `tb_iamweb_users` 컬럼 보강 완료

- 단기3 에서 요청한 컬럼 보강이 완료되면 이번 단계에서 **기존 데이터 backfill** 진행
- 신규 데이터부터는 자동으로 채워지고, 과거 row 는 nightly 배치로 `raw_data.jsonb` → `site_code` 변환
- **우선순위**: **강력 추천** (자신감 93%)

### 중기2 (M2). `tb_operation_log` 도메인 확장 (단계적)

- **1단계 (단기1 과 함께)**: `sync_*` 도메인만 받기
- **2단계 (중기)**: seo-side 이벤트 수용 — `ga4_mp_refund, meta_capi_refund, meta_capi_purchase_negative, gtm_publish` 요약 1줄
- 처음부터 너무 넓히지 말 것 (피드백 §4 권고)
- **seo 측 implementation**: 2시간. 포맷 초안은 아래 §8 참조
- **우선순위**: **단계적** (자신감 90%)

### 중기3~6 (후순위)

| 항목 | 이유 | 우선도 |
|---|---|---|
| M3 `vw_purchase_conversion_details` (0행) | 사용처 확인 후 수정/삭제 | 중 |
| M4 TEAM KETO 테이블 정책 | 9개월 정지 | 낮 (seo 병목 아님) |
| M5 GA4 property/measurement_id 매핑 | BQ 이전 2026-05-05 전후로 유연 | 중 |
| M6 → 단기4 로 승격됨 | — | — |

---

## 5. 장기 검토 (1~3개월, 2026-07)

### 기존 P2 유지 (운영 DB 정리 차원)

- **L1** tb_sales_* 수동 업로드 자동화 / 누락월 경고 UI
- **L2** 중복/테스트 테이블 cleanup (channeltalk 3중, test_tb_* 5, vw_test_repurchase_* 5)
- **L3** 쿠팡/토스/iamWeb scheduler 통합
- **L4** tb_laplace 한글 컬럼 이관

### ⚠️ L5. Attribution Ledger 운영 DB 승격 — **신중, 지금 실행 No-Go**

- **피드백 §5 수용**: "진실 소스를 어디에 둘 것인가" 의 문제. 섣불리 승격하면 split-brain
- **수정된 표현**:
  > seo attribution ledger 는 당분간 **파생 분석 원장**으로 유지. 운영 DB 에는 **read-only view 또는 요약 테이블**로 공유하는 방식 검토. **원천 결제 상태는 Toss/Imweb/PlayAuto 운영 DB 가 primary**
- **트리거**: 운영팀/revenue 팀이 seo ledger 를 직접 조회하려는 유즈케이스가 나왔을 때만 논의 착수

### 장기 참고 — L6. GA4 (not set)/(direct) 분석용 view

- **피드백 §6 수용**: BigQuery biocom raw 이전 (2026-05-05 예정, A-0 옵션) 이 선행되어야 의미 있음
- **지금은 참고 메모만**. 개발팀 요청 블록에서 제외

---

## 6. 개발팀 전달 복붙 블록 (Slack / 메일) — v2 압축본

```text
[운영 DB 고도화 요청 — 우선순위 축약본 2026-04-22]

목적:
seo 쪽에서 광고 ROAS / GA4 / 공동구매 / 결제상태를 맞추는 과정에서 운영 DB와의 경계가 선명해졌습니다.
원천 주문/매출은 운영 DB를 primary로 유지하고, seo는 추적/보정/대시보드 레이어로 두는 방향입니다.

━━━ 단기 요청 (1~2주) ━━━

1. sync job 감사 로그 + 실패 알림 [최상]
   - 대상: sync_naver, sync_playauto, sync_coupang, sync_iamweb, sync_toss
   - tb_operation_log에 started_at, finished_at, status, row_delta, error_msg 기록
   - 실패 시 Slack 또는 메일 알림
   - stuck running job은 30분 heartbeat 기준 failed 처리
   - 배경: 한 달째 tb_playauto_orders 정지를 아무도 모르고 지냄. 최근 재개됐으나 항구적인지 재확인 필요

2. 가상계좌 pending 기준 확인 [최상]
   - WAITING_FOR_DEPOSIT / PAYMENT_PREPARATION / PAYMENT_OVERDUE / CANCELLED_BEFORE_DEPOSIT 계열
   - 운영 매출 리포트에서 confirmed revenue로 들어가지 않는지 확인
   - seo 기준: pending, confirmed revenue 제외
   - seo 측 GTM v137 publish로 GA4 purchase 쪽 차단은 완료 (2026-04-21)

3. tb_iamweb_users 컬럼 보강 검토 [높음]
   - site_code 또는 brand
   - synced_at, created_at, updated_at
   - 배경: 1월 초 (2026-01-01~17) 주문 헤더 백필을 seo에서 완료했지만,
     운영 DB에 site_code가 없어 raw_data.jsonb 파싱이 강제됐습니다.
     향후 동일 백필이 JSON 파싱 없이 가능하도록 필요합니다.

4. 네이버 커머스 API 자격증명 brand 분리 [중상]
   - biocom 자격증명으로 coffee 주문 조회가 400/101010으로 막힘
   - coffee NPAY 65건 대사를 위해 brand별 naver_app_id / secret 관리 필요

━━━ 중기 요청 (2~4주) ━━━

5. tb_operation_log 도메인 확장 (단계적)
   - 1단계 (단기1과 함께): sync_* 먼저
   - 2단계: ga4_mp_refund, meta_capi_refund, gtm_publish 같은 seo-side 요약 이벤트 수용 검토

6. vw_purchase_conversion_details 0행 뷰 사용처 확인
   - 쓰면 수정, 안 쓰면 drop 후보

━━━ 장기 검토 ━━━

7. attribution ledger는 운영 DB 원천으로 바로 승격하지 않고,
   read-only view 또는 요약 공유 방식으로 검토
   - seo ledger는 파생 분석용, 원천 결제 상태는 Toss/Imweb/PlayAuto 운영 DB primary
8. GA4 not set/direct 분석용 view는 biocom BigQuery raw 이전 후 검토

━━━ 공유 (개발팀 직접 요청 아님) ━━━

A. NPay return URL 설정 — TJ/운영팀이 아임웹 관리자 + 네이버페이 파트너센터에서 확인.
   현재 NPay 결제 완료 후 biocom.kr 복귀 안 함 → GA4 purchase / Meta CAPI 미발사.
   월 NPay gross 약 1.62% (소액 결제 패턴).

━━━ seo 측 자체 유지 (참고) ━━━

- GTM 컨테이너 설정 (vbank guard, prep tag, fallback 변수)
- CAPI / GA4 MP refund dispatcher
- /ads 대시보드, attribution ledger 생성 로직
- 고객 consultation / LTR은 revenue 팀 도메인 그대로

━━━ 영향도 ━━━

- 1번 (sync 로그/알림) 해결 시 ROAS / 코호트 / 매출 리포트 신뢰도 즉시 회복
- 2번 (pending 기준) 해결 시 /ads와 운영 DB 리포트 숫자 일치
- 3번 (컬럼 보강) 해결 시 seo 백필/대사 코드가 훨씬 단순해짐
- 4번 (네이버 API 분리) 해결 시 coffee NPAY 자동 대사 가능

요청자: TJ (biocomkr.sns@gmail.com)
참조 자료: /운영db.md (진단서), /data/!datacheckplan.md (실행), /운영db고도화전달계획.md v2 (본 요청)
```

---

## 7. seo 측 병행 실행 (개발팀 응답 대기 중에도 진행)

### ✅ 이미 완료 (2026-04-21)

- **1월 초 주문 헤더 백필** — `tb_iamweb_users` → `imweb_orders` 713 rows (§2 참조)
- **GTM v137 publish** — 가상계좌 미입금 GA4 purchase 차단. `JS - vbank blocked` + Exception Trigger + [143]/[48]/[154] blockingTrigger
- **GTM v136 publish** — `(not set)` fallback chain 변수 + 3개 purchase 태그 transaction_id

### 이번 주 (~2026-04-29)

- [ ] **GA4 v137 2026-04-22 full-day 재검증** (피드백 §8 1순위) — 04-21 22시간 관측 기준 `transaction_id=(not set)` 97→5, `pay_method=(not set)` 70→0, GA4 매출 과다율 +154%→+17%. 04-22 full-day 로 확정
- [ ] **NPay return URL 확인** (단기3 별도 공유) — TJ 가 admin.imweb + admin.pay.naver.com 스크린샷 공유
- [ ] **M2 선행**: seo refund dispatcher / GTM publish 스크립트에서 `tb_operation_log` 타겟 row 포맷 초안 작성

### 2주 내 (~2026-05-06)

- [ ] **TikTok API → tiktok_ads_daily upsert** 진행 (피드백 §8 2순위. Dry-run CSV 일치 확인됨, 구매값 65원 차이만)
- [ ] **TikTok pending top 20 운명 확인** (피드백 §8 3순위. confirmed 0원 / pending 5.51억 — 예산 판단 핵심)
- [ ] **operational_mirror 스켈레톤 작성** — 먼저 `tb_iamweb_users` 1개 테이블만

### 1개월 내 (~2026-05-22)

- [ ] **biocom BQ 자체 이전 실행** (2026-05-05 예정, [`data/bigquery_migration_plan_20260421.md`](./data/bigquery_migration_plan_20260421.md) 참조)
- [ ] M1 완료 후 seo 의 아임웹 v2 API 직접 폴링 코드를 운영 DB read-only 로 전환

---

## 8. `tb_operation_log` row 포맷 초안 (M2 선행, seo 측 implementation)

개발팀 M2 승인 후 아래 포맷으로 seo 가 insert 할 예정:

```sql
-- 제안 스키마 (기존 tb_operation_log 확장)
ALTER TABLE tb_operation_log
  ADD COLUMN IF NOT EXISTS row_delta INTEGER,
  ADD COLUMN IF NOT EXISTS error_msg TEXT,
  ADD COLUMN IF NOT EXISTS source_system VARCHAR(32) DEFAULT 'revenue';

-- seo 가 insert 할 row 예시
INSERT INTO tb_operation_log (domain, action, status, row_delta, started_at, finished_at, source_system)
VALUES
  ('sync_iamweb',          'run',     'ok',   1247,  '2026-04-22 03:00:00', '2026-04-22 03:02:13', 'revenue'),
  ('ga4_mp_refund',        'dispatch','ok',   23,    '2026-04-22 11:15:00', '2026-04-22 11:15:04', 'seo'),
  ('meta_capi_refund',     'dispatch','ok',   1844,  '2026-04-20 10:56:00', '2026-04-20 11:10:28', 'seo'),
  ('gtm_publish',          'run',     'ok',   6,     '2026-04-21 01:40:03', '2026-04-21 01:40:12', 'seo');
```

`source_system` 컬럼으로 revenue 팀 sync 와 seo-side 이벤트를 쉽게 필터링.

---

## 9. seo 가 계속 자체 유지할 것 (개발팀 요청 대상 아님)

경계 명확화 — 운영 DB 로 흘려보내지 않음:

- **GTM 컨테이너 설정**: `biocom - [데이터 준비] hurdlers_ga4 prep` (tag 251), `JS - Purchase Transaction ID (fallback chain)` (var 250), `JS - vbank blocked` (var 252), `Exception - vbank blocked` (trigger 253)
- **CAPI / Meta Purchase / Refund dispatcher**: seo 자체 실행. 로그 요약 1줄만 M2 로 공유
- **TikTok Purchase Guard / Funnel CAPI**: footer 스크립트
- **`/ads` 대시보드**: seo 전용. 운영 DB read-only 로 데이터만 가져옴
- **고객 consultation / LTR / 코호트**: revenue 팀 고유 도메인

---

## 10. 관련 문서 라이프사이클

| 문서 | 역할 | 갱신 주기 |
|---|---|---|
| `운영db.md` | 2026-04-14 read-only 진단서 + 하이브리드 결론 | 분기 1회 재조사 |
| `운영db피드백0422.md` | v1 피드백 (범위 축소) | 단발성 |
| `localdb.md` | seo 자체 SQLite 스키마 | 새 테이블 추가 시 |
| `data/!datacheckplan.md` | Phase-Sprint 실행 로드맵 | 주 1~2회 |
| `운영db고도화전달계획.md` (이 문서) | **개발팀 전달용 실행 계획**. v2 축약본 | 단기 완료 시 rotate |
| `onboarding page.tsx` | 새 팀원 체크리스트 | 구조 변경 시 |

---

## 11. TJ 결정 필요 (피드백 §8 Q1~Q3)

| Q | 내용 | Claude 권장 |
|---|---|---|
| Q1 | 개발팀에는 압축본? 원문 + 요약? | **§6 압축본만 Slack/메일로 전달. 필요 시 본 문서 링크 첨부** — 피드백 §1 의 "요청이 너무 많아 보임" 문제 해소 |
| Q2 | 단기 요청을 sync 로그/알림, pending 기준, site_code 컬럼 3개로 좁혀도 되나? | **단기4 (네이버 커머스 API brand 분리) 는 추가 권장** — coffee 대사 열쇠. 3개보다는 4개가 낫지만, 3개로 축소해도 OK |
| Q3 | TikTok API → tiktok_ads_daily upsert 승인? | **Go 찬성** (자신감 88%). Dry-run CSV 일치 확인됨 (비용/클릭/구매수 동일, 구매값 65원 차이만). 승인 시 Claude 가 `backend/scripts/tiktok-ads-daily-upsert.ts` 작성 가능 |

---

## 12. 버전 기록

- **v2** (2026-04-22 01:50 KST): 피드백 [`운영db피드백0422.md`](./운영db피드백0422.md) 수용. 6가지 핵심 변경 (S4 완료 처리 / S1·S2·S3 merge → 단기1 / 단기 4개로 축약 / M6 → 단기4 승격 / L5 "실행 No-Go, 장기 검토" / L6 장기 참고). §6 압축 전달 블록 전면 교체. §7 에 "이미 완료" 섹션 추가. §8 M2 세부 스키마 초안. §11 TJ Q1~Q3 답변 정리.
- **v1** (2026-04-22 01:15 KST): 최초 작성. 2026-04-14 `운영db.md` P0/P1/P2 유지 + 2주간 신규 context 5건 통합. 단기 6개 / 중기 6개 / 장기 6개.
