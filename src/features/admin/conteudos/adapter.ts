import type { FormatoConteudoApi } from '@/lib/api/types'
import type { Conteudo, ConteudoInput, Formato } from './types'

/** Tag aninhada dentro de um Conteudo do backend. */
interface TagRef {
  id: string
  nome?: string
}

/**
 * Conteúdo como o backend devolve. Desde 14/jul o DTO da LISTA (`GET /admin/conteudos`)
 * é enxuto — sem `corpoArtigo`, `mediaUrl` nem `tags`; só o by-id
 * (`GET /admin/conteudos/{id}`) traz o conteúdo completo. Por isso esses campos
 * são opcionais aqui; `conteudoFromApi` já cai em default quando ausentes.
 *
 * ATENÇÃO: um objeto vindo da lista NÃO serve para montar um `PATCH` (que exige
 * o objeto completo) — os defaults vazios apagariam os campos ausentes no banco.
 * Releia pelo by-id antes. Ver `togglePublish`.
 */
export interface ConteudoApi {
  id: string
  titulo: string
  descricao: string | null
  formato: FormatoConteudoApi
  duracaoMinutos: number | null
  corpoArtigo?: string | null
  mediaUrl?: string | null
  thumbUrl: string | null
  publicado: boolean
  publicadoEm: string | null
  criadoEm: string
  atualizadoEm: string
  tags?: TagRef[] | null
}

/** Corpo de `POST`/`PATCH /admin/conteudos` (schema `ConteudoRequest`). */
export interface ConteudoRequest {
  titulo: string
  descricao: string
  formato: FormatoConteudoApi
  duracaoMinutos: number | null
  corpoArtigo: string
  mediaUrl: string | null
  thumbUrl: string | null
  publicado: boolean
  tagIds: string[]
}

// O backend mantém o formato em PascalCase; o domínio usa minúsculas. Mapa
// explícito (um toLowerCase/Capitalize cego seria frágil a novos valores).
const FORMATO_TO_API: Record<Formato, FormatoConteudoApi> = {
  artigo: 'Artigo',
  video: 'Video',
  audio: 'Audio',
  imagem: 'Imagem',
}
const FORMATO_FROM_API: Record<FormatoConteudoApi, Formato> = {
  Artigo: 'artigo',
  Video: 'video',
  Audio: 'audio',
  Imagem: 'imagem',
}

export function formatoToApi(f: Formato): FormatoConteudoApi {
  return FORMATO_TO_API[f]
}
export function formatoFromApi(f: string): Formato {
  return FORMATO_FROM_API[f as FormatoConteudoApi] ?? 'artigo'
}

/** Backend → domínio. `tags` vem como objetos; o domínio guarda só os ids. */
export function conteudoFromApi(c: ConteudoApi): Conteudo {
  return {
    id: c.id,
    titulo: c.titulo,
    descricao: c.descricao ?? '',
    formato: formatoFromApi(c.formato),
    publicado: c.publicado,
    tags: (c.tags ?? []).map((t) => t.id),
    duracao: c.duracaoMinutos ?? null,
    corpo: c.corpoArtigo ?? '',
    media: c.mediaUrl ?? null,
    thumb: c.thumbUrl ?? null,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
    publicadoEm: c.publicadoEm ?? null,
  }
}

/** Domínio (input do formulário) → corpo do request. `tags` (ids) → `tagIds`. */
export function conteudoToRequest(input: ConteudoInput): ConteudoRequest {
  return {
    titulo: input.titulo.trim(),
    descricao: input.descricao,
    formato: formatoToApi(input.formato),
    duracaoMinutos: input.duracao,
    corpoArtigo: input.corpo,
    mediaUrl: input.media,
    thumbUrl: input.thumb,
    publicado: input.publicado,
    tagIds: input.tags,
  }
}
