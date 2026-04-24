# 더클린커피 정기구독 트랙 운영 가이드

작성일: 2026-04-24
문서 성격: **가변형 정본** (운영 매뉴얼)
상위: [`!datacheckplan.md`](./!datacheckplan.md), [`!coffee_excel_backfill_plan.md`](./!coffee_excel_backfill_plan.md), [`../coffee/coffeevip.md`](../coffee/coffeevip.md)

---

## 0. 한눈에 보기

### 0.1 인프라 파일

| 자산 | 위치 | 역할 |
|---|---|---|
| 트랙·로그 테이블 | `backend/src/crmLocalDb.ts` (coffee_subscriber_track / _log / coffee_notification_log) | 데이터 저장 |
| 트랙 sync 모듈 | `backend/src/subscriberTrackSync.ts` | phone별 카운터 → 트랙 결정 |
| 알림톡 모듈 | `backend/src/subscriberTrackNotifier.ts` | 6종 템플릿 + 발송 + 중복 차단 |
| 라우트 | `backend/src/routes/coffee.ts` | 6개 API |
| 일괄 cron | `backend/scripts/coffee-daily-cron.cjs` | 일 1회 통합 실행 |
| 트랙만 sync | `backend/scripts/sync-subscriber-tracks.cjs` | 단독 실행 |

### 0.2 API 엔드포인트

```
POST /api/coffee/sync-subscriber-tracks       # 트랙 카운터 갱신 (멱등)
GET  /api/coffee/subscriber-tracks            # 분포·이탈위험·최근 변경
GET  /api/coffee/notification-templates       # 6종 템플릿 정의 + 등록 상태
POST /api/coffee/dispatch-track-promotions    # 진입 알림톡 4종 발송
POST /api/coffee/dispatch-churn-prevention    # 이탈 방지 2종 발송
GET  /api/coffee/notification-stats           # 발송 통계 + 최근 30건
```

### 0.3 트랙 정의 (직전 12개월 정기결제 횟수 기준)

| 트랙 | 조건 | 등급 매핑 | 첫 sync 인원 (2026-04-24) |
|---|---|---|---|
| EVERGREEN | 24회+ | MASTER 동급 | **2명** |
| MANIAC | 12~23회 | SIGNATURE 동급 | **19명** |
| LOYALIST | 6~11회 | RESERVE 동급 | **145명** |
| SUBSCRIBER | 1~5회 | CREW 동급 | **261명** |
| NONE | 0회 (휴면) | — | **129명** |
| **churn 위험** | 직전 30일 무결제 + 트랙≠NONE | — | **427명** |

---

## 1. 일일 운영 흐름 (cron)

```bash
# 매일 새벽 4시 자동 실행
0 4 * * * cd /Users/vibetj/coding/seo/backend && /usr/local/bin/node scripts/coffee-daily-cron.cjs >> logs/coffee-daily.log 2>&1
```

**스크립트가 하는 일** (3단계):
1. `coffee_payments_excel` 스캔 → phone별 정기결제 카운터 갱신 + 트랙 자동 변경
2. 직전 24시간 트랙 변경자 → 진입 알림톡 발송 (템플릿 4종)
3. churn_risk=1 고객 → 이탈 방지 시퀀스 발송 (30일 gentle / 60일 recovery)

**기본 모드**: `testMode='Y'` (알리고 dry-run · 실제 카톡 안 감 · 이력만 남음)

**실발송 활성화** (사전 검수 끝난 뒤):
```bash
COFFEE_LIVE_DISPATCH=1 node scripts/coffee-daily-cron.cjs
```

cron에서는 환경변수로 lifecycle 분리 권장:
```bash
# 평일만 실발송, 주말은 dry-run
0 4 * * 1-5 ... COFFEE_LIVE_DISPATCH=1 node scripts/coffee-daily-cron.cjs >> ...
0 4 * * 0,6 ... node scripts/coffee-daily-cron.cjs >> ...
```

---

## 2. cron 등록 (사용자 액션)

⚠️ **시스템 설정 변경**이라 사용자가 직접 등록. 명령어:

### 2.1 macOS crontab 사용

```bash
# 1. 현재 등록 확인
crontab -l

# 2. 편집 (vi 열림)
crontab -e

# 3. 아래 한 줄 추가 후 저장 (:wq)
0 4 * * * cd /Users/vibetj/coding/seo/backend && /usr/local/bin/node scripts/coffee-daily-cron.cjs >> logs/coffee-daily.log 2>&1

# 4. 등록 확인
crontab -l

# 5. 검증 (수동 실행)
COFFEE_DRY_RUN=1 node /Users/vibetj/coding/seo/backend/scripts/coffee-daily-cron.cjs
```

### 2.2 Node 경로 확인

```bash
which node   # 보통 /usr/local/bin/node 또는 /opt/homebrew/bin/node 또는 nvm 경로
```

cron은 PATH가 비어있어 절대경로 필수. `which node` 결과를 위 명령어 `/usr/local/bin/node` 자리에 대입.

### 2.3 launchd (대체)

macOS는 launchd가 더 안정. `~/Library/LaunchAgents/com.biocom.coffee-daily.plist`로 등록 가능. 필요하면 별도 요청.

### 2.4 등록 후 모니터링

```bash
# 최근 실행 로그
tail -100 /Users/vibetj/coding/seo/backend/logs/coffee-daily.log

# 알림톡 발송 통계
curl -s http://localhost:7020/api/coffee/notification-stats | jq
```

---

## 3. 알림톡 템플릿 6종

운영 전 **알리고 어드민에서 6종 템플릿 등록 + 검수 통과 → 발급된 tpl_code를 .env에 저장** 필요.

### 3.1 .env 추가 항목

```
ALIGO_TPL_COFFEE_SUBSCRIBER=...   # 발급받은 코드
ALIGO_TPL_COFFEE_LOYALIST=...
ALIGO_TPL_COFFEE_MANIAC=...
ALIGO_TPL_COFFEE_EVERGREEN=...
ALIGO_TPL_COFFEE_CHURN_30=...
ALIGO_TPL_COFFEE_CHURN_60=...
```

코드 미등록 상태에서는 `dispatch-*` 호출 시 `skipped` 처리 (안전장치).

### 3.2 템플릿 미리보기

`GET /api/coffee/notification-templates` 호출 → 6종의 sample_message 확인. 알리고 템플릿 등록 시 그 텍스트를 그대로 복사.

치환 변수: `{name}`, `{next}`, `{paid12m}`, `{track}`, `{recoverDate}` 자리에 알리고 변수 표기 `#{변수명}`으로 치환해서 등록.

### 3.3 템플릿 6종 요약

| 템플릿 키 | 발송 시점 | 분류 | 길이 |
|---|---|---|---|
| TRACK_SUBSCRIBER_WELCOME | 정기결제 1회 첫 진입 | 정보(BA) | ~150자 |
| TRACK_LOYALIST_PROMOTION | 6회 누적 도달 | 정보(BA) | ~200자 |
| TRACK_MANIAC_PROMOTION | 12회 누적 도달 | 정보(BA) | ~250자 |
| TRACK_EVERGREEN_PROMOTION | 24회 누적 도달 | 정보(BA) | ~280자 |
| CHURN_30_GENTLE | 30~59일 무결제 | 정보(BA) | ~180자 |
| CHURN_60_RECOVERY | 60일+ 무결제 | 정보(BA) | ~180자 |

**광고성(AD) 분류 회피** — 모두 정보성으로 등록해야 정기구독자에게 합법적으로 발송 가능.

### 3.4 중복 방지

같은 phone × 같은 template_key 조합은 **30일 내 재발송 차단**. `coffee_notification_log`의 `wasRecentlySent()` 함수가 자동 처리.

---

## 4. 이탈 방지 시퀀스 (churn 427명)

현재 더클린커피 정기결제 시작자 556명 중 **427명(76.8%)이 30일+ 무결제 휴면**.

### 4.1 2단계 시퀀스

**Stage 1 · CHURN_30_GENTLE** (30~59일 무결제):
- 톤: 부드러운 안부
- 메시지 핵심: "등급은 그대로 {track}. 다음 결제일에 자동 재개" + "일시 정지 필요시 회신"
- 목적: 결제 카드 만료/잔액 부족 등 우발 이탈 회복

**Stage 2 · CHURN_60_RECOVERY** (60일+ 무결제):
- 톤: 호명 + 등급 회복 마감일 명시
- 메시지 핵심: "{track} 등급은 {recoverDate}까지 유지. 그 전에 재개하면 카운터 이어집니다."
- 목적: 등급 강등 직전 마지막 회복 기회 안내

### 4.2 운영 원칙

- **할인 X, 호명 O** — "당신은 우리의 핵심"이라는 메시지가 본질
- 30일 내 같은 템플릿 재발송 금지 (자동 차단)
- Stage 1 발송 후 30일 지나도 휴면이면 Stage 2 자동 발송

### 4.3 효과 측정

발송 후 7일/14일/30일 시점에 재결제율 추적:

```sql
-- 알림톡 발송 후 14일 내 재결제 전환
WITH dispatched AS (
  SELECT phone_normalized, sent_at FROM coffee_notification_log
  WHERE template_key IN ('CHURN_30_GENTLE','CHURN_60_RECOVERY')
    AND send_status = 'sent' AND test_mode = 0
)
SELECT COUNT(DISTINCT d.phone_normalized) recovered
FROM dispatched d
JOIN coffee_payments_excel cpe ON cpe.payment_at > d.sent_at
JOIN coffee_orders_excel coe ON coe.order_no = cpe.order_no
  AND coe.orderer_phone_norm = d.phone_normalized
WHERE cpe.payment_method = '정기결제'
  AND cpe.payment_at <= datetime(d.sent_at, '+14 days');
```

---

## 5. 트러블슈팅

### 5.1 알림톡 발송 실패

```sql
-- 최근 실패 사례
SELECT phone_normalized, template_key, send_response, sent_at
FROM coffee_notification_log
WHERE send_status='failed' ORDER BY sent_at DESC LIMIT 20;
```

**흔한 원인**:
- `no_template_code` → .env에 ALIGO_TPL_COFFEE_* 미등록
- 알리고 4xx → 템플릿 검수 미완료 또는 메시지 내용 변형 (변수 치환 실패)
- 알리고 quota 부족 → `GET /api/aligo/quota` 확인

### 5.2 트랙 분포가 0

```sql
SELECT COUNT(*) FROM coffee_payments_excel WHERE payment_method='정기결제';
```

이 값이 0이면 결제내역 엑셀 import가 안 된 상태. `node scripts/import-coffee-payment-excel.cjs <파일>` 재실행.

### 5.3 중복 발송 의심

```sql
-- 같은 phone에 같은 template_key 2회+ 발송 여부
SELECT phone_normalized, template_key, COUNT(*) cnt
FROM coffee_notification_log GROUP BY 1,2 HAVING cnt > 1;
```

`wasRecentlySent()` 30일 윈도우는 코드 안에 hardcode. 변경하려면 `subscriberTrackNotifier.ts` 수정.

---

## 6. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-04-24 | 신규 작성 · 인프라 6개 자산 + 6종 템플릿 정의 + cron 가이드 + 이탈 방지 시퀀스 |
