'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { dataHoraPorExtenso, faixaHoraria } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']
type ProfissionalDetalhe = components['schemas']['ProfissionalDetalhe']
type TiposSessaoResponse = components['schemas']['TiposSessaoResponse']

interface Props {
  tipo: TipoSessao
  profissionalId: string
  inicio: string
  fim: string
}

function reais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  const [emailParceira, setEmailParceira] = useState('')

  const { dados: profissional } = useRecurso<ProfissionalDetalhe>(
    () => m04.GET('/profissionais/{profissionalId}', { params: { path: { profissionalId } } }),
    [profissionalId],
  )
  const { dados: catalogo } = useRecurso<TiposSessaoResponse>(() => m04.GET('/tipos-sessao'), [])
  const tipoInfo = catalogo?.tipos.find((t) => t.codigo === tipo)
  const valor = profissional?.tiposOferecidos?.find((t) => t.tipoSessao === tipo)?.valor ?? null

  const horarios = `/agendar/${tipo}/${profissionalId}/horarios`
  // U6: sessão de casal ganha o campo de e-mail da parceira. O convite NUNCA segura a
  // sessão (D4) — ela é confirmada de qualquer jeito, com ou sem parceira informada.
  const ehCasal = tipo === 'Casal'
  const emailInvalido = ehCasal && emailParceira.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParceira.trim())

  const confirmar = async () => {
    if (enviando || emailInvalido) return
    setEnviando(true)
    setErro(null)
    setSlotOcupado(false)
    try {
      const email = emailParceira.trim()
      const { data, error } = await m04.POST('/sessoes', {
        body: {
          profissionalId,
          tipo,
          dataHora: inicio,
          ...(ehCasal && email ? { emailParceira: email } : {}),
        },
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
            {profissional && <Linha rotulo="Com" valor={profissional.nome} />}
            {tipoInfo && <Linha rotulo="Tipo" valor={tipoInfo.nome} />}
            {tipoInfo && <Linha rotulo="Duração" valor={`${tipoInfo.duracaoMinutos} minutos`} />}
            {valor != null && <Linha rotulo="Valor" valor={reais(valor)} />}
          </dl>
        </div>

        <p className="mt-4 rounded-input border border-plum/8 bg-white px-4 py-3 text-[13px] leading-relaxed text-plum/60">
          Você pode cancelar ou reagendar até 24 horas antes, sem custo.
        </p>

        {/* U6 · casal: convidar a parceira é opcional e não segura a sessão (D4). */}
        {ehCasal && (
          <div className="mt-4 rounded-card border border-plum/8 bg-white p-5 shadow-card">
            <label className="block">
              <span className="text-sm font-medium text-plum/70">
                E-mail da sua parceira <span className="font-normal text-plum/40">(opcional)</span>
              </span>
              <input
                type="email"
                value={emailParceira}
                onChange={(e) => setEmailParceira(e.target.value)}
                placeholder="parceira@exemplo.com"
                className="mt-1.5 w-full rounded-input border border-plum/[0.14] bg-white px-4 py-3 text-[14.5px] text-plum outline-none transition-colors placeholder:text-plum/35 focus:border-mauve"
              />
            </label>
            {emailInvalido && (
              <p className="mt-1.5 text-xs text-red-alert">Esse e-mail não parece válido. Confira e tente de novo.</p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-plum/45">
              Se ela já tiver conta, entra direto na sessão. Se não, recebe um convite por
              e-mail. De qualquer forma, sua sessão fica marcada.
            </p>
          </div>
        )}

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
            disabled={enviando || slotOcupado || emailInvalido}
            className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99] disabled:opacity-60"
          >
            {enviando ? 'Marcando…' : 'Confirmar agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-plum/50">{rotulo}</dt>
      <dd className="text-[14.5px] font-medium text-plum">{valor}</dd>
    </div>
  )
}
