'use client'

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const digitsOnly = (v: string) => (v || '').replace(/\D/g, '')

/**
 * Formata centavos como moeda BR: `123456` → `1.234,56`. Sem o símbolo — o `R$` fica
 * fora do campo, fixo, para não brigar com o cursor durante a digitação.
 */
export function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** `1234.5` (reais) → `123450` (centavos). Arredonda para evitar 0.1+0.2 do float. */
function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100)
}

export interface MoneyInputProps {
  label?: string
  placeholder?: string
  /** Valor em REAIS (ex.: `250.5`). `null` = campo vazio. */
  value?: number | null
  /** Emite o valor em REAIS, ou `null` quando o campo fica vazio. */
  onChange?: (value: number | null) => void
  errorMessage?: string
  isRequired?: boolean
  isDisabled?: boolean
  /** Texto auxiliar abaixo do campo (ex.: projeção de faturamento). */
  hint?: string
  name?: string
  id?: string
  className?: string
}

/**
 * MoneyInput — valor em reais com máscara de moeda BR, no visual do TextInput.
 *
 * Digita-se apenas dígitos, da direita para a esquerda (centavos primeiro): `2`, `5`,
 * `0`, `0` vira `2,50` e depois `25,00`. É o comportamento que as pessoas esperam de
 * campo de dinheiro, e evita a ambiguidade de ponto vs. vírgula.
 *
 * A prop `value` é um número em reais — não string — para a tela não ficar convertendo
 * texto. O `R$` é um prefixo fixo, fora do input.
 */
export function MoneyInput({
  label,
  placeholder = '0,00',
  value = null,
  onChange,
  errorMessage,
  isRequired,
  isDisabled,
  hint,
  name,
  id,
  className,
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)

  const display = value == null ? '' : formatCentavos(reaisParaCentavos(value))

  // O cursor vai sempre para o fim: a digitação é da direita para a esquerda, então
  // manter posição no meio confundiria mais do que ajudaria.
  useLayoutEffect(() => {
    if (caretRef.current != null && inputRef.current) {
      const fim = inputRef.current.value.length
      inputRef.current.setSelectionRange(fim, fim)
      caretRef.current = null
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitos = digitsOnly(e.target.value).slice(0, 11) // teto ~99 milhões
    caretRef.current = 1
    if (!digitos) {
      onChange?.(null)
      return
    }
    onChange?.(Number(digitos) / 100)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-plum/70">
          {label}
          {isRequired && <span className="text-red-alert"> *</span>}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 rounded-[10px] border bg-white/60 px-3 py-2 backdrop-blur-sm transition-[border-color,box-shadow] duration-200',
          'focus-within:border-mauve focus-within:shadow-[0_0_0_1px_var(--color-mauve)]',
          errorMessage ? 'border-red-alert' : 'border-cream-dark',
          isDisabled && 'opacity-50',
        )}
      >
        <span className="shrink-0 text-sm text-plum/45">R$</span>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          value={display}
          placeholder={placeholder}
          required={isRequired}
          disabled={isDisabled}
          onChange={handleChange}
          className="min-w-0 flex-1 border-none bg-transparent font-body text-sm tabular-nums text-plum outline-none placeholder:text-plum/30 disabled:cursor-not-allowed"
        />
      </div>
      {errorMessage ? (
        <span className="text-xs text-red-alert">{errorMessage}</span>
      ) : (
        hint && <span className="text-xs text-plum/45">{hint}</span>
      )}
    </div>
  )
}
