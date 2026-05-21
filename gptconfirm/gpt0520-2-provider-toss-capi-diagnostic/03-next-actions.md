# Next Actions

## Codex

1. 최신 done_or_paid 1건 재확인
   - 왜: auto-sync 주기 지연인지 실제 sync 누락인지 분리한다.
   - 어떻게: 다음 CAPI auto-sync 주기 이후 같은 진단 스크립트를 read-only로 재실행한다.
   - 성공 기준: safe_c91fae5453이 CAPI success log에 들어오면 timing delay로 종료.
   - 실패 시: sync path bug로 보고 단건 dry-run/patch를 이어간다.

2. VM Cloud 배포 승인안 작성
   - 왜: 취소/환불 row를 no-send skip으로 명확히 분류하는 로컬 패치를 운영 반영하기 위해서다.
   - 어떻게: `backend/src/metaCapi.ts`만 배포 대상으로 잡고 build/typecheck/post-check 절차를 작성한다.
   - 성공 기준: 기존 CAPI success 0 regression, canceled/refunded row no-send skip, DONE row 정상 send 후보 유지.

## TJ님

현재 바로 누를 외부 화면 작업은 없다. backfill 승인도 아직 필요 없다.

## 추천

우선 30-60분 뒤 최신 done_or_paid 1건이 자동으로 들어오는지 확인하는 것을 추천한다. 추천 점수 91%.
