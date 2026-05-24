# Google Ads 프론트 에러 문구 운영 배포 결과

작성 시각: 2026-05-24 12:54 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - frontrule.md
    - docs/report/text-report-template.md
  lane: Yellow deploy approved by TJ님 in chat
  allowed_actions:
    - deploy frontend/src/app/ads/google/page.tsx only
    - remote backup before overwrite
    - remote frontend lint/build
    - pm2 restart seo-frontend
    - public read-only smoke
  forbidden_actions:
    - backend deploy
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
    - Google Ads conversion upload
    - Google Ads setting change
    - GTM publish
  source_window_freshness_confidence:
    source: VM Cloud frontend + public page smoke + backend read-only API
    window: current production deployment
    freshness: checked immediately after restart
    confidence: high
```

## 결론

`https://biocom.ainativeos.net/ads/google`에서 `evidence-join 실패: internal_real_roas_evidence_join_disabled`가 빨간 장애처럼 보이던 문제를 수정해 운영 배포했다.

이제 해당 상태는 장애가 아니라, 실시간 화면에서 무거운 주문별 연결 계산을 꺼둔 안내로 표시된다.

## 배포 범위

- 변경 파일: `frontend/src/app/ads/google/page.tsx`
- 운영 반영 파일: `/home/biocomkr_sns/seo/repo/frontend/src/app/ads/google/page.tsx`
- 원격 백업:
  - `/home/biocomkr_sns/seo/repo/frontend/_deploy-backup-20260524-google-page/page.tsx.before.20260524T035002Z`

## 파일 해시

```text
before: 2343be00c35cd26d2812d671fad611ecd54158c724c6a18cda6589998980cbe1
after:  e399d6545fd0701e4f38236f3f922784496c0a7c42543306f3159a3bba02e292
```

## 검증

```text
local eslint target file: PASS
harness preflight strict: PASS
remote frontend eslint target file: PASS
remote npm run build: PASS
pm2 restart seo-frontend --update-env: PASS
pm2 save: PASS
public page HTTP status: 200
public Playwright smoke friendlyMessageVisible: true
public Playwright smoke rawFailureVisible: false
public Playwright smoke chartSizeWarningCount: 0
public Playwright smoke pageErrorCount: 0
```

## 운영 상태

```text
seo-frontend: online
restart count: 1 -> 2
backend deploy: not run
Google Ads upload: not run
GTM publish: not run
operational DB write/import: not run
```

## 롤백

필요 시 원격에서 아래 백업 파일을 되돌리고 프론트를 다시 빌드/재시작한다.

```bash
sudo -n -u biocomkr_sns bash -lc '
set -euo pipefail
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /home/biocomkr_sns/seo/repo/frontend
cp _deploy-backup-20260524-google-page/page.tsx.before.20260524T035002Z src/app/ads/google/page.tsx
npm run build
pm2 restart seo-frontend --update-env
pm2 save
'
```
