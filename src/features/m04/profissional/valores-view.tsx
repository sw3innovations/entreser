'use client'

import { useState } from 'react'
import { ESButton, PageHeader, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { useRecurso } from '@/features/m04/api/use-recurso'
import { Estado } from '@/features/m04/ui/estado'
import type { components } from '@/features/m04/api/schema'

type TipoSessao = components['schemas']['TipoSessao']
type TipoInfo = components['schemas']['TipoSessaoInfo']

/** Estado local do formulário: o valor digitado por tipo, como texto. */
type Rascunho = Record<string, string>

const CARD = 'rounded-card border border-plum/5 bg-white p-[26px] shadow-[0_10px_30px_rgba(45,24,64,0.06)]'
const INPUT =
  'w-full rounded-input border border-plum/[0.14] bg-white py-[13px] pl-11 pr-[15px] text-[15px] text-plum outline-none transition-colors placeholder:text-plum/35 focus:border-mauve'

/** "250" ou "250,50" → 250.5 · vazio → null (tipo não oferecido). */
function paraNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

function paraTexto(valor: number | null | undefined): string {
  if (valor == null) return ''
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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
  const valorDe = (tipo: TipoSessao): string =>
    rascunho[tipo] ?? paraTexto(valores?.valores.find((v) => v.tipoSessao === tipo)?.valor)

  const editar = (tipo: TipoSessao, texto: string) => {
    setRascunho((r) => ({ ...r, [tipo]: texto.replace(/[^\d.,]/g, '') }))
    setSujo(true)
    setErro(null)
  }

  const invalidos = tipos.filter((t) => {
    const texto = valorDe(t.codigo)
    if (!texto.trim()) return false
    const n = paraNumero(texto)
    return n == null || n <= 0
  })

  const salvar = async () => {
    if (salvando || invalidos.length > 0) return
    setSalvando(true)
    setErro(null)
    try {
      // Substituição total: TODOS os tipos vão no corpo, os vazios como null.
      const body = {
        valores: tipos.map((t) => ({ tipoSessao: t.codigo, valor: paraNumero(valorDe(t.codigo)) })),
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

  const definidos = tipos.filter((t) => valorDe(t.codigo).trim()).length

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
              const texto = valorDe(t.codigo)
              const ehGrupo = t.categoria === 'Grupo'
              const invalido = invalidos.some((i) => i.codigo === t.codigo)
              const n = paraNumero(texto)
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
                    {!texto.trim() && (
                      <span className="rounded-pill bg-plum/6 px-2.5 py-1 text-[11px] font-medium text-plum/50">
                        Não aparece para as usuárias
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 max-w-[280px]">
                    <label className="block">
                      <span className="text-sm font-medium text-plum/70">
                        {ehGrupo ? 'Valor por participante' : 'Valor da sessão'}
                      </span>
                      <div className="relative mt-1.5">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-plum/45">
                          R$
                        </span>
                        <input
                          value={texto}
                          onChange={(e) => editar(t.codigo, e.target.value)}
                          inputMode="decimal"
                          placeholder="0,00"
                          className={cn(INPUT, invalido && 'border-red-alert')}
                        />
                      </div>
                    </label>
                    {invalido && <p className="mt-1.5 text-xs text-red-alert">Informe um valor maior que zero.</p>}
                    {ehGrupo && n != null && n > 0 && (
                      <p className="mt-1.5 text-xs text-plum/45">
                        Até R$ {(n * t.maxParticipantes).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} com {t.maxParticipantes} inscritas.
                      </p>
                    )}
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
