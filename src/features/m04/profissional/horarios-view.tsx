'use client'

import { useState } from 'react'
import { ESButton, PageHeader, PlusIcon, TimeInput, TrashIcon, useToast } from '@/components/ui'
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

const DIAS: { codigo: DiaSemana; label: string }[] = [
  { codigo: 'Segunda', label: 'Segunda-feira' },
  { codigo: 'Terca', label: 'Terça-feira' },
  { codigo: 'Quarta', label: 'Quarta-feira' },
  { codigo: 'Quinta', label: 'Quinta-feira' },
  { codigo: 'Sexta', label: 'Sexta-feira' },
  { codigo: 'Sabado', label: 'Sábado' },
  { codigo: 'Domingo', label: 'Domingo' },
]

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

/** Intervalo entre sessões — só leitura hoje; o backend é quem manda (D2). */
const INTERVALO_PADRAO = 10

/**
 * P4 · Meus horários (disponibilidade semanal). O `PUT` é **substituição total**: o que
 * for enviado passa a ser a agenda inteira, e o que não for enviado deixa de existir — a
 * tela diz isso com todas as letras.
 *
 * A resposta traz `sessoesForaDaNovaAgenda`: sessões já marcadas que não cabem mais na
 * nova agenda. Elas **não** são canceladas — o banner lista para a profissional decidir.
 *
 * Os horários geram slots conforme a duração de cada tipo, então o número de horários por
 * faixa VARIA: 09:00–12:00 dá até 3 sessões de 50 min, 2 de 60 ou 1 de 90. Por isso "até N".
 */
export function HorariosProfView() {
  const { showToast } = useToast()
  const [rascunho, setRascunho] = useState<FaixaLocal[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [afetadas, setAfetadas] = useState<SessaoResumo[] | null>(null)

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

  const editarFaixas = (fn: (atual: FaixaLocal[]) => FaixaLocal[]) => {
    setRascunho(fn(faixas))
    setErro(null)
    setAfetadas(null)
  }

  const doDia = (dia: DiaSemana) => faixas.filter((f) => f.diaSemana === dia)

  const adicionar = (dia: DiaSemana) =>
    editarFaixas((atual) => [
      ...atual,
      { diaSemana: dia, horaInicio: '09:00', horaFim: '12:00', intervaloMinutos: INTERVALO_PADRAO, ativa: true },
    ])

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

  /** "Atendo neste dia" liga/desliga o dia sem apagar as faixas. */
  const alternarDia = (dia: DiaSemana, ativo: boolean) =>
    editarFaixas((atual) => atual.map((f) => (f.diaSemana === dia ? { ...f, ativa: ativo } : f)))

  const invalidas = faixas.filter((f) => f.horaInicio >= f.horaFim)

  const salvar = async () => {
    if (salvando || invalidas.length > 0) return
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
      setAfetadas(data?.sessoesForaDaNovaAgenda ?? [])
      showToast('Horários salvos.', 'success')
      recarregar()
    } catch {
      setErro(mensagemDe())
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Meus horários"
        description="Os dias e faixas em que você atende. As usuárias só veem horários dentro delas."
      />

      <Estado carregando={carregando} erro={erroCarga} aoRepetir={recarregar}>
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {DIAS.map(({ codigo, label }) => {
              const doDiaAtual = doDia(codigo)
              const atende = doDiaAtual.length > 0 && doDiaAtual.some((f) => f.ativa)
              return (
                <section key={codigo} className={CARD}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-lg leading-tight text-plum">{label}</h3>
                    {doDiaAtual.length > 0 && (
                      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-plum/60">
                        <input
                          type="checkbox"
                          checked={atende}
                          onChange={(e) => alternarDia(codigo, e.target.checked)}
                          className="h-4 w-4 accent-[var(--color-mauve)]"
                        />
                        Atendo neste dia
                      </label>
                    )}
                  </div>

                  {doDiaAtual.length === 0 ? (
                    <p className="mt-2 text-[13px] text-plum/45">Nenhuma faixa neste dia.</p>
                  ) : (
                    <div className={cn('mt-3.5 flex flex-col gap-2.5', !atende && 'opacity-50')}>
                      {doDiaAtual.map((f, i) => {
                        const invalida = f.horaInicio >= f.horaFim
                        return (
                          <div key={`${codigo}-${i}`} className="flex flex-wrap items-center gap-2">
                            <TimeInput
                              value={f.horaInicio}
                              onChange={(v) => alterar(codigo, i, 'horaInicio', v)}
                              errorMessage={invalida ? ' ' : undefined}
                              className="w-[140px]"
                            />
                            <span className="text-plum/40">até</span>
                            <TimeInput
                              value={f.horaFim}
                              onChange={(v) => alterar(codigo, i, 'horaFim', v)}
                              errorMessage={invalida ? ' ' : undefined}
                              className="w-[140px]"
                            />
                            <button
                              type="button"
                              onClick={() => remover(codigo, i)}
                              aria-label="Remover faixa"
                              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-plum/40 transition-colors hover:bg-red-alert/10 hover:text-red-alert"
                            >
                              <TrashIcon size={16} />
                            </button>
                            {invalida && (
                              <span className="text-xs text-red-alert">O fim precisa ser depois do início.</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => adicionar(codigo)}
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-mauve hover:text-mauve-dark"
                  >
                    <PlusIcon size={15} /> Adicionar faixa
                  </button>
                </section>
              )
            })}
          </div>

          <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:shrink-0">
            <section className={CARD}>
              <h3 className="font-display text-base text-plum">Substituição total</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-plum/55">
                O que você salvar passa a ser a sua agenda inteira. Faixas removidas aqui deixam
                de existir.
              </p>
            </section>
            <section className={CARD}>
              <h3 className="font-display text-base text-plum">Como o intervalo conta</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-plum/55">
                Entre uma sessão e outra há {dados?.faixas[0]?.intervaloMinutos ?? INTERVALO_PADRAO} minutos
                de intervalo. Por isso uma faixa de 09:00 às 12:00 rende até 3 sessões de 50
                minutos — ou 1 de 90.
              </p>
              {dados?.timezone && (
                <p className="mt-2 text-xs text-plum/45">Horários no fuso de {dados.timezone.split('/')[1]?.replace('_', ' ')}.</p>
              )}
            </section>
          </aside>
        </div>

        {erro && (
          <p className="mt-5 rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
            {erro}
          </p>
        )}

        {afetadas && afetadas.length > 0 && (
          <div className="mt-5">
            <SessoesAfetadas sessoes={afetadas} titulo="Sessões que ficaram fora da nova agenda" />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-plum/8 pt-5">
          {sujo && <span className="mr-auto text-[13px] text-mauve">Alterações não salvas</span>}
          <ESButton variant="ghost" onPress={() => { setRascunho(null); setErro(null) }} isDisabled={!sujo || salvando}>
            Descartar
          </ESButton>
          <ESButton variant="primary" onPress={salvar} isLoading={salvando} isDisabled={!sujo || invalidas.length > 0}>
            Salvar meus horários
          </ESButton>
        </div>
      </Estado>
    </div>
  )
}
