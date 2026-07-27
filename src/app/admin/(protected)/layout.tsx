'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ToastProvider } from '@/components/ui'
import { useAdminAuth } from '@/features/admin/context/admin-auth-context'
import { BackofficeShell } from '@/features/admin/components/backoffice-shell'

/**
 * Guard + casca das rotas autenticadas do backoffice.
 *
 * No frontend-only a proteção é no cliente (sessão do contexto). Num backend
 * real seria reforçada no servidor (proxy otimista + Data Access Layer com
 * checagem de `perfil`). Uma vez autenticada, envolve as páginas no
 * ToastProvider e na casca (sidebar + topbar). As páginas seguem podendo ser
 * Server Components — só a casca é cliente.
 */
/**
 * Rotas que a Profissional pode abrir. É uma ALLOWLIST de propósito: tudo o que não está
 * aqui é da equipe Entre Ser, e uma tela nova nasce protegida sem ninguém lembrar de
 * bloqueá-la. Esconder do menu (`NAV_PROF`) não basta — a URL é digitável.
 *
 * A proteção real é do backend, que autoriza por papel; isto evita que a profissional
 * caia numa tela que não é dela e veja erro em vez de conteúdo.
 */
const ROTAS_DA_PROFISSIONAL = ['/admin/agenda', '/admin/horarios', '/admin/bloqueios', '/admin/valores', '/admin/perfil']

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const { status, admin } = useAdminAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/admin/login')
    }
  }, [status, router])

  // Profissional fora do painel dela volta para a agenda.
  const foraDoPainel =
    status === 'authenticated' &&
    admin?.perfil === 'Profissional' &&
    !ROTAS_DA_PROFISSIONAL.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  useEffect(() => {
    if (foraDoPainel) router.replace('/admin/agenda')
  }, [foraDoPainel, router])

  if (status !== 'authenticated' || foraDoPainel) {
    return (
      <div className="bg-backoffice flex min-h-dvh items-center justify-center text-sm text-mauve">
        Carregando…
      </div>
    )
  }

  return (
    <ToastProvider>
      <BackofficeShell>{children}</BackofficeShell>
    </ToastProvider>
  )
}
