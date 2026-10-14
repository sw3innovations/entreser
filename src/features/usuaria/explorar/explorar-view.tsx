'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ESSkeleton, EmptyState, SearchIcon } from '@/components/ui'
import { cn } from '@/lib/utils'
import { TelaSuave, Secao, Carrossel, Capa, CartazConteudo, SearchField, ErrorRetry, seloConteudo, HeartIcon, ClockIcon, SparkleIcon, UsersIcon } from '../ui'
import { conteudoHref, formatDuracao, type ContentItemVM } from '../lib/content'
import { useExplorar } from '../conteudos/use-explorar'
import { useMinhaFase } from '../fase/use-minha-fase'
import { useFeed } from '../feed/use-feed'
import { feedItemToVM } from '../feed/vm'
import { useTrilhas } from '../trilhas/use-trilhas'
import type { ConteudoResumo } from '../conteudos/types'
import type { TrilhaResumo } from '../trilhas/types'

function resumoToVM(c: ConteudoResumo): ContentItemVM {
  return {
    id: c.id,
    title: c.titulo,
    formato: c.formato,
    duration: formatDuracao(c.formato, c.duracao),
    meta: c.tags[0]?.nome,
    thumbUrl: c.thumb,
    consumido: c.consumido,
    href: conteudoHref(c.id),
  }
}

/** Ícone por tema, quando o nome casar; os demais ficam com o brilho. */
function iconeDoTema(nome: string) {
  const n = nome.toLowerCase()
  if (/rela|casal|parceir/.test(n)) return <HeartIcon size={17} />
  if (/espera|tempo/.test(n)) return <ClockIcon size={17} />
  if (/grupo|rede|apoio/.test(n)) return <UsersIcon size={17} />
  return <SparkleIcon size={17} />
}

/**
 * ExplorarView — o antigo Feed, sem as abas "Para você / Trilhas / Explorar" (protótipo 1c).
 * Era navegação fragmentada: três telas para a mesma pergunta, "o que tem aqui pra mim?".
 * Agora é uma vitrine só, em carrosséis, nesta ordem: busca → temas → destaques → Para você →
 * Trilhas → Por tema. Com busca ou tema escolhido, a vitrine dá lugar aos resultados.
 */
export function ExplorarView() {
  const { query, setQuery, tag, setTag, allTags, resultados, loading, error, buscando, reload } = useExplorar()
  const { data: minhaFase } = useMinhaFase()
  const temFase = Boolean(minhaFase?.atual)
  const { itens: feed, loading: feedLoading } = useFeed({ tamanho: 10, enabled: temFase })
  const { trilhas, loading: trilhasLoading } = useTrilhas()

  const filtrando = buscando || tag !== null
  const todos = resultados.map(resumoToVM)
  const paraVoce = temFase ? feed.map(feedItemToVM) : todos.slice(3, 11)
  // Destaques: os três primeiros com mídia, completando com o que houver. Fora do "Para você"
  // para a mesma peça não aparecer duas vezes seguidas.
  // Com acervo pequeno, a regra anti-repetição esvaziaria o hero — aí repetir é melhor do que
  // abrir a tela sem destaque nenhum.
  const candidatos = [...todos.filter((c) => c.formato !== 'artigo'), ...todos.filter((c) => c.formato === 'artigo')]
  const semRepetir = candidatos.filter((c) => !paraVoce.slice(0, 4).some((p) => p.id === c.id))
  const destaques = (semRepetir.length > 0 ? semRepetir : candidatos).slice(0, 3)

  return (
    <TelaSuave>
      <h1 className="font-display text-[34px] font-normal leading-[1.05] text-plum lg:text-[40px]">Explorar</h1>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Buscar artigos, áudios, trilhas…"
        className="mt-4 rounded-full border-plum/[0.06] lg:max-w-xl"
      />

      {/* Temas — "Tudo" limpa o filtro. Carrossel no mobile, linha que quebra no desktop. */}
      {allTags.length > 0 && (
        <div className="-mx-[22px] mt-3.5 flex gap-2 overflow-x-auto px-[22px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:px-0">
          <ChipTema ativo={tag === null} onClick={() => setTag(null)}>Tudo</ChipTema>
          {allTags.map((t) => (
            <ChipTema key={t.id} ativo={tag === t.id} onClick={() => setTag(tag === t.id ? null : t.id)}>
              {t.nome}
            </ChipTema>
          ))}
        </div>
      )}

      {error ? (
        <div className="mt-6">
          <ErrorRetry message={error} onRetry={reload} />
        </div>
      ) : filtrando ? (
        <Resultados itens={todos} carregando={loading} buscando={buscando} query={query} />
      ) : (
        <>
          <Destaques itens={destaques} carregando={loading} />

          <Secao titulo="Para você">
            {(temFase ? feedLoading : loading) ? (
              <CarrosselEsqueleto altura={196} />
            ) : paraVoce.length === 0 ? (
              <p className="text-[14px] text-plum/55">Novos conteúdos aparecem aqui assim que forem publicados.</p>
            ) : (
              <Carrossel grade="lg:grid-cols-4">
                {paraVoce.slice(0, 8).map((item) => (
                  <CartazSobreposto key={item.id} item={item} />
                ))}
              </Carrossel>
            )}
          </Secao>

          <Secao titulo="Trilhas" link={{ href: '/trilhas', rotulo: 'Ver todas' }}>
            {trilhasLoading ? (
              <CarrosselEsqueleto altura={176} largura="w-[236px]" />
            ) : trilhas.length === 0 ? (
              <p className="text-[14px] text-plum/55">Novas trilhas aparecem aqui assim que forem publicadas.</p>
            ) : (
              <Carrossel grade="lg:grid-cols-3">
                {trilhas.map((t) => (
                  <CartaoTrilha key={t.id} trilha={t} />
                ))}
              </Carrossel>
            )}
          </Secao>

          {allTags.length > 0 && (
            <Secao titulo="Por tema">
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {allTags.slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTag(t.id)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="flex items-center gap-2.5 rounded-[18px] bg-white px-3.5 py-3.5 text-left shadow-[0_4px_16px_rgba(45,24,64,0.06)] transition-es hover:shadow-card-hover"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mauve-ghost text-mauve">
                      {iconeDoTema(t.nome)}
                    </span>
                    <span className="text-[13.5px] font-semibold leading-tight text-plum">{t.nome}</span>
                  </button>
                ))}
              </div>
            </Secao>
          )}
        </>
      )}
    </TelaSuave>
  )
}

function ChipTema({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'shrink-0 rounded-full px-[15px] py-[9px] text-[13px] font-semibold transition-es',
        ativo ? 'bg-plum text-cream' : 'bg-white text-plum shadow-[0_2px_10px_rgba(45,24,64,0.05)] hover:bg-white/70',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Destaques — o hero do Explorar: cards largos com imagem, um por vez no mobile (com os
 * pontinhos de posição), três lado a lado no desktop.
 */
function Destaques({ itens, carregando }: { itens: ContentItemVM[]; carregando: boolean }) {
  const trilho = useRef<HTMLDivElement>(null)
  const [atual, setAtual] = useState(0)

  if (carregando) return <ESSkeleton variant="rectangular" height={290} className="mt-5 rounded-[24px]" />
  if (itens.length === 0) return null

  return (
    <div className="mt-5">
      <div
        ref={trilho}
        onScroll={(e) => {
          const el = e.currentTarget
          const largura = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth
          setAtual(Math.round(el.scrollLeft / (largura + 12)))
        }}
        className="-mx-[22px] flex snap-x snap-mandatory scroll-px-[22px] gap-3 overflow-x-auto px-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0"
      >
        {itens.map((item, i) => (
          <Link key={item.id} href={item.href} className="group block w-[86%] shrink-0 snap-start lg:w-auto">
            <Capa
              src={item.thumbUrl}
              chave={item.id}
              selo={seloConteudo(item)}
              veu
              posicao="40% 40%"
              className="h-[290px] rounded-[24px] shadow-[0_12px_34px_rgba(45,24,64,0.16)] transition-es group-hover:shadow-[0_16px_40px_rgba(45,24,64,0.24)]"
            >
              <div className="absolute inset-x-[18px] bottom-[18px]">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mauve-soft">
                  {i === 0 ? 'Destaque' : 'Novo'}
                  {item.meta ? ` · ${item.meta}` : ''}
                </p>
                <h2 className="line-clamp-2 font-display text-[24px] font-normal leading-[1.12] text-cream">{item.title}</h2>
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-plum">
                    {item.formato === 'artigo' ? (
                      <span className="text-[13px] font-bold">→</span>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M7 4v16l13-8z" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[12.5px] text-cream/85">{item.formato === 'artigo' ? 'Ler agora' : 'Assistir agora'}</span>
                </div>
              </div>
            </Capa>
          </Link>
        ))}
      </div>
      {itens.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5 lg:hidden" aria-hidden>
          {itens.map((it, i) => (
            <span key={it.id} className={cn('h-1.5 rounded-full transition-all', i === atual ? 'w-5 bg-mauve' : 'w-1.5 bg-plum/15')} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Card do "Para você" do Explorar: título SOBRE a imagem (no Home, o título fica embaixo). */
function CartazSobreposto({ item }: { item: ContentItemVM }) {
  return (
    <Link href={item.href} className="group block w-[164px] shrink-0 snap-start lg:w-auto">
      <Capa src={item.thumbUrl} chave={item.id} veu className="h-[210px] rounded-[20px] transition-es group-hover:shadow-card-hover">
        <div className="absolute inset-x-3 bottom-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mauve-soft">{seloConteudo(item)}</p>
          <p className="mt-1 line-clamp-3 font-display text-[17px] leading-[1.15] text-cream">{item.title}</p>
        </div>
      </Capa>
    </Link>
  )
}

/**
 * Cartão de trilha: imagem em cima, título e situação embaixo. Situação em PALAVRAS, não em
 * barra de porcentagem — trilha não é tarefa a cumprir (princípio do produto, e a mesma regra
 * que tirou o "%" da tela da trilha).
 */
function CartaoTrilha({ trilha }: { trilha: TrilhaResumo }) {
  const situacao =
    trilha.consumidos === 0
      ? trilha.total > 0
        ? `${trilha.total} ${trilha.total === 1 ? 'conteúdo' : 'conteúdos'}`
        : 'Trilha'
      : trilha.total > 0 && trilha.consumidos >= trilha.total
        ? 'Você chegou ao fim'
        : 'Em andamento'
  return (
    <Link href={`/trilhas/${trilha.id}`} className="group block w-[236px] shrink-0 snap-start overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(45,24,64,0.07)] transition-es hover:shadow-card-hover lg:w-auto">
      <Capa src={trilha.thumb} chave={trilha.id} posicao="40% 40%" className="h-[112px]" />
      <div className="p-3.5">
        <p className="line-clamp-1 font-display text-[17px] font-medium text-plum">{trilha.titulo}</p>
        <p className={cn('mt-1 text-[12px]', trilha.consumidos > 0 && trilha.consumidos < trilha.total ? 'font-semibold text-mauve' : 'text-plum/50')}>
          {situacao}
        </p>
      </div>
    </Link>
  )
}

function Resultados({ itens, carregando, buscando, query }: { itens: ContentItemVM[]; carregando: boolean; buscando: boolean; query: string }) {
  if (carregando) {
    return (
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <ESSkeleton key={i} variant="rectangular" height={196} className="rounded-[20px]" />
        ))}
      </div>
    )
  }
  if (itens.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={<SearchIcon />}
          title={buscando ? 'Nada encontrado' : 'Nenhum conteúdo neste tema ainda'}
          description={buscando ? `Não achamos nada para "${query.trim()}". Tente outra palavra.` : 'Novos conteúdos aparecem aqui assim que forem publicados.'}
        />
      </div>
    )
  }
  return (
    <div className="mt-6">
      <p className="mb-3 text-[12.5px] text-plum/55">
        {itens.length} {itens.length === 1 ? 'resultado' : 'resultados'}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {itens.map((item) => (
          <CartazConteudo key={item.id} item={item} largura="w-full" />
        ))}
      </div>
    </div>
  )
}

function CarrosselEsqueleto({ altura, largura = 'w-[164px]' }: { altura: number; largura?: string }) {
  return (
    <Carrossel>
      {[0, 1, 2].map((i) => (
        <ESSkeleton key={i} variant="rectangular" height={altura} className={cn('shrink-0 rounded-[20px] lg:w-auto', largura)} />
      ))}
    </Carrossel>
  )
}
