# 월별 유입 채널 매출 정합성 현재 정본

작성 시각: 2026-05-06 23:46 KST
기준일: 2026-05-06
상태: active canonical
Owner: total / attribution
Supersedes: [[!total|기존 Phase 순서 정본]]
Next document: Mode B GTM publish 결과 문서 또는 minimal paid_click_intent ledger write 승인안
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
  lane: Green 문서 정본 업데이트 + Red Mode B 승인 범위 내 receiver 운영 배포 결과 기록
  allowed_actions:
    - 실제 개발 순서 기준 정본 문서 업데이트
    - 운영 VM SSH 접근 경로 검증
    - no-write receiver route 운영 배포
    - TEST/negative smoke
    - receiver-enabled GTM publish 준비
  forbidden_actions:
    - Google Ads 전환 변경
    - conversion upload
    - confirmed purchase dispatcher 운영 전송
    - 운영 DB/ledger write
    - GA4/Meta/Google Ads/TikTok/Naver 전환 전송
  source_window_freshness_confidence:
    source: "기존 total/!total.md, gdn/Mode B 승인 문서, 운영 VM SSH/curl smoke, 로컬 코드"
    window: "2026-05-04~2026-05-06 KST"
    freshness: "backend receiver route는 운영 배포 및 smoke 통과. GTM receiver-enabled publish는 아직 미실행"
    confidence: 0.91
```

## 10초 결론

이 문서가 현재 정본이다. 기존 [[!total]]은 작업 영역별 역사 문서로 남기고, 실제 개발 순서는 이 문서의 `Active Action Board`를 따른다.

현재 P0는 `paid_click_intent Mode B`다. 뜻은 Google 광고 클릭 ID(`gclid/gbraid/wbraid`)가 랜딩에서 저장되고 checkout/NPay intent까지 이어지는지 운영에서 검증하는 묶음이다.

TJ님은 Mode B를 조건부 YES로 승인했다. Codex는 운영 VM 직접 계정(`biocomkr_sns`) SSH 실패를 우회해 `taejun` 계정 경유로 backend no-write receiver route를 배포했고, production TEST/negative smoke를 통과시켰다. 다음 병목은 receiver-enabled GTM publish와 24h/72h 모니터링이다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase4 | [[#Phase4-Sprint6]] | paid_click_intent 수집 개선 | TJ + Codex | 82% / 45% | [[#Phase4-Sprint6\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | 채널 배정과 캠페인 매핑 | Codex | 70% / 60% | [[#Phase2-Sprint4\|이동]] |
| Phase1 | [[#Phase1-Sprint1]] | 월별 주문·결제 정본 장부 | Codex | 86% / 78% | [[#Phase1-Sprint1\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | 플랫폼 ROAS 분리와 guard | Codex | 65% / 42% | [[#Phase3-Sprint5\|이동]] |
| Phase5 | [[#Phase5-Sprint8]] | `/total` 운영 화면 | Claude Code + Codex | 25% / 0% | [[#Phase5-Sprint8\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase4-Sprint6]] | backend 완료 / GTM 대기 | Codex | receiver-enabled GTM publish를 실행하고 24h/72h 모니터링을 시작한다 | backend receiver만 열려 있으면 실제 브라우저에서 Google click id가 checkout/NPay intent까지 이어지는지 아직 모른다 | 현재 GTM live version 확인, fresh workspace 사용, receiver URL 포함 tag/trigger diff 기록, publish 후 2xx/error/storage 관측 | [[#Phase4-Sprint6]] / [[../gdn/paid-click-intent-production-receiver-deploy-result-20260506]] | YES 범위 안. Mode B 조건부 승인됨 |
| 2 | [[#Phase4-Sprint6]] | 진행 가능 | Codex | 운영 VM SSH 접근 복구 런북을 기준 문서로 고정한다 | 직접 `biocomkr_sns` 로그인이 막혀도 운영 배포가 멈추지 않게 해야 한다 | `taejun@34.64.104.94` 경유와 직접 계정 key 복구 절차를 분리해 문서화한다 | [[#Phase4-Sprint6]] / [[../capivm/vm-ssh-access-recovery-runbook-20260506]] | NO |
| 3 | [[#Phase2-Sprint4]] | 진행 가능 | Codex | 그로스파트가 `분리`로 준 Meta alias를 주문별 증거 기준으로 나누는 규칙을 만든다 | split_required alias를 단일 campaign에 강제 배정하면 Meta 캠페인별 ROAS가 왜곡된다 | 주문별 adset/ad id/date/URL Parameters가 있는 건만 campaign에 붙이고, 나머지는 quarantine 유지 | [[#Phase2-Sprint4]] / [[../meta/campaign-mapping-growth-confirmation-20260506]] | NO, read-only 설계 |
| 4 | [[#Phase4-Sprint6]] | Mode B 이후 | Codex | minimal paid_click_intent ledger write 승인안을 작성한다 | no-write receiver는 payload 검증일 뿐 주문 원장 fill-rate를 직접 개선하지 않는다 | 24h/72h 결과를 보고 저장 필드, 보관기간, 마스킹, 삭제 기준을 승인안으로 분리한다 | [[#Phase4-Sprint6]] / [[../ontology/!ontology]] | YES, 운영 write |

## 현재 기준

| 항목 | 현재 기준 |
|---|---|
| 정본 문서 | [[!total-current]] |
| 기존 문서 역할 | [[!total]]은 old/legacy phase history |
| 현재 P0 | paid_click_intent Mode B |
| Mode B 승인 상태 | 조건부 YES |
| Mode B 실제 실행 상태 | backend receiver route 배포 및 smoke 통과. GTM publish 미실행 |
| 운영 VM 접근 | 직접 `biocomkr_sns` SSH는 실패. `taejun` 경유 후 `sudo -u biocomkr_sns` 가능 |
| 운영 receiver | `POST /api/attribution/paid-click-intent/no-send` 200 확인 |
| 캠페인 매핑 최신 입력 | `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx` |
| 외부 전송 상태 | 0건. GA4/Meta/Google Ads/TikTok/Naver 전송 없음 |
| 운영 DB/ledger write | 0건. 금지 유지 |

## 실제 개발 순서

Phase 번호는 과거 작업 영역을 설명하는 이름이다. 실제 개발은 아래 순서로 진행한다.

1. **P0: paid_click_intent Mode B 완료**
   - 목적: Google Ads 랜딩에 이미 있는 click id가 checkout/NPay intent/confirmed purchase 후보까지 끊기지 않게 만드는 선행 작업.
   - 현재: backend no-write receiver route 운영 배포와 smoke는 통과. GTM receiver-enabled publish가 남았다.

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
| P0 | active | Phase4-Sprint6 | paid_click_intent Mode B | Google click id가 주문까지 사라지는 병목을 줄여야 Google Ads confirmed purchase가 가능하다 | GTM live version 확인 -> fresh workspace -> receiver-enabled publish -> 24h/72h monitoring | Codex | Mode B 조건부 YES 범위 안 | [[../gdn/paid-click-intent-production-receiver-deploy-result-20260506]] |
| P0 | done_operational_backend | Phase4-Sprint6 | no-write receiver route 운영 배포 | GTM receiver 호출 전에 production POST 404를 제거해야 한다 | GTM publish 전 final smoke 결과를 첨부한다 | Codex | 완료 | [[../gdn/paid-click-intent-production-receiver-deploy-result-20260506]] |
| P0 | done | Phase2-Sprint4 | Meta 캠페인 수동 매핑 반영 | wrong campaign ROAS를 줄이고 split_required alias를 자동 확정하지 않게 해야 한다 | split_required를 주문별 adset/ad id/date로 나누는 로직 설계 | Codex | NO | [[../meta/campaign-mapping-growth-confirmation-20260506]] |
| P1 | next_after_mode_b | Phase4-Sprint6 | minimal paid_click_intent ledger write 승인안 | no-write만으로는 주문 원장 fill-rate가 실제로 개선되지 않는다 | 24h/72h receiver validation PASS 후 저장 필드/보관기간/마스킹 승인안 작성 | Codex | YES | [[../ontology/!ontology]] |
| P1 | waiting | Phase4-Sprint6 | confirmed_purchase no-send 재실행 | 실제 결제완료 주문만 purchase 후보로 남겨야 Google/GA4/Meta 전송 전 중복과 누락을 볼 수 있다 | click id 저장 근거가 쌓인 뒤 dry-run 재실행 | Codex | NO, read-only | [[../gdn/confirmed-purchase-no-send-pipeline-contract-20260505]] |
| P2 | parked | Phase4-Sprint6 | Google Ads BI confirmed_purchase | Google Ads가 NPay click/count를 구매로 학습하지 않게 바꿔야 한다 | no-send 후보와 click id 보존률이 충분할 때 Red 승인안 재검토 | TJ + Codex | YES | [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]] |
| P2 | parked | Phase2-Sprint4 | NPay rail post-publish 재분류 | NPay는 결제수단이지 paid_naver 유입이 아니므로 실제 source가 있는 주문만 채널 배정해야 한다 | Mode B 이후 NPay intent/paid_click_intent 연결률 재검토 | Codex | NO | [[../naver/npay-rail-source-gap-20260506]] |
| P3 | parked | Phase5-Sprint8 | `/total` 프론트엔드 | 숫자 정본이 흔들리면 화면부터 만들면 혼란만 커진다 | backend source/assignment 안정 후 Claude Code handoff 업데이트 | Claude Code | NO | [[total-frontend-handoff-20260504]] |

## Approval Queue

### 1. Mode B: receiver route deploy -> smoke -> GTM publish -> monitoring

상태: TJ님 조건부 YES. backend receiver route 배포와 TEST/negative smoke는 완료. receiver-enabled GTM publish는 남았다.

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

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-06 KST | paid_click_intent Preview/receiver 검증 | 임시 receiver에서 `gclid/gbraid/wbraid` 3종 케이스 통과 |
| 2026-05-06 KST | Google Ads landing-session click id 분석 | 최근 7일 Google Ads 증거 세션 6,879개 중 6,724개 click id 보유. 보존률 97.75% |
| 2026-05-06 KST | production receiver POST smoke | 운영 배포 전 `att.ainativeos.net` POST 404 확인. receiver route 필요성 확정 |
| 2026-05-06 KST | 운영 VM 접근 경로 복구 | 직접 `biocomkr_sns`는 실패하지만 `taejun` 경유 `sudo -u biocomkr_sns`로 repo/PM2 접근 가능 확인 |
| 2026-05-06 KST | backend no-write receiver route 운영 배포 | `seo-backend` 재시작. `POST /api/attribution/paid-click-intent/no-send` 200 확인 |
| 2026-05-06 KST | production TEST/negative smoke | TEST click id 200, click id 없음/value/order/PII/internal/oversized 차단 확인 |
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
| Mode B backend 실행 | [[../gdn/paid-click-intent-production-receiver-deploy-result-20260506]] | 2026-05-06 KST | 운영 backend 배포와 smoke 최신 | 0.93 |
| SSH 접근 경로 | [[../capivm/vm-ssh-access-recovery-runbook-20260506]] | 2026-05-06 KST | `taejun` 경유 접근 확인. 직접 `biocomkr_sns`는 미복구 | 0.92 |
| Google click id 병목 | [[../gdn/google-ads-landing-clickid-analysis-20260506]] | 최근 7일 | BigQuery read-only 기준 최신 | 0.86 |
| Meta campaign mapping | 그로스파트 엑셀 + `data/meta_campaign_aliases.biocom.json` | 2026-05-04 16:10 KST 확인 | 최신 수동 확인. audit 일부 stale | 0.86 |
| 기존 Phase history | [[!total]] | 2026-05-04~2026-05-06 누적 | legacy. 실제 실행 순서는 이 문서가 우선 | 0.80 |

#### Phase4-Sprint6

**이름**: paid_click_intent 수집 개선

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Google 광고 클릭 ID가 랜딩에서 사라지지 않고 checkout/NPay intent/confirmed purchase 후보까지 이어지게 만드는 것이다. Google Ads confirmed purchase를 만들려면 먼저 `gclid/gbraid/wbraid`가 주문 후보에 남아야 한다.

완료한 것:

- Google Ads 랜딩 세션에는 click id가 대부분 남아 있음을 BigQuery로 확인했다. 최근 7일 기준 6,879개 중 6,724개, 97.75%다.
- 운영 결제완료 주문 기준 click id가 5/623건 수준으로 낮아지는 병목을 분리했다.
- `att.ainativeos.net` backend에 no-write receiver route를 배포했다.
- TEST/negative smoke를 통과했다.

남은 것:

- receiver-enabled GTM publish.
- publish 후 24h/72h 모니터링.
- 결과가 안정적이면 minimal paid_click_intent ledger write 승인안 작성.

금지선:

- Google Ads 전환 변경과 conversion upload 금지.
- GA4/Meta/Google Ads/TikTok/Naver 전송 금지.
- 운영 DB/ledger write 금지.

#### Phase2-Sprint4

**이름**: 채널 배정과 캠페인 매핑

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 내부 confirmed 매출을 Meta, Google, TikTok, Naver, Organic, Direct, Unknown으로 한 번만 배정하는 것이다. 결제수단과 유입 채널을 섞지 않는 것이 핵심이다.

완료한 것:

- 그로스파트 Meta 캠페인 매핑 엑셀을 반영했다.
- 확정 alias, split_required alias, exclude alias를 분리했다.
- NPay는 결제수단이지 `paid_naver` 증거가 아니라는 원칙을 유지했다.

남은 것:

- split_required alias를 주문별 adset/ad id/date/URL Parameters로 나누는 규칙 설계.
- NPay post-publish 주문을 matched / ambiguous / purchase_without_intent로 재분류.

#### Phase1-Sprint1

**이름**: 월별 주문·결제 정본 장부

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 광고 플랫폼 값이 아니라 아임웹 주문, 토스 결제, NPay 실제 결제완료, 취소/환불 보정으로 월별 내부 확정 순매출을 만드는 것이다.

완료한 것:

- 월별 spine dry-run 계약과 join key matrix를 만들었다.
- 2026년 4월 biocom 1차 net 후보를 계산했다.
- 운영 source와 로컬 stale source를 분리했다.

남은 것:

- source freshness가 warn일 때 화면과 보고서에 provisional 표시.
- Phase2 assignment 결과와 합계 검증.

#### Phase3-Sprint5

**이름**: 플랫폼 ROAS 분리와 guard

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Google Ads, Meta, GA4가 주장하는 플랫폼 전환값과 내부 confirmed 매출을 섞지 않는 것이다.

완료한 것:

- Google Ads `구매완료` primary가 NPay count/click 계열 value를 크게 만들고 있음을 분리했다.
- Meta 캠페인 mapping에서 강제 배정 위험을 줄였다.
- ontology-lite로 `PlatformConversionClaim != InternalConfirmedRevenue` 원칙을 고정했다.

남은 것:

- Google Ads BI confirmed_purchase 실행안은 click id 보존률 개선 후 재검토.
- 플랫폼 전송 전 no-send guard와 중복 방지 결과를 다시 확인.

#### Phase5-Sprint8

**이름**: `/total` 운영 화면

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 운영자가 월별 전체 매출, 채널별 내부 confirmed ROAS, 플랫폼 참고 ROAS, unknown/quarantine를 한 화면에서 보는 것이다.

현재는 parked다. 이유는 데이터 의미가 먼저 안정돼야 하기 때문이다.

재개 조건:

- Mode B 24h/72h 모니터링 결과.
- minimal paid_click_intent ledger write 여부 결정.
- Phase2 channel assignment rule 안정화.
