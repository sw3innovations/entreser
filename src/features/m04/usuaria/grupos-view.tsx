'use client'

import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon, ChevronRightIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { useListaPaginada } from '@/features/m04/api/use-lista-paginada'
import { Estado } from '@/features/m04/ui/estado'
import { VerMais } from '@/features/m04/ui/ver-mais'
import { diaPorExtenso, hora, reais } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type SessaoResumo = components['schemas']['SessaoResumo']
type TipoSessao = components['schemas']['TipoSessao']

/**
 * U7 · Sessões de grupo abertas. `GET /grupos` já devolve só o que pode receber inscrição
 * (futuras, `Agendada`, com vaga) e traz `vagasDisponiveis` calculado (D7) e `jaInscrita`
 * — a tela nunca conta vagas nem cruza listas para saber se a usuária já entrou.
 */
export function GruposView({ tipo }: { tipo: TipoSessao }) {
  const router = useRouter()
  const voltar = useVoltar('/agendar')

  const { itens, total, carregando, carregandoMais, erro, vazio, temMais, carregarMais, recarregar } =
    useListaPaginada<SessaoResumo>(
      (page) => m04.GET('/grupos', { params: { query: { tipo, page, size: 20 } } }),
      [tipo],
    )

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
        title="Sessões em grupo"
        description="Encontros com tema definido, para atravessar junto com outras pessoas."
      />
      <PageContent width="md" className="pt-6">
        <Estado
          carregando={carregando}
          erro={erro}
          vazio={vazio}
          aoRepetir={recarregar}
          aoVazio={
            <EmptyState
              title="Nenhuma sessão aberta"
              description="Ainda não há sessões deste tipo com inscrições abertas. Volte em breve."
            />
          }
        >
          <div className="flex flex-col gap-3">
            {itens.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => router.push(`/agendar/grupo/${tipo}/${s.id}`)}
                className="group flex items-center gap-4 rounded-card border border-plum/8 bg-white p-4 text-left shadow-card transition-es hover:border-mauve/25 hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-[17px] leading-tight text-plum">
                      {s.tituloGrupo ?? 'Sessão em grupo'}
                    </h3>
                    {s.jaInscrita && (
                      <span className="rounded-pill bg-success-dark/[0.12] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-success-dark">
                        Inscrita
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13.5px] capitalize text-plum/60">
                    {diaPorExtenso(s.dataHora)} · {hora(s.dataHora)}
                  </p>
                  <p className="mt-0.5 text-xs text-plum/45">
                    {s.profissional.nome}
                    {s.vagasDisponiveis != null && ` · ${s.vagasDisponiveis} vagas restantes`}
                    {s.valorPraticado != null && reais(s.valorPraticado) && ` · ${reais(s.valorPraticado)}`}
                  </p>
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
