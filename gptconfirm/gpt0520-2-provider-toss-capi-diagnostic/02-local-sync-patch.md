# Local Sync Patch

## 문제

Toss provider 상태가 취소/환불 또는 미완료일 때 CAPI sync가 이를 “운영자가 조치해야 하는 실패”처럼 해석할 여지가 있었다.

실제로는 이런 row는 Meta Purchase로 보내면 안 된다. 따라서 failed가 아니라 no-send skip 으로 남아야 한다.

## 변경

File: `backend/src/metaCapi.ts`

- Toss status 정규화 helper 추가.
- 결제완료 status:
  - `DONE`
  - `PAID`
  - `APPROVED`
- 취소/환불 no-send status:
  - `CANCELED`
  - `PARTIAL_CANCELED`
  - `REFUNDED`
- 그 외 미완료 status:
  - `결제 미완료(...)`로 block.
- CAPI sync catch 단계에서 아래 사유는 skip으로 분류:
  - 결제 취소/환불 상태
  - 결제 미완료
  - 가상계좌 미완료

## 기대 효과

- 취소/환불 row가 backfill-ready처럼 보이는 것을 줄인다.
- CAPI failure와 no-send guard를 더 명확히 분리한다.
- 실제 결제완료 row만 재전송/자동전송 후보로 남긴다.

## 배포 상태

로컬 패치만 완료했다. VM Cloud 배포는 하지 않았다.
