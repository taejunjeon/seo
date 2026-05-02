# TikTok Events API Shadow Local Review Pack

작성 시각: 2026-05-03 01:30 KST
목적: 다른 에이전트에게 TikTok Events API Shadow Candidate Ledger 로컬 구현을 검증받기 위한 단일 문서
Lane: Green 구현 검증. VM 배포/DB write/TikTok send 없음.

## 한 줄 결론

TikTok Events API를 실제로 보내기 전, 내부에서만 “서버 이벤트로 보낼 수 있었는지”를 계산하는 로컬 shadow 후보 로직을 구현했다.

이번 구현은 TikTok으로 아무것도 보내지 않는다. VM에도 배포하지 않았다. 개발팀 관리 운영DB PostgreSQL에도 write하지 않았다.

## 검증 요청

다른 에이전트에게 아래를 검증받고 싶다.

1. `Purchase_{order_code}` event_id canonicalization이 dedup 관점에서 맞는가.
2. pending 가상계좌, 취소/기한초과, TikTok evidence 없는 confirmed 주문이 eligible로 승격되지 않는가.
3. `sendCandidate=false`와 `platformSendStatus=not_sent` hard guard가 충분한가.
4. 기존 `attribution_ledger`를 오염시키지 않고 별도 table을 쓰는 설계가 타당한가.
5. 다음 Yellow Lane VM dry-run 승인 범위가 과하지 않은가.

## 변경 파일

| 파일 | 역할 |
|---|---|
| `backend/src/tiktokEventsApiShadowCandidates.ts` | shadow 후보 생성, summary, schema, upsert 로직 |
| `backend/scripts/tiktok-events-api-shadow-candidates.ts` | 로컬/VM dry-run CLI. 기본은 dry-run, `--apply`는 `--limit 1..50` 필요 |
| `backend/tests/tiktok-events-api-shadow-candidates.test.ts` | confirmed eligible, pending block, no-evidence block, temp DB not_sent 저장 테스트 |
| `tiktok/tiktok_events_api_shadow_ledger_design.md` | 설계 문서. 로컬 구현 상태 반영 |
| `tiktok/tiktok_events_api_shadow_ledger_approval.md` | Yellow Lane VM dry-run 승인 요청 초안 |

## DB 위치 구분

| 이름 | 위치 | 이번 작업 영향 |
|---|---|---|
| 운영DB | 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` | write 없음 |
| TJ 관리 Attribution VM | `att.ainativeos.net` 내부 SQLite | 배포 없음, write 없음 |
| 로컬 개발 DB | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | dry-run read. 테스트는 `/tmp` temp SQLite만 write |

## 구현 핵심

### 후보 생성

v1은 `Purchase`만 대상으로 한다.

eligible 조건:

- `eventName=Purchase`
- `order_code` 있음
- payment status confirmed
- TikTok evidence 있음
- server event_id 후보가 `Purchase_{order_code}`
- browser final event_id도 `Purchase_{order_code}`
- PII 없음

eligible이어도 `sendCandidate=false`로만 저장한다.

### 차단 조건

| 조건 | block reason |
|---|---|
| confirmed 아님 | `not_confirmed` |
| pending 가상계좌 | `pending_virtual_account` |
| 취소/기한초과 | `canceled_or_overdue` |
| TikTok 근거 없음 | `no_tiktok_evidence` |
| order_code 없음 | `missing_order_code` |
| browser final event_id 없음 | `missing_browser_event_id` |
| event name 불일치 | `event_name_mismatch` |
| PII 감지 | `pii_detected` |

### 저장 guard

`upsertTikTokEventsApiShadowCandidates()`는 아래를 강제한다.

```ts
candidate.sendCandidate === false
candidate.platformSendStatus === "not_sent"
```

위 조건이 깨지면 error를 던진다.

## 실행한 검증

```bash
npm --prefix backend run typecheck
```

결과: 통과

```bash
cd backend && node --import tsx --test tests/tiktok-events-api-shadow-candidates.test.ts
```

결과: 5/5 통과

```bash
cd backend && npx tsx scripts/tiktok-events-api-shadow-candidates.ts --window-days 7 --limit 20 --json
```

결과:

```json
{
  "mode": "dry_run",
  "noPlatformSend": true,
  "noOperatingDbWrite": true,
  "storage": "dry-run only, no DB write",
  "writtenRows": 0,
  "summary": {
    "totalCandidates": 0,
    "eligibleForFutureSend": 0,
    "blocked": 0,
    "sendCandidateTrue": 0,
    "platformSent": 0
  }
}
```

해석:
- 현재 로컬 개발 DB에는 최근 7일 `biocom_imweb` TikTok Pixel event 후보가 없거나 비어 있어 후보 0건이다.
- 이는 로컬 DB 상태의 문제이지, 구현 실패는 아니다. fixture 테스트로 core rule은 검증했다.

## 하지 않은 것

| 항목 | 상태 |
|---|---|
| TikTok Events API production send | 안 함 |
| TikTok Test Events send | 안 함 |
| VM 배포 | 안 함 |
| VM SQLite write | 안 함 |
| 운영DB PostgreSQL write | 안 함 |
| GTM 변경 | 안 함 |
| Purchase Guard 변경 | 안 함 |
| firstTouch strict 승격 | 안 함 |

## 검증 시 특히 봐야 할 코드 지점

1. `backend/src/tiktokEventsApiShadowCandidates.ts`
   - `buildTikTokServerEventIdCandidate()`
   - `findPaymentMatch()`
   - `collectEvidence()`
   - `isPendingVirtualAccount()`
   - `upsertTikTokEventsApiShadowCandidates()`

2. `backend/tests/tiktok-events-api-shadow-candidates.test.ts`
   - confirmed TikTok order eligible
   - pending virtual account block
   - confirmed no evidence block
   - temp DB row가 `send_candidate=0`, `platform_send_status=not_sent`

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 로컬 DB 후보 0건 | 실제 운영 데이터 분포를 아직 못 봄 | Yellow Lane VM dry-run에서 실제 VM SQLite 기준 확인 |
| payment_success 매칭 휴리스틱 | 일부 order_code/order_no 매칭 누락 가능 | VM dry-run sample로 누락 유형 보강 |
| Events API field shape 미검증 | production send 설계와 차이 가능 | Test Events only Yellow sprint 전 공식 API payload 재확인 |
| TikTok evidence 판정 과소/과대 | eligible 후보 수가 실제보다 적거나 많을 수 있음 | block reason 분포와 샘플 주문 검산 |

## 다음 승인 후보

승인 문서:

`tiktok/tiktok_events_api_shadow_ledger_approval.md`

승인 이름:

`TikTok Events API Shadow Candidate Ledger Local Implementation + VM Dry Run`

승인해도 되는 작업:

- TJ 관리 Attribution VM 배포
- VM SQLite shadow table 생성
- 최근 7일 dry-run
- shadow row 최대 50건 insert/upsert
- 결과 문서 업데이트

계속 금지:

- TikTok Events API production send
- TikTok Test Events send
- GA4/Meta/Google 전환 전송
- GTM 변경
- Purchase Guard 변경
- 운영DB PostgreSQL write

## Auditor verdict

PASS_WITH_NOTES

로컬 구현은 Green Lane 범위 안에 있다. 다음 VM dry-run은 Yellow Lane이므로 TJ님 승인 전 실행하면 안 된다.
