import OpenAI from 'openai'
import { functionDeclarations } from '../tools/index.ts'
import type { AgentResult, ToolCallStep } from '../types/index.ts'
import { createLlmClient } from '../llm/index.ts'
import { MAX_ITERATIONS, SYSTEM_INSTRUCTION } from './constants.ts'

import { asToolInput, executeTool } from './utils.ts'

type ContentGenerator = (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) => Promise<OpenAI.Chat.Completions.ChatCompletion>

export async function runAgentWithGenerator(
  question: string,
  generateContent: ContentGenerator
): Promise<AgentResult> {
  if (question.trim() === '') {
    return { answer: 'Please provide a question.', trace: [] }
  }

  const trace: ToolCallStep[] = []
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    { role: 'user', content: question.trim() },
  ]

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const response = await generateContent(messages)
    const message = response?.choices?.[0]?.message

    if (!message) {
      return { answer: 'API returned no message.', trace }
    }

    const toolCalls = message.tool_calls ?? []

    if (toolCalls.length === 0) {
      const answer = message.content
      return {
        answer: answer || 'Model returned no text answer.',
        trace,
      }
    }

    messages.push(message)

    for (const call of toolCalls) {
      if (call.type !== 'function') continue

      const toolName = call.function.name ?? 'invalid_tool_request'
      const input = asToolInput(call.function.arguments)
      const output = await executeTool(toolName, input)

      trace.push({ tool: toolName, input, output })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(output),
      })
    }
  }

  return {
    answer: `Agent stopped after ${MAX_ITERATIONS} iterations without a final answer.`,
    trace,
  }
}

export async function runAgent(question: string): Promise<AgentResult> {
  const { client, model, requestOptions } = createLlmClient()

  return runAgentWithGenerator(question, messages =>
    client.chat.completions.create(
      {
        model,
        messages,
        tools: functionDeclarations,
        max_tokens: 4096,
      },
      requestOptions()
    )
  )
}
