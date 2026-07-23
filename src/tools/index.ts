import type OpenAI from "openai";
import type { ToolDefinition } from "../types/index.ts";
import { runCode } from "./code.ts";
import { runSql } from "./sql.ts";

const runSqlDeclaration: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "run_sql",
    description:
      "Run a read-only SELECT query against the shop SQLite database. The database has customers(id, name, city) and orders(id, customer_id, amount, created_at).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A single SQLite SELECT query to execute.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

const runCodeDeclaration: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "run_code",
    description:
      "Execute a short JavaScript snippet in a Bun subprocess. Print the result to stdout with console.log. Useful for calculations, transformations, and formatting.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "A short JavaScript snippet whose result is printed to stdout.",
        },
      },
      required: ["code"],
      additionalProperties: false,
    },
  },
};

export const tools = {
  run_sql: { schema: runSqlDeclaration, executor: runSql },
  run_code: { schema: runCodeDeclaration, executor: runCode },
} satisfies Record<string, ToolDefinition>;

export const functionDeclarations = Object.values(tools).map(
  ({ schema }) => schema,
);
