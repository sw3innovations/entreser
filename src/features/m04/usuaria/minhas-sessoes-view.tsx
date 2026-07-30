'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState, ESButton } from '@/components/ui'
import { PageHero, PageContent, ChevronRightIcon } from '@/features/usuaria/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { useListaPaginada } from '@/features/m04/api/use-lista-paginada'
import { Estado } from '@/features/m04/ui/estado'
import { VerMais } from '@/features/m04/ui/ver-mais'
import { diaPorExtenso, hora } from '@/features/m04/lib/datas'
import { STATUS_LABEL, STATUS_TOM } from '@/features/m04/lib/sessao'
import type { components } from '@/features/m04/api/schema'

type SessaoResumo = components['schemas']['SessaoResumo']
type StatusSessao = components['schemas']['StatusSessao']

/**
 * Filtros da tela. "Agendadas" cobre `Agendada` e `Confirmada` — são o mesmo estado
 * visual (D8), inclusive aqui.
 *
 * "Próximas" e "Anteriores" usam `de`/`ate` (não só `status`) para separar passado e
 * futuro de fato — sem isso, uma sessão `Cancelada` no passado não caía em filtro
 * nenhum. `de`/`ate` é recalculado a cada clique (ver `useListaPaginada` abaixo), então
 * aqui basta guardar como montar a query.
 */
const FILTROS: { chave: string; label: string; status?: StatusSessao[]; periodo?: 'proximas' | 'anteriores' }[] = [
  { chave: 'proximas', label: 'Próximas', status: ['Agendada', 'Confirmada'], periodo: 'proximas' },
  { chave: 'anteriores', label: 'Anteriores', status: ['Realizada', 'Cancelada'], periodo: 'anteriores' },
  { chave: 'todas', label: 'Todas' },
]

/**
 * U9 · Minhas sessões. Lista paginada (`GET /usuaria/sessoes`) com filtro de situação
 * feito NO SERVIDOR — filtrar no cliente só alcançaria a página carregada. Abre a U10.
 */
export function MinhasSessoesView() {
  const router = useRouter()
  const [filtro, setFiltro] = useState(FILTROS[0])

  const { itens, total, carregando, carregandoMais, erro, vazio, temMais, carregarMais, recarregar } =
    useListaPaginada<SessaoResumo>(
      (page) => {
        const agora = new Date().toISOString()
        return m04.GET('/usuaria/sessoes', {
          params: {
            query: {
              status: filtro.status,
              de: filtro.periodo === 'proximas' ? agora : undefined,
              ate: filtro.periodo === 'anteriores' ? agora : undefined,
              page,
              size: 20,
            },
          },
        })
      },
      [filtro.chave],
    )

  // Nome do tipo vem do catálogo (nunca escrito na tela).
  const { dados: catalogo } = useRecurso(() => m04.GET('/tipos-sessao'), [])
  const nomeDoTipo = (s: SessaoResumo) => catalogo?.tipos.find((t) => t.codigo === s.tipo)?.nome ?? s.tipo

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        eyebrow="Suas sessões"
        title="Minhas sessões"
        description="Acompanhe o que está marcado e o que já aconteceu."
      />
      <PageContent width="md" className="pt-6">
        <div className="mb-5 flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                'rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors',
                f.chave === filtro.chave
                  ? 'border-mauve bg-mauve text-white'
                  : 'border-plum/12 bg-white text-plum/70 hover:border-plum/25',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Estado
          carregando={carregando}
          erro={erro}
          vazio={vazio}
          aoRepetir={recarregar}
          aoVazio={
            <EmptyState
              title="Nenhuma sessão por aqui"
              description="Quando você marcar uma sessão, ela aparece nesta lista."
              action={<ESButton variant="primary" onPress={() => router.push('/agendar')}>Marcar uma sessão</ESButton>}
            />
          }
        >
          <div className="flex flex-col gap-3">
            {itens.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => router.push(`/sessoes/${s.id}`)}
                className="group flex items-center gap-4 rounded-card border border-plum/8 bg-white p-4 text-left shadow-card transition-es hover:border-mauve/25 hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-[17px] leading-tight text-plum">
                      {s.tituloGrupo ?? nomeDoTipo(s)}
                    </h3>
                    <span
                      className={cn(
                        'rounded-pill px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider',
                        STATUS_TOM[s.status],
                      )}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                    {s.linkMeetStatus === 'Falhou' && (
                      <span className="rounded-pill bg-red-alert/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-red-alert">
                        Sala com problema
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13.5px] capitalize text-plum/60">
                    {diaPorExtenso(s.dataHora)} · {hora(s.dataHora)}
                  </p>
                  <p className="mt-0.5 text-xs text-plum/45">{s.profissional.nome}</p>
                </div>
                <ChevronRightIcon
                  size={20}
                  className="shrink-0 text-plum/25 transition-es group-hover:translate-x-0.5 group-hover:text-mauve"
                />
              </button>
            ))}
          </div>
          {temMais && (
            <VerMais carregado={itens.length} total={total} carregando={carregandoMais} onVerMais={carregarMais} />
          )}
        </Estado>
      </PageContent>
    </div>
  )
}
