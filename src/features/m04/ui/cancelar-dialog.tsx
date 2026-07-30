'use client'

import { useState } from 'react'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import type { components } from '@/features/m04/api/schema'

type Sessao = components['schemas']['Sessao']

interface Props {
  sessao: Sessao
  onFechar: () => void
  /** Recebe a sessão já cancelada (o backend devolve o agregado atualizado) e se houve cobrança. */
  onCancelada: (s: Sessao, cobrancaAplicada: boolean) => void
  /**
   * Quem está cancelando. Muda só o texto: a usuária pode ter cobrança quando faltam
   * menos de 24h; a profissional cancela a qualquer momento, sem penalidade (PF7). O
   * endpoint e o corpo são os mesmos para as duas.
   */
  perfil?: 'usuaria' | 'profissional'
  /**
   * Qual operação executar. `cancelarSessao` encerra a sessão para todo mundo (estado
   * final); `sairDoGrupo` só libera a vaga da usuária e mantém o encontro de pé para as
   * outras inscritas. Confundir as duas faz uma participante cancelar a Roda inteira.
   */
  acao?: 'cancelarSessao' | 'sairDoGrupo'
}

/**
 * Cancelar sessão — overlay sobre o detalhe (U11 na usuária, PF7 na profissional).
 *
 * O aviso de cobrança sai de `podeCancelarSemCobranca` (campo pronto; a tela não calcula
 * prazo). A resposta é um `CancelamentoResponse`, que EMBRULHA a sessão em `.sessao` —
 * diferente das outras escritas, que devolvem `Sessao` direta. `percentualCobrado` fica
 * oculto enquanto vier nulo (D27): no MVP a tela fala só "com custo" / "sem custo".
 */
export function CancelarDialog({
  sessao,
  onFechar,
  onCancelada,
  perfil = 'usuaria',
  acao = 'cancelarSessao',
}: Props) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ehProfissional = perfil === 'profissional'
  const ehSaidaDeGrupo = acao === 'sairDoGrupo'
  // Só a usuária pode ter cobrança; a profissional cancela sem penalidade (PF7).
  const comCobranca = !ehProfissional && !sessao.podeCancelarSemCobranca

  const cancelar = async () => {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      // Duas operações distintas do contrato, com a MESMA resposta (CancelamentoResponse):
      // sair do grupo libera a vaga e mantém a sessão de pé para as outras; cancelar
      // encerra a sessão inteira, em estado final.
      const { data, error } = ehSaidaDeGrupo
        ? await m04.DELETE('/sessoes/{sessaoId}/inscrever', {
            params: { path: { sessaoId: sessao.id } },
          })
        : await m04.POST('/sessoes/{sessaoId}/cancelar', {
            params: { path: { sessaoId: sessao.id } },
            body: motivo.trim() ? { motivo: motivo.trim() } : {},
          })
      if (error) {
        setErro(mensagemDe((error as { code?: string }).code))
        return
      }
      if (data) onCancelada(data.sessao, data.cobrancaAplicada)
    } catch {
      setErro(mensagemDe())
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-plum/45 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-card bg-white p-6 shadow-modal sm:rounded-card">
        <h2 className="font-display text-2xl text-plum">
          {ehSaidaDeGrupo ? 'Cancelar sua inscrição?' : 'Cancelar esta sessão?'}
        </h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-plum/65">
          {ehSaidaDeGrupo
            ? comCobranca
              ? 'Faltam menos de 24 horas, então a desistência tem custo. O encontro continua acontecendo para as outras participantes.'
              : 'Você pode desistir sem custo — ainda faltam mais de 24 horas. Sua vaga fica livre para outra pessoa.'
            : ehProfissional
              ? 'A usuária será avisada. Esta ação não pode ser desfeita.'
              : comCobranca
                ? 'Faltam menos de 24 horas para esta sessão, então o cancelamento tem custo.'
                : 'Você pode cancelar sem custo — ainda faltam mais de 24 horas.'}
        </p>

        {/* `sairDoGrupo` não recebe motivo — o contrato não tem corpo nesse endpoint. */}
        {!ehSaidaDeGrupo && (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-plum/70">Motivo (opcional)</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={
                ehProfissional
                  ? 'Se quiser, explique o motivo — a usuária vai ver.'
                  : 'Se quiser, conte o que aconteceu — a profissional vai ver.'
              }
              className="mt-1.5 w-full resize-none rounded-input border border-plum/[0.14] bg-white px-4 py-3 text-[14.5px] text-plum outline-none transition-colors placeholder:text-plum/35 focus:border-mauve"
            />
          </label>
        )}

        {erro && <p className="mt-3 text-[13.5px] font-medium text-red-alert">{erro}</p>}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="h-[46px] flex-1 rounded-full border border-plum/15 bg-white text-[14.5px] font-semibold text-plum transition-es disabled:opacity-60"
          >
            {ehSaidaDeGrupo ? 'Continuar inscrita' : 'Manter sessão'}
          </button>
          <button
            type="button"
            onClick={cancelar}
            disabled={enviando}
            className="h-[46px] flex-1 rounded-full bg-mauve text-[14.5px] font-semibold text-cream transition-es disabled:opacity-60"
          >
            {enviando
              ? ehSaidaDeGrupo
                ? 'Saindo…'
                : 'Cancelando…'
              : ehSaidaDeGrupo
                ? 'Cancelar inscrição'
                : 'Cancelar sessão'}
          </button>
        </div>
      </div>
    </div>
  )
}
