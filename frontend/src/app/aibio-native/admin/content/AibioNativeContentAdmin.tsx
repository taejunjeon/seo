"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  AIBIO_NATIVE_API_BASE,
  DEFAULT_SHOP_VIEW_25_CONTENT,
  type AibioNativePageContent,
} from "@/lib/aibio-native";

const ADMIN_TOKEN_STORAGE_KEY = "aibio-native-admin-token";

type ContentResponse = {
  ok: boolean;
  content?: AibioNativePageContent;
  error?: string;
};

type AssetUploadResponse = {
  ok: boolean;
  asset?: { url: string; filename: string; size: number; mimeType: string };
  error?: string;
};

type ImageTarget = "hero" | "program" | "proof";

const targetLabel: Record<ImageTarget, string> = {
  hero: "히어로 이미지",
  program: "프로그램 이미지",
  proof: "후기/측정 이미지",
};

const cloneContent = (content: AibioNativePageContent): AibioNativePageContent =>
  JSON.parse(JSON.stringify(content)) as AibioNativePageContent;

export function AibioNativeContentAdmin() {
  const [content, setContent] = useState<AibioNativePageContent>(() => cloneContent(DEFAULT_SHOP_VIEW_25_CONTENT));
  const [adminToken, setAdminToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    setAdminToken(stored);
    setTokenDraft(stored);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/content/shop-view-25`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body: ContentResponse) => {
        if (alive && body.ok && body.content) setContent(body.content);
      })
      .catch(() => setMessage("상세페이지 내용을 읽지 못해 기본값을 보여줍니다."))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const saveToken = () => {
    const next = tokenDraft.trim();
    setAdminToken(next);
    if (next) window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, next);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  };

  const patchContent = (patch: Partial<AibioNativePageContent>) => {
    setContent((current) => ({ ...current, ...patch }));
  };

  const patchNested = <K extends keyof AibioNativePageContent>(key: K, value: Partial<AibioNativePageContent[K]>) => {
    setContent((current) => ({
      ...current,
      [key]: {
        ...(current[key] as object),
        ...value,
      },
    }));
  };

  const updateOfferPoint = (index: number, field: "label" | "title" | "body", value: string) => {
    setContent((current) => ({
      ...current,
      offerPoints: current.offerPoints.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [field]: value } : point,
      ),
    }));
  };

  const updateFlow = (index: number, field: "step" | "title" | "body", value: string) => {
    setContent((current) => ({
      ...current,
      flow: current.flow.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const updateStrip = (index: number, field: "label" | "value", value: string) => {
    setContent((current) => ({
      ...current,
      strip: current.strip.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const saveContent = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/admin/content/shop-view-25`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
        },
        body: JSON.stringify(content),
      });
      const body = (await response.json()) as ContentResponse;
      if (!response.ok || !body.ok || !body.content) {
        throw new Error(response.status === 403 ? "관리자 토큰이 없거나 맞지 않습니다." : body.error ?? "저장 실패");
      }
      setContent(body.content);
      setMessage("저장되었습니다. 공개 랜딩 새로고침 시 반영됩니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (target: ImageTarget, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setMessage(`${targetLabel[target]} 업로드 중입니다.`);
    try {
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/admin/assets`, {
        method: "POST",
        headers: adminToken ? { "x-admin-token": adminToken } : {},
        body: formData,
      });
      const body = (await response.json()) as AssetUploadResponse;
      if (!response.ok || !body.ok || !body.asset) {
        throw new Error(response.status === 403 ? "관리자 토큰이 없거나 맞지 않습니다." : body.error ?? "이미지 업로드 실패");
      }
      patchNested(target, { imageUrl: `${AIBIO_NATIVE_API_BASE}${body.asset.url}` });
      setMessage(`${targetLabel[target]} 업로드 완료. 저장 버튼을 눌러 공개 내용에 반영하세요.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "이미지 업로드 실패");
    }
  };

  return (
    <main className="content-admin">
      <header className="admin-header">
        <div>
          <p>AIBIO Native Admin Phase2.5</p>
          <h1>상세페이지 문구와 이미지를 직접 바꿉니다.</h1>
          <span>디자인 모드 전체 복제가 아니라, 운영자가 자주 바꿀 텍스트·이미지·CTA만 먼저 열어둔 초안입니다.</span>
        </div>
        <nav aria-label="AIBIO 관리자 메뉴">
          <a href="/aibio-native/admin">고객/리드</a>
          <a href="/aibio-native/admin/forms">입력폼</a>
          <a href="/aibio-native/admin/access">권한</a>
          <a href="/shop_view?idx=25" target="_blank">공개 랜딩</a>
        </nav>
      </header>

      <section className="token-board" aria-label="관리자 토큰">
        <label>
          관리자 토큰
          <input type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="운영 secret 값" />
        </label>
        <button type="button" onClick={saveToken}>세션 저장</button>
        <span>{adminToken ? "토큰 입력됨" : "운영 저장에는 토큰 필요"}</span>
      </section>

      {message ? <div className="notice">{message}</div> : null}
      {loading ? <div className="notice">상세페이지 내용을 읽는 중입니다.</div> : null}

      <section className="editor-grid">
        <article className="panel">
          <h2>공개 상태</h2>
          <label>
            상태
            <select value={content.status} onChange={(event) => patchContent({ status: event.target.value as AibioNativePageContent["status"] })}>
              <option value="draft">초안</option>
              <option value="review">리뷰</option>
              <option value="published">게시</option>
            </select>
          </label>
          <p>route: {content.route}</p>
          <p>updated: {new Date(content.updatedAt).toLocaleString("ko-KR")}</p>
        </article>

        <article className="panel">
          <h2>히어로</h2>
          <TextInput label="작은 제목" value={content.hero.eyebrow} onChange={(value) => patchNested("hero", { eyebrow: value })} />
          <TextInput label="큰 제목" value={content.hero.title} onChange={(value) => patchNested("hero", { title: value })} />
          <TextArea label="본문" value={content.hero.body} onChange={(value) => patchNested("hero", { body: value })} />
          <TextInput label="주 CTA" value={content.hero.primaryCta} onChange={(value) => patchNested("hero", { primaryCta: value })} />
          <TextInput label="보조 CTA" value={content.hero.secondaryCta} onChange={(value) => patchNested("hero", { secondaryCta: value })} />
          <ImageInput target="hero" value={content.hero.imageUrl} onUpload={uploadImage} onChange={(value) => patchNested("hero", { imageUrl: value })} />
        </article>

        <article className="panel">
          <h2>핵심 지표 스트립</h2>
          {content.strip.map((item, index) => (
            <div className="two-col" key={`${item.label}-${index}`}>
              <TextInput label={`라벨 ${index + 1}`} value={item.label} onChange={(value) => updateStrip(index, "label", value)} />
              <TextInput label={`값 ${index + 1}`} value={item.value} onChange={(value) => updateStrip(index, "value", value)} />
            </div>
          ))}
        </article>

        <article className="panel">
          <h2>프로그램 섹션</h2>
          <TextInput label="작은 제목" value={content.program.eyebrow} onChange={(value) => patchNested("program", { eyebrow: value })} />
          <TextInput label="제목" value={content.program.title} onChange={(value) => patchNested("program", { title: value })} />
          <TextArea label="본문" value={content.program.body} onChange={(value) => patchNested("program", { body: value })} />
          <ImageInput target="program" value={content.program.imageUrl} onUpload={uploadImage} onChange={(value) => patchNested("program", { imageUrl: value })} />
        </article>

        <article className="panel wide">
          <h2>카드 3개</h2>
          <div className="cards-edit">
            {content.offerPoints.map((point, index) => (
              <div key={`${point.title}-${index}`} className="mini-card">
                <TextInput label="라벨" value={point.label} onChange={(value) => updateOfferPoint(index, "label", value)} />
                <TextInput label="제목" value={point.title} onChange={(value) => updateOfferPoint(index, "title", value)} />
                <TextArea label="본문" value={point.body} onChange={(value) => updateOfferPoint(index, "body", value)} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel wide">
          <h2>진행 흐름</h2>
          <div className="cards-edit">
            {content.flow.map((item, index) => (
              <div key={`${item.step}-${index}`} className="mini-card">
                <TextInput label="번호" value={item.step} onChange={(value) => updateFlow(index, "step", value)} />
                <TextInput label="제목" value={item.title} onChange={(value) => updateFlow(index, "title", value)} />
                <TextArea label="본문" value={item.body} onChange={(value) => updateFlow(index, "body", value)} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>증거/측정 섹션</h2>
          <TextInput label="작은 제목" value={content.proof.eyebrow} onChange={(value) => patchNested("proof", { eyebrow: value })} />
          <TextInput label="제목" value={content.proof.title} onChange={(value) => patchNested("proof", { title: value })} />
          <TextArea label="본문" value={content.proof.body} onChange={(value) => patchNested("proof", { body: value })} />
          <ImageInput target="proof" value={content.proof.imageUrl} onUpload={uploadImage} onChange={(value) => patchNested("proof", { imageUrl: value })} />
        </article>

        <article className="panel">
          <h2>상담폼 문구</h2>
          <TextInput label="작은 제목" value={content.form.eyebrow} onChange={(value) => patchNested("form", { eyebrow: value })} />
          <TextInput label="제목" value={content.form.title} onChange={(value) => patchNested("form", { title: value })} />
          <TextArea label="설명" value={content.form.description} onChange={(value) => patchNested("form", { description: value })} />
          <TextInput label="버튼 문구" value={content.form.submitLabel} onChange={(value) => patchNested("form", { submitLabel: value })} />
        </article>
      </section>

      <div className="sticky-actions">
        <button type="button" onClick={saveContent} disabled={saving}>{saving ? "저장 중" : "상세페이지 저장"}</button>
        <a href="/shop_view?idx=25" target="_blank">공개 페이지 보기</a>
      </div>

      <style jsx global>{`
        .content-admin {
          min-height: 100vh;
          padding: 32px;
          color: #172554;
          background: #eef4ff;
          font-family: var(--font-sans), system-ui, sans-serif;
        }

        .admin-header,
        .token-board {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .admin-header p {
          margin: 0 0 8px;
          color: #3758d4;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .admin-header h1 {
          margin: 0;
          font-size: clamp(1.8rem, 3vw, 3rem);
          letter-spacing: 0;
        }

        .admin-header span,
        .panel p,
        .token-board span {
          color: #64748b;
          font-size: 0.84rem;
          font-weight: 750;
        }

        nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        nav a,
        .sticky-actions a,
        .token-board button,
        .sticky-actions button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          padding: 0 12px;
          color: #ffffff;
          background: #3758d4;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .token-board,
        .panel,
        .notice {
          border: 1px solid rgba(55, 88, 212, 0.12);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 16px 34px rgba(31, 41, 55, 0.06);
        }

        .token-board {
          align-items: end;
          padding: 16px;
        }

        .token-board label,
        .panel label {
          display: grid;
          gap: 6px;
          color: #475569;
          font-size: 0.76rem;
          font-weight: 900;
        }

        input,
        textarea,
        select {
          width: 100%;
          min-height: 38px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          color: #172554;
          background: #ffffff;
          font: inherit;
          font-size: 0.86rem;
        }

        textarea {
          min-height: 116px;
          resize: vertical;
          line-height: 1.55;
        }

        .notice {
          margin-bottom: 16px;
          padding: 12px 14px;
          color: #1d4ed8;
          font-size: 0.86rem;
          font-weight: 850;
        }

        .editor-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          padding-bottom: 92px;
        }

        .panel {
          display: grid;
          gap: 12px;
          padding: 18px;
        }

        .panel.wide {
          grid-column: 1 / -1;
        }

        .panel h2 {
          margin: 0;
          font-size: 1.08rem;
          letter-spacing: 0;
        }

        .two-col,
        .cards-edit {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .cards-edit {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .mini-card {
          display: grid;
          gap: 10px;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
        }

        .image-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: end;
        }

        .file-button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          padding: 0 12px;
          color: #172554;
          background: #e0e7ff;
          font-size: 0.8rem;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .file-button input {
          display: none;
        }

        .sticky-actions {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 20;
          display: flex;
          gap: 8px;
          padding: 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.16);
        }

        .sticky-actions a {
          color: #172554;
          background: #e0e7ff;
        }

        @media (max-width: 900px) {
          .content-admin {
            padding: 20px 14px 110px;
          }

          .admin-header,
          .token-board {
            flex-direction: column;
            align-items: stretch;
          }

          nav,
          .two-col,
          .cards-edit,
          .editor-grid {
            grid-template-columns: 1fr;
          }

          nav {
            justify-content: flex-start;
          }

          .panel.wide {
            grid-column: auto;
          }

          .sticky-actions {
            right: 10px;
            bottom: 10px;
            left: 10px;
          }
        }
      `}</style>
    </main>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ImageInput({
  target,
  value,
  onChange,
  onUpload,
}: {
  target: ImageTarget;
  value: string;
  onChange: (value: string) => void;
  onUpload: (target: ImageTarget, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="image-row">
      <TextInput label={targetLabel[target]} value={value} onChange={onChange} />
      <label className="file-button">
        업로드
        <input type="file" accept="image/*" onChange={(event) => onUpload(target, event)} />
      </label>
    </div>
  );
}
