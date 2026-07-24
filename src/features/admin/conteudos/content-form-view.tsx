'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRightIcon,
  ESButton,
  ESCard,
  ESSpinner,
  ImageIcon,
  PageHeader,
  UploadIcon,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useTagOptions } from '@/features/admin/tags/use-tags'
import { estimarLeitura } from './duracao'
import { MarkdownEditor } from './markdown-editor'
import { FORMATO } from './meta'
import { conteudosService } from '.'
import { useConteudoMutations } from './use-conteudos'
import type { Conteudo, Formato } from './types'

/** Teto de duração em minutos (10h) — acima disso é quase sempre erro de digitação. */
const MAX_DURACAO = 600

// Estilos do redesenho (protótipo Claude Design): card branco radius-22 com sombra
// suave; input branco radius-14, borda plum/14 e foco malva.
const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'
const INPUT =
  'w-full rounded-input border border-plum/[0.14] bg-white text-plum outline-none transition-colors placeholder:text-plum/40 focus:border-mauve'

/** Tipos de mídia que um conteúdo pode ter (o formato "artigo" é o caso só-texto). */
type MidiaTipo = Exclude<Formato, 'artigo'>
const MIDIA_TIPOS: MidiaTipo[] = ['video', 'audio', 'imagem']

// ES-F1: o formato deixou de ser um interruptor que esconde campos. O form tem
// SEMPRE um texto (markdown, opcional) e uma mídia (opcional); `formato` é
// derivado — a mídia manda, e sem mídia o conteúdo é um artigo (só texto).
interface FormState {
  titulo: string
  descricao: string
  duracao: string
  corpo: string
  media: string | null
  thumb: string | null
  tags: string[]
}

interface FormErrors {
  titulo?: string
  duracao?: string
  geral?: string
}

export function ContentFormView({ id }: { id?: string }) {
  const router = useRouter()
  const [existing, setExisting] = useState<Conteudo | null | undefined>(id ? undefined : null)

  useEffect(() => {
    if (!id) return
    let ativo = true
    conteudosService
      .getById(id)
      .then((c) => {
        if (ativo) setExisting(c)
      })
      .catch(() => {
        if (ativo) setExisting(null)
      })
    return () => {
      ativo = false
    }
  }, [id])

  if (existing === undefined) {
    return (
      <div>
        <PageHeader title="Editar conteúdo" />
        <ESCard variant="solid" isHoverable={false}>
          <div className="flex justify-center py-16">
            <ESSpinner size="md" label="Carregando conteúdo…" />
          </div>
        </ESCard>
      </div>
    )
  }
  if (id && existing === null) {
    return (
      <div>
        <PageHeader title="Conteúdo não encontrado" />
        <ESCard variant="solid" isHoverable={false}>
          <div className="px-6 py-12 text-center">
            <p className="mb-4 text-[14.5px] text-plum/60">O conteúdo que você tentou abrir não existe.</p>
            <ESButton variant="primary" onPress={() => router.push('/admin/conteudos')}>Voltar à listagem</ESButton>
          </div>
        </ESCard>
      </div>
    )
  }
  return <ContentForm existing={existing} />
}

function ContentForm({ existing }: { existing: Conteudo | null }) {
  const router = useRouter()
  const { add, update } = useConteudoMutations()
  const tags = useTagOptions()
  const editing = Boolean(existing)

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? {
          titulo: existing.titulo,
          descricao: existing.descricao,
          duracao: existing.duracao ? String(existing.duracao) : '',
          corpo: existing.corpo,
          media: existing.media,
          thumb: existing.thumb,
          tags: [...existing.tags],
        }
      : { titulo: '', descricao: '', duracao: '', corpo: '', media: null, thumb: null, tags: [] },
  )
  // Slot de mídia selecionado (vídeo/áudio/imagem). Só vira o `formato` efetivo
  // quando há um arquivo anexado — senão o conteúdo é um artigo (só texto).
  const [midiaTipo, setMidiaTipo] = useState<MidiaTipo>(() =>
    existing && existing.formato !== 'artigo' ? existing.formato : 'video',
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  // ES-006: um conteúdo já salvo COM duração é tratado como manual — não
  // sobrescrevemos silenciosamente um valor que já foi ao ar. Um conteúdo novo
  // (ou sem duração) começa em modo automático, derivando do corpo.
  const [duracaoManual, setDuracaoManual] = useState<boolean>(() => Boolean(existing?.duracao))
  // Status exibido no seletor da coluna de publicação e na pílula do topo. Os
  // botões Salvar rascunho / Publicar são a ação real; este estado só reflete a
  // intenção visível (sincronizado ao salvar).
  const [statusPublicado, setStatusPublicado] = useState<boolean>(existing?.publicado ?? false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const toggleTag = (tagId: string) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tagId) ? f.tags.filter((x) => x !== tagId) : [...f.tags, tagId],
    }))

  const back = () => router.push('/admin/conteudos')

  // Formato derivado: a mídia manda; sem mídia, é artigo (só texto). É o que
  // classifica o conteúdo no feed e o que a leitura usa para decidir o layout.
  const formato: Formato = form.media ? midiaTipo : 'artigo'

  // Sanitiza a duração digitada (só dígitos, no máx. 3) e marca o campo como
  // manual — a partir daí a sugestão automática para de sobrescrever.
  const onDuracaoChange = (v: string) => {
    setDuracaoManual(true)
    set('duracao', v.replace(/\D/g, '').slice(0, 3))
    setErrors((e) => ({ ...e, duracao: undefined }))
  }

  // ES-006: enquanto o campo não for tocado à mão, artigos (só-texto) sugerem o
  // tempo de leitura a partir do corpo. Debounce para não recalcular a cada tecla
  // e não travar a digitação. Com mídia anexada a duração é a do arquivo (manual).
  useEffect(() => {
    if (formato !== 'artigo' || duracaoManual) return
    const corpo = form.corpo
    const t = setTimeout(() => {
      setForm((f) => ({ ...f, duracao: corpo.trim() ? String(estimarLeitura(corpo)) : '' }))
    }, 400)
    return () => clearTimeout(t)
  }, [form.corpo, formato, duracaoManual])

  // ES-F1: anexar/remover a mídia deriva o formato. Ao SAIR de artigo com a
  // duração ainda em modo automático, limpa o valor herdado do corpo — senão a
  // estimativa de leitura ficaria presa e seria salva como "duração" de um vídeo.
  const onMediaChange = (v: string | null) => {
    setForm((f) => ({ ...f, media: v, duracao: v && !duracaoManual ? '' : f.duracao }))
    setErrors((e) => ({ ...e, geral: undefined }))
  }
  // Trocar o tipo de mídia troca o filtro de arquivo aceito; um arquivo do tipo
  // anterior não combina mais, então é descartado.
  const onMidiaTipoChange = (k: MidiaTipo) => {
    setMidiaTipo(k)
    setForm((f) => ({ ...f, media: null }))
  }

  // Sugestão explícita para voltar ao valor calculado depois de ter editado à mão.
  const sugestaoLeitura =
    formato === 'artigo' && form.corpo.trim() ? estimarLeitura(form.corpo) : 0
  const mostrarSugestao = sugestaoLeitura > 0 && duracaoManual && form.duracao !== String(sugestaoLeitura)
  const aplicarSugestao = () => {
    setDuracaoManual(false)
    set('duracao', String(sugestaoLeitura))
    setErrors((e) => ({ ...e, duracao: undefined }))
  }

  const validar = (paraPublicar: boolean): boolean => {
    const e: FormErrors = {}
    if (!form.titulo.trim()) e.titulo = 'Informe o título.'
    else if (form.titulo.trim().length > 200) e.titulo = 'Máximo de 200 caracteres.'
    if (form.duracao) {
      const n = parseInt(form.duracao, 10)
      // O input já sana para dígitos; aqui é rede de segurança para 0 e para o teto.
      if (!Number.isFinite(n) || n <= 0) e.duracao = 'Informe uma duração em minutos.'
      else if (n > MAX_DURACAO) e.duracao = `Máximo de ${MAX_DURACAO} minutos (10h).`
    }
    // ES-F1 · regra ≥1: publicar exige ao menos um texto OU uma mídia. Rascunho
    // pode ficar vazio (é trabalho em andamento).
    if (paraPublicar && !form.corpo.trim() && !form.media) {
      e.geral = 'Para publicar, adicione ao menos um texto ou uma mídia.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const salvar = async (publicar: boolean) => {
    if (!validar(publicar)) return
    setStatusPublicado(publicar)
    setSaving(true)
    const data = {
      formato,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      duracao: form.duracao ? parseInt(form.duracao, 10) : null,
      // ES-F1: texto e mídia coexistem — o corpo nunca é apagado por causa do formato.
      corpo: form.corpo,
      media: form.media,
      thumb: form.thumb,
      tags: form.tags,
      publicado: publicar,
    }
    // ES-015: só navega de volta se o salvamento confirmar sucesso. Em erro,
    // permanece no formulário com os dados intactos e o toast de erro visível —
    // nunca descarta o trabalho da pessoa.
    const ok = existing ? await update(existing.id, data) : (await add(data)) !== null
    setSaving(false)
    if (ok) back()
  }

  return (
    <div>
      {/* Barra de ações sticky — breadcrumb + status + Descartar/Salvar/Publicar */}
      <div className="sticky top-16 z-10 -mx-10 mb-6 border-b border-plum/8 bg-canvas/85 px-10 py-3.5 backdrop-blur-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Trilha" className="flex items-center gap-2 text-[15px]">
            <Link href="/admin/conteudos" className="text-plum/50 transition-colors hover:text-plum">
              Conteúdo
            </Link>
            <ChevronRightIcon size={15} className="text-plum/30" />
            <span className="font-medium text-plum">{editing ? 'Editar conteúdo' : 'Novo conteúdo'}</span>
          </nav>
          <div className="flex items-center gap-2.5">
            <StatusPill publicado={statusPublicado} />
            <button
              type="button"
              onClick={back}
              disabled={saving}
              className="rounded-pill px-4 py-[11px] text-sm font-semibold text-mauve transition-colors hover:text-mauve-dark disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={() => salvar(false)}
              disabled={saving}
              className="rounded-pill border border-plum/[0.18] bg-white px-5 py-[11px] text-sm font-semibold text-plum transition-colors hover:border-plum/30 disabled:opacity-50"
            >
              Salvar rascunho
            </button>
            <button
              type="button"
              onClick={() => salvar(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-pill bg-mauve px-[22px] py-[11px] text-sm font-semibold text-white shadow-[0_8px_20px_rgba(122,74,92,0.28)] transition-colors hover:bg-mauve-dark disabled:opacity-60"
            >
              <PlaneIcon /> Publicar
            </button>
          </div>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="font-display text-4xl font-light text-plum">
          {editing ? 'Editar conteúdo' : 'Novo conteúdo'}
        </h1>
        <p className="mt-1.5 text-[15px] text-plum/60">
          Escreva um texto, anexe uma mídia — ou os dois. Pelo menos um é obrigatório para publicar.
        </p>
      </div>

      {errors.geral && (
        <p className="mb-6 rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
          {errors.geral}
        </p>
      )}

      {/* Duas colunas: principal (título/mídia/texto) + coluna de publicação/tags */}
      <div className="flex flex-col gap-7 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Título + Descrição */}
          <section className={CARD}>
            <div className="flex flex-col gap-[18px]">
              <div>
                <FieldLabel required>Título</FieldLabel>
                <input
                  value={form.titulo}
                  onChange={(e) => { set('titulo', e.target.value); setErrors((er) => ({ ...er, titulo: undefined })) }}
                  placeholder="Ex.: Como lidar com a ansiedade"
                  maxLength={200}
                  className={cn(INPUT, 'px-[17px] py-[15px] font-display text-[22px] placeholder:text-plum/30')}
                />
                {errors.titulo && <p className="mt-1.5 text-xs text-red-alert">{errors.titulo}</p>}
              </div>
              <div>
                <FieldLabel>Descrição</FieldLabel>
                <textarea
                  value={form.descricao}
                  onChange={(e) => set('descricao', e.target.value)}
                  placeholder="Descrição curta usada em listagens e na busca…"
                  rows={3}
                  className={cn(INPUT, 'resize-y px-4 py-[13px] text-[15px] leading-relaxed')}
                />
              </div>
            </div>
          </section>

          {/* Mídia — sempre disponível, opcional. O tipo escolhido deriva o formato. */}
          <section className={CARD}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-base text-plum">
                Mídia <span className="text-plum/40">(opcional)</span>
              </span>
              <div className="flex gap-2">
                {MIDIA_TIPOS.map((k) => {
                  const on = midiaTipo === k
                  const Icon = FORMATO[k].Icon
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onMidiaTipoChange(k)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-[17px] py-2.5 text-[13.5px] font-medium transition-colors',
                        on
                          ? 'border-mauve bg-mauve text-white shadow-[0_6px_16px_rgba(122,74,92,0.26)]'
                          : 'border-plum/[0.14] bg-white text-plum hover:border-plum/25',
                      )}
                    >
                      <Icon size={16} /> {FORMATO[k].label}
                    </button>
                  )
                })}
              </div>
            </div>
            <MediaUpload formato={midiaTipo} value={form.media} onChange={onMediaChange} />
            <p className="mt-3 text-xs leading-relaxed text-plum/45">
              {form.media
                ? `Será exibido como ${FORMATO[midiaTipo].label} — a mídia aparece primeiro e o texto vem abaixo.`
                : 'Sem mídia, o conteúdo é exibido como artigo (só texto).'}
            </p>
          </section>

          {/* Texto (markdown) — o editor É o card (bare) */}
          <MarkdownEditor
            bare
            value={form.corpo}
            onChange={(v) => { set('corpo', v); setErrors((e) => ({ ...e, geral: undefined })) }}
          />
        </div>

        {/* Coluna lateral: publicação + tags */}
        <aside className="flex w-full flex-col gap-6 lg:w-[360px] lg:shrink-0">
          {/* Publicação */}
          <section className={CARD}>
            <SectionLabel>Publicação</SectionLabel>
            <div className="mt-4 flex flex-col gap-[18px]">
              <div>
                <FieldLabel>Status</FieldLabel>
                <div className="relative">
                  <select
                    value={statusPublicado ? 'publicado' : 'rascunho'}
                    onChange={(e) => setStatusPublicado(e.target.value === 'publicado')}
                    className={cn(INPUT, 'appearance-none px-[15px] py-[13px] pr-10 text-[15px]')}
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="publicado">Publicado</option>
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-plum/40" />
                </div>
              </div>
              <div>
                <FieldLabel>Duração estimada</FieldLabel>
                <div className="relative">
                  <input
                    value={form.duracao}
                    onChange={(e) => onDuracaoChange(e.target.value)}
                    inputMode="numeric"
                    maxLength={3}
                    placeholder="Ex.: 8"
                    className={cn(INPUT, 'px-[15px] py-[13px] pr-12 text-[15px]')}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-plum/45">
                    min
                  </span>
                </div>
                {errors.duracao && <p className="mt-1.5 text-xs text-red-alert">{errors.duracao}</p>}
                {mostrarSugestao && (
                  <button
                    type="button"
                    onClick={aplicarSugestao}
                    className="mt-1.5 text-xs font-medium text-mauve hover:text-mauve-dark"
                  >
                    Sugerir do texto (~{sugestaoLeitura} min)
                  </button>
                )}
              </div>
              <CapaField value={form.thumb} onChange={(v) => set('thumb', v)} />
            </div>
          </section>

          {/* Tags */}
          <section className={CARD}>
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <SectionLabel>Tags</SectionLabel>
              {form.tags.length > 0 && (
                <span className="text-xs text-plum/40">
                  {form.tags.length} selecionada{form.tags.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {tags.length === 0 ? (
              <p className="text-[13px] text-plum/50">Nenhuma tag cadastrada. Crie tags em Conteúdo › Tags.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const on = form.tags.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={cn(
                        'rounded-pill border px-4 py-[9px] text-[13.5px] font-medium transition-colors',
                        on ? 'border-mauve bg-mauve text-white' : 'border-plum/[0.16] bg-white text-plum hover:border-plum/30',
                      )}
                    >
                      {t.nome}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="mt-3.5 text-xs leading-relaxed text-plum/45">
              Sem tags, o conteúdo não aparece em nenhum feed personalizado nem na navegação por tag.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function MediaUpload({
  formato,
  value,
  onChange,
}: {
  formato: MidiaTipo
  value: string | null
  onChange: (v: string | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const label = FORMATO[formato].label.toLowerCase()
  const accept = formato === 'video' ? 'video/*' : formato === 'audio' ? 'audio/*' : 'image/*'

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 500 * 1024 * 1024) {
      showToast('Arquivo acima de 500 MB.', 'error')
      return
    }
    onChange(f.name)
    showToast('Mídia enviada.', 'success')
  }

  return (
    <div>
      <input ref={ref} type="file" accept={accept} onChange={onFile} className="hidden" />
      {value ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-success-dark/40 bg-success-dark/[0.06] px-[18px] py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-success-dark">
            <UploadIcon size={18} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-plum">{value}</span>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="shrink-0 text-[13px] font-medium text-mauve hover:text-mauve-dark"
          >
            Substituir
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-[13px] font-medium text-plum/45 hover:text-red-alert"
          >
            Remover
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex w-full items-center gap-3.5 rounded-2xl border-2 border-dashed border-plum/[0.18] bg-cream-mid/[0.28] px-[18px] py-3.5 text-left transition-colors hover:border-mauve/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-mauve">
            <UploadIcon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-plum">Enviar arquivo de {label}</span>
            <span className="block text-xs text-plum/45">Até 500 MB</span>
          </span>
          <span className="shrink-0 text-[13px] font-medium text-mauve">Procurar</span>
        </button>
      )}
    </div>
  )
}

/* ── Blocos do redesenho ── */

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-semibold text-plum">
      {children}
      {required && <span className="text-red-alert"> *</span>}
    </label>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-plum/45">{children}</span>
}

/** Pílula de status no topo — Rascunho (malva) ou Publicado (verde). */
function StatusPill({ publicado }: { publicado: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[13px] font-medium',
        publicado ? 'bg-success-dark/[0.12] text-success-dark' : 'bg-mauve-mid/[0.14] text-mauve-mid',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', publicado ? 'bg-success-dark' : 'bg-mauve-mid')} />
      {publicado ? 'Publicado' : 'Rascunho'}
    </span>
  )
}

/** Capa por URL (upload real pendente — ES-010), no estilo do redesenho. */
function CapaField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const url = value ?? ''
  const temPreview = /^https?:\/\//i.test(url)
  return (
    <div>
      <FieldLabel>
        Capa <span className="font-normal text-plum/40">(opcional)</span>
      </FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-plum/40">
          <ImageIcon size={16} />
        </span>
        <input
          type="url"
          value={url}
          onChange={(e) => { const v = e.target.value.trim(); onChange(v ? v : null) }}
          placeholder="https://…/imagem.jpg"
          className={cn(INPUT, 'py-[13px] pl-[42px] pr-[15px] text-sm')}
        />
      </div>
      {temPreview && (
        <div
          className="relative mt-2 aspect-video overflow-hidden rounded-input bg-cream bg-cover bg-center"
          style={{ backgroundImage: `url("${url}")` }}
        />
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-plum/45">
        O upload de capa ainda não está disponível. Cole a URL de uma imagem já hospedada (.jpg, .png ou .webp).
      </p>
    </div>
  )
}

function PlaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
