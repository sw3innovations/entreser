'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDe } from './erros'
import { comRetry, mensagemDeRede } from './rede'

type Pagina<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages: number }
type Resultado<T> = { data?: Pagina<T>; error?: unknown; response: Response }

export interface EstadoLista<T> {
  itens: T[]
  /** Total do servidor (`totalElements`) — NUNCA `itens.length`. */
  total: number
  carregando: boolean
  carregandoMais: boolean
  erro: string | null
  vazio: boolean
  temMais: boolean
  carregarMais: () => void
  recarregar: () => void
}

/**
 * Lista paginada com "Ver mais" — peça (c) da camada de estados (D19). Busca a página 0
 * (e refaz quando `deps` muda ou em `recarregar`), acumula o `content` a cada página, e só
 * mostra "Ver mais" enquanto `page+1 < totalPages`. A posição vem de `totalElements`, nunca
 * de `itens.length`. `fn(page)` recebe o número da página a buscar. Só GET.
 */
export function useListaPaginada<T>(
  fn: (page: number) => Promise<Resultado<T>>,
  deps: readonly unknown[] = [],
): EstadoLista<T> {
  const [itens, setItens] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  const codigo = (e: unknown) => (e as { code?: string } | undefined)?.code

  // Página 0: primeira carga, mudança de `deps` ou `recarregar`.
  useEffect(() => {
    let ativo = true
    comRetry(() => fnRef.current(0), () => ativo)
      .then((r) => {
        if (!ativo) return
        if (r.error) {
          setErro(codigo(r.error) ? mensagemDe(codigo(r.error)) : mensagemDeRede(r.response?.status))
          setItens([])
          setTotal(0)
          setTotalPages(0)
        } else {
          setItens(r.data?.content ?? [])
          setTotal(r.data?.totalElements ?? 0)
          setTotalPages(r.data?.totalPages ?? 0)
          setPage(0)
          setErro(null)
        }
      })
      .catch(() => {
        if (ativo) setErro(mensagemDeRede())
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps])

  const carregarMais = useCallback(() => {
    const prox = page + 1
    setCarregandoMais(true)
    comRetry(() => fnRef.current(prox))
      .then((r) => {
        if (r.error) {
          setErro(codigo(r.error) ? mensagemDe(codigo(r.error)) : mensagemDeRede(r.response?.status))
        } else {
          setItens((cur) => [...cur, ...(r.data?.content ?? [])])
          setPage(prox)
          if (r.data) {
            setTotal(r.data.totalElements)
            setTotalPages(r.data.totalPages)
          }
        }
      })
      .catch(() => setErro(mensagemDeRede()))
      .finally(() => setCarregandoMais(false))
  }, [page])

  const recarregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    setNonce((n) => n + 1)
  }, [])

  const temMais = page + 1 < totalPages
  const vazio = !carregando && !erro && itens.length === 0

  return { itens, total, carregando, carregandoMais, erro, vazio, temMais, carregarMais, recarregar }
}
