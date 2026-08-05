'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EmptyState, ESButton, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { VerMais } from '@/features/m04/ui/ver-mais'
import {
  chaveDoDia,
  diaPorExtenso,
  hora,
  emDiasISO,
  hojeISO,
  inicioDaSemanaISO,
  inicioDoDiaUTC,
  fimDoDiaUTC,
  inicioDoMesUTC,
  fimDoMesUTC,
  reais,
} from '@/features/m04/lib/datas'
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

/** Cor de destaque por status — usada no risco lateral dos cards e nos blocos da grade semanal. */
const DOT_TOM: Record<StatusSessao, string> = {
  Agendada: 'var(--color-mauve)',
  Confirmada: 'var(--color-mauve)',
  Realizada: 'var(--color-success-dark)',
  Cancelada: 'rgba(45,24,64,0.22)',
  NaoCompareceu: 'var(--color-red-alert)',
}

/** Título de uma sessão: tema do grupo, nome de quem marcou, ou o tipo como último recurso. */
function tituloDaSessao(s: SessaoResumo, nomeDoTipo: (t: SessaoResumo['tipo']) => string): string {
  return s.tituloGrupo ?? s.participanteNome ?? nomeDoTipo(s.tipo)
}

/** `YYYY-MM-DD` local → `Date` local (nunca `new Date(iso)`, que o navegador lê como UTC). */
function dataLocalDe(isoLocal: string): Date {
  const [y, m, d] = isoLocal.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** As 7 datas locais (`YYYY-MM-DD`) da semana corrente, segunda a domingo. */
function diasDaSemana(): string[] {
  const seg = dataLocalDe(inicioDaSemanaISO())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg)
    d.setDate(d.getDate() + i)
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mes}-${dia}`
  })
}

const ALTURA_LINHA = 56

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
  const [variante, setVariante] = useState<'dia' | 'semana'>('dia')
  const [diaSel, setDiaSel] = useState(() => {
    // Índice (0 = segunda) do dia de hoje na semana corrente.
    const hoje = hojeISO()
    const i = diasDaSemana().indexOf(hoje)
    return i === -1 ? 0 : i
  })

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

  // ── Métricas do topo — 3 chamadas leves extras (só contagem/soma), independentes do
  // fetch principal e da paginação, para não mentir sobre um período que a página 0 não
  // cobre inteiro.
  const { dados: metricaSemana } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: { query: { de: `${hojeISO()}T00:00:00Z`, ate: `${emDiasISO(7)}T23:59:59Z`, page: 0, size: 1 } },
      }),
    [],
  )
  const { dados: metricaCanceladas } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de: `${emDiasISO(-14)}T00:00:00Z`,
            ate: `${hojeISO()}T23:59:59Z`,
            status: ['Cancelada'],
            page: 0,
            size: 1,
          },
        },
      }),
    [],
  )
  // Uma página de até 100 sessões para o mês inteiro — soma no cliente porque o backend não
  // tem endpoint de agregado de receita. 100 é uma folga generosa sobre o volume real de uma
  // profissional num mês; documentado aqui em vez de truncar em silêncio se um dia isso mudar.
  const { dados: metricaMes } = useRecurso(
    () => m04.GET('/profissional/agenda', { params: { query: { de: inicioDoMesUTC(), ate: fimDoMesUTC(), page: 0, size: 100 } } }),
    [],
  )
  const previstoNoMes = (metricaMes?.content ?? [])
    .filter((s) => s.status === 'Agendada' || s.status === 'Confirmada' || s.status === 'Realizada')
    .reduce((soma, s) => soma + (s.valorPraticado ?? 0), 0)

  // ── Semana — um único fetch cobre a semana corrente inteira; alimenta a visão "Semana",
  // o card "Ritmo da semana" e o card "Próxima sessão" da sidebar, sem 2ª fonte de dados.
  const diasSemanaISO = diasDaSemana()
  const { dados: semanaDados } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de: inicioDoDiaUTC(diasSemanaISO[0]),
            ate: fimDoDiaUTC(diasSemanaISO[6]),
            page: 0,
            size: 100,
          },
        },
      }),
    [diasSemanaISO[0]],
  )
  const semanaItens = semanaDados?.content ?? []
  const semanaPorDia = diasSemanaISO.map((iso) => semanaItens.filter((s) => chaveDoDia(s.dataHora) === iso))
  const maxNaSemana = Math.max(1, ...semanaPorDia.map((d) => d.length))

  const agora = new Date()
  const proximaSessao = semanaItens
    .filter((s) => (s.status === 'Agendada' || s.status === 'Confirmada') && new Date(s.dataHora) >= agora)
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora))[0]

  // Grade de horário da visão Semana: limites derivados dos horários reais da semana (não
  // fixos como no protótipo), com uma faixa mínima razoável quando a semana está vazia.
  const horasDaSemana = semanaItens.map((s) => new Date(s.dataHora).getHours())
  const horaMin = horasDaSemana.length ? Math.max(0, Math.min(...horasDaSemana) - 1) : 8
  const horaMax = horasDaSemana.length ? Math.min(23, Math.max(...horasDaSemana) + 2) : 20
  const linhasHora = Array.from({ length: horaMax - horaMin + 1 }, (_, i) => horaMin + i)

  const sessoesDoDiaSel = semanaPorDia[diaSel] ?? []
  const blocosDoDia = sessoesDoDiaSel.map((s) => {
    const d = new Date(s.dataHora)
    const fracao = d.getHours() - horaMin + d.getMinutes() / 60
    return {
      sessao: s,
      top: Math.round(fracao * ALTURA_LINHA),
      altura: Math.max(30, Math.round((s.duracaoMinutos / 60) * ALTURA_LINHA - 6)),
    }
  })

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
        eyebrow="Atendimento"
        title="Minha agenda"
        description="Últimos 14 dias e próximos 30, do jeito que você atende."
        action={
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded-pill border border-plum/7 bg-cream p-1">
              <button
                type="button"
                onClick={() => setVariante('dia')}
                className={cn(
                  'rounded-pill px-4 py-2 text-[13px] font-medium transition-colors',
                  variante === 'dia' ? 'bg-white font-semibold text-mauve shadow-sm' : 'text-plum/55',
                )}
              >
                Por dia
              </button>
              <button
                type="button"
                onClick={() => setVariante('semana')}
                className={cn(
                  'rounded-pill px-4 py-2 text-[13px] font-medium transition-colors',
                  variante === 'semana' ? 'bg-white font-semibold text-mauve shadow-sm' : 'text-plum/55',
                )}
              >
                Semana
              </button>
            </div>
            <Link
              href="/admin/agenda/novo-grupo"
              className="inline-flex h-[44px] items-center gap-2 rounded-full bg-mauve px-5 text-[14px] font-semibold text-cream shadow-[0_10px_24px_rgba(122,74,92,0.26)] transition-es hover:bg-mauve-dark"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Criar sessão de grupo
            </Link>
          </div>
        }
      />

      {/* Métricas */}
      <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-[22px] border border-white/60 bg-plum/7 shadow-[0_4px_24px_rgba(45,24,64,0.05)] sm:grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Próximos 7 dias" valor={String(metricaSemana?.totalElements ?? '—')} nota="sessões marcadas" />
        <Metrica
          rotulo="Aguardando registro"
          valor={String(dados?.totalPendenteRegistro ?? '—')}
          nota="já aconteceram"
          cor="text-mauve"
        />
        <Metrica
          rotulo="Últimos 14 dias"
          valor={String(metricaCanceladas?.totalElements ?? '—')}
          nota="canceladas pelas usuárias"
        />
        <Metrica rotulo="Previsto no mês" valor={reais(previstoNoMes) ?? 'R$ 0,00'} nota="sessões agendadas e realizadas" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_316px]">
        <div className="min-w-0">
          {/* Pendências */}
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

          {variante === 'dia' && (
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
          )}

          {variante === 'dia' ? (
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
                    <div className="mb-3 flex items-baseline gap-3">
                      <h2 className="font-display text-xl leading-none text-plum">{diaPorExtenso(sessoes[0].dataHora)}</h2>
                      <span className="text-xs text-plum/45">
                        {sessoes.length} {sessoes.length === 1 ? 'sessão' : 'sessões'}
                      </span>
                      <span className="h-px flex-1 bg-plum/[0.09]" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {sessoes.map((s) => (
                        <Link
                          key={s.id}
                          href={`/admin/agenda/${s.id}`}
                          className={cn(
                            CARD,
                            'group flex items-center gap-5 p-4 transition-es hover:-translate-y-px hover:shadow-[0_12px_30px_rgba(45,24,64,0.1)]',
                            s.status === 'Cancelada' && 'opacity-70',
                          )}
                          style={{ borderLeft: `3px solid ${DOT_TOM[s.status]}` }}
                        >
                          <div className="w-[70px] shrink-0">
                            <p className="font-display text-xl leading-none text-plum">{hora(s.dataHora)}</p>
                            <p className="mt-1 text-[11.5px] text-plum/42">{s.duracaoMinutos} min</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display text-[16px] leading-tight text-plum">
                                {tituloDaSessao(s, nomeDoTipo)}
                              </h3>
                              <span className={cn('rounded-pill px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider', STATUS_TOM[s.status])}>
                                {STATUS_LABEL[s.status]}
                              </span>
                              {s.pendenteRegistro && (
                                <span className="rounded-pill bg-mauve-ghost px-2.5 py-1 text-[11px] font-semibold text-mauve">Registrar</span>
                              )}
                              {s.linkMeetStatus === 'Falhou' && (
                                <span className="rounded-pill bg-red-alert/10 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-red-alert">
                                  Sala com problema
                                </span>
                              )}
                            </div>
                            {s.totalParticipantes != null && s.vagas != null && s.vagas > 0 && (
                              <p className="mt-1 text-xs text-plum/45">{s.totalParticipantes} de {s.vagas} inscritas</p>
                            )}
                          </div>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(45,24,64,0.28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="m9 6 6 6-6 6" />
                          </svg>
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
          ) : (
            <div>
              <div className="mb-5 grid grid-cols-7 gap-2">
                {diasSemanaISO.map((iso, i) => {
                  const qtd = semanaPorDia[i].length
                  const sel = diaSel === i
                  const nomeDia = dataLocalDe(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setDiaSel(i)}
                      className={cn(
                        'flex flex-col items-start gap-3 rounded-2xl border px-3.5 py-4 text-left transition-es',
                        sel ? 'border-mauve/40 bg-mauve-ghost' : 'border-plum/7 bg-white hover:border-plum/16',
                      )}
                    >
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-plum/55">{nomeDia}</span>
                      <span className="font-display text-2xl leading-none text-plum">{dataLocalDe(iso).getDate()}</span>
                      <span className="flex h-[22px] w-full items-end gap-[3px]">
                        {[0, 1, 2].map((k) => (
                          <span
                            key={k}
                            className="flex-1 rounded-[2px]"
                            style={{
                              height: qtd === 0 ? '3px' : `${Math.min(22, 6 + (qtd / maxNaSemana) * 14 + k * 2)}px`,
                              background: qtd === 0 ? 'rgba(45,24,64,0.10)' : sel ? 'var(--color-mauve)' : 'var(--color-mauve-soft)',
                            }}
                          />
                        ))}
                      </span>
                      <span className="text-[11.5px] text-plum/55">{qtd === 0 ? 'livre' : `${qtd} ${qtd === 1 ? 'sessão' : 'sessões'}`}</span>
                    </button>
                  )
                })}
              </div>

              <div className={CARD}>
                <div className="mb-5 flex items-baseline gap-3">
                  <h2 className="font-display text-xl leading-none text-plum">
                    {dataLocalDe(diasSemanaISO[diaSel]).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h2>
                  <span className="text-xs text-plum/45">{sessoesDoDiaSel.length === 0 ? 'nada marcado' : `${sessoesDoDiaSel.length} ${sessoesDoDiaSel.length === 1 ? 'sessão' : 'sessões'}`}</span>
                </div>

                {sessoesDoDiaSel.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-plum/14 p-11 text-center">
                    <p className="font-display text-xl text-plum">Nenhuma sessão neste dia</p>
                    <p className="mx-auto mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-plum/55">
                      Você não publicou horários para este dia da semana.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-[62px]" style={{ height: linhasHora.length * ALTURA_LINHA }}>
                    {linhasHora.map((h) => (
                      <div key={h} className="flex items-center gap-3.5" style={{ height: ALTURA_LINHA }}>
                        <span className="absolute left-0 text-xs text-plum/38">{String(h).padStart(2, '0')}:00</span>
                        <span className="h-px flex-1 bg-plum/[0.06]" />
                      </div>
                    ))}
                    {blocosDoDia.map(({ sessao, top, altura }) => (
                      <Link
                        key={sessao.id}
                        href={`/admin/agenda/${sessao.id}`}
                        className="absolute left-[62px] right-0 flex items-center gap-3.5 rounded-2xl px-4 transition-es hover:translate-x-0.5"
                        style={{
                          top,
                          height: altura,
                          background: sessao.status === 'Cancelada' ? 'var(--color-plum-soft)' : sessao.status === 'NaoCompareceu' ? '#FBEEF0' : sessao.status === 'Realizada' ? 'var(--color-success-light)' : 'var(--color-mauve-ghost)',
                          borderLeft: `3px solid ${DOT_TOM[sessao.status]}`,
                        }}
                      >
                        <span className="font-display text-[16px] leading-none text-plum">{hora(sessao.dataHora)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-plum">{tituloDaSessao(sessao, nomeDoTipo)}</span>
                        <span className={cn('shrink-0 rounded-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', STATUS_TOM[sessao.status])}>
                          {STATUS_LABEL[sessao.status]}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="sticky top-6 flex flex-col gap-4">
          {proximaSessao && (
            <div className="rounded-card border border-plum/7 bg-cream p-[22px] shadow-[0_4px_24px_rgba(45,24,64,0.05)]">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mauve">Próxima sessão</p>
              <p className="mt-2.5 font-display text-[28px] leading-none text-plum">{hora(proximaSessao.dataHora)}</p>
              <p className="mt-2 text-sm text-plum/72">{tituloDaSessao(proximaSessao, nomeDoTipo)}</p>
              <Link
                href={`/admin/agenda/${proximaSessao.id}`}
                className="mt-4 flex h-[46px] items-center justify-center rounded-full bg-mauve text-[14px] font-semibold text-cream shadow-[0_8px_20px_rgba(122,74,92,0.22)] transition-es hover:bg-mauve-dark"
              >
                Ver sessão
              </Link>
            </div>
          )}

          {dados && dados.totalPendenteRegistro > 0 && (
            <div className="rounded-card border border-mauve/[0.16] bg-white p-[22px] shadow-[0_4px_24px_rgba(45,24,64,0.05)]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-pill bg-mauve" />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mauve">Precisa de você</p>
              </div>
              <p className="mt-2.5 font-display text-lg leading-tight text-plum">
                {dados.totalPendenteRegistro} {dados.totalPendenteRegistro === 1 ? 'sessão aguardando registro' : 'sessões aguardando registro'}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-plum/58">
                Já aconteceram. O registro é o que confirma o atendimento — e ele é definitivo.
              </p>
              <button
                type="button"
                onClick={() => trocarFiltro('registro')}
                className="mt-3.5 w-full rounded-full bg-mauve py-2.5 text-[13.5px] font-semibold text-cream transition-es hover:bg-mauve-dark"
              >
                Ver pendências
              </button>
            </div>
          )}

          <div className="rounded-card border border-plum/5 bg-white p-[22px] shadow-[0_4px_24px_rgba(45,24,64,0.05)]">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-plum/40">Ritmo da semana</p>
            <div className="mt-4 flex h-[74px] items-end gap-2">
              {semanaPorDia.map((sessoes, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className="w-full rounded-t-[5px] rounded-b-[2px]"
                    style={{
                      height: sessoes.length === 0 ? '4px' : `${Math.round(14 + (sessoes.length / maxNaSemana) * 60)}px`,
                      background: sessoes.length >= maxNaSemana ? 'var(--color-mauve)' : 'var(--color-mauve-soft)',
                    }}
                  />
                  <span className="text-[10.5px] text-plum/42">{dataLocalDe(diasSemanaISO[i]).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Metrica({ rotulo, valor, nota, cor = 'text-plum' }: { rotulo: string; valor: string; nota: string; cor?: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-plum/40">{rotulo}</p>
      <p className={cn('mt-2 font-display text-[28px] leading-none', cor)}>{valor}</p>
      <p className="mt-1.5 text-[12.5px] text-plum/48">{nota}</p>
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
