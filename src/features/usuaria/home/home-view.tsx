'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ESAvatar, ESProgressBar, ESSkeleton, ConteudosIcon, TrilhasIcon, AgendaIcon } from '@/components/ui'
import { useAuth } from '@/features/auth/context/auth-context'
import { useProximaSessao } from '@/features/m04/usuaria/use-proxima-sessao'
import { blocoData, diaPorExtenso, diasAte, hora, quandoAcontece } from '@/features/m04/lib/datas'
import { PlumHero, GlassCard, ContentCard, ChevronRightIcon, CalendarPlusIcon } from '../ui'
import { useMinhaFase } from '../fase/use-minha-fase'
import { useFeed } from '../feed/use-feed'
import { useTrilhas } from '../trilhas/use-trilhas'
import { useRecentes } from '../conteudos/use-recentes'
import { feedItemToVM } from '../feed/vm'
import { conteudoResumoToVM } from '../conteudos/vm'
import type { ContentItemVM } from '../lib/content'

/**
 * HomeView — landing do app da Usuária. Responsiva: no mobile é uma coluna única
 * (card de fase sobreposto ao hero, vitrine em carrossel); no desktop divide em duas
 * colunas (principal + trilho lateral), em vez de esticar a coluna do mobile e deixar
 * metade da tela vazia.
 *
 * O destaque é a **próxima sessão** (M04): a pergunta mais frequente de quem abre o app
 * é "quando é a minha próxima?", e antes isso exigia entrar em Minhas Sessões. Agora a
 * resposta está na home, com data, hora e profissional — e o atalho para agendar só
 * assume o lugar de destaque quando não há nenhuma marcada.
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
  const { proxima, carregando: proximaLoading } = useProximaSessao()

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
          {/* Uma linha de contexto dá função ao hero, que antes era só saudação num
              retângulo vazio — sobretudo no desktop, onde ele é alto. */}
          {proxima && (
            /* `self-start`: no desktop o PlumHero envolve os filhos num flex column, e o
               `align-items: stretch` padrão esticaria a pill de ponta a ponta. */
            <div className="mt-5 inline-flex self-start items-center gap-2 rounded-pill border border-white/[0.16] bg-white/10 px-3.5 py-1.5">
              <AgendaIcon size={14} className="text-cream/80" />
              <span className="text-xs text-cream/80">
                Sua próxima sessão é{' '}
                <strong className="font-semibold text-cream">{quandoAcontece(proxima.dataHora) ?? 'em breve'}</strong>
              </span>
            </div>
          )}
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

        {/* Acesso rápido — logo abaixo da fase e em largura total, porque é o menu
            principal do app: a navegação fixa (header/BottomNav) não cobre consultas nem
            agendamento, então é daqui que se chega a tudo. */}
        <nav aria-label="Acesso rápido" className="pt-6">
          <p className="text-eyebrow mb-3 px-0.5 text-mauve">Acesso rápido</p>
          {/* Uma fileira de 4 em qualquer tamanho. Em 2×2 no celular o bloco passava de
              300px de altura e empurrava a próxima sessão para fora da tela — destaque
              não é ocupar espaço, é estar no caminho. */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <QuickTile href="/sessoes" label="Consultas" icon={<AgendaIcon />} />
            <QuickTile href="/agendar" label="Agendar" icon={<CalendarPlusIcon />} />
            <QuickTile href="/feed" label="Conteúdos" icon={<ConteudosIcon />} />
            <QuickTile href="/trilhas" label="Trilhas" icon={<TrilhasIcon />} />
          </div>
        </nav>

        {/* Duas colunas no desktop: a principal segura o que é conteúdo (sessão +
            vitrine) e o trilho lateral o que é apoio (trilha em andamento, frase).
            No mobile tudo empilha na ordem em que está escrito. */}
        <div className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-3">
          <div className="flex flex-col gap-8 lg:col-span-2">
            <ProximaSessaoCard sessao={proxima} carregando={proximaLoading} />

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
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[0, 1].map((i) => (
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
                  className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible"
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
          </div>

          {/* Trilho lateral */}
          <aside className="flex flex-col gap-6">
            {/* Continue de onde parou */}
            {emAndamento && (
              <section>
                <SectionHead title="Continue de onde parou" actionHref="/trilhas" actionLabel="Ver todas" />
                <Link href={`/trilhas/${emAndamento.id}`} className="block">
                  <GlassCard className="mt-3 p-4 transition-es hover:shadow-card-hover">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-plum-soft text-mauve">
                        <TrilhasIcon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-plum">{emAndamento.titulo}</p>
                        <div className="mt-2">
                          <ESProgressBar value={emAndamento.progresso} showValueLabel size="sm" />
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              </section>
            )}

            {/* Frase de acolhimento */}
            <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-plum via-plum-mid to-mauve-dark p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
              <p className="relative z-10 font-display text-lg font-medium italic leading-relaxed text-cream/90">
                &ldquo;Cada tentativa é um ato de coragem. Você não está sozinha nessa jornada.&rdquo;
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

/**
 * Próxima sessão — o card de destaque da home. Com sessão marcada, responde "quando" e
 * "com quem" sem precisar navegar; sem nenhuma, vira o convite para agendar. O bloco de
 * data em cartão é o mesmo do fluxo de marcação (`blocoData`), então a peça já é
 * familiar quando a pessoa chega aqui.
 */
function ProximaSessaoCard({
  sessao,
  carregando,
}: {
  sessao: ReturnType<typeof useProximaSessao>['proxima']
  carregando: boolean
}) {
  if (carregando) {
    return <ESSkeleton variant="rectangular" height={168} className="rounded-card" />
  }

  if (!sessao) {
    return (
      <GlassCard className="p-5">
        <p className="text-eyebrow text-mauve">Consulta</p>
        <p className="mt-1.5 font-display text-lg text-plum">Nenhuma sessão marcada</p>
        <p className="mt-2 text-sm leading-relaxed text-plum/60">
          Quando quiser conversar, escolha um horário com uma de nossas profissionais.
        </p>
        {/* Um CTA só: "Minhas sessões" e "Agendar" já são itens fixos do acesso rápido
            logo acima — repetir aqui seria competir com o próprio menu. */}
        <Link
          href="/agendar"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-mauve px-5 text-sm font-semibold text-cream transition-es hover:bg-mauve-dark active:scale-[0.98]"
        >
          Agendar consulta
        </Link>
      </GlassCard>
    )
  }

  const data = blocoData(sessao.dataHora)
  const quando = diasAte(sessao.dataHora)

  // Sem fileira de botões, o card inteiro é o alvo — mesmo padrão do card de fase.
  return (
    <Link href={`/sessoes/${sessao.id}`} className="block">
      <GlassCard className="p-5 transition-es hover:shadow-card-hover">
        <div className="flex items-center justify-between gap-3">
          <p className="text-eyebrow text-mauve">Sua próxima sessão</p>
          {quando && (
            <span className="rounded-pill bg-mauve-ghost px-2.5 py-1 text-[11.5px] font-medium text-mauve">
              {quando}
            </span>
          )}
        </div>

        <div className="mt-3.5 flex items-center gap-4">
          <div className="flex w-[62px] shrink-0 flex-col items-center rounded-2xl bg-gradient-to-br from-plum to-plum-mid py-2.5 text-center shadow-[0_8px_20px_rgba(45,24,64,0.28)]">
            <span className="text-[9.5px] font-bold tracking-wider text-cream/70">{data.dia}</span>
            <span className="font-display text-[26px] leading-tight text-cream">{data.numero}</span>
            <span className="text-[9.5px] font-semibold tracking-wider text-cream/60">{data.mes}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[26px] leading-none text-plum">{hora(sessao.dataHora)}</h2>
            <p className="mt-1.5 text-[13px] text-plum/50 first-letter:uppercase">{diaPorExtenso(sessao.dataHora)}</p>
            <p className="mt-0.5 truncate text-[13px] text-plum/50">
              {sessao.tituloGrupo?.trim() ? sessao.tituloGrupo : `Com ${sessao.profissional.nome}`}
            </p>
          </div>
          <span className="shrink-0 text-plum/30">
            <ChevronRightIcon size={20} />
          </span>
        </div>
      </GlassCard>
    </Link>
  )
}

/**
 * Item do acesso rápido. Alvo generoso e rótulo de uma palavra: são quatro lado a lado
 * (2×2 no mobile, 1×4 no desktop) e um rótulo longo quebraria a linha em alguns e não em
 * outros, desalinhando a fileira.
 */
function QuickTile({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-white/40 bg-white/70 px-1.5 py-3.5 text-center backdrop-blur-sm transition-es hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-card-hover active:scale-[0.98] sm:gap-2.5 sm:px-3 sm:py-4"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-mauve-soft to-cream text-mauve transition-es group-hover:from-mauve group-hover:to-mauve-dark group-hover:text-cream">
        {icon}
      </span>
      <span className="text-[12px] font-medium leading-tight text-plum sm:text-[13.5px]">{label}</span>
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
