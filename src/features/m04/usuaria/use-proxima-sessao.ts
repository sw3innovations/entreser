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
 * Busca UMA página de sessões futuras ativas e escolhe a mais próxima **no cliente**:
 * `GET /usuaria/sessoes` não documenta ordenação e, na prática, devolve fora de ordem
 * (observado: 11/ago 19:30 antes de 11/ago 16:00 e de 10/ago). Por isso não dá para pedir
 * `size=1` e confiar no primeiro item — seria a "próxima" errada.
 *
 * Suposição explícita: 50 sessões futuras cobrem qualquer usuária real nesta fase, então
 * não paginamos. Se alguém passar disso, a próxima ainda estará nesta página (o corte é
 * por volume, não por data) — mas fica registrado que o limite existe.
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
                page: 0,
                size: 50,
              },
            },
          })
        : Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) }),
    [enabled],
  )

  const proxima =
    dados?.content && dados.content.length > 0
      ? [...dados.content].sort((a, b) => a.dataHora.localeCompare(b.dataHora))[0]
      : null

  return { proxima, carregando }
}
