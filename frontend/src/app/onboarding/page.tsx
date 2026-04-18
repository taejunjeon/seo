import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "../coupon/page.module.css";

const projectCards = [
  {
    label: "AIBIO",
    value: "BigQuery 링크 완료",
    sub: "새 GCP 프로젝트에 Daily export 연결 완료",
  },
  {
    label: "더클린커피",
    value: "BigQuery 링크 완료",
    sub: "새 GCP 프로젝트에 Daily export 연결 완료",
  },
  {
    label: "biocom.kr",
    value: "기존 링크 유지 판단 필요",
    sub: "hurdlers-naver-pay에 기존 raw export 연결 존재",
  },
  {
    label: "기본 원칙",
    value: "Daily만 ON",
    sub: "Streaming / 사용자 데이터 export는 현재 OFF 유지",
  },
];

const developerChecks = [
  {
    title: "biocom 기존 export 소유권 확인",
    body: "hurdlers-naver-pay 프로젝트의 analytics_<biocom property id> dataset 존재 여부와 최근 events_YYYYMMDD 적재 상태를 확인해야 함.",
  },
  {
    title: "biocom 조회 권한 요청",
    body: "biocomkr.sns@gmail.com 또는 운영용 계정에 BigQuery Data Viewer + BigQuery Job User 수준의 조회 권한 부여 필요.",
  },
  {
    title: "정식 조회용 서비스 계정 분리",
    body: "나중에 backend가 BigQuery를 직접 읽게 되면 read-only 서비스 계정을 따로 만들고, raw dataset과 mart dataset 권한을 분리해야 함.",
  },
  {
    title: "데이터 공통키 유지",
    body: "payment_success / attribution 체인에서 orderId, paymentKey, user_pseudo_id, ga_session_id를 계속 남겨야 GA4·Toss·ledger 조인이 쉬워짐.",
  },
  {
    title: "운영 대사 루틴 고정",
    body: "GET /api/attribution/ledger, POST /api/attribution/sync-status/toss?dryRun=true, GET /api/attribution/toss-join, GET /api/crm-phase1/ops를 같은 날짜 범위로 매일 비교.",
  },
  {
    title: "caller coverage API 확인",
    body: "GET /api/attribution/caller-coverage 로 live checkout_started / payment_success의 ga_session_id, client_id, user_pseudo_id 누락률을 바로 확인할 수 있다. baseline은 live payment_success 452건에서 3종 coverage 0%였고, 2026-04-08 latest 기준 all-source live payment_success 560건 중 all-three 8건(1.43%), biocom 491건 중 7건, 더클린커피 62건 중 1건까지 올라왔다.",
  },
  {
    title: "추후 기록",
    body: "추가 개발 요청 사항은 여기 계속 누적. 현재는 biocom BigQuery 접근권과 canonical 프로젝트 결정이 최우선.",
  },
];

const marketingChecks = [
  {
    title: "GA4 property 소유자/편집자 정리",
    body: "biocom, AIBIO, 더클린커피 3개 property의 Editor 이상 계정을 명확히 정리하고, 누가 BigQuery 링크를 관리하는지 문서화해야 함.",
  },
  {
    title: "BigQuery 링크 운영 원칙 공유",
    body: "raw export는 GA4 Admin에서만 연결 가능하고, 프로젝트를 바꾸면 과거 데이터가 자동 이관되지 않는다는 점을 팀에 공유해야 함.",
  },
  {
    title: "UTM 네이밍 규칙 고정",
    body: "source / medium / campaign 표기 규칙을 정리해 GA4·Meta·CRM 문서에서 같은 이름을 쓰도록 맞춰야 함.",
  },
  {
    title: "biocom 기존 링크 담당자 확인",
    body: "기존 링크 생성 주체가 team@hurdlers.kr로 보이므로, 허들러스에 현재 export 유지 여부와 접근 권한 제공 가능 여부를 확인해야 함.",
  },
  {
    title: "Streaming 필요 여부는 추후 판단",
    body: "현재는 Daily export만으로 충분. 실시간 운영 리포트 요구가 생길 때만 Streaming을 켤지 판단.",
  },
  {
    title: "추후 기록",
    body: "마케팅팀 추가 확인 항목은 여기 누적. 현재는 property 권한/링크 주체/UTM 규칙 정리가 우선.",
  },
];

const financeChecks = [
  {
    title: "나이스페이 내용 확인",
    body: "토스페이먼츠 외에 나이스페이도 실제 매출 집계 스크립트와 회계 집계에 등장한다. 회계팀에 '어디서, 어떤 주문/채널/기간에, 어떤 목적(주결제/보조결제/레거시 이관 등)으로 쓰는지' 확인이 필요하다.",
  },
  {
    title: "추후 기록",
    body: "회계/운영 추가 확인 항목은 여기 누적. 현재는 나이스페이 사용 범위와 biocom BigQuery 기존 프로젝트 소유권 확인이 우선.",
  },
];

const p0WhyChecks = [
  {
    title: "공통 표준 키를 먼저 고정해야 하는 이유",
    body: "order_id_base, payment_key, normalized_phone가 고정돼야 GA4, Toss, Imweb, PlayAuto가 같은 주문과 같은 고객을 동일 대상으로 본다. 운영 DB를 나중에 손보더라도 이 기준이 먼저 없으면 같은 구매가 시스템마다 다른 건처럼 남는다.",
  },
  {
    title: "status-aware ledger가 필요한 이유",
    body: "payment_success는 관측 이벤트일 뿐 확정 매출이 아니다. pending, confirmed, canceled를 구분하지 않으면 광고 성과와 CRM 매출이 과대평가된다. 운영 판단은 confirmed_revenue 기준으로 닫아야 한다.",
  },
  {
    title: "GA4 식별자를 결제 체인에 남겨야 하는 이유",
    body: "ga_session_id, client_id, user_pseudo_id가 결제 payload에 남아야 '(not set)인데 실제 결제된 사람'을 역추적할 수 있다. 그래야 세션, 광고 클릭, 체크아웃, 결제가 한 줄로 이어진다.",
  },
  {
    title: "biocom Imweb local cache가 필요한 이유",
    body: "커피는 Imweb와 Toss를 직접 대조할 수 있는데 biocom은 아직 약하다. biocom 주문도 local cache에 있어야 'Toss에는 있는데 Imweb에는 없는 주문'과 반대 경우를 같은 방식으로 검증할 수 있다.",
  },
  {
    title: "settlement backfill이 필요한 이유",
    body: "승인 금액만 보면 얼마 팔았는지는 보여도 얼마 남았는지는 안 보인다. 수수료 포함 순매출이 닫혀야 광고비 판단, CRM 실험 가치, 상품성 비교를 실제 돈 기준으로 읽을 수 있다.",
  },
];

const p0ImplementationNotes = [
  {
    title: "ledger metadata에 표준 키 저장 시작",
    body: "backend attribution 수집부가 이제 orderIdBase, normalizedPhone, clientId, userPseudoId를 같이 남긴다. 운영 DB에 나중에 실제 컬럼으로 승격하더라도 이름과 의미는 이 기준을 그대로 따라가면 된다.",
  },
  {
    title: "customerKey fallback 규칙",
    body: "customerKey가 비어 있어도 전화번호가 있으면 normalizedPhone을 fallback으로 쓴다. 즉 운영 DB를 손볼 때도 '고객 spine 1차 키는 정규화 전화번호'라는 기준을 공유해야 한다.",
  },
  {
    title: "biocom Imweb ↔ Toss 대사 엔드포인트 추가",
    body: "GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=20 으로 biocom 주문도 local 대사가 가능해졌다. 2026-04-08 실행 기준 latest local imweb_orders 5,750건, 총 coverage 74.02%, age bucket은 0-1일 45.77% / 2-7일 65.74% / 8-30일 76.67% / 31일 이상 76.71%다. 즉 최근 주문 지연과 오래된 누락을 분리해서 읽어야 한다.",
  },
  {
    title: "settlement sync 페이지네이션 보강",
    body: "/api/toss/sync와 /api/toss/daily-summary가 settlement 첫 페이지 100건이 아니라 전체 페이지를 읽도록 바뀌었다. 이제 /api/toss/sync 응답에는 syncRun.runId, startedAt, finishedAt, pagesRead, rowsAdded, done completion signal도 들어간다. 운영 DB/리포트에서도 승인 금액만이 아니라 수수료 포함 순매출 기준을 같은 용어로 써야 한다.",
  },
  {
    title: "3사이트 caller 운영 상태",
    body: "biocom은 payment_success fetch-fix, 더클린커피는 payment_success fetch-fix v2, AIBIO는 form_submit v5가 live 검증까지 끝났다. 지금 남은 핵심은 biocom payment_complete GTM 오류와 GA4 (not set) historical row 진단 루틴 고정이다.",
  },
  {
    title: "즉시 실행 결과 기록 위치",
    body: "이번 주 우선 실행 1) caller coverage baseline 확인 2) biocom Imweb 주문 sync 3) Toss settlement backfill 실실행은 2026-04-08 기준 모두 수행했다. latest 결과와 미해결 이슈는 datacheck0406.md, gptfeedback_0408_1reply.md, gptfeedback_0408_2reply.md, 운영 로그에 함께 남긴다.",
  },
  {
    title: "최우선 운영 기준: 가상계좌 미입금 주문은 메인 매출에서 반드시 제외",
    body: "현재 구조에서는 Toss 상태 동기화 시 WAITING_FOR_DEPOSIT 같은 가상계좌 미입금 상태를 payment_status=pending으로 분류한다. 따라서 confirmed_revenue, 메인 ROAS, 광고/CAPI 기준값에서는 자동으로 제외할 수 있다. 이건 현재 우리 최우선 사항 중 하나다. 이유는 최종 입금이 안 된 주문을 메인 매출에 섞으면 ROAS와 CRM 성과가 바로 과대평가되기 때문이다. 다만 raw attribution ledger에서는 지우지 말고 pending으로 남겨 두는 편이 맞다. 이후 실제 입금되면 confirmed로 승격할 수 있고, 입금 전 이탈/리마인드 후보 분석에도 쓸 수 있기 때문이다. 한계는 sync-status batch를 돌리기 전까지는 잠정치로 남을 수 있다는 점이다.",
  },
];

const footerTrackingChecks = [
  {
    title: "biocom footer 정본",
    body: "`data/footercode0408.md` 전체를 아임웹 footer custom code에 넣는다. `source=biocom_imweb`, endpoint는 `/api/attribution/payment-success`, 측정 ID는 `G-WJFXN5E2Q1`, `G-8GZ48B1S59`다. 최근 live 기준 `payment_success 491건`, all-three `7건`까지 확인됐다.",
  },
  {
    title: "더클린커피 footer 정본",
    body: "`data/coffeefooter.md` 전체를 사용한다. `source=thecleancoffee_imweb`, GA4 측정 ID는 `G-JLSBXX7300`이고 `snippetVersion=2026-04-08-coffee-fetchfix-v2`다. 실제 가상계좌 주문 `202604080749309`가 `2026-04-08 23:53:44 KST`에 적재됐고 3종 식별자 all-three 첫 row가 확인됐다.",
  },
  {
    title: "AIBIO footer 정본",
    body: "`data/aibiofooter.md` 전체를 사용한다. AIBIO는 쇼핑몰 purchase가 아니라 `form_submit`을 표준 전환으로 본다. `source=aibio_imweb`, endpoint는 `/api/attribution/form-submit`, 측정 ID는 `G-PQWB91F4VQ`, `snippetVersion=2026-04-08-formfetchfix-v5`다.",
  },
  {
    title: "공통 추적 개념",
    body: "footer의 역할은 결제완료/폼제출 시점에 `orderId`, `paymentKey`, `formId`, `ga_session_id`, `client_id`, `user_pseudo_id`, UTM, referrerPayment를 attribution ledger에 남기는 것이다. raw observed event는 그대로 남기고, 확정 매출 판정은 Toss 상태 동기화 후 `payment_status=confirmed` 기준으로 읽는다.",
  },
  {
    title: "가상계좌 상태 해석",
    body: "가상계좌는 결제완료 페이지에 들어온 순간 raw ledger에 먼저 `pending`으로 적재된다. 이후 `POST /api/attribution/sync-status/toss`가 Toss 상태를 대조해 `confirmed` 또는 `canceled`로 승격한다. 즉 '주문은 했지만 입금 안 함'과 '입금 완료'를 같은 원장에서 구분할 수 있다.",
  },
];

const ga4NotSetNotes = [
  {
    title: "실마리는 보이기 시작함",
    body: "recent biocom/더클린커피 payment_success와 AIBIO form_submit live row에 `ga_session_id`, `client_id`, `user_pseudo_id`가 실제로 들어오기 시작했다. 따라서 `(not set)` 문제를 이제 'footer caller가 전혀 식별자를 못 보낸다'로 단정할 단계는 지났다.",
  },
  {
    title: "아직 안 닫힌 구간",
    body: "historical row에는 식별자가 비어 있는 비중이 여전히 크고, biocom payment_complete 페이지에는 `GTM-W7VXS4D8 ... includes` 오류가 남아 있다. 또 biocom BigQuery raw export는 `hurdlers-naver-pay` legacy link 확인이 끝나지 않아 raw event 역추적이 아직 완전하지 않다.",
  },
  {
    title: "다음 진단 계획",
    body: "같은 날짜 범위에서 `BigQuery raw export`, `/api/attribution/hourly-compare`, `/api/attribution/caller-coverage`, `/api/crm-phase1/ops`를 같이 본다. 즉 1) biocom legacy raw export 상태 확인 2) biocom GTM 오류 수정 3) caller coverage 일일 모니터링 4) `(not set)` 구매와 receiver row를 same-day로 대조하는 순서로 간다.",
  },
  {
    title: "운영 판단 기준",
    body: "`GA4 purchases`는 참고지표로 보되, 메인 매출·광고·CAPI 판단은 `payment_status=confirmed`와 `confirmed_revenue` 기준으로 닫는다. `pending`은 가상계좌 대기분일 수 있으므로 메인 ROAS에 넣지 않는다.",
  },
];

const reinventingGtmNotes = [
  {
    title: "지금 확인된 원인",
    body: "public `GTM-W7VXS4D8` 컨테이너를 직접 파싱해 보니, `tag_id 44` `Custom HTML` 안에 `c.includes(\"RETOUS_\")`가 있었다. 여기서 `c`는 `__bs_imweb_session.utmSource` 계열 값인데, 값이 비어 있으면 자바스크립트가 바로 에러를 낸다. 즉 지금 biocom 결제완료 페이지 콘솔에 보이는 `includes` 오류는 추정이 아니라 live 컨테이너 기준으로 좁혀진 상태다.",
  },
  {
    title: "왜 바로 삭제하면 안 되는가",
    body: "`tag_id 44`는 단순 로그 태그가 아니라 `c_retous_crm_open` 이벤트를 만드는 생산자 역할을 한다. 같은 컨테이너 안 `tag_id 52` GA4 이벤트 태그가 이 이벤트를 받아 쓰는 구조라서, 리인벤팅이 아직 이 CRM-open 흐름을 실제로 쓰고 있다면 무턱대고 지우면 그쪽 데이터가 더 끊길 수 있다. 그래서 첫 선택지는 `null-safe patch`, 두 번째 선택지가 payment page 예외 처리, 마지막이 완전 제거다.",
  },
  {
    title: "리인벤팅과 확인할 것",
    body: "회의 때는 1) `c_retous_crm_open`과 `retous_crm_open_new`를 아직 실제 운영에서 쓰는지 2) 결제완료 페이지에서 그 이벤트가 어디로 전송되는지 3) 최근 7일 수신 로그를 보여줄 수 있는지 4) payment page에서 콘솔 오류 없이 정상 fired tag 증거를 줄 수 있는지를 확인하면 된다. 증거가 아니라 설명만 있으면 현재 데이터는 신뢰하지 않는 편이 맞다.",
  },
  {
    title: "삭제 또는 협업 중단 검토 기준",
    body: "리인벤팅이 이 태그를 더 이상 안 쓰거나, 아직 쓴다고 해도 최근 수신 로그와 fired tag 증거를 못 주면 `GTM-W7VXS4D8`를 biocom payment page에서 우선 제외하고, 필요하면 사이트 전체 제거와 협업 중단까지 검토한다. 반대로 계속 써야 한다면 그쪽이 `c || \"\"` 같은 null-safe patch를 적용해 오류부터 없애야 한다.",
  },
  {
    title: "수정 후 우리가 다시 볼 것",
    body: "변경 뒤 확인 기준은 간단하다. 1) `shop_payment_complete`에서 `GTM-W7VXS4D8 ... includes` 오류가 사라졌는지 2) 정본인 `GTM-W2Z6PHN` purchase와 우리 attribution footer는 그대로 살아 있는지 3) 리인벤팅이 주장하는 CRM 수신 로그가 실제로 남는지 4) `GA4 (not set)` 해석에 방해되는 payment page 잡음이 줄었는지까지 같이 본다.",
  },
];

export default function OnboardingPage() {
  return (
    <div className={styles.page}>
      <GlobalNav activeSlug="ai-crm" />
      <header className={styles.header} style={{ position: "static" }}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/#ai-crm" className={styles.backLink}>← AI CRM으로 돌아가기</Link>
            <h1 className={styles.headerTitle}>온보딩 체크사항</h1>
            <p className={styles.headerSub}>BigQuery · GA4 · 개발팀/마케팅팀 확인 항목 · 2026-04-08 메모</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div style={{
          padding: "24px 28px",
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(59,130,246,0.05))",
          border: "2px solid rgba(13,148,136,0.12)",
        }}>
          <div style={{ fontSize: "1.08rem", fontWeight: 700, marginBottom: 8 }}>
            현재 결론: AIBIO와 더클린커피는 새 프로젝트로 진행, biocom은 기존 hurdlers export 상태부터 확인
          </div>
          <div style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)", lineHeight: 1.75 }}>
            GA4 raw export는 GCP 콘솔이 아니라 <strong>GA4 Admin &gt; BigQuery 링크</strong>에서 관리한다.
            새 프로젝트는 현재 임시로 <strong>My First Project (`project-dadba7dd-0229-4ff6-81c`)</strong>에 연결되었고,
            biocom은 이미 <strong>hurdlers-naver-pay</strong>에 raw export 링크가 존재해 추가 링크 생성이 막혀 있다.
          </div>
        </div>

        <div className={styles.kpiGrid}>
          {projectCards.map((card) => (
            <div key={card.label} className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{card.label}</span>
              <strong className={styles.kpiValue}>{card.value}</strong>
              <span className={styles.kpiSub}>{card.sub}</span>
            </div>
          ))}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>현재 확정 메모</h2>
          <p className={styles.sectionDesc}>오늘 확정된 내용만 짧게 모아 둠. 새 팀원이 들어오면 이 섹션부터 읽으면 됨.</p>
          <div className={styles.compGrid}>
            <div className={styles.compCard} style={{ borderTopColor: "var(--color-primary)" }}>
              <strong>새 프로젝트 상태</strong>
              <div className={styles.compRow}><span>프로젝트명</span><span>My First Project</span></div>
              <div className={styles.compRow}><span>프로젝트 ID</span><span>project-dadba7dd-0229-4ff6-81c</span></div>
              <div className={styles.compRow}><span>리전</span><span>asia-northeast3 (Seoul)</span></div>
              <div className={styles.compRow}><span>export 방식</span><span>Daily only</span></div>
            </div>
            <div className={styles.compCard} style={{ borderTopColor: "var(--color-accent)" }}>
              <strong>biocom 기존 링크 상태</strong>
              <div className={styles.compRow}><span>기존 프로젝트</span><span>hurdlers-naver-pay</span></div>
              <div className={styles.compRow}><span>생성 주체</span><span>team@hurdlers.kr</span></div>
              <div className={styles.compRow}><span>데이터 위치</span><span>서울 (asia-northeast3)</span></div>
              <div className={styles.compRow}><span>현재 판단</span><span>삭제 전 상태 확인 필수</span></div>
            </div>
          </div>
          <div className={styles.interpretBlock}>
            <strong>주의</strong>: biocom raw export 링크를 새 프로젝트로 바로 옮기면 과거 raw 데이터가 자동으로 따라오지 않는다.
            기존 hurdlers 프로젝트에 데이터가 살아 있으면, 먼저 접근권 확보 또는 dataset 복제 전략부터 정해야 한다.
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>개발팀 체크사항</h2>
          <p className={styles.sectionDesc}>바로 기억나는 요청을 먼저 적어 둠. 추가 요청은 계속 아래에 누적.</p>
          <div className={styles.strategyGrid}>
            {developerChecks.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index < 2 ? "var(--color-danger)" : "var(--color-primary)" }}>
                <div className={styles.strategyRank} style={{ background: index < 2 ? "var(--color-danger)" : "var(--color-primary)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>마케팅팀 체크사항</h2>
          <p className={styles.sectionDesc}>권한/운영 원칙/태깅 기준을 여기서 관리.</p>
          <div className={styles.strategyGrid}>
            {marketingChecks.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index === 3 ? "var(--color-danger)" : "var(--color-accent)" }}>
                <div className={styles.strategyRank} style={{ background: index === 3 ? "var(--color-danger)" : "var(--color-accent)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>회계 · 운영 체크사항</h2>
          <p className={styles.sectionDesc}>결제 수단, 회계 집계, 레거시 운영 확인 항목.</p>
          <div className={styles.strategyGrid}>
            {financeChecks.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index === 0 ? "var(--color-danger)" : "var(--color-info)" }}>
                <div className={styles.strategyRank} style={{ background: index === 0 ? "var(--color-danger)" : "var(--color-info)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>개발팀 공통 이해사항</h2>
          <p className={styles.sectionDesc}>운영 DB 수정이나 후속 백필 전에 왜 이 작업이 필요한지, 개발팀이 먼저 같은 언어로 이해해야 하는 배경.</p>
          <div className={styles.strategyGrid}>
            {p0WhyChecks.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index < 2 ? "var(--color-danger)" : "var(--color-primary)" }}>
                <div className={styles.strategyRank} style={{ background: index < 2 ? "var(--color-danger)" : "var(--color-primary)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>P0 구현 진행 상태 · 운영 DB 반영 메모</h2>
          <p className={styles.sectionDesc}>문서 설명이 아니라, 지금 코드에 무엇이 반영됐고 운영 DB/외부 스크립트에서 무엇을 맞춰야 하는지 적는 칸.</p>
          <div className={styles.strategyGrid}>
            {p0ImplementationNotes.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index < 2 ? "var(--color-info)" : "var(--color-primary)" }}>
                <div className={styles.strategyRank} style={{ background: index < 2 ? "var(--color-info)" : "var(--color-primary)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>허들러스 문의용 메모</h2>
          <p className={styles.sectionDesc}>내일 바로 전달할 수 있게 문구를 남겨 둠.</p>
          <div className={styles.interpretBlock}>
            <strong>확인 요청</strong>: biocom.kr GA4의 BigQuery raw export가 현재 <strong>hurdlers-naver-pay</strong> 프로젝트에 연결된 것으로 보입니다.
            <br />
            1. <strong>analytics_&lt;biocom property id&gt;</strong> dataset이 실제로 존재하는지
            <br />
            2. 최근 <strong>events_YYYYMMDD</strong> 테이블이 계속 생성되는지
            <br />
            3. <strong>biocomkr.sns@gmail.com</strong> 계정에 조회 권한을 줄 수 있는지
            <br />
            4. 계속 그 프로젝트를 써도 되는지, 아니면 새 프로젝트로 옮기는 게 맞는지
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3사이트 Footer · 추적 온보딩</h2>
          <p className={styles.sectionDesc}>새 팀원이 가장 많이 헷갈리는 부분이다. 각 사이트 footer 정본과 추적 개념을 여기서 먼저 맞춘다.</p>
          <div className={styles.strategyGrid}>
            {footerTrackingChecks.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index < 3 ? "var(--color-primary)" : "var(--color-info)" }}>
                <div className={styles.strategyRank} style={{ background: index < 3 ? "var(--color-primary)" : "var(--color-info)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>GA4 `(not set)` 진단 메모</h2>
          <p className={styles.sectionDesc}>문제가 완전히 풀린 것은 아니지만, 어디까지 실마리가 보였고 다음에 무엇을 해야 하는지는 여기서 바로 이해할 수 있게 남긴다.</p>
          <div className={styles.strategyGrid}>
            {ga4NotSetNotes.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index < 2 ? "var(--color-danger)" : "var(--color-accent)" }}>
                <div className={styles.strategyRank} style={{ background: index < 2 ? "var(--color-danger)" : "var(--color-accent)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>리인벤팅 W7 협의 메모</h2>
          <p className={styles.sectionDesc}>biocom payment page 오류는 외주사 리인벤팅이 임시로 넣은 `GTM-W7VXS4D8`와 연결돼 있다. 내일 회의에서는 아래 순서대로 판단하면 된다.</p>
          <div className={styles.strategyGrid}>
            {reinventingGtmNotes.map((item, index) => (
              <div key={item.title} className={styles.strategyCard} style={{ borderLeftColor: index < 2 ? "var(--color-danger)" : "var(--color-accent)" }}>
                <div className={styles.strategyRank} style={{ background: index < 2 ? "var(--color-danger)" : "var(--color-accent)" }}>{index + 1}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
