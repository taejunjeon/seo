# Coffee Data Harness

작성 시각: 2026-05-01 15:23 KST  
상태: v0 기준판  
범위: 더클린커피 GA4/Imweb/NPay/Excel/ROAS 정합성 작업을 위한 문서형 agent harness  
관련 문서: [[data/!coffeedata|더클린커피 데이터 정합성 프로젝트]], [[docs/agent-harness/growth-data-harness-v0|Growth Data Harness v0]], [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/coffee-data/CONTEXT_PACK|Coffee Context Pack]], [[harness/coffee-data/RULES|Coffee Rules]], [[harness/coffee-data/VERIFY|Coffee Verify]], [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]], [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory]], [[harness/coffee-data/EVAL_LOG_SCHEMA|Coffee Eval Log Schema]], [[harness/coffee-data/LESSONS|Coffee Lessons]]
Primary source: Imweb v2 API `IMWEB_API_KEY_COFFEE`, GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178`, 더클린커피 엑셀 `data/coffee/*.xlsx`
Freshness: 2026-05-01 14:43 KST report 기준
Confidence: 88%

## 10초 요약

Coffee Data Harness는 더클린커피 정합성 작업을 매번 같은 기준으로 실행하기 위한 작업장이다.

기본값은 `read-only`, `no-send`, `no-write`, `no-deploy`다. 지금 단계의 목표는 전환을 보내는 것이 아니라 GA4 BigQuery와 실제 주문 원장이 얼마나 맞는지 확인하는 것이다.

biocom NPay recovery에서 만든 규칙을 그대로 복사하지 않는다. 더클린커피는 GA4 BigQuery 접근이 열려 있고 Imweb v2 API와 엑셀 자산이 있으므로, `BigQuery-first + Imweb actual order + Excel backfill` 구조로 분리한다.

## 언제 쓰는가

아래 작업을 할 때 이 하네스를 먼저 읽는다.

1. 더클린커피 GA4 purchase와 실제 주문 원장을 대조한다.
2. 더클린커피 NPay actual order와 GA4 NPay형 purchase를 비교한다.
3. 더클린커피 엑셀 주문/결제 파일을 dry-run으로 검증한다.
4. 더클린커피 Meta/TikTok/ROAS 정합성을 read-only로 비교한다.
5. 더클린커피 NPay intent 수집 또는 전환 복구를 설계한다.

## 기본 금지선

| 금지 | 이유 |
|---|---|
| 운영 DB write | 주문 원장 오염 |
| local DB actual import apply | dry-run 검증 전 과거 원장 오염 |
| GA4 MP 전송 | 중복/오매칭 purchase 위험 |
| Meta CAPI 전송 | 광고 최적화 오염 |
| TikTok Events API 전송 | 식별값 확인 전 ROAS 오염 |
| Google Ads conversion 전송 | 입찰 학습 오염 |
| GTM publish | live tracking 변경 |
| 운영 endpoint 배포 | 승인 없는 운영 변경 |

## 허용 범위

| 범위 | 허용 |
|---|---|
| 문서 | `data/!coffeedata.md`, `data/coffee-*.md`, `harness/coffee-data/*.md` 작성/수정 |
| read-only query | BigQuery 조회, Imweb v2 API 조회, 운영 DB read-only 조회 |
| dry-run | 엑셀 import dry-run, NPay matching dry-run, GA4 robust guard |
| 코드 | read-only report script, auditor helper, schema 초안 |
| 검증 | typecheck, wiki link validation, no-send/no-write grep |

## Phase Map

| Phase | 이름 | 목표 | 완료 조건 |
|---|---|---|---|
| Phase1 | Source inventory | 사용할 데이터 위치와 freshness를 고정 | primary/cross-check/fallback 표 완성 |
| Phase2 | GA4/order matching | GA4 purchase와 실제 주문 원장을 read-only로 비교 | match/ambiguous/missing 분리 |
| Phase2.5 | NPay order split | Imweb NPay actual과 GA4 NPay형 이벤트를 분해 | assigned/unassigned/robust guard 결과 |
| Phase3 | Future intent design | 과거 복구보다 미래 클릭/결제 분리 장부 설계 | preview-only 설계안 |
| Phase4 | ROAS comparison | Meta/TikTok/GA4/주문 window 정렬 | no-send read-only ROAS 표 |
| Phase5 | Approval package | 실제 전송/배포가 필요할 때 승인안 작성 | YES/NO 가능한 문서 |

## v0 Files

| 파일 | 용도 |
|---|---|
| [[harness/coffee-data/README|README.md]] | 하네스 목적과 금지선 |
| [[harness/coffee-data/CONTEXT_PACK|CONTEXT_PACK.md]] | 읽어야 할 문서, 최신 숫자, 데이터 위치 |
| [[harness/coffee-data/RULES|RULES.md]] | source, matching, amount, BigQuery guard 규칙 |
| [[harness/coffee-data/VERIFY|VERIFY.md]] | 검증 명령과 auditor verdict 형식 |
| [[harness/coffee-data/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST.md]] | 종료 전 hard/soft fail 체크 |
| [[harness/coffee-data/LIVE_TAG_INVENTORY|LIVE_TAG_INVENTORY.md]] | tracking/wrapper/intent/eid 작업 직전 site live console / GTM / wrapper / session·eid / server send 체크 (preflight). snapshot 7일 stale 시 AUDITOR hard fail |
| [[harness/coffee-data/EVAL_LOG_SCHEMA|EVAL_LOG_SCHEMA.md]] | run log와 row schema |
| [[harness/coffee-data/LESSONS|LESSONS.md]] | coffee 예외와 규칙 후보 |

## 현재 기준 숫자

2026-05-01 14:43 KST 기준 더클린커피 read-only 결과다.

| 항목 | 값 |
|---|---:|
| Imweb orders | 113건 / 4,699,767원 |
| Imweb NPay actual | 60건 / 2,462,300원 |
| GA4 purchases | 108건 / 4,454,524원 |
| GA4 NPay pattern | 58건 / 2,359,300원 |
| one-to-one assigned | 42건 |
| one-to-one unassigned actual | 18건 / 641,300원 |
| one-to-one unassigned GA4 | 16건 / 608,900원 |
| unassigned actual order/channel guard | 36/36 robust_absent |

## 작업 순서

1. [[harness/coffee-data/CONTEXT_PACK|CONTEXT_PACK]]에서 source/window/freshness를 확인한다.
2. [[harness/coffee-data/RULES|RULES]]에서 primary source와 matching 기준을 확인한다.
3. **tracking/wrapper/intent/eid 작업이라면** [[harness/coffee-data/LIVE_TAG_INVENTORY|LIVE_TAG_INVENTORY]] 의 최신 snapshot (`data/coffee-live-tracking-inventory-*.md`) 이 7일 이내인지 확인하고, 아니면 site live console 에서 채운 뒤 진행한다.
4. read-only script 또는 쿼리를 실행한다.
5. 산출물을 `data/coffee-*.md`에 저장한다.
6. [[harness/coffee-data/VERIFY|VERIFY]]를 실행한다.
7. [[harness/coffee-data/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]]로 verdict를 낸다.
8. 새 예외는 [[harness/coffee-data/LESSONS|LESSONS]]에 남긴다.
9. `data/!coffeedata.md`의 다음 할일과 Phase/Sprint 숫자를 갱신한다.

## 현재 판단

더클린커피는 지금 Phase2/Phase4를 계속 read-only로 진행하는 것이 맞다.

이유는 세 가지다.

1. GA4 BigQuery가 열려 있어 `already_in_ga4` guard를 직접 확인할 수 있다.
2. Imweb v2 API로 NPay actual order가 확인된다.
3. 과거 GA4 NPay형 transaction_id가 synthetic 값이라 과거분 자동 복구 전송은 아직 위험하다.

따라서 다음 단계는 실제 전송이 아니라 `unassigned actual 18건 처리 방침`, `ambiguous 29건 종료/축소 판단`, `future coffee intent preview 설계`다.
