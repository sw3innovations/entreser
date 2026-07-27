'use client'

import { useRouter } from 'next/navigation'
import { PageHero, PageContent, ChevronRightIcon } from '@/features/usuaria/ui'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import type { components } from '@/features/m04/api/schema'

type Tipo = components['schemas']['TipoSessaoInfo']

/** Descrição da faixa de participantes: "Individual" ou "3 a 12 pessoas". */
function participantes(t: Tipo): string {
  if (t.minParticipantes === t.maxParticipantes) {
    return t.maxParticipantes === 1 ? 'Individual' : `${t.maxParticipantes} pessoas`
  }
  return `${t.minParticipantes} a ${t.maxParticipantes} pessoas`
}

/**
 * U1 · Escolher tipo de sessão (M04). Consome `GET /tipos-sessao` (nunca hardcoda
 * durações/limites — vêm do catálogo). Bifurca pelo campo `categoria`, que NÃO é
 * exibido: `Individual` → escolher profissional (U2); `Grupo` → sessões abertas (U7).
 */
export function EscolherTipoView() {
  const router = useRouter()
  const { dados, carregando, erro, vazio, recarregar } = useRecurso(
    () => m04.GET('/tipos-sessao'),
    [],
    { vazio: (d) => d.tipos.length === 0 },
  )
  const tipos = dados?.tipos ?? []

  const abrir = (t: Tipo) => {
    router.push(t.categoria === 'Grupo' ? `/agendar/grupo/${t.codigo}` : `/agendar/${t.codigo}`)
  }

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        eyebrow="Agendar"
        title="Escolha o tipo de sessão"
        description="Selecione o atendimento que faz sentido para este momento."
      />
      <PageContent width="md" className="pt-6">
        <Estado carregando={carregando} erro={erro} vazio={vazio} aoRepetir={recarregar}>
          <div className="flex flex-col gap-3">
            {tipos.map((t) => (
              <button
                key={t.codigo}
                type="button"
                onClick={() => abrir(t)}
                className="group flex items-center gap-4 rounded-card border border-plum/8 bg-white p-[18px] text-left shadow-card transition-es hover:border-mauve/25 hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg leading-tight text-plum">{t.nome}</h3>
                    {t.categoria === 'Grupo' && (
                      <span className="rounded-pill bg-mauve-ghost px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-mauve">
                        Grupo
                      </span>
                    )}
                  </div>
                  {t.descricao && (
                    <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-plum/55">{t.descricao}</p>
                  )}
                  <p className="mt-1.5 text-xs text-plum/45">
                    {t.duracaoMinutos} minutos · {participantes(t)}
                  </p>
                </div>
                <ChevronRightIcon
                  size={20}
                  className="shrink-0 text-plum/25 transition-es group-hover:translate-x-0.5 group-hover:text-mauve"
                />
              </button>
            ))}
          </div>
        </Estado>
      </PageContent>
    </div>
  )
}
