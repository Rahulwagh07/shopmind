import { expect, test } from 'bun:test'
import type OpenAI from 'openai'
import {
  formatForGrader,
  gradeAnswerWithGenerator,
} from '../src/grader/index.ts'

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
        message: { role: 'assistant', content: text, refusal: null },
        finish_reason: 'stop',
      },
    ],
  }
}

const input = {
  question: 'How many customers are there?',
  notes: 'Basic single-tool SQL lookup.',
  trace: [
    {
      tool: 'run_sql',
      input: { query: 'SELECT COUNT(*) FROM customers' },
      output: { ok: true, rows: [{ 'COUNT(*)': 8 }] },
    },
  ],
  answer: 'There are 8 customers.',
}

test('parses a valid grader verdict', async () => {
  const grade = await gradeAnswerWithGenerator(
    input,
    async () =>
      responseWithText('{"verdict":"pass","reason":"Count matches the query."}'),
    'test-model'
  )
  expect(grade).toEqual({ verdict: 'pass', reason: 'Count matches the query.' })
})

test('rejects a verdict outside pass/fail', async () => {
  await expect(
    gradeAnswerWithGenerator(
      input,
      async () => responseWithText('{"verdict":"maybe","reason":"unsure"}'),
      'test-model'
    )
  ).rejects.toThrow('invalid JSON')
})

test('throws when the grader returns no content', async () => {
  await expect(
    gradeAnswerWithGenerator(
      input,
      async () => ({ ...responseWithText(''), choices: [] }),
      'test-model'
    )
  ).rejects.toThrow('returned no content')
})

test('formats the trace and answer for the grader', () => {
  const text = formatForGrader(input)
  expect(text).toContain('Question: How many customers are there?')
  expect(text).toContain('1. run_sql({"query":"SELECT COUNT(*) FROM customers"})')
  expect(text).toContain('Final answer:\nThere are 8 customers.')
})

test('marks answers with no tool calls', () => {
  expect(formatForGrader({ ...input, trace: [] })).toContain(
    '(no tool calls)'
  )
})
