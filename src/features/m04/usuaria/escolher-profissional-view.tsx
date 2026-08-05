'use client'

import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import {
  PageHero,
  PageContent,
  HeroIconButton,
  ArrowLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
} from '@/features/usuaria/ui'
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
          <div className="flex flex-col gap-3.5">
            {itens.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/agendar/${tipo}/${p.id}`)}
                className="group block rounded-card border border-plum/8 bg-white p-[18px] text-left shadow-card transition-es hover:border-mauve/25 hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mauve to-plum-mid shadow-[0_6px_16px_rgba(122,74,92,0.28)]">
                    {p.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.foto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-lg text-cream">{iniciais(p.nome)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg leading-tight text-plum">{p.nome}</h3>
                      <ChevronRightIcon
                        size={18}
                        className="mt-0.5 shrink-0 text-plum/30 transition-es group-hover:translate-x-0.5 group-hover:text-mauve"
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-pill border border-mauve/[0.14] bg-mauve-ghost px-2.5 py-1 text-[11.5px] font-medium text-mauve">
                        CRP {p.crp}
                      </span>
                      {p.abordagem && (
                        <span className="rounded-pill bg-plum/[0.04] px-2.5 py-1 text-[11.5px] text-plum/55">
                          {p.abordagem}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {p.bio && (
                  <p className="mt-3.5 line-clamp-2 text-[13.5px] leading-relaxed text-plum/60">{p.bio}</p>
                )}

                {valorLabel(p.valor) && (
                  <div className="mt-3.5 flex items-center gap-2 border-t border-plum/8 pt-3 text-[14px] font-semibold text-plum">
                    <CreditCardIcon size={14} className="text-plum/40" />
                    {valorLabel(p.valor)}
                  </div>
                )}
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
