작성 시각: 2026-05-30 11:46 KST
기준일: 2026-05-30
문서 성격: 매출·광고비 리포트 프로젝트 Claude Code 인수인계 문서

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - report/!report.md
    - report/reportcoffee.md
    - report/reportbiocom.md
    - report/hermes-naver-ads-ceo-board-pipeline-design-20260527.md
    - slack/!slackmsg.md
  lane: Green for documentation handoff
  allowed_actions:
    - local_documentation_update
    - read_only_repository_review
    - local_validation
  forbidden_actions:
    - Slack send or schedule
    - operating DB write
    - VM Cloud deploy or restart
    - platform send or upload
    - GTM publish
    - secret or raw customer identifier output
  source_window_freshness_confidence:
    source: local report files + prior read-only DB/API/browser evidence in this project
    window: mainly 2026-04-01 - 2026-05-29 KST
    freshness: 2026-05-30 local repo state; live counters must be rechecked before operational action
    confidence: high for file locations and design state, medium for live channel totals until rerun
```

## 10초 요약

최종 목표는 바이오컴과 더클린커피의 주간·월간 매출, 광고비, 매출 대비 광고비 비중을 Slack으로 자동 보고하는 것이다.

현재는 더클린커피부터 거의 운영 가능한 no-send 구조가 잡혔다. 자사몰, 스마트스토어, 쿠팡 매출 source가 분리됐고, 네이버 광고비는 API와 Hermes 브라우저 수집을 나눠서 처리한다. 바이오컴은 매출/광고비 source map이 있고, 최근에는 자사몰 2026년 4월 상품 수량과 세트 분배 보고서가 추가됐다.

다음 Claude Code가 바로 해야 할 첫 작업은 더클린커피 Slack no-send JSON을 최신 기준으로 재생성하고, 쿠팡 판매 분석 source와 네이버 광고비 source를 같은 주간 window로 붙여 CEO Board Slack 미리보기 문구를 만드는 것이다.

## 최종 목표

1. 더클린커피와 바이오컴의 매출을 채널별로 분리한다.
   - 더클린커피: 자사몰, 스마트스토어, 쿠팡.
   - 바이오컴: 자사몰, NPay, 광고 유입별 내부 결제완료 매출.
2. 광고비를 플랫폼별로 분리한다.
   - Meta, Naver, Google, TikTok, Coupang 광고비.
   - 플랫폼이 주장하는 전환매출은 내부 매출과 합산하지 않는다.
3. Slack 주간/월간 보고에는 아래 숫자를 항상 같이 낸다.
   - 매출액.
   - 광고비.
   - 매출 대비 광고비 %.
   - 채널별 매출.
   - 제품별 TOP 매출.
   - 주요 유입 또는 광고비 source warning.
4. raw 주문번호, 결제번호, 전화번호, 이메일, 회원코드, click id, token은 출력하지 않는다.
5. 실제 Slack 발송 전에는 항상 no-send JSON과 Markdown preview를 먼저 만든다.

## 현재 완료된 작업

### 1. 공통 리포트 정본

- `report/!report.md`에 전체 목표, source 정의, Slack 메시지 초안, 실행 순서를 정리했다.
- 광고비 비중 공식은 `광고비 합계 / 내부 confirmed 매출 합계 * 100`으로 고정했다.
- Google Ads ROAS, Meta 플랫폼 구매값, Naver 플랫폼 전환값은 참고값으로 보고 내부 매출에는 합산하지 않는 원칙을 세웠다.

### 2. 더클린커피 매출 no-send 집계

- 자사몰은 Imweb complete_time 기준으로 연결했다.
- 2026-04-25 - 2026-05-01 자사몰 금액은 5,334,362원으로 Excel과 일치하도록 맞췄다.
- 스마트스토어는 운영DB PlayAuto를 primary로 두되, 네이버 커머스API 권한이 닫히기 전까지 warning을 붙인다.
- 쿠팡 strict 매출은 TeamKeto `revenue-history` 기준으로 전환했다.
- ordersheets는 주문 발생 참고값, settlement-histories는 정산 대조값으로 분리했다.
- `report/reportcoffee-sales-summary-no-send-20260524.json`과 관련 Markdown에 no-send 결과가 있다.

### 3. 더클린커피 프론트엔드 보고서

- `report/reportcoffee-project-executive-report-20260522.html`
  - 프로젝트의 목적, source readiness, OKR, 다음 액션을 사람이 이해할 수 있게 정리한 executive report다.
- `report/reportcoffee-sales-dashboard-20260525.html`
  - 기간 선택이 가능한 더클린커피 매출 보고서다.
  - 2026년 4월, 2026년 5월, 최근 7일, 최근 30일을 볼 수 있다.
  - 채널별 매출, 매출 추이, 광고비 분석, 스마트스토어/쿠팡 TOP 상품을 표시한다.

### 4. 더클린커피 쿠팡 source 조사

- F&B팀 첨부 쿠팡 판매 분석 화면 기준은 기존 보고서 2,100,400원 / 56건과 다르게 2,453,600원 / 60건 / 판매량 71개로 확인됐다.
- 쿠팡 Open API read-only 기준은 같은 기간 판매자배송 커피 1,132,700원 + 로켓그로스 907,000원 = 2,039,700원이었다.
- 기존 보고서와의 차이 60,700원 / 2건은 아직 좁히는 중이다.
- 쿠팡 판매 분석 화면의 방문자, 조회, 장바구니, 구매전환율 요약을 공식 Open API로 직접 받는 endpoint는 확인하지 못했다.
- 정확한 F&B 화면 기준 자동화는 Hermes 브라우저 다운로드를 primary 후보로 둔다.

### 5. 더클린커피 네이버 광고비/Hermes 흐름

- 네이버 성과형 디스플레이 광고 API는 공식 파트너사에 한해 제공되는 것으로 확인했다.
- Hermes가 맥미니 Chrome에서 네이버 광고주센터에 로그인된 상태로 더클린커피 광고비를 read-only 조회하고 XLSX 다운로드할 수 있음을 검증했다.
- GitHub private repo `taejunjeon/hermes-codex-repo`를 Hermes-Codex command/result 공유 장부로 쓴다.
- Hermes 결과:
  - 더클린커피 `[ADVoost] 쇼핑` 2026-05-18 - 2026-05-24 비용 350,098원.
  - 1원 차이는 대시보드 카드와 다운로드 리포트 반올림 또는 집계 기준 차이로 보고, XLSX 기준 350,098원을 우선한다.
- 2026-04-25 - 2026-05-22 네이버 광고비 결과도 Hermes repo에 업로드됐다.

### 6. Slack/Sentia 예약 메시지 runbook

- `slack/!slackmsg.md`에 CEO Board VM의 Sentia Slack 봇 사용법을 정리했다.
- Slack token은 VM `/etc/ceoboard/backend.env`의 `SLACK_BOT_TOKEN`에서 읽고, 원문 출력은 금지한다.
- 예약 발송은 `chat.scheduleMessage`, 검증은 `chat.scheduledMessages.list`로 한다.
- `리더-에프앤비` 예약 메시지 세팅 경험이 기록돼 있다.

### 7. 바이오컴 자사몰 상품 수량/세트 분배 보고서

- `report/reportbiocom-selfmall-product-quantity-set-split-20260529.html`을 만들었다.
- 2026년 4월 운영DB 결제완료 기준:
  - 주문 2,195건.
  - 상품 행 2,580건.
  - 원수량 2,753개.
  - 주문 매출 497,863,546원.
- 상품별 매출과 상위 상품을 표시했다.
- 세트 후보 57개를 AI가 자동 분류하도록 했다.
  - 자동 승인: 46개.
  - 자동 제외: 9개.
  - 사람 검토: 2개.
- 3+1, 2인권, 3인권, 2개, 3개, 4개처럼 명확한 세트는 사람이 다시 컨펌하지 않아도 되는 자동 승인 후보로 표시한다.
- 골라담기는 선택형 단품이므로 세트 분배에서 자동 제외한다.
- 검사권과 영양제가 같은 주문에 함께 담긴 경우는 교차구매로 태그하고 세트 분배에는 넣지 않는다.

## 수정한 파일 목록과 각 파일의 변경 이유

### 이번 인수인계 작업에서 생성/갱신한 파일

- `docs/ai/REPORT_HANDOFF.md`
  - 이유: Claude Code가 매출·광고비 리포트 프로젝트를 바로 이어받을 수 있게 현재 목표, 완료 사항, 위험, 외부 의존성을 한 문서에 모았다.
- `docs/ai/REPORT_DECISIONS.md`
  - 이유: source 선택, no-send 우선, Hermes 사용, 쿠팡/스마트스토어/바이오컴 세트 분배 기준 같은 중요한 결정을 다시 설명하지 않도록 남겼다.

### 최근 리포트 프로젝트 핵심 파일

- `report/!report.md`
  - 이유: 바이오컴·더클린커피 매출액/광고비 비중 리포트의 공통 정본이다.
- `report/reportcoffee.md`
  - 이유: 더클린커피 자사몰, 스마트스토어, 쿠팡, 광고비 source와 실행 계획을 관리한다.
- `report/reportbiocom.md`
  - 이유: 바이오컴 source map과 더클린커피 구조를 바이오컴에 옮기는 계획을 관리한다.
- `report/reportcoffee-project-executive-report-20260522.html`
  - 이유: 대표/운영자가 프로젝트 전체 상태를 직관적으로 보는 프론트엔드 보고서다.
- `report/reportcoffee-sales-dashboard-20260525.html`
  - 이유: 더클린커피 기간별 매출, 광고비, 채널별/제품별 매출을 보는 정적 HTML 대시보드다.
- `report/reportcoffee-sales-summary-no-send-20260524.json`
  - 이유: Slack 실제 발송 전 더클린커피 매출·광고비 통합 집계 결과를 담는 no-send JSON이다.
- `report/reportcoffee-sales-summary-no-send-20260524.md`
  - 이유: 위 JSON의 사람이 읽는 설명 문서다.
- `report/reportcoffee-coupang-seller-insights-api-readiness-20260528.md`
  - 이유: 쿠팡 판매 분석 화면 기준과 Open API 재현값 차이를 기록했다.
- `report/reportcoffee-smartstore-playauto-warning-and-naver-commerce-api-review-20260526.md`
  - 이유: 스마트스토어를 PlayAuto warning 포함으로 운영하고, 네이버 커머스API 권한 전환 전까지 primary 승격을 보류한 근거다.
- `report/hermes-naver-ads-ceo-board-pipeline-design-20260527.md`
  - 이유: Hermes, GitHub, Codex, Sentia Slack으로 이어지는 네이버 광고비 수집·보고 파이프라인 설계다.
- `slack/!slackmsg.md`
  - 이유: Sentia Slack 예약 메시지 전송 runbook이다.
- `report/reportbiocom-selfmall-product-quantity-set-split-20260529.html`
  - 이유: 바이오컴 2026년 4월 상품 수량, 상품별 매출, 세트 분배, AI 자동 분류 UI를 담은 보고서다.

## 통과한 테스트와 실행 명령어

### 바이오컴 세트 분배 HTML 검증

```bash
node - <<'NODE'
const fs=require('fs');
const html=fs.readFileSync('report/reportbiocom-selfmall-product-quantity-set-split-20260529.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for (const script of scripts) new Function(script);
const json=html.match(/<script type="application\/json" id="report-evidence">([\s\S]*?)<\/script>/)?.[1];
JSON.parse(json);
console.log(JSON.stringify({ok:true, ordinary_scripts:scripts.length, evidence_json:true}));
NODE
```

결과: PASS.

```bash
python3 scripts/validate_wiki_links.py report/reportbiocom-selfmall-product-quantity-set-split-20260529.html
```

결과: PASS.

```bash
python3 scripts/harness-preflight-check.py --strict
```

결과: PASS.

```bash
git diff --check -- report/reportbiocom-selfmall-product-quantity-set-split-20260529.html
```

결과: PASS.

```bash
node - <<'NODE'
const fs=require('fs');
const html=fs.readFileSync('report/reportbiocom-selfmall-product-quantity-set-split-20260529.html','utf8');
const checks={
  email:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(html),
  phone:/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/.test(html),
  rawClickId:/(gclid|gbraid|wbraid|ttclid|fbclid)[=:][A-Za-z0-9_-]{10,}/i.test(html),
  longOrderLike:/\b\d{12,}\b/.test(html),
  tilde:new RegExp(String.fromCharCode(126)).test(html)
};
console.log(JSON.stringify({ok:Object.values(checks).every(v=>!v), checks}, null, 2));
NODE
```

결과: PASS. raw 식별자 패턴 0건.

### 브라우저 검증

확인 URL:

```text
http://localhost:8787/reportbiocom-selfmall-product-quantity-set-split-20260529.html
```

브라우저 확인 결과:

```json
{
  "rows": 57,
  "cards": 57,
  "autoYes": 46,
  "autoNo": 9,
  "review": 2,
  "hasConfidence": true,
  "hasAutoRules": true,
  "hasNoRaw": true
}
```

## 아직 남은 작업

1. 더클린커피 Slack no-send JSON 최신화
   - 2026년 최신 주간/월간 window로 `reportcoffee-sales-summary-no-send`를 재생성해야 한다.
   - 쿠팡 판매 분석 source와 Hermes 네이버 광고비 결과를 같은 window로 붙여야 한다.

2. 쿠팡 판매 분석 기준 확정
   - F&B팀 화면 기준과 Open API `ordersheets`, `revenue-history`, `settlement-histories`가 완전히 일치하지 않는다.
   - 공식 API로 판매 분석 화면 요약을 직접 못 받는다면 Hermes 브라우저 다운로드를 primary source로 올릴지 결정해야 한다.

3. 스마트스토어 네이버 커머스API 권한 확인
   - 더클린커피 통합매니저 권한을 네이버로부터 받아야 한다.
   - 권한 확보 전에는 PlayAuto source warning을 유지한다.

4. 바이오컴 펫 영양중금속 세트 2건 확인
   - 세트 후보 57개 중 2개만 사람 검토다.
   - `한마리`, `두마리`가 실제 검사권 1개/2개인지 상품 운영 기준 확인이 필요하다.

5. 바이오컴 세트 분배 dry-run
   - 자동 승인 46개와 확인 완료 세트를 기준으로 원수량과 분배수량을 나란히 계산해야 한다.
   - v0는 수량만 분배하고 매출은 원상품에 남긴다.

6. 실제 Slack 발송 연결
   - no-send preview가 확정되면 Sentia Slack 봇으로 예약/발송 승인안을 만든다.
   - 승인 전 실제 Slack send/schedule은 금지다.

## 다음 Claude Code가 바로 실행해야 할 첫 번째 작업

첫 작업은 더클린커피 최신 Slack no-send 집계를 다시 만드는 것이다.

실행 목표:

- 최신 주간 window와 월간 window를 KST 기준으로 정한다.
- 자사몰 Imweb complete_time 기준 매출, 스마트스토어 PlayAuto 매출, 쿠팡 revenue-history 또는 판매 분석 Hermes source를 합친다.
- 네이버 광고비는 Hermes GitHub 결과와 브랜드검색 수동 배분 비용을 분리해서 붙인다.
- 결과는 JSON과 Markdown으로만 만든다.
- Slack 실제 발송은 하지 않는다.

권장 시작 파일:

```text
report/reportcoffee.md
report/reportcoffee-sales-summary-no-send-20260524.json
report/hermes-naver-ads-ceo-board-pipeline-design-20260527.md
report/reportcoffee-coupang-seller-insights-api-readiness-20260528.md
slack/!slackmsg.md
```

성공 기준:

- 더클린커피 주간/월간 매출, 광고비, 광고비 비중이 하나의 no-send JSON에 들어간다.
- source별 상태가 `included`, `included_with_warning`, `pending`, `manual_input`, `browser_export`처럼 분리된다.
- raw 식별자와 token 출력 0건.
- Slack send/schedule 0건.

## 주의해야 할 보안/권한/운영 리스크

1. Slack 발송 리스크
   - Sentia Slack 봇으로 실제 메시지를 보내거나 예약하는 것은 외부 커뮤니케이션이다.
   - 사용자 승인 전 금지다.

2. 운영DB write 리스크
   - 운영DB는 개발팀 관리 PostgreSQL dashboard DB다.
   - 이 프로젝트에서는 read-only 집계만 허용한다.

3. VM Cloud write/deploy/restart 리스크
   - VM Cloud는 TJ님이 관리하는 보조 원장/수집 환경이다.
   - deploy, restart, cron, DB write는 별도 승인 전 금지다.

4. 광고 플랫폼 조작 리스크
   - Google Ads, Naver Ads, Meta, TikTok, Coupang 광고 설정 변경은 금지다.
   - Hermes도 read-only/download-only만 허용한다.

5. raw 식별자 출력 리스크
   - raw 주문번호, 결제번호, 전화번호, 이메일, 회원코드, click id, token은 문서/로그/채팅에 출력하지 않는다.
   - 재구매율/LTV 계산에는 내부 계산용 원본 식별자를 쓸 수 있지만, 출력은 집계값 또는 해시 전환 계획 이후로 제한한다.

6. source 혼동 리스크
   - 자사몰, 스마트스토어, 쿠팡은 같은 매출 테이블이 아니다.
   - 광고 플랫폼 전환매출과 내부 결제완료 매출을 섞지 않는다.

## Slack, GitHub, VM, 환경변수 등 외부 의존성

### Slack / Sentia

- VM: `taejun@34.64.104.94`
- env 파일: `/etc/ceoboard/backend.env`
- env key: `SLACK_BOT_TOKEN`
- runbook: `slack/!slackmsg.md`
- 실제 send/schedule: 승인 필요.

### GitHub / Hermes

- repo: `taejunjeon/hermes-codex-repo`
- visibility: private.
- 목적: Hermes가 네이버 광고주센터에서 다운로드한 XLSX, result JSON, screenshot을 남기는 장부.
- Codex/Claude Code는 이 repo의 결과 파일을 pull해서 local report에 반영한다.
- Hermes 실행은 현재 TJ님이 Telegram 등으로 수동 호출하는 방식이 권장된다.
- 1분 polling runner는 아직 보류다.

### VM Cloud / public APIs

- 대표 도메인: `att.ainativeos.net`
- 용도: 더클린커피/바이오컴 보조 원장, 일부 dashboard/public API, source freshness cross-check.
- 주의: VM Cloud는 운영DB가 아니다. 운영DB와 명확히 구분한다.

### 운영DB

- 대표 테이블: `dashboard.public.tb_iamweb_users`, `tb_playauto_orders`, 쿠팡/정산 관련 테이블.
- 접근은 read-only 집계로만 한다.
- raw customer columns는 출력 금지다.

### 로컬 DB/cache

- 대표 로컬 DB: `backend/data/crm.sqlite3`
- 쿠팡 2026-05 정산 cache는 승인 후 로컬에 적재된 이력이 있다.
- local write도 백업, dry-run, 승인, 검증 순서가 필요하다.

### 환경변수

- backend env: `backend/.env`
- Slack env: CEO Board VM `/etc/ceoboard/backend.env`
- Naver Ads, Naver Commerce, Coupang, Google, Meta credential 원문은 절대 출력하지 않는다.
- env 존재 여부와 key name만 보고한다.

## git status 요약

2026-05-30 11:46 KST 확인 시점:

- `docs/ai/` 디렉터리는 현재 untracked 상태다.
- 기존 `docs/ai/HANDOFF.md`, `docs/ai/DECISIONS.md`도 untracked로 존재한다.
- 이번 문서는 같은 디렉터리에 `REPORT_HANDOFF.md`, `REPORT_DECISIONS.md`를 추가한다.
- repo 전체에는 이전 작업의 unrelated dirty가 매우 많다. 다음 Claude Code는 파일 단위로 확인하고 절대 광범위 reset/add를 하지 않는다.

## Track 진척률

매출·광고비 리포트 프로젝트 기준:

- Track A 매출 원장 기준: 89% -> 89% (+0%)
- Track B 채널별 매출 수집: 100% -> 100% (+0%)
- Track C 광고비/ROAS 연결: 100% -> 100% (+0%)
- Track D 프론트엔드 의사결정 리포트: 86% -> 86% (+0%)
- Track E Slack/no-send 자동화: 100% -> 100% (+0%)
- Track F QA/Guard/문서화: 100% -> 100% (+0%)
