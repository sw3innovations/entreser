import { SessaoDetalheProfView } from '@/features/m04/profissional/sessao-detalhe-prof-view'

/** P2 · Detalhe da sessão (PF5) — com o registro (P3) como overlay. */
export default async function SessaoProfPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params
  return <SessaoDetalheProfView sessaoId={sessaoId} />
}
