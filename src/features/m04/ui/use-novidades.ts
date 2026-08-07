'use client'

import { useCallback, useState } from 'react'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { dataHoraPorExtenso, emDiasISO, hojeISO, HORIZONTE_AGENDAMENTO_DIAS } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type SessaoResumo = components['schemas']['SessaoResumo']
type Pagina = { content: SessaoResumo[] }

export interface Novidade {
  id: string
  titulo: string
  descricao: string
  href: string
}

/** Papel de quem está olhando — decide a rota e de quem são os cancelamentos que interessam. */
export type PapelNovidades = 'usuaria' | 'profissional'

const CHAVE_VISTAS = 'entreser:novidades-vistas'

function lerVistas(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const cru = window.localStorage.getItem(CHAVE_VISTAS)
    return cru ? (JSON.parse(cru) as string[]) : []
  } catch {
    // localStorage indisponível (modo privado, cota) ou JSON corrompido: sem estado de
    // "visto" o sino apenas volta a apontar tudo como novo — degrada, não quebra.
    return []
  }
}

/**
 * As novidades de agendamento de quem está logado — hoje, **cancelamentos que desfizeram um
 * combinado que ainda não aconteceu**.
 *
 * O recorte é esse porque é o que transforma cancelamento de ESTADO em NOTÍCIA: era para
 * acontecer, não vai mais, e ainda dá tempo de agir. Some sozinho quando a data passa, sem
 * precisar de expiração explícita.
 *
 * Mostra só o que a OUTRA parte cancelou — ninguém precisa ser avisado do que decidiu. O
 * `Sistema` (grupo sem quórum) conta para os dois: ninguém pediu.
 *
 * **Limitação declarada:** o "visto" mora no `localStorage`, então é por dispositivo — ela
 * marca como lido no celular e o desktop volta a apontar. O certo seria um `visualizadoEm`
 * no servidor (ver TASKS_BACKEND_M04_R3.md); enquanto não existe, isto entrega o essencial
 * sem inventar estado no backend.
 */
export function useNovidades(papel: PapelNovidades, enabled = true) {
  const [vistas, setVistas] = useState<string[]>(lerVistas)

  const { dados } = useRecurso<Pagina>(
    () =>
      !enabled
        ? Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) })
        : papel === 'profissional'
          ? m04.GET('/profissional/agenda', {
              params: {
                query: {
                  de: `${hojeISO()}T00:00:00Z`,
                  ate: `${emDiasISO(HORIZONTE_AGENDAMENTO_DIAS)}T23:59:59Z`,
                  status: ['Cancelada'],
                  ordem: 'asc',
                  page: 0,
                  size: 20,
                },
              },
            })
          : m04.GET('/usuaria/sessoes', {
              params: {
                query: {
                  de: new Date().toISOString(),
                  status: ['Cancelada'],
                  ordem: 'asc',
                  page: 0,
                  size: 20,
                },
              },
            }),
    [papel, enabled],
  )

  // Quem cancelou não precisa ser avisado do próprio cancelamento.
  const euCancelei = papel === 'profissional' ? 'Profissional' : 'Usuaria'
  const base = (dados?.content ?? []).filter((s) => s.canceladaPor !== euCancelei)

  const novidades: Novidade[] = base.map((s) => ({
    id: s.id,
    titulo: s.canceladaPor === 'Sistema' ? 'Sessão cancelada automaticamente' : 'Sessão cancelada',
    descricao:
      s.canceladaPor === 'Sistema'
        ? `${dataHoraPorExtenso(s.dataHora)} — o grupo não atingiu o mínimo de participantes.`
        : `${dataHoraPorExtenso(s.dataHora)} — cancelada ${papel === 'profissional' ? 'pela usuária' : 'pela profissional'}.`,
    href: papel === 'profissional' ? `/admin/agenda/${s.id}` : `/sessoes/${s.id}`,
  }))

  const naoVistas = novidades.filter((n) => !vistas.includes(n.id)).length

  // `novidades` é recriado a cada render (deriva do fetch), então não serve de dependência.
  // A chave por conteúdo mantém o callback estável enquanto o conjunto de ids não muda.
  const chaveDosIds = novidades.map((n) => n.id).join(',')

  /** Chamado ao ABRIR o painel: quem viu a lista viu tudo o que estava nela. */
  const marcarComoVistas = useCallback(() => {
    const ids = chaveDosIds ? chaveDosIds.split(',') : []
    if (ids.length === 0) return
    setVistas((atuais) => {
      const uniao = [...new Set([...atuais, ...ids])]
      try {
        window.localStorage.setItem(CHAVE_VISTAS, JSON.stringify(uniao))
      } catch {
        // Sem persistência, o estado ainda vale para esta sessão de navegação.
      }
      return uniao
    })
  }, [chaveDosIds])

  return { novidades, naoVistas, marcarComoVistas }
}
