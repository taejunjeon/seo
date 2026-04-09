# GPT Feedback 0408-2 Reply

기준일: 2026-04-08  
참조: `gptfeedback_0408_2.md`

## 한줄 결론

이번 턴에는 피드백 쟁점 중 **문서 stale 정리, 0408 실행 스냅샷 추가, biocom reconcile age bucket 분해, Toss sync completion signal 추가, `/ads` + `/ads/roas` confirmed-only/lag warning 정렬**까지는 실제로 반영했다.  
다만 **외부 checkout / payment_success caller의 GA 식별자 실유입**과 **P3 첫 operational live**, **장거리 settlement backfill의 최종 완료 기록**은 아직 남아 있다.

## 쟁점별 상태 요약

| 쟁점 | 상태 | 결과 요약 |
| --- | --- | --- |
| 문서 stale 문장 정리 | 실행 완료 | `datacheck0406.md` 상단/본문 충돌 구간을 최신 0408 상태로 재정리했고, `roadmap0327.md`, `phase1.md`, 온보딩 메모도 같이 맞췄다. |
| `0408 실행 스냅샷` 박스 추가 | 실행 완료 | `datacheck0406.md` 최상단에 caller coverage, biocom sync, reconcile age bucket, Toss settlements, GA4 direct access를 5줄 요약으로 추가했다. |
| 외부 caller 수정 1순위화 | 일부 완료 | backend/문서/온보딩 기준으로 caller blocker를 가장 위에 올렸고 coverage API로 0%를 계속 확인 가능하게 했지만, 실제 external caller payload 수정은 아직 미반영이다. |
| biocom reconcile을 age bucket으로 분해 | 실행 완료 | `/api/crm-local/imweb/toss-reconcile` 응답에 `0-1일 / 2-7일 / 8-30일 / 31일 이상` bucket을 추가했고 실응답으로 확인했다. |
| settlement backfill completion signal 추가 | 일부 완료 | `/api/toss/sync` 응답에 `runId / startedAt / finishedAt / pagesRead / rowsAdded / done / monthReports`를 추가했고 incremental 실행에서 `done=true`를 확인했다. 다만 장거리 backfill 완료 응답은 아직 별도 확인이 필요하다. |
| ROAS에 confirmed-only + lag warning 표시 | 실행 완료 | `/ads`와 `/ads/roas` 둘 다 confirmed ledger 기준과 최근 1~2일 잠정치 경고를 표시하도록 수정했다. |
| BigQuery legacy가 핵심 엔지니어링 시간을 잡아먹지 않게 분리 | 실행 완료 | `datacheck0406.md` 상단에서 `legacy 확인 없이 가능한 작업`과 `legacy 확인이 있어야 하는 작업`을 분리했고, 이번 턴 코드 작업은 legacy blocker 없이 진행했다. |
| P3 첫 operational live 실행 | 미완료 | 실제 발송 세그먼트/발송 주체/운영 승인 결정이 필요해 이번 턴 코드 범위를 넘었다. |

## 실행 완료

### 1. 문서 stale 상태 정리

다음 문서를 최신 0408 상태로 맞췄다.

- `data/datacheck0406.md`
- `roadmap/roadmap0327.md`
- `roadmap/phase1.md`
- `frontend/src/app/onboarding/page.tsx`

핵심 정리 내용:

- `biocom` Imweb local sync는 이제 **실행 완료 상태**로 정리
- biocom reconcile은 총량 `68.09%` 하나가 아니라 최신 실응답 기준 `74.02%` + age bucket으로 해석하도록 수정
- Toss settlement는 `20,388건` 적재 사실과 함께 `completion signal`이 추가됐음을 문서화
- `0408 실행 스냅샷`을 최상단에 별도 박스로 추가

### 2. biocom reconcile age bucket 추가

코드 변경:

- `backend/src/crmLocalDb.ts`
- `backend/tests/crm-local-imweb-order.test.ts`

추가된 응답 필드:

- `report.ageBuckets[]`
  - `0_1d`
  - `2_7d`
  - `8_30d`
  - `31d_plus`

각 bucket은 아래 값을 준다.

- `imwebOrders`
- `matchedOrders`
- `missingInToss`
- `amountMismatchCount`
- `coverageRate`

실제 검증 결과 (`7023` 임시 서버):

- 총 coverage: `74.02%`
- `0-1일`: `45.77%`
- `2-7일`: `65.74%`
- `8-30일`: `76.67%`
- `31일 이상`: `76.71%`

해석:

- 최근 `0-1일` bucket이 가장 낮으므로, 총량만 보면 진짜 누락과 PG 반영 지연이 섞여 보이던 문제가 분리됐다.
- 즉 `68~74%` 하나만 보고 “정합성 나쁨”이라고 읽는 오해를 줄였다.

### 3. Toss sync completion signal 추가

코드 변경:

- `backend/src/routes/toss.ts`

추가된 응답 필드:

- `syncRun.runId`
- `syncRun.startedAt`
- `syncRun.finishedAt`
- `syncRun.durationMs`
- `syncRun.done`
- `syncRun.pagesRead`
- `syncRun.rowsAdded`
- `syncRun.monthReports[]`
- `fetched`

실제 검증 결과 (`7023` 임시 서버, incremental 1일 범위):

- `runId`: `toss-sync:biocom:incremental:2026-04-08T01:40:26.660Z`
- `done`: `true`
- `pagesRead`: `transactions 1 / settlements 2 / total 3`
- `rowsAdded`: `0`
- `fetched`: `transactions 83 / settlements 124`

의미:

- 이제 운영에서는 “몇 건 들어왔는가”뿐 아니라 “이 실행이 끝난 것인가”까지 응답에서 바로 읽을 수 있다.
- 다만 **장거리 backfill**도 같은 형식으로 끝까지 받아서 `done=true/false`와 최종 coverage를 기록하는 단계는 아직 남아 있다.

### 4. `/ads`와 `/ads/roas`에 confirmed-only + lag warning 반영

코드 변경:

- `frontend/src/app/ads/page.tsx`
- `frontend/src/app/ads/roas/page.tsx`

반영 내용:

- 두 화면 모두 메인 ROAS가 `confirmed ledger` 기준임을 명시
- “오늘/최근 1~2일 수치는 pending 결제와 PG 확정 지연 때문에 잠정치로 낮게 보일 수 있다”는 경고 문구 추가
- `/ads/roas`의 광고 귀속 매출 설명도 `confirmed ledger + UTM/fbclid 매칭`으로 수정

의미:

- source는 이미 지난 턴에 맞췄고, 이번 턴에는 **읽는 법**까지 맞췄다.
- 운영팀이 “오늘 ROAS가 갑자기 떨어졌다”고 오해하는 가능성을 줄였다.

## 일부 완료

### 1. 외부 caller 수정 1순위화

한 것:

- `caller coverage`를 최상단 운영 blocker로 문서/온보딩/Phase 문서에 반영
- live `payment_success 452건` 기준 `ga_session_id / client_id / user_pseudo_id = 0%`를 계속 보게 유지

못한 것:

- 실제 checkout / payment_success caller payload 수정

이유:

- 현재 workspace 안 backend는 받을 준비가 끝나 있지만,
- 실제 값을 보내는 프론트/외부 스크립트/아임웹 적용 경로는 이번 턴에서 직접 확인·배포하지 못했다.
- 즉 “무엇을 고쳐야 하는지”와 “고친 뒤 무엇으로 검증하는지”는 닫았지만, **실제 유입 반영**은 아직이다.

### 2. settlement completion signal

한 것:

- `/api/toss/sync` 응답 구조 보강
- incremental 실행에서 `done=true` 확인

못한 것:

- `mode=backfill` 장거리 실행의 종료 응답과 최종 coverage 산출까지는 이번 턴에 확정 못 함

이유:

- 장거리 backfill은 실제 실행 시간이 길고, 이전에도 관찰 시간 안에 종료 응답을 못 받은 전례가 있다.
- 이번 턴에는 **응답 구조 자체를 보강**하는 데까지 닫았고, long run completion record는 다음 실행에서 확보해야 한다.

## 미완료

### 1. P3 첫 operational live

못한 이유:

- 이건 코드만으로 닫히는 작업이 아니고, 실제 세그먼트 1개 선택, 발송 주체, 운영 승인, 결과 관찰까지 필요하다.
- 즉 엔지니어링 보강과는 별개로 운영 의사결정이 필요한 단계다.

### 2. external caller의 실제 GA 식별자 유입

못한 이유:

- live `payment_success 452건`에서 여전히 `0%`이므로 적용되지 않았다.
- 이 부분은 backend가 아니라 실제 호출부 반영과 배포 확인이 필요하다.

## 변경 파일

### 백엔드

- `backend/src/crmLocalDb.ts`
- `backend/src/routes/toss.ts`
- `backend/tests/crm-local-imweb-order.test.ts`

### 프론트엔드

- `frontend/src/app/ads/page.tsx`
- `frontend/src/app/ads/roas/page.tsx`
- `frontend/src/app/onboarding/page.tsx`

### 문서

- `data/datacheck0406.md`
- `roadmap/roadmap0327.md`
- `roadmap/phase1.md`

## 검증

### 테스트/타입체크

- `backend`: `npx tsc --noEmit` 통과
- `backend`: `node --import tsx --test tests/crm-local-imweb-order.test.ts` 통과
- `frontend`: `npx tsc --noEmit` 통과

### 실응답 검증

임시 서버:

- `backend current code`: `http://localhost:7023`

확인한 응답:

1. `GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=2`
   - `ageBuckets` 노출 확인
   - 총 coverage `74.02%`
   - `0-1일 45.77% / 31일 이상 76.71%`

2. `POST /api/toss/sync?store=biocom&mode=incremental&startDate=2026-04-07&endDate=2026-04-07`
   - `syncRun.runId / startedAt / finishedAt / pagesRead / rowsAdded / done` 확인
   - incremental 실행 기준 `done=true`

참고:

- 기존 `7020`, `7021` 프로세스는 별도로 떠 있을 수 있다.
- 이번 턴의 새 응답 형식은 임시 `7023`에서 검증했다.

## 다음 우선순위

1. external caller에서 `ga_session_id / client_id / user_pseudo_id` 실제 전송
2. 장거리 `POST /api/toss/sync?mode=backfill` completion signal 실관측
3. `biocom` Imweb local cache의 `2026-01-27` 이전 범위 확인
4. P3 first operational live 세그먼트 1개 고정 후 실제 발송
