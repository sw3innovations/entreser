'use client'

import { useCallback, useEffect, useState } from 'react'
import { jornadaApi, type JornadaAgenda, type JornadaHoje, type RegistroJornada, type TratamentoItem, type TrilhaSugerida } from './api'

/**
 * Carregador mínimo: estado de carga/erro + `recarregar`. Erro não derruba a tela — as
 * seções que dependem da Jornada somem ou mostram vazio; o resto da Home continua.
 */
function useCarregar<T>(buscar: () => Promise<T>, habilitado = true) {
  const [dados, setDados] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(habilitado)
  const [erro, setErro] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!habilitado) return
    let ativo = true
    buscar()
      .then((d) => {
        if (!ativo) return
        setDados(d)
        setErro(false)
      })
      .catch(() => {
        if (ativo) setErro(true)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
    // `buscar` é estável (função de módulo); recarrega pelo nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, habilitado])

  const recarregar = useCallback(() => setNonce((n) => n + 1), [])
  return { dados, carregando, erro, recarregar }
}

export function useJornadaHoje() {
  return useCarregar<JornadaHoje>(jornadaApi.hoje)
}

export function useJornadaAgenda() {
  return useCarregar<JornadaAgenda>(jornadaApi.agenda)
}

export function useRecomendacoes() {
  return useCarregar<TrilhaSugerida[]>(jornadaApi.recomendacoes)
}

export function useRegistros() {
  return useCarregar<RegistroJornada[]>(jornadaApi.registros)
}

export function useTratamentos() {
  return useCarregar<TratamentoItem[]>(jornadaApi.tratamentos)
}
