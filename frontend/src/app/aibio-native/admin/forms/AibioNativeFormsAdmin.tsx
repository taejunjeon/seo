"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AIBIO_NATIVE_API_BASE } from "@/lib/aibio-native";

const ADMIN_TOKEN_STORAGE_KEY = "aibio-native-admin-token";

type CountItem = { key: string; count: number };

type FormExportAnalysis = {
  ok: boolean;
  generatedAt: string;
  file: { name: string; size: number; mimeType: string };
  privacy: { rawPiiReturned: boolean; phoneHashOnly: boolean; note: string };
  shape: { sheetRows: number; dataRows: number; columns: number; headers: string[] };
  freshness: { firstResponseAt: string | null; latestResponseAt: string | null };
  quality: {
    missingNameRows: number;
    missingPhoneRows: number;
    uniquePhoneHashes: number;
    duplicatePhoneHashRows: number;
    privacyConsentRows: number;
    thirdPartyConsentRows: number;
  };
  distributions: {
    age: CountItem[];
    purpose: CountItem[];
    channel: CountItem[];
    consultationType: CountItem[];
  };
  recommendedNativeFields: Array<{ sourceHeader: string; nativeField: string; note: string }>;
  error?: string;
};

const fmt = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

export function AibioNativeFormsAdmin() {
  const [adminToken, setAdminToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [analysis, setAnalysis] = useState<FormExportAnalysis | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    setAdminToken(stored);
    setTokenDraft(stored);
  }, []);

  const saveToken = () => {
    const next = tokenDraft.trim();
    setAdminToken(next);
    if (next) window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, next);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  };

  const analyze = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage("");
    setAnalysis(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/admin/form-export/analyze`, {
        method: "POST",
        headers: adminToken ? { "x-admin-token": adminToken } : {},
        body: formData,
      });
      const body = (await response.json()) as FormExportAnalysis;
      if (!response.ok || !body.ok) {
        throw new Error(response.status === 403 ? "관리자 토큰이 없거나 맞지 않습니다." : body.error ?? "입력폼 분석 실패");
      }
      setAnalysis(body);
      setMessage("입력폼 엑셀 분석이 완료되었습니다. 원문 이름, 전화번호, IP는 화면에 반환하지 않습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "입력폼 분석 실패");
    } finally {
      setUploading(false);
    }
  };

  const qualityItems = useMemo(() => {
    if (!analysis) return [];
    return [
      ["제출 행", fmt(analysis.shape.dataRows)],
      ["컬럼", fmt(analysis.shape.columns)],
      ["유니크 연락처 hash", fmt(analysis.quality.uniquePhoneHashes)],
      ["중복 연락처 행", fmt(analysis.quality.duplicatePhoneHashRows)],
      ["개인정보 동의", fmt(analysis.quality.privacyConsentRows)],
      ["제3자 제공 동의", fmt(analysis.quality.thirdPartyConsentRows)],
    ];
  }, [analysis]);

  return (
    <main className="forms-admin">
      <header className="admin-header">
        <div>
          <p>AIBIO Native Admin Phase3</p>
          <h1>아임웹 입력폼 엑셀을 자체 원장 필드와 대조합니다.</h1>
          <span>업로드 분석은 집계만 반환합니다. 원문 개인정보는 저장소나 화면에 남기지 않습니다.</span>
        </div>
        <nav aria-label="AIBIO 관리자 메뉴">
          <a href="/aibio-native/admin">고객/리드</a>
          <a href="/aibio-native/admin/content">상세페이지 편집</a>
          <a href="/aibio-native/admin/access">권한</a>
          <a href="/shop_view?idx=25" target="_blank">공개 랜딩</a>
        </nav>
      </header>

      <section className="token-board" aria-label="관리자 토큰">
        <label>
          관리자 토큰
          <input type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="운영 secret 값" />
        </label>
        <button type="button" onClick={saveToken}>세션 저장</button>
        <label className="upload-button">
          {uploading ? "분석 중" : "엑셀 업로드"}
          <input type="file" accept=".xlsx,.xls,.csv" disabled={uploading} onChange={analyze} />
        </label>
        <span>{adminToken ? "토큰 입력됨" : "운영 업로드에는 토큰 필요"}</span>
      </section>

      {message ? <div className="notice">{message}</div> : null}

      <section className="guide">
        <article>
          <h2>현재 제공된 엑셀 기준 핵심 필드</h2>
          <p>아이디, 작성자, IP 주소, 응답시간, 개인정보 수집동의, 개인정보 제3자 제공동의, 이름, 연락처, 나이, 상담 목적, 알게 된 경로, 상담 신청 유형.</p>
        </article>
        <article>
          <h2>폼 개선 추천</h2>
          <p>상담 목적은 다중 선택으로 바꾸고, 상담 신청 유형은 문자/전화/카톡 선호 연락 방식으로 별도 저장하는 것을 추천합니다.</p>
        </article>
      </section>

      {analysis ? (
        <>
          <section className="summary-grid" aria-label="입력폼 분석 요약">
            {qualityItems.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>

          <section className="panel">
            <h2>분석 파일</h2>
            <div className="meta-grid">
              <span>파일명: {analysis.file.name}</span>
              <span>기간: {analysis.freshness.firstResponseAt ?? "-"} ~ {analysis.freshness.latestResponseAt ?? "-"}</span>
              <span>개인정보 반환: {analysis.privacy.rawPiiReturned ? "있음" : "없음"}</span>
              <span>연락처 비교: {analysis.privacy.phoneHashOnly ? "hash 기준" : "원문 기준"}</span>
            </div>
          </section>

          <section className="columns">
            <Distribution title="나이/나이대" rows={analysis.distributions.age} />
            <Distribution title="상담 목적" rows={analysis.distributions.purpose} />
            <Distribution title="알게 된 경로" rows={analysis.distributions.channel} />
            <Distribution title="상담 신청 유형" rows={analysis.distributions.consultationType} />
          </section>

          <section className="panel">
            <h2>자체 원장 필드 매핑</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>아임웹 헤더</th>
                    <th>자체 필드</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.recommendedNativeFields.map((field) => (
                    <tr key={`${field.sourceHeader}-${field.nativeField}`}>
                      <td>{field.sourceHeader}</td>
                      <td>{field.nativeField}</td>
                      <td>{field.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <style jsx global>{`
        .forms-admin {
          min-height: 100vh;
          padding: 32px;
          color: #172554;
          background: #eef4ff;
          font-family: var(--font-sans), system-ui, sans-serif;
        }

        .admin-header,
        .token-board {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .admin-header p {
          margin: 0 0 8px;
          color: #3758d4;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .admin-header h1 {
          margin: 0;
          font-size: clamp(1.8rem, 3vw, 3rem);
          letter-spacing: 0;
        }

        .admin-header span,
        .guide p,
        .token-board span,
        .meta-grid span {
          color: #64748b;
          font-size: 0.84rem;
          font-weight: 750;
          line-height: 1.65;
        }

        nav {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        nav a,
        .token-board button,
        .upload-button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          padding: 0 12px;
          color: #ffffff;
          background: #3758d4;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .upload-button {
          background: #0f766e;
        }

        .upload-button input {
          display: none;
        }

        .token-board,
        .guide article,
        .summary-grid article,
        .panel,
        .distribution,
        .notice {
          border: 1px solid rgba(55, 88, 212, 0.12);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 16px 34px rgba(31, 41, 55, 0.06);
        }

        .token-board {
          align-items: end;
          padding: 16px;
        }

        .token-board label {
          display: grid;
          gap: 6px;
          color: #475569;
          font-size: 0.76rem;
          font-weight: 900;
        }

        input {
          min-height: 38px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          color: #172554;
          font: inherit;
        }

        .notice {
          margin-bottom: 16px;
          padding: 12px 14px;
          color: #1d4ed8;
          font-size: 0.86rem;
          font-weight: 850;
        }

        .guide,
        .summary-grid,
        .columns {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .summary-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        .guide article,
        .summary-grid article,
        .panel,
        .distribution {
          padding: 18px;
        }

        h2 {
          margin: 0 0 10px;
          font-size: 1.06rem;
          letter-spacing: 0;
        }

        .summary-grid span,
        .distribution span {
          display: block;
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 900;
        }

        .summary-grid strong {
          display: block;
          margin-top: 8px;
          font-size: 1.5rem;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .bar-list {
          display: grid;
          gap: 8px;
        }

        .bar-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
        }

        .bar-row i {
          grid-column: 1 / -1;
          height: 7px;
          border-radius: 99px;
          background: #bfdbfe;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        th,
        td {
          border-bottom: 1px solid #e2e8f0;
          padding: 11px 10px;
          text-align: left;
          vertical-align: top;
          font-size: 0.84rem;
        }

        th {
          color: #64748b;
          font-size: 0.74rem;
          text-transform: uppercase;
        }

        @media (max-width: 1040px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .forms-admin {
            padding: 20px 14px;
          }

          .admin-header,
          .token-board {
            flex-direction: column;
            align-items: stretch;
          }

          nav,
          .guide,
          .columns,
          .meta-grid,
          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Distribution({ title, rows }: { title: string; rows: CountItem[] }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <article className="distribution">
      <h2>{title}</h2>
      <div className="bar-list">
        {rows.slice(0, 10).map((row) => (
          <div className="bar-row" key={row.key}>
            <span>{row.key}</span>
            <strong>{fmt(row.count)}</strong>
            <i style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }} />
          </div>
        ))}
      </div>
    </article>
  );
}
