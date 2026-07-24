'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { mdToHtml } from '@/lib/markdown'

type Tab = 'escrever' | 'dividir' | 'preview'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  error?: string
  /** Rótulo do campo. Default "Corpo do artigo" (uso histórico). */
  label?: string
  /** Quando true, marca o campo como "(opcional)" em vez de obrigatório (*). */
  optional?: boolean
}

/**
 * Editor de Markdown do corpo do artigo — toolbar de formatação, abas
 * escrever/dividir/preview e contador. O preview é gerado por um conversor
 * leve markdown→HTML (conteúdo é autorado por admin/profissional confiável).
 */
export function MarkdownEditor({ value, onChange, error, label = 'Corpo do artigo', optional = false }: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<Tab>('escrever')

  const apply = (
    fn: (v: string, s: number, e: number, sel: string) => { text: string; selStart: number; selEnd: number },
  ) => {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = value.slice(start, end)
    const { text, selStart, selEnd } = fn(value, start, end, sel)
    onChange(text)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(selStart, selEnd)
    })
  }
  const wrap = (before: string, after = before, ph = '') =>
    apply((v, s, e, sel) => {
      const inner = sel || ph
      const text = v.slice(0, s) + before + inner + after + v.slice(e)
      return { text, selStart: s + before.length, selEnd: s + before.length + inner.length }
    })
  const linePrefix = (prefix: string) =>
    apply((v, s, e) => {
      const ls = v.lastIndexOf('\n', s - 1) + 1
      const block = v.slice(ls, e)
      const replaced = block.split('\n').map((ln) => prefix + ln).join('\n')
      const text = v.slice(0, ls) + replaced + v.slice(e)
      return { text, selStart: ls, selEnd: ls + replaced.length }
    })
  const ordered = () =>
    apply((v, s, e) => {
      const ls = v.lastIndexOf('\n', s - 1) + 1
      const block = v.slice(ls, e) || 'item'
      const replaced = block.split('\n').map((ln, idx) => `${idx + 1}. ${ln}`).join('\n')
      const text = v.slice(0, ls) + replaced + v.slice(e)
      return { text, selStart: ls, selEnd: ls + replaced.length }
    })
  const insert = (str: string) =>
    apply((v, s) => {
      const nl = s > 0 && v[s - 1] !== '\n' ? '\n' : ''
      const text = v.slice(0, s) + nl + str + v.slice(s)
      return { text, selStart: s + nl.length + str.length, selEnd: s + nl.length + str.length }
    })

  const words = (value.trim().match(/\S+/g) || []).length

  const textarea = (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Escreva em Markdown… Use a barra de ferramentas ou digite **negrito**, ## títulos, - listas."
      className="h-full min-h-[300px] w-full resize-none border-none bg-transparent px-[18px] py-4 font-mono text-sm leading-[1.7] text-plum outline-none"
    />
  )
  const preview = (
    <div
      className="h-full min-h-[300px] overflow-y-auto px-5 py-4 font-body text-[14.5px]"
      dangerouslySetInnerHTML={{ __html: mdToHtml(value) }}
    />
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-plum/70">
        {label}{' '}
        {optional ? (
          <span className="font-normal text-plum/40">(opcional)</span>
        ) : (
          <span className="text-red-alert">*</span>
        )}
      </span>
      <div className={cn('overflow-hidden rounded-2xl border bg-white', error ? 'border-red-alert' : 'border-cream-dark')}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-plum/8 bg-cream px-2 py-1.5">
          <ToolBtn label="Título 1" onClick={() => linePrefix('# ')} icon={TB.h1} />
          <ToolBtn label="Título 2" onClick={() => linePrefix('## ')} icon={TB.h2} />
          <ToolBtn label="Título 3" onClick={() => linePrefix('### ')} icon={TB.h3} />
          <ToolSep />
          <ToolBtn label="Negrito" onClick={() => wrap('**', '**', 'negrito')} icon={TB.bold} />
          <ToolBtn label="Itálico" onClick={() => wrap('*', '*', 'itálico')} icon={TB.italic} />
          <ToolBtn label="Tachado" onClick={() => wrap('~~', '~~', 'tachado')} icon={TB.strike} />
          <ToolBtn label="Código" onClick={() => wrap('`', '`', 'código')} icon={TB.code} />
          <ToolSep />
          <ToolBtn label="Citação" onClick={() => linePrefix('> ')} icon={TB.quote} />
          <ToolBtn label="Lista" onClick={() => linePrefix('- ')} icon={TB.ul} />
          <ToolBtn label="Lista numerada" onClick={ordered} icon={TB.ol} />
          <ToolSep />
          <ToolBtn label="Link" onClick={() => wrap('[', '](https://)', 'texto')} icon={TB.link} />
          <ToolBtn label="Imagem" onClick={() => insert('![descrição](https://)')} icon={TB.image} />
          <ToolBtn label="Divisória" onClick={() => insert('---\n')} icon={TB.hr} />
          <div className="ml-auto flex gap-0.5 rounded-[10px] bg-plum/5 p-[3px]">
            <TabBtn label="Escrever" active={tab === 'escrever'} onClick={() => setTab('escrever')} />
            <TabBtn label="Dividir" active={tab === 'dividir'} onClick={() => setTab('dividir')} />
            <TabBtn label="Pré-visualizar" active={tab === 'preview'} onClick={() => setTab('preview')} />
          </div>
        </div>

        {/* Corpo */}
        {tab === 'dividir' ? (
          <div className="grid grid-cols-2">
            <div className="border-r border-plum/8">{textarea}</div>
            <div className="bg-cream/35">{preview}</div>
          </div>
        ) : tab === 'preview' ? (
          preview
        ) : (
          textarea
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-plum/8 bg-cream px-3.5 py-2">
          <span className="text-xs text-plum/45">
            Markdown suportado · **negrito**, *itálico*, ## título, - lista, &gt; citação, [link](url)
          </span>
          <span className="text-xs text-plum/50">
            {words} {words === 1 ? 'palavra' : 'palavras'} · {value.length} caracteres
          </span>
        </div>
      </div>
      {error && <span className="text-xs text-red-alert">{error}</span>}
    </div>
  )
}

function ToolBtn({ label, onClick, icon }: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-plum/60 transition-colors hover:bg-mauve/12 hover:text-mauve-dark"
    >
      {icon}
    </button>
  )
}
function ToolSep() {
  return <span className="mx-1 h-5 w-px self-center bg-plum/10" />
}
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-[5px] text-[12.5px] font-medium transition-colors',
        active ? 'bg-white text-mauve-dark shadow-[0_1px_2px_rgba(45,24,64,0.10)]' : 'text-plum/50',
      )}
    >
      {label}
    </button>
  )
}

/* ── Ícones da toolbar ── */
function mk(children: ReactNode) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}
const TB = {
  bold: mk(<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />),
  italic: mk(<path d="M19 4h-9M14 20H5M15 4 9 20" />),
  strike: mk(<path d="M16 4H9a3 3 0 0 0-2.8 4M4 12h16M14 20H9a3 3 0 0 1-2.8-4" />),
  h1: mk(<><path d="M4 12h8M4 18V6M12 18V6" /><path d="M17 12v6M21 8l-4 4" /></>),
  h2: mk(<><path d="M4 12h8M4 18V6M12 18V6" /><path d="M17 10a2 2 0 1 1 3.5 1.3L17 18h5" /></>),
  h3: mk(<><path d="M4 12h8M4 18V6M12 18V6" /><path d="M17 8h4l-2.5 3a2 2 0 1 1-1.5 3.3" /></>),
  quote: mk(<path d="M3 21c3-1 4-3 4-6H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6c0 5-3 8-7 9M14 21c3-1 4-3 4-6h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6c0 5-3 8-7 9" />),
  ul: mk(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />),
  ol: mk(<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4l2-2.5a1 1 0 0 0-2-1.2" />),
  code: mk(<path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />),
  link: mk(<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />),
  image: mk(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>),
  hr: mk(<path d="M4 12h16" />),
}
