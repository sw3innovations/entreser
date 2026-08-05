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

/** `YYYY-MM-DD` daqui a `dias` (janela da U4 — D24: próximos 30 dias). */
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
 * "3 dias" / "amanhã" / "hoje" até um instante futuro, arredondado pelo dia LOCAL (não pela
 * diferença exata em horas) — para a pill "Começa em…" do detalhe da sessão. `null` se o
 * instante já passou (a tela não mostra "começa em -1 dias").
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
