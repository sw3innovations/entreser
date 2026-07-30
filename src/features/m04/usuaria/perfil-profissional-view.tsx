'use client'

import { useRouter } from 'next/navigation'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import type { components } from '@/features/m04/api/schema'

type Detalhe = components['schemas']['ProfissionalDetalhe']
type TipoSessao = components['schemas']['TipoSessao']

function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}
function reais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * U3 · Perfil da profissional. Carrega `GET /profissionais/{id}` (ProfissionalDetalhe).
 * Segue com o tipo escolhido na U1/U2 (`tipo` da rota); o valor vem de `tiposOferecidos`
 * (por tipo), sem recálculo. CTA leva aos horários (U4).
 */
export function PerfilProfissionalView({ tipo, profissionalId }: { tipo: TipoSessao; profissionalId: string }) {
  const router = useRouter()
  const voltar = useVoltar('/agendar')
  const { dados, carregando, erro, recarregar } = useRecurso<Detalhe>(
    () => m04.GET('/profissionais/{profissionalId}', { params: { path: { profissionalId } } }),
    [profissionalId],
  )
  const { dados: catalogo } = useRecurso(() => m04.GET('/tipos-sessao'), [])
  const nomeDoTipo = (codigo: TipoSessao) => catalogo?.tipos.find((t) => t.codigo === codigo)?.nome ?? codigo

  const valor = dados?.tiposOferecidos?.find((t) => t.tipoSessao === tipo)?.valor ?? null

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
        eyebrow="Perfil"
        title={dados?.nome ?? 'Profissional'}
        description={dados?.abordagem ?? undefined}
      />
      <PageContent width="md" className="pt-6">
        <Estado carregando={carregando} erro={erro} vazio={!dados} aoRepetir={recarregar}>
          {dados && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4 rounded-card border border-plum/8 bg-white p-4 shadow-card">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mauve-ghost">
                  {dados.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dados.foto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-xl text-mauve">{iniciais(dados.nome)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] text-plum/55">CRP {dados.crp}</p>
                  {valor != null && (
                    <p className="mt-0.5 text-sm font-medium text-mauve">{reais(valor)} por sessão</p>
                  )}
                </div>
              </div>

              {dados.bio && (
                <div>
                  <p className="text-eyebrow mb-2 text-mauve">Sobre</p>
                  <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-plum/70">{dados.bio}</p>
                </div>
              )}

              {dados.tiposOferecidos && dados.tiposOferecidos.length > 0 && (
                <div>
                  <p className="text-eyebrow mb-2 text-mauve">Tipos de sessão oferecidos</p>
                  <div className="flex flex-col gap-2">
                    {dados.tiposOferecidos
                      .filter((oferta): oferta is typeof oferta & { valor: number } => oferta.valor != null)
                      .map((oferta) => {
                        const selecionado = oferta.tipoSessao === tipo
                        return (
                          <div
                            key={oferta.tipoSessao}
                            className={cn(
                              'rounded-card border p-4 shadow-card',
                              selecionado ? 'border-mauve/40 bg-mauve-ghost' : 'border-plum/8 bg-white',
                            )}
                          >
                            <p className="text-[14.5px] font-medium text-plum">{nomeDoTipo(oferta.tipoSessao)}</p>
                            <p className="mt-0.5 text-[13px] text-plum/60">{reais(oferta.valor)} por sessão</p>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Estado>
      </PageContent>

      {/* Barra fixa: seguir para os horários (U4). */}
      {dados && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/[0.06] bg-[rgba(255,253,250,0.9)] shadow-[0_-6px_24px_rgba(45,24,64,0.08)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl px-[18px] pb-[18px] pt-[14px]">
            <button
              type="button"
              onClick={() => router.push(`/agendar/${tipo}/${profissionalId}/horarios`)}
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99]"
            >
              Ver horários
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
