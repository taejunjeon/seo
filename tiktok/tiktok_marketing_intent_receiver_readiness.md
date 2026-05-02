# TikTok Marketing Intent Receiver 배포 Readiness

작성 시각: 2026-05-02 23:55 KST
상태: VM 배포 및 smoke 완료. GTM 브라우저 Preview 확인 전.
대상: TJ 관리 Attribution VM `att.ainativeos.net`
저장 대상: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`
운영DB 영향: 없음. 개발팀 관리 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` write 없음.
자신감: **88%**

## 10초 요약

`marketing-intent` receiver는 TikTok 광고 클릭 흔적만 TJ 관리 Attribution VM 원장에 저장한다.

이번 단계는 GTM Production publish가 아니다. VM receiver 배포와 smoke는 통과했고, 남은 단계는 TJ님 브라우저 Tag Assistant Preview에서 GTM fired/Network/ledger row를 확인하는 것이다.

로컬 source 기반 smoke test에서는 정상 저장, TikTok 근거 없음 skip, PII reject, origin reject, site reject, duplicate skip을 확인했다.

VM 실행 결과: `tiktok/tiktok_marketing_intent_vm_deploy_result.md`

## 승인 범위

TJ님 승인 범위:

1. marketing-intent receiver 배포 준비
2. GTM Preview tag 생성
3. 테스트 URL Preview 검증
4. 같은 브라우저 카드 결제 1건 firstTouch 연결 검증 준비

아직 금지:

- GTM Production publish
- TikTok Purchase Guard 이동
- TikTok Events API
- GA4/Meta/Google 전환 전송
- `payment_success` top-level attribution 덮어쓰기
- firstTouch 후보를 strict confirmed로 승격

## Receiver 보강 내용

| 보강 | 구현 상태 | 이유 |
|---|---|---|
| 서버 측 TikTok 근거 재검증 | 완료 | GTM trigger 조건만 믿지 않는다 |
| `ttclid` / TikTok UTM / TikTok referrer 중 하나 필요 | 완료 | TikTok 클릭 intent가 아닌 일반 방문 저장 방지 |
| site=biocom만 허용 | 완료 | coffee/aibio/기타 사이트 오염 방지 |
| Origin/Referer allowlist | 완료 | `biocom.kr`, `www.biocom.kr`, `m.biocom.kr`, `biocom.imweb.me`만 허용 |
| rate limit | 완료 | IP 기준 60초 60건 |
| PII reject | 완료 | email/phone/name/address 계열 key 또는 email 값 reject |
| URL 저장 sanitize | 완료 | landing/referrer query는 `ttclid`, UTM만 보존 |
| dedupe key 우선순위 | 완료 | `ttclid` → UTM campaign/content/path → referrer host/path/date |
| firstTouch 저장 위치 | 완료 | `metadata.firstTouch`에만 저장. top-level source/ttclid 덮어쓰기 없음 |

## 코드 위치

| 파일 | 역할 |
|---|---|
| `backend/src/routes/attribution.ts` | `/api/attribution/marketing-intent` receiver, allowlist, rate limit, PII reject, dedupe |
| `backend/src/attribution.ts` | `marketing_intent` touchpoint와 payment_success firstTouch 연결 |
| `backend/src/attributionLedgerDb.ts` | SQLite read/write 시 `touchpoint=marketing_intent` 보존 |
| `backend/tests/attribution.test.ts` | marketing_intent firstTouch 연결 테스트 |

## 로컬 Smoke Test 결과

테스트 방식:

- 기존 `localhost:7020` 서버는 이전 빌드라 route가 없어 사용하지 않았다.
- 임시 source 기반 express server를 `localhost:17020`에 띄웠다.
- 저장 DB는 `/tmp/tiktok-marketing-intent-smoke-1777726894.sqlite3` 임시 SQLite를 사용했다.
- 운영DB와 TJ 관리 Attribution VM에는 write 없음.

| 테스트 | 기대 | 결과 |
|---|---|---|
| TikTok `ttclid` + UTM + referrer | 201 저장 | 통과 |
| TikTok 근거 없음 | 200 skip `no_tiktok_intent_evidence` | 통과 |
| email PII 포함 | 400 `marketing_intent_pii_rejected` | 통과 |
| 비허용 Origin | 403 `origin_not_allowed` | 통과 |
| site=coffee | 403 `site_not_allowed` | 통과 |
| 같은 `ttclid` 재전송 | 200 skip `duplicate_marketing_intent` | 통과 |

정상 저장 응답 핵심:

```json
{
  "receiver": "marketing_intent",
  "entry": {
    "touchpoint": "marketing_intent",
    "landing": "https://biocom.kr/?utm_source=tiktok&utm_campaign=local_smoke&ttclid=local_smoke_20260502",
    "referrer": "https://www.tiktok.com/",
    "utmSource": "tiktok",
    "ttclid": "local_smoke_20260502",
    "metadata": {
      "intentChannel": "tiktok",
      "intentLookbackDays": 7,
      "marketingIntentDedupe": {
        "tier": "ttclid",
        "key": "local_smoke_20260502"
      },
      "strictTikTokMarketingIntentReasons": [
        "landing_ttclid",
        "landing_utm_source_tiktok",
        "referrer_tiktok",
        "ttclid",
        "utm_source_tiktok"
      ]
    }
  }
}
```

## 배포 전 체크리스트

| 체크 | 상태 |
|---|---|
| `npm --prefix backend run typecheck` | 통과 |
| `node --import tsx --test tests/attribution.test.ts` | 34/34 통과 |
| source 기반 receiver smoke test | 통과 |
| 운영DB write 없음 | 확인 |
| GTM Production publish 없음 | 확인 |
| 전환 API 전송 없음 | 확인 |

## VM 배포 절차

배포는 별도 승인 후 진행한다.

1. TJ 관리 Attribution VM 현재 dist/source 백업
2. 변경 파일 선별 반영
3. `node --check dist/attribution.js`
4. `node --check dist/routes/attribution.js`
5. `pm2 restart seo-backend --update-env`
6. `https://att.ainativeos.net/health` 확인
7. `POST /api/attribution/marketing-intent` smoke test
8. `CRM_LOCAL_DB_PATH#attribution_ledger`에서 `touchpoint=marketing_intent` row 확인

## VM Smoke Test Payload

```bash
curl -sS -X POST 'https://att.ainativeos.net/api/attribution/marketing-intent' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://biocom.kr' \
  -H 'Referer: https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=vm_smoke&ttclid=vm_smoke_20260502' \
  --data '{
    "source": "biocom_imweb",
    "site": "biocom",
    "landing": "https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=vm_smoke&ttclid=vm_smoke_20260502",
    "referrer": "https://www.tiktok.com/",
    "utmSource": "tiktok",
    "utmMedium": "paid",
    "utmCampaign": "vm_smoke",
    "ttclid": "vm_smoke_20260502",
    "captureMode": "smoke",
    "metadata": {
      "source": "biocom_imweb",
      "site": "biocom",
      "clientId": "vm-smoke-client",
      "userPseudoId": "vm-smoke-client",
      "ttp": "vm-smoke-ttp"
    }
  }'
```

성공 기준:

- 201 저장 또는 같은 payload 재실행 시 200 duplicate
- `metadata.intentChannel=tiktok`
- `metadata.strictTikTokMarketingIntentReasons` 있음
- `metadata.marketingIntentDedupe.tier=ttclid`

## 롤백 기준

아래 중 하나라도 발생하면 GTM Preview/Publish를 멈추고 VM receiver를 롤백한다.

- 일반 direct 페이지가 저장됨
- biocom 외 origin이 저장됨
- PII payload가 저장됨
- `payment_success` top-level source/ttclid가 덮임
- 기존 Purchase Guard 동작에 영향
- 5xx 증가 또는 PM2 restart 반복

## 다음 할일

| 순서 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 컨펌 필요 | 자신감 |
|---:|---|---|---|---|---|---:|
| 1 | Codex | VM 배포 승인 요청 후 receiver 배포 | GTM Preview 전에 서버 수신점이 필요하다 | 백업 → 변경 파일 반영 → node check → PM2 restart → health 확인 | YES | 88% |
| 2 | Codex | VM receiver smoke test | 실제 `att.ainativeos.net`에서 저장되는지 확인해야 한다 | 위 curl payload 실행 후 VM SQLite row 확인 | NO, 배포 후 smoke | 90% |
| 3 | TJ | GTM Preview tag 생성 | 아임웹 코드 추가 없이 클릭 intent를 잡기 위해서다 | `tiktok/tiktok_marketing_intent_gtm_v1.md` 코드 사용 | NO, preview | 86% |
| 4 | TJ + Codex | 같은 브라우저 카드 결제 firstTouch 검증 | 클릭 intent가 실제 구매 후보로 연결되는지 확인한다 | 테스트 URL 진입 → 카드 결제 → `metadata.firstTouch` 확인 | YES, 실제 주문 테스트 | 84% |
| 5 | TJ | 결과 보고 후 Production publish 여부 결정 | publish는 광고 측정에 영향을 주므로 별도 승인으로 닫는다 | preview 결과와 smoke 결과를 보고 YES/NO 결정 | YES | 82% |
