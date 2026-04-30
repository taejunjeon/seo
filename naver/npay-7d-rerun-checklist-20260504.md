# NPay 7일치 후보정 재실행 체크리스트

작성 시각: 2026-04-30 21:30 KST
실행 가능 시각: 2026-05-04 18:10 KST 이후
관련 문서: [[!npayroas]], [[npay-roas-dry-run-20260430]], [[npay-phase2-followup-20260430]]
Confidence: 88%

## 10초 요약

2026-05-04 18:10 KST 이후 같은 로직으로 7일치 dry-run을 다시 돌린다.

목적은 자동 dispatcher를 바로 여는 것이 아니라, 현재 3일치에서 보인 A급/B급/ambiguous/clicked_no_purchase 패턴이 7일치에서도 유지되는지 확인하는 것이다.

## 실행 전 주의

`202604302383065`는 2026-04-30 21:23 KST에 GA4 MP 제한 테스트로 이미 전송했다. 그래서 재실행 때는 `--ga4-present=202604302383065`를 반드시 넣어 중복 후보에서 제외한다.

## 실행 명령

VM 안에서 실행할 때:

```bash
cd /home/biocomkr_sns/seo/repo/backend
NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --ga4-present=202604302383065 \
  --ga4-robust-absent-file=../naver/npay-ga4-robust-absent-production-a-20260430.txt \
  --format=markdown \
  --output=../naver/npay-roas-dry-run-20260504.md
```

로컬에서 VM SQLite snapshot을 받아 실행할 때:

```bash
cd /Users/vibetj/coding/seo/backend
NPAY_INTENT_DB_PATH=/tmp/seo-npay-roas-20260504.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --ga4-present=202604302383065 \
  --ga4-robust-absent-file=../naver/npay-ga4-robust-absent-production-a-20260430.txt \
  --format=markdown \
  --output=../naver/npay-roas-dry-run-20260504.md
```

## 판정 기준

| 지표 | Go 기준 |
|---|---|
| A급 strong 비율 | confirmed NPay 주문의 50% 이상 |
| ambiguous 비율 | 10% 이하 권장 |
| purchase_without_intent 비율 | 20% 이하 |
| BigQuery guard 확인률 | dispatcher 후보 주문 100% |
| 이미 전송한 주문 차단 | `202604302383065`은 `already_in_ga4=present`, `send_candidate=N` |

## 7일치에서 꼭 볼 것

1. `202604289063428`, `202604295198830`처럼 같은 상품 반복 클릭이 얼마나 자주 나오는가.
2. B급 금액 불일치가 장바구니/수량/할인으로 설명되는가.
3. `clicked_no_purchase` 상위 상품이 바이오밸런스, 뉴로마스터, 당당케어로 유지되는가.
4. Google 기반 `gclid+fbp` 미결제 클릭 비중이 계속 80% 이상인가.
5. GA4 MP 제한 테스트 주문이 BigQuery에 들어왔는가.

## 금지선

7일치 리포트가 나와도 자동 dispatcher는 별도 승인 전까지 열지 않는다.

- DB `match_status` 업데이트 금지
- GA4 대량 전송 금지
- Meta CAPI 전송 금지
- TikTok Events API 전송 금지
- Google Ads 전환 전송 금지
