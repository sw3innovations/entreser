'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { dataHoraPorExtenso, faixaHoraria, hora, reais } from '@/features/m04/lib/datas'
import { STATUS_LABEL, STATUS_TOM, CANCELADA_POR_TEXTO } from '@/features/m04/lib/sessao'
import { CancelarDialog } from './cancelar-dialog'
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

/**
 * U10 · Detalhe da sessão — a tela central pós-agendamento. Tudo o que aparece é campo
 * pronto do backend: o selo vem de `status`, a sala de `linkMeetStatus` (4 estados) e as
 * ações de `podeCancelar`/`podeReagendar`. Nenhuma comparação de data no componente —
 * quando a regra das 24h mudar, esta tela não muda.
 */
export function SessaoDetalheView({ sessaoId }: { sessaoId: string }) {
  const router = useRouter()
  const voltar = useVoltar('/sessoes')
  const [cancelando, setCancelando] = useState(false)
  const { dados, carregando, erro, recarregar } = useRecurso<Sessao>(
    () => m04.GET('/sessoes/{sessaoId}', { params: { path: { sessaoId } } }),
    [sessaoId],
  )
  // Nome e categoria do tipo vêm do catálogo (nunca escritos na tela).
  const { dados: catalogo } = useRecurso(() => m04.GET('/tipos-sessao'), [])
  const tipoInfo = dados ? catalogo?.tipos.find((t) => t.codigo === dados.tipo) : undefined
  const ehGrupo = tipoInfo?.categoria === 'Grupo'

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
        eyebrow={dados ? dados.profissional.nome : 'Sessão'}
        title={dados ? tituloDaSessao(dados, ehGrupo, tipoInfo?.nome) : 'Sua sessão'}
        description={dados ? dataHoraPorExtenso(dados.dataHora) : undefined}
      />

      <PageContent width="md" className="pt-6">
        <Estado carregando={carregando} erro={erro} vazio={!dados} aoRepetir={recarregar}>
          {dados && (
            <div className="flex flex-col gap-5">
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
                  <Linha rotulo="Horário" valor={faixaHoraria(dados.dataHora, dados.dataHoraFim)} />
                  <Linha rotulo="Duração" valor={`${dados.duracaoMinutos} minutos`} />
                  <Linha rotulo="Valor" valor={reais(dados.valorPraticado)} />
                </dl>
              </div>

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
                    <p className="mt-1.5 text-[13px] italic text-plum/50">“{dados.motivoCancelamento}”</p>
                  )}
                </div>
              )}
            </div>
          )}
        </Estado>
      </PageContent>

      {/* Ações — só aparecem quando o backend diz que podem (UF8/UF9). */}
      {dados && (dados.podeCancelar || dados.podeReagendar) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/[0.06] bg-[rgba(255,253,250,0.9)] shadow-[0_-6px_24px_rgba(45,24,64,0.08)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-[11px] px-[18px] pb-[18px] pt-[14px]">
            {dados.podeCancelar && (
              <button
                type="button"
                onClick={() => setCancelando(true)}
                className="h-[50px] flex-1 rounded-full border border-mauve/30 bg-white text-[15px] font-semibold text-mauve transition-es active:scale-[0.99]"
              >
                Cancelar sessão
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

      {/* U11 · cancelar (overlay). O backend devolve a sessão já cancelada — recarregamos
          para a tela refletir o novo status sem inventar estado local. */}
      {cancelando && dados && (
        <CancelarDialog
          sessao={dados}
          onFechar={() => setCancelando(false)}
          onCancelada={() => {
            setCancelando(false)
            recarregar()
          }}
        />
      )}
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-plum/50">{rotulo}</dt>
      <dd className="text-[14.5px] font-medium text-plum">{valor}</dd>
    </div>
  )
}
