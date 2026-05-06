# paid_click_intent production receiver 배포 결과

작성 시각: 2026-05-06 23:46 KST
대상: `att.ainativeos.net` backend
문서 성격: Red Mode B backend 운영 deploy 결과 문서
Status: backend receiver route deployed / smoke passed / GTM publish pending
Supersedes: [[paid-click-intent-production-receiver-post-smoke-20260506|POST 404 smoke 결과]]
Depends on:
- [[paid-click-intent-production-receiver-deploy-approval-20260506]]
- [[../capivm/vm-ssh-access-recovery-runbook-20260506]]
Do not use for: Google Ads conversion action 생성/변경, conversion upload, GA4/Meta/Google Ads 전송, 운영 DB/ledger write

## 10초 결론

`att.ainativeos.net` backend에 `POST /api/attribution/paid-click-intent/no-send` no-write receiver route를 운영 배포했다. 이전에는 production POST가 `404 Route not found`였지만, 현재는 TEST payload가 200으로 응답한다.

positive smoke와 negative smoke 모두 통과했다. 응답은 `would_store=false`, `would_send=false`, `no_platform_send_verified=true`, `live_candidate_after_approval=false`를 유지한다.

아직 GTM receiver-enabled publish는 하지 않았다. 다음 단계는 현재 GTM live version 확인, fresh workspace 사용, receiver URL 포함 tag/trigger diff 기록, publish, 24h/72h 모니터링이다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase4 | [[#Phase4-Sprint6]] | paid_click_intent receiver 배포 | Codex | 100% / 70% | [[#Phase4-Sprint6\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase4-Sprint6]] | 대기 | Codex | receiver-enabled GTM publish를 실행한다 | backend receiver가 살아 있어도 브라우저 tag가 호출하지 않으면 live payload validation이 시작되지 않는다 | GTM live latest 확인, fresh workspace 생성, tag/trigger diff 기록, publish 후 24h/72h 모니터링 | [[#Phase4-Sprint6]] | Mode B 조건부 YES 범위 |
| 2 | [[#Phase4-Sprint6]] | 완료 후 | Codex | 24h/72h 결과로 minimal ledger write 승인안 여부를 판단한다 | no-write receiver는 원장 개선이 아니라 payload 검증 단계다 | 2xx/error, blocked reason, storage/payload evidence를 보고 저장 필요성과 범위를 정한다 | [[#Phase4-Sprint6]] | YES, 운영 write 단계 |

## 배포 범위

포함:

- `backend/src/routes/attribution.ts`
- `backend/dist/routes/attribution.js`
- `POST /api/attribution/paid-click-intent/no-send`
- no-write/no-send preview 응답.
- PII, secret, order/payment, value/currency field reject.
- admin/internal path reject.
- oversized payload reject.
- TEST/DEBUG/PREVIEW click id live candidate 차단.

제외:

- DB migration.
- env/secret 변경.
- Google Ads conversion action 생성/변경.
- conversion upload.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- confirmed purchase dispatcher 운영 전송.
- 운영 DB/ledger write.
- GTM Production publish.

## 운영 VM 접근과 배포 방법

직접 `biocomkr_sns@34.64.104.94` SSH는 public key 실패 상태다. 대신 아래 경로를 사용했다.

```text
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
sudo -n -u biocomkr_sns ...
```

운영 repo:

```text
/home/biocomkr_sns/seo/repo/backend
```

백업:

```text
/home/biocomkr_sns/seo/shared/deploy-backups/20260506_paid_click_intent_no_send/backend-attribution-prev.tgz
```

PM2:

```text
seo-backend online
pid: 397130
created_at: 2026-05-06T14:36:18.962Z
```

자세한 SSH 복구 방법은 [[../capivm/vm-ssh-access-recovery-runbook-20260506]]을 따른다.

## Health smoke

명령:

```bash
curl -sS https://att.ainativeos.net/health
```

결과:

```text
HTTP 200
service=biocom-seo-backend
backgroundJobs.enabled=true
```

주의:

기존 background job은 이미 운영 backend에서 활성화되어 있었다. 이번 작업은 paid_click_intent receiver route만 추가했고, 새 platform send job을 켜지 않았다.

## Positive smoke

명령:

```bash
curl -sS -H 'Origin: https://biocom.kr' \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: curl/8.7.1 smoke-runner' \
  --data '{"site":"biocom","platform_hint":"google_ads","gclid":"TEST_GCLID_DOC_20260506","landing_url":"https://biocom.kr/product/123?gclid=TEST_GCLID_DOC_20260506&utm_source=google&utm_medium=cpc","referrer":"https://www.google.com/","client_id":"555.666","ga_session_id":"777","captured_at":"2026-05-06T23:20:00+09:00"}' \
  https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
```

결과:

```text
HTTP 200
ok=true
dry_run=true
would_store=false
would_send=false
no_write_verified=true
no_platform_send_verified=true
has_google_click_id=true
test_click_id=true
live_candidate_after_approval=false
block_reasons=read_only_phase, approval_required, test_click_id_rejected_for_live
```

## Negative smoke

| 케이스 | 결과 | 의미 |
|---|---|---|
| 정상 TEST gclid | 200 | Preview 응답 가능. live candidate는 false |
| click id 없음 | 400 | `missing_google_click_id`로 차단 |
| value/currency 포함 | 400 | purchase value 필드 차단 |
| order_number 포함 | 400 | order/payment field 차단 |
| email 포함 | 400 | PII/secret field 차단 |
| admin path | 400 | admin/internal path 차단 |
| oversized body | 413 | body size limit 차단 |

검증에 사용한 Python smoke runner는 `User-Agent: curl/8.7.1 smoke-runner`를 명시했다. Python 기본 User-Agent는 Cloudflare/WAF에서 403이 날 수 있어 운영 smoke에는 curl-like User-Agent를 쓴다.

## 현재 영향

변경된 것:

- production backend에 no-write receiver route가 생겼다.
- production POST 404 blocker가 해소됐다.
- receiver route는 validation preview 응답만 반환한다.

변경되지 않은 것:

- GTM Production publish는 아직 하지 않았다.
- Google Ads 전환 액션은 바꾸지 않았다.
- conversion upload는 하지 않았다.
- GA4/Meta/Google Ads/TikTok/Naver 전송은 0건이다.
- 운영 DB/ledger write는 0건이다.

## 남은 리스크

- GTM API/UI publish가 아직 남아 있다.
- no-write receiver는 raw row를 저장하지 않으므로, 실제 주문 원장 fill-rate 개선은 minimal ledger write 이후에야 확인할 수 있다.
- PM2 `seo-backend` restart count가 높다. 이번 배포로 새 crash는 확인되지 않았지만, 운영 안정성 관점에서는 별도 관찰 대상이다.
- Cloudflare/WAF가 일부 비브라우저 User-Agent를 403 처리할 수 있다. 실제 GTM 브라우저 요청은 별도로 확인해야 한다.

#### Phase4-Sprint6

**이름**: paid_click_intent receiver 배포

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 production receiver POST 404를 해소하고, receiver-enabled GTM publish 전에 no-write/no-send guard가 운영에서 동작하는지 확인하는 것이다.

완료한 것:

- 운영 VM 접근 경로 확보.
- backend receiver route 배포.
- PM2 restart.
- positive smoke 통과.
- negative smoke 통과.

남은 것:

- GTM receiver-enabled publish.
- 24h/72h live monitoring.
- 결과에 따라 minimal ledger write 승인안 작성.
