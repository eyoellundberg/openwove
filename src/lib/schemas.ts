/** The JSON Schemas agents use, generated from the zod schemas in this folder. `npm run schemas` writes them to schemas/. */
import { z } from 'zod'
import { FlowFileSchema } from './flow-file'
import { RunReportSchema } from './run-report'

export const SCHEMAS = {
  // What an agent writes: fields with defaults are optional.
  flow: { schema: FlowFileSchema, io: 'input' as const, title: 'OpenWove flow file' },
  // What a reviewer reads: everything is there.
  'run-report': { schema: RunReportSchema, io: 'output' as const, title: 'OpenWove run report' },
}
export type SchemaName = keyof typeof SCHEMAS
export const SCHEMA_NAMES = Object.keys(SCHEMAS) as SchemaName[]

export const schemaJson = (name: SchemaName) => {
  const { schema, io, title } = SCHEMAS[name]
  return { title, ...z.toJSONSchema(schema, { target: 'draft-2020-12', io }) }
}
