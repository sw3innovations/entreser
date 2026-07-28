#!/usr/bin/env node
// D26 — garante que TODO código de erro do contrato do M04 tem tradução em erros.ts.
// Falha (exit 1) se algum código do openapi.yaml não estiver mapeado — assim a lista
// nunca fica desatualizada em silêncio. Rode em CI e ao mexer no contrato.
//
// Os códigos aparecem no contrato de DUAS formas, e ler só uma delas deixa passar:
//   1. citados na descrição, entre crases — "Códigos possíveis: `SLOT_JA_OCUPADO`"
//   2. como valor YAML nos exemplos de resposta — "code: PARAMETRO_INVALIDO"
// Foi a segunda que escapou de uma versão anterior deste guard.
import { readFileSync } from 'node:fs'

const CONTRATO = 'src/features/m04/contract/openapi.yaml'
const ERROS = 'src/features/m04/api/erros.ts'

const contrato = readFileSync(CONTRATO, 'utf8')

const entreCrases = [...contrato.matchAll(/`([A-Z][A-Z_]{3,})`/g)].map((m) => m[1])
const comoValorYaml = [...contrato.matchAll(/^\s*code:\s*["']?([A-Z][A-Z_]{3,})["']?\s*$/gm)].map((m) => m[1])

// Palavras em CAIXA ALTA que não são código de erro (aparecem em texto/enum).
const IGNORAR = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HH', 'MM', 'UTC', 'ISO'])

const codigos = [...new Set([...entreCrases, ...comoValorYaml])].filter((c) => !IGNORAR.has(c)).sort()

const erros = readFileSync(ERROS, 'utf8')
const faltando = codigos.filter((c) => !new RegExp(`\\b${c}\\b`).test(erros))

if (faltando.length) {
  console.error(`✗ ${faltando.length} código(s) do contrato sem tradução em erros.ts:`)
  console.error('  ' + faltando.join(', '))
  process.exit(1)
}
console.log(`✓ ${codigos.length} códigos do contrato cobertos em erros.ts`)
