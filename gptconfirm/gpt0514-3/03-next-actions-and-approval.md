# 03. 다음 액션과 승인

## 현재 목표

네이버 유입 후보를 `/total`에서 전체 aggregate 기준으로 보여주고, 실제 광고 URL 표준화는 1개 canary만 승인받아 진행한다.

## 완료한 것

- gpt0514-3 패키지 생성.
- aggregate-only endpoint 로컬 구현.
- `/total` response/frontend 연결.
- local browser/API smoke.
- biocom.kr 직접 입력 유입의 현재 구분 수준 확인.

## 다음 명령

운영 반영 승인 후에만 실행한다.

```bash
cd /home/biocomkr_sns/seo/repo/backend
npm run typecheck
npm run build
pm2 restart seo-backend --update-env
```

운영 반영 전 pre-snapshot:

```bash
curl -sS 'https://att.ainativeos.net/api/attribution/ledger?source=biocom_imweb&captureMode=live&limit=1' >/tmp/naver-ledger-pre.json
curl -sS 'https://att.ainativeos.net/api/total/monthly-channel-summary?site=biocom&month=2026-05' >/tmp/total-pre.json
```

운영 반영 후 post-snapshot:

```bash
curl -sS 'https://att.ainativeos.net/api/attribution/ledger/naver-evidence-aggregate?source=biocom_imweb&captureMode=live&startAt=2026-04-30T15:00:00.000Z&endAt=2026-05-31T15:00:00.000Z'
curl -sS 'https://att.ainativeos.net/api/total/monthly-channel-summary?site=biocom&month=2026-05'
```

## 절대 건드리면 안 되는 것

- 운영DB write.
- VM Cloud schema migration/write.
- Google Ads/GA4/Meta/TikTok/Naver send/upload.
- GTM publish.
- Imweb footer/header 변경.
- 네이버 후보를 budget ROAS에 자동 포함.
- raw order/payment/click/member/email/phone 출력.

## Codex가 할 일

1. 운영 반영 승인안 작성과 배포 전후 smoke 준비. 성공 기준은 운영 endpoint가 aggregate-only로 216 기준을 반환하고 `/total`이 fallback 경고 없이 보여주는 것이다. 승인 필요 여부는 Yellow. 의존성은 TJ님 deploy 승인. 추천 점수/자신감 88%.
2. direct typed revenue drilldown을 Green으로 이어간다. 성공 기준은 VM Cloud `site_landing_ledger direct`와 `attribution_ledger payment_success`가 order-level aggregate로 닫히는지 확인하는 것이다. 승인 필요 없음. 의존성 없음. 추천 점수/자신감 81%.

## TJ님이 할 일

1. 네이버 URL canary 1개 캠페인/광고그룹 실행 여부 승인. 실제 화면은 Naver Ads 광고그룹/소재 URL 설정이다. 성공 기준은 24~72시간 후 신규 클릭이 VM Cloud `site_landing_ledger`와 `attribution_ledger`에 같은 UTM/NaPm으로 남는 것이다. 실패 시 redirect query string 제거 여부를 본다. Codex가 대신 못 하는 이유는 실제 외부 광고 계정 설정 변경이기 때문이다. 승인 필요 YES. 추천 점수/자신감 86%.
