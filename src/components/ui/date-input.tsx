'use client'

import { useRef } from 'react'
import { Calendar, DateField, DatePicker, I18nProvider, TimeField } from '@heroui/react'
import { parseDate, parseTime } from '@internationalized/date'
import { cn } from '@/lib/utils'
import { AgendaIcon, ChevronDownIcon, RelogioIcon } from './icons'

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
  className?: string
}

export interface DateInputProps extends CampoTemporalProps {
  /** Data mínima selecionável (`YYYY-MM-DD`). */
  min?: string
  /** Data máxima selecionável (`YYYY-MM-DD`). */
  max?: string
}

export type TimeInputProps = CampoTemporalProps

/** ISO (`YYYY-MM-DD`) → DateValue, tolerando vazio/incompleto. */
function isoParaData(iso?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  try {
    return parseDate(iso)
  } catch {
    return null
  }
}

/** `HH:mm` → TimeValue, tolerando vazio/incompleto. */
function isoParaHora(hhmm?: string) {
  if (!hhmm || !/^\d{2}:\d{2}/.test(hhmm)) return null
  try {
    return parseTime(hhmm.slice(0, 5))
  } catch {
    return null
  }
}

/** Moldura dos campos — a mesma do `TextInput`, para o formulário ter um vocabulário só. */
const GRUPO =
  'flex h-auto w-full items-center gap-2 rounded-[10px] border bg-white/60 px-3 py-2 shadow-none outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 focus-within:border-mauve focus-within:shadow-[0_0_0_1px_var(--color-mauve)]'
const SEGMENTOS = 'flex flex-1 gap-px px-0 py-0 font-body text-sm text-plum'
const SEGMENTO = 'rounded px-0.5 text-plum data-[placeholder=true]:text-plum/30'

function Rotulo({ label, isRequired }: { label?: string; isRequired?: boolean }) {
  if (!label) return null
  return (
    <span className="text-sm font-medium text-plum/70">
      {label}
      {isRequired && <span className="text-red-alert"> *</span>}
    </span>
  )
}

function Auxiliar({ errorMessage, hint }: { errorMessage?: string; hint?: string }) {
  if (errorMessage) return <span className="text-xs text-red-alert">{errorMessage}</span>
  if (hint) return <span className="text-xs text-plum/45">{hint}</span>
  return null
}

/**
 * DateInput — data com o DatePicker do HeroUI (o mesmo componente da data de nascimento),
 * vestido com a moldura do kit: label, ícone, borda e foco iguais aos demais campos.
 *
 * O campo é digitável por segmentos (dd/mm/aaaa) e abre o calendário ao clique em
 * qualquer ponto — não só na setinha. `value`/`onChange` falam `YYYY-MM-DD`, o formato
 * da API, sem conversão na tela.
 *
 * O popover leva `.heroui-claro`: ele é renderizado em portal no `<body>`, fora da árvore
 * da tela, e sem essa classe herdaria o tema escuro das telas de auth.
 */
export function DateInput({
  label,
  value,
  onChange,
  errorMessage,
  isRequired,
  isDisabled,
  hint,
  name,
  className,
  min,
  max,
}: DateInputProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Clicar em qualquer lugar do campo abre o calendário, exceto nos segmentos
  // editáveis — ali o clique serve para digitar.
  const abrirAoClicar = (e: React.MouseEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement
    if (alvo.closest('[data-slot="date-picker-trigger"]')) return
    const seg = alvo.closest('[data-slot="date-input-group-segment"]')
    if (seg && seg.getAttribute('data-type') !== 'literal') return
    triggerRef.current?.click()
  }

  return (
    <I18nProvider locale="pt-BR">
      <DatePicker
        name={name}
        aria-label={label}
        value={isoParaData(value)}
        onChange={(date) => onChange?.(date ? date.toString() : '')}
        minValue={isoParaData(min) ?? undefined}
        maxValue={isoParaData(max) ?? undefined}
        isInvalid={Boolean(errorMessage)}
        isDisabled={isDisabled}
        shouldForceLeadingZeros
        className={cn('flex flex-col gap-1.5', className)}
      >
        <Rotulo label={label} isRequired={isRequired} />

        <DateField.Group
          fullWidth
          onClick={abrirAoClicar}
          className={cn(
            GRUPO,
            'cursor-pointer',
            errorMessage ? 'border-red-alert' : 'border-cream-dark',
            isDisabled && 'opacity-50',
          )}
        >
          <DateField.Prefix className="mx-0 shrink-0 text-plum/40">
            <AgendaIcon size={16} />
          </DateField.Prefix>

          <DateField.Input className={SEGMENTOS}>
            {(segment) => <DateField.Segment segment={segment} className={SEGMENTO} />}
          </DateField.Input>

          <DateField.Suffix className="mx-0 shrink-0">
            <DatePicker.Trigger
              ref={triggerRef}
              aria-label="Abrir calendário"
              className="w-auto p-0 text-plum/40 transition-colors hover:text-mauve"
            >
              <DatePicker.TriggerIndicator className="size-4 text-current">
                <ChevronDownIcon size={16} />
              </DatePicker.TriggerIndicator>
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>

        <Auxiliar errorMessage={errorMessage} hint={hint} />

        <DatePicker.Popover
          placement="bottom start"
          className="heroui-claro w-auto min-w-0 border border-plum/8"
        >
          <Calendar aria-label={label} className="w-64">
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>

            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>

            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  )
}

/**
 * TimeInput — irmão do DateInput para horário (`HH:mm`), com o TimeField do HeroUI.
 * Sem popover: a digitação por segmentos (hh:mm) é o caminho natural de um horário.
 */
export function TimeInput({
  label,
  value,
  onChange,
  errorMessage,
  isRequired,
  isDisabled,
  hint,
  name,
  className,
}: TimeInputProps) {
  return (
    <I18nProvider locale="pt-BR">
      <TimeField
        name={name}
        aria-label={label}
        value={isoParaHora(value)}
        onChange={(hora) => onChange?.(hora ? hora.toString().slice(0, 5) : '')}
        isInvalid={Boolean(errorMessage)}
        isDisabled={isDisabled}
        shouldForceLeadingZeros
        hourCycle={24}
        className={cn('flex flex-col gap-1.5', className)}
      >
        <Rotulo label={label} isRequired={isRequired} />

        <TimeField.Group
          fullWidth
          className={cn(GRUPO, errorMessage ? 'border-red-alert' : 'border-cream-dark', isDisabled && 'opacity-50')}
        >
          <TimeField.Prefix className="mx-0 shrink-0 text-plum/40">
            <RelogioIcon size={16} />
          </TimeField.Prefix>
          <TimeField.Input className={SEGMENTOS}>
            {(segment) => <TimeField.Segment segment={segment} className={SEGMENTO} />}
          </TimeField.Input>
        </TimeField.Group>

        <Auxiliar errorMessage={errorMessage} hint={hint} />
      </TimeField>
    </I18nProvider>
  )
}
