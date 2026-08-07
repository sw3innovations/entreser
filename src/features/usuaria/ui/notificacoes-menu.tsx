'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/lib/use-hydrated'
import { useNovidades } from '@/features/m04/ui/use-novidades'
import { BellIcon } from './icons'

/**
 * Sino de notificações da Usuária — botão com indicador de não-lidas, abrindo um painel
 * com o que aconteceu sem ela pedir. Hoje isso é cancelamento de sessão (ver
 * `useNovidades`): o e-mail sempre saiu, mas dentro do app não sobrava rastro.
 *
 * Vive fora do header porque aparece em dois lugares: no header do desktop e no hero da
 * home no mobile, onde não existe barra superior. Duplicar o painel nos dois seria pedir
 * para eles divergirem.
 *
 * `tom="escuro"` é para fundos plum (o hero); `claro` para a barra branca do desktop. Só o
 * BOTÃO muda — o painel é branco nos dois, porque é uma superfície sobreposta.
 */
export function NotificacoesMenu({ tom = 'claro' }: { tom?: 'claro' | 'escuro' }) {
  const [aberto, setAberto] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const hidratado = useHydrated()
  const { novidades, naoVistas, marcarComoVistas } = useNovidades('usuaria')

  /**
   * Ancora o painel abaixo do sino, em coordenadas de viewport (ele vive em portal).
   *
   * O `width === 0` não é paranoia: este componente monta DUAS vezes por página — no header
   * (`hidden lg:block`) e no hero da home (`lg:hidden`) —, então num dos dois o botão está
   * sempre com `display:none` e devolve um rect zerado. Sem a guarda, esse ancorava o painel
   * em `left: -320` (fora da tela à esquerda).
   */
  const posicionar = useCallback(() => {
    const r = botaoRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }, [])

  useEffect(() => {
    if (!aberto) return
    posicionar()
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node
      // O painel está em portal, fora da árvore do botão: sem checar os dois, clicar
      // DENTRO da lista fecharia o menu antes de o link navegar.
      if (botaoRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return
      setAberto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    // `true` no scroll: o evento não borbulha, e o hero pode rolar dentro de um ancestral.
    window.addEventListener('scroll', posicionar, true)
    window.addEventListener('resize', posicionar)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', posicionar, true)
      window.removeEventListener('resize', posicionar)
    }
  }, [aberto, posicionar])

  const alternar = () => {
    // Abrir é ler: quem viu a lista viu tudo o que estava nela.
    if (!aberto) marcarComoVistas()
    setAberto((v) => !v)
  }

  const escuro = tom === 'escuro'

  const painel = (
    <div
      ref={painelRef}
      role="menu"
      style={{ top: pos?.top, right: pos?.right }}
      className="fixed z-[1000] w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-plum/8 bg-white shadow-modal"
    >
      <div className="flex items-center justify-between border-b border-plum/8 px-4 py-3.5">
        <p className="text-sm font-medium text-plum">Notificações</p>
      </div>
      {novidades.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-mauve-ghost text-mauve">
            <BellIcon size={20} />
          </span>
          <p className="mt-3 text-sm font-medium text-plum">Você está em dia</p>
          <p className="mt-1 text-xs leading-relaxed text-plum/45">
            Novas atividades e lembretes aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {novidades.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => setAberto(false)}
              className="flex flex-col gap-1 border-b border-plum/6 px-4 py-3.5 transition-es last:border-b-0 hover:bg-cream"
            >
              <span className="text-[13.5px] font-medium text-plum">{n.titulo}</span>
              <span className="text-xs leading-relaxed text-plum/55">{n.descricao}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={naoVistas > 0 ? `Notificações (${naoVistas} não lidas)` : 'Notificações'}
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-es',
          escuro
            ? 'border-white/20 text-cream/80 hover:bg-white/10 hover:text-cream'
            : 'border-plum/12 text-plum/55 hover:border-plum/20 hover:bg-plum/5 hover:text-plum',
          aberto && (escuro ? 'bg-white/10 text-cream' : 'border-plum/20 bg-plum/5 text-plum'),
        )}
      >
        <BellIcon size={20} />
        {naoVistas > 0 && (
          <span
            className={cn(
              'absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-mauve ring-2',
              escuro ? 'ring-plum' : 'ring-white',
            )}
          />
        )}
      </button>

      {/* Em portal no <body>, e não `absolute` aqui dentro: o `PlumHero` da home é
          `relative overflow-hidden` (precisa disso para conter os orbs do gradiente), e
          recortava o painel na borda do hero. Portal é imune a overflow e a qualquer
          ancestral com transform/filter, que também quebrariam o posicionamento. */}
      {aberto && hidratado && pos && createPortal(painel, document.body)}
    </div>
  )
}
