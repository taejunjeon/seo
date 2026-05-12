# Current Handoff

작성 시각: 2026-05-13 01:13 KST

## 현재 목표

gpt0508-49: 승인된 더클린커피 NPay actual source patch를 VM backend에 배포했고, post-snapshot PASS 상태다. 전체 계획 문서를 읽고 `project/sprint1~3.md`까지 작성했으며, 이제 검증/commit/push만 남았다.

## 완료한 것

- VM remote backup 생성: `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-49-20260513T005354KST`.
- 승인 범위 3파일을 VM에 반영했고 remote typecheck/build PASS 후 `seo-backend` restart PASS.
- post-snapshot PASS: thecleancoffee actual source `imweb_v2_vm_cloud_imweb_orders`, status `included_with_warning`, 309건/₩14,902,800, status blank 14건/₩944,900.
- post-snapshot PASS: biocom actual source `operational_db.tb_iamweb_users PAYMENT_COMPLETE`, status `included`, 162건/₩29,463,300.
- invariants PASS: external send 0, upload 0, 운영DB write 0, GTM publish 0, raw identifier exposure false.
- source guide, data inventory, `data/!coffeedata.md`, `total/!total-current.md`를 coffee source rule에 맞게 갱신했다.
- AGENTS.md에는 요청한 성공 기준/가정 공개/Green 자율/검증 루프/사람 말 우선 보고 규칙이 이미 반영돼 있어 추가 수정하지 않았다.
- `docurule.md`, `plans.md.md`, `gdn/!gdnplan_new.md`, `data/!channelfunnel.md`를 읽고 `project/sprint1.md`, `project/sprint2.md`, `project/sprint3.md`를 작성했다.
- `gptconfirm/gpt0508-49` 결과보고/승인문서/manifest를 live deploy PASS 상태로 갱신했다.

## 다음 명령

1. `python3 scripts/validate_wiki_links.py ...`로 gptconfirm/project/정본 문서 링크를 검증한다.
2. JSON parse, `harness-preflight-check --strict`, `git diff --check`, raw pattern scan을 실행한다.
3. scoped commit/push 후 최종 보고한다.

## 절대 건드리면 안 되는 것

- 운영DB write/import, VM schema migration, cron 변경, GTM publish, Imweb footer/header 변경.
- GA4/Meta/TikTok/Google Ads/Naver send/upload.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
- GA4 revenue를 actual NPay 매출로 사용하거나 NPay click/count/add_payment_info를 구매완료로 승격.
