# Google Ads Option 3 observe-only action result

작성 시각: 2026-05-13 22:50 KST
Sprint: gpt0508-51
Lane: Red approved limited action creation attempted / blocked_access_permission
Do not use for: Google Ads upload/send, Google Data Manager ingest, enhanced conversion send, budget change, 기존 `구매완료` 변경

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
    - project/sprint2.md
    - gdn/google-ads-option3-red-packet-refresh-20260513.md
  lane: "Red approved limited Google Ads conversion action creation"
  allowed_actions:
    - Google Ads conversion action create attempt for BI confirmed_purchase only
    - validateOnly precheck
    - read-only post-check
    - result document and observation plan
  forbidden_actions:
    - Google Ads upload/send
    - Google Data Manager ingest
    - enhanced conversion send
    - campaign budget change
    - existing purchase action mutation
    - NPay count label mutation
    - GTM publish
    - operational DB write
  source_window_freshness_confidence:
    source: "VM Cloud Google Ads API customer 2149990943, validateOnly mutate attempt + read-only post-check"
    window: "current conversion action state + last_30d active campaign rows"
    freshness: "2026-05-13 22:43 KST"
    confidence: 0.94
```

## 이번에 가능해진 것

Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 통로를 만들 준비가 어디서 막히는지 정확히 분리했다. 현재 API principal은 Google Ads 계정을 읽을 수 있지만, 전환 action 생성 권한은 없다.

## 왜 중요했나

승인은 있었지만, 승인과 계정 권한은 다르다. `validateOnly` 단계에서 막혔으므로 실제 Google Ads action 생성은 발생하지 않았고, 기존 구매 신호도 건드리지 않았다.

## 실제 결과

- `BI confirmed_purchase`: 생성 안 됨.
- blocker: Google Ads API `ACTION_NOT_PERMITTED`, HTTP 403.
- Google Ads customer: `2149990943` / 바이오컴.
- 기존 `구매완료(7130249515)`: `ENABLED`, `PURCHASE`, `WEBPAGE`, `primary_for_goal=true` 유지.
- 기존 NPay count label action `7564830949`: `ENABLED`, `PURCHASE`, `WEBPAGE`, `primary_for_goal=false` 유지.
- active campaign rows last_30d: 6.
- custom goal에 target action 포함: target action이 없으므로 false.
- upload/send/Data Manager ingest/campaign budget change: 0.

## 실패 분류

- hold_reason: current Google Ads API authenticated principal cannot mutate conversion actions.
- hold_reason_category: `blocked_access_permission`.
- remaining_blocker: TJ님이 UI에서 직접 만들거나, 현재 API principal에 conversion action mutate 권한을 부여해야 한다.
- next_lane: Red if UI creation, Green for post-check after TJ creates it.

## TJ님이 UI에서 만들 때 설정

화면:

```text
Google Ads > Goals > Conversions > Summary
```

새 전환:

- 이름: `BI confirmed_purchase`
- 소스: Import from clicks / offline click conversion
- 카테고리: Purchase
- 최적화 설정: Secondary / observe only / not used for bidding
- 값: 향후 별도 upload 승인 시 주문별 값을 보낼 예정. 이번 단계에서는 upload/send 없음.
- 기존 `구매완료(7130249515)`: 변경하지 않음.
- 기존 NPay count label `AW-304339096/r0vuCKvy-8caEJixj5EB`: 삭제/비활성화하지 않음.

성공 기준:

- 새 action이 Secondary / observe only로 보인다.
- 기존 `구매완료(7130249515)`는 Primary 유지.
- active campaign 구매 goal이 비지 않는다.
- custom goal에 새 action이 bidding target으로 들어가지 않는다.

## 만들고 난 뒤 Codex post-check

TJ님이 UI에서 만든 뒤 Codex가 할 일:

```bash
scp backend/scripts/google-ads-option3-observe-action.ts taejun@34.64.104.94:/tmp/google-ads-option3-observe-action.ts
ssh taejun@34.64.104.94 "sudo -n -u biocomkr_sns bash -lc 'export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:\$PATH; cd /home/biocomkr_sns/seo/repo/backend && cp /tmp/google-ads-option3-observe-action.ts scripts/google-ads-option3-observe-action.ts && npx tsx scripts/google-ads-option3-observe-action.ts --mode=post --out=../data/project/google-ads-option3-observe-action-post-YYYYMMDD.json'"
```

확인할 것:

1. `BI confirmed_purchase` action id.
2. `primaryForGoal=false`.
3. type `UPLOAD_CLICKS`.
4. category `PURCHASE`.
5. 기존 `구매완료(7130249515)` unchanged.
6. custom goal includes target = false.
7. upload/send/ingest = 0.

## 24h / 72h / 7d 관찰 계획

관찰은 action이 실제로 생성된 뒤 시작한다. 생성 전에는 관찰 clock을 시작하지 않는다.

### 24h

- 새 action이 Secondary 상태로 유지되는지 확인.
- 기존 `구매완료(7130249515)`가 Primary인지 확인.
- action별 metrics가 0이어야 한다. 이번 단계에는 upload/send가 없으므로 0이 정상이다.
- custom goal 또는 campaign goal에 의도치 않게 들어가지 않았는지 확인.

### 72h

- active campaign goal warning이 없는지 확인.
- 기존 구매 action의 platform metrics가 기존 흐름대로 계속 들어오는지 확인.
- 새 action은 여전히 upload/send 0이어야 한다.
- ConfirmedPurchasePrep no-send dry-run을 최신 window로 재실행해 click id fill-rate를 본다.

### 7d

- Google Ads 주장 ROAS와 내부 confirmed ROAS gap을 다시 계산한다.
- 새 action을 계속 Secondary로 둘지, upload 준비 approval packet으로 넘어갈지 판단한다.
- 기존 `구매완료(7130249515)`의 Primary 강등은 별도 Red 승인 전까지 하지 않는다.

## 공식 기준 메모

Google Ads API 문서 기준으로 conversion action name은 unique해야 하며, `primary_for_goal`은 보고와 입찰 영향 제어에 쓰인다. Google Ads conversion goals 문서는 `primary_for_goal=false`인 action은 custom goal에 쓰지 않는 한 입찰이나 `Conversions`에 포함되지 않고 관찰용 `All conv.` 계열에서 볼 수 있다고 설명한다.

Sources:
- https://developers.google.com/google-ads/api/docs/conversions/getting-started#create_conversion_actions
- https://developers.google.cn/google-ads/api/docs/conversions/goals/overview?hl=en

## Auditor verdict

PASS_WITH_BLOCKER.

The approved mutation was attempted only as validateOnly first and was blocked by Google Ads authorization before creation. No upload, no send, no Data Manager ingest, no budget change, no existing conversion action mutation.
