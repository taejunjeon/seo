# 운영DB freshness label small wire (gpt0508-37 작업7)

작성 시각: 2026-05-11 01:35:00 KST
실행 상태: backend code patch + typecheck PASS / live 응답 검증은 deploy 후
자신감: 88%

## 한 줄 결론

`/api/google-ads/dashboard` 응답에 `operationalDbFreshness` 객체(6필드)를 작은 scope(75 LOC)로 추가했소. typecheck PASS. R2 deploy(작업 5)와 같이 묶어 deploy 시 라이브 노출 시작. **R2보다 작업 우선순위는 낮음** — 본 sprint 정책 그대로 root data fix(R2)가 1순위.

## 1. 새 응답 필드

```json
{
  "operationalDbFreshness": {
    "source": "operational_db_tb_iamweb_users",
    "maxOrderDateKst": "2026-05-10 15:22:15 KST",
    "maxPaymentCompleteKst": "2026-05-10 14:01:33 KST",
    "syncLagMinutes": 540,
    "status": "stale",
    "warnings": ["운영DB sync lag 6시간 초과. dashboard 카운트는 lag 기준값."]
  }
}
```

## 2. status threshold

| status | 조건 | 의미 |
|---|---|---|
| `fresh` | `syncLagMinutes <= 60` | 1시간 이내 sync, 카운트는 거의 실시간 |
| `lagged` | `60 < syncLagMinutes <= 360` | 1~6시간 lag, 카운트는 lag 기준값 |
| `stale` | `syncLagMinutes > 360` | 6시간 초과, 카운트 해석 주의 |
| `unknown` | DATABASE_URL 미설정 또는 query 실패 | 정보 없음 |

## 3. 코드 변경

| 파일 | 변경 | LOC |
|---|---|---|
| `backend/src/routes/googleAds.ts` | import 1줄 + helpers 2개(`buildOperationalDbFreshness`, `utcStringToKst`) + 응답 필드 추가 | +75 |

frontend chip 추가는 본 sprint에 안 함 — R2 deploy 검증 후 다음 sprint에서 작은 chip 추가.

## 4. 검증

| 항목 | 결과 |
|---|---|
| backend typecheck | PASS (`npx tsc --noEmit`) |
| local 7020 smoke | skip (gpt0508-36와 동일 timeout, deploy 후 운영 backend 에서 검증) |
| send_candidate / actual_send_candidate / upload_candidate | 변경 없음 |
| 운영DB write | 0 |

## 5. 예상 live response (deploy 후)

이번 sprint 시점 운영DB MAX(order_date)는 `2026-05-10 15:22:15 KST`(audit 시각 기준 lag ≈ 9시간) → status가 `stale`로 나올 가능성 높음. 운영자가 "현재 NPay 209건은 9시간 sync lag 기준값"이라는 걸 화면에서 직접 인지 가능.

## 6. 다음 액션

### Claude Code가 할 일

1. (R2 deploy와 같이 묶어) backend deploy 후 `/api/google-ads/dashboard?date_preset=last_30d` 라이브 응답에 `operationalDbFreshness` 노출 확인.
2. (다음 sprint) frontend `/ads/google` 페이지에 작은 freshness chip 추가 — 정적 안내가 아닌 dashboard 응답 구독.

### TJ님이 할 일

본 작업 자체에 추가 액션 없음. R2 deploy 결정과 함께 진행.

## 7. Verdict

`FRESHNESS_LABEL_PATCH_LIVE_VERIFICATION_PENDING_DEPLOY`

산출 JSON: `data/operational-db-freshness-label-small-wire-20260511.json`
