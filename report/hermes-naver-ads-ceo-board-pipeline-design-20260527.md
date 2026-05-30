# Hermes 네이버 광고비 → CEO Board Slack 보고 파이프라인 설계

작성 시각: 2026-05-27 00:44 KST
기준일: 2026-05-27
문서 성격: 네이버 광고비 반복 수집·검산·Slack 보고 설계
담당: Codex
상태: Green 설계 완료, 실제 자동 발송은 승인 전 금지

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - hermes/README.md
    - slack/!slackmsg.md
    - report/!report.md
    - report/reportcoffee-naver-ads-ui-api-reconciliation-20260525.md
    - project/naver-display-april-hermes-result-20260526.md
  lane: Green
  allowed_actions:
    - local_design_document
    - no_send_slack_pipeline_design
    - github_command_result_contract_design
    - read_only_artifact_review
  forbidden_actions:
    - slack_send_or_schedule
    - naver_ads_state_change
    - naver_ads_budget_or_charge_action
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - secret_token_output
  source_window_freshness_confidence:
    source: Hermes GitHub command/result bridge + local hermes artifacts + Sentia Slack runbook
    window: weekly and monthly report windows
    freshness: "Hermes TheCleanCoffee display spend confirmed through 2026-05-18 - 2026-05-24; April export confirmed 2026-05-26"
    confidence: "high for feasibility, medium for fully automated cadence until TeamKeto export and Sentia no-send preview are wired"
```

## 10초 요약

네이버 성과형 디스플레이 광고비는 공식 API 권한이 없어서 화면 원본이 필요하다. Hermes는 맥미니의 로그인된 Chrome을 안전하게 읽어 XLSX와 스크린샷을 남기는 수집자 역할을 맡는다.

Codex는 Hermes가 GitHub에 남긴 결과만 읽어서 매출 원장과 같은 기간으로 맞춘다. 그 다음 CEO Board의 Sentia Slack 봇은 `sentia_ai` 채널에 주간·월간 보고를 보낸다.

권장 구조는 “GitHub는 원본/검증 기록, Telegram은 사람 호출 알림, Slack은 최종 보고”다. 1분마다 도는 runner는 지금 필요 없다. 초기에는 TJ님이 Telegram으로 Hermes 실행을 알려주고, 안정화 후에는 맥미니 `launchd`로 주 1회·월 1회만 실행하는 방식이 맞다.

## 지금 확인된 사실

| 항목 | 상태 | 근거 |
|---|---|---|
| 더클린커피 네이버 광고비 UI 조회 | 가능 | Hermes가 네이버 광고주센터 로그인 Chrome에서 `[ADVoost] 쇼핑` 조회 성공 |
| 더클린커피 주간 XLSX 다운로드 | 가능 | 2026-05-18 - 2026-05-24 `[ADVoost] 쇼핑` 350,098원 확인 |
| 더클린커피 4월 성과 디스플레이 원본 | 가능 | 2026-04-01 - 2026-04-30 `[ADVoost] 쇼핑` 1,171,829원 확인 |
| 팀키토 광고비 | 진행 중 | Hermes 조회 중으로 분리 |
| 검색광고 API만으로 전체 네이버 광고비 산출 | 불충분 | `[ADVoost] 쇼핑`은 검색광고 API에 포함되지 않음 |
| CEO Board Slack 예약 발송 | 가능 | Sentia/ceostaff-bot runbook 존재. 실제 발송은 승인 필요 |

## 역할 분리

### Hermes

Hermes는 화면 원본 수집자다. 사람이 네이버 광고주센터에서 보는 화면을 맥미니 Chrome으로 읽고, 원본 파일과 증거 이미지를 남긴다.

허용:

- 네이버 광고주센터 대시보드 열기
- 날짜 선택
- 전체 캠페인 또는 보고서 화면 열기
- XLSX/CSV 다운로드
- 스크린샷 저장
- 결과 JSON 작성
- GitHub private repo push

금지:

- 광고 만들기
- 광고 수정
- 예산 변경
- 충전
- 발행
- 삭제
- 전환 추적 변경
- 네이버 전환 전송

### Codex

Codex는 검산자와 보고서 조립자다. Hermes 원본을 읽어 같은 기간의 매출 JSON과 합치고, Slack no-send 미리보기 문구를 만든다.

허용:

- Hermes GitHub repo pull
- 결과 JSON/XLSX 파싱
- 매출 원장과 같은 기간으로 광고비 합산
- source warning 작성
- CEO Board Slack no-send preview 생성
- 프론트엔드 HTML 보고서 업데이트

금지:

- 네이버 UI 조작
- Slack 실제 발송 또는 예약
- 운영DB write
- 광고 플랫폼 전송

### Sentia CEO Board

Sentia는 Slack 발송자다. CEO Board VM의 Slack 토큰을 읽어 `sentia_ai` 채널에 최종 메시지를 보낸다.

허용:

- 채널 ID 조회
- 봇 멤버 여부 확인
- 승인 후 예약 메시지 생성
- 예약 목록 검증

금지:

- 토큰 원문 출력
- 승인 없는 즉시 발송
- 승인 없는 예약 발송

## 권장 데이터 흐름

```text
1. Codex가 command JSON 작성
   ↓
2. GitHub private repo에 push
   ↓
3. TJ님이 Telegram으로 Hermes에게 "pull 후 실행" 알림
   ↓
4. Hermes가 네이버 광고주센터에서 read-only 다운로드
   ↓
5. Hermes가 result JSON + XLSX + screenshot을 GitHub에 push
   ↓
6. Codex가 GitHub 결과를 pull
   ↓
7. Codex가 매출 JSON과 같은 기간으로 광고비 합산
   ↓
8. Codex가 Slack no-send preview 생성
   ↓
9. TJ님 승인 후 Sentia가 sentia_ai에 예약/발송
```

## GitHub command/result 계약

GitHub는 원본과 결과의 감사 로그다. 누가 언제 어떤 기간을 조회했는지 남기기 위한 장부로 쓴다.

### command 파일

위치:

```text
commands/naver-display-weekly-thecleancoffee-YYYYMMDD.json
commands/naver-display-weekly-teamketo-YYYYMMDD.json
commands/naver-display-monthly-thecleancoffee-YYYYMMDD.json
```

필수 필드:

```json
{
  "schema_version": "hermes-command-v1",
  "mode": "read_only_download_only",
  "site": "thecleancoffee",
  "account_id": "2424664",
  "date_range": {
    "start": "2026-05-18",
    "end": "2026-05-24",
    "timezone": "Asia/Seoul"
  },
  "targets": [
    {
      "campaign_name": "[ADVoost] 쇼핑",
      "campaign_id_hint": "1261102",
      "channel": "naver_display_advoost"
    }
  ],
  "allowed_actions": [
    "open_dashboard",
    "set_date_range",
    "open_all_campaigns",
    "download_report",
    "capture_screenshot"
  ],
  "forbidden_actions": [
    "create_ad",
    "edit_ad",
    "change_budget",
    "charge_bizmoney",
    "publish",
    "delete",
    "send_conversion",
    "change_tracking"
  ],
  "expected_outputs": {
    "result_file": "results/naver-display-weekly-thecleancoffee-YYYYMMDD.result.json",
    "download_file": "downloads/naver-display-weekly-thecleancoffee-YYYYMMDD.xlsx",
    "screenshot_file": "screenshots/naver-display-weekly-thecleancoffee-YYYYMMDD.png"
  }
}
```

### result 파일

Codex가 최소로 기대하는 필드:

```json
{
  "status": "DOWNLOAD_VERIFIED",
  "mode": "read_only_download_only",
  "site": "thecleancoffee",
  "account_id": "2424664",
  "date_range": {
    "start": "2026-05-18",
    "end": "2026-05-24",
    "timezone": "Asia/Seoul"
  },
  "rows": [
    {
      "campaign_name": "[ADVoost] 쇼핑",
      "campaign_type": "ADVoost 쇼핑",
      "impressions": 25303,
      "clicks": 194,
      "spend_krw": 350098,
      "platform_conversion_value_krw": 3463700,
      "source_file": "downloads/..."
    }
  ],
  "verification": {
    "download_file_exists": true,
    "screenshot_file_exists": true,
    "forbidden_actions_triggered": 0,
    "ad_state_change_verified_zero": true
  }
}
```

## Codex 집계 규칙

### 광고비 합산

네이버 광고비는 두 줄로 분리한다.

1. 검색광고 API 광고비: 공식 검색광고 API에서 온 값.
2. 성과형 디스플레이 광고비: Hermes XLSX 원본에서 온 값.

합계:

```text
Naver 광고비 = 검색광고 API 광고비 + Hermes 성과형 디스플레이 광고비
```

단, 기간이 다르면 합치지 않는다. Hermes 파일과 매출 JSON의 시작일·종료일이 같을 때만 Slack 보고에 포함한다.

### 매출과 광고비 분리

- 매출: 내부 결제완료 또는 채널별 정본 원장 기준.
- 광고비: 플랫폼 지출 기준.
- 네이버 주장 전환금액: 참고값. 내부 매출에 합산하지 않는다.

### 더클린커피 주의점

더클린커피 `[ADVoost] 쇼핑`은 스마트스토어 랜딩이다. 따라서 자사몰 매출과 바로 ROAS를 만들면 안 된다. 스마트스토어 매출 원장과 같은 기간으로 맞춰야 한다.

### 팀키토 주의점

팀키토는 쿠팡/스마트스토어/기타 채널과 섞일 가능성이 있다. Hermes가 광고비를 받더라도, 매출 분자는 팀키토 기준 채널과 같은 기간으로 다시 맞춰야 한다.

## Slack 보고 흐름

### no-send preview

Codex가 먼저 아래 파일을 만든다.

```text
report/slack-preview-ceo-board-sales-ad-spend-YYYYMMDD.json
report/slack-preview-ceo-board-sales-ad-spend-YYYYMMDD.md
```

포함 필드:

- 보고 기간
- 브랜드: 더클린커피 / 팀키토 / 바이오컴
- 매출 합계
- 광고비 합계
- 매출 대비 광고비 %
- 채널별 매출
- 광고 채널별 광고비
- source freshness
- source warning
- Hermes evidence commit
- Slack 발송 예정 채널: `sentia_ai`

### 실제 Slack 발송

실제 발송은 별도 승인 후 Sentia가 한다.

원칙:

- Slack 토큰 원문 출력 금지.
- `sentia_ai` 채널 ID를 먼저 확인한다.
- Sentia/ceostaff-bot이 채널에 있는지 확인한다.
- 예약 발송이면 `chat.scheduleMessage`, 즉시 발송이면 별도 승인 문구가 있어야 한다.
- 최종 보고에는 channel name, channel id, 예약 시각, scheduled_message_id만 남긴다.

## 운영 주기 제안

### 1단계: 수동 호출 + GitHub 기록

기간: 지금부터 1-2주.

방식:

- Codex가 command 작성.
- TJ님이 Telegram으로 Hermes에게 실행 알림.
- Hermes가 결과 push.
- Codex가 no-send preview 작성.
- TJ님 승인 후 Sentia Slack 발송.

장점:

- 1분 polling이 필요 없다.
- 광고 계정 화면 자동 조작 리스크가 낮다.
- 오류가 나도 사람이 바로 파악할 수 있다.

### 2단계: 맥미니 launchd 주기 실행

기간: 수동 호출이 2회 이상 안정화된 뒤.

방식:

- 매주 월요일 08:50 KST: 전주 월-일 광고비 다운로드.
- 매월 1일 08:50 KST: 전월 1일-말일 광고비 다운로드.
- runner는 1분마다 돌지 않고 정해진 시각에만 한 번 돈다.
- 실패하면 GitHub result에 `FAILED_BLOCKED_ACCESS` 같은 상태를 남기고 Telegram 알림만 보낸다.

장점:

- 맥미니 자원 부담이 작다.
- Codex가 결과만 읽으면 된다.
- Slack 보고 전 no-send 검산 시간을 확보할 수 있다.

### 3단계: CEO Board 정식 발송

조건:

- Hermes 결과 2회 연속 PASS.
- Codex no-send preview 2회 연속 raw 식별자 0.
- 매출 원장과 광고비 기간이 자동으로 맞음.
- Sentia `sentia_ai` 채널 예약 검증 PASS.

그 뒤에만 정기 Slack 발송을 Yellow Lane 승인안으로 전환한다.

## Slack 메시지 예시

```text
[CEO Board] 더클린커피 주간 매출·광고비 리포트
기간: 2026-05-18 - 2026-05-24 KST

매출: __원
광고비: __원
매출 대비 광고비: __%

채널별 매출:
- 자사몰: __원
- 스마트스토어: __원
- 쿠팡: __원

광고비:
- Meta: __원
- Naver 검색광고: __원
- Naver 디스플레이: __원
- Google: __원
- TikTok: 0원

주의:
- 네이버 디스플레이는 Hermes 원본 파일 기준입니다.
- 네이버 주장 전환금액은 내부 매출에 합산하지 않았습니다.
- 더클린커피 ADVoost는 스마트스토어 랜딩이라 자사몰 ROAS로 보지 않습니다.
```

## 실패 상태 정의

| 상태 | 뜻 | Codex 해석 |
|---|---|---|
| `DOWNLOAD_VERIFIED` | 다운로드와 row 검증 성공 | Slack no-send에 반영 가능 |
| `DOWNLOAD_VERIFIED_WITH_DELTA` | 화면/파일 금액이 1원 등 소폭 차이 | 파일 원본 우선, 차이 주석 |
| `NO_FILE_CREATED` | 화면 접근은 됐지만 파일 없음 | 보고서 화면 경로 재시도 |
| `BLOCKED_ACCESS` | 로그인/권한/2FA 막힘 | TJ님 또는 Hermes 확인 필요 |
| `FORBIDDEN_UI_DETECTED` | 위험 버튼/화면 등장 | 즉시 중단, 결과 제외 |
| `DATE_RANGE_MISMATCH` | 기간 불일치 | 매출 JSON과 합산 금지 |
| `CAMPAIGN_NOT_FOUND` | 대상 캠페인 없음 | 0원인지, 계정/필터 문제인지 재확인 |

## 승인 게이트

Green:

- command/result 설계
- Hermes 결과 pull
- XLSX/JSON 파싱
- no-send preview
- HTML 보고서 업데이트

Yellow:

- 맥미니 launchd 주기 실행 등록
- CEO Board VM에서 Slack 예약 메시지 생성
- Sentia Slack 채널 ID/봇 멤버 확인

Red:

- 광고 계정 설정 변경
- 예산 변경
- 충전
- 광고 생성/수정/발행/삭제
- 네이버 전환 전송
- 운영DB write
- 자동 Slack 즉시 발송 상시화

## 다음 실행 카드

### Auto Green 1. 팀키토 Hermes 결과 수신 후 Codex import

- 무엇: 팀키토 광고비 result JSON/XLSX를 읽어 no-send preview에 붙인다.
- 왜: 더클린커피만 확인되면 CEO Board 총 광고비가 빠진다.
- 어떻게: Hermes GitHub repo에서 최신 `results/*.json`과 `downloads/*.xlsx`를 pull한 뒤, 브랜드별 `site`와 `account_id`를 분리한다.
- 담당: Codex
- 성공 기준: 팀키토 광고비가 기간, 계정, 캠페인명, 원본 파일 경로와 함께 JSON에 들어간다.
- 승인 필요 여부: 없음.
- 추천 점수: 92%

### Auto Green 2. CEO Board Slack no-send preview 생성

- 무엇: `sentia_ai`에 보낼 메시지를 실제 발송 없이 Markdown/JSON으로 만든다.
- 왜: 메시지 길이, 숫자, source warning을 먼저 검산해야 한다.
- 어떻게: 더클린커피/팀키토 매출 JSON과 Hermes 광고비 JSON을 같은 기간으로 합친다.
- 담당: Codex
- 성공 기준: raw 식별자 0, 매출·광고비·비중·source warning 포함.
- 승인 필요 여부: 없음.
- 추천 점수: 90%

### Yellow 1. Sentia Slack 예약 발송 승인

- 무엇: CEO Board VM에서 Sentia 봇으로 `sentia_ai` 채널에 예약 메시지를 보낸다.
- 왜: 보고서는 실제 Slack에 들어가야 운영 루틴이 된다.
- 어떻게: `slack/!slackmsg.md` 절차대로 토큰은 VM env에서만 읽고, 채널 ID와 봇 멤버 여부를 확인한 뒤 `chat.scheduleMessage`를 호출한다.
- 담당: TJ님 승인 + Codex 실행 가능
- 성공 기준: scheduled_message_id가 확인되고 예약 목록에 메시지가 보인다.
- 승인 필요 여부: 필요.
- 추천 점수: 82%

### Yellow 2. 맥미니 launchd 정기 실행 등록

- 무엇: Hermes가 매주/매월 정해진 시각에 Git pull → command 검증 → 브라우저 다운로드 → result push를 실행하도록 한다.
- 왜: Telegram 수동 호출이 반복되면 운영이 느슨해진다.
- 어떻게: 1분 polling이 아니라 주 1회·월 1회 launchd job으로 실행한다.
- 담당: Hermes/TJ님 승인 필요
- 성공 기준: 정해진 시각에 result JSON이 GitHub에 올라오고, 실패 시 실패 상태가 남는다.
- 승인 필요 여부: 필요.
- 추천 점수: 78%

