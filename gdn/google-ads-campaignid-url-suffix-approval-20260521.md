작성 시각: 2026-05-21 01:05 KST
기준일: 2026-05-21
문서 성격: Google Ads 캠페인 ID URL 보강 승인안

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - gdn/google-ads-gad-campaignid-campaign-matching-design-20260520.md
  lane: Green
  allowed_actions:
    - read_only_live_api_check
    - read_only_final_url_audit
    - local_approval_packet_write
  forbidden_actions:
    - google_ads_ui_change
    - google_ads_conversion_upload
    - primary_conversion_change
    - operating_db_write
    - vm_cloud_write
    - gtm_publish
    - deploy_or_restart
  source_window_freshness_confidence:
    source: VM Cloud Google Ads dashboard API + Google Ads final URL audit API
    window: biocom last_7d, checked at 2026-05-21 00:58 KST
    site: biocom
    freshness: latest landing row 2026-05-21 00:47:30 KST
    confidence: medium_high
```

# Google Ads 캠페인 ID URL 보강 승인안

## 10초 요약

Google 광고 클릭 자체는 바이오컴 고객 유입 장부에 계속 들어오고 있다. 2026-05-21 00:58 KST 기준 최근 7일 Google 클릭 ID 증거는 10,282건이고, 최신 유입은 00:47 KST까지 확인된다.

문제는 클릭 ID가 아니라 캠페인 번호다. `gclid/gbraid/wbraid`는 살아 있지만 `gad_campaignid`는 고객 유입 장부와 유료 광고 클릭 장부 모두 0건이다. 그래서 UTM이 빈 Google 광고 클릭을 어느 캠페인으로 볼지 내부 ROAS 화면에서 85% 이상 신뢰도로 나누기 어렵다.

다음 실행 후보는 Google Ads URL 옵션에 캠페인 ID 파라미터를 붙이는 것이다. 실행 자체는 Google Ads 설정 변경이므로 TJ님 승인 전에는 하지 않는다.

## 지금 확인된 사실

Source: VM Cloud Google Ads dashboard API, Google Ads final URL audit API
Window: biocom last_7d
Freshness: 2026-05-21 00:58 KST 조회, 최신 landing row 2026-05-21 00:47:30 KST
Confidence: medium_high

| 항목 | 값 | 해석 |
|---|---:|---|
| 고객 유입 장부 전체 row | 13,072 | 최근 7일 바이오컴 유입 |
| 고객 유입 장부 Google click id row | 10,282 | Google 자동 태깅 값은 VM Cloud까지 살아 있음 |
| 고객 유입 장부 `gad_campaignid` row | 0 | 캠페인 번호가 유입 장부에 남지 않음 |
| 유료 광고 클릭 장부 Google click id row | 10,856 | 유료 클릭 장부에도 Google click id evidence는 있음 |
| 유료 광고 클릭 장부 `gad_campaignid` row | 0 | 유료 클릭 장부에도 캠페인 번호가 없음 |
| Google Ads final URL audit: final URL suffix | 0 | 계정/광고 URL 옵션에서 캠페인 ID를 붙이는 흔적 없음 |
| Google Ads final URL audit: tracking template | 0 | 추적 템플릿으로 캠페인 ID를 붙이는 흔적 없음 |
| Google Ads final URL audit: manual UTM | 52 | 일부 수동 UTM은 있지만 모든 유입을 커버하지 못함 |

## 왜 이 작업이 필요한가

Google Ads가 제한 정책 때문에 전환 매출을 충분히 못 잡는 상황에서는 내부 결제완료 원장으로 ROAS를 다시 계산해야 한다. 그런데 캠페인별 ROAS를 보려면 두 가지가 필요하다.

1. 실제 Google 광고 클릭인지 알 수 있어야 한다. 이 부분은 `gclid/gbraid/wbraid`로 이미 상당히 잡힌다.
2. 그 클릭이 어느 캠페인인지 알 수 있어야 한다. 이 부분이 현재 `gad_campaignid` 0건이라 막혀 있다.

따라서 이번 보강의 목적은 Google Ads에 전환을 보내는 것이 아니다. 신규 Google 클릭 URL에 캠페인 번호를 남겨, 내부 ROAS 화면에서 캠페인별 매칭률을 높이는 것이다.

## 바꾸는 설정 후보

TJ님이 실제로 확인할 화면:

- Google Ads UI
- 계정 설정 또는 캠페인 설정
- URL 옵션
- 최종 URL suffix 또는 추적 템플릿

설정 후보:

```text
gad_campaignid={campaignid}
```

Google Ads ValueTrack의 `{campaignid}`는 클릭을 발생시킨 캠페인 ID를 반환하는 공식 파라미터다. 최종 URL suffix에 이 값을 넣으면 신규 광고 클릭 URL에 캠페인 번호가 붙어 들어오는지 확인할 수 있다.

주의할 점:

- 이 설정은 캠페인 ID를 남기는 추적 보강이다.
- Google Ads conversion upload가 아니다.
- Primary 전환 변경이 아니다.
- 광고 예산 변경이 아니다.
- Google 안내상 추적 템플릿 계열 변경은 광고 게재 반영까지 24~48시간이 걸릴 수 있다.

## 승인 후 실행 순서

### Sprint 1. Google Ads URL 옵션 테스트

**무엇을 하는가**
Google Ads UI에서 테스트 URL 또는 미리보기로 `{campaignid}`가 실제 캠페인 ID로 치환되는지 확인한다.

**왜 하는가**
치환이 안 되는 설정 위치에 넣으면 신규 유입에도 계속 0건이 된다.

**성공 기준**
테스트 URL 또는 클릭 URL에 `gad_campaignid=<숫자형 캠페인 ID>`가 보인다.

**실패 시 확인점**
account level이 아니라 campaign/ad group/ad level URL 옵션에 넣어야 하는지 확인한다.

### Sprint 2. 제한 적용

**무엇을 하는가**
바이오컴 Google Ads의 현재 집행 캠페인에만 URL suffix를 제한 적용한다.

**왜 하는가**
전체 계정 일괄 변경은 더클린커피, 과거 외부 도메인, 중지 캠페인까지 영향이 섞일 수 있다.

**성공 기준**
Google Ads UI에서 적용 대상이 바이오컴 현재 활성 캠페인으로 제한된다.

**실패 시 확인점**
캠페인 단위 적용이 어렵다면 계정 단위 적용 후 제외 대상과 영향 범위를 별도 표로 기록한다.

### Sprint 3. 신규 클릭 smoke

**무엇을 하는가**
적용 후 30분, 2시간, 24시간에 VM Cloud API와 고객 유입 장부를 read-only로 재조회한다.

**왜 하는가**
Google Ads UI 설정이 실제 랜딩 URL과 VM Cloud 장부까지 이어지는지 확인해야 한다.

**성공 기준**
신규 Google 클릭 row 중 `gclid/gbraid/wbraid`와 `gad_campaignid`가 같은 row 또는 같은 세션 evidence에 함께 남는다.

**실패 시 확인점**
아임웹 리다이렉트, Google Ads final URL suffix 적용 지연, 다른 URL 옵션 우선순위, 수집 allowlist 누락을 순서대로 확인한다.

### Sprint 4. ROAS 재계산 기준점 승격

**무엇을 하는가**
처음으로 `gad_campaignid`가 신규 클릭에서 보존된 시각을 ROAS 재계산 기준점 후보로 기록한다.

**왜 하는가**
기준점 이전 주문과 이후 주문을 섞으면 개선 효과를 잘못 해석할 수 있다.

**성공 기준**
보고서 화면의 `effectiveFromKst`가 채워지고, 신규 주문에서 campaignIdCoverage가 상승한다.

**실패 시 확인점**
클릭 row는 있는데 주문 표본이 부족하면 클릭 기준점과 주문 기준점은 분리해서 7일 관측한다.

## 하지 않는 것

| 항목 | 실행 여부 |
|---|---|
| Google Ads conversion upload | 하지 않음 |
| Primary 전환 변경 | 하지 않음 |
| 운영DB write/import | 하지 않음 |
| VM Cloud SQLite write | 하지 않음 |
| GTM Production publish | 하지 않음 |
| backend/frontend deploy | 이 문서 범위에서는 하지 않음 |

## 권장 판단

T+2h와 T+24h 재확인에서 `gad_campaignid`가 계속 0건이면, 단순 대기는 종료하고 이 승인안으로 넘어가는 것이 맞다.

진행 추천 점수: 88%
이유: Google click id는 충분히 들어오지만 campaign id 삽입 흔적이 final URL audit에서 0건이므로, URL 옵션 보강이 가장 직접적인 다음 수다. 다만 Google Ads UI 설정은 외부 계정 변경이므로 TJ님 승인과 화면 확인이 필요하다.
