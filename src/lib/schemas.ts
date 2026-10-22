/** The JSON Schemas agents use, generated from the zod schemas in this folder. `npm run schemas` writes them to schemas/. */
import { z } from 'zod'
import { FlowFileSchema } from './flow-file'
import { RunReportSchema } from './run-report'

/** Where the committed copies live, so a flow can name its schema and editors can fetch it. */
const SCHEMA_BASE = 'https://raw.githubusercontent.com/eyoellundberg/openwove/main/schemas'

export const SCHEMAS = {
  // What an agent writes: fields with defaults are optional.
  flow: {
    schema: FlowFileSchema,
    io: 'input' as const,
    title: 'OpenWove flow file',
    description: 'A multi-agent flow: who does what, in which order, and which steps ask the person first. Saved as flows/<name>.json and opened on the OpenWove canvas.',
  },
  // What a reviewer reads: everything is there.
  'run-report': {
    schema: RunReportSchema,
    io: 'output' as const,
    title: 'OpenWove run report',
    description: 'What one run of a flow came to: its status and cost, what is waiting for the person, and per step what the agent did, asked, touched and spent.',
  },
}
export type SchemaName = keyof typeof SCHEMAS
export const SCHEMA_NAMES = Object.keys(SCHEMAS) as SchemaName[]

/** zod caps every integer at Number.MAX_SAFE_INTEGER, which is noise in a schema meant to be read. */
function withoutSafeIntegerCaps(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutSafeIntegerCaps)
  if (node == null || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'maximum' && value === Number.MAX_SAFE_INTEGER) continue
    out[key] = withoutSafeIntegerCaps(value)
  }
  return out
}

export const schemaJson = (name: SchemaName) => {
  const { schema, io, title, description } = SCHEMAS[name]
  const { $schema, ...rest } = z.toJSONSchema(schema, { target: 'draft-2020-12', io })
  return { $schema, $id: `${SCHEMA_BASE}/${name}.schema.json`, title, description, ...(withoutSafeIntegerCaps(rest) as object) }
}
