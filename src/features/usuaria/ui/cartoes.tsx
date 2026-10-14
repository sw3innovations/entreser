import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Capa } from './capa'
import { FORMATO_LABEL, type ContentItemVM } from '../lib/content'

/** "Artigo · 4 min" — formato e duração curta, para o selo sobre a capa. */
export function seloConteudo(item: Pick<ContentItemVM, 'formato' | 'duration'>): string {
  const dur = item.duration?.replace(' de leitura', '')
  return dur ? `${FORMATO_LABEL[item.formato]} · ${dur}` : FORMATO_LABEL[item.formato]
}

/**
 * CartazConteudo — o card vertical do redesenho ("Para você"): capa alta com selo, título
 * serifado por baixo. Imagem primeiro, porque a pessoa reconhece o conteúdo pela imagem antes
 * de ler — o card antigo era uma linha de texto com um ícone.
 */
export function CartazConteudo({
  item,
  largura = 'w-[164px]',
  altura = 'h-[196px]',
}: {
  item: ContentItemVM
  largura?: string
  altura?: string
}) {
  return (
    <Link href={item.href} className={cn('group block shrink-0 snap-start lg:w-auto', largura)}>
      <Capa
        src={item.thumbUrl}
        chave={item.id}
        selo={seloConteudo(item)}
        className={cn('rounded-[20px] transition-es group-hover:shadow-card-hover', altura)}
      />
      <p className="mt-[9px] line-clamp-2 font-display text-[17px] font-medium leading-[1.2] text-plum">{item.title}</p>
    </Link>
  )
}
