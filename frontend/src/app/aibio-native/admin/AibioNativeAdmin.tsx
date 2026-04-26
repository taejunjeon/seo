"use client";

const LEADS = [
  {
    id: "L-0426-001",
    source: "Instagram",
    purpose: "대사 & 붓기 케어",
    status: "상담 필요",
    reservation: "미정",
    payment: "없음",
    quality: "상",
  },
  {
    id: "L-0426-002",
    source: "Naver",
    purpose: "대사 & 식욕 조절",
    status: "예약 완료",
    reservation: "2026-04-27 오후",
    payment: "예약금 대기",
    quality: "중",
  },
  {
    id: "L-0426-003",
    source: "Direct",
    purpose: "바이오펄스 & 리커버리",
    status: "방문 완료",
    reservation: "2026-04-26 오전",
    payment: "체험권 상담",
    quality: "상",
  },
];

const SUMMARY = [
  ["신규 리드", "3"],
  ["상담 필요", "1"],
  ["예약 완료", "1"],
  ["방문 완료", "1"],
];

export function AibioNativeAdmin() {
  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p>AIBIO Native Admin MVP</p>
          <h1>리드, 예약, 방문, 결제 상태를 한 화면에서 봅니다.</h1>
        </div>
        <a href="/aibio-native">공개 페이지</a>
      </header>

      <section className="summary-grid" aria-label="리드 요약">
        {SUMMARY.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="board" aria-label="리드 목록">
        <div className="board-head">
          <div>
            <p>Lead operations</p>
            <h2>운영자 입력 컬럼 초안</h2>
          </div>
          <span>dry-run mock</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>접수번호</th>
                <th>유입</th>
                <th>상담 목적</th>
                <th>상담 상태</th>
                <th>예약</th>
                <th>결제</th>
                <th>품질</th>
              </tr>
            </thead>
            <tbody>
              {LEADS.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.id}</td>
                  <td>{lead.source}</td>
                  <td>{lead.purpose}</td>
                  <td><span className="pill blue">{lead.status}</span></td>
                  <td>{lead.reservation}</td>
                  <td>{lead.payment}</td>
                  <td><span className={`pill ${lead.quality === "상" ? "green" : "amber"}`}>{lead.quality}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workflow" aria-label="운영 처리 순서">
        <h2>운영 처리 순서</h2>
        <ol>
          <li>신규 리드를 열고 유입과 상담 목적을 확인한다.</li>
          <li>통화 결과를 `미연락`, `부재`, `상담완료`, `예약완료` 중 하나로 남긴다.</li>
          <li>방문일과 담당자를 기록한다.</li>
          <li>예약금 또는 체험권 결제 상태를 연결한다.</li>
        </ol>
      </section>

      <style jsx>{`
        .admin-page {
          min-height: 100vh;
          padding: 36px;
          color: #172554;
          background: #eef4ff;
          font-family: var(--font-sans), system-ui, sans-serif;
        }

        .admin-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .admin-header p,
        .board-head p {
          margin: 0 0 8px;
          color: #2563eb;
          font-size: 0.76rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .admin-header h1 {
          max-width: 720px;
          margin: 0;
          font-size: 2rem;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: 0;
        }

        .admin-header a {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border-radius: 6px;
          color: #ffffff;
          background: #3758d4;
          font-size: 0.86rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .summary-grid article {
          min-height: 110px;
          padding: 22px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(37, 99, 235, 0.12);
        }

        .summary-grid span {
          display: block;
          margin-bottom: 10px;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .summary-grid strong {
          color: #172554;
          font-size: 2rem;
          font-weight: 900;
        }

        .board,
        .workflow {
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(37, 99, 235, 0.12);
        }

        .board {
          overflow: hidden;
        }

        .board-head {
          min-height: 90px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }

        .board-head h2,
        .workflow h2 {
          margin: 0;
          color: #172554;
          font-size: 1.2rem;
          font-weight: 900;
        }

        .board-head span {
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border-radius: 5px;
          color: #0f766e;
          background: #ccfbf1;
          font-size: 0.76rem;
          font-weight: 900;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 860px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 16px 18px;
          text-align: left;
          border-bottom: 1px solid rgba(15, 23, 42, 0.07);
          font-size: 0.86rem;
          font-weight: 800;
        }

        th {
          color: #64748b;
          background: #f8fbff;
        }

        td {
          color: #334155;
        }

        .pill {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border-radius: 5px;
          font-size: 0.76rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.blue {
          color: #1d4ed8;
          background: #dbeafe;
        }

        .pill.green {
          color: #047857;
          background: #d1fae5;
        }

        .pill.amber {
          color: #92400e;
          background: #fef3c7;
        }

        .workflow {
          margin-top: 18px;
          padding: 24px;
        }

        .workflow ol {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 18px 0 0;
          padding: 0;
          list-style: none;
        }

        .workflow li {
          min-height: 116px;
          padding: 18px;
          border-radius: 8px;
          color: #475569;
          background: #f8fbff;
          border: 1px solid rgba(37, 99, 235, 0.1);
          font-size: 0.88rem;
          line-height: 1.6;
          font-weight: 750;
        }

        @media (max-width: 900px) {
          .admin-page {
            padding: 22px;
          }

          .admin-header {
            flex-direction: column;
          }

          .summary-grid,
          .workflow ol {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .summary-grid,
          .workflow ol {
            grid-template-columns: 1fr;
          }

          .admin-header h1 {
            font-size: 1.55rem;
          }
        }
      `}</style>
    </main>
  );
}
