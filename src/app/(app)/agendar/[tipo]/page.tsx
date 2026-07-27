import { EscolherProfissionalView } from '@/features/m04/usuaria/escolher-profissional-view'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']

/** U2 · Profissionais que atendem o tipo (individual). `[tipo]` = código de TipoSessao. */
export default async function AgendarTipoPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  return <EscolherProfissionalView tipo={tipo as TipoSessao} />
}
