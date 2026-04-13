import type Database from "better-sqlite3";

export type SegmentField =
  | "days_since_last_order"
  | "days_since_join"
  | "total_spent"
  | "total_orders"
  | "marketing_agree_sms"
  | "marketing_agree_email"
  | "member_grade"
  | "last_order_product"
  | "birth_month";

export type SegmentOp = "=" | "!=" | ">" | ">=" | "<" | "<=" | "IN" | "NOT_IN";

export type SegmentClause = {
  field: SegmentField;
  op: SegmentOp;
  value: unknown;
};

export type SegmentQuery = {
  op: "AND" | "OR";
  clauses: Array<SegmentClause | SegmentQuery>;
};

export type EvaluationInput = {
  site: string;
  query: SegmentQuery;
  limit?: number;
};

export type EvaluationMember = {
  member_code: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type EvaluationResult = {
  count: number;
  members: EvaluationMember[];
  truncated: boolean;
  explainPlan?: string[];
  warnings: string[];
};

export type SegmentValidationError = {
  field: string;
  code: string;
  message: string;
};

export type SegmentEvaluationOutcome =
  | { ok: true; result: EvaluationResult; clauseCount: number; durationMs: number }
  | { ok: false; errors: SegmentValidationError[] };

const MAX_DEPTH = 3;
const MAX_CLAUSES = 10;
const MAX_IN_ITEMS = 100;
const SELECT_HARD_LIMIT = 50000;
const SEGMENT_TIMEOUT_MS = 6000;

const SEGMENT_FIELDS: SegmentField[] = [
  "days_since_last_order",
  "days_since_join",
  "total_spent",
  "total_orders",
  "marketing_agree_sms",
  "marketing_agree_email",
  "member_grade",
  "last_order_product",
  "birth_month",
];

const SEGMENT_OPS: SegmentOp[] = ["=", "!=", ">", ">=", "<", "<=", "IN", "NOT_IN"];

const NUMERIC_FIELDS = new Set<SegmentField>([
  "days_since_last_order",
  "days_since_join",
  "total_spent",
  "total_orders",
  "birth_month",
]);

export const FIELD_SQL: Record<Exclude<SegmentField, "birth_month">, string> = {
  days_since_last_order: "julianday('now') - julianday(o.last_order_at)",
  days_since_join: "julianday('now') - julianday(NULLIF(m.join_time, ''))",
  total_spent: "COALESCE(o.total_spent, 0)",
  total_orders: "COALESCE(o.total_orders, 0)",
  marketing_agree_sms: "m.marketing_agree_sms",
  marketing_agree_email: "m.marketing_agree_email",
  member_grade: "m.member_grade",
  last_order_product: "o.last_order_product",
};

type SqlValue = string | number;

type CompileState = {
  errors: SegmentValidationError[];
  params: SqlValue[];
  clauseCount: number;
};

type CompiledSegment = {
  whereSql: string;
  params: SqlValue[];
  clauseCount: number;
};

export async function evaluateSegment(
  db: Database.Database,
  input: EvaluationInput,
): Promise<SegmentEvaluationOutcome> {
  const startedAt = Date.now();
  const compiled = compileSegment(input);
  if (!compiled.ok) {
    return compiled;
  }

  try {
    const result = await runWithTimeout(() => evaluateCompiledSegment(db, input.site.trim(), compiled.value), SEGMENT_TIMEOUT_MS);
    return {
      ok: true,
      result,
      clauseCount: compiled.value.clauseCount,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    if (err instanceof SegmentTimeoutError) {
      return {
        ok: false,
        errors: [{ field: "query", code: "timeout", message: "세그먼트 평가가 6초 제한을 초과했다" }],
      };
    }
    throw err;
  }
}

function compileSegment(input: EvaluationInput): { ok: true; value: CompiledSegment } | { ok: false; errors: SegmentValidationError[] } {
  const errors: SegmentValidationError[] = [];
  const site = typeof input.site === "string" ? input.site.trim() : "";
  if (!site) {
    errors.push({ field: "site", code: "required", message: "site 필요" });
  } else if (site.includes("\0")) {
    errors.push({ field: "site", code: "null_byte", message: "site에 null byte를 포함할 수 없다" });
  }

  const state: CompileState = { errors, params: [], clauseCount: 0 };
  const whereSql = compileQueryNode(input.query, "query", 1, state);
  if (state.errors.length > 0) {
    return { ok: false, errors: state.errors };
  }
  return {
    ok: true,
    value: {
      whereSql,
      params: state.params,
      clauseCount: state.clauseCount,
    },
  };
}

function compileQueryNode(value: unknown, path: string, depth: number, state: CompileState): string {
  if (depth > MAX_DEPTH) {
    state.errors.push({ field: path, code: "depth_exceeded", message: "세그먼트 조건 중첩은 3단계까지만 허용된다" });
    return "1=0";
  }
  if (!isRecord(value)) {
    state.errors.push({ field: path, code: "invalid", message: "세그먼트 query 객체가 필요하다" });
    return "1=0";
  }

  const rawOp = value.op;
  const rawClauses = value.clauses;
  const op = rawOp === "AND" || rawOp === "OR" ? rawOp : "AND";
  if (rawOp !== "AND" && rawOp !== "OR") {
    state.errors.push({ field: `${path}.op`, code: "invalid", message: "query op는 AND 또는 OR이어야 한다" });
  }
  if (!Array.isArray(rawClauses)) {
    state.errors.push({ field: `${path}.clauses`, code: "invalid", message: "query clauses 배열이 필요하다" });
    return "1=0";
  }

  const parts = rawClauses.map((clauseOrQuery, index) => {
    const childPath = `${path}.clauses[${index}]`;
    return isQueryLike(clauseOrQuery)
      ? compileQueryNode(clauseOrQuery, childPath, depth + 1, state)
      : compileClause(clauseOrQuery, childPath, state);
  });

  return parts.length > 0 ? `(${parts.join(` ${op} `)})` : "1=1";
}

function compileClause(value: unknown, path: string, state: CompileState): string {
  state.clauseCount += 1;
  if (state.clauseCount === MAX_CLAUSES + 1) {
    state.errors.push({ field: "query", code: "too_many_clauses", message: "세그먼트 조건은 최대 10개까지만 허용된다" });
  }
  if (!isRecord(value)) {
    state.errors.push({ field: path, code: "invalid", message: "조건 객체가 필요하다" });
    return "1=0";
  }

  const field = value.field;
  const op = value.op;
  if (!isSegmentField(field)) {
    state.errors.push({ field: `${path}.field`, code: "invalid_field", message: "허용되지 않은 세그먼트 필드다" });
  }
  if (!isSegmentOp(op)) {
    state.errors.push({ field: `${path}.op`, code: "invalid_op", message: "허용되지 않은 세그먼트 연산자다" });
  }
  if (!isSegmentField(field) || !isSegmentOp(op)) {
    return "1=0";
  }

  if (field === "birth_month") {
    return compileBirthMonthClause(value.value, op, `${path}.value`, state);
  }

  const fieldSql = FIELD_SQL[field];
  if (op === "IN" || op === "NOT_IN") {
    const values = compileInValues(field, value.value, `${path}.value`, state);
    if (values.length === 0) return "1=0";
    state.params.push(...values);
    const placeholders = values.map(() => "?").join(", ");
    return `${fieldSql} ${op === "IN" ? "IN" : "NOT IN"} (${placeholders})`;
  }

  if (Array.isArray(value.value)) {
    state.errors.push({ field: `${path}.value`, code: "invalid_value", message: "이 연산자는 단일 value가 필요하다" });
    return "1=0";
  }
  const param = compileScalarValue(field, value.value, `${path}.value`, state);
  if (param === null) return "1=0";
  state.params.push(param);
  return `${fieldSql} ${op} ?`;
}

function compileBirthMonthClause(value: unknown, op: SegmentOp, path: string, state: CompileState): string {
  if (op !== "=") {
    state.errors.push({ field: path.replace(/\.value$/, ".op"), code: "invalid_op", message: "birth_month는 = 연산자만 허용된다" });
  }
  const month = compileMonthValue(value, path, state);
  if (month === null) return "1=0";
  state.params.push(month);
  return "CAST(strftime('%m', m.birth) AS INTEGER) = ?";
}

function compileInValues(field: SegmentField, value: unknown, path: string, state: CompileState): SqlValue[] {
  if (!Array.isArray(value)) {
    state.errors.push({ field: path, code: "invalid_value", message: "IN/NOT_IN은 value 배열이 필요하다" });
    return [];
  }
  if (value.length === 0) {
    state.errors.push({ field: path, code: "empty_array", message: "IN/NOT_IN value 배열은 비어 있을 수 없다" });
    return [];
  }
  if (value.length > MAX_IN_ITEMS) {
    state.errors.push({ field: path, code: "too_many_values", message: "IN/NOT_IN value 배열은 최대 100개까지만 허용된다" });
    return [];
  }

  const params: SqlValue[] = [];
  value.forEach((item, index) => {
    const param = field === "birth_month"
      ? compileMonthValue(item, `${path}[${index}]`, state)
      : compileScalarValue(field, item, `${path}[${index}]`, state);
    if (param !== null) params.push(param);
  });
  return params;
}

function compileMonthValue(value: unknown, path: string, state: CompileState): number | null {
  const param = compileScalarValue("birth_month", value, path, state);
  if (param === null) return null;
  if (typeof param !== "number" || !Number.isInteger(param) || param < 1 || param > 12) {
    state.errors.push({ field: path, code: "invalid_value", message: "birth_month value는 1-12 정수여야 한다" });
    return null;
  }
  return param;
}

function compileScalarValue(field: SegmentField, value: unknown, path: string, state: CompileState): SqlValue | null {
  if (value === null || value === undefined) {
    state.errors.push({ field: path, code: "required", message: "value 필요" });
    return null;
  }
  if (typeof value === "string" && value.includes("\0")) {
    state.errors.push({ field: path, code: "null_byte", message: "문자열 value에 null byte를 포함할 수 없다" });
    return null;
  }

  if (NUMERIC_FIELDS.has(field)) {
    const numberValue = coerceFiniteNumber(value);
    if (numberValue === null) {
      state.errors.push({ field: path, code: "invalid_value", message: `${field} value는 숫자여야 한다` });
      return null;
    }
    return numberValue;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  state.errors.push({ field: path, code: "invalid_value", message: `${field} value는 문자열이어야 한다` });
  return null;
}

function evaluateCompiledSegment(db: Database.Database, site: string, compiled: CompiledSegment): EvaluationResult {
  db.pragma("busy_timeout = 5000");
  const limit = SELECT_HARD_LIMIT;
  const baseSql = buildBaseSql(db);
  const sql = `
    ${baseSql}
      AND ${compiled.whereSql}
    LIMIT ?
  `;
  const params: SqlValue[] = [site, site, ...compiled.params, limit];
  const explainRows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as Array<{ detail?: string }>;
  const explainPlan = explainRows.map((row) => String(row.detail ?? ""));
  const warnings = buildExplainWarnings(explainPlan);
  const members = db.prepare(sql).all(...params) as EvaluationMember[];

  return {
    count: members.length,
    members,
    truncated: members.length >= limit,
    explainPlan,
    warnings,
  };
}

function buildBaseSql(db: Database.Database): string {
  const productExpr = imwebOrdersHasProductNameColumn(db)
    ? "product_name"
    : "COALESCE(json_extract(raw_json, '$.product_name'), json_extract(raw_json, '$.items[0].name'), json_extract(raw_json, '$.items[0].prod_name'), json_extract(raw_json, '$.products[0].name'), '')";
  return `
    SELECT m.member_code, m.name, m.callnum AS phone, m.email
    FROM imweb_members m
    LEFT JOIN (
      SELECT member_code, MAX(complete_time) AS last_order_at,
             SUM(payment_amount) AS total_spent, COUNT(*) AS total_orders,
             MAX(${productExpr}) AS last_order_product
      FROM imweb_orders
      WHERE site = ? AND complete_time != ''
      GROUP BY member_code
    ) o ON o.member_code = m.member_code
    WHERE m.site = ?
  `;
}

function imwebOrdersHasProductNameColumn(db: Database.Database): boolean {
  const columns = db.prepare("PRAGMA table_info(imweb_orders)").all() as Array<{ name: string }>;
  return columns.some((column) => column.name === "product_name");
}

function buildExplainWarnings(explainPlan: string[]): string[] {
  return explainPlan.some((detail) => {
    const upper = detail.toUpperCase();
    const scansMainTable = upper.includes("SCAN M") || upper.includes("SCAN IMWEB_MEMBERS");
    const usesIndex = upper.includes("USING INDEX") || upper.includes("USING COVERING INDEX");
    return scansMainTable && !usesIndex;
  })
    ? ["EXPLAIN QUERY PLAN indicates imweb_members scan without USING INDEX"]
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQueryLike(value: unknown): value is SegmentQuery {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, "clauses");
}

function isSegmentField(value: unknown): value is SegmentField {
  return typeof value === "string" && SEGMENT_FIELDS.includes(value as SegmentField);
}

function isSegmentOp(value: unknown): value is SegmentOp {
  return typeof value === "string" && SEGMENT_OPS.includes(value as SegmentOp);
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

class SegmentTimeoutError extends Error {
  constructor() {
    super("segment evaluation timed out");
  }
}

function runWithTimeout<T>(fn: () => T, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const queryPromise = new Promise<T>((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(fn());
      } catch (err) {
        reject(err);
      }
    });
  });
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new SegmentTimeoutError()), timeoutMs);
  });
  return Promise.race([queryPromise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
