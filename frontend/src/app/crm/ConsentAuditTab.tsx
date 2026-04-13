"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./page.module.css";
import { API_BASE, fmtDateTime } from "./crm-utils";

type ConsentEntry = {
  id: number;
  site: string;
  member_code: string;
  phone: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  source: string;
  changed_at: string;
  note: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  marketing_agree_sms: "SMS 수신 동의",
  marketing_agree_email: "이메일 수신 동의",
  marketing_agree_call: "전화 수신 동의",
};

const SOURCE_LABELS: Record<string, string> = {
  imweb_sync: "아임웹 동기화",
  manual: "수동 변경",
  webhook: "웹훅",
  admin: "관리자",
};

const formatValue = (v: string | null): string => {
  if (v === null || v === undefined || v === "") return "(없음)";
  if (v === "Y") return "동의";
  if (v === "N") return "미동의";
  return v;
};

const formatField = (field: string) => FIELD_LABELS[field] ?? field;
const formatSource = (source: string) => SOURCE_LABELS[source] ?? source;

type NameLookupResult = {
  member_code: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

type SuccessBanner = {
  id: number;
  memberCode: string;
  field: string;
  newValue: string;
};

export function ConsentAuditTab() {
  const [entries, setEntries] = useState<ConsentEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  // 수동 변경 폼 상태
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualMemberCode, setManualMemberCode] = useState("");
  const [manualField, setManualField] = useState<"marketing_agree_sms" | "marketing_agree_email">("marketing_agree_sms");
  const [manualNewValue, setManualNewValue] = useState<"Y" | "N">("N");
  const [manualNote, setManualNote] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // 이름으로 고객 찾기 (member_code 자동 채우기)
  const [nameLookup, setNameLookup] = useState("");
  const [nameLookupResults, setNameLookupResults] = useState<NameLookupResult[]>([]);
  const [nameLookupLoading, setNameLookupLoading] = useState(false);

  // 수동 변경 성공 시 화면 상단에 잠깐 뜨는 안내 배너
  const [successBanner, setSuccessBanner] = useState<SuccessBanner | null>(null);

  const load = useCallback(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      site: "thecleancoffee",
      limit: String(limit),
      offset: String(page * limit),
    });
    if (memberFilter.trim()) params.set("memberCode", memberFilter.trim());
    fetch(`${API_BASE}/api/crm-local/consent-audit?${params}`, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.ok) {
          setEntries(d.entries ?? []);
          setTotal(d.total ?? 0);
        } else {
          throw new Error(d.error ?? "감사 로그 조회 실패");
        }
      })
      .catch((err) => { if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "조회 실패"); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [memberFilter, page]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const handleSearch = () => {
    setMemberFilter(memberSearch);
    setPage(0);
  };

  const handleLookupByName = async () => {
    const q = nameLookup.trim();
    if (!q) return;
    setNameLookupLoading(true);
    try {
      const params = new URLSearchParams({
        site: "thecleancoffee",
        search: q,
        limit: "5",
      });
      const res = await fetch(`${API_BASE}/api/crm-local/customers?${params}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.customers)) {
        setNameLookupResults(
          data.customers.map((c: Record<string, unknown>) => ({
            member_code: String(c.member_code ?? ""),
            name: (c.name as string | null) ?? null,
            phone: (c.phone as string | null) ?? null,
            email: (c.email as string | null) ?? null,
          })),
        );
      } else {
        setNameLookupResults([]);
      }
    } catch {
      setNameLookupResults([]);
    } finally {
      setNameLookupLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    setManualError(null);
    if (!manualMemberCode.trim()) { setManualError("고객번호를 입력해 주세요."); return; }
    if (manualNote.trim().length < 3) { setManualError("사유를 최소 3자 이상 입력해 주세요 (법적 증빙 용도)."); return; }
    setManualSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/consent-audit/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberCode: manualMemberCode.trim(),
          field: manualField,
          newValue: manualNewValue,
          note: manualNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const errs = Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors.map((e: { message?: string }) => e.message).filter(Boolean).join(" / ")
          : undefined;
        throw new Error(errs || data.error || `API ${res.status}`);
      }
      // 성공 → 상단 배너 표시 + 폼 초기화 + 해당 고객 필터
      setSuccessBanner({
        id: data.entry?.id ?? 0,
        memberCode: manualMemberCode.trim(),
        field: manualField,
        newValue: manualNewValue,
      });
      setShowManualForm(false);
      const savedMemberCode = manualMemberCode.trim();
      setManualMemberCode("");
      setManualNote("");
      setManualField("marketing_agree_sms");
      setManualNewValue("N");
      setNameLookup("");
      setNameLookupResults([]);
      setMemberSearch(savedMemberCode);
      setMemberFilter(savedMemberCode);
      setPage(0);
      // 8초 후 배너 자동 숨김
      setTimeout(() => setSuccessBanner(null), 8000);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "수동 변경 실패");
    } finally {
      setManualSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>수신거부 처리</h2>
          <p style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 2, marginBottom: 4 }}>
            (동의 감사 로그)
          </p>
          <p className={styles.sectionDesc}>
            고객이 전화·이메일로 "문자 그만 보내주세요" 라고 요청했을 때 여기서 처리합니다.
            모든 변경 이력은 법적 증빙용으로 자동 기록됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowManualForm((v) => !v); setManualError(null); }}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: "1px solid #d97706", background: showManualForm ? "#fef3c7" : "#fff",
            color: "#92400e", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
          }}
        >
          {showManualForm ? "폼 닫기" : "+ 새 수신거부 처리"}
        </button>
      </div>

      {/* 성공 안내 배너 (8초 후 자동 사라짐) */}
      {successBanner && (
        <div
          role="status"
          style={{
            marginBottom: 16, padding: "12px 18px", borderRadius: 10,
            background: "#f0fdf4", border: "1px solid #86efac",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>✓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#166534" }}>
              처리 완료
            </div>
            <div style={{ fontSize: "0.76rem", color: "#15803d", marginTop: 2 }}>
              고객 <code style={{ fontFamily: "monospace" }}>{successBanner.memberCode.slice(0, 14)}...</code>의{" "}
              {FIELD_LABELS[successBanner.field] ?? successBanner.field}를{" "}
              <strong>{successBanner.newValue === "N" ? "미동의(수신거부)" : "동의"}</strong>로 변경했습니다.
              감사 로그 #{successBanner.id}에 기록되었습니다.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="알림 닫기"
            style={{
              padding: "4px 10px", borderRadius: 4, border: "none",
              background: "transparent", color: "#16a34a", fontSize: "0.74rem",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      )}

      {showManualForm && (
        <div style={{
          marginBottom: 16, padding: 18, borderRadius: 12,
          background: "#fffbeb", border: "1px solid #fde68a",
        }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#92400e", marginBottom: 10 }}>
            수신거부 처리 — 감사 로그에 자동 기록
          </div>
          <div style={{ fontSize: "0.76rem", color: "#b45309", marginBottom: 12, lineHeight: 1.7 }}>
            고객이 전화로 "문자 그만 보내달라"고 요청하거나, 이메일·문의로 수신거부를 알려온 경우 여기서 처리합니다.
            변경 내용은 법적 증빙용으로 자동 저장되고, 앞으로 발송 시 이 고객은 자동으로 제외됩니다.
          </div>

          {/* 이름으로 고객 찾기 — 미니 검색 */}
          <div style={{
            padding: 12, borderRadius: 8, background: "#fff", border: "1px solid #fde68a",
            marginBottom: 12,
          }}>
            <label className={styles.controlLabel} htmlFor="manual-name-lookup" style={{ marginBottom: 4 }}>
              고객 찾기 (이름·전화번호로 검색)
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                id="manual-name-lookup"
                type="text"
                value={nameLookup}
                onChange={(e) => setNameLookup(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLookupByName(); } }}
                placeholder="예: 김민수 또는 01012345678"
                className={styles.controlSelect}
                style={{ flex: 1, fontSize: "0.78rem" }}
              />
              <button
                type="button"
                onClick={handleLookupByName}
                disabled={nameLookupLoading || !nameLookup.trim()}
                style={{
                  padding: "6px 14px", borderRadius: 6, border: "1px solid #d97706",
                  background: "#fff", color: "#92400e", fontSize: "0.76rem", fontWeight: 600,
                  cursor: nameLookupLoading ? "not-allowed" : "pointer",
                }}
              >
                {nameLookupLoading ? "찾는 중..." : "찾기"}
              </button>
            </div>
            {nameLookupResults.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {nameLookupResults.map((r) => (
                  <button
                    key={r.member_code}
                    type="button"
                    onClick={() => {
                      setManualMemberCode(r.member_code);
                      setNameLookupResults([]);
                      setNameLookup(r.name || r.member_code);
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
                      background: "#f8fafc", textAlign: "left", cursor: "pointer", fontSize: "0.74rem",
                    }}
                  >
                    <strong style={{ color: "#0f172a" }}>{r.name || "(이름 없음)"}</strong>
                    <span style={{ marginLeft: 6, color: "#64748b", fontFamily: "monospace" }}>{r.phone ?? "-"}</span>
                    <span style={{ marginLeft: 6, color: "#94a3b8", fontFamily: "monospace", fontSize: "0.7rem" }}>
                      {r.member_code.slice(0, 14)}...
                    </span>
                  </button>
                ))}
              </div>
            )}
            {nameLookup.trim() && !nameLookupLoading && nameLookupResults.length === 0 && (
              <div style={{ marginTop: 6, fontSize: "0.7rem", color: "#94a3b8" }}>
                "찾기"를 눌러 검색하거나, 아래에 고객번호를 직접 입력해 주세요.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="manual-member-code">고객번호 (member_code)</label>
              <input
                id="manual-member-code"
                type="text"
                value={manualMemberCode}
                onChange={(e) => setManualMemberCode(e.target.value)}
                placeholder="위에서 '고객 찾기'로 자동 채우거나, 고객 목록 탭에서 복사한 값을 붙여넣기"
                className={styles.controlSelect}
                style={{ fontFamily: "monospace", fontSize: "0.78rem" }}
              />
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="manual-field">어떤 동의를 변경할까요?</label>
              <select
                id="manual-field"
                value={manualField}
                onChange={(e) => setManualField(e.target.value as "marketing_agree_sms" | "marketing_agree_email")}
                className={styles.controlSelect}
              >
                <option value="marketing_agree_sms">SMS 수신 동의</option>
                <option value="marketing_agree_email">이메일 수신 동의</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel} htmlFor="manual-new-value">변경할 상태</label>
              <select
                id="manual-new-value"
                value={manualNewValue}
                onChange={(e) => setManualNewValue(e.target.value as "Y" | "N")}
                className={styles.controlSelect}
              >
                <option value="N">수신거부 (Y→N)</option>
                <option value="Y">동의 복원 (N→Y)</option>
              </select>
            </div>
          </div>
          <div className={styles.controlGroup} style={{ marginBottom: 10 }}>
            <label className={styles.controlLabel} htmlFor="manual-note">사유 (최소 3자, 필수 — 법적 증빙)</label>
            <textarea
              id="manual-note"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="예: 2026-04-13 고객이 전화로 수신거부 요청, 본인 확인 완료"
              rows={2}
              className={styles.controlSelect}
              style={{ width: "100%", resize: "vertical", fontSize: "0.78rem" }}
            />
          </div>

          {manualError && (
            <div style={{
              marginBottom: 10, padding: "8px 12px", borderRadius: 6,
              background: "#fef2f2", border: "1px solid #fecaca",
              fontSize: "0.76rem", color: "#991b1b",
            }}>
              {manualError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => { setShowManualForm(false); setManualError(null); }}
              disabled={manualSubmitting}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "1px solid #e2e8f0",
                background: "#fff", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={manualSubmitting}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "none",
                background: manualSubmitting ? "#94a3b8" : "#d97706", color: "#fff",
                fontSize: "0.8rem", fontWeight: 700, cursor: manualSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {manualSubmitting ? "저장 중..." : "변경 저장 (감사 로그 기록)"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>고객번호 검색 (member_code)</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className={styles.controlSelect}
              style={{ minWidth: 220, fontFamily: "monospace", fontSize: "0.78rem" }}
              placeholder="m20230512ef2c28c5a4f3a"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
            <button
              type="button"
              onClick={handleSearch}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", cursor: "pointer", fontSize: "0.82rem" }}
            >
              검색
            </button>
            {memberFilter && (
              <button
                type="button"
                onClick={() => { setMemberSearch(""); setMemberFilter(""); setPage(0); }}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.82rem", color: "#64748b" }}
              >
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", marginBottom: 12 }}>
        총 {total.toLocaleString("ko-KR")}건{memberFilter ? ` · 필터: ${memberFilter}` : ""}
      </p>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>감사 로그를 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className={styles.errorBox}>
          <strong>조회 실패</strong>
          <p>{error}</p>
          <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
            백엔드에 <code>/api/crm-local/consent-audit</code> 엔드포인트가 아직 배포되지 않았을 수 있습니다.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          {memberFilter
            ? `고객번호 "${memberFilter}"의 수신거부/동의 변경 이력이 아직 없습니다.`
            : "아직 처리된 수신거부 이력이 없습니다. 위 '+ 새 수신거부 처리' 버튼으로 첫 건을 등록해 보세요."}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>변경 시각</th>
                  <th>고객번호</th>
                  <th>전화번호</th>
                  <th>항목</th>
                  <th>변경 전</th>
                  <th>변경 후</th>
                  <th>출처</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className={styles.tableRow}>
                    <td style={{ fontSize: "0.76rem", whiteSpace: "nowrap" }}>{fmtDateTime(e.changed_at)}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#64748b" }}>{e.member_code}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.76rem" }}>{e.phone || "-"}</td>
                    <td>{formatField(e.field)}</td>
                    <td>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.72rem", background: "#f1f5f9", color: "#475569" }}>
                        {formatValue(e.old_value)}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 600,
                        background: e.new_value === "Y" ? "#dcfce7" : e.new_value === "N" ? "#fee2e2" : "#f1f5f9",
                        color: e.new_value === "Y" ? "#166534" : e.new_value === "N" ? "#991b1b" : "#475569",
                      }}>
                        {formatValue(e.new_value)}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "#64748b" }}>{formatSource(e.source)}</td>
                    <td style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{e.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1, fontSize: "0.82rem" }}
            >
              이전
            </button>
            <span style={{ fontSize: "0.82rem", lineHeight: "32px", color: "var(--color-text-secondary)" }}>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
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
