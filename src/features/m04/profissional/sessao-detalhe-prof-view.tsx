'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BackButton, ESButton, PageHeader, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useCatalogoTipos } from '@/features/m04/api/use-catalogo'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { dataHoraPorExtenso, faixaHoraria, hora, reais } from '@/features/m04/lib/datas'
import { STATUS_LABEL, STATUS_TOM, CANCELADA_POR_TEXTO_PROF } from '@/features/m04/lib/sessao'
import { CancelarDialog } from '@/features/m04/ui/cancelar-dialog'
import { RegistrarDialog } from './registrar-dialog'
import type { components } from '@/features/m04/api/schema'

type Sessao = components['schemas']['Sessao']
type Participante = components['schemas']['Participante']

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

/** "28 de julho, 21:14" — usado só na linha do tempo (data curta, sem dia da semana). */
function dataHoraCurta(iso: string): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  return `${data}, ${hora(iso)}`
}

/**
 * P2 · Detalhe da sessão (lado da profissional). Tudo o que aparece é campo pronto:
 * `pendenteRegistro` habilita o registro, `podeCancelar` o cancelamento, `linkMeetStatus`
 * decide a sala. Nenhuma comparação de data no componente.
 *
 * O histórico de faltas (`noShowCount` / `exigePagamentoAntecipado`) aparece SÓ aqui e no
 * registro (D18) — nos dois momentos em que a profissional decide algo sobre a pessoa — e
 * nunca para a usuária. É contexto discreto ao lado do nome, não um rótulo que domina.
 */
export function SessaoDetalheProfView({ sessaoId }: { sessaoId: string }) {
  const { showToast } = useToast()
  const [registrando, setRegistrando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [marcando, setMarcando] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const { dados, carregando, erro, recarregar } = useRecurso<Sessao>(
    () => m04.GET('/sessoes/{sessaoId}', { params: { path: { sessaoId } } }),
    [sessaoId],
  )

  // Quem diz se o tipo é de grupo é o catálogo (`categoria`) — não um palpite sobre
  // `vagas`, que numa sessão individual pode vir 0 com `tituloGrupo` preenchido.
  const { catalogo } = useCatalogoTipos()
  const tipoInfo = dados ? catalogo?.tipos.find((t) => t.codigo === dados.tipo) : undefined
  const ehGrupo = tipoInfo?.categoria === 'Grupo'
  const ativos = (dados?.participantes ?? []).filter((p) => !p.saiuEm)
  const registrados = ativos.filter((p) => p.compareceu != null).length

  /** Presença de um participante (grupo). A resposta traz a sessão inteira — sem refetch. */
  const marcarPresenca = async (p: Participante, compareceu: boolean) => {
    if (marcando) return
    setMarcando(p.id)
    setErroAcao(null)
    try {
      const { error } = await m04.PATCH('/sessoes/{sessaoId}/participantes/{participanteId}', {
        params: { path: { sessaoId, participanteId: p.id } },
        body: { compareceu },
      })
      if (error) {
        setErroAcao(mensagemDe((error as { code?: string }).code))
        return
      }
      recarregar()
    } catch {
      setErroAcao(mensagemDe())
    } finally {
      setMarcando(null)
    }
  }

  return (
    <div>
      <BackButton href="/admin/agenda" label="Voltar para a agenda" />
      <PageHeader
        breadcrumb={[{ label: 'Minha agenda', href: '/admin/agenda' }, { label: 'Sessão' }]}
        title={(ehGrupo && dados?.tituloGrupo) || tipoInfo?.nome || 'Detalhe da sessão'}
        description={dados ? dataHoraPorExtenso(dados.dataHora) : undefined}
      />

      <Estado carregando={carregando} erro={erro} vazio={!dados} aoRepetir={recarregar}>
        {dados && (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              {/* Situação */}
              <section className={CARD}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-pill px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wider',
                      STATUS_TOM[dados.status],
                    )}
                  >
                    {STATUS_LABEL[dados.status]}
                  </span>
                  {dados.pendenteRegistro && (
                    <span className="rounded-pill bg-cream-mid px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wider text-plum">
                      Aguardando registro
                    </span>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-plum/7">
                  <MetricaMini rotulo="Horário" valor={faixaHoraria(dados.dataHora, dados.dataHoraFim)} />
                  <MetricaMini rotulo="Duração" valor={`${dados.duracaoMinutos} minutos`} />
                  {reais(dados.valorPraticado) && (
                    <MetricaMini rotulo="Valor" valor={`${reais(dados.valorPraticado)}${ehGrupo ? '/pessoa' : ''}`} />
                  )}
                </div>
              </section>

              {/* Linha do tempo — só eventos reais (criadaEm sempre; canceladaEm quando houver).
                  Nada de "sala criada"/"lembrete enviado": não existe campo por trás disso. */}
              <section className={CARD}>
                <h2 className="mb-5 font-display text-lg text-plum">Linha do tempo</h2>
                <div className="flex flex-col">
                  {[
                    { titulo: 'Sessão marcada', quando: dados.criadaEm, cor: 'var(--color-mauve)' },
                    ...(dados.status === 'Cancelada' && dados.canceladaEm
                      ? [{ titulo: 'Sessão cancelada', quando: dados.canceladaEm, cor: 'var(--color-red-alert)' }]
                      : []),
                  ].map((t, i, arr) => (
                    <div key={t.titulo} className="flex gap-[18px]">
                      <span className="flex shrink-0 flex-col items-center">
                        <span className="mt-[5px] h-[11px] w-[11px] rounded-pill" style={{ background: t.cor }} />
                        {i < arr.length - 1 && <span className="w-px flex-1 bg-plum/10" />}
                      </span>
                      <div className={i < arr.length - 1 ? 'pb-5' : ''}>
                        <p className="text-[14.5px] font-medium text-plum">{t.titulo}</p>
                        <p className="mt-1 text-[12.5px] text-plum/50">{dataHoraCurta(t.quando)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Participantes — com o histórico de faltas (só a profissional vê). */}
              {dados.participantes.length > 0 && (
                <section className={CARD}>
                  <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg text-plum">
                      {ehGrupo ? 'Participantes' : 'Quem marcou'}
                    </h3>
                    {ehGrupo && dados.pendenteRegistro && (
                      <span className="text-[13px] text-plum/50">
                        {registrados} de {ativos.length} registradas
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {dados.participantes.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-plum/8 bg-cream/30 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <span className="text-[14.5px] text-plum">{p.usuaria.nome}</span>
                          {p.saiuEm && <span className="ml-2 text-[12px] text-plum/45">Desistiu</span>}
                          {p.usuaria.exigePagamentoAntecipado && (
                            <span className="ml-2 rounded-pill bg-red-alert/10 px-2 py-0.5 text-[11px] font-medium text-red-alert">
                              Já faltou sem avisar
                            </span>
                          )}
                        </div>
                        {ehGrupo && dados.pendenteRegistro && !p.saiuEm && (
                          <div className="flex gap-1.5">
                            <BotaoPresenca
                              ativo={p.compareceu === true}
                              onClick={() => marcarPresenca(p, true)}
                              disabled={marcando === p.id}
                              tom="ok"
                            >
                              Presente
                            </BotaoPresenca>
                            <BotaoPresenca
                              ativo={p.compareceu === false}
                              onClick={() => marcarPresenca(p, false)}
                              disabled={marcando === p.id}
                              tom="falta"
                            >
                              Ausente
                            </BotaoPresenca>
                          </div>
                        )}
                        {!ehGrupo && p.compareceu != null && (
                          <span className={cn('text-[13px] font-medium', p.compareceu ? 'text-success-dark' : 'text-red-alert')}>
                            {p.compareceu ? 'Compareceu' : 'Não compareceu'}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {ehGrupo && (
                    <p className="mt-3 text-xs leading-relaxed text-plum/45">
                      O histórico de faltas é visível apenas para você — a usuária não vê essa
                      informação.
                    </p>
                  )}
                </section>
              )}

              {/* Cancelamento */}
              {dados.status === 'Cancelada' && dados.canceladaPor && (
                <section className="rounded-card border border-mauve/[0.16] bg-mauve-ghost p-6">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mauve">
                    {CANCELADA_POR_TEXTO_PROF[dados.canceladaPor]}
                  </p>
                  {dados.motivoCancelamento && (
                    <p className="mt-3 font-display text-lg italic leading-relaxed text-plum">“{dados.motivoCancelamento}”</p>
                  )}
                </section>
              )}

              {erroAcao && (
                <p className="rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
                  {erroAcao}
                </p>
              )}
            </div>

            {/* Sala + ações */}
            <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:shrink-0">
              <section className={CARD}>
                <h3 className="font-display text-base text-plum">Sala de vídeo</h3>
                {dados.linkMeetStatus === 'Disponivel' && dados.linkMeet ? (
                  <a
                    href={dados.linkMeet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 flex h-[44px] items-center justify-center rounded-full bg-mauve text-[14.5px] font-semibold text-cream"
                  >
                    Entrar na sala
                  </a>
                ) : dados.linkMeetStatus === 'Agendado' && dados.linkMeetDisponivelEm ? (
                  <p className="mt-1.5 text-[13px] text-plum/55">
                    A sala abre às {hora(dados.linkMeetDisponivelEm)}.
                  </p>
                ) : dados.linkMeetStatus === 'Falhou' ? (
                  <>
                    <p className="mt-1.5 text-[13px] text-red-alert">
                      Não conseguimos criar a sala automaticamente.
                    </p>
                    <Link
                      href={`/admin/agenda/${sessaoId}/sala`}
                      className="mt-2.5 flex h-[44px] items-center justify-center rounded-full border border-mauve/30 bg-white text-[14.5px] font-semibold text-mauve"
                    >
                      Adicionar link
                    </Link>
                  </>
                ) : (
                  <p className="mt-1.5 text-[13px] text-plum/45">Sem sala para esta sessão.</p>
                )}
              </section>

              {(dados.pendenteRegistro || dados.podeCancelar) && (
                <section className={CARD}>
                  <h3 className="font-display text-base text-plum">Ações</h3>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {dados.pendenteRegistro && (
                      <ESButton variant="primary" onPress={() => setRegistrando(true)}>
                        Registrar sessão
                      </ESButton>
                    )}
                    {/* PF7 — a profissional cancela a qualquer momento enquanto a sessão
                        está ativa, inclusive depois do horário e ainda sem registro. Quem
                        decide é `podeCancelar`; as duas ações convivem (D16). */}
                    {dados.podeCancelar && (
                      <ESButton variant="secondary" onPress={() => setCancelando(true)}>
                        Cancelar sessão
                      </ESButton>
                    )}
                  </div>
                  {dados.pendenteRegistro && (
                    <p className="mt-2.5 text-xs leading-relaxed text-plum/45">
                      O registro é definitivo. É ele que confirma o atendimento.
                    </p>
                  )}
                </section>
              )}

              <div className="rounded-card border border-plum/6 bg-cream p-5">
                <p className="text-[13px] leading-relaxed text-plum/62">
                  Sessões já marcadas guardam o valor da época. Alterar seus valores vale só para as
                  próximas.
                </p>
              </div>
            </aside>
          </div>
        )}
      </Estado>

      {registrando && dados && (
        <RegistrarDialog
          sessao={dados}
          ehGrupo={ehGrupo}
          presencasPendentes={ativos.length - registrados}
          onFechar={() => setRegistrando(false)}
          onRegistrada={() => {
            setRegistrando(false)
            showToast('Sessão registrada.', 'success')
            recarregar()
          }}
        />
      )}

      {cancelando && dados && (
        <CancelarDialog
          perfil="profissional"
          sessao={dados}
          onFechar={() => setCancelando(false)}
          onCancelada={() => {
            // PF7 — profissional cancela sem cobrança; `cobrancaAplicada` só se aplica à usuária.
            setCancelando(false)
            showToast('Sessão cancelada.', 'success')
            recarregar()
          }}
        />
      )}
    </div>
  )
}

function MetricaMini({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-plum/40">{rotulo}</p>
      <p className="mt-2 font-display text-xl leading-none text-plum">{valor}</p>
    </div>
  )
}

function BotaoPresenca({
  ativo,
  tom,
  disabled,
  onClick,
  children,
}: {
  ativo: boolean
  tom: 'ok' | 'falta'
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-pill border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50',
        ativo
          ? tom === 'ok'
            ? 'border-success-dark bg-success-dark text-white'
            : 'border-red-alert bg-red-alert text-white'
          : 'border-plum/15 bg-white text-plum/65 hover:border-plum/30',
      )}
    >
      {children}
    </button>
  )
}
