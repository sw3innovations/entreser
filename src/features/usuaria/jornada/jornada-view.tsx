'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ESSkeleton, TrilhasIcon, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { hora } from '@/features/m04/lib/datas'
import { TelaSuave, ChevronRightIcon, CheckIcon } from '../ui'
import { useTrilhas } from '../trilhas/use-trilhas'
import { useMinhaFase } from '../fase/use-minha-fase'
import { useJornadaAgenda, useJornadaHoje, useRegistros, useTratamentos } from './use-jornada'
import { FASES, jornadaApi, rotuloFase, type CheckinAgenda, type Emocao, type RegistroJornada, type SessaoAgenda } from './api'
import { CheckinSheet } from './checkin-sheet'

const CATEGORIA: Record<string, string> = {
  EXAME: 'Exame',
  MEDICAMENTO: 'Medicamento',
  SUPLEMENTO: 'Suplemento',
  CICLO_MENSTRUAL: 'Ciclo',
  NUTRICAO: 'Nutrição',
  CHECKIN: 'Check-in',
  MICROPRATICA: 'Prática',
}

const EMOCAO: Record<Emocao, string> = {
  CALMA: 'calma',
  ANSIOSA: 'ansiedade',
  TRISTE: 'tristeza',
  IRRITADA: 'irritação',
  ESPERANCOSA: 'esperança',
  EXAUSTA: 'cansaço',
  ALIVIADA: 'alívio',
  OUTRA: 'outra',
}

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function naUltimaSemana(iso: string): boolean {
  return new Date().getTime() - new Date(iso).getTime() < 7 * 86_400_000
}

/** Semana do tratamento ativo, contando a partir da data de início que ela informou. */
function semanaDoTratamento(dataInicio: string): number {
  const dias = (new Date().getTime() - new Date(`${dataInicio}T00:00:00`).getTime()) / 86_400_000
  return Math.max(1, Math.floor(dias / 7) + 1)
}

/** "desde ontem" / "desde 12/10" / "hoje" — quanto tempo um item está pendente. */
function desde(dataISO: string): string {
  const [a, m, d] = dataISO.split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const h = new Date()
  const base = new Date(h.getFullYear(), h.getMonth(), h.getDate())
  const dias = Math.round((base.getTime() - alvo.getTime()) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'desde ontem'
  return `desde ${alvo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

function quando(dataISO: string): string {
  const [a, m, d] = dataISO.split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const h = new Date()
  const base = new Date(h.getFullYear(), h.getMonth(), h.getDate())
  const dias = Math.round((alvo.getTime() - base.getTime()) / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return alvo.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })
}

/**
 * JornadaView — hub de organização (protótipo 1f). Na primeira olhada ela precisa saber o que
 * pede atenção e o que está tranquilo, então a tela é dividida em três baldes, nessa ordem:
 *
 * - **Precisa de atenção**: registros (exames, medicamentos…) com data de hoje ou já passada e
 *   ainda não feitos, e sessões de hoje.
 * - **Em andamento**: o que vem pela frente (registros e sessões futuras), trilhas começadas e
 *   os check-ins da semana.
 * - **Tudo certo**: o que já foi feito — compacto, porque é o que menos pede olhar.
 *
 * Tudo vem do que o backend já registra (`/paciente/jornada/*`); nada é inferido. A fase vem
 * do tratamento ativo e a linha do tempo só aparece quando há um.
 *
 * "Atrasado" é palavra do protótipo, mas aqui o tom é outro: "desde ontem", sem vermelho de
 * alarme. Um exame que ficou para trás não é uma falha dela.
 */
export function JornadaView() {
  const hoje = useJornadaHoje()
  const agenda = useJornadaAgenda()
  const registros = useRegistros()
  const tratamentos = useTratamentos()
  const { trilhas } = useTrilhas()
  const { data: minhaFase } = useMinhaFase()
  const { showToast } = useToast()
  const [concluidosAgora, setConcluidosAgora] = useState<string[]>([])
  const [verTudoCerto, setVerTudoCerto] = useState(false)
  const [checkinAberto, setCheckinAberto] = useState(false)

  const carregando = hoje.carregando || agenda.carregando || registros.carregando
  const dia = hojeISO()

  const todos = (registros.dados ?? []).map((r) => (concluidosAgora.includes(r.id) ? { ...r, concluido: true } : r))
  const pendentes = todos.filter((r) => !r.concluido && r.dataEvento && r.dataEvento <= dia)
  const futuros = todos.filter((r) => !r.concluido && r.dataEvento && r.dataEvento > dia)
  const feitos = todos.filter((r) => r.concluido)

  const sessoes = agenda.dados?.sessoes ?? []
  const sessoesHoje = sessoes.filter((s) => s.data === dia)
  const sessoesFuturas = sessoes.filter((s) => s.data > dia)

  const trilhasAndamento = trilhas.filter((t) => t.consumidos > 0 && (t.total === 0 || t.consumidos < t.total))
  const trilhasFeitas = trilhas.filter((t) => t.total > 0 && t.consumidos >= t.total)

  const checkinsSemana = (agenda.dados?.checkins ?? []).filter((c) => naUltimaSemana(c.criadoEm))

  const nAtencao = pendentes.length + sessoesHoje.length
  const nAndamento = futuros.length + sessoesFuturas.length + trilhasAndamento.length
  const nCerto = feitos.length + trilhasFeitas.length

  const ativo = tratamentos.dados?.find((t) => t.ativo) ?? null
  const fase = hoje.dados?.faseAtual ?? ativo?.faseAtual ?? null
  const semana = ativo?.dataInicio ? semanaDoTratamento(ativo.dataInicio) : null

  const concluir = async (r: RegistroJornada) => {
    setConcluidosAgora((c) => [...c, r.id]) // otimista
    try {
      await jornadaApi.concluirRegistro(r.id)
      showToast('Marcado como feito.', 'success')
    } catch {
      setConcluidosAgora((c) => c.filter((x) => x !== r.id))
      showToast('Não foi possível salvar. Tente novamente.', 'error')
    }
  }

  return (
    <TelaSuave largura="md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mauve">
        Jornada{semana ? ` · semana ${semana}` : ''}
      </p>
      <h1 className="mt-1.5 font-display text-[32px] font-normal leading-[1.08] text-plum lg:text-[40px]">
        {fase ? (
          <>
            Você está na <em className="italic">{rotuloFase(fase)?.toLowerCase()}</em>.
          </>
        ) : minhaFase?.atual ? (
          <>
            Você está em <em className="italic">{minhaFase.atual.nome.toLowerCase()}</em>.
          </>
        ) : (
          'Sua jornada, organizada.'
        )}
      </h1>

      {/* Contadores */}
      {carregando ? (
        <ESSkeleton variant="rectangular" height={88} className="mt-5 rounded-[20px]" />
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Contador valor={nAtencao} rotulo={nAtencao === 1 ? 'pede atenção' : 'pedem atenção'} destaque={nAtencao > 0} />
          <Contador valor={nAndamento} rotulo="em andamento" />
          <Contador valor={nCerto} rotulo="tudo certo" cor="text-[#4C7A54]" />
        </div>
      )}

      {/* Linha das fases — só com um tratamento ativo */}
      {fase && fase !== 'OUTRA' && <LinhaDasFases atual={fase} />}

      {/* Precisa de atenção */}
      {!carregando && (pendentes.length > 0 || sessoesHoje.length > 0) && (
        <Bloco titulo="Precisa de atenção">
          {sessoesHoje.map((s) => (
            <CartaoSessao key={s.sessaoId} sessao={s} selo="Hoje" />
          ))}
          {pendentes.map((r) => (
            <div key={r.id} className="rounded-[20px] bg-white p-4 shadow-[0_4px_16px_rgba(45,24,64,0.07)]">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-mauve-ghost px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-mauve">
                  {CATEGORIA[r.categoria] ?? 'Registro'}
                </span>
                <span className="text-[12px] text-plum/50">{desde(r.dataEvento!)}</span>
              </div>
              <p className="mt-2.5 font-display text-[20px] leading-tight text-plum">{r.titulo}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="line-clamp-1 text-[12.5px] text-plum/50">{r.detalhes ?? ''}</span>
                <button
                  type="button"
                  onClick={() => concluir(r)}
                  className="shrink-0 rounded-full bg-mauve px-4 py-2 text-[12.5px] font-semibold text-cream transition-es hover:bg-mauve-dark"
                >
                  Marcar como feito
                </button>
              </div>
            </div>
          ))}
        </Bloco>
      )}

      {/* Em andamento */}
      {!carregando && (
        <Bloco titulo="Em andamento">
          {sessoesFuturas.slice(0, 3).map((s) => (
            <CartaoSessao key={s.sessaoId} sessao={s} />
          ))}
          {futuros.slice(0, 4).map((r) => (
            <Linha
              key={r.id}
              esquerda={<IconeCategoria />}
              titulo={r.titulo}
              sub={`${CATEGORIA[r.categoria] ?? 'Registro'} · ${quando(r.dataEvento!)}`}
            />
          ))}
          {trilhasAndamento.map((t) => (
            <Linha
              key={t.id}
              href={`/trilhas/${t.id}`}
              esquerda={<IconeTrilha />}
              titulo={`Trilha ${t.titulo}`}
              sub="Continue de onde parou"
            />
          ))}
          <CheckinsDaSemana checkins={checkinsSemana} aoRegistrar={() => setCheckinAberto(true)} />
        </Bloco>
      )}

      {/* Tudo certo — compacto */}
      {!carregando && nCerto > 0 && (
        <section className="pt-6">
          <button
            type="button"
            onClick={() => setVerTudoCerto((v) => !v)}
            aria-expanded={verTudoCerto}
            className="flex w-full items-center justify-between rounded-[18px] bg-[#EAF2EB] px-4 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-[#3E6646]">
              <CheckIcon size={16} />
              {nCerto} {nCerto === 1 ? 'item em dia' : 'itens em dia'}
            </span>
            <span className="text-[12.5px] font-semibold text-[#3E6646]">{verTudoCerto ? 'Ocultar' : 'Ver →'}</span>
          </button>
          {verTudoCerto && (
            <ul className="mt-2 flex flex-col">
              {feitos.map((r) => (
                <li key={r.id} className="flex items-center gap-2 border-b border-plum/[0.06] py-2.5 text-[13.5px] text-plum/60 last:border-none">
                  <CheckIcon size={14} className="text-[#4C7A54]" />
                  <span className="line-through decoration-plum/25">{r.titulo}</span>
                </li>
              ))}
              {trilhasFeitas.map((t) => (
                <li key={t.id} className="flex items-center gap-2 border-b border-plum/[0.06] py-2.5 text-[13.5px] text-plum/60 last:border-none">
                  <CheckIcon size={14} className="text-[#4C7A54]" />
                  <span>Trilha {t.titulo}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!carregando && nAtencao + nAndamento + nCerto === 0 && checkinsSemana.length === 0 && (
        <p className="pt-6 text-[14px] leading-relaxed text-plum/60">
          Por enquanto não há nada registrado. Exames, medicamentos e sessões aparecem aqui conforme forem
          marcados, junto com as trilhas que você começar.
        </p>
      )}

      <CheckinSheet aberto={checkinAberto} aoFechar={() => { setCheckinAberto(false); agenda.recarregar() }} />
    </TelaSuave>
  )
}

function Contador({ valor, rotulo, destaque, cor }: { valor: number; rotulo: string; destaque?: boolean; cor?: string }) {
  return (
    <div className={cn('rounded-[18px] px-3.5 py-3', destaque ? 'bg-plum text-cream' : 'bg-white shadow-[0_4px_16px_rgba(45,24,64,0.06)]')}>
      <p className={cn('font-display text-[30px] leading-none', !destaque && (cor ?? 'text-plum'))}>{valor}</p>
      <p className={cn('mt-1.5 text-[11.5px] leading-tight', destaque ? 'text-cream/70' : 'text-plum/55')}>{rotulo}</p>
    </div>
  )
}

/** As fases do tratamento numa linha, com a atual marcada. Mostra posição, não "quanto falta". */
function LinhaDasFases({ atual }: { atual: string }) {
  const i = FASES.findIndex((f) => f.chave === atual)
  return (
    <div className="mt-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ol className="flex min-w-max items-start">
        {FASES.map((f, idx) => {
          const passou = idx < i
          const eAtual = idx === i
          return (
            <li key={f.chave} className="flex flex-col items-start">
              <div className="flex items-center">
                <span
                  className={cn(
                    'h-3 w-3 rounded-full border-2',
                    eAtual ? 'border-mauve bg-mauve' : passou ? 'border-mauve/50 bg-mauve/50' : 'border-plum/20 bg-[#F6F5F8]',
                  )}
                />
                {idx < FASES.length - 1 && <span className={cn('h-px w-[72px]', idx < i ? 'bg-mauve/50' : 'bg-plum/15')} />}
              </div>
              <span className={cn('mt-1.5 text-[11.5px]', eAtual ? 'font-semibold text-plum' : 'text-plum/40')}>{f.rotulo}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="pt-7">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-plum/45">{titulo}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  )
}

function Linha({ href, esquerda, titulo, sub }: { href?: string; esquerda: ReactNode; titulo: string; sub: string }) {
  const corpo = (
    <>
      {esquerda}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-plum">{titulo}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-plum/55">{sub}</p>
      </div>
      {href && <ChevronRightIcon size={18} className="shrink-0 text-plum/30" />}
    </>
  )
  const cls = 'flex items-center gap-3 rounded-[20px] bg-white p-3 shadow-[0_4px_16px_rgba(45,24,64,0.07)]'
  return href ? (
    <Link href={href} className={cn(cls, 'transition-es hover:shadow-card-hover')}>
      {corpo}
    </Link>
  ) : (
    <div className={cls}>{corpo}</div>
  )
}

function CartaoSessao({ sessao, selo }: { sessao: SessaoAgenda; selo?: string }) {
  return (
    <Linha
      href={`/sessoes/${sessao.sessaoId}`}
      esquerda={
        <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-plum text-cream">
          <span className="font-display text-[15px] leading-none">{hora(sessao.inicio)}</span>
        </span>
      }
      titulo={sessao.profissional ? `Sessão com ${sessao.profissional}` : 'Sessão'}
      sub={selo ? `${selo} · online` : `${quando(sessao.data)} · online`}
    />
  )
}

function IconeCategoria() {
  return (
    <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-mauve-ghost text-mauve">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    </span>
  )
}

function IconeTrilha() {
  return (
    <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-mauve-ghost text-mauve">
      <TrilhasIcon size={20} />
    </span>
  )
}

const CLIMA = ['', '⛈️', '🌧️', '☁️', '🌤️', '☀️']

/**
 * Check-ins da semana — o tempo do último registro e o sentimento que mais apareceu. Sem
 * "4/7" nem sequência de dias: contar quantos dias ela registrou é streak, e streak transforma
 * cuidado em obrigação (princípio do produto). O protótipo tinha o contador; ficou de fora.
 */
function CheckinsDaSemana({ checkins, aoRegistrar }: { checkins: CheckinAgenda[]; aoRegistrar: () => void }) {
  const contagem = new Map<Emocao, number>()
  checkins.forEach((c) => c.emocoes.forEach((e) => contagem.set(e, (contagem.get(e) ?? 0) + 1)))
  const maisFrequente = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const ultimo = checkins[0]

  return (
    <button type="button" onClick={aoRegistrar} className="flex items-center gap-3 rounded-[20px] bg-white p-3 text-left shadow-[0_4px_16px_rgba(45,24,64,0.07)] transition-es hover:shadow-card-hover">
      <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-mauve-ghost text-[24px]" aria-hidden>
        {ultimo ? CLIMA[ultimo.pontuacao] ?? '☁️' : '🌤️'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-plum">Como você tem estado</p>
        <p className="mt-0.5 truncate text-[12.5px] text-plum/55">
          {maisFrequente
            ? `Mais presente na semana: ${EMOCAO[maisFrequente]}`
            : ultimo
              ? 'Obrigada por ir contando'
              : 'Como você está hoje? Registrar →'}
        </p>
      </div>
    </button>
  )
}
