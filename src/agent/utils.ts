import type { ToolInput, ToolOutput } from '../types/index.ts'
import { tools } from '../tools/index.ts'

export function asToolInput(args: string | undefined): ToolInput {
  if (!args) return {}
  try {
    const parsed = JSON.parse(args)
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as ToolInput)
      : {}
  } catch {
    return {}
  }
}

export async function executeTool(
  name: string | undefined,
  input: ToolInput
): Promise<ToolOutput> {
  if (!name) {
    return { ok: false, error: 'Model requested a tool without a name.' }
  }

  const tool = tools[name as keyof typeof tools]
  if (!tool) {
    return { ok: false, error: `Unknown tool requested: ${name}` }
  }

  try {
    return await tool.executor(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `${name} threw unexpectedly: ${message}` }
  }
}
