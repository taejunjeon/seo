# 04. Next actions

작성 시각: 2026-05-15 00:55 KST

## Track A. confirmed purchase 후보

### 지금 할 일

- Codex: value guard fixture와 dry-run patch를 작성한다.
- Codex: 5건 후보를 최신 Imweb direct/status list/API/cache 기준으로 다시 조회한다.
- Codex: duplicate event_id와 already_sent guard를 확인한다.

### 승인 필요한 일

- VM Cloud backend deploy/restart: Yellow 승인 필요.
- Meta backfill send: Red 승인 필요.

### 오늘 안에 가능한 일

- value guard local patch + fixture.
- 5건 후보 최신 dry-run.
- backfill approval packet 작성.

### 절대 하면 안 되는 일

- 5건을 바로 Meta에 보내기.
- value mismatch 상태에서 send.
- pending 전체 confirmed 승격.

## Track B. API not found no-send 원인 분류

### 지금 할 일

- Codex: API not found 48건을 checkout artifact bucket으로 유지한다.
- Codex: latest 증가분과 VM Cloud cache blank 8건은 status sync/admin UI 확인 후보로 분리한다.

### 승인 필요한 일

- 운영DB write/import 없음.
- VM Cloud schema migration 없음.
- 관리자 UI raw 확인은 TJ님 화면 확인이 필요할 수 있음.

### 오늘 안에 가능한 일

- status sync 재조회.
- safe_ref별 admin UI lookup 요청표 작성.

### 절대 하면 안 되는 일

- API not found를 구매완료로 간주.
- footer payment_success 단독으로 Meta Purchase send.

## Track C. browser Purchase fallback/dedup

### 지금 할 일

- Codex: controlled browser Purchase test-only approval packet 작성.
- TJ님: Meta Test Events UI에서 test-only Purchase가 보이는지 확인.

### 승인 필요한 일

- browser Purchase 발화는 별도 승인 필요.
- production page 발화는 금지.

### 오늘 안에 가능한 일

- preview-only plan 작성.
- eventID/event_id pairing spec 작성.

### 절대 하면 안 되는 일

- Pixel 전체 직접 삽입.
- 아임웹 footer 저장.
- GTM publish.
- 운영 사이트 checkout/payment page에서 browser Purchase 직접 발화.

## 추천 우선순위

1. Value guard patch부터 한다. 추천 점수 94%.
2. Imweb confirmed 5건 최신 재조회로 backfill 후보를 다시 만든다. 추천 점수 88%.
3. Browser Purchase controlled test-only approval packet을 만든다. 추천 점수 76%.
4. 관리자 UI lookup은 48건 전체가 아니라 status/cache gap safe_ref부터 본다. 추천 점수 68%.
