export type Formato = 'artigo' | 'video' | 'audio' | 'imagem'

/** Conteúdo da biblioteca (M05): artigo (markdown), vídeo ou áudio. */
export interface Conteudo {
  id: string
  titulo: string
  descricao: string
  formato: Formato
  publicado: boolean
  /** Ids das tags. */
  tags: string[]
  /** Duração estimada em minutos (opcional). */
  duracao: number | null
  /** Corpo em Markdown (só artigo). */
  corpo: string
  /** Nome do arquivo de mídia (vídeo/áudio). */
  media: string | null
  /** Data URL da capa (opcional). */
  thumb: string | null
  criadoEm: string
  atualizadoEm: string
  publicadoEm: string | null
}

export interface ConteudoInput {
  formato: Formato
  titulo: string
  descricao: string
  duracao: number | null
  corpo: string
  media: string | null
  thumb: string | null
  tags: string[]
  publicado: boolean
}
