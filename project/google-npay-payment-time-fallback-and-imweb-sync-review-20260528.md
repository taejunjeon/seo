작성 시각: 2026-05-28 21:09 KST
기준일: 2026-05-28
문서 성격: Google Ads 실제 구매 전환 / NPay 결제완료 판정 / Imweb 주문 sync 주기 검토 메모
site: biocom

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - data/!data_inventory.md
    - data/attribution-data-source-decision-guide-20260511.json
  lane: Yellow
  allowed_actions:
    - local_code_change
    - local_typecheck
    - local_fixture_dry_run
    - read_only_health_check
    - documentation_update
    - approved_vm_cloud_backend_deploy
    - post_deploy_health_smoke
    - post_deploy_read_only_api_smoke
  forbidden_actions:
    - google_ads_conversion_send
    - production_db_write
    - gtm_publish
    - imweb_api_setting_change
  source_window_freshness_confidence:
    source: "local code + temp SQLite fixture + VM Cloud /health + VM Cloud read-only dry-run API"
    window: "2026-05-28 20:00~21:00 KST fixture + VM Cloud smoke 2026-05-28 21:20 KST"
    freshness: "high for code/fixture/deploy smoke, medium for 5분 비용 추정"
    confidence: "medium_high"
```

## 10초 요약

NPay 실제 결제완료 판정은 `complete_time`만 보면 안 된다.

2026-05-28 테스트 주문처럼 NPay 외부 결제는 `complete_time`이 비어 있어도 원문 결제 블록의 `payment.payment_time`에는 결제완료 시각이 들어올 수 있다. 그래서 Google Ads 실제 구매 후보 생성기는 `complete_time`을 먼저 보고, 비어 있으면 `payment.payment_time`으로 결제완료를 판단하도록 보강했다.

Imweb 주문 자동 sync는 현재 15분이다. 5분으로 줄이는 것은 서버비 관점에서는 큰 부담이 아니지만, Imweb API 호출량이 3배가 되고 지금 코드에는 중복 실행 방지 잠금이 없어서 바로 5분으로 낮추기보다 `skip-if-running` 잠금과 함께 줄이는 것이 맞다.

## 무엇이 가능해졌나

NPay 결제완료 주문이 아래처럼 들어와도 실제 결제완료 후보로 잡을 수 있다.

- `complete_time`: 비어 있음
- `payment.payment_time`: 있음
- `payment_amount`: 0보다 큼
- `pay_type` 또는 원문 결제정보: NPay/Naver 계열
- 취소/환불/반품 신호: 없음

이제 이런 주문은 `paidAtBasis=vm_payment_time`으로 표시된다.

## 왜 중요한가

Google Ads에 실제 구매만 알려주려면 먼저 "실제 구매완료 주문"을 정확히 골라야 한다.

기존처럼 `complete_time`만 보면 NPay 외부 결제완료가 미결제처럼 빠질 수 있다. 그러면 실제 구매가 있었는데 Google Ads 전송 후보가 0건으로 보이고, 주 전환 학습이 늦어진다.

## 구현 요약

수정 파일:

- `backend/src/npayRoasDryRun.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`

주요 변경:

- VM Cloud `imweb_orders`를 실제 결제완료 후보 source로 추가했다.
- `complete_time` / `complete_time_unix`가 있으면 우선 사용한다.
- 둘 다 없으면 `raw_json.payment.payment_time`, `raw_json.paymentTime`, `raw_json.payment_time`을 결제완료 시각 fallback으로 사용한다.
- 취소/환불/반품/교환/만료 신호가 있으면 제외한다.
- `payment_amount` 또는 `total_price`가 0 이하이면 제외한다.
- 운영DB 주문과 VM Cloud 주문이 중복될 때는 운영DB 주문을 우선하고, 운영DB에 아직 없는 최신 VM 주문만 보강한다.
- Imweb 주문 자동 sync는 5분 전환 전 단계로 `skip-if-running` 잠금을 추가했다.
  - 이전 sync가 아직 도는 중이면 다음 interval은 건너뛴다.
  - 지금은 주기 env를 바꾸지 않았으므로 운영 주기는 여전히 15분이다.

## 검증 결과

### 로컬 타입체크

명령:

```bash
npm --prefix backend run typecheck
```

결과:

- 통과

### fixture dry-run

목적:

- `complete_time`은 비어 있고 `payment.payment_time`만 있는 NPay 주문이 결제완료로 잡히는지 확인

결과:

- `confirmedNpayOrderCount=1`
- `status=strong_match`
- `strongGrade=A`
- `paidAtBasis=vm_payment_time`
- `paymentStatus=PAYMENT_COMPLETE_BY_NPAY_PAYMENT_TIME`
- `amount=35000`

해석:

- 이번 패치의 핵심 동작은 로컬에서 확인됐다.
- VM Cloud 배포 전 핵심 동작은 로컬에서 확인됐다.

### VM Cloud backend 배포

배포 시각:

- 2026-05-28 21:19~21:20 KST

배포 범위:

- `/home/biocomkr_sns/seo/repo/backend/src/npayRoasDryRun.ts`
- `/home/biocomkr_sns/seo/repo/backend/src/bootstrap/startBackgroundJobs.ts`

배포 방식:

- 전체 repository sync가 아니라 `/tmp` 업로드 후 `sudo install`로 파일 2개만 교체했다.
- 원격 `backend/src` 디렉터리 소유권이 오래된 UID라서 rsync 임시파일 생성이 막혔기 때문이다.
- VM Cloud SQLite는 배포 전 스냅샷을 생성했다.

검증:

- VM `npm run typecheck`: 통과
- VM `npm run build`: 통과
- `pm2 restart seo-backend --update-env`: 성공
- `seo-backend`: online
- `/health`: `status=ok`

### VM Cloud read-only API smoke

대상:

- 2026-05-28 20:00~21:00 KST
- `channel_order_no=2026052859664900`

결과:

- `confirmedNpayOrderCount=1`
- `paidAtBasis=vm_payment_time`
- `paidAt=2026-05-28T11:32:15.000Z`
- `status=ambiguous`
- `orderCreateBridgeExact=1`
- `orderCreateBridgeExactWithGoogleClickId=1`

해석:

- 결제완료 fallback은 VM Cloud 운영 API에서도 동작한다.
- 다만 해당 주문은 같은 시간대 NPay intent 후보가 여러 개라서 아직 Google Ads 자동 전송 후보가 아니다.
- 즉 "실제 결제완료로 읽기"는 해결됐고, "어떤 버튼 클릭과 1:1로 붙일지"가 다음 병목이다.

## Imweb 자동 sync 15분에서 5분 변경 검토

### 현재 운영 값

VM Cloud `/health` read-only 기준:

- `imwebAutoSync.enabled=true`
- `imwebAutoSync.intervalMs=900000`
- `maxPage=30`

즉 현재는 15분마다 biocom, thecleancoffee 주문 sync를 순차 실행한다.

### 5분으로 바꾸면 호출량이 어떻게 늘어나는가

현재:

- 15분마다 1회 cycle
- 1시간에 4 cycle
- 2개 site를 순차 호출하므로 site 단위 호출은 시간당 8회

5분 변경:

- 5분마다 1회 cycle
- 1시간에 12 cycle
- 2개 site 기준 site 단위 호출은 시간당 24회

즉 단순 호출 빈도는 3배가 된다.

### 서버비 영향

서버비 자체는 큰 폭으로 늘 가능성이 낮다.

이 작업은 heavy compute가 아니라 Imweb API를 가져와 SQLite에 upsert하는 작업이다. Cloudflare/VM CPU 비용보다 외부 API 호출량과 작업 겹침이 더 중요한 리스크다.

### 기술 리스크

현재 코드는 `setInterval(runImwebOrdersSync, interval)` 구조다. `runImwebOrdersSync` 내부에서 biocom과 thecleancoffee를 순차 처리하고, 각 site self-call timeout은 90초다.

문제는 이전 5분 cycle이 아직 끝나지 않았는데 다음 cycle이 시작될 수 있다는 점이다. 평소에는 괜찮아도 Imweb API가 느리거나 429가 나면 sync가 겹칠 수 있다.

### 권장안

바로 5분으로 낮추는 것보다 아래 순서가 안전하다.

1. `imwebRunning` 잠금을 추가한다.
   - 이전 sync가 끝나지 않았으면 다음 sync는 건너뛴다.
2. `IMWEB_AUTO_SYNC_INTERVAL_MS=300000`으로 낮춘다.
3. `maxPage=30`은 유지하되, 24시간 동안 429/timeout/중복 실행 로그를 본다.
4. 문제가 있으면 10분으로 되돌리거나 biocom만 5분, coffee는 15분으로 분리한다.

## complete_time과 payment.payment_time 역할

### complete_time

`complete_time`은 Imweb 주문 row의 상위 필드다. 코드에서는 `order.complete_time`을 ISO 시간으로 변환해 `imweb_orders.complete_time`에 저장한다.

좋은 점:

- 상위 필드라 읽기 쉽다.
- 과거 코드와 화면이 이미 많이 참고한다.

주의점:

- NPay 외부 결제완료 주문에서는 비어 있을 수 있다.
- 비어 있다고 미결제로 보면 안 된다.
- 현재 문서/코드에서도 legacy 진단값으로 취급하는 곳이 있다.

### payment.payment_time

`payment.payment_time`은 Imweb 원문 JSON 안의 결제 블록에 들어 있는 결제 시각이다.

좋은 점:

- 이번 NPay 테스트처럼 실제 결제완료 시각이 여기에만 들어오는 케이스가 있다.
- NPay 외부 결제완료 판정에 유용하다.

주의점:

- 현재 별도 컬럼이 아니라 `raw_json` 안에 들어 있다.
- 매번 JSON을 파싱해야 하므로 조회/집계용으로는 불편하다.

### 하나로 통합해도 되는가

지금은 통합하지 않는 것이 맞다.

이유:

- 두 필드는 source가 다르다.
- `complete_time`이 비어 있는 것이 데이터 오류인지, NPay 외부 결제 특성인지 구분해야 한다.
- 기존 화면/쿼리가 `complete_time`을 이미 legacy 진단값으로 사용한다.

대신 추천하는 방식:

- 원문 필드는 그대로 둔다.
- 분석/전송 후보 생성기는 파생값 `paidAt`과 `paidAtBasis`를 쓴다.

예:

- `paidAt=2026-05-28T11:32:15.000Z`
- `paidAtBasis=vm_payment_time`

나중에 성능이 필요해지면 새 파생 컬럼을 추가할 수 있다.

- `payment_time`
- `paid_at`
- `paid_at_source`

다만 이건 DB schema 변경이므로 별도 승인 범위다.

## 하지 않은 것

- Google Ads 전송하지 않음
- 운영DB write하지 않음
- GTM publish하지 않음
- Imweb sync 주기 env 변경하지 않음

## 다음 판단

이번 패치는 VM Cloud 기준으로 반영됐다.

2026-05-28 20:30 KST NPay 테스트 주문은 결제완료 fallback으로 잡힌다.

Imweb sync 5분 전환은 이제 잠금 준비가 됐다. 다음 단계는 운영 env의 `IMWEB_AUTO_SYNC_INTERVAL_MS=300000` 전환 여부를 판단하는 것이다.
