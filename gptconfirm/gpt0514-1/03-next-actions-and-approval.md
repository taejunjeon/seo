# Next Actions And Approval

작성 시각: 2026-05-14 00:55 KST

## 추천 판단

운영 배포 승인안을 다음 단계로 만드는 것을 추천한다. 이번 변경은 `/total`의 판단층을 더 명확하게 하는 read-only 표시 개선이고, 운영DB write나 광고 전송이 없다.

## Codex가 할 일

1. `/total` unknown drilldown 운영 배포 승인안 작성
- 추천 점수/자신감: 88%.
- 의존성: 없음. Green 문서 작성은 바로 가능, 실제 배포는 TJ님 승인 필요.
- 무엇을 하는가: backend/frontend 파일 변경 범위, pre/post snapshot, rollback 조건을 승인 문서로 만든다.
- 왜 하는가: 로컬에서만 보이는 blocker table을 운영 화면에 올리기 위해서다.
- 어떻게 하는가: `backend/scripts/monthly-evidence-join-dry-run.ts`, `backend/src/routes/total.ts`, `frontend/src/app/total/page.tsx` 중심으로 배포 범위와 검증 명령을 적는다.
- 성공 기준: 운영 `/total` API 200, unknown 5개 blocker 표시, no-send/no-write 유지.
- 실패 시 다음 확인점: API 5xx, 합계 불일치, raw identifier 노출 여부.
- 승인 필요 여부: 문서 작성 NO, 실제 deploy/restart YES.

2. 구독 최초 유입 archive lookup dry-run
- 추천 점수/자신감: 82%.
- 의존성: 운영 배포와 독립. 병렬 가능.
- 무엇을 하는가: 첫 구독 시작 26건 / 1,000,875원의 과거 유입을 archive에서 찾을 수 있는지 aggregate dry-run을 만든다.
- 왜 하는가: 구독 재결제는 분리됐고, 남은 첫 구독 unknown을 더 줄일 수 있기 때문이다.
- 어떻게 하는가: raw 회원값 출력 없이 내부 join 가능 여부만 count/revenue로 분리한다.
- 성공 기준: `first_acquisition_channel_found`, `archive_lookup_needed`, `member_key_missing`가 더 명확해진다.
- 승인 필요 여부: Green read-only는 NO.

3. Search Advisor export 연동 설계
- 추천 점수/자신감: 74%.
- 의존성: Search Advisor 데이터 접근 방식 확인 필요.
- 무엇을 하는가: query/page/day aggregate를 `/total` 참고 설명에 붙이는 설계를 만든다.
- 왜 하는가: 주문 단위 매출 배정은 못 하지만, 네이버 검색어 설명에는 유용하다.
- 성공 기준: Search Advisor가 actual 매출 source가 아니라 aggregate explanation source로만 표시된다.
- 승인 필요 여부: read-only 설계 NO, 외부 계정 연동/자동 수집은 YES.

## TJ님이 할 일

1. 운영 배포 승인 여부 결정
- 추천 점수/자신감: 88%.
- 의존성: 없음.
- 무엇을 승인하는가: `/total` unknown drilldown v0.3 backend/frontend 운영 배포.
- 왜 필요한가: TJ님이 실제 운영 URL에서 blocker를 보고 추적 보강 우선순위를 결정하기 위해서다.
- 어떻게 확인하나: 승인 후 `https://biocom.ainativeos.net/total`에서 바이오컴 탭을 열고 미분류 매출 table을 확인한다.
- 성공 기준: 2026년 5월 unknown 510건 / 123,632,702원과 5개 blocker가 표시된다.
- 실패 시 다음 확인점: 운영 API smoke, source freshness, rollback snapshot.
- Codex가 대신 못 하는 이유: 실제 운영 deploy/restart는 Yellow Lane이라 TJ님 승인 전 실행하지 않는다.
