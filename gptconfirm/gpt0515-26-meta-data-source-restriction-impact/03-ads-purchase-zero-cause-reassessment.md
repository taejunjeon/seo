# Ads purchase zero cause reassessment

작성 시각: 2026-05-16 00:53 KST

## 결론

2026-05-15 KST Ads Manager purchase 0은 단일 원인으로 닫기 어렵습니다.

현재 가장 강한 후보는 두 개입니다.

1. 당일 Ads Manager attribution/reporting lag
2. 건강/웰빙 데이터 소스 제한으로 인한 lower-funnel purchase 사용 제한

두 후보는 동시에 존재할 수도 있습니다. CAPI가 들어갔는데도 Ads raw purchase key가 0이라는 점은 제한 가능성을 올리고, 최근 7일 purchase가 존재한다는 점은 완전 차단 가능성을 낮춥니다.

## 원인 후보 점수

### 1. Same-day Ads Manager lag: 40%

근거:

- 2026-05-15 당일 Ads Manager purchase-family key가 0입니다.
- 최근 7일 Ads purchase는 184건 / 48,403,247원으로 존재합니다.
- 즉 계정/Purchase 연결이 역사적으로 완전 단절된 것은 아닙니다.

반대 근거:

- 2026-05-15 CAPI strong Meta evidence 22건이 이미 들어갔는데도 raw purchase key가 0입니다.
- 단순 지연이라면 12-24시간 뒤 붙어야 합니다.

### 2. Data source category restriction: 40%

근거:

- TJ님 UI에서 `데이터 공유 제한 적용됨` 경고가 보입니다.
- `biocom.kr`은 건강/웰빙 서비스 제공업체로 분류됐습니다.
- 보조 도메인도 건강/웰빙 - 기타로 분류됐고 검토 대기 중입니다.
- 공개 Meta 관련 자료는 건강/웰빙 제한이 lower-funnel event tracking/optimization/reporting에 영향을 줄 수 있다고 설명합니다.

반대 근거:

- CAPI `events_received=1`은 58건 성공했습니다.
- 최근 7일 Ads purchase도 존재합니다.
- 제한 상세가 아직 `Purchase 제한`이라고 확인되지는 않았습니다.

### 3. Ads action/custom conversion mapping mismatch: 10%

근거:

- Meta raw action에 `offsite_conversion.custom.988739515903328`가 크게 보입니다.
- 맞춤 전환 설정이 구매가 아닌 다른 이벤트를 가리킬 가능성은 있습니다.

반대 근거:

- 해당 custom event count/value 규모는 confirmed purchase와 맞지 않습니다.
- `purchase`, `offsite_conversion.fb_pixel_purchase`, `omni_purchase`, `web_purchase` 계열 key가 account/campaign/adset level 모두 0입니다.

### 4. Campaign/adset optimization mismatch: 5%

근거:

- direct adset API는 rate limit으로 완전 조회하지 못했습니다.

반대 근거:

- campaign health API 기준 주요 캠페인은 Pixel `1283400029487161`, custom_event_type `PURCHASE`, optimization `VALUE` 중심입니다.

### 5. API/rate/filter 확인 공백: 5%

근거:

- 일부 direct adset listing은 Meta rate limit에 걸렸습니다.
- Meta UI 필터 상태는 Codex가 직접 볼 수 없습니다.

## 분기 조건

### Ads Manager가 2026-05-15 purchase를 뒤늦게 표시하면

판정:

- same-day lag 확정에 가까움
- restriction은 보조 리스크로 남김

다음:

- CAPI/Browser redundancy와 data minimization만 계속 개선
- 새 계정/두 번째 Pixel 보류 유지

### Ads Manager가 12-24시간 뒤에도 0이면

판정:

- data source restriction 또는 Ads attribution connection broken 후보 격상

다음:

- Meta UI 제한 상세 캡처
- Purchase 제한이면 Meta review/data minimization 우선
- 제한 상세가 없으면 custom conversion/action mapping 재조회

### UI에서 Purchase/lower-funnel 제한이 명시되면

판정:

- restriction 영향 가능성 70% 이상

다음:

- event_source_url, URL query, custom_data, health-related content_name 제거 승인안
- review request 준비
- Purchase CAPI는 유지하되, Meta가 허용하는 범위 확인

## Source / window / confidence

- Source: gpt0515-25 VM Cloud CAPI log, VM Cloud attribution ledger, Meta Graph API read-only, TJ님 Events Manager UI evidence
- Window: 2026-05-15 KST
- Freshness: 2026-05-16 00:53 KST
- Confidence: medium
