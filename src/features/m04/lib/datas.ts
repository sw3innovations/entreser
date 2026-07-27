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

/** Valor em reais: `R$ 250,00`. */
export function reais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
