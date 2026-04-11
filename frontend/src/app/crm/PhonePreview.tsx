"use client";

import React from "react";

type PhonePreviewButton = {
  name: string;
  linkType?: string;
  linkMo?: string;
  linkPc?: string;
};

type PhonePreviewProps = {
  channel: "alimtalk" | "sms";
  senderName?: string;
  messageType?: "BA" | "AD";
  body: string;
  buttons?: PhonePreviewButton[];
  receiver?: string;
  charCount?: number;
  charLimit?: number;
  costEstimate?: string;
};

export default function PhonePreview({
  channel,
  senderName = "더클린커피",
  messageType,
  body,
  buttons,
  receiver,
  charCount,
  charLimit,
  costEstimate,
}: PhonePreviewProps) {
  const isAlimtalk = channel === "alimtalk";
  const typeLabel = messageType === "AD" ? "(광고)" : messageType === "BA" ? "(정보)" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* 폰 프레임 */}
      <div style={{
        width: 280, minHeight: 460, borderRadius: 28, padding: "12px 8px 16px",
        background: isAlimtalk ? "#b2c7d9" : "#fff",
        border: "2px solid #d1d5db", position: "relative",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}>
        {/* 노치 */}
        <div style={{
          width: 80, height: 6, borderRadius: 3, background: "#94a3b8",
          margin: "0 auto 10px",
        }} />

        {/* 헤더 */}
        <div style={{
          textAlign: "center", padding: "6px 0 10px",
          fontSize: "0.72rem", fontWeight: 700,
          color: isAlimtalk ? "#1e293b" : "#334155",
        }}>
          {senderName}
          {receiver && (
            <div style={{ fontSize: "0.62rem", color: "#64748b", fontWeight: 400, marginTop: 2 }}>
              {receiver}
            </div>
          )}
        </div>

        {/* 메시지 영역 */}
        <div style={{ padding: "0 8px" }}>
          {isAlimtalk ? (
            /* 카카오 알림톡 스타일 */
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              {/* 프로필 아이콘 */}
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: "#fee500",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.6rem", fontWeight: 700, color: "#3c1e1e", flexShrink: 0,
              }}>
                K
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 발신자명 + 타입 */}
                <div style={{ fontSize: "0.62rem", color: "#475569", marginBottom: 3 }}>
                  {typeLabel}{senderName}
                </div>
                {/* 말풍선 */}
                <div style={{
                  background: "#fff", borderRadius: "0 12px 12px 12px", padding: "10px 12px",
                  fontSize: "0.7rem", color: "#1e293b", lineHeight: 1.6,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  maxHeight: 240, overflow: "auto",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}>
                  {body || <span style={{ color: "#94a3b8" }}>메시지 내용이 여기에 표시됩니다</span>}
                </div>
                {/* 버튼 */}
                {buttons && buttons.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    {buttons.map((btn, i) => (
                      <div key={i} style={{
                        padding: "8px 12px", borderRadius: 6, textAlign: "center",
                        fontSize: "0.68rem", fontWeight: 600,
                        background: "#fee500", color: "#3c1e1e",
                        cursor: "default",
                      }}>
                        {btn.name}
                      </div>
                    ))}
                  </div>
                )}
                {/* 수신거부 */}
                <div style={{ fontSize: "0.56rem", color: "#94a3b8", marginTop: 6 }}>
                  수신거부 | 홈 &gt; 채널차단
                </div>
              </div>
            </div>
          ) : (
            /* SMS 스타일 */
            <div style={{
              background: "#dcf8c6", borderRadius: "12px 12px 12px 0", padding: "10px 12px",
              fontSize: "0.72rem", color: "#1e293b", lineHeight: 1.6,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 300, overflow: "auto",
            }}>
              {body || <span style={{ color: "#94a3b8" }}>SMS 메시지 내용</span>}
            </div>
          )}
        </div>
      </div>

      {/* 하단 정보 */}
      <div style={{ display: "flex", gap: 12, fontSize: "0.68rem", color: "#64748b" }}>
        {charCount !== undefined && charLimit !== undefined && (
          <span style={{ color: charCount > charLimit ? "#dc2626" : "#64748b" }}>
            {charCount}/{charLimit}자
          </span>
        )}
        {costEstimate && (
          <span>예상 비용: {costEstimate}</span>
        )}
      </div>
    </div>
  );
}
