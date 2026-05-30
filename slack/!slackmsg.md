# Sentia Slack 예약 메시지 운영 메모

작성일: 2026-05-25  
목적: CEO Board VM에 설정된 Sentia/ceostaff-bot으로 Slack 예약 메시지를 안전하게 보낸다.

## 10초 요약

- Slack 토큰 원문은 절대 출력하지 않는다.
- 토큰은 CEO Board VM의 `/etc/ceoboard/backend.env`에서 `SLACK_BOT_TOKEN`만 읽어 사용한다.
- 채널은 먼저 `conversations.list`로 찾고, `is_member=true`일 때만 예약한다.
- 예약은 `chat.scheduleMessage`로 만들고, `chat.scheduledMessages.list`로 실제 목록에 있는지 확인한다.
- 최종 기록에는 채널명, 채널 ID, 예약 시각, `scheduled_message_id`, 검증 결과만 남긴다.

## 기준 환경

- VM: `taejun@34.64.104.94`
- env 파일: `/etc/ceoboard/backend.env`
- env key: `SLACK_BOT_TOKEN`
- 시간 기준: `Asia/Seoul`
- 기본 전송 방식: 예약 발송

## 실행 절차

1. 채널 ID를 확인한다.
   - VM에서 `SLACK_BOT_TOKEN`을 읽는다.
   - Slack `conversations.list`를 호출한다.
   - 대상 채널명이 정확히 1개만 잡히는지 확인한다.
   - `is_member=true`인지 확인한다.
   - 비슷한 채널이 여러 개면 예약하지 말고 후보를 보고한다.

2. 예약 시각을 계산한다.
   - TJ님이 말한 시간을 `Asia/Seoul` 기준으로 해석한다.
   - Python `zoneinfo` 또는 같은 수준의 시간대 변환으로 Unix timestamp를 만든다.
   - 예: `2026-05-26 09:30 KST` -> `1779755400`

3. 예약 메시지를 만든다.
   - Slack API: `chat.scheduleMessage`
   - 필수 payload:
     - `channel`: 채널 ID
     - `text`: 메시지 본문
     - `post_at`: Unix timestamp
     - `mrkdwn`: `true`
     - `unfurl_links`: `false`

4. 예약 목록을 확인한다.
   - Slack API: `chat.scheduledMessages.list`
   - 같은 channel과 예약 시각 전후 window로 조회한다.
   - 응답에서 `scheduled_message_id`가 확인되면 성공으로 본다.

## 안전 규칙

- Slack 토큰, webhook, secret 원문은 문서/채팅/로그에 남기지 않는다.
- 예약 발송과 즉시 발송을 혼동하지 않는다.
- 봇이 채널 멤버가 아니면 Slack에서 Sentia/ceostaff-bot을 먼저 초대해야 한다.
- 예약 취소가 필요할 수 있으므로 `scheduled_message_id`를 반드시 기록한다.
- 광고 계정, 운영DB, GTM, 결제, 외부 전환 전송과는 무관한 Slack 예약 작업으로 한정한다.

## 실패 시 해석

- `TOKEN_READ_FAILED`: VM에서 env 파일을 읽지 못했다. sudo 권한 또는 파일 경로를 확인한다.
- `TOKEN_MISSING`: env 파일에 `SLACK_BOT_TOKEN`이 없거나 비어 있다.
- `CHANNEL_MATCH_BLOCKED`: 채널명이 없거나 여러 개다. 후보를 TJ님에게 보여주고 확인받는다.
- `BOT_NOT_IN_CHANNEL`: Sentia/ceostaff-bot이 채널에 없다. Slack에서 봇을 초대해야 한다.
- `SCHEDULE_FAILED`: Slack 예약 API가 실패했다. Slack error 값을 보고 시간, 권한, 채널 ID를 확인한다.
- `SCHEDULED_BUT_VERIFY_FAILED`: 예약은 됐을 수 있지만 목록 확인이 실패했다. 예약 ID로 재조회한다.

## 2026-05-25 실행 기록

- 목적: `리더-에프앤비` 채널에 더클린커피 주간 성과보고서 자사몰 매출 기준 확인 메시지를 예약한다.
- 채널명: `리더-에프앤비`
- 채널 ID: `C09CUBEDGQG`
- 봇 멤버 여부: `true`
- 예약 시각: `2026-05-26 09:30:00 KST`
- Slack 예약 timestamp: `1779755400`
- scheduled_message_id: `Q0B5K324MMM`
- 예약 목록 확인: `PASS`
- 같은 채널/같은 시각 예약 목록: `2건`
- 참고: 다른 1건은 쿠팡 매출 기준 확인 메시지로, 이번 자사몰 기준 확인 메시지와 다른 예약이다.
- 토큰 출력: `0`
