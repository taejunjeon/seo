"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type AligoTemplate = {
  templtCode: string;
  templtName: string;
  templtContent: string;
  status: string;
  inspStatus: string;
  templateType: string;
  dormant: string;
  buttons?: Array<{ name: string; linkType: string; linkMo?: string; linkPc?: string }>;
};

type SendResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  body?: { code: number; message: string; info?: { mid?: string; type?: string; current?: number } };
};

type HistoryItem = {
  mid: string;
  msg_type: string;
  reserve: string;
  msg_count: string;
  regdate: string;
  status: string;
};

type MsgChannel = "alimtalk" | "sms";

/** 한글 2바이트, 영문/숫자 1바이트 기준 바이트 수 계산 */
function calcSmsBytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    bytes += text.charCodeAt(i) > 127 ? 2 : 1;
  }
  return bytes;
}

/* ── 워크플로우 단계 ── */
type WorkflowStep = 1 | 2 | 3 | 4;

function StepIndicator({ current, channel }: { current: WorkflowStep; channel: MsgChannel }) {
  const steps = channel === "sms"
    ? [
        { n: 1 as const, label: "대상 선택" },
        { n: 2 as const, label: "메시지 작성" },
        { n: 3 as const, label: "확인" },
        { n: 4 as const, label: "발송" },
      ]
    : [
        { n: 1 as const, label: "대상 선택" },
        { n: 2 as const, label: "템플릿" },
        { n: 3 as const, label: "미리보기" },
        { n: 4 as const, label: "발송" },
      ];
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
      {steps.map((s) => (
        <div key={s.n} style={{
          flex: 1, padding: "8px 0", textAlign: "center", borderRadius: 8,
          background: current >= s.n ? "#6366f1" : "#f1f5f9",
          color: current >= s.n ? "#fff" : "#94a3b8",
          fontSize: "0.75rem", fontWeight: 600, transition: "all 0.2s",
        }}>
          {s.n}. {s.label}
        </div>
      ))}
    </div>
  );
}

export default function MessagingTab() {
  const [aligoReady, setAligoReady] = useState(false);
  const [templates, setTemplates] = useState<AligoTemplate[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [remainQuota, setRemainQuota] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tplSearch, setTplSearch] = useState("");

  // 워크플로우 상태
  const [step, setStep] = useState<WorkflowStep>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<AligoTemplate | null>(null);
  const msgSearchParams = useSearchParams();
  const phoneFromUrl = msgSearchParams.get("phone") ?? "";
  const nameFromUrl = msgSearchParams.get("name") ?? "";
  const channelFromUrl = msgSearchParams.get("channel") as MsgChannel | null;
  const adminOverrideFromUrl = msgSearchParams.get("adminOverride") === "true";
  const [receiver, setReceiver] = useState(phoneFromUrl || "010-3934-8641");
  const [recvName, setRecvName] = useState(nameFromUrl || "TJ (테스트)");

  // URL 파라미터가 변경되면 수신자 + 채널 + 관리자 모드 자동 업데이트
  useEffect(() => {
    if (phoneFromUrl) setReceiver(phoneFromUrl);
    if (nameFromUrl) setRecvName(nameFromUrl);
    if (channelFromUrl === "sms" || channelFromUrl === "alimtalk") setMsgChannel(channelFromUrl);
    if (adminOverrideFromUrl) setAdminOverride(true);
  }, [phoneFromUrl, nameFromUrl, channelFromUrl, adminOverrideFromUrl]);
  const [msgChannel, setMsgChannel] = useState<MsgChannel>("alimtalk");
  const [smsMessage, setSmsMessage] = useState("");
  const [sourceType, setSourceType] = useState<"manual" | "followup" | "experiment">("manual");
  const [testMode, setTestMode] = useState(true);
  const [adminOverride, setAdminOverride] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [loading, setLoading] = useState(true);
  // 새 템플릿 생성
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplContent, setNewTplContent] = useState("");
  const [newTplType, setNewTplType] = useState<"BA" | "AD">("BA");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ ok: boolean; message: string; tplCode?: string } | null>(null);
  // blocked reason (contact policy)
  const [policyResult, setPolicyResult] = useState<{
    eligible: boolean;
    blockedReasons: Array<{ code: string; message: string }>;
  } | null>(null);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

  // exact-match preview
  const [previewResult, setPreviewResult] = useState<{
    ok: boolean;
    templateName?: string;
    approvedTemplate?: string;
    renderedBody?: string;
    variablesFound?: string[];
    variablesMissing?: string[];
    exactMatch?: boolean;
    warnings?: string[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, tplRes, wlRes, quotaRes, histRes] = await Promise.all([
        fetch(`${API_BASE}/api/aligo/status`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/aligo/templates`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/aligo/whitelist`).then((r) => r.json()).catch(() => []),
        fetch(`${API_BASE}/api/aligo/quota`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/aligo/history?limit=10`).then((r) => r.json()).catch(() => null),
      ]);
      if (statusRes?.config?.ready) setAligoReady(true);
      if (tplRes?.body?.list) setTemplates(tplRes.body.list.filter((t: AligoTemplate) => t.status === "A" && t.inspStatus === "APR"));
      if (Array.isArray(wlRes)) setWhitelist(wlRes);
      if (quotaRes?.body?.list?.ALT_CNT != null) setRemainQuota(quotaRes.body.list.ALT_CNT);
      if (histRes?.body?.list) setHistory(histRes.body.list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const normalizedWhitelist = whitelist.map((w) => w.replace(/[^0-9]/g, ""));
  const receiverNormalized = receiver.replace(/[^0-9]/g, "");
  const isWhitelisted = normalizedWhitelist.includes(receiverNormalized);

  // 수신자 변경 시 contact policy 평가
  useEffect(() => {
    if (!receiverNormalized) { setPolicyResult(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/contact-policy/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: msgChannel === "sms" ? "sms" : "aligo",
            customerPhone: receiverNormalized,
            adminOverride,
            claimReviewStatus: msgChannel === "sms" ? "approved" : (selectedTemplate?.inspStatus === "APR" ? "approved" : undefined),
          }),
        });
        if (!cancelled) setPolicyResult(await res.json());
      } catch { if (!cancelled) setPolicyResult(null); }
    })();
    return () => { cancelled = true; };
  }, [receiverNormalized, adminOverride, selectedTemplate, msgChannel]);

  // 템플릿 선택 시 render-preview 자동 호출
  useEffect(() => {
    if (!selectedTemplate) { setPreviewResult(null); return; }
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/aligo/render-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateCode: selectedTemplate.templtCode, variables: templateVars }),
        });
        if (!cancelled) setPreviewResult(await res.json());
      } catch {
        if (!cancelled) setPreviewResult(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTemplate, templateVars]);

  // 홍보성 SMS는 080 수신거부번호 필수 (전기통신사업법)
  const OPT_OUT_SUFFIX = "\n[무료 수신거부] 080-XXX-XXXX";
  const smsWithOptOut = smsMessage.includes("080-") ? smsMessage : smsMessage + OPT_OUT_SUFFIX;

  const handleSmsSend = async () => {
    if (!smsMessage.trim() || !isWhitelisted) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/aligo/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver: receiverNormalized,
          message: smsWithOptOut,
          testMode: testMode ? "Y" : "N",
          consentStatus: policyResult?.eligible ? "consented" : "not_consented",
          adminOverride,
        }),
      });
      setSendResult(await res.json());
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      setSendResult({ error: err instanceof Error ? err.message : "SMS 발송 실패" });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate || !isWhitelisted) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/aligo/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tplCode: selectedTemplate.templtCode,
          receiver: receiverNormalized,
          recvname: recvName || undefined,
          subject: selectedTemplate.templtName,
          message: previewResult?.renderedBody ?? selectedTemplate.templtContent,
          button: selectedTemplate.buttons?.length ? JSON.stringify({ button: selectedTemplate.buttons }) : undefined,
          testMode: testMode ? "Y" : "N",
          consentStatus: policyResult?.eligible ? "consented" : "not_consented",
          adminOverride,
        }),
      });
      setSendResult(await res.json());
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      setSendResult({ error: err instanceof Error ? err.message : "발송 실패" });
    } finally {
      setSending(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTplName.trim() || !newTplContent.trim()) return;
    setCreating(true);
    setCreateResult(null);
    try {
      // 1. 생성
      const createRes = await fetch(`${API_BASE}/api/aligo/template/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tplName: newTplName, tplContent: newTplContent, templateType: newTplType }),
      });
      const createData = await createRes.json();
      if (!createData.ok && createData.body?.code !== 0) {
        setCreateResult({ ok: false, message: createData.body?.message ?? createData.message ?? "생성 실패" });
        return;
      }
      const tplCode = createData.body?.data?.tpl_code ?? createData.body?.tpl_code ?? "";

      // 2. 검수 요청
      if (tplCode) {
        await fetch(`${API_BASE}/api/aligo/template/request-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tplCode }),
        });
      }

      setCreateResult({ ok: true, message: `템플릿 생성 + 검수 요청 완료 (${tplCode}). 카카오 승인까지 1~3 영업일 소요.`, tplCode });
      setNewTplName("");
      setNewTplContent("");
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      setCreateResult({ ok: false, message: err instanceof Error ? err.message : "생성 실패" });
    } finally {
      setCreating(false);
    }
  };

  // dormant=Y (휴면) 템플릿 제외, 승인된 것만
  const activeTemplates = templates.filter((t) => t.dormant !== "Y" && t.inspStatus === "APR");
  const filteredTemplates = tplSearch
    ? activeTemplates.filter((t) => t.templtName.includes(tplSearch) || t.templtCode.includes(tplSearch))
    : activeTemplates;

  const canProceedToStep2 = receiver.trim().length > 0 && isWhitelisted;
  const canProceedToStep3 = canProceedToStep2 && selectedTemplate !== null;
  const canSend = canProceedToStep3;

  if (loading) return <section className={styles.section}><p style={{ textAlign: "center", color: "#94a3b8" }}>메시지 데이터 로딩 중...</p></section>;

  const smsBytes = calcSmsBytes(smsMessage);
  const smsType = smsBytes > 90 ? "LMS" : "SMS";

  return (
    <>
      {/* 채널 선택 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {([
          { key: "alimtalk" as const, label: "카카오 알림톡", desc: "승인된 템플릿 기반, 건당 ~₩8" },
          { key: "sms" as const, label: "SMS 문자", desc: "자유 메시지, 건당 ~₩16" },
        ]).map((ch) => (
          <button key={ch.key} type="button" onClick={() => { setMsgChannel(ch.key); setStep(1); setSendResult(null); }} style={{
            flex: 1, padding: "14px 18px", borderRadius: 12, textAlign: "left", cursor: "pointer",
            border: msgChannel === ch.key ? "2px solid #6366f1" : "1px solid #e2e8f0",
            background: msgChannel === ch.key ? "#eef2ff" : "#fff",
          }}>
            <strong style={{ fontSize: "0.92rem", color: msgChannel === ch.key ? "#4338ca" : "#334155" }}>{ch.label}</strong>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>{ch.desc}</div>
          </button>
        ))}
      </div>

      {/* 오늘 할 일 카드 */}
      <div style={{
        padding: "12px 18px", borderRadius: 10, marginBottom: 14,
        background: "#eff6ff", border: "1px solid #bfdbfe",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e40af" }}>
          {msgChannel === "sms"
            ? `SMS 발송 준비 — 화이트리스트 ${whitelist.length}명`
            : `오늘 발송 가능: 활성 템플릿 ${activeTemplates.length}개 (정보 ${activeTemplates.filter((t) => t.templateType !== "AD").length} / 홍보 ${activeTemplates.filter((t) => t.templateType === "AD").length}), 화이트리스트 ${whitelist.length}명`}
        </span>
        {remainQuota != null && (
          <span style={{ fontSize: "0.72rem", color: "#3b82f6" }}>
            잔여 포인트 {remainQuota.toLocaleString("ko-KR")}
          </span>
        )}
      </div>

      {/* 상단 KPI 바 */}
      <section className={styles.section}>
        <div className={styles.summaryGrid}>
          <div className={`${styles.summaryCard} ${aligoReady ? styles.toneSuccess : styles.toneError}`}>
            <div className={styles.summaryLabel}>연동 상태</div>
            <div className={styles.summaryValue}>{aligoReady ? "정상" : "미설정"}</div>
          </div>
          <div className={`${styles.summaryCard} ${activeTemplates.length > 0 ? styles.toneSuccess : styles.toneWarn}`}>
            <div className={styles.summaryLabel}>활성 템플릿</div>
            <div className={styles.summaryValue}>{activeTemplates.length}개</div>
            <div className={styles.summarySub}>휴면 {templates.length - activeTemplates.length}개 제외</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>잔여 포인트</div>
            <div className={styles.summaryValue}>{remainQuota != null ? remainQuota.toLocaleString("ko-KR") : "—"}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>화이트리스트</div>
            <div className={styles.summaryValue}>{whitelist.length}명</div>
            <div className={styles.summarySub}>{whitelist.join(", ")}</div>
          </div>
        </div>
      </section>

      {/* 테스트/실발송 모드 배너 */}
      {!testMode && (
        <div style={{ padding: "10px 18px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: "0.85rem", fontWeight: 700, color: "#dc2626", marginBottom: 12 }}>
          실제 발송 모드가 활성화되어 있습니다. {msgChannel === "sms" ? "SMS 문자" : "카카오톡"}가 실제로 전송됩니다.
        </div>
      )}

      {/* SMS 모드일 때 전용 워크플로우 */}
      {msgChannel === "sms" ? (
        <section className={styles.section}>
          <StepIndicator current={step} channel="sms" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {/* SMS Step 1: 수신자 */}
            <div className={styles.panel} style={{ opacity: step >= 1 ? 1 : 0.4 }}>
              <h3 className={styles.panelTitle}>1. 수신자</h3>
              <div className={styles.controlGroup} style={{ marginTop: 12 }}>
                <label className={styles.controlLabel}>전화번호</label>
                <input className={styles.controlSelect} value={receiver} onChange={(e) => { setReceiver(e.target.value); setStep(1); }} style={{ width: "100%" }} />
              </div>
              <div className={styles.controlGroup} style={{ marginTop: 8 }}>
                <label className={styles.controlLabel}>수신자명</label>
                <input className={styles.controlSelect} value={recvName} onChange={(e) => setRecvName(e.target.value)} style={{ width: "100%" }} />
              </div>
              {isWhitelisted ? (
                <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#16a34a", fontWeight: 600 }}>화이트리스트 확인됨</div>
              ) : (
                <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>화이트리스트에 없음 — 발송 불가</div>
              )}
              {isWhitelisted && step === 1 && (
                <button type="button" className={styles.retryButton} onClick={() => setStep(2)} style={{ marginTop: 10, background: "#6366f1", color: "#fff", border: "none" }}>
                  다음: 메시지 작성 →
                </button>
              )}
            </div>

            {/* SMS Step 2: 메시지 작성 */}
            <div className={styles.panel} style={{ opacity: step >= 2 ? 1 : 0.4 }}>
              <h3 className={styles.panelTitle}>2. 메시지 작성</h3>
              <div className={styles.controlGroup} style={{ marginTop: 12 }}>
                <label className={styles.controlLabel}>메시지 내용</label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => { setSmsMessage(e.target.value); if (step < 2) setStep(2); }}
                  placeholder="안녕하세요. 더클린커피에서 새 원두가 입고되었습니다."
                  rows={5}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0",
                    fontFamily: "inherit", fontSize: "0.84rem", resize: "vertical",
                  }}
                  disabled={step < 2}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.72rem" }}>
                <span style={{ color: smsBytes > 90 ? "#d97706" : "#64748b", fontWeight: 600 }}>
                  {smsBytes}/90 바이트 ({smsType}) {smsType === "LMS" && "— 장문 전환 (₩45)"}
                </span>
                <span style={{ color: "#94a3b8" }}>
                  예상 비용: ₩{smsType === "LMS" ? "45" : "16"}
                </span>
              </div>
              {step === 2 && smsMessage.trim() && (
                <button type="button" className={styles.retryButton} onClick={() => setStep(3)} style={{ marginTop: 10, background: "#6366f1", color: "#fff", border: "none" }}>
                  다음: 확인 →
                </button>
              )}
            </div>
          </div>

          {/* SMS Step 3-4: 정책 확인 + 발송 */}
          {step >= 3 && (
            <div className={styles.panel} style={{ marginTop: 18 }}>
              <h3 className={styles.panelTitle}>3. 정책 확인 및 발송</h3>

              {/* 미리보기 */}
              <div style={{ padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", marginTop: 12, fontSize: "0.84rem", lineHeight: 1.7 }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>실제 발송될 메시지</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{smsWithOptOut}</div>
                <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#64748b" }}>
                  수신: {receiver} ({recvName}) · {calcSmsBytes(smsWithOptOut) > 90 ? "LMS" : "SMS"} · {calcSmsBytes(smsWithOptOut)}바이트
                </div>
                {!smsMessage.includes("080-") && (
                  <div style={{ marginTop: 4, fontSize: "0.68rem", color: "#d97706" }}>
                    수신거부번호가 자동 추가됨 (홍보성 SMS 법적 의무)
                  </div>
                )}
              </div>

              {/* 정책 결과 */}
              {policyResult && (
                <div style={{ marginTop: 12 }}>
                  {policyResult.eligible ? (
                    <div style={{ padding: "8px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "0.78rem", fontWeight: 600, color: "#16a34a" }}>
                      발송 정책 검증 통과
                    </div>
                  ) : (
                    <div style={{ padding: "8px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: "0.78rem", color: "#dc2626" }}>
                      <strong>발송 차단 사유:</strong>
                      <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                        {policyResult.blockedReasons.map((r) => <li key={r.code}>{r.message}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 테스트/실발송 토글 */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: testMode ? "#16a34a" : "#dc2626", cursor: "pointer" }}>
                  <input type="checkbox" checked={!testMode} onChange={(e) => setTestMode(!e.target.checked)} style={{ marginRight: 6 }} />
                  {testMode ? "테스트 모드 (실제 전송 안 함)" : "실제 발송 모드"}
                </label>
              </div>

              {/* 발송 버튼 */}
              <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={handleSmsSend}
                  disabled={sending || !isWhitelisted || !smsMessage.trim()}
                  style={{ background: sending ? "#94a3b8" : "#6366f1", color: "#fff", border: "none", padding: "12px 24px" }}
                >
                  {sending ? "발송 중..." : `SMS ${testMode ? "테스트" : "실제"} 발송`}
                </button>
                <button type="button" className={styles.retryButton} onClick={() => setStep(2)} style={{ fontSize: "0.78rem" }}>
                  ← 메시지 수정
                </button>
              </div>

              {/* 발송 결과 */}
              {sendResult && (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: 8,
                  background: sendResult.ok ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${sendResult.ok ? "#bbf7d0" : "#fecaca"}`,
                  fontSize: "0.82rem",
                  color: sendResult.ok ? "#16a34a" : "#dc2626",
                }}>
                  {sendResult.ok ? (
                    <span>SMS 발송 성공 (MID: {sendResult.body?.info?.mid ?? "—"})</span>
                  ) : (
                    <span>SMS 발송 실패: {sendResult.error ?? sendResult.message ?? sendResult.body?.message ?? "알 수 없는 오류"}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {/* 알림톡 모드일 때 기존 워크플로우 */}
      {msgChannel === "alimtalk" ? (
      <>

      {/* 워크플로우 — 3열 레이아웃: 대상 | 템플릿 | 미리보기+발송 */}
      <section className={styles.section}>
        <StepIndicator current={step} channel="alimtalk" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, minHeight: 400 }}>
          {/* ═══ 1열: 대상 선택 ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Step 1: 대상 선택 */}
            <div style={{
              padding: "16px 20px", borderRadius: 12,
              background: step === 1 ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.6)",
              border: step === 1 ? "2px solid #6366f1" : "1px solid #e2e8f0",
            }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>1. 대상 선택</div>

              {/* 소스 타입 */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {([
                  { value: "manual" as const, label: "수동 테스트" },
                  { value: "followup" as const, label: "후속 관리 대상" },
                  { value: "experiment" as const, label: "실험 대상" },
                ] as const).map((s) => (
                  <button key={s.value} onClick={() => setSourceType(s.value)} style={{
                    padding: "5px 10px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
                    border: sourceType === s.value ? "1px solid #6366f1" : "1px solid #e2e8f0",
                    background: sourceType === s.value ? "#eef2ff" : "transparent",
                    color: sourceType === s.value ? "#4338ca" : "#64748b",
                  }}>{s.label}</button>
                ))}
              </div>

              {sourceType === "manual" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="text" value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="010-XXXX-XXXX"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.85rem" }} />
                  <input type="text" value={recvName} onChange={(e) => setRecvName(e.target.value)} placeholder="수신자명"
                    style={{ width: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.85rem" }} />
                  {isWhitelisted
                    ? <span style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap" }}>허용</span>
                    : <span style={{ fontSize: "0.7rem", color: "#dc2626", fontWeight: 700, whiteSpace: "nowrap" }}>미허용</span>}
                </div>
              )}
              {sourceType === "followup" && (
                <div style={{ padding: 12, borderRadius: 8, background: "#fef3c7", fontSize: "0.78rem", color: "#92400e" }}>
                  후속 관리 탭에서 대상자를 선택 후 연동 예정. 현재는 수동 테스트만 가능.
                </div>
              )}
              {sourceType === "experiment" && (
                <div style={{ padding: 12, borderRadius: 8, background: "#fef3c7", fontSize: "0.78rem", color: "#92400e" }}>
                  실험 운영 탭에서 treatment 그룹 연동 예정. 현재는 수동 테스트만 가능.
                </div>
              )}

              {!isWhitelisted && sourceType === "manual" && receiver.trim() && (
                <div style={{ fontSize: "0.72rem", color: "#dc2626", marginTop: 6 }}>
                  이 번호는 화이트리스트에 없습니다. 테스트 기간: {whitelist.join(", ")}만 허용.
                </div>
              )}

              {canProceedToStep2 && step === 1 && (
                <button onClick={() => setStep(2)} style={{
                  marginTop: 10, padding: "8px 16px", borderRadius: 6, border: "none",
                  background: "#6366f1", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                }}>다음: 템플릿 선택 →</button>
              )}
            </div>

          </div>

          {/* ═══ 2열: 템플릿 선택 ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Step 2: 템플릿 선택 — 항상 표시 */}
            {true && (
              <div style={{
                padding: "16px 20px", borderRadius: 12, flex: 1, overflow: "auto",
                background: step === 2 ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.6)",
                border: step === 2 ? "2px solid #6366f1" : "1px solid #e2e8f0",
              }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>2. 템플릿 선택</div>
                <input type="text" value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} placeholder="템플릿 검색..."
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.78rem", marginBottom: 8 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflow: "auto" }}>
                  {filteredTemplates.map((tpl) => (
                    <div key={tpl.templtCode} onClick={() => { setSelectedTemplate(tpl); setTemplateVars({}); if (step < 3) setStep(3); }}
                      style={{
                        padding: "10px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                        border: selectedTemplate?.templtCode === tpl.templtCode ? "2px solid #6366f1" : "1px solid #e2e8f0",
                        background: selectedTemplate?.templtCode === tpl.templtCode ? "rgba(99,102,241,0.05)" : "#fff",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{
                            fontSize: "0.6rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                            background: tpl.templateType === "AD" ? "#fef2f2" : "#f0fdf4",
                            color: tpl.templateType === "AD" ? "#dc2626" : "#16a34a",
                          }}>{tpl.templateType === "AD" ? "홍보" : "정보"}</span>
                          <span style={{ fontWeight: 600, fontSize: "0.78rem" }}>{tpl.templtName}</span>
                        </div>
                        <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{tpl.templtCode}</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tpl.templtContent.slice(0, 80)}...
                      </div>
                      {tpl.buttons && tpl.buttons.length > 0 && (
                        <div style={{ marginTop: 3, display: "flex", gap: 3 }}>
                          {tpl.buttons.map((btn, i) => (
                            <span key={i} style={{ fontSize: "0.6rem", padding: "1px 4px", borderRadius: 3, background: "#eff6ff", color: "#3b82f6" }}>{btn.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

              {/* 새 템플릿 만들기 */}
              <button onClick={() => setShowCreateForm(!showCreateForm)} style={{
                marginTop: 8, padding: "8px 14px", borderRadius: 6, border: "1px dashed #94a3b8",
                background: "transparent", color: "#6366f1", fontSize: "0.75rem", fontWeight: 600,
                cursor: "pointer", width: "100%",
              }}>
                {showCreateForm ? "닫기" : "+ 새 템플릿 만들기"}
              </button>

              {showCreateForm && (
                <div style={{ marginTop: 8, padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>새 알림톡 템플릿</div>
                  <input type="text" value={newTplName} onChange={(e) => setNewTplName(e.target.value)}
                    placeholder="템플릿 이름 (예: 검사 결과 안내)"
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.75rem", marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    {(["BA", "AD"] as const).map((t) => (
                      <button key={t} onClick={() => setNewTplType(t)} style={{
                        padding: "4px 10px", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: "0.7rem", fontWeight: 600,
                        background: newTplType === t ? (t === "AD" ? "#fef2f2" : "#f0fdf4") : "#fff",
                        color: newTplType === t ? (t === "AD" ? "#dc2626" : "#16a34a") : "#64748b",
                        cursor: "pointer",
                      }}>
                        {t === "BA" ? "정보성" : "홍보성"}
                      </button>
                    ))}
                  </div>
                  <textarea value={newTplContent} onChange={(e) => setNewTplContent(e.target.value)}
                    placeholder={"안녕하세요, 바이오컴입니다.\n#{이름}님의 검사 결과가 도착했습니다.\n\n변수는 #{변수명} 형식으로 입력하세요."}
                    rows={6}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.75rem", resize: "vertical", lineHeight: 1.6 }} />
                  <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 2, marginBottom: 6 }}>
                    최대 1,000자. 변수: #{"{이름}"}, #{"{상품명}"} 형식. 검수 승인까지 1~3 영업일.
                  </div>
                  <button onClick={handleCreateTemplate} disabled={creating || !newTplName.trim() || !newTplContent.trim()}
                    style={{
                      padding: "8px 16px", borderRadius: 6, border: "none", width: "100%",
                      background: creating || !newTplName.trim() || !newTplContent.trim() ? "#e2e8f0" : "#6366f1",
                      color: "#fff", fontSize: "0.78rem", fontWeight: 600,
                      cursor: creating || !newTplName.trim() || !newTplContent.trim() ? "not-allowed" : "pointer",
                    }}>
                    {creating ? "생성 중..." : "생성 + 검수 요청"}
                  </button>
                  {createResult && (
                    <div style={{
                      marginTop: 6, padding: "8px 12px", borderRadius: 6,
                      background: createResult.ok ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${createResult.ok ? "#bbf7d0" : "#fecaca"}`,
                      fontSize: "0.72rem", color: createResult.ok ? "#16a34a" : "#dc2626",
                    }}>
                      {createResult.message}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* ═══ 3열: 미리보기 + 발송 ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Step 3: 미리보기 */}
            <div style={{
              padding: "16px 20px", borderRadius: 12, flex: 1,
              background: step === 3 ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.6)",
              border: step >= 3 && selectedTemplate ? "2px solid #6366f1" : "1px solid #e2e8f0",
            }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>3. 미리보기</div>
              {selectedTemplate ? (
                <>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    {selectedTemplate.templtName} <span style={{ color: "#94a3b8" }}>({selectedTemplate.templtCode})</span>
                  </div>
                  {/* 미리보기 본문 (변수 치환 반영) */}
                  <div style={{
                    background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #f1f5f9",
                    fontSize: "0.78rem", color: "#1e293b", whiteSpace: "pre-wrap", lineHeight: 1.6,
                    maxHeight: 250, overflow: "auto",
                  }}>
                    {previewResult?.renderedBody ?? selectedTemplate.templtContent}
                  </div>
                  {/* 버튼 미리보기 */}
                  {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                      {selectedTemplate.buttons.map((btn, i) => (
                        <span key={i} style={{
                          padding: "7px 14px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 600,
                          background: "#fee500", color: "#3c1e1e",
                        }}>{btn.name}</span>
                      ))}
                    </div>
                  )}
                  {/* 변수 입력 폼 */}
                  {previewResult?.variablesFound && previewResult.variablesFound.length > 0 && (
                    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#fefce8", border: "1px solid #fde68a" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                        변수 입력 ({previewResult.variablesFound.length}개)
                      </div>
                      {previewResult.variablesFound.map((v) => (
                        <div key={v} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: "0.72rem", color: "#78350f", fontWeight: 600, minWidth: 80 }}>#{`{${v}}`}</span>
                          <input
                            type="text"
                            value={templateVars[v] ?? ""}
                            onChange={(e) => setTemplateVars((prev) => ({ ...prev, [v]: e.target.value }))}
                            placeholder={v}
                            style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: "0.75rem" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* exact-match 검증 결과 */}
                  {previewLoading ? (
                    <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "#f1f5f9", fontSize: "0.72rem", color: "#64748b" }}>
                      검증 중...
                    </div>
                  ) : previewResult ? (
                    <div style={{
                      marginTop: 10, padding: "10px 14px", borderRadius: 8,
                      background: previewResult.exactMatch ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${previewResult.exactMatch ? "#bbf7d0" : "#fecaca"}`,
                    }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: previewResult.exactMatch ? "#16a34a" : "#dc2626" }}>
                        {previewResult.exactMatch ? "변수 치환 완료 — 발송 가능" : "변수를 모두 입력해야 발송할 수 있습니다"}
                      </div>
                      {previewResult.variablesMissing && previewResult.variablesMissing.length > 0 && (
                        <div style={{ fontSize: "0.72rem", color: "#dc2626", marginTop: 4 }}>
                          미입력: {previewResult.variablesMissing.map((v) => `#{${v}}`).join(", ")}
                        </div>
                      )}
                    </div>
                  ) : null}
                  {/* 수신자 요약 */}
                  <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#64748b" }}>
                    수신자: <strong>{recvName || "미지정"}</strong> ({receiver}) {isWhitelisted ? "✅" : "❌"}
                  </div>
                  {canSend && step >= 3 && (
                    <button onClick={() => setStep(4)} style={{
                      marginTop: 14, padding: "12px 24px", borderRadius: 8, border: "none",
                      background: previewResult?.exactMatch ? "#16a34a" : "#6366f1",
                      color: "#fff", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                      width: "100%",
                    }}>
                      {previewResult?.exactMatch ? "발송하기 →" : "다음: 발송 확인 →"}
                    </button>
                  )}
                </>
              ) : (
                <div style={{ padding: 16, fontSize: "0.78rem", color: "#475569", lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>발송 준비 요약</div>
                  <div>선택 대상: <strong>{receiver.trim() ? "1명" : "0명"}</strong></div>
                  <div>발송 가능: <strong>{isWhitelisted ? "1명" : "0명"}</strong> {!isWhitelisted && receiver.trim() && <span style={{ color: "#dc2626" }}>(화이트리스트 미포함)</span>}</div>
                  <div>차단: <strong>0명</strong></div>
                  <div>선택 템플릿: <strong style={{ color: "#dc2626" }}>없음</strong></div>
                  <div style={{ marginTop: 8, color: "#6366f1", fontWeight: 600 }}>다음 단계: 중앙에서 템플릿을 선택하세요</div>
                </div>
              )}
            </div>

            {/* Step 4: 발송 */}
            {step >= 4 && (
              <div style={{
                padding: "16px 20px", borderRadius: 12,
                background: "rgba(255,255,255,0.6)", border: "2px solid #6366f1",
              }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>4. 발송</div>
                {/* gate 상태 표시 */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {[
                    { label: "화이트리스트", ok: isWhitelisted },
                    { label: "잔여 포인트", ok: remainQuota != null && remainQuota > 0 },
                    { label: "템플릿 선택", ok: !!selectedTemplate },
                    { label: "exact-match", ok: previewResult?.exactMatch === true },
                    { label: "연동 상태", ok: aligoReady },
                  ].map((g) => (
                    <span key={g.label} style={{
                      fontSize: "0.68rem", fontWeight: 600, padding: "3px 8px", borderRadius: 4,
                      background: g.ok ? "#dcfce7" : "#fee2e2",
                      color: g.ok ? "#16a34a" : "#dc2626",
                    }}>{g.ok ? "✓" : "✗"} {g.label}</span>
                  ))}
                </div>

                {/* blocked reason 카드 */}
                {policyResult && !policyResult.eligible && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 8, marginBottom: 10,
                    background: "#fef2f2", border: "1px solid #fecaca",
                  }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                      발송 차단 사유 ({policyResult.blockedReasons.length}건)
                    </div>
                    {policyResult.blockedReasons.map((r) => (
                      <div key={r.code} style={{ fontSize: "0.72rem", color: "#991b1b", lineHeight: 1.6 }}>
                        <strong>{r.code}</strong>: {r.message}
                      </div>
                    ))}
                  </div>
                )}
                {policyResult?.eligible && (
                  <div style={{
                    padding: "8px 14px", borderRadius: 8, marginBottom: 10,
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    fontSize: "0.72rem", fontWeight: 600, color: "#16a34a",
                  }}>
                    발송 정책 검증 통과 — 차단 사유 없음
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={adminOverride} onChange={(e) => setAdminOverride(e.target.checked)} />
                    <span style={{ color: adminOverride ? "#dc2626" : "#64748b", fontWeight: adminOverride ? 700 : 400 }}>최고관리자 강제 발송</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
                    테스트 모드
                  </label>
                  <button onClick={handleSend} disabled={!canSend || sending || previewResult?.exactMatch === false}
                    style={{
                      padding: "10px 24px", borderRadius: 8, border: "none",
                      background: !canSend || sending ? "#e2e8f0" : testMode ? "#6366f1" : "#dc2626",
                      color: "#fff", fontSize: "0.85rem", fontWeight: 600,
                      cursor: !canSend || sending ? "not-allowed" : "pointer",
                    }}>
                    {sending ? "발송 중..." : testMode ? "테스트 발송" : "실제 발송"}
                  </button>
                  {!testMode && <span style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>실제 카카오톡 발송</span>}
                </div>

                {sendResult && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 8,
                    background: sendResult.ok || sendResult.body?.code === 0 ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${sendResult.ok || sendResult.body?.code === 0 ? "#bbf7d0" : "#fecaca"}`,
                  }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: sendResult.ok || sendResult.body?.code === 0 ? "#16a34a" : "#dc2626" }}>
                      {sendResult.ok || sendResult.body?.code === 0
                        ? testMode
                          ? "테스트 요청 완료 (실제 발송 안 됨)"
                          : "발송 완료 — 카카오톡이 전송되었습니다"
                        : "발송 실패"}
                    </div>
                    {testMode && (sendResult.ok || sendResult.body?.code === 0) && (
                      <div style={{ fontSize: "0.75rem", color: "#6366f1", marginTop: 2, fontWeight: 600 }}>
                        테스트 모드에서는 실제 카카오톡이 전송되지 않습니다. 실발송하려면 테스트 모드를 해제하세요.
                      </div>
                    )}
                    {!testMode && (sendResult.ok || sendResult.body?.code === 0) && (
                      <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 2 }}>
                        {sendResult.body?.message ?? ""}
                      </div>
                    )}
                    {!(sendResult.ok || sendResult.body?.code === 0) && (
                      <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: 2 }}>
                        {sendResult.body?.message ?? sendResult.message ?? sendResult.error ?? ""}
                      </div>
                    )}
                    {sendResult.body?.info?.mid && (
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>
                        MID: {sendResult.body.info.mid} / 잔여: {sendResult.body.info.current ?? "—"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 최근 발송 이력 — 기본 접기, 5건만 표시 */}
      <section className={styles.section}>
        <details>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "#475569", padding: "8px 0" }}>
            최근 발송 이력 ({history.length}건)
          </summary>
          {history.length > 0 ? (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table className={styles.table}>
                <thead><tr className={styles.tableHead}>
                  <th>MID</th><th>유형</th><th>건수</th><th>상태</th><th>발송일</th>
                </tr></thead>
                <tbody>
                  {history.slice(0, 5).map((item) => {
                    const statusText = item.status === "전송완료" ? "발송 성공" : item.status === "대기" ? "대기" : item.status || "알 수 없음";
                    const isSuccess = item.status === "전송완료";
                    return (
                      <tr key={item.mid} className={styles.tableRow}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.72rem" }}>{item.mid}</td>
                        <td style={{ fontSize: "0.75rem" }}>{item.msg_type}</td>
                        <td style={{ fontSize: "0.75rem" }}>{item.msg_count}</td>
                        <td><span style={{
                          fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                          background: isSuccess ? "#dcfce7" : "#fef3c7",
                          color: isSuccess ? "#16a34a" : "#d97706",
                        }}>{statusText}</span></td>
                        <td style={{ fontSize: "0.72rem" }}>{item.regdate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {history.length > 5 && (
                <div style={{ textAlign: "center", padding: 8, fontSize: "0.72rem", color: "#94a3b8" }}>
                  최근 5건만 표시. 전체 {history.length}건.
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 12, textAlign: "center", color: "#94a3b8", fontSize: "0.78rem" }}>발송 이력 없음</div>
          )}
        </details>
      </section>

      <section className={styles.interpretBlock}>
        <strong>테스트 모드 안내</strong>
        <p>현재 화이트리스트 대상자({whitelist.join(", ")})에게만 발송 가능. 고객 발송은 직원 테스트 완료 후 별도 확인 절차를 거침.</p>
      </section>
      </>
      ) : null}
    </>
  );
}
