# site_landing summary API (gpt0508-42 작업3)

작성 시각: 2026-05-11 15:50:00 KST

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: `GET /api/attribution/site-landing/summary?windowHours=24` 신설. site_landing_ledger 의 분포 + 8 derived 필드 (source_evidence_present_rate / paid_hint_count / organic_count / direct_count / referral_count / unknown / raw_click_mode_count / ttl_expiring_24h_count + external_send_count=0 + upload_candidate_count=0) 를 read-only 반환.
- **왜 했는가**: 작업 1 fan-out 으로 site_landing 이 채워지면 dashboard 와 builder 가 그 분포를 읽을 수 있어야 함. write/send/upload 버튼 없이 read-only 만 노출.
- **어떻게 했는가**: `summarizeSiteLanding` 에 derived 블록 추가. attribution route 에 GET endpoint 1 개 추가 (28 LOC). windowHours clamp 1~720 시간. invariants_held 응답에 항상 박힘.
- **결과가 무엇인가**: API fixture **6/6 PASS** (473ms). raw PII pattern 응답 노출 0 검증. 다음 작업 4 frontend 카드가 본 API 만 호출하면 됨.
- **목표에 어떤 영향을 줬는가**: Track D Dashboard Decision View 83% → 85% (read-only API ready). Track G 78% → 80% (summary API 검증).
- **남은 병목은 무엇인가**: API 가 production 에서 의미 있는 데이터를 반환하려면 작업 1 fan-out 이 deploy 되어야 함 — 본 sprint 의 작업 6 packet 으로 분리.

## 2. response 예시

```json
{
  "ok": true,
  "mode": "read_only_no_send",
  "window_hours": 24,
  "site": "biocom",
  "total": 4,
  "channel_distribution": {"paid_social": 3, "direct": 1},
  "source_breakdown_top10": [{"source": "instagram", "count": 3}],
  "utm_campaign_top10": [{"campaign": "meta_biocom", "count": 3}],
  "joinable_session_key_count": 4,
  "click_id_storage_mode_distribution": {"hash": 0, "raw": 0, "none": 4},
  "derived": {
    "source_evidence_present_rate": 0.75,
    "paid_hint_count": 3,
    "organic_count": 0,
    "direct_count": 1,
    "referral_count": 0,
    "unknown_or_hold_count": 0,
    "raw_click_mode_count": 0,
    "ttl_expiring_24h_count": 0,
    "external_send_count": 0,
    "upload_candidate_count": 0
  },
  "invariants_held": {
    "external_send_count": 0,
    "upload_candidate_count": 0,
    "gtm_publish": 0,
    "imweb_footer_edit": 0,
    "operational_db_write": 0,
    "raw_email_phone_member_payment_order_in_response": false
  }
}
```

## 3. 금지선 준수

| invariant | 결과 |
|---|---|
| write / send / upload button | 0 (read-only GET only) |
| raw PII 응답 노출 | 0 (regex scan PASS) |
| external send | 0 |
| 운영DB write | 0 |
| GTM publish | 0 |

## 4. fixture 6/6 PASS

(작업 3 산출 JSON 의 fixture_results 참조)

## 5. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 작업 4 frontend minimal 카드 (80 LOC 이하) | YES | — | 85 | 90 | 80 | 15 | 85 | 진행 |
| TJ님 | deploy 후 production 에서 본 API hit + 결과 확인 | NO — VM 환경 + production traffic 필요 | Claude Code 로컬에서 production hit 불가 | 90 | 70 | 90 | 25 | 75 | 조건부 (작업 6 deploy 후) |

산출 JSON: `data/site-landing-summary-api-result-20260511.json`
