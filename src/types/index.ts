import type OpenAI from "openai";

export type ToolInput = Record<string, unknown>;
export type ToolOutput = Record<string, unknown>;

export interface ToolCallStep {
  tool: string;
  input: ToolInput;
  output: ToolOutput;
}

export interface AgentResult {
  answer: string;
  trace: ToolCallStep[];
}

export interface ToolDefinition {
  schema: OpenAI.ChatCompletionTool;
  executor: (input: ToolInput) => Promise<ToolOutput>;
}
