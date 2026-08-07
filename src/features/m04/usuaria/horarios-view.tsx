'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import {
  PageHero,
  PageContent,
  HeroIconButton,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SunriseIcon,
  SunIcon,
  MoonIcon,
} from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import {
  chaveDoDia,
  diaPorExtenso,
  hora,
  semanaISO,
  reais,
  porPeriodo,
  HORIZONTE_AGENDAMENTO_SEMANAS,
  type PeriodoChave,
} from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Slot = components['schemas']['Slot']
type TipoSessao = components['schemas']['TipoSessao']

const ICONE_DO_PERIODO: Record<PeriodoChave, typeof SunriseIcon> = {
  manha: SunriseIcon,
  tarde: SunIcon,
  noite: MoonIcon,
}

/** Teto da navegação — automática e manual. É o horizonte de agendamento: além dele a
 * sessão marcada não apareceria na agenda da profissional. */
const LIMITE_SEMANAS = HORIZONTE_AGENDAMENTO_SEMANAS

/**
 * Agrupa os slots por dia no fuso da USUÁRIA (não no UTC). Preserva a ordem que veio do
 * servidor (`slots` já vem ordenado por `inicio`).
 */
function porDia(slots: Slot[]): { chave: string; slots: Slot[] }[] {
  const mapa = new Map<string, Slot[]>()
  for (const s of slots) {
    const k = chaveDoDia(s.inicio)
    const atual = mapa.get(k)
    if (atual) atual.push(s)
    else mapa.set(k, [s])
  }
  return [...mapa.entries()].map(([chave, slots]) => ({ chave, slots }))
}

/**
 * U4 · Horários disponíveis. Navegação semana a semana (#3): a cada semana, agrupa por dia
 * e traz só os dias que TÊM horário — com agenda esparsa, uma grade fixa ficaria quase toda
 * vazia. `semana` é um offset a partir da semana atual (0 = esta semana); "Anterior" trava
 * em 0 porque não dá pra marcar no passado. O backend já filtrou o que não pode ser
 * marcado, então a tela nunca desabilita um horário: se veio, é selecionável. Escolher um
 * horário leva à confirmação (U5).
 *
 * **Abre sempre na semana ATUAL.** Houve aqui um avanço automático até a primeira semana
 * com horário: com a agenda esparsa parecia útil, mas desorientava — quem entrava em agosto
 * era levado em silêncio para outubro, sem pedir e sem entender por quê, e o "Anterior"
 * passava a ser a única pista de que a semana de hoje havia sido pulada. Hoje quem decide
 * andar é a pessoa; o estado vazio diz o que fazer.
 */
export function HorariosView({ tipo, profissionalId }: { tipo: TipoSessao; profissionalId: string }) {
  const router = useRouter()
  const voltar = useVoltar(`/agendar/${tipo}`)
  const [semana, setSemana] = useState(0)
  const semanaAtual = semanaISO(semana)

  const { dados, carregando, erro, recarregar } = useRecurso(
    () =>
      m04.GET('/profissionais/{profissionalId}/slots', {
        params: { path: { profissionalId }, query: { tipo, inicio: semanaAtual.inicio, fim: semanaAtual.fim } },
      }),
    [profissionalId, tipo, semana],
  )

  const dias = porDia(dados?.slots ?? [])
  const vazio = !carregando && !erro && dias.length === 0

  const irParaSemana = (delta: number) => {
    setSemana((s) => Math.min(LIMITE_SEMANAS, Math.max(0, s + delta)))
  }

  const escolher = (slot: Slot) => {
    router.push(
      `/agendar/${tipo}/${profissionalId}/confirmar?inicio=${encodeURIComponent(slot.inicio)}&fim=${encodeURIComponent(slot.fim)}`,
    )
  }

  const topBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        topBar={topBar}
        topBarClassName="lg:hidden"
        eyebrow="Agendar"
        title="Escolha o horário"
        description={
          dados
            ? [`Sessão de ${dados.duracaoMinutos} minutos`, reais(dados.valor)].filter(Boolean).join(' · ')
            : 'Horários disponíveis'
        }
      />
      <PageContent width="md" className="pt-6">
        <div className="mb-5 flex items-center justify-between rounded-input border border-plum/8 bg-white px-2 py-2 shadow-card">
          <button
            type="button"
            onClick={() => irParaSemana(-1)}
            disabled={semana === 0}
            aria-label="Semana anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <span className="text-[13.5px] font-medium capitalize text-plum">Semana de {semanaAtual.rotulo}</span>
          <button
            type="button"
            onClick={() => irParaSemana(1)}
            disabled={semana >= LIMITE_SEMANAS}
            aria-label="Próxima semana"
            className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>

        <Estado
          carregando={carregando}
          erro={erro}
          vazio={vazio}
          aoRepetir={recarregar}
          aoVazio={
            <EmptyState
              title="Nenhum horário nesta semana"
              description="Esta profissional não tem horários livres nesta semana. Tente a próxima semana ou escolha outra profissional."
            />
          }
        >
          <div className="flex flex-col gap-7">
            {dias.map(({ chave, slots }) => (
              <section key={chave}>
                <div className="mb-3.5 flex items-baseline justify-between">
                  <h2 className="font-display text-lg capitalize leading-none text-plum">
                    {diaPorExtenso(slots[0].inicio)}
                  </h2>
                  <span className="text-xs text-plum/45">
                    {slots.length} {slots.length === 1 ? 'horário' : 'horários'}
                  </span>
                </div>
                <div className="flex flex-col gap-5">
                  {porPeriodo(slots).map(({ chave: periodo, rotulo, slots: doPeriodo }) => {
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
                              onClick={() => escolher(s)}
                              className="rounded-2xl border border-plum/8 bg-white p-3.5 text-left shadow-card transition-es hover:border-mauve hover:shadow-card-hover active:scale-[0.98]"
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
            ))}
          </div>
        </Estado>
      </PageContent>
    </div>
  )
}
