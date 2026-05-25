# Hermes command/result bridge for Naver Ads

목적: Codex와 Hermes가 채팅 명령을 직접 실행하지 않고, Git에 남는 command/result 파일로 네이버 광고주센터 read-only 다운로드 작업을 주고받는다.

## 운영 원칙

- Slack/Telegram은 지시 채널이 아니라 알림 채널로만 쓴다.
- Hermes는 `commands/*.json` 중 안전 검증을 통과한 파일만 실행한다.
- 허용 범위는 대시보드 열기, 날짜 선택, 캠페인 리포트 열기, 다운로드, 스크린샷 캡처뿐이다.
- 광고 생성/수정/예산 변경/충전/발행/삭제/전환 전송/트래킹 변경은 금지한다.
- 실제 Chrome 조작은 Mac mini의 전용 CDP Chrome 프로필만 대상으로 한다.

## 폴더 구조

```text
hermes/
  commands/      # Codex가 작업 지시 JSON을 작성
  results/       # Hermes가 실행/검증 결과 JSON을 작성
  downloads/     # Hermes가 받은 CSV/XLSX 등 원본 파일
  screenshots/   # Hermes가 캡처한 증거 이미지
  scripts/       # command 검증/실행 보조 스크립트
  schemas/       # command JSON schema
```

## 기본 흐름

1. Codex가 `commands/naver-display-export-YYYYMMDD.json` 작성 후 commit/push.
2. Hermes가 `git pull` 후 아래 명령으로 command를 검증한다.
   ```bash
   python3 scripts/validate_command.py commands/naver-display-export-20260525.json
   ```
3. 검증 통과 후 Hermes가 CDP Chrome에서 read-only/download-only 작업을 수행한다.
4. Hermes가 `results/*.result.json`, `screenshots/*`, `downloads/*`를 저장한다.
5. Hermes가 commit/push 한다.
6. Codex가 결과를 읽어 report/Slack no-send에 반영한다.

## 실행 전 확인

```bash
# Chrome CDP가 살아 있는지 확인
curl -sS http://127.0.0.1:9222/json/version

# command 검증
python3 scripts/validate_command.py commands/naver-display-export-20260525.json
```

## Lane / 안전 등급

현재 저장소 스캐폴드와 command 검증은 Green Lane이다. 실제 네이버 광고주센터 UI 클릭은 read-only/download-only 범위 안에서는 Green/Yellow 경계로 보고, 아래 stop 조건이면 즉시 중단한다.

Stop 조건:
- 로그인/2FA/권한 화면이 뜬다.
- 다운로드 외 버튼 클릭이 필요하다.
- 예산/충전/생성/수정/발행/삭제/전환/트래킹 관련 UI가 나타난다.
- 캠페인명 또는 날짜 범위가 command와 다르다.
- 화면 숫자가 `success_criteria`와 크게 다르다.
