'use client'

import { useMemo, useState } from 'react'
import { ESSpinner, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SunriseIcon,
  SunIcon,
  MoonIcon,
} from '@/features/usuaria/ui'
import {
  DIAS_DA_SEMANA,
  chaveDoDia,
  diaPorExtenso,
  hojeISO,
  hora,
  mesISO,
  mesesDoHorizonte,
  offsetDeMes,
  porPeriodo,
  type PeriodoChave,
} from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Slot = components['schemas']['Slot']

const ICONE_DO_PERIODO: Record<PeriodoChave, typeof SunriseIcon> = {
  manha: SunriseIcon,
  tarde: SunIcon,
  noite: MoonIcon,
}

interface CalendarioSlotsProps {
  /** Slots do HORIZONTE inteiro (ver `janelaDoHorizonte`), ordenados por `inicio`. */
  slots: Slot[]
  carregando: boolean
  aoEscolher: (slot: Slot) => void
  /** Trava os horários enquanto um envio está em curso (reagendamento). */
  desabilitado?: boolean
  /** Estado vazio de quando NÃO HÁ VAGA NENHUMA no horizonte — a saída muda entre
   *  agendar (pode trocar de profissional) e reagendar (não pode). */
  aoVazio: React.ReactNode
}

/**
 * Calendário do mês + horários do dia escolhido — a forma como a usuária escolhe horário
 * na U4 (agendar) e na U12 (reagendar).
 *
 * Substituiu a lista contínua semana a semana. A lista era honesta com a agenda esparsa
 * (só mostrava dias que tinham horário), mas escondia a pergunta que a pessoa realmente
 * traz — "dá pra quinta que vem?" —, porque para respondê-la era preciso rolar procurando
 * a data em vez de olhar para ela. O calendário coloca o mês inteiro à vista: os dias com
 * vaga ficam clicáveis e marcados com um ponto, os sem vaga ficam apagados, e a resposta
 * vem antes de qualquer clique.
 *
 * **A tela busca o horizonte inteiro de uma vez** (90 dias, o teto do contrato) e este
 * componente recorta o mês. Isso é o que torna mês e dia navegação puramente local — nem
 * trocar de mês nem trocar de dia dispara requisição — e o que permite abrir já no primeiro
 * mês COM vaga sem sondar mês a mês. Com a agenda esparsa isso importa: abrir no mês atual
 * quando ele está inteiro vazio dava de cara uma grade toda apagada.
 *
 * Mês e dia seguem o mesmo padrão: o clique da pessoa é guardado como `*Escolhido` e o valor
 * EFETIVO é derivado no render, com fallback recalculado a cada leva de slots. Nada disso
 * mora em efeito — não há render em cascata, e uma escolha manual nunca é desfeita por
 * baixo enquanto continuar existindo.
 */
export function CalendarioSlots({
  slots,
  carregando,
  aoEscolher,
  desabilitado,
  aoVazio,
}: CalendarioSlotsProps) {
  const hoje = hojeISO()
  const limiteMeses = useMemo(() => mesesDoHorizonte(), [])

  const porDia = useMemo(() => {
    const mapa = new Map<string, Slot[]>()
    for (const s of slots) {
      const k = chaveDoDia(s.inicio)
      const atual = mapa.get(k)
      if (atual) atual.push(s)
      else mapa.set(k, [s])
    }
    return mapa
  }, [slots])

  // Onde o calendário ABRE: o mês do primeiro slot do horizonte (a lista já vem ordenada
  // por `inicio`). Sem vaga nenhuma, fica no mês atual — não há mês melhor para mostrar.
  const mesInicial = slots.length > 0 ? Math.max(0, offsetDeMes(chaveDoDia(slots[0].inicio))) : 0
  const [mesEscolhido, setMesEscolhido] = useState<number | null>(null)
  const mes = mesEscolhido ?? mesInicial
  const grade = useMemo(() => mesISO(mes), [mes])

  const trocarMes = (delta: number) => {
    setMesEscolhido(Math.min(limiteMeses, Math.max(0, mes + delta)))
  }

  // O que a pessoa clicou — pode estar "vencido" (mudou de mês, ou o dia perdeu a última
  // vaga numa recarga). Daí o dia efetivo ser derivado: a escolha manual vale enquanto
  // existir DENTRO do mês visível, e o fallback é hoje, se hoje tiver vaga, ou o primeiro
  // dia disponível do mês.
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null)
  const noMes = (d: string) => d.slice(0, 7) === grade.inicio.slice(0, 7)
  const dia =
    diaEscolhido && noMes(diaEscolhido) && porDia.has(diaEscolhido)
      ? diaEscolhido
      : porDia.has(hoje) && noMes(hoje)
        ? hoje
        : (grade.dias.find((d): d is string => d !== null && porDia.has(d)) ?? null)

  const doDia = dia ? (porDia.get(dia) ?? []) : []

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-card border border-plum/8 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-plum/8 px-2 py-2">
          <button
            type="button"
            onClick={() => trocarMes(-1)}
            disabled={mes === 0}
            aria-label="Mês anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <span className="text-[13.5px] font-medium capitalize text-plum">{grade.rotulo}</span>
          <button
            type="button"
            onClick={() => trocarMes(1)}
            disabled={mes >= limiteMeses}
            aria-label="Próximo mês"
            className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>

        <div className="px-3 pb-3.5 pt-3">
          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {DIAS_DA_SEMANA.map((d) => (
              <span key={d} className="py-1 text-center text-[10.5px] uppercase tracking-[0.08em] text-plum/35">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1" aria-busy={carregando}>
            {grade.dias.map((d, i) => {
              if (d === null) return <span key={`vazio-${i}`} aria-hidden />
              const doDiaDaGrade = porDia.get(d)
              const selecionado = d === dia
              const ehHoje = d === hoje
              const numero = Number(d.slice(8))
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiaEscolhido(d)}
                  disabled={!doDiaDaGrade}
                  aria-pressed={selecionado}
                  aria-label={`${numero}${doDiaDaGrade ? ` · ${doDiaDaGrade.length} horários` : ' · sem horários'}`}
                  className={cn(
                    'relative flex aspect-square flex-col items-center justify-center rounded-xl text-[14.5px] transition-es',
                    selecionado
                      ? 'bg-mauve font-semibold text-cream'
                      : doDiaDaGrade
                        ? 'font-medium text-plum hover:bg-mauve-ghost'
                        : 'text-plum/20',
                    ehHoje && !selecionado && 'ring-1 ring-inset ring-mauve/40',
                  )}
                >
                  {numero}
                  {/* O ponto é o que faz a grade responder "que dias dá?" sem clique nenhum. */}
                  <span
                    className={cn(
                      'mt-0.5 h-1 w-1 rounded-full',
                      doDiaDaGrade ? (selecionado ? 'bg-cream/70' : 'bg-mauve') : 'bg-transparent',
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10">
          <ESSpinner label="Carregando horários…" />
        </div>
      ) : slots.length === 0 ? (
        aoVazio
      ) : dia ? (
        <section>
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="font-display text-lg capitalize leading-none text-plum">
              {diaPorExtenso(doDia[0].inicio)}
            </h2>
            <span className="text-xs text-plum/45">
              {doDia.length} {doDia.length === 1 ? 'horário' : 'horários'}
            </span>
          </div>
          <div className="flex flex-col gap-5">
            {porPeriodo(doDia).map(({ chave: periodo, rotulo, slots: doPeriodo }) => {
              const IconePeriodo = ICONE_DO_PERIODO[periodo]
              return (
                <div key={periodo}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <IconePeriodo size={15} className="text-mauve" />
                    <span className="text-eyebrow text-mauve">{rotulo}</span>
                    <span className="h-px flex-1 bg-plum/[0.09]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {doPeriodo.map((s) => (
                      <button
                        key={s.inicio}
                        type="button"
                        onClick={() => aoEscolher(s)}
                        disabled={desabilitado}
                        className="rounded-2xl border border-plum/8 bg-white p-3.5 text-left shadow-card transition-es hover:border-mauve hover:shadow-card-hover active:scale-[0.98] disabled:opacity-60"
                      >
                        <span className="block font-display text-xl leading-none text-plum">{hora(s.inicio)}</span>
                        <span className="mt-1 block text-[11.5px] text-plum/45">até {hora(s.fim)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        /* Há vaga no horizonte, mas nenhuma NESTE mês — só se chega aqui navegando de
           propósito, já que o calendário abre no primeiro mês com vaga. */
        <EmptyState
          title="Nenhum horário neste mês"
          description="Use as setas acima para voltar aos meses com horário disponível."
        />
      )}
    </div>
  )
}
