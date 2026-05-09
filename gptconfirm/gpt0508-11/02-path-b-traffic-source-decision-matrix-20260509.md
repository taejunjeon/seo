# Path B traffic source decision matrix

작성 시각: 2026-05-09 17:08 KST
Status: decision packet only / no publish / no canary execution

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - gptconfirm/gpt0508-10/02-path-b-storage-canary-result-20260509.md
  lane: Green decision matrix writing
  allowed_actions:
    - option analysis
    - risk classification
    - approval boundary definition
  forbidden_actions:
    - traffic generation against production beyond no-send smoke
    - GTM Production publish
    - Imweb production save
    - platform send
    - storage canary execution
  source_window_freshness_confidence:
    source: "gpt0508-7 to gpt0508-10 preview and precheck results"
    window: "2026-05-09 KST"
    freshness: "2026-05-09 17:08 KST"
    confidence: 0.88
```

## 한 줄 결론

limited deploy만으로는 실제 row가 자동으로 생기지 않는다. 다음 canary는 **controlled synthetic**, **GTM Preview controlled**, **Production publish**, **server-side hook** 중 하나를 골라야 한다.

## 선택지 A. Synthetic/manual controlled POST

사람 또는 스크립트가 VM Cloud endpoint에 synthetic payload 1~N건을 직접 보낸다.

장점:

- 가장 빠르다.
- GTM Production publish가 필요 없다.
- row cap, raw 0, platform 0을 검증하기 쉽다.
- deploy 직후 smoke에 적합하다.

리스크:

- 실제 고객 브라우저 흐름을 반영하지 않는다.
- fill rate와 ambiguous rate를 실제 운영 트래픽 기준으로 말할 수 없다.

승인 필요:

- limited deploy 승인.
- flag ON controlled smoke 승인.
- operational schema bootstrap 승인.

실제 고객 트래픽 반영:

- 없음.

raw/platform 위험:

- 낮음. payload를 controlled fixture로 제한할 수 있다.

권장 순서:

- 1순위. deploy 직후 필수 smoke로 사용한다.

## 선택지 B. GTM Preview controlled traffic

GTM fresh workspace Preview에서 실제 주문완료 화면을 열고 Path B endpoint를 호출한다.

장점:

- 브라우저/페이지 변수/로그인 identity/주문완료 URL 흐름을 확인할 수 있다.
- Production publish 없이 controlled browser evidence를 얻을 수 있다.
- gpt0508-7/8에서 이미 성공 패턴이 있다.

리스크:

- Preview 세션은 실제 일반 고객 트래픽이 아니다.
- Tag Assistant stale session, workspace mismatch, 결제수단별 화면 차이가 생길 수 있다.
- row는 controlled/manual 주문 중심이다.

승인 필요:

- limited deploy 승인.
- flag ON controlled smoke 승인.
- GTM Preview only 승인.

실제 고객 트래픽 반영:

- 부분 반영. 실제 화면은 쓰지만 일반 고객 traffic sample은 아니다.

raw/platform 위험:

- 중간. browser payload에 raw email/order가 transient로 들어갈 수 있으나 response/log/storage에는 남기면 안 된다.

권장 순서:

- 2순위. synthetic smoke 다음에 진행한다.

## 선택지 C. Production tag publish

GTM Production에 Path B tag를 publish해 실제 고객 주문완료 traffic을 받는다.

장점:

- 실제 고객 traffic 기준 fill rate를 측정할 수 있다.
- 1h canary의 본래 목적에 가장 가깝다.

리스크:

- GTM Production publish는 Red Lane이다.
- trigger scope가 잘못되면 과다 호출될 수 있다.
- raw payload, platform request, 기존 태그 영향 검증이 더 어렵다.

승인 필요:

- GTM Production publish 별도 Red 승인.
- limited deploy 승인.
- 1h storage canary 승인.
- rollback plan 승인.

실제 고객 트래픽 반영:

- 높음.

raw/platform 위험:

- 높음. 가장 엄격한 precheck와 rollback이 필요하다.

권장 순서:

- 4순위. synthetic + Preview + storage smoke가 모두 PASS한 뒤 검토한다.

## 선택지 D. Server-side order complete hook

브라우저 GTM 대신 VM Cloud backend 또는 기존 주문완료 처리 경로에서 order bridge row를 만든다.

장점:

- 브라우저 변수 누락과 GTM publish 의존도를 줄일 수 있다.
- 서버에서 raw 처리와 HMAC 폐기를 더 통제하기 쉽다.
- 장기적으로 안정적인 구조일 수 있다.

리스크:

- 기존 주문 처리 흐름과 결합도가 높다.
- 개발 범위가 커진다.
- schema/API 영향이 크다.
- NPay/가상계좌/카드별 이벤트 시점 구분이 필요하다.

승인 필요:

- backend 설계 승인.
- deploy 승인.
- schema 승인.
- 결제수단별 QA 승인.

실제 고객 트래픽 반영:

- 높음.

raw/platform 위험:

- 중간. 잘 설계하면 낮출 수 있지만 구현 범위가 크다.

권장 순서:

- 3순위 또는 P1. Production GTM publish 전 대안으로 검토 가치가 있다.

## 권장 순서

1. A: synthetic/manual controlled POST.
2. B: GTM Preview controlled traffic.
3. D: server-side order complete hook 설계 검토.
4. C: Production tag publish.

## 이번 결정

다음 승인에서 바로 정해야 할 것은 두 가지다.

1. limited deploy 후 controlled smoke 1건을 허용할지.
2. 그 다음 row 수집을 GTM Preview controlled로 할지, Production publish까지 갈지.

추천:

- 다음 단계는 A + B까지만 승인한다.
- C는 아직 HOLD.
- D는 P1 설계 후보로 둔다.
