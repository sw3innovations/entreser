import { AuthShell } from '@/features/auth/components/auth-shell'
import { FirstAccessForm } from '@/features/auth/components/first-access-form'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

/**
 * Primeiro acesso da profissional — destino do link do e-mail de convite
 * (`{appUrl}/primeiro-acesso?token=…`, montado no `EmailService` do backend). Rota
 * pública: quem chega aqui ainda não tem senha.
 */
export default async function PrimeiroAcessoPage({ searchParams }: PageProps) {
  const { token } = await searchParams
  return (
    <AuthShell subtitle="Primeiro acesso" back={{ href: '/admin/login' }}>
      <FirstAccessForm token={token} />
    </AuthShell>
  )
}
