# Current Handoff

작성 시각: 2026-05-13 00:30 KST

## 현재 목표

gpt0508-49: 더클린커피 NPay 실제 결제 매출을 VM Cloud `imweb_orders(site='thecleancoffee')` 기준으로 로컬 summary API에 연결하고, 배포 전 code/test/dry-run/source guide/gptconfirm/approval packet까지 완료한다. VM backend deploy/restart는 승인 전 금지다.

## 완료한 것

- `gptconfirm/gpt0508-49` 패키지 폴더를 만들고 sprint checkpoint를 시작했다.
- `backend/src/npayActualConfirmedPgReader.ts`에 site router를 추가했다. biocom은 운영DB `tb_iamweb_users PAYMENT_COMPLETE`, thecleancoffee는 `imweb_v2_vm_cloud_imweb_orders` source를 쓴다.
- summary API response에 coffee gross/excluded/status_blank/freshness/GA4 guard 필드를 연결했다.
- typecheck PASS, 핵심 테스트 16/16 PASS.
- VM Cloud read-only dry-run: gross 339건/₩16,631,400, included_with_warning 후보 308건/₩14,835,000, confirmed_status_only 295건/₩13,957,900, status blank 13건/₩877,100.
- source guide, data inventory, `data/!coffeedata.md`, `total/!total-current.md`를 coffee source rule에 맞게 갱신했다.
- AGENTS.md에는 요청한 성공 기준/가정 공개/Green 자율/검증 루프/사람 말 우선 보고 규칙이 이미 반영돼 있어 추가 수정하지 않았다.

## 다음 명령

1. `gptconfirm/gpt0508-49` 문서 5개 이하 + manifest를 완성한다.
2. `python3 scripts/harness-preflight-check.py --strict`, JSON parse, wiki link check, `git diff --check`, raw pattern scan을 실행한다.
3. 문제 없으면 scoped commit/push 한다.

## 절대 건드리면 안 되는 것

- 운영DB write/import, VM backend deploy/restart, VM schema migration, cron 변경, GTM publish, Imweb footer/header 변경.
- GA4/Meta/TikTok/Google Ads/Naver send/upload.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
- GA4 revenue를 actual NPay 매출로 사용하거나 NPay click/count/add_payment_info를 구매완료로 승격.
