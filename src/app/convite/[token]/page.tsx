import { ConviteView } from '@/features/m04/usuaria/convite-view'

/**
 * U13 · Aceitar convite de casal. Rota PÚBLICA de propósito — fica fora do grupo `(app)`
 * para não passar pelo guard: quem recebe o convite pode ainda não ter conta.
 */
export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ConviteView token={token} />
}
