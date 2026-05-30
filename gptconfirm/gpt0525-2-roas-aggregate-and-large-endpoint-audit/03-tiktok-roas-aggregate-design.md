# TikTok ROAS 요약 결과 조회 전환 설계

## 목표

TikTok 광고 성과 화면이 기본 진입 시 원본 장부를 크게 읽지 않게 한다. 화면은 먼저 요약 결과를 받고, 원본 row 기반 정밀 진단은 사용자가 필요할 때만 실행한다.

## 새 기본 흐름

```text
사용자 화면 진입
→ /api/ads/tiktok/roas-summary 호출
→ 미리 계산된 TikTok 요약 숫자 표시
→ 사용자가 “정밀 진단” 클릭
→ /api/ads/tiktok/roas-comparison 수동 호출
```

## 새 API 초안

```http
GET /api/ads/tiktok/roas-summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

응답 예시:

```json
{
  "ok": true,
  "site": "biocom",
  "platform": "tiktok",
  "range": {
    "start_date": "2026-05-19",
    "end_date": "2026-05-25",
    "timezone": "Asia/Seoul"
  },
  "status": {
    "ads_active": false,
    "message": "TikTok 광고는 현재 기본 모니터링만 합니다."
  },
  "summary": {
    "spend_krw": 0,
    "internal_confirmed_orders": 0,
    "internal_confirmed_revenue_krw": 0,
    "internal_roas": null,
    "platform_reported_purchases": 0,
    "platform_reported_revenue_krw": 0,
    "first_touch_candidate_orders": 0,
    "pending_or_unknown_orders": 0
  },
  "evidence": {
    "tiktok_click_signal_count": 0,
    "tiktok_pixel_event_count": 0,
    "vm_confirmed_tiktok_signal_count": 0
  },
  "cache": {
    "source": "precomputed_summary",
    "generated_at_kst": "2026-05-25 14:00",
    "next_refresh_at_kst": "2026-05-25 15:00"
  },
  "diagnostic": {
    "raw_comparison_available": true,
    "raw_comparison_endpoint": "/api/ads/tiktok/roas-comparison",
    "raw_comparison_mode": "manual_only"
  }
}
```

## 프론트엔드 변경

기본 카드:

- “TikTok 광고 현재 운영 여부”
- “TikTok 내부 confirmed ROAS”
- “플랫폼 주장 ROAS”
- “확인 필요 row 수”
- “마지막 계산 시각”

버튼:

- `정밀 진단 실행`: 기존 `/api/ads/tiktok/roas-comparison` 호출
- `CSV 재업로드/수동 데이터 반영`: 기존 관리 기능이 있으면 유지

## 왜 이 방식이 맞나

TikTok 광고가 현재 꺼져 있으면, 매번 원본 장부를 크게 조회해도 얻는 의사결정 가치가 낮다. 대신 화면은 빠르게 “지금은 꺼져 있음, 최근 evidence 없음, 필요하면 정밀 진단 가능”을 보여줘야 한다.

## 배포 전 성공 기준

- `/ads/tiktok` 최초 진입에서 `/api/ads/tiktok/roas-comparison` 자동 호출 0.
- 새 summary endpoint 응답 500ms 목표.
- TikTok 광고 off 상태에서도 화면이 빈 로딩으로 오래 멈추지 않음.
- 정밀 진단 버튼 클릭 시에만 기존 heavy API 호출.
- 외부 플랫폼 전송 0.
- 운영DB write 0.
- raw identifier output 0.

