작성 시각: 2026-05-23 22:05 KST
기준일: 2026-05-23
문서 성격: NPay matcher 결과를 Google ROAS 정합성용 영구 exact evidence로 반영하기 위한 설계안

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - harness/gdn/AUDITOR_CHECKLIST.md
  lane: Green
  allowed_actions:
    - read_only_matcher_result_review
    - read_only_ga4_duplicate_guard_review
    - no_send_design_documentation
    - approval_packet_preparation
  forbidden_actions:
    - vm_cloud_schema_change
    - vm_cloud_write
    - operating_db_write
    - google_ads_conversion_upload_or_send
    - google_ads_setting_change
    - gtm_publish
    - backend_deploy
    - raw_order_or_click_id_output
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite /home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3
      - 운영DB public.tb_iamweb_users read-only
      - GA4 BigQuery hurdlers-naver-pay.analytics_304759974 read-only
    window: 2026-05-16 00:00 KST ~ 2026-05-23 23:59:59 KST
    freshness: 2026-05-23 21:50 KST guard run
    confidence: high for aggregate matcher/guard counts, medium_high for future storage design
```

## 10초 요약

NPay 실제 결제완료 주문과 광고 클릭 의도를 붙이는 read-only matcher는 7일 기준 A급 strong match 13건을 찾았다.
이 13건의 주문 ID 후보 26개를 GA4에서 robust guard로 조회했더니 GA4 present 0개, robust_absent 26개라 중복 전송 위험은 현재 낮다.

다만 이것은 아직 임시 계산 결과다. 운영 판단과 향후 Google Ads observed conversion 후보로 쓰려면 `append-only exact evidence snapshot`으로 영구화해야 한다.

## 목적

Google Ads가 주장하는 ROAS와 내부 실제 결제완료 매출의 차이를 좁히려면, 실제 결제완료 주문 중 Google 클릭 근거가 있는 주문을 order-level로 고정해야 한다.

이 문서는 `read-only matcher 결과`를 바로 Google Ads에 보내는 설계가 아니다.
먼저 내부 장부에 "왜 이 주문을 Google 클릭 주문으로 볼 수 있는지"를 감사 가능한 evidence로 남기는 설계다.

## 현재 관측값

기준 window:
- 2026-05-16 00:00 KST ~ 2026-05-23 23:59:59 KST.
- source: VM Cloud SQLite + 운영DB read-only.

| 항목 | 값 |
|---|---:|
| live NPay intent | 340 |
| NPay 실제 결제완료 주문 | 25 |
| strong match | 19 |
| A급 strong match | 13 |
| B급 strong match | 6 |
| ambiguous | 6 |
| purchase without intent | 0 |
| strong match 금액 | 3,556,100원 |
| A급 strong match 금액 | 1,956,900원 |
| GA4 robust guard 조회 ID | 26 |
| GA4 present | 0 |
| GA4 robust_absent | 26 |

해석:
- `NPay 실제 결제완료가 없다`가 아니다.
- `Google 클릭 의도와 NPay 실제 결제완료가 붙는 임시 matcher 후보가 있다`가 현재 맞는 표현이다.
- `npay_intent_log.matched_order_no` 같은 영구 exact evidence 컬럼은 아직 비어 있어 화면/운영 판단에서 바로 쓰기 어렵다.

## 용어

| 용어 | 뜻 | 운영 처리 |
|---|---|---|
| 임시 matcher evidence | dry-run 스크립트가 운영DB 주문과 VM Cloud intent를 읽어서 계산한 후보 | 보고/설계 근거로만 사용 |
| 영구 exact evidence | 내부 원장에 append-only로 남기는 주문-클릭 연결 증거 | 화면, 감사, future upload 후보의 기준 |
| A급 strong match | 주문번호/금액/시간/의도 신호가 강하게 맞는 후보 | 영구 evidence 1차 대상 |
| B급 strong match | 일부 보조 근거는 있으나 A급보다 약한 후보 | 보류 또는 수동 검토 |
| GA4 robust guard | 이미 GA4 purchase로 들어간 주문인지 BigQuery에서 넓게 확인하는 중복 방지 | present면 전송 후보 제외 |

## 권장 저장 구조

권장안은 기존 intent row를 직접 덮어쓰는 방식이 아니라, 별도 append-only snapshot 테이블을 두는 것이다.

후보 테이블 이름:
- `google_roas_exact_evidence_snapshot`
- 또는 `npay_order_match_evidence`

권장 컬럼:

| 컬럼 | 값 예시 | 목적 |
|---|---|---|
| `id` | auto increment | 내부 row id |
| `site` | `biocom` | site 분리 |
| `evidence_scope` | `google_roas_npay_actual` | 어떤 프로젝트용 evidence인지 표시 |
| `window_start_kst` | 날짜시각 | 재현 가능한 조회 window |
| `window_end_kst` | 날짜시각 | 재현 가능한 조회 window |
| `matcher_version` | script/version/hash | 어떤 matcher 기준인지 |
| `match_grade` | `A` / `B` / `ambiguous` | confidence tier |
| `match_status` | `matched` / `held` / `blocked` | 운영 사용 가능 여부 |
| `matched_by` | `npay_intent_to_order_exact` | 사람이 읽는 match 근거 |
| `amount_krw` | 숫자 | 내부 actual 금액 |
| `amount_match_type` | `exact` / `minor_diff` | 금액 일치 수준 |
| `time_gap_seconds` | 숫자 | click/order 시간 차 |
| `has_gclid` | true/false | Google click id 존재 여부 |
| `has_gbraid` | true/false | Google click id 존재 여부 |
| `has_wbraid` | true/false | Google click id 존재 여부 |
| `ga4_guard_status` | `robust_absent` / `present` / `unknown` | 중복 guard 결과 |
| `ga4_guard_checked_at_kst` | 날짜시각 | guard freshness |
| `eligible_for_observed_conversion` | true/false | 미래 Google Ads 전송 후보 여부 |
| `block_reasons_json` | JSON array | 왜 아직 전송 후보가 아닌지 |
| `source_refs_json` | JSON object | raw id 대신 내부 row 참조/hash |
| `created_at_kst` | 날짜시각 | snapshot 생성 시각 |
| `created_by` | `codex_readiness_sprint` 등 | 감사 용도 |

주의:
- raw 주문번호, raw channel order no, raw gclid/gbraid/wbraid는 보고서 테이블에 평문으로 넣지 않는다.
- 전송이 실제로 필요해지는 시점에는 원본 테이블을 controlled join해서 payload preview를 만든다.
- 문서/프론트 화면에는 raw 식별자를 출력하지 않는다.

## 왜 기존 컬럼 직접 업데이트가 1순위가 아닌가

`npay_intent_log`에는 이미 `matched_order_no`, `matched_order_amount`, `matched_at`, `match_confidence`, `match_reason` 계열 컬럼이 있다.
그래도 1차 반영은 별도 append-only snapshot을 권장한다.

이유:
1. dry-run 결과를 직접 덮어쓰면 어떤 matcher 버전이 어떤 window로 판단했는지 추적이 약해진다.
2. B급/ambiguous 후보를 잘못 승격할 위험이 있다.
3. Google Ads 전송 후보와 내부 화면 표시 후보를 분리하기 어렵다.
4. append-only snapshot은 잘못 반영해도 새 snapshot으로 정정할 수 있어 감사와 rollback이 쉽다.

운영 안정화 후에는 두 가지 중 하나를 선택한다.
- 프론트/요약 API가 snapshot을 직접 읽는다.
- 7일 이상 안정화 후 A급만 `npay_intent_log` 영구 컬럼에 backfill한다.

## eligibility 규칙

Google Ads observed conversion 후보는 아래 조건을 모두 만족해야 한다.

```text
payment_status == confirmed
site == biocom
match_grade == A
amount_krw > 0
has_gclid or has_gbraid or has_wbraid
ga4_guard_status == robust_absent
ambiguous == false
already_sent_to_google_ads == false
approval_status == approved
```

하나라도 빠지면 `eligible_for_observed_conversion=false`다.
특히 `approval_status == approved` 전에는 Google Ads 전송 후보가 아니다.

## 단계별 실행안

### Phase 0. Green, 완료

무엇:
- read-only matcher 재실행.
- GA4 robust guard read-only 실행.
- 설계 문서 작성.

성공 기준:
- A급 strong match 수와 GA4 robust guard 결과가 문서에 남는다.
- no-send/no-write/no-deploy/no-publish가 유지된다.

현재 결과:
- A급 strong match 13건.
- GA4 present 0 / robust_absent 26.

### Phase 1. 승인 필요, append-only evidence snapshot 생성

무엇:
- VM Cloud SQLite에 append-only snapshot 테이블을 만들거나, 기존 migration 체계가 있으면 그 안에 추가한다.
- A급 strong match만 1차 snapshot으로 기록한다.

왜:
- 프론트 화면과 후속 전환 설계가 매번 dry-run 결과에 의존하지 않게 한다.
- "이 주문이 왜 Google 클릭 주문 후보인지"를 재현 가능하게 만든다.

승인 필요:
- YES. VM Cloud schema/write 변경이므로 TJ님 승인 전 실행하지 않는다.

성공 기준:
- snapshot row 수가 A급 후보 수와 일치한다.
- GA4 guard status가 `robust_absent`로 기록된다.
- ambiguous/B급은 전송 후보가 아닌 hold 상태로 분리된다.

실패 시 해석:
- row 수 불일치면 matcher/dedupe key 문제.
- GA4 guard unknown이면 BigQuery 권한/source freshness 문제.
- click id flag가 비면 click evidence extraction 문제.

### Phase 2. Green/Yellow, dashboard read path 연결

무엇:
- `/api/google-ads/dashboard` 또는 별도 read-only endpoint가 snapshot 집계를 읽게 한다.
- `/ads/google-roas-report`에 `NPay exact evidence`, `GA4 guard`, `observed conversion readiness` 카드를 추가한다.

왜:
- TJ님이 Google Ads 주장 ROAS와 내부 exact evidence 진행률을 같은 화면에서 볼 수 있어야 한다.

승인 필요:
- 로컬 프론트/백엔드 구현은 Green.
- VM Cloud backend 배포가 필요하면 Yellow 승인 필요.

성공 기준:
- 화면에서 A급 exact evidence 수, guard pass 수, upload 후보 0/승인 대기 상태가 보인다.
- 플랫폼 주장 ROAS와 내부 confirmed ROAS가 섞이지 않는다.

### Phase 3. Red, Google Ads observed conversion upload 설계와 승인

무엇:
- 실제 결제완료 주문만 Google Ads에 알려주는 새 전환 통로를 만든다.

왜:
- Google Ads의 기존 `구매완료` Primary가 내부 actual보다 과대 주장하는 문제를 줄이려면 실제 결제완료만 관찰시키는 보조 전환이 필요하다.

승인 필요:
- YES. Google Ads conversion upload/send는 Red Lane이다.

성공 기준:
- 전송 전 payload preview에서 raw id, value, time, click id, order id가 정확히 매칭된다.
- 이미 GA4/Google Ads에 있는 전환은 제외된다.
- 테스트 window와 rollback/adjustment 계획이 문서화된다.

## 프론트엔드 보고서 상태

Google ROAS 정합성 프론트엔드 보고서 페이지는 이미 있다.

| 항목 | 값 |
|---|---|
| 경로 | `/ads/google-roas-report` |
| 로컬 URL | `http://localhost:7010/ads/google-roas-report` |
| 파일 | `frontend/src/app/ads/google-roas-report/page.tsx` |
| 홈 연결 | `frontend/src/app/page.tsx`의 AI CRM 카드 |
| 성격 | 정적 `.html` 파일이 아니라 Next.js 페이지가 브라우저에 HTML로 렌더링되는 보고서 |

현재 페이지는 Google Ads dashboard API를 읽고 `last_7d`, `last_30d` 기준 플랫폼 ROAS, 내부 ROAS, NPay actual 보정, click id health를 보여준다.
다음 보강 대상은 이 문서의 snapshot 집계와 GA4 guard 결과를 카드로 추가하는 것이다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

No-send verified: YES.
No-write verified: YES.
No-deploy verified: YES.
No-publish verified: YES.
No-platform-send verified: YES.

Notes:
- 이 문서는 설계안이며 VM Cloud schema/write는 실행하지 않았다.
- exact evidence 영구 반영은 승인 전 보류다.
- Google Ads 전송은 별도 Red Lane 승인 없이는 실행하지 않는다.
