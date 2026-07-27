import { ReagendarView } from '@/features/m04/usuaria/reagendar-view'

/** U12 · Reagendar sessão (UF9). */
export default async function ReagendarPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params
  return <ReagendarView sessaoId={sessaoId} />
}
