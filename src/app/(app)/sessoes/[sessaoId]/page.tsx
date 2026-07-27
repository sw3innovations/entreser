import { SessaoDetalheView } from '@/features/m04/usuaria/sessao-detalhe-view'

/** U10 · Detalhe da sessão — onde a marcação aterrissa (UF7). */
export default async function SessaoPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params
  return <SessaoDetalheView sessaoId={sessaoId} />
}
