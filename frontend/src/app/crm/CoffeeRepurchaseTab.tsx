"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import styles from "./page.module.css";
import { API_BASE, fmtDate, fmtKRW, fmtNum } from "./crm-utils";
import { SummaryCard } from "./SummaryCard";
import { CoffeeAbTestSection } from "./CoffeeAbTestSection";

type RepurchaseCandidate = {
  memberCode: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string;
  lastOrderDate: string;
  daysSinceLastPurchase: number;
  avgOrderAmount: number;
  consentSms: boolean;
  consentEmail: boolean;
};

export function CoffeeRepurchaseTab() {
  const [candidates, setCandidates] = useState<RepurchaseCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minDays, setMinDays] = useState(30);
  const [maxDays, setMaxDays] = useState(180);
  const [minOrders, setMinOrders] = useState(1);
  const [maxOrders, setMaxOrders] = useState(9999);
  const [tableShowCount, setTableShowCount] = useState(30);
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      `${API_BASE}/api/crm-local/repurchase-candidates?site=thecleancoffee&minDaysSinceLastPurchase=${minDays}&maxDaysSinceLastPurchase=${maxDays}&minPurchaseCount=${minOrders}&limit=5000`,
      { signal: ac.signal },
    )
      .then((r) => { if (!r.ok) throw new Error(`API 오류 (${r.status})`); return r.json(); })
      .then((d) => {
        const all: RepurchaseCandidate[] = d.candidates ?? [];
        setCandidates(maxOrders < 9999 ? all.filter((c) => c.totalOrders <= maxOrders) : all);
      })
      .catch((err) => { if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다"); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [minDays, maxDays, minOrders, maxOrders]);

  const consentCount = candidates.filter((c) => c.consentSms).length;
  const avgDays = candidates.length > 0
    ? Math.round(candidates.reduce((s, c) => s + c.daysSinceLastPurchase, 0) / candidates.length)
    : 0;
  const totalRevenue = candidates.reduce((s, c) => s + c.totalSpent, 0);

  const createGroupAndGoMessaging = async (
    targetCustomers: RepurchaseCandidate[],
    channel: "alimtalk" | "sms",
    adminOverride: boolean,
  ) => {
    if (sending) return;
    const withPhone = targetCustomers.filter((c) => c.phone);
    if (withPhone.length === 0) { alert("발송 가능한 연락처가 없습니다."); return; }
    setSending(true);
    try {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const scope = adminOverride ? "전체" : "동의";
      const channelLabel = channel === "alimtalk" ? "알림톡" : "SMS";
      const groupName = `[임시] 재구매 ${scope} ${minDays}~${maxDays}일 ${channelLabel} ${hhmm}`;
      const description = `재구매 관리 탭 자동 생성 · ${minDays}~${maxDays}일 미구매 · ${minOrders}회 이상 구매 · ${withPhone.length}명`;
      // Phase D: group_kind='repurchase_temp' + source_ref로 재클릭 중복 식별
      const sourceRef = `repurchase:thecleancoffee:${minDays}-${maxDays}:${minOrders}-${maxOrders}:${channel}:${adminOverride ? "admin" : "consent"}`;

      const createRes = await fetch(`${API_BASE}/api/crm-local/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          description,
          kind: "repurchase_temp",
          sourceRef,
        }),
      }).then((r) => r.json());
      if (!createRes.ok || !createRes.group?.group_id) {
        throw new Error(createRes.error ?? "그룹 생성 실패");
      }
      const groupId: string = createRes.group.group_id;

      const members = withPhone.map((c) => ({
        phone: c.phone,
        name: c.name || undefined,
        member_code: c.memberCode || undefined,
      }));
      const addRes = await fetch(`${API_BASE}/api/crm-local/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      }).then((r) => r.json());
      if (!addRes.ok) throw new Error(addRes.error ?? "멤버 추가 실패");

      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "messaging");
      params.set("groupId", groupId);
      params.set("channel", channel);
      if (adminOverride) params.set("adminOverride", "true");
      params.delete("phone");
      params.delete("name");
      params.delete("memberCode");
      params.delete("daysSince");
      router.replace(`?${params.toString()}`, { scroll: false });
    } catch (err) {
      alert(`발송 준비 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendToMessaging = (channel: "alimtalk" | "sms") => {
    const eligible = candidates.filter((c) => c.consentSms);
    return createGroupAndGoMessaging(eligible, channel, false);
  };

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>재구매 관리</h2>
            <p className={styles.sectionDesc}>
              첫 구매 후 재구매하지 않은 고객을 찾아 알림톡 등으로 재방문을 유도한다.
            </p>
          </div>
        </div>

        <div style={{ padding: "14px 18px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>마지막 구매 후 최소 경과일</label>
              <select className={styles.controlSelect} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))}>
                {[0, 7, 14, 30, 60, 90, 120, 180].map((d) => <option key={d} value={d}>{d === 0 ? "제한 없음" : `${d}일`}</option>)}
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>마지막 구매 후 최대 경과일</label>
              <select className={styles.controlSelect} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))}>
                {[90, 180, 365, 730, 9999].map((d) => <option key={d} value={d}>{d >= 9999 ? "제한 없음" : `${d}일`}</option>)}
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>최소 구매 횟수 (이 횟수 이상 산 고객)</label>
              <select className={styles.controlSelect} value={minOrders} onChange={(e) => setMinOrders(Number(e.target.value))}>
                {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}회 이상</option>)}
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>최대 구매 횟수 (이 횟수 이하만)</label>
              <select className={styles.controlSelect} value={maxOrders} onChange={(e) => setMaxOrders(Number(e.target.value))}>
                {[1, 2, 3, 5, 10, 9999].map((n) => <option key={n} value={n}>{n >= 9999 ? "제한 없음" : `${n}회 이하`}</option>)}
              </select>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.5 }}>
            예: 경과일 30~180일 + 구매 1~2회 = "1~2번 사고 1~6개월째 안 사는 고객" (이탈 위험 고객)
          </p>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>재구매 후보를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className={styles.summaryGrid}>
              <SummaryCard label="재구매 후보" value={`${fmtNum(candidates.length)}명`} sub={`${minDays}~${maxDays}일 미구매`} />
              <SummaryCard label="발송 가능" value={`${fmtNum(consentCount)}명`} sub="SMS 동의 고객" tone={consentCount > 0 ? "success" : "warn"} />
              <SummaryCard label="평균 미구매일" value={`${avgDays}일`} sub="마지막 구매 후 경과" />
              <SummaryCard label="후보 누적 매출" value={fmtKRW(totalRevenue)} sub={`평균 ${fmtKRW(candidates.length > 0 ? Math.round(totalRevenue / candidates.length) : 0)}/명`} />
            </div>

            {candidates.length === 0 ? (
              <div className={styles.empty}>해당 조건의 재구매 후보가 없습니다.</div>
            ) : (
              <div className={styles.tableScroll} style={{ marginTop: 18 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>고객번호</th>
                      <th>고객명</th>
                      <th>연락처</th>
                      <th className={styles.tableCellRight}>구매 횟수</th>
                      <th className={styles.tableCellRight}>총 매출</th>
                      <th>마지막 구매</th>
                      <th className={styles.tableCellRight}>미구매일</th>
                      <th>SMS 동의</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, tableShowCount).map((c) => (
                      <tr key={c.memberCode} className={styles.tableRow}>
                        <td style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "monospace" }}>{c.memberCode}</td>
                        <td><strong>{c.name || "-"}</strong></td>
                        <td className={styles.phone}>{c.phone}</td>
                        <td className={styles.tableCellRight}>{c.totalOrders}회</td>
                        <td className={styles.tableCellRight}>{fmtKRW(c.totalSpent)}</td>
                        <td>{fmtDate(c.lastOrderDate)}</td>
                        <td className={styles.tableCellRight} style={{
                          color: c.daysSinceLastPurchase > 90 ? "var(--color-danger)" : c.daysSinceLastPurchase > 60 ? "var(--color-accent)" : "var(--color-text-primary)",
                          fontWeight: 600,
                        }}>
                          {c.daysSinceLastPurchase}일
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${c.consentSms ? styles.statusCompleted : styles.statusOther}`}>
                            {c.consentSms ? "동의" : "미동의"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {candidates.length > tableShowCount ? (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <button type="button" onClick={() => setTableShowCount((p) => p + 50)} className={styles.retryButton} style={{ fontSize: "0.78rem" }}>
                      더 보기 ({fmtNum(tableShowCount)}/{fmtNum(candidates.length)}명 표시 중)
                    </button>
                  </div>
                ) : candidates.length > 30 ? (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <button type="button" onClick={() => setTableShowCount(30)} className={styles.retryButton} style={{ fontSize: "0.78rem" }}>
                      접기 (전체 {fmtNum(candidates.length)}명)
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {candidates.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={styles.retryButton}
                    style={{ background: "var(--color-primary)", color: "#fff", border: "none", opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer" }}
                    disabled={sending || consentCount === 0}
                    onClick={() => handleSendToMessaging("alimtalk")}
                  >
                    {sending ? "그룹 생성 중..." : `카카오 알림톡 발송 (${consentCount}명) →`}
                  </button>
                  <button
                    type="button"
                    className={styles.retryButton}
                    style={{ background: "#6366f1", color: "#fff", border: "none", opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer" }}
                    disabled={sending || consentCount === 0}
                    onClick={() => handleSendToMessaging("sms")}
                  >
                    {sending ? "그룹 생성 중..." : `SMS 문자 발송 (${consentCount}명) →`}
                  </button>
                  <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                    SMS 동의 고객만 대상. 알림톡 실패 시 SMS fallback 권장.
                  </span>
                </div>

                {candidates.length > consentCount && (
                  <div style={{
                    padding: "12px 16px", borderRadius: 10,
                    background: "#fffbeb", border: "1px solid #fde68a",
                    display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: "0.78rem", color: "#92400e", fontWeight: 600 }}>
                      미동의 고객 {candidates.length - consentCount}명 포함 전체 발송 (관리자 권한)
                    </span>
                    <button
                      type="button"
                      className={styles.retryButton}
                      style={{ background: "#d97706", color: "#fff", border: "none", fontSize: "0.78rem", padding: "8px 14px", opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer" }}
                      disabled={sending}
                      onClick={() => createGroupAndGoMessaging(candidates, "alimtalk", true)}
                    >
                      {sending ? "그룹 생성 중..." : `전체 알림톡 (${candidates.length}명, 관리자) →`}
                    </button>
                    <button
                      type="button"
                      className={styles.retryButton}
                      style={{ background: "#92400e", color: "#fff", border: "none", fontSize: "0.78rem", padding: "8px 14px", opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer" }}
                      disabled={sending}
                      onClick={() => createGroupAndGoMessaging(candidates, "sms", true)}
                    >
                      {sending ? "그룹 생성 중..." : `전체 SMS (${candidates.length}명, 관리자) →`}
                    </button>
                    <span style={{ fontSize: "0.68rem", color: "#b45309" }}>
                      정보성 메시지만 가능. 홍보성은 동의 고객만 발송 가능.
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <CoffeeAbTestSection minDays={minDays} maxDays={maxDays} minOrders={minOrders} candidates={candidates} />

      {candidates.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>전환율 가설 — 동의 고객 vs 미동의 고객</h2>
              <p className={styles.sectionDesc}>
                발송 후 결과 분석 시, 아래 가설을 기준으로 동의/미동의 그룹의 전환율을 비교한다.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: 18, borderRadius: 14, background: "linear-gradient(180deg, #f0fdf4, #fff)", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>SMS 동의 고객</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#15803d", marginTop: 8 }}>{fmtNum(consentCount)}명</div>
              <div style={{ marginTop: 12, fontSize: "0.82rem", lineHeight: 1.7, color: "#166534" }}>
                <div><strong>예상 전환율: 15~25%</strong></div>
                <div style={{ fontSize: "0.76rem", color: "#4ade80", marginTop: 4 }}>
                  근거: 마케팅 수신에 동의한 고객은 브랜드 호감도가 높고, 아임웹 장바구니 캠페인에서도 동의 고객 구매 전환율 25% 확인됨.
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#dcfce7", fontSize: "0.76rem", color: "#166534" }}>
                예상 매출: {fmtKRW(Math.round(consentCount * 0.20 * (totalRevenue / (candidates.length || 1))))}
                <span style={{ fontSize: "0.68rem", marginLeft: 4 }}>(전환 20% × 평균 {fmtKRW(Math.round(totalRevenue / (candidates.length || 1)))})</span>
              </div>
            </div>

            <div style={{ padding: 18, borderRadius: 14, background: "linear-gradient(180deg, #fffbeb, #fff)", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>SMS 미동의 고객 (관리자 발송)</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#92400e", marginTop: 8 }}>{fmtNum(candidates.length - consentCount)}명</div>
              <div style={{ marginTop: 12, fontSize: "0.82rem", lineHeight: 1.7, color: "#78350f" }}>
                <div><strong>예상 전환율: 5~10%</strong></div>
                <div style={{ fontSize: "0.76rem", color: "#d97706", marginTop: 4 }}>
                  근거: 마케팅 수신을 거부한 고객은 브랜드 이탈 가능성이 높음. 다만 정보성 메시지(상품 입고 안내 등)는 법적으로 발송 가능하며, 재구매 의향이 완전히 0은 아님.
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#fef3c7", fontSize: "0.76rem", color: "#92400e" }}>
                예상 매출: {fmtKRW(Math.round((candidates.length - consentCount) * 0.07 * (totalRevenue / (candidates.length || 1))))}
                <span style={{ fontSize: "0.68rem", marginLeft: 4 }}>(전환 7% × 평균 {fmtKRW(Math.round(totalRevenue / (candidates.length || 1)))})</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#f1f5f9", fontSize: "0.76rem", color: "#64748b", lineHeight: 1.7 }}>
            <strong>분석 방법:</strong> 발송 후 7~14일 뒤, 발송 로그(aligo-sends.jsonl)의 <code>consentStatus</code> 필드와 주문 데이터를 조인하여 동의/미동의 그룹별 구매 전환율을 비교한다. 발송 로그에 동의 상태가 자동 기록됨.
          </div>
        </section>
      )}

      {candidates.length > 0 && (() => {
        const buckets = [
          { label: "30~60일", min: 30, max: 60, rate: "18~25%", rateMid: 0.22, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", reason: "최근 구매 기억이 생생. 재구매 의향 가장 높음" },
          { label: "61~90일", min: 61, max: 90, rate: "10~18%", rateMid: 0.14, color: "#d97706", bg: "#fffbeb", border: "#fde68a", reason: "구매 습관이 약해지는 시점. 리마인드 효과 큼" },
          { label: "91~180일", min: 91, max: 180, rate: "5~10%", rateMid: 0.07, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", reason: "이탈 위험 구간. 쿠폰/할인 없으면 복구 어려움" },
        ];
        const avgSpent = candidates.length > 0 ? totalRevenue / candidates.length : 0;
        return (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>전환율 가설 — 마지막 구매 경과일별</h2>
                <p className={styles.sectionDesc}>
                  최근 구매한 고객일수록 전환율이 높을 것이다. 발송 후 구간별 실제 전환율과 비교한다.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {buckets.map((b) => {
                const count = candidates.filter((c) => c.daysSinceLastPurchase >= b.min && c.daysSinceLastPurchase <= b.max).length;
                const consentInBucket = candidates.filter((c) => c.daysSinceLastPurchase >= b.min && c.daysSinceLastPurchase <= b.max && c.consentSms).length;
                return (
                  <div key={b.label} style={{ padding: 16, borderRadius: 14, background: b.bg, border: `1px solid ${b.border}` }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: b.color, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      마지막 구매 {b.label} 전
                    </div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: b.color, marginTop: 6 }}>{fmtNum(count)}명</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>동의 {consentInBucket}명</div>
                    <div style={{ marginTop: 10, fontSize: "0.82rem", fontWeight: 700, color: b.color }}>예상 전환율: {b.rate}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>{b.reason}</div>
                    <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.7)", fontSize: "0.72rem", color: b.color }}>
                      예상 매출: {fmtKRW(Math.round(count * b.rateMid * avgSpent))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, background: "#f1f5f9", fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5 }}>
              <strong>결과 비교 방법:</strong> 발송 로그에 각 고객의 <code>daysSinceLastPurchase</code>가 기록됨.
              발송 후 14일 뒤, 경과일 구간별 구매 전환율을 산출하여 위 가설과 비교한다.
            </div>
          </section>
        );
      })()}

      <section className={styles.section} style={{ background: "linear-gradient(180deg, rgba(238,242,255,0.5), rgba(255,255,255,0.9))", border: "1px solid rgba(99,102,241,0.15)" }}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>생일 축하 쿠폰 — 검토 결과</h2>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }}>
          <span style={{ fontSize: "1.2rem", padding: "8px 12px", borderRadius: 10, background: "#fef3c7" }}>
            {"⚠️"}
          </span>
          <div style={{ fontSize: "0.84rem", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
            <strong style={{ color: "#dc2626" }}>더클린커피 생일 쿠폰: 현재 불가</strong>
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <strong>문제:</strong> 더클린커피 회원 13,253명 중 <strong>생일 입력자 1명 (0.0%)</strong>.
              회원가입 시 생일 입력을 요구하지 않아서 데이터가 없음.
              <br /><span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>참고: 바이오컴은 검사키트 구매 시 생일 필수라 94% 입력됨 (65,714명).</span>
            </div>
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
              <strong>생일 쿠폰을 하려면:</strong>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                <li><strong>선행 조건:</strong> 아임웹 회원가입 폼에 생일 필드 추가 (필수 또는 권장)</li>
                <li><strong>단기:</strong> "생일을 알려주시면 특별 쿠폰을 드립니다" 캠페인으로 기존 회원 생일 수집</li>
                <li><strong>장기:</strong> 생일 입력률이 30% 이상이 되면 생일 쿠폰 자동화 시작</li>
              </ul>
            </div>
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <strong>바이오컴은 즉시 가능:</strong> 65,714명 생일 보유. 이번 달 생일 고객에게 쿠폰 발급 + 알림톡 발송 가능.
              <br /><span style={{ fontSize: "0.76rem", color: "#16a34a" }}>API: <code>GET /api/crm-local/birthday-members?site=biocom&month=4</code></span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.interpretBlock}>
        <strong>더클린커피 재구매 관리가 왜 중요한가?</strong>
        <p>
          재구매 고객은 1회 구매자보다 평균 2.3배 더 쓴다.
          상담 서비스가 없는 더클린커피에서는 주문 데이터 기반 재구매 유도가 핵심 CRM 전략이다.
        </p>
      </section>
    </>
  );
}
