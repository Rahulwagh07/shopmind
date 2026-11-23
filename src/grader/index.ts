import type OpenAI from 'openai'
import { z } from 'zod'
import type { ToolCallStep } from '../types/index.ts'
import { createLlmClient } from '../llm/index.ts'
import { getConfig } from '../config/env.ts'

export interface GradeInput {
  question: string
  notes: string
  trace: ToolCallStep[]
  answer: string
  expectedTools?: string[]
  expectedAnswerContains?: string[]
}

export interface Grade {
  verdict: 'pass' | 'fail'
  reason: string
}

type ContentGenerator = (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) => Promise<OpenAI.Chat.Completions.ChatCompletion>

const gradeSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reason: z.string(),
})

export const GRADER_INSTRUCTION = `You grade the final answer of a tool-using assistant for a small shop database.

Pass the answer only if all of these hold:
- It answers what the user asked and includes the values requested.
- It agrees with the reference values. A wrong, missing, or invented value is a fail, even if it is stated confidently.
- Every number and name it states is supported by the tool outputs in the trace, or is common knowledge that needs no tool. Arithmetic is correct.
- It follows explicit instructions in the question, such as which tool to use, in what order, or not to use a tool. A tool call sequence that differs from the expected sequence is a fail when the user asked for specific tools.
- When the question asks for a currency conversion, the answer must clearly state the requested target currency, by name, code, or symbol (for example EUR or €). A wrong or missing currency is a fail, even if the number is right.
- It does not claim to have done something the trace does not show.

A tool call that failed is acceptable if the assistant recovered and the final answer is correct.

Respond with JSON only: {"verdict": "pass" | "fail", "reason": "<one short sentence>"}`

export function formatForGrader(input: GradeInput): string {
  const calls =
    input.trace.length === 0
      ? '(no tool calls)'
      : input.trace
          .map(
            (step, index) =>
              `${index + 1}. ${step.tool}(${JSON.stringify(step.input)}) -> ${JSON.stringify(step.output)}`
          )
          .join('\n')

  const expectedTools =
    input.expectedTools && input.expectedTools.length > 0
      ? input.expectedTools.join(' -> ')
      : 'none'
  const expectedValues = (input.expectedAnswerContains ?? []).join(', ') || 'none'

  return [
    `Question: ${input.question}`,
    `Test intent: ${input.notes}`,
    `Reference (ground truth computed from the database):\n- Expected tool sequence: ${expectedTools}\n- Correct answer must reflect these values: ${expectedValues}`,
    `Tool calls:\n${calls}`,
    `Final answer:\n${input.answer}`,
  ].join('\n\n')
}

export async function gradeAnswerWithGenerator(
  input: GradeInput,
  generateContent: ContentGenerator,
  model: string
): Promise<Grade> {
  const response = await generateContent([
    { role: 'system', content: GRADER_INSTRUCTION },
    { role: 'user', content: formatForGrader(input) },
  ])
  const content = response?.choices?.[0]?.message?.content
  if (!content) throw new Error(`Grader (${model}) returned no content`)

  const parsed = gradeSchema.safeParse(JSON.parse(content))
  if (!parsed.success) {
    throw new Error(`Grader (${model}) returned invalid JSON: ${content}`)
  }
  return parsed.data
}

export async function gradeAnswer(input: GradeInput): Promise<Grade> {
  const { client, model: defaultModel, requestOptions } = createLlmClient()
  const model = getConfig().GRADER_MODEL || defaultModel

  return gradeAnswerWithGenerator(
    input,
    messages =>
      client.chat.completions.create(
        {
          model,
          messages,
          temperature: 0,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        },
        requestOptions()
      ),
    model
  )
}
