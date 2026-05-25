# Hermes 네이버 성과 디스플레이 4월 조사 프롬프트 20260526

작성 시각: 2026-05-26 00:40 KST  
기준일: 2026-05-26  
문서 성격: Hermes read-only/download-only 작업 지시 프롬프트

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - hermes/README.md
  lane: Green_for_prompt_and_command / Yellow_boundary_for_browser_ui_export
  allowed_actions:
    - hermes_read_only_navigation
    - naver_ads_report_filter_view
    - csv_xlsx_download
    - screenshot_capture
  forbidden_actions:
    - ad_create_edit_delete
    - budget_bid_charge_change
    - conversion_send_or_tracking_change
    - account_setting_change
  source_window_freshness_confidence:
    source: Naver Ads UI via Hermes Chrome CDP export
    window: 2026-04-01~2026-04-30 KST
    freshness: pending Hermes execution
    confidence: pending downloaded evidence
```

## 10초 요약

Hermes에게 2026년 4월 네이버 성과 디스플레이 광고의 광고비, 전환금액, 클릭수, ROAS를 read-only로 받아오게 한다. 검색광고 API에는 성과 디스플레이가 들어오지 않으므로, Hermes XLSX/스크린샷을 수동 원천으로 남기는 것이 목적이다.

## Hermes에게 줄 프롬프트

```text
네이버 광고주센터에서 성과 디스플레이 광고의 2026년 4월 성과를 read-only/download-only로 조사해 주세요.

목표:
- 기간: 2026-04-01 00:00 KST ~ 2026-04-30 23:59 KST
- 대상: 접근 가능한 네이버 광고 계정 중 biocom, thecleancoffee와 연결된 성과 디스플레이/ADVoost/쇼핑형 디스플레이 캠페인
- 필수 지표: 광고비, 전환금액, 클릭수, ROAS
- 보조 지표: 노출수, CTR, 평균 CPC, 전환수, 캠페인명, 캠페인 ID, 캠페인 유형

작업 범위:
1. 네이버 광고주센터에 로그인된 Chrome CDP 세션만 사용합니다.
2. 계정 선택 화면이 있으면 biocom 관련 계정과 thecleancoffee 관련 계정을 각각 확인합니다.
3. 성과 디스플레이/ADVoost/쇼핑형 디스플레이 캠페인 리포트 화면으로 이동합니다.
4. 날짜 범위를 2026-04-01~2026-04-30으로 설정합니다.
5. 캠페인 단위 리포트를 XLSX 또는 CSV로 다운로드합니다.
6. 리포트 화면과 다운로드 완료 화면을 스크린샷으로 저장합니다.
7. 결과 JSON에는 계정명/캠페인명/캠페인ID/광고비/전환금액/클릭수/ROAS/노출수/CTR/CPC/전환수/다운로드 파일/스크린샷 파일/조회 시각을 기록합니다.

금지:
- 광고 생성, 수정, 삭제를 누르지 않습니다.
- 예산, 입찰가, 충전, 소재, 타겟, 전환 추적 설정을 바꾸지 않습니다.
- 저장, 적용, 게시, 등록, 충전 버튼을 누르지 않습니다.
- 전환 이벤트를 보내거나 tracking 설정을 변경하지 않습니다.
- 개인정보, raw 주문번호, raw 결제키, raw 회원정보를 결과 파일에 쓰지 않습니다.

중단 조건:
- 로그인/2FA/권한 오류가 뜨면 즉시 중단하고 blocked_access로 기록합니다.
- 계정이 biocom/thecleancoffee 중 어느 쪽인지 확실하지 않으면 다운로드하지 말고 screenshot만 남깁니다.
- 성과 디스플레이 캠페인이 보이지 않으면 no_display_campaign_found로 기록합니다.
- 다운로드 버튼 외에 설정 변경성 버튼을 눌러야 하면 중단합니다.

결과 저장:
- 원본 다운로드: hermes/downloads/naver-display-april-20260401-20260430-{account}.xlsx
- 스크린샷: hermes/screenshots/naver-display-april-20260401-20260430-{account}.png
- 결과 JSON: hermes/results/naver-display-april-20260401-20260430.result.json
```

## 기대 결과 JSON shape

```json
{
  "ok": true,
  "mode": "read_only_download_only",
  "window": { "since": "2026-04-01", "until": "2026-04-30", "timezone": "KST" },
  "accounts": [
    {
      "account_label": "safe label from UI",
      "site_candidate": "biocom | thecleancoffee | unknown",
      "campaigns": [
        {
          "campaign_name": "string",
          "campaign_id": "string",
          "campaign_type": "performance_display",
          "spend_krw": 0,
          "clicks": 0,
          "conversion_revenue_krw": 0,
          "roas": 0,
          "impressions": 0,
          "ctr_percent": 0,
          "average_cpc_krw": 0,
          "conversions": 0
        }
      ],
      "download_file": "hermes/downloads/...",
      "screenshot_file": "hermes/screenshots/..."
    }
  ],
  "blocked": [],
  "invariants_held": {
    "ad_state_change": 0,
    "budget_or_charge_change": 0,
    "conversion_send": 0,
    "raw_identifier_output": 0
  }
}
```

## 사용 위치

이 프롬프트는 네이버 ROAS 대시보드의 성과 디스플레이 원천을 채우기 위한 Hermes 작업 지시다. 결과가 오면 `/api/ads/naver-roas/dashboard`의 `channels.display`에 4월 window로 붙인다.
