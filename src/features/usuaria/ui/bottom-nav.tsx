'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface BottomNavItem {
  key: string
  label: string
  href: string
  icon: ReactNode
  /** Outras rotas que acendem esta aba (ver `USUARIA_NAV`). */
  alias?: string[]
}

interface BottomNavProps {
  items: BottomNavItem[]
  className?: string
}

/**
 * Item ativo por maior prefixo de href casado com o pathname atual. Exportado
 * para a sidebar (desktop) reusar a mesma lógica. `/conteudos/x` e `/onboarding`
 * escondem a nav, então o casamento serve às abas reais.
 */
export function getActiveKey(items: BottomNavItem[], pathname: string): string | null {
  let best: { key: string; len: number } | null = null
  for (const item of items) {
    for (const href of [item.href, ...(item.alias ?? [])]) {
      const matches = pathname === href || pathname.startsWith(`${href}/`)
      if (matches && (!best || href.length > best.len)) {
        best = { key: item.key, len: href.length }
      }
    }
  }
  return best?.key ?? null
}

/**
 * BottomNav — barra de navegação inferior em vidro fosco, fixa. Reimplementa a
 * pílula do item ativo em CSS puro (sem framer-motion, ausente neste projeto).
 */
export function BottomNav({ items, className }: BottomNavProps) {
  const pathname = usePathname()
  const active = getActiveKey(items, pathname)

  return (
    <nav className={cn('fixed bottom-0 left-0 z-50 w-full', className)} aria-label="Navegação principal">
      <div className="mx-auto mb-3 w-full max-w-lg px-3">
        <div className="rounded-2xl border border-white/50 bg-white/70 shadow-glass backdrop-blur-2xl">
          <div className="flex items-center justify-around px-2 py-1.5">
            {items.map((item) => {
              const isActive = item.key === active
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex h-14 w-16 flex-col items-center justify-center rounded-xl transition-es"
                >
                  {isActive && <span className="absolute inset-0 rounded-xl bg-mauve/10" aria-hidden />}
                  <span
                    className={cn(
                      'relative z-10 transition-es [&>svg]:h-[22px] [&>svg]:w-[22px]',
                      isActive ? 'text-mauve' : 'text-plum/35',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      'relative z-10 mt-0.5 text-[10px] leading-tight transition-es',
                      isActive ? 'font-semibold text-mauve' : 'font-medium text-plum/35',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
