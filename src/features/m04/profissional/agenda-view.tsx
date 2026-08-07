'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRightIcon, Dialog, EmptyState, ESButton, PageHeader, SelectInput } from '@/components/ui'
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
type Pendencia = 'todas' | 'registro' | 'sala' | 'canceladas'

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
    // Em "Anteriores" o topo tem de ser o mais recente — é o que ela acabou de atender e
    // provavelmente ainda precisa registrar. Nas outras, o mais próximo primeiro.
    ordem: f.chave === 'anteriores' ? ('desc' as const) : ('asc' as const),
  }
}

/**
 * Agrupa por dia no fuso local (a agenda é lida como "o meu dia", não como UTC),
 * **preservando a ordem em que o servidor mandou**.
 *
 * Não reordena de propósito. Havia aqui um `sort` ascendente, de quando
 * `GET /profissional/agenda` não garantia ordem (observado: 7/ago, depois 11/ago, depois
 * 10/ago). Hoje ele ordena, e o cliente aceita `ordem=asc|desc` — reordenar aqui anularia
 * o `desc` de "Anteriores", deixando o parâmetro sem efeito visível.
 *
 * O `Map` mantém a ordem de inserção, então dias e sessões saem como chegaram.
 */
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
 * Legenda do grupo de canceladas do diálogo. O agrupamento é por SOBREPOSIÇÃO, não por
 * horário igual — 14:00, 14:10 e 15:00 podem cair no mesmo bloco. Dizer "todas às 14:00"
 * nesse caso seria falso, então a faixa só vira um horário único quando de fato é um.
 */
function descricaoDoGrupo(sessoes: SessaoResumo[]): string {
  const dia = diaPorExtenso(sessoes[0].dataHora)
  const horarios = sessoes.map((s) => hora(s.dataHora))
  const distintos = [...new Set(horarios)]
  if (distintos.length === 1) return `Todas às ${distintos[0]} de ${dia}.`
  return `Entre ${distintos[0]} e ${distintos[distintos.length - 1]} de ${dia}.`
}

/**
 * Agrupa blocos que se tocam verticalmente — cada grupo é um conjunto que precisa dividir
 * espaço entre si, e grupos diferentes não se enxergam. Usado duas vezes na grade do dia:
 * para colapsar canceladas repetidas e para distribuir o resto em colunas.
 */
function agruparPorSobreposicao<T extends { top: number; altura: number }>(blocos: T[]): T[][] {
  const grupos: T[][] = []
  let atual: T[] = []
  let fimDoGrupo = -Infinity

  for (const b of [...blocos].sort((a, z) => a.top - z.top)) {
    if (atual.length > 0 && b.top >= fimDoGrupo) {
      grupos.push(atual)
      atual = []
      fimDoGrupo = -Infinity
    }
    atual.push(b)
    fimDoGrupo = Math.max(fimDoGrupo, b.top + b.altura)
  }
  if (atual.length > 0) grupos.push(atual)
  return grupos
}

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
  /** Canceladas de um mesmo horário, abertas em diálogo a partir do cartão agregado. */
  const [canceladasAbertas, setCanceladasAbertas] = useState<SessaoResumo[] | null>(null)
  /**
   * Esconde as canceladas da grade da semana. A visão "Por dia" já tem filtro de status; a
   * grade não tinha nenhum, e numa agenda com muito cancelamento elas dominam o dia mesmo
   * colapsadas. Começa desligado: esconder por padrão apagaria histórico sem avisar.
   */
  const [ocultarCanceladas, setOcultarCanceladas] = useState(false)
  const [periodo, setPeriodo] = useState<ChavePeriodo>('proximas')
  const [filtroStatus, setFiltroStatus] = useState(FILTROS_STATUS[0])
  const [filtroTipo, setFiltroTipo] = useState<SessaoResumo['tipo'] | 'todos'>('todos')
  const [pagina, setPagina] = useState(0)
  const [acumulado, setAcumulado] = useState<SessaoResumo[]>([])
  // "Semana" é o padrão: a agenda é lida como planejamento ("como está a minha semana?"),
  // e não como fila do dia. "Por dia" continua a um clique, para quem quer o recorte estreito.
  const [variante, setVariante] = useState<'dia' | 'semana'>('semana')
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

  const { de, ate, ordem } = janela(periodo)
  const { dados, carregando, erro, recarregar } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de,
            ate,
            ordem,
            page: pagina,
            size: 20,
            ...(pendencia === 'registro' ? { pendenteRegistro: true } : {}),
            ...(pendencia === 'sala' ? { linkMeetStatus: ['Falhou' as const] } : {}),
            ...(filtroStatus.status ? { status: filtroStatus.status } : {}),
            // Depois do `filtroStatus` de propósito: ao entrar pelo card de canceladas, é
            // este recorte que vale, mesmo que a pílula de status diga outra coisa.
            ...(pendencia === 'canceladas' ? { status: ['Cancelada' as const] } : {}),
            ...(filtroTipo !== 'todos' ? { tipo: [filtroTipo] } : {}),
          },
        },
      }),
    [pendencia, periodo, filtroStatus.chave, filtroTipo, pagina],
  )

  // Página 0 substitui; as seguintes acumulam (mesma ideia do "Ver mais" das listas). A
  // dedup por `id` ficou como rede: nasceu de o servidor não ordenar (a mesma sessão voltava
  // em duas páginas, rendendo "duplicate key" no React), o que já foi corrigido — mas é
  // barata e protege de qualquer instabilidade de paginação sem custo perceptível.
  const itens = pagina === 0 ? (dados?.content ?? []) : juntarSemRepetir(acumulado, dados?.content ?? [])
  const dias = porDia(itens)
  const vazio = !carregando && !erro && itens.length === 0
  const temMais = dados ? pagina + 1 < dados.totalPages : false

  /**
   * As cinco contagens do topo, num fetch só — os recortes de tempo de cada uma são do
   * servidor (ver `ResumoAgenda` no contrato), e nenhuma depende do período escolhido na
   * lista nem da paginação.
   *
   * Isto era **quatro** requisições: três `size=1` disparadas só para ler um total do
   * envelope, e uma `size=100` que baixava o mês inteiro para somar a receita no cliente —
   * a única parte da tela que supunha um volume máximo de sessões.
   *
   * As pendências continuam corretas no default justamente por virem daqui: "aguardando
   * registro" é sessão que já passou, e se elas saíssem do fetch da lista, o período
   * "Próximas" devolveria sempre 0 — o painel diria que não há pendência exatamente
   * quando ela existe.
   */
  const { dados: resumo } = useRecurso(() => m04.GET('/profissional/agenda/resumo', {}), [])

  /**
   * Sessões canceladas que AINDA ESTÃO NO FUTURO — combinados desfeitos, buracos que
   * abriram na agenda. É o recorte que faz o cancelamento virar notícia em vez de estado:
   * era para acontecer, não vai mais, e ainda dá tempo de fazer algo. Sai sozinho da conta
   * quando a data passa.
   *
   * Não dá para pedir "só as que a usuária cancelou" (não há filtro por `canceladaPor` na
   * listagem — ver TASKS_BACKEND_M04_R2.md §1.3), então o rótulo fala de horários livres,
   * que é verdade independente de quem cancelou. Quem cancelou aparece em cada cartão.
   *
   * `size=1`: só o `totalElements` do envelope interessa aqui.
   */
  const { dados: canceladasFuturas } = useRecurso(
    () =>
      m04.GET('/profissional/agenda', {
        params: {
          query: {
            de: `${hojeISO()}T00:00:00Z`,
            ate: `${emDiasISO(HORIZONTE_AGENDAMENTO_DIAS)}T23:59:59Z`,
            status: ['Cancelada'],
            page: 0,
            size: 1,
          },
        },
      }),
    [],
  )
  const totalCanceladasFuturas = canceladasFuturas?.totalElements ?? 0
  const totalPendenteRegistro = resumo?.pendenteRegistro ?? 0
  const totalLinkMeetFalhou = resumo?.linkMeetFalhou ?? 0
  const previstoNoMes = resumo?.receitaPrevistaMes ?? 0

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

  const sessoesDoDiaTodas = semanaPorDia[diaSel] ?? []
  const canceladasNoDia = sessoesDoDiaTodas.filter((s) => s.status === 'Cancelada').length
  const sessoesDoDiaSel = ocultarCanceladas
    ? sessoesDoDiaTodas.filter((s) => s.status !== 'Cancelada')
    : sessoesDoDiaTodas

  /**
   * Blocos da grade do dia, já resolvidos para NÃO se sobrepor.
   *
   * Duas coisas acontecem aqui, nesta ordem:
   *
   * 1. **Canceladas que disputam o mesmo espaço viram um bloco só** ("N canceladas"). Marcar
   *    e desmarcar o mesmo horário é comum — um horário real da base tinha 5 canceladas mais
   *    a sessão de verdade —, e cada tentativa virando uma coluna espremia justamente a única
   *    que a profissional precisa ler. A informação não some: o cartão diz quantas foram, e a
   *    lista "Por dia" continua mostrando uma a uma.
   * 2. **O que sobra vira colunas lado a lado**, como num calendário de verdade. Antes todos
   *    ocupavam a largura inteira, então 16:00 e 16:30 se empilhavam e o de baixo cobria o
   *    de cima.
   *
   * A disputa é medida pela extensão VISUAL (topo → topo+altura), não pelo horário: a altura
   * mínima de 30px faz duas sessões próximas ocuparem o mesmo pixel mesmo quando os horários
   * não chegam a se cruzar, e comparar `dataHora` deixaria esses casos de fora.
   */
  const blocosDoDia = (() => {
    const bruto = sessoesDoDiaSel.map((s) => {
      const d = new Date(s.dataHora)
      const fracao = d.getHours() - horaMin + d.getMinutes() / 60
      return {
        sessao: s,
        top: Math.round(fracao * ALTURA_LINHA),
        altura: Math.max(30, Math.round((s.duracaoMinutos / 60) * ALTURA_LINHA - 6)),
        // Quem o cartão representa: uma sessão no caso normal, o grupo inteiro quando
        // colapsado — é o que o diálogo abre para nenhuma delas ficar inalcançável.
        sessoes: [s],
      }
    })

    const canceladas = bruto.filter((b) => b.sessao.status === 'Cancelada')
    const demais = bruto.filter((b) => b.sessao.status !== 'Cancelada')
    const colapsadas = agruparPorSobreposicao(canceladas).map((g) =>
      g.length === 1
        ? g[0]
        : { ...g[0], altura: Math.max(...g.map((x) => x.altura)), sessoes: g.map((x) => x.sessao) },
    )

    // First-fit: cada bloco entra na primeira coluna já livre naquela altura; se não houver,
    // abre uma nova. `colunas` é o total do grupo, para o JSX saber em quantas partes dividir.
    return agruparPorSobreposicao([...demais, ...colapsadas]).flatMap((grupo) => {
      const fimPorColuna: number[] = []
      const comColuna = grupo.map((b) => {
        let coluna = fimPorColuna.findIndex((fim) => fim <= b.top)
        if (coluna === -1) {
          coluna = fimPorColuna.length
          fimPorColuna.push(0)
        }
        fimPorColuna[coluna] = b.top + b.altura
        return { ...b, coluna }
      })
      return comColuna.map((b) => ({ ...b, colunas: fimPorColuna.length }))
    })
  })()

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
    // Os cards de pendência filtram a LISTA, que só existe em "Por dia" — na grade da semana
    // o clique aplicava um filtro invisível e parecia não fazer nada. Ficou evidente quando
    // "Semana" virou a visão padrão; antes o caso quase não acontecia.
    if (p !== 'todas' && variante === 'semana') trocarVariante('dia')
    // "Aguardando registro" é, por definição, sessão que JÁ passou. Com o período em
    // "Próximas" o filtro devolveria zero e a pendência pareceria resolvida — então
    // clicar nela abre o período que a contém.
    if (p === 'registro' && periodo === 'proximas') setPeriodo('todas')
    // O oposto para as canceladas à frente: elas só existem no futuro, e num período de
    // passado o filtro viria vazio.
    if (p === 'canceladas' && periodo === 'anteriores') setPeriodo('proximas')
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
        <Metrica rotulo="Próximos 7 dias" valor={String(resumo?.proximos7Dias ?? '—')} nota="sessões marcadas" />
        <Metrica
          rotulo="Aguardando registro"
          valor={resumo ? String(totalPendenteRegistro) : '—'}
          nota="já aconteceram"
          cor="text-mauve"
        />
        {/* `canceladasPelaUsuaria14Dias`, não o total: o card quer dizer "desmarcaram
            comigo", e `canceladas14Dias` soma também o que a própria profissional cancelou —
            atribuindo a ela o que ela mesma decidiu. As duas contam pela data do
            CANCELAMENTO, não pela da sessão: um cancelamento de hoje para uma sessão do mês
            que vem é a notícia mais acionável, e era exatamente a que faltava. */}
        <Metrica
          rotulo="Últimos 14 dias"
          valor={String(resumo?.canceladasPelaUsuaria14Dias ?? '—')}
          nota="canceladas pelas usuárias"
        />
        <Metrica rotulo="Previsto no mês" valor={reais(previstoNoMes) ?? 'R$ 0,00'} nota="sessões agendadas e realizadas" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_316px]">
        <div className="min-w-0">
          {/* Pendências */}
          {(totalPendenteRegistro > 0 || totalLinkMeetFalhou > 0 || totalCanceladasFuturas > 0) && (
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
              {/* O cancelamento chega por e-mail, mas dentro do app era só um status que
                  sumia da lista — dava para não ver. Aqui ele aparece onde ela já olha. */}
              {totalCanceladasFuturas > 0 && (
                <Pendente
                  tom="mauve"
                  ativo={pendencia === 'canceladas'}
                  titulo={`${totalCanceladasFuturas} ${totalCanceladasFuturas === 1 ? 'sessão cancelada' : 'sessões canceladas'} à frente`}
                  descricao="Horários que voltaram a ficar livres na sua agenda."
                  onClick={() => trocarFiltro(pendencia === 'canceladas' ? 'todas' : 'canceladas')}
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
                  <SelectInput
                    className="w-48"
                    selectedKey={filtroTipo}
                    onChange={(key) => trocarTipo(key as SessaoResumo['tipo'] | 'todos')}
                    options={[
                      { key: 'todos', label: 'Todos os tipos' },
                      ...(catalogo?.tipos.map((t) => ({ key: t.codigo, label: t.nome })) ?? []),
                    ]}
                  />
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
                  title={
                    pendencia === 'todas'
                      ? 'Nenhuma sessão no período'
                      : pendencia === 'canceladas'
                        // Cancelamento não é pendência: não há nada a "ficar em dia" com ele.
                        ? 'Nada foi desmarcado'
                        : 'Nada pendente por aqui'
                  }
                  description={
                    pendencia === 'todas'
                      ? 'Quando alguém marcar com você, a sessão aparece aqui.'
                      : pendencia === 'canceladas'
                        ? 'Nenhuma sessão cancelada neste período.'
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
                <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
                  <h2 className="font-display text-xl leading-none text-plum">
                    {dataLocalDe(diasSemanaISO[diaSel]).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h2>
                  <span className="text-xs text-plum/45">{sessoesDoDiaSel.length === 0 ? 'nada marcado' : `${sessoesDoDiaSel.length} ${sessoesDoDiaSel.length === 1 ? 'sessão' : 'sessões'}`}</span>
                  {/* Só aparece quando há o que esconder — um botão que não muda nada é ruído.
                      O rótulo diz o que vai acontecer, não o estado atual. */}
                  {canceladasNoDia > 0 && (
                    <button
                      type="button"
                      onClick={() => setOcultarCanceladas((v) => !v)}
                      className={cn(
                        'ml-auto shrink-0 rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-es',
                        ocultarCanceladas
                          ? 'border-mauve bg-mauve-ghost text-mauve'
                          : 'border-plum/14 bg-white text-plum/70 hover:border-plum/30 hover:text-plum',
                      )}
                    >
                      {ocultarCanceladas
                        ? `Mostrar ${canceladasNoDia} ${canceladasNoDia === 1 ? 'cancelada' : 'canceladas'}`
                        : `Ocultar ${canceladasNoDia === 1 ? 'cancelada' : 'canceladas'}`}
                    </button>
                  )}
                </div>

                {sessoesDoDiaSel.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-plum/14 p-11 text-center">
                    <p className="font-display text-xl text-plum">
                      {ocultarCanceladas && canceladasNoDia > 0 ? 'Só canceladas neste dia' : 'Nenhuma sessão neste dia'}
                    </p>
                    <p className="mx-auto mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-plum/55">
                      {/* Sem esta distinção o filtro mentiria: o dia TEM sessões, elas é que
                          estão escondidas, e "você não publicou horários" seria falso. */}
                      {ocultarCanceladas && canceladasNoDia > 0
                        ? `As ${canceladasNoDia} sessões deste dia foram canceladas e estão ocultas.`
                        : 'Você não publicou horários para este dia da semana.'}
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
                    {blocosDoDia.map(({ sessao, top, altura, coluna, colunas, sessoes }) => {
                      const agregado = sessoes.length > 1
                      // A faixa útil começa depois da régua de horas (62px). Dividi-la em
                      // `colunas` partes é o que impede o empilhamento; com uma coluna só, o
                      // resultado é idêntico ao layout de largura cheia de antes.
                      const estilo = {
                        top,
                        height: altura,
                        left: `calc(62px + ${coluna} * (100% - 62px) / ${colunas})`,
                        width: `calc((100% - 62px) / ${colunas} - 6px)`,
                        background: sessao.status === 'Cancelada' ? 'var(--color-plum-soft)' : sessao.status === 'NaoCompareceu' ? '#FBEEF0' : sessao.status === 'Realizada' ? 'var(--color-success-light)' : 'var(--color-mauve-ghost)',
                        borderLeft: `3px solid ${DOT_TOM[sessao.status]}`,
                      }
                      const classe = 'absolute flex items-center gap-3.5 overflow-hidden rounded-2xl px-4 text-left transition-es hover:translate-x-0.5'
                      const conteudo = (
                        <>
                          <span className="shrink-0 font-display text-[16px] leading-none text-plum">{hora(sessao.dataHora)}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-plum">
                            {agregado ? `${sessoes.length} canceladas` : tituloDaSessao(sessao, nomeDoTipo)}
                          </span>
                          {/* O selo é a primeira coisa a sair quando a coluna aperta: o horário
                              e o nome identificam a sessão, e a cor do cartão já dá o status. */}
                          {colunas === 1 && !agregado && (
                            <span className={cn('shrink-0 rounded-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', STATUS_TOM[sessao.status])}>
                              {STATUS_LABEL[sessao.status]}
                            </span>
                          )}
                        </>
                      )

                      // Cartão agregado abre a lista: linkar direto levaria a UMA das canceladas
                      // sem dizer qual, e deixaria as outras sem nenhum caminho até elas.
                      return agregado ? (
                        <button
                          key={sessao.id}
                          type="button"
                          onClick={() => setCanceladasAbertas(sessoes)}
                          title={`Ver as ${sessoes.length} sessões canceladas deste horário`}
                          className={classe}
                          style={estilo}
                        >
                          {conteudo}
                        </button>
                      ) : (
                        <Link key={sessao.id} href={`/admin/agenda/${sessao.id}`} className={classe} style={estilo}>
                          {conteudo}
                        </Link>
                      )
                    })}
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

      {/* As canceladas que o cartão agregado representa. Sem isto, colapsar as escondia:
          na grade elas viram um número, e este é o caminho de volta até cada uma. */}
      <Dialog
        isOpen={canceladasAbertas !== null}
        onClose={() => setCanceladasAbertas(null)}
        title={canceladasAbertas ? `${canceladasAbertas.length} sessões canceladas` : ''}
        description={canceladasAbertas ? descricaoDoGrupo(canceladasAbertas) : undefined}
        width={460}
      >
        {/* Teto de altura porque o grupo não tem tamanho fixo: um horário da base já juntou
            5 canceladas, e nada impede que sejam 15. Sem isto o painel cresceria para fora
            da tela — o `overflow-hidden` do Dialog cortaria as últimas sem aviso. */}
        <div className="flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto">
          {(canceladasAbertas ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/admin/agenda/${s.id}`}
              onClick={() => setCanceladasAbertas(null)}
              className="flex items-center gap-3 rounded-input border border-plum/8 bg-white px-3.5 py-3 transition-es hover:border-mauve/40 hover:bg-cream"
            >
              <span className="font-display text-[15px] leading-none text-plum">{hora(s.dataHora)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-plum">{tituloDaSessao(s, nomeDoTipo)}</span>
              <span className="shrink-0 text-plum/30">
                <ChevronRightIcon size={16} />
              </span>
            </Link>
          ))}
        </div>
      </Dialog>
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
