# paid_click_intent v1 24h/72h 모니터링 결과 템플릿

작성 시각: 2026-05-07 00:42 KST
기준일: 2026-05-07
상태: template / result pending
Owner: gdn / monitoring
Depends on: [[paid-click-intent-gtm-production-publish-result-20260506]], [[paid-click-intent-post-publish-monitoring-template-20260506]], [[../total/!total-current]]
Do not use for: Google Ads 전환 변경, conversion upload, GA4/Meta/Google Ads 전송, 운영 DB/ledger write

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green read-only monitoring template
  allowed_actions:
    - 결과 문서 템플릿 작성
    - read-only smoke/로그 확인 기준 정리
    - rollback 판단 기준 정리
  forbidden_actions:
    - GTM publish/rollback 실행
    - backend deploy
    - 운영 DB/ledger write
    - platform conversion 전송
    - Google Ads conversion action 변경
  source_window_freshness_confidence:
    source: "GTM live 142 publish result + no-write receiver route"
    window: "24h/72h after 2026-05-07 00:02 KST publish"
    freshness: "result pending"
    confidence: 0.80
```

## 10초 결론

이 문서는 결과를 미리 채워 넣는 문서가 아니다. 24h/72h 시점에 바로 복사해서 결과 문서로 쓸 템플릿이다.

모니터링의 목적은 Google Ads ROAS 개선 확인이 아니다.
목적은 `paid_click_intent v1`이 실제 고객 환경에서 안전하게 동작하는지 확인하는 것이다.

no-write 단계이므로 주문 원장 fill-rate 개선은 필수 성공 기준이 아니다.

## 결과 문서 파일명

24h 결과:

```text
gdn/paid-click-intent-post-publish-monitoring-result-20260508.md
```

72h 결과:

```text
gdn/paid-click-intent-post-publish-monitoring-result-20260510.md
```

## 24h 결과 요약

| 항목 | 결과 | 근거 | 판단 |
|---|---|---|---|
| GTM live version | `142` 유지 / 변경됨 | GTM API 또는 UI | pending |
| tag `[279]` 로드 | 확인 / 미확인 | Tag Assistant / browser smoke | pending |
| receiver 2xx | 정상 / 오류 | access log 또는 smoke | pending |
| 4xx/5xx 급증 | 없음 / 있음 | access log | pending |
| JS error | 없음 / 있음 | browser console / Sentry/로그 | pending |
| 결제/NPay 흐름 이상 | 없음 / 있음 | smoke/CS/주문 흐름 | pending |
| 외부 플랫폼 전송 | 0건 유지 / 의심 | GA4/Meta/Google Ads 확인 범위 | pending |
| PII/value/order field reject | 유지 / 실패 | negative smoke | pending |
| TEST click id live 차단 | 유지 / 실패 | smoke response | pending |

## 72h 결과 요약

| 항목 | 결과 | 근거 | 판단 |
|---|---|---|---|
| route health | 정상 / 불안정 | access log, smoke | pending |
| storage 생성 | 정상 / 불안정 | 대표 URL 샘플 | pending |
| no-write guard | 유지 / 실패 | `would_store=false` | pending |
| no-platform-send guard | 유지 / 실패 | `would_send=false`, 외부 전송 0건 | pending |
| checkout/NPay intent 연결 가능성 | 확인 / 미확인 | storage + receiver sample | pending |
| rollback 필요 | NO / YES | 아래 rollback 기준 | pending |
| minimal ledger write 검토 | 보류 / 승인안 진행 | 안정성 판단 | pending |

## read-only 확인 명령 후보

운영 health:

```bash
curl -sS https://att.ainativeos.net/health | head -c 500
```

receiver positive smoke:

```bash
curl -sS -H 'Origin: https://biocom.kr' \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: curl/8.7.1 smoke-runner' \
  --data '{"site":"biocom","platform_hint":"google_ads","gclid":"TEST_GCLID_MONITOR_YYYYMMDD","landing_url":"https://biocom.kr/?gclid=TEST_GCLID_MONITOR_YYYYMMDD&utm_source=google&utm_medium=cpc","referrer":"https://www.google.com/","client_id":"monitor.1","ga_session_id":"monitor_session","captured_at":"YYYY-MM-DDTHH:mm:ss+09:00"}' \
  https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
```

성공 기준:

```text
ok=true
would_store=false
would_send=false
no_write_verified=true
no_platform_send_verified=true
has_google_click_id=true
test_click_id=true
live_candidate_after_approval=false
```

negative smoke:

| 케이스 | 기대 결과 |
|---|---|
| click id 없음 | 400 |
| value/currency 포함 | 400 |
| order_number/payment_key 포함 | 400 |
| email/phone 포함 | 400 |
| admin/internal path | 400 |
| oversized body | 413 |

## access log 확인 후보

운영 VM 접근은 [[../capivm/vm-ssh-access-recovery-runbook-20260506]]을 따른다.

예시:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; pm2 logs seo-backend --lines 120 --nostream --no-color'\'''
```

주의:

- raw request body가 log에 남으면 안 된다.
- click id 원문, full landing URL query, client_id 원문이 장기 로그에 남으면 안 된다.
- 현재 전용 counter가 없으면 fill-rate 숫자는 확정하지 않는다.

## rollback 기준

아래 중 하나라도 확인되면 rollback 후보로 둔다.

| 기준 | 대응 |
|---|---|
| 결제 버튼/NPay 버튼 동작 이상 | tag `[279]` pause 또는 GTM version 141 rollback |
| receiver 5xx 지속 | backend route disable 또는 이전 backend rollback |
| PII/value/order field 통과 | 즉시 tag pause + receiver 차단 |
| 외부 플랫폼 전송 발생 | 즉시 중단. 전송 경로 조사 |
| TEST click id live candidate 통과 | tag pause + receiver guard 수정 |
| JS error 급증 | tag pause 후 원인 분해 |

## 결과 판단 문구

좋은 결과일 때:

> 24h/72h 동안 GTM live version 142와 no-write receiver가 안정적으로 동작했다. 결제/NPay 흐름 이상, 외부 플랫폼 전송, 운영 DB/ledger write는 확인되지 않았다. 다음 단계는 minimal paid_click_intent ledger write 승인안을 검토하는 것이다.

보류 결과일 때:

> route health는 유지됐지만 전용 counter가 없어 live fill-rate를 확정할 수 없다. no-write 단계의 목적은 payload validation이므로 실패로 보지는 않는다. minimal ledger write 승인 전 counter 또는 제한 저장 설계를 먼저 정해야 한다.

나쁜 결과일 때:

> paid_click_intent v1이 운영 고객 흐름 또는 안전 guard에 영향을 준 증거가 확인됐다. Google Ads confirmed_purchase 관련 작업은 계속 보류하고, 먼저 tag pause/rollback과 원인 분해를 진행한다.

## 다음 단계 분기

| 결과 | 다음 액션 | 승인 필요 |
|---|---|---|
| 24h/72h PASS | minimal paid_click_intent ledger write 승인안 검토 | YES |
| route health PASS but counter 없음 | counter-only 또는 minimal ledger write 중 선택 | YES |
| receiver 오류 | backend route fix 또는 rollback | 상황별 |
| browser/checkout 오류 | GTM tag pause/rollback | YES if publish |
| 외부 전송 의심 | 즉시 중단, guard 감사 | YES |

