"use client";

import { AibioNativeLeadForm } from "../aibio-native/AibioNativeLeadForm";

const KAKAO_CHAT_URL = "https://pf.kakao.com/_jRxcPK/chat";
const HERO_IMAGE = "https://cdn.imweb.me/thumbnail/20250124/e96dc62d45b13.jpg";
const PROGRAM_IMAGE = "https://cdn.imweb.me/thumbnail/20250124/340d5a869a6b2.jpg";
const RESULT_IMAGE = "https://cdn.imweb.me/thumbnail/20250124/1312356faa028.jpg";

const OFFER_POINTS = [
  {
    label: "첫 방문",
    title: "대사 리듬 상담",
    body: "생활 패턴, 붓기, 식욕, 수면 상태를 함께 보고 방문 상담의 방향을 정합니다.",
  },
  {
    label: "센터 체험",
    title: "리커버리 장비 안내",
    body: "방문 전 상담 목적을 남기면 운영팀이 적합한 체험 순서를 안내합니다.",
  },
  {
    label: "운영 원장",
    title: "상담 상태 추적",
    body: "광고 유입부터 상담 신청, 예약, 방문 가능성까지 자체 리드 원장에 남깁니다.",
  },
];

const FLOW = [
  ["01", "신청", "이름, 연락처, 관심 목적을 남깁니다."],
  ["02", "상담", "운영팀이 연락 가능 시간에 맞춰 상담합니다."],
  ["03", "예약", "방문 시간과 체험 구성을 확정합니다."],
  ["04", "방문", "센터에서 상담 결과와 다음 단계를 기록합니다."],
];

export function RecoveryLabOfferLanding() {
  return (
    <main className="offer-page">
      <header className="offer-header" aria-label="AIBIO Recovery Lab">
        <a className="brand" href="#top" aria-label="AIBIO Recovery Lab">
          <span>AIBIO</span>
          <strong>Recovery Lab</strong>
        </a>
        <nav aria-label="랜딩 메뉴">
          <a href="#program">프로그램</a>
          <a href="#flow">진행 흐름</a>
          <a href="#apply">상담 신청</a>
        </nav>
        <a className="header-cta" href="#apply">첫방문 신청</a>
      </header>

      <section id="top" className="hero" aria-label="AIBIO 첫방문 체험 상담">
        <div className="hero-copy">
          <p className="eyebrow">AIBIO Recovery Lab Offer</p>
          <h1>붓기와 식욕 리듬을 먼저 확인하는 첫방문 체험 상담</h1>
          <p>
            아임웹 `/shop_view?idx=25`에서 유입되던 리커버리랩 체험 성격의 랜딩을 자체 폼으로 옮기는 1차 실험입니다.
            상담 신청은 AIBIO 자체 리드 원장에 저장됩니다.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#apply">상담 신청하기</a>
            <a className="secondary-action" href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer">
              카카오 상담
            </a>
          </div>
        </div>
        <div className="hero-panel" aria-label="첫 실험 랜딩 기준">
          <span>실험 기준 URL</span>
          <strong>/shop_view?idx=25</strong>
          <p>Meta·Instagram 유입과 자체 리드 원장 저장을 함께 확인합니다.</p>
        </div>
      </section>

      <section className="offer-strip" aria-label="첫방문 상담 핵심">
        <div>
          <span>핵심 CTA</span>
          <strong>상담 신청</strong>
        </div>
        <div>
          <span>저장 위치</span>
          <strong>Native Lead Ledger</strong>
        </div>
        <div>
          <span>광고키</span>
          <strong>UTM · fbclid · gclid</strong>
        </div>
      </section>

      <section id="program" className="program-section">
        <div className="program-copy">
          <p className="eyebrow">Program</p>
          <h2>방문 전부터 상담 목적을 분명히 잡습니다.</h2>
          <p>
            AIBIO 센터는 단순 상품 주문보다 상담 연결과 방문 예약이 중요합니다.
            그래서 이 랜딩은 체험권 판매보다 리드 품질과 방문 가능성 기록에 초점을 둡니다.
          </p>
        </div>
        <div className="program-visual" role="img" aria-label="AIBIO 리커버리랩 프로그램 이미지" />
      </section>

      <section className="offer-grid" aria-label="첫방문 체험 상담 구성">
        {OFFER_POINTS.map((point) => (
          <article key={point.title}>
            <span>{point.label}</span>
            <h3>{point.title}</h3>
            <p>{point.body}</p>
          </article>
        ))}
      </section>

      <section id="flow" className="flow-section">
        <div className="flow-heading">
          <p className="eyebrow">Flow</p>
          <h2>광고 클릭 이후의 흐름을 끊기지 않게 남깁니다.</h2>
        </div>
        <div className="flow-grid">
          {FLOW.map(([step, title, body]) => (
            <article key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-label="방문 전 확인 항목">
        <div className="proof-image" role="img" aria-label="AIBIO 변화 후기 이미지" />
        <div className="proof-copy">
          <p className="eyebrow">Measurement</p>
          <h2>이번 route의 목표는 예쁜 페이지가 아니라 리드와 유입의 연결입니다.</h2>
          <p>
            제출 시점의 landing path, referrer, UTM, fbclid, gclid, _fbc, _fbp, _ga를 함께 저장합니다.
            운영자는 이후 연락중, 예약확정, 방문완료, 결제완료 상태를 같은 원장에 남길 수 있습니다.
          </p>
        </div>
      </section>

      <AibioNativeLeadForm
        sectionId="apply"
        eyebrow="First Visit Lead"
        title="첫방문 체험 상담을 신청합니다."
        description="제출한 정보는 AIBIO 자체 리드 원장에 저장됩니다. 운영자는 이 기록으로 연락 상태, 예약 여부, 방문 여부를 이어서 관리합니다."
        submitLabel="첫방문 상담 신청 저장"
        storageSource="aibio_shop_view_idx_25_offer"
        variant="offer"
      />

      <footer className="offer-footer">
        <span>Native route: /shop_view?idx=25</span>
        <span>Fallback 비교 전까지 아임웹 입력폼 병행</span>
      </footer>

      <div className="mobile-cta-bar" aria-label="모바일 빠른 상담 메뉴" role="navigation">
        <a className="mobile-cta-secondary" href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer">
          <span>카카오 상담</span>
        </a>
        <a className="mobile-cta-primary" href="#apply">
          <span>첫방문 상담 신청</span>
        </a>
      </div>

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      <style jsx>{`
        .offer-page {
          min-height: 100vh;
          color: #15223f;
          background: #f5f8fb;
          font-family: var(--font-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        section[id] {
          scroll-margin-top: 88px;
        }

        .mobile-cta-bar {
          display: none;
        }

        .offer-header {
          position: sticky;
          top: 0;
          z-index: 30;
          min-height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 0 48px;
          background: rgba(255, 255, 255, 0.94);
          border-bottom: 1px solid rgba(34, 86, 143, 0.14);
          backdrop-filter: blur(16px);
        }

        .brand {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          min-width: 188px;
          color: #10213d;
          font-weight: 900;
          letter-spacing: 0;
        }

        .brand span {
          color: #2764d8;
        }

        .brand strong {
          font-size: 0.92rem;
        }

        nav {
          display: flex;
          align-items: center;
          gap: 24px;
          color: #344761;
          font-size: 0.9rem;
          font-weight: 800;
        }

        nav a,
        .header-cta,
        .primary-action,
        .secondary-action {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }

        .header-cta,
        .primary-action {
          padding: 0 18px;
          border-radius: 6px;
          color: #ffffff;
          background: #2764d8;
          font-weight: 900;
        }

        .secondary-action {
          padding: 0 18px;
          border-radius: 6px;
          color: #10213d;
          background: #ffffff;
          border: 1px solid rgba(16, 33, 61, 0.18);
          font-weight: 900;
        }

        .hero {
          position: relative;
          min-height: 660px;
          display: flex;
          align-items: center;
          padding: 92px 56px;
          background-image:
            linear-gradient(90deg, rgba(8, 22, 50, 0.96) 0%, rgba(8, 22, 50, 0.82) 44%, rgba(8, 22, 50, 0.1) 76%),
            url("${HERO_IMAGE}");
          background-size: cover;
          background-position: right center;
          overflow: hidden;
        }

        .hero-copy {
          width: min(650px, 100%);
          color: #ffffff;
        }

        .eyebrow {
          margin: 0 0 14px;
          color: #4fc3f7;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        p {
          letter-spacing: 0;
        }

        h1 {
          max-width: 650px;
          margin: 0 0 22px;
          font-size: 3.2rem;
          line-height: 1.14;
          font-weight: 900;
        }

        .hero-copy p {
          max-width: 590px;
          margin: 0;
          color: rgba(255, 255, 255, 0.86);
          font-size: 1.05rem;
          line-height: 1.78;
          font-weight: 650;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 30px;
        }

        .hero-panel {
          position: absolute;
          right: 48px;
          bottom: 40px;
          width: min(340px, calc(100% - 96px));
          min-height: 132px;
          padding: 20px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.78);
          box-shadow: 0 16px 48px rgba(10, 24, 48, 0.18);
        }

        .hero-panel span {
          display: block;
          color: #52708f;
          font-size: 0.78rem;
          font-weight: 900;
        }

        .hero-panel strong {
          display: block;
          margin-top: 8px;
          color: #10213d;
          font-size: 1.1rem;
          line-height: 1.35;
        }

        .hero-panel p {
          margin: 10px 0 0;
          color: #475569;
          font-size: 0.9rem;
          line-height: 1.55;
          font-weight: 700;
        }

        .offer-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(39, 100, 216, 0.14);
        }

        .offer-strip div {
          min-height: 108px;
          padding: 26px 30px;
          background: #ffffff;
        }

        .offer-strip span {
          display: block;
          margin-bottom: 8px;
          color: #62748a;
          font-size: 0.78rem;
          font-weight: 900;
        }

        .offer-strip strong {
          color: #10213d;
          font-size: 1.08rem;
        }

        .program-section,
        .proof-section {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(360px, 1.05fr);
          gap: 48px;
          align-items: center;
          padding: 86px 56px;
          background: #ffffff;
        }

        .program-copy h2,
        .flow-heading h2,
        .proof-copy h2 {
          margin: 0 0 18px;
          color: #10213d;
          font-size: 2.05rem;
          line-height: 1.28;
          font-weight: 900;
        }

        .program-copy p,
        .flow-heading p,
        .proof-copy p,
        .offer-grid p,
        .flow-grid p {
          color: #475569;
          font-size: 0.98rem;
          line-height: 1.75;
          font-weight: 650;
        }

        .program-visual,
        .proof-image {
          min-height: 360px;
          border-radius: 8px;
          background-size: cover;
          background-position: center;
          border: 1px solid rgba(39, 100, 216, 0.14);
        }

        .program-visual {
          background-image: url("${PROGRAM_IMAGE}");
        }

        .proof-image {
          background-image: url("${RESULT_IMAGE}");
          background-position: right center;
        }

        .offer-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          padding: 0 56px 86px;
          background: #ffffff;
        }

        .offer-grid article,
        .flow-grid article {
          min-height: 210px;
          padding: 24px;
          border-radius: 8px;
          background: #f7fbff;
          border: 1px solid rgba(39, 100, 216, 0.12);
        }

        .offer-grid span,
        .flow-grid span {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          margin-bottom: 16px;
          padding: 0 10px;
          border-radius: 5px;
          color: #0f766e;
          background: #ccfbf1;
          font-size: 0.72rem;
          font-weight: 900;
        }

        .offer-grid h3,
        .flow-grid h3 {
          margin: 0 0 12px;
          color: #10213d;
          font-size: 1.16rem;
          line-height: 1.34;
          font-weight: 900;
        }

        .flow-section {
          padding: 86px 56px;
          background: #eef6ff;
        }

        .flow-heading {
          max-width: 760px;
          margin-bottom: 34px;
        }

        .flow-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .proof-section {
          grid-template-columns: minmax(360px, 1.05fr) minmax(0, 0.95fr);
        }

        .offer-footer {
          min-height: 74px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 56px;
          color: #64748b;
          background: #ffffff;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 0.82rem;
          font-weight: 800;
        }

        @media (max-width: 980px) {
          .offer-page {
            padding-bottom: 76px;
          }

          .mobile-cta-bar {
            position: fixed;
            inset: auto 0 0 0;
            z-index: 40;
            display: grid;
            grid-template-columns: 1fr 1.4fr;
            gap: 8px;
            padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
            background: rgba(255, 255, 255, 0.98);
            border-top: 1px solid rgba(15, 23, 42, 0.12);
            box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08);
          }

          .mobile-cta-bar a {
            min-height: 52px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            font-size: 0.96rem;
            font-weight: 900;
            text-decoration: none;
          }

          .mobile-cta-secondary {
            color: #10213d;
            background: #ffffff;
            border: 1px solid #cbd5e1;
          }

          .mobile-cta-primary {
            color: #ffffff;
            background: #2764d8;
            border: 1px solid #2764d8;
          }

          .offer-header {
            padding: 0 22px;
          }

          nav {
            display: none;
          }

          .hero {
            min-height: 650px;
            padding: 72px 24px 170px;
            background-position: center right;
          }

          h1 {
            font-size: 2.36rem;
          }

          .hero-panel {
            left: 24px;
            right: 24px;
            width: auto;
            bottom: 26px;
          }

          .offer-strip,
          .offer-grid,
          .flow-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .program-section,
          .proof-section {
            grid-template-columns: 1fr;
            padding: 64px 24px;
          }

          .offer-grid {
            padding: 0 24px 64px;
          }

          .program-visual,
          .proof-image {
            min-height: 280px;
          }

          .flow-section {
            padding: 64px 24px;
          }
        }

        @media (max-width: 620px) {
          .offer-header {
            min-height: 64px;
          }

          .brand {
            min-width: 0;
          }

          .brand strong {
            display: none;
          }

          .header-cta {
            min-height: 38px;
            padding: 0 12px;
            font-size: 0.82rem;
          }

          .hero {
            min-height: 650px;
            padding: 54px 18px 172px;
            background-image:
              linear-gradient(180deg, rgba(8, 22, 50, 0.9) 0%, rgba(8, 22, 50, 0.68) 50%, rgba(8, 22, 50, 0.28) 100%),
              url("${HERO_IMAGE}");
            background-position: center;
          }

          h1 {
            font-size: 2rem;
            line-height: 1.2;
          }

          .hero-copy p {
            font-size: 0.97rem;
          }

          .hero-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .primary-action,
          .secondary-action {
            width: 100%;
          }

          .offer-strip,
          .offer-grid,
          .flow-grid {
            grid-template-columns: 1fr;
          }

          .offer-strip div {
            min-height: 92px;
            padding: 20px;
          }

          .program-copy h2,
          .flow-heading h2,
          .proof-copy h2 {
            font-size: 1.55rem;
          }

          .offer-footer {
            min-height: 110px;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            padding: 18px 24px;
          }
        }
      `}</style>
    </main>
  );
}
