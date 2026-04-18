# Verification Harness

작성 시각: 2026-04-17 KST
문서 성격: 개념 설명 + 우리 프로젝트 적용안

---

## 30초 결론

`Verification Harness`는 **"AI나 사람이 '고쳤다', '정상이다'라고 말할 때, 그 말이 진짜인지 숫자로 자동 확인해주는 장치"**다.

쉬운 비유로 말하면 체중계다.
- 체중계가 있으면 "살 빠진 것 같다"는 말 대신 "어제 72.3, 오늘 71.9"라고 말할 수 있다.
- 체중계가 없으면 거울 보고 기분으로만 판단하게 된다.

우리 프로젝트에서 이 체중계에 해당하는 것이 Verification Harness다.
AI가 "CAPI 문제 고쳤어요"라고 말하면, Harness가 `중복 event_id 0건`, `pending 주문 Purchase 전송 0건`, `test 폼 섞임 0%` 같은 숫자로 자동 채점한다.

결론:
- 지금 프로젝트에 없다.
- `backend/scripts/check-source-freshness.ts`가 첫 조각이다.
- 만드는 순서는 `가장 반복 확인하는 3~5개 평가 항목`부터다.
- 없으면 `loop 방식 운영`, `자율 에이전트`, `Revenue Integrity Agent` 전부 자기합리화가 된다.

---

## 이름 풀어쓰기

`Verification Harness` = 검증(verification) + 지그/틀(harness).

Harness는 원래 "말 몸에 씌우는 마구"이고, 소프트웨어에서는 "여러 테스트를 같은 조건에서 자동으로 돌려주는 틀"을 뜻한다.

즉 우리 맥락에서는 **고정된 조건으로 같은 숫자를 항상 같은 방식으로 뽑는 자동 점검기**다.

---

## 왜 필요한가

현재 TJ님이 운영 중 반복으로 묻는 질문이 있다.

- 이 주문은 테스트야 실고객이야?
- CAPI에 pending이 Purchase로 잘못 보내진 거 아니야?
- Meta Lead 수랑 GA4 lead 수 왜 달라?
- AIBIO에 네이버 유입이 진짜 1건이야, 아니면 test 제외 때문에 그렇게 보이는 거야?
- 원장 최신 row 시간이 언제까지야?
- 어제 광고 금액이랑 내부 확정 매출 차이가 왜 이래?

지금은 이 질문에 답할 때마다 아래가 반복된다.

1. TJ님이 화면/CSV를 캡처한다.
2. Codex가 로그/원장/API를 뒤진다.
3. Claude Code가 문서에 해석을 남긴다.
4. 며칠 뒤 같은 질문이 다시 온다.

Verification Harness가 있으면 이 반복이 줄어든다.
같은 질문은 한 번 물으면, 같은 답이 자동 계산되어 저장된다.

---

## 비유 3개로 이해하기

### 비유 1. 체중계
- 없으면 거울로 기분 판단.
- 있으면 같은 사람이 몇 번 올라가도 같은 숫자.
- 핵심은 `재현성`. AI가 말을 바꿔도 숫자는 바뀌지 않는다.

### 비유 2. 시험 채점 기준표
- 선생님 기분에 따라 점수가 바뀌면 안 된다.
- 기준표가 있으면 다른 선생님이 채점해도 같은 점수가 나온다.
- AI나 사람이 `"CAPI 정상"`이라고 주장해도, 채점 기준이 고정돼 있으면 그 주장이 맞는지 자동으로 본다.

### 비유 3. 약국 조제 확인 기계
- 약사가 피곤해서 약을 잘못 담아도, 기계가 "이 조합 위험"이라고 알린다.
- 평소에는 조용하지만, 기준을 벗어나면 바로 경고한다.
- 우리 경우: 평소엔 조용하다가 `pending 주문이 Purchase로 전송됨` 같은 위험 신호가 뜨면 바로 경고.

세 비유의 공통점은 하나다.
**"사람의 말/주장"이 아니라 "고정 기준"으로 확인한다.**

---

## 없으면 뭐가 나쁜가

| 상황 | Harness 없을 때 | Harness 있을 때 |
|---|---|---|
| "CAPI 문제 고쳤어요" 보고를 받음 | 진짜 고쳐졌는지 TJ님이 매번 수동 확인 | `중복 event_id 0건`, `dedup 성공률 97%+`로 자동 채점 |
| 일주일 뒤 같은 문제 재발 | 누가 알아챌지 운 | `incident 자동 생성`, 알림 |
| AIBIO 네이버 전환 1건 이슈 | 캡처 + 질문 + 답변 반복 | 쿼리 1회 실행, 결과 저장, 재질문 시 저장본 참조 |
| "데이터가 오늘까지 들어온다" 주장 | 소스마다 수동 확인 | `fresh/warn/stale` 상태 한 화면 |
| AI가 "정상" 이라고 말함 | 신뢰할지 말지 감 | 평가기 pass/fail이 근거 |
| 지난달 판단과 이번 달 판단 비교 | 기준이 다를 수 있음 | 같은 평가기로 snapshot 비교 가능 |

**없을 때 가장 큰 리스크**는 "AI가 그럴듯하게 쓴 보고서"와 "실제 운영 숫자"가 어긋나는 것이다.
이 어긋남은 시간이 지날수록 눈치채기 어려워진다.

---

## 우리 프로젝트에서 이렇게 생겼다

아래 6개가 initial 평가 항목 후보다. `vibecodingtech.md`에서 정리된 것과 같은 범위다.

### 1. 원천 데이터 최신성

질문: biocom, coffee, AIBIO 원장이 오늘까지 최신인가.

확인:
- Toss transactions: `MAX(approved_at)`이 어제 이후인가.
- Imweb orders: `MAX(order_created_at)`이 어제 이후인가.
- PlayAuto: `MAX(synced_at)`이 24시간 안인가.
- Attribution ledger: `MAX(occurred_at)`이 6시간 안인가.
- Meta insights: 최신 request 시각이 1시간 안인가.

기준 통과 여부:
- `fresh`: 기대 범위 안
- `warn`: 살짝 늦어짐
- `stale`: 기대 범위를 넘음

현재 상태: `backend/scripts/check-source-freshness.ts`로 첫 실행 완료. 4개 원천 확인 가능.

### 2. test/debug 제외 정합성

질문: 운영 숫자에서 내부 테스트가 섞여 있지 않은가.

확인:
- `aibio_form_submit` vs `aibio_form_submit_test` 분리율
- 테스트 전화번호 prefix 제외 후 전환 수 변화
- 결제완료 URL 테스트 플래그 섞임 여부

기준 통과 여부:
- 운영 테이블에 `is_test_contact=true` row가 메인 카운트에서 제외되는가.
- 제외율이 급변하지 않았는가(전날 대비 +5%p 이상은 warn).

### 3. Meta CAPI 품질

질문: Meta에 보낸 Purchase가 신뢰할 만한가.

확인:
- 같은 order_id로 `event_id`가 여러 개 전송된 건수 (dedup 실패 후보)
- `paymentStatus=pending`인데 `ev=Purchase`로 전송된 건수
- `Purchase` 서버 CAPI 성공률 (200 vs 비2xx)
- Browser Pixel `Purchase`와 Server CAPI `Purchase`의 `event_id` 일치율

기준 통과 여부:
- 중복 `event_id` = 0
- pending -> Purchase 전송 = 0
- CAPI 성공률 >= 95%

### 4. Purchase Guard 분리

질문: 자사몰 결제 페이지에서 confirmed / pending / test가 제대로 갈라지는가.

확인:
- 카드 confirmed 주문에서 `ev=Purchase` 발화 여부
- 가상계좌 미입금에서 `ev=VirtualAccountIssued` 발화 여부 + Browser `Purchase` 미발화 확인
- 테스트 결제에서 Browser `Purchase` 미발화 확인
- 네이버페이 주문은 Server CAPI 경로로만 전송되는지 확인

기준 통과 여부:
- 위 4개 조건이 각 사이트별로 통과하는가.

### 5. 유입 분석 정합성

질문: 유입/채널 숫자가 시스템 간에 맞아떨어지는가.

확인:
- Meta purchase 수 vs 내부 confirmed 주문 수 차이율
- GA4 `(not set)` 구매 비율
- Meta `1d_click` ROAS vs Attribution confirmed ROAS 배율
- campaign alias mapped / unmapped 비율

기준 통과 여부:
- `(not set)` 비율이 60% 이하 (biocom 기준)
- mapped 비율이 80% 이상 (최근 7일)
- Meta vs 내부 차이 배율 변화가 전주 대비 완만

### 6. CRM 세그먼트 일관성

질문: 발송 대상, 제외 대상, 전환 대상이 같은 기준으로 계산되는가.

확인:
- 같은 고객이 두 세그먼트에 동시 포함된 비율
- 발송 대상 수 vs 실제 발송 건 수 gap
- 수신 거부/블랙리스트 제외 실제 적용률

---

## 이미 있는 것 / 없는 것

| 항목 | 상태 |
|---|---|
| 원천 최신성 스크립트 | 1차 구현 완료 — `backend/scripts/check-source-freshness.ts` |
| Meta CAPI dedup 리포트 | 특정 시점 수동 실행 있음 — `data/meta_capi_dedup_phase4_*.md` |
| test/debug 제외 평가기 | 없음 |
| Purchase Guard 자동 점검 | 없음. 주문 단위 수동 테스트로만 확인 중 |
| 유입 정합성 자동 점검 | 없음. `roasphase.md`에 수치는 있으나 수동 |
| CRM segment 일관성 평가기 | 없음 |
| 결과 저장소 (Evidence Store) | 파일 기반 일부 있음 — `data/*.md`, `meta/*.md`. 구조화 안 됨 |
| 자동 incident 생성 | 없음 |
| 알림(slack 등) | 없음 |

따라서 **1번(원천 최신성)만 1차 구현 상태**이고, 나머지 5개 평가기는 아직 없다.

---

## 만들지 않을 것 (지금은)

- 자율적으로 코드를 계속 고치는 에이전트에 Harness를 물리는 일. 먼저 read-only 평가만 쓴다.
- Harness가 Meta/GTM/DB/운영 데이터를 쓰는 일. 읽기만 한다.
- 평가기와 수정 범위를 같은 에이전트에 맡기는 구조. 평가기는 사람이 관리한다.
- 평가기 통과를 자동 merge 조건으로 쓰는 일. 통과는 사람 판단의 입력일 뿐이다.
- 모든 incident에 알림 붙이기. 초기에는 저장만 하고, 사람이 하루 1회 본다.

이유는 단순하다. 평가기가 검증되지 않은 상태에서 자동 실행을 붙이면, `그럴듯한데 틀린 경고`로 운영자가 피로해진다.

---

## 만드는 순서 (최소부터)

실제 72시간 실행안은 이렇게 낮게 잡는다.

### 1일차: 평가 항목 정의 고정

산출물:
- `backend/src/integrity/checks/*.ts`에 평가 항목별 함수 1개씩.
- 입력은 날짜 범위/사이트 ID, 출력은 `{ name, status, value, threshold, evidence }`.
- 6개 중 **현재 즉시 데이터가 있는 3개만 우선**: 원천 최신성, Meta CAPI dedup, Purchase Guard pending 오염.

완료 기준:
- 같은 입력이면 같은 출력이 나온다.
- 출력은 JSON과 마크다운 양쪽으로 나올 수 있다.

### 2일차: read-only API로 노출

산출물:
- `GET /api/integrity/health` — 6개 항목 요약
- `GET /api/integrity/incidents` — 기준 실패 목록
- `GET /api/integrity/incidents/:id` — 증거 payload

완료 기준:
- biocom, coffee, AIBIO 3사이트에 대해 같은 endpoint로 호출 가능.
- 결과가 `agent/evidence/YYYY-MM-DD/<incident-id>.json` 같은 파일로 저장된다.

### 3일차: 운영 화면과 증거 파일

산출물:
- `/tracking-integrity` 또는 기존 `/ads` 상단에 `Integrity Health` 카드 5줄.
- 각 incident 클릭 시 원장 row 샘플과 다음 액션 표시.

완료 기준:
- 운영자가 하루 1회 이 카드만 보고 `정상 / 주의 / 문제` 판단 가능.
- 문제 발견 시 `data/*.md` 문서에 수동으로 쓰지 않아도 증거가 이미 파일로 남아 있다.

**이 3일이 통과하면 Harness의 최소 골격이 완성된다.**

그 다음에 `test/debug 제외`, `유입 정합성`, `CRM segment` 평가기를 하나씩 붙이면 된다.

---

## 완료 기준

초기 Harness가 "만든 보람이 있다"고 말하려면 아래 5개가 동시에 참이어야 한다.

1. **재현성**: 같은 날짜/사이트 입력으로 몇 번을 돌려도 결과가 같다.
2. **수동 대체**: TJ님이 이 3개 질문을 직접 확인하지 않아도 된다.
   - 원장 오늘까지 최신인가
   - CAPI 중복/오염 있는가
   - Purchase Guard가 테스트와 운영 분리되는가
3. **증거 저장**: 모든 incident에 원장 row 샘플, API 응답, 판단 이유가 남는다.
4. **읽기 전용**: Harness가 어떤 운영 데이터도 바꾸지 않는다.
5. **승인 분리**: 문제를 발견해도 수정은 사람이 승인한 뒤 Codex/Claude Code가 한다.

---

## 로드맵 연결

- `roadmap/roadmap0415.md`의 **Phase 2. Revenue Integrity Agent read-only MVP**의 전제 조건이다.
- `roadmap/roadmap0415.md`의 **스프린트 7, 8**에서 `incident schema`, `health/summary API`로 정의돼 있다.
- `agent/vibecodingtech.md`의 **72시간 실행안** 1~3일차와 직접 대응한다.
- `agent/loopcodexop.md`의 **"지금 당장 도입할 최소 루프"** 중 evidence-first 보고와 재검증 task의 자동화 근거가 된다.
- `data/!datacheckplan.md`의 **Phase4-Sprint7 (sync 감사와 stale 경고)**, **Phase4-Sprint8 (운영 루틴과 대시보드)**가 이 Harness 위에서 돌아간다.

즉 여러 문서가 각자 비슷한 것을 요구하고 있고, Verification Harness는 그 공통 기반이다.

---

## 한 줄 정리

Verification Harness는 `검증 도구`가 아니라 **`주장'을 '숫자'로 바꾸는 장치`**다.
있으면 AI와 사람이 같은 언어로 말하게 된다. 없으면 AI가 아무리 열심히 일해도 `정말 좋아진 건지` 모른다.
