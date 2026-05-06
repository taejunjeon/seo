# 월별 유입 채널 매출 정합성 계획

작성 시각: 2026-05-04 18:27 KST
기준일: 2026-05-04
대상: biocom 우선. 이후 thecleancoffee, aibio, coffeevip로 확장.
문서 성격: Green Lane 설계 문서. 실제 전송, 배포, 운영 DB write는 하지 않는다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  required_context_docs:
    - data/!datacheckplan.md
    - meta/meta-roas-gap-confirmation-runbook-20260504.md
    - meta/campaign-alias-mapping.md
    - meta/campaign-mapping-growth-team-guide-20260504.md
    - meta/meta-utm-setup-growth-team-guide-20260504.md
    - tiktok/!tiktokroasplan.md
    - gdn/!gdnplan.md
    - naver/!npayroas.md
  lane: Green
  allowed_actions:
    - 문서 작성
    - read-only source 목록 설계
    - 월별 dry-run 산출 설계
    - API/원장/플랫폼 응답 비교 설계
  forbidden_actions:
    - GTM 운영 게시
    - 광고 플랫폼 전환 송출
    - 운영 DB write/import/update
    - backend 운영 반영(deploy)
    - Imweb header/footer 수정
    - Toss/Imweb 결제 상태 변경
  source_window_freshness_confidence:
    source: "기존 Meta/TikTok/GDN/NPay 정본 문서와 로컬 코드/원장 구조"
    window: "2026-05-04 KST 설계 기준"
    freshness: "설계 문서. 월별 숫자는 산출 전이며 source별 최신성은 산출 시 별도 기록"
    confidence: 0.84
```

## 10초 결론

목표는 매월 전체 확정 매출을 `Meta`, `TikTok`, `Google`, `Naver/NPay`, `Organic`, `Direct`, `Referral`, `CRM`, `Influencer`, `Unknown`으로 한 번만 나누는 것이다.

정답 매출은 GA4나 광고 플랫폼 값이 아니라 `아임웹 주문 + 토스 결제 + 취소/환불 보정`으로 만든 내부 확정 매출이다. 광고 플랫폼 값은 `플랫폼이 주장하는 참고 ROAS`로만 보고, 월별 채널 매출의 정본으로 쓰지 않는다.

가장 중요한 설계 원칙은 `매출 장부`와 `유입 증거`를 분리하는 것이다. 매출은 주문/결제 원장에서 확정하고, 유입 채널은 GTM, VM attribution ledger, GA4 raw, CAPI funnel, click id, UTM, referrer 증거를 붙여 결정한다.

첫 구현은 read-only dry-run이어야 한다. 성공 기준은 특정 월의 `채널별 순매출 합계`가 `월 전체 확정 순매출`과 정확히 맞고, unknown/quarantine 매출의 이유가 주문 단위로 설명되는 것이다.

## 고등학생 비유

이 작업은 매달 통장 입금 내역에 `이 돈은 어느 길로 온 손님이 쓴 돈인가`라는 이름표를 붙이는 일이다. 광고 플랫폼은 각자 “내 광고 덕분”이라고 주장하므로, 우리는 실제 주문과 결제 장부를 먼저 보고 증거가 있는 매출만 채널에 붙인다.

## 역할 원칙

이 프로젝트에서는 역할을 아래처럼 고정한다.

| 주체 | 담당 범위 | 담당하지 않는 것 |
|---|---|---|
| Codex | 백엔드 API, DB/read-only 쿼리, 원장 설계, 채널 배정 규칙, source 조사, dry-run script, 문서/로드맵 정리 | 최종 프론트엔드 화면 구현 |
| Claude Code | `/total` 같은 프론트엔드 화면, UI 문구, 시각화, 모바일/PC 화면 품질 | 백엔드 로직, DB 설계, source 조사, 채널 배정 알고리즘 |
| TJ | 사업 판단, 권한 부여, 운영 반영 승인, 외부 계정 2FA, 실결제 테스트 | Codex가 read-only/API/로컬 파일로 먼저 확인할 수 있는 조사 |

따라서 이 문서의 조사, 설계, 백엔드 산출은 Codex가 맡는다. 나중에 실제 `/total` 프론트엔드 페이지를 만들 때는 Claude Code가 `frontrule.md`를 보고 구현한다.

## 관련 문서

| 문서 | 역할 |
|---|---|
| [[source-inventory-20260504|월별 채널 매출 source 목록]] | source별 역할, 권한, 최신성, 한계 |
| [[join-key-matrix-20260504|주문·결제 조인 키 매트릭스]] | 월별 주문·결제 spine을 만들 키와 실패 처리 규칙 |
| [[monthly-spine-dry-run-contract-20260504|2026년 4월 biocom 주문·결제 spine dry-run 계약]] | 월별 주문·결제 spine API/SQL 계약과 1차 sanity check |
| [[attribution-vm-evidence-join-contract-20260504|Attribution VM evidence join 계약]] | 주문·결제 spine에 유입 증거를 붙이는 규칙 |
| [[total-api-contract-20260504|`/total` 월별 채널 매출 API 계약]] | Claude Code가 `/total` 화면을 만들 때 쓸 API 응답 구조 |
| [[total-frontend-handoff-20260504|`/total` 프론트엔드 handoff]] | Claude Code가 화면을 구현할 때 지켜야 할 정보 구조와 경고 문구 |
| [[../gdn/google-ads-npay-purchase-contamination-report-20260505|Google Ads NPay/구매완료 전환 오염 리포트]] | Google Ads platform ROAS가 내부 confirmed 매출과 다른 이유 |
| [[../gdn/google-ads-npay-quality-deep-dive-20260505|Google Ads NPay 오염 및 유입 품질 심층 리포트]] | Google Ads와 Meta 유입의 체류시간, 스크롤, 결제 시작, NPay 클릭을 비교하고 예산 감액 판단을 기록 |
| [[../gdn/google-ads-purchase-primary-change-approval-20260505|Google Ads `구매완료` Primary 변경 승인안]] | NPay count label을 purchase primary에서 내릴지 판단하기 위한 승인 전 검토 문서 |
| [[../gdn/google-ads-campaign-signal-audit-20260505|Google Ads 캠페인별 신호 감사 및 NPay 변경 확인]] | 캠페인별 primary NPay value, GA4/GTM NPay 변경 시점, Google Ads 미변경 여부, confirmed purchase 설계 방향 |
| [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505|Google Ads 실제 결제완료 주문만 구매로 알려주는 새 전환 통로 실행 승인안]] | 홈페이지 결제완료와 NPay 실제 결제완료 주문은 포함하고, NPay 클릭/결제시작은 구매에서 제외하는 새 Google Ads 구매 신호 승인안 |
| [[../gdn/google-ads-confirmed-purchase-operational-dry-run-20260505|Google Ads confirmed purchase 운영 source no-send dry-run]] | 운영 DB, Attribution VM, GA4 BigQuery를 조인해 실제 결제완료 주문만 후보로 남기고, NPay 클릭/count/payment start만 있는 신호는 제외한 dry-run 결과 |
| [[../gdn/google-ads-npay-feedback-execution-plan-20260505|Google Ads NPay 피드백 반영 실행 계획]] | `NPay가 나쁘다`가 아니라 `NPay 클릭/count를 구매완료로 학습시키는 것이 위험하다`는 표현과 설계를 고정하고, Google/Meta 결제 전 퍼널 leakage를 read-only로 비교한 문서 |
| [[../gdn/google-click-id-preservation-plan-20260505|Google click id 보존률 개선 설계]] | Google Ads confirmed purchase 연결의 핵심 병목인 `gclid/gbraid/wbraid` 보존률 0.8% 문제와 개선 순서 |
| [[../gdn/confirmed-purchase-no-send-pipeline-contract-20260505|confirmed_purchase no-send 수신·디스패처 계약]] | 홈페이지 결제완료와 NPay 실제 결제완료만 purchase 후보로 받고, click/count/payment start는 제외하는 no-send contract |
| [[../gdn/paid-click-intent-gtm-preview-approval-20260506|paid_click_intent GTM Preview 승인안]] | Google click id가 랜딩에서 checkout/NPay intent/no-send receiver까지 이어지는지 Preview로만 검증하는 승인안 |
| [[../gdn/paid-click-intent-gtm-preview-result-20260506|paid_click_intent GTM Preview 결과 보고서]] | Preview only 실행 결과. storage/payload/receiver contract는 통과했고 browser receiver 직접 호출은 local HTTP 때문에 차단됨 |
| [[../gdn/paid-click-intent-receiver-access-result-20260506|paid_click_intent receiver 접근 검증 결과]] | 임시 HTTPS tunnel 재검증 결과. browser receiver 직접 호출까지 세 click id 케이스 모두 통과 |
| [[../gdn/google-ads-landing-clickid-analysis-20260506|Google Ads landing-session click id 분모 분석]] | GA4 BigQuery 기준 최근 7일 Google Ads 랜딩 세션 click id 보존률 97.75% 확인. 병목이 광고 URL이 아니라 주문 원장 연결임을 기록 |
| [[../gdn/paid-click-intent-gtm-production-publish-approval-20260506|paid_click_intent v1 GTM Production publish 승인안]] | 운영 GTM 게시 여부를 판단하기 위한 승인 문서. publish 범위, 금지선, rollback, 24h/72h 모니터링 기준 |
| [[../gdn/paid-click-intent-post-publish-monitoring-template-20260506|paid_click_intent post-publish 모니터링 템플릿]] | 운영 publish 승인 후 24h/72h에 확인할 fill-rate, receiver, rollback 기준 |
| [[../naver/npay-rail-source-gap-20260506|NPay rail source 공백 분리]] | 2026년 4월 NPay 139건 중 publish 이전 공백을 `source_unavailable_before_publish`로 분리 |
| [[total-confirmation-queue-20260505|월별 채널 매출 정합성 컨펌 대기열]] | TJ님 컨펌이 필요한 항목, Codex 추천, 데이터 충분성, 보류/진행 기준 |
| [[../GA4/gtm-tag-coverage-ignore-candidates-20260505|GTM Tag Coverage ignore 후보]] | 태그 누락 경고 중 고객 퍼널 blocker가 아닌 URL 정리 |
| [[../capivm/meta-funnel-capi-test-events-smoke-plan-20260505|Meta 표준 퍼널 CAPI Test Events smoke 준비안]] | ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo test-only 검증 계획 |
| [[../GA4/product-engagement-summary-contract-20260505|ProductEngagementSummary 내부 수집 contract]] | 체류시간/스크롤을 내부 분석 장부로 받는 no-write contract |
| [[../ontology/!ontology|Attribution Ontology Lite]] | NPay, paid click, confirmed purchase, platform_reference, guard decision 등 핵심 개념 정본 |
| [[../ontology/attribution-ontology-schema-contract-20260506|Attribution Ontology Schema Contract]] | `PaidClickIntent`, `ConfirmedPurchaseCandidate`, `GuardDecision` API/TypeScript field 계약 |
| [[../ontology/backend-attribution-field-alignment-plan-20260506|Backend Attribution Field Alignment Plan]] | no-send route의 camelCase/snake_case 응답 필드와 block reason 정렬 계획 |
| [[../ontology/term-conflict-audit-20260506|Attribution 용어 충돌 감사]] | 문서와 대시보드에서 오해될 수 있는 표현과 canonical term mapping |
| [[../meta/campaign-mapping-growth-team-guide-20260504|기존 캠페인 수동 매핑 가이드]] | 기존 Meta 캠페인 매핑 확인 기준 |
| [[../meta/meta-utm-setup-growth-team-guide-20260504|UTM 설정 가이드]] | 앞으로 광고 소재 URL에 붙일 UTM 표준 |

## Ontology 요약

정본 용어와 상태 모델은 [[../ontology/!ontology|Attribution Ontology Lite]]를 따른다.
API와 TypeScript field 기준은 [[../ontology/attribution-ontology-schema-contract-20260506|Attribution Ontology Schema Contract]]를 따른다.
현재 backend no-send route의 camelCase/snake_case 호환 정렬 계획은 [[../ontology/backend-attribution-field-alignment-plan-20260506|Backend Attribution Field Alignment Plan]]에 둔다.
핵심은 `클릭`, `결제 시작`, `실제 결제완료`, `플랫폼 주장값`, `내부 확정매출`을 섞지 않는 것이다.
`NPay click/count/payment start`는 구매가 아니고, `NPay actual confirmed order`는 내부 confirmed 매출에 포함한다.
Google Ads, Meta, GA4, TikTok 값은 `platform_reference`로 표시하고 내부 confirmed revenue에 합산하지 않는다.
애매한 주문은 추정 배정하지 않고 `unknown_quarantine`과 `block_reason`으로 남긴다.

## Google/NPay 진행 문서 상태

문서가 많아졌기 때문에 이 표를 index로 사용한다.
상세 설명은 각 문서에 두고, 이 문서에는 역할과 다음 액션만 남긴다.

| 문서 | 역할 | Status | 다음 액션 | 만료/보관 조건 |
|---|---|---|---|---|
| [[../gdn/google-click-id-preservation-plan-20260505|Google click id 보존률 개선 설계]] | 원인/전략. 전체 주문 기준 0.8%, Google 후보 기준 50%, Google Ads 랜딩 세션 기준 97.75%를 분리해 해석 | active | TJ님 운영 publish 판단 | Production publish 후 v2 작성 |
| [[../gdn/paid-click-intent-receiver-access-result-20260506|paid_click_intent receiver 접근 검증 결과]] | Yellow Lane Preview 후속 실행 결과 | pass / HTTPS tunnel receiver verified | TJ님 운영 publish 판단 | 운영 publish 승인안 작성 후 close |
| [[../gdn/google-ads-landing-clickid-analysis-20260506|Google Ads landing-session click id 분모 분석]] | GA4 BigQuery raw로 Google Ads 랜딩 세션 click id 분모 확인 | complete / read-only | 운영 publish 후 실제 paid_click_intent fill-rate와 비교 | 운영 publish 24h/72h 모니터링 후 close |
| [[../gdn/paid-click-intent-gtm-production-publish-approval-20260506|paid_click_intent v1 GTM Production publish 승인안]] | 운영 GTM 게시 승인 문서 | pending TJ approval | TJ님 승인/보류 판단 | publish 결과 문서 작성 후 close |
| [[../gdn/paid-click-intent-post-publish-monitoring-template-20260506|paid_click_intent post-publish 모니터링 템플릿]] | 운영 publish 후 24h/72h 확인 기준 | ready / pending publish | publish 후 결과 문서에 사용 | publish 결과 문서 작성 후 close |
| [[../gdn/confirmed-purchase-no-send-pipeline-contract-20260505|confirmed_purchase no-send 수신·디스패처 계약]] | 실제 결제완료 주문만 purchase 후보로 받는 기술 계약 | active | no-send 샘플 확장과 dispatcher Red Lane 승인안 준비 | 실제 dispatcher 승인 전까지 유지 |
| [[../naver/npay-rail-source-gap-20260506|NPay rail source 공백 분리]] | 4월 NPay intent 미수집 기간을 별도 bucket으로 분리 | active for Apr close | channel assignment v0.3에 `npay_payment_unattributed` 또는 unknown reason 반영 | 4월 close 후 archive 또는 `!npayroas` 부록 흡수 |

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | source 목록과 권한 확인 | Codex | 86% / 0% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 주문·결제 정본 장부 | Codex | 78% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | 유입 증거 붙이기 | Codex | 76% / 0% | [[#Phase2-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | 채널 배정 dry-run | Codex | 52% / 0% | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | 플랫폼 ROAS 비교 | Codex | 65% / 0% | [[#Phase3-Sprint5\|이동]] |
| Phase4 | [[#Phase4-Sprint6]] | 수집 개선 승인 패키지 | TJ+Codex | Preview/receiver/분모 분석 통과 / 운영 publish TJ 판단 필요 | [[#Phase4-Sprint6\|이동]] |
| Phase5 | [[#Phase5-Sprint7]] | 월간 운영 루틴 | Codex | 50% / 0% | [[#Phase5-Sprint7\|이동]] |
| Phase5 | [[#Phase5-Sprint8]] | `/total` 프론트엔드 화면 | Claude Code | 대기 | [[#Phase5-Sprint8\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase1-Sprint1]] | 우리 기준 완료 | Codex | source 목록과 권한을 주문 단위로 정리했다 | 어떤 장부를 믿고 어떤 장부는 참고만 볼지 먼저 정해야 한다 | [[source-inventory-20260504]]에 source별 역할, 최신성, 권한, 한계를 기록했다 | [[#Phase1-Sprint1]] | NO |
| 2 | [[#Phase1-Sprint2]] | 우리 기준 완료 | Codex | 주문·결제 join key matrix를 작성했다 | 채널 분류 전에 어떤 키로 같은 주문을 판단할지 고정해야 한다 | [[join-key-matrix-20260504]]에 `payment_key`, `order_id`, `order_number`, `channelOrderNo` 우선순위를 기록했다 | [[#Phase1-Sprint2]] | NO |
| 3 | [[#Phase1-Sprint2]] | 우리 기준 완료 | Codex | 2026년 4월 biocom 주문·결제 spine dry-run 계약을 만들었다 | 실제 월별 총매출과 순매출이 먼저 맞아야 채널 배정이 의미 있다 | [[monthly-spine-dry-run-contract-20260504]]에 운영 Toss/Imweb read-only sanity check와 API/SQL 계약을 기록했다 | [[#Phase1-Sprint2]] | NO |
| 4 | [[#Phase1-Sprint2]] | 우리 기준 완료 | Codex | dry-run script 초안을 만들었다 | 계약만 있으면 매달 반복 실행이 안 된다 | `backend/scripts/monthly-spine-dry-run.ts`로 운영 Postgres read-only summary를 재현한다. 운영 배포는 하지 않았다 | [[#Phase1-Sprint2]] | NO |
| 5 | [[#Phase2-Sprint3]] | 우리 기준 완료 | Codex | Attribution VM evidence join 계약을 만들었다 | spine만으로는 Meta인지 Organic인지 판단할 수 없다 | [[attribution-vm-evidence-join-contract-20260504]]에 `primary_channel`, `assist_channels`, `evidence_confidence`, conflict rule을 기록했다 | [[#Phase2-Sprint3]] | NO |
| 6 | [[#Phase2-Sprint3]] | 우리 기준 완료 | Codex | evidence join dry-run script 초안을 만들고 실행했다 | 계약만 있으면 주문별 채널 배정 결과를 검증할 수 없다 | `backend/scripts/monthly-evidence-join-dry-run.ts --site=biocom --month=2026-04 --json`으로 운영 DB와 VM API를 read-only 조인했다 | [[#Phase2-Sprint3]] | NO |
| 7 | [[#Phase2-Sprint3]] | 부분 완료 | Codex | NPay matching rail source 접근을 해결했다 | NPay는 confirmed 매출이 있으나 return/intent 연결이 약하면 채널 분류가 흔들릴 수 있다 | 운영 VM SQLite snapshot으로 `npay_intent_log`를 읽어 [[../data/npay-roas-dry-run-vm-snapshot-20260505]]를 생성했다. live intent 820건, confirmed NPay 주문 30건, strong match 20건까지 확인했다 | [[#Phase2-Sprint3]] | NO |
| 8 | [[#Phase2-Sprint4]] | 우리 기준 완료 | Codex | channel assignment rule v0.2를 만들고 실행했다 | v0.1은 합계는 맞지만 unknown 매출이 커서 예산 판단용으로 부족하다 | click id, UTM, first-touch, NPay source 상태를 evidence tier로 분리했다 | [[#Phase2-Sprint4]] | NO |
| 9 | [[#Phase2-Sprint4]] | 우리 기준 완료 | Codex | paid_naver 후보 샘플 감사를 진행했다 | v0.2에서 `NaPm` 기반 paid_naver 후보가 크게 잡혀 검산이 필요했다 | VM ledger confirmed payment_success에서 `NaPm` 포함 row와 샘플 12건을 확인했다 | [[#Phase2-Sprint4]] | NO |
| 10 | [[#Phase3-Sprint5]] | 우리 기준 완료 | Codex | `platform_reference` value를 붙였다 | 내부 confirmed 매출과 플랫폼 주장값의 gap을 분리해 보여야 한다 | `backend/scripts/monthly-evidence-join-dry-run.ts` v0.4가 Meta/TikTok/Google 값을 read-only로 채우고 Naver는 `unavailable`로 둔다 | [[#Phase3-Sprint5]] | NO |
| 11 | [[#Phase5-Sprint7]] | 우리 기준 완료 | Codex | `/total` API 계약과 로컬 route를 만들었다 | Claude Code가 화면을 만들 때 숫자 의미가 흔들리면 안 된다 | [[total-api-contract-20260504]]와 `backend/src/routes/total.ts`를 만들고 7022 포트에서 dry-run route를 검증했다 | [[#Phase5-Sprint7]] | NO |
| 12 | [[#Phase5-Sprint8]] | 우리 기준 완료 | Codex | Claude Code handoff 문서를 만들었다 | `/total` 프론트엔드가 내부 매출과 플랫폼 참고값을 섞지 않게 해야 한다 | [[total-frontend-handoff-20260504]]에 첫 화면 KPI, 경고 문구, 클릭 drilldown, TikTok local cache 경고를 정리했다 | [[#Phase5-Sprint8]] | NO |
| 13 | [[#Phase3-Sprint5]] | 우리 기준 완료 | Codex | TikTok reference 최신성을 확인했다 | TikTok 값이 `local_cache`라 운영자가 확정 ROAS로 오해하면 안 된다 | `tiktok_ads_daily`가 2026-03-19~2026-05-03, imported 346행, usable 224행임을 확인하고 `sourceDiagnostics`로 내려주게 했다 | [[#Phase3-Sprint5]] | NO |
| 14 | [[#Phase3-Sprint5]] | 우리 기준 완료 | Codex | Google Ads NPay/구매완료 전환 오염 리포트를 만들었다 | Google Ads platform ROAS를 내부 confirmed 매출로 오해하면 예산 판단이 틀어진다 | [[../gdn/google-ads-npay-purchase-contamination-report-20260505]]에 최근 7일/30일 Google Ads API와 내부 ledger gap을 기록했다 | [[#Phase3-Sprint5]] | NO |
| 15 | [[#Phase3-Sprint5]] | 우리 기준 완료 | Codex | Google Ads와 Meta 유입 품질을 GA4 raw로 비교했다 | Google Ads가 완전히 무가치한지, 측정만 오염된 것인지 나눠야 한다 | [[../gdn/google-ads-npay-quality-deep-dive-20260505]]에 체류시간, 90% 스크롤, 일반 결제 시작, NPay 클릭, 홈페이지 purchase 비교를 기록했다 | [[#Phase3-Sprint5]] | NO |
| 16 | [[#Phase4-Sprint6]] | 승인안 작성 완료 / 실행 대기 | Codex | Google Ads `구매완료` primary 변경 승인안을 만들었다 | 오염된 NPay count label을 purchase primary에서 내리려면 자동입찰 리스크와 롤백 기준이 필요하다 | [[../gdn/google-ads-purchase-primary-change-approval-20260505]]에 선택지와 승인 문구를 기록했다 | [[#Phase4-Sprint6]] | 실행은 YES |
| 17 | [[#Phase1-Sprint1]] | 우리 기준 완료 | Codex | Tag Coverage ignore 후보를 분리했다 | 태그 누락 경고가 고객 퍼널 blocker인지 노이즈인지 나눠야 한다 | [[../GA4/gtm-tag-coverage-ignore-candidates-20260505]]에 27개 untagged 후보와 광고 랜딩 48개 tagged 결과를 기록했다 | [[#Phase1-Sprint1]] | NO |
| 18 | [[#Phase4-Sprint6]] | 준비안 완료 / 실행 대기 | Codex | Meta 표준 퍼널 CAPI Test Events smoke 준비안을 만들었다 | 운영 송출 전에 Browser/Server event_id dedup을 test-only로 확인해야 한다 | [[../capivm/meta-funnel-capi-test-events-smoke-plan-20260505]]에 네 이벤트 payload, 성공/실패 기준, 승인 게이트를 기록했다 | [[#Phase4-Sprint6]] | 실행은 YES |
| 19 | [[#Phase4-Sprint6]] | 우리 기준 완료 | Codex | ProductEngagementSummary contract를 만들었다 | 체류시간/스크롤을 Meta 전환으로 바로 보내면 학습 신호를 오염시킬 수 있다 | [[../GA4/product-engagement-summary-contract-20260505]]에 no-write payload, PII 차단, URL 정제, dedupe, dry-run 응답을 기록했다 | [[#Phase4-Sprint6]] | NO |
| 20 | [[#Phase3-Sprint5]] | 우리 기준 완료 | Codex | Google Ads 캠페인별 신호 감사를 진행했다 | Google Ads 전체가 아니라 어떤 캠페인이 NPay primary value에 끌려가는지 알아야 예산을 나눠 판단할 수 있다 | [[../gdn/google-ads-campaign-signal-audit-20260505]]에 최근 14일 캠페인별 비용, 입찰, primary NPay 비중을 기록했다 | [[#Phase3-Sprint5]] | NO |
| 21 | [[#Phase3-Sprint5]] | 우리 기준 완료 | Codex | GA4/GTM NPay 클릭 구매 오염 변경 시점을 확인했다 | NPay가 언제부터 클릭이 아니라 결제단계 신호로 바뀌었는지 알아야 전후 비교가 가능하다 | BigQuery raw `2026-04-18~2026-05-03`에서 `2026-04-24 23:45 KST` v138 이후 NPay purchase-like가 사실상 0으로 떨어진 것을 확인했다 | [[#Phase3-Sprint5]] | NO |
| 22 | [[#Phase4-Sprint6]] | 완료 / 실행 대기 | Codex+TJ | Google Ads confirmed purchase 전환 실행 승인 문서를 분리했다 | 기존 `구매완료` NPay label을 내리기 전 대체 purchase 신호와 롤백 기준이 필요하다 | [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]]에 Data Manager API, Google Ads API fallback, no-send dry-run, NPay 실제 결제완료 포함 기준을 기록했다 | [[#Phase4-Sprint6]] | 실행은 YES |
| 23 | [[#Phase2-Sprint3]] | 우리 기준 완료 | Codex | A급 NPay 후보의 GA4 중복 guard를 확인했다 | 이미 GA4에 있는 주문을 다시 보내면 매출이 중복된다 | A급 strong 10건의 `order_number + channel_order_no` 20개 ID를 GA4 BigQuery에서 조회했다. 2건은 present, 8건은 robust_absent로 분리하고 guarded dry-run에 반영했다 | [[#Phase2-Sprint3]] / [[../data/npay-ga4-robust-guard-vm-snapshot-20260505]] / [[../data/npay-roas-dry-run-vm-snapshot-20260505-ga4-guarded]] | NO, read-only |
| 24 | [[#Phase4-Sprint6]] | 우리 기준 완료 / 운영 실행 대기 | Codex | Google Ads confirmed purchase 운영 source no-send dry-run을 확장했다 | 실제 Google Ads로 보내기 전에 어떤 주문은 보낼 수 있고 어떤 주문은 막히는지 운영 source 기준으로 알아야 한다 | `backend/scripts/bi-confirmed-purchase-operational-dry-run.ts`로 운영 DB, Attribution VM, GA4 BigQuery를 read-only 조인했다. 최신 재실행 기준 2026-04-27~2026-05-05 주문 623건, NPay 실제 결제완료 37건, send_candidate 0건으로 산출했다 | [[#Phase4-Sprint6]] / [[../gdn/google-ads-confirmed-purchase-operational-dry-run-20260505]] | NO |
| 25 | [[#Phase3-Sprint5]] | 우리 기준 완료 | Codex | Google Ads NPay 피드백을 반영하고 leakage 분석을 보강했다 | NPay 실제 결제완료는 포함하고 NPay 클릭/count만 제외해야 예산 판단이 틀어지지 않는다 | [[../gdn/google-ads-npay-feedback-execution-plan-20260505]]에 피드백별 계획, `/ads/google` 문구 수정, BigQuery 7/14/28일 leakage 결과를 기록했다 | [[#Phase3-Sprint5]] | NO |
| 26 | [[#Phase3-Sprint5]] | 우리 기준 완료 / 전송 보류 | Codex | NPay GA4 누락 복구 샘플 8건 payload 승인안을 만들었다 | 8건은 복구 목표가 아니라 파이프라인 검증 샘플이며, 실제 전송은 별도 승인 전까지 금지해야 한다 | 주문번호, channel_order_no, 금액, paid_at, client_id, ga_session_id, event_id, dedupe_key, 72시간 초과 여부를 [[../naver/npay-ga4-recovery-sample-payload-approval-20260505]]에 표로 정리했다 | [[#Phase3-Sprint5]] / [[../naver/npay-ga4-recovery-sample-payload-approval-20260505]] | 실제 전송은 YES 필요 |
| 27 | [[#Phase4-Sprint6]] | 대기 | TJ+Codex | GTM 랜딩 저장과 GA4 BigQuery 권한 승인안을 분리한다 | Codex가 못 하는 계정 권한·운영 반영은 TJ님 판단이 필요하다 | Codex가 먼저 read-only 확인 후, 진짜 TJ-only 항목만 승인 요청으로 올린다 | [[#Phase4-Sprint6]] | YES |
| 28 | [[#Phase1-Sprint1]] | 우리 기준 완료 | Codex | source freshness에 운영 아임웹 주문 원장을 추가했다 | 월별 close 때 아임웹 운영 주문 원장 최신성을 수동 SQL 없이 확인해야 한다 | `backend/src/sourceFreshness.ts`에 `imweb_operational`을 추가하고 `check-source-freshness.ts --json`으로 검증했다 | [[#Phase1-Sprint1]] / [[../data/source-freshness-20260505-after-clickid-plan]] | NO |
| 29 | [[#Phase2-Sprint3]] | 우리 기준 완료 | Codex | Google click id 보존률 진단과 개선 설계를 만들었다 | Google Ads confirmed purchase는 `gclid/gbraid/wbraid`가 주문까지 남아야 붙는다 | [[../data/google-click-id-preservation-diagnostics-20260505]]에서 623건 중 5건, 보존률 0.8%를 확인하고 [[../gdn/google-click-id-preservation-plan-20260505]]에 개선 순서를 기록했다 | [[#Phase2-Sprint3]] / [[../gdn/google-click-id-preservation-plan-20260505]] | 운영 반영은 YES |
| 30 | [[#Phase4-Sprint6]] | 우리 기준 완료 / 운영 실행 대기 | Codex | confirmed_purchase no-send 수신·디스패처 계약을 만들었다 | 앞으로는 NPay 실제 결제완료와 홈페이지 결제완료만 purchase 후보로 만들고 click/count/payment start는 제외해야 한다 | `POST /api/attribution/confirmed-purchase/no-send` preview route와 [[../gdn/confirmed-purchase-no-send-pipeline-contract-20260505]]를 추가했다. paid click 보존 Preview는 별도 `POST /api/attribution/paid-click-intent/no-send`를 쓴다 | [[#Phase4-Sprint6]] / [[../gdn/confirmed-purchase-no-send-pipeline-contract-20260505]] | 실제 전송은 YES |
| 31 | [[#Phase4-Sprint6]] | 우리 기준 완료 | Codex | TJ님 컨펌 대기열을 만들었다 | 지금 바로 승인할 것과 보류할 것을 분리해야 운영 변경을 서두르지 않는다 | [[total-confirmation-queue-20260505]]에 Google click id, confirmed_purchase 기준, 8건 복구, 채널 분류표의 추천/보류 기준을 적었다 | [[#Phase4-Sprint6]] / [[total-confirmation-queue-20260505]] | 일부 YES |
| 32 | [[#Phase4-Sprint6]] | Preview/receiver 검증 통과 | TJ+Codex | paid_click_intent GTM Preview only와 receiver HTTPS 재검증을 실행했다 | Google click id가 랜딩에서 storage/payload/no-send receiver까지 살아남는지 실제 Preview 범위에서 확인해야 했다 | fresh temporary workspace에서 `gclid/gbraid/wbraid` 3개 케이스를 실행했다. storage 보존, payload 생성, Node-side receiver validation이 PASS였고, 임시 HTTPS tunnel 재검증에서 브라우저 receiver `200 ok=true`까지 PASS였다 | [[#Phase4-Sprint6]] / [[../gdn/paid-click-intent-receiver-access-result-20260506]] | 운영 publish는 YES |
| 33 | [[#Phase4-Sprint6]] | 우리 기준 완료 | Codex | Google Ads landing-session 기준 click id 분모 분석을 완료했다 | 전체 주문 기준 0.8%만 보면 Google Ads URL 문제처럼 오해할 수 있어, Google Ads 랜딩 세션 자체의 click id 유입률을 따로 봐야 했다 | GA4 BigQuery read-only 기준 최근 7일 Google Ads 증거 세션 6,879개 중 6,724개에 click id가 남아 보존률 97.75%였다. 일반 결제 시작 세션은 96.32%, NPay 클릭 세션은 99.65%가 click id를 보유했다 | [[#Phase4-Sprint6]] / [[../gdn/google-ads-landing-clickid-analysis-20260506]] | NO |
| 34 | [[#Phase4-Sprint6]] | 승인 대기 | Codex+TJ | paid_click_intent v1 운영 GTM 게시 승인안을 만들었다 | Preview/receiver/landing-session 분석은 통과했지만, 운영 GTM publish는 고객 사이트 추적에 영향을 주므로 별도 판단이 필요하다 | [[../gdn/paid-click-intent-gtm-production-publish-approval-20260506]]에 publish 범위, 금지선, rollback, 24h/72h 모니터링 기준과 TJ님 승인 문구를 기록했다. 실제 publish는 하지 않았다 | [[#Phase4-Sprint6]] / [[../gdn/paid-click-intent-gtm-production-publish-approval-20260506]] | YES |
| 35 | [[#Phase4-Sprint6]] | 우리 기준 완료 | Codex | paid_click_intent post-publish 모니터링 템플릿을 만들었다 | 운영 publish가 승인되면 24h/72h에 무엇을 봐야 하는지 미리 고정해야 한다 | [[../gdn/paid-click-intent-post-publish-monitoring-template-20260506]]에 storage, receiver, fill-rate, missing_google_click_id, rollback 기준을 기록했다 | [[#Phase4-Sprint6]] / [[../gdn/paid-click-intent-post-publish-monitoring-template-20260506]] | NO |
| 36 | [[#Phase2-Sprint4]] | 우리 기준 완료 | Codex | NPay rail source 공백을 분리했다 | publish 이전 NPay 주문을 unmatched나 Naver Ads 매출로 오해하면 안 된다 | [[../naver/npay-rail-source-gap-20260506]]에 2026년 4월 NPay 139건 중 publish 이전 126건 / 20,983,200원을 `source_unavailable_before_publish`로 기록하고, 표현은 `unknown_quarantine + payment_method=npay` 또는 `npay_payment_unattributed`로 고정했다 | [[#Phase2-Sprint4]] / [[../naver/npay-rail-source-gap-20260506]] | NO |

## 문서 목적

이 문서는 월별 매출을 유입 채널별로 나누는 기준, 필요한 source, 구현 순서, 승인 경계를 TJ님과 개발자가 같은 언어로 이해하도록 정리한다.

## 현재 상태

| 구분 | 내용 |
|---|---|
| 사실 | Meta, TikTok, Google, NPay 관련 정본 문서에는 각각 플랫폼 ROAS와 내부 confirmed ROAS 차이가 기록돼 있다. Google Ads는 `구매완료` primary NPay label 오염, 유입 품질 비교, 캠페인별 NPay value 영향, GA4/GTM v138 변경 시점까지 추가로 확인됐다. 추가로 운영 source confirmed purchase no-send dry-run 623건 중 Google click id 보존 주문이 5건뿐임을 확인했다. 반면 GA4 BigQuery 기준 최근 7일 Google Ads 랜딩 세션의 click id 보존률은 97.75%라, 병목은 광고 URL보다 랜딩 이후 주문 원장 연결에 있다. `/ads`는 운영 VM attribution ledger를 read-only로 보는 방향으로 정리됐다. |
| 현재 판단 | 월별 채널 분류의 1순위는 화면이 아니라 `주문·결제 정본 장부`와 `랜딩 시점 유입 증거`를 붙이는 것이다. |
| 유력 가설 | 결제 완료 시점에만 UTM/click id를 읽으면 PG/NPay 리다이렉션 때문에 paid 유입이 direct 또는 unknown으로 빠질 가능성이 높다. |
| 아직 안 된 것 | 2026년 4월 v0.1 dry-run은 나왔지만, unknown 매출과 NPay intent 매칭 결과를 월별 rail에 완전히 반영하지 못해 예산 판단용 최종 배정은 아니다. NPay intent는 2026-04-27 18:10 KST 이후부터 있으므로, 4월 전체 NPay 139건 중 publish 이전 주문은 intent로 직접 매칭할 수 없다. |
| 지금 막힌 것 | NPay source 접근, A급 GA4 중복 guard, 8건 payload 승인안, 운영 source confirmed purchase no-send dry-run, Google click id 보존률 진단, landing-session 분모 분석, confirmed purchase no-send contract, Preview/receiver 검증, 운영 publish 승인안 작성은 완료됐다. 남은 병목은 TJ님의 `paid_click_intent v1` 운영 GTM publish 승인/보류 판단, 운영 publish 후 실제 Attribution VM/order ledger fill-rate 모니터링, campaign mapping 미확정, Google Ads confirmed purchase 실제 실행 승인이다. |

## 쉬운 용어 정리

| 용어 | 이 문서에서 뜻하는 말 |
|---|---|
| 정본 매출 | 예산 판단에 쓰는 기준 매출. 여기서는 아임웹 주문과 토스 결제/환불로 만든 확정 순매출 |
| 원장 | 주문, 결제, 유입 증거를 행 단위로 남긴 기록 장부 |
| dry-run | 운영 데이터는 읽지만 DB 상태나 광고 플랫폼에는 아무것도 반영하지 않는 사전 계산 |
| marketing_intent | 고객이 처음 들어온 URL, 광고 클릭값, UTM, referrer를 결제 전에 저장한 유입 의도 기록 |
| primary channel | 주문 매출을 최종으로 붙일 유입 채널 1개 |
| assist channel | 최종 채널은 아니지만 구매 전에 영향을 준 보조 접점 |
| source 최신성 | source가 최신 주문까지 반영하고 있는지 보는 기준 |

## 왜 이 문서가 필요한가

현재 Meta, TikTok, Google, NPay는 각각 다른 기준으로 구매를 주장한다. Meta는 자체 attribution window와 cross-device matching을 쓴다. Google은 전환 액션 설정이 오염되면 NPay 클릭성 신호도 purchase처럼 볼 수 있다. TikTok은 `ttclid`와 TikTok UTM이 있어도 실제 confirmed 주문과 붙지 않으면 플랫폼 ROAS와 내부 ROAS가 달라진다. GA4는 결제 완료 시점 URL만 보면 PG 리다이렉션 때문에 `not set`, direct, referral로 틀릴 수 있다.

따라서 월별로 유입 채널을 정확히 나누려면 `광고 플랫폼의 주장`을 그대로 믿는 방식이 아니라, 주문 단위로 아래 질문에 답해야 한다.

| 질문 | 정답 source | 이유 |
|---|---|---|
| 이 주문이 실제 매출인가 | 아임웹 주문, 토스 결제, 운영 DB | 돈이 실제로 들어왔는지 판단 |
| 이 주문은 취소/환불됐는가 | 토스 cancel/refund, 아임웹 주문 상태 | 순매출 보정 |
| 이 주문의 최초 유입은 무엇인가 | VM attribution ledger, GTM marketing_intent, GA4 raw | 결제 전 URL/쿠키/세션 보존 |
| 이 주문이 특정 광고 클릭에서 왔는가 | `fbclid`, `_fbc`, `ttclid`, `gclid`, `gbraid`, `wbraid`, UTM | paid 채널의 강한 증거 |
| 광고 플랫폼도 같은 주문을 주장하는가 | Meta/TikTok/Google Ads API, Events Manager | 참고값과 차이 분해 |
| 분류를 믿을 수 있는가 | evidence tier, confidence, freshness | 운영자가 예산 판단에 쓸 수 있는지 판단 |

## 월별 최종 산출물

매월 아래 두 가지를 만든다.

| 산출물 | 설명 | 사용 목적 |
|---|---|---|
| 월별 주문 채널 원장 | 주문 1건당 primary channel 1개, assist channel 여러 개, evidence tier, confidence를 저장한 dry-run 결과 | 정합성 검증, unknown 분해, 감사 추적 |
| 월별 채널 요약표 | 채널별 주문 수, 순매출, 환불, 광고비, 내부 confirmed ROAS, 플랫폼 참고 ROAS | 예산 증액/감액 판단 |

월별 채널 요약의 핵심 식은 아래처럼 고정한다.

```text
월 전체 확정 순매출 = 모든 primary_channel 순매출 합계
내부 confirmed ROAS = 해당 채널 confirmed 순매출 / 해당 채널 광고비
플랫폼 참고 ROAS = 광고 플랫폼 conversion value / 광고 플랫폼 spend
```

`내부 confirmed ROAS`와 `플랫폼 참고 ROAS`는 일부러 분리한다. 둘의 차이를 좁히는 것이 목표지만, 둘을 같은 숫자로 억지로 맞추면 안 된다.

2026년 4월 biocom 기준은 `confirmed net revenue=YES`로 고정한다. 단, A/B confidence rail만 정본에 포함하고 C/D 또는 quarantine rail은 최종 close 전 확인 대상으로 분리한다.

## 채널 분류 체계

처음부터 너무 많은 채널을 만들면 운영자가 못 쓴다. 1차 버전은 아래 정도로 고정한다.

| channel | 사람 말 설명 | 대표 증거 |
|---|---|---|
| `paid_meta` | Meta 광고 유입 매출 | `fbclid`, `_fbc`, Meta UTM, Meta campaign/ad id |
| `paid_tiktok` | TikTok 광고 유입 매출 | `ttclid`, TikTok UTM, TikTok pixel/capi 근거 |
| `paid_google` | Google 검색/쇼핑/디스플레이 광고 유입 매출 | `gclid`, `gbraid`, `wbraid`, Google UTM |
| `paid_naver` | Naver 검색/쇼핑/브랜드 광고 유입 매출 | Naver 광고 click key, Naver paid UTM |
| `owned_kakao` | 카카오톡 채널, 알림톡, CRM성 유입 | Kakao/CRM UTM, 메시지 링크 |
| `owned_crm` | 문자, 이메일, 자사 CRM 유입 | CRM UTM, 쿠폰/캠페인 링크 |
| `organic_search` | 검색엔진 자연 유입 | Google/Naver/Bing referrer, paid click id 없음 |
| `organic_social` | SNS 자연 유입 | Instagram/Facebook/TikTok/YouTube referrer, paid 증거 없음 |
| `referral` | 외부 사이트 추천 유입 | 외부 referrer, paid/organic search/social 아님 |
| `direct` | 직접 방문 또는 출처 상실 | referrer/click id/UTM 없음 |
| `influencer_non_paid` | 외부 인플루언서/공구/IGG 비광고성 유입 | influencer UTM, 전용 랜딩, paid campaign id 없음 |
| `unknown_quarantine` | 아직 유입 채널 확정 금지 | 증거 충돌, source stale, 주문 조인 실패 |

중요한 원칙은 `상품이 IGG라서 Meta`처럼 분류하지 않는 것이다. 상품군은 힌트일 뿐이다. 유입 채널은 click id, UTM, campaign id, referrer, first-touch intent 같은 증거로만 붙인다.

## source별 역할 분석

### GTM

GTM은 리포트 source가 아니라 `증거 수집 장치`다.

GTM이 해야 할 일은 랜딩 시점의 `marketing_intent`를 최대한 빨리 저장하는 것이다. 결제 완료 페이지에서만 UTM을 읽으면 늦다. PG, NPay, Toss, 아임웹 리다이렉션을 거친 뒤에는 URL 파라미터와 referrer가 이미 사라졌을 수 있다.

GTM에서 수집해야 할 최소값은 아래다.

| 필드 | 이유 |
|---|---|
| `landing_url` | 최초 유입 URL 보존 |
| `referrer` | organic/referral/direct 분류 |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | 캠페인/채널 분류 |
| `fbclid`, `_fbc`, `_fbp` | Meta channel/campaign 증거와 CAPI match 품질 |
| `ttclid`, `_ttp` | TikTok channel 증거 |
| `gclid`, `gbraid`, `wbraid` | Google Ads channel 증거 |
| `ga_client_id`, `ga_session_id` | GA4 raw와 주문 조인 |
| `page_path`, `product_id`, `cart_value` | 구매 전 퍼널과 주문 후보 매칭 |
| `first_seen_at`, `last_seen_at` | attribution window 판단 |

GTM 운영 게시는 승인 필요 작업이다. 지금 할 일은 수집 설계와 Preview 검증안 작성까지다.

### GA4

GA4는 사용자 행동과 세션을 보는 보조 장부다. 월별 매출 정본으로 쓰면 안 된다.

GA4를 쓰는 목적은 세 가지다.

| 목적 | 사용 방식 | 한계 |
|---|---|---|
| transaction join | `transaction_id`, `order_id`, `ga_client_id`, `ga_session_id`로 주문과 세션 연결 | BigQuery raw 권한이 없으면 정확도 제한 |
| `not set` 원인 분해 | purchase 직전 세션, landing, collected traffic source 확인 | Data API 집계만으로는 주문 단위 원인 분해가 약함 |
| 중간 퍼널 검증 | ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo 흐름 확인 | 실제 매출 확정 source는 아님 |

biocom GA4 BigQuery raw 접근이 막혀 있으면 `not set`, NPay return, 중복 purchase 원인 분해가 약해진다. 따라서 월별 정합성 프로젝트에서 GA4 raw 권한은 중요한 보강 과제다.

### VM attribution ledger

VM attribution ledger는 월별 채널 분류의 핵심 source다.

이 장부는 결제 완료 시점뿐 아니라 그 전의 click id, UTM, session, funnel event를 보존할 수 있기 때문이다. `/ads`에서 이미 운영 VM attribution ledger를 read-only로 쓰는 구조가 있으므로, 월별 채널 원장도 같은 방향으로 설계한다.

VM ledger에서 봐야 할 것은 아래다.

| 항목 | 판단 |
|---|---|
| 주문/결제 키와 event 연결 | order_no, order_code, payment_key, transaction_id 조인 |
| `marketing_intent` 존재 여부 | 랜딩 시점 유입 보존 여부 |
| click id 채움률 | paid channel 분류 가능성 |
| source 최신성 | 최신 주문이 반영됐는지 |
| duplicate event | 같은 transaction_id purchase 중복 여부 |
| site routing | biocom/thecleancoffee/quarantine 분리 |

월별 산출 시 `ledger_source`, `source_max_timestamp`, `row_count`, `fallback_reason`, `confidence`를 반드시 남긴다.

### 토스

토스는 유입 채널 source가 아니라 결제 확정과 환불 보정 source다.

토스로 확인할 것은 아래다.

| 항목 | 이유 |
|---|---|
| `paymentKey` | 주문/결제 조인의 강한 키 |
| `approvedAt` | KST 월 귀속 기준 |
| 결제 금액 | 아임웹 금액과 교차 검증 |
| 취소/환불 금액 | 순매출 계산 |
| 결제수단 | 카드, 가상계좌, NPay 등 분리 |
| payment status | 입금 대기와 결제 완료 분리 |

월별 매출은 gross가 아니라 net으로 본다. `결제완료 - 취소/환불` 기준이어야 예산 판단에 쓸 수 있다.

### 아임웹 API / 운영 DB

아임웹은 주문 존재와 상품/고객/상태를 보는 source다.

아임웹 API와 운영 DB는 아래 목적으로 쓴다.

| 항목 | 이유 |
|---|---|
| `order_no`, `order_code` | GA4/VM/CAPI/토스 조인 키 |
| 주문 상태 | confirmed/pending/canceled 분리 |
| 상품/옵션/수량 | 상품군별 매출 보조 분석 |
| 주문 생성/결제 완료 시각 | 월 귀속과 funnel delay |
| 구매자 식별값 | Advanced Matching, cross-device 보조 |
| site/브랜드 | biocom/thecleancoffee 라우팅 |

단, 아임웹에 과거 주문이 비어 있거나 캐시가 stale일 수 있다. 그래서 운영 DB, 로컬 DB, VM ledger, API를 항상 교차 검증해야 한다.

### 자체 CAPI 퍼널

자체 CAPI 퍼널은 광고 플랫폼으로 보내는 이벤트이면서 동시에 내부 증거 장부가 될 수 있다.

하지만 `서버가 Meta/TikTok/Google로 이벤트를 보냈다`는 사실과 `그 매출이 해당 채널 매출이다`는 사실은 다르다. CAPI 전송 로그는 match quality, dedup, funnel coverage를 보는 데 쓰고, 월별 채널 분류는 주문 원장과 유입 증거를 조인해서 판단한다.

퍼널 이벤트는 아래처럼 구분한다.

| 이벤트 | 월별 채널 분류에서의 역할 |
|---|---|
| ViewContent | 유입/관심 증거. 매출 확정 아님 |
| AddToCart | 구매 의도 증거. 매출 확정 아님 |
| InitiateCheckout | PG 이동 전 마지막 강한 앵커 |
| AddPaymentInfo | 결제 직전 앵커. channel 보존에 중요 |
| Purchase | 주문 원장과 event_id가 맞을 때만 confirmed purchase 보조 증거 |
| Refund | 순매출 보정 보조. 실제 환불 source와 대조 필요 |

중간 퍼널 CAPI 운영 송출은 별도 승인 전까지 금지다. 먼저 Test Events code로 browser/server `event_id` dedup과 payload 품질을 확인해야 한다.

### 광고 플랫폼 API

Meta, TikTok, Google, Naver 플랫폼 API는 매출 정본이 아니라 `광고비`와 `플랫폼 주장값` source다.

월별 보고서에서는 아래처럼 나눈다.

| 값 | 설명 | 예산 판단에서의 위치 |
|---|---|---|
| platform spend | 광고비 | ROAS 분모로 사용 |
| platform conversion value | 플랫폼이 주장하는 매출 | 참고값 |
| internal confirmed revenue | 내부 원장 기준 해당 채널 확정 매출 | 메인 분자 |
| platform gap | platform value - internal confirmed revenue | 원인 분해 대상 |

Meta는 attribution window와 cross-device matching 때문에 내부 last-click 기준보다 높을 수 있다. Google은 전환 액션이 오염되면 실제 purchase가 아닌 NPay click/count가 섞일 수 있다. TikTok은 `ttclid`가 있어도 confirmed order와 조인되지 않으면 내부 ROAS에 넣으면 안 된다.

## 주문별 채널 배정 규칙

월별 분류는 주문 1건당 `primary_channel` 1개만 붙인다. 여러 광고 접점은 `assist_channels`로 남긴다.

우선순위는 아래처럼 둔다.

| 순서 | 규칙 | primary channel 판단 |
|---:|---|---|
| 1 | 주문/결제 확정 여부 확인 | confirmed가 아니면 매출에서 제외하거나 pending으로 분리 |
| 2 | 취소/환불 보정 | net revenue 계산 |
| 3 | 주문 직결 click id 확인 | `gclid`, `gbraid`, `wbraid`, `ttclid`, `fbclid/_fbc` |
| 4 | 주문 직결 UTM 확인 | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` |
| 5 | checkout/payment 직전 marketing_intent 확인 | PG 이동 전 저장된 source 사용 |
| 6 | landing first-touch 확인 | 같은 client/session의 최초 paid/organic intent |
| 7 | GA4 raw transaction join | 세션 source/medium 보조 |
| 8 | referrer 기반 organic/referral/direct 분류 | paid 증거 없을 때만 사용 |
| 9 | product/landing/influencer 힌트 | paid 강제 분류 금지, assist 또는 quarantine |
| 10 | 증거 부족/충돌 | `unknown_quarantine` |

### paid channel 세부 판정

| 증거 | channel | confidence 기준 |
|---|---|---|
| `gclid`, `gbraid`, `wbraid`가 주문/checkout에 직접 붙음 | `paid_google` | A |
| `ttclid`가 주문/checkout에 직접 붙음 | `paid_tiktok` | A |
| `fbclid` 또는 `_fbc`가 주문/checkout에 직접 붙고 Meta/Instagram 유입 정황이 있음 | `paid_meta` | A 또는 B |
| UTM source가 `google`, medium이 `cpc/paid` | `paid_google` | B |
| UTM source가 `facebook/instagram/meta`, medium이 `cpc/paid/social_paid` | `paid_meta` | B |
| UTM source가 `tiktok`, medium이 `cpc/paid` | `paid_tiktok` | B |
| UTM source가 `naver`, medium이 `cpc/paid` | `paid_naver` | B |
| 광고 플랫폼 API에만 전환이 있고 내부 주문 증거가 없음 | primary 분류 금지 | platform_reference |

`fbclid`만 있는 주문은 channel 수준에서는 Meta 후보로 볼 수 있다. 다만 campaign id가 없으면 특정 Meta 캠페인 ROAS에는 넣지 않는다. 이 경우 `primary_channel=paid_meta`, `campaign_id=unknown`, `confidence=B` 또는 `C`로 두고 campaign mapping 문서에서 따로 닫는다.

### organic/direct/referral 세부 판정

| 증거 | channel | 주의점 |
|---|---|---|
| Google/Naver/Bing 검색 referrer, paid click id 없음 | `organic_search` | 브랜드 검색과 광고 클릭을 분리 |
| Instagram/Facebook/TikTok/YouTube referrer, paid click id 없음 | `organic_social` | paid social과 혼동 금지 |
| 외부 블로그/커뮤니티/referral | `referral` | 제휴/인플루언서면 별도 태그 필요 |
| UTM/referrer/click id 없음 | `direct` 또는 `unknown_quarantine` | 결제 리다이렉션 유실이면 direct로 단정 금지 |
| 내부 이동 UTM | 이전 source를 덮어쓸 위험 | 내부 UTM은 primary source로 쓰지 않음 |

## 증거 등급과 신뢰도

모든 주문에는 분류 이유와 신뢰도를 남긴다. 그래야 나중에 사람이 왜 이 매출이 Meta인지, 왜 direct인지 바로 이해할 수 있다.

| tier | 의미 | 예시 | 운영 판단 |
|---|---|---|---|
| A | 주문/결제와 직접 연결된 강한 증거 | `payment_key` 조인 + `gclid`, `ttclid`, `_fbc` | 예산 판단에 사용 가능 |
| B | 같은 client/session의 checkout/first-touch 증거 | GTM marketing_intent + 주문 조인 | 사용 가능하되 표본 감사 필요 |
| C | GA4 raw/session 또는 UTM만 있는 보조 증거 | transaction_id join + source/medium | 보수적으로 사용 |
| D | referrer/product/landing 기반 추정 | IGG 랜딩, influencer alias | primary paid 분류 금지 |
| E | 증거 없음/충돌/source stale | local cache stale, site null, order join 실패 | quarantine |

월별 보고서에는 채널별 매출뿐 아니라 tier별 매출도 같이 보여야 한다.

```text
paid_meta 매출 100만원
- A급 70만원
- B급 20만원
- C급 10만원
- D/E급 0원
```

이렇게 봐야 같은 Meta 매출이라도 `확정적으로 믿을 수 있는 매출`과 `추가 검토가 필요한 매출`을 구분할 수 있다.

## 월별 데이터 모델 초안

### order_channel_ledger

주문 1건당 1행을 만든다.

| 필드 | 설명 |
|---|---|
| `month_kst` | 매출 귀속 월 |
| `site` | biocom, thecleancoffee 등 |
| `order_no` | 아임웹 주문번호 |
| `order_code` | 아임웹 주문 코드 |
| `payment_key` | 토스 payment key |
| `transaction_id` | GA4/Pixel/CAPI transaction id |
| `approved_at_kst` | 결제 승인 시각 |
| `confirmed_at_kst` | 내부 confirmed 시각 |
| `gross_revenue` | 주문 총액 |
| `refund_amount` | 환불/취소 금액 |
| `net_revenue` | 순매출 |
| `payment_method` | card, vbank, npay 등 |
| `primary_channel` | 최종 1개 유입 채널 |
| `assist_channels_json` | 보조 접점 |
| `evidence_tier` | A/B/C/D/E |
| `confidence` | 0~100 |
| `assignment_reason` | 사람이 읽을 수 있는 판정 이유 |
| `utm_source` | UTM source |
| `utm_medium` | UTM medium |
| `utm_campaign` | UTM campaign |
| `utm_term` | UTM term |
| `utm_content` | UTM content |
| `fbclid` | Meta click id |
| `_fbc` | Meta click cookie |
| `_fbp` | Meta browser cookie |
| `ttclid` | TikTok click id |
| `_ttp` | TikTok cookie |
| `gclid` | Google click id |
| `gbraid` | Google iOS click id |
| `wbraid` | Google web-to-app click id |
| `ga_client_id` | GA4 client id |
| `ga_session_id` | GA4 session id |
| `landing_url` | 최초 랜딩 URL |
| `referrer` | 최초 referrer |
| `source_freshness` | source 최신성 |
| `source_confidence` | source 신뢰도 |
| `unknown_reason` | quarantine 사유 |
| `assignment_version` | 분류 규칙 버전 |
| `assigned_at_kst` | 산출 시각 |

### monthly_channel_summary

월/사이트/채널 단위 요약을 만든다.

| 필드 | 설명 |
|---|---|
| `month_kst` | 대상 월 |
| `site` | 사이트 |
| `channel` | 유입 채널 |
| `orders` | 주문 수 |
| `gross_revenue` | 총매출 |
| `refund_amount` | 환불/취소 금액 |
| `net_revenue` | 순매출 |
| `spend` | 광고비 |
| `internal_confirmed_roas` | 내부 confirmed ROAS |
| `platform_conversion_value` | 플랫폼 주장 전환값 |
| `platform_roas` | 플랫폼 주장 ROAS |
| `gap_value` | 플랫폼값 - 내부값 |
| `tier_a_revenue` | A급 매출 |
| `tier_b_revenue` | B급 매출 |
| `tier_c_revenue` | C급 매출 |
| `unknown_revenue` | unknown/quarantine 매출 |
| `source_max_timestamp` | source 최신 시각 |
| `queried_at_kst` | 산출 시각 |

## 월별 산출 프로세스

### Step 1. 주문·결제 기본 장부 만들기

아임웹 주문과 토스 결제를 조인해 월별 주문 기본 장부를 만든다.

```text
입력: 아임웹 주문/API/운영 DB + 토스 payment/cancel/refund
출력: order_no, payment_key, status, gross_revenue, refund_amount, net_revenue
```

성공 기준은 월별 전체 confirmed 순매출이 기존 운영 기준과 맞는 것이다.

### Step 2. attribution evidence 붙이기

VM attribution ledger, GTM marketing_intent, CAPI funnel log, GA4 raw를 주문 기본 장부에 붙인다.

```text
order/payment key 직접 조인
transaction_id 조인
ga_client_id/ga_session_id 조인
시간창 기반 checkout/landing intent 조인
```

성공 기준은 각 주문에 `직접 증거`, `보조 증거`, `증거 없음`이 분리되는 것이다.

### Step 3. primary channel 결정

위의 배정 규칙으로 주문마다 primary channel 1개를 붙인다.

성공 기준은 아래다.

```text
sum(order_channel_ledger.net_revenue) = monthly confirmed net revenue
unknown_quarantine 주문은 이유가 있어야 함
paid channel은 click id/UTM/intent 증거 없이 강제 분류하지 않음
```

### Step 4. 플랫폼 spend와 참고 ROAS 붙이기

Meta, TikTok, Google, Naver API에서 월별 spend와 platform conversion value를 붙인다.

주의점은 플랫폼 conversion value를 내부 confirmed revenue로 덮어쓰면 안 된다는 점이다.

### Step 5. gap 분해

채널별로 아래 사유를 나눈다.

| gap 사유 | 설명 |
|---|---|
| attribution window 차이 | Meta/TikTok/Google이 내부 기준보다 긴 window를 사용 |
| cross-device attribution | 플랫폼은 같은 사람으로 보지만 내부는 다른 세션으로 봄 |
| UTM/click id 유실 | PG/NPay 리다이렉션 후 source가 사라짐 |
| campaign mapping 미확정 | channel은 알지만 campaign id가 없음 |
| NPay return 누락 | 외부 결제 후 자사몰 purchase가 빠짐 |
| 중복 purchase | GTM/Pixel/CAPI/Hurdlers/홈피구매 중복 |
| 전환 액션 오염 | Google NPay click/count 같은 비구매 신호 |
| source stale | 로컬 DB나 캐시가 최신 주문을 못 따라감 |

### Step 6. 월별 close 리포트 생성

월말 또는 매월 초에 아래를 고정한다.

| 항목 | 포함 내용 |
|---|---|
| 기간 | KST 기준 inclusive month |
| source 최신성 | Imweb/Toss/VM/GA4/platform 각각 최신 시각 |
| 총 confirmed net revenue | 내부 정본 매출 |
| 채널별 confirmed revenue | primary channel 기준 |
| 채널별 spend/ROAS | internal confirmed ROAS와 platform reference ROAS 분리 |
| unknown/quarantine | 금액, 주문 수, 주요 원인 |
| 변경 로그 | `assignment_version`, rule 변경 |
| 승인 필요 | GTM publish, CAPI send, platform conversion action 변경 등 |

## source 최신성 기준

월별 산출은 숫자만 맞으면 안 되고 최신성도 맞아야 한다.

| source | 최신성 체크 |
|---|---|
| 아임웹 API/운영 DB | 월 마지막 주문의 `paid_at/updated_at`이 반영됐는지 |
| 토스 | 월 마지막 `approvedAt/canceledAt`이 반영됐는지 |
| VM attribution ledger | `source_max_timestamp`, row_count, fallback 여부 |
| GA4 BigQuery | table suffix 최신 날짜, intraday 포함 여부, 권한 상태 |
| GTM | live version, Preview 검증 여부 |
| Meta/TikTok/Google API | `queried_at`, timezone, attribution window, spend currency |
| 로컬 SQLite/cache | stale 여부. 운영 판단 source로 쓰는지 표시 |

source 최신성이 낮으면 해당 월은 `예산 판단 보류`로 표시한다.

## 현재 가장 큰 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 결제 완료 시점에만 source를 읽음 | paid 유입이 direct/unknown으로 빠짐 | 랜딩 시점 marketing_intent 저장 |
| GA4 raw 접근 제한 | `not set`, 중복 purchase, session source 분해가 약함 | BigQuery read 권한 확보 |
| NPay return 누락 | 실제 NPay 매출이 GA4/광고 플랫폼에서 빠지거나 click으로 오염 | NPay intent와 confirmed 주문 dry-run |
| Google 전환 액션 오염 | Google ROAS가 실제 매출보다 크게 부풀 수 있음 | confirmed purchase 전환과 NPay click/count 분리 |
| campaign mapping 미확정 | channel은 알아도 캠페인별 ROAS 판단 불가 | UTM 표준화와 기존 수동 mapping |
| source stale | 최근 7일/월말 매출이 0처럼 보임 | VM 운영 ledger 기본, local fallback 표시 |
| 중복 purchase | 플랫폼 매출 과대 | event_id dedup, transaction_id guard |
| 내부 UTM 사용 | 외부 source가 내부 링크로 덮임 | 내부 링크 UTM 금지, 별도 internal campaign 필드 |

## Sprint 상세

### Phase1-Sprint1
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: source 목록과 권한 확인

**목표**: 월별 채널 분류에 쓸 source를 `매출 정본`, `유입 증거`, `플랫폼 참고값`으로 나눈다.

**왜 지금 해야 하는가**: 어떤 장부를 믿을지 정하지 않으면 Meta, TikTok, Google, GA4 숫자가 서로 다를 때 다시 논쟁이 생긴다.

**산출물**: source 목록표, join key matrix, source 최신성 점검표.

**완료 기준**: Imweb, Toss, VM attribution ledger, GA4, GTM, Meta, TikTok, Google, NPay source마다 역할, 권한, 최신성, 한계가 적힌다.

**다음 Phase에 주는 가치**: 주문·결제 정본 장부를 만들 때 어느 source를 먼저 봐야 하는지 고정된다.

#### 역할 구분

- TJ: 계정 로그인, 신규 권한 부여, 외부 관리자 화면 확인처럼 사람만 가능한 일을 판단한다.
- Codex: 현재 권한으로 read-only source 조회, 코드/API 위치 확인, source 목록 문서 작성.
- Claude Code: 해당 없음.

#### 완료한 것

- [x] Meta, TikTok, GDN, NPay 정본 문서에서 핵심 source와 위험을 1차 수집했다. 검증: 이 문서 상단 `required_context_docs`에 기록.
- [x] 이번 작업이 Green Lane 설계임을 문서에 명시했다. 검증: `harness_preflight.lane=Green`.
- [x] source 목록 문서를 만들었다. 검증: [[source-inventory-20260504]].
- [x] source 최신성을 read-only로 확인했다. 검증: `backend/scripts/check-source-freshness.ts --json`, 운영 Toss/Postgres fresh, 로컬 SQLite stale, biocom GA4 BigQuery permission denied.
- [x] Attribution VM API 최신성을 확인했다. 검증: `https://att.ainativeos.net/api/attribution/ledger?source=biocom_imweb&limit=3`, latestLoggedAt `2026-05-04T08:16:48.101Z`.
- [x] 운영 아임웹 주문 원장을 source freshness에 추가했다. 검증: `backend/src/sourceFreshness.ts`의 `imweb_operational`, `data/source-freshness-20260505-after-clickid-plan.json`에서 `tb_iamweb_users` totalRows `98,466`, freshnessAt `2026-05-04T07:42:13.000Z`, status `warn`.

#### 남은 것

- [x] `tb_iamweb_users`를 `sourceFreshness` script 정식 source로 추가했다. 무엇: 운영 아임웹 주문 원장도 `/api/source-freshness`에 포함했다. 왜: 월별 close 때 수동 SQL 없이 최신성을 보기 위해서다. 검증: `imweb_operational` source가 표시된다.
- [ ] biocom GA4 BigQuery raw 권한/운영 방식은 당분간 추가 승인 없이 유지한다. 무엇: 현재는 source dataset을 읽고 job project를 분리해 freshness와 guard query가 가능하다. 왜: 이미 `ga4_bigquery_biocom`이 fresh로 조회되어 별도 권한 요청은 1순위가 아니다. 어떻게: 신규 권한 필요가 생기면 다시 승인 대기열에 올린다. 산출물: 보류 사유. 검증: `ga4_bigquery_biocom` freshness가 계속 fresh/warn 범위여야 한다.

#### 실행 단계

1. [Codex] source 목록 문서를 만든다 — 완료. 산출물: [[source-inventory-20260504]]. 검증: source마다 역할, join key, 최신성, confidence가 기록됐다. 의존성: 완료.
2. [Codex] 현재 권한으로 GA4 raw 접근 가능성을 확인한다 — 완료. 산출물: `hurdlers-naver-pay.analytics_304759974` permission denied. 검증: source freshness script 결과에 에러가 남았다. 의존성: 완료.
3. [TJ] GA4 raw 권한이 없으면 서비스 계정 read 권한 부여 여부를 결정한다 — 이유: GCP 권한 변경은 계정 소유자 로그인과 보안 판단이 필요하다. 의존성: 2번이 permission denied일 때만 선행필수.

### Phase1-Sprint2
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 주문·결제 정본 장부

**목표**: 특정 월의 전체 주문, 결제, 취소, 환불을 한 줄 장부로 만든다.

**왜 지금 해야 하는가**: 유입 채널을 나누기 전에 전체 매출 총액이 맞아야 한다. 총액이 틀리면 채널별 ROAS도 전부 틀린다.

**산출물**: 월별 주문·결제 정본 장부 초안, 월별 총 순매출 대조표.

**완료 기준**: KST 기준 특정 월의 주문 수, 총매출, 환불, 순매출이 Imweb/Toss/운영 DB 사이에서 설명 가능해야 한다.

**다음 Phase에 주는 가치**: 유입 증거를 붙일 기준 주문 목록이 생긴다.

#### 역할 구분

- TJ: 월별 매출 정본을 `confirmed net revenue`로 쓸지 승인한다.
- Codex: Imweb, Toss, 운영 DB, 로컬 DB를 read-only로 대조하고 join key를 정리한다.
- Claude Code: 해당 없음.

#### 완료한 것

- [x] 문서에서 매출 정본을 `아임웹 주문 + 토스 결제 + 취소/환불 보정`으로 정의했다. 검증: `10초 결론`과 `월별 최종 산출물`에 기록.
- [x] 주문·결제 join key matrix를 작성했다. 검증: [[join-key-matrix-20260504]].
- [x] 첫 dry-run 대상 기간을 2026년 4월 KST 전체로 추천했다. 검증: [[join-key-matrix-20260504]]의 `첫 dry-run 대상 기간 추천`.
- [x] 2026년 4월 biocom 주문·결제 spine dry-run 계약을 작성했다. 검증: [[monthly-spine-dry-run-contract-20260504]].
- [x] read-only dry-run script 초안을 작성했다. 검증: `cd backend && npm exec -- tsx scripts/monthly-spine-dry-run.ts --site=biocom --month=2026-04`.
- [x] script 출력이 계약 문서의 sanity check와 일치함을 확인했다. 검증: A/B confirmed net `499,829,436원`, C review `70,000원`, D/quarantine `26,481원`, Toss-only month boundary `69,900원`.

#### 남은 것

- [ ] dry-run script를 local API route로 승격할지 결정한다. 무엇: `/api/total/monthly-spine` 또는 `/api/total/monthly-evidence` 형태로 노출할지 판단한다. 왜: 나중에 Claude Code가 `/total` 화면을 만들려면 API 계약이 필요하다. 어떻게: 지금은 script로 충분한지, route가 필요한지 Phase5-Sprint7에서 결정한다. 산출물: route 구현 또는 보류 사유. 검증: 프론트엔드가 호출할 계약이 명확해야 한다.

#### 실행 단계

1. [Codex] 주문·결제 join key matrix를 만든다 — 완료. 산출물: [[join-key-matrix-20260504]]. 검증: 결제키, 주문번호, NPay 채널 주문번호, site null 처리, 외부 전송 금지 규칙이 기록됐다. 의존성: 완료.
2. [Codex] 첫 월별 dry-run 대상 기간을 고른다 — 완료. 추천: 2026년 4월 KST 전체. 산출물: [[join-key-matrix-20260504]]의 `첫 dry-run 대상 기간 추천`. 검증: source freshness와 월별 close 목적이 함께 기록됐다. 의존성: 완료.
3. [Codex] 2026년 4월 biocom 주문·결제 spine dry-run SQL/API 계약을 만든다 — 완료. 산출물: [[monthly-spine-dry-run-contract-20260504]]. 검증: 주문 수, gross, refund, net 후보, join_method 분포, API 응답 필드가 기록됐다. 의존성: 완료.
4. [Codex] dry-run script 또는 read-only route 초안을 만든다 — 완료. 산출물: `backend/scripts/monthly-spine-dry-run.ts`. 검증: 2026년 4월 biocom summary가 [[monthly-spine-dry-run-contract-20260504]]의 sanity check와 일치했다. 의존성: 완료.
5. [Codex] Attribution VM evidence join 계약을 만든다 — 완료. 산출물: [[attribution-vm-evidence-join-contract-20260504]]. 검증: `primary_channel`, `channel_evidence`, `evidence_confidence`, `unknown_reason`이 정의됐다. 의존성: 완료.
6. [Codex] evidence join dry-run script를 만든다 — 완료. 산출물: `backend/scripts/monthly-evidence-join-dry-run.ts`. 검증: 2026년 4월 A/B confirmed net `499,829,436원` 전체에 primary channel 후보를 붙였고, primary channel 합계가 총액과 일치했다. 의존성: 완료.
7. [TJ] 월별 정본 매출 기준 추천안에 답한다 — 답변 반영 완료. 현재 기준은 `confirmed net revenue=YES`, A/B rail만 정본 포함이다. C/D/quarantine은 최종 close 전 확인 대상으로 분리한다.

### Phase2-Sprint3
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 유입 증거 붙이기

**목표**: 주문·결제 정본 장부에 광고 클릭값, UTM, referrer, GA4 session, CAPI funnel 증거를 붙인다.

**왜 지금 해야 하는가**: 결제 완료 시점에만 source를 읽으면 Meta, TikTok, Google 유입이 direct 또는 unknown으로 빠질 수 있다.

**산출물**: 주문별 유입 증거 표, 증거 누락 사유표.

**완료 기준**: 각 주문에 `직접 증거`, `보조 증거`, `증거 없음`이 분리된다.

**다음 Phase에 주는 가치**: 주문별 primary channel을 같은 규칙으로 배정할 수 있다.

#### 역할 구분

- TJ: GTM 운영 게시, 외부 계정 권한, 실결제 테스트가 필요할 때 승인한다.
- Codex: VM attribution ledger, GA4 raw, CAPI funnel, GTM 문서/코드를 read-only로 대조한다.
- Claude Code: 나중에 `/total` 화면 문구와 설명 UI를 만든다.

#### 완료한 것

- [x] 문서에 GTM이 리포트 source가 아니라 증거 수집 장치라는 원칙을 적었다. 검증: `source별 역할 분석`의 GTM 섹션.
- [x] 랜딩 시점 `marketing_intent` 저장이 필요하다고 적었다. 검증: `현재 가장 큰 리스크`와 `GTM` 섹션.
- [x] Attribution VM evidence join 계약을 작성했다. 검증: [[attribution-vm-evidence-join-contract-20260504]].
- [x] 2026년 4월 VM evidence source 상태를 read-only로 확인했다. 검증: `payment_success 1,979건`, `checkout_started 3,737건`, `marketing_intent 0건`, latestLoggedAt `2026-04-30T14:58:43.666Z`.
- [x] evidence join dry-run script를 작성하고 실행했다. 검증: `backend/scripts/monthly-evidence-join-dry-run.ts --site=biocom --month=2026-04 --json`.
- [x] 2026년 4월 A/B confirmed net 전체에 v0.1 channel 후보를 붙였다. 검증: `ordersTotalAb 2,216건`, `revenueTotalAb 499,829,436원`, `primarySumMatchesRevenue=true`.
- [x] NPay matching rail을 evidence script에 붙였다. 검증: `npayIntentStatusSummary`와 `source.npayIntentMatching` 출력.
- [x] 운영 NPay intent source 접근 한계를 확인했다. 검증: 로컬 `backend/data/crm.sqlite3#npay_intent_log`는 0건, `https://att.ainativeos.net/api/attribution/npay-intents?site=biocom&limit=1`은 token 없음으로 403이었다.
- [x] 운영 NPay intent source 접근을 해결했다. 검증: SSH `taejun` 계정과 sudo read-only snapshot으로 `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3`를 로컬 `backend/data/vm-npay-intent-20260505.sqlite3`로 가져왔고, `npay_intent_log` 823건과 integrity check PASS를 확인했다.
- [x] A급 NPay 후보의 GA4 BigQuery 중복 guard를 확인했다. 검증: `data/npay-ga4-robust-guard-vm-snapshot-20260505.md`와 guarded dry-run에서 present 2건, robust_absent 8건으로 분리했다.
- [x] Google click id 보존률 진단과 개선 설계를 만들었다. 검증: `data/google-click-id-preservation-diagnostics-20260505.md`에서 운영 결제완료 주문 623건 중 Google click id 5건, 보존률 0.8%를 확인했고 [[../gdn/google-click-id-preservation-plan-20260505]]에 개선 순서를 기록했다.

#### 남은 것

- [x] A급 NPay 후보의 GA4 BigQuery 중복 guard를 확인했다. 무엇: 2026-05-05 snapshot dry-run에서 나온 A급 strong 10건의 `order_number`와 `channel_order_no` 20개 ID가 GA4에 이미 있는지 봤다. 산출물: `present/robust_absent` 분류. 검증: dispatcher 후보 주문의 `already_in_ga4` 확인률 100%.
- [x] 결제 전 Google click id 앵커가 어디서 끊기는지 1차 진단했다. 무엇: 운영 결제완료 주문에 `gclid/gbraid/wbraid`가 얼마나 남았는지 확인했다. 왜: 결제 완료 시점에만 잡으면 늦기 때문이다. 산출물: [[../data/google-click-id-preservation-diagnostics-20260505]]와 [[../gdn/google-click-id-preservation-plan-20260505]]. 검증: 전체 보존률 0.8%, 주문 evidence 기준 Google 후보 10건 중 5건, 결제수단별 분포가 기록됐다.
- [ ] Meta/TikTok/Google 전체 funnel event_id 연결 report를 만든다. 무엇: ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase 사이의 event_id와 transaction_id 연결 상태를 본다. 왜: Google click id 외에도 중간 퍼널 증거가 어디서 끊기는지 월별 채널 배정에 반영하기 위해서다. 어떻게: 자체 CAPI funnel 로그와 GTM 코드 상태를 확인. 산출물: funnel gap report. 검증: 단계별 누락 사유가 기록된다.

#### 실행 단계

1. [Codex] 유입 증거 필드 채움률을 산출한다 — 완료. 산출물: [[attribution-vm-evidence-join-contract-20260504]]. 검증: VM 2026년 4월 `payment_success`, `checkout_started` 필드 채움률이 기록됐다. 의존성: 완료.
2. [Codex] evidence join dry-run script 초안을 만든다 — 완료. 산출물: `backend/scripts/monthly-evidence-join-dry-run.ts`. 검증: channel별 합계가 A/B confirmed net `499,829,436원`과 일치했다. 의존성: 완료.
3. [Codex] NPay intent matched/ambiguous/unmatched 분포를 만든다 — 완료. 산출물: [[../data/npay-roas-dry-run-vm-snapshot-20260505]]. source 접근은 해결됐고 live intent 820건, confirmed NPay 주문 30건, strong match 20건이 나왔다. 검증: `sourceAccess=available` 상태로 전환했고 A급 10건 GA4 BigQuery guard까지 완료했다.
4. [Codex] CAPI funnel 로그와 주문 키 연결을 확인한다 — 무엇: ViewContent부터 Purchase까지 event_id와 transaction_id가 이어지는지 본다. 왜: 중간 퍼널 CAPI가 채널 증거로 쓸 수 있는지 판단하기 위해서다. 어떻게: backend CAPI route, send log, 기존 Meta/TikTok 문서를 읽는다. 산출물: funnel coverage report. 검증: 이벤트별 join 가능/불가와 이유가 남는다. 의존성: 병렬가능.
5. [TJ] GTM Preview 또는 운영 게시가 필요한 변경은 별도 승인한다 — 이유: GTM 운영 게시는 운영 추적에 직접 영향을 준다. 의존성: Codex가 Preview 변경안을 만든 뒤 선행필수.

### Phase2-Sprint4
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 채널 배정 dry-run

**목표**: 주문 1건당 최종 채널 1개와 보조 채널 여러 개를 붙인다.

**왜 지금 해야 하는가**: channel 기준이 고정돼야 월별 Meta 매출인지, Organic 매출인지, TikTok 매출인지 같은 질문에 같은 답을 낼 수 있다.

**산출물**: `order_channel_ledger` dry-run 결과, `monthly_channel_summary` dry-run 결과.

**완료 기준**: 채널별 순매출 합계가 월 전체 확정 순매출과 일치하고, unknown 주문에는 이유가 남는다.

**다음 Phase에 주는 가치**: 플랫폼 ROAS와 내부 confirmed ROAS 차이를 채널별로 설명할 수 있다.

#### 역할 구분

- TJ: 채널 분류표 v1과 애매한 분류 정책을 승인한다.
- Codex: 배정 규칙과 dry-run script/API를 만든다.
- Claude Code: 승인된 정책을 나중에 운영 화면에서 이해하기 쉽게 보여준다.

#### 진입 조건

Phase1-Sprint2의 주문·결제 정본 장부와 Phase2-Sprint3의 유입 증거 표가 필요하다.

#### 완료한 것

- [x] v0.1 channel assignment dry-run을 실행했다. 검증: `backend/scripts/monthly-evidence-join-dry-run.ts --site=biocom --month=2026-04 --json`.
- [x] primary channel 합계가 월 전체 A/B confirmed net과 일치했다. 검증: `primarySumMatchesRevenue=true`, 합계 `499,829,436원`.
- [x] v0.1 기준 unknown 사유를 3개로 분해했다. 검증: `missing_channel_evidence 198,552,700원`, `vm_payment_success_missing 32,758,162원`, `subscription_without_acquisition_evidence 14,726,910원`.
- [x] v0.2 channel assignment rule을 구현하고 실행했다. 검증: `contractVersion=monthly-evidence-join-dry-run-v0.2`, `primarySumMatchesRevenue=true`.
- [x] v0.2에서 paid evidence tier를 분리했다. 검증: `paid_meta_order_click_id 211,597,155원`, `paid_naver_order_click_id 82,809,093원`, `paid_google_order_click_id 6,720,110원`.
- [x] paid_naver 후보를 샘플 감사했다. 검증: VM confirmed payment_success 1,664건 중 `NaPm` 포함 row 323건, 관측금액 89,603,396원. v0.2 A/B spine에는 305건 / 83,054,093원 반영.
- [x] 운영 source 기준 최신 NPay confirmed order의 intent 연결을 확인했다. 검증: [[../gdn/google-ads-confirmed-purchase-operational-dry-run-20260505]]에서 2026-04-27~2026-05-05 NPay 실제 결제완료 37건을 포함하고 click/count/payment start-only는 제외했다.

#### 남은 것

- [x] 2026년 4월 전체 NPay rail에는 publish 이전 공백을 표시했다. 무엇: `npay` rail 139건 / 24,525,000원 중 2026-04-27 18:10 KST 이전 주문은 intent 직접 매칭이 불가능하다고 표시했다. 왜: NPay return 누락과 source 미수집 기간을 혼동하면 안 된다. 산출물: [[../naver/npay-rail-source-gap-20260506]]. 검증: publish 이전 `source_unavailable_before_publish` 126건 / 20,983,200원, publish 이후 `post_publish_intent_available` 13건 / 3,541,800원으로 분리했다.

#### 실행 단계

1. [Codex] 채널 배정 규칙 v0.1을 코드 초안으로 만든다 — 완료. 산출물: `backend/scripts/monthly-evidence-join-dry-run.ts`. 검증: 같은 입력은 항상 같은 channel로 배정되고 합계가 `499,829,436원`과 일치했다. 의존성: 완료.
2. [Codex] unknown/quarantine 사유를 표준화한다 — 부분 완료. 무엇: source stale, order join 실패, click id 없음, 증거 충돌 같은 사유 코드를 만든다. 왜: unknown을 줄이려면 무엇 때문에 unknown인지 알아야 한다. 산출물: v0.1 `unknownReasons`. 다음 검증: 모든 unknown 주문에 reason이 1개 이상 붙는다. 의존성: 진행 중.
3. [Codex] channel assignment rule v0.2를 만든다 — 완료. 산출물: `backend/scripts/monthly-evidence-join-dry-run.ts`. 검증: paid channel/unknown revenue의 근거가 evidence tier로 분리됐다. 의존성: 완료.
4. [Codex] paid_naver 후보를 샘플 감사한다 — 완료. 산출물: [[attribution-vm-evidence-join-contract-20260504]] v0.2 섹션. 검증: `NaPm` 포함 VM row와 v0.2 A/B spine 반영액이 분리됐다. 의존성: 완료.
5. [TJ] 채널 분류표 v1 추천안에 답한다 — 추천안 A: 이 문서의 12개 채널을 1차 표준으로 사용. 제 추천: YES. 자신감: 92%. 이유: 너무 세분화하지 않으면서 광고/오가닉/CRM/unknown을 예산 판단에 충분히 나눌 수 있다. 답변 형식: `YES` 또는 `NO: 채널명 수정`. YES 이후 Codex 작업: dry-run 출력과 `/total` 화면 설계를 이 채널명으로 고정한다. 의존성: 부분병렬.

### Phase3-Sprint5
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS 비교

**목표**: 내부 confirmed ROAS와 Meta/TikTok/Google/Naver가 주장하는 ROAS를 분리해서 비교한다.

**왜 지금 해야 하는가**: 광고 플랫폼 수치와 내부 매출 수치가 다를 때 어떤 차이가 정상이고 어떤 차이가 문제인지 구분해야 한다.

**산출물**: 채널별 spend, 내부 confirmed ROAS, 플랫폼 참고 ROAS, gap 사유표, `platform_reference` skeleton.

**완료 기준**: 각 ROAS 값에 `queried_at`, `timezone`, `date_range`, `attribution_window`, `ledger_source`가 붙고, 플랫폼 값은 내부 confirmed revenue에 합산되지 않는다.

**다음 Phase에 주는 가치**: 증액/감액 판단에서 어떤 숫자를 메인으로 볼지 정해진다.

#### 역할 구분

- TJ: 외부 광고 관리자 화면 확인이나 예산 판단이 필요할 때 결정한다.
- Codex: 현재 API 권한으로 spend와 platform reference value를 read-only로 조회한다.
- Claude Code: 나중에 `/total` 또는 `/ads` 화면에서 숫자 차이를 설명하는 UI를 만든다.

#### 진입 조건

Phase2-Sprint4의 월별 채널 배정 dry-run이 필요하다.

#### 실행 단계

현재 완료된 것은 `platform_reference` value 1차 연결이다.
`backend/scripts/monthly-evidence-join-dry-run.ts` v0.4는 `platformReference.referenceOnly=true`, `noInternalRevenueMerge=true`로 Meta/TikTok/Google/Naver 참고값을 내부 매출과 분리한다.
Meta, TikTok, Google 값은 read-only로 붙였고, Naver Ads source는 아직 연결 전이라 `unavailable`로 표시한다.

2026년 4월 biocom dry-run 검증 결과:

| platform | status | spend | conversion value | ROAS | freshness |
|---|---|---:|---:|---:|---|
| Meta | `joined` | 122,193,692원 | 489,012,112원 | 4.00 | `fresh` |
| TikTok | `joined` | 25,267,682원 | 598,161,397원 | 23.67 | `local_cache` |
| Google | `joined` | 26,835,011원 | 187,242,635원 | 6.98 | `fresh` |
| Naver | `unavailable` | - | - | - | `blocked` |

주의: TikTok은 로컬 TikTok Ads cache 기준이다. 플랫폼 값은 내부 confirmed revenue에 합산하지 않는다.
TikTok cache는 `tiktok_ads_daily` 기준 2026-03-19~2026-05-03까지 있고, imported 346행 / usable 224행이 확인됐다.
다만 "한국어 export의 중복 구매 헤더를 구매값으로 추정"한 warning이 있어 `/total`에서는 `local_cache` 경고를 붙인다.

1. [Codex] 플랫폼별 spend와 conversion value를 같은 월 기준으로 조회한다 — 부분 완료. 무엇: Meta, TikTok, Google, Naver의 광고비와 플랫폼 주장 전환값을 가져온다. 왜: 내부 ROAS와 플랫폼 ROAS의 차이를 숫자로 보기 위해서다. 어떻게: Meta Ads API, TikTok local cache, Google Ads API를 read-only로 조회했다. Naver Ads source는 아직 없다. 산출물: platform reference table. 검증: `queried_at`, `timezone`, `date_range`, `currency`가 있어야 한다. 의존성: 부분병렬.
2. [Codex] 내부 confirmed ROAS와 플랫폼 참고 ROAS를 나란히 계산한다 — 부분 완료. 무엇: 내부 채널 매출과 플랫폼 주장 매출을 분리해 표기한다. 왜: 둘을 섞으면 ROAS gap 원인을 잃는다. 어떻게: `platformReference`에 spend/value/gap을 붙였다. 산출물: monthly platform comparison. 검증: 내부 매출 합계는 정본 매출과 맞고, 플랫폼 값은 참고값으로 표시된다. 의존성: TikTok cache 최신성 확인은 완료, Naver source 연결은 남음.
3. [TJ] 예산 판단 기준을 확인한다 — 추천안 A: 예산 판단 메인은 내부 confirmed ROAS, 플랫폼 ROAS는 보조 참고값. 제 추천: YES. 자신감: 94%. 이유: 실제 결제와 환불이 반영된 값으로 판단해야 비용 낭비를 줄인다. 답변 형식: `YES` 또는 `NO: 플랫폼 ROAS도 메인으로 병행`. 의존성: 부분병렬.

### Phase4-Sprint6
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 수집 개선 승인 패키지

**목표**: unknown과 플랫폼 gap을 줄이기 위한 GTM, GA4, CAPI, NPay, Google 전환 변경안을 승인 가능한 단위로 나눈다.

**왜 지금 해야 하는가**: 수집 개선은 숫자를 좋아지게 만들 수 있지만, 잘못 열면 중복 purchase나 플랫폼 학습 오염이 생긴다.

**산출물**: 승인 패키지, 테스트 계획, rollback 기준.

**완료 기준**: 각 변경안이 `추천안`, `자신감`, `부족 데이터`, `승인 후 작업`, `검증 기준`을 가진다.

**다음 Phase에 주는 가치**: 운영 반영을 하더라도 무엇을 왜 바꿨는지 추적할 수 있다.

#### 역할 구분

- TJ: GTM 운영 게시, 광고 플랫폼 전환 설정 변경, 개인정보/해시 전송, 실결제 테스트를 승인한다.
- Codex: 승인 전 read-only 확인, dry-run, Test Events 준비, payload preview, 승인 패키지 문서 작성을 맡는다.
- Claude Code: 해당 없음. 이 승인 패키지를 나중에 프론트엔드 화면으로 보여줄 때만 UI 구현을 맡는다.

#### 진입 조건

Phase1-Sprint1부터 Phase3-Sprint5까지의 read-only 결과가 있어야 한다.

#### 완료한 것

- [x] Google Ads `구매완료` primary 변경 승인안을 만들었다. 검증: [[../gdn/google-ads-purchase-primary-change-approval-20260505]].
- [x] Google Ads confirmed purchase 실행 승인 문서를 분리했다. 검증: [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]].
- [x] 운영 source 기준 confirmed purchase no-send dry-run을 확장했다. 검증: [[../gdn/google-ads-confirmed-purchase-operational-dry-run-20260505]], 최신 재실행 기준 623건, send_candidate 0건, `imweb_operational` fresh.
- [x] confirmed_purchase no-send 수신·디스패처 계약을 만들었다. 검증: [[../gdn/confirmed-purchase-no-send-pipeline-contract-20260505]], `POST /api/attribution/confirmed-purchase/no-send` local preview route.
- [x] confirmed_purchase no-send route 운영 샘플을 검증했다. 검증: [[../data/confirmed-purchase-no-send-route-sample-20260506]], 운영 주문 20건 + NPay click control 1건, no-send/no-write/no-platform-send true.
- [x] Google click id 보존 GTM Preview 승인안을 만들었다. 검증: [[../gdn/paid-click-intent-gtm-preview-approval-20260506]], Preview only, Production publish 금지, platform send 0건.
- [x] paid_click_intent GTM Preview only를 실행했다. 검증: [[../gdn/paid-click-intent-gtm-preview-result-20260506]], storage/payload PASS, Node-side receiver contract PASS.
- [x] paid_click_intent receiver HTTPS 재검증을 실행했다. 검증: [[../gdn/paid-click-intent-receiver-access-result-20260506]], 세 click id 케이스 모두 browser receiver `200 ok=true`.
- [x] Google Ads landing-session 기준 click id 분모를 추가 분석했다. 검증: [[../gdn/google-ads-landing-clickid-analysis-20260506]], 최근 7일 Google Ads 증거 세션 6,879개 중 6,724개에 click id가 남아 보존률 97.75%.
- [x] paid_click_intent v1 운영 GTM 게시 승인안을 만들었다. 검증: [[../gdn/paid-click-intent-gtm-production-publish-approval-20260506]], publish 범위, 금지선, rollback, 24h/72h 모니터링 기준 기록. 실제 Production publish 0건.
- [x] paid_click_intent post-publish 모니터링 템플릿을 만들었다. 검증: [[../gdn/paid-click-intent-post-publish-monitoring-template-20260506]], 24h/72h fill-rate, receiver, rollback 기준 기록.
- [x] TJ님 컨펌 대기열을 만들었다. 검증: [[total-confirmation-queue-20260505]].

#### 남은 것

- [ ] TJ님이 `paid_click_intent v1` 운영 GTM publish를 승인할지 보류할지 판단한다. 무엇: 랜딩 시점 Google click id 저장 태그를 운영 사이트에 게시할지 결정한다. 왜: Preview/receiver/BigQuery 분모 분석은 통과했지만 운영 GTM publish는 고객 사이트 추적에 영향을 준다. 어떻게: [[../gdn/paid-click-intent-gtm-production-publish-approval-20260506]]의 승인 문구와 금지선을 확인한다. 검증: 승인 전 Production publish 0건.
- [ ] Google Ads confirmed purchase 실제 실행은 보류한다. 무엇: Google Ads conversion action 생성/변경과 upload는 아직 하지 않는다. 왜: click id 보존률이 낮아 매칭률이 부족할 가능성이 높고 Red Lane이다. 산출물: 보류 사유 유지. 검증: Google Ads UI 변경 0건, upload 0건.

#### 실행 단계

1. [Codex] 수집 개선 후보를 위험도별로 나눈다 — 완료. 무엇: 랜딩 `marketing_intent`, checkout 앵커, NPay intent-order, Advanced Matching, Google confirmed conversion을 Green/Yellow/Red로 분리했다. 왜: 안전한 설계와 운영 반영 작업을 섞지 않기 위해서다. 산출물: [[total-confirmation-queue-20260505]]와 각 GDN/NPay 승인 문서. 검증: 각 항목에 금지선과 실행 보류 기준이 있다.
2. [Codex] GTM/GA4/CAPI는 먼저 test-only 또는 preview로 검증 가능한지 본다 — 무엇: 운영 게시 없이 확인 가능한 범위를 찾는다. 왜: TJ님 승인 전에 자동화 가능한 확인을 먼저 끝내기 위해서다. 어떻게: GTM snapshot, Test Events code, payload preview, DebugView 가능성을 정리한다. 산출물: test-only plan. 검증: 실제 운영 송출이 0건이어야 한다. 의존성: 부분병렬.
3. [TJ] 운영 반영이 필요한 항목만 승인한다 — 이유: GTM 운영 게시, 플랫폼 전환 설정, 개인정보 해시 전송은 운영과 법무/보안 판단이 필요하다. 답변 형식: 각 항목별 `YES`, `NO`, `HOLD`. 의존성: 선행필수.

### Phase5-Sprint7
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 월간 운영 루틴

**목표**: 매월 같은 기준으로 채널별 매출과 ROAS를 닫는 운영 루틴을 만든다.

**왜 지금 해야 하는가**: 문서만 있으면 매월 사람이 다시 해석해야 한다. 실행 순서와 검증 기준이 있어야 같은 숫자를 반복해서 닫을 수 있다.

**산출물**: 월간 close runbook, source 최신성 점검표, 월별 산출 명령/API 목록.

**완료 기준**: 월별 총매출, 채널별 매출, 플랫폼 비교, unknown 사유, source 최신성을 같은 순서로 산출할 수 있다.

**다음 Phase에 주는 가치**: 월별 예산 판단을 반복 가능한 운영 절차로 바꿀 수 있다.

#### 역할 구분

- TJ: 월간 운영 루틴을 실제 예산 판단에 쓸지 승인한다.
- Codex: API, 월별 산출 script, 최신성 check, runbook을 만든다.
- Claude Code: 해당 없음. 프론트엔드 화면은 [[#Phase5-Sprint8]]에서 담당한다.

#### 진입 조건

Phase2-Sprint4와 Phase3-Sprint5의 월별 dry-run 결과가 필요하다.

#### 실행 단계

1. [Codex] 월간 close runbook을 만든다 — 무엇: 매월 1일부터 5일까지 무엇을 어떤 순서로 실행할지 문서화한다. 왜: 월별 숫자를 같은 기준으로 닫기 위해서다. 어떻게: 이 문서의 산출 프로세스를 명령어와 API 기준으로 바꾼다. 산출물: monthly close runbook. 검증: source 최신성과 조회 메타데이터가 필수 항목으로 들어간다. 의존성: 부분병렬.
2. [Codex] `/total` 화면에 넘길 API/데이터 계약을 설계한다 — 완료. 무엇: 월별 총매출, 채널별 매출, 플랫폼 비교, unknown 사유, source 최신성 필드를 정의했다. 왜: Claude Code가 프론트엔드를 만들 때 백엔드 기준이 흔들리지 않게 하기 위해서다. 어떻게: [[total-api-contract-20260504]]에 `metadata`, `monthly_spine`, `evidence`, `platform_reference`, `source_freshness`, `frontend_copy` 구조를 기록했고 `backend/src/routes/total.ts`에 로컬 route를 추가했다. 산출물: API response contract와 local dry-run route. 검증: `GET http://localhost:7022/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run`에서 `ok=true`, A/B confirmed net `499,829,436원`, `primary_sum_matches_revenue=true`를 확인했다. 의존성: 운영 배포는 별도 승인 필요.
3. [TJ] 월간 운영 루틴 추천안에 답한다 — 추천안 A: 매월 1~5일에 source 최신성 확인, 주문·결제 정본 산출, 채널 배정, 플랫폼 비교, gap 리포트 순서로 닫는다. 제 추천: YES. 자신감: 89%. 이유: 월초 예산 판단 전에 숫자 기준을 고정할 수 있다. 답변 형식: `YES` 또는 `NO: 일정/순서 수정`. 의존성: 부분병렬.

### Phase5-Sprint8
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: `/total` 프론트엔드 화면

**목표**: 월별 채널 매출과 ROAS를 운영자가 한 화면에서 이해하도록 `/total` 페이지를 만든다.

**왜 지금 해야 하는가**: API와 runbook만 있으면 긴 문서를 읽어야 한다. 프론트엔드 화면이 있어야 대표와 운영자가 매월 같은 숫자와 경고를 빠르게 볼 수 있다.

**산출물**: `/total` 페이지, source 최신성 경고 UI, 채널별 매출/ROAS 설명 문구.

**완료 기준**: 첫 화면에서 총 순매출, 분류 완료율, 채널별 내부 ROAS, 플랫폼 gap, unknown 사유가 보인다.

**다음 Phase에 주는 가치**: 월별 예산 판단을 문서가 아니라 화면 중심으로 반복할 수 있다.

#### 역할 구분

- TJ: 화면에서 가장 먼저 보고 싶은 판단 순서를 승인한다.
- Codex: 백엔드 API 계약, 데이터 의미, 검증 기준을 제공한다.
- Claude Code: 프론트엔드 구현, UI 문구, 시각화, 모바일/PC 화면 품질을 담당한다.

#### 진입 조건

Phase5-Sprint7의 API/데이터 계약이 필요하다.

#### 실행 단계

1. [Codex] `/total` 화면용 API 계약을 Claude Code에 넘긴다 — 완료. 무엇: 필드 이름, 설명, source metadata, 예시 응답을 정리했다. 왜: 프론트엔드가 임의 해석으로 숫자를 바꾸지 않게 하기 위해서다. 어떻게: [[total-api-contract-20260504]]와 [[total-frontend-handoff-20260504]]에 monthly summary, platform comparison, source warning, TikTok local cache 경고를 문서화했다. 산출물: API contract와 frontend handoff. 검증: 필드마다 사람이 읽는 설명과 금지 표현이 있다. 의존성: 완료.
2. [Claude Code] `/total` 프론트엔드 페이지를 만든다 — 무엇: 월별 채널 매출 보고 화면을 구현한다. 왜: 운영자가 긴 문서 대신 화면에서 판단하게 하기 위해서다. 어떻게: `frontrule.md`를 참고해 전문용어를 풀어 쓰고, source 최신성 경고를 눈에 띄게 배치한다. 산출물: `/total` 페이지. 검증: 데스크톱/모바일에서 첫 화면 핵심 5개 지표가 보인다. 의존성: 선행필수.
3. [TJ] 화면 우선순위 추천안에 답한다 — 추천안 A: 총 순매출, 분류 완료율, 채널별 내부 ROAS, 플랫폼 gap, unknown 사유 순서로 노출. 제 추천: YES. 자신감: 88%. 이유: 예산 판단과 데이터 신뢰도 경고를 동시에 볼 수 있다. 답변 형식: `YES` 또는 `NO: 노출 순서 수정`. 의존성: 부분병렬.

## TJ님 컨펌 필요 항목

지금 바로 승인할 필요는 없지만, 다음 단계로 가려면 아래 결정이 필요하다.

| 항목 | 왜 필요한가 | 추천 |
|---|---|---:|
| 월별 매출 정본은 `confirmed net revenue`로 고정 | 반영 완료. A/B rail만 정본 포함, C/D/quarantine은 최종 close 전 확인 | 96% |
| 채널 분류표 v1 승인 | 모든 보고서의 채널명이 같아야 함 | 92% |
| biocom GA4 BigQuery raw read 권한 확보 시도 | GA4 `not set`과 중복 purchase 분해 필요 | 90% |
| GTM Preview로 landing `marketing_intent` 보존 테스트 | 결제 완료 시점만 보면 늦음 | 88% |
| campaign UTM 표준을 그로스 파트에 적용 | 앞으로 수동 mapping을 줄임 | 91% |
| Google/NPay purchase 전환 변경은 별도 승인 후 진행 | 자동입찰 학습에 영향 | 84% |

## 우리 프로젝트에 주는 도움

| 도움 | 설명 |
|---|---|
| 광고비 판단이 안전해진다 | Meta, TikTok, Google이 각자 주장하는 매출이 아니라 실제 confirmed 순매출 기준으로 예산을 볼 수 있다. |
| unknown 매출을 줄일 수 있다 | 결제 완료 시점이 아니라 랜딩 시점 유입 증거를 저장하면 direct/unknown으로 빠지는 주문을 줄일 수 있다. |
| 채널별 책임이 분명해진다 | Meta 매출인지, TikTok 매출인지, Organic 매출인지 주문 단위 이유가 남는다. |
| 플랫폼 gap을 설명할 수 있다 | attribution window, cross-device, NPay return, 전환 액션 오염, source stale을 따로 분해할 수 있다. |
| 매월 같은 숫자를 볼 수 있다 | source 최신성, 기준 기간, attribution window, `assignment_version`을 같이 남겨 숫자 논쟁을 줄인다. |

## 다음 액션

| 시점 | 담당 | 액션 | 상세 |
|---|---|---|---|
| 완료 | Codex | source 목록 문서를 만들었다 | [[#Phase1-Sprint1]] |
| 완료 | Codex | 주문·결제 join key matrix를 더 상세화했다 | [[join-key-matrix-20260504]] |
| 완료 | Codex | 2026년 4월 biocom 주문·결제 spine dry-run 계약을 만들었다 | [[monthly-spine-dry-run-contract-20260504]] |
| 완료 | Codex | read-only dry-run script 초안을 만들고 2026년 4월 summary를 재현했다 | [[#Phase1-Sprint2]] |
| 완료 | Codex | Attribution VM evidence join 계약을 만들었다 | [[attribution-vm-evidence-join-contract-20260504]] |
| 완료 | Codex | evidence join dry-run script를 만들고 2026년 4월 v0.1 결과를 산출했다 | [[#Phase2-Sprint3]] |
| 완료 | Codex | channel assignment rule v0.2를 만들고 실행했다 | [[#Phase2-Sprint4]] |
| 부분 완료 | Codex | NPay matching rail source 접근을 해결했고 2026-05-05 VM snapshot dry-run을 생성했다 | [[#Phase2-Sprint3]] / [[../data/npay-roas-dry-run-vm-snapshot-20260505]] |
| 완료 | Codex | paid_naver 후보 샘플 감사를 진행했다 | [[#Phase2-Sprint4]] |
| 완료 | Codex | platform_reference value를 1차 연결했다 | [[#Phase3-Sprint5]] |
| 완료 | Codex | `/total` 화면용 API/데이터 계약과 로컬 route를 만들었다 | [[total-api-contract-20260504]] |
| 완료 | Codex | `/total` 프론트엔드 handoff 문서를 만들었다 | [[total-frontend-handoff-20260504]] |
| 완료 | Codex | TikTok local cache 최신성을 확인하고 경고 기준을 고정했다 | [[#Phase3-Sprint5]] |
| 완료 | Codex | Google Ads NPay/구매완료 전환 오염 리포트를 만들었다 | [[../gdn/google-ads-npay-purchase-contamination-report-20260505]] |
| 완료 | Codex | Tag Coverage ignore 후보를 정리했다 | [[../GA4/gtm-tag-coverage-ignore-candidates-20260505]] |
| 완료 | Codex | Meta 표준 퍼널 CAPI Test Events smoke 준비안을 만들었다 | [[../capivm/meta-funnel-capi-test-events-smoke-plan-20260505]] |
| 완료 | Codex | ProductEngagementSummary no-write contract를 만들었다 | [[../GA4/product-engagement-summary-contract-20260505]] |
| 진행 중 | Codex | A급 NPay 후보 10건의 GA4 BigQuery 중복 guard를 확인한다 | [[#Phase2-Sprint3]] / [[../data/npay-roas-dry-run-vm-snapshot-20260505]] |
| API 계약 후 | Claude Code | `/total` 프론트엔드 화면을 구현한다 | [[#Phase5-Sprint8]] |
| 승인 후 | TJ+Codex | GTM 랜딩 저장, GA4 권한, Google/NPay 전환 변경을 항목별로 판단한다 | [[#Phase4-Sprint6]] |

## Codex가 다음에 바로 할 수 있는 일

승인 없이 가능한 Green Lane 작업은 아래다.

| 우선순위 | 작업 | 산출물 |
|---:|---|---|
| 1 | A급 NPay 후보 10건의 GA4 BigQuery guard 확인 | 이미 GA4에 있는 주문 중복 전송을 막고, robust_absent 후보만 월별 채널 분류에 반영 |
| 2 | 2026년 4월 monthly evidence join에 VM snapshot NPay report 연결 | NPay return 누락을 월별 채널 분류에 반영 |
| 3 | ProductEngagementSummary no-write route 구현안 작성 | 실제 GTM Preview 전에 PII 차단과 dry-run 응답을 로컬에서 검증 |
| 4 | Meta 표준 퍼널 CAPI Test Events 실행 승인안 작성 | Test Events code를 쓰는 실제 외부 전송 전 체크리스트와 원복 기준을 고정 |
| 5 | Naver Ads reference source 연결 방법 결정 | Naver 플랫폼 spend/value가 아직 `unavailable` |
| 6 | 월별 dry-run 저장 스키마 초안 작성 | `order_channel_ledger`, `monthly_channel_summary` |

Yellow/Red 작업은 아래다.

| 작업 | 필요한 승인 |
|---|---|
| GTM Preview/운영 게시 변경 | TJ 승인, Preview 검증 |
| 중간 퍼널 CAPI 운영 송출 | Test Events 통과 후 별도 승인 |
| GA4 MP/NPay purchase 복구 전송 | dry-run 후보와 중복 guard 확인 후 승인 |
| Google Ads 전환 액션 변경 | UI/API mutation 승인 |
| 운영 DB write/import | 별도 승인 |

## 최종 운영 화면이 보여줘야 할 것

나중에 `/total` 페이지를 만든다면 첫 화면은 아래 순서가 좋다.

1. 이번 달 총 확정 순매출과 분류 완료율.
2. 채널별 내부 confirmed 매출과 ROAS.
3. 플랫폼 참고 ROAS와 내부 ROAS 차이.
4. unknown/quarantine 매출과 가장 큰 원인.
5. source 최신성 경고.
6. 이번 달 꼭 처리해야 할 수동 확인 목록.

운영자가 바로 이해할 수 있는 문구 예시는 아래다.

```text
2026년 4월 biocom 매출 1억원 중 8,700만원은 유입 채널을 확정했습니다.
Meta 광고로 확정한 매출은 2,300만원이고, 이 중 1,800만원은 click id가 주문과 직접 연결된 A급 증거입니다.
Meta Ads Manager는 같은 기간 3,100만원을 주장합니다. 차이 800만원은 cross-device, attribution window, UTM 유실 후보로 분해 중입니다.
unknown 1,300만원은 예산 판단에서 제외합니다.
```

이 문구처럼 숫자는 반드시 `내부 확정 매출`, `플랫폼 주장값`, `unknown`을 분리해서 보여줘야 한다.

## 완료 정의

이 프로젝트의 1차 완료는 아래 조건을 만족하는 상태다.

| 조건 | 완료 기준 |
|---|---|
| 월별 전체 매출 대조 | 주문/결제/환불 기준 총 순매출이 맞음 |
| 채널별 합계 일치 | primary channel 합계가 총 순매출과 일치 |
| paid channel 증거 | Meta/TikTok/Google/Naver 매출에 click id/UTM/intent evidence가 있음 |
| unknown 설명 가능 | unknown/quarantine 주문마다 이유가 있음 |
| 플랫폼 ROAS 분리 | internal confirmed ROAS와 platform reference ROAS가 분리 표시됨 |
| 최신성 표시 | source별 최신성/권한/fallback이 표시됨 |
| 월간 close 반복 가능 | 같은 script/API로 다음 달도 재현 가능 |

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 16:56 KST | 최초 작성. 월별 유입 채널 매출 정합성 계획, source별 역할, 배정 규칙, 로드맵 정리 |
| 2026-05-04 17:05 KST | `docurule.md` 기준 보강. 고등학생 비유, Phase-Sprint 요약표, 다음 할일, Sprint 상세, 역할 구분, 우리 프로젝트에 주는 도움, 다음 액션 추가 |
| 2026-05-04 17:16 KST | `total/source-inventory-20260504.md` 추가. 운영 Toss/Postgres, Attribution VM, 로컬 SQLite, GA4 BigQuery source 최신성 확인 결과 반영 |
| 2026-05-04 17:45 KST | [[source-inventory-20260504]]와 [[join-key-matrix-20260504]] 링크를 연결. 주문·결제 spine dry-run 전 키 매트릭스와 다음 작업을 반영 |
| 2026-05-04 18:05 KST | [[monthly-spine-dry-run-contract-20260504]] 추가. 2026년 4월 biocom read-only sanity check와 dry-run API/SQL 계약 반영 |
| 2026-05-04 18:01 KST | `backend/scripts/monthly-spine-dry-run.ts` 추가 및 실행 검증. 2026년 4월 biocom spine summary 재현 결과 반영 |
| 2026-05-04 18:04 KST | [[attribution-vm-evidence-join-contract-20260504]] 추가. confirmed net revenue A/B 정본, VM evidence join, conflict rule, NPay 규칙 반영 |
| 2026-05-04 18:12 KST | `backend/scripts/monthly-evidence-join-dry-run.ts` 추가 및 실행 검증. 2026년 4월 A/B confirmed net `499,829,436원`에 v0.1 primary channel 후보를 붙였고 합계 일치를 확인 |
| 2026-05-04 18:27 KST | `monthly-evidence-join-dry-run-v0.2` 실행 결과 반영. NPay matching rail은 source unavailable로 안전 보류하고, paid evidence tier와 `NaPm` 기반 paid_naver 후보를 분리 |
| 2026-05-04 18:28 KST | paid_naver 후보 샘플 감사 반영. VM confirmed payment_success `NaPm` 포함 row 323건, v0.2 A/B spine paid_naver 305건 / 83,054,093원 확인 |
| 2026-05-04 18:51 KST | `monthly-evidence-join-dry-run-v0.3` platformReference skeleton과 [[total-api-contract-20260504]] 추가. `/total` API 응답에서 내부 confirmed revenue와 플랫폼 주장값을 분리 |
| 2026-05-04 19:07 KST | `monthly-evidence-join-dry-run-v0.4` platformReference value 연결과 `backend/src/routes/total.ts` 로컬 route 검증 반영. Meta/TikTok/Google reference joined, Naver unavailable |
| 2026-05-04 19:18 KST | [[total-frontend-handoff-20260504]] 추가. TikTok cache 2026-03-19~2026-05-03, imported 346행 / usable 224행, `local_cache` 경고 기준 반영 |
| 2026-05-05 02:05 KST | Google Ads NPay/구매완료 오염 리포트, Tag Coverage ignore 후보, Meta CAPI Test Events smoke 준비안, ProductEngagementSummary contract 링크와 다음 할일 반영 |
| 2026-05-05 22:25 KST | 운영 VM NPay intent source 접근 해결 반영. `taejun` SSH + sudo read-only SQLite snapshot으로 `npay_intent_log` 823건 확인, [[../data/npay-roas-dry-run-vm-snapshot-20260505]] 생성. 다음 병목은 A급 strong 10건 GA4 BigQuery guard |
