# Google click id 유실 지점 live API VM Cloud 배포 결과

작성 시각: 2026-05-25 08:15 KST
문서 성격: Yellow deploy result + live number judgment

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - vm/!vm.md
    - project/google-roas-report-baseline-card-deploy-and-clickid-bottleneck-20260524.md
  lane: Yellow deploy approved by TJ님 in chat
  allowed_actions:
    - deploy backend/src/routes/googleAds.ts
    - deploy frontend Google ROAS report files
    - remote backup before overwrite
    - remote typecheck/build
    - pm2 restart seo-backend and seo-frontend
    - public read-only smoke and number judgment
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads setting or conversion action mutation
    - GTM publish
    - Imweb header/footer mutation
    - operating DB write/import
    - VM Cloud SQLite write/schema migration
  source_window_freshness_confidence:
    source: VM Cloud backend/frontend + public Google Ads dashboard/dropoff APIs
    window: today / last_1d / last_7d
    freshness: 2026-05-25 08:17 KST live API refresh
    confidence: high for deploy/API shape, medium_high for business interpretation until row-level review continues
```

## 무엇이 가능해졌나

Google click id가 어느 단계에서 줄어드는지 live API와 운영 보고서 화면에서 나눠 볼 수 있게 됐다.

기존에는 "실제 결제완료 주문에 click id가 몇 건 남았는지"만 보였다. 이제는 고객 유입, 유료 클릭 저장, 구매하기 진입, 결제 화면, 결제완료 신호, 실제 주문번호 연결을 분리해서 본다.

## 배포 범위

- `backend/src/routes/googleAds.ts`
- `frontend/src/app/ads/google-roas-report/page.tsx`
- `frontend/src/app/ads/google-roas-report/page.module.css`

VM Cloud backup:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/google-clickid-dropoff-live-api-20260524T230216Z
```

반영 후 sha256:

```text
3e0c5a2f3020378ecbb5030d1f72c928c6d523b0c0f23372dad9be8de2de3bfe  backend/src/routes/googleAds.ts
2a5265a8c245cb18dc9c79d055e2aa647e22688e7a62694e06d4a88e5a78824a  frontend/src/app/ads/google-roas-report/page.tsx
4d25d8516b9182eb491c8e3aabe5f33d3911bcf6f707dd0e539c459a32850609  frontend/src/app/ads/google-roas-report/page.module.css
```

보조 카드 과대 판정을 막기 위해 backend만 1회 추가 배포했다. `metadata_json` 안에 `has_gclid:false`처럼 key 이름만 있는 경우를 click id로 세지 않도록 바꿨다.

추가 backend backup:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/google-clickid-dropoff-strict-json-20260524T231442Z
```

## 배포 검증

- local backend typecheck: PASS
- local frontend lint target: PASS
- local frontend typecheck: PASS
- harness preflight strict: PASS
- remote backend typecheck: PASS
- remote backend build: PASS
- remote frontend lint target: PASS
- remote frontend typecheck: PASS
- remote frontend build: PASS
- `pm2 restart seo-backend --update-env`: PASS, restart 4 -> 5 -> 6
- `pm2 restart seo-frontend --update-env`: PASS, restart 4 -> 5
- `pm2 save`: PASS
- `https://att.ainativeos.net/health`: 200
- `https://biocom.ainativeos.net/ads/google-roas-report`: 200
- page text smoke: `OKR와 액션플랜`, `live API 단계 분해`, `주문 연결 근거`, `분석 알고리즘 v2 기준점` 확인
- backend memory: 재시작 직후 자동 sync/precompute와 대형 ledger read 요청이 겹치며 1.7GB까지 일시 상승, 3분 뒤 596MB로 안정
- ROAS summary precompute env: `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1` 유지 확인

## live 숫자 판정

Source: VM Cloud public API read-only
Freshness: 2026-05-25 08:17 KST

### 최근 7일, 2026-05-18~2026-05-24

```text
실제 결제완료 주문: 435건
주문번호에 Google click id 연결: 4건
미연결: 431건
Google Ads 전송 후보: 0건
외부 전송/DB write: 0건
```

단계별 흐름:

```text
고객 유입: 6,921
유료 클릭 저장: 7,079
구매하기 진입: 95
결제 화면: 247
결제완료 신호 전체: 11
실제 주문번호 직접 연결: 4
```

판정:

- Google 광고 클릭은 들어오고 있고 저장도 된다.
- 결제 화면과 결제완료 신호에도 일부 click id는 보인다.
- 그러나 실제 주문번호와 안전하게 연결되는 건은 아직 매우 적다.
- 현재 병목은 "클릭 저장"보다 "결제완료 신호를 실제 주문번호로 확정 연결하는 단계"다.

### 전일, 2026-05-24

```text
실제 결제완료 주문: 41건
주문번호에 Google click id 연결: 1건
미연결: 40건
Google Ads 전송 후보: 0건
```

전일 단계별 흐름:

```text
고객 유입: 803
유료 클릭 저장: 825
구매하기 진입: 11
결제 화면: 33
결제완료 신호 전체: 2
실제 주문번호 직접 연결: 1
```

주문 연결 1건:

```text
order_no: 202605242353635
payment_method: CARD
amount: 234,000
evidence_source: payment_success_ledger
click id type: gclid
send/upload: 차단, read-only 후보
```

Google Ads가 주장하는 전일 값:

```text
광고비: 388,977원
전환수: 22.75건
전환값: 5,706,368원
Google Ads 주장 ROAS: 14.67배
```

판정:

- Google Ads는 전일 구매를 22.75건으로 보고 있지만, 내부 주문번호에 직접 붙은 Google click id는 1건이다.
- 따라서 예산 판단은 아직 Google Ads 주장 ROAS를 그대로 쓰면 안 되고, 내부 confirmed ROAS와 분리해서 봐야 한다.

### 오늘, 2026-05-25 00:00~08:09 KST

```text
실제 결제완료 주문: 13건
주문번호에 Google click id 연결: 0건
Google Ads 주장 전환수: 6건
Google Ads 주장 전환값: 630,000원
Google Ads 주장 ROAS: 5.34배
```

판정:

- 오늘은 아직 Google click id가 직접 붙은 주문번호가 없다.
- 시간대가 이른 오전이고 sync 지연 가능성이 있으므로 최종 판정이 아니라 중간 판정이다.

## 캠페인별 Google Ads 주장 ROAS

Source: `https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_1d`

```text
2026-05-24
[PMAX] 바이오컴 검사권 (2): 광고비 202,168원, 전환값 234,000원, ROAS 1.16배
[PM]검사권 실적최대화: 광고비 70,360원, 전환값 4,288,000원, ROAS 60.94배
[SA]바이오컴 검사권: 광고비 58,274원, 전환값 1원, ROAS 0.00배
[PM]건기식 실적최대화: 광고비 58,175원, 전환값 1,184,367원, ROAS 20.36배
```

이 값은 Google Ads가 주장하는 캠페인별 값이다. 내부 주문번호와 연결된 실제 매출 ROAS가 아니다.

## 금지선 준수

- Google Ads conversion upload: NOT RUN
- Google Ads conversion action mutation: NOT RUN
- Google Ads primary goal mutation: NOT RUN
- GTM publish: NOT RUN
- Imweb header/footer mutation: NOT RUN
- operating DB write/import: NOT RUN
- VM Cloud SQLite write/schema migration: NOT RUN

## 다음 판단

현재 목표 달성을 위해 가장 중요한 다음 작업은 "NPay/외부 결제완료 주문번호와 내부 click id 후보를 no-write 상태에서 계속 확장하고, 실제 write 전 검토표를 만든 뒤, 전송 후보와 내부 bridge 후보를 분리 유지하는 것"이다.
