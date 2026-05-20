작성 시각: 2026-05-20 23:00 KST
기준일: 2026-05-20
문서 성격: Google Ads `gad_campaignid` 기반 내부 캠페인 매칭 보강 설계

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - data/!data_inventory.md
    - docurule.md
  lane: Green
  allowed_actions:
    - local_code_inspection
    - vm_cloud_sqlite_read_only_query
    - local_design_doc_write
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write
    - google_ads_conversion_upload
    - gtm_publish
    - deploy_or_restart
  source_window_freshness_confidence:
    source: VM Cloud SQLite read-only + local backend/frontend code inspection
    window: rolling last_7d and last_30d, checked at 2026-05-20 23:00 KST
    site: biocom
    freshness: VM Cloud latest ledger row 2026-05-20 22:58 KST range
    confidence: medium_high
```

# Google Ads `gad_campaignid` 기반 캠페인 매칭 보강 설계

## 10초 요약

Google 광고 클릭은 이미 VM Cloud에 많이 들어오고 있다. 문제는 `gclid/gbraid/wbraid`는 남는데, 캠페인 번호인 `gad_campaignid`가 현재 수집 단계에서 빠져서 UTM이 없는 광고 클릭을 어느 Google 캠페인으로 볼지 화면에서 복구하지 못한다는 점이다.

따라서 다음 보강은 `gad_campaignid`를 안전한 캠페인 힌트로 보존하고, 내부 ROAS 화면에서 `매칭율%`로 표시하는 것이다. 단, `gad_campaignid`는 클릭 ID가 아니므로 이 값만으로 Google Ads conversion upload 후보를 만들면 안 된다. upload 후보는 계속 0건으로 막는다.

## 2026-05-20 구현 기록

2026-05-20 23:00 KST에 `gad_campaignid` 기반 Google 캠페인 매칭 보강을 로컬 구현했다.

이번 구현은 오늘을 `ROAS 재계산 기준 후보일`로 기록한다. 다만 오늘 23:00 KST를 바로 확정 기준점으로 쓰지는 않는다. backend/frontend 배포 후 신규 Google 유입에서 `gad_campaignid`가 VM Cloud 고객 유입 장부와 유료 클릭 장부에 보존되는 것이 확인되면, 그 시점부터 오늘 작업일 또는 smoke 통과 시각을 ROAS 재계산 시작점으로 승격한다.

변경 범위:

- backend 수집 allowlist에 `gad_campaignid`, `gad_source` 추가
- 유료 클릭 장부 `allowed_query_json`에 `gad_campaignid`, `gad_source` 저장
- Google ROAS report API에 `googleCampaignMatchHealth` 추가
- `/ads/google-roas-report`에 `Google 캠페인 ID 매칭률`, `미맵핑`, `ROAS 재계산 기준 후보` 표시 추가

금지선:

- Google Ads conversion upload 0건 유지
- 운영DB write 0건
- VM Cloud write 0건
- GTM publish 0건
- 배포는 아직 별도 승인 전까지 미실행

## 왜 필요한가

TJ님이 2026-05-20 22:39 KST에 클릭한 Google 광고 URL에는 `gad_campaignid=21808018766`, `gclid`, `gbraid`가 함께 있었다.

VM Cloud read-only 확인 결과 같은 클릭은 고객 유입 장부와 유료 클릭 장부에 잡혔다. 하지만 저장된 `landing_url`과 `allowed_query_json`에는 `gclid/gbraid` 존재만 남고 `gad_campaignid` 값은 빠졌다.

이 상태에서는 "Google 광고에서 온 것은 맞다"까지는 알 수 있지만, UTM이 비어 있는 클릭을 "어느 Google 캠페인에서 온 것인지" 내부 ROAS 화면에 연결하기 어렵다.

## 확인된 현재 상태

### TJ님 테스트 클릭

- 클릭 시각: 2026-05-20 22:39 KST
- 클릭 환경: Chrome desktop
- 사용자가 본 최종 URL: `gad_campaignid=21808018766`, `gclid`, `gbraid` 포함
- VM Cloud 고객 유입 장부: 2026-05-20 22:39:26 KST에 `/shop_view/` landing row 저장, click id type `gclid`, client/session key 있음
- VM Cloud 유료 클릭 장부: 2026-05-20 22:39:26 KST `landing`, 22:39:46 KST `checkout_start` row 저장, allowed query에는 `gclid_present`, `gbraid_present`만 있음
- 해석: 클릭 ID 보존은 작동했지만, 캠페인 ID 보존은 현재 sanitizer/allowlist 단계에서 빠진 것으로 본다.

### 최근 원장 숫자

Source: VM Cloud SQLite read-only
Window: rolling last_7d / last_30d, 2026-05-20 23:00 KST 조회
Site: biocom
Confidence: medium_high

| 원장 | window | 전체 rows | click id evidence | `gad_campaignid` 보존 | UTM 캠페인 빈 click id rows | 해석 |
|---|---:|---:|---:|---:|---:|---|
| 고객 유입 장부 | last_7d | 13,160 | 10,364 | 0 | 434 | 캠페인 ID만 보강하면 UTM 없는 Google 클릭 일부를 캠페인 단위로 복구 가능 |
| 고객 유입 장부 | last_30d | 15,920 | 12,427 | 0 | 586 | 동일 |
| 유료 클릭 장부 | last_7d | 10,952 | 10,839 gclid-present | 0 | 377 | `allowed_query_json`에도 캠페인 ID가 없음 |
| 유료 클릭 장부 | last_30d | 17,171 | 17,040 gclid-present | 0 | 826 | 동일 |
| 결제/행동 원장 | last_7d | 4,367 | 4,314 | 107 |  | 오래된/다른 경로에는 일부 `gad_campaignid`가 남아 있음 |
| 결제/행동 원장 | last_30d | 30,943 | 8,471 | 572 |  | confirmed payment_success 중 15건은 캠페인 ID 힌트가 있음 |

### 최근 7일 결제/행동 원장 상위 `gad_campaignid`

| `gad_campaignid` | rows | confirmed payment_success rows | 해석 |
|---:|---:|---:|---|
| 23249701426 | 72 | 0 | 캠페인 힌트는 있으나 결제완료 연결은 아직 없음 |
| 23844227518 | 12 | 0 | 동일 |
| 21808018766 | 8 | 0 | TJ님 클릭에서 관측된 캠페인 ID와 같은 값 |
| 14629255429 | 6 | 1 | 내부 ROAS 보조 분석 후보 |
| 22018178854 | 4 | 1 | 내부 ROAS 보조 분석 후보 |

## 설계 원칙

1. `gad_campaignid`는 캠페인 ID다. 클릭 ID가 아니다.
2. 내부 화면에서는 "어느 Google 캠페인일 가능성이 높은지"를 보강하는 데 쓴다.
3. Google Ads conversion upload 후보, Primary 전환, 입찰 학습 신호에는 `gad_campaignid` 단독 근거를 쓰지 않는다.
4. 실제 결제완료 매출은 내부 confirmed 원장 기준으로만 본다.
5. 광고 클릭-주문 연결 evidence는 `gclid/gbraid/wbraid`, session/order bridge, Google Ads click_view exact를 분리해서 본다.

## 매칭율% 기준

화면에는 행마다 `매칭율%`를 표시한다. 이 값은 "이 행의 내부 매출을 해당 Google 캠페인에 붙여도 되는 신뢰도"이지, Google Ads 업로드 가능성을 뜻하지 않는다.

| 매칭율 | 조건 | 화면 표시 | upload 후보 |
|---:|---|---|---|
| 95~100% | 주문 evidence에 `gclid/gbraid/wbraid`가 있고, Google Ads `click_view` exact로 campaign id가 확인됨 | 확정 매칭 | 별도 Red 승인 전 0건 |
| 85~94% | 같은 session/order evidence에 Google click id가 있고, URL 또는 allowed query에 `gad_campaignid`가 있으며, 해당 ID가 Google Ads API campaign 목록에 존재함 | 높은 가능성 | 0건 |
| 70~84% | `gad_campaignid`와 session evidence는 있으나 주문 완료 시점 click id가 없음 | 보조 매칭 | 0건 |
| 50~69% | Google UTM 또는 google paid search 단서만 있음 | 진단용 | 0건 |
| 0~49% | Google 캠페인 ID/UTM/click id 모두 부족함 | 미맵핑 | 0건 |

TJ님이 말한 "85% 이상 가능성"은 두 번째 구간으로 구현하는 것이 맞다. 즉 `gad_campaignid`가 있고, Google click id도 같은 유입/세션에서 관측되며, Google Ads API에서 실제 campaign id로 확인될 때 내부 ROAS 보고에 붙인다.

## 보강 설계

### 1. 수집 보강

현재 `paid_click_intent`와 confirmed purchase URL sanitizer allowlist에는 `gclid/gbraid/wbraid`는 있으나 `gad_campaignid`가 없다.

수정 방향:

- `PAID_CLICK_INTENT_URL_QUERY_ALLOWLIST`에 `gad_campaignid`, `gad_source` 추가
- `CONFIRMED_PURCHASE_URL_QUERY_ALLOWLIST`에 `gad_campaignid`, `gad_source` 추가
- 필요하면 `PRODUCT_ENGAGEMENT_URL_QUERY_ALLOWLIST`도 같은 기준으로 맞춤
- `buildPaidClickIntentNoSendPreview`에서 raw URL을 sanitize하기 전 `gad_campaignid`를 `google_campaign_id`로 추출
- `buildAllowedQueryJson`에 `gad_campaignid` 값을 저장
- raw `gclid/gbraid/wbraid`는 지금처럼 원문 반환하지 않음

저장 예시:

```json
{
  "gad_campaignid": "21808018766",
  "gclid_present": "1",
  "gbraid_present": "1"
}
```

### 2. 내부 매칭 helper

Google 캠페인 ID 추출 helper를 하나로 묶는다.

```ts
type GoogleCampaignIdEvidence = {
  campaignId: string;
  source: "gad_campaignid_url" | "allowed_query_json" | "metadata" | "utm_id";
  hasGoogleClickId: boolean;
  hasOrderBridge: boolean;
  adsApiCampaignExists: boolean;
  matchRatePct: number;
  canUseForInternalRoas: boolean;
  canUseForUpload: false;
  reasons: string[];
};
```

추출 순서:

1. raw/sanitized URL의 `gad_campaignid`
2. 유료 클릭 장부 `allowed_query_json.gad_campaignid`
3. 결제/행동 원장 metadata 또는 landing URL의 `gad_campaignid`
4. 기존 `utm_id`, `campaignid`, `campaign_id`

검증 순서:

1. 숫자형 campaign id인지 확인
2. 현재 Google Ads customer의 campaign list에 있는지 확인
3. 같은 row 또는 같은 session에 `gclid/gbraid/wbraid`가 있는지 확인
4. 주문 evidence와 연결됐는지 확인
5. 위 조건으로 `matchRatePct` 계산

### 3. API 응답 보강

`/api/google-ads/dashboard` 또는 별도 health payload에 아래 필드를 추가한다.

```json
{
  "googleCampaignMatchHealth": {
    "windowDays": 7,
    "source": "vm_cloud_sqlite_and_google_ads_api",
    "mode": "no_send_read_only",
    "gadCampaignIdRows": 0,
    "utmBlankClickIdRows": 434,
    "recoverableAfterAllowlistRows": 434,
    "matchedToAdsApiCampaignRows": 0,
    "internalRoasEligibleRows": 0,
    "uploadCandidateCount": 0
  }
}
```

초기 배포 직후에는 과거 row의 `gadCampaignIdRows`가 낮게 보이는 것이 정상이다. 보강은 미래 유입부터 효과가 난다.

### 4. 화면 보강

`/ads/google-roas-report`에는 `click id health` 옆에 `campaign id health` 카드를 둔다.

화면 문구:

- `Google click id 보존률`: 주문까지 광고 클릭 식별자가 남았는가
- `Google 캠페인 ID 매칭률`: UTM이 없어도 Google 캠페인 번호로 어느 캠페인인지 알 수 있는가
- `미맵핑`: click id 또는 UTM이 있어도 campaign id를 붙이지 못한 묶음

행 단위에는 아래 열을 추가한다.

- `매칭율%`
- `매칭 근거`: `click_view exact`, `gad_campaignid+click id`, `UTM only`, `미맵핑`
- `내부 ROAS 사용`: `사용 가능`, `보조`, `진단만`

## 구현 순서

### Phase G0. read-only 기준 고정

이미 이번 문서에서 완료했다.

- TJ님 테스트 클릭이 VM Cloud에 들어왔는지 확인
- 현재 `gad_campaignid` 보존이 0건인 위치 확인
- UTM 캠페인 빈 Google click id row 규모 확인

### Phase G1. backend no-send 보강

Lane: Green local code + tests, Yellow deploy approval needed

수정 파일 후보:

- `backend/src/routes/attribution.ts`
- `backend/src/paidClickIntentLog.ts`
- `backend/src/routes/googleAds.ts`
- `backend/tests/*paid-click-intent*`
- `backend/tests/*google-ads*`

100% 조건:

- TJ님 테스트 URL fixture에서 `gad_campaignid=21808018766`이 `google_campaign_id`로 추출됨
- `allowed_query_json`에 campaign id가 저장됨
- raw click id 원문은 API 응답에 노출하지 않음
- `send_candidate=0`, `uploadCandidateCount=0` 유지

### Phase G2. report API/화면 반영

Lane: Green local implementation, Yellow deploy approval needed

수정 파일 후보:

- `backend/src/routes/googleAds.ts`
- `frontend/src/app/ads/google-roas-report/page.tsx`
- `frontend/src/app/ads/google-roas-report/page.module.css`

100% 조건:

- `/ads/google-roas-report`에 `Google 캠페인 ID 매칭률` 카드 표시
- `매칭율%`, `매칭 근거`, `미맵핑` 묶음 표시
- 과거 row는 `현재 보존 안 됨`, 신규 row는 `보존 시작 후 측정`으로 분리

### Phase Y1. 운영 반영

Lane: Yellow

TJ님 승인 문구가 필요하다.

승인 문구 예시:

```text
gad_campaignid 기반 Google 캠페인 매칭 보강 backend/frontend 배포 승인
```

승인 후 해야 할 일:

- backend 배포
- frontend 배포
- 30분~2시간 smoke
- TJ님이 Google 광고 1회 클릭해서 `gad_campaignid`가 health 카드에 잡히는지 확인

### Red Lane. 아직 하지 않는 일

아래는 이 설계와 별개로 계속 금지한다.

- Google Ads conversion upload
- Google Ads Primary/Secondary 전환 설정 변경
- GTM Production publish
- 운영DB write
- 캠페인 예산 변경 자동화

## 성공 기준

1. TJ님이 준 유형의 URL에서 `gad_campaignid=21808018766`이 내부 원장에 보존된다.
2. UTM이 비어 있는 Google click id row가 `미맵핑`이 아니라 `gad_campaignid 기반 높은 가능성 매칭`으로 분리된다.
3. `/ads/google-roas-report`에서 `매칭율%`와 `미맵핑`이 보인다.
4. Google Ads upload 후보는 여전히 0건이다.
5. 모든 숫자는 `Google Ads 주장값`과 `내부 confirmed ROAS`가 분리되어 표시된다.

## Auditor verdict

Verdict: PASS_WITH_NOTES

- No-send verified: YES
- No-write verified: YES
- No-deploy verified: YES
- No-publish verified: YES
- No-platform-send verified: YES
- raw click id/order/payment/member/email/phone output in document: 0

주의: 이번 문서는 설계와 read-only 확인만 완료했다. 운영 화면 반영은 코드 수정과 배포 승인이 필요하다.
