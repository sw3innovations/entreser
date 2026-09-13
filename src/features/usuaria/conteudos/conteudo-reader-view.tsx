'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ESButton, EmptyState, CheckIcon } from '@/components/ui'
import { mdToHtml } from '@/lib/markdown'
import { PageHero, PageContent, HeroIconButton, GlassCard, AudioPlayer, ReadingRow, ArrowLeftIcon, ChevronRightIcon } from '@/features/usuaria/ui'
import { conteudoHref, FORMATO_LABEL, formatDuracao } from '@/features/usuaria/lib/content'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { useTrilhaContexto, type TrilhaContexto } from '@/features/usuaria/trilhas/use-trilha-contexto'
import { useReflexao } from '@/features/usuaria/trilhas/use-reflexao'
import { useConteudo } from './use-conteudo'
import { useRecentes } from './use-recentes'
import { conteudoResumoToVM } from './vm'

/* Ícones inline (não há clock/bookmark no kit). */
function ClockIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function BookmarkIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </svg>
  )
}

/**
 * Estilos de prosa do card de leitura. Os `!` existem porque o `mdToHtml` grava cor,
 * entrelinha e margem INLINE em cada `<p>` (ele também serve o preview do backoffice, que
 * não tem esta folha). Sem o `!`, o corpo ficava em 15px cinza-ameixa a 85% — texto de app,
 * não de leitura. Aqui a prosa é maior, em ameixa cheio e com mais ar: é o que a pessoa
 * vai encarar por vários minutos seguidos.
 *
 * O `hr` do markdown vira uma PAUSA: a autora escreve `---` e a leitora encontra um respiro
 * ("Respire um pouco…"), não um filete. A regra vive em `globals.css` (`.leitura hr`) porque
 * precisa de `::before` com texto, que classe utilitária não expressa bem.
 */
const PROSE = cn(
  'leitura',
  // Com `!` porque as margens dos títulos abaixo também têm `!` — sem isso, um h2 no topo
  // do artigo abria 36px a mais entre o hero e a primeira linha.
  '[&>*:first-child]:!mt-0 [&>*:last-child]:!mb-0',
  '[&_h2]:!mb-3 [&_h2]:!mt-9 [&_h2]:font-display [&_h2]:!text-[24px] [&_h2]:font-medium [&_h2]:leading-[1.2] [&_h2]:text-plum',
  '[&_h3]:!mb-3 [&_h3]:!mt-8 [&_h3]:font-display [&_h3]:!text-[20px] [&_h3]:font-medium [&_h3]:leading-[1.25] [&_h3]:text-plum',
  '[&_p]:!mb-6 [&_p]:!text-[17px] [&_p]:!leading-[1.8] [&_p]:!text-plum',
  '[&_strong]:font-semibold [&_strong]:text-plum',
  '[&_a]:text-mauve [&_a]:underline',
  '[&_ul]:!mb-6 [&_ul]:!mt-0 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:!gap-3 [&_ul]:!p-0',
  '[&_ol]:!mb-6 [&_ol]:!mt-0 [&_ol]:flex [&_ol]:flex-col [&_ol]:!gap-3 [&_ol]:!pl-5 [&_ol]:text-[16.5px] [&_ol]:text-plum',
  '[&_ul>li]:relative [&_ul>li]:pl-5 [&_ul>li]:text-[16.5px] [&_ul>li]:leading-[1.6] [&_ul>li]:text-plum',
  "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[11px] [&_ul>li]:before:h-1.5 [&_ul>li]:before:w-1.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-mauve [&_ul>li]:before:content-['']",
  '[&_blockquote]:!my-7 [&_blockquote]:!border-l-2 [&_blockquote]:!border-mauve/40 [&_blockquote]:!pl-5 [&_blockquote]:font-display [&_blockquote]:!text-[21px] [&_blockquote]:leading-[1.45] [&_blockquote]:!not-italic [&_blockquote]:!text-plum',
)

/**
 * ConteudoReaderView (UF6) — leitor de conteúdo: header ameixa (voltar + salvar, eyebrow,
 * título, resumo, tempo), corpo do artigo, e barra fixa (salvar + concluir). Vídeo/áudio
 * mantêm seus players. Tela full-screen (a BottomNav some no leitor).
 *
 * **Modo trilha.** Com `trilhaId`, o mesmo leitor vira um PASSO de um percurso: o eyebrow
 * diz de que trilha ele faz parte, "Voltar" devolve à trilha (não ao feed), o rodapé mostra
 * o próximo passo, e o botão principal vira "Concluir e seguir" — marca e já abre o
 * próximo, ou leva ao fechamento no último. Antes disso a trilha era um sumário: cada
 * conteúdo abria o leitor genérico, que não sabia de onde tinha vindo, sugeria "recentes"
 * no rodapé e, ao concluir, deixava a pessoa parada. Era o que fazia a trilha parecer rasa.
 *
 * Nada aqui conta passos ("2 de 5") de propósito: a trilha mostra ONDE a pessoa está e o
 * que vem a seguir, não quanto falta — não é tarefa a cumprir.
 */
export function ConteudoReaderView({ id, trilhaId }: { id: string; trilhaId: string | null }) {
  const router = useRouter()
  const { conteudo, loading, error, notFound, salvando, toggleConcluido, marcarConcluido, reload } = useConteudo(id)
  const { contexto, carregando: carregandoTrilha } = useTrilhaContexto(id, trilhaId)

  // Volta para onde ela veio quando há histórico in-app; senão, para a trilha (modo
  // trilha) ou para o feed. Ver `useVoltar`/`NavHistoryProvider`.
  const voltar = useVoltar(trilhaId ? `/trilhas/${trilhaId}` : '/feed')

  const backBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  if (loading || (trilhaId && carregandoTrilha)) return <ReaderSkeleton backBar={backBar} />

  if (notFound) {
    return (
      <ReaderMessage
        backBar={backBar}
        title="Conteúdo indisponível"
        description="Este conteúdo não está mais disponível ou foi despublicado."
        action={
          <ESButton variant="secondary" onPress={() => router.push(trilhaId ? `/trilhas/${trilhaId}` : '/feed')}>
            {trilhaId ? 'Voltar à trilha' : 'Voltar ao feed'}
          </ESButton>
        }
      />
    )
  }

  if (error || !conteudo) {
    return (
      <ReaderMessage
        backBar={backBar}
        title="Algo deu errado"
        description={error ?? 'Não foi possível carregar o conteúdo.'}
        action={<ESButton onPress={reload}>Tentar novamente</ESButton>}
      />
    )
  }

  const duracao = formatDuracao(conteudo.formato, conteudo.duracao)
  // No modo trilha o eyebrow diz a que percurso o passo pertence; avulso, diz o formato.
  const eyebrow = contexto
    ? `Trilha · ${contexto.trilha.titulo}`
    : conteudo.tagNome
      ? `${FORMATO_LABEL[conteudo.formato]} · ${conteudo.tagNome}`
      : FORMATO_LABEL[conteudo.formato]

  // ES-F2: mídia e texto podem coexistir. Renderizamos a mídia primeiro (§4 do
  // spec) e o texto abaixo, exibindo só o que existir. `formato != artigo` indica
  // conteúdo com mídia; sem URL (upload ainda mock) mostramos um placeholder.
  const midiaUrl = conteudo.media?.trim() || null
  const formatoMidia = conteudo.formato !== 'artigo'
  const temMidia = formatoMidia && Boolean(midiaUrl)
  const midiaPendente = formatoMidia && !midiaUrl
  const temTexto = Boolean(conteudo.corpo?.trim())

  const topBar = (
    <div className="flex items-center justify-between">
      <HeroIconButton aria-label="Voltar" onPress={voltar}>
        <ArrowLeftIcon />
      </HeroIconButton>
      {/* Salvar (UF8) ainda dormente — botão presente, sem ação por ora. */}
      <HeroIconButton aria-label="Salvar" onPress={() => {}}>
        <BookmarkIcon />
      </HeroIconButton>
    </div>
  )

  return (
    <div className="min-h-dvh pb-28">
      <PageHero width="md" topBar={topBar} eyebrow={eyebrow} title={conteudo.titulo} description={conteudo.descricao || undefined}>
        {duracao && (
          <div className="mt-4 flex items-center gap-2 text-cream/55">
            <ClockIcon />
            <span className="text-[12.5px]">{duracao}</span>
          </div>
        )}
      </PageHero>

      <PageContent width="md" className="pt-6">
        {/* Mídia primeiro (§4): vídeo / áudio / imagem — só quando há URL real */}
        {temMidia && (
          <div className={temTexto ? 'mb-8' : undefined}>
            {conteudo.formato === 'video' ? (
              <GlassCard>
                <video
                  controls
                  playsInline
                  poster={conteudo.thumb ?? undefined}
                  src={midiaUrl ?? undefined}
                  className="aspect-video w-full bg-black"
                >
                  Seu navegador não suporta vídeo.
                </video>
              </GlassCard>
            ) : conteudo.formato === 'imagem' ? (
              <GlassCard>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={midiaUrl ?? undefined} alt={conteudo.titulo} className="w-full" />
              </GlassCard>
            ) : (
              <AudioPlayer src={midiaUrl} titulo={conteudo.titulo} duracao={duracao} />
            )}
          </div>
        )}

        {/* Mídia ainda não subiu (upload mock) — placeholder discreto, não quebra a tela */}
        {midiaPendente && (
          <div
            className={cn(
              'flex items-center justify-center rounded-card border border-dashed border-plum/15 bg-white/50 py-12 text-sm text-plum/45',
              temTexto && 'mb-8',
            )}
          >
            Mídia ainda indisponível.
          </div>
        )}

        {/* Texto depois — direto no fundo, ocupando a coluna */}
        {temTexto && (
          <article className={cn('font-body', PROSE)} dangerouslySetInnerHTML={{ __html: mdToHtml(conteudo.corpo) }} />
        )}

        {/* Sem mídia e sem texto (raro) */}
        {!temMidia && !midiaPendente && !temTexto && (
          <p className="text-sm leading-relaxed text-plum/50">
            Este conteúdo ainda não tem mídia nem texto para exibir.
          </p>
        )}

        {contexto ? (
          <>
            <Reflexao chave={conteudo.id} />
            <ProximoNaTrilha contexto={contexto} />
          </>
        ) : (
          <Relacionados excluirId={conteudo.id} />
        )}
      </PageContent>

      {/* Barra fixa de ação (UF6): salvar + concluir. No modo trilha, concluir SEGUE. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/[0.06] bg-[rgba(255,253,250,0.9)] shadow-[0_-6px_24px_rgba(45,24,64,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-[11px] px-[18px] pb-[18px] pt-[14px]">
          <button
            type="button"
            aria-label="Salvar"
            className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border border-mauve/25 bg-white text-mauve transition-es hover:bg-mauve-ghost active:scale-[0.97]"
          >
            <BookmarkIcon />
          </button>
          {contexto ? (
            <BotaoSeguir
              contexto={contexto}
              consumido={conteudo.consumido}
              salvando={salvando}
              onSeguir={async () => {
                // Marca e só então anda: se salvar falhar, o toast avisa e ela fica.
                const ok = conteudo.consumido || (await marcarConcluido(true))
                if (!ok) return
                router.push(
                  contexto.proximo
                    ? conteudoHref(contexto.proximo.conteudoId, contexto.trilha.id)
                    : `/trilhas/${contexto.trilha.id}/fim`,
                )
              }}
            />
          ) : (
            <button
              type="button"
              onClick={toggleConcluido}
              disabled={salvando}
              className={cn(
                'flex h-[50px] flex-1 items-center justify-center gap-[9px] rounded-full text-[15px] font-semibold transition-es active:scale-[0.99] disabled:opacity-70',
                conteudo.consumido
                  ? 'border border-mauve/30 bg-white text-mauve'
                  : 'bg-mauve text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)]',
              )}
            >
              <CheckIcon size={18} />
              <span>{conteudo.consumido ? 'Concluído' : 'Marcar como concluído'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * O botão principal do modo trilha. Três rótulos, um gesto: "Concluir e seguir" (há próximo),
 * "Concluir a trilha" (é o último passo), "Seguir" (já estava concluído — não repete a
 * marcação, só anda). O gesto único é o ponto: o momento de maior energia do percurso é
 * logo depois de terminar um passo, e ele não pode acabar num botão que só muda de cor.
 */
function BotaoSeguir({
  contexto,
  consumido,
  salvando,
  onSeguir,
}: {
  contexto: TrilhaContexto
  consumido: boolean
  salvando: boolean
  onSeguir: () => void
}) {
  const rotulo = consumido
    ? contexto.ultimo
      ? 'Ver o fechamento'
      : 'Seguir'
    : contexto.ultimo
      ? 'Concluir a trilha'
      : 'Concluir e seguir'
  return (
    <button
      type="button"
      onClick={onSeguir}
      disabled={salvando}
      className="flex h-[50px] flex-1 items-center justify-center gap-[9px] rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99] disabled:opacity-70"
    >
      {!consumido && <CheckIcon size={18} />}
      <span>{salvando ? 'Salvando…' : rotulo}</span>
      <ChevronRightIcon size={18} />
    </button>
  )
}

/**
 * "O que fica pra você disso?" — uma pergunta só, opcional, ao fim de cada passo. É o que
 * faz a trilha pedir algo dela em vez de só ser consumida. Guardada no aparelho (ver
 * `reflexao.ts`); salva a cada pausa na digitação, sem botão.
 */
function Reflexao({ chave }: { chave: string }) {
  const [texto, setTexto] = useReflexao(chave)

  return (
    <section className="mt-10 rounded-card border border-mauve/15 bg-mauve-ghost/60 p-5">
      <label htmlFor={`reflexao-${chave}`} className="block">
        <span className="font-display text-[21px] leading-tight text-plum">O que fica pra você disso?</span>
        <span className="mt-1.5 block text-[13px] leading-relaxed text-plum/55">
          Se quiser. Uma frase basta — e só você vê o que escreve aqui.
        </span>
      </label>
      <textarea
        id={`reflexao-${chave}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="Escreva com suas palavras…"
        className="mt-4 w-full resize-none rounded-input border border-plum/10 bg-white px-4 py-3 text-[15px] leading-relaxed text-plum placeholder:text-plum/30 focus:border-mauve focus:outline-none focus:ring-1 focus:ring-mauve"
      />
    </section>
  )
}

/** Rodapé do modo trilha: o próximo passo, ou o convite ao fechamento no último. */
function ProximoNaTrilha({ contexto }: { contexto: TrilhaContexto }) {
  if (!contexto.proximo) {
    return (
      <section className="mt-8">
        <p className="text-eyebrow mb-[13px] px-0.5 text-mauve">Você chegou ao último passo</p>
        <p className="text-[15px] leading-relaxed text-plum/65">
          Quando terminar, o botão abaixo leva ao fechamento da trilha — um lugar para guardar
          o que valeu a pena.
        </p>
      </section>
    )
  }
  const p = contexto.proximo
  return (
    <section className="mt-8">
      <p className="text-eyebrow mb-[13px] px-0.5 text-mauve">A seguir na trilha</p>
      <ReadingRow
        item={{
          id: p.conteudoId,
          title: p.titulo,
          formato: p.formato,
          duration: formatDuracao(p.formato, p.duracao),
          thumbUrl: p.thumb,
          consumido: p.consumido,
          href: conteudoHref(p.conteudoId, contexto.trilha.id),
        }}
        eyebrow
        trailing="chevron"
      />
    </section>
  )
}

/** "Continue lendo" — relacionados (aproximados por recentes; handoff usa placeholders). */
function Relacionados({ excluirId }: { excluirId: string }) {
  const { itens, loading } = useRecentes(4)
  if (loading) return null
  const rel = itens.filter((c) => c.id !== excluirId).slice(0, 2)
  if (rel.length === 0) return null
  return (
    <section className="mt-6">
      <p className="text-eyebrow mb-[13px] px-0.5 text-mauve">Continue lendo</p>
      <div className="flex flex-col gap-[11px]">
        {rel.map((c) => (
          <ReadingRow key={c.id} item={conteudoResumoToVM(c)} eyebrow trailing="chevron" />
        ))}
      </div>
    </section>
  )
}

function ReaderMessage({
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
      <PageContent width="md" className="pt-6">
        <EmptyState title={title} description={description} action={action} />
      </PageContent>
    </div>
  )
}

function ReaderSkeleton({ backBar }: { backBar: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <PageHero width="md" topBar={backBar}>
        <div className="mt-2 space-y-3">
          <div className="h-3.5 w-2/5 animate-pulse rounded bg-white/20" />
          <div className="h-7 w-4/5 animate-pulse rounded bg-white/20" />
        </div>
      </PageHero>
      <PageContent width="md" className="space-y-3 pt-6">
        {[95, 100, 88, 92, 70].map((w, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-plum/8" style={{ width: `${w}%` }} />
        ))}
      </PageContent>
    </div>
  )
}
