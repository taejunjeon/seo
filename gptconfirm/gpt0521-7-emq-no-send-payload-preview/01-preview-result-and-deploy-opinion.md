작성 시각: 2026-05-21 11:22 KST
기준일: 2026-05-21
문서 성격: no-send payload preview 상세와 배포 판단

## 결론

전화번호 해시(`ph`)와 site-scoped 외부 ID(`external_id`)는 지금 바로 payload 후보로 만들 수 있다.

현재 Meta CAPI Purchase payload에는 두 필드가 0건이다. 하지만 VM Cloud의 confirmed purchase와 Imweb 주문 cache를 조인하면 최근 7일 기준 바이오컴 365/365건, 더클린커피 164/164건에서 후보가 생긴다.

## 데이터 기준

- Source: VM Cloud SQLite `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3`
- Send log: VM Cloud `/home/biocomkr_sns/seo/shared/backend-logs/meta-capi-sends.jsonl`
- Window: 24h, 7d
- Generated: 2026-05-21 11:18 KST
- Mode: no-send payload preview
- Confidence: high for presence counts, medium for final EMQ score uplift

## Preview 결과

```json
{
  "24h": {
    "biocom": {
      "confirmed_candidates": 40,
      "send_success": 40,
      "current_em_ph_external_id": "0 / 0 / 0",
      "preview_ph": 40,
      "preview_external_id": 40
    },
    "thecleancoffee": {
      "confirmed_candidates": 19,
      "send_success": 18,
      "current_em_ph_external_id": "0 / 0 / 0",
      "preview_ph": 19,
      "preview_external_id": 19
    }
  },
  "7d": {
    "biocom": {
      "confirmed_candidates": 365,
      "send_success": 349,
      "current_em_ph_external_id": "0 / 0 / 0",
      "preview_ph": 365,
      "preview_external_id": 365
    },
    "thecleancoffee": {
      "confirmed_candidates": 164,
      "send_success": 163,
      "current_em_ph_external_id": "0 / 0 / 0",
      "preview_ph": 164,
      "preview_external_id": 164
    }
  }
}
```

## external_id 설계 판단

원문 회원 ID를 그대로 쓰는 것은 가능 여부와 권장 여부를 분리해야 한다.

- 가능 여부: Meta CAPI의 `external_id`는 해시된 고객 식별자를 받을 수 있다.
- 비권장: 원문 회원 ID를 그대로 넣거나, 단순 SHA-256만 쓰면 내부 회원 체계가 외부 플랫폼과 장기적으로 연결될 위험이 커진다.
- 추천: `site + member_code + secret`를 HMAC-SHA256으로 만든 site-scoped 값만 보낸다.

이 방식은 같은 사이트 안에서는 같은 고객을 안정적으로 묶지만, 원문 회원 ID가 Meta나 로그에 직접 노출되지 않는다.

## 전화번호 ph 설계 판단

전화번호는 아래 순서가 안전하다.

1. 숫자만 남긴다.
2. 한국 번호 형식을 정규화한다.
3. SHA-256으로 해시한다.
4. raw phone은 로그, 문서, 대화에 출력하지 않는다.

이번 preview는 raw phone을 출력하지 않고, 해시 후보가 있는지 여부와 count만 계산했다.

## event_id 주의점

이번 preview는 `em`, `ph`, `external_id` 보강만 다룬다.

`event_id`는 중복 제거용 키라서 별도 관리가 필요하다. 특히 browser Purchase와 server CAPI를 함께 쓰는 경우 같은 이벤트에는 같은 event_id가 필요하다. 현재 운영은 server CAPI 중심이므로, 이번 고객 식별자 보강이 event_id를 바꾸면 안 된다.

따라서 배포 조건은 아래처럼 잡는다.

- `event_id` 생성 방식은 유지한다.
- raw order/payment id가 event_id에 섞이지 않는지 별도 guard를 유지한다.
- Browser Purchase eventID 동기화는 추후 별도 설계로 다룬다.

## 배포 전 조건

1. `META_CAPI_EXTERNAL_ID_SECRET`가 VM Cloud에 설정되어 있어야 한다.
2. site allowlist가 없으면 두 사이트 모두 동시에 영향을 받는다. 가능하면 `biocom` canary부터 켤 수 있게 site allowlist를 추가한다.
3. send 전 payload logging은 raw 값 없이 presence/field count만 남긴다.
4. Events Manager에서 이벤트 매칭 품질 점수와 권장 조치 변화를 24-72시간 추적한다.

## 배포 추천

추천: 조건부 진행.

이유:

- 후보율은 100%라 기대 효과가 크다.
- 현재 EMQ 6.1/10이라 개선 여지가 명확하다.
- 다만 외부 플랫폼으로 고객 식별 단서를 추가 전송하는 작업이므로 canary와 rollback이 필요하다.

추천 canary:

- 1차: biocom Purchase CAPI만 24시간.
- 2차: failed 0, duplicate 0, EMQ 악화 없음이면 72시간 관찰.
- 3차: 더클린커피 확대.
