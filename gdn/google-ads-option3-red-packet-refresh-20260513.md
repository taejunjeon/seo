# Google Ads Option 3 Red Packet Refresh

작성 시각: 2026-05-13 22:24 KST
Lane: Green packet update only. 실제 Google Ads 변경은 Red 승인 전 금지.

## 10초 요약

NPay actual 보정 후에도 Google Ads 플랫폼 주장 ROAS와 내부 confirmed ROAS의 차이는 크게 남아 있다. last_30d 기준 Google Ads 주장 ROAS는 10.2789이고, biocom NPay actual을 반영한 내부 예산 판단 ROAS는 2.0792다. 남은 gap은 8.1997p라서, 신규 confirmed_purchase 전환 action을 만드는 Option 3 승인안은 여전히 유효하다.

## 최신 숫자

| window | Google Ads 주장 ROAS | 내부 current ROAS | biocom NPay 반영 ROAS | 남은 gap |
|---|---:|---:|---:|---:|
| last_7d | 10.5868 | 0.4059 | 3.5998 | 6.987p |
| last_30d | 10.2789 | 0.2924 | 2.0792 | 8.1997p |

## 추천

- 추천: Option 3 조건부 진행 준비.
- 이유: NPay actual correction은 내부 매출 누락을 줄였지만, Google Ads 쪽 플랫폼 전환 구조의 과대 신호는 그대로 남아 있다.
- 자신감: 84%.
- 실행 조건: TJ님 Red 승인 전 실제 Google Ads UI 변경, upload, send는 0건 유지.

## Option 3가 실제로 바꾸는 것

Option 3는 NPay 매출을 빼는 안이 아니다. NPay 실제 결제완료 매출은 내부 매출에 포함한다. 바꾸려는 것은 `NPay 클릭`, `NPay count`, `결제 시작`, `add_payment_info` 같은 행동 신호가 Google Ads 구매완료 Primary 전환으로 학습되는 구조다.

Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호다. Secondary 전환=입찰에는 쓰지 않고 관찰만 하는 보조 신호다. Red Lane=실제 외부 광고 계정 설정이나 전환 전송을 바꾸므로 TJ님 명시 승인 전 중지하는 작업이다.

변경 후보:

1. 새 Google Ads 전환 action `BI confirmed_purchase`를 만든다.
   - 시작 상태는 Draft 또는 Secondary 관찰이다.
   - 실제 결제완료 주문만 후보로 받는다.
   - 홈페이지 결제완료와 NPay 실제 결제완료를 모두 포함한다.
2. 기존 `구매완료` action `7130249515`와 NPay count label `AW-304339096/r0vuCKvy-8caEJixj5EB`는 오염 의심 신호로 분리한다.
   - 즉시 삭제가 아니라 7일 병행 관찰 후 Secondary 또는 입찰 제외 후보로 둔다.
3. Google Ads upload와 Google Data Manager ingest는 별도 Red 승인 전 0건으로 유지한다.
4. NPay 클릭/결제시작/count label은 evidence로 남길 수 있지만 purchase 후보나 입찰 학습 신호로 승격하지 않는다.

## TJ님 승인 화면

- 내가 실제로 누를 화면: Google Ads > Goals > Conversions > Summary.
- 확인할 기존 설정: 기존 `구매완료` conversion action `7130249515`, Google tag `AW-304339096`, NPay count label `AW-304339096/r0vuCKvy-8caEJixj5EB`.
- 새 설정 후보: `BI confirmed_purchase`.
- 바꾸면 생기는 효과: Google Ads 자동입찰이 실제 결제완료 주문에 가까운 신호를 더 중요하게 학습할 준비가 된다.
- 안 바꾸면 남는 문제: Google Ads 주장 ROAS 10.2789와 내부 예산 판단 ROAS 2.0792의 gap이 계속 예산 판단을 흐릴 수 있다.
- Codex가 대신 못 하는 이유: 외부 광고 계정의 전환 설정은 운영·돈·학습 신호에 영향을 주는 Red Lane이다.

## confirmed_purchase 후보 조건

포함 조건:

- site는 `biocom`이다.
- 결제완료 주문이어야 한다.
- 홈페이지 결제완료 또는 NPay 실제 결제완료만 포함한다.
- value > 0이어야 한다.
- order id 또는 payment key가 있어야 한다.
- Google Ads upload 가능성 후보가 되려면 `gclid`/`gbraid`/`wbraid` 또는 승인된 enhanced conversion identifier가 있어야 한다.
- duplicate guard를 통과해야 한다.

차단 조건:

- NPay click only.
- NPay count.
- NPay payment start.
- add_payment_info only.
- payment status not complete.
- cancelled/refunded/returned/test/manual row.
- duplicate guard missing.
- missing Google click id.
- already sent.
- approval required.
- read-only phase.

## no-send guard

- `send_candidate=false` 기본값 유지.
- `actual_send_candidate=0`, `upload_candidate=0` 유지.
- Google Ads conversion upload 0.
- Google Ads conversion action mutation 0.
- Google Data Manager ingest 0.
- Google Ads campaign budget change 0.
- 운영DB write 0.
- VM Cloud SQLite write 0.
- GTM publish 0.
- raw email/phone/member_code/order/payment/click_id 원문 출력 0.

## 실패 조건

- 새 confirmed_purchase 후보의 click id fill-rate가 너무 낮아 학습/검증이 불가능하다.
- NPay confirmed 주문과 NPay click-only 로그를 구분하지 못한다.
- order id/payment key 중복 방지 기준이 없다.
- value 기준이 gross인지 net인지 문서화되지 않았다.
- 기존 `구매완료`를 Secondary로 낮췄을 때 active campaign의 구매 goal이 비어 버린다.
- Google Ads UI/API write 권한이 필요한데 TJ님 승인 문구가 없다.
- upload/send가 필요해지는 순간 별도 Red 승인이 없다.

## Rollback

1. 새 `BI confirmed_purchase`를 Secondary 또는 observation 상태로 둔다.
2. upload job 또는 dispatcher가 있으면 중단한다. 이번 packet에서는 upload/send가 0건이어야 한다.
3. 기존 `구매완료` action `7130249515` 설정을 변경 전 상태로 원복할지 판단한다.
4. 변경 전후 24시간의 Google Ads API, GA4 BigQuery raw, 내부 confirmed order를 대조한다.
5. 24h / 72h / 7d 단위로 platform value, 내부 confirmed revenue, Google Ads spend, NPay confirmed 주문을 같이 본다.

## 승인 시 범위

1. Google Ads UI에서 신규 `BI confirmed_purchase` 전환 action을 DRAFT 또는 Secondary로 만든다.
2. 기존 NPay click 성격 의심 action은 입찰 제외 또는 Off 후보로 둔다.
3. 7일은 병행 관찰한다.
4. upload/send는 별도 Red 승인 없이는 하지 않는다.

## 금지선

- Google Ads conversion action 실제 변경 0.
- Google Ads upload/send 0.
- 운영DB write 0.
- VM Cloud SQLite write 0.
- GTM publish 0.

산출 JSON: `data/project/google-ads-option3-red-packet-refresh-20260513.json`
