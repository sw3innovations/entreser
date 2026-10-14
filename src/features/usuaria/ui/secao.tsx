import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Secao — bloco com título serifado e, opcionalmente, um "ver mais" à direita. É a unidade
 * de hierarquia das telas redesenhadas: cada tela é uma sequência fixa delas, na ordem do
 * que importa primeiro.
 *
 * `sangrar` deixa os filhos ocuparem a largura toda (carrosséis) enquanto o título continua
 * alinhado à coluna.
 */
export function Secao({
  titulo,
  link,
  descricao,
  children,
  className,
}: {
  titulo: string
  link?: { href: string; rotulo: string }
  descricao?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('pt-7', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[22px] font-medium leading-tight text-plum">{titulo}</h2>
        {link && (
          <Link href={link.href} className="shrink-0 text-[12.5px] font-semibold text-mauve hover:text-mauve-dark">
            {link.rotulo} →
          </Link>
        )}
      </div>
      {descricao && <p className="-mt-1.5 mb-3 text-[12.5px] text-plum/55">{descricao}</p>}
      {children}
    </section>
  )
}

/**
 * Carrossel horizontal que sangra até a borda da tela no mobile (o primeiro card começa
 * alinhado à coluna; o último encosta na borda e sugere que há mais). No desktop vira grade.
 */
export function Carrossel({
  children,
  className,
  grade = 'lg:grid-cols-4',
}: {
  children: ReactNode
  className?: string
  grade?: string
}) {
  return (
    <div
      className={cn(
        '-mx-[22px] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[22px] pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'lg:mx-0 lg:grid lg:overflow-visible lg:px-0',
        grade,
        className,
      )}
    >
      {children}
    </div>
  )
}
