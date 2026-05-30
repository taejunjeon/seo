# 더클린커피 Google 클릭 ID 구조화 저장 Fixture 결과

작성 시각: 2026-05-21 23:59 KST
기준일: 2026-05-21
문서 성격: Coffee 전용 click-id 구조화 저장 로컬 fixture 결과
Lane: Green local fixture / no-send / no-write
정본 연결: `project/coffee-google-click-id-structured-storage-plan-20260521.md`, `project/coffee-google-click-storage-smoke-result-20260521.md`, `imweb/!coderule-thecleancoffee.md`

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - project/coffee-google-click-id-structured-storage-plan-20260521.md
    - project/coffee-google-click-storage-smoke-result-20260521.md
    - scripts/imweb-v443-click-id-fixture.mjs
  lane: Green
  allowed_actions:
    - local_fixture
    - no_send_validation
    - result_documentation
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - Google Ads conversion action mutate
    - Google Ads conversion upload
    - GA4/Meta/Google Ads production send toggle
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: local fixture script
    window: 2026-05-21 23:34 KST execution
    freshness: same-turn fixture
    confidence: 0.93
```

## 10초 요약

Coffee 전용 click-id fixture는 9개 케이스 모두 통과했다. `gclid+gbraid` 클릭은 stale `wbraid`를 끌어오지 않고, 실제 `wbraid` only 클릭은 보존한다.

중요하게는 `gad_campaignid`만 있는 경우를 클릭 ID로 승격하지 않았다. 즉 캠페인 힌트는 저장하지만 Google Ads conversion upload 후보가 되지는 않는다.

## 만든 파일

`scripts/coffee-click-id-structured-storage-fixture.mjs`

역할:

1. Coffee 전용 key/version 기준으로 click-id 병합 규칙을 검증한다.
2. Biocom v4.4.3의 atomic Google click-id 원칙을 Coffee에 맞게 재현한다.
3. `gad_campaignid`가 클릭 ID가 아니라 캠페인 힌트로만 남는지 확인한다.

## 실행 명령

```bash
node scripts/coffee-click-id-structured-storage-fixture.mjs
```

결과:

```text
PASS touch merge: fresh gclid+gbraid must not inherit stale wbraid
PASS touch merge: real wbraid-only Google click must be preserved
PASS touch merge: gad_campaignid-only must not reuse stale Google click id
PASS checkout context: document referrer fresh click outranks polluted storage
PASS checkout context: wbraid-only referrer is preserved
PASS checkout context: gad_campaignid-only is campaign hint, not click id
PASS payment success: versioned checkout context blocks stale fallback
PASS payment success: legacy checkout context remains fallback only when no fresher source exists
PASS fbclid and ttclid behavior stays independent from Google guard

9/9 fixture cases passed
```

## 검증한 핵심

### 1. fresh `gclid+gbraid`

새 클릭이 `gclid+gbraid`를 가지고 있고 과거 저장소에 stale `wbraid`가 있어도, 최종 결과는 `gclid+gbraid`만 유지하고 `wbraid`는 비운다.

결과: PASS

### 2. actual `wbraid` only

새 Google 클릭 자체가 `wbraid`만 가진 경우는 버리면 안 된다.

결과: PASS

### 3. `gad_campaignid` only

`gad_campaignid`만 있는 경우는 캠페인 힌트로 저장한다. 하지만 `has_google_click_id=false`이며, 과거 stale `gclid/wbraid`를 재사용하지 않는다.

결과: PASS

### 4. checkout context

결제 페이지 URL에 click id가 없고 referrer에 fresh click id가 있으면 referrer 묶음을 선택한다. polluted storage의 stale `wbraid`는 따라오지 않는다.

결과: PASS

### 5. payment success

versioned checkout context가 있으면 더 오래된 click context나 last touch로 fallback하지 않는다.

결과: PASS

## 하지 않은 것

- Imweb 운영 custom code 수정 없음
- GTM publish 없음
- backend deploy 없음
- Google Ads conversion upload 없음
- Meta/GA4/Google Ads production send 없음
- 실제 checkout/purchase 없음
- 운영DB/VM Cloud write 없음

## 다음 판단

fixture 기준으로는 Coffee 구조화 저장 설계가 구현 가능하다. 다음 단계는 실제 붙여넣기 후보를 만들기 전에 Meta Pixel eventId no-send smoke 결과와 함께 Coffee full paste 후보 범위를 정하는 것이다.
