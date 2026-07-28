'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { mensagemDe } from '@/features/m04/api/erros'
import { Estado } from '@/features/m04/ui/estado'
import { chaveDoDia, diaPorExtenso, faixaHoraria, hojeISO, emDiasISO } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Slot = components['schemas']['Slot']
type Sessao = components['schemas']['Sessao']

function porDia(slots: Slot[]): { chave: string; slots: Slot[] }[] {
  const mapa = new Map<string, Slot[]>()
  for (const s of slots) {
    const k = chaveDoDia(s.inicio)
    const atual = mapa.get(k)
    if (atual) atual.push(s)
    else mapa.set(k, [s])
  }
  return [...mapa.entries()].map(([chave, slots]) => ({ chave, slots }))
}

/**
 * U12 · Reagendar sessão. Mostra os horários livres da mesma profissional e mesmo tipo
 * (`GET /profissionais/{id}/slots`) e envia `PATCH /sessoes/{id}/reagendar`.
 *
 * A sessão mantém o mesmo `id`; o backend zera o link da sala e reprograma os lembretes,
 * então a tela avisa que a sala terá um novo endereço. Reagendar dentro de 24h é bloqueado
 * pelo servidor (`PRAZO_REAGENDAMENTO`) — a tela nem oferece a ação quando `podeReagendar`
 * é falso, mas ainda trata o erro, porque a página pode ficar aberta até o prazo virar.
 */
export function ReagendarView({ sessaoId }: { sessaoId: string }) {
  const router = useRouter()
  const voltar = useVoltar(`/sessoes/${sessaoId}`)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { dados: sessao, carregando: carregandoSessao, erro: erroSessao, recarregar } = useRecurso<Sessao>(
    () => m04.GET('/sessoes/{sessaoId}', { params: { path: { sessaoId } } }),
    [sessaoId],
  )

  // Os slots dependem da sessão (profissional + tipo). Enquanto ela não chega, não há o
  // que buscar — daí a resposta vazia em vez de um `sessao!`, que quebraria no 1º render.
  const { dados: slotsResp, carregando: carregandoSlots, recarregar: recarregarSlots } = useRecurso(
    () =>
      sessao
        ? m04.GET('/profissionais/{profissionalId}/slots', {
            params: {
              path: { profissionalId: sessao.profissional.id },
              query: { tipo: sessao.tipo, inicio: hojeISO(), fim: emDiasISO(30) },
            },
          })
        : Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) }),
    [sessao?.profissional.id, sessao?.tipo],
  )

  const dias = porDia(slotsResp?.slots ?? [])
  const carregando = carregandoSessao || (!!sessao && carregandoSlots)

  const escolher = async (slot: Slot) => {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const { data, error } = await m04.PATCH('/sessoes/{sessaoId}/reagendar', {
        params: { path: { sessaoId } },
        body: { dataHora: slot.inicio },
      })
      if (error) {
        const code = (error as { code?: string }).code
        setErro(mensagemDe(code))
        // O horário foi tomado entre a lista chegar e o clique — a lista na tela está
        // velha. Recarregar é o que faz a mensagem ser acionável: sem isso, a pessoa
        // insiste no mesmo horário que já não existe.
        if (code === 'SLOT_JA_OCUPADO' || code === 'SLOT_INDISPONIVEL') recarregarSlots()
        return
      }
      if (data) router.replace(`/sessoes/${sessaoId}`)
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
    <div className="min-h-dvh pb-16">
      <PageHero
        width="md"
        topBar={topBar}
        eyebrow="Reagendar"
        title="Escolha o novo horário"
        description={sessao ? `Com ${sessao.profissional.nome}` : undefined}
      />
      <PageContent width="md" className="pt-6">
        <p className="mb-5 rounded-input border border-plum/8 bg-white px-4 py-3 text-[13px] leading-relaxed text-plum/60 shadow-card">
          Ao reagendar, a sala de vídeo ganha um novo endereço e os lembretes são
          reprogramados para o novo horário.
        </p>

        {erro && (
          <p className="mb-4 rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
            {erro}
          </p>
        )}

        <Estado
          carregando={carregando}
          erro={erroSessao}
          vazio={!carregando && dias.length === 0}
          aoRepetir={recarregar}
          aoVazio={
            <EmptyState
              title="Nenhum horário disponível"
              description="Esta profissional não tem horários livres nos próximos 30 dias."
            />
          }
        >
          <div className="flex flex-col gap-6">
            {dias.map(({ chave, slots }) => (
              <section key={chave}>
                <h2 className="mb-2.5 font-display text-lg capitalize leading-none text-plum">
                  {diaPorExtenso(slots[0].inicio)}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.inicio}
                      type="button"
                      onClick={() => escolher(s)}
                      disabled={enviando}
                      className="rounded-input border border-plum/10 bg-white px-4 py-2.5 text-sm font-medium text-plum shadow-card transition-es hover:border-mauve hover:text-mauve active:scale-[0.98] disabled:opacity-60"
                    >
                      {faixaHoraria(s.inicio, s.fim)}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Estado>
      </PageContent>
    </div>
  )
}
