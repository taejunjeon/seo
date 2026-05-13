# TikTok 미추적 가능성 감사표와 OFF 전후 채널 변화

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - docurule.md
    - frontrule.md
    - tiktok/!tiktokroasplan.md
    - tiktok/tiktok_off_impact_check_20260513.md
  lane: Green
  allowed_actions:
    - VM Cloud 보조 원장 read-only 조회
    - 로컬 backend read-only API 구현
    - 로컬 frontend 페이지 구현
    - GA4 read-only 교차검증
    - 로컬 TikTok Ads cache / TikTok Business API read-only 확인
  forbidden_actions:
    - TikTok 광고 ON/OFF 변경
    - TikTok Ads API write
    - TikTok Events API send
    - GA4/Meta/Google Ads/Naver 전환 전송
    - 운영DB write
    - VM Cloud SQLite write
    - GTM publish
    - 운영 frontend/backend deploy
  source_window_freshness_confidence:
    source:
      primary: VM Cloud SQLite 보조 원장 / att.ainativeos.net /api/attribution/ledger source=biocom_imweb captureMode=live
      cross_check:
        - GA4 Data API / biocom property / session source-medium
        - 로컬 TikTok Ads daily cache + TikTok Business API read-only dry-run
      implemented_view: 로컬 frontend http://localhost:7010/ads/tiktok/off-impact
    window:
      baseline: 2026-05-01 ~ 2026-05-07 KST
      off_partial: 2026-05-08 ~ 2026-05-12 KST
    freshness: 2026-05-13 15:28 KST
    confidence: 86%
```

작성 시각: 2026-05-13 15:28 KST

## 10초 요약

TikTok 광고 OFF 뒤 전체 결제완료 매출은 일평균 16,186,246원에서 13,310,197원으로 내려갔다. 하락은 사실이지만, VM Cloud 보조 원장 기준 TikTok 직접 결제완료는 OFF 전에도 0원, OFF 후에도 0원이다.

채널별로 나누면 하락분은 TikTok보다 Meta 광고 근거가 강한 결제완료에서 가장 크게 잡힌다. Google 광고 라인은 같은 기준에서 오히려 소폭 증가했다. 단, 이 표는 예산 최종 확정 원장이 아니라 `VM Cloud 보조 원장 유입 근거 분류`이므로 7일 OFF 마감 뒤 다시 닫아야 한다.

## 무엇이 가능해졌나

- 사람이 보는 로컬 화면이 생겼다: `http://localhost:7010/ads/tiktok/off-impact`
- 새 read-only API가 생겼다: `GET http://localhost:7020/api/ads/tiktok/off-impact-audit`
- TikTok 미추적 가능성을 5개 질문으로 점수화한다.
- TikTok 광고 OFF 전후 매출 하락이 Google, Meta, Naver, 자연 소셜, 자연 검색 중 어디서 주로 잡히는지 나눠 본다.
- Meta는 `fbclid/fbc 또는 paid UTM`이 있는 결제완료와 `fbp 등 픽셀 흔적만 있는 결제완료`를 분리했다. 픽셀 흔적만 있는 row를 Meta 광고 성과로 확정하지 않는다.

## OFF 전후 전체 변화

| 기준 | OFF 전 2026-05-01 ~ 2026-05-07 | OFF 후 2026-05-08 ~ 2026-05-12 | 일평균 변화 |
|---|---:|---:|---:|
| 결제완료 주문 | 433건 | 260건 | -9.86건 / 일 |
| 결제완료 매출 | 113,303,723원 | 66,550,987원 | -2,876,049원 / 일 |
| 일평균 매출 | 16,186,246원 | 13,310,197원 | -17.77% |

해석:
- 매출은 줄었다.
- 다만 이 감소를 TikTok 직접 결제완료 감소로 설명하기는 어렵다.
- 이유는 TikTok direct/strict 결제완료가 OFF 전에도 0원이고 OFF 후에도 0원이기 때문이다.

## 채널별로 어디가 줄었나

| 채널 분류 | OFF 전 일평균 매출 | OFF 후 일평균 매출 | 일평균 변화 | 관측 하락 설명 비중 | 판단 |
|---|---:|---:|---:|---:|---|
| Meta 광고 | 8,222,790원 | 5,918,029원 | -2,304,761원 | 80.14% | 가장 크게 줄었다. `fbclid/fbc 또는 paid UTM` 근거 기준이다. |
| Naver 광고 후보 | 1,022,317원 | 505,240원 | -517,077원 | 17.98% | 보조 근거다. Naver paid UTM / nclick 계열 근거를 더 정밀화해야 한다. |
| 자연 소셜 | 532,580원 | 160,780원 | -371,800원 | 12.93% | 광고 식별자가 없는 소셜 referrer 기준이다. |
| 자연 검색 | 39,714원 | 0원 | -39,714원 | 1.38% | 규모가 작다. |
| TikTok 광고 | 33,429원 | 0원 | -33,429원 | 1.16% | firstTouch 후보 1건 / 234,000원을 일평균으로 환산한 수준이다. |
| Google 광고 | 154,857원 | 196,000원 | +41,143원 | 해당 없음 | 감소가 아니라 소폭 증가했다. |
| Meta 픽셀 흔적 | 6,113,245원 | 6,354,557원 | +241,312원 | 해당 없음 | `fbp` 같은 픽셀 흔적만 있어 Meta 광고 성과로 확정하지 않는다. |

주의:
- 이 표는 `VM Cloud 보조 원장`의 유입 근거 분류다.
- 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`를 직접 쓴 것이 아니다.
- 광고 플랫폼이 주장하는 ROAS와 내부 결제완료 매출은 다른 이름으로 봐야 한다.

## TikTok 미추적 가능성 감사표

| 감사 질문 | 현재 답 | 점수 | 근거 | 의미 |
|---|---|---:|---|---|
| 광고비가 실제로 꺼졌나 | 낮음 | 8/100 | OFF 기간 TikTok spend 47원, baseline 1,041,554원 | spend 기준으로는 광고 중단 상태로 볼 수 있다. |
| 유입 수집 자체를 못 했나 | 낮음 | 22/100 | OFF 전 TikTok 유입 row 20,543건, OFF 후 254건 | TikTok 클릭/유입 수집점은 살아 있었다. 완전 미수집 가능성은 낮다. |
| 결제 연결에서 놓쳤나 | 중간 | 42/100 | OFF 전 TikTok checkout 후보 2건, strict confirmed 0원, firstTouch 후보 234,000원 | 직접 결제 근거는 없지만 assisted 후보는 남는다. |
| GA4가 TikTok 구매를 못 봤나 | 낮음 | 24/100 | GA4 TikTok purchase revenue baseline 0원, OFF 0원 | GA4 교차검증에서도 TikTok 구매가 보이지 않는다. |
| view-through / 다른 기기 구매 가능성 | 남아있음 | 40/100 | TikTok 플랫폼 주장 매출 3,218,171원과 내부 strict 0원 사이에 gap이 있다 | 사용자가 광고를 보고 나중에 검색/직접/다른 기기로 구매한 효과는 strict 원장만으로 완전히 닫기 어렵다. |

종합:
- TikTok 미추적 가능성 점수: 27/100
- TikTok 플랫폼 과대 attribution 가능성 점수: 70/100
- 현재 추천: 대규모 미추적보다는 플랫폼 과대 attribution 가능성이 더 크다. 2026-05-08 ~ 2026-05-14 7일 OFF 결과를 닫고 제한 재테스트 여부를 결정한다.

## 구현 위치

- Backend: `backend/src/routes/ads.ts`
  - `GET /api/ads/tiktok/off-impact-audit`
  - VM Cloud 보조 원장을 날짜별로 read-only 조회한다.
  - TikTok Ads cache / GA4 Data API를 read-only로 교차검증한다.
  - raw 식별자는 응답에 넣지 않는다.
- Frontend: `frontend/src/app/ads/tiktok/off-impact/page.tsx`
  - 대표가 바로 볼 수 있는 KPI 카드, 채널별 하락 row, 미추적 가능성 감사표를 제공한다.
  - 기존 TikTok ROAS 페이지에서 새 화면으로 가는 링크를 추가했다.

## 검증

| 검증 | 결과 |
|---|---|
| Backend typecheck | PASS |
| Frontend typecheck | PASS |
| API smoke | PASS: `ok=true`, 전체 일평균 매출 -17.77%, top drop `Meta 광고`, no-send/no-write true |
| Desktop Playwright smoke | PASS: 타이틀, Meta/Naver/Google/Meta pixel row, 감사표 렌더 |
| Mobile Playwright smoke | PASS: 390px 폭에서 horizontal overflow false |
| 외부 전송 | 0 |
| 운영DB write | 0 |
| VM Cloud SQLite write | 0 |
| GTM publish | 0 |

## 다음 할일

### Auto Green

#### A1. 7일 OFF 마감 재계산
- 무엇을 하는가: 2026-05-08 ~ 2026-05-14 전체를 같은 API로 다시 계산한다.
- 왜 하는가: 현재 값은 2026-05-08 ~ 2026-05-12 5일 중간값이다.
- 어떻게 하는가: `GET /api/ads/tiktok/off-impact-audit?baseline_start=2026-05-01&baseline_end=2026-05-07&off_start=2026-05-08&off_end=2026-05-14`
- 성공 기준: `중단 유지`, `제한 재테스트`, `추적 보강 후 보류` 중 하나로 판단 가능하다.
- 승인 필요 여부: NO, Green.

#### A2. Meta/Naver 분류 정밀화
- 무엇을 하는가: Meta paid 근거와 Naver paid 후보 근거를 더 세분화한다.
- 왜 하는가: Meta는 이번에 `fbp`를 분리했지만, Naver 후보는 아직 medium/source 룰을 더 잠글 필요가 있다.
- 어떻게 하는가: raw 식별자 없이 reason code별 aggregate만 추가한다.
- 성공 기준: `paid 확정`, `pixel/cookie only`, `organic/referral`, `unknown`이 더 명확히 나뉜다.
- 승인 필요 여부: NO, Green.

### Approval Needed

#### B1. TikTok 광고 재개 여부 결정
- 무엇을 하는가: 7일 OFF 마감 뒤 `중단 유지`, `소액 제한 재테스트`, `추적 보강 후 보류` 중 하나를 결정한다.
- 왜 하는가: 광고비를 다시 켜면 비용이 바로 발생한다.
- 어떻게 하는가: 로컬 화면 `http://localhost:7010/ads/tiktok/off-impact`에서 7일 OFF window로 재계산한 결과를 보고 결정한다.
- 성공 기준: 예산 판단에 쓸 값과 참고만 볼 값을 분리한 결정이 나온다.
- 승인 필요 여부: YES. 광고비 운영 결정은 TJ님 승인 대상이다.
