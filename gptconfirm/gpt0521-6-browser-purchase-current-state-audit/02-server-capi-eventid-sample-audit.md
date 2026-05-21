# Server CAPI EventID Sample Audit

## Source

- VM Cloud: `/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7`
- 기준 시각: 2026-05-21 KST
- 출력 정책: raw eventID 출력 금지. prefix/family/count만 출력.

## Read-only aggregate

| Metric | Value |
|---|---:|
| fetched rows | 500 |
| Purchase total | 500 |
| Success | 500 |
| Failed-like | 0 |
| Unique eventIDs | 500 |
| Duplicate eventIDs | 0 |
| Duplicate eventID groups | 0 |
| Biocom Pixel | 339 |
| TheCleanCoffee Pixel | 161 |

## EventID family

| Family | Count |
|---|---:|
| `Purchase.` | 500 |

## 해석

Server CAPI만 보면 eventID 중복 문제는 현재 관측되지 않는다. 같은 구매가 서버에서 두 번 성공 전송되는 징후도 없다.

다만 이 결과만으로 Browser Purchase와 같은 eventID를 쓴다고 확정할 수는 없다. Browser Purchase는 브라우저가 Meta로 직접 보내는 요청이라 VM Cloud CAPI 로그에 남지 않는다.

## Browser eventID와 비교 조건

Browser와 Server를 같은 구매로 묶으려면 아래 조건이 모두 필요하다.

1. 같은 site/pixel ID.
2. 같은 event name: `Purchase`.
3. 같은 주문/결제 safe key. raw key는 secure evidence 내부에서만 확인한다.
4. Browser `eventID`와 Server `event_id` exact match.
5. CAPI `events_received=1`.
6. duplicate event_id 0.
7. event time이 같은 완료 흐름 안에 있어야 한다.

보고서에는 raw eventID를 쓰지 않고 `same=true/false`, `family`, `count`만 남긴다.
