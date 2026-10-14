'use client'

import Link from 'next/link'
import { ESSkeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { TelaSuave, Secao, Carrossel, Capa, CalendarPlusIcon, UserIcon, UsersIcon, HeartIcon, MessageCircleIcon } from '@/features/usuaria/ui'
import { m04 } from '@/features/m04/api/client'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { useCatalogoTipos } from '@/features/m04/api/use-catalogo'
import { blocoData, hora } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type PaginaSessoes = components['schemas']['PaginaSessoes']
type PaginaProfissionais = components['schemas']['PaginaProfissionais']
type SessaoResumo = PaginaSessoes['content'][number]
type Profissional = PaginaProfissionais['content'][number]

const ICONE_TIPO: Record<string, typeof UserIcon> = {
  Individual: UserIcon,
  Casal: HeartIcon,
  RodaConversa: MessageCircleIcon,
  TerapiaGrupo: UsersIcon,
}

/**
 * ConsultasView — tela ÚNICA de atendimento (protótipo 1h). Antes, cada pergunta tinha uma
 * rota aninhada (minhas sessões, escolher tipo, escolher profissional, grupos); aqui elas viram
 * seções de uma página, na ordem do que ela mais procura:
 *
 * 1. **Minhas sessões** — a próxima em destaque, as seguintes em linha, e o histórico.
 * 2. **Profissionais** — retratos com o nome sobre a parte escura do gradiente.
 * 3. **Sessões em grupo** abertas.
 * 4. **Tipos de sessão** — só informativo, para ela entender o que cada uma oferece.
 *
 * O caminho de marcar continua o mesmo: Consultas → perfil da profissional → horário →
 * confirmação. Os fluxos de detalhe, reagendamento e grupo não mudaram.
 */
export function ConsultasView() {
  const proximas = useRecurso<PaginaSessoes>(
    () =>
      m04.GET('/usuaria/sessoes', {
        params: { query: { status: ['Agendada', 'Confirmada'], de: new Date().toISOString(), ordem: 'asc', page: 0, size: 3 } },
      }),
    [],
  )
  const realizadas = useRecurso<PaginaSessoes>(
    () => m04.GET('/usuaria/sessoes', { params: { query: { status: ['Realizada'], page: 0, size: 1 } } }),
    [],
  )
  const profissionais = useRecurso<PaginaProfissionais>(
    () => m04.GET('/profissionais', { params: { query: { tipo: 'Individual', page: 0, size: 12 } } }),
    [],
  )
  const grupos = useRecurso<PaginaSessoes>(() => m04.GET('/grupos', { params: { query: { page: 0, size: 8 } } }), [])
  const { catalogo } = useCatalogoTipos()

  const sessoes = proximas.dados?.content ?? []
  const [primeira, ...seguintes] = sessoes
  const nRealizadas = realizadas.dados?.totalElements ?? 0

  return (
    <TelaSuave>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[34px] font-normal leading-[1.05] text-plum lg:text-[40px]">Consultas</h1>
        <Link
          href="/agendar"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mauve px-4 py-2.5 text-[13px] font-semibold text-cream shadow-[0_6px_18px_rgba(122,74,92,0.28)] transition-es hover:bg-mauve-dark"
        >
          <CalendarPlusIcon size={15} />
          Agendar
        </Link>
      </div>

      {/* 1 · Minhas sessões */}
      <section className="pt-5">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-plum/45">Minhas sessões</p>
        {proximas.carregando ? (
          <ESSkeleton variant="rectangular" height={150} className="rounded-[22px]" />
        ) : (
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_6px_22px_rgba(45,24,64,0.08)] lg:max-w-2xl">
            {primeira ? (
              <Link href={`/sessoes/${primeira.id}`} className="flex items-center gap-[13px] p-4 transition-es hover:bg-plum/[0.02]">
                <BlocoData iso={primeira.dataHora} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-plum">
                    {primeira.tituloGrupo ?? primeira.profissional?.nome ?? 'Sessão'}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-plum/55">
                    {hora(primeira.dataHora)} · {rotuloTipo(primeira.tipo, catalogo?.tipos)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-mauve px-4 py-2 text-[12.5px] font-semibold text-cream">Ver</span>
              </Link>
            ) : (
              <div className="p-4">
                <p className="text-[14px] text-plum/65">Nenhuma sessão marcada.</p>
                <Link href="/agendar" className="mt-1 inline-block text-[13px] font-semibold text-mauve hover:text-mauve-dark">
                  Agendar a primeira →
                </Link>
              </div>
            )}
            {seguintes.map((s) => (
              <Link
                key={s.id}
                href={`/sessoes/${s.id}`}
                className="flex items-center gap-3 border-t border-plum/[0.06] px-4 py-3 text-[13px] transition-es hover:bg-plum/[0.02]"
              >
                <span className="w-14 shrink-0 capitalize text-plum/45">{diaCurto(s.dataHora)}</span>
                <span className="min-w-0 flex-1 truncate text-plum">
                  {s.tituloGrupo ?? s.profissional?.nome ?? 'Sessão'}
                  <span className="text-plum/45"> · {rotuloTipo(s.tipo, catalogo?.tipos).toLowerCase()}</span>
                </span>
                <span className="shrink-0 text-plum/45">{hora(s.dataHora)}</span>
              </Link>
            ))}
            <Link
              href="/sessoes"
              className="block border-t border-plum/[0.06] px-4 py-3 text-[12.5px] font-semibold text-mauve transition-es hover:bg-plum/[0.02]"
            >
              Histórico{nRealizadas > 0 ? ` · ${nRealizadas} ${nRealizadas === 1 ? 'realizada' : 'realizadas'}` : ''} →
            </Link>
          </div>
        )}
      </section>

      {/* 2 · Profissionais */}
      <Secao titulo="Profissionais" link={{ href: '/agendar/Individual', rotulo: 'Ver todas' }}>
        {profissionais.carregando ? (
          <Carrossel>
            {[0, 1, 2].map((i) => (
              <ESSkeleton key={i} variant="rectangular" height={206} className="w-[160px] shrink-0 rounded-[20px] lg:w-auto" />
            ))}
          </Carrossel>
        ) : (profissionais.dados?.content ?? []).length === 0 ? (
          <p className="text-[14px] text-plum/55">Nenhuma profissional disponível no momento.</p>
        ) : (
          <Carrossel grade="lg:grid-cols-4">
            {(profissionais.dados?.content ?? []).map((p) => (
              <Retrato key={p.id} profissional={p} />
            ))}
          </Carrossel>
        )}
      </Secao>

      {/* 3 · Sessões em grupo */}
      {(grupos.carregando || (grupos.dados?.content ?? []).length > 0) && (
        <Secao titulo="Sessões em grupo">
          {grupos.carregando ? (
            <ESSkeleton variant="rectangular" height={150} className="rounded-[20px]" />
          ) : (
            <Carrossel grade="lg:grid-cols-3">
              {(grupos.dados?.content ?? []).map((g) => (
                <CartaoGrupo key={g.id} sessao={g} />
              ))}
            </Carrossel>
          )}
        </Secao>
      )}

      {/* 4 · Tipos de sessão — informativo */}
      {catalogo && catalogo.tipos.length > 0 && (
        <Secao titulo="Tipos de sessão" descricao="Para você entender o que cada uma oferece.">
          <div className="grid gap-2.5 lg:grid-cols-2">
            {catalogo.tipos.map((t) => {
              const Icone = ICONE_TIPO[t.codigo] ?? UserIcon
              return (
                <div key={t.codigo} className="flex items-start gap-3 rounded-[18px] bg-white p-4 shadow-[0_4px_16px_rgba(45,24,64,0.06)]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mauve-ghost text-mauve">
                    <Icone size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-plum">{t.nome}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-plum/55">
                      {t.descricao ?? ''}
                      {t.descricao ? ' · ' : ''}
                      {t.duracaoMinutos} min
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Secao>
      )}
    </TelaSuave>
  )
}

function rotuloTipo(codigo: string, tipos?: { codigo: string; nome: string }[]): string {
  return tipos?.find((t) => t.codigo === codigo)?.nome ?? codigo
}

function diaCurto(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

function BlocoData({ iso }: { iso: string }) {
  const b = blocoData(iso)
  return (
    <div className="w-[50px] shrink-0 rounded-[14px] bg-plum py-[7px] text-center text-cream">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">{b.dia}</div>
      <div className="font-display text-[22px] leading-none">{b.numero}</div>
    </div>
  )
}

/**
 * Retrato da profissional — foto em destaque, gradiente escuro por cima e o nome sobre a parte
 * mais escura. Sem foto, a inicial sobre um fundo ameixa (melhor do que um avatar genérico).
 */
function Retrato({ profissional }: { profissional: Profissional }) {
  const foto = profissional.foto && /^https?:\/\//i.test(profissional.foto) ? profissional.foto : null
  return (
    <Link
      href={`/agendar/Individual/${profissional.id}`}
      className="group relative block h-[206px] w-[160px] shrink-0 snap-start overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#A07080,#3F2558)] shadow-[0_6px_20px_rgba(45,24,64,0.14)] transition-es hover:shadow-card-hover lg:w-auto"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
      ) : (
        <span className="absolute inset-x-0 top-8 text-center font-display text-[56px] text-cream/40" aria-hidden>
          {profissional.nome.charAt(0)}
        </span>
      )}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(45,24,64,0)_40%,rgba(45,24,64,0.92)_100%)]" />
      <div className="absolute inset-x-3 bottom-3">
        <p className="font-display text-[19px] leading-tight text-cream">{profissional.nome}</p>
        {profissional.abordagem && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-cream/70">{profissional.abordagem}</p>}
      </div>
    </Link>
  )
}

function CartaoGrupo({ sessao }: { sessao: SessaoResumo }) {
  const d = new Date(sessao.dataHora)
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
  const vagas = sessao.vagasDisponiveis
  return (
    <Link href={`/agendar/grupo/${sessao.tipo}/${sessao.id}`} className="group block w-[250px] shrink-0 snap-start lg:w-auto">
      <Capa chave={sessao.id} veu posicao="40% 40%" className="h-[150px] rounded-[20px] transition-es group-hover:shadow-card-hover">
        <div className="absolute inset-x-3.5 bottom-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mauve-soft">
            {dia} · {hora(sessao.dataHora)}
            {vagas != null ? ` · ${vagas} ${vagas === 1 ? 'vaga' : 'vagas'}` : ''}
          </p>
          <p className={cn('mt-1 line-clamp-2 font-display text-[18px] leading-[1.15] text-cream')}>
            {sessao.tituloGrupo ?? 'Sessão em grupo'}
          </p>
        </div>
      </Capa>
    </Link>
  )
}
