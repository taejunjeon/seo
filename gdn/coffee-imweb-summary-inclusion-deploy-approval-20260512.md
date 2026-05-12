# 더클린커피 Imweb actual summary 반영 승인안

작성 시각: 2026-05-12 23:34 KST
Lane: Yellow approval draft
상태: 승인 전 실행 금지

## 사람이 이해하는 설명

현재 화면은 더클린커피 NPay 매출을 `bridge_pending`으로 멈춰 둡니다. 이유는 운영DB `tb_iamweb_users`에서 더클린커피 site가 분리되지 않았기 때문입니다.

하지만 더클린커피 Imweb API와 VM Cloud `imweb_orders.site='thecleancoffee'`는 이미 주문을 분리하고 있습니다. 이 source를 summary API에 붙이면 더클린커피도 실제 NPay 결제완료에 가까운 숫자를 화면에 보여줄 수 있습니다.

## 승인하면 바뀌는 것

- 화면 조회 API가 `site=thecleancoffee`일 때 운영DB `tb_iamweb_users` 대신 VM Cloud `imweb_orders`를 읽습니다.
- NPay 클릭/결제시작이 아니라 Imweb v2 `pay_type='npay'` 주문을 봅니다.
- 취소/반품/교환 status는 제외합니다.
- `complete_time`은 계속 legacy diagnostic으로만 남깁니다.
- GA4는 결제 정본이 아니라 `already_in_ga4` guard 설계에만 씁니다.

## 승인 범위

허용:

- backend 코드 patch
- backend typecheck/test
- VM Cloud backend file deploy
- `seo-backend` restart
- post-snapshot curl 검증
- rollback readiness 확인

금지:

- 운영DB write/import
- VM Cloud schema migration
- cron 등록/변경
- GA4/Meta/TikTok/Google Ads/Naver send/upload
- GTM publish
- Imweb footer/header 변경
- secret/raw PII/order id 출력

## 예상 live 기준값

2026-05-12 23:34 KST read-only 기준:

- Imweb v2 / VM Cloud 최근 30일 coffee NPay gross: 337건 / ₩16,374,100
- 취소 제외 paid non-cancel 후보: 306건 / ₩14,577,700
- status가 확정된 non-cancel만 쓰면: 295건 / ₩13,957,900
- 취소 제외 대상: 31건 / ₩1,796,400
- status blank: 11건 / ₩619,800

권장 live 표시는 `included` + warning입니다. status blank count와 status sync freshness를 함께 보여주면 과대확정 위험을 줄일 수 있습니다.

## 성공 기준

- `https://att.ainativeos.net/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24`가 200을 반환합니다.
- `derived.npay_revenue_30d_actual_confirmed.status`가 `included`가 됩니다.
- source는 `imweb_v2_vm_cloud_imweb_orders` 또는 동등한 이름으로 표시됩니다.
- cancel excluded count/status blank count/freshness가 보입니다.
- raw email/phone/member/order/payment/click_id는 응답에 없습니다.
- external send/upload/GTM publish/운영DB write는 모두 0입니다.

## 중단 기준

- summary API 5xx
- coffee actual field missing
- `complete_time`만으로 actual included 처리
- cancel status가 제외되지 않음
- raw PII/order id 노출
- platform send/upload 또는 운영DB write 발생

## rollback

실제 rollback command는 배포 직전 backup path를 만든 뒤 확정합니다.

기본 방향:

1. 변경 전 `backend/src/npayActualConfirmedPgReader.ts`, `backend/src/siteLandingLedger.ts`, `backend/src/routes/attribution.ts`를 backup합니다.
2. 실패 시 backup 파일을 원복합니다.
3. backend build 후 `seo-backend`를 restart합니다.
4. coffee summary가 다시 `bridge_pending`으로 돌아왔는지 확인합니다.

## 승인 문구

아래 문장으로 승인하면 됩니다.

```text
[승인] gpt0508-48 더클린커피 Imweb actual summary 반영: backend 로컬 patch/test 후 VM Cloud backend deploy/restart, site=thecleancoffee summary actual included 검증, no-send/no-write/no-publish invariant 유지.
```
