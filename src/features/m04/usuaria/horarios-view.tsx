'use client'

import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { chaveDoDia, diaPorExtenso, faixaHoraria, hojeISO, emDiasISO, reais } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Slot = components['schemas']['Slot']
type TipoSessao = components['schemas']['TipoSessao']

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
 * U4 · Horários disponíveis. Lista contínua dos próximos 30 dias, agrupada por dia e
 * trazendo só os dias que TÊM horário (D24 — sem calendário navegável: com agenda
 * esparsa, a grade fica quase toda vazia). O backend já filtrou o que não pode ser
 * marcado, então a tela nunca desabilita um horário: se veio, é selecionável.
 * Escolher um horário leva à confirmação (U5).
 */
export function HorariosView({ tipo, profissionalId }: { tipo: TipoSessao; profissionalId: string }) {
  const router = useRouter()
  const voltar = useVoltar(`/agendar/${tipo}`)

  const { dados, carregando, erro, recarregar } = useRecurso(
    () =>
      m04.GET('/profissionais/{profissionalId}/slots', {
        params: { path: { profissionalId }, query: { tipo, inicio: hojeISO(), fim: emDiasISO(30) } },
      }),
    [profissionalId, tipo],
  )

  const dias = porDia(dados?.slots ?? [])
  const vazio = !carregando && !erro && dias.length === 0

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
        eyebrow="Agendar"
        title="Escolha o horário"
        description={
          dados
            ? [`Sessão de ${dados.duracaoMinutos} minutos`, reais(dados.valor)].filter(Boolean).join(' · ')
            : 'Horários disponíveis'
        }
      />
      <PageContent width="md" className="pt-6">
        <Estado
          carregando={carregando}
          erro={erro}
          vazio={vazio}
          aoRepetir={recarregar}
          aoVazio={
            <EmptyState
              title="Nenhum horário disponível"
              description="Esta profissional não tem horários livres nos próximos 30 dias. Você pode escolher outra profissional."
            />
          }
        >
          <div className="flex flex-col gap-6">
            {dias.map(({ chave, slots }) => (
              <section key={chave}>
                <h2 className="mb-2.5 font-display text-lg capitalize leading-none text-plum">
                  {diaPorExtenso(slots[0].inicio)}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.inicio}
                      type="button"
                      onClick={() => escolher(s)}
                      className="rounded-input border border-plum/10 bg-white px-4 py-2.5 text-sm font-medium text-plum shadow-card transition-es hover:border-mauve hover:text-mauve active:scale-[0.98]"
                    >
                      {faixaHoraria(s.inicio, s.fim)}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Estado>
      </PageContent>
    </div>
  )
}
