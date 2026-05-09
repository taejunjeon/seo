# Path B live purchase tag impact separation checklist

작성 시각: 2026-05-10 01:18 KST

## 한 줄 결론

실제 주문 테스트에서는 기존 live 구매 태그가 발화할 수 있다. Path B 신규 전송과 기존 live purchase tag 영향을 분리해서 기록해야 한다.

## 분리해야 하는 것

### 기존 live tag

- `HURDLERS - [이벤트전송] 구매`
- `GA4_구매전환_Npay` 또는 유사 GA4 purchase event
- `Google 태그 AW-304339096`
- `Channel.io` 구매전환
- 기존 `User_id`

이 태그들은 현재 사이트에 이미 있는 live 동작이다. 실제 주문을 만들면 발화할 수 있다.

### Path B 신규 관측

- `agent_os_path_b_controlled_traffic_result`
- `agent_os_path_b_identity_first_canary_result`
- VM Cloud order_bridge row/summary

Path B는 no-send/hash-only 관측이어야 한다. GA4/Meta/Google Ads/TikTok/Naver 신규 전송을 만들면 안 된다.

## 테스트 전 체크

- GTM Preview workspace 여부 확인.
- Production publish 없음 확인.
- VM Cloud write flag 의도 확인.
- Path B endpoint가 no-send/hash-only인지 확인.
- 기존 live purchase tag가 발화할 수 있음을 보고서에 분리 기록.

## 테스트 후 체크

- Path B platform_send_count=0.
- Path B send_candidate=false.
- Path B actual_send_candidate=false.
- Google Ads confirmed_purchase upload=0.
- 기존 live purchase tag 발화 여부는 별도 참고로만 기록.
- test_order는 upload/ROAS 제외.

## Hard Fail

- Path B가 신규 GA4/Meta/Google Ads/TikTok/Naver send를 발생.
- Google Ads conversion upload 발생.
- 기존 live tag 발화를 Path B 성과로 착각해 보고.
- test order를 예산 판단 ROAS에 포함.

