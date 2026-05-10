# Frontend dashboard start plan - 2026-05-10

## 결론
프론트엔드는 지금 바로 시작하지 말고, backend no-send 데이터 계약이 1차로 고정된 뒤 Claude Code로 구현하는 것을 추천한다. 현재는 Google Ads/운영DB/VM Cloud/BigQuery 지표의 의미가 빠르게 바뀌고 있어 화면부터 만들면 다시 고칠 가능성이 높다.

## 시작 조건
1. ConfirmedPurchasePrep same-window input이 반복 실행 가능해야 한다.
2. Google Ads last_7d/last_30d 조회가 VM route 또는 로컬 script 중 하나로 안정화되어야 한다.
3. campaign_id join 후보표가 최소 click-id confirmed 주문 31건 수준으로 결정되어야 한다.
4. BigQuery funnel coverage warning이 화면에 표시 가능한 상태여야 한다.
5. send_candidate=false/no upload/no platform send 상태가 UI에 명확히 보이도록 scorecard schema가 있어야 한다.

## 추천 순서
- Phase F0: Backend data contract freeze. Codex 담당.
- Phase F1: Wireframe and dashboard route proposal. Codex 문서 초안 + TJ 확인.
- Phase F2: Claude Code implementation. 주요 화면은 Claude Code가 구현.
- Phase F3: Codex verification. API schema, no-send guard, screenshot QA, regression check.

## 첫 화면
1. Google Ads ROAS=플랫폼 주장값 vs 내부 confirmed ROAS=실제 결제완료 원장 기준값
2. NPay click/count vs actual confirmed purchase 분리
3. campaign budget readiness table
4. BigQuery funnel coverage warning
5. Red Lane guard: upload/send/publish 현재 0

## 지금 시작하지 않는 이유
- VM dashboard route는 현재 status 200이지만 dashboard last_7d/last_30d가 502다.
- BigQuery는 실제 suffix가 3일치라 7/14/30 trend가 아직 HOLD다.
- campaign-level internal ROAS는 click-id matched floor만 산출된 상태다.

## 시작 추천 시점
이번 gpt0508-29 다음 batch에서 VM dashboard route hardening 또는 stable data export가 끝나면 frontend F0/F1을 시작한다. 구현은 Claude Code, 검증과 운영 금지선 체크는 Codex가 맡는다.
