import { NextRequest, NextResponse } from "next/server";
import { GET as getAudit } from "@/app/seo/api/audit/route";
import { GET as getChecklist } from "@/app/seo/api/checklist/route";
import { GET as getJsonLd } from "@/app/seo/api/jsonld/route";
import { GET as getProductText } from "@/app/seo/api/product-text/route";
import { GET as getUrlCleanup } from "@/app/seo/api/url-cleanup/route";
import { GET as getUrlPolicy } from "@/app/seo/api/url-policy/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ kind: string }> | { kind: string };
};

const handlers: Record<string, () => Promise<Response>> = {
  audit: getAudit,
  checklist: getChecklist,
  jsonld: getJsonLd,
  "product-text": getProductText,
  "url-cleanup": getUrlCleanup,
  "url-policy": getUrlPolicy,
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const handler = handlers[params.kind];

  if (!handler) {
    return NextResponse.json({ error: "seo_data_not_found" }, { status: 404 });
  }

  return handler();
}
