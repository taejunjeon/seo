# GTM Default Workspace stale conflict cleanup 결과

작성 시각: 2026-05-07 16:40 KST
상태: completed
Owner: gdn / gtm
Supersedes: none
Next document: fresh workspace 작업 시 별도 승인안
Do not use for: GTM Production publish 승인, Google Ads/GA4/Meta 전송 승인, Google Tag Gateway 설정 승인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Yellow cleanup, no publish
  allowed_actions:
    - GTM API read-only 상태 확인
    - Default Workspace stale conflict backup
    - tag 118 single conflict cleanup
    - workspace change revert
  forbidden_actions:
    - GTM submit
    - GTM Production publish
    - Google Tag Gateway 설정
    - Google Ads/GA4/Meta/TikTok/Naver 전송
    - Google Ads conversion action 생성/변경
  source_window_freshness_confidence:
    source: "Google Tag Manager API v2"
    window: "2026-05-07 16:26~16:37 KST"
    freshness: "live API"
    confidence: 0.96
```

## 10초 결론

Default Workspace `147`에 남아 있던 오래된 tag `118` 충돌을 최신 live 기준으로 정리했다.

GTM live version은 `142 / paid_click_intent_v1_receiver_20260506T150218Z` 그대로 유지됐다. `Submit`, `Production publish`, 외부 플랫폼 전송은 하지 않았다.

## 실행 결과

| 항목 | 정리 전 | 정리 후 |
|---|---:|---:|
| live version | 142 | 142 |
| live version name | `paid_click_intent_v1_receiver_20260506T150218Z` | 동일 |
| Default Workspace id | 147 | 147 |
| workspace changes | 1 | 0 |
| merge conflicts | 1 | 0 |
| conflict target | tag `118` | 없음 |
| live changed | 해당 없음 | No |
| Production publish | No | No |

## 확인한 충돌

대상은 tag `118` 단일 건이었다.

```text
tagId: 118
name: HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)
changeStatus: updated
workspace fingerprint before: 1777280570000
base/live synced fingerprint: 1777280990939
```

오래된 workspace 쪽 tag notes에는 2026-04-27 NPay intent preview 작업 흔적이 남아 있었다. 따라서 현재 작업공간 변경사항을 살리지 않고 최신 live 기준으로 폐기하는 방향이 맞다고 판정했다.

## 실행 절차

1. GTM API로 live version, Default Workspace, workspace status를 read-only 확인했다.
2. `data/gtm-default-workspace-conflict-cleanup-20260507T073126Z-backup.json`에 raw backup을 남겼다.
3. `workspaces.resolve_conflict`로 conflict를 최신 base entity 기준으로 resolve했다.
4. resolve 후 conflict는 0이 되었지만 workspace change 1건이 남아 `tags.revert`를 추가 실행했다.
5. 최종 상태를 다시 읽어 `workspaceChangeCount=0`, `mergeConflictCount=0`, live version unchanged를 확인했다.

## 산출물

| 파일 | 용도 |
|---|---|
| `backend/scripts/gtm-default-workspace-conflict-cleanup.ts` | GTM Default Workspace conflict 진단/정리 스크립트 |
| `data/gtm-default-workspace-conflict-cleanup-20260507T073126Z.json` | 최초 dry-run 결과 |
| `data/gtm-default-workspace-conflict-cleanup-20260507T073126Z-backup.json` | 최초 raw backup |
| `data/gtm-default-workspace-conflict-cleanup-20260507T073421Z.json` | resolve_conflict 실행 결과 |
| `data/gtm-default-workspace-conflict-cleanup-20260507T073704Z.json` | 최종 revert 및 cleanup PASS 결과 |

## 금지선 준수

- `Submit` 하지 않음.
- `Production publish` 하지 않음.
- Google Tag Gateway 설정하지 않음.
- Google Ads/GA4/Meta/TikTok/Naver 전송하지 않음.
- Google Ads conversion action 생성/변경하지 않음.
- tag `118`의 오래된 workspace 변경사항을 유지하지 않음.

## 다음 할 일

| 순서 | 상태 | 할 일 | 의존성 | 승인 필요 |
|---:|---|---|---|---|
| 1 | 완료 확인 | TJ님이 GTM UI에서 Default Workspace 경고가 사라졌는지 육안 확인 | 독립. API 기준은 이미 PASS | NO |
| 2 | 운영 원칙 유지 | 다음 GTM 작업은 Default Workspace가 아니라 fresh workspace에서 시작 | 독립 | NO |
| 3 | 필요 시 | 새 GTM 작업 전 live latest version을 다시 read-only 확인 | 새 GTM 작업 선행 | NO |

