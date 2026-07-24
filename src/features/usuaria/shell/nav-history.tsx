'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "Dá para voltar dentro do app?" — sinal confiável para os botões de voltar das
 * telas de detalhe (leitor, trilha), que não têm BottomNav.
 *
 * Por que não `window.history.length > 1`: ele conta entradas de ANTES do app
 * (o redirect de `/login` na entrada, outra aba) e NUNCA diminui no `back()`.
 * Resultado: `router.back()` podia cair no `/login` ou sair do app. E o Next 16
 * (App Router) não expõe `history.state.idx`.
 *
 * Solução: no momento em que a usuária ENTRA na área logada, o provider guarda o
 * `history.length` de entrada. A partir daí, `canGoBack()` é verdadeiro só se o
 * history cresceu — ou seja, houve ao menos UMA navegação in-app desde a entrada.
 * Assim o `back()` sempre permanece dentro do app (no pior caso, na página de
 * entrada); sem isso, o "voltar" usa um fallback explícito.
 */
const NavHistoryCtx = createContext<() => boolean>(() => false)

export function NavHistoryProvider({ children }: { children: ReactNode }) {
  // Fixa o comprimento do history no primeiro render do cliente — no instante em
  // que este provider (montado no layout autenticado) aparece, já depois de os
  // redirects de login assentarem. useState com initializer preguiçoso roda uma
  // vez só e é seguro no render (diferente de mutar um ref durante o render).
  const [entryLen] = useState(() => (typeof window !== 'undefined' ? window.history.length : 0))

  const canGoBack = useCallback(
    () => typeof window !== 'undefined' && window.history.length > entryLen,
    [entryLen],
  )

  return <NavHistoryCtx.Provider value={canGoBack}>{children}</NavHistoryCtx.Provider>
}

/**
 * Handler de "voltar" para telas de detalhe: volta na navegação in-app quando há
 * para onde (retorna à página de origem — feed, home, busca…); senão vai para o
 * `fallback` (entrada direta por link/refresh, quando não há histórico do app).
 */
export function useVoltar(fallback: string): () => void {
  const router = useRouter()
  const canGoBack = useContext(NavHistoryCtx)
  return useCallback(() => {
    if (canGoBack()) router.back()
    else router.push(fallback)
  }, [router, canGoBack, fallback])
}
