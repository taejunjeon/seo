# Meta 이벤트 매칭 품질 no-send audit

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
  required_context_docs:
    - gptconfirm/gpt0520-4-meta-emq-parameter-audit/00-result-report.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only aggregate audit
    - local source code read-only audit
    - no-send implementation design
    - report writing
  forbidden_actions:
    - Meta send/backfill
    - GTM publish
    - Imweb header/footer save
    - VM Cloud deploy/restart
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite + local backend source
    generated_at_utc: 2026-05-20T15:10:44Z
    generated_at_kst: 2026-05-21 00:10 KST
    windows: recent_24h, recent_7d
    confidence: high_for_aggregate_candidates
```

## 이번에 가능해진 것

Meta Purchase 이벤트 매칭 품질을 올릴 후보가 어디에 있는지 분리했다. 결론은 단순하다.

- 현재 Purchase CAPI는 `ip`, `user_agent`, `fbp`는 거의 보내고 있다.
- `fbc`는 일부만 있다.
- `email`, `phone`, `external_id`는 Purchase 경로에서 사실상 0에 가깝다.
- 하지만 VM Cloud에서 Imweb 주문 캐시와 결제완료 후보를 조인하면 `member_code` 기반 external_id 후보와 주문자 전화번호 기반 phone hash 후보가 확인된다.

즉, 매칭 품질 6.1/10의 핵심 개선 여지는 “없는 데이터를 새로 만드는 것”보다 “이미 있는 Imweb confirmed 주문 정보를 안전하게 해시해서 CAPI payload에 넣는 것”이다.

## 핵심 숫자

| site | window | confirmed 후보 | CAPI success key match | fbp present | fbc present | 현재 email/phone 관측 | 현재 external_id send | Imweb member 기반 external_id 후보 | Imweb phone hash 후보 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| biocom | 24h | 43 | 41 / 43 | 42 / 43 | 18 / 43 | 0 / 43 | 0 / 43 | 43 / 43 | 43 / 43 |
| thecleancoffee | 24h | 16 | 16 / 16 | 16 / 16 | 5 / 16 | 0 / 16 | 0 / 16 | 16 / 16 | 16 / 16 |
| biocom | 7d | 368 | 352 / 368 | 362 / 368 | 171 / 368 | 0 / 368 | 0 / 368 | 368 / 368 | 368 / 368 |
| thecleancoffee | 7d | 174 | 174 / 174 | 174 / 174 | 41 / 174 | 0 / 174 | 0 / 174 | 174 / 174 | 174 / 174 |

주의: CAPI send log count와 confirmed 후보 count는 기준 테이블과 시간 절단 방식이 달라 소폭 차이가 날 수 있다. 위 표의 핵심은 “현재 payload에 없는 후보율”이다.

## 해석

1. `fbp`는 거의 정상이다.
   브라우저 ID는 대부분 들어간다. 이 부분은 지금 당장 가장 큰 문제가 아니다.

2. `fbc`는 낮다.
   Meta click id가 있는 유입만 잡히기 때문에 100%가 목표는 아니지만, Meta 유입 추적 품질을 더 올리려면 UTM/source/fbclid 복원도 계속 필요하다.

3. email 후보는 현재 VM 관측 기준 0이다.
   코드상 email이 있으면 해시해서 보낼 준비는 있지만, 현재 결제완료 후보에서는 email source가 보이지 않는다.

4. phone 후보는 Imweb 주문 캐시에 있다.
   지금 CAPI path가 이 값을 쓰지 않아 no-send 상태다. 전화번호는 Meta UI가 직접 추천한 개선 항목이므로 효과 기대가 크다.

5. external_id 후보는 Imweb 회원 코드에서 만들 수 있다.
   원문 member id를 그대로 보내는 방식은 금지에 가깝게 봐야 한다. 안전한 방식은 site별 secret을 둔 HMAC 또는 안정 해시를 만들어 `external_id`로 보내는 것이다.

## 원문 회원 ID를 external_id로 쓰는 문제

구분해서 보면 다음과 같다.

- 절대 안 되는 것: 이메일, 전화번호, 이름, 주소처럼 직접 식별 가능한 값을 원문으로 보내는 것.
- 기술적으로 가능하지만 비권장인 것: 내부 회원 코드처럼 외부에서는 의미가 덜한 ID를 원문으로 보내는 것.
- 이 프로젝트에서의 운영 원칙: 원문 member/order/payment id는 보고서, 로그, Telegram, git, 외부 플랫폼 payload에 그대로 쓰지 않는다.
- 권장안: `site + member_code`를 secret 기반 HMAC으로 변환한 안정 ID를 `external_id`로 사용한다. 원문은 secure evidence 내부에서만 읽고, payload/log/report에는 safe 값만 남긴다.

## 지금 하지 않은 것

- Meta 운영 Purchase 추가 send 0.
- 외부 플랫폼으로 email/phone/external_id 추가 전송 0.
- VM Cloud deploy/restart 0.
- GTM publish 0.
- 운영DB write/import 0.
- raw order/payment/member/click id 출력 0.

## 결론

이벤트 매칭 품질 개선 후보율은 높다. 특히 최근 7일 기준 두 사이트 모두 Imweb member 기반 external_id 후보와 phone hash 후보가 confirmed 후보의 100%에서 관측됐다. 다만 실제 Meta 전송은 고객 정보 추가 전송이므로 no-send dry-run → payload preview → Red 승인 후 제한 배포 순서가 맞다.
