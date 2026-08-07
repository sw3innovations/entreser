'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/lib/use-hydrated'

export interface DialogProps {
  isOpen: boolean
  onClose?: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Rodapé (normalmente botões de ação). */
  footer?: ReactNode
  variant?: 'default' | 'destructive'
  /** Largura do painel em px. @default 440 */
  width?: number
  className?: string
}

/**
 * Dialog — modal centralizado com overlay, para confirmações e formulários curtos.
 * Renderizado em portal no <body> (imune a ancestrais com transform/overflow);
 * fecha no clique fora, no Escape e via onClose.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'default',
  width = 440,
  className,
}: DialogProps) {
  const hydrated = useHydrated()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen || !hydrated) return null

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-plum/[0.28] p-6 backdrop-blur-[3px]"
      style={{ animation: 'es-dialog-fade 0.2s ease' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn('w-full max-w-full overflow-hidden rounded-card bg-white shadow-modal', className)}
        style={{ width, animation: 'es-dialog-pop 0.22s cubic-bezier(0,0,0.2,1)' }}
      >
        {(title || description) && (
          <div className="px-6 pt-6">
            {title && (
              <h3
                className={cn(
                  'font-display text-[22px]',
                  variant === 'destructive' ? 'text-red-alert' : 'text-plum',
                )}
              >
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-2 text-sm leading-[1.55] text-plum/60">{description}</p>
            )}
          </div>
        )}
        {/* Sem `footer`, o respiro de baixo tem de vir daqui: senão o conteúdo encosta na
            borda do painel. Com rodapé, ele já traz o próprio `p-6` e repetir aqui dobraria
            o espaço entre conteúdo e botões. */}
        {children && <div className={cn('px-6 pt-4', footer ? undefined : 'pb-6')}>{children}</div>}
        {footer && <div className="mt-2 flex justify-end gap-2.5 p-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
