'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ESButton, EmptyState, CheckIcon } from '@/components/ui'
import { cn } from '@/lib/utils'
import { PageHero, PageContent, HeroIconButton, HeroProgress, ArrowLeftIcon, ChevronRightIcon } from '../ui'
import { conteudoHref, FORMATO_LABEL } from '../lib/content'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { useTrilha } from './use-trilhas'
import type { TrilhaItem } from './types'

/**
 * TrilhaDetailView (UF5) — jornada ordenada de conteúdos (handoff 05). Herói
 * imersivo com progresso (barra creme) + CTA "Continuar →", e uma LINHA DO TEMPO:
 * nós de estado à esquerda (concluído ✓ · atual ● · a seguir nº) ligados por um
 * conector vertical, cada passo num card (tile 72px, formato, título serifado).
 */
export function TrilhaDetailView({ id }: { id: string }) {
  const router = useRouter()
  const { trilha, loading, error, notFound, reload } = useTrilha(id)

  // Volta para a origem (feed, home, busca…) quando há histórico in-app; senão
  // cai na lista de trilhas. Antes era um `href="/trilhas"` — um push pra frente
  // que nunca devolvia a usuária para onde ela veio. Ver `useVoltar`.
  const voltar = useVoltar('/trilhas')
  const backBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  if (loading) return <DetailSkeleton backBar={backBar} />

  if (notFound) {
    return (
      <DetailMessage
        backBar={backBar}
        title="Trilha não encontrada"
        description="Esta trilha não está mais disponível."
        action={
          <ESButton variant="secondary" onPress={() => router.push('/trilhas')}>
            Ver trilhas
          </ESButton>
        }
      />
    )
  }

  if (error || !trilha) {
    return (
      <DetailMessage
        backBar={backBar}
        title="Algo deu errado"
        description={error ?? 'Não foi possível carregar a trilha.'}
        action={<ESButton onPress={reload}>Tentar novamente</ESButton>}
      />
    )
  }

  const proximo = trilha.itens.find((i) => !i.consumido)
  const cta = proximo ?? trilha.itens[0]
  const ctaLabel = trilha.consumidos === 0 ? 'Começar trilha' : proximo ? 'Continuar' : 'Revisar trilha'
  const label = `${trilha.consumidos} de ${trilha.total} ${trilha.total === 1 ? 'conteúdo' : 'conteúdos'}`

  return (
    <div className="min-h-dvh">
      <PageHero width="md" topBar={backBar} eyebrow="Trilha" title={trilha.titulo} description={trilha.descricao || undefined}>
        <div className="mt-5 max-w-md">
          <HeroProgress value={trilha.progresso} label={label} />
        </div>
        {cta && (
          <Link
            href={conteudoHref(cta.conteudoId)}
            className="mt-[22px] inline-flex items-center gap-2.5 rounded-full bg-cream px-[22px] py-[14px] text-[15px] font-semibold text-plum shadow-[0_8px_22px_rgba(0,0,0,0.28)] transition-es hover:bg-cream-mid active:scale-[0.99]"
          >
            {ctaLabel}
            <ChevronRightIcon size={18} />
          </Link>
        )}
      </PageHero>

      <PageContent width="md" className="pb-10 pt-6">
        <p className="text-eyebrow mb-4 px-0.5 text-mauve">Conteúdos da trilha</p>

        {trilha.itens.length === 0 ? (
          <EmptyState title="Trilha sem conteúdos" description="Esta trilha ainda não tem conteúdos publicados." />
        ) : (
          <ol>
            {trilha.itens.map((item, idx) => {
              const current = proximo?.conteudoId === item.conteudoId
              const last = idx === trilha.itens.length - 1
              return (
                <li key={item.conteudoId} className="flex gap-[14px]">
                  {/* Trilho: marcador + conector vertical até o próximo nó */}
                  <div className="flex shrink-0 flex-col items-center">
                    <StepMarker ordem={item.ordem} consumido={item.consumido} current={current} />
                    {!last && <div className="mt-1 min-h-[20px] w-0.5 flex-1 bg-plum/12" aria-hidden />}
                  </div>

                  {/* Passo */}
                  <div className="min-w-0 flex-1 pb-5">
                    {current && <p className="text-eyebrow mb-[10px] mt-2 text-mauve">Continue por aqui</p>}
                    <StepCard item={item} current={current} />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </PageContent>
    </div>
  )
}

/** Marcador (40px) do passo: concluído (✓ mauve) · atual (anel + ponto) · a seguir (nº). */
function StepMarker({ ordem, consumido, current }: { ordem: number; consumido: boolean; current: boolean }) {
  if (consumido) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mauve text-cream shadow-[0_4px_12px_rgba(122,74,92,0.3)]" aria-hidden>
        <CheckIcon size={17} />
      </span>
    )
  }
  if (current) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-mauve bg-white shadow-[0_4px_12px_rgba(122,74,92,0.22)]" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-mauve" />
      </span>
    )
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mauve/10 text-sm font-semibold text-plum/40" aria-hidden>
      {ordem}
    </span>
  )
}

/** Card de um passo: capa 72px, formato (eyebrow), título serifado, e "Concluído"
 *  (verde) OU chevron. O passo atual ganha sombra/borda de destaque. */
function StepCard({ item, current }: { item: TrilhaItem; current: boolean }) {
  return (
    <Link href={conteudoHref(item.conteudoId)} className="block">
      <div
        className={cn(
          'flex items-center gap-[13px] rounded-[18px] bg-white p-3 transition-es hover:shadow-card-hover active:scale-[0.99]',
          current
            ? 'border border-mauve/[0.18] shadow-[0_8px_22px_rgba(45,24,64,0.12)]'
            : 'border border-white/60 shadow-[0_4px_16px_rgba(45,24,64,0.07)]',
        )}
      >
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px]">
          {item.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mauve-soft to-cream-mid text-plum/30">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.1em] text-mauve">{FORMATO_LABEL[item.formato]}</p>
          <h4 className="line-clamp-2 font-display text-[16.5px] font-medium leading-[1.2] text-plum">{item.titulo}</h4>
          {item.consumido && (
            <span className="mt-[6px] inline-flex items-center gap-[5px] text-xs font-semibold text-success-dark">
              <CheckIcon size={13} />
              Concluído
            </span>
          )}
        </div>
        {!item.consumido && <ChevronRightIcon size={18} className="shrink-0 text-plum/30" />}
      </div>
    </Link>
  )
}

function DetailMessage({
  backBar,
  title,
  description,
  action,
}: {
  backBar: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="min-h-dvh">
      <PageHero width="md" topBar={backBar} />
      <PageContent width="md" className="pt-2">
        <EmptyState title={title} description={description} action={action} />
      </PageContent>
    </div>
  )
}

function DetailSkeleton({ backBar }: { backBar: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <PageHero width="md" topBar={backBar}>
        <div className="mt-2 space-y-3">
          <div className="h-3.5 w-1/3 animate-pulse rounded bg-white/20" />
          <div className="h-7 w-3/5 animate-pulse rounded bg-white/20" />
          <div className="mt-4 h-1.5 w-full max-w-md animate-pulse rounded-full bg-white/15" />
        </div>
      </PageHero>
      <PageContent width="md" className="space-y-3 pb-10 pt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-[18px] bg-white/50" />
        ))}
      </PageContent>
    </div>
  )
}
