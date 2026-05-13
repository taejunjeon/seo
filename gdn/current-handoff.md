# Current Handoff

작성 시각: 2026-05-13 15:52 KST

## 현재 목표

TikTok 광고 OFF 전후 매출 하락이 TikTok 미추적인지, 아니면 Google/Meta/Naver/오가닉 등 다른 채널 변화인지 사람이 바로 판단할 수 있는 감사표와 프론트 화면을 만든다.

## 완료한 것

- Backend read-only API 추가: `GET /api/ads/tiktok/off-impact-audit`.
- Frontend 화면 추가: `http://localhost:7010/ads/tiktok/off-impact`.
- 기존 TikTok ROAS 화면에서 새 감사표로 가는 링크 추가.
- `fbp` 같은 Meta 픽셀 흔적만 있는 결제완료를 Meta 광고 성과로 확정하지 않도록 `Meta 광고`와 `Meta 픽셀 흔적`을 분리.
- 2026-05-01 ~ 2026-05-07 vs 2026-05-08 ~ 2026-05-12 기준 전체 일평균 매출 -2,876,049원 / -17.77%.
- 채널별 하락: Meta 광고 -2,304,761원/일, Naver 광고 후보 -517,077원/일, 자연 소셜 -371,800원/일, TikTok 광고 -33,429원/일, Google 광고 +41,143원/일.
- TikTok 미추적 가능성 27/100, 플랫폼 과대 attribution 가능성 70/100.
- 문서 추가: `tiktok/tiktok_mistracking_audit_20260513.md`.
- 500 `terminated` 오류 대응: VM Cloud 원격 read 재시도, 서버 파일 캐시, 브라우저 localStorage 저장본 표시 추가.
- 화면 UX 보강: 계산 중 progress bar 표시, 새 계산 중에도 기존 결과 유지, 같은 기간은 저장본으로 즉시 표시.

## 다음 명령

1. `python3 scripts/validate_wiki_links.py tiktok/tiktok_mistracking_audit_20260513.md gdn/current-handoff.md`
2. `python3 scripts/harness-preflight-check.py --strict`
3. `git diff --check`
4. `cd backend && npm run typecheck`
5. `cd frontend && npx tsc --noEmit`
6. `curl -sS -m 90 'http://localhost:7020/api/ads/tiktok/off-impact-audit' | jq '{ok, cache:.cache, overall:.overall.deltaRevenuePct, top:.channel_shift.topDropChannels[0].label, send:.invariants.no_send, write:.invariants.no_write}'`

## 절대 건드리면 안 되는 것

- TikTok 광고 ON/OFF 변경, TikTok Ads API write, TikTok Events API send.
- GA4/Meta/Google Ads/Naver 전환 전송, upload, conversion action 변경.
- 운영DB write/import, VM Cloud SQLite write/schema migration.
- GTM publish, 운영 frontend/backend deploy/restart.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
