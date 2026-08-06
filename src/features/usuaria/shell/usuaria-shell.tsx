'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BottomNav } from '../ui'
import { UsuariaHeader } from './usuaria-header'
import { USUARIA_NAV_MOBILE, NAV_FULLSCREEN_PREFIXES, BOTTOMNAV_HIDDEN_PREFIXES } from './usuaria-nav'

/**
 * UsuariaShell — casca responsiva do app autenticado da Usuária (M05).
 *
 * - Desktop (lg+): header flutuante no topo (sticky); conteúdo em largura total.
 * - Mobile: BottomNav fixa embaixo; espaço inferior reservado (`pb-24`).
 *
 * O header some só no leitor de conteúdo e no onboarding (`NAV_FULLSCREEN_PREFIXES` —
 * telas realmente full-screen, sem chrome em tamanho nenhum). A BottomNav some também
 * nos fluxos do M04 (`BOTTOMNAV_HIDDEN_PREFIXES`), que têm barra de ação fixa no mobile —
 * mas essas mantêm o header no desktop, senão a tela fica sem chrome nenhum lá em cima.
 */
export function UsuariaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const hideHeader = NAV_FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p))
  const hideBottomNav = BOTTOMNAV_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))

  return (
    <div className={cn('min-h-dvh bg-canvas', !hideBottomNav && 'pb-24 lg:pb-0')}>
      {!hideHeader && <UsuariaHeader />}
      {children}
      {!hideBottomNav && <BottomNav items={USUARIA_NAV_MOBILE} className="lg:hidden" />}
    </div>
  )
}
