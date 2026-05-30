---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read: []
  required_context_docs:
    - AGENTS.md
  lane: Yellow
  allowed_actions:
    - VM Cloud repo permission inspection
    - scoped chown for deploy/source directories
    - service-user write smoke
  forbidden_actions:
    - production DB write/import
    - Google Ads send/upload
    - GTM production publish
    - broad recursive chown over backups/data/logs without separate approval
  source_window_freshness_confidence:
    source: VM Cloud SSH stat/namei/write-smoke
    checked_at_kst: 2026-05-28
    confidence: high
---

# VM Cloud repo 권한 정상화 기록 - 2026-05-28

## 결론

VM Cloud backend/frontend 소스 폴더 일부가 `501:root` 소유로 남아 있어, 서비스 사용자 `biocomkr_sns`가 같은 폴더에 임시파일을 만들 수 없었다.

이 때문에 `sed -i`처럼 "같은 디렉터리에 임시파일을 만든 뒤 원본과 교체하는" 편집 방식이 막혔다.

TJ님 승인 후 repo의 핵심 소스/배포 폴더만 `biocomkr_sns:biocomkr_sns`로 정리했다.

## 실행 범위

다음 폴더의 소유권을 `biocomkr_sns:biocomkr_sns`로 변경했다.

- `/home/biocomkr_sns/seo/repo`
- `/home/biocomkr_sns/seo/repo/backend`
- `/home/biocomkr_sns/seo/repo/backend/src`
- `/home/biocomkr_sns/seo/repo/backend/src/bootstrap`
- `/home/biocomkr_sns/seo/repo/backend/src/routes`
- `/home/biocomkr_sns/seo/repo/frontend`
- `/home/biocomkr_sns/seo/repo/frontend/src`
- `/home/biocomkr_sns/seo/repo/frontend/src/app`

또한 다음 소스 하위 경로는 recursive로 정리했다.

- `/home/biocomkr_sns/seo/repo/backend/src`
- `/home/biocomkr_sns/seo/repo/frontend/src`

## 실행하지 않은 것

- `.deploy-backups` 전체 recursive chown은 하지 않았다.
- DB 파일, 로그, 백업 전체에 대한 권한 변경은 하지 않았다.
- Google Ads 전송, GTM publish, 운영DB write는 하지 않았다.

## 검증

서비스 사용자 `biocomkr_sns` 기준으로 다음이 모두 가능해졌다.

- repo root write
- backend directory write
- backend/src write
- frontend/src write
- frontend/src/app write
- backend/src 임시파일 생성/삭제
- frontend/src 임시파일 생성/삭제
- backend/src 내부 임시 파일에 대한 `sed -i`

검증 결과:

```text
writable=yes /home/biocomkr_sns/seo/repo
writable=yes /home/biocomkr_sns/seo/repo/backend
writable=yes /home/biocomkr_sns/seo/repo/backend/src
writable=yes /home/biocomkr_sns/seo/repo/frontend/src
writable=yes /home/biocomkr_sns/seo/repo/frontend/src/app
temp_create_delete=ok
sed_i_smoke=ok
```

## 운영 기준

현재 VM Cloud backend는 PM2/node 프로세스가 `biocomkr_sns` 사용자로 실행된다.

따라서 backend/frontend 소스와 빌드 경로는 `biocomkr_sns:biocomkr_sns`가 소유하는 것이 현재 운영 방식과 맞다.

단, 백업/DB/로그까지 일괄 chown 하는 것은 별도 판단이 필요하다.

## 다음 기준

향후 VM Cloud 배포 중 파일 편집이 막히면 먼저 아래를 확인한다.

```bash
sudo stat -c "%U:%G %a %n" /home/biocomkr_sns/seo/repo /home/biocomkr_sns/seo/repo/backend /home/biocomkr_sns/seo/repo/backend/src
sudo -u biocomkr_sns test -w /home/biocomkr_sns/seo/repo/backend/src && echo writable
```

문제가 반복되면 전체 repo recursive chown이 아니라, 막힌 소스/빌드 경로만 먼저 좁혀서 정리한다.
