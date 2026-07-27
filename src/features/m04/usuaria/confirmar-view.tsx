'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { dataHoraPorExtenso, faixaHoraria } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']

interface Props {
  tipo: TipoSessao
  profissionalId: string
  inicio: string
  fim: string
}

/**
 * U5 · Confirmar marcação. Resumo do que foi escolhido e `POST /sessoes`.
 *
 * O erro mais provável aqui é o **409 `SLOT_JA_OCUPADO`** — alguém marcou o mesmo horário
 * entre a listagem e a confirmação (D10: quem barra é uma constraint do banco, não um `if`).
 * Ele tem tratamento dedicado: mensagem clara + voltar aos horários atualizados, sem perder
 * a profissional escolhida. O botão trava durante o envio (escrita nunca repete sozinha — D19).
 */
export function ConfirmarView({ tipo, profissionalId, inicio, fim }: Props) {
  const router = useRouter()
  const voltar = useVoltar(`/agendar/${tipo}/${profissionalId}/horarios`)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [slotOcupado, setSlotOcupado] = useState(false)

  const horarios = `/agendar/${tipo}/${profissionalId}/horarios`

  const confirmar = async () => {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    setSlotOcupado(false)
    try {
      const { data, error } = await m04.POST('/sessoes', {
        body: { profissionalId, tipo, dataHora: inicio },
      })
      if (error) {
        const code = (error as { code?: string }).code
        if (code === 'SLOT_JA_OCUPADO') setSlotOcupado(true)
        setErro(mensagemDe(code))
        return
      }
      if (data) router.push(`/sessoes/${data.id}`)
    } catch {
      setErro(mensagemDe())
    } finally {
      setEnviando(false)
    }
  }

  const topBar = (
    <HeroIconButton aria-label="Voltar" onPress={voltar}>
      <ArrowLeftIcon />
    </HeroIconButton>
  )

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        topBar={topBar}
        eyebrow="Confirmar"
        title="Tudo certo?"
        description="Confira os detalhes antes de marcar."
      />
      <PageContent width="md" className="pt-6">
        <div className="rounded-card border border-plum/8 bg-white p-5 shadow-card">
          <dl className="flex flex-col gap-3.5">
            <div>
              <dt className="text-eyebrow text-mauve">Quando</dt>
              <dd className="mt-1 font-display text-lg capitalize leading-snug text-plum">
                {dataHoraPorExtenso(inicio)}
              </dd>
              <dd className="mt-0.5 text-[13px] text-plum/50">{faixaHoraria(inicio, fim)}</dd>
            </div>
          </dl>
        </div>

        {erro && (
          <div className="mt-4 rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3">
            <p className="text-[13.5px] font-medium text-red-alert">{erro}</p>
            {slotOcupado && (
              <button
                type="button"
                onClick={() => router.replace(horarios)}
                className="mt-2 text-[13px] font-semibold text-mauve underline underline-offset-2"
              >
                Ver horários atualizados
              </button>
            )}
          </div>
        )}
      </PageContent>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/[0.06] bg-[rgba(255,253,250,0.9)] shadow-[0_-6px_24px_rgba(45,24,64,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl px-[18px] pb-[18px] pt-[14px]">
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando || slotOcupado}
            className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99] disabled:opacity-60"
          >
            {enviando ? 'Marcando…' : 'Confirmar agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
