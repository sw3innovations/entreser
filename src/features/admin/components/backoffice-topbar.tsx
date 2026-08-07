'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ESAvatar, LockIcon, LogoutIcon, PanelLeftIcon, SinoIcon } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useNovidades } from '@/features/m04/ui/use-novidades'
import type { BackofficeProfile } from './backoffice-nav'

interface BackofficeTopbarProps {
  user: { name: string; email: string }
  profile: BackofficeProfile
  collapsed: boolean
  onToggleCollapse: () => void
  onLogout: () => void
}

/**
 * Topbar do backoffice — botão de recolher a sidebar, identidade da pessoa
 * logada e menu (Trocar senha / Sair). Fundo "glass".
 */
export function BackofficeTopbar({
  user,
  profile,
  collapsed,
  onToggleCollapse,
  onLogout,
}: BackofficeTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const tipo = profile === 'admin' ? 'Admin Geral' : 'Profissional'

  // Fecha o menu ao clicar em qualquer lugar fora dele ou ao pressionar Escape.
  // (Um overlay `fixed` não serve aqui: o `backdrop-blur` do header vira o bloco
  // de contenção de descendentes fixed, prendendo-o à altura do header.)
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const goChangePassword = () => {
    setMenuOpen(false)
    router.push(profile === 'prof' ? '/admin/perfil/senha' : '/admin/recuperar-senha')
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3.5 border-b border-plum/7 bg-white/85 px-8 backdrop-blur-[12px]">
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-plum/60 transition-colors hover:bg-plum/5"
      >
        <PanelLeftIcon size={20} />
      </button>

      <div className="ml-auto flex items-center gap-3">
        {/* Só a profissional tem agenda — para o Admin Geral o sino não teria o que dizer. */}
        {profile === 'prof' && <SinoNovidades />}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-pill px-1.5 py-1"
        >
          <div className="text-right leading-tight">
            <div className="text-[13.5px] font-semibold text-plum">{user.name}</div>
            <div className="text-[11.5px] text-plum/50">{tipo}</div>
          </div>
          <ESAvatar name={user.name} size="sm" isBordered />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-[31] w-[236px] rounded-2xl border border-plum/6 bg-white p-2 shadow-modal">
            <div className="mb-1.5 border-b border-plum/6 px-3 pb-2.5 pt-2">
              <div className="text-[13.5px] font-semibold text-plum">{user.name}</div>
              <div className="truncate text-xs text-plum/50">{user.email}</div>
            </div>
            <MenuRow icon={<LockIcon size={18} />} label="Trocar senha" onClick={goChangePassword} />
            <MenuRow
              icon={<LogoutIcon size={18} />}
              label="Sair"
              danger
              onClick={() => {
                setMenuOpen(false)
                onLogout()
              }}
            />
          </div>
        )}
      </div>
      </div>
    </header>
  )
}

/**
 * Sino do backoffice — espelha o da usuária (`usuaria-header.tsx`). O cancelamento chegava
 * só por e-mail; dentro do app a sessão sumia da lista e ela podia não ver que abriu um
 * buraco na agenda.
 */
function SinoNovidades() {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { novidades, naoVistas, marcarComoVistas } = useNovidades('profissional')

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const alternar = () => {
    if (!aberto) marcarComoVistas()
    setAberto((v) => !v)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={naoVistas > 0 ? `Notificações (${naoVistas} não lidas)` : 'Notificações'}
        className={cn(
          'relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-plum/60 transition-colors hover:bg-plum/5',
          aberto && 'bg-plum/5 text-plum',
        )}
      >
        <SinoIcon size={20} />
        {naoVistas > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-mauve ring-2 ring-white" />
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[31] w-[320px] overflow-hidden rounded-2xl border border-plum/6 bg-white shadow-modal"
        >
          <div className="border-b border-plum/8 px-4 py-3.5">
            <p className="text-sm font-medium text-plum">Notificações</p>
          </div>
          {novidades.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-mauve-ghost text-mauve">
                <SinoIcon size={20} />
              </span>
              <p className="mt-3 text-sm font-medium text-plum">Você está em dia</p>
              <p className="mt-1 text-xs leading-relaxed text-plum/45">
                Cancelamentos e avisos aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {novidades.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setAberto(false)}
                  className="flex flex-col gap-1 border-b border-plum/6 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-cream"
                >
                  <span className="text-[13.5px] font-medium text-plum">{n.titulo}</span>
                  <span className="text-xs leading-relaxed text-plum/55">{n.descricao}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MenuRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left font-body text-sm font-medium transition-colors',
        danger ? 'text-red-alert hover:bg-red-alert/8' : 'text-plum/75 hover:bg-plum/[0.04]',
      )}
    >
      <span className={cn('inline-flex', danger ? 'text-red-alert' : 'text-plum/45')}>{icon}</span>
      {label}
    </button>
  )
}
