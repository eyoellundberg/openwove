/** Check a flow file: `npm run check-flow flows/my-flow.json`. Exits non-zero with a readable error. */
import { readFileSync } from 'node:fs'
import { parseFlow } from '../src/lib/flow-file'

const path = process.argv[2]
if (!path) {
  console.error('Usage: npm run check-flow <path to flow.json>')
  process.exit(1)
}

let json: unknown
try {
  json = JSON.parse(readFileSync(path, 'utf8'))
} catch (error) {
  console.error(`${path} is not valid JSON: ${(error as Error).message}`)
  process.exit(1)
}

const result = parseFlow(json)
if (!result.ok) {
  console.error(`${path}: ${result.error}`)
  process.exit(1)
}
const stages = new Set(result.flow.steps.map((s) => s.stage)).size
console.log(`${path} is valid: "${result.flow.name}", ${result.flow.steps.length} steps in ${stages} stages.`)
