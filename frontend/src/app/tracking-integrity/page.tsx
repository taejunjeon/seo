"use client";

import Link from "next/link";
import styles from "./page.module.css";

const phases = [
  {
    name: "Phase 0",
    title: "운영 DB 직접 수정 대신 로컬 준정본 구축",
    progress: 95,
    status: "방향 확정",
    description: "운영 DB를 직접 고치지 않고, SEO 로컬 원장과 API fallback으로 ROAS 판단에 필요한 준정본을 만든다.",
    next: "운영 DB write가 필요한 작업은 계속 보류하고, 로컬 원장 기준 리포트를 유지한다.",
  },
  {
    name: "Phase 1",
    title: "Shadow Ledger 강화",
    progress: 82,
    status: "진행 중",
    description: "결제완료, checkout 시작, UTM, fbclid/fbc/fbp, GA 식별자를 우리 자체 원장에 쌓는다.",
    next: "가상계좌 입금 후 pending에서 confirmed로 바뀌는지 계속 확인한다.",
  },
  {
    name: "Phase 2",
    title: "Site-level ROAS 일일 보고",
    progress: 90,
    status: "대부분 완료",
    description: "최근 7일 기준 Meta ROAS와 내부 confirmed ROAS를 같은 기간, 같은 광고비 기준으로 비교한다.",
    next: "정기 snapshot에서도 Meta ROAS는 1일 클릭 기준이라는 점을 고정 표기한다.",
  },
  {
    name: "Phase 3",
    title: "식별자 품질과 checkout_started",
    progress: 76,
    status: "관찰 중",
    description: "광고 클릭부터 결제완료까지 같은 사용자인지 이어 붙이기 위한 식별자를 보존한다.",
    next: "새 푸터 적용 후 최근 24시간, 48시간 기준으로 식별자 연결률을 본다.",
  },
  {
    name: "Phase 4",
    title: "CAPI / Pixel dedup 검증",
    progress: 86,
    status: "핵심 보정 진행",
    description: "브라우저 Purchase와 서버 CAPI Purchase가 같은 주문을 같은 event_id로 보내는지 맞춘다.",
    next: "카드 결제는 Purchase 유지, 가상계좌 미입금은 Purchase 차단/VirtualAccountIssued 전환을 Pixel Helper로 확인한다.",
  },
  {
    name: "Phase 5",
    title: "Campaign-level ROAS / alias review",
    progress: 45,
    status: "부분 완료",
    description: "utm_campaign alias와 Meta 캠페인/광고를 연결해 캠페인별 내부 ROAS를 열기 위한 단계다.",
    next: "Meta API 권한과 rate limit 문제가 풀리면 URL evidence를 다시 생성한다.",
  },
  {
    name: "Phase 6",
    title: "같은 기준 ROAS 비교 뷰",
    progress: 78,
    status: "기준 정리",
    description: "대화와 화면에서 Meta ROAS headline을 1일 클릭 기준으로 통일한다.",
    next: "default, 7일 클릭, 1일 조회는 보조값으로만 표시한다.",
  },
  {
    name: "Phase 7",
    title: "더클린커피 ROAS 비교 준비",
    progress: 25,
    status: "외부 토큰 필요",
    description: "더클린커피도 biocom과 같은 방식으로 Meta ROAS와 내부 Attribution ROAS를 비교할 준비 단계다.",
    next: "coffee Meta token, Imweb 주문 sync, PG/Toss 상태 sync를 먼저 닫는다.",
  },
];

const roasGapReasons = [
  {
    title: "Meta는 더 넓게 잡는다",
    text: "Meta는 기본적으로 광고 클릭 후 일정 기간 안의 구매를 자기 성과로 본다. 지금은 운영 기준을 1일 클릭으로 낮췄지만, Ads Manager 기본값은 더 넓을 수 있다.",
  },
  {
    title: "가상계좌 미입금도 Browser Purchase로 잡혔다",
    text: "입금 전 가상계좌 주문완료 화면에서 Meta Pixel Purchase가 먼저 발화되는 것이 확인됐다. 내부 Attribution은 confirmed 전까지 매출로 보지 않으므로 차이가 생긴다.",
  },
  {
    title: "브라우저 Pixel과 서버 CAPI가 같은 주문인지 맞아야 한다",
    text: "같은 주문을 브라우저와 서버가 모두 Purchase로 보내도 event_id가 같으면 Meta가 중복 제거할 수 있다. 그래서 Purchase.{orderCode} 규칙으로 맞췄다.",
  },
  {
    title: "광고 클릭 식별자가 결제까지 유지되어야 한다",
    text: "fbclid, fbc, fbp, UTM, GA 식별자가 중간에 사라지면 내부 Attribution은 보수적으로 낮게 잡힌다. 새 푸터는 이 값을 첫 유입과 최신 유입으로 보존한다.",
  },
  {
    title: "캠페인 alias가 완전히 매핑되지 않았다",
    text: "site-level 비교는 가능하지만, 인플루언서/캠페인별로 정확히 보려면 utm_campaign alias와 Meta 광고 URL evidence를 더 채워야 한다.",
  },
];

const codeBlocks = [
  {
    label: "헤더 상단 Purchase Guard",
    purpose: "Meta Pixel보다 먼저 실행되어, 가상계좌 미입금 주문완료 화면의 Browser Purchase를 막는다.",
    does: [
      "결제완료 페이지에서만 작동한다.",
      "가상계좌/무통장/계좌번호/입금대기 문구 조합을 보면 Purchase를 차단한다.",
      "차단한 경우 Purchase 대신 VirtualAccountIssued custom event를 보낸다.",
      "카드 결제 화면에서는 Purchase를 그대로 통과시킨다.",
    ],
    risk: "브라우저 화면 문구 기반 1차 방어다. 나중에는 서버 상태 조회 API로 더 단단하게 만들 수 있다.",
  },
  {
    label: "푸터 UTM / user_id / rebuyz_view",
    purpose: "광고 클릭과 방문 정보를 빈 값으로 덮어쓰지 않고 결제까지 이어 붙이기 위한 코드다.",
    does: [
      "UTM, fbclid, gclid, ttclid가 실제로 있을 때만 저장한다.",
      "first-touch와 latest-touch를 분리해 처음 유입과 최근 유입을 모두 보존한다.",
      "gtag 대기는 5초까지만 수행해 무한 폴링을 막는다.",
      "rebuyz_view는 기존 GA 이벤트 호환을 위해 유지한다.",
    ],
    risk: "모든 페이지에서 rebuyz_view가 발생한다. 나중에 노이즈가 크면 상품 상세 중심으로 줄일 수 있다.",
  },
  {
    label: "푸터 payment_success",
    purpose: "아임웹 주문완료 도달 정보를 우리 자체 Attribution 원장으로 보내는 코드다.",
    does: [
      "orderId, paymentKey, orderCode, orderMember를 현재 URL과 document.referrer에서 모두 찾는다.",
      "orderCode를 top-level payload와 metadata에 같이 저장한다.",
      "browser_purchase_event_id = Purchase.{orderCode}를 남겨 Pixel/CAPI/내부 원장을 묶는다.",
      "checkout_context의 checkoutId와 GA 식별자를 이어받는다.",
    ],
    risk: "이 코드는 아임웹 기본 기능이 아니라 우리가 푸터에 넣는 자체 원장 수집 코드다.",
  },
  {
    label: "checkout_context",
    purpose: "결제 시작 시점의 식별자와 유입 정보를 미리 저장해 주문완료 시점과 연결한다.",
    does: [
      "checkout_started 이벤트를 우리 원장에 남긴다.",
      "checkoutId를 만들어 payment_success와 연결한다.",
      "GA client_id, session_id, user_pseudo_id와 fbc/fbp를 보강한다.",
    ],
    risk: "이번 배치에서는 유지한다. 목적은 재작성보다 현재 결제 흐름을 안정적으로 이어 붙이는 것이다.",
  },
];

const completedWork = [
  "리인벤팅 CRM GTM 제거 후 기존 includes null 오류 제거 방향 확인",
  "Meta ROAS headline 기준을 1일 클릭으로 낮춤",
  "Server CAPI는 confirmed 주문 중심으로 전송 유지",
  "Browser Pixel과 Server CAPI event_id를 Purchase.{아임웹 orderCode}로 맞춤",
  "가상계좌 미입금 Browser Purchase 차단용 헤더 가드 삽입",
  "푸터 UTM overwrite 버그 수정 방향 확정",
  "payment_success에 orderCode와 referrer fallback 보강",
  "checkout_started와 payment_success를 checkoutId로 이어붙이는 구조 구축",
];

const liveVersions = [
  {
    label: "헤더 상단",
    version: "2026-04-12-vbank-purchase-guard-v1",
    meaning: "가상계좌 미입금 주문완료 화면에서 Browser Purchase를 막는 방어 코드",
  },
  {
    label: "푸터 checkout_context",
    version: "2026-04-11-checkout-started-v1",
    meaning: "결제 시작 시점의 유입/식별자 정보를 세션에 보존하는 코드",
  },
  {
    label: "푸터 payment_success",
    version: "2026-04-12-payment-success-order-code-v2",
    meaning: "주문완료 정보를 우리 자체 Attribution 원장으로 보내고 orderCode를 남기는 코드",
  },
];

export default function TrackingIntegrityPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.backLink}>← 대시보드로 돌아가기</Link>
          <p className={styles.eyebrow}>Tracking Integrity</p>
          <h1>추적 코드 및 데이터 정합성</h1>
          <p>
            Meta가 보는 구매와 우리가 보는 확정 매출을 같은 주문 기준으로 맞추기 위한 작업 현황입니다.
            핵심은 브라우저에서 찍힌 구매 영수증과 서버에서 보낸 구매 영수증을 같은 주문으로 묶고,
            미입금 주문은 구매로 세지 않게 만드는 것입니다.
          </p>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <span className={styles.badge}>현재 우선순위</span>
            <h2>가상계좌 미입금 Purchase 오염을 막고, confirmed 기준 ROAS로 정렬</h2>
            <p>
              카드 결제는 결제완료 시점에 실제 승인으로 볼 수 있지만, 가상계좌는 주문완료와 입금완료가 다릅니다.
              그래서 가상계좌 미입금 주문이 Meta Browser Purchase로 먼저 잡히면 Meta ROAS가 내부 Attribution ROAS보다
              과대하게 보일 수 있습니다.
            </p>
          </div>
          <div className={styles.heroPanel}>
            <div>
              <strong>Phase 4</strong>
              <span>86%</span>
            </div>
            <p>CAPI / Pixel dedup과 pending Purchase 차단이 현재 핵심 단계입니다.</p>
          </div>
        </section>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>Browser Pixel</span>
            <strong>사용자 브라우저에서 찍히는 구매</strong>
            <p>아임웹 주문완료 화면에서 Meta Pixel이 보내는 이벤트입니다. 빠르지만 미입금 가상계좌까지 Purchase로 잡을 수 있습니다.</p>
          </article>
          <article className={styles.summaryCard}>
            <span>Server CAPI</span>
            <strong>우리 서버가 Meta에 보내는 구매</strong>
            <p>입금/승인 상태를 확인한 뒤 서버에서 보내는 이벤트입니다. confirmed 기준 운영 ROAS의 정본에 가깝습니다.</p>
          </article>
          <article className={styles.summaryCard}>
            <span>Attribution Ledger</span>
            <strong>우리 자체 원장</strong>
            <p>전태준 대표님이 구축한 자체 솔루션에 쌓이는 결제/유입 원장입니다. 내부 ROAS 판단의 기준입니다.</p>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>왜 차이가 나는가</span>
            <h2>Meta ROAS와 내부 Attribution ROAS가 크게 벌어지는 이유</h2>
            <p>
              차이는 하나의 원인만으로 생기지 않습니다. Meta의 넓은 기여 기준, 브라우저 이벤트 정의,
              서버 이벤트 중복 제거, 식별자 유실, 캠페인 매핑 품질이 같이 영향을 줍니다.
            </p>
          </div>
          <div className={styles.reasonGrid}>
            {roasGapReasons.map((item) => (
              <article key={item.title} className={styles.reasonCard}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>현재 삽입 코드</span>
            <h2>아임웹 헤더와 푸터 코드의 의도</h2>
            <p>
              헤더 코드는 Meta Pixel이 구매를 보내기 전에 먼저 막는 역할이고, 푸터 코드는 우리 자체 원장에 유입과 결제완료 정보를 남기는 역할입니다.
            </p>
          </div>
          <div className={styles.versionGrid}>
            {liveVersions.map((item) => (
              <article key={item.label} className={styles.versionCard}>
                <span>{item.label}</span>
                <strong>{item.version}</strong>
                <p>{item.meaning}</p>
              </article>
            ))}
          </div>
          <div className={styles.codeGrid}>
            {codeBlocks.map((item) => (
              <article key={item.label} className={styles.codeCard}>
                <span>{item.label}</span>
                <h3>{item.purpose}</h3>
                <ul>
                  {item.does.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <p>{item.risk}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>작업 이력</span>
            <h2>지금까지 바로잡은 것</h2>
            <p>
              목표는 Meta 숫자를 무조건 낮추는 것이 아니라, 구매로 볼 수 있는 주문만 구매로 보고 같은 주문은 한 번만 세는 것입니다.
            </p>
          </div>
          <div className={styles.doneList}>
            {completedWork.map((item) => <div key={item}>{item}</div>)}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Roadmap</span>
            <h2>데이터 정합성 Phase별 완성도</h2>
            <p>완성도는 2026-04-12 기준 작업 문서와 로컬 검증 상태를 반영했습니다.</p>
          </div>
          <div className={styles.phaseList}>
            {phases.map((phase) => (
              <article key={phase.name} className={styles.phaseCard}>
                <div className={styles.phaseTop}>
                  <div>
                    <span>{phase.name}</span>
                    <h3>{phase.title}</h3>
                  </div>
                  <strong>{phase.progress}%</strong>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${phase.progress}%` }} />
                </div>
                <p>{phase.description}</p>
                <div className={styles.phaseMeta}>
                  <span>{phase.status}</span>
                  <em>{phase.next}</em>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.nextPanel}>
          <div>
            <span className={styles.sectionKicker}>다음 확인</span>
            <h2>지금 바로 봐야 할 4가지</h2>
          </div>
          <ol>
            <li>카드 결제 완료에서 Pixel Helper에 Purchase가 계속 뜨는지 확인한다.</li>
            <li>가상계좌 미입금 완료에서 Purchase가 사라지고 VirtualAccountIssued가 뜨는지 확인한다.</li>
            <li>payment_success 원장 metadata에 orderCode와 referrerPayment가 남는지 확인한다.</li>
            <li>Server CAPI event_id가 Browser와 같은 Purchase.&#123;orderCode&#125;인지 확인한다.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
