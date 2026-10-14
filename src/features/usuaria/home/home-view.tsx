'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ESSkeleton } from '@/components/ui'
import { useAuth } from '@/features/auth/context/auth-context'
import { useHydrated } from '@/lib/use-hydrated'
import { useProximaSessao } from '@/features/m04/usuaria/use-proxima-sessao'
import { blocoData, hora } from '@/features/m04/lib/datas'
import {
  TelaSuave,
  EyebrowPonto,
  Secao,
  Carrossel,
  Capa,
  CartazConteudo,
  NotificacoesMenu,
  ChevronRightIcon,
  InfoIcon,
} from '../ui'
import { useMinhaFase } from '../fase/use-minha-fase'
import { useFeed } from '../feed/use-feed'
import { useTrilhas } from '../trilhas/use-trilhas'
import { useRecentes } from '../conteudos/use-recentes'
import { feedItemToVM } from '../feed/vm'
import { conteudoResumoToVM } from '../conteudos/vm'
import { useJornadaAgenda, useJornadaHoje, useRecomendacoes } from '../jornada/use-jornada'
import { rotuloFase, type RegistroJornada, type SessaoAgenda } from '../jornada/api'
import { CheckinChip, CheckinSheet, checkinPuladoHoje } from '../jornada/checkin-sheet'
import type { ContentItemVM } from '../lib/content'

function saudacao(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

/**
 * HomeView — o MENU GERAL do app (redesenho, protótipo 1a). A ordem é a hierarquia, e não
 * muda: saudação → atalhos → check-in reduzido (se pendente) → destaque → próximos dias →
 * para você. Sem hero ameixa: o título vive no conteúdo, sobre o véu lilás.
 *
 * O check-in deixou de ser um card grande aqui. Ele abre sozinho como tela sobreposta na
 * primeira visita do dia em que ainda não foi feito (`checkinFeitoHoje` do backend); se ela
 * disser "agora não", vira o chip pequeno que reabre a mesma tela. Feito, some até amanhã.
 */
export function HomeView() {
  const { user } = useAuth()
  const primeiro = user?.nome?.split(' ')[0]

  const hoje = useJornadaHoje()
  const agenda = useJornadaAgenda()
  const { dados: recomendacoes } = useRecomendacoes()
  const { data: minhaFase, loading: faseLoading } = useMinhaFase()
  const temFase = Boolean(minhaFase?.atual)
  const semFase = !faseLoading && !temFase

  const { itens: feedItens, loading: feedLoading } = useFeed({ tamanho: 8, enabled: temFase })
  const { itens: recentes, loading: recentesLoading } = useRecentes(8, semFase)
  const { trilhas } = useTrilhas()
  // Reserva: se a agenda da Jornada falhar, a próxima sessão ainda vem do M04.
  const { proxima } = useProximaSessao(agenda.erro)

  // ── check-in ─────────────────────────────────────────────────────────────
  const hidratado = useHydrated()
  const [registradoAgora, setRegistradoAgora] = useState(false)
  // `null` = ninguém mexeu ainda nesta visita, então a tela decide sozinha; depois do primeiro
  // abrir/fechar, vale o gesto dela. Derivado no render, sem efeito: abrir sozinho é só a
  // consequência de "está pendente e ela não pulou hoje".
  const [sheetManual, setSheetManual] = useState<boolean | null>(null)
  const pendente = hoje.dados ? !hoje.dados.checkinFeitoHoje && !registradoAgora : false
  const abrirSozinho = hidratado && pendente && !checkinPuladoHoje()
  const sheetAberto = sheetManual ?? abrirSozinho
  const setSheetAberto = setSheetManual

  // ── vitrine e destaque ───────────────────────────────────────────────────
  const vitrine: ContentItemVM[] = temFase ? feedItens.map(feedItemToVM) : recentes.map(conteudoResumoToVM)
  const vitrineLoading = faseLoading || (temFase ? feedLoading : recentesLoading)

  const recomendada = recomendacoes?.[0]
  const emAndamento = trilhas.find((t) => t.progresso > 0 && t.progresso < 100)
  const trilhaDestaque = recomendada
    ? trilhas.find((t) => t.id === recomendada.trilhaId) ?? null
    : emAndamento ?? trilhas[0] ?? null

  const fase = rotuloFase(hoje.dados?.faseAtual) ?? minhaFase?.atual?.nome ?? null

  return (
    <TelaSuave largura="md">
      {/* Saudação */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {fase && <EyebrowPonto>{fase}</EyebrowPonto>}
          <h1 className="mt-2 font-display text-[34px] font-normal leading-[1.05] text-plum lg:text-[40px]">
            {saudacao()}
            {primeiro ? `, ${primeiro}` : ''}.
          </h1>
        </div>
        <div className="lg:hidden">
          <NotificacoesMenu />
        </div>
      </header>

      {/* Atalhos */}
      {/* `justify-between`, não grade: na grade cada botão ficava CENTRADO na sua coluna, então
          o primeiro não encostava na margem do título e os vãos pareciam soltos. Assim as pontas
          alinham com a coluna e o espaço se divide entre os botões. */}
      <nav aria-label="Atalhos" className="mt-[22px] flex justify-between lg:justify-start lg:gap-8">
        <Atalho href="/jornada" rotulo="Jornada" icone={<GlifoAtalho tipo="jornada" />} />
        <Atalho href="/explorar" rotulo="Explorar" icone={<GlifoAtalho tipo="explorar" />} />
        <Atalho href="/consultas" rotulo="Consultas" icone={<GlifoAtalho tipo="consultas" />} />
        <Atalho onClick={() => setSheetAberto(true)} rotulo="Humor" icone={<GlifoAtalho tipo="humor" />} />
      </nav>

      {/* Check-in reduzido */}
      {pendente && !sheetAberto && (
        <div className="mt-[18px]">
          <CheckinChip onAbrir={() => setSheetAberto(true)} />
        </div>
      )}

      {/* Destaque */}
      {trilhaDestaque && (
        <Link href={`/trilhas/${trilhaDestaque.id}`} className="group mt-5 block">
          <Capa
            src={trilhaDestaque.thumb}
            chave={trilhaDestaque.id}
            veu
            posicao="62% 30%"
            className="h-[236px] rounded-[24px] shadow-[0_12px_34px_rgba(45,24,64,0.16)] transition-es group-hover:shadow-[0_16px_40px_rgba(45,24,64,0.24)] lg:h-[280px]"
          >
            <div className="absolute inset-x-5 bottom-[18px]">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mauve-soft">
                {recomendada ? 'Próximo passo da jornada' : emAndamento ? 'Continue de onde parou' : 'Comece por aqui'}
              </p>
              <h2 className="font-display text-[25px] font-normal leading-[1.1] text-cream lg:text-[30px]">{trilhaDestaque.titulo}</h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[12px] text-cream/80">
                  {/* A listagem às vezes vem sem contagem (`totalConteudos: null`); sem número,
                      "Trilha" basta — "0 conteúdos" numa trilha cheia seria mentira. */}
                  Trilha{trilhaDestaque.total > 0 ? ` · ${trilhaDestaque.total} ${trilhaDestaque.total === 1 ? 'conteúdo' : 'conteúdos'}` : ''}
                </span>
                <span className="rounded-full bg-cream px-3.5 py-2 text-[12.5px] font-semibold text-plum">
                  {emAndamento?.id === trilhaDestaque.id ? 'Continuar →' : 'Começar →'}
                </span>
              </div>
            </div>
          </Capa>
        </Link>
      )}

      {/* Próximos dias */}
      <Secao titulo="Próximos dias" link={{ href: '/jornada', rotulo: 'Jornada' }}>
        <ProximosDias
          carregando={agenda.carregando}
          sessoes={agenda.dados?.sessoes ?? []}
          registros={agenda.dados?.registros ?? []}
          reservaSessao={agenda.erro ? proxima : null}
        />
      </Secao>

      {/* Para você */}
      <Secao titulo="Para você" link={{ href: '/explorar', rotulo: 'Explorar' }}>
        {vitrineLoading ? (
          <Carrossel grade="lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ESSkeleton key={i} variant="rectangular" height={196} className="w-[164px] shrink-0 rounded-[20px] lg:w-auto" />
            ))}
          </Carrossel>
        ) : vitrine.length === 0 ? (
          <p className="text-[14px] text-plum/55">Novos conteúdos aparecem aqui assim que forem publicados.</p>
        ) : (
          <Carrossel grade="lg:grid-cols-3">
            {vitrine.slice(0, 6).map((item) => (
              <CartazConteudo key={item.id} item={item} />
            ))}
          </Carrossel>
        )}
      </Secao>

      <CheckinSheet
        aberto={sheetAberto}
        aoFechar={(r) => {
          setSheetAberto(false)
          if (r === 'registrado') setRegistradoAgora(true)
        }}
      />
    </TelaSuave>
  )
}

/** Atalho do topo: quadrado branco 56px com ícone mauve e rótulo. Link ou botão. */
function Atalho({
  href,
  onClick,
  rotulo,
  icone,
}: {
  href?: string
  onClick?: () => void
  rotulo: string
  icone: ReactNode
}) {
  const conteudo = (
    <>
      <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-mauve shadow-[0_4px_16px_rgba(45,24,64,0.08)] transition-es group-hover:shadow-[0_6px_20px_rgba(45,24,64,0.14)]">
        {icone}
      </span>
      <span className="whitespace-nowrap text-[11.5px] font-semibold text-plum">{rotulo}</span>
    </>
  )
  // Largura fixa = a do quadrado: com `justify-between`, itens de larguras diferentes (o rótulo
  // "Consultas" é mais largo) deixariam os vãos desiguais. O rótulo pode passar um pouco das
  // bordas do quadrado, centrado.
  const cls = 'group flex w-14 flex-col items-center gap-[7px]'
  return href ? (
    <Link href={href} className={cls}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {conteudo}
    </button>
  )
}

/**
 * Os quatro ícones dos atalhos, desenhados JUNTOS: mesmo tamanho (23), mesmo traço (1.4, o do
 * protótipo) e mesma caixa. Antes vinham de três kits diferentes — traço 1.9 na Jornada, 1.6
 * em Explorar/Consultas, 1.5 no termômetro — e o primeiro parecia em negrito ao lado dos outros.
 */
function GlifoAtalho({ tipo }: { tipo: 'jornada' | 'explorar' | 'consultas' | 'humor' }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {tipo === 'jornada' && (
        <>
          <circle cx="6" cy="19" r="2" />
          <path d="M9 19h6.5a3.5 3.5 0 0 0 0-7h-6a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="2" />
        </>
      )}
      {tipo === 'explorar' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9z" />
        </>
      )}
      {tipo === 'consultas' && (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M16 3v4M8 3v4M3.5 10h17" />
        </>
      )}
      {tipo === 'humor' && <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />}
    </svg>
  )
}

function rotuloDiaRelativo(dataISO: string): string {
  const hoje = new Date()
  const [a, m, d] = dataISO.slice(0, 10).split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const dias = Math.round((alvo.getTime() - base.getTime()) / 86_400_000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return alvo.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

/**
 * "Próximos dias" — sessões e registros da Jornada (exames, medicamentos…) ainda não feitos,
 * em ordem de data. No máximo três: a Home mostra o que vem, a Jornada mostra tudo.
 */
function ProximosDias({
  carregando,
  sessoes,
  registros,
  reservaSessao,
}: {
  carregando: boolean
  sessoes: SessaoAgenda[]
  registros: RegistroJornada[]
  reservaSessao: { id: string; dataHora: string; profissional?: { nome?: string } } | null
}) {
  if (carregando) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1].map((i) => (
          <ESSkeleton key={i} variant="rectangular" height={74} className="rounded-[20px]" />
        ))}
      </div>
    )
  }

  type Item = { chave: string; quando: string; no: ReactNode }
  const itens: Item[] = [
    ...sessoes.map((s) => ({
      chave: `s-${s.sessaoId}`,
      quando: s.inicio,
      no: <LinhaSessao href={`/sessoes/${s.sessaoId}`} inicio={s.inicio} titulo={s.profissional ? `Sessão com ${s.profissional}` : 'Sessão'} />,
    })),
    ...registros
      .filter((r) => !r.concluido && r.dataEvento)
      .map((r) => ({
        chave: `r-${r.id}`,
        quando: `${r.dataEvento}T23:59:59`,
        no: <LinhaRegistro registro={r} />,
      })),
  ]
  if (itens.length === 0 && reservaSessao) {
    itens.push({
      chave: `s-${reservaSessao.id}`,
      quando: reservaSessao.dataHora,
      no: (
        <LinhaSessao
          href={`/sessoes/${reservaSessao.id}`}
          inicio={reservaSessao.dataHora}
          titulo={reservaSessao.profissional?.nome ? `Sessão com ${reservaSessao.profissional.nome}` : 'Sessão'}
        />
      ),
    })
  }

  if (itens.length === 0) {
    return (
      <div className="rounded-[20px] bg-white p-4 shadow-[0_4px_16px_rgba(45,24,64,0.07)]">
        <p className="text-[14px] text-plum/65">Nada marcado para os próximos dias.</p>
        <Link href="/consultas" className="mt-1.5 inline-block text-[13px] font-semibold text-mauve hover:text-mauve-dark">
          Agendar uma consulta →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {itens
        .sort((a, b) => a.quando.localeCompare(b.quando))
        .slice(0, 3)
        .map((i) => (
          <div key={i.chave}>{i.no}</div>
        ))}
    </div>
  )
}

function LinhaSessao({ href, inicio, titulo }: { href: string; inicio: string; titulo: string }) {
  const b = blocoData(inicio)
  const rel = rotuloDiaRelativo(inicio.slice(0, 10))
  return (
    <Link href={href} className="flex items-center gap-[13px] rounded-[20px] bg-white p-3 shadow-[0_4px_16px_rgba(45,24,64,0.07)] transition-es hover:shadow-card-hover">
      <div className="w-[50px] shrink-0 rounded-[14px] bg-plum py-[7px] text-center text-cream">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">{b.dia}</div>
        <div className="font-display text-[22px] leading-none">{b.numero}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-plum">{titulo}</p>
        <p className="mt-0.5 text-[12.5px] text-plum/55">{hora(inicio)} · online</p>
      </div>
      {(rel === 'Hoje' || rel === 'Amanhã') && (
        <span className="rounded-full bg-mauve-ghost px-2.5 py-[5px] text-[11px] font-semibold text-mauve">{rel}</span>
      )}
    </Link>
  )
}

const CATEGORIA_ROTULO: Record<string, string> = {
  EXAME: 'Exame',
  MEDICAMENTO: 'Medicamento',
  SUPLEMENTO: 'Suplemento',
  CICLO_MENSTRUAL: 'Ciclo',
  NUTRICAO: 'Nutrição',
  CHECKIN: 'Check-in',
  MICROPRATICA: 'Prática',
}

function LinhaRegistro({ registro }: { registro: RegistroJornada }) {
  return (
    <Link href="/jornada" className="flex items-center gap-[13px] rounded-[20px] bg-white p-3 shadow-[0_4px_16px_rgba(45,24,64,0.07)] transition-es hover:shadow-card-hover">
      <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] bg-mauve-ghost text-mauve">
        <InfoIcon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-plum">{registro.titulo}</p>
        <p className="mt-0.5 text-[12.5px] text-plum/55">
          {CATEGORIA_ROTULO[registro.categoria] ?? 'Registro'} · {registro.dataEvento ? rotuloDiaRelativo(registro.dataEvento) : ''}
        </p>
      </div>
      <ChevronRightIcon size={18} className="shrink-0 text-plum/30" />
    </Link>
  )
}
