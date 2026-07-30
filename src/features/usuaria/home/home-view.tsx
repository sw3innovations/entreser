'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ESAvatar, ESProgressBar, ESSkeleton, ConteudosIcon, TrilhasIcon, AgendaIcon } from '@/components/ui'
import { useAuth } from '@/features/auth/context/auth-context'
import { PlumHero, GlassCard, ContentCard, ChevronRightIcon } from '../ui'
import { useMinhaFase } from '../fase/use-minha-fase'
import { useFeed } from '../feed/use-feed'
import { useTrilhas } from '../trilhas/use-trilhas'
import { useRecentes } from '../conteudos/use-recentes'
import { feedItemToVM } from '../feed/vm'
import { conteudoResumoToVM } from '../conteudos/vm'
import type { ContentItemVM } from '../lib/content'

/**
 * HomeView — landing do app da Usuária. Responsiva: no mobile é uma coluna única
 * (card de fase sobreposto ao hero, vitrine em carrossel); no desktop usa a
 * largura — banda superior com fase + atalhos lado a lado e vitrine em grade.
 * Inclui o atalho para o M04 (agendar/ver sessões) além do escopo original M05.
 */
export function HomeView() {
  const { user } = useAuth()
  const primeiro = user?.nome?.split(' ')[0]

  const { data: minhaFase, loading: faseLoading } = useMinhaFase()
  const fase = minhaFase?.atual
  const temFase = Boolean(fase)
  // Só depois de resolver a fase sabemos que NÃO há uma — evita buscar recentes à toa.
  const semFase = !faseLoading && !temFase

  // Com fase: vitrine por fase (`/feed`). Sem fase: mais recentes (`/conteudos`,
  // sem filtro) — a home de quem ainda não fez onboarding não fica vazia.
  const { itens: feedItens, loading: feedLoading } = useFeed({ tamanho: 6, enabled: temFase })
  const { itens: recentes, loading: recentesLoading } = useRecentes(6, semFase)
  const { trilhas } = useTrilhas()

  const emAndamento = trilhas.find((t) => t.progresso > 0 && t.progresso < 100)

  const vitrine: ContentItemVM[] = temFase
    ? feedItens.slice(0, 6).map(feedItemToVM)
    : recentes.map(conteudoResumoToVM)
  const vitrineLoading = faseLoading || (temFase ? feedLoading : recentesLoading)

  return (
    <div className="min-h-dvh overflow-x-hidden">
      {/* Hero: full-bleed no mobile; no desktop vira um card ameixa contido e
          arredondado, com margem no topo — flutua como a sidebar e alinha à
          largura do conteúdo (mesmo px), em vez de sangrar de ponta a ponta. */}
      <div className="lg:mx-auto lg:max-w-5xl lg:px-6 lg:pt-6">
        <PlumHero wide elevated className="pb-20 lg:rounded-card lg:pb-8">
          <div className="flex items-center gap-4">
            <ESAvatar name={user?.nome} size="lg" isBordered />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cream/60">Bem-vinda de volta</p>
              <h1 className="truncate font-display text-2xl font-light text-cream lg:text-3xl">
                Olá{primeiro ? `, ${primeiro}` : ''}!
              </h1>
            </div>
          </div>
        </PlumHero>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* Card da fase — sobreposto ao hero no mobile; com respiro no desktop */}
        <div className="relative z-20 -mt-10 lg:mt-6">
          {faseLoading ? (
            <ESSkeleton variant="rectangular" height={112} className="rounded-card" />
          ) : (
            <Link href="/fase" className="block">
              <GlassCard className="p-5 transition-es hover:shadow-card-hover">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mauve to-mauve-dark text-white">
                      <FaseGlyph />
                    </span>
                    <div className="min-w-0">
                      <p className="text-eyebrow text-mauve">Sua fase atual</p>
                      <p className="truncate font-display text-lg text-plum">
                        {fase?.nome ?? 'Definir minha fase'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-plum/30">
                    <ChevronRightIcon size={20} />
                  </span>
                </div>
                {fase?.descricao && (
                  <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed text-plum/60">{fase.descricao}</p>
                )}
              </GlassCard>
            </Link>
          )}
        </div>

        {/* Atalhos — só no mobile; no desktop a sidebar cobre a navegação */}
        <div className="grid grid-cols-2 gap-3 pt-4 lg:hidden">
          <QuickTile href="/sessoes" label="Ver minhas consultas" icon={<AgendaIcon />} />
          <QuickTile href="/feed" label="Explorar conteúdos" icon={<ConteudosIcon />} />
          <QuickTile href="/trilhas" label="Ver trilhas" icon={<TrilhasIcon />} />
        </div>

        <div className="space-y-8 py-8">
          {/* Consulta — atalho de destaque para agendar/ver sessões (M04). A sidebar
              do desktop não tem essa aba ainda, então o card fica visível nos dois
              tamanhos, diferente dos QuickTiles mobile-only acima. O card inteiro leva
              para "minhas sessões"; o botão "Agendar" pula direto para o fluxo de
              marcação (`/agendar`), sem precisar passar pela lista vazia primeiro. */}
          <section>
            <GlassCard className="p-5">
              <Link href="/sessoes" className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mauve to-mauve-dark text-white">
                    <AgendaIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-eyebrow text-mauve">Consulta</p>
                    <p className="truncate font-display text-lg text-plum">Ver minhas sessões</p>
                  </div>
                </div>
                <span className="shrink-0 text-plum/30">
                  <ChevronRightIcon size={20} />
                </span>
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-plum/60">
                Acompanhe o que está marcado ou agende um novo horário com sua profissional.
              </p>
              <Link
                href="/agendar"
                className="mt-4 inline-flex h-10 items-center rounded-full bg-mauve px-5 text-sm font-semibold text-cream transition-es hover:bg-mauve-dark active:scale-[0.98]"
              >
                Agendar consulta
              </Link>
            </GlassCard>
          </section>

          {/* Continue de onde parou */}
          {emAndamento && (
            <section>
              <SectionHead title="Continue de onde parou" actionHref="/trilhas" actionLabel="Ver todas" />
              <Link href={`/trilhas/${emAndamento.id}`} className="block">
                <GlassCard className="mt-3 p-4 transition-es hover:shadow-card-hover">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-plum-soft text-mauve">
                      <TrilhasIcon size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-plum">{emAndamento.titulo}</p>
                      <div className="mt-2 max-w-md">
                        <ESProgressBar value={emAndamento.progresso} showValueLabel size="sm" />
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </section>
          )}

          {/* Vitrine — por fase quando há uma; senão, os conteúdos mais recentes */}
          <section>
            <SectionHead
              title={temFase ? 'Conteúdo para você' : 'Conteúdos recentes'}
              description={
                temFase
                  ? `Selecionado para a fase ${fase?.nome}`
                  : 'Enquanto você não define sua fase, explore os conteúdos mais recentes.'
              }
              actionHref="/feed"
              actionLabel="Ver tudo"
            />
            {vitrineLoading ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <ESSkeleton key={i} variant="rectangular" height={190} className="rounded-card" />
                ))}
              </div>
            ) : vitrine.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-white/40 bg-white/50 px-4 py-8 text-center text-sm text-plum/45 backdrop-blur-sm">
                {temFase
                  ? 'Conteúdos para a sua fase aparecem aqui em breve.'
                  : 'Novos conteúdos aparecem aqui assim que forem publicados.'}
              </p>
            ) : (
              <div
                className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-3"
                style={{ scrollbarWidth: 'none' }}
              >
                {vitrine.map((vm) => (
                  <div key={vm.id} className="w-[80%] shrink-0 snap-start sm:w-auto">
                    <ContentCard item={vm} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Frase de acolhimento */}
          <section>
            <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-plum via-plum-mid to-mauve-dark p-6 lg:p-8">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
              <div className="relative z-10 mx-auto max-w-2xl text-center">
                <p className="font-display text-xl font-medium italic leading-relaxed text-cream/90 lg:text-2xl">
                  &ldquo;Cada tentativa é um ato de coragem. Você não está sozinha nessa jornada.&rdquo;
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function QuickTile({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-2xl border border-white/40 bg-white/70 p-4 backdrop-blur-sm transition-es hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mauve-ghost text-mauve">{icon}</span>
      <span className="text-sm font-medium text-plum">{label}</span>
    </Link>
  )
}

function SectionHead({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string
  description?: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-eyebrow text-mauve">{title}</p>
        {description && <p className="mt-1 text-xs text-plum/45">{description}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="shrink-0 text-sm text-mauve transition-es hover:text-mauve-dark">
          {actionLabel} →
        </Link>
      )}
    </div>
  )
}

function FaseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
