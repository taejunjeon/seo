# Path B rollback verification

작성 시각: 2026-05-09 22:34 KST

## 한 줄 결론

canary 종료 후 VM Cloud write flag는 OFF이고, GTM live version은 canary 이전 version 142로 복구됐다.

## VM Cloud

Final summary:

- row_count: 4.
- status_counts.identity_only_quarantine: 2.
- raw_stored_count: 0.
- platform_send_count: 0.
- write_flag_on: false.
- write_max_rows: 200.

## GTM

Live verification:

- live container version id: 142.
- live container version name: `paid_click_intent_v1_receiver_20260506T150218Z`.
- live has identity-first canary tag: false.
- latest created version id: 143.
- workspace count: 1.
- remaining workspace: Default Workspace only.

## 주의

GTM에서 latest created version이 143으로 남아 있는 것은 정상이다. 중요한 기준은 live container version이며, live는 142로 복구되어 있다.

## 판정

PASS. canary publish는 live에서 제거됐고, VM Cloud write flag도 OFF다.
