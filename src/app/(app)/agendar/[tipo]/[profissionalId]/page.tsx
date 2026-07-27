import { PerfilProfissionalView } from '@/features/m04/usuaria/perfil-profissional-view'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']

/** U3 · Perfil da profissional. */
export default async function PerfilPage({
  params,
}: {
  params: Promise<{ tipo: string; profissionalId: string }>
}) {
  const { tipo, profissionalId } = await params
  return <PerfilProfissionalView tipo={tipo as TipoSessao} profissionalId={profissionalId} />
}
