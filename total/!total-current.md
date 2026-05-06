# 월별 유입 채널 매출 정합성 현재 정본

작성 시각: 2026-05-06 22:45 KST
기준일: 2026-05-06
상태: active canonical
Owner: total / attribution
Supersedes: [[!total|기존 Phase 순서 정본]]
Next document: Mode B 실행 결과 문서 또는 minimal paid_click_intent ledger write 승인안
Do not use for: Google Ads 전환 변경, conversion upload, confirmed purchase dispatcher 운영 전송, 운영 DB/ledger write 승인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  required_context_docs:
    - total/!total.md
    - gdn/paid-click-intent-production-receiver-deploy-approval-20260506.md
    - meta/campaign-alias-mapping.md
    - meta/campaign-mapping-growth-team-guide-20260504.md
    - ontology/!ontology.md
  lane: Green 문서 정본 작성 + Red Mode B 승인 상태 기록
  allowed_actions:
    - 실제 개발 순서 기준 정본 문서 작성
    - read-only/source audit
    - no-send route local guard 보강
    - 캠페인 mapping seed 반영
    - scoped commit/push
  forbidden_actions:
    - Google Ads 전환 변경
    - conversion upload
    - confirmed purchase dispatcher 운영 전송
    - 운영 DB/ledger write
    - GA4/Meta/Google Ads/TikTok/Naver 전환 전송
  source_window_freshness_confidence:
    source: "기존 total/!total.md, gdn/Mode B 승인 문서, 그로스파트 엑셀, 로컬 코드"
    window: "2026-05-04~2026-05-06 KST"
    freshness: "정본 문서는 최신. 운영 receiver 배포는 SSH publickey 접근 실패로 미실행"
    confidence: 0.88
```

## 10초 결론

이 문서가 현재 정본이다. 기존 [[!total]]은 작업 영역별 역사 문서로 남기고, 실제 개발 순서는 이 문서의 Active Action Board를 따른다.

현재 P0는 `paid_click_intent Mode B`다. 뜻은 Google 광고 클릭 ID(`gclid/gbraid/wbraid`)가 랜딩에서 저장되고 checkout/NPay intent까지 이어지는지 운영에서 검증하기 위해, `att.ainativeos.net`에 no-write receiver route를 배포한 뒤 TEST/negative smoke, GTM receiver-enabled publish, 24h/72h 모니터링까지 진행하는 묶음이다.

TJ님은 Mode B를 조건부 YES로 승인했다. 단, Google Ads 전환 변경, conversion upload, confirmed purchase dispatcher 운영 전송, 운영 DB/ledger write는 계속 금지다. 현재 실행 병목은 승인이 아니라 `biocomkr_sns@34.64.104.94` SSH publickey 접근 실패다.

## 현재 기준

| 항목 | 현재 기준 |
|---|---|
| 정본 문서 | [[!total-current]] |
| 기존 문서 역할 | [[!total]]은 old/legacy phase history |
| 현재 P0 | paid_click_intent Mode B |
| Mode B 승인 상태 | 조건부 YES |
| Mode B 실제 실행 상태 | SSH publickey blocker로 운영 deploy 미실행 |
| 캠페인 매핑 최신 입력 | `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx` |
| Meta 매핑 seed | `data/meta_campaign_aliases.biocom.json` |
| 외부 전송 상태 | 0건. GA4/Meta/Google Ads/TikTok/Naver 전송 없음 |
| 운영 DB/ledger write | 0건. 금지 유지 |

## 실제 개발 순서

Phase 번호는 과거 작업 영역을 설명하는 이름일 뿐이다. 실제 개발은 아래 순서로 진행한다.

1. **P0: paid_click_intent Mode B 실행**
   - 목적: Google Ads 랜딩에 이미 있는 click id가 checkout/NPay intent/confirmed purchase 후보까지 끊기지 않게 만드는 선행 작업.
   - 현재: TJ님 조건부 YES. SSH 접근 실패로 운영 배포 미실행.

2. **P0: Meta 캠페인 수동 매핑 반영**
   - 목적: 내부 주문 alias를 Meta campaign_id에 잘못 붙여 ROAS를 왜곡하지 않도록 한다.
   - 현재: 그로스파트 엑셀 반영. 확정 1건, 분리 필요 7건, 제외 1건을 seed와 문서에 기록.

3. **P1: minimal paid_click_intent ledger write 승인안**
   - 목적: no-write receiver로 payload 안전성을 확인한 다음, 실제 저장을 최소 범위로 열어 주문 후보와 연결한다.
   - 조건: Mode B 24h/72h 모니터링 PASS.

4. **P1: confirmed_purchase no-send 재실행**
   - 목적: NPay 실제 결제완료와 홈페이지 결제완료만 purchase 후보로 남기고, NPay click/count/payment start는 제외한다.
   - 조건: paid_click_intent 저장 또는 충분한 receiver evidence.

5. **P2: Google Ads BI confirmed_purchase 실행안**
   - 목적: Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 구매 신호를 만든다.
   - 조건: Google click id 보존률과 no-send 후보가 충분해진 뒤 별도 Red 승인.

6. **P2: NPay rail post-publish 재분류**
   - 목적: NPay intent 수집 시작 이후 주문을 matched / ambiguous / purchase_without_intent로 나눠 monthly channel assignment에 반영한다.

7. **P3: `/total` 프론트엔드**
   - 목적: 월별 channel revenue, platform_reference, internal_confirmed, unknown/quarantine를 운영자가 볼 수 있게 만든다.
   - 조건: source freshness와 핵심 assignment rule이 안정화된 뒤 Claude Code가 구현.

## Active Action Board

| Priority | Status | Phase/Sprint | 작업 | 왜 하는가 | 다음 액션 | 담당 | 승인 필요 | Source |
|---|---|---|---|---|---|---|---|---|
| P0 | blocked_access | Phase4-Sprint6 | paid_click_intent Mode B | Google click id가 주문까지 사라지는 병목을 먼저 줄여야 Google Ads confirmed purchase가 가능하다 | VM SSH key 접근 복구 후 route deploy -> TEST/negative smoke -> GTM publish -> 24h/72h monitoring | TJ+Codex | 이미 조건부 YES. 접근 권한 필요 | [[../gdn/paid-click-intent-production-receiver-deploy-approval-20260506]] |
| P0 | done_local | Phase4-Sprint6 | no-write receiver route local guard 보강 | 운영 배포 전 admin/internal path, oversized payload, PII/value/order field를 차단해야 한다 | SSH 접근 복구 후 운영 배포 대상 diff로 포함 | Codex | Mode B 범위 안 | `backend/src/routes/attribution.ts` |
| P0 | done | Phase2-Sprint4 | Meta 캠페인 수동 매핑 반영 | wrong campaign ROAS를 줄이고 split_required alias를 자동 확정하지 않게 해야 한다 | split_required를 주문별 adset/ad id/date로 나누는 로직 설계 | Codex | NO | [[../meta/campaign-mapping-growth-confirmation-20260506]] |
| P1 | next_after_mode_b | Phase4-Sprint6 | minimal paid_click_intent ledger write 승인안 | no-write만으로는 주문 원장 fill-rate가 실제로 개선되지 않는다 | 24h/72h receiver validation PASS 후 저장 필드/보관기간/마스킹 승인안 작성 | Codex | YES | [[../ontology/!ontology]] |
| P1 | waiting | Phase4-Sprint6 | confirmed_purchase no-send 재실행 | 실제 결제완료 주문만 purchase 후보로 남겨야 Google/GA4/Meta 전송 전 중복과 누락을 볼 수 있다 | click id 저장 근거가 쌓인 뒤 dry-run 재실행 | Codex | NO, read-only | [[../gdn/confirmed-purchase-no-send-pipeline-contract-20260505]] |
| P2 | parked | Phase4-Sprint6 | Google Ads BI confirmed_purchase | Google Ads가 NPay click/count를 구매로 학습하지 않게 바꿔야 한다 | no-send 후보와 click id 보존률이 충분할 때 Red 승인안 재검토 | TJ+Codex | YES | [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]] |
| P2 | parked | Phase2-Sprint4 | NPay rail post-publish 재분류 | NPay는 결제수단이지 paid_naver 유입이 아니므로 실제 source가 있는 주문만 채널 배정해야 한다 | Mode B 이후 NPay intent/paid_click_intent 연결률 재검토 | Codex | NO | [[../naver/npay-rail-source-gap-20260506]] |
| P3 | parked | Phase5-Sprint8 | `/total` 프론트엔드 | 숫자 정본이 흔들리면 화면부터 만들면 혼란만 커진다 | backend source/assignment 안정 후 Claude Code handoff 업데이트 | Claude Code | NO | [[total-frontend-handoff-20260504]] |

## Approval Queue

### 1. Mode B: receiver route deploy -> smoke -> GTM publish -> monitoring

상태: TJ님 조건부 YES.

승인 범위:

- `att.ainativeos.net` backend에 `POST /api/attribution/paid-click-intent/no-send` no-write receiver route 배포.
- TEST POST와 negative smoke 확인.
- smoke 통과 시 receiver-enabled GTM Production publish.
- 24h/72h 모니터링.

계속 금지:

- Google Ads 전환 변경.
- conversion upload.
- confirmed purchase dispatcher 운영 전송.
- 운영 DB/ledger write.
- GA4/Meta/Google Ads/TikTok/Naver 전환 전송.
- 광고 예산/캠페인 변경.

현재 blocker:

```text
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes biocomkr_sns@34.64.104.94
-> Permission denied (publickey)
```

이 blocker는 승인 부족이 아니라 접근 권한 문제다.

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-06 KST | paid_click_intent Preview/receiver 검증 | 임시 receiver에서 `gclid/gbraid/wbraid` 3종 케이스 통과 |
| 2026-05-06 KST | Google Ads landing-session click id 분석 | 최근 7일 Google Ads 증거 세션 6,879개 중 6,724개 click id 보유. 보존률 97.75% |
| 2026-05-06 KST | production receiver POST smoke | `att.ainativeos.net` POST 404 확인. receiver-enabled GTM publish 전 backend route 필요 |
| 2026-05-06 KST | Mode B 승인안 | deploy/smoke/publish/monitoring을 한 번에 묶은 조건부 승인 구조 작성 |
| 2026-05-06 KST | 그로스파트 Meta 매핑 엑셀 반영 | 확정 1건, 분리 필요 7건, 제외 1건을 seed와 문서에 반영 |

## Parked / Later

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| Google Ads conversion action 변경 | 자동입찰 학습과 Google Ads 숫자를 바꾸는 Red Lane | BI confirmed_purchase 후보와 click id 보존률이 충분해지고 별도 승인 |
| conversion upload | Google Ads 전환값이 바뀌는 Red Lane | no-send 후보, 중복 guard, click id fill-rate, rollback 문서 PASS |
| GA4/Meta/Google Ads 실제 purchase 전송 | 플랫폼 전환값을 바꾸는 Red Lane | platform별 payload 승인안과 Events/BigQuery 중복 guard PASS |
| 운영 DB/ledger write | 데이터 원장을 바꾸는 Red Lane | minimal ledger write 승인안에서 저장 필드, 보관기간, 삭제/마스킹 기준 승인 |
| `/total` UI 고도화 | 현재는 source/assignment가 더 큰 병목 | Mode B와 최소 저장 설계 후 화면 수치 의미가 안정화될 때 |

## Meta 캠페인 매핑 최신 결론

Source: `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx`
확인 시각: 2026-05-04 16:10 KST
반영 시각: 2026-05-06 22:45 KST
Freshness: 그로스파트 수동 확인 최신. 일부 campaign id는 현재 stale audit에 없으므로 `audit missing`으로 표시.
Confidence: 0.86

결론:

- `meta_biocom_kkunoping02_igg`는 campaign `120242626179290396`으로 확정했다.
- `inpork_biocom_igg`는 Meta campaign ROAS에 붙이지 않는다. NPay와 마찬가지로 결제/유입 성격을 섞으면 안 된다.
- `meta_biocom_sosohantoon01_igg`, `meta_biocom_skintts1_igg`, `meta_biocom_proteinstory_igg`, `meta_biocom_iggspring`, `meta_biocom_iggacidset_2026`, `meta_biocom_mingzzinginstatoon_igg`, `meta_biocom_iggpost_igg`는 단일 campaign 자동 확정이 아니라 `split_required`다.
- `split_required`는 캠페인 ROAS에 억지로 붙이지 않는다. 다음 단계에서 주문별 adset/ad id/date/URL Parameters로 나눠야 한다.

상세: [[../meta/campaign-mapping-growth-confirmation-20260506]]

## Source / Window / Freshness / Confidence

| 영역 | Source | Window | Freshness | Confidence |
|---|---|---|---|---:|
| Mode B 승인 | [[../gdn/paid-click-intent-production-receiver-deploy-approval-20260506]] | 2026-05-06 KST | 최신. 실행은 SSH blocker로 미완료 | 0.90 |
| Google click id 병목 | [[../gdn/google-ads-landing-clickid-analysis-20260506]] | 최근 7일 | BigQuery read-only 기준 최신 | 0.86 |
| Meta campaign mapping | 그로스파트 엑셀 + `data/meta_campaign_aliases.biocom.json` | 2026-05-04 16:10 KST 확인 | 최신 수동 확인. audit 일부 stale | 0.86 |
| 기존 Phase history | [[!total]] | 2026-05-04~2026-05-06 누적 | legacy. 실제 실행 순서는 이 문서가 우선 | 0.80 |

## 다음 할일

1. **TJ님: VM SSH 접근 복구**
   - 무엇을: `biocomkr_sns@34.64.104.94`에 현재 로컬 SSH key가 들어가 있는지 확인한다.
   - 왜: Mode B는 승인됐지만 Codex가 VM에 접속하지 못하면 receiver route 배포를 못 한다.
   - 성공 기준: Codex가 `ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes biocomkr_sns@34.64.104.94`로 접속해 `~/seo/repo`와 PM2 상태를 확인한다.
   - 실패 시: 새 key 등록 또는 대체 배포 경로를 제공한다.
   - 추천/자신감: 96%.

2. **Codex: SSH 복구 즉시 Mode B 실행**
   - 무엇을: route deploy -> TEST/negative smoke -> receiver-enabled GTM publish -> 24h/72h monitoring.
   - 왜: Google Ads confirmed purchase의 핵심 병목은 click id가 주문까지 이어지지 않는 것이다.
   - 성공 기준: production POST가 200, `would_store=false`, `would_send=false`, `no_platform_send_verified=true`, `live_candidate_after_approval=false`; 이후 receiver-enabled GTM publish 후 24h/72h error/2xx 관측.
   - 실패 시: route 4xx/5xx, CORS, GTM publish, payload reject 중 어디서 막혔는지 분리한다.
   - 승인 필요: 이미 Mode B 조건부 YES. 금지선 밖으로 나가면 중단.
   - 추천/자신감: 93%.

3. **Codex: split_required 캠페인 분리 로직 설계**
   - 무엇을: 그로스파트가 `분리`로 준 alias를 주문별 adset/ad id/date/URL Parameters로 나눌 규칙을 만든다.
   - 왜: 단일 campaign으로 강제 배정하면 Meta 캠페인별 ROAS가 왜곡된다.
   - 성공 기준: `split_required` alias는 캠페인 ROAS에 자동 합산되지 않고, ID 증거가 있는 주문만 campaign에 붙는다.
   - 승인 필요: NO, Green 설계/read-only.
   - 추천/자신감: 88%.
