"use client";

import { useState } from "react";

import styles from "./page.module.css";
import { API_BASE, fmtNum } from "./crm-utils";

/**
 * 커스텀 세그먼트 빌더 (Phase E 프론트)
 *
 * 운영자가 "SMS 동의 + 30일 이상 미구매 + 누적 20만원 이상" 같은 조건을
 * 조합해서 고객을 조회하고, 원하면 그 결과로 그룹을 만들 수 있게 하는 UI.
 *
 * 이 컴포넌트는 단순화를 위해 **AND 조건만** 지원합니다 (중첩 OR 은 나중).
 * 백엔드 DSL은 이미 AND/OR 중첩을 지원하지만 UI는 단계적으로 확장.
 */

type FieldConfig = {
  value: string;
  label: string;
  valueType: "number_days" | "number_amount" | "number_count" | "yn" | "text" | "month";
  description: string;
};

const FIELDS: FieldConfig[] = [
  { value: "days_since_last_order", label: "마지막 구매 후 경과일", valueType: "number_days", description: "30이면 30일 이상 지난 고객" },
  { value: "days_since_join", label: "가입 후 경과일", valueType: "number_days", description: "가입한 지 며칠 지났는지" },
  { value: "total_spent", label: "누적 구매 금액(원)", valueType: "number_amount", description: "고객이 지금까지 쓴 총액" },
  { value: "total_orders", label: "누적 구매 횟수", valueType: "number_count", description: "주문 건수" },
  { value: "marketing_agree_sms", label: "SMS 수신 동의", valueType: "yn", description: "동의(Y) / 미동의(N)" },
  { value: "marketing_agree_email", label: "이메일 수신 동의", valueType: "yn", description: "동의(Y) / 미동의(N)" },
  { value: "member_grade", label: "쇼핑 등급", valueType: "text", description: "아임웹 등급 이름" },
  { value: "birth_month", label: "생일 달", valueType: "month", description: "1~12" },
];

const OPS_BY_TYPE: Record<FieldConfig["valueType"], Array<{ value: string; label: string }>> = {
  number_days: [
    { value: ">=", label: "이상 지났음" },
    { value: "<=", label: "이하" },
    { value: ">", label: "초과" },
    { value: "<", label: "미만" },
    { value: "=", label: "정확히" },
  ],
  number_amount: [
    { value: ">=", label: "이상" },
    { value: "<=", label: "이하" },
    { value: ">", label: "초과" },
    { value: "<", label: "미만" },
  ],
  number_count: [
    { value: ">=", label: "이상" },
    { value: "<=", label: "이하" },
    { value: "=", label: "정확히" },
  ],
  yn: [
    { value: "=", label: "이다" },
    { value: "!=", label: "아니다" },
  ],
  text: [
    { value: "=", label: "이다" },
    { value: "!=", label: "아니다" },
  ],
  month: [
    { value: "=", label: "이다" },
  ],
};

type ClauseDraft = {
  id: number;
  field: string;
  op: string;
  value: string;
};

type EvaluationPreview = {
  count: number;
  truncated: boolean;
  warnings: string[];
  preview: Array<{ member_code: string; name: string | null; phone: string | null; email: string | null }>;
};

export function SegmentBuilder({ site, onClose }: { site: string; onClose?: () => void }) {
  const [clauses, setClauses] = useState<ClauseDraft[]>([
    { id: Date.now(), field: "marketing_agree_sms", op: "=", value: "Y" },
  ]);
  const [evaluating, setEvaluating] = useState(false);
  const [preview, setPreview] = useState<EvaluationPreview | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; id?: number; message?: string } | null>(null);

  const [materializeName, setMaterializeName] = useState("");
  const [materializing, setMaterializing] = useState(false);
  const [materializeResult, setMaterializeResult] = useState<{ ok: boolean; groupId?: string; memberCount?: number; message?: string } | null>(null);

  const addClause = () => {
    setClauses((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), field: "total_spent", op: ">=", value: "" },
    ]);
  };

  const removeClause = (id: number) => {
    setClauses((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  };

  const updateClause = (id: number, patch: Partial<ClauseDraft>) => {
    setClauses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        // 필드가 바뀌면 해당 타입의 첫 op로 초기화
        if (patch.field && patch.field !== c.field) {
          const fieldCfg = FIELDS.find((f) => f.value === patch.field);
          if (fieldCfg) {
            next.op = OPS_BY_TYPE[fieldCfg.valueType][0]?.value ?? "=";
            next.value = "";
          }
        }
        return next;
      }),
    );
  };

  const buildQueryPayload = () => {
    return {
      op: "AND" as const,
      clauses: clauses.map((c) => {
        const fieldCfg = FIELDS.find((f) => f.value === c.field);
        const isNumeric = fieldCfg && [
          "number_days",
          "number_amount",
          "number_count",
          "month",
        ].includes(fieldCfg.valueType);
        const value = isNumeric ? Number(c.value) : c.value;
        return { field: c.field, op: c.op, value };
      }),
    };
  };

  const handleEvaluate = async () => {
    setEvalError(null);
    setPreview(null);
    // 기본 검증: 모든 clause에 값 있어야 함
    for (const c of clauses) {
      if (c.value === "" || c.value === undefined) {
        setEvalError("모든 조건에 값을 입력해 주세요.");
        return;
      }
    }
    setEvaluating(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/segments/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, query: buildQueryPayload() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const errs = Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors.map((e: { message?: string }) => e.message).filter(Boolean).join(" / ")
          : undefined;
        throw new Error(errs || data.error || `API ${res.status}`);
      }
      setPreview({
        count: data.count ?? 0,
        truncated: !!data.truncated,
        warnings: data.warnings ?? [],
        preview: data.preview ?? [],
      });
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setEvaluating(false);
    }
  };

  const handleSave = async () => {
    if (!preview) { alert("먼저 '고객 미리보기' 버튼을 눌러 조건을 확인해 주세요."); return; }
    if (!saveName.trim()) { alert("세그먼트 이름을 입력해 주세요."); return; }
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site,
          name: saveName.trim(),
          description: saveDesc.trim() || undefined,
          query: buildQueryPayload(),
          createdBy: "crm_ui",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `API ${res.status}`);
      }
      setSaveResult({ ok: true, id: data.segment?.id, message: `세그먼트 "${saveName}"을 저장했습니다 (id #${data.segment?.id}).` });
    } catch (err) {
      setSaveResult({ ok: false, message: err instanceof Error ? err.message : "저장 실패" });
    } finally {
      setSaving(false);
    }
  };

  const handleMaterialize = async () => {
    if (!saveResult?.ok || !saveResult.id) { alert("먼저 세그먼트를 저장해 주세요."); return; }
    if (!materializeName.trim()) { alert("만들 그룹의 이름을 입력해 주세요."); return; }
    setMaterializing(true);
    setMaterializeResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/segments/${saveResult.id}/materialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: materializeName.trim(), createdBy: "crm_ui" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `API ${res.status}`);
      }
      setMaterializeResult({
        ok: true,
        groupId: data.group?.group_id,
        memberCount: data.memberCount,
        message: `그룹 "${materializeName}"을 ${data.memberCount ?? 0}명으로 생성했습니다.`,
      });
    } catch (err) {
      setMaterializeResult({ ok: false, message: err instanceof Error ? err.message : "그룹 생성 실패" });
    } finally {
      setMaterializing(false);
    }
  };

  return (
    <div style={{
      marginTop: 16, padding: 20, borderRadius: 14,
      background: "#f8fafc", border: "1px solid #cbd5e1",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
            커스텀 세그먼트 만들기
          </h3>
          <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4, lineHeight: 1.6 }}>
            조건을 여러 개 조합해서 고객을 필터링합니다. 모든 조건이 동시에 만족되는 고객만(AND) 결과에 포함됩니다.
            미리보기로 몇 명인지 확인한 뒤 저장하면 그 조건을 재사용할 수 있고, 그룹으로 만들면 발송 대상이 됩니다.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "1px solid #cbd5e1",
              background: "#fff", color: "#64748b", fontSize: "0.78rem", cursor: "pointer",
            }}
          >
            닫기
          </button>
        )}
      </div>

      {/* 조건 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {clauses.map((c, idx) => {
          const fieldCfg = FIELDS.find((f) => f.value === c.field) ?? FIELDS[0]!;
          const ops = OPS_BY_TYPE[fieldCfg.valueType];
          return (
            <div
              key={c.id}
              style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                padding: "10px 14px", background: "#fff", borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", minWidth: 42 }}>
                {idx === 0 ? "조건" : "그리고"}
              </span>
              <select
                value={c.field}
                onChange={(e) => updateClause(c.id, { field: e.target.value })}
                aria-label="필드 선택"
                className={styles.controlSelect}
                style={{ minWidth: 180, fontSize: "0.8rem" }}
              >
                {FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={c.op}
                onChange={(e) => updateClause(c.id, { op: e.target.value })}
                aria-label="비교 연산자"
                className={styles.controlSelect}
                style={{ minWidth: 110, fontSize: "0.8rem" }}
              >
                {ops.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {fieldCfg.valueType === "yn" ? (
                <select
                  value={c.value}
                  onChange={(e) => updateClause(c.id, { value: e.target.value })}
                  aria-label="값 선택"
                  className={styles.controlSelect}
                  style={{ minWidth: 110, fontSize: "0.8rem" }}
                >
                  <option value="">값 선택</option>
                  <option value="Y">동의(Y)</option>
                  <option value="N">미동의(N)</option>
                </select>
              ) : fieldCfg.valueType === "month" ? (
                <select
                  value={c.value}
                  onChange={(e) => updateClause(c.id, { value: e.target.value })}
                  aria-label="달 선택"
                  className={styles.controlSelect}
                  style={{ minWidth: 90, fontSize: "0.8rem" }}
                >
                  <option value="">달 선택</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              ) : (
                <input
                  type={fieldCfg.valueType === "text" ? "text" : "number"}
                  value={c.value}
                  onChange={(e) => updateClause(c.id, { value: e.target.value })}
                  placeholder={
                    fieldCfg.valueType === "number_amount" ? "예: 200000" :
                    fieldCfg.valueType === "number_days" ? "예: 30" :
                    fieldCfg.valueType === "number_count" ? "예: 3" :
                    "값 입력"
                  }
                  aria-label="값 입력"
                  className={styles.controlSelect}
                  style={{ minWidth: 140, fontSize: "0.8rem" }}
                />
              )}
              <span style={{ fontSize: "0.68rem", color: "#94a3b8", flex: 1 }}>
                {fieldCfg.description}
              </span>
              <button
                type="button"
                onClick={() => removeClause(c.id)}
                disabled={clauses.length === 1}
                aria-label="조건 삭제"
                style={{
                  padding: "4px 10px", borderRadius: 4, border: "1px solid #fecaca",
                  background: clauses.length === 1 ? "#f1f5f9" : "#fef2f2",
                  color: clauses.length === 1 ? "#94a3b8" : "#dc2626",
                  fontSize: "0.72rem", fontWeight: 600,
                  cursor: clauses.length === 1 ? "not-allowed" : "pointer",
                }}
              >
                삭제
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={addClause}
          disabled={clauses.length >= 10}
          style={{
            padding: "6px 14px", borderRadius: 6,
            border: "1px dashed #6366f1",
            background: "#eef2ff", color: "#4f46e5",
            fontSize: "0.78rem", fontWeight: 600,
            cursor: clauses.length >= 10 ? "not-allowed" : "pointer",
          }}
        >
          + 조건 추가 ({clauses.length}/10)
        </button>
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={evaluating}
          style={{
            padding: "8px 18px", borderRadius: 8, border: "none",
            background: evaluating ? "#94a3b8" : "#6366f1",
            color: "#fff", fontSize: "0.82rem", fontWeight: 700,
            cursor: evaluating ? "not-allowed" : "pointer",
          }}
        >
          {evaluating ? "조회 중..." : "고객 미리보기"}
        </button>
        {evalError && (
          <span style={{ fontSize: "0.74rem", color: "#dc2626", fontWeight: 600 }}>
            {evalError}
          </span>
        )}
      </div>

      {/* 미리보기 결과 */}
      {preview && (
        <div style={{
          marginTop: 14, padding: 16, borderRadius: 10,
          background: "#fff", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0f172a" }}>
            조건에 맞는 고객: <span style={{ color: "#4f46e5" }}>{fmtNum(preview.count)}명</span>
            {preview.truncated && (
              <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "#d97706" }}>
                (최대 50,000명까지만 계산, 실제로는 더 많을 수 있습니다)
              </span>
            )}
          </div>
          {preview.warnings.length > 0 && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 6,
              background: "#fffbeb", border: "1px solid #fde68a",
              fontSize: "0.72rem", color: "#92400e",
            }}>
              성능 경고: {preview.warnings.join(", ")}
            </div>
          )}
          {preview.preview.length > 0 && (
            <div style={{ marginTop: 10, fontSize: "0.74rem" }}>
              <div style={{ color: "#64748b", marginBottom: 4, fontWeight: 600 }}>
                미리보기 (처음 {preview.preview.length}명):
              </div>
              <div style={{ maxHeight: 180, overflow: "auto", background: "#f8fafc", padding: "6px 10px", borderRadius: 6 }}>
                {preview.preview.map((p) => (
                  <div key={p.member_code} style={{ padding: "3px 0", borderBottom: "1px dashed #e2e8f0", fontSize: "0.72rem" }}>
                    <strong>{p.name || "(이름 없음)"}</strong>
                    <span style={{ marginLeft: 8, color: "#64748b", fontFamily: "monospace" }}>{p.phone ?? "-"}</span>
                    <span style={{ marginLeft: 8, color: "#94a3b8", fontFamily: "monospace", fontSize: "0.68rem" }}>
                      {p.member_code.slice(0, 14)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 저장 + 그룹 만들기 */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
              이 조건을 저장하고 싶으신가요?
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className={styles.controlGroup} style={{ flex: 1, minWidth: 200 }}>
                <label className={styles.controlLabel} htmlFor="seg-name">세그먼트 이름</label>
                <input
                  id="seg-name"
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="예: SMS 동의 고액 고객"
                  className={styles.controlSelect}
                  style={{ width: "100%", fontSize: "0.8rem" }}
                />
              </div>
              <div className={styles.controlGroup} style={{ flex: 1, minWidth: 200 }}>
                <label className={styles.controlLabel} htmlFor="seg-desc">설명 (선택)</label>
                <input
                  id="seg-desc"
                  type="text"
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="예: 월별 VIP 대상"
                  className={styles.controlSelect}
                  style={{ width: "100%", fontSize: "0.8rem" }}
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !saveName.trim()}
                style={{
                  padding: "8px 18px", borderRadius: 6, border: "none",
                  background: saving ? "#94a3b8" : "#059669",
                  color: "#fff", fontSize: "0.8rem", fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "저장 중..." : "세그먼트 저장"}
              </button>
            </div>
            {saveResult && (
              <div style={{
                marginTop: 8, padding: "8px 12px", borderRadius: 6,
                background: saveResult.ok ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${saveResult.ok ? "#bbf7d0" : "#fecaca"}`,
                fontSize: "0.74rem", color: saveResult.ok ? "#166534" : "#991b1b",
              }}>
                {saveResult.message}
              </div>
            )}

            {saveResult?.ok && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #cbd5e1" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
                  지금 이 고객들을 그룹으로 만들어 발송 대상으로 쓰시겠어요?
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className={styles.controlGroup} style={{ flex: 1, minWidth: 240 }}>
                    <label className={styles.controlLabel} htmlFor="mat-name">그룹 이름</label>
                    <input
                      id="mat-name"
                      type="text"
                      value={materializeName}
                      onChange={(e) => setMaterializeName(e.target.value)}
                      placeholder={`예: ${saveName} ${new Date().toISOString().slice(0, 10)}`}
                      className={styles.controlSelect}
                      style={{ width: "100%", fontSize: "0.8rem" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleMaterialize}
                    disabled={materializing || !materializeName.trim()}
                    style={{
                      padding: "8px 18px", borderRadius: 6, border: "none",
                      background: materializing ? "#94a3b8" : "#4f46e5",
                      color: "#fff", fontSize: "0.8rem", fontWeight: 700,
                      cursor: materializing ? "not-allowed" : "pointer",
                    }}
                  >
                    {materializing ? "생성 중..." : "그룹 만들기"}
                  </button>
                </div>
                {materializeResult && (
                  <div style={{
                    marginTop: 8, padding: "8px 12px", borderRadius: 6,
                    background: materializeResult.ok ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${materializeResult.ok ? "#bbf7d0" : "#fecaca"}`,
                    fontSize: "0.74rem", color: materializeResult.ok ? "#166534" : "#991b1b",
                  }}>
                    {materializeResult.message}
                    {materializeResult.ok && materializeResult.groupId && (
                      <> 고객 그룹 탭에서 확인할 수 있습니다.</>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
