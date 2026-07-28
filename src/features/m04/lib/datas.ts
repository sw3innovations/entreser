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

/**
 * Valor em reais: `R$ 250,00`. Valores fora de uma faixa plausível (negativos ou absurdos,
 * como o `-1.79e308` que um mock devolve por padrão em campos `double`) viram `null` — é
 * melhor omitir o preço do que estampar um número sem sentido na tela.
 */
export function reais(valor: number): string | null {
  if (!Number.isFinite(valor) || valor < 0 || valor > 1_000_000) return null
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
