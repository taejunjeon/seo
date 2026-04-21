# Biocom legacy_uncertain CANCEL top 20

- DB: `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` read-only SELECT
- 기준: `crmLocal.ts` C-Sprint 3의 `LEFT JOIN toss_transactions t ON t.order_id = i.order_no || '-P1' AND t.status IN ('CANCELED','PARTIAL_CANCELED','WAITING_FOR_DEPOSIT','DONE')` 및 CASE 판정 그대로 사용
- 정렬: `payment_amount DESC, order_time DESC, order_no ASC`
- 태그: 복수 조건 매칭 시 쉼표 구분, 매칭 없음은 `-`

| 순위 | 주문번호 | 금액 | pay_type | imweb_status | toss_status | 가설 태그 |
| --- | --- | ---: | --- | --- | --- | --- |
| 1 | 202602038525166 | 1,367,050 | card | CANCEL | DONE | - |
| 2 | 202601284302317 | 1,082,000 | card | CANCEL | DONE | - |
| 3 | 202601283198527 | 992,000 | card | CANCEL | DONE | - |
| 4 | 202603039840086 | 991,800 | card | CANCEL | DONE | - |
| 5 | 202602101622268 | 975,000 | npay | CANCEL | NULL | toss_row_missing |
| 6 | 202601217042796 | 926,250 | card | CANCEL | DONE | - |
| 7 | 202603304599986 | 892,800 | card | CANCEL | DONE | - |
| 8 | 202601293792938 | 783,000 | card | CANCEL | DONE | - |
| 9 | 202602239819579 | 725,000 | card | CANCEL | DONE | - |
| 10 | 202603290498056 | 712,500 | card | CANCEL | DONE | - |
| 11 | 202603195173818 | 712,500 | card | CANCEL | DONE | - |
| 12 | 202602032058237 | 712,500 | card | CANCEL | DONE | - |
| 13 | 202601264184260 | 705,000 | card | CANCEL | DONE | - |
| 14 | 202601298557354 | 675,000 | card | CANCEL | DONE | - |
| 15 | 202601199010727 | 675,000 | card | CANCEL | DONE | - |
| 16 | 202602189913045 | 672,600 | card | CANCEL | DONE | - |
| 17 | 202603015388995 | 586,000 | card | CANCEL | DONE | - |
| 18 | 202604024482432 | 558,000 | card | CANCEL | DONE | - |
| 19 | 202603269248255 | 558,000 | card | CANCEL | DONE | - |
| 20 | 202602190481601 | 558,000 | card | CANCEL | DONE | - |

## 태그별 합계

| 가설 태그 | 건수 | 금액 합계 |
| --- | ---: | ---: |
| toss_row_missing | 1 | 975,000 |
| other_toss_status | 0 | 0 |
| virtual_no_waiting_for_deposit | 0 | 0 |
| 상위 20 합계 | 20 | 15,860,000 |

## TJ 수동 확인 필요 순위

1순위는 금액이 가장 큰 1~4위와 6~20위의 `DONE` 행입니다. 이 주문들은 원본 Toss row에 `DONE,CANCELED`가 함께 있어 API CASE상 `DONE` 조인 행이 `legacy_uncertain`에 남습니다. 별도 확인 대상으로는 5위 `202602101622268`이 유일한 `toss_row_missing`이며, Toss 원장/주문번호 매핑 누락 여부를 먼저 확인하면 됩니다.
