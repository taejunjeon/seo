# metaroas2 실행 결과

작성일: 2026-04-10

## 성공

### 1. 2026-04-10 raw JSON 증빙 세트 생성

아래 3개 파일을 추가했다. 모두 biocom `last_7d`, 2026-04-03 - 2026-04-09 기준으로 맞춘 세트다.

- `data/ads_site_summary_last7d_20260410.json`
- `data/ads_roas_daily_biocom_last7d_20260410.json`
- `data/meta_insights_biocom_last7d_20260410.json`

핵심 대사값:

- site-summary biocom: spend ₩27,842,260, confirmed revenue ₩25,551,740, pending revenue ₩1,358,700, Meta purchase value ₩123,904,111
- daily biocom: spend ₩27,842,260, confirmed revenue ₩25,551,740, pending revenue ₩1,358,700, Meta purchase value ₩123,904,111
- meta insights biocom: totalSpend ₩27,842,260, totalPurchaseValue ₩123,904,111

이제 문서의 최신 7일 수치와 raw JSON 세트가 같은 기준으로 묶였다.

### 2. `best-case ceiling` 표현 정리

프론트와 문서에서 사용자-facing 문구를 `잠정 ceiling`/`best-case ceiling` 대신 `잠정 상한선`으로 정리했다.

- `/ads`: 운영 headline과 KPI 카드 문구 수정
- `/ads/roas`: 운영 headline과 KPI 카드 문구 수정
- `data/metaroasreply.md`: 정의표와 실행 결과 문구 수정

의미도 같이 정리했다. 이 값은 Meta 기여 매출이 아니라 “사이트 전체 confirmed 매출 ÷ Meta spend”라서, Ads Manager export/timezone 최종 대조 전까지 확정 상한으로 읽으면 안 된다.

### 3. 대표용 3줄 결론 추가

`data/metaroasreply.md` 상단에 대표용 결론을 추가했다.

- 지금 메인으로 볼 숫자: biocom 최근 7일 Attribution confirmed ROAS 0.92x
- 지금 headline으로 쓰지 말 숫자: 30일 confirmed ROAS 0.23x
- 지금 가장 큰 리스크: Pixel/CAPI dedup 의심, biocom GTM/payment page 이벤트 품질, 캠페인별 Attribution ROAS `(unmapped)` 100%

### 4. Pixel/CAPI dedup을 Top blocker로 승격

`data/metaroasreply.md`에 `Top 3 Blocker` 섹션을 추가했다.

- Pixel/CAPI dedup 의심
- biocom GTM/payment page 이벤트 품질
- campaign drill-down `(unmapped)` 100%

### 5. CAPI log 진단 API 보강

`/api/meta/capi/log` summary에 중복 진단값을 추가했다.

- `uniqueEventIds`
- `duplicateEventIds`
- `uniqueOrderEventKeys`
- `duplicateOrderEventKeys`
- `duplicateOrderEventSamples`

현재 확인값:

- total 692
- success 692
- failure 0
- uniqueEventIds 429
- duplicateEventIds 263
- uniqueOrderEventKeys 426
- duplicateOrderEventKeys 266
- 첫 중복 샘플: orderId `202604083892378`, eventName `Purchase`, count 6, uniqueEventIds 2

이제 dedup 문제가 추정이 아니라 API에서 바로 보이는 상태가 됐다.

### 6. CAPI 중복 3분리 추가 완료

추가 요청 기준으로 `/api/meta/capi/log`를 한 단계 더 보강했다.

무엇을 분리했나:

- 같은 `event_id` 중복
- 같은 `orderId + eventName` 중복
- 최근 7일 운영 성공 로그 기준의 테스트/수동/재시도형/차단 후보 분리

새 조회 방식:

- 전체 로그: `/api/meta/capi/log?limit=500`
- 최근 운영 성공분만: `/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7`

현재 최근 7일 운영 성공분 기준 확인값:

- total 691
- success 691
- operational/manual/test = 691 / 0 / 0
- 같은 `event_id` 중복: 174그룹, 중복 row 263건
- 같은 `orderId + eventName` 중복: 173그룹, 중복 row 266건
- 재시도형으로 보이는 중복: 170그룹, 427건
- 재전송 차단 후보: 3그룹, 12건

해석:

- 대부분은 같은 `event_id`가 반복된 재시도형으로 보인다.
- 위험도가 더 높은 것은 같은 주문+이벤트인데 `event_id`가 여러 개인 3그룹이다. 이 경우 Meta 쪽에서 같은 이벤트로 dedup되지 않을 수 있어, 다음 차단 규칙의 우선 후보로 본다.
- 브라우저 Pixel과 서버 CAPI가 둘 다 들어왔는지는 서버 CAPI 로그만으로 확정할 수 없다. 이 부분은 Meta Events Manager에서 event_id 매칭으로 확인해야 한다.

대시보드 반영:

- `/ads` CAPI 카드에 최근 7일 운영 성공 로그 기준 중복 진단 패널을 추가했다.
- “동일 event_id 중복”, “같은 주문+이벤트 중복”, “재전송 차단 후보”를 분리해서 표시한다.

### 7. 테스트/검증

- `npm --prefix backend run typecheck`: 통과
- `cd backend && node --import tsx --test tests/attribution.test.ts`: 17개 테스트 통과
- `npm --prefix frontend run build`: 통과
- `GET http://localhost:7010/ads/roas`: 200
- `GET http://localhost:7020/api/ads/site-summary?date_preset=last_7d`: biocom 7일 수치 확인
- `GET http://localhost:7020/api/meta/capi/log?limit=20`: dedup summary 확인
- `GET http://localhost:7020/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7`: 최근 운영 성공분 중복 분리 확인
- headless 브라우저 `http://localhost:7010/ads`: console/request error 0건, CAPI 중복 패널 표시 확인

## 일부 해결

### 1. Pixel/CAPI dedup

중복 분리 진단과 화면 노출은 완료했지만, 전송 차단 로직은 바꾸지 않았다.

이유:

- Meta CAPI 전송 정책에 영향을 준다.
- 현재 3그룹만 실제 차단 후보로 좁혀졌지만, 바로 차단하면 정상 재처리까지 막을 위험이 있다.

다음 단계:

- 차단 후보 3그룹의 주문 로그를 먼저 검토한다.
- 문제가 반복되는 원인이 자동 sync 재시작인지, 수동 재발송인지, 다른 호출 경로인지 확인한다.
- 그 다음 `orderId + eventName` 기준 운영 성공 이력 skip guard를 적용할지 결정한다.

### 2. Ads Manager 화면 캡처/조건값

raw JSON 3개는 만들었지만, Ads Manager 화면 캡처와 export 조건값은 아직 없다.

필요 조건:

- 같은 2026-04-03 - 2026-04-09 범위
- 같은 ad account `act_3138805896402376`
- attribution setting
- report time
- timezone
- column 설정

이건 로컬 API에서 자동으로 만들 수 있는 자료가 아니라 Ads Manager UI 접근이 필요하다.

### 3. campaign drill-down

현황은 더 명확해졌지만 해결은 아직이다.

- `data/meta_campaign_alias_audit.biocom.json` 존재
- audit 범위: 2026-04-03 - 2026-04-09
- aliasCandidates 18개
- `data/meta_campaign_aliases.biocom.json` seed 15개
- manual_verified 0개
- `/api/ads/roas` biocom `last_7d`: 90건 / ₩25,551,740 전부 `(unmapped)`

결론:

사이트 전체 Attribution ROAS는 사용 가능하지만, 캠페인별 Attribution ROAS는 아직 운영 판단값으로 사용 금지다.

## 실패 / 미수행

### 1. Ads Manager 캡처는 미수행

실패라기보다 접근 조건 문제다. 브라우저에서 Meta Ads Manager 로그인/권한이 필요한 작업이라 로컬 코드 작업만으로는 완료하지 못했다.

### 2. CAPI 전송 차단 로직은 미수행

의도적으로 보류했다. 운영 전송 로직에 영향을 주는 변경이므로, 현재는 진단값 노출까지만 수행했다.

### 3. campaign alias matcher 반영은 미수행

manual_verified alias가 0개라 matcher에 태우지 않았다. 지금 상태에서 자동 매핑하면 잘못된 캠페인 ROAS가 생길 수 있다.

## 변경 파일

- `backend/src/metaCapi.ts`
- `backend/src/routes/meta.ts`
- `backend/tests/attribution.test.ts`
- `frontend/src/app/ads/page.tsx`
- `frontend/src/app/ads/roas/page.tsx`
- `data/metaroasreply.md`
- `data/ads_site_summary_last7d_20260410.json`
- `data/ads_roas_daily_biocom_last7d_20260410.json`
- `data/meta_insights_biocom_last7d_20260410.json`
- `data/metaroas2reply.md`
