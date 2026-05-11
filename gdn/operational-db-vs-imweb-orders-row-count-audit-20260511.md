# 운영DB 211 vs imweb_orders 137 audit + site 키 path + NPay derived live (A→D→B 통합)

작성 시각: 2026-05-11 20:15 KST
**3 작업 통합: A 차이 audit + D site 키 path + B summary API derived deploy. 결론은 운영DB = biocom 단일 사이트 + imweb_orders sync 일부 누락 + summary API 에 NPay 매출 live 노출.**

## 1. 이번에 가능해진 것

직전 작업에서 "운영DB 214건 vs imweb_orders 368건" 차이의 진짜 원인이 밝혀졌다 — **운영DB tb_iamweb_users 는 biocom 전용 + imweb_orders sync 가 일부 페이지 누락**. 그리고 그 결과를 받아서 site_landing summary API 에 NPay 30일 매출 derived 필드를 추가 + 운영 배포 완료. 이제 `/api/attribution/site-landing/summary?site=biocom` 호출 한 번으로 채널 분포 + NPay 매출 둘 다 보임.

## 2. 왜 필요했는지

(1) 두 source 의 row 수 차이가 어디서 오는지 모르면 어느 쪽을 정본으로 쓸지 결정 못 함. (2) 운영DB 에 site 키가 있는지 모르면 thecleancoffee NPay 매출이 운영DB 에 있는지 없는지 단정 못 함. (3) 매출 데이터를 dashboard 가 읽을 수 있어야 의미가 있음.

## 3. 어떻게 작동하는지 (비개발자용)

- **A 작업**: 운영DB 의 NPay 30일을 결제상태 별로 쪼개고 (PAYMENT_COMPLETE 211 / REFUND_COMPLETE 19 / CANCELLED 8 / PREPARATION 7), imweb_orders 의 NPay 30일을 imweb 상태 별로 쪼갰다 (구매확정 89 / COMPLETE 34 / 취소 22 / 대기 14 / 환불 2 등).
- **D 작업**: 운영DB tb_iamweb_users 의 raw_data JSON 안 30 개 키를 모두 봤고, site 분리 후보 키 10개 (`site`, `siteCode`, `unit_code`, `channel` 등) 를 직접 query — **모두 0건**. 따라서 운영DB 는 biocom 단일 사이트.
- **B 작업**: `summarizeSiteLanding` 함수가 NPay 매출을 imweb_orders 에서 직접 계산해 `derived.npay_revenue_30d` 필드로 응답에 박음. site 별 분리, 한국어 금액 단위 (만/억), max_order_time 표시.

## 4. 실제로 확인된 결과

### 4-1. A: 운영DB 211 vs imweb_orders 137 차이 (biocom only)

| source | filter | count | 매출 |
|---|---|---:|---|
| 운영DB tb_iamweb_users (biocom) | NAVERPAY_ORDER + PAYMENT_COMPLETE + cancellation 빈값 | **211** | ₩3,762만 5,000 |
| imweb_orders biocom | pay_type='npay' + cancel/return/standby/pay_wait 제외 | **137** | (89×PURCHASE_CONFIRMATION + 34×COMPLETE + 5×DELIVERING + 9×empty) |
| **차이** | | **74건** | ~₩1,300만 |

**원인**: imweb v2 API 의 `/v2/shop/orders` 페이지네이션이 빈 페이지 회수율 낮음 (imwebapi.md §90). 수동 sync 시점에 따라 일부 페이지 누락. 운영DB 가 더 풍부.

### 4-2. D: tb_iamweb_users.raw_data 에 site 키 없음

| 후보 키 | 30d 비-null count |
|---|---:|
| `unit_code`, `unitCode`, `site`, `siteCode`, `channel`, `shop`, `shop_no`, `mall_no`, `unit`, `store` | 모두 **0** |

→ **운영DB tb_iamweb_users 는 biocom 단일 사이트 전용** 확정. thecleancoffee NPay 매출은 운영DB 에 없음. imweb v2 API → imweb_orders 만 정본.

### 4-3. B: summary API live derived 응답

`GET /api/attribution/site-landing/summary?site=biocom` 의 `derived.npay_revenue_30d`:
```json
{
  "source": "imweb_orders (imweb v2 API cached)",
  "complete_count": 121,
  "complete_amount_krw": 24323000,
  "complete_amount_krw_korean": "₩2,432만 3,000",
  "max_order_time": "2026-05-08T01:44:49.000Z"
}
```

`?site=thecleancoffee` 의 `derived.npay_revenue_30d`:
```json
{
  "source": "imweb_orders (imweb v2 API cached)",
  "complete_count": 242,
  "complete_amount_krw": 10237300,
  "complete_amount_krw_korean": "₩1,023만 7,300",
  "max_order_time": "2026-05-08T06:01:25.000Z"
}
```

## 5. 아직 안 된 것 / 새로 발견된 의문

- **양 site 의 max_order_time 이 5/8 (3일 stale)**. 같은 audit 의 직전 query (5/11 16:55, 1.3h) 와 차이. imweb_orders sync 가 사이트별 다른 빈도 가능성. 별도 audit.
- imweb v2 API sync 누락 74건 회수 — 수동 재 sync 명령 또는 cron 빈도 증가.
- 운영DB 의 환불/취소 row 까지 포함한 정합성 비교는 다음 sprint.

## 6. 검증

| 검증 | 결과 |
|---|---|
| backend `npx tsc --noEmit` | exit 0 |
| `tests/site-landing-summary-api.test.ts` fixture | 6/6 PASS (회귀 0) |
| VM `npm run build` | exit 0 |
| `pm2 restart seo-backend` | online |
| live `GET /api/attribution/site-landing/summary?site=biocom` | HTTP 200, derived.npay_revenue_30d 정상 |
| live `?site=thecleancoffee` | HTTP 200, derived.npay_revenue_30d 정상 |
| 응답 raw email/phone/jumin/카드 regex hit | 0 |
| 응답 raw order_no / channel_order_no | 0 (count + 합계만) |

## 7. 다음 액션 (REPORTING_TEMPLATE v1.3 §75)

| Owner | Action | Claude Code가 직접 가능한가 | 못 하면 이유 | 데이터 충분도 | 타이밍 점수 | 목표 영향도 | 위험도 (낮을수록 좋음) | 종합 추천 점수 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | imweb_orders max_order_time 이 5/8 (3일 stale) 인 이유 audit — site별 sync 빈도 확인 + cron 일정 확인 | YES — read-only | — | 80 | 90 | 70 | 10 | **74** | 진행 |
| Claude Code | imweb v2 API 수동 재 sync 시도 (`POST /api/crm-local/imweb/sync-orders`) — 누락 74건 회수 | YES — backend endpoint 호출, write 로컬DB only | — | 85 | 75 | 80 | 20 | **72** | 진행 (위 audit 후) |
| Claude Code | 내일 KST 18 이후 매출 join script 재실행 (CARD + NPay 모두) | YES | — | 85 | 60 | 90 | 5 | **78** | 진행 (시간 조건) |
| Claude Code | frontend site-landing 페이지에 NPay 매출 표시 추가 | YES — 1 컴포넌트 +10 LOC | — | 90 | 80 | 70 | 5 | **76** | 진행 (소형) |
| TJ님 | 운영DB tb_iamweb_users 에 thecleancoffee 추가 적재 의문 → 개발팀 협업 | NO — 개발팀 채널 / 권한 | Claude Code 가 운영팀 회의/티켓 자동 발송 불가 | 70 | 50 | 70 | 25 | **57** | 보류 (현재 imweb_orders 가 thecleancoffee NPay 정본으로 충분) |
| TJ님 | Google Ads dashboard final URL suffix 정정 | NO — Web UI 자동 조작 불가 | Container admin 권한 | 90 | 90 | 80 | 30 | **75** | 진행 |
