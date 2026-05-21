작성 시각: 2026-05-21 11:22 KST
기준일: 2026-05-21
문서 성격: Meta CAPI 이벤트 매칭 품질 개선용 no-send payload preview 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - gptconfirm/gpt0521-1-emq-payload-preview/00-result-report.md
    - gptconfirm/gpt0521-2-emq-local-patch/00-result-report.md
    - gptconfirm/gpt0521-3-event-id-raw-guard-deploy/00-result-report.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only aggregate query
    - VM Cloud CAPI send log read-only aggregate query
    - no-send payload preview
    - local gptconfirm report creation
  forbidden_actions:
    - Meta CAPI send
    - Meta backfill
    - VM Cloud deploy/restart
    - operating DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite + VM Cloud meta-capi-sends.jsonl
    window: 24h and 7d
    freshness: generated_at_utc 2026-05-21T02:18:29Z
    confidence: high for field presence, medium for future EMQ score impact
```

## 10초 요약

이번 preview는 실제 Meta 전송 없이, 앞으로 Purchase CAPI에 고객 식별자를 보강하면 어떤 필드가 채워질 수 있는지만 계산했다.

결론은 명확하다. 현재 Purchase CAPI에는 이메일, 전화번호, 외부 ID가 0건이지만, Imweb 주문 cache를 안전하게 조인하면 최근 24시간과 7일 모두 `ph`와 `external_id` 후보가 100% 채워진다.

단, 이메일은 이번 source에서 후보가 0건이다. 먼저 전화번호 해시와 site-scoped external_id부터 canary로 보내고, 이메일은 별도 source 확인 후 진행하는 것이 맞다.

## 확인 결과

### 최근 24시간

| site | confirmed 후보 | CAPI success | 현재 fbp | 현재 fbc | 현재 em | 현재 ph | 현재 external_id | preview ph 후보 | preview external_id 후보 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| biocom | 40 | 40 | 38 | 14 | 0 | 0 | 0 | 40 | 40 |
| thecleancoffee | 19 | 18 | 19 | 8 | 0 | 0 | 0 | 19 | 19 |

### 최근 7일

| site | confirmed 후보 | CAPI success | 현재 fbp | 현재 fbc | 현재 em | 현재 ph | 현재 external_id | preview ph 후보 | preview external_id 후보 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| biocom | 365 | 349 | 358 | 168 | 0 | 0 | 0 | 365 | 365 |
| thecleancoffee | 164 | 163 | 164 | 42 | 0 | 0 | 0 | 164 | 164 |

## 사람이 이해하기 쉬운 해석

Meta가 구매자를 더 잘 알아보려면 여러 단서가 필요하다.

지금은 브라우저 ID(`fbp`)와 클릭 ID(`fbc`)는 일부 들어가지만, 사람을 더 안정적으로 묶는 고객 단서가 비어 있다. 이번 preview는 전화번호를 표준화해 해시한 값(`ph`)과 사이트별 비밀키로 만든 외부 ID(`external_id`)를 붙일 수 있는지 본 것이다.

결과상 두 사이트 모두 후보율은 100%다. 즉 “보낼 재료가 없다”가 병목은 아니다. 다음 병목은 “어떤 범위에서, 어떤 flag로, 얼마 동안 관찰하며 켤 것인가”다.

## 배포 의견

진행 추천은 높다. 다만 바로 전체 사이트에 영구 ON은 권하지 않는다.

추천 순서:

1. 코드 flag는 이미 로컬 패치 방향이 맞다.
2. 운영 적용은 `biocom`부터 짧은 canary로 시작한다.
3. 24-72시간 동안 Events Manager의 이벤트 매칭 품질 점수와 CAPI success/failed/duplicate를 본다.
4. 이상 없으면 더클린커피까지 확대한다.

이유는 고객 식별자 보강은 실제 Meta에 보내는 데이터가 바뀌는 작업이기 때문이다. preview는 Green이지만, 운영 flag ON은 Red 성격의 외부 플랫폼 데이터 전송 변경이다.

## 하지 않은 것

- Meta CAPI 실제 전송: 0
- Meta backfill: 0
- VM Cloud deploy/restart: 0
- 운영DB write/import: 0
- GTM publish: 0
- raw order/payment/member/click/email/phone 출력: 0

## 확인하면 좋은 문서

1. [[01-preview-result-and-deploy-opinion]] — 이번 preview 숫자와 운영 적용 의견.
2. [[payload-preview.json]] — raw 없이 저장한 aggregate preview 원본.
3. `gptconfirm/gpt0521-3-event-id-raw-guard-deploy/00-result-report.md` — event_id raw 노출 방어는 별도 트랙이다.
