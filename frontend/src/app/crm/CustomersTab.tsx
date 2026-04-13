"use client";

import { useEffect, useState } from "react";

import styles from "./page.module.css";
import { API_BASE, fmtKRW, fmtNum } from "./crm-utils";

type CustomerRow = {
  member_code: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  member_grade: string | null;
  join_time: string | null;
  marketing_agree_sms: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string | null;
};

type GradeOption = { grade: string; count: number };

export function CustomersTab() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [grade, setGrade] = useState("");
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetch(`${API_BASE}/api/crm-local/grades?site=thecleancoffee`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGrades(d.grades ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ site: "thecleancoffee", limit: String(limit), offset: String(page * limit) });
    if (search) params.set("search", search);
    if (grade) params.set("grade", grade);
    fetch(`${API_BASE}/api/crm-local/customers?${params}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setCustomers(d.customers ?? []); setTotal(d.total ?? 0); } })
      .catch((err) => { if (!ac.signal.aborted) console.error(err); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [search, grade, page]);

  const totalPages = Math.ceil(total / limit);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleCsvDownload = () => {
    const header = ["이름", "전화번호", "이메일", "쇼핑등급", "가입일", "구매횟수", "누적구매금액", "SMS동의"];
    const rows = customers.map((c) => [
      c.name ?? "",
      c.phone ?? "",
      c.email ?? "",
      c.member_grade ?? "",
      c.join_time ?? "",
      String(c.total_orders),
      String(c.total_spent),
      c.marketing_agree_sms === "Y" ? "동의" : "미동의",
    ]);
    const bom = "\uFEFF";
    const csv = bom + [header, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>고객 목록</h2>
        <button onClick={handleCsvDownload} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", cursor: "pointer", fontSize: "0.82rem" }}>
          엑셀 다운로드
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>검색 (이름/전화/이메일)</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className={styles.controlSelect}
              style={{ minWidth: 200 }}
              placeholder="검색어 입력..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
            <button onClick={handleSearch} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", cursor: "pointer", fontSize: "0.82rem" }}>
              검색
            </button>
          </div>
        </div>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>쇼핑등급</label>
          <select className={styles.controlSelect} value={grade} onChange={(e) => { setGrade(e.target.value); setPage(0); }}>
            <option value="">전체</option>
            {grades.map((g) => (
              <option key={g.grade} value={g.grade}>{g.grade} ({fmtNum(g.count)}명)</option>
            ))}
          </select>
        </div>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", marginBottom: 12 }}>
        총 {fmtNum(total)}명{search ? ` (검색: "${search}")` : ""}{grade ? ` · 등급: ${grade}` : ""}
      </p>
      {loading ? (
        <p style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>불러오는 중...</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>이름</th><th>전화번호</th><th>이메일</th><th>쇼핑등급</th><th>가입일</th><th>구매횟수</th><th>누적구매금액</th><th>SMS동의</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.member_code} className={styles.tableRow}>
                    <td>{c.name ?? "-"}</td>
                    <td>{c.phone ?? "-"}</td>
                    <td>{c.email ?? "-"}</td>
                    <td>{c.member_grade ?? "-"}</td>
                    <td>{c.join_time ? c.join_time.slice(0, 10) : "-"}</td>
                    <td style={{ textAlign: "right" }}>{fmtNum(c.total_orders)}</td>
                    <td style={{ textAlign: "right" }}>{fmtKRW(c.total_spent)}</td>
                    <td>{c.marketing_agree_sms === "Y" ? "동의" : "미동의"}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)" }}>데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1, fontSize: "0.82rem" }}
            >
              이전
            </button>
            <span style={{ fontSize: "0.82rem", lineHeight: "32px", color: "var(--color-text-secondary)" }}>
              {page + 1} / {Math.max(totalPages, 1)}
            </span>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", cursor: page + 1 >= totalPages ? "not-allowed" : "pointer", opacity: page + 1 >= totalPages ? 0.5 : 1, fontSize: "0.82rem" }}
            >
              다음
            </button>
          </div>
        </>
      )}
    </section>
  );
}
