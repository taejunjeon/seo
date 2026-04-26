"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AIBIO_ATTRIBUTION_KEYS,
  AIBIO_NATIVE_API_BASE,
  type AibioAttributionSnapshot,
  type AibioLeadDraft,
  type AibioLeadDraftReceipt,
} from "@/lib/aibio-native";

type AibioNativeLeadFormProps = {
  sectionId?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  storageSource?: string;
  variant?: "standard" | "offer";
};

const initialLead: AibioLeadDraft = {
  name: "",
  phone: "",
  ageRange: "",
  purpose: "metabolism",
  channel: "",
  preferredTime: "",
  consent: false,
  marketingConsent: false,
};

function readCookie(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function safeReadJson(key: string): AibioAttributionSnapshot {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AibioAttributionSnapshot) : {};
  } catch {
    return {};
  }
}

function collectAttribution(): AibioAttributionSnapshot {
  const params = new URLSearchParams(window.location.search);
  const snapshot: AibioAttributionSnapshot = {
    landing_path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || "",
    fbc: readCookie("_fbc"),
    fbp: readCookie("_fbp"),
    ga_client_id: readCookie("_ga"),
    capturedAt: new Date().toISOString(),
  };

  for (const key of AIBIO_ATTRIBUTION_KEYS) {
    const value = params.get(key);
    if (value) snapshot[key] = value;
  }

  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value));
}

function collectAndPersistAttribution() {
  const latest = collectAttribution();
  const first = safeReadJson("_aibio_native_first_touch");
  const firstTouch = Object.keys(first).length > 0 ? first : { ...latest, capturedAt: new Date().toISOString() };
  const lastTouch = { ...latest, capturedAt: new Date().toISOString() };

  try {
    window.localStorage.setItem("_aibio_native_first_touch", JSON.stringify(firstTouch));
    window.localStorage.setItem("_aibio_native_last_touch", JSON.stringify(lastTouch));
  } catch {
    // Attribution capture must not block lead submission.
  }

  return {
    attribution: { ...firstTouch, ...lastTouch },
    firstTouch,
    lastTouch,
  };
}

export function AibioNativeLeadForm({
  sectionId = "lead",
  eyebrow = "Native Lead Form",
  title = "자체 리드 원장에 상담 신청을 바로 저장합니다.",
  description = "이름과 연락처는 서버 원장에 저장하고, 목록 화면에는 마스킹해서 표시합니다. UTM, 광고 클릭 ID, 쿠키 기반 광고 키, referrer도 함께 남깁니다.",
  submitLabel = "상담 신청 저장",
  storageSource = "aibio_native_mvp",
  variant = "standard",
}: AibioNativeLeadFormProps) {
  const [lead, setLead] = useState<AibioLeadDraft>(initialLead);
  const [status, setStatus] = useState<"idle" | "submitting" | "ready" | "blocked" | "failed">("idle");
  const [receipt, setReceipt] = useState<AibioLeadDraftReceipt | null>(null);

  const filledRequiredCount = useMemo(() => {
    return [lead.name, lead.phone, lead.ageRange, lead.purpose, lead.channel, lead.preferredTime].filter(Boolean).length;
  }, [lead]);

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead.name || !lead.phone || !lead.ageRange || !lead.purpose || !lead.channel || !lead.preferredTime || !lead.consent) {
      setStatus("blocked");
      return;
    }

    try {
      setStatus("submitting");
      const { attribution, firstTouch, lastTouch } = collectAndPersistAttribution();
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/native-leads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...lead,
          privacyConsent: lead.consent,
          landingPath: `${window.location.pathname}${window.location.search}`,
          attribution,
          firstTouch,
          lastTouch,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        setStatus("blocked");
        return;
      }
      const nextReceipt = {
        leadId: String(body.leadId),
        receivedAt: String(body.receivedAt),
        nextStatus: String(body.nextStatus),
        nextStatusLabel: String(body.nextStatusLabel ?? body.nextStatus),
        duplicateOfLeadId: body.duplicateOfLeadId ? String(body.duplicateOfLeadId) : null,
        attributionKeys: Array.isArray(body.attributionKeys) ? body.attributionKeys.map(String) : [],
      };
      setReceipt(nextReceipt);
      window.localStorage.setItem(
        "aibio-native-lead-draft",
        JSON.stringify({
          ...nextReceipt,
          source: storageSource,
          mode: "local_sqlite_persistence",
        }),
      );
      (window as Window & { dataLayer?: { push?: (event: Record<string, unknown>) => void } }).dataLayer?.push?.({
        event: "aibio_native_lead_submit",
        lead_id: nextReceipt.leadId,
        lead_status: nextReceipt.nextStatus,
        duplicate_of_lead_id: nextReceipt.duplicateOfLeadId,
        attribution_key_count: nextReceipt.attributionKeys.length,
        lead_source: storageSource,
      });
      setLead(initialLead);
      setStatus("ready");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <section id={sectionId} className={`lead-section ${variant}`} aria-label="상담 신청 폼">
      <div className="lead-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="field-progress">
          <span>필수 입력 {filledRequiredCount}/6</span>
          <div><i style={{ width: `${(filledRequiredCount / 6) * 100}%` }} /></div>
        </div>
        <div className="attribution-preview" aria-label="수집된 유입 키">
          <span>수집된 유입 키</span>
          <strong>{receipt ? `${receipt.attributionKeys.length}개` : "제출 시"}</strong>
        </div>
      </div>

      <form className="lead-form" onSubmit={submitLead}>
        <label>
          이름
          <input
            value={lead.name}
            onChange={(event) => setLead({ ...lead, name: event.target.value })}
            placeholder="성함"
            autoComplete="name"
          />
        </label>
        <label>
          연락처
          <input
            value={lead.phone}
            onChange={(event) => setLead({ ...lead, phone: event.target.value })}
            placeholder="010-0000-0000"
            autoComplete="tel"
            inputMode="tel"
          />
        </label>
        <label>
          나이대
          <select value={lead.ageRange} onChange={(event) => setLead({ ...lead, ageRange: event.target.value })}>
            <option value="">선택</option>
            <option value="20s">20대</option>
            <option value="30s">30대</option>
            <option value="40s">40대</option>
            <option value="50s">50대 이상</option>
          </select>
        </label>
        <label>
          상담 목적
          <select value={lead.purpose} onChange={(event) => setLead({ ...lead, purpose: event.target.value })}>
            <option value="metabolism">대사/붓기 관리</option>
            <option value="appetite">식욕 조절</option>
            <option value="recovery">회복/컨디션</option>
            <option value="program">프로그램 상담</option>
          </select>
        </label>
        <label>
          알게 된 경로
          <select value={lead.channel} onChange={(event) => setLead({ ...lead, channel: event.target.value })}>
            <option value="">선택</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="naver">Naver</option>
            <option value="google">Google</option>
            <option value="referral">지인 소개</option>
          </select>
        </label>
        <label>
          연락 희망 시간
          <select value={lead.preferredTime} onChange={(event) => setLead({ ...lead, preferredTime: event.target.value })}>
            <option value="">선택</option>
            <option value="morning">오전</option>
            <option value="afternoon">오후</option>
            <option value="evening">저녁</option>
          </select>
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={lead.consent}
            onChange={(event) => setLead({ ...lead, consent: event.target.checked })}
          />
          개인정보 수집 및 상담 연락에 동의합니다.
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={lead.marketingConsent}
            onChange={(event) => setLead({ ...lead, marketingConsent: event.target.checked })}
          />
          마케팅 정보 수신에 동의합니다. 선택 항목입니다.
        </label>
        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "저장 중" : submitLabel}
        </button>
        {status === "blocked" && <p className="form-message error">필수 항목과 동의를 확인해 주세요.</p>}
        {status === "failed" && <p className="form-message error">리드 원장 저장에 실패했습니다. 백엔드 서버 상태를 확인해야 합니다.</p>}
        {status === "ready" && (
          <p className="form-message success">
            운영 리드 원장에 저장되었습니다. 접수번호: {receipt?.leadId} · 상태: {receipt?.nextStatusLabel}
            {receipt && receipt.attributionKeys.length > 0 ? ` · 유입 키 ${receipt.attributionKeys.length}개 확인` : ""}
            {receipt?.duplicateOfLeadId ? " · 30일 내 중복 접수 후보" : ""}
          </p>
        )}
      </form>

      <style jsx>{`
        .lead-section {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
          gap: 42px;
          align-items: start;
          padding: 86px 56px;
          background: #101a3f;
        }

        .lead-section.offer {
          padding: 72px 56px;
          background: #10213d;
        }

        .eyebrow {
          margin-bottom: 14px;
          color: #42b5ff;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .lead-copy h2 {
          margin: 0 0 18px;
          color: #ffffff;
          font-size: 2rem;
          line-height: 1.28;
          font-weight: 900;
          letter-spacing: 0;
        }

        .lead-copy p {
          color: rgba(255, 255, 255, 0.76);
          font-size: 0.98rem;
          line-height: 1.75;
          font-weight: 600;
          letter-spacing: 0;
        }

        .field-progress {
          margin-top: 28px;
          max-width: 420px;
        }

        .field-progress span {
          display: block;
          margin-bottom: 10px;
          color: #bfdbfe;
          font-size: 0.86rem;
          font-weight: 900;
        }

        .field-progress div {
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
        }

        .field-progress i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #42b5ff;
        }

        .attribution-preview {
          max-width: 420px;
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 16px;
          padding: 14px 16px;
          border-radius: 8px;
          color: #dbeafe;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .attribution-preview span,
        .attribution-preview strong {
          font-size: 0.86rem;
          font-weight: 900;
        }

        .lead-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 24px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.7);
        }

        .lead-form label {
          display: grid;
          gap: 8px;
          color: #334155;
          font-size: 0.82rem;
          font-weight: 900;
        }

        .lead-form input,
        .lead-form select {
          width: 100%;
          min-height: 48px;
          padding: 0 12px;
          border: 1px solid rgba(15, 23, 42, 0.15);
          border-radius: 6px;
          color: #172554;
          background: #ffffff;
          font: inherit;
          font-weight: 700;
        }

        .lead-form input:focus,
        .lead-form select:focus {
          outline: 3px solid rgba(66, 181, 255, 0.26);
          border-color: #42b5ff;
        }

        .consent {
          grid-column: 1 / -1;
          display: flex !important;
          grid-template-columns: none !important;
          align-items: center;
          gap: 10px !important;
          min-height: 42px;
          color: #475569 !important;
          font-size: 0.86rem !important;
          font-weight: 800 !important;
        }

        .consent input {
          width: 18px;
          height: 18px;
          min-height: 18px;
        }

        .lead-form button {
          grid-column: 1 / -1;
          min-height: 52px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #3758d4;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .lead-form button:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .form-message {
          grid-column: 1 / -1;
          margin: 0;
          padding: 12px 14px;
          border-radius: 6px;
          font-size: 0.86rem;
          font-weight: 800;
        }

        .form-message.error {
          color: #991b1b;
          background: #fee2e2;
        }

        .form-message.success {
          color: #065f46;
          background: #d1fae5;
        }

        @media (max-width: 980px) {
          .lead-section,
          .lead-section.offer {
            grid-template-columns: 1fr;
            padding: 64px 24px;
          }
        }

        @media (max-width: 620px) {
          .lead-form {
            grid-template-columns: 1fr;
          }

          .lead-copy h2 {
            font-size: 1.55rem;
          }
        }
      `}</style>
    </section>
  );
}
