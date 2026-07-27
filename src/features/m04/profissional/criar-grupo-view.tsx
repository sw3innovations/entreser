'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackButton, DateInput, ESButton, PageHeader, TextInput, TimeInput, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import { hojeISO, reais } from '@/features/m04/lib/datas'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']
type TipoInfo = components['schemas']['TipoSessaoInfo']

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'
const INPUT =
  'w-full rounded-input border border-plum/[0.14] bg-white px-4 py-3 text-[14.5px] text-plum outline-none transition-colors placeholder:text-plum/35 focus:border-mauve'

const MAX_TITULO = 200

/**
 * P7 · Criar sessão de grupo. Só oferece tipos com `categoria: 'Grupo'` e limites de vagas
 * do catálogo (`min/maxParticipantes`) — nada digitado na tela. Um tipo sem valor definido
 * não pode ser criado: o backend rejeitaria com `VALOR_NAO_DEFINIDO`, então a tela avisa
 * antes e leva a Meus valores.
 */
export function CriarGrupoView() {
  const router = useRouter()
  const { showToast } = useToast()
  const [tipo, setTipo] = useState<TipoSessao | null>(null)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [horario, setHorario] = useState('')
  const [vagas, setVagas] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { dados: catalogo, carregando, erro: erroCarga, recarregar } = useRecurso(
    () => m04.GET('/tipos-sessao'),
    [],
  )
  const { dados: valores } = useRecurso(() => m04.GET('/profissional/valores'), [])

  const grupos: TipoInfo[] = (catalogo?.tipos ?? []).filter((t) => t.categoria === 'Grupo')
  const info = grupos.find((t) => t.codigo === tipo)
  const valorDoTipo = valores?.valores.find((v) => v.tipoSessao === tipo)?.valor ?? null
  const semValor = tipo != null && valorDoTipo == null

  const escolherTipo = (t: TipoInfo) => {
    setTipo(t.codigo)
    setVagas(t.maxParticipantes)
    setErro(null)
  }

  // As vagas precisam caber na faixa do catálogo — o backend recusaria com
  // CAPACIDADE_INVALIDA, então a tela avisa antes.
  const vagasForaDaFaixa =
    info != null && vagas != null && (vagas < info.minParticipantes || vagas > info.maxParticipantes)
  const podeCriar =
    Boolean(tipo && titulo.trim() && data && horario && vagas) && !semValor && !vagasForaDaFaixa

  const criar = async () => {
    if (!podeCriar || salvando || !tipo || !vagas) return
    setSalvando(true)
    setErro(null)
    try {
      // O input é hora local; o contrato quer UTC com offset.
      const dataHora = new Date(`${data}T${horario}`).toISOString()
      const { data: sessao, error } = await m04.POST('/profissional/sessoes/grupo', {
        body: { tipo, dataHora, titulo: titulo.trim(), vagas },
      })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      showToast('Sessão de grupo criada.', 'success')
      if (sessao) router.push(`/admin/agenda/${sessao.id}`)
    } catch {
      setErro(mensagemDe())
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <BackButton href="/admin/agenda" label="Voltar para a agenda" />
      <PageHeader
        breadcrumb={[{ label: 'Minha agenda', href: '/admin/agenda' }, { label: 'Nova sessão de grupo' }]}
        title="Criar sessão de grupo"
        description="Um encontro com tema definido. As usuárias se inscrevem enquanto houver vaga."
      />

      <Estado carregando={carregando} erro={erroCarga} aoRepetir={recarregar}>
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* Tipo */}
            <section className={CARD}>
              <h3 className="font-display text-lg text-plum">Tipo de sessão</h3>
              <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                {grupos.map((t) => {
                  const valor = valores?.valores.find((v) => v.tipoSessao === t.codigo)?.valor ?? null
                  const ativo = tipo === t.codigo
                  return (
                    <button
                      key={t.codigo}
                      type="button"
                      onClick={() => escolherTipo(t)}
                      className={cn(
                        'rounded-input border p-4 text-left transition-es',
                        ativo ? 'border-mauve bg-mauve-ghost/60' : 'border-plum/12 bg-white hover:border-mauve/40',
                      )}
                    >
                      <span className="block text-[14.5px] font-semibold text-plum">{t.nome}</span>
                      <span className="mt-0.5 block text-xs text-plum/50">
                        {t.duracaoMinutos} min · {t.minParticipantes} a {t.maxParticipantes} pessoas
                      </span>
                      <span className={cn('mt-1 block text-xs font-medium', valor == null ? 'text-red-alert' : 'text-mauve')}>
                        {valor == null ? 'Sem valor definido' : `${reais(valor)} por participante`}
                      </span>
                    </button>
                  )
                })}
              </div>
              {semValor && (
                <p className="mt-3 text-[13px] text-red-alert">
                  Defina um valor para este tipo antes de criar a sessão.{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/admin/valores')}
                    className="font-semibold underline underline-offset-2"
                  >
                    Ir para Meus valores
                  </button>
                </p>
              )}
            </section>

            {/* Detalhes */}
            {tipo && info && (
              <section className={CARD}>
                <h3 className="font-display text-lg text-plum">Detalhes</h3>
                <div className="mt-3.5 flex flex-col gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-plum/70">Tema do encontro</span>
                    <input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value.slice(0, MAX_TITULO))}
                      placeholder="Ex.: Ciclos e transições"
                      className={cn(INPUT, 'mt-1.5')}
                    />
                    <span className="mt-1 block text-right text-xs text-plum/40">
                      {titulo.length}/{MAX_TITULO}
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-4">
                    <DateInput label="Data" value={data} min={hojeISO()} onChange={setData} className="w-[190px]" />
                    <TimeInput label="Horário" value={horario} onChange={setHorario} className="w-[150px]" />
                    <TextInput
                      label="Vagas"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder={`${info.minParticipantes} a ${info.maxParticipantes}`}
                      value={vagas == null ? '' : String(vagas)}
                      onChange={(v) => setVagas(Number(v.replace(/\D/g, '')) || null)}
                      errorMessage={vagasForaDaFaixa ? `Entre ${info.minParticipantes} e ${info.maxParticipantes}.` : undefined}
                      className="w-[150px]"
                    />
                  </div>
                </div>
              </section>
            )}

            {erro && (
              <p className="rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
                {erro}
              </p>
            )}
          </div>

          <aside className="w-full lg:w-[300px] lg:shrink-0">
            <section className={CARD}>
              <h3 className="font-display text-base text-plum">Mínimo de inscritas</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-plum/55">
                A sessão precisa de um número mínimo de inscritas para acontecer. Se não
                atingir até 24 horas antes, ela é cancelada automaticamente e todas são
                avisadas.
              </p>
            </section>
          </aside>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 border-t border-plum/8 pt-5">
          <ESButton variant="ghost" onPress={() => router.push('/admin/agenda')} isDisabled={salvando}>
            Cancelar
          </ESButton>
          <ESButton variant="primary" onPress={criar} isLoading={salvando} isDisabled={!podeCriar}>
            Criar sessão
          </ESButton>
        </div>
      </Estado>
    </div>
  )
}
