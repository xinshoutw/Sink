import type { Compilable } from 'kysely'
import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
} from 'kysely'

export interface AnalyticsRow {
  _sample_interval: number
  index1: string
  timestamp: string
  [column: string]: unknown
}

type AnalyticsDatabase = Record<string, AnalyticsRow>

// Keep Analytics Engine identifiers to its conservative bare-identifier subset.
// eslint-disable-next-line regexp/prefer-w, regexp/use-ignore-case
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
// Dataset names may contain hyphens, which no bare identifier allows. Analytics
// Engine SQL accepts a double-quoted dataset, so the FROM clause is always
// quoted while columns and aliases stay on the bare subset above.
// eslint-disable-next-line regexp/prefer-w, regexp/use-ignore-case
const datasetPattern = /^[A-Za-z_][A-Za-z0-9_-]*$/
// eslint-disable-next-line regexp/prefer-w, regexp/use-ignore-case
const quotedDatasetPattern = /^"[A-Za-z_][A-Za-z0-9_-]*"$/

class AnalyticsQueryCompiler extends MysqlQueryCompiler {
  protected override getLeftIdentifierWrapper(): string {
    return ''
  }

  protected override getRightIdentifierWrapper(): string {
    return ''
  }

  protected override sanitizeIdentifier(identifier: string): string {
    if (!identifierPattern.test(identifier) && !quotedDatasetPattern.test(identifier))
      throw new Error(`Invalid Analytics identifier: ${identifier}`)

    return identifier
  }
}

const coldDb = new Kysely<AnalyticsDatabase>({
  dialect: {
    createAdapter: () => new MysqlAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: db => new MysqlIntrospector(db),
    createQueryCompiler: () => new AnalyticsQueryCompiler(),
  },
})

export function createAnalyticsQuery(dataset: string) {
  if (!datasetPattern.test(dataset))
    throw new Error(`Invalid Analytics dataset: ${dataset}`)

  return coldDb.selectFrom(`"${dataset}"`)
}

export function compileAnalyticsQuery(query: Compilable): string {
  const compiled = query.compile()
  if (compiled.parameters.length !== 0)
    throw new Error('Analytics SQL queries must not contain parameters')

  return compiled.sql
}
