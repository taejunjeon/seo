# TikTok OFF 전 예비 baseline 집계

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - docurule.md
    - tiktok/tiktok_off_revenue_impact_plan_20260508_20260514.md
    - tiktok/!tiktokroasplan.md
  lane: Green
  allowed_actions:
    - read-only baseline query
    - local API read
    - documentation update
    - audit
  forbidden_actions:
    - TikTok 광고 ON/OFF 변경
    - TikTok Ads API write
    - TikTok Events API send
    - GA4/Meta/Google 전환 전송
    - GTM Production publish
    - 운영DB write
    - TJ 관리 Attribution VM SQLite write
  source_window_freshness_confidence:
    source:
      - TJ 관리 Attribution VM /api/attribution/ledger read-only
      - localhost:7020 /api/ads/tiktok/traffic-quality read-only
      - localhost:7020 /api/ads/tiktok/roas-comparison read-only
      - TikTok Ads local export cache
    window: 2026-05-01 ~ 2026-05-07 KST
    freshness: 2026-05-07 14:15 KST, 2026-05-07 당일은 미마감
    confidence: 89%
```

작성 시각: 2026-05-07 14:15 KST

대상: TJ님, TikTok 광고 담당 그로스팀, 데이터 검증 담당

목적: 2026-05-08 ~ 2026-05-14 TikTok 광고 OFF 테스트와 비교할 OFF 전 기준값을 예비로 고정한다.

## 한 줄 결론

2026-05-01 ~ 2026-05-07 KST 예비 baseline은 실제 전체 결제완료 주문 기준 `410건 / 106,929,135원`으로 본다.

이 값은 TJ 관리 Attribution VM의 payment_success를 주문 단위로 중복 제거한 뒤, 우리가 만든 TikTok 테스트 주문 `202605035698347 / 11,900원`을 제외한 값이다. 2026-05-07 하루가 아직 끝나지 않았으므로, 2026-05-08 오전에 같은 방식으로 최종 baseline을 다시 닫아야 한다.

## 왜 예비 baseline인가

2026-05-07 14:15 KST 기준으로 2026-05-07 데이터는 아직 반나절만 들어와 있다. 그래서 지금 숫자는 OFF 실행 전 의사결정용 예비값이다.

최종 비교 기준은 2026-05-08 오전에 2026-05-07 23:59:59 KST까지 들어온 주문을 다시 조회해 닫는다.

## 데이터 위치와 기준

| 항목 | 값 |
|---|---|
| Primary source | TJ 관리 Attribution VM `https://att.ainativeos.net/api/attribution/ledger` read-only |
| Primary 의미 | 실제 사이트에서 수집한 checkout/payment_success 보조 원장 |
| 운영DB write | 없음 |
| TJ 관리 Attribution VM SQLite write | 없음 |
| 로컬 개발 DB write | 없음 |
| Query window | 2026-05-01 00:00:00 ~ 2026-05-07 23:59:59 KST |
| 실제 freshness | latest loggedAt `2026-05-07T05:14` UTC 근처, 즉 2026-05-07 14:14 KST 근처 |
| confidence | 89%. 2026-05-07 미마감이라 최종 baseline은 2026-05-08 재집계 필요 |

주의할 점:

- `/api/ads/site-summary`는 기간 전체에서 `marketing_intent` row가 많으면 10,000 row 제한 영향을 받을 수 있다.
- 그래서 OFF 매출 영향 판단의 primary는 날짜별 TJ 관리 Attribution VM ledger 직접 조회와 주문 단위 dedupe다.
- TikTok/Meta/GA4 품질 비교는 `/api/ads/tiktok/traffic-quality`를 보조 기준으로 쓴다.

## OFF 전 예비 baseline

| 항목 | 값 | 해석 |
|---|---:|---|
| 전체 confirmed 주문 | 411건 | TJ 관리 Attribution VM payment_success 주문 단위 dedupe |
| 전체 confirmed 매출 | 106,941,035원 | 테스트 주문 포함 |
| 제외한 테스트 주문 | 1건 / 11,900원 | `202605035698347`, TikTok 테스트 URL 카드 결제 |
| 사업 판단용 confirmed 주문 | 410건 | 테스트 주문 제외 |
| 사업 판단용 confirmed 매출 | 106,929,135원 | OFF 기간과 비교할 예비 기준값 |
| pending 주문 | 39건 | 대부분 금액 0원으로 수집. 24시간 자동취소/확정 sync 관찰 대상 |
| canceled 주문 | 7건 / 3,045,000원 | confirmed 기준에는 넣지 않음 |

## 일별 예비 baseline

2026-05-07은 아직 미마감이다. 2026-05-08 오전에 2026-05-07 값을 다시 닫는다.

| 날짜 | 전체 confirmed 주문 | 전체 confirmed 매출 | TikTok strict confirmed | TikTok firstTouch 후보 | 비고 |
|---|---:|---:|---:|---:|---|
| 2026-05-01 | 63 | 14,782,219원 | 0 / 0원 | 0 / 0원 | 마감 |
| 2026-05-02 | 44 | 10,804,751원 | 0 / 0원 | 0 / 0원 | 마감 |
| 2026-05-03 | 58 | 15,173,621원 | 0 / 0원 | 테스트 1건 / 11,900원 제외 | 테스트 주문 `202605035698347` 포함 원자료 |
| 2026-05-04 | 74 | 20,780,583원 | 0 / 0원 | 0 / 0원 | 마감 |
| 2026-05-05 | 61 | 18,224,294원 | 0 / 0원 | 1건 / 234,000원 | strict가 아닌 assisted 후보 |
| 2026-05-06 | 77 | 19,022,740원 | 0 / 0원 | 0 / 0원 | 마감 |
| 2026-05-07 | 34 | 8,152,827원 | 0 / 0원 | 0 / 0원 | 14:15 KST 기준 미마감 |

## TikTok vs Meta 예비 품질 비교

| 항목 | TikTok | Meta | 해석 |
|---|---:|---:|---|
| GA4 세션 | 20,796 | 22,629 | 유입량 자체는 TikTok도 충분하다 |
| 평균 세션 시간 | 121초 | 113초 | 체류시간만 보면 TikTok이 나쁘지 않다 |
| 90% 스크롤 이벤트 | 287회 / 1.38% | 3,162회 / 13.97% | 깊게 읽는 비율은 Meta가 약 10배 높다 |
| GA4 begin_checkout | 1회 / 약 0.005% | 315회 / 1.39% | 결제 시작 진입은 Meta가 압도적으로 높다 |
| GA4 구매 | 0건 / 0원 | 139건 / 약 4,129만원 | GA4 기준 TikTok 구매는 0 |
| VM strict TikTok confirmed | 0건 / 0원 | 해당 없음 | TikTok 증거가 payment_success에 직접 붙은 결제완료 0 |
| VM TikTok firstTouch 후보 | 1건 / 234,000원 | 해당 없음 | strict가 아니라 assisted 후보. 예산 판단 primary로 쓰지 않음 |
| VM Meta confirmed 보조 | 해당 없음 | 136건 / 34,450,439원 | 같은 수집 구조에서 Meta는 결제완료가 잡힌다 |

## TikTok 플랫폼 주장값과 내부 기준 차이

| 항목 | 값 | 해석 |
|---|---:|---|
| TikTok Ads 플랫폼 spend | 900,751원 | 로컬 TikTok Ads export/cache 기준 |
| TikTok Ads 플랫폼 구매 | 12건 / 3,218,171원 | 플랫폼 귀속 주장값 |
| 내부 strict TikTok confirmed | 0건 / 0원 | 실제 결제완료 원장에 TikTok 직접 근거 없음 |
| 내부 firstTouch TikTok 후보 | 1건 / 234,000원 | 보조 후보. strict confirmed가 아님 |
| 설명 안 된 플랫폼 gap | 3,218,171원 | 플랫폼 주장값 - 내부 strict confirmed |

현재 해석:

- TikTok이 실제 구매를 전부 만들었는데 우리가 못 잡고 있을 가능성은 낮다.
- 이유는 같은 수집 구조에서 Meta는 checkout, payment_success, confirmed가 대량으로 잡히기 때문이다.
- 다만 `202605052023943 / 234,000원`처럼 firstTouch 후보가 1건 생겼으므로, OFF 테스트에서는 전체 매출 변화도 함께 봐야 한다.

## 일별 모니터링 계획

모니터링 목적은 TikTok 플랫폼 대시보드가 아니라 실제 사업 매출이 줄었는지 확인하는 것이다.

| 날짜 | Codex 확인 시점 | 확인할 대상 | 성공 기준 |
|---|---|---|---|
| 2026-05-08 | 09:30 KST | 최종 baseline 마감 | 2026-05-01 ~ 2026-05-07 전체 confirmed가 최종값으로 닫힘 |
| 2026-05-09 | 09:30 KST | OFF 1일차, 2026-05-08 결과 | TikTok spend 0원 또는 잔여 소진만 확인, 전체 confirmed 기록 |
| 2026-05-10 | 09:30 KST | OFF 2일차, 2026-05-09 결과 | 전체 confirmed와 Meta/Google 보조 지표 기록 |
| 2026-05-11 | 09:30 KST | OFF 3일차, 2026-05-10 결과 | 주말/요일 효과 메모 |
| 2026-05-12 | 09:30 KST | OFF 4일차, 2026-05-11 결과 | 평일 회복 여부 확인 |
| 2026-05-13 | 09:30 KST | OFF 5일차, 2026-05-12 결과 | TikTok GA4/VM 신호가 계속 0인지 확인 |
| 2026-05-14 | 09:30 KST | OFF 6일차, 2026-05-13 결과 | baseline 대비 누적 차이 확인 |
| 2026-05-15 | 09:30 KST | OFF 7일차 포함 최종 1차 판정 | 중단 유지 / 제한 재개 / 보류 중 하나로 판정 |

## 매일 기록할 값

매일 같은 기준으로 아래 값을 기록한다.

1. 전체 confirmed 주문수와 매출
   - 위치: TJ 관리 Attribution VM `/api/attribution/ledger` read-only
   - 의미: TikTok을 껐을 때 실제 사업 매출이 줄었는지 보는 primary

2. TikTok strict confirmed
   - 위치: `/api/ads/tiktok/roas-comparison`
   - 의미: TikTok evidence가 직접 붙은 실제 결제완료가 있는지 확인

3. TikTok firstTouch 후보
   - 위치: `/api/ads/tiktok/roas-comparison`
   - 의미: TikTok 클릭 후 같은 브라우저/세션 후보가 있는지 확인. strict confirmed로 승격하지 않음

4. GA4 TikTok purchase / begin_checkout / scroll
   - 위치: `/api/ads/tiktok/traffic-quality`
   - 의미: TikTok 유입이 결제 시작까지 가는지 확인

5. Meta 보조 지표
   - 위치: `/api/ads/tiktok/traffic-quality`
   - 의미: 같은 수집 구조가 살아 있는지 확인하는 cross-check

6. TikTok Ads Manager spend
   - 위치: TikTok Ads Manager
   - 의미: OFF가 실제로 유지됐는지 확인. Codex가 API로 자동 수집 가능한지 계속 보조 검토

## 판정 기준

### 중단 유지

아래면 중단 유지가 맞다.

- OFF 기간 전체 confirmed 매출이 baseline 대비 크게 줄지 않는다.
- TikTok strict confirmed가 계속 0이다.
- GA4 TikTok purchase도 계속 0이다.
- Meta/Google 또는 자연 검색에서 결제완료가 정상적으로 잡힌다.

추천 자신감: 90%

### 제한 재개

아래면 기존 캠페인 그대로 재개하지 말고, 제한 재테스트를 검토한다.

- OFF 후 전체 confirmed 매출이 baseline 대비 뚜렷하게 빠진다.
- 같은 기간 Meta/Google 예산, 프로모션, 재고, 사이트 장애로 설명되지 않는다.
- TikTok firstTouch 후보 또는 GA4 TikTok 결제 시작이 같이 늘어난 흔적이 있다.

추천 자신감: 65%

### 보류

아래면 판단을 보류한다.

- 2026-05-08 ~ 2026-05-14 중 프로모션, 품절, 결제 장애, 다른 광고 채널 예산 변경이 크다.
- 고액 주문 1~2건으로 일 매출이 크게 흔들린다.
- 2026-05-07 최종 baseline이 예비값과 크게 달라진다.

추천 자신감: 70%

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

- Lane: Green
- Mode: read-only baseline aggregation + documentation
- No-send verified: YES
- No-write verified: YES
- No-deploy verified: YES
- No-publish verified: YES
- No-platform-send verified: YES
- 운영DB write: NO
- TJ 관리 Attribution VM SQLite write: NO
- 로컬 개발 DB write: NO
- 주요 note: 2026-05-07은 미마감이므로 2026-05-08 오전 최종 baseline 재집계가 필요하다.
