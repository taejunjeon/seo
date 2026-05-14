# Current Handoff

작성 시각: 2026-05-14 03:01 KST

## 현재 목표

`/total`이 네이버 후보를 VM Cloud 전체 aggregate 기준으로 읽게 만든 VM Cloud backend 반영을 닫고, Naver Ads URL 표준화는 1개 광고그룹 UI canary로 넘긴다. gptconfirm 패키지는 `gptconfirm/gpt0514-4`다.

## 완료한 것

- VM Cloud backend deploy/restart PASS.
- `GET /api/attribution/ledger/naver-evidence-aggregate` 200.
- `/api/total/monthly-channel-summary?site=biocom&month=2026-05` 200.
- 네이버 aggregate: paid 352 / brandsearch 326 / organic candidate 0 / referrer-only 12.
- `budgetRoasIncluded=false`, `rawIdentifierOutput=false` 확인.
- Naver Ads read-only URL audit 완료. API URL update는 unsafe/blocked, UI canary로 전환.

## 다음 명령

1. `python3 scripts/validate_wiki_links.py gptconfirm/gpt0514-4/*.md`
2. `python3 scripts/harness-preflight-check.py --strict`
3. scoped `git add` 후 commit/push: backend Naver aggregate deploy docs + canary audit.

## 절대 건드리면 안 되는 것

- 운영DB write/import.
- VM Cloud SQLite schema migration.
- Google Ads/GA4/Meta/TikTok/Naver conversion send/upload.
- GTM publish.
- Imweb footer/header change.
- 네이버 후보를 budget ROAS에 자동 포함.
- raw email/phone/member_code/주문번호/결제키/click id 값 출력.
