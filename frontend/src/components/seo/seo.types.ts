export type ScoreEntry = {
  label: string;
  score: number;
  max: number;
};

export type AuditPageRow = {
  key: string;
  label: string;
  url: string;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  canonical: string;
  jsonLdCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  wordCount: number;
  h1Count: number;
  h2Count: number;
  fetchStatus: number;
  renderedStatus: number;
};

export type AuditDuplicateGroup = {
  group: string;
  count: number;
  representativeUrl: string;
  types: string;
  statusCodes: string;
  urls: string[];
};

export type AuditResponse = {
  generatedAt: string | null;
  totalScore: number;
  scores: ScoreEntry[];
  problems: string[];
  todayActions: string[];
  weekActions: string[];
  nextActions: string[];
  pages: AuditPageRow[];
  duplicateCount: number;
  parameterUrlCount: number;
  parameterUrlPct: number;
  inventoryTotal: number;
  sitemapCount: number;
  altMissingTotal: number;
  pagesWithoutJsonLd: number;
};

export type PolicyRow = {
  type: string;
  representativeUrl: string;
  currentExamples: string;
  canonicalPolicy: string;
  sitemapPolicy: string;
  noindexPolicy: string;
  action: string;
  confidence: string;
};

export type InventoryRow = {
  url: string;
  normalizedUrl: string;
  path: string;
  query: string;
  type: string;
  statusCode: number;
  finalUrl: string;
  isParameterUrl: boolean;
  duplicateGroup: string;
  source: string;
};

export type UrlPolicyResponse = {
  policies: PolicyRow[];
  duplicates: AuditDuplicateGroup[];
  inventory: {
    rows: InventoryRow[];
    total: number;
    parameterCount: number;
    typeCounts: { type: string; count: number }[];
  };
};

export type JsonLdValidationRow = {
  page: string;
  url: string;
  jsonLdCount: number;
  recommendedSchema: string;
  blocker: string;
  confidence: string;
};

export type JsonLdSnippet = {
  title: string;
  source: string;
  code: string;
};

export type JsonLdResponse = {
  validation: JsonLdValidationRow[];
  snippets: JsonLdSnippet[];
  preChecks: string[];
};

export type ProductDraft = {
  key: string;
  product: string;
  url: string;
  pageType: string;
  searchIntent: string;
  h1: string;
  blocks: { heading: string; body: string }[];
  faq: { question: string; answer: string };
};

export type ProductTextResponse = {
  products: ProductDraft[];
  principles: string[];
};

export type ChecklistRow = {
  order: string;
  owner: string;
  task: string;
  artifact: string;
  doneCriteria: string;
};

export type ActionRow = {
  priority: string;
  task: string;
  owner: string;
  expectedImpact: string;
  difficulty: string;
  risk: string;
  evidenceFile: string;
  recommendedDeadline: string;
};

export type ChecklistResponse = {
  preChecks: ChecklistRow[];
  runOrder: string[];
  rollback: string[];
  actions: ActionRow[];
};

export type ApprovalGate = {
  key: "A" | "B" | "C";
  title: string;
  recommendation: "YES" | "NO" | "보류";
  confidence: string;
  reason: string;
  missingData: string;
  answerFormat: string;
};
