TJ님, 지금은 `callprice` 프론트 UXUI 턴입니다. Claude Code에는 아래 프롬프트를 그대로 보내면 됩니다.

`/Users/vibetj/coding/seo` 프로젝트의 프론트 UXUI 작업을 진행해줘.

먼저 아래 파일을 읽고 시작해:

1. `/Users/vibetj/coding/seo/roadmap0327.md`
2. `/Users/vibetj/coding/seo/callprice.md`
3. `/Users/vibetj/coding/seo/callaction.md`
4. `/Users/vibetj/coding/seo/api.md`
5. `/Users/vibetj/coding/seo/backend/src/routes/callprice.ts`
6. `/Users/vibetj/coding/seo/backend/src/callprice.ts`
7. `/Users/vibetj/coding/seo/frontend/src/app/layout.tsx`
8. `/Users/vibetj/coding/seo/frontend/src/app/page.tsx`
9. `/Users/vibetj/coding/seo/frontend/src/components/common/ChannelTalkProvider.tsx`
10. `/Users/vibetj/coding/revenue/frontend/apps/portal/app/(pages)/dashboard/retention/page.tsx`
11. `/Users/vibetj/coding/revenue/frontend/apps/portal/app/(pages)/dashboard/ltr/page.jsx`
12. `/Users/vibetj/coding/revenue/frontend/apps/portal/app/(pages)/home/page.jsx`

현재 상황:

- Codex가 백엔드에서 `callprice` API를 이미 구현했다.
- 현재 사용 가능한 API는 아래 5개다.
  - `GET /api/callprice/options`
  - `GET /api/callprice/overview`
  - `GET /api/callprice/managers`
  - `GET /api/callprice/analysis-types`
  - `GET /api/callprice/scenario`
- `callprice.md`에는 해석까지 포함된 최신 숫자가 정리돼 있다.
- `callaction.md`에는 “상담 대기 때문에 놓치는 리드 수”를 계산하려면 어떤 로그가 필요한지 정리돼 있다.
- wait-loss는 아직 원천 로그가 부족하므로, 최종 KPI 대시보드처럼 보이면 안 된다.
- `revenue` 코드는 운영 레퍼런스일 뿐이고, 직접 수정하지 않는다.
- 실제 구현은 `/Users/vibetj/coding/seo/frontend` 에서만 한다.

중요 제약:

- 기존 `/` 페이지를 깨지 말 것
- `revenue` 원본 코드는 수정하지 말 것
- `callprice`는 지금 바로 실데이터 연결 가능
- `wait-loss`는 지금은 placeholder 또는 “데이터 준비 중” UX까지만 가능
- `공식 ROI`처럼 보이게 만들지 말 것
- 용어는 아래로 통일할 것
  - `준증분 매출`
  - `매출배수`
  - `인건비 차감 후 잔여매출`

작업 목표:

1. `seo/frontend` 안에 `callprice` 전용 내부 화면을 만든다.
2. 기존 메인 페이지를 덮어쓰지 말고, 별도 route를 우선 고려해라.
   - 예: `/callprice` 또는 내부 dashboard route
3. `callprice` API를 붙여 overview, manager ranking, analysis type drill-down, scenario 계산 UI를 만든다.
4. `상담군 vs 미상담군` 비교 섹션을 만든다.
   - 90일 전환/재구매 비교
   - 6개월/1년 LTR 비교
   - 고객당 매출 비교
5. `더 정밀한 분해` 섹션을 만든다.
   - 구매자 매출 분포 `p50/p75/p90`
   - 상품 믹스
   - 첫 구매까지 걸린 일수
6. `wait-loss` 섹션은 최종 KPI 카드가 아니라 placeholder로 만든다.
   - `callaction.md`를 요약해서
   - 현재 바로 계산 불가
   - 필요한 로그: `lead_created_at`, `slot_assigned_at`, `connected_at`, `lost_reason`, `reschedule_count`
   - 추후 산출 예정이라는 메시지를 보여라

구현 방향:

- 운영 포털 느낌은 참고하되 그대로 복제하지 말고, `seo` 프로젝트 스타일에 맞게 새로 정리해라.
- 숫자는 한국식 단위와 한국어 설명으로 보이게 해라.
- 표와 카드가 같이 있어야 한다.
- 바로 읽히는 요약 카드 + 해석 블록 + 세부 표 구조가 좋다.
- 데이터 해석 문구를 같이 보여라.
  - 예: “상담의 핵심 효과는 구매 고객 1명의 LTR 상승보다 구매 진입률 상승에 더 가깝다”
- `scenario` 숫자는 `공식 ROI`처럼 보이지 않게 하고 설명문을 반드시 붙여라.
- `estimated_incremental_profit`은 화면상 그대로 “이익”으로 쓰지 말고, 문맥상 `인건비 차감 후 잔여매출`로 번역해라.

세부 작업:

1. 현재 frontend 구조를 보고 route와 컴포넌트 구조를 먼저 정해라.
2. 공통 fetch layer나 hook이 필요하면 만들고, `callprice` API 응답 타입도 정리해라.
3. 첫 화면에는 아래가 최소로 보여야 한다.
   - 기간 / maturity / baseline 선택
   - overview KPI 카드
   - 상담사 ranking table
   - scenario panel
   - 90일 비교 섹션
   - 6개월/1년 LTR 섹션
   - 분포/상품믹스/첫 구매일수 섹션
   - wait-loss placeholder 섹션
4. 로딩/에러/빈 상태를 분리해라.
5. 모바일에서도 최소한 읽히도록 반응형 정리해라.

권장 정보 구조:

- Hero Summary
  - 현재 기준 준증분 매출, 매출배수, 잔여매출
- Overview Controls
  - date range / maturity / baseline / analysis type
- Manager Performance
  - 상담사별 순위와 sample warning
- Cohort Comparison
  - 90일 전환/재구매
  - 6개월/1년 LTR vs 고객당 매출
- Decomposition
  - p50/p75/p90
  - 상품 믹스
  - 첫 구매일수
- Wait Loss
  - 데이터 준비 상태와 다음 액션

검증:

- `cd /Users/vibetj/coding/seo/frontend && npm run build`
- 가능하면 `npm run lint`
- lint가 실패하면 이번 변경과 무관한 기존 에러인지 구분해서 보고해라
- 실제로 `callprice` route가 렌더링되는지 확인해라
- API 연결이 안 되면 어떤 endpoint에서 막히는지 명확히 적어라

응답 형식:

1. 읽은 파일과 현재 제약 요약
2. 어떤 route / component / hook 구조로 갈지 짧은 계획
3. 실제 수정 진행
4. 검증 결과
5. 추가로 Codex가 백엔드에서 해줘야 할 것이 있으면 마지막에 한 줄로 정리

중요:

- 이번 턴은 `callprice UXUI`가 메인이다.
- `wait-loss`는 final dashboard가 아니라 `준비 중인 분석 영역`으로 표현해야 한다.
- `공식 ROI`처럼 보이게 만드는 순간 해석이 틀어진다.

Claude에게 마지막으로 한 줄 더 붙이면 된다:

`기존 메인 페이지는 건드리지 말고, seo/frontend 안에 callprice 전용 route를 추가하는 쪽으로 우선 구현해줘.`
