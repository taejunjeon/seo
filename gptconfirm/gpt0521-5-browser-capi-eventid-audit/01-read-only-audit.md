# Read-only audit

## Source

- VM Cloud: `/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7`
- Local cross-check: `backend/logs/meta-capi-sends.jsonl`
- Repository references: `backend/src/metaCapi.ts`, `gptconfirm/gpt0521-4-browser-safe-event-id-design`

## VM Cloud recent operational 7d

| Metric | Value |
|---|---:|
| Purchase total | 503 |
| Success | 503 |
| Failure | 0 |
| Unique eventID | 503 |
| Duplicate eventID | 0 |
| Duplicate eventID groups | 0 |
| Unique order-event keys | 503 |
| Duplicate order-event keys | 0 |
| Biocom pixel count | 340 |
| TheCleanCoffee pixel count | 163 |

최근 표본 500건의 eventID 형태는 모두 `Purchase.` 계열이었다.

## Local historical aggregate

Local log는 과거 전환 복구 작업이 섞여 있어 운영 live truth로 보지 않고 historical cross-check로만 사용했다.

| Metric | Value |
|---|---:|
| Purchase rows | 871 |
| eventID present | 871 |
| events_received positive | 871 |
| failed-like | 0 |
| legacy `Purchase.` shape | 32 |
| legacy `Purchase:` shape | 1 |
| opaque/short token shape | 838 |

## Interpretation

Server CAPI만 보면 현재 중복 제거 상태는 안정적이다.

문제는 Browser Purchase eventID가 VM Cloud 로그에 들어오지 않는다는 점이다. Browser Purchase는 사용자의 브라우저가 Meta로 직접 보내므로, 같은 eventID인지 확인하려면 Meta Events Manager Test Events, Pixel Helper, 또는 Network beacon 샘플을 봐야 한다.

## Confidence

- Server CAPI success/duplicate: high.
- Server eventID shape: high for recent sample.
- Browser vs CAPI eventID same-value proof: medium-low because direct browser eventID is not captured in VM Cloud.
