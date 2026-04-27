import { NextResponse } from "next/server";
import { csvToObjects, extractListItems, getMdSection, readReportFile } from "@/components/seo/seo.utils";
import type { ProductDraft, ProductTextResponse } from "@/components/seo/seo.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const matrix = await readReportFile("reports/seo/product_text_block_matrix.csv");
  const drafts = await readReportFile("reports/seo/product_text_block_drafts.md");

  if (!matrix) {
    return NextResponse.json({ error: "product_text_files_not_found" }, { status: 404 });
  }

  const products: ProductDraft[] = csvToObjects(matrix.content).map((row) => ({
    key: row.key,
    product: row.product,
    url: row.url,
    pageType: row.page_type,
    searchIntent: row.search_intent,
    h1: row.h1,
    blocks: [
      { heading: row.h2_1, body: row.body_1 },
      { heading: row.h2_2, body: row.body_2 },
      { heading: row.h2_3, body: row.body_3 },
    ].filter((b) => b.heading && b.body),
    faq: { question: row.faq_1, answer: row.answer_1 },
  }));

  let principles: string[] = [];
  if (drafts) {
    principles = extractListItems(getMdSection(drafts.content, "적용 원칙"));
  }

  const payload: ProductTextResponse = {
    products,
    principles,
  };

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
