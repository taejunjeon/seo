# Current Handoff

작성 시각: 2026-05-12 23:44 KST

## 현재 목표

더클린커피 Imweb API 키와 GA4 BigQuery를 이용해 VM Cloud에 더클린커피 주문만 분리되는 actual order source를 구축할 수 있는지 검토했다. 이번 턴은 Green Lane: read-only 검토, dry-run, 문서/checkpoint 갱신, scoped commit/push까지 완료했다.

## 완료한 것

- gpt0508-47 Option C live 배포는 biocom actual included PASS, thecleancoffee bridge_pending 유지 PASS 상태로 완료됐다.
- 루트 `AGENTS.md`, 공통 harness, coffee harness, `imwebapi.md`, `data/!coffeedata.md`를 재확인했다.
- `.env`에는 더클린커피 Imweb API key/secret과 GA4 coffee key들이 설정돼 있음을 값 노출 없이 확인했다.
- 코드상 기존 `crmLocal` Imweb sync는 `site=thecleancoffee`를 지원하고, 현재 summary API는 coffee actual을 운영DB site 격리 미검증 때문에 bridge_pending으로 고정한다.
- VM Cloud `imweb_orders.site='thecleancoffee'`는 최신 주문 source로 확인됐다. 최근 30일 Imweb v2 `type=npay`는 337건/₩16,374,100, `order_code`와 `channel_order_no`는 337/337 채워져 있다.
- 취소 status 31건/₩1,796,400을 제외하면 paid non-cancel 후보는 306건/₩14,577,700이다. status blank 11건/₩619,800은 warning 또는 pending 처리 대상이다.
- GA4 BigQuery `analytics_326949178`은 337건의 order/channel key 674개를 robust search했지만 hit 0건이었다. 결제 정본이 아니라 `already_in_ga4` guard로만 쓴다.
- source guide와 feasibility JSON/MD, Yellow 승인안 초안을 작성했다.
- 검증 PASS: JSON parse, wiki links, harness preflight, git diff check, no-send/no-write grep docs-only.
- commit/push 완료: `ddb3a72 gdn: document coffee imweb source feasibility`.

## 다음 명령

1. 다음 Green 로컬 patch에서 coffee용 Imweb actual reader를 추가한다.
2. patch/test PASS 후 `gdn/coffee-imweb-summary-inclusion-deploy-approval-20260512.md` 기준으로 Yellow deploy/restart 승인 여부를 TJ님이 결정한다.
3. 승인 전에는 live summary API를 바꾸지 않는다.

## 절대 건드리면 안 되는 것

- 운영DB write/import, VM Cloud schema migration/apply, backend deploy/restart, cron 등록/변경, GTM publish, Imweb footer/header 변경.
- GA4/Meta/TikTok/Google Ads/Naver actual send/upload.
- `.env` secret 값 출력 또는 커밋.
- raw email/phone/member_code/order/payment/click_id 출력.
- 기존 unrelated dirty file: `tiktok/fetchresult.md`, 루트 `=`, `tiktok/monitoring/*2026-05-10*`, `tiktok/monitoring/*2026-05-11*`.
