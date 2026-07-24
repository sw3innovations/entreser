'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BackButton,
  ESButton,
  ESCard,
  ESSpinner,
  PageHeader,
  TextInput,
  TextareaInput,
  UploadIcon,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { ThumbUrlField } from '@/features/admin/components/thumb-url-field'
import { useTagOptions } from '@/features/admin/tags/use-tags'
import { estimarLeitura } from './duracao'
import { MarkdownEditor } from './markdown-editor'
import { FORMATO } from './meta'
import { conteudosService } from '.'
import { useConteudoMutations } from './use-conteudos'
import type { Conteudo, Formato } from './types'

/** Teto de duração em minutos (10h) — acima disso é quase sempre erro de digitação. */
const MAX_DURACAO = 600

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
      <BackButton href="/admin/conteudos" label="Voltar para conteúdos" />
      <PageHeader
        breadcrumb={[
          { label: 'Conteúdos', href: '/admin/conteudos' },
          { label: editing ? 'Editar' : 'Novo' },
        ]}
        title={editing ? 'Editar conteúdo' : 'Novo conteúdo'}
        description={
          editing
            ? 'Atualize os dados, o texto e a mídia deste conteúdo.'
            : 'Escreva um texto, anexe uma mídia — ou os dois. Pelo menos um é obrigatório para publicar.'
        }
      />

      <div className="flex flex-col gap-5">
        {/* Metadados */}
        <ESCard variant="solid" isHoverable={false}>
          <div className="flex flex-col gap-[18px] p-[26px]">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.7fr_1fr] md:items-start">
              <div className="flex flex-col gap-[18px]">
                <TextInput
                  label="Título"
                  placeholder="Ex.: Como lidar com a ansiedade"
                  value={form.titulo}
                  onChange={(v) => { set('titulo', v); setErrors((e) => ({ ...e, titulo: undefined })) }}
                  errorMessage={errors.titulo}
                  isRequired
                />
                <TextareaInput
                  label="Descrição"
                  placeholder="Descrição curta usada em listagens e na busca…"
                  value={form.descricao}
                  onChange={(v) => set('descricao', v)}
                  minRows={2}
                />
              </div>
              <div className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-1.5">
                  <TextInput
                    label="Duração estimada"
                    placeholder="Ex.: 8"
                    value={form.duracao}
                    onChange={onDuracaoChange}
                    errorMessage={errors.duracao}
                    inputMode="numeric"
                    maxLength={3}
                    endContent="min"
                  />
                  {mostrarSugestao && (
                    <button
                      type="button"
                      onClick={aplicarSugestao}
                      className="self-start text-xs font-medium text-mauve hover:text-mauve-dark"
                    >
                      Sugerir do texto (~{sugestaoLeitura} min)
                    </button>
                  )}
                </div>
                <ThumbUrlField value={form.thumb} onChange={(v) => set('thumb', v)} />
              </div>
            </div>
          </div>
        </ESCard>

        {/* Tags */}
        <ESCard variant="solid" isHoverable={false}>
          <div className="p-[22px]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-mauve">Tags</div>
            {tags.length === 0 ? (
              <div className="text-[13px] text-plum/50">
                Nenhuma tag cadastrada. Crie tags em Conteúdo › Tags.
              </div>
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
                        'rounded-pill px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                        on ? 'border border-transparent bg-mauve text-white' : 'border border-plum/10 bg-mauve-ghost text-plum',
                      )}
                    >
                      {on ? '✓ ' : ''}
                      {t.nome}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-plum/45">
              Sem tags, o conteúdo não aparece em nenhum feed personalizado nem na navegação por tag.
            </p>
          </div>
        </ESCard>

        {/* Texto — sempre disponível, opcional (markdown). */}
        <MarkdownEditor
          label="Texto"
          optional
          value={form.corpo}
          onChange={(v) => { set('corpo', v); setErrors((e) => ({ ...e, geral: undefined })) }}
        />

        {/* Mídia — sempre disponível, opcional. O tipo escolhido deriva o formato. */}
        <ESCard variant="solid" isHoverable={false}>
          <div className="flex flex-col gap-4 p-[26px]">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-plum/70">
                Mídia <span className="font-normal text-plum/40">(opcional)</span>
              </span>
              <div className="flex max-w-[460px] gap-2">
                {MIDIA_TIPOS.map((k) => {
                  const on = midiaTipo === k
                  const Icon = FORMATO[k].Icon
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onMidiaTipoChange(k)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-[14px] px-2.5 py-3 text-sm font-medium transition-colors',
                        on ? 'border border-transparent bg-mauve text-white' : 'border border-plum/15 text-plum/60',
                      )}
                    >
                      <Icon size={17} /> {FORMATO[k].label}
                    </button>
                  )
                })}
              </div>
            </div>
            <MediaUpload formato={midiaTipo} value={form.media} onChange={onMediaChange} />
            <p className="text-xs leading-relaxed text-plum/45">
              {form.media
                ? `Será exibido como ${FORMATO[midiaTipo].label} — a mídia aparece primeiro e o texto vem abaixo.`
                : 'Sem mídia, o conteúdo é exibido como artigo (só texto).'}
            </p>
          </div>
        </ESCard>

        {/* Regra ≥1 (ES-F1): publicar exige texto ou mídia. */}
        {errors.geral && (
          <p className="rounded-[14px] border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
            {errors.geral}
          </p>
        )}
      </div>

      {/* Barra de ações */}
      <div className="mt-[22px] flex flex-wrap justify-end gap-2.5 border-t border-plum/8 pt-5">
        <ESButton variant="ghost" onPress={back} isDisabled={saving}>
          Cancelar
        </ESButton>
        <ESButton variant="secondary" isLoading={saving} onPress={() => salvar(false)}>
          Salvar rascunho
        </ESButton>
        <ESButton variant="primary" isLoading={saving} onPress={() => salvar(true)}>
          {editing && existing?.publicado ? 'Salvar e publicar' : 'Publicar'}
        </ESButton>
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
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-plum/70">Arquivo de {label}</span>
      <input ref={ref} type="file" accept={accept} onChange={onFile} className="hidden" />
      {value ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-success-dark/30 bg-success-dark/[0.06] px-4 py-3.5">
          <span className="inline-flex text-success-dark">
            <UploadIcon size={18} />
          </span>
          <span className="flex-1 truncate text-[13.5px] text-plum">{value}</span>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="text-[13px] font-medium text-mauve hover:text-mauve-dark"
          >
            Substituir
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[13px] font-medium text-plum/45 hover:text-red-alert"
          >
            Remover
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-cream-dark bg-cream px-4 py-7 text-plum/50"
        >
          <UploadIcon size={26} />
          <span className="text-[13.5px] font-medium">Enviar arquivo de {label}</span>
          <span className="text-xs">Até 500 MB</span>
        </button>
      )}
    </div>
  )
}
