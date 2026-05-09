# Path B reliability v2 dry-run result

작성 시각: 2026-05-09 22:34 KST
Source JSON: `data/path-b-identity-first-canary-reliability-v2-20260509.json`

## 한 줄 결론

canary row 2건은 주문+email identity+session은 모두 채워졌지만 click id가 없어, 전송 후보가 아니라 confidence C/HOLD로 분류했다.

## Fill rate

- order hash: 2/2, 100%.
- email hash: 2/2, 100%.
- phone hash: 0/2, 0%.
- client/session: 2/2, 100%.
- click id hash: 0/2, 0%.

## Confidence

- A full click+identity+order: 0.
- B strong real order bridge: 0.
- C identity-only quarantine/HOLD: 2.
- D session-only or insufficient: 0.

## Send decision

- `send_candidate=true`: 0.
- `actual_send_candidate=true`: 0.
- Google Ads upload candidate: 0.
- GA4/Meta/Google Ads new platform send by Path B: 0.

## 해석

Path B canary는 주문완료 원장을 hash-only로 쌓는 능력을 검증했다. 그러나 click bridge가 없는 상태에서는 Google Ads confirmed_purchase upload 후보로 쓰면 안 된다.

## 다음 판단

1. click bridge를 별도 전략으로 보강한다.
2. identity-only row를 더 쌓아 fill-rate를 안정화할지 결정한다.
3. Google Ads actual send는 계속 HOLD한다.
