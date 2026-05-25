# Naver ROAS screen API connection approval 20260525

작성 시각: 2026-05-25 23:59 KST
기준일: 2026-05-25
문서 성격: 네이버 광고 전체 ROAS 화면 API 연결 승인안

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - docurule.md
    - frontrule.md
    - project/naver-brandsearch-order-bridge-preview-result-20260525.md
    - project/biocom-naver-brandsearch-unresolved-breakdown-20260525.md
    - report/reportcoffee-naver-display-hermes-export-result-20260525.md
  lane: Yellow_after_TJ_approval_for_backend_deploy
  allowed_before_approval:
    - frontend static report improvement
    - local API shape design
    - read-only script and document output
  allowed_after_approval:
    - backend read-only route implementation
    - local API smoke
    - VM Cloud backend deploy/restart
    - post-deploy read-only smoke
  forbidden_even_after_approval:
    - naver_ads_state_change
    - ad_create_edit_delete
    - bid_budget_keyword_mutation
    - platform_conversion_send
    - operating_db_write
    - gtm_publish
    - hermes_ad_change_or_charge
    - raw_secret_or_customer_identifier_output
  source_window_freshness_confidence:
    source: "Naver Search Ad API cache + Naver brandsearch manual cost cache + Hermes display export"
    window: "channel별 window 분리 유지"
    freshness: "2026-05-25 local docs/JSON 기준"
    confidence: "medium for architecture, channel별 source confidence split required"
```

## 10초 요약

`/ads/naver-roas`는 브랜드검색 전용 화면이 아니라 네이버 광고 전체 ROAS 프로젝트 화면이어야 한다. 그래서 API도 검색광고/쇼핑검색, 브랜드검색, 성과 디스플레이를 한 endpoint 안에서 channel별로 분리해 내려줘야 한다.

실제 backend 배포는 Yellow Lane이다. 하지만 승인 전까지는 local route 설계, 정적 프론트 고도화, read-only 결과 문서화까지 Green Lane으로 진행할 수 있다.

## 화면에서 가능해질 것

운영자는 한 화면에서 아래를 구분한다.

1. 검색광고/쇼핑검색 광고비가 API cache로 준비됐는가.
2. 브랜드검색 비용과 주문 정본 bridge가 어디까지 붙었는가.
3. 성과 디스플레이 광고비는 Hermes 수동 export가 있는가.
4. 네이버 주장 전환매출과 내부 confirmed 매출이 섞이지 않았는가.
5. 다음에 무엇을 해야 네이버 전체 ROAS가 예산 판단값으로 올라가는가.

## 제안 API

후보 endpoint:

```text
GET /api/ads/naver-roas/dashboard?site=all&period=current
GET /api/ads/naver-roas/dashboard?site=biocom&period=last_30d
GET /api/ads/naver-roas/dashboard?site=thecleancoffee&period=weekly
```

응답 핵심 구조:

```json
{
  "ok": true,
  "generated_at": "ISO8601",
  "mode": "read_only",
  "source_policy": {
    "internal_confirmed_roas": "actual paid/completed order revenue divided by ad spend",
    "naver_claim_roas": "reference only",
    "do_not_mix_windows": true
  },
  "channels": {
    "search_ads": {},
    "brandsearch": {},
    "display": {}
  },
  "okr_progress": [],
  "action_plan": [],
  "warnings": []
}
```

## Channel별 source 규칙

### 검색광고/쇼핑검색

- 비용 source: Naver Search Ad API -> VM Cloud `naver_ads_daily` cache.
- 현재 확인:
  - biocom 2026-04-21~2026-05-20 광고비 7,276,795원, 클릭 12,443건.
  - coffee 2026-05-18~2026-05-24 검색광고비 440원.
- 매출 source: 같은 window의 내부 결제완료 주문 중 paid_naver evidence.
- 주의: `convAmt`는 네이버 주장 전환매출이다. 내부 confirmed 매출에 더하지 않는다.

### 브랜드검색

- 비용 source: TJ님 확정 계약 금액을 날짜별로 나눈 VM Cloud manual cost cache.
- 현재 확인:
  - biocom bridge window 비용 205,336원.
  - coffee bridge window 비용 770,005원.
- 매출 source: VM Cloud 브랜드검색 marker + 운영DB/Imweb 주문 정본 bridge.
- 현재 warning:
  - biocom은 최신 재조회 기준 미해결 6건.
  - coffee는 현재 marker 11건 모두 exact.

### 성과 디스플레이

- 비용 source: Hermes 수동 XLSX export.
- 현재 확인:
  - coffee 2026-05-18~2026-05-24 `[ADVoost] 쇼핑` 광고비 350,098원, 클릭 194건.
- 매출 source:
  - 현재는 네이버 주장 전환값만 확인.
  - 내부 confirmed order join은 다음 preview 필요.
- 주의:
  - 검색광고 API에 들어오지 않는 광고비가 있다.
  - Hermes는 read-only/download-only command/result bridge로 운영한다.

## 승인 후 구현 범위

### 허용

1. backend read-only route 추가 또는 기존 ads route에 summary endpoint 추가.
2. 로컬 API smoke.
3. frontend가 정적 상수 대신 API 응답을 읽도록 연결.
4. VM Cloud backend deploy/restart.
5. 배포 후 endpoint 200, no-write invariant, 화면 렌더 smoke.

### 금지

1. Naver Ads 광고 생성/수정/삭제/예산/입찰/키워드 변경.
2. 광고 플랫폼 전환 전송.
3. 운영DB write.
4. GTM/Imweb 변경.
5. Hermes에서 다운로드 외 액션.
6. raw secret, raw 고객 식별자, raw 주문/결제 식별자 출력.

## 배포 전 체크리스트

1. 현재 backend route diff 확인.
2. `npx tsc --noEmit` 또는 변경 파일 typecheck.
3. local endpoint smoke.
4. frontend `/ads/naver-roas` desktop/mobile smoke.
5. raw identifier scan.
6. `python3 scripts/harness-preflight-check.py --strict`.
7. rollback command 확인.

## 배포 후 smoke

확인할 화면:

```text
http://localhost:7010/ads/naver-roas
https://att.ainativeos.net/api/ads/naver-roas/dashboard?site=all
```

성공 기준:

1. API status 200.
2. `channels.search_ads`, `channels.brandsearch`, `channels.display`가 모두 존재.
3. source/window/freshness/confidence가 channel별로 표시.
4. 네이버 주장 전환매출과 내부 confirmed 매출이 분리.
5. frontend 첫 화면이 “브랜드검색 전용”이 아니라 “네이버 광고 전체”로 보인다.
6. no-write/no-send/no-platform-change invariant 유지.

## Rollback

1. route 연결 전 commit으로 되돌린다.
2. VM Cloud backend restart 전 snapshot commit을 기준으로 checkout/redeploy한다.
3. frontend는 API 실패 시 정적 fallback 또는 “API 연결 대기” 상태를 표시한다.

## 승인 요청 문구

아래 문구를 승인하면 Codex가 backend read-only route 구현, 로컬 smoke, VM Cloud deploy/restart, post-smoke까지 진행한다.

```text
네이버 ROAS 화면 API 연결 Yellow sprint 승인합니다.
허용: backend read-only route 구현, frontend API 연결, local smoke, VM Cloud deploy/restart, post-deploy read-only smoke.
금지: Naver Ads 광고 변경, 전환 전송, 운영DB write, GTM/Imweb 변경, Hermes 다운로드 외 액션, raw 식별자 출력.
```

## 다음 할일

### Auto Green

1. frontend 정적 페이지를 네이버 광고 전체 ROAS 프로젝트 구조로 고도화한다.
   - 담당: Codex
   - 상태: 진행 중.
   - 성공 기준: 첫 화면에서 검색광고/브랜드검색/성과 디스플레이가 모두 보인다.
   - 승인 필요 여부: NO.

2. API route skeleton을 local-only로 설계한다.
   - 담당: Codex
   - 성공 기준: 구현 전 응답 shape와 source fallback이 확정된다.
   - 승인 필요 여부: 구현 자체는 Green, VM Cloud deploy는 Yellow 승인 필요.

### Approval Needed

1. backend deploy/restart를 포함한 API 연결 sprint.
   - 담당: TJ님 승인, Codex 실행.
   - 승인 필요 이유: VM Cloud backend 배포/재시작은 운영 접점이다.
   - 성공 기준: 배포 후 read-only endpoint 200과 frontend smoke 통과.
