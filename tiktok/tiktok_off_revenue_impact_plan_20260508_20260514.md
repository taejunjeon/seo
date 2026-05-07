# TikTok 7일 OFF 매출 영향도 검증 계획

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
    - tiktok/tiktok_growth_team_report_20260505.md
    - tiktok/tiktok_off_prebaseline_20260507.md
  lane: Green
  allowed_actions:
    - OFF 테스트 계획 문서 작성
    - read-only 기준값/판정 기준 정의
    - 후속 모니터링 기준 제안
  forbidden_actions:
    - TikTok 광고 ON/OFF 변경
    - TikTok Ads API write
    - GA4/Meta/Google/TikTok 전환 전송
    - GTM Production publish
    - 운영DB write
    - TJ 관리 Attribution VM SQLite write
  source_window_freshness_confidence:
    source:
      - GA4 Data API / biocom property
      - TJ 관리 Attribution VM SQLite / attribution_ledger
      - TikTok Ads Manager dashboard value supplied by growth team
    window:
      baseline: 2026-05-01 ~ 2026-05-07 KST
      off_test: 2026-05-08 ~ 2026-05-14 KST
      post_check: 2026-05-15 KST
    freshness: 예비 baseline 2026-05-07 14:15 KST, 2026-05-07 당일은 미마감
    confidence: 89%
```

작성 시각: 2026-05-07 13:08 KST

최종 업데이트: 2026-05-07 14:15 KST

대상: TJ님, TikTok 광고 담당 그로스팀, 데이터 검증 담당

목적: 2026-05-08 ~ 2026-05-14 KST TikTok 광고 OFF 기간에 실제 매출 영향이 있었는지 판단하기 위한 기준 문서

## 한 줄 결론

TikTok 광고는 2026-05-08 ~ 2026-05-14 KST 7일간 OFF로 두고, 2026-05-15 KST에 내부 confirmed 매출 기준으로 실제 매출 영향 여부를 판단한다.

TikTok 대시보드가 2026-04-29 예산 감액 이후 약 590만원 매출을 주장했지만, GA4 구매 전환은 0건이었다. 따라서 이번 테스트의 핵심은 TikTok 대시보드 매출이 아니라, 광고를 껐을 때 실제 전체 매출이 줄어드는지를 보는 것이다.

## 이번 테스트가 답하려는 질문

1. TikTok 광고를 끄면 전체 실제 결제완료 매출이 줄어드는가?
2. TikTok 대시보드가 주장한 약 590만원 매출은 실제 사업 매출에 가까운가, 아니면 플랫폼 과대 attribution인가?
3. GA4 구매 0건과 내부 TikTok confirmed 0건이라는 현재 판단이 맞는가?
4. TikTok을 재개한다면 기존 캠페인을 켤지, 세팅/소재/반복 노출 제한을 바꾼 별도 테스트로 재개할지?

## 기간 정의

| 구간 | 날짜 | 용도 |
|---|---|---|
| Baseline | 2026-05-01 ~ 2026-05-07 KST | OFF 직전 7일 기준값 |
| OFF Test | 2026-05-08 ~ 2026-05-14 KST | TikTok 광고 OFF 상태에서 실제 매출 관찰 |
| Primary 판정 | 2026-05-15 KST | 7일 결과 1차 판정 |
| 지연 확인 | 2026-05-16 ~ 2026-05-18 KST | 결제/GA4/TikTok 보고 지연 보조 확인 |

## OFF 전 예비 baseline 집계

2026-05-07 14:15 KST 기준 예비 baseline은 아래처럼 닫았다. 단, 2026-05-07 하루가 아직 끝나지 않았으므로 최종 baseline은 2026-05-08 오전에 다시 집계한다.

세부 근거: [[tiktok_off_prebaseline_20260507]]

| 항목 | 예비값 | 해석 |
|---|---:|---|
| 전체 confirmed 주문 | 411건 | TJ 관리 Attribution VM payment_success 주문 단위 dedupe |
| 전체 confirmed 매출 | 106,941,035원 | 테스트 주문 포함 |
| 제외한 테스트 주문 | 1건 / 11,900원 | TikTok 테스트 URL 카드 결제 `202605035698347` |
| 사업 판단용 confirmed 주문 | 410건 | OFF 기간과 비교할 주문수 기준 |
| 사업 판단용 confirmed 매출 | 106,929,135원 | OFF 기간과 비교할 매출 기준 |
| TikTok strict confirmed | 0건 / 0원 | TikTok direct evidence가 payment_success에 붙은 결제완료 |
| TikTok firstTouch 후보 | 1건 / 234,000원 | strict가 아닌 보조 후보. 예산 판단 primary 아님 |
| GA4 TikTok purchase | 0건 / 0원 | GA4 session-source 기준 |
| TikTok Ads 플랫폼 구매 주장 | 12건 / 3,218,171원 | 플랫폼 귀속 주장값. primary 아님 |
| TikTok Ads 플랫폼 spend | 900,751원 | 로컬 TikTok Ads export/cache 기준 |

OFF 결과 판정에서는 `사업 판단용 confirmed 매출 106,929,135원`을 1차 기준으로 쓴다. TikTok 플랫폼 구매 주장값은 참고만 본다.

## Primary 기준과 보조 기준

| 기준 | 판단 위치 | 역할 |
|---|---|---|
| 전체 confirmed 매출 | 운영DB read-only 또는 TJ 관리 Attribution VM 보조 원장 | Primary. 실제 매출 영향 판단 |
| 전체 confirmed 주문수 | 운영DB read-only 또는 TJ 관리 Attribution VM 보조 원장 | Primary. 객단가 큰 주문 1건 왜곡 방지 |
| Meta/Google 매출 | `/ads/tiktok`, 내부 ROAS 화면, GA4 | Cross-check. 다른 채널 보완 여부 확인 |
| TikTok GA4 purchase | GA4 Data API | Cross-check. 현재 0건이 유지되는지 확인 |
| TikTok VM confirmed | TJ 관리 Attribution VM SQLite | Cross-check. TikTok evidence가 붙은 실제 결제가 있는지 확인 |
| TikTok Ads Manager 매출 | 광고 플랫폼 화면 | 참고. 예산 판단 primary로 쓰지 않음 |

운영DB는 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`다. TJ 관리 Attribution VM은 `att.ainativeos.net` 내부 SQLite다. 두 DB는 역할이 다르며, 이번 문서는 write 없이 read-only 기준만 정의한다.

## 일별 기록표

아래 표는 2026-05-08부터 매일 채우는 기준이다.

| 날짜 | TikTok spend | 전체 confirmed 주문수 | 전체 confirmed 매출 | Meta/Google confirmed | TikTok GA4 purchase | TikTok VM confirmed | 특이사항 |
|---|---:|---:|---:|---:|---:|---:|---|
| 2026-05-08 |  |  |  |  |  |  | OFF 1일차 |
| 2026-05-09 |  |  |  |  |  |  | OFF 2일차 |
| 2026-05-10 |  |  |  |  |  |  | OFF 3일차 |
| 2026-05-11 |  |  |  |  |  |  | OFF 4일차 |
| 2026-05-12 |  |  |  |  |  |  | OFF 5일차 |
| 2026-05-13 |  |  |  |  |  |  | OFF 6일차 |
| 2026-05-14 |  |  |  |  |  |  | OFF 7일차 |

## 일별 모니터링 운영 순서

매일 09:30 KST에 전날 하루를 닫아 기록한다. 2026-05-08 오전에는 OFF 전 baseline을 최종 마감하고, 2026-05-09 오전부터는 OFF 기간 하루씩 기록한다.

1. Codex가 TJ 관리 Attribution VM `/api/attribution/ledger`를 read-only로 조회해 전체 confirmed 주문수와 매출을 기록한다.
2. Codex가 `/api/ads/tiktok/roas-comparison`으로 TikTok strict confirmed, firstTouch 후보, 플랫폼 gap을 기록한다.
3. Codex가 `/api/ads/tiktok/traffic-quality`로 TikTok/Meta GA4 세션, 90% 스크롤, begin_checkout, purchase를 기록한다.
4. TJ님 또는 그로스팀은 TikTok Ads Manager에서 해당일 spend가 0원인지 확인한다. Codex가 API로 대신 가져올 수 있는지는 별도 read-only로 계속 검토한다.
5. 프로모션, 품절, 결제 장애, 다른 광고 채널 예산 변동이 있으면 특이사항에 적는다.

성공 기준:

- 2026-05-08 ~ 2026-05-14 각 날짜에 전체 confirmed, TikTok strict, TikTok firstTouch, GA4 TikTok, Meta cross-check가 같은 기준으로 기록된다.
- TikTok spend가 0원 또는 OFF 전 잔여 소진 수준인지 확인된다.
- 2026-05-15에 `중단 유지 / 제한 재개 / 보류` 중 하나로 판정할 수 있다.

## 판정 규칙

### 유지 판단

아래 조건이면 TikTok 중단 유지가 합리적이다.

1. OFF 기간 전체 confirmed 매출이 baseline 대비 크게 줄지 않는다.
2. OFF 기간 전체 confirmed 주문수가 baseline 대비 크게 줄지 않는다.
3. TikTok GA4 purchase와 VM confirmed가 계속 0건 또는 의미 없는 수준이다.
4. Meta/Google에서 실제 결제완료가 계속 발생한다.

해석: TikTok 대시보드 매출은 실제 사업 매출보다 플랫폼 attribution 주장값일 가능성이 높다.

### 재개 검토

아래 조건이면 TikTok 재개를 검토한다.

1. OFF 기간 전체 confirmed 매출이 baseline 대비 뚜렷하게 하락한다.
2. 하락이 Meta/Google 예산 변경, 프로모션 종료, 재고, 사이트 장애로 설명되지 않는다.
3. OFF 이후에도 2~3일 동안 매출 회복이 없다.

해석: TikTok이 직접 구매 또는 assisted 구매에 기여했을 가능성이 있다. 단, 바로 기존 캠페인을 켜기보다 소재/세팅을 바꾼 제한 재테스트가 우선이다.

### 보류 판단

아래 조건이면 추가 7일 또는 제한 재테스트가 필요하다.

1. OFF 기간에 다른 채널 예산도 크게 바뀐다.
2. 대형 프로모션, 품절, 사이트 장애, 결제 장애가 겹친다.
3. 특정 고액 주문 1~2건 때문에 매출이 크게 흔들린다.

해석: TikTok OFF 효과만 분리하기 어렵다.

## 스마트+ 랜딩 URL 가설 체크

그로스팀 가설: 2026-04-29 수요일 예산 감액과 동시에 TikTok 스마트+ 캠페인이 머신러닝으로 UTM 세팅 URL이 아닌 다른 페이지로 랜딩시켰을 수 있다.

현재 판단: 최초 세팅 시점부터 스마트 세팅을 진행했다면, 2026-04-29 이후 갑자기 생긴 핵심 원인일 가능성은 낮다. 그래도 보조 검산으로는 확인한다.

확인 방법:

1. TikTok Ads Manager에서 캠페인별 Destination URL, Smart+ landing page 확장 설정, URL 확장 옵션을 캡처한다.
2. GA4에서 TikTok sessionSource/sessionCampaignName 기준 landing page 분포를 2026-04-29 전후로 비교한다.
3. TJ 관리 Attribution VM에서 `ttclid`는 있으나 UTM이 없는 `marketing_intent` 비중이 2026-04-29 이후 늘었는지 read-only로 확인한다.

판정:

- 2026-04-29 이후 UTM 없는 TikTok landing이 급증하면 랜딩/UTM 이슈를 재검토한다.
- 급증이 없으면 스마트+ 랜딩 URL 가설은 주 원인에서 제외한다.

## 2026-05-15 보고서에 포함할 내용

1. OFF 기간 전체 confirmed 매출과 주문수
2. 직전 7일 baseline 대비 증감
3. Meta/Google 매출 변화
4. TikTok GA4 purchase 변화
5. TikTok VM confirmed 변화
6. TikTok Ads Manager 매출 주장값 변화
7. 스마트+ 랜딩/UTM 가설 확인 결과
8. 최종 권고: 중단 유지 / 제한 재개 / 추가 보류

## 다음 액션

| 순서 | Lane | 담당 | 할 일 | 의존성 | 성공 기준 | 승인 필요 |
|---:|---|---|---|---|---|---|
| 1 | Red | TJ + 그로스팀 | 2026-05-08 00:00 KST부터 TikTok 광고 OFF | 광고 계정 운영 권한 | OFF 기간 TikTok spend 0원 또는 잔여 소진만 발생 | YES |
| 2 | Green | Codex | 2026-05-08 오전 최종 baseline 마감 | 2026-05-07 하루가 끝난 뒤 재조회 필요 | baseline confirmed, GA4, VM 지표 최종값 기록 | NO |
| 3 | Green | Codex | 2026-05-08 ~ 2026-05-14 일별 모니터링 | OFF 실행 완료 | 일별 표 업데이트 | NO |
| 4 | Green | 그로스팀 | Smart+ landing/URL 설정 캡처 | TikTok Ads Manager 권한 | 설정명과 적용 위치 확인 | NO |
| 5 | Green | Codex | 2026-05-15 1차 결과 보고서 작성 | OFF 기간 종료 | 중단 유지/재개/보류 중 하나로 판정 | NO |

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

- Lane: Green
- Mode: 계획 문서 작성 + 예비 baseline read-only 집계
- No-send verified: YES
- No-write verified: YES
- No-deploy verified: YES
- No-publish verified: YES
- No-platform-send verified: YES
- 운영DB write: NO
- TJ 관리 Attribution VM SQLite write: NO
- 판단 confidence: 89%
- Note: 2026-05-07은 미마감이라 2026-05-08 오전 최종 baseline 재집계가 필요하다.
