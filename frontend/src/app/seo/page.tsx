"use client";

import { useEffect, useState } from "react";

import GlobalNav from "@/components/common/GlobalNav";
import SeoShell, { type SeoSection } from "@/components/seo/SeoShell";
import SeoHeader from "@/components/seo/SeoHeader";
import TopDecisionBox from "@/components/seo/TopDecisionBox";
import OverviewSection from "@/components/seo/OverviewSection";
import LiveGscSection from "@/components/seo/LiveGscSection";
import BaselineSection from "@/components/seo/BaselineSection";
import SeoP0ConfirmSection from "@/components/seo/SeoP0ConfirmSection";
import CanonicalDistributionCard from "@/components/seo/CanonicalDistributionCard";
import UrlPolicySection from "@/components/seo/UrlPolicySection";
import JsonLdSection from "@/components/seo/JsonLdSection";
import ProductTextSection from "@/components/seo/ProductTextSection";
import AeoExplainerSection from "@/components/seo/AeoExplainerSection";
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
  { id: "overview", label: "종합 점수", hint: "54/100 · 6항목 + 이유" },
  { id: "live-gsc", label: "지금 검색 성과", hint: "GSC 7일 KPI" },
  { id: "baseline", label: "성과 기준선", hint: "7/28/90일 baseline" },
  { id: "p0-confirm", label: "P0 컨펌 요청", hint: "상품 4 + GSC 10" },
  { id: "canonical-check", label: "대표 URL 검증", hint: "같은 상품 흩어짐" },
  { id: "url-policy", label: "URL 처리 기준표", hint: "정책표 + 인벤토리" },
  { id: "jsonld", label: "검색엔진 설명서", hint: "JSON-LD 5종" },
  { id: "product-text", label: "상품 텍스트 초안", hint: "검사 2 + 영양제 2" },
  { id: "aeo-explainer", label: "AEO 확장", hint: "AI 검색 최적화" },
  { id: "checklist", label: "운영 체크리스트", hint: "승인 게이트 · 롤백" },
  { id: "approvals", label: "승인 현황", hint: "A · B · C · D 게이트" },
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
        <TopDecisionBox />
        <SeoHeader audit={audit} />
        {loading && <div className="seoLoading">진단 데이터 불러오는 중…</div>}
        <OverviewSection audit={audit} />
        <LiveGscSection />
        <BaselineSection />
        <SeoP0ConfirmSection productText={productText} jsonld={jsonld} />
        <CanonicalDistributionCard />
        <UrlPolicySection data={urlPolicy} />
        <JsonLdSection data={jsonld} />
        <ProductTextSection data={productText} />
        <AeoExplainerSection />
        <ChecklistSection data={checklist} />
        <ApprovalsSection />
      </SeoShell>
    </>
  );
}
