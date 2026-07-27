'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackButton, ESButton, PageHeader, TextInput, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { dataHoraPorExtenso } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Sessao = components['schemas']['Sessao']

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

/**
 * P8 · Sala com problema (D14). Existe só para a falha na criação automática do Meet: a
 * profissional abre uma sala manualmente e cola o endereço aqui, e as participantes passam
 * a ver o link.
 *
 * A validação da tela é frouxa de propósito — quem valida o link de verdade é o backend
 * (`LINK_INVALIDO`). Aqui basta evitar o engano óbvio de colar algo que não é uma URL.
 */
export function SalaView({ sessaoId }: { sessaoId: string }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [link, setLink] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { dados, carregando, erro: erroCarga, recarregar } = useRecurso<Sessao>(
    () => m04.GET('/sessoes/{sessaoId}', { params: { path: { sessaoId } } }),
    [sessaoId],
  )

  const pareceUrl = /^https:\/\/.+\..+/.test(link.trim())
  const podeSalvar = pareceUrl && !salvando

  const salvar = async () => {
    if (!podeSalvar) return
    setSalvando(true)
    setErro(null)
    try {
      const { error } = await m04.PATCH('/sessoes/{sessaoId}/link-meet', {
        params: { path: { sessaoId } },
        body: { linkMeet: link.trim() },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      showToast('Link salvo. As participantes já conseguem ver.', 'success')
      router.push(`/admin/agenda/${sessaoId}`)
    } catch {
      setErro(mensagemDe())
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <BackButton href={`/admin/agenda/${sessaoId}`} label="Voltar para a sessão" />
      <PageHeader
        breadcrumb={[
          { label: 'Minha agenda', href: '/admin/agenda' },
          { label: 'Sessão', href: `/admin/agenda/${sessaoId}` },
          { label: 'Sala' },
        ]}
        title="Adicionar o link da sala"
        description="Não conseguimos criar a sala automaticamente. Crie uma e cole o endereço aqui."
      />

      <Estado carregando={carregando} erro={erroCarga} vazio={!dados} aoRepetir={recarregar}>
        {dados && (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <section className={CARD}>
                <h3 className="font-display text-lg text-plum">1. Abra uma sala</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-plum/60">
                  Crie uma reunião no Google Meet e copie o endereço.
                </p>
                <a
                  href="https://meet.google.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex h-[42px] items-center rounded-full border border-mauve/30 bg-white px-5 text-[14px] font-semibold text-mauve transition-es hover:bg-mauve-ghost"
                >
                  Abrir o Google Meet
                </a>
              </section>

              <section className={CARD}>
                <h3 className="font-display text-lg text-plum">2. Cole o endereço</h3>
                <div className="mt-3">
                  <TextInput
                    type="url"
                    value={link}
                    onChange={(v) => { setLink(v); setErro(null) }}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    errorMessage={
                      link.trim() && !pareceUrl
                        ? 'Cole o endereço completo, começando com https://'
                        : (erro ?? undefined)
                    }
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <ESButton variant="primary" onPress={salvar} isLoading={salvando} isDisabled={!podeSalvar}>
                    Salvar link da sala
                  </ESButton>
                </div>
              </section>
            </div>

            <aside className="w-full lg:w-[300px] lg:shrink-0">
              <section className={cn(CARD, 'text-[13px] text-plum/60')}>
                <h3 className="font-display text-base text-plum">A sessão</h3>
                <p className="mt-1.5 capitalize">{dataHoraPorExtenso(dados.dataHora)}</p>
                <p className="mt-0.5">
                  {dados.participantes.filter((p) => !p.saiuEm).length} participante(s)
                </p>
                <p className="mt-2.5 leading-relaxed text-plum/50">
                  Assim que você salvar, o link aparece para quem está inscrito.
                </p>
              </section>
            </aside>
          </div>
        )}
      </Estado>
    </div>
  )
}
