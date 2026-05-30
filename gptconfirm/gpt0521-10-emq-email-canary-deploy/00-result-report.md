harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
  required_context_docs:
    - gptconfirm/gpt0521-8-emq-biocom-identity-canary-approval
    - gptconfirm/gpt0521-9-emq-biocom-identity-canary-deploy
  lane: Yellow
  allowed_actions:
    - backend/src/env.ts local patch
    - backend/src/metaCapi.ts local patch
    - VM Cloud two-file backend deploy/restart
    - read-only aggregate preview
    - post-deploy health/log check
  forbidden_actions:
    - manual Meta Purchase send
    - bulk backfill
    - GTM publish
    - Imweb header/footer edit
    - production DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite imweb_orders + imweb_members + meta-capi send log
    window: recent 24h and recent 7d
    freshness: checked 2026-05-21 KST after deploy
    confidence: medium_high

# biocom Purchase CAPI 이메일 해시 보강 canary 배포 결과

## 이번에 가능해진 것

biocom의 실제 결제완료 구매 신호를 Meta CAPI로 보낼 때, Imweb 회원 이메일이 있는 주문은 이메일을 SHA-256 해시로 보강할 수 있게 됐다.

이메일 원문은 로그, 문서, 채팅에 남기지 않고, Meta에 보내는 payload 안에서도 해시값만 쓰는 구조다.

## 왜 필요했는지

Meta Events Manager가 Purchase 이벤트 매칭 품질을 6점대 초반으로 표시했고, 개선 후보로 이메일 주소를 제안했다. 기존 CAPI는 `fbp`, `fbc`, IP, user agent, 일부 phone/external_id에 의존하고 있어, 회원 이메일이 있는 결제건의 매칭 품질을 더 올릴 여지가 있었다.

## 적용 범위

- site: biocom
- event: confirmed Purchase CAPI
- 대상: 기존 CAPI auto-sync가 보내는 구매 신호 중 Imweb 회원 이메일이 조인되는 주문
- 제외: 더클린커피, browser Purchase, payment_page_seen, pending/unknown/canceled/refunded, 수동 backfill

## 배포 결과

- VM Cloud backend build: PASS
- PM2 restart: PASS
- `/health`: 200 OK
- CAPI auto-sync: enabled, 30분 주기
- env flag: `META_CAPI_ENABLE_IMWEB_EMAIL_HASH=true`
- allowlist: `biocom`

## no-send preview

| window | total orders | member present | email candidate present | phone candidate present | email candidate rate |
|---|---:|---:|---:|---:|---:|
| VM Cloud recent 7d biocom | 475 | 475 | 140 | 475 | 29.5% |
| VM Cloud recent 24h biocom | 75 | 75 | 27 | 75 | 36.0% |

이 수치는 실제 Meta send를 새로 만든 것이 아니라, VM Cloud SQLite에서 이메일 후보가 있는지 read-only로 집계한 값이다.

## post-check

| check | result |
|---|---|
| `/health` | PASS |
| backend build | PASS |
| pm2 restart | PASS |
| recent 24h CAPI Purchase success | 68/68 |
| since deploy CAPI Purchase success | 1/1 |
| since deploy email hash sent | 0/1 |

배포 직후 들어온 1건은 biocom Purchase였고 phone/external_id 후보는 있었지만, 해당 주문은 회원 이메일 후보가 없어 `em`이 붙지 않았다. 따라서 canary는 켜졌지만, 실제 `em=true` 관측은 다음 이메일 보유 구매가 들어올 때 확인해야 한다.

## 하지 않은 것

- Meta CAPI 수동 추가 전송 없음
- 대량 backfill 없음
- GTM publish 없음
- Imweb header/footer 변경 없음
- 운영DB write/import 없음
- raw 이메일/주문/결제/member/click id 출력 없음
