'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui'
import {
  PageHero,
  PageContent,
  HeroIconButton,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SunriseIcon,
  SunIcon,
  MoonIcon,
} from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { mensagemDe } from '@/features/m04/api/erros'
import { Estado } from '@/features/m04/ui/estado'
import {
  chaveDoDia,
  dataHoraPorExtenso,
  diaPorExtenso,
  hora,
  semanaISO,
  porPeriodo,
  HORIZONTE_AGENDAMENTO_SEMANAS,
  type PeriodoChave,
} from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Slot = components['schemas']['Slot']
type Sessao = components['schemas']['Sessao']

const ICONE_DO_PERIODO: Record<PeriodoChave, typeof SunriseIcon> = {
  manha: SunriseIcon,
  tarde: SunIcon,
  noite: MoonIcon,
}

/** Teto da navegação — automática e manual. É o horizonte de agendamento: além dele a
 * sessão remarcada não apareceria na agenda da profissional. */
const LIMITE_SEMANAS = HORIZONTE_AGENDAMENTO_SEMANAS

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
 * (`GET /profissionais/{id}/slots`); escolher um horário abre uma confirmação (troca a
 * sessão de vez e regenera a sala, então merece o mesmo cuidado do cancelamento) e só o
 * clique em "Confirmar reagendamento" envia o `PATCH /sessoes/{id}/reagendar`.
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
  // Reagendar é sensível (troca a sessão de vez, regenera a sala) — escolher um horário só
  // abre a confirmação; o PATCH real só sai do clique dentro do diálogo (`confirmar`).
  const [slotEscolhido, setSlotEscolhido] = useState<Slot | null>(null)
  // Abre na semana atual, espelhando a U4 (ver horarios-view.tsx): o avanço automático até
  // a primeira semana com horário saiu de lá e daqui pelo mesmo motivo — levava a pessoa
  // para semanas distantes sem ela pedir nem perceber.
  const [semana, setSemana] = useState(0)
  const semanaAtual = semanaISO(semana)

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
              query: { tipo: sessao.tipo, inicio: semanaAtual.inicio, fim: semanaAtual.fim },
            },
          })
        : Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) }),
    [sessao?.profissional.id, sessao?.tipo, semana],
  )

  const dias = porDia(slotsResp?.slots ?? [])
  const carregando = carregandoSessao || (!!sessao && carregandoSlots)
  const vazio = !carregando && dias.length === 0

  const irParaSemana = (delta: number) => {
    setSemana((s) => Math.min(LIMITE_SEMANAS, Math.max(0, s + delta)))
  }

  const confirmarReagendamento = async () => {
    if (enviando || !slotEscolhido) return
    setEnviando(true)
    setErro(null)
    try {
      const { data, error } = await m04.PATCH('/sessoes/{sessaoId}/reagendar', {
        params: { path: { sessaoId } },
        body: { dataHora: slotEscolhido.inicio },
      })
      if (error) {
        const code = (error as { code?: string }).code
        setErro(mensagemDe(code))
        // O horário foi tomado entre a lista chegar e o clique — a lista na tela está
        // velha. Fecha o diálogo (o slot escolhido não existe mais) e recarrega, para a
        // pessoa ver a grade atual em vez de insistir num horário que já não existe.
        if (code === 'SLOT_JA_OCUPADO' || code === 'SLOT_INDISPONIVEL') {
          setSlotEscolhido(null)
          recarregarSlots()
        }
        return
      }
      if (data) router.replace(`/sessoes/${sessaoId}/confirmado?ctx=reagendamento`)
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
        topBarClassName="lg:hidden"
        eyebrow="Reagendar"
        title="Escolha o novo horário"
        description={sessao ? `Com ${sessao.profissional.nome}` : undefined}
      />
      <PageContent width="md" className="pt-6">
        <p className="mb-5 rounded-input border border-plum/8 bg-white px-4 py-3 text-[13px] leading-relaxed text-plum/60 shadow-card">
          Ao reagendar, a sala de vídeo ganha um novo endereço e os lembretes são
          reprogramados para o novo horário.
        </p>

        {/* Erro do diálogo (slot ocupado etc.) aparece DENTRO dele; aqui só o que sobra
            depois que ele fecha (ex.: recarregar a grade após SLOT_JA_OCUPADO). */}
        {erro && !slotEscolhido && (
          <p className="mb-4 rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
            {erro}
          </p>
        )}

        <div className="mb-5 flex items-center justify-between rounded-input border border-plum/8 bg-white px-2 py-2 shadow-card">
          <button
            type="button"
            onClick={() => irParaSemana(-1)}
            disabled={semana === 0}
            aria-label="Semana anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <span className="text-[13.5px] font-medium capitalize text-plum">Semana de {semanaAtual.rotulo}</span>
          <button
            type="button"
            onClick={() => irParaSemana(1)}
            disabled={semana >= LIMITE_SEMANAS}
            aria-label="Próxima semana"
            className="flex h-9 w-9 items-center justify-center rounded-full text-plum/60 transition-es hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>

        <Estado
          carregando={carregando}
          erro={erroSessao}
          vazio={vazio}
          aoRepetir={recarregar}
          aoVazio={
            <EmptyState
              title="Nenhum horário nesta semana"
              description="Esta profissional não tem horários livres nesta semana. Tente a próxima semana."
            />
          }
        >
          <div className="flex flex-col gap-7">
            {dias.map(({ chave, slots }) => (
              <section key={chave}>
                <div className="mb-3.5 flex items-baseline justify-between">
                  <h2 className="font-display text-lg capitalize leading-none text-plum">
                    {diaPorExtenso(slots[0].inicio)}
                  </h2>
                  <span className="text-xs text-plum/45">
                    {slots.length} {slots.length === 1 ? 'horário' : 'horários'}
                  </span>
                </div>
                <div className="flex flex-col gap-5">
                  {porPeriodo(slots).map(({ chave: periodo, rotulo, slots: doPeriodo }) => {
                    const IconePeriodo = ICONE_DO_PERIODO[periodo]
                    return (
                      <div key={periodo}>
                        <div className="mb-2.5 flex items-center gap-2">
                          <IconePeriodo size={15} className="text-mauve" />
                          <span className="text-eyebrow text-mauve">{rotulo}</span>
                          <span className="h-px flex-1 bg-plum/[0.09]" />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          {doPeriodo.map((s) => (
                            <button
                              key={s.inicio}
                              type="button"
                              onClick={() => setSlotEscolhido(s)}
                              disabled={enviando}
                              className="rounded-2xl border border-plum/8 bg-white p-3.5 text-left shadow-card transition-es hover:border-mauve hover:shadow-card-hover active:scale-[0.98] disabled:opacity-60"
                            >
                              <span className="block font-display text-xl leading-none text-plum">{hora(s.inicio)}</span>
                              <span className="mt-1 block text-[11.5px] text-plum/45">até {hora(s.fim)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </Estado>
      </PageContent>

      {/* Confirmação — reagendar troca a sessão de vez e regenera a sala, então o PATCH só
          sai daqui, nunca do clique direto no horário (mesmo espírito do CancelarDialog). */}
      {slotEscolhido && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-plum/45 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-card bg-white p-6 shadow-modal sm:rounded-card">
            <h2 className="font-display text-2xl text-plum">Confirmar novo horário?</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-plum/65">
              A sala de vídeo ganha um novo endereço e os lembretes são reprogramados para o
              novo horário.
            </p>

            {/* Colunas dão lugar a linhas empilhadas: a data por extenso é longa demais
                para caber ao lado do rótulo sem quebrar de um jeito estranho. */}
            <div className="mt-4 flex flex-col gap-3 rounded-input border border-plum/8 bg-plum/[0.02] p-4">
              {sessao && (
                <div>
                  <p className="text-[12px] text-plum/45">Horário atual</p>
                  <p className="mt-0.5 text-[13.5px] text-plum/55 first-letter:uppercase">
                    {dataHoraPorExtenso(sessao.dataHora)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[12px] text-plum/45">Novo horário</p>
                <p className="mt-0.5 text-[14.5px] font-semibold text-plum first-letter:uppercase">
                  {dataHoraPorExtenso(slotEscolhido.inicio)}
                </p>
              </div>
            </div>

            {erro && <p className="mt-3 text-[13.5px] font-medium text-red-alert">{erro}</p>}

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSlotEscolhido(null)
                  setErro(null)
                }}
                disabled={enviando}
                className="h-[46px] flex-1 rounded-full border border-plum/15 bg-white text-[14.5px] font-semibold text-plum transition-es disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmarReagendamento}
                disabled={enviando}
                className="h-[46px] flex-1 rounded-full bg-mauve text-[14.5px] font-semibold text-cream transition-es disabled:opacity-60"
              >
                {enviando ? 'Confirmando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
