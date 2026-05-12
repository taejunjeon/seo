```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
    - harness/npay-recovery/README.md
  lane: Green local code patch + read-only dry-run + Yellow deploy approval packet
  allowed_actions:
    - local backend code patch
    - fixture/test/typecheck
    - VM Cloud SQLite read-only query
    - source guide/data inventory/total current update
    - gptconfirm packaging
    - scoped commit/push
  forbidden_actions:
    - VM backend deploy/restart before approval
    - operational DB write/import
    - VM Cloud schema migration
    - cron registration/change
    - GTM publish
    - Imweb footer/header edit
    - GA4/Meta/TikTok/Google Ads/Naver send/upload
    - secret/raw email/phone/member_code/order/payment/click_id output
  source_window_freshness_confidence:
    source: VM Cloud SQLite imweb_orders + local backend tests + source guide docs
    window: thecleancoffee NPay last 30 days, checked 2026-05-13 00:24 KST
    freshness: max_order_time=2026-05-12T14:32:39.000Z, max_synced_at=2026-05-12 15:14:50, max_status_synced_at=2026-05-12 04:11:07
    confidence: 0.86
```

## 한 줄 결론

- 결론: 더클린커피 NPay 매출을 `bridge_pending`에서 actual included 후보로 올릴 수 있는 로컬 backend 패치와 테스트가 PASS했다. 실제 live VM 배포는 아직 하지 않았고, 다음 단계는 TJ님이 Yellow deploy/restart를 승인할지 결정하는 것이다.
- Project: gpt0508-49 Codex Coffee Imweb Actual Source Patch Sprint
- Lane: Green 완료, Yellow approval packet 준비
- Mode: local code patch / read-only dry-run / no-send / no-write / no-deploy
- Auditor verdict: `GREEN_PASS_WITH_YELLOW_DEPLOY_HOLD`
- 현재 판정: coffee actual source는 `imweb_v2_vm_cloud_imweb_orders`로 구현 가능. status blank 때문에 `included_with_warning` 권장.
- 자신감: 86%
- 기준 시각: 2026-05-13 00:30 KST

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| 더클린커피 actual reader | 완료 | `backend/src/npayActualConfirmedPgReader.ts` | 로컬 코드 |
| summary API response shape | 완료 | `backend/src/routes/attribution.ts`, `backend/src/siteLandingLedger.ts` | 로컬 코드 |
| fixture/test | 완료 | targeted test 16/16 PASS | 로컬 테스트 DB |
| VM Cloud dry-run | 완료 | 최근 30일 coffee NPay 재계산 | VM Cloud SQLite `imweb_orders` |
| source rule 문서화 | 완료 | data inventory, source guide, coffee current, total current | 로컬 문서 |
| dashboard 상태 확인 | 완료 | 프론트 소스 존재, 현재 로컬 접속은 타임아웃 | 로컬 프론트/백엔드, live backend API |

## 실제 숫자

VM Cloud read-only 기준 더클린커피 최근 30일 NPay는 gross 339건 / 16,631,400원이다. 취소/반품/교환 제외 후 `included_with_warning` 후보는 308건 / 14,835,000원이다. status가 확실히 채워진 non-cancel만 세면 295건 / 13,957,900원이다. status blank는 13건 / 877,100원이다.

`status blank`는 `imweb_status`가 비어 있다는 뜻이다. 이것만으로 미결제라고 보면 안 된다. 이번 패치는 blank row를 포함하되 `status_blank_count`, `status_blank_amount`, `status_sync_stale_over_6h` warning을 같이 내려주는 정책이다.

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| VM backend deploy/restart | 이번 sprint는 approval packet까지만 허용 | YES |
| 운영DB write/import | 범위 밖이고 금지 | YES |
| 외부 플랫폼 send/upload | GA4/광고 전환값 변경 방지 | YES |
| GTM publish / Imweb footer 변경 | 범위 밖이고 금지 | YES |
| 로컬 프론트 재시작 | 이번 핵심은 backend source patch. 현재 7010은 떠 있으나 HTTP timeout | 필요 시 YES |

## 검증 결과

| 검증 | 결과 | 명령/방법 | 비고 |
|---|---|---|---|
| backend typecheck | PASS | `cd backend && npm run typecheck` | 2026-05-13 |
| targeted backend tests | PASS | `npx tsx --test tests/npay-actual-confirmed-pg-reader.test.ts tests/site-landing-npay-actual-source.test.ts tests/site-landing-summary-api.test.ts` | 16/16 PASS |
| VM Cloud dry-run | PASS | read-only SQLite aggregate | no raw order id output |
| source guide consistency | PASS | data inventory/source guide/total current update | GA4 guard-only 명시 |
| AGENTS.md requested rules | PASS | file check | 이미 반영됨 |
| JSON parse | PASS | manifest/current-state/dry-run JSON parse |  |
| wiki links | PASS | `scripts/validate_wiki_links.py` 대상 문서 실행 |  |
| harness preflight strict | PASS | `python3 scripts/harness-preflight-check.py --strict` |  |
| diff whitespace | PASS | `git diff --check` |  |
| raw identifier scan | PASS | gptconfirm/data handoff context scan | campaign id는 raw order/payment/click id가 아님 |

## 대시보드 상태

프론트 대시보드 코드는 있다. 위치는 `frontend/src/app/ads/site-landing/page.tsx`이고 예상 로컬 URL은 `http://localhost:7010/ads/site-landing`이다. 다만 현재 로컬 7010은 프로세스가 떠 있어도 HTTP 응답이 타임아웃이었다. 확실히 접근 가능한 것은 live backend API `https://att.ainativeos.net/api/attribution/site-landing/summary`다.

즉 “백엔드 설계만 있다”는 상태는 아니다. 프론트 페이지 소스까지 있다. 다만 현재 실행 중인 로컬 프론트가 정상 렌더링되는지는 미확인이고, live 프론트 공개 URL도 확인되지 않았다. 원래 Claude Code로 프론트 구현/연결을 계획했던 판단은 여전히 맞다.

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| No-send verified | YES |
| No-write verified | YES |
| No-deploy verified | YES |
| No-publish verified | YES |
| No-platform-send verified | YES |

## 확인하면 좋은 문서

1. `gptconfirm/gpt0508-49/01-implementation-and-validation.md` — 어떤 파일이 바뀌었고 어떤 테스트로 막았는지 확인한다.
2. `gptconfirm/gpt0508-49/02-source-analysis-and-dry-run.md` — 더클린커피 실제 숫자와 status blank 의미를 확인한다.
3. `gptconfirm/gpt0508-49/03-next-actions-and-approval.md` — VM 배포를 승인할지 판단할 실행 범위와 rollback 조건을 확인한다.

## 다음 할일

### Codex가 할 일

1. Yellow 승인 전 대기 상태 유지
- Codex 추천: 진행 추천
- 추천 이유: 로컬 패치와 테스트는 끝났고, live 반영은 운영 backend restart가 필요하므로 승인 게이트가 맞다.
- 추천 방향에 대한 자신감: 90%
- Lane: Yellow
- 무엇을 하는가: TJ님이 승인하면 approval packet 순서대로 pre-snapshot, deploy, build, restart, post-snapshot을 실행한다.
- 성공 기준: live coffee summary가 `included_with_warning`으로 308건 / 약 14,835,000원 근처를 반환하고 biocom actual included가 유지된다.
- 실패 시 해석/대응: API 5xx, biocom regression, cancel included, raw id leak, GA4 actual 사용 발견 시 즉시 rollback.
- 승인 필요: YES, VM deploy/restart이기 때문이다.

### TJ님이 할 일

1. VM 배포 승인 여부 결정
- Codex 추천: 조건부 진행 추천
- 추천 이유: 소스와 테스트는 충분하지만 live backend restart가 필요하고 status blank 13건이 warning으로 남는다.
- 추천 방향에 대한 자신감: 86%
- Lane: Yellow
- 무엇을 하는가: `03-next-actions-and-approval.md`의 승인 범위를 보고 YES/NO를 결정한다.
- 왜 필요한가: 승인 없이는 live coffee summary가 계속 `bridge_pending`으로 남는다.
- 성공 기준: 승인 후 live API에서 coffee actual이 included candidate로 보이고 biocom이 깨지지 않는다.
- Codex가 대신 못 하는 이유: VM deploy/restart는 이번 sprint 금지선이라 TJ님 승인 전 실행할 수 없다.

텔레그램 발송은 사용자 skip 유지로 실행하지 않았다.
