작성 시각: 2026-05-26 20:10 KST
기준일: 2026-05-26
문서 성격: Google Ads 실제 구매 전환 no-send private payload preview 구현 메모

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
  lane: Green
  allowed_actions:
    - backend route implementation
    - no-send private payload preview
    - local typecheck
    - read-only smoke
  forbidden_actions:
    - Google Ads conversion upload
    - operational DB write
    - VM Cloud write
    - backend deploy without approval
    - Google Ads primary/secondary setting change
  source_window_freshness_confidence:
    source: 운영DB payment order snapshot + VM Cloud click evidence
    window: last_7d
    freshness: local smoke는 로컬 backend data 기준, VM Cloud live public endpoint는 read-only cross-check
    confidence: medium-high for implementation, medium for local candidate count because local/live source differs
```

## 10초 요약

이번 구현은 Google Ads에 실제 구매를 보내기 직전, 원문 주문번호와 원문 gclid가 서버 안에 있는지만 안전하게 확인하는 장치다.

응답에는 원문 주문번호와 원문 gclid를 내보내지 않는다. 대신 `있음/없음`, 해시 형태의 안전 참조값, 통과 여부만 보여준다.

외부 전송은 0건이다. 이 endpoint는 실제 Google Ads 전송을 여는 장치가 아니라, 전송 전에 필요한 원문값이 서버 안에 있는지 확인하는 no-send 미리보기다.

## 구현 위치

- Backend route: `/Users/vibetj/coding/seo/backend/src/routes/googleAds.ts`
- Endpoint: `GET /api/google-ads/confirmed-purchase/private-payload-preview?site=biocom&window=last_7d&limit=2`

## 무엇을 확인하나

1. 실제 결제완료 주문인지 본다.
2. 서버 내부에 원문 주문번호가 있는지 본다.
3. 서버 내부에 원문 gclid가 있는지 본다.
4. 실제 결제완료 시각이 있는지 본다.
5. 결제금액이 0원보다 큰지 본다.
6. 통화가 KRW인지 본다.
7. 취소, 환불, 반품 신호가 없는지 본다.
8. 중복 전송 방지 key를 만들 수 있는지 본다.
9. 실제 구매 전용 Google Ads 전환 액션이 `BI confirmed_purchase_offline`인지 본다.

## 일부러 하지 않는 것

- Google Ads에 전환을 보내지 않는다.
- 운영DB에 쓰지 않는다.
- VM Cloud 원장에 쓰지 않는다.
- Google Ads 전송 이력 장부를 아직 열지 않는다.
- 원문 주문번호와 원문 gclid를 응답, 문서, 대화에 노출하지 않는다.

## 안전 응답 불변 조건

응답에는 아래 값이 항상 같이 있어야 한다.

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

## 현재 검증

- `npm run typecheck`: 통과
- 로컬 API smoke: endpoint는 200 응답, 원문 노출 불변 조건 통과
- 로컬 후보 수: 0건
- VM Cloud live public diagnostic cross-check: 최근 7일 Google click id 주문 4건 중 gclid 단일 실제 결제완료 후보는 2건으로 보임

## 해석

로컬 후보 0건은 구현 실패라기보다 source 차이로 보는 것이 맞다.

현재 로컬 backend가 보는 click evidence와 VM Cloud live가 보는 click evidence가 다르다. VM Cloud backend에 같은 route가 배포되면 live public diagnostic에서 보이던 2건이 private preview 후보로 나올 가능성이 높다.

다만 배포는 Yellow Lane이다. 이 문서는 배포 승인이 아니라, 배포 전 코드 구현과 no-send 설계 확인이다.

## 다음 판단

현재 진척률은 다음처럼 본다.

- private payload preview 구현: 88%
- Google Ads 실제 구매 주 전환 시작 준비: 82%
- 실제 Google Ads 전송 준비: 0%, 아직 전송 승인 전이고 upload ledger가 없다.

100%에 가까워지려면 다음이 필요하다.

1. VM Cloud backend에 route를 배포한다.
2. 같은 endpoint가 후보 2건을 안전하게 반환하는지 smoke한다.
3. 응답에 원문 주문번호/gclid가 없는지 다시 확인한다.
4. 그 다음에야 Google Ads 제한 전송 승인안을 따로 판단한다.
