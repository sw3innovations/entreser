import { SessaoDetalheView } from '@/features/m04/usuaria/sessao-detalhe-view'

/** U10 · Detalhe da sessão — onde a marcação aterrissa (UF7). */
export default async function SessaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessaoId: string }>
  searchParams: Promise<{ origem?: string }>
}) {
  const { sessaoId } = await params
  const { origem } = await searchParams
  return <SessaoDetalheView sessaoId={sessaoId} vindaDaConfirmacao={origem === 'confirmacao'} />
}
