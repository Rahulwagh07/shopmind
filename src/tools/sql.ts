import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import type { ToolInput, ToolOutput } from "../types/index.ts";

const DATABASE_PATH = resolve(import.meta.dir, "../../data/shop.db");

export async function runSql(input: ToolInput): Promise<ToolOutput> {
  const query = input.query;

  if (typeof query !== "string" || query.trim() === "") {
    return { ok: false, error: "run_sql requires a non-empty query string." };
  }

  const trimmedQuery = query.trim();
  if (!/^SELECT\b/i.test(trimmedQuery)) {
    return {
      ok: false,
      error: "run_sql rejected the query: only SELECT statements are allowed.",
    };
  }

  const withoutTrailingSemicolon = trimmedQuery.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    return {
      ok: false,
      error: "run_sql rejected the query: multiple SQL statements are not allowed.",
    };
  }

  let database: Database | undefined;

  try {
    database = new Database(DATABASE_PATH, { readonly: true, strict: true });
    const rows = database.query(trimmedQuery).all();

    return { ok: true, rows, rowCount: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `run_sql failed: ${message}` };
  } finally {
    database?.close();
  }
}
