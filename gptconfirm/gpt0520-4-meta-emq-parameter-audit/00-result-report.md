harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - frontrule.md
  required_context_docs:
    - project/frontreport.md
    - project/kr7.md
    - capivm/!capiplan.md
  lane: Green
  allowed_actions:
    - VM Cloud read-only diagnostics
    - local frontend report update
    - documentation
  forbidden_actions:
    - Meta send/backfill
    - VM deploy/restart
    - GTM publish
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: Meta Events Manager screenshot + VM Cloud attribution ledger + backend/src/metaCapi.ts
    window: 24h/7d
    freshness: 2026-05-20 23:20 KST
    confidence: medium_high

# Meta Event Match Quality / 매개변수 진단 결과

## 이번에 가능해진 것

Meta Purchase 이벤트는 회복됐고, 이제 병목은 “구매가 Meta에 갔는가”가 아니라 “Meta가 그 구매를 어떤 사람/광고 클릭과 잘 맞출 수 있는가”로 이동했다.

Meta UI 기준 Purchase 이벤트 매칭 품질은 6.1/10이다. 현재 IP 주소, 사용자 에이전트, fbp는 정상적으로 들어가고, fbc는 부분적으로 들어간다. 이메일, 전화번호, external_id, Facebook 로그인 ID는 아직 운영 Purchase user_data에 충분히 붙지 않는다.

## 알고 있었는가

알고 있었다. 다만 “운영 전송까지 완료된 상태”는 아니었다.

- `project/kr7.md`: Events Manager 검증, event match quality, recent activity 확인이 KR7 남은 일로 기록되어 있다.
- `capivm/!capiplan.md`: Phase3-Sprint5에서 Meta Events Manager UI 검증과 매칭 품질 확인이 계획에 있다.
- `frontend/src/app/tracking-integrity/page.tsx`: `match_quality_proxy(email/phone/fbp/fbc 제공률)` 개념이 이미 프론트/헬스 체크 후보로 있다.

즉 방향은 계획에 있었지만, 고객정보 매개변수 확장은 개인정보/동의/해시 검토가 필요해서 운영 전송까지 진행하지 않았다.

## 실제 관측

VM Cloud read-only 진단 기준:

| site | window | candidates | IP | UA | fbp | fbc/fbclid buildable | Toss email | Toss phone |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| biocom | 24h | 44 | 44 | 44 | 43 | 19 | 0 | 0 |
| thecleancoffee | 24h | 17 | 17 | 17 | 17 | 5 | 0 | 0 |
| biocom | 7d sample | 80 | 80 | 80 | 79 | 37 | 0 | 0 |
| thecleancoffee | 7d sample | 80 | 80 | 80 | 80 | 25 | 0 | 0 |

해석:

- 기본 브라우저/서버 단서는 정상이다.
- Meta 클릭 단서 fbc는 광고 클릭 기반이므로 100%가 될 필요는 없지만, Meta 광고 유입인데 빠지는 row는 줄여야 한다.
- backend 코드는 이메일/전화번호가 들어오면 해시해서 보낼 수 있지만, 현재 Toss read-only 표본에서는 값이 0건이다.
- `external_id`는 현재 Purchase user_data에 넣지 않는다.
- Facebook 로그인 ID는 사이트 로그인 구조상 낮은 우선순위다.

## 프론트엔드 반영

`/ai-crm/capi-report` 로컬 코드에 “이벤트 매칭 품질(Event Match Quality)” 섹션을 추가했다.

반영 내용:

- 현재 점수 6.1/10.
- 기타 매개변수 추가 전환이 아직 성과 확인 전인 이유.
- IP/UA/fbp/fbc/email/phone/external_id/Facebook Login ID 상태표.
- “이벤트 매칭 품질 6.1/10 올리기”를 바로 다음 할 일 카드에 추가.
- KR7 진행률을 65%에서 70%로 조정.

## 하지 않은 것

- Meta 운영 Purchase 추가 전송 없음.
- 이메일/전화번호/external_id 운영 전송 없음.
- VM Cloud deploy/restart 없음.
- GTM publish 없음.
- 운영DB write/import 없음.
- raw 주문/결제/회원/클릭 ID 출력 없음.

## 다음 판단

고객정보 매개변수는 성과 개선 여지가 크지만, 바로 전송하면 안 된다. 먼저 no-send 후보율을 계산하고, 해시/동의/민감정보 기준을 닫은 뒤 Test Events에서 검증해야 한다.
