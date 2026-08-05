'use client'

import { useState } from 'react'
import { PageHeader, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useListaPaginada } from '@/features/m04/api/use-lista-paginada'
import { Estado } from '@/features/m04/ui/estado'
import { VerMais } from '@/features/m04/ui/ver-mais'
import { SessoesAfetadas } from './sessoes-afetadas'
import { chaveDoDia, fimDoDiaUTC, hojeISO, inicioDoDiaUTC } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Bloqueio = components['schemas']['BloqueioAgenda']
type SessaoResumo = components['schemas']['SessaoResumo']

const CARD = 'rounded-card border border-plum/5 bg-white shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** `YYYY-MM-DD` local → `Date` local (nunca `new Date(iso)`, que o navegador lê como UTC). */
function dataLocal(chave: string): Date {
  const [a, m, d] = chave.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** `Date` local → `YYYY-MM-DD` local. */
function chaveDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * "3 a 16 de agosto" / "28 de agosto" / "3 de agosto a 2 de setembro" — o rótulo curto
 * de um período, colapsando o que se repete entre as duas pontas.
 */
function rotuloPeriodo(inicio: string, fim: string): string {
  const a = dataLocal(inicio)
  const z = dataLocal(fim)
  if (inicio === fim) return `${a.getDate()} de ${MESES[a.getMonth()]}`
  if (a.getMonth() === z.getMonth() && a.getFullYear() === z.getFullYear()) {
    return `${a.getDate()} a ${z.getDate()} de ${MESES[a.getMonth()]}`
  }
  if (a.getFullYear() === z.getFullYear()) {
    return `${a.getDate()} de ${MESES[a.getMonth()]} a ${z.getDate()} de ${MESES[z.getMonth()]}`
  }
  return `${a.getDate()} de ${MESES[a.getMonth()]} de ${a.getFullYear()} a ${z.getDate()} de ${MESES[z.getMonth()]} de ${z.getFullYear()}`
}

/** Dias inteiros de um período, pontas incluídas. */
function diasDoPeriodo(inicio: string, fim: string): number {
  return Math.round((dataLocal(fim).getTime() - dataLocal(inicio).getTime()) / 86_400_000) + 1
}

/** "12 de julho" — quando o bloqueio foi criado. */
function dataCriacao(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}

interface Celula {
  dia: string
  chave: string
}

/** As células de um mês (vazias no começo até cair no dia da semana certo). */
function montarMes(ano: number, mes: number): { nome: string; celulas: Celula[] } {
  const ref = new Date(ano, mes, 1)
  const primeiro = ref.getDay()
  const total = new Date(ano, mes + 1, 0).getDate()
  const celulas: Celula[] = []
  for (let i = 0; i < primeiro; i++) celulas.push({ dia: '', chave: '' })
  for (let d = 1; d <= total; d++) celulas.push({ dia: String(d), chave: chaveDe(new Date(ano, mes, d)) })
  return { nome: `${MESES[mes][0].toUpperCase()}${MESES[mes].slice(1)} de ${ano}`, celulas }
}

/**
 * P5 · Bloquear datas — férias, congressos, qualquer ausência. Criar um bloqueio devolve
 * `sessoesAfetadas`: as sessões que já estavam marcadas dentro do período. Elas **não são
 * canceladas**; o banner lista para a profissional resolver uma a uma.
 *
 * O calendário é próprio (não o do HeroUI) porque precisa de três estados por dia que um
 * range-picker de biblioteca não expõe: já bloqueado (pinta e trava), passado (trava) e a
 * seleção em andamento. Clicar escolhe o primeiro dia; clicar de novo fecha o período.
 */
export function BloqueiosView() {
  const { showToast } = useToast()
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [afetadas, setAfetadas] = useState<SessaoResumo[] | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [mostrarPassados, setMostrarPassados] = useState(false)

  const { itens, total, carregando, carregandoMais, erro: erroCarga, temMais, carregarMais, recarregar } =
    useListaPaginada<Bloqueio>(
      (page) => m04.GET('/profissional/bloqueios', { params: { query: { page, size: 20 } } }),
      [],
    )

  const hoje = hojeISO()

  // Cada bloqueio nas suas chaves de dia LOCAL — o backend guarda instantes UTC, e é a
  // data local que a profissional escolheu.
  const periodos = itens.map((b) => ({
    id: b.id,
    inicio: chaveDoDia(b.dataInicio),
    fim: chaveDoDia(b.dataFim),
    criadoEm: b.criadoEm,
  }))
  const ativos = periodos.filter((p) => p.fim >= hoje)
  const passados = periodos.filter((p) => p.fim < hoje)

  // Todos os dias já cobertos por um bloqueio ativo — travam no calendário.
  const bloqueados = new Set<string>()
  for (const p of ativos) {
    let d = dataLocal(p.inicio)
    const fimDoP = dataLocal(p.fim)
    while (d <= fimDoP) {
      bloqueados.add(chaveDe(d))
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    }
  }

  const hojeData = dataLocal(hoje)
  const meses = [0, 1, 2].map((k) => montarMes(hojeData.getFullYear(), hojeData.getMonth() + k))

  const periodoInvalido = Boolean(inicio && fim && fim < inicio)
  const podeCriar = Boolean(inicio && fim) && !periodoInvalido
  const dias = podeCriar ? diasDoPeriodo(inicio, fim) : 0

  const escolherDia = (chave: string) => {
    if (!chave || bloqueados.has(chave) || chave < hoje) return
    setErro(null)
    setAfetadas(null)
    if (!inicio || (inicio && fim)) {
      setInicio(chave)
      setFim('')
    } else if (chave < inicio) {
      setInicio(chave)
    } else {
      setFim(chave)
    }
  }

  const limpar = () => {
    setInicio('')
    setFim('')
    setErro(null)
  }

  const criar = async () => {
    if (!podeCriar || salvando) return
    setSalvando(true)
    setErro(null)
    try {
      // O contrato pede `date-time` em UTC; o calendário devolve a data LOCAL. O bloqueio
      // cobre os dias inteiros no fuso da profissional, então a conversão precisa passar
      // pelo fuso — concatenar `Z` deslocaria o período (em Brasília, 3h para trás).
      const { data, error } = await m04.POST('/profissional/bloqueios', {
        body: { dataInicio: inicioDoDiaUTC(inicio), dataFim: fimDoDiaUTC(fim) },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      setInicio('')
      setFim('')
      setAfetadas(data?.sessoesAfetadas ?? [])
      showToast('Período bloqueado.', 'success')
      recarregar()
    } catch {
      setErro(mensagemDe())
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (id: string) => {
    if (removendo) return
    setRemovendo(id)
    setErro(null)
    try {
      const { error } = await m04.DELETE('/profissional/bloqueios/{bloqueioId}', {
        params: { path: { bloqueioId: id } },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      setConfirmando(null)
      showToast('Bloqueio desfeito.', 'success')
      recarregar()
    } catch {
      setErro(mensagemDe())
    } finally {
      setRemovendo(null)
    }
  }

  const lista = [...(mostrarPassados ? passados : []), ...ativos].sort((a, b) =>
    a.inicio.localeCompare(b.inicio),
  )
  const diasSemAtendimento = ativos.reduce((soma, p) => soma + diasDoPeriodo(p.inicio, p.fim), 0)

  const dica = periodoInvalido
    ? 'A data final precisa ser depois da inicial.'
    : podeCriar
      ? `${dias} ${dias === 1 ? 'dia sem atendimento' : 'dias sem atendimento'}. Você pode desfazer depois.`
      : inicio
        ? 'Agora escolha o último dia — ou clique no mesmo dia para bloquear só ele.'
        : 'Dias já bloqueados e dias que passaram não podem ser escolhidos.'

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Bloquear datas"
        description="Para férias, eventos, qualquer ausência pontual. Bloquear um período tira seus horários dele."
      />

      {erro && (
        <p className="mb-5 rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
          {erro}
        </p>
      )}

      {afetadas &&
        (afetadas.length > 0 ? (
          <div className="mb-5">
            <SessoesAfetadas
              sessoes={afetadas}
              titulo={`Período bloqueado. Você tem ${afetadas.length} ${afetadas.length === 1 ? 'sessão marcada' : 'sessões marcadas'} nesse período.`}
              onFechar={() => setAfetadas(null)}
            />
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-3.5 rounded-card border border-success-dark/25 bg-success-dark/[0.06] p-[18px]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-success-dark/[0.14] text-success-dark">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 13 5 5L20 7" />
              </svg>
            </span>
            <p className="min-w-0 flex-1 text-[15px] font-semibold text-plum">
              Período bloqueado. Nenhuma sessão marcada nessas datas.
            </p>
            <button
              type="button"
              onClick={() => setAfetadas(null)}
              aria-label="Fechar aviso"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[17px] leading-none text-plum/45 transition-colors hover:bg-plum/6 hover:text-plum"
            >
              ×
            </button>
          </div>
        ))}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Calendário + criação */}
          <section className={CARD}>
            <div className="flex flex-wrap items-center gap-4 px-[26px] pb-4 pt-[22px]">
              <div className="min-w-0">
                <h2 className="font-display text-[22px] font-medium text-plum">Escolha o período</h2>
                <p className="mt-1 text-[13px] text-plum/55">
                  Clique no primeiro e no último dia — ou digite as datas abaixo.
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-plum/55">
                  <span className="h-3 w-3 rounded-[4px] bg-plum" />
                  selecionado
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-plum/55">
                  <span className="h-3 w-3 rounded-[4px] bg-mauve" />
                  já bloqueado
                </span>
              </div>
            </div>

            <div className="grid gap-x-[26px] gap-y-6 px-[26px] pb-[22px] [grid-template-columns:repeat(auto-fit,minmax(206px,1fr))]">
              {meses.map((mes) => (
                <div key={mes.nome} className="min-w-0">
                  <p className="mb-3 text-sm font-semibold text-plum">{mes.nome}</p>
                  <div className="mb-1.5 grid grid-cols-7 gap-1">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                      <span key={i} className="text-center text-[10.5px] font-semibold text-plum/35">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {mes.celulas.map((c, i) => {
                      if (!c.chave) return <span key={i} />
                      const bloq = bloqueados.has(c.chave)
                      const passou = c.chave < hoje
                      const ponta = c.chave === inicio || c.chave === fim
                      const dentro = Boolean(inicio && fim && c.chave > inicio && c.chave < fim)
                      const ehHoje = c.chave === hoje
                      return (
                        <button
                          key={c.chave}
                          type="button"
                          disabled={bloq || passou}
                          onClick={() => escolherDia(c.chave)}
                          title={bloq ? 'Já bloqueado' : passou ? 'Já passou' : undefined}
                          className={cn(
                            'flex h-[33px] items-center justify-center rounded-[10px] border text-[12.5px] transition-all',
                            bloq
                              ? 'cursor-not-allowed border-transparent bg-mauve font-semibold text-white'
                              : ponta
                                ? 'border-transparent bg-plum font-semibold text-cream'
                                : dentro
                                  ? 'border-transparent bg-mauve-ghost font-medium text-plum'
                                  : passou
                                    ? 'cursor-not-allowed border-transparent text-plum/22'
                                    : cn(
                                        'text-plum/68 hover:shadow-[inset_0_0_0_1.5px_rgba(122,74,92,0.45)]',
                                        ehHoje ? 'border-mauve' : 'border-transparent',
                                      ),
                          )}
                        >
                          {c.dia}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3.5 border-t border-plum/7 bg-cream px-[26px] py-4">
              <div className="min-w-0 flex-1 basis-[220px]">
                <p className={cn('text-[15px] font-semibold', inicio ? 'text-plum' : 'text-plum/45')}>
                  {podeCriar ? rotuloPeriodo(inicio, fim) : inicio ? 'Primeiro dia escolhido' : 'Nenhum período escolhido'}
                </p>
                <p className={cn('mt-0.5 text-[12.5px] leading-snug', periodoInvalido ? 'text-red-alert' : 'text-plum/55')}>
                  {dica}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="date"
                  value={inicio}
                  min={hoje}
                  onChange={(e) => {
                    setInicio(e.target.value)
                    setAfetadas(null)
                  }}
                  className="w-[148px] rounded-[13px] border border-plum/14 bg-white px-3 py-2.5 text-sm font-medium text-plum outline-none transition-colors focus:border-mauve"
                />
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(45,24,64,0.35)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <input
                  type="date"
                  value={fim}
                  min={inicio || hoje}
                  onChange={(e) => {
                    setFim(e.target.value)
                    setAfetadas(null)
                  }}
                  className={cn(
                    'w-[148px] rounded-[13px] border bg-white px-3 py-2.5 text-sm font-medium text-plum outline-none transition-colors focus:border-mauve',
                    periodoInvalido ? 'border-red-alert/50' : 'border-plum/14',
                  )}
                />
              </div>
              {(inicio || fim) && (
                <button
                  type="button"
                  onClick={limpar}
                  className="shrink-0 rounded-pill px-4 py-3 text-[13.5px] font-semibold text-mauve transition-colors hover:bg-mauve-ghost"
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={criar}
                disabled={!podeCriar || salvando}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-pill px-[22px] py-3 text-[14.5px] font-semibold transition-all',
                  podeCriar && !salvando
                    ? 'bg-mauve text-white shadow-[0_8px_20px_rgba(122,74,92,0.28)] hover:bg-mauve-dark'
                    : 'cursor-not-allowed bg-plum/10 text-plum/40',
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2.5" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                  <path d="m10 15 4 3M14 15l-4 3" />
                </svg>
                {salvando ? 'Bloqueando…' : 'Bloquear período'}
              </button>
            </div>
          </section>

          {/* Bloqueios existentes */}
          <section className={CARD}>
            <div className="flex flex-wrap items-center gap-3.5 px-[26px] pb-4 pt-5">
              <h2 className="font-display text-[22px] font-medium text-plum">Seus bloqueios</h2>
              <span className="text-[12.5px] text-plum/50">
                {ativos.length === 1 ? '1 período ativo' : `${ativos.length} períodos ativos`}
              </span>
              {passados.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMostrarPassados((v) => !v)}
                  className="ml-auto inline-flex items-center gap-2 rounded-pill border border-plum/14 bg-white px-4 py-2 text-[13px] font-semibold text-plum transition-colors hover:border-plum hover:bg-plum-soft"
                >
                  {mostrarPassados ? 'Esconder bloqueios anteriores' : 'Mostrar bloqueios anteriores'}
                </button>
              )}
            </div>

            <Estado
              carregando={carregando}
              erro={erroCarga}
              vazio={!carregando && !erroCarga && lista.length === 0}
              aoRepetir={recarregar}
              aoVazio={
                <div className="flex flex-col items-center gap-3 border-t border-plum/7 px-[30px] py-11 text-center">
                  <span className="flex h-[54px] w-[54px] items-center justify-center rounded-pill bg-cream text-mauve">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="16" rx="2.5" />
                      <path d="M3 10h18M8 3v4M16 3v4" />
                    </svg>
                  </span>
                  <div className="max-w-[380px]">
                    <p className="font-display text-[22px] leading-tight text-plum">Nenhum período bloqueado</p>
                    <p className="mt-2 text-sm leading-relaxed text-plum/60">
                      Sua agenda segue disponível em todos os dias que você atende.
                    </p>
                  </div>
                </div>
              }
            >
              {lista.map((p) => {
                const passou = p.fim < hoje
                const qtd = diasDoPeriodo(p.inicio, p.fim)
                return (
                  <div key={p.id} className="border-t border-plum/7">
                    <div className={cn('flex flex-wrap items-center gap-4 px-[26px] py-4', passou && 'opacity-50')}>
                      <span
                        className={cn(
                          'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px]',
                          passou ? 'bg-plum/6 text-plum/40' : 'bg-mauve-ghost text-mauve',
                        )}
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="5" width="18" height="16" rx="2.5" />
                          <path d="M3 10h18M8 3v4M16 3v4" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1 basis-[220px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15.5px] font-semibold text-plum">{rotuloPeriodo(p.inicio, p.fim)}</p>
                          {passou && (
                            <span className="whitespace-nowrap rounded-pill bg-plum/7 px-2.5 py-0.5 text-[11.5px] font-semibold text-plum/50">
                              Encerrado
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12.5px] text-plum/50">
                          {qtd} {qtd === 1 ? 'dia' : 'dias'} · criado em {dataCriacao(p.criadoEm)}
                        </p>
                      </div>
                      {!passou && confirmando !== p.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmando(p.id)}
                          className="shrink-0 rounded-pill border border-plum/16 bg-white px-4 py-2 text-[13.5px] font-semibold text-plum transition-colors hover:border-red-alert hover:bg-red-alert/5 hover:text-red-alert"
                        >
                          Desfazer bloqueio
                        </button>
                      )}
                    </div>

                    {confirmando === p.id && (
                      <div className="flex flex-wrap items-center gap-4 border-t border-red-alert/16 bg-red-alert/5 px-[26px] py-4">
                        <p className="min-w-0 flex-1 basis-[260px] text-[13.5px] leading-snug text-plum">
                          Desfazer este bloqueio? Seus horários voltam a aparecer para agendamento
                          nessas datas.
                        </p>
                        <span className="flex shrink-0 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setConfirmando(null)}
                            className="rounded-pill border border-plum/16 bg-white px-[18px] py-2.5 text-[13.5px] font-semibold text-plum transition-colors hover:border-plum hover:bg-plum-soft"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(p.id)}
                            disabled={removendo === p.id}
                            className="rounded-pill bg-red-alert px-[18px] py-2.5 text-[13.5px] font-semibold text-white shadow-[0_6px_16px_rgba(160,48,64,0.24)] transition-all hover:brightness-95 disabled:opacity-60"
                          >
                            {removendo === p.id ? 'Desfazendo…' : 'Desfazer bloqueio'}
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
              {temMais && (
                <div className="border-t border-plum/7 px-[26px] py-4">
                  <VerMais
                    carregado={itens.length}
                    total={total}
                    carregando={carregandoMais}
                    onVerMais={carregarMais}
                  />
                </div>
              )}
            </Estado>
          </section>
        </div>

        <aside className="flex w-full flex-col gap-5 lg:w-[300px] lg:shrink-0">
          <section className="rounded-card border border-mauve/22 bg-white p-[22px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-mauve-ghost text-mauve">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8.5v5M12 17h.01" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mauve">
                O que o bloqueio faz
              </p>
            </div>
            <p className="text-[13.5px] leading-relaxed text-plum/72">
              Tira seus horários do período — ninguém consegue marcar nessas datas.{' '}
              <strong className="font-semibold">Sessões já marcadas continuam valendo</strong>: se
              quiser desmarcar, cancele uma a uma.
            </p>
          </section>

          <section className={cn(CARD, 'p-[22px]')}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-mauve">Resumo</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] text-plum/55">Bloqueios ativos</span>
                <span className="text-[13.5px] font-semibold text-plum">{ativos.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-plum/7 pt-3">
                <span className="text-[13.5px] text-plum/55">Dias sem atendimento</span>
                <span className="font-display text-[22px] font-medium text-plum">{diasSemAtendimento}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
