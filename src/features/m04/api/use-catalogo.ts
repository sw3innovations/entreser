'use client'

import { useEffect, useState } from 'react'
import { m04 } from './client'
import type { components } from './schema'

type TiposSessaoResponse = components['schemas']['TiposSessaoResponse']

/**
 * Catálogo de tipos de sessão, buscado UMA vez por carregamento do app.
 *
 * `GET /tipos-sessao` é um catálogo: nome, duração e categoria de cada tipo não mudam
 * enquanto a pessoa usa o app. Ainda assim, onze telas o pediam com `useRecurso`, que não
 * tem cache — então cada troca de tela refazia a mesma requisição, competindo com a que
 * realmente trazia o conteúdo daquela tela.
 *
 * A promessa é memorizada no módulo, não a resposta: chamadas simultâneas de telas
 * diferentes compartilham o MESMO voo, em vez de disparar N requisições e deduplicar
 * depois. Falha limpa o memo, para a próxima tela poder tentar de novo em vez de herdar
 * o erro para sempre.
 */
let emVoo: Promise<TiposSessaoResponse | null> | null = null

function buscar(): Promise<TiposSessaoResponse | null> {
  emVoo ??= m04
    .GET('/tipos-sessao')
    .then((r) => (r.data ?? null) as TiposSessaoResponse | null)
    .catch(() => {
      emVoo = null
      return null
    })
  return emVoo
}

export function useCatalogoTipos() {
  const [catalogo, setCatalogo] = useState<TiposSessaoResponse | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    buscar()
      .then((c) => {
        if (ativo) setCatalogo(c)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  return { catalogo, carregando }
}
