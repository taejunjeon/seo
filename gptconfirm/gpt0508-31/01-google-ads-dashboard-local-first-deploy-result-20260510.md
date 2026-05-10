# Google Ads dashboard local_first limited deploy result - 2026-05-10

## 5줄 요약

1. VM Cloud Google Ads dashboard `last_30d` 502는 인증 문제가 아니라 dashboard route가 내부 원장을 공개 HTTPS로 다시 호출하면서 느려지는 문제로 확인했다.
2. 승인 범위 안에서 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first`를 VM backend에 반영하고 PM2를 1회 restart했다.
3. 배포 후 `/api/google-ads/status`, `last_7d`, `last_30d` 모두 HTTP 200이다. `last_30d`는 502에서 200으로 회복했다.
4. Google Ads ROAS는 플랫폼 주장값이고, 내부 confirmed ROAS는 실제 결제완료 원장 기준값이다. 화면/예산 판단에서는 둘을 분리해야 한다.
5. Google Ads upload, send_candidate=true, GTM publish, raw PII/order/payment logging 증가는 모두 0이다.

## Smoke 결과

- status after: HTTP 200 / 0.899985s
- dashboard last_7d after: HTTP 200 / 4.357099s
- dashboard last_30d after: HTTP 200 / 3.0286s
- last_7d platform_roas_reference: 11.700718743761232
- last_7d internal_confirmed_roas: 0.4
- last_30d platform_roas_reference: 9.580324933126128
- last_30d internal_confirmed_roas: 0.27

## 배포 범위

- VM env: `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first`
- PM2 restart: 1회
- backup: `/home/biocomkr_sns/seo/shared/deploy-backups/20260510-200221_google_ads_dashboard_local_first`
- route behavior: dashboard가 공개 HTTPS 원장 endpoint를 다시 호출하지 않고 같은 프로세스의 SQLite 원장을 먼저 읽음

## 금지선 준수

- Google Ads upload 0
- platform send 0
- send_candidate=true 0
- actual_send_candidate=true 0
- raw email/phone/order/payment log delta 0
- GTM Production publish 0

## 다음 의미

이제 프론트엔드는 VM dashboard API를 기준으로 Google Ads 플랫폼 주장 ROAS와 내부 confirmed ROAS를 같은 화면에 분리 표시할 수 있다. 다만 upload/send는 계속 HOLD다.
