'use client'

import { useRef } from 'react'
import { Calendar, DateField, DatePicker, FieldError, I18nProvider, Label, TimeField } from '@heroui/react'
import { parseDate, parseTime } from '@internationalized/date'
import { cn } from '@/lib/utils'
import { AgendaIcon, ChevronDownIcon, RelogioIcon } from './icons'

/**
 * Os dois climas do app: `claro` no backoffice e nas telas internas; `escuro` nas telas
 * de auth (gradiente ameixa, campos glassmorphic). Um componente com duas peles evita
 * manter dois DatePickers quase iguais em lugares diferentes.
 */
export type TemaCampo = 'claro' | 'escuro'

interface Pele {
  grupo: string
  label: string
  segmentos: string
  segmento: string
  prefixo: string
  trigger: string
  erro: string
  popover: string
  bordaNormal: string
  bordaErro: string
}

const PELES: Record<TemaCampo, Pele> = {
  claro: {
    grupo:
      'flex h-auto w-full items-center gap-2 rounded-[10px] border bg-white/60 px-3 py-2 shadow-none outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 focus-within:border-mauve focus-within:shadow-[0_0_0_1px_var(--color-mauve)]',
    label: 'text-sm font-medium text-plum/70',
    segmentos: 'flex flex-1 gap-px px-0 py-0 font-body text-sm text-plum',
    segmento: 'rounded px-0.5 text-plum data-[placeholder=true]:text-plum/30',
    prefixo: 'mx-0 shrink-0 text-plum/40',
    trigger: 'w-auto p-0 text-plum/40 transition-colors hover:text-mauve',
    erro: 'mt-0 px-0 text-xs text-red-alert',
    // O popover é renderizado em portal no <body>, fora da árvore da tela: sem esta
    // classe herdaria o tema escuro definido no :root (ver globals.css §1b).
    popover: 'heroui-claro w-auto min-w-0 border border-plum/8',
    bordaNormal: 'border-cream-dark',
    bordaErro: 'border-red-alert',
  },
  escuro: {
    grupo:
      'flex h-auto w-full cursor-pointer items-center gap-3 rounded-2xl border bg-white/10 px-4 py-3.5 shadow-none outline-none backdrop-blur-sm transition-all focus-within:bg-white/15 focus-within:ring-0',
    label: 'mb-2 block w-fit text-[11px] font-medium uppercase tracking-wider text-cream/40',
    segmentos: 'flex flex-1 gap-px px-0 py-0 text-sm text-cream',
    segmento: 'rounded-md px-0.5 text-cream data-[placeholder=true]:text-cream/30',
    prefixo: 'mx-0 shrink-0 text-cream/30',
    trigger: 'w-auto p-0 text-cream/40 transition-colors hover:text-cream/70',
    erro: 'mt-1.5 px-0 text-xs font-medium text-mauve-soft',
    popover: 'w-auto min-w-0 border border-white/10 text-cream',
    bordaNormal: 'border-white/10 focus-within:border-cream/30',
    bordaErro: 'border-mauve-soft/60',
  },
}

interface CampoTemporalProps {
  label?: string
  /** `YYYY-MM-DD` no DateInput, `HH:mm` no TimeInput — o formato que a API usa. */
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  errorMessage?: string
  isRequired?: boolean
  isDisabled?: boolean
  /** Texto auxiliar abaixo do campo. */
  hint?: string
  tema?: TemaCampo
  name?: string
  className?: string
}

export interface DateInputProps extends CampoTemporalProps {
  /** Data mínima selecionável (`YYYY-MM-DD`). */
  min?: string
  /** Data máxima selecionável (`YYYY-MM-DD`). */
  max?: string
  /**
   * Mês em que o calendário abre quando o campo está vazio (`YYYY-MM-DD`). Útil para
   * datas distantes do mês atual — numa data de nascimento, abrir em 2026 é inútil.
   */
  abrirEm?: string
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

function Auxiliar({ hint, pele }: { hint?: string; pele: Pele }) {
  if (!hint) return null
  return <span className={cn('text-xs', pele === PELES.escuro ? 'text-cream/40' : 'text-plum/45')}>{hint}</span>
}

/**
 * DateInput — data com o DatePicker do HeroUI: campo digitável por segmentos
 * (dd/mm/aaaa, com avanço automático) e calendário ao clique em qualquer ponto.
 *
 * `value`/`onChange` falam `YYYY-MM-DD`, o formato da API — a tela não converte nada.
 * A pele vem de `tema`: `claro` (padrão, backoffice) ou `escuro` (telas de auth).
 */
export function DateInput({
  label,
  value,
  onChange,
  onBlur,
  errorMessage,
  isRequired,
  isDisabled,
  hint,
  tema = 'claro',
  name,
  className,
  min,
  max,
  abrirEm,
}: DateInputProps) {
  const pele = PELES[tema]
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
        placeholderValue={isoParaData(abrirEm) ?? undefined}
        isInvalid={Boolean(errorMessage)}
        isDisabled={isDisabled}
        shouldForceLeadingZeros
        className={cn('flex w-full flex-col gap-1.5', className)}
      >
        {label && (
          <Label className={pele.label}>
            {label}
            {isRequired && <span className="text-red-alert"> *</span>}
          </Label>
        )}

        <DateField.Group
          fullWidth
          onBlur={onBlur}
          onClick={abrirAoClicar}
          className={cn(
            pele.grupo,
            'cursor-pointer',
            errorMessage ? pele.bordaErro : pele.bordaNormal,
            isDisabled && 'opacity-50',
          )}
        >
          <DateField.Prefix className={pele.prefixo}>
            <AgendaIcon size={16} />
          </DateField.Prefix>

          <DateField.Input className={pele.segmentos}>
            {(segment) => <DateField.Segment segment={segment} className={pele.segmento} />}
          </DateField.Input>

          <DateField.Suffix className="mx-0 shrink-0">
            <DatePicker.Trigger ref={triggerRef} aria-label="Abrir calendário" className={pele.trigger}>
              <DatePicker.TriggerIndicator className="size-4 text-current">
                <ChevronDownIcon size={16} />
              </DatePicker.TriggerIndicator>
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>

        {errorMessage ? (
          <FieldError className={pele.erro}>{errorMessage}</FieldError>
        ) : (
          <Auxiliar hint={hint} pele={pele} />
        )}

        <DatePicker.Popover placement="bottom start" className={pele.popover}>
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
 * Sem popover: digitar hh:mm é o caminho natural de um horário.
 */
export function TimeInput({
  label,
  value,
  onChange,
  onBlur,
  errorMessage,
  isRequired,
  isDisabled,
  hint,
  tema = 'claro',
  name,
  className,
}: TimeInputProps) {
  const pele = PELES[tema]

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
        className={cn('flex w-full flex-col gap-1.5', className)}
      >
        {label && (
          <Label className={pele.label}>
            {label}
            {isRequired && <span className="text-red-alert"> *</span>}
          </Label>
        )}

        <TimeField.Group
          fullWidth
          onBlur={onBlur}
          className={cn(pele.grupo, errorMessage ? pele.bordaErro : pele.bordaNormal, isDisabled && 'opacity-50')}
        >
          <TimeField.Prefix className={pele.prefixo}>
            <RelogioIcon size={16} />
          </TimeField.Prefix>
          <TimeField.Input className={pele.segmentos}>
            {(segment) => <TimeField.Segment segment={segment} className={pele.segmento} />}
          </TimeField.Input>
        </TimeField.Group>

        {errorMessage ? (
          <FieldError className={pele.erro}>{errorMessage}</FieldError>
        ) : (
          <Auxiliar hint={hint} pele={pele} />
        )}
      </TimeField>
    </I18nProvider>
  )
}
