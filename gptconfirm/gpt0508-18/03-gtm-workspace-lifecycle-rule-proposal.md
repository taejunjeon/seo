# GTM Workspace Lifecycle Rule proposal

작성 시각: 2026-05-10 00:30 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - harness/gdn/APPROVAL_GATES.md
    - docs/report/text-report-template.md
  lane: Green GTM lifecycle rule proposal
  allowed_actions:
    - documentation proposal
    - verification rule proposal
  forbidden_actions:
    - GTM submit
    - GTM create_version
    - GTM publish
    - VM Cloud write flag ON
    - platform send
  source_window_freshness_confidence:
    source: common harness GTM Workspace Hygiene Rule and gpt0508-13 workspace capacity incident
    window: 2026-05-10 00:30 KST
    site: biocom
    freshness: same-session
    confidence: high
```

## 한 줄 결론

GTM workspace lifecycle 규칙은 `harness/common/HARNESS_GUIDELINES.md`에 이미 핵심이 들어 있습니다. 추가로 필요한 것은 GDN 작업 문서와 보고 템플릿에서 이 규칙을 검증 항목으로 강제하는 것입니다.

## 이미 존재하는 공통 규칙

`harness/common/HARNESS_GUIDELINES.md`에는 이미 아래 규칙이 있습니다.

- Default Workspace 사용 금지.
- live latest 기준 fresh workspace.
- Preview 시작 전 workspace capacity preflight.
- old Preview workspace TTL/cleanup.
- fresh workspace 생성 성공 전 VM Cloud write flag ON 금지.
- cleanup 전 workspace JSON backup 필수.
- cleanup 후 live version unchanged 확인.
- reuse는 fallback.
- Preview 성공은 Production publish 승인 아님.

따라서 공통 문서에 같은 본문을 복사해 늘리는 것보다, GDN 문서가 이 공통 규칙을 참조하고 검사하도록 만드는 편이 좋습니다.

## GDN 적용 규칙 제안

### harness/gdn/RULES.md

```md
## GTM Workspace Lifecycle Rule

GDN/Path B/Google Ads tracking 작업에서 GTM Preview를 쓰면 공통 `GTM Workspace Hygiene Rule`을 따른다.

1. Default Workspace 사용 금지.
2. live latest 기준 fresh workspace 생성.
3. Preview 시작 전 workspace capacity preflight.
4. fresh workspace 생성 성공 전 VM Cloud write flag ON 금지.
5. old Preview workspace cleanup 전 JSON backup.
6. cleanup 후 live version unchanged 확인.
7. reuse는 fresh create 실패 시 fallback만.
8. submit/create_version/publish는 별도 승인.
9. Preview 성공은 Production publish 승인 아님.
```

### harness/gdn/VERIFY.md

```md
## GTM Workspace Lifecycle 검증

GTM Preview 작업 후 아래를 확인한다.

- workspace capacity preflight 실행 여부.
- fresh workspace id/name.
- Default Workspace 미사용.
- cleanup 전 backup path.
- cleanup 후 live version unchanged.
- submit/create_version/publish 실행 여부.
- VM Cloud write flag ON 시점이 fresh workspace 확보 이후인지.
- Preview 후 write flag OFF cleanup.
```

### harness/gdn/APPROVAL_GATES.md

```md
## GTM Preview Workspace Gate

GTM Preview 승인안에는 workspace lifecycle 계획이 있어야 한다.

- fresh workspace 생성 방식.
- capacity preflight.
- cleanup/backup 계획.
- submit/create_version/publish 금지.
- VM Cloud write flag ON 조건.
- live version unchanged 검증.
```

### docs/report/text-report-template.md

```md
## GTM Workspace Lifecycle

- Default Workspace used: YES/NO
- fresh_workspace_created: YES/NO
- workspace_capacity_preflight: PASS/HOLD/FAIL
- old_workspace_backup_done: YES/NO/N/A
- live_version_unchanged: YES/NO
- submit_create_version_publish: 0/경고
- VM Cloud write flag ON after fresh workspace: YES/NO/N/A
- Preview success treated as Production publish approval: NO
```

## Report wording rule

나쁜 보고:

```text
GTM Preview가 됐으니 Production publish 준비 완료.
```

좋은 보고:

```text
GTM Preview는 브라우저 테스트가 PASS했다는 뜻이다. Production publish는 live 사용자 tracking을 바꾸므로 별도 Red 승인 전에는 진행하지 않는다.
```

## Hard Fail 조건

- Default Workspace에서 새 tag/trigger 작업.
- workspace backup 없이 cleanup/delete.
- fresh workspace 생성 전 VM Cloud write flag ON.
- 승인 없이 submit/create_version/publish 실행.
- cleanup 후 live version이 바뀜.
- Production publish를 Preview 성공의 자동 다음 단계로 처리.

## 이번 사건에서 배운 점

gpt0508-13에서 GTM API `workspaces.create`가 `429 RESOURCE_EXHAUSTED`를 반환했습니다. 이 자체는 Path B 코드 실패가 아닙니다. workspace capacity preflight와 old Preview workspace cleanup이 Preview 전 선행 조건이어야 함을 보여준 사례입니다.

## patch 추천

바로 patch 추천입니다.

- `harness/gdn/RULES.md`
- `harness/gdn/VERIFY.md`
- `harness/gdn/APPROVAL_GATES.md`
- `harness/gdn/AUDITOR_CHECKLIST.md`
- `docs/report/text-report-template.md`

공통 문서 `harness/common/HARNESS_GUIDELINES.md`는 이미 규칙이 있으므로 중복 patch는 비추천입니다.
