---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Yellow approval packet for VM Cloud confirmed bridge update
  allowed_actions_after_approval:
    - VM Cloud attribution_ledger selected pending rows to confirmed marker update
    - no-send bridge marker preservation
    - pre/post snapshot
  forbidden_actions:
    - Meta CAPI send
    - Google Ads/GA4/TikTok/Naver send/upload
    - 운영DB write/import
    - VM Cloud schema migration
    - GTM publish
    - Imweb header/footer change
  source_window_freshness_confidence:
    source: "Imweb legacy v2 API direct order lookup + VM Cloud attribution_ledger"
    window: "VM Cloud source=biocom_imweb touchpoint=payment_success payment_status=pending logged_at>=2026-05-14T04:00:00.000Z"
    freshness: "2026-05-14 22:30 KST"
    confidence: 0.9
---

# Biocom Imweb API status bridge approval

작성 시각: 2026-05-14 22:34 KST

## 10초 요약

Imweb v2 API 직접 조회로 pending 42건 중 5건이 `STANDBY` 상태와 양수 결제금액을 동시에 만족했다.
이 승인안은 이 5건만 VM Cloud `attribution_ledger`에서 confirmed marker로 올릴지 판단하기 위한 것이다.
Meta CAPI 전송은 포함하지 않는다.

## 승인 범위

- 대상: `PENDING-21`, `PENDING-23`, `PENDING-25`, `PENDING-26`, `PENDING-40`
- 금액 합계: 1,555,621원
- 근거: Imweb legacy v2 direct order detail found + status filter `STANDBY` + `payment_amount > 0`
- 적용 위치: VM Cloud SQLite `attribution_ledger`
- 적용 방식: selected pending rows only, bridge marker + no-send marker 유지

## 제외

- `PENDING-09`: `DELIVERING`이지만 pay_type `free`, amount 0원이라 Purchase 제외.
- API not found 36건: 결제완료 여부를 확정할 수 없어 pending 유지.
- 추가 platform send: 금지.

## 성공 기준

1. selected 5건만 confirmed로 변경된다.
2. 금액 합계 1,555,621원이 post-snapshot에 맞는다.
3. no-send marker가 유지되어 Meta CAPI 자동 전송 후보가 0건이다.
4. API not found 36건과 free 1건은 pending/excluded로 남는다.
5. 운영DB write 0, 외부 send/upload 0, GTM publish 0.

## 실패 조건

- 5건 외 row가 confirmed로 변경됨.
- free 0원 row가 Purchase 후보로 들어감.
- API not found row가 confirmed로 올라감.
- Meta CAPI/Google Ads/GA4/TikTok/Naver send가 발생함.
- rollback 기준 row 식별이 불명확함.

## rollback

승인 후 apply를 수행한다면, bridge marker가 있는 selected 5건만 다시 `payment_status='pending'`으로 되돌리는 rollback dry-run을 먼저 생성한다.
rollback 후 VM Cloud `attribution_ledger` aggregate와 Meta CAPI send log를 대조한다.

## 다음 결정

TJ님이 `YES: 5건 VM Cloud confirmed bridge apply, send 금지`로 승인하면 Codex가 selected 5건에 한해 pre-snapshot -> apply -> post-snapshot -> rollback readiness까지 진행한다.
Meta CAPI backfill 전송은 별도 Red 승인 전까지 계속 금지한다.
