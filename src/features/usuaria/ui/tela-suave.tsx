import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * TelaSuave — o fundo das telas principais da Usuária depois do redesenho ("menos header,
 * mais conteúdo"). No lugar do hero ameixa, um VÉU: gradiente lilás → névoa → transparente
 * nos primeiros 320px, sobre o fundo `#F6F5F8`. O título da tela vive dentro do conteúdo,
 * não numa faixa colorida acima dele — é o que devolve o espaço para o que importa.
 *
 * `largura` alinha com o resto do app no desktop (`md` = coluna de leitura, `lg` = vitrine).
 */
export function TelaSuave({
  children,
  largura = 'lg',
  className,
}: {
  children: ReactNode
  largura?: 'md' | 'lg'
  className?: string
}) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#F6F5F8]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,#E7D7DF_0%,#EFE9F1_50%,rgba(246,245,248,0)_100%)]"
      />
      <div
        className={cn(
          'relative mx-auto w-full px-[22px] pb-10 pt-6 lg:pt-10',
          largura === 'md' ? 'max-w-3xl' : 'max-w-5xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** Eyebrow com ponto — "● PREPARAÇÃO · SEMANA 2". */
export function EyebrowPonto({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-[0.12em] text-mauve">
      <span className="h-[7px] w-[7px] rounded-full bg-mauve" aria-hidden />
      {children}
    </p>
  )
}
