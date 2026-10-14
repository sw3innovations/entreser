'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/lib/use-hydrated'
import { useToast } from '@/components/ui'
import { XIcon } from '../ui/icons'
import { jornadaApi, type Emocao } from './api'

/**
 * O "tempo" de hoje — a escala de 1 a 5 do termômetro emocional, dita como clima em vez de
 * nota. É a mesma metáfora do chip da Home (☀️🌀🌧️) e é o que o backend chama de "a palavra
 * que escolhi" (v2 do aviso, 25/09): não é pontuação de desempenho, e a tela não pode parecer
 * uma prova. A ordem vai do mais pesado ao mais leve porque é assim que se lê uma escala.
 */
const HUMORES = [
  { valor: 1, emoji: '⛈️', rotulo: 'Tempestade' },
  { valor: 2, emoji: '🌧️', rotulo: 'Chuvoso' },
  { valor: 3, emoji: '☁️', rotulo: 'Nublado' },
  { valor: 4, emoji: '🌤️', rotulo: 'Abrindo' },
  { valor: 5, emoji: '☀️', rotulo: 'Ensolarado' },
] as const

/** A lista é a do backend (`EMOCOES_PERMITIDAS`); qualquer outra volta 400. */
const EMOCOES: { valor: Emocao; rotulo: string }[] = [
  { valor: 'CALMA', rotulo: 'Calma' },
  { valor: 'ESPERANCOSA', rotulo: 'Esperançosa' },
  { valor: 'ALIVIADA', rotulo: 'Aliviada' },
  { valor: 'ANSIOSA', rotulo: 'Ansiosa' },
  { valor: 'TRISTE', rotulo: 'Triste' },
  { valor: 'EXAUSTA', rotulo: 'Exausta' },
  { valor: 'IRRITADA', rotulo: 'Irritada' },
  { valor: 'OUTRA', rotulo: 'Outra coisa' },
]
const MAX_EMOCOES = 5

const CHAVE_PULO = 'entreser:checkin-pulado'

function hojeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Ela disse "agora não" hoje? Fica no aparelho: é preferência de exibição, não dado clínico. */
export function checkinPuladoHoje(): boolean {
  try {
    return localStorage.getItem(CHAVE_PULO) === hojeLocal()
  } catch {
    return false
  }
}
function marcarPuloHoje() {
  try {
    localStorage.setItem(CHAVE_PULO, hojeLocal())
  } catch {
    /* sem armazenamento: o check-in só volta a abrir sozinho na próxima visita */
  }
}

type Resultado = 'registrado' | 'pulado'

/**
 * CheckinSheet — "Como você está hoje?" como tela sobreposta, no lugar do card grande que
 * ocupava a Home. Bottom sheet alto no mobile, diálogo centrado no desktop.
 *
 * Três toques no máximo: o tempo do dia (obrigatório), até cinco emoções (opcional) e uma nota
 * (opcional, escondida atrás de um convite). "Agora não" é tão visível quanto "Registrar" —
 * autonomia é regra do produto, e pular nunca pode parecer falha.
 *
 * Quando a NOTA escrita aciona a detecção de risco do backend (`mostrarApoio` —
 * `RiscoDiarioService.avaliarTermometro` cria um alerta para a equipe de cuidado), a tela NÃO
 * fecha: troca para uma mensagem de cuidado com o CVV. Fechar com um toast de "registrado"
 * depois de ela escrever algo assim seria exatamente o que não pode acontecer.
 */
export function CheckinSheet({ aberto, aoFechar }: { aberto: boolean; aoFechar: (r: Resultado) => void }) {
  const hidratado = useHydrated()
  const { showToast } = useToast()
  const [humor, setHumor] = useState<number | null>(null)
  const [emocoes, setEmocoes] = useState<Emocao[]>([])
  const [nota, setNota] = useState('')
  const [escrevendo, setEscrevendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [apoio, setApoio] = useState(false)

  // Trava o scroll do fundo enquanto a tela está aberta.
  useEffect(() => {
    if (!aberto) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [aberto])

  if (!aberto || !hidratado) return null

  const limpar = () => {
    setHumor(null)
    setEmocoes([])
    setNota('')
    setEscrevendo(false)
    setErro(null)
    setApoio(false)
  }

  const pular = () => {
    marcarPuloHoje()
    limpar()
    aoFechar('pulado')
  }

  const alternarEmocao = (e: Emocao) => {
    setEmocoes((atual) =>
      atual.includes(e) ? atual.filter((x) => x !== e) : atual.length >= MAX_EMOCOES ? atual : [...atual, e],
    )
  }

  const registrar = async () => {
    if (humor == null || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await jornadaApi.registrarTermometro({ pontuacao: humor, emocoes, nota: nota.trim() || undefined })
      if (r?.mostrarApoio) {
        setApoio(true)
        return
      }
      showToast('Registrado. Obrigada por contar como você está.', 'success')
      limpar()
      aoFechar('registrado')
    } catch {
      setErro('Não conseguimos registrar agora. Tente de novo em instantes.')
    } finally {
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-plum/40 backdrop-blur-sm sm:items-center" role="dialog" aria-modal aria-labelledby="checkin-titulo">
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#FBF9FA] shadow-modal sm:max-w-lg sm:rounded-[28px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,#E7D7DF_0%,rgba(251,249,250,0)_100%)]" />

        <div className="relative flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mauve">Check-in</p>
            <h2 id="checkin-titulo" className="mt-1.5 font-display text-[30px] leading-[1.08] text-plum">
              {apoio ? 'Obrigada por contar.' : 'Como você está hoje?'}
            </h2>
          </div>
          <button
            type="button"
            onClick={apoio ? () => { limpar(); aoFechar('registrado') } : pular}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-plum/60 transition-es hover:text-plum"
          >
            <XIcon size={18} />
          </button>
        </div>

        {apoio ? (
          <div className="relative flex flex-col gap-4 px-6 pb-7 pt-4">
            <p className="text-[15.5px] leading-relaxed text-plum/80">
              Parece que hoje está pesado. Você não precisa atravessar isso sozinha — a equipe de
              cuidado do Entre Ser recebeu um aviso e pode entrar em contato com você.
            </p>
            <div className="rounded-2xl border border-mauve/20 bg-mauve-ghost p-4">
              <p className="text-[14px] font-semibold text-plum">Se precisar falar com alguém agora</p>
              <p className="mt-1 text-[14px] leading-relaxed text-plum/75">
                Ligue <strong className="text-plum">188</strong> (CVV) — gratuito, 24 horas, todos os dias.
                Em emergência, <strong className="text-plum">192</strong> (SAMU).
              </p>
            </div>
            <button
              type="button"
              onClick={() => { limpar(); aoFechar('registrado') }}
              className="h-[50px] rounded-full bg-mauve text-[15px] font-semibold text-cream transition-es hover:bg-mauve-dark"
            >
              Entendi
            </button>
          </div>
        ) : (
          <>
            <div className="relative flex-1 overflow-y-auto px-6 pb-4 pt-5">
              <p className="text-[13.5px] text-plum/60">Se o seu dia fosse um tempo, qual seria?</p>
              <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Como está o seu dia">
                {HUMORES.map((h) => {
                  const ativo = humor === h.valor
                  return (
                    <button
                      key={h.valor}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setHumor(h.valor)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 transition-es',
                        ativo
                          ? 'border-mauve bg-white shadow-[0_6px_18px_rgba(122,74,92,0.22)]'
                          : 'border-transparent bg-white/70 hover:bg-white',
                      )}
                    >
                      <span className={cn('text-[30px] leading-none transition-transform', ativo && 'scale-110')} aria-hidden>
                        {h.emoji}
                      </span>
                      <span className={cn('text-[11px] font-semibold', ativo ? 'text-mauve' : 'text-plum/55')}>{h.rotulo}</span>
                    </button>
                  )
                })}
              </div>

              <p className="mt-6 text-[13.5px] text-plum/60">
                O que está mais presente? <span className="text-plum/40">Opcional · até {MAX_EMOCOES}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EMOCOES.map((e) => {
                  const ativo = emocoes.includes(e.valor)
                  const cheio = !ativo && emocoes.length >= MAX_EMOCOES
                  return (
                    <button
                      key={e.valor}
                      type="button"
                      aria-pressed={ativo}
                      disabled={cheio}
                      onClick={() => alternarEmocao(e.valor)}
                      className={cn(
                        'rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-es disabled:opacity-40',
                        ativo ? 'border-plum bg-plum text-cream' : 'border-plum/10 bg-white text-plum hover:border-mauve/40',
                      )}
                    >
                      {e.rotulo}
                    </button>
                  )
                })}
              </div>

              {escrevendo ? (
                <textarea
                  autoFocus
                  value={nota}
                  onChange={(ev) => setNota(ev.target.value.slice(0, 2000))}
                  rows={3}
                  placeholder="Se quiser, com suas palavras…"
                  className="mt-5 w-full resize-none rounded-2xl border border-plum/10 bg-white px-4 py-3 text-[15px] leading-relaxed text-plum placeholder:text-plum/30 focus:border-mauve focus:outline-none focus:ring-1 focus:ring-mauve"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEscrevendo(true)}
                  className="mt-5 text-[13.5px] font-semibold text-mauve hover:text-mauve-dark"
                >
                  + Quer escrever algo?
                </button>
              )}

              {erro && <p className="mt-4 text-[13.5px] font-medium text-red-alert">{erro}</p>}
            </div>

            <div className="relative flex gap-2.5 border-t border-plum/[0.06] bg-[#FBF9FA] px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={pular}
                disabled={enviando}
                className="h-[50px] flex-1 rounded-full border border-plum/12 bg-white text-[15px] font-semibold text-plum/70 transition-es hover:text-plum disabled:opacity-60"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={registrar}
                disabled={humor == null || enviando}
                className="h-[50px] flex-[1.4] rounded-full bg-mauve text-[15px] font-semibold text-cream shadow-[0_8px_22px_rgba(122,74,92,0.28)] transition-es hover:bg-mauve-dark disabled:opacity-45 disabled:shadow-none"
              >
                {enviando ? 'Registrando…' : 'Registrar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * CheckinChip — a versão reduzida que fica na Home quando ela pulou o check-in hoje. Reabre
 * a mesma tela. Desenho do protótipo (pílula branca, ☀️🌀🌧️, "Registrar →").
 */
export function CheckinChip({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-3 rounded-full border border-mauve/[0.16] bg-white py-[11px] pl-4 pr-3.5 text-left shadow-[0_4px_16px_rgba(45,24,64,0.06)] transition-es hover:border-mauve/30"
    >
      <span className="text-[16px] tracking-[-2px]" aria-hidden>☀️🌀🌧️</span>
      <span className="flex-1 text-[13.5px] font-semibold text-plum">Como você está hoje?</span>
      <span className="text-[12.5px] font-semibold text-mauve">Registrar →</span>
    </button>
  )
}
