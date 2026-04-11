# A/B 테스트 기능 계획서

기준일: 2026-04-10

## 1. 실험 목표

30~90일 미구매 고객 895명을 대상으로, **SMS vs 카카오 알림톡** 채널별 재구매 전환율을 비교한다.

| 항목 | 값 |
|------|-----|
| 대상 | 더클린커피 30~90일 미구매 고객 |
| 모집단 규모 | ~895명 (필터 조건에 따라 변동) |
| 그룹 분할 | A그룹 ~448명 (SMS), B그룹 ~447명 (알림톡) |
| 무작위 배정 | customer_key 기반 해시 → 버킷 |
| 전환 윈도우 | 발송 후 3일 |
| 핵심 지표 | 구매 전환율 (구매 인원 / 발송 인원) |
| 보조 지표 | 구매 매출, 객단가, 전환 소요 시간 |

## 2. 기존 인프라 활용

### 이미 있는 것
- `crm_experiments` 테이블 — 실험 정의 (key, name, status, variant_weights, conversion_window_days)
- `crm_assignment_log` 테이블 — 고객별 그룹 배정 기록
- `crm_conversion_log` 테이블 — 구매 전환 기록
- `crm_message_log` 테이블 — 발송 기록
- 실험 CRUD API (`/api/crm-local/experiments/*`)
- 전환 자동 동기화 API (`POST /api/crm-local/experiments/:key/sync-conversions`)
- 재구매 후보 조회 API (`GET /api/crm-local/repurchase-candidates`)
- 알림톡/SMS 단건 발송 API (Aligo)

### 새로 만들어야 하는 것

#### 백엔드
1. **`POST /api/crm-local/experiments/repurchase-ab`** — 재구매 후보를 자동으로 가져와 실험 생성 + 랜덤 그룹 배정
   - 입력: site, minDays, maxDays, minOrders, variantA(channel), variantB(channel), conversionWindowDays
   - 처리: 후보 조회 → 셔플 → 50:50 분할 → crm_experiments INSERT → crm_assignment_log 배치 INSERT
   - 출력: experiment_key, 그룹별 인원 수, 동의/미동의 비율

2. **`POST /api/crm-local/experiments/:key/batch-send`** — 실험 그룹 대상 배치 발송
   - 입력: experiment_key, variant_key, templateCode (알림톡용), message (SMS용)
   - 처리: assignment_log에서 해당 variant 고객 목록 조회 → 순차 발송 → message_log 기록
   - 안전장치: dryRun 모드 (발송 없이 대상 목록만 반환), 발송 간격 throttle
   - 출력: 발송 성공/실패 건수, 실패 목록

3. **`GET /api/crm-local/experiments/:key/ab-summary`** — A/B 결과 요약 (기존 results에 채널별 발송 상태 추가)
   - 그룹별: 배정 인원, 발송 성공, 구매 전환, 전환율, 매출

#### 프론트엔드
4. **CRM 허브에 "A/B 테스트" 탭 또는 섹션 추가** (더클린커피 탭 안)
   - 실험 생성 폼: 필터 조건 선택 → 미리보기 → 생성
   - 실험 상태 카드: 배정 완료 / 발송 대기 / 발송 중 / 관측 중 / 완료
   - 그룹별 발송 버튼 (dryRun 미리보기 → 확인 → 실발송)
   - 결과 대시보드: 전환율 비교, 매출 비교, 통계적 유의성 표시

## 3. 데이터 흐름

```
1. 실험 생성
   재구매 후보 조회 (30-90일, 1회 이상)
   → Fisher-Yates 셔플
   → 50:50 분할 (A=SMS, B=알림톡)
   → crm_experiments INSERT
   → crm_assignment_log 배치 INSERT

2. 발송 실행
   A그룹 → POST /api/aligo/sms (순차, throttle)
   B그룹 → POST /api/aligo/send (알림톡, 순차, throttle)
   → crm_message_log INSERT (각 건)

3. 전환 추적 (발송 후 3일 시점)
   POST /api/crm-local/experiments/:key/sync-conversions
   → imweb_orders에서 배정 고객의 발송 후 구매 조회
   → crm_conversion_log INSERT

4. 결과 조회
   GET /api/crm-local/experiments/:key/ab-summary
   → 그룹별 전환율, 매출, 유의성 반환
```

## 4. 안전장치

- 배치 발송 전 반드시 `dryRun=true`로 대상 확인
- 발송 간격: 건당 200ms throttle (Aligo rate limit 대응)
- SMS 동의 미확인 고객 자동 제외 (opt-in only)
- 이미 발송된 그룹은 중복 발송 방지
- 실험 상태가 `active`일 때만 발송 허용

## 5. 구현 순서

1. 백엔드: 실험 생성 + 자동 배정 API
2. 백엔드: 배치 발송 API (dryRun 포함)
3. 백엔드: A/B 결과 요약 API
4. 프론트: A/B 테스트 섹션 UI
5. 통합 테스트
6. 개발 결과서 작성

## 6. 파일 변경 예상

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/crmLocalDb.ts` | 재구매 후보 → 실험 배정 함수 추가 |
| `backend/src/routes/crmLocal.ts` | 3개 신규 엔드포인트 |
| `frontend/src/app/crm/page.tsx` | A/B 테스트 섹션 UI 추가 |
| `crmux/ab-test-plan-0410.md` | 이 문서 |
| `crmux/ab-test-report-0410.md` | 개발 결과서 |
