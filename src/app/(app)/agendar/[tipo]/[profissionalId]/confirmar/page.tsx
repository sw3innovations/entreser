import { redirect } from 'next/navigation'
import { ConfirmarView } from '@/features/m04/usuaria/confirmar-view'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']

/**
 * U5 · Confirmar marcação. O slot escolhido vem por query (`inicio`/`fim`) — sem eles não
 * há o que confirmar, então volta para os horários.
 */
export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string; profissionalId: string }>
  searchParams: Promise<{ inicio?: string; fim?: string }>
}) {
  const { tipo, profissionalId } = await params
  const { inicio, fim } = await searchParams
  if (!inicio || !fim) redirect(`/agendar/${tipo}/${profissionalId}/horarios`)
  return <ConfirmarView tipo={tipo as TipoSessao} profissionalId={profissionalId} inicio={inicio} fim={fim} />
}
