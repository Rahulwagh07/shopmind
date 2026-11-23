import OpenAI from 'openai'
import { randomUUID } from 'node:crypto'
import { getConfig } from '../config/env.ts'

export interface LlmClient {
  client: OpenAI
  model: string
  requestOptions: () => { headers?: Record<string, string> }
}

export function createLlmClient(): LlmClient {
  const config = getConfig()

  if (config.PROVIDER === 'opencode-go') {
    return {
      client: new OpenAI({
        apiKey: config.OPENCODE_API_KEY,
        baseURL: 'https://opencode.ai/inference/go/openai/v1',
        defaultHeaders: { 'User-Agent': 'agent-eval-loop/1.0' },
      }),
      model: config.MODEL,
      requestOptions: () => ({
        headers: { 'x-opencode-session': randomUUID() },
      }),
    }
  }

  return {
    client: new OpenAI({
      apiKey: config.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    }),
    model: config.MODEL,
    requestOptions: () => ({}),
  }
}
