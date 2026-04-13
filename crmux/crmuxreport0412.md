# CRM 관리 허브 종합 보고서

기준일: 2026-04-12 (최종 갱신 2026-04-12 · P0~P2 전체 완료 + 예약 발송 · 엑셀 업로드 신규 구현)

## 0. 기능 개발 현황 & Phase 계획 요약

### 0-1. 기능 개발 현황

| 영역 | 완성도 | 상태 요약 |
|------|------|-----------|
| 자동 UI 동선 검증 프레임워크 | **100%** | Phase A 완료. 26/26 테스트 통과 · 5축: Playwright + axe + pixelmatch + ajv + sqlite invariant |
| 고객 데이터 조회 (목록·검색·CSV) | **95%** | `CustomersTab.tsx` 분리 + 등급 필터 + CSV |
| 세그먼트 빌더 (커스텀 조건) | **95%** | Phase E 완료 (2026-04-13). 8개 필드 · AND 조합 · SQL 안전장치 · 미리보기 → 저장 → 그룹 실체화 흐름 |
| 그룹 관리 (CRUD·엑셀·임시 그룹 분리) | **98%** | 드래그&드롭 + group_kind 분리 + canArchiveGroup 가드. 운영 cleanup cron 가동 |
| 단건 발송 (알림톡·SMS·미리보기) | **95%** | contact-policy 서버 강제 (hard_legal·hard_policy·soft 3단계) |
| 배치 발송 (그룹 기반 + 예약) | **95%** | 즉시 + 예약 모두 동작. 스케줄러 1분 폴링 + stuck-running 복구 |
| 예약 발송 (Scheduled Send) | **95%** | 테이블·스케줄러·REST API·프론트 UI + 정책 검사 + multi-error |
| A/B 테스트 + 실험 배정 | **90%** | 전환 추적 윈도우 필터 연동 완료 |
| 캠페인 성과 퍼널 | **95%** | 4단계(발송→성공→방문→구매) 완성 |
| 발송 로그 정규화 | **100%** | 로그 키 통일 + 실험 키 저장 + 전환 윈도우 필터 |
| 결제 추적 (CAPI·Toss 대조) | **95%** | VM CAPI + Attribution — 안정 운영 |
| 코드 품질 (컴포넌트 분리) | **95%** | `page.tsx` 3,410 → **1,238줄** (−64%). Consultation·Attribution 섹션 추출 + ErrorBoundary |
| 동의 감사 로그 (법적 증빙) | **95%** | 테이블·API·UI + 수동 변경 API(`admin_manual`) + 프론트 수동 변경 폼 |

**종합 판정**: MVP **99%** (이전 98% → +1). 2026-04-13 후속 세션에서 Phase E(세그먼트 빌더) 완료 + 지민 페르소나 Quick Wins 8건 반영 + 하오체 전수 정리. 잔여 1% = Phase F(A/B 통계)·G(반복 예약)·H(고객 드로어)·J(운영 하드닝)·I(최종 검증).

### 0-2. Phase 계획 요약표

| Phase | 항목 | 상태 | 근거 파일 / 커밋 |
|------|------|------|------------------|
| **P0** | 발송 로그에 `experimentKey` 저장 | ✅ 완료 | `backend/src/routes/aligo.ts:216,301`, `frontend/.../MessagingTab.tsx:276` |
| **P0** | `customer_key` 통일 (memberCode → 전화번호) | ✅ 완료 | `aligo.ts:218` `customer_key: normalizedReceiver` |
| **P0** | 전환 추적 윈도우 필터 (`sent_at ~ sent_at+window`) | ✅ 완료 | `backend/src/routes/crmLocal.ts` sync-conversions 내 `firstSentAtByPhone` 맵 + JS 필터 (Codex, 2026-04-12) |
| **P1** | 재구매 탭 "N명 발송" → 그룹 발송 연결 | ✅ 완료 | `CoffeeRepurchaseTab.tsx:61-120` `createGroupAndGoMessaging` — 4개 버튼 전부 임시 그룹 생성 후 `groupId` 전달 |
| **P1** | followup/experiment dead-end 제거 | ✅ 완료 | `MessagingTab.tsx:766-820` — groupId/experimentKey 유무에 따라 그룹 정보 카드 or 탭 이동 CTA |
| **P1** | 주문 탭 에러 상태 처리 | ✅ 완료 | `CoffeeOrdersTab.tsx:15,59-63` |
| **P1** | 캠페인 성과 퍼널 | ✅ 완료 (4단계) | 아래 P2 `visited` 항목 참고 |
| **P2** | 컴포넌트 분리 | ✅ 완료 | 8개 신규 .tsx (섹션 9-2) |
| **P2** | 퍼널 `visited` 단계 (attribution_ledger) | ✅ 완료 | `backend/src/crmLocalDb.ts` `getExperimentFunnel()` + `visit_rate` (Codex) · `frontend/.../CoffeeAbTestSection.tsx:238-310` 4단계 퍼널 + variant 방문 컬럼 |
| **P2** | 동의/수신거부 감사 로그 | ✅ 완료 | `backend/src/crmLocalDb.ts:950-` `crm_consent_change_log` 테이블 + `recordConsentChange`/`listConsentChanges` + `GET /api/crm-local/consent-audit` · `frontend/.../ConsentAuditTab.tsx` 신규 탭 |
| **P2** | 예약 발송 (Scheduled Send) | ✅ 완료 | `crmLocalDb.ts` `crm_scheduled_send` 테이블 + 6개 헬퍼 · `routes/crmLocal.ts:1229-1317` POST/GET/GET:id/DELETE 4개 라우트 · `startBackgroundJobs.ts:130-235` 1분 폴링 + stuck-running 복구 · `MessagingTab.tsx` 예약 UI · `CustomerGroupsTab.tsx` 예약 목록 + 취소 |
| **P2** | 엑셀 업로드 (그룹 멤버) | ✅ 완료 | `routes/crmLocal.ts:1370-1462` multer + xlsx 파싱 + 헤더 자동 감지 + 전화번호 정규화 + 5MB/10,000행 제한 · `CustomerGroupsTab.tsx` 드래그&드롭 + 결과 요약 |

**요약**: P0 3/3, P1 4/4, P2 6/6. **완료 비율 13/13 (100%)**. 이번 사이클에서 원래 계획된 P0~P2 전체 소화 완료.

---

## 0-2a. 예약 발송 · 엑셀 업로드 비판적 검증 결과 (2026-04-12)

두 신규 기능에 대해 엣지 케이스 curl 검증을 돌린 결과를 있는 그대로 남김.

### 예약 발송 (Scheduled Send) 검증 매트릭스

| # | 시나리오 | 입력 | 기대 | 실제 응답 | 결과 |
|---|---|---|---|---|---|
| 1 | 그룹 없음 | `groupId: "nonexistent"` | 404 | `{ok:false,error:"그룹을 찾을 수 없다"}` | ✅ |
| 2 | `groupId` 누락 | body에 groupId 없음 | 400 | `{ok:false,error:"groupId 필요"}` | ✅ |
| 3 | 잘못된 channel | `channel:"email"` | 400 | `{ok:false,error:"channel은 alimtalk 또는 sms여야 한다"}` | ✅ |
| 4 | 과거 시각 | `scheduledAt:"2020-01-01"` | 400 | `{ok:false,error:"scheduledAt은 현재 시각보다 60초 이상 과거일 수 없다"}` | ✅ |
| 5 | 날짜 파싱 실패 | `scheduledAt:"not-a-date"` | 400 | `{ok:false,error:"scheduledAt은 ISO8601 형식이어야 한다"}` | ✅ |
| 6 | 알림톡 템플릿 누락 | `channel:"alimtalk"` + templateCode 없음 | 400 | `{ok:false,error:"알림톡 예약은 templateCode와 subject가 필요하다"}` | ✅ |
| 7 | 정상 등록 | 1시간 후 + SMS + testMode | 200 | `{ok:true,id:1,scheduledAt:"2026-04-12T15:48..."}` | ✅ |
| 8 | 정상 목록 조회 | `GET /scheduled-sends?limit=5` | pending 행 반환 | `status:"pending"`, `total_count:0` | ✅ |
| 9 | 취소 (pending) | `DELETE /scheduled-sends/1` | 200 + status=canceled | `status:"canceled"` | ✅ |
| 10 | 이미 취소된 것 재취소 | 같은 id DELETE | 409 | `{ok:false,error:"pending 상태에서만 취소할 수 있다"}` | ✅ |

### 엑셀 업로드 검증 매트릭스

테스트 CSV (의도적으로 엣지 케이스 5개 포함):
```
전화번호,이름,고객번호,SMS동의
010-1234-5678,홍길동,M001,Y
010-9876-5432,김민수,M002,N
잘못된번호,에러케이스,M003,
010-1234-5678,중복번호,M004,Y     ← 첫 번호와 중복
+82 10 5555 6666,정규화확인,M005,동의  ← 국제 포맷 + 한글 동의
```

| # | 관찰 | 기대 | 실제 | 결과 |
|---|---|---|---|---|
| 1 | `total_rows` | 5 | 5 | ✅ |
| 2 | `added` | 3 (중복·무효 제외) | 3 | ✅ |
| 3 | `skipped_duplicate` | 1 | 1 | ✅ |
| 4 | `skipped_invalid_phone` | 1 | 1 | ✅ |
| 5 | 오류 리포트 | row 4 무효 번호 | `{row_index:4,reason:"유효하지 않은 전화번호"}` | ✅ |
| 6 | `+82 10 5555 6666` 정규화 | `01055556666` | DB에 `01055556666` 저장 | ✅ |
| 7 | `동의` → bool | `true` | `consent_sms:true` | ✅ |
| 8 | `N` → bool | `false` | `consent_sms:false` | ✅ |
| 9 | 지원 안 하는 파일 | `.txt` 업로드 | `{ok:false,error:"지원하지 않는 파일 형식..."}` | ✅ |
| 10 | 전화번호 열 없음 | `이름,이메일` 헤더만 | `{ok:false,error:"전화번호 열을 찾을 수 없다"}` | ✅ |
| 11 | 그룹 존재 안 함 | `groupId:"nonexistent"` | `{ok:false,error:"그룹을 찾을 수 없다"}` | ✅ |

### 발견한 이슈·한계

1. **전화번호 유효성 체크 범위**: 백엔드는 정규화 후 `01`로 시작하고 10~11자리인지만 확인. `01099999999` 같은 확실히 존재하지 않는 번호도 통과. 실제 통신사 번호부 대조는 없음 — 알리고 발송 실패로만 드러남.
2. **엑셀 업로드 `consent_sms` 저장 경로**: Codex가 `addGroupMembers` 시그니처를 확장했는데, 기존 사용처(그룹 직접 생성, 재구매 탭 자동 그룹 생성)는 `consent_sms`를 넘기지 않음. DB 기본값은 `false`가 되므로 "동의 미지정 = 미동의"로 처리됨. 엑셀 업로드 경로에서만 consent를 실제로 저장하는 상태. 일관성 회복을 위해 다른 경로도 채우는 게 바람직하나 P2 범위 밖.
3. **스케줄러 실행 증명 (real trace)**: 90초 후 예약 1건을 등록하고 테스트 그룹(3명) 대상으로 폴링을 기다렸소. 결과:
   - `scheduled_at: 14:51:00` / `started_at: 14:51:29` / `finished_at: 14:51:30` — 폴링 지연 29초(60초 주기 기준 정상 범위), 처리 1초
   - `status: "pending" → "running" → "success"` 전이 확인
   - `total_count: 3, success_count: 3, fail_count: 0`
   - `crm_message_log`에 id 6·7·8 신규 행. `response_payload`에 알리고 msg_id `1315417311/7311/7317` 기록
   - testMode=Y로 돌렸기 때문에 실제 문자는 나가지 않음. 운영 배포 전 testMode=N 1건 실 시간대 확인 필요.
4. **validation 순서**: 그룹 존재 → channel → message → scheduledAt → alimtalk 필수 필드. 과거 시각을 잘못된 groupId로 보내면 "그룹을 찾을 수 없다"가 먼저 떠서 과거 시각 오류는 감춰짐. 사용자 경험상 큰 문제 아니나 UI가 여러 오류를 동시에 보여주려면 서버에서 errors 배열을 리턴하도록 바꾸는 게 이상적.
5. **엑셀 업로드 `errors` 배열 상한**: Codex는 스펙대로 100건 cap을 걸었으나 "+N건 더" 메시지는 응답에 포함 안 됨. 프론트에서 `errors.length === 100`을 특수 케이스로 처리하면 UX 개선.
6. **재구매 탭 임시 그룹 누적 (섹션 0-4)**: 예약 발송이 추가되면서 "예약 등록 후 그룹이 계속 살아 있어야 한다"는 요건이 생김. 섹션 0-4의 3단계(자동 아카이브)는 `archived_at` 있는 임시 그룹도 예약 발송이 참조 중이면 삭제하면 안 됨. 계획 수정 필요.

### 결론

5건의 sanity test + 11건의 엑셀 엣지 케이스 전부 통과. 스키마·입력 검증·정규화·중복 처리·오류 리포팅 모두 설계대로 동작. 한계는 전부 "더 엄격하게 만들 수 있다" 범주이고 기능 차단 수준의 버그는 발견되지 않음.

---

## 0-3. 100% 완성 Phase 계획 (개발 순서대로)

### 0-3-A. 참조 스크린샷

이 계획 수립 시점에 캡처한 전체 CRM 탭 스크린샷은 `crmux/0412/` 디렉터리에 있소. Playwright headless로 자동 생성한 1440×full-page PNG 11장:

| # | 파일 | 화면 |
|---|------|------|
| 01 | [01_coffee_orders.png](./0412/01_coffee_orders.png) | 더클린커피 구매 현황 |
| 02 | [02_coffee_repurchase.png](./0412/02_coffee_repurchase.png) | 재구매 관리 (후보·A/B·가설) |
| 03 | [03_coffee_groups.png](./0412/03_coffee_groups.png) | 고객 그룹 (+ 엑셀 업로드 + 예약 발송) |
| 04 | [04_coffee_customers.png](./0412/04_coffee_customers.png) | 고객 목록 |
| 05 | [05_coffee_behavior.png](./0412/05_coffee_behavior.png) | 고객 행동 세그먼트 |
| 06 | [06_coffee_messaging.png](./0412/06_coffee_messaging.png) | 알림톡 발송 + 예약 UI |
| 07 | [07_coffee_attribution.png](./0412/07_coffee_attribution.png) | 결제 추적 |
| 08 | [08_coffee_consent_audit.png](./0412/08_coffee_consent_audit.png) | 동의 감사 로그 |
| 09 | [09_all_comparison.png](./0412/09_all_comparison.png) | 전체 사이트 비교 |
| 10 | [10_biocom_consultation.png](./0412/10_biocom_consultation.png) | 바이오컴 상담 후속 |
| 11 | [11_aibio_ads.png](./0412/11_aibio_ads.png) | AIBIO 광고 성과 |

캡처 스크립트: `frontend/tests/crm-screenshots.spec.ts`. 재생성하려면 `cd frontend && npx playwright test tests/crm-screenshots.spec.ts`.

### 0-3-0. 현재 gap 분석 (0-1 현황표 96 → 100% + 운영 하드닝)

이 문서의 "100%"는 단순히 0-1 기능 행만 채우는 게 아니라 **운영 수준 CRM으로 배포 가능한 상태**를 의미함. 그래서 gap에는 보이는 기능 잔여분뿐 아니라 인증·개인정보·관측성 같은 운영 하드닝도 포함됨. (Codex 리뷰에서 BLOCKER로 지적받음 — 0-3-Z 참조)

**A. 기능 완성도 gap (0-1 현황표 잔여 %)**

| 영역 | 현재 | 남은 | 잔여 작업 |
|------|------|------|----------|
| 고객 데이터 조회 | 95% | 5% | 고객 상세 드로어 |
| 세그먼트/타겟팅 | 80% | 20% | 커스텀 조건 빌더 + 저장 세그먼트 |
| 그룹 관리 | 95% | 5% | 임시 그룹 정리 + consent 저장 일관성 |
| 단건 발송 | 90% | 10% | render-preview 완전 일치 + 서버 contact-policy 강제 |
| 배치 발송 (+예약) | 95% | 5% | 스케줄러 stuck-running 알림 + SSE 진행률 |
| 예약 발송 | 90% | 10% | 반복 예약 + 야간 차단 + 실시간대 testMode=N |
| A/B 테스트 | 90% | 10% | 통계적 유의성 + 변종 3+개 + 조기 종료 |
| 캠페인 성과 퍼널 | 95% | 5% | 방문 이벤트 스키마 안정화 |
| 코드 품질 (분리) | 85% | 15% | 상담·결제추적 인라인 추출 + 에러 바운더리 |
| 동의 감사 로그 | 85% | 15% | 신규 회원 `(initial)` 실검증 + 수동 변경 UI |

**B. 운영 하드닝 gap (Codex 지적 — BLOCKER 포함)**

| 항목 | 현재 | 필수 이유 |
|------|------|----------|
| 관측성 (structured logs + metrics + traces) | 0% | Phase A 자동 검증의 실패 디버깅이 로그 기반. 이 없으면 검증 실패 원인 추적 불가 |
| 인증/RBAC | 0% | 발송·감사·세그먼트 엔드포인트에 권한 구분 없음. 누구나 curl로 실제 SMS 쏠 수 있음 |
| Rate limiting | 0% | 엑셀 업로드·세그먼트 evaluate·스케줄 polling API에 레이트 제한 없음 |
| PII 보존/삭제 정책 | 0% | `crm_consent_change_log`·`crm_message_log`에 전화번호 영구 저장. 개인정보보호법상 보존 기간과 자동 삭제 정책 필요 |
| Backup / restore | 0% | sqlite `better-sqlite3` 단일 파일 기반. 스냅샷·복구 흐름 없음 |
| 접근성 (WCAG AA) | 0% | 현재 inline style 기반 위젯들에 `aria-*`·키보드 포커스·대비 미검증. 내부 도구라 후순위지만 100% 정의에 포함 |

**내부 1인 운영 vs 외부 제품** 기준 판단:
- **현재 운영**: 내부 운영자 1~2명이 localhost에서 씀. 인증은 네트워크 격리로 대체, RBAC·rate-limit·WCAG는 실운영 이전에는 엄밀히 필수 아님.
- **배포 시나리오에 따라**: Supabase/VM에 배포 + 외부 접근 가능해지면 J 단계가 전부 P0. 이 계획은 배포까지 포함한 **100%**를 목표로 구성.

### 0-3-1. 구성 원칙 (Codex 피드백 반영)

1. **의존성 & 리스크 먼저**: A(검증 프레임워크) → C(정합성·감사·정책) → D(그룹 보호) → B(코드 분리) 순. **B가 C 앞이면 데이터 리스크가 먼저 해결 안 된 상태로 큰 리팩터를 하게 되어 위험 → B를 C·D 뒤로 옮김 (Codex BLOCKER)**.
2. **E는 C 뒤**: 세그먼트 빌더 DSL이 consent 조건을 다루므로 consent 저장 일관성(C-4)이 선행. 안 그러면 빌더가 "consent=Y" 조건으로 조회해도 DB가 false로 채워져 결과가 잘못됨 (Codex MAJOR).
3. **G는 D 뒤**: 반복 예약이 그룹 참조 수명을 복잡하게 만듬. archived_at 보호(D)가 반복 예약(G) 이전에 세워져야 함 (Codex BLOCKER).
4. **invariant 테스트를 do-not-skip**: 발송 가능 여부·contact-policy·archived_at 참조 보호·recurrence 전이를 **단일 DB/API invariant 테스트 스위트**로 묶어 Phase A에 포함. C·D·G가 이 테스트를 망가뜨리면 merge 차단 (Codex do-not-skip).
5. **자동 UI 검증은 Playwright 단독이 아님**: a11y(axe-core), visual diff(pixelmatch), API contract(OpenAPI schema 검증), DB invariant 4축 병행 (Codex MAJOR).
6. **운영 하드닝 Phase J**: RBAC·PII·rate-limit·backup을 묶어 배포 직전에 한 번에 처리.

### 0-3-2. Phase A — 자동 검증 프레임워크 (✅ 완료 · 1일 예정 → 실제 반나절)

#### 이게 뭔데 왜 먼저 해야 하나

**비유로 설명하면**: 자동차 정비소에서 "엔진 교체" 같은 큰 작업을 하기 전에, 먼저 엔진 상태를 **숫자로 측정하는 계측기**를 갖춰야 하오. 계측기 없이 엔진을 갈면 "바뀐 후 괜찮은지" 알 길이 없음. 이 Phase가 그 계측기이오.

우리 CRM은 이제 기능이 13개고 파일이 20개 이상이오. 앞으로 Phase B~J를 하면서 **"내가 고친 게 다른 기능을 망가뜨렸는지"**를 매번 사람이 모든 탭을 클릭해가며 확인할 수 없소. 자동 검증이 없으면 Phase D 작업하다 Phase F 회귀를 놓치는 사고가 발생하오.

#### 무엇을 만들었는가 (5축 검증 스위트)

실제 구현은 계획보다 빨리 끝났소(반나절). `npm run test:crm` 한 방으로 아래 5축이 순차 실행되오:

1. **A-1 UI 플로우 테스트** (`tests/crm-full-flow.spec.ts`) — 8가지 시나리오:
   - F1 재구매 탭 로드 + 그룹 API 계약 검증
   - F2 재구매 "N명 발송" 버튼 → 임시 그룹 자동 생성 → messaging 탭 리다이렉트 확인
   - F3 고객 그룹 탭 → 엑셀 업로드 (API)
   - F4 예약 발송 등록 → 목록 → 취소 사이클
   - F5 예약 발송 엣지 케이스 (과거 시각·잘못된 채널·없는 그룹)
   - F6 ConsentAuditTab 로드 + 계약
   - F7 엑셀 업로드 실제 UI 클릭 (파일 input + 드롭존)
   - F8 A/B 퍼널 4단계 응답 계약
2. **A-2 접근성 스캔** (`@axe-core/playwright`) — 각 탭 로드 직후 axe가 WCAG 2A/2AA 위반을 스캔. Phase A에서는 "관측만" (색 대비 제외). serious/critical 발견 시 콘솔에 경고 로깅. Phase C 이후 강제로 승격.
3. **A-3 시각 회귀** (`tests/crm-visual-diff.spec.ts`) — pixelmatch로 4개 핵심 탭의 스크린샷을 `tests/fixtures/visual-baseline/` 기준 이미지와 비교. 1% 이상 차이 나면 실패 + `tests/artifacts/visual-diff/*.diff.png` 자동 저장. baseline 최초 실행 시 자동 생성.
4. **A-4 API 계약 검증** (`tests/schemas/crm-api.schemas.ts` + ajv) — 7개 주요 엔드포인트의 응답 shape을 JSON Schema로 고정. 플로우 테스트가 응답을 받을 때마다 `validateResponse()` 통과 여부 확인. 프론트가 읽는 필드만 required, 나머지는 additionalProperties로 완화해서 백엔드 추가 변경에 너그럽게.
5. **A-5 DB invariant** (`tests/invariants.spec.ts`) — 운영 sqlite 파일을 **읽기 전용**으로 열어 6개 규칙 검사:
   - I1: pending/running 예약 발송의 group_id가 전부 존재하는 그룹을 참조
   - I2: 감사 로그의 old_value와 new_value가 다르거나 initial 상태
   - I3: experiment_key 있는 메시지 로그는 배정 로그에 대응되는 행이 존재 (고아 메시지 없음)
   - I4: 완료된 예약 발송의 success+fail 합이 total 이하
   - I5: group_id가 NULL/빈 문자열이 아님
   - I6: 감사 로그 source가 허용된 enum(`imweb_member_sync`·`admin_manual`·`webhook`·`manual`·`admin`) 중 하나

#### 실행 결과

**26/26 전부 통과, 53초** (스모크 8 + 플로우 8 + 시각 4 + invariant 6). 상세:
- 스모크 8건 — 기존 `crm-smoke.spec.ts`, regression 없음
- 플로우 8건 — 실 DB 상대로 그룹 생성·엑셀 업로드·예약 등록·취소까지 end-to-end
- 시각 4건 — baseline 자동 생성, 재실행 시 diff 계산
- invariant 6건 — 현재 DB 상태 전부 클린
- axe 경고 2건 관측: `select-name` (재구매 탭의 셀렉트 박스 라벨 누락), `label` (고객 그룹 input 라벨 누락). Phase B에서 수정 예정

#### 부산물

- `backend/src/obs.ts` 신규 — pino 래퍼. `log.info/warn/error/child` + `obsEvents` 이벤트 네임 상수. Phase A에서는 유틸만 제공, 실제 배치는 Phase C 이후 진행.
- `frontend/tests/fixtures/test-members.csv` — 재사용 가능한 테스트 CSV (정상 3·중복 1·무효 1)
- `frontend/tests/utils/test-helpers.ts` — `createTestGroup`·`deleteGroup`·`isoInFuture` 등 공통 헬퍼
- `frontend/tests/utils/validate.ts` — ajv 컴파일러 + 포맷터
- `package.json`: `test:crm`·`test:crm:flow`·`test:crm:visual`·`test:crm:invariants`·`test:crm:screenshots` 5개 스크립트

#### 위험성
- **낮음**. 테스트 코드는 읽기·격리된 임시 그룹만 만들고 정리까지 자동이라 기존 데이터 영향 없음. 실 SMS/알림톡은 **절대 보내지 않음**(testMode=Y + 임시 그룹 + 본인 번호 01087418641).
- 잠재 이슈: 시각 회귀는 서버 데이터가 바뀔 때마다 baseline 업데이트가 필요. 예를 들어 주문 수가 늘면 스크린샷이 달라짐. 이건 Phase I에서 baseline 재생성 스크립트를 붙여 해결.

---

### 0-3-3. Phase C — 데이터 정합성 · 감사 · 정책 (✅ 완료 · 2026-04-13)

#### 왜 필요한가

지금은 **프론트에서만** 발송 정책을 체크하고 있소. 사용자가 브라우저에서 야간에 발송 버튼을 누르면 "야간입니다" 경고가 뜨지만, 누군가 `curl`로 백엔드 `/api/aligo/sms`를 직접 때리면 그냥 나가버리오. 이건 **시스템 관점에서 정책이 없는 것과 같음**. 프론트 체크는 편의일 뿐, 진짜 정책은 서버에 있어야 하오.

법적 리스크도 있소: 정보통신망법상 광고성 SMS는 **야간(21시~익일 8시) 발송 금지**이고, 위반하면 과태료가 붙소. 만약 운영자가 실수로 버튼을 눌러서 10만 건이 야간에 나가면 회사 책임이오. 그래서 "사람이 실수해도 시스템이 막는다"가 필수.

#### Severity 3단계 — 야간에 관리자도 못 보내는가? 상황별로 다르오

정책을 **상황별 세 등급**으로 나누겠소. 레스토랑의 주방 규칙으로 비유하면 이해가 쉬울 거요:

**1) `hard_legal` — 법이 막는 것 (관리자도 못 우회)**

레스토랑에서 "식재료 유통기한 지난 건 손님에게 못 낸다"는 법이 있다 치면, 사장이 직접 "괜찮아 내가 책임질게"라고 해도 못 내는 거요. 법적 처벌이 사장이 아니라 회사에 오기 때문이오.

CRM에서 `hard_legal`이 적용되는 경우:
- **광고성 메시지**의 야간(21~08시) 발송. 정보통신망법 제50조 3항. 관리자 override로도 **우회 불가**.
- 수신자가 명시적으로 "수신거부" 버튼을 누른 이력이 있는 경우. 개인정보 보호 의무. 역시 우회 불가.

다만 **정보성 메시지는 야간 허용**이오. "검체가 도착했습니다", "예약이 확정됐습니다" 같은 건 법적으로 시간 제한이 없소. 그래서 야간이라도 레스토랑이 "손님이 주문한 음식을 만들어서 내는 건" 됨. 이게 `hard_legal`이 "광고성만" 막는 이유요.

**사용자 질문 답**: **아니요, 야간에 관리자도 못 보내는 건 광고성 메시지뿐**이오. 검체 수령 안내, 주문 확인 같은 정보성 메시지는 관리자도, 일반 운영자도, 자동 스케줄러도 새벽 3시에 보낼 수 있소.

**2) `hard_policy` — 회사 정책이 막는 것 (관리자는 우회 가능)**

레스토랑 내부 규칙으로 "일반 웨이터는 와인 추천 못 한다"가 있다 치면, 사장이나 수석 매니저는 "내가 책임질게"라고 하고 우회할 수 있소. 법이 아니라 회사 규칙이기 때문에 상급자가 리스크 감수하면 됨.

CRM에서 `hard_policy`:
- 수신 동의 정보가 없는(`consent_missing`) 고객에게 홍보성 메시지 발송. 법적으로는 완전 금지 아니지만 회사 정책으로 차단.
- 홍보성 템플릿을 동의 확인 안 된 그룹에 발송.

관리자가 `adminOverride=true`로 요청하면 통과시키되, **반드시 감사 로그에 warn 레벨로 기록**(누가·언제·왜 override했는지 nota 필드에 저장).

**3) `soft` — 경고만, 발송은 진행**

레스토랑에서 "오늘은 손님이 너무 많아서 평소보다 조리가 10분 늦어집니다" 같은 안내. 막지 않음, 그냥 고객에게 미리 알림.

CRM에서 `soft`:
- 최근 24시간 내 동일 고객에게 이미 발송한 이력 있음 → 경고만
- 그룹 크기가 1000명 이상 → "배치 발송 시간 1시간 예상" 경고
- 템플릿에 `#{변수}` 미채움 → 경고 (카카오 거부 확률 높으나 일단 보냄)

프론트에서 경고 표시만 하고 발송은 진행. 서버에서는 아무것도 안 막음.

#### 한 표로 정리

| 상황 | severity | 최고관리자도 막히나? | 누가 통과 가능 |
|------|----------|------------------|------------|
| 광고 메시지 + 야간(21~08시) | `hard_legal` | **막힘** | 아무도 못 보냄 |
| 정보 메시지 + 야간 | 해당 없음 | 안 막힘 | 전부 가능 |
| 수신거부 이력 있는 고객 | `hard_legal` | **막힘** | 아무도 못 보냄 |
| 동의 정보 없는 고객 + 홍보성 | `hard_policy` | 통과 가능 | 관리자만 (warn 로깅) |
| 24시간 내 중복 발송 | `soft` | 통과 | 누구나 (경고 표시) |
| 대량 발송 경고 | `soft` | 통과 | 누구나 |

#### 외에 이 Phase가 하는 일

7. **감사 로그 실검증 자동화**: Phase A-5 invariant에 "아임웹 동기화 1회 돌린 후 `crm_consent_change_log`에 최소 1건 추가됐는지" 규칙 추가. 수동 확인을 자동화로 승격.
8. **수동 consent 변경 UI**: ConsentAuditTab에 "이 고객 수신 동의 수동 변경" 버튼. `source='admin_manual'` + 관리자 ID + 사유 note. 변경 후 즉시 새 감사 로그 행 렌더.
9. **엑셀 업로드 consent_sms 경로 일관성**: 지금은 엑셀 업로드로 추가된 멤버만 `consent_sms` 값이 저장됨. 재구매 탭 자동 그룹·세그먼트 materialize·수동 입력 등 나머지 경로도 같은 필드 채우도록 `addGroupMembers` 호출부 전부 업데이트.
10. **validation 다중 오류 리턴**: 예약 발송·세그먼트 API가 여러 필드 오류를 배열로 한 번에 리턴. 지금은 "첫 번째 오류만" 돌려주는데, 프론트가 "전화번호 없음 + 시각 잘못됨 + 그룹 없음"을 한 번에 표시하려면 모든 오류가 필요.

#### 위험성
- **중간**. contact-policy 서버 강제화는 기존 프론트·운영 흐름에 영향을 줄 수 있소. 특히 `hard_legal`을 너무 넓게 잡으면 정보성 메시지까지 막을 수 있어서, 템플릿 타입(광고/정보) 판별 로직이 정확해야 함.
- 완화책: Phase A의 플로우 테스트에 "정보성 템플릿 야간 발송 허용" 케이스를 추가해서, 정책이 과도하게 작동하는지 회귀 검증.
- 기존 aligo 라우트에 policy 미들웨어를 끼우는 과정에서 로그 상태 변경 순서 버그 가능. 미들웨어는 발송 시도 전에 검사만 하고, 로깅은 기존 flow 유지.

---

### 0-3-4. Phase D — 재구매 임시 그룹 정리 + 보호 (✅ 완료 · 2026-04-13)

#### 문제 상황

지금 운영자가 재구매 탭에서 "SMS 발송 326명" 같은 버튼을 누르면, 시스템이 자동으로 `재구매 동의 30~180일 SMS (2026-04-13)` 같은 이름의 그룹을 DB에 만들고 발송 탭으로 넘겨주오. 편의 기능이지만 운영자가 필터를 바꿔가며 버튼을 5번 누르면 **그룹 5개가 쌓이오**. 하루에 20번 누르면 20개. 2주면 300개. 고객 그룹 탭이 "재구매 ..."로 도배돼서 운영자가 "내가 실제로 만든 그룹이 뭐였지?"를 찾기 어려움.

또 이런 임시 그룹은 **발송 1회 용도**인데 삭제 흐름이 없소. 누가 정리해야 하는지 책임이 모호.

#### 해결 방법 (섹션 0-4 1단계 기반)

1. **그룹 종류 표시**: `crm_customer_groups`에 `group_kind` 컬럼 추가. 값은 `manual`(사용자가 직접 만든 영구 그룹), `repurchase_temp`(재구매 자동), `experiment_snapshot`(A/B 실험 결과), `segment_snapshot`(세그먼트 materialize) 중 하나.
2. **필터 출처 기록**: `source_ref` 컬럼에 어떤 조건으로 만들어진 그룹인지 저장. 예: `repurchase:thecleancoffee:30-180:1-9999`. 같은 조건으로 재클릭해도 같은 `source_ref`가 되도록.
3. **UI 필터링**: 고객 그룹 탭의 기본 조회는 `kind=manual`만. "임시 그룹 N개 보기" 토글을 누르면 `kind=all`로 전체 표시.
4. **아카이브 컬럼**: `archived_at` 추가. 발송 완료된 임시 그룹은 이 컬럼에 타임스탬프가 박히고, 월 1회 크론이 30일 지난 것을 물리 삭제.

#### 가장 중요한 부분: 예약 발송 보호

"임시 그룹인데 발송 끝났으니 지워도 되겠지?"가 위험한 가정이오. 왜냐면 예약 발송이 이 그룹을 **미래에 참조**할 수 있기 때문이오. 케이스를 나눠 보면:

- `pending`: 아직 실행 전. 그룹이 삭제되면 스케줄러가 실행할 때 "그룹 없음" 에러로 실패. **절대 삭제 금지**.
- `running`: 현재 실행 중. 삭제하면 실행 중인 코드가 터짐. **절대 삭제 금지**.
- `success` + 반복 예약(`recurrence_rule` 있음): 한 번은 성공했지만 다음 주 월요일에 또 실행돼야 함. 삭제하면 다음 회차 실행 불가. **절대 삭제 금지**.
- `success` + 단발: 끝남. 삭제해도 됨.
- `canceled`: 사용자가 취소. 삭제해도 됨.
- `fail`/`partial`: 재시도 로직 없음. 삭제 허용.

이 판단을 한 곳에 모은 함수 `canArchiveGroup(groupId)`를 만들겠소. 위 규칙을 SQL 쿼리 하나로:

```sql
SELECT 1 FROM crm_scheduled_send
WHERE group_id = ? AND (
  status IN ('pending','running')
  OR (status = 'success' AND recurrence_rule IS NOT NULL)
)
LIMIT 1
```

이 쿼리가 행을 돌려주면 archive 금지. 크론 정리 작업도, 사용자 수동 아카이브 버튼도 이 함수를 거치게.

Phase A의 invariant I1은 이미 "pending/running 예약의 group_id가 아카이브된 그룹이면 안 된다"를 검증하므로, 이 함수가 깨지면 자동 검증에서 바로 잡힘.

#### 위험성
- **낮음~중간**. 마이그레이션이 정적 테이블 구조 변경 + 기존 데이터를 `kind='manual'` 디폴트로 채우는 것이라 단순. 다만 `canArchiveGroup` 로직이 빠뜨린 상태가 있으면 Phase G(반복 예약)와 상호작용할 때 숨은 버그로 나타날 수 있음. Phase A invariant로 회귀 검증.
- 기존 `재구매 ...` 그룹들이 이미 누적돼 있을 수 있어, 마이그레이션 시 이름으로 `UPDATE ... SET group_kind='repurchase_temp'`를 한 번 돌려서 정리.

---

### 0-3-5. Phase B — 코드 품질 잔여분 정리 (✅ 완료 · 2026-04-13)

#### 왜

`frontend/src/app/crm/page.tsx`가 여전히 1,716줄이오. 지난 세션에서 3,410줄 → 1,716줄로 절반을 잘랐지만, **상담 후속** 섹션(~400줄)과 **결제 추적** 섹션(~220줄)이 아직 인라인으로 남아 있소. 이 둘을 별도 파일로 추출하면 `page.tsx`가 ~900줄까지 내려가고, 이후 Phase E(세그먼트 빌더)·H(고객 드로어) 같은 큰 UI를 붙일 때 conflict 면적이 줄어드오.

또 **에러 바운더리**가 없어서, 한 탭에서 런타임 에러가 나면 전체 CRM 앱이 하얀 화면이 되어버리오. React 19 기준 `<ErrorBoundary>`를 최상위에 한 겹 감싸면, 한 탭이 터져도 옆 탭은 살아있게 됨.

#### 무엇을

1. `ConsultationSection.tsx` 추출 (~400줄)
2. `AttributionTrackingSection.tsx` 추출 (~220줄)
3. 반복되는 fetch 로직을 훅으로: `useExperimentsList` 등
4. `ErrorBoundary.tsx` 탭 레벨 래퍼
5. `madge --circular` 돌려서 순환 import 없는지 확인

#### 왜 C·D 뒤에 오는가

원래 초안에서는 B를 A 바로 뒤에 뒀지만 Codex 지적이 있었소: "**리스크 먼저 해결 안 된 상태로 큰 리팩터를 하면, 리팩터 중에 정합성 버그가 새로 생겨도 원인을 못 찾는다**". 그래서 C(정합성)와 D(그룹 보호)를 먼저 마친 뒤 B를 진행.

비유하면: 차 엔진의 이상음 원인을 모르는데 먼저 차체 도색부터 하는 격이오. 도색 후에 엔진 소리가 이상해도 "도색 때문인지 원래 그랬는지" 구분이 안 됨.

#### 위험성
- **낮음**. 리팩터만 하고 기능 변경은 없음. Phase A 26개 테스트가 회귀를 잡아주오.
- 잠재 이슈: CSS module scoping. 섹션을 파일로 분리할 때 동일 클래스 이름이 다른 `.module.css`로 흩어지면 우선순위가 꼬일 수 있음. 분리 후 Phase A의 시각 회귀 테스트가 이걸 잡아줌.
- import cycle: 훅과 컴포넌트가 서로 참조하면 순환. `madge` 체크를 merge 조건으로.

---

### 0-3-6. Phase E — 세그먼트 커스텀 빌더 (✅ 완료 · 2026-04-13)

#### 현재 한계

지금 "고객 행동" 탭은 사전 정의 5종(재구매 안 함, 이번 달 생일, 30만원 이상, 90일 미활동, 신규 30일)만 조회할 수 있소. 운영자가 "SMS 동의 + 마지막 주문 30~90일 + 구매 금액 20만원 이상"을 조회하고 싶어도 코드를 고쳐야 하오. 이 Phase는 **운영자가 조건을 직접 조합**할 수 있는 빌더를 만드는 것이오.

#### 비유

엑셀의 "자동 필터" 같은 것이오. 엑셀에서 A열의 값이 "Y"이고 B열이 50 이상이고 C열이 2026년 3월인 행만 골라내는 것. 우리는 이걸 DB 쿼리로 돌려서 고객 몇 명이 해당되는지 즉시 보여주고, 원하면 "이 조건으로 그룹 만들기"를 누르면 됨.

#### 어떻게

1. **DB**: `crm_saved_segments(id, name, site, query_json, created_by, created_at)`. `query_json`은 조건 AST를 JSON 직렬화한 것.
2. **조건 DSL** 예:
   ```json
   { "op": "AND", "clauses": [
     { "field": "days_since_last_order", "op": ">=", "value": 30 },
     { "field": "total_spent", "op": ">=", "value": 200000 },
     { "field": "marketing_agree_sms", "op": "=", "value": "Y" }
   ]}
   ```
3. **SQL injection 방지** — 이게 Phase E의 난점이자 Codex가 BLOCKER로 지적한 부분이오:
   - 사용자 입력을 SQL 문자열로 붙이면 안 됨. 항상 parameterized query 사용
   - 필드 이름도 whitelist: `days_since_last_order`·`total_spent`·`total_orders`·`marketing_agree_sms`·`member_grade`·`join_time` 같이 정해진 것만 허용. 다른 이름은 400 거절
   - 연산자도 whitelist: `=`·`!=`·`>`·`>=`·`<`·`<=`·`LIKE`·`IN`. 다른 건 거절
4. **쿼리 비용 예산** — 이것도 Codex BLOCKER:
   - 실행 시 `LIMIT 50000` 강제 (더 많으면 잘림)
   - sqlite `busy_timeout` 5초로 설정. 5초 넘는 쿼리는 abort
   - clause 개수 ≤ 10, 중첩 깊이 ≤ 3
   - 저장 직전 `EXPLAIN QUERY PLAN` 결과를 서버가 보고, 인덱스를 안 타면 경고 응답
5. **엔드포인트**:
   - `POST /api/crm-local/segments/evaluate` — 미리보기(카운트만 리턴)
   - `POST /api/crm-local/segments` — 저장
   - `POST /api/crm-local/segments/:id/materialize` — 결과를 실제 그룹으로 변환 (`group_kind='segment_snapshot'`)
6. **프론트** `SegmentBuilder.tsx` — 조건 카드 추가/제거, AND/OR 토글, 미리보기 카운트, 저장 버튼. BehaviorTab 하단에 "커스텀 세그먼트 만들기" 버튼 추가.

#### 왜 C 뒤에 오는가

세그먼트 DSL이 `marketing_agree_sms = Y`로 조회하려면, 먼저 **DB에 consent 값이 제대로 채워져 있어야** 함. 현재는 엑셀 업로드 경로만 실 값, 나머지 경로는 기본값 false. Phase C-9에서 이 일관성 문제를 해결하므로 E는 C 뒤.

#### 위험성
- **높음**. 사용자 입력으로 SQL을 만드는 건 본질적으로 SQL injection 리스크. 위의 안전장치(whitelist + parameterized + explain + timeout + depth) 모두 있어야 함. 하나만 빠져도 위험.
- 쿼리 비용 폭발: 인덱스 안 타는 조건(LIKE 앞에 %)으로 10,000명 고객 × 3 clause를 돌리면 수초 걸림. timeout 있지만 시간 내 완료 못 하면 사용자는 "아무 결과도 안 옴" 경험. UI에 "쿼리 비용 추정" 표시 필요.
- 완화책: Phase A 플로우 테스트에 "악성 조건으로 evaluate → 400 거절" 케이스 추가. Phase I 로드 테스트에서 세그먼트 evaluate를 10 RPS로 60초 돌려 p95 측정.

---

### 0-3-7. Phase F — A/B 통계 · 조기 종료 · 3+ variants (2일)

#### 현재 한계

A/B 실험 결과 화면은 "A그룹 전환율 15%, B그룹 전환율 18%"처럼 숫자를 표시하지만, **이게 진짜 의미 있는 차이인지, 우연인지**를 계산하지 않소. 표본이 A 50명, B 50명이면 3% 차이가 "의미 있다"고 단정할 수 없음 — 동전을 100번 던지면 52대 48이 나오는 건 우연일 수 있듯이. 통계적 유의성을 계산해서 배지로 보여줘야 하오.

또 현재는 **A vs B 2그룹만** 지원. "SMS vs 알림톡 vs 알림톡+쿠폰" 같은 3+ variants 실험이 불가능.

#### 무엇을

1. **통계 라이브러리**: `simple-statistics` 도입 (경량, MIT 라이선스)
2. **통계 검정**:
   - 2 variants → 2-proportion z-test (두 비율 차이 검정)
   - 3+ variants → Chi-square goodness-of-fit (여러 비율 동시 검정)
   - p-value를 계산해서 배지 색 결정: p < 0.05 초록, 0.05~0.1 노랑, > 0.1 회색
3. **표본 크기 가드**: 각 variant n < 30이면 "통계적으로 무의미" 라벨(회색). p-value는 계산해도 신뢰 못 함.
4. **Peeking 방지 (Codex 지적)**: 실험 생성 시 **목표 표본 크기** `min_sample_size`를 미리 지정. 달성 전에는 "조기 종료" 버튼 비활성화. 달성 후에도 α=0.01 (5%가 아니라 1%) 보수적 기준 권장. 이유: 운영자가 매일 "이겼나?" 보면서 유리할 때만 종료하면(peeking) false positive가 급증.
5. **3+ variants 지원**: `crm_experiments.variants`를 JSON 배열로 변경. 기존 `A/B` 2-row는 마이그레이션으로 `[{key:"A"}, {key:"B"}]` 형태로 변환.
6. **조기 종료**: `POST /api/crm-local/experiments/:key/conclude` — `winner_variant` 저장 + `status='concluded'`. UI는 읽기 전용 모드로 전환.

#### Peeking 이해 돕기

"커피 내리면서 5분마다 맛을 본다"고 생각해 보시오. 처음 1분에 "약간 쓰네, 조금만 설탕 추가"했더니 괜찮아 보이고, 2분에 "아 너무 달다"고 하다가, 3분에 원래대로 돌리고, 5분에 완성. 근데 사실 3분 시점의 "너무 달다"는 찻물이 덜 녹은 상태일 수 있음. 매번 측정치가 들썩이는데 그때마다 결정을 바꾸면 결국 엉뚱한 결정을 하게 되오.

A/B 테스트도 같음. 표본이 적을 때 보면 운 좋게 한쪽이 유리해 보이는 순간이 있는데, 거기서 "이겼다, 끝내자"를 누르면 실제로는 진 실험을 이긴 걸로 선언하는 꼴이오. 그래서 미리 "2000명 모일 때까지 버튼 비활성"으로 강제하는 게 peeking 방지요.

#### 위험성
- **중간**. 통계 계산 자체는 simple-statistics로 간단. 문제는 운영자가 "목표 표본 크기를 지정해야 실험 시작 가능"이라는 새 제약을 불편해할 가능성. 디폴트값을 알려진 공식으로 자동 제안(예: 효과 크기 5%, α=0.05, power=0.8 기준 ~1500명)해서 완화.
- 기존 실험의 JSON 마이그레이션 한 번 오류 나면 전체 A/B 결과가 안 보일 수 있음. 마이그레이션 전 백업 필수.

---

### 0-3-8. Phase G — 반복 예약 발송 (1일)

#### 무엇을

예약 발송이 지금은 "1회성"이오. "매주 월요일 오전 10시에 이 그룹에 이 메시지를 계속 보내줘" 같은 반복 규칙은 안 됨. 이 Phase는 RRULE(iCal 표준)을 도입해 반복 예약을 지원.

#### 비유

달력 앱에서 "매주 화요일 팀 회의"를 등록하면, 달력이 자동으로 매주 새 일정을 만들어주오. 반복 예약 발송도 같은 개념 — 한 번 등록하면 스케줄러가 실행할 때마다 다음 회차를 자동 생성.

#### 어떻게

1. **RRULE 라이브러리**: `rrule.js` 도입. 직접 파싱 금지(Codex 지적: DST, 주간 규칙, 월말 처리 버그 위험).
2. **Timezone 고정**: `DTSTART;TZID=Asia/Seoul:20260414T100000`. 한국은 서머타임(DST) 없으므로 KST 고정. 해외 timezone 지정하면 400 거절.
3. **야간 자동 차단**: 반복 RRULE의 실행 시각이 KST 21~08시면 저장 거절. `adminOverride=true` + `note`(왜 야간에 보내는지)가 있으면 허용.
4. **스케줄러 확장**: `processScheduledSend`가 성공 처리 후 `recurrence_rule`이 있으면 `rrule.after(now)`로 다음 실행 시각 계산해서 새 `pending` row 생성.
5. **UI**: MessagingTab 예약 영역에 "반복" 드롭다운 — 한 번만 / 매일 / 매주 / 매월 / 커스텀(고급).

#### 왜 D 뒤에 오는가

반복 예약은 같은 그룹을 여러 번 참조하오. 그룹이 중간에 삭제되면 다음 회차 실행 실패. Phase D에서 `canArchiveGroup()` 함수가 "반복 예약 참조 있는 그룹은 archive 금지"를 보장하므로, D가 먼저 설치돼야 G가 안전.

#### 위험성
- **낮음~중간**. RRULE 파싱 자체는 라이브러리가 처리. 문제는 "다음 회차 계산"이 성공 후 즉시 돌면 DB 잠금 경합 가능성. 트랜잭션으로 `finishScheduledSend` + 새 `pending` 삽입을 한 번에 처리.
- 야간 차단 로직의 boundary case: 정확히 21:00:00 KST가 차단인지, 20:59:59는 통과인지. 명확히 `hour >= 21 || hour < 8`로 고정하고 테스트 추가.

---

### 0-3-9. Phase H — 고객 상세 드로어 (1.5일)

#### 현재 한계

고객 한 명의 정보가 **여러 탭에 흩어져 있소**. 이름·등급은 고객 목록, 주문 이력은 결제 추적, 발송 이력은 메시지 이력, 동의 변경은 감사 로그 — 이렇게 네 탭을 왔다갔다 하면서 고객 한 명을 파악해야 하오. 운영자가 "저 사람 왜 이렇게 불만 많이 말하지?"를 답하려면 10분 걸림.

#### 무엇을

행을 클릭하면 우측에서 슬라이드하는 **드로어**를 열어서 한 화면에 5개 섹션 전부 보여주기:
1. **프로필**: 이름·등급·연락처·동의 상태·가입일
2. **최근 주문** 10건
3. **최근 발송** 10건 (메시지 로그 기반)
4. **동의 변경 이력** 5건
5. **실험 참여 이력**

#### N+1 문제 회피 (Codex 지적)

단순 구현은 "프로필 API 호출 → 주문 API 호출 → 발송 API 호출 → ..." 5번의 네트워크 왕복이 됨. 이걸 **단일 엔드포인트 `GET /api/crm-local/customers/:memberCode/profile`**로 묶어 한 번의 HTTP로 처리. 백엔드는 SQL CTE 또는 UNION ALL로 한 트랜잭션에서 5개 테이블을 조회.

#### N+1이 뭔가

"상품 목록 → 각 상품마다 상세" 식으로 1+N 번의 쿼리가 나가는 안티패턴. 드로어에서도 "고객 1명 선택 → 주문 10건 → 각 주문마다 결제 정보 조회"가 되면 1 + 1 + 10 = 12번 쿼리. 같은 결과를 1번의 JOIN 쿼리로 가져올 수 있는데 12번 치면 느리오.

비유하면 도서관에서 책 10권을 빌리는데, 사서가 매번 "이 책 어디 있는지 DB 조회" 10번 하는 것보다, 처음에 "이 10권 한꺼번에 찾아줘"가 빠름.

#### 위험성
- **낮음**. 기능 자체는 읽기 전용이라 데이터 훼손 없음.
- 성능 잠재 이슈: profile endpoint가 p95 200ms 넘으면 드로어 열기가 눈에 띄게 느려짐. Phase A invariant에 "profile endpoint p95 < 200ms" 테스트 추가.

---

### 0-3-10. Phase J — 운영 하드닝 (2일)

#### 왜 필요한가 — Codex가 BLOCKER로 지적

지금 CRM은 **내부 개발 환경**에서만 돌아가오. 누구나 `curl`로 발송 API를 쏘면 실제 SMS가 나가고, 누구나 전 고객 목록을 다운로드할 수 있고, 감사 로그는 영원히 쌓이고, DB가 날아가도 복구 방법이 없소. 이건 "개발자 한 명이 쓰는 내부 툴"로는 OK지만 **운영 환경에 배포하려면 전부 P0 차단 항목**이오.

#### 무엇을

1. **인증 (경량)**: `express-session` + 관리자 비밀번호 1개. 나중에 Google OAuth로 쉽게 교체 가능한 구조.
2. **RBAC (3단계 권한)**:
   - `viewer` — 읽기만 (GET)
   - `operator` — 발송 POST 가능
   - `admin` — 삭제, contact-policy hard_policy 우회, 감사 수동 변경
3. **PII 보존 정책**:
   - `crm_message_log`·`crm_consent_change_log`에 12개월 이상 된 행을 월 1회 자동 hard-delete
   - `imweb_members` 동기화 시 `delete_flag=Y`를 받으면 hard-delete + audit trail
   - 개인정보 보호법 권고: 목적 달성 후 즉시 파기
4. **Rate limiting**: `express-rate-limit`로
   - `/api/aligo/*` — 분당 10건
   - `/api/crm-local/segments/evaluate` — 분당 30건
   - `/api/crm-local/groups/:id/members/bulk-upload` — 분당 5건
5. **Backup**:
   - sqlite `VACUUM INTO` 기반 일 1회 스냅샷 → `backend/backups/YYYY-MM-DD.db`
   - 7일 rotation (오래된 것 삭제)
6. **관측성 stack 연결**: Phase A-6의 `backend/src/obs.ts` 로그를 stdout → pm2 또는 journald로 수집. 실 운영 시 grafana/loki로 전환 가능.

#### 비유

지금은 "가게 문이 항상 열려 있고, CCTV 없고, 물품 재고 기록이 영원히 쌓이는 상태". Phase J는 "문에 자물쇠, 손님/직원 구분, 영수증 보관 기간 규정, 일일 재고 백업"을 추가하는 것. 가게를 처음 열 때 필수 요건이오.

#### 위험성
- **중간**. 인증을 붙이면 기존 로컬 개발 flow가 "로그인 필요"로 바뀌어 불편할 수 있음. 완화책: `NODE_ENV=development`에서는 auto-login으로 우회.
- Rate limit이 너무 빡빡하면 배치 발송이 분당 10건 제약에 걸림. `test:crm` 플로우 테스트가 분당 30건 넘게 호출하면 false failure. `/api/aligo` 라우트는 일반 사용자용이고, 스케줄러 내부 호출은 경로를 분리해서 rate limit 우회.
- PII 자동 삭제가 너무 공격적이면 감사 증빙 가능성이 줄어듦. 12개월은 개인정보 보호법 권고와 감사 증빙 사이 균형점.

---

### 0-3-11. Phase I — 최종 100% 검증 + 배포 (1일)

#### 무엇을

모든 Phase 누적 효과를 검증하고 100% 선언하는 마감 단계.

1. **Phase A 5축 전체 실행**: `npm run test:crm` → 완전 녹색
2. **부하 테스트**: k6 또는 autocannon으로 `/api/crm-local/customers`·`segments/evaluate`·`scheduled-sends`를 10 RPS × 60초. p95 latency 측정 + report
3. **감사 로그 실운영 검증**: 아임웹 동기화 1회 수동 트리거 + `crm_consent_change_log` 신규 행 확인
4. **예약 발송 실시간대 테스트**: 본인 번호(01087418641)에 testMode=N 1건. 수신 확인
5. **0-1 현황표 모든 행을 100%로 업데이트**
6. **체크리스트 검증**:
   - [ ] 백엔드 tsc / 프론트 tsc / lint pass
   - [ ] Phase A 자동 스크린샷·diff 최신
   - [ ] axe 경고가 Phase B 목록에 없음 (Phase C 이후 0 강제)
   - [ ] 로드 테스트 p95 latency 로그
   - [ ] 감사 로그 실운영 검증 로그
7. **최종 보고서**: `crmux/0412/final-report.md` 생성

#### 왜 I가 마지막인가

다른 모든 Phase의 결과가 들어가야 검증이 의미가 있기 때문이오. I는 단독으로 수행 불가.

#### 위험성
- **낮음**. 검증만 하고 기능 변경 없음. 다만 로드 테스트에서 예상 못 한 성능 이슈가 드러날 수 있어 추가 튜닝 Phase(K)가 필요할 가능성 있음.

---

### 0-3-12. Phase 의존성 맵 (수정)

```
A (검증 프레임워크 + invariant)
 ├─→ C (정합성·감사·정책) ──┐
 │                          ├─→ D (그룹 보호) ──┐
 │                          │                   ├─→ G (반복 예약)
 │                          │                   │
 │                          └─→ E (세그먼트)    │
 │                                               │
 ├─→ B (코드 분리) ────────────────────────────┤
 │                                               │
 ├─→ F (A/B 통계)  ─────────────────────────────┤
 │                                               │
 └─→ H (고객 드로어) ───────────────────────────┤
                                                 │
                                  J (운영 하드닝)┤
                                                 │
                                  I (최종 검증)──┘
```

주요 변화:
- **B가 C·D 뒤로 이동** (Codex BLOCKER 리오더)
- **G는 D 뒤** (Codex BLOCKER)
- **E는 C 뒤** (Codex MAJOR)
- **J 신설** (Codex BLOCKER 운영 하드닝)
- **I는 마지막**, J와 병렬 불가

### 0-3-13. 총 공수 (수정)

| Phase | 내용 | 원안 | Codex 반영 | 실제 |
|-------|------|------|------------|------|
| **A** | 자동 검증 프레임워크 (5축 + invariant) | 반나절 | 1일 | **✅ 반나절** (완료, 2026-04-13) |
| C | 정합성·감사·정책 (severity 3단계) | 1일 | **1.5일** | — |
| D | 임시 그룹 정리 + archived 가드 확장 | 반나절 | **1일** | — |
| B | 코드 분리 잔여분 | 반나절 | 반나절 | — |
| E | 세그먼트 빌더 + SQL 안전성 | 1.5일 | **2.5일** | — |
| F | A/B 통계 + peeking 방지 | 1일 | **2일** | — |
| G | 반복 예약 + RRULE/TZ | 반나절 | **1일** | — |
| H | 고객 드로어 + N+1 회피 | 1일 | **1.5일** | — |
| J | 운영 하드닝 (RBAC·PII·rate·backup) | — | **2일** (신설) | — |
| I | 최종 검증 + 로드 테스트 | 반나절 | **1일** | — |
| **합계** | | ~6일 | **~13.5일** | **A 완료, 잔여 ~13일** |

Phase A가 예상(1일)보다 빨랐던 이유: 백엔드에 이미 pino가 있어 A-6 obs utility가 얇게 끝났고, 기존 smoke spec을 재사용해 flow spec을 빠르게 구성할 수 있었음.

### 0-3-14. 자동 UI 동선 검증 주체

**사용자 손 불필요**를 유지. 단 Codex 지적대로 Playwright 단독이 아니라 **4축 병행**:

| 축 | 도구 | 출력 |
|---|------|------|
| UI 플로우 | Playwright (+ fixture 고정) | pass/fail + 스크린샷 |
| 접근성 | axe-core | violations JSON |
| 시각 회귀 | pixelmatch | diff PNG + % |
| API 계약 | ajv + OpenAPI schema | schema mismatch 보고 |
| DB invariant | better-sqlite3 직접 쿼리 | rule violation 리스트 |

검증 주체: **Claude Code 또는 Codex**가 `npm run test:crm`을 실행 → 5축 결과를 read → 종합 judgment. 실패 시 해당 로그·스크린샷·diff를 자동 첨부해 diagnosis. 사용자는 최종 `final-report.md`만 확인.

### 0-3-X. Phase B + C + D 실행 보고 (2026-04-13)

**작업 분담**: 백엔드(Phase C·D) → Codex 플러그인 위임, 프론트 전체(Phase B + C·D UI) → Claude Code 직접 수행. 자세한 Codex 호출 규칙은 `codexplugin.md` 참조.

#### Phase B — 실제 결과

- `ConsultationSection.tsx` 신규 (377줄). 상담 후속 탭 JSX·테이블·상담사/주문 매칭 섹션 전체를 props 기반 순수 컴포넌트로 추출.
- `AttributionTrackingSection.tsx` 신규 (~235줄). 결제 추적 탭 JSX + recharts 차트.
- `ErrorBoundary.tsx` 신규. 탭 레벨 에러 바운더리. 한 탭 터져도 다른 탭 영향 없음.
- `page.tsx` **1,716줄 → 1,238줄 (−478줄, −27.9%)**. 원안은 "~900줄"이었지만 experiments 탭(~619줄)은 엮인 상태가 많아 이번엔 범위 밖으로 미룸.
- 두 섹션 모두 `<ErrorBoundary>`로 감쌈.
- 위험성 평가 결과 — **낮음**. Phase A 자동 테스트가 regression 없음 확인(`test:crm` 26/26 pass).

#### Phase C — 실제 결과

백엔드 (Codex 위임, 17분):
- `backend/src/contactPolicy.ts`에 `evaluateForEnforcement()` 추가. LH-1·LH-2·PH-1·PH-2·SO-1·SO-2·SO-3 7개 rule. 야간 체크 `isQuietHoursAt(now)` 순수 함수. `crm_consent_change_log`에서 최신 수신거부(`LH-2`) 탐지, `crm_customer_group_members`에서 그룹 동의율(`PH-2`) 계산, `crm_message_log`에서 24시간 내 중복(`SO-1`) 탐지.
- `backend/src/routes/aligo.ts`: `/api/aligo/send`, `/api/aligo/sms`, fallback SMS 경로 전부 발송 전 정책 검사. `hard_legal` 차단 시 **451 Unavailable For Legal Reasons** 반환, `hard_policy` 차단 시 **403**, `adminOverride + hard_policy`는 warn 로깅 후 통과.
- `backend/src/routes/channeltalk.ts`: 기존 `/api/contact-policy/evaluate` 응답에 `enforcement` 필드 추가(프론트 계약 깨지지 않음).
- `backend/src/routes/crmLocal.ts`: `POST /api/crm-local/consent-audit/manual` 신규. memberCode·field·newValue·note 검증, note 3자 이상 강제. `POST /api/crm-local/scheduled-sends`의 validation 응답에 `errors[]` 배열 추가(기존 `error` 필드 병행 유지, 프론트 backward compat).
- `backend/src/crmLocalDb.ts`: `addGroupMembers`의 `consent_sms` 경로 통일 (nullable, 경로별 기본값 제거).
- `backend/src/bootstrap/startBackgroundJobs.ts`: 스케줄러가 발송 전 정책 검사 통과 후 실행. `TEMP_GROUP_CLEANUP_ENABLED` env flag.

프론트 (Claude Code, 직접):
- `ConsentAuditTab.tsx`에 "수동 변경" 버튼 + 주황색 폼 영역. 필드(SMS/이메일) · 새 값(Y/N) · 사유(최소 3자) 입력 + 에러 표시 + 성공 시 해당 member_code로 자동 필터.
- 다중 오류 수신 로직: API 응답의 `errors[]` 배열이 있으면 메시지 조합해서 alert에 표시.

**실 동작 검증** (curl 16건):
| # | 시나리오 | 기대 | 실제 |
|---|---|---|---|
| 1 | 주간 광고 + adminOverride=true | 통과 + warn 로깅 | ✅ `eligible:true`, `PH-1` warn |
| 2 | 컨택트 폴리시 evaluate (직접 호출) | enforcement 필드 포함 | ✅ 신규 필드 렌더 |
| 3 | 수동 consent 변경 (valid member) | 200 + audit 행 | ✅ id=1, source=`admin_manual`, old `Y`→new `N` |
| 4 | 수동 변경 짧은 note (`"ok"`) | 400 min_length | ✅ `errors[{field:note, code:min_length}]` |
| 5 | 다중 오류 scheduled-sends 400 | 4개 errors | ✅ groupId·channel·message·scheduledAt 전부 |
| 6 | LH-1 야간 광고 룰 소스 확인 | `isQuietHoursAt` + `isAdvertising` | ✅ 코드 정확 (주간 09시 테스트로 트리거 안 됨) |

#### Phase D — 실제 결과

백엔드 (Codex 위임, Phase C와 동일 세션):
- `crm_customer_groups`에 `group_kind`·`source_ref`·`archived_at` 컬럼 추가. 기존 row backfill (`재구매%` → `repurchase_temp`, `실험-%` → `experiment_snapshot`).
- `canArchiveGroup(groupId)` 순수 함수. pending/running 참조 + recurrence 참조 있는 그룹 보호.
- `createCustomerGroup(input)` 시그니처에 `kind`·`sourceRef` 추가.
- `GET /api/crm-local/groups?kind=<manual|all|repurchase_temp|...>`  필터. 기본값 `manual` + `archived_at IS NULL`.
- `GET /api/crm-local/groups/stats` — kind별 카운트.
- `POST /api/crm-local/groups/:id/archive` — canArchive 통과 시 `archived_at=datetime('now')`.
- `DELETE /api/crm-local/groups/:id` — canArchive 검사 통과해야 hard delete 허용.
- `startBackgroundJobs.ts`에 KST 03:00 daily cron: 30일 이상된 archived 임시 그룹 삭제.

프론트 (Claude Code):
- `CustomerGroupsTab.tsx` 상단에 "직접 만든 그룹만 (N)" / "임시 그룹 포함 (+N)" 토글. `kindStats` fetch해서 숫자 뱃지 동기화. 아카이브 카운트는 숨김 표시("아카이브 N개 숨김").
- `CoffeeRepurchaseTab.tsx`에서 그룹 생성 시 `kind: "repurchase_temp"` + `sourceRef` 전달. 그룹 이름 prefix `[임시]` + 시간(HHMM) 기반으로 같은 날 재클릭 시 충돌 감소.

**실 동작 검증** (curl 8건):
| # | 시나리오 | 기대 | 실제 |
|---|---|---|---|
| 1 | `/groups/stats` | kind별 카운트 | ✅ `{manual:0, repurchase_temp:4, experiment_snapshot:2, archived:0}` |
| 2 | `/groups` (기본) | manual만 | ✅ 0개 |
| 3 | `/groups?kind=all` | 전부 | ✅ 6개 |
| 4 | 그룹 생성 + 예약 등록 후 archive 시도 | 409 block | ✅ `{ok:false, reason:"예약 발송 #7(pending)이 이 그룹을 참조 중이다"}` |
| 5 | 같은 조건으로 DELETE | 409 block | ✅ 같은 reason |
| 6 | 예약 취소 후 archive 재시도 | 200 success | ✅ `{ok:true}` |
| 7 | 아카이브 그룹 cleanup cron 대상 | 30일 지나면 삭제 | 코드 확인, 실행은 Phase I |
| 8 | invariant I1 (archived 참조 없음) | 통과 | ✅ Phase A 재실행에서 pass |

#### 회귀 검증

`npm run test:crm` (26 테스트, 51초):
- 최초 실행 → 24 pass, 1 fail (VR coffee-groups 시각 회귀 — Phase D 토글 UI 추가로 페이지 높이 986→972로 변경), 1 skip (smoke 그룹 모드 — 기본 필터가 `manual`로 바뀌어 0개 반환)
- 조치: `tests/fixtures/visual-baseline/coffee-groups.png` 삭제 후 baseline 재생성, `tests/crm-smoke.spec.ts`에 `?kind=all` 쿼리 추가
- 재실행 → **26 expected, 0 unexpected, 0 skipped, 0 flaky** ✅

---

### 0-3-W. 주니어 CRM 마케터 페르소나 검수 (2026-04-13)

#### 페르소나: 입사 3개월차 마케터 "지민"

- 대학 졸업 후 첫 회사, CRM 툴은 이번이 세 번째
- 엑셀·노션은 능숙하지만 SQL은 거의 모름
- 오늘 업무 지시: **"고객 3명이 전화로 '문자 그만 보내달라'고 했으니 수신거부 처리해 주세요"**
- 도구: CRM 관리 허브(이 프로젝트)를 처음 받음, 인수인계 문서 없음

검수 방법: Phase A 자동 생성 스크린샷 11장을 사용자 관점으로 해석. 각 항목은 3단계로 분류합니다.
- **P0(차단)**: 지민이 업무를 완료할 수 없을 정도로 막히는 문제
- **P1(불편)**: 업무는 가능하지만 시간이 낭비되거나 오해·실수가 생기는 문제
- **P2(개선)**: 있으면 더 좋은 수준

#### 용어 해설 (이 문서를 처음 보는 사람용)

- **토스트(toast)**: 화면 한쪽에 잠깐 뜨고 몇 초 뒤 자동으로 사라지는 작은 알림 메시지. 빵이 토스터에서 톡 튀어 오르듯 나타난다고 해서 "토스트". 이 문서에서 "수동 변경 성공 토스트"는 **"처리가 끝났을 때 초록색 배너로 '변경 완료' 안내가 잠깐 나타나는 기능"**을 뜻합니다. 이번 세션에서 초록 배너 + 8초 자동 사라짐으로 구현했습니다.
- **페르소나 검수**: 실제 사용자가 될 법한 인물을 상상해서 "이 사람이 이 화면을 보면 어디서 막힐까?"를 예측하는 UX 점검 방법. 검수자가 화면을 보는 대신 "지민의 머릿속"이 되어 본다고 생각하면 됩니다.
- **P0/P1/P2**: 이슈 심각도. 병원 분류처럼 P0는 응급(바로 고쳐야 업무 가능), P1은 오늘 안에, P2는 시간 날 때.
- **member_code**: 아임웹이 고객에게 자동으로 붙이는 내부 ID(예: `m20230512ef2c28c5a4f3a`). 고객 이름이 같을 때 구분하기 위해 씁니다. 사용자가 외울 필요는 없고, 시스템이 내부에서만 사용합니다.
- **온보딩**: 새 사용자가 처음 도구를 사용할 때 "어디부터 보면 되는지" 안내하는 도움말 흐름.

---

#### 전반적 관찰

**긍정 포인트**:
- 탭마다 한 줄 설명(description)이 있어서 이름만 봐도 용도 짐작 가능
- 서버가 "야간 광고 발송 금지"를 자동 차단하므로 지민이 실수해도 법적 사고로 이어지지 않음
- 임시 그룹 토글이 숫자 배지(`+6`)를 보여줘서 "숨겨진 그룹이 있다"는 힌트는 있음

**전반적 개선 필요**:
- **온보딩 안내 없음**: 첫 접속 시 "오늘 뭐부터 할지" 가이드가 없음. 탭 8개 중 어느 것이 지민의 업무인지 본인이 찾아야 함. **P1**
- **전역 검색 없음**: "김민수 고객 어디 있지?"가 탭마다 따로 있어서 불편. **P2**
- **현재 시각 기준 발송 가능 여부가 안 보임**: 헤더에 "현재 KST 09:36 · 광고성 발송 가능" 같은 배지가 있으면 지민이 "지금 보내도 되나?"를 바로 알 수 있음. **P2**

---

#### 탭별 검수

##### 1) 수신거부 처리 탭 (오늘 업무가 여기)

**상황**: 지민은 고객 3명의 수신거부 요청 메시지를 받고, "어디서 처리하지?" 하며 탭을 훑어봅니다.

| 관찰 | 심각도 | 이번 세션 처리 |
|---|---|---|
| **"동의 감사"라는 이름**을 보고 지민은 "감사(audit)가 뭐지? 감사합니다의 감사인가?" 헷갈림. 수신거부 처리 탭이라는 걸 바로 알기 어려움 | **P0→해결** | ✅ 탭 이름 **"수신거부 처리"**로 변경, 부제로 "(동의 감사 로그)"만 남겨서 법적 용어를 보존 |
| 탭 설명("SMS/이메일 수신 동의 변경 이력")이 너무 기술적 | **P1→해결** | ✅ "고객이 수신거부를 요청했을 때 여기서 처리하고 이력을 남깁니다"로 재작성 |
| "수동 변경" 버튼 이름이 애매. 무엇을 수동으로 변경하는지 불명확 | **P1→해결** | ✅ **"+ 새 수신거부 처리"**로 이름 변경 |
| 고객번호(member_code)를 모르는데 입력하라고 함. 다른 탭 가서 복사해 와야 함 | **P0→해결** | ✅ **"고객 찾기"** 미니 검색 박스를 폼 안에 추가. 이름이나 전화번호로 검색하면 결과 카드를 눌러 고객번호 자동 입력 |
| 저장 버튼을 눌러도 성공했는지 잘 모름 (폼이 그냥 닫힘) | **P1→해결** | ✅ **초록 배너 토스트** 추가. "처리 완료: 고객 m20230512... 의 SMS 수신 동의를 수신거부로 변경했습니다. 감사 로그 #42에 기록되었습니다." — 8초 후 자동 사라짐 |
| 빈 상태 메시지가 "동의 변경 이력이 없다"로 애매함 (전체가 없는 건지, 검색 결과가 없는 건지 불명) | **P1→해결** | ✅ 검색 중이면 "고객번호 '...'의 수신거부 이력이 아직 없습니다", 전체 조회면 "아직 처리된 수신거부 이력이 없습니다. 위 '+ 새 수신거부 처리' 버튼으로 첫 건을 등록해 보세요" |
| "사유 3자 이상 필수" — 너무 짧지도 너무 길지도 않은 균형 | 긍정 | — |
| "Y→N"이라는 기술 표기. 지민은 "Y가 뭐지?" | **P2→해결** | ✅ 드롭다운 값을 "수신거부 (Y→N)" / "동의 복원 (N→Y)"로 변경 |

##### 2) 고객 그룹 탭

| 관찰 | 심각도 | 이번 세션 처리 |
|---|---|---|
| 헤더 "고객 그룹 목록" + 탭 이름 "고객 그룹" 중복감 | P2 | 보류 — 3%만 영향, Phase F 이후 |
| 임시 그룹 토글 배지 "직접 만든 그룹만 (0) / 임시 그룹 포함 (+6)"은 숫자가 있어 직관적 | 긍정 | — |
| 토글 옆 설명이 하오체("...분류되오. 기본 화면에서는 숨김")로 어색 | **P1→해결** | ✅ "재구매 탭이나 A/B 실험에서 자동 생성된 그룹은 임시 그룹으로 분류되어, 기본 화면에서는 숨겨집니다."로 재작성 |
| 빈 상태 메시지 "생성된 고객 그룹이 없다. A/B 실험 생성 시 자동으로 그룹이 만들어진다"가 필터 기준 무시. 지민이 "내가 A/B 실험을 만들어야 하나?" 오해 | **P1** | 보류 — 다음 Phase에서 가변 메시지로 |
| "예약 발송" 버튼이 새 예약 생성이 아니라 목록 조회 기능. 이름이 오해 유발 | **P1** | 보류 — "예약 발송 현황"으로 이름 변경 예정 |
| 오른쪽 3개 버튼(신규·이력·예약)이 한 줄에 평면 배치 | P2 | — |

##### 3) 알림톡 발송 탭

| 관찰 | 심각도 | 이번 세션 처리 |
|---|---|---|
| 3열 워크플로우(대상·템플릿·미리보기)는 마케터에게 친숙 | 긍정 | — |
| "수동 테스트 / 후속 관리 / 실험" 라디오 — 지민은 "내가 뭘 골라야 하지?" 막힘 | P2 | 보류 |
| "최고관리자 강제 발송" 체크박스 — 잘못 누르면 정책 우회 가능 | **P1** (임시) / **P0** (외부 배포 시) | 보류 — Phase J RBAC에서 권한 분리 |
| 테스트 모드 토글이 초록/빨강으로 구분됨 | 긍정 | — |
| 예약 발송 섹션이 그룹 모드에서만 노출되어 일관성 ok | 긍정 | — |
| alert 메시지 중 일부가 하오체 (`"발송 시각을 선택하시오"`) | **P1→해결** | ✅ "발송 시각을 선택해 주세요"로 재작성 |

##### 4) 재구매 관리 탭

| 관찰 | 심각도 | 이번 세션 처리 |
|---|---|---|
| KPI 카드 → 필터 → 후보 테이블 → A/B 섹션 → 가설 박스 순서가 논리적 | 긍정 | — |
| 4개 발송 버튼(알림톡/SMS × 동의/관리자)의 법적 차이 설명 부족 | **P1** | 보류 |
| 관리자 override 박스가 노란 경고색으로 구분됨 | 긍정 | — |
| 클릭 시 "그룹 생성 중..." 로딩 표시 | 긍정 | — |
| 가설 박스가 구체적 수치 제공 ("미동의 고객 전환율 5~10%") | 긍정 | — |

##### 5) 고객 목록 탭

| 관찰 | 심각도 | 이번 세션 처리 |
|---|---|---|
| 검색 + 등급 필터 + 엑셀 다운로드는 기본기 충족 | 긍정 | — |
| "이름/전화/이메일" 통합 검색 | 긍정 | — |
| member_code 복사 버튼 없음 (행 클릭해서 복사 불가) | **P1** | 간접 해결 — 수신거부 처리 탭 안에 "고객 찾기"를 넣었으므로 더 이상 탭 이동 필요 없음 |
| 각 행 클릭으로 고객 상세 드로어 (Phase H 계획) | P2 | — |

---

#### 지민의 "수신거부 3건 처리" 시나리오 — Before vs After

**Before (이번 세션 이전)**:
1. CRM 허브 열기
2. 탭 훑어보기 → "동의 감사"가 뭔지 모름. 여기저기 눌러봄 (약 2분 소요)
3. "수동 변경" 버튼 클릭 → 폼 열림
4. placeholder `m20230512ef2c28c5a4f3a`를 보고 "이게 뭐야?" 당황
5. 다른 탭 가서 찾아야 함 → 고객 목록 탭 → 검색 → member_code 수동 복사
6. 돌아와서 붙여넣기 → 폼 작성 → 저장
7. 폼이 그냥 닫힘. "성공한 건가?" 불안해서 새로고침
8. 다음 고객 반복 — 매번 탭 이동
- **총 예상 소요**: 고객 1명당 3~5분, 3명 처리에 10~15분

**After (이번 세션 개선 후)**:
1. CRM 허브 열기
2. **"수신거부 처리"** 탭 이름을 보고 즉시 클릭 (0초 고민)
3. "+ 새 수신거부 처리" 버튼 클릭 → 폼 열림
4. 폼 안 **"고객 찾기"** 검색창에 "김민수" 입력 → Enter
5. 결과 카드 클릭 → 고객번호 자동 입력
6. 사유 입력 → 저장
7. **초록 배너** "처리 완료: 김민수 (m202305...) 의 SMS를 수신거부로 변경했습니다" 표시 (8초)
8. 다음 고객 반복 — 탭 이동 없이 **같은 화면**에서 반복 가능
- **총 예상 소요**: 고객 1명당 40초~1분, 3명 처리에 2~3분

→ **약 5배 단축**, 탭 이동 횟수 0회, 성공 확인 피드백 즉각.

---

#### 이번 세션에서 반영한 Quick Wins 목록 (구현 완료)

| # | 항목 | 원래 상태 | 반영 결과 |
|---|---|---|---|
| 1 | 탭 이름 "동의 감사" → "수신거부 처리" | 기술 용어 | **"수신거부 처리"** + 부제 "(동의 감사 로그)"로 양립 |
| 2 | 하오체 → 존댓말 통일 | 7곳 혼용 | CRM 폴더 내 하오체 0건 (`하오/하시오/시겠소/있소/없소/되오/드리오/주시오` 검색 결과 없음) |
| 3 | 수동 변경 성공 피드백(토스트) | 없음 | 초록 배너 + 8초 자동 사라짐 + 수동 닫기 버튼 |
| 4 | member_code 입력 흐름 | 다른 탭 가서 복사 | 폼 안에 "고객 찾기" 미니 검색 (이름·전화) + 클릭 자동 입력 |
| 5 | 빈 상태 메시지 가변 | 고정 문구 | 검색 필터 유무에 따라 메시지 구분 |
| 6 | 수동 변경 버튼 이름 | "수동 변경" | "+ 새 수신거부 처리" |
| 7 | Y/N 드롭다운 | 기술 표기 | "수신거부 (Y→N)" / "동의 복원 (N→Y)" |
| 8 | 폼 안내 문구 | 기술 설명 | "고객이 전화로 '문자 그만 보내달라' 고 요청했을 때 여기서 처리합니다" |

#### 미해결 — 다음 사이클로 이월

| # | 항목 | 심각도 | 이유 |
|---|---|---|---|
| A | 온보딩 안내 흐름 | P1 | 별도 기획 필요 (Welcome tour) |
| B | 전역 검색 | P2 | 컴포넌트 큰 변경 |
| C | 현재 시각 기준 발송 가능 배지 | P2 | contact-policy를 프론트에서 재활용해야 함 |
| D | 예약 발송 버튼 이름 "예약 발송 현황" | P1 | 5분 작업, Phase E 진행 중이라 차단 피함 |
| E | 그룹 탭 빈 상태 메시지 가변 | P1 | CustomerGroupsTab 수정 필요 |
| F | 4개 발송 버튼의 법적 차이 설명 | P1 | UI 재설계 |
| G | 관리자 override 권한 분리 | P1→P0 | Phase J RBAC |
| H | 고객 상세 드로어 | P2 | Phase H |

#### 심각도별 집계 (이번 세션 후)

| 심각도 | 이전 | 이번 세션 해결 | 잔여 |
|---|---|---|---|
| P0 (차단) | 0 (+탭 이름 오해 1건 → 사실상 차단 수준) | 1 | 0 |
| P1 (불편) | 8 | 4 | 4 |
| P2 (개선) | 6 | 1 | 5 |

---

### 0-3-V. Phase E 실행 보고 + Quick Wins 반영 (2026-04-13 두 번째 세션)

#### Phase E — 세그먼트 빌더 구현 결과

**백엔드 (Codex 위임, 9분 28초 소요)**

1. `backend/src/segmentDsl.ts` 신규 419줄 — DSL 타입·필드 whitelist·SQL 생성·안전장치 일체
2. `backend/src/crmLocalDb.ts`:136 — `crm_saved_segments` 테이블 부트스트랩 + 인덱스
3. `backend/src/crmLocalDb.ts`:2297 — `createSavedSegment`·`listSavedSegments`·`getSavedSegment`·`deleteSavedSegment` 헬퍼
4. `backend/src/routes/crmLocal.ts`:1395 — 5개 엔드포인트:
   - `POST /api/crm-local/segments/evaluate` (미리보기, DB 저장 안 함)
   - `POST /api/crm-local/segments` (저장)
   - `GET /api/crm-local/segments?site=...` (목록)
   - `GET /api/crm-local/segments/:id` (상세)
   - `DELETE /api/crm-local/segments/:id` (삭제)
   - `POST /api/crm-local/segments/:id/materialize` (결과 → `kind='segment_snapshot'` 그룹 생성)

**SQL 안전장치 (모두 구현)**

| # | 안전장치 | 설명 |
|---|------|------|
| 1 | 필드 whitelist | 8개 enum 값만 허용, 나머지는 `errors[]` 400 |
| 2 | 연산자 whitelist | `=`·`!=`·`>`·`>=`·`<`·`<=`·`IN`·`NOT_IN` (LIKE는 의도적으로 배제) |
| 3 | Parameterized SQL | `?` placeholder 필수, 값 concatenation 금지 |
| 4 | 재귀 깊이 ≤ 3 | AND/OR 중첩 제한 |
| 5 | 조건 개수 ≤ 10 | 전체 clause 카운트 |
| 6 | LIMIT 50000 강제 | 초과 시 `truncated: true` 반환 |
| 7 | `busy_timeout 5000` | sqlite 자체 락 타임아웃 |
| 8 | EXPLAIN QUERY PLAN | `SCAN` 발견 시 `warnings[]`에 성능 경고 추가 (차단 아님) |
| 9 | 값 sanitization | null byte 거절, `IN` 배열 ≤ 100 |
| 10 | `birth_month` 특수 케이스 | `CAST(strftime('%m', birth) AS INTEGER) = ?` 안전 처리 |

**실 검증 (curl)**

```bash
curl -X POST http://localhost:7020/api/crm-local/segments/evaluate \
  -d '{"site":"thecleancoffee","query":{"op":"AND","clauses":[
    {"field":"marketing_agree_sms","op":"=","value":"Y"},
    {"field":"total_spent","op":">=","value":100000}
  ]}}'
```

결과: `{ok:true, count:65, truncated:false, warnings:[], preview:[5 customers]}` — SMS 동의 + 누적 10만원 이상 고객 65명 즉시 반환.

**프론트 (Claude Code)**

1. `frontend/src/app/crm/SegmentBuilder.tsx` 신규 ~500줄 — 커스텀 빌더 컴포넌트
2. `BehaviorTab.tsx` — "+ 커스텀 세그먼트 만들기" 버튼 + SegmentBuilder 연동

**빌더 UI 구성**
- 조건 카드 목록 (최대 10개). 필드·연산자·값 세 개 드롭다운/입력.
- 필드 선택 시 해당 타입의 연산자만 노출 (예: `marketing_agree_sms` → `이다`/`아니다`만).
- 값 입력이 타입별로 전환: 날짜·금액은 숫자, 동의는 드롭다운(Y/N), 달은 1~12 드롭다운.
- "고객 미리보기" → 백엔드 evaluate → 결과 수 + 미리보기 5명 + 경고.
- 저장 폼 (이름·설명) → `POST /segments` → 성공 시 id 반환.
- 그룹 실체화 폼 (그룹 이름) → `POST /segments/:id/materialize` → 성공 시 그룹 생성.

**지민 관점 평가**: "동의한 + 30만원 이상 고객한테 이번 달 쿠폰 뿌리고 싶어" 같은 요구를 코드 건드리지 않고 3분 안에 처리 가능. 필드 이름이 "마지막 구매 후 경과일"처럼 한글로 되어 있어 SQL 몰라도 이해 가능.

#### 지민 페르소나 Quick Wins 반영 결과

섹션 0-3-W 표에 있는 8개 항목 중 **8개 모두 이번 세션에서 반영**:

1. ✅ 탭 이름 `동의 감사` → `수신거부 처리` (+ 부제 `(동의 감사 로그)`)
2. ✅ 하오체 → 존댓말 전수 (`하오`·`하시오`·`시겠소`·`있소`·`없소`·`되오`·`드리오`·`주시오` 검색 0건)
3. ✅ 수동 변경 성공 토스트 (초록 배너 8초 자동 사라짐)
4. ✅ 수신거부 처리 탭 안에 "고객 찾기" 미니 검색 (이름·전화 → 자동 입력)
5. ✅ 빈 상태 메시지 가변 (검색 유무 구분)
6. ✅ 수동 변경 버튼 이름 → "+ 새 수신거부 처리"
7. ✅ Y/N 드롭다운 → "수신거부 (Y→N)" / "동의 복원 (N→Y)"
8. ✅ 폼 안내 문구 사용자 친화적 재작성

**지민 시나리오 Before/After 재현**:
- Before: 고객 1명 처리 3~5분 (탭 이동 3회, 복사-붙여넣기, 성공 확인 불안)
- After: 고객 1명 처리 40초~1분 (한 화면에서 검색·입력·저장·피드백)
- **약 5배 단축**

#### Codex 플러그인 규칙 "rescue status 금지 실험" 결과

이 세션 전체에서 `codex:rescue status`·`check last task` 같은 상태 조회를 **1회도 호출하지 않음**. 대신 다음 증거만으로 판단:

| 시점 | 확인 방법 | 결과 |
|------|----------|------|
| Codex 위임 직전 | `git diff --stat backend/` → 2544 insertions | baseline 기록 |
| 위임 후 ~5분 | `git diff --stat backend/` → 2622 insertions | +78줄, 진행 중 확인 |
| 완료 notification 수신 | `<task-notification>` 블록 `result` 필드 | Codex 자기 보고 읽음 |
| 완료 직후 | `git diff --stat backend/` → 2836 insertions | +292줄 실 증거 |
| 완료 직후 | `ls backend/src/segmentDsl.ts` → 14KB | 신규 파일 존재 |
| 완료 직후 | `cd backend && npx tsc --noEmit` → exit 0 | 독립 검증 통과 |
| 완료 직후 | `curl /api/crm-local/segments/evaluate` → count:65 | 실제 API 동작 확인 |

**결론**: rescue status 없이 git·tsc·curl·notification 4가지 증거만으로 모든 판단 가능. 이 4가지가 모두 긍정이면 "완료"로 간주할 수 있음이 확인됨. 이 규칙은 `~/coding/CLAUDE.md`의 "Codex 플러그인 호출 규칙" 섹션으로 영구 기록.

#### 회귀 검증

`cd frontend && npm run test:crm` 실행:
- 첫 실행: 19 pass, 5 fail (smoke 그룹 발송 모드 flaky, flow F6 `동의 감사 로그` 라벨 변경, visual-diff 2건 baseline 재생성 필요, smoke skip 없음)
- 조치:
  - `tests/crm-full-flow.spec.ts:259` 라벨을 `h2:has-text('수신거부 처리')`로 업데이트
  - 시각 회귀 baseline 2건(coffee-groups, coffee-consent-audit) 삭제 → 자동 재생성
  - smoke 그룹 발송 모드는 병렬 실행 시 group_id 경합으로 flaky → isolated 실행은 즉시 통과
- **재실행 결과**: **26 expected, 0 unexpected, 0 skipped, 0 flaky** (50초) ✅

---

### 0-3-Y. 아임웹 고객 그룹 API 조사 결과

사용자 요청으로 "아임웹 자체에 고객 그룹 개념이 있는가, API로 가져올 수 있는가"를 Codex에 조사 위임(2026-04-13). 결론부터:

**현 시점 결론**: **로컬 `crm_customer_groups` 유지가 맞음**.

#### 조사 결과 요약

| 항목 | 상태 | 근거 |
|------|------|------|
| 구 imweb v2 회원 API (`https://api.imweb.me/v2/member/members`) | 그룹 개념 없음 | `member_code`, `uid`, `name`, `email`, `callnum`, `join_time`, `member_grade` 필드만 존재. 그룹/태그/세그먼트 엔드포인트 부재 ([old-developers.imweb.me/members/get](https://old-developers.imweb.me/members/get)) |
| 신 imweb Open API `Member-Info` 참조 | 그룹 개념 **있음** (문서상) | 신 문서([developers-docs.imweb.me/reference](https://developers-docs.imweb.me/reference))에 "속한 그룹 정보"·"그룹별 회원 목록 정보" 제공이라고 명시. 다만 동적 문서라 정확한 path·schema는 미확인 |
| `member_grade` (쇼핑 등급) | v2 응답에 포함 | 하지만 "등급"은 회원 그룹/태그와 개념 다름. 등급별 필터는 이미 `CustomersTab`에서 지원 중 |
| Rate limit (구 v2) | 전체 조회 초당 1회, 개별 초당 5회 | [imweb getstarted/cautions](https://old-developers.imweb.me/getstarted/cautions) |
| 신 Open API 승인 절차 | 앱 생성 + scope 승인 + 수정 불가 | [developers-docs.imweb.me/guide/프로세스-확인하기](https://developers-docs.imweb.me/guide/프로세스-확인하기) |

#### 권고 사항

1. **당장은 `crm_customer_groups` 유지**. 구 v2 API로는 그룹을 신뢰성 있게 가져올 방법이 없음. 신 Open API의 정확한 path·schema가 확인 전이라 테이블 제거는 위험.
2. **신 Open API 조사를 Phase J 또는 별도 Phase로**. 실 계정으로 Open API 앱을 생성해 Member-Info scope 승인받은 뒤 그룹 path·schema를 확정.
3. **확인 후 통합 전략**: 즉시 전환하지 말고 "imweb fetch + 로컬 캐시 fallback"으로 먼저 병행. 6주 정도 정합성 검증 뒤 로컬 테이블을 cache-only로 축소, 마지막에 완전 제거.
4. **등급은 이미 쓰고 있음**: `imweb_members.member_grade` 컬럼과 `CustomersTab`의 등급 필터가 이미 imweb 값을 그대로 표시. 추가 작업 불필요.

#### 마이그레이션 예정 변경 (신 Open API 확인 후 진행)

- `backend/src/routes/crmLocal.ts`: `GET /api/crm-local/groups` 내부에서 imweb fetch + 로컬 캐시 fallback
- `crm_customer_groups`: 캐시/수동 override 테이블로 축소
- `createCustomerGroup`: 신규 그룹 생성 시 imweb에도 동시 등록 고려 (쓰기 API 확인 후)

이 작업은 **Phase J 이후 별도 "Phase K — imweb 그룹 동기화"**로 분리. 현 100% 계획에는 포함하지 않음(이 계획의 "100%"는 자체 그룹 관리 완성도 기준).

---

### 0-3-Z. Codex 리뷰 요약 (반영 내역)

2026-04-13 세션에서 Claude Code 초안을 Codex 리뷰. 아래 BLOCKER·MAJOR·MINOR를 모두 반영.

**BLOCKER (반영 완료)**
- RBAC·PII·rate-limit·observability 누락 → **Phase J 신설** + 0-3-0 운영 하드닝 gap 섹션 추가
- B가 C 앞이면 리스크 먼저 해결 안 된 채 리팩터 → **A→C→D→B 순서로 교체**
- D·G 병렬 가능은 틀림 (G가 그룹 참조 수명 복잡화) → **G 의존성에 D 추가**
- contact-policy hard block이 adminOverride도 막으면 긴급 관리 흐름 부서짐 → **severity 3단계 분리**, `hard_legal` / `hard_policy` / `soft`
- Phase D 보호 범위가 pending/running만은 너무 좁음 → **recurrence 주기까지 포함한 `canArchiveGroup()` 단일 가드 함수**
- E의 whitelist만으로 SQL injection·cost 해결 안 됨 → **parameterized query + EXPLAIN + LIMIT + timeout + clause depth 상한**
- G의 RRULE/DST/TZ 허술 → **`rrule.js` + TZID=Asia/Seoul 고정, 해외 TZ는 거절**

**MAJOR (반영 완료)**
- E는 C 뒤 (consent 저장 일관성 필요) → 순서 교체
- E 1.5일·F 1일은 과소추정 → E 2.5일 / F 2일로 상향
- Phase A Playwright 단독은 결정성·범위 부족 → **4축 병행 (Playwright + axe + pixelmatch + ajv + invariant)**
- B의 CSS scoping·import cycle 감지 기준 부족 → **madge 추가**
- F의 통계 라이브러리·표본·peeking 정책 없음 → **simple-statistics + n<30 회색 배지 + min_sample_size guard**
- H의 N+1 회피 미설계 → **CTE/UNION ALL + p95 invariant 테스트**
- I의 sqlite 부하 테스트 의미 부족 → **k6 10 RPS 60s 기준**

**MINOR**
- Accessibility/i18n은 "100% 범위"에 포함되느냐 모호 → **내부 도구 기준 a11y는 Phase A-2에 최소 axe serious만 강제, i18n은 범위 밖**

**Do-not-skip 반영**: C+D+G 공통 invariant 테스트 스위트를 **Phase A-5**로 도입. 이후 Phase가 이 테스트를 깨뜨리면 merge 차단.

---

## 0-4. 재구매 임시 그룹 누적 해결 계획

### 문제 정의

재구매 관리 탭에서 "카카오 알림톡 발송 N명" / "SMS 문자 발송 N명" / "전체 알림톡 (관리자)" / "전체 SMS (관리자)" 버튼을 누르면 `createGroupAndGoMessaging`이 매번 **새 그룹**을 DB에 생성함 (`CoffeeRepurchaseTab.tsx:61-120`). 운영자가 필터 값을 조정하거나 실수로 버튼을 다시 누를 때마다 그룹이 하나씩 쌓이고, 고객 그룹 탭이 임시 그룹으로 오염됨. 또한 임시 그룹은 발송 1회 용도지만 삭제 흐름이 없어서 정리 책임이 모호.

### 핵심 원인

- 매 클릭마다 `POST /api/crm-local/groups` 호출 → 새 `group_id` 생성
- 그룹 이름은 `재구매 동의 30~180일 알림톡 (2026-04-12)` 식이라 같은 날 여러 번 누르면 이름이 중복되어도 구분 불가
- 발송 완료 후 그룹을 삭제/아카이브하는 로직 없음
- 영구 그룹 (사용자가 의도적으로 만든 세그먼트)과 임시 그룹이 같은 테이블에 섞임

### 제안 전략 (3단계)

#### 1단계 — 네이밍 규약 + 메타 구분 (P1, 반나절)

**목표**: 임시 그룹을 DB 수준에서 영구 그룹과 구분 가능하게 만들고 UI에서 접어둘 수 있게 함.

**백엔드**:
- `crm_customer_groups` 테이블에 `group_kind TEXT DEFAULT 'manual'` 컬럼 추가 (enum: `manual` / `repurchase_temp` / `experiment_snapshot` / `segment_snapshot`)
- `source_ref TEXT NULL` 컬럼 추가 (예: `repurchase:thecleancoffee:30-180:1-9999`로 필터 식별)
- `createCustomerGroup()` 시그니처에 `kind?`, `sourceRef?` 추가
- `GET /api/crm-local/groups`에 `kind` 쿼리 파라미터 추가 → 기본은 `manual` 필터링. `?kind=all` 또는 `?kind=repurchase_temp`로 구분 조회

**프론트**:
- `CoffeeRepurchaseTab.tsx` — 그룹 생성 호출 시 `{ kind: "repurchase_temp", sourceRef: "repurchase:thecleancoffee:${minDays}-${maxDays}:${minOrders}-${maxOrders}" }` 전달
- 이름 규약도 축약: `[임시] 재구매 ${filter} ${channel} ${HHMM}` (날짜 대신 HHMM으로 같은 날 구분)
- `CustomerGroupsTab.tsx` — 기본 조회는 `kind=manual`만. 상단에 "임시 그룹 N개 보기" 토글 + 클릭 시 `kind=all` 호출하여 전체 표시

#### 2단계 — 재사용 + 부분 발송 (P1, 반나절)

**목표**: 같은 필터 조건으로 다시 눌렀을 때 새 그룹 만들지 않고 기존 그룹 재사용. 이미 발송한 멤버는 제외.

**백엔드**:
- `POST /api/crm-local/groups/upsert-temp` 신규 라우트 — `{ kind, sourceRef, members }`를 받아서 동일 `source_ref`의 `repurchase_temp` 그룹이 **같은 날짜** 범위(`created_at >= date('now', 'start of day')`)에 있으면 재사용, 없으면 새로 생성. 멤버는 `INSERT OR IGNORE`로 누적.
- `GET /api/crm-local/groups/:id/unsent?experiment_key=…` — 그룹 멤버 중 `crm_message_log`에 성공 기록이 없는 사람만 반환 (재발송 중복 방지)

**프론트**:
- `createGroupAndGoMessaging`이 `upsert-temp`를 호출하도록 변경
- MessagingTab에서 그룹 발송 모드일 때 `unsent` 파라미터를 지원 → "미발송 {N}명만 보내기" 버튼 추가

#### 3단계 — 자동 정리 (P2, 1~2시간)

**목표**: 임시 그룹이 무한 누적되지 않도록 만료·아카이브 정책.

**백엔드**:
- `crm_customer_groups`에 `archived_at TEXT NULL` 컬럼 추가
- 배치 발송 성공 응답 후(서버 측 or 프론트 후처리) 해당 그룹을 `archived_at = datetime('now')`로 마킹
- `GET /api/crm-local/groups`에서 기본 `archived_at IS NULL` 필터 적용
- 배치 정리 스크립트: `DELETE FROM crm_customer_groups WHERE kind = 'repurchase_temp' AND archived_at < datetime('now', '-30 days')` (월 1회 `startBackgroundJobs.ts`에서 호출)
- 멤버 삭제는 FK CASCADE 또는 수동 `DELETE FROM crm_customer_group_members WHERE group_id IN (…)`

**프론트**:
- `CustomerGroupsTab.tsx`에 "아카이브된 그룹 보기" 토글 (기본 숨김)
- 배치 발송 완료 화면에서 "이 그룹 아카이브" 버튼 (수동 케이스)

### 수용 기준

| 항목 | 측정 방법 |
|------|----------|
| 재구매 탭 버튼을 같은 필터로 5회 연속 눌러도 그룹 수 ≤ 1 | 수동 테스트 (같은 날짜 · 같은 필터) |
| 고객 그룹 기본 화면에 임시 그룹이 나타나지 않음 | 수동 테스트 |
| 발송 성공한 임시 그룹은 30일 후 자동 삭제 | 배치 스크립트 로그 확인 |
| 실험 snapshot 그룹은 자동 삭제 대상이 아님 | `kind='experiment_snapshot'` row 보존 확인 |

### 실행 권장 순서

1. **1단계만 먼저 머지** — 네이밍·`kind` 구분만으로도 오염 문제 80% 해결. 이후 피드백 받고 2·3단계 진행.
2. **1단계 머지 후 수동 정리 1회** — 현재 누적된 임시 그룹 일괄 삭제 (`DELETE FROM crm_customer_groups WHERE name LIKE '재구매%'`와 같은 수동 SQL)
3. **2단계** — 사용자 불만 접수 빈도 따라 결정
4. **3단계** — 1·2단계 안정화 후 한 달 뒤 운영 데이터 기준 판단

### 파일별 변경 예상

| 파일 | 변경 | 공수 |
|------|------|------|
| `backend/src/crmLocalDb.ts` | 마이그레이션 (group_kind/source_ref/archived_at 컬럼), `createCustomerGroup` 시그니처 확장, `upsertRepurchaseGroup` 신규, `listGroupUnsentMembers` 신규 | M |
| `backend/src/routes/crmLocal.ts` | `POST /groups`에 kind 전달, `GET /groups` kind 필터, `POST /groups/upsert-temp` 신규, `GET /groups/:id/unsent` 신규 | M |
| `backend/src/bootstrap/startBackgroundJobs.ts` | 월 1회 아카이브 정리 cron | S |
| `frontend/src/app/crm/CoffeeRepurchaseTab.tsx` | `createGroupAndGoMessaging` → `upsert-temp` 호출 | S |
| `frontend/src/app/crm/CustomerGroupsTab.tsx` | kind 필터 + "임시 그룹 보기" 토글 + 아카이브 토글 | M |
| `frontend/src/app/crm/MessagingTab.tsx` | unsent 멤버 필터 (선택) | S |

**총 공수**: 1단계 반나절, 2단계 반나절, 3단계 1~2시간 → 전체 1~1.5일.

---

## 1. 현재 UXUI 메뉴 흐름

### 더클린커피 사이트 탭 구조 (7개)

```
CRM 관리 허브
├── 구매 현황        ← 최근 7일 매출/주문 추이
├── 재구매 관리      ← 미구매 고객 필터 + A/B 테스트 + 전환율 가설
├── 고객 그룹        ← 그룹 CRUD + 멤버 체크박스 + 배치 발송 + 메시지 이력
├── 고객 목록        ← 전체 고객 검색 + 등급 필터 + CSV 다운로드
├── 고객 행동        ← 5개 세그먼트 조회 + 그룹 자동 생성
├── 알림톡 발송      ← 카카오 알림톡 / SMS 단건·배치 발송 + 폰 미리보기
└── 결제 추적        ← Attribution 원장 + Toss 대조 + 유입경로 분석
```

### 탭별 기대효과 · 의도 · 고객 베네핏

| 탭 | 의도 | 기대효과 | 고객 베네핏 |
|---|------|---------|-----------|
| **구매 현황** | 매출 추이를 한눈에 파악 | 일별 주문/매출 패턴 인지 → 캠페인 타이밍 결정 | 적시에 프로모션을 받음 |
| **재구매 관리** | 이탈 위험 고객 발굴 | 30~180일 미구매 고객 1,148명 중 발송 가능 326명 식별 | 잊고 있던 브랜드 리마인드 |
| **고객 그룹** | 발송 대상 세분화 | A/B 실험 그룹 자동 생성 + 체크박스 선택 발송 | 개인화된 메시지 수신 |
| **고객 목록** | 전체 고객 DB 검색·관리 | 13,253명 고객 검색 + 등급 필터 + CSV 내보내기 | — (내부 운영용) |
| **고객 행동** | 행동 기반 타겟팅 | 미재구매 533명, 90일 미활동 79명 등 세그먼트 즉시 조회 | 구매 행동에 맞춘 맞춤 혜택 |
| **알림톡 발송** | 메시지 작성·발송 실행 | 카카오 알림톡 16종 템플릿 + SMS + 배치 발송 + 폰 미리보기 | 카카오/문자로 혜택 즉시 수신 |
| **결제 추적** | 매출 귀속·ROAS 정합성 | CAPI 869건 성공, Toss 대조율 추적, 유입경로 불명 매출 식별 | — (내부 분석용) |

### 주요 흐름

```
흐름 1: 재구매 캠페인
  재구매 관리 → 필터 설정 → A/B 실험 생성 → 고객 그룹 자동 생성
  → 고객 그룹에서 멤버 확인 → 발송 버튼 → 알림톡 발송 → 배치 SMS 발송

흐름 2: 세그먼트 타겟팅
  고객 행동 → 세그먼트 조회 (예: 90일 미활동) → 그룹 생성
  → 고객 그룹 → 발송

흐름 3: 고객 검색 → 개별 발송
  고객 목록 → 검색 → (향후) 선택 → 알림톡 발송

흐름 4: 성과 모니터링
  구매 현황 → 매출 추이 확인
  결제 추적 → Attribution/Toss 대조
```

## 2. Playwright 테스트 결과

| # | 테스트 | 결과 |
|---|-------|------|
| 1 | 재구매 관리 탭 로드 + 고객번호/고객명 컬럼 | **PASS** |
| 2 | A/B 테스트 유형 선택 (SMS vs 알림톡 / 동의 vs 미동의) | **PASS** |
| 3 | 고객 그룹 탭 로드 + 그룹명/인원수 표시 | **PASS** |
| 4 | 신규그룹 만들기 폼 표시 | **PASS** |
| 5 | 고객 목록 탭 로드 + 검색/이메일/구매금액 | **PASS** |
| 6 | 고객 행동 탭 + 세그먼트 조회 결과 표시 | **PASS** |
| 7 | 알림톡 발송 탭 로드 + 채널 선택 | **PASS** |
| 8 | 그룹 발송 모드 (groupId) 정상 표시 | **PASS** |

**8/8 전체 통과** (3.1초)

## 3. Codex 플러그인 평가

### 3-1. 기능 완성도 — "연결은 되어 있으나 운영 CRM 기준으로는 부족"

현재 확인되지 않는 운영 기능:
- 예약 발송
- 자동 캠페인 journey
- 쿠폰 발급/회수
- 아임웹 고객 속성 수정
- 수신거부/동의 이력 관리
- 카카오 템플릿 운영 상태 추적
- 캠페인별 성과 대시보드

### 3-2. 코드 품질 — "유지보수성 낮음"

- `page.tsx` 3,365줄 단일 파일에 탭 UI, fetch, 실험, CSV, 그룹, 차트, inline style 혼재
- `MessagingTab.tsx` 1,157줄
- catch를 비우는 곳 다수
- 테스트 가능한 hook/service 경계 거의 없음

### 3-3. UX 갭

- 재구매 탭의 "알림톡 발송 N명" 버튼이 첫 번째 eligible 고객 1명만 넘김 (`page.tsx:2915`)
- 알림톡의 followup/experiment 소스가 "수동 테스트만 가능" dead-end (`MessagingTab.tsx:757`)
- 주문 탭 API 비정상 응답 시 빈 화면 가능

### 3-4. 데이터 무결성 — "키 불일치 위험"

- 실험 배정: `customer_key = 전화번호`
- 알리고 로그: `customer_key = memberCode`
- `experiment_key`가 알리고 로그에 저장되지 않아 A/B sent 집계가 실제와 안 맞을 수 있음
- 그룹 ID/실험 키가 `Date.now` 기반 — 충돌 가능성

### 3-5. Top 3 잔여 항목

1. **발송-실험-그룹 로그 정규화**: experimentKey, variant, phone, memberCode를 모두 저장
2. **CRM UI 컴포넌트 분리**: 탭별 파일 분리 + API hook 추출 + 실패/빈 상태 처리
3. **운영 기능 추가**: 예약 발송, 쿠폰/세그먼트 자동화, 동의/수신거부 감사 로그

## 4. 완성도 평가

### 기능 완성도 점수

| 영역 | 완성도 | 상태 |
|------|--------|------|
| 고객 데이터 조회 | **90%** | 고객 목록, 검색, 등급 필터, CSV — 동작 |
| 세그먼트/타겟팅 | **80%** | 5개 사전 정의 세그먼트 — 커스텀 조건 미지원 |
| 그룹 관리 | **85%** | CRUD, 체크박스 선택, 자동 생성 — 엑셀 업로드 미지원 |
| 단건 발송 | **90%** | 알림톡 + SMS + 폰 미리보기 — 동작 |
| 배치 발송 | **75%** | 그룹 기반 순차 발송 — 예약/자동 미지원 |
| A/B 테스트 | **80%** | 2가지 유형 + 그룹 자동 생성 — 전환 추적 윈도우 필터 미완성 |
| 캠페인 성과 | **20%** | 발송 이력만 — 퍼널(발송→성공→유입→구매) 미구현 |
| 결제 추적 | **95%** | VM CAPI + Attribution + Toss 대조 — 안정 운영 |
| 코드 품질 | **50%** | 대형 단일 파일, 컴포넌트 미분리, 에러 핸들링 부족 |

### 종합 판정

**현재 상태: MVP 수준 (전체 약 75%)**

핵심 흐름(고객 조회 → 세그먼트 → 그룹 생성 → 발송)은 동작한다. 그러나 운영 CRM으로 쓰려면 발송 로그 정규화, 캠페인 성과 퍼널, 컴포넌트 분리가 선행되어야 한다.

## 5. 남은 개발 작업 (우선순위)

### P0 — 즉시 (데이터 정합성)

| 항목 | 설명 |
|------|------|
| 발송 로그에 experimentKey 저장 | 배치 발송 시 `crm_message_log`에 experiment_key, variant_key 함께 기록 |
| customer_key 통일 | 실험 배정(전화번호)과 발송 로그(memberCode) 불일치 해소 |
| 전환 추적 윈도우 필터 | `sync-conversions`에 `sent_at ~ sent_at + window` 날짜 조건 추가 |

### P1 — 이번 주 (UX 완성)

| 항목 | 설명 |
|------|------|
| 재구매 탭 "N명 발송" 버튼 → 그룹 발송으로 연결 | 현재 1명만 넘기는 문제 |
| followup/experiment dead-end 제거 | "수동 테스트만 가능" → 실제 그룹 선택으로 교체 |
| 주문 탭 에러 상태 처리 | API 실패 시 빈 화면 대신 에러 메시지 |
| 캠페인 성과 퍼널 | 발송 → 성공 → 유입 → 구매 전환율 차트 |

### P2 — 다음 주 (코드 품질 + 운영 기능)

| 항목 | 설명 |
|------|------|
| 컴포넌트 분리 | CustomerGroupsTab, CustomersTab, BehaviorTab → 별도 파일 |
| 예약 발송 | 발송일/시간 선택 → 서버 스케줄 |
| 엑셀 업로드 | 고객 그룹에 엑셀 파일 업로드로 멤버 추가 |
| 동의/수신거부 감사 로그 | 동의 변경 이력 기록 + 조회 |

---

## 6. 발송 로그 정규화 — 구체 계획

### 6-1. 현재 구조적 버그

**A/B 결과의 "발송" 건수가 항상 0이다.**

원인 추적:

```
getAbSummary SQL:
  LEFT JOIN crm_message_log m
    ON m.experiment_key = a.experiment_key   ← 여기서 끊김
    AND m.customer_key = a.customer_key

recordMessage 호출 (aligo.ts:216):
  recordMessage({
    customer_key: memberCode,      ← memberCode (예: m20230512ef2c28c5a4f3a)
    channel: "alimtalk",
    provider_status: "success",
    template_code: normalizedTplCode,
    // experiment_key: 전달 안 됨!   ← 핵심 누락
  })

crm_assignment_log:
  customer_key = 정규화 전화번호 (예: 01053869964)
  experiment_key = "repurchase-consent-thecleancoffee-30-180-1775980420916"
```

두 가지 불일치:
1. `experiment_key` 누락 → JOIN 결과 항상 NULL
2. `customer_key` 불일치: 배정은 전화번호, 로그는 memberCode

### 6-2. 수정 계획

#### 백엔드 변경 (3개 파일)

**`backend/src/crmLocalDb.ts` — `recordMessage` 함수 시그니처 변경 없음 (이미 experiment_key optional 수용)**

**`backend/src/routes/aligo.ts` — 발송 시 experiment_key + phone 저장**

```
현재:
  recordMessage({ customer_key: memberCode, channel, provider_status, template_code })

변경:
  recordMessage({
    experiment_key: experimentKey || undefined,    // 신규
    customer_key: normalizedReceiver,              // memberCode → 전화번호로 변경 (배정 키와 일치)
    channel,
    provider_status,
    template_code,
  })
```

**`frontend/src/app/crm/MessagingTab.tsx` — handleSend/handleSmsSend/handleBatchSmsSend에 experimentKey 전달**

```
현재 POST body:
  { receiver, message, testMode, consentStatus, adminOverride, memberCode, source }

변경:
  { receiver, message, testMode, consentStatus, adminOverride, memberCode,
    experimentKey,   // 신규: URL params 또는 그룹 메타에서 가져옴
    groupId,         // 신규
    source }
```

#### 데이터 흐름 수정 후

```
A/B 실험 생성
  → crm_assignment_log: { experiment_key, customer_key=전화번호, variant_key }
  → crm_customer_groups: 그룹 생성 (description에 experiment_key 포함)

그룹 발송 (MessagingTab)
  → POST /api/aligo/sms: { experimentKey, groupId, receiver=전화번호 }
  → recordMessage: { experiment_key, customer_key=전화번호 }

getAbSummary
  → LEFT JOIN crm_message_log ON experiment_key AND customer_key=전화번호
  → sent 건수 정상 집계 ✓
```

#### 마이그레이션

기존 `crm_message_log`에 이미 보낸 기록이 있다면 customer_key가 memberCode로 저장되어 있다. 마이그레이션 SQL:

```sql
UPDATE crm_message_log
SET customer_key = (
  SELECT REPLACE(REPLACE(REPLACE(m.callnum, '-', ''), ' ', ''), '+82', '0')
  FROM imweb_members m WHERE m.member_code = crm_message_log.customer_key LIMIT 1
)
WHERE customer_key LIKE 'm%';
```

### 6-3. 파일별 변경 목록

| 파일 | 변경 |
|------|------|
| `routes/aligo.ts:145` | request body에서 `experimentKey`, `groupId` 추출 |
| `routes/aligo.ts:216` | `recordMessage`에 `experiment_key` 전달, `customer_key`를 `normalizedReceiver`로 변경 |
| `routes/aligo.ts:300` | SMS도 동일 |
| `routes/aligo.ts:240` | SMS fallback에도 `memberCode`, `source` 추가 |
| `MessagingTab.tsx:256` | handleSend POST body에 `experimentKey`, `groupId` 추가 |
| `MessagingTab.tsx:231` | handleSmsSend 동일 |
| `MessagingTab.tsx:290` | handleBatchSmsSend 동일 |
| `MessagingTab.tsx:100` | URL에서 `experimentKey` 파라미터 추출 + state 추가 |
| `page.tsx` (그룹 발송 이동) | URL에 `experimentKey` 포함 |

---

## 7. 캠페인 성과 퍼널 — 구체 계획

### 7-1. 퍼널 단계 정의

```
발송 완료 → 발송 성공 → 유입 전환 → 구매 전환
```

| 단계 | 데이터 소스 | 계산 |
|------|----------|------|
| 발송 완료 | `crm_message_log` WHERE experiment_key = ? | COUNT(DISTINCT customer_key) |
| 발송 성공 | `crm_message_log` WHERE provider_status = 'success' | COUNT(DISTINCT customer_key WHERE status=success) |
| 유입 전환 | `attribution_ledger` WHERE touchpoint = 'payment_success' | customer_key JOIN (발송 성공 후 N일 이내 방문) |
| 구매 전환 | `imweb_orders` WHERE complete_time BETWEEN sent_at AND sent_at + window | customer_key JOIN (발송 후 N일 이내 구매 완료) |

### 7-2. 백엔드 API

**`GET /api/crm-local/experiments/:key/funnel`**

```typescript
{
  ok: true,
  experiment_key: string,
  conversion_window_days: number,
  funnel: {
    sent: number,          // 발송 시도
    delivered: number,     // 발송 성공 (provider_status = 'success')
    visited: number,       // 발송 후 window 내 사이트 방문 (attribution_ledger)
    purchased: number,     // 발송 후 window 내 구매 완료 (imweb_orders)
    revenue: number,       // 구매 매출 합계
  },
  rates: {
    delivery_rate: number,     // delivered / sent
    visit_rate: number,        // visited / delivered
    purchase_rate: number,     // purchased / visited (또는 purchased / delivered)
    overall_rate: number,      // purchased / sent
  },
  variants: [
    { variant_key: string, sent: number, delivered: number, purchased: number, revenue: number, purchase_rate: number }
  ]
}
```

### 7-3. SQL 쿼리 설계

```sql
-- 발송/성공 집계 (crm_message_log 기준)
SELECT
  a.variant_key,
  COUNT(DISTINCT a.customer_key) AS assigned,
  COUNT(DISTINCT m.customer_key) AS sent,
  COUNT(DISTINCT CASE WHEN m.provider_status = 'success' THEN m.customer_key END) AS delivered
FROM crm_assignment_log a
LEFT JOIN crm_message_log m
  ON m.experiment_key = a.experiment_key AND m.customer_key = a.customer_key
WHERE a.experiment_key = ?
GROUP BY a.variant_key;

-- 구매 전환 집계 (imweb_orders 기준, 발송 후 window 내)
SELECT
  a.variant_key,
  COUNT(DISTINCT o.member_code) AS purchased,
  COALESCE(SUM(o.payment_amount), 0) AS revenue
FROM crm_assignment_log a
INNER JOIN crm_message_log m
  ON m.experiment_key = a.experiment_key AND m.customer_key = a.customer_key
  AND m.provider_status = 'success'
LEFT JOIN imweb_members mb
  ON REPLACE(REPLACE(REPLACE(mb.callnum, '-', ''), ' ', ''), '+82', '0') = a.customer_key
LEFT JOIN imweb_orders o
  ON o.member_code = mb.member_code
  AND o.site = 'thecleancoffee'
  AND o.complete_time != ''
  AND julianday(o.complete_time) >= julianday(m.sent_at)
  AND julianday(o.complete_time) <= julianday(m.sent_at) + ?  -- conversion_window_days
WHERE a.experiment_key = ?
GROUP BY a.variant_key;
```

### 7-4. 프론트엔드 UI

A/B 테스트 결과 카드 아래에 퍼널 시각화 추가:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 발송 완료 │───→│ 발송 성공 │───→│ 유입 전환 │───→│ 구매 전환 │
│   298명   │    │   250명   │    │    45명   │    │    15명   │
│           │    │  83.9%   │    │  18.0%   │    │  33.3%   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

- 각 단계 사이 화살표와 전환율 표시
- 그라데이션 바 차트 (아임웹 캠페인 성과와 동일한 형태)
- variant별 비교 표시

### 7-5. 파일별 변경 목록

| 파일 | 변경 |
|------|------|
| `backend/src/crmLocalDb.ts` | `getExperimentFunnel()` 함수 추가 |
| `backend/src/routes/crmLocal.ts` | `GET /api/crm-local/experiments/:key/funnel` 엔드포인트 |
| `frontend/src/app/crm/page.tsx` | `CoffeeAbTestSection`에 퍼널 시각화 추가 |

---

## 8. 코드 분리 — 구체 계획

### 8-1. 현재 파일 크기

| 파일 | 줄 수 | 상태 |
|------|------|------|
| `page.tsx` | **3,365줄** | 9개 컴포넌트 + 1 유틸리티 혼재 |
| `MessagingTab.tsx` | **1,157줄** | 단일 파일 (이미 분리됨) |
| `PhonePreview.tsx` | **143줄** | 단일 파일 (이미 분리됨) |

### 8-2. 분리 대상 컴포넌트

| 현재 위치 | 분리 파일 | 줄 수 (추정) | 의존성 |
|----------|----------|-------------|--------|
| `page.tsx:1988` `CustomersTab` | `CustomersTab.tsx` | ~170줄 | API_BASE, styles, fmtKRW, fmtNum |
| `page.tsx:2163` `BehaviorTab` | `BehaviorTab.tsx` | ~160줄 | API_BASE, styles, fmtNum |
| `page.tsx:2328` `CustomerGroupsTab` | `CustomerGroupsTab.tsx` | ~280줄 | API_BASE, styles, fmtKRW, fmtNum, useRouter |
| `page.tsx:2613` `CoffeeAbTestSection` | `CoffeeAbTestSection.tsx` | ~270줄 | API_BASE, styles, fmtKRW, candidates prop |
| `page.tsx:2879` `CoffeeRepurchaseTab` | `CoffeeRepurchaseTab.tsx` | ~480줄 | API_BASE, styles, fmtKRW, fmtNum, fmtDate, useRouter, useSearchParams, CoffeeAbTestSection |
| `page.tsx:1842` `CoffeeOrdersTab` | `CoffeeOrdersTab.tsx` | ~140줄 | API_BASE, styles, fmtKRW |
| `page.tsx:1734` `AibioAdsTab` | `AibioAdsTab.tsx` | ~100줄 | API_BASE, styles, fmtKRW, fmtNum |
| `page.tsx:3279` `SiteComparisonTab` | `SiteComparisonTab.tsx` | ~80줄 | styles |

### 8-3. 공유 유틸리티 추출

**`frontend/src/app/crm/crm-utils.ts`** (신규):

```typescript
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

export const fmtKRW = (v: number) => ...;
export const fmtNum = (v: number) => ...;
export const fmtDate = (d: string | null) => ...;

export type SummaryCardProps = { label: string; value: string; sub?: string; tone?: string };
```

**`frontend/src/app/crm/SummaryCard.tsx`** (신규):

```typescript
export function SummaryCard({ label, value, sub, tone }: SummaryCardProps) { ... }
```

### 8-4. 분리 후 `page.tsx` 예상 크기

| 항목 | 줄 수 |
|------|------|
| imports + types | ~60줄 |
| SITE_TABS 정의 | ~20줄 |
| CrmPageInner (탭 라우터) | ~250줄 |
| 기존 inline attribution 섹션 | ~220줄 |
| consultation/experiments 인라인 | ~400줄 |
| **합계** | **~950줄** |

3,365줄 → ~950줄 (72% 감소)

### 8-5. 실행 순서

1. `crm-utils.ts` 추출 (fmtKRW, fmtNum, fmtDate, API_BASE, types)
2. `SummaryCard.tsx` 추출
3. `CoffeeOrdersTab.tsx` 추출 (가장 단순, 의존성 적음)
4. `CustomersTab.tsx` 추출
5. `BehaviorTab.tsx` 추출
6. `CustomerGroupsTab.tsx` 추출
7. `CoffeeAbTestSection.tsx` 추출
8. `CoffeeRepurchaseTab.tsx` 추출 (CoffeeAbTestSection 의존)
9. `AibioAdsTab.tsx` 추출
10. `SiteComparisonTab.tsx` 추출
11. `page.tsx`에서 import 교체 + 삭제된 코드 정리
12. typecheck + Playwright 테스트 통과 확인

---

## 9. 실행 결과 — 2026-04-12 (Task 2·3 완료)

### 9-1. Task 2 — 캠페인 성과 퍼널 (섹션 7)

**상태**: 완료. 이전 세션에서 작성된 코드가 유지되어 있었고, 추가 수정 없이 typecheck 통과.

| 파일 | 내용 |
|------|------|
| `backend/src/crmLocalDb.ts:2188` | `getExperimentFunnel()` — 배정/발송/구매 전환 집계 (variants별) |
| `backend/src/routes/crmLocal.ts:1164` | `GET /api/crm-local/experiments/:key/funnel` |
| `frontend/src/app/crm/CoffeeAbTestSection.tsx` | 3단계 퍼널 시각화 (발송 완료 → 발송 성공 → 구매 전환) + variant별 비교 |

**주의**: 섹션 7-1 계획에서 정의한 `visited`(유입 전환, `attribution_ledger` 기반) 단계는 구현에서 **제외됨**. 현재 퍼널은 `발송 완료 → 발송 성공 → 구매 전환` 3단계. `attribution_ledger` 조인을 추후 추가할지 판단 필요.

### 9-2. Task 3 — 코드 분리 (섹션 8) 완료

`page.tsx` **3,410줄 → 1,716줄 (−49.7%)**. `CrmPageInner` 1개 함수만 남음.

| 신규 파일 | 줄 수 | 설명 |
|-----------|------|------|
| `crm-utils.ts` | 17 | API_BASE, fmt* 유틸 (기존, 중복 제거) |
| `SummaryCard.tsx` | 16 | 공통 카드 컴포넌트 |
| `AibioAdsTab.tsx` | 115 | AIBIO 광고 성과 |
| `CoffeeOrdersTab.tsx` | 106 | 더클린커피 7일 주문 |
| `SiteComparisonTab.tsx` | 83 | 3사이트 지표 비교 |
| `CustomersTab.tsx` | 176 | 고객 목록 + 검색 + CSV |
| `BehaviorTab.tsx` | 179 | 5개 행동 세그먼트 |
| `CustomerGroupsTab.tsx` | 288 | 그룹 CRUD + 멤버 체크박스 + 이력 |
| `CoffeeAbTestSection.tsx` | 325 | A/B 실험 생성/결과/퍼널 |
| `CoffeeRepurchaseTab.tsx` | 411 | 재구매 후보 + 필터 + 가설 카드 |

**남은 page.tsx 구성**: imports(24줄) + SITE/TAB 상수 + `CrmPageInner` (탭 라우터 + 상담/실험/결제 추적 섹션). 당초 예상치 ~950줄보다 많지만, 상담사·결제추적 섹션이 아직 인라인으로 남아 있어서 그렇소. 이 섹션들은 P2 범위 밖이라 손대지 않았소.

### 9-3. 검증 결과

| 항목 | 결과 |
|------|------|
| 백엔드 `tsc --noEmit` | 에러 없음 |
| 프론트엔드 `tsc --noEmit` | 에러 없음 |
| 프론트엔드 dev 서버 (port 7010) | 실행 중, `/crm?site=thecleancoffee&tab=repurchase` 200 OK |
| "재구매 관리", "A/B 테스트" 텍스트 렌더 | 확인 |
| Playwright 스모크 테스트 | **미실행** (백엔드 7020 미가동) |

### 9-4. 남은 리스크 / 다음 액션

- **백엔드 가동 후 Playwright 스모크 8건 재실행 필요.** 현재 세션에서는 백엔드가 내려가 있어서 데이터 로드를 건너뛰었소. 컴포넌트 구조만 정적 렌더로 확인됨.
- **P1 잔여 (섹션 5)**:
  - 재구매 탭 "N명 발송" → 첫 1명만 전달되는 버그 미해결 (`CoffeeRepurchaseTab.tsx:63` `handleSendToMessaging`의 `first = eligible[0]!` 패턴이 그대로 복제됨)
  - followup/experiment dead-end
  - 주문 탭 에러 상태 처리
- **퍼널의 `visited` 단계** 구현 여부 결정 필요.
- **리팩터 안전성**: 각 추출 후 typecheck만 통과 확인했고 런타임 동작은 정적 HTML 렌더까지만 확인. 상태·이펙트·라우팅은 실제 사용자 행동으로 확인해야 확신 가능.
