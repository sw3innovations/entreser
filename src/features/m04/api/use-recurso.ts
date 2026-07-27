'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDe } from './erros'

/** Formato de retorno de uma chamada `openapi-fetch` (`{ data, error, response }`). */
type Resultado<T> = { data?: T; error?: unknown; response: Response }

export interface EstadoRecurso<T> {
  dados: T | null
  carregando: boolean
  /** Mensagem pt-BR já resolvida pelo `code` (nunca o texto cru da API). */
  erro: string | null
  vazio: boolean
  recarregar: () => void
}

/**
 * Roda uma leitura (`GET`) do M04 e expõe os quatro estados de tela (carregando /
 * conteúdo / vazio / erro) já normalizados — a peça (a) da camada de estados (D19). O
 * erro chega traduzido pelo `code` via `mensagemDe`. Reexecuta quando algum item de
 * `deps` muda ou quando `recarregar()` é chamado. Só para GET: escrita nunca passa por
 * aqui (não há retry automático de escrita).
 *
 * Segue o padrão de fetch do app: o efeito só faz `setState` nos callbacks assíncronos;
 * o reset de `carregando` mora no `recarregar` (evento), nunca síncrono no efeito.
 */
export function useRecurso<T>(
  fn: () => Promise<Resultado<T>>,
  deps: readonly unknown[] = [],
  opts?: { vazio?: (dados: T) => boolean },
): EstadoRecurso<T> {
  const [dados, setDados] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // Guarda a última `fn` (recriada a cada render) sem re-disparar o fetch: quem dispara
  // são `deps` e `recarregar`. Atualizada em efeito (nunca durante o render).
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    let ativo = true
    fnRef.current()
      .then((r) => {
        if (!ativo) return
        if (r.error) {
          setErro(mensagemDe((r.error as { code?: string } | undefined)?.code))
          setDados(null)
        } else {
          setDados((r.data ?? null) as T | null)
          setErro(null)
        }
      })
      .catch(() => {
        if (ativo) setErro(mensagemDe())
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps])

  const recarregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    setNonce((n) => n + 1)
  }, [])

  const vazio =
    !carregando && !erro && (opts?.vazio ? dados == null || opts.vazio(dados) : dados == null)

  return { dados, carregando, erro, vazio, recarregar }
}
