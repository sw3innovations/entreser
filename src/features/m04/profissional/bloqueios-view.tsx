'use client'

import { useState } from 'react'
import { DateInput, ESButton, PageHeader, TrashIcon, useToast } from '@/components/ui'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useListaPaginada } from '@/features/m04/api/use-lista-paginada'
import { Estado } from '@/features/m04/ui/estado'
import { VerMais } from '@/features/m04/ui/ver-mais'
import { SessoesAfetadas } from './sessoes-afetadas'
import { fimDoDiaUTC, hojeISO, inicioDoDiaUTC } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type Bloqueio = components['schemas']['BloqueioAgenda']
type SessaoResumo = components['schemas']['SessaoResumo']

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

/** `2026-12-20T00:00:00Z` → `20/12/2026` (a data do bloqueio é um dia inteiro). */
function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * P5 · Bloquear datas — férias, congressos, qualquer ausência. Criar um bloqueio devolve
 * `sessoesAfetadas`: as sessões que já estavam marcadas dentro do período. Elas **não são
 * canceladas**; o banner lista para a profissional resolver uma a uma.
 */
export function BloqueiosView() {
  const { showToast } = useToast()
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [afetadas, setAfetadas] = useState<SessaoResumo[] | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)

  const { itens, total, carregando, carregandoMais, erro: erroCarga, vazio, temMais, carregarMais, recarregar } =
    useListaPaginada<Bloqueio>(
      (page) => m04.GET('/profissional/bloqueios', { params: { query: { page, size: 20 } } }),
      [],
    )

  const periodoInvalido = Boolean(inicio && fim && inicio > fim)
  const podeCriar = Boolean(inicio && fim) && !periodoInvalido

  const dias =
    podeCriar
      ? Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000) + 1
      : 0

  const criar = async () => {
    if (!podeCriar || salvando) return
    setSalvando(true)
    setErro(null)
    try {
      // O contrato pede `date-time` em UTC; o campo devolve a data LOCAL. O bloqueio cobre
      // os dias inteiros no fuso da profissional, então a conversão precisa passar pelo
      // fuso — concatenar `Z` deslocaria o período (em Brasília, 3h para trás).
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
      showToast('Bloqueio desfeito.', 'success')
      recarregar()
    } catch {
      setErro(mensagemDe())
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Bloquear datas"
        description="Férias, viagens, qualquer ausência. Nenhum horário é oferecido dentro de um período bloqueado."
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Novo bloqueio */}
          <section className={CARD}>
            <h3 className="font-display text-lg text-plum">Novo período</h3>
            <div className="mt-3.5 flex flex-wrap items-start gap-3">
              <DateInput label="De" value={inicio} min={hojeISO()} onChange={setInicio} className="w-[190px]" />
              <DateInput
                label="Até"
                value={fim}
                min={inicio || hojeISO()}
                onChange={setFim}
                errorMessage={periodoInvalido ? 'Precisa ser igual ou depois da data inicial.' : undefined}
                className="w-[190px]"
              />
              <div className="pt-[26px]">
                <ESButton variant="primary" onPress={criar} isLoading={salvando} isDisabled={!podeCriar}>
                  Bloquear período
                </ESButton>
              </div>
            </div>
            {podeCriar && (
              <p className="mt-2 text-xs text-plum/45">
                {dias} {dias === 1 ? 'dia será bloqueado' : 'dias serão bloqueados'}.
              </p>
            )}
          </section>

          {erro && (
            <p className="rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
              {erro}
            </p>
          )}

          {afetadas && (
            afetadas.length > 0 ? (
              <SessoesAfetadas sessoes={afetadas} titulo="Sessões marcadas dentro do bloqueio" />
            ) : (
              <p className="rounded-card border border-success-dark/25 bg-success-dark/[0.06] p-4 text-[13.5px] text-success-dark">
                Nenhuma sessão marcada caía nesse período.
              </p>
            )
          )}

          {/* Bloqueios existentes */}
          <section className={CARD}>
            <h3 className="mb-3.5 font-display text-lg text-plum">Seus bloqueios</h3>
            <Estado
              carregando={carregando}
              erro={erroCarga}
              vazio={vazio}
              aoRepetir={recarregar}
              aoVazio={<p className="text-[13px] text-plum/45">Você ainda não bloqueou nenhum período.</p>}
            >
              <ul className="flex flex-col gap-2">
                {itens.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-plum/8 bg-cream/40 px-4 py-3"
                  >
                    <span className="text-[13.5px] text-plum">
                      {dataCurta(b.dataInicio)} até {dataCurta(b.dataFim)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remover(b.id)}
                      disabled={removendo === b.id}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-plum/50 transition-colors hover:text-red-alert disabled:opacity-50"
                    >
                      <TrashIcon size={15} /> {removendo === b.id ? 'Desfazendo…' : 'Desfazer'}
                    </button>
                  </li>
                ))}
              </ul>
              {temMais && (
                <VerMais carregado={itens.length} total={total} carregando={carregandoMais} onVerMais={carregarMais} />
              )}
            </Estado>
          </section>
        </div>

        <aside className="w-full lg:w-[300px] lg:shrink-0">
          <section className={CARD}>
            <h3 className="font-display text-base text-plum">Nada é cancelado</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-plum/55">
              Bloquear um período impede novas marcações, mas as sessões que já existem
              continuam valendo. Se precisar desmarcar alguma, faça isso pelo detalhe da sessão.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
