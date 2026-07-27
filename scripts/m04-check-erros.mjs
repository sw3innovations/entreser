#!/usr/bin/env node
// D26 — garante que TODO código de erro do contrato do M04 tem tradução em erros.ts.
// Falha (exit 1) se algum código do openapi.yaml não estiver mapeado — assim a lista
// nunca fica desatualizada em silêncio. Rode em CI e ao mexer no contrato.
import { readFileSync } from 'node:fs'

const CONTRATO = 'src/features/m04/contract/openapi.yaml'
const ERROS = 'src/features/m04/api/erros.ts'
const IGNORAR = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HH', 'MM'])

const contrato = readFileSync(CONTRATO, 'utf8')
const codigos = [...new Set([...contrato.matchAll(/`([A-Z][A-Z_]{3,})`/g)].map((m) => m[1]))]
  .filter((c) => !IGNORAR.has(c))
  .sort()

const erros = readFileSync(ERROS, 'utf8')
const faltando = codigos.filter((c) => !new RegExp(`\\b${c}\\b`).test(erros))

if (faltando.length) {
  console.error(`✗ ${faltando.length} código(s) do contrato sem tradução em erros.ts:`)
  console.error('  ' + faltando.join(', '))
  process.exit(1)
}
console.log(`✓ ${codigos.length} códigos do contrato cobertos em erros.ts`)
