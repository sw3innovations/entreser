'use client'

import { useRouter } from 'next/navigation'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon, ChevronRightIcon, SparkleIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { useMinhaFase } from '@/features/usuaria/fase/use-minha-fase'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { iconeDoTipo } from '@/features/m04/lib/tipo-icone'
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
  const voltar = useVoltar('/home')
  const { dados, carregando, erro, vazio, recarregar } = useRecurso(
    () => m04.GET('/tipos-sessao'),
    [],
    { vazio: (d) => d.tipos.length === 0 },
  )
  const tipos = dados?.tipos ?? []
  const individuais = tipos.filter((t) => t.categoria === 'Individual')
  const grupos = tipos.filter((t) => t.categoria === 'Grupo')

  const { data: minhaFase } = useMinhaFase()

  const abrir = (t: Tipo) => {
    router.push(t.categoria === 'Grupo' ? `/agendar/grupo/${t.codigo}` : `/agendar/${t.codigo}`)
  }

  const topBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        topBar={topBar}
        topBarClassName="lg:hidden"
        eyebrow="Agendar"
        title="Escolha o tipo de sessão"
        description="Selecione o atendimento que faz sentido para este momento."
      >
        {minhaFase?.atual && (
          /* `self-start`: no desktop o PlumHero envolve os filhos num flex column, e o
             `align-items: stretch` padrão esticaria a pill de ponta a ponta. */
          <div className="mt-4 inline-flex self-start items-center gap-2 rounded-pill border border-white/[0.16] bg-white/10 px-3.5 py-1.5">
            <SparkleIcon size={14} className="text-cream/80" />
            <span className="text-xs text-cream/80">
              Você está na fase <strong className="font-semibold text-cream">{minhaFase.atual.nome}</strong>
            </span>
          </div>
        )}
      </PageHero>
      <PageContent width="md" className="pt-6">
        <Estado carregando={carregando} erro={erro} vazio={vazio} aoRepetir={recarregar}>
          <div className="flex flex-col gap-7">
            {individuais.length > 0 && (
              <TipoSecao titulo="Atendimento individual" tipos={individuais} onAbrir={abrir} />
            )}
            {grupos.length > 0 && (
              <TipoSecao titulo="Em grupo" nota="com outras tentantes" tipos={grupos} onAbrir={abrir} />
            )}
          </div>
        </Estado>
      </PageContent>
    </div>
  )
}

function TipoSecao({
  titulo,
  nota,
  tipos,
  onAbrir,
}: {
  titulo: string
  nota?: string
  tipos: Tipo[]
  onAbrir: (t: Tipo) => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5 px-0.5">
        <span className="text-eyebrow text-mauve">{titulo}</span>
        <span className="h-px flex-1 bg-plum/[0.09]" />
        {nota && <span className="text-[11px] text-plum/40">{nota}</span>}
      </div>
      <div className="flex flex-col gap-3">
        {tipos.map((t) => {
          const Icone = iconeDoTipo(t.codigo)
          return (
            <button
              key={t.codigo}
              type="button"
              onClick={() => onAbrir(t)}
              className="group flex items-center gap-3.5 rounded-card border border-plum/8 bg-white p-4 text-left shadow-card transition-es hover:border-mauve/25 hover:shadow-card-hover active:scale-[0.99]"
            >
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mauve-soft to-cream text-mauve">
                <Icone size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg leading-tight text-plum">{t.nome}</h3>
                  {t.categoria === 'Grupo' && (
                    <span className="rounded-pill bg-mauve-soft px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-mauve">
                      Grupo
                    </span>
                  )}
                </div>
                {t.descricao && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-plum/55">{t.descricao}</p>
                )}
                <p className="mt-1 text-[11.5px] font-medium text-mauve">
                  {t.duracaoMinutos} minutos · {participantes(t)}
                </p>
              </div>
              <ChevronRightIcon
                size={18}
                className="shrink-0 text-plum/30 transition-es group-hover:translate-x-0.5 group-hover:text-mauve"
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}
