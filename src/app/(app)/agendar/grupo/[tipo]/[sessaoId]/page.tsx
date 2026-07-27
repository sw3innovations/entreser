import { GrupoDetalheView } from '@/features/m04/usuaria/grupo-detalhe-view'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']

/** U8 · Detalhe da sessão de grupo, antes de entrar (D22). */
export default async function GrupoDetalhePage({
  params,
}: {
  params: Promise<{ tipo: string; sessaoId: string }>
}) {
  const { tipo, sessaoId } = await params
  return <GrupoDetalheView tipo={tipo as TipoSessao} sessaoId={sessaoId} />
}
