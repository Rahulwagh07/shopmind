import { expect, test } from 'bun:test'
import type OpenAI from 'openai'
import { runAgentWithGenerator } from '../src/agent/index.ts'

function responseWithToolCall(
  name: string,
  args: Record<string, unknown>
): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: 'test-id',
    object: 'chat.completion',
    created: 12345,
    model: 'test-model',
    choices: [
      {
        index: 0,
        logprobs: null,
        message: {
          role: 'assistant',
          content: null,
          refusal: null,
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name,
                arguments: JSON.stringify(args),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  }
}

function responseWithText(
  text: string
): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: 'test-id',
    object: 'chat.completion',
    created: 12345,
    model: 'test-model',
    choices: [
      {
        index: 0,
        logprobs: null,
        message: {
          role: 'assistant',
          content: text,
          refusal: null,
        },
        finish_reason: 'stop',
      },
    ],
  }
}

test('feeds unknown tool errors back to model and completes', async () => {
  let callCount = 0

  const result = await runAgentWithGenerator(
    'Test an unknown tool',
    async messages => {
      callCount += 1

      if (callCount === 1) {
        return responseWithToolCall('missing_tool', { value: 1 })
      }

      const lastMessage = messages.at(-1)
      expect(lastMessage?.role).toBe('tool')
      expect(lastMessage?.content).toContain('Unknown tool')

      return responseWithText('I recovered from the tool error.')
    }
  )

  expect(result.answer).toBe('I recovered from the tool error.')
  expect(result.trace).toEqual([
    {
      tool: 'missing_tool',
      input: { value: 1 },
      output: { ok: false, error: 'Unknown tool requested: missing_tool' },
    },
  ])
})

test('answers without a tool when model returns text', async () => {
  const result = await runAgentWithGenerator(
    'What is the capital of France?',
    async () => responseWithText('Paris')
  )

  expect(result).toEqual({ answer: 'Paris', trace: [] })
})

test('handles empty question gracefully', async () => {
  const result = await runAgentWithGenerator('   ', async () =>
    responseWithText('Should not run')
  )
  expect(result).toEqual({ answer: 'Please provide a question.', trace: [] })
})

test('stops running if MAX_ITERATIONS is reached', async () => {
  let callCount = 0
  const result = await runAgentWithGenerator('Keep looping', async () => {
    callCount += 1
    return responseWithToolCall('missing_tool', {})
  })
  expect(callCount).toBe(5)
  expect(result.answer).toContain(
    'Agent stopped after 5 iterations without a final answer.'
  )
  expect(result.trace).toHaveLength(5)
})
