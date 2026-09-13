'use client'

import { useEffect, useState } from 'react'
import { useHydrated } from '@/lib/use-hydrated'
import { lerReflexao, salvarReflexao } from './reflexao'

/**
 * Texto de uma reflexão, lido do aparelho e salvo a cada pausa na digitação.
 *
 * O valor inicial é DERIVADO no render, não sincronizado por efeito: no servidor e na
 * hidratação vale `''` (não há de onde ler), e logo depois vale o que está guardado. O
 * estado só passa a existir quando ela digita — é isso que evita o `setState` dentro de
 * efeito e o render em cascata, e também evita gravar de volta o que acabou de ser lido.
 */
export function useReflexao(chave: string): [string, (texto: string) => void] {
  const hidratado = useHydrated()
  const [digitado, setDigitado] = useState<string | null>(null)
  const texto = digitado ?? (hidratado ? lerReflexao(chave) : '')

  useEffect(() => {
    if (digitado === null) return
    const t = setTimeout(() => salvarReflexao(chave, digitado), 500)
    return () => clearTimeout(t)
  }, [chave, digitado])

  return [texto, setDigitado]
}
