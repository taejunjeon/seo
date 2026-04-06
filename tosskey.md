# Toss Key 정리 메모

기준일: 2026-04-06

## 한 줄 결론

- `TOSS_SECRET_KEY_COFFEE`는 Toss가 공식으로 쓰는 이름이 아니라, 이 저장소 문서와 AI 작업 로그에서 **"더클린커피용 Toss 시크릿 키"를 구분하려고 붙인 내부 변수명**이다.
- 2026-04-06 기준 `.env` 반영, `seo/backend` 코드 수정, coffee local backfill까지 끝나서, **이제는 운영 source of truth와 KPI 재산출이 남은 작업**이다.
- 현재 코드도 더 이상 바이오컴 단일 키 구조가 아니라, **biocom/coffee store 분기 구조**를 지원한다.

## 저장소에서 확인된 사실

### 1. 현재 백엔드 구현

- `backend/src/routes/toss.ts`는 이제 `store=biocom|coffee` 분기를 지원한다.
- `backend/src/env.ts`도 biocom/coffee explicit env alias를 읽는다.
- `/health`에서 biocom/coffee 둘 다 `ready: true`로 확인된다.

### 2. 문서/메모에서 반복 확인되는 내용

- `coffee/coffee.md`, `coffee/coffeedata.md`, `tossapi.md`, `roadmap/phase1.md`에서 모두
  - 바이오컴 MID: `iw_biocomo8tx`
  - 커피 MID: `iw_thecleaz5j`
  - 초기 문서 작성 시점에는 커피 전용 키 미확보 상태였고, 2026-04-06 기준으로는 반영 완료
  라는 맥락이 반복된다.

### 3. 로컬 데이터 근거

- `backend/data/crm.sqlite3`의 `toss_transactions` 테이블을 보면 MID가 실제로 2개다.
  - `iw_biocomo8tx`: 32,916건
  - `iw_thecleaz5j`: 687건
- 따라서 "커피 MID가 따로 있다"는 말은 문서 추측만이 아니라 **로컬 적재 데이터로도 확인된다.**

## 그래서 무엇이 맞는가

### 개발팀 말 중 맞는 부분

- `TOSS_SECRET_KEY_COFFEE`라는 **환경변수명 자체는 공식 Toss 용어가 아니다.**
- Toss 관리자에 저 이름의 키가 있는 것이 아니라, 우리가 `.env`에서 구분하려고 쓸 **내부 이름**일 뿐이다.

### 그래도 확인이 필요한 부분

- 이 가정은 맞았고, 실제로 커피 orderId는 coffee store key로만 조회되는 구조로 확인됐다.
- 2026-04-06 실제 검증:
  - `GET /api/toss/payments/orders/202601017947250-P1?store=coffee` 성공
  - `GET /api/toss/payments/orders/202501019001551-P1?store=biocom` 성공

## imweb 폴더 쪽 확인 결과

- `imweb/` 문서들은 주로 회원/consent/API/site 구분 이슈를 다룬다.
- 즉 `imweb` 쪽은 **커피 사이트 식별이나 회원 API 범위 확인**에는 관련 있지만,
  **Toss 결제 조회 키 문제를 직접 해결해 주는 근거는 아니다.**
- 이번 질문의 핵심은 `imweb`보다 **Toss MID 구분과 결제 조회 권한** 쪽이다.

## TJ님이 개발팀에 추가로 요청할 것

아래 3개만 정확히 확인 받으면 된다.

1. **운영 DB `tb_sales_toss`와 로컬 SQLite 중 어느 쪽을 source of truth로 둘지**
2. **coffee KPI/LTR 재산출을 어느 원장 기준으로 닫을지**
3. **운영 배치도 `store=coffee` 방식으로 갈지, 운영 DB export를 유지할지**

## 개발팀에 보낼 추천 문구

아래처럼 짧게 물어보면 된다.

> 더클린커피 Toss 키는 `.env` 반영과 store 분기 코드 적용, local backfill까지 끝났습니다.  
> 이제 `store=coffee` 기준 local 원장을 계속 source of truth로 쓸지, 또는 운영 DB export를 기준으로 둘지 결정이 필요합니다.  
> 운영 기준 소스가 `tb_sales_toss`인지, 아니면 이번에 연결한 Toss API 재수집본인지도 함께 정리 부탁드립니다.

## 실무 판단

- 키 확보 단계는 끝났다.
- 지금 남은 실무 결정은 **source of truth 선정과 KPI 재산출 기준 확정**이다.
- 즉 개발팀에 물을 내용도 이제는 **권한 유무**보다 **운영 적재 방식** 쪽이 더 중요하다.
