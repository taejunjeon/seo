# Google Ads 캠페인별 신호 감사 및 NPay 변경 확인

작성 시각: 2026-05-05 09:32 KST
대상: biocom Google Ads account `2149990943`, Google tag `AW-304339096`
문서 성격: read-only 캠페인 성과/전환 신호 감사
관련 문서: [[!gdnplan]], [[google-ads-npay-purchase-contamination-report-20260505]], [[google-ads-npay-quality-deep-dive-20260505]], [[google-ads-purchase-primary-change-approval-20260505]], [[google-ads-confirmed-purchase-execution-approval-20260505]], [[../total/!total]], [[../GA4/gtm]]
Lane: Green
Mode: No-send / No-write / No-deploy / No-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  source_window_freshness_confidence:
    google_ads_api:
      source: "Google Ads API v22 customers/2149990943"
      script: "backend/scripts/google-ads-campaign-signal-audit-readonly.ts"
      output: "data/google-ads-campaign-signal-audit-20260505-last14.json"
      window: "LAST_14_DAYS"
      fetched_at: "2026-05-05 11:39 KST"
      confidence: 0.94
    ga4_bigquery_archive:
      source: "project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*"
      script: "backend/scripts/biocom-npay-signal-change-readonly.ts"
      output: "data/biocom-npay-signal-change-20260505.json"
      window: "2026-04-18~2026-05-03"
      mode: "read-only SELECT"
      confidence: 0.88
  allowed_actions:
    - Google Ads API read-only query
    - GA4 BigQuery archive read-only SELECT
    - local JSON export
    - documentation
  forbidden_actions:
    - Google Ads conversion action mutation
    - Google Ads conversion upload
    - GTM publish
    - backend deploy
    - operating DB write
    - external platform event send
```

## 10초 결론

`1번 affected campaign/bid strategy 조회`와 `2번 confirmed purchase 전환 설계 보강`은 read-only 범위에서 진행했다.
최근 14일 Google Ads 캠페인 성과는 거의 전부 NPay primary label `AW-304339096/r0vuCKvy-8caEJixj5EB`에 의해 만들어졌다.

GA4/GTM 쪽 NPay 클릭이 purchase로 잡히던 문제는 `2026-04-24 23:45 KST` live v138에서 사실상 고쳐졌다.
BigQuery raw에서 `2026-04-25`부터 NPay click-as-purchase가 0으로 떨어졌고, `2026-04-27`의 3건/35,700원은 잔여 edge case로 보인다.

하지만 Google Ads 쪽은 아직 같은 방식으로 고쳐지지 않았다.
Google Ads API에서 primary `구매완료` NPay value는 v138 이후에도 매일 계속 발생한다.
따라서 Google Ads ROAS는 아직 내부 confirmed ROAS가 아니라 `platform_reference`로만 봐야 한다.
실행 승인 문서는 [[google-ads-confirmed-purchase-execution-approval-20260505]]로 분리했다.
여기서 기준은 `NPay 매출 제외`가 아니라 `NPay 실제 결제완료는 포함, NPay 클릭/결제시작은 구매 제외`다.

## 이번에 확인한 것

### 1. 캠페인별 영향 범위

최근 14일 기준 Google Ads `Conv. value`는 `123,495,273원`이고, 이 중 primary NPay label value가 `123,495,262원`이다.
비중은 사실상 `100%`다.

| 캠페인 | 상태 | 채널 | 입찰 | 일예산 | 비용 | Conv. value | primary NPay 비중 | 판단 |
|---|---|---|---|---:|---:|---:|---:|---|
| `[PM]검사권 실적최대화` | ENABLED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 240,000원 | 3,418,001원 | 53,158,638원 | 100% | 감액 또는 7일 pause test 후보 |
| `[PM]건기식 실적최대화` | ENABLED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 320,000원 | 4,184,674원 | 41,669,299원 | 100% | 감액 또는 7일 pause test 후보 |
| `[PM] 이벤트` | PAUSED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 280,000원 | 2,820,144원 | 27,338,330원 | 100% | 이미 중지됨. 재개 금지 후보 |
| `[SA]바이오컴 검사권` | ENABLED | SEARCH | MAXIMIZE_CONVERSIONS | 50,000원 | 693,721원 | 1,329,006원 | 100% | 소액 cap 유지 후 검색어/confirmed 조인 |
| `[PMAX] 바이오컴 검사권 캠페인` | ENABLED | PERFORMANCE_MAX | MAXIMIZE_CONVERSION_VALUE | 200,000원 | 3원 | 0원 | 없음 | 아직 의미 있는 지출 없음 |

### 2. NPay 클릭 구매 신호 변경 시점

GA4 BigQuery raw 기준으로 NPay click-as-purchase 문제는 아래 시점에 바뀌었다.

```text
2026-04-24 23:45 KST
GTM live v138: ga4_purchase_duplicate_fix_20260424
tag [43] GA4_구매전환_Npay: purchase -> add_payment_info
tag [48] homepage purchase 중복 경로: paused
```

BigQuery 일별 확인 결과:

| 날짜 | NPay add_payment_info | NPay purchase-like | 해석 |
|---|---:|---:|---|
| 2026-04-23 | 72 events | 74 events / 9,591,500원 | v138 전. 클릭성 purchase 오염 구간 |
| 2026-04-24 | 103 events | 102 events / 13,154,500원 | v138 반영일. 하루 안에 전/후가 섞임 |
| 2026-04-25 | 188 events | 0 | v138 후. click-as-purchase 제거 |
| 2026-04-26 | 243 events | 0 | 제거 유지 |
| 2026-04-27 | 296 events | 3 events / 35,700원 | 잔여 edge case |
| 2026-04-28~2026-05-03 | 1,043 events | 0 | 제거 유지 |

따라서 "네이버페이가 클릭만 해도 구매로 잡히던 문제"는 GA4/GTM 기준으로 `2026-04-24 23:45 KST`에 고쳤다고 본다.

### 3. Google Ads 쪽 변경 여부

Google Ads 쪽은 아직 고쳐지지 않았다.

근거는 두 가지다.

1. Google Ads primary purchase action `구매완료`는 계속 `AW-304339096/r0vuCKvy-8caEJixj5EB` label을 쓴다.
2. v138 이후에도 primary NPay value가 매일 발생한다.

v138 이후 Google Ads primary NPay value:

| 날짜 | primary NPay value | primary NPay conversions |
|---|---:|---:|
| 2026-04-25 | 6,450,964원 | 95.2247 |
| 2026-04-26 | 9,955,540원 | 125 |
| 2026-04-27 | 13,168,008원 | 153.7222 |
| 2026-04-28 | 9,748,376원 | 81.808 |
| 2026-04-29 | 11,058,436원 | 100.3669 |
| 2026-04-30 | 9,251,929원 | 86.8251 |
| 2026-05-01 | 11,277,269원 | 95.5 |
| 2026-05-02 | 6,530,700원 | 72.5 |
| 2026-05-03 | 9,741,300원 | 116 |
| 2026-05-04 | 8,856,800원 | 66 |

결론은 명확하다.
GA4 purchase 오염은 v138에서 줄었지만, Google Ads primary purchase 학습 신호는 아직 NPay count label 중심이다.

## Google Ads가 왜 NPay로 크게 오염됐는가

오염 원인은 한 가지가 아니라 세 가지가 겹친 구조다.

1. 아임웹 자동 NPay count label이 Google Ads primary `구매완료` action과 연결돼 있다.
2. GTM의 secondary `TechSol - NPAY구매 50739`도 NPay 버튼 클릭 trigger를 갖고 있어 `All conv. value`를 키운다.
3. Google Ads는 primary conversion action을 `Conversions` 컬럼과 입찰 최적화에 쓸 수 있으므로, 이 label이 켜진 동안 자동입찰은 실제 confirmed order보다 NPay count 신호를 학습할 수 있다.

공식 기준도 이 판단과 맞다.
Google Ads 공식 도움말은 primary conversion action이 `Conversions` 보고와 입찰에 쓰이고, secondary는 관찰용 `All conversions`에 쓰인다고 설명한다.
또 conversion value는 Target ROAS나 Maximize conversion value 같은 가치 기반 입찰의 기준값으로 쓰인다.

공식 문서:

- [About primary and secondary conversion actions](https://support.google.com/google-ads/answer/11461796?hl=en-EN)
- [About conversion values](https://support.google.com/google-ads/answer/13064207?hl=en-EN)

## confirmed purchase 전환 설계

기존 `구매완료`를 바로 삭제하거나 단순히 label만 바꾸면 안 된다.
지금 필요한 것은 "실제 돈이 들어온 주문만 Google Ads에 구매로 알려주는 새 정본 purchase 신호"다.

### 후보 A. 결제완료 페이지 client-side Google Ads 태그

- 추천: 58%
- 장점: 구현이 빠르다.
- 단점: NPay처럼 자사몰 결제완료 페이지로 돌아오지 않는 흐름을 놓친다.
- 결론: 홈페이지 결제 보조 신호로는 가능하지만, NPay 포함 정본 purchase로는 부족하다.

### 후보 B. server-side offline conversion import 또는 Data Manager API

- 추천: 88%
- 장점: Imweb/Toss/NPay confirmed 주문 기준으로만 전환값을 보낼 수 있다.
- 단점: `gclid`, `gbraid`, `wbraid`를 랜딩/체크아웃 시점에 저장해야 한다.
- 결론: Google Ads confirmed purchase 정본으로 가장 적합하다.

Google 공식 문서는 신규 offline conversion workflow는 Google Ads API보다 Data Manager API 업그레이드를 권장한다고 명시한다.
따라서 장기 경로는 Data Manager API를 1순위로 보고, 현재 repo에서 이미 read-only 연결이 되는 Google Ads API `ConversionUploadService`는 fallback 후보로 둔다.
두 방식 모두 랜딩 시점 `marketing_intent` 저장이 선행되어야 한다.

공식 문서:

- [Google Ads API: Manage offline conversions](https://developers.google.com/google-ads/api/docs/conversions/upload-offline)
- [Google Data Manager API: Send conversion events](https://developers.google.com/data-manager/api/devguides/events)
- [Google Ads Help: Set up offline conversions using GCLID](https://support.google.com/google-ads/answer/7012522?hl=en)

### 후보 C. Enhanced conversions for web

- 추천: 66%
- 장점: 이메일/전화번호 같은 1st-party customer data를 해시해 매칭 품질을 높일 수 있다.
- 단점: 클릭을 구매로 바꾸는 문제가 자동으로 해결되지는 않는다.
- 결론: confirmed purchase 전환의 보조 매칭 품질 개선책이다. 오염된 NPay count replacement는 아니다.

공식 문서:

- [About enhanced conversions for web](https://support.google.com/google-ads/answer/15712870?hl=en)
- [Set up enhanced conversions for web using the Google tag](https://support.google.com/google-ads/answer/13258081?hl=en)

## Google Ads에서도 Meta 퍼널 CAPI처럼 가능한가

가능한 부분과 다른 부분을 분리해야 한다.

Google Ads에는 Meta CAPI와 완전히 같은 개념은 없다.
대신 아래 조합으로 비슷한 목적을 달성한다.

1. 구매 정본: Google Ads offline conversion import 또는 enhanced conversions.
2. 중간 퍼널: GA4 `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`를 관찰용으로 수집.
3. 관심도 분석: `ProductEngagementSummary`로 체류시간/스크롤을 내부 원장에 저장.
4. 리마케팅: GA4 audience 또는 Google Ads audience로 고관여 세그먼트를 만든다.

중요한 금지선은 이렇다.
스크롤 깊이와 체류시간을 바로 purchase primary value로 쓰면 안 된다.
이 값은 매출이 아니라 관심도다.
초기에는 `secondary`, `audience`, `internal analysis`로만 써야 한다.

추천 구조:

| 신호 | Google Ads 처리 | 이유 |
|---|---|---|
| confirmed purchase | 새 정본 purchase, 처음엔 Secondary/observation | 실제 매출 학습 후보 |
| begin_checkout / add_payment_info | Secondary 또는 GA4 key event 관찰 | 구매 전 단계 품질 확인 |
| 90초 이상 체류 + 75% 스크롤 | 내부 `ProductEngagementSummary` 우선 | 관심도지만 매출 아님 |
| NPay click | purchase 금지. `add_payment_info` 또는 intent | 클릭과 결제완료를 분리 |

## 검색 의도 캠페인이란 무엇인가

`[SA]바이오컴 검사권` 같은 캠페인은 `SA = Search Ads` 성격이다.
사람이 Google에서 `바이오컴 검사권`, `음식물 과민증 검사`, `검사권`처럼 관련 키워드를 직접 검색한 뒤 광고를 클릭하는 구조다.

즉 "전환 없이 트래픽만 받는 캠페인"이라는 뜻이 아니다.
이미 검색 의도가 있는 사람을 받아오는 수요 포착 캠페인이라는 뜻이다.

PM/PMax/GDN은 Google이 여러 지면에서 타겟을 찾아 광고를 보여주는 성격이 강하다.
반면 Search 캠페인은 사용자가 먼저 검색어로 의도를 드러낸다.
그래서 전환 신호가 오염돼도 Search 캠페인은 바로 전체 OFF하기보다 소액 cap으로 분리해서 검색어와 내부 confirmed 주문을 먼저 확인하는 편이 안전하다.

현재 `[SA]바이오컴 검사권`도 primary NPay label 오염은 있다.
다만 최근 28일 GA4 raw에서 NPay 클릭 0, homepage purchase 12건 / 3,584,500원이 있어 PM/PMax와 같은 방식으로 자르면 안 된다.

## BigQuery 활용 여부

활용했다.

이번 판단에서 BigQuery는 두 곳에 쓰였다.

1. `data/biocom-npay-signal-change-20260505.json`
   - source: `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*`
   - 목적: NPay click-as-purchase가 언제 줄었는지 확인.
   - 결론: `2026-04-24 23:45 KST` v138 이후 GA4 purchase 오염이 사실상 제거됨.

2. `data/biocom-paid-channel-quality-20260505-last7.json`, `data/biocom-paid-channel-quality-20260505-last28.json`
   - source: 같은 GA4 BigQuery archive.
   - 목적: Meta vs Google Ads 유입의 체류시간, 스크롤, 일반 결제 시작, NPay 클릭, homepage purchase 비교.
   - 결론: Google Ads 유입은 관여 지표가 나쁘지 않지만, purchase 정본 신호가 NPay로 오염돼 예산 판단에는 부적합함.

## 하지 않은 것

- Google Ads 전환 액션을 바꾸지 않았다.
- Google Ads conversion upload를 하지 않았다.
- GTM publish를 하지 않았다.
- backend 운영 배포를 하지 않았다.
- 운영 DB write를 하지 않았다.
- Meta/GA4/Google/TikTok으로 새 이벤트를 보내지 않았다.

## 다음 할일

### Codex가 할 일

1. Google Ads confirmed purchase no-send dry-run을 만든다.
- 추천/자신감: 88%
- Lane: Green. 실제 전송은 Red.
- 무엇을 하는가: 실제 결제완료 주문을 Google Ads 전송 후보 row로 만들되, 외부 전송은 하지 않는다.
- 왜 하는가: 기존 `구매완료` NPay count를 primary에서 내리기 전에 대체 purchase 신호가 충분한지 봐야 한다.
- 어떻게 하는가: Imweb/Toss/NPay confirmed order와 `gclid/gbraid/wbraid` 저장 source를 read-only 조인하고 `send_candidate=N`, `block_reason`을 붙인다.
- 성공 기준: 보낼 수 있는 주문, 못 보내는 주문, 막힌 이유가 주문 단위 JSON으로 나온다.
- 승인 필요: 문서 작성 NO. 실제 Google Ads 변경/전송 YES.

2. Search 캠페인 주문 단위 조인을 따로 뽑는다.
- 추천/자신감: 78%
- Lane: Green
- 무엇을 하는가: `[SA]바이오컴 검사권` 유입 세션과 내부 confirmed order를 주문 단위로 맞춘다.
- 왜 하는가: 검색 의도 캠페인은 PM/PMax와 다르므로 감액/유지 판단을 따로 해야 한다.
- 어떻게 하는가: GA4 BigQuery `gclid/utm_campaign/session`, VM attribution ledger, Imweb confirmed order를 read-only로 조인한다.
- 성공 기준: confirmed 매출, unknown, NPay return 누락이 분리된다.
- 승인 필요: NO. 운영 write/send 없음.

### TJ님이 할 일

1. PM/PMax 예산 방어선 결정
- 추천/자신감: 84%
- Lane: Yellow
- 무엇을 하는가: `[PM]검사권 실적최대화`, `[PM]건기식 실적최대화`, `[PM] 이벤트`를 30~50% 감액할지, 7일 pause test할지 결정한다.
- 왜 하는가: 이 캠페인들은 최근 14일 Google Ads 전환값이 사실상 100% NPay primary label이고, 현재 ROAS를 증액 근거로 쓰면 안 된다.
- 어떻게 하는가: Google Ads UI에서 PM/PMax 캠페인만 분리해 예산 변경 후보로 본다. `[SA]바이오컴 검사권`은 같은 그룹으로 묶지 않는다.
- 성공 기준: 광고비 소진을 줄이면서 내부 confirmed 매출과 일반 결제 시작이 급락하지 않는다.
- Codex가 대신 못 하는 이유: 실제 광고비 변경은 사업 판단과 외부 계정 실행 권한이 필요하다.
- 승인 필요: YES.

2. Google Ads purchase primary 변경 승인 여부 결정
- 추천/자신감: 90%
- Lane: Red
- 무엇을 하는가: 기존 `구매완료` action `7130249515`를 계속 Primary로 둘지, 새 confirmed purchase 전환을 병렬 준비한 뒤 Secondary로 낮출지 결정한다.
- 왜 하는가: 현재 primary purchase value가 실제 confirmed order가 아니라 NPay count label 중심이다.
- 어떻게 하는가: [[google-ads-purchase-primary-change-approval-20260505]]와 이 문서를 보고 승인 문구를 확정한다.
- 성공 기준: 오염된 purchase 신호를 줄이되 자동입찰 급락 리스크를 통제한다.
- Codex가 대신 못 하는 이유: Google Ads 목표/전환 변경은 외부 플랫폼 운영 변경이다.
- 승인 필요: YES.

## 변경 이력

| 시각 | 내용 | 근거 |
|---|---|---|
| 2026-05-05 09:32 KST | 캠페인별 primary NPay value, v138 NPay GA4 변경 시점, Google Ads 미변경 여부, confirmed purchase 설계 후보 정리 | Google Ads API read-only, GA4 BigQuery archive read-only, 공식 Google Ads 문서 |
