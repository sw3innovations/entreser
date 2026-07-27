import { SalaView } from '@/features/m04/profissional/sala-view'

/** P8 · Sala com problema (D14) — link manual do Meet. */
export default async function SalaPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params
  return <SalaView sessaoId={sessaoId} />
}
