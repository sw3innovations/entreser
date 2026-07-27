'use client'

import type { ReactNode } from 'react'
import { ESSpinner, EmptyState } from '@/components/ui'
import { ErrorRetry } from '@/features/usuaria/ui'

interface EstadoProps {
  carregando: boolean
  erro: string | null
  vazio?: boolean
  aoRepetir?: () => void
  /** Placeholder da primeira carga; default é um spinner centralizado. */
  esqueleto?: ReactNode
  /** Conteúdo do estado vazio — sempre com uma ação de saída, nunca um beco. */
  aoVazio?: ReactNode
  children: ReactNode
}

/**
 * Peça (b) da camada de estados (D19): recebe os sinais do `useRecurso` e decide o que
 * desenhar, para a tela não virar um monte de `if`. Regras que carrega: vazio ≠ erro
 * (lista vazia mostra saída; falha de rede mostra "Tentar de novo"); o caminho feliz
 * (`children`) só renderiza com os dados prontos. Tema da usuária (escuro); o painel do
 * profissional ganhará uma variante clara quando a área dele existir.
 */
export function Estado({ carregando, erro, vazio, aoRepetir, esqueleto, aoVazio, children }: EstadoProps) {
  if (carregando) {
    return <>{esqueleto ?? <div className="flex justify-center py-16"><ESSpinner label="Carregando…" /></div>}</>
  }
  if (erro) {
    return <ErrorRetry message={erro} onRetry={aoRepetir ?? (() => {})} />
  }
  if (vazio) {
    return <>{aoVazio ?? <EmptyState title="Nada por aqui" description="Ainda não há nada para mostrar." />}</>
  }
  return <>{children}</>
}
