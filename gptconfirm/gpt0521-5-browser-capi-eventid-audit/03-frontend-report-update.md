# Frontend report update

## Updated file

- `frontend/src/app/ai-crm/capi-report/page.tsx`

## Added content

새 섹션:

- `Browser Purchase와 Server CAPI를 섞어 쓸지`

추가 설명:

- Browser Purchase가 무엇인지.
- Server CAPI가 무엇인지.
- eventID가 같아야 Meta가 같은 구매로 합친다는 점.
- 현재 Server CAPI는 duplicate 0으로 안정적이라는 점.
- Browser eventID는 VM Cloud read-only만으로 확정할 수 없다는 점.

비교표:

- CAPI-only 유지: 운영 기본값.
- Browser Purchase + CAPI 혼합: 조건부 테스트.
- Browser Purchase-only: 비추천.

## User-facing wording goal

보고서는 기술자용 결론보다 운영자가 바로 판단할 수 있는 문장으로 구성했다.

핵심 문구:

> 현재 운영 기본값은 CAPI-only입니다. Browser+CAPI 혼합은 Meta Events Manager 또는 Network 샘플에서 같은 eventID가 확인될 때만 테스트해야 합니다.

## Deployment status

로컬 코드 반영만 완료했다. VM frontend deploy는 이번 Green Lane 범위에서 하지 않았다.
