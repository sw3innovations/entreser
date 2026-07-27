'use client'

import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon, ChevronRightIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { useListaPaginada } from '@/features/m04/api/use-lista-paginada'
import { Estado } from '@/features/m04/ui/estado'
import { VerMais } from '@/features/m04/ui/ver-mais'
import type { components } from '@/features/m04/api/schema'

type Prof = components['schemas']['ProfissionalResumo']
type TipoSessao = components['schemas']['TipoSessao']

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function valorLabel(valor?: number | null): string | null {
  if (valor == null) return null
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por sessão`
}

/**
 * U2 · Profissionais que atendem o tipo escolhido. Lista paginada (`GET /profissionais?tipo`),
 * com `valor` já resolvido para o tipo (nunca recalculado). Abre o perfil (U3).
 */
export function EscolherProfissionalView({ tipo }: { tipo: TipoSessao }) {
  const router = useRouter()
  const voltar = useVoltar('/agendar')
  const { itens, total, carregando, carregandoMais, erro, vazio, temMais, carregarMais, recarregar } =
    useListaPaginada<Prof>(
      (page) => m04.GET('/profissionais', { params: { query: { tipo, page, size: 20 } } }),
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
        eyebrow="Agendar"
        title="Escolha a profissional"
        description="Quem você quer que acompanhe este momento."
      />
      <PageContent width="md" className="pt-6">
        <Estado
          carregando={carregando}
          erro={erro}
          vazio={vazio}
          aoRepetir={recarregar}
          aoVazio={
            <EmptyState
              title="Nenhuma profissional disponível"
              description="Ainda não há profissionais atendendo esse tipo de sessão. Tente outro tipo."
            />
          }
        >
          <div className="flex flex-col gap-3">
            {itens.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/agendar/${tipo}/${p.id}`)}
                className="group flex items-center gap-4 rounded-card border border-plum/8 bg-white p-4 text-left shadow-card transition-es hover:border-mauve/25 hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mauve-ghost">
                  {p.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.foto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-lg text-mauve">{iniciais(p.nome)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg leading-tight text-plum">{p.nome}</h3>
                  {p.abordagem && <p className="mt-0.5 truncate text-[13px] text-plum/55">{p.abordagem}</p>}
                  {valorLabel(p.valor) && <p className="mt-1 text-xs font-medium text-mauve">{valorLabel(p.valor)}</p>}
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
