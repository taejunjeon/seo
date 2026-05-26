작성 시각: 2026-05-27 01:21 KST
기준일: 2026-05-27
문서 성격: Google Ads 실제 결제완료 전환 1건 제한 전송 및 자동 전송 cron 설정 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - project/google-ads-vm-confirmed-priority-and-pending-sync-result-20260527.md
    - project/google-ads-duplicate-send-ledger-design-20260526.md
  lane: Red_approved
  approved_by: TJ님 chat explicit approval
  approved_action:
    - Google Ads conversion upload limited send
    - VM Cloud upload ledger write
    - recurring automatic dispatcher cron
  allowed_actions:
    - send confirmed purchase candidates that pass actual-purchase guard
    - write VM Cloud duplicate-send ledger
    - install bounded cron script
  forbidden_actions:
    - expose raw order id or raw click id in report
    - operational DB write
    - GTM production publish
    - send non-confirmed or click-only events as purchase
  source_window_freshness_confidence:
    source: VM Cloud API + Google Ads API
    window: rolling_24h
    freshness: live at 2026-05-27 01:11 KST
    confidence: high for API send result, medium for Google Ads UI reflection until platform status updates
```

## 10초 요약

Google Ads에 “실제 결제완료 주문만 구매로 알려주는 새 전환 통로”를 시작했다.

첫 제한 전송은 1건, 35,000원으로 성공했다. 이 전송은 기존 `NPay 버튼 클릭/결제진입(보조)`가 아니라 `BI confirmed_purchase_offline` 전환 액션으로 보냈다.

앞으로 새 후보가 생기면 VM Cloud가 10분마다 확인해서, 실제 결제완료이고 gclid가 있으며 아직 보내지 않은 주문만 자동 전송한다. KST 01:20 첫 자동 실행도 확인했고, 이미 보낸 주문은 재전송되지 않았다.

## 실제로 가능해진 것

이제 Google Ads가 버튼 클릭이 아니라 실제 결제완료 주문을 학습할 수 있는 통로가 생겼다.

전송 전에는 Google Ads API `validate_only`로 형식 검증을 먼저 통과했다. 이후 같은 후보 1건을 실제 전송했고, VM Cloud 중복 전송 장부에는 `sent` 상태가 남았다.

## 전송 결과

- 전환 액션: `BI confirmed_purchase_offline`
- Google Ads customer id: `2149990943`
- conversion action id: `7609289411`
- 전송 모드: 실제 전송
- 전송 건수: 1건
- 전송 금액: 35,000원
- 통화: KRW
- Google Ads API 응답: HTTP 200
- partial failure: false
- result count: 1
- raw 주문번호 노출: false
- raw click id 노출: false

## 장부 결과

- VM Cloud 장부 write: 1건
- Google Ads write: 1건
- 장부 최종 상태: `sent`
- 중복 전송 key: 서버 내부 hash로만 관리
- 원문 주문번호와 원문 click id는 응답/문서에 노출하지 않음

중복 확인을 위해 같은 스크립트를 다시 실행했다.

결과는 `already_sent`로 차단됐다. 따라서 같은 주문을 반복 전송하지 않는 장부가 실제로 작동한다.

## 자동 전송 설정

VM Cloud crontab에 아래 자동 전송을 추가했다.

```text
*/10 * * * * /home/biocomkr_sns/seo/repo/backend/scripts/google-ads-confirmed-purchase-auto-send.sh >> /home/biocomkr_sns/seo/logs/google-ads-confirmed-purchase-auto-send.log 2>&1
```

작동 방식:

1. 10분마다 최근 24시간 후보를 확인한다.
2. 실제 결제완료, 금액 있음, 취소/환불 아님, gclid 있음 조건을 통과한 주문만 장부에 올린다.
3. 장부에서 아직 `sent`가 아닌 후보만 Google Ads에 보낸다.
4. 이미 보낸 주문은 `already_sent`로 막는다.

## 검증 결과

- `validate_only` 검증: PASS
- 실제 Google Ads 제한 전송: PASS
- VM Cloud 장부 sent 업데이트: PASS
- 자동 스크립트 문법 검증: PASS
- 자동 스크립트 수동 실행: PASS
- 중복 재전송 차단: PASS
- cron 등록: PASS
- cron 첫 자동 실행: PASS, KST 01:20 실행 로그 확인
- 자동 실행 중복 차단: PASS, 기존 sent row는 `already_sent`로 차단

## 하지 않은 것

- 기존 `NPay 버튼 클릭/결제진입(보조)`를 다시 Primary로 올리지 않았다.
- `TechSol - NPAY구매 50739`는 다시 켜지 않았다.
- 운영DB에는 쓰지 않았다.
- GTM Production publish는 하지 않았다.
- raw 주문번호, raw gclid, raw gbraid, raw wbraid는 문서에 남기지 않았다.

## 남은 리스크

Google Ads UI에는 전환 수신/상태가 바로 반영되지 않을 수 있다. API 전송은 성공했지만 Google Ads 화면의 상태 문구는 몇 시간 뒤에 바뀔 수 있다.

현재 자동 전송 후보율은 아직 낮다. 실제 결제완료 주문 중 gclid가 직접 남는 주문부터 먼저 보낸다. NPay 외부 결제완료 bridge를 더 넓히면 후보율을 올릴 수 있다.

`BI confirmed_purchase_offline`이 Primary로 올라갔기 때문에 Google Ads 입찰 학습은 이 새 신호를 보기 시작한다. 다만 첫날에는 전송 건수가 적어서 학습 안정성은 낮다.

## 다음 할일

### Auto Green

1. Google Ads 자동 전송 cron 첫 자동 실행 로그를 확인한다.
   - 왜: 수동 실행은 통과했지만, cron 환경에서도 PATH/권한/네트워크가 정상인지 확인해야 한다.
   - 성공 기준: `/home/biocomkr_sns/seo/logs/google-ads-confirmed-purchase-auto-send.log`에 다음 10분 tick 로그가 쌓이고, 이미 보낸 주문은 `already_sent`로 막힌다.

2. Google Ads UI에서 `BI confirmed_purchase_offline` 상태가 바뀌는지 확인한다.
   - 왜: API는 전송 성공이지만 Google Ads 화면은 지연 반영될 수 있다.
   - 성공 기준: 전환 액션 상태가 `최근 전환 없음` 또는 `연결 안 됨`에서 수신된 전환이 있는 상태로 이동한다.

3. 후보율을 올리는 병목을 계속 분해한다.
   - 왜: 지금은 gclid가 직접 보존된 실제 구매만 보낸다. NPay bridge가 넓어져야 Google Ads 학습량이 늘어난다.
   - 성공 기준: ready exact gclid 후보가 1건에서 증가하고, `no-send` 후보표에서 Google Ads 전송 후보와 내부 bridge 후보가 더 명확히 분리된다.
