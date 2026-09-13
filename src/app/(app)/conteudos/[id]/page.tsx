import { ConteudoReaderView } from '@/features/usuaria/conteudos/conteudo-reader-view'

/** Leitor de conteúdo (UF6). Delegador fino — a lógica vive na view do slice. */
export default async function ConteudoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ trilha?: string }>
}) {
  const { id } = await params
  // `?trilha=` é o que transforma o leitor avulso em passo de um percurso (ver
  // `conteudoHref`). A chave inclui a trilha para remontar ao trocar de contexto também.
  const { trilha } = await searchParams
  return <ConteudoReaderView key={`${id}:${trilha ?? ''}`} id={id} trilhaId={trilha ?? null} />
}
