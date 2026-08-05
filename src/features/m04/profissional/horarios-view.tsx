'use client'

import { useState } from 'react'
import { PageHeader, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { SessoesAfetadas } from './sessoes-afetadas'
import type { components } from '@/features/m04/api/schema'

type DiaSemana = components['schemas']['DiaSemana']
type Faixa = components['schemas']['FaixaDisponibilidade']
type SessaoResumo = components['schemas']['SessaoResumo']

/** Faixa em edição — sem `id`, porque o PUT recria tudo (substituição total). */
interface FaixaLocal {
  diaSemana: DiaSemana
  horaInicio: string
  horaFim: string
  intervaloMinutos: number
  ativa: boolean
}

const DIAS: { codigo: DiaSemana; label: string; sigla: string }[] = [
  { codigo: 'Segunda', label: 'Segunda-feira', sigla: 'Seg' },
  { codigo: 'Terca', label: 'Terça-feira', sigla: 'Ter' },
  { codigo: 'Quarta', label: 'Quarta-feira', sigla: 'Qua' },
  { codigo: 'Quinta', label: 'Quinta-feira', sigla: 'Qui' },
  { codigo: 'Sexta', label: 'Sexta-feira', sigla: 'Sex' },
  { codigo: 'Sabado', label: 'Sábado', sigla: 'Sáb' },
  { codigo: 'Domingo', label: 'Domingo', sigla: 'Dom' },
]

const CARD = 'rounded-card border border-plum/5 bg-white shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

/** Intervalo entre sessões — só leitura hoje; o backend é quem manda (D2). */
const INTERVALO_PADRAO = 10
/** Duração de referência das sessões individuais, usada no rótulo de quantos horários a faixa gera. */
const DURACAO_BASE = 50

/** Faixa do mapa da semana, em minutos — o dia útil desenhado vai das 6h às 22h. */
const MAPA_INICIO = 6 * 60
const MAPA_FIM = 22 * 60

/**
 * Nome de exibição do fuso. Os identificadores IANA são ASCII por especificação
 * (`America/Sao_Paulo`), então trocar `_` por espaço deixaria "Sao Paulo" sem acento —
 * daí o mapa para os fusos que o produto realmente usa, com o cru como reserva.
 */
const FUSOS: Record<string, string> = {
  'America/Sao_Paulo': 'São Paulo',
  'America/Belem': 'Belém',
  'America/Cuiaba': 'Cuiabá',
  'America/Maceio': 'Maceió',
}
function nomeDoFuso(tz?: string): string | null {
  if (!tz) return null
  return FUSOS[tz] ?? (tz.split('/')[1]?.replace(/_/g, ' ') ?? tz)
}

/** `HH:mm` → minutos desde a meia-noite. */
function minutos(hhmm: string): number {
  const [h, m] = (hhmm || '0:0').split(':').map(Number)
  return h * 60 + m
}

/** Posição de um instante do dia (0–100%) na régua do mapa. */
function posicao(min: number): number {
  return Math.max(0, Math.min(100, ((min - MAPA_INICIO) / (MAPA_FIM - MAPA_INICIO)) * 100))
}

/**
 * Quantos horários a faixa gera. Cada sessão ocupa a duração + o intervalo, então
 * 09:00–12:00 com 50+10 rende 3 horários, não 4.
 */
function horariosGerados(f: FaixaLocal): number {
  const passo = DURACAO_BASE + (f.intervaloMinutos || INTERVALO_PADRAO)
  return Math.max(0, Math.floor((minutos(f.horaFim) - minutos(f.horaInicio)) / passo))
}

/**
 * P4 · Meus horários (disponibilidade semanal). O `PUT` é **substituição total**: o que
 * for enviado passa a ser a agenda inteira, e o que não for enviado deixa de existir — a
 * tela diz isso com todas as letras.
 *
 * A resposta traz `sessoesForaDaNovaAgenda`: sessões já marcadas que não cabem mais na
 * nova agenda. Elas **não** são canceladas — o banner lista para a profissional decidir.
 */
export function HorariosProfView() {
  const { showToast } = useToast()
  const [rascunho, setRascunho] = useState<FaixaLocal[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [afetadas, setAfetadas] = useState<SessaoResumo[] | null>(null)
  const [salvoLimpo, setSalvoLimpo] = useState(false)

  const { dados, carregando, erro: erroCarga, recarregar } = useRecurso(
    () => m04.GET('/profissional/disponibilidade'),
    [],
  )

  // Faixas exibidas: o rascunho (se houve edição) ou o que veio do servidor.
  const faixas: FaixaLocal[] =
    rascunho ??
    (dados?.faixas ?? []).map((f: Faixa) => ({
      diaSemana: f.diaSemana,
      horaInicio: f.horaInicio,
      horaFim: f.horaFim,
      intervaloMinutos: f.intervaloMinutos,
      ativa: f.ativa,
    }))
  const sujo = rascunho !== null
  const intervalo = dados?.faixas[0]?.intervaloMinutos ?? INTERVALO_PADRAO

  const editarFaixas = (fn: (atual: FaixaLocal[]) => FaixaLocal[]) => {
    setRascunho(fn(faixas))
    setErro(null)
    setAfetadas(null)
    setSalvoLimpo(false)
  }

  const doDia = (dia: DiaSemana) => faixas.filter((f) => f.diaSemana === dia)
  const atendeNo = (dia: DiaSemana) => doDia(dia).some((f) => f.ativa)

  const adicionar = (dia: DiaSemana) =>
    editarFaixas((atual) => {
      const doDiaAtual = atual.filter((f) => f.diaSemana === dia)
      const ultima = doDiaAtual[doDiaAtual.length - 1]
      return [
        ...atual,
        {
          diaSemana: dia,
          horaInicio: ultima ? ultima.horaFim : '09:00',
          horaFim: ultima ? '18:00' : '12:00',
          intervaloMinutos: intervalo,
          ativa: true,
        },
      ]
    })

  const remover = (dia: DiaSemana, indice: number) =>
    editarFaixas((atual) => {
      let visto = -1
      return atual.filter((f) => {
        if (f.diaSemana !== dia) return true
        visto += 1
        return visto !== indice
      })
    })

  const alterar = (dia: DiaSemana, indice: number, campo: 'horaInicio' | 'horaFim', valor: string) =>
    editarFaixas((atual) => {
      let visto = -1
      return atual.map((f) => {
        if (f.diaSemana !== dia) return f
        visto += 1
        return visto === indice ? { ...f, [campo]: valor } : f
      })
    })

  /**
   * "Atendo neste dia" liga/desliga o dia sem apagar as faixas — desligado elas ficam
   * guardadas. Ligar um dia que nunca teve faixa já cria a primeira, senão o toggle
   * ligaria para nada.
   */
  const alternarDia = (dia: DiaSemana) => {
    const ligado = atendeNo(dia)
    if (!ligado && doDia(dia).length === 0) {
      adicionar(dia)
      return
    }
    editarFaixas((atual) => atual.map((f) => (f.diaSemana === dia ? { ...f, ativa: !ligado } : f)))
  }

  const invalidas = faixas.filter((f) => f.horaInicio >= f.horaFim)

  const salvar = async () => {
    if (salvando || invalidas.length > 0 || !sujo) return
    setSalvando(true)
    setErro(null)
    try {
      const { data, error } = await m04.PUT('/profissional/disponibilidade', {
        // `intervaloMinutos` viaja como veio (só leitura hoje — quem define é o backend, D2).
        body: {
          faixas: faixas.map(({ diaSemana, horaInicio, horaFim, intervaloMinutos, ativa }) => ({
            diaSemana,
            horaInicio,
            horaFim,
            intervaloMinutos,
            ativa,
          })),
        },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      setRascunho(null)
      const fora = data?.sessoesForaDaNovaAgenda ?? []
      setAfetadas(fora)
      setSalvoLimpo(fora.length === 0)
      showToast('Horários salvos.', 'success')
      recarregar()
    } catch {
      setErro(mensagemDe())
    } finally {
      setSalvando(false)
    }
  }

  const diasAtivos = DIAS.filter((d) => atendeNo(d.codigo)).length
  const totalHorarios = faixas
    .filter((f) => f.ativa)
    .reduce((soma, f) => soma + horariosGerados(f), 0)
  const fuso = nomeDoFuso(dados?.timezone)

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Meus horários"
        description={`Seus horários geram automaticamente as opções que as usuárias veem. Entre uma sessão e outra deixamos ${intervalo} minutos de intervalo.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {fuso && (
              <span className="inline-flex items-center gap-2 rounded-pill border border-plum/10 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-plum/62">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5V12l3.5 2" />
                </svg>
                Fuso de {fuso}
              </span>
            )}
            {sujo && (
              <>
                <span className="inline-flex items-center gap-2 rounded-pill bg-mauve/12 px-3.5 py-1.5 text-[13px] font-semibold text-mauve">
                  <span className="h-[7px] w-[7px] rounded-pill bg-mauve" />
                  Alterações não salvas
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRascunho(null)
                    setErro(null)
                  }}
                  className="rounded-pill px-4 py-2.5 text-sm font-semibold text-mauve transition-colors hover:bg-mauve-ghost"
                >
                  Descartar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={salvar}
              disabled={!sujo || salvando || invalidas.length > 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-pill px-[22px] py-2.5 text-sm font-semibold transition-all',
                sujo && !salvando && invalidas.length === 0
                  ? 'bg-mauve text-white shadow-[0_8px_20px_rgba(122,74,92,0.28)] hover:bg-mauve-dark'
                  : 'cursor-not-allowed bg-plum/10 text-plum/40',
              )}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M17 21v-8H7v8M7 3v5h8" />
              </svg>
              {salvando ? 'Salvando…' : 'Salvar meus horários'}
            </button>
          </div>
        }
      />

      {erro && (
        <div className="mb-5 flex items-start gap-3.5 rounded-card border border-red-alert/28 bg-red-alert/[0.06] p-[18px]">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--color-red-alert)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <path d="M12 8.5v5M12 17h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-plum">Não conseguimos salvar</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-plum/70">{erro}</p>
          </div>
        </div>
      )}

      {salvoLimpo && (
        <div className="mb-5 flex items-center gap-3.5 rounded-card border border-success-dark/25 bg-success-dark/[0.06] p-[18px]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-success-dark/[0.14] text-success-dark">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 13 5 5L20 7" />
            </svg>
          </span>
          <p className="min-w-0 flex-1 text-[15px] font-semibold text-plum">Horários salvos.</p>
          <button
            type="button"
            onClick={() => setSalvoLimpo(false)}
            aria-label="Fechar aviso"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[17px] leading-none text-plum/45 transition-colors hover:bg-plum/6 hover:text-plum"
          >
            ×
          </button>
        </div>
      )}

      {afetadas && afetadas.length > 0 && (
        <div className="mb-5">
          <SessoesAfetadas
            sessoes={afetadas}
            titulo={`Horários salvos. ${afetadas.length} ${afetadas.length === 1 ? 'sessão já marcada ficou' : 'sessões já marcadas ficaram'} fora da sua nova disponibilidade.`}
            onFechar={() => setAfetadas(null)}
          />
        </div>
      )}

      <Estado carregando={carregando} erro={erroCarga} aoRepetir={recarregar}>
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* Mapa da semana */}
            <section className={cn(CARD, 'px-[26px] pb-[18px] pt-[22px]')}>
              <div className="mb-4 flex flex-wrap items-baseline gap-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mauve">Sua semana</p>
                <span className="h-px min-w-5 flex-1 bg-plum/8" />
                <span className="text-[13px] text-plum/55">
                  {diasAtivos} {diasAtivos === 1 ? 'dia' : 'dias'} · {totalHorarios}{' '}
                  {totalHorarios === 1 ? 'horário gerado' : 'horários gerados'}
                </span>
              </div>

              <div className="mb-2 flex items-center gap-3">
                <span className="w-[42px] shrink-0" />
                <div className="flex flex-1 justify-between">
                  {['6h', '10h', '14h', '18h', '22h'].map((h) => (
                    <span key={h} className="text-[10.5px] text-plum/38">
                      {h}
                    </span>
                  ))}
                </div>
                <span className="w-[58px] shrink-0" />
              </div>

              <div className="flex flex-col gap-1.5">
                {DIAS.map((d) => {
                  const doDiaAtual = doDia(d.codigo)
                  const ligado = atendeNo(d.codigo)
                  const horas = doDiaAtual.filter((f) => f.ativa).reduce((s, f) => s + horariosGerados(f), 0)
                  return (
                    <div key={d.codigo} className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-[42px] shrink-0 text-[12.5px] font-semibold',
                          ligado ? 'text-plum' : 'text-plum/35',
                        )}
                      >
                        {d.sigla}
                      </span>
                      <div className="relative h-[22px] flex-1 overflow-hidden rounded-lg bg-plum/[0.045]">
                        {doDiaAtual.map((f, i) => {
                          const de = posicao(minutos(f.horaInicio))
                          const ate = posicao(minutos(f.horaFim))
                          return (
                            <span
                              key={`${d.codigo}-${i}`}
                              className="absolute top-[3px] h-4 rounded-md"
                              style={{
                                left: `${de}%`,
                                width: `${Math.max(1.5, ate - de)}%`,
                                background: f.ativa ? 'var(--color-mauve)' : 'rgba(45,24,64,0.14)',
                              }}
                            />
                          )
                        })}
                      </div>
                      <span
                        className={cn(
                          'w-[58px] shrink-0 text-right text-xs',
                          ligado ? 'text-plum/50' : 'text-plum/30',
                        )}
                      >
                        {ligado && horas > 0 ? `${horas}h` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Editor de faixas */}
            <section className={cn(CARD, 'overflow-hidden')}>
              <div className="flex flex-wrap items-center gap-3.5 px-[26px] pb-4 pt-5">
                <h2 className="font-display text-[22px] font-medium text-plum">Faixas por dia</h2>
                <span className="text-[12.5px] text-plum/50">
                  Cada faixa vira horários de {DURACAO_BASE} minutos, com {intervalo} de intervalo.
                </span>
              </div>

              {DIAS.map((d) => {
                const doDiaAtual = doDia(d.codigo)
                const ligado = atendeNo(d.codigo)
                const total = doDiaAtual.filter((f) => f.ativa).reduce((s, f) => s + horariosGerados(f), 0)
                return (
                  <div
                    key={d.codigo}
                    className="flex flex-wrap items-center gap-5 border-t border-plum/7 px-[26px] py-3.5 transition-colors hover:bg-plum/[0.015]"
                  >
                    <div className="flex w-[206px] shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => alternarDia(d.codigo)}
                        role="switch"
                        aria-checked={ligado}
                        aria-label={ligado ? `Não atender em ${d.label}` : `Atender em ${d.label}`}
                        className={cn(
                          'relative h-[23px] w-10 shrink-0 rounded-pill transition-colors',
                          ligado ? 'bg-mauve' : 'bg-plum/18',
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-1 h-[15px] w-[15px] rounded-pill bg-white shadow-[0_2px_6px_rgba(45,24,64,0.28)] transition-[left] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                            ligado ? 'left-[21px]' : 'left-1',
                          )}
                        />
                      </button>
                      <div className="min-w-0">
                        <p className={cn('text-[15px] font-semibold', ligado ? 'text-plum' : 'text-plum/42')}>
                          {d.label}
                        </p>
                        <p className={cn('mt-0.5 text-[12.5px]', ligado ? 'text-plum/50' : 'text-plum/35')}>
                          {ligado
                            ? `${total} ${total === 1 ? 'horário na semana' : 'horários por semana'}`
                            : doDiaAtual.length > 0
                              ? `${doDiaAtual.length} ${doDiaAtual.length === 1 ? 'faixa guardada' : 'faixas guardadas'}`
                              : 'Sem faixas'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'flex min-w-0 flex-1 basis-[280px] flex-wrap items-center gap-2.5',
                        !ligado && 'opacity-45',
                      )}
                    >
                      {doDiaAtual.map((f, i) => {
                        const gerados = horariosGerados(f)
                        const invertida = minutos(f.horaFim) <= minutos(f.horaInicio)
                        const ruim = invertida || gerados === 0
                        return (
                          <div
                            key={`${d.codigo}-${i}`}
                            className={cn(
                              'flex flex-col gap-px rounded-2xl border py-2 pl-[13px] pr-2.5',
                              ruim ? 'border-red-alert/45 bg-red-alert/5' : 'border-plum/12 bg-cream',
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <input
                                type="time"
                                value={f.horaInicio}
                                onChange={(e) => alterar(d.codigo, i, 'horaInicio', e.target.value)}
                                aria-label={`Início da faixa ${i + 1} de ${d.label}`}
                                className="w-[62px] border-0 bg-transparent p-0 text-[15px] font-semibold text-plum outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                              />
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(45,24,64,0.35)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <path d="M5 12h14M13 6l6 6-6 6" />
                              </svg>
                              <input
                                type="time"
                                value={f.horaFim}
                                onChange={(e) => alterar(d.codigo, i, 'horaFim', e.target.value)}
                                aria-label={`Fim da faixa ${i + 1} de ${d.label}`}
                                className="w-[62px] border-0 bg-transparent p-0 text-[15px] font-semibold text-plum outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                              />
                              <button
                                type="button"
                                onClick={() => remover(d.codigo, i)}
                                aria-label={`Remover faixa ${i + 1} de ${d.label}`}
                                className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-[15px] leading-none text-plum/40 transition-colors hover:bg-red-alert/10 hover:text-red-alert"
                              >
                                ×
                              </button>
                            </div>
                            <span className={cn('text-[11.5px]', ruim ? 'text-red-alert' : 'text-plum/50')}>
                              {invertida
                                ? 'término antes do início'
                                : gerados === 0
                                  ? 'curto demais'
                                  : `${gerados} ${gerados === 1 ? 'horário' : 'horários'} de ${DURACAO_BASE} min`}
                            </span>
                          </div>
                        )
                      })}

                      {doDiaAtual.length === 0 && (
                        <span className={cn('text-[13px]', ligado ? 'text-red-alert' : 'text-plum/40')}>
                          {ligado ? 'Nenhuma faixa — ninguém consegue marcar' : 'Nenhuma faixa guardada'}
                        </span>
                      )}

                      {ligado && (
                        <button
                          type="button"
                          onClick={() => adicionar(d.codigo)}
                          aria-label={`Adicionar faixa em ${d.label}`}
                          className="flex h-[52px] w-[46px] items-center justify-center rounded-2xl border border-dashed border-mauve/42 text-mauve transition-colors hover:border-solid hover:bg-mauve-ghost"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          </div>

          <aside className="flex w-full flex-col gap-5 lg:w-[300px] lg:shrink-0">
            <section className="rounded-card border border-mauve/22 bg-white p-[22px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-mauve-ghost text-mauve">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mauve">
                  Substituição total
                </p>
              </div>
              <p className="text-[13.5px] leading-relaxed text-plum/72">
                O que você salvar passa a ser a <strong className="font-semibold">sua agenda inteira</strong>.
                As faixas que você remover deixam de existir, e as novas passam a aparecer para as
                usuárias na hora.
              </p>
            </section>

            <section className={cn(CARD, 'p-[22px]')}>
              <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-mauve">
                Como o intervalo conta
              </p>
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-[26px] flex-1 rounded-md bg-mauve/85" />
                <span className="h-[26px] w-[9px] rounded-[3px] bg-plum/12" />
                <span className="h-[26px] flex-1 rounded-md bg-mauve/85" />
                <span className="h-[26px] w-[9px] rounded-[3px] bg-plum/12" />
                <span className="h-[26px] flex-1 rounded-md bg-mauve/85" />
              </div>
              <p className="text-[13px] leading-relaxed text-plum/65">
                Cada sessão ocupa {DURACAO_BASE} minutos mais {intervalo} de intervalo. Por isso{' '}
                <strong className="font-semibold">09:00 às 12:00 gera 3 horários</strong>, não 4.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-plum/45">
                O intervalo é fixo neste momento e não pode ser editado por aqui.
              </p>
            </section>
          </aside>
        </div>
      </Estado>
    </div>
  )
}
