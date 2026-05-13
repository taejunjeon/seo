# /total UX Decision Layer

작성 시각: 2026-05-13 13:05 KST  
Lane: Green local frontend/backend contract patch. Operating deploy is Yellow approval-only.

## 목표

`/total`을 엔지니어 진단 화면에서 대표가 바로 판단하는 화면으로 바꾼다. 모든 진단을 숨기는 것이 아니라, 첫 화면의 우선순위를 “판단 → 근거 → 상세 진단” 순서로 바꾼다.

## 반영한 것

로컬 주소:

- Frontend: `http://localhost:7010/total`
- Backend API: `http://localhost:7020/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run`

코드 변경:

- `frontend/src/app/total/page.tsx`
- `frontend/src/app/total/page.module.css`
- `data/project/total-correction-line-contract-20260513.json`

화면 변경:

- 상단 4개 카드 추가: 예산 판단 가능 매출, 참고용 보정 매출, 미분류/보류 매출, 데이터 연결 경고.
- `fresh`, `blocked`, `included_with_warning`, `bridge_pending` 같은 기술어를 한국어 라벨로 전환.
- 채널별 운영 액션 추가: 예산 유지, 예산 축소 후보, 데이터 연결 필요, 판단 보류.
- source/warning diagnostics는 기본 접힘 상태로 변경.
- frontend default API base를 `http://localhost:7020`으로 지정해 7010 화면에서 7020 backend를 바로 읽게 했다.

## Smoke 결과

Playwright smoke:

- URL: `http://localhost:7010/total`
- API: HTTP 200.
- Console error: 0.
- Request failed: 0.
- API 호출 실패 문구: 없음.
- 접힌 details: 4개.
- screenshot: `data/project/total-ux-decision-layer-20260513.png`

첫 화면 요약:

- 예산 판단 가능 매출: 529,470,000원대.
- 참고용 보정 매출: 15,547,500원.
- 미분류/보류 매출: 172,020,000원대.
- 데이터 연결 경고: 4개.

## 기존 화면 평가

`project/screenshot/SCR-20260513-lejr.png` 기준 기존 `/total`은 source diagnostics와 warning이 먼저 보이고, 판단해야 할 액션이 뒤에 있었다. 데이터 신뢰도는 높았지만, 대표가 첫 30초 안에 “어디를 볼지” 판단하기에는 용어와 순서가 엔지니어용이었다.

이번 patch는 `frontrule.md`의 “사람 말 우선, 카드/요약 먼저, 상세표는 뒤” 원칙을 따랐다. `frontrule.md` 자체는 업데이트할 필요가 없었다.

## 남은 판단

운영 반영은 아직 하지 않았다. 운영 frontend/backend deploy는 Yellow 승인 후 진행해야 한다.

성공 기준:

- 운영 `/total`에서도 첫 화면에 판단 카드가 보인다.
- coffee line은 `included_in_budget_roas=false`로 유지된다.
- source diagnostics는 접혀 있고 필요할 때만 펼친다.
- raw identifier는 노출되지 않는다.
