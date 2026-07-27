'use client'

interface VerMaisProps {
  /** Quantos já estão na tela (`itens.length`). */
  carregado: number
  /** Total do servidor (`totalElements`). */
  total: number
  carregando: boolean
  onVerMais: () => void
}

/**
 * Peça (c) da camada de estados (D19): "Ver mais" (não scroll infinito). Mostra a
 * posição por `total` do servidor — "Mostrando 20 de 137" —, nunca por contagem da
 * página. Quem decide se aparece é a tela (`temMais`).
 */
export function VerMais({ carregado, total, carregando, onVerMais }: VerMaisProps) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onVerMais}
        disabled={carregando}
        className="rounded-pill border border-mauve/25 bg-white px-5 py-2.5 text-sm font-medium text-mauve transition-es hover:bg-mauve-ghost disabled:opacity-60"
      >
        {carregando ? 'Carregando…' : 'Ver mais'}
      </button>
      <span className="text-xs text-plum/40">
        Mostrando {carregado} de {total}
      </span>
    </div>
  )
}
