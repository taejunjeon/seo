# Google Ads Option 3 Red Packet Refresh

작성 시각: 2026-05-13 18:55:11 KST
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
- 자신감: 79%.
- 실행 조건: TJ님 Red 승인 전 실제 Google Ads UI 변경, upload, send는 0건 유지.

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
