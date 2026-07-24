'use client'

import type { ReactNode } from 'react'
import { ESSpinner, EmptyState, SearchIcon } from '@/components/ui'
import { PosterCard, ReadingRow, RecommendedBanner, SearchField, ErrorRetry } from '../ui'
import { conteudoHref, formatDuracao, type ContentItemVM } from '../lib/content'
import { useExplorar } from '../conteudos/use-explorar'
import type { ConteudoResumo, Formato } from '../conteudos/types'

const TIPO_LABEL: Record<Formato, string> = { artigo: 'Artigos', video: 'Vídeos', audio: 'Áudios', imagem: 'Imagens' }

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

/**
 * Aba "Explorar" — descoberta curada por tipo (handoff 2c): busca (UF3) +
 * destaque recomendado + trilhas horizontais de Vídeos/Áudios + lista de Artigos.
 * "Ver todos →" filtra por formato (UF4). A navegação por tag do design anterior
 * não faz parte deste handoff — pode voltar como filtro se o produto quiser.
 */
export function FeedExplorarTab() {
  const { query, setQuery, formato, setFormato, resultados, loading, error, buscando, reload } = useExplorar()

  const curada = !buscando && !formato

  return (
    <div>
      <SearchField value={query} onChange={setQuery} />

      {loading ? (
        <div className="flex justify-center py-16">
          <ESSpinner label="Carregando…" />
        </div>
      ) : error ? (
        <div className="mt-[18px]">
          <ErrorRetry message={error} onRetry={reload} />
        </div>
      ) : curada ? (
        <Curada resultados={resultados} onVerTodos={setFormato} />
      ) : (
        <Resultados
          resultados={resultados}
          buscando={buscando}
          query={query}
          formato={formato}
          onVoltar={() => setFormato(null)}
        />
      )}
    </div>
  )
}

function Curada({ resultados, onVerTodos }: { resultados: ConteudoResumo[]; onVerTodos: (f: Formato) => void }) {
  const videos = resultados.filter((c) => c.formato === 'video')
  const audios = resultados.filter((c) => c.formato === 'audio')
  const artigos = resultados.filter((c) => c.formato === 'artigo')
  const recomendado = videos[0] ?? resultados[0]

  return (
    <>
      {recomendado && (
        <div className="mt-[18px]">
          <RecommendedBanner item={resumoToVM(recomendado)} />
        </div>
      )}

      {videos.length > 0 && (
        <Secao title="Vídeos" onVerTodos={() => onVerTodos('video')} className="mt-[26px]">
          <Carrossel itens={videos} />
        </Secao>
      )}

      {audios.length > 0 && (
        <Secao title="Áudios" onVerTodos={() => onVerTodos('audio')} className="mt-6">
          <Carrossel itens={audios} />
        </Secao>
      )}

      {artigos.length > 0 && (
        <Secao title="Artigos" onVerTodos={() => onVerTodos('artigo')} className="mt-6">
          <div className="mt-[13px] flex flex-col gap-[11px]">
            {artigos.map((c) => (
              <ReadingRow key={c.id} item={resumoToVM(c)} trailing="chevron" />
            ))}
          </div>
        </Secao>
      )}
    </>
  )
}

/** Cabeçalho de seção do handoff Explorar: título serifado 22px + "Ver todos →". */
function Secao({
  title,
  onVerTodos,
  className,
  children,
}: {
  title: string
  onVerTodos: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[22px] font-medium leading-none text-plum">{title}</h3>
        <button
          type="button"
          onClick={onVerTodos}
          className="whitespace-nowrap text-[12.5px] text-mauve transition-es hover:text-mauve-dark"
        >
          Ver todos →
        </button>
      </div>
      {children}
    </section>
  )
}

/** Carrossel horizontal de PosterCards (200px), sangrando ao gutter no mobile. */
function Carrossel({ itens }: { itens: ConteudoResumo[] }) {
  return (
    <div
      className="-mx-5 mt-[13px] flex snap-x snap-mandatory scroll-px-5 gap-3.5 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6"
      style={{ scrollbarWidth: 'none' }}
    >
      {itens.map((c) => (
        <div key={c.id} className="w-[200px] shrink-0 snap-start">
          <PosterCard item={resumoToVM(c)} />
        </div>
      ))}
    </div>
  )
}

/** Resultados de busca (UF3) ou de "Ver todos" por formato (UF4). */
function Resultados({
  resultados,
  buscando,
  query,
  formato,
  onVoltar,
}: {
  resultados: ConteudoResumo[]
  buscando: boolean
  query: string
  formato: Formato | null
  onVoltar: () => void
}) {
  const usarPoster = !buscando && (formato === 'video' || formato === 'audio')
  const titulo = buscando ? `Resultados para “${query.trim()}”` : formato ? TIPO_LABEL[formato] : 'Resultados'

  return (
    <div className="mt-[18px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-eyebrow text-mauve">{titulo}</p>
        {!buscando && formato && (
          <button
            type="button"
            onClick={onVoltar}
            className="whitespace-nowrap text-[12.5px] text-mauve transition-es hover:text-mauve-dark"
          >
            ← Voltar
          </button>
        )}
      </div>

      {resultados.length === 0 ? (
        <EmptyState
          icon={<SearchIcon />}
          title="Nenhum conteúdo"
          description={buscando ? `Nada encontrado para “${query.trim()}”.` : 'Nada por aqui ainda.'}
        />
      ) : usarPoster ? (
        <div className="grid grid-cols-2 gap-3.5">
          {resultados.map((c) => (
            <PosterCard key={c.id} item={resumoToVM(c)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-[11px]">
          {resultados.map((c) => (
            <ReadingRow key={c.id} item={resumoToVM(c)} trailing="chevron" />
          ))}
        </div>
      )}
    </div>
  )
}
