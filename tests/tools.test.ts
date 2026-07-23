import { beforeAll, describe, expect, test } from "bun:test";
import { seedDatabase } from "../src/db/seed.ts";
import { runCode } from "../src/tools/code.ts";
import { runSql } from "../src/tools/sql.ts";

beforeAll(() => seedDatabase());

describe("run_sql", () => {
  test("returns SELECT rows from the seeded database", async () => {
    const result = await runSql({
      query: "SELECT name, city FROM customers WHERE id = 1",
    });

    expect(result).toEqual({
      ok: true,
      rows: [{ name: "Maya Chen", city: "Austin" }],
      rowCount: 1,
    });
  });

  test("rejects destructive statements", async () => {
    const result = await runSql({ query: "DELETE FROM customers" });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("only SELECT");
  });

  test("returns database errors instead of throwing", async () => {
    const result = await runSql({ query: "SELECT email FROM customers" });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("email");
  });

  test("rejects multiple SQL statements", async () => {
    const result = await runSql({ query: "SELECT * FROM orders; DROP TABLE customers" });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("multiple SQL statements are not allowed");
  });

  test("requires a non-empty query", async () => {
    const result = await runSql({ query: "   " });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("non-empty query string");
  });
});

describe("run_code", () => {
  test("returns subprocess stdout", async () => {
    const result = await runCode({ code: "console.log(6 * 7)" });

    expect(result).toEqual({ ok: true, stdout: "42" });
  });

  test("returns thrown errors instead of throwing", async () => {
    const result = await runCode({ code: "throw new Error('planned failure')" });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("planned failure");
  });

  test("requires a non-empty code string", async () => {
    const result = await runCode({ code: "   " });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("non-empty JavaScript snippet");
  });
});
