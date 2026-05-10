
# ConfirmedPurchasePrep repeatable input - 2026-05-10

작성 시각: 2026-05-10 19:34:00 KST
Lane: Green no-send contract

## 결론
ConfirmedPurchasePrep는 운영DB `PAYMENT_COMPLETE` 또는 관리자 confirmed source를 primary로 두고, VM Cloud Path B/NPay evidence를 보조로 붙이는 반복 실행 구조로 고정한다.

## 현재 기준값
- integrated candidates: 2152
- homepage confirmed: 2009
- NPay actual confirmed: 143
- with Google click id: 31
- VM order evidence matched: 1686
- send_candidate: 0
- actual_send_candidate: 0
- upload_candidate: 0

## 반복 실행 불변 조건
- NPay actual confirmed는 포함한다.
- homepage confirmed도 포함한다.
- NPay click/count/add_payment_info only는 차단한다.
- unpaid/test/controlled evidence는 차단한다.
- `complete_time` blank와 `imweb_status` blank는 단독 미결제 판단 근거로 쓰지 않는다.
- `send_candidate=false`, `actual_send_candidate=false`, `upload_candidate=0`을 유지한다.

## 다음 자동 Green
동일 window로 재실행할 때 source, 기준 시각, window, freshness, confidence, block_reason 분포를 반드시 같이 기록한다.
