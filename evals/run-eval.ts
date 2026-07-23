import { runAgent } from '../src/agent/index.ts'
import testCasesJson from './test-cases.json'

interface TestCase {
  input: string
  expectedTools: string[]
  expectedAnswerContains: string[]
  notes: string
}

interface EvalResult {
  case: number
  input: string
  expectedTools: string[]
  actualTools: string[]
  toolMatch: boolean
  answerMatch: boolean
  crashFree: boolean
  answer: string
  error?: string
}

const testCases = testCasesJson as TestCase[]

function arraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[$,]/g, '').replace(/\s+/g, ' ').trim()
}

function answerContainsAll(answer: string, expected: string[]): boolean {
  const normalizedAnswer = normalize(answer)
  return expected.every(value => normalizedAnswer.includes(normalize(value)))
}

function icon(value: boolean): string {
  return value ? 'PASS' : 'FAIL'
}

const results: EvalResult[] = []

for (const [index, testCase] of testCases.entries()) {
  process.stdout.write(`[${index + 1}/${testCases.length}] ${testCase.notes} `)

  try {
    const result = await runAgent(testCase.input)
    const actualTools = result.trace.map(step => step.tool)
    const toolMatch = arraysEqual(actualTools, testCase.expectedTools)
    const answerMatch = answerContainsAll(
      result.answer,
      testCase.expectedAnswerContains
    )

    results.push({
      case: index + 1,
      input: testCase.input,
      expectedTools: testCase.expectedTools,
      actualTools,
      toolMatch,
      answerMatch,
      crashFree: true,
      answer: result.answer,
    })
    console.log(toolMatch && answerMatch ? 'PASS' : 'FAIL')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({
      case: index + 1,
      input: testCase.input,
      expectedTools: testCase.expectedTools,
      actualTools: [],
      toolMatch: false,
      answerMatch: false,
      crashFree: false,
      answer: '',
      error: message,
    })
    console.log('CRASH')
  }
}

console.log('\nResults')
console.table(
  results.map(result => ({
    Case: result.case,
    Tools: icon(result.toolMatch),
    Answer: icon(result.answerMatch),
    'Crash-free': icon(result.crashFree),
    Expected: result.expectedTools.join(' -> ') || 'none',
    Actual: result.actualTools.join(' -> ') || 'none',
  }))
)

for (const result of results.filter(
  item => !item.toolMatch || !item.answerMatch || !item.crashFree
)) {
  console.log(`\nCase ${result.case} details`)
  console.log(`Input: ${result.input}`)
  console.log(`Answer: ${result.answer || '(none)'}`)
  if (result.error) console.log(`Error: ${result.error}`)
}

const toolPasses = results.filter(result => result.toolMatch).length
const answerPasses = results.filter(result => result.answerMatch).length
const crashFreePasses = results.filter(result => result.crashFree).length
const fullPasses = results.filter(
  result => result.toolMatch && result.answerMatch && result.crashFree
).length

console.log('\nSummary')
console.log(`Tool selection: ${toolPasses}/${results.length}`)
console.log(`Answer content: ${answerPasses}/${results.length}`)
console.log(`Crash-free:     ${crashFreePasses}/${results.length}`)
console.log(
  `Overall:        ${fullPasses}/${results.length} cases fully passed`
)

if (fullPasses !== results.length) process.exitCode = 1
