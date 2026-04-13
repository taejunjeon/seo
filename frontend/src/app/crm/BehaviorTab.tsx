"use client";

import { useState } from "react";

import styles from "./page.module.css";
import { API_BASE, fmtNum } from "./crm-utils";
import { SegmentBuilder } from "./SegmentBuilder";

type SegmentDef = {
  key: string;
  name: string;
  description: string;
};

const SEGMENTS: SegmentDef[] = [
  { key: "no_repurchase", name: "재구매 하지 않음", description: "1회 구매 후 미구매 고객" },
  { key: "birthday_month", name: "이번 달 생일 고객", description: "이번 달이 생일인 회원" },
  { key: "high_spender", name: "누적 30만원 이상 구매", description: "총 구매금액이 30만원을 초과한 고객" },
  { key: "inactive_90d", name: "90일 이상 미활동", description: "마지막 주문 후 90일 이상 지난 고객" },
  { key: "new_member_30d", name: "최근 30일 신규 가입", description: "최근 30일 내 가입한 신규 회원" },
];

type SegmentCustomer = { member_code: string; name: string | null; phone: string | null; email: string | null };

export function BehaviorTab() {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [results, setResults] = useState<SegmentCustomer[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [queryLoading, setQueryLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);

  const handleQuery = (segmentKey: string) => {
    setSelectedSegment(segmentKey);
    setQueryLoading(true);
    setResults([]);
    setResultTotal(0);
    fetch(`${API_BASE}/api/crm-local/customers/segment-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: "thecleancoffee", segment: segmentKey }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setResults(d.customers ?? []);
          setResultTotal(d.total ?? 0);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setQueryLoading(false));
  };

  const handleCreateGroup = async () => {
    if (results.length === 0 || !selectedSegment) return;
    const seg = SEGMENTS.find((s) => s.key === selectedSegment);
    if (!seg) return;
    setCreating(true);
    try {
      const groupName = `${seg.name} (${new Date().toISOString().slice(0, 10)})`;
      const createRes = await fetch(`${API_BASE}/api/crm-local/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, description: seg.description }),
      }).then((r) => r.json());

      if (!createRes.ok) return;
      const groupId = createRes.group.group_id;

      const members = results.map((c) => ({
        phone: c.phone ?? "",
        name: c.name ?? undefined,
        member_code: c.member_code,
      })).filter((m) => m.phone);

      if (members.length > 0) {
        await fetch(`${API_BASE}/api/crm-local/groups/${groupId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ members }),
        });
      }
      alert(`그룹 "${groupName}"이 ${members.length}명으로 생성되었다.`);
    } catch (err) {
      console.error(err);
      alert("그룹 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const selectedDef = SEGMENTS.find((s) => s.key === selectedSegment);
  const preview = results.slice(0, 20);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>고객 행동 세그먼트</h2>
          <p style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
            아래 표는 자주 쓰는 조건 5가지를 미리 만들어 둔 것입니다.
            원하는 조건이 없으면 "커스텀 세그먼트 만들기"로 직접 조합할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCustomBuilder((v) => !v)}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: "1px solid #6366f1",
            background: showCustomBuilder ? "#eef2ff" : "#fff",
            color: "#4338ca", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
          }}
        >
          {showCustomBuilder ? "빌더 닫기" : "+ 커스텀 세그먼트 만들기"}
        </button>
      </div>

      {showCustomBuilder && (
        <SegmentBuilder
          site="thecleancoffee"
          onClose={() => setShowCustomBuilder(false)}
        />
      )}
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHead}>
              <th>세그먼트</th><th>설명</th><th>조회</th>
            </tr>
          </thead>
          <tbody>
            {SEGMENTS.map((seg) => (
              <tr key={seg.key} className={styles.tableRow} style={selectedSegment === seg.key ? { background: "var(--color-bg-hover, #f5f5f5)" } : undefined}>
                <td style={{ fontWeight: 600 }}>{seg.name}</td>
                <td style={{ color: "var(--color-text-secondary)", fontSize: "0.82rem" }}>{seg.description}</td>
                <td>
                  <button
                    onClick={() => handleQuery(seg.key)}
                    disabled={queryLoading}
                    style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", cursor: queryLoading ? "not-allowed" : "pointer", fontSize: "0.82rem" }}
                  >
                    조회
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSegment && (
        <div style={{ marginTop: 24 }}>
          <div className={styles.sectionHeader}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>
              {selectedDef?.name ?? selectedSegment} 조회 결과
            </h3>
            {results.length > 0 && (
              <button
                onClick={handleCreateGroup}
                disabled={creating}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-primary, #2563eb)", background: "var(--color-primary, #2563eb)", color: "#fff", cursor: creating ? "not-allowed" : "pointer", fontSize: "0.82rem" }}
              >
                {creating ? "생성 중..." : "이 고객으로 그룹 생성"}
              </button>
            )}
          </div>
          {queryLoading ? (
            <p style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)" }}>조회 중...</p>
          ) : (
            <>
              <p style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", marginBottom: 12 }}>
                총 {fmtNum(resultTotal)}명 {results.length > 20 ? `(상위 20명 미리보기)` : ""}
              </p>
              {results.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>이름</th><th>전화번호</th><th>이메일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((c) => (
                        <tr key={c.member_code} className={styles.tableRow}>
                          <td>{c.name ?? "-"}</td>
                          <td>{c.phone ?? "-"}</td>
                          <td>{c.email ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)" }}>해당 조건에 맞는 고객이 없다.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
