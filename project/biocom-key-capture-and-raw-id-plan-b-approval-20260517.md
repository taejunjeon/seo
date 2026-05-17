# 바이오컴 Key Capture 보강안과 Raw-id Plan B 승인안

작성 시각: 2026-05-17 17:45 KST
기준일: 2026-05-17
문서 성격: Green 설계 + Yellow/Red 승인안
대상 사이트: biocom

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md
  lane: Green design, Yellow limited capture smoke, Red raw-id debug if approved
  allowed_actions:
    - read_only_gap_analysis
    - hash_only_capture_design
    - approval_packet
  forbidden_actions:
    - operating_db_write
    - vm_cloud_schema_migration_without_approval
    - gtm_publish
    - platform_send_or_upload
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite safe hash + GA4 BigQuery daily export
    window: rolling latest 7d
    freshness: queried 2026-05-17 17:44 KST
    confidence: high for gap existence, medium_low for row-level behavior conclusion
```

## 10초 요약

바이오컴은 GA4와 VM Cloud를 같은 사람/세션으로 붙이는 안전한 키가 아직 약하다.
현재 safe hash 기준으로 구매 세션은 112/380건, 결제 흐름 이탈 세션은 205/715건만 GA4와 이어졌다.
따라서 바이오컴은 지금 바로 “구매자와 이탈자의 평균 체류시간 차이”를 예산 판단에 쓰면 안 된다.
먼저 landing -> checkout -> payment_success까지 같은 safe key가 이어지도록 key capture를 보강해야 한다.
그래도 특정 row가 닫히지 않을 때만 raw-id Plan B를 승인받아 제한 실행한다.

## 현재 숫자

- source: VM Cloud SQLite + GA4 BigQuery daily export
- window: rolling latest 7d
- site: biocom
- freshness: 2026-05-17 17:44 KST runtime query
- confidence: key gap 판단 high, 행동 비교 판단 medium_low

| 구분 | VM Cloud safe session | GA4 joined | join rate | 판단 |
|---|---:|---:|---:|---|
| 실제 결제완료 세션 | 380 | 112 | 29.47% | 행동 비교에 부족 |
| 결제 흐름 이탈 세션 | 715 | 205 | 28.67% | 행동 비교에 부족 |

## 무엇을 보강하는가

목표는 raw 주문번호나 결제키를 화면에 노출하는 것이 아니다.
목표는 브라우저가 처음 들어온 순간부터 결제완료까지 같은 사람/세션임을 증명하는 안전한 연결키를 남기는 것이다.

보강할 키는 아래처럼 원문이 아니라 hash 또는 presence 중심으로 다룬다.

- GA4 client id 존재 여부
- GA4 user pseudo id 존재 여부
- GA4 session id 존재 여부
- VM Cloud checkout id 존재 여부
- landing session hash
- checkout session hash
- payment success session hash
- Meta/Google click id presence
- order/payment key presence, raw value 출력 금지

## 왜 필요한가

바이오컴의 선행지표 에이전트는 “어떤 행동이 구매를 예고하는가”를 찾아야 한다.
그런데 현재 safe key가 30% 안팎만 이어지면, 구매자와 이탈자의 행동 차이가 실제 차이인지 키 누락인지 구분하기 어렵다.
이 상태에서 ROAS나 랜딩 개선 결정을 내리면 데이터가 좋은 척 보이지만 실제로는 빠진 세션이 많을 수 있다.

## 어떻게 개발하는가

### 1단계. Green read-only coverage 분해

각 단계에서 key presence를 집계한다.

- landing row: GA4 key, click key, session hash가 있는지 본다.
- checkout_started row: landing과 같은 safe key가 이어지는지 본다.
- payment_page_seen row: 결제 페이지까지 같은 key가 이어지는지 본다.
- payment_success row: 결제완료가 같은 safe key로 닫히는지 본다.

산출물:

- 단계별 key presence rate
- missing reason bucket
- “raw 없이 해결 가능한 gap”과 “raw-id Plan B가 필요한 gap” 분리

성공 기준:

- raw identifier output 0
- confirmed/dropped cohort 모두 safe join 80% 이상을 목표로 하는 개선안 도출
- missing hash row가 어느 단계에서 발생하는지 분류

### 2단계. Yellow hash-only capture smoke

VM Cloud receiver나 아임웹/GTM Preview를 쓰더라도 원문 key를 보여주지 않고 hash-only로 보강한다.
운영 배포나 live 저장은 별도 승인 전 하지 않는다.

허용 후보:

- completion page에서 canonical safe key를 생성해 VM Cloud에 저장
- checkout/payment page에서 같은 checkout id를 재사용
- key presence만 화면/API에 노출

성공 기준:

- 신규 row가 landing -> checkout -> payment_success 사이에서 같은 safe key로 이어진다.
- pending/unknown/미입금이 confirmed purchase로 오염되지 않는다.
- no-send, no-write-to-operating-db, no-GTM-publish 유지

### 3단계. Raw-id Plan B

Plan B는 “특정 safe_ref가 왜 안 붙는지 증명해야 할 때”만 쓴다.
기본 개발 흐름이 아니다.

승인 전 금지:

- raw order/payment/member/click id를 보고서에 쓰기
- raw 값을 git, Telegram, 대화, Markdown에 출력하기
- raw 값을 장기 저장하기
- 플랫폼 전송이나 운영DB write와 섞기

승인 후 허용:

- secure local/VM evidence 내부에서만 일시적으로 raw key를 조회
- 결과는 safe_ref와 집계로만 보고
- 목적은 key mapping 오류, GA4 export 지연, session rollover, source mismatch, checkout artifact 중 하나로 분류하는 데 한정

승인 문구:

```text
[승인] 바이오컴 raw-id Plan B 제한 실행.
범위: safe hash로 닫히지 않는 특정 safe_ref row만 secure local/VM evidence 내부에서 raw order/payment/member key를 일시 조회.
금지: raw 값의 대화/문서/git/Telegram 출력, 운영DB write, 플랫폼 send/upload, GTM publish.
성공 기준: 원인을 key_mapping_error / export_delay / session_rollover / source_mismatch / checkout_artifact 중 하나로 분류하고 raw output 0.
```

## 역할 구분

- Codex: Green coverage 분해 리포트, hash-only capture 설계, Plan B 승인안 작성
- TJ님: Yellow/Red 실행 승인 여부 결정
- Claude Code: 프론트엔드 화면화가 필요한 경우 구현

## 100% 조건

- confirmed/dropped cohort safe join 80% 이상
- missing hash 원인 90% 이상 분류
- raw identifier output 0
- pending/unknown/미입금 purchase candidate 0
- platform send/upload 0
- 운영DB write 0
- GTM publish 0

## 다음 판단

지금은 raw-id Plan B를 바로 실행하지 않는 것이 맞다.
먼저 Green read-only coverage 분해로 어느 단계의 key가 빠지는지 좁힌다.
그 뒤 hash-only smoke로 해결되지 않는 특정 row만 Plan B 승인을 받는다.
