'use client'

import { cn } from '@/lib/utils'
import { AgendaIcon, RelogioIcon } from './icons'

interface CampoTemporalProps {
  label?: string
  /** `YYYY-MM-DD` no DateInput, `HH:mm` no TimeInput — o formato que a API usa. */
  value?: string
  onChange?: (value: string) => void
  errorMessage?: string
  isRequired?: boolean
  isDisabled?: boolean
  /** Texto auxiliar abaixo do campo. */
  hint?: string
  name?: string
  id?: string
  className?: string
}

export interface DateInputProps extends CampoTemporalProps {
  /** Data mínima selecionável (`YYYY-MM-DD`). */
  min?: string
  /** Data máxima selecionável (`YYYY-MM-DD`). */
  max?: string
}

export type TimeInputProps = CampoTemporalProps

/**
 * Moldura compartilhada dos campos de data e hora — a mesma do `TextInput`, para os
 * formulários não terem dois vocabulários visuais.
 */
function CampoTemporal({
  tipo,
  icone,
  label,
  value = '',
  onChange,
  errorMessage,
  isRequired,
  isDisabled,
  hint,
  name,
  id,
  className,
  min,
  max,
}: CampoTemporalProps & { tipo: 'date' | 'time'; icone: React.ReactNode; min?: string; max?: string }) {
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
        <span className="inline-flex shrink-0 text-plum/40">{icone}</span>
        <input
          id={id}
          name={name}
          type={tipo}
          value={value}
          min={min}
          max={max}
          required={isRequired}
          disabled={isDisabled}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'min-w-0 flex-1 border-none bg-transparent font-body text-sm text-plum outline-none disabled:cursor-not-allowed',
            // Esconde o ícone nativo do Chrome — o nosso já está à esquerda. O campo
            // inteiro continua abrindo o calendário/relógio ao clique.
            '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
            '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
            '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
          )}
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

/**
 * DateInput — campo de data no visual do kit. Mantém o seletor NATIVO por baixo (o
 * calendário do sistema, acessível e já localizado em pt-BR); o que padronizamos é a
 * moldura: label, ícone, borda, foco e erro iguais aos demais campos.
 *
 * `value` e `onChange` falam `YYYY-MM-DD` — o formato que a API espera, sem conversão
 * na tela. A exibição fica por conta do navegador (dd/mm/aaaa no Brasil).
 */
export function DateInput(props: DateInputProps) {
  return <CampoTemporal {...props} tipo="date" icone={<AgendaIcon size={16} />} />
}

/** TimeInput — irmão do DateInput para horário (`HH:mm`). */
export function TimeInput(props: TimeInputProps) {
  return <CampoTemporal {...props} tipo="time" icone={<RelogioIcon size={16} />} />
}
