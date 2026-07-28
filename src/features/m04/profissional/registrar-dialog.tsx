'use client'

import { useState } from 'react'
import { m04 } from '@/features/m04/api/client'
import { mensagemDe } from '@/features/m04/api/erros'
import { cn } from '@/lib/utils'
import type { components } from '@/features/m04/api/schema'

type Sessao = components['schemas']['Sessao']

type Acao = 'realizada' | 'faltou' | 'cancelar'

interface OpcaoAcao {
  chave: Acao
  rotulo: string
  descricao: string
  tom: 'neutro' | 'alerta'
}

/**
 * As ações mudam por tipo de sessão. `PATCH /nao-compareceu` é declarado no contrato como
 * **aplicável a sessões individuais** — num grupo a falta é de cada participante, marcada
 * uma a uma na P2, e o fechamento é `PATCH /realizada`. Oferecer "não compareceu" num
 * grupo levaria o encontro inteiro a um estado final sem nenhuma presença registrada.
 */
function acoesDe(ehGrupo: boolean): OpcaoAcao[] {
  const realizada: OpcaoAcao = ehGrupo
    ? {
        chave: 'realizada',
        rotulo: 'Encerrar sessão',
        descricao: 'Fecha o encontro com as presenças que você registrou.',
        tom: 'neutro',
      }
    : {
        chave: 'realizada',
        rotulo: 'A sessão aconteceu',
        descricao: 'Registra a sessão como realizada.',
        tom: 'neutro',
      }

  const cancelar: OpcaoAcao = {
    chave: 'cancelar',
    rotulo: 'Cancelar a sessão',
    descricao: 'Use quando a sessão não aconteceu e não deve contar como falta.',
    tom: 'alerta',
  }

  if (ehGrupo) return [realizada, cancelar]

  return [
    realizada,
    {
      chave: 'faltou',
      rotulo: 'A usuária não compareceu',
      descricao: 'Registra a falta. Ela passa a contar no histórico da usuária.',
      tom: 'alerta',
    },
    cancelar,
  ]
}

/**
 * P3 · Registrar o que aconteceu — overlay sobre a P2, sem carregar nada próprio.
 *
 * TODAS as ações levam a um estado final e imutável, e por isso todas passam por uma
 * etapa de confirmação (D17) — inclusive "aconteceu". Confirmar só a falta e o
 * cancelamento sugeriria que registrar a realização é reversível, e não é.
 *
 * Em grupo, encerrar só é liberado depois que todas as presenças foram registradas (P3):
 * fechar antes disso deixaria participantes sem presença num estado que não volta atrás.
 */
export function RegistrarDialog({
  sessao,
  ehGrupo = false,
  presencasPendentes = 0,
  onFechar,
  onRegistrada,
}: {
  sessao: Sessao
  /** Vem da `categoria` do catálogo — o tipo de sessão decide quais ações existem. */
  ehGrupo?: boolean
  /** Participantes ativos ainda sem presença registrada. Trava o "Encerrar". */
  presencasPendentes?: number
  onFechar: () => void
  onRegistrada: () => void
}) {
  const [escolha, setEscolha] = useState<Acao | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const acoes = acoesDe(ehGrupo)
  const acao = acoes.find((a) => a.chave === escolha)
  const encerrarTravado = ehGrupo && presencasPendentes > 0

  const confirmar = async () => {
    if (!escolha || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const path = { path: { sessaoId: sessao.id } }
      const r =
        escolha === 'realizada'
          ? await m04.PATCH('/sessoes/{sessaoId}/realizada', { params: path })
          : escolha === 'faltou'
            ? await m04.PATCH('/sessoes/{sessaoId}/nao-compareceu', { params: path })
            : await m04.POST('/sessoes/{sessaoId}/cancelar', { params: path, body: {} })
      if (r.error) {
        setErro(mensagemDe((r.error as { code?: string }).code))
        return
      }
      onRegistrada()
    } catch {
      setErro(mensagemDe())
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-plum/45 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-modal">
        {!escolha ? (
          <>
            <h2 className="font-display text-2xl text-plum">O que aconteceu?</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-plum/60">
              O registro é definitivo e não pode ser desfeito.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {acoes.map((a) => {
                const travada = a.chave === 'realizada' && encerrarTravado
                return (
                  <button
                    key={a.chave}
                    type="button"
                    onClick={() => setEscolha(a.chave)}
                    disabled={travada}
                    className={cn(
                      'rounded-input border p-4 text-left transition-es disabled:cursor-not-allowed disabled:opacity-50',
                      a.tom === 'alerta'
                        ? 'border-red-alert/25 bg-red-alert/[0.04] hover:border-red-alert/45'
                        : 'border-plum/12 bg-white hover:border-mauve/40',
                    )}
                  >
                    <span
                      className={cn(
                        'block text-[14.5px] font-semibold',
                        a.tom === 'alerta' ? 'text-red-alert' : 'text-plum',
                      )}
                    >
                      {a.rotulo}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-plum/55">
                      {travada
                        ? `Registre a presença de ${presencasPendentes === 1 ? 'mais 1 participante' : `mais ${presencasPendentes} participantes`} antes de encerrar.`
                        : a.descricao}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={onFechar}
              className="mt-4 h-[46px] w-full rounded-full border border-plum/15 bg-white text-[14.5px] font-semibold text-plum"
            >
              Voltar
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl text-plum">Confirmar registro</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-plum/70">
              Você vai registrar: <strong className="font-semibold">{acao?.rotulo.toLowerCase()}</strong>.
              Depois de salvar, isso não pode ser alterado.
            </p>
            {erro && <p className="mt-3 text-[13.5px] font-medium text-red-alert">{erro}</p>}
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setEscolha(null)}
                disabled={enviando}
                className="h-[46px] flex-1 rounded-full border border-plum/15 bg-white text-[14.5px] font-semibold text-plum disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                className="h-[46px] flex-1 rounded-full bg-mauve text-[14.5px] font-semibold text-cream disabled:opacity-60"
              >
                {enviando ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
