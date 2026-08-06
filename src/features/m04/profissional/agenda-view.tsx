'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EmptyState, ESButton, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { juntarSemRepetir } from '@/features/m04/api/use-lista-paginada'
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
  HORIZONTE_AGENDAMENTO_DIAS,
  HORIZONTE_AGENDAMENTO_SEMANAS,
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

/** Quanto passado a agenda alcança — o suficiente para registrar o que ficou pendente. */
const DIAS_PASSADO = 14

/**
 * Período da lista. **Próximas é o default** e isso é a coisa mais importante daqui: com
 * uma janela única começando 14 dias atrás, as primeiras páginas eram tomadas por sessões
 * velhas (em boa parte canceladas), e o que está por vir — o motivo de abrir a agenda —
 * caía na página 2 ou 3. A profissional via o passado e paginava atrás do futuro.
 *
 * O limite da frente NÃO é um número solto: é o mesmo `HORIZONTE_AGENDAMENTO_DIAS` que
 * limita até onde a usuária consegue marcar. Um valor menor aqui esconderia da profissional
 * sessões que já existem na agenda dela — foi exatamente o que aconteceu quando os dois
 * lados tinham 30 dias e só um deles mudou.
 */
const FILTROS_PERIODO = [
  { chave: 'proximas', label: 'Próximas', dePeriodo: 0, atePeriodo: HORIZONTE_AGENDAMENTO_DIAS },
  { chave: 'anteriores', label: 'Anteriores', dePeriodo: -DIAS_PASSADO, atePeriodo: 0 },
  { chave: 'todas', label: 'Todo o período', dePeriodo: -DIAS_PASSADO, atePeriodo: HORIZONTE_AGENDAMENTO_DIAS },
] as const

type ChavePeriodo = (typeof FILTROS_PERIODO)[number]['chave']

function janela(periodo: ChavePeriodo) {
  const f = FILTROS_PERIODO.find((p) => p.chave === periodo) ?? FILTROS_PERIODO[0]
  return {
    de: `${emDiasISO(f.dePeriodo)}T00:00:00Z`,
    ate: `${emDiasISO(f.atePeriodo)}T23:59:59Z`,
  }
}

/**
 * Agrupa por dia no fuso local (a agenda é lida como "o meu dia", não como UTC) e ordena
 * por data — dias entre si e sessões dentro do dia.
 *
 * A ordenação é feita AQUI porque `GET /profissional/agenda` não a garante: na prática ele
 * devolve fora de ordem (observado: 7/ago, depois 11/ago, depois 10/ago). Numa agenda isso
 * é grave duas vezes — a leitura fica sem sentido, e como a paginação segue a ordem do
 * servidor, "página 1" deixa de ser "as 20 mais próximas" e vira 20 quaisquer.
 *
 * Ordenar no cliente conserta o que está carregado; a ordem entre PÁGINAS continua sendo do
 * servidor. O ideal é ele ordenar (ver TASKS_BACKEND_M04.md).
 */
function porDia(itens: SessaoResumo[]) {
  const mapa = new Map<string, SessaoResumo[]>()
  for (const s of itens) {
    const k = chaveDoDia(s.dataHora)
    const atual = mapa.get(k)
    if (atual) atual.push(s)
    else mapa.set(k, [s])
  }
  return [...mapa.entries()]
    .map(([chave, sessoes]) => ({
      chave,
      sessoes: [...sessoes].sort((a, b) => a.dataHora.localeCompare(b.dataHora)),
    }))
    .sort((a, b) => a.chave.localeCompare(b.chave))
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

/**
 * As 7 datas locais (`YYYY-MM-DD`) de uma semana, segunda a domingo. `offsetSemanas` desloca
 * a partir da semana corrente (0 = esta, -1 = passada, 1 = próxima).
 */
function diasDaSemana(offsetSemanas = 0): string[] {
  const seg = dataLocalDe(inicioDaSemanaISO())
  seg.setDate(seg.getDate() + offsetSemanas * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg)
    d.setDate(d.getDate() + i)
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mes}-${dia}`
  })
}

/** "3 – 9 de ago" / "28 de set – 4 de out" — rótulo do intervalo da semana navegada. */
function rotuloDaSemana(dias: string[]): string {
  const ini = dataLocalDe(dias[0])
  const fim = dataLocalDe(dias[6])
  const mesDe = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return mesDe(ini) === mesDe(fim)
    ? `${ini.getDate()} – ${fim.getDate()} de ${mesDe(fim)}`
    : `${ini.getDate()} de ${mesDe(ini)} – ${fim.getDate()} de ${mesDe(fim)}`
}

const ALTURA_LINHA = 56

/**
 * P1 · Minha agenda — o hub do painel. A lista abre em "Próximas": o passado continua
 * alcançável pelo filtro de período, mas não ocupa mais as primeiras páginas.
 *
 * Duas pendências no topo, com contagens vindas dos TOTAIS DO ENVELOPE
 * (`totalPendenteRegistro`, `totalLinkMeetFalhou`) de uma busca PRÓPRIA, que cobre passado
 * e futuro independentemente do período escolhido. Contar a página funcionaria só na
 * primeira e mentiria em todas as outras; e amarrar ao período escolhido zeraria as
 * pendências no default, já que "aguardando registro" mora no passado.
 *
 * Clicar numa pendência FILTRA no servidor (D15) e, quando preciso, abre o período que a
 * contém. Os totais não mudam com o filtro, para o destaque continuar dizendo quantas existem.
 */
export function AgendaView() {
  const [pendencia, setPendencia] = useState<Pendencia>('todas')
  const [periodo, setPeriodo] = useState<ChavePeriodo>('proximas')
  const [filtroStatus, setFiltroStatus] = useState(FILTROS_STATUS[0])
  const [filtroTipo, setFiltroTipo] = useState<SessaoResumo['tipo'] | 'todos'>('todos')
  const [pagina, setPagina] = useState(0)
  const [acumulado, setAcumulado] = useState<SessaoResumo[]>([])
  const [variante, setVariante] = useState<'dia' | 'semana'>('dia')
  /** Semana visível na visão "Semana": 0 = a corrente, -1 = anterior, 1 = seguinte. */
  const [semanaOffset, setSemanaOffset] = useState(0)
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

  const { de, ate } = janela(periodo)
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
    [pendencia, periodo, filtroStatus.chave, filtroTipo, pagina],
  )

  // Página 0 substitui; as seguintes acumulam (mesma ideia do "Ver mais" das listas),
  // deduplicando por `id`: sem ordenação estável no servidor a mesma sessão pode voltar em
  // duas páginas, o que rendia "duplicate key" no React e cards repetidos na tela.
  const itens = pagina === 0 ? (dados?.content ?? []) : juntarSemRepetir(acumulado, dados?.content ?? [])
  const dias = porDia(itens)
  const vazio = !carregando && !erro && itens.length === 0
  const temMais = dados ? pagina + 1 < dados.totalPages : false

  /**
   * Pendências (aguardando registro / sala falhou) — buscadas num período PRÓPRIO, que
   * sempre inclui o passado, e nunca no período que a profissional escolheu na lista.
   *
   * Sem isso elas somem no default: "aguardando registro" é sessão que já passou, então
   * com o período em "Próximas" o envelope devolveria sempre 0 e o painel diria que não há
   * pendência — justamente o alerta que ele existe para dar.
   */
  const { dados: pendencias } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de: `${emDiasISO(-DIAS_PASSADO)}T00:00:00Z`,
            ate: `${emDiasISO(HORIZONTE_AGENDAMENTO_DIAS)}T23:59:59Z`,
            page: 0,
            size: 1,
          },
        },
      }),
    [],
  )
  const totalPendenteRegistro = pendencias?.totalPendenteRegistro ?? 0
  const totalLinkMeetFalhou = pendencias?.totalLinkMeetFalhou ?? 0

  // ── Métricas do topo — 3 chamadas leves extras (só contagem/soma), independentes do
  // fetch principal e da paginação, para não mentir sobre um período que a página 0 não
  // cobre inteiro.
  //
  // O filtro de status aqui NÃO é detalhe: o card diz "sessões marcadas", e sem ele a
  // contagem incluía canceladas e não-compareceu. Numa agenda com histórico de cancelamento
  // isso inflava muito (medido: 16 "marcadas" para 4 sessões realmente de pé).
  const { dados: metricaSemana } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de: `${hojeISO()}T00:00:00Z`,
            ate: `${emDiasISO(7)}T23:59:59Z`,
            status: ['Agendada', 'Confirmada'],
            page: 0,
            size: 1,
          },
        },
      }),
    [],
  )
  // Conta TODAS as canceladas do período, sem distinguir quem cancelou: `canceladaPor` não
  // existe no `SessaoResumo` da listagem nem como filtro de query (só na `Sessao` completa).
  // Por isso o rótulo fala em "canceladas", e não "canceladas pelas usuárias" — dizer o
  // segundo seria atribuir à usuária cancelamentos que a própria profissional fez.
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

  // ── Semana — um fetch cobre a semana VISÍVEL inteira (a corrente ou outra, conforme o
  // `semanaOffset`); alimenta a visão "Semana" e o card "Ritmo da semana", que andam juntos.
  // "Próxima sessão" NÃO sai daqui: ver o fetch dedicado logo abaixo.
  const diasSemanaISO = diasDaSemana(semanaOffset)
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
  // TODAS as sessões (qualquer status) — alimenta a grade detalhada do dia (`blocosDoDia`),
  // onde ver uma sessão cancelada faz sentido: é o histórico real daquele horário.
  const semanaPorDia = diasSemanaISO.map((iso) => semanaItens.filter((s) => chaveDoDia(s.dataHora) === iso))
  // Só o que representa trabalho de verdade (feito ou por vir) — alimenta os indicadores
  // AGREGADOS (Ritmo da semana, pontinhos do seletor de dia). Sem este filtro, um dia com
  // várias cancelas/não-compareceu no passado aparecia como o mais "cheio" da semana, quando
  // na prática não sobrou nenhuma sessão de pé nele.
  const semanaAtivas = semanaItens.filter((s) => s.status !== 'Cancelada' && s.status !== 'NaoCompareceu')
  const semanaAtivasPorDia = diasSemanaISO.map((iso) => semanaAtivas.filter((s) => chaveDoDia(s.dataHora) === iso))
  const maxNaSemana = Math.max(1, ...semanaAtivasPorDia.map((d) => d.length))

  /**
   * "Próxima sessão" — busca PRÓPRIA, de hoje até o fim do horizonte, por dois motivos:
   *
   * 1. Ela é absoluta: não pode mudar quando a profissional navega para outra semana na
   *    grade, senão o card passaria a mostrar "a próxima daquela semana" — ou nada, ao
   *    olhar o passado.
   * 2. Antes saía dos dados da semana corrente e por isso sumia quando a próxima sessão
   *    caía depois de domingo — bem o caso de quem tem a agenda mais espaçada.
   *
   * Ordena no cliente porque o endpoint não garante ordem (ver TASKS_BACKEND_M04.md).
   */
  const { dados: proximaDados } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de: `${hojeISO()}T00:00:00Z`,
            ate: `${emDiasISO(HORIZONTE_AGENDAMENTO_DIAS)}T23:59:59Z`,
            status: ['Agendada', 'Confirmada'],
            page: 0,
            size: 50,
          },
        },
      }),
    [],
  )
  const agora = new Date()
  const proximaSessao = (proximaDados?.content ?? [])
    .filter((s) => new Date(s.dataHora) >= agora)
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

  /**
   * Navega entre semanas. O dia selecionado acompanha: ao sair da semana corrente ele vai
   * para segunda (o começo do que se está olhando); ao voltar para ela, cai em hoje — que
   * é o que a profissional espera encontrar destacado.
   *
   * Para TRÁS não há limite: rever o histórico é uso legítimo da agenda. Para FRENTE trava
   * no horizonte de agendamento — além dele nada pode ser marcado, então as semanas são
   * comprovadamente vazias e navegar para lá só frustraria.
   */
  const irParaSemana = (offset: number) => {
    const alvo = Math.min(offset, HORIZONTE_AGENDAMENTO_SEMANAS)
    setSemanaOffset(alvo)
    const dias = diasDaSemana(alvo)
    const i = dias.indexOf(hojeISO())
    setDiaSel(i === -1 ? 0 : i)
  }

  const trocarVariante = (v: 'dia' | 'semana') => {
    setVariante(v)
    // Voltar para "Por dia" volta para a semana corrente: o offset não aparece nessa visão,
    // e deixá-lo preso faria o "Ritmo da semana" da lateral falar de outra semana em silêncio.
    if (v === 'dia' && semanaOffset !== 0) irParaSemana(0)
  }

  const trocarFiltro = (p: Pendencia) => {
    setPendencia(p)
    // "Aguardando registro" é, por definição, sessão que JÁ passou. Com o período em
    // "Próximas" o filtro devolveria zero e a pendência pareceria resolvida — então
    // clicar nela abre o período que a contém.
    if (p === 'registro' && periodo === 'proximas') setPeriodo('todas')
    setPagina(0)
    setAcumulado([])
  }

  const trocarPeriodo = (p: ChavePeriodo) => {
    setPeriodo(p)
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

  /** Algum filtro fora do padrão? ("Próximas" + todos os status + todos os tipos). */
  const temFiltroAtivo = periodo !== 'proximas' || filtroStatus.chave !== 'todos' || filtroTipo !== 'todos'

  const limparFiltros = () => {
    setPeriodo('proximas')
    setFiltroStatus(FILTROS_STATUS[0])
    setFiltroTipo('todos')
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
        description="Últimos 14 dias e tudo o que já está marcado à frente."
        action={
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded-pill border border-plum/7 bg-cream p-1">
              <button
                type="button"
                onClick={() => trocarVariante('dia')}
                className={cn(
                  'rounded-pill px-4 py-2 text-[13px] font-medium transition-colors',
                  variante === 'dia' ? 'bg-white font-semibold text-mauve shadow-sm' : 'text-plum/55',
                )}
              >
                Por dia
              </button>
              <button
                type="button"
                onClick={() => trocarVariante('semana')}
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
          valor={pendencias ? String(totalPendenteRegistro) : '—'}
          nota="já aconteceram"
          cor="text-mauve"
        />
        <Metrica
          rotulo="Últimos 14 dias"
          valor={String(metricaCanceladas?.totalElements ?? '—')}
          nota="canceladas"
        />
        <Metrica rotulo="Previsto no mês" valor={reais(previstoNoMes) ?? 'R$ 0,00'} nota="sessões agendadas e realizadas" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_316px]">
        <div className="min-w-0">
          {/* Pendências */}
          {(totalPendenteRegistro > 0 || totalLinkMeetFalhou > 0) && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              {totalPendenteRegistro > 0 && (
                <Pendente
                  tom="mauve"
                  ativo={pendencia === 'registro'}
                  titulo={`${totalPendenteRegistro} ${totalPendenteRegistro === 1 ? 'sessão aguardando registro' : 'sessões aguardando registro'}`}
                  descricao="Elas já aconteceram e precisam do seu registro."
                  onClick={() => trocarFiltro(pendencia === 'registro' ? 'todas' : 'registro')}
                />
              )}
              {totalLinkMeetFalhou > 0 && (
                <Pendente
                  tom="alerta"
                  ativo={pendencia === 'sala'}
                  titulo={`${totalLinkMeetFalhou} ${totalLinkMeetFalhou === 1 ? 'sala precisa' : 'salas precisam'} de link manual`}
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

          {/* Filtros em DOIS níveis, não três fileiras de pílulas iguais.

              O período é o corte grosso — decide se a lista fala do que vem ou do que
              passou — então ganha o mesmo segmented control do "Por dia / Semana": a forma
              já comunica "escolha um escopo". Situação e tipo refinam dentro dele e ficam
              em pílulas/select, um degrau abaixo. Antes os três tinham o mesmo peso visual
              e só uma linha divisória sugeria a hierarquia. */}
          {variante === 'dia' && (
            <div className="mb-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-pill border border-plum/7 bg-cream p-1">
                  {FILTROS_PERIODO.map((p) => (
                    <button
                      key={p.chave}
                      type="button"
                      onClick={() => trocarPeriodo(p.chave)}
                      className={cn(
                        'rounded-pill px-4 py-2 text-[13px] font-medium transition-colors',
                        p.chave === periodo ? 'bg-white font-semibold text-mauve shadow-sm' : 'text-plum/55',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  {/* Só aparece quando há o que limpar — com três dimensões de filtro é
                      fácil acabar numa lista vazia sem lembrar o que está ativo. */}
                  {temFiltroAtivo && (
                    <button
                      type="button"
                      onClick={limparFiltros}
                      className="text-[13px] font-medium text-mauve transition-es hover:text-mauve-dark"
                    >
                      Limpar filtros
                    </button>
                  )}
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
              </div>

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
              {/* Navegação entre semanas. Sem limite para trás nem para frente: a agenda é
                  da profissional e olhar o histórico ou o que vem longe é legítimo. O botão
                  "Hoje" só aparece fora da semana corrente, que é quando ele tem função. */}
              <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-plum/7 bg-white px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => irParaSemana(semanaOffset - 1)}
                  aria-label="Semana anterior"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-[13.5px] font-medium text-plum">{rotuloDaSemana(diasSemanaISO)}</span>
                  {semanaOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => irParaSemana(0)}
                      className="rounded-pill border border-mauve/25 px-3 py-1 text-[12px] font-semibold text-mauve transition-es hover:border-mauve/45"
                    >
                      Hoje
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => irParaSemana(semanaOffset + 1)}
                  disabled={semanaOffset >= HORIZONTE_AGENDAMENTO_SEMANAS}
                  aria-label="Próxima semana"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>

              <div className="mb-5 grid grid-cols-7 gap-2">
                {diasSemanaISO.map((iso, i) => {
                  const qtd = semanaAtivasPorDia[i].length
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

          {totalPendenteRegistro > 0 && (
            <div className="rounded-card border border-mauve/[0.16] bg-white p-[22px] shadow-[0_4px_24px_rgba(45,24,64,0.05)]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-pill bg-mauve" />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mauve">Precisa de você</p>
              </div>
              <p className="mt-2.5 font-display text-lg leading-tight text-plum">
                {totalPendenteRegistro} {totalPendenteRegistro === 1 ? 'sessão aguardando registro' : 'sessões aguardando registro'}
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
            {/* O intervalo fica explícito porque este card acompanha a navegação da visão
                "Semana" — sem ele, ao navegar, o gráfico falaria de outra semana calado. */}
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-plum/40">Ritmo da semana</p>
              <span className="text-[11px] text-plum/40">{rotuloDaSemana(diasSemanaISO)}</span>
            </div>
            {/* A barra mais alta usa os 74px inteiros (de propósito — é o "cheio" da
                semana), então o rótulo do dia NÃO pode dividir essa altura com ela: sem
                espaço próprio, o item ficava mais alto que os 74px do container e, sem
                corte, estourava por cima — sobre o título. Por isso a altura fixa envolve
                só a barra; o rótulo vem depois, em fluxo normal, com sua própria altura. */}
            <div className="mt-4 flex items-end gap-2">
              {semanaAtivasPorDia.map((sessoes, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-[74px] w-full items-end">
                    <span
                      className="w-full rounded-t-[5px] rounded-b-[2px]"
                      style={{
                        height: sessoes.length === 0 ? '4px' : `${Math.round(14 + (sessoes.length / maxNaSemana) * 60)}px`,
                        background: sessoes.length >= maxNaSemana ? 'var(--color-mauve)' : 'var(--color-mauve-soft)',
                      }}
                    />
                  </div>
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
