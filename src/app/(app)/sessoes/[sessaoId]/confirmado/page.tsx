import { ConfirmacaoView, type ContextoConfirmacao } from '@/features/m04/usuaria/confirmacao-view'

/** U5b/U12b · Sucesso pós-marcação/reagendamento (#4/#5). */
export default async function ConfirmadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessaoId: string }>
  searchParams: Promise<{ ctx?: string }>
}) {
  const { sessaoId } = await params
  const { ctx } = await searchParams
  const contexto: ContextoConfirmacao = ctx === 'reagendamento' ? 'reagendamento' : 'agendamento'
  return <ConfirmacaoView sessaoId={sessaoId} ctx={contexto} />
}
