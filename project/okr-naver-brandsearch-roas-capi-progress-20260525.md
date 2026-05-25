# Naver 브랜드검색 / ROAS evidence / CAPI 안정화 OKR 진척률

작성 시각: 2026-05-25 14:09 KST  
기준일: 2026-05-25  
문서 성격: 현재 OKR 진척률과 다음 액션 정리  
Site: biocom, thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
  required_context_docs:
    - project/coffee-naver-brandsearch-vm-deploy-result-20260525.md
    - project/capi-auto-sync-reenable-result-20260525.md
  lane: Green_documentation_and_read_only_status
  allowed_actions:
    - OKR_progress_documentation
    - read_only_status_summary
    - local_test_result_summary
  forbidden_actions:
    - VM_Cloud_deploy
    - VM_Cloud_SQLite_manual_write
    - operational_DB_write
    - GTM_publish
    - platform_manual_send
    - ad_platform_setting_change
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      - VM Cloud site_landing_ledger read-only
      - VM Cloud health / Meta CAPI log API
      - local backend tests
    window: 2026-05-25 KST current state
    freshness: same-turn for smoke evidence, same-day for deployment documents
    confidence: 0.89
```

## 10초 요약

이 프로젝트의 목표는 더클린커피와 바이오컴의 유입, 결제, 전환 전송을 분리해서 ROAS 판단에 쓸 수 있게 만드는 것이다.

현재 CAPI 자동 전송은 안정 상태다. 네이버 브랜드검색 분리도 배포됐지만, 바이오컴 실제 유입 smoke에서 이전 Google click id가 남아 있을 때 브랜드검색 UTM이 `paid_search`로 오염되는 edge case가 발견됐다.

정책은 `네이버 우선`이나 `구글 우선`이 아니다. 마지막 유입을 가장 잘 설명하는 현재 랜딩의 명시 신호를 우선하고, 이전 touch에서 보존된 click id는 보조 evidence로 둔다.

## 핵심 원칙

### Last-touch 분류 원칙

유입 분류는 플랫폼 우선순위가 아니라 마지막 유입 기준이다.

- 현재 랜딩 URL 또는 현재 랜딩 payload의 UTM이 Naver 브랜드검색이면 `naver_brandsearch`로 분류한다.
- 현재 랜딩 URL에 Google click id 또는 Google paid UTM이 있고 Naver 브랜드검색 marker가 없으면 `paid_search`로 분류한다.
- 이전 touch에서 저장소에 남은 Google click id는 현재 Naver 브랜드검색 UTM을 덮어쓰면 안 된다.
- 반대로 이전 Naver 브랜드검색 뒤에 Google 광고로 다시 들어온 경우는 Google paid search가 마지막 유입이므로 `paid_search`가 맞다.
- 현재 신호와 저장 신호가 섞이는 케이스는 `click_id_source` 또는 `utm_source_scope` 같은 source freshness metadata가 필요하다.

## OKR 진척률

### Objective 1. 광고/검색 유입을 예산 판단 가능한 라인으로 분리한다

목표 의미: 브랜드검색, 일반 유료검색, 오가닉 검색을 섞지 않고 예산 판단에 맞는 라인으로 나눈다.

| KR | 설명 | 현재 진척률 | 근거 | 100% 조건 |
|---|---|---:|---|---|
| KR1 | 네이버 브랜드검색을 `naver_brandsearch` 별도 라인으로 저장한다 | 75% | 더클린커피/바이오컴 기본 분류 배포 완료. 바이오컴 실제 smoke에서 stale Google click id edge case 발견 | 현재 Naver 브랜드검색 UTM이 있으면 이전 click id와 충돌해도 `naver_brandsearch`로 저장되고, 새 smoke에서 확인 |
| KR2 | 파워링크/일반 유료검색은 `paid_search`, 오가닉은 별도 후보로 둔다 | 90% | powerlink는 `paid_search`, Naver organic은 organic/reference 후보로 유지하는 테스트 PASS | Naver paid/brand/organic 별 분류가 24h live row에서 모두 정상 |
| KR3 | 더클린커피와 바이오컴에 같은 분류 원칙을 적용한다 | 80% | 공용 classifier 구조로 두 site 모두 적용. 바이오컴 PC 브랜드검색 edge case만 남음 | 두 site 모두 실제 신규 브랜드검색 유입이 별도 라인으로 확인 |

### Objective 2. 주문/결제 정본과 광고 evidence를 섞지 않는다

목표 의미: 구매완료 매출과 광고 클릭 evidence를 분리해서, 예산 판단용 ROAS와 참고 지표가 섞이지 않게 한다.

| KR | 설명 | 현재 진척률 | 근거 | 100% 조건 |
|---|---|---:|---|---|
| KR1 | 결제완료 매출은 실제 결제완료 주문 기준으로만 본다 | 85% | summary에서 actual confirmed source와 legacy complete_time source가 분리됨 | 주요 ROAS 화면과 문서가 actual confirmed를 primary로 통일 |
| KR2 | 가상계좌 미입금은 구매완료가 아니라 대기/미입금 이벤트로 분리한다 | 55% | 가상계좌 smoke와 event name 개선 설계 완료. Purchase Guard v3.2는 후순위 | 미입금 이벤트명이 구매완료와 분리되고 Pixel/보고서에서 혼동 없음 |
| KR3 | 브랜드검색 ROAS는 광고비 join 확인 후 예산 판단에 쓴다 | 40% | 유입 분류 라인은 생겼지만 Naver 브랜드검색 비용 join은 미완료 | 브랜드검색 비용, 유입, 결제완료 주문이 same-window로 연결 |

### Objective 3. Meta CAPI 자동 전송을 안정 상태로 유지한다

목표 의미: Meta에 실제 구매완료 전환을 자동으로 보내는 서버 전송이 실패나 중복 없이 돌아가게 한다.

| KR | 설명 | 현재 진척률 | 근거 | 100% 조건 |
|---|---|---:|---|---|
| KR1 | CAPI auto-sync ON, 최근 24시간 실패 0건 유지 | 95% | 최근 24시간 72건 성공, 실패 0건 | 24h/72h 모두 실패 0건 |
| KR2 | 중복 event_id / 중복 주문-event 조합 0건 유지 | 95% | 최근 24시간 중복 0건 | 72h 중복 0건 유지 |
| KR3 | 수동 전송 없이 자동 로그로 상태 확인 가능 | 90% | API와 `backend/logs/meta-capi-sends.jsonl`로 확인 가능 | PM2/log/API 경로가 문서에 완전히 정리 |

### Objective 4. 운영 변경은 승인선 안에서만 진행한다

목표 의미: 추적/전환/광고 관련 변경은 빠르게 하되, 위험한 운영 변경은 승인선 안에서만 실행한다.

| KR | 설명 | 현재 진척률 | 근거 | 100% 조건 |
|---|---|---:|---|---|
| KR1 | VM Cloud 배포는 백업/검증/restart/post-smoke까지 기록한다 | 95% | 브랜드검색 classifier 배포와 CAPI 재개 결과 문서화 완료 | 이번 edge case 재배포까지 같은 형식으로 닫힘 |
| KR2 | GTM publish, platform send, DB write는 승인 범위 밖에서 중지한다 | 95% | 이번 확인은 read-only와 로컬 테스트만 수행 | 다음 배포/반영도 승인선 준수 |
| KR3 | 관련 코드/문서만 선별 커밋한다 | 45% | 변경은 쌓였고 검증 일부 완료. 커밋/푸시는 아직 미완료 | 이번 classifier patch, 결과 문서, 승인 문서만 선별 커밋 |

## 현재 확인된 최신 evidence

### 바이오컴 브랜드검색 smoke

- 기준 시각: 2026-05-25 14:00 KST
- Source: VM Cloud SQLite `site_landing_ledger`
- Site: biocom
- Window: 최근 30분~90분 read-only
- 확인된 row 시각: 2026-05-25 13:59:15 KST
- UTM marker: `naverbrandsearch_biocom_pc_mainhome`
- 현재 배포본 분류: `paid_search`
- 원인: 이전 Google click id hash가 남아 있어 click id 우선 규칙이 먼저 적용됨
- 판단: 수집은 됐고, last-touch 분류 우선순위 보강이 필요하다

### CAPI 상태

- 기준 시각: 2026-05-25 13:47~13:50 KST
- Source: VM Cloud health / Meta CAPI log API
- CAPI auto-sync: ON
- 최근 24시간 전송: 72건
- 성공: 72건
- 실패: 0건
- 중복 event id: 0건

## 다음 할일

### Auto Green

1. 로컬 classifier patch 검증을 유지한다.
   - 무엇: 현재 landing UTM과 저장 click id가 충돌할 때 last-touch 원칙을 테스트로 고정한다.
   - 왜: 브랜드검색과 Google paid search ROAS가 서로 오염되지 않게 하기 위해서다.
   - 어떻게: `backend/tests/site-landing-channel-classifier.test.ts`의 충돌 케이스를 유지한다.
   - 검증: 관련 테스트와 typecheck PASS.
   - 의존성: 없음.

2. VM Cloud 재배포 승인안을 작성한다.
   - 무엇: classifier patch를 VM Cloud에 반영하기 위한 배포 승인안을 만든다.
   - 왜: 실제 바이오컴 유입이 현재 배포본에서 잘못 분류됐다.
   - 어떻게: 백업, 파일 반영, typecheck, test, build, restart, post-smoke, rollback을 문서화한다.
   - 검증: 승인안 문서와 harness preflight PASS.
   - 의존성: 로컬 patch 검증.

### Approval Needed

1. VM Cloud classifier patch 배포.
   - 무엇: last-touch 분류 보강을 VM Cloud backend에 반영한다.
   - 왜: 신규 Naver 브랜드검색 유입이 Google paid search로 오염되는 edge case를 막기 위해서다.
   - 승인 이유: VM Cloud backend restart가 필요하다.
   - 성공 기준: VM classifier one-off와 신규 smoke row가 `naver_brandsearch`로 확인된다.

### Blocked/Parked

1. 과거 row backfill.
   - 이유: 이번 작업은 신규 분류 보강이지 과거 원장 수동 수정이 아니다.
   - 필요 조건: backfill 대상 window, dry-run, apply 승인.

2. Naver 브랜드검색 비용 join.
   - 이유: 브랜드검색 ROAS를 예산 판단값으로 쓰려면 비용 source와 주문 source의 same-window join이 필요하다.
   - 필요 조건: Naver Ads cost source freshness 확인.

## 하지 않은 것

- VM Cloud deploy: 0건
- VM Cloud SQLite 수동 write: 0건
- 운영DB write: 0건
- GTM publish: 0건
- 수동 Meta CAPI send: 0건
- 광고 플랫폼 설정 변경: 0건
- raw identifier 출력: 0건

