작성 시각: 2026-05-26 21:53 KST
기준일: 2026-05-26
문서 성격: Google Ads 실제 구매 전용 제한 전송 승인안 초안

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
  lane: Red for actual Google Ads send, Green for this approval draft and no-send dry-run
  allowed_actions:
    - no_send_payload_preview
    - duplicate_ledger_dry_run
    - approval_packet_draft
    - local_typecheck
    - api_smoke_without_send
  forbidden_actions:
    - google_ads_conversion_upload
    - google_ads_primary_secondary_setting_change
    - production_db_write
    - vm_cloud_ledger_write
    - gtm_publish
    - imweb_code_change
    - actual_payment_test
  source_window_freshness_confidence:
    source: VM Cloud live private preview API + VM Cloud duplicate ledger dry-run API + VM Cloud write smoke plan/candidate expansion no-write API
    window: last_7d
    freshness: 2026-05-26 21:53 KST VM Cloud no-write API smoke + write smoke final 실행안 작성
    confidence: high for no-send/no-write readiness, blocked for actual Google Ads send until Red approval
```

## 10초 요약

이 문서는 Google Ads에 “실제 결제완료 주문만 구매로 알려주는 제한 전송”을 할지 결정하기 위한 초안이다. 지금 바로 전송하지 않는다. 먼저 후보 2건을 no-send로 만들고, 같은 후보를 다시 넣으면 중복으로 막히는지 dry-run 장부로 확인한다.

현재 목표는 Google Ads가 학습할 핵심 구매 신호를 `NPay 버튼 클릭/결제진입`이 아니라 `실제 결제완료 주문`으로 바꾸는 것이다. 단, Google Ads 전송은 광고 플랫폼 수치가 바뀌는 Red Lane이라 TJ님 명시 승인 전에는 실행하지 않는다.

## 이번 승인안이 다루는 것

### 승인하려는 실제 행동

TJ님이 나중에 승인하면 Codex가 아래 범위 안에서만 실행한다.

1. `BI confirmed_purchase_offline` 전환 액션으로 실제 결제완료 후보를 최대 2건만 Google Ads에 전송한다.
2. 전송 전 후보 2건의 원문 주문번호, 원문 gclid, 결제완료 시각, 금액, 취소/환불 여부는 서버 내부에서만 확인한다.
3. 응답, 보고서, 문서에는 원문 주문번호와 원문 click id를 노출하지 않는다.
4. 같은 후보가 두 번 보내지지 않도록 중복 전송 방지 장부 키를 먼저 확인한다.

### 승인해도 하지 않는 것

- 기존 `NPay 버튼 클릭/결제진입(보조)` 전환을 다시 Primary로 올리지 않는다.
- 기존 Google Ads 전환 이름, 목표, 예산, 캠페인 설정을 바꾸지 않는다.
- GTM Production publish를 하지 않는다.
- 운영DB에 쓰지 않는다.
- VM Cloud upload ledger에 실제 write하지 않는다. 별도 write 승인이 필요하다.
- 2건을 초과해 보내지 않는다.

## 왜 필요한가

Google Ads가 지금까지 “구매”로 보던 신호에는 실제 결제완료가 아닌 NPay 버튼 클릭/결제진입 신호가 섞일 수 있었다. 이 상태에서는 Google Ads ROAS가 좋아 보여도, 실제 매출과 다른 방향으로 광고 학습이 될 수 있다.

우리가 원하는 상태는 단순하다.

1. 고객이 광고를 클릭한다.
2. 실제로 결제완료가 된다.
3. 취소/환불/반품이 아니다.
4. 그 주문에 Google click id가 직접 붙어 있다.
5. 이 주문만 Google Ads에 구매로 알려준다.

## 현재 준비도

현재 준비도는 88%로 본다.

- 실제 결제완료 주문만 고르는 기준: 준비됨.
- 원문 주문번호와 원문 gclid를 서버 내부에서만 확인하는 private preview: 준비됨.
- 후보 2건을 no-send로 만드는 기능: 준비됨.
- 중복 전송 방지 장부 dry-run: VM Cloud live API 통과.
- 장부 write smoke plan: VM Cloud no-write API 통과.
- 실제 구매 후보 확대 분류: VM Cloud no-send API 통과.
- 실제 장부 write: 아직 하지 않음.
- Google Ads 실제 전송: 아직 하지 않음.

다음 기준점은 `VM Cloud 장부 write smoke 통과 = 92%`다. 그 다음 `Google Ads 제한 전송 2건 수신 확인 = 95%`로 본다.

100%가 되려면 아래 3개가 남았다.

1. VM Cloud에 실제 전송 이력을 남길 SQLite 장부 테이블을 만들지 결정해야 한다.
2. Google Ads 전송 없이 후보 최대 2건을 `ready` row로만 쓰는 write smoke를 통과해야 한다.
3. TJ님이 “최대 2건 제한 전송”을 별도로 명시 승인해야 한다.

## 제한 전송 조건

아래 조건이 모두 맞을 때만 전송 후보가 된다.

1. 실제 결제완료 주문이다.
2. 금액이 0원보다 크다.
3. 취소, 환불, 반품 신호가 없다.
4. 원문 주문번호가 있다.
5. 원문 gclid가 있다.
6. gbraid/wbraid가 같이 섞이지 않는다.
7. 전환 액션은 `BI confirmed_purchase_offline` 하나만 쓴다.
8. 중복 전송 방지 키가 만들어진다.
9. 같은 키를 다시 넣으면 dry-run에서 중복으로 막힌다.
10. TJ님이 실제 Google Ads 전송을 명시 승인한다.

## 중단 조건

아래 중 하나라도 나오면 전송하지 않는다.

- 후보 중 원문 주문번호가 비어 있다.
- 후보 중 원문 gclid가 비어 있다.
- 결제완료 시각을 해석할 수 없다.
- 금액이 0원 이하이거나 KRW가 아니다.
- 취소, 환불, 반품 신호가 있다.
- 같은 중복 키가 후보 안에서 이미 겹친다.
- Google Ads API 권한 또는 계정 오류가 난다.
- TJ님 승인 범위인 최대 2건을 초과해야 한다.

## 실행 화면 기준

TJ님이 나중에 승인해야 하는 문장은 아래처럼 충분히 구체적이어야 한다.

> `BI confirmed_purchase_offline` 전환 액션에 대해, 2026-05-26 기준 private preview와 duplicate ledger dry-run을 통과한 실제 결제완료 후보 최대 2건만 Google Ads에 제한 전송하는 것을 승인한다. 기존 NPay 버튼 클릭/결제진입 보조 전환과 캠페인/예산/GTM 설정은 변경하지 않는다.

이 문장이 나오기 전에는 Codex가 Google Ads로 전송하지 않는다.

## 주 전환 승격 일정

`Primary 전환`은 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호다. 지금 기존 버튼 클릭/결제진입 전환은 보조 신호로 내려갔으므로, 실제 구매 전용 전환을 너무 늦게 올리면 Google Ads는 한동안 정확한 구매 학습을 하지 못한다.

권장 일정은 아래다.

1. VM Cloud 장부 write smoke를 먼저 통과시킨다.
2. 통과 직후 후보 최대 2건만 `BI confirmed_purchase_offline`에 제한 전송한다.
3. Google Ads 화면/API에서 2건 수신, 금액, 중복 0을 확인한다.
4. 확인 후 24시간 안에 `BI confirmed_purchase_offline`을 Primary 전환 후보로 승격한다.

기다릴 이유는 크지 않다. 후보 2건은 학습량이 작지만, 잘못된 버튼 클릭 신호를 Primary로 유지하는 것보다 실제 결제완료 신호를 작게라도 시작하는 편이 낫다.

단, 승격은 Google Ads 설정 변경이므로 Red Lane이다. TJ님이 화면에서 직접 변경하거나, Codex가 UI를 안내하더라도 명시 승인 전에는 실행하지 않는다.

## 검증 기준

제한 전송 전 검증 기준은 아래다.

- private preview 후보 2건.
- 원문값 내부 확인 2/2건.
- 중복 전송 dry-run 후보 2건.
- simulated replay 2건 모두 중복 차단.
- 실제 Google Ads 전송 0건.
- 운영DB write 0건.
- VM Cloud write 0건.
- raw order/click id 응답 노출 없음.

## 다음 할일

### Auto Green

1. Codex가 로컬 중복 전송 방지 dry-run API를 typecheck와 smoke로 확인한다.
2. Codex가 VM Cloud 배포 승인 전까지는 로컬 구현과 문서만 유지한다.

### Approval Needed

1. VM Cloud backend 배포가 필요하면 TJ님이 배포를 승인한다.
2. 실제 Google Ads 제한 전송은 별도 Red Lane 승인 문구가 필요하다.

### Blocked/Parked

1. 실제 전송 장부 write는 아직 하지 않는다.
2. 자동 dispatcher는 아직 켜지 않는다.
