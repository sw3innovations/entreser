'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHero, PageContent, HeroIconButton, ArrowLeftIcon } from '@/features/usuaria/ui'
import { useVoltar } from '@/features/usuaria/shell/nav-history'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { dataHoraPorExtenso, reais } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Grupo = components['schemas']['SessaoGrupoPublica']
type TipoSessao = components['schemas']['TipoSessao']

/**
 * U8 · Detalhe da sessão de grupo, antes de entrar (D22). Carrega `GET /grupos/{id}`, que
 * devolve a forma PÚBLICA — sem lista de participantes, sem link da sala e sem histórico
 * de ninguém. O rótulo do botão sai de `jaInscrita`, que vem pronto no payload: a tela não
 * cruza listas nem adivinha pela presença da usuária entre participantes.
 *
 * Desistir depois das 24h é permitido e cobra o valor cheio (D25) — o backend responde
 * sucesso com `cobrancaAplicada`, não erro.
 */
export function GrupoDetalheView({ tipo, sessaoId }: { tipo: TipoSessao; sessaoId: string }) {
  const router = useRouter()
  const voltar = useVoltar(`/agendar/grupo/${tipo}`)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { dados, carregando, erro: erroCarga, recarregar } = useRecurso<Grupo>(
    () => m04.GET('/grupos/{sessaoId}', { params: { path: { sessaoId } } }),
    [sessaoId],
  )

  const inscrever = async () => {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const { error } = await m04.POST('/sessoes/{sessaoId}/inscrever', {
        params: { path: { sessaoId } },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      router.push(`/sessoes/${sessaoId}`)
    } catch {
      setErro(mensagemDe())
    } finally {
      setEnviando(false)
    }
  }

  const sair = async () => {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const { error } = await m04.DELETE('/sessoes/{sessaoId}/inscrever', {
        params: { path: { sessaoId } },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      recarregar()
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

  const semVaga = dados != null && dados.vagasDisponiveis <= 0 && !dados.jaInscrita

  return (
    <div className="min-h-dvh pb-28">
      <PageHero
        width="md"
        topBar={topBar}
        eyebrow="Sessão em grupo"
        title={dados?.tituloGrupo ?? 'Sessão em grupo'}
        description={dados ? dataHoraPorExtenso(dados.dataHora) : undefined}
      />
      <PageContent width="md" className="pt-6">
        <Estado carregando={carregando} erro={erroCarga} vazio={!dados} aoRepetir={recarregar}>
          {dados && (
            <div className="flex flex-col gap-5">
              <div className="rounded-card border border-plum/8 bg-white p-5 shadow-card">
                {dados.jaInscrita && (
                  <span className="mb-3 inline-flex rounded-pill bg-success-dark/[0.12] px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wider text-success-dark">
                    Você já está inscrita
                  </span>
                )}
                <dl className="flex flex-col gap-3">
                  <Linha rotulo="Com" valor={dados.profissional.nome} />
                  <Linha rotulo="Duração" valor={`${dados.duracaoMinutos} minutos`} />
                  <Linha rotulo="Vagas" valor={`${dados.vagasDisponiveis} de ${dados.vagas} restantes`} />
                  {reais(dados.valorPraticado) && (
                    <Linha rotulo="Valor" valor={`${reais(dados.valorPraticado)} por participante`} />
                  )}
                </dl>
              </div>

              <p className="rounded-input border border-plum/8 bg-white px-4 py-3 text-[13px] leading-relaxed text-plum/60 shadow-card">
                A sessão acontece com um número mínimo de participantes. Se não houver até 24
                horas antes, ela é cancelada e avisamos você. Para desistir, até 24 horas antes
                é sem custo; depois disso, o valor é cobrado por inteiro.
              </p>

              {erro && (
                <p className="rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
                  {erro}
                </p>
              )}
            </div>
          )}
        </Estado>
      </PageContent>

      {dados && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/[0.06] bg-[rgba(255,253,250,0.9)] shadow-[0_-6px_24px_rgba(45,24,64,0.08)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl px-[18px] pb-[18px] pt-[14px]">
            {dados.jaInscrita ? (
              <button
                type="button"
                onClick={sair}
                disabled={enviando}
                className="h-[50px] flex-1 rounded-full border border-mauve/30 bg-white text-[15px] font-semibold text-mauve transition-es active:scale-[0.99] disabled:opacity-60"
              >
                {enviando ? 'Cancelando…' : 'Cancelar minha inscrição'}
              </button>
            ) : (
              <button
                type="button"
                onClick={inscrever}
                disabled={enviando || semVaga}
                className="h-[50px] flex-1 rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.32)] transition-es active:scale-[0.99] disabled:opacity-60"
              >
                {enviando ? 'Inscrevendo…' : semVaga ? 'Sem vagas' : 'Inscrever-se'}
              </button>
            )}
          </div>
        </div>
      )}
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
