작성 시각: 2026-05-26 20:33 KST
기준일: 2026-05-26
문서 성격: Google Ads 실제 구매 전환 no-send private payload preview VM Cloud 배포 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
  required_context_docs:
    - project/google-ads-confirmed-only-nosend-builder-20260526.md
    - project/google-ads-private-payload-preview-implementation-20260526.md
  lane: Yellow
  approval:
    approved_by: TJ
    approved_action: VM Cloud backend deploy
  allowed_actions:
    - scoped backend route file backup
    - scoped backend route file deploy
    - VM Cloud backend typecheck
    - VM Cloud backend build
    - PM2 seo-backend restart
    - read-only API smoke
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads primary/secondary setting mutation
    - operational DB write
    - VM Cloud SQLite write
    - raw order id or raw click id exposure
  source_window_freshness_confidence:
    source: VM Cloud live backend API
    window: last_7d
    freshness: smoke at 2026-05-26 20:32 KST
    confidence: high for deployment, high for no-send invariant, medium-high for candidate count
```

## 10초 요약

Google Ads에 실제 결제완료 주문만 보내기 전, 서버 내부에서 원문 주문번호와 원문 gclid가 있는지만 확인하는 private preview API를 VM Cloud에 배포했다.

운영 smoke 결과, 최근 7일 기준 실제 결제완료이면서 원문 gclid가 서버 안에서 확인되는 후보 2건이 잡혔다. 응답에는 원문 주문번호와 원문 click id가 나오지 않았다.

이번 배포는 no-send다. Google Ads 전송, 광고 설정 변경, 운영DB write, VM Cloud 원장 write는 모두 0건이다.

## 배포 범위

- 배포 파일: `backend/src/routes/googleAds.ts`
- VM Cloud 경로: `/home/biocomkr_sns/seo/repo/backend/src/routes/googleAds.ts`
- 백업 경로: `/home/biocomkr_sns/seo/repo/.deploy-backups/google-ads-private-preview-20260526T202858KST/`
- PM2 app: `seo-backend`
- API:
  - `GET /api/google-ads/confirmed-purchase/private-payload-preview?site=biocom&window=last_7d&limit=2`

전체 repo rsync는 하지 않았다. 이번 변경 파일만 백업 후 반영했다.

## 검증 결과

### VM 빌드 검증

- VM `npm run typecheck`: 통과
- VM `npm run build`: 통과
- PM2 `seo-backend` restart: 성공
- PM2 상태: online

### 운영 API smoke

Smoke 기준 시각: 2026-05-26 20:32 KST

결과:

- mode: `private_no_send_payload_preview`
- source order rows: 458
- exact gclid actual purchase rows: 2
- returned candidates: 2
- private raw value checks passed: 2
- upload candidate count: 0
- send candidate count: 0
- health endpoint: 200 OK

## 안전 불변 조건

운영 API 응답에서 아래 조건을 확인했다.

```json
{
  "rawOrderIdInResponse": false,
  "rawClickIdInResponse": false,
  "uploadCandidateCount": 0,
  "sendCandidateCount": 0,
  "externalSendCount": 0,
  "operationalDbWrite": 0,
  "vmCloudWrite": 0,
  "googleAdsWrite": 0
}
```

추가로 응답 key scan에서 원문 주문번호나 원문 click id를 직접 담는 key는 발견되지 않았다.

## 사람이 이해할 결론

이제 “Google Ads에 실제 구매를 알려줄 수 있는 주문이 서버 안에 있는지”를 안전하게 확인할 수 있다.

현재 최근 7일에는 2건이 원문값 점검을 통과했다. 다만 아직 Google Ads에 보내도 되는 상태는 아니다. 이유는 두 가지다.

1. Google Ads 전송 승인을 아직 받지 않았다.
2. 중복 전송을 막는 전송 장부를 아직 실제 write로 연결하지 않았다.

따라서 지금 상태는 `보낼 수 있는지 내부 확인 가능`, `아직 보내지는 않음`이다.

## 하지 않은 것

- Google Ads 전환 업로드를 하지 않았다.
- Google Ads 설정을 바꾸지 않았다.
- 운영DB에 쓰지 않았다.
- VM Cloud SQLite 원장에 쓰지 않았다.
- 원문 주문번호, 원문 gclid, 원문 gbraid, 원문 wbraid를 문서나 대화에 출력하지 않았다.

## 남은 리스크

- 최근 7일 후보 2건은 실제 전송 전 후보일 뿐이다. Google Ads에 보내려면 별도 Red Lane 승인과 중복 전송 장부가 필요하다.
- NPay 외부 결제완료 주문은 아직 대부분 Google Ads 전송 후보로 승격되지 않았다. NPay bridge는 no-write 후보표를 계속 넓혀야 한다.
- 기존 Google Ads의 `NPay 버튼 클릭/결제진입(보조)` 신호와 실제 결제완료 전용 신호는 계속 분리해서 봐야 한다.

## 다음 할일

### Auto Green

1. 최근 7일 후보 2건의 private check 항목을 화면 보고서에 요약한다.
   - 담당: Codex
   - 목적: TJ님이 원문값을 보지 않고도 전송 준비도를 판단할 수 있게 한다.
   - 성공 기준: 보고서에 `actual purchase`, `exact gclid`, `value`, `currency`, `cancel/refund guard`, `send approval`, `upload ledger`가 통과/미통과로 보인다.

2. NPay bridge 후보를 no-write 표로 계속 넓힌다.
   - 담당: Codex
   - 목적: NPay 실제 결제완료 매출도 Google Ads 실제 구매 전환 후보로 올릴 수 있는지 확인한다.
   - 성공 기준: NPay 후보마다 `실제 결제완료`, `내부 주문 연결`, `Google click id 직접/간접 증거`, `전송 불가 이유`가 분리된다.

### Approval Needed

1. Google Ads 실제 구매 전환 제한 전송 승인안 작성
   - 담당: Codex 작성, TJ님 승인
   - 목적: 후보 2건을 실제 Google Ads에 보낼지 판단한다.
   - 승인 전 금지: 실제 upload, 전송 장부 write, Google Ads primary 전환 변경.

### Blocked / Parked

1. Google Ads 실제 전송
   - 보류 이유: Red Lane이다. 실제 광고 플랫폼에 구매 신호를 보내고 머신러닝에 영향을 줄 수 있다.
   - 필요한 조건: 전송 장부, 중복 방지, 제한 후보, 롤백/중단 기준, TJ님 명시 승인.
