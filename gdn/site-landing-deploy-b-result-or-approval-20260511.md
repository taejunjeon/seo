# Deploy-B 실행 결과 (gpt0508-43 작업4)

작성 시각: 2026-05-11 17:30:00 KST
실행 주체: Claude Code (직접 SSH)
승인 근거: gpt0508-43 sprint 명령 작업 4 "deploy 가능하면 진행하고, 아니면 승인안만 최종화" 조항.

## 1. 이번에 가능해진 것

직전 sprint (gpt0508-42) 의 변경이 처음으로 **실제 운영 서버 (VM `34.64.104.94`) 에 반영** 됐다. backend 서버가 `/api/attribution/site-landing/summary` 라는 새 조회 기능을 200 OK 로 응답하기 시작했고, `biocom.ainativeos.net/ads/site-landing` 의 간단한 화면도 정상 200 으로 노출된다. 이제 실제 광고/결제 트래픽이 들어오면 자동으로 고객 유입 장부에 한 줄씩 적힌다.

## 2. 왜 필요했는지

직전 sprint 까지는 코드만 git main 에 올라가 있었고, 운영 서버는 옛 버전을 그대로 돌리고 있었다. 이 상태로는 실제 비율 (organic / paid / direct) 을 측정할 수 없어서 "다음 sprint 의 측정 baseline" 이라는 목표 자체가 의미 없었다.

## 3. 어떻게 작동하는지 (비개발자용)

- 우리 backend 코드 4 파일 + frontend 페이지 1 파일을 mac 에서 직접 SSH 로 운영 서버 디렉토리에 복사했다.
- 운영 서버의 컴파일 명령 (`npm run build`) 을 돌려 코드가 실제로 돌아갈 형태로 변환했다.
- pm2 라는 프로세스 관리자가 서버를 재시작해 새 코드가 메모리에 올라왔다.
- 외부에서 (Cloudflare Tunnel 을 통해) 새 API 가 호출되는지 확인했다.

## 4. 실제로 확인된 결과

- 새 API 호출 결과: `HTTP 200`, 응답 안에 raw 이메일/전화/주민번호/카드 패턴 0 hit, invariants_held 모두 0/false.
- 새 화면 호출 결과: `biocom.ainativeos.net/ads/site-landing` → 200 OK, `coffeevip.ainativeos.net/ads/site-landing` → 200 OK.
- 현재 row 수 0 — 자연 트래픽이 광고/결제 endpoint 를 한 번이라도 호출하면 즉시 첫 row 가 들어옴.
- pm2 상태: seo-backend / seo-frontend / seo-cloudflared 모두 online.

## 5. 아직 안 된 것

- 실 row 가 아직 0건. 자연 트래픽이 광고/결제 endpoint 한 번이라도 호출하기 전까지는 분포 측정 불가.
- 본 sprint 의 작업 5 분석은 "production deploy 후 30 분 뒤 실측" 이 아닌 "dry-run 기반 추정" 으로 진행.
- naver `nclick_id` 캡쳐 / organic page_view 캡쳐는 다음 sprint 의 GTM Preview 작업 후보 (작업 5 의 verdict 결정).

## 6. deploy 명령 sequence (실제 실행한 그대로)

```bash
# 1. 변경 파일 scp
scp -i ~/.ssh/id_ed25519 backend/src/{siteLandingLedger,siteLandingChannelClassifier,siteLandingFanout}.ts \
    taejun@34.64.104.94:/tmp/seo-deploy-43/
scp -i ~/.ssh/id_ed25519 backend/src/routes/attribution.ts taejun@34.64.104.94:/tmp/seo-deploy-43/

# 2. VM 안에서 cp + 백업
ssh -i ~/.ssh/id_ed25519 taejun@34.64.104.94 'chmod 755 /tmp/seo-deploy-43; \
  sudo -n -u biocomkr_sns bash -lc "
    cp /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts.bak_20260511_gpt0508_43
    cp /tmp/seo-deploy-43/{siteLandingLedger,siteLandingChannelClassifier,siteLandingFanout}.ts /home/biocomkr_sns/seo/repo/backend/src/
    cp /tmp/seo-deploy-43/attribution.ts /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts
  "'

# 3. typecheck + build + restart
ssh -i ~/.ssh/id_ed25519 taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH; \
    cd /home/biocomkr_sns/seo/repo/backend && npm run build && pm2 restart seo-backend --update-env && pm2 save"'

# 4. frontend 페이지 동일 흐름 (scp + build + pm2 restart seo-frontend)

# 5. 검증
curl -s 'https://att.ainativeos.net/api/attribution/site-landing/summary?windowHours=24'
# → 200 + ok:true + total:0 + invariants_held 0/false
```

## 7. failure / rollback

| 항목 | 결과 |
|---|---|
| 실패 발생 | 없음 |
| failure classification | NONE |
| rollback 필요 | NO |
| rollback 명령 (참고) | attribution.ts.bak 복원 + dist 재빌드 + pm2 restart (상세 산출 JSON §rollback_plan_if_failure) |

## 8. invariants 응답 확인 (요청 §검증 충족)

응답 JSON 의 `invariants_held` 필드: `external_send_count=0`, `upload_candidate_count=0`, `gtm_publish=0`, `imweb_footer_edit=0`, `operational_db_write=0`, `raw_email_phone_member_payment_order_in_response=false`. 4 정규식 (email/phone/jumin/카드) 본 응답 hit 0.

## 9. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 작업 5 source gap 측정 (dryrun + 30분 후 live 재확인) | YES | — | 85 | 90 | 80 | 10 | 86 | 진행 |
| TJ님 | biocom.ainativeos.net/ads/site-landing 본인 브라우저로 한 번 방문 + 사이트 한 페이지 클릭 | PARTIAL — Claude Code 도 curl 로 페이지 hit 가능. row 증가는 광고/결제 endpoint 호출 필요 | row 가 들어오려면 marketing-intent / checkout / payment-success 중 한 곳에 실 페이로드가 도달해야 함 — 자연 트래픽 또는 TJ 실 사용 | 80 | 75 | 65 | 15 | 70 | 진행 (수일 단위 자연 트래픽 또는 TJ 실 사용) |

산출 JSON: `data/site-landing-deploy-b-result-or-approval-20260511.json`
