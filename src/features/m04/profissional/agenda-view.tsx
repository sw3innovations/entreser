'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EmptyState, ESButton, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { VerMais } from '@/features/m04/ui/ver-mais'
import { chaveDoDia, diaPorExtenso, hora, emDiasISO } from '@/features/m04/lib/datas'
import { STATUS_LABEL, STATUS_TOM } from '@/features/m04/lib/sessao'
import type { components } from '@/features/m04/api/schema'

type SessaoResumo = components['schemas']['SessaoResumo']
type StatusSessao = components['schemas']['StatusSessao']

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

/** Filtro de pendência — sempre resolvido NO SERVIDOR (D15). */
type Pendencia = 'todas' | 'registro' | 'sala'

/**
 * Filtro de status — seleção única de "chip", igual ao padrão já usado em
 * `usuaria/minhas-sessoes-view.tsx`. "Agendadas" cobre `Agendada` e `Confirmada` (D8: o
 * mesmo estado visual).
 */
const FILTROS_STATUS: { chave: string; label: string; status?: StatusSessao[] }[] = [
  { chave: 'todos', label: 'Todos os status' },
  { chave: 'agendadas', label: 'Agendadas', status: ['Agendada', 'Confirmada'] },
  { chave: 'realizadas', label: 'Realizadas', status: ['Realizada'] },
  { chave: 'canceladas', label: 'Canceladas', status: ['Cancelada'] },
  { chave: 'nao-compareceu', label: 'Não compareceu', status: ['NaoCompareceu'] },
]

/**
 * Janela default da agenda (D23): 14 dias atrás até 30 à frente. As sessões que aguardam
 * registro estão no PASSADO — uma janela que começasse hoje esconderia justamente as
 * pendências que o painel existe para mostrar.
 */
function janela() {
  return { de: `${emDiasISO(-14)}T00:00:00Z`, ate: `${emDiasISO(30)}T23:59:59Z` }
}

/** Agrupa por dia no fuso local (a agenda é lida como "o meu dia", não como UTC). */
function porDia(itens: SessaoResumo[]) {
  const mapa = new Map<string, SessaoResumo[]>()
  for (const s of itens) {
    const k = chaveDoDia(s.dataHora)
    const atual = mapa.get(k)
    if (atual) atual.push(s)
    else mapa.set(k, [s])
  }
  return [...mapa.entries()].map(([chave, sessoes]) => ({ chave, sessoes }))
}

/**
 * P1 · Minha agenda — o hub do painel. Duas pendências no topo, com contagens vindas dos
 * TOTAIS DO ENVELOPE (`totalPendenteRegistro`, `totalLinkMeetFalhou`), calculados sobre o
 * período inteiro: contar a página funcionaria só na primeira e mentiria em todas as
 * outras, e uma pendência na página 3 ficaria invisível — o pior modo de falha do painel.
 *
 * Clicar numa pendência FILTRA no servidor (D15). Os totais não mudam com o filtro, para o
 * destaque continuar dizendo quantas existem.
 */
export function AgendaView() {
  const [pendencia, setPendencia] = useState<Pendencia>('todas')
  const [filtroStatus, setFiltroStatus] = useState(FILTROS_STATUS[0])
  const [filtroTipo, setFiltroTipo] = useState<SessaoResumo['tipo'] | 'todos'>('todos')
  const [pagina, setPagina] = useState(0)
  const [acumulado, setAcumulado] = useState<SessaoResumo[]>([])

  // Nome do tipo vem do catálogo — nada de rótulo escrito na tela.
  const { dados: catalogo } = useRecurso(() => m04.GET('/tipos-sessao'), [])
  const nomeDoTipo = (codigo: SessaoResumo['tipo']) =>
    catalogo?.tipos.find((t) => t.codigo === codigo)?.nome ?? codigo

  const { de, ate } = janela()
  const { dados, carregando, erro, recarregar } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de,
            ate,
            page: pagina,
            size: 20,
            ...(pendencia === 'registro' ? { pendenteRegistro: true } : {}),
            ...(pendencia === 'sala' ? { linkMeetStatus: ['Falhou' as const] } : {}),
            ...(filtroStatus.status ? { status: filtroStatus.status } : {}),
            ...(filtroTipo !== 'todos' ? { tipo: [filtroTipo] } : {}),
          },
        },
      }),
    [pendencia, filtroStatus.chave, filtroTipo, pagina],
  )

  // Página 0 substitui; as seguintes acumulam (mesma ideia do "Ver mais" das listas).
  const itens = pagina === 0 ? (dados?.content ?? []) : [...acumulado, ...(dados?.content ?? [])]
  const dias = porDia(itens)
  const vazio = !carregando && !erro && itens.length === 0
  const temMais = dados ? pagina + 1 < dados.totalPages : false

  const trocarFiltro = (p: Pendencia) => {
    setPendencia(p)
    setPagina(0)
    setAcumulado([])
  }

  const trocarStatus = (f: (typeof FILTROS_STATUS)[number]) => {
    setFiltroStatus(f)
    setPagina(0)
    setAcumulado([])
  }

  const trocarTipo = (tipo: SessaoResumo['tipo'] | 'todos') => {
    setFiltroTipo(tipo)
    setPagina(0)
    setAcumulado([])
  }

  const verMais = () => {
    setAcumulado(itens)
    setPagina((p) => p + 1)
  }

  return (
    <div>
      <PageHeader
        title="Minha agenda"
        description="Suas sessões dos últimos 14 dias e dos próximos 30."
        action={
          <Link
            href="/admin/agenda/novo-grupo"
            className="inline-flex h-[42px] items-center rounded-full bg-mauve px-5 text-[14px] font-semibold text-cream shadow-[0_8px_20px_rgba(122,74,92,0.28)] transition-es hover:bg-mauve-dark"
          >
            Criar sessão de grupo
          </Link>
        }
      />

      {/* Pendências — contagens dos totais do envelope, nunca de content.length. */}
      {dados && (dados.totalPendenteRegistro > 0 || dados.totalLinkMeetFalhou > 0) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {dados.totalPendenteRegistro > 0 && (
            <Pendente
              tom="mauve"
              ativo={pendencia === 'registro'}
              titulo={`${dados.totalPendenteRegistro} ${dados.totalPendenteRegistro === 1 ? 'sessão aguardando registro' : 'sessões aguardando registro'}`}
              descricao="Elas já aconteceram e precisam do seu registro."
              onClick={() => trocarFiltro(pendencia === 'registro' ? 'todas' : 'registro')}
            />
          )}
          {dados.totalLinkMeetFalhou > 0 && (
            <Pendente
              tom="alerta"
              ativo={pendencia === 'sala'}
              titulo={`${dados.totalLinkMeetFalhou} ${dados.totalLinkMeetFalhou === 1 ? 'sala precisa' : 'salas precisam'} de link manual`}
              descricao="Não conseguimos criar a sala automaticamente."
              onClick={() => trocarFiltro(pendencia === 'sala' ? 'todas' : 'sala')}
            />
          )}
        </div>
      )}

      {pendencia !== 'todas' && (
        <button
          type="button"
          onClick={() => trocarFiltro('todas')}
          className="mb-4 text-[13px] font-medium text-mauve hover:text-mauve-dark"
        >
          ← Ver todas as sessões
        </button>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS_STATUS.map((f) => (
            <button
              key={f.chave}
              type="button"
              onClick={() => trocarStatus(f)}
              className={cn(
                'rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors',
                f.chave === filtroStatus.chave
                  ? 'border-mauve bg-mauve text-white'
                  : 'border-plum/12 bg-white text-plum/70 hover:border-plum/25',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={filtroTipo}
          onChange={(e) => trocarTipo(e.target.value as SessaoResumo['tipo'] | 'todos')}
          className="rounded-pill border border-plum/12 bg-white px-4 py-2 text-[13px] font-medium text-plum/70 transition-colors hover:border-plum/25 focus:outline-none focus:ring-1 focus:ring-mauve/40"
        >
          <option value="todos">Todos os tipos</option>
          {catalogo?.tipos.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      <Estado
        carregando={carregando && pagina === 0}
        erro={erro}
        vazio={vazio}
        aoRepetir={recarregar}
        aoVazio={
          <EmptyState
            title={pendencia === 'todas' ? 'Nenhuma sessão no período' : 'Nada pendente por aqui'}
            description={
              pendencia === 'todas'
                ? 'Quando alguém marcar com você, a sessão aparece aqui.'
                : 'Você está em dia com esta pendência.'
            }
            action={
              pendencia === 'todas' ? (
                <ESButton variant="secondary" onPress={() => { window.location.href = '/admin/horarios' }}>
                  Configurar meus horários
                </ESButton>
              ) : undefined
            }
          />
        }
      >
        <div className="flex flex-col gap-6">
          {dias.map(({ chave, sessoes }) => (
            <section key={chave}>
              <h2 className="mb-2.5 font-display text-lg capitalize leading-none text-plum">
                {diaPorExtenso(sessoes[0].dataHora)}
              </h2>
              <div className="flex flex-col gap-2.5">
                {sessoes.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/agenda/${s.id}`}
                    className={cn(CARD, 'group flex items-center gap-4 p-4 transition-es hover:border-mauve/25')}
                  >
                    <div className="w-[74px] shrink-0">
                      <p className="font-display text-xl leading-none text-plum">{hora(s.dataHora)}</p>
                      <p className="mt-1 text-[11.5px] text-plum/45">{s.duracaoMinutos} min</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-[16.5px] leading-tight text-plum">
                          {/* Grupo mostra o tema; individual mostra o nome da participante
                              (`participanteNome`, preenchido pelo backend só nesta agenda).
                              Nunca `profissional.nome` — no painel dela, seria o nome dela
                              mesma. Fallback no tipo caso o nome não venha. */}
                          {s.tituloGrupo ?? s.participanteNome ?? nomeDoTipo(s.tipo)}
                        </h3>
                        <span
                          className={cn(
                            'rounded-pill px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider',
                            STATUS_TOM[s.status],
                          )}
                        >
                          {STATUS_LABEL[s.status]}
                        </span>
                        {s.pendenteRegistro && (
                          <span className="rounded-pill bg-mauve/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-mauve">
                            Registrar
                          </span>
                        )}
                        {s.linkMeetStatus === 'Falhou' && (
                          <span className="rounded-pill bg-red-alert/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-red-alert">
                            Sala com problema
                          </span>
                        )}
                      </div>
                      {/* `totalParticipantes` vem pronto do backend — subtrair vagas daria
                          o número errado assim que alguém desistisse (D7). */}
                      {s.totalParticipantes != null && s.vagas != null && s.vagas > 0 && (
                        <p className="mt-1 text-xs text-plum/45">
                          {s.totalParticipantes} de {s.vagas} inscritas
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {temMais && dados && (
          <VerMais carregado={itens.length} total={dados.totalElements} carregando={carregando} onVerMais={verMais} />
        )}
      </Estado>
    </div>
  )
}

/** Destaque de pendência — clicar filtra no servidor; clicar de novo volta a todas. */
function Pendente({
  tom,
  ativo,
  titulo,
  descricao,
  onClick,
}: {
  tom: 'mauve' | 'alerta'
  ativo: boolean
  titulo: string
  descricao: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-card border p-4 text-left transition-es',
        tom === 'mauve'
          ? 'border-mauve/25 bg-mauve-ghost/60 hover:border-mauve/45'
          : 'border-red-alert/25 bg-red-alert/[0.05] hover:border-red-alert/45',
        ativo && (tom === 'mauve' ? 'border-mauve ring-1 ring-mauve/30' : 'border-red-alert ring-1 ring-red-alert/30'),
      )}
    >
      <p className={cn('font-display text-[17px] leading-tight', tom === 'mauve' ? 'text-mauve-dark' : 'text-red-alert')}>
        {titulo}
      </p>
      <p className="mt-1 text-[12.5px] text-plum/55">{descricao}</p>
      <p className="mt-1.5 text-[12px] font-medium text-plum/45">{ativo ? 'Filtrando ✓' : 'Ver só essas →'}</p>
    </button>
  )
}
