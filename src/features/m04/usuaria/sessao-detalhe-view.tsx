'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHero,
  PageContent,
  HeroIconButton,
  ArrowLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  UsersIcon,
  CalendarPlusIcon,
} from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/context/auth-context'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useCatalogoTipos } from '@/features/m04/api/use-catalogo'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { dataHoraPorExtenso, faixaHoraria, hora, reais, quandoAcontece } from '@/features/m04/lib/datas'
import { STATUS_LABEL, STATUS_TOM, CANCELADA_POR_TEXTO } from '@/features/m04/lib/sessao'
import { CancelarDialog } from '@/features/m04/ui/cancelar-dialog'
import type { components } from '@/features/m04/api/schema'

type Sessao = components['schemas']['Sessao']

/**
 * Título da tela: o tema, quando é sessão de grupo; senão o nome do tipo. Quem diz se o
 * tipo é de grupo é o catálogo (`categoria`), nunca um palpite sobre `vagas` — numa
 * sessão individual o backend ainda pode devolver `vagas: 0` e `tituloGrupo` preenchido.
 */
function tituloDaSessao(s: Sessao, ehGrupo: boolean, nomeDoTipo?: string): string {
  return ehGrupo && s.tituloGrupo?.trim() ? s.tituloGrupo : (nomeDoTipo ?? 'Sua sessão')
}

function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

/**
 * Já desisti desta sessão de grupo? `saiuEm` é o marcador oficial da desistência (soft
 * delete, D7) e vem no próprio payload — não dá para inferir de `vagasDisponiveis`, que
 * volta ao total quando a última pessoa sai e ficaria igual a uma sessão nunca cheia.
 *
 * **Não decide mais se a ação aparece** — isso é `podeCancelar`, e o backend passou a
 * devolvê-lo `false` para quem saiu. Serve só para saber o PORQUÊ de não haver ação, que
 * `podeCancelar: false` sozinho não distingue: uma sessão também fica sem ação quando é
 * tarde demais para cancelar, e aí "Agendar novamente" seria uma resposta errada.
 */
function jaSaiuDoGrupo(s: Sessao, usuariaId?: string): boolean {
  if (!usuariaId) return false
  return s.participantes.some((p) => p.usuaria.id === usuariaId && p.saiuEm != null)
}

/**
 * U10 · Detalhe da sessão — a tela central pós-agendamento. Tudo o que aparece é campo
 * pronto do backend: o selo vem de `status`, a sala de `linkMeetStatus` (4 estados) e as
 * ações de `podeCancelar`/`podeReagendar`. Nenhuma comparação de data no componente —
 * quando a regra das 24h mudar, esta tela não muda.
 */
export function SessaoDetalheView({
  sessaoId,
  vindaDaConfirmacao = false,
}: {
  sessaoId: string
  /** Chegou aqui pela tela de sucesso (#4/#5) — o back() do histórico levaria de volta
   * para lá (ou para o formulário de confirmação, ambos já resolvidos e sem sentido de
   * revisitar), então "Voltar" vai direto para a lista em vez de seguir o histórico. */
  vindaDaConfirmacao?: boolean
}) {
  const router = useRouter()
  const voltarHistorico = useVoltar('/sessoes')
  const voltar = vindaDaConfirmacao ? () => router.push('/sessoes') : voltarHistorico
  const { showToast } = useToast()
  const { user } = useAuth()
  const [cancelando, setCancelando] = useState(false)
  const [cancelandoConvite, setCancelandoConvite] = useState(false)
  const [erroConvite, setErroConvite] = useState<string | null>(null)
  const [avisoCobranca, setAvisoCobranca] = useState(false)
  const { dados, carregando, erro, recarregar } = useRecurso<Sessao>(
    () => m04.GET('/sessoes/{sessaoId}', { params: { path: { sessaoId } } }),
    [sessaoId],
  )

  const cancelarConvite = async () => {
    if (cancelandoConvite) return
    setCancelandoConvite(true)
    setErroConvite(null)
    try {
      const { error } = await m04.DELETE('/sessoes/{sessaoId}/convite', {
        params: { path: { sessaoId } },
      })
      if (error) {
        setErroConvite(mensagemDe((error as { code?: string }).code))
        return
      }
      recarregar()
    } catch {
      setErroConvite(mensagemDe())
    } finally {
      setCancelandoConvite(false)
    }
  }
  // Nome e categoria do tipo vêm do catálogo (nunca escritos na tela).
  const { catalogo } = useCatalogoTipos()
  const tipoInfo = dados ? catalogo?.tipos.find((t) => t.codigo === dados.tipo) : undefined
  const ehGrupo = tipoInfo?.categoria === 'Grupo'
  const saiuDoGrupo = !!dados && ehGrupo && jaSaiuDoGrupo(dados, user?.id)

  /**
   * Sair do grupo NÃO cancela a sessão — ela continua de pé para as outras inscritas, em
   * `Agendada`. Recarregar aqui repintaria uma tela idêntica ("Agendada", mesmo botão), e
   * é exatamente isso que fazia parecer que o cancelamento não tinha acontecido. Como a
   * sessão deixou de ser sua, a saída certa é voltar para a lista com o aviso.
   */
  const aoSairDoGrupo = (cobrancaAplicada: boolean) => {
    setCancelando(false)
    showToast(
      cobrancaAplicada
        ? 'Inscrição cancelada. A cobrança se aplica, conforme informado.'
        : 'Inscrição cancelada. Sua vaga ficou livre para outra pessoa.',
      'success',
    )
    router.replace('/sessoes')
  }

  const topBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  const emAndamento = dados && (dados.status === 'Agendada' || dados.status === 'Confirmada')
  const diasParaComecar = dados ? quandoAcontece(dados.dataHora) : null

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        topBar={topBar}
        topBarClassName="lg:hidden"
        eyebrow={dados ? dados.profissional.nome : 'Sessão'}
        title={dados ? tituloDaSessao(dados, ehGrupo, tipoInfo?.nome) : 'Sua sessão'}
        description={dados ? dataHoraPorExtenso(dados.dataHora) : undefined}
      >
        {emAndamento && diasParaComecar && (
          /* `self-start`: no desktop o PlumHero envolve os filhos num flex column, e o
             `align-items: stretch` padrão esticaria a pill de ponta a ponta. */
          <div className="mt-3.5 inline-flex self-start items-center gap-2 rounded-pill border border-white/[0.16] bg-white/10 px-3.5 py-1.5">
            <ClockIcon size={14} className="text-cream/80" />
            <span className="text-xs text-cream/80">
              Começa <strong className="font-semibold text-cream">{diasParaComecar}</strong>
            </span>
          </div>
        )}
      </PageHero>

      <PageContent width="md" className="pt-6">
        <Estado carregando={carregando} erro={erro} vazio={!dados} aoRepetir={recarregar}>
          {dados && (
            <div className="flex flex-col gap-5">
              {avisoCobranca && (
                <p className="rounded-card border border-plum/8 bg-white p-4 text-[13.5px] text-plum/60 shadow-card">
                  Cancelamento com custo, conforme informado.
                </p>
              )}

              {/* Abrir esta sessão depois de ter saído (link antigo, histórico) precisa
                  dizer o porquê de não haver mais ação — senão a tela parece só "Agendada"
                  e a saída some sem explicação. */}
              {saiuDoGrupo && (
                <p className="rounded-card border border-plum/8 bg-white p-4 text-[13.5px] text-plum/60 shadow-card">
                  Você cancelou sua inscrição nesta sessão. O encontro segue acontecendo
                  para as outras participantes.
                </p>
              )}

              {/* Situação + dados da sessão */}
              <div className="rounded-card border border-plum/8 bg-white p-5 shadow-card">
                <span
                  className={cn(
                    'inline-flex rounded-pill px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wider',
                    STATUS_TOM[dados.status],
                  )}
                >
                  {STATUS_LABEL[dados.status]}
                </span>
                <dl className="mt-4 flex flex-col gap-3">
                  <Linha icone={<ClockIcon size={14} />} rotulo="Horário" valor={faixaHoraria(dados.dataHora, dados.dataHoraFim)} />
                  <Linha icone={<ClockIcon size={14} />} rotulo="Duração" valor={`${dados.duracaoMinutos} minutos`} />
                  {reais(dados.valorPraticado) && (
                    <Linha icone={<CreditCardIcon size={14} />} rotulo="Valor" valor={reais(dados.valorPraticado)!} />
                  )}
                  {ehGrupo && dados.vagas != null && dados.vagasDisponiveis != null && (
                    <Linha
                      icone={<UsersIcon size={14} />}
                      rotulo="Vagas"
                      valor={`${dados.vagasDisponiveis} de ${dados.vagas} restantes`}
                    />
                  )}
                </dl>
              </div>

              {/* Profissional — atalho para o perfil completo (mesma tela do funil de
                  marcação, U3), reaproveitando id + tipo já presentes na sessão. */}
              <div className="rounded-card border border-plum/8 bg-white p-[18px] shadow-card">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mauve to-plum-mid shadow-[0_6px_16px_rgba(122,74,92,0.28)]">
                    {dados.profissional.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dados.profissional.foto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-lg text-cream">{iniciais(dados.profissional.nome)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-plum">{dados.profissional.nome}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-pill border border-mauve/[0.14] bg-mauve-ghost px-2 py-0.5 text-[11px] font-medium text-mauve">
                        CRP {dados.profissional.crp}
                      </span>
                      {dados.profissional.abordagem && (
                        <span className="rounded-pill bg-plum/[0.04] px-2 py-0.5 text-[11px] text-plum/55">
                          {dados.profissional.abordagem}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/agendar/${dados.tipo}/${dados.profissional.id}`)}
                  className="mt-3.5 flex w-full items-center justify-between rounded-input border border-plum/8 bg-plum/[0.02] px-3.5 py-2.5 text-left transition-es hover:border-mauve/25"
                >
                  <span className="text-[13.5px] font-medium text-mauve">Ver perfil completo</span>
                  <ChevronRightIcon size={16} className="text-mauve/60" />
                </button>
              </div>

              {/* "No dia" — sequência sala abre / sessão começa / encerramento, só para sessões
                  ainda por acontecer. Cada ponto usa campo que já veio do backend; nenhuma conta
                  de data nova além do "sala abre" (linkMeetDisponivelEm), que já existia. */}
              {emAndamento && (
                <div className="rounded-card border border-plum/8 bg-white p-5 shadow-card">
                  <p className="text-eyebrow mb-4 text-mauve">No dia</p>
                  <TimelineDoDia dados={dados} />
                </div>
              )}

              {/* Convite de casal pendente (U10) — a única operação do contrato que
                  cancela um convite ainda não aceito. */}
              {dados.convitePendente && dados.convitePendente.status === 'Pendente' && (
                <div className="rounded-card border border-plum/8 bg-white p-4 shadow-card">
                  <p className="text-[13.5px] text-plum/70">
                    Convite enviado para {dados.convitePendente.emailMascarado}, aguardando aceite.
                  </p>
                  {erroConvite && (
                    <p className="mt-2 text-[13px] font-medium text-red-alert">{erroConvite}</p>
                  )}
                  <button
                    type="button"
                    onClick={cancelarConvite}
                    disabled={cancelandoConvite}
                    className="mt-3 h-[42px] rounded-full border border-mauve/30 bg-white px-4 text-[13.5px] font-semibold text-mauve transition-es disabled:opacity-60"
                  >
                    {cancelandoConvite ? 'Cancelando…' : 'Cancelar convite'}
                  </button>
                </div>
              )}

              {/* Sala — o backend decide a visibilidade do link (D14); a tela só exibe. */}
              {dados.linkMeetStatus === 'Disponivel' && dados.linkMeet && (
                <a
                  href={dados.linkMeet}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-card bg-mauve px-5 py-4 text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99]"
                >
                  Entrar na sala
                </a>
              )}
              {dados.linkMeetStatus === 'Agendado' && dados.linkMeetDisponivelEm && (
                <p className="rounded-card border border-plum/8 bg-white p-4 text-[13.5px] text-plum/60 shadow-card">
                  A sala abre às {hora(dados.linkMeetDisponivelEm)}.
                </p>
              )}
              {dados.linkMeetStatus === 'Falhou' && (
                <p className="rounded-card border border-red-alert/25 bg-red-alert/[0.06] p-4 text-[13.5px] text-red-alert">
                  Tivemos um problema para criar a sala. A profissional já foi avisada.
                </p>
              )}

              {/* Cancelamento — o texto depende de quem cancelou. */}
              {dados.status === 'Cancelada' && dados.canceladaPor && (
                <div className="rounded-card border border-plum/8 bg-white p-4 shadow-card">
                  <p className="text-[13.5px] text-plum/70">{CANCELADA_POR_TEXTO[dados.canceladaPor]}</p>
                  {dados.motivoCancelamento && (
                    <p className="mt-1.5 whitespace-pre-line text-[13px] italic text-plum/50 [overflow-wrap:anywhere]">
                      “{dados.motivoCancelamento}”
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Estado>
      </PageContent>

      {/* Ações — quem decide é o backend (UF8/UF9), ponto. Havia aqui um `!saiuDoGrupo`
          extra, de quando `podeCancelar` vinha `true` mesmo para quem já tinha saído e o
          clique batia em `NAO_INSCRITA`; hoje ele vem `false`, e manter o veto seria uma
          regra de permissão vivendo na tela, contra o princípio desta view. */}
      {dados && (dados.podeCancelar || dados.podeReagendar) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/[0.06] bg-[rgba(255,253,250,0.9)] shadow-[0_-6px_24px_rgba(45,24,64,0.08)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-[11px] px-[18px] pb-[18px] pt-[14px]">
            {/* Em grupo a saída é DESISTIR da própria inscrição — cancelar encerraria o
                encontro para todas as inscritas. Quem diz se é grupo é a `categoria` do
                catálogo, não um palpite sobre `vagas`. */}
            {dados.podeCancelar && (
              <button
                type="button"
                onClick={() => setCancelando(true)}
                className="h-[50px] flex-1 rounded-full border border-mauve/30 bg-white text-[15px] font-semibold text-mauve transition-es active:scale-[0.99]"
              >
                {ehGrupo ? 'Cancelar minha inscrição' : 'Cancelar sessão'}
              </button>
            )}
            {dados.podeReagendar && (
              <button
                type="button"
                onClick={() => router.push(`/sessoes/${sessaoId}/reagendar`)}
                className="h-[50px] flex-1 rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99]"
              >
                Reagendar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sem mais ação possível — sessão cancelada, ou grupo do qual já saí: convite para
          marcar de novo, direto no mesmo tipo de sessão.

          Aqui o `saiuDoGrupo` continua sendo necessário, e não é duplicação: `podeCancelar:
          false` não diz o motivo, e uma sessão perto demais de começar também o tem sem que
          "Agendar novamente" faça sentido. É o único uso que sobrou. */}
      {dados &&
        (saiuDoGrupo ||
          (dados.status === 'Cancelada' && !dados.podeCancelar && !dados.podeReagendar)) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/[0.06] bg-[rgba(255,253,250,0.9)] shadow-[0_-6px_24px_rgba(45,24,64,0.08)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl px-[18px] pb-[18px] pt-[14px]">
            <button
              type="button"
              onClick={() => router.push(ehGrupo ? `/agendar/grupo/${dados.tipo}` : `/agendar/${dados.tipo}`)}
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99]"
            >
              <CalendarPlusIcon size={17} />
              Agendar novamente
            </button>
          </div>
        </div>
      )}

      {/* U11 · cancelar (overlay). Cancelar a sessão muda o status dela, então recarregar
          mostra o novo estado na própria tela. Sair do grupo não muda nada aqui (a sessão
          segue de pé para as outras) — nesse caso a tela deixa de ser sua, então saímos. */}
      {cancelando && dados && (
        <CancelarDialog
          sessao={dados}
          acao={ehGrupo ? 'sairDoGrupo' : 'cancelarSessao'}
          onFechar={() => setCancelando(false)}
          onJaSaiu={() => aoSairDoGrupo(false)}
          onCancelada={(_s, cobrancaAplicada) => {
            if (ehGrupo) {
              aoSairDoGrupo(cobrancaAplicada)
              return
            }
            setCancelando(false)
            setAvisoCobranca(cobrancaAplicada)
            recarregar()
          }}
        />
      )}
    </div>
  )
}

function Linha({ icone, rotulo, valor }: { icone?: ReactNode; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-[13px] text-plum/50">
        {icone && <span className="text-plum/40">{icone}</span>}
        {rotulo}
      </dt>
      <dd className="text-[14.5px] font-medium text-plum">{valor}</dd>
    </div>
  )
}

/**
 * "No dia" — sequência sala abre / sessão começa / encerramento. O primeiro ponto só
 * aparece quando há `linkMeetDisponivelEm` (mesmo campo que já controla o aviso "A sala
 * abre às…" acima); sem ele, a timeline começa direto em "a sessão começa".
 */
function TimelineDoDia({ dados }: { dados: Sessao }) {
  const pontos = [
    dados.linkMeetDisponivelEm && {
      hora: hora(dados.linkMeetDisponivelEm),
      titulo: 'a sala abre',
      nota: 'O link aparece aqui 30 minutos antes.',
    },
    {
      hora: hora(dados.dataHora),
      titulo: 'a sessão começa',
      nota: `Com ${dados.profissional.nome}, por vídeo.`,
    },
    { hora: hora(dados.dataHoraFim), titulo: 'encerramento', nota: null },
  ].filter((p): p is { hora: string; titulo: string; nota: string | null } => Boolean(p))

  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center pt-1">
        {pontos.map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <span
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                i === pontos.length - 1 ? 'border-2 border-plum/18' : 'bg-mauve',
              )}
            />
            {i < pontos.length - 1 && <span className="my-1 min-h-[22px] w-px flex-1 bg-plum/[0.12]" />}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-[19px]">
        {pontos.map((p, i) => (
          <div key={i}>
            <p className={cn('text-sm font-semibold', i === pontos.length - 1 ? 'text-plum/55' : 'text-plum')}>
              {p.hora} · {p.titulo}
            </p>
            {p.nota && <p className="mt-0.5 text-xs text-plum/50">{p.nota}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
