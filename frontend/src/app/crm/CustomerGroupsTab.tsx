"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./page.module.css";
import { API_BASE } from "./crm-utils";

type GroupInfo = { group_id: string; name: string; description: string | null; member_count: number; created_at: string; updated_at: string };
type GroupMember = { phone: string; name: string | null; member_code: string | null; consent_sms: boolean; added_at: string };

type BulkUploadResult = {
  ok: boolean;
  total_rows?: number;
  added?: number;
  skipped_duplicate?: number;
  skipped_invalid_phone?: number;
  errors?: Array<{ row_index: number; reason: string }>;
  error?: string;
};

type ScheduledSendRow = {
  id: number;
  group_id: string;
  channel: string;
  template_code: string | null;
  subject: string | null;
  message: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  total_count: number;
  success_count: number;
  fail_count: number;
  error_message: string | null;
  admin_override: number;
  test_mode: number;
  experiment_key: string | null;
  note: string | null;
};

export function CustomerGroupsTab() {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  // Phase D: kind 필터 + 임시 그룹 카운트
  const [kindFilter, setKindFilter] = useState<"manual" | "all">("manual");
  const [kindStats, setKindStats] = useState<{ manual: number; repurchase_temp: number; experiment_snapshot: number; segment_snapshot: number; archived: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPhones, setNewPhones] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [msgLog, setMsgLog] = useState<Array<Record<string, unknown>>>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [showLog, setShowLog] = useState(false);

  // 엑셀 업로드 상태
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 예약 발송 목록 상태
  const [showScheduled, setShowScheduled] = useState(false);
  const [scheduledRows, setScheduledRows] = useState<ScheduledSendRow[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  const loadScheduledSends = () => {
    setShowScheduled(true);
    setScheduledLoading(true);
    fetch(`${API_BASE}/api/crm-local/scheduled-sends?limit=100`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setScheduledRows(d.rows ?? []);
          setScheduledTotal(d.total ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setScheduledLoading(false));
  };

  const cancelScheduledSend = async (id: number) => {
    if (!confirm("이 예약 발송을 취소하시겠습니까?")) return;
    const res = await fetch(`${API_BASE}/api/crm-local/scheduled-sends/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) { alert(`취소 실패: ${data.error ?? "pending 상태에서만 취소 가능"}`); return; }
    loadScheduledSends();
  };

  const handleBulkUpload = async (file: File) => {
    if (!selectedGroup) { alert("먼저 그룹을 선택해 주세요."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하만 가능합니다."); return; }
    setUploading(true);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/crm-local/groups/${selectedGroup}/members/bulk-upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setUploadResult(data);
      if (data.ok) {
        // 멤버 리스트 + 그룹 인원수 새로고침
        fetch(`${API_BASE}/api/crm-local/groups/${selectedGroup}/members?limit=100`)
          .then((r) => r.json())
          .then((d) => { setMembers(d.members ?? []); setMembersTotal(d.total ?? 0); })
          .catch(() => {});
        loadGroups();
      }
    } catch (err) {
      setUploadResult({ ok: false, error: err instanceof Error ? err.message : "업로드 실패" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleBulkUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setUploadDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleBulkUpload(file);
  };

  const loadGroups = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("kind", kindFilter);
    fetch(`${API_BASE}/api/crm-local/groups?${params}`)
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // 그룹 종류별 카운트 (토글 뱃지용)
    fetch(`${API_BASE}/api/crm-local/groups/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.ok && d.counts) setKindStats(d.counts);
      })
      .catch(() => {});
  };

  useEffect(() => { loadGroups(); }, [kindFilter]);

  useEffect(() => {
    if (!selectedGroup) { setMembers([]); setMembersTotal(0); return; }
    setMembersLoading(true);
    fetch(`${API_BASE}/api/crm-local/groups/${selectedGroup}/members?limit=100`)
      .then((r) => r.json())
      .then((d) => { setMembers(d.members ?? []); setMembersTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [selectedGroup]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/groups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok && newPhones.trim()) {
        const phoneList = newPhones.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
        await fetch(`${API_BASE}/api/crm-local/groups/${data.group.group_id}/members`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ members: phoneList.map((p) => ({ phone: p })) }),
        });
      }
      setNewName(""); setNewDesc(""); setNewPhones(""); setShowCreate(false);
      loadGroups();
    } catch { /* ignore */ } finally { setCreating(false); }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm("이 그룹을 삭제하시겠습니까?")) return;
    await fetch(`${API_BASE}/api/crm-local/groups/${groupId}`, { method: "DELETE" });
    if (selectedGroup === groupId) setSelectedGroup(null);
    loadGroups();
  };

  const handleSendToGroup = (groupId: string) => {
    const params = new URLSearchParams();
    params.set("site", "thecleancoffee");
    params.set("tab", "messaging");
    params.set("groupId", groupId);
    params.set("channel", "sms");
    params.set("adminOverride", "true");
    window.location.search = params.toString();
  };

  const handleKakaoUpload = async (groupId: string, groupName: string) => {
    if (!confirm(`[${groupName}] 을(를) 카카오톡 채널 파트너센터에 고객파일로 업로드하시겠습니까?\n\n• 업로드 후 파트너센터 > 친구그룹 관리에서 조건별 필터 사용 가능\n• 발송은 파트너센터 UI에서 진행`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/groups/${groupId}/kakao-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: "thecleancoffee", fileName: groupName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const stageMsg = Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors.map((e: { stage: string; message: string }) => `[${e.stage}] ${e.message}`).join("\n")
          : (data.error ?? "업로드 실패");
        alert(`카카오 업로드 실패:\n${stageMsg}`);
        return;
      }
      alert(`카카오 업로드 성공\n\n파일 ID: ${data.fileId}\n등록: ${data.addedUsers}/${data.totalUsers}명\n\n파트너센터에서 친구그룹을 만들어 발송할 수 있습니다.`);
    } catch (err) {
      alert(`카카오 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  };

  const handleExportGroup = async (groupId: string, groupName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/groups/${groupId}/members.csv`);
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        alert(`내보내기 실패 (${res.status}): ${msg || "서버 오류"}`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const safeName = (groupName || groupId).replace(/[\\/:*?"<>|]/g, "_").slice(0, 50);
      const a = document.createElement("a");
      a.href = url;
      a.download = `고객그룹_${safeName}_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`내보내기 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  };

  const loadMsgLog = () => {
    setShowLog(true);
    fetch(`${API_BASE}/api/crm-local/message-log?limit=50`)
      .then((r) => r.json())
      .then((d) => { setMsgLog(d.messages ?? []); setMsgTotal(d.total ?? 0); })
      .catch(() => {});
  };

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>고객 그룹 목록</h2>
            <p className={styles.sectionDesc}>A/B 실험 생성 시 자동으로 그룹이 생성된다. 직접 그룹을 만들 수도 있다.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowCreate(!showCreate)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#fee500", color: "#3c1e1e", fontWeight: 700, fontSize: "0.82rem",
            }}>+ 신규그룹 만들기</button>
            <button onClick={loadMsgLog} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer",
              background: "#fff", color: "#475569", fontWeight: 600, fontSize: "0.82rem",
            }}>메시지 이력</button>
            <button onClick={loadScheduledSends} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #059669", cursor: "pointer",
              background: "#f0fdf4", color: "#059669", fontWeight: 600, fontSize: "0.82rem",
            }}>예약 발송</button>
          </div>
        </div>

        {/* Phase D: 임시 그룹 토글 */}
        <div style={{
          display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          padding: "10px 14px", borderRadius: 10, background: "#f8fafc",
          border: "1px solid #e2e8f0", marginBottom: 12, fontSize: "0.78rem",
        }}>
          <span style={{ color: "#475569", fontWeight: 600 }}>표시:</span>
          <button
            type="button"
            onClick={() => setKindFilter("manual")}
            style={{
              padding: "4px 12px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 600, cursor: "pointer",
              border: kindFilter === "manual" ? "1px solid #6366f1" : "1px solid #e2e8f0",
              background: kindFilter === "manual" ? "#eef2ff" : "#fff",
              color: kindFilter === "manual" ? "#4338ca" : "#64748b",
            }}
          >
            직접 만든 그룹만
            {kindStats ? ` (${kindStats.manual})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setKindFilter("all")}
            style={{
              padding: "4px 12px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 600, cursor: "pointer",
              border: kindFilter === "all" ? "1px solid #6366f1" : "1px solid #e2e8f0",
              background: kindFilter === "all" ? "#eef2ff" : "#fff",
              color: kindFilter === "all" ? "#4338ca" : "#64748b",
            }}
          >
            임시 그룹 포함
            {kindStats ? ` (+${kindStats.repurchase_temp + kindStats.experiment_snapshot + kindStats.segment_snapshot})` : ""}
          </button>
          {kindStats && kindStats.archived > 0 && (
            <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#94a3b8" }}>
              아카이브 {kindStats.archived}개 숨김
            </span>
          )}
          <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
            재구매 탭이나 A/B 실험에서 자동 생성된 그룹은 임시 그룹으로 분류되어, 기본 화면에서는 숨겨집니다.
          </span>
        </div>

        {showCreate && (
          <div style={{ padding: 18, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 16 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 12 }}>신규그룹 만들기</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>그룹명</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="그룹명을 입력하세요"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }} />
                <div style={{ textAlign: "right", fontSize: "0.68rem", color: "#94a3b8" }}>{newName.length}/20자</div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>그룹 설명</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="그룹 설명을 입력하세요"
                  rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4, resize: "vertical" }} />
                <div style={{ textAlign: "right", fontSize: "0.68rem", color: "#94a3b8" }}>{newDesc.length}/60자</div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>전화번호 직접 입력</label>
                <textarea value={newPhones} onChange={(e) => setNewPhones(e.target.value)}
                  placeholder={"전화번호를 한 줄에 하나씩 추가해주세요.\nex)\n010-0000-0000\n010-1111-1111"}
                  rows={5} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4, resize: "vertical", fontFamily: "monospace" }} />
                <div style={{ textAlign: "right", fontSize: "0.68rem", color: "#94a3b8" }}>
                  {newPhones.split(/[\n,]+/).filter((p) => p.trim()).length}/10,000개
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.82rem" }}>취소</button>
                <button onClick={handleCreate} disabled={creating || !newName.trim()} style={{
                  padding: "8px 20px", borderRadius: 6, border: "none", cursor: creating ? "not-allowed" : "pointer",
                  background: "#fee500", color: "#3c1e1e", fontWeight: 700, fontSize: "0.82rem",
                }}>{creating ? "생성 중..." : "그룹등록"}</button>
              </div>
            </div>
          </div>
        )}

        {loading ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div> : (
          <>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 8 }}>전체 그룹 <span style={{ color: "#6366f1" }}>{groups.length}개</span></div>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>그룹명</th>
                  <th className={styles.tableCellRight}>인원수</th>
                  <th>생성일시</th>
                  <th>설명</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.group_id} className={styles.tableRow} style={{ cursor: "pointer", background: selectedGroup === g.group_id ? "#eef2ff" : undefined }}
                    onClick={() => setSelectedGroup(selectedGroup === g.group_id ? null : g.group_id)}>
                    <td><strong>{g.name}</strong></td>
                    <td className={styles.tableCellRight}><span style={{ color: "#6366f1", fontWeight: 600 }}>{g.member_count}명</span></td>
                    <td style={{ fontSize: "0.76rem", color: "#64748b" }}>{g.created_at?.slice(0, 16)}</td>
                    <td style={{ fontSize: "0.76rem", color: "#94a3b8" }}>{g.description || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleSendToGroup(g.group_id)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #6366f1", background: "#eef2ff", color: "#4f46e5", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>발송</button>
                        <button onClick={() => handleExportGroup(g.group_id, g.name)} disabled={g.member_count === 0} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #16a34a", background: g.member_count === 0 ? "#f1f5f9" : "#f0fdf4", color: g.member_count === 0 ? "#94a3b8" : "#166534", fontSize: "0.72rem", fontWeight: 600, cursor: g.member_count === 0 ? "not-allowed" : "pointer" }}>엑셀</button>
                        <button onClick={() => handleKakaoUpload(g.group_id, g.name)} disabled={g.member_count === 0} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #f59e0b", background: g.member_count === 0 ? "#f1f5f9" : "#fffbeb", color: g.member_count === 0 ? "#94a3b8" : "#92400e", fontSize: "0.72rem", fontWeight: 600, cursor: g.member_count === 0 ? "not-allowed" : "pointer" }}>카카오</button>
                        <button onClick={() => handleDelete(g.group_id)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>생성된 고객 그룹이 없다. A/B 실험 생성 시 자동으로 그룹이 만들어진다.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {selectedGroup && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                그룹 멤버 — {groups.find((g) => g.group_id === selectedGroup)?.name} (<span style={{ color: "#6366f1" }}>{membersTotal}명</span>)
                {selectedPhones.size > 0 && <span style={{ marginLeft: 8, color: "#d97706", fontSize: "0.76rem" }}>선택: {selectedPhones.size}명</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {selectedPhones.size > 0 && (
                  <button onClick={() => {
                    const selected = members.filter((m) => selectedPhones.has(m.phone));
                    sessionStorage.setItem("crm_selected_members", JSON.stringify(selected));
                    const params = new URLSearchParams();
                    params.set("site", "thecleancoffee");
                    params.set("tab", "messaging");
                    params.set("groupId", selectedGroup);
                    params.set("selectedOnly", "true");
                    params.set("channel", "sms");
                    params.set("adminOverride", "true");
                    window.location.search = params.toString();
                  }} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: "0.76rem", fontWeight: 600, cursor: "pointer" }}>
                    선택 {selectedPhones.size}명 발송
                  </button>
                )}
                <button onClick={() => { setSelectedPhones(new Set(members.map((m) => m.phone))); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: "0.72rem", cursor: "pointer" }}>전체 선택</button>
                {selectedPhones.size > 0 && <button onClick={() => setSelectedPhones(new Set())} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: "0.72rem", cursor: "pointer" }}>선택 해제</button>}
                <button
                  onClick={() => {
                    const g = groups.find((g) => g.group_id === selectedGroup);
                    if (g) handleExportGroup(g.group_id, g.name);
                  }}
                  disabled={membersTotal === 0}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #16a34a", background: membersTotal === 0 ? "#f1f5f9" : "#f0fdf4", color: membersTotal === 0 ? "#94a3b8" : "#166534", fontSize: "0.76rem", fontWeight: 600, cursor: membersTotal === 0 ? "not-allowed" : "pointer" }}
                >
                  📥 엑셀 내보내기 ({membersTotal}명)
                </button>
                <button
                  onClick={() => {
                    const g = groups.find((g) => g.group_id === selectedGroup);
                    if (g) handleKakaoUpload(g.group_id, g.name);
                  }}
                  disabled={membersTotal === 0}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #f59e0b", background: membersTotal === 0 ? "#f1f5f9" : "#fffbeb", color: membersTotal === 0 ? "#94a3b8" : "#92400e", fontSize: "0.76rem", fontWeight: 600, cursor: membersTotal === 0 ? "not-allowed" : "pointer" }}
                >
                  💬 카카오 파트너센터 업로드 ({membersTotal}명)
                </button>
              </div>
            </div>
            {membersLoading ? <div style={{ color: "#94a3b8" }}>로딩 중...</div> : (
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHead}>
                    <th style={{ width: 36 }}><input type="checkbox" checked={selectedPhones.size === members.length && members.length > 0} onChange={(e) => setSelectedPhones(e.target.checked ? new Set(members.map((m) => m.phone)) : new Set())} /></th>
                    <th>전화번호</th>
                    <th>고객명</th>
                    <th>고객번호</th>
                    <th>SMS 동의</th>
                    <th>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {members.slice(0, 50).map((m) => (
                    <tr key={m.phone} className={styles.tableRow} style={{ background: selectedPhones.has(m.phone) ? "#eef2ff" : undefined }}>
                      <td><input type="checkbox" checked={selectedPhones.has(m.phone)} onChange={(e) => {
                        const next = new Set(selectedPhones);
                        if (e.target.checked) next.add(m.phone); else next.delete(m.phone);
                        setSelectedPhones(next);
                      }} /></td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{m.phone}</td>
                      <td>{m.name || "-"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#64748b" }}>{m.member_code || "-"}</td>
                      <td><span className={`${styles.statusBadge} ${m.consent_sms ? styles.statusCompleted : styles.statusOther}`}>{m.consent_sms ? "동의" : "미동의"}</span></td>
                      <td style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{m.added_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {membersTotal > 50 && <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8" }}>외 {membersTotal - 50}명 더 있음</div>}

            {/* 엑셀/CSV 업로드 */}
            <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>엑셀 / CSV 대량 업로드</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #6366f1", background: "#eef2ff", color: "#4f46e5", fontSize: "0.76rem", fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer" }}
                >
                  파일 선택
                </button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
                onDragLeave={() => setUploadDragOver(false)}
                onDrop={handleDrop}
                style={{
                  padding: "24px 14px",
                  borderRadius: 8,
                  border: `2px dashed ${uploadDragOver ? "#6366f1" : "#cbd5e1"}`,
                  background: uploadDragOver ? "#eef2ff" : "#f8fafc",
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: "0.82rem", color: uploadDragOver ? "#4f46e5" : "#64748b", fontWeight: 600 }}>
                  {uploading ? "업로드 중..." : uploadDragOver ? "여기에 놓으시오" : "엑셀 / CSV 파일을 드래그하거나 위 버튼으로 선택"}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>
                  지원 열: 전화번호 / 이름 / 고객번호 / SMS동의 (Y·N 또는 동의·미동의)<br />
                  최대 5MB · 10,000행 · 자동 중복 제거
                </div>
              </div>

              {uploadResult && (
                <div style={{
                  marginTop: 10, padding: "10px 14px", borderRadius: 8,
                  background: uploadResult.ok ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${uploadResult.ok ? "#bbf7d0" : "#fecaca"}`,
                  fontSize: "0.78rem", color: uploadResult.ok ? "#166534" : "#991b1b",
                }}>
                  {uploadResult.ok ? (
                    <>
                      <div style={{ fontWeight: 700 }}>업로드 완료</div>
                      <div style={{ marginTop: 4 }}>
                        총 {uploadResult.total_rows ?? 0}행 중 추가 <strong>{uploadResult.added ?? 0}명</strong>
                        {" · "}중복 <strong>{uploadResult.skipped_duplicate ?? 0}</strong>
                        {" · "}유효하지 않은 전화번호 <strong>{uploadResult.skipped_invalid_phone ?? 0}</strong>
                      </div>
                      {uploadResult.errors && uploadResult.errors.length > 0 && (
                        <details style={{ marginTop: 6 }}>
                          <summary style={{ cursor: "pointer", fontSize: "0.72rem", color: "#059669" }}>
                            오류 상세 {uploadResult.errors.length}건 (처음 100건까지)
                          </summary>
                          <div style={{ marginTop: 6, maxHeight: 160, overflow: "auto", fontSize: "0.68rem", color: "#475569", fontFamily: "monospace" }}>
                            {uploadResult.errors.slice(0, 100).map((e, i) => (
                              <div key={i}>행 {e.row_index}: {e.reason}</div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700 }}>업로드 실패</div>
                      <div style={{ marginTop: 4 }}>{uploadResult.error ?? "알 수 없는 오류"}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {showScheduled && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>예약 발송</h2>
              <p className={styles.sectionDesc}>
                총 {scheduledTotal}건 · pending 상태만 취소 가능. 서버 스케줄러가 1분 주기로 폴링.
              </p>
            </div>
            <button
              onClick={loadScheduledSends}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.76rem" }}
            >
              새로고침
            </button>
          </div>
          {scheduledLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div>
          ) : scheduledRows.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>등록된 예약 발송이 없습니다.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHead}>
                    <th>ID</th>
                    <th>상태</th>
                    <th>채널</th>
                    <th>예약 시각</th>
                    <th>그룹</th>
                    <th>템플릿</th>
                    <th>성공/실패</th>
                    <th>완료 시각</th>
                    <th>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledRows.map((r) => {
                    const statusColor: Record<string, string> = {
                      pending: "#d97706",
                      running: "#2563eb",
                      success: "#16a34a",
                      partial: "#d97706",
                      fail: "#dc2626",
                      canceled: "#94a3b8",
                    };
                    const color = statusColor[r.status] ?? "#64748b";
                    return (
                      <tr key={r.id} className={styles.tableRow}>
                        <td style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "monospace" }}>{r.id}</td>
                        <td>
                          <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 700, background: `${color}15`, color }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.76rem" }}>{r.channel}</td>
                        <td style={{ fontSize: "0.74rem" }}>{new Date(r.scheduled_at).toLocaleString("ko-KR")}</td>
                        <td style={{ fontSize: "0.72rem", color: "#64748b" }}>
                          {groups.find((g) => g.group_id === r.group_id)?.name ?? r.group_id.slice(0, 10)}
                        </td>
                        <td style={{ fontSize: "0.72rem", color: "#475569" }}>{r.template_code || "-"}</td>
                        <td style={{ fontSize: "0.72rem" }}>
                          {r.status === "pending" ? "-" : `${r.success_count} / ${r.fail_count}`}
                        </td>
                        <td style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          {r.finished_at ? new Date(r.finished_at).toLocaleString("ko-KR") : "-"}
                        </td>
                        <td>
                          {r.status === "pending" && (
                            <button
                              onClick={() => cancelScheduledSend(r.id)}
                              style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}
                            >
                              취소
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showLog && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>메시지 이력</h2>
              <p className={styles.sectionDesc}>총 {msgTotal}건</p>
            </div>
          </div>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHead}>
                <th>발송일시</th>
                <th>채널</th>
                <th>고객번호</th>
                <th>템플릿</th>
                <th>상태</th>
                <th>실험</th>
              </tr>
            </thead>
            <tbody>
              {msgLog.map((m, i) => (
                <tr key={i} className={styles.tableRow}>
                  <td style={{ fontSize: "0.76rem" }}>{String(m.sent_at ?? "").slice(0, 16)}</td>
                  <td><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 600, background: m.channel === "alimtalk" ? "#fee500" : "#dbeafe", color: m.channel === "alimtalk" ? "#3c1e1e" : "#1e40af" }}>{String(m.channel)}</span></td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.72rem" }}>{String(m.customer_key ?? "-")}</td>
                  <td style={{ fontSize: "0.76rem", color: "#475569" }}>{String(m.template_code ?? "-")}</td>
                  <td><span className={`${styles.statusBadge} ${m.provider_status === "success" ? styles.statusCompleted : styles.statusOther}`}>{String(m.provider_status ?? "-")}</span></td>
                  <td style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{String(m.experiment_key ?? "-")}</td>
                </tr>
              ))}
              {msgLog.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>발송 이력 없음</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
