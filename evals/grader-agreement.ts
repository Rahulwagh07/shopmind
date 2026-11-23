import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runAgent } from '../src/agent/index.ts'
import { gradeAnswer } from '../src/grader/index.ts'
import type { ToolCallStep } from '../src/types/index.ts'
import testCasesJson from './test-cases.json'

interface TestCase {
  input: string
  expectedTools: string[]
  expectedAnswerContains: string[]
  notes: string
}

interface Sample {
  id: string
  input: string
  notes: string
  trace: ToolCallStep[]
  answer: string
  expectedTools?: string[]
  expectedAnswerContains?: string[]
  source?: string
}

type Verdict = 'pass' | 'fail'

const RUNS_PER_CASE = 3

const hardCases: TestCase[] = [
  {
    input: 'How many customers live in Chicago? Use run_sql to answer.',
    expectedTools: ['run_sql'],
    expectedAnswerContains: ['0'],
    notes: 'Hard: the answer is zero because no customer lives in Chicago. Checks that the agent does not invent a count.',
  },
  {
    input: 'Which customers have spent more than 400 in total on orders? List their names. Use run_sql.',
    expectedTools: ['run_sql'],
    expectedAnswerContains: ['Liam Patel', 'Ethan Brooks', 'Sofia Ramirez', 'Emma Johnson'],
    notes: 'Hard: a filter on an aggregate (HAVING) with four matching names; a missing name is a failure.',
  },
  {
    input: "What is the average order amount for Ethan Brooks? Use run_sql to fetch the amounts and run_code to compute the average rounded to two decimals.",
    expectedTools: ['run_sql', 'run_code'],
    expectedAnswerContains: ['250.09'],
    notes: 'Hard: chained SQL-to-code average with rounding.',
  },
  {
    input: 'Which customer placed the most orders by count? Use run_sql.',
    expectedTools: ['run_sql'],
    expectedAnswerContains: ['Liam Patel', 'Sofia Ramirez', 'Emma Johnson'],
    notes: 'Hard: three customers tie at three orders each; an answer naming only one of them without mentioning the tie is incomplete.',
  },
  {
    input: 'What is the total order amount for customers who live in Denver? Use run_sql.',
    expectedTools: ['run_sql'],
    expectedAnswerContains: ['595.85'],
    notes: 'Hard: a join with a city filter and a sum across two customers.',
  },
  {
    input: 'What is Liam Patel total order spend converted to EUR at 0.92? Use run_sql to get the total and run_code to multiply by 0.92, rounded to two decimals.',
    expectedTools: ['run_sql', 'run_code'],
    expectedAnswerContains: ['534.52'],
    notes: 'Hard: chained lookup and conversion with rounding.',
  },
  {
    input: 'Which city has the most orders by count, and how many orders does it have? Use run_sql.',
    expectedTools: ['run_sql'],
    expectedAnswerContains: ['Austin', '8'],
    notes: 'Hard: a join and group-by on city; the answer must name the city and its count.',
  },
  {
    input: 'How many orders are there in total, and what is their combined amount in USD? Use run_sql.',
    expectedTools: ['run_sql'],
    expectedAnswerContains: ['20', '2900.44'],
    notes: 'Hard: two aggregates in one answer, with the currency stated as the question implies.',
  },
  {
    input: 'Convert Maya Chen total order spend to EUR at 0.92. Use run_sql to get the total and run_code to convert it, rounded to two decimals.',
    expectedTools: ['run_sql', 'run_code'],
    expectedAnswerContains: ['322.6', 'EUR'],
    notes: 'Hard: currency conversion; the answer must state the target currency.',
  },
  {
    input: 'Which customer has the lowest average order amount? Use run_sql.',
    expectedTools: ['run_sql'],
    expectedAnswerContains: ['Noah Williams'],
    notes: 'Hard: a per-customer average with ordering, where the answer must name the right customer.',
  },
  {
    input: "What is Liam Patel's email address? Use run_sql.",
    expectedTools: ['run_sql'],
    expectedAnswerContains: [],
    notes: 'Hard: the customers table has no email column. A correct answer says the data is not available and does not invent an address.',
  },
]
const dir = join(import.meta.dir, 'agreement')
const samplesPath = join(dir, 'samples.json')
const labelsPath = join(dir, 'human-labels.json')
const resultsPath = join(dir, 'grader-results.json')
const secondSubsetPath = join(dir, 'second-labeler-subset.json')
const secondLabelsPath = join(dir, 'second-labels.json')

const testCases = testCasesJson as TestCase[]
const mode = process.argv[2]

async function collect(): Promise<void> {
  await mkdir(dir, { recursive: true })
  const samples: Sample[] = []

  for (const [index, testCase] of testCases.entries()) {
    for (let run = 1; run <= RUNS_PER_CASE; run += 1) {
      const id = `${index + 1}-${run}`
      process.stdout.write(`[${id}] ${testCase.notes} `)
      try {
        const result = await runAgent(testCase.input)
        samples.push({
          id,
          input: testCase.input,
          notes: testCase.notes,
          trace: result.trace,
          answer: result.answer,
          expectedTools: testCase.expectedTools,
          expectedAnswerContains: testCase.expectedAnswerContains,
          source: 'real',
        })
        console.log('ok')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        samples.push({
          id,
          input: testCase.input,
          notes: testCase.notes,
          trace: [],
          answer: `(agent crashed: ${message})`,
          expectedTools: testCase.expectedTools,
          expectedAnswerContains: testCase.expectedAnswerContains,
          source: 'real',
        })
        console.log('CRASH')
      }
    }
  }

  await writeFile(samplesPath, JSON.stringify(samples, null, 2) + '\n')
  console.log(`\nWrote ${samples.length} samples to ${samplesPath}`)
  console.log(`Label them in ${labelsPath} as {"<id>": "pass" | "fail"}`)
}

async function collectHard(): Promise<void> {
  const samples = existsSync(samplesPath)
    ? (JSON.parse(await readFile(samplesPath, 'utf8')) as Sample[])
    : []

  for (const [index, testCase] of hardCases.entries()) {
    for (let run = 1; run <= 2; run += 1) {
      const id = `h${index + 1}-${run}`
      if (samples.some(sample => sample.id === id)) continue
      process.stdout.write(`[${id}] ${testCase.notes.split(':')[0]} `)
      try {
        const result = await runAgent(testCase.input)
        samples.push({
          id,
          input: testCase.input,
          notes: testCase.notes,
          trace: result.trace,
          answer: result.answer,
          expectedTools: testCase.expectedTools,
          expectedAnswerContains: testCase.expectedAnswerContains,
          source: 'hard',
        })
        console.log('ok')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        samples.push({
          id,
          input: testCase.input,
          notes: testCase.notes,
          trace: [],
          answer: `(agent crashed: ${message})`,
          expectedTools: testCase.expectedTools,
          expectedAnswerContains: testCase.expectedAnswerContains,
          source: 'hard',
        })
        console.log('CRASH')
      }
    }
  }

  await writeFile(samplesPath, JSON.stringify(samples, null, 2) + '\n')
  console.log(`\nWrote ${samples.length} samples to ${samplesPath}`)
}

function confusion(pairs: Array<[Verdict, Verdict]>) {
  const count = (human: Verdict, grader: Verdict) =>
    pairs.filter(([h, g]) => h === human && g === grader).length
  return {
    truePass: count('pass', 'pass'),
    humanPassGraderFail: count('pass', 'fail'),
    humanFailGraderPass: count('fail', 'pass'),
    trueFail: count('fail', 'fail'),
  }
}

function cohensKappa(pairs: Array<[Verdict, Verdict]>): number | null {
  const n = pairs.length
  const observed = pairs.filter(([h, g]) => h === g).length / n
  const humanPass = pairs.filter(([h]) => h === 'pass').length / n
  const graderPass = pairs.filter(([, g]) => g === 'pass').length / n
  const expected =
    humanPass * graderPass + (1 - humanPass) * (1 - graderPass)
  return expected === 1 ? null : (observed - expected) / (1 - expected)
}

async function compare(): Promise<void> {
  if (!existsSync(samplesPath)) throw new Error('Run "collect" first.')
  if (!existsSync(labelsPath)) throw new Error(`Missing ${labelsPath}`)

  const samples = JSON.parse(await readFile(samplesPath, 'utf8')) as Sample[]
  const labels = JSON.parse(await readFile(labelsPath, 'utf8')) as Record<
    string,
    Verdict
  >

  const graded: Array<{
    id: string
    human: Verdict
    grader: Verdict | 'error'
    reason: string
    answer: string
  }> = []

  for (const sample of samples) {
    const human = labels[sample.id]
    if (!human) throw new Error(`No human label for sample ${sample.id}`)

    process.stdout.write(`[${sample.id}] grading... `)
    try {
      const grade = await gradeAnswer({
        question: sample.input,
        notes: sample.notes,
        trace: sample.trace,
        answer: sample.answer,
        expectedTools: sample.expectedTools,
        expectedAnswerContains: sample.expectedAnswerContains,
      })
      graded.push({
        id: sample.id,
        human,
        grader: grade.verdict,
        reason: grade.reason,
        answer: sample.answer,
      })
      console.log(grade.verdict)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      graded.push({
        id: sample.id,
        human,
        grader: 'error',
        reason: message,
        answer: sample.answer,
      })
      console.log('ERROR')
    }
  }

  const scored = graded.filter(
    (item): item is typeof item & { grader: Verdict } => item.grader !== 'error'
  )
  const pairs = scored.map(
    item => [item.human, item.grader] as [Verdict, Verdict]
  )
  const agree = pairs.filter(([h, g]) => h === g).length
  const matrix = confusion(pairs)

  console.log('\nDisagreements')
  for (const item of scored.filter(item => item.human !== item.grader)) {
    console.log(
      `${item.id}: human=${item.human} grader=${item.grader} | ${item.reason}`
    )
    console.log(`  Answer: ${item.answer}`)
  }

  const errors = graded.length - scored.length
  console.log('\nSummary')
  console.log(
    `Agreement:     ${agree}/${scored.length} (${((agree / scored.length) * 100).toFixed(1)}%)`
  )
  const kappa = cohensKappa(pairs)
  console.log(
    `Cohen's kappa: ${kappa === null ? 'n/a (no variation in labels)' : kappa.toFixed(2)}`
  )
  console.log(
    `Human pass / grader pass: ${matrix.truePass}   Human pass / grader fail: ${matrix.humanPassGraderFail}`
  )
  console.log(
    `Human fail / grader pass: ${matrix.humanFailGraderPass}   Human fail / grader fail: ${matrix.trueFail}`
  )
  if (errors > 0) console.log(`Grader errors (excluded): ${errors}`)

  await writeFile(
    resultsPath,
    JSON.stringify({ agreement: agree / scored.length, errors, graded }, null, 2) +
      '\n'
  )
  console.log(`\nWrote details to ${resultsPath}`)
}

async function blindSubset(): Promise<void> {
  if (!existsSync(samplesPath)) throw new Error('Run "collect" first.')
  const samples = JSON.parse(await readFile(samplesPath, 'utf8')) as Sample[]
  const picked = samples.filter((_, index) => index % 4 === 0)

  const items = picked.map(sample => ({
    id: sample.id,
    question: sample.input,
    trace: sample.trace,
    answer: sample.answer,
  }))

  await writeFile(secondSubsetPath, JSON.stringify(items, null, 2) + '\n')
  console.log(`Wrote ${items.length} blind items to ${secondSubsetPath}`)
  console.log(`Second labeler writes {"<id>": "pass" | "fail"} to ${secondLabelsPath}`)
}

async function compareLabelers(): Promise<void> {
  if (!existsSync(secondLabelsPath)) throw new Error(`Missing ${secondLabelsPath}`)
  const labels = JSON.parse(await readFile(labelsPath, 'utf8')) as Record<string, Verdict>
  const second = JSON.parse(await readFile(secondLabelsPath, 'utf8')) as Record<string, Verdict>

  const ids = Object.keys(second).filter(id => labels[id])
  if (ids.length === 0) throw new Error('No overlapping labels to compare.')

  const pairs = ids.map(id => [labels[id], second[id]] as [Verdict, Verdict])
  const agree = pairs.filter(([a, b]) => a === b).length

  console.log('\nDisagreements')
  for (const id of ids.filter(id => labels[id] !== second[id])) {
    console.log(`${id}: me=${labels[id]} second=${second[id]}`)
  }

  const kappa = cohensKappa(pairs)
  console.log('\nSummary')
  console.log(`Labeler agreement: ${agree}/${ids.length} (${((agree / ids.length) * 100).toFixed(1)}%)`)
  console.log(`Cohen's kappa:     ${kappa === null ? 'n/a (no variation in labels)' : kappa.toFixed(2)}`)
}

if (mode === 'collect') await collect()
else if (mode === 'collect-hard') await collectHard()
else if (mode === 'compare') await compare()
else if (mode === 'blind-subset') await blindSubset()
else if (mode === 'compare-labelers') await compareLabelers()
else {
  console.error('Usage: bun run evals/grader-agreement.ts <collect|collect-hard|compare|blind-subset|compare-labelers>')
  process.exitCode = 1
}
