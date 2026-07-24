import type { Formato } from '@/features/admin/conteudos/types'

/** Rótulo de exibição do formato de conteúdo. */
export const FORMATO_LABEL: Record<Formato, string> = {
  artigo: 'Artigo',
  video: 'Vídeo',
  audio: 'Áudio',
  imagem: 'Imagem',
}

/**
 * Duração humanizada. Artigo → "leitura"; vídeo/áudio → tempo real.
 * Retorna `undefined` quando não há duração (o card oculta o selo).
 */
export function formatDuracao(formato: Formato, minutos: number | null | undefined): string | undefined {
  if (!minutos || minutos <= 0) return undefined
  return formato === 'artigo' ? `${minutos} min de leitura` : `${minutos} min`
}

/** Rota do leitor de um conteúdo. Ponto único — evita `/conteudos/${id}` espalhado. */
export function conteudoHref(id: string): string {
  return `/conteudos/${id}`
}

/**
 * View-model de um item de conteúdo para os cards/listas da Usuária. Desacopla
 * os componentes de UI dos DTOs de domínio (feed, trilha, busca), que mapeiam
 * para esta forma via os adapters de cada slice.
 */
export interface ContentItemVM {
  id: string
  title: string
  formato: Formato
  /** Já formatada (ex.: "5 min de leitura"). */
  duration?: string
  /** Linha auxiliar (ex.: nome da fase ou tags). */
  meta?: string
  thumbUrl?: string | null
  consumido?: boolean
  href: string
}
