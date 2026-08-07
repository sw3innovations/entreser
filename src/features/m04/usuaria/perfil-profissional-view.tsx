'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon, CheckIcon, CreditCardIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useCatalogoTipos } from '@/features/m04/api/use-catalogo'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { iconeDoTipo } from '@/features/m04/lib/tipo-icone'
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
 * Chega com o tipo escolhido na U1/U2 (`tipo` da rota), mas a pessoa pode trocar aqui —
 * troca é só estado local (`tipoSelecionado`): já temos o preço de TODOS os tipos em
 * `tiposOferecidos`, então mudar a seleção não precisa de navegação nem novo fetch (evita
 * o "piscar" de recarregar a tela inteira ao só trocar qual tipo está marcado). A URL só
 * muda de fato quando a pessoa avança para os horários (U4), com o tipo já resolvido.
 */
export function PerfilProfissionalView({ tipo, profissionalId }: { tipo: TipoSessao; profissionalId: string }) {
  const router = useRouter()
  const voltar = useVoltar('/agendar')
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoSessao>(tipo)
  const { dados, carregando, erro, recarregar } = useRecurso<Detalhe>(
    () => m04.GET('/profissionais/{profissionalId}', { params: { path: { profissionalId } } }),
    [profissionalId],
  )
  const { catalogo } = useCatalogoTipos()
  const infoDoTipo = (codigo: TipoSessao) => catalogo?.tipos.find((t) => t.codigo === codigo)
  const nomeDoTipo = (codigo: TipoSessao) => infoDoTipo(codigo)?.nome ?? codigo

  /**
   * Só os tipos que ESTE fluxo aceita. Esta rota é a do atendimento individual — grupo tem
   * rota própria (`/agendar/grupo/{tipo}`), com inscrição em vez de marcação.
   *
   * Sem o recorte por categoria, um tipo de grupo aparecia aqui e a pessoa seguia até o fim:
   * escolhia data e hora e só o `POST /sessoes` recusava, com `TIPO_E_DE_GRUPO`. Pior que
   * tardio, o aviso é inacionável — ele manda usar o fluxo de grupo, e não há como chegar lá
   * a partir da confirmação. A categoria já vinha carregada no catálogo; faltava usá-la.
   *
   * Enquanto o catálogo não chega não dá para classificar ninguém: melhor não listar do que
   * listar tudo e tirar itens da tela no instante seguinte.
   */
  const ofertas = catalogo
    ? (dados?.tiposOferecidos ?? []).filter(
        (o): o is typeof o & { valor: number } =>
          o.valor != null && infoDoTipo(o.tipoSessao)?.categoria === 'Individual',
      )
    : []

  /**
   * A seleção pode vir inválida pela URL (`/agendar/RodaConversa/{id}`), que ninguém navega
   * mas todo mundo consegue digitar. Sem esta checagem o botão seguiria para os horários com
   * um tipo que o servidor vai recusar lá na frente — exatamente o beco que este ajuste veio
   * fechar.
   */
  const selecaoValida = ofertas.some((o) => o.tipoSessao === tipoSelecionado)
  const semOfertaIndividual = Boolean(catalogo && dados && ofertas.length === 0)

  // Só o preço do que dá para marcar aqui. Com um tipo de grupo na URL, o cabeçalho
  // estampava o valor dele — um preço real, de um atendimento que esta tela não vende.
  const valor = selecaoValida
    ? (dados?.tiposOferecidos?.find((t) => t.tipoSessao === tipoSelecionado)?.valor ?? null)
    : null

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
        eyebrow="Perfil"
        title={dados?.nome ?? 'Profissional'}
        description={dados?.abordagem ?? undefined}
      />
      <PageContent width="md" className="pt-6">
        <Estado carregando={carregando} erro={erro} vazio={!dados} aoRepetir={recarregar}>
          {dados && (
            <div className="flex flex-col gap-5">
              <div className="rounded-card border border-plum/8 bg-white p-[18px] shadow-card">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mauve to-plum-mid shadow-[0_6px_16px_rgba(122,74,92,0.28)]">
                    {dados.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dados.foto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-xl text-cream">{iniciais(dados.nome)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-pill border border-mauve/[0.14] bg-mauve-ghost px-2.5 py-1 text-[11.5px] font-medium text-mauve">
                        CRP {dados.crp}
                      </span>
                      {dados.abordagem && (
                        <span className="rounded-pill bg-plum/[0.04] px-2.5 py-1 text-[11.5px] text-plum/55">
                          {dados.abordagem}
                        </span>
                      )}
                    </div>
                    {valor != null && (
                      <p className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-plum">
                        <CreditCardIcon size={14} className="text-plum/40" />
                        {reais(valor)} <span className="font-normal text-plum/45">por sessão</span>
                      </p>
                    )}
                  </div>
                </div>
                {dados.bio && (
                  <p className="mt-3.5 whitespace-pre-line border-t border-plum/8 pt-3.5 text-[13.5px] leading-relaxed text-plum/62">
                    {dados.bio}
                  </p>
                )}
              </div>

              {semOfertaIndividual && (
                <p className="rounded-card border border-plum/8 bg-white p-4 text-[13.5px] leading-relaxed text-plum/60 shadow-card">
                  Esta profissional não oferece atendimento individual no momento — só sessões
                  em grupo. Você pode procurá-las em <strong className="font-semibold text-plum">Agendar</strong>.
                </p>
              )}

              {ofertas.length > 0 && (
                <div>
                  <p className="text-eyebrow mb-2.5 text-mauve">Tipos de sessão oferecidos</p>
                  <p className="mb-2.5 -mt-1.5 text-[12px] text-plum/45">Toque para trocar o tipo de sessão.</p>
                  <div className="flex flex-col gap-2.5">
                    {ofertas
                      .map((oferta) => {
                        const selecionado = oferta.tipoSessao === tipoSelecionado
                        const Icone = iconeDoTipo(oferta.tipoSessao)
                        return (
                          <button
                            key={oferta.tipoSessao}
                            type="button"
                            onClick={() => setTipoSelecionado(oferta.tipoSessao)}
                            className={cn(
                              'flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-card transition-es active:scale-[0.99]',
                              selecionado
                                ? 'border-mauve/40 bg-mauve-ghost'
                                : 'border-plum/8 bg-white hover:border-mauve/25 hover:shadow-card-hover',
                            )}
                          >
                            <Icone size={18} className="shrink-0 text-mauve" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[14.5px] font-medium text-plum">{nomeDoTipo(oferta.tipoSessao)}</p>
                              <p className="mt-0.5 text-[12.5px] text-plum/55">{reais(oferta.valor)} por sessão</p>
                            </div>
                            {selecionado && <CheckIcon size={18} className="shrink-0 text-mauve" />}
                          </button>
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
            {/* Sem tipo individual válido não há o que marcar aqui: o caminho é voltar e
                escolher outra profissional (ou o fluxo de grupo). Deixar o botão ativo só
                adiaria a recusa para o fim do funil. */}
            {selecaoValida ? (
              <button
                type="button"
                onClick={() => router.push(`/agendar/${tipoSelecionado}/${profissionalId}/horarios`)}
                className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99]"
              >
                Ver horários
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/agendar')}
                className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border border-mauve/30 bg-white text-[15px] font-semibold text-mauve transition-es active:scale-[0.99]"
              >
                Escolher outro atendimento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
