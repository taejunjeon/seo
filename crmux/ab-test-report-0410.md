# A/B 테스트 개발 결과서

기준일: 2026-04-10

## 1. 구현 범위

### 백엔드 (2개 신규 엔드포인트 + DB 함수)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/crm-local/experiments/repurchase-ab` | POST | 재구매 후보 자동 배정 실험 생성 |
| `/api/crm-local/experiments/:key/ab-summary` | GET | A/B 결과 요약 (발송/전환 상태 포함) |

#### 실험 생성 API 입력
```json
{
  "site": "thecleancoffee",
  "minDays": 30,
  "maxDays": 90,
  "minOrders": 1,
  "variantA": "sms",
  "variantB": "alimtalk",
  "conversionWindowDays": 3
}
```

#### 실험 생성 API 출력
```json
{
  "ok": true,
  "experiment": { "experiment_key": "repurchase-ab-...", "name": "...", "status": "draft", ... },
  "totalCandidates": 997,
  "excludedNoConsent": 698,
  "assigned": { "sms": 155, "alimtalk": 144 }
}
```

### 프론트엔드

CRM 관리 허브 > 더클린커피 > 재구매 관리 탭 안에 **A/B 테스트 섹션** 추가:
- 실험 생성 버튼 (현재 필터 기준 SMS 동의 대상 자동 분할)
- 기존 실험 목록 (탭 버튼으로 전환)
- 그룹별 결과 카드 (배정/발송/구매/전환율/매출/객단가)
- 발송 전 안내 메시지

## 2. 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/crmLocalDb.ts` | `createRepurchaseAbExperiment()`, `getAbSummary()`, `normalizePhone()`, `hashBucket()` 추가 |
| `backend/src/routes/crmLocal.ts` | 2개 신규 라우트 추가, import 확장 |
| `frontend/src/app/crm/page.tsx` | `CoffeeAbTestSection` 컴포넌트 추가 (~180줄) |

## 3. 설계 결정 (Codex 피드백 반영)

| 항목 | 결정 | 근거 |
|------|------|------|
| customer_key | 정규화 전화번호 | Codex: memberCode vs phone 불일치 방지 |
| 동의 필터링 | 배정 전 양군 공통 제외 | Codex: SMS만 사후 제외하면 분모 불균형 |
| 랜덤화 | SHA-256 해시 버킷 (0~9999) | Codex: Fisher-Yates 대신 재현 가능한 stable hash |
| 전환 윈도우 | 3일 (primary) | 사용자 요구사항. 기존 기본값 7일은 secondary |
| 배치 발송 | 미구현 (수동 발송 유지) | Codex: whitelist 제한 + rate limit 미확정 |

## 4. 검증 결과

| 항목 | 결과 |
|------|------|
| 백엔드 typecheck | 통과 |
| 프론트 typecheck | 통과 |
| 백엔드 테스트 78개 | 전체 통과 |
| 실험 생성 API | 997명 후보 중 SMS 동의 299명 → sms 155명 / alimtalk 144명 배정 성공 |
| 결과 요약 API | 그룹별 배정/발송/전환 정상 반환 |

## 5. 실제 테스트 데이터

- 30~90일 미구매 후보: **997명**
- SMS 미동의 제외: **698명** (70%)
- 실험 대상(SMS 동의): **299명**
  - SMS 그룹 (A): **155명**
  - 알림톡 그룹 (B): **144명**

참고: 사용자가 예상한 895명과 차이가 나는 이유는 필터 조건 변동과 SMS 동의 필터 적용 때문이다.

## 6. 운영 흐름

```
1. CRM 허브 > 더클린커피 > 재구매 관리 탭
2. 필터 설정 (30~90일, 1회 이상)
3. A/B 테스트 섹션에서 "A/B 실험 생성" 클릭
4. 알림톡 발송 탭에서 각 그룹 대상 발송 (현재 수동)
5. 3일 후 전환 동기화 실행
6. A/B 테스트 섹션에서 결과 확인
```

## 7. 남은 작업

| 우선순위 | 항목 | 상태 |
|---------|------|------|
| P1 | 배치 발송 API (whitelist 해제 + rate limit 확정 후) | 미구현 |
| P2 | 전환 동기화에 sent_at 기반 윈도우 필터 추가 | 미구현 |
| P2 | A/B 결과에 통계적 유의성(p-value) 표시 | 미구현 |
| P3 | 실험 상태 자동 전이 (draft → active → observing → completed) | 미구현 |
