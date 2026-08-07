'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { faseUsuariaService } from '../fase'
import { onboardingUsuariaService } from '../onboarding'

/**
 * OnboardingGate — logo após o login decide entre app e onboarding (UF1):
 *  - COM `FaseUsuaria` definida → libera o app (caminho comum de quem já respondeu);
 *  - sem fase, MAS com onboarding cadastrado → redireciona para `/onboarding`;
 *  - sem fase e SEM onboarding cadastrado → libera o app mesmo assim.
 *
 * O último caso é o que evita o **trap**: sem perguntas cadastradas, mandar para
 * `/onboarding` só faria a usuária clicar "Ir para o feed" e cair de volta aqui
 * (bounce `/onboarding` ↔ `/feed`), porque ela nunca ganha fase. Por isso a ida
 * ao onboarding é condicionada a EXISTIR onboarding. O próprio `/onboarding` é
 * sempre liberado (evita loop). Qualquer falha na checagem também libera — nunca
 * trancar a usuária fora do app. A checagem de perguntas só ocorre quando não há
 * fase; quem já tem fase segue direto, sem custo extra.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<'checking' | 'ok'>('checking')
  // Rotas isentas do gate: o próprio `/onboarding` (evita loop) e `/conta` — a
  // área de conta é a saída da usuária (logout/dados) e precisa ser sempre
  // acessível, inclusive para quem ainda não tem fase.
  const semGate = pathname.startsWith('/onboarding') || pathname.startsWith('/conta')

  // Já decidimos nesta sessão? O efeito depende de `pathname` (para gatear rotas que
  // entram depois), mas a PERGUNTA — "esta usuária tem fase?" — só precisa ser feita uma
  // vez. Sem esta trava, cada navegação dentro do app disparava um `GET /usuaria/fase`
  // extra, competindo com as requisições da própria tela que estava abrindo.
  const jaDecidiu = useRef(false)

  useEffect(() => {
    if (semGate) return
    if (jaDecidiu.current) return
    let ativo = true

    async function decidir() {
      try {
        const mf = await faseUsuariaService.getMinhaFase()
        if (!ativo) return
        if (mf.atual) {
          jaDecidiu.current = true
          setState('ok')
          return
        }
        // Sem fase: só encaminha ao onboarding se houver perguntas cadastradas.
        const perguntas = await onboardingUsuariaService.getPerguntas()
        if (!ativo) return
        if (perguntas.length > 0) {
          router.replace('/onboarding')
        } else {
          jaDecidiu.current = true
          setState('ok')
        }
      } catch {
        // Uma falha na verificação não deve prender a usuária fora do app. Sem marcar
        // `jaDecidiu`: foi falha de rede, não resposta — a próxima navegação tenta de novo.
        if (ativo) setState('ok')
      }
    }

    decidir()
    return () => {
      ativo = false
    }
  }, [pathname, semGate, router])

  // Rotas isentas (onboarding, conta) renderizam direto, sem gate.
  if (semGate) return <>{children}</>

  if (state === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-mauve">
        Carregando…
      </div>
    )
  }
  return <>{children}</>
}
