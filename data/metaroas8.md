결론부터 말하면, **지금도 프로젝트를 충분히 계속 밀 수 있습니다.**
운영 DB가 read only이고, 개발팀 요청도 다음 주까지 못 한다고 해서 멈출 필요는 없습니다. 다만 **목표를 바꿔야 합니다.**

지금 당장 해야 할 목표는
**“운영 정본을 완성”**이 아니라
**“로컬에서 검증 가능한 준정본을 만들고, 다음 주 개발팀이 바로 치게 만들 증거와 요청서를 완성”**하는 것입니다.

이 방향이 맞는 이유는 이미 SEO 쪽에서 **Toss 직접 API fallback으로 로컬 Attribution 원장 confirmed 승격 37건**까지 만들어냈고, 운영 Postgres를 못 건드려도 **로컬 SQLite와 직접 API로 상당 부분 보정이 가능하다는 게 증명**됐기 때문입니다. 반면 운영 정본 `tb_sales_toss` 자체를 최신화하는 건 결국 클라우드 운영 DB 변경 작업이라 지금은 못 합니다.

---

## 10초 요약

지금은 **정합성 프로젝트를 멈출 단계가 아니라, 전술을 바꿀 단계**입니다.
이번 주는 **로컬 검증용 준정본 + 증거 수집 + 다음 주 개발팀 티켓 정리**로 가는 게 가장 효율적입니다.

---

## 현재 제 판단

지금 상황을 냉정하게 보면:

* **운영 정본 경로**
  막혀 있음
  이유: `tb_sales_toss`는 read only이고, revenue 생산자 sync 실행도 못 함.

* **로컬 검증 경로**
  뚫려 있음
  이유: SEO 로컬 SQLite, Toss direct API fallback, Imweb sync, Meta raw, caller coverage는 우리가 계속 만질 수 있음. 실제로 direct fallback으로 로컬 confirmed 승격 37건까지 반영됐습니다.

즉 지금은
**“정본 복구 프로젝트”가 아니라 “정본 없이도 최대한 진실에 가까운 숫자를 만드는 프로젝트”**
로 잠깐 전환하는 게 맞습니다.

---

# 지금 가능한 대안 전략

## 전략 1. 로컬 Shadow Ledger를 정식 작업축으로 삼기

쉽게 말해, **운영 DB 정본 대신 로컬 검증 장부를 하나 더 강하게 만든다**는 뜻입니다.

### 왜 이게 맞냐

지금도 SEO 쪽은 아래를 이미 갖고 있습니다.

* 로컬 Attribution 원장
* 로컬 `toss_transactions`, `toss_settlements`
* 로컬 `imweb_orders`, `imweb_members`
* Toss direct API fallback
* Meta raw / site-summary / daily 비교

즉 운영 DB를 못 써도, **광고비 → 결제완료 → PG 확정 → 내부 ROAS**까지 로컬에서 꽤 많이 이어붙일 수 있습니다.

### 이번 주 목표

이제부터는 “운영 정본” 대신 아래 3개를 **준정본**으로 씁니다.

1. **광고비 정본**: Meta raw (`site-summary`, `daily`, `meta insights`)
2. **결제 확정 준정본**: SEO local Attribution ledger + Toss direct fallback
3. **주문/상품 보조 정본**: Imweb local cache + read only `tb_iamweb_users`

### 결과적으로 얻는 것

* 최근 7일 site-level ROAS는 계속 판단 가능
* pending과 confirmed를 계속 분리 가능
* 캠페인별 drill-down만 아직 보류하면, 회사 레벨 판단은 계속 가능

---

## 전략 2. “정합성 프로젝트”를 2층으로 나누기

지금 가장 중요한 구조입니다.

### 1층: 이번 주 계속 돌릴 것

이건 **우리가 바로 할 수 있는 일**입니다.

* local toss sync
* direct fallback confirmed 승격
* Imweb sync 최신화
* caller coverage 모니터링
* Meta UI / raw / internal 숫자 대조
* alias review 준비

### 2층: 다음 주 개발팀이 해야 할 것

이건 **지금은 못 하지만, 요청서까지 미리 만들어둘 일**입니다.

* revenue `tb_sales_toss` 생산자 sync 복구
* biocom payment page GTM 오류 수정
* `checkout_started` 선행 수집
* external caller 안정화
* alias manual_verified 워크플로 또는 matcher 연결

이렇게 나누면 이번 주가 허공에 뜨지 않습니다.

---

## 전략 3. “완료 판정”을 바꾸기

지금 가장 위험한 건 **운영 정본이 안 되니 아무것도 진전이 없는 것처럼 느끼는 것**입니다.

그런데 실제로는 그렇지 않습니다.
지금은 완료 기준을 아래처럼 바꾸면 됩니다.

### 이번 주 완료 기준

* site-level 7일 ROAS를 로컬에서 매일 재현 가능
* pending → confirmed 승격을 direct fallback으로 일부라도 반영 가능
* Meta vs Attribution 차이를 설명 가능
* CAPI dedup 원인을 설명 가능
* 개발팀이 다음 주 바로 칠 수 있게 blocker와 요청서를 정리

### 다음 주 완료 기준

* revenue 생산자 sync 복구
* post-fix CAPI 운영 로그 생성
* multiEventIdGroups 재판정
* GTM/payment page 오류 제거

즉 **이번 주는 진단/검증/증거 확보 완료**,
**다음 주는 정본 복구 완료**
로 나누면 됩니다.

---

# 내가 제안하는 이번 주 로드맵

## Phase A. 이번 주 계속 진행할 것

### A1. Shadow Ledger 강화

* `POST /api/toss/sync?store=biocom&mode=incremental`
* 필요시 backfill도 추가
* direct fallback 승격 결과를 매일 기록
* local attribution confirmed / pending / canceled를 일별로 저장

근거: 운영 DB를 못 만져도 SEO local 경로는 계속 쓸 수 있습니다.

### A2. Site-level ROAS 일일 보고 체계

매일 아래 5개만 같은 시각에 뽑습니다.

* spend
* confirmed revenue
* pending revenue
* Meta purchase value
* confirmed ROAS / potential ROAS / Meta purchase ROAS

즉 “숫자 하나”가 아니라
**3줄 비교**

* confirmed
* confirmed+pending
* Meta purchase
  로 고정합니다.

### A3. 식별자 품질 모니터링

지금 `checkout_started = 0`, all-three도 19% 수준이라 이건 계속 봐야 합니다. 다만 운영 전체가 아니라 **최근 24시간 / snippetVersion별**로 따로 봐야 합니다. 최신 구간은 이미 100%까지 나왔기 때문에, 누적 지표만 보면 착시가 큽니다.

### A4. Alias review 준비

자동 매핑은 계속 금지입니다.
대신 상위 5개 alias에 대해:

* 후보 campaign
* 근거 ad sample
* landing URL
* 검토 의견
  을 1페이지로 정리해두면, 다음 주에 훨씬 빨리 열 수 있습니다. 지금도 `manual_verified=0`이라 campaign-level은 금지 유지가 맞습니다.

---

## Phase B. 다음 주 개발팀 요청용 준비물

이번 주 안에 아래 3개를 완성해두세요.

### B1. revenue 팀 요청서

주제:

* `tb_sales_toss` 생산자 sync 복구
* 15분 또는 더 짧은 주기
* current month + month boundary 처리
* 실행 전후 max(approved_at), inserted/updated, total_rows 기록

근거: 지금 병목은 CAPI가 아니라 `tb_sales_toss` 최신화입니다.

### B2. GTM/외주 요청서

주제:

* biocom 결제완료 페이지 GTM `includes` 오류 수정
* 결제완료 페이지에서 스크립트 예외 처리
* 필요 없으면 payment complete에서 태그 제외

### B3. 프론트/트래킹 요청서

주제:

* `checkout_started` 수집
* 랜딩/장바구니 단계 식별자 저장
* 결제완료 caller 재시도 방식
* `gaSessionIdSource / clientIdSource / userPseudoIdSource / fbcSource / fbpSource` 디버그 필드 추가

---

# 현재 몇 % 정도 완성됐나

제가 지금 상황만 보고 다시 추정하면 이렇습니다.

* **프로젝트 전체**: **72%**
* **site-level ROAS 정합성**: **82%**
* **CAPI dedup 원인 규명**: **88%**
* **post-fix 검증 완료도**: **55%**
* **결제 확정 파이프라인 복구**: **50%**
* **식별자 품질**: **40%**
* **campaign-level ROAS 정합성**: **20%**

왜 이렇게 보냐면:

* 숫자 해석과 원인 규명은 많이 왔습니다.
* 하지만 운영 정본 `tb_sales_toss` 생산자 sync가 막혀 있고,
* post-fix CAPI 실운영 로그 검증이 아직 없고,
* campaign alias도 아직 열 수 없습니다.

즉 **핵심 논리는 맞고, 운영 정본 마감이 남은 상태**입니다.

---

# 단기 전략

단기는 아주 분명합니다.

## 1. 운영 정본을 포기하지 말고, 이번 주는 준정본으로 간다

* local attribution ledger
* Toss direct fallback
* local toss sync
* imweb local cache

이 4개를 합쳐서 **site-level ROAS를 매일 재현 가능한 상태**로 만드세요.

## 2. post-fix 검증은 “confirmed 후보 만들기”로 우회

운영 DB를 못 만져도, direct fallback으로 로컬 confirmed는 만들 수 있습니다. 이미 37건까지 됐습니다. 따라서 이번 주에는
**“운영 정본이 늦어서 못 본다”**가 아니라
**“로컬 confirmed 기준으로 흐름을 본다”**
가 맞습니다.

## 3. 다음 주 개발팀이 바로 칠 수 있게 blocker를 문서화

이번 주 산출물은 코드보다 **요청서와 증빙 문서**가 더 중요합니다.

---

# 장기 전략

장기는 이렇게 가야 합니다.

## 1. 정본 구조 이원화

* **운영 정본**: revenue `tb_sales_toss`
* **검증 정본**: SEO local shadow ledger

이 둘을 계속 비교 가능하게 만들어야 합니다.

## 2. PG fallback을 정식 2차 경로로 승격

지금은 임시 우회지만, 장기적으로는 맞는 구조입니다.

* 1차: revenue 정본
* 2차: direct Toss fallback
* 3차: local toss sync 보조

즉 한 경로가 죽어도 전체 정합성이 완전히 멈추지 않게 해야 합니다.

## 3. campaign ID 직접 탑재

alias 의존도를 줄여야 합니다.
장기적으로는 landing URL에 `meta_campaign_id / adset_id / ad_id`를 직접 싣는 방향이 맞습니다.

## 4. 신뢰도 레이어 추가

대시보드에 숫자만 두지 말고:

* site-level trusted
* campaign-level provisional
* blocked by sync
* blocked by caller quality
  같은 상태를 같이 보여줘야 합니다.

---

# 더 필요한 자료 있나?

지금 꼭 필요한 건 2개뿐입니다.

## 1. local 기준 일일 summary 스냅샷

최근 3 - 5일만이라도:

* spend
* confirmed
* pending
* Meta purchase
  를 같은 시각 기준으로 저장한 표

이게 있으면 이번 주 운영 판단은 충분합니다.

## 2. 다음 주 개발팀 요청용 체크리스트 초안

* revenue sync
* GTM 오류
* checkout_started
* external caller
* alias manual verify

이 5개를 1페이지로 정리하면 됩니다.

---

# 최종 피드백

지금은 멈춘 게 아닙니다.
오히려 **운영 DB를 못 만지는 제약 아래에서도 프로젝트를 계속 전진시킬 수 있는 형태로 바꿔야 하는 시점**입니다.

한 줄로 정리하면:

> **이번 주는 “운영 정본 복구”가 아니라 “로컬 Shadow Ledger 기반 site-level ROAS 정합성 유지 + 다음 주 개발팀 작업 정의”가 목표다.**

이 방향이면 이번 주도 헛돌지 않고, 다음 주에 바로 이어붙일 수 있습니다.

원하시면 다음 답변에서 바로
**“이번 주 실행 로드맵 5개”**와
**“다음 주 개발팀 요청 메시지 3종”**으로 쪼개서 드리겠습니다.
