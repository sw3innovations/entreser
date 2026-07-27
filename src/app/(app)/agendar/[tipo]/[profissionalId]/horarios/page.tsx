import { HorariosView } from '@/features/m04/usuaria/horarios-view'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']

/** U4 · Horários disponíveis da profissional para o tipo escolhido. */
export default async function HorariosPage({
  params,
}: {
  params: Promise<{ tipo: string; profissionalId: string }>
}) {
  const { tipo, profissionalId } = await params
  return <HorariosView tipo={tipo as TipoSessao} profissionalId={profissionalId} />
}
