# 03. 다음 행동과 운영 반영 승인안

## 이번에 운영 반영할 후보

대상은 `/total` 화면과 backend monthly evidence 응답이다.

변경 내용:

- unknown drilldown에 UTM 판정불가 후보를 추가한다.
- 네이버 paid/brandsearch/organic 후보를 섞지 않는 분류 원칙을 문서화한다.
- 네이버 후보는 예산 판단 매출이 아니라 참고용 evidence로만 둔다.

## 운영 반영 승인안

### 범위

- frontend `/total` 화면 반영.
- backend `/api/total/monthly-channel-summary` 응답에 `evidence.utm_invalid_audit` 반영.
- build/typecheck.
- post-snapshot API smoke.

### 금지

- 운영DB write.
- VM Cloud schema migration/write.
- Google Ads/GA4/Meta/TikTok/Naver send/upload.
- GTM publish.
- Imweb footer/header 변경.
- 네이버 후보를 budget ROAS에 자동 포함.

### pre-snapshot

```bash
curl -sS 'https://biocom.ainativeos.net/api/total/monthly-channel-summary?site=biocom&month=2026-05&mode=dry_run' \
  | jq '{ok, source_freshness, evidence_keys:(.evidence|keys)}'
```

### local verification

```bash
cd backend && npm run typecheck
cd frontend && npm run build
curl -sS 'http://localhost:7020/api/total/monthly-channel-summary?site=biocom&month=2026-05&mode=dry_run' \
  | jq '{ok, utm_invalid_count:(.evidence.utm_invalid_audit|length)}'
```

### success criteria

- `/total` 화면에서 UTM 규칙 후보가 unknown drilldown에 보인다.
- `utm_invalid_audit`가 aggregate only이며 raw id를 출력하지 않는다.
- 네이버 paid/brandsearch/organic이 한 줄로 섞이지 않는다.
- budget ROAS 매출에는 네이버 후보가 자동 추가되지 않는다.
- summary API 200.

### failure conditions

- API 5xx.
- raw order/payment/click/member/email/phone 노출.
- GA4 또는 Naver Ads platform claim을 내부 confirmed revenue에 더함.
- paid_naver 후보가 budget ROAS에 자동 포함됨.
- 화면에서 네이버 자연검색/광고가 같은 줄로 섞여 보임.

### rollback

- frontend/backend 배포 전 backup 파일로 원복.
- `backend/src/routes/total.ts`, `backend/scripts/monthly-evidence-join-dry-run.ts`, `frontend/src/app/total/page.tsx`, `frontend/src/app/total/page.module.css`를 직전 배포본으로 되돌린 뒤 build/restart.
- rollback 후 `/total` API 200과 raw identifier 0을 재확인.

## 네이버 광고 URL 표준 rule 초안

실제 광고 URL 변경 전에는 TJ님 승인 필요.

권장 템플릿:

```text
https://www.biocom.kr/<landing_path>?utm_source=naver&utm_medium=cpc&utm_campaign=<campaign_type>_<campaign_id>&utm_content=<adgroup_or_creative>&utm_term=<keyword>
```

브랜드검색:

```text
utm_source=naver&utm_medium=brandsearch&utm_campaign=naverbrandsearch_biocom_<pc_or_mo>_<landing>
```

파워링크:

```text
utm_source=naver&utm_medium=cpc&utm_campaign=powerlink_<campaign_id>&utm_content=<adgroup_id>&utm_term=<keyword>
```

성공 기준:

- 새 클릭이 VM Cloud `site_landing_ledger`에 UTM과 `NaPm`을 보존한다.
- checkout/payment 단계의 VM Cloud `attribution_ledger`에도 같은 first touch가 남는다.
- `/total`에서는 paid_naver/brandsearch/reference로 분리된다.

실패 시 해석:

- 랜딩에는 있는데 결제에 없으면 session/order bridge 문제.
- 광고 클릭 URL에 없으면 Naver Ads destination URL 설정 문제.
- 랜딩 직후 사라지면 redirect/query preservation 문제.

## 다음 할일

### Codex가 할 일

1. 운영 반영 전 local browser smoke를 진행한다. 무엇을 하는가: `/total`에서 2026년 5월 바이오컴 조회 후 UTM 후보 표를 확인한다. 왜 필요한가: API는 PASS했지만 화면 가독성은 별도 확인이 필요하다. 어떻게 하는가: 로컬 frontend 7010과 backend 7020에서 확인한다. 성공 기준: UTM 후보가 8개 이하로 보이고 “참고용, 예산 판단 제외” 문구가 보인다. 실패 시 다음 확인점: CSS overflow, API response key mismatch. 승인 필요 여부: NO, Green. 의존성: 로컬 서버. 추천 점수/자신감 91%.
2. Naver evidence aggregate endpoint 설계를 한다. 무엇을 하는가: `/api/attribution/ledger` item slice 대신 전체 aggregate를 반환하는 안전 endpoint 초안을 만든다. 왜 필요한가: 현재 144건 표시와 VM Cloud 전체 원장 숫자가 달라 사용자가 혼동할 수 있다. 어떻게 하는가: raw id 없이 class/touchpoint/count만 반환하는 contract를 문서화한다. 성공 기준: paid_naver/brandsearch/organic 후보가 전체 원장 기준으로 일관되게 나온다. 실패 시 다음 확인점: VM Cloud query performance와 response cache. 승인 필요 여부: 문서/로컬 설계는 NO, 운영 배포는 YES. 의존성: 없음. 추천 점수/자신감 87%.

### TJ님이 할 일

1. 네이버 광고 URL 표준화 승인 여부를 결정한다. 무엇을 승인하는가: 실제 네이버 광고 destination URL의 UTM 규칙 변경이다. 왜 필요한가: 현재도 `NaPm`은 일부 남지만 UTM 이름이 제각각이라 paid/brandsearch/organic 분리가 불안정하다. 어디서 하는가: Naver Ads 광고그룹/소재 URL 설정 화면. 어떻게 하는가: 위 템플릿대로 `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`을 넣는다. 성공 기준: 신규 클릭이 `site_landing_ledger`와 `attribution_ledger`에 같은 규칙으로 남는다. 실패 시 다음 확인점: redirect가 query string을 지우는지 확인한다. Codex가 대신 못 하는 이유: 실제 광고 계정 설정 변경은 외부 운영 변경이라 승인과 계정 접근이 필요하다. 승인 필요 여부: YES, Yellow. 의존성: 없음. 추천 점수/자신감 86%.
