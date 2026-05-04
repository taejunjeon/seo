# GDN Approval Gates

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
목적: Google Ads/GDN ROAS 작업에서 TJ님 승인 전 금지되는 작업과 승인 문서 기준을 고정한다
관련 문서: [[harness/gdn/README|GDN Harness]], [[harness/gdn/RULES|GDN Rules]], [[harness/gdn/VERIFY|GDN Verify]]

## 10초 요약

읽기와 dry-run은 Codex가 자율 진행한다.

Google Ads 전환 액션 변경, conversion upload, 캠페인 예산/상태 변경, GTM Production publish는 TJ님 명시 승인 전 금지다.

## 승인 레벨

| Level | 작업 | 승인 필요 | 기본값 |
|---|---|---|---|
| L0 | 문서 읽기/수정, report 작성 | NO | 허용 |
| L1 | Google Ads/GTM/GA4/Attribution VM read-only 조회 | NO | 허용 |
| L2 | ROAS dry-run, offline conversion payload preview | NO | 허용 |
| L3 | 승인안 작성, auditor report 작성 | NO | 허용 |
| L4 | backend route 배포, VM deploy, GTM Preview workspace | YES, Yellow | 금지 |
| L5 | GTM Production publish, Google Ads 전환 액션 변경 | YES, Red | 금지 |
| L6 | Google Ads conversion upload 또는 adjustment upload | YES, Red | 금지 |
| L7 | Google Ads budget/status 변경 | YES, Red | 금지 |
| L8 | 운영DB write/import apply | YES, Red | 금지 |

## Green Lane

승인 없이 가능하다.

1. Google Ads API read-only query.
2. 전환 액션별 gap driver 계산.
3. 내부 confirmed ROAS 재계산.
4. GTM/아임웹 label read-only grep.
5. offline conversion payload preview.
6. conversion adjustment preview.
7. 승인 요청서 작성.
8. 문서와 dashboard read-only UI 수정.

## Yellow Lane

스프린트 단위 승인 후 가능하다.

| 작업 | 승인 문서 필수 항목 |
|---|---|
| VM/backend deploy | 배포 파일, rollback, health check, no-send 보장 |
| GTM Preview workspace | workspace 이름, tag/trigger 범위, production publish 금지 |
| controlled smoke | max duration, max inserts, cleanup, success/stop criteria |
| `.env` 임시 flag | flag 이름, duration, cleanup, restart 검증 |

Yellow 승인 후에도 Google Ads conversion upload와 GTM Production publish는 금지다.

## Red Lane

TJ님 명시 승인 전 절대 실행하지 않는다.

| Red 작업 | 이유 |
|---|---|
| `구매완료` action `7130249515` primary 해제 | Google Ads 자동입찰 목표 변경 |
| 새 Google Ads purchase conversion 생성 | 입찰 학습 목표 생성 |
| Google Ads offline conversion upload | 전환값과 학습에 직접 영향 |
| conversion adjustment upload | 과거 전환값 조정 |
| Google Ads 캠페인 pause/enable/budget 변경 | 광고비와 매출에 직접 영향 |
| GTM Production publish | 사이트 전체 tracking 변경 |
| GA4/Meta/TikTok 전송 | 외부 플랫폼 전환값 변경 |
| 운영DB write | 주문 원장 변경 |
| 실제 결제 테스트 | 비용/주문 발생 |

## Primary Action Change Gate

`구매완료` action `7130249515`를 Primary에서 내리는 승인안에는 아래가 있어야 한다.

| 항목 | 필수 내용 |
|---|---|
| action id/name | `7130249515`, `구매완료` |
| 현재 label | `AW-304339096/r0vuCKvy-8caEJixj5EB` |
| 현재 영향 | `Conv. value`, conversions, ROAS 기여도 |
| 근거 | Google Ads API + footer/Imweb code + GTM snapshot |
| 변경 방식 | Secondary 전환, account-default 목표 제외, 또는 다른 방식 |
| 예상 영향 | 자동입찰 학습 흔들림, 7~14일 관찰 필요 |
| rollback | 다시 Primary로 복귀 가능한지 |
| 금지선 | 새 conversion upload는 별도 승인 |

## Confirmed Purchase Conversion Gate

confirmed 주문 기반 Google Ads purchase 경로 승인안에는 아래가 있어야 한다.

| 항목 | 필수 내용 |
|---|---|
| 전송 방식 | client-side tag 또는 offline conversion import |
| 대상 주문 | order_id / transaction_id / amount / conversion_time |
| 식별자 | gclid / gbraid / wbraid presence |
| 중복 방지 | order id, conversion action, upload idempotency |
| excluded rows | pending, canceled, NPay click-only, unknown click id |
| dry-run 결과 | send_candidate=N/Y preview |
| rollback 한계 | 이미 보낸 conversion은 삭제가 어렵다는 점 |
| post-send 검증 | Google Ads conversion diagnostics 또는 report 확인 방법 |

## Conversion Adjustment Gate

취소/환불 보정 승인안에는 아래가 있어야 한다.

1. 원 conversion action.
2. order id 또는 transaction id.
3. adjustment type: retraction 또는 restatement.
4. adjustment time.
5. adjusted value.
6. 내부 취소/환불 source.
7. 기존 Google Ads conversion 존재 여부.

## Approval 문구 예시

좋은 승인:

```text
YES: Google Ads UI에서 action 7130249515 `구매완료`를 account-default purchase primary에서 제외한다.
새 conversion upload, GTM publish, 캠페인 예산 변경은 금지한다.
변경 후 7일 동안 `/ads/google`과 내부 confirmed ROAS를 매일 관찰한다.
```

나쁜 승인:

```text
YES: 구글 ROAS 고쳐.
```

나쁜 이유:

- 어떤 action인지 없다.
- conversion upload 여부가 없다.
- 캠페인 예산 변경 금지선이 없다.
- rollback/관찰 기준이 없다.

## 승인 만료 조건

승인은 아래 상황에서 다시 받아야 한다.

1. action id 또는 label이 바뀌었다.
2. source window가 바뀌었다.
3. Google Ads access level이 바뀌었다.
4. dry-run 후보 주문이 바뀌었다.
5. 전송 platform이 바뀌었다.
6. payload 필드가 바뀌었다.
7. 24시간 이상 지연되어 전환 시각/attribution risk가 달라졌다.
