# Google Ads 주문별 진단 VM Cloud 배포 및 1일 매칭 결과

작성 시각: 2026-05-24 KST
문서 성격: Yellow deploy result + read-only 진단 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Yellow deploy approved by TJ님 in chat
  allowed_actions:
    - deploy backend/src/routes/googleAds.ts only
    - remote backup before overwrite
    - remote typecheck/build
    - pm2 restart seo-backend
    - public read-only smoke
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads conversion action change
    - Google Ads primary goal change
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
    - GTM publish
  source_window_freshness_confidence:
    source: VM Cloud backend + Google Ads API + 운영DB tb_iamweb_users + VM Cloud SQLite
    window: last_1d / last_7d
    freshness: VM Cloud live sourceFreshness fresh, sync lag 10 minutes
    confidence: high for deployment and API smoke, high for 1일 direct-match result
```

## 한 줄 결론

주문번호와 Google click id를 그대로 보여주는 주문별 진단 API를 VM Cloud에 배포했다. Google Ads가 어제 하루 “구매완료 21건, 4,050,200원, ROAS 10.17배”라고 주장하지만, 같은 날 실제 결제완료 주문 61건 중 Google click id가 직접 붙은 주문은 0건이라 내부 주문번호로는 아직 연결되지 않는다.

## 배포 범위

- 배포 파일: `backend/src/routes/googleAds.ts`
- 새 API:
  - `/api/google-ads/click-id-health/orders?window=last_1d&only=all&limit=200`
  - `/api/google-ads/click-id-health/orders?window=last_7d&only=with_click_id&limit=50`
- 추가 지원:
  - `/api/google-ads/dashboard?date_preset=last_1d`

## 원격 backup

```text
/home/biocomkr_sns/seo/repo/backend/_deploy-backup-20260524-google-orderdiag/googleAds.ts.before
```

원격 파일 sha256:

```text
before: 86e9e8220d3b9dad70baa0939d971a7ea01dc762478ec5ddd4c3a41bdcd79452
after:  9ca3967c8a47809f4c09ea5e19b1f4ce26e4622baf172ec19b00fce74f4ed224
```

## 배포 검증

```text
remote npm run typecheck: PASS
remote npm run build: PASS
pm2 restart seo-backend: PASS
pm2 save: PASS
/health: 200
seo-backend restart count: 4316 -> 4317
seo-backend status: online
```

주의: `seo-backend` 재시작 후 기존 운영 background job인 CAPI auto-sync가 15건 전송, 85건 skip, 실패 0으로 실행됐다. 이번 작업에서 Google Ads upload나 manual send를 실행한 것은 아니지만, backend restart가 기존 운영 자동작업을 깨웠다는 점은 기록한다.

## Google Ads 1일 주장값

조회 URL:

```text
https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_1d
```

결과:

```text
dateRangeLiteral: YESTERDAY
cost: 398,078원
Google Ads 주장 구매완료: 21건
Google Ads 주장 전환가치: 4,050,200원
Google Ads 주장 ROAS: 10.17x
```

전환 액션:

```text
action id: 7130249515
name: 구매완료
Primary: true
category: PURCHASE
classification: primary_known_npay
riskFlags: known_npay_label, primary_bid_signal_is_npay
```

해석: Google Ads가 입찰 학습에 쓰는 핵심 구매 신호가 NPay 계열 label로 잡힌다. 이 값이 실제 결제완료 주문번호와 1:1로 맞는지는 내부 주문별 click id evidence로 확인해야 한다.

## 1일 내부 주문 매칭

조회 URL:

```text
https://att.ainativeos.net/api/google-ads/click-id-health/orders?window=last_1d&only=with_click_id&limit=10
```

결과:

```text
실제 결제완료 주문: 61건
Google click id 직접 보존: 0건
Google click id 미보존: 61건
returned orders: 0건
sendCandidateCount: 0
uploadCandidateCount: 0
```

해석: Google Ads가 어제 구매 21건이라고 주장했지만, 우리 내부 주문번호 중 “이 주문이 Google click id를 들고 있다”고 직접 말할 수 있는 주문은 0건이다. 따라서 어제 기준으로는 Google Ads 주장 구매 21건을 내부 주문번호 21개로 펼칠 수 없다.

## 7일 기준 direct evidence 주문

조회 URL:

```text
https://att.ainativeos.net/api/google-ads/click-id-health/orders?window=last_7d&only=with_click_id&limit=20
```

결과:

```text
strict payment_complete_time orderCount: 464
withGoogleClickId: 5
missingGoogleClickId: 459
sendCandidateCount: 0
uploadCandidateCount: 0
```

확인된 주문:

```text
202605179351380 / CARD / 245,000원 / gclid 있음
202605172235478 / CARD / 234,927원 / gclid 있음
202605182747344 / CARD / 245,000원 / gclid+gbraid 있음
202605199037917 / CARD / 245,000원 / gclid+gbraid 있음
202605201016693 / CARD / 36,900원 / gclid 있음
```

raw click id 값은 `data/project/google-ads-order-diagnostics-last7-with-click-20260524.json`에 저장되어 있다. 이 파일은 외부 공유 금지다.

## 왜 1일 주장 구매와 주문번호가 안 맞나

Google Ads API는 “구매완료 21건”이라는 광고 플랫폼 안의 숫자와 금액은 준다. 하지만 아임웹 주문번호를 직접 주지 않는다. 그래서 내부 주문번호에 `gclid/gbraid/wbraid`가 남아 있어야만 주문번호까지 연결할 수 있다. 어제 하루는 그 직접 연결이 0건이다.

## Guardrails

```text
Google Ads conversion upload: NOT RUN
Google Ads conversion action change: NOT RUN
Google Ads primary goal change: NOT RUN
operational DB write/import: NOT RUN
VM Cloud SQLite write/schema migration: NOT RUN
GTM publish: NOT RUN
manual external send: NOT RUN
```

## Rollback

필요 시:

```bash
sudo -n -u biocomkr_sns bash -lc '
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /home/biocomkr_sns/seo/repo/backend
cp _deploy-backup-20260524-google-orderdiag/googleAds.ts.before src/routes/googleAds.ts
npm run build
pm2 restart seo-backend --update-env
pm2 save
'
```
