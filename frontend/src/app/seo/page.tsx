"use client";

import { useEffect, useState } from "react";

import GlobalNav from "@/components/common/GlobalNav";
import SeoShell, { type SeoSection } from "@/components/seo/SeoShell";
import SeoHeader from "@/components/seo/SeoHeader";
import OverviewSection from "@/components/seo/OverviewSection";
import LiveGscSection from "@/components/seo/LiveGscSection";
import UrlPolicySection from "@/components/seo/UrlPolicySection";
import JsonLdSection from "@/components/seo/JsonLdSection";
import ProductTextSection from "@/components/seo/ProductTextSection";
import ChecklistSection from "@/components/seo/ChecklistSection";
import ApprovalsSection from "@/components/seo/ApprovalsSection";
import type {
  AuditResponse,
  ChecklistResponse,
  JsonLdResponse,
  ProductTextResponse,
  UrlPolicyResponse,
} from "@/components/seo/seo.types";

const SECTIONS: SeoSection[] = [
  { id: "overview", label: "종합 점수", hint: "54/100 · 6개 항목" },
  { id: "live-gsc", label: "실시간 검색 노출", hint: "GSC 클릭·노출·CTR·순위" },
  { id: "url-policy", label: "URL 정책", hint: "정책 매트릭스 · 중복 그룹" },
  { id: "jsonld", label: "JSON-LD", hint: "구조화 데이터 · 삽입 스니펫" },
  { id: "product-text", label: "상품 텍스트", hint: "상품 4개 H1/H2/H3/FAQ" },
  { id: "checklist", label: "운영 체크리스트", hint: "승인 게이트 · 롤백" },
  { id: "approvals", label: "승인 현황", hint: "A · B · C 게이트" },
];

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function SeoPage() {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [urlPolicy, setUrlPolicy] = useState<UrlPolicyResponse | null>(null);
  const [jsonld, setJsonld] = useState<JsonLdResponse | null>(null);
  const [productText, setProductText] = useState<ProductTextResponse | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [a, u, j, p, c] = await Promise.all([
        fetchJson<AuditResponse>("/seo/api/audit"),
        fetchJson<UrlPolicyResponse>("/seo/api/url-policy"),
        fetchJson<JsonLdResponse>("/seo/api/jsonld"),
        fetchJson<ProductTextResponse>("/seo/api/product-text"),
        fetchJson<ChecklistResponse>("/seo/api/checklist"),
      ]);
      setAudit(a);
      setUrlPolicy(u);
      setJsonld(j);
      setProductText(p);
      setChecklist(c);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <GlobalNav activeSlug="seo" />
      <SeoShell sections={SECTIONS}>
        <SeoHeader audit={audit} />
        {loading && <div className="seoLoading">진단 데이터 불러오는 중…</div>}
        <OverviewSection audit={audit} />
        <LiveGscSection />
        <UrlPolicySection data={urlPolicy} />
        <JsonLdSection data={jsonld} />
        <ProductTextSection data={productText} />
        <ChecklistSection data={checklist} />
        <ApprovalsSection />
      </SeoShell>
    </>
  );
}
