# gpt0508-51 Result Report

작성 시각: 2026-05-13 22:52 KST
Owner: Codex
Lane: Red approved limited creation attempted / blocked_access_permission

## 이번에 가능해진 것

Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 전환 통로(`BI confirmed_purchase`)를 만들 수 있는지 확인했다. 현재 API 연결은 읽기는 되지만 전환 action 생성 권한은 없어, 실제 생성은 Google Ads API `ACTION_NOT_PERMITTED`로 막혔다.

## 왜 필요했는지

기존 `구매완료(7130249515)`는 여전히 Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호다. 새 action은 Secondary 전환=입찰에는 쓰지 않고 관찰만 하는 보조 신호로 만들려는 단계였고, upload/send는 승인 범위 밖이었다.

## 실제 확인된 결과

- `BI confirmed_purchase`: 생성 안 됨.
- blocker: Google Ads API v22 `conversionActions:mutate validateOnly`에서 HTTP 403 / `ACTION_NOT_PERMITTED`.
- 기존 `구매완료(7130249515)`: `ENABLED`, `PURCHASE`, `primary_for_goal=true` 유지.
- 기존 NPay count action `7564830949`: `ENABLED`, `PURCHASE`, `primary_for_goal=false` 유지.
- active campaign rows last_30d: 6.
- upload/send/Data Manager ingest/enhanced conversion send/campaign budget change: 0.

## 아직 안 된 것

새 action id는 없다. 따라서 24h/72h/7d 관찰 clock도 아직 시작하지 않는다. TJ님이 UI에서 직접 만들거나, 현재 API principal에 conversion action mutate 권한을 열어준 뒤 post-check를 다시 해야 한다.

## 검증

- backend typecheck PASS.
- pre-snapshot JSON parse PASS.
- post-snapshot JSON parse PASS.
- result JSON parse PASS.
- wiki link validation PASS.
- harness preflight strict PASS.
- Google Ads upload/send 0.
- 운영DB write 0.
- GTM publish 0.

## 확인 문서

1. `gdn/google-ads-option3-observe-action-result-20260513.md` — 막힌 이유와 TJ님 UI 생성 설정.
2. `data/project/google-ads-option3-observe-action-result-20260513.json` — post-check 구조화 결과.
3. `backend/scripts/google-ads-option3-observe-action.ts` — post-check 재실행 스크립트.

## 다음 할 일

### TJ님

1. Google Ads UI에서 `BI confirmed_purchase`를 직접 만들지 결정한다.
   - 화면: Google Ads > Goals > Conversions > Summary.
   - 설정: Import from clicks / Purchase / Secondary observe only.
   - 주의: 기존 `구매완료(7130249515)`와 NPay count label은 변경하지 않는다.
   - 성공 기준: 새 action이 Secondary로 보이고 action id가 확인된다.
   - 추천 점수/자신감: 88%.

### Codex

1. TJ님이 UI 생성 후 post-check를 실행한다.
   - 무엇: action id, `primaryForGoal=false`, custom goal 미포함, 기존 구매완료 unchanged 확인.
   - 승인 필요: NO, read-only.
   - 성공 기준: post-check PASS 후 24h/72h/7d 관찰 계획 시작.
   - 추천 점수/자신감: 94%.
