'use client'

import { useRouter } from 'next/navigation'
import { ESButton, ESSpinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { PageHero, PageContent, GlassCard, HeroProgress, ErrorRetry, CheckCircleIcon, CircleIcon, SparkleIcon } from '../ui'
import { useOnboarding } from './use-onboarding'

/**
 * OnboardingView (UF1) — questionário que infere a fase da usuária. Uma pergunta
 * por passo; ao finalizar, revela a fase inferida e leva ao feed. Desenho novo
 * (sem protótipo), consistente com o design system (hero ameixa + glass card).
 *
 * Desktop: usa `PageHero`/`PageContent` (hero contido + coluna centralizada), o
 * mesmo tratamento das demais telas internas — no mobile segue a faixa full-bleed.
 */
export function OnboardingView() {
  const router = useRouter()
  const o = useOnboarding()

  if (o.loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-plum via-plum-mid to-mauve-dark">
        <ESSpinner label="Preparando…" />
      </div>
    )
  }

  if (o.error) {
    return (
      <div className="min-h-dvh">
        <PageHero width="md" eyebrow="Entre Ser" title="Vamos te conhecer" />
        <PageContent width="md" className="pt-6">
          <ErrorRetry message={o.error} onRetry={o.reload} />
        </PageContent>
      </div>
    )
  }

  // Resultado — fase inferida.
  if (o.resultado) {
    return (
      <div className="min-h-dvh">
        <PageHero width="md" eyebrow="Tudo pronto" title="Sua fase" />
        <PageContent width="md" className="pt-6">
          <GlassCard accent className="mx-auto max-w-md p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mauve/10 text-mauve">
              <SparkleIcon size={26} />
            </span>
            <p className="mt-4 text-eyebrow text-mauve">Identificamos a sua fase</p>
            <h2 className="mt-1 font-display text-2xl font-light text-plum">
              {o.resultado.fase?.nome ?? 'Sua jornada'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-plum/60">
              Vamos personalizar seu feed e suas trilhas para este momento. Você pode ajustar sua fase
              quando quiser em “Minha fase”.
            </p>
            <div className="mt-6">
              <ESButton fullWidth onPress={() => router.replace('/explorar')}>
                Ir para o feed
              </ESButton>
            </div>
          </GlassCard>
        </PageContent>
      </div>
    )
  }

  // Sem perguntas ativas — nada a inferir; segue para o feed.
  if (o.total === 0) {
    return (
      <div className="min-h-dvh">
        <PageHero width="md" eyebrow="Entre Ser" title="Vamos começar" />
        <PageContent width="md" className="pt-6">
          <GlassCard className="mx-auto max-w-md p-6 text-center">
            <p className="text-sm leading-relaxed text-plum/60">
              Tudo pronto para começar. Você pode definir sua fase a qualquer momento em “Minha fase”.
            </p>
            <div className="mt-5">
              <ESButton fullWidth onPress={() => router.replace('/explorar')}>
                Ir para o feed
              </ESButton>
            </div>
          </GlassCard>
        </PageContent>
      </div>
    )
  }

  const pergunta = o.atual!

  return (
    <div className="min-h-dvh">
      <PageHero
        width="lg"
        eyebrow="Vamos te conhecer"
        title="Onboarding"
        description="Algumas perguntas rápidas para personalizar sua jornada."
      >
        <div className="mt-5 max-w-md">
          <HeroProgress value={o.progresso} showValue={false} />
        </div>
      </PageHero>

      <PageContent width="lg" className="pb-10 pt-6">
        <GlassCard accent>
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14 lg:p-10">
            {/* Coluna esquerda — a pergunta e um contexto acolhedor */}
            <div>
              <p className="text-eyebrow text-mauve">
                Pergunta {o.indice + 1} de {o.total}
              </p>
              <h2 className="mt-3 font-display text-[26px] font-light leading-snug text-plum lg:text-[30px]">
                {pergunta.texto}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-plum/55">
                Escolha a opção que mais combina com o seu momento agora. Não existe resposta certa —
                é só para personalizarmos o seu espaço.
              </p>
            </div>

            {/* Coluna direita — opções e ações */}
            <div>
              <div className="space-y-2.5">
                {pergunta.opcoes.map((op) => (
                  <OptionButton
                    key={op.id}
                    label={op.texto}
                    selected={o.selecionada === op.id}
                    onSelect={() => o.selecionar(op.id)}
                  />
                ))}
              </div>

              {o.erroEnvio && <p className="mt-4 text-sm text-red-alert">{o.erroEnvio}</p>}

              <div className="mt-7 flex items-center gap-3">
                {o.indice > 0 && (
                  <ESButton variant="ghost" onPress={o.voltar} isDisabled={o.enviando}>
                    Voltar
                  </ESButton>
                )}
                <ESButton
                  className="flex-1"
                  fullWidth={o.indice === 0}
                  isDisabled={!o.selecionada}
                  isLoading={o.enviando}
                  onPress={o.avancar}
                >
                  {o.ehUltima ? 'Ver minha fase' : 'Continuar'}
                </ESButton>
              </div>
            </div>
          </div>
        </GlassCard>
      </PageContent>
    </div>
  )
}

function OptionButton({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left text-[15px] leading-snug transition-es',
        selected
          ? 'border-mauve/50 bg-mauve-ghost/70 text-plum shadow-[0_2px_10px_-4px_rgb(150_106_143/0.35)]'
          : 'border-cream-dark/60 bg-white/55 text-plum/80 hover:border-mauve/35 hover:bg-white',
      )}
    >
      <span
        className={cn(
          'shrink-0 transition-es',
          selected ? 'text-mauve' : 'text-plum/25 group-hover:text-mauve/50',
        )}
      >
        {selected ? <CheckCircleIcon size={22} /> : <CircleIcon size={22} />}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  )
}
