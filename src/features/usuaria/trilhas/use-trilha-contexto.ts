'use client'

import { useEffect, useState } from 'react'
import { trilhasUsuariaService } from '.'
import type { TrilhaDetalhe, TrilhaItem } from './types'

/** Onde um conteúdo está dentro de uma trilha: o passo atual e os vizinhos. */
export interface TrilhaContexto {
  trilha: TrilhaDetalhe
  atual: TrilhaItem
  anterior: TrilhaItem | null
  proximo: TrilhaItem | null
  /** Último passo da sequência — quem conclui aqui chega ao fechamento. */
  ultimo: boolean
}

/**
 * Situa o leitor dentro de uma trilha. Só busca quando há `trilhaId` (o leitor avulso
 * não paga nada por isso), e devolve `null` quando o conteúdo não pertence mais à trilha —
 * um link antigo, uma trilha editada — para o leitor cair no modo avulso em vez de
 * inventar um "próximo" que não existe.
 */
export function useTrilhaContexto(conteudoId: string, trilhaId: string | null) {
  const [contexto, setContexto] = useState<TrilhaContexto | null>(null)
  const [carregando, setCarregando] = useState(Boolean(trilhaId))

  useEffect(() => {
    if (!trilhaId) return
    let ativo = true
    trilhasUsuariaService
      .getById(trilhaId)
      .then((trilha) => {
        if (!ativo) return
        const i = trilha?.itens.findIndex((it) => it.conteudoId === conteudoId) ?? -1
        if (!trilha || i < 0) {
          setContexto(null)
          return
        }
        setContexto({
          trilha,
          atual: trilha.itens[i],
          anterior: i > 0 ? trilha.itens[i - 1] : null,
          proximo: i < trilha.itens.length - 1 ? trilha.itens[i + 1] : null,
          ultimo: i === trilha.itens.length - 1,
        })
      })
      .catch(() => {
        // Falhou a trilha, não o conteúdo: o leitor segue avulso, sem bloquear a leitura.
        if (ativo) setContexto(null)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [conteudoId, trilhaId])

  return { contexto, carregando }
}
