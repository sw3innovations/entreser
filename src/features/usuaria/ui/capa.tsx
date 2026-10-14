import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * As duas ilustrações do redesenho — casal acolhido por uma psicóloga. Entram como capa
 * PADRÃO quando o conteúdo, a trilha ou o banner não têm imagem própria.
 *
 * Curadoria: nenhuma das duas mostra gestante nem bebê, de propósito. Para quem está em
 * tratamento ou passou por uma perda, essas imagens podem ser gatilho (alerta do documento
 * de UX). Ao trocar ou acrescentar ilustrações aqui, manter essa regra.
 */
export const ILUSTRACOES = ['/ilustracoes/acolhimento-ameixa.jpg', '/ilustracoes/acolhimento-verde.jpg'] as const

/** Escolha estável por id — o mesmo conteúdo sempre ganha a mesma ilustração. */
export function ilustracaoPara(chave: string): string {
  let h = 0
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) | 0
  return ILUSTRACOES[Math.abs(h) % ILUSTRACOES.length]
}

/**
 * Capa — imagem que preenche o bloco (`object-cover`), com selo opcional no canto e
 * véu escuro opcional por baixo do texto. Sem `src`, usa a ilustração estável da `chave`.
 */
export function Capa({
  src,
  chave,
  alt = '',
  selo,
  veu = false,
  posicao,
  className,
  children,
}: {
  src?: string | null
  chave: string
  alt?: string
  selo?: string
  /** Gradiente ameixa de baixo para cima, para texto claro sobre a imagem. */
  veu?: boolean
  posicao?: string
  className?: string
  children?: ReactNode
}) {
  const url = src && /^https?:\/\//i.test(src) ? src : ilustracaoPara(chave)
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={posicao ? { objectPosition: posicao } : undefined} />
      {veu && (
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(45,24,64,0)_22%,rgba(45,24,64,0.9)_100%)]" />
      )}
      {selo && (
        <span className="absolute left-2.5 top-2.5 rounded-full bg-[rgba(255,253,250,0.92)] px-[9px] py-1 text-[10.5px] font-semibold text-plum">
          {selo}
        </span>
      )}
      {children}
    </div>
  )
}
