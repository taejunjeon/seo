# CAPI Status

작성 시각: 2026-05-15 16:38 KST

## 결론

방금 카드 결제완료로 추적한 11,900원 건은 **서버 CAPI 전송 성공**이다. Meta가 서버 구매 신호를 받을 수 있는 경로는 현재 살아 있다.

## 확인 기준

| 항목 | 값 |
|---|---|
| DB/로그 위치 | VM Cloud SQLite `attribution_ledger`, VM Cloud `meta-capi-sends.jsonl` |
| 기준 window | 2026-05-15 12:37-16:37 KST 최근 4시간 |
| checked_at | 2026-05-15 16:37:48 KST |
| raw id 정책 | 보고서에는 safe_ref만 출력 |

## 대상 결제건

| 항목 | 값 |
|---|---|
| safe_ref | `safe_e551374302` |
| VM Cloud row 시각 | 2026-05-15 16:00:43 KST |
| touchpoint | 결제완료 신호 (`payment_success`) |
| status | confirmed |
| amount | 11,900원 |
| order key presence | present |
| payment key presence | present |
| approved_at presence | present |
| snippet | `2026-05-15-biocom-payment-success-v4-4-2` |

## CAPI match

| 항목 | 값 |
|---|---|
| match count | 1 |
| send path | auto_sync |
| send 시각 | 2026-05-15 16:28:08 KST |
| event | Purchase |
| HTTP status | 200 |
| Meta response | `events_received=1` |
| amount | 11,900원 |

해석: 브라우저에서 `ev=Purchase`가 보이지 않았더라도 이 결제건은 서버 경로로 Meta에 들어갔다. 따라서 같은 결제건에 추가 Browser Purchase diagnostic을 바로 쏘면 중복 위험이 있다.

## 최근 4시간 전체 CAPI 상태

| 항목 | 값 |
|---|---:|
| CAPI Purchase send count | 44 |
| `events_received=1` | 44 |
| failed 또는 non-1 | 0 |

## 최근 4시간 결제완료 장부 상태

| 항목 | 값 |
|---|---:|
| payment_success total | 16 |
| confirmed | 13 |
| pending | 3 |

주의: `payment_success` row 수와 CAPI send 수는 같은 기준으로 1:1 비교하면 안 된다. CAPI 로그는 auto-sync 대상 window와 과거 후보 재시도/스케줄 영향을 받을 수 있고, 결제완료 장부 조회는 최근 row 기준이다. 이번 판단의 핵심은 대상 safe_ref 1건이 CAPI 로그와 정확히 맞았다는 점이다.

## 결론

- 단건 backfill 필요 없음.
- CAPI server path는 정상.
- Browser Purchase 미표시는 서버 복구 실패가 아니라 브라우저 보조 경로 문제로 분리한다.
