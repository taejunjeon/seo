# TikTok Pixel Events Hard Guard

## 무엇을 막았나

`/api/attribution/tiktok-pixel-events`가 원본 이벤트 row를 많이 반환하는 것을 막는 summary mode를 추가했다.

기본 원칙:

- `summaryOnly=true`이면 원본 `items`는 빈 배열이다.
- 화면이 필요한 합계, 이벤트 수, 상태 분포만 `summary`로 내려준다.
- 응답에 `guard`를 같이 내려서 프론트엔드가 summary-only 응답인지 확인할 수 있다.

## 왜 필요한가

TikTok 화면이 매번 원본 이벤트를 많이 가져오면 서버 메모리와 응답 시간이 흔들린다. 특히 TikTok 광고가 현재 운영 우선순위가 낮은 상태에서는 첫 화면이 원본 진단을 자동으로 할 이유가 없다.

## 현재 로컬 확인

로컬 smoke:

```text
GET /api/attribution/tiktok-pixel-events?summaryOnly=true&limit=10000
HTTP 200
items=0
guard.summaryOnly=true
summary.totalEvents=2
```

## 운영 반영 조건

VM Cloud에 반영한 뒤 확인할 것:

1. `summaryOnly=true` 호출에서 `items=0`.
2. `guard.summaryOnly=true`.
3. `X-Attribution-TikTok-Pixel-Guard=summary-only`.
4. 기존 raw 진단 버튼 호출은 유지.
5. 외부 TikTok 전송 0.

## 남은 주의점

로컬은 guard가 동작하지만, 운영 VM Cloud는 아직 같은 endpoint에 summaryOnly guard가 반영되지 않은 것으로 보인다. 그래서 TikTok summary API는 운영 endpoint를 먼저 `limit=1&summaryOnly=true`로 probe하고, guard 미지원이면 원본 대량 조회를 멈춘다.

