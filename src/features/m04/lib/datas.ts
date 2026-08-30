/**
 * Formatação de data/hora do M04. Tudo trafega em UTC (ISO-8601 com `Z`); a conversão
 * para o fuso da usuária acontece SÓ na renderização — e o agrupamento por dia usa a
 * data LOCAL, nunca a UTC: um slot 23:30Z cai no dia seguinte no Brasil, e agrupar pelo
 * UTC colocaria o horário no dia errado.
 */

/** Chave de agrupamento por dia no fuso local (`2026-08-12`). */
export function chaveDoDia(iso: string): string {
  const d = new Date(iso)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** "terça-feira, 12 de agosto" — cabeçalho de grupo de dia. */
export function diaPorExtenso(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "quarta-feira, 12 de agosto, às 14:00" — confirmação e detalhe. */
export function dataHoraPorExtenso(iso: string): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${data}, às ${hora(iso)}`
}

/**
 * "TER" / 11 / "AGO" — as três partes do bloco de data em cartão, o mesmo âncora visual
 * da confirmação (U5) e da tela de sucesso (U5b). Compartilhado para as duas telas
 * mostrarem a MESMA peça: a continuidade é o que faz a segunda parecer a conclusão da
 * primeira, e não outra tela qualquer.
 */
export function blocoData(iso: string): { dia: string; numero: number; mes: string } {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
  return { dia, numero: d.getDate(), mes }
}

/** "14:00" no fuso local. */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** "14:00 – 14:50" (faixa do slot). */
export function faixaHoraria(inicio: string, fim: string): string {
  return `${hora(inicio)} – ${hora(fim)}`
}

/**
 * Data local (`YYYY-MM-DD`) → instante UTC do INÍCIO desse dia, como o contrato pede
 * (`date-time` com `Z`).
 *
 * Concatenar `T00:00:00Z` na data seria tratar a data local como se já fosse UTC: em
 * Brasília (UTC-3), "20/12" viraria 19/12 às 21:00 — três horas antes do que a pessoa
 * escolheu. Aqui a string sem `Z` é interpretada no fuso local e só então convertida.
 */
export function inicioDoDiaUTC(dataLocal: string): string {
  return new Date(`${dataLocal}T00:00:00`).toISOString()
}

/** Data local (`YYYY-MM-DD`) → instante UTC do FIM desse dia (23:59:59 local). */
export function fimDoDiaUTC(dataLocal: string): string {
  return new Date(`${dataLocal}T23:59:59`).toISOString()
}

/** `YYYY-MM-DD` de hoje (parâmetro `inicio` do endpoint de slots, que é `date`). */
export function hojeISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** `YYYY-MM-DD` daqui a `dias` (aceita negativo para o passado). */
export function emDiasISO(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** `YYYY-MM-DD` local da segunda-feira da semana que contém hoje. */
export function inicioDaSemanaISO(): string {
  const d = new Date()
  const diaSemana = d.getDay() // 0 = domingo
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana
  d.setDate(d.getDate() + offset)
  return paraISO(d)
}

/** `YYYY-MM-DD` local do domingo da semana que contém hoje. */
export function fimDaSemanaISO(): string {
  const d = new Date()
  const diaSemana = d.getDay()
  const offset = diaSemana === 0 ? 0 : 7 - diaSemana
  d.setDate(d.getDate() + offset)
  return paraISO(d)
}

/**
 * Até onde é possível marcar — e, por consequência, até onde a agenda da profissional
 * PRECISA enxergar. As duas pontas leem esta constante porque elas formam uma invariante:
 * toda sessão que a usuária consegue marcar tem de aparecer para quem vai atendê-la.
 *
 * Já quebrou uma vez: a usuária tinha teto fixo de 30 dias, igual à janela da agenda; ao
 * trocar por navegação semana a semana o teto sumiu de um lado só, e sessões marcadas para
 * além de 30 dias ficaram invisíveis no backoffice. Mexer aqui move as duas juntas.
 */
export const HORIZONTE_AGENDAMENTO_DIAS = 90

/** Quantas semanas de navegação cabem no horizonte (teto do "próxima semana"). */
export const HORIZONTE_AGENDAMENTO_SEMANAS = Math.floor(HORIZONTE_AGENDAMENTO_DIAS / 7)

/**
 * Instante UTC do início do mês corrente (dia 1, 00:00 local) — mesma conversão cuidadosa de
 * `inicioDoDiaUTC` (a data local não é a mesma coisa que a data UTC).
 */
export function inicioDoMesUTC(): string {
  const d = new Date()
  return inicioDoDiaUTC(paraISO(new Date(d.getFullYear(), d.getMonth(), 1)))
}

/** Instante UTC do fim do mês corrente (último dia, 23:59:59 local). */
export function fimDoMesUTC(): string {
  const d = new Date()
  return fimDoDiaUTC(paraISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)))
}

/**
 * Valor em reais: `R$ 250,00`. Valores fora de uma faixa plausível (negativos ou absurdos,
 * como o `-1.79e308` que um mock devolve por padrão em campos `double`) viram `null` — é
 * melhor omitir o preço do que estampar um número sem sentido na tela.
 */
export function reais(valor: number): string | null {
  if (!Number.isFinite(valor) || valor < 0 || valor > 1_000_000) return null
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Rótulo + faixa de horas (local) de cada período do dia, nesta ordem de exibição. */
export const PERIODOS = [
  { chave: 'manha', rotulo: 'Manhã', de: 0, ate: 12 },
  { chave: 'tarde', rotulo: 'Tarde', de: 12, ate: 18 },
  { chave: 'noite', rotulo: 'Noite', de: 18, ate: 24 },
] as const

export type PeriodoChave = (typeof PERIODOS)[number]['chave']

/**
 * Agrupa slots (já ordenados por `inicio`) em Manhã/Tarde/Noite pelo horário LOCAL de início —
 * só para dar hierarquia visual dentro do dia; não muda o que já veio filtrado do backend.
 * Períodos sem nenhum slot ficam de fora do resultado.
 */
export function porPeriodo<T extends { inicio: string }>(slots: T[]): { chave: PeriodoChave; rotulo: string; slots: T[] }[] {
  const grupos = PERIODOS.map((p) => ({ ...p, slots: [] as T[] }))
  for (const s of slots) {
    const h = new Date(s.inicio).getHours()
    const grupo = grupos.find((g) => h >= g.de && h < g.ate)
    ;(grupo ?? grupos[grupos.length - 1]).slots.push(s)
  }
  return grupos.filter((g) => g.slots.length > 0)
}

/**
 * "3 dias" / "amanhã" / "hoje" — forma CURTA, para selos onde o rótulo já dá o contexto
 * (ex.: a pill "4 dias" no card da próxima sessão). Arredonda pelo dia LOCAL (não pela
 * diferença exata em horas). `null` se o instante já passou.
 *
 * Para frases, use `quandoAcontece`: concatenar esta aqui produz "começa em hoje" e
 * "é 3 dias", porque só a forma numérica pede a preposição.
 */
export function diasAte(iso: string): string | null {
  const hoje = new Date()
  const dia = new Date(iso)
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const inicioDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate())
  const dias = Math.round((inicioDia.getTime() - inicioHoje.getTime()) / 86_400_000)
  if (dias < 0) return null
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `${dias} dias`
}

/**
 * Igual a `diasAte`, mas já pronto para entrar numa FRASE: "hoje" / "amanhã" / "em 3 dias".
 *
 * A preposição pertence à contagem, não ao texto ao redor — é o que evita "Começa em hoje"
 * (com o "em" fixo na frase) e "Sua próxima sessão é 3 dias" (sem ele). Quem monta a frase
 * escreve só "Começa {quandoAcontece}" / "…é {quandoAcontece}" e os três casos saem certos.
 */
export function quandoAcontece(iso: string): string | null {
  const curto = diasAte(iso)
  if (curto == null) return null
  return curto === 'hoje' || curto === 'amanhã' ? curto : `em ${curto}`
}

/**
 * A janela de slots que as telas de escolha de horário pedem — os 90 dias inteiros, de uma
 * vez só. É exatamente o teto que o contrato permite consultar (`JANELA_MUITO_LONGA` acima
 * disso), e é o que faz o calendário abrir já no primeiro mês com vaga: com o horizonte
 * todo em mãos, trocar de mês e de dia é derivação, não requisição.
 *
 * `fim` usa `DIAS - 1` porque o intervalo é inclusivo nas duas pontas: de hoje a `hoje+90`
 * seriam 91 dias, e o backend recusaria.
 */
export function janelaDoHorizonte(): { inicio: string; fim: string } {
  return { inicio: hojeISO(), fim: emDiasISO(HORIZONTE_AGENDAMENTO_DIAS - 1) }
}

/**
 * Distância em MESES de calendário entre hoje e uma data local (`YYYY-MM-DD`) — 0 é este
 * mês, 1 o que vem. Conta viradas de mês, não dias: 31/08 e 01/09 distam 1, apesar de um
 * dia. É o que traduz "o primeiro slot cai em setembro" para o offset que o calendário usa.
 */
export function offsetDeMes(dataLocal: string): number {
  const hoje = new Date()
  const ano = Number(dataLocal.slice(0, 4))
  const mes = Number(dataLocal.slice(5, 7)) - 1
  return (ano - hoje.getFullYear()) * 12 + (mes - hoje.getMonth())
}

/** Último mês navegável: o mês em que o horizonte termina (teto do "próximo mês"). */
export function mesesDoHorizonte(): number {
  return offsetDeMes(janelaDoHorizonte().fim)
}

/** Rótulos das colunas do calendário, na ordem em que `mesISO` monta a grade. */
export const DIAS_DA_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const

/**
 * O mês `hoje + offsetMeses` pronto para virar calendário: a janela `inicio`/`fim` que vai
 * na busca de slots, o rótulo do cabeçalho ("agosto de 2026") e a GRADE já paginada em
 * semanas de segunda a domingo.
 *
 * `dias` vem com `null` nas casas antes do dia 1 — são os buracos da primeira semana, que o
 * calendário desenha vazios para o dia 1 cair na coluna do seu dia da semana. Cada casa
 * preenchida é `YYYY-MM-DD` local, a mesma chave de `chaveDoDia`, então dá para cruzar com
 * os slots sem reconverter fuso no meio do caminho.
 */
export function mesISO(offsetMeses: number): {
  inicio: string
  fim: string
  rotulo: string
  dias: (string | null)[]
} {
  const hoje = new Date()
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() + offsetMeses, 1)
  const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0)

  // getDay() é domingo-first (0); a grade é segunda-first, daí o domingo virar a 7ª casa.
  const diaDaSemana = primeiro.getDay()
  const buracos = diaDaSemana === 0 ? 6 : diaDaSemana - 1
  const dias: (string | null)[] = Array.from({ length: buracos }, () => null)
  for (let d = 1; d <= ultimo.getDate(); d++) {
    dias.push(paraISO(new Date(primeiro.getFullYear(), primeiro.getMonth(), d)))
  }

  return {
    inicio: paraISO(primeiro),
    fim: paraISO(ultimo),
    rotulo: primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    dias,
  }
}
