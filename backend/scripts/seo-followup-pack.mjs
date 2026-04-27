import fs from "node:fs/promises";
import path from "node:path";

const REPORT_DIR = path.join(process.cwd(), "reports", "seo");
const INVENTORY_FILE = path.join(REPORT_DIR, "url_inventory.csv");
const PAGE_AUDIT_FILE = path.join(REPORT_DIR, "page_seo_audit.csv");

const nowKst = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 16).replace("T", " ")} KST`;
};

const todayKst = () => nowKst().slice(0, 10);

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
};

const writeText = async (fileName, text) => {
  await fs.writeFile(path.join(REPORT_DIR, fileName), text, "utf-8");
};

const csvEscape = (value) => {
  const raw = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
  return raw;
};

const writeCsv = async (fileName, rows, columns) => {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ];
  await writeText(fileName, `${lines.join("\n")}\n`);
};

const mdTable = (columns, rows) => {
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) =>
    `| ${columns.map((column) => String(row[column.key] ?? "").replaceAll("\n", " ")).join(" | ")} |`,
  );
  return [header, sep, ...body].join("\n");
};

const findInventory = (rows, predicate) => rows.find(predicate) ?? {};

const makePolicyRows = (inventoryRows) => {
  const organicacid = findInventory(inventoryRows, (row) => row.url.includes("organicacid_store/?idx=259"));
  const igg = findInventory(inventoryRows, (row) => row.url.includes("igg_store/?idx=85"));
  const biobalance = findInventory(inventoryRows, (row) => row.url.includes("HealthFood/?idx=97"));
  const neuromaster = findInventory(inventoryRows, (row) => row.url.includes("HealthFood/?idx=198"));
  const healthInfoArticle = findInventory(inventoryRows, (row) => row.url.includes("healthinfo/?bmode=view&idx=5764202"));

  return [
    {
      type: "home",
      representative_url: "https://biocom.kr/",
      current_examples: "https://biocom.kr/index, https://biocom.kr/?mode=policy",
      canonical_policy: "홈은 https://biocom.kr/ 하나로 고정",
      sitemap_policy: "포함",
      noindex_policy: "색인 허용",
      action: "index, mode 파라미터 URL은 canonical을 홈으로 보내고 sitemap 제외",
      confidence: "86%",
    },
    {
      type: "service/category",
      representative_url: "https://biocom.kr/service",
      current_examples: "https://biocom.kr/service",
      canonical_policy: "서비스 소개 대표 URL 유지",
      sitemap_policy: "포함",
      noindex_policy: "색인 허용",
      action: "title/description 보강, h1 추가 필요",
      confidence: "78%",
    },
    {
      type: "lab/test service",
      representative_url: organicacid.final_url || "https://biocom.kr/organicacid_store/?idx=259",
      current_examples: "https://biocom.kr/organicacid, https://biocom.kr/organicacid_store, https://biocom.kr/organicacid_store/?idx=259",
      canonical_policy: "현재 canonical인 /shop_view/?idx=259 또는 최종 상품 URL 중 하나로 통일",
      sitemap_policy: "대표 URL만 포함",
      noindex_policy: "색인 허용",
      action: "내부 링크, sitemap, canonical 목적지를 같은 URL로 맞춤",
      confidence: "74%",
    },
    {
      type: "lab/test service",
      representative_url: igg.final_url || "https://biocom.kr/igg_store/?idx=85",
      current_examples: "https://biocom.kr/igg, https://biocom.kr/igg_store, https://biocom.kr/igg_store/?idx=85",
      canonical_policy: "음식물 과민증 분석 대표 URL 1개로 통일",
      sitemap_policy: "대표 URL만 포함",
      noindex_policy: "색인 허용",
      action: "canonical 목적지 확인 후 내부 구매 링크 정리",
      confidence: "72%",
    },
    {
      type: "product",
      representative_url: biobalance.final_url || "https://biocom.kr/HealthFood/?idx=97",
      current_examples: "https://biocom.kr/HealthFood, https://biocom.kr/HealthFood/?idx=97, https://biocom.kr/shop_view/97",
      canonical_policy: "상품 상세 대표 URL 1개로 통일",
      sitemap_policy: "대표 URL만 포함",
      noindex_policy: "색인 허용",
      action: "Product JSON-LD와 canonical 목적지 URL 일치",
      confidence: "80%",
    },
    {
      type: "product",
      representative_url: neuromaster.final_url || "https://biocom.kr/HealthFood/?idx=198",
      current_examples: "https://biocom.kr/HealthFood/?idx=198",
      canonical_policy: "상품 상세 대표 URL 유지",
      sitemap_policy: "대표 URL만 포함",
      noindex_policy: "색인 허용",
      action: "Product JSON-LD 시범 대상에 포함",
      confidence: "76%",
    },
    {
      type: "article/column",
      representative_url: healthInfoArticle.final_url || "https://biocom.kr/healthinfo/?bmode=view&idx=5764202",
      current_examples: "https://biocom.kr/healthinfo, /healthinfo/?bmode=view&idx=...",
      canonical_policy: "글 상세는 idx별 canonical 유지",
      sitemap_policy: "상위 칼럼과 주요 글만 포함",
      noindex_policy: "색인 허용",
      action: "Article JSON-LD와 h1/description 길이 정리",
      confidence: "78%",
    },
    {
      type: "review/board",
      representative_url: "상품 상세 페이지",
      current_examples: "https://biocom.kr/?q=...&bmode=view&interlock=shop_review&idx=...&t=board",
      canonical_policy: "개별 리뷰 URL은 상품 상세나 리뷰 목록으로 정리",
      sitemap_policy: "제외",
      noindex_policy: "noindex 권장",
      action: "검색 결과에 리뷰 잡음 URL이 뜨는지 GSC로 확인",
      confidence: "70%",
    },
    {
      type: "cart/login/member",
      representative_url: "색인 대상 아님",
      current_examples: "/login, /site_join_pattern_choice, /shop_cart",
      canonical_policy: "필요 없음",
      sitemap_policy: "제외",
      noindex_policy: "noindex 권장",
      action: "robots 차단과 meta robots 병행 가능 여부 확인",
      confidence: "84%",
    },
    {
      type: "search/filter",
      representative_url: "색인 대상 아님",
      current_examples: "https://biocom.kr/?q=...&page=...",
      canonical_policy: "상위 목록이나 홈으로 통일",
      sitemap_policy: "제외",
      noindex_policy: "noindex 권장",
      action: "내부 페이지네이션과 검색 결과 링크가 sitemap에 들어가지 않도록 유지",
      confidence: "82%",
    },
  ];
};

const makeProductRows = (inventoryRows) => [
  {
    key: "organicacid",
    product: "종합 대사기능 분석",
    url: findInventory(inventoryRows, (row) => row.url.includes("organicacid_store/?idx=259")).final_url || "https://biocom.kr/organicacid_store/?idx=259",
    page_type: "검사권",
    search_intent: "대사 저하, 피로, 체중 정체, 장 건강, 영양 불균형 원인을 검사로 확인하려는 사람",
    h1: "종합 대사기능 분석",
    h2_1: "이런 분께 필요합니다",
    body_1: "피로가 오래가거나 체중 조절이 잘 되지 않고, 식단과 영양제를 바꿔도 몸의 반응이 애매한 분께 맞습니다. 소변 유기산 검사를 통해 에너지 생성, 탄수화물과 지방 대사, 장내 환경, 영양 균형 신호를 함께 확인합니다.",
    h2_2: "무엇을 확인하나요",
    body_2: "대사 과정에서 남는 유기산 지표를 바탕으로 에너지 대사, 지방 대사, 탄수화물 대사, 장내균 불균형, 산화 스트레스, 영양 보조 필요성을 봅니다.",
    h2_3: "검사 후 무엇이 달라지나요",
    body_3: "검사 결과를 바탕으로 식사, 생활 습관, 영양 보충 방향을 개인별로 정리할 수 있습니다. 단순 증상 추측이 아니라 현재 몸의 대사 흐름을 기준으로 관리 우선순위를 세우는 것이 목적입니다.",
    faq_1: "검사는 병원 방문 없이 가능한가요?",
    answer_1: "상품 페이지에 안내된 검사 키트와 진행 방식 기준으로 확인해야 합니다. 운영 반영 전 최신 안내 문구와 일치 여부를 다시 확인해야 합니다.",
  },
  {
    key: "igg",
    product: "음식물 과민증 분석",
    url: findInventory(inventoryRows, (row) => row.url.includes("igg_store/?idx=85")).final_url || "https://biocom.kr/igg_store/?idx=85",
    page_type: "검사권",
    search_intent: "특정 음식을 먹은 뒤 속 불편함, 피부 반응, 컨디션 저하를 느끼는 사람",
    h1: "음식물 과민증 분석",
    h2_1: "이런 분께 필요합니다",
    body_1: "평소 자주 먹는 음식인데도 식후 더부룩함, 컨디션 저하, 반복되는 불편감이 있는 분께 필요합니다. 음식물 과민 반응 가능성을 확인해 식단 조정의 기준을 만드는 것이 목적입니다.",
    h2_2: "무엇을 확인하나요",
    body_2: "검사 항목과 판정 기준은 운영 페이지의 최신 안내를 기준으로 맞춰야 합니다. SEO 본문에는 특정 질병 진단처럼 보이는 표현을 피하고, 개인별 식단 관리 참고 자료라는 목적을 분명히 둡니다.",
    h2_3: "검사 후 무엇이 달라지나요",
    body_3: "자주 먹는 음식 중 조절 후보를 찾고, 무작정 제한식으로 가기 전에 우선순위를 정할 수 있습니다. 결과 해석은 전문가 상담 또는 공식 안내 기준과 함께 보는 것이 안전합니다.",
    faq_1: "알레르기 검사와 같은 검사인가요?",
    answer_1: "알레르기 진단과 동일하게 표현하면 안 됩니다. 운영 반영 전 바이오컴의 공식 검사 설명과 의료 표현 기준을 확인해야 합니다.",
  },
  {
    key: "biobalance",
    product: "바이오밸런스",
    url: findInventory(inventoryRows, (row) => row.url.includes("HealthFood/?idx=97")).final_url || "https://biocom.kr/HealthFood/?idx=97",
    page_type: "영양제",
    search_intent: "피로 회복, 미네랄, 마그네슘, 아연, 셀레늄, 비타민D를 한 번에 찾는 사람",
    h1: "바이오밸런스 90정",
    h2_1: "이런 분께 필요합니다",
    body_1: "일상 피로가 잦고 식사만으로 미네랄과 비타민D 섭취가 부족하다고 느끼는 분께 맞습니다. 마그네슘, 아연, 셀레늄, 비타민D 등 주요 영양소를 한 번에 관리하려는 사람에게 적합합니다.",
    h2_2: "주요 성분",
    body_2: "상품 페이지에 노출된 기준으로 마그네슘, 아연, 셀레늄, 비타민D, 크롬, 망간, 몰리브덴 등 기초 대사와 영양 균형에 필요한 성분을 강조합니다.",
    h2_3: "어떻게 먹나요",
    body_3: "섭취 방법은 제품 라벨과 공식 상세 안내를 기준으로 표기해야 합니다. SEO 본문에는 효능을 과장하지 않고, 균형 잡힌 식사와 함께 보조적으로 관리하는 제품임을 분명히 합니다.",
    faq_1: "온 가족이 함께 먹을 수 있나요?",
    answer_1: "연령, 건강 상태, 복용 중인 약에 따라 다를 수 있으므로 공식 섭취 안내와 전문가 상담 기준을 함께 안내해야 합니다.",
  },
  {
    key: "neuromaster",
    product: "뉴로마스터",
    url: findInventory(inventoryRows, (row) => row.url.includes("HealthFood/?idx=198")).final_url || "https://biocom.kr/HealthFood/?idx=198",
    page_type: "영양제",
    search_intent: "두뇌 건강, 집중력, 신경 영양, 수험생/직장인 컨디션 관리를 찾는 사람",
    h1: "뉴로마스터 60정",
    h2_1: "이런 분께 필요합니다",
    body_1: "업무나 학습 중 집중 유지가 어렵고, 두뇌 건강과 신경 영양 관리를 함께 보고 싶은 분께 맞습니다. 제품 상세의 실제 성분과 표시 문구를 기준으로 안전하게 설명해야 합니다.",
    h2_2: "무엇을 관리하나요",
    body_2: "두뇌 건강, 신경 기능, 에너지 관리와 관련된 영양 성분을 제품 표시 기준으로 정리합니다. 질병 치료나 기억력 개선을 단정하는 표현은 쓰지 않습니다.",
    h2_3: "누가 먼저 보면 좋나요",
    body_3: "수험생, 집중 업무가 많은 직장인, 생활 리듬이 불규칙한 사람처럼 컨디션 관리가 필요한 고객에게 제품의 역할을 설명합니다. 운영 반영 전 상세 성분표와 금지 표현을 확인해야 합니다.",
    faq_1: "집중력 개선 제품이라고 말해도 되나요?",
    answer_1: "단정 표현은 피해야 합니다. 건강기능식품 표시 기준과 실제 제품 인증 문구를 확인한 뒤 허용된 범위에서만 표현합니다.",
  },
];

const main = async () => {
  const measuredAt = nowKst();
  const inventoryRows = parseCsv(await fs.readFile(INVENTORY_FILE, "utf-8"));
  const pageRows = parseCsv(await fs.readFile(PAGE_AUDIT_FILE, "utf-8"));
  const policyRows = makePolicyRows(inventoryRows);
  const productRows = makeProductRows(inventoryRows);

  await writeCsv("url_policy_matrix.csv", policyRows, [
    "type",
    "representative_url",
    "current_examples",
    "canonical_policy",
    "sitemap_policy",
    "noindex_policy",
    "action",
    "confidence",
  ]);

  await writeCsv("product_text_block_matrix.csv", productRows, [
    "key",
    "product",
    "url",
    "page_type",
    "search_intent",
    "h1",
    "h2_1",
    "body_1",
    "h2_2",
    "body_2",
    "h2_3",
    "body_3",
    "faq_1",
    "answer_1",
  ]);

  const urlPolicyMd = `# 대표 URL 정책 추천서

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: \`reports/seo/url_inventory.csv\`, \`reports/seo/page_seo_audit.csv\`
Freshness: ${measuredAt}
Confidence: 78%

## 10초 요약

대표 URL 정책은 운영 반영 전 승인용 초안이다. 현재 sitemap은 parameter URL을 포함하지 않지만, 내부 링크와 최종 URL에는 \`?idx=\`, \`?q=\`, 리뷰 board URL이 섞여 있다. 우선 canonical, sitemap, 내부 링크, noindex를 같은 표로 확정해야 한다.

## 추천 정책표

${mdTable(
    [
      { key: "type", label: "유형" },
      { key: "representative_url", label: "대표 URL 후보" },
      { key: "canonical_policy", label: "canonical 정책" },
      { key: "sitemap_policy", label: "sitemap" },
      { key: "noindex_policy", label: "noindex" },
      { key: "action", label: "다음 작업" },
      { key: "confidence", label: "자신감" },
    ],
    policyRows,
  )}

## 바로 고칠 수 있는 것

1. robots.txt의 sitemap 지시문 중 Markdown 링크 형식 줄을 일반 URL 한 줄로 바꾼다.
2. \`?q=...\`, \`interlock=shop_review\`, \`t=board\` URL은 sitemap 제외와 noindex 후보로 둔다.
3. 상품 URL은 Product JSON-LD의 \`url\`과 canonical 목적지가 같아야 한다.
4. \`/organicacid\`, \`/organicacid_store\`, \`/organicacid_store/?idx=259\`, \`/shop_view/?idx=259\` 중 운영 대표 URL 1개를 정한다.

## 승인 요청

추천안 A: 상품/검사권은 현재 canonical이 가리키는 목적지를 기준으로 대표 URL을 맞추고, 리뷰/검색/로그인 계열은 noindex와 sitemap 제외로 정리한다.

제 추천: YES  
추천 자신감: 78%  
부족 데이터: Search Console 색인 URL 목록, 아임웹 관리자 canonical 제어 범위  
답변 형식: \`YES\` 또는 \`NO: 상품 URL은 기존 /HealthFood/?idx= 형태 유지\`
`;
  await writeText("url_policy_recommendations.md", urlPolicyMd);

  const productDraftMd = `# 상품 상세 텍스트 블록 초안

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: \`reports/seo/product_detail_content_audit.md\`, \`reports/seo/url_inventory.csv\`, 공개 페이지 title/description
Freshness: ${measuredAt}
Confidence: 72%

## 10초 요약

이 초안은 운영 페이지에 바로 붙일 최종 문구가 아니라 콘텐츠팀과 TJ님 승인용 구조안이다. 숨김 텍스트가 아니라 실제 사용자에게 보이는 H2/H3 본문 블록으로 넣는 전제를 둔다. 건강·검사 표현은 운영 반영 전 최신 상품 상세와 표시 가능 문구를 다시 맞춰야 한다.

## 상품별 초안

${productRows
    .map(
      (row) => `### ${row.product}

- URL: ${row.url}
- 유형: ${row.page_type}
- 검색 의도: ${row.search_intent}

#### ${row.h2_1}
${row.body_1}

#### ${row.h2_2}
${row.body_2}

#### ${row.h2_3}
${row.body_3}

#### 자주 묻는 질문
- 질문: ${row.faq_1}
- 답변: ${row.answer_1}`,
    )
    .join("\n\n")}

## 적용 원칙

- PC와 모바일 모두 사용자에게 보여야 한다.
- 글자색을 배경색과 같게 하거나 화면 밖으로 보내는 방식은 쓰지 않는다.
- FAQPage JSON-LD는 실제 화면에 보이는 질문답변만 넣는다.
- 가격, 후기 수, 재고는 운영 페이지 값과 불일치하면 구조화 데이터에 넣지 않는다.
`;
  await writeText("product_text_block_drafts.md", productDraftMd);

  const jsonldValidationRows = pageRows.map((row) => ({
    page: row.label,
    url: row.url,
    jsonld_count: row.jsonld_count,
    recommended_schema:
      row.key.includes("product") ? "Product, Offer, BreadcrumbList" :
      row.key.includes("article") ? "Article, BreadcrumbList" :
      row.key === "homepage" ? "Organization, WebSite" :
      row.key.includes("healthinfo") ? "ItemList 또는 CollectionPage" :
      "WebPage, BreadcrumbList",
    blocker:
      row.jsonld_count === "0"
        ? "현재 JSON-LD 없음"
        : "기존 JSON-LD와 충돌 여부 확인",
    confidence: row.jsonld_count === "0" ? "88%" : "70%",
  }));
  await writeCsv("jsonld_validation_matrix.csv", jsonldValidationRows, [
    "page",
    "url",
    "jsonld_count",
    "recommended_schema",
    "blocker",
    "confidence",
  ]);

  const jsonldValidationMd = `# JSON-LD 검증 매트릭스

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: \`reports/seo/page_seo_audit.csv\`, \`reports/seo/jsonld_samples/*\`
Freshness: ${measuredAt}
Confidence: 80%

## 10초 요약

핵심 페이지 6개는 현재 JSON-LD가 0개다. Product, Article, Organization, WebSite, BreadcrumbList를 페이지 유형에 맞춰 시범 삽입할 수 있다. 운영 반영 전에는 Google Rich Results Test 또는 Schema Markup Validator로 샘플을 재검증해야 한다.

## 페이지별 권장 schema

${mdTable(
    [
      { key: "page", label: "페이지" },
      { key: "url", label: "URL" },
      { key: "jsonld_count", label: "현재 JSON-LD" },
      { key: "recommended_schema", label: "권장 schema" },
      { key: "blocker", label: "막힌 점" },
      { key: "confidence", label: "자신감" },
    ],
    jsonldValidationRows,
  )}

## 운영 반영 전 체크

1. JSON 샘플이 문법상 유효한지 확인한다.
2. 실제 화면에 보이는 값만 JSON-LD에 넣는다.
3. 가격과 후기 수는 자동 갱신이 어렵다면 1차 샘플에서 제외하거나 운영자가 관리 가능한 방식으로 넣는다.
4. BreadcrumbList의 URL은 대표 URL 정책과 일치해야 한다.
`;
  await writeText("jsonld_validation_matrix.md", jsonldValidationMd);

  const sampleFiles = [
    ["product_organicacid", "종합 대사기능 분석 Product", "jsonld_samples/product_organicacid.json"],
    ["product_biobalance", "바이오밸런스 Product", "jsonld_samples/product_biobalance.json"],
    ["article_health_goal", "건강정보 글 Article", "jsonld_samples/article_health_goal.json"],
    ["organization_biocom", "바이오컴 Organization", "jsonld_samples/organization_biocom.json"],
    ["breadcrumb_examples", "BreadcrumbList 예시", "jsonld_samples/breadcrumb_examples.json"],
  ];
  const snippets = [];
  for (const [key, label, relativePath] of sampleFiles) {
    const raw = await fs.readFile(path.join(REPORT_DIR, relativePath), "utf-8");
    const parsed = JSON.parse(raw);
    snippets.push({
      key,
      label,
      relativePath,
      json: JSON.stringify(parsed, null, 2),
    });
  }

  const snippetMd = `# JSON-LD 삽입 스니펫

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: \`reports/seo/jsonld_samples/*\`
Freshness: ${measuredAt}
Confidence: 74%

## 10초 요약

아래 스니펫은 운영 게시 전 검증용 초안이다. 실제 아임웹/사용자 코드/GTM에 게시하기 전에는 대표 URL 정책, 화면 노출 값, 가격/재고/후기 일치 여부를 다시 확인해야 한다.

## 삽입 원칙

1. 페이지별로 해당 페이지에 맞는 JSON-LD만 넣는다.
2. BreadcrumbList의 URL은 \`reports/seo/url_policy_recommendations.md\`의 대표 URL 정책과 일치시킨다.
3. 가격과 재고가 자동 갱신되지 않으면 운영자가 관리 가능한 방식으로만 넣는다.
4. Review와 AggregateRating은 화면에 실제 평점/후기 수가 보일 때만 넣는다.

${snippets
    .map(
      (snippet) => `## ${snippet.label}

Source: \`${snippet.relativePath}\`

\`\`\`html
<script type="application/ld+json">
${snippet.json}
</script>
\`\`\``,
    )
    .join("\n\n")}
`;
  await writeText("jsonld_insertion_snippets.md", snippetMd);

  const checklistMd = `# SEO 운영 반영 체크리스트

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: 공개 URL 감사 산출물 전체
Freshness: ${measuredAt}
Confidence: 76%

## 10초 요약

이 문서는 운영 적용 순서다. 아직 승인 전이므로 실제 아임웹, GTM, Search Console, Naver Search Advisor에는 아무것도 게시하지 않는다.

## 운영 전 확인

| 순서 | 담당 | 작업 | 산출물 | 완료 기준 |
|---|---|---|---|---|
| 1 | TJ | 승인안 B 답변 | 대표 URL 정책 승인 | \`YES\` 또는 수정사항 |
| 2 | TJ | 승인안 C 답변 | 상품 텍스트 초안 승인 | \`YES\` 또는 제외 상품 |
| 3 | Codex | 대표 URL 최종표 작성 | 운영 요청서 | canonical, sitemap, noindex가 한 표에 있음 |
| 4 | Codex | JSON-LD 최종본 작성 | 삽입 스니펫 | 대표 URL과 JSON-LD url 일치 |
| 5 | Claude Code | 상품 상세 텍스트 UI 시안 | PC/모바일 시안 | 숨김 텍스트 없음 |
| 6 | TJ | 아임웹 또는 GTM 게시 승인 | 운영 반영 결정 | 게시 범위와 rollback 확인 |

## 운영 반영 순서

1. robots.txt의 Markdown sitemap 줄을 일반 URL 형식으로 고친다.
2. 리뷰/검색/로그인 계열 URL은 sitemap 제외와 noindex 가능 여부를 확인한다.
3. 상품/검사권 대표 URL 정책을 확정한다.
4. Product/Article/Organization/BreadcrumbList JSON-LD를 시범 페이지에 넣는다.
5. 상품 4개 텍스트 블록을 PC/모바일에서 보이게 넣는다.
6. Search Console과 Naver Search Advisor에서 sitemap과 핵심 URL을 다시 제출한다.
7. 7일 단위로 GSC 클릭, 노출, CTR, 순위, 색인 오류를 비교한다.

## 롤백 기준

- 상품 상세 전환율이 의미 있게 하락하면 텍스트 블록 노출 위치를 되돌린다.
- 구조화 데이터 테스트에서 오류가 나오면 JSON-LD만 제거한다.
- Search Console에서 색인 제외가 늘면 noindex 대상 URL을 다시 확인한다.
`;
  await writeText("operation_change_checklist.md", checklistMd);

  console.log(`SEO follow-up pack completed: ${measuredAt}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
