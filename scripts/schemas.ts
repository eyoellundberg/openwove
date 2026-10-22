/**
 * Writes the JSON Schemas agents use: `npm run schemas`. `--check` fails if the files in schemas/
 * don't match the code, which is what CI runs. The zod schemas in src/lib are the source of truth.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCHEMA_NAMES, schemaJson } from '../src/lib/schemas'

const dir = join(import.meta.dirname, '../schemas')
mkdirSync(dir, { recursive: true })
let stale = false
for (const name of SCHEMA_NAMES) {
  const file = join(dir, `${name}.schema.json`)
  const next = `${JSON.stringify(schemaJson(name), null, 2)}\n`
  if (process.argv.includes('--check')) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== next) {
      console.error(`schemas/${name}.schema.json is out of date. Run: npm run schemas`)
      stale = true
    }
  } else {
    writeFileSync(file, next)
    console.log(`Wrote schemas/${name}.schema.json`)
  }
}
if (stale) process.exit(1)
