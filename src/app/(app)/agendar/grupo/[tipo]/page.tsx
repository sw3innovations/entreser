import { GruposView } from '@/features/m04/usuaria/grupos-view'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']

/** U7 · Sessões de grupo abertas do tipo escolhido (UF5). */
export default async function GruposPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  return <GruposView tipo={tipo as TipoSessao} />
}
