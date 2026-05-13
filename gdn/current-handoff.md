# Current Handoff

작성 시각: 2026-05-13 16:35 KST

## 현재 목표

TikTok OFF 전후 매출 영향 감사 화면을 VM Cloud에 배포하고, TJ님이 `https://biocom.ainativeos.net/ads/tiktok/off-impact`에서 바로 볼 수 있게 한다.

## 완료한 것

- VM Cloud frontend/backend 배포 완료.
- live URL 200 확인: `https://biocom.ainativeos.net/ads/tiktok/off-impact`.
- API 404/500/terminated 대응 완료: `GET https://att.ainativeos.net/api/ads/tiktok/off-impact-audit`.
- VM Cloud SQLite `attribution_ledger` 직접 read-only 조회로 원장 계산 전환.
- TikTok Ads processed CSV 18개를 VM Cloud repo에 배치하고 read-only로 광고비/플랫폼 주장 매출 계산.
- live 핵심값: 전체 일평균 매출 -17.77%, 가장 큰 하락 Meta 광고, TikTok 광고비 1,041,554원 -> 47원, TikTok 플랫폼 주장 매출 3,218,171원 -> 0원, TikTok 미추적 가능성 27/100.
- no-send/no-write/raw identifier suppression smoke PASS.

## 다음 명령

1. `curl -sS -m 30 'https://att.ainativeos.net/api/ads/tiktok/off-impact-audit' | jq '{ok, cache:.cache, delta:.overall.deltaRevenuePct, top:.channel_shift.topDropChannels[0].label, spend_before:.tiktok_spend_and_claim.baseline.spend, spend_after:.tiktok_spend_and_claim.off.spend}'`
2. `cd backend && npm run typecheck`
3. `git diff --check`
4. `python3 scripts/harness-preflight-check.py --strict`
5. `python3 scripts/validate_wiki_links.py gptconfirm/gpt0508-52/00-result-report.md gdn/current-handoff.md`

## 절대 건드리면 안 되는 것

- TikTok 광고 ON/OFF 변경, TikTok Ads API write, TikTok Events API send.
- GA4/Meta/Google Ads/Naver 전환 전송, upload, conversion action 변경.
- 운영DB write/import, VM Cloud SQLite write/schema migration.
- GTM publish, Imweb footer/header 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
