"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AIBIO_NATIVE_API_BASE,
  type AibioAdminOperator,
  type AibioAdminRole,
} from "@/lib/aibio-native";

const ADMIN_TOKEN_STORAGE_KEY = "aibio-native-admin-token";

type AccessResponse = {
  ok: boolean;
  access?: {
    updatedAt: string;
    updatedBy: string;
    operators: AibioAdminOperator[];
  };
  error?: string;
};

const ROLE_OPTIONS: Array<{ value: AibioAdminRole; label: string; permissions: string }> = [
  { value: "owner", label: "최고관리자", permissions: "권한 지정, 원문 연락처, 상태 변경, 콘텐츠, 입력폼 분석" },
  { value: "manager", label: "상담 매니저", permissions: "원문 연락처, 상태 변경, 예약/방문 메모" },
  { value: "marketer", label: "마케터", permissions: "유입/퍼널/입력폼 분석 조회" },
  { value: "designer", label: "디자인/콘텐츠", permissions: "상세페이지 문구와 이미지 수정" },
  { value: "viewer", label: "조회 전용", permissions: "마스킹 목록과 요약 지표 조회" },
];

const emptyOperator = (): AibioAdminOperator => ({
  id: `op-${Date.now()}`,
  name: "",
  email: "",
  role: "viewer",
  active: true,
});

export function AibioNativeAccessAdmin() {
  const [adminToken, setAdminToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [operators, setOperators] = useState<AibioAdminOperator[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    setAdminToken(stored);
    setTokenDraft(stored);
  }, []);

  const load = async (token = adminToken) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/admin/access`, {
        headers: token ? { "x-admin-token": token } : {},
        cache: "no-store",
      });
      const body = (await response.json()) as AccessResponse;
      if (!response.ok || !body.ok || !body.access) {
        throw new Error(response.status === 403 ? "관리자 토큰이 없거나 맞지 않습니다." : body.error ?? "권한 목록 조회 실패");
      }
      setOperators(body.access.operators);
      setUpdatedAt(body.access.updatedAt);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "권한 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Initial load should run after session token hydration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  const saveToken = () => {
    const next = tokenDraft.trim();
    setAdminToken(next);
    if (next) window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, next);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  };

  const updateOperator = (index: number, patch: Partial<AibioAdminOperator>) => {
    setOperators((current) => current.map((operator, itemIndex) => itemIndex === index ? { ...operator, ...patch } : operator));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/admin/access`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
        },
        body: JSON.stringify({ operators }),
      });
      const body = (await response.json()) as AccessResponse;
      if (!response.ok || !body.ok || !body.access) {
        throw new Error(response.status === 403 ? "관리자 토큰이 없거나 맞지 않습니다." : body.error ?? "권한 저장 실패");
      }
      setOperators(body.access.operators);
      setUpdatedAt(body.access.updatedAt);
      setMessage("권한 초안이 저장되었습니다. 현재는 관리자 토큰 기반이며, 정식 로그인/RBAC 전환 전 명부로 사용합니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "권한 저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(() => operators.filter((operator) => operator.active).length, [operators]);

  return (
    <main className="access-admin">
      <header className="admin-header">
        <div>
          <p>AIBIO Native Admin Phase5</p>
          <h1>관리자 역할과 접근 권한을 지정합니다.</h1>
          <span>현재 운영 보호는 `AIBIO_NATIVE_ADMIN_TOKEN`으로 하고, 이 화면은 정식 로그인/RBAC 전환 전 운영자 명부와 권한 기준표입니다.</span>
        </div>
        <nav aria-label="AIBIO 관리자 메뉴">
          <a href="/aibio-native/admin">고객/리드</a>
          <a href="/aibio-native/admin/forms">입력폼</a>
          <a href="/aibio-native/admin/content">상세페이지 편집</a>
          <a href="/shop_view?idx=25" target="_blank">공개 랜딩</a>
        </nav>
      </header>

      <section className="token-board" aria-label="관리자 토큰">
        <label>
          관리자 토큰
          <input type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="운영 secret 값" />
        </label>
        <button type="button" onClick={saveToken}>세션 저장</button>
        <button type="button" onClick={() => void load()}>새로고침</button>
        <span>{adminToken ? "토큰 입력됨" : "운영 저장에는 토큰 필요"}</span>
      </section>

      {message ? <div className="notice">{message}</div> : null}
      {loading ? <div className="notice">권한 목록을 읽는 중입니다.</div> : null}

      <section className="summary-grid" aria-label="권한 요약">
        <article><span>운영자</span><strong>{operators.length}</strong></article>
        <article><span>활성</span><strong>{activeCount}</strong></article>
        <article><span>업데이트</span><strong>{updatedAt ? new Date(updatedAt).toLocaleDateString("ko-KR") : "-"}</strong></article>
      </section>

      <section className="role-grid" aria-label="역할 기준표">
        {ROLE_OPTIONS.map((role) => (
          <article key={role.value}>
            <span>{role.value}</span>
            <h2>{role.label}</h2>
            <p>{role.permissions}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p>Operators</p>
            <h2>운영자 명부 초안</h2>
          </div>
          <button type="button" onClick={() => setOperators((current) => [...current, emptyOperator()])}>운영자 추가</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>역할</th>
                <th>활성</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator, index) => (
                <tr key={operator.id}>
                  <td><input value={operator.name} onChange={(event) => updateOperator(index, { name: event.target.value })} /></td>
                  <td><input value={operator.email} onChange={(event) => updateOperator(index, { email: event.target.value })} /></td>
                  <td>
                    <select value={operator.role} onChange={(event) => updateOperator(index, { role: event.target.value as AibioAdminRole })}>
                      {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={operator.active} onChange={(event) => updateOperator(index, { active: event.target.checked })} />
                      사용
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="sticky-actions">
        <button type="button" onClick={save} disabled={saving}>{saving ? "저장 중" : "권한 초안 저장"}</button>
      </div>

      <style jsx global>{`
        .access-admin {
          min-height: 100vh;
          padding: 32px;
          color: #172554;
          background: #eef4ff;
          font-family: var(--font-sans), system-ui, sans-serif;
        }

        .admin-header,
        .token-board,
        .panel-head {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .admin-header p,
        .panel-head p {
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
        .role-grid p,
        .token-board span {
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
        button,
        .sticky-actions button {
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

        .token-board,
        .summary-grid article,
        .role-grid article,
        .panel,
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

        .token-board label,
        .check {
          display: grid;
          gap: 6px;
          color: #475569;
          font-size: 0.76rem;
          font-weight: 900;
        }

        input,
        select {
          width: 100%;
          min-height: 38px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          color: #172554;
          font: inherit;
        }

        .check {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .check input {
          width: 18px;
          min-height: 18px;
        }

        .notice {
          margin-bottom: 16px;
          padding: 12px 14px;
          color: #1d4ed8;
          font-size: 0.86rem;
          font-weight: 850;
        }

        .summary-grid,
        .role-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .role-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .summary-grid article,
        .role-grid article,
        .panel {
          padding: 18px;
        }

        .summary-grid span,
        .role-grid span {
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 900;
        }

        .summary-grid strong {
          display: block;
          margin-top: 8px;
          font-size: 1.5rem;
        }

        .role-grid h2,
        .panel h2 {
          margin: 6px 0 8px;
          font-size: 1.04rem;
          letter-spacing: 0;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }

        th,
        td {
          border-bottom: 1px solid #e2e8f0;
          padding: 10px;
          text-align: left;
          vertical-align: middle;
        }

        th {
          color: #64748b;
          font-size: 0.74rem;
          text-transform: uppercase;
        }

        .sticky-actions {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 20;
          padding: 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.16);
        }

        @media (max-width: 1120px) {
          .role-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .access-admin {
            padding: 20px 14px 90px;
          }

          .admin-header,
          .token-board,
          .panel-head {
            flex-direction: column;
            align-items: stretch;
          }

          .summary-grid,
          .role-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
