'use client'

import { useState } from 'react'
import { ESButton, MoneyInput, PageHeader, formatCentavos, useToast } from '@/components/ui'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']
type TipoInfo = components['schemas']['TipoSessaoInfo']

/**
 * Estado local do formulário: o valor por tipo, em REAIS. `null` = tipo não oferecido —
 * é o mesmo vocabulário do contrato, então não há conversão de texto no meio.
 */
type Rascunho = Record<string, number | null>

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'

/**
 * P6 · Meus valores. Um campo por tipo do catálogo (`GET /tipos-sessao` — a lista e os
 * limites nunca são escritos na tela). Campo vazio significa "não ofereço este tipo": ele
 * simplesmente não aparece para as usuárias.
 *
 * O `PUT` é SUBSTITUIÇÃO TOTAL — envia todos os tipos, inclusive os nulos. E mudar um
 * valor não mexe em sessões já marcadas: elas guardam o `valorPraticado` da época (D6).
 */
export function ValoresView() {
  const { showToast } = useToast()
  const [rascunho, setRascunho] = useState<Rascunho>({})
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { dados: catalogo, carregando: carregandoCatalogo } = useRecurso(() => m04.GET('/tipos-sessao'), [])
  const {
    dados: valores,
    carregando: carregandoValores,
    erro: erroCarga,
    recarregar,
  } = useRecurso(() => m04.GET('/profissional/valores'), [])

  const tipos: TipoInfo[] = catalogo?.tipos ?? []
  const carregando = carregandoCatalogo || carregandoValores

  /**
   * Valor exibido: o que foi digitado, ou — enquanto o campo não foi tocado — o que veio
   * do servidor. Derivar evita semear estado num efeito (que dispara render em cascata) e
   * mantém uma fonte só da verdade enquanto o formulário está limpo.
   */
  const valorDe = (tipo: TipoSessao): number | null =>
    tipo in rascunho ? rascunho[tipo] : (valores?.valores.find((v) => v.tipoSessao === tipo)?.valor ?? null)

  const editar = (tipo: TipoSessao, valor: number | null) => {
    setRascunho((r) => ({ ...r, [tipo]: valor }))
    setSujo(true)
    setErro(null)
  }

  // Vazio (null) é válido: significa "não ofereço". Zero é engano de digitação.
  const invalidos = tipos.filter((t) => valorDe(t.codigo) === 0)

  const salvar = async () => {
    if (salvando || invalidos.length > 0) return
    setSalvando(true)
    setErro(null)
    try {
      // Substituição total: TODOS os tipos vão no corpo, os vazios como null.
      const body = {
        valores: tipos.map((t) => ({ tipoSessao: t.codigo, valor: valorDe(t.codigo) })),
      }
      const { error } = await m04.PUT('/profissional/valores', { body })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      setSujo(false)
      showToast('Valores salvos.', 'success')
      recarregar()
    } catch {
      setErro(mensagemDe())
    } finally {
      setSalvando(false)
    }
  }

  // Descartar é só esquecer o que foi digitado: sem rascunho, os campos voltam a mostrar
  // o que veio do servidor.
  const descartar = () => {
    setRascunho({})
    setSujo(false)
    setErro(null)
  }

  const definidos = tipos.filter((t) => valorDe(t.codigo) != null).length

  return (
    <div>
      <PageHeader
        title="Meus valores"
        description="Quanto você cobra por tipo de sessão. Deixe em branco o que você não oferece."
      />

      <Estado carregando={carregando} erro={erroCarga} aoRepetir={recarregar}>
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {tipos.map((t) => {
              const valor = valorDe(t.codigo)
              const ehGrupo = t.categoria === 'Grupo'
              const invalido = invalidos.some((i) => i.codigo === t.codigo)
              return (
                <section key={t.codigo} className={CARD}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg leading-tight text-plum">{t.nome}</h3>
                      <p className="mt-0.5 text-xs text-plum/45">
                        {t.duracaoMinutos} minutos
                        {ehGrupo && ` · ${t.minParticipantes} a ${t.maxParticipantes} participantes`}
                      </p>
                    </div>
                    {valor == null && (
                      <span className="rounded-pill bg-plum/6 px-2.5 py-1 text-[11px] font-medium text-plum/50">
                        Não aparece para as usuárias
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 max-w-[280px]">
                    <MoneyInput
                      label={ehGrupo ? 'Valor por participante' : 'Valor da sessão'}
                      value={valor}
                      onChange={(v) => editar(t.codigo, v)}
                      errorMessage={invalido ? 'Informe um valor maior que zero.' : undefined}
                      hint={
                        ehGrupo && valor != null && valor > 0
                          ? `Até ${formatCentavos(Math.round(valor * t.maxParticipantes * 100))} com ${t.maxParticipantes} inscritas.`
                          : undefined
                      }
                    />
                  </div>
                </section>
              )
            })}
          </div>

          <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:shrink-0">
            <section className={CARD}>
              <h3 className="font-display text-base text-plum">O passado não muda</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-plum/55">
                Sessões já marcadas guardam o valor da época. Alterar aqui vale só para as
                próximas marcações.
              </p>
            </section>
            <section className={CARD}>
              <h3 className="font-display text-base text-plum">Resumo</h3>
              <p className="mt-1.5 text-[13px] text-plum/55">
                {definidos} de {tipos.length} tipos com valor definido.
              </p>
            </section>
          </aside>
        </div>

        {erro && (
          <p className="mt-5 rounded-input border border-red-alert/30 bg-red-alert/[0.06] px-4 py-3 text-[13.5px] font-medium text-red-alert">
            {erro}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-plum/8 pt-5">
          {sujo && <span className="mr-auto text-[13px] text-mauve">Alterações não salvas</span>}
          <ESButton variant="ghost" onPress={descartar} isDisabled={!sujo || salvando}>
            Descartar
          </ESButton>
          <ESButton variant="primary" onPress={salvar} isLoading={salvando} isDisabled={!sujo || invalidos.length > 0}>
            Salvar valores
          </ESButton>
        </div>
      </Estado>
    </div>
  )
}
