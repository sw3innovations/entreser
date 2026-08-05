'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CameraIcon,
  ESAvatar,
  ESButton,
  ESCard,
  InfoNote,
  LockIcon,
  MailIcon,
  PageHeader,
  PhoneInput,
  Tag,
  TextInput,
  TextareaInput,
  useToast,
} from '@/components/ui'
import { onlyDigits } from '@/features/admin/lib/format'
import { useAdminAuth } from '@/features/admin/context/admin-auth-context'

interface FormState {
  nome: string
  telefone: string
  crp: string
  abordagem: string
  bio: string
}

interface FormErrors {
  nome?: string
  telefone?: string
  crp?: string
  abordagem?: string
}

const crpOk = (v: string) => /^\d{2}\/\d{4,6}$/.test(v.trim())

export function MeuPerfilView() {
  const router = useRouter()
  const { admin } = useAdminAuth()
  const { showToast } = useToast()

  const email = admin?.email ?? 'profissional@entreser.com.br'
  const [seed] = useState<FormState>(() => ({
    nome: admin?.nome ?? 'Profissional',
    telefone: '11987654321',
    crp: '06/45231',
    abordagem: 'TCC',
    bio: 'Psicóloga perinatal com foco em saúde emocional na jornada de fertilidade. Atendo questões de ansiedade, luto gestacional e autocompaixão.',
  }))
  const [form, setForm] = useState<FormState>(seed)
  const [foto, setFoto] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const dirty = JSON.stringify(form) !== JSON.stringify(seed) || foto !== null

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Formato não suportado. Envie uma imagem.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem acima de 5 MB. Escolha um arquivo menor.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFoto(typeof reader.result === 'string' ? reader.result : null)
      showToast('Foto atualizada.', 'success')
    }
    reader.readAsDataURL(file)
  }

  const save = async () => {
    const e: FormErrors = {}
    if (form.nome.trim().length < 2 || /[0-9]/.test(form.nome)) e.nome = 'Nome inválido (mín. 2 letras, sem números).'
    if (!/\d{10,11}/.test(onlyDigits(form.telefone))) e.telefone = 'Telefone inválido (DDD + número).'
    if (!crpOk(form.crp)) e.crp = 'CRP no formato NN/NNNNNN.'
    if (!form.abordagem.trim()) e.abordagem = 'Informe sua abordagem.'
    setErrors(e)
    if (Object.keys(e).length) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 700))
    setLoading(false)
    showToast('Perfil atualizado. As alterações valem no perfil público.', 'success')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sua conta"
        title="Meu perfil"
        description="Seus dados profissionais e foto compõem o perfil público visível às usuárias."
        action={
          <ESButton variant="secondary" startContent={<LockIcon size={16} />} onPress={() => router.push('/admin/perfil/senha')}>
            Trocar senha
          </ESButton>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.6fr_1fr] md:items-start">
        <ESCard variant="solid" isHoverable={false}>
          <div className="flex flex-col gap-5 p-[26px]">
            {/* Foto */}
            <div className="flex items-center gap-[18px]">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="Foto" className="h-[76px] w-[76px] rounded-pill object-cover ring-2 ring-mauve-soft" />
              ) : (
                <ESAvatar name={form.nome} size="lg" isBordered />
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                <ESButton variant="secondary" size="sm" startContent={<CameraIcon size={15} />} onPress={() => fileRef.current?.click()}>
                  {foto ? 'Trocar foto' : 'Enviar foto'}
                </ESButton>
                <p className="mt-2 text-xs text-plum/45">JPG ou PNG, até 5 MB. Aparece no perfil público.</p>
              </div>
            </div>

            <TextInput
              label="Nome completo"
              value={form.nome}
              onChange={(v) => { set('nome', v); setErrors((e) => ({ ...e, nome: undefined })) }}
              errorMessage={errors.nome}
              isRequired
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-plum/70">E-mail</span>
              <div className="flex items-center gap-2 rounded-input border border-plum/8 bg-plum/[0.03] px-3.5 py-2.5 text-sm text-plum/55">
                <MailIcon size={16} /> {email}
              </div>
              <span className="text-xs text-plum/40">O e-mail é sua identidade de login e não é editável aqui.</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PhoneInput
                label="Telefone"
                value={form.telefone}
                onChange={(v) => { set('telefone', v); setErrors((e) => ({ ...e, telefone: undefined })) }}
                errorMessage={errors.telefone}
                isRequired
              />
              <TextInput
                label="CRP"
                placeholder="06/12345"
                value={form.crp}
                onChange={(v) => { set('crp', v); setErrors((e) => ({ ...e, crp: undefined })) }}
                errorMessage={errors.crp}
                isRequired
              />
            </div>
            <TextInput
              label="Abordagem"
              placeholder="Ex.: TCC, ACT, MBSR"
              value={form.abordagem}
              onChange={(v) => { set('abordagem', v); setErrors((e) => ({ ...e, abordagem: undefined })) }}
              errorMessage={errors.abordagem}
              isRequired
            />
            <TextareaInput
              label="Bio pública"
              placeholder="Conte sobre sua atuação e especialidades…"
              value={form.bio}
              onChange={(v) => set('bio', v)}
              minRows={4}
            />

            <div className="mt-0.5 flex justify-end gap-2.5">
              <ESButton
                variant="ghost"
                isDisabled={!dirty}
                onPress={() => { setForm(seed); setFoto(null); setErrors({}) }}
              >
                Descartar
              </ESButton>
              <ESButton variant="primary" isLoading={loading} onPress={save}>
                Salvar alterações
              </ESButton>
            </div>
          </div>
        </ESCard>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pl-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-mauve">
              <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mauve">Como as usuárias veem você</p>
          </div>

          <div className="rounded-[26px] bg-gradient-to-br from-plum via-plum-mid to-mauve-dark p-[26px] text-cream shadow-[0_22px_48px_rgba(45,24,64,0.3)]">
            <div className="flex items-center gap-4">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="Foto" className="h-16 w-16 shrink-0 rounded-pill object-cover" />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-pill border border-white/[0.18] bg-white/10 font-display text-xl">
                  {form.nome.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-display text-2xl font-normal leading-tight">{form.nome || 'Seu nome'}</p>
                <p className="mt-1 text-[12.5px] text-cream/60">Psicóloga · CRP {form.crp || '—'}</p>
              </div>
            </div>

            {form.abordagem.trim() && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {form.abordagem.split(',').map((a) => a.trim()).filter(Boolean).map((a) => (
                  <span key={a} className="rounded-pill border border-white/[0.14] bg-white/10 px-3 py-1.5 text-[11.5px]">
                    {a}
                  </span>
                ))}
              </div>
            )}

            {form.bio.trim() && <p className="mt-5 text-[13.5px] leading-relaxed text-cream/[0.82]">{form.bio}</p>}
          </div>

          <ESCard variant="solid" isHoverable={false}>
            <div className="p-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-mauve">Status</div>
              <Tag label="Ativa · atendendo" variant="primary" size="sm" />
              <p className="mt-3 text-[12.5px] leading-[1.5] text-plum/50">
                Seu status de atividade é controlado pela equipe Entre Ser.
              </p>
            </div>
          </ESCard>
          <InfoNote>
            <strong>Nome, CRP, bio e foto</strong> compõem seu perfil público, exibido às usuárias na listagem de
            profissionais. E-mail e status não são editáveis por aqui.
          </InfoNote>
        </div>
      </div>
    </div>
  )
}
