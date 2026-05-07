# `/total` 운영 화면 설계 초안

작성 시각: 2026-05-07 01:52 KST
상태: design_ready
Owner: total / frontend handoff
Next document: Claude Code 구현 handoff 또는 API contract
Do not use for: 실제 `/total` API 구현 완료 판정, 운영 수치 확정, platform send 승인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - total/!total-current.md
    - ontology/!ontology.md
  lane: Green frontend 설계
  allowed_actions:
    - 화면 정보 구조 설계
    - API 응답 필드 초안
    - Claude Code handoff 문서 작성
  forbidden_actions:
    - 운영 API 구현 완료 선언
    - 운영 DB write
    - platform send
    - 광고 계정 설정 변경
  source_window_freshness_confidence:
    source: "total/!total-current.md + immediate monitoring + Meta/Google dry-run"
    window: "2026-05-07 KST"
    freshness: "Mode B live smoke 이후 24h/72h monitoring 대기"
    confidence: 0.86
```

## 10초 결론

`/total` 화면은 “광고 플랫폼이 주장하는 값”과 “실제 결제완료 원장 기준 값”을 분리해서 보여주는 운영 관제판이어야 한다.

지금 바로 화려한 ROAS 화면을 만들면 안 된다. 먼저 운영자가 매일 헷갈리지 않게 `현재 정본`, `수집 상태`, `채널 배정 상태`, `unknown/quarantine`, `승인 대기`를 한 화면에서 이해하게 해야 한다.

## 화면의 첫 문장

추천 문구:

> 이 화면은 월별 매출을 유입 채널별로 한 번만 나누기 위한 정본 관제판입니다. Google/Meta/TikTok/Naver가 주장하는 전환값은 참고값이고, 예산 판단은 실제 결제완료 주문 원장 기준 내부 confirmed 매출을 우선합니다.

## 핵심 카드 구성

### 1. 현재 운영 상태 카드

목적: TJ님이 지금 무엇을 기다리는지 5초 안에 알게 한다.

표시할 내용:

- 현재 P0: `paid_click_intent Mode B 24h/72h monitoring`.
- 상태: backend receiver route 배포 완료, GTM live v142 publish 완료, live smoke 통과.
- 남은 병목: 24h/72h actual traffic monitoring.
- 다음 컨펌: monitoring PASS 이후 minimal paid_click_intent ledger write.

### 2. 내부 매출과 플랫폼 참고값 분리 카드

목적: ROAS 혼선을 막는다.

표시할 내용:

- `내부 confirmed revenue`: 실제 결제완료 주문 원장 기준 매출.
- `platform_reference_value`: Google/Meta/TikTok/Naver/GA4가 주장하는 전환값.
- `internal_confirmed_roas`: 예산 판단 후보.
- `platform_reference_roas`: 참고만 보는 값.

금지 문구:

- Google Ads ROAS를 `실제 ROAS`라고 표시하지 않는다.
- Meta purchase value를 내부 매출처럼 합산하지 않는다.

### 3. Source freshness 카드

목적: 숫자가 stale인지 바로 보게 한다.

필드:

```ts
type SourceFreshnessCard = {
  source_name: string;
  source_role: "primary" | "cross_check" | "fallback" | "platform_reference";
  max_observed_at_kst: string | null;
  row_count: number | null;
  freshness: "fresh" | "warn" | "stale" | "unavailable" | "source_unavailable_before_publish";
  confidence: number;
  warning_message?: string;
};
```

### 4. 채널 배정 카드

목적: 월별 주문 매출이 어디까지 채널별로 나뉘었는지 보여준다.

표시할 bucket:

- paid_meta
- paid_google
- paid_tiktok
- paid_naver
- organic_search
- owned_crm
- direct
- unknown_quarantine

주의:

- `payment_method=npay`는 `paid_naver`가 아니다.
- NPay 실제 결제완료 주문은 매출에 포함한다.
- NPay click/count/payment start는 purchase가 아니다.

### 5. Google Ads 정상화 진행 카드

목적: `0.8% vs 97.75%` 병목을 계속 추적한다.

표시할 내용:

- 전체 운영 결제완료 주문 기준 Google click id 보유: `5/623 = 0.8%`.
- Google Ads 랜딩 세션 기준 click id 보유: `6,724/6,879 = 97.75%`.
- 해석: 광고 랜딩에는 click id가 있지만 주문 후보까지 전달되지 않는 것이 병목.
- 현재 조치: paid_click_intent receiver + GTM v142.
- 다음 판단: 24h/72h monitoring 후 minimal ledger write.

### 6. Meta campaign mapping 카드

목적: 캠페인별 ROAS 왜곡을 막는다.

표시할 내용:

- mapped: 1건.
- split_required/order-level 필요: 6건.
- precision_loss_review: 2건.
- excluded: 1건.

CTA:

- 그로스파트 확인 필요 2건은 [[../otherpart/!otherpart]]로 연결한다.

### 7. 승인 큐 카드

목적: TJ님이 지금 눌러야 하는 결정을 줄인다.

현재 표시:

- open approval 없음.
- 다음 후보: 24h/72h monitoring PASS 이후 minimal paid_click_intent ledger write.

연결:

- [[../confirm/!confirm]]

## API 응답 초안

아직 구현 완료 API가 아니다. Claude Code가 화면을 만들 때 기준으로 삼을 계약 초안이다.

```ts
type TotalCurrentSummary = {
  generated_at_kst: string;
  canonical_doc: string;
  active_phase: string;
  active_status: string;
  open_approval_count: number;
  source_freshness: SourceFreshnessCard[];
  roas_rail: {
    site: string;
    month: string;
    internal_confirmed_revenue: number | null;
    platform_reference_values: Array<{
      platform: "google_ads" | "meta" | "tiktok" | "naver" | "ga4";
      value: number | null;
      spend: number | null;
      roas: number | null;
      warning: string;
    }>;
  };
  paid_click_intent: {
    mode_b_status: "published_monitoring" | "pass" | "fail" | "blocked";
    gtm_live_version: string | null;
    receiver_health_ok: boolean | null;
    no_write_verified: boolean;
    no_platform_send_verified: boolean;
    monitoring_docs: string[];
  };
  google_ads_readiness: {
    payment_complete_candidates: number;
    with_google_click_id: number;
    structurally_eligible_after_approval: number;
    top_block_reasons: Array<{ reason: string; count: number }>;
  };
  meta_campaign_mapping: {
    mapped_manual: number;
    split_required_order_level_needed: number;
    precision_loss_review: number;
    excluded_from_meta_roas: number;
    otherpart_doc: string;
  };
};
```

## Claude Code 구현 기준

1. 첫 화면은 카드 7개 이하로 제한한다.
2. 표보다 “현재 상태 문장 + 작은 숫자 카드 + 자세히 보기 링크”를 우선한다.
3. `platform_reference`와 `internal_confirmed`는 색과 라벨을 다르게 둔다.
4. 경고는 숫자 옆에 바로 붙인다. 예: `Google Ads ROAS 8.56x (참고값, 예산 판단 금지)`.
5. 링크는 정본 문서만 노출한다. 운영자가 10개 문서를 보게 만들지 않는다.

## 100% 완료 기준

- `/total`에서 현재 P0와 승인 큐를 혼동 없이 볼 수 있다.
- Google/Meta/TikTok/Naver 플랫폼 주장값과 내부 confirmed 매출이 분리 표시된다.
- source freshness가 warn/stale이면 화면에서 예산 판단 보류 문구가 나온다.
- unknown/quarantine 매출이 숨겨지지 않는다.
- 문서 링크는 3개 이하로 유지된다.

## 다음 할일

1. Codex는 24h/72h monitoring 결과가 나오면 이 설계의 카드 값을 업데이트한다.
2. Claude Code는 이 문서를 기준으로 `/total` 화면을 구현한다.
3. API가 아직 없으면 mock JSON으로 UI를 먼저 만들되, `mock` 라벨을 화면에 표시한다.
4. 운영 수치를 연결할 때는 `source`, `window`, `freshness`, `confidence`를 항상 같이 내려준다.
