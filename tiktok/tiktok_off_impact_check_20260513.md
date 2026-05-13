# TikTok 광고 OFF 및 매출 영향 중간 확인

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
    - tiktok/!tiktokroasplan.md
    - tiktok/tiktok_off_revenue_impact_plan_20260508_20260514.md
    - tiktok/tiktok_off_prebaseline_20260507.md
  lane: Green
  allowed_actions:
    - read-only API 확인
    - VM Cloud 보조 원장 summary 조회
    - 로컬 TikTok Ads cache 확인
    - 결과 문서 작성
  forbidden_actions:
    - TikTok 광고 ON/OFF 변경
    - TikTok Ads API write
    - TikTok Events API send
    - GA4/Meta/Google Ads 전환 전송
    - GTM publish
    - 운영DB write
    - VM Cloud SQLite write
  source_window_freshness_confidence:
    source:
      - TikTok Business API read-only dry-run
      - 로컬 TikTok Ads cache: data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260507_20260512.csv
      - VM Cloud SQLite 보조 원장: att.ainativeos.net /api/attribution/ledger source=biocom_imweb captureMode=live
      - 로컬 backend read-only API: /api/ads/tiktok/roas-comparison, /api/ads/tiktok/traffic-quality
    window:
      baseline: 2026-05-01 ~ 2026-05-07 KST
      off_partial: 2026-05-08 ~ 2026-05-12 KST
      current_day_spend_check: 2026-05-13 KST partial
    freshness: 2026-05-13 14:53 KST
    confidence: 88%
```

작성 시각: 2026-05-13 14:55 KST

## 10초 요약

TikTok 광고는 효율이 낮다고 판단해 2026-05-08부터 2026-05-14까지 OFF 테스트로 둔 것이 맞다. spend 기준으로는 2026-05-08에 47원 잔여 소진만 있었고, 2026-05-09부터 2026-05-13 확인 시점까지 0원이다.

OFF 전에도 내부 기준 TikTok 직접 결제완료 기여는 0원이었다. OFF 뒤에도 0원이다. 전체 매출은 OFF 뒤 5일 평균 기준 약 18% 낮지만, TikTok 직접 기여가 사라져서 빠졌다고 단정할 근거는 아직 없다.

## 확인한 결론

### 1. 광고비를 끈 이유와 실행 여부

- 기존 계획 문서의 운영 결론은 `2026-05-08 ~ 2026-05-14 KST TikTok 광고 OFF 후 2026-05-15에 실제 매출 영향 확인`이다.
- 이유는 TikTok 대시보드가 2026-04-29 예산 감액 이후 매출을 주장했지만, GA4 구매 전환과 VM Cloud 내부 결제완료 기준 TikTok 매출이 0원에 가까웠기 때문이다.
- 로컬 TikTok Ads cache 기준 2026-05-08 spend는 47원이고, 2026-05-09 ~ 2026-05-12 spend는 0원이다.
- TikTok Business API read-only dry-run 기준 2026-05-13 확인 시점 spend, impression, click, purchase 모두 0이다.
- 캠페인 토글 화면 자체는 이번 확인에서 열지 않았다. 다만 spend 기준으로는 광고비 OFF가 맞다.

### 2. OFF 전후 TikTok 기여

| 구간 | TikTok spend | TikTok 플랫폼 주장 매출 | 내부 strict TikTok confirmed | 내부 firstTouch 후보 | GA4 TikTok purchase |
|---|---:|---:|---:|---:|---:|
| 2026-05-01 ~ 2026-05-07 | 1,041,554원 | 3,218,171원 | 0건 / 0원 | 1건 / 234,000원 | 0건 / 0원 |
| 2026-05-08 ~ 2026-05-12 | 47원 | 0원 | 0건 / 0원 | 0건 / 0원 | 0건 / 0원 |

해석:
- TikTok이 만든 실제 결제완료 매출은 OFF 전에도 내부 strict 기준으로는 0원이었다.
- OFF 뒤에는 TikTok 유입 흔적 자체가 크게 줄었다. VM Cloud 보조 원장 기준 TikTok marketing intent는 20,547행에서 254행으로 줄었다.
- 그러나 결제완료로 이어진 TikTok strict 매출은 양쪽 모두 0원이다.

### 3. OFF 뒤 전체 매출 변화

전체 매출 기준은 VM Cloud SQLite 보조 원장 `source=biocom_imweb`, `captureMode=live`, `payment_success.paymentStatus=confirmed` summary다. 내부 테스트 주문 1건 / 11,900원은 baseline 사업 판단값에서 제외했다.

| 구간 | 사업 판단용 confirmed 주문 | 사업 판단용 confirmed 매출 | 일평균 주문 | 일평균 매출 |
|---|---:|---:|---:|---:|
| 2026-05-01 ~ 2026-05-07 | 435건 | 114,033,223원 | 62.14건 | 16,290,460원 |
| 2026-05-08 ~ 2026-05-12 | 260건 | 66,550,987원 | 52.00건 | 13,310,197원 |

중간 변화:
- 일평균 주문: -10.14건, -16.32%
- 일평균 매출: -2,980,263원, -18.29%

해석:
- OFF 뒤 5일의 전체 매출은 baseline보다 낮다.
- 다만 아직 7일 OFF 테스트가 끝나지 않았고, 기간 길이와 요일 구성이 다르다.
- 더 중요한 점은 TikTok 직접 결제완료 기여가 OFF 전에도 0원이었다는 것이다. 따라서 현재 데이터만으로는 `TikTok을 꺼서 매출이 빠졌다`보다 `전체 매출은 낮아졌지만 TikTok 직접 기여 감소로 설명되지는 않는다`가 더 정확하다.

## 판단

현재 판단은 `TikTok 광고비를 끈 것은 맞고, 그 이유도 효율성 의심이 맞다`이다.

매출 영향은 아직 최종 판정 전이다. 2026-05-08 ~ 2026-05-12 중간값만 보면 전체 매출은 낮아졌지만, TikTok direct/strict 기여가 OFF 전후 모두 0원이므로 TikTok을 바로 다시 켤 근거로는 약하다.

## 다음 할일

### Auto Green

#### A1. 2026-05-15에 7일 OFF 결과 최종 마감
- 무엇을 하는가: 2026-05-08 ~ 2026-05-14 전체 confirmed 매출, TikTok strict confirmed, firstTouch 후보, GA4 TikTok purchase, TikTok spend를 같은 기준으로 닫는다.
- 왜 하는가: 5일 중간값은 요일과 미마감 영향이 있어 재개/중단 판단 근거로 부족하다.
- 어떻게 하는가: VM Cloud 보조 원장 summary와 로컬 backend read-only API를 7일 window로 다시 조회한다.
- 성공 기준: `중단 유지`, `제한 재개`, `보류` 중 하나로 판정 가능하다.
- 실패 시 다음 확인점: 다른 채널 예산 변경, 프로모션, 재고, 결제 장애 여부를 분리한다.
- 승인 필요 여부: NO, Green.
- 의존성: 시간 도달 필요. 2026-05-15 오전 이후 실행.

### Approval Needed

#### B1. TikTok 재개 여부는 7일 결과 이후 결정
- 무엇을 하는가: 기존 캠페인 재개, 제한 재테스트, 중단 유지 중 하나를 선택한다.
- 왜 하는가: 광고비를 다시 켜면 비용이 바로 발생한다.
- 어떻게 하는가: 2026-05-15 결과 보고서의 내부 confirmed ROAS와 전체 매출 변화를 보고 결정한다.
- 성공 기준: 예산 판단에 쓸 값과 참고만 볼 값을 분리한 결정이 나온다.
- 실패 시 다음 확인점: TikTok Ads Manager가 주장한 매출이 내부 결제완료와 계속 맞지 않는지 확인한다.
- 승인 필요 여부: YES, 광고비 운영 결정.
- 의존성: A1 완료 필요.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

- Lane: Green
- No-send verified: YES
- No-write verified: YES for 운영DB and VM Cloud SQLite
- No-platform-send verified: YES
- No-deploy verified: YES
- No-publish verified: YES
- 로컬 영향: `/tmp/tiktok-api-check-20260513`에 read-only TikTok API dry-run 파일 생성. repo에는 본 보고서만 추가.
- Confidence: 88%
- Note: 캠페인 토글 UI 자체는 확인하지 않았고, spend 결과로 OFF 상태를 판단했다.
