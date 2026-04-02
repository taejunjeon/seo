import { Pool, type QueryResult, type QueryResultRow } from "pg";

import { env } from "./env";

let pool: Pool | null = null;

const normalizeConnectionString = (value: string) =>
  value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

export const isDatabaseConfigured = () => Boolean(env.DATABASE_URL);

export const getPgPool = () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: normalizeConnectionString(env.DATABASE_URL),
      max: 5,
    });
  }

  return pool;
};

export const queryPg = async <TRow extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<TRow>> => getPgPool().query<TRow>(text, values as unknown[]);
