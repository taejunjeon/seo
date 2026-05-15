# Current Handoff

작성 시각: 2026-05-15 23:40 KST

## 현재 목표

gpt0515-24 today Meta attribution truth table을 닫고, 지금까지 누적된 안전한 코드/문서 산출물을 raw identifier 없이 커밋·푸시한다.

## 완료한 것

- 오늘 2026-05-15 KST 바이오컴 기준 Meta truth table 작성 완료.
- VM Cloud confirmed purchase 61건 / 17,494,197원 확인.
- Meta strong evidence 결제완료 24건 / 9,157,467원 확인.
- Meta CAPI Purchase 56건, events_received=56, 실패 0, duplicate event_id 0 확인.
- Ads Manager today purchase 0 확인. 현재는 12-24h lag 가능성으로 분류.
- 프론트 `/api/ads/roas` today ROAS는 Ads Manager ROAS가 아니라 내부 귀속 ROAS임을 확인.
- 백엔드 typecheck/build PASS, attribution/funnel-health 핵심 테스트 47/47 PASS.
- 프론트 신규 conversion-funnel 페이지 단위 lint PASS. 전체 frontend lint는 기존 legacy lint 오류로 FAIL.

## 다음 명령

1. 안전 파일만 `git add` 한다.
2. staging raw identifier scan을 실행한다.
3. `python3 scripts/harness-preflight-check.py --strict`
4. `git diff --cached --check`
5. commit 후 `git push origin main`

## 절대 건드리면 안 되는 것

- raw order/payment/click/member/email/phone 값이 들어간 원본 evidence commit.
- Meta 운영 Purchase 추가 send/backfill.
- Google Ads/GA4/TikTok/Naver send/upload.
- VM Cloud deploy/restart.
- 운영DB write/import.
- GTM publish.
- Imweb header/footer 저장.
