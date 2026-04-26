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

const FIELD_LABELS: Record<string, string> = {
  name: "이름",
  phone: "연락처",
  ageRange: "나이대",
  purpose: "상담 목적",
  channel: "알게 된 경로",
  preferredTime: "연락 희망 시간",
  privacyConsent: "개인정보 수집 동의",
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

function formatKoreanPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isValidKoreanMobile(formatted: string) {
  const digits = formatted.replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits);
}

export function AibioNativeLeadForm({
  sectionId = "lead",
  eyebrow = "Native Lead Form",
  title = "상담 신청 후 24시간 안에 운영팀이 연락드립니다.",
  description = "이름과 연락처는 AIBIO 운영팀만 보는 안전한 장부에 저장합니다. 광고 키와 유입 정보는 상담 응대용 메모로만 사용합니다.",
  submitLabel = "상담 신청하기",
  storageSource = "aibio_native_mvp",
  variant = "standard",
}: AibioNativeLeadFormProps) {
  const [lead, setLead] = useState<AibioLeadDraft>(initialLead);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "ready" | "blocked" | "failed">("idle");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [receipt, setReceipt] = useState<AibioLeadDraftReceipt | null>(null);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);

  const filledRequiredCount = useMemo(() => {
    return [lead.name, lead.phone, lead.ageRange, lead.purpose, lead.channel, lead.preferredTime].filter(Boolean).length;
  }, [lead]);

  const phoneInvalidVisible = phoneTouched && phoneInput.length > 0 && !isValidKoreanMobile(phoneInput);

  const handlePhoneChange = (value: string) => {
    const formatted = formatKoreanPhone(value);
    setPhoneInput(formatted);
    setLead((prev) => ({ ...prev, phone: formatted }));
    if (missingFields.includes("phone")) {
      setMissingFields((prev) => prev.filter((field) => field !== "phone"));
    }
  };

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const localMissing: string[] = [];
    if (!lead.name.trim()) localMissing.push("name");
    if (!isValidKoreanMobile(phoneInput)) localMissing.push("phone");
    if (!lead.ageRange) localMissing.push("ageRange");
    if (!lead.purpose) localMissing.push("purpose");
    if (!lead.channel) localMissing.push("channel");
    if (!lead.preferredTime) localMissing.push("preferredTime");
    if (!lead.consent) localMissing.push("privacyConsent");

    if (localMissing.length > 0) {
      setMissingFields(localMissing);
      setErrorMessage(buildMissingMessage(localMissing));
      setStatus("blocked");
      return;
    }

    try {
      setStatus("submitting");
      setMissingFields([]);
      setErrorMessage("");
      const { attribution, firstTouch, lastTouch } = collectAndPersistAttribution();
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/native-leads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...lead,
          phone: phoneInput,
          privacyConsent: lead.consent,
          landingPath: `${window.location.pathname}${window.location.search}`,
          attribution,
          firstTouch,
          lastTouch,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        const serverMissing = Array.isArray(body?.missing) ? body.missing.map(String) : [];
        if (serverMissing.length > 0) {
          setMissingFields(serverMissing);
          setErrorMessage(buildMissingMessage(serverMissing));
        } else {
          setErrorMessage("입력하신 정보를 다시 확인해 주세요.");
        }
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
      setPhoneInput("");
      setPhoneTouched(false);
      setStatus("ready");
    } catch {
      setErrorMessage("일시적인 네트워크 오류로 신청이 저장되지 않았습니다. 잠시 후 다시 시도하시거나 카카오 상담을 이용해 주세요.");
      setStatus("failed");
    }
  };

  const fieldClass = (field: string) =>
    missingFields.includes(field) ? "field-error" : "";

  return (
    <section id={sectionId} className={`lead-section ${variant}`} aria-label="상담 신청 폼">
      <div className="lead-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="field-progress" aria-live="polite">
          <span>입력 진행 {filledRequiredCount}/6</span>
          <div><i style={{ width: `${(filledRequiredCount / 6) * 100}%` }} /></div>
        </div>
      </div>

      <form className="lead-form" onSubmit={submitLead} noValidate>
        <label className={fieldClass("name")}>
          <span className="label-text">이름 <em aria-hidden>*</em></span>
          <input
            value={lead.name}
            onChange={(event) => {
              setLead({ ...lead, name: event.target.value });
              if (missingFields.includes("name")) setMissingFields((prev) => prev.filter((f) => f !== "name"));
            }}
            placeholder="성함을 입력해 주세요"
            autoComplete="name"
            aria-invalid={missingFields.includes("name")}
          />
        </label>
        <label className={fieldClass("phone")}>
          <span className="label-text">연락처 <em aria-hidden>*</em></span>
          <input
            value={phoneInput}
            onChange={(event) => handlePhoneChange(event.target.value)}
            onBlur={() => setPhoneTouched(true)}
            placeholder="010-1234-5678"
            autoComplete="tel"
            inputMode="numeric"
            type="tel"
            maxLength={13}
            aria-invalid={phoneInvalidVisible || missingFields.includes("phone")}
          />
          {phoneInvalidVisible && (
            <small className="field-hint">010으로 시작하는 휴대폰 번호를 입력해 주세요.</small>
          )}
        </label>
        <label className={fieldClass("ageRange")}>
          <span className="label-text">나이대 <em aria-hidden>*</em></span>
          <select
            value={lead.ageRange}
            onChange={(event) => {
              setLead({ ...lead, ageRange: event.target.value });
              if (missingFields.includes("ageRange")) setMissingFields((prev) => prev.filter((f) => f !== "ageRange"));
            }}
            aria-invalid={missingFields.includes("ageRange")}
          >
            <option value="">선택</option>
            <option value="20s">20대</option>
            <option value="30s">30대</option>
            <option value="40s">40대</option>
            <option value="50s">50대 이상</option>
          </select>
        </label>
        <label className={fieldClass("purpose")}>
          <span className="label-text">상담 목적 <em aria-hidden>*</em></span>
          <select
            value={lead.purpose}
            onChange={(event) => {
              setLead({ ...lead, purpose: event.target.value });
              if (missingFields.includes("purpose")) setMissingFields((prev) => prev.filter((f) => f !== "purpose"));
            }}
            aria-invalid={missingFields.includes("purpose")}
          >
            <option value="metabolism">대사/붓기 관리</option>
            <option value="appetite">식욕 조절</option>
            <option value="recovery">회복/컨디션</option>
            <option value="program">프로그램 상담</option>
          </select>
        </label>
        <label className={fieldClass("channel")}>
          <span className="label-text">알게 된 경로 <em aria-hidden>*</em></span>
          <select
            value={lead.channel}
            onChange={(event) => {
              setLead({ ...lead, channel: event.target.value });
              if (missingFields.includes("channel")) setMissingFields((prev) => prev.filter((f) => f !== "channel"));
            }}
            aria-invalid={missingFields.includes("channel")}
          >
            <option value="">선택</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="naver">Naver</option>
            <option value="google">Google</option>
            <option value="referral">지인 소개</option>
          </select>
        </label>
        <label className={fieldClass("preferredTime")}>
          <span className="label-text">연락 희망 시간 <em aria-hidden>*</em></span>
          <select
            value={lead.preferredTime}
            onChange={(event) => {
              setLead({ ...lead, preferredTime: event.target.value });
              if (missingFields.includes("preferredTime")) setMissingFields((prev) => prev.filter((f) => f !== "preferredTime"));
            }}
            aria-invalid={missingFields.includes("preferredTime")}
          >
            <option value="">선택</option>
            <option value="morning">오전 (10시-12시)</option>
            <option value="afternoon">오후 (12시-18시)</option>
            <option value="evening">저녁 (18시-21시)</option>
          </select>
        </label>
        <div className={`consent-block ${missingFields.includes("privacyConsent") ? "field-error" : ""}`}>
          <label className="consent">
            <input
              type="checkbox"
              checked={lead.consent}
              onChange={(event) => {
                setLead({ ...lead, consent: event.target.checked });
                if (missingFields.includes("privacyConsent") && event.target.checked) {
                  setMissingFields((prev) => prev.filter((f) => f !== "privacyConsent"));
                }
              }}
              aria-invalid={missingFields.includes("privacyConsent")}
            />
            <span>
              [필수] 개인정보 수집·이용에 동의합니다.{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => setShowPrivacyDetail((prev) => !prev)}
                aria-expanded={showPrivacyDetail}
              >
                {showPrivacyDetail ? "접기" : "자세히"}
              </button>
            </span>
          </label>
          {showPrivacyDetail && (
            <p className="consent-detail">
              수집 항목: 이름, 휴대폰 번호, 나이대, 상담 목적, 유입 경로 · 이용 목적: 상담 연결 및 방문 안내 · 보유 기간: 상담 종료 후 1년 또는 동의 철회 시까지. 동의를 거부하실 수 있으나 거부 시 상담 연결이 어렵습니다.
            </p>
          )}
        </div>
        <label className="consent">
          <input
            type="checkbox"
            checked={lead.marketingConsent}
            onChange={(event) => setLead({ ...lead, marketingConsent: event.target.checked })}
          />
          <span>[선택] 이벤트·할인 안내 메시지 수신에 동의합니다.</span>
        </label>
        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "신청 저장 중..." : submitLabel}
        </button>
        {(status === "blocked" || status === "failed") && errorMessage && (
          <p className="form-message error" role="alert">{errorMessage}</p>
        )}
        {status === "ready" && receipt && (
          <div className="form-message success" role="status">
            <strong>상담 신청이 접수되었습니다.</strong>
            <span>운영팀이 영업일 기준 24시간 안에 입력하신 번호로 연락드립니다.</span>
            <small>접수번호 {receipt.leadId.slice(-8).toUpperCase()}</small>
          </div>
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
          scroll-margin-top: 96px;
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
          transition: width 220ms ease-out;
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

        .lead-form label .label-text {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
        }

        .lead-form label em {
          color: #dc2626;
          font-style: normal;
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

        .field-error input,
        .field-error select {
          border-color: #dc2626;
          background: #fef2f2;
        }

        .field-hint {
          color: #b91c1c;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .consent-block {
          grid-column: 1 / -1;
          padding: 12px;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .consent-block.field-error {
          border-color: #dc2626;
          background: #fef2f2;
        }

        .consent {
          grid-column: 1 / -1;
          display: flex !important;
          grid-template-columns: none !important;
          align-items: flex-start;
          gap: 10px !important;
          min-height: 42px;
          color: #475569 !important;
          font-size: 0.86rem !important;
          font-weight: 700 !important;
          line-height: 1.5;
        }

        .consent input {
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
          min-height: 20px;
          margin-top: 2px;
        }

        .consent span {
          flex: 1;
        }

        .lead-form .consent-block .link-button {
          display: inline;
          width: auto;
          min-height: 0;
          padding: 0;
          margin: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #2563eb;
          font: inherit;
          font-weight: 800;
          text-decoration: underline;
          cursor: pointer;
        }

        .consent-detail {
          margin: 10px 0 0;
          padding: 10px 12px;
          border-radius: 4px;
          background: #ffffff;
          color: #475569 !important;
          font-size: 0.78rem !important;
          font-weight: 600 !important;
          line-height: 1.6 !important;
        }

        .lead-form button {
          grid-column: 1 / -1;
          min-height: 56px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #3758d4;
          font: inherit;
          font-size: 1rem;
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
          padding: 14px 16px;
          border-radius: 6px;
          font-size: 0.88rem;
          font-weight: 800;
          line-height: 1.5;
        }

        .form-message.error {
          color: #991b1b;
          background: #fee2e2;
        }

        .form-message.success {
          display: grid;
          gap: 6px;
          color: #065f46;
          background: #d1fae5;
        }

        .form-message.success strong {
          font-size: 0.96rem;
          font-weight: 900;
        }

        .form-message.success span {
          font-weight: 700;
        }

        .form-message.success small {
          color: #047857;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        @media (max-width: 980px) {
          .lead-section,
          .lead-section.offer {
            grid-template-columns: 1fr;
            padding: 64px 24px 120px;
          }
        }

        @media (max-width: 620px) {
          .lead-form {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .lead-copy h2 {
            font-size: 1.55rem;
          }

          .lead-form input,
          .lead-form select {
            min-height: 52px;
            font-size: 1rem;
          }

          .lead-form button {
            min-height: 60px;
            font-size: 1.05rem;
          }
        }
      `}</style>
    </section>
  );
}

function buildMissingMessage(missing: string[]) {
  if (missing.length === 0) return "";
  if (missing.length === 1 && missing[0] === "phone") {
    return "010으로 시작하는 휴대폰 번호를 입력해 주세요.";
  }
  if (missing.length === 1 && missing[0] === "privacyConsent") {
    return "개인정보 수집 동의에 체크해 주세요.";
  }
  const labels = missing.map((field) => FIELD_LABELS[field] ?? field).join(", ");
  return `필수 항목을 확인해 주세요: ${labels}`;
}
