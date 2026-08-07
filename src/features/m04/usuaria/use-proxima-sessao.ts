'use client'

import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import type { components } from '@/features/m04/api/schema'

type SessaoResumo = components['schemas']['SessaoResumo']
type PaginaSessoes = { content: SessaoResumo[] }

/**
 * A próxima sessão da usuária — a informação mais acionável da home ("quando é a minha
 * próxima?"), que antes exigia entrar em Minhas Sessões para descobrir.
 *
 * Pede **um item só**: com `ordem=asc` a partir de agora, o primeiro da lista É a próxima.
 *
 * Já foi `size=50` com a escolha da menor data no cliente, de quando `GET /usuaria/sessoes`
 * devolvia fora de ordem (observado: 11/ago 19:30 antes de 11/ago 16:00). Aquilo baixava 50
 * registros para renderizar um e carregava uma suposição de volume — "50 futuras cobrem
 * qualquer usuária" — que ninguém revisitaria, e cujo erro seria silencioso: o card mostraria
 * uma sessão, só que a errada. O servidor ordenando tirou as duas coisas.
 */
export function useProximaSessao(enabled = true) {
  const { dados, carregando } = useRecurso<PaginaSessoes>(
    () =>
      enabled
        ? m04.GET('/usuaria/sessoes', {
            params: {
              query: {
                status: ['Agendada', 'Confirmada'],
                de: new Date().toISOString(),
                ordem: 'asc',
                page: 0,
                size: 1,
              },
            },
          })
        : Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) }),
    [enabled],
  )

  return { proxima: dados?.content?.[0] ?? null, carregando }
}
