# Current Handoff

작성 시각: 2026-05-14 02:03 KST

## 현재 목표

`/total`에서 네이버 paid/brandsearch/organic 후보를 제한 item slice가 아니라 VM Cloud 전체 aggregate 기준으로 일관되게 보여주고, 네이버 광고 URL 표준화는 1개 canary 승인안으로 좁힌다. gptconfirm 패키지는 `gptconfirm/gpt0514-3`이다.

## 완료한 것

- `gptconfirm/gpt0514-3` 자동 선택 및 문서 패키지 생성.
- local aggregate-only endpoint `GET /api/attribution/ledger/naver-evidence-aggregate` 구현.
- `/total` monthly response와 frontend에 `naver_evidence_aggregate` 표시 연결.
- 로컬 브라우저 smoke PASS: UTM 후보 표, 참고용 문구, raw id 미노출 확인.
- VM Cloud `attribution_ledger` payment_success 기준 네이버 전체 aggregate 기준값 216건 유지.
- VM Cloud `site_landing_ledger`에서 biocom.kr 직접 입력 후보가 landing-level direct로 일부 구분되는지 확인.

## 다음 명령

1. `npm run typecheck` in `backend`.
2. `npm run build` in `frontend`.
3. `jq . gptconfirm/gpt0514-3/manifest.json data/naver-evidence-aggregate-canary-20260514.json data/current-state.json`.
4. `python3 scripts/validate_wiki_links.py gptconfirm/gpt0514-3/*.md`.
5. `python3 scripts/harness-preflight-check.py --strict`.
6. `git diff --check`.
7. scoped commit/push: 이번 sprint 관련 파일만 add.

## 절대 건드리면 안 되는 것

- 운영DB write/import.
- VM Cloud SQLite write/schema migration.
- Google Ads/GA4/Meta/TikTok/Naver send/upload.
- GTM publish.
- 운영 frontend/backend deploy/restart without TJ approval.
- 네이버 후보를 budget ROAS에 자동 포함.
- raw email/phone/member_code/주문번호/결제키/click id 값 출력.
