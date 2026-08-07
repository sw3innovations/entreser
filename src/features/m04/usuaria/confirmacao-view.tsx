'use client'

import { useRouter } from 'next/navigation'
import { ESSkeleton } from '@/components/ui'
import {
  PageHero,
  PageContent,
  CheckIcon,
  ChevronRightIcon,
  BellIcon,
  ShieldCheckIcon,
  CalendarIcon,
} from '@/features/usuaria/ui'
import { m04 } from '@/features/m04/api/client'
import { useCatalogoTipos } from '@/features/m04/api/use-catalogo'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { blocoData, diaPorExtenso, hora, reais } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Sessao = components['schemas']['Sessao']
export type ContextoConfirmacao = 'agendamento' | 'reagendamento'

const COPY: Record<ContextoConfirmacao, { eyebrow: string; title: string; description: string }> = {
  agendamento: {
    eyebrow: 'Tudo certo',
    title: 'Consulta agendada!',
    description: 'A gente cuida dos lembretes — você só precisa aparecer no horário combinado.',
  },
  reagendamento: {
    eyebrow: 'Tudo certo',
    title: 'Horário atualizado!',
    description: 'Sua sessão foi remarcada. Os lembretes já seguem o novo horário.',
  },
}

/** Só o que a sessão já garante — nada de promessa que o backend não cumpre (D14/UF8). */
const PROXIMOS_PASSOS = [
  { Icone: BellIcon, texto: 'Enviamos lembretes antes da sessão.' },
  { Icone: CalendarIcon, texto: 'A sala de vídeo abre 30 minutos antes, aqui no app.' },
  { Icone: ShieldCheckIcon, texto: 'Dá para remarcar ou cancelar até 24 horas antes, sem custo.' },
]

function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

/**
 * U5b/U12b · Tela de sucesso pós-marcação (#4) e pós-reagendamento (#5) — deixa o resultado
 * explícito em vez de já cair direto no detalhe. É TERMINAL: sem botão Voltar (só se chega
 * aqui via `router.replace` do confirmar/reagendar, então não há "de onde voltar" que faça
 * sentido) e as duas saídas também usam `replace`, para nunca reaparecer no histórico.
 *
 * O desenho trata isto como um MOMENTO, não como mais uma tela: selo de check centralizado
 * com halo, e o mesmo bloco de data em cartão que a pessoa acabou de ver na confirmação
 * (`blocoData`) — a repetição é proposital, é o que faz esta tela ler como a conclusão
 * daquela. Abaixo do resumo, "o que acontece agora" responde a pergunta que naturalmente
 * vem depois de marcar, em vez de deixar a pessoa procurar.
 */
export function ConfirmacaoView({ sessaoId, ctx }: { sessaoId: string; ctx: ContextoConfirmacao }) {
  const router = useRouter()
  const copy = COPY[ctx]
  // Resumo é um "bônus": se a sessão ainda não carregou, os botões seguem funcionando —
  // a confirmação em si não depende deste fetch.
  const { dados } = useRecurso<Sessao>(
    () => m04.GET('/sessoes/{sessaoId}', { params: { path: { sessaoId } } }),
    [sessaoId],
  )
  const { catalogo } = useCatalogoTipos()
  const tipoInfo = dados ? catalogo?.tipos.find((t) => t.codigo === dados.tipo) : undefined
  const nomeDaSessao = dados?.tituloGrupo?.trim() || tipoInfo?.nome

  const data = dados ? blocoData(dados.dataHora) : null

  return (
    <div className="min-h-dvh pb-16">
      <PageHero width="md" className="pb-9 lg:pb-11">
        <div className="flex flex-col items-center text-center">
          {/* Selo: o halo é uma camada irmã (não filha) para poder escalar além do
              selo sem arrastar o ícone junto. */}
          <div className="relative mb-5 flex h-[74px] w-[74px] items-center justify-center">
            <span
              aria-hidden
              className="animate-es-halo absolute inset-0 rounded-full bg-cream/25"
              style={{ animationDelay: '160ms' }}
            />
            <span className="animate-es-selo relative flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-inset ring-white/25 backdrop-blur-sm">
              <CheckIcon size={34} strokeWidth={2.2} className="text-cream" />
            </span>
          </div>

          <p className="animate-es-subir text-eyebrow text-cream/50" style={{ animationDelay: '120ms' }}>
            {copy.eyebrow}
          </p>
          <h1
            className="animate-es-subir mt-1.5 font-display text-[32px] font-light leading-tight text-cream"
            style={{ animationDelay: '180ms' }}
          >
            {copy.title}
          </h1>
          <p
            className="animate-es-subir mt-3 max-w-sm text-sm leading-relaxed text-cream/60"
            style={{ animationDelay: '240ms' }}
          >
            {copy.description}
          </p>
        </div>
      </PageHero>

      <PageContent width="md" className="pt-6">
        {/* Resumo do que ficou marcado. Sobe um pouco sobre a faixa no desktop para
            amarrar hero e conteúdo num bloco só. */}
        <div className="animate-es-subir" style={{ animationDelay: '300ms' }}>
          {dados && data ? (
            <div className="overflow-hidden rounded-card border border-plum/8 bg-white shadow-card">
              <div className="flex items-center gap-4 p-5">
                <div className="flex w-[62px] shrink-0 flex-col items-center rounded-2xl bg-gradient-to-br from-plum to-plum-mid py-2.5 text-center shadow-[0_8px_20px_rgba(45,24,64,0.28)]">
                  <span className="text-[9.5px] font-bold tracking-wider text-cream/70">{data.dia}</span>
                  <span className="font-display text-[26px] leading-tight text-cream">{data.numero}</span>
                  <span className="text-[9.5px] font-semibold tracking-wider text-cream/60">{data.mes}</span>
                </div>
                <div className="min-w-0">
                  {/* A hora manda; a data por extenso não repete o horário (`diaPorExtenso`,
                      não `dataHoraPorExtenso`). `first-letter:uppercase` em vez de
                      `capitalize`: em pt-BR só a inicial sobe — "segunda-feira, 28 de
                      setembro", nunca "28 De Setembro". */}
                  <h2 className="font-display text-[26px] leading-none text-plum">{hora(dados.dataHora)}</h2>
                  <p className="mt-1.5 text-[13px] text-plum/50 first-letter:uppercase">
                    {diaPorExtenso(dados.dataHora)}
                  </p>
                  <p className="mt-0.5 text-[13px] text-plum/45">termina às {hora(dados.dataHoraFim)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-plum/8 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-mauve to-plum-mid shadow-[0_4px_12px_rgba(122,74,92,0.26)]">
                  {dados.profissional.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dados.profissional.foto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-[13px] text-cream">{iniciais(dados.profissional.nome)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-plum">{dados.profissional.nome}</p>
                  {nomeDaSessao && <p className="truncate text-[12.5px] text-plum/50">{nomeDaSessao}</p>}
                </div>
                {reais(dados.valorPraticado) && (
                  <span className="shrink-0 text-[14.5px] font-semibold text-plum">
                    {reais(dados.valorPraticado)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            // Placeholder na mesma altura do cartão real: sem pulo de layout quando
            // a sessão chega.
            <div className="rounded-card border border-plum/8 bg-white p-5 shadow-card">
              <div className="flex items-center gap-4">
                <ESSkeleton variant="rectangular" width={62} height={74} className="rounded-2xl" />
                <div className="flex-1">
                  <ESSkeleton width="45%" height={26} />
                  <ESSkeleton width="80%" height={13} className="mt-2.5" />
                  <ESSkeleton width="55%" height={13} className="mt-1.5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-plum/8 pt-4">
                <ESSkeleton variant="circular" width={40} height={40} />
                <div className="flex-1">
                  <ESSkeleton width="50%" height={14} />
                  <ESSkeleton width="35%" height={12} className="mt-1.5" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* O que vem depois — responde a dúvida natural do "e agora?" sem obrigar a
            abrir o detalhe. */}
        <div className="animate-es-subir mt-5" style={{ animationDelay: '380ms' }}>
          <p className="text-eyebrow mb-3 px-0.5 text-mauve">O que acontece agora</p>
          <ul className="flex flex-col gap-2.5">
            {PROXIMOS_PASSOS.map(({ Icone, texto }) => (
              <li
                key={texto}
                className="flex items-start gap-3 rounded-input border border-plum/8 bg-white px-4 py-3 shadow-card"
              >
                <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mauve-ghost text-mauve">
                  <Icone size={13} />
                </span>
                <p className="text-[13px] leading-relaxed text-plum/62">{texto}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-es-subir mt-7 flex flex-col gap-3" style={{ animationDelay: '460ms' }}>
          <button
            type="button"
            onClick={() => router.replace(`/sessoes/${sessaoId}?origem=confirmacao`)}
            className="flex h-[52px] items-center justify-center gap-1.5 rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es hover:shadow-[0_10px_26px_rgba(122,74,92,0.4)] active:scale-[0.99]"
          >
            Ver detalhes da sessão
            <ChevronRightIcon size={17} />
          </button>
          <button
            type="button"
            onClick={() => router.replace('/sessoes')}
            className="flex h-[52px] items-center justify-center rounded-full border border-mauve/25 bg-white text-[15px] font-semibold text-mauve transition-es hover:border-mauve/45 active:scale-[0.99]"
          >
            Ir para Minhas Sessões
          </button>
        </div>
      </PageContent>
    </div>
  )
}
