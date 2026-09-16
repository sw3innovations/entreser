'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ESButton, ESSpinner, EmptyState } from '@/components/ui'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '../ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { useHydrated } from '@/lib/use-hydrated'
import { useTrilha } from './use-trilhas'
import { lerReflexao } from './reflexao'
import { useReflexao } from './use-reflexao'
import type { TrilhaItem } from './types'

/**
 * TrilhaFimView — o fechamento de uma trilha. A trilha antes "terminava" quando a barra
 * chegava a 100% e a pessoa ficava olhando para a lista de onde tinha saído. Agora
 * termina num lugar: reúne o que ela escreveu ao longo do caminho (as reflexões de cada
 * passo, que ficam no aparelho dela) e oferece uma última nota — "o que vale guardar".
 *
 * Sem confete, sem troféu, sem "parabéns, você concluiu 100%": atravessar um tratamento
 * não é conquista a comemorar. O tom é o de fechar um caderno — e a tela é curta de
 * propósito, para que os dois botões do fim sejam a única coisa a decidir.
 *
 * Os botões seguem o idioma da Usuária (pílulas de 50px, como a barra do leitor e os
 * diálogos do M04), não o `ESButton` do kit compartilhado (40px): ela acabou de sair do
 * leitor, e o fechamento é a continuação dele — misturar os dois idiomas na mesma tela era
 * o que fazia "Voltar" e "Rever" parecerem de apps diferentes.
 */
export function TrilhaFimView({ id }: { id: string }) {
  const router = useRouter()
  const { trilha, loading, error, notFound, reload } = useTrilha(id)
  const voltar = useVoltar(`/trilhas/${id}`)

  const backBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  if (loading) {
    return (
      <div className="min-h-dvh">
        <PageHero width="md" topBar={backBar} />
        <div className="flex justify-center py-16">
          <ESSpinner label="Carregando…" />
        </div>
      </div>
    )
  }

  if (notFound || error || !trilha) {
    return (
      <div className="min-h-dvh">
        <PageHero width="md" topBar={backBar} />
        <PageContent width="md" className="pt-2">
          <EmptyState
            title={notFound ? 'Trilha não encontrada' : 'Algo deu errado'}
            description={notFound ? 'Esta trilha não está mais disponível.' : (error ?? 'Não foi possível carregar a trilha.')}
            action={
              notFound ? (
                <ESButton variant="secondary" onPress={() => router.push('/trilhas')}>Ver trilhas</ESButton>
              ) : (
                <ESButton onPress={reload}>Tentar novamente</ESButton>
              )
            }
          />
        </PageContent>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-16">
      {/* O eyebrow é a trilha e a descrição é a frase de fechamento — não o contrário:
          "Atravessar a espera" como subtítulo de "Você chegou ao fim" lia como rótulo. */}
      <PageHero
        width="md"
        topBar={backBar}
        eyebrow={trilha.titulo}
        title="Você chegou ao fim"
        description="Não precisa levar tudo daqui. Só o que fizer sentido agora."
      />

      <PageContent width="md" className="flex flex-col gap-9 pt-7">
        <ReflexoesDoCaminho itens={trilha.itens} />

        <NotaFinal chave={`trilha:${trilha.id}`} />

        {/* `sm:flex-1`, não `flex-1`: em coluna, `flex-1` vira `flex-basis: 0` no eixo
            vertical e esmaga o `h-[50px]` — os botões saíam com metade da altura no mobile. */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <Link
            href="/trilhas"
            className="flex h-[50px] items-center sm:flex-1 justify-center rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es hover:bg-mauve-dark active:scale-[0.99]"
          >
            Voltar para as trilhas
          </Link>
          <Link
            href={`/trilhas/${trilha.id}`}
            className="flex h-[50px] items-center sm:flex-1 justify-center rounded-full border border-mauve/25 bg-white text-[15px] font-semibold text-mauve transition-es hover:bg-mauve-ghost active:scale-[0.99]"
          >
            Rever a trilha
          </Link>
        </div>
      </PageContent>
    </div>
  )
}

/**
 * O que ela escreveu em cada passo, na ordem do caminho. Só os passos que têm reflexão —
 * se não escreveu nada, a seção some em vez de listar vazios. São palavras DELA, então a
 * peça é quieta: um filete mauve à esquerda, o passo em eyebrow, o texto em corpo. Nada
 * de cartão com sombra competindo com a nota final.
 */
function ReflexoesDoCaminho({ itens }: { itens: TrilhaItem[] }) {
  // localStorage só existe no cliente: antes da hidratação a lista é vazia, depois é lida
  // direto no render — sem estado, porque aqui ninguém edita.
  const hidratado = useHydrated()
  const reflexoes = hidratado
    ? itens.map((item) => ({ item, texto: lerReflexao(item.conteudoId) })).filter((r) => r.texto.trim().length > 0)
    : []

  if (reflexoes.length === 0) return null

  return (
    <section>
      <p className="text-eyebrow mb-4 px-0.5 text-mauve">O que você escreveu pelo caminho</p>
      <ol className="flex flex-col gap-5">
        {reflexoes.map(({ item, texto }) => (
          <li key={item.conteudoId} className="border-l-2 border-mauve-soft pl-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-plum/40">{item.titulo}</p>
            <p className="mt-1.5 whitespace-pre-line text-[16px] leading-relaxed text-plum [overflow-wrap:anywhere]">{texto}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** "O que vale guardar" — a última nota da trilha, com o mesmo tratamento das reflexões. */
function NotaFinal({ chave }: { chave: string }) {
  const [texto, setTexto] = useReflexao(chave)

  return (
    <section className="rounded-card border border-mauve/15 bg-mauve-ghost/60 p-5">
      <label htmlFor="nota-final" className="block">
        <span className="font-display text-[22px] leading-tight text-plum">O que vale guardar?</span>
        <span className="mt-1.5 block text-[13px] leading-relaxed text-plum/55">
          Uma frase, uma palavra, o que você quiser levar daqui. Fica só com você.
        </span>
      </label>
      <textarea
        id="nota-final"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Escreva com suas palavras…"
        className="mt-4 w-full resize-none rounded-input border border-plum/10 bg-white px-4 py-3 text-[15px] leading-relaxed text-plum placeholder:text-plum/30 focus:border-mauve focus:outline-none focus:ring-1 focus:ring-mauve"
      />
    </section>
  )
}
