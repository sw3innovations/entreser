'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/context/auth-context'
import { ToastProvider } from '@/components/ui'
import { UsuariaShell } from '@/features/usuaria/shell/usuaria-shell'
import { OnboardingGate } from '@/features/usuaria/shell/onboarding-gate'
import { NavHistoryProvider } from '@/features/usuaria/shell/nav-history'

/**
 * Guard + casca das rotas autenticadas da Usuária (M05).
 *
 * No frontend-only a proteção é feita no cliente, lendo a sessão do contexto.
 * Num backend real isto seria reforçado no servidor (proxy.ts otimista +
 * Data Access Layer chamado em cada page) — o cliente nunca é a fonte da
 * verdade de autorização.
 *
 * Autenticada: envolve tudo em `ToastProvider` (feedback das ações) →
 * `OnboardingGate` (redireciona para o onboarding quem ainda não tem fase) →
 * `UsuariaShell` (fundo + BottomNav do M05). Espelha `admin/(protected)/layout`.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth()
  const router = useRouter()

  // Cada perfil só na sua frente: além de exigir sessão, esta casca só admite Usuária.
  // O serviço já rejeita profissional/admin no login e na reidratação; aqui é defesa em
  // profundidade — uma sessão de outro perfil que chegue por qualquer caminho volta ao login.
  const perfilInvalido = status === 'authenticated' && user != null && user.perfil !== 'Usuaria'

  useEffect(() => {
    if (status === 'unauthenticated' || perfilInvalido) {
      router.replace('/login')
    }
  }, [status, perfilInvalido, router])

  if (status !== 'authenticated' || perfilInvalido) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-mauve">
        Carregando…
      </div>
    )
  }

  return (
    <ToastProvider>
      <NavHistoryProvider>
        <OnboardingGate>
          <UsuariaShell>{children}</UsuariaShell>
        </OnboardingGate>
      </NavHistoryProvider>
    </ToastProvider>
  )
}
