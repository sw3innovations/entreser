'use client'

import { DateInput } from '@/components/ui'

interface BirthDateFieldProps {
  label: string
  /** Valor em ISO 8601 (YYYY-MM-DD); string vazia quando ainda não preenchido. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  name?: string
}

/** Hoje em ISO — o teto de uma data de nascimento. */
function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 1º de janeiro de 25 anos atrás — onde o calendário abre quando o campo está vazio. */
function abrirEmISO(): string {
  return `${new Date().getFullYear() - 25}-01-01`
}

/**
 * Data de nascimento das telas de auth. É o `DateInput` do kit na pele escura — o mesmo
 * componente do backoffice, com o tema trocado, em vez de um DatePicker paralelo.
 *
 * O que é próprio daqui: datas futuras bloqueadas e o calendário abrindo perto de uma
 * data de nascimento plausível (não no mês atual, que exigiria dezenas de cliques). A
 * idade mínima (18) continua validada pelo schema Zod.
 */
export function BirthDateField({ label, value, onChange, onBlur, error, name }: BirthDateFieldProps) {
  return (
    <DateInput
      tema="escuro"
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      errorMessage={error}
      max={hojeISO()}
      abrirEm={abrirEmISO()}
      className="gap-0"
    />
  )
}
