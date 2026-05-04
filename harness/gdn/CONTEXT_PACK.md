# GDN Context Pack

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
목적: Google Ads/GDN ROAS 정합성 작업 시작 시 읽어야 할 문서와 데이터 위치를 고정한다
관련 문서: [[harness/gdn/README|GDN Harness]], [[harness/gdn/RULES|GDN Rules]], [[gdn/!gdnplan|GDN Plan]], [[gdn/google-ads-internal-roas-reconciliation|Google Ads 내부 ROAS 대조 결과]]

## 10초 요약

Google Ads/GDN 정합성의 primary source는 두 개다.

플랫폼 성과는 Google Ads API live를 본다. 내부 매출은 TJ 관리 Attribution VM의 `biocom_imweb` confirmed 원장을 본다.

두 원천의 숫자가 다르면 어느 하나를 바로 정답으로 보지 않는다. 전환 액션, label, campaign id, view-through, NPay return 누락, pending/canceled 상태를 분해한다.

## Required Context

공통 기준:

| 문서 | 역할 |
|---|---|
| [[harness/common/HARNESS_GUIDELINES|Growth Data Agent Harness Guidelines]] | Green / Yellow / Red Lane 기준 |
| [[harness/common/AUTONOMY_POLICY|Growth Data Agent Autonomy Policy]] | 자율 실행과 중단 기준 |
| [[harness/common/REPORTING_TEMPLATE|Growth Data Reporting Template]] | 보고 형식 |
| [[data/!datacheckplan|Data Check Plan]] | confirmed/pending/canceled, source 역할, freshness 기준 |
| [[docurule|docurule]] | 문서 작성 규칙과 wiki link 검증 |

GDN 기준:

| 문서 | 역할 |
|---|---|
| [[gdn/!gdnplan|Google Ads ROAS 정합성 체크 및 개선 계획]] | 정본 로드맵 |
| [[gdn/google-ads-internal-roas-reconciliation|Google Ads 내부 ROAS 대조 결과]] | 2026-04-25 API live와 내부 원장 대조 결과 |
| [[GA4/GA4검증|GA4 검증]] | purchase 중복, NPay 클릭 오염, GA4 이벤트 품질 근거 |
| [[footer/biocomimwebcode|biocom Imweb code]] | 아임웹 자동 Google Ads NPay trace 근거 |
| [[data/biocom-live-tracking-inventory-20260501|Biocom Live Tracking Inventory]] | live wrapper, session/eid, GTM/Imweb 상태 |
| [[tiktok/!tiktokroasplan|TikTok ROAS 정합성 프로젝트 로드맵]] | 플랫폼 ROAS와 내부 confirmed ROAS 분리 선례 |

## Source Map

| 질문 | Primary | Cross-check | Fallback | 주의 |
|---|---|---|---|---|
| Google Ads 플랫폼 비용/전환값 | Google Ads API `customer_id=2149990943` | Google Ads UI export CSV | 기존 `gdn/google-ads-internal-roas-reconciliation.md` | API 숫자는 당일 보정 가능 |
| 전환 액션 목록 | Google Ads API `conversion_action` | Google Ads UI 목표/전환 화면 | GTM/아임웹 label 기록 | label과 action name이 다를 수 있음 |
| 전환 액션별 성과 | Google Ads API `segments.conversion_action` | Google Ads UI segment export | result report | `Conv. value`와 `All conv. value` 분리 |
| 내부 confirmed 매출 | TJ 관리 Attribution VM `/api/attribution/ledger` | 운영DB 주문 상태 read-only | 로컬 개발 DB cache | 로컬 DB를 정본으로 쓰지 않음 |
| 주문 상태 | 운영DB `dashboard.public.tb_iamweb_users` 또는 Toss/Imweb source | TJ 관리 Attribution VM status | 로컬 SQLite | pending/canceled 분리 |
| GTM 전환 tag 상태 | GTM API published version | `gtmaudit/*.json` snapshot | footer/Imweb code | snapshot이 7일 이상 stale이면 판단 금지 |
| GA4 purchase 품질 | GA4 Data API / BigQuery 권한 가능 시 raw | `GA4/GA4검증.md` | Data API aggregate | GA4는 매출 정본이 아님 |

## Known IDs

| 항목 | 값 | 의미 |
|---|---|---|
| Google Ads customer | `214-999-0943` | 운영 계정 |
| Google Ads conversion ID | `AW-304339096` | biocom Google Ads tag id |
| Primary suspect action | `7130249515` | `구매완료` |
| Primary suspect label | `r0vuCKvy-8caEJixj5EB` | 아임웹 자동 NPay count label |
| Secondary suspect action | `7564830949` | `TechSol - NPAY구매 50739` |
| Secondary suspect label | `3yjICOXRmJccEJixj5EB` | GTM NPay click/value label |
| biocom GTM | `GTM-W2Z6PHN` | 바이오컴 정본 컨테이너 |
| biocom GA4 | `G-WJFXN5E2Q1` | 바이오컴 GA4 측정 ID |
| internal source | `biocom_imweb` | Attribution VM source |

## Baseline Snapshot

기준 시각: 2026-04-25 21:55 KST

| metric | value | source | confidence |
|---|---:|---|---|
| Google Ads spend | 25,610,287원 | Google Ads API live | high |
| Google Ads `Conv. value` | 129,954,697원 | Google Ads API live | high |
| Google Ads `All conv. value` | 214,724,902원 | Google Ads API live | high |
| Google platform ROAS | 5.07x | Google Ads API live | high |
| internal confirmed revenue | 7,582,720원 | TJ 관리 Attribution VM | medium-high |
| internal confirmed ROAS | 0.30x | Google Ads API + Attribution VM | medium-high |
| Primary NPay label value | 129,954,631원 | Google Ads `segments.conversion_action` | high |

## Freshness Rule

| source | fresh 기준 | stale 처리 |
|---|---|---|
| Google Ads API | 같은 작업일 기준 live query | 24시간 이상이면 re-query |
| Attribution VM | `latestLoggedAt`와 row count 기록 | 24시간 이상이면 `medium` 이하 |
| GTM live version | 7일 이내 snapshot | tracking 판단 hard fail |
| GA4/BigQuery | latest event date/table 기록 | 권한 없으면 `unknown`, 정본 판단 금지 |
| 문서 숫자 | 최신 report와 일치 | stale-number warning |

## Output 위치

| 산출물 | 위치 |
|---|---|
| 정본 계획 | `gdn/!gdnplan.md` |
| 결과보고서 | `gdn/google-ads-*.md` |
| 하네스 실행 로그 | `harness/gdn/*.md` 또는 `data/google-ads-*.yaml` |
| read-only script | `backend/scripts/google-ads-*.ts` |
| dashboard code | `backend/src/routes/googleAds.ts`, `frontend/src/app/ads/google/page.tsx` |

## Block 처리

| block | 처리 |
|---|---|
| Google Ads API 권한 실패 | CSV fallback 또는 기존 snapshot 사용. confidence 낮춤 |
| Attribution VM 실패 | 운영DB/로컬 cache로 주문 사실만 검산. 내부 ROAS는 `blocked` |
| GTM read-only 실패 | 최신 tracking 판단 금지. 기존 snapshot은 stale 표시 |
| GA4 BigQuery 권한 없음 | GA4 raw guard를 `unknown`으로 둠 |
| campaign id mismatch | 다른 계정/과거 캠페인/landing URL 파라미터 가설로 분리 |
